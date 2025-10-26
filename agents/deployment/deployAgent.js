const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class DeployAgent {
  constructor(tier = 'free') {
    this.tier = tier;
    this.providers = {
      vercel: this.deployToVercel.bind(this),
      railway: this.deployToRailway.bind(this),
      render: this.deployToRender.bind(this),
      netlify: this.deployToNetlify.bind(this),
    };
  }

  async deploy(projectData, codeFiles, provider = 'vercel') {
    console.log(`🚀 Deployment Agent starting...`);
    console.log(`📦 Provider: ${provider}`);

    try {
      // Validate tier
      if (this.tier === 'free') {
        return {
          success: false,
          error: 'Deployment requires Starter tier or higher',
          upgrade_url: '/pricing'
        };
      }

      // Prepare deployment package
      const deploymentPackage = await this.prepareDeployment(projectData, codeFiles);

      // Deploy to selected provider
      const deployFunction = this.providers[provider];
      if (!deployFunction) {
        throw new Error(`Unknown provider: ${provider}`);
      }

      const result = await deployFunction(deploymentPackage);

      return {
        success: true,
        provider,
        deployment: result,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Deployment error:', error);
      return {
        success: false,
        error: error.message,
        provider
      };
    }
  }

  async prepareDeployment(projectData, codeFiles) {
    console.log('📦 Preparing deployment package...');

    return {
      projectName: projectData.projectName.toLowerCase().replace(/\s+/g, '-'),
      frontend: this.prepareFrontend(codeFiles.frontend),
      backend: this.prepareBackend(codeFiles.backend),
      environment: this.generateEnvironmentVars(projectData),
      config: this.generateDeployConfig(projectData)
    };
  }

  prepareFrontend(frontendFiles) {
    // Add build scripts and configuration
    const files = { ...frontendFiles };

    // Ensure package.json has build script
    if (files['package.json']) {
      const pkg = JSON.parse(files['package.json']);
      pkg.scripts = pkg.scripts || {};
      pkg.scripts.build = 'react-scripts build';
      pkg.scripts.start = 'react-scripts start';
      files['package.json'] = JSON.stringify(pkg, null, 2);
    }

    return files;
  }

  prepareBackend(backendFiles) {
    // Add production configurations
    const files = { ...backendFiles };

    // Ensure package.json has start script
    if (files['package.json']) {
      const pkg = JSON.parse(files['package.json']);
      pkg.scripts = pkg.scripts || {};
      pkg.scripts.start = 'node server.js';
      files['package.json'] = JSON.stringify(pkg, null, 2);
    }

    return files;
  }

  generateEnvironmentVars(projectData) {
    return {
      NODE_ENV: 'production',
      PORT: '${PORT}', // Will be provided by hosting
      DATABASE_URL: '${DATABASE_URL}', // User must configure
      JWT_SECRET: this.generateRandomSecret(),
      CORS_ORIGIN: '${FRONTEND_URL}',
    };
  }

  generateDeployConfig(projectData) {
    return {
      name: projectData.projectName,
      framework: projectData.framework || 'react',
      buildCommand: 'npm run build',
      outputDirectory: 'build',
      installCommand: 'npm install',
      devCommand: 'npm start'
    };
  }

  async deployToVercel(deploymentPackage) {
    console.log('▲ Deploying to Vercel...');

    // Note: In production, you'd use Vercel API with user's token
    // For now, we generate deployment instructions

    return {
      provider: 'vercel',
      status: 'instructions_generated',
      frontend_url: `https://${deploymentPackage.projectName}.vercel.app`,
      instructions: [
        '1. Install Vercel CLI: npm i -g vercel',
        '2. Navigate to frontend folder',
        '3. Run: vercel --prod',
        '4. Follow the prompts',
        '5. Your app will be live!'
      ],
      manual_steps: {
        step1: 'Extract the downloaded code',
        step2: 'Open terminal in frontend folder',
        step3: 'Run: vercel login',
        step4: 'Run: vercel --prod',
        step5: 'Configure environment variables in Vercel dashboard'
      },
      estimated_time: '5 minutes',
      cost: 'Free tier available'
    };
  }

  async deployToRailway(deploymentPackage) {
    console.log('🚂 Deploying to Railway...');

    return {
      provider: 'railway',
      status: 'instructions_generated',
      backend_url: `https://${deploymentPackage.projectName}.up.railway.app`,
      instructions: [
        '1. Install Railway CLI: npm i -g @railway/cli',
        '2. Navigate to backend folder',
        '3. Run: railway login',
        '4. Run: railway init',
        '5. Run: railway up',
        '6. Add PostgreSQL: railway add --database postgres'
      ],
      database_setup: 'PostgreSQL will be automatically provisioned',
      estimated_time: '10 minutes',
      cost: '$5/month (includes database)'
    };
  }

  async deployToRender(deploymentPackage) {
    console.log('🎨 Deploying to Render...');

    return {
      provider: 'render',
      status: 'instructions_generated',
      instructions: [
        '1. Go to render.com and sign up',
        '2. Click "New +" → "Web Service"',
        '3. Connect your GitHub repo (or upload code)',
        '4. Configure build command: npm install && npm run build',
        '5. Configure start command: npm start',
        '6. Add environment variables',
        '7. Click "Create Web Service"'
      ],
      estimated_time: '15 minutes',
      cost: 'Free tier available'
    };
  }

  async deployToNetlify(deploymentPackage) {
    console.log('🌐 Deploying to Netlify...');

    return {
      provider: 'netlify',
      status: 'instructions_generated',
      frontend_url: `https://${deploymentPackage.projectName}.netlify.app`,
      instructions: [
        '1. Install Netlify CLI: npm i -g netlify-cli',
        '2. Navigate to frontend folder',
        '3. Run: netlify login',
        '4. Run: netlify init',
        '5. Run: netlify deploy --prod',
        '6. Your frontend is live!'
      ],
      note: 'Netlify is for frontend only. Deploy backend separately.',
      estimated_time: '5 minutes',
      cost: 'Free tier available'
    };
  }

  async deployFullStack(projectData, codeFiles) {
    console.log('🌐 Full-stack deployment starting...');

    const results = {
      frontend: null,
      backend: null,
      database: null
    };

    try {
      // Deploy frontend to Vercel
      results.frontend = await this.deployToVercel({
        projectName: projectData.projectName,
        frontend: codeFiles.frontend
      });

      // Deploy backend to Railway
      results.backend = await this.deployToRailway({
        projectName: projectData.projectName,
        backend: codeFiles.backend
      });

      // Database is auto-provisioned by Railway
      results.database = {
        provider: 'railway_postgres',
        status: 'provisioned',
        connection_string: 'Available in Railway dashboard'
      };

      return {
        success: true,
        deployments: results,
        next_steps: this.generateNextSteps(results),
        estimated_total_time: '20 minutes',
        total_cost: '$5/month (Railway) + $0 (Vercel free tier)'
      };

    } catch (error) {
      console.error('❌ Full-stack deployment error:', error);
      return {
        success: false,
        error: error.message,
        partial_results: results
      };
    }
  }

  generateNextSteps(deploymentResults) {
    return [
      {
        step: 1,
        title: 'Deploy Frontend',
        description: 'Follow Vercel deployment instructions',
        estimated_time: '5 minutes'
      },
      {
        step: 2,
        title: 'Deploy Backend',
        description: 'Follow Railway deployment instructions',
        estimated_time: '10 minutes'
      },
      {
        step: 3,
        title: 'Configure Environment Variables',
        description: 'Add DATABASE_URL, JWT_SECRET, CORS_ORIGIN in both platforms',
        estimated_time: '3 minutes'
      },
      {
        step: 4,
        title: 'Test Your App',
        description: 'Visit your frontend URL and test all features',
        estimated_time: '5 minutes'
      },
      {
        step: 5,
        title: 'Set Up Custom Domain (Optional)',
        description: 'Configure your own domain in Vercel/Railway settings',
        estimated_time: '10 minutes'
      }
    ];
  }

  generateRandomSecret(length = 32) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let secret = '';
    for (let i = 0; i < length; i++) {
      secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return secret;
  }

  async getDeploymentStatus(deploymentId, provider) {
    // In production, this would check actual deployment status
    console.log(`📊 Checking deployment status: ${deploymentId}`);

    return {
      deployment_id: deploymentId,
      provider,
      status: 'deploying', // 'deploying', 'success', 'failed'
      progress: 75,
      logs: [
        'Building application...',
        'Installing dependencies...',
        'Running build script...',
        'Deploying to CDN...'
      ],
      estimated_completion: '2 minutes'
    };
  }

  async generateDeploymentGuide(projectData) {
    console.log('📚 Generating deployment guide...');

    const guide = `# Deployment Guide for ${projectData.projectName}

## Quick Deploy (Recommended)

### Option 1: Vercel (Frontend) + Railway (Backend)

**Frontend (Vercel)**
\`\`\`bash
cd frontend
npm i -g vercel
vercel login
vercel --prod
\`\`\`

**Backend (Railway)**
\`\`\`bash
cd backend
npm i -g @railway/cli
railway login
railway init
railway up
railway add --database postgres
\`\`\`

### Option 2: All-in-One (Render)

1. Push code to GitHub
2. Go to render.com
3. Create new Web Service
4. Connect GitHub repo
5. Deploy!

## Environment Variables Needed

**Frontend (.env)**
\`\`\`
REACT_APP_API_URL=https://your-backend-url.com
\`\`\`

**Backend (.env)**
\`\`\`
DATABASE_URL=postgresql://...
JWT_SECRET=${this.generateRandomSecret()}
CORS_ORIGIN=https://your-frontend-url.com
PORT=5000
\`\`\`

## Post-Deployment Checklist

- [ ] Frontend is accessible
- [ ] Backend health check works
- [ ] Database migrations run
- [ ] Environment variables configured
- [ ] CORS is properly set
- [ ] SSL/HTTPS enabled
- [ ] Custom domain configured (optional)

## Monitoring

Check logs:
- Vercel: \`vercel logs\`
- Railway: \`railway logs\`

## Support

Need help? Contact Launch AI support.

---
Generated: ${new Date().toISOString()}
`;

    return guide;
  }
}

module.exports = DeployAgent;