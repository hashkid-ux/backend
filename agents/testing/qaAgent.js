// backend/agents/testing/qaAgent.js
// PRODUCTION-READY QA Agent with Comprehensive Validation

const AIClient = require('../../services/aiClient');

class QAAgent {
  constructor(tier = 'free') {
    this.tier = tier;
    this.client = new AIClient(process.env.OPENROUTER_API_KEY);
    this.model = 'deepseek/deepseek-chat-v3.1:free';
  }

  async testGeneratedCode(codeFiles, projectData) {
    console.log('🧪 QA Agent: Running comprehensive tests...');

    const results = {
      syntax: await this.testSyntax(codeFiles),
      security: await this.testSecurity(codeFiles),
      performance: await this.testPerformance(codeFiles),
      bestPractices: await this.testBestPractices(codeFiles),
      functionality: await this.testFunctionality(codeFiles),
      overall_score: 0,
      issues: [],
      recommendations: []
    };

    // Calculate overall score
    results.overall_score = this.calculateOverallScore(results);
    
    // Generate recommendations
    results.recommendations = this.generateRecommendations(results);

    // Critical issues that must be fixed
    results.critical_issues = this.identifyCriticalIssues(results);

    console.log(`✅ QA Complete: Score ${results.overall_score}/100`);
    if (results.critical_issues.length > 0) {
      console.warn(`⚠️  ${results.critical_issues.length} critical issues found`);
    }

    return results;
  }

  async testSyntax(codeFiles) {
    console.log('   🔍 Testing syntax...');
    
    const issues = [];
    let score = 100;

    for (const [filename, code] of Object.entries(codeFiles)) {
      // Only check JS/JSX files
      if (!filename.endsWith('.js') && !filename.endsWith('.jsx')) continue;

      // 1. Check balanced brackets
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
            message: `Unbalanced ${name}`
          });
          score -= 20;
        }
      }

      // 2. Check for common syntax errors
      const syntaxErrors = [
        { pattern: /\}\s*;?\s*\{/, message: 'Missing code between closing and opening braces' },
        { pattern: /function\s*\(\s*\)\s*\{?\s*\}/, message: 'Empty function' },
        { pattern: /if\s*\(\s*\)\s*\{/, message: 'Empty if condition' },
        { pattern: /\)\s*\{[^}]*\}\s*\(/, message: 'Invalid syntax near function' }
      ];

      for (const { pattern, message } of syntaxErrors) {
        if (pattern.test(code)) {
          issues.push({
            file: filename,
            severity: 'high',
            type: 'syntax',
            message
          });
          score -= 10;
        }
      }

      // 3. Check for incomplete implementations
      const incomplete = [
        /\/\/\s*TODO/gi,
        /\/\/\s*FIXME/gi,
        /\/\*\s*TODO/gi,
        /placeholder/gi,
        /coming soon/gi
      ];

      for (const pattern of incomplete) {
        if (pattern.test(code)) {
          issues.push({
            file: filename,
            severity: 'medium',
            type: 'incomplete',
            message: 'Contains TODO/placeholder code'
          });
          score -= 5;
        }
      }

      // 4. Check for proper imports/exports
      if (filename.includes('components/') || filename.includes('pages/')) {
        if (!code.includes('export ')) {
          issues.push({
            file: filename,
            severity: 'high',
            type: 'syntax',
            message: 'Missing export statement'
          });
          score -= 10;
        }
      }
    }

    return {
      score: Math.max(0, score),
      issues,
      passed: issues.length === 0
    };
  }

  async testSecurity(codeFiles) {
    console.log('   🔒 Testing security...');
    
    const vulnerabilities = [];
    let score = 100;

    for (const [filename, code] of Object.entries(codeFiles)) {
      // 1. SQL Injection risks
      if (code.includes('`SELECT ') || code.includes('`INSERT ') || code.includes('`UPDATE ')) {
        vulnerabilities.push({
          file: filename,
          severity: 'critical',
          type: 'sql_injection',
          message: 'Potential SQL injection using string interpolation',
          fix: 'Use parameterized queries or Prisma ORM'
        });
        score -= 20;
      }

      // 2. XSS risks
      if (code.includes('innerHTML') || code.includes('dangerouslySetInnerHTML')) {
        vulnerabilities.push({
          file: filename,
          severity: 'high',
          type: 'xss',
          message: 'Potential XSS vulnerability with HTML injection',
          fix: 'Sanitize user input or use textContent'
        });
        score -= 15;
      }

      // 3. Hardcoded secrets
      const secretPatterns = [
        { pattern: /password\s*[:=]\s*["'][^"']{3,}["']/, name: 'password' },
        { pattern: /api[_-]?key\s*[:=]\s*["'][^"']{10,}["']/i, name: 'API key' },
        { pattern: /secret\s*[:=]\s*["'][^"']{10,}["']/i, name: 'secret' },
        { pattern: /token\s*[:=]\s*["'][^"']{20,}["']/i, name: 'token' }
      ];

      for (const { pattern, name } of secretPatterns) {
        if (pattern.test(code)) {
          vulnerabilities.push({
            file: filename,
            severity: 'critical',
            type: 'hardcoded_secret',
            message: `Hardcoded ${name} detected`,
            fix: 'Use environment variables'
          });
          score -= 25;
        }
      }

      // 4. Weak JWT/Auth
      if (code.includes('jwt.sign') && !code.includes('expiresIn')) {
        vulnerabilities.push({
          file: filename,
          severity: 'medium',
          type: 'auth',
          message: 'JWT without expiration time',
          fix: 'Add expiresIn option to jwt.sign()'
        });
        score -= 10;
      }

      // 5. CORS misconfiguration
      if (code.includes("cors({ origin: '*'")) {
        vulnerabilities.push({
          file: filename,
          severity: 'medium',
          type: 'cors',
          message: 'CORS allows all origins (security risk)',
          fix: 'Specify allowed origins explicitly'
        });
        score -= 10;
      }

      // 6. Missing input validation
      if (filename.includes('controller') && !code.includes('validate') && !code.includes('validation')) {
        vulnerabilities.push({
          file: filename,
          severity: 'medium',
          type: 'validation',
          message: 'No input validation detected',
          fix: 'Add validation middleware'
        });
        score -= 8;
      }

      // 7. No rate limiting
      if (filename === 'server.js' && !code.includes('rateLimit')) {
        vulnerabilities.push({
          file: filename,
          severity: 'low',
          type: 'rate_limiting',
          message: 'No rate limiting configured',
          fix: 'Add express-rate-limit'
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

  async testPerformance(codeFiles) {
    console.log('   ⚡ Testing performance...');
    
    const issues = [];
    let score = 100;

    for (const [filename, code] of Object.entries(codeFiles)) {
      // 1. N+1 query problem
      const hasLoops = /for\s*\(/.test(code) || /forEach/.test(code);
      const hasQueries = /\.find\(|\.findOne\(|\.query\(/.test(code);
      
      if (hasLoops && hasQueries) {
        issues.push({
          file: filename,
          severity: 'high',
          type: 'n_plus_one',
          message: 'Potential N+1 query problem',
          fix: 'Use batch queries or eager loading'
        });
        score -= 15;
      }

      // 2. Missing pagination
      if (filename.includes('controller') && /findAll|find\(\)/.test(code) && !/limit|take/.test(code)) {
        issues.push({
          file: filename,
          severity: 'medium',
          type: 'pagination',
          message: 'Missing pagination on list endpoint',
          fix: 'Add limit and offset parameters'
        });
        score -= 10;
      }

      // 3. Synchronous operations
      if (/readFileSync|writeFileSync|execSync/.test(code)) {
        issues.push({
          file: filename,
          severity: 'high',
          type: 'sync_operation',
          message: 'Blocking synchronous operation',
          fix: 'Use async versions'
        });
        score -= 12;
      }

      // 4. Missing indexes (database schema)
      if (filename.includes('schema') && /model\s+\w+/.test(code)) {
        if (!/@@index/.test(code)) {
          issues.push({
            file: filename,
            severity: 'medium',
            type: 'missing_index',
            message: 'No database indexes defined',
            fix: 'Add @@index for frequently queried fields'
          });
          score -= 8;
        }
      }

      // 5. Large inline data
      if (code.length > 50000) {
        issues.push({
          file: filename,
          severity: 'low',
          type: 'large_file',
          message: 'Very large file may impact performance',
          fix: 'Consider splitting into smaller modules'
        });
        score -= 5;
      }
    }

    return {
      score: Math.max(0, score),
      issues,
      passed: score >= 70
    };
  }

  async testBestPractices(codeFiles) {
    console.log('   ✨ Testing best practices...');
    
    const issues = [];
    let score = 100;

    for (const [filename, code] of Object.entries(codeFiles)) {
      // 1. Error handling
      if (filename.endsWith('.js') || filename.endsWith('.jsx')) {
        const hasAsync = /async\s+function|async\s+\(/.test(code);
        const hasTryCatch = /try\s*\{[\s\S]*catch/.test(code);
        
        if (hasAsync && !hasTryCatch) {
          issues.push({
            file: filename,
            severity: 'medium',
            type: 'error_handling',
            message: 'Async function without try-catch',
            fix: 'Add error handling'
          });
          score -= 8;
        }
      }

      // 2. Console.log in production
      const consoleCount = (code.match(/console\.(log|warn|error)/g) || []).length;
      if (consoleCount > 10) {
        issues.push({
          file: filename,
          severity: 'low',
          type: 'console_logs',
          message: `Too many console statements (${consoleCount})`,
          fix: 'Use proper logging library'
        });
        score -= 5;
      }

      // 3. Proper naming conventions
      if (/var\s+/.test(code)) {
        issues.push({
          file: filename,
          severity: 'low',
          type: 'naming',
          message: 'Using var instead of const/let',
          fix: 'Use const or let'
        });
        score -= 3;
      }

      // 4. React class components (should be functional)
      if ((filename.endsWith('.jsx') || filename.endsWith('.js')) && 
          /class\s+\w+\s+extends\s+(React\.)?Component/.test(code)) {
        issues.push({
          file: filename,
          severity: 'medium',
          type: 'outdated_pattern',
          message: 'Using class components (should use functional)',
          fix: 'Refactor to functional component with hooks'
        });
        score -= 10;
      }

      // 5. PropTypes or TypeScript
      if (filename.includes('components/') && 
          !code.includes('PropTypes') && 
          !filename.endsWith('.tsx')) {
        issues.push({
          file: filename,
          severity: 'low',
          type: 'prop_validation',
          message: 'No PropTypes validation',
          fix: 'Add PropTypes or use TypeScript'
        });
        score -= 5;
      }
    }

    return {
      score: Math.max(0, score),
      issues,
      passed: score >= 70
    };
  }

  async testFunctionality(codeFiles) {
    console.log('   ⚙️  Testing functionality...');
    
    const checks = {
      hasServer: false,
      hasRoutes: false,
      hasAuth: false,
      hasDatabase: false,
      hasReactApp: false,
      hasRouting: false
    };

    let score = 0;

    // Check backend
    if (codeFiles['server.js']) {
      const serverCode = codeFiles['server.js'];
      if (serverCode.includes('express()') && serverCode.includes('app.listen')) {
        checks.hasServer = true;
        score += 20;
      }
    }

    // Check routes
    const routeFiles = Object.keys(codeFiles).filter(f => f.includes('routes/'));
    if (routeFiles.length > 0) {
      checks.hasRoutes = true;
      score += 15;
    }

    // Check auth
    const hasAuthFile = Object.keys(codeFiles).some(f => f.includes('auth'));
    if (hasAuthFile) {
      checks.hasAuth = true;
      score += 15;
    }

    // Check database
    const hasDbFile = Object.keys(codeFiles).some(f => 
      f.includes('prisma') || f.includes('database') || f.includes('schema')
    );
    if (hasDbFile) {
      checks.hasDatabase = true;
      score += 15;
    }

    // Check React app
    if (codeFiles['src/App.js'] || codeFiles['src/App.jsx']) {
      const appCode = codeFiles['src/App.js'] || codeFiles['src/App.jsx'];
      if (appCode.includes('React') || appCode.includes('export')) {
        checks.hasReactApp = true;
        score += 20;
      }
    }

    // Check routing
    const hasRouting = Object.values(codeFiles).some(code => 
      code.includes('BrowserRouter') || code.includes('Routes') || code.includes('Route')
    );
    if (hasRouting) {
      checks.hasRouting = true;
      score += 15;
    }

    return {
      score: Math.min(100, score),
      checks,
      passed: score >= 70
    };
  }

  // Helper methods
  isBalanced(code, open, close) {
    let count = 0;
    for (const char of code) {
      if (char === open) count++;
      if (char === close) count--;
      if (count < 0) return false;
    }
    return count === 0;
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

    // Security critical issues
    if (results.security?.vulnerabilities) {
      const criticalVulns = results.security.vulnerabilities.filter(v => v.severity === 'critical');
      critical.push(...criticalVulns.map(v => v.message));
    }

    // Syntax critical issues
    if (results.syntax?.issues) {
      const criticalSyntax = results.syntax.issues.filter(i => i.severity === 'critical');
      critical.push(...criticalSyntax.map(i => i.message));
    }

    return critical;
  }

  generateRecommendations(results) {
    const recommendations = [];

    // Based on scores
    if (results.security?.score < 70) {
      recommendations.push({
        priority: 'critical',
        category: 'security',
        message: 'Address security vulnerabilities before deployment',
        actions: results.security.vulnerabilities.map(v => v.fix)
      });
    }

    if (results.performance?.score < 70) {
      recommendations.push({
        priority: 'high',
        category: 'performance',
        message: 'Optimize performance issues',
        actions: results.performance.issues.map(i => i.fix)
      });
    }

    if (results.syntax?.issues?.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'syntax',
        message: 'Fix syntax errors',
        actions: results.syntax.issues.map(i => i.message)
      });
    }

    return recommendations;
  }
}

module.exports = QAAgent;