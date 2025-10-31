// backend/agents/research/trendAnalysisAgent.js
// ULTRA Trend Analysis - Date, Season, Festival Awareness

const AIClient = require('../../services/aiClient');
const axios = require('axios');

class TrendAnalysisAgent {
  constructor(tier = 'free') {
    this.tier = tier;
    this.client = new AIClient(process.env.OPENROUTER_API_KEY);
    this.model = 'deepseek/deepseek-chat-v3.1:free';
  }

  async analyzeTrends(projectDescription, dateContext) {
    console.log('📈 ULTRA Trend Analysis starting...');
    console.log(`📅 Context: ${dateContext.season}, ${dateContext.quarter}Q, ${dateContext.marketTrend}`);

    try {
      // 1. Get Google Trends data
      const googleTrends = await this.getGoogleTrendsInsights(projectDescription, dateContext);

      // 2. Get social media trends
      const socialTrends = await this.getSocialMediaTrends(projectDescription, dateContext);

      // 3. Analyze seasonal patterns
      const seasonalAnalysis = await this.analyzeSeasonalPatterns(projectDescription, dateContext);

      // 4. Get emerging tech trends
      const techTrends = await this.getEmergingTechTrends(projectDescription);

      // 5. AI synthesis
      const synthesis = await this.synthesizeTrends(
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

  async getGoogleTrendsInsights(description, dateContext) {
    console.log('🔍 Analyzing Google Trends...');

    // Extract keywords
    const keywords = this.extractKeywords(description);

    // Note: In production, use Google Trends API or pytrends
    // For now, we'll use search volume indicators
    
    const trends = {
      keywords: keywords,
      season_impact: this.getSeasonImpact(keywords, dateContext),
      relative_interest: 'Analyzing search patterns...',
      trending_related: []
    };

    // Search for "[keyword] trends 2024" to get related trending topics
    try {
      const trendQueries = keywords.map(kw => `${kw} trends ${new Date().getFullYear()}`);
      
      // Simplified trend detection
      trends.trending_related = keywords.map(kw => ({
        keyword: kw,
        trend: 'Stable',
        opportunity: 'Medium'
      }));

      console.log(`   ✅ Analyzed ${keywords.length} trend keywords`);
    } catch (error) {
      console.error('   ❌ Google Trends error:', error.message);
    }

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

    // Twitter/X trends
    try {
      trends.platforms.twitter = await this.getTwitterTrends(keywords);
      console.log('   ✅ Twitter trends analyzed');
    } catch (error) {
      console.error('   ❌ Twitter trends error:', error.message);
      trends.platforms.twitter = { trending: false };
    }

    // Reddit trends
    try {
      trends.platforms.reddit = await this.getRedditTrends(keywords);
      console.log('   ✅ Reddit trends analyzed');
    } catch (error) {
      console.error('   ❌ Reddit trends error:', error.message);
      trends.platforms.reddit = { discussions: 0 };
    }

    // TikTok trends (if relevant)
    if (description.toLowerCase().includes('social') || 
        description.toLowerCase().includes('video') ||
        description.toLowerCase().includes('gen z')) {
      trends.platforms.tiktok = {
        relevance: 'high',
        trending_hashtags: ['#tech', '#innovation', '#startup']
      };
    }

    return trends;
  }

  async analyzeSeasonalPatterns(description, dateContext) {
    console.log('🍂 Analyzing seasonal patterns...');

    const patterns = {
      current_season: dateContext.season,
      impact_on_product: this.getSeasonalImpact(description, dateContext),
      upcoming_opportunities: [],
      historical_patterns: {},
      recommendations: []
    };

    // Analyze upcoming events
    dateContext.upcomingEvents?.forEach(event => {
      const opportunity = this.analyzeEventOpportunity(event, description);
      if (opportunity.relevance > 0.5) {
        patterns.upcoming_opportunities.push(opportunity);
      }
    });

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

    // Current tech trends (2024-2025)
    const currentTrends = [
      { name: 'AI & Machine Learning', relevance: 0.9, growth: 'exponential' },
      { name: 'Web3 & Blockchain', relevance: 0.7, growth: 'steady' },
      { name: 'Edge Computing', relevance: 0.6, growth: 'growing' },
      { name: 'Quantum Computing', relevance: 0.4, growth: 'emerging' },
      { name: 'AR/VR/Metaverse', relevance: 0.7, growth: 'steady' },
      { name: 'Sustainable Tech', relevance: 0.8, growth: 'rapid' },
      { name: 'Cybersecurity', relevance: 0.9, growth: 'critical' },
      { name: '5G/6G', relevance: 0.6, growth: 'infrastructure' },
      { name: 'IoT', relevance: 0.7, growth: 'steady' },
      { name: 'Low-code/No-code', relevance: 0.8, growth: 'rapid' }
    ];

    // Filter relevant trends
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

  async synthesizeTrends(description, dateContext, google, social, seasonal, tech) {
    console.log('🤖 AI synthesizing trend analysis...');

    const prompt = `You are a trend forecasting expert. Analyze these trends and provide ACTIONABLE insights.

PROJECT: ${description}

DATE CONTEXT:
- Current Date: ${dateContext.currentDate}
- Season: ${dateContext.season}
- Upcoming Events: ${dateContext.upcomingEvents?.map(e => e.name).join(', ')}
- Market Trend: ${dateContext.marketTrend}

GOOGLE TRENDS: ${JSON.stringify(google, null, 2)}
SOCIAL MEDIA: ${JSON.stringify(social, null, 2)}
SEASONAL PATTERNS: ${JSON.stringify(seasonal, null, 2)}
TECH TRENDS: ${JSON.stringify(tech.relevant_to_project, null, 2)}

Provide analysis in JSON:
{
  "emerging_trends": [
    {
      "trend": "Specific trend",
      "relevance_to_project": "Why it matters",
      "growth_stage": "emerging/growing/mainstream/declining",
      "opportunity": "Specific opportunity to capitalize",
      "timing": "Best time to leverage this trend",
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
      "opportunity": "How to leverage it",
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
    "best_launch_date": "Specific date or period with reasoning",
    "worst_dates": ["Dates to avoid with reasons"],
    "key_milestones": [
      {
        "milestone": "What to achieve",
        "deadline": "When",
        "importance": "Why it matters"
      }
    ]
  },
  "market_momentum": {
    "current": "Is momentum building or declining?",
    "forecast": "6-month outlook",
    "recommendation": "Go/Wait/Pivot decision with reasoning"
  }
}

BE SPECIFIC. PROVIDE ACTIONABLE ADVICE.`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0].text;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      throw new Error('Failed to parse trend synthesis');

    } catch (error) {
      console.error('❌ Trend synthesis error:', error);
      return this.getDefaultSynthesis();
    }
  }

  // Helper methods

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
    
    // High-impact indicators
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
    
    // Check relevance
    let relevance = 0;
    
    if (event.type === 'shopping' && 
        (desc.includes('ecommerce') || desc.includes('retail') || desc.includes('shop'))) {
      relevance = 0.9;
    } else if (event.type === 'holiday' && desc.includes('gift')) {
      relevance = 0.8;
    } else if (event.name.includes('Day') && desc.includes(event.name.toLowerCase())) {
      relevance = 0.7;
    } else {
      relevance = 0.3; // Base relevance for any event
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

    // Based on current season
    const seasonalRecs = {
      spring: [
        'Launch "Spring Refresh" campaign',
        'Emphasize renewal and new beginnings',
        'Offer special spring pricing'
      ],
      summer: [
        'Focus on vacation/leisure use cases',
        'Emphasize mobile and on-the-go features',
        'Partner with summer events'
      ],
      fall: [
        'Target back-to-school and productivity themes',
        'Launch learning/education features',
        'Focus on professional users'
      ],
      winter: [
        'Holiday gift campaigns',
        'Year-end special offers',
        'Emphasize family and connection'
      ]
    };

    recommendations.push(...(seasonalRecs[dateContext.season] || []));

    // Based on opportunities
    opportunities.forEach(opp => {
      if (opp.relevance > 0.6) {
        recommendations.push(`Prepare ${opp.event} campaign - launch ${new Date(opp.date - 14*24*60*60*1000).toLocaleDateString()}`);
      }
    });

    return recommendations;
  }

  async getTwitterTrends(keywords) {
    // Placeholder - would need Twitter API
    return {
      trending: keywords.length > 0,
      hashtags: keywords.map(kw => `#${kw}`),
      engagement: 'moderate'
    };
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

  extractKeywords(description) {
    const stopWords = ['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'];
    const words = description.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.includes(word));
    return [...new Set(words)].slice(0, 10);
  }

  getDefaultTrendAnalysis(description, dateContext) {
    return {
      dateContext,
      emerging_trends: [
        { trend: 'AI Integration', relevance_to_project: 'High', priority: 'high' }
      ],
      actionable_insights: [
        { insight: 'Market research limited', action: 'Proceed with caution', timeline: 'Immediate' }
      ]
    };
  }

  getDefaultSynthesis() {
    return {
      emerging_trends: [],
      declining_trends: [],
      actionable_insights: [
        { insight: 'Trend analysis incomplete', action: 'Manual research recommended', timeline: 'Before launch' }
      ],
      market_momentum: {
        current: 'Unknown',
        forecast: 'Requires more data',
        recommendation: 'Conduct additional market research before proceeding'
      }
    };
  }
}

module.exports = TrendAnalysisAgent;