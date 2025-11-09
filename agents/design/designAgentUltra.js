// agents/design/designAgentUltra.js
// 🎨 DESIGN AGENT ULTRA - Visual Intelligence with Llama 4 Maverick
// Analyzes competitor screenshots → Creates complete design system

const aiClient = require('../../services/aiClient');

class DesignAgentUltra {
  constructor(tier = 'free') {
    this.tier = tier;
    this.visionModel = 'meta-llama/llama-4-maverick:free'; // Image analysis
    this.strategyModel = 'openai/chatgpt-4o-latest'; // Design strategy
    this.client = new aiClient(process.env.OPENROUTER_API_KEY);
  }

  async analyzeCompetitorDesigns(screenshots, projectData) {
    console.log('🎨 Design Agent: Analyzing competitor UIs with vision AI...');

    try {
      // PHASE 1: Visual analysis of each screenshot
      const visualAnalyses = await this.analyzeScreenshots(screenshots);
      console.log(`✅ Analyzed ${visualAnalyses.length} competitor designs`);

      // PHASE 2: Extract design patterns
      const designPatterns = await this.extractDesignPatterns(visualAnalyses);
      console.log('✅ Extracted common design patterns');

      // PHASE 3: Create design system
      const designSystem = await this.createDesignSystem(
        designPatterns,
        projectData,
        visualAnalyses
      );
      console.log('✅ Generated complete design system');

      // PHASE 4: Generate component specifications
      const componentSpecs = await this.generateComponentSpecs(designSystem, projectData);
      console.log('✅ Generated component specifications');

      return {
        designSystem,
        componentSpecs,
        visualAnalyses,
        designPatterns,
        competitorInsights: this.summarizeInsights(visualAnalyses),
        _meta: {
          screenshots_analyzed: screenshots.length,
          tier: this.tier,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('❌ Design analysis failed:', error.message);
      return this.getFallbackDesignSystem(projectData);
    }
  }

  // 🖼️ PHASE 1: Analyze screenshots with vision AI
  async analyzeScreenshots(screenshots) {
    console.log('   🔍 Running vision AI on screenshots...');
    
    const analyses = [];

    for (const screenshot of screenshots.slice(0, 5)) { // Analyze top 5
      try {
        const analysis = await this.analyzeWithVision(screenshot);
        analyses.push(analysis);
      } catch (error) {
        console.warn(`   ⚠️ Failed to analyze ${screenshot.url}`);
      }
    }

    return analyses;
  }

  async analyzeWithVision(screenshot) {
    const prompt = `Analyze this website/app screenshot in extreme detail.

CRITICAL: Return ONLY valid JSON with this exact structure:
{
  "url": "${screenshot.url}",
  "overall_impression": "Professional/Modern/Dated/Cluttered/Clean",
  "color_scheme": {
    "primary_colors": ["#hex1", "#hex2"],
    "secondary_colors": ["#hex3"],
    "background": "#hex",
    "text": "#hex",
    "accents": ["#hex4"]
  },
  "typography": {
    "heading_font": "Font family name",
    "body_font": "Font family name",
    "heading_sizes": ["64px", "48px", "32px"],
    "body_size": "16px",
    "line_height": "1.5",
    "font_weight_scale": ["400", "600", "700"]
  },
  "layout": {
    "type": "Grid/Flexbox/Mixed",
    "columns": "12-col/flexible",
    "spacing_system": "8px base unit",
    "max_width": "1200px",
    "gutters": "24px"
  },
  "navigation": {
    "type": "Top bar/Sidebar/Bottom/Floating",
    "style": "Transparent/Solid/Glass/Minimal",
    "sticky": true,
    "menu_items": 5
  },
  "hero_section": {
    "layout": "Centered/Left-aligned/Split",
    "has_image": true,
    "has_video": false,
    "cta_prominence": "High/Medium/Low"
  },
  "components_used": [
    {
      "component": "Button",
      "style": "Rounded/Sharp/Pill",
      "size": "Large/Medium/Small",
      "variants": ["Primary", "Secondary"]
    },
    {
      "component": "Card",
      "style": "Elevated/Flat/Outlined",
      "has_shadow": true,
      "border_radius": "12px"
    }
  ],
  "visual_hierarchy": {
    "primary_focus": "Hero CTA",
    "secondary_focus": "Features grid",
    "visual_flow": "Z-pattern/F-pattern/Center-out"
  },
  "animations": {
    "has_animations": true,
    "types": ["Fade in", "Slide up", "Parallax"],
    "intensity": "Subtle/Moderate/Heavy"
  },
  "responsiveness": {
    "mobile_friendly": true,
    "breakpoints_visible": ["768px", "1024px"],
    "mobile_navigation": "Hamburger/Bottom bar"
  },
  "unique_elements": [
    "Interactive background gradient",
    "Floating action button",
    "Testimonial carousel"
  ],
  "strengths": [
    "Clean visual hierarchy",
    "Strong call-to-action",
    "Professional color palette"
  ],
  "weaknesses": [
    "Dense text sections",
    "Inconsistent spacing"
  ],
  "modern_score": 85,
  "ux_score": 90
}

Return ONLY the JSON, no markdown, no explanations.`;

    const response = await this.client.messages.create({
      model: this.visionModel,
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: screenshot.imageUrl }
            }
          ]
        }
      ]
    });

    const content = response.content[0].text;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    throw new Error('Failed to parse vision analysis');
  }

  // 🧩 PHASE 2: Extract patterns from analyses
  async extractDesignPatterns(analyses) {
    console.log('   🧩 Extracting common design patterns...');

    // Aggregate data
    const patterns = {
      colorSchemes: this.aggregateColors(analyses),
      typography: this.aggregateTypography(analyses),
      layoutPatterns: this.aggregateLayouts(analyses),
      componentStyles: this.aggregateComponents(analyses),
      navigationStyles: this.aggregateNavigation(analyses),
      modernityScore: this.calculateAverageModernity(analyses)
    };

    return patterns;
  }

  aggregateColors(analyses) {
    const allColors = analyses.flatMap(a => [
      ...(a.color_scheme?.primary_colors || []),
      ...(a.color_scheme?.secondary_colors || []),
      ...(a.color_scheme?.accents || [])
    ]);

    // Find most common colors
    const colorFrequency = {};
    allColors.forEach(color => {
      colorFrequency[color] = (colorFrequency[color] || 0) + 1;
    });

    const sortedColors = Object.entries(colorFrequency)
      .sort((a, b) => b[1] - a[1])
      .map(([color]) => color);

    return {
      trending_colors: sortedColors.slice(0, 8),
      popular_backgrounds: analyses.map(a => a.color_scheme?.background).filter(Boolean),
      color_temperature: this.analyzeColorTemperature(sortedColors),
      recommendations: this.generateColorRecommendations(sortedColors)
    };
  }

  aggregateTypography(analyses) {
    const fonts = {
      headings: analyses.map(a => a.typography?.heading_font).filter(Boolean),
      body: analyses.map(a => a.typography?.body_font).filter(Boolean)
    };

    return {
      trending_heading_fonts: [...new Set(fonts.headings)].slice(0, 3),
      trending_body_fonts: [...new Set(fonts.body)].slice(0, 3),
      average_heading_size: this.calculateAverage(
        analyses.map(a => parseInt(a.typography?.heading_sizes?.[0]) || 48)
      ),
      average_body_size: '16px',
      recommended_scale: ['64px', '48px', '32px', '24px', '18px', '16px', '14px']
    };
  }

  aggregateLayouts(analyses) {
    return {
      most_common_type: this.getMostCommon(analyses.map(a => a.layout?.type)),
      average_max_width: '1200px',
      common_spacing_unit: '8px',
      popular_grid_systems: ['12-column', 'CSS Grid', 'Flexbox']
    };
  }

  aggregateComponents(analyses) {
    const allComponents = analyses.flatMap(a => a.components_used || []);
    
    return {
      button_styles: {
        most_common: this.getMostCommon(allComponents.filter(c => c.component === 'Button').map(c => c.style)),
        recommended: 'Rounded with slight elevation'
      },
      card_styles: {
        most_common: this.getMostCommon(allComponents.filter(c => c.component === 'Card').map(c => c.style)),
        recommended: 'Subtle shadow, 12px radius'
      },
      input_styles: {
        recommended: 'Outlined with focus ring'
      }
    };
  }

  aggregateNavigation(analyses) {
    return {
      most_common_type: this.getMostCommon(analyses.map(a => a.navigation?.type)),
      sticky_percentage: (analyses.filter(a => a.navigation?.sticky).length / analyses.length) * 100,
      recommended: 'Sticky top bar with glass morphism on scroll'
    };
  }

  calculateAverageModernity(analyses) {
    const scores = analyses.map(a => a.modern_score || 70);
    return Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
  }

  // 🎨 PHASE 3: Create complete design system
  async createDesignSystem(patterns, projectData, analyses) {
    console.log('   🎨 Creating design system with AI strategy...');

    const prompt = `Create a COMPLETE, MODERN design system based on competitive analysis.

PROJECT: ${projectData.projectName}
COMPETITIVE ANALYSIS:
- Average Modernity Score: ${patterns.modernityScore}/100
- Trending Colors: ${patterns.colorSchemes.trending_colors.slice(0, 5).join(', ')}
- Popular Layouts: ${patterns.layoutPatterns.most_common_type}
- Button Style: ${patterns.componentStyles.button_styles.most_common}

Create a design system that is:
1. MORE modern than competitors (aim for 95+ modernity)
2. Distinctive but professional
3. Accessible (WCAG AA compliant)
4. Scalable
5. Consistent

Return ONLY valid JSON:
{
  "name": "${projectData.projectName} Design System",
  "colors": {
    "primary": {
      "50": "#hex",
      "100": "#hex",
      "500": "#hex (main)",
      "900": "#hex"
    },
    "secondary": { "50": "#hex", "500": "#hex" },
    "neutral": { "50": "#hex", "900": "#hex" },
    "success": "#hex",
    "warning": "#hex",
    "error": "#hex"
  },
  "typography": {
    "fonts": {
      "heading": "Font name from Google Fonts",
      "body": "Font name from Google Fonts",
      "mono": "Monospace font"
    },
    "scale": {
      "xs": "12px",
      "sm": "14px",
      "base": "16px",
      "lg": "18px",
      "xl": "20px",
      "2xl": "24px",
      "3xl": "32px",
      "4xl": "48px",
      "5xl": "64px"
    },
    "weights": {
      "normal": 400,
      "medium": 500,
      "semibold": 600,
      "bold": 700
    },
    "line_heights": {
      "tight": 1.2,
      "normal": 1.5,
      "relaxed": 1.75
    }
  },
  "spacing": {
    "unit": "8px",
    "scale": ["4px", "8px", "12px", "16px", "24px", "32px", "48px", "64px", "96px"]
  },
  "borders": {
    "radius": {
      "sm": "4px",
      "md": "8px",
      "lg": "12px",
      "xl": "16px",
      "full": "9999px"
    },
    "width": {
      "thin": "1px",
      "medium": "2px",
      "thick": "4px"
    }
  },
  "shadows": {
    "sm": "0 1px 3px rgba(0,0,0,0.12)",
    "md": "0 4px 6px rgba(0,0,0,0.1)",
    "lg": "0 10px 25px rgba(0,0,0,0.15)",
    "xl": "0 20px 40px rgba(0,0,0,0.2)"
  },
  "animations": {
    "durations": {
      "fast": "150ms",
      "normal": "300ms",
      "slow": "500ms"
    },
    "easings": {
      "in": "cubic-bezier(0.4, 0, 1, 1)",
      "out": "cubic-bezier(0, 0, 0.2, 1)",
      "inOut": "cubic-bezier(0.4, 0, 0.2, 1)"
    }
  },
  "breakpoints": {
    "sm": "640px",
    "md": "768px",
    "lg": "1024px",
    "xl": "1280px",
    "2xl": "1536px"
  },
  "component_guidelines": {
    "buttons": {
      "primary": "Solid background, white text, hover lift",
      "secondary": "Outlined, colored text",
      "ghost": "Transparent, hover background"
    },
    "cards": {
      "default": "White bg, subtle shadow, 12px radius",
      "interactive": "Hover lift and glow effect"
    },
    "inputs": {
      "default": "Outlined, focus ring, label animation"
    }
  },
  "accessibility": {
    "min_contrast_ratio": 4.5,
    "focus_indicator": "2px ring with primary color",
    "keyboard_navigation": "Full support"
  }
}`;

    const response = await this.client.messages.create({
      model: this.strategyModel,
      max_tokens: 6000,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0].text;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return this.getDefaultDesignSystem();
  }

  // 📦 PHASE 4: Generate component specs
  async generateComponentSpecs(designSystem, projectData) {
    console.log('   📦 Generating component specifications...');

    return {
      Button: {
        variants: ['primary', 'secondary', 'ghost', 'danger'],
        sizes: ['sm', 'md', 'lg'],
        tailwind_classes: {
          primary: `bg-primary-500 text-white rounded-lg px-4 py-2 hover:bg-primary-600 transition-all hover:-translate-y-0.5 shadow-md hover:shadow-lg`,
          secondary: `border-2 border-primary-500 text-primary-500 rounded-lg px-4 py-2 hover:bg-primary-50 transition-all`
        }
      },
      Card: {
        variants: ['default', 'elevated', 'interactive'],
        tailwind_classes: {
          default: `bg-white rounded-xl p-6 shadow-md`,
          interactive: `bg-white rounded-xl p-6 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer`
        }
      },
      Input: {
        states: ['default', 'focus', 'error', 'disabled'],
        tailwind_classes: {
          default: `w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all`
        }
      },
      Navbar: {
        style: 'sticky top-0 with glass morphism',
        tailwind_classes: `fixed top-0 w-full bg-white/80 backdrop-blur-lg border-b border-gray-200 z-50 transition-all`
      }
    };
  }

  // 🧠 Helper methods
  analyzeColorTemperature(colors) {
    // Simple heuristic: count blues vs reds/oranges
    const cool = colors.filter(c => c.includes('blue') || c.includes('cyan')).length;
    const warm = colors.filter(c => c.includes('red') || c.includes('orange')).length;
    
    return cool > warm ? 'Cool (Blues/Greens)' : warm > cool ? 'Warm (Reds/Oranges)' : 'Balanced';
  }

  generateColorRecommendations(trendingColors) {
    return [
      'Use primary color for CTAs and key actions',
      'Maintain 4.5:1 contrast ratio for text',
      'Limit to 2-3 primary colors + neutrals',
      'Use color to guide user attention'
    ];
  }

  getMostCommon(arr) {
    const counts = {};
    arr.forEach(item => {
      counts[item] = (counts[item] || 0) + 1;
    });
    
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';
  }

  calculateAverage(numbers) {
    return Math.round(numbers.reduce((sum, n) => sum + n, 0) / numbers.length);
  }

  summarizeInsights(analyses) {
    return {
      total_analyzed: analyses.length,
      average_modernity: this.calculateAverageModernity(analyses),
      common_strengths: [...new Set(analyses.flatMap(a => a.strengths || []))].slice(0, 5),
      common_weaknesses: [...new Set(analyses.flatMap(a => a.weaknesses || []))].slice(0, 5),
      top_unique_elements: [...new Set(analyses.flatMap(a => a.unique_elements || []))].slice(0, 8)
    };
  }

  getFallbackDesignSystem(projectData) {
    return {
      designSystem: this.getDefaultDesignSystem(),
      componentSpecs: {
        Button: {
          tailwind_classes: {
            primary: 'bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600'
          }
        }
      },
      note: 'Using default design system (analysis failed)'
    };
  }

  getDefaultDesignSystem() {
    return {
      name: 'Default Design System',
      colors: {
        primary: {
          500: '#3B82F6',
          600: '#2563EB'
        },
        neutral: {
          50: '#F9FAFB',
          900: '#111827'
        }
      },
      typography: {
        fonts: {
          heading: 'Inter',
          body: 'Inter'
        },
        scale: {
          base: '16px',
          xl: '20px',
          '2xl': '24px',
          '4xl': '48px'
        }
      },
      spacing: {
        unit: '8px',
        scale: ['8px', '16px', '24px', '32px', '48px']
      }
    };
  }
}

module.exports = DesignAgentUltra;