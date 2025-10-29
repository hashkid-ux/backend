// backend/services/emailService.js
// Production Email Service with Nodemailer

const nodemailer = require('nodemailer');

let transporter = null;

// Initialize email transporter
const initializeTransporter = () => {
  if (transporter) return transporter;

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('⚠️  Email credentials not configured. Email notifications will be logged only.');
    return null;
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  console.log('✅ Email service initialized');
  return transporter;
};

const sendEmail = async (to, subject, html) => {
  const emailTransporter = initializeTransporter();

  if (!emailTransporter) {
    console.log(`📧 [EMAIL PREVIEW] To: ${to} | Subject: ${subject}`);
    return { preview: true };
  }

  try {
    const info = await emailTransporter.sendMail({
      from: `"Launch AI" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    });

    console.log(`✅ Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('❌ Email send failed:', error.message);
    throw error;
  }
};

class EmailService {
  static async sendWelcome(email, name, credits) {
    const subject = '🎉 Welcome to Launch AI!';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .credit-box { background: #e0f2ff; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
          .credit-box h2 { color: #667eea; margin: 0 0 10px 0; }
          .credit-box .credits { font-size: 36px; font-weight: bold; color: #667eea; }
          .features { list-style: none; padding: 0; }
          .features li { padding: 10px 0; padding-left: 30px; position: relative; }
          .features li:before { content: "✓"; position: absolute; left: 0; color: #667eea; font-weight: bold; font-size: 20px; }
          .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
          .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Launch AI, ${name}! 🚀</h1>
          </div>
          <div class="content">
            <p>You've successfully created your account!</p>
            
            <div class="credit-box">
              <h2>Your Free Trial</h2>
              <div class="credits">${credits} Free Builds</div>
              <p style="margin: 10px 0 0 0; color: #666;">Start building amazing apps right away!</p>
            </div>
            
            <h3 style="color: #333;">What You Can Build:</h3>
            <ul class="features">
              <li>Web Applications (React + Node.js)</li>
              <li>Mobile Apps (React Native)</li>
              <li>Discord & Telegram Bots</li>
              <li>Full-stack SaaS Products</li>
            </ul>
            
            <p style="margin-top: 30px;">Ready to start building?</p>
            <center>
              <a href="${process.env.FRONTEND_URL || 'https://anythingai.vercel.app'}" class="button">
                Start Building →
              </a>
            </center>
            
            <div class="footer">
              <p>Need help? Reply to this email or visit our documentation.</p>
              <p>Launch AI - Build • Deploy • Scale</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await sendEmail(email, subject, html);
      console.log(`📧 Welcome email sent to: ${email}`);
    } catch (error) {
      console.error(`Failed to send welcome email to ${email}:`, error.message);
    }
  }

  static async sendOTP(email, code, name, type) {
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

    const subject = titles[type] || 'Verification Code';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .code-box { background: #e0f2ff; padding: 30px; border-radius: 8px; margin: 30px 0; text-align: center; }
          .code { font-size: 48px; font-weight: bold; letter-spacing: 10px; color: #667eea; font-family: monospace; }
          .warning { background: #fee; padding: 15px; border-radius: 8px; margin: 20px 0; color: #c00; }
          .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${titles[type]}</h1>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>${messages[type]}</p>
            
            <div class="code-box">
              <p style="margin: 0 0 10px 0; color: #666;">Your verification code:</p>
              <div class="code">${code}</div>
            </div>
            
            <div class="warning">
              <strong>⏰ This code expires in 10 minutes</strong>
            </div>
            
            <div class="footer">
              <p>If you didn't request this code, please ignore this email.</p>
              <p>Launch AI - Build • Deploy • Scale</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await sendEmail(email, subject, html);
      console.log(`📧 OTP sent to: ${email}`);
    } catch (error) {
      console.error(`Failed to send OTP to ${email}:`, error.message);
    }
  }

  static async sendPaymentSuccess(email, name, planName, amount) {
    const subject = '✅ Payment Successful - Launch AI';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .details-box { background: #d1fae5; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Payment Successful! ✅</h1>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>Thank you for upgrading to <strong>${planName}</strong>!</p>
            
            <div class="details-box">
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
            
            <center>
              <a href="${process.env.FRONTEND_URL || 'https://anythingai.vercel.app'}/dashboard" class="button">
                Go to Dashboard →
              </a>
            </center>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await sendEmail(email, subject, html);
      console.log(`💳 Payment success email sent to: ${email}`);
    } catch (error) {
      console.error(`Failed to send payment email to ${email}:`, error.message);
    }
  }

  static async sendBuildComplete(email, name, projectName, downloadUrl) {
    const subject = `🎉 Your App "${projectName}" is Ready!`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Your App is Ready! 🎉</h1>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>Great news! Your AI-generated app <strong>"${projectName}"</strong> is complete and ready to download.</p>
            
            <center>
              <a href="${downloadUrl}" class="button">
                Download Your App →
              </a>
            </center>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await sendEmail(email, subject, html);
      console.log(`🎉 Build complete email sent to: ${email}`);
    } catch (error) {
      console.error(`Failed to send build complete email to ${email}:`, error.message);
    }
  }

  static async sendCreditsLow(email, name, remainingCredits) {
    const subject = '⚠️ Running Low on Credits - Launch AI';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .warning-box { background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
          .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Running Low on Credits ⚠️</h1>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>You have <strong>${remainingCredits} builds remaining</strong>.</p>
            
            <div class="warning-box">
              <h3 style="margin: 0 0 10px 0;">Upgrade Benefits:</h3>
              <ul style="margin: 10px 0;">
                <li>Unlimited builds</li>
                <li>Priority AI processing</li>
                <li>Advanced features</li>
                <li>Priority support</li>
              </ul>
            </div>
            
            <center>
              <a href="${process.env.FRONTEND_URL || 'https://anythingai.vercel.app'}/pricing" class="button">
                View Plans →
              </a>
            </center>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await sendEmail(email, subject, html);
      console.log(`⚠️  Low credits email sent to: ${email}`);
    } catch (error) {
      console.error(`Failed to send low credits email to ${email}:`, error.message);
    }
  }

  static async sendPasswordReset(email, name, resetToken) {
    const resetUrl = `${process.env.FRONTEND_URL || 'https://anythingai.vercel.app'}/reset-password?token=${resetToken}`;
    const subject = '🔐 Reset Your Password - Launch AI';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
          .warning { background: #fee; padding: 15px; border-radius: 8px; margin: 20px 0; color: #c00; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Reset Your Password</h1>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            
            <center>
              <a href="${resetUrl}" class="button">
                Reset Password →
              </a>
            </center>
            
            <div class="warning">
              <strong>⏰ This link expires in 1 hour</strong>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              If you didn't request a password reset, please ignore this email or contact support if you have concerns.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await sendEmail(email, subject, html);
      console.log(`🔐 Password reset email sent to: ${email}`);
    } catch (error) {
      console.error(`Failed to send password reset email to ${email}:`, error.message);
    }
  }

  static async sendPasswordResetSuccess(email, name) {
    const subject = '✅ Password Reset Successful - Launch AI';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .success-box { background: #d1fae5; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Successful ✅</h1>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>Your password has been successfully reset.</p>
            
            <div class="success-box">
              <p style="margin: 0;">✅ You can now login with your new password</p>
            </div>
            
            <center>
              <a href="${process.env.FRONTEND_URL || 'https://anythingai.vercel.app'}/login" class="button">
                Login Now →
              </a>
            </center>
            
            <p style="color: #c00; margin-top: 30px;">
              ⚠️ If you didn't reset your password, please contact support immediately.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await sendEmail(email, subject, html);
      console.log(`✅ Password reset success email sent to: ${email}`);
    } catch (error) {
      console.error(`Failed to send password reset success email to ${email}:`, error.message);
    }
  }

  static async sendSubscriptionCancelled(email, name, validUntil) {
    const subject = 'Subscription Cancelled - Launch AI';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .info-box { background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Subscription Cancelled</h1>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>Your subscription has been cancelled as requested.</p>
            
            <div class="info-box">
              <p style="margin: 0;">
                You can continue using your remaining credits until <strong>${validUntil}</strong>
              </p>
            </div>
            
            <p>We're sorry to see you go! If you change your mind, you can reactivate your subscription anytime.</p>
            
            <center>
              <a href="${process.env.FRONTEND_URL || 'https://anythingai.vercel.app'}/pricing" class="button">
                Reactivate Subscription →
              </a>
            </center>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              Have feedback? We'd love to hear why you cancelled: reply to this email
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await sendEmail(email, subject, html);
      console.log(`❌ Subscription cancelled email sent to: ${email}`);
    } catch (error) {
      console.error(`Failed to send subscription cancelled email to ${email}:`, error.message);
    }
  }
}

module.exports = EmailService;