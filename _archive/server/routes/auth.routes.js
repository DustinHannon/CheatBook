/**
 * Authentication routes
 * Handles user login, registration, and authentication
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { generateEmailCode, verifyEmailCode, generateToken } = require('../utils/auth.utils');
const { sendLoginEmail } = require('../services/email.service');
const router = express.Router();

/**
 * Request a login code
 * POST /api/auth/request-code
 */
router.post(
  '/request-code',
  [
    // Validate email
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail()
  ],
  async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;

    try {
      // Generate verification code
      const code = await generateEmailCode(email);
      
      // Send email with verification code
      await sendLoginEmail(email, code);
      
      res.status(200).json({
        message: 'Verification code sent to your email',
        email
      });
    } catch (error) {
      console.error('Error in login route:', error);
      res.status(500).json({
        message: 'Failed to send verification code',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * Verify login code and authenticate user
 * POST /api/auth/verify-code
 */
router.post(
  '/verify-code',
  [
    // Validate email and code
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail(),
    body('code')
      .isLength({ min: 6, max: 6 })
      .withMessage('Verification code must be 6 digits')
      .isNumeric()
      .withMessage('Verification code must contain only numbers')
  ],
  async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, code } = req.body;

    try {
      // Verify the code
      const user = await verifyEmailCode(email, code);
      
      if (!user) {
        return res.status(401).json({
          message: 'Invalid or expired verification code'
        });
      }
      
      // Generate JWT token
      const token = generateToken(user);
      
      // Set secure HTTP-only cookie with the token
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: 'strict'
      });
      
      res.status(200).json({
        message: 'Authentication successful',
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      });
    } catch (error) {
      console.error('Error in verify route:', error);
      res.status(500).json({
        message: 'Authentication failed',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * Get current authenticated user
 * GET /api/auth/me
 */
router.get('/me', (req, res) => {
  // The authenticateJWT middleware will have set req.user if token is valid
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  
  res.status(200).json({
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name
    }
  });
});

/**
 * Logout user
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  // Clear the authentication cookie
  res.clearCookie('token');
  res.status(200).json({ message: 'Logged out successfully' });
});

module.exports = router; 