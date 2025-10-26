const express = require('express');
const router = express.Router();
const FrontendAgent = require('../agents/codegen/frontendAgent');
const BackendAgent = require('../agents/codegen/backendAgent');
const DatabaseAgent = require('../agents/codegen/databaseAgent');
const fs = require('fs').promises;
const path = require('path');
const archiver = require('archiver');

// Middleware
const checkTier = (req, res, next) => {
  req.userTier = req.headers['x-user-tier'] || 'free';
  next();
};

// POST /api/generate/app - Generate full application
router.post('/app', checkTier, async (req, res) => {
  try {
    const {
      projectName,
      description,
      features,
      targetPlatform, // 'web', 'mobile', 'both'
      framework, // 'react', 'nextjs', 'react-native'
      database, // 'postgresql', 'mongodb'
      authentication,
    } = req.body;

    // Validation
    if (!projectName || !description) {
      return res.status(400).json({
        error: 'Project name and description are required'
      });
    }

    if (req.userTier === 'free') {
      return res.status(403).json({
        error: 'Code generation requires Starter tier or higher',
        upgrade_url: '/pricing'
      });
    }

    console.log(`🚀 Generating app: ${projectName}`);
    console.log(`👤 User tier: ${req.userTier}`);

    // Prepare project data
    const projectData = {
      projectName,
      description,
      features: features || [],
      targetPlatform: targetPlatform || 'web',
      framework: framework || 'react',
      database: database || 'postgresql',
      authentication: authentication !== false,
      apiEndpoints: req.body.apiEndpoints || this.inferEndpoints(features),
      designSystem: req.body.designSystem || this.getDefaultDesignSystem(),
    };

    const results = {};

    // Step 1: Database Schema
    console.log('📊 Step 1: Designing database...');
    const dbAgent = new DatabaseAgent(req.userTier);
    const databaseSchema = await dbAgent.designSchema(projectData);
    results.database = databaseSchema;

    // Step 2: Backend Code
    console.log('🗄️  Step 2: Generating backend...');
    const backendAgent = new BackendAgent(req.userTier);
    const backendCode = await backendAgent.generateBackend(projectData, databaseSchema.schema);
    results.backend = backendCode;

    // Step 3: Frontend Code
    console.log('⚛️  Step 3: Generating frontend...');
    const frontendAgent = new FrontendAgent(req.userTier);
    const frontendCode = await frontendAgent.generateApp(projectData);
    results.frontend = frontendCode;

    // Step 4: Create downloadable package
    const downloadId = await this.createDownloadPackage(projectName, results);

    // Step 5: Run QA Tests (if not free tier)
    let testResults = null;
    if (req.userTier !== 'free') {
      console.log('🧪 Step 5: Running QA tests...');
      const QAAgent = require('../agents/testing/qaAgent');
      const qaAgent = new QAAgent(req.userTier);
      
      testResults = await qaAgent.testGeneratedCode(
        { ...results.frontend.files, ...results.backend.files },
        projectData
      );
      
      console.log(`✅ QA Score: ${testResults.overall_score}/100`);
    }

    res.json({
      success: true,
      tier: req.userTier,
      project: {
        name: projectName,
        description,
        platform: targetPlatform,
        framework
      },
      generated: {
        database: {
          tables: databaseSchema.stats.total_tables,
          migrations: databaseSchema.migrations.length,
          seed_data: databaseSchema.seedData.length
        },
        backend: {
          files: backendCode.stats.total_files,
          lines: backendCode.stats.total_lines
        },
        frontend: {
          files: frontendCode.stats.total_files,
          lines: frontendCode.stats.total_lines
        }
      },
      qa_results: testResults,
      download_id: downloadId,
      download_url: `/api/generate/download/${downloadId}`,
      deployment_ready: testResults ? testResults.overall_score >= 70 : false,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Code generation error:', error);
    res.status(500).json({
      error: 'Code generation failed',
      message: error.message
    });
  }
});

// POST /api/generate/frontend - Generate frontend only
router.post('/frontend', checkTier, async (req, res) => {
  try {
    if (req.userTier === 'free') {
      return res.status(403).json({
        error: 'Frontend generation requires Starter tier or higher'
      });
    }

    const projectData = {
      projectName: req.body.projectName,
      description: req.body.description,
      features: req.body.features || [],
      targetPlatform: req.body.targetPlatform || 'web',
      framework: req.body.framework || 'react',
      designSystem: req.body.designSystem || this.getDefaultDesignSystem(),
    };

    const agent = new FrontendAgent(req.userTier);
    const result = await agent.generateApp(projectData);

    res.json({
      success: true,
      result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Frontend generation error:', error);
    res.status(500).json({
      error: 'Frontend generation failed',
      message: error.message
    });
  }
});

// POST /api/generate/backend - Generate backend only
router.post('/backend', checkTier, async (req, res) => {
  try {
    if (req.userTier === 'free') {
      return res.status(403).json({
        error: 'Backend generation requires Starter tier or higher'
      });
    }

    const projectData = {
      projectName: req.body.projectName,
      features: req.body.features || [],
      database: req.body.database || 'postgresql',
      authentication: req.body.authentication !== false,
      apiEndpoints: req.body.apiEndpoints || [],
    };

    // Generate database schema first
    const dbAgent = new DatabaseAgent(req.userTier);
    const databaseSchema = await dbAgent.designSchema(projectData);

    // Generate backend code
    const backendAgent = new BackendAgent(req.userTier);
    const result = await backendAgent.generateBackend(projectData, databaseSchema.schema);

    res.json({
      success: true,
      database: databaseSchema,
      backend: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Backend generation error:', error);
    res.status(500).json({
      error: 'Backend generation failed',
      message: error.message
    });
  }
});

// POST /api/generate/database - Generate database schema only
router.post('/database', checkTier, async (req, res) => {
  try {
    const projectData = {
      projectName: req.body.projectName,
      description: req.body.description,
      features: req.body.features || [],
    };

    const agent = new DatabaseAgent(req.userTier);
    const result = await agent.designSchema(projectData);

    res.json({
      success: true,
      result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Database schema generation error:', error);
    res.status(500).json({
      error: 'Database schema generation failed',
      message: error.message
    });
  }
});

// GET /api/generate/download/:id - Download generated code
router.get('/download/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const packagePath = path.join(__dirname, '../temp', `${id}.zip`);

    // Check if file exists
    try {
      await fs.access(packagePath);
    } catch {
      return res.status(404).json({
        error: 'Download package not found or expired'
      });
    }

    // Send file
    res.download(packagePath, `${id}.zip`, async (err) => {
      if (err) {
        console.error('Download error:', err);
      }

      // Delete file after download (optional)
      try {
        await fs.unlink(packagePath);
      } catch (error) {
        console.error('Failed to delete temp file:', error);
      }
    });

  } catch (error) {
    console.error('❌ Download error:', error);
    res.status(500).json({
      error: 'Download failed',
      message: error.message
    });
  }
});

// Helper: Create download package
router.createDownloadPackage = async (projectName, results) => {
  const downloadId = `${projectName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
  const tempDir = path.join(__dirname, '../temp');
  const zipPath = path.join(tempDir, `${downloadId}.zip`);

  // Create temp directory if it doesn't exist
  try {
    await fs.mkdir(tempDir, { recursive: true });
  } catch (error) {
    console.error('Failed to create temp dir:', error);
  }

  return new Promise((resolve, reject) => {
    const output = require('fs').createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      console.log(`✅ Created download package: ${archive.pointer()} bytes`);
      resolve(downloadId);
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);

    // Add frontend files
    if (results.frontend?.files) {
      Object.entries(results.frontend.files).forEach(([filepath, content]) => {
        archive.append(content, { name: `frontend/${filepath}` });
      });
    }

    // Add backend files
    if (results.backend?.files) {
      Object.entries(results.backend.files).forEach(([filepath, content]) => {
        archive.append(content, { name: `backend/${filepath}` });
      });
    }

    // Add database files
    if (results.database) {
      // Migrations
      if (results.database.migrations) {
        results.database.migrations.forEach(migration => {
          archive.append(migration.sql, { name: `database/migrations/${migration.name}` });
        });
      }

      // Prisma schema
      if (results.database.prismaSchema) {
        archive.append(results.database.prismaSchema, { name: 'backend/prisma/schema.prisma' });
      }

      // Seed data
      if (results.database.seedData) {
        archive.append(
          JSON.stringify(results.database.seedData, null, 2),
          { name: 'database/seeds/data.json' }
        );
      }
    }

    // Add README
    const readme = this.generateProjectReadme(projectName, results);
    archive.append(readme, { name: 'README.md' });

    archive.finalize();
  });
};

// Helper: Infer API endpoints from features
router.inferEndpoints = (features) => {
  const endpoints = [
    { method: 'GET', path: '/api/health', purpose: 'Health check' }
  ];

  features.forEach(feature => {
    const resource = feature.toLowerCase().replace(/\s+/g, '-');
    endpoints.push(
      { method: 'GET', path: `/api/${resource}`, purpose: `Get all ${feature}` },
      { method: 'GET', path: `/api/${resource}/:id`, purpose: `Get ${feature} by ID` },
      { method: 'POST', path: `/api/${resource}`, purpose: `Create ${feature}` },
      { method: 'PUT', path: `/api/${resource}/:id`, purpose: `Update ${feature}` },
      { method: 'DELETE', path: `/api/${resource}/:id`, purpose: `Delete ${feature}` }
    );
  });

  return endpoints;
};

// Helper: Default design system
router.getDefaultDesignSystem = () => {
  return {
    colors: {
      primary: '#6366F1',
      secondary: '#8B5CF6',
      accent: '#EC4899',
      background: '#0F172A',
      surface: '#1E293B',
      text: '#F8FAFC',
    },
    typography: {
      font: 'Inter, system-ui, sans-serif',
      headingSize: '2.5rem',
      bodySize: '1rem',
    },
    spacing: '8px',
    borderRadius: '12px',
    shadows: 'soft',
  };
};

// Helper: Generate project README
router.generateProjectReadme = (projectName, results) => {
  return `# ${projectName}

Built with Launch AI 🚀

## Project Structure

\`\`\`
${projectName}/
├── frontend/          ${results.frontend?.stats?.total_files || 0} files
├── backend/           ${results.backend?.stats?.total_files || 0} files
└── database/
    ├── migrations/    ${results.database?.migrations?.length || 0} migrations
    └── seeds/         Seed data
\`\`\`

## Getting Started

### Frontend
\`\`\`bash
cd frontend
npm install
npm start
\`\`\`

### Backend
\`\`\`bash
cd backend
npm install

# Setup database
createdb ${projectName.toLowerCase().replace(/\s+/g, '_')}
psql -d ${projectName.toLowerCase().replace(/\s+/g, '_')} -f ../database/migrations/001_initial_schema.sql

# Copy environment variables
cp .env.example .env
# Edit .env with your configuration

npm run dev
\`\`\`

## Features

${results.frontend?.architecture?.features?.map(f => `- ${f}`).join('\n') || '- Modern full-stack application'}

## Tech Stack

- **Frontend**: React with Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: PostgreSQL
- **Authentication**: JWT

## Database Schema

- **Tables**: ${results.database?.stats?.total_tables || 0}
- **Relations**: ${results.database?.stats?.total_relations || 0}
- **Indexes**: ${results.database?.stats?.total_indexes || 0}

## Deployment

### Frontend (Vercel)
\`\`\`bash
cd frontend
vercel deploy
\`\`\`

### Backend (Railway/Render)
\`\`\`bash
cd backend
# Follow hosting provider instructions
\`\`\`

## Support

Need help? Contact Launch AI support or visit our documentation.

---

Generated by [Launch AI](https://launch-ai.com)
Generated: ${new Date().toISOString()}
`;
};

// GET /api/generate/status
router.get('/status', (req, res) => {
  res.json({
    status: 'operational',
    endpoints: {
      full_app: '/api/generate/app',
      frontend: '/api/generate/frontend',
      backend: '/api/generate/backend',
      database: '/api/generate/database',
      download: '/api/generate/download/:id'
    },
    agents: {
      frontend: 'active',
      backend: 'active',
      database: 'active'
    }
  });
});

module.exports = router;