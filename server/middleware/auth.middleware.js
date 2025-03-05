/**
 * Authentication middleware
 * Validates JWT tokens and sets user info in request
 */

const { verifyToken } = require('../utils/auth.utils');

/**
 * JWT authentication middleware
 * Validates JWT from Authorization header or cookies
 */
const authenticateJWT = async (req, res, next) => {
  try {
    // Get token from Authorization header or cookie
    let token = null;
    
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
    
    // Or check cookies
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    // Verify token
    const user = await verifyToken(token);
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    
    // Set user in request
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ message: 'Authentication failed' });
  }
};

/**
 * Optional JWT authentication
 * Sets user info in request if token is present, but doesn't require it
 */
const optionalJWT = async (req, res, next) => {
  try {
    // Get token from Authorization header or cookie
    let token = null;
    
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
    
    // Or check cookies
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    
    if (token) {
      // Verify token
      const user = await verifyToken(token);
      
      if (user) {
        // Set user in request
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Just continue without setting user
    next();
  }
};

module.exports = {
  authenticateJWT,
  optionalJWT
}; 