/**
 * CheatBook Server
 * Main application server for the CheatBook note-taking app
 */

// Import required dependencies
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const socketIO = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const { setupSocketHandlers } = require('./services/socket.service');
const authRoutes = require('./routes/auth.routes');
const noteRoutes = require('./routes/note.routes');
const userRoutes = require('./routes/user.routes');
const { initializeDatabase } = require('./models/database');
const { authenticateJWT, optionalJWT } = require('./middleware/auth.middleware');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Set up Socket.IO with CORS configuration
const io = socketIO(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Configure middlewares
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Static file serving for uploads
app.use('/uploads', express.static(uploadsDir));

// Initialize database
initializeDatabase();

// Apply the optional JWT middleware to all routes
// This will set req.user if a valid token is present, but not require authentication
app.use(optionalJWT);

// API routes
app.use('/api/auth', authRoutes);
// Protected routes - require authentication
app.use('/api/notes', authenticateJWT, noteRoutes);
app.use('/api/users', authenticateJWT, userRoutes);

// Serve Next.js static files (for both development and production)
// Next.js with output: 'export' creates static HTML in the 'out' directory
const clientOutDir = path.join(__dirname, '../client/out');
const clientNextDir = path.join(__dirname, '../client/.next');
const loginPath = '/login';

// Function to check if a request path should be public (accessible without auth)
const isPublicPath = (path) => {
  // Always allow API routes through, they handle their own auth
  if (path.startsWith('/api')) return true;
  
  // Public paths that don't require authentication
  return path === loginPath || 
         path.startsWith('/_next/') || 
         path.startsWith('/static/') ||
         path.endsWith('.js') ||
         path.endsWith('.css') ||
         path.endsWith('.ico') ||
         path.endsWith('.png') ||
         path.endsWith('.jpg') ||
         path.endsWith('.svg');
};

// Check if the client has been built
if (fs.existsSync(clientOutDir)) {
  console.log('Serving Next.js static files from out directory');
  
  // Serve static files from the Next.js build
  app.use(express.static(clientOutDir));
  
  // Handle all routes
  app.get('*', (req, res, next) => {
    // Let the API routes pass through to their handlers
    if (req.path.startsWith('/api')) {
      return next();
    }
    
    // For non-public paths, check for authentication
    if (!isPublicPath(req.path)) {
      // Skip auth check if user has a token (let client-side code handle it)
      if (!req.cookies.token) {
        // For the homepage specifically, which is protected
        if (req.path === '/') {
          console.log(`Serving error.html for unauthenticated homepage request`);
          // Show our custom error page
          const errorHtmlPath = path.join(clientOutDir, 'error.html');
          if (fs.existsSync(errorHtmlPath)) {
            return res.sendFile(errorHtmlPath);
          } else {
            // If error.html doesn't exist, redirect to login
            console.log(`Error.html not found, redirecting to login`);
            return res.redirect(loginPath);
          }
        }
        
        // For other protected paths, redirect to login
        console.log(`Redirecting unauthenticated request from ${req.path} to login`);
        return res.redirect(loginPath);
      }
      
      // If the path is root and we got here, the user has a token
      // We'll let the client-side code handle authentication validation
    }
    
    // Special case for favicon that doesn't exist
    if (req.path === '/favicon.ico') {
      return res.status(204).end(); // No content for favicon
    }
    
    // For the login page or authenticated users, serve the appropriate file
    let pagePath;
    
    // Handle route-specific paths
    if (req.path === '/' || req.path === '/login') {
      pagePath = path.join(clientOutDir, req.path === '/' ? 'index.html' : 'login.html');
    } else if (!req.path.includes('.')) {
      // For other routes without extensions
      pagePath = path.join(clientOutDir, req.path, 'index.html');
    } else {
      // For static assets
      pagePath = path.join(clientOutDir, req.path);
    }
    
    // Check for .next specific files
    if (req.path.startsWith('/_next/')) {
      pagePath = path.join(clientOutDir, req.path);
    }
    
    // Fallback to index.html
    const indexPath = path.join(clientOutDir, 'index.html');
    const loginHtmlPath = path.join(clientOutDir, 'login.html');
    
    console.log(`Attempt to serve: ${pagePath}`);
    
    if (fs.existsSync(pagePath)) {
      console.log(`Serving file: ${pagePath}`);
      res.sendFile(pagePath);
    } else if (req.path === '/login' && fs.existsSync(loginHtmlPath)) {
      console.log(`Serving login page: ${loginHtmlPath}`);
      res.sendFile(loginHtmlPath);
    } else if (fs.existsSync(indexPath)) {
      console.log(`Serving fallback index: ${indexPath}`);
      res.sendFile(indexPath);
    } else {
      console.log(`File not found: ${pagePath}`);
      res.status(404).send('Page not found. Make sure the Next.js app has been built with "npm run build".');
    }
  });
} else if (fs.existsSync(clientNextDir)) {
  console.log('Serving Next.js from .next directory');
  app.use(express.static(clientNextDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    if (!isPublicPath(req.path) && !req.cookies.token) {
      return res.redirect(loginPath);
    }
    res.status(200).send('Next.js server is configured to use output: "export". Run "npm run build" to generate static files.');
  });
} else {
  console.log('No Next.js build found. API endpoints will still work.');
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.status(404).send('Next.js build not found. Run "npm run build" to build the client.');
  });
}

// Set up Socket.IO event handlers
setupSocketHandlers(io);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = { app, server, io };
