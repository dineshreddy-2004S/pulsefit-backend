const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendRegistrationOTP, sendPasswordResetEmail } = require('../utils/emailService');

// 1. Send OTP for Registration
const sendRegistrationOtp = async (req, res) => {
  const { email, name } = req.body;
  if (!email) return res.status(400).json({ message: 'Email address is required.' });

  try {
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await pool.query('DELETE FROM email_verifications WHERE email = ?', [email]);
    await pool.query(
      'INSERT INTO email_verifications (email, otp, expires_at) VALUES (?, ?, ?)',
      [email, otp, expiresAt]
    );

    await sendRegistrationOTP(email, otp, name);
    res.json({ message: 'Verification OTP has been sent to your email.' });
  } catch (error) {
    console.error('Error sending registration OTP:', error);
    res.status(500).json({ message: 'Failed to send verification email.' });
  }
};

// 2. Complete Registration after OTP Verification
const registerWithOtp = async (req, res) => {
  const { 
    name, email, password, role, phone, otp,
    gym_name, gym_logo, gym_address, city, state, pincode, gst_number 
  } = req.body;

  if (!email || !otp || !password || !name) {
    return res.status(400).json({ message: 'All required fields and OTP must be provided.' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT id FROM email_verifications WHERE email = ? AND otp = ? AND expires_at > NOW()',
      [email, otp]
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired OTP code.' });
    }

    await pool.query('DELETE FROM email_verifications WHERE email = ?', [email]);

    const hashedPassword = await bcrypt.hash(password, 12);
    const assignedRole = role && ['GYM_OWNER', 'TRAINER', 'STAFF'].includes(role) ? role : 'GYM_OWNER';

    // Storing ONLY hashedPassword (no plain_password)
    await pool.query(
      `INSERT INTO users (
        name, email, password, role, status, 
        phone, gym_name, gym_logo, gym_address, city, state, pincode, gst_number
      ) VALUES (?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, email, hashedPassword, assignedRole,
        phone || null,
        assignedRole === 'GYM_OWNER' ? (gym_name || 'Pulse Fit Club') : null,
        assignedRole === 'GYM_OWNER' ? (gym_logo || null) : null,
        assignedRole === 'GYM_OWNER' ? (gym_address || null) : null,
        assignedRole === 'GYM_OWNER' ? (city || null) : null,
        assignedRole === 'GYM_OWNER' ? (state || null) : null,
        assignedRole === 'GYM_OWNER' ? (pincode || null) : null,
        assignedRole === 'GYM_OWNER' ? (gst_number || null) : null
      ]
    );

    res.status(201).json({ message: 'Account registered! Awaiting Super Admin approval.' });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ message: error.message });
  }
};

// 3. Login
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    const user = users[0];

    if (user.status !== 'APPROVED') {
      return res.status(403).json({ message: 'Account is pending approval from Administrator.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    let facilityName = user.gym_name || (user.role === 'ADMIN' ? 'HQ Admin' : 'Pulse Fit Facility');
    let facilityLogo = user.gym_logo || null;
    let ownerName = user.name;

    if (user.gym_owner_id) {
      const [ownerRows] = await pool.query('SELECT name, gym_name, gym_logo FROM users WHERE id = ?', [user.gym_owner_id]);
      if (ownerRows.length > 0) {
        facilityName = ownerRows[0].gym_name || facilityName;
        facilityLogo = ownerRows[0].gym_logo || facilityLogo;
        ownerName = ownerRows[0].name || ownerName;
      }
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        gym_owner_id: user.gym_owner_id
      },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone || '',
        gym_owner_id: user.gym_owner_id,
        gym_name: facilityName,
        gym_logo: facilityLogo,
        gym_owner_name: ownerName
      }
    });
  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({ message: 'Authentication error.' });
  }
};

// 4. Current Profile
const getProfile = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Unauthorized session' });
    }

    const [users] = await pool.query(
      'SELECT id, name, email, role, status, phone, gym_name, gym_logo, gym_owner_id FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = users[0];
    let facilityName = user.gym_name || (user.role === 'ADMIN' ? 'HQ Admin' : 'Pulse Fit Facility');
    let facilityLogo = user.gym_logo || null;
    let ownerName = user.name;

    if (user.gym_owner_id) {
      const [ownerRows] = await pool.query('SELECT name, gym_name, gym_logo FROM users WHERE id = ?', [user.gym_owner_id]);
      if (ownerRows.length > 0) {
        facilityName = ownerRows[0].gym_name || facilityName;
        facilityLogo = ownerRows[0].gym_logo || facilityLogo;
        ownerName = ownerRows[0].name || ownerName;
      }
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      phone: user.phone || '',
      gym_owner_id: user.gym_owner_id || null,
      gym_name: facilityName,
      gym_logo: facilityLogo,
      gym_owner_name: ownerName
    });
  } catch (error) {
    console.error('Error in getProfile:', error);
    res.status(500).json({ message: error.message });
  }
};

// 5. Send Reset Link
const forgotPasswordWithLink = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email address is required.' });

  try {
    const [users] = await pool.query('SELECT id, name, email, status FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      // Return 200/generic message to prevent email enumeration
      return res.json({ message: 'If an account exists with this email, a reset link has been dispatched.' });
    }

    const user = users[0];
    if (user.status !== 'APPROVED') {
      return res.status(403).json({ message: 'Account is pending approval or revoked.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await pool.query('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?', [token, expiresAt, user.id]);

    const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendBaseUrl}/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;

    await sendPasswordResetEmail(user.email, resetUrl, user.name);

    res.json({ message: 'If an account exists with this email, a reset link has been dispatched.' });
  } catch (error) {
    console.error('Error in forgotPasswordWithLink:', error);
    res.status(500).json({ message: 'Failed to process password reset request.' });
  }
};

// 6. Reset Password via Token
const resetPasswordWithToken = async (req, res) => {
  const { email, token, newPassword } = req.body;
  if (!email || !token || !newPassword) {
    return res.status(400).json({ message: 'Email, token, and new password are required.' });
  }

  try {
    const [users] = await pool.query(
      'SELECT id FROM users WHERE email = ? AND reset_token = ? AND reset_token_expires > NOW()',
      [email, token]
    );

    if (users.length === 0) {
      return res.status(400).json({ message: 'Password reset link is invalid or has expired.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await pool.query(
      'UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
      [hashedPassword, users[0].id]
    );

    res.json({ message: 'Password successfully updated! You may now sign in.' });
  } catch (error) {
    console.error('Error in resetPasswordWithToken:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  sendRegistrationOtp,
  registerWithOtp,
  login,
  getProfile,
  forgotPasswordWithLink,
  resetPasswordWithToken
};