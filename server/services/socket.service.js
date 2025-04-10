/**
 * Socket.IO service
 * Handles real-time communication and collaboration features
 * Implements throttling and debouncing for performance optimization
 */

const { verifyToken } = require('../utils/auth.utils');
const { db } = require('../models/database');
const { logger } = require('../utils/logging/logger');
const collabService = require('./collaborative-editing.service');
const throttle = require('lodash.throttle');
const debounce = require('lodash.debounce');

// Track user details by socket ID
const userSockets = new Map();
// Track socket connections by user ID (for multiple devices)
const userConnections = new Map();
// Track disconnection timeouts for reconnection support
const disconnectionTimeouts = new Map();
// Reconnection window in milliseconds (30 seconds)
const RECONNECTION_WINDOW_MS = 30 * 1000;

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
        logger.warn('Socket connection attempt without token');
        return next(new Error('Authentication error: Token missing'));
      }
      
      // Verify JWT token
      const user = await verifyToken(token);
      if (!user) {
        logger.warn(`Invalid token used for socket connection: ${socket.id}`);
        return next(new Error('Authentication error: Invalid token'));
      }
      
      // Store user information in socket
      socket.user = user;
      
      // Store client info for debugging
      socket.clientInfo = {
        device: socket.handshake.headers['user-agent'],
        ip: socket.handshake.address,
        transport: socket.conn.transport.name
      };
      
      logger.info(`Socket authenticated: ${user.id} (${socket.id})`);
      return next();
    } catch (error) {
      logger.error('Socket authentication error:', error);
      return next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.user.id} (${socket.id})`);
    
    // Store socket information for the connected user
    userSockets.set(socket.id, {
      userId: socket.user.id,
      name: socket.user.name,
      email: socket.user.email,
      color: getRandomColor(socket.user.id),
      clientInfo: socket.clientInfo
    });
    
    // Track connections by user ID for multiple devices
    if (!userConnections.has(socket.user.id)) {
      userConnections.set(socket.user.id, new Set());
    }
    userConnections.get(socket.user.id).add(socket.id);
    
    // Clear any pending disconnection timeout for this user
    if (disconnectionTimeouts.has(socket.user.id)) {
      clearTimeout(disconnectionTimeouts.get(socket.user.id));
      disconnectionTimeouts.delete(socket.user.id);
      logger.info(`User ${socket.user.id} reconnected before timeout`);
    }

    // Handle joining a note editing session
    socket.on('join-note', async (noteId) => {
      try {
        // Check if user has permission to access this note
        const canAccess = await checkNoteAccess(socket.user.id, noteId);
        
        if (!canAccess) {
          logger.warn(`Access denied to note ${noteId} for user ${socket.user.id}`);
          socket.emit('error', { message: 'Access denied to this note' });
          return;
        }
        
        // Store current note ID in socket for cleanup on disconnect
        socket.currentNoteId = noteId;
        
        // Join the note's room
        socket.join(`note:${noteId}`);
        
        // Initialize collaborative editing document if not exists
        await initializeNoteDocument(noteId);
        
        // Join collaborative editing session with user data
        const sessionData = collabService.joinSession(noteId, socket.user.id, {
          name: socket.user.name,
          email: socket.user.email,
          color: userSockets.get(socket.id)?.color
        });
        
        // Get current document state
        const docState = collabService.getDocumentState(noteId);
        
        // Send current document version and state to the joining user
        socket.emit('note-state', {
          noteId,
          version: docState.version,
          content: docState.content,
          activeUsers: docState.activeUsers,
          cursors: docState.cursors,
          typing: docState.typing
        });
        
        // Notify all clients in the room about the updated user list
        io.to(`note:${noteId}`).emit('users-changed', docState.activeUsers);
        
        logger.info(`User ${socket.user.id} joined note ${noteId}`);
      } catch (error) {
        logger.error(`Error joining note ${noteId}:`, error);
        socket.emit('error', { message: 'Failed to join note: ' + error.message });
      }
    });

    // Handle leaving a note
    socket.on('leave-note', (noteId) => {
      handleUserLeaveNote(socket, noteId);
    });

    /**
     * Helper function to handle a user leaving a note
     * Used for both explicit leave-note events and disconnects
     */
    function handleUserLeaveNote(socket, noteId) {
      if (!noteId) return;
      
      socket.leave(`note:${noteId}`);
      
      // Leave collaborative editing session
      collabService.leaveSession(noteId, socket.user.id);
      
      // Check if user has other active connections to this note
      const hasOtherConnections = Array.from(userConnections.get(socket.user.id) || [])
        .some(socketId => {
          if (socketId === socket.id) return false;
          const otherSocket = io.sockets.sockets.get(socketId);
          return otherSocket && otherSocket.currentNoteId === noteId;
        });
      
      // If no other connections, fully remove the user
      if (!hasOtherConnections) {
        // Get updated document state
        const docState = collabService.getDocumentState(noteId);
        
        if (docState) {
          // Notify remaining users
          io.to(`note:${noteId}`).emit('users-changed', docState.activeUsers);
          io.to(`note:${noteId}`).emit('typing-updated', {
            noteId,
            users: docState.typing.map(userId => {
              const socketId = Array.from(userSockets.entries())
                .find(([, user]) => user.userId === userId)?.[0];
              const user = userSockets.get(socketId) || {};
              return {
                userId,
                userName: user.name || 'Unknown',
                color: user.color || getRandomColor(userId)
              };
            })
          });
        }
        
        // Check if no users remain in the note
        if (docState && docState.activeUsers.length === 0) {
          // Save the final state to database before cleanup
          saveNoteContent(noteId, docState.content, null)
            .then(() => {
              logger.info(`Saved final state of note ${noteId} before cleanup`);
            })
            .catch(err => {
              logger.error(`Error saving final state of note ${noteId}:`, err);
            });
          
          // Schedule cleanup after delay (in case users reconnect soon)
          setTimeout(() => {
            // Double-check no users have rejoined
            const currentState = collabService.getDocumentState(noteId);
            if (currentState && currentState.activeUsers.length === 0) {
              collabService.cleanupDocument(noteId);
              logger.info(`Cleaned up resources for note ${noteId}`);
            }
          }, RECONNECTION_WINDOW_MS);
        }
      }
      
      logger.info(`User ${socket.user.id} left note ${noteId}`);
    }

    /**
     * Initialize note document for collaborative editing
     * @param {string} noteId - Note ID
     */
    async function initializeNoteDocument(noteId) {
      // Check if document already initialized
      if (collabService.getDocumentState(noteId)) {
        return;
      }
      
      try {
        // Get note content from database
        const note = await getNoteContent(noteId);
        
        if (!note) {
          throw new Error(`Note not found: ${noteId}`);
        }
        
        // Initialize collaborative document
        collabService.initializeDocument(noteId, note.content || '');
      } catch (error) {
        logger.error(`Error initializing document ${noteId}:`, error);
        throw error;
      }
    }

    // Handle note content changes (real-time editing)
    socket.on('note-update', (data) => {
      const { noteId, operation, content, baseVersion, shouldSave } = data;
      
      if (!noteId) {
        socket.emit('error', { message: 'Note ID is required' });
        return;
      }
      
      try {
        // For operations-based updates (OT)
        if (operation) {
          // Ensure operation has a userId
          operation.userId = socket.user.id;
          
          // Apply operation with conflict resolution
          const result = collabService.applyOperation(
            noteId,
            operation,
            baseVersion || 0
          );
          
          // Send acknowledgment to the sender
          socket.emit('operation-applied', {
            noteId,
            version: result.version,
            conflicts: result.conflicts
          });
          
          // Broadcast the operation to other users
          socket.to(`note:${noteId}`).emit('remote-operation', {
            noteId,
            operation: result.operation,
            userId: socket.user.id,
            userName: socket.user.name,
            version: result.version,
            timestamp: new Date().toISOString()
          });
          
          // Handle save if requested
          if (shouldSave) {
            saveNoteContent(noteId, result.content, socket.user.id)
              .catch(err => logger.error('Error saving note:', err));
          }
        } 
        // For content-based updates (legacy/fallback)
        else if (content) {
          // Get document state
          const docState = collabService.getDocumentState(noteId);
          
          if (!docState) {
            socket.emit('error', { message: 'Document not found' });
            return;
          }
          
          // Handle version conflicts
          if (baseVersion && baseVersion < docState.version) {
            // Client is behind, send latest version
            socket.emit('version-conflict', {
              noteId,
              currentVersion: docState.version,
              latestContent: docState.content
            });
            return;
          }
          
          // Create a replace operation for the entire content
          // This is a simplification - real implementation would calculate the diff
          const operation = {
            type: 'replace',
            index: 0,
            length: docState.content.length,
            text: content,
            userId: socket.user.id
          };
          
          // Apply the operation
          const result = collabService.applyOperation(noteId, operation, docState.version);
          
          // Broadcast the changes to all other users in the room
          socket.to(`note:${noteId}`).emit('note-updated', {
            noteId,
            content: result.content,
            userId: socket.user.id,
            userName: socket.user.name,
            timestamp: new Date().toISOString(),
            version: result.version
          });
          
          // Handle save if requested
          if (shouldSave) {
            saveNoteContent(noteId, result.content, socket.user.id)
              .catch(err => logger.error('Error saving note:', err));
          }
        } else {
          socket.emit('error', { message: 'No content or operation provided' });
        }
      } catch (error) {
        logger.error(`Error handling note update for ${noteId}:`, error);
        socket.emit('error', { message: 'Failed to update note: ' + error.message });
      }
    });

    // Handle typing status updates (throttled)
    socket.on('typing-status', (data) => {
      const { noteId, isTyping } = data;
      
      if (!noteId) return;
      
      const typingStatus = collabService.updateTypingStatus(noteId, socket.user.id, isTyping);
      
      // Broadcast typing status to all users in the room
      io.to(`note:${noteId}`).emit('typing-updated', {
        noteId,
        users: typingStatus.map(userId => {
          const socketId = Array.from(userSockets.entries())
            .find(([, user]) => user.userId === userId)?.[0];
          const user = userSockets.get(socketId) || {};
          return {
            userId,
            userName: user.name || 'Unknown',
            color: user.color || getRandomColor(userId)
          };
        })
      });
    });

    // Handle cursor position updates for collaborative editing (throttled)
    socket.on('cursor-move', (data) => {
      const { noteId, position, selection } = data;
      
      if (!noteId) return;
      
      // Update user position in collaborative service
      const cursors = collabService.updateCursorPosition(noteId, socket.user.id, {
        position,
        selection,
        color: userSockets.get(socket.id)?.color || getRandomColor(socket.user.id)
      });
      
      // Broadcast to other users
      socket.to(`note:${noteId}`).emit('cursors-updated', {
        noteId,
        cursors: cursors.map(cursor => ({
          userId: cursor.userId,
          userName: (() => {
            const socketId = Array.from(userSockets.entries())
              .find(([, user]) => user.userId === cursor.userId)?.[0];
            return userSockets.get(socketId)?.name || 'Unknown';
          })(),
          position: cursor.position,
          color: cursor.position?.color || getRandomColor(cursor.userId)
        }))
      });
    });

    // Handle image upload notifications
    socket.on('image-upload-started', (data) => {
      const { noteId, imageId, filename, size } = data;
      
      if (!noteId || !imageId) {
        socket.emit('error', { message: 'Note ID and image ID are required' });
        return;
      }
      
      // Broadcast upload started to other users
      socket.to(`note:${noteId}`).emit('image-upload-progress', {
        noteId,
        imageId,
        userId: socket.user.id,
        userName: socket.user.name,
        color: userSockets.get(socket.id)?.color || getRandomColor(socket.user.id),
        filename,
        size,
        progress: 0,
        status: 'uploading'
      });
      
      logger.info(`Image upload started: ${imageId} in note ${noteId} by user ${socket.user.id}`);
    });

    // Handle image upload progress (throttled)
    const handleUploadProgress = throttle((socket, data) => {
      const { noteId, imageId, progress } = data;
      
      if (!noteId || !imageId) return;
      
      // Broadcast progress to other users
      socket.to(`note:${noteId}`).emit('image-upload-progress', {
        noteId,
        imageId,
        userId: socket.user.id,
        userName: socket.user.name,
        color: userSockets.get(socket.id)?.color || getRandomColor(socket.user.id),
        progress,
        status: 'uploading'
      });
    }, 300); // Throttle to max once per 300ms
    
    socket.on('image-upload-progress', (data) => {
      handleUploadProgress(socket, data);
    });

    // Handle image upload completion
    socket.on('image-upload-complete', (data) => {
      const { noteId, imageId, url, insertPosition } = data;
      
      if (!noteId || !imageId || !url) return;
      
      // Calculate upload time 
      logger.info(`Image upload completed: ${imageId} in note ${noteId}`);
      
      // Broadcast completion to other users with insert position
      socket.to(`note:${noteId}`).emit('image-upload-complete', {
        noteId,
        imageId,
        userId: socket.user.id,
        userName: socket.user.name,
        color: userSockets.get(socket.id)?.color || getRandomColor(socket.user.id),
        url,
        insertPosition,
        status: 'complete'
      });
      
      // Create an insert operation for the collaborative editor
      if (insertPosition !== undefined) {
        const docState = collabService.getDocumentState(noteId);
        if (docState) {
          const operation = {
            type: 'insert',
            index: insertPosition,
            text: `![Image](${url})`, // Markdown format image
            userId: socket.user.id
          };
          
          // Apply operation to collaborative document
          try {
            const result = collabService.applyOperation(
              noteId,
              operation,
              docState.version
            );
            
            // Don't broadcast again since we already sent the upload complete event
          } catch (error) {
            logger.error(`Error applying image insertion operation:`, error);
          }
        }
      }
    });
    
    // Handle image upload error
    socket.on('image-upload-error', (data) => {
      const { noteId, imageId, error } = data;
      
      if (!noteId || !imageId) return;
      
      // Broadcast error to other users
      socket.to(`note:${noteId}`).emit('image-upload-error', {
        noteId,
        imageId,
        userId: socket.user.id,
        userName: socket.user.name,
        error,
        status: 'error'
      });
      
      logger.error(`Image upload error: ${imageId} in note ${noteId}: ${error}`);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      const userData = userSockets.get(socket.id);
      if (userData) {
        // If user was in a note, handle leave
        if (socket.currentNoteId) {
          handleUserLeaveNote(socket, socket.currentNoteId);
        }
        
        // Remove from user connections
        if (userConnections.has(userData.userId)) {
          userConnections.get(userData.userId).delete(socket.id);
          if (userConnections.get(userData.userId).size === 0) {
            userConnections.delete(userData.userId);
            
            // Set a disconnection timeout
            disconnectionTimeouts.set(userData.userId, setTimeout(() => {
              // If the user hasn't reconnected after the window, consider them fully offline
              disconnectionTimeouts.delete(userData.userId);
              logger.info(`User ${userData.userId} considered fully offline`);
              
              // Additional cleanup if needed
            }, RECONNECTION_WINDOW_MS));
          }
        }
        
        // Remove user from socket tracking
        userSockets.delete(socket.id);
      }
      
      logger.info(`User disconnected: ${socket.id}`);
    });
    
    /**
     * Get note content from database
     * @param {string} noteId - Note ID
     * @returns {Promise<Object|null>} - Note object or null if not found
     */
    function getNoteContent(noteId) {
      return new Promise((resolve, reject) => {
        db.get(
          'SELECT id, title, content FROM notes WHERE id = ?',
          [noteId],
          (err, row) => {
            if (err) return reject(err);
            resolve(row || null);
          }
        );
      });
    }
  });
}

/**
 * Generate a random color for a user
 * The color will be consistent for the same user ID
 * @param {string} userId - User ID to generate color for
 * @returns {string} - CSS color string (hex)
 */
function getRandomColor(userId) {
  // Create a simple hash from the userId
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  
  // Use the hash to seed a color
  // Avoid too light/dark colors by limiting the range
  const h = Math.abs(hash % 360);
  const s = 70 + Math.abs((hash >> 8) % 30); // 70-100%
  const l = 35 + Math.abs((hash >> 16) % 15); // 35-50%
  
  return `hsl(${h}, ${s}%, ${l}%)`;
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
        logger.debug(`Note ${noteId} saved by user ${userId || 'system'}`);
        resolve();
      }
    );
  });
}

module.exports = {
  setupSocketHandlers
};
