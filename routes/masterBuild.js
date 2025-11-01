// backend/routes/masterBuild.js
// 🚀 ULTRA BUILD SYSTEM - Parallel, Smart, Production-Ready

const express = require('express');
const router = express.Router();
const MasterOrchestrator = require('../agents/masterOrchestratorUltra');
const { UserService, ProjectService, NotificationService } = require('../services/database');
const { authenticateToken } = require('./authWithDb');
const archiver = require('archiver');
const path = require('path');
const fs = require('fs').promises;

const activeBuilds = new Map();

// ==========================================
// POST /api/master/build - START BUILD
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
        error: 'Provide detailed description (min 20 chars)'
      });
    }

    // Get user
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

    // Deduct credit
    await UserService.deductCredit(user.id);
    console.log('✅ Credit deducted. Remaining:', user.credits - 1);

    // Get/create project
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
      console.log('✅ Project created:', dbProjectId);
    } else {
      await ProjectService.update(dbProjectId, {
        status: 'building',
        buildProgress: 0
      });
      console.log('🔄 Retrying build:', dbProjectId);
    }

    // Generate build ID
    const buildId = `build_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Initialize tracking
    activeBuilds.set(buildId, {
      status: 'building',
      phase: 'research',
      progress: 0,
      message: 'Starting AI build...',
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

    // Project data
    const projectData = {
      projectName,
      description,
      targetCountry: targetCountry || 'Global',
      features: features || [],
      targetPlatform: targetPlatform || 'web',
      framework: framework || 'react',
      database: database || 'postgresql',
      authentication: true,
      buildId,
      projectId: dbProjectId,
      userId: user.id,
      tier: user.tier
    };

    // Notification
    await NotificationService.create(user.id, {
      title: 'Build Started! 🚀',
      message: `Building "${projectName}" with AI agents...`,
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
      message: 'Build started! AI agents are working in parallel...',
      estimated_time: '3-5 minutes',
      progress_url: `/api/master/build/${buildId}`,
      tier: user.tier,
      credits_remaining: user.credits - 1,
      parallel_processing: true
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
// GET /api/master/build/:id - POLL PROGRESS
// ==========================================
router.get('/build/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const buildData = activeBuilds.get(id);
    
    if (!buildData) {
      return res.status(404).json({
        error: 'Build not found',
        message: 'Invalid build ID or expired'
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
    console.error('❌ Progress error:', error);
    res.status(500).json({
      error: 'Failed to get progress',
      message: error.message
    });
  }
});

// ==========================================
// GET /api/master/download/:id - DOWNLOAD
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
      return res.status(404).json({ error: 'Download not ready' });
    }

    try {
      await fs.access(zipPath);
    } catch {
      return res.status(404).json({ error: 'File expired' });
    }

    const fileName = path.basename(zipPath);
    
    console.log('📦 Sending download:', fileName);

    // Update tracking
    if (buildData.project_id) {
      await ProjectService.update(buildData.project_id, {
        downloadedAt: new Date()
      });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.sendFile(zipPath, (err) => {
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
// MAIN BUILD FUNCTION - ULTRA VERSION
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
    
    // Update DB
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
    console.log('\n🚀 STARTING ULTRA AI BUILD (Parallel)');
    console.log('Build ID:', buildId);
    console.log('Tier:', tier);

    const orchestrator = new MasterOrchestrator(
      tier,
      projectData.projectId,
      projectData.userId
    );

    updateProgress('research', 5, '🔍 Starting market research (parallel)...');

    // PHASE 1: RESEARCH (PARALLEL)
    console.log('📊 PHASE 1: Market Intelligence (Parallel)');
    const phase1 = await orchestrator.executePhase1ResearchUltra(projectData);
    
    const competitorsAnalyzed = phase1.competitors?.total_analyzed || 0;
    const reviewsScanned = phase1.reviews?.totalReviewsAnalyzed || 0;
    
    updateProgress('research', 30, `✅ Research complete! ${competitorsAnalyzed} competitors analyzed`, {
      competitorsAnalyzed,
      reviewsScanned
    });

    // PHASE 2: STRATEGY (PARALLEL)
    console.log('🎯 PHASE 2: Strategic Planning (Parallel)');
    updateProgress('strategy', 35, '🎯 Creating strategy (parallel)...');
    const phase2 = await orchestrator.executePhase2PlanningUltra(phase1);
    
    const advantages = phase2.competitive_advantages?.length || 0;
    updateProgress('strategy', 50, `✅ Strategy ready with ${advantages} advantages`);

    // PHASE 3: CODE GENERATION (PARALLEL)
    console.log('💻 PHASE 3: Code Generation (Parallel)');
    updateProgress('code', 55, '🗄️ Designing database...');
    const phase3 = await orchestrator.executePhase3CodeGenerationUltra(phase2, projectData);
    
    // Extract accurate stats
    const filesGenerated = (phase3.frontend?.stats?.total_files || 0) + 
                          (phase3.backend?.stats?.total_files || 0);
    const linesOfCode = (phase3.frontend?.stats?.total_lines || 0) + 
                       (phase3.backend?.stats?.total_lines || 0);
    
    updateProgress('code', 85, `✅ Generated ${filesGenerated} files (${linesOfCode} lines)`, {
      filesGenerated,
      linesOfCode
    });

    // PHASE 4: QA & PACKAGING
    console.log('🧪 PHASE 4: Quality Assurance');
    updateProgress('testing', 90, '🧪 Running QA tests...');
    const phase4 = await orchestrator.executePhase4QualityUltra(phase3);
    
    updateProgress('packaging', 95, '📦 Creating download package...');

    // Create ZIP
    const zipPath = await createDownloadPackage(buildId, projectData.projectName, {
      phase1, phase2, phase3, phase4
    });

    console.log('✅ ZIP created:', zipPath);

    const timeTaken = Math.round((Date.now() - new Date(activeBuilds.get(buildId).started_at).getTime()) / 1000);

    // Final results
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
        competitive_advantages: advantages,
        time_taken: timeTaken,
        parallel_processed: true
      },
      download_url: `/api/master/download/${buildId}`,
      tier,
      timestamp: new Date().toISOString()
    };

    // Update project as completed
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
        deploymentUrl: null,
        buildData: finalResults,
        researchData: phase1,
        competitorData: phase2
      });
      console.log('✅ Project marked complete with full data');
    }

    // Completion notification
    await NotificationService.create(projectData.userId, {
      title: 'Build Complete! 🎉',
      message: `"${projectData.projectName}" ready! ${filesGenerated} files, ${linesOfCode} lines`,
      type: 'success',
      actionUrl: `/projects/${projectData.projectId}`,
      actionText: 'Download Now'
    });

    // Update build tracking with ZIP path
    activeBuilds.set(buildId, {
      ...activeBuilds.get(buildId),
      status: 'completed',
      phase: 'done',
      progress: 100,
      message: '🎉 Build complete! Ready to download.',
      results: finalResults,
      zip_path: zipPath,
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
    console.log('Parallel Processing: ENABLED');

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
      }).catch(err => console.error('Failed to update:', err));
    }

    await NotificationService.create(projectData.userId, {
      title: 'Build Failed ❌',
      message: `Build failed: ${error.message}. You can retry.`,
      type: 'error',
      actionUrl: `/projects/${projectData.projectId}`,
      actionText: 'Retry Build'
    }).catch(err => console.error('Failed notification:', err));
  }
}

// ==========================================
// CREATE DOWNLOAD PACKAGE
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
      console.error('❌ ZIP failed:', err);
      reject(err);
    });

    archive.pipe(output);

    try {
      // Validate
      if (!results.phase3) {
        throw new Error('Missing phase3 results');
      }

      // Frontend files
      if (results.phase3.frontend?.files) {
        Object.entries(results.phase3.frontend.files).forEach(([filepath, content]) => {
          archive.append(content, { name: `frontend/${filepath}` });
        });
        console.log(`✅ Added ${Object.keys(results.phase3.frontend.files).length} frontend files`);
      }

      // Backend files
      if (results.phase3.backend?.files) {
        Object.entries(results.phase3.backend.files).forEach(([filepath, content]) => {
          archive.append(content, { name: `backend/${filepath}` });
        });
        console.log(`✅ Added ${Object.keys(results.phase3.backend.files).length} backend files`);
      }

      // Database files
      if (results.phase3.database) {
        // Migrations
        if (Array.isArray(results.phase3.database.migrations)) {
          results.phase3.database.migrations.forEach((migration, i) => {
            const sql = typeof migration === 'string' ? migration : migration.sql || '';
            const name = migration.name || `${String(i + 1).padStart(3, '0')}_migration.sql`;
            
            if (sql) {
              archive.append(sql, { name: `database/migrations/${name}` });
            }
          });
          console.log(`✅ Added ${results.phase3.database.migrations.length} migrations`);
        }

        // Prisma schema
        if (results.phase3.database.prisma_schema) {
          archive.append(results.phase3.database.prisma_schema, { 
            name: 'backend/prisma/schema.prisma' 
          });
          console.log('✅ Added Prisma schema');
        }
      }

      // Documentation
      archive.append(generateREADME(results), { name: 'README.md' });
      archive.append(generateResearchReport(results.phase1), { name: 'RESEARCH_REPORT.md' });
      archive.append(generateDeploymentGuide(), { name: 'DEPLOYMENT_GUIDE.md' });

      archive.finalize();
    } catch (error) {
      console.error('❌ Error adding files:', error);
      reject(error);
    }
  });
}

function generateREADME(results) {
  const stats = results.phase3 || {};
  return `# ${results.phase2?.project_name || 'My App'}

**Built with Launch AI ULTRA** 🚀  
Generated: ${new Date().toISOString()}

## 📊 Build Statistics

- **Frontend Files**: ${stats.frontend?.stats?.total_files || 0}
- **Backend Files**: ${stats.backend?.stats?.total_files || 0}
- **Total Lines**: ${(stats.frontend?.stats?.total_lines || 0) + (stats.backend?.stats?.total_lines || 0)}
- **QA Score**: ${results.phase4?.qa_results?.overall_score || 0}/100
- **Deployment Ready**: ${results.phase4?.deployment_ready ? '✅ YES' : '⚠️ Review needed'}
- **Parallel Processed**: ✅ YES

## 🎯 Competitive Advantages

${results.phase2?.competitive_advantages?.map((adv, i) => `${i + 1}. **${adv.feature}** - ${adv.source}`).join('\n') || 'Based on comprehensive research'}

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

Runs on http://localhost:3000

### Backend Setup
\`\`\`bash
cd backend
npm install

# Setup environment
cp .env.example .env
# Edit .env with database credentials

# Run migrations
npx prisma db push

# Start server
npm run dev
\`\`\`

Runs on http://localhost:5000

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

## 🌍 Deployment

See DEPLOYMENT_GUIDE.md for details.

Quick options:
- **Frontend**: Vercel (free)
- **Backend**: Railway ($5/mo)

## 📖 Documentation

- **RESEARCH_REPORT.md** - Market analysis
- **DEPLOYMENT_GUIDE.md** - Deployment steps

## 🆘 Support

Built by Launch AI - https://launch-ai.com

---
Generated by Launch AI ULTRA Platform (Parallel Processing)
`;
}

function generateResearchReport(research) {
  return `# 📊 Market Research Report

Generated: ${new Date().toISOString()}

## Executive Summary

- **Competitors Analyzed**: ${research?.competitors?.total_analyzed || 0}
- **Reviews Analyzed**: ${research?.reviews?.totalReviewsAnalyzed || 0}
- **Market Size**: ${research?.market?.market_overview?.size || 'Large'}
- **Competition**: ${research?.market?.competition_level || 'Moderate'}

## Detailed Findings

${JSON.stringify(research, null, 2)}

---
Compiled by AI agents with parallel processing
`;
}

function generateDeploymentGuide() {
  return `# 🚀 Deployment Guide

## Option 1: Quick Deploy

### Frontend → Vercel (Free)
1. \`npm i -g vercel\`
2. \`cd frontend\`
3. \`vercel login\`
4. \`vercel --prod\`

### Backend → Railway ($5/mo)
1. \`npm i -g @railway/cli\`
2. \`cd backend\`
3. \`railway login\`
4. \`railway init\`
5. \`railway add --database postgres\`
6. \`railway up\`

## Environment Variables

### Frontend (.env)
\`\`\`
REACT_APP_API_URL=https://your-backend.railway.app
\`\`\`

### Backend (.env)
\`\`\`
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret
PORT=5000
NODE_ENV=production
\`\`\`

## Post-Deployment

- [ ] Frontend accessible
- [ ] Backend health: \`/api/health\`
- [ ] Migrations ran
- [ ] Env vars set
- [ ] CORS configured
- [ ] SSL enabled

## Monitoring

- Railway logs: \`railway logs\`
- Vercel logs: \`vercel logs\`
- Uptime: UptimeRobot (free)

---
Built with Launch AI ULTRA
`;
}

// Cleanup old builds
setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24h

  activeBuilds.forEach((data, buildId) => {
    const startTime = new Date(data.started_at).getTime();
    if (now - startTime > maxAge) {
      if (data.zip_path) {
        fs.unlink(data.zip_path).catch(err => 
          console.error('Failed to delete ZIP:', err)
        );
      }
      activeBuilds.delete(buildId);
      console.log(`🗑️ Cleaned up: ${buildId}`);
    }
  });
}, 60 * 60 * 1000); // Every hour

module.exports = router;