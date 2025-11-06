// backend/services/database.js
// Complete Database Service Layer with Prisma


const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Calculate total size of files object
 * @param {Object} files - Files object with file paths as keys and content as values
 * @returns {number} Total size in bytes
 */
function calculateTotalSize(files) {
  if (!files || typeof files !== 'object') {
    return 0;
  }
  
  return Object.values(files).reduce((total, content) => {
    if (!content) return total;
    
    // Handle string content
    if (typeof content === 'string') {
      return total + content.length;
    }
    
    // Handle nested objects (like phase3 with frontend/backend)
    if (typeof content === 'object') {
      if (content.files) {
        return total + calculateTotalSize(content.files);
      }
      return total + JSON.stringify(content).length;
    }
    
    return total;
  }, 0);
}

/**
 * Extract file count from phase3 data
 * @param {Object} phase3 - Phase 3 build data
 * @returns {Object} File counts by category
 */
function extractFileCounts(phase3) {
  if (!phase3) {
    return { frontend_files: 0, backend_files: 0, database_migrations: 0 };
  }
  
  return {
    frontend_files: Object.keys(phase3.frontend?.files || {}).length,
    backend_files: Object.keys(phase3.backend?.files || {}).length,
    database_migrations: phase3.database?.migrations?.length || 0
  };
}

/**
 * Safely merge files from multiple sources
 * @param  {...Object} sources - File objects to merge
 * @returns {Object} Merged files object
 */
function mergeFiles(...sources) {
  const merged = {};
  
  for (const source of sources) {
    if (source && typeof source === 'object') {
      Object.assign(merged, source);
    }
  }
  
  return merged;
}

/**
 * Validate and sanitize project data before database save
 * @param {Object} data - Project data to validate
 * @returns {Object} Sanitized data
 */
function sanitizeProjectData(data) {
  const sanitized = { ...data };
  
  // Ensure JSON fields are valid objects
  const jsonFields = ['generatedFiles', 'researchData', 'competitorData', 'buildData', 'fileStats'];
  
  jsonFields.forEach(field => {
    if (sanitized[field] !== undefined && sanitized[field] !== null) {
      if (typeof sanitized[field] !== 'object') {
        console.warn(`⚠️ ${field} is not an object, converting...`);
        sanitized[field] = {};
      }
    }
  });
  
  return sanitized;
}

// ==========================================
// CONNECTION MANAGEMENT
// ==========================================

async function connectDatabase() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

async function disconnectDatabase() {
  await prisma.$disconnect();
  console.log('🔌 Database disconnected');
}


// ==========================================
// USER OPERATIONS
// ==========================================

const UserService = {
  // Create user
  async create(data) {
    return await prisma.user.create({
      data,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        tier: true,
        credits: true,
        emailVerified: true,
        provider: true,
        createdAt: true
      }
    });
  },

  // Find user by email
  async findByEmail(email) {
    return await prisma.user.findUnique({
      where: { email },
      include: {
        projects: {
          take: 10,
          orderBy: { createdAt: 'desc' }
        }
      }
    });
  },

  // Find user by ID
  async findById(id) {
    return await prisma.user.findUnique({
      where: { id },
      include: {
        projects: {
          take: 10,
          orderBy: { createdAt: 'desc' }
        },
        notifications: {
          where: { read: false },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
  },

  // Update user
  async update(id, data) {
    return await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        tier: true,
        credits: true,
        emailVerified: true,
        subscriptionStatus: true,
        subscriptionEnd: true
      }
    });
  },

  // Update last login
  async updateLastLogin(id) {
    return await prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() }
    });
  },

  // Deduct credit
  async deductCredit(id) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.credits <= 0) {
      throw new Error('Insufficient credits');
    }
    return await prisma.user.update({
      where: { id },
      data: { credits: { decrement: 1 } }
    });
  },

  // Add credits
  async addCredits(id, amount) {
    return await prisma.user.update({
      where: { id },
      data: { credits: { increment: amount } }
    });
  },

  // Upgrade tier
  async upgradeTier(id, tier, subscriptionData) {
    const credits = tier === 'starter' ? 100 : tier === 'premium' ? 1000 : 3;
    
    return await prisma.user.update({
      where: { id },
      data: {
        tier,
        credits,
        ...subscriptionData
      }
    });
  },

  // Get user stats
  async getStats(id) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        projects: true,
        payments: { where: { status: 'captured' } },
        analytics: {
          orderBy: { date: 'desc' },
          take: 30
        }
      }
    });

    return {
      totalProjects: user.projects.length,
      completedProjects: user.projects.filter(p => p.status === 'completed').length,
      totalRevenue: user.payments.reduce((sum, p) => sum + p.amount, 0),
      credits: user.credits,
      tier: user.tier
    };
  }
};

// ==========================================
// PROJECT OPERATIONS
// ==========================================

const ProjectService = {
  // CREATE PROJECT - ADD THIS METHOD
   async create(data) {
    const sanitized = sanitizeProjectData(data);
    
    return await prisma.project.create({
      data: {
        ...sanitized,
        createdAt: new Date()
      }
    });
  },
  // Update to accept and store ALL data
    async update(id, data) {
    const sanitized = sanitizeProjectData(data);
    
    return await prisma.project.update({
      where: { id },
      data: {
        ...sanitized,
        updatedAt: new Date()
      }
    });
  },
  
  // Get project WITH ALL DATA
   async findById(id) {
    return await prisma.project.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, email: true, name: true, tier: true }
        }
      }
    });
  },
  
  // Get projects with files for dashboard
   async getUserProjects(userId, limit = 10) {
    return await prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        buildProgress: true,
        filesGenerated: true,
        linesOfCode: true,
        qaScore: true,
        deploymentReady: true,
        downloadUrl: true,
        generatedFiles: true,  // CRITICAL
        fileStats: true,
        researchData: true,    // CRITICAL
        competitorData: true,  // CRITICAL
        buildData: true,       // CRITICAL
        framework: true,
        database: true,
        createdAt: true,
        completedAt: true,
        downloadedAt: true
      }
    });
  },
  
  // DELETE PROJECT
  async delete(id) {
    return await prisma.project.delete({
      where: { id }
    });
  }
};

// ==========================================
// PAYMENT OPERATIONS
// ==========================================

const PaymentService = {
  // Create payment
  async create(data) {
    return await prisma.payment.create({
      data
    });
  },

  // Find payment by ID
  async findById(id) {
    return await prisma.payment.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });
  },

  // Update payment status by order ID
  async updateStatus(razorpayOrderId, data) {
    return await prisma.payment.update({
      where: { razorpayOrderId },
      data: {
        ...data,
        paidAt: data.status === 'captured' ? new Date() : undefined,
        failedAt: data.status === 'failed' ? new Date() : undefined
      }
    });
  },

  // Update payment by payment ID
  async updateByPaymentId(razorpayPaymentId, data) {
    return await prisma.payment.updateMany({
      where: { razorpayPaymentId },
      data: {
        ...data,
        paidAt: data.status === 'captured' ? new Date() : undefined,
        failedAt: data.status === 'failed' ? new Date() : undefined
      }
    });
  },

  // Get user payments
  async getUserPayments(userId) {
    return await prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  },

  // Get successful payments
  async getSuccessfulPayments(userId) {
    return await prisma.payment.findMany({
      where: {
        userId,
        status: 'captured'
      },
      orderBy: { paidAt: 'desc' }
    });
  },

  // Calculate total revenue
  async getTotalRevenue(userId) {
    const payments = await prisma.payment.aggregate({
      where: {
        userId,
        status: 'captured'
      },
      _sum: {
        amount: true
      }
    });
    return payments._sum.amount || 0;
  }
};

// ==========================================
// NOTIFICATION OPERATIONS
// ==========================================

const NotificationService = {
  // Create notification
  async create(userId, data) {
    return await prisma.notification.create({
      data: {
        userId,
        ...data
      }
    });
  },

  // Find notification by ID
  async findById(id) {
    return await prisma.notification.findUnique({
      where: { id }
    });
  },

  // Get user notifications
  async getUserNotifications(userId, unreadOnly = false) {
    return await prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly && { read: false })
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
  },

  // Mark as read
  async markAsRead(id) {
    return await prisma.notification.update({
      where: { id },
      data: {
        read: true,
        readAt: new Date()
      }
    });
  },

  // Mark all as read
  async markAllAsRead(userId) {
    return await prisma.notification.updateMany({
      where: {
        userId,
        read: false
      },
      data: {
        read: true,
        readAt: new Date()
      }
    });
  },

  // Delete notification
  async delete(id) {
    return await prisma.notification.delete({
      where: { id }
    });
  },

  // Delete all read notifications
  async deleteAllRead(userId) {
    return await prisma.notification.deleteMany({
      where: {
        userId,
        read: true
      }
    });
  },

  // Get notification preferences
  async getPreferences(userId) {
    // For now, return default preferences
    // In production, store these in a separate UserPreferences table
    return {
      email: true,
      push: true,
      builds: true,
      payments: true,
      marketing: false
    };
  },

  // Update notification preferences
  async updatePreferences(userId, preferences) {
    // In production, store these in UserPreferences table
    // For now, just return the preferences
    return preferences;
  },

  // Get notification statistics
  async getStats(userId, days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        createdAt: { gte: startDate }
      }
    });

    const byType = {};
    notifications.forEach(n => {
      byType[n.type] = (byType[n.type] || 0) + 1;
    });

    return {
      total: notifications.length,
      unread: notifications.filter(n => !n.read).length,
      read: notifications.filter(n => n.read).length,
      byType,
      period: `Last ${days} days`
    };
  }
};

// ==========================================
// ANALYTICS OPERATIONS
// ==========================================

const AnalyticsService = {
  // Record analytics
  async record(userId, data) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Transform increment operations for create
  const createData = Object.entries(data).reduce((acc, [key, value]) => {
    if (typeof value === 'object' && value.increment !== undefined) {
      acc[key] = value.increment;
    } else {
      acc[key] = value;
    }
    return acc;
  }, { userId, date: today });

  return await prisma.userAnalytics.upsert({
    where: { userId_date: { userId, date: today } },
    update: data,
    create: createData
  });
},

  // Get user analytics
  async getUserAnalytics(userId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return await prisma.userAnalytics.findMany({
      where: {
        userId,
        date: { gte: startDate }
      },
      orderBy: { date: 'desc' }
    });
  }
};

// ==========================================
// SESSION OPERATIONS
// ==========================================

const SessionService = {
  // Create session
  async create(data) {
    return await prisma.session.create({
      data
    });
  },

  // Find session by token
  async findByToken(token) {
    return await prisma.session.findUnique({
      where: { token },
      include: {
        user: true
      }
    });
  },

  // Update last used
  async updateLastUsed(token) {
    return await prisma.session.update({
      where: { token },
      data: { lastUsedAt: new Date() }
    });
  },

  // Delete session
  async delete(token) {
    return await prisma.session.delete({
      where: { token }
    });
  },

  // Delete expired sessions
  async deleteExpired() {
    return await prisma.session.deleteMany({
      where: {
        expiresAt: { lt: new Date() }
      }
    });
  }
};

// ==========================================
// VERIFICATION CODE OPERATIONS
// ==========================================

const VerificationCodeService = {
  // Create verification code
  async create(email, type) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    return await prisma.verificationCode.create({
      data: {
        email,
        code,
        type,
        expiresAt
      }
    });
  },

  // Verify code
  async verify(email, code, type) {
    const verification = await prisma.verificationCode.findFirst({
      where: {
        email,
        code,
        type,
        usedAt: null,
        expiresAt: { gt: new Date() }
      }
    });

    if (!verification) {
      return null;
    }

    if (verification.attempts >= verification.maxAttempts) {
      return null;
    }

    await prisma.verificationCode.update({
      where: { id: verification.id },
      data: {
        attempts: { increment: 1 },
        usedAt: new Date()
      }
    });

    return verification;
  },

  // Delete old codes
  async deleteExpired() {
    return await prisma.verificationCode.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { usedAt: { not: null } }
        ]
      }
    });
  }
};

// ==========================================
// ACTIVITY LOG OPERATIONS
// ==========================================

const ActivityLogService = {
  // Log activity
  async log(data) {
    return await prisma.activityLog.create({
      data
    });
  },

  // Get user activity
  async getUserActivity(userId, limit = 50) {
    return await prisma.activityLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }
};

// ==========================================
// CLEANUP JOBS (Run periodically)
// ==========================================

async function runCleanupJobs() {
  console.log('🧹 Running cleanup jobs...');
  
  try {
    // Delete expired sessions
    const expiredSessions = await SessionService.deleteExpired();
    console.log(`✅ Deleted ${expiredSessions.count} expired sessions`);

    // Delete expired verification codes
    const expiredCodes = await VerificationCodeService.deleteExpired();
    console.log(`✅ Deleted ${expiredCodes.count} expired verification codes`);

    // Delete old notifications (older than 30 days)
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 30);
    
    const oldNotifications = await prisma.notification.deleteMany({
      where: {
        createdAt: { lt: oldDate },
        read: true
      }
    });
    console.log(`✅ Deleted ${oldNotifications.count} old notifications`);

  } catch (error) {
    console.error('❌ Cleanup job failed:', error);
  }
}

// Run cleanup every hour
setInterval(runCleanupJobs, 60 * 60 * 1000);

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  prisma,
  connectDatabase,
  disconnectDatabase,
  UserService,
  ProjectService,
  PaymentService,
  NotificationService,
  AnalyticsService,
  SessionService,
  VerificationCodeService,
  ActivityLogService,
  runCleanupJobs,
  // Helper functions
  calculateTotalSize,
  extractFileCounts,
  mergeFiles,
  sanitizeProjectData
};