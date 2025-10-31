// backend/agents/monitoring/postDeploymentMonitor.js
// ULTRA Post-Deployment Monitoring - Track Competitors, Trends, Performance

const AIClient = require('../../services/aiClient');
const WebScraperUltra = require('../research/webScraperUltra');
const axios = require('axios');

class PostDeploymentMonitor {
  constructor(tier = 'free', projectId = null) {
    this.tier = tier;
    this.projectId = projectId;
    this.client = new AIClient(process.env.OPENROUTER_API_KEY);
    this.model = 'deepseek/deepseek-chat-v3.1:free';
    this.scraper = new WebScraperUltra();
    this.monitoringSchedule = this.getMonitoringSchedule(tier);
  }

  async setupMonitoring(competitors, market, competitiveAdvantages) {
    console.log('📡 Setting up post-deployment monitoring...');

    const monitoringPlan = {
      projectId: this.projectId,
      setupDate: new Date().toISOString(),
      tier: this.tier,
      competitors: this.selectCompetitorsToMonitor(competitors),
      market_keywords: this.extractMarketKeywords(market),
      competitive_advantages: competitiveAdvantages,
      monitoring_frequency: this.monitoringSchedule,
      tracked_metrics: this.getTrackedMetrics(),
      alert_rules: this.setupAlertRules(competitors, market),
      recommendations: this.generateMonitoringRecommendations()
    };

    console.log('✅ Monitoring plan configured:', {
      competitors: monitoringPlan.competitors.length,
      keywords: monitoringPlan.market_keywords.length,
      frequency: monitoringPlan.monitoring_frequency
    });

    return monitoringPlan;
  }

  async runMonitoringCycle(monitoringPlan) {
    console.log('\n🔄 Running monitoring cycle...');

    const results = {
      timestamp: new Date().toISOString(),
      projectId: this.projectId,
      competitorChanges: [],
      marketShifts: [],
      threatAnalysis: {},
      opportunityAnalysis: {},
      recommendations: []
    };

    try {
      // 1. Monitor competitors
      console.log('👀 Step 1: Monitoring competitors...');
      results.competitorChanges = await this.monitorCompetitors(monitoringPlan.competitors);

      // 2. Track market trends
      console.log('📈 Step 2: Tracking market trends...');
      results.marketShifts = await this.trackMarketShifts(monitoringPlan.market_keywords);

      // 3. Analyze user sentiment
      console.log('💬 Step 3: Analyzing user sentiment...');
      results.sentimentAnalysis = await this.analyzeSentiment(monitoringPlan.competitors);

      // 4. Check competitive position
      console.log('🎯 Step 4: Checking competitive position...');
      results.competitivePosition = await this.checkCompetitivePosition(
        monitoringPlan.competitive_advantages,
        results.competitorChanges
      );

      // 5. Threat & Opportunity Analysis
      console.log('⚔️ Step 5: Threat & opportunity analysis...');
      results.threatAnalysis = await this.identifyThreats(results);
      results.opportunityAnalysis = await this.identifyOpportunities(results);

      // 6. Generate recommendations
      console.log('💡 Step 6: Generating recommendations...');
      results.recommendations = await this.generateActionableRecommendations(results);

      console.log('✅ Monitoring cycle complete:', {
        threats: results.threatAnalysis.threats?.length || 0,
        opportunities: results.opportunityAnalysis.opportunities?.length || 0,
        recommendations: results.recommendations.length
      });

      return results;

    } catch (error) {
      console.error('❌ Monitoring cycle failed:', error);
      return {
        ...results,
        error: error.message,
        status: 'failed'
      };
    }
  }

  async monitorCompetitors(competitors) {
    console.log(`   Monitoring ${competitors.length} competitors...`);
    
    const changes = [];

    for (const competitor of competitors) {
      try {
        // Scrape competitor website for changes
        const currentData = await this.scraper.scrapePage(competitor.url, {
          timeout: 15000
        });

        if (currentData.error) {
          changes.push({
            competitor: competitor.name,
            status: 'error',
            error: currentData.error
          });
          continue;
        }

        // Detect changes (simplified - in production, store historical data)
        const detectedChanges = await this.detectCompetitorChanges(
          competitor,
          currentData
        );

        if (detectedChanges.length > 0) {
          changes.push({
            competitor: competitor.name,
            url: competitor.url,
            changes: detectedChanges,
            severity: this.calculateChangeSeverity(detectedChanges),
            timestamp: new Date().toISOString()
          });
        }

        console.log(`   ✅ ${competitor.name}: ${detectedChanges.length} changes detected`);
      } catch (error) {
        console.error(`   ❌ Error monitoring ${competitor.name}:`, error.message);
      }
    }

    return changes;
  }

  async detectCompetitorChanges(competitor, currentData) {
    const changes = [];

    // Check for pricing changes
    const priceRegex = /\$\d+(?:,\d{3})*(?:\.\d{2})?/g;
    const prices = currentData.text.match(priceRegex) || [];
    
    if (prices.length > 0) {
      changes.push({
        type: 'pricing',
        change: 'Pricing detected',
        details: `Found ${prices.length} price points`,
        action: 'Review pricing strategy'
      });
    }

    // Check for new features (h2, h3 headings)
    const featureKeywords = ['new', 'introducing', 'launch', 'release', 'update'];
    const hasNewFeatures = currentData.headings.some(heading => 
      featureKeywords.some(keyword => heading.toLowerCase().includes(keyword))
    );

    if (hasNewFeatures) {
      changes.push({
        type: 'features',
        change: 'New features announced',
        details: 'Detected feature update keywords',
        action: 'Analyze new features and assess if we need to respond'
      });
    }

    // Check for marketing campaigns
    const campaignKeywords = ['limited', 'offer', 'sale', 'discount', 'free trial'];
    const hasCampaign = currentData.text.toLowerCase().split('\n').some(line =>
      campaignKeywords.some(keyword => line.includes(keyword))
    );

    if (hasCampaign) {
      changes.push({
        type: 'marketing',
        change: 'Active marketing campaign',
        details: 'Promotional activity detected',
        action: 'Consider counter-offer or emphasize our unique value'
      });
    }

    return changes;
  }

  async trackMarketShifts(keywords) {
    console.log(`   Tracking ${keywords.length} market keywords...`);

    const shifts = [];

    try {
      // Search for recent news about these keywords
      for (const keyword of keywords.slice(0, 5)) {
        const query = `${keyword} news ${new Date().getFullYear()}`;
        const newsResults = await this.scraper.searchGoogle(query, 5);

        if (newsResults.length > 0) {
          const recentNews = newsResults.filter(result => {
            // Check if it's recent (contains this year or month)
            const thisYear = new Date().getFullYear().toString();
            const thisMonth = new Date().toLocaleString('default', { month: 'long' });
            return result.snippet.includes(thisYear) || result.snippet.includes(thisMonth);
          });

          if (recentNews.length > 0) {
            shifts.push({
              keyword,
              trend: 'active',
              news_count: recentNews.length,
              headlines: recentNews.map(n => n.title),
              action: `Monitor ${keyword} developments closely`
            });
          }
        }
      }

      console.log(`   ✅ Found ${shifts.length} active market shifts`);
    } catch (error) {
      console.error('   ❌ Market shift tracking error:', error.message);
    }

    return shifts;
  }

  async analyzeSentiment(competitors) {
    console.log('   Analyzing user sentiment...');

    const sentimentData = {
      overall: 'neutral',
      competitors_sentiment: [],
      user_pain_points: [],
      positive_feedback: []
    };

    try {
      // Search for reviews/discussions
      for (const competitor of competitors.slice(0, 3)) {
        const query = `${competitor.name} reviews`;
        const results = await this.scraper.searchGoogle(query, 5);

        // Simplified sentiment analysis
        const reviewText = results.map(r => r.snippet).join(' ').toLowerCase();
        
        const positiveWords = ['great', 'excellent', 'amazing', 'best', 'love'];
        const negativeWords = ['bad', 'terrible', 'worst', 'hate', 'poor'];

        const positiveCount = positiveWords.reduce((count, word) => 
          count + (reviewText.match(new RegExp(word, 'g')) || []).length, 0
        );
        const negativeCount = negativeWords.reduce((count, word) => 
          count + (reviewText.match(new RegExp(word, 'g')) || []).length, 0
        );

        sentimentData.competitors_sentiment.push({
          competitor: competitor.name,
          sentiment: positiveCount > negativeCount ? 'positive' : 
                    negativeCount > positiveCount ? 'negative' : 'neutral',
          score: positiveCount - negativeCount
        });
      }

      console.log(`   ✅ Analyzed sentiment for ${sentimentData.competitors_sentiment.length} competitors`);
    } catch (error) {
      console.error('   ❌ Sentiment analysis error:', error.message);
    }

    return sentimentData;
  }

  async checkCompetitivePosition(advantages, competitorChanges) {
    console.log('   Checking competitive position...');

    const position = {
      advantages_still_valid: [],
      advantages_threatened: [],
      new_advantages_gained: [],
      recommendations: []
    };

    // Check if our competitive advantages are still unique
    advantages.forEach(advantage => {
      const threatened = competitorChanges.some(change => 
        change.changes?.some(c => 
          c.details?.toLowerCase().includes(advantage.feature.toLowerCase())
        )
      );

      if (threatened) {
        position.advantages_threatened.push({
          advantage: advantage.feature,
          threat: 'Competitor launched similar feature',
          action: 'Enhance or pivot this feature'
        });
      } else {
        position.advantages_still_valid.push(advantage);
      }
    });

    position.recommendations.push({
      priority: 'high',
      action: 'Maintain focus on unique features',
      details: `${position.advantages_still_valid.length} advantages still strong`
    });

    return position;
  }

  async identifyThreats(monitoringResults) {
    console.log('   Identifying threats...');

    const threats = [];

    // Threat 1: Competitor pricing changes
    const pricingChanges = monitoringResults.competitorChanges.filter(c => 
      c.changes?.some(ch => ch.type === 'pricing')
    );
    if (pricingChanges.length > 0) {
      threats.push({
        type: 'pricing',
        severity: 'high',
        description: `${pricingChanges.length} competitors changed pricing`,
        impact: 'May affect our pricing competitiveness',
        action: 'Review and adjust pricing if needed'
      });
    }

    // Threat 2: New competitor features
    const featureChanges = monitoringResults.competitorChanges.filter(c => 
      c.changes?.some(ch => ch.type === 'features')
    );
    if (featureChanges.length > 0) {
      threats.push({
        type: 'features',
        severity: 'medium',
        description: `${featureChanges.length} competitors launched new features`,
        impact: 'May reduce our feature differentiation',
        action: 'Accelerate feature development roadmap'
      });
    }

    // Threat 3: Negative sentiment shift
    const negativeSentiment = monitoringResults.sentimentAnalysis?.competitors_sentiment?.filter(
      s => s.sentiment === 'negative' && s.score < -3
    );
    if (negativeSentiment?.length > 0) {
      threats.push({
        type: 'market_sentiment',
        severity: 'low',
        description: 'Some competitors facing negative sentiment',
        impact: 'Opportunity to capture dissatisfied users',
        action: 'Launch targeted campaigns to capture switchers'
      });
    }

    return { threats, total: threats.length };
  }

  async identifyOpportunities(monitoringResults) {
    console.log('   Identifying opportunities...');

    const opportunities = [];

    // Opportunity 1: Competitor weaknesses
    const weakCompetitors = monitoringResults.sentimentAnalysis?.competitors_sentiment?.filter(
      s => s.sentiment === 'negative'
    );
    if (weakCompetitors?.length > 0) {
      opportunities.push({
        type: 'capture_market_share',
        priority: 'high',
        description: `${weakCompetitors.length} competitors have negative sentiment`,
        action: 'Launch comparison campaigns highlighting our strengths',
        expected_impact: 'Gain 5-10% market share from switchers'
      });
    }

    // Opportunity 2: Market trends
    const activeShifts = monitoringResults.marketShifts?.filter(s => s.trend === 'active');
    if (activeShifts?.length > 0) {
      opportunities.push({
        type: 'trend_leverage',
        priority: 'medium',
        description: `${activeShifts.length} active market trends detected`,
        action: 'Align messaging and features with current trends',
        expected_impact: 'Increase organic traffic 20-30%'
      });
    }

    // Opportunity 3: Unprotected advantages
    const strongAdvantages = monitoringResults.competitivePosition?.advantages_still_valid;
    if (strongAdvantages?.length > 0) {
      opportunities.push({
        type: 'double_down',
        priority: 'critical',
        description: `${strongAdvantages.length} competitive advantages still unique`,
        action: 'Amplify marketing around these unique features',
        expected_impact: 'Strengthen market position'
      });
    }

    return { opportunities, total: opportunities.length };
  }

  async generateActionableRecommendations(monitoringResults) {
    const recommendations = [];

    // Critical actions
    if (monitoringResults.threatAnalysis?.threats?.length > 0) {
      recommendations.push({
        priority: 'critical',
        category: 'threat_response',
        action: 'Address competitive threats',
        tasks: monitoringResults.threatAnalysis.threats.map(t => t.action),
        deadline: '7 days'
      });
    }

    // High-priority actions
    if (monitoringResults.opportunityAnalysis?.opportunities?.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'opportunity_capture',
        action: 'Capitalize on market opportunities',
        tasks: monitoringResults.opportunityAnalysis.opportunities.map(o => o.action),
        deadline: '14 days'
      });
    }

    // Ongoing monitoring
    recommendations.push({
      priority: 'medium',
      category: 'continuous_improvement',
      action: 'Continue monitoring and iterate',
      tasks: [
        'Track metrics daily',
        'Review competitor changes weekly',
        'Analyze user feedback continuously',
        'Update features based on market feedback'
      ],
      deadline: 'Ongoing'
    });

    return recommendations;
  }

  // Helper methods

  selectCompetitorsToMonitor(competitors) {
    if (!competitors || !competitors.individual_analyses) {
      return [];
    }

    // Select top competitors based on position
    return competitors.individual_analyses
      .filter(c => c.position === 'market leader' || c.position === 'challenger')
      .map(c => ({
        name: c.name,
        url: c.url,
        position: c.position,
        priority: c.position === 'market leader' ? 'high' : 'medium'
      }))
      .slice(0, this.tier === 'free' ? 3 : this.tier === 'starter' ? 5 : 10);
  }

  extractMarketKeywords(market) {
    const keywords = new Set();

    // From market overview
    if (market?.market_overview?.size) {
      const sizeWords = market.market_overview.size.toLowerCase().split(' ');
      sizeWords.forEach(word => {
        if (word.length > 4) keywords.add(word);
      });
    }

    // From key competitors
    market?.key_competitors?.forEach(comp => {
      if (comp.key_differentiator) {
        const diffWords = comp.key_differentiator.toLowerCase().split(' ');
        diffWords.forEach(word => {
          if (word.length > 4) keywords.add(word);
        });
      }
    });

    return Array.from(keywords).slice(0, 10);
  }

  getMonitoringSchedule(tier) {
    const schedules = {
      free: 'Manual only',
      starter: 'Weekly',
      premium: 'Daily'
    };
    return schedules[tier];
  }

  getTrackedMetrics() {
    return [
      'Competitor pricing changes',
      'New competitor features',
      'Marketing campaigns',
      'User sentiment',
      'Market trends',
      'News mentions',
      'Social media activity'
    ];
  }

  setupAlertRules(competitors, market) {
    return [
      {
        rule: 'Competitor price drop > 20%',
        action: 'Email alert immediately',
        priority: 'critical'
      },
      {
        rule: 'New competitor feature launch',
        action: 'Slack notification',
        priority: 'high'
      },
      {
        rule: 'Negative sentiment spike',
        action: 'Dashboard alert',
        priority: 'medium'
      },
      {
        rule: 'Market keyword trending',
        action: 'Email digest weekly',
        priority: 'low'
      }
    ];
  }

  generateMonitoringRecommendations() {
    return [
      'Set up Google Alerts for competitor names',
      'Monitor competitor social media weekly',
      'Subscribe to industry newsletters',
      'Join relevant subreddits and communities',
      'Track competitor app store reviews',
      'Use tools like SimilarWeb for traffic insights'
    ];
  }

  calculateChangeSeverity(changes) {
    let severity = 'low';
    
    if (changes.some(c => c.type === 'pricing')) severity = 'high';
    if (changes.some(c => c.type === 'features' && c.change.includes('launch'))) severity = 'high';
    if (changes.length > 3) severity = 'medium';
    
    return severity;
  }
}

module.exports = PostDeploymentMonitor;