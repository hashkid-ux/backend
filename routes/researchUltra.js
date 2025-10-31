// routes/researchUltra.js
// ULTRA Research Route - Uses All ULTRA Research Agents

const express = require('express');
const router = express.Router();
const MarketIntelligenceAgentUltra = require('../agents/research/marketIntelligenceUltra');
const CompetitorAnalysisAgentUltra = require('../agents/research/competitorAnalysisUltra');
const ReviewAnalysisAgentUltra = require('../agents/research/reviewAnalysisUltra');
const ResearchPaperAgentUltra = require('../agents/research/researchPaperAgentUltra');
const TrendAnalysisAgent = require('../agents/research/trendAnalysisAgent');

const checkTier = (req, res, next) => {
  req.userTier = req.headers['x-user-tier'] || 'free';
  next();
};

// POST /api/research-ultra/full - COMPLETE ULTRA RESEARCH
router.post('/full', checkTier, async (req, res) => {
  try {
    const { idea, targetCountry } = req.body;

    if (!idea || idea.length < 10) {
      return res.status(400).json({ 
        error: 'Please provide a detailed business idea (minimum 10 characters)' 
      });
    }

    console.log(`\n🚀 ULTRA RESEARCH STARTING...`);
    console.log(`💡 Idea: ${idea.substring(0, 100)}...`);
    console.log(`🌍 Target: ${targetCountry || 'Global'}`);
    console.log(`👤 Tier: ${req.userTier}`);

    const startTime = Date.now();
    const results = {};

    // Get date context
    const dateContext = getDateContext();
    console.log(`📅 Date Context: ${dateContext.season}, ${dateContext.marketTrend}`);

    // PARALLEL PHASE 1: Market + Trends
    console.log('\n📊 PHASE 1: Market Intelligence & Trends (PARALLEL)');
    
    const phase1Tasks = [];

    // Market Intelligence
    const marketAgent = new MarketIntelligenceAgentUltra(req.userTier);
    phase1Tasks.push(
      marketAgent.analyzeUltra(idea, targetCountry || 'Global', dateContext)
        .then(data => { results.market = data; return 'market'; })
    );

    // Trend Analysis
    const trendAgent = new TrendAnalysisAgent(req.userTier);
    phase1Tasks.push(
      trendAgent.analyzeTrends(idea, dateContext)
        .then(data => { results.trends = data; return 'trends'; })
    );

    const phase1Results = await Promise.allSettled(phase1Tasks);
    console.log(`✅ Phase 1 Complete: ${phase1Results.filter(r => r.status === 'fulfilled').length}/2 success`);

    // SEQUENTIAL PHASE 2: Deep Competitor Analysis
    if (results.market?._meta?.data_sources?.length > 0) {
      console.log('\n🔍 PHASE 2: Deep Competitor Analysis');
      
      const competitorAgent = new CompetitorAnalysisAgentUltra(req.userTier);
      const urlsToAnalyze = results.market._meta.data_sources.slice(
        0, 
        req.userTier === 'free' ? 3 : req.userTier === 'starter' ? 5 : 10
      );
      
      results.competitors = await competitorAgent.analyzeMultipleCompetitorsUltra(
        urlsToAnalyze,
        idea,
        results.trends
      );
      
      console.log(`✅ Competitors: ${results.competitors.total_analyzed} analyzed`);
    }

    // PHASE 3: Review & Paper Analysis (STARTER+)
    const phase3Tasks = [];

    if (req.userTier !== 'free' && results.competitors?.individual_analyses?.length > 0) {
      console.log('\n⭐ PHASE 3: Review Analysis');
      
      const reviewAgent = new ReviewAnalysisAgentUltra(req.userTier);
      const topCompetitors = results.competitors.individual_analyses
        .slice(0, 3)
        .map(c => c.name);
      
      phase3Tasks.push(
        reviewAgent.analyzeMultipleCompetitors(topCompetitors, idea)
          .then(data => { results.reviews = data; return 'reviews'; })
      );
    }

    // Research Papers (PREMIUM ONLY)
    if (req.userTier === 'premium') {
      console.log('📚 PHASE 3: Academic Research Papers');
      
      const paperAgent = new ResearchPaperAgentUltra(req.userTier);
      const keywords = extractKeywords(idea);
      
      phase3Tasks.push(
        paperAgent.findAndAnalyzeRelevantPapersUltra(idea, keywords)
          .then(data => { results.researchPapers = data; return 'papers'; })
      );
    }

    if (phase3Tasks.length > 0) {
      const phase3Results = await Promise.allSettled(phase3Tasks);
      console.log(`✅ Phase 3 Complete: ${phase3Results.filter(r => r.status === 'fulfilled').length}/${phase3Tasks.length} success`);
    }

    // PHASE 4: Strategic Analysis with AI
    console.log('\n🎯 PHASE 4: Strategic Intelligence');
    
    const strategicAnalysis = await generateStrategicAnalysis(idea, results, req.userTier);

    const timeTaken = ((Date.now() - startTime) / 1000).toFixed(1);

    // FINAL REPORT
    const finalReport = {
      success: true,
      tier: req.userTier,
      idea,
      targetCountry: targetCountry || 'Global',
      dateContext,
      
      // Core research
      market: results.market,
      competitors: results.competitors,
      reviews: results.reviews,
      trends: results.trends,
      researchPapers: results.researchPapers,
      
      // Strategic insights
      strategicAnalysis,
      
      // Executive summary
      executiveSummary: {
        viabilityScore: strategicAnalysis.viability_score,
        opportunityScore: strategicAnalysis.opportunity_score,
        competitionLevel: results.market?.competition_level,
        marketSize: results.market?.market_overview?.size,
        recommendation: strategicAnalysis.recommendation,
        keyInsights: strategicAnalysis.key_insights
      },
      
      // Statistics
      statistics: {
        competitorsAnalyzed: results.competitors?.total_analyzed || 0,
        reviewsScanned: results.reviews?.totalReviewsAnalyzed || 0,
        trendsIdentified: results.trends?.emerging_trends?.length || 0,
        papersAnalyzed: results.researchPapers?.papers_analyzed || 0,
        dataQuality: calculateDataQuality(results),
        timeTaken: `${timeTaken}s`,
        researchDepth: req.userTier === 'premium' ? 'comprehensive' : req.userTier === 'starter' ? 'detailed' : 'basic'
      },
      
      // Next steps
      nextSteps: generateNextSteps(strategicAnalysis, req.userTier),
      
      timestamp: new Date().toISOString()
    };

    console.log(`\n✅ ULTRA RESEARCH COMPLETE!`);
    console.log(`⏱️  Time: ${timeTaken}s`);
    console.log(`📊 Competitors: ${finalReport.statistics.competitorsAnalyzed}`);
    console.log(`⭐ Reviews: ${finalReport.statistics.reviewsScanned}`);
    console.log(`📈 Trends: ${finalReport.statistics.trendsIdentified}`);
    console.log(`📚 Papers: ${finalReport.statistics.papersAnalyzed}`);
    console.log(`🎯 Viability: ${strategicAnalysis.viability_score}/100`);

    res.json(finalReport);

  } catch (error) {
    console.error('❌ ULTRA Research error:', error);
    res.status(500).json({
      error: 'Research failed',
      message: error.message
    });
  }
});

// POST /api/research-ultra/market - Market Intelligence Only
router.post('/market', checkTier, async (req, res) => {
  try {
    const { idea, targetCountry } = req.body;

    if (!idea || idea.length < 10) {
      return res.status(400).json({ 
        error: 'Please provide a detailed business idea' 
      });
    }

    console.log(`📊 Market research for: ${idea.substring(0, 50)}...`);

    const agent = new MarketIntelligenceAgentUltra(req.userTier);
    const dateContext = getDateContext();
    const analysis = await agent.analyzeUltra(idea, targetCountry || 'Global', dateContext);

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

// POST /api/research-ultra/competitors - Competitor Analysis Only
router.post('/competitors', checkTier, async (req, res) => {
  try {
    const { competitorUrls, idea, trends } = req.body;

    if (!competitorUrls || !Array.isArray(competitorUrls)) {
      return res.status(400).json({
        error: 'Please provide an array of competitor URLs'
      });
    }

    const maxCompetitors = req.userTier === 'free' ? 3 : req.userTier === 'starter' ? 5 : 10;
    const urlsToAnalyze = competitorUrls.slice(0, maxCompetitors);

    console.log(`🔍 Analyzing ${urlsToAnalyze.length} competitors...`);

    const agent = new CompetitorAnalysisAgentUltra(req.userTier);
    const analysis = await agent.analyzeMultipleCompetitorsUltra(urlsToAnalyze, idea, trends);

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

// Helper Functions

function getDateContext() {
  const now = new Date();
  const month = now.getMonth();
  
  let season = 'spring';
  if (month >= 2 && month <= 4) season = 'spring';
  else if (month >= 5 && month <= 7) season = 'summer';
  else if (month >= 8 && month <= 10) season = 'fall';
  else season = 'winter';

  const marketTrend = month === 0 || month === 11 
    ? 'Holiday season - high consumer spending'
    : month >= 7 && month <= 8
    ? 'Back-to-school - education/productivity focus'
    : 'Standard market conditions';

  return {
    currentDate: now.toISOString(),
    season,
    month: now.toLocaleString('default', { month: 'long' }),
    quarter: Math.floor(month / 3) + 1,
    marketTrend,
    upcomingEvents: getUpcomingEvents(now)
  };
}

function getUpcomingEvents(date) {
  // Simplified - return major upcoming events
  return [
    { name: 'Holiday Season', date: new Date(date.getFullYear(), 11, 1), type: 'shopping' },
    { name: 'New Year', date: new Date(date.getFullYear() + 1, 0, 1), type: 'planning' }
  ].filter(e => e.date > date).slice(0, 3);
}

function extractKeywords(text) {
  const stopWords = ['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'];
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.includes(word));
  return [...new Set(words)].slice(0, 10);
}

async function generateStrategicAnalysis(idea, results, tier) {
  // Calculate scores
  const viabilityScore = calculateViabilityScore(results);
  const opportunityScore = calculateOpportunityScore(results);
  const competitiveIntensity = results.market?.competition_level || 'unknown';

  return {
    viability_score: viabilityScore,
    opportunity_score: opportunityScore,
    competitive_intensity: competitiveIntensity,
    
    recommendation: getRecommendation(viabilityScore, opportunityScore),
    
    key_insights: [
      `Market size: ${results.market?.market_overview?.size || 'Unknown'}`,
      `Competition: ${competitiveIntensity}`,
      `${results.competitors?.total_analyzed || 0} competitors analyzed`,
      `${results.reviews?.totalReviewsAnalyzed || 0} user reviews analyzed`,
      `${results.trends?.emerging_trends?.length || 0} emerging trends identified`
    ],
    
    strengths: identifyStrengths(results),
    weaknesses: identifyWeaknesses(results),
    opportunities: identifyOpportunities(results),
    threats: identifyThreats(results)
  };
}

function calculateViabilityScore(results) {
  let score = 50;
  
  if (results.market) {
    if (results.market.competition_level === 'low') score += 20;
    else if (results.market.competition_level === 'medium') score += 10;
    else if (results.market.competition_level === 'high') score -= 10;
  }
  
  if (results.market?.market_gaps?.length > 0) {
    score += Math.min(20, results.market.market_gaps.length * 5);
  }
  
  if (results.competitors?.deepInsights?.differentiation_opportunities?.length > 0) {
    score += 10;
  }
  
  return Math.max(0, Math.min(100, score));
}

function calculateOpportunityScore(results) {
  let score = 50;
  
  if (results.market?._meta?.data_sources?.length > 0) score += 10;
  if (results.competitors?.total_analyzed > 3) score += 10;
  if (results.reviews?.totalReviewsAnalyzed > 50) score += 10;
  if (results.trends?.emerging_trends?.length > 0) score += 10;
  if (results.researchPapers?.papers_analyzed > 0) score += 10;
  
  return Math.max(0, Math.min(100, score));
}

function getRecommendation(viabilityScore, opportunityScore) {
  const avgScore = (viabilityScore + opportunityScore) / 2;
  
  if (avgScore >= 75) return 'STRONG GO: Excellent opportunity with solid research backing';
  if (avgScore >= 60) return 'GO: Good opportunity, proceed with execution focus';
  if (avgScore >= 45) return 'PROCEED WITH CAUTION: Validate assumptions further';
  return 'RECONSIDER: High risk, consider pivoting or more research';
}

function identifyStrengths(results) {
  const strengths = [];
  
  if (results.market?.market_gaps?.length > 0) {
    strengths.push(`${results.market.market_gaps.length} market gaps identified`);
  }
  
  if (results.competitors?.deepInsights?.differentiation_opportunities?.length > 0) {
    strengths.push('Clear differentiation opportunities exist');
  }
  
  return strengths;
}

function identifyWeaknesses(results) {
  const weaknesses = [];
  
  if (results.market?.competition_level === 'very-high') {
    weaknesses.push('Extremely competitive market');
  }
  
  if (!results.market?._meta?.data_sources?.length) {
    weaknesses.push('Limited market data available');
  }
  
  return weaknesses;
}

function identifyOpportunities(results) {
  return results.competitors?.opportunities || [];
}

function identifyThreats(results) {
  return results.competitors?.threat_level?.breakdown || {};
}

function calculateDataQuality(results) {
  let score = 0;
  
  if (results.market?._meta?.data_sources?.length > 0) score += 25;
  if (results.competitors?.total_analyzed > 0) score += 25;
  if (results.reviews?.totalReviewsAnalyzed > 0) score += 25;
  if (results.trends?.emerging_trends?.length > 0) score += 25;
  
  return Math.min(100, score);
}

function generateNextSteps(analysis, tier) {
  const steps = [
    'Review complete research report',
    'Validate top 3 market gaps',
    'Define unique value proposition'
  ];
  
  if (analysis.viability_score >= 60) {
    steps.push('Begin MVP development');
    steps.push('Set up initial marketing');
  } else {
    steps.push('Conduct additional validation');
    steps.push('Consider pivoting strategy');
  }
  
  if (tier === 'free') {
    steps.push('Upgrade to unlock code generation');
  } else {
    steps.push('Generate production code with ULTRA agents');
  }
  
  return steps;
}

router.get('/status', (req, res) => {
  res.json({
    status: 'operational',
    version: 'ULTRA',
    capabilities: [
      'Parallel research processing',
      'Real competitor scraping',
      'Deep review analysis',
      'Academic paper analysis (Premium)',
      'Trend forecasting',
      'Strategic intelligence'
    ],
    endpoints: {
      full: '/api/research-ultra/full',
      market: '/api/research-ultra/market',
      competitors: '/api/research-ultra/competitors'
    }
  });
});

module.exports = router;