// backend/routes/masterBuild.js
// 🚀 ULTRA BUILD SYSTEM - Complete, Powerful, Production-Ready with Live Preview

const express = require('express');
const router = express.Router();
const MasterOrchestrator = require('../agents/masterOrchestratorUltra');
const { UserService, ProjectService, NotificationService } = require('../services/database');
const { authenticateToken } = require('./authWithDb');
const archiver = require('archiver');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');


// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Calculate total size of files
 */
function calculateTotalSize(filesOrPhase3) {
  if (!filesOrPhase3) return 0;
  
  // If it's phase3 object with frontend/backend
  if (filesOrPhase3.frontend || filesOrPhase3.backend) {
    const frontendSize = calculateTotalSize(filesOrPhase3.frontend?.files || {});
    const backendSize = calculateTotalSize(filesOrPhase3.backend?.files || {});
    return frontendSize + backendSize;
  }
  
  // If it's a files object
  if (typeof filesOrPhase3 === 'object') {
    return Object.values(filesOrPhase3).reduce((total, content) => {
      if (!content) return total;
      if (typeof content === 'string') return total + content.length;
      if (typeof content === 'object') return total + JSON.stringify(content).length;
      return total;
    }, 0);
  }
  
  return 0;
}

/**
 * Merge files from multiple sources
 */
function mergeFiles(...sources) {
  const merged = {};
  for (const source of sources) {
    if (source && typeof source === 'object') {
      Object.assign(merged, source);
    }
  }
  return merged;
}

/**
 * Extract file counts from phase3
 */
function extractFileCounts(phase3) {
  if (!phase3) return { frontend: 0, backend: 0, database: 0 };
  
  return {
    frontend: Object.keys(phase3.frontend?.files || {}).length,
    backend: Object.keys(phase3.backend?.files || {}).length,
    database: phase3.database?.migrations?.length || 0
  };
}

// ==========================================
// ACTIVE BUILDS & FILES CACHE
// ==========================================
const activeBuilds = new Map();
const buildFilesCache = new Map();
const buildLogs = new Map();

// ==========================================
// HELPER: SMOOTH PROGRESS SIMULATOR
// ==========================================
function createProgressSimulator(buildId, startProgress, endProgress, duration, phase, baseMessage) {
  const buildData = activeBuilds.get(buildId);
  if (!buildData || buildData.status !== 'building') return null;

  const steps = Math.ceil(duration / 1000);
  const increment = (endProgress - startProgress) / steps;
  let currentProgress = startProgress;
  let step = 0;

  const messages = [
    `${baseMessage}...`,
    `${baseMessage}... processing`,
    `${baseMessage}... analyzing`,
    `${baseMessage}... optimizing`,
    `${baseMessage}... ${Math.round((step / steps) * 100)}%`
  ];

  const interval = setInterval(() => {
    const currentBuild = activeBuilds.get(buildId);
    if (!currentBuild || currentBuild.status !== 'building') {
      clearInterval(interval);
      return;
    }

    step++;
    currentProgress = Math.min(startProgress + (increment * step), endProgress);
    
    const message = messages[step % messages.length];
    
    updateBuildProgress(buildId, {
      phase,
      progress: Math.round(currentProgress),
      message,
      stats: currentBuild.stats
    });

    if (step >= steps) {
      clearInterval(interval);
    }
  }, 1000);

  return interval;
}

// ==========================================
// HELPER: UPDATE BUILD PROGRESS
// ==========================================
function updateBuildProgress(buildId, updates) {
  const current = activeBuilds.get(buildId);
  if (!current) return;

  const log = {
    timestamp: new Date().toISOString(),
    phase: updates.phase || current.phase,
    progress: updates.progress || current.progress,
    message: updates.message || current.message
  };

  const logs = [...(current.logs || []), log];
  const updatedStats = { ...current.stats, ...(updates.stats || {}) };
  const updatedFiles = updates.files ? { ...(current.files || {}), ...updates.files } : (current.files || {});

  const updated = {
    ...current,
    status: updates.status || current.status,
    phase: updates.phase || current.phase,
    progress: updates.progress !== undefined ? updates.progress : current.progress,
    message: updates.message || current.message,
    current_task: updates.message || current.message,
    logs: logs.slice(-50), // Keep last 50 logs
    stats: updatedStats,
    files: updatedFiles,
    lastUpdated: new Date().toISOString()
  };

  activeBuilds.set(buildId, updated);

  // Cache files for live preview
  if (Object.keys(updatedFiles).length > 0) {
    buildFilesCache.set(buildId, {
      files: updatedFiles,
      stats: updatedStats,
      lastUpdated: new Date().toISOString()
    });
  }

  // Store detailed logs
  if (!buildLogs.has(buildId)) {
    buildLogs.set(buildId, []);
  }
  buildLogs.get(buildId).push(log);

  // Database update (async, non-blocking)
  if (current.project_id) {
    ProjectService.update(current.project_id, {
      buildProgress: updated.progress,
      filesGenerated: updatedStats.filesGenerated || 0,
      linesOfCode: updatedStats.linesOfCode || 0,
      buildData: {
        phase: updated.phase,
        progress: updated.progress,
        message: updated.message,
        timestamp: log.timestamp,
        stats: updatedStats,
        filesAvailable: Object.keys(updatedFiles).length
      }
    }).catch(err => console.error('⚠️ DB update failed:', err));
  }

  console.log(`[${buildId}] ${updated.progress}% - ${updated.phase} - ${updated.message}`);
}

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
        error: 'Provide detailed description (minimum 20 characters)'
      });
    }

    // Get user
    const user = await UserService.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check credits
    if (user.credits <= 0) {
      return res.status(403).json({
        error: 'No credits remaining',
        credits: user.credits,
        upgrade_url: '/pricing',
        message: 'Please upgrade your plan to continue building'
      });
    }

    console.log('\n🚀 BUILD START:', {
      user: user.email,
      credits: user.credits,
      project: projectName,
      tier: user.tier,
      timestamp: new Date().toISOString()
    });

    // Deduct credit
    await UserService.deductCredit(user.id);
    console.log('✅ Credit deducted. Remaining:', user.credits - 1);

    // Get or create project
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
        buildProgress: 0,
        startedAt: new Date(),  // This will now work
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

    // Generate unique build ID
    const buildId = `build_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Initialize build tracking
    activeBuilds.set(buildId, {
      status: 'building',
      phase: 'initializing',
      progress: 0,
      message: 'Initializing AI build system...',
      started_at: new Date().toISOString(),
      user_id: user.id,
      project_id: dbProjectId,
      logs: [],
      stats: {
        filesGenerated: 0,
        linesOfCode: 0,
        competitorsAnalyzed: 0,
        reviewsScanned: 0,
        componentsCreated: 0,
        apisGenerated: 0,
        testsWritten: 0
      },
      files: {},
      metadata: {
        projectName,
        description,
        targetCountry: targetCountry || 'Global',
        framework: framework || 'react',
        database: database || 'postgresql',
        tier: user.tier
      }
    });

    // Project data for build
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

    // Create notification
    await NotificationService.create(user.id, {
      title: 'Build Started! 🚀',
      message: `Building "${projectName}" with AI agents. Live preview will be available soon.`,
      type: 'build',
      actionUrl: `/projects/${dbProjectId}`,
      actionText: 'View Progress'
    });

    // Start async build process
    runUltraBuildProcess(buildId, projectData, user.tier).catch(error => {
      console.error(`❌ Build ${buildId} catastrophic failure:`, error);
      updateBuildProgress(buildId, {
        status: 'failed',
        phase: 'error',
        progress: 0,
        message: `Build failed: ${error.message}`,
        error: error.message
      });
    });

    // Return immediately
    res.json({
      success: true,
      build_id: buildId,
      project_id: dbProjectId,
      message: 'Build started successfully! AI agents are working in parallel.',
      estimated_time: user.tier === 'premium' ? '2-4 minutes' : user.tier === 'starter' ? '3-5 minutes' : '5-8 minutes',
      progress_url: `/api/master/build/${buildId}`,
      live_preview_url: `/api/preview/${buildId}/files`,
      tier: user.tier,
      credits_remaining: user.credits - 1,
      features: {
        parallel_processing: true,
        live_preview: true,
        real_time_updates: true,
        market_research: true,
        competitor_analysis: true,
        review_analysis: user.tier !== 'free',
        research_papers: user.tier === 'premium'
      }
    });

  } catch (error) {
    console.error('❌ Build start error:', error);
    res.status(500).json({
      error: 'Failed to start build',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
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
        message: 'Invalid build ID or build expired (24h retention)',
        buildId: id
      });
    }

    const response = {
      success: true,
      build_id: id,
      status: buildData.status,
      phase: buildData.phase,
      progress: buildData.progress,
      message: buildData.message,
      current_task: buildData.current_task,
      started_at: buildData.started_at,
      last_updated: buildData.lastUpdated || buildData.started_at,
      
      // Logs
      logs: buildData.logs.slice(-20),
      total_logs: buildData.logs.length,
      
      // Stats
      stats: buildData.stats,
      
      // Files
      files: buildData.files || {},
      files_count: Object.keys(buildData.files || {}).length,
      files_available: Object.keys(buildData.files || {}).length > 0,
      
      // Metadata
      metadata: buildData.metadata,
      
      // Time tracking
      elapsed_time: buildData.started_at ? 
        Math.round((Date.now() - new Date(buildData.started_at).getTime()) / 1000) : 0
    };

    // Additional data for completed builds
    if (buildData.status === 'completed') {
      response.completed_at = buildData.completed_at;
      response.results = buildData.results;
      response.download_url = `/api/master/download/${id}`;
      response.preview_url = `/projects/${buildData.project_id}`;
      response.live_preview_url = `/api/preview/${id}/files`;
      response.total_time = buildData.completed_at && buildData.started_at ?
        Math.round((new Date(buildData.completed_at).getTime() - new Date(buildData.started_at).getTime()) / 1000) : 0;
    }

    // Additional data for failed builds
    if (buildData.status === 'failed') {
      response.error = buildData.error;
      response.failed_at = buildData.failed_at;
      response.can_retry = true;
      response.retry_url = `/api/master/build`;
      response.project_id = buildData.project_id;
    }

    res.json(response);

  } catch (error) {
    console.error('❌ Progress fetch error:', error);
    res.status(500).json({
      error: 'Failed to get build progress',
      message: error.message
    });
  }
});

// ==========================================
// GET /api/master/build/:id/logs - GET DETAILED LOGS
// ==========================================
router.get('/build/:id/logs', async (req, res) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    
    const logs = buildLogs.get(id) || [];
    const paginatedLogs = logs.slice(offset, offset + limit);
    
    res.json({
      success: true,
      build_id: id,
      logs: paginatedLogs,
      total: logs.length,
      offset,
      limit
    });

  } catch (error) {
    console.error('❌ Logs fetch error:', error);
    res.status(500).json({
      error: 'Failed to get logs',
      message: error.message
    });
  }
});

// ==========================================
// GET /api/master/download/:id - DOWNLOAD ZIP
// ==========================================
router.get('/download/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const buildData = activeBuilds.get(id);
    
    if (!buildData) {
      return res.status(404).json({
        error: 'Build not found',
        buildId: id
      });
    }

    if (buildData.status !== 'completed') {
      return res.status(400).json({
        error: 'Build not completed',
        status: buildData.status,
        progress: buildData.progress,
        message: buildData.status === 'building' ? 'Build is still in progress' : 'Build failed'
      });
    }

    // Check ownership
    if (buildData.user_id !== req.user.id) {
      return res.status(403).json({ 
        error: 'Unauthorized',
        message: 'You do not have permission to download this build'
      });
    }

    const zipPath = buildData.zip_path;
    
    if (!zipPath) {
      return res.status(404).json({ 
        error: 'Download not ready',
        message: 'ZIP file is being prepared'
      });
    }

    // Check if file exists
    try {
      await fs.access(zipPath);
    } catch {
      return res.status(404).json({ 
        error: 'File expired',
        message: 'Download file has expired. Please rebuild the project.'
      });
    }

    const fileName = path.basename(zipPath);
    const stat = await fs.stat(zipPath);
    
    console.log('📦 Sending download:', {
      fileName,
      size: `${(stat.size / 1024 / 1024).toFixed(2)} MB`,
      user: req.user.email
    });

    // Update download tracking
    if (buildData.project_id) {
      await ProjectService.update(buildData.project_id, {
        downloadedAt: new Date(),
        downloadCount: { increment: 1 }
      }).catch(err => console.error('Failed to track download:', err));
    }

    // Send file
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', stat.size);
    
    const fileStream = fsSync.createReadStream(zipPath);
    fileStream.pipe(res);
    
    fileStream.on('end', () => {
      console.log('✅ Download completed:', fileName);
    });
    
    fileStream.on('error', (err) => {
      console.error('❌ Download stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Download failed' });
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
// DELETE /api/master/build/:id - CANCEL BUILD
// ==========================================
router.delete('/build/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const buildData = activeBuilds.get(id);
    
    if (!buildData) {
      return res.status(404).json({ error: 'Build not found' });
    }

    // Check ownership
    if (buildData.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Can only cancel building or failed builds
    if (buildData.status === 'completed') {
      return res.status(400).json({ 
        error: 'Cannot cancel completed build',
        message: 'Build has already completed'
      });
    }

    // Update status
    updateBuildProgress(id, {
      status: 'cancelled',
      phase: 'cancelled',
      message: 'Build cancelled by user'
    });

    // Cleanup
    activeBuilds.delete(id);
    buildFilesCache.delete(id);
    buildLogs.delete(id);

    // Update project
    if (buildData.project_id) {
      await ProjectService.update(buildData.project_id, {
        status: 'cancelled'
      }).catch(err => console.error('Failed to update project:', err));
    }

    res.json({
      success: true,
      message: 'Build cancelled successfully',
      build_id: id
    });

  } catch (error) {
    console.error('❌ Cancel build error:', error);
    res.status(500).json({
      error: 'Failed to cancel build',
      message: error.message
    });
  }
});

// ==========================================
// GET /api/master/stats - GET SYSTEM STATS
// ==========================================
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const activeCount = Array.from(activeBuilds.values()).filter(b => b.status === 'building').length;
    const completedCount = Array.from(activeBuilds.values()).filter(b => b.status === 'completed').length;
    const failedCount = Array.from(activeBuilds.values()).filter(b => b.status === 'failed').length;
    
    res.json({
      success: true,
      stats: {
        active_builds: activeCount,
        completed_builds: completedCount,
        failed_builds: failedCount,
        total_cached: activeBuilds.size,
        files_cached: buildFilesCache.size
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Stats error:', error);
    res.status(500).json({
      error: 'Failed to get stats',
      message: error.message
    });
  }
});

// ==========================================
// MAIN BUILD PROCESS - ULTRA VERSION
// ==========================================
async function runUltraBuildProcess(buildId, projectData, tier) {
  const startTime = Date.now();
  
  try {
    console.log('\n🚀 STARTING ULTRA AI BUILD WITH LIVE PREVIEW');
    console.log('═'.repeat(60));
    console.log(`Build ID: ${buildId}`);
    console.log(`Project: ${projectData.projectName}`);
    console.log(`Tier: ${tier}`);
    console.log(`Started: ${new Date().toISOString()}`);
    console.log('═'.repeat(60));

    updateBuildProgress(buildId, {
      phase: 'initializing',
      progress: 2,
      message: '🎯 Initializing ULTRA AI orchestrator...'
    });

    const orchestrator = new MasterOrchestrator(
      tier,
      projectData.projectId,
      projectData.userId
    );

    await new Promise(resolve => setTimeout(resolve, 1000));

    // ==========================================
    // PHASE 1: MARKET RESEARCH (0-30%)
    // ==========================================
    console.log('\n📊 PHASE 1: ULTRA Market Research');
    console.log('─'.repeat(60));
    
    updateBuildProgress(buildId, {
      phase: 'research',
      progress: 5,
      message: '🔍 Starting comprehensive market research...'
    });

    const researchSimulator = createProgressSimulator(
      buildId, 5, 25, 15000, 'research', 'Analyzing market data'
    );

    const phase1 = await orchestrator.executePhase1ResearchUltra(projectData);
    
    if (researchSimulator) clearInterval(researchSimulator);
    
    const competitorsAnalyzed = phase1.competitors?.total_analyzed || 0;
    const reviewsScanned = phase1.reviews?.totalReviewsAnalyzed || 0;
    
    updateBuildProgress(buildId, {
      phase: 'research',
      progress: 30,
      message: `✅ Research complete! Analyzed ${competitorsAnalyzed} competitors, ${reviewsScanned} reviews`,
      stats: {
        competitorsAnalyzed,
        reviewsScanned
      }
    });

    console.log(`✅ Phase 1 Complete:`);
    console.log(`   - Competitors: ${competitorsAnalyzed}`);
    console.log(`   - Reviews: ${reviewsScanned}`);
    console.log(`   - Market Level: ${phase1.market?.competition_level || 'unknown'}`);

    await new Promise(resolve => setTimeout(resolve, 2000));

    // ==========================================
    // PHASE 2: STRATEGIC PLANNING (30-50%)
    // ==========================================
    console.log('\n🎯 PHASE 2: Strategic Planning');
    console.log('─'.repeat(60));
    
    updateBuildProgress(buildId, {
      phase: 'strategy',
      progress: 32,
      message: '🧠 Analyzing competitive advantages...'
    });

    const strategySimulator = createProgressSimulator(
      buildId, 32, 48, 10000, 'strategy', 'Building strategy'
    );

    const phase2 = await orchestrator.executePhase2PlanningUltra(phase1);
    
    if (strategySimulator) clearInterval(strategySimulator);
    
    const advantages = phase2.competitive_advantages?.length || 0;
    
    updateBuildProgress(buildId, {
      phase: 'strategy',
      progress: 50,
      message: `✅ Strategy ready with ${advantages} competitive advantages`
    });

    console.log(`✅ Phase 2 Complete:`);
    console.log(`   - Advantages: ${advantages}`);
    console.log(`   - Features: ${phase2.features_prioritized?.length || 0}`);

    await new Promise(resolve => setTimeout(resolve, 2000));

    // ==========================================
    // PHASE 3: CODE GENERATION (50-85%)
    // ==========================================
    console.log('\n💻 PHASE 3: Code Generation WITH LIVE PREVIEW');
    console.log('─'.repeat(60));
    
    updateBuildProgress(buildId, {
      phase: 'code',
      progress: 52,
      message: '🗄️ Designing database schema...'
    });

    const dbSimulator = createProgressSimulator(
      buildId, 52, 58, 8000, 'code', 'Creating database schema'
    );

    const phase3 = await orchestrator.executePhase3CodeGenerationUltra(phase2, projectData);
    
    if (dbSimulator) clearInterval(dbSimulator);

    // Frontend generated - LIVE PREVIEW AVAILABLE
    updateBuildProgress(buildId, {
      phase: 'code',
      progress: 60,
      message: '⚛️ Frontend generated - Live preview available!',
      stats: {
        filesGenerated: phase3.frontend?.stats?.total_files || 0,
        linesOfCode: phase3.frontend?.stats?.total_lines || 0,
        componentsCreated: phase3.frontend?.stats?.components || 0
      },
      files: phase3.frontend?.files || {}
    });

    console.log(`✅ Frontend Generated:`);
    console.log(`   - Files: ${phase3.frontend?.stats?.total_files || 0}`);
    console.log(`   - Components: ${phase3.frontend?.stats?.components || 0}`);
    console.log(`   - Lines: ${phase3.frontend?.stats?.total_lines || 0}`);

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Backend generated
    updateBuildProgress(buildId, {
      phase: 'code',
      progress: 70,
      message: '⚙️ Backend API generated',
      stats: {
        filesGenerated: (phase3.frontend?.stats?.total_files || 0) + (phase3.backend?.stats?.total_files || 0),
        linesOfCode: (phase3.frontend?.stats?.total_lines || 0) + (phase3.backend?.stats?.total_lines || 0),
        apisGenerated: phase3.backend?.stats?.api_endpoints || 0
      },
      files: phase3.backend?.files || {}
    });

    console.log(`✅ Backend Generated:`);
    console.log(`   - Files: ${phase3.backend?.stats?.total_files || 0}`);
    console.log(`   - API Endpoints: ${phase3.backend?.stats?.api_endpoints || 0}`);
    console.log(`   - Lines: ${phase3.backend?.stats?.total_lines || 0}`);

    await new Promise(resolve => setTimeout(resolve, 2000));

    const filesGenerated = (phase3.frontend?.stats?.total_files || 0) + 
                          (phase3.backend?.stats?.total_files || 0) +
                          (phase3.database?.migrations?.length || 0);
    const linesOfCode = (phase3.frontend?.stats?.total_lines || 0) + 
                       (phase3.backend?.stats?.total_lines || 0);

    updateBuildProgress(buildId, {
      phase: 'code',
      progress: 85,
      message: `✅ Generated ${filesGenerated} files (${linesOfCode.toLocaleString()} lines)`,
      stats: {
        filesGenerated,
        linesOfCode
      }
    });

    console.log(`✅ Phase 3 Complete:`);
    console.log(`   - Total Files: ${filesGenerated}`);
    console.log(`   - Total Lines: ${linesOfCode.toLocaleString()}`);

    await new Promise(resolve => setTimeout(resolve, 2000));

    // ==========================================
    // PHASE 4: QUALITY ASSURANCE (85-95%)
    // ==========================================
    console.log('\n🧪 PHASE 4: Quality Assurance');
    console.log('─'.repeat(60));
    
    updateBuildProgress(buildId, {
      phase: 'testing',
      progress: 87,
      message: '🧪 Running quality checks...'
    });

    const qaSimulator = createProgressSimulator(
      buildId, 87, 93, 8000, 'testing', 'Testing code quality'
    );

    const phase4 = await orchestrator.executePhase4QualityUltra(phase3);
    
    if (qaSimulator) clearInterval(qaSimulator);
    
    updateBuildProgress(buildId, {
      phase: 'testing',
      progress: 95,
      message: `✅ QA complete - Score: ${phase4.qa_results?.overall_score || 0}/100`,
      stats: {
        testsWritten: phase4.qa_results?.tests_created || 0
      }
    });

    console.log(`✅ Phase 4 Complete:`);
    console.log(`   - QA Score: ${phase4.qa_results?.overall_score || 0}/100`);
    console.log(`   - Tests: ${phase4.qa_results?.tests_created || 0}`);
    console.log(`   - Deployment Ready: ${phase4.deployment_ready ? 'YES' : 'NO'}`);

    await new Promise(resolve => setTimeout(resolve, 2000));

    // ==========================================
    // PHASE 5: PACKAGING (95-100%)
    // ==========================================
    console.log('\n📦 PHASE 5: Creating Download Package');
    console.log('─'.repeat(60));
    
    updateBuildProgress(buildId, {
      phase: 'packaging',
      progress: 96,
      message: '📦 Creating download package...'
    });

    const packageSimulator = createProgressSimulator(
      buildId, 96, 99, 5000, 'packaging', 'Packaging files'
    );

    const zipPath = await createDownloadPackage(buildId, projectData.projectName, {
      phase1, phase2, phase3, phase4
    });

    if (packageSimulator) clearInterval(packageSimulator);
    
    console.log('✅ ZIP created:', zipPath);

    const totalTime = Math.round((Date.now() - startTime) / 1000);

    // ==========================================
    // BUILD COMPLETE
    // ==========================================

    // CRITICAL FIX: Merge all files properly
    const allFiles = mergeFiles(
      phase3.frontend?.files,
      phase3.backend?.files
    );
    
    const fileCounts = extractFileCounts(phase3);
    const totalSize = calculateTotalSize(phase3);


    const finalResults = {
      success: true,
      build_id: buildId,
      project_id: projectData.projectId,
      project_name: projectData.projectName,
      phases: {
        phase1: {
          competitors_analyzed: competitorsAnalyzed,
          reviews_scanned: reviewsScanned,
          market_level: phase1.market?.competition_level
        },
        phase2: {
          competitive_advantages: advantages,
          features_prioritized: phase2.features_prioritized?.length || 0
        },
        phase3: {
          files_generated: filesGenerated,
          lines_of_code: linesOfCode,
          components: phase3.frontend?.stats?.components || 0,
          api_endpoints: phase3.backend?.stats?.api_endpoints || 0
        },
        phase4: {
          qa_score: phase4.qa_results?.overall_score || 0,
          tests_created: phase4.qa_results?.tests_created || 0,
          deployment_ready: phase4.deployment_ready || false
        }
      },
      summary: {
        files_generated: filesGenerated,
        lines_of_code: linesOfCode,
        competitors_analyzed: competitorsAnalyzed,
        reviews_scanned: reviewsScanned,
        components_created: phase3.frontend?.stats?.components || 0,
        apis_generated: phase3.backend?.stats?.api_endpoints || 0,
        tests_written: phase4.qa_results?.tests_created || 0,
        qa_score: phase4.qa_results?.overall_score || 0,
        deployment_ready: phase4.deployment_ready || false,
        competitive_advantages: advantages,
        time_taken: totalTime,
        tier: tier
      },
      download_url: `/api/master/download/${buildId}`,
      live_preview_url: `/api/preview/${buildId}/files`,
      tier,
      timestamp: new Date().toISOString()
    };


    // Send completion notification
    await NotificationService.create(projectData.userId, {
      title: 'Build Complete! 🎉',
      message: `"${projectData.projectName}" is ready! ${filesGenerated} files, ${linesOfCode.toLocaleString()} lines of code.`,
      type: 'success',
      actionUrl: `/projects/${projectData.projectId}`,
      actionText: 'Download Now'
    });

    // Update project in database with COMPLETE data
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
        buildData: finalResults,
        researchData: phase1,
        competitorData: phase2,
        generatedFiles: allFiles,
        fileStats: {
          frontend_files: fileCounts.frontend,
          backend_files: fileCounts.backend,
          database_migrations: fileCounts.database,
          total_files: fileCounts.frontend + fileCounts.backend + fileCounts.database,
          total_size: totalSize
        },
        lastFileUpdate: new Date()
      });
      console.log('✅ Project database updated with complete data');
    }


     // Update build to completed state
    updateBuildProgress(buildId, {
      status: 'completed',
      phase: 'done',
      progress: 100,
      message: '🎉 Build complete! Your app is ready to download.',
      stats: {
        filesGenerated,
        linesOfCode,
        competitorsAnalyzed,
        reviewsScanned,
        componentsCreated: phase3.frontend?.stats?.components || 0,
        apisGenerated: phase3.backend?.stats?.api_endpoints || 0,
        testsWritten: phase4.qa_results?.tests_created || 0
      },
      files: allFiles
    });

    const buildData = activeBuilds.get(buildId);
    if (buildData) {
      buildData.results = finalResults;
      buildData.zip_path = zipPath;
      buildData.completed_at = new Date().toISOString();
      activeBuilds.set(buildId, buildData);
    }

    console.log('\n✅ BUILD COMPLETED SUCCESSFULLY!');
    console.log('═'.repeat(60));
    console.log(`Files: ${filesGenerated}`);
    console.log(`Lines: ${linesOfCode.toLocaleString()}`);
    console.log(`Time: ${totalTime}s (${Math.floor(totalTime / 60)}m ${totalTime % 60}s)`);
    console.log(`QA Score: ${phase4.qa_results?.overall_score || 0}/100`);
    console.log(`Deployment Ready: ${phase4.deployment_ready ? '✅' : '❌'}`);
    console.log('═'.repeat(60));

  } catch (error) {
    console.error('\n❌ BUILD FAILED');
    console.error('═'.repeat(60));
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('═'.repeat(60));
    
    updateBuildProgress(buildId, {
      status: 'failed',
      phase: 'error',
      progress: 0,
      message: `Build failed: ${error.message}`,
      error: error.message
    });

    const buildData = activeBuilds.get(buildId);
    if (buildData) {
      buildData.failed_at = new Date().toISOString();
      buildData.error_stack = process.env.NODE_ENV === 'development' ? error.stack : undefined;
      activeBuilds.set(buildId, buildData);
    }

    // Update project status
    if (projectData.projectId) {
      await ProjectService.update(projectData.projectId, {
        status: 'failed',
        buildProgress: 0,
        buildData: { 
          error: error.message,
          failed_at: new Date().toISOString()
        }
      }).catch(err => console.error('Failed to update project status:', err));
    }

    // Send failure notification
    await NotificationService.create(projectData.userId, {
      title: 'Build Failed ❌',
      message: `Build for "${projectData.projectName}" failed. You can retry from your dashboard.`,
      type: 'error',
      actionUrl: `/projects/${projectData.projectId}`,
      actionText: 'Retry Build'
    }).catch(err => console.error('Failed to create notification:', err));
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

  console.log('📦 Creating ZIP package:', fileName);

  return new Promise((resolve, reject) => {
    const output = fsSync.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    let totalFiles = 0;

    output.on('close', () => {
      console.log(`✅ ZIP created successfully:`);
      console.log(`   - Size: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   - Files: ${totalFiles}`);
      resolve(zipPath);
    });

    archive.on('error', (err) => {
      console.error('❌ ZIP creation failed:', err);
      reject(err);
    });

    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn('⚠️ ZIP warning:', err);
      } else {
        reject(err);
      }
    });

    archive.pipe(output);

    try {
      if (!results.phase3) {
        throw new Error('Missing phase3 results - no code generated');
      }

      // ==========================================
      // EXTRACT FILES FIRST
      // ==========================================
      const frontendFiles = results.phase3.frontend?.files || {};
      const backendFiles = results.phase3.backend?.files || {};

      // ==========================================
      // NOW VALIDATE (after extraction)
      // ==========================================
      const cleanedFrontendFiles = {};
      let skippedFiles = 0;

      Object.entries(frontendFiles).forEach(([filepath, content]) => {
        // Skip if contaminated
        if (content.includes('│') || content.includes('▁') || content.includes('<|')) {
          console.error(`🚫 Skipping contaminated file: ${filepath}`);
          skippedFiles++;
          return;
        }
        
        // Clean the content
        let cleaned = content
          .replace(/```[\w]*\n?/g, '')
          .replace(/```\s*$/g, '')
          .replace(/<\|.*?\|>/g, '')
          .replace(/\|begin_of_sentence\|/gi, '')
          .replace(/\|end_of_turn\|/gi, '')
          .trim();
        
        cleanedFrontendFiles[filepath] = cleaned;
      });

      console.log(`✅ Validated: ${Object.keys(cleanedFrontendFiles).length} clean files`);
      if (skippedFiles > 0) {
        console.warn(`⚠️ Skipped: ${skippedFiles} contaminated files`);
      }

      // ==========================================
      // FRONTEND FILES
      // ==========================================
      if (Object.keys(cleanedFrontendFiles).length > 0) {
        Object.entries(cleanedFrontendFiles).forEach(([filepath, content]) => {
          archive.append(content, { name: `frontend/${filepath}` });
          totalFiles++;
        });
        console.log(`✅ Added ${Object.keys(cleanedFrontendFiles).length} frontend files`);
      }

      // ==========================================
      // BACKEND FILES
      // ==========================================
      if (Object.keys(backendFiles).length > 0) {
        Object.entries(backendFiles).forEach(([filepath, content]) => {
          // Clean backend files too
          let cleaned = content
            .replace(/```[\w]*\n?/g, '')
            .replace(/```\s*$/g, '')
            .replace(/<\|.*?\|>/g, '')
            .trim();
          
          archive.append(cleaned, { name: `backend/${filepath}` });
          totalFiles++;
        });
        console.log(`✅ Added ${Object.keys(backendFiles).length} backend files`);
      }

      // ==========================================
      // DATABASE FILES
      // ==========================================
      if (results.phase3.database) {
        // Migrations
        if (Array.isArray(results.phase3.database.migrations)) {
          results.phase3.database.migrations.forEach((migration, i) => {
            const sql = typeof migration === 'string' ? migration : migration.sql || '';
            const name = migration.name || `${String(i + 1).padStart(3, '0')}_migration.sql`;
            
            if (sql) {
              archive.append(sql, { name: `database/migrations/${name}` });
              totalFiles++;
            }
          });
          console.log(`✅ Added ${results.phase3.database.migrations.length} database migrations`);
        }

        // Prisma schema
        if (results.phase3.database.prisma_schema) {
          archive.append(results.phase3.database.prisma_schema, { 
            name: 'backend/prisma/schema.prisma' 
          });
          totalFiles++;
          console.log('✅ Added Prisma schema');
        }

        // Seeds
        if (results.phase3.database.seeds) {
          archive.append(results.phase3.database.seeds, {
            name: 'backend/prisma/seed.js'
          });
          totalFiles++;
          console.log('✅ Added database seeds');
        }
      }

      // ==========================================
      // DOCUMENTATION
      // ==========================================
      archive.append(generateREADME(results), { name: 'README.md' });
      archive.append(generateResearchReport(results.phase1), { name: 'RESEARCH_REPORT.md' });
      archive.append(generateDeploymentGuide(results), { name: 'DEPLOYMENT_GUIDE.md' });
      archive.append(generateArchitectureDoc(results), { name: 'ARCHITECTURE.md' });
      archive.append(generateAPIDoc(results), { name: 'API_DOCUMENTATION.md' });
      archive.append(generateEnvExample(results), { name: '.env.example' });
      totalFiles += 6;
      console.log('✅ Added documentation files');

      // ==========================================
      // CONFIGURATION FILES
      // ==========================================
      archive.append(generateGitignore(), { name: '.gitignore' });
      archive.append(generateDockerfile(), { name: 'Dockerfile' });
      archive.append(generateDockerCompose(), { name: 'docker-compose.yml' });
      totalFiles += 3;
      console.log('✅ Added configuration files');

      archive.finalize();

    } catch (error) {
      console.error('❌ Error creating ZIP package:', error);
      reject(error);
    }
  });
}

// ==========================================
// DOCUMENTATION GENERATORS
// ==========================================

function generateREADME(results) {
  const stats = results.phase3 || {};
  const phase2 = results.phase2 || {};
  
  return `# ${phase2.project_name || 'My Application'}

**Built with Launch AI ULTRA** 🚀  
Generated: ${new Date().toISOString()}

## 📊 Build Statistics

- **Frontend Files**: ${stats.frontend?.stats?.total_files || 0}
- **Backend Files**: ${stats.backend?.stats?.total_files || 0}
- **Total Lines of Code**: ${(stats.frontend?.stats?.total_lines || 0) + (stats.backend?.stats?.total_lines || 0)}
- **Components**: ${stats.frontend?.stats?.components || 0}
- **API Endpoints**: ${stats.backend?.stats?.api_endpoints || 0}
- **Database Tables**: ${stats.database?.stats?.total_tables || 0}
- **QA Score**: ${results.phase4?.qa_results?.overall_score || 0}/100
- **Deployment Ready**: ${results.phase4?.deployment_ready ? '✅ YES' : '⚠️ Review needed'}

## 🎯 Competitive Advantages

${phase2.competitive_advantages?.slice(0, 5).map((adv, i) => `${i + 1}. **${adv.feature}** - ${adv.implementation || adv.source}`).join('\n') || 'Based on comprehensive market research'}

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm/yarn
- PostgreSQL database
- Git

### 1. Frontend Setup

\`\`\`bash
cd frontend
npm install
npm start
\`\`\`

The frontend will run on **http://localhost:3000**

### 2. Backend Setup

\`\`\`bash
cd backend
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your database credentials

# Run database migrations
npx prisma db push

# Start the server
npm run dev
\`\`\`

The backend will run on **http://localhost:5000**

## 📦 Project Structure

\`\`\`
project/
├── frontend/              React application
│   ├── src/
│   │   ├── components/   Reusable UI components
│   │   ├── pages/        Application pages
│   │   ├── services/     API integration
│   │   ├── utils/        Helper functions
│   │   ├── App.js        Main app component
│   │   └── index.js      Entry point
│   ├── public/           Static assets
│   └── package.json
│
├── backend/              Node.js + Express API
│   ├── routes/           API routes
│   ├── controllers/      Business logic
│   ├── middleware/       Auth, validation, etc.
│   ├── services/         External services
│   ├── prisma/
│   │   └── schema.prisma Database schema
│   ├── server.js         Server entry point
│   └── package.json
│
├── database/
│   └── migrations/       SQL migrations
│
├── RESEARCH_REPORT.md    Market research analysis
├── DEPLOYMENT_GUIDE.md   Deployment instructions
├── ARCHITECTURE.md       System architecture
└── README.md            This file
\`\`\`

## 🌍 Environment Variables

### Frontend (.env)
\`\`\`
REACT_APP_API_URL=http://localhost:5000
REACT_APP_ENV=development
\`\`\`

### Backend (.env)
\`\`\`
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
JWT_SECRET=your-secret-key-here
PORT=5000
NODE_ENV=development
\`\`\`

See \`.env.example\` for complete list.

## 🧪 Testing

\`\`\`bash
# Frontend tests
cd frontend
npm test

# Backend tests
cd backend
npm test
\`\`\`

## 🚢 Deployment

See **DEPLOYMENT_GUIDE.md** for detailed deployment instructions.

### Quick Deploy Options:

- **Frontend**: Vercel (Free) - \`vercel --prod\`
- **Backend**: Railway ($5/mo) - \`railway up\`
- **Database**: Railway PostgreSQL (Free tier available)

## 📖 Documentation

- **RESEARCH_REPORT.md** - Market analysis and competitor research
- **DEPLOYMENT_GUIDE.md** - Step-by-step deployment guide
- **ARCHITECTURE.md** - System design and architecture
- **API_DOCUMENTATION.md** - Complete API reference

## 🛠️ Built With

- **Frontend**: React, TailwindCSS, Axios
- **Backend**: Node.js, Express, Prisma
- **Database**: PostgreSQL
- **Authentication**: JWT
- **Validation**: Express-validator
- **Security**: Helmet, CORS, Rate limiting

## 📝 License

This project was generated by Launch AI ULTRA. All rights reserved to the project owner.

## 🆘 Support

For issues or questions about the generated code:
1. Check the documentation files in this package
2. Review the ARCHITECTURE.md for system design
3. See API_DOCUMENTATION.md for API usage

---

**Generated by Launch AI ULTRA Platform**  
Advanced AI-powered application generation with market research, competitor analysis, and production-ready code.

Visit: https://launch-ai.com
`;
}

function generateResearchReport(research) {
  if (!research) {
    return '# Market Research Report\n\nNo research data available.';
  }

  return `# 📊 Market Research Report

Generated: ${new Date().toISOString()}

## Executive Summary

- **Competitors Analyzed**: ${research.competitors?.total_analyzed || 0}
- **Reviews Analyzed**: ${research.reviews?.totalReviewsAnalyzed || 0}
- **Market Size**: ${research.market?.market_overview?.size || 'Unknown'}
- **Competition Level**: ${research.market?.competition_level || 'Unknown'}
- **Market Maturity**: ${research.market?.market_overview?.maturity || 'Unknown'}

## Market Overview

${research.market?.market_overview?.description || 'Market analysis based on comprehensive research.'}

### Market Gaps Identified

${research.market?.market_gaps?.map((gap, i) => `${i + 1}. **${gap.gap || gap}**\n   - Evidence: ${gap.evidence || 'Market analysis'}\n   - Opportunity: ${gap.opportunity || 'Untapped potential'}`).join('\n\n') || 'No specific gaps identified'}

## Competitive Analysis

### Competitors Analyzed

${research.competitors?.individual_analyses?.map((comp, i) => `#### ${i + 1}. ${comp.name}
- **URL**: ${comp.url}
- **Strengths**: ${comp.strengths?.join(', ') || 'N/A'}
- **Weaknesses**: ${comp.weaknesses?.join(', ') || 'N/A'}
- **Key Features**: ${comp.key_features?.join(', ') || 'N/A'}
`).join('\n') || 'Limited competitor data'}

### Market Positioning

- **Leaders**: ${research.competitors?.positioning?.leaders?.join(', ') || 'N/A'}
- **Challengers**: ${research.competitors?.positioning?.challengers?.join(', ') || 'N/A'}
- **Niche Players**: ${research.competitors?.positioning?.niche_players?.join(', ') || 'N/A'}

## User Sentiment Analysis

${research.reviews ? `
### Reviews Summary

- **Total Reviews Analyzed**: ${research.reviews.totalReviewsAnalyzed || 0}
- **Average Sentiment**: ${research.reviews.overallSentiment || 'N/A'}

### Key Pain Points

${research.reviews.commonPainPoints?.map((pain, i) => `${i + 1}. ${pain}`).join('\n') || 'No pain points identified'}

### User Desires

${research.reviews.userDesires?.map((desire, i) => `${i + 1}. ${desire}`).join('\n') || 'No specific desires identified'}
` : 'Review analysis not available for this tier'}

## Trends Analysis

${research.trends?.emerging_trends?.map((trend, i) => `### ${i + 1}. ${trend.trend}
- **Relevance**: ${trend.relevance_to_project}
- **Priority**: ${trend.priority}
- **Impact**: ${trend.impact || 'Significant'}
`).join('\n') || 'Trend data not available'}

## Strategic Recommendations

Based on the comprehensive research:

1. **Primary Opportunity**: ${research.starvingMarket?.is_starving_market ? 'Starving market detected - high opportunity' : 'Competitive market - differentiation required'}

2. **Uniqueness Score**: ${research.uniqueness?.uniqueness_score || 50}/100

3. **Market Entry Strategy**: ${research.market?.competition_level === 'low' ? 'Fast market entry recommended' : 'Strategic positioning required'}

4. **Key Differentiators**: Focus on identified market gaps and user pain points

## Data Sources

- Search results analyzed: ${research.market?._meta?.data_sources?.length || 0}
- Competitors scraped: ${research.competitors?._meta?.scraped_successfully || 0}
- Reviews collected: ${research.reviews?.totalReviewsAnalyzed || 0}

---

**Report compiled by Launch AI ULTRA Research Agents**  
This report is based on real-time market data and competitive intelligence.
`;
}

function generateDeploymentGuide(results) {
  return `# 🚀 Deployment Guide

Complete guide to deploying your application to production.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Frontend Deployment](#frontend-deployment)
3. [Backend Deployment](#backend-deployment)
4. [Database Setup](#database-setup)
5. [Environment Configuration](#environment-configuration)
6. [Domain & SSL](#domain--ssl)
7. [Monitoring](#monitoring)

## Prerequisites

- Git repository (GitHub/GitLab)
- Domain name (optional but recommended)
- Payment method for paid services

## Frontend Deployment

### Option 1: Vercel (Recommended - Free Tier)

\`\`\`bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy frontend
cd frontend
vercel --prod
\`\`\`

**Environment Variables in Vercel:**
- Go to Project Settings → Environment Variables
- Add: \`REACT_APP_API_URL\` = Your backend URL

### Option 2: Netlify

\`\`\`bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
cd frontend
netlify deploy --prod
\`\`\`

### Option 3: AWS S3 + CloudFront

\`\`\`bash
# Build
npm run build

# Upload to S3
aws s3 sync build/ s3://your-bucket-name

# Configure CloudFront for CDN
\`\`\`

## Backend Deployment

### Option 1: Railway (Recommended - $5/month)

\`\`\`bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
cd backend
railway init

# Add PostgreSQL database
railway add --database postgres

# Deploy
railway up
\`\`\`

**Environment Variables:**
Set in Railway dashboard:
- \`DATABASE_URL\` (auto-configured)
- \`JWT_SECRET\`
- \`NODE_ENV=production\`
- \`PORT=5000\`

### Option 2: Render.com (Free Tier Available)

1. Connect your GitHub repository
2. Create a new Web Service
3. Set build command: \`npm install\`
4. Set start command: \`node server.js\`
5. Add environment variables in dashboard

### Option 3: DigitalOcean App Platform

\`\`\`bash
# Deploy via GitHub integration
# Or use doctl CLI
doctl apps create --spec app.yaml
\`\`\`

## Database Setup

### Railway PostgreSQL (Easiest)

1. Add PostgreSQL in Railway dashboard
2. Copy DATABASE_URL
3. Run migrations:

\`\`\`bash
npx prisma db push
\`\`\`

### AWS RDS PostgreSQL

1. Create RDS instance (PostgreSQL 14+)
2. Configure security groups
3. Get connection string
4. Update DATABASE_URL

### Supabase (Free Tier)

1. Create project at supabase.com
2. Get connection string
3. Update DATABASE_URL

## Environment Configuration

### Frontend (.env.production)

\`\`\`
REACT_APP_API_URL=https://your-backend.railway.app
REACT_APP_ENV=production
\`\`\`

### Backend (.env)

\`\`\`
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=generate-secure-secret-key-here
PORT=5000
NODE_ENV=production
CORS_ORIGIN=https://your-frontend.vercel.app
\`\`\`

## Domain & SSL

### Custom Domain

**Frontend (Vercel):**
1. Go to Project Settings → Domains
2. Add your domain
3. Update DNS records as instructed

**Backend (Railway):**
1. Go to Service Settings → Domains
2. Add custom domain
3. Update DNS CNAME record

### SSL Certificates

Both Vercel and Railway provide automatic SSL certificates via Let's Encrypt.

## Post-Deployment Checklist

- [ ] Frontend accessible via HTTPS
- [ ] Backend accessible via HTTPS
- [ ] Database migrations completed
- [ ] Environment variables set correctly
- [ ] CORS configured properly
- [ ] API endpoints responding
- [ ] Authentication working
- [ ] SSL certificates active
- [ ] Custom domain configured (optional)
- [ ] Monitoring setup

## Monitoring & Logging

### Railway Logs

\`\`\`bash
railway logs
\`\`\`

### Vercel Logs

Check in Vercel dashboard → Deployments → Function Logs

### Set up Monitoring

1. **UptimeRobot** (Free)
   - Monitor uptime
   - Alert on downtime

2. **Sentry** (Error Tracking)
   \`\`\`bash
   npm install @sentry/react @sentry/node
   \`\`\`

3. **LogRocket** (Session Replay)
   - Track user sessions
   - Debug issues

## Scaling

### Horizontal Scaling

**Railway:**
- Upgrade plan for more resources
- Enable auto-scaling

**Database:**
- Enable connection pooling
- Use read replicas

### Performance Optimization

- Enable CDN (CloudFront/Cloudflare)
- Use Redis for caching
- Optimize database queries
- Compress assets

## Backup Strategy

### Database Backups

**Railway:**
- Automatic daily backups (paid plans)

**Manual Backup:**
\`\`\`bash
pg_dump $DATABASE_URL > backup.sql
\`\`\`

### Code Backups

- Use Git version control
- Tag releases: \`git tag -a v1.0.0 -m "Release 1.0.0"\`

## Troubleshooting

### Common Issues

**CORS Errors:**
- Update CORS_ORIGIN in backend
- Check frontend API URL

**Database Connection:**
- Verify DATABASE_URL format
- Check IP whitelist

**Build Failures:**
- Check build logs
- Verify Node.js version
- Check dependencies

**SSL Issues:**
- Wait 24-48 hours for DNS propagation
- Clear browser cache

## Cost Estimation

### Free Tier Setup:
- Frontend: Vercel (Free)
- Backend: Render (Free with limitations)
- Database: Supabase (Free 500MB)
- **Total: $0/month**

### Recommended Production Setup:
- Frontend: Vercel (Free)
- Backend: Railway ($5/month)
- Database: Railway PostgreSQL (Included)
- Domain: Namecheap ($10/year)
- **Total: ~$5/month + domain**

### Enterprise Setup:
- Frontend: Vercel Pro ($20/month)
- Backend: AWS ECS (Variable)
- Database: AWS RDS ($20+/month)
- CDN: CloudFront (Variable)
- **Total: $50+/month**

## Support Resources

- Railway Docs: https://docs.railway.app
- Vercel Docs: https://vercel.com/docs
- Prisma Docs: https://www.prisma.io/docs

---

**Deployment Guide Generated by Launch AI ULTRA**  
Last Updated: ${new Date().toISOString()}
`;
}

function generateArchitectureDoc(results) {
  return `# 🏗️ System Architecture

## Overview

This document describes the architecture of your application generated by Launch AI ULTRA.

## System Diagram

\`\`\`
┌─────────────────┐
│                 │
│   Web Browser   │
│                 │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│                 │
│  Frontend (React│
│  + TailwindCSS) │
│                 │
└────────┬────────┘
         │ REST API
         ▼
┌─────────────────┐
│                 │
│  Backend (Node  │
│  + Express)     │
│                 │
└────────┬────────┘
         │ Prisma ORM
         ▼
┌─────────────────┐
│                 │
│  PostgreSQL DB  │
│                 │
└─────────────────┘
\`\`\`

## Technology Stack

### Frontend
- **Framework**: React ${results.phase3?.frontend?.react_version || '18.2.0'}
- **Styling**: TailwindCSS
- **State Management**: React Hooks
- **HTTP Client**: Axios
- **Routing**: React Router
- **Icons**: Lucide React

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **ORM**: Prisma
- **Authentication**: JWT
- **Validation**: Express-validator
- **Security**: Helmet, CORS, Rate limiting

### Database
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Migrations**: Prisma Migrate
- **Tables**: ${results.phase3?.database?.stats?.total_tables || 'Multiple'}

## Component Architecture

### Frontend Components

\`\`\`
src/
├── components/
│   ├── layout/          Layout components
│   ├── common/          Reusable UI components
│   ├── features/        Feature-specific components
│   └── forms/           Form components
├── pages/               Page components
├── services/            API integration
├── utils/               Helper functions
├── hooks/               Custom React hooks
└── contexts/            React contexts
\`\`\`

### Backend Structure

\`\`\`
backend/
├── routes/              API route definitions
├── controllers/         Business logic
├── middleware/          Express middleware
│   ├── auth.js         Authentication
│   ├── validation.js   Request validation
│   └── errorHandler.js Error handling
├── services/            External services
├── prisma/
│   └── schema.prisma   Database schema
└── utils/              Helper functions
\`\`\`

## API Architecture

### RESTful Endpoints

**Authentication:**
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me

**Resources:**
- GET /api/resource
- GET /api/resource/:id
- POST /api/resource
- PUT /api/resource/:id
- DELETE /api/resource/:id

See API_DOCUMENTATION.md for complete API reference.

## Database Schema

### Key Tables

${results.phase3?.database?.schema_summary || 'Database schema designed based on requirements'}

### Relationships

- Foreign keys ensure referential integrity
- Indexes optimize query performance
- Cascading deletes maintain data consistency

## Security Architecture

### Authentication Flow

1. User submits credentials
2. Backend validates and generates JWT
3. Frontend stores JWT (httpOnly cookie recommended)
4. JWT included in subsequent requests
5. Backend validates JWT on protected routes

### Security Features

- **Password Hashing**: bcrypt with salt rounds
- **JWT Tokens**: Signed with secret key
- **CORS**: Configured for specific origins
- **Rate Limiting**: Prevents brute force attacks
- **Helmet**: Security headers
- **Input Validation**: Request validation middleware
- **SQL Injection Prevention**: Prisma ORM parameterized queries

## Deployment Architecture

### Production Setup

\`\`\`
┌─────────────────┐
│   CloudFlare    │  CDN + DDoS Protection
└────────┬────────┘
         │
┌────────▼────────┐
│     Vercel      │  Frontend Hosting
└────────┬────────┘
         │
┌────────▼────────┐
│    Railway      │  Backend Hosting
└────────┬────────┘
         │
┌────────▼────────┐
│   PostgreSQL    │  Database
└─────────────────┘
\`\`\`

## Performance Optimization

### Frontend Optimization
- Code splitting
- Lazy loading
- Image optimization
- Bundle size optimization
- Caching strategies

### Backend Optimization
- Database query optimization
- Connection pooling
- Response compression
- Caching (Redis recommended)

### Database Optimization
- Proper indexing
- Query optimization
- Connection pooling
- Read replicas (for scale)

## Scalability Considerations

### Horizontal Scaling
- Stateless backend design
- Load balancer ready
- Session storage (Redis/DB)

### Vertical Scaling
- Resource allocation
- Database optimization
- Caching strategies

## Monitoring & Logging

### Application Monitoring
- Error tracking (Sentry)
- Performance monitoring
- User analytics

### Infrastructure Monitoring
- Server metrics
- Database performance
- API response times

## Data Flow

### User Registration Flow
\`\`\`
User → Frontend → POST /api/auth/register → Backend
  → Validate Input → Hash Password → Store in DB
  → Generate JWT → Return Token → Frontend stores token
\`\`\`

### Authenticated Request Flow
\`\`\`
User → Frontend → Request + JWT → Backend
  → Verify JWT → Check Permissions → Execute Logic
  → Query Database → Format Response → Return Data → Frontend displays
\`\`\`

## Error Handling

### Frontend Error Handling
- Try-catch blocks for async operations
- User-friendly error messages
- Error boundary components
- Retry mechanisms

### Backend Error Handling
- Centralized error handler middleware
- Structured error responses
- Error logging
- Graceful degradation

## Testing Strategy

### Frontend Testing
- Unit tests (Jest)
- Component tests (React Testing Library)
- E2E tests (Cypress recommended)

### Backend Testing
- Unit tests (Jest)
- Integration tests
- API endpoint tests
- Database tests

## Backup & Recovery

### Database Backups
- Automated daily backups
- Point-in-time recovery
- Backup retention policy

### Application Backups
- Git version control
- Tagged releases
- Configuration backups

---

**Architecture Documentation Generated by Launch AI ULTRA**  
Last Updated: ${new Date().toISOString()}
`;
}

function generateAPIDoc(results) {
  return `# 📚 API Documentation

Complete API reference for your application.

## Base URL

\`\`\`
Development: http://localhost:5000/api
Production: https://your-backend.railway.app/api
\`\`\`

## Authentication

All authenticated endpoints require a JWT token in the Authorization header:

\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

## Response Format

### Success Response
\`\`\`json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
\`\`\`

### Error Response
\`\`\`json
{
  "success": false,
  "error": "Error message",
  "details": { ... }
}
\`\`\`

## Endpoints

### Authentication

#### Register User
\`\`\`http
POST /api/auth/register
\`\`\`

**Request Body:**
\`\`\`json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "token": "jwt-token-here",
  "user": {
    "id": "user-id",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
\`\`\`

#### Login
\`\`\`http
POST /api/auth/login
\`\`\`

**Request Body:**
\`\`\`json
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "token": "jwt-token-here",
  "user": { ... }
}
\`\`\`

#### Get Current User
\`\`\`http
GET /api/auth/me
\`\`\`

**Headers:** Authorization required

**Response:**
\`\`\`json
{
  "success": true,
  "user": {
    "id": "user-id",
    "name": "John Doe",
    "email": "john@example.com",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
\`\`\`

${results.phase3?.backend?.stats?.api_endpoints ? `
### Generated API Endpoints

This application includes **${results.phase3.backend.stats.api_endpoints} API endpoints** generated based on your requirements.

Refer to the backend code for complete endpoint implementations.
` : ''}

## Rate Limiting

API is rate limited to prevent abuse:
- **Limit**: 100 requests per 15 minutes per IP
- **Headers**: Rate limit info in response headers

## Error Codes

| Code | Description |
|------|-------------|
| 200  | Success |
| 201  | Created |
| 400  | Bad Request |
| 401  | Unauthorized |
| 403  | Forbidden |
| 404  | Not Found |
| 429  | Too Many Requests |
| 500  | Internal Server Error |

## Examples

### JavaScript (Axios)

\`\`\`javascript
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

// Login
const login = async (email, password) => {
  try {
    const response = await axios.post(\`\${API_BASE_URL}/auth/login\`, {
      email,
      password
    });
    
    // Store token
    localStorage.setItem('token', response.data.token);
    
    return response.data;
  } catch (error) {
    console.error('Login failed:', error.response?.data);
    throw error;
  }
};

// Authenticated request
const fetchData = async () => {
  const token = localStorage.getItem('token');
  
  try {
    const response = await axios.get(\`\${API_BASE_URL}/resource\`, {
      headers: {
        'Authorization': \`Bearer \${token}\`
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Fetch failed:', error.response?.data);
    throw error;
  }
};
\`\`\`

### cURL

\`\`\`bash
# Register
curl -X POST http://localhost:5000/api/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{"name":"John Doe","email":"john@example.com","password":"SecurePass123!"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"john@example.com","password":"SecurePass123!"}'

# Authenticated request
curl -X GET http://localhost:5000/api/auth/me \\
  -H "Authorization: Bearer your-jwt-token"
\`\`\`

## Webhooks

*Configure webhooks in your application settings if needed.*

## Versioning

API version is included in the base URL:
\`\`\`
/api/v1/...
\`\`\`

Current version: **v1**

---

**API Documentation Generated by Launch AI ULTRA**  
Last Updated: ${new Date().toISOString()}
`;
}

function generateEnvExample(results) {
  return `# Backend Environment Variables

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/database_name

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRY=7d

# Server Configuration
PORT=5000
NODE_ENV=development

# CORS Configuration
CORS_ORIGIN=http://localhost:3000
FRONTEND_URL=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Email Configuration (Optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-email-password
EMAIL_FROM=noreply@yourapp.com

# File Upload (Optional)
UPLOAD_MAX_SIZE=10485760
UPLOAD_DIR=./uploads

# Session (Optional)
SESSION_SECRET=your-session-secret-key

# Third-party APIs (Optional)
# Add any API keys your app needs

# Logging
LOG_LEVEL=info

# Security
BCRYPT_ROUNDS=10

---

# Frontend Environment Variables (.env)

REACT_APP_API_URL=http://localhost:5000
REACT_APP_ENV=development
REACT_APP_APP_NAME=${results.phase2?.project_name || 'My App'}

# Analytics (Optional)
# REACT_APP_GA_ID=your-google-analytics-id

# Feature Flags (Optional)
# REACT_APP_FEATURE_X=true

---

# Production Environment Variables

# Backend (.env.production)
DATABASE_URL=postgresql://user:pass@prod-host:5432/prod-db
JWT_SECRET=super-secret-production-key-min-32-chars
NODE_ENV=production
PORT=5000
CORS_ORIGIN=https://yourapp.com
FRONTEND_URL=https://yourapp.com

# Frontend (.env.production)
REACT_APP_API_URL=https://api.yourapp.com
REACT_APP_ENV=production
`;
}

function generateGitignore() {
  return `# Dependencies
node_modules/
/.pnp
.pnp.js

# Testing
/coverage

# Production
/build
/dist

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*
.pnpm-debug.log*

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Prisma
prisma/migrations/

# Uploads
uploads/
temp/

# Cache
.cache/
.parcel-cache/

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Misc
*.log
.serverless/
.fusebox/
.dynamodb/
.tern-port
`;
}

function generateDockerfile() {
  return `# Multi-stage build for Node.js application

# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build application (if needed)
# RUN npm run build

# Stage 2: Production
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built artifacts from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy application code
COPY . .

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \\
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "server.js"]
`;
}

function generateDockerCompose() {
  return `version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:14-alpine
    container_name: app_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: \${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-postgres}
      POSTGRES_DB: \${POSTGRES_DB:-appdb}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - app_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Backend API
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: app_backend
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://\${POSTGRES_USER:-postgres}:\${POSTGRES_PASSWORD:-postgres}@postgres:5432/\${POSTGRES_DB:-appdb}
      JWT_SECRET: \${JWT_SECRET:-change-this-secret}
      NODE_ENV: production
      PORT: 5000
    ports:
      - "5000:5000"
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - app_network
    volumes:
      - ./backend/uploads:/app/uploads

  # Frontend (optional - for production build)
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: app_frontend
    restart: unless-stopped
    ports:
      - "3000:80"
    environment:
      REACT_APP_API_URL: http://localhost:5000
    depends_on:
      - backend
    networks:
      - app_network

volumes:
  postgres_data:

networks:
  app_network:
    driver: bridge
`;
}

// ==========================================
// CLEANUP JOBS
// ==========================================

// Cleanup old builds every hour
setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  let cleaned = 0;

  activeBuilds.forEach((data, buildId) => {
    const startTime = new Date(data.started_at).getTime();
    if (now - startTime > maxAge) {
      // Delete ZIP file if exists
      if (data.zip_path) {
        fs.unlink(data.zip_path).catch(err => 
          console.error('Failed to delete ZIP:', err)
        );
      }
      
      // Remove from caches
      activeBuilds.delete(buildId);
      buildFilesCache.delete(buildId);
      buildLogs.delete(buildId);
      cleaned++;
    }
  });

  if (cleaned > 0) {
    console.log(`🗑️ Cleaned up ${cleaned} old builds`);
  }
}, 60 * 60 * 1000); // Run every hour

// Cleanup old temp files every 6 hours
setInterval(async () => {
  const tempDir = path.join(__dirname, '../temp');
  
  try {
    const files = await fs.readdir(tempDir);
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    let deleted = 0;

    for (const file of files) {
      const filePath = path.join(tempDir, file);
      const stats = await fs.stat(filePath);
      
      if (now - stats.mtimeMs > maxAge) {
        await fs.unlink(filePath);
        deleted++;
      }
    }

    if (deleted > 0) {
      console.log(`🗑️ Cleaned up ${deleted} old temp files`);
    }
  } catch (error) {
    console.error('Temp cleanup error:', error);
  }
}, 6 * 60 * 60 * 1000); // Run every 6 hours

// Export router and caches
module.exports = router;
module.exports.buildFilesCache = buildFilesCache;
module.exports.activeBuilds = activeBuilds;