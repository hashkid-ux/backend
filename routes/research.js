const express = require('express');
const router = express.Router();
const MarketIntelligenceAgent = require('../agents/research/marketIntelligence');
const CompetitorAnalysisAgent = require('../agents/research/competitorAnalysis');
const ReviewAnalysisAgent = require('../agents/research/reviewAnalysis');

// Middleware to check user tier
const checkTier = (req, res, next) => {
  req.userTier = req.headers['x-user-tier'] || 'free';
  next();
};

// POST /api/research/market - Full market intelligence
router.post('/market', checkTier, async (req, res) => {
  try {
    const { idea, targetCountry } = req.body;

    if (!idea || idea.length < 10) {
      return res.status(400).json({ 
        error: 'Please provide a detailed business idea (minimum 10 characters)' 
      });
    }

    console.log(`📊 Market research request for: ${idea.substring(0, 50)}...`);
    console.log(`🌍 Target market: ${targetCountry || 'Global'}`);
    console.log(`👤 User tier: ${req.userTier}`);

    // Initialize Market Intelligence Agent
    const agent = new MarketIntelligenceAgent(req.userTier);

    // Run analysis
    const analysis = await agent.analyze(idea, targetCountry || 'Global');

    res.json({
      success: true,
      tier: req.userTier,
      analysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Market research error:', error);
    res.status(500).json({
      error: 'Market research failed',
      message: error.message
    });
  }
});

// POST /api/research/competitors - Deep competitor analysis
router.post('/competitors', checkTier, async (req, res) => {
  try {
    const { competitorUrls, idea } = req.body;

    if (!competitorUrls || !Array.isArray(competitorUrls) || competitorUrls.length === 0) {
      return res.status(400).json({
        error: 'Please provide an array of competitor URLs'
      });
    }

    // Limit based on tier
    const maxCompetitors = req.userTier === 'free' ? 3 : req.userTier === 'starter' ? 5 : 10;
    const urlsToAnalyze = competitorUrls.slice(0, maxCompetitors);

    console.log(`🔍 Analyzing ${urlsToAnalyze.length} competitors...`);

    const agent = new CompetitorAnalysisAgent(req.userTier);
    const analysis = await agent.analyzeMultipleCompetitors(urlsToAnalyze, idea);

    res.json({
      success: true,
      tier: req.userTier,
      analysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Competitor analysis error:', error);
    res.status(500).json({
      error: 'Competitor analysis failed',
      message: error.message
    });
  }
});

// POST /api/research/reviews - Analyze competitor reviews
router.post('/reviews', checkTier, async (req, res) => {
  try {
    const { competitorName, reviewUrls } = req.body;

    if (!competitorName) {
      return res.status(400).json({
        error: 'Please provide competitor name'
      });
    }

    if (req.userTier === 'free') {
      return res.status(403).json({
        error: 'Review analysis requires Starter tier or higher',
        upgrade_url: '/pricing'
      });
    }

    console.log(`⭐ Review analysis for: ${competitorName}`);

    const agent = new ReviewAnalysisAgent(req.userTier);
    const analysis = await agent.analyzeReviews(competitorName, reviewUrls || []);

    res.json({
      success: true,
      tier: req.userTier,
      analysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Review analysis error:', error);
    res.status(500).json({
      error: 'Review analysis failed',
      message: error.message
    });
  }
});

// POST /api/research/full - Complete research package (all agents)
router.post('/full', checkTier, async (req, res) => {
  try {
    const { idea, targetCountry } = req.body;

    if (!idea || idea.length < 10) {
      return res.status(400).json({ 
        error: 'Please provide a detailed business idea' 
      });
    }

    console.log(`🚀 Full research package starting...`);

    // Step 1: Market Intelligence
    console.log('📊 Step 1: Market Intelligence...');
    const marketAgent = new MarketIntelligenceAgent(req.userTier);
    const marketAnalysis = await marketAgent.analyze(idea, targetCountry || 'Global');

    // Step 2: Competitor Analysis (use top competitors from market analysis)
    console.log('🔍 Step 2: Competitor Analysis...');
    const competitorUrls = marketAnalysis._meta?.data_sources || [];
    let competitorAnalysis = null;
    
    if (competitorUrls.length > 0 && req.userTier !== 'free') {
      const competitorAgent = new CompetitorAnalysisAgent(req.userTier);
      competitorAnalysis = await competitorAgent.analyzeMultipleCompetitors(
        competitorUrls.slice(0, 3),
        idea
      );
    }

    // Step 3: Review Analysis (premium only)
    console.log('⭐ Step 3: Review Analysis...');
    let reviewAnalysis = null;
    
    if (req.userTier === 'premium' && marketAnalysis.key_competitors) {
      const reviewAgent = new ReviewAnalysisAgent(req.userTier);
      const topCompetitor = marketAnalysis.key_competitors[0]?.name;
      if (topCompetitor) {
        reviewAnalysis = await reviewAgent.analyzeReviews(topCompetitor);
      }
    }

    // Combine all results
    const fullReport = {
      market_intelligence: marketAnalysis,
      competitor_analysis: competitorAnalysis,
      review_analysis: reviewAnalysis,
      executive_summary: {
        opportunity_score: this.calculateOpportunityScore(marketAnalysis),
        recommendation: this.generateRecommendation(marketAnalysis, competitorAnalysis),
        next_steps: this.generateNextSteps(req.userTier)
      }
    };

    res.json({
      success: true,
      tier: req.userTier,
      report: fullReport,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Full research error:', error);
    res.status(500).json({
      error: 'Research failed',
      message: error.message
    });
  }
});

// Helper functions
router.calculateOpportunityScore = (marketAnalysis) => {
  let score = 50; // Base score

  // Adjust based on competition
  if (marketAnalysis.competition_level === 'low') score += 20;
  else if (marketAnalysis.competition_level === 'medium') score += 10;
  else if (marketAnalysis.competition_level === 'high') score -= 10;
  else if (marketAnalysis.competition_level === 'very-high') score -= 20;

  // Adjust based on market maturity
  if (marketAnalysis.market_overview?.maturity === 'emerging') score += 15;
  else if (marketAnalysis.market_overview?.maturity === 'growing') score += 10;
  else if (marketAnalysis.market_overview?.maturity === 'declining') score -= 20;

  // Adjust based on market gaps
  if (marketAnalysis.market_gaps?.length > 0) {
    score += Math.min(marketAnalysis.market_gaps.length * 5, 20);
  }

  return Math.max(0, Math.min(100, score));
};

router.generateRecommendation = (marketAnalysis, competitorAnalysis) => {
  const oppScore = router.calculateOpportunityScore(marketAnalysis);

  if (oppScore >= 75) {
    return 'STRONG GO: Excellent market opportunity with manageable competition.';
  } else if (oppScore >= 60) {
    return 'GO: Good opportunity if executed with clear differentiation.';
  } else if (oppScore >= 40) {
    return 'PROCEED WITH CAUTION: Competitive market, requires unique value proposition.';
  } else {
    return 'RECONSIDER: High risk market. Consider pivoting to a different opportunity.';
  }
};

router.generateNextSteps = (tier) => {
  const steps = [
    'Review market analysis and validate assumptions',
    'Define your unique value proposition',
    'Create detailed feature roadmap'
  ];

  if (tier === 'free') {
    steps.push('Upgrade to Starter to generate code and deploy');
  } else {
    steps.push('Generate code with our AI agents');
    steps.push('Deploy and start user testing');
  }

  return steps;
};

// GET /api/research/status
router.get('/status', (req, res) => {
  res.json({
    status: 'operational',
    endpoints: {
      market: '/api/research/market',
      competitors: '/api/research/competitors',
      reviews: '/api/research/reviews',
      full: '/api/research/full'
    },
    agents: {
      market_intelligence: 'active',
      competitor_analysis: 'active',
      review_analysis: 'active'
    }
  });
});

module.exports = router;