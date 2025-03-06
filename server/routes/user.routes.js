/**
 * User routes
 * Handles user profile operations
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../models/database');
const { authenticateJWT } = require('../middleware/auth.middleware');

const router = express.Router();

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/avatars');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with original extension
    const uniqueName = `avatar-${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// Set up multer upload
const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

// Middleware for all user routes
router.use(authenticateJWT);

/**
 * Get current user profile
 * GET /api/users/profile
 */
router.get('/profile', async (req, res) => {
  try {
    db.get(
      'SELECT id, email, name, avatar, created_at, last_login FROM users WHERE id = ?',
      [req.user.id],
      (err, user) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ message: 'Failed to retrieve user profile' });
        }
        
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }
        
        res.json(user);
      }
    );
  } catch (error) {
    console.error('Error retrieving user profile:', error);
    res.status(500).json({ message: 'Failed to retrieve user profile' });
  }
});

/**
 * Update user profile
 * PUT /api/users/profile
 */
router.put(
  '/profile',
  [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Name must be between 1 and 100 characters')
  ],
  async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name } = req.body;
    
    try {
      // Update user profile
      db.run(
        'UPDATE users SET name = ? WHERE id = ?',
        [name, req.user.id],
        function(err) {
          if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Failed to update user profile' });
          }
          
          // Return updated user
          db.get(
            'SELECT id, email, name, avatar, created_at, last_login FROM users WHERE id = ?',
            [req.user.id],
            (err, user) => {
              if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ message: 'Failed to retrieve updated user profile' });
              }
              
              res.json(user);
            }
          );
        }
      );
    } catch (error) {
      console.error('Error updating user profile:', error);
      res.status(500).json({ message: 'Failed to update user profile' });
    }
  }
);

/**
 * Upload user avatar
 * POST /api/users/avatar
 */
router.post('/avatar', upload.single('avatar'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No avatar image uploaded' });
  }
  
  try {
    // Get current avatar to delete old file
    db.get(
      'SELECT avatar FROM users WHERE id = ?',
      [req.user.id],
      (err, user) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ message: 'Failed to retrieve current avatar' });
        }
        
        // Construct avatar URL path
        const avatarPath = `/uploads/avatars/${path.basename(req.file.path)}`;
        
        // Update user avatar in database
        db.run(
          'UPDATE users SET avatar = ? WHERE id = ?',
          [avatarPath, req.user.id],
          async function(err) {
            if (err) {
              console.error('Database error:', err);
              
              // Delete uploaded file on error
              try {
                fs.unlinkSync(req.file.path);
              } catch (deleteError) {
                console.error('Error deleting uploaded file:', deleteError);
              }
              
              return res.status(500).json({ message: 'Failed to update avatar' });
            }
            
            // Delete old avatar if exists
            if (user && user.avatar) {
                try {
                  // Get the base filename from the avatar path
                  const avatarFilename = path.basename(user.avatar);
                  const oldAvatarPath = path.join(__dirname, '../uploads/avatars', avatarFilename);
                  
                  if (fs.existsSync(oldAvatarPath)) {
                    fs.unlinkSync(oldAvatarPath);
                  }
              } catch (deleteError) {
                console.error('Error deleting old avatar:', deleteError);
                // Continue anyway
              }
            }
            
            // Return updated user
            res.json({
              avatar: avatarPath,
              url: `${req.protocol}://${req.get('host')}${avatarPath}`
            });
          }
        );
      }
    );
  } catch (error) {
    console.error('Error uploading avatar:', error);
    
    // Delete uploaded file on error
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (deleteError) {
        console.error('Error deleting uploaded file:', deleteError);
      }
    }
    
    res.status(500).json({ message: 'Failed to upload avatar' });
  }
});

/**
 * Get user activity statistics
 * GET /api/users/stats
 */
router.get('/stats', async (req, res) => {
  try {
    // Get counts of notes, notebooks, etc.
    db.get(
      `SELECT
         (SELECT COUNT(*) FROM notes WHERE owner_id = ?) as note_count,
         (SELECT COUNT(*) FROM notebooks WHERE owner_id = ?) as notebook_count,
         (SELECT COUNT(*) FROM collaborators WHERE user_id = ?) as shared_count`,
      [req.user.id, req.user.id, req.user.id],
      (err, stats) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ message: 'Failed to retrieve user statistics' });
        }
        
        // Get recent activity
        db.all(
          `SELECT 'note' as type, id, title, updated_at
           FROM notes
           WHERE owner_id = ?
           
           UNION
           
           SELECT 'notebook' as type, id, title, updated_at
           FROM notebooks
           WHERE owner_id = ?
           
           ORDER BY updated_at DESC
           LIMIT 10`,
          [req.user.id, req.user.id],
          (err, recentActivity) => {
            if (err) {
              console.error('Database error:', err);
              return res.status(500).json({ message: 'Failed to retrieve recent activity' });
            }
            
            res.json({
              stats: stats || { note_count: 0, notebook_count: 0, shared_count: 0 },
              recentActivity: recentActivity || []
            });
          }
        );
      }
    );
  } catch (error) {
    console.error('Error retrieving user statistics:', error);
    res.status(500).json({ message: 'Failed to retrieve user statistics' });
  }
});

module.exports = router;
