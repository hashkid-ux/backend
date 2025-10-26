const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { passport } = require('../config/passport');

// ========================================
// GOOGLE OAUTH ROUTES
// ========================================
router.get('/google', 
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    session: false 
  })
);

router.get('/google/callback',
  passport.authenticate('google', { 
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}?error=google_auth_failed`
  }),
  (req, res) => {
    try {
      // Generate JWT token
      const token = jwt.sign(
        { 
          id: req.user.id, 
          email: req.user.email, 
          tier: req.user.tier 
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      );

      // Redirect to frontend with token
      const frontendURL = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendURL}/auth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify({
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        avatar: req.user.avatar,
        tier: req.user.tier,
        credits: req.user.credits,
        provider: 'google'
      }))}`);
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}?error=token_generation_failed`);
    }
  }
);

// ========================================
// GITHUB OAUTH ROUTES
// ========================================
router.get('/github',
  passport.authenticate('github', { 
    scope: ['user:email'],
    session: false 
  })
);

router.get('/github/callback',
  passport.authenticate('github', { 
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}?error=github_auth_failed`
  }),
  (req, res) => {
    try {
      // Generate JWT token
      const token = jwt.sign(
        { 
          id: req.user.id, 
          email: req.user.email, 
          tier: req.user.tier 
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      );

      // Redirect to frontend with token
      const frontendURL = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendURL}/auth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify({
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        avatar: req.user.avatar,
        tier: req.user.tier,
        credits: req.user.credits,
        provider: 'github',
        githubUsername: req.user.githubUsername
      }))}`);
    } catch (error) {
      console.error('GitHub OAuth callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}?error=token_generation_failed`);
    }
  }
);

// ========================================
// GET SUPPORTED OAUTH PROVIDERS
// ========================================
router.get('/providers', (req, res) => {
  res.json({
    providers: [
      {
        id: 'google',
        name: 'Google',
        enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        authUrl: '/api/auth/oauth/google'
      },
      {
        id: 'github',
        name: 'GitHub',
        enabled: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
        authUrl: '/api/auth/oauth/github'
      }
    ]
  });
});

module.exports = router;