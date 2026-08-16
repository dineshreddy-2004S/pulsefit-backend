const nodemailer = require('nodemailer');
require('dotenv').config();

const cleanPassword = (process.env.SMTP_PASS || '').replace(/\s+/g, '');

// High-Performance Pooled Transporter
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // Direct SSL handshake (instant on cloud hosts)
  pool: true,   // Keeps connections open to eliminate handshake lag
  maxConnections: 5,
  maxMessages: 100,
  auth: {
    user: process.env.SMTP_USER,
    pass: cleanPassword
  },
  tls: {
    rejectUnauthorized: false // Prevents certificate renegotiation stalls
  }
});

// 1. Send Password Reset Link
const sendPasswordResetEmail = async (email, resetUrl, name) => {
  const mailOptions = {
    from: `"Pulse Fit System" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Pulse Fit - Reset Your Account Password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; background-color: #07090e; color: #ffffff; border-radius: 16px; border: 1px solid #ffffff15;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #00f2fe; margin: 0;">PULSE FIT</h1>
          <p style="color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">Password Recovery</p>
        </div>
        <p style="font-size: 14px; color: #cbd5e1;">Hello <strong>${name || 'User'}</strong>,</p>
        <p style="font-size: 14px; color: #94a3b8;">We received a request to reset your password. Click the secure link below to proceed:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background: linear-gradient(90deg, #00f2fe, #7928ca); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: bold; font-size: 14px; display: inline-block;">
            Reset Account Password
          </a>
        </div>
        <p style="font-size: 12px; color: #64748b;">Or copy this link:<br/><a href="${resetUrl}" style="color: #00f2fe; word-break: break-all;">${resetUrl}</a></p>
        <p style="font-size: 12px; color: #64748b; margin-top: 20px;">This link is valid for 1 hour.</p>
      </div>
    `
  };

  return transporter.sendMail(mailOptions);
};

// 2. Send Registration OTP
const sendRegistrationOTP = async (email, otp, name) => {
  const mailOptions = {
    from: `"Pulse Fit System" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Pulse Fit - Verify Your Email Address (Registration OTP)',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; background-color: #07090e; color: #ffffff; border-radius: 16px; border: 1px solid #ffffff15;">
        <h2 style="color: #00f2fe; text-align: center;">PULSE FIT REGISTRATION</h2>
        <p>Hello <strong>${name || 'Facility Partner'}</strong>,</p>
        <p>Your one-time verification code is:</p>
        <div style="background-color: #0b0f19; padding: 15px; border-radius: 12px; text-align: center; margin: 20px 0; border: 1px solid #00f2fe40;">
          <span style="font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #00f2fe; font-family: monospace;">${otp}</span>
        </div>
        <p style="font-size: 12px; color: #64748b;">Code expires in 10 minutes.</p>
      </div>
    `
  };

  return transporter.sendMail(mailOptions);
};

module.exports = {
  sendPasswordResetEmail,
  sendRegistrationOTP
};