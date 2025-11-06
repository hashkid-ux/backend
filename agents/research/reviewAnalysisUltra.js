// agents/research/reviewAnalysisUltra.js
// ULTRA Review Analysis - Deep sentiment + user pain points

const AIClient = require('../../services/aiClient');
const Sentiment = require('sentiment');
const WebScraperUltra = require('./webScraperUltra');

class ReviewAnalysisAgentUltra {
  constructor(tier = 'free') {
    this.tier = tier;
    this.client = new AIClient(process.env.OPENROUTER_API_KEY);
    this.model = 'qwen/qwen-2.5-coder-32b-instruct:free';
    this.sentiment = new Sentiment();
    this.scraper = new WebScraperUltra();
    this.maxReviews = tier === 'free' ? 50 : tier === 'starter' ? 200 : 500;
  }

  async analyzeMultipleCompetitors(competitorNames, ideaContext) {
    console.log(`⭐ ULTRA Review Analysis: ${competitorNames.length} competitors`);

    const allReviews = [];
    const competitorResults = [];

    // Parallel review collection
    const reviewPromises = competitorNames.map(name => 
      this.collectReviewsFromMultipleSources(name)
    );

    const reviewBatches = await Promise.allSettled(reviewPromises);

    reviewBatches.forEach((result, idx) => {
      if (result.status === 'fulfilled' && result.value) {
        const { competitor, reviews } = result.value;
        allReviews.push(...reviews);
        competitorResults.push({
          competitor,
          reviewCount: reviews.length,
          reviews: reviews.slice(0, 20) // Sample for report
        });
      }
    });

    console.log(`✅ Collected ${allReviews.length} total reviews`);

    // Deep sentiment analysis
    const sentimentAnalysis = this.performDeepSentiment(allReviews);

    // AI-powered insights extraction
    const insights = await this.extractUltraInsights(allReviews, ideaContext);

    // Topic modeling
    const topics = this.extractTopics(allReviews);

    // Temporal analysis
    const temporalTrends = this.analyzeTemporalTrends(allReviews);

    return {
      totalReviewsAnalyzed: allReviews.length,
      competitorBreakdown: competitorResults,
      overallSentiment: sentimentAnalysis,
      insights,
      topics,
      temporalTrends,
      actionableRecommendations: this.generateRecommendations(insights),
      _meta: {
        tier: this.tier,
        analysisDepth: 'ultra',
        timestamp: new Date().toISOString()
      }
    };
  }

  async collectReviewsFromMultipleSources(competitorName) {
    console.log(`📥 Collecting reviews for: ${competitorName}`);

    const reviews = [];

    // SOURCE 1: Google search for reviews
    try {
      const query = `${competitorName} reviews`;
      const searchResults = await this.scraper.searchGoogle(query, 10);

      for (const result of searchResults.slice(0, 5)) {
        if (this.isReviewSite(result.url)) {
          const pageReviews = await this.scraper.extractReviews(result.url);
          reviews.push(...pageReviews.map(r => ({
            ...r,
            competitor: competitorName,
            source: result.url
          })));
        }
      }
    } catch (error) {
      console.warn(`⚠️ Failed to search reviews for ${competitorName}`);
    }

    // SOURCE 2: Reddit discussions
    try {
      const redditReviews = await this.scrapeRedditDiscussions(competitorName);
      reviews.push(...redditReviews);
    } catch (error) {
      console.warn(`⚠️ Reddit scraping failed for ${competitorName}`);
    }

    // SOURCE 3: App stores (if applicable)
    try {
      const appStoreReviews = await this.scrapeAppStoreReviews(competitorName);
      reviews.push(...appStoreReviews);
    } catch (error) {
      console.warn(`⚠️ App store scraping failed for ${competitorName}`);
    }

    console.log(`✅ Collected ${reviews.length} reviews for ${competitorName}`);

    return {
      competitor: competitorName,
      reviews: reviews.slice(0, this.maxReviews / competitorName.length)
    };
  }

  isReviewSite(url) {
    const reviewSites = [
      'trustpilot',
      'g2.com',
      'capterra',
      'getapp',
      'softwareadvice',
      'producthunt',
      'yelp',
      'reddit.com',
      'play.google.com',
      'apps.apple.com'
    ];

    return reviewSites.some(site => url.toLowerCase().includes(site));
  }

  async scrapeRedditDiscussions(competitorName) {
    try {
      const query = `${competitorName} reddit`;
      const results = await this.scraper.searchGoogle(query, 5);

      const redditUrls = results
        .filter(r => r.url.includes('reddit.com'))
        .map(r => r.url)
        .slice(0, 3);

      const reviews = [];

      for (const url of redditUrls) {
        const data = await this.scraper.scrapePage(url);
        if (!data.error && data.text) {
          // Extract comments
          const comments = data.text.split('\n')
            .filter(line => line.length > 50 && line.length < 500)
            .slice(0, 10);

          comments.forEach(comment => {
            reviews.push({
              text: comment,
              source: 'Reddit',
              url,
              competitor: competitorName
            });
          });
        }
      }

      return reviews;
    } catch (error) {
      return [];
    }
  }

  async scrapeAppStoreReviews(competitorName) {
    // Placeholder - would need App Store API
    return [];
  }

  performDeepSentiment(reviews) {
    console.log('📊 Performing deep sentiment analysis...');

    let totalScore = 0;
    let positive = 0;
    let negative = 0;
    let neutral = 0;
    
    const emotions = {
      anger: 0,
      joy: 0,
      sadness: 0,
      fear: 0,
      surprise: 0
    };

    const analyzedReviews = reviews.map(review => {
      const result = this.sentiment.analyze(review.text);
      totalScore += result.score;

      // Categorize
      if (result.score > 2) positive++;
      else if (result.score < -2) negative++;
      else neutral++;

      // Emotion detection (simplified)
      this.detectEmotions(review.text, emotions);

      return {
        ...review,
        sentimentScore: result.score,
        sentiment: result.score > 2 ? 'positive' : result.score < -2 ? 'negative' : 'neutral',
        positive: result.positive,
        negative: result.negative
      };
    });

    const averageScore = reviews.length > 0 ? totalScore / reviews.length : 0;

    return {
      score: averageScore.toFixed(2),
      overall: averageScore > 1 ? 'positive' : averageScore < -1 ? 'negative' : 'neutral',
      distribution: {
        positive: ((positive / reviews.length) * 100).toFixed(1) + '%',
        neutral: ((neutral / reviews.length) * 100).toFixed(1) + '%',
        negative: ((negative / reviews.length) * 100).toFixed(1) + '%'
      },
      emotions,
      reviews: analyzedReviews,
      confidence: this.calculateConfidence(reviews.length)
    };
  }

  detectEmotions(text, emotions) {
    const emotionKeywords = {
      anger: ['angry', 'frustrated', 'annoying', 'terrible', 'worst', 'hate'],
      joy: ['love', 'great', 'excellent', 'amazing', 'perfect', 'best'],
      sadness: ['disappointed', 'sad', 'unfortunate', 'poor', 'lacking'],
      fear: ['worried', 'concerned', 'scared', 'afraid', 'uncertain'],
      surprise: ['surprised', 'unexpected', 'wow', 'shocked', 'amazing']
    };

    const lowerText = text.toLowerCase();

    Object.entries(emotionKeywords).forEach(([emotion, keywords]) => {
      keywords.forEach(keyword => {
        if (lowerText.includes(keyword)) {
          emotions[emotion]++;
        }
      });
    });
  }

  calculateConfidence(sampleSize) {
    if (sampleSize >= 100) return 'high';
    if (sampleSize >= 50) return 'medium';
    if (sampleSize >= 20) return 'low';
    return 'very low';
  }

  async extractUltraInsights(reviews, ideaContext) {
    console.log('🧠 Extracting ultra insights with AI...');

    // Sample reviews for AI
    const sampleSize = this.tier === 'premium' ? 100 : this.tier === 'starter' ? 50 : 20;
    const sample = reviews
      .sort(() => Math.random() - 0.5)
      .slice(0, sampleSize);

    const reviewTexts = sample.map(r => r.text).join('\n\n---\n\n');

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
    
    const prompt = jsonInstructions +`You are a user research expert. Extract ULTRA-DEEP insights from these reviews.

BUSINESS CONTEXT: ${ideaContext}

USER REVIEWS (${sample.length} samples):
${reviewTexts}

Provide comprehensive insights in JSON:
{
  "top_complaints": [
    {
      "complaint": "Specific issue",
      "frequency": "high/medium/low based on mentions",
      "severity": "critical/high/medium/low",
      "user_impact": "How it affects users",
      "example_quotes": ["Actual user quotes"],
      "our_solution": "How we can address this",
      "priority": "critical/high/medium/low"
    }
  ],
  "top_praise": [
    {
      "praise": "What users love",
      "frequency": "high/medium/low",
      "why_it_matters": "Why users care",
      "example_quotes": ["Actual quotes"],
      "should_we_copy": "yes/no and why"
    }
  ],
  "feature_requests": [
    {
      "feature": "Requested feature",
      "demand": "high/medium/low",
      "feasibility": "easy/medium/hard",
      "business_impact": "game-changer/significant/moderate",
      "example_quotes": ["User quotes"],
      "implementation_priority": "must-have/should-have/nice-to-have"
    }
  ],
  "user_pain_points": [
    {
      "pain_point": "Specific pain",
      "emotional_intensity": "high/medium/low",
      "frequency": "how often mentioned",
      "user_segment": "who experiences this",
      "current_workarounds": "How users cope now",
      "our_opportunity": "How we solve this better"
    }
  ],
  "user_expectations": {
    "must_haves": ["Features users expect as baseline"],
    "nice_to_haves": ["Features that delight"],
    "deal_breakers": ["Issues that cause churn"],
    "success_metrics": ["What success looks like to users"]
  },
  "behavioral_insights": {
    "usage_patterns": "How users actually use the product",
    "workflow_pain_points": "Where friction occurs",
    "learning_curve_issues": "Onboarding problems",
    "collaboration_needs": "Team usage patterns"
  },
  "competitive_advantages_to_build": [
    {
      "advantage": "Specific advantage",
      "based_on_weakness": "Which competitor weakness",
      "user_demand": "Evidence from reviews",
      "difficulty": "easy/medium/hard",
      "time_to_build": "weeks/months",
      "competitive_moat": "How defensible"
    }
  ],
  "pricing_insights": {
    "price_sensitivity": "high/medium/low",
    "value_perception": "Users think it's expensive/fair/cheap",
    "willingness_to_pay": "What users would pay",
    "pricing_model_preferences": "Subscription/one-time/usage-based",
    "common_objections": ["Price-related objections"]
  },
  "ux_insights": {
    "onboarding_issues": ["Problems getting started"],
    "navigation_problems": ["UI/UX complaints"],
    "performance_issues": ["Speed/reliability complaints"],
    "mobile_experience": "Good/bad/missing",
    "accessibility_needs": ["Accessibility requests"]
  },
  "emotional_drivers": {
    "primary_emotions": ["What emotions drive usage"],
    "frustration_triggers": ["What frustrates users"],
    "delight_moments": ["What delights users"],
    "abandonment_reasons": ["Why users leave"]
  },
  "actionable_recommendations": [
    {
      "recommendation": "Specific action",
      "based_on": "Which insights",
      "priority": "critical/high/medium/low",
      "effort": "low/medium/high",
      "expected_impact": "Specific outcome",
      "implementation_steps": ["Step 1", "Step 2"]
    }
  ]
}

BE SPECIFIC. USE ACTUAL QUOTES. PROVIDE ACTIONABLE INSIGHTS.`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.tier === 'premium' ? 8000 : 4000,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0].text;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return { message: 'Insights generated', raw: content };
    } catch (error) {
      console.error('❌ Insights extraction failed:', error.message);
      return { error: 'Failed to extract insights' };
    }
  }

  extractTopics(reviews) {
    console.log('🔍 Extracting topics from reviews...');

    const topicKeywords = {
      'pricing': ['price', 'cost', 'expensive', 'cheap', 'affordable', 'subscription', 'free'],
      'performance': ['slow', 'fast', 'speed', 'lag', 'performance', 'loading'],
      'usability': ['easy', 'difficult', 'intuitive', 'confusing', 'ux', 'interface'],
      'features': ['feature', 'functionality', 'option', 'missing', 'need', 'want'],
      'support': ['support', 'help', 'customer service', 'response', 'documentation'],
      'reliability': ['bug', 'crash', 'error', 'stable', 'reliable', 'broken'],
      'integration': ['integrate', 'api', 'connect', 'sync', 'export', 'import'],
      'mobile': ['mobile', 'app', 'ios', 'android', 'phone', 'tablet'],
      'onboarding': ['setup', 'getting started', 'tutorial', 'onboarding', 'learning curve']
    };

    const topicCounts = {};
    const topicSentiments = {};

    Object.keys(topicKeywords).forEach(topic => {
      topicCounts[topic] = 0;
      topicSentiments[topic] = [];
    });

    reviews.forEach(review => {
      const text = review.text.toLowerCase();
      
      Object.entries(topicKeywords).forEach(([topic, keywords]) => {
        const mentioned = keywords.some(keyword => text.includes(keyword));
        if (mentioned) {
          topicCounts[topic]++;
          if (review.sentimentScore) {
            topicSentiments[topic].push(review.sentimentScore);
          }
        }
      });
    });

    const topics = Object.entries(topicCounts)
      .map(([topic, count]) => {
        const sentiments = topicSentiments[topic];
        const avgSentiment = sentiments.length > 0
          ? sentiments.reduce((sum, s) => sum + s, 0) / sentiments.length
          : 0;

        return {
          topic,
          mentions: count,
          frequency: count / reviews.length,
          averageSentiment: avgSentiment.toFixed(2),
          sentiment: avgSentiment > 0.5 ? 'positive' : avgSentiment < -0.5 ? 'negative' : 'neutral'
        };
      })
      .filter(t => t.mentions > 0)
      .sort((a, b) => b.mentions - a.mentions);

    return topics;
  }

  analyzeTemporalTrends(reviews) {
    // Simplified temporal analysis
    // In production, parse actual dates from reviews

    return {
      trend: 'stable',
      note: 'Temporal analysis requires timestamp data',
      recommendation: 'Monitor reviews over time to identify trends'
    };
  }

  generateRecommendations(insights) {
    const recommendations = [];

    // From complaints
    insights.top_complaints?.slice(0, 3).forEach(complaint => {
      if (complaint.severity === 'critical' || complaint.severity === 'high') {
        recommendations.push({
          priority: 'critical',
          category: 'fix_pain_point',
          action: `Address: ${complaint.complaint}`,
          reason: complaint.user_impact,
          solution: complaint.our_solution,
          expected_impact: 'Significant improvement in user satisfaction'
        });
      }
    });

    // From feature requests
    insights.feature_requests?.slice(0, 3).forEach(request => {
      if (request.demand === 'high' && request.feasibility !== 'hard') {
        recommendations.push({
          priority: 'high',
          category: 'add_feature',
          action: `Implement: ${request.feature}`,
          reason: `High user demand (${request.demand})`,
          difficulty: request.feasibility,
          expected_impact: request.business_impact
        });
      }
    });

    // From competitive advantages
    insights.competitive_advantages_to_build?.slice(0, 2).forEach(adv => {
      recommendations.push({
        priority: adv.difficulty === 'easy' ? 'high' : 'medium',
        category: 'competitive_advantage',
        action: `Build: ${adv.advantage}`,
        reason: adv.user_demand,
        time: adv.time_to_build,
        expected_impact: 'Differentiation from competitors'
      });
    });

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }
}

module.exports = ReviewAnalysisAgentUltra;