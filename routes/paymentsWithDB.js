// backend/routes/paymentsWithDB.js
// Complete Payment System with Razorpay Integration

const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { 
  PaymentService, 
  UserService, 
  NotificationService,
  ActivityLogService,
  AnalyticsService 
} = require('../services/database');
const EmailService = require('../services/emailService');
const { authenticateToken } = require('./authWithDB');

// ==========================================
// INITIALIZE RAZORPAY
// ==========================================

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ==========================================
// PRICING PLANS
// ==========================================

const PLANS = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 2499, // ₹2,499/month (~$30)
    currency: 'INR',
    credits: 100,
    duration: 'monthly',
    features: [
      'Full code generation',
      'Market research',
      'QA testing',
      '100 builds/month',
      'Email support'
    ]
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    price: 8299, // ₹8,299/month (~$100)
    currency: 'INR',
    credits: 1000,
    duration: 'monthly',
    features: [
      'Everything in Starter',
      'Unlimited builds',
      'Research paper analysis',
      'Priority AI processing',
      'Priority support',
      'Live monitoring',
      'API access'
    ]
  }
};

// ==========================================
// GET ALL PLANS
// ==========================================

router.get('/plans', (req, res) => {
  const plansWithPricing = Object.values(PLANS).map(plan => ({
    ...plan,
    price_formatted: `₹${plan.price.toLocaleString('en-IN')}`,
    price_usd: `$${(plan.price / 83).toFixed(0)}`,
    savings: plan.duration === 'yearly' ? '20% off' : null
  }));

  res.json({
    success: true,
    plans: plansWithPricing,
    currency: 'INR',
    note: 'Prices in Indian Rupees'
  });
});

// ==========================================
// CREATE ORDER (Step 1: Before Payment)
// ==========================================

router.post('/create-order', authenticateToken, async (req, res) => {
  try {
    const { plan } = req.body;

    if (!PLANS[plan]) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const planDetails = PLANS[plan];
    const user = await UserService.findById(req.user.id);

    // Create Razorpay order
    const options = {
      amount: planDetails.price * 100, // Amount in paise
      currency: planDetails.currency,
      receipt: `receipt_${Date.now()}_${user.id}`,
      notes: {
        userId: user.id,
        email: user.email,
        plan: plan,
        credits: planDetails.credits
      }
    };

    const razorpayOrder = await razorpay.orders.create(options);

    // Create payment record in database
    const payment = await PaymentService.create({
      userId: user.id,
      razorpayOrderId: razorpayOrder.id,
      amount: planDetails.price * 100,
      currency: planDetails.currency,
      status: 'created',
      planId: plan,
      planName: planDetails.name,
      planDuration: planDetails.duration,
      receipt: razorpayOrder.receipt,
      notes: options.notes
    });

    // Log activity
    await ActivityLogService.log({
      userId: user.id,
      action: 'payment_initiated',
      resource: 'payment',
      resourceId: payment.id,
      metadata: { plan, amount: planDetails.price }
    });

    res.json({
      success: true,
      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency
      },
      plan: planDetails,
      razorpay_key: process.env.RAZORPAY_KEY_ID,
      payment_id: payment.id
    });

  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ 
      error: 'Failed to create order',
      message: error.message 
    });
  }
});

// ==========================================
// VERIFY PAYMENT (Step 2: After Payment)
// ==========================================

router.post('/verify', authenticateToken, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan
    } = req.body;

    // Verify signature
    const sign = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest('hex');

    if (razorpay_signature !== expectedSign) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment signature'
      });
    }

    // Payment verified! Update database
    const payment = await PaymentService.updateStatus(razorpay_order_id, {
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      status: 'captured'
    });

    // Upgrade user tier
    const subscriptionStart = new Date();
    const subscriptionEnd = new Date();
    subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1); // Monthly

    const user = await UserService.upgradeTier(req.user.id, plan, {
      subscriptionId: razorpay_payment_id,
      subscriptionStatus: 'active',
      subscriptionStart,
      subscriptionEnd
    });

    // Create success notification
    await NotificationService.create(req.user.id, {
      title: 'Payment Successful! 🎉',
      message: `You've successfully upgraded to ${PLANS[plan].name}. ${PLANS[plan].credits} credits added to your account.`,
      type: 'success',
      actionUrl: '/dashboard',
      actionText: 'View Dashboard'
    });

    // Update analytics
    await AnalyticsService.record(req.user.id, {
      revenueGenerated: { increment: payment.amount }
    });

    // Log activity
    await ActivityLogService.log({
      userId: req.user.id,
      action: 'payment_success',
      resource: 'payment',
      resourceId: payment.id,
      metadata: { 
        plan, 
        amount: payment.amount / 100,
        paymentId: razorpay_payment_id 
      }
    });

    // Send confirmation email
    EmailService.sendPaymentSuccess(
      user.email, 
      user.name, 
      PLANS[plan].name, 
      `₹${(payment.amount / 100).toLocaleString('en-IN')}`
    );

    res.json({
      success: true,
      message: 'Payment verified successfully',
      order_id: razorpay_order_id,
      payment_id: razorpay_payment_id,
      plan: PLANS[plan],
      user: {
        tier: user.tier,
        credits: user.credits,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionEnd: user.subscriptionEnd
      }
    });

  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ 
      error: 'Payment verification failed',
      message: error.message 
    });
  }
});

// ==========================================
// GET USER PAYMENTS
// ==========================================

router.get('/history', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status; // 'captured', 'failed', etc.

    let payments = await PaymentService.getUserPayments(req.user.id);

    // Filter by status if provided
    if (status) {
      payments = payments.filter(p => p.status === status);
    }

    // Limit results
    payments = payments.slice(0, limit);

    // Format for frontend
    const formatted = payments.map(payment => ({
      id: payment.id,
      orderId: payment.razorpayOrderId,
      paymentId: payment.razorpayPaymentId,
      amount: payment.amount / 100, // Convert to rupees
      currency: payment.currency,
      status: payment.status,
      plan: payment.planName,
      date: payment.createdAt,
      paidAt: payment.paidAt,
      receipt: payment.receipt
    }));

    res.json({
      success: true,
      payments: formatted,
      total: formatted.length
    });

  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({ error: 'Failed to get payment history' });
  }
});

// ==========================================
// GET PAYMENT BY ID
// ==========================================

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const payment = await PaymentService.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Check ownership
    if (payment.userId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json({
      success: true,
      payment: {
        ...payment,
        amount: payment.amount / 100 // Convert to rupees
      }
    });

  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({ error: 'Failed to get payment' });
  }
});

// ==========================================
// GET PAYMENT STATISTICS
// ==========================================

router.get('/stats/summary', authenticateToken, async (req, res) => {
  try {
    const totalRevenue = await PaymentService.getTotalRevenue(req.user.id);
    const successfulPayments = await PaymentService.getSuccessfulPayments(req.user.id);
    const allPayments = await PaymentService.getUserPayments(req.user.id);

    const stats = {
      totalRevenue: totalRevenue / 100, // Convert to rupees
      totalPayments: successfulPayments.length,
      failedPayments: allPayments.filter(p => p.status === 'failed').length,
      lastPayment: successfulPayments.length > 0 ? {
        date: successfulPayments[0].paidAt,
        amount: successfulPayments[0].amount / 100,
        plan: successfulPayments[0].planName
      } : null,
      revenueByMonth: calculateRevenueByMonth(successfulPayments)
    };

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Get payment stats error:', error);
    res.status(500).json({ error: 'Failed to get payment stats' });
  }
});

// ==========================================
// CANCEL SUBSCRIPTION
// ==========================================

router.post('/subscription/cancel', authenticateToken, async (req, res) => {
  try {
    const user = await UserService.findById(req.user.id);

    if (!user.subscriptionId) {
      return res.status(400).json({ error: 'No active subscription' });
    }

    // Update subscription status
    await UserService.update(req.user.id, {
      subscriptionStatus: 'cancelled'
    });

    // Create notification
    await NotificationService.create(req.user.id, {
      title: 'Subscription Cancelled',
      message: `Your ${user.tier} subscription has been cancelled. You can continue using your credits until ${new Date(user.subscriptionEnd).toLocaleDateString()}.`,
      type: 'warning',
      actionUrl: '/pricing',
      actionText: 'Reactivate'
    });

    // Log activity
    await ActivityLogService.log({
      userId: req.user.id,
      action: 'subscription_cancelled',
      metadata: { 
        tier: user.tier,
        subscriptionId: user.subscriptionId 
      }
    });

    res.json({
      success: true,
      message: 'Subscription cancelled successfully',
      validUntil: user.subscriptionEnd
    });

  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// ==========================================
// RAZORPAY WEBHOOK
// ==========================================

router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = req.body.event;
    const payload = req.body.payload;

    console.log(`📥 Webhook received: ${event}`);

    // Handle different events
    switch (event) {
      case 'payment.captured':
        await handlePaymentCaptured(payload);
        break;

      case 'payment.failed':
        await handlePaymentFailed(payload);
        break;

      case 'subscription.charged':
        await handleSubscriptionCharged(payload);
        break;

      case 'subscription.cancelled':
        await handleSubscriptionCancelled(payload);
        break;

      default:
        console.log(`Unhandled webhook event: ${event}`);
    }

    res.json({ status: 'ok' });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function calculateRevenueByMonth(payments) {
  const byMonth = {};
  
  payments.forEach(payment => {
    const month = new Date(payment.paidAt).toISOString().slice(0, 7); // YYYY-MM
    byMonth[month] = (byMonth[month] || 0) + (payment.amount / 100);
  });

  return Object.entries(byMonth)
    .map(([month, revenue]) => ({ month, revenue }))
    .sort((a, b) => b.month.localeCompare(a.month));
}

async function handlePaymentCaptured(payload) {
  const payment = payload.payment.entity;
  console.log('✅ Payment captured:', payment.id);

  // Update payment status in database
  await PaymentService.updateByPaymentId(payment.id, {
    status: 'captured'
  });
}

async function handlePaymentFailed(payload) {
  const payment = payload.payment.entity;
  console.log('❌ Payment failed:', payment.id);

  // Update payment status
  await PaymentService.updateByPaymentId(payment.id, {
    status: 'failed'
  });

  // Create notification
  const userId = payment.notes?.userId;
  if (userId) {
    await NotificationService.create(userId, {
      title: 'Payment Failed',
      message: 'Your payment could not be processed. Please try again.',
      type: 'error',
      actionUrl: '/pricing',
      actionText: 'Try Again'
    });
  }
}

async function handleSubscriptionCharged(payload) {
  console.log('💳 Subscription charged');
  // Handle recurring subscription charges
}

async function handleSubscriptionCancelled(payload) {
  console.log('🚫 Subscription cancelled via Razorpay');
  // Handle cancellation from Razorpay dashboard
}

module.exports = router;