// backend/services/emailService.js
// Complete Email Service with all methods

class EmailService {
  // Send welcome email
  static async sendWelcome(email, name, credits) {
    console.log(`📧 Sending welcome email to: ${email}`);
    
    const emailContent = {
      to: email,
      subject: '🎉 Welcome to Launch AI!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #6366F1;">Welcome to Launch AI, ${name}! 🚀</h1>
          <p>You've successfully created your account!</p>
          
          <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin: 0 0 10px 0;">Your Free Trial</h2>
            <p style="margin: 0; font-size: 24px; font-weight: bold; color: #6366F1;">
              ${credits} Free Builds
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

    // In production, integrate with SendGrid, Mailgun, or AWS SES:
    // const sgMail = require('@sendgrid/mail');
    // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    // await sgMail.send(emailContent);
    
    return emailContent;
  }

  // Send OTP email
  static async sendOTP(email, code, name, type) {
    console.log(`📧 Sending OTP to: ${email}`);
    
    const titles = {
      signup: 'Verify Your Email',
      login: 'Login Verification Code',
      reset: 'Password Reset Code'
    };

    const messages = {
      signup: 'Welcome! Please verify your email to complete registration.',
      login: 'Use this code to login to your account.',
      reset: 'Use this code to reset your password.'
    };

    const emailContent = {
      to: email,
      subject: titles[type] || 'Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #6366F1;">${titles[type]}</h1>
          <p>Hi ${name},</p>
          <p>${messages[type]}</p>
          
          <div style="background: #f0f9ff; padding: 30px; border-radius: 8px; margin: 30px 0; text-align: center;">
            <p style="margin: 0 0 10px 0; color: #6b7280;">Your verification code:</p>
            <h2 style="margin: 0; font-size: 48px; letter-spacing: 10px; color: #6366F1;">
              ${code}
            </h2>
          </div>
          
          <p style="color: #ef4444; font-weight: bold;">⏰ This code expires in 10 minutes</p>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            If you didn't request this code, please ignore this email.
          </p>
        </div>
      `
    };

    return emailContent;
  }

  // Send payment success email
  static async sendPaymentSuccess(email, name, planName, amount) {
    console.log(`💳 Sending payment confirmation to: ${email}`);
    
    const emailContent = {
      to: email,
      subject: '✅ Payment Successful - Launch AI',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #10b981;">Payment Successful! ✅</h1>
          <p>Hi ${name},</p>
          <p>Thank you for upgrading to <strong>${planName}</strong>!</p>
          
          <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0;">Payment Details</h3>
            <p style="margin: 5px 0;"><strong>Plan:</strong> ${planName}</p>
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

    return emailContent;
  }

  // Send build complete notification
  static async sendBuildComplete(email, name, projectName, downloadUrl) {
    console.log(`🎉 Sending build complete notification to: ${email}`);
    
    const emailContent = {
      to: email,
      subject: `🎉 Your App "${projectName}" is Ready!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #6366F1;">Your App is Ready! 🎉</h1>
          <p>Hi ${name},</p>
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

    return emailContent;
  }

  // Send low credits warning
  static async sendCreditsLow(email, name, remainingCredits) {
    console.log(`⚠️  Sending low credits warning to: ${email}`);
    
    const emailContent = {
      to: email,
      subject: '⚠️ Running Low on Credits - Launch AI',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #f59e0b;">Running Low on Credits ⚠️</h1>
          <p>Hi ${name},</p>
          <p>You have <strong>${remainingCredits} builds remaining</strong>.</p>
          
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

    return emailContent;
  }

  // Send password reset success
  static async sendPasswordResetSuccess(email, name) {
    console.log(`🔐 Sending password reset confirmation to: ${email}`);
    
    const emailContent = {
      to: email,
      subject: '✅ Password Reset Successful',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #10b981;">Password Reset Successful ✅</h1>
          <p>Hi ${name},</p>
          <p>Your password has been successfully reset.</p>
          
          <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;">✅ You can now login with your new password</p>
          </div>
          
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login" 
             style="display: inline-block; background: #6366F1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0;">
            Login Now →
          </a>
          
          <p style="color: #ef4444; margin-top: 30px;">
            ⚠️ If you didn't reset your password, please contact support immediately.
          </p>
        </div>
      `
    };

    return emailContent;
  }

  // Send subscription cancelled
  static async sendSubscriptionCancelled(email, name, validUntil) {
    console.log(`❌ Sending subscription cancelled notification to: ${email}`);
    
    const emailContent = {
      to: email,
      subject: 'Subscription Cancelled - Launch AI',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #f59e0b;">Subscription Cancelled</h1>
          <p>Hi ${name},</p>
          <p>Your subscription has been cancelled as requested.</p>
          
          <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;">
              You can continue using your remaining credits until <strong>${validUntil}</strong>
            </p>
          </div>
          
          <p>We're sorry to see you go! If you change your mind, you can reactivate your subscription anytime.</p>
          
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/pricing" 
             style="display: inline-block; background: #6366F1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0;">
            Reactivate Subscription →
          </a>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            Have feedback? We'd love to hear why you cancelled: reply to this email
          </p>
        </div>
      `
    };

    return emailContent;
  }
}

module.exports = EmailService;