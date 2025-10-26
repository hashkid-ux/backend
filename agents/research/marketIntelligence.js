const Anthropic = require('@anthropic-ai/sdk');
const WebScraper = require('./webScraper');
const axios = require('axios');

class MarketIntelligenceAgent {
  constructor(tier = 'free') {
    this.tier = tier;
    this.client = new Anthropic({
      apiKey: tier === 'premium' 
        ? process.env.ANTHROPIC_API_KEY 
        : process.env.ANTHROPIC_API_KEY_FREE
    });
    this.model = tier === 'premium' ? 'claude-sonnet-4-5-20250929' : 'claude-haiku-4-20250924';
    this.scraper = new WebScraper();
  }

  async analyze(ideaDescription, targetCountry = 'Global') {
    console.log('🧠 Market Intelligence Agent starting...');

    try {
      // Step 1: Search for competitors
      const competitors = await this.findCompetitors(ideaDescription, targetCountry);

      // Step 2: Get market trends
      const trends = await this.getMarketTrends(ideaDescription, targetCountry);

      // Step 3: Analyze with AI
      const analysis = await this.synthesizeData(
        ideaDescription,
        targetCountry,
        competitors,
        trends
      );

      // Cleanup
      await this.scraper.closeBrowser();

      return analysis;

    } catch (error) {
      console.error('❌ Market Intelligence Error:', error);
      await this.scraper.closeBrowser();
      throw error;
    }
  }

  async findCompetitors(idea, country) {
    console.log('🔍 Finding competitors...');

    // Create search query
    const searchQuery = this.tier === 'free'
      ? `${idea} competitors ${country}`
      : `${idea} competitors ${country} funding revenue market share`;

    // Search Google for competitors
    const searchResults = await this.scraper.searchGoogle(searchQuery, 10);

    // For free tier, return limited data
    if (this.tier === 'free') {
      return searchResults.slice(0, 5).map(result => ({
        name: this.extractCompanyName(result.title),
        url: result.url,
        description: result.snippet
      }));
    }

    // For paid tiers, scrape competitor websites
    const competitorUrls = searchResults
      .filter(r => r.url && !r.url.includes('google.com'))
      .slice(0, 8)
      .map(r => r.url);

    const scrapedData = await this.scraper.scrapeMultiple(competitorUrls);

    return scrapedData
      .filter(result => result.success)
      .map(result => ({
        name: this.extractCompanyName(result.data.title),
        url: result.url,
        description: result.data.metaDescription || result.data.text.substring(0, 200),
        headings: result.data.headings.slice(0, 5)
      }));
  }

  async getMarketTrends(idea, country) {
    console.log('📈 Analyzing market trends...');

    // Extract keywords from idea
    const keywords = this.extractKeywords(idea);

    try {
      // Search for recent news about the market
      const newsQuery = `${keywords.join(' ')} ${country} market 2024 2025`;
      const newsResults = await this.scraper.searchGoogle(newsQuery, 5);

      return {
        keywords,
        recent_news: newsResults.map(r => ({
          title: r.title,
          source: this.extractDomain(r.url),
          summary: r.snippet
        })),
        search_volume: 'Analysis available in premium tier'
      };

    } catch (error) {
      console.error('⚠️  Trend analysis error:', error.message);
      return {
        keywords,
        recent_news: [],
        note: 'Limited trend data available'
      };
    }
  }

  async synthesizeData(idea, country, competitors, trends) {
    console.log('🤖 AI synthesizing market intelligence...');

    const prompt = `You are a market research analyst. Analyze this business idea and provide comprehensive market intelligence.

BUSINESS IDEA: ${idea}
TARGET MARKET: ${country}

COMPETITOR DATA:
${JSON.stringify(competitors, null, 2)}

MARKET TRENDS:
${JSON.stringify(trends, null, 2)}

Provide analysis in JSON format:
{
  "market_overview": {
    "size": "Estimated market size with reasoning",
    "growth_rate": "Annual growth rate estimate",
    "maturity": "emerging/growing/mature/declining"
  },
  "competition_level": "low/medium/high/very-high",
  "key_competitors": [
    {
      "name": "Competitor name",
      "position": "market leader/challenger/niche",
      "estimated_users": "Estimate if possible",
      "key_differentiator": "What makes them unique"
    }
  ],
  "market_gaps": [
    "Unmet need 1",
    "Unmet need 2"
  ],
  "target_audience": {
    "primary": "Description of ideal customer",
    "size": "Estimated number of potential customers",
    "willingness_to_pay": "low/medium/high"
  },
  "entry_barriers": [
    {
      "barrier": "Description",
      "severity": "low/medium/high",
      "mitigation": "How to overcome"
    }
  ],
  "opportunities": [
    "Opportunity 1",
    "Opportunity 2"
  ],
  "threats": [
    "Threat 1",
    "Threat 2"
  ],
  "recommended_strategy": "Clear go-to-market strategy",
  "estimated_time_to_market": "X months",
  "capital_required": "Estimated budget needed"
}

Be realistic and data-driven. Use the actual competitor and trend data provided.`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.tier === 'premium' ? 8000 : 4000,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0].text;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        
        // Add raw data for reference
        analysis._meta = {
          competitors_found: competitors.length,
          data_sources: competitors.map(c => c.url),
          analysis_date: new Date().toISOString(),
          tier: this.tier
        };

        return analysis;
      }

      throw new Error('Failed to parse AI analysis');

    } catch (error) {
      console.error('❌ AI synthesis error:', error);
      throw new Error(`Market analysis failed: ${error.message}`);
    }
  }

  // Helper: Extract company name from title
  extractCompanyName(title) {
    // Remove common words
    const cleanTitle = title
      .replace(/\|/g, '-')
      .split('-')[0]
      .trim()
      .replace(/Official Website|Home|About/gi, '')
      .trim();
    
    return cleanTitle.substring(0, 50);
  }

  // Helper: Extract keywords from idea
  extractKeywords(idea) {
    const stopWords = ['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as'];
    const words = idea
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.includes(word));
    
    return [...new Set(words)].slice(0, 5);
  }

  // Helper: Extract domain from URL
  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return 'Unknown';
    }
  }

  // Get funding data (premium only)
  async getFundingData(companyName) {
    if (this.tier === 'free') {
      return { message: 'Funding data available in premium tier' };
    }

    // TODO: Integrate Crunchbase API when we have API key
    console.log(`💰 Fetching funding data for ${companyName}`);
    
    return {
      company: companyName,
      total_funding: 'Data not available',
      last_round: 'Data not available',
      note: 'Crunchbase integration coming soon'
    };
  }
}

module.exports = MarketIntelligenceAgent;