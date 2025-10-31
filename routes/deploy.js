const express = require('express');
const router = express.Router();
const DeployAgent = require('../agents/deployment/deployAgentUltra');
const QAAgent = require('../agents/testing/qaAgentUltra');

const checkTier = (req, res, next) => {
  req.userTier = req.headers['x-user-tier'] || 'free';
  next();
};

// POST /api/deploy/fullstack - Deploy both frontend and backend
router.post('/fullstack', checkTier, async (req, res) => {
  try {
    const { projectData, codeFiles } = req.body;

    if (req.userTier === 'free') {
      return res.status(403).json({
        error: 'Full-stack deployment requires Premium tier',
        upgrade_url: '/pricing'
      });
    }

    console.log('🌐 Full-stack deployment starting...');

    const deployAgent = new DeployAgent(req.userTier);
    const result = await deployAgent.deployFullStack(projectData, codeFiles);

    res.json({
      success: result.success,
      tier: req.userTier,
      deployment: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Full-stack deployment error:', error);
    res.status(500).json({
      error: 'Full-stack deployment failed',
      message: error.message
    });
  }
});

// GET /api/deploy/guide/:projectName - Get deployment guide
router.get('/guide/:projectName', checkTier, async (req, res) => {
  try {
    const { projectName } = req.params;

    const deployAgent = new DeployAgent(req.userTier);
    const guide = await deployAgent.generateDeploymentGuide({
      projectName
    });

    res.setHeader('Content-Type', 'text/markdown');
    res.send(guide);

  } catch (error) {
    console.error('❌ Guide generation error:', error);
    res.status(500).json({
      error: 'Failed to generate guide',
      message: error.message
    });
  }
});

// GET /api/deploy/status/:deploymentId - Check deployment status
router.get('/status/:deploymentId', async (req, res) => {
  try {
    const { deploymentId } = req.params;
    const { provider } = req.query;

    const deployAgent = new DeployAgent();
    const status = await deployAgent.getDeploymentStatus(deploymentId, provider);

    res.json({
      success: true,
      status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Status check error:', error);
    res.status(500).json({
      error: 'Failed to check status',
      message: error.message
    });
  }
});

// POST /api/deploy/preview - Generate preview deployment
router.post('/preview', checkTier, async (req, res) => {
  try {
    const { codeFiles } = req.body;

    if (!codeFiles) {
      return res.status(400).json({
        error: 'Code files required'
      });
    }

    // Generate a preview URL (simulated)
    const previewId = `preview-${Date.now()}`;
    const previewUrl = `https://preview.launch-ai.dev/${previewId}`;

    res.json({
      success: true,
      preview: {
        id: previewId,
        url: previewUrl,
        expires_in: '24 hours',
        status: 'building'
      },
      message: 'Preview deployment started',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Preview deployment error:', error);
    res.status(500).json({
      error: 'Preview deployment failed',
      message: error.message
    });
  }
});

// GET /api/deploy/providers - List available deployment providers
router.get('/providers', (req, res) => {
  res.json({
    providers: [
      {
        id: 'vercel',
        name: 'Vercel',
        type: 'frontend',
        free_tier: true,
        recommended: true,
        features: ['Auto-scaling', 'Global CDN', 'Instant deployments'],
        best_for: 'React, Next.js apps'
      },
      {
        id: 'railway',
        name: 'Railway',
        type: 'backend',
        free_tier: false,
        cost: '$5/month',
        recommended: true,
        features: ['PostgreSQL included', 'Auto-deploy', 'Environment management'],
        best_for: 'Node.js backends with database'
      },
      {
        id: 'render',
        name: 'Render',
        type: 'fullstack',
        free_tier: true,
        recommended: false,
        features: ['Full-stack hosting', 'Free SSL', 'Auto-deploy from Git'],
        best_for: 'Complete applications'
      },
      {
        id: 'netlify',
        name: 'Netlify',
        type: 'frontend',
        free_tier: true,
        recommended: false,
        features: ['JAMstack focus', 'Forms & Functions', 'Split testing'],
        best_for: 'Static sites, SPAs'
      }
    ]
  });
});

// GET /api/deploy/status
router.get('/status', (req, res) => {
  res.json({
    status: 'operational',
    endpoints: {
      test: '/api/deploy/test',
      deploy: '/api/deploy/app',
      fullstack: '/api/deploy/fullstack',
      guide: '/api/deploy/guide/:projectName',
      preview: '/api/deploy/preview',
      providers: '/api/deploy/providers'
    },
    agents: {
      qa_testing: 'active',
      deployment: 'active'
    }
  });
});

module.exports = router; //Middleware

// POST /api/deploy/test - Test generated code before deployment
router.post('/test', checkTier, async (req, res) => {
  try {
    const { codeFiles, projectData } = req.body;

    if (!codeFiles || !projectData) {
      return res.status(400).json({
        error: 'Code files and project data required'
      });
    }

    console.log('🧪 Running QA tests...');

    const qaAgent = new QAAgent(req.userTier);
    const testResults = await qaAgent.testGeneratedCode(codeFiles, projectData);

    res.json({
      success: true,
      tier: req.userTier,
      tests: testResults,
      ready_for_deployment: testResults.overall_score >= 70,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Testing error:', error);
    res.status(500).json({
      error: 'Testing failed',
      message: error.message
    });
  }
});

// POST /api/deploy/app - Deploy application
router.post('/app', checkTier, async (req, res) => {
  try {
    const { projectData, codeFiles, provider } = req.body;

    if (req.userTier === 'free') {
      return res.status(403).json({
        error: 'Deployment requires Starter tier or higher',
        upgrade_url: '/pricing'
      });
    }

    if (!projectData || !codeFiles) {
      return res.status(400).json({
        error: 'Project data and code files required'
      });
    }

    console.log(`🚀 Deploying ${projectData.projectName}...`);

    const deployAgent = new DeployAgent(req.userTier);
    const result = await deployAgent.deploy(
      projectData,
      codeFiles,
      provider || 'vercel'
    );

    res.json({
      success: result.success,
      tier: req.userTier,
      deployment: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Deployment error:', error);
    res.status(500).json({
      error: 'Deployment failed',
      message: error.message
    });
  }
});

//