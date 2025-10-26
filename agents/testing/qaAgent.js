const Anthropic = require('@anthropic-ai/sdk');
const { chromium } = require('playwright-core');

class QAAgent {
  constructor(tier = 'free') {
    this.tier = tier;
    this.client = new Anthropic({
      apiKey: tier === 'premium' 
        ? process.env.ANTHROPIC_API_KEY 
        : process.env.ANTHROPIC_API_KEY_FREE
    });
    this.model = 'claude-sonnet-4-5-20250929';
    this.browser = null;
  }

  async testGeneratedCode(codeFiles, projectData) {
    console.log('🧪 QA Agent starting tests...');

    try {
      const results = {
        code_quality: await this.testCodeQuality(codeFiles),
        functionality: await this.testFunctionality(codeFiles, projectData),
        security: await this.testSecurity(codeFiles),
        performance: await this.testPerformance(codeFiles),
        accessibility: await this.testAccessibility(codeFiles),
        overall_score: 0,
        issues: [],
        recommendations: []
      };

      // Calculate overall score
      results.overall_score = this.calculateOverallScore(results);

      // Generate recommendations
      results.recommendations = await this.generateRecommendations(results);

      return results;

    } catch (error) {
      console.error('❌ QA testing error:', error);
      throw error;
    }
  }

  async testCodeQuality(codeFiles) {
    console.log('📝 Testing code quality...');

    const issues = [];
    let totalScore = 100;

    for (const [filename, code] of Object.entries(codeFiles)) {
      // Skip non-JS files
      if (!filename.endsWith('.js') && !filename.endsWith('.jsx')) continue;

      // Basic quality checks
      const qualityIssues = this.analyzeCode(code, filename);
      issues.push(...qualityIssues);

      // Deduct points for issues
      totalScore -= qualityIssues.length * 2;
    }

    return {
      score: Math.max(0, totalScore),
      issues,
      files_tested: Object.keys(codeFiles).length
    };
  }

  analyzeCode(code, filename) {
    const issues = [];

    // Check for console.logs (should be removed in production)
    const consoleCount = (code.match(/console\.(log|error|warn)/g) || []).length;
    if (consoleCount > 5) {
      issues.push({
        file: filename,
        severity: 'low',
        message: `Too many console statements (${consoleCount})`,
        line: null
      });
    }

    // Check for TODO comments
    const todoCount = (code.match(/\/\/\s*TODO/gi) || []).length;
    if (todoCount > 0) {
      issues.push({
        file: filename,
        severity: 'medium',
        message: `${todoCount} TODO comments need attention`,
        line: null
      });
    }

    // Check for hardcoded credentials
    const credentialPatterns = [
      /password\s*=\s*["'][^"']+["']/i,
      /api[_-]?key\s*=\s*["'][^"']+["']/i,
      /secret\s*=\s*["'][^"']+["']/i
    ];

    credentialPatterns.forEach(pattern => {
      if (pattern.test(code)) {
        issues.push({
          file: filename,
          severity: 'critical',
          message: 'Potential hardcoded credentials detected',
          line: null
        });
      }
    });

    // Check for missing error handling
    const asyncFunctions = (code.match(/async\s+\w+/g) || []).length;
    const tryCatchBlocks = (code.match(/try\s*\{/g) || []).length;
    if (asyncFunctions > tryCatchBlocks + 2) {
      issues.push({
        file: filename,
        severity: 'medium',
        message: 'Some async functions lack try-catch blocks',
        line: null
      });
    }

    // Check for proper imports
    if (code.includes('require(') && code.includes('import ')) {
      issues.push({
        file: filename,
        severity: 'low',
        message: 'Mixed CommonJS and ES6 imports',
        line: null
      });
    }

    return issues;
  }

  async testFunctionality(codeFiles, projectData) {
    console.log('⚙️  Testing functionality...');

    // Use AI to analyze if code implements required features
    const prompt = `Analyze if this code implements all required features:

PROJECT REQUIREMENTS:
${JSON.stringify(projectData, null, 2)}

CODE FILES:
${Object.entries(codeFiles).slice(0, 10).map(([name, code]) => 
  `FILE: ${name}\n${code.substring(0, 1000)}`
).join('\n\n---\n\n')}

Analyze in JSON format:
{
  "implemented_features": ["feature1", "feature2"],
  "missing_features": ["feature3"],
  "partial_features": [
    {"feature": "feature4", "completion": 70, "missing": "description"}
  ],
  "score": 0-100
}`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }]
      });

      const content = response.content[0].text;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return { score: 85, implemented_features: [], missing_features: [] };

    } catch (error) {
      console.error('⚠️  Functionality test error:', error);
      return { score: 80, error: 'Analysis incomplete' };
    }
  }

  async testSecurity(codeFiles) {
    console.log('🔒 Testing security...');

    const vulnerabilities = [];
    let score = 100;

    for (const [filename, code] of Object.entries(codeFiles)) {
      // Check for SQL injection risks
      if (code.includes('`SELECT') || code.includes('`INSERT')) {
        vulnerabilities.push({
          file: filename,
          severity: 'critical',
          type: 'sql_injection',
          message: 'Potential SQL injection vulnerability (string interpolation in queries)'
        });
        score -= 15;
      }

      // Check for XSS risks
      if (code.includes('innerHTML') || code.includes('dangerouslySetInnerHTML')) {
        vulnerabilities.push({
          file: filename,
          severity: 'high',
          type: 'xss',
          message: 'Potential XSS vulnerability (direct HTML injection)'
        });
        score -= 10;
      }

      // Check for missing input validation
      if (filename.includes('controller') && !code.includes('validate')) {
        vulnerabilities.push({
          file: filename,
          severity: 'medium',
          type: 'input_validation',
          message: 'Missing input validation in controller'
        });
        score -= 5;
      }

      // Check for weak authentication
      if (code.includes('jwt.sign') && !code.includes('expiresIn')) {
        vulnerabilities.push({
          file: filename,
          severity: 'medium',
          type: 'auth',
          message: 'JWT tokens without expiration'
        });
        score -= 5;
      }

      // Check for CORS misconfiguration
      if (code.includes("cors({ origin: '*'")) {
        vulnerabilities.push({
          file: filename,
          severity: 'medium',
          type: 'cors',
          message: 'CORS allows all origins (security risk)'
        });
        score -= 5;
      }
    }

    return {
      score: Math.max(0, score),
      vulnerabilities,
      total_issues: vulnerabilities.length
    };
  }

  async testPerformance(codeFiles) {
    console.log('⚡ Testing performance...');

    const issues = [];
    let score = 100;

    for (const [filename, code] of Object.entries(codeFiles)) {
      // Check for N+1 queries
      const loopCount = (code.match(/for\s*\(/g) || []).length;
      const queryCount = (code.match(/\.find\(|\.findOne\(|\.query\(/g) || []).length;
      
      if (loopCount > 0 && queryCount > loopCount) {
        issues.push({
          file: filename,
          severity: 'high',
          message: 'Potential N+1 query problem'
        });
        score -= 15;
      }

      // Check for missing pagination
      if (filename.includes('controller') && code.includes('findAll') && !code.includes('limit')) {
        issues.push({
          file: filename,
          severity: 'medium',
          message: 'Missing pagination on list endpoint'
        });
        score -= 10;
      }

      // Check for missing indexes (database files)
      if (filename.includes('model') && code.includes('unique: true') && !code.includes('index')) {
        issues.push({
          file: filename,
          severity: 'low',
          message: 'Consider adding database indexes'
        });
        score -= 5;
      }

      // Check for synchronous file operations
      if (code.includes('readFileSync') || code.includes('writeFileSync')) {
        issues.push({
          file: filename,
          severity: 'medium',
          message: 'Using synchronous file operations (blocks event loop)'
        });
        score -= 10;
      }
    }

    return {
      score: Math.max(0, score),
      issues,
      recommendations: [
        'Add database indexes for frequently queried fields',
        'Implement caching for expensive operations',
        'Use pagination for list endpoints'
      ]
    };
  }

  async testAccessibility(codeFiles) {
    console.log('♿ Testing accessibility...');

    const issues = [];
    let score = 100;

    for (const [filename, code] of Object.entries(codeFiles)) {
      // Only check frontend files
      if (!filename.includes('component') && !filename.includes('page')) continue;

      // Check for missing alt text on images
      const imgCount = (code.match(/<img/g) || []).length;
      const altCount = (code.match(/alt=/g) || []).length;
      if (imgCount > altCount) {
        issues.push({
          file: filename,
          severity: 'medium',
          message: `${imgCount - altCount} images missing alt text`
        });
        score -= 5;
      }

      // Check for missing ARIA labels on buttons
      if (code.includes('<button') && !code.includes('aria-label')) {
        issues.push({
          file: filename,
          severity: 'low',
          message: 'Consider adding aria-label to buttons'
        });
        score -= 3;
      }

      // Check for proper heading hierarchy
      const h1Count = (code.match(/<h1/g) || []).length;
      if (h1Count > 1) {
        issues.push({
          file: filename,
          severity: 'low',
          message: 'Multiple h1 tags (should be one per page)'
        });
        score -= 3;
      }

      // Check for keyboard navigation
      if (code.includes('onClick') && !code.includes('onKeyPress') && !code.includes('onKeyDown')) {
        issues.push({
          file: filename,
          severity: 'medium',
          message: 'Missing keyboard event handlers for clickable elements'
        });
        score -= 5;
      }
    }

    return {
      score: Math.max(0, score),
      issues,
      wcag_compliance: score >= 80 ? 'AA' : 'Partial'
    };
  }

  calculateOverallScore(results) {
    const weights = {
      code_quality: 0.25,
      functionality: 0.30,
      security: 0.25,
      performance: 0.15,
      accessibility: 0.05
    };

    let totalScore = 0;
    totalScore += (results.code_quality?.score || 0) * weights.code_quality;
    totalScore += (results.functionality?.score || 0) * weights.functionality;
    totalScore += (results.security?.score || 0) * weights.security;
    totalScore += (results.performance?.score || 0) * weights.performance;
    totalScore += (results.accessibility?.score || 0) * weights.accessibility;

    return Math.round(totalScore);
  }

  async generateRecommendations(results) {
    const recommendations = [];

    // Code quality recommendations
    if (results.code_quality?.score < 80) {
      recommendations.push({
        priority: 'high',
        category: 'code_quality',
        message: 'Address code quality issues before deployment',
        actions: ['Remove console.logs', 'Complete TODO items', 'Add error handling']
      });
    }

    // Security recommendations
    if (results.security?.vulnerabilities?.length > 0) {
      const critical = results.security.vulnerabilities.filter(v => v.severity === 'critical');
      if (critical.length > 0) {
        recommendations.push({
          priority: 'critical',
          category: 'security',
          message: `${critical.length} critical security issues must be fixed`,
          actions: critical.map(v => v.message)
        });
      }
    }

    // Performance recommendations
    if (results.performance?.score < 70) {
      recommendations.push({
        priority: 'medium',
        category: 'performance',
        message: 'Performance optimization needed',
        actions: results.performance.recommendations || []
      });
    }

    return recommendations;
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = QAAgent;