/**
 * CheatBook Server
 * Main application server for the CheatBook note-taking app
 */

// Import required dependencies
const express = require('express');
const http = require('http');
const path = require('path');
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

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
  // Serve static files from the Next.js build
  app.use(express.static(path.join(__dirname, '../client/out')));
  
  // Handle all other routes, let Next.js handle routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/out/index.html'));
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