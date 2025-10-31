const express = require('express');
const router = express.Router();
const StrategyAgent = require('../agents/strategyAgentUltra');

// Middleware to check user tier (we'll implement auth later)
const checkTier = (req, res, next) => {
  // For now, default to free tier
  // TODO: Implement JWT authentication and tier checking
  req.userTier = req.headers['x-user-tier'] || 'free';
  next();
};

// POST /api/validate/idea
router.post('/idea', checkTier, async (req, res) => {
  try {
    const { idea, targetMarket, budget } = req.body;

    // Validation
    if (!idea || idea.length < 10) {
      return res.status(400).json({ 
        error: 'Please provide a detailed business idea (minimum 10 characters)' 
      });
    }

    if (!targetMarket) {
      return res.status(400).json({ 
        error: 'Please specify your target market' 
      });
    }

    // Initialize Strategy Agent with user's tier
    const agent = new StrategyAgent(req.userTier);

    console.log(`📊 Validating idea for ${req.userTier} tier user...`);

    // Run validation
    const validation = await agent.validateIdeaUltra(idea, targetMarket, budget || 'Not specified', null);

    // Track usage (TODO: implement proper usage tracking)
    console.log(`✅ Validation completed for: ${idea.substring(0, 50)}...`);

    res.json({
      success: true,
      tier: req.userTier,
      validation,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Validation Error:', error);
    res.status(500).json({
      error: 'Failed to validate idea',
      message: error.message
    });
  }
});

// POST /api/validate/business-plan (Premium only)
router.post('/business-plan', checkTier, async (req, res) => {
  try {
    if (req.userTier === 'free') {
      return res.status(403).json({
        error: 'Business plan generation requires Starter tier or higher',
        upgrade_url: '/pricing'
      });
    }

    const { validation, idea } = req.body;

    if (!validation || !idea) {
      return res.status(400).json({
        error: 'Please provide validation data and idea description'
      });
    }

    const agent = new StrategyAgent(req.userTier);
    const businessPlan = await agent.generateBusinessPlan(validation, idea);

    res.json({
      success: true,
      businessPlan,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Business Plan Error:', error);
    res.status(500).json({
      error: 'Failed to generate business plan',
      message: error.message
    });
  }
});

// GET /api/validate/status (check API health)
router.get('/status', (req, res) => {
  res.json({
    status: 'operational',
    endpoints: {
      validate_idea: '/api/validate/idea',
      business_plan: '/api/validate/business-plan'
    }
  });
});

module.exports = router;