// agents/strategyAgentUltra.js
// ULTRA Strategy Agent - Deep Business Intelligence & Planning

const AIClient = require('../services/aiClient');

class StrategyAgentUltra {
  constructor(tier = 'free') {
    this.tier = tier;
    this.client = new AIClient(process.env.OPENROUTER_API_KEY);
    this.model = 'qwen/qwen-2.5-coder-32b-instruct:free';
  }

  async validateIdeaUltra(ideaDescription, targetMarket, budget, researchData = null) {
    console.log('🎯 ULTRA Strategy: Validating idea with deep intelligence...');
    
    const prompt = `You are an ULTRA-INTELLIGENT strategic business consultant. Analyze this startup idea with EXTREME depth.

BUSINESS IDEA: ${ideaDescription}
TARGET MARKET: ${targetMarket}
BUDGET: ${budget}

${researchData ? `
REAL MARKET RESEARCH DATA:
- Competitors Found: ${researchData.competitors?.total_analyzed || 0}
- Market Size: ${researchData.market?.market_overview?.size || 'Unknown'}
- Competition Level: ${researchData.market?.competition_level || 'Unknown'}
- User Reviews Analyzed: ${researchData.reviews?.totalReviewsAnalyzed || 0}
- Emerging Trends: ${researchData.trends?.emerging_trends?.length || 0}
` : ''}

CURRENT CONTEXT:
- Date: ${new Date().toISOString()}
- Season: ${this.getCurrentSeason()}
- Market Momentum: ${this.getMarketMomentum()}

Provide ULTRA-COMPREHENSIVE analysis in JSON:
{
  "viability_score": 0-100,
  "confidence": "high/medium/low",
  "reasoning": "Detailed reasoning with specific evidence",
  
  "market_analysis": {
    "tam": "Total Addressable Market with calculation",
    "sam": "Serviceable Addressable Market",
    "som": "Serviceable Obtainable Market (realistic)",
    "growth_rate": "YoY % with evidence",
    "maturity": "emerging/growing/mature/declining",
    "entry_timing": "perfect/good/challenging/poor with reasoning",
    "seasonal_factors": {
      "current_season_impact": "How current season affects this",
      "best_launch_window": "When to launch",
      "seasonal_revenue_pattern": "Revenue seasonality prediction"
    }
  },
  
  "competition_intelligence": {
    "intensity": "low/medium/high/extreme",
    "top_threats": [
      {
        "competitor": "Name",
        "threat_level": "critical/high/medium/low",
        "why_threatening": "Specific reasons",
        "how_to_compete": "Actionable strategy"
      }
    ],
    "market_gaps": [
      {
        "gap": "Specific unmet need",
        "evidence": "How we know this exists",
        "opportunity_size": "$X million",
        "difficulty_to_fill": "easy/medium/hard",
        "time_to_capture": "X months"
      }
    ],
    "competitive_moats_needed": ["Specific moats to build"]
  },
  
  "target_audience_deep_dive": {
    "primary_persona": {
      "demographics": "Age, location, income, education",
      "psychographics": "Values, beliefs, lifestyle, pain points",
      "behavioral_patterns": "How they buy, use, decide",
      "willingness_to_pay": "Price sensitivity analysis",
      "acquisition_channels": ["Where to find them"],
      "objections": ["What stops them from buying"],
      "triggers": ["What makes them buy NOW"]
    },
    "secondary_personas": ["If multiple segments"],
    "total_addressable_users": "Specific number estimate",
    "realistic_capture_rate": "X% in Y timeframe"
  },
  
  "business_model_design": {
    "recommended_model": "SaaS/Marketplace/B2B/etc with reasoning",
    "pricing_strategy": {
      "model": "freemium/subscription/usage-based/etc",
      "tiers": [
        {
          "name": "Tier name",
          "price": "$X/month",
          "target_user": "Who buys this",
          "conversion_rate": "Expected %",
          "features": ["Key features"]
        }
      ],
      "psychological_pricing": "How to price for maximum conversions"
    },
    "unit_economics": {
      "cac": "Customer Acquisition Cost estimate",
      "ltv": "Lifetime Value estimate",
      "ltv_cac_ratio": "Target ratio",
      "payback_period": "X months",
      "path_to_profitability": "Specific steps"
    }
  },
  
  "go_to_market_strategy": {
    "phase_1_launch": {
      "duration": "X months",
      "objective": "Specific measurable goal",
      "target_users": "Who to target first",
      "channels": [
        {
          "channel": "Channel name",
          "why": "Why this channel",
          "tactics": ["Specific tactics"],
          "budget_allocation": "X%",
          "expected_roi": "X:1"
        }
      ],
      "success_metrics": ["Metric 1: X", "Metric 2: Y"]
    },
    "phase_2_growth": {
      "duration": "X months",
      "scaling_strategy": "How to scale",
      "new_channels": ["Additional channels"],
      "partnerships": ["Strategic partnerships to pursue"]
    },
    "phase_3_scale": {
      "expansion_markets": ["Geographic/segment expansion"],
      "product_evolution": "How product should evolve",
      "exit_strategy": "M&A/IPO/Sustainable business"
    }
  },
  
  "financial_projections": {
    "startup_costs": {
      "development": "$X",
      "marketing": "$X",
      "operations": "$X",
      "total": "$X"
    },
    "year_1": {
      "revenue": "$X with assumptions",
      "costs": "$X breakdown",
      "burn_rate": "$X/month",
      "users": "X users",
      "mrr": "$X MRR"
    },
    "year_2": {
      "revenue": "$X",
      "costs": "$X",
      "profitability": "Profitable/Break-even/Burning",
      "users": "X users"
    },
    "year_3": {
      "revenue": "$X",
      "valuation": "Estimated $X",
      "exit_potential": "High/Medium/Low"
    },
    "funding_needed": {
      "amount": "$X",
      "use_of_funds": "Detailed breakdown",
      "milestones": ["Milestone 1", "Milestone 2"],
      "valuation_target": "$X"
    }
  },
  
  "risk_analysis": {
    "critical_risks": [
      {
        "risk": "Specific risk",
        "probability": "high/medium/low",
        "impact": "catastrophic/severe/moderate/minor",
        "mitigation": "Actionable mitigation strategy",
        "contingency": "What to do if it happens"
      }
    ],
    "regulatory_concerns": ["Any legal/compliance issues"],
    "technical_challenges": ["Development challenges"],
    "market_risks": ["Market-related risks"]
  },
  
  "competitive_advantages_strategy": {
    "must_have_advantages": [
      {
        "advantage": "Specific advantage",
        "why_critical": "Why this is essential",
        "how_to_build": "Step-by-step",
        "time_to_build": "X months",
        "defensibility": "How defensible",
        "cost_to_build": "$X"
      }
    ],
    "nice_to_have": ["Secondary advantages"],
    "innovation_opportunities": ["Where to innovate"]
  },
  
  "execution_roadmap": {
    "month_1_3": {
      "focus": "What to build/do",
      "deliverables": ["Specific outputs"],
      "team_needed": ["Roles required"],
      "budget": "$X",
      "success_criteria": "How to measure"
    },
    "month_4_6": "Similar structure",
    "month_7_12": "Similar structure",
    "key_decision_points": [
      {
        "when": "Month X",
        "decision": "What to decide",
        "criteria": "How to decide",
        "alternatives": ["Option A", "Option B"]
      }
    ]
  },
  
  "technology_strategy": {
    "recommended_stack": {
      "frontend": "Tech choice with reasoning",
      "backend": "Tech choice with reasoning",
      "database": "Tech choice with reasoning",
      "infrastructure": "Cloud provider with reasoning"
    },
    "technical_debt_prevention": "How to avoid technical debt",
    "scalability_plan": "How to scale from 100 to 100,000 users",
    "security_requirements": ["Critical security measures"]
  },
  
  "final_recommendation": {
    "verdict": "STRONG GO/GO/PROCEED WITH CAUTION/PIVOT/NO-GO",
    "confidence_level": "high/medium/low",
    "key_success_factors": ["Factor 1", "Factor 2", "Factor 3"],
    "critical_assumptions": ["Assumption 1", "Assumption 2"],
    "next_immediate_steps": [
      {
        "step": "Specific action",
        "owner": "Who does it",
        "deadline": "When",
        "cost": "$X",
        "output": "Expected result"
      }
    ],
    "probability_of_success": "X% with reasoning"
  }
}

BE BRUTALLY HONEST. BE SPECIFIC. USE REAL DATA. PROVIDE ACTIONABLE INSIGHTS.`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.tier === 'premium' ? 16000 : 8000,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0].text;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        analysis._meta = {
          analyzed_at: new Date().toISOString(),
          tier: this.tier,
          used_real_data: !!researchData,
          season: this.getCurrentSeason(),
          market_momentum: this.getMarketMomentum()
        };
        return analysis;
      }
      
      throw new Error('Failed to parse strategy analysis');
      
    } catch (error) {
      console.error('❌ Strategy Agent Ultra Error:', error);
      throw new Error(`Strategy analysis failed: ${error.message}`);
    }
  }

  async generateBusinessPlanUltra(validationData, ideaDescription, researchData) {
    console.log('📄 Generating comprehensive business plan...');

    if (this.tier === 'free') {
      return {
        message: "Business plan generation requires Starter tier or higher",
        upgrade_url: "/pricing"
      };
    }

    const prompt = `Create a PROFESSIONAL, INVESTOR-READY business plan based on this validated idea.

IDEA: ${ideaDescription}
VALIDATION DATA: ${JSON.stringify(validationData, null, 2)}
RESEARCH DATA: ${JSON.stringify(researchData, null, 2)}

Generate a complete business plan with:

1. EXECUTIVE SUMMARY (2 pages)
   - Mission & Vision
   - Problem Statement
   - Solution Overview
   - Market Opportunity ($X TAM)
   - Competitive Advantage
   - Financial Highlights
   - Funding Request

2. COMPANY DESCRIPTION
   - Company Overview
   - Legal Structure
   - Location & Facilities
   - History & Milestones
   - Ownership

3. PRODUCTS & SERVICES
   - Detailed Product Description
   - Features & Benefits
   - Product Roadmap
   - Intellectual Property
   - R&D Strategy

4. MARKET ANALYSIS
   - Industry Overview
   - Target Market Definition
   - Market Size & Growth
   - Market Trends
   - Customer Segments

5. COMPETITIVE ANALYSIS
   - Competitor Landscape
   - Competitive Advantages
   - Market Positioning
   - SWOT Analysis

6. MARKETING & SALES STRATEGY
   - Go-to-Market Strategy
   - Customer Acquisition
   - Pricing Strategy
   - Sales Process
   - Marketing Channels
   - Customer Retention

7. OPERATIONS PLAN
   - Technology Infrastructure
   - Development Roadmap
   - Team Structure
   - Key Personnel
   - Advisors & Board

8. FINANCIAL PROJECTIONS
   - 3-Year Revenue Projections
   - Cost Structure
   - Break-even Analysis
   - Cash Flow Projections
   - Key Metrics & KPIs

9. FUNDING REQUEST
   - Capital Requirements
   - Use of Funds
   - Funding Timeline
   - Exit Strategy

10. APPENDICES
    - Market Research Data
    - Financial Statements
    - Team Bios
    - Legal Documents

Format as Markdown with proper sections, tables, and formatting.`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 16000,
        messages: [{ role: 'user', content: prompt }]
      });

      return {
        business_plan: response.content[0].text,
        generated_at: new Date().toISOString(),
        includes_research: !!researchData
      };
    } catch (error) {
      console.error('❌ Business Plan Generation Error:', error);
      throw error;
    }
  }

  getCurrentSeason() {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'Spring';
    if (month >= 5 && month <= 7) return 'Summer';
    if (month >= 8 && month <= 10) return 'Fall';
    return 'Winter';
  }

  getMarketMomentum() {
    const month = new Date().getMonth();
    if (month === 0 || month === 11) return 'Holiday season - high consumer spending';
    if (month >= 7 && month <= 8) return 'Back-to-school - education/productivity focus';
    if (month >= 2 && month <= 4) return 'Spring renewal - new beginnings';
    return 'Standard market conditions';
  }
}

module.exports = StrategyAgentUltra;