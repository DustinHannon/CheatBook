/**
 * Authentication utilities
 * Handles JWT token generation, verification, and refresh
 * Includes email verification code management with rate limiting
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { db } = require('../models/database');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('./logging/logger');

// Default verification settings if not provided in config
const EMAIL_CODE_EXPIRY = 15; // 15 minutes
const MAX_LOGIN_ATTEMPTS = 5;
const BLOCK_TIME_MINUTES = 30;
const CODE_LENGTH = 6;

// Extract JWT config values from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'cheatbook-dev-secret-key';
const JWT_ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRATION || '2h';
const JWT_REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRATION || '7d';
const JWT_ALGORITHM = 'HS256';
const JWT_ISSUER = 'cheatbook-api';
const JWT_AUDIENCE = 'cheatbook-client';

/**
 * Generate an access token for a user
 * @param {Object} user - User object (id, email, etc.)
 * @returns {string} - JWT access token
 */
function generateAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name || user.email.split('@')[0],
      type: 'access'
    },
    JWT_SECRET,
    { 
      expiresIn: JWT_ACCESS_EXPIRES,
      algorithm: JWT_ALGORITHM,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE
    }
  );
}

/**
 * Generate a refresh token for a user
 * @param {Object} user - User object (id, email, etc.)
 * @returns {string} - JWT refresh token
 */
function generateRefreshToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      type: 'refresh',
      jti: uuidv4() // Unique token ID
    },
    JWT_SECRET,
    { 
      expiresIn: JWT_REFRESH_EXPIRES,
      algorithm: JWT_ALGORITHM,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE
    }
  );
}

/**
 * Generate tokens for a user (both access and refresh)
 * @param {Object} user - User object
 * @returns {Object} - Object containing both tokens and their expiry
 */
function generateTokens(user) {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  
  // Get token expiration times
  const decoded = jwt.decode(accessToken);
  const accessExpiry = decoded.exp * 1000; // Convert to milliseconds
  
  return {
    accessToken,
    refreshToken,
    expiresAt: new Date(accessExpiry).toISOString()
  };
}

/**
 * Store a refresh token in the database
 * @param {string} userId - User ID
 * @param {string} refreshToken - JWT refresh token
 * @param {string} userAgent - User agent string
 * @returns {Promise<void>}
 */
async function storeRefreshToken(userId, refreshToken, userAgent = 'unknown') {
  return new Promise((resolve, reject) => {
    const decoded = jwt.decode(refreshToken);
    const tokenId = decoded.jti;
    const expiresAt = new Date(decoded.exp * 1000).toISOString();
    
    db.run(
      'INSERT INTO refresh_tokens (id, user_id, token, expires_at, user_agent) VALUES (?, ?, ?, ?, ?)',
      [tokenId, userId, refreshToken, expiresAt, userAgent],
      (err) => {
        if (err) return reject(err);
        resolve();
      }
    );
  });
}

/**
 * Revoke a refresh token
 * @param {string} tokenId - Refresh token ID (jti)
 * @returns {Promise<boolean>} - Whether the token was found and revoked
 */
async function revokeRefreshToken(tokenId) {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE refresh_tokens SET revoked = 1, revoked_at = CURRENT_TIMESTAMP WHERE id = ?',
      [tokenId],
      function(err) {
        if (err) return reject(err);
        resolve(this.changes > 0);
      }
    );
  });
}

/**
 * Verify a JWT token
 * @param {string} token - JWT token to verify
 * @param {string} [type='access'] - Token type ('access' or 'refresh')
 * @returns {Promise<Object|null>} - Decoded token payload if valid, null if invalid
 */
async function verifyToken(token, type = 'access') {
  try {
    // Verify the token signature and expiration
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE
    });
    
    // Verify token type
    if (decoded.type !== type) {
      logger.warn(`Token type mismatch: expected ${type}, got ${decoded.type}`);
      return null;
    }
    
    // For refresh tokens, verify it hasn't been revoked
    if (type === 'refresh') {
      const isValid = await isRefreshTokenValid(decoded.jti);
      if (!isValid) {
        logger.warn(`Refresh token has been revoked: ${decoded.jti}`);
        return null;
      }
    }
    
    // Normalize the user ID field
    return {
      ...decoded,
      id: decoded.sub // Use 'id' for backward compatibility
    };
  } catch (error) {
    logger.warn(`Token verification error: ${error.message}`);
    return null;
  }
}

/**
 * Check if a refresh token is valid (not revoked)
 * @param {string} tokenId - Refresh token ID (jti)
 * @returns {Promise<boolean>} - Whether the token is valid
 */
async function isRefreshTokenValid(tokenId) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM refresh_tokens WHERE id = ? AND revoked = 0 AND expires_at > CURRENT_TIMESTAMP',
      [tokenId],
      (err, row) => {
        if (err) return reject(err);
        resolve(!!row);
      }
    );
  });
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
        if (err) {
          logger.error('Database error checking blocked email:', err);
          return reject(err);
        }
        
        if (row && row.attempts >= MAX_LOGIN_ATTEMPTS) {
          logger.warn(`Email ${email} blocked due to too many login attempts`);
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
      
      // Generate a 6-digit code (or configurable length)
      const min = Math.pow(10, CODE_LENGTH - 1);
      const max = Math.pow(10, CODE_LENGTH) - 1;
      const code = Math.floor(min + Math.random() * (max - min + 1)).toString();
      const id = uuidv4();
      
      // Set expiry time 
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + EMAIL_CODE_EXPIRY);
      
      // Delete any expired codes for this email
      db.run('DELETE FROM auth_codes WHERE email = ? AND expires_at < CURRENT_TIMESTAMP', [email], (err) => {
        if (err) {
          logger.error('Error deleting expired auth codes:', err);
          // Continue anyway
        }
        
        // Insert new code with improved hash storage for security
        const codeHash = hashVerificationCode(code);
        
        db.run(
          'INSERT INTO auth_codes (id, email, code_hash, expires_at) VALUES (?, ?, ?, ?)',
          [id, email, codeHash, expiresAt.toISOString()],
          (err) => {
            if (err) {
              logger.error('Error generating email code:', err);
              return reject(err);
            }
            
            logger.info(`Generated verification code for ${email}`);
            resolve(code);
          }
        );
      });
    } catch (error) {
      logger.error('Error in generateEmailCode:', error);
      reject(error);
    }
  });
}

/**
 * Hash a verification code for secure storage
 * @param {string} code - Verification code
 * @returns {string} - Hashed code
 */
function hashVerificationCode(code) {
  return crypto
    .createHash('sha256')
    .update(code + JWT_SECRET) // Use JWT secret as salt
    .digest('hex');
}

/**
 * Verify an email verification code
 * @param {string} email - User's email
 * @param {string} code - Verification code to check
 * @returns {Promise<Object|boolean>} - User object if valid, false if invalid
 */
async function verifyEmailCode(email, code) {
  return new Promise((resolve, reject) => {
    // Hash the provided code for comparison
    const codeHash = hashVerificationCode(code);
    
    db.get(
      'SELECT * FROM auth_codes WHERE email = ? AND code_hash = ? AND expires_at > CURRENT_TIMESTAMP',
      [email, codeHash],
      async (err, row) => {
        if (err) {
          logger.error('Database error verifying email code:', err);
          return reject(err);
        }
        
        if (!row) {
          logger.warn(`Invalid verification code attempt for ${email}`);
          
          // Record the failed attempt (store a failed value in the hash field)
          const failedId = uuidv4();
          const failedDate = new Date(Date.now() - 1).toISOString();
          
          db.run(
            'INSERT INTO auth_codes (id, email, code_hash, expires_at) VALUES (?, ?, ?, ?)',
            [failedId, email, 'failed_attempt', failedDate],
            (err) => {
              if (err) logger.error('Failed to record failed verification attempt:', err);
            }
          );
          
          resolve(false);
          return;
        }
        
        // Valid code, delete it to prevent reuse
        db.run('DELETE FROM auth_codes WHERE id = ?', [row.id], (err) => {
          if (err) logger.error('Error deleting used verification code:', err);
        });
        
        // Check if user exists, if not create a new user
        try {
          const user = await getOrCreateUser(email);
          logger.info(`User ${user.id} authenticated with email verification`);
          resolve(user);
        } catch (error) {
          logger.error('Error creating/retrieving user after code verification:', error);
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
      if (err) {
        logger.error('Database error retrieving user:', err);
        return reject(err);
      }
      
      if (user) {
        // Update last login time
        db.run(
          'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
          [user.id],
          (err) => {
            if (err) logger.error('Error updating last login:', err);
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
            if (err) {
              logger.error('Error creating new user:', err);
              return reject(err);
            }
            
            logger.info(`New user created: ${id} (${email})`);
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

/**
 * Refresh an access token using a refresh token
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<Object|null>} - New tokens or null if invalid
 */
async function refreshAccessToken(refreshToken) {
  try {
    // Verify the refresh token
    const decoded = await verifyToken(refreshToken, 'refresh');
    if (!decoded) {
      return null;
    }
    
    // Get the user
    const user = await getUserById(decoded.sub);
    if (!user) {
      logger.warn(`User not found for refresh token: ${decoded.sub}`);
      return null;
    }
    
    // Generate new access token
    const accessToken = generateAccessToken(user);
    
    // Get token expiration times
    const decodedAccess = jwt.decode(accessToken);
    const accessExpiry = decodedAccess.exp * 1000; // Convert to milliseconds
    
    return {
      accessToken,
      expiresAt: new Date(accessExpiry).toISOString()
    };
  } catch (error) {
    logger.error('Error refreshing access token:', error);
    return null;
  }
}

/**
 * Get a user by ID
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} - User object or null if not found
 */
async function getUserById(userId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
      if (err) {
        logger.error('Database error retrieving user by ID:', err);
        return reject(err);
      }
      resolve(user || null);
    });
  });
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateTokens,
  verifyToken,
  storeRefreshToken,
  revokeRefreshToken,
  refreshAccessToken,
  generateEmailCode,
  verifyEmailCode,
  isEmailBlocked,
  getUserById
};
