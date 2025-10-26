// backend/agents/masterOrchestrator.js
const Anthropic = require('@anthropic-ai/sdk');
const MarketIntelligenceAgent = require('./research/marketIntelligence');
const CompetitorAnalysisAgent = require('./research/competitorAnalysis');
const ReviewAnalysisAgent = require('./research/reviewAnalysis');
const ResearchPaperAgent = require('./research/researchPaperAgent');
const FrontendAgent = require('./codegen/frontendAgent');
const BackendAgent = require('./codegen/backendAgent');
const DatabaseAgent = require('./codegen/databaseAgent');
const QAAgent = require('./testing/qaAgent');

class MasterOrchestrator {
  constructor(tier = 'free') {
    this.tier = tier;
    this.client = new Anthropic({
      apiKey: tier === 'premium' 
        ? process.env.ANTHROPIC_API_KEY 
        : process.env.ANTHROPIC_API_KEY_FREE
    });
    this.model = 'claude-sonnet-4-5-20250929';
    this.researchData = {};
    this.competitiveAdvantages = [];
  }

  async buildApp(projectData) {
    console.log('🚀 Master Orchestrator: Starting comprehensive build...');

    try {
      // PHASE 1: Deep Market Research (Q1 Focus)
      const phase1 = await this.executePhase1Research(projectData);
      
      // PHASE 2: Strategic Planning
      const phase2 = await this.executePhase2Planning(phase1);
      
      // PHASE 3: Code Generation with Applied Research
      const phase3 = await this.executePhase3CodeGeneration(phase2);
      
      // PHASE 4: Quality & Optimization
      const phase4 = await this.executePhase4Quality(phase3);

      return {
        success: true,
        phases: {
          research: phase1,
          strategy: phase2,
          code: phase3,
          quality: phase4
        },
        downloadable: true,
        tier: this.tier
      };

    } catch (error) {
      console.error('❌ Master Orchestrator Error:', error);
      throw error;
    }
  }

  // ==========================================
  // PHASE 1: COMPREHENSIVE RESEARCH (Q1)
  // ==========================================
  async executePhase1Research(projectData) {
    console.log('📊 Phase 1: Deep Market Research');

    const results = {
      market: null,
      competitors: null,
      reviews: null,
      researchPapers: null,
      starvingMarket: null,
      uniqueness: null,
      margins: null
    };

    // 1.1 Market Intelligence (REAL web scraping)
    const marketAgent = new MarketIntelligenceAgent(this.tier);
    results.market = await marketAgent.analyze(
      projectData.description, 
      projectData.targetCountry || 'Global'
    );

    // 1.2 Competitor Deep Dive
    if (results.market._meta?.data_sources?.length > 0) {
      const competitorAgent = new CompetitorAnalysisAgent(this.tier);
      results.competitors = await competitorAgent.analyzeMultipleCompetitors(
        results.market._meta.data_sources.slice(0, this.tier === 'free' ? 3 : 8),
        projectData.description
      );
    }

    // 1.3 Review Analysis (Sentiment + Pain Points)
    if (this.tier !== 'free' && results.competitors?.individual_analyses) {
      const reviewAgent = new ReviewAnalysisAgent(this.tier);
      const topCompetitor = results.competitors.individual_analyses[0];
      
      if (topCompetitor?.name) {
        results.reviews = await reviewAgent.analyzeReviews(topCompetitor.name);
      }
    }

    // 1.4 Research Paper Analysis (Premium Feature)
    if (this.tier === 'premium') {
      const paperAgent = new ResearchPaperAgent(this.tier);
      results.researchPapers = await paperAgent.findAndAnalyzeRelevantPapers(
        projectData.description,
        results.market.keywords
      );
    }

    // 1.5 Starving Market Detection
    results.starvingMarket = await this.detectStarvingMarket(
      results.market,
      results.competitors,
      results.reviews
    );

    // 1.6 Uniqueness Score
    results.uniqueness = await this.calculateUniquenessScore(
      projectData,
      results.competitors,
      results.reviews
    );

    // 1.7 Margin Analysis
    results.margins = await this.calculateMargins(
      projectData,
      results.market,
      results.competitors
    );

    this.researchData = results;
    return results;
  }

  // ==========================================
  // PHASE 2: STRATEGIC PLANNING
  // ==========================================
  async executePhase2Planning(researchData) {
    console.log('🎯 Phase 2: Strategic Planning with Research Insights');

    // Extract competitive advantages from ALL research
    this.competitiveAdvantages = await this.identifyCompetitiveAdvantages(researchData);

    // Apply psychology principles to UX strategy
    const uxStrategy = await this.applyPsychologyPrinciples(
      researchData.market,
      researchData.competitors,
      researchData.reviews
    );

    // Feature prioritization based on:
    // - Competitor weaknesses
    // - User pain points from reviews
    // - Research paper innovations
    // - Market gaps
    const features = await this.prioritizeFeatures(
      researchData,
      this.competitiveAdvantages
    );

    // Pricing strategy with margins
    const pricing = await this.createPricingStrategy(
      researchData.margins,
      researchData.competitors
    );

    return {
      competitive_advantages: this.competitiveAdvantages,
      ux_strategy: uxStrategy,
      features_prioritized: features,
      pricing_strategy: pricing,
      implementation_plan: await this.createImplementationPlan(features)
    };
  }

  // ==========================================
  // PHASE 3: CODE GENERATION (Research-Driven)
  // ==========================================
  async executePhase3CodeGeneration(strategyData) {
    console.log('💻 Phase 3: Generating Code with Applied Research');

    // Generate enhanced project requirements
    const enhancedRequirements = {
      ...strategyData,
      competitive_features: this.competitiveAdvantages.map(ca => ca.feature),
      ux_psychology: strategyData.ux_strategy.principles,
      pain_point_solutions: this.researchData.reviews?.insights?.top_complaints
        ?.map(c => ({
          problem: c.complaint,
          solution_feature: c.solution_in_our_app
        })) || []
    };

    // Database Schema (incorporating data needs from features)
    const dbAgent = new DatabaseAgent(this.tier);
    const database = await dbAgent.designSchemaWithResearch(
      enhancedRequirements,
      this.researchData
    );

    // Backend (with competitor API insights)
    const backendAgent = new BackendAgent(this.tier);
    const backend = await backendAgent.generateBackendWithInsights(
      enhancedRequirements,
      database,
      this.competitiveAdvantages
    );

    // Frontend (with UX psychology applied)
    const frontendAgent = new FrontendAgent(this.tier);
    const frontend = await frontendAgent.generateAppWithPsychology(
      enhancedRequirements,
      strategyData.ux_strategy
    );

    return {
      database,
      backend,
      frontend,
      research_applied: {
        features_from_gaps: this.competitiveAdvantages.length,
        pain_points_solved: this.researchData.reviews?.insights?.top_complaints?.length || 0,
        research_papers_used: this.researchData.researchPapers?.papers?.length || 0,
        psychology_principles: strategyData.ux_strategy.principles.length
      }
    };
  }

  // ==========================================
  // PHASE 4: QUALITY ASSURANCE
  // ==========================================
  async executePhase4Quality(codeData) {
    console.log('🧪 Phase 4: Quality Assurance & Optimization');

    const qaAgent = new QAAgent(this.tier);
    
    const allFiles = {
      ...codeData.frontend.files,
      ...codeData.backend.files
    };

    const qaResults = await qaAgent.testGeneratedCode(
      allFiles,
      {
        competitive_advantages: this.competitiveAdvantages,
        research_applied: codeData.research_applied
      }
    );

    // Verify research implementation
    const researchVerification = await this.verifyResearchImplementation(
      allFiles,
      this.researchData,
      this.competitiveAdvantages
    );

    return {
      qa_results: qaResults,
      research_verification: researchVerification,
      deployment_ready: qaResults.overall_score >= 70 && researchVerification.score >= 80
    };
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  async detectStarvingMarket(market, competitors, reviews) {
    const prompt = `Analyze if this is a "starving market":

MARKET DATA:
${JSON.stringify(market, null, 2)}

COMPETITOR DATA:
${JSON.stringify(competitors?.comparison, null, 2)}

REVIEW INSIGHTS:
${JSON.stringify(reviews?.insights, null, 2)}

A starving market has:
1. High demand (lots of searches, questions)
2. Poor existing solutions (low satisfaction, many complaints)
3. Growing trends (increasing interest)
4. Willingness to pay

Return JSON:
{
  "is_starving_market": true/false,
  "score": 0-100,
  "demand_level": "high/medium/low",
  "satisfaction_with_existing": "poor/fair/good",
  "trend_direction": "growing/stable/declining",
  "reasoning": "detailed explanation",
  "opportunity_rating": "excellent/good/moderate/poor"
}`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0].text;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (error) {
      console.error('Starving market detection error:', error);
      return null;
    }
  }

  async calculateUniquenessScore(projectData, competitors, reviews) {
    const prompt = `Calculate uniqueness score for this idea:

IDEA: ${projectData.description}

COMPETITORS:
${JSON.stringify(competitors?.individual_analyses, null, 2)}

USER COMPLAINTS ABOUT COMPETITORS:
${JSON.stringify(reviews?.insights?.top_complaints, null, 2)}

Analyze:
1. How different is this from existing solutions?
2. Does it solve problems competitors don't?
3. Is there a unique angle?

Return JSON:
{
  "uniqueness_score": 0-100,
  "truly_unique_aspects": ["aspect1", "aspect2"],
  "similar_to_competitors": ["what's not unique"],
  "differentiation_strategy": "how to stand out",
  "recommendation": "clear strategic advice"
}`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0].text;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (error) {
      console.error('Uniqueness calculation error:', error);
      return null;
    }
  }

  async calculateMargins(projectData, market, competitors) {
    const prompt = `Calculate profit margins for this business:

PROJECT: ${projectData.description}
MARKET: ${JSON.stringify(market.market_overview, null, 2)}
COMPETITORS: ${JSON.stringify(competitors?.comparison, null, 2)}

Calculate:
1. Estimated costs (development, hosting, marketing, support)
2. Revenue potential per user
3. Gross margin %
4. Break-even point
5. Scale economics

Return JSON:
{
  "estimated_costs": {
    "initial_development": "$X",
    "monthly_hosting": "$X",
    "monthly_marketing": "$X",
    "support_per_user": "$X"
  },
  "revenue_per_user": {
    "monthly": "$X",
    "annual": "$X",
    "lifetime_value": "$X"
  },
  "margins": {
    "gross_margin_percent": X,
    "net_margin_percent": X
  },
  "break_even": {
    "users_needed": X,
    "months_to_break_even": X
  },
  "scaling": {
    "margin_at_100_users": "X%",
    "margin_at_1000_users": "X%",
    "margin_at_10000_users": "X%"
  }
}`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0].text;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (error) {
      console.error('Margin calculation error:', error);
      return null;
    }
  }

  async identifyCompetitiveAdvantages(researchData) {
    // Combine ALL insights from research
    const gaps = researchData.market?.market_gaps || [];
    const weaknesses = researchData.competitors?.comparison?.competitive_weaknesses || [];
    const complaints = researchData.reviews?.insights?.top_complaints || [];
    const innovations = researchData.researchPapers?.innovations || [];

    const advantages = [];

    // Gap-based advantages
    gaps.forEach(gap => {
      advantages.push({
        type: 'market_gap',
        feature: `Fill gap: ${gap}`,
        source: 'Market Research',
        priority: 'high',
        implementation: `Create feature that addresses: ${gap}`
      });
    });

    // Weakness-based advantages
    weaknesses.forEach(weakness => {
      advantages.push({
        type: 'competitor_weakness',
        feature: `Improve on: ${weakness}`,
        source: 'Competitor Analysis',
        priority: 'high',
        implementation: `Do better: ${weakness}`
      });
    });

    // Complaint-based advantages
    complaints.slice(0, 5).forEach(complaint => {
      advantages.push({
        type: 'pain_point_solution',
        feature: `Solve: ${complaint.complaint}`,
        source: 'User Reviews',
        priority: complaint.severity === 'critical' ? 'critical' : 'high',
        implementation: complaint.solution || 'Address this pain point directly'
      });
    });

    // Research-based innovations (Premium)
    if (innovations) {
      innovations.forEach(innovation => {
        advantages.push({
          type: 'research_innovation',
          feature: innovation.innovation,
          source: 'Academic Research',
          priority: 'medium',
          implementation: innovation.how_to_implement
        });
      });
    }

    return advantages;
  }

  async applyPsychologyPrinciples(market, competitors, reviews) {
    const prompt = `Design UX strategy using psychology principles:

TARGET AUDIENCE: ${JSON.stringify(market.target_audience, null, 2)}
PAIN POINTS: ${JSON.stringify(reviews?.insights?.user_pain_points, null, 2)}

Apply these psychology principles:
1. **Scarcity**: Create urgency
2. **Social Proof**: Build trust
3. **Anchoring**: Pricing psychology
4. **Loss Aversion**: Fear of missing out
5. **Reciprocity**: Give value first
6. **Authority**: Expert positioning
7. **Commitment**: Small steps to big actions
8. **Liking**: Emotional connection

Return JSON with specific implementations:
{
  "principles": [
    {
      "principle": "Scarcity",
      "implementation": "specific UI/UX element",
      "where": "which page/component",
      "copy_example": "exact text to use"
    }
  ],
  "color_psychology": {
    "primary": "#hex - reason",
    "cta": "#hex - reason"
  },
  "flow_design": "user journey optimized for conversions"
}`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0].text;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : { principles: [] };
    } catch (error) {
      console.error('Psychology application error:', error);
      return { principles: [] };
    }
  }

  async prioritizeFeatures(researchData, competitiveAdvantages) {
    // Score features based on multiple factors
    return competitiveAdvantages
      .map(adv => ({
        ...adv,
        score: this.calculateFeatureScore(adv, researchData)
      }))
      .sort((a, b) => b.score - a.score);
  }

  calculateFeatureScore(advantage, researchData) {
    let score = 0;

    // Priority weight
    const priorityScores = { critical: 100, high: 75, medium: 50, low: 25 };
    score += priorityScores[advantage.priority] || 0;

    // Type weight
    const typeScores = {
      pain_point_solution: 50,
      market_gap: 40,
      competitor_weakness: 35,
      research_innovation: 30
    };
    score += typeScores[advantage.type] || 0;

    // Starving market multiplier
    if (researchData.starvingMarket?.is_starving_market) {
      score *= 1.5;
    }

    return Math.round(score);
  }

  async createPricingStrategy(margins, competitors) {
    const competitorPricing = competitors?.comparison?.pricing_range || {};
    
    return {
      recommended_tiers: [
        {
          name: 'Starter',
          price_monthly: margins?.revenue_per_user?.monthly || '$29',
          target: 'Individual users testing the product',
          margin: margins?.margins?.gross_margin_percent || '70%'
        },
        {
          name: 'Professional',
          price_monthly: margins?.revenue_per_user?.annual ? 
            `$${Math.round(margins.revenue_per_user.annual.replace('$', '') / 12 * 1.5)}` : 
            '$79',
          target: 'Small teams and power users',
          margin: margins?.margins?.net_margin_percent || '60%'
        },
        {
          name: 'Enterprise',
          price_monthly: 'Custom',
          target: 'Large organizations',
          margin: '80%+'
        }
      ],
      strategy: 'Value-based pricing targeting competitor weaknesses',
      positioning: competitorPricing.average ? 
        `10-20% below market average (${competitorPricing.average})` : 
        'Competitive market entry'
    };
  }

  async createImplementationPlan(features) {
    return {
      phase_1_mvp: features.filter(f => f.priority === 'critical').slice(0, 5),
      phase_2_growth: features.filter(f => f.priority === 'high').slice(0, 10),
      phase_3_scale: features.filter(f => f.priority === 'medium')
    };
  }

  async verifyResearchImplementation(files, researchData, advantages) {
    // Check if competitive advantages are actually in the code
    let implementedCount = 0;
    const allCode = Object.values(files).join('\n').toLowerCase();

    advantages.forEach(adv => {
      const keywords = adv.feature.toLowerCase().split(' ').filter(w => w.length > 3);
      const found = keywords.some(keyword => allCode.includes(keyword));
      if (found) implementedCount++;
    });

    const score = Math.round((implementedCount / advantages.length) * 100);

    return {
      score,
      implemented: implementedCount,
      total: advantages.length,
      missing: advantages.filter((_, i) => i >= implementedCount).map(a => a.feature),
      recommendation: score >= 80 ? 
        'Excellent research application' : 
        'More research insights should be implemented'
    };
  }
}

module.exports = MasterOrchestrator;