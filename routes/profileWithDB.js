// backend/routes/profileWithDB.js
const express = require('express');
const router = express.Router();
const { UserService, ProjectService, PaymentService, ActivityLogService, AnalyticsService } = require('../services/database');
const { authenticateToken } = require('./authWithDb');

// GET full user profile
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = await UserService.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user stats
    const stats = await UserService.getStats(user.id);
    
    // Get recent activity
    const recentActivity = await ActivityLogService.getUserActivity(user.id, 10);

    res.json({
      success: true,
      profile: {
        // Basic info
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        provider: user.provider,
        
        // OAuth info
        googleId: user.googleId ? 'Connected' : null,
        githubId: user.githubId ? 'Connected' : null,
        githubUsername: user.githubUsername,
        
        // Status
        emailVerified: user.emailVerified,
        tier: user.tier,
        credits: user.credits,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionEnd: user.subscriptionEnd,
        
        // Timestamps
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        
        // Stats
        stats: {
          totalProjects: stats.totalProjects,
          completedProjects: stats.completedProjects,
          totalRevenue: stats.totalRevenue / 100, // Convert to rupees
          credits: stats.credits
        },
        
        // Recent activity
        recentActivity: recentActivity.map(a => ({
          action: a.action,
          description: a.description || getActionDescription(a.action),
          timestamp: a.createdAt
        }))
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// UPDATE profile
router.put('/', authenticateToken, async (req, res) => {
  try {
    const { name, avatar } = req.body;
    
    const updateData = {};
    if (name && name.trim().length >= 2) {
      updateData.name = name.trim();
    }
    if (avatar) {
      updateData.avatar = avatar;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No valid update data provided' });
    }

    const user = await UserService.update(req.user.id, updateData);

    await ActivityLogService.log({
      userId: req.user.id,
      action: 'profile_updated',
      metadata: updateData
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// GET profile analytics
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const analytics = await AnalyticsService.getUserAnalytics(req.user.id, days);

    // Calculate trends
    const totals = {
      buildsStarted: analytics.reduce((sum, a) => sum + a.buildsStarted, 0),
      buildsCompleted: analytics.reduce((sum, a) => sum + a.buildsCompleted, 0),
      buildsFailed: analytics.reduce((sum, a) => sum + a.buildsFailed, 0),
      downloads: analytics.reduce((sum, a) => sum + a.downloadsCount, 0),
      revenue: analytics.reduce((sum, a) => sum + a.revenueGenerated, 0) / 100
    };

    // Chart data
    const chartData = analytics.map(a => ({
      date: a.date.toISOString().split('T')[0],
      builds: a.buildsStarted,
      completed: a.buildsCompleted,
      revenue: a.revenueGenerated / 100
    }));

    res.json({
      success: true,
      analytics: {
        totals,
        chartData,
        period: `Last ${days} days`,
        successRate: totals.buildsStarted > 0 
          ? Math.round((totals.buildsCompleted / totals.buildsStarted) * 100) 
          : 0
      }
    });

  } catch (error) {
    console.error('Get profile analytics error:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// GET billing history
router.get('/billing', authenticateToken, async (req, res) => {
  try {
    const payments = await PaymentService.getUserPayments(req.user.id);
    
    const formattedPayments = payments.map(p => ({
      id: p.id,
      amount: p.amount / 100,
      currency: p.currency,
      status: p.status,
      plan: p.planName,
      date: p.createdAt,
      paidAt: p.paidAt,
      receipt: p.receipt,
      invoiceUrl: p.invoiceUrl
    }));

    const totalSpent = await PaymentService.getTotalRevenue(req.user.id);

    res.json({
      success: true,
      billing: {
        payments: formattedPayments,
        totalSpent: totalSpent / 100,
        currency: 'INR'
      }
    });

  } catch (error) {
    console.error('Get billing history error:', error);
    res.status(500).json({ error: 'Failed to get billing history' });
  }
});

// GET linked accounts
router.get('/linked-accounts', authenticateToken, async (req, res) => {
  try {
    const user = await UserService.findById(req.user.id);
    
    res.json({
      success: true,
      linkedAccounts: {
        google: {
          connected: !!user.googleId,
          email: user.googleId ? user.email : null
        },
        github: {
          connected: !!user.githubId,
          username: user.githubUsername
        }
      }
    });

  } catch (error) {
    console.error('Get linked accounts error:', error);
    res.status(500).json({ error: 'Failed to get linked accounts' });
  }
});

// Helper function
function getActionDescription(action) {
  const descriptions = {
    'signup': 'Created account',
    'login': 'Logged in',
    'login_oauth': 'Logged in via OAuth',
    'logout': 'Logged out',
    'project_created': 'Started new build',
    'project_completed': 'Completed build',
    'project_downloaded': 'Downloaded project',
    'payment_success': 'Payment successful',
    'tier_upgraded': 'Upgraded tier',
    'profile_updated': 'Updated profile',
    'settings_updated': 'Updated settings'
  };
  
  return descriptions[action] || action.replace(/_/g, ' ');
}

module.exports = router;