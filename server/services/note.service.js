/**
 * Note service
 * Handles data access and business logic for notes
 */

const { db } = require('../models/database');
const { logger } = require('../utils/logging/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Get note content by ID
 * @param {string} noteId - The note ID
 * @returns {Promise<Object|null>} - Note object or null if not found
 */
async function getNoteContent(noteId) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM notes WHERE id = ?',
      [noteId],
      (err, note) => {
        if (err) {
          logger.error(`Error retrieving note ${noteId}:`, err);
          return reject(err);
        }
        
        resolve(note || null);
      }
    );
  });
}

/**
 * Create a new note
 * @param {Object} noteData - Note data
 * @param {string} noteData.title - Note title
 * @param {string} noteData.content - Note content
 * @param {string} noteData.ownerId - Owner user ID
 * @param {string} [noteData.notebookId] - Notebook ID
 * @returns {Promise<Object>} - Created note object
 */
async function createNote(noteData) {
  const { title, content, ownerId, notebookId } = noteData;
  const id = uuidv4();
  
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO notes (id, title, content, owner_id, notebook_id) VALUES (?, ?, ?, ?, ?)',
      [id, title, content || '', ownerId, notebookId || null],
      function(err) {
        if (err) {
          logger.error('Error creating note:', err);
          return reject(err);
        }
        
        // Return the created note
        db.get(
          'SELECT * FROM notes WHERE id = ?',
          [id],
          (err, note) => {
            if (err) {
              logger.error('Error retrieving created note:', err);
              return reject(err);
            }
            
            logger.info(`Note created: ${id} by user ${ownerId}`);
            resolve(note);
          }
        );
      }
    );
  });
}

/**
 * Update note content
 * @param {string} noteId - Note ID
 * @param {Object} updates - Fields to update
 * @param {string} [updates.title] - New title
 * @param {string} [updates.content] - New content
 * @param {string} [updates.notebookId] - New notebook ID
 * @returns {Promise<Object>} - Updated note object
 */
async function updateNote(noteId, updates) {
  const fields = [];
  const values = [];
  
  // Add fields to update
  if (updates.title !== undefined) {
    fields.push('title = ?');
    values.push(updates.title);
  }
  
  if (updates.content !== undefined) {
    fields.push('content = ?');
    values.push(updates.content);
  }
  
  if (updates.notebookId !== undefined) {
    fields.push('notebook_id = ?');
    values.push(updates.notebookId);
  }
  
  if (fields.length === 0) {
    return getNoteContent(noteId);
  }
  
  // Add updated timestamp
  fields.push('updated_at = CURRENT_TIMESTAMP');
  
  // Add note ID to values
  values.push(noteId);
  
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE notes SET ${fields.join(', ')} WHERE id = ?`,
      values,
      function(err) {
        if (err) {
          logger.error(`Error updating note ${noteId}:`, err);
          return reject(err);
        }
        
        // Return the updated note
        db.get(
          'SELECT * FROM notes WHERE id = ?',
          [noteId],
          (err, note) => {
            if (err) {
              logger.error(`Error retrieving updated note ${noteId}:`, err);
              return reject(err);
            }
            
            if (!note) {
              return reject(new Error(`Note not found: ${noteId}`));
            }
            
            logger.info(`Note updated: ${noteId}`);
            resolve(note);
          }
        );
      }
    );
  });
}

/**
 * Delete a note
 * @param {string} noteId - Note ID
 * @returns {Promise<boolean>} - Whether the deletion was successful
 */
async function deleteNote(noteId) {
  return new Promise((resolve, reject) => {
    db.run(
      'DELETE FROM notes WHERE id = ?',
      [noteId],
      function(err) {
        if (err) {
          logger.error(`Error deleting note ${noteId}:`, err);
          return reject(err);
        }
        
        const success = this.changes > 0;
        
        if (success) {
          logger.info(`Note deleted: ${noteId}`);
        } else {
          logger.warn(`Note not found for deletion: ${noteId}`);
        }
        
        resolve(success);
      }
    );
  });
}

/**
 * Search notes by content or title
 * @param {string} userId - User ID (for permissions)
 * @param {string} query - Search query
 * @returns {Promise<Array>} - Matching notes
 */
async function searchNotes(userId, query) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT n.*, u.name as owner_name, nb.title as notebook_title
       FROM notes n
       JOIN users u ON n.owner_id = u.id
       LEFT JOIN notebooks nb ON n.notebook_id = nb.id
       WHERE 
         (n.owner_id = ? OR 
          (n.notebook_id IN (
            SELECT c.notebook_id 
            FROM collaborators c 
            WHERE c.user_id = ?
          )))
         AND (n.title LIKE ? OR n.content LIKE ?)
       ORDER BY n.updated_at DESC
       LIMIT 50`,
      [userId, userId, `%${query}%`, `%${query}%`],
      (err, results) => {
        if (err) {
          logger.error('Error searching notes:', err);
          return reject(err);
        }
        
        logger.debug(`Search results for '${query}': ${results.length} notes found`);
        resolve(results || []);
      }
    );
  });
}

module.exports = {
  getNoteContent,
  createNote,
  updateNote,
  deleteNote,
  searchNotes
};
