/**
 * Note routes
 * Handles CRUD operations for notes and notebooks
 * Refactored to use controllers for better separation of concerns
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const noteController = require('../controllers/note.controller');
const notebookController = require('../controllers/notebook.controller');
const storageService = require('../services/storage.service');
const { 
  authenticateJWT, 
  csrfProtection, 
  securityHeaders 
} = require('../middleware/auth.middleware');
const { logger } = require('../utils/logging/logger');

const router = express.Router();

// Configure multer for file uploads
const imageUpload = storageService.configureMulter('images');

// Apply middleware for all routes
router.use(authenticateJWT);
router.use(csrfProtection);
router.use(securityHeaders);

// Validation middleware
const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));
    
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }
    
    return res.status(400).json({ 
      message: 'Validation error',
      errors: errors.array(),
      code: 'validation_error'
    });
  };
};

/**
 * Note routes
 */

// Get a specific note
router.get(
  '/:noteId', 
  validate([
    param('noteId').isString().notEmpty().withMessage('Note ID is required')
  ]),
  noteController.getNote
);

// Update a note
router.put(
  '/:noteId',
  validate([
    param('noteId').isString().notEmpty().withMessage('Note ID is required'),
    body('title')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Note title cannot be empty')
      .isLength({ max: 200 })
      .withMessage('Note title must be at most 200 characters'),
    body('content').optional(),
    body('notebookId').optional().isString()
  ]),
  noteController.updateNote
);

// Delete a note
router.delete(
  '/:noteId',
  validate([
    param('noteId').isString().notEmpty().withMessage('Note ID is required')
  ]),
  noteController.deleteNote
);

// Upload an image to a note
router.post(
  '/:noteId/images',
  validate([
    param('noteId').isString().notEmpty().withMessage('Note ID is required')
  ]),
  imageUpload.single('image'),
  (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({ 
        message: 'No image file uploaded or invalid file type',
        code: 'validation_error'
      });
    }
    next();
  },
  noteController.uploadImage
);

// Search notes
router.get(
  '/search',
  validate([
    query('query').notEmpty().withMessage('Search query is required')
  ]),
  noteController.searchNotes
);

// Get all notes for a notebook
router.get(
  '/notebooks/:notebookId/notes',
  validate([
    param('notebookId').isString().notEmpty().withMessage('Notebook ID is required')
  ]),
  noteController.getNotebookNotes
);

// Create a new note in a notebook
router.post(
  '/notebooks/:notebookId/notes',
  validate([
    param('notebookId').isString().notEmpty().withMessage('Notebook ID is required'),
    body('title')
      .trim()
      .notEmpty()
      .withMessage('Note title is required')
      .isLength({ max: 200 })
      .withMessage('Note title must be at most 200 characters'),
    body('content').optional()
  ]),
  noteController.createNote
);

/**
 * Error handling middleware
 */
router.use((err, req, res, next) => {
  logger.error('Note routes error:', err);
  
  // Handle multer errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        message: 'File too large. Maximum file size is 5MB',
        code: 'file_too_large'
      });
    }
    return res.status(400).json({ 
      message: `File upload error: ${err.message}`,
      code: 'file_upload_error'
    });
  }
  
  // Default error response
  res.status(500).json({ 
    message: 'An unexpected error occurred',
    code: 'server_error'
  });
});

module.exports = router;
