// agents/codegen/frontendAgentUltra.js
// ULTRA Frontend Agent - Self-Debugging, Context-Aware, Dynamic

const aiClient = require('../../services/aiClient');

class FrontendAgentUltra {
  constructor(tier = 'free') {
    this.tier = tier;
    this.client = new aiClient(process.env.OPENROUTER_API_KEY);
    this.model = 'qwen/qwen-2.5-coder-32b-instruct:free';
    this.maxRetries = 3;
  }

  async generateAppUltra(projectData) {
    console.log('⚛️  ULTRA Frontend Agent: Starting with strategic directives...');

    let attempt = 0;
    let lastError = null;

    while (attempt < this.maxRetries) {
      try {
        attempt++;
        console.log(`   🔄 Attempt ${attempt}/${this.maxRetries}`);

        // NEW: Check if we have clean directives
        const hasDirectives = projectData.frontend_directives && 
                             projectData.frontend_directives.pages;

        let architecture;
        
        if (hasDirectives) {
          // Use directives to plan architecture
          console.log('   ✅ Using strategic directives for architecture');
          architecture = this.architectureFromDirectives(projectData.frontend_directives);
        } else {
          // Fallback to original planning
          console.log('   ⚠️ No directives, using original planning');
          architecture = await this.planArchitecture(projectData);
        }
        
        console.log(`   ✅ Architecture planned: ${architecture.totalFiles} files`);

        // PHASE 2: Generate all files dynamically
        const files = await this.generateDynamicFiles(projectData, architecture);
        console.log(`   ✅ Generated ${Object.keys(files).length} files`);

        // Rest of validation remains same...
        const validation = await this.validateCode(files);
        
        if (validation.isValid) {
          console.log('   ✅ Code validated successfully');
          return {
            files,
            architecture,
            stats: this.calculateStats(files),
            validation,
            psychologyIntegrated: true
          };
        }

        console.log(`   ⚠️  Validation failed: ${validation.errors.join(', ')}`);
        console.log('   🔧 Self-debugging...');
        
        const fixedFiles = await this.selfDebug(files, validation.errors, projectData);
        const revalidation = await this.validateCode(fixedFiles);
        
        if (revalidation.isValid) {
          console.log('   ✅ Self-debug successful!');
          return {
            files: fixedFiles,
            architecture,
            stats: this.calculateStats(fixedFiles),
            validation: revalidation,
            psychologyIntegrated: true,
            selfDebugged: true
          };
        }

        lastError = validation.errors;

      } catch (error) {
        console.error(`   ❌ Attempt ${attempt} failed:`, error.message);
        lastError = error;
        
        if (attempt < this.maxRetries) {
          console.log('   🔄 Retrying with refined approach...');
          await this.sleep(2000);
        }
      }
    }

    throw new Error(`Frontend generation failed after ${this.maxRetries} attempts: ${lastError}`);
  }

  // NEW METHOD: Convert directives to architecture
  architectureFromDirectives(directives) {
    const pages = directives.pages || [];
    const components = directives.components || [];
    
    return {
      totalFiles: pages.length + components.length + 10, // +10 for core files
      fileStructure: {
        pages: pages.map(p => ({
          name: p.name,
          path: `src/pages/${p.name}.jsx`,
          purpose: p.purpose,
          components: p.components_needed,
          design: p.design_specs,
          content: p.content_specs,
          priority: 'critical'
        })),
        components: components.map(c => ({
          name: c.name,
          path: `src/components/${c.name}.jsx`,
          purpose: c.features.join(', '),
          design: c.design,
          reusable: true,
          priority: 'critical'
        })),
        services: [
          {
            name: 'api',
            path: 'src/services/api.js',
            purpose: 'API client',
            priority: 'critical'
          }
        ],
        contexts: [],
        utils: [
          {
            name: 'helpers',
            path: 'src/utils/helpers.js',
            purpose: 'Utility functions',
            priority: 'medium'
          }
        ],
        hooks: []
      },
      techStack: {
        framework: 'React 18',
        routing: 'React Router v6',
        styling: 'Tailwind CSS',
        state: 'Context API + Hooks',
        http: 'Axios'
      },
      directives_used: true
    };
  }

  async planArchitecture(projectData) {
    console.log('📐 Planning intelligent architecture...');

    const {
      projectName,
      description,
      features,
      competitive_advantages,
      ux_principles,
      psychology_triggers,
      dateContext
    } = projectData;

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

    const prompt = jsonInstructions +`You are an expert React architect. Plan a PRODUCTION-READY architecture.

PROJECT: ${projectName}
DESCRIPTION: ${description}
FEATURES: ${JSON.stringify(features || [])}
COMPETITIVE ADVANTAGES: ${JSON.stringify(competitive_advantages?.slice(0, 5) || [])}
UX PRINCIPLES: ${JSON.stringify(ux_principles?.slice(0, 5) || [])}
PSYCHOLOGY TRIGGERS: ${JSON.stringify(psychology_triggers?.slice(0, 3) || [])}
CURRENT SEASON: ${dateContext?.season || 'Unknown'}

Plan the OPTIMAL file structure. Return ONLY this JSON:
{
  "totalFiles": 0,
  "fileStructure": {
    "pages": [
      {
        "name": "HomePage",
        "path": "src/pages/HomePage.jsx",
        "purpose": "Main landing page",
        "features": ["Hero section", "Features showcase"],
        "psychologyTriggers": ["Social proof", "Scarcity"],
        "priority": "critical"
      }
    ],
    "components": [
      {
        "name": "Navbar",
        "path": "src/components/Navbar.jsx",
        "purpose": "Navigation",
        "reusable": true,
        "priority": "critical"
      }
    ],
    "services": [
      {
        "name": "api",
        "path": "src/services/api.js",
        "purpose": "API client",
        "priority": "critical"
      }
    ],
    "contexts": [
      {
        "name": "AuthContext",
        "path": "src/contexts/AuthContext.js",
        "purpose": "Authentication state",
        "priority": "high"
      }
    ],
    "utils": [
      {
        "name": "helpers",
        "path": "src/utils/helpers.js",
        "purpose": "Utility functions",
        "priority": "medium"
      }
    ],
    "hooks": [
      {
        "name": "useAuth",
        "path": "src/hooks/useAuth.js",
        "purpose": "Authentication hook",
        "priority": "high"
      }
    ]
  },
  "techStack": {
    "framework": "React 18",
    "routing": "React Router v6",
    "styling": "Tailwind CSS",
    "state": "Context API + Hooks",
    "http": "Axios"
  },
  "features": ["List of features to implement"],
  "integrations": ["Third-party integrations needed"]
}

CRITICAL: Plan based on ACTUAL features needed, not generic templates. If simple project, fewer files.`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0].text;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('Failed to parse architecture plan');
      }

      const architecture = JSON.parse(jsonMatch[0]);
      
      // Calculate total files
      architecture.totalFiles = 
        (architecture.fileStructure.pages?.length || 0) +
        (architecture.fileStructure.components?.length || 0) +
        (architecture.fileStructure.services?.length || 0) +
        (architecture.fileStructure.contexts?.length || 0) +
        (architecture.fileStructure.utils?.length || 0) +
        (architecture.fileStructure.hooks?.length || 0) +
        5; // Core files (App, index, package.json, etc.)

      return architecture;
    } catch (error) {
      console.error('❌ Architecture planning failed:', error.message);
      return this.getDefaultArchitecture(projectData);
    }
  }


// === USAGE: Replace existing generators ===

async generateDynamicFiles(projectData, architecture) {
  console.log('🔨 Generating files (QUALITY-FIRST)...');
  const files = {};
  
  let aiGeneratedCount = 0;
  let templateUsedCount = 0;

  // PAGES - Try AI first, fallback to template
  const pages = architecture.fileStructure.pages || [];
  
  for (const page of pages) {
    try {
      // CRITICAL: Validate before using
      this.validateBeforeGeneration(page, 'page');
      
      const code = await this.generatePage(page, projectData);
      const validation = this.validateGeneratedCode(code, page.path);
      
      if (validation.valid) {
        files[page.path] = code;
        aiGeneratedCount++;
        console.log(`✅ AI-generated: ${page.name}`);
      } else {
        throw new Error(validation.reason);
      }
      
    } catch (error) {
      console.error(`⚠️ AI failed for ${page.name}: ${error.message}`);
      files[page.path] = this.getFallbackPage(page, projectData);
      templateUsedCount++;
    }
  }
  
  // COMPONENTS - Always use templates (faster, reliable)
  for (const component of architecture.fileStructure.components || []) {
    files[component.path] = this.getFallbackComponent(component);
  }
  
  // Log quality metrics
  console.log(`📊 Quality: ${aiGeneratedCount} AI-generated, ${templateUsedCount} templates`);
  
  if (templateUsedCount > pages.length * 0.5) {
    console.warn('⚠️ WARNING: >50% templates used - quality degraded');
  }
  
  return files;
}

// NEW: Pre-generation validation
validateBeforeGeneration(config, type) {
  const { name, path } = config;
  
  // Validate naming
  if (type === 'page' && !/^[A-Z][a-zA-Z0-9]*Page$/.test(name)) {
    throw new Error(`Invalid page name: ${name} (must end with 'Page')`);
  }
  
  // Validate path
  if (path.includes('..') || path.startsWith('/')) {
    throw new Error(`Invalid path: ${path}`);
  }
  
  return true;
}


// NEW METHOD: Add this after generateDynamicFiles
async generatePagesBatch(pages, projectData) {
  if (pages.length === 0) return {};
  
  const prompt = `Generate ${pages.length} React pages. Return valid JSON only.

PROJECT: ${projectData.projectName}

PAGES:
${pages.map((p, i) => `${i + 1}. ${p.name} - ${p.purpose}`).join('\n')}

Return JSON:
{
  "pages": {
    "${pages[0].path}": "import React from 'react'; function ${pages[0].name}() { return <div>...</div>; } export default ${pages[0].name};",
    "${pages[1]?.path || 'src/pages/Page2.jsx'}": "..."
  }
}

Each page: imports, Helmet, export default. No markdown.`;

  try {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 8000,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0].text;
    const cleaned = this.extractCleanJSON(content);
    
    if (cleaned) {
      const parsed = JSON.parse(cleaned);
      console.log(`✅ Generated ${Object.keys(parsed.pages || {}).length} pages in 1 call`);
      return parsed.pages || {};
    }
  } catch (error) {
    console.error('Batch failed:', error.message);
  }

  const fallback = {};
  pages.forEach(page => {
    fallback[page.path] = this.getFallbackPage(page, projectData);
  });
  return fallback;
}

extractCleanJSON(text) {
  // Remove markdown
  text = text.replace(/```(?:json)?\s*/g, '').replace(/```\s*$/g, '');
  
  // Remove artifacts
  text = text
    .replace(/<\|[^|]*\|>/g, '')
    .replace(/\|begin_of_sentence\|/gi, '')
    .replace(/\|end_of_turn\|/gi, '')
    .replace(/\|eot_id\|/gi, '');
  
  // Find JSON boundaries
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  
  if (start === -1 || end === -1 || end <= start) return null;
  
  let json = text.substring(start, end + 1);
  
  // Fix common issues
  json = json
    .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ');
  
  // Try to parse
  try {
    JSON.parse(json);
    return json;
  } catch (e) {
    // If error, try to truncate at error position
    const match = e.message.match(/position (\d+)/);
    if (match) {
      const pos = parseInt(match[1]);
      const lastBrace = json.lastIndexOf('}', pos);
      if (lastBrace > 0) {
        return json.substring(0, lastBrace + 1);
      }
    }
    return null;
  }
}

// NEW METHOD: Template service (no AI)
getTemplateService(serviceConfig) {
  return `import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

apiClient.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = \`Bearer \${token}\`;
  }
  return config;
});

apiClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;`;
}

// === FALLBACK GENERATORS ===

getFallbackApp(projectData, architecture) {
  const pages = architecture?.fileStructure?.pages || [];
  
  return `import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

${pages.slice(0, 3).map(p => `import ${p.name} from './pages/${p.name}';`).join('\n')}

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-900">
        <Routes>
          <Route path="/" element={<${pages[0]?.name || 'div'} />} />
          ${pages.slice(1, 3).map(p => `<Route path="/${p.name.toLowerCase()}" element={<${p.name} />} />`).join('\n          ')}
        </Routes>
      </div>
    </Router>
  );
}

export default App;`;
}

getFallbackPage(pageConfig, projectData) {
  const name = pageConfig.name || 'Page';
  const purpose = pageConfig.purpose || 'Page content';
  
  return `import React, { useState } from 'react';
import { Helmet } from 'react-helmet';

function ${name}() {
  const [loading, setLoading] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600">
      <Helmet>
        <title>${name} - ${projectData?.projectName || 'App'}</title>
      </Helmet>
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-white mb-8">
          ${purpose}
        </h1>
        <p className="text-white text-lg">
          This page is part of ${projectData?.projectName || 'your application'}.
        </p>
      </div>
    </div>
  );
}

export default ${name};`;
}

getFallbackComponent(componentConfig) {
  const name = componentConfig.name || 'Component';
  
  return `import React from 'react';
import PropTypes from 'prop-types';

function ${name}({ children, className }) {
  return (
    <div className={\`\${className || ''}\`}>
      {children || <p>${componentConfig.purpose || 'Component'}</p>}
    </div>
  );
}

${name}.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string
};

export default ${name};`;
}

  async generateAppComponent(projectData, architecture) {
    const prompt = `Generate a PRODUCTION-READY React App.js component.

PROJECT: ${projectData.projectName}
ARCHITECTURE: ${JSON.stringify(architecture.fileStructure, null, 2)}
PSYCHOLOGY TRIGGERS: ${JSON.stringify(projectData.psychology_triggers?.slice(0, 3) || [])}

Generate complete App.js with:
- React Router v6 setup
- All routes for pages
- AuthContext provider
- Error boundary
- Loading states
- Responsive navigation

CRITICAL RULES:
1. Return ONLY executable JavaScript code
2. NO markdown, NO explanations, NO comments outside code
3. Use functional components with React hooks

Generate the complete component now.`;


    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    let code = response.content[0].text;
    // 🔥 NEW: Inject analytics tracker
  code = this.injectAnalytics(code, projectData.projectId);
    
    // AGGRESSIVE CLEANING - Apply BEFORE any processing
    code = this.aggressiveClean(code);
    
    return code.trim();
  }
   

  async generatePage(pageConfig, projectData) {
    // NEW: Check if we have directive-based config
    const hasDirective = pageConfig.design && pageConfig.content;
    
    let prompt;
    
    if (hasDirective) {
      // Use clean directive-based prompt
      prompt = `Generate PRODUCTION-READY React page component.

COMPONENT: ${pageConfig.name}
PURPOSE: ${pageConfig.purpose}

EXACT REQUIREMENTS:
${pageConfig.components?.map(c => `- Include ${c} component`).join('\n') || '- Functional page layout'}

DESIGN SPECS:
- Theme: ${pageConfig.design?.theme || 'modern dark'}
- Colors: ${pageConfig.design?.colors || 'bg-slate-900'}
- Layout: ${pageConfig.design?.layout || 'centered'}

CONTENT SPECS:
- Headline: "${pageConfig.content?.hero_headline || projectData.projectName}"
- Subtext: "${pageConfig.content?.hero_subtext || projectData.description}"
- CTA: "${pageConfig.content?.cta_text || 'Get Started'}"
${pageConfig.content?.social_proof ? `- Social Proof: "${pageConfig.content.social_proof}"` : ''}

PSYCHOLOGY:
${pageConfig.psychology_triggers?.map(t => `- ${t}`).join('\n') || '- Build trust'}

INTERACTIONS:
${pageConfig.interactions?.map(i => `- ${i}`).join('\n') || '- Smooth transitions'}

CRITICAL RULES:
1. Start with: import React, { useState, useEffect } from 'react';
2. Import Helmet: import { Helmet } from 'react-helmet';
3. Functional component ONLY
4. Export default at end
5. NO markdown, NO explanations

Generate complete working component now.`;

    } else {
      // Fallback to original prompt
      prompt = `Generate PRODUCTION-READY React page.

PAGE: ${pageConfig.name}
PURPOSE: ${pageConfig.purpose}

CRITICAL RULES:
1. Start with: import React, { useState, useEffect } from 'react';
2. Import Helmet: import { Helmet } from 'react-helmet';
3. Functional component ONLY
4. Export default at end
5. NO markdown, NO explanations

Generate COMPLETE working page.`;
    }

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 5000,
      messages: [{ role: 'user', content: prompt }]
    });

    let code = this.aggressiveClean(response.content[0].text);
    
    // Force-inject imports if missing
    if (!code.includes('import React')) {
      code = `import React, { useState, useEffect } from 'react';\nimport { Helmet } from 'react-helmet';\n\n${code}`;
    }
    
    // Validate structure
    if (!this.validateComponent(code, pageConfig.name)) {
      console.error(`❌ ${pageConfig.name} validation failed, using template`);
      return this.getFallbackPage(pageConfig, projectData);
    }
    
    return code.trim();
  }

// ← REPLACE THIS ENTIRE FUNCTION
validateComponent(code, name) {
  // Minimum viable validation - don't be pedantic
  const hasReact = /import.*from\s+['"]react['"]/i.test(code);
  const hasComponent = new RegExp(`(function|const)\\s+${name}`, 'i').test(code);
  const hasExport = /export\s+(default|{.*})/i.test(code);
  const minLength = code.length > 50;
  
  // Pass if core structure exists (ignore artifacts)
  return hasReact && hasComponent && hasExport && minLength;
}

getFallbackPage(pageConfig, projectData) {
  return `import React from 'react';
import { Helmet } from 'react-helmet';

function ${pageConfig.name}() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 text-white">
      <Helmet>
        <title>${pageConfig.name} • ${projectData.projectName}</title>
      </Helmet>

      <div className="bg-white/10 backdrop-blur-lg p-10 rounded-2xl shadow-2xl max-w-lg w-full text-center border border-white/20">
        <div className="mb-6">
          <h1 className="text-5xl font-extrabold tracking-tight mb-4 drop-shadow-md">
            ${pageConfig.purpose || "Page Unavailable"}
          </h1>
          <p className="text-lg text-white/90">
            This is a fallback page for <span className="font-semibold">${projectData.projectName}</span>.
          </p>
        </div>

        <div className="animate-pulse mt-10">
          <div className="h-3 w-3 rounded-full bg-white inline-block mx-1"></div>
          <div className="h-3 w-3 rounded-full bg-white/70 inline-block mx-1"></div>
          <div className="h-3 w-3 rounded-full bg-white/50 inline-block mx-1"></div>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="mt-10 px-6 py-3 bg-white text-purple-700 font-semibold rounded-lg shadow-md hover:bg-purple-100 transition-all"
        >
          Retry
        </button>
      </div>

      <footer className="absolute bottom-6 text-sm text-white/70">
        © ${new Date().getFullYear()} ${projectData.projectName}. All rights reserved.
      </footer>
    </div>
  );
}

export default ${pageConfig.name};
`;
}

 // 🔥 NUCLEAR CODE CLEANER - Add to ALL agents

// Replace aggressiveClean in frontendAgentUltra.js, backendAgentUltra.js:

aggressiveClean(code) {
  if (!code || typeof code !== 'string') return '';
  
  // Remove ALL artifacts
  let cleaned = code
    .replace(/```[\w]*\n?/g, '')
    .replace(/```\s*$/g, '')
    .replace(/<\|[^|]*\|>/g, '')
    .replace(/\|begin_of_sentence\|/gi, '')
    .replace(/\|end_of_turn\|/gi, '')
    .replace(/\|start_header_id\|/gi, '')
    .replace(/\|end_header_id\|/gi, '')
    .replace(/\|eot_id\|/gi, '')
    .replace(/\|assistant\|/gi, '')
    .replace(/\|user\|/gi, '')
    .replace(/[│▁▂▃▄▅▆▇█]/g, '')
    .replace(/[\u2500-\u257F]/g, '')
    .replace(/[\u2580-\u259F]/g, '')
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\n{4,}/g, '\n\n\n');
  
  // Validate it's real code
  const hasValidStart = /^(import|const|function|class|\/\/|\/\*|\s*$)/.test(cleaned.trim());
  const hasCode = /\w+/.test(cleaned);
  const hasBraces = cleaned.includes('{') || cleaned.includes('(');
  
  if (!hasValidStart || !hasCode || !hasBraces) return '';
  
  // Final contamination check
  const contaminated = ['│', '▁', '<|', '|>', '|begin', '|end', '|eot', '|assistant'];
  for (const marker of contaminated) {
    if (cleaned.includes(marker)) return '';
  }
  
  return cleaned.trim();
}

// === NEW: Post-generation validation ===
validateGeneratedCode(code, filepath) {
  // Minimum length
  if (code.length < 100) {
    return { valid: false, reason: 'Code too short (<100 chars)' };
  }
  
  // Must have imports
  if (!code.includes('import') && !code.includes('require')) {
    return { valid: false, reason: 'No imports found' };
  }
  
  // Must have export
  if (!code.includes('export default') && !code.includes('module.exports')) {
    return { valid: false, reason: 'No export found' };
  }
  
  // Check for contamination
  const contamination = ['│', '▁', '<|', '|>', '|begin', '|end'];
  for (const marker of contamination) {
    if (code.includes(marker)) {
      return { valid: false, reason: `Contamination: ${marker}` };
    }
  }
  
  // Check balanced brackets
  const opens = (code.match(/[{[(]/g) || []).length;
  const closes = (code.match(/[}\])]/g) || []).length;
  if (Math.abs(opens - closes) > 2) {
    return { valid: false, reason: 'Unbalanced brackets' };
  }
  
  return { valid: true };
}


  async generateComponent(componentConfig, projectData) {
    const prompt = `Generate a PRODUCTION-READY React component.

PROJECT: ${projectData.projectName}
COMPONENT: ${componentConfig.name}
PURPOSE: ${componentConfig.purpose}
REUSABLE: ${componentConfig.reusable}

Generate complete ${componentConfig.name}.jsx with:
- Functional component
- PropTypes validation
- Tailwind CSS styling
- Accessible (ARIA labels)
- Responsive
- Smooth animations

Return ONLY the complete JavaScript code, no markdown.`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    let code = response.content[0].text;
    code = code.replace(/```(?:javascript|jsx|js)?\n?/g, '').replace(/```\n?$/g, '');
    
    return code.trim();
  }

  async generateService(serviceConfig, projectData) {
    const prompt = `Generate a PRODUCTION-READY service module.

SERVICE: ${serviceConfig.name}
PURPOSE: ${serviceConfig.purpose}

Generate complete ${serviceConfig.name}.js with:
- Axios instance configured
- Request interceptor (auth tokens)
- Response interceptor (error handling)
- All CRUD methods
- Token refresh logic
- Error handling

Return ONLY the complete JavaScript code, no markdown.`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    let code = response.content[0].text;
    code = code.replace(/```(?:javascript|jsx|js)?\n?/g, '').replace(/```\n?$/g, '');
    
    return code.trim();
  }

  async generateContext(contextConfig, projectData) {
    const prompt = `Generate a PRODUCTION-READY React Context.

CONTEXT: ${contextConfig.name}
PURPOSE: ${contextConfig.purpose}

Generate complete ${contextConfig.name}.js with:
- Context creation
- Provider component
- Custom hook (use${contextConfig.name.replace('Context', '')})
- State management
- Actions/methods
- LocalStorage persistence (if auth)

Return ONLY the complete JavaScript code, no markdown.`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    let code = response.content[0].text;
    code = code.replace(/```(?:javascript|jsx|js)?\n?/g, '').replace(/```\n?$/g, '');
    
    return code.trim();
  }

  async generateUtil(utilConfig, projectData) {
    const code = `// ${utilConfig.path}
// ${utilConfig.purpose}

export const formatDate = (date) => {
  return new Date(date).toLocaleDateString();
};

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
};

export const truncateText = (text, maxLength = 100) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};`;

    return code;
  }

  async generateHook(hookConfig, projectData) {
    const prompt = `Generate a PRODUCTION-READY custom React hook.

HOOK: ${hookConfig.name}
PURPOSE: ${hookConfig.purpose}

Generate complete ${hookConfig.name}.js with:
- Proper hook structure
- Error handling
- Loading states
- Cleanup on unmount
- TypeScript-like JSDoc comments

Return ONLY the complete JavaScript code, no markdown.`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    });

    let code = response.content[0].text;
    code = code.replace(/```(?:javascript|jsx|js)?\n?/g, '').replace(/```\n?$/g, '');
    
    return code.trim();
  }

  async validateCode(files) {
    console.log('🔍 Validating generated code...');

    const errors = [];
    const warnings = [];

    // 1. Check critical files exist
    const requiredFiles = ['src/App.js', 'src/index.js', 'package.json', 'public/index.html'];
    for (const file of requiredFiles) {
      if (!files[file]) {
        errors.push(`Missing critical file: ${file}`);
      }
    }

    // 2. Validate syntax for all JS files
    for (const [filename, code] of Object.entries(files)) {
      if (filename.endsWith('.js') || filename.endsWith('.jsx')) {
        // Check balanced brackets
        if (!this.isBalanced(code, '{', '}')) errors.push(`${filename}: Unbalanced braces`);
        if (!this.isBalanced(code, '(', ')')) errors.push(`${filename}: Unbalanced parentheses`);
        if (!this.isBalanced(code, '[', ']')) errors.push(`${filename}: Unbalanced brackets`);
        
        // Check for React 18
        if (filename.includes('index.js') && !code.includes('createRoot')) {
          errors.push(`${filename}: Must use React 18 createRoot`);
        }
        
        // Check for class components (not allowed)
        if (code.includes('class ') && code.includes('extends Component')) {
          errors.push(`${filename}: Class components not allowed, use functional`);
        }
        
        // Check for TODOs
        if (code.includes('TODO') || code.includes('FIXME')) {
          warnings.push(`${filename}: Contains TODO/FIXME`);
        }
      }
    }

    // 3. Validate package.json
    if (files['package.json']) {
      try {
        const pkg = JSON.parse(files['package.json']);
        if (!pkg.dependencies?.react) errors.push('package.json: Missing React');
        if (!pkg.dependencies?.['react-dom']) errors.push('package.json: Missing ReactDOM');
        if (!pkg.scripts?.start) errors.push('package.json: No start script');
      } catch (e) {
        errors.push('package.json: Invalid JSON');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score: this.calculateValidationScore(errors, warnings)
    };
  }

  async selfDebug(files, errors, projectData) {
    console.log('🔧 Self-debugging code...');

    const prompt = `Fix these errors in the React application:

ERRORS:
${errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}

CURRENT FILES (sample):
${Object.keys(files).slice(0, 10).join(', ')}

Fix these issues:
1. Balance all brackets/braces/parentheses
2. Use React 18 createRoot (not ReactDOM.render)
3. Use functional components only (no classes)
4. Remove all TODO/FIXME comments
5. Ensure all required files exist

Return JSON with fixed files:
{
  "fixes": [
    {
      "file": "src/index.js",
      "issue": "Not using createRoot",
      "fix": "complete corrected code"
    }
  ]
}

Return ONLY valid JSON.`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 6000,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0].text;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const fixData = JSON.parse(jsonMatch[0]);
        
        // Apply fixes
        const fixedFiles = { ...files };
        fixData.fixes?.forEach(fix => {
          if (fix.file && fix.fix) {
            fixedFiles[fix.file] = fix.fix;
            console.log(`   ✅ Fixed: ${fix.file}`);
          }
        });
        
        return fixedFiles;
      }

      console.warn('⚠️ Self-debug failed to parse, returning original');
      return files;
    } catch (error) {
      console.error('❌ Self-debug error:', error.message);
      return files;
    }
  }

  // 🔥 NEW METHOD

injectAnalytics(appCode, projectId) {
  // STEP 1: Find App component (multiple syntaxes)
  const patterns = [
    { regex: /function\s+App\s*\([^)]*\)\s*\{/, type: 'function' },
    { regex: /const\s+App\s*=\s*\([^)]*\)\s*=>\s*\{/, type: 'arrow' },
    { regex: /export\s+default\s+function\s+App\s*\([^)]*\)\s*\{/, type: 'export' }
  ];
  
  let match = null;
  let matchType = null;
  
  for (const { regex, type } of patterns) {
    match = appCode.match(regex);
    if (match) {
      matchType = type;
      break;
    }
  }
  
  if (!match) {
    console.warn('⚠️ Cannot inject analytics - App component not found');
    return appCode;
  }
  
  // STEP 2: Check if already injected
  if (appCode.includes('AnalyticsTracker') || appCode.includes('/api/analytics/track')) {
    return appCode;
  }
  
  // STEP 3: Build analytics component
  const analyticsCode = `
// Analytics Tracker
function AnalyticsTracker() {
  const location = window.location;
  
  React.useEffect(() => {
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: '${projectId}',
        event: 'page_view',
        page: location.pathname
      })
    }).catch(() => {});
  }, [location.pathname]);
  
  return null;
}
`;
  
  // STEP 4: Add useEffect import if missing
  let finalCode = appCode;
  if (!finalCode.includes('useEffect')) {
    finalCode = finalCode.replace(
      /import\s+React.*from\s+['"]react['"]/,
      "import React, { useEffect } from 'react'"
    );
  }
  
  // STEP 5: Inject before App component
  const injectPos = match.index;
  finalCode = finalCode.slice(0, injectPos) + 
              analyticsCode + '\n' + 
              finalCode.slice(injectPos);
  
  // STEP 6: Add tracker to JSX return
  const returnMatch = finalCode.match(/return\s*\(/);
  if (returnMatch) {
    const returnPos = returnMatch.index + returnMatch[0].length;
    const beforeReturn = finalCode.slice(0, returnPos);
    const afterReturn = finalCode.slice(returnPos);
    
    // Add as first child
    const withTracker = afterReturn.replace(
      /^\s*(<[^>]+>|<>)/,
      (m) => `${m}\n      <AnalyticsTracker />`
    );
    
    finalCode = beforeReturn + withTracker;
  }
  
  return finalCode;
}

  isBalanced(code, open, close) {
    let count = 0;
    for (const char of code) {
      if (char === open) count++;
      if (char === close) count--;
      if (count < 0) return false;
    }
    return count === 0;
  }

  calculateValidationScore(errors, warnings) {
    let score = 100;
    score -= errors.length * 15;
    score -= warnings.length * 5;
    return Math.max(0, score);
  }

  calculateStats(files) {
    const fileCount = Object.keys(files).length;
    const totalLines = Object.values(files).reduce((sum, code) => 
      sum + code.split('\n').length, 0
    );

    return {
      total_files: fileCount,
      total_lines: totalLines,
      total_size_kb: (Object.values(files).reduce((sum, code) => sum + code.length, 0) / 1024).toFixed(2),
      components: Object.keys(files).filter(f => f.includes('components/')).length,
      pages: Object.keys(files).filter(f => f.includes('pages/')).length,
      services: Object.keys(files).filter(f => f.includes('services/')).length
    };
  }

  // TEMPLATE GENERATORS
  generateIndexHtml(projectData) {
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#667eea" />
    <meta name="description" content="${projectData.description || projectData.projectName}" />
    <title>${projectData.projectName}</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>`;
  }

  generateReactIndex(projectData) {
    return `import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;
  }

  generateTailwindCSS() {
    return `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-slate-900 text-slate-100;
  }
}`;
  }

  generatePackageJson(projectData) {
    return JSON.stringify({
      name: projectData.projectName.toLowerCase().replace(/\s+/g, '-'),
      version: '1.0.0',
      description: projectData.description,
      dependencies: {
        react: '^18.2.0',
        'react-dom': '^18.2.0',
        'react-router-dom': '^6.20.0',
        axios: '^1.6.0'
      },
      devDependencies: {
        tailwindcss: '^3.4.0',
        autoprefixer: '^10.4.0',
        postcss: '^8.4.0'
      },
      scripts: {
        start: 'react-scripts start',
        build: 'react-scripts build',
        test: 'react-scripts test',
        eject: 'react-scripts eject'
      }
    }, null, 2);
  }

  generateTailwindConfig() {
    return `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#667eea',
        secondary: '#764ba2'
      }
    }
  },
  plugins: []
};`;
  }

  generateREADME(projectData) {
    return `# ${projectData.projectName}

Built with Launch AI 🚀

## Quick Start

\`\`\`bash
npm install
npm start
\`\`\`

Visit http://localhost:3000

## Features

${projectData.features?.map(f => `- ${f}`).join('\n') || '- Modern React app'}

## Tech Stack

- React 18
- Tailwind CSS
- React Router v6
- Axios

---
Generated by Launch AI
`;
  }

  getDefaultArchitecture(projectData) {
    return {
      totalFiles: 15,
      fileStructure: {
        pages: [
          { name: 'HomePage', path: 'src/pages/HomePage.jsx', purpose: 'Landing page', priority: 'critical' },
          { name: 'DashboardPage', path: 'src/pages/DashboardPage.jsx', purpose: 'User dashboard', priority: 'high' }
        ],
        components: [
          { name: 'Navbar', path: 'src/components/Navbar.jsx', purpose: 'Navigation', reusable: true, priority: 'critical' },
          { name: 'Footer', path: 'src/components/Footer.jsx', purpose: 'Footer', reusable: true, priority: 'medium' }
        ],
        services: [
          { name: 'api', path: 'src/services/api.js', purpose: 'API client', priority: 'critical' }
        ],
        contexts: [
          { name: 'AuthContext', path: 'src/contexts/AuthContext.js', purpose: 'Auth state', priority: 'high' }
        ],
        utils: [
          { name: 'helpers', path: 'src/utils/helpers.js', purpose: 'Utilities', priority: 'medium' }
        ],
        hooks: []
      },
      techStack: {
        framework: 'React 18',
        routing: 'React Router v6',
        styling: 'Tailwind CSS',
        state: 'Context API',
        http: 'Axios'
      }
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}


module.exports = FrontendAgentUltra;