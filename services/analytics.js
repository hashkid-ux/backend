const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class AnalyticsService {
  // Track page views
  static async trackPageView(projectId, page, userId = null) {
    await prisma.analyticsEvent.create({
      data: {
        projectId,
        eventType: 'page_view',
        eventData: { page },
        userId,
        timestamp: new Date()
      }
    });
  }

  // Track errors
  static async trackError(projectId, error, stackTrace, userId = null) {
    await prisma.analyticsEvent.create({
      data: {
        projectId,
        eventType: 'error',
        eventData: { 
          error: error.message,
          stack: stackTrace,
          url: error.url
        },
        userId,
        timestamp: new Date()
      }
    });
  }

  // Track user actions
  static async trackAction(projectId, action, metadata, userId = null) {
    await prisma.analyticsEvent.create({
      data: {
        projectId,
        eventType: 'user_action',
        eventData: { action, ...metadata },
        userId,
        timestamp: new Date()
      }
    });
  }

  // Get project analytics
  static async getProjectAnalytics(projectId, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const events = await prisma.analyticsEvent.findMany({
      where: {
        projectId,
        timestamp: { gte: since }
      },
      orderBy: { timestamp: 'desc' }
    });

    return {
      total_events: events.length,
      page_views: events.filter(e => e.eventType === 'page_view').length,
      errors: events.filter(e => e.eventType === 'error').length,
      actions: events.filter(e => e.eventType === 'user_action').length,
      unique_users: new Set(events.map(e => e.userId).filter(Boolean)).size,
      events: events.slice(0, 100) // Last 100 events
    };
  }
}

module.exports = AnalyticsService;