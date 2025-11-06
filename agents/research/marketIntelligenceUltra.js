// agents/research/marketIntelligenceUltra.js
// BULLETPROOF Market Intelligence with Enhanced JSON Parsing

const AIClient = require('../../services/aiClient');
const WebScraperUltra = require('./webScraperUltra');

class MarketIntelligenceAgentUltra {
  constructor(tier = 'free') {
    this.tier = tier;
    this.client = new AIClient(process.env.OPENROUTER_API_KEY);
    this.model = 'qwen/qwen-2.5-coder-32b-instruct:free';
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
      await this.sleep(3000); // Cooldown between steps

      // Step 2: Get market trends
      console.log('📈 Step 2: Multi-source trend analysis...');
      const trends = await this.getMarketTrendsMultiSource(
        ideaDescription, 
        targetCountry,
        dateContext
      );

      console.log(`✅ Found ${trends.recent_news.length} news articles`);
      await this.sleep(3000); // Cooldown

      // Step 3: Get industry reports
      console.log('📊 Step 3: Industry report analysis...');
      const industryData = await this.getIndustryReports(ideaDescription, targetCountry);
      await this.sleep(3000); // Cooldown

      // Step 4: AI synthesis with BULLETPROOF JSON parsing
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

  // BULLETPROOF SYNTHESIS with Multiple JSON Extraction Strategies
  async synthesizeDataUltraRobust(idea, country, competitors, trends, industryData, dateContext) {
    console.log('🤖 AI synthesizing market intelligence (BULLETPROOF)...');

    // Try progressively simpler approaches
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`   Synthesis attempt ${attempt}/${this.maxRetries}...`);
        
        if (attempt === 1) {
          // Try comprehensive synthesis
          const result = await this.tryComprehensiveSynthesis(
            idea, country, competitors, trends, industryData, dateContext
          );
          if (result) {
            console.log('✅ Comprehensive synthesis successful');
            return result;
          }
        } else if (attempt === 2) {
          // Try medium synthesis
          const result = await this.tryMediumSynthesis(
            idea, competitors, trends, dateContext
          );
          if (result) {
            console.log('✅ Medium synthesis successful');
            return result;
          }
        } else {
          // Try simple synthesis
          const result = await this.trySimpleSynthesis(
            idea, competitors, trends, dateContext
          );
          if (result) {
            console.log('✅ Simple synthesis successful');
            return result;
          }
        }
      } catch (error) {
        console.warn(`   ⚠️ Synthesis attempt ${attempt} failed: ${error.message}`);
        
        if (attempt < this.maxRetries) {
          await this.sleep(3000 * attempt);
        }
      }
    }

    // All AI attempts failed - use rule-based analysis
    console.log('   ⚠️ All AI synthesis failed, using rule-based analysis...');
    return this.generateRuleBasedAnalysis(idea, country, competitors, trends, dateContext);
  }

  async tryComprehensiveSynthesis(idea, country, competitors, trends, industryData, dateContext) {
    
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
    
    const prompt = jsonInstructions +`You are a market research expert. Analyze this business idea with comprehensive insights.

**CRITICAL INSTRUCTIONS:**
1. Return ONLY valid JSON - no markdown, no explanations, no code blocks
2. Start response with { and end with }
3. Use double quotes for all strings
4. Escape special characters properly

PROJECT: ${idea}
MARKET: ${country}
DATE: ${dateContext.currentDate}
SEASON: ${dateContext.season}

DATA AVAILABLE:
- ${competitors.length} competitors found
- ${trends.recent_news.length} news articles
- ${industryData.length} industry reports

Return this EXACT JSON structure:
{
  "market_overview": {
    "size": "Specific market size estimate (e.g., $5B, Large, Growing)",
    "growth_rate": "Percentage or description",
    "maturity": "emerging OR growing OR mature OR declining"
  },
  "competition_level": "low OR medium OR high OR very-high",
  "key_competitors": [
    {
      "name": "Competitor name",
      "position": "market leader OR challenger OR niche",
      "key_differentiator": "What makes them unique"
    }
  ],
  "market_gaps": [
    {
      "gap": "Specific unmet need",
      "evidence": "Why this gap exists",
      "opportunity_size": "Small OR Medium OR Large"
    }
  ],
  "opportunities": ["Opportunity 1", "Opportunity 2"],
  "threats": ["Threat 1", "Threat 2"]
}`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.tier === 'premium' ? 6000 : 3000,
      temperature: 0.3, // Lower for more consistent JSON
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0].text;
    
    // ENHANCED: Multiple JSON extraction strategies
    const parsed = this.extractJSONWithMultipleStrategies(content);
    
    if (parsed && this.validateMarketAnalysis(parsed)) {
      // Add metadata
      parsed._meta = {
        competitors_found: competitors.length,
        news_articles: trends.recent_news.length,
        industry_reports: industryData.length,
        data_sources: competitors.map(c => c.url).filter(Boolean).slice(0, 10),
        analysis_date: dateContext.currentDate,
        tier: this.tier,
        data_quality: this.calculateDataQuality(competitors, trends),
        synthesis_method: 'comprehensive'
      };
      return parsed;
    }

    throw new Error('JSON extraction or validation failed');
  }

  async tryMediumSynthesis(idea, competitors, trends, dateContext) {
    
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
    
    const prompt = jsonInstructions +`Analyze this business idea. Return ONLY valid JSON, no markdown.

IDEA: ${idea}
COMPETITORS: ${competitors.length} found
NEWS: ${trends.recent_news.length} articles

Return EXACTLY this structure (valid JSON only):
{
  "market_overview": {
    "size": "Market size",
    "growth_rate": "Growth rate",
    "maturity": "emerging"
  },
  "competition_level": "medium",
  "key_competitors": [{"name": "Name", "position": "Position"}],
  "market_gaps": [{"gap": "Gap description"}],
  "opportunities": ["Opportunity 1"],
  "threats": ["Threat 1"]
}`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2000,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0].text;
    const parsed = this.extractJSONWithMultipleStrategies(content);
    
    if (parsed && this.validateMarketAnalysis(parsed)) {
      parsed._meta = {
        competitors_found: competitors.length,
        news_articles: trends.recent_news.length,
        analysis_date: dateContext.currentDate,
        tier: this.tier,
        synthesis_method: 'medium'
      };
      return parsed;
    }

    return null;
  }

  async trySimpleSynthesis(idea, competitors, trends, dateContext) {
    const prompt = `Simple JSON analysis. ONLY return this exact JSON structure:
{"market_overview":{"size":"Unknown","growth_rate":"Unknown","maturity":"unknown"},"competition_level":"medium","key_competitors":[],"market_gaps":[],"opportunities":["Research ongoing"],"threats":["Competition exists"]}

Customize values based on: ${idea}`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1000,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0].text;
    const parsed = this.extractJSONWithMultipleStrategies(content);
    
    if (parsed) {
      parsed._meta = {
        synthesis_method: 'simple',
        fallback: true
      };
      return parsed;
    }

    return null;
  }

  // ENHANCED: Multiple JSON extraction strategies
  extractJSONWithMultipleStrategies(text) {
    console.log('   🔍 Attempting JSON extraction...');
    
    // Strategy 1: Direct JSON match
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const json = JSON.parse(match[0]);
        console.log('   ✅ Strategy 1 (Direct match) succeeded');
        return json;
      }
    } catch (e) {
      console.log('   ❌ Strategy 1 failed:', e.message.substring(0, 50));
    }

    // Strategy 2: Remove markdown code blocks
    try {
      const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        const json = JSON.parse(match[0]);
        console.log('   ✅ Strategy 2 (Markdown removal) succeeded');
        return json;
      }
    } catch (e) {
      console.log('   ❌ Strategy 2 failed:', e.message.substring(0, 50));
    }

    // Strategy 3: Find first { and last }
    try {
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const jsonStr = text.substring(firstBrace, lastBrace + 1);
        const json = JSON.parse(jsonStr);
        console.log('   ✅ Strategy 3 (Brace search) succeeded');
        return json;
      }
    } catch (e) {
      console.log('   ❌ Strategy 3 failed:', e.message.substring(0, 50));
    }

    // Strategy 4: Remove comments and try
    try {
      let cleaned = text.replace(/\/\*[\s\S]*?\*\//g, ''); // Remove /* */ comments
      cleaned = cleaned.replace(/\/\/.*/g, ''); // Remove // comments
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        const json = JSON.parse(match[0]);
        console.log('   ✅ Strategy 4 (Comment removal) succeeded');
        return json;
      }
    } catch (e) {
      console.log('   ❌ Strategy 4 failed:', e.message.substring(0, 50));
    }

    // Strategy 5: Fix common JSON errors
    try {
      let cleaned = text.match(/\{[\s\S]*\}/)?.[0] || '';
      // Fix trailing commas
      cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
      // Fix single quotes to double quotes
      cleaned = cleaned.replace(/'/g, '"');
      const json = JSON.parse(cleaned);
      console.log('   ✅ Strategy 5 (Error fixing) succeeded');
      return json;
    } catch (e) {
      console.log('   ❌ Strategy 5 failed:', e.message.substring(0, 50));
    }

    console.log('   ❌ All JSON extraction strategies failed');
    console.log('   📄 Sample response:', text.substring(0, 200));
    return null;
  }

  validateMarketAnalysis(data) {
    if (!data || typeof data !== 'object') {
      console.log('   ❌ Validation failed: Not an object');
      return false;
    }
    
    // Must have key fields
    const requiredFields = ['market_overview', 'competition_level'];
    for (const field of requiredFields) {
      if (!data[field]) {
        console.log(`   ❌ Validation failed: Missing ${field}`);
        return false;
      }
    }

    // Validate nested structure
    if (!data.market_overview.size) {
      console.log('   ❌ Validation failed: Missing market_overview.size');
      return false;
    }

    console.log('   ✅ Validation passed');
    return true;
  }

  generateRuleBasedAnalysis(idea, country, competitors, trends, dateContext) {
    console.log('📊 Generating rule-based analysis (AI-free fallback)...');

    // Analyze competition level
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
      key_differentiator: c.description || 'Analysis in progress'
    }));

    // Market gaps from trends
    const marketGaps = trends.recent_news.slice(0, 3).map((news, i) => ({
      gap: `Opportunity ${i + 1}: ${news.title?.substring(0, 100)}`,
      evidence: news.summary || news.title,
      opportunity_size: 'Medium'
    }));

    // Generate opportunities
    const opportunities = [
      competitors.length < 5 ? 'Low competition - easier market entry' : 'Established market with proven demand',
      `Current season (${dateContext.season}) favorable for launch`,
      trends.recent_news.length > 5 ? 'High market interest and activity' : 'Emerging market with growth potential'
    ];

    // Generate threats
    const threats = [
      competitors.length > 10 ? 'High competition - strong differentiation required' : 'New competitors may enter',
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
        maturity: competitors.length > 15 ? 'mature' : competitors.length > 5 ? 'growing' : 'emerging'
      },
      competition_level: competitionLevel,
      key_competitors: keyCompetitors,
      market_gaps: marketGaps,
      opportunities,
      threats,
      _meta: {
        competitors_found: competitors.length,
        news_articles: trends.recent_news.length,
        data_sources: competitors.map(c => c.url).filter(Boolean),
        analysis_date: dateContext.currentDate,
        tier: this.tier,
        analysis_type: 'rule_based',
        data_quality: this.calculateDataQuality(competitors, trends)
      }
    };
  }

  calculateDataQuality(competitors, trends) {
    let score = 0;
    if (competitors.length > 0) score += 30;
    if (competitors.length >= 5) score += 20;
    if (trends.recent_news.length > 0) score += 30;
    if (trends.recent_news.length >= 5) score += 20;
    return Math.min(100, score);
  }

  async findCompetitorsMultiSource(idea, country, dateContext) {
    console.log('🔍 Finding competitors from multiple sources...');
    
    const allCompetitors = [];

    try {
      const keywords = this.extractKeywords(idea).slice(0, 3).join(' ');
      const googleQuery = `${keywords} ${country} competitors ${dateContext.season} ${new Date().getFullYear()}`;
      
      console.log(`   🔸 Searching: "${googleQuery}"`);
      const googleResults = await this.scraper.searchGoogle(googleQuery, 10);
      
      googleResults.forEach(result => {
        if (result.url && !result.url.includes('google.com')) {
          allCompetitors.push({
            name: this.extractCompanyName(result.title),
            url: result.url,
            description: result.snippet,
            source: 'Google'
          });
        }
      });
      
      console.log(`   ✅ Google: Found ${googleResults.length} results`);
    } catch (error) {
      console.error('   ❌ Google search failed:', error.message);
    }

    // Deduplicate
    const uniqueCompetitors = this.deduplicateCompetitors(allCompetitors);
    return uniqueCompetitors.slice(0, this.maxCompetitors);
  }

  async getMarketTrendsMultiSource(idea, country, dateContext) {
    console.log('📈 Analyzing market trends...');
    
    const keywords = this.extractKeywords(idea);
    const allNews = [];

    try {
      const newsQuery = `${keywords.slice(0, 3).join(' ')} ${country} news ${new Date().getFullYear()}`;
      const newsResults = await this.scraper.searchGoogle(newsQuery, 10);
      
      newsResults.forEach(result => {
        allNews.push({
          title: result.title,
          source: this.extractDomain(result.url),
          summary: result.snippet,
          url: result.url
        });
      });
      
      console.log(`   ✅ Found ${newsResults.length} news articles`);
    } catch (error) {
      console.error('   ❌ News search failed:', error.message);
    }

    return {
      keywords,
      recent_news: allNews.slice(0, 15),
      trend_direction: this.calculateTrendDirection(allNews, dateContext)
    };
  }

  async getIndustryReports(idea, country) {
    console.log('📊 Searching for industry reports...');
    
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
      console.error('   ❌ Industry reports search failed:', error.message);
    }

    return reports;
  }

  // Helper methods
  calculateTrendDirection(news, dateContext) {
    const growthKeywords = ['growing', 'rising', 'increasing', 'surge', 'boom'];
    const decliningKeywords = ['declining', 'falling', 'decreasing', 'drop', 'slump'];
    
    let growthCount = 0;
    let decliningCount = 0;
    
    news.forEach(article => {
      const text = (article.title + ' ' + article.summary).toLowerCase();
      growthKeywords.forEach(keyword => {
        if (text.includes(keyword)) growthCount++;
      });
      decliningKeywords.forEach(keyword => {
        if (text.includes(keyword)) decliningCount++;
      });
    });

    if (growthCount > decliningCount * 1.5) return 'rapidly growing';
    if (growthCount > decliningCount) return 'growing';
    if (decliningCount > growthCount * 1.5) return 'declining';
    if (decliningCount > growthCount) return 'slowly declining';
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
      opportunities: [],
      threats: [],
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