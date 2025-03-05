/**
 * Note routes
 * Handles CRUD operations for notes and notebooks
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db } = require('../models/database');
const { authenticateJWT } = require('../middleware/auth.middleware');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with original extension
    const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// Set up multer upload
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

// Middleware for all note routes
router.use(authenticateJWT);

/**
 * Get all notebooks for the authenticated user
 * GET /api/notes/notebooks
 */
router.get('/notebooks', async (req, res) => {
  try {
    // Get all notebooks owned by the user
    db.all(
      `SELECT n.*, 
       (SELECT COUNT(*) FROM notes WHERE notebook_id = n.id) as note_count 
       FROM notebooks n 
       WHERE n.owner_id = ?
       ORDER BY n.updated_at DESC`,
      [req.user.id],
      (err, ownedNotebooks) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ message: 'Failed to retrieve notebooks' });
        }

        // Get all notebooks where user is a collaborator
        db.all(
          `SELECT n.*, c.permission,
           (SELECT COUNT(*) FROM notes WHERE notebook_id = n.id) as note_count 
           FROM notebooks n 
           JOIN collaborators c ON n.id = c.notebook_id
           WHERE c.user_id = ?
           ORDER BY n.updated_at DESC`,
          [req.user.id],
          (err, sharedNotebooks) => {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ message: 'Failed to retrieve shared notebooks' });
            }

            res.json({
              owned: ownedNotebooks || [],
              shared: sharedNotebooks || []
            });
          }
        );
      }
    );
  } catch (error) {
    console.error('Error retrieving notebooks:', error);
    res.status(500).json({ message: 'Failed to retrieve notebooks' });
  }
});

/**
 * Create a new notebook
 * POST /api/notes/notebooks
 */
router.post(
  '/notebooks',
  [
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
  ],
  async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description } = req.body;
    
    try {
      const id = uuidv4();
      
      db.run(
        'INSERT INTO notebooks (id, title, description, owner_id) VALUES (?, ?, ?, ?)',
        [id, title, description || null, req.user.id],
        function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Failed to create notebook' });
          }
          
          // Return the created notebook
          db.get(
            'SELECT * FROM notebooks WHERE id = ?',
            [id],
            (err, notebook) => {
              if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ message: 'Failed to retrieve created notebook' });
              }
              
              res.status(201).json(notebook);
            }
          );
        }
      );
    } catch (error) {
      console.error('Error creating notebook:', error);
      res.status(500).json({ message: 'Failed to create notebook' });
    }
  }
);

/**
 * Get all notes for a notebook
 * GET /api/notes/notebooks/:notebookId/notes
 */
router.get('/notebooks/:notebookId/notes', async (req, res) => {
  const { notebookId } = req.params;
  
  try {
    // First check if user has access to this notebook
    db.get(
      `SELECT * FROM notebooks WHERE id = ? AND owner_id = ?
       UNION
       SELECT n.* FROM notebooks n
       JOIN collaborators c ON n.id = c.notebook_id
       WHERE n.id = ? AND c.user_id = ?`,
      [notebookId, req.user.id, notebookId, req.user.id],
      (err, notebook) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ message: 'Failed to check notebook access' });
        }
        
        if (!notebook) {
          return res.status(403).json({ message: 'Access denied to this notebook' });
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
              console.error('Database error:', err);
              return res.status(500).json({ message: 'Failed to retrieve notes' });
            }
            
            res.json(notes || []);
          }
        );
      }
    );
  } catch (error) {
    console.error('Error retrieving notes:', error);
    res.status(500).json({ message: 'Failed to retrieve notes' });
  }
});

/**
 * Create a new note in a notebook
 * POST /api/notes/notebooks/:notebookId/notes
 */
router.post(
  '/notebooks/:notebookId/notes',
  [
    param('notebookId').notEmpty().withMessage('Notebook ID is required'),
    body('title')
      .trim()
      .notEmpty()
      .withMessage('Note title is required')
      .isLength({ max: 200 })
      .withMessage('Note title must be at most 200 characters'),
    body('content')
      .optional()
  ],
  async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { notebookId } = req.params;
    const { title, content } = req.body;
    
    try {
      // Check if user has write access to the notebook
      db.get(
        `SELECT * FROM notebooks WHERE id = ? AND owner_id = ?
         UNION
         SELECT n.* FROM notebooks n
         JOIN collaborators c ON n.id = c.notebook_id
         WHERE n.id = ? AND c.user_id = ? AND c.permission IN ('write', 'admin')`,
        [notebookId, req.user.id, notebookId, req.user.id],
        (err, notebook) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Failed to check notebook access' });
          }
          
          if (!notebook) {
            return res.status(403).json({ message: 'You do not have permission to create notes in this notebook' });
          }
          
          // Create the note
          const id = uuidv4();
          
          db.run(
            'INSERT INTO notes (id, title, content, notebook_id, owner_id) VALUES (?, ?, ?, ?, ?)',
            [id, title, content || '', notebookId, req.user.id],
            function(err) {
              if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ message: 'Failed to create note' });
              }
              
              // Return the created note
              db.get(
                'SELECT * FROM notes WHERE id = ?',
                [id],
                (err, note) => {
                  if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ message: 'Failed to retrieve created note' });
                  }
                  
                  res.status(201).json(note);
                }
              );
            }
          );
        }
      );
    } catch (error) {
      console.error('Error creating note:', error);
      res.status(500).json({ message: 'Failed to create note' });
    }
  }
);

/**
 * Get a specific note
 * GET /api/notes/:noteId
 */
router.get('/:noteId', async (req, res) => {
  const { noteId } = req.params;
  
  try {
    // Check if user has access to this note
    db.get(
      `SELECT n.*, u.name as owner_name
       FROM notes n
       JOIN users u ON n.owner_id = u.id
       WHERE n.id = ? AND n.owner_id = ?
       
       UNION
       
       SELECT n.*, u.name as owner_name
       FROM notes n
       JOIN users u ON n.owner_id = u.id
       JOIN notebooks nb ON n.notebook_id = nb.id
       JOIN collaborators c ON nb.id = c.notebook_id
       WHERE n.id = ? AND c.user_id = ?`,
      [noteId, req.user.id, noteId, req.user.id],
      (err, note) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ message: 'Failed to retrieve note' });
        }
        
        if (!note) {
          return res.status(404).json({ message: 'Note not found or access denied' });
        }
        
        // Get all images for the note
        db.all(
          'SELECT * FROM images WHERE note_id = ? ORDER BY created_at',
          [noteId],
          (err, images) => {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ message: 'Failed to retrieve note images' });
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
    console.error('Error retrieving note:', error);
    res.status(500).json({ message: 'Failed to retrieve note' });
  }
});

/**
 * Update a note
 * PUT /api/notes/:noteId
 */
router.put(
  '/:noteId',
  [
    param('noteId').notEmpty().withMessage('Note ID is required'),
    body('title')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Note title cannot be empty')
      .isLength({ max: 200 })
      .withMessage('Note title must be at most 200 characters'),
    body('content')
      .optional()
  ],
  async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { noteId } = req.params;
    const { title, content } = req.body;
    
    try {
      // Check if user has write access to the note
      db.get(
        `SELECT n.* FROM notes n WHERE n.id = ? AND n.owner_id = ?
         
         UNION
         
         SELECT n.* FROM notes n
         JOIN notebooks nb ON n.notebook_id = nb.id
         JOIN collaborators c ON nb.id = c.notebook_id
         WHERE n.id = ? AND c.user_id = ? AND c.permission IN ('write', 'admin')`,
        [noteId, req.user.id, noteId, req.user.id],
        (err, note) => {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Failed to check note access' });
          }
          
          if (!note) {
            return res.status(404).json({ message: 'Note not found or you do not have permission to update it' });
          }
          
          // Prepare update fields and values
          const updates = [];
          const values = [];
          
          if (title !== undefined) {
            updates.push('title = ?');
            values.push(title);
          }
          
          if (content !== undefined) {
            updates.push('content = ?');
            values.push(content);
          }
          
          if (updates.length === 0) {
            return res.status(400).json({ message: 'No fields to update' });
          }
          
          // Add updated_at timestamp and note ID
          updates.push('updated_at = CURRENT_TIMESTAMP');
          values.push(noteId);
          
          // Update the note
          db.run(
            `UPDATE notes SET ${updates.join(', ')} WHERE id = ?`,
            values,
            function(err) {
              if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ message: 'Failed to update note' });
              }
              
              // Return the updated note
              db.get(
                'SELECT * FROM notes WHERE id = ?',
                [noteId],
                (err, updatedNote) => {
                  if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ message: 'Failed to retrieve updated note' });
                  }
                  
                  res.json(updatedNote);
                }
              );
            }
          );
        }
      );
    } catch (error) {
      console.error('Error updating note:', error);
      res.status(500).json({ message: 'Failed to update note' });
    }
  }
);

/**
 * Delete a note
 * DELETE /api/notes/:noteId
 */
router.delete('/:noteId', async (req, res) => {
  const { noteId } = req.params;
  
  try {
    // Check if user has permission to delete the note
    db.get(
      `SELECT n.* FROM notes n WHERE n.id = ? AND n.owner_id = ?
       
       UNION
       
       SELECT n.* FROM notes n
       JOIN notebooks nb ON n.notebook_id = nb.id
       JOIN collaborators c ON nb.id = c.notebook_id
       WHERE n.id = ? AND c.user_id = ? AND c.permission = 'admin'`,
      [noteId, req.user.id, noteId, req.user.id],
      (err, note) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ message: 'Failed to check note access' });
        }
        
        if (!note) {
          return res.status(404).json({ message: 'Note not found or you do not have permission to delete it' });
        }
        
        // Get all images to delete files
        db.all(
          'SELECT * FROM images WHERE note_id = ?',
          [noteId],
          (err, images) => {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ message: 'Failed to retrieve note images' });
            }
            
            // Delete the note (cascade will delete images from DB)
            db.run(
              'DELETE FROM notes WHERE id = ?',
              [noteId],
              function(err) {
                if (err) {
                  console.error('Database error:', err);
                  return res.status(500).json({ message: 'Failed to delete note' });
                }
                
                // Delete image files
                if (images && images.length > 0) {
                  for (const image of images) {
                    try {
                      const filePath = path.join(__dirname, '../uploads', path.basename(image.file_path));
                      if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                      }
                    } catch (error) {
                      console.error(`Error deleting image file ${image.file_path}:`, error);
                      // Continue with other deletions
                    }
                  }
                }
                
                res.status(200).json({ message: 'Note deleted successfully' });
              }
            );
          }
        );
      }
    );
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ message: 'Failed to delete note' });
  }
});

/**
 * Upload an image to a note
 * POST /api/notes/:noteId/images
 */
router.post('/:noteId/images', upload.single('image'), async (req, res) => {
  const { noteId } = req.params;
  
  if (!req.file) {
    return res.status(400).json({ message: 'No image file uploaded' });
  }
  
  try {
    // Check if user has write access to the note
    db.get(
      `SELECT n.* FROM notes n WHERE n.id = ? AND n.owner_id = ?
       
       UNION
       
       SELECT n.* FROM notes n
       JOIN notebooks nb ON n.notebook_id = nb.id
       JOIN collaborators c ON nb.id = c.notebook_id
       WHERE n.id = ? AND c.user_id = ? AND c.permission IN ('write', 'admin')`,
      [noteId, req.user.id, noteId, req.user.id],
      (err, note) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ message: 'Failed to check note access' });
        }
        
        if (!note) {
          // Delete uploaded file
          try {
            fs.unlinkSync(req.file.path);
          } catch (error) {
            console.error('Error deleting uploaded file:', error);
          }
          
          return res.status(404).json({ message: 'Note not found or you do not have permission to add images' });
        }
        
        // Save image information in database
        const id = uuidv4();
        const filePath = `/uploads/${path.basename(req.file.path)}`;
        
        db.run(
          'INSERT INTO images (id, note_id, file_path, file_name, mime_type, size) VALUES (?, ?, ?, ?, ?, ?)',
          [id, noteId, filePath, req.file.originalname, req.file.mimetype, req.file.size],
          function(err) {
            if (err) {
              console.error('Database error:', err);
              // Delete uploaded file on error
              try {
                fs.unlinkSync(req.file.path);
              } catch (error) {
                console.error('Error deleting uploaded file:', error);
              }
              
              return res.status(500).json({ message: 'Failed to save image information' });
            }
            
            // Return image information
            res.status(201).json({
              id,
              note_id: noteId,
              file_path: filePath,
              file_name: req.file.originalname,
              mime_type: req.file.mimetype,
              size: req.file.size,
              url: `${req.protocol}://${req.get('host')}${filePath}`
            });
          }
        );
      }
    );
  } catch (error) {
    console.error('Error uploading image:', error);
    // Delete uploaded file on error
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (error) {
        console.error('Error deleting uploaded file:', error);
      }
    }
    
    res.status(500).json({ message: 'Failed to upload image' });
  }
});

/**
 * Search notes (global search)
 * GET /api/notes/search
 */
router.get('/search', async (req, res) => {
  const { query } = req.query;
  
  if (!query) {
    return res.status(400).json({ message: 'Search query is required' });
  }
  
  try {
    // Search in notes the user has access to
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
      [req.user.id, req.user.id, `%${query}%`, `%${query}%`],
      (err, results) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ message: 'Failed to search notes' });
        }
        
        res.json(results || []);
      }
    );
  } catch (error) {
    console.error('Error searching notes:', error);
    res.status(500).json({ message: 'Failed to search notes' });
  }
});

module.exports = router; 