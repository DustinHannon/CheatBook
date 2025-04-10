/**
 * Authentication Configuration
 * Contains settings for JWT tokens, security, and rate limiting
 */

module.exports = {
  // JWT settings
  jwt: {
    // Secret key for signing tokens (use environment variable in production)
    secret: process.env.JWT_SECRET || 'cheatbook-development-secret-key',
    // Access token expiration (2 hours)
    accessTokenExpiration: process.env.JWT_ACCESS_EXPIRATION || '2h',
    // Refresh token expiration (7 days)
    refreshTokenExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
    // Algorithm used for signing
    algorithm: 'HS256',
    // Issuer claim
    issuer: 'cheatbook-api',
    // Audience claim
    audience: 'cheatbook-client'
  },
  
  // Security settings
  security: {
    // CORS origins (comma-separated list in environment variable)
    corsOrigins: process.env.CORS_ORIGINS ? 
      process.env.CORS_ORIGINS.split(',') : 
      ['http://localhost:3000', 'http://localhost:5000'],
    // Use secure cookies
    secureCookies: process.env.NODE_ENV === 'production',
    // SameSite cookie setting
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    // Enable CSRF protection
    enableCsrf: process.env.ENABLE_CSRF !== 'false',
    // CSRF token header name
    csrfHeaderName: 'X-CSRF-Token',
    // CSRF cookie name
    csrfCookieName: 'csrf-token',
    // Password requirements
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true
    },
    // Password hashing strength (higher is more secure but slower)
    bcryptRounds: 12
  },
  
  // Rate limiting settings
  rateLimit: {
    // Window in milliseconds (15 minutes)
    windowMs: 15 * 60 * 1000,
    // Maximum requests per window
    maxRequests: 100,
    // Message when rate limit is exceeded
    message: {
      status: 'error',
      message: 'Too many requests, please try again later.',
      code: 'rate_limit_exceeded'
    }
  },
  
  // Verification settings
  verification: {
    // Email verification token expiration (24 hours)
    emailTokenExpiration: '24h',
    // Password reset token expiration (1 hour)
    passwordResetTokenExpiration: '1h'
  },
  
  // Email verification settings (for new accounts or password resets)
  email: {
    // Whether to require email verification
    requireVerification: true,
    // From address for verification emails
    fromAddress: process.env.EMAIL_FROM || 'noreply@cheatbook.example.com',
    // Email verification URL template (client-side route that handles verification)
    verificationUrl: process.env.VERIFICATION_URL || 'http://localhost:3000/verify?token={token}',
    // Password reset URL template
    passwordResetUrl: process.env.PASSWORD_RESET_URL || 'http://localhost:3000/reset-password?token={token}'
  },
  
  // Session management
  sessions: {
    // Maximum number of concurrent sessions per user
    maxConcurrentSessions: 5,
    // Whether to invalidate other sessions on password change
    invalidateOnPasswordChange: true
  }
};
