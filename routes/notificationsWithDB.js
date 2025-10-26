// backend/routes/notificationsWithDB.js
// Complete Notifications System with Database Integration

const express = require('express');
const router = express.Router();
const { 
  NotificationService,
  ActivityLogService 
} = require('../services/database');
const { authenticateToken } = require('./authWithDb');

// ==========================================
// GET ALL NOTIFICATIONS
// ==========================================

router.get('/', authenticateToken, async (req, res) => {
  try {
    const unreadOnly = req.query.unread === 'true';
    const limit = parseInt(req.query.limit) || 50;

    let notifications = await NotificationService.getUserNotifications(
      req.user.id, 
      unreadOnly
    );

    // Limit results
    notifications = notifications.slice(0, limit);

    // Group by type for summary
    const byType = {};
    notifications.forEach(n => {
      byType[n.type] = (byType[n.type] || 0) + 1;
    });

    res.json({
      success: true,
      notifications,
      total: notifications.length,
      unread: notifications.filter(n => !n.read).length,
      byType
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// ==========================================
// GET NOTIFICATION BY ID
// ==========================================

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const notification = await NotificationService.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Check ownership
    if (notification.userId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json({
      success: true,
      notification
    });

  } catch (error) {
    console.error('Get notification error:', error);
    res.status(500).json({ error: 'Failed to get notification' });
  }
});

// ==========================================
// MARK NOTIFICATION AS READ
// ==========================================

router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const notification = await NotificationService.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Check ownership
    if (notification.userId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const updated = await NotificationService.markAsRead(req.params.id);

    // Log activity
    await ActivityLogService.log({
      userId: req.user.id,
      action: 'notification_read',
      resource: 'notification',
      resourceId: req.params.id,
      metadata: { type: notification.type }
    });

    res.json({
      success: true,
      notification: updated
    });

  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// ==========================================
// MARK ALL AS READ
// ==========================================

router.post('/read-all', authenticateToken, async (req, res) => {
  try {
    const result = await NotificationService.markAllAsRead(req.user.id);

    // Log activity
    await ActivityLogService.log({
      userId: req.user.id,
      action: 'notifications_read_all',
      metadata: { count: result.count }
    });

    res.json({
      success: true,
      message: 'All notifications marked as read',
      count: result.count
    });

  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// ==========================================
// DELETE NOTIFICATION
// ==========================================

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const notification = await NotificationService.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Check ownership
    if (notification.userId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await NotificationService.delete(req.params.id);

    // Log activity
    await ActivityLogService.log({
      userId: req.user.id,
      action: 'notification_deleted',
      resource: 'notification',
      resourceId: req.params.id
    });

    res.json({
      success: true,
      message: 'Notification deleted'
    });

  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// ==========================================
// DELETE ALL READ NOTIFICATIONS
// ==========================================

router.delete('/clear/read', authenticateToken, async (req, res) => {
  try {
    const result = await NotificationService.deleteAllRead(req.user.id);

    // Log activity
    await ActivityLogService.log({
      userId: req.user.id,
      action: 'notifications_cleared',
      metadata: { count: result.count }
    });

    res.json({
      success: true,
      message: 'Read notifications cleared',
      count: result.count
    });

  } catch (error) {
    console.error('Clear notifications error:', error);
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
});

// ==========================================
// CREATE NOTIFICATION (Admin/System)
// ==========================================

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, message, type, actionUrl, actionText } = req.body;

    // Validation
    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message required' });
    }

    const notification = await NotificationService.create(req.user.id, {
      title,
      message,
      type: type || 'info',
      actionUrl,
      actionText
    });

    res.json({
      success: true,
      notification
    });

  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

// ==========================================
// GET NOTIFICATION PREFERENCES
// ==========================================

router.get('/preferences/settings', authenticateToken, async (req, res) => {
  try {
    const preferences = await NotificationService.getPreferences(req.user.id);

    res.json({
      success: true,
      preferences: preferences || {
        email: true,
        push: true,
        builds: true,
        payments: true,
        marketing: false
      }
    });

  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: 'Failed to get preferences' });
  }
});

// ==========================================
// UPDATE NOTIFICATION PREFERENCES
// ==========================================

router.put('/preferences/settings', authenticateToken, async (req, res) => {
  try {
    const { email, push, builds, payments, marketing } = req.body;

    const preferences = await NotificationService.updatePreferences(req.user.id, {
      email: email !== undefined ? email : true,
      push: push !== undefined ? push : true,
      builds: builds !== undefined ? builds : true,
      payments: payments !== undefined ? payments : true,
      marketing: marketing !== undefined ? marketing : false
    });

    // Log activity
    await ActivityLogService.log({
      userId: req.user.id,
      action: 'preferences_updated',
      metadata: preferences
    });

    res.json({
      success: true,
      preferences
    });

  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// ==========================================
// GET NOTIFICATION STATS
// ==========================================

router.get('/stats/summary', authenticateToken, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const stats = await NotificationService.getStats(req.user.id, days);

    res.json({
      success: true,
      stats,
      period: `Last ${days} days`
    });

  } catch (error) {
    console.error('Get notification stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

module.exports = router;