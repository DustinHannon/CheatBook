/**
 * Notebook routes
 * Handles CRUD operations for notebooks and collaborators
 * Refactored to use controllers for better separation of concerns
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const notebookController = require('../controllers/notebook.controller');
const { 
  authenticateJWT, 
  csrfProtection, 
  securityHeaders 
} = require('../middleware/auth.middleware');
const { logger } = require('../utils/logging/logger');

const router = express.Router();

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
 * Get all notebooks for the authenticated user
 * GET /api/notebooks
 */
router.get('/', notebookController.getNotebooks);

/**
 * Create a new notebook
 * POST /api/notebooks
 */
router.post(
  '/',
  validate([
    body('title')
      .trim()
      .notEmpty()
      .withMessage('Notebook title is required')
      .isLength({ max: 100 })
      .withMessage('Notebook title must be at most 100 characters'),
    body('description')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Description must be at most 500 characters')
  ]),
  notebookController.createNotebook
);

/**
 * Get a specific notebook
 * GET /api/notebooks/:notebookId
 */
router.get(
  '/:notebookId',
  validate([
    param('notebookId').isString().notEmpty().withMessage('Notebook ID is required')
  ]),
  notebookController.getNotebook
);

/**
 * Update a notebook
 * PUT /api/notebooks/:notebookId
 */
router.put(
  '/:notebookId',
  validate([
    param('notebookId').isString().notEmpty().withMessage('Notebook ID is required'),
    body('title')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Notebook title cannot be empty')
      .isLength({ max: 100 })
      .withMessage('Notebook title must be at most 100 characters'),
    body('description')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Description must be at most 500 characters')
  ]),
  notebookController.updateNotebook
);

/**
 * Delete a notebook
 * DELETE /api/notebooks/:notebookId
 */
router.delete(
  '/:notebookId',
  validate([
    param('notebookId').isString().notEmpty().withMessage('Notebook ID is required')
  ]),
  notebookController.deleteNotebook
);

/**
 * Add a collaborator to a notebook
 * POST /api/notebooks/:notebookId/collaborators
 */
router.post(
  '/:notebookId/collaborators',
  validate([
    param('notebookId').isString().notEmpty().withMessage('Notebook ID is required'),
    body('email')
      .trim()
      .isEmail()
      .withMessage('Valid email is required'),
    body('permission')
      .isIn(['read', 'write', 'admin'])
      .withMessage('Permission must be one of: read, write, admin')
  ]),
  notebookController.addCollaborator
);

/**
 * Remove a collaborator from a notebook
 * DELETE /api/notebooks/:notebookId/collaborators/:userId
 */
router.delete(
  '/:notebookId/collaborators/:userId',
  validate([
    param('notebookId').isString().notEmpty().withMessage('Notebook ID is required'),
    param('userId').isString().notEmpty().withMessage('User ID is required')
  ]),
  notebookController.removeCollaborator
);

/**
 * Error handling middleware
 */
router.use((err, req, res, next) => {
  logger.error('Notebook routes error:', err);
  
  // Default error response
  res.status(500).json({ 
    message: 'An unexpected error occurred',
    code: 'server_error'
  });
});

module.exports = router;
