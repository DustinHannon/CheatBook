/**
 * Socket.IO service
 * Handles real-time communication and collaboration features
 */

const { verifyToken } = require('../utils/auth.utils');
const { db } = require('../models/database');

// Track active users in each note/document
const activeUsers = new Map();
// Track user details by socket ID
const userSockets = new Map();
// Track collaborative editing versions for conflict resolution
const noteVersions = new Map();
// Track users currently typing in each note
const activeTyping = new Map();
// Track users currently uploading images to each note
const activeUploads = new Map();

/**
 * Set up all Socket.IO event handlers
 * @param {SocketIO.Server} io - The Socket.IO server instance
 */
function setupSocketHandlers(io) {
  // Socket.IO middleware for authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error: Token missing'));
      }
      
      // Verify JWT token
      const user = await verifyToken(token);
      if (!user) {
        return next(new Error('Authentication error: Invalid token'));
      }
      
      // Store user information in socket
      socket.user = user;
      return next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      return next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    
    // Store socket information for the connected user
    userSockets.set(socket.id, {
      userId: socket.user.id,
      name: socket.user.name,
      email: socket.user.email
    });

    // Handle joining a note editing session
    socket.on('join-note', async (noteId) => {
      try {
        // Check if user has permission to access this note
        const canAccess = await checkNoteAccess(socket.user.id, noteId);
        
        if (!canAccess) {
          socket.emit('error', { message: 'Access denied to this note' });
          return;
        }
        
        // Join the note's room
        socket.join(`note:${noteId}`);
        
        // Track active users in this note
        if (!activeUsers.has(noteId)) {
          activeUsers.set(noteId, new Set());
        }
        
        const users = activeUsers.get(noteId);
        users.add(socket.user.id);
        
        // Initialize version tracking for this note if not exists
        if (!noteVersions.has(noteId)) {
          noteVersions.set(noteId, {
            version: 1,
            lastContent: null,
            lastUpdate: new Date()
          });
        }
        
        // Initialize typing tracking for this note
        if (!activeTyping.has(noteId)) {
          activeTyping.set(noteId, new Map());
        }
        
        // Initialize upload tracking for this note
        if (!activeUploads.has(noteId)) {
          activeUploads.set(noteId, new Map());
        }
        
        // Send current document version to the joining user
        socket.emit('note-version', {
          noteId,
          version: noteVersions.get(noteId).version
        });
        
        // Notify all clients in the room about the updated user list
        const userList = await getUsersInNote(noteId);
        io.to(`note:${noteId}`).emit('users-changed', userList);
        
        console.log(`User ${socket.user.id} joined note ${noteId}`);
      } catch (error) {
        console.error(`Error joining note ${noteId}:`, error);
        socket.emit('error', { message: 'Failed to join note' });
      }
    });

    // Handle leaving a note
    socket.on('leave-note', (noteId) => {
      socket.leave(`note:${noteId}`);
      
      // Update active users
      if (activeUsers.has(noteId)) {
        const users = activeUsers.get(noteId);
        users.delete(socket.user.id);
        
        if (users.size === 0) {
          activeUsers.delete(noteId);
        }
      }
      
      // Notify remaining users
      io.to(`note:${noteId}`).emit('users-changed', 
        [...activeUsers.get(noteId) || []].map(userId => ({
          id: userId,
          name: userSockets.get([...userSockets.entries()]
            .find(([, user]) => user.userId === userId)?.[0])?.name || 'Unknown'
        }))
      );
      
      console.log(`User ${socket.user.id} left note ${noteId}`);
    });

    // Handle note content changes (real-time editing)
    socket.on('note-update', (data) => {
      const { noteId, content, localVersion } = data;
      
      // Get current version info
      const versionInfo = noteVersions.get(noteId);
      
      if (!versionInfo) {
        socket.emit('error', { message: 'Note version information not found' });
        return;
      }
      
      // Handle version conflicts
      if (localVersion && localVersion < versionInfo.version) {
        // Client is behind, send latest version
        socket.emit('version-conflict', {
          noteId,
          currentVersion: versionInfo.version,
          latestContent: versionInfo.lastContent
        });
        return;
      }
      
      // Update version info
      versionInfo.version += 1;
      versionInfo.lastContent = content;
      versionInfo.lastUpdate = new Date();
      
      // Broadcast the changes to all other users in the room
      socket.to(`note:${data.noteId}`).emit('note-updated', {
        noteId: data.noteId,
        content: data.content,
        userId: socket.user.id,
        userName: socket.user.name,
        timestamp: new Date().toISOString(),
        version: versionInfo.version
      });
      
      // Save the changes to the database (debounced on the client-side)
      if (data.shouldSave) {
        saveNoteContent(data.noteId, data.content, socket.user.id)
          .catch(err => console.error('Error saving note:', err));
      }
    });

    // Handle typing status updates
    socket.on('typing-status', (data) => {
      const { noteId, isTyping, position } = data;
      
      if (!activeTyping.has(noteId)) {
        activeTyping.set(noteId, new Map());
      }
      
      const typingUsers = activeTyping.get(noteId);
      
      if (isTyping) {
        typingUsers.set(socket.user.id, {
          userId: socket.user.id,
          userName: socket.user.name,
          position,
          timestamp: new Date()
        });
      } else {
        typingUsers.delete(socket.user.id);
      }
      
      // Broadcast typing status to other users
      socket.to(`note:${noteId}`).emit('typing-updated', {
        noteId,
        users: Array.from(typingUsers.values())
      });
    });

    // Handle cursor position updates for collaborative editing
    socket.on('cursor-move', (data) => {
      socket.to(`note:${data.noteId}`).emit('cursor-moved', {
        userId: socket.user.id,
        userName: socket.user.name,
        position: data.position,
        selection: data.selection // Add selection range info
      });
    });

    // Handle image uploads
    socket.on('image-upload-started', (data) => {
      const { noteId, imageId, filename, size } = data;
      
      if (!activeUploads.has(noteId)) {
        activeUploads.set(noteId, new Map());
      }
      
      const uploads = activeUploads.get(noteId);
      
      uploads.set(imageId, {
        userId: socket.user.id,
        userName: socket.user.name,
        filename,
        size,
        progress: 0,
        status: 'uploading',
        startTime: new Date()
      });
      
      // Broadcast upload started to other users
      socket.to(`note:${noteId}`).emit('image-upload-progress', {
        noteId,
        imageId,
        userId: socket.user.id,
        userName: socket.user.name,
        filename,
        size,
        progress: 0,
        status: 'uploading'
      });
    });

    // Handle image upload progress
    socket.on('image-upload-progress', (data) => {
      const { noteId, imageId, progress } = data;
      
      if (!activeUploads.has(noteId)) return;
      
      const uploads = activeUploads.get(noteId);
      const upload = uploads.get(imageId);
      
      if (!upload) return;
      
      upload.progress = progress;
      
      // Broadcast progress to other users
      socket.to(`note:${noteId}`).emit('image-upload-progress', {
        noteId,
        imageId,
        userId: socket.user.id,
        userName: socket.user.name,
        progress,
        status: 'uploading'
      });
    });

    // Handle image upload completion
    socket.on('image-upload-complete', (data) => {
      const { noteId, imageId, url, insertPosition } = data;
      
      if (!activeUploads.has(noteId)) return;
      
      const uploads = activeUploads.get(noteId);
      const upload = uploads.get(imageId);
      
      if (!upload) return;
      
      upload.status = 'complete';
      upload.progress = 100;
      upload.url = url;
      upload.completedAt = new Date();
      
      // Broadcast completion to other users with insert position
      socket.to(`note:${noteId}`).emit('image-upload-complete', {
        noteId,
        imageId,
        userId: socket.user.id,
        userName: socket.user.name,
        url,
        insertPosition,
        status: 'complete'
      });
      
      // Remove from tracking after a delay
      setTimeout(() => {
        if (activeUploads.has(noteId)) {
          const uploads = activeUploads.get(noteId);
          uploads.delete(imageId);
        }
      }, 60000); // Clean up after 1 minute
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      const userData = userSockets.get(socket.id);
      if (userData) {
        // Remove user from all active notes
        for (const [noteId, users] of activeUsers.entries()) {
          if (users.has(userData.userId)) {
            users.delete(userData.userId);
            
            // Remove from typing tracking
            if (activeTyping.has(noteId)) {
              activeTyping.get(noteId).delete(userData.userId);
            }
            
            // If no users left in the note, remove the note from tracking
            if (users.size === 0) {
              activeUsers.delete(noteId);
              noteVersions.delete(noteId);
              activeTyping.delete(noteId);
              
              // Only remove uploads if no users remain (uploads can be long-running)
              if (activeUploads.has(noteId) && 
                  activeUploads.get(noteId).size === 0) {
                activeUploads.delete(noteId);
              }
            } else {
              // Notify remaining users
              io.to(`note:${noteId}`).emit('users-changed', 
                [...users].map(userId => ({
                  id: userId,
                  name: userSockets.get([...userSockets.entries()]
                    .find(([, user]) => user.userId === userId)?.[0])?.name || 'Unknown'
                }))
              );
            }
          }
        }
        
        // Remove user from socket tracking
        userSockets.delete(socket.id);
      }
      
      console.log(`User disconnected: ${socket.id}`);
    });
  });
}

/**
 * Check if a user has access to a specific note
 * @param {string} userId - The user's ID
 * @param {string} noteId - The note's ID
 * @returns {Promise<boolean>} - Whether the user has access
 */
async function checkNoteAccess(userId, noteId) {
  return new Promise((resolve, reject) => {
    // First check if user is the owner of the note
    db.get(
      'SELECT id FROM notes WHERE id = ? AND owner_id = ?',
      [noteId, userId],
      (err, row) => {
        if (err) return reject(err);
        
        if (row) {
          // User is the owner
          return resolve(true);
        }
        
        // If not the owner, check if user is a collaborator on the notebook containing this note
        db.get(
          `SELECT c.notebook_id 
           FROM collaborators c
           JOIN notes n ON n.notebook_id = c.notebook_id
           WHERE n.id = ? AND c.user_id = ?`,
          [noteId, userId],
          (err, row) => {
            if (err) return reject(err);
            resolve(!!row); // Return true if user is a collaborator
          }
        );
      }
    );
  });
}

/**
 * Get list of users currently in a note
 * @param {string} noteId - The note's ID
 * @returns {Promise<Array>} - Array of user objects
 */
async function getUsersInNote(noteId) {
  if (!activeUsers.has(noteId)) {
    return [];
  }
  
  const userIds = [...activeUsers.get(noteId)];
  
  // Get user details from the database
  return new Promise((resolve, reject) => {
    const placeholders = userIds.map(() => '?').join(',');
    
    db.all(
      `SELECT id, name, email, avatar FROM users WHERE id IN (${placeholders || "''?"})`,
      userIds.length ? userIds : [''],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      }
    );
  });
}

/**
 * Save note content to the database
 * @param {string} noteId - The note's ID
 * @param {string} content - The note content
 * @param {string} userId - The user's ID who made the change
 * @returns {Promise<void>}
 */
async function saveNoteContent(noteId, content, userId) {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE notes SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [content, noteId],
      function(err) {
        if (err) return reject(err);
        resolve();
      }
    );
  });
}

module.exports = {
  setupSocketHandlers
}; 