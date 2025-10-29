// backend/routes/paymentsWithDB.js
// Complete Payment System with Razorpay Integration - FULL UPGRADED VERSION

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
const { authenticateToken } = require('./authWithDb');

// ==========================================
// INITIALIZE RAZORPAY WITH VALIDATION
// ==========================================

console.log('🔧 Initializing Razorpay...');
console.log('   Key ID:', process.env.RAZORPAY_KEY_ID ? `${process.env.RAZORPAY_KEY_ID.substring(0, 15)}...` : '❌ NOT SET');
console.log('   Secret:', process.env.RAZORPAY_KEY_SECRET ? '✅ SET' : '❌ NOT SET');

if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.error('❌ RAZORPAY CREDENTIALS MISSING!');
  console.error('   Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Railway environment variables');
}

let razorpay = null;
try {
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID.trim(),
      key_secret: process.env.RAZORPAY_KEY_SECRET.trim()
    });
    console.log('✅ Razorpay initialized successfully');
  }
} catch (initError) {
  console.error('❌ Failed to initialize Razorpay:', initError.message);
}

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
// HEALTH CHECK FOR PAYMENT SYSTEM
// ==========================================

router.get('/health', (req, res) => {
  const health = {
    razorpay: {
      configured: !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
      keyId: process.env.RAZORPAY_KEY_ID ? `${process.env.RAZORPAY_KEY_ID.substring(0, 15)}...` : 'NOT SET',
      keySecret: process.env.RAZORPAY_KEY_SECRET ? 'SET (hidden)' : 'NOT SET',
      initialized: !!razorpay
    },
    plans: Object.keys(PLANS),
    timestamp: new Date().toISOString()
  };

  const isHealthy = health.razorpay.configured && health.razorpay.initialized;

  res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    health,
    message: isHealthy ? 'Payment system operational' : 'Payment system not properly configured'
  });
});

// ==========================================
// GET ALL PLANS
// ==========================================

router.get('/plans', (req, res) => {
  try {
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
  } catch (error) {
    console.error('❌ Get plans error:', error);
    res.status(500).json({ 
      error: 'Failed to get plans',
      message: error.message 
    });
  }
});

// ==========================================
// CREATE ORDER (Step 1: Before Payment)
// ==========================================

router.post('/create-order', authenticateToken, async (req, res) => {
  try {
    console.log('\n=== CREATE ORDER REQUEST ===');
    console.log('User ID:', req.user.id);
    console.log('Request body:', req.body);
    console.log('Razorpay initialized:', !!razorpay);

    // Check if Razorpay is initialized
    if (!razorpay) {
      console.error('❌ Razorpay not initialized');
      console.error('   Key ID set:', !!process.env.RAZORPAY_KEY_ID);
      console.error('   Secret set:', !!process.env.RAZORPAY_KEY_SECRET);
      
      return res.status(500).json({ 
        error: 'Payment system not configured',
        message: 'Razorpay is not properly initialized. Please contact support.',
        debug: {
          keyIdSet: !!process.env.RAZORPAY_KEY_ID,
          secretSet: !!process.env.RAZORPAY_KEY_SECRET,
          razorpayInit: !!razorpay
        }
      });
    }

    const { plan } = req.body;

    // Validate plan
    if (!plan) {
      return res.status(400).json({ 
        error: 'Missing plan',
        message: 'Please specify a plan to upgrade to.'
      });
    }

    if (!PLANS[plan]) {
      console.error('❌ Invalid plan:', plan);
      return res.status(400).json({ 
        error: 'Invalid plan',
        message: `Plan "${plan}" does not exist. Available plans: ${Object.keys(PLANS).join(', ')}`
      });
    }

    const planDetails = PLANS[plan];
    console.log('✅ Plan details:', planDetails);

    // Fetch user from database
    console.log('📥 Fetching user from database...');
    let user;
    try {
      user = await UserService.findById(req.user.id);
      if (!user) {
        console.error('❌ User not found:', req.user.id);
        return res.status(404).json({ 
          error: 'User not found',
          message: 'Your user account could not be found. Please log in again.'
        });
      }
      console.log('✅ User found:', user.email);
    } catch (dbError) {
      console.error('❌ Database error fetching user:', dbError);
      return res.status(500).json({ 
        error: 'Database error',
        message: 'Failed to fetch user information.',
        details: process.env.NODE_ENV === 'development' ? dbError.message : undefined
      });
    }

    // Create Razorpay order options
    // Receipt must be max 40 characters - use shortened format
    const shortUserId = user.id.split('-')[0]; // First segment of UUID
    const timestamp = Date.now().toString().slice(-8); // Last 8 digits
    const receipt = `rcpt_${timestamp}_${shortUserId}`; // Max 40 chars
    
    const options = {
      amount: planDetails.price * 100, // Amount in paise
      currency: planDetails.currency,
      receipt: receipt,
      notes: {
        userId: user.id,
        email: user.email,
        plan: plan,
        credits: planDetails.credits
      }
    };

    console.log('📤 Creating Razorpay order with options:', {
      ...options,
      notes: { ...options.notes }
    });

    // Create Razorpay order
    let razorpayOrder;
    try {
      razorpayOrder = await razorpay.orders.create(options);
      console.log('✅ Razorpay order created successfully:', {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        status: razorpayOrder.status
      });
    } catch (razorpayError) {
      console.error('❌ Razorpay API error:', {
        message: razorpayError.message,
        description: razorpayError.error?.description,
        code: razorpayError.statusCode,
        error: razorpayError.error
      });
      
      return res.status(500).json({ 
        error: 'Payment provider error',
        message: razorpayError.error?.description || razorpayError.message || 'Failed to create payment order with Razorpay',
        details: process.env.NODE_ENV === 'development' ? {
          razorpayError: razorpayError.message,
          statusCode: razorpayError.statusCode
        } : undefined
      });
    }

    // Create payment record in database
    console.log('💾 Creating payment record in database...');
    let payment;
    try {
      payment = await PaymentService.create({
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
      console.log('✅ Payment record created:', payment.id);
    } catch (dbError) {
      console.error('❌ Database error creating payment:', dbError);
      console.warn('⚠️ Continuing without payment record - Razorpay order created successfully');
      // Don't fail the request - the Razorpay order is created
    }

    // Log activity (non-critical)
    try {
      await ActivityLogService.log({
        userId: user.id,
        action: 'payment_initiated',
        resource: 'payment',
        resourceId: payment?.id,
        metadata: { plan, amount: planDetails.price }
      });
    } catch (logError) {
      console.warn('⚠️ Failed to log activity:', logError.message);
    }

    // Send successful response
    console.log('✅ Sending successful response');
    res.json({
      success: true,
      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency
      },
      plan: planDetails,
      razorpay_key: process.env.RAZORPAY_KEY_ID,
      payment_id: payment?.id
    });

  } catch (error) {
    console.error('❌ UNEXPECTED ERROR in create-order:');
    console.error('   Message:', error.message);
    console.error('   Stack:', error.stack);
    
    res.status(500).json({ 
      error: 'Failed to create order',
      message: error.message || 'An unexpected error occurred',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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

    console.log('\n=== VERIFY PAYMENT REQUEST ===');
    console.log('Order ID:', razorpay_order_id);
    console.log('Payment ID:', razorpay_payment_id);
    console.log('Plan:', plan);

    // Check Razorpay secret
    if (!process.env.RAZORPAY_KEY_SECRET) {
      console.error('❌ RAZORPAY_KEY_SECRET not set');
      return res.status(500).json({
        success: false,
        error: 'Payment verification not configured'
      });
    }

    // Verify signature
    const sign = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest('hex');

    if (razorpay_signature !== expectedSign) {
      console.error('❌ Invalid signature');
      console.error('   Expected:', expectedSign);
      console.error('   Received:', razorpay_signature);
      return res.status(400).json({
        success: false,
        error: 'Invalid payment signature'
      });
    }

    console.log('✅ Payment signature verified');

    // Payment verified! Update database
    const payment = await PaymentService.updateStatus(razorpay_order_id, {
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      status: 'captured'
    });

    console.log('✅ Payment status updated in database');

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

    console.log('✅ User tier upgraded to:', plan);

    // Create success notification
    try {
      await NotificationService.create(req.user.id, {
        title: 'Payment Successful! 🎉',
        message: `You've successfully upgraded to ${PLANS[plan].name}. ${PLANS[plan].credits} credits added to your account.`,
        type: 'success',
        actionUrl: '/dashboard',
        actionText: 'View Dashboard'
      });
    } catch (notifError) {
      console.warn('⚠️ Failed to create notification:', notifError.message);
    }

    // Update analytics (non-critical)
    try {
      await AnalyticsService.record(req.user.id, {
        revenueGenerated: { increment: payment.amount }
      });
    } catch (analyticsError) {
      console.warn('⚠️ Failed to update analytics:', analyticsError.message);
    }

    // Log activity (non-critical)
    try {
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
    } catch (logError) {
      console.warn('⚠️ Failed to log activity:', logError.message);
    }

    // Send confirmation email (non-critical)
    try {
      EmailService.sendPaymentSuccess(
        user.email, 
        user.name, 
        PLANS[plan].name, 
        `₹${(payment.amount / 100).toLocaleString('en-IN')}`
      );
    } catch (emailError) {
      console.warn('⚠️ Failed to send email:', emailError.message);
    }

    console.log('✅ Payment verification complete');

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
    console.error('❌ Verify payment error:', error);
    res.status(500).json({ 
      error: 'Payment verification failed',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ==========================================
// GET USER PAYMENTS
// ==========================================

router.get('/history', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;

    let payments = await PaymentService.getUserPayments(req.user.id);

    if (status) {
      payments = payments.filter(p => p.status === status);
    }

    payments = payments.slice(0, limit);

    const formatted = payments.map(payment => ({
      id: payment.id,
      orderId: payment.razorpayOrderId,
      paymentId: payment.razorpayPaymentId,
      amount: payment.amount / 100,
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
    res.status(500).json({ 
      error: 'Failed to get payment history',
      message: error.message
    });
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
        amount: payment.amount / 100
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
      totalRevenue: totalRevenue / 100,
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

    if (!secret) {
      console.error('❌ RAZORPAY_WEBHOOK_SECRET not set');
      return res.status(500).json({ error: 'Webhook not configured' });
    }

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error('❌ Invalid webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = req.body.event;
    const payload = req.body.payload;

    console.log(`🔥 Webhook received: ${event}`);

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
    const month = new Date(payment.paidAt).toISOString().slice(0, 7);
    byMonth[month] = (byMonth[month] || 0) + (payment.amount / 100);
  });

  return Object.entries(byMonth)
    .map(([month, revenue]) => ({ month, revenue }))
    .sort((a, b) => b.month.localeCompare(a.month));
}

async function handlePaymentCaptured(payload) {
  const payment = payload.payment.entity;
  console.log('✅ Payment captured:', payment.id);

  try {
    await PaymentService.updateByPaymentId(payment.id, {
      status: 'captured'
    });
  } catch (error) {
    console.error('Failed to update payment status:', error);
  }
}

async function handlePaymentFailed(payload) {
  const payment = payload.payment.entity;
  console.log('❌ Payment failed:', payment.id);

  try {
    await PaymentService.updateByPaymentId(payment.id, {
      status: 'failed'
    });

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
  } catch (error) {
    console.error('Failed to handle payment failure:', error);
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