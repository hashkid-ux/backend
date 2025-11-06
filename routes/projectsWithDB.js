// backend/routes/projectsWithDB.js
// Complete Project Management with Database

const express = require('express');
const router = express.Router();
const { 
  ProjectService, 
  UserService, 
  NotificationService,
  AnalyticsService,
  ActivityLogService,
  calculateTotalSize,  // CRITICAL FIX: Import helper
  extractFileCounts,
  mergeFiles
} = require('../services/database');
const EmailService = require('../services/emailService');
const { authenticateToken } = require('./authWithDb');

// ==========================================
// CREATE PROJECT (Start Build)
// ==========================================

router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      projectName,
      description,
      prompt,
      features,
      targetPlatform,
      framework,
      database
    } = req.body;

    // Validation
    if (!projectName || !description) {
      return res.status(400).json({ error: 'Project name and description required' });
    }

    // Check credits
    const user = await UserService.findById(req.user.id);
    
    if (user.credits <= 0) {
      return res.status(403).json({
        error: 'No credits remaining',
        upgrade_url: '/pricing'
      });
    }

    // Deduct credit
    await UserService.deductCredit(user.id);

    // Create project
    const project = await ProjectService.create({
      userId: req.user.id,
      name: projectName,
      description,
      prompt: prompt || description,
      framework: framework || 'react',
      database: database || 'postgresql',
      targetPlatform: targetPlatform || 'web',
      // CRITICAL: Store research request
    researchData: {
      requested: true,
      targetCountry: req.body.targetCountry,
      features: req.body.features
    }
    });

    // Create notification
    await NotificationService.create(req.user.id, {
      title: 'Build Started',
      message: `Your project "${projectName}" is being built by AI agents`,
      type: 'build',
      actionUrl: `/projects/${project.id}`,
      actionText: 'View Progress'
    });

    // Update analytics
    await AnalyticsService.record(req.user.id, {
      buildsStarted: { increment: 1 }
    });

    // Log activity
    await ActivityLogService.log({
      userId: req.user.id,
      action: 'project_created',
      resource: 'project',
      resourceId: project.id,
      description: `Started building "${projectName}"`
    });

    res.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        status: project.status,
        buildProgress: project.buildProgress
      },
      credits_remaining: user.credits - 1
    });

  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// ==========================================
// GET USER PROJECTS
// ==========================================

router.get('/', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status; // 'building', 'completed', 'failed'

    let projects;
    
    if (status) {
      projects = await ProjectService.getUserProjects(req.user.id, limit);
      projects = projects.filter(p => p.status === status);
    } else {
      projects = await ProjectService.getUserProjects(req.user.id, limit);
    }

    res.json({
      success: true,
      projects,
      total: projects.length
    });

  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Failed to get projects' });
  }
});

// ==========================================
// GET PROJECT BY ID
// ==========================================

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const project = await ProjectService.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check ownership
    if (project.userId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Validate data structure
    const validatedProject = {
      ...project,
      generatedFiles: project.generatedFiles || {},
      researchData: project.researchData || null,
      competitorData: project.competitorData || null,
      buildData: project.buildData || null,
      fileStats: project.fileStats || { total_files: 0, total_size: 0 }
    };

    res.json({
      success: true,
      project: validatedProject
    });

  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Failed to get project' });
  }
});

// ==========================================
// UPDATE PROJECT (Progress/Status)
// ==========================================

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const project = await ProjectService.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check ownership
    if (project.userId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const updateData = {};
    
    if (req.body.buildProgress !== undefined) {
      updateData.buildProgress = req.body.buildProgress;
    }
    
    if (req.body.status) {
      updateData.status = req.body.status;
    }
    
    if (req.body.downloadUrl) {
      updateData.downloadUrl = req.body.downloadUrl;
    }

    const updated = await ProjectService.update(req.params.id, updateData);

    res.json({
      success: true,
      project: updated
    });

  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// ==========================================
// MARK PROJECT AS COMPLETED
// ==========================================

router.post('/:id/complete', authenticateToken, async (req, res) => {
  try {
    const { buildData, phase1, phase2, phase3, phase4 } = req.body;

    const project = await ProjectService.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check ownership
    if (project.userId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // CRITICAL FIX: Safely merge all files
    const allGeneratedFiles = mergeFiles(
      phase3?.frontend?.files,
      phase3?.backend?.files
    );

      // Calculate file stats
    const fileCounts = extractFileCounts(phase3);
    const totalSize = calculateTotalSize(phase3);

    // Build complete update data
    const updateData = {
      status: 'completed',
      buildProgress: 100,
      completedAt: new Date(),
      filesGenerated: buildData?.summary?.files_generated || fileCounts.frontend_files + fileCounts.backend_files,
      linesOfCode: buildData?.summary?.lines_of_code || 0,
      qaScore: buildData?.summary?.qa_score || phase4?.qa_results?.overall_score || 0,
      deploymentReady: buildData?.summary?.deployment_ready || phase4?.deployment_ready || false,
      downloadUrl: buildData?.download_url || buildData?.downloadUrl,
      
      // FULL RESEARCH DATA (Phase 1)
      researchData: phase1 || {
        market: null,
        competitors: null,
        reviews: null,
        trends: null,
        dateContext: null,
        _fullData: {}
      },
      
      // COMPETITOR DATA (Phase 2)
      competitorData: phase2 || {
        competitive_advantages: [],
        ux_strategy: {},
        features_prioritized: []
      },
      
      // ALL GENERATED FILES
      generatedFiles: allGeneratedFiles,
      
      // FILE METADATA
      fileStats: {
        frontend_files: fileCounts.frontend_files,
        backend_files: fileCounts.backend_files,
        database_migrations: fileCounts.database_migrations,
        total_size: totalSize,
        total_files: fileCounts.frontend_files + fileCounts.backend_files + fileCounts.database_migrations
      },
      
      // COMPLETE BUILD DATA
      buildData: {
        build_id: buildData?.build_id,
        project_id: buildData?.project_id,
        summary: buildData?.summary || {
          files_generated: fileCounts.frontend_files + fileCounts.backend_files,
          lines_of_code: 0,
          competitors_analyzed: phase1?.competitors?.total_analyzed || 0,
          reviews_scanned: phase1?.reviews?.totalReviewsAnalyzed || 0
        },
        phases: {
          phase1: phase1,
          phase2: phase2,
          phase3: phase3,
          phase4: phase4
        },
        timestamp: new Date().toISOString()
      }
    };

    // Update project
    const completed = await ProjectService.update(req.params.id, updateData);

    // Create notification
    await NotificationService.create(req.user.id, {
      title: 'Build Complete! 🎉',
      message: `Your project "${project.name}" is ready to download`,
      type: 'success',
      actionUrl: `/projects/${project.id}`,
      actionText: 'Download Now'
    });

    // Update analytics
    await AnalyticsService.record(req.user.id, {
      buildsCompleted: { increment: 1 },
      downloadsCount: { increment: 0 }
    });

    // Send email notification
    const user = await UserService.findById(req.user.id);
    const downloadUrl = `${process.env.FRONTEND_URL}/projects/${project.id}/download`;
    
    if (EmailService && EmailService.sendBuildComplete) {
      EmailService.sendBuildComplete(user.email, user.name, project.name, downloadUrl)
        .catch(err => console.warn('Email notification failed:', err));
    }

    // Log activity
    await ActivityLogService.log({
      userId: req.user.id,
      action: 'project_completed',
      resource: 'project',
      resourceId: project.id,
      description: `Completed building "${project.name}"`
    });

    console.log('✅ Project completed and saved to database:', {
      id: project.id,
      filesGenerated: updateData.filesGenerated,
      linesOfCode: updateData.linesOfCode,
      totalSize: updateData.fileStats.total_size,
      hasResearchData: !!updateData.researchData,
      hasCompetitorData: !!updateData.competitorData,
      hasGeneratedFiles: Object.keys(updateData.generatedFiles).length > 0
    });

    res.json({
      success: true,
      project: completed
    });

  } catch (error) {
    console.error('Complete project error:', error);
    res.status(500).json({ 
      error: 'Failed to complete project',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ==========================================
// DOWNLOAD PROJECT
// ==========================================

router.post('/:id/download', authenticateToken, async (req, res) => {
  try {
    const project = await ProjectService.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check ownership
    if (project.userId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Update download timestamp
    await ProjectService.update(req.params.id, {
      downloadedAt: new Date()
    });

    // Update analytics
    await AnalyticsService.record(req.user.id, {
      downloadsCount: { increment: 1 }
    });

    // Log activity
    await ActivityLogService.log({
      userId: req.user.id,
      action: 'project_downloaded',
      resource: 'project',
      resourceId: project.id,
      description: `Downloaded "${project.name}"`
    });

    res.json({
      success: true,
      message: 'Download tracked'
    });

  } catch (error) {
    console.error('Download project error:', error);
    res.status(500).json({ error: 'Failed to track download' });
  }
});

// ==========================================
// DELETE PROJECT
// ==========================================

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const project = await ProjectService.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check ownership
    if (project.userId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await ProjectService.delete(req.params.id);

    // Log activity
    await ActivityLogService.log({
      userId: req.user.id,
      action: 'project_deleted',
      resource: 'project',
      resourceId: project.id,
      description: `Deleted "${project.name}"`
    });

    res.json({
      success: true,
      message: 'Project deleted'
    });

  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// ==========================================
// GET PROJECT STATS
// ==========================================

router.get('/:id/stats', authenticateToken, async (req, res) => {
  try {
    const project = await ProjectService.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check ownership
    if (project.userId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const stats = {
      filesGenerated: project.filesGenerated,
      linesOfCode: project.linesOfCode,
      qaScore: project.qaScore,
      deploymentReady: project.deploymentReady,
      framework: project.framework,
      database: project.database,
      createdAt: project.createdAt,
      completedAt: project.completedAt,
      downloadedAt: project.downloadedAt
    };

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Get project stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

module.exports = router;