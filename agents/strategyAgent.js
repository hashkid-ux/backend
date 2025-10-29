//const Anthropic = require('@anthropic-ai/sdk');
const AIClient = require('../services/aiClient');


class StrategyAgent {
  constructor(tier = 'free') {
    this.tier = tier;
    this.client = new AIClient(process.env.OPENROUTER_API_KEY);

    
    // Model selection based on tier
    this.model = 'deepseek/deepseek-chat-v3.1:free';

  }

  async validateIdea(ideaDescription, targetMarket, budget) {
    const prompt = `You are a strategic business consultant analyzing startup ideas. 

BUSINESS IDEA: ${ideaDescription}
TARGET MARKET: ${targetMarket}
BUDGET: ${budget}

Provide a comprehensive analysis in JSON format:

{
  "viability_score": 0-100,
  "market_size": {
    "tam": "Total Addressable Market estimate",
    "sam": "Serviceable Addressable Market estimate",
    "som": "Serviceable Obtainable Market estimate"
  },
  "competitors": [
    {
      "name": "Competitor name",
      "strengths": ["strength1", "strength2"],
      "weaknesses": ["weakness1", "weakness2"],
      "market_share": "estimated %"
    }
  ],
  "unique_value_proposition": "What makes this different",
  "target_audience": {
    "primary_persona": "Description",
    "demographics": "Age, location, income",
    "pain_points": ["pain1", "pain2", "pain3"]
  },
  "risks": [
    {
      "risk": "Risk description",
      "severity": "high/medium/low",
      "mitigation": "How to address"
    }
  ],
  "revenue_potential": {
    "year_1": "Estimate with reasoning",
    "year_2": "Estimate with reasoning",
    "year_3": "Estimate with reasoning"
  },
  "go_to_market_strategy": {
    "channels": ["channel1", "channel2"],
    "customer_acquisition_cost": "Estimate",
    "lifetime_value": "Estimate"
  },
  "recommendation": "clear go/no-go recommendation with reasoning"
}

Be realistic, data-driven, and honest. If the idea has fatal flaws, say so clearly.`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.tier === 'premium' ? 8000 : 4000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const content = response.content[0].text;
      
      // Extract JSON from response (Claude sometimes wraps it in markdown)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      throw new Error('Failed to parse strategy analysis');
      
    } catch (error) {
      console.error('Strategy Agent Error:', error);
      throw new Error(`Strategy analysis failed: ${error.message}`);
    }
  }

  async generateBusinessPlan(validationData, ideaDescription) {
    if (this.tier === 'free') {
      return {
        message: "Business plan generation is available in Starter tier and above",
        upgrade_url: "/pricing"
      };
    }

    const prompt = `Based on this validated business idea, create a comprehensive business plan:

IDEA: ${ideaDescription}
VALIDATION DATA: ${JSON.stringify(validationData, null, 2)}

Create a detailed business plan covering:
1. Executive Summary
2. Company Description
3. Market Analysis
4. Organization & Management
5. Service/Product Line
6. Marketing & Sales Strategy
7. Financial Projections (3 years)
8. Funding Requirements
9. Risk Analysis
10. Implementation Timeline

Format as a professional document with clear sections.`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 16000,
        messages: [{ role: 'user', content: prompt }]
      });

      return {
        business_plan: response.content[0].text,
        generated_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('Business Plan Generation Error:', error);
      throw error;
    }
  }
}

module.exports = StrategyAgent;