// backend/routes/authOAuthWithDB.js
// OAuth Routes with Database Integration

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const { UserService, SessionService, ActivityLogService } = require('../services/database');
const EmailService = require('../services/emailService');

// ==========================================
// PASSPORT CONFIGURATION
// ==========================================

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// ==========================================
// GOOGLE OAUTH STRATEGY
// ==========================================

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.BACKEND_URL}/api/auth/oauth/google/callback`
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log(`✅ Google OAuth successful for: ${profile.emails?.[0]?.value}`);
        
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error('No email provided by Google'), null);
        }

        let user = await UserService.findByEmail(email);
        
        if (user) {
          if (!user.googleId) {
            user = await UserService.update(user.id, {
              googleId: profile.id,
              avatar: user.avatar || profile.photos?.[0]?.value,
              emailVerified: true
            });
            console.log(`🔗 Linked Google account to: ${email}`);
          }
        } else {
          user = await UserService.create({
            googleId: profile.id,
            email: email,
            name: profile.displayName || 'User',
            avatar: profile.photos?.[0]?.value,
            provider: 'google',
            emailVerified: true,
            tier: 'free',
            credits: 3
          });
          
          console.log(`👤 Created new user via Google: ${email}`);
          
          EmailService.sendWelcome(email, user.name, user.credits).catch(err => {
            console.error('Failed to send welcome email:', err);
          });
        }

        await UserService.updateLastLogin(user.id);
        return done(null, user);
        
      } catch (error) {
        console.error('❌ Google OAuth error:', error);
        return done(error, null);
      }
    }
  ));
  console.log('✅ Google OAuth Strategy initialized');
} else {
  console.warn('⚠️  Google OAuth not configured');
}

// ==========================================
// GITHUB OAUTH STRATEGY
// ==========================================

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(new GitHubStrategy({
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: `${process.env.BACKEND_URL}/api/auth/oauth/github/callback`,
      scope: ['user:email']
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log(`✅ GitHub OAuth successful for: ${profile.username}`);
        
        const email = profile.emails?.[0]?.value || `${profile.username}@github.com`;
        let user = await UserService.findByEmail(email);
        
        if (user) {
          if (!user.githubId) {
            user = await UserService.update(user.id, {
              githubId: profile.id,
              githubUsername: profile.username,
              avatar: user.avatar || profile.photos?.[0]?.value,
              emailVerified: true
            });
            console.log(`🔗 Linked GitHub account to: ${email}`);
          }
        } else {
          user = await UserService.create({
            githubId: profile.id,
            githubUsername: profile.username,
            email: email,
            name: profile.displayName || profile.username || 'User',
            avatar: profile.photos?.[0]?.value || profile.avatar_url,
            provider: 'github',
            emailVerified: true,
            tier: 'free',
            credits: 3
          });
          
          console.log(`👤 Created new user via GitHub: ${email}`);
          
          EmailService.sendWelcome(email, user.name, user.credits).catch(err => {
            console.error('Failed to send welcome email:', err);
          });
        }

        await UserService.updateLastLogin(user.id);
        return done(null, user);
        
      } catch (error) {
        console.error('❌ GitHub OAuth error:', error);
        return done(error, null);
      }
    }
  ));
  console.log('✅ GitHub OAuth Strategy initialized');
} else {
  console.warn('⚠️  GitHub OAuth not configured');
}

// ==========================================
// GOOGLE ROUTES
// ==========================================

router.get('/google', 
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    session: false
  })
);

router.get('/google/callback',
  passport.authenticate('google', { 
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}?error=google_auth_failed`
  }),
  async (req, res) => {
    try {
      const token = jwt.sign(
        { id: req.user.id, email: req.user.email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await SessionService.create({
        userId: req.user.id,
        token,
        expiresAt,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      await ActivityLogService.log({
        userId: req.user.id,
        action: 'login_oauth',
        metadata: { provider: 'google' },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      const frontendURL = process.env.FRONTEND_URL || 'http://localhost:3000';
      const userData = encodeURIComponent(JSON.stringify({
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        avatar: req.user.avatar,
        tier: req.user.tier,
        credits: req.user.credits,
        provider: 'google'
      }));
      
      res.redirect(`${frontendURL}/auth/callback?token=${token}&user=${userData}`);
      
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL}?error=token_generation_failed`);
    }
  }
);

// ==========================================
// GITHUB ROUTES
// ==========================================

router.get('/github',
  passport.authenticate('github', { 
    scope: ['user:email'],
    session: false
  })
);

router.get('/github/callback',
  passport.authenticate('github', { 
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}?error=github_auth_failed`
  }),
  async (req, res) => {
    try {
      const token = jwt.sign(
        { id: req.user.id, email: req.user.email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await SessionService.create({
        userId: req.user.id,
        token,
        expiresAt,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      await ActivityLogService.log({
        userId: req.user.id,
        action: 'login_oauth',
        metadata: { provider: 'github' },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      const frontendURL = process.env.FRONTEND_URL || 'http://localhost:3000';
      const userData = encodeURIComponent(JSON.stringify({
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        avatar: req.user.avatar,
        tier: req.user.tier,
        credits: req.user.credits,
        provider: 'github',
        githubUsername: req.user.githubUsername
      }));
      
      res.redirect(`${frontendURL}/auth/callback?token=${token}&user=${userData}`);
      
    } catch (error) {
      console.error('GitHub OAuth callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL}?error=token_generation_failed`);
    }
  }
);

// ==========================================
// GET SUPPORTED OAUTH PROVIDERS
// ==========================================

router.get('/providers', (req, res) => {
  res.json({
    providers: [
      {
        id: 'google',
        name: 'Google',
        enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        authUrl: '/api/auth/oauth/google',
        icon: 'google'
      },
      {
        id: 'github',
        name: 'GitHub',
        enabled: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
        authUrl: '/api/auth/oauth/github',
        icon: 'github'
      }
    ]
  });
});

module.exports = { router, passport };