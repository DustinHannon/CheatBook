/**
 * Authentication middleware
 * Implements token authentication, CSRF protection, and security headers
 */

const { 
  verifyToken, 
  refreshAccessToken,
  generateAccessToken
} = require('../utils/auth.utils');
const { logger } = require('../utils/logging/logger');
const authConfig = require('../config/auth');
const { getUserById } = require('../utils/auth.utils');
const crypto = require('crypto');

/**
 * JWT authentication middleware
 * Validates JWT from Authorization header or cookies
 * Handles token refresh when needed
 */
const authenticateJWT = async (req, res, next) => {
  try {
    // Get access token from Authorization header or cookie
    let accessToken = extractToken(req);
    let refreshToken = req.cookies?.refreshToken;
    let user = null;
    
    if (!accessToken) {
      return res.status(401).json({ 
        message: 'Authentication required',
        code: 'auth_required'
      });
    }
    
    // First try to verify access token
    user = await verifyToken(accessToken, 'access');
    
    // If access token is invalid but we have a refresh token, try to refresh
    if (!user && refreshToken) {
      logger.info('Access token expired, attempting refresh');
      
      try {
        // Attempt to refresh the token
        const refreshResult = await refreshAccessToken(refreshToken);
        
        if (refreshResult) {
          // Set new access token in response
          setTokenCookie(res, 'accessToken', refreshResult.accessToken);
          
          // Try with the new access token
          user = await verifyToken(refreshResult.accessToken, 'access');
          
          // Update request for downstream handlers
          accessToken = refreshResult.accessToken;
        }
      } catch (refreshError) {
        logger.error('Error refreshing token:', refreshError);
        // Continue with null user - will return 401 below
      }
    }
    
    // Still no valid user after refresh attempt
    if (!user) {
      return res.status(401).json({ 
        message: 'Invalid or expired token. Please log in again.',
        code: 'token_invalid'
      });
    }
    
    // Validate CSRF token if enabled and method is not GET/HEAD
    if (authConfig.security.enableCsrf && 
        !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const csrfToken = req.headers[authConfig.security.csrfHeaderName.toLowerCase()];
      const cookieCsrfToken = req.cookies?.[authConfig.security.csrfCookieName];
      
      if (!csrfToken || !cookieCsrfToken || csrfToken !== cookieCsrfToken) {
        logger.warn(`CSRF token validation failed for user ${user.id}`);
        return res.status(403).json({ 
          message: 'CSRF token validation failed',
          code: 'csrf_error'
        });
      }
    }
    
    // Add full user info from database
    try {
      const userDetails = await getUserById(user.id);
      if (userDetails) {
        user = { ...user, ...userDetails };
      }
    } catch (error) {
      logger.error(`Error fetching user details for ${user.id}:`, error);
      // Continue with limited user info from token
    }
    
    // Set user and token in request
    req.user = user;
    req.token = accessToken;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(401).json({ 
      message: 'Authentication failed',
      code: 'auth_failed'
    });
  }
};

/**
 * Optional JWT authentication
 * Sets user info in request if token is present, but doesn't require it
 */
const optionalJWT = async (req, res, next) => {
  try {
    // Get token from Authorization header or cookie
    let accessToken = extractToken(req);
    
    if (accessToken) {
      // Verify token
      const user = await verifyToken(accessToken, 'access');
      
      if (user) {
        // Add full user info from database
        try {
          const userDetails = await getUserById(user.id);
          if (userDetails) {
            req.user = { ...user, ...userDetails };
          } else {
            req.user = user;
          }
        } catch (error) {
          logger.error(`Error fetching user details for ${user.id}:`, error);
          req.user = user;
        }
        
        req.token = accessToken;
      }
    }
    
    next();
  } catch (error) {
    // Just continue without setting user
    logger.debug('Optional authentication error:', error);
    next();
  }
};

/**
 * CSRF protection middleware
 * Generates and validates CSRF tokens for protection against CSRF attacks
 */
const csrfProtection = (req, res, next) => {
  // Skip CSRF for non-authenticated routes
  if (!req.user) {
    return next();
  }
  
  // Only generate new CSRF token if one doesn't exist
  if (!req.cookies?.[authConfig.security.csrfCookieName]) {
    const csrfToken = crypto.randomBytes(32).toString('hex');
    
    // Set CSRF token in cookie
    res.cookie(authConfig.security.csrfCookieName, csrfToken, {
      httpOnly: true,
      secure: authConfig.security.secureCookies,
      sameSite: authConfig.security.sameSite,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    
    // Also send in response header for client to use in subsequent requests
    res.setHeader(authConfig.security.csrfHeaderName, csrfToken);
  }
  
  next();
};

/**
 * Security headers middleware
 * Sets recommended security headers to protect against common attacks
 */
const securityHeaders = (req, res, next) => {
  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss:;"
  );
  
  // Prevent browsers from MIME-sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  
  // Enable XSS protection in browsers
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Don't include Referrer header when navigating to another site
  res.setHeader('Referrer-Policy', 'same-origin');
  
  next();
};

/**
 * Permissions middleware
 * Check if user has required permissions
 * @param {Array|string} requiredPermissions - Required permissions
 */
const checkPermission = (requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        message: 'Authentication required', 
        code: 'auth_required'
      });
    }
    
    const userPermissions = req.user.permissions || [];
    
    if (typeof requiredPermissions === 'string') {
      requiredPermissions = [requiredPermissions];
    }
    
    // Check if user has admin permission (bypass all checks)
    if (userPermissions.includes('admin')) {
      return next();
    }
    
    // Check if user has all required permissions
    const hasPermission = requiredPermissions.every(perm => 
      userPermissions.includes(perm)
    );
    
    if (!hasPermission) {
      logger.warn(`Permission denied for user ${req.user.id}: ${requiredPermissions.join(', ')}`);
      return res.status(403).json({ 
        message: 'You do not have permission to access this resource',
        code: 'permission_denied'
      });
    }
    
    next();
  };
};

/**
 * Utility to extract token from request
 * @param {Object} req - Express request object
 * @returns {string|null} - Token or null if not found
 */
function extractToken(req) {
  let token = null;
  
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }
  
  // Or check cookies
  if (!token && req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }
  
  return token;
}

/**
 * Set a token as an HTTP cookie
 * @param {Object} res - Express response object
 * @param {string} name - Cookie name
 * @param {string} token - Token value
 */
function setTokenCookie(res, name, token) {
  res.cookie(name, token, {
    httpOnly: true,
    secure: authConfig.security.secureCookies,
    sameSite: authConfig.security.sameSite,
    maxAge: name === 'refreshToken' 
      ? 7 * 24 * 60 * 60 * 1000  // 7 days for refresh token
      : 2 * 60 * 60 * 1000       // 2 hours for access token
  });
}

module.exports = {
  authenticateJWT,
  optionalJWT,
  csrfProtection,
  securityHeaders,
  checkPermission,
  setTokenCookie
};
