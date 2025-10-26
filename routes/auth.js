const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// In-memory user store (replace with database in production)
const users = new Map();
const projects = new Map();

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'All fields required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user exists
    if (users.has(email)) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = {
      id: `user_${Date.now()}`,
      email,
      name,
      password: hashedPassword,
      tier: 'free',
      credits: 3, // Free trial: 3 app builds
      created_at: new Date().toISOString(),
      projects: []
    };

    users.set(email, user);

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, tier: user.tier },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tier: user.tier,
        credits: user.credits
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Signup failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Find user
    const user = users.get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, tier: user.tier },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tier: user.tier,
        credits: user.credits
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me - Get current user
router.get('/me', authenticateToken, (req, res) => {
  const user = users.get(req.user.email);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    tier: user.tier,
    credits: user.credits,
    projects: user.projects.length,
    created_at: user.created_at
  });
});

// POST /api/auth/upgrade - Upgrade tier
router.post('/upgrade', authenticateToken, async (req, res) => {
  try {
    const { tier, payment_method } = req.body;

    const user = users.get(req.user.email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Validate tier
    const validTiers = ['starter', 'premium'];
    if (!validTiers.includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier' });
    }

    // In production, process payment with Razorpay here
    // For now, just upgrade

    user.tier = tier;
    user.credits = tier === 'starter' ? 100 : 1000;
    users.set(req.user.email, user);

    res.json({
      success: true,
      message: `Upgraded to ${tier} tier`,
      user: {
        tier: user.tier,
        credits: user.credits
      }
    });

  } catch (error) {
    console.error('Upgrade error:', error);
    res.status(500).json({ error: 'Upgrade failed' });
  }
});

// POST /api/auth/use-credit - Deduct credit
router.post('/use-credit', authenticateToken, (req, res) => {
  const user = users.get(req.user.email);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (user.credits <= 0) {
    return res.status(403).json({
      error: 'No credits remaining',
      upgrade_url: '/pricing'
    });
  }

  user.credits -= 1;
  users.set(req.user.email, user);

  res.json({
    success: true,
    credits_remaining: user.credits
  });
});

// GET /api/auth/projects - Get user's projects
router.get('/projects', authenticateToken, (req, res) => {
  const user = users.get(req.user.email);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const userProjects = user.projects.map(projectId => {
    return projects.get(projectId);
  }).filter(Boolean);

  res.json({
    projects: userProjects,
    total: userProjects.length
  });
});

// POST /api/auth/save-project - Save project
router.post('/save-project', authenticateToken, (req, res) => {
  try {
    const { projectName, projectData } = req.body;
    
    const user = users.get(req.user.email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const projectId = `proj_${Date.now()}`;
    const project = {
      id: projectId,
      name: projectName,
      data: projectData,
      user_id: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    projects.set(projectId, project);
    user.projects.push(projectId);
    users.set(req.user.email, user);

    res.json({
      success: true,
      project: {
        id: projectId,
        name: projectName
      }
    });

  } catch (error) {
    console.error('Save project error:', error);
    res.status(500).json({ error: 'Failed to save project' });
  }
});

module.exports = { router, authenticateToken };