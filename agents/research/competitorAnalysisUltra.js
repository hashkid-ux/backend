// agents/research/competitorAnalysisUltra.js
// ULTRA Competitor Analysis - Deep intelligence with parallel processing

const AIClient = require('../../services/aiClient');
const WebScraperUltra = require('./webScraperUltra');

class CompetitorAnalysisAgentUltra {
  constructor(tier = 'free') {
    this.tier = tier;
    this.client = new AIClient(process.env.OPENROUTER_API_KEY);
    this.model = 'qwen/qwen-2.5-coder-32b-instruct:free';
    this.scraper = new WebScraperUltra();
    this.maxCompetitors = tier === 'free' ? 5 : tier === 'starter' ? 10 : 20;
  }

  async analyzeMultipleCompetitorsUltra(competitorUrls, ideaContext, trends = null) {
    console.log(`🔍 ULTRA Competitor Analysis: ${competitorUrls.length} competitors`);

    const urls = competitorUrls.slice(0, this.maxCompetitors);
    
    // PARALLEL SCRAPING
    const scrapedData = await this.scraper.scrapeMultiple(urls, {
      maxConcurrent: 3,
      timeout: 30000
    });

    // PARALLEL AI ANALYSIS
    const analyses = await this.analyzeInParallel(scrapedData, ideaContext, trends);

    // DEEP SYNTHESIS
    const deepInsights = await this.generateDeepInsights(analyses, ideaContext, trends);

    // COMPETITIVE POSITIONING
    const positioning = await this.calculateCompetitivePositioning(analyses);

    return {
      total_analyzed: analyses.length,
      individual_analyses: analyses,
      deepInsights,
      positioning,
      market_gaps: this.identifyMarketGaps(analyses),
      threat_level: this.calculateThreatLevel(analyses),
      opportunities: this.identifyOpportunities(analyses, ideaContext),
      _meta: {
        scraped_successfully: scrapedData.filter(d => !d.error).length,
        analysis_depth: this.tier,
        timestamp: new Date().toISOString()
      }
    };
  }

  async analyzeInParallel(scrapedData, ideaContext, trends) {
    console.log('⚡ Analyzing competitors in parallel...');

    const analyses = await Promise.all(
      scrapedData.map(data => this.analyzeSingleCompetitor(data, ideaContext, trends))
    );

    return analyses.filter(a => a && !a.error);
  }

  async analyzeSingleCompetitor(data, ideaContext, trends) {
    if (data.error) {
      return { url: data.url, error: 'Scraping failed', name: 'Unknown' };
    }

    console.log(`🤖 AI analyzing: ${data.url}`);

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
    
    
    const prompt = jsonInstructions +`You are an expert competitive intelligence analyst. Analyze this competitor DEEPLY.

BUSINESS IDEA CONTEXT: ${ideaContext}

COMPETITOR DATA:
URL: ${data.url}
Title: ${data.title}
Description: ${data.metaDescription}
Headings: ${data.headings?.slice(0, 15).join(', ')}
Features: ${data.features?.slice(0, 10).join(', ')}
Pricing: ${data.pricing?.slice(0, 5).join(', ')}
Text Sample: ${data.text?.substring(0, 2000)}

${trends ? `MARKET TRENDS: ${JSON.stringify(trends.emerging_trends?.slice(0, 3))}` : ''}

Provide ULTRA-DETAILED analysis in JSON:
{
  "name": "Company name",
  "url": "${data.url}",
  "position": "market leader/challenger/niche player/follower",
  "estimated_revenue": "Specific estimate with reasoning",
  "estimated_users": "Specific number with reasoning",
  "year_founded": "Estimate",
  "business_model": "Specific model (SaaS/Marketplace/etc)",
  "core_features": [
    {
      "feature": "Feature name",
      "description": "What it does",
      "quality": "excellent/good/average/poor",
      "uniqueness": "how unique is this"
    }
  ],
  "pricing_strategy": {
    "model": "freemium/subscription/one-time/custom",
    "tiers": ["list of tiers if visible"],
    "price_points": ["actual prices"],
    "value_perception": "expensive/premium/mid-market/budget"
  },
  "target_audience": {
    "primary": "Who they target",
    "demographics": "Age, location, income level",
    "psychographics": "Values, lifestyle, pain points"
  },
  "strengths": [
    {
      "strength": "What they do well",
      "impact": "high/medium/low",
      "how_they_do_it": "Specific tactics",
      "can_we_copy": "yes/no and why"
    }
  ],
  "weaknesses": [
    {
      "weakness": "What they lack",
      "severity": "critical/high/medium/low",
      "user_complaints": "Evidence from reviews/text",
      "our_opportunity": "How we can exploit this"
    }
  ],
  "technology_stack": {
    "frontend": "React/Vue/etc if detectable",
    "backend": "Node/Python/etc if detectable",
    "hosting": "AWS/Vercel/etc if detectable",
    "notable_tools": ["Tools they use"]
  },
  "marketing_strategy": {
    "channels": ["SEO", "Social", "Paid", "etc"],
    "content_quality": "excellent/good/average/poor",
    "brand_positioning": "How they position themselves",
    "messaging": "Key messages they use"
  },
  "user_experience": {
    "design_quality": "modern/dated/average",
    "usability": "excellent/good/poor",
    "mobile_friendly": "yes/no",
    "loading_speed": "fast/average/slow",
    "notable_ux_patterns": ["Patterns they use well"]
  },
  "competitive_moat": {
    "moat_strength": "strong/moderate/weak",
    "moat_types": ["network effects", "brand", "technology", "data"],
    "time_to_replicate": "months/years",
    "defensibility": "How defensible is their position"
  },
  "threats_to_us": [
    {
      "threat": "Specific threat",
      "likelihood": "high/medium/low",
      "impact": "critical/high/medium/low",
      "mitigation": "How we should respond"
    }
  ],
  "opportunities_for_us": [
    {
      "opportunity": "Specific opportunity",
      "effort": "low/medium/high",
      "potential_impact": "game-changer/significant/moderate",
      "implementation": "How to implement"
    }
  ],
  "overall_assessment": "Comprehensive 2-3 sentence assessment",
  "recommended_strategy": "Specific strategy to compete against them"
}

BE SPECIFIC. USE EVIDENCE. NO GENERIC ANSWERS.`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.tier === 'premium' ? 6000 : 3000,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0].text;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        return {
          ...analysis,
          _scraped_data: {
            method: data.method,
            scrapedAt: data.scrapedAt,
            social: data.social,
            contactInfo: data.contactInfo
          }
        };
      }

      throw new Error('Failed to parse AI analysis');
    } catch (error) {
      console.error(`❌ AI analysis failed for ${data.url}:`, error.message);
      return {
        url: data.url,
        name: data.title || 'Unknown',
        error: 'Analysis failed',
        raw_data: data
      };
    }
  }

  async generateDeepInsights(analyses, ideaContext, trends) {
    console.log('🧠 Generating deep competitive insights...');

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
    
    const prompt = jsonInstructions +`You are a strategic business consultant. Generate ULTRA-DEEP insights from this competitive analysis.

BUSINESS IDEA: ${ideaContext}

COMPETITOR ANALYSES:
${JSON.stringify(analyses.slice(0, 5), null, 2)}

${trends ? `TRENDS: ${JSON.stringify(trends.emerging_trends?.slice(0, 3))}` : ''}

Provide strategic insights in JSON:
{
  "market_dynamics": {
    "competitive_intensity": "low/medium/high/very-high",
    "market_maturity": "emerging/growing/mature/declining",
    "consolidation_trend": "fragmenting/consolidating/stable",
    "innovation_pace": "rapid/moderate/slow",
    "analysis": "Detailed analysis"
  },
  "common_patterns": {
    "pricing": "What pricing patterns emerge",
    "features": "What features all competitors offer",
    "positioning": "How they position themselves",
    "weaknesses": "Common weaknesses across competitors"
  },
  "differentiation_opportunities": [
    {
      "opportunity": "Specific way to differentiate",
      "why_it_works": "Why this will succeed",
      "difficulty": "easy/moderate/hard",
      "potential_impact": "game-changer/significant/moderate",
      "estimated_cost": "Low/Medium/High",
      "time_to_implement": "weeks/months"
    }
  ],
  "strategic_gaps": [
    {
      "gap": "What's missing in the market",
      "evidence": "Why we know this gap exists",
      "size": "large/medium/small",
      "competition_for_gap": "high/medium/low",
      "our_fit": "How well we can fill this gap"
    }
  ],
  "competitive_advantages_we_need": [
    {
      "advantage": "Specific advantage",
      "why_critical": "Why it's important",
      "how_to_build": "Actionable steps",
      "investment_needed": "Rough estimate",
      "defensibility": "How defensible this advantage is"
    }
  ],
  "threats_to_watch": [
    {
      "threat": "Specific threat",
      "source": "Which competitor(s)",
      "timeline": "when this might happen",
      "mitigation": "How to prepare"
    }
  ],
  "recommended_positioning": {
    "tagline": "Suggested positioning statement",
    "target_segment": "Who to target first",
    "key_differentiators": ["Top 3 differentiators"],
    "messaging_framework": "How to communicate value",
    "pricing_strategy": "Recommended pricing approach"
  },
  "go_to_market_strategy": {
    "phase_1_mvp": {
      "focus": "What to build first",
      "target": "Who to target",
      "channels": ["Which channels to use"],
      "timeline": "X months"
    },
    "phase_2_growth": {
      "expansion": "How to expand",
      "new_features": ["What to add"],
      "timeline": "X months"
    },
    "phase_3_scale": {
      "scale_strategy": "How to scale",
      "defensibility": "How to defend position"
    }
  },
  "key_metrics_to_track": [
    {
      "metric": "Metric name",
      "target": "Target value",
      "why": "Why this matters",
      "how_to_measure": "How to track"
    }
  ]
}

BE STRATEGIC. BE SPECIFIC. PROVIDE ACTIONABLE INSIGHTS.`;

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

      return { message: 'Deep insights generated', raw: content };
    } catch (error) {
      console.error('❌ Deep insights generation failed:', error.message);
      return { error: 'Failed to generate insights' };
    }
  }

  calculateCompetitivePositioning(analyses) {
    const positioning = {
      leaders: [],
      challengers: [],
      niche_players: [],
      followers: []
    };

    analyses.forEach(analysis => {
      const position = analysis.position?.toLowerCase() || 'follower';
      
      if (position.includes('leader')) {
        positioning.leaders.push({
          name: analysis.name,
          url: analysis.url,
          threat_level: this.calculateThreatScore(analysis)
        });
      } else if (position.includes('challenger')) {
        positioning.challengers.push({
          name: analysis.name,
          url: analysis.url,
          threat_level: this.calculateThreatScore(analysis)
        });
      } else if (position.includes('niche')) {
        positioning.niche_players.push({
          name: analysis.name,
          url: analysis.url,
          threat_level: this.calculateThreatScore(analysis)
        });
      } else {
        positioning.followers.push({
          name: analysis.name,
          url: analysis.url,
          threat_level: this.calculateThreatScore(analysis)
        });
      }
    });

    return positioning;
  }

  calculateThreatScore(analysis) {
    let score = 50;

    if (analysis.position === 'market leader') score += 30;
    if (analysis.competitive_moat?.moat_strength === 'strong') score += 15;
    if (analysis.strengths?.length > 5) score += 10;
    if (analysis.weaknesses?.length < 3) score += 10;

    return Math.min(100, score);
  }

  identifyMarketGaps(analyses) {
    const gaps = [];
    const allFeatures = new Set();
    const missingFeatures = new Map();

    // Collect all features
    analyses.forEach(analysis => {
      analysis.core_features?.forEach(f => {
        allFeatures.add(f.feature);
      });
    });

    // Find gaps (features mentioned but not offered)
    analyses.forEach(analysis => {
      analysis.weaknesses?.forEach(w => {
        if (w.weakness && !missingFeatures.has(w.weakness)) {
          missingFeatures.set(w.weakness, {
            gap: w.weakness,
            mentions: 1,
            opportunity: w.our_opportunity,
            severity: w.severity
          });
        } else if (w.weakness) {
          const existing = missingFeatures.get(w.weakness);
          existing.mentions++;
        }
      });
    });

    return Array.from(missingFeatures.values())
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 10);
  }

  calculateThreatLevel(analyses) {
    const threats = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    analyses.forEach(analysis => {
      const threatScore = this.calculateThreatScore(analysis);
      
      if (threatScore >= 80) threats.critical++;
      else if (threatScore >= 60) threats.high++;
      else if (threatScore >= 40) threats.medium++;
      else threats.low++;
    });

    const overallLevel = threats.critical > 0 ? 'CRITICAL' :
                        threats.high > 2 ? 'HIGH' :
                        threats.high > 0 ? 'MEDIUM' : 'LOW';

    return {
      overall: overallLevel,
      breakdown: threats,
      recommendation: this.getThreatRecommendation(overallLevel)
    };
  }

  getThreatRecommendation(level) {
    const recommendations = {
      'CRITICAL': 'Strong, established competitors. Differentiate aggressively or pivot to underserved niche.',
      'HIGH': 'Significant competition. Focus on unique value proposition and superior execution.',
      'MEDIUM': 'Moderate competition. Good opportunity with clear differentiation.',
      'LOW': 'Limited competition. Move fast and establish market position.'
    };

    return recommendations[level];
  }

  identifyOpportunities(analyses, ideaContext) {
    const opportunities = [];

    // Opportunity 1: Common weaknesses
    const weaknessesByFrequency = new Map();
    analyses.forEach(analysis => {
      analysis.weaknesses?.forEach(w => {
        const key = w.weakness?.toLowerCase();
        if (key) {
          weaknessesByFrequency.set(key, (weaknessesByFrequency.get(key) || 0) + 1);
        }
      });
    });

    weaknessesByFrequency.forEach((count, weakness) => {
      if (count >= 2) {
        opportunities.push({
          type: 'exploit_weakness',
          opportunity: `Address common weakness: ${weakness}`,
          competitors_affected: count,
          potential_impact: 'high',
          difficulty: 'medium'
        });
      }
    });

    // Opportunity 2: Underserved segments
    const targetSegments = new Set();
    analyses.forEach(analysis => {
      if (analysis.target_audience?.primary) {
        targetSegments.add(analysis.target_audience.primary);
      }
    });

    if (targetSegments.size < 3) {
      opportunities.push({
        type: 'underserved_segment',
        opportunity: 'Market is focused on few segments - opportunity to target underserved segments',
        potential_impact: 'high',
        difficulty: 'low'
      });
    }

    // Opportunity 3: Technology gaps
    const techStacks = analyses.map(a => a.technology_stack).filter(Boolean);
    if (techStacks.every(t => t.frontend !== 'React' && t.frontend !== 'Next.js')) {
      opportunities.push({
        type: 'technology',
        opportunity: 'Use modern tech stack for better UX and development speed',
        potential_impact: 'medium',
        difficulty: 'low'
      });
    }

    return opportunities.slice(0, 10);
  }
}

module.exports = CompetitorAnalysisAgentUltra;