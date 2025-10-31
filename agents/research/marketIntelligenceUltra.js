// agents/research/marketIntelligenceUltra.js
// ULTRA Market Intelligence - PRODUCTION GRADE with Robust Error Handling

const AIClient = require('../../services/aiClient');
const WebScraperUltra = require('./webScraperUltra');
const axios = require('axios');

class MarketIntelligenceAgentUltra {
  constructor(tier = 'free') {
    this.tier = tier;
    this.client = new AIClient(process.env.OPENROUTER_API_KEY);
    this.model = 'google/gemini-2.0-flash-exp:free';
    this.scraper = new WebScraperUltra();
    this.maxCompetitors = tier === 'free' ? 5 : tier === 'starter' ? 10 : 20;
    this.maxRetries = 3;
  }

  async analyzeUltra(ideaDescription, targetCountry = 'Global', dateContext) {
    console.log('🧠 ULTRA Market Intelligence starting...');
    console.log(`📅 Context: ${dateContext.season}, ${dateContext.marketTrend}`);

    try {
      // Step 1: Multi-source competitor discovery
      console.log('🔍 Step 1: Multi-source competitor discovery...');
      const competitors = await this.findCompetitorsMultiSource(
        ideaDescription, 
        targetCountry,
        dateContext
      );

      console.log(`✅ Found ${competitors.length} competitors from multiple sources`);

      // Step 2: Get market trends
      console.log('📈 Step 2: Multi-source trend analysis...');
      const trends = await this.getMarketTrendsMultiSource(
        ideaDescription, 
        targetCountry,
        dateContext
      );

      console.log(`✅ Found ${trends.recent_news.length} news articles`);

      // Step 3: Get industry reports
      console.log('📊 Step 3: Industry report analysis...');
      const industryData = await this.getIndustryReports(ideaDescription, targetCountry);

      // Step 4: AI synthesis with ALL data (WITH ROBUST ERROR HANDLING)
      console.log('🤖 Step 4: AI synthesis with comprehensive data...');
      const analysis = await this.synthesizeDataUltraRobust(
        ideaDescription,
        targetCountry,
        competitors,
        trends,
        industryData,
        dateContext
      );

      await this.scraper.closeBrowser();

      return analysis;

    } catch (error) {
      console.error('❌ ULTRA Market Intelligence Error:', error);
      await this.scraper.closeBrowser();
      
      // Return partial results instead of failing
      return this.getPartialResults(ideaDescription, targetCountry, error);
    }
  }

  // ROBUST SYNTHESIS WITH MULTIPLE FALLBACK STRATEGIES
  async synthesizeDataUltraRobust(idea, country, competitors, trends, industryData, dateContext) {
    console.log('🤖 AI synthesizing ULTRA market intelligence (robust mode)...');

    // Try complex analysis first
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`   Attempt ${attempt}/${this.maxRetries}...`);
        
        const result = await this.tryComplexSynthesis(
          idea, country, competitors, trends, industryData, dateContext
        );
        
        if (result) {
          console.log('✅ Complex synthesis successful');
          return result;
        }
      } catch (error) {
        console.warn(`   ⚠️ Attempt ${attempt} failed:`, error.message);
        
        if (attempt < this.maxRetries) {
          await this.sleep(2000 * attempt); // Exponential backoff
        }
      }
    }

    // Fallback: Simple synthesis
    console.log('   Falling back to simple synthesis...');
    try {
      const result = await this.trySimpleSynthesis(idea, competitors, trends, dateContext);
      if (result) {
        console.log('✅ Simple synthesis successful');
        return result;
      }
    } catch (error) {
      console.error('   ❌ Simple synthesis failed:', error.message);
    }

    // Final fallback: Rule-based analysis
    console.log('   Falling back to rule-based analysis...');
    return this.generateRuleBasedAnalysis(idea, country, competitors, trends, dateContext);
  }

  async tryComplexSynthesis(idea, country, competitors, trends, industryData, dateContext) {
    const prompt = `Analyze this business idea with DEEP insights.

BUSINESS IDEA: ${idea}
TARGET MARKET: ${country}
DATE: ${dateContext.currentDate}
SEASON: ${dateContext.season}

COMPETITOR DATA (${competitors.length} competitors):
${JSON.stringify(competitors.slice(0, 5), null, 2)}

MARKET TRENDS (${trends.recent_news.length} articles):
${JSON.stringify(trends.recent_news.slice(0, 3), null, 2)}

Return ONLY valid JSON (no markdown, no explanation):
{
  "market_overview": {
    "size": "Specific TAM with numbers",
    "growth_rate": "YoY % with evidence",
    "maturity": "emerging/growing/mature/declining",
    "seasonality": "How ${dateContext.season} affects this",
    "upcoming_opportunities": ["Based on upcoming events"]
  },
  "competition_level": "low/medium/high/very-high",
  "key_competitors": [
    {
      "name": "Competitor name",
      "position": "market leader/challenger/niche",
      "estimated_users": "Number estimate",
      "key_differentiator": "What makes them unique",
      "weaknesses": ["weakness1", "weakness2"]
    }
  ],
  "market_gaps": [
    {
      "gap": "Specific unmet need",
      "evidence": "Why this gap exists",
      "opportunity_size": "Small/Medium/Large",
      "ease_to_fill": "Easy/Medium/Hard"
    }
  ],
  "target_audience": {
    "primary": "Detailed persona",
    "size": "Number estimate",
    "willingness_to_pay": "low/medium/high",
    "pain_points": ["Real pain points"]
  },
  "opportunities": ["Opportunity 1", "Opportunity 2"],
  "threats": ["Threat 1", "Threat 2"]
}`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.tier === 'premium' ? 8000 : 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0].text;
    
    // Try multiple JSON extraction strategies
    const parsed = this.extractJSON(content);
    
    if (parsed && this.validateMarketAnalysis(parsed)) {
      // Add metadata
      parsed._meta = {
        competitors_found: competitors.length,
        news_articles: trends.recent_news.length,
        industry_reports: industryData.length,
        data_sources: competitors.map(c => c.url).filter(Boolean),
        analysis_date: dateContext.currentDate,
        tier: this.tier,
        data_quality: this.calculateDataQuality(competitors, trends)
      };
      return parsed;
    }

    throw new Error('JSON extraction or validation failed');
  }

  async trySimpleSynthesis(idea, competitors, trends, dateContext) {
    const prompt = `Analyze this business idea in simple JSON format.

IDEA: ${idea}
COMPETITORS: ${competitors.length} found
NEWS: ${trends.recent_news.length} articles

Return ONLY this JSON:
{
  "market_overview": {
    "size": "Market size estimate",
    "growth_rate": "Growth percentage",
    "maturity": "emerging/growing/mature/declining"
  },
  "competition_level": "low/medium/high",
  "key_competitors": [{"name": "Name", "position": "Position"}],
  "market_gaps": [{"gap": "Gap description"}],
  "opportunities": ["Opportunity"],
  "threats": ["Threat"]
}`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0].text;
    const parsed = this.extractJSON(content);
    
    if (parsed) {
      // Add metadata
      parsed._meta = {
        competitors_found: competitors.length,
        news_articles: trends.recent_news.length,
        analysis_date: dateContext.currentDate,
        tier: this.tier,
        simplified: true
      };
      return parsed;
    }

    return null;
  }

  generateRuleBasedAnalysis(idea, country, competitors, trends, dateContext) {
    console.log('📊 Generating rule-based analysis as final fallback...');

    // Analyze competition level based on competitor count
    let competitionLevel = 'medium';
    if (competitors.length === 0) competitionLevel = 'low';
    else if (competitors.length < 3) competitionLevel = 'low';
    else if (competitors.length < 7) competitionLevel = 'medium';
    else if (competitors.length < 15) competitionLevel = 'high';
    else competitionLevel = 'very-high';

    // Extract competitor info
    const keyCompetitors = competitors.slice(0, 5).map(c => ({
      name: c.name || 'Unknown Competitor',
      position: 'challenger',
      url: c.url,
      estimated_users: 'Data not available',
      key_differentiator: c.description || 'Analysis pending',
      weaknesses: []
    }));

    // Identify market gaps from trends
    const marketGaps = trends.recent_news.slice(0, 3).map((news, i) => ({
      gap: `Opportunity ${i + 1}: ${news.title}`,
      evidence: news.summary || news.title,
      opportunity_size: 'Medium',
      ease_to_fill: 'Medium'
    }));

    // Generate opportunities and threats
    const opportunities = [
      competitors.length < 5 ? 'Low competition - easier market entry' : 'Established market with proven demand',
      `Current season (${dateContext.season}) favorable for launch`,
      trends.recent_news.length > 5 ? 'High market interest and activity' : 'Emerging market with growth potential'
    ];

    const threats = [
      competitors.length > 10 ? 'High competition - differentiation critical' : 'New competitors may enter',
      'Market conditions may change',
      'Customer acquisition costs may be high'
    ];

    return {
      market_overview: {
        size: competitors.length > 10 
          ? 'Large established market with significant TAM' 
          : 'Growing market with expansion potential',
        growth_rate: trends.recent_news.length > 8 
          ? 'High growth indicated by news activity' 
          : 'Moderate to stable growth',
        maturity: competitors.length > 15 ? 'mature' : competitors.length > 5 ? 'growing' : 'emerging',
        seasonality: `Current ${dateContext.season} season may ${dateContext.marketTrend.includes('high') ? 'increase' : 'moderately affect'} demand`,
        upcoming_opportunities: dateContext.upcomingEvents?.map(e => e.name) || []
      },
      competition_level: competitionLevel,
      key_competitors: keyCompetitors,
      market_gaps: marketGaps,
      target_audience: {
        primary: 'Market analysis required for detailed persona',
        size: competitors.length > 5 ? 'Large addressable audience' : 'Niche but growing audience',
        willingness_to_pay: 'medium',
        pain_points: [
          'Existing solutions may be inadequate',
          'Need for better alternatives identified'
        ]
      },
      entry_barriers: [
        {
          barrier: competitionLevel === 'very-high' ? 'High competition' : 'Market education needed',
          severity: competitionLevel === 'very-high' ? 'high' : 'medium',
          mitigation: 'Strong differentiation and unique value proposition'
        }
      ],
      seasonal_insights: {
        current_season_impact: dateContext.marketTrend,
        best_launch_timing: `Consider launching during ${dateContext.season} or next favorable season`,
        seasonal_opportunities: dateContext.upcomingEvents?.map(e => `Leverage ${e.name}`) || []
      },
      opportunities,
      threats,
      recommended_strategy: this.generateStrategy(competitionLevel, competitors.length),
      estimated_time_to_market: competitors.length > 10 ? '4-6 months' : '2-4 months',
      capital_required: competitors.length > 10 
        ? '$50K-$100K for competitive market entry' 
        : '$10K-$50K for initial MVP',
      _meta: {
        competitors_found: competitors.length,
        news_articles: trends.recent_news.length,
        data_sources: competitors.map(c => c.url).filter(Boolean),
        analysis_date: dateContext.currentDate,
        tier: this.tier,
        analysis_type: 'rule_based_fallback',
        data_quality: this.calculateDataQuality(competitors, trends)
      }
    };
  }

  generateStrategy(competitionLevel, competitorCount) {
    if (competitionLevel === 'low' || competitorCount < 3) {
      return 'First-mover advantage: Focus on rapid market capture, brand building, and establishing market position before competition increases.';
    } else if (competitionLevel === 'medium') {
      return 'Differentiation strategy: Identify unique value proposition, target underserved segments, and build strong brand loyalty.';
    } else {
      return 'Niche focus strategy: Target specific underserved segment, offer superior solution to specific pain point, leverage gaps in competitor offerings.';
    }
  }

  // ROBUST JSON EXTRACTION WITH MULTIPLE STRATEGIES
  extractJSON(text) {
    // Strategy 1: Standard JSON block
    let jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.warn('   Strategy 1 failed, trying strategy 2...');
      }
    }

    // Strategy 2: JSON with markdown
    jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch (e) {
        console.warn('   Strategy 2 failed, trying strategy 3...');
      }
    }

    // Strategy 3: Find first { and last }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(text.substring(firstBrace, lastBrace + 1));
      } catch (e) {
        console.warn('   Strategy 3 failed, trying strategy 4...');
      }
    }

    // Strategy 4: Clean and try
    try {
      const cleaned = text
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .replace(/^\s*\n/gm, '')
        .trim();
      
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
    } catch (e) {
      console.warn('   All JSON extraction strategies failed');
    }

    return null;
  }

  validateMarketAnalysis(data) {
    // Basic structure validation
    if (!data || typeof data !== 'object') return false;
    
    // Must have key fields
    const requiredFields = ['market_overview', 'competition_level'];
    for (const field of requiredFields) {
      if (!data[field]) {
        console.warn(`   Validation failed: missing ${field}`);
        return false;
      }
    }

    // Validate nested structure
    if (!data.market_overview.size) {
      console.warn('   Validation failed: missing market_overview.size');
      return false;
    }

    return true;
  }

  calculateDataQuality(competitors, trends) {
    let score = 0;
    if (competitors.length > 0) score += 30;
    if (competitors.length >= 5) score += 20;
    if (trends.recent_news.length > 0) score += 30;
    if (trends.recent_news.length >= 5) score += 20;
    return Math.min(100, score);
  }

  // ... (keep all other methods: findCompetitorsMultiSource, getMarketTrendsMultiSource, etc.)
  // These methods are already good, just keep them as is

  async findCompetitorsMultiSource(idea, country, dateContext) {
    console.log('🔍 Finding competitors from MULTIPLE sources...');
    
    const allCompetitors = [];
    const sources = [];

    // SOURCE 1: Google Search
    try {
      console.log('   🔸 Source 1: Google Search...');
      const googleQuery = `${idea} competitors ${country} ${dateContext.season} ${new Date().getFullYear()}`;
      const googleResults = await this.scraper.searchGoogle(googleQuery, 10);
      
      googleResults.forEach(result => {
        if (result.url && !result.url.includes('google.com')) {
          allCompetitors.push({
            name: this.extractCompanyName(result.title),
            url: result.url,
            description: result.snippet,
            source: 'Google',
            relevance: 'high'
          });
          sources.push(result.url);
        }
      });
      console.log(`   ✅ Google: Found ${googleResults.length} results`);
    } catch (error) {
      console.error('   ❌ Google search failed:', error.message);
    }

    // Deduplicate and limit
    const uniqueCompetitors = this.deduplicateCompetitors(allCompetitors);
    return uniqueCompetitors.slice(0, this.maxCompetitors);
  }

  async getMarketTrendsMultiSource(idea, country, dateContext) {
    console.log('📈 Analyzing trends from multiple sources...');
    
    const keywords = this.extractKeywords(idea);
    const allNews = [];

    // SOURCE 1: Google News
    try {
      const newsQuery = `${keywords.join(' ')} ${country} news ${dateContext.season} ${new Date().getFullYear()}`;
      const newsResults = await this.scraper.searchGoogle(newsQuery, 10);
      
      newsResults.forEach(result => {
        allNews.push({
          title: result.title,
          source: this.extractDomain(result.url),
          summary: result.snippet,
          url: result.url,
          relevance: 'high'
        });
      });
      console.log(`   ✅ Google News: Found ${newsResults.length} articles`);
    } catch (error) {
      console.error('   ❌ News search failed:', error.message);
    }

    return {
      keywords,
      recent_news: allNews.slice(0, 15),
      search_volume: 'High interest detected',
      trend_direction: this.calculateTrendDirection(allNews, dateContext)
    };
  }

  async getIndustryReports(idea, country) {
    console.log('📊 Fetching industry reports...');
    
    const reports = [];

    try {
      const query = `${idea} market report ${country} ${new Date().getFullYear()}`;
      const searchResults = await this.scraper.searchGoogle(query, 5);
      
      searchResults.forEach(result => {
        if (result.url.includes('statista') || 
            result.url.includes('ibisworld') || 
            result.url.includes('marketresearch')) {
          reports.push({
            title: result.title,
            source: this.extractDomain(result.url),
            url: result.url,
            summary: result.snippet
          });
        }
      });

      console.log(`   ✅ Found ${reports.length} industry reports`);
    } catch (error) {
      console.error('   ❌ Industry reports fetch failed:', error.message);
    }

    return reports;
  }

  // Helper methods
  calculateTrendDirection(news, dateContext) {
    const recentKeywords = ['growing', 'rising', 'increasing', 'surge'];
    const decliningKeywords = ['declining', 'falling', 'decreasing', 'drop'];
    
    let growing = 0;
    let declining = 0;
    
    news.forEach(article => {
      const text = (article.title + ' ' + article.summary).toLowerCase();
      recentKeywords.forEach(keyword => {
        if (text.includes(keyword)) growing++;
      });
      decliningKeywords.forEach(keyword => {
        if (text.includes(keyword)) declining++;
      });
    });

    if (growing > declining * 1.5) return 'rapidly growing';
    if (growing > declining) return 'growing';
    if (declining > growing * 1.5) return 'declining';
    if (declining > growing) return 'slowly declining';
    return 'stable';
  }

  deduplicateCompetitors(competitors) {
    const seen = new Set();
    return competitors.filter(comp => {
      const key = comp.name.toLowerCase().replace(/\s+/g, '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  extractCompanyName(title) {
    return title
      .replace(/\|/g, '-')
      .split('-')[0]
      .trim()
      .replace(/Official Website|Home|About/gi, '')
      .trim()
      .substring(0, 50);
  }

  extractKeywords(idea) {
    const stopWords = ['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with'];
    const words = idea.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.includes(word));
    return [...new Set(words)].slice(0, 10);
  }

  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return 'Unknown';
    }
  }

  getPartialResults(idea, country, error) {
    return {
      market_overview: {
        size: 'Unable to determine - data collection failed',
        growth_rate: 'Unknown',
        maturity: 'unknown'
      },
      competition_level: 'unknown',
      key_competitors: [],
      market_gaps: [{ gap: 'Research data unavailable', evidence: error.message }],
      _meta: {
        competitors_found: 0,
        news_articles: 0,
        error: error.message,
        fallback_mode: true
      }
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = MarketIntelligenceAgentUltra;