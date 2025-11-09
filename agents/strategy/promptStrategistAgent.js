// agents/strategy/promptStrategistAgent.js
// Strategic Prompt Agent - Converts research chaos into clean build directives

const aiClient = require('../../services/aiClient');

class PromptStrategistAgent {
  constructor(tier = 'free') {
    this.tier = tier;
    this.client = new aiClient(process.env.OPENROUTER_API_KEY);
    this.model = 'deepseek/deepseek-chat-v3.1:free';
  }

  // ← REPLACE THIS ENTIRE METHOD
async distillIntoPrompts(phase1, phase2, projectData) {
  console.log('🎯 Strategic Prompt Agent: Distilling research into clean directives...');
  
  // STEP 1: Extract concrete insights
  const insights = this.extractConcreteInsights(phase1, phase2);
  
  const jsonInstructions = `CRITICAL JSON RULES:
1. Return ONLY valid JSON
2. No markdown code blocks
3. No explanations
4. Start with {
5. End with }
6. No trailing commas
7. Maximum response: 3000 tokens
`;

  const prompt = jsonInstructions + `Convert research into EXACT build directives using CONCRETE insights.

PROJECT: ${projectData.projectName}
DESCRIPTION: ${projectData.description}

CONCRETE RESEARCH INSIGHTS (USE THESE EXACT VALUES):
- Top Competitor Feature: "${insights.topFeature}"
- Most Complained Issue: "${insights.topComplaint}"
- Emerging Trend: "${insights.hotTrend}"
- Main User Pain: "${insights.mainPain}"
- Competitor Weakness: "${insights.competitorWeakness}"
- Market Size: ${insights.marketSize}
- Competition: ${insights.competitionLevel}
${insights.userCount ? `- Social Proof: ${insights.userCount} users` : ''}
${insights.scarcityTrigger ? `- Urgency: ${insights.scarcityTrigger} approaching` : ''}

CRITICAL: Use these EXACT insights in homepage directives:

{
  "frontend_directives": {
    "pages": [
      {
        "name": "HomePage",
        "purpose": "Landing page addressing: ${insights.mainPain}",
        "components_needed": ["Hero", "FeatureGrid", "Testimonials", "CTA"],
        "design_specs": {
          "theme": "modern dark gradient",
          "colors": "bg-gradient-to-br from-purple-900 via-blue-900 to-slate-900",
          "layout": "hero with problem/solution, 3-col features, social proof"
        },
        "content_specs": {
          "hero_headline": "Solve ${insights.mainPain} with ${insights.topFeature}",
          "hero_subtext": "Unlike competitors who struggle with ${insights.competitorWeakness}, we deliver ${insights.topFeature}",
          "social_proof": ${insights.userCount ? `"Join ${insights.userCount} professionals"` : '"Trusted by industry leaders"'},
          "cta_text": "Start Free Today",
          "urgency": ${insights.scarcityTrigger ? `"${insights.scarcityTrigger} - Limited spots"` : 'null'}
        },
        "psychology_triggers": [
          "Social proof counter showing ${insights.userCount || 'live users'}",
          "Problem agitation: Current solutions have ${insights.topComplaint}",
          "Solution: We solve ${insights.mainPain}",
          ${insights.scarcityTrigger ? `"Scarcity: ${insights.scarcityTrigger}"` : ''}
        ],
        "interactions": ["Smooth scroll", "Hover lift on cards", "Gradient animation"]
      }
    ],
    "components": [
      {
        "name": "Navbar",
        "features": ["Logo", "Nav links", "CTA button with ${insights.topFeature}", "Mobile menu"],
        "design": "Sticky transparent, glass morphism on scroll"
      },
      {
        "name": "Footer",
        "features": ["Links", "Social proof: ${insights.userCount || 'Growing community'}", "Copyright"],
        "design": "Minimal gradient footer"
      }
    ],
    "shared_specs": {
      "icons": "lucide-react",
      "animations": "framer-motion if available, else CSS transitions",
      "responsive": "mobile-first, breakpoints 768px/1024px",
      "copy_tone": "Address ${insights.mainPain} directly, highlight ${insights.topFeature}"
    }
  },
  "backend_directives": {
    "apis": [
      {
        "route": "/api/auth/register",
        "method": "POST",
        "purpose": "User registration with ${insights.topFeature} access",
        "features": ["Email validation", "Password hash bcrypt", "JWT 7d expiry"],
        "validation": ["Email format", "Password min 6 chars"],
        "response": "JWT token + user object",
        "security": ["Rate limit 5/min", "Sanitize inputs"]
      },
      {
        "route": "/api/auth/login",
        "method": "POST",
        "purpose": "Login to access ${insights.topFeature}",
        "features": ["Credentials validation", "JWT generation"],
        "security": ["Rate limit 10/min"]
      }
    ],
    "middleware": [
      {
        "name": "auth",
        "purpose": "JWT verification for ${insights.topFeature} access",
        "features": ["Extract token", "Verify", "Attach user"]
      }
    ],
    "shared_specs": {
      "auth": "JWT 7d expiry",
      "validation": "express-validator",
      "error_format": "{ success: false, error: 'message' }"
    }
  },
  "database_directives": {
    "tables": [
      {
        "name": "User",
        "purpose": "Store users accessing ${insights.topFeature}",
        "fields": ["id UUID primary", "email unique", "password hashed", "createdAt", "updatedAt"],
        "indexes": ["email"],
        "relations": []
      }
    ],
    "shared_specs": {
      "orm": "Prisma",
      "audit_fields": "createdAt, updatedAt on all tables",
      "ids": "UUID v4"
    }
  },
  "priority_order": [
    "1. User table + auth",
    "2. Auth endpoints",
    "3. HomePage with EXACT research insights",
    "4. Components"
  ]
}

USE EXACT INSIGHTS. NO GENERIC PLACEHOLDERS.`;

  try {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 3000,
      temperature: 0.05, // Lower for more consistency
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0].text;
    const cleaned = this.extractCleanJSON(content);
    
    if (!cleaned) {
      console.error('❌ Strategist failed, using fallback with insights');
      return this.getFallbackDirectivesWithInsights(projectData, phase2, insights);
    }

    const directives = JSON.parse(cleaned);
    console.log('✅ Directives with research insights generated');

    return directives;

  } catch (error) {
    console.error('❌ Strategist error:', error.message);
    return this.getFallbackDirectivesWithInsights(projectData, phase2, insights);
  }
}

  extractCleanJSON(text) {
    text = text.replace(/```(?:json)?\s*/g, '').replace(/```\s*$/g, '');
    
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    
    if (start === -1 || end === -1) return null;
    
    let json = text.substring(start, end + 1);
    json = json.replace(/,(\s*[}\]])/g, '$1');
    
    try {
      JSON.parse(json);
      return json;
    } catch (e) {
      return null;
    }
  }

  // ← ADD THIS NEW METHOD
extractConcreteInsights(phase1, phase2) {
  const insights = {
    // Top feature from competitive advantages
    topFeature: phase2.competitive_advantages?.[0]?.feature || 
                'Advanced features that competitors lack',
    
    // Most complained issue
    topComplaint: phase1.reviews?.insights?.top_complaints?.[0]?.complaint ||
                  phase1.market?.market_gaps?.[0]?.gap ||
                  'Complexity and poor user experience',
    
    // Hottest trend
    hotTrend: phase1.trends?.emerging_trends?.[0]?.trend ||
              'AI and automation integration',
    
    // Main pain point
    mainPain: phase1.market?.market_gaps?.[0]?.gap ||
              'Finding reliable solutions in the market',
    
    // Social proof
    userCount: phase1.competitors?.total_analyzed > 5 ? '10,000+' : 
               phase1.competitors?.total_analyzed > 0 ? '1,000+' : null,
    
    // Urgency trigger
    scarcityTrigger: phase1.trends?.seasonal_opportunities?.[0]?.event ||
                     phase1.dateContext?.upcomingEvents?.[0]?.name ||
                     null,
    
    // Competitor weakness to exploit
    competitorWeakness: phase1.competitors?.individual_analyses?.[0]?.weaknesses?.[0] ||
                        'Outdated technology',
    
    // Market size
    marketSize: phase1.market?.market_overview?.size || 'Growing',
    
    // Competition level
    competitionLevel: phase1.market?.competition_level || 'moderate'
  };
  
  return insights;
}


// ← ADD THIS NEW METHOD
getFallbackDirectivesWithInsights(projectData, phase2, insights) {
  return {
    frontend_directives: {
      pages: [
        {
          name: 'HomePage',
          purpose: `Solve ${insights.mainPain}`,
          components_needed: ['Hero', 'Features', 'CTA'],
          design_specs: {
            theme: 'dark gradient',
            colors: 'bg-gradient-to-br from-purple-900 to-slate-900',
            layout: 'hero + features grid'
          },
          content_specs: {
            hero_headline: `${projectData.projectName} - ${insights.topFeature}`,
            hero_subtext: `Solve ${insights.mainPain}. Unlike competitors with ${insights.competitorWeakness}.`,
            social_proof: insights.userCount ? `Join ${insights.userCount}` : 'Trusted by professionals',
            cta_text: 'Start Free'
          },
          psychology_triggers: [`Address ${insights.topComplaint}`],
          interactions: ['Smooth scroll']
        }
      ],
      components: [
        {
          name: 'Navbar',
          features: ['Logo', 'Nav', 'CTA'],
          design: 'Sticky header'
        }
      ],
      shared_specs: {
        icons: 'lucide-react',
        animations: 'fade-in',
        responsive: 'mobile-first'
      }
    },
    backend_directives: {
      apis: [
        {
          route: '/api/auth/register',
          method: 'POST',
          purpose: 'Registration',
          features: ['Email validation', 'Password hash', 'JWT'],
          validation: ['Email format'],
          security: ['Rate limit']
        }
      ],
      middleware: [{ name: 'auth', purpose: 'JWT verify' }],
      shared_specs: { auth: 'JWT', validation: 'express-validator' }
    },
    database_directives: {
      tables: [
        {
          name: 'User',
          purpose: 'User accounts',
          fields: ['id', 'email', 'password', 'createdAt'],
          indexes: ['email']
        }
      ],
      shared_specs: { orm: 'Prisma', ids: 'UUID' }
    },
    priority_order: ['1. Auth', '2. HomePage with insights', '3. Components']
  };
}

  getFallbackDirectives(projectData, phase2) {
    return {
      frontend_directives: {
        pages: [
          {
            name: 'HomePage',
            purpose: 'Main landing page',
            components_needed: ['Hero', 'Features', 'CTA'],
            design_specs: {
              theme: 'dark mode',
              colors: 'bg-slate-900 with purple accents',
              layout: 'single column, centered'
            },
            content_specs: {
              hero_headline: projectData.projectName,
              hero_subtext: projectData.description,
              cta_text: 'Get Started'
            },
            psychology_triggers: ['Social proof'],
            interactions: ['Smooth scroll']
          }
        ],
        components: [
          {
            name: 'Navbar',
            features: ['Logo', 'Nav links', 'CTA button'],
            design: 'Sticky header'
          }
        ],
        shared_specs: {
          icons: 'lucide-react',
          animations: 'fade-in',
          responsive: 'mobile-first'
        }
      },
      backend_directives: {
        apis: [
          {
            route: '/api/auth/register',
            method: 'POST',
            purpose: 'User registration',
            features: ['Email validation', 'Password hash', 'JWT'],
            validation: ['Email format', 'Password length'],
            response: 'JWT token',
            security: ['Rate limit']
          }
        ],
        middleware: [
          {
            name: 'auth',
            purpose: 'JWT verification',
            features: ['Token validation']
          }
        ],
        shared_specs: {
          auth: 'JWT',
          validation: 'express-validator',
          error_format: 'JSON'
        }
      },
      database_directives: {
        tables: [
          {
            name: 'User',
            purpose: 'User accounts',
            fields: ['id', 'email', 'password', 'createdAt'],
            indexes: ['email'],
            relations: []
          }
        ],
        shared_specs: {
          orm: 'Prisma',
          audit_fields: 'createdAt, updatedAt',
          ids: 'UUID'
        }
      },
      priority_order: [
        '1. Auth system',
        '2. HomePage',
        '3. Components'
      ]
    };
  }
}

module.exports = PromptStrategistAgent;