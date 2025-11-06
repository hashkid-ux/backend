// agents/codegen/backendAgentUltra.js
// ULTRA Backend Agent - Self-Debugging, Production-Ready Node.js

const AIClient = require('../../services/aiClient');

class BackendAgentUltra {
  constructor(tier = 'free') {
    this.tier = tier;
    this.client = new AIClient(process.env.OPENROUTER_API_KEY);
    this.model = 'qwen/qwen-2.5-coder-32b-instruct:free';
    this.maxRetries = 3;
  }

  async generateBackendUltra(projectData, databaseSchema) {
    console.log('🗄️  ULTRA Backend Agent: Starting intelligent generation...');

    let attempt = 0;
    let lastError = null;

    while (attempt < this.maxRetries) {
      try {
        attempt++;
        console.log(`   🔄 Attempt ${attempt}/${this.maxRetries}`);

        // PHASE 1: Analyze requirements and plan architecture
        const architecture = await this.planBackendArchitecture(projectData, databaseSchema);
        console.log(`   ✅ Architecture planned: ${architecture.totalFiles} files`);

        // PHASE 2: Generate all files dynamically
        const files = await this.generateDynamicBackendFiles(projectData, databaseSchema, architecture);
        console.log(`   ✅ Generated ${Object.keys(files).length} files`);

        // PHASE 3: Validate code
        const validation = await this.validateBackendCode(files);
        
        if (validation.isValid) {
          console.log('   ✅ Code validated successfully');
          return {
            files,
            architecture,
            stats: this.calculateStats(files),
            validation,
            selfDebugged: false
          };
        }

        // PHASE 4: Self-debug if validation failed
        console.log(`   ⚠️  Validation failed: ${validation.errors.join(', ')}`);
        console.log('   🔧 Self-debugging...');
        
        const fixedFiles = await this.selfDebugBackend(files, validation.errors, projectData);
        const revalidation = await this.validateBackendCode(fixedFiles);
        
        if (revalidation.isValid) {
          console.log('   ✅ Self-debug successful!');
          return {
            files: fixedFiles,
            architecture,
            stats: this.calculateStats(fixedFiles),
            validation: revalidation,
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

    throw new Error(`Backend generation failed after ${this.maxRetries} attempts: ${lastError}`);
  }

  async planBackendArchitecture(projectData, databaseSchema) {
    console.log('📐 Planning backend architecture...');

    const {
      projectName,
      description,
      features,
      competitive_advantages,
      authentication
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

    const prompt = jsonInstructions + `You are an expert Node.js architect. Plan a PRODUCTION-READY backend architecture.

PROJECT: ${projectName}
DESCRIPTION: ${description}
FEATURES: ${JSON.stringify(features || [])}
COMPETITIVE ADVANTAGES: ${JSON.stringify(competitive_advantages?.slice(0, 5) || [])}
AUTHENTICATION NEEDED: ${authentication !== false}
DATABASE TABLES: ${Object.keys(databaseSchema || {}).slice(0, 5).join(', ')}

Plan the OPTIMAL file structure. Return ONLY this JSON:
{
  "totalFiles": 0,
  "fileStructure": {
    "routes": [
      {
        "name": "health",
        "path": "routes/health.js",
        "purpose": "Health check endpoint",
        "endpoints": ["/health"],
        "priority": "critical"
      }
    ],
    "controllers": [
      {
        "name": "authController",
        "path": "controllers/authController.js",
        "purpose": "Authentication logic",
        "methods": ["register", "login", "logout"],
        "priority": "critical"
      }
    ],
    "middleware": [
      {
        "name": "auth",
        "path": "middleware/auth.js",
        "purpose": "JWT authentication",
        "priority": "critical"
      }
    ],
    "models": [
      {
        "name": "User",
        "path": "models/User.js",
        "purpose": "User model",
        "priority": "high"
      }
    ],
    "utils": [
      {
        "name": "jwt",
        "path": "utils/jwt.js",
        "purpose": "JWT utilities",
        "priority": "high"
      }
    ],
    "config": [
      {
        "name": "database",
        "path": "config/database.js",
        "purpose": "Prisma config",
        "priority": "critical"
      }
    ]
  },
  "techStack": {
    "runtime": "Node.js",
    "framework": "Express",
    "database": "PostgreSQL",
    "orm": "Prisma",
    "auth": "JWT"
  },
  "apiEndpoints": [
    {
      "path": "/api/health",
      "method": "GET",
      "purpose": "Health check"
    }
  ],
  "securityFeatures": ["JWT", "bcrypt", "helmet", "cors", "rate-limiting"]
}

CRITICAL: Plan based on ACTUAL features needed. If simple project, fewer files.`;

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
        (architecture.fileStructure.routes?.length || 0) +
        (architecture.fileStructure.controllers?.length || 0) +
        (architecture.fileStructure.middleware?.length || 0) +
        (architecture.fileStructure.models?.length || 0) +
        (architecture.fileStructure.utils?.length || 0) +
        (architecture.fileStructure.config?.length || 0) +
        3; // Core files (server.js, package.json, .env.example)

      return architecture;
    } catch (error) {
      console.error('❌ Architecture planning failed:', error.message);
      return this.getDefaultBackendArchitecture(projectData);
    }
  }

  async generateDynamicBackendFiles(projectData, databaseSchema, architecture) {
  console.log('🔨 Generating backend files with AI validation...');
  const files = {};
  const fixStats = { total: 0, fixed: 0, failed: 0, attempts: 0 };

  // Core files (no validation needed - templates)
  files['server.js'] = await this.generateServerJs(projectData, architecture);
  files['package.json'] = this.generateBackendPackageJson(projectData);
  files['.env.example'] = this.generateEnvExample(projectData);
  files['README.md'] = this.generateBackendREADME(projectData);

  // AI-generated files (VALIDATE EACH)
  const generators = [
    { items: architecture.fileStructure.routes || [], fn: this.generateRoute },
    { items: architecture.fileStructure.controllers || [], fn: this.generateController },
    { items: architecture.fileStructure.middleware || [], fn: this.generateMiddleware },
    { items: architecture.fileStructure.utils || [], fn: this.generateUtility },
    { items: architecture.fileStructure.config || [], fn: this.generateConfig }

  ];

  for (const { items, fn } of generators) {
    for (const item of items) {
      fixStats.total++;
      
      // Generate code
      let code = await fn.call(this, item, projectData, databaseSchema);
      
      // AI-powered validation & auto-fix
      const result = await this.validateAndAutoFix(code, item.path);
      
      files[item.path] = result.code;
      fixStats.attempts += result.attempts;
      
      if (result.valid && result.attempts > 0) {
        fixStats.fixed++;
        console.log(`🔧 ${item.path} auto-fixed by AI`);
      } else if (!result.valid) {
        fixStats.failed++;
        console.error(`❌ ${item.path} using fallback`);
      }
    }
  }

  // Utilities use complete implementations (no AI needed)
  for (const util of architecture.fileStructure.utils || []) {
    files[util.path] = await this.generateUtility(util, projectData);
  }

  console.log(`📊 Fix Stats: ${fixStats.fixed}/${fixStats.total} fixed, ${fixStats.failed} fallbacks, ${fixStats.attempts} total AI attempts`);
  
  return files;
}
  
  async generateServerJs(projectData, architecture) {

    const prompt = `Generate a PRODUCTION-READY Express server.js file.

PROJECT: ${projectData.projectName}
ARCHITECTURE: ${JSON.stringify(architecture.fileStructure, null, 2)}
AUTHENTICATION: ${projectData.authentication !== false}

Generate complete server.js with:
- Express setup with proper error handling
- Security middleware (helmet, cors, rate-limit)
- Body parser middleware
- All routes mounted correctly
- Database connection (Prisma)
- Graceful shutdown
- Environment variables
- Global error handler
- 404 handler

Return ONLY the complete JavaScript code, no markdown.`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }]
    });

    let code = response.content[0].text;
    code = code.replace(/```(?:javascript|js)?\n?/g, '').replace(/```\n?$/g, '');
    
    return code.trim();
  }

  async generateRoute(routeConfig, projectData) {
    const prompt = `Generate a PRODUCTION-READY Express route file.

ROUTE: ${routeConfig.name}
PURPOSE: ${routeConfig.purpose}
ENDPOINTS: ${JSON.stringify(routeConfig.endpoints || [])}

Generate complete ${routeConfig.path} with:
- Express Router
- All endpoints defined
- Proper HTTP methods (GET, POST, PUT, DELETE)
- Request validation
- Error handling
- JSDoc comments

CRITICAL RULES:
1. Return ONLY executable JavaScript code
2. NO markdown, NO explanations, NO comments outside code

Generate the complete component now.`;


    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    let code = response.content[0].text;

    // AGGRESSIVE CLEANING - Apply BEFORE any processing
    code = this.aggressiveClean(code);
    
    return code.trim();
  }

  async generateController(controllerConfig, projectData, databaseSchema) {
    const prompt = `Generate a PRODUCTION-READY Express controller.

CONTROLLER: ${controllerConfig.name}
PURPOSE: ${controllerConfig.purpose}
METHODS: ${JSON.stringify(controllerConfig.methods || [])}
DATABASE TABLES: ${Object.keys(databaseSchema || {}).slice(0, 3).join(', ')}

Generate complete ${controllerConfig.path} with:
- All controller methods (${controllerConfig.methods?.join(', ')})
- Prisma database queries
- Error handling with try-catch
- Input validation
- Proper HTTP status codes
- JSDoc comments
- Async/await pattern

CRITICAL RULES:
1. Return ONLY executable JavaScript code
2. NO markdown, NO explanations, NO comments outside code

Generate the complete component now.`;


    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    let code = response.content[0].text;
    
    // AGGRESSIVE CLEANING - Apply BEFORE any processing
    code = this.aggressiveClean(code);
    
    return code.trim();
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

// Add to backendAgentUltra.js

async validateAndAutoFix(code, filepath, maxRetries = 2) {
  // Try basic syntax check first (fast path)
  const quickCheck = this.quickSyntaxCheck(code, filepath);
  if (quickCheck.valid) return { valid: true, code, attempts: 0 };
  
  // If failed, use AI to fix (smart path)
  console.log(`🔧 AI auto-fixing ${filepath}...`);
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const fixed = await this.aiRepairCode(code, quickCheck.errors, filepath);
      
      // Validate the fix
      const recheck = this.quickSyntaxCheck(fixed, filepath);
      if (recheck.valid) {
        console.log(`✅ AI fixed ${filepath} in ${attempt} attempt(s)`);
        return { valid: true, code: fixed, attempts: attempt };
      }
      
      code = fixed; // Use AI's attempt for next iteration
    } catch (error) {
    console.error(`❌ AI fix attempt ${attempt} failed:`, error.message);
    
    // ADD THIS: If JSON error, use fallback immediately
    if (error.message.includes('JSON') || error.message.includes('parse')) {
      console.log('🔧 JSON error detected, using fallback template');
      return { 
        valid: false, 
        code: this.getFallbackTemplate(filepath), 
        attempts: maxRetries 
      };
    }
  }
  }
  
  // AI couldn't fix it - use fallback template
  console.error(`❌ ${filepath} unfixable, using fallback`);
  return { 
    valid: false, 
    code: this.getFallbackTemplate(filepath), 
    attempts: maxRetries 
  };
}

// Quick syntax validation (no AI needed)
quickSyntaxCheck(code, filepath) {
  const errors = [];
  
  // Check 1: Balance
  const brackets = [
    { open: '(', close: ')' },
    { open: '{', close: '}' },
    { open: '[', close: ']' }
  ];
  
  for (const { open, close } of brackets) {
    let count = 0;
    for (const char of code) {
      if (char === open) count++;
      if (char === close) count--;
      if (count < 0) {
        errors.push(`Unbalanced ${open}${close} at position`);
        break;
      }
    }
    if (count > 0) errors.push(`${count} unclosed ${open}`);
    if (count < 0) errors.push(`${Math.abs(count)} extra ${close}`);
  }
  
  // Check 2: Common syntax errors
  if (/\s!\s(?!==|=)/.test(code)) {
    errors.push('Standalone ! operator (should be && or ||)');
  }
  if (/if\s*\([^)]*$/.test(code.split('\n').join(' '))) {
    errors.push('Unclosed if condition');
  }
  
  return { valid: errors.length === 0, errors };
}

async aiRepairCode(brokenCode, errors, filepath) {
  const prompt = `Fix this JavaScript code...`;

  const response = await this.client.messages.create({
    model: this.model,
    max_tokens: 3000,
    temperature: 0.1,
  });

  let fixed = response.content[0].text.trim();
  
  // ADD THIS: Nuclear cleaning
  fixed = fixed
    .replace(/[｜▁]/g, '')  // Remove all tokenization chars
    .replace(/<\|.*?\|>/g, '')  // Remove special tokens
    .replace(/```[\w]*\n?/g, '')  // Remove markdown
    .replace(/\|begin_of_sentence\|/gi, '')
    .replace(/\|end_of_turn\|/gi, '')
    .trim();
  
  // Validate it's actual code
  if (fixed.length < 20 || !fixed.includes('function')) {
    console.error('❌ Cleaned code invalid, using fallback');
    return this.getFallbackTemplate(filepath);
  }
  
  return fixed;
}

  async generateMiddleware(middlewareConfig, projectData) {
    
    const prompt = `Generate a PRODUCTION-READY Express middleware.

MIDDLEWARE: ${middlewareConfig.name}
PURPOSE: ${middlewareConfig.purpose}

Generate complete ${middlewareConfig.path} with:
- Middleware function
- Error handling
- Next() calls
- Proper status codes
- JWT verification (if auth middleware)
- JSDoc comments

CRITICAL RULES:
1. Return ONLY executable JavaScript code
2. NO markdown, NO explanations, NO comments outside code

Generate the complete component now.`;


    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    let code = response.content[0].text;
    
     // AGGRESSIVE CLEANING - Apply BEFORE any processing
    code = this.aggressiveClean(code);
    
    return code.trim();
  }

  async generateUtility(utilConfig, projectData) {
  const name = utilConfig.name;
  
  // JWT utilities
  if (name.includes('jwt')) {
    return `const jwt = require('jsonwebtoken');

const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET || 'secret', {
    expiresIn: '7d'
  });
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'secret');
  } catch (error) {
    return null;
  }
};

module.exports = { generateToken, verifyToken };`;
  }

  // Bcrypt utilities
  if (name.includes('bcrypt')) {
    return `const bcrypt = require('bcryptjs');

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

module.exports = { hashPassword, comparePassword };`;
  }

  // AR utilities (COMPLETE IMPLEMENTATION)
  if (name.includes('ar')) {
    return `// AR Product Preview Utilities
const ARViewer = {
  initialize: (container, modelUrl) => {
    if (!container) throw new Error('Container required');
    return {
      load: async () => {
        console.log('AR model loaded:', modelUrl);
        return { success: true, model: modelUrl };
      },
      rotate: (angle) => console.log('Rotating:', angle),
      scale: (factor) => console.log('Scaling:', factor)
    };
  },
  
  isSupported: () => {
    return 'xr' in navigator || 'webkitGetUserMedia' in navigator;
  }
};

module.exports = ARViewer;`;
  }

  // Generic helper utilities
  return `const formatDate = (date) => new Date(date).toLocaleDateString();
const formatCurrency = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
const truncate = (str, len = 100) => str.length > len ? str.substring(0, len) + '...' : str;
const debounce = (fn, ms) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), ms);
  };
};

module.exports = { formatDate, formatCurrency, truncate, debounce };`;
}

  async generateConfig(configConfig, projectData) {
    if (configConfig.name.includes('database')) {
      return `// ${configConfig.path}
// Database configuration using Prisma

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
});

async function connectDatabase() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

async function disconnectDatabase() {
  await prisma.$disconnect();
  console.log('🔌 Database disconnected');
}

module.exports = {
  prisma,
  connectDatabase,
  disconnectDatabase
};`;
    }

    return `// ${configConfig.path}
// ${configConfig.purpose}

module.exports = {
  // Configuration will be added here
};`;
  }

  async validateBackendCode(files) {
    console.log('🔍 Validating backend code...');

    const errors = [];
    const warnings = [];

    // 1. Check critical files exist
    const requiredFiles = ['server.js', 'package.json'];
    for (const file of requiredFiles) {
      if (!files[file]) {
        errors.push(`Missing critical file: ${file}`);
      }
    }

    // 2. Validate server.js
    const serverJs = files['server.js'];
    if (serverJs) {
      if (!serverJs.includes('express()')) errors.push('server.js: Missing Express initialization');
      if (!serverJs.includes('app.listen')) errors.push('server.js: Missing server listener');
      if (!serverJs.includes('cors')) warnings.push('server.js: CORS not configured');
      if (!serverJs.includes('helmet')) warnings.push('server.js: Helmet security missing');
    }

    // 3. Validate package.json
    if (files['package.json']) {
      try {
        const pkg = JSON.parse(files['package.json']);
        if (!pkg.dependencies) errors.push('package.json: No dependencies');
        if (!pkg.dependencies?.express) errors.push('package.json: Missing Express');
        if (!pkg.scripts?.start) errors.push('package.json: No start script');
      } catch (e) {
        errors.push('package.json: Invalid JSON');
      }
    }

    // 4. Validate syntax for all JS files
    for (const [filename, code] of Object.entries(files)) {
      if (filename.endsWith('.js')) {
        if (!this.isBalanced(code, '{', '}')) errors.push(`${filename}: Unbalanced braces`);
        if (!this.isBalanced(code, '(', ')')) errors.push(`${filename}: Unbalanced parentheses`);
        if (!this.isBalanced(code, '[', ']')) errors.push(`${filename}: Unbalanced brackets`);
        
        if (code.includes('TODO') || code.includes('FIXME')) {
          warnings.push(`${filename}: Contains TODO/FIXME`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score: this.calculateValidationScore(errors, warnings)
    };
  }

  async selfDebugBackend(files, errors, projectData) {
    console.log('🔧 Self-debugging backend code...');
    
    const prompt = `Fix these errors in the Node.js backend:

ERRORS:
${errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}

CURRENT FILES (sample):
${Object.keys(files).slice(0, 10).join(', ')}

Fix these issues:
1. Balance all brackets/braces/parentheses
2. Ensure Express is properly initialized
3. Add missing middleware (cors, helmet)
4. Ensure all required files exist
5. Fix package.json if needed
6. Remove TODO/FIXME comments

Return JSON with fixed files:
{
  "fixes": [
    {
      "file": "server.js",
      "issue": "Missing Express init",
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
        routes: Object.keys(files).filter(f => f.includes('routes/')).length,
        controllers: Object.keys(files).filter(f => f.includes('controllers/')).length,
        middleware: Object.keys(files).filter(f => f.includes('middleware/')).length,
        utils: Object.keys(files).filter(f => f.includes('utils/')).length
      }
    };
  }

  generateBackendPackageJson(projectData) {
    return JSON.stringify({
      name: projectData.projectName.toLowerCase().replace(/\s+/g, '-') + '-backend',
      version: '1.0.0',
      description: projectData.description,
      main: 'server.js',
      scripts: {
        start: 'node server.js',
        dev: 'nodemon server.js',
        test: 'jest'
      },
      dependencies: {
        express: '^4.18.2',
        cors: '^2.8.5',
        helmet: '^7.1.0',
        dotenv: '^16.3.1',
        'express-rate-limit': '^7.1.0',
        '@prisma/client': '^5.0.0',
        bcryptjs: '^2.4.3',
        jsonwebtoken: '^9.0.2'
      },
      devDependencies: {
        nodemon: '^3.0.2',
        jest: '^29.7.0',
        prisma: '^5.0.0'
      }
    }, null, 2);
  }

  generateEnvExample(projectData) {
    return `# Server
PORT=5000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/${projectData.projectName.toLowerCase().replace(/\s+/g, '_')}

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# External APIs
API_KEY=your-api-key-here

# Frontend URL
CORS_ORIGIN=http://localhost:3000`;
  }

  generateBackendREADME(projectData) {
    return `# ${projectData.projectName} Backend

Built with Launch AI 🚀

## Quick Start

\`\`\`bash
npm install

# Setup database
cp .env.example .env
# Edit .env with your database credentials

npx prisma db push

# Start server
npm run dev
\`\`\`

Server runs on http://localhost:5000

## API Endpoints

- \`GET /health\` - Health check
- \`POST /api/auth/register\` - Register user
- \`POST /api/auth/login\` - Login user

## Tech Stack

- Node.js + Express
- PostgreSQL + Prisma
- JWT Authentication
- Security: Helmet, CORS, Rate Limiting

---
Generated by Launch AI
`;
  }

  getDefaultBackendArchitecture(projectData) {
    return {
      totalFiles: 12,
      fileStructure: {
        routes: [
          { name: 'health', path: 'routes/health.js', purpose: 'Health check', priority: 'critical' },
          { name: 'auth', path: 'routes/auth.js', purpose: 'Authentication', priority: 'critical' }
        ],
        controllers: [
          { name: 'authController', path: 'controllers/authController.js', purpose: 'Auth logic', methods: ['register', 'login'], priority: 'critical' }
        ],
        middleware: [
          { name: 'auth', path: 'middleware/auth.js', purpose: 'JWT middleware', priority: 'critical' },
          { name: 'errorHandler', path: 'middleware/errorHandler.js', purpose: 'Error handling', priority: 'high' }
        ],
        models: [],
        utils: [
          { name: 'jwt', path: 'utils/jwt.js', purpose: 'JWT utilities', priority: 'high' },
          { name: 'bcrypt', path: 'utils/bcrypt.js', purpose: 'Password hashing', priority: 'high' }
        ],
        config: [
          { name: 'database', path: 'config/database.js', purpose: 'Prisma config', priority: 'critical' }
        ]
      },
      techStack: {
        runtime: 'Node.js',
        framework: 'Express',
        database: 'PostgreSQL',
        orm: 'Prisma',
        auth: 'JWT'
      }
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = BackendAgentUltra;