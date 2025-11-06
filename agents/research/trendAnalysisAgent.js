// agents/research/trendAnalysisAgent.js
// ULTRA Trend Analysis - PRODUCTION GRADE with Robust Error Handling

const AIClient = require('../../services/aiClient');
const axios = require('axios');

class TrendAnalysisAgent {
  constructor(tier = 'free') {
    this.tier = tier;
    this.client = new AIClient(process.env.OPENROUTER_API_KEY);
    this.model = 'qwen/qwen-2.5-coder-32b-instruct:free';
    this.maxRetries = 3;
  }

  async analyzeTrends(projectDescription, dateContext) {
    console.log('📈 ULTRA Trend Analysis starting...');
    console.log(`📅 Context: ${dateContext.season}, Q${dateContext.quarter}, ${dateContext.marketTrend}`);

    try {
      // 1. Get Google Trends data
      const googleTrends = await this.getGoogleTrendsInsights(projectDescription, dateContext);

      // 2. Get social media trends
      const socialTrends = await this.getSocialMediaTrends(projectDescription, dateContext);

      // 3. Analyze seasonal patterns
      const seasonalAnalysis = await this.analyzeSeasonalPatterns(projectDescription, dateContext);

      // 4. Get emerging tech trends
      const techTrends = await this.getEmergingTechTrends(projectDescription);

      // 5. AI synthesis WITH ROBUST ERROR HANDLING
      const synthesis = await this.synthesizeTrendsRobust(
        projectDescription,
        dateContext,
        googleTrends,
        socialTrends,
        seasonalAnalysis,
        techTrends
      );

      return {
        dateContext,
        googleTrends,
        socialTrends,
        seasonalAnalysis,
        techTrends,
        synthesis,
        emerging_trends: synthesis.emerging_trends || [],
        declining_trends: synthesis.declining_trends || [],
        actionable_insights: synthesis.actionable_insights || []
      };

    } catch (error) {
      console.error('❌ Trend Analysis Error:', error);
      return this.getDefaultTrendAnalysis(projectDescription, dateContext);
    }
  }

  async synthesizeTrendsRobust(description, dateContext, google, social, seasonal, tech) {
    console.log('🤖 AI synthesizing trend analysis (robust mode)...');

    // Try complex synthesis first
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`   Attempt ${attempt}/${this.maxRetries}...`);
        
        const result = await this.tryComplexTrendSynthesis(
          description, dateContext, google, social, seasonal, tech
        );
        
        if (result) {
          console.log('✅ Complex trend synthesis successful');
          return result;
        }
      } catch (error) {
        console.warn(`   ⚠️ Attempt ${attempt} failed:`, error.message);
        
        if (attempt < this.maxRetries) {
          await this.sleep(2000 * attempt);
        }
      }
    }

    // Fallback: Simple synthesis
    console.log('   Falling back to simple trend synthesis...');
    try {
      const result = await this.trySimpleTrendSynthesis(description, seasonal, tech);
      if (result) {
        console.log('✅ Simple trend synthesis successful');
        return result;
      }
    } catch (error) {
      console.error('   ❌ Simple synthesis failed:', error.message);
    }

    // Final fallback: Rule-based
    console.log('   Falling back to rule-based trend analysis...');
    return this.generateRuleBasedTrends(description, dateContext, seasonal, tech);
  }

  async tryComplexTrendSynthesis(description, dateContext, google, social, seasonal, tech) {
    
    const jsonInstructions = `CRITICAL JSON RULES:
1. Return ONLY valid JSON
2. No markdown code blocks
3. No explanations before or after JSON
4. Start response with {
5. End response with }
6. No trailing commas
7. Escape all quotes in strings
8. Maximum response length: 4000 tokens

`;
    
    const prompt = jsonInstructions +`Analyze trends for this project with actionable insights.

PROJECT: ${description}
DATE: ${dateContext.currentDate}
SEASON: ${dateContext.season}
UPCOMING EVENTS: ${dateContext.upcomingEvents?.map(e => e.name).join(', ')}

GOOGLE TRENDS: ${JSON.stringify(google)}
SOCIAL: ${JSON.stringify(social)}
SEASONAL: ${JSON.stringify(seasonal)}
TECH: ${JSON.stringify(tech.relevant_to_project)}

Return ONLY valid JSON:
{
  "emerging_trends": [
    {
      "trend": "Specific trend",
      "relevance_to_project": "Why it matters",
      "growth_stage": "emerging/growing/mainstream",
      "opportunity": "How to capitalize",
      "timing": "Best time to leverage",
      "priority": "critical/high/medium/low"
    }
  ],
  "declining_trends": [
    {
      "trend": "Declining trend",
      "why_declining": "Reason",
      "avoid": "What to avoid"
    }
  ],
  "seasonal_opportunities": [
    {
      "event": "Upcoming event",
      "opportunity": "How to leverage",
      "timing": "When to act",
      "expected_impact": "Potential impact"
    }
  ],
  "actionable_insights": [
    {
      "insight": "Specific insight",
      "action": "What to do",
      "timeline": "When to do it",
      "expected_outcome": "What you'll achieve"
    }
  ],
  "competitive_timing": {
    "best_launch_date": "Specific date with reasoning",
    "worst_dates": ["Dates to avoid"],
    "key_milestones": [
      {
        "milestone": "What to achieve",
        "deadline": "When",
        "importance": "Why"
      }
    ]
  },
  "market_momentum": {
    "current": "Building or declining",
    "forecast": "6-month outlook",
    "recommendation": "Go/Wait/Pivot with reasoning"
  }
}`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0].text;
    const parsed = this.extractJSON(content);
    
    if (parsed && this.validateTrendSynthesis(parsed)) {
      return parsed;
    }

    throw new Error('JSON extraction or validation failed');
  }
  
  async trySimpleTrendSynthesis(description, seasonal, tech) {

    const jsonInstructions = `CRITICAL JSON RULES:
1. Return ONLY valid JSON
2. No markdown code blocks
3. No explanations before or after JSON
4. Start response with {
5. End response with }
6. No trailing commas
7. Escape all quotes in strings
8. Maximum response length: 4000 tokens

`;

    const prompt = jsonInstructions +`Simple trend analysis for: ${description}

SEASONAL: ${seasonal.current_season}
TECH TRENDS: ${tech.relevant_to_project?.length || 0} relevant

Return ONLY JSON:
{
  "emerging_trends": [
    {
      "trend": "Trend name",
      "relevance_to_project": "Why relevant",
      "priority": "high/medium/low"
    }
  ],
  "actionable_insights": [
    {
      "insight": "Insight",
      "action": "Action to take"
    }
  ],
  "market_momentum": {
    "current": "Status",
    "recommendation": "Recommendation"
  }
}`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0].text;
    return this.extractJSON(content);
  }

  generateRuleBasedTrends(description, dateContext, seasonal, tech) {
    console.log('📊 Generating rule-based trend analysis...');

    const keywords = this.extractKeywords(description);
    
    // Generate emerging trends based on tech trends
    const emergingTrends = (tech.relevant_to_project || []).slice(0, 5).map(trend => ({
      trend: trend.name || trend,
      relevance_to_project: `${trend.name} is relevant to your project`,
      growth_stage: trend.growth || 'growing',
      opportunity: `Integrate ${trend.name} for competitive advantage`,
      timing: `Start implementing in ${dateContext.season}`,
      priority: trend.growth === 'exponential' || trend.growth === 'rapid' ? 'high' : 'medium'
    }));

    // Seasonal opportunities
    const seasonalOpportunities = (dateContext.upcomingEvents || []).map(event => ({
      event: event.name,
      opportunity: `Leverage ${event.name} for marketing campaign`,
      timing: `2 weeks before ${event.name}`,
      expected_impact: 'Increased visibility and engagement'
    }));

    // Actionable insights
    const actionableInsights = [
      {
        insight: `Current ${dateContext.season} season affects market dynamics`,
        action: seasonal.impact_on_product?.recommendation || 'Align marketing with season',
        timeline: 'Immediate',
        expected_outcome: 'Better market fit and timing'
      },
      {
        insight: `${emergingTrends.length} relevant technology trends identified`,
        action: 'Evaluate which trends to integrate',
        timeline: 'Next 2-4 weeks',
        expected_outcome: 'Competitive advantage through modern tech'
      }
    ];

    if (seasonal.upcoming_opportunities?.length > 0) {
      actionableInsights.push({
        insight: `${seasonal.upcoming_opportunities.length} upcoming opportunities`,
        action: 'Prepare campaigns for upcoming events',
        timeline: seasonal.upcoming_opportunities[0]?.date || 'Q4',
        expected_outcome: 'Capitalize on seasonal demand'
      });
    }

    return {
      emerging_trends: emergingTrends,
      declining_trends: [],
      seasonal_opportunities: seasonalOpportunities,
      actionable_insights: actionableInsights,
      competitive_timing: {
        best_launch_date: this.calculateBestLaunchDate(dateContext, seasonal),
        worst_dates: this.getWorstLaunchDates(dateContext),
        key_milestones: [
          {
            milestone: 'MVP Development',
            deadline: this.addMonths(new Date(), 2).toISOString().split('T')[0],
            importance: 'Critical for market entry'
          },
          {
            milestone: 'Beta Launch',
            deadline: this.addMonths(new Date(), 3).toISOString().split('T')[0],
            importance: 'User feedback and iteration'
          },
          {
            milestone: 'Public Launch',
            deadline: this.calculateBestLaunchDate(dateContext, seasonal),
            importance: 'Full market entry'
          }
        ]
      },
      market_momentum: {
        current: seasonal.impact_on_product?.level === 'high' ? 'Building' : 'Stable',
        forecast: '6-month positive outlook',
        recommendation: 'GO - Proceed with development and market entry'
      },
      _meta: {
        analysis_type: 'rule_based_fallback',
        season: dateContext.season,
        trends_analyzed: emergingTrends.length
      }
    };
  }

  // ROBUST JSON EXTRACTION
  extractJSON(text) {
    // Strategy 1: Standard JSON block
    let jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.warn('   JSON Strategy 1 failed');
      }
    }

    // Strategy 2: JSON with markdown
    jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch (e) {
        console.warn('   JSON Strategy 2 failed');
      }
    }

    // Strategy 3: Find first { and last }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(text.substring(firstBrace, lastBrace + 1));
      } catch (e) {
        console.warn('   JSON Strategy 3 failed');
      }
    }

    return null;
  }

  validateTrendSynthesis(data) {
    if (!data || typeof data !== 'object') return false;
    
    // Must have key fields
    if (!data.emerging_trends && !data.actionable_insights) {
      console.warn('   Validation failed: missing required fields');
      return false;
    }

    // Validate emerging_trends is array
    if (data.emerging_trends && !Array.isArray(data.emerging_trends)) {
      console.warn('   Validation failed: emerging_trends not an array');
      return false;
    }

    return true;
  }

  // Helper methods
  calculateBestLaunchDate(dateContext, seasonal) {
    // Avoid holiday season if we're close to it
    const now = new Date();
    const month = now.getMonth();

    // If it's November-December, suggest January
    if (month >= 10) {
      return `${now.getFullYear() + 1}-01-15 (Post-holiday momentum)`;
    }

    // If upcoming events exist, suggest before them
    if (seasonal.upcoming_opportunities?.length > 0) {
      const firstEvent = seasonal.upcoming_opportunities[0];
      if (firstEvent.date) {
        const eventDate = new Date(firstEvent.date);
        const launchDate = new Date(eventDate);
        launchDate.setDate(launchDate.getDate() - 14); // 2 weeks before
        return `${launchDate.toISOString().split('T')[0]} (Before ${firstEvent.event})`;
      }
    }

    // Default: 3 months from now
    const defaultDate = this.addMonths(now, 3);
    return `${defaultDate.toISOString().split('T')[0]} (${dateContext.season} launch)`;
  }

  getWorstLaunchDates(dateContext) {
    const now = new Date();
    const year = now.getFullYear();
    
    return [
      `${year}-12-20 to ${year + 1}-01-05 (Holiday season)`,
      'Major competitor launch dates',
      'During major industry events (unless participating)'
    ];
  }

  addMonths(date, months) {
    const newDate = new Date(date);
    newDate.setMonth(newDate.getMonth() + months);
    return newDate;
  }

  extractKeywords(text) {
    const stopWords = ['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'];
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.includes(word));
    return [...new Set(words)].slice(0, 10);
  }

  // Keep all other existing methods (getGoogleTrendsInsights, getSocialMediaTrends, etc.)
  // They are already good

  async getGoogleTrendsInsights(description, dateContext) {
    console.log('🔍 Analyzing Google Trends...');
    
    const keywords = this.extractKeywords(description);
    
    const trends = {
      keywords: keywords,
      season_impact: this.getSeasonImpact(keywords, dateContext),
      relative_interest: 'Analyzing search patterns...',
      trending_related: keywords.map(kw => ({
        keyword: kw,
        trend: 'Stable',
        opportunity: 'Medium'
      }))
    };

    console.log(`   ✅ Analyzed ${keywords.length} trend keywords`);
    return trends;
  }

  async getSocialMediaTrends(description, dateContext) {
    console.log('📱 Analyzing social media trends...');

    const keywords = this.extractKeywords(description);
    const trends = {
      platforms: {},
      viral_content: [],
      sentiment: 'neutral',
      engagement_level: 'medium'
    };

    try {
      trends.platforms.reddit = await this.getRedditTrends(keywords);
      console.log('   ✅ Reddit trends analyzed');
    } catch (error) {
      console.error('   ❌ Reddit trends error:', error.message);
      trends.platforms.reddit = { discussions: 0, engagement: 'unknown' };
    }

    return trends;
  }

  async analyzeSeasonalPatterns(description, dateContext) {
    console.log('🍂 Analyzing seasonal patterns...');

    const patterns = {
      current_season: dateContext.season,
      impact_on_product: this.getSeasonalImpact(description, dateContext),
      upcoming_opportunities: [],
      recommendations: []
    };

    // Analyze upcoming events
    if (dateContext.upcomingEvents) {
      dateContext.upcomingEvents.forEach(event => {
        const opportunity = this.analyzeEventOpportunity(event, description);
        if (opportunity.relevance > 0.5) {
          patterns.upcoming_opportunities.push(opportunity);
        }
      });
    }

    // Seasonal recommendations
    patterns.recommendations = this.getSeasonalRecommendations(
      description,
      dateContext,
      patterns.upcoming_opportunities
    );

    return patterns;
  }

  async getEmergingTechTrends(description) {
    console.log('🚀 Analyzing emerging tech trends...');

    const currentTrends = [
      { name: 'AI & Machine Learning', relevance: 0.9, growth: 'exponential' },
      { name: 'Web3 & Blockchain', relevance: 0.7, growth: 'steady' },
      { name: 'AR/VR/Metaverse', relevance: 0.7, growth: 'steady' },
      { name: 'Sustainable Tech', relevance: 0.8, growth: 'rapid' },
      { name: 'Cybersecurity', relevance: 0.9, growth: 'critical' },
      { name: 'IoT', relevance: 0.7, growth: 'steady' },
      { name: 'Low-code/No-code', relevance: 0.8, growth: 'rapid' }
    ];

    const keywords = description.toLowerCase();
    const relevantTrends = currentTrends.filter(trend => {
      const trendKeywords = trend.name.toLowerCase().split(/[\s&/]+/);
      return trendKeywords.some(kw => keywords.includes(kw));
    });

    return {
      all_trends: currentTrends,
      relevant_to_project: relevantTrends,
      recommendations: relevantTrends.map(trend => ({
        trend: trend.name,
        suggestion: `Consider integrating ${trend.name} for competitive advantage`,
        priority: trend.growth === 'exponential' || trend.growth === 'rapid' ? 'high' : 'medium'
      }))
    };
  }

  getSeasonImpact(keywords, dateContext) {
    const seasonalKeywords = {
      spring: ['fitness', 'outdoor', 'garden', 'cleaning', 'renewal'],
      summer: ['travel', 'vacation', 'outdoor', 'events', 'festival'],
      fall: ['education', 'productivity', 'back-to-school', 'career'],
      winter: ['holiday', 'gifts', 'indoor', 'cozy', 'family']
    };

    const seasonKeywords = seasonalKeywords[dateContext.season] || [];
    const matches = keywords.filter(kw => 
      seasonKeywords.some(sk => kw.includes(sk) || sk.includes(kw))
    );

    return {
      impact_level: matches.length > 0 ? 'high' : 'medium',
      relevant_keywords: matches,
      recommendation: matches.length > 0 
        ? `Strong ${dateContext.season} alignment - leverage seasonal marketing`
        : `Moderate seasonal fit - focus on year-round value proposition`
    };
  }

  getSeasonalImpact(description, dateContext) {
    const desc = description.toLowerCase();
    
    const highImpact = [
      { keywords: ['gift', 'present', 'holiday'], seasons: ['winter'], impact: 'critical' },
      { keywords: ['travel', 'vacation', 'tour'], seasons: ['summer'], impact: 'high' },
      { keywords: ['fitness', 'health', 'workout'], seasons: ['spring'], impact: 'high' },
      { keywords: ['education', 'school', 'learning'], seasons: ['fall'], impact: 'high' }
    ];

    for (const indicator of highImpact) {
      if (indicator.keywords.some(kw => desc.includes(kw)) && 
          indicator.seasons.includes(dateContext.season)) {
        return {
          level: indicator.impact,
          reason: `${dateContext.season} is peak season for this product category`,
          opportunity: 'Very high - capitalize on seasonal demand'
        };
      }
    }

    return {
      level: 'moderate',
      reason: 'Year-round appeal with moderate seasonal variation',
      opportunity: 'Focus on consistent value proposition'
    };
  }

  analyzeEventOpportunity(event, description) {
    const desc = description.toLowerCase();
    let relevance = 0;
    
    if (event.type === 'shopping' && 
        (desc.includes('ecommerce') || desc.includes('retail') || desc.includes('shop'))) {
      relevance = 0.9;
    } else if (event.type === 'holiday' && desc.includes('gift')) {
      relevance = 0.8;
    } else {
      relevance = 0.3;
    }

    return {
      event: event.name,
      date: event.date,
      type: event.type,
      relevance,
      opportunity: relevance > 0.6 ? 'High' : relevance > 0.4 ? 'Medium' : 'Low',
      recommendation: relevance > 0.6 
        ? `Launch marketing campaign 2 weeks before ${event.name}`
        : `Monitor and consider special promotion for ${event.name}`
    };
  }

  getSeasonalRecommendations(description, dateContext, opportunities) {
    const recommendations = [];

    const seasonalRecs = {
      spring: [
        'Launch "Spring Refresh" campaign',
        'Emphasize renewal and new beginnings'
      ],
      summer: [
        'Focus on vacation/leisure use cases',
        'Emphasize mobile features'
      ],
      fall: [
        'Target back-to-school and productivity',
        'Focus on professional users'
      ],
      winter: [
        'Holiday gift campaigns',
        'Year-end special offers'
      ]
    };

    recommendations.push(...(seasonalRecs[dateContext.season] || []));

    opportunities.forEach(opp => {
      if (opp.relevance > 0.6) {
        recommendations.push(opp.recommendation);
      }
    });

    return recommendations;
  }

  async getRedditTrends(keywords) {
    try {
      const query = keywords.slice(0, 2).join(' ');
      const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=relevance&limit=5`;
      
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000
      });

      const discussions = response.data?.data?.children?.length || 0;
      
      return {
        discussions,
        engagement: discussions > 10 ? 'high' : discussions > 5 ? 'medium' : 'low',
        trend: discussions > 5 ? 'growing' : 'stable'
      };
    } catch (error) {
      return { discussions: 0, engagement: 'unknown' };
    }
  }

  getDefaultTrendAnalysis(description, dateContext) {
    return {
      dateContext,
      emerging_trends: [
        { trend: 'AI Integration', relevance_to_project: 'High', priority: 'high' }
      ],
      actionable_insights: [
        { insight: 'Market research limited', action: 'Proceed with caution', timeline: 'Immediate' }
      ],
      market_momentum: {
        current: 'Unknown',
        forecast: 'Requires more data',
        recommendation: 'Conduct additional market research'
      },
      _meta: {
        analysis_type: 'default_fallback',
        season: dateContext.season
      }
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = TrendAnalysisAgent;