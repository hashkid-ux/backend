// backend/routes/settingsWithDB.js
const express = require('express');
const router = express.Router();
const { UserService, ActivityLogService } = require('../services/database');
const { authenticateToken } = require('./authWithDb');
const bcrypt = require('bcrypt');

// GET user settings
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = await UserService.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      settings: {
        // Account settings
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        emailVerified: user.emailVerified,
        
        // Preferences (stored in user or separate table)
        notifications: {
          email: true,
          push: true,
          builds: true,
          payments: true,
          marketing: false
        },
        
        // Privacy
        privacy: {
          profileVisibility: 'private',
          showActivity: false
        },
        
        // Developer settings
        developer: {
          apiAccess: user.tier === 'premium',
          webhookUrl: null
        }
      }
    });

  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// UPDATE account settings
router.put('/account', authenticateToken, async (req, res) => {
  try {
    const { name, avatar } = req.body;
    
    const updateData = {};
    if (name && name.trim().length >= 2) updateData.name = name.trim();
    if (avatar) updateData.avatar = avatar;

    const user = await UserService.update(req.user.id, updateData);

    await ActivityLogService.log({
      userId: req.user.id,
      action: 'settings_update_account',
      metadata: updateData
    });

    res.json({
      success: true,
      message: 'Account settings updated',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar
      }
    });

  } catch (error) {
    console.error('Update account error:', error);
    res.status(500).json({ error: 'Failed to update account settings' });
  }
});

// UPDATE notification preferences
router.put('/notifications', authenticateToken, async (req, res) => {
  try {
    const { email, push, builds, payments, marketing } = req.body;
    
    // Store in user metadata or separate preferences table
    const preferences = {
      email: email !== undefined ? email : true,
      push: push !== undefined ? push : true,
      builds: builds !== undefined ? builds : true,
      payments: payments !== undefined ? payments : true,
      marketing: marketing !== undefined ? marketing : false
    };

    // For now, log the preference change
    await ActivityLogService.log({
      userId: req.user.id,
      action: 'settings_update_notifications',
      metadata: preferences
    });

    res.json({
      success: true,
      message: 'Notification preferences updated',
      preferences
    });

  } catch (error) {
    console.error('Update notifications error:', error);
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
});

// CHANGE password
router.post('/password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const user = await UserService.findById(req.user.id);

    // Check if user has password (not OAuth only)
    if (!user.password) {
      return res.status(400).json({ 
        error: 'Cannot change password for OAuth accounts',
        message: 'Your account uses Google/GitHub login'
      });
    }

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await UserService.update(user.id, {
      password: hashedPassword
    });

    await ActivityLogService.log({
      userId: req.user.id,
      action: 'password_changed',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// UPDATE privacy settings
router.put('/privacy', authenticateToken, async (req, res) => {
  try {
    const { profileVisibility, showActivity } = req.body;
    
    const privacy = {
      profileVisibility: profileVisibility || 'private',
      showActivity: showActivity !== undefined ? showActivity : false
    };

    await ActivityLogService.log({
      userId: req.user.id,
      action: 'settings_update_privacy',
      metadata: privacy
    });

    res.json({
      success: true,
      message: 'Privacy settings updated',
      privacy
    });

  } catch (error) {
    console.error('Update privacy error:', error);
    res.status(500).json({ error: 'Failed to update privacy settings' });
  }
});

// DELETE account
router.delete('/account', authenticateToken, async (req, res) => {
  try {
    const { password, confirmText } = req.body;

    if (confirmText !== 'DELETE MY ACCOUNT') {
      return res.status(400).json({ 
        error: 'Please type "DELETE MY ACCOUNT" to confirm' 
      });
    }

    const user = await UserService.findById(req.user.id);

    // Verify password if not OAuth user
    if (user.password) {
      if (!password) {
        return res.status(400).json({ error: 'Password required' });
      }
      
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid password' });
      }
    }

    // Soft delete: mark as inactive instead of hard delete
    await UserService.update(req.user.id, {
      isActive: false,
      isBanned: true,
      banReason: 'Account deleted by user'
    });

    await ActivityLogService.log({
      userId: req.user.id,
      action: 'account_deleted',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    // Clear session
    const { SessionService } = require('../services/database');
    const token = req.headers['authorization']?.split(' ')[1];
    if (token) {
      await SessionService.delete(token);
    }

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });

  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// GET API keys (Premium only)
router.get('/api-keys', authenticateToken, async (req, res) => {
  try {
    const user = await UserService.findById(req.user.id);
    
    if (user.tier !== 'premium') {
      return res.status(403).json({ 
        error: 'API access requires Premium tier',
        upgrade_url: '/pricing'
      });
    }

    // In production, generate real API keys
    res.json({
      success: true,
      apiKeys: [
        {
          id: 'key_1',
          name: 'Production Key',
          key: 'sk_prod_' + Math.random().toString(36).substr(2, 32),
          created: new Date().toISOString(),
          lastUsed: null
        }
      ]
    });

  } catch (error) {
    console.error('Get API keys error:', error);
    res.status(500).json({ error: 'Failed to get API keys' });
  }
});

module.exports = router;