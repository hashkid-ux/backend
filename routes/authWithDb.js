// backend/routes/authWithDB.js
// Complete Authentication with Database + OTP + Direct Signup

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { 
  UserService, 
  SessionService, 
  VerificationCodeService,
  ActivityLogService 
} = require('../services/database');
const EmailService = require('../services/emailService');

// ==========================================
// MIDDLEWARE
// ==========================================

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const session = await SessionService.findByToken(token);
    
    if (!session || session.expiresAt < new Date()) {
      return res.status(403).json({ error: 'Token expired' });
    }

    await SessionService.updateLastUsed(token);
    req.user = session.user;
    req.session = session;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// ==========================================
// DIRECT SIGNUP (NO OTP)
// ==========================================

router.post('/signup', async (req, res) => {
  try {
    const { email, name, password } = req.body;

    if (!email || !name || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existingUser = await UserService.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await UserService.create({
      email,
      name,
      password: hashedPassword,
      emailVerified: true,
      provider: 'email',
      tier: 'free',
      credits: 3
    });

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await SessionService.create({
      userId: user.id,
      token,
      expiresAt,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    await ActivityLogService.log({
      userId: user.id,
      action: 'signup',
      resource: 'user',
      resourceId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    EmailService.sendWelcome(email, name, user.credits).catch(err => {
      console.error('Failed to send welcome email:', err);
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tier: user.tier,
        credits: user.credits,
        emailVerified: user.emailVerified
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Signup failed' });
  }
});

// ==========================================
// OTP SIGNUP - STEP 1: REQUEST OTP
// ==========================================

router.post('/signup/request-otp', async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email || !name) {
      return res.status(400).json({ error: 'Email and name required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    const existingUser = await UserService.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const verification = await VerificationCodeService.create(email, 'signup');
    
    await EmailService.sendOTP(email, verification.code, name, 'signup');

    res.json({
      success: true,
      message: 'OTP sent to your email',
      expiresIn: 600
    });

  } catch (error) {
    console.error('Request OTP error:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// ==========================================
// OTP SIGNUP - STEP 2: VERIFY OTP & CREATE ACCOUNT
// ==========================================

router.post('/signup/verify-otp', async (req, res) => {
  try {
    const { email, otp, name, password } = req.body;

    if (!email || !otp || !name || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const verification = await VerificationCodeService.verify(email, otp, 'signup');
    
    if (!verification) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await UserService.create({
      email,
      name,
      password: hashedPassword,
      emailVerified: true,
      provider: 'email',
      tier: 'free',
      credits: 3
    });

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await SessionService.create({
      userId: user.id,
      token,
      expiresAt,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    await ActivityLogService.log({
      userId: user.id,
      action: 'signup',
      resource: 'user',
      resourceId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    EmailService.sendWelcome(email, name, user.credits).catch(err => {
      console.error('Failed to send welcome email:', err);
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tier: user.tier,
        credits: user.credits,
        emailVerified: user.emailVerified
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Signup failed' });
  }
});

// ==========================================
// LOGIN WITH PASSWORD
// ==========================================

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await UserService.findByEmail(email);
    
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.isBanned) {
      return res.status(403).json({ 
        error: 'Account suspended', 
        reason: user.banReason 
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await SessionService.create({
      userId: user.id,
      token,
      expiresAt,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    await UserService.updateLastLogin(user.id);

    await ActivityLogService.log({
      userId: user.id,
      action: 'login',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        tier: user.tier,
        credits: user.credits,
        emailVerified: user.emailVerified
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ==========================================
// GET CURRENT USER
// ==========================================

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await UserService.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const stats = await UserService.getStats(user.id);

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      tier: user.tier,
      credits: user.credits,
      emailVerified: user.emailVerified,
      provider: user.provider,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionEnd: user.subscriptionEnd,
      createdAt: user.createdAt,
      stats
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// ==========================================
// LOGOUT
// ==========================================

router.post('/logout', authenticateToken, async (req, res) => {
  try {
    await SessionService.delete(req.session.token);

    await ActivityLogService.log({
      userId: req.user.id,
      action: 'logout',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({ success: true, message: 'Logged out' });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// ==========================================
// UPDATE PROFILE
// ==========================================

router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { name, avatar } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (avatar) updateData.avatar = avatar;

    const user = await UserService.update(req.user.id, updateData);

    await ActivityLogService.log({
      userId: req.user.id,
      action: 'profile_update',
      metadata: updateData
    });

    res.json({
      success: true,
      user
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ==========================================
// REQUEST PASSWORD RESET
// ==========================================

router.post('/password/reset-request', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const user = await UserService.findByEmail(email);
    
    if (!user) {
      return res.json({ 
        success: true, 
        message: 'If email exists, reset instructions sent' 
      });
    }

    const resetToken = require('crypto').randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);

    await UserService.update(user.id, {
      resetToken,
      resetTokenExpiry
    });

    EmailService.sendPasswordReset(email, user.name, resetToken).catch(err => {
      console.error('Failed to send reset email:', err);
    });

    res.json({ 
      success: true, 
      message: 'Reset instructions sent to your email' 
    });

  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({ error: 'Failed to send reset email' });
  }
});

// ==========================================
// RESET PASSWORD WITH TOKEN
// ==========================================

router.post('/password/reset', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = await UserService.findByResetToken(token);
    
    if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await UserService.update(user.id, {
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null
    });

    await ActivityLogService.log({
      userId: user.id,
      action: 'password_reset'
    });

    EmailService.sendPasswordResetSuccess(user.email, user.name).catch(err => {
      console.error('Failed to send confirmation email:', err);
    });

    res.json({
      success: true,
      message: 'Password reset successful'
    });

  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Password reset failed' });
  }
});

// ==========================================
// CHANGE PASSWORD (AUTHENTICATED)
// ==========================================

router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = await UserService.findById(req.user.id);

    if (user.password) {
      const validPassword = await bcrypt.compare(currentPassword, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Current password incorrect' });
      }
    } else {
      return res.status(400).json({ error: 'Cannot change password for OAuth accounts' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await UserService.update(user.id, {
      password: hashedPassword
    });

    await ActivityLogService.log({
      userId: user.id,
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

// ==========================================
// USE CREDIT
// ==========================================

router.post('/use-credit', authenticateToken, async (req, res) => {
  try {
    const user = await UserService.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.credits <= 0) {
      return res.status(403).json({
        error: 'No credits remaining',
        upgrade_url: '/pricing'
      });
    }

    await UserService.deductCredit(user.id);

    if (user.credits === 4) {
      EmailService.sendCreditsLow(user.email, user.name, 3).catch(err => {
        console.error('Failed to send low credits email:', err);
      });
    }

    await ActivityLogService.log({
      userId: user.id,
      action: 'credit_used',
      metadata: { remaining: user.credits - 1 }
    });

    res.json({
      success: true,
      credits_remaining: user.credits - 1
    });

  } catch (error) {
    console.error('Use credit error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// UPGRADE TIER
// ==========================================

router.post('/upgrade', authenticateToken, async (req, res) => {
  try {
    const { tier, subscriptionId, subscriptionData } = req.body;

    const validTiers = ['starter', 'premium'];
    if (!validTiers.includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier' });
    }

    const subscriptionStart = new Date();
    const subscriptionEnd = new Date();
    subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);

    const user = await UserService.upgradeTier(req.user.id, tier, {
      subscriptionId,
      subscriptionStatus: 'active',
      subscriptionStart,
      subscriptionEnd,
      ...subscriptionData
    });

    await ActivityLogService.log({
      userId: req.user.id,
      action: 'tier_upgraded',
      metadata: { tier, subscriptionId }
    });

    res.json({
      success: true,
      message: `Upgraded to ${tier} tier`,
      user: {
        tier: user.tier,
        credits: user.credits,
        subscriptionStatus: user.subscriptionStatus
      }
    });

  } catch (error) {
    console.error('Upgrade error:', error);
    res.status(500).json({ error: 'Upgrade failed' });
  }
});

// ==========================================
// GET USER PROJECTS
// ==========================================

router.get('/projects', authenticateToken, async (req, res) => {
  try {
    const { ProjectService } = require('../services/database');
    const projects = await ProjectService.getUserProjects(req.user.id);

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

module.exports = { router, authenticateToken };