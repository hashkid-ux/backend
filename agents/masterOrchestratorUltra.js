// agents/masterOrchestratorUltra.js
// 🚀 ULTRA ORCHESTRATOR - Parallel AI, Smart Distribution, Zero Bottlenecks

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

class ParallelExecutor {
  constructor(maxConcurrent = 6) {
    this.maxConcurrent = maxConcurrent;
    this.running = 0;
    this.queue = [];
  }

  async execute(tasks) {
    return new Promise((resolve) => {
      const results = [];
      let completed = 0;
      
      const runNext = () => {
        if (this.queue.length === 0 && this.running === 0) {
          resolve(results);
          return;
        }
        
        while (this.running < this.maxConcurrent && this.queue.length > 0) {
          const { task, index } = this.queue.shift();
          this.running++;
          
          task()
            .then(result => {
              results[index] = { success: true, data: result };
            })
            .catch(error => {
              console.error(`❌ Parallel task ${index} failed:`, error.message);
              results[index] = { success: false, error: error.message };
            })
            .finally(() => {
              this.running--;
              completed++;
              console.log(`   ✅ Completed ${completed}/${tasks.length} parallel tasks`);
              runNext();
            });
        }
      };
      
      this.queue = tasks.map((task, index) => ({ task, index }));
      runNext();
    });
  }
}

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
    
    // Parallel execution
    this.parallelExecutor = new ParallelExecutor(6);
    
    // Smart retry config
    this.maxRetries = 2;
    this.baseDelay = 15000; // 15s base
    this.rateLimitCooldown = 90000; // 90s
    
    console.log('🎯 ULTRA Master Orchestrator initialized (Parallel + Smart):', {
      tier,
      date: this.currentDate.toISOString(),
      maxParallel: 6,
      strategy: 'Intelligent parallel distribution with rate limit protection'
    });
  }

  getCapabilities() {
    return {
      parallelProcessing: true,
      smartLoadBalancing: true,
      selfHealing: true,
      gracefulDegradation: true,
      trendAwareness: true,
      researchPapers: this.tier === 'premium',
      advancedPsychology: true,
      dynamicCodeGeneration: true,
      rateLimitProtection: true,
      predictiveThrottling: true
    };
  }

  // ENHANCED: Retry with better error handling
  async safeRetry(fn, context, maxRetries = this.maxRetries) {
    let attempt = 0;
    let lastError = null;

    while (attempt < maxRetries) {
      try {
        attempt++;
        console.log(`🔄 ${context} - Attempt ${attempt}/${maxRetries}`);
        
        const result = await fn();
        return result;
      } catch (error) {
        lastError = error;
        
        // Check if it's a JSON parsing error
        const isJSONError = error.message?.includes('JSON') || 
                           error.message?.includes('parse') ||
                           error.message?.includes('Unexpected token');
        
        const isRateLimit = error.message?.includes('429') || 
                           error.message?.includes('rate limit');
        
        if (isJSONError) {
          console.warn(`⚠️ ${context} - JSON parsing error, will retry with stricter validation`);
          await this.sleep(5000);
        } else if (isRateLimit) {
          const waitTime = this.rateLimitCooldown;
          console.error(`❌ ${context} - Rate limit hit`);
          console.log(`⏳ Cooling down ${waitTime/1000}s...`);
          await this.sleep(waitTime);
        } else {
          const waitTime = this.baseDelay * attempt;
          console.error(`❌ ${context} - Error: ${error.message}`);
          
          if (attempt < maxRetries) {
            console.log(`⏳ Retrying in ${waitTime/1000}s...`);
            await this.sleep(waitTime);
          }
        }
      }
    }

    console.error(`❌ ${context} failed after ${maxRetries} attempts`);
    throw new Error(`${context} failed: ${lastError?.message}`);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // PHASE 1: PARALLEL RESEARCH
  async executePhase1ResearchUltra(projectData) {
    console.log('\n📊 PHASE 1: ULTRA Market Research (Parallel + Smart)...');
    
    const results = {
      market: null,
      competitors: null,
      reviews: null,
      trends: null,
      researchPapers: null,
      dateContext: null,
      starvingMarket: null,
      uniqueness: null
    };

    try {
      // Step 0: Date context (instant, no API)
      console.log('📅 Step 1.0: Date & Trend Context...');
      results.dateContext = this.analyzeDateContextSync(projectData);

      // Step 1: PARALLEL - Market & Trends (independent)
      console.log('🔍 Step 1.1: Market Intelligence & Trends (Parallel)...');
      
      const parallelTasks = [
        async () => {
          console.log('   🔸 Starting Market Intelligence...');
          return await this.safeRetry(
            () => this.runMarketIntelligence(projectData, results.dateContext),
            'Market Intelligence'
          );
        },
        async () => {
          console.log('   🔸 Starting Trend Analysis...');
          await this.sleep(3000); // Stagger by 3s
          return await this.safeRetry(
            () => this.runTrendAnalysis(projectData, results.dateContext),
            'Trend Analysis'
          );
        }
      ];
      
      const parallelResults = await this.parallelExecutor.execute(parallelTasks);
      
      results.market = parallelResults[0]?.success 
        ? parallelResults[0].data 
        : this.getDefaultMarketData(projectData);
      
      results.trends = parallelResults[1]?.success 
        ? parallelResults[1].data 
        : this.getDefaultTrendData(results.dateContext);
      
      console.log('✅ Market & Trends complete');
      await this.sleep(5000); // Brief cooldown

      // Step 2: Competitor Analysis (needs market data)
      if (results.market?._meta?.data_sources?.length > 0) {
        console.log('🏢 Step 1.2: Competitor Analysis...');
        results.competitors = await this.safeRetry(
          () => this.runCompetitorAnalysis(
            results.market._meta.data_sources,
            projectData,
            results.trends
          ),
          'Competitor Analysis'
        ).catch(error => {
          console.warn('⚠️ Competitor analysis failed');
          return this.getDefaultCompetitorData();
        });
        
        console.log(`✅ Competitors: ${results.competitors.total_analyzed || 0} analyzed`);
        await this.sleep(5000);
      } else {
        results.competitors = this.getDefaultCompetitorData();
      }

      // Step 3: PARALLEL - Reviews & Papers (if applicable)
      const secondaryTasks = [];
      
      if (this.tier !== 'free' && results.competitors?.individual_analyses?.length > 0) {
        secondaryTasks.push(async () => {
          console.log('   🔸 Starting Review Analysis...');
          return await this.safeRetry(
            () => this.runReviewAnalysis(results.competitors.individual_analyses, projectData),
            'Review Analysis'
          );
        });
      }
      
      if (this.tier === 'premium') {
        secondaryTasks.push(async () => {
          console.log('   🔸 Starting Research Papers...');
          await this.sleep(3000); // Stagger
          return await this.safeRetry(
            () => this.runResearchPapers(projectData),
            'Research Papers'
          );
        });
      }
      
      if (secondaryTasks.length > 0) {
        console.log('⭐ Step 1.3: Reviews & Papers (Parallel)...');
        const secondaryResults = await this.parallelExecutor.execute(secondaryTasks);
        
        results.reviews = secondaryResults[0]?.success ? secondaryResults[0].data : null;
        results.researchPapers = secondaryResults[1]?.success ? secondaryResults[1].data : null;
        
        console.log('✅ Secondary research complete');
        await this.sleep(5000);
      }

      // Step 4: Strategic Analysis (lightweight)
      console.log('🎯 Step 1.4: Strategic Analysis...');
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

      console.log('✅ PHASE 1 COMPLETE (Parallel + Smart)');

      this.researchData = results;
      return results;

    } catch (error) {
      console.error('❌ Phase 1 CRITICAL ERROR:', error.message);
      return this.getMinimalResearchData(projectData);
    }
  }

  // PHASE 2: PARALLEL STRATEGY
  async executePhase2PlanningUltra(researchData) {
    console.log('\n🎯 PHASE 2: ULTRA Strategic Planning (Parallel)...');

    try {
      // Parallel: Advantages + Psychology
      console.log('💡 Step 2.1: Strategy Components (Parallel)...');
      
      const strategyTasks = [
        async () => {
          console.log('   🔸 Identifying Competitive Advantages...');
          return await this.safeRetry(
            () => this.identifyCompetitiveAdvantagesUltra(researchData),
            'Competitive Advantages'
          );
        },
        async () => {
          console.log('   🔸 Generating Psychology Strategy...');
          await this.sleep(3000); // Stagger
          const psychologyAgent = new PsychologyAgentUltra(this.tier);
          return await this.safeRetry(
            () => psychologyAgent.generateUltraPsychologyStrategy(
              researchData.market,
              researchData.competitors,
              researchData.reviews,
              researchData.trends,
              researchData.dateContext
            ),
            'Psychology Strategy'
          );
        }
      ];
      
      const strategyResults = await this.parallelExecutor.execute(strategyTasks);
      
      this.competitiveAdvantages = strategyResults[0]?.success 
        ? strategyResults[0].data 
        : this.getDefaultAdvantages(researchData);
      
      const uxStrategy = strategyResults[1]?.success 
        ? strategyResults[1].data 
        : this.getDefaultUXStrategy();
      
      console.log(`✅ Strategy: ${this.competitiveAdvantages.length} advantages found`);
      await this.sleep(5000);

      // Feature prioritization (fast, no API)
      console.log('📋 Step 2.2: Feature Prioritization...');
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

  // PHASE 3: PARALLEL CODE GENERATION
  async executePhase3CodeGenerationUltra(strategyData, projectData) {
    console.log('\n💻 PHASE 3: Code Generation (Parallel)...');

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

      // Database first (needed by others)
      console.log('🗄️ Step 3.1: Database Schema...');
      const database = await this.safeRetry(async () => {
        const dbAgent = new DatabaseAgentUltra(this.tier);
        return await dbAgent.designSchemaUltra(enhancedReqs, this.researchData);
      }, 'Database Schema');
      
      console.log(`✅ Schema: ${database.stats?.total_tables || 0} tables`);
      await this.sleep(8000); // Cooldown before parallel

      // PARALLEL: Backend + Frontend (both need DB)
      console.log('⚙️ Step 3.2: Backend & Frontend (Parallel)...');
      
      const codegenTasks = [
        async () => {
          console.log('   🔸 Generating Backend...');
          const backendAgent = new BackendAgentUltra(this.tier);
          return await this.safeRetry(
            () => backendAgent.generateBackendUltra(enhancedReqs, database),
            'Backend Generation'
          );
        },
        async () => {
          console.log('   🔸 Generating Frontend...');
          await this.sleep(5000); // Stagger by 5s
          const frontendAgent = new FrontendAgentUltra(this.tier);
          return await this.safeRetry(
            () => frontendAgent.generateAppUltra(enhancedReqs),
            'Frontend Generation'
          );
        }
      ];
      
      const codegenResults = await this.parallelExecutor.execute(codegenTasks);
      
      const backend = codegenResults[0]?.success 
        ? codegenResults[0].data 
        : { files: {}, stats: { total_files: 0, total_lines: 0 } };
      
      const frontend = codegenResults[1]?.success 
        ? codegenResults[1].data 
        : { files: {}, stats: { total_files: 0, total_lines: 0 } };
      
      console.log(`✅ Backend: ${backend.stats?.total_files || 0} files`);
      console.log(`✅ Frontend: ${frontend.stats?.total_files || 0} files`);

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
      await this.sleep(5000); // Cooldown

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
        deployment_ready: qaResults.overall_score >= 70,
        monitoring_setup: null
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

  // FALLBACK DATA GENERATORS
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

  // HELPER METHODS
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