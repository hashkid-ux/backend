// backend/routes/paymentsWithDB.js
// Complete Payment System with Database Integration

const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { 
  PaymentService, 
  UserService,
  NotificationService,
  ActivityLogService 
} = require('../services/database');
const EmailService = require('../services/emailService');
const { authenticateToken } = require('./authWithDB');

// ==========================================
// INITIALIZE RAZORPAY
// ==========================================
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_xxxxx',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'your_secret'
});

// ==========================================
// PRICING PLANS (in INR)
// ==========================================
const PLANS = {
  starter: {
    name: 'Starter',
    price: 2499, // ₹2,499/month (~$30)
    currency: 'INR',
    credits: 100,
    features: [
      'Full code generation',
      'QA testing',
      '100 builds/month',
      'Email support'
    ],
    interval: 'monthly'
  },
  premium: {
    name: 'Premium',
    price: 8299, // ₹8,299/month (~$100)
    currency: 'INR',
    credits: 1000,
    features: [
      'Unlimited builds',
      'Priority support',
      'Live monitoring',
      'API access',
      'Advanced analytics'
    ],
    interval: 'monthly'
  }
};

// ==========================================
// GET ALL PRICING PLANS
// ==========================================
router.get('/plans', (req, res) => {
  try {
    const plansWithPricing = Object.entries(PLANS).map(([key, plan]) => ({
      id: key,
      ...plan,
      price_formatted: `₹${plan.price.toLocaleString('en-IN')}`,
      price_usd: `$${(plan.price / 83).toFixed(0)}`
    }));

    res.json({
      success: true,
      plans: plansWithPricing,
      currency: 'INR',
      note: 'Prices in Indian Rupees'
    });

  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({ error: 'Failed to get plans' });
  }
});

// ==========================================
// CREATE RAZORPAY ORDER
// ==========================================
router.post('/create-order', authenticateToken, async (req, res) => {
  try {
    const { plan } = req.body;

    // Validation
    if (!PLANS[plan]) {
      return res.status(400).json({ error: 'Invalid plan selected' });
    }

    const planDetails = PLANS[plan];
    const user = await UserService.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create Razorpay order
    const options = {
      amount: planDetails.price * 100, // Amount in paise
      currency: planDetails.currency,
      receipt: `receipt_${Date.now()}_${user.id}`,
      notes: {
        plan: plan,
        credits: planDetails.credits,
        userId: user.id,
        userEmail: user.email
      }
    };

    const razorpayOrder = await razorpay.orders.create(options);

    // Save payment initiation in database
    const payment = await PaymentService.create({
      userId: user.id,
      razorpayOrderId: razorpayOrder.id,
      amount: planDetails.price,
      currency: planDetails.currency,
      plan: plan,
      status: 'pending'
    });

    // Log activity
    await ActivityLogService.log({
      userId: user.id,
      action: 'payment_initiated',
      metadata: { plan, amount: planDetails.price }
    });

    res.json({
      success: true,
      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        receipt: razorpayOrder.receipt
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
// VERIFY PAYMENT
// ==========================================
router.post('/verify', authenticateToken, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan
    } = req.body;

    // Validation
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ 
        error: 'Missing payment verification data' 
      });
    }

    // Verify signature
    const sign = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'your_secret')
      .update(sign.toString())
      .digest('hex');

    const isValid = razorpay_signature === expectedSign;

    if (!isValid) {
      // Mark payment as failed
      await PaymentService.updateByOrderId(razorpay_order_id, {
        status: 'failed',
        failureReason: 'Invalid signature'
      });

      return res.status(400).json({
        success: false,
        error: 'Invalid payment signature'
      });
    }

    // Payment is verified! Update database
    const payment = await PaymentService.updateByOrderId(razorpay_order_id, {
      razorpayPaymentId: razorpay_payment_id,
      status: 'success',
      paidAt: new Date()
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment record not found' });
    }

    // Upgrade user tier
    const planDetails = PLANS[plan];
    const subscriptionEnd = new Date();
    subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1); // 1 month

    const user = await UserService.upgradeTier(req.user.id, plan, {
      subscriptionId: razorpay_payment_id,
      subscriptionStatus: 'active',
      subscriptionStart: new Date(),
      subscriptionEnd
    });

    // Create success notification
    await NotificationService.create(req.user.id, {
      title: 'Payment Successful! 🎉',
      message: `You've been upgraded to ${planDetails.name} tier with ${planDetails.credits} credits`,
      type: 'success',
      actionUrl: '/dashboard',
      actionText: 'View Dashboard'
    });

    // Log activity
    await ActivityLogService.log({
      userId: req.user.id,
      action: 'payment_success',
      metadata: { 
        plan, 
        amount: payment.amount,
        paymentId: razorpay_payment_id 
      }
    });

    // Send confirmation email
    EmailService.sendPaymentSuccess(
      user.email,
      user.name,
      planDetails.name,
      planDetails.price,
      planDetails.credits,
      subscriptionEnd
    );

    res.json({
      success: true,
      message: 'Payment verified and account upgraded',
      payment: {
        id: payment.id,
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id,
        amount: payment.amount,
        status: payment.status
      },
      user: {
        tier: user.tier,
        credits: user.credits,
        subscription_end: user.subscriptionEnd
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
// GET USER PAYMENT HISTORY
// ==========================================
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const payments = await PaymentService.getUserPayments(req.user.id, limit);

    res.json({
      success: true,
      payments,
      total: payments.length
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
      payment
    });

  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({ error: 'Failed to get payment' });
  }
});

// ==========================================
// RAZORPAY WEBHOOK
// ==========================================
router.post('/webhook', async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    
    if (!secret) {
      console.error('RAZORPAY_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: 'Webhook not configured' });
    }

    const signature = req.headers['x-razorpay-signature'];

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error('Invalid webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = req.body.event;
    const payload = req.body.payload;

    console.log(`📥 Webhook received: ${event}`);

    // Handle different webhook events
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
// CREATE SUBSCRIPTION
// ==========================================
router.post('/create-subscription', authenticateToken, async (req, res) => {
  try {
    const { plan } = req.body;

    if (!PLANS[plan]) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const planDetails = PLANS[plan];

    // Check if plan ID is configured
    const planId = process.env[`RAZORPAY_PLAN_${plan.toUpperCase()}`];
    
    if (!planId) {
      return res.status(500).json({ 
        error: 'Subscription plan not configured on Razorpay' 
      });
    }

    // Create Razorpay subscription
    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      customer_notify: 1,
      total_count: 12, // 12 months
      quantity: 1,
      notes: {
        plan: plan,
        userId: req.user.id
      }
    });

    res.json({
      success: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        plan_id: subscription.plan_id
      }
    });

  } catch (error) {
    console.error('Create subscription error:', error);
    res.status(500).json({ 
      error: 'Failed to create subscription',
      message: error.message 
    });
  }
});

// ==========================================
// CANCEL SUBSCRIPTION
// ==========================================
router.post('/cancel-subscription', authenticateToken, async (req, res) => {
  try {
    const user = await UserService.findById(req.user.id);

    if (!user.subscriptionId) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    // Cancel on Razorpay
    await razorpay.subscriptions.cancel(user.subscriptionId);

    // Update user
    await UserService.update(user.id, {
      subscriptionStatus: 'cancelled'
    });

    // Create notification
    await NotificationService.create(user.id, {
      title: 'Subscription Cancelled',
      message: 'Your subscription has been cancelled. You can continue using your current credits until the end of the billing period.',
      type: 'warning'
    });

    // Log activity
    await ActivityLogService.log({
      userId: user.id,
      action: 'subscription_cancelled',
      metadata: { subscriptionId: user.subscriptionId }
    });

    res.json({
      success: true,
      message: 'Subscription cancelled successfully'
    });

  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ 
      error: 'Failed to cancel subscription',
      message: error.message 
    });
  }
});

// ==========================================
// WEBHOOK HANDLERS
// ==========================================

async function handlePaymentCaptured(payload) {
  try {
    const paymentEntity = payload.payment.entity;
    const orderId = paymentEntity.order_id;

    console.log(`✅ Payment captured: ${paymentEntity.id}`);

    await PaymentService.updateByOrderId(orderId, {
      razorpayPaymentId: paymentEntity.id,
      status: 'success',
      paidAt: new Date()
    });

  } catch (error) {
    console.error('Handle payment captured error:', error);
  }
}

async function handlePaymentFailed(payload) {
  try {
    const paymentEntity = payload.payment.entity;
    const orderId = paymentEntity.order_id;

    console.log(`❌ Payment failed: ${paymentEntity.id}`);

    const payment = await PaymentService.updateByOrderId(orderId, {
      status: 'failed',
      failureReason: paymentEntity.error_description || 'Payment failed'
    });

    if (payment) {
      // Notify user
      await NotificationService.create(payment.userId, {
        title: 'Payment Failed',
        message: 'Your payment could not be processed. Please try again.',
        type: 'error',
        actionUrl: '/pricing',
        actionText: 'Retry Payment'
      });
    }

  } catch (error) {
    console.error('Handle payment failed error:', error);
  }
}

async function handleSubscriptionCharged(payload) {
  try {
    const subscriptionEntity = payload.subscription.entity;
    
    console.log(`💳 Subscription charged: ${subscriptionEntity.id}`);

    // Renew user credits
    // Find user by subscription ID and add credits
    // This is a placeholder - implement based on your needs

  } catch (error) {
    console.error('Handle subscription charged error:', error);
  }
}

async function handleSubscriptionCancelled(payload) {
  try {
    const subscriptionEntity = payload.subscription.entity;
    
    console.log(`🚫 Subscription cancelled: ${subscriptionEntity.id}`);

    // Update user subscription status
    // This is a placeholder - implement based on your needs

  } catch (error) {
    console.error('Handle subscription cancelled error:', error);
  }
}

module.exports = router;