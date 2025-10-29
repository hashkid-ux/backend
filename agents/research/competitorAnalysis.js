//const Anthropic = require('@anthropic-ai/sdk');
const AIClient = require('../../services/aiClient');
const WebScraper = require('./webScraper');

class CompetitorAnalysisAgent {
  constructor(tier = 'free') {
    this.tier = tier;
    this.client = new AIClient(process.env.OPENROUTER_API_KEY);
    this.model = 'deepseek/deepseek-chat-v3.1:free';
    this.scraper = new WebScraper();
  }

  async analyzeCompetitor(competitorUrl, ideaContext) {
    console.log(`🔍 Analyzing competitor: ${competitorUrl}`);

    try {
      // Scrape competitor website
      const websiteData = await this.scraper.scrapePage(competitorUrl, {
        waitForSelector: 'body',
        timeout: 30000
      });

      if (websiteData.error) {
        return {
          url: competitorUrl,
          error: 'Failed to scrape website',
          analysis: 'Limited data available'
        };
      }

      // Extract pricing
      const pricingData = await this.extractPricingInfo(competitorUrl, websiteData);

      // Analyze with AI
      const analysis = await this.analyzeWithAI(websiteData, pricingData, ideaContext);

      return {
        url: competitorUrl,
        name: this.extractCompanyName(websiteData.title),
        ...analysis,
        pricing: pricingData,
        scraped_at: new Date().toISOString()
      };

    } catch (error) {
      console.error(`❌ Competitor analysis error for ${competitorUrl}:`, error.message);
      return {
        url: competitorUrl,
        error: error.message
      };
    }
  }

  async analyzeMultipleCompetitors(competitorUrls, ideaContext) {
    console.log(`📊 Analyzing ${competitorUrls.length} competitors...`);

    const results = await Promise.allSettled(
      competitorUrls.map(url => this.analyzeCompetitor(url, ideaContext))
    );

    const analyses = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value)
      .filter(a => !a.error);

    // Create comparative analysis
    const comparison = await this.createComparison(analyses, ideaContext);

    await this.scraper.closeBrowser();

    return {
      individual_analyses: analyses,
      comparison,
      total_analyzed: analyses.length
    };
  }

  async extractPricingInfo(url, websiteData) {
    console.log(`💰 Extracting pricing from ${url}`);

    // Look for pricing patterns in text
    const priceRegex = /\$\d+(?:,\d{3})*(?:\.\d{2})?(?:\s*\/\s*(?:month|mo|year|yr))?/gi;
    const prices = websiteData.text.match(priceRegex) || [];

    // Try to find pricing page
    const pricingLinks = websiteData.links.filter(link => 
      link && (
        link.includes('pricing') || 
        link.includes('plans') || 
        link.includes('subscribe')
      )
    );

    return {
      prices_found: [...new Set(prices)].slice(0, 10),
      pricing_page_urls: pricingLinks.slice(0, 3),
      has_pricing: prices.length > 0 || pricingLinks.length > 0
    };
  }

  async analyzeWithAI(websiteData, pricingData, ideaContext) {
    console.log('🤖 AI analyzing competitor...');

    const prompt = `Analyze this competitor website for a business building: ${ideaContext}

COMPETITOR WEBSITE DATA:
Title: ${websiteData.title}
Description: ${websiteData.metaDescription}
Key Headings: ${websiteData.headings.join(', ')}
Content Sample: ${websiteData.text.substring(0, 2000)}

PRICING DATA:
${JSON.stringify(pricingData, null, 2)}

Provide competitive analysis in JSON format:
{
  "core_features": ["feature1", "feature2", "feature3"],
  "unique_selling_points": ["usp1", "usp2"],
  "target_audience": "Who they target",
  "business_model": "freemium/subscription/one-time/etc",
  "pricing_strategy": "premium/mid-market/budget",
  "strengths": [
    "strength 1",
    "strength 2"
  ],
  "weaknesses": [
    "weakness 1",
    "weakness 2"  
  ],
  "opportunities_for_us": [
    "How we can differentiate",
    "What we can do better"
  ],
  "estimated_market_position": "leader/challenger/niche",
  "tech_stack_indicators": ["React", "Node.js", "etc if detectable"],
  "design_quality": "excellent/good/average/poor",
  "user_experience_notes": "Quick UX assessment"
}

Be specific and actionable.`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.tier === 'premium' ? 4000 : 2000,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0].text;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      throw new Error('Failed to parse AI analysis');

    } catch (error) {
      console.error('❌ AI analysis error:', error);
      return {
        error: 'Analysis failed',
        message: error.message
      };
    }
  }

  async createComparison(analyses, ideaContext) {
    console.log('📊 Creating competitive comparison...');

    if (analyses.length === 0) {
      return { message: 'No competitor data to compare' };
    }

    const prompt = `Create a competitive analysis summary for building: ${ideaContext}

COMPETITOR ANALYSES:
${JSON.stringify(analyses, null, 2)}

Provide strategic comparison in JSON format:
{
  "market_landscape": "Overall assessment of competition",
  "common_features": ["feature all competitors have"],
  "missing_features": ["features no one offers yet"],
  "pricing_range": {
    "low": "$X",
    "high": "$Y",
    "average": "$Z"
  },
  "competitive_positioning": {
    "leader": "Company name and why",
    "challengers": ["Company 1", "Company 2"],
    "our_opportunity": "Where we can win"
  },
  "differentiation_strategy": [
    "Strategy 1",
    "Strategy 2"
  ],
  "feature_priorities": [
    {
      "feature": "Feature name",
      "importance": "critical/high/medium",
      "reason": "Why it matters"
    }
  ],
  "avoid": ["What not to do based on competitor weaknesses"],
  "competitive_advantage": "Our unique angle"
}`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.tier === 'premium' ? 6000 : 3000,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0].text;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return { message: 'Comparison analysis generated', content };

    } catch (error) {
      console.error('❌ Comparison error:', error);
      return {
        error: 'Comparison failed',
        message: error.message
      };
    }
  }

  extractCompanyName(title) {
    return title
      .replace(/\|/g, '-')
      .split('-')[0]
      .trim()
      .substring(0, 50);
  }
}

module.exports = CompetitorAnalysisAgent;