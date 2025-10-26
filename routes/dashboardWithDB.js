// backend/routes/dashboardWithDB.js
// Real Dashboard with Analytics from Database

const express = require('express');
const router = express.Router();
const { 
  UserService, 
  ProjectService, 
  PaymentService,
  AnalyticsService,
  ActivityLogService,
  NotificationService
} = require('../services/database');
const { authenticateToken } = require('./authWithDb');

// ==========================================
// GET DASHBOARD OVERVIEW
// ==========================================

router.get('/overview', authenticateToken, async (req, res) => {
  try {
    const user = await UserService.findById(req.user.id);
    const projects = await ProjectService.getUserProjects(req.user.id, 100);
    const payments = await PaymentService.getSuccessfulPayments(req.user.id);
    const totalRevenue = await PaymentService.getTotalRevenue(req.user.id);

    // Calculate real stats
    const stats = {
      // User info
      credits: user.credits,
      tier: user.tier,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionEnd: user.subscriptionEnd,

      // Project stats
      totalProjects: projects.length,
      completedProjects: projects.filter(p => p.status === 'completed').length,
      buildingProjects: projects.filter(p => p.status === 'building').length,
      failedProjects: projects.filter(p => p.status === 'failed').length,

      // Financial stats
      totalRevenue: totalRevenue / 100, // Convert to rupees
      totalPayments: payments.length,

      // Engagement stats
      totalDownloads: projects.filter(p => p.downloadedAt).length,
      avgQaScore: calculateAverage(projects.map(p => p.qaScore).filter(Boolean)),
      deploymentReadyCount: projects.filter(p => p.deploymentReady).length,

      // Code generation stats
      totalFilesGenerated: projects.reduce((sum, p) => sum + (p.filesGenerated || 0), 0),
      totalLinesOfCode: projects.reduce((sum, p) => sum + (p.linesOfCode || 0), 0),

      // Recent activity
      recentProjects: projects.slice(0, 5).map(p => ({
        id: p.id,
        name: p.name,
        status: p.status,
        createdAt: p.createdAt,
        completedAt: p.completedAt
      }))
    };

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Get dashboard overview error:', error);
    res.status(500).json({ error: 'Failed to get dashboard data' });
  }
});

// ==========================================
// GET ANALYTICS (Last 30 days)
// ==========================================

router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const analytics = await AnalyticsService.getUserAnalytics(req.user.id, days);

    // Transform for charts
    const chartData = analytics.map(a => ({
      date: a.date,
      builds: a.buildsStarted,
      completed: a.buildsCompleted,
      failed: a.buildsFailed,
      downloads: a.downloadsCount,
      revenue: a.revenueGenerated / 100 // In rupees
    }));

    // Calculate totals
    const totals = {
      buildsStarted: analytics.reduce((sum, a) => sum + a.buildsStarted, 0),
      buildsCompleted: analytics.reduce((sum, a) => sum + a.buildsCompleted, 0),
      buildsFailed: analytics.reduce((sum, a) => sum + a.buildsFailed, 0),
      downloads: analytics.reduce((sum, a) => sum + a.downloadsCount, 0),
      revenue: analytics.reduce((sum, a) => sum + a.revenueGenerated, 0) / 100
    };

    res.json({
      success: true,
      chartData,
      totals,
      period: `Last ${days} days`
    });

  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// ==========================================
// GET ACTIVITY TIMELINE
// ==========================================

router.get('/activity', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const activities = await ActivityLogService.getUserActivity(req.user.id, limit);

    // Transform for frontend
    const timeline = activities.map(a => ({
      id: a.id,
      action: a.action,
      description: a.description || getActionDescription(a.action),
      resource: a.resource,
      resourceId: a.resourceId,
      timestamp: a.createdAt,
      metadata: a.metadata
    }));

    res.json({
      success: true,
      timeline,
      total: activities.length
    });

  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({ error: 'Failed to get activity' });
  }
});

// ==========================================
// GET PROJECT STATISTICS
// ==========================================

router.get('/projects/stats', authenticateToken, async (req, res) => {
  try {
    const projects = await ProjectService.getUserProjects(req.user.id, 1000);

    // Group by status
    const byStatus = {
      building: projects.filter(p => p.status === 'building').length,
      completed: projects.filter(p => p.status === 'completed').length,
      failed: projects.filter(p => p.status === 'failed').length,
      deployed: projects.filter(p => p.deploymentUrl).length
    };

    // Group by framework
    const byFramework = {};
    projects.forEach(p => {
      if (p.framework) {
        byFramework[p.framework] = (byFramework[p.framework] || 0) + 1;
      }
    });

    // Group by month
    const byMonth = {};
    projects.forEach(p => {
      const month = new Date(p.createdAt).toISOString().slice(0, 7); // YYYY-MM
      byMonth[month] = (byMonth[month] || 0) + 1;
    });

    // Success rate
    const totalCompleted = byStatus.completed + byStatus.failed;
    const successRate = totalCompleted > 0 
      ? Math.round((byStatus.completed / totalCompleted) * 100) 
      : 0;

    res.json({
      success: true,
      stats: {
        total: projects.length,
        byStatus,
        byFramework,
        byMonth: Object.entries(byMonth).map(([month, count]) => ({ month, count })),
        successRate,
        avgQaScore: calculateAverage(projects.map(p => p.qaScore).filter(Boolean)),
        avgFilesGenerated: calculateAverage(projects.map(p => p.filesGenerated).filter(Boolean)),
        avgLinesOfCode: calculateAverage(projects.map(p => p.linesOfCode).filter(Boolean))
      }
    });

  } catch (error) {
    console.error('Get project stats error:', error);
    res.status(500).json({ error: 'Failed to get project stats' });
  }
});

// ==========================================
// GET USAGE METRICS
// ==========================================

router.get('/usage', authenticateToken, async (req, res) => {
  try {
    const user = await UserService.findById(req.user.id);
    const projects = await ProjectService.getUserProjects(req.user.id, 1000);

    // Calculate usage percentages
    const maxCredits = user.tier === 'free' ? 3 : user.tier === 'starter' ? 100 : 1000;
    const creditsUsed = maxCredits - user.credits;
    const creditsUsedPercentage = Math.round((creditsUsed / maxCredits) * 100);

    // Storage (estimate based on projects)
    const estimatedStorageMB = projects.length * 45; // ~45MB per project
    const maxStorageMB = 1000; // 1GB
    const storagePercentage = Math.min(100, Math.round((estimatedStorageMB / maxStorageMB) * 100));

    // API calls (estimate based on activity)
    const estimatedApiCalls = projects.length * 127; // ~127 calls per build
    const maxApiCalls = 10000;
    const apiCallsPercentage = Math.min(100, Math.round((estimatedApiCalls / maxApiCalls) * 100));

    res.json({
      success: true,
      usage: {
        credits: {
          used: creditsUsed,
          total: maxCredits,
          remaining: user.credits,
          percentage: creditsUsedPercentage
        },
        storage: {
          used: estimatedStorageMB,
          total: maxStorageMB,
          percentage: storagePercentage,
          unit: 'MB'
        },
        apiCalls: {
          used: estimatedApiCalls,
          total: maxApiCalls,
          percentage: apiCallsPercentage
        }
      }
    });

  } catch (error) {
    console.error('Get usage error:', error);
    res.status(500).json({ error: 'Failed to get usage data' });
  }
});

// ==========================================
// GET PERFORMANCE INSIGHTS
// ==========================================

router.get('/insights', authenticateToken, async (req, res) => {
  try {
    const projects = await ProjectService.getUserProjects(req.user.id, 100);
    const analytics = await AnalyticsService.getUserAnalytics(req.user.id, 30);

    // Calculate average build time
    const completedProjects = projects.filter(p => p.completedAt && p.createdAt);
    const avgBuildTime = completedProjects.length > 0
      ? completedProjects.reduce((sum, p) => {
          const diff = new Date(p.completedAt) - new Date(p.createdAt);
          return sum + (diff / 1000 / 60); // in minutes
        }, 0) / completedProjects.length
      : 0;

    // Success rate
    const totalBuilds = projects.filter(p => p.status === 'completed' || p.status === 'failed').length;
    const successRate = totalBuilds > 0
      ? Math.round((projects.filter(p => p.status === 'completed').length / totalBuilds) * 100)
      : 0;

    // Code quality score
    const avgQaScore = calculateAverage(projects.map(p => p.qaScore).filter(Boolean));

    // Trend analysis (last 7 days vs previous 7 days)
    const last7Days = analytics.slice(0, 7);
    const prev7Days = analytics.slice(7, 14);
    
    const last7DaysBuilds = last7Days.reduce((sum, a) => sum + a.buildsStarted, 0);
    const prev7DaysBuilds = prev7Days.reduce((sum, a) => sum + a.buildsStarted, 0);
    
    const buildsTrend = prev7DaysBuilds > 0
      ? Math.round(((last7DaysBuilds - prev7DaysBuilds) / prev7DaysBuilds) * 100)
      : 0;

    res.json({
      success: true,
      insights: {
        avgBuildTime: `${avgBuildTime.toFixed(1)} min`,
        successRate: `${successRate}%`,
        avgQaScore: `${avgQaScore}/100`,
        buildsTrend: `${buildsTrend > 0 ? '+' : ''}${buildsTrend}%`,
        trends: {
          builds: buildsTrend > 0 ? 'up' : buildsTrend < 0 ? 'down' : 'stable',
          successRate: successRate >= 98 ? 'excellent' : successRate >= 90 ? 'good' : 'needs_improvement',
          codeQuality: avgQaScore >= 85 ? 'excellent' : avgQaScore >= 70 ? 'good' : 'needs_improvement'
        }
      }
    });

  } catch (error) {
    console.error('Get insights error:', error);
    res.status(500).json({ error: 'Failed to get insights' });
  }
});

// ==========================================
// GET NOTIFICATIONS SUMMARY
// ==========================================

router.get('/notifications/summary', authenticateToken, async (req, res) => {
  try {
    const allNotifications = await NotificationService.getUserNotifications(req.user.id, false);
    const unreadNotifications = allNotifications.filter(n => !n.read);

    // Group by type
    const byType = {};
    unreadNotifications.forEach(n => {
      byType[n.type] = (byType[n.type] || 0) + 1;
    });

    res.json({
      success: true,
      summary: {
        total: allNotifications.length,
        unread: unreadNotifications.length,
        byType,
        recent: unreadNotifications.slice(0, 5).map(n => ({
          id: n.id,
          title: n.title,
          message: n.message,
          type: n.type,
          createdAt: n.createdAt
        }))
      }
    });

  } catch (error) {
    console.error('Get notifications summary error:', error);
    res.status(500).json({ error: 'Failed to get notifications summary' });
  }
});

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function calculateAverage(numbers) {
  if (numbers.length === 0) return 0;
  const sum = numbers.reduce((a, b) => a + b, 0);
  return Math.round(sum / numbers.length);
}

function getActionDescription(action) {
  const descriptions = {
    'signup': 'Created account',
    'login': 'Logged in',
    'login_oauth': 'Logged in via OAuth',
    'logout': 'Logged out',
    'project_created': 'Started new build',
    'project_completed': 'Completed build',
    'project_downloaded': 'Downloaded project',
    'project_deleted': 'Deleted project',
    'payment_initiated': 'Started payment',
    'payment_success': 'Payment successful',
    'tier_upgraded': 'Upgraded tier',
    'credit_used': 'Used credit',
    'email_verified': 'Verified email',
    'password_changed': 'Changed password',
    'password_reset': 'Reset password',
    'profile_update': 'Updated profile'
  };
  
  return descriptions[action] || action.replace(/_/g, ' ');
}

module.exports = router;