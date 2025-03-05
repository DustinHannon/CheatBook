/**
 * Authentication utilities
 * Handles JWT token generation and verification, email verification codes
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { db } = require('../models/database');
const { v4: uuidv4 } = require('uuid');

// JWT secret key - should be in environment variables in production
const JWT_SECRET = process.env.JWT_SECRET || 'cheatbook_jwt_secret';
// JWT expiry time (default: 7 days)
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';
// Max attempts before blocking for 30 minutes
const MAX_LOGIN_ATTEMPTS = 5;
// Time to block attempts (in minutes)
const BLOCK_TIME_MINUTES = 30;

/**
 * Generate a JWT token for a user
 * @param {Object} user - User object (id, email, etc.)
 * @returns {string} - JWT token
 */
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name || user.email.split('@')[0]
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

/**
 * Verify a JWT token
 * @param {string} token - JWT token to verify
 * @returns {Promise<Object|null>} - User data if valid, null if invalid
 */
async function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    console.error('Token verification error:', error.message);
    return null;
  }
}

/**
 * Check if email is blocked due to too many attempts
 * @param {string} email - User's email
 * @returns {Promise<boolean>} - Whether the email is blocked
 */
async function isEmailBlocked(email) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT COUNT(*) as attempts, MAX(created_at) as last_attempt FROM auth_codes WHERE email = ? AND created_at > datetime("now", ?)',
      [email, `-${BLOCK_TIME_MINUTES} minutes`],
      (err, row) => {
        if (err) return reject(err);
        
        if (row && row.attempts >= MAX_LOGIN_ATTEMPTS) {
          resolve(true);
        } else {
          resolve(false);
        }
      }
    );
  });
}

/**
 * Generate a verification code for email login
 * @param {string} email - User's email
 * @returns {Promise<string>} - The generated verification code
 */
async function generateEmailCode(email) {
  return new Promise(async (resolve, reject) => {
    try {
      // Check if email is blocked due to too many attempts
      const blocked = await isEmailBlocked(email);
      if (blocked) {
        return reject(new Error(`Too many login attempts. Please try again after ${BLOCK_TIME_MINUTES} minutes.`));
      }
      
      // Generate a 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const id = uuidv4();
      
      // Set expiry time (15 minutes from now)
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 15);
      
      // Delete any expired codes for this email
      db.run('DELETE FROM auth_codes WHERE email = ? AND expires_at < CURRENT_TIMESTAMP', [email], (err) => {
        if (err) {
          console.error('Error deleting expired auth codes:', err);
          // Continue anyway
        }
        
        // Insert new code
        db.run(
          'INSERT INTO auth_codes (id, email, code, expires_at) VALUES (?, ?, ?, ?)',
          [id, email, code, expiresAt.toISOString()],
          (err) => {
            if (err) return reject(err);
            resolve(code);
          }
        );
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Verify an email verification code
 * @param {string} email - User's email
 * @param {string} code - Verification code to check
 * @returns {Promise<boolean>} - Whether the code is valid
 */
async function verifyEmailCode(email, code) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM auth_codes WHERE email = ? AND code = ? AND expires_at > CURRENT_TIMESTAMP',
      [email, code],
      async (err, row) => {
        if (err) return reject(err);
        
        if (!row) {
          // Record the failed attempt
          db.run(
            'INSERT INTO auth_codes (id, email, code, expires_at) VALUES (?, ?, ?, ?)',
            [uuidv4(), email, 'failed', new Date(Date.now() - 1).toISOString()],
            (err) => {
              if (err) console.error('Failed to record failed attempt:', err);
            }
          );
          
          resolve(false);
          return;
        }
        
        // Valid code, delete it to prevent reuse
        db.run('DELETE FROM auth_codes WHERE id = ?', [row.id]);
        
        // Also delete any failed attempts for this email
        db.run('DELETE FROM auth_codes WHERE email = ? AND code = ?', [email, 'failed']);
        
        // Check if user exists, if not create a new user
        try {
          const user = await getOrCreateUser(email);
          resolve(user);
        } catch (error) {
          reject(error);
        }
      }
    );
  });
}

/**
 * Get existing user or create a new one
 * @param {string} email - User's email
 * @returns {Promise<Object>} - User object
 */
async function getOrCreateUser(email) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
      if (err) return reject(err);
      
      if (user) {
        // Update last login time
        db.run(
          'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
          [user.id],
          (err) => {
            if (err) console.error('Error updating last login:', err);
            // Return user even if update fails
            resolve(user);
          }
        );
      } else {
        // Create new user
        const id = uuidv4();
        const name = email.split('@')[0]; // Default name from email
        
        db.run(
          'INSERT INTO users (id, email, name, created_at, last_login) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
          [id, email, name],
          function(err) {
            if (err) return reject(err);
            
            resolve({
              id,
              email,
              name,
              created_at: new Date().toISOString(),
              last_login: new Date().toISOString()
            });
          }
        );
      }
    });
  });
}

module.exports = {
  generateToken,
  verifyToken,
  generateEmailCode,
  verifyEmailCode,
  isEmailBlocked
}; 