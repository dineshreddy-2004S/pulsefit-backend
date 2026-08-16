require('dotenv').config();

// Helper for strict dd/mm/yyyy date formatting
const formatEmailDate = (dateVal) => {
  if (!dateVal) return '—';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return dateVal;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

// Core HTTP Email Dispatcher using Node.js Native fetch
const sendViaHttpApi = async ({ toEmail, toName, subject, htmlContent, senderName }) => {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.SMTP_USER;

  if (!apiKey) {
    throw new Error('BREVO_API_KEY is not configured in environment variables.');
  }

  const payload = {
    sender: {
      name: senderName || 'Pulse Fit Hub',
      email: senderEmail
    },
    to: [
      {
        email: toEmail,
        name: toName || 'Valued Member'
      }
    ],
    subject: subject,
    htmlContent: htmlContent
  };

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Email delivery failed with status ${response.status}`);
  }

  return await response.json();
};

// 1. Send Due Payment Reminder Email
const sendDueReminderEmail = async ({
  memberEmail,
  memberName,
  gymName,
  gymPhone,
  planType,
  totalAmount,
  amountPaid,
  balanceDue,
  expiryDate
}) => {
  const facility = gymName || 'Pulse Fit Hub';
  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: auto; padding: 25px; background-color: #07090E; color: #ffffff; border-radius: 20px; border: 1px solid rgba(255,255,255,0.15);">
      
      <!-- Header -->
      <div style="text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 20px; margin-bottom: 20px;">
        <h1 style="color: #00F2FE; margin: 0; font-size: 24px; letter-spacing: 1px;">${facility.toUpperCase()}</h1>
        <p style="color: #94A3B8; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin-top: 4px;">Membership Fee Reminder</p>
      </div>

      <p style="font-size: 15px; color: #E2E8F0; margin-bottom: 10px;">Hello <strong>${memberName}</strong>,</p>
      <p style="font-size: 13px; color: #94A3B8; line-height: 1.6;">
        This is a friendly notification regarding your pending membership balance at <strong>${facility}</strong>. Please find your active payment breakdown below:
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
        <p style="margin: 4px 0 0 0;">Thank you for training with ${facility}!</p>
      </div>

    </div>
  `;

  return await sendViaHttpApi({
    toEmail: memberEmail,
    toName: memberName,
    subject: `Payment Reminder: Pending Dues for ${facility}`,
    htmlContent: htmlContent,
    senderName: facility
  });
};

// 2. Send Registration OTP
const sendRegistrationOTP = async (email, otp, name) => {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; background-color: #07090E; color: #ffffff; border-radius: 16px; border: 1px solid rgba(255,255,255,0.15);">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #00F2FE; margin: 0; font-size: 24px;">PULSE FIT</h1>
        <p style="color: #94A3B8; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">Email Verification Code</p>
      </div>
      <p style="font-size: 14px; color: #CBD5E1;">Hello <strong>${name || 'Facility Partner'}</strong>,</p>
      <p style="font-size: 14px; color: #94A3B8;">Use the one-time verification code below to complete your Gym Owner registration:</p>
      <div style="background-color: #0B0F19; padding: 15px; border-radius: 12px; text-align: center; margin: 25px 0; border: 1px solid rgba(0, 242, 254, 0.4);">
        <span style="font-size: 30px; font-weight: bold; letter-spacing: 8px; color: #00F2FE; font-family: monospace;">${otp}</span>
      </div>
      <p style="font-size: 12px; color: #64748B;">This verification code expires in 10 minutes. If you did not request this, please ignore this email.</p>
    </div>
  `;

  return await sendViaHttpApi({
    toEmail: email,
    toName: name || 'Facility Partner',
    subject: 'Pulse Fit - Verify Your Email Address (Registration OTP)',
    htmlContent: htmlContent,
    senderName: 'Pulse Fit Verification'
  });
};

// 3. Send Forgot Password Reset Link
const sendPasswordResetEmail = async (email, resetUrl, name) => {
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; background-color: #07090E; color: #ffffff; border-radius: 16px; border: 1px solid rgba(255,255,255,0.15);">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #00F2FE; margin: 0; font-size: 24px;">PULSE FIT</h1>
        <p style="color: #94A3B8; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">Password Recovery</p>
      </div>
      <p style="font-size: 14px; color: #CBD5E1;">Hello <strong>${name || 'User'}</strong>,</p>
      <p style="font-size: 14px; color: #94A3B8;">We received a request to reset your password. Click the secure link below to proceed:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" style="background: linear-gradient(90deg, #00F2FE, #7928CA); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: bold; font-size: 14px; display: inline-block;">
          Reset Account Password
        </a>
      </div>
      <p style="font-size: 12px; color: #64748B;">Or copy this link to your browser:<br/><a href="${resetUrl}" style="color: #00F2FE; word-break: break-all;">${resetUrl}</a></p>
      <p style="font-size: 12px; color: #64748B; margin-top: 20px;">This link is valid for 1 hour. If you did not request this, your account remains secure.</p>
    </div>
  `;

  return await sendViaHttpApi({
    toEmail: email,
    toName: name || 'User',
    subject: 'Pulse Fit - Reset Your Account Password',
    htmlContent: htmlContent,
    senderName: 'Pulse Fit Security'
  });
};

module.exports = {
  sendDueReminderEmail,
  sendRegistrationOTP,
  sendPasswordResetEmail
};