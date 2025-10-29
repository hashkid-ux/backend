// backend/agents/codegen/frontendAgent.js
// PRODUCTION-READY Frontend Agent with Self-Correction

const AIClient = require('../../services/aiClient');

class FrontendAgent {
  constructor(tier = 'free') {
    this.tier = tier;
    this.client = new AIClient(process.env.OPENROUTER_API_KEY);
    this.model = 'deepseek/deepseek-chat-v3.1:free';
    this.maxRetries = 3;
  }

  async generateApp(projectData) {
    console.log('⚛️  Frontend Agent: Starting React app generation...');

    let attempt = 0;
    let lastError = null;

    while (attempt < this.maxRetries) {
      try {
        attempt++;
        console.log(`   Attempt ${attempt}/${this.maxRetries}`);

        // Generate entire frontend in ONE call
        const files = await this.generateAllFrontendFiles(projectData);
        
        // Validate generated code
        const validation = await this.validateReactCode(files);
        
        if (validation.isValid) {
          console.log('✅ Frontend code generated and validated');
          return {
            files,
            stats: this.calculateStats(files),
            validation
          };
        }

        // Auto-fix validation errors
        console.log(`⚠️  Validation failed: ${validation.errors.join(', ')}`);
        console.log('🔧 Auto-fixing React issues...');
        
        const fixedFiles = await this.autoFixReactCode(files, validation.errors);
        const revalidation = await this.validateReactCode(fixedFiles);
        
        if (revalidation.isValid) {
          console.log('✅ React issues fixed automatically');
          return {
            files: fixedFiles,
            stats: this.calculateStats(fixedFiles),
            validation: revalidation,
            wasFixed: true
          };
        }

        lastError = validation.errors;

      } catch (error) {
        console.error(`❌ Attempt ${attempt} failed:`, error.message);
        lastError = error;
        
        if (attempt < this.maxRetries) {
          console.log('🔄 Retrying with clearer instructions...');
          await this.sleep(2000);
        }
      }
    }

    throw new Error(`Frontend generation failed after ${this.maxRetries} attempts: ${lastError}`);
  }

  async generateAllFrontendFiles(projectData) {
    const { projectName, description, features, framework = 'react' } = projectData;

    const prompt = `Generate a complete, production-ready React application with ALL necessary files. Return as VALID JSON only.

PROJECT: ${projectName}
DESCRIPTION: ${description}
FEATURES: ${JSON.stringify(features)}
FRAMEWORK: ${framework}

Generate this EXACT JSON structure:
{
  "public/index.html": "HTML with proper meta tags",
  "src/index.js": "React 18 entry point with createRoot",
  "src/App.js": "Main App component with routing",
  "src/index.css": "Tailwind CSS imports",
  "src/pages/HomePage.jsx": "Home page component",
  "src/pages/DashboardPage.jsx": "Dashboard component",
  "src/components/Navbar.jsx": "Navigation component",
  "src/components/Footer.jsx": "Footer component",
  "src/services/api.js": "Axios API client",
  "src/utils/auth.js": "Auth utilities",
  "src/contexts/AuthContext.js": "Auth context provider",
  "package.json": "Complete dependencies",
  "tailwind.config.js": "Tailwind configuration",
  "README.md": "Setup instructions"
}

CRITICAL REQUIREMENTS:
1. ✅ Use React 18 syntax (createRoot, not render)
2. ✅ Functional components with hooks ONLY
3. ✅ React Router v6 for routing
4. ✅ Tailwind CSS for styling (utility classes ONLY)
5. ✅ Axios for API calls with interceptors
6. ✅ Context API for state management
7. ✅ Proper error boundaries
8. ✅ Loading states for async operations
9. ✅ Responsive design (mobile-first)
10. ✅ NO class components
11. ✅ NO inline styles (Tailwind only)
12. ✅ NO placeholder comments - working code only
13. ✅ Proper PropTypes or TypeScript types

APP.JS must include:
- BrowserRouter setup
- Route definitions
- AuthContext provider
- Error boundary
- Navigation component

API SERVICE must include:
- Axios instance with baseURL
- Request interceptor for auth tokens
- Response interceptor for error handling
- Automatic token refresh logic

PACKAGE.JSON must include:
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test"
  }
}

Return ONLY valid JSON. No markdown, no code blocks, just JSON.`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 16000,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0].text;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('AI did not return valid JSON');
    }

    const files = JSON.parse(jsonMatch[0]);
    
    // Ensure critical files exist
    const requiredFiles = ['src/App.js', 'src/index.js', 'package.json', 'public/index.html'];
    for (const file of requiredFiles) {
      if (!files[file]) {
        throw new Error(`Missing critical file: ${file}`);
      }
    }

    return files;
  }

  async validateReactCode(files) {
    console.log('🔍 Validating React code...');
    
    const errors = [];
    const warnings = [];

    // 1. Validate index.js
    const indexJs = files['src/index.js'];
    if (indexJs) {
      if (!indexJs.includes('createRoot')) errors.push('index.js: Must use React 18 createRoot');
      if (!indexJs.includes('import React')) errors.push('index.js: Missing React import');
      if (indexJs.includes('ReactDOM.render')) errors.push('index.js: Using deprecated render method');
    } else {
      errors.push('Missing src/index.js file');
    }

    // 2. Validate App.js
    const appJs = files['src/App.js'];
    if (appJs) {
      if (!appJs.includes('BrowserRouter') && !appJs.includes('Router')) {
        warnings.push('App.js: No routing setup detected');
      }
      if (appJs.includes('class ') && appJs.includes('extends Component')) {
        errors.push('App.js: Using class components (must use functional)');
      }
      if (!appJs.includes('export default')) {
        errors.push('App.js: Missing default export');
      }
    } else {
      errors.push('Missing src/App.js file');
    }

    // 3. Validate package.json
    const packageJson = files['package.json'];
    if (packageJson) {
      try {
        const pkg = JSON.parse(packageJson);
        if (!pkg.dependencies?.react) errors.push('package.json: Missing React dependency');
        if (!pkg.dependencies?.['react-dom']) errors.push('package.json: Missing ReactDOM');
        if (!pkg.scripts?.start) errors.push('package.json: No start script');
        
        // Check React version
        if (pkg.dependencies?.react && !pkg.dependencies.react.includes('18')) {
          warnings.push('package.json: React version should be 18.x');
        }
      } catch (e) {
        errors.push('package.json: Invalid JSON');
      }
    } else {
      errors.push('Missing package.json file');
    }

    // 4. Validate components
    for (const [filename, code] of Object.entries(files)) {
      if (filename.endsWith('.js') || filename.endsWith('.jsx')) {
        // Check syntax
        if (!this.isBalanced(code, '{', '}')) errors.push(`${filename}: Unbalanced braces`);
        if (!this.isBalanced(code, '(', ')')) errors.push(`${filename}: Unbalanced parentheses`);
        
        // Check for class components
        if (code.includes('class ') && code.includes('extends Component')) {
          errors.push(`${filename}: Class components not allowed`);
        }
        
        // Check for inline styles
        if (code.includes('style={{')) {
          warnings.push(`${filename}: Inline styles detected (use Tailwind)`);
        }
        
        // Check for TODO comments
        if (code.includes('TODO') || code.includes('FIXME')) {
          warnings.push(`${filename}: Incomplete implementation`);
        }
      }
    }

    // 5. Validate HTML
    const indexHtml = files['public/index.html'];
    if (indexHtml) {
      if (!indexHtml.includes('<!DOCTYPE html>')) errors.push('index.html: Missing DOCTYPE');
      if (!indexHtml.includes('<div id="root">')) errors.push('index.html: Missing root div');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score: this.calculateValidationScore(errors, warnings)
    };
  }

  async autoFixReactCode(files, errors) {
    console.log('🔧 Auto-fixing React code...');

    const fixPrompt = `Fix these errors in the React application:

ERRORS TO FIX:
${errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}

CURRENT CODE:
${JSON.stringify(files, null, 2)}

Return the FIXED code as JSON with same structure. Requirements:
- Use React 18 createRoot (not ReactDOM.render)
- Functional components only (no classes)
- Proper imports and exports
- Balanced braces/parentheses
- Tailwind CSS classes (no inline styles)
- Complete implementations (no TODOs)
- Valid package.json with React 18

Return ONLY valid JSON, no explanations.`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 16000,
      messages: [{ role: 'user', content: fixPrompt }]
    });

    const content = response.content[0].text;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      console.error('❌ Auto-fix failed: Invalid response');
      return files;
    }

    return JSON.parse(jsonMatch[0]);
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
      breakdown: {
        components: Object.keys(files).filter(f => f.includes('components/')).length,
        pages: Object.keys(files).filter(f => f.includes('pages/')).length,
        services: Object.keys(files).filter(f => f.includes('services/')).length,
        utils: Object.keys(files).filter(f => f.includes('utils/')).length
      }
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = FrontendAgent;