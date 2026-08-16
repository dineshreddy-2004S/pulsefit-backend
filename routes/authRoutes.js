const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { 
  sendRegistrationOtp,
  registerWithOtp, 
  login, 
  getProfile, 
  forgotPasswordWithLink, 
  resetPasswordWithToken 
} = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');

// Limit OTP & Auth requests (Prevents spam and brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 attempts per IP
  message: { message: 'Too many requests from this IP. Please try again after 15 minutes.' }
});

const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Max 5 OTP requests per hour per IP
  message: { message: 'Too many OTP requests. Please wait an hour before requesting again.' }
});

// Registration & OTP
router.post('/send-register-otp', otpLimiter, sendRegistrationOtp);
router.post('/register', authLimiter, registerWithOtp);

// Login & Session
router.post('/login', authLimiter, login);
router.get('/me', verifyToken, getProfile);

// Password Reset Flow
router.post('/forgot-password', otpLimiter, forgotPasswordWithLink);
router.post('/reset-password-token', authLimiter, resetPasswordWithToken);

module.exports = router;