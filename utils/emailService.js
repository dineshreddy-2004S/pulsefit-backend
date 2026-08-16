const nodemailer = require('nodemailer');
require('dotenv').config();

const cleanPassword = (process.env.SMTP_PASS || '').replace(/\s+/g, '');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: cleanPassword
  }
});

// Helper for strict dd/mm/yyyy
const formatEmailDate = (dateVal) => {
  if (!dateVal) return '—';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return dateVal;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

// 1. Send Due Payment Reminder Email
const sendDueReminderEmail = async ({ memberEmail, memberName, gymName, gymPhone, planType, totalAmount, amountPaid, balanceDue, expiryDate }) => {
  const mailOptions = {
    from: `"${gymName || 'Pulse Fit Hub'}" <${process.env.SMTP_USER}>`,
    to: memberEmail,
    subject: `Payment Reminder: Pending Dues for ${gymName || 'Pulse Fit Hub'}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: auto; padding: 25px; background-color: #07090E; color: #ffffff; border-radius: 20px; border: 1px solid rgba(255,255,255,0.15);">
        
        <!-- Header -->
        <div style="text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 20px; margin-bottom: 20px;">
          <h1 style="color: #00F2FE; margin: 0; font-size: 24px; letter-spacing: 1px;">${gymName || 'PULSE FIT'}</h1>
          <p style="color: #94A3B8; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin-top: 4px;">Membership Fee Reminder</p>
        </div>

        <p style="font-size: 15px; color: #E2E8F0; margin-bottom: 10px;">Hello <strong>${memberName}</strong>,</p>
        <p style="font-size: 13px; color: #94A3B8; line-height: 1.6;">
          This is a friendly notification regarding your pending membership balance at <strong>${gymName || 'our fitness facility'}</strong>. Please find your active payment breakdown below:
        </p>

        <!-- Financial Summary Card -->
        <div style="background-color: #0B0F19; border: 1px solid rgba(0, 242, 254, 0.25); border-radius: 14px; padding: 18px; margin: 22px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);">
              <td style="padding: 8px 0; color: #94A3B8;">Membership Plan:</td>
              <td style="padding: 8px 0; text-align: right; color: #00F2FE; font-weight: bold;">${planType}</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);">
              <td style="padding: 8px 0; color: #94A3B8;">Total Agreed Fee:</td>
              <td style="padding: 8px 0; text-align: right; color: #ffffff; font-family: monospace;">₹${Number(totalAmount).toLocaleString('en-IN')}</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);">
              <td style="padding: 8px 0; color: #94A3B8;">Amount Paid:</td>
              <td style="padding: 8px 0; text-align: right; color: #10B981; font-weight: bold; font-family: monospace;">₹${Number(amountPaid).toLocaleString('en-IN')}</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);">
              <td style="padding: 8px 0; color: #F43F5E; font-weight: bold;">Outstanding Balance Due:</td>
              <td style="padding: 8px 0; text-align: right; color: #F43F5E; font-weight: bold; font-size: 16px; font-family: monospace;">₹${Number(balanceDue).toLocaleString('en-IN')}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #94A3B8;">Pass Expiration Date:</td>
              <td style="padding: 8px 0; text-align: right; color: #FBBF24; font-weight: bold;">${formatEmailDate(expiryDate)}</td>
            </tr>
          </table>
        </div>

        <p style="font-size: 12px; color: #94A3B8; line-height: 1.5;">
          Kindly settle the remaining balance of <strong style="color: #F43F5E;">₹${Number(balanceDue).toLocaleString('en-IN')}</strong> at the gym front desk or via UPI to maintain uninterrupted biometric/QR check-in access.
        </p>

        <!-- Footer -->
        <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px; margin-top: 25px; font-size: 11px; color: #64748B; text-align: center;">
          <p style="margin: 0;">Facility Desk Contact: <strong style="color: #CBD5E1;">${gymPhone || 'Gym Desk'}</strong></p>
          <p style="margin: 4px 0 0 0;">Thank you for training with ${gymName || 'Pulse Fit'}!</p>
        </div>

      </div>
    `
  };

  return await transporter.sendMail(mailOptions);
};

// 2. Registration OTP
const sendRegistrationOTP = async (email, otp, name) => {
  const mailOptions = {
    from: `"Pulse Fit Gym System" <${process.env.SMTP_USER}>`,
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
  return await transporter.sendMail(mailOptions);
};

// 3. Password Reset
const sendPasswordResetEmail = async (email, resetUrl, name) => {
  const mailOptions = {
    from: `"Pulse Fit Gym System" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Pulse Fit - Reset Your Account Password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; background-color: #07090e; color: #ffffff; border-radius: 16px; border: 1px solid #ffffff15;">
        <h2 style="color: #00f2fe; text-align: center;">PULSE FIT RECOVERY</h2>
        <p>Hello <strong>${name || 'User'}</strong>,</p>
        <p>Click below to reset your password:</p>
        <div style="text-align: center; margin: 25px 0;">
          <a href="${resetUrl}" style="background: linear-gradient(90deg, #00f2fe, #7928ca); color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: bold; display: inline-block;">Reset Password</a>
        </div>
        <p style="font-size: 11px; color: #64748b;">Link is valid for 1 hour.</p>
      </div>
    `
  };
  return await transporter.sendMail(mailOptions);
};

module.exports = {
  sendDueReminderEmail,
  sendRegistrationOTP,
  sendPasswordResetEmail
};