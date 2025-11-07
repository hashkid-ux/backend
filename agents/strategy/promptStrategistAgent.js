// agents/strategy/promptStrategistAgent.js
// Strategic Prompt Agent - Converts research chaos into clean build directives

const AIClient = require('../../services/aiClient');

class PromptStrategistAgent {
  constructor(tier = 'free') {
    this.tier = tier;
    this.client = new AIClient(process.env.OPENROUTER_API_KEY);
    this.model = 'qwen/qwen-2.5-coder-32b-instruct:free';
  }

  async distillIntoPrompts(phase1, phase2, projectData) {
    console.log('🎯 Strategic Prompt Agent: Distilling research into clean directives...');

    const jsonInstructions = `CRITICAL JSON RULES:
1. Return ONLY valid JSON
2. No markdown code blocks
3. No explanations
4. Start with {
5. End with }
6. No trailing commas
7. Maximum response: 3000 tokens
`;

    const prompt = jsonInstructions + `Convert this research into EXACT, ACTIONABLE build directives.

PROJECT: ${projectData.projectName}
DESCRIPTION: ${projectData.description}

RESEARCH SUMMARY:
- Competitors: ${phase1.competitors?.total_analyzed || 0}
- Market Level: ${phase1.market?.competition_level || 'unknown'}
- Top Gap: ${phase1.market?.market_gaps?.[0]?.gap || 'Not specified'}
- Advantages: ${phase2.competitive_advantages?.slice(0, 3).map(a => a.feature).join(', ') || 'None'}
- Features: ${phase2.features_prioritized?.slice(0, 5).map(f => f.name).join(', ') || 'None'}
- UX Principles: ${phase2.ux_strategy?.principles?.slice(0, 3).map(p => p.principle).join(', ') || 'None'}

Convert into CLEAN DIRECTIVES (no raw data dumps):

{
  "frontend_directives": {
    "pages": [
      {
        "name": "HomePage",
        "purpose": "Landing page with hero + features",
        "components_needed": ["Hero", "FeatureGrid", "Testimonials", "CTA"],
        "design_specs": {
          "theme": "dark mode with gradient",
          "colors": "purple-blue gradient bg-slate-900",
          "layout": "full-width hero, 3-column features"
        },
        "content_specs": {
          "hero_headline": "Exact headline based on project",
          "hero_subtext": "Value proposition",
          "social_proof": "Join X users" if competitors exist,
          "cta_text": "Start Building Free"
        },
        "psychology_triggers": ["Social proof counter", "Scarcity timer if applicable"],
        "interactions": ["Smooth scroll", "Hover effects on cards"]
      }
    ],
    "components": [
      {
        "name": "Navbar",
        "features": ["Logo", "Navigation links", "CTA button", "Mobile menu"],
        "design": "Sticky, transparent on scroll, glass effect"
      },
      {
        "name": "Footer",
        "features": ["Links", "Social icons", "Copyright"],
        "design": "Minimal, centered"
      }
    ],
    "shared_specs": {
      "icons": "lucide-react",
      "animations": "smooth transitions, fade-ins",
      "responsive": "mobile-first, breakpoints at 768px and 1024px"
    }
  },
  "backend_directives": {
    "apis": [
      {
        "route": "/api/auth/register",
        "method": "POST",
        "purpose": "User registration",
        "features": ["Email validation", "Password hash (bcrypt)", "JWT generation"],
        "validation": ["Email format", "Password min 6 chars"],
        "response": "Return JWT token + user object",
        "security": ["Rate limit 5/min", "Sanitize inputs"]
      },
      {
        "route": "/api/auth/login",
        "method": "POST",
        "purpose": "User login",
        "features": ["Credentials validation", "JWT generation"],
        "security": ["Rate limit 10/min", "Hash comparison"]
      }
    ],
    "middleware": [
      {
        "name": "auth",
        "purpose": "JWT verification",
        "features": ["Extract token from header", "Verify signature", "Attach user to req"]
      },
      {
        "name": "errorHandler",
        "purpose": "Global error handling",
        "features": ["Catch all errors", "Log errors", "Return formatted response"]
      }
    ],
    "shared_specs": {
      "auth": "JWT with 7d expiry",
      "validation": "express-validator for all inputs",
      "error_format": "{ success: false, error: 'message' }"
    }
  },
  "database_directives": {
    "tables": [
      {
        "name": "User",
        "purpose": "Store user accounts",
        "fields": [
          "id (UUID, primary key)",
          "email (unique, not null)",
          "password (hashed, not null)",
          "createdAt (timestamp)",
          "updatedAt (timestamp)"
        ],
        "indexes": ["email"],
        "relations": []
      }
    ],
    "shared_specs": {
      "orm": "Prisma",
      "audit_fields": "All tables get createdAt, updatedAt",
      "ids": "UUID format"
    }
  },
  "priority_order": [
    "1. Generate User table + auth middleware",
    "2. Generate auth endpoints (register, login)",
    "3. Generate HomePage with hero + features",
    "4. Generate Navbar + Footer",
    "5. Connect frontend to backend APIs"
  ]
}

BE SPECIFIC. NO VAGUE TERMS. NO RAW DATA DUMPS.`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 3000,
        temperature: 0.1,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0].text;
      const cleaned = this.extractCleanJSON(content);
      
      if (!cleaned) {
        console.error('❌ Strategist failed, using fallback directives');
        return this.getFallbackDirectives(projectData, phase2);
      }

      const directives = JSON.parse(cleaned);
      console.log('✅ Directives generated:', {
        pages: directives.frontend_directives?.pages?.length || 0,
        components: directives.frontend_directives?.components?.length || 0,
        apis: directives.backend_directives?.apis?.length || 0,
        tables: directives.database_directives?.tables?.length || 0
      });

      return directives;

    } catch (error) {
      console.error('❌ Strategist error:', error.message);
      return this.getFallbackDirectives(projectData, phase2);
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