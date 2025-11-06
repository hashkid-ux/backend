const express = require('express');
const router = express.Router();
const AnalyticsService = require('../services/analytics');
const { authenticateToken } = require('./authWithDb');

// Public endpoint - no auth needed
router.post('/track', async (req, res) => {
  try {
    const { projectId, event, ...data } = req.body;
    
    if (!projectId || !event) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    switch (event) {
      case 'page_view':
        await AnalyticsService.trackPageView(projectId, data.page, req.user?.id);
        break;
      case 'error':
        await AnalyticsService.trackError(projectId, data, data.stack, req.user?.id);
        break;
      case 'action':
        await AnalyticsService.trackAction(projectId, data.action, data, req.user?.id);
        break;
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Analytics tracking error:', error);
    res.status(500).json({ error: 'Failed to track event' });
  }
});

// Get analytics (requires auth)
router.get('/project/:id', authenticateToken, async (req, res) => {
  try {
    const analytics = await AnalyticsService.getProjectAnalytics(req.params.id);
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

module.exports = router;