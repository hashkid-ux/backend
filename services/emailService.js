// Simple email service using console for now
// In production, integrate SendGrid, Mailgun, or AWS SES

class EmailService {
  static async sendWelcomeEmail(user) {
    console.log('📧 Sending welcome email to:', user.email);
    
    const emailContent = {
      to: user.email,
      subject: '🎉 Welcome to Launch AI!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #6366F1;">Welcome to Launch AI, ${user.name}! 🚀</h1>
          <p>You've successfully created your account!</p>
          
          <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin: 0 0 10px 0;">Your Free Trial</h2>
            <p style="margin: 0; font-size: 24px; font-weight: bold; color: #6366F1;">
              ${user.credits} Free Builds
            </p>
          </div>
          
          <h3>What You Can Build:</h3>
          <ul>
            <li>Web Applications (React + Node.js)</li>
            <li>Mobile Apps (React Native)</li>
            <li>Discord & Telegram Bots</li>
            <li>Full-stack SaaS Products</li>
          </ul>
          
          <p>Ready to start?</p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" 
             style="display: inline-block; background: #6366F1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0;">
            Start Building →
          </a>
          
          <hr style="border: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #6b7280; font-size: 14px;">
            Need help? Reply to this email or visit our documentation.
          </p>
        </div>
      `
    };

    // In production, actually send email:
    // await sendgrid.send(emailContent);
    
    return emailContent;
  }

  static async sendPaymentConfirmation(user, plan, amount) {
    console.log('💳 Sending payment confirmation to:', user.email);
    
    return {
      to: user.email,
      subject: '✅ Payment Successful - Launch AI',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #10b981;">Payment Successful! ✅</h1>
          <p>Hi ${user.name},</p>
          <p>Thank you for upgrading to <strong>${plan}</strong>!</p>
          
          <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0;">Payment Details</h3>
            <p style="margin: 5px 0;"><strong>Plan:</strong> ${plan}</p>
            <p style="margin: 5px 0;"><strong>Amount:</strong> ${amount}</p>
            <p style="margin: 5px 0;"><strong>Status:</strong> Active</p>
          </div>
          
          <h3>What's Unlocked:</h3>
          <ul>
            <li>✅ Unlimited AI app builds</li>
            <li>✅ Priority support</li>
            <li>✅ Advanced features</li>
            <li>✅ Export source code</li>
          </ul>
          
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" 
             style="display: inline-block; background: #6366F1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0;">
            Go to Dashboard →
          </a>
        </div>
      `
    };
  }

  static async sendAppReadyNotification(user, projectName, downloadUrl) {
    console.log('🎉 Sending app ready notification to:', user.email);
    
    return {
      to: user.email,
      subject: `🎉 Your App "${projectName}" is Ready!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #6366F1;">Your App is Ready! 🎉</h1>
          <p>Hi ${user.name},</p>
          <p>Great news! Your AI-generated app <strong>"${projectName}"</strong> is complete and ready to download.</p>
          
          <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <h2 style="margin: 0 0 20px 0;">What's Included:</h2>
            <p>✅ React Frontend<br>
               ✅ Node.js Backend<br>
               ✅ PostgreSQL Database<br>
               ✅ Deployment Guides</p>
          </div>
          
          <a href="${downloadUrl}" 
             style="display: inline-block; background: #6366F1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0;">
            Download Your App →
          </a>
          
          <h3>Next Steps:</h3>
          <ol>
            <li>Download the ZIP file</li>
            <li>Extract and review the code</li>
            <li>Follow the deployment guide</li>
            <li>Launch your app! 🚀</li>
          </ol>
        </div>
      `
    };
  }

  static async sendLowCreditsWarning(user) {
    console.log('⚠️  Sending low credits warning to:', user.email);
    
    return {
      to: user.email,
      subject: '⚠️ Running Low on Credits - Launch AI',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #f59e0b;">Running Low on Credits ⚠️</h1>
          <p>Hi ${user.name},</p>
          <p>You have <strong>${user.credits} builds remaining</strong>.</p>
          
          <p>Don't let your momentum stop! Upgrade now to keep building amazing apps.</p>
          
          <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0;">Upgrade Benefits:</h3>
            <ul style="margin: 10px 0;">
              <li>Unlimited builds</li>
              <li>Priority AI processing</li>
              <li>Advanced features</li>
              <li>Priority support</li>
            </ul>
          </div>
          
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/pricing" 
             style="display: inline-block; background: #6366F1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0;">
            View Plans →
          </a>
        </div>
      `
    };
  }
}

module.exports = EmailService;