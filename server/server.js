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

// For production deployment, serve Next.js static files
if (process.env.NODE_ENV === 'production') {
  // Check if the 'out' directory exists, if not use 'build'
  const clientDir = fs.existsSync(path.join(__dirname, '../client/out')) 
    ? path.join(__dirname, '../client/out') 
    : path.join(__dirname, '../client/.next');
  
  // Serve static files from the Next.js build
  app.use(express.static(clientDir));
  
  // Handle all other routes, let Next.js handle routing
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    
    const indexPath = path.join(clientDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      // For .next directory, let's use a middleware that renders the page
      res.status(404).send('Page not found. Make sure to build the Next.js app first.');
    }
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
