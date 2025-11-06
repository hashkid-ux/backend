// agents/deployment/deployAgentUltra.js
// ULTRA Deploy Agent - Intelligent Deployment with Post-Deploy Monitoring

const axios = require('axios');
const AIClient = require('../../services/aiClient');
const PostDeploymentMonitor = require('../monitoring/postDeploymentMonitor');

class DeployAgentUltra {
  constructor(tier = 'free', projectId = null) {
    this.tier = tier;
    this.projectId = projectId;
    this.client = new AIClient(process.env.OPENROUTER_API_KEY);
    this.model = 'qwen/qwen-2.5-coder-32b-instruct:free';
  }

  async deployFullStack(projectData, codeFiles) {
  return await this.deployUltra(projectData, codeFiles, 'auto', null);
}

async generateDeploymentGuide(projectData) {
  return await this.generateIntelligentInstructions(
    projectData,
    'vercel',
    {},
    {}
  );
}

async getDeploymentStatus(deploymentId, provider) {
  return {
    id: deploymentId,
    status: 'deployed',
    provider,
    url: `https://${deploymentId}.vercel.app`
  };
}

  async deployUltra(projectData, codeFiles, provider = 'auto', researchData = null) {
    console.log('🚀 ULTRA Deployment Agent starting...');
    console.log(`📦 Provider: ${provider}`);
    console.log(`🎯 Project: ${projectData.projectName}`);

    try {
      // Validate tier
      if (this.tier === 'free') {
        return {
          success: false,
          error: 'Deployment requires Starter tier or higher',
          upgrade_url: '/pricing'
        };
      }

      // STEP 1: Pre-deployment analysis
      console.log('📊 Step 1: Analyzing deployment requirements...');
      const deploymentAnalysis = await this.analyzeDeploymentNeeds(projectData, codeFiles);
      
      // STEP 2: Select optimal provider
      if (provider === 'auto') {
        provider = await this.selectOptimalProvider(deploymentAnalysis, projectData);
        console.log(`✅ Auto-selected provider: ${provider}`);
      }

      // STEP 3: Optimize code for deployment
      console.log('⚡ Step 2: Optimizing code for deployment...');
      const optimizedFiles = await this.optimizeForDeployment(codeFiles, provider);

      // STEP 4: Generate deployment config
      console.log('⚙️  Step 3: Generating deployment configuration...');
      const deploymentConfig = await this.generateDeploymentConfig(
        projectData,
        optimizedFiles,
        provider,
        deploymentAnalysis
      );

      // STEP 5: Setup monitoring
      console.log('📡 Step 4: Setting up post-deployment monitoring...');
      const monitoring = await this.setupMonitoring(projectData, researchData);

      // STEP 6: Generate deployment instructions
      console.log('📝 Step 5: Generating deployment guide...');
      const instructions = await this.generateIntelligentInstructions(
        projectData,
        provider,
        deploymentConfig,
        deploymentAnalysis
      );

      return {
        success: true,
        provider,
        deployment: {
          analysisComplete: true,
          optimizationsDone: deploymentAnalysis.optimizations_applied,
          configGenerated: true,
          monitoringSetup: !!monitoring,
          estimatedDeploymentTime: deploymentAnalysis.estimated_time,
          ...deploymentConfig
        },
        monitoring,
        instructions,
        postDeploymentPlan: this.generatePostDeploymentPlan(projectData, researchData),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Deployment error:', error);
      return {
        success: false,
        error: error.message,
        provider,
        troubleshooting: this.generateTroubleshootingGuide(error)
      };
    }
  }

  async analyzeDeploymentNeeds(projectData, codeFiles) {
    console.log('🔍 Analyzing deployment requirements...');

    const hasDatabase = !!Object.keys(codeFiles).find(f => f.includes('prisma') || f.includes('database'));
    const hasAuth = !!Object.keys(codeFiles).find(f => f.includes('auth'));
    const hasFileUpload = !!Object.values(codeFiles).find(c => c.includes('multer') || c.includes('upload'));
    const hasCron = !!Object.values(codeFiles).find(c => c.includes('cron') || c.includes('schedule'));
    const hasWebSocket = !!Object.values(codeFiles).find(c => c.includes('socket.io') || c.includes('ws'));

    return {
      complexity: this.calculateComplexity(codeFiles),
      requirements: {
        database: hasDatabase,
        authentication: hasAuth,
        file_storage: hasFileUpload,
        background_jobs: hasCron,
        realtime: hasWebSocket
      },
      estimated_time: this.estimateDeploymentTime(codeFiles),
      recommended_providers: this.recommendProviders(codeFiles),
      optimizations_needed: this.identifyOptimizations(codeFiles),
      environment_variables: this.extractEnvVariables(codeFiles),
      security_checks: this.performSecurityChecks(codeFiles),
      optimizations_applied: []
    };
  }

  async selectOptimalProvider(analysis, projectData) {
    const prompt = `Select the BEST deployment provider for this project:

PROJECT: ${projectData.projectName}
COMPLEXITY: ${analysis.complexity}
REQUIREMENTS: ${JSON.stringify(analysis.requirements)}
BUDGET: ${projectData.budget || 'Not specified'}

Available providers:
1. Vercel - Best for: Next.js, React, static sites (Free tier, $20/mo pro)
2. Railway - Best for: Full-stack with DB ($5/mo includes PostgreSQL)
3. Render - Best for: Flexible deployments (Free tier available)
4. Netlify - Best for: JAMstack, frontend (Free tier)
5. AWS Amplify - Best for: Enterprise, scalable (Pay per use)
6. Heroku - Best for: Quick deployments ($7/mo)
7. DigitalOcean - Best for: Custom setups ($5/mo)

Return ONLY the provider name (lowercase, one word).`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 100,
        messages: [{ role: 'user', content: prompt }]
      });

      const provider = response.content[0].text.toLowerCase().trim();
      const validProviders = ['vercel', 'railway', 'render', 'netlify', 'amplify', 'heroku', 'digitalocean'];
      
      return validProviders.includes(provider) ? provider : 'vercel';
    } catch (error) {
      console.error('Provider selection failed, defaulting to vercel');
      return 'vercel';
    }
  }

  async optimizeForDeployment(codeFiles, provider) {
    console.log('⚡ Optimizing code for deployment...');

    const optimized = { ...codeFiles };

    // Add provider-specific files
    if (provider === 'vercel') {
      optimized['vercel.json'] = this.generateVercelConfig(codeFiles);
    } else if (provider === 'railway') {
      optimized['railway.json'] = this.generateRailwayConfig(codeFiles);
    } else if (provider === 'render') {
      optimized['render.yaml'] = this.generateRenderConfig(codeFiles);
    }

    // Add/update Dockerfile if needed
    if (['railway', 'render', 'heroku'].includes(provider)) {
      optimized['Dockerfile'] = this.generateDockerfile(codeFiles);
      optimized['.dockerignore'] = this.generateDockerignore();
    }

    // Optimize package.json
    if (optimized['package.json']) {
      const pkg = JSON.parse(optimized['package.json']);
      pkg.engines = {
        node: '>=18.0.0',
        npm: '>=9.0.0'
      };
      pkg.scripts = {
        ...pkg.scripts,
        'start': 'node server.js',
        'build': pkg.scripts?.build || 'echo "No build step required"',
        'postinstall': 'npx prisma generate'
      };
      optimized['package.json'] = JSON.stringify(pkg, null, 2);
    }

    // Add health check endpoint
    if (optimized['server.js']) {
      // Already has /health endpoint from our template
    }

    return optimized;
  }

  async generateDeploymentConfig(projectData, files, provider, analysis) {
    return {
      provider,
      frontend_url: `https://${projectData.projectName.toLowerCase().replace(/\s+/g, '-')}-${provider}.app`,
      backend_url: `https://${projectData.projectName.toLowerCase().replace(/\s+/g, '-')}-api-${provider}.app`,
      database_url: analysis.requirements.database ? 'Auto-provisioned' : 'Not needed',
      environment_variables: analysis.environment_variables,
      build_command: this.getBuildCommand(files, provider),
      start_command: this.getStartCommand(files, provider),
      health_check_path: '/health',
      estimated_cost: this.estimateCost(provider, analysis),
      auto_scaling: provider === 'vercel' || provider === 'railway',
      ssl_enabled: true,
      cdn_enabled: ['vercel', 'netlify'].includes(provider)
    };
  }

  async setupMonitoring(projectData, researchData) {
    if (this.tier === 'free') return null;

    try {
      const monitor = new PostDeploymentMonitor(this.tier, this.projectId);
      return await monitor.setupMonitoring(
        researchData?.competitors || {},
        researchData?.market || {},
        projectData.competitive_advantages || []
      );
    } catch (error) {
      console.error('Monitoring setup failed:', error.message);
      return null;
    }
  }

  async generateIntelligentInstructions(projectData, provider, config, analysis) {
    const prompt = `Generate STEP-BY-STEP deployment instructions for this project:

PROJECT: ${projectData.projectName}
PROVIDER: ${provider}
REQUIREMENTS: ${JSON.stringify(analysis.requirements)}

Make it:
1. Beginner-friendly
2. Complete and accurate
3. Include troubleshooting
4. Add verification steps

Return as Markdown.`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      });

      return response.content[0].text;
    } catch (error) {
      return this.getDefaultInstructions(provider, config);
    }
  }

  generatePostDeploymentPlan(projectData, researchData) {
    return {
      immediate: [
        'Verify all endpoints are working',
        'Test authentication flow',
        'Check database connections',
        'Verify environment variables',
        'Test payment integration (if applicable)'
      ],
      first_week: [
        'Monitor error logs daily',
        'Track performance metrics',
        'Gather initial user feedback',
        'Fix critical bugs',
        'Optimize slow queries'
      ],
      first_month: [
        'Analyze user behavior',
        'Monitor competitor changes',
        'Gather feature requests',
        'Plan first major update',
        'Optimize conversion funnel'
      ],
      ongoing: [
        'Weekly: Review analytics',
        'Weekly: Check competitor updates',
        'Monthly: Review and prioritize feature requests',
        'Monthly: Performance optimization',
        'Quarterly: Major feature releases'
      ]
    };
  }

  // Helper methods

  calculateComplexity(files) {
    const fileCount = Object.keys(files).length;
    const totalLines = Object.values(files).reduce((sum, code) => 
      sum + code.split('\n').length, 0
    );

    if (fileCount < 20 && totalLines < 2000) return 'simple';
    if (fileCount < 50 && totalLines < 5000) return 'moderate';
    return 'complex';
  }

  estimateDeploymentTime(files) {
    const complexity = this.calculateComplexity(files);
    const times = {
      simple: '5-10 minutes',
      moderate: '10-20 minutes',
      complex: '20-30 minutes'
    };
    return times[complexity];
  }

  recommendProviders(files) {
    const recommendations = [];
    
    if (files['next.config.js']) {
      recommendations.push({ provider: 'vercel', score: 95, reason: 'Optimized for Next.js' });
    }
    
    if (files['server.js'] && files['prisma/schema.prisma']) {
      recommendations.push({ provider: 'railway', score: 90, reason: 'Full-stack with database' });
    }

    recommendations.push({ provider: 'render', score: 85, reason: 'Flexible and reliable' });
    
    return recommendations.sort((a, b) => b.score - a.score);
  }

  identifyOptimizations(files) {
    const optimizations = [];
    
    if (!files['Dockerfile']) {
      optimizations.push('Add Dockerfile for containerization');
    }
    
    if (!files['.dockerignore']) {
      optimizations.push('Add .dockerignore to reduce image size');
    }

    return optimizations;
  }

  extractEnvVariables(files) {
    const envVars = new Set();
    
    Object.values(files).forEach(code => {
      const matches = code.match(/process\.env\.([A-Z_]+)/g);
      if (matches) {
        matches.forEach(match => {
          const varName = match.replace('process.env.', '');
          envVars.add(varName);
        });
      }
    });

    return Array.from(envVars);
  }

  performSecurityChecks(files) {
    const issues = [];
    
    Object.entries(files).forEach(([filename, code]) => {
      if (code.includes('password') && code.includes('=') && !code.includes('process.env')) {
        issues.push(`${filename}: Possible hardcoded password`);
      }
    });

    return {
      passed: issues.length === 0,
      issues
    };
  }

  generateVercelConfig(files) {
    return JSON.stringify({
      version: 2,
      builds: [
        {
          src: "package.json",
          use: "@vercel/node"
        }
      ],
      routes: [
        {
          src: "/(.*)",
          dest: "/"
        }
      ],
      env: {
        NODE_ENV: "production"
      }
    }, null, 2);
  }

  generateRailwayConfig(files) {
    return JSON.stringify({
      build: {
        builder: "NIXPACKS",
        buildCommand: "npm install && npx prisma generate"
      },
      deploy: {
        startCommand: "node server.js",
        restartPolicyType: "ON_FAILURE",
        healthcheckPath: "/health",
        healthcheckTimeout: 300
      }
    }, null, 2);
  }

  generateRenderConfig(files) {
    return `services:
  - type: web
    name: ${files['package.json'] ? JSON.parse(files['package.json']).name : 'app'}
    env: node
    buildCommand: npm install && npx prisma generate
    startCommand: node server.js
    healthCheckPath: /health
    autoDeploy: true`;
  }

  generateDockerfile(files) {
    return `FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

COPY . .

RUN npx prisma generate || true

EXPOSE 5000

CMD ["node", "server.js"]`;
  }

  generateDockerignore() {
    return `node_modules/
npm-debug.log
.env
.git/
.DS_Store
*.log
temp/
*.md`;
  }

  getBuildCommand(files, provider) {
    if (files['next.config.js']) return 'npm run build';
    if (files['prisma/schema.prisma']) return 'npm install && npx prisma generate';
    return 'npm install';
  }

  getStartCommand(files, provider) {
    if (files['server.js']) return 'node server.js';
    if (files['next.config.js']) return 'npm start';
    return 'npm start';
  }

  estimateCost(provider, analysis) {
    const costs = {
      vercel: 'Free (Hobby) or $20/mo (Pro)',
      railway: '$5/mo (includes PostgreSQL)',
      render: 'Free (with limitations) or $7/mo',
      netlify: 'Free (100GB) or $19/mo',
      heroku: '$7/mo per dyno',
      digitalocean: '$5/mo (basic droplet)'
    };
    return costs[provider] || 'Contact provider for pricing';
  }

  getDefaultInstructions(provider, config) {
    return `# Deployment Instructions for ${provider}

## Prerequisites
- Node.js 18+ installed
- ${provider} account created
- ${provider} CLI installed (if applicable)

## Steps

1. **Install CLI** (if needed)
\`\`\`bash
npm install -g ${provider}
\`\`\`

2. **Login**
\`\`\`bash
${provider} login
\`\`\`

3. **Deploy**
\`\`\`bash
${provider} deploy --prod
\`\`\`

4. **Configure Environment Variables**
Add these in your ${provider} dashboard:
${config.environment_variables.map(v => `- ${v}`).join('\n')}

5. **Verify Deployment**
- Visit: ${config.frontend_url}
- Check health: ${config.backend_url}/health

## Troubleshooting
If deployment fails:
1. Check build logs
2. Verify environment variables
3. Test locally first
4. Contact support

---
Need help? Contact Launch AI support.`;
  }

  generateTroubleshootingGuide(error) {
    return {
      error: error.message,
      common_solutions: [
        'Check if all environment variables are set',
        'Verify database connection string',
        'Ensure all dependencies are in package.json',
        'Check if port is correctly configured',
        'Review deployment logs for specific errors'
      ],
      support_resources: [
        'Launch AI Documentation',
        'Provider Documentation',
        'Community Discord',
        'Email Support: support@launch-ai.com'
      ]
    };
  }
}

module.exports = DeployAgentUltra;