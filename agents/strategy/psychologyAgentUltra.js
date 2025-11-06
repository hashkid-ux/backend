// backend/agents/strategy/psychologyAgentUltra.js
// ULTRA Psychology Agent - Advanced Persuasion & Behavioral Science

const AIClient = require('../../services/aiClient');

class PsychologyAgentUltra {
  constructor(tier = 'free') {
    this.tier = tier;
    this.client = new AIClient(process.env.OPENROUTER_API_KEY);
    this.model = 'qwen/qwen-2.5-coder-32b-instruct:free';
  }

  async generateUltraPsychologyStrategy(market, competitors, reviews, trends, dateContext) {
    console.log('🧠 Generating ULTRA Psychology Strategy...');

    try {
      // 1. Identify psychological triggers from user data
      const triggers = await this.identifyPsychologicalTriggers(reviews, market);

      // 2. Generate persuasion architecture
      const persuasionMap = await this.createPersuasionArchitecture(triggers, competitors);

      // 3. Design emotional journey
      const emotionalJourney = await this.designEmotionalJourney(market, trends, dateContext);

      // 4. Create behavioral nudges
      const behavioralNudges = await this.createBehavioralNudges(persuasionMap, emotionalJourney);

      // 5. Generate copy formulas
      const copyFormulas = await this.generateCopyFormulas(triggers, emotionalJourney);

      // 6. Design conversion funnels
      const conversionStrategy = await this.designConversionFunnels(persuasionMap, behavioralNudges);

      return {
        principles: this.getCorePsychologyPrinciples(),
        psychologyTriggers: triggers,
        persuasionMap,
        emotionalJourney,
        behavioralNudges,
        copyFormulas,
        conversionStrategy,
        implementation: this.generateImplementationGuide(triggers, persuasionMap, copyFormulas)
      };

    } catch (error) {
      console.error('❌ Psychology strategy generation failed:', error);
      return this.getDefaultPsychologyStrategy();
    }
  }

  async identifyPsychologicalTriggers(reviews, market) {
    console.log('   🎯 Identifying psychological triggers...');

    const triggers = [];

    // FROM REVIEWS: What emotions do users express?
    if (reviews?.insights?.top_complaints) {
      reviews.insights.top_complaints.forEach(complaint => {
        triggers.push({
          trigger: 'Pain Relief',
          principle: 'Loss Aversion',
          userPain: complaint.complaint,
          solution: `Address: ${complaint.complaint}`,
          emotionalDriver: 'Fear of missing out / frustration',
          implementation: `Show "Never ${complaint.complaint} again" messaging`,
          priority: complaint.severity === 'high' ? 'critical' : 'high'
        });
      });
    }

    // FROM MARKET: What drives this market?
    const marketDrivers = this.analyzeMarketPsychology(market);
    triggers.push(...marketDrivers);

    // UNIVERSAL TRIGGERS (always applicable)
    const universalTriggers = this.getUniversalTriggers();
    triggers.push(...universalTriggers);

    console.log(`   ✅ Identified ${triggers.length} psychological triggers`);
    return triggers;
  }

  analyzeMarketPsychology(market) {
    const triggers = [];

    // Social Proof (if market has established players)
    if (market?.key_competitors?.length > 0) {
      triggers.push({
        trigger: 'Social Proof',
        principle: 'Consensus & Conformity',
        implementation: 'Show "Join 10,000+ users" + testimonials',
        placement: 'Hero section, pricing page',
        copy: '"Trusted by thousands of professionals"',
        priority: 'critical'
      });
    }

    // Scarcity (if competition is high)
    if (market?.competition_level === 'high' || market?.competition_level === 'very-high') {
      triggers.push({
        trigger: 'Scarcity',
        principle: 'Fear of Missing Out (FOMO)',
        implementation: 'Limited time offers, countdown timers',
        placement: 'Pricing page, CTAs',
        copy: '"Only 50 spots left at this price"',
        priority: 'high'
      });
    }

    // Authority (for complex/technical products)
    if (market?.entry_barriers?.some(b => b.severity === 'high')) {
      triggers.push({
        trigger: 'Authority',
        principle: 'Expert Endorsement',
        implementation: 'Show credentials, certifications, expert team',
        placement: 'About page, homepage',
        copy: '"Built by industry experts with 10+ years experience"',
        priority: 'high'
      });
    }

    return triggers;
  }

  getUniversalTriggers() {
    return [
      {
        trigger: 'Reciprocity',
        principle: 'Give to Get',
        implementation: 'Free trial, free tools, valuable content',
        placement: 'Landing page, blog',
        copy: '"Get X free when you sign up"',
        priority: 'high'
      },
      {
        trigger: 'Commitment & Consistency',
        principle: 'Small Yes → Big Yes',
        implementation: 'Multi-step signup, progress bars',
        placement: 'Onboarding flow',
        copy: '"Just 2 more steps to complete your profile"',
        priority: 'medium'
      },
      {
        trigger: 'Liking',
        principle: 'People buy from those they like',
        implementation: 'Personal brand, founder story, relatable messaging',
        placement: 'About page, email marketing',
        copy: '"Meet the team behind [Product]"',
        priority: 'medium'
      }
    ];
  }

  async createPersuasionArchitecture(triggers, competitors) {
    console.log('   🏗️ Creating persuasion architecture...');

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

    const prompt = jsonInstructions +`Design a PERSUASION ARCHITECTURE using these psychological triggers:

TRIGGERS: ${JSON.stringify(triggers.slice(0, 10), null, 2)}

COMPETITORS: ${JSON.stringify(competitors?.individual_analyses?.slice(0, 3), null, 2)}

Create a detailed persuasion map in JSON:
{
  "awareness_stage": {
    "psychology": "What psychological principles to use",
    "triggers": ["trigger1", "trigger2"],
    "messaging": "Core message for awareness",
    "examples": ["Example copy 1", "Example copy 2"]
  },
  "consideration_stage": {
    "psychology": "Principles for consideration",
    "triggers": ["trigger1"],
    "messaging": "Why choose us message",
    "examples": ["Example copy"]
  },
  "decision_stage": {
    "psychology": "Principles to close the deal",
    "triggers": ["trigger1"],
    "messaging": "Final push message",
    "examples": ["Example copy"]
  },
  "retention_stage": {
    "psychology": "Keep them engaged",
    "triggers": ["trigger1"],
    "messaging": "Continued value message",
    "examples": ["Example copy"]
  },
  "advocacy_stage": {
    "psychology": "Turn them into promoters",
    "triggers": ["trigger1"],
    "messaging": "Share and refer message",
    "examples": ["Example copy"]
  }
}`;

    try {
      const response = await this.client.create({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4000,
        temperature: 0.1
      });

      const content = response.content[0].text;
      
      // ← ADD: Robust extraction
    const cleaned = this.extractCleanJSON(content);
    if (!cleaned) {
      return this.getDefaultPersuasionMap();
    }
    
    return JSON.parse(cleaned);

    } catch (error) {
      console.error('   ❌ Persuasion architecture error:', error);
      return this.getDefaultPersuasionMap();
    }
  }

  // ← ADD NEW METHOD:
extractCleanJSON(text) {
  // Remove markdown
  text = text.replace(/```(?:json)?\s*/g, '').replace(/```\s*$/g, '');
  
  // Find boundaries
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  
  if (start === -1 || end === -1) return null;
  
  let json = text.substring(start, end + 1);
  
  // Fix common issues
  json = json.replace(/,(\s*[}\]])/g, '$1');  // trailing commas
  json = json.replace(/\\/g, '\\\\');         // escape backslashes
  json = json.replace(/\n/g, ' ');            // newlines
  
  // Test parse
  try {
    JSON.parse(json);
    return json;
  } catch (e) {
    // Truncate at error position
    const match = e.message.match(/position (\d+)/);
    if (match) {
      const pos = parseInt(match[1]);
      const truncated = json.substring(0, pos);
      const lastComplete = truncated.lastIndexOf('}');
      if (lastComplete > 0) {
        return json.substring(0, lastComplete + 1);
      }
    }
    return null;
  }
}

  async designEmotionalJourney(market, trends, dateContext) {
    console.log('   💭 Designing emotional journey...');

    const journey = {
      stages: [
        {
          stage: 'Discovery',
          emotion: 'Curiosity',
          goal: 'Capture attention',
          tactics: [
            'Provocative headline',
            'Intriguing visual',
            'Problem statement'
          ],
          copy: [
            '"What if you could..."',
            '"Imagine a world where..."',
            '"You\'re not alone in feeling..."'
          ]
        },
        {
          stage: 'Interest',
          emotion: 'Hope',
          goal: 'Build desire',
          tactics: [
            'Show benefits',
            'Social proof',
            'Before/after comparison'
          ],
          copy: [
            '"Finally, a solution that..."',
            '"Join thousands who..."',
            '"See results in days, not months"'
          ]
        },
        {
          stage: 'Evaluation',
          emotion: 'Trust',
          goal: 'Remove doubt',
          tactics: [
            'Testimonials',
            'Guarantees',
            'Risk reversal'
          ],
          copy: [
            '"100% money-back guarantee"',
            '"No credit card required"',
            '"Cancel anytime, no questions asked"'
          ]
        },
        {
          stage: 'Purchase',
          emotion: 'Excitement',
          goal: 'Close the deal',
          tactics: [
            'Urgency',
            'Scarcity',
            'Bonus offers'
          ],
          copy: [
            '"Start free today"',
            '"Limited time: Get X free"',
            '"Your success starts now"'
          ]
        },
        {
          stage: 'Experience',
          emotion: 'Satisfaction',
          goal: 'Deliver value',
          tactics: [
            'Onboarding',
            'Quick wins',
            'Success tracking'
          ],
          copy: [
            '"Welcome! Let\'s get you started"',
            '"You\'re already X% there"',
            '"Look what you\'ve achieved!"'
          ]
        },
        {
          stage: 'Loyalty',
          emotion: 'Belonging',
          goal: 'Build community',
          tactics: [
            'Exclusive access',
            'Recognition',
            'Community features'
          ],
          copy: [
            '"You\'re part of our family"',
            '"Early access for you"',
            '"Your opinion matters"'
          ]
        }
      ],
      seasonal_adaptations: this.getSeasonalEmotions(dateContext)
    };

    return journey;
  }

  getSeasonalEmotions(dateContext) {
    const seasonalEmotions = {
      spring: {
        primary: 'Renewal, Optimism, Growth',
        secondary: 'Energy, Fresh starts',
        messaging: 'Emphasize transformation and new beginnings'
      },
      summer: {
        primary: 'Freedom, Adventure, Joy',
        secondary: 'Relaxation, Fun',
        messaging: 'Focus on liberation and enjoyment'
      },
      fall: {
        primary: 'Productivity, Achievement, Preparation',
        secondary: 'Focus, Determination',
        messaging: 'Highlight efficiency and getting things done'
      },
      winter: {
        primary: 'Comfort, Security, Connection',
        secondary: 'Warmth, Togetherness',
        messaging: 'Emphasize safety and belonging'
      }
    };

    return seasonalEmotions[dateContext.season];
  }

  async createBehavioralNudges(persuasionMap, emotionalJourney) {
    console.log('   👆 Creating behavioral nudges...');

    const nudges = [
      {
        type: 'Default Bias',
        where: 'Signup form',
        implementation: 'Pre-select recommended plan',
        impact: 'high',
        example: 'Pro plan (recommended) ✓'
      },
      {
        type: 'Progress Bar',
        where: 'Onboarding',
        implementation: 'Show completion percentage',
        impact: 'high',
        example: '"You\'re 80% done! Just one more step"'
      },
      {
        type: 'Social Proof Counter',
        where: 'Homepage',
        implementation: 'Live user count',
        impact: 'medium',
        example: '"1,247 people signed up this week"'
      },
      {
        type: 'Anchoring',
        where: 'Pricing page',
        implementation: 'Show "before" price crossed out',
        impact: 'high',
        example: '<del>$99</del> $49 (limited time)'
      },
      {
        type: 'Foot-in-the-Door',
        where: 'Landing page',
        implementation: 'Small ask first (email), then bigger ask (signup)',
        impact: 'medium',
        example: '"Get free guide" → "Create free account"'
      },
      {
        type: 'Loss Aversion',
        where: 'Exit intent popup',
        implementation: 'Show what they\'ll miss',
        impact: 'high',
        example: '"Wait! Don\'t miss out on [benefit]"'
      },
      {
        type: 'Peak-End Rule',
        where: 'User experience',
        implementation: 'Create memorable moments + great ending',
        impact: 'critical',
        example: 'Celebrate user milestones, send surprise rewards'
      }
    ];

    return nudges;
  }

  async generateCopyFormulas(triggers, emotionalJourney) {
    console.log('   ✍️ Generating copy formulas...');

    return {
      headlines: {
        formula: 'Problem + Solution + Benefit',
        examples: [
          '[Do X] Without [Pain Point] in [Time Frame]',
          'The [Superlative] Way to [Achieve Desire]',
          '[Number] Ways to [Benefit] (Even if [Objection])'
        ],
        realExamples: [
          'Build Apps in Minutes Without Coding',
          'The Fastest Way to Launch Your Startup',
          '10 Ways to Grow Revenue (Even if You\'re Just Starting)'
        ]
      },
      body_copy: {
        formula: 'PAS (Problem-Agitate-Solve)',
        structure: [
          '1. Identify the problem',
          '2. Agitate the pain',
          '3. Present your solution',
          '4. Show proof',
          '5. Call to action'
        ],
        example: `"Tired of spending months building software? (Problem)
Every day wasted is potential revenue lost. Your competitors are already launching. (Agitate)
Launch AI builds production-ready apps in minutes, not months. (Solution)
Join 10,000+ founders who've already launched. (Proof)
Start building free today. (CTA)"`
      },
      cta_buttons: {
        avoid: ['Submit', 'Buy Now', 'Sign Up'],
        use: [
          'Start Building Free',
          'Get Instant Access',
          'Yes, I Want [Benefit]',
          'Show Me How',
          'Count Me In'
        ],
        reasoning: 'Action-oriented, benefit-focused, low friction'
      },
      email_subject_lines: {
        formulas: [
          '[Name], you left [item] behind',
          'Quick question about [topic]',
          '[Number] [timeframe] to [benefit]',
          'You\'re missing out on [benefit]'
        ],
        examples: [
          'John, you left your app unfinished',
          'Quick question about your startup',
          '3 days to launch your MVP',
          'You\'re missing out on early access'
        ]
      }
    };
  }

  async designConversionFunnels(persuasionMap, behavioralNudges) {
    console.log('   🔄 Designing conversion funnels...');

    return {
      homepage_funnel: {
        steps: [
          {
            step: 1,
            action: 'Capture attention',
            psychology: ['Curiosity', 'Pattern Interrupt'],
            implementation: 'Provocative headline + hero image',
            cta: 'See How It Works'
          },
          {
            step: 2,
            action: 'Build interest',
            psychology: ['Social Proof', 'Authority'],
            implementation: 'Show stats + testimonials',
            cta: 'Join 10,000+ Users'
          },
          {
            step: 3,
            action: 'Create desire',
            psychology: ['FOMO', 'Reciprocity'],
            implementation: 'Free trial offer',
            cta: 'Start Free Trial'
          }
        ],
        expected_conversion: '15-25%'
      },
      pricing_funnel: {
        steps: [
          {
            step: 1,
            action: 'Anchor expectations',
            psychology: ['Anchoring Effect'],
            implementation: 'Show most expensive plan first',
            note: 'Makes other plans look affordable'
          },
          {
            step: 2,
            action: 'Highlight value',
            psychology: ['Loss Aversion'],
            implementation: 'Show what they get vs what they miss',
            cta: 'Get Full Access'
          },
          {
            step: 3,
            action: 'Remove friction',
            psychology: ['Risk Reversal'],
            implementation: 'Money-back guarantee + no credit card',
            cta: 'Start Free, Upgrade Anytime'
          }
        ],
        expected_conversion: '5-15%'
      }
    };
  }

  generateImplementationGuide(triggers, persuasionMap, copyFormulas) {
    return {
      priority_order: [
        {
          priority: 1,
          element: 'Headlines',
          reason: 'First impression - determines if users stay',
          implement: copyFormulas.headlines.examples
        },
        {
          priority: 2,
          element: 'Social Proof',
          reason: 'Builds trust immediately',
          implement: 'Add testimonials, user counts, trust badges'
        },
        {
          priority: 3,
          element: 'Clear CTAs',
          reason: 'Guide users to desired action',
          implement: copyFormulas.cta_buttons.use
        },
        {
          priority: 4,
          element: 'Risk Reversal',
          reason: 'Removes purchase anxiety',
          implement: 'Money-back guarantee, free trial, no credit card'
        },
        {
          priority: 5,
          element: 'Scarcity/Urgency',
          reason: 'Motivates immediate action',
          implement: 'Limited time offers, countdown timers'
        }
      ],
      quick_wins: [
        'Add "Join X users" to homepage',
        'Change CTA from "Sign Up" to "Start Building Free"',
        'Add progress bar to onboarding',
        'Show social proof on pricing page',
        'Add exit intent popup with offer'
      ]
    };
  }

  getCorePsychologyPrinciples() {
    return [
      {
        principle: 'Social Proof',
        description: 'People follow what others do',
        where: 'Homepage, testimonials, user counts',
        implementation: 'Show real numbers, testimonials, trust badges'
      },
      {
        principle: 'Scarcity',
        description: 'People value what\'s limited',
        where: 'Pricing page, CTAs',
        implementation: 'Limited time offers, "Only X spots left"'
      },
      {
        principle: 'Authority',
        description: 'People trust experts',
        where: 'About page, team section',
        implementation: 'Show credentials, experience, achievements'
      },
      {
        principle: 'Reciprocity',
        description: 'People feel obligated to give back',
        where: 'Landing page, content marketing',
        implementation: 'Free tools, guides, trials'
      },
      {
        principle: 'Commitment',
        description: 'Small yes leads to big yes',
        where: 'Onboarding flow',
        implementation: 'Multi-step process, progress indicators'
      },
      {
        principle: 'Liking',
        description: 'People buy from those they like',
        where: 'Brand voice, team page',
        implementation: 'Personal stories, relatable messaging'
      }
    ];
  }

  getDefaultPsychologyStrategy() {
    return {
      principles: this.getCorePsychologyPrinciples(),
      psychologyTriggers: this.getUniversalTriggers(),
      implementation: {
        priority_order: [
          { priority: 1, element: 'Social Proof', implement: 'Add testimonials' },
          { priority: 2, element: 'Clear CTAs', implement: 'Use action verbs' }
        ]
      }
    };
  }

  getDefaultPersuasionMap() {
    return {
      awareness_stage: {
        psychology: 'Curiosity',
        messaging: 'Capture attention with bold promise',
        examples: ['"Build apps in minutes"']
      },
      decision_stage: {
        psychology: 'Trust + Urgency',
        messaging: 'Prove value and create urgency',
        examples: ['"Start free today"']
      }
    };
  }
}

module.exports = PsychologyAgentUltra;