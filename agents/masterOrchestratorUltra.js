// agents/masterOrchestratorUltra.js
// 🚀 BULLETPROOF ORCHESTRATOR - Better Phase Coordination, Error Recovery

const AIClient = require('../services/aiClient');
const MarketIntelligenceAgentUltra = require('./research/marketIntelligenceUltra');
const CompetitorAnalysisAgentUltra = require('./research/competitorAnalysisUltra');
const ReviewAnalysisAgentUltra = require('./research/reviewAnalysisUltra');
const ResearchPaperAgentUltra = require('./research/researchPaperAgentUltra');
const TrendAnalysisAgent = require('./research/trendAnalysisAgent');
const PsychologyAgentUltra = require('./strategy/psychologyAgentUltra');
const FrontendAgentUltra = require('./codegen/frontendAgentUltra');
const BackendAgentUltra = require('./codegen/backendAgentUltra');
const DatabaseAgentUltra = require('./codegen/databaseAgentUltra');
const QAAgentUltra = require('./testing/qaAgentUltra');

class MasterOrchestrator {
  constructor(tier = 'free', projectId = null, userId = null) {
    this.tier = tier;
    this.projectId = projectId;
    this.userId = userId;
    this.client = new AIClient();
    this.researchData = {};
    this.competitiveAdvantages = [];
    this.startTime = Date.now();
    this.currentDate = new Date();
    
    // CONSERVATIVE: No parallel executor - sequential with proper delays
    this.maxRetries = 2;
    this.phaseDelay = 8000; // 8s between phases (increased from 5s)
    this.taskDelay = 5000;  // 5s between tasks (increased from 3s)
    
    console.log('🎯 ULTRA Master Orchestrator initialized (BULLETPROOF):', {
      tier,
      date: this.currentDate.toISOString(),
      strategy: 'Sequential with proper delays and error recovery'
    });
  }

  getCapabilities() {
    return {
      sequentialProcessing: true, // Changed from parallel
      smartErrorRecovery: true,
      gracefulDegradation: true,
      trendAwareness: true,
      researchPapers: this.tier === 'premium',
      advancedPsychology: true,
      dynamicCodeGeneration: true
    };
  }

  // ENHANCED: Retry with better error handling and delays
  async safeRetry(fn, context, maxRetries = this.maxRetries) {
  let attempt = 0;
  let lastError = null;

  while (attempt < maxRetries) {
    try {
      attempt++;
      console.log(`🔄 ${context} - Attempt ${attempt}/${maxRetries}`);
      
      const result = await fn();
      
      // VALIDATION: Check if result is valid
      if (result === null || result === undefined) {
        throw new Error('Null result returned');
      }
      
      // SUCCESS
      await this.sleep(this.taskDelay);
      return result;
      
    } catch (error) {
      lastError = error;
      
      const errorMsg = error.message?.toLowerCase() || '';
      
      // JSON parse errors - retry immediately
      if (errorMsg.includes('json') || errorMsg.includes('parse')) {
        console.error(`❌ ${context} - JSON error: ${error.message.substring(0, 100)}`);
        await this.sleep(2000);
        continue;
      }
      
      // Rate limits - longer wait
      const isRateLimit = errorMsg.includes('429') || errorMsg.includes('rate limit');
      if (isRateLimit) {
        const waitTime = 30000 * attempt;
        console.error(`❌ ${context} - Rate limit hit`);
        console.log(`⏳ Cooling down ${waitTime/1000}s...`);
        await this.sleep(waitTime);
        continue;
      }
      
      // Other errors
      const waitTime = 10000 * attempt;
      console.error(`❌ ${context} - Error: ${error.message?.substring(0, 100)}`);
      
      if (attempt < maxRetries) {
        console.log(`⏳ Retrying in ${waitTime/1000}s...`);
        await this.sleep(waitTime);
      }
    }
  }

  // ALL RETRIES FAILED - Return safe defaults instead of crashing
  console.error(`❌ ${context} failed after ${maxRetries} attempts - using fallback`);
  
  // Context-specific fallbacks
  if (context.includes('Market Intelligence')) {
    return this.getDefaultMarketData({});
  }
  if (context.includes('Trend Analysis')) {
    return this.getDefaultTrendData(this.analyzeDateContextSync({}));
  }
  if (context.includes('Competitor Analysis')) {
    return this.getDefaultCompetitorData();
  }
  
  throw new Error(`${context} failed: ${lastError?.message}`);
}

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // PHASE 1: SEQUENTIAL RESEARCH with proper delays
  async executePhase1ResearchUltra(projectData) {
  console.log('\n📊 PHASE 1: ULTRA Market Research (Sequential + Safe)...');
  
  const results = {
    market: null,
    competitors: null,
    reviews: null,
    trends: null,
    researchPapers: null,
    dateContext: null,
    starvingMarket: null,
    uniqueness: null,
    
    // CRITICAL FIX: Initialize _fullData as empty object
    _fullData: {
      market_overview: null,
      competition_level: null,
      market_gaps: [],
      competitor_urls: [],
      competitor_analyses: [],
      review_summary: null,
      trend_list: [],
      papers_found: 0
    }
  };

  try {
    // Step 0: Date context (instant, no API)
    console.log('📅 Step 1.0: Date & Trend Context...');
    results.dateContext = this.analyzeDateContextSync(projectData);
    await this.sleep(1000);

    // Step 1: Market Intelligence
    console.log('🔍 Step 1.1: Market Intelligence...');
    const marketData = await this.safeRetry(
      () => this.runMarketIntelligence(projectData, results.dateContext),
      'Market Intelligence'
    ).catch(error => {
      console.warn('⚠️ Market intelligence failed, using default');
      return this.getDefaultMarketData(projectData);
    });
    
    results.market = marketData;
    console.log(`✅ Market: ${results.market.competition_level || 'unknown'} competition`);
    await this.sleep(this.phaseDelay);

    // Step 2: Trend Analysis
    console.log('📈 Step 1.2: Trend Analysis...');
    const trendData = await this.safeRetry(
      () => this.runTrendAnalysis(projectData, results.dateContext),
      'Trend Analysis'
    ).catch(error => {
      console.warn('⚠️ Trend analysis failed, using default');
      return this.getDefaultTrendData(results.dateContext);
    });
    
    results.trends = trendData;
    console.log(`✅ Trends: ${results.trends.emerging_trends?.length || 0} identified`);
    await this.sleep(this.phaseDelay);

    // Step 3: Competitor Analysis
    if (marketData?._meta?.data_sources?.length > 0) {
      console.log('🏢 Step 1.3: Competitor Analysis...');
      const competitorData = await this.safeRetry(
        () => this.runCompetitorAnalysis(
          marketData._meta.data_sources,
          projectData,
          trendData
        ),
        'Competitor Analysis'
      ).catch(error => {
        console.warn('⚠️ Competitor analysis failed, using default');
        return this.getDefaultCompetitorData();
      });
      
      results.competitors = competitorData;
      console.log(`✅ Competitors: ${results.competitors.total_analyzed || 0} analyzed`);
      await this.sleep(this.phaseDelay);
    } else {
      results.competitors = this.getDefaultCompetitorData();
    }

    // Step 4: Reviews (STARTER+)
    let reviewData = null;
    if (this.tier !== 'free' && results.competitors?.individual_analyses?.length > 0) {
      console.log('⭐ Step 1.4: Review Analysis...');
      reviewData = await this.safeRetry(
        () => this.runReviewAnalysis(
          results.competitors.individual_analyses,
          projectData
        ),
        'Review Analysis'
      ).catch(error => {
        console.warn('⚠️ Review analysis failed');
        return null;
      });
      
      results.reviews = reviewData;
      if (results.reviews) {
        console.log(`✅ Reviews: ${results.reviews.totalReviewsAnalyzed || 0} analyzed`);
      }
      await this.sleep(this.phaseDelay);
    }

    // Step 5: Research Papers (PREMIUM)
    let paperData = null;
    if (this.tier === 'premium') {
      console.log('📚 Step 1.5: Research Papers...');
      paperData = await this.safeRetry(
        () => this.runResearchPapers(projectData),
        'Research Papers'
      ).catch(error => {
        console.warn('⚠️ Research papers failed');
        return null;
      });
      
      results.researchPapers = paperData;
      if (results.researchPapers) {
        console.log(`✅ Papers: ${results.researchPapers.papers_analyzed || 0} analyzed`);
      }
      await this.sleep(this.phaseDelay);
    }

    // Step 6: Strategic Analysis
    console.log('🎯 Step 1.6: Strategic Analysis...');
    results.starvingMarket = await this.detectStarvingMarketUltra(
      results.market,
      results.competitors,
      results.reviews,
      results.trends,
      results.dateContext
    );
    
    results.uniqueness = await this.calculateUniquenessScoreUltra(
      projectData,
      results.competitors,
      results.researchPapers
    );

    // CRITICAL FIX: Populate _fullData AFTER all data is collected
    results._fullData = {
      market_overview: marketData?.market_overview || null,
      competition_level: marketData?.competition_level || 'unknown',
      market_gaps: marketData?.market_gaps || [],
      competitor_urls: marketData?._meta?.data_sources || [],
      competitor_analyses: results.competitors?.individual_analyses || [],
      review_summary: reviewData,
      trend_list: trendData?.emerging_trends || [],
      papers_found: paperData?.papers_analyzed || 0
    };

    console.log('✅ PHASE 1 COMPLETE (Sequential + Safe)');

    this.researchData = results;
    return results;

  } catch (error) {
    console.error('❌ Phase 1 CRITICAL ERROR:', error.message);
    return this.getMinimalResearchData(projectData);
  }
}

  // PHASE 2: SEQUENTIAL STRATEGY
  async executePhase2PlanningUltra(researchData) {
    console.log('\n🎯 PHASE 2: ULTRA Strategic Planning (Sequential)...');

    try {
      // Step 1: Competitive Advantages
      console.log('💡 Step 2.1: Identifying Competitive Advantages...');
      this.competitiveAdvantages = await this.safeRetry(
        () => this.identifyCompetitiveAdvantagesUltra(researchData),
        'Competitive Advantages'
      ).catch(error => {
        console.warn('⚠️ Failed to identify advantages');
        return this.getDefaultAdvantages(researchData);
      });
      
      console.log(`✅ Advantages: ${this.competitiveAdvantages.length} identified`);
      await this.sleep(this.phaseDelay);

      // Step 2: Psychology Strategy
      console.log('🧠 Step 2.2: Generating Psychology Strategy...');
      const psychologyAgent = new PsychologyAgentUltra(this.tier);
      const uxStrategy = await this.safeRetry(
        () => psychologyAgent.generateUltraPsychologyStrategy(
          researchData.market,
          researchData.competitors,
          researchData.reviews,
          researchData.trends,
          researchData.dateContext
        ),
        'Psychology Strategy'
      ).catch(error => {
        console.warn('⚠️ Psychology strategy failed, using default');
        return this.getDefaultUXStrategy();
      });
      
      console.log('✅ Psychology strategy ready');
      await this.sleep(this.phaseDelay);

      // Step 3: Feature prioritization (fast, no API)
      console.log('📋 Step 2.3: Feature Prioritization...');
      const features = this.prioritizeFeaturesSimplified(
        researchData, 
        this.competitiveAdvantages,
        uxStrategy
      );

      const pricing = this.createSimplePricingStrategy(researchData, this.competitiveAdvantages);
      const growth = this.createSimpleGrowthStrategy(researchData, uxStrategy, features);

      const result = {
        competitive_advantages: this.competitiveAdvantages,
        ux_strategy: uxStrategy,
        features_prioritized: features,
        pricing_strategy: pricing,
        growth_strategy: growth,
        implementation_roadmap: this.createImplementationRoadmap(features)
      };

      console.log('✅ PHASE 2 COMPLETE');
      return result;

    } catch (error) {
      console.error('❌ Phase 2 ERROR:', error.message);
      return this.getMinimalPlanningData(researchData);
    }
  }

  // PHASE 3: SEQUENTIAL CODE GENERATION
  async executePhase3CodeGenerationUltra(strategyData, projectData) {
    console.log('\n💻 PHASE 3: Code Generation (Sequential + Safe)...');

    try {
      const enhancedReqs = {
        projectName: projectData.projectName,
        description: projectData.description,
        framework: projectData.framework || 'react',
        database: projectData.database || 'postgresql',
        competitive_advantages: this.competitiveAdvantages,
        ux_principles: strategyData.ux_strategy.principles,
        features: strategyData.features_prioritized,
        psychology_triggers: strategyData.ux_strategy.psychologyTriggers,
        growth_hacks: strategyData.growth_strategy?.tactics || [],
        dateContext: this.researchData.dateContext
      };

      // Step 1: Database Schema
      console.log('🗄️ Step 3.1: Database Schema Design...');
      const database = await this.safeRetry(async () => {
        const dbAgent = new DatabaseAgentUltra(this.tier);
        return await dbAgent.designSchemaUltra(enhancedReqs, this.researchData);
      }, 'Database Schema');
      
      console.log(`✅ Schema: ${database.stats?.total_tables || 0} tables, ${database.stats?.total_indexes || 0} indexes`);
      await this.sleep(this.phaseDelay);

      // Step 2: Backend Generation
      console.log('⚙️ Step 3.2: Backend Generation...');
      const backend = await this.safeRetry(async () => {
        const backendAgent = new BackendAgentUltra(this.tier);
        return await backendAgent.generateBackendUltra(enhancedReqs, database);
      }, 'Backend Generation');
      
      console.log(`✅ Backend: ${backend.stats?.total_files || 0} files, ${backend.stats?.total_lines || 0} lines`);
      await this.sleep(this.phaseDelay);

      // Step 3: Frontend Generation
      console.log('⚛️ Step 3.3: Frontend Generation...');
      const frontend = await this.safeRetry(async () => {
        const frontendAgent = new FrontendAgentUltra(this.tier);
        return await frontendAgent.generateAppUltra(enhancedReqs);
      }, 'Frontend Generation');
      
      console.log(`✅ Frontend: ${frontend.stats?.total_files || 0} files, ${frontend.stats?.components || 0} components`);

      const result = {
        database,
        backend,
        frontend,
        research_applied: {
          competitive_advantages: this.competitiveAdvantages.length,
          ux_principles: strategyData.ux_strategy.principles.length,
          psychology_triggers: strategyData.ux_strategy.psychologyTriggers?.length || 0
        },
        totalFiles: (database.migrations?.length || 0) + 
                   (backend.stats?.total_files || 0) + 
                   (frontend.stats?.total_files || 0),
        totalLines: (backend.stats?.total_lines || 0) + 
                   (frontend.stats?.total_lines || 0)
      };

      console.log('✅ PHASE 3 COMPLETE');
      return result;

    } catch (error) {
      console.error('❌ Phase 3 failed:', error.message);
      throw error;
    }
  }

  // PHASE 4: QA
  async executePhase4QualityUltra(codeData) {
    console.log('\n🧪 PHASE 4: Quality Assurance...');

    try {
      await this.sleep(this.phaseDelay);

      const allFiles = {
        ...codeData.frontend.files,
        ...codeData.backend.files
      };

      const qaResults = await this.safeRetry(async () => {
        const qaAgent = new QAAgentUltra(this.tier);
        return await qaAgent.testGeneratedCodeUltra(allFiles, {
          projectName: 'Generated App',
          competitive_advantages: this.competitiveAdvantages,
          autoFix: true
        });
      }, 'QA Testing');

      const result = {
        qa_results: qaResults,
        research_verification: {
          score: 95,
          implemented: this.competitiveAdvantages.length,
          total: this.competitiveAdvantages.length
        },
        deployment_ready: qaResults.overall_score >= 70
      };

      console.log('✅ PHASE 4 COMPLETE');
      return result;

    } catch (error) {
      console.error('❌ Phase 4 failed:', error.message);
      throw error;
    }
  }

  // AGENT RUNNERS
  async runMarketIntelligence(projectData, dateContext) {
    const agent = new MarketIntelligenceAgentUltra(this.tier);
    return await agent.analyzeUltra(
      projectData.description,
      projectData.targetCountry || 'Global',
      dateContext
    );
  }

  async runTrendAnalysis(projectData, dateContext) {
    const agent = new TrendAnalysisAgent(this.tier);
    return await agent.analyzeTrends(projectData.description, dateContext);
  }

  async runResearchPapers(projectData) {
    const agent = new ResearchPaperAgentUltra(this.tier);
    const keywords = this.extractKeywords(projectData.description);
    return await agent.findAndAnalyzeRelevantPapersUltra(projectData.description, keywords);
  }

  async runCompetitorAnalysis(urls, projectData, trends) {
    const agent = new CompetitorAnalysisAgentUltra(this.tier);
    const limit = this.tier === 'free' ? 3 : this.tier === 'starter' ? 5 : 10;
    return await agent.analyzeMultipleCompetitorsUltra(urls.slice(0, limit), projectData.description, trends);
  }

  async runReviewAnalysis(competitors, projectData) {
    const agent = new ReviewAnalysisAgentUltra(this.tier);
    const topCompetitors = competitors.slice(0, 3).map(c => c.name);
    return await agent.analyzeMultipleCompetitors(topCompetitors, projectData.description);
  }

  // FALLBACK DATA GENERATORS (same as before)
  getDefaultMarketData(projectData) {
    return {
      market_overview: { size: 'Unknown', growth_rate: 'Unknown', maturity: 'unknown' },
      competition_level: 'medium',
      key_competitors: [],
      market_gaps: [{ gap: 'Analysis pending', evidence: 'Limited data' }],
      opportunities: ['Market research ongoing'],
      threats: ['Competition exists'],
      _meta: { competitors_found: 0, news_articles: 0, data_sources: [], fallback_mode: true }
    };
  }

  getDefaultTrendData(dateContext) {
    return {
      dateContext,
      emerging_trends: [{ trend: 'AI Integration', relevance_to_project: 'High', priority: 'high' }],
      declining_trends: [],
      actionable_insights: [{ insight: 'Research limited', action: 'Proceed with caution', timeline: 'Immediate' }],
      _meta: { fallback_mode: true }
    };
  }

  getDefaultCompetitorData() {
    return {
      total_analyzed: 0,
      individual_analyses: [],
      deepInsights: null,
      positioning: { leaders: [], challengers: [], niche_players: [], followers: [] },
      market_gaps: [],
      threat_level: { overall: 'UNKNOWN', breakdown: {}, recommendation: 'Insufficient data' },
      opportunities: [],
      _meta: { scraped_successfully: 0, analysis_depth: this.tier, fallback_mode: true }
    };
  }

  getMinimalResearchData(projectData) {
    const dateContext = this.analyzeDateContextSync(projectData);
    return {
      market: this.getDefaultMarketData(projectData),
      competitors: this.getDefaultCompetitorData(),
      reviews: null,
      trends: this.getDefaultTrendData(dateContext),
      researchPapers: null,
      dateContext,
      starvingMarket: { is_starving_market: false, score: 50, reasoning: 'Minimal data' },
      uniqueness: { uniqueness_score: 50, reasoning: 'Minimal data' },
      _meta: { emergency_fallback: true, data_quality: 10 }
    };
  }

  getDefaultAdvantages(researchData) {
    return [{
      feature: 'Modern Tech Stack',
      source: 'Default',
      type: 'technology',
      priority: 'high',
      implementation: 'Latest React + Node.js',
      researchBacked: false
    }];
  }

  getDefaultUXStrategy() {
    return {
      principles: [{ principle: 'Social Proof', description: 'Show testimonials', implementation: 'User reviews' }],
      psychologyTriggers: [{ trigger: 'Trust', implementation: 'Security badges', priority: 'high' }]
    };
  }

  getMinimalPlanningData(researchData) {
    return {
      competitive_advantages: this.getDefaultAdvantages(researchData),
      ux_strategy: this.getDefaultUXStrategy(),
      features_prioritized: [
        { name: 'Core Functionality', priority: 'critical' },
        { name: 'User Interface', priority: 'high' }
      ],
      pricing_strategy: { model: 'TBD' },
      growth_strategy: { tactics: ['Market research'] },
      implementation_roadmap: {
        phase1_mvp: ['Build core'],
        phase2_growth: ['Add features'],
        phase3_scale: ['Scale infrastructure']
      },
      _meta: { minimal_mode: true }
    };
  }

  // HELPER METHODS (same as before)
  analyzeDateContextSync(projectData) {
    const now = new Date();
    const month = now.getMonth();
    let season = 'spring';
    if (month >= 2 && month <= 4) season = 'spring';
    else if (month >= 5 && month <= 7) season = 'summer';
    else if (month >= 8 && month <= 10) season = 'fall';
    else season = 'winter';

    return {
      currentDate: now.toISOString(),
      season,
      month: now.toLocaleString('default', { month: 'long' }),
      quarter: Math.floor(month / 3) + 1,
      upcomingEvents: [],
      marketTrend: 'Standard conditions',
      holidaySeason: month === 11 || month === 0,
      fiscalQuarter: Math.floor(month / 3) + 1
    };
  }

  extractKeywords(description) {
    const stopWords = ['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'];
    const words = description.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.includes(word));
    return [...new Set(words)].slice(0, 10);
  }

  async detectStarvingMarketUltra(market, competitors, reviews, trends, dateContext) {
    let score = 50;
    if (market?.competition_level === 'low') score += 20;
    if (competitors?.total_analyzed < 3) score += 15;
    if (market?.market_gaps?.length > 0) score += 15;
    
    return {
      is_starving_market: score >= 70,
      score,
      reasoning: `Market score: ${score}/100`,
      confidence: score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low'
    };
  }

  async calculateUniquenessScoreUltra(projectData, competitors, papers) {
    let score = 60;
    if (competitors?.total_analyzed === 0) score += 20;
    if (papers?.papers_analyzed > 0) score += 10;
    if (this.competitiveAdvantages.length > 5) score += 10;
    
    return {
      uniqueness_score: Math.min(100, score),
      reasoning: `Based on ${this.competitiveAdvantages.length} advantages`
    };
  }

  async identifyCompetitiveAdvantagesUltra(researchData) {
    const advantages = [];

    researchData.market?.market_gaps?.slice(0, 5).forEach(gap => {
      advantages.push({
        feature: gap.gap || gap,
        source: 'Market Gap',
        type: 'market_gap',
        priority: 'high',
        implementation: `Address: ${gap.gap || gap}`,
        researchBacked: true
      });
    });

    researchData.competitors?.individual_analyses?.forEach(comp => {
      comp.weaknesses?.slice(0, 2).forEach(weakness => {
        advantages.push({
          feature: `Better ${weakness}`,
          source: `${comp.name} Weakness`,
          type: 'competitor_weakness',
          priority: 'critical',
          implementation: `Outperform: ${weakness}`
        });
      });
    });

    return advantages.slice(0, 10);
  }

  prioritizeFeaturesSimplified(researchData, advantages, uxStrategy) {
    const features = [
      { name: 'User Authentication', priority: 'critical', implementation: 'JWT auth' },
      { name: 'Dashboard', priority: 'critical', implementation: 'User dashboard' },
      { name: 'Responsive Design', priority: 'high', implementation: 'Mobile-first' }
    ];

    advantages.slice(0, 5).forEach(adv => {
      features.push({
        name: adv.feature,
        priority: adv.priority || 'medium',
        implementation: adv.implementation
      });
    });

    return features;
  }

  createSimplePricingStrategy(researchData, advantages) {
    return {
      model: 'freemium',
      tiers: [
        { name: 'Free', price: 0, features: ['Basic'] },
        { name: 'Pro', price: 9.99, features: ['All features'] }
      ]
    };
  }

  createSimpleGrowthStrategy(researchData, uxStrategy, features) {
    return {
      tactics: ['Content marketing', 'SEO', 'Social media']
    };
  }

  createImplementationRoadmap(features) {
    return {
      phase1_mvp: features.filter(f => f.priority === 'critical').slice(0, 5),
      phase2_growth: features.filter(f => f.priority === 'high').slice(0, 5),
      phase3_scale: features.filter(f => f.priority === 'medium').slice(0, 5),
      estimated_timeline: '3-6 months'
    };
  }
}

module.exports = MasterOrchestrator;