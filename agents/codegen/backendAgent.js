// backend/agents/codegen/backendAgent.js
// PRODUCTION-READY Backend Agent with Self-Correction & Validation

const AIClient = require('../../services/aiClient');

class BackendAgent {
  constructor(tier = 'free') {
    this.tier = tier;
    this.client = new AIClient(process.env.OPENROUTER_API_KEY);
    this.model = 'deepseek/deepseek-chat-v3.1:free';
    this.maxRetries = 3;
  }

  async generateBackend(projectData, databaseSchema) {
    console.log('🗄️  Backend Agent: Starting code generation...');
    
    let attempt = 0;
    let lastError = null;

    while (attempt < this.maxRetries) {
      try {
        attempt++;
        console.log(`   Attempt ${attempt}/${this.maxRetries}`);

        // Generate all backend files in ONE efficient call
        const code = await this.generateAllBackendFiles(projectData, databaseSchema);
        
        // CRITICAL: Validate generated code
        const validation = await this.validateCode(code);
        
        if (validation.isValid) {
          console.log('✅ Backend code generated and validated');
          return {
            files: code,
            stats: this.calculateStats(code),
            validation: validation
          };
        }

        // Auto-fix if validation failed
        console.log(`⚠️  Validation failed: ${validation.errors.join(', ')}`);
        console.log('🔧 Auto-fixing issues...');
        
        const fixedCode = await this.autoFixCode(code, validation.errors);
        const revalidation = await this.validateCode(fixedCode);
        
        if (revalidation.isValid) {
          console.log('✅ Issues fixed automatically');
          return {
            files: fixedCode,
            stats: this.calculateStats(fixedCode),
            validation: revalidation,
            wasFixed: true
          };
        }

        lastError = validation.errors;

      } catch (error) {
        console.error(`❌ Attempt ${attempt} failed:`, error.message);
        lastError = error;
        
        if (attempt < this.maxRetries) {
          console.log('🔄 Retrying with refined prompt...');
          await this.sleep(2000);
        }
      }
    }

    throw new Error(`Backend generation failed after ${this.maxRetries} attempts: ${lastError}`);
  }

  async generateAllBackendFiles(projectData, databaseSchema) {
    const { projectName, features, authentication } = projectData;

    // ONE comprehensive prompt to generate ALL files efficiently
    const prompt = `Generate a complete, production-ready Node.js/Express backend with ALL files. Follow these requirements EXACTLY:

PROJECT: ${projectName}
FEATURES: ${JSON.stringify(features)}
DATABASE SCHEMA: ${JSON.stringify(databaseSchema?.prisma_schema || {})}

Generate these files as a VALID JSON object with this EXACT structure:
{
  "server.js": "full working server code",
  "routes/health.js": "health check route",
  "routes/auth.js": "authentication routes",
  "routes/api.js": "main API routes",
  "controllers/authController.js": "auth logic",
  "controllers/apiController.js": "API logic",
  "middleware/auth.js": "JWT middleware",
  "middleware/errorHandler.js": "error handler",
  "middleware/validator.js": "input validation",
  "config/database.js": "Prisma config",
  "utils/jwt.js": "JWT utilities",
  "utils/bcrypt.js": "password hashing",
  "package.json": "dependencies",
  ".env.example": "environment variables",
  "README.md": "setup instructions"
}

CRITICAL REQUIREMENTS:
1. ✅ All code MUST be syntactically correct JavaScript
2. ✅ Use proper error handling with try-catch
3. ✅ Include JWT authentication if requested
4. ✅ Use Prisma for database (NOT raw SQL)
5. ✅ Implement proper validation middleware
6. ✅ RESTful API endpoints
7. ✅ Security best practices (helmet, cors, rate-limiting)
8. ✅ NO placeholder comments - real working code only
9. ✅ Return ONLY the JSON object, no explanations

SERVER.JS must include:
- Express setup
- Middleware (cors, helmet, json parser, rate limit)
- Route mounting
- Error handling
- Database connection
- PORT listener

AUTHENTICATION must include:
- Register endpoint
- Login endpoint
- JWT generation
- Password hashing with bcrypt
- Protected route middleware

PACKAGE.JSON must include:
- express, cors, helmet, dotenv
- bcryptjs, jsonwebtoken
- @prisma/client
- express-rate-limit
- All necessary dependencies

Return ONLY valid JSON. No markdown, no code blocks, just JSON.`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 16000,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0].text;
    
    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI did not return valid JSON');
    }

    const files = JSON.parse(jsonMatch[0]);
    
    // Ensure critical files exist
    const requiredFiles = ['server.js', 'package.json'];
    for (const file of requiredFiles) {
      if (!files[file]) {
        throw new Error(`Missing critical file: ${file}`);
      }
    }

    return files;
  }

  async validateCode(codeFiles) {
    console.log('🔍 Validating generated code...');
    
    const errors = [];
    const warnings = [];

    // 1. Check server.js structure
    const serverJs = codeFiles['server.js'];
    if (serverJs) {
      if (!serverJs.includes('express()')) errors.push('server.js: Missing Express initialization');
      if (!serverJs.includes('app.listen')) errors.push('server.js: Missing server listener');
      if (!serverJs.includes('cors')) warnings.push('server.js: CORS not configured');
      if (!serverJs.includes('helmet')) warnings.push('server.js: Helmet security missing');
    } else {
      errors.push('Missing server.js file');
    }

    // 2. Check package.json
    const packageJson = codeFiles['package.json'];
    if (packageJson) {
      try {
        const pkg = JSON.parse(packageJson);
        if (!pkg.dependencies) errors.push('package.json: No dependencies defined');
        if (!pkg.dependencies?.express) errors.push('package.json: Missing Express dependency');
        if (!pkg.scripts?.start) errors.push('package.json: No start script');
      } catch (e) {
        errors.push('package.json: Invalid JSON syntax');
      }
    } else {
      errors.push('Missing package.json file');
    }

    // 3. Check auth implementation
    if (codeFiles['controllers/authController.js']) {
      const authController = codeFiles['controllers/authController.js'];
      if (!authController.includes('bcrypt')) warnings.push('Auth: No password hashing detected');
      if (!authController.includes('jwt')) warnings.push('Auth: No JWT implementation detected');
    }

    // 4. Syntax validation for all JS files
    for (const [filename, code] of Object.entries(codeFiles)) {
      if (filename.endsWith('.js')) {
        // Check for common syntax errors
        if (!this.isBalanced(code, '{', '}')) errors.push(`${filename}: Unbalanced curly braces`);
        if (!this.isBalanced(code, '(', ')')) errors.push(`${filename}: Unbalanced parentheses`);
        if (!this.isBalanced(code, '[', ']')) errors.push(`${filename}: Unbalanced brackets`);
        
        // Check for incomplete code
        if (code.includes('// TODO') || code.includes('// FIXME')) {
          warnings.push(`${filename}: Contains TODO/FIXME comments`);
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

  async autoFixCode(codeFiles, errors) {
    console.log('🔧 Auto-fixing code issues...');

    const fixPrompt = `Fix these errors in the backend code:

ERRORS:
${errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}

CURRENT CODE:
${JSON.stringify(codeFiles, null, 2)}

Return the FIXED code as a JSON object with the same structure. Fix ALL errors. Return ONLY the JSON, no explanations.

FIXES MUST INCLUDE:
- Properly balanced braces, parentheses, brackets
- Complete implementations (no TODOs)
- Proper Express setup
- Valid package.json with all dependencies
- Working authentication if required

Return ONLY valid JSON.`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 16000,
      messages: [{ role: 'user', content: fixPrompt }]
    });

    const content = response.content[0].text;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      console.error('❌ Auto-fix failed: AI did not return valid JSON');
      return codeFiles; // Return original if fix fails
    }

    return JSON.parse(jsonMatch[0]);
  }

  // Helper: Check balanced brackets
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
    const totalSize = Object.values(files).reduce((sum, code) => 
      sum + code.length, 0
    );

    return {
      total_files: fileCount,
      total_lines: totalLines,
      total_size_kb: (totalSize / 1024).toFixed(2),
      breakdown: {
        routes: Object.keys(files).filter(f => f.includes('routes/')).length,
        controllers: Object.keys(files).filter(f => f.includes('controllers/')).length,
        middleware: Object.keys(files).filter(f => f.includes('middleware/')).length,
        utils: Object.keys(files).filter(f => f.includes('utils/')).length
      }
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = BackendAgent;