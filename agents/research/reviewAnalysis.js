const Anthropic = require('@anthropic-ai/sdk');
const Sentiment = require('sentiment');
const WebScraper = require('./webScraper');

class ReviewAnalysisAgent {
  constructor(tier = 'free') {
    this.tier = tier;
    this.client = new Anthropic({
      apiKey: tier === 'premium' 
        ? process.env.ANTHROPIC_API_KEY 
        : process.env.ANTHROPIC_API_KEY_FREE
    });
    this.model = 'claude-haiku-4-20250924'; // Fast & cheap for review analysis
    this.sentiment = new Sentiment();
    this.scraper = new WebScraper();
  }

  async analyzeReviews(competitorName, urls = []) {
    console.log(`⭐ Analyzing reviews for: ${competitorName}`);

    try {
      // Search for reviews if URLs not provided
      if (urls.length === 0) {
        urls = await this.findReviewSources(competitorName);
      }

      // Scrape reviews
      const reviews = await this.scrapeReviews(urls);

      if (reviews.length === 0) {
        return {
          competitor: competitorName,
          message: 'No reviews found',
          sentiment: 'neutral',
          insights: []
        };
      }

      // Analyze sentiment
      const sentimentAnalysis = this.analyzeSentiment(reviews);

      // Extract insights with AI
      const insights = await this.extractInsights(reviews, competitorName);

      await this.scraper.closeBrowser();

      return {
        competitor: competitorName,
        total_reviews: reviews.length,
        sentiment: sentimentAnalysis,
        insights,
        analyzed_at: new Date().toISOString()
      };

    } catch (error) {
      console.error(`❌ Review analysis error:`, error);
      return {
        competitor: competitorName,
        error: error.message
      };
    }
  }

  async findReviewSources(competitorName) {
    console.log(`🔍 Finding review sources for ${competitorName}`);

    const searchQueries = [
      `${competitorName} reviews`,
      `${competitorName} app store reviews`,
      `${competitorName} google play reviews`,
      `${competitorName} trustpilot`,
      `${competitorName} reddit reviews`
    ];

    const allResults = [];

    for (const query of searchQueries.slice(0, this.tier === 'free' ? 2 : 5)) {
      const results = await this.scraper.searchGoogle(query, 5);
      allResults.push(...results);
    }

    // Filter for review sites
    const reviewSites = allResults
      .filter(r => 
        r.url.includes('trustpilot') ||
        r.url.includes('g2.com') ||
        r.url.includes('capterra') ||
        r.url.includes('reddit.com') ||
        r.url.includes('play.google.com') ||
        r.url.includes('apps.apple.com')
      )
      .map(r => r.url)
      .slice(0, this.tier === 'free' ? 3 : 8);

    return [...new Set(reviewSites)];
  }

  async scrapeReviews(urls) {
    console.log(`📝 Scraping reviews from ${urls.length} sources...`);

    const allReviews = [];

    for (const url of urls) {
      try {
        const data = await this.scraper.scrapePage(url, {
          timeout: 20000
        });

        if (data.error) continue;

        // Extract review-like text (paragraphs with 20+ words)
        const reviewTexts = data.text
          .split(/\n+/)
          .map(line => line.trim())
          .filter(line => {
            const words = line.split(/\s+/);
            return words.length > 20 && words.length < 500;
          })
          .slice(0, this.tier === 'free' ? 10 : 50);

        allReviews.push(...reviewTexts.map(text => ({
          text,
          source: this.extractDomain(url)
        })));

      } catch (error) {
        console.error(`⚠️ Error scraping ${url}:`, error.message);
      }
    }

    return allReviews.slice(0, this.tier === 'free' ? 50 : 200);
  }

  analyzeSentiment(reviews) {
    console.log(`📊 Analyzing sentiment of ${reviews.length} reviews...`);

    let totalScore = 0;
    let positive = 0;
    let negative = 0;
    let neutral = 0;

    const analyzed = reviews.map(review => {
      const result = this.sentiment.analyze(review.text);
      totalScore += result.score;

      if (result.score > 2) positive++;
      else if (result.score < -2) negative++;
      else neutral++;

      return {
        ...review,
        sentiment_score: result.score,
        sentiment: result.score > 2 ? 'positive' : result.score < -2 ? 'negative' : 'neutral'
      };
    });

    const averageScore = totalScore / reviews.length;

    return {
      average_score: averageScore.toFixed(2),
      overall_sentiment: averageScore > 1 ? 'positive' : averageScore < -1 ? 'negative' : 'neutral',
      distribution: {
        positive: ((positive / reviews.length) * 100).toFixed(1) + '%',
        neutral: ((neutral / reviews.length) * 100).toFixed(1) + '%',
        negative: ((negative / reviews.length) * 100).toFixed(1) + '%'
      },
      reviews: analyzed
    };
  }

  async extractInsights(reviews, competitorName) {
    console.log('🤖 AI extracting insights from reviews...');

    // Sample reviews for AI analysis (to save costs)
    const sampleSize = this.tier === 'free' ? 20 : 50;
    const sampleReviews = reviews
      .sort(() => Math.random() - 0.5)
      .slice(0, sampleSize)
      .map(r => r.text)
      .join('\n\n---\n\n');

    const prompt = `Analyze these user reviews for ${competitorName} and extract key insights.

REVIEWS:
${sampleReviews}

Extract insights in JSON format:
{
  "top_complaints": [
    {
      "complaint": "Issue description",
      "frequency": "high/medium/low",
      "severity": "critical/high/medium/low",
      "example_quote": "Actual user quote"
    }
  ],
  "top_praise": [
    {
      "praise": "What users love",
      "frequency": "high/medium/low",
      "example_quote": "Actual user quote"
    }
  ],
  "feature_requests": [
    {
      "feature": "Requested feature",
      "demand": "high/medium/low",
      "example_quote": "User quote"
    }
  ],
  "user_pain_points": ["pain point 1", "pain point 2"],
  "competitive_advantages": ["what they do well"],
  "competitive_weaknesses": ["what they do poorly"],
  "opportunities_for_new_competitor": [
    "Opportunity based on user feedback"
  ]
}

Focus on actionable insights that would help a new competitor.`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0].text;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return { message: 'Analysis complete', raw: content };

    } catch (error) {
      console.error('❌ AI insights error:', error);
      return {
        error: 'Failed to extract insights',
        message: error.message
      };
    }
  }

  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return 'Unknown';
    }
  }

  // Aggregate reviews from multiple competitors
  async compareCompetitorReviews(competitors) {
    console.log(`📊 Comparing reviews across ${competitors.length} competitors...`);

    const allAnalyses = await Promise.all(
      competitors.map(comp => this.analyzeReviews(comp.name, comp.reviewUrls || []))
    );

    // Create comparison
    const comparison = {
      competitors: allAnalyses.map(a => ({
        name: a.competitor,
        sentiment: a.sentiment?.overall_sentiment,
        score: a.sentiment?.average_score,
        total_reviews: a.total_reviews
      })),
      market_insights: this.aggregateInsights(allAnalyses),
      analyzed_at: new Date().toISOString()
    };

    return comparison;
  }

  aggregateInsights(analyses) {
    const allComplaints = [];
    const allPraise = [];
    const allRequests = [];

    analyses.forEach(analysis => {
      if (analysis.insights?.top_complaints) {
        allComplaints.push(...analysis.insights.top_complaints);
      }
      if (analysis.insights?.top_praise) {
        allPraise.push(...analysis.insights.top_praise);
      }
      if (analysis.insights?.feature_requests) {
        allRequests.push(...analysis.insights.feature_requests);
      }
    });

    return {
      common_complaints: this.findCommonPatterns(allComplaints.map(c => c.complaint)),
      common_praise: this.findCommonPatterns(allPraise.map(p => p.praise)),
      most_requested_features: this.findCommonPatterns(allRequests.map(r => r.feature)),
      market_gaps: 'Features users want but no one provides well'
    };
  }

  findCommonPatterns(items) {
    // Simple frequency analysis
    const frequency = {};
    items.forEach(item => {
      const normalized = item.toLowerCase().trim();
      frequency[normalized] = (frequency[normalized] || 0) + 1;
    });

    return Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([item, count]) => ({
        pattern: item,
        mentions: count
      }));
  }
}

module.exports = ReviewAnalysisAgent;