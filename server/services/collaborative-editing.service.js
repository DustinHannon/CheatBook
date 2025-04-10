/**
 * Collaborative Editing Service
 * Simplified implementation for real-time collaborative editing
 */

const { logger } = require('../utils/logging/logger');
const throttle = require('lodash.throttle');
const { v4: uuidv4 } = require('uuid');

// In-memory store
const documents = new Map();
const activeUsers = new Map();
const cursorPositions = new Map();
const typingStatus = new Map();

/**
 * Get or create a document
 */
function getOrCreateDocument(noteId, initialContent = '') {
  if (!documents.has(noteId)) {
    documents.set(noteId, {
      id: noteId,
      content: initialContent,
      version: 1,
      users: new Set()
    });
  }
  return documents.get(noteId);
}

/**
 * Add a user to a document's active users
 */
function addUserToDocument(noteId, userId, userName) {
  const doc = getOrCreateDocument(noteId);
  doc.users.add(userId);
  
  // Track active users per document
  if (!activeUsers.has(noteId)) {
    activeUsers.set(noteId, new Map());
  }
  
  activeUsers.get(noteId).set(userId, {
    userId,
    userName,
    lastActive: new Date()
  });
  
  return Array.from(activeUsers.get(noteId).values());
}

/**
 * Remove a user from a document's active users
 */
function removeUserFromDocument(noteId, userId) {
  const doc = documents.get(noteId);
  if (doc) {
    doc.users.delete(userId);
    
    // Remove from active users
    if (activeUsers.has(noteId)) {
      activeUsers.get(noteId).delete(userId);
      
      // If no users left, consider removing the document from memory
      if (activeUsers.get(noteId).size === 0) {
        activeUsers.delete(noteId);
      }
    }
    
    // Remove cursor position
    if (cursorPositions.has(noteId)) {
      cursorPositions.get(noteId).delete(userId);
    }
    
    // Remove typing status
    if (typingStatus.has(noteId)) {
      typingStatus.get(noteId).delete(userId);
    }
  }
  
  return activeUsers.has(noteId) 
    ? Array.from(activeUsers.get(noteId).values()) 
    : [];
}

/**
 * Update a document
 */
function updateDocument(noteId, content, version) {
  const doc = getOrCreateDocument(noteId);
  
  // Simple version check
  if (version < doc.version) {
    return {
      success: false,
      conflict: true,
      currentVersion: doc.version,
      latestContent: doc.content
    };
  }
  
  // Update document
  doc.content = content;
  doc.version = version + 1;
  
  return {
    success: true,
    version: doc.version
  };
}

/**
 * Update cursor position
 */
function updateCursorPosition(noteId, userId, userName, position, selection) {
  if (!cursorPositions.has(noteId)) {
    cursorPositions.set(noteId, new Map());
  }
  
  cursorPositions.get(noteId).set(userId, {
    userId,
    userName,
    position,
    selection,
    timestamp: new Date()
  });
  
  return Array.from(cursorPositions.get(noteId).values());
}

/**
 * Update typing status
 */
function updateTypingStatus(noteId, userId, userName, isTyping, position) {
  if (!typingStatus.has(noteId)) {
    typingStatus.set(noteId, new Map());
  }
  
  if (isTyping) {
    typingStatus.get(noteId).set(userId, {
      userId,
      userName,
      position,
      timestamp: new Date()
    });
  } else {
    typingStatus.get(noteId).delete(userId);
  }
  
  return Array.from(typingStatus.get(noteId).values());
}

// Create a throttled version for cursor updates
const throttledUpdateCursorPosition = throttle(updateCursorPosition, 50);

module.exports = {
  getOrCreateDocument,
  addUserToDocument,
  removeUserFromDocument,
  updateDocument,
  updateCursorPosition: throttledUpdateCursorPosition,
  updateTypingStatus
};
