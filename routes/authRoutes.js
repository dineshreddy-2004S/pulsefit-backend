const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { 
  sendRegistrationOtp,
  registerWithOtp, 
  login, 
  getProfile, 
  forgotPasswordWithLink, 
  resetPasswordWithToken 
} = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/seed-admin', async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash('Admin@123', 10);
    await pool.query(
      `INSERT INTO users (name, email, password, plain_password, role, status) 
       VALUES (?, ?, ?, 'Admin@123', 'ADMIN', 'APPROVED') 
       ON DUPLICATE KEY UPDATE password = ?, plain_password = 'Admin@123', role = 'ADMIN', status = 'APPROVED'`,
      ['Super Admin', 'admin@gym.com', hashedPassword, hashedPassword]
    );
    res.send('✅ Super Admin ready! Email: admin@gym.com | Password: Admin@123');
  } catch (err) {
    res.status(500).send('❌ Error: ' + err.message);
  }
});

// Registration with OTP validation
router.post('/send-register-otp', sendRegistrationOtp);
router.post('/register', registerWithOtp);

// Login & Session
router.post('/login', login);
router.get('/me', verifyToken, getProfile);

// Password Reset Link Flow
router.post('/forgot-password', forgotPasswordWithLink);
router.post('/reset-password-token', resetPasswordWithToken);

module.exports = router;