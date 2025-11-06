// agents/testing/qaAgentUltra.js
// ULTRA QA Agent - Self-Healing, Comprehensive Testing

const AIClient = require('../../services/aiClient');

class QAAgentUltra {
  constructor(tier = 'free') {
    this.tier = tier;
    this.client = new AIClient(process.env.OPENROUTER_API_KEY);
    this.model = 'qwen/qwen-2.5-coder-32b-instruct:free';
  }

  async testGeneratedCodeUltra(allFiles, projectData) {
    console.log('🧪 ULTRA QA Agent: Running comprehensive tests...');

    const results = {
      syntax: await this.testSyntax(allFiles),
      security: await this.testSecurity(allFiles),
      performance: await this.testPerformance(allFiles),
      bestPractices: await this.testBestPractices(allFiles),
      functionality: await this.testFunctionality(allFiles),
      researchAlignment: await this.testResearchAlignment(allFiles, projectData),
      overall_score: 0,
      critical_issues: [],
      autoFixedIssues: 0,
      recommendations: []
    };

    // Calculate overall score
    results.overall_score = this.calculateOverallScore(results);
    
    // Identify critical issues
    results.critical_issues = this.identifyCriticalIssues(results);
    
    // AUTO-FIX if enabled and issues found
    if (projectData.autoFix !== false && results.critical_issues.length > 0) {
  console.log(`🔧 Auto-fixing ${results.critical_issues.length} critical issues...`);
  
  // CHANGE THIS: Try up to 3 times
  for (let attempt = 1; attempt <= 3; attempt++) {
    const fixedFiles = await this.autoFixIssues(allFiles, results.critical_issues, projectData);
    
    if (fixedFiles) {
      const retest = await this.retestFiles(fixedFiles);
      
      if (retest.overall_score > results.overall_score) {
        results.autoFixedIssues = results.critical_issues.length;
        results.overall_score = retest.overall_score;
        results.critical_issues = retest.critical_issues;
        console.log(`✅ Auto-fixed on attempt ${attempt}`);
        break;
      }
    }
    
    if (attempt < 3) {
      console.log(`⏳ Retry ${attempt + 1}/3...`);
      await new Promise(resolve => setTimeout(resolve, 3000)); 
    }
  }
}

    
    // Generate recommendations
    results.recommendations = this.generateRecommendations(results);

    console.log(`✅ QA Complete: Overall Score ${results.overall_score}/100`);
    if (results.critical_issues.length > 0) {
      console.warn(`⚠️  ${results.critical_issues.length} critical issues remaining`);
    }

    return results;
  }

  async testSyntax(files) {
    console.log('   🔍 Testing syntax...');
    
    const issues = [];
    let score = 100;

    for (const [filename, code] of Object.entries(files)) {
      if (!filename.endsWith('.js') && !filename.endsWith('.jsx')) continue;

      // 1. Balanced brackets
      const brackets = [
        ['{', '}', 'braces'],
        ['(', ')', 'parentheses'],
        ['[', ']', 'brackets']
      ];

      for (const [open, close, name] of brackets) {
        if (!this.isBalanced(code, open, close)) {
          issues.push({
            file: filename,
            severity: 'critical',
            type: 'syntax',
            message: `Unbalanced ${name}`,
            line: this.findUnbalancedLine(code, open, close)
          });
          score -= 20;
        }
      }

      // 2. Unterminated strings
      const stringCheck = this.checkUnterminatedStrings(code);
      if (!stringCheck.valid) {
        issues.push({
          file: filename,
          severity: 'critical',
          type: 'syntax',
          message: 'Unterminated string',
          line: stringCheck.line
        });
        score -= 20;
      }

      // 3. Missing semicolons (warning only)
      const semiColonCheck = this.checkMissingSemicolons(code);
      if (semiColonCheck.count > 5) {
        issues.push({
          file: filename,
          severity: 'low',
          type: 'syntax',
          message: `${semiColonCheck.count} missing semicolons`,
          line: null
        });
        score -= 2;
      }

      // 4. Invalid JSX
      if (filename.endsWith('.jsx')) {
        const jsxCheck = this.validateJSX(code);
        if (!jsxCheck.valid) {
          issues.push({
            file: filename,
            severity: 'high',
            type: 'syntax',
            message: jsxCheck.error,
            line: jsxCheck.line
          });
          score -= 15;
        }
      }

      // 5. TODO/FIXME comments
      const todoCount = (code.match(/\/\/\s*(TODO|FIXME)/gi) || []).length;
      if (todoCount > 0) {
        issues.push({
          file: filename,
          severity: 'medium',
          type: 'incomplete',
          message: `${todoCount} TODO/FIXME comments`,
          line: null
        });
        score -= todoCount * 3;
      }
    }

    return {
      score: Math.max(0, score),
      issues,
      passed: issues.filter(i => i.severity === 'critical').length === 0
    };
  }

  async testSecurity(files) {
    console.log('   🔒 Testing security...');
    
    const vulnerabilities = [];
    let score = 100;

    for (const [filename, code] of Object.entries(files)) {
      // 1. SQL Injection
      if (/`(SELECT|INSERT|UPDATE|DELETE).*\$\{/.test(code)) {
        vulnerabilities.push({
          file: filename,
          severity: 'critical',
          type: 'sql_injection',
          message: 'Potential SQL injection with template literals',
          fix: 'Use parameterized queries or Prisma ORM',
          line: this.findLineNumber(code, /`SELECT.*\$\{/)
        });
        score -= 25;
      }

      // 2. XSS vulnerabilities
      if (code.includes('dangerouslySetInnerHTML') || code.includes('innerHTML =')) {
        vulnerabilities.push({
          file: filename,
          severity: 'high',
          type: 'xss',
          message: 'Potential XSS vulnerability',
          fix: 'Sanitize input or use textContent',
          line: this.findLineNumber(code, /dangerouslySetInnerHTML|innerHTML/)
        });
        score -= 15;
      }

      // 3. Hardcoded secrets
      const secretPatterns = [
        { pattern: /password\s*[:=]\s*["'][^"']{3,}["']/, name: 'password', severity: 'critical' },
        { pattern: /api[_-]?key\s*[:=]\s*["'][^"']{10,}["']/i, name: 'API key', severity: 'critical' },
        { pattern: /secret\s*[:=]\s*["'][^"']{10,}["']/i, name: 'secret', severity: 'critical' },
        { pattern: /token\s*[:=]\s*["'][^"']{20,}["']/i, name: 'token', severity: 'high' }
      ];

      for (const { pattern, name, severity } of secretPatterns) {
        if (pattern.test(code) && !code.includes('process.env')) {
          vulnerabilities.push({
            file: filename,
            severity,
            type: 'hardcoded_secret',
            message: `Hardcoded ${name} detected`,
            fix: 'Use environment variables',
            line: this.findLineNumber(code, pattern)
          });
          score -= severity === 'critical' ? 25 : 15;
        }
      }

      // 4. Weak JWT
      if (code.includes('jwt.sign') && !code.includes('expiresIn')) {
        vulnerabilities.push({
          file: filename,
          severity: 'medium',
          type: 'auth',
          message: 'JWT without expiration',
          fix: 'Add expiresIn option',
          line: this.findLineNumber(code, /jwt\.sign/)
        });
        score -= 10;
      }

      // 5. CORS misconfiguration
      if (code.includes("origin: '*'")) {
        vulnerabilities.push({
          file: filename,
          severity: 'medium',
          type: 'cors',
          message: 'CORS allows all origins',
          fix: 'Specify allowed origins',
          line: this.findLineNumber(code, /origin:\s*['"]?\*/)
        });
        score -= 10;
      }

      // 6. eval() usage
      if (code.includes('eval(')) {
        vulnerabilities.push({
          file: filename,
          severity: 'critical',
          type: 'code_injection',
          message: 'eval() usage detected',
          fix: 'Avoid eval(), use safer alternatives',
          line: this.findLineNumber(code, /eval\(/)
        });
        score -= 30;
      }

      // 7. console.log in production
      const consoleCount = (code.match(/console\.(log|warn|error|debug)/g) || []).length;
      if (consoleCount > 10) {
        vulnerabilities.push({
          file: filename,
          severity: 'low',
          type: 'info_leakage',
          message: `${consoleCount} console statements (production risk)`,
          fix: 'Remove or use proper logging library',
          line: null
        });
        score -= 5;
      }
    }

    return {
      score: Math.max(0, score),
      vulnerabilities,
      passed: score >= 80,
      critical_count: vulnerabilities.filter(v => v.severity === 'critical').length
    };
  }

  async testPerformance(files) {
    console.log('   ⚡ Testing performance...');
    
    const issues = [];
    let score = 100;

    for (const [filename, code] of Object.entries(files)) {
      // 1. N+1 query problem
      const hasLoops = /for\s*\(|\.forEach\(|\.map\(/.test(code);
      const hasQueries = /\.find\(|\.findOne\(|\.findMany\(/.test(code);
      
      if (hasLoops && hasQueries) {
        issues.push({
          file: filename,
          severity: 'high',
          type: 'n_plus_one',
          message: 'Potential N+1 query problem',
          fix: 'Use batch queries or eager loading',
          line: this.findLineNumber(code, /\.find/)
        });
        score -= 15;
      }

      // 2. Missing pagination
      if (/findMany\(\)/.test(code) && !/take|limit/.test(code)) {
        issues.push({
          file: filename,
          severity: 'medium',
          type: 'pagination',
          message: 'Missing pagination on list query',
          fix: 'Add take/skip or limit/offset',
          line: this.findLineNumber(code, /findMany/)
        });
        score -= 10;
      }

      // 3. Synchronous file operations
      if (/readFileSync|writeFileSync|execSync/.test(code)) {
        issues.push({
          file: filename,
          severity: 'high',
          type: 'blocking_operation',
          message: 'Blocking synchronous operation',
          fix: 'Use async versions',
          line: this.findLineNumber(code, /Sync\(/)
        });
        score -= 12;
      }

      // 4. Large inline data
      const lines = code.split('\n');
      const longLines = lines.filter(l => l.length > 500);
      if (longLines.length > 5) {
        issues.push({
          file: filename,
          severity: 'low',
          type: 'code_smell',
          message: `${longLines.length} very long lines (>500 chars)`,
          fix: 'Break into smaller chunks',
          line: null
        });
        score -= 5;
      }

      // 5. Missing indexes (schema files)
      if (filename.includes('schema') && /model\s+\w+/.test(code)) {
        const models = code.match(/model\s+\w+/g) || [];
        const indexes = code.match(/@@index/g) || [];
        
        if (models.length > 2 && indexes.length < 2) {
          issues.push({
            file: filename,
            severity: 'medium',
            type: 'missing_optimization',
            message: 'Few database indexes defined',
            fix: 'Add indexes on frequently queried fields',
            line: null
          });
          score -= 8;
        }
      }
    }

    return {
      score: Math.max(0, score),
      issues,
      passed: score >= 70
    };
  }

  async testBestPractices(files) {
    console.log('   ✨ Testing best practices...');
    
    const issues = [];
    let score = 100;

    for (const [filename, code] of Object.entries(files)) {
      // 1. Error handling
      if (filename.endsWith('.js') || filename.endsWith('.jsx')) {
        const hasAsync = /async\s+function|async\s+\(/.test(code);
        const hasTryCatch = /try\s*\{[\s\S]*catch/.test(code);
        
        if (hasAsync && !hasTryCatch && !code.includes('.catch(')) {
          issues.push({
            file: filename,
            severity: 'medium',
            type: 'error_handling',
            message: 'Async code without error handling',
            fix: 'Add try-catch or .catch()',
            line: this.findLineNumber(code, /async/)
          });
          score -= 8;
        }
      }

      // 2. var usage
      if (/\bvar\s+/.test(code)) {
        const varCount = (code.match(/\bvar\s+/g) || []).length;
        issues.push({
          file: filename,
          severity: 'low',
          type: 'outdated_syntax',
          message: `Using var (${varCount} times) instead of const/let`,
          fix: 'Use const or let',
          line: this.findLineNumber(code, /\bvar\s+/)
        });
        score -= varCount * 2;
      }

      // 3. React class components
      if ((filename.endsWith('.jsx') || filename.endsWith('.js')) && 
          /class\s+\w+\s+extends\s+(React\.)?Component/.test(code)) {
        issues.push({
          file: filename,
          severity: 'medium',
          type: 'outdated_pattern',
          message: 'Using class components (should use functional)',
          fix: 'Refactor to functional component with hooks',
          line: this.findLineNumber(code, /class\s+\w+\s+extends/)
        });
        score -= 10;
      }

      // 4. PropTypes validation
      if (filename.includes('components/') && 
          !code.includes('PropTypes') && 
          !code.includes('interface ') &&
          !filename.endsWith('.tsx')) {
        issues.push({
          file: filename,
          severity: 'low',
          type: 'type_safety',
          message: 'No PropTypes or TypeScript',
          fix: 'Add PropTypes validation',
          line: null
        });
        score -= 5;
      }

      // 5. Magic numbers
      const magicNumbers = code.match(/\b\d{2,}\b/g) || [];
      if (magicNumbers.length > 10) {
        issues.push({
          file: filename,
          severity: 'low',
          type: 'maintainability',
          message: `${magicNumbers.length} magic numbers detected`,
          fix: 'Extract to named constants',
          line: null
        });
        score -= 3;
      }
    }

    return {
      score: Math.max(0, score),
      issues,
      passed: score >= 70
    };
  }

  async testFunctionality(files) {
    console.log('   ⚙️  Testing functionality...');
    
    const checks = {
      hasServer: false,
      hasRoutes: false,
      hasAuth: false,
      hasDatabase: false,
      hasReactApp: false,
      hasRouting: false,
      hasErrorHandling: false,
      hasValidation: false
    };

    let score = 0;

    // Backend checks
    if (files['server.js']) {
      const serverCode = files['server.js'];
      if (serverCode.includes('express()') && serverCode.includes('app.listen')) {
        checks.hasServer = true;
        score += 15;
      }
      if (serverCode.includes('app.use(') && serverCode.includes('router')) {
        checks.hasRoutes = true;
        score += 10;
      }
      if (serverCode.includes('errorHandler') || serverCode.includes('catch')) {
        checks.hasErrorHandling = true;
        score += 10;
      }
    }

    // Auth check
    const hasAuthFile = Object.keys(files).some(f => 
      f.includes('auth') && (f.includes('controller') || f.includes('route'))
    );
    if (hasAuthFile) {
      checks.hasAuth = true;
      score += 15;
    }

    // Database check
    const hasDbFile = Object.keys(files).some(f => 
      f.includes('prisma') || f.includes('database') || f.includes('schema')
    );
    if (hasDbFile) {
      checks.hasDatabase = true;
      score += 15;
    }

    // Frontend checks
    if (files['src/App.js'] || files['src/App.jsx']) {
      const appCode = files['src/App.js'] || files['src/App.jsx'];
      if (appCode.includes('React') || appCode.includes('export')) {
        checks.hasReactApp = true;
        score += 15;
      }
      if (appCode.includes('BrowserRouter') || appCode.includes('Routes')) {
        checks.hasRouting = true;
        score += 10;
      }
    }

    // Validation check
    const hasValidation = Object.values(files).some(code => 
      code.includes('validate') || code.includes('Joi') || code.includes('yup')
    );
    if (hasValidation) {
      checks.hasValidation = true;
      score += 10;
    }

    return {
      score: Math.min(100, score),
      checks,
      passed: score >= 70
    };
  }

  async testResearchAlignment(files, projectData) {
    console.log('   🎯 Testing research alignment...');
    
    const competitive_advantages = projectData.competitive_advantages || [];
    const implemented = [];
    const missing = [];

    for (const advantage of competitive_advantages) {
      const feature = advantage.feature?.toLowerCase() || '';
      
      // Check if feature is implemented in code
      const isImplemented = Object.values(files).some(code => {
        const lowerCode = code.toLowerCase();
        return lowerCode.includes(feature) || 
               feature.split(' ').some(word => word.length > 4 && lowerCode.includes(word));
      });

      if (isImplemented) {
        implemented.push(advantage);
      } else {
        missing.push(advantage);
      }
    }

    const score = competitive_advantages.length > 0
      ? Math.round((implemented.length / competitive_advantages.length) * 100)
      : 100;

    return {
      score,
      total_advantages: competitive_advantages.length,
      implemented: implemented.length,
      missing: missing.length,
      missing_features: missing.map(m => m.feature),
      passed: score >= 70
    };
  }

  calculateOverallScore(results) {
    const weights = {
      syntax: 0.25,
      security: 0.30,
      performance: 0.20,
      bestPractices: 0.15,
      functionality: 0.10
    };

    let totalScore = 0;
    totalScore += (results.syntax?.score || 0) * weights.syntax;
    totalScore += (results.security?.score || 0) * weights.security;
    totalScore += (results.performance?.score || 0) * weights.performance;
    totalScore += (results.bestPractices?.score || 0) * weights.bestPractices;
    totalScore += (results.functionality?.score || 0) * weights.functionality;

    return Math.round(totalScore);
  }

  identifyCriticalIssues(results) {
    const critical = [];

    if (results.security?.vulnerabilities) {
      const criticalVulns = results.security.vulnerabilities.filter(v => v.severity === 'critical');
      critical.push(...criticalVulns);
    }

    if (results.syntax?.issues) {
      const criticalSyntax = results.syntax.issues.filter(i => i.severity === 'critical');
      critical.push(...criticalSyntax);
    }

    return critical;
  }

  async autoFixIssues(files, issues, projectData) {
    console.log(`🔧 Auto-fixing ${issues.length} critical issues...`);

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

    const prompt = jsonInstructions +`Fix these CRITICAL issues in the codebase:

ISSUES:
${issues.map((issue, i) => `${i + 1}. [${issue.file}] ${issue.message} - ${issue.fix || 'Fix required'}`).join('\n')}

Return JSON with fixes:
{
  "fixes": [
    {
      "file": "filename",
      "issue": "description",
      "fix": "complete corrected code for this file"
    }
  ]
}

CRITICAL: Return ONLY valid JSON, no markdown.`;

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

      return null;
    } catch (error) {
      console.error('❌ Auto-fix error:', error.message);
      return null;
    }
  }

  async retestFiles(files) {
    const results = {
      syntax: await this.testSyntax(files),
      security: await this.testSecurity(files),
      overall_score: 0,
      critical_issues: []
    };

    results.overall_score = Math.round((results.syntax.score + results.security.score) / 2);
    results.critical_issues = this.identifyCriticalIssues(results);

    return results;
  }

  generateRecommendations(results) {
    const recommendations = [];

    if (results.overall_score < 80) {
      recommendations.push({
        priority: 'high',
        category: 'quality',
        action: 'Improve code quality before deployment',
        details: `Current score: ${results.overall_score}/100. Target: 80+`
      });
    }

    if (results.security?.score < 70) {
      recommendations.push({
        priority: 'critical',
        category: 'security',
        action: 'Address security vulnerabilities immediately',
        details: results.security.vulnerabilities?.slice(0, 3).map(v => v.message)
      });
    }

    if (results.performance?.score < 70) {
      recommendations.push({
        priority: 'high',
        category: 'performance',
        action: 'Optimize performance issues',
        details: results.performance.issues?.slice(0, 3).map(i => i.message)
      });
    }

    if (results.functionality?.score < 70) {
      recommendations.push({
        priority: 'high',
        category: 'functionality',
        action: 'Complete missing functionality',
        details: 'Some core features are not implemented'
      });
    }

    return recommendations;
  }

  // HELPER METHODS
  isBalanced(code, open, close) {
    let count = 0;
    let inString = false;
    let escape = false;

    for (let i = 0; i < code.length; i++) {
      const char = code[i];
      const prevChar = i > 0 ? code[i - 1] : '';

      if (escape) {
        escape = false;
        continue;
      }

      if (char === '\\') {
        escape = true;
        continue;
      }

      if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (char === open) count++;
      if (char === close) count--;
      if (count < 0) return false;
    }

    return count === 0;
  }

  findUnbalancedLine(code, open, close) {
    const lines = code.split('\n');
    let count = 0;

    for (let i = 0; i < lines.length; i++) {
      for (const char of lines[i]) {
        if (char === open) count++;
        if (char === close) count--;
        if (count < 0) return i + 1;
      }
    }

    return null;
  }

  checkUnterminatedStrings(code) {
    const lines = code.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let inString = false;
      let stringChar = null;
      let escape = false;

      for (let j = 0; j < line.length; j++) {
        const char = line[j];

        if (escape) {
          escape = false;
          continue;
        }

        if (char === '\\') {
          escape = true;
          continue;
        }

        if ((char === '"' || char === "'" || char === '`') && !inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar && inString) {
          inString = false;
          stringChar = null;
        }
      }

      if (inString && !line.includes('`')) {
        return { valid: false, line: i + 1 };
      }
    }

    return { valid: true };
  }

  checkMissingSemicolons(code) {
    const lines = code.split('\n').filter(l => l.trim().length > 0);
    let count = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && 
          !trimmed.endsWith(';') && 
          !trimmed.endsWith('{') && 
          !trimmed.endsWith('}') &&
          !trimmed.startsWith('//') &&
          !trimmed.startsWith('*') &&
          trimmed.length > 10) {
        count++;
      }
    }

    return { count };
  }

  validateJSX(code) {
    // Simple JSX validation
    const openTags = (code.match(/<[A-Z][a-zA-Z0-9]*[^/>]*>/g) || []).length;
    const closeTags = (code.match(/<\/[A-Z][a-zA-Z0-9]*>/g) || []).length;

    if (openTags !== closeTags) {
      return {
        valid: false,
        error: 'Mismatched JSX tags',
        line: null
      };
    }

    return { valid: true };
  }

  findLineNumber(code, pattern) {
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        return i + 1;
      }
    }
    return null;
  }
}

module.exports = QAAgentUltra;