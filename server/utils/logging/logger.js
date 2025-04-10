/**
 * Logger Utility
 * Configures centralized logging for the application
 * Using Winston for structured logging with multiple transports
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log formats
const formats = {
  // Console format with colors and timestamps
  console: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      return `[${timestamp}] ${level}: ${message}${metaString}`;
    })
  ),
  
  // File format with JSON structure for easier parsing
  file: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  )
};

// Configure daily rotate file transport for automated log rotation
const fileRotateTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'application-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: formats.file
});

// Configure separate error log file
const errorFileRotateTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d',
  level: 'error',
  format: formats.file
});

// Create Winston logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  defaultMeta: { 
    service: 'cheatbook-api',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: formats.console,
      // Only show debug in development
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
    }),
    // File transports for persisting logs
    fileRotateTransport,
    errorFileRotateTransport
  ],
  // Don't exit on unhandled exceptions
  exitOnError: false
});

// Create HTTP request logger middleware
const requestLogger = (req, res, next) => {
  // Skip logging for static assets and health checks
  if (
    req.path.startsWith('/uploads/') || 
    req.path.startsWith('/static/') ||
    req.path.startsWith('/favicon.ico') ||
    req.path === '/health'
  ) {
    return next();
  }
  
  const start = Date.now();
  
  // Log when the response is finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 500 ? 'error' : 
                    res.statusCode >= 400 ? 'warn' : 
                    'http';
    
    // Create log entry
    logger.log(logLevel, `${req.method} ${req.originalUrl || req.url} ${res.statusCode} ${duration}ms`, {
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userId: req.user?.id,
      userAgent: req.get('User-Agent')
    });
  });
  
  next();
};

// Log uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.stack || error.toString() });
  
  // In production, you might want to perform a graceful shutdown after logging
  if (process.env.NODE_ENV === 'production') {
    console.error('Uncaught exception, shutting down in 1 second...');
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  }
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection', { 
    reason: reason instanceof Error ? reason.stack : String(reason)
  });
});

// Export logger and middleware
module.exports = {
  logger,
  requestLogger
};
