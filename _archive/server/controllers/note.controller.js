/**
 * Note Controller
 * Handles API requests related to notes and notebooks
 * Implements proper separation of concerns between routes and business logic
 */

const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { logger } = require('../utils/logging/logger');
const noteService = require('../services/note.service');
const storageService = require('../services/storage.service');
const { db } = require('../models/database');

/**
 * Get all notes for a notebook
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getNotebookNotes(req, res) {
  try {
    const { notebookId } = req.params;
    
    // Check if user has access to this notebook
    const hasAccess = await checkNotebookAccess(notebookId, req.user.id);
    if (!hasAccess) {
      return res.status(403).json({ 
        message: 'Access denied to this notebook',
        code: 'access_denied'
      });
    }
    
    // Get all notes from the notebook
    db.all(
      `SELECT n.*, u.name as owner_name 
       FROM notes n
       JOIN users u ON n.owner_id = u.id
       WHERE n.notebook_id = ?
       ORDER BY n.updated_at DESC`,
      [notebookId],
      (err, notes) => {
        if (err) {
          logger.error(`Database error retrieving notes for notebook ${notebookId}:`, err);
          return res.status(500).json({ 
            message: 'Failed to retrieve notes',
            code: 'db_error'
          });
        }
        
        res.json(notes || []);
      }
    );
  } catch (error) {
    logger.error('Error retrieving notebook notes:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve notes',
      code: 'server_error'
    });
  }
}

/**
 * Get a specific note
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getNote(req, res) {
  try {
    const { noteId } = req.params;
    
    // Check if user has access to this note
    const hasAccess = await checkNoteAccess(noteId, req.user.id);
    if (!hasAccess) {
      return res.status(403).json({ 
        message: 'Access denied to this note',
        code: 'access_denied'
      });
    }
    
    // Get the note with owner information
    db.get(
      `SELECT n.*, u.name as owner_name
       FROM notes n
       JOIN users u ON n.owner_id = u.id
       WHERE n.id = ?`,
      [noteId],
      (err, note) => {
        if (err) {
          logger.error(`Database error retrieving note ${noteId}:`, err);
          return res.status(500).json({ 
            message: 'Failed to retrieve note',
            code: 'db_error'
          });
        }
        
        if (!note) {
          return res.status(404).json({ 
            message: 'Note not found',
            code: 'not_found'
          });
        }
        
        // Get all images for the note
        db.all(
          'SELECT * FROM images WHERE note_id = ? ORDER BY created_at',
          [noteId],
          (err, images) => {
            if (err) {
              logger.error(`Database error retrieving note images for ${noteId}:`, err);
              return res.status(500).json({ 
                message: 'Failed to retrieve note images',
                code: 'db_error'
              });
            }
            
            // Return note with images
            res.json({
              ...note,
              images: images || []
            });
          }
        );
      }
    );
  } catch (error) {
    logger.error('Error retrieving note:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve note',
      code: 'server_error'
    });
  }
}

/**
 * Create a new note
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function createNote(req, res) {
  try {
    const { title, content, notebookId } = req.body;
    
    // Validate input
    if (!title || title.trim() === '') {
      return res.status(400).json({ 
        message: 'Note title is required',
        code: 'validation_error'
      });
    }
    
    // If notebook specified, check if user has write access
    if (notebookId) {
      const hasAccess = await checkNotebookWriteAccess(notebookId, req.user.id);
      if (!hasAccess) {
        return res.status(403).json({ 
          message: 'You do not have permission to create notes in this notebook',
          code: 'access_denied'
        });
      }
    }
    
    // Create the note
    const note = await noteService.createNote({
      title,
      content: content || '',
      ownerId: req.user.id,
      notebookId: notebookId || null
    });
    
    logger.info(`Note created: ${note.id} by user ${req.user.id}`);
    res.status(201).json(note);
  } catch (error) {
    logger.error('Error creating note:', error);
    res.status(500).json({ 
      message: 'Failed to create note',
      code: 'server_error'
    });
  }
}

/**
 * Update a note
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function updateNote(req, res) {
  try {
    const { noteId } = req.params;
    const { title, content, notebookId } = req.body;
    
    // Check if user has write access to the note
    const hasAccess = await checkNoteWriteAccess(noteId, req.user.id);
    if (!hasAccess) {
      return res.status(403).json({ 
        message: 'You do not have permission to update this note',
        code: 'access_denied'
      });
    }
    
    // If moving to a different notebook, check if user has write access to target notebook
    if (notebookId) {
      const currentNote = await noteService.getNoteContent(noteId);
      if (currentNote.notebook_id !== notebookId) {
        const hasNotebookAccess = await checkNotebookWriteAccess(notebookId, req.user.id);
        if (!hasNotebookAccess) {
          return res.status(403).json({ 
            message: 'You do not have permission to move notes to this notebook',
            code: 'access_denied'
          });
        }
      }
    }
    
    // Update the note
    const updates = {};
    
    if (title !== undefined) {
      if (title.trim() === '') {
        return res.status(400).json({ 
          message: 'Note title cannot be empty',
          code: 'validation_error'
        });
      }
      updates.title = title;
    }
    
    if (content !== undefined) {
      updates.content = content;
    }
    
    if (notebookId !== undefined) {
      updates.notebookId = notebookId;
    }
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ 
        message: 'No fields to update',
        code: 'validation_error'
      });
    }
    
    const updatedNote = await noteService.updateNote(noteId, updates);
    
    logger.info(`Note updated: ${noteId} by user ${req.user.id}`);
    res.json(updatedNote);
  } catch (error) {
    logger.error(`Error updating note ${req.params.noteId}:`, error);
    res.status(500).json({ 
      message: 'Failed to update note',
      code: 'server_error'
    });
  }
}

/**
 * Delete a note
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function deleteNote(req, res) {
  try {
    const { noteId } = req.params;
    
    // Check if user has permission to delete the note
    const hasAccess = await checkNoteDeleteAccess(noteId, req.user.id);
    if (!hasAccess) {
      return res.status(403).json({ 
        message: 'You do not have permission to delete this note',
        code: 'access_denied'
      });
    }
    
    // Get all images to delete files
    db.all(
      'SELECT * FROM images WHERE note_id = ?',
      [noteId],
      async (err, images) => {
        if (err) {
          logger.error(`Database error retrieving note images for deletion ${noteId}:`, err);
          return res.status(500).json({ 
            message: 'Failed to delete note images',
            code: 'db_error'
          });
        }
        
        // Delete the note (cascade will delete images from DB)
        const success = await noteService.deleteNote(noteId);
        
        if (!success) {
          return res.status(404).json({ 
            message: 'Note not found',
            code: 'not_found'
          });
        }
        
        // Delete image files
        if (images && images.length > 0) {
          for (const image of images) {
            try {
              const filePath = path.relative(process.cwd(), image.file_path);
              await storageService.deleteFile(filePath);
            } catch (error) {
              logger.error(`Error deleting image file ${image.file_path}:`, error);
              // Continue with other deletions
            }
          }
        }
        
        logger.info(`Note deleted: ${noteId} by user ${req.user.id}`);
        res.status(200).json({ 
          message: 'Note deleted successfully',
          code: 'success'
        });
      }
    );
  } catch (error) {
    logger.error(`Error deleting note ${req.params.noteId}:`, error);
    res.status(500).json({ 
      message: 'Failed to delete note',
      code: 'server_error'
    });
  }
}

/**
 * Upload an image to a note
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function uploadImage(req, res) {
  try {
    const { noteId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ 
        message: 'No image file uploaded',
        code: 'validation_error'
      });
    }
    
    // Check if user has write access to the note
    const hasAccess = await checkNoteWriteAccess(noteId, req.user.id);
    if (!hasAccess) {
      // Delete uploaded file
      try {
        await storageService.deleteFile(req.file.path);
      } catch (error) {
        logger.error('Error deleting unauthorized uploaded file:', error);
      }
      
      return res.status(403).json({ 
        message: 'You do not have permission to add images to this note',
        code: 'access_denied'
      });
    }
    
    // Process the uploaded file
    const uploadResult = await storageService.uploadFile(req.file, 'images');
    
    // Save image information in database
    const id = uuidv4();
    
    db.run(
      'INSERT INTO images (id, note_id, file_path, file_name, mime_type, size) VALUES (?, ?, ?, ?, ?, ?)',
      [id, noteId, uploadResult.filePath, uploadResult.fileName, uploadResult.mimeType, uploadResult.size],
      function(err) {
        if (err) {
          logger.error('Database error saving image information:', err);
          // Delete uploaded file on error
          try {
            storageService.deleteFile(uploadResult.filePath);
          } catch (fileErr) {
            logger.error('Error deleting file after database error:', fileErr);
          }
          
          return res.status(500).json({ 
            message: 'Failed to save image information',
            code: 'db_error'
          });
        }
        
        logger.info(`Image uploaded: ${id} for note ${noteId} by user ${req.user.id}`);
        
        // Return image information
        res.status(201).json({
          id,
          note_id: noteId,
          file_path: uploadResult.filePath,
          file_name: uploadResult.fileName,
          mime_type: uploadResult.mimeType,
          size: uploadResult.size,
          url: uploadResult.url
        });
      }
    );
  } catch (error) {
    logger.error(`Error uploading image to note ${req.params.noteId}:`, error);
    // Delete uploaded file on error
    if (req.file) {
      try {
        storageService.deleteFile(req.file.path);
      } catch (fileErr) {
        logger.error('Error deleting file after error:', fileErr);
      }
    }
    
    res.status(500).json({ 
      message: 'Failed to upload image',
      code: 'server_error'
    });
  }
}

/**
 * Search notes
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function searchNotes(req, res) {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ 
        message: 'Search query is required',
        code: 'validation_error'
      });
    }
    
    // Search notes the user has access to
    const results = await noteService.searchNotes(req.user.id, query);
    
    res.json(results);
  } catch (error) {
    logger.error('Error searching notes:', error);
    res.status(500).json({ 
      message: 'Failed to search notes',
      code: 'server_error'
    });
  }
}

/**
 * Check if user has access to a notebook
 * @param {string} notebookId - Notebook ID
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} - Whether the user has access
 */
async function checkNotebookAccess(notebookId, userId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM notebooks WHERE id = ? AND owner_id = ?
       UNION
       SELECT n.* FROM notebooks n
       JOIN collaborators c ON n.id = c.notebook_id
       WHERE n.id = ? AND c.user_id = ?`,
      [notebookId, userId, notebookId, userId],
      (err, notebook) => {
        if (err) return reject(err);
        resolve(!!notebook);
      }
    );
  });
}

/**
 * Check if user has write access to a notebook
 * @param {string} notebookId - Notebook ID
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} - Whether the user has write access
 */
async function checkNotebookWriteAccess(notebookId, userId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM notebooks WHERE id = ? AND owner_id = ?
       UNION
       SELECT n.* FROM notebooks n
       JOIN collaborators c ON n.id = c.notebook_id
       WHERE n.id = ? AND c.user_id = ? AND c.permission IN ('write', 'admin')`,
      [notebookId, userId, notebookId, userId],
      (err, notebook) => {
        if (err) return reject(err);
        resolve(!!notebook);
      }
    );
  });
}

/**
 * Check if user has access to a note
 * @param {string} noteId - Note ID
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} - Whether the user has access
 */
async function checkNoteAccess(noteId, userId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT n.* FROM notes n WHERE n.id = ? AND n.owner_id = ?
       
       UNION
       
       SELECT n.* FROM notes n
       JOIN notebooks nb ON n.notebook_id = nb.id
       JOIN collaborators c ON nb.id = c.notebook_id
       WHERE n.id = ? AND c.user_id = ?`,
      [noteId, userId, noteId, userId],
      (err, note) => {
        if (err) return reject(err);
        resolve(!!note);
      }
    );
  });
}

/**
 * Check if user has write access to a note
 * @param {string} noteId - Note ID
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} - Whether the user has write access
 */
async function checkNoteWriteAccess(noteId, userId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT n.* FROM notes n WHERE n.id = ? AND n.owner_id = ?
       
       UNION
       
       SELECT n.* FROM notes n
       JOIN notebooks nb ON n.notebook_id = nb.id
       JOIN collaborators c ON nb.id = c.notebook_id
       WHERE n.id = ? AND c.user_id = ? AND c.permission IN ('write', 'admin')`,
      [noteId, userId, noteId, userId],
      (err, note) => {
        if (err) return reject(err);
        resolve(!!note);
      }
    );
  });
}

/**
 * Check if user has permission to delete a note
 * @param {string} noteId - Note ID
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} - Whether the user has delete access
 */
async function checkNoteDeleteAccess(noteId, userId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT n.* FROM notes n WHERE n.id = ? AND n.owner_id = ?
       
       UNION
       
       SELECT n.* FROM notes n
       JOIN notebooks nb ON n.notebook_id = nb.id
       JOIN collaborators c ON nb.id = c.notebook_id
       WHERE n.id = ? AND c.user_id = ? AND c.permission = 'admin'`,
      [noteId, userId, noteId, userId],
      (err, note) => {
        if (err) return reject(err);
        resolve(!!note);
      }
    );
  });
}

module.exports = {
  getNotebookNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
  uploadImage,
  searchNotes
};
