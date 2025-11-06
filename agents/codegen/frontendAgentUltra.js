// agents/codegen/frontendAgentUltra.js
// ULTRA Frontend Agent - Self-Debugging, Context-Aware, Dynamic

const AIClient = require('../../services/aiClient');

class FrontendAgentUltra {
  constructor(tier = 'free') {
    this.tier = tier;
    this.client = new AIClient(process.env.OPENROUTER_API_KEY);
    this.model = 'qwen/qwen-2.5-coder-32b-instruct:free';
    this.maxRetries = 3;
  }

  async generateAppUltra(projectData) {
    console.log('⚛️  ULTRA Frontend Agent: Starting intelligent generation...');

    let attempt = 0;
    let lastError = null;

    while (attempt < this.maxRetries) {
      try {
        attempt++;
        console.log(`   🔄 Attempt ${attempt}/${this.maxRetries}`);

        // PHASE 1: Analyze requirements and plan architecture
        const architecture = await this.planArchitecture(projectData);
        console.log(`   ✅ Architecture planned: ${architecture.totalFiles} files`);

        // PHASE 2: Generate all files dynamically
        const files = await this.generateDynamicFiles(projectData, architecture);
        console.log(`   ✅ Generated ${Object.keys(files).length} files`);

        // PHASE 3: Validate code
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

        // PHASE 4: Self-debug if validation failed
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

  async generateDynamicFiles(projectData, architecture) {
    console.log('🔨 Generating files dynamically...');

    const files = {};

    // CORE FILES (always needed)
    files['public/index.html'] = this.generateIndexHtml(projectData);
    files['src/index.js'] = this.generateReactIndex(projectData);
    files['src/index.css'] = this.generateTailwindCSS();
    files['package.json'] = this.generatePackageJson(projectData);
    files['tailwind.config.js'] = this.generateTailwindConfig();
    files['README.md'] = this.generateREADME(projectData);

    // GENERATE App.js with AI
    const appJs = await this.generateAppComponent(projectData, architecture);
    files['src/App.js'] = appJs;

    // GENERATE PAGES
    for (const page of architecture.fileStructure.pages || []) {
      const pageCode = await this.generatePage(page, projectData);
      files[page.path] = pageCode;
    }

    // GENERATE COMPONENTS
    for (const component of architecture.fileStructure.components || []) {
      const componentCode = await this.generateComponent(component, projectData);
      files[component.path] = componentCode;
    }

    // GENERATE SERVICES
    for (const service of architecture.fileStructure.services || []) {
      const serviceCode = await this.generateService(service, projectData);
      files[service.path] = serviceCode;
    }

    // GENERATE CONTEXTS
    for (const context of architecture.fileStructure.contexts || []) {
      const contextCode = await this.generateContext(context, projectData);
      files[context.path] = contextCode;
    }

    // GENERATE UTILS
    for (const util of architecture.fileStructure.utils || []) {
      const utilCode = await this.generateUtil(util, projectData);
      files[util.path] = utilCode;
    }

    // GENERATE HOOKS
    for (const hook of architecture.fileStructure.hooks || []) {
      const hookCode = await this.generateHook(hook, projectData);
      files[hook.path] = hookCode;
    }

    return files;
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
    const prompt = `Generate PRODUCTION-READY React page.

PAGE: ${pageConfig.name}
PURPOSE: ${pageConfig.purpose}

CRITICAL RULES:
1. Start with: import React, { useState, useEffect } from 'react';
2. Import Helmet: import { Helmet } from 'react-helmet';
3. ALL components must be functional
4. NO class components
5. Export default at end

Generate COMPLETE working page:`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    let code = this.aggressiveClean(response.content[0].text);
    
    // 🔥 NEW: Force-inject imports if missing
    if (!code.includes('import React')) {
      code = `import React, { useState, useEffect } from 'react';\nimport { Helmet } from 'react-helmet';\n\n${code}`;
    }
    
    // 🔥 NEW: Validate structure
    if (!this.validateComponent(code, pageConfig.name)) {
      console.error(`❌ ${pageConfig.name} validation failed, using template`);
      return this.getFallbackPage(pageConfig, projectData);
    }
    
    return code.trim();
  }

// 🔥 NEW: Add validation method
validateComponent(code, name) {
  return code.includes('import React') &&
         code.includes(`function ${name}`) &&
         code.includes('export default') &&
         code.length > 100 &&
         !code.includes('│') &&
         !code.includes('▁');
}

// 🔥 NEW: Fallback templates
getFallbackPage(pageConfig, projectData) {
  return `import React, { useState } from 'react';
import { Helmet } from 'react-helmet';

function ${pageConfig.name}() {
  const [loading, setLoading] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600">
      <Helmet>
        <title>${pageConfig.name} - ${projectData.projectName}</title>
      </Helmet>
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-white mb-8">
          ${pageConfig.purpose}
        </h1>
        <p className="text-white text-lg">
          This page is part of ${projectData.projectName}.
        </p>
      </div>
    </div>
  );
}

export default ${pageConfig.name};`;
}

  // Add this NEW method to the class
aggressiveClean(code) {
  if (!code) return '';
  
  // Step 1: Remove ALL non-code artifacts
  let cleaned = code
    // Remove markdown blocks
    .replace(/```[\w]*\n?/g, '')
    .replace(/```\s*$/g, '')
    
    // Remove tokenization artifacts (CRITICAL)
    .replace(/<\|.*?\|>/g, '')
    .replace(/\|begin_of_sentence\|/gi, '')
    .replace(/\|end_of_turn\|/gi, '')
    .replace(/\|start_header_id\|/gi, '')
    .replace(/\|end_header_id\|/gi, '')
    .replace(/[｜▁]/g, '')
    
    // Remove BOM and invisible characters
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    
    // Remove triple+ newlines
    .replace(/\n{3,}/g, '\n\n')
    
    .trim();
  
  // Step 2: Validate it's actually code
  if (cleaned.length < 20) return '';
  if (!cleaned.includes('function') && !cleaned.includes('const')) return '';
  if (cleaned.includes('｜') || cleaned.includes('▁')) {
    console.error('❌ CONTAMINATED CODE DETECTED - Using fallback');
    return '';
  }
  
  return cleaned;
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
  const analyticsCode = `
// Launch AI Analytics
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

function AnalyticsTracker() {
  const location = useLocation();
  
  useEffect(() => {
    // Track page views
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: '${projectId}',
        event: 'page_view',
        page: location.pathname
      })
    }).catch(console.error);
  }, [location]);
  
  // Track errors
  useEffect(() => {
    const handleError = (event) => {
      fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: '${projectId}',
          event: 'error',
          error: event.error?.message,
          stack: event.error?.stack
        })
      }).catch(console.error);
    };
    
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);
  
  return null;
}
`;

  // Insert before return statement in App component
  return appCode.replace(
    'return (',
    `${analyticsCode}\n  return (\n    <>\n      <AnalyticsTracker />`
  ).replace(/return\s*\(/g, (match, offset, string) => {
    // Only replace the first occurrence in App component
    if (offset === string.indexOf('return (')) {
      return `${analyticsCode}\n  return (\n    <>\n      <AnalyticsTracker />`;
    }
    return match;
  });
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