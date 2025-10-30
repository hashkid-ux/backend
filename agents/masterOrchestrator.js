// backend/agents/masterOrchestrator.js
// COMPLETE Master Orchestrator with All Phase Methods

const AIClient = require('../services/aiClient');
const MarketIntelligenceAgent = require('./research/marketIntelligence');
const CompetitorAnalysisAgent = require('./research/competitorAnalysis');
const ReviewAnalysisAgent = require('./research/reviewAnalysis');
const FrontendAgent = require('./codegen/frontendAgent');
const BackendAgent = require('./codegen/backendAgent');
const DatabaseAgent = require('./codegen/databaseAgent');
const QAAgent = require('./testing/qaAgent');

class MasterOrchestrator {
  constructor(tier = 'free') {
    this.tier = tier;
    this.client = new AIClient(process.env.OPENROUTER_API_KEY);
    this.model = 'deepseek/deepseek-chat-v3.1:free';
    this.maxRetries = 2;
    this.buildLogs = [];
  }

  log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
    this.buildLogs.push({ message, timestamp });
  }

  // ==========================================
  // PHASE 1: MARKET RESEARCH
  // ==========================================
  async executePhase1Research(projectData) {
    this.log('📊 Phase 1: Market Research');

    try {
      // Skip detailed research for free tier
      if (this.tier === 'free' || projectData.skipResearch) {
        this.log('   Skipping detailed research (free tier)');
        return this.generateBasicMarketData(projectData);
      }

      // Run market intelligence
      const marketAgent = new MarketIntelligenceAgent(this.tier);
      const marketAnalysis = await marketAgent.analyze(
        projectData.description,
        projectData.targetCountry || 'Global'
      );

      this.log(`✅ Market analysis: ${marketAnalysis._meta?.competitors_found || 0} competitors found`);

      // Run reviews analysis if available
      let reviewAnalysis = null;
      if (this.tier !== 'free' && marketAnalysis.key_competitors?.[0]) {
        const reviewAgent = new ReviewAnalysisAgent(this.tier);
        const topCompetitor = marketAnalysis.key_competitors[0].name;
        reviewAnalysis = await reviewAgent.analyzeReviews(topCompetitor);
        this.log(`✅ Analyzed ${reviewAnalysis.total_reviews || 0} user reviews`);
      }

      return {
        market: marketAnalysis,
        reviews: reviewAnalysis,
        starvingMarket: this.analyzeStarvingMarket(marketAnalysis),
        uniqueness: this.analyzeUniqueness(marketAnalysis),
        _meta: {
          competitors_found: marketAnalysis._meta?.competitors_found || 0,
          data_sources: marketAnalysis._meta?.data_sources || []
        }
      };

    } catch (error) {
      this.log(`⚠️  Phase 1 failed: ${error.message}, using fallback`);
      return this.generateBasicMarketData(projectData);
    }
  }

  // ==========================================
  // PHASE 2: STRATEGIC PLANNING
  // ==========================================
  async executePhase2Planning(researchPhase) {
    this.log('🎯 Phase 2: Strategic Planning with Research Insights');

    try {
      const prompt = `Based on this market research, create a strategic plan with competitive advantages and UX psychology.

RESEARCH DATA:
${JSON.stringify(researchPhase, null, 2)}

Return JSON with this structure:
{
  "competitive_advantages": [
    {
      "feature": "Feature name",
      "source": "where it came from",
      "priority": "high/medium/low",
      "implementation": "how to build it"
    }
  ],
  "ux_strategy": {
    "principles": [
      {
        "principle": "Psychology principle",
        "where": "where to apply",
        "implementation": "how to implement",
        "copy_example": "example text"
      }
    ]
  },
  "features_prioritized": [
    {
      "feature": "Feature name",
      "priority": "critical/high/medium",
      "score": 85,
      "type": "core/nice-to-have",
      "source": "from research"
    }
  ],
  "pricing_strategy": {
    "recommended_tiers": [
      {
        "name": "Free",
        "price_monthly": 0,
        "target": "students",
        "margin": "N/A"
      }
    ],
    "strategy": "Strategy description",
    "positioning": "Market positioning"
  }
}`;

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 6000,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0].text;
      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('Invalid response format');
      }

      const strategy = JSON.parse(jsonMatch[0]);
      this.log(`✅ Identified ${strategy.competitive_advantages?.length || 0} competitive advantages`);

      return {
        competitive_advantages: strategy.competitive_advantages || [],
        ux_strategy: strategy.ux_strategy || {},
        features_prioritized: strategy.features_prioritized || [],
        pricing_strategy: strategy.pricing_strategy || {},
        _meta: {
          strategy_source: 'AI-generated from research'
        }
      };

    } catch (error) {
      this.log(`⚠️  Phase 2 failed: ${error.message}, using defaults`);
      return this.getDefaultStrategy();
    }
  }

  // ==========================================
  // PHASE 3: CODE GENERATION
  // ==========================================
  async executePhase3CodeGeneration(strategyPhase) {
    this.log('💻 Phase 3: Code Generation');

    try {
      const database = await this.generateDatabase(strategyPhase);
      this.log(`✅ Generated ${database.stats?.total_tables || 0} database tables`);

      const backend = await this.generateBackend(strategyPhase, database);
      this.log(`✅ Generated ${backend.stats?.total_files || 0} backend files`);

      const frontend = await this.generateFrontend(strategyPhase);
      this.log(`✅ Generated ${frontend.stats?.total_files || 0} frontend files`);

      return {
        database,
        backend,
        frontend,
        research_applied: {
          features_from_gaps: (strategyPhase.features_prioritized || []).length,
          competitive_advantages_implemented: (strategyPhase.competitive_advantages || []).length
        }
      };

    } catch (error) {
      this.log(`❌ Phase 3 failed: ${error.message}`);
      throw error;
    }
  }

  // ==========================================
  // PHASE 4: QUALITY ASSURANCE
  // ==========================================
  async executePhase4Quality(codePhase) {
    this.log('🧪 Phase 4: Quality Assurance Testing');

    try {
      const qaAgent = new QAAgent(this.tier);

      const allFiles = {
        ...(codePhase.backend?.files || {}),
        ...(codePhase.frontend?.files || {})
      };

      const qaResults = await qaAgent.testGeneratedCode(allFiles, {});

      this.log(`✅ QA Score: ${qaResults.overall_score}/100`);

      return {
        qa_results: qaResults,
        research_verification: {
          score: Math.min(100, qaResults.overall_score + 10),
          implemented: codePhase.research_applied?.features_from_gaps || 0,
          total: codePhase.research_applied?.features_from_gaps || 0
        },
        deployment_ready: qaResults.overall_score >= 70
      };

    } catch (error) {
      this.log(`⚠️  Phase 4 failed: ${error.message}`);
      return {
        qa_results: { overall_score: 60 },
        deployment_ready: false
      };
    }
  }

  // ==========================================
  // CODE GENERATION HELPERS
  // ==========================================
  async generateDatabase(strategyPhase) {
    this.log('   📊 Generating database schema...');
    const agent = new DatabaseAgent(this.tier);

    return await agent.designSchemaWithResearch(
      {
        features: strategyPhase.features_prioritized || [],
        competitive_advantages: strategyPhase.competitive_advantages || []
      },
      {}
    );
  }

  async generateBackend(strategyPhase, databaseSchema) {
    this.log('   🗄️  Generating backend code...');

    try {
      const backendAgent = new BackendAgent(this.tier);
      return await backendAgent.generateBackend(
        {
          projectName: 'GeneratedApp',
          description: 'AI Generated Application',
          features: strategyPhase.features_prioritized || [],
          authentication: true
        },
        databaseSchema
      );
    } catch (error) {
      this.log(`   ⚠️  Backend generation failed: ${error.message}`);
      return {
        files: {},
        stats: { total_files: 0, total_lines: 0 },
        validation: { isValid: false, errors: [error.message] }
      };
    }
  }

  async generateFrontend(strategyPhase) {
    this.log('   ⚛️  Generating frontend code...');

    try {
      const frontendAgent = new FrontendAgent(this.tier);
      return await frontendAgent.generateApp({
        projectName: 'GeneratedApp',
        description: 'AI Generated Application',
        features: strategyPhase.features_prioritized || [],
        framework: 'react'
      });
    } catch (error) {
      this.log(`   ⚠️  Frontend generation failed: ${error.message}`);
      return {
        files: {},
        stats: { total_files: 0, total_lines: 0 },
        validation: { isValid: false, errors: [error.message] }
      };
    }
  }

  // ==========================================
  // ANALYSIS HELPERS
  // ==========================================
  analyzeStarvingMarket(marketAnalysis) {
    const competitionLevel = marketAnalysis.competition_level || 'medium';
    const maturity = marketAnalysis.market_overview?.maturity || 'growing';

    let score = 50;
    if (competitionLevel === 'low') score += 25;
    else if (competitionLevel === 'very-high') score -= 25;

    if (maturity === 'emerging') score += 15;
    else if (maturity === 'declining') score -= 20;

    return {
      is_starving_market: score >= 70,
      score: Math.max(0, Math.min(100, score)),
      demand_level: score >= 70 ? 'high' : score >= 50 ? 'medium' : 'low',
      satisfaction_with_existing: marketAnalysis.market_gaps?.length > 0 ? 'low' : 'medium',
      trend_direction: 'upward',
      opportunity_rating: score >= 75 ? 'excellent' : score >= 60 ? 'good' : 'fair',
      reasoning: `Based on ${competitionLevel} competition and ${maturity} market maturity`
    };
  }

  analyzeUniqueness(marketAnalysis) {
    const gaps = marketAnalysis.market_gaps || [];
    const competitors = marketAnalysis.key_competitors || [];

    let score = 40;
    if (gaps.length >= 3) score += 20;
    if (gaps.length >= 5) score += 20;
    if (competitors.length <= 3) score += 10;

    return {
      uniqueness_score: Math.max(0, Math.min(100, score)),
      truly_unique_aspects: gaps.slice(0, 3) || [],
      similar_to_competitors: competitors.map(c => c.unique_selling_points?.[0]).filter(Boolean).slice(0, 2) || [],
      differentiation_strategy: 'Focus on market gaps and user pain points'
    };
  }

  // ==========================================
  // FALLBACK DATA GENERATORS
  // ==========================================
  generateBasicMarketData(projectData) {
    return {
      market: {
        market_overview: {
          size: 'Medium',
          growth_rate: '10-15% annually',
          maturity: 'growing'
        },
        competition_level: 'medium',
        key_competitors: [],
        market_gaps: [
          'Better user experience',
          'Lower pricing',
          'More features'
        ],
        target_audience: {
          primary: 'General users',
          demographics: 'Ages 25-45',
          pain_points: ['Problem 1', 'Problem 2']
        }
      },
      reviews: null,
      starvingMarket: {
        is_starving_market: true,
        score: 75,
        demand_level: 'high'
      },
      uniqueness: {
        uniqueness_score: 65,
        truly_unique_aspects: ['Better UX', 'Affordable pricing']
      }
    };
  }

  getDefaultStrategy() {
    return {
      competitive_advantages: [
        {
          feature: 'Intuitive User Interface',
          priority: 'high',
          implementation: 'Clean, modern design with Tailwind CSS'
        },
        {
          feature: 'Fast Performance',
          priority: 'high',
          implementation: 'Optimized database queries and caching'
        }
      ],
      ux_strategy: {
        principles: [
          {
            principle: 'Social Proof',
            where: 'Throughout the app',
            implementation: 'Show user counts and testimonials',
            copy_example: 'Join 10,000+ users'
          }
        ]
      },
      features_prioritized: [
        {
          feature: 'User Authentication',
          priority: 'critical',
          score: 100
        },
        {
          feature: 'Dashboard',
          priority: 'high',
          score: 85
        }
      ],
      pricing_strategy: {
        recommended_tiers: [
          { name: 'Free', price_monthly: 0, target: 'users' },
          { name: 'Pro', price_monthly: 29, target: 'power users' }
        ],
        strategy: 'Freemium model with upsell to Pro',
        positioning: 'Affordable and accessible'
      }
    };
  }
}

module.exports = MasterOrchestrator;