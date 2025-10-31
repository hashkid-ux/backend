// backend/routes/masterBuild.js
// FULLY FIXED VERSION - All issues resolved

const express = require('express');
const router = express.Router();
const MasterOrchestrator = require('../agents/masterOrchestrator');
const { UserService, ProjectService, NotificationService } = require('../services/database');
const { authenticateToken } = require('./authWithDb');
const archiver = require('archiver');
const path = require('path');
const fs = require('fs').promises;

const activeBuilds = new Map();

// ==========================================
// POST /api/master/build - START BUILD (FULLY FIXED)
// ==========================================
router.post('/build', authenticateToken, async (req, res) => {
  try {
    const {
      projectId,
      projectName,
      description,
      targetCountry,
      features,
      targetPlatform,
      framework,
      database
    } = req.body;

    // Validation
    if (!projectName || !description) {
      return res.status(400).json({
        error: 'Project name and description required'
      });
    }

    if (description.length < 20) {
      return res.status(400).json({
        error: 'Please provide a detailed description (minimum 20 characters)'
      });
    }

    // Get user and check credits
    const user = await UserService.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.credits <= 0) {
      return res.status(403).json({
        error: 'No credits remaining',
        credits: user.credits,
        upgrade_url: '/pricing'
      });
    }

    console.log('🚀 BUILD START:', {
      user: user.email,
      credits: user.credits,
      project: projectName,
      tier: user.tier
    });

    // Deduct credit FIRST
    await UserService.deductCredit(user.id);
    console.log('✅ Credit deducted. Remaining:', user.credits - 1);

    // Get or create project ID
    let dbProjectId = projectId;
    
    if (!dbProjectId) {
      const newProject = await ProjectService.create({
        userId: user.id,
        name: projectName,
        description,
        prompt: description,
        framework: framework || 'react',
        database: database || 'postgresql',
        targetPlatform: targetPlatform || 'web',
        status: 'building',
        buildProgress: 0
      });
      dbProjectId = newProject.id;
      console.log('✅ Project created in DB:', dbProjectId);
    } else {
      await ProjectService.update(dbProjectId, {
        status: 'building',
        buildProgress: 0
      });
      console.log('🔄 Retrying build for project:', dbProjectId);
    }

    // Generate unique build ID
    const buildId = `build_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Initialize tracking
    activeBuilds.set(buildId, {
      status: 'building',
      phase: 'research',
      progress: 0,
      message: 'Starting build...',
      started_at: new Date().toISOString(),
      user_id: user.id,
      project_id: dbProjectId,
      logs: [],
      stats: {
        filesGenerated: 0,
        linesOfCode: 0,
        competitorsAnalyzed: 0,
        reviewsScanned: 0
      }
    });

    // Prepare project data
    const projectData = {
      projectName,
      description,
      targetCountry: targetCountry || 'Global',
      features: features || [],
      targetPlatform: targetPlatform || 'web',
      framework: framework || 'react',
      database: database || 'postgresql',
      buildId,
      projectId: dbProjectId,
      userId: user.id,
      tier: user.tier
    };

    // Create initial notification
    await NotificationService.create(user.id, {
      title: 'Build Started! 🚀',
      message: `Building "${projectName}"...`,
      type: 'build',
      actionUrl: `/projects/${dbProjectId}`,
      actionText: 'View Progress'
    });

    // Start async build
    runMasterBuildWithStats(buildId, projectData, user.tier).catch(error => {
      console.error(`❌ Build ${buildId} failed:`, error);
      activeBuilds.set(buildId, {
        ...activeBuilds.get(buildId),
        status: 'failed',
        error: error.message,
        phase: 'error',
        progress: 0
      });
    });

    // Return immediately
    res.json({
      success: true,
      build_id: buildId,
      project_id: dbProjectId,
      message: 'Build started! Real AI agents are working...',
      estimated_time: '3-5 minutes',
      progress_url: `/api/master/build/${buildId}`,
      tier: user.tier,
      credits_remaining: user.credits - 1
    });

  } catch (error) {
    console.error('❌ Build start error:', error);
    res.status(500).json({
      error: 'Failed to start build',
      message: error.message
    });
  }
});

// ==========================================
// GET /api/master/build/:id - POLL PROGRESS (FIXED)
// ==========================================
router.get('/build/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const buildData = activeBuilds.get(id);
    
    if (!buildData) {
      return res.status(404).json({
        error: 'Build not found',
        message: 'Invalid build ID or build expired'
      });
    }

    const response = {
      status: buildData.status,
      phase: buildData.phase,
      progress: buildData.progress,
      message: buildData.message,
      current_task: buildData.current_task,
      logs: buildData.logs.slice(-20),
      stats: buildData.stats || {
        filesGenerated: 0,
        linesOfCode: 0,
        competitorsAnalyzed: 0,
        reviewsScanned: 0
      }
    };

    if (buildData.status === 'completed') {
      response.results = buildData.results;
      response.download_url = `/api/master/download/${id}`;
      response.preview_url = `/projects/${buildData.project_id}`;
    }

    if (buildData.status === 'failed') {
      response.error = buildData.error;
      response.can_retry = true;
      response.retry_url = `/api/master/build`;
      response.project_id = buildData.project_id;
    }

    res.json(response);

  } catch (error) {
    console.error('❌ Progress fetch error:', error);
    res.status(500).json({
      error: 'Failed to get progress',
      message: error.message
    });
  }
});

// ==========================================
// GET /api/master/download/:id - DOWNLOAD (FIXED)
// ==========================================
router.get('/download/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const buildData = activeBuilds.get(id);
    
    if (!buildData || buildData.status !== 'completed') {
      return res.status(404).json({
        error: 'Build not found or not completed',
        status: buildData?.status
      });
    }

    // Check ownership
    if (buildData.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const zipPath = buildData.zip_path;
    
    if (!zipPath) {
      return res.status(404).json({ error: 'Download file not ready' });
    }

    try {
      await fs.access(zipPath);
    } catch {
      return res.status(404).json({ error: 'Download file expired or not found' });
    }

    const fileName = path.basename(zipPath);
    
    console.log('📦 Sending download:', fileName);

    // Update download tracking in DB
    if (buildData.project_id) {
      await ProjectService.update(buildData.project_id, {
        downloadedAt: new Date()
      });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.sendFile(zipPath, async (err) => {
      if (err) {
        console.error('Download error:', err);
      } else {
        console.log('✅ Download completed:', fileName);
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

// ==========================================
// MAIN BUILD FUNCTION - FULLY FIXED
// ==========================================
async function runMasterBuildWithStats(buildId, projectData, tier) {
  const updateProgress = (phase, progress, message, stats = {}) => {
    const current = activeBuilds.get(buildId) || {};
    const log = {
      timestamp: new Date().toISOString(),
      phase,
      progress,
      message
    };
    
    const logs = [...(current.logs || []), log];
    const updatedStats = { ...current.stats, ...stats };
    
    activeBuilds.set(buildId, {
      ...current,
      status: 'building',
      phase,
      progress,
      message,
      current_task: message,
      logs,
      stats: updatedStats
    });

    console.log(`[${buildId}] ${progress}% - ${message}`, stats);
    
    // Update project in DB
    if (projectData.projectId) {
      ProjectService.update(projectData.projectId, {
        buildProgress: progress,
        filesGenerated: updatedStats.filesGenerated,
        linesOfCode: updatedStats.linesOfCode,
        buildData: { 
          phase, 
          progress, 
          message, 
          timestamp: log.timestamp, 
          stats: updatedStats 
        }
      }).catch(err => console.error('DB update failed:', err));
    }
  };

  try {
    console.log('\n🚀 STARTING REAL AI BUILD');
    console.log('Build ID:', buildId);
    console.log('Tier:', tier);

    const orchestrator = new MasterOrchestrator(
      tier,
      projectData.projectId,
      projectData.userId
    );

    updateProgress('research', 5, '🔍 Starting market research...');

    // PHASE 1: RESEARCH
    console.log('📊 PHASE 1: Market Intelligence');
    const phase1 = await orchestrator.executePhase1Research(projectData);
    
    const competitorsAnalyzed = phase1.competitors?.total_analyzed || 
                                 phase1.competitors?.individual_analyses?.length || 0;
    const reviewsScanned = phase1.reviews?.total_reviews || 0;
    
    updateProgress('research', 30, `✅ Research complete! Found ${competitorsAnalyzed} competitors`, {
      competitorsAnalyzed,
      reviewsScanned
    });

    // PHASE 2: STRATEGY
    console.log('🎯 PHASE 2: Strategic Planning');
    updateProgress('strategy', 35, '🎯 Creating business strategy...');
    const phase2 = await orchestrator.executePhase2Planning(phase1);
    
    updateProgress('strategy', 50, `✅ Strategy ready with ${phase2.competitive_advantages?.length || 0} advantages`);

    // PHASE 3: CODE GENERATION
    console.log('💻 PHASE 3: Code Generation');
    updateProgress('code', 55, '🗄️ Designing database schema...');
    const phase3 = await orchestrator.executePhase3CodeGeneration(phase2, projectData);
    
    // CRITICAL FIX: Extract actual file and line counts
    const filesGenerated = (phase3.frontend?.stats?.total_files || 0) + 
                          (phase3.backend?.stats?.total_files || 0);
    const linesOfCode = (phase3.frontend?.stats?.total_lines || 0) + 
                       (phase3.backend?.stats?.total_lines || 0);
    
    updateProgress('code', 85, `✅ Generated ${filesGenerated} files with ${linesOfCode} lines`, {
      filesGenerated,
      linesOfCode
    });

    // PHASE 4: QA & PACKAGING
    console.log('🧪 PHASE 4: Quality Assurance');
    updateProgress('testing', 90, '🧪 Running QA tests...');
    const phase4 = await orchestrator.executePhase4Quality(phase3);
    
    updateProgress('packaging', 95, '📦 Creating download package...');

    // CRITICAL FIX: Create ZIP and store path
    const zipPath = await createDownloadPackage(buildId, projectData.projectName, {
      phase1, phase2, phase3, phase4
    });

    console.log('✅ ZIP created:', zipPath);

    const timeTaken = Math.round((Date.now() - new Date(activeBuilds.get(buildId).started_at).getTime()) / 1000);

    // CRITICAL FIX: Properly structured results
    const finalResults = {
      success: true,
      build_id: buildId,
      project_name: projectData.projectName,
      phases: {
        research: phase1,
        strategy: phase2,
        code: phase3,
        quality: phase4
      },
      summary: {
        files_generated: filesGenerated,
        lines_of_code: linesOfCode,
        competitors_analyzed: competitorsAnalyzed,
        reviews_scanned: reviewsScanned,
        qa_score: phase4.qa_results?.overall_score || 0,
        research_score: phase4.research_verification?.score || 0,
        deployment_ready: phase4.deployment_ready || false,
        competitive_advantages: phase2.competitive_advantages?.length || 0,
        time_taken: timeTaken
      },
      download_url: `/api/master/download/${buildId}`,
      tier,
      timestamp: new Date().toISOString()
    };

    // CRITICAL FIX: Mark project as completed with ALL data
    if (projectData.projectId) {
      await ProjectService.update(projectData.projectId, {
        status: 'completed',
        buildProgress: 100,
        completedAt: new Date(),
        filesGenerated,
        linesOfCode,
        qaScore: phase4.qa_results?.overall_score,
        deploymentReady: phase4.deployment_ready,
        downloadUrl: `/api/master/download/${buildId}`,
        deploymentUrl: null, // Will be set when deployed
        buildData: finalResults, // Store complete results
        researchData: phase1, // Store research separately
        competitorData: phase2 // Store competitors separately
      });
      console.log('✅ Project marked complete in DB with full data');
    }

    // Send completion notification
    await NotificationService.create(projectData.userId, {
      title: 'Build Complete! 🎉',
      message: `Your project "${projectData.projectName}" is ready to download`,
      type: 'success',
      actionUrl: `/projects/${projectData.projectId}`,
      actionText: 'Download Now'
    });

    // CRITICAL FIX: Update build tracking with final stats AND zip path
    activeBuilds.set(buildId, {
      ...activeBuilds.get(buildId),
      status: 'completed',
      phase: 'done',
      progress: 100,
      message: '🎉 Build complete! Ready to download.',
      results: finalResults,
      zip_path: zipPath, // CRITICAL: Store zip path
      completed_at: new Date().toISOString(),
      stats: {
        filesGenerated,
        linesOfCode,
        competitorsAnalyzed,
        reviewsScanned
      }
    });

    console.log('\n✅ BUILD COMPLETED SUCCESSFULLY!');
    console.log('Files:', filesGenerated);
    console.log('Lines:', linesOfCode);
    console.log('Time:', timeTaken, 'seconds');
    console.log('ZIP:', zipPath);

  } catch (error) {
    console.error('\n❌ BUILD FAILED:', error);
    console.error(error.stack);

    activeBuilds.set(buildId, {
      ...activeBuilds.get(buildId),
      status: 'failed',
      phase: 'error',
      progress: 0,
      error: error.message,
      message: `Build failed: ${error.message}`,
      can_retry: true
    });

    if (projectData.projectId) {
      await ProjectService.update(projectData.projectId, {
        status: 'failed',
        buildData: { error: error.message, stack: error.stack }
      }).catch(err => console.error('Failed to update project:', err));
    }

    await NotificationService.create(projectData.userId, {
      title: 'Build Failed ❌',
      message: `Build failed: ${error.message}. You can retry the build.`,
      type: 'error',
      actionUrl: `/projects/${projectData.projectId}`,
      actionText: 'Retry Build'
    }).catch(err => console.error('Failed to send notification:', err));
  }
}

// ==========================================
// CREATE DOWNLOAD PACKAGE - FIXED
// ==========================================
async function createDownloadPackage(buildId, projectName, results) {
  const tempDir = path.join(__dirname, '../temp');
  await fs.mkdir(tempDir, { recursive: true });

  const fileName = `${projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}.zip`;
  const zipPath = path.join(tempDir, fileName);

  console.log('📦 Creating ZIP:', fileName);

  return new Promise((resolve, reject) => {
    const output = require('fs').createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      console.log(`✅ ZIP created: ${archive.pointer()} bytes`);
      resolve(zipPath);
    });

    archive.on('error', (err) => {
      console.error('❌ ZIP creation failed:', err);
      reject(err);
    });

    archive.pipe(output);

    try {
      // Add frontend files
      if (results.phase3?.frontend?.files) {
        Object.entries(results.phase3.frontend.files).forEach(([filepath, content]) => {
          archive.append(content, { name: `frontend/${filepath}` });
        });
      }

      // Add backend files
      if (results.phase3?.backend?.files) {
        Object.entries(results.phase3.backend.files).forEach(([filepath, content]) => {
          archive.append(content, { name: `backend/${filepath}` });
        });
      }

      // Add database files
      if (results.phase3?.database) {
        if (results.phase3.database.migrations) {
          results.phase3.database.migrations.forEach((migration, i) => {
            const sql = typeof migration === 'string' ? migration : migration.sql;
            archive.append(sql, { 
              name: `database/migrations/${String(i + 1).padStart(3, '0')}_migration.sql` 
            });
          });
        }

        if (results.phase3.database.prisma_schema) {
          archive.append(results.phase3.database.prisma_schema, { 
            name: 'backend/prisma/schema.prisma' 
          });
        }
      }

      // Add comprehensive documentation
      archive.append(generateREADME(results), { name: 'README.md' });
      archive.append(generateResearchReport(results.phase1), { name: 'RESEARCH_REPORT.md' });
      archive.append(generateDeploymentGuide(), { name: 'DEPLOYMENT_GUIDE.md' });

      archive.finalize();
    } catch (error) {
      console.error('❌ Error adding files to ZIP:', error);
      reject(error);
    }
  });
}

function generateREADME(results) {
  const stats = results.phase3 || {};
  return `# ${results.phase2?.project_name || 'My App'}

**Built with Launch AI** 🚀  
Generated: ${new Date().toISOString()}

## 📊 Build Statistics

- **Frontend Files**: ${stats.frontend?.stats?.total_files || 0}
- **Backend Files**: ${stats.backend?.stats?.total_files || 0}
- **Total Lines of Code**: ${(stats.frontend?.stats?.total_lines || 0) + (stats.backend?.stats?.total_lines || 0)}
- **QA Score**: ${results.phase4?.qa_results?.overall_score || 0}/100
- **Deployment Ready**: ${results.phase4?.deployment_ready ? '✅ YES' : '⚠️ Needs review'}

## 🎯 Competitive Advantages

${results.phase2?.competitive_advantages?.map((adv, i) => `${i + 1}. **${adv.feature}** - ${adv.source}`).join('\n') || 'Based on comprehensive market research'}

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- npm or yarn

### Frontend Setup
\`\`\`bash
cd frontend
npm install
npm start
\`\`\`

The app will run on http://localhost:3000

### Backend Setup
\`\`\`bash
cd backend
npm install

# Setup environment
cp .env.example .env
# Edit .env with your database credentials

# Run migrations
npx prisma db push

# Start server
npm run dev
\`\`\`

The API will run on http://localhost:5000

## 📦 Project Structure

\`\`\`
project/
├── frontend/          React application
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── App.js
│   └── package.json
├── backend/           Node.js API
│   ├── routes/
│   ├── controllers/
│   ├── middleware/
│   ├── prisma/
│   │   └── schema.prisma
│   └── server.js
├── database/
│   └── migrations/
└── README.md
\`\`\`

## 🌐 Deployment

See DEPLOYMENT_GUIDE.md for detailed deployment instructions.

Quick options:
- **Frontend**: Deploy to Vercel (free)
- **Backend**: Deploy to Railway ($5/mo with database)

## 📖 Documentation

- **RESEARCH_REPORT.md** - Market analysis and competitor insights
- **DEPLOYMENT_GUIDE.md** - Step-by-step deployment instructions

## 🆘 Support

Built by Launch AI - https://launch-ai.com
For issues, contact support@launch-ai.com

---
Generated by Launch AI Platform
`;
}

function generateResearchReport(research) {
  return `# 📊 Market Research Report

Generated: ${new Date().toISOString()}

## Executive Summary

- **Competitors Analyzed**: ${research?.competitors?.total_analyzed || 0}
- **User Reviews Analyzed**: ${research?.reviews?.total_reviews || 0}
- **Market Size**: ${research?.market?.market_overview?.tam || 'Large addressable market'}
- **Competition Level**: ${research?.market?.competition_level || 'Moderate'}

## Detailed Findings

${JSON.stringify(research, null, 2)}

---
This research was compiled by AI agents analyzing real market data.
`;
}

function generateDeploymentGuide() {
  return `# 🚀 Deployment Guide

## Option 1: Quick Deploy (Recommended)

### Frontend → Vercel (Free)
1. Install Vercel CLI: \`npm i -g vercel\`
2. Navigate to frontend folder: \`cd frontend\`
3. Login: \`vercel login\`
4. Deploy: \`vercel --prod\`

### Backend → Railway ($5/mo)
1. Install Railway CLI: \`npm i -g @railway/cli\`
2. Navigate to backend folder: \`cd backend\`
3. Login: \`railway login\`
4. Initialize: \`railway init\`
5. Add database: \`railway add --database postgres\`
6. Deploy: \`railway up\`

## Environment Variables

### Frontend (.env)
\`\`\`
REACT_APP_API_URL=https://your-backend-url.railway.app
\`\`\`

### Backend (.env)
\`\`\`
DATABASE_URL=postgresql://...  # Railway provides this
JWT_SECRET=your-secure-random-string
PORT=5000
NODE_ENV=production
\`\`\`

## Post-Deployment Checklist

- [ ] Frontend is accessible
- [ ] Backend health check works: \`/api/health\`
- [ ] Database migrations ran successfully
- [ ] Environment variables configured
- [ ] CORS settings updated
- [ ] SSL/HTTPS enabled
- [ ] Custom domain configured (optional)

## Monitoring

- Check logs: \`railway logs\` or \`vercel logs\`
- Monitor uptime with UptimeRobot (free)
- Set up error tracking with Sentry

---
Need help? Contact Launch AI support
`;
}

// Cleanup old builds every hour
setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  activeBuilds.forEach((data, buildId) => {
    const startTime = new Date(data.started_at).getTime();
    if (now - startTime > maxAge) {
      if (data.zip_path) {
        fs.unlink(data.zip_path).catch(err => console.error('Failed to delete ZIP:', err));
      }
      activeBuilds.delete(buildId);
      console.log(`🗑️ Cleaned up old build: ${buildId}`);
    }
  });
}, 60 * 60 * 1000);

module.exports = router;