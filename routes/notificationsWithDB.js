// backend/routes/notificationsWithDB.js
// Complete Notifications Management with Database

const express = require('express');
const router = express.Router();
const { 
  NotificationService,
  UserService 
} = require('../services/database');
const { authenticateToken } = require('./authWithDB');

// ==========================================
// GET ALL NOTIFICATIONS FOR USER
// ==========================================
router.get('/', authenticateToken, async (req, res) => {
  try {
    const readOnly = req.query.read === 'true';
    const limit = parseInt(req.query.limit) || 50;

    const notifications = await NotificationService.getUserNotifications(
      req.user.id, 
      readOnly,
      limit
    );

    const unreadCount = await NotificationService.getUnreadCount(req.user.id);

    res.json({
      success: true,
      notifications,
      unread_count: unreadCount,
      total: notifications.length
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// ==========================================
// GET UNREAD NOTIFICATION COUNT
// ==========================================
router.get('/unread/count', authenticateToken, async (req, res) => {
  try {
    const count = await NotificationService.getUnreadCount(req.user.id);

    res.json({
      success: true,
      unread_count: count
    });

  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
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

    await NotificationService.markAsRead(req.params.id);

    res.json({
      success: true,
      message: 'Notification marked as read'
    });

  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// ==========================================
// MARK ALL NOTIFICATIONS AS READ
// ==========================================
router.put('/read-all', authenticateToken, async (req, res) => {
  try {
    await NotificationService.markAllAsRead(req.user.id);

    res.json({
      success: true,
      message: 'All notifications marked as read'
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
router.delete('/read/clear', authenticateToken, async (req, res) => {
  try {
    const deleted = await NotificationService.deleteAllRead(req.user.id);

    res.json({
      success: true,
      message: `Deleted ${deleted} read notifications`,
      deleted_count: deleted
    });

  } catch (error) {
    console.error('Clear read notifications error:', error);
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
});

// ==========================================
// CREATE NOTIFICATION (Admin/System only)
// ==========================================
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { userId, title, message, type, actionUrl, actionText } = req.body;

    // Validation
    if (!userId || !title || !message) {
      return res.status(400).json({ 
        error: 'userId, title, and message are required' 
      });
    }

    // Check if user exists
    const user = await UserService.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const notification = await NotificationService.create(userId, {
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

    // Auto-mark as read when fetched
    if (!notification.read) {
      await NotificationService.markAsRead(req.params.id);
      notification.read = true;
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

module.exports = router;