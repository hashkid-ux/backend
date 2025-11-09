// services/analytics.js - COMPLETE REPLACEMENT

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class AnalyticsService {
  // Track page views - NEVER throw errors
  static async trackPageView(projectId, page, userId = null) {
    try {
      await prisma.analyticsEvent.create({
        data: {
          projectId,
          eventType: 'page_view',
          eventData: { page },
          userId,
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('[Analytics] trackPageView failed:', error.message);
      // Silent fail - analytics should never break app
    }
  }

  // Track errors - with size limits
  static async trackError(projectId, error, stackTrace, userId = null) {
    try {
      await prisma.analyticsEvent.create({
        data: {
          projectId,
          eventType: 'error',
          eventData: { 
            error: (error.message || String(error)).substring(0, 500),
            stack: stackTrace ? String(stackTrace).substring(0, 1000) : null,
            url: error.url
          },
          userId,
          timestamp: new Date()
        }
      });
    } catch (err) {
      console.error('[Analytics] trackError failed:', err.message);
    }
  }

  // Track user actions - with sanitization
  static async trackAction(projectId, action, metadata, userId = null) {
    try {
      const sanitized = this.sanitizeMetadata(metadata);
      
      await prisma.analyticsEvent.create({
        data: {
          projectId,
          eventType: 'user_action',
          eventData: { action, ...sanitized },
          userId,
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('[Analytics] trackAction failed:', error.message);
    }
  }

  // Get project analytics - with error handling
  static async getProjectAnalytics(projectId, days = 30) {
    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      const events = await prisma.analyticsEvent.findMany({
        where: {
          projectId,
          timestamp: { gte: since }
        },
        orderBy: { timestamp: 'desc' },
        take: 1000 // Prevent memory issues
      });

      return {
        total_events: events.length,
        page_views: events.filter(e => e.eventType === 'page_view').length,
        errors: events.filter(e => e.eventType === 'error').length,
        actions: events.filter(e => e.eventType === 'user_action').length,
        unique_users: new Set(events.map(e => e.userId).filter(Boolean)).size,
        events: events.slice(0, 100)
      };
    } catch (error) {
      console.error('[Analytics] getProjectAnalytics failed:', error.message);
      return {
        total_events: 0,
        page_views: 0,
        errors: 0,
        actions: 0,
        unique_users: 0,
        events: [],
        error: 'Analytics unavailable'
      };
    }
  }

  // Sanitize metadata - prevent SQL injection & size bloat
  static sanitizeMetadata(metadata, maxDepth = 3, depth = 0) {
    if (depth > maxDepth) return '[Depth Limit]';
    if (!metadata || typeof metadata !== 'object') {
      return String(metadata || '').substring(0, 500);
    }
    
    const clean = {};
    for (const [key, value] of Object.entries(metadata)) {
      const safeKey = key.replace(/[^\w]/g, '_').substring(0, 50);
      
      if (typeof value === 'object' && value !== null) {
        clean[safeKey] = this.sanitizeMetadata(value, maxDepth, depth + 1);
      } else {
        clean[safeKey] = String(value).substring(0, 500);
      }
    }
    return clean;
  }
}

module.exports = AnalyticsService;