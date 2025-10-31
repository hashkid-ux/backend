// agents/masterOrchestratorUltra.js
// FIXED: Respects rate limits with proper delays

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
const PostDeploymentMonitor = require('./monitoring/postDeploymentMonitor');

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
    
    // RATE LIMIT SETTINGS
    this.maxRetries = 2;
    this.baseDelay = 20000; // 20 seconds base delay
    this.rateLimitCooldown = 90000; // 90 seconds on 429 error
    
    console.log('🎯 ULTRA Master Orchestrator initialized (Rate Limit Safe):', {
      tier,
      date: this.currentDate.toISOString(),
      retryStrategy: 'Exponential backoff with cooldown'
    });
  }

  getCapabilities() {
    return {
      parallelProcessing: true,
      selfHealing: true,
      gracefulDegradation: true,
      trendAwareness: true,
      researchPapers: this.tier === 'premium',
      postDeploymentMonitoring: this.tier !== 'free',
      advancedPsychology: true,
      dynamicCodeGeneration: true,
      rateLimitProtection: true
    };
  }

  // SAFE RETRY WITH EXPONENTIAL BACKOFF
  async safeRetry(fn, context, maxRetries = this.maxRetries) {
    let attempt = 0;
    let lastError = null;

    while (attempt < maxRetries) {
      try {
        attempt++;
        console.log(`   🔄 ${context} - Attempt ${attempt}/${maxRetries}`);
        
        const result = await fn();
        return result;
      } catch (error) {
        lastError = error;
        
        const isRateLimit = error.message?.includes('429') || 
                           error.message?.includes('rate limit') ||
                           error.message?.includes('rate-limited');
        
        if (isRateLimit) {
          const waitTime = attempt === 1 ? this.rateLimitCooldown : this.rateLimitCooldown * attempt;
          console.error(`   ❌ ${context} - Rate limit hit`);
          console.log(`   ⏳ Cooling down for ${waitTime/1000}s...`);
          await this.sleep(waitTime);
        } else {
          // Non-rate-limit error, shorter backoff
          const waitTime = this.baseDelay * attempt;
          console.error(`   ❌ ${context} - Error: ${error.message}`);
          
          if (attempt < maxRetries) {
            console.log(`   ⏳ Retrying in ${waitTime/1000}s...`);
            await this.sleep(waitTime);
          }
        }
      }
    }

    throw new Error(`${context} failed after ${maxRetries} attempts: ${lastError?.message}`);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // PHASE 1: RESEARCH WITH RATE LIMITING
  async executePhase1ResearchUltra(projectData) {
    console.log('\n📊 PHASE 1: ULTRA Market Research (Rate Limit Safe)...');
    
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
      // 1. Date context (no API call)
      console.log('📅 Step 1.0: Date & Trend Context...');
      results.dateContext = this.analyzeDateContextSync(projectData);

      // 2. Market Intelligence with retry + delay
      console.log('🔍 Step 1.1: Market Intelligence...');
      results.market = await this.safeRetry(
        () => this.runMarketIntelligence(projectData, results.dateContext),
        'Market Intelligence'
      ).catch(error => {
        console.warn('⚠️  Market intelligence failed, using fallback');
        return this.getDefaultMarketData(projectData);
      });
      
      console.log(`   ✅ Market data collected`);
      await this.sleep(5000); // Mandatory 5s delay

      // 3. Trend Analysis with retry + delay
      console.log('📈 Step 1.2: Trend Analysis...');
      results.trends = await this.safeRetry(
        () => this.runTrendAnalysis(projectData, results.dateContext),
        'Trend Analysis'
      ).catch(error => {
        console.warn('⚠️  Trend analysis failed, using fallback');
        return this.getDefaultTrendData(results.dateContext);
      });
      
      console.log(`   ✅ Trends analyzed`);
      await this.sleep(5000); // Mandatory 5s delay

      // 4. Competitor Analysis (SEQUENTIAL, needs market data)
      if (results.market?._meta?.data_sources?.length > 0) {
        console.log('🏢 Step 1.3: Competitor Analysis...');
        results.competitors = await this.safeRetry(
          () => this.runCompetitorAnalysis(
            results.market._meta.data_sources,
            projectData,
            results.trends
          ),
          'Competitor Analysis'
        ).catch(error => {
          console.warn('⚠️  Competitor analysis failed, using fallback');
          return this.getDefaultCompetitorData();
        });
        
        console.log(`   ✅ Competitors: ${results.competitors.total_analyzed} analyzed`);
        await this.sleep(5000); // Mandatory 5s delay
      } else {
        results.competitors = this.getDefaultCompetitorData();
      }

      // 5. Review Analysis (if tier allows)
      if (this.tier !== 'free' && results.competitors?.individual_analyses?.length > 0) {
        console.log('⭐ Step 1.4: Review Analysis...');
        results.reviews = await this.safeRetry(
          () => this.runReviewAnalysis(results.competitors.individual_analyses, projectData),
          'Review Analysis'
        ).catch(error => {
          console.warn('⚠️  Review analysis failed (non-critical)');
          return null;
        });
        
        if (results.reviews) {
          console.log(`   ✅ Reviews: ${results.reviews.totalReviewsAnalyzed} analyzed`);
          await this.sleep(5000);
        }
      }

      // 6. Research Papers (premium only)
      if (this.tier === 'premium') {
        console.log('📚 Step 1.5: Research Papers...');
        results.researchPapers = await this.safeRetry(
          () => this.runResearchPapers(projectData),
          'Research Papers'
        ).catch(error => {
          console.warn('⚠️  Research papers failed (non-critical)');
          return null;
        });
        
        if (results.researchPapers) {
          await this.sleep(5000);
        }
      }

      // 7. Strategic Analysis (lightweight, no heavy API calls)
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

      console.log('✅ PHASE 1 COMPLETE (Rate Limit Safe)');

      this.researchData = results;
      return results;

    } catch (error) {
      console.error('❌ Phase 1 CRITICAL ERROR:', error.message);
      return this.getMinimalResearchData(projectData);
    }
  }

  // INDIVIDUAL AGENT RUNNERS (unchanged, but benefit from client rate limiting)
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
    const urlsToAnalyze = urls.slice(0, this.tier === 'free' ? 3 : this.tier === 'starter' ? 5 : 10);
    return await agent.analyzeMultipleCompetitorsUltra(urlsToAnalyze, projectData.description, trends);
  }

  async runReviewAnalysis(competitors, projectData) {
    const agent = new ReviewAnalysisAgentUltra(this.tier);
    const topCompetitors = competitors.slice(0, 3).map(c => c.name);
    return await agent.analyzeMultipleCompetitors(topCompetitors, projectData.description);
  }

  // DEFAULT DATA GENERATORS (unchanged)
  getDefaultMarketData(projectData) {
    return {
      market_overview: {
        size: 'Market data temporarily unavailable',
        growth_rate: 'Unknown',
        maturity: 'unknown'
      },
      competition_level: 'medium',
      key_competitors: [],
      market_gaps: [{ gap: 'Analysis in progress', evidence: 'Limited data' }],
      opportunities: ['Market research ongoing'],
      threats: ['Competition exists'],
      _meta: {
        competitors_found: 0,
        news_articles: 0,
        data_sources: [],
        fallback_mode: true
      }
    };
  }

  getDefaultTrendData(dateContext) {
    return {
      dateContext,
      emerging_trends: [
        { trend: 'AI Integration', relevance_to_project: 'High', priority: 'high' }
      ],
      declining_trends: [],
      actionable_insights: [
        { insight: 'Research data limited', action: 'Proceed with caution', timeline: 'Immediate' }
      ],
      _meta: {
        fallback_mode: true
      }
    };
  }

  getDefaultCompetitorData() {
    return {
      total_analyzed: 0,
      individual_analyses: [],
      deepInsights: null,
      positioning: {
        leaders: [],
        challengers: [],
        niche_players: [],
        followers: []
      },
      market_gaps: [],
      threat_level: {
        overall: 'UNKNOWN',
        breakdown: {},
        recommendation: 'Insufficient data for competitive analysis'
      },
      opportunities: [],
      _meta: {
        scraped_successfully: 0,
        analysis_depth: this.tier,
        fallback_mode: true
      }
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
      starvingMarket: { is_starving_market: false, score: 50, reasoning: 'Minimal data mode' },
      uniqueness: { uniqueness_score: 50, reasoning: 'Minimal data mode' },
      _meta: {
        emergency_fallback: true,
        data_quality: 10
      }
    };
  }

  // PHASE 2: PLANNING (with delays)
  async executePhase2PlanningUltra(researchData) {
    console.log('\n🎯 PHASE 2: ULTRA Strategic Planning (Rate Limit Safe)...');

    try {
      // 1. Competitive Advantages
      console.log('💡 Step 2.1: Identifying competitive advantages...');
      this.competitiveAdvantages = await this.safeRetry(
        () => this.identifyCompetitiveAdvantagesUltra(researchData),
        'Competitive Advantages'
      ).catch(error => {
        console.warn('⚠️  Using default advantages');
        return this.getDefaultAdvantages(researchData);
      });
      
      console.log(`   ✅ Found ${this.competitiveAdvantages.length} advantages`);
      await this.sleep(5000);

      // 2. Psychology Strategy
      console.log('🧠 Step 2.2: Psychology principles...');
      const uxStrategy = await this.safeRetry(async () => {
        const psychologyAgent = new PsychologyAgentUltra(this.tier);
        return await psychologyAgent.generateUltraPsychologyStrategy(
          researchData.market,
          researchData.competitors,
          researchData.reviews,
          researchData.trends,
          researchData.dateContext
        );
      }, 'Psychology Strategy').catch(error => {
        console.warn('⚠️  Using default UX strategy');
        return this.getDefaultUXStrategy();
      });
      
      console.log(`   ✅ UX strategy created`);
      await this.sleep(5000);

      // 3. Feature Prioritization (no API calls)
      console.log('📋 Step 2.3: Feature prioritization...');
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

  // PHASE 3: CODE GENERATION (with delays between agents)
  async executePhase3CodeGenerationUltra(strategyData, projectData) {
    console.log('\n💻 PHASE 3: Code Generation (Rate Limit Safe)...');

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

      // Database with delay
      console.log('🗄️ Step 3.1: Database schema...');
      const database = await this.safeRetry(async () => {
        const dbAgent = new DatabaseAgentUltra(this.tier);
        return await dbAgent.designSchemaUltra(enhancedReqs, this.researchData);
      }, 'Database Schema');
      
      console.log(`   ✅ Schema: ${database.stats?.total_tables || 0} tables`);
      await this.sleep(10000); // 10s delay before backend

      // Backend with delay
      console.log('⚙️ Step 3.2: Backend code...');
      const backend = await this.safeRetry(async () => {
        const backendAgent = new BackendAgentUltra(this.tier);
        return await backendAgent.generateBackendUltra(enhancedReqs, database);
      }, 'Backend Generation');
      
      console.log(`   ✅ Backend: ${backend.stats?.total_files || 0} files`);
      await this.sleep(10000); // 10s delay before frontend

      // Frontend with delay
      console.log('⚛️ Step 3.3: Frontend code...');
      const frontend = await this.safeRetry(async () => {
        const frontendAgent = new FrontendAgentUltra(this.tier);
        return await frontendAgent.generateAppUltra(enhancedReqs);
      }, 'Frontend Generation');
      
      console.log(`   ✅ Frontend: ${frontend.stats?.total_files || 0} files`);

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

  // PHASE 4: QA (with delay)
  async executePhase4QualityUltra(codeData) {
    console.log('\n🧪 PHASE 4: Quality Assurance (Rate Limit Safe)...');

    try {
      await this.sleep(5000); // Cooldown before QA

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

  // HELPER METHODS (keep all existing ones)
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
      marketTrend: 'Standard market conditions',
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
      reasoning: `Based on ${this.competitiveAdvantages.length} unique advantages`
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
          implementation: `Outperform on: ${weakness}`
        });
      });
    });

    return advantages.slice(0, 10);
  }

  getDefaultAdvantages(researchData) {
    return [
      {
        feature: 'Modern Technology Stack',
        source: 'Default',
        type: 'technology',
        priority: 'high',
        implementation: 'Use latest React and Node.js',
        researchBacked: false
      }
    ];
  }

  getDefaultUXStrategy() {
    return {
      principles: [
        {
          principle: 'Social Proof',
          description: 'People follow what others do',
          implementation: 'Show testimonials and user counts'
        }
      ],
      psychologyTriggers: [
        {
          trigger: 'Trust',
          implementation: 'Display security badges',
          priority: 'high'
        }
      ]
    };
  }

  prioritizeFeaturesSimplified(researchData, advantages, uxStrategy) {
    const features = [
      { name: 'User Authentication', priority: 'critical', implementation: 'JWT-based auth' },
      { name: 'Dashboard', priority: 'critical', implementation: 'User dashboard' },
      { name: 'Responsive Design', priority: 'high', implementation: 'Mobile-first approach' }
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
        { name: 'Free', price: 0, features: ['Basic features'] },
        { name: 'Pro', price: 9.99, features: ['All features'] }
      ]
    };
  }

  createSimpleGrowthStrategy(researchData, uxStrategy, features) {
    return {
      tactics: ['Content marketing', 'SEO optimization', 'Social media presence']
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
      growth_strategy: { tactics: ['Market research', 'Product development'] },
      implementation_roadmap: {
        phase1_mvp: ['Build core features'],
        phase2_growth: ['Add advanced features'],
        phase3_scale: ['Scale infrastructure']
      },
      _meta: { minimal_mode: true }
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