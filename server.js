// backend/server.js
// Production Server with Complete Database Integration

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const config = require('./config/environment');
const { connectDatabase, runCleanupJobs } = require('./services/database');

const app = express();

// ==========================================
// TRUST PROXY
// ==========================================
app.set('trust proxy', 1);

// ==========================================
// SESSION MIDDLEWARE
// ==========================================
// Removed unused session middleware

// ==========================================
// INITIALIZE PASSPORT (OAuth)
// ==========================================
const { passport } = require('./routes/authOAuthWithDB');
app.use(passport.initialize());

// ==========================================
// SECURITY MIDDLEWARE
// ==========================================
app.use(helmet());

// ==========================================
// CORS
// ==========================================
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    
    const allowed = config.cors.origins.some(allowedOrigin => 
      origin.includes(allowedOrigin)
    );
    
    if (allowed) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS blocked: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ==========================================
// RATE LIMITING
// ==========================================
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: 'Too many requests, please try again later.',
  keyGenerator: (req) => {
    if (req.ip) {
      return req.ip.replace(/:\d+[^:]*$/, '');
    }
    return req.socket.remoteAddress; 
  }
});
app.use('/api/', limiter);

// ==========================================
// HEALTH CHECK
// ==========================================
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    version: '2.0.0-production',
    database: 'connected',
    oauth: {
      google: !!process.env.GOOGLE_CLIENT_ID,
      github: !!process.env.GITHUB_CLIENT_ID
    }
  });
});

// ==========================================
// API ROUTES (WITH DATABASE)
// ==========================================

// Authentication routes
const { router: authRouter } = require('./routes/authWithDb');
const { router: authOAuthRouter } = require('./routes/authOAuthWithDB');

// Resource routes
const projectsRouter = require('./routes/projectsWithDB');
const paymentsRouter = require('./routes/paymentsWithDB');
const notificationsRouter = require('./routes/notificationsWithDB');
const dashboardRouter = require('./routes/dashboardWithDB');
const settingsRouter = require('./routes/settingsWithDB');
const profileRouter = require('./routes/profileWithDB');

// Legacy routes (keep for compatibility)
const validateRouter = require('./routes/validate');
const generateRouter = require('./routes/generate');
const researchRouter = require('./routes/research');
const deployRouter = require('./routes/deploy');
const masterBuildRouter = require('./routes/masterBuild');

// Mount routes
app.use('/api/auth', authRouter);
app.use('/api/auth/oauth', authOAuthRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/profile', profileRouter);

// Legacy routes
app.use('/api/validate', validateRouter);
app.use('/api/generate', generateRouter);
app.use('/api/research', researchRouter);
app.use('/api/deploy', deployRouter);
app.use('/api/master', masterBuildRouter);

// ==========================================
// ERROR HANDLING
// ==========================================
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Prisma errors
  if (err.code?.startsWith('P')) {
    return res.status(400).json({
      error: 'Database error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
    });
  }
  
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      status: err.status || 500
    }
  });
});

// ==========================================
// 404 HANDLER
// ==========================================
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ==========================================
// STARTUP
// ==========================================
async function startServer() {
  try {
    // Connect to database
    await connectDatabase();
    console.log('✅ Database connected');

    // Run initial cleanup
    await runCleanupJobs();
    console.log('✅ Initial cleanup complete');

    // Start server
    const port = config.port;
    app.listen(port, () => {
      const backendURL = process.env.BACKEND_URL || `http://localhost:${port}`;
      
      console.log('\n🚀 Launch AI Backend v2.0 (Production)');
      console.log('=====================================');
      console.log(`📍 Port: ${port}`);
      console.log(`🌍 Environment: ${config.nodeEnv}`);
      console.log(`🔗 Backend URL: ${backendURL}`);
      console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL}`);
      console.log(`🗄️  Database: Connected (Prisma + PostgreSQL)`);
      console.log(`📧 Email: ${process.env.EMAIL_USER ? 'Configured' : '⚠️  Not configured'}`);
      console.log('\n🔐 OAuth Providers:');
      console.log(`   - Google: ${process.env.GOOGLE_CLIENT_ID ? '✅ Enabled' : '❌ Disabled'}`);
      console.log(`   - GitHub: ${process.env.GITHUB_CLIENT_ID ? '✅ Enabled' : '❌ Disabled'}`);
      console.log('\n📝 OAuth Callback URLs:');
      console.log(`   Google:  ${backendURL}/api/auth/oauth/google/callback`);
      console.log(`   GitHub:  ${backendURL}/api/auth/oauth/github/callback`);
      console.log('\n✅ All systems operational\n');
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('📊 SIGTERM received, shutting down gracefully...');
  const { disconnectDatabase } = require('./services/database');
  await disconnectDatabase();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('📊 SIGINT received, shutting down gracefully...');
  const { disconnectDatabase } = require('./services/database');
  await disconnectDatabase();
  process.exit(0);
});

// Start the server
startServer();

module.exports = app;