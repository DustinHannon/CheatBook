/**
 * Email Service
 * Handles sending emails for authentication and notifications
 */

const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

// Create reusable transporter object using SMTP transport
let transporter;

// Set up the email transporter
if (process.env.NODE_ENV === 'production') {
  // For production, configure with real email service
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
} else {
  // For development, use a test account
  // You can also configure this to use services like Mailtrap for testing
  // Or use a custom SMTP development config
  console.log('Setting up development email service');
  transporter = nodemailer.createTransport({
    host: process.env.DEV_EMAIL_HOST || 'smtp.ethereal.email',
    port: process.env.DEV_EMAIL_PORT || 587,
    secure: process.env.DEV_EMAIL_SECURE === 'true',
    auth: {
      user: process.env.DEV_EMAIL_USER,
      pass: process.env.DEV_EMAIL_PASS
    }
  });
}

/**
 * Send login verification email
 * @param {string} email - Recipient email address
 * @param {string} code - Verification code
 * @returns {Promise<void>}
 */
async function sendLoginEmail(email, code) {
  // If no transporter is configured, log the code and return in development
  if (process.env.NODE_ENV !== 'production' && process.env.EMAIL_CONSOLE === 'true') {
    console.log(`
    =====================================================
    📧 Login Verification Code for ${email}: ${code}
    =====================================================
    `);
    return Promise.resolve();
  }

  const appName = process.env.APP_NAME || 'CheatBook';
  const appUrl = process.env.CLIENT_URL || 'http://localhost:3000';

  // Email content
  const mailOptions = {
    from: `${appName} <${process.env.EMAIL_FROM || 'noreply@cheatbook.app'}>`,
    to: email,
    subject: `Your ${appName} Login Code`,
    text: `Your verification code for ${appName} is: ${code}\n\nThis code will expire in 15 minutes.\n\nIf you didn't request this code, please ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
        <h2 style="color: #333;">Your Login Code</h2>
        <p>Here is your verification code for ${appName}:</p>
        <div style="background-color: #f6f6f6; padding: 15px; font-size: 24px; text-align: center; letter-spacing: 5px; font-weight: bold; margin: 20px 0; border-radius: 4px;">
          ${code}
        </div>
        <p>This code will expire in <strong>15 minutes</strong>.</p>
        <p>If you didn't request this code, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">
          &copy; ${new Date().getFullYear()} ${appName} | <a href="${appUrl}" style="color: #999; text-decoration: none;">Visit Website</a>
        </p>
      </div>
    `
  };

  // Send email
  return transporter.sendMail(mailOptions);
}

/**
 * Send a notification email about note sharing
 * @param {string} email - Recipient email address
 * @param {Object} data - Notification data (sharer name, note title, etc.)
 * @returns {Promise<void>}
 */
async function sendSharingNotification(email, data) {
  // Skip in development mode with console output enabled
  if (process.env.NODE_ENV !== 'production' && process.env.EMAIL_CONSOLE === 'true') {
    console.log(`
    =====================================================
    📧 Sharing Notification for ${email}:
    ${data.sharerName} shared "${data.noteTitle}" with you!
    Access at: ${data.noteUrl}
    =====================================================
    `);
    return Promise.resolve();
  }

  const appName = process.env.APP_NAME || 'CheatBook';
  const appUrl = process.env.CLIENT_URL || 'http://localhost:3000';

  // Email content
  const mailOptions = {
    from: `${appName} <${process.env.EMAIL_FROM || 'noreply@cheatbook.app'}>`,
    to: email,
    subject: `${data.sharerName} shared a note with you on ${appName}`,
    text: `${data.sharerName} has shared "${data.noteTitle}" with you on ${appName}.\n\nYou can access it here: ${data.noteUrl}\n\nThank you for using ${appName}!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
        <h2 style="color: #333;">Note Shared With You</h2>
        <p>${data.sharerName} has shared a note with you on ${appName}:</p>
        <div style="background-color: #f6f6f6; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <h3 style="margin-top: 0;">${data.noteTitle}</h3>
          <p>${data.noteExcerpt || 'Click the link below to view the note.'}</p>
        </div>
        <p>
          <a href="${data.noteUrl}" style="display: inline-block; background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin-top: 10px;">
            View Note
          </a>
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">
          &copy; ${new Date().getFullYear()} ${appName} | <a href="${appUrl}" style="color: #999; text-decoration: none;">Visit Website</a>
        </p>
      </div>
    `
  };

  // Send email
  return transporter.sendMail(mailOptions);
}

module.exports = {
  sendLoginEmail,
  sendSharingNotification
}; 