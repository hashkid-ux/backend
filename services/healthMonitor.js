const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const prisma = new PrismaClient();

class HealthMonitor {
  static async checkAllApps() {
    const apps = await prisma.deployedApp.findMany({
      where: { status: 'active' }
    });
    
    for (const app of apps) {
      await this.checkApp(app);
    }
  }
  
  static async checkApp(app) {
    const start = Date.now();
    
    try {
      const response = await axios.get(app.deployUrl, { timeout: 10000 });
      const responseTime = Date.now() - start;
      
      await prisma.deployedApp.update({
        where: { id: app.id },
        data: {
          status: 'active',
          lastCheckAt: new Date(),
          avgResponseTime: Math.round((app.avgResponseTime + responseTime) / 2),
          totalRequests: { increment: 1 }
        }
      });
    } catch (error) {
      await prisma.deployedApp.update({
        where: { id: app.id },
        data: {
          status: 'down',
          lastCheckAt: new Date(),
          errorRate: { increment: 1 }
        }
      });
      
      // Alert user
      await this.alertDowntime(app);
    }
  }
  
  static async alertDowntime(app) {
    const project = await prisma.project.findUnique({
      where: { id: app.projectId },
      include: { user: true }
    });
    
    await prisma.notification.create({
      data: {
        userId: project.userId,
        title: '⚠️ App Down Alert',
        message: `Your app ${project.name} is not responding`,
        type: 'error',
        actionUrl: `/projects/${project.id}`
      }
    });
  }
}

// Run every 5 minutes
setInterval(() => {
  HealthMonitor.checkAllApps();
}, 5 * 60 * 1000);

module.exports = HealthMonitor;