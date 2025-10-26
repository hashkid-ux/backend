const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');

// Initialize Razorpay (Get keys from https://dashboard.razorpay.com/)
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_xxxxx',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'your_secret'
});

// Pricing plans (in INR - Indian Rupees)
const PLANS = {
  starter: {
    name: 'Starter',
    price: 2499, // ₹2,499/month (~$30)
    currency: 'INR',
    credits: 100,
    features: ['Full code generation', 'QA testing', '100 builds/month']
  },
  premium: {
    name: 'Premium',
    price: 8299, // ₹8,299/month (~$100)
    currency: 'INR',
    credits: 1000,
    features: ['Unlimited builds', 'Priority support', 'Live monitoring', 'API access']
  }
};

// POST /api/payments/create-order - Create Razorpay order
router.post('/create-order', async (req, res) => {
  try {
    const { plan } = req.body;

    if (!PLANS[plan]) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const planDetails = PLANS[plan];

    // Create Razorpay order
    const options = {
      amount: planDetails.price * 100, // Amount in paise
      currency: planDetails.currency,
      receipt: `receipt_${Date.now()}`,
      notes: {
        plan: plan,
        credits: planDetails.credits
      }
    };

    const order = await razorpay.orders.create(options);

    res.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency
      },
      plan: planDetails,
      razorpay_key: process.env.RAZORPAY_KEY_ID
    });

  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// POST /api/payments/verify - Verify payment
router.post('/verify', async (req, res) => {
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
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'your_secret')
      .update(sign.toString())
      .digest('hex');

    if (razorpay_signature === expectedSign) {
      // Payment is verified!
      
      // TODO: Update user tier in database
      // TODO: Send confirmation email
      // TODO: Generate invoice

      res.json({
        success: true,
        message: 'Payment verified successfully',
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id,
        plan: plan
      });

    } else {
      res.status(400).json({
        success: false,
        error: 'Invalid signature'
      });
    }

  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

// GET /api/payments/plans - Get all plans
router.get('/plans', (req, res) => {
  const plansWithPricing = Object.entries(PLANS).map(([key, plan]) => ({
    id: key,
    ...plan,
    price_formatted: `₹${plan.price.toLocaleString('en-IN')}`,
    price_usd: `$${(plan.price / 83).toFixed(0)}`
  }));

  res.json({
    plans: plansWithPricing,
    currency: 'INR',
    note: 'Prices in Indian Rupees'
  });
});

// POST /api/payments/webhook - Razorpay webhook
router.post('/webhook', async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (signature === expectedSignature) {
      const event = req.body.event;
      const payload = req.body.payload;

      // Handle different events
      switch (event) {
        case 'payment.captured':
          console.log('✅ Payment captured:', payload.payment.entity.id);
          // Update user subscription
          break;

        case 'payment.failed':
          console.log('❌ Payment failed:', payload.payment.entity.id);
          // Send failure notification
          break;

        case 'subscription.charged':
          console.log('💳 Subscription charged');
          // Renew user credits
          break;

        default:
          console.log('Webhook event:', event);
      }

      res.json({ status: 'ok' });
    } else {
      res.status(400).json({ error: 'Invalid signature' });
    }

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// POST /api/payments/create-subscription - Create subscription
router.post('/create-subscription', async (req, res) => {
  try {
    const { plan } = req.body;

    if (!PLANS[plan]) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const planDetails = PLANS[plan];

    // Create Razorpay subscription
    const subscription = await razorpay.subscriptions.create({
      plan_id: process.env[`RAZORPAY_PLAN_${plan.toUpperCase()}`],
      customer_notify: 1,
      total_count: 12, // 12 months
      quantity: 1,
      notes: {
        plan: plan
      }
    });

    res.json({
      success: true,
      subscription: {
        id: subscription.id,
        status: subscription.status
      }
    });

  } catch (error) {
    console.error('Create subscription error:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

module.exports = router;