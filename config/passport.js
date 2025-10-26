const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;

// In-memory user store (replace with database in production)
const users = new Map();

// ========================================
// VALIDATE REQUIRED OAUTH CREDENTIALS
// ========================================
const requiredOAuthVars = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GITHUB_CLIENT_ID', 
  'GITHUB_CLIENT_SECRET'
];

const missingOAuthVars = requiredOAuthVars.filter(v => !process.env[v]);

if (missingOAuthVars.length > 0) {
  console.error('❌ Missing required OAuth environment variables:');
  missingOAuthVars.forEach(v => console.error(`   - ${v}`));
  console.error('\n💡 Add these to your Railway environment variables');
  process.exit(1);
}

// ========================================
// BUILD CALLBACK URLS
// ========================================
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const GOOGLE_CALLBACK_URL = `${BACKEND_URL}/api/auth/oauth/google/callback`;
const GITHUB_CALLBACK_URL = `${BACKEND_URL}/api/auth/oauth/github/callback`;

console.log('\n🔗 OAuth Configuration:');
console.log(`   Backend URL: ${BACKEND_URL}`);
console.log(`   Google Callback: ${GOOGLE_CALLBACK_URL}`);
console.log(`   GitHub Callback: ${GITHUB_CALLBACK_URL}`);
console.log('\n⚠️  IMPORTANT: Add these exact URLs to your OAuth providers:');
console.log(`   Google Console: https://console.cloud.google.com/apis/credentials`);
console.log(`   GitHub Settings: https://github.com/settings/developers\n`);

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser((id, done) => {
  const user = Array.from(users.values()).find(u => u.id === id);
  done(null, user);
});

// ========================================
// GOOGLE OAUTH STRATEGY
// ========================================
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: GOOGLE_CALLBACK_URL
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      console.log(`✅ Google OAuth successful for: ${profile.emails?.[0]?.value}`);
      
      // Check if user already exists
      let user = Array.from(users.values()).find(u => u.googleId === profile.id);
      
      if (!user) {
        // Check if email already exists (linked to another provider)
        const email = profile.emails?.[0]?.value;
        
        if (!email) {
          return done(new Error('No email provided by Google'), null);
        }
        
        user = Array.from(users.values()).find(u => u.email === email);
        
        if (user) {
          // Link Google account to existing user
          user.googleId = profile.id;
          user.avatar = user.avatar || profile.photos?.[0]?.value;
          users.set(user.email, user);
          console.log(`🔗 Linked Google account to existing user: ${email}`);
        } else {
          // Create new user
          user = {
            id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            googleId: profile.id,
            email: email,
            name: profile.displayName || profile.name?.givenName || 'User',
            avatar: profile.photos?.[0]?.value,
            provider: 'google',
            tier: 'free',
            credits: 3,
            created_at: new Date().toISOString(),
            projects: []
          };
          users.set(user.email, user);
          console.log(`👤 Created new user via Google: ${email}`);
        }
      }
      
      return done(null, user);
    } catch (error) {
      console.error('❌ Google OAuth error:', error);
      return done(error, null);
    }
  }
));

// ========================================
// GITHUB OAUTH STRATEGY
// ========================================
passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: GITHUB_CALLBACK_URL,
    scope: ['user:email']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      console.log(`✅ GitHub OAuth successful for: ${profile.username}`);
      
      // Check if user already exists
      let user = Array.from(users.values()).find(u => u.githubId === profile.id);
      
      if (!user) {
        // Get primary email from GitHub
        const email = profile.emails?.[0]?.value || `${profile.username}@github.com`;
        
        // Check if email already exists (linked to another provider)
        user = Array.from(users.values()).find(u => u.email === email);
        
        if (user) {
          // Link GitHub account to existing user
          user.githubId = profile.id;
          user.githubUsername = profile.username;
          user.avatar = user.avatar || profile.photos?.[0]?.value || profile.avatar_url;
          users.set(user.email, user);
          console.log(`🔗 Linked GitHub account to existing user: ${email}`);
        } else {
          // Create new user
          user = {
            id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            githubId: profile.id,
            githubUsername: profile.username,
            email: email,
            name: profile.displayName || profile.username || 'User',
            avatar: profile.photos?.[0]?.value || profile.avatar_url,
            provider: 'github',
            tier: 'free',
            credits: 3,
            created_at: new Date().toISOString(),
            projects: []
          };
          users.set(user.email, user);
          console.log(`👤 Created new user via GitHub: ${email}`);
        }
      }
      
      return done(null, user);
    } catch (error) {
      console.error('❌ GitHub OAuth error:', error);
      return done(error, null);
    }
  }
));

console.log('✅ Google OAuth Strategy initialized');
console.log('✅ GitHub OAuth Strategy initialized');

module.exports = { passport, users };