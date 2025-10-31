// routes/generateUltra.js
// ULTRA Code Generation Route - Uses ULTRA Agents

const express = require('express');
const router = express.Router();
const FrontendAgentUltra = require('../agents/codegen/frontendAgentUltra');
const BackendAgentUltra = require('../agents/codegen/backendAgentUltra');
const DatabaseAgentUltra = require('../agents/codegen/databaseAgentUltra');
const QAAgentUltra = require('../agents/testing/qaAgentUltra');
const archiver = require('archiver');
const path = require('path');
const fs = require('fs').promises;

const checkTier = (req, res, next) => {
  req.userTier = req.headers['x-user-tier'] || 'free';
  next();
};

// POST /api/generate-ultra/app - Generate ULTRA app
router.post('/app', checkTier, async (req, res) => {
  try {
    const {
      projectName,
      description,
      features,
      targetPlatform,
      framework,
      database,
      authentication,
      competitive_advantages,
      ux_principles,
      psychology_triggers
    } = req.body;

    if (!projectName || !description) {
      return res.status(400).json({
        error: 'Project name and description are required'
      });
    }

    if (req.userTier === 'free') {
      return res.status(403).json({
        error: 'ULTRA code generation requires Starter tier or higher',
        upgrade_url: '/pricing'
      });
    }

    console.log(`🚀 ULTRA Generation: ${projectName}`);
    console.log(`👤 Tier: ${req.userTier}`);

    const enhancedProjectData = {
      projectName,
      description,
      features: features || [],
      targetPlatform: targetPlatform || 'web',
      framework: framework || 'react',
      database: database || 'postgresql',
      authentication: authentication !== false,
      competitive_advantages: competitive_advantages || [],
      ux_principles: ux_principles || [],
      psychology_triggers: psychology_triggers || [],
      dateContext: {
        currentDate: new Date().toISOString(),
        season: getCurrentSeason(),
        marketTrend: getMarketTrend()
      }
    };

    const results = {};

    // STEP 1: Database Schema (ULTRA)
    console.log('🗄️  Step 1: ULTRA Database Design...');
    const dbAgent = new DatabaseAgentUltra(req.userTier);
    const databaseResult = await dbAgent.designSchemaUltra(
      enhancedProjectData,
      { market: {}, competitors: {} }
    );
    results.database = databaseResult;
    
    console.log(`✅ Database: ${databaseResult.stats?.total_tables || 0} tables with ${databaseResult.optimizations?.length || 0} optimizations`);

    // STEP 2: Backend (ULTRA - Self-Debugging)
    console.log('⚙️  Step 2: ULTRA Backend Generation...');
    const backendAgent = new BackendAgentUltra(req.userTier);
    const backendResult = await backendAgent.generateBackendUltra(
      enhancedProjectData,
      databaseResult
    );
    results.backend = backendResult;
    
    console.log(`✅ Backend: ${backendResult.stats?.total_files || 0} files, ${backendResult.stats?.total_lines || 0} lines`);
    if (backendResult.selfDebugged) {
      console.log('🔧 Backend self-debugged successfully!');
    }

    // STEP 3: Frontend (ULTRA - Dynamic)
    console.log('⚛️  Step 3: ULTRA Frontend Generation...');
    const frontendAgent = new FrontendAgentUltra(req.userTier);
    const frontendResult = await frontendAgent.generateAppUltra(enhancedProjectData);
    results.frontend = frontendResult;
    
    console.log(`✅ Frontend: ${frontendResult.stats?.total_files || 0} files, ${frontendResult.stats?.components || 0} components`);
    if (frontendResult.psychologyIntegrated) {
      console.log('🧠 Psychology triggers integrated!');
    }

    // STEP 4: QA Testing (ULTRA - Self-Healing)
    let qaResults = null;
    if (req.userTier !== 'free') {
      console.log('🧪 Step 4: ULTRA QA Testing...');
      const qaAgent = new QAAgentUltra(req.userTier);
      
      qaResults = await qaAgent.testGeneratedCodeUltra(
        { ...results.frontend.files, ...results.backend.files },
        enhancedProjectData
      );
      
      console.log(`✅ QA Score: ${qaResults.overall_score}/100`);
      if (qaResults.autoFixedIssues > 0) {
        console.log(`🔧 Auto-fixed ${qaResults.autoFixedIssues} issues!`);
      }
    }

    // STEP 5: Create download package
    console.log('📦 Step 5: Creating download package...');
    const downloadId = await createDownloadPackageUltra(projectName, results);

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
          tables: databaseResult.stats?.total_tables || 0,
          optimizations: databaseResult.optimizations?.length || 0,
          migrations: databaseResult.migrations?.length || 0
        },
        backend: {
          files: backendResult.stats?.total_files || 0,
          lines: backendResult.stats?.total_lines || 0,
          self_debugged: backendResult.selfDebugged || false
        },
        frontend: {
          files: frontendResult.stats?.total_files || 0,
          components: frontendResult.stats?.components || 0,
          psychology_integrated: frontendResult.psychologyIntegrated || false
        }
      },
      qa_results: qaResults,
      download_id: downloadId,
      download_url: `/api/generate-ultra/download/${downloadId}`,
      deployment_ready: qaResults ? qaResults.overall_score >= 70 : false,
      ultra_features: {
        self_debugging: backendResult.selfDebugged || false,
        psychology_triggers: frontendResult.psychologyIntegrated || false,
        database_optimizations: databaseResult.optimizations?.length || 0,
        qa_auto_fixes: qaResults?.autoFixedIssues || 0
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ ULTRA Generation error:', error);
    res.status(500).json({
      error: 'ULTRA code generation failed',
      message: error.message
    });
  }
});

// GET /api/generate-ultra/download/:id
router.get('/download/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const packagePath = path.join(__dirname, '../temp', `${id}.zip`);

    try {
      await fs.access(packagePath);
    } catch {
      return res.status(404).json({
        error: 'Download package not found or expired'
      });
    }

    res.download(packagePath, `${id}.zip`, async (err) => {
      if (err) {
        console.error('Download error:', err);
      }
      
      // Delete after download
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

// Helper functions

async function createDownloadPackageUltra(projectName, results) {
  const downloadId = `${projectName.toLowerCase().replace(/\s+/g, '-')}-ultra-${Date.now()}`;
  const tempDir = path.join(__dirname, '../temp');
  const zipPath = path.join(tempDir, `${downloadId}.zip`);

  await fs.mkdir(tempDir, { recursive: true });

  return new Promise((resolve, reject) => {
    const output = require('fs').createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      console.log(`✅ ULTRA package created: ${archive.pointer()} bytes`);
      resolve(downloadId);
    });

    archive.on('error', (err) => reject(err));
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
      if (results.database.migrations) {
        results.phase3.database.migrations.forEach((migration, i) => {
    const sql = typeof migration === 'string' ? migration : migration.sql;
    const name = migration.name || `migration_${String(i + 1).padStart(3, '0')}.sql`;
    archive.append(sql, { name: `database/migrations/${name}` });
  });
      }

      if (results.database.prisma_schema) {
        archive.append(results.database.prisma_schema, { 
          name: 'backend/prisma/schema.prisma' 
        });
      }
    }

    // Add ULTRA README
    const readme = generateUltraREADME(projectName, results);
    archive.append(readme, { name: 'README.md' });

    // Add ULTRA Features documentation
    const ultraFeatures = generateUltraFeaturesDoc(results);
    archive.append(ultraFeatures, { name: 'ULTRA_FEATURES.md' });

    archive.finalize();
  });
}

function generateUltraREADME(projectName, results) {
  return `# ${projectName} - ULTRA Edition

**Built with Launch AI ULTRA Agents** 🚀

## 🌟 ULTRA Features

${results.backend?.selfDebugged ? '✅ **Self-Debugging Backend** - Code automatically debugged and fixed' : ''}
${results.frontend?.psychologyIntegrated ? '✅ **Psychology-Driven UX** - User psychology triggers integrated' : ''}
${results.database?.optimizations?.length > 0 ? `✅ **Optimized Database** - ${results.database.optimizations.length} performance optimizations` : ''}

## 📊 Build Statistics

- **Frontend**: ${results.frontend?.stats?.total_files || 0} files, ${results.frontend?.stats?.components || 0} components
- **Backend**: ${results.backend?.stats?.total_files || 0} files, ${results.backend?.stats?.total_lines || 0} lines
- **Database**: ${results.database?.stats?.total_tables || 0} tables, ${results.database?.stats?.total_indexes || 0} indexes
- **QA Score**: ${results.qa_results?.overall_score || 'N/A'}/100

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL
- npm or yarn

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
cp .env.example .env
# Edit .env with your credentials
npx prisma db push
npm run dev
\`\`\`

## 🎯 Psychology Triggers Integrated

${results.frontend?.architecture?.psychologyTriggers?.map(t => `- ${t.trigger}: ${t.implementation}`).join('\n') || 'See ULTRA_FEATURES.md for details'}

## 🗄️  Database Optimizations

${results.database?.optimizations?.map((o, i) => `${i + 1}. **${o.type}** on ${o.table}: ${o.reason}`).join('\n') || 'No specific optimizations'}

## 📖 Documentation

- **ULTRA_FEATURES.md** - Detailed ULTRA features documentation
- **API Documentation** - See backend/README.md
- **Deployment Guide** - See DEPLOYMENT.md

---
Generated by **Launch AI ULTRA** - The Most Powerful AI Code Generator
Built: ${new Date().toISOString()}
`;
}

function generateUltraFeaturesDoc(results) {
  return `# ULTRA Features Documentation

## What Makes This ULTRA?

### 1. Self-Debugging Backend
${results.backend?.selfDebugged ? `
Your backend was automatically debugged and fixed by AI:
- Syntax errors corrected
- Code quality improved
- Best practices applied
- Security vulnerabilities fixed
` : 'Not available in this build'}

### 2. Psychology-Driven Frontend
${results.frontend?.psychologyIntegrated ? `
Psychology triggers integrated into your UI:
${results.frontend?.architecture?.psychologyTriggers?.map(t => `
- **${t.trigger}**
  - Implementation: ${t.implementation}
  - Placement: ${t.placement}
  - Expected Impact: ${t.impact}
`).join('\n') || ''}
` : 'Not available in this build'}

### 3. Optimized Database
${results.database?.optimizations ? `
Database optimized for performance:
${results.database.optimizations.map((o, i) => `
${i + 1}. **${o.type}** Optimization
   - Table: ${o.table}
   - Reason: ${o.reason}
   - Impact: ${o.impact}
`).join('\n')}
` : 'No specific optimizations'}

### 4. Quality Assurance
${results.qa_results ? `
Comprehensive QA testing performed:
- Overall Score: **${results.qa_results.overall_score}/100**
- Auto-Fixed Issues: **${results.qa_results.autoFixedIssues || 0}**
- Critical Issues: **${results.qa_results.critical_issues?.length || 0}**
- Deployment Ready: **${results.qa_results.overall_score >= 70 ? 'YES ✅' : 'NEEDS REVIEW ⚠️'}**
` : 'QA not performed for this tier'}

## Technical Details

### Architecture
- **Frontend**: React 18 with Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: JWT-based authentication
- **Security**: Helmet, CORS, Rate Limiting

### File Structure
\`\`\`
project/
├── frontend/          ${results.frontend?.stats?.total_files || 0} files
│   ├── src/
│   │   ├── components/  ${results.frontend?.stats?.components || 0} components
│   │   ├── pages/       ${results.frontend?.stats?.pages || 0} pages
│   │   └── services/
│   └── package.json
├── backend/           ${results.backend?.stats?.total_files || 0} files
│   ├── routes/
│   ├── controllers/
│   ├── middleware/
│   ├── prisma/
│   └── server.js
└── database/
    └── migrations/    ${results.database?.migrations?.length || 0} migrations
\`\`\`

## Maintenance & Updates

This ULTRA-generated code includes:
- ✅ Automatic code formatting
- ✅ Error handling throughout
- ✅ Security best practices
- ✅ Performance optimizations
- ✅ Scalability considerations

---
Powered by Launch AI ULTRA
`;
}

function getCurrentSeason() {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'Spring';
  if (month >= 5 && month <= 7) return 'Summer';
  if (month >= 8 && month <= 10) return 'Fall';
  return 'Winter';
}

function getMarketTrend() {
  const month = new Date().getMonth();
  if (month === 0 || month === 11) return 'Holiday season - high spending';
  if (month >= 7 && month <= 8) return 'Back-to-school';
  return 'Standard market';
}

router.get('/status', (req, res) => {
  res.json({
    status: 'operational',
    version: 'ULTRA',
    features: [
      'Self-debugging backend',
      'Psychology-driven frontend',
      'Optimized database',
      'Auto-fixing QA',
      'Dynamic file generation'
    ],
    endpoints: {
      generate: '/api/generate-ultra/app',
      download: '/api/generate-ultra/download/:id'
    }
  });
});

module.exports = router;