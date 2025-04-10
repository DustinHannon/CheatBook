/**
 * Notebook Controller
 * Handles API requests related to notebooks
 * Implements proper separation of concerns between routes and business logic
 */

const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/logging/logger');
const { db } = require('../models/database');

/**
 * Get all notebooks for the authenticated user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getNotebooks(req, res) {
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
          logger.error('Database error retrieving owned notebooks:', err);
          return res.status(500).json({ 
            message: 'Failed to retrieve notebooks',
            code: 'db_error'
          });
        }

        // Get all notebooks where user is a collaborator
        db.all(
          `SELECT n.*, c.permission,
           (SELECT COUNT(*) FROM notes WHERE notebook_id = n.id) as note_count,
           u.name as owner_name
           FROM notebooks n 
           JOIN collaborators c ON n.id = c.notebook_id
           JOIN users u ON n.owner_id = u.id
           WHERE c.user_id = ?
           ORDER BY n.updated_at DESC`,
          [req.user.id],
          (err, sharedNotebooks) => {
            if (err) {
              logger.error('Database error retrieving shared notebooks:', err);
              return res.status(500).json({ 
                message: 'Failed to retrieve shared notebooks',
                code: 'db_error'
              });
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
    logger.error('Error retrieving notebooks:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve notebooks',
      code: 'server_error'
    });
  }
}

/**
 * Create a new notebook
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function createNotebook(req, res) {
  try {
    const { title, description } = req.body;
    
    // Input validation already done by validator middleware
    
    const id = uuidv4();
    
    db.run(
      'INSERT INTO notebooks (id, title, description, owner_id) VALUES (?, ?, ?, ?)',
      [id, title, description || null, req.user.id],
      function(err) {
        if (err) {
          logger.error('Database error creating notebook:', err);
          return res.status(500).json({ 
            message: 'Failed to create notebook',
            code: 'db_error'
          });
        }
        
        // Return the created notebook
        db.get(
          'SELECT * FROM notebooks WHERE id = ?',
          [id],
          (err, notebook) => {
            if (err) {
              logger.error('Database error retrieving created notebook:', err);
              return res.status(500).json({ 
                message: 'Failed to retrieve created notebook',
                code: 'db_error'
              });
            }
            
            logger.info(`Notebook created: ${id} by user ${req.user.id}`);
            res.status(201).json(notebook);
          }
        );
      }
    );
  } catch (error) {
    logger.error('Error creating notebook:', error);
    res.status(500).json({ 
      message: 'Failed to create notebook',
      code: 'server_error'
    });
  }
}

/**
 * Get a specific notebook
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getNotebook(req, res) {
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
    
    // Get the notebook with owner information
    db.get(
      `SELECT n.*, u.name as owner_name,
       (SELECT COUNT(*) FROM notes WHERE notebook_id = n.id) as note_count
       FROM notebooks n
       JOIN users u ON n.owner_id = u.id
       WHERE n.id = ?`,
      [notebookId],
      (err, notebook) => {
        if (err) {
          logger.error(`Database error retrieving notebook ${notebookId}:`, err);
          return res.status(500).json({ 
            message: 'Failed to retrieve notebook',
            code: 'db_error'
          });
        }
        
        if (!notebook) {
          return res.status(404).json({ 
            message: 'Notebook not found',
            code: 'not_found'
          });
        }
        
        // Get collaborators for this notebook
        db.all(
          `SELECT c.*, u.name, u.email, u.avatar
           FROM collaborators c
           JOIN users u ON c.user_id = u.id
           WHERE c.notebook_id = ?
           ORDER BY c.created_at`,
          [notebookId],
          (err, collaborators) => {
            if (err) {
              logger.error(`Database error retrieving collaborators for ${notebookId}:`, err);
              return res.status(500).json({ 
                message: 'Failed to retrieve notebook collaborators',
                code: 'db_error'
              });
            }
            
            // Return notebook with collaborators
            res.json({
              ...notebook,
              collaborators: collaborators || [],
              isOwner: notebook.owner_id === req.user.id
            });
          }
        );
      }
    );
  } catch (error) {
    logger.error('Error retrieving notebook:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve notebook',
      code: 'server_error'
    });
  }
}

/**
 * Update a notebook
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function updateNotebook(req, res) {
  try {
    const { notebookId } = req.params;
    const { title, description } = req.body;
    
    // Check if user has write access to the notebook
    const hasAccess = await checkNotebookOwnerAccess(notebookId, req.user.id);
    if (!hasAccess) {
      return res.status(403).json({ 
        message: 'You do not have permission to update this notebook',
        code: 'access_denied'
      });
    }
    
    // Prepare update fields and values
    const updates = [];
    const values = [];
    
    if (title !== undefined) {
      if (title.trim() === '') {
        return res.status(400).json({ 
          message: 'Notebook title cannot be empty',
          code: 'validation_error'
        });
      }
      updates.push('title = ?');
      values.push(title);
    }
    
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description || null);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ 
        message: 'No fields to update',
        code: 'validation_error'
      });
    }
    
    // Add updated_at timestamp and notebook ID
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(notebookId);
    
    // Update the notebook
    db.run(
      `UPDATE notebooks SET ${updates.join(', ')} WHERE id = ?`,
      values,
      function(err) {
        if (err) {
          logger.error(`Database error updating notebook ${notebookId}:`, err);
          return res.status(500).json({ 
            message: 'Failed to update notebook',
            code: 'db_error'
          });
        }
        
        // Return the updated notebook
        db.get(
          'SELECT * FROM notebooks WHERE id = ?',
          [notebookId],
          (err, updatedNotebook) => {
            if (err) {
              logger.error(`Database error retrieving updated notebook ${notebookId}:`, err);
              return res.status(500).json({ 
                message: 'Failed to retrieve updated notebook',
                code: 'db_error'
              });
            }
            
            logger.info(`Notebook updated: ${notebookId} by user ${req.user.id}`);
            res.json(updatedNotebook);
          }
        );
      }
    );
  } catch (error) {
    logger.error(`Error updating notebook ${req.params.notebookId}:`, error);
    res.status(500).json({ 
      message: 'Failed to update notebook',
      code: 'server_error'
    });
  }
}

/**
 * Delete a notebook
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function deleteNotebook(req, res) {
  try {
    const { notebookId } = req.params;
    
    // Check if user is the owner of the notebook
    const hasAccess = await checkNotebookOwnerAccess(notebookId, req.user.id);
    if (!hasAccess) {
      return res.status(403).json({ 
        message: 'You do not have permission to delete this notebook',
        code: 'access_denied'
      });
    }
    
    // Delete the notebook (cascade will delete notes and collaborators)
    db.run(
      'DELETE FROM notebooks WHERE id = ?',
      [notebookId],
      function(err) {
        if (err) {
          logger.error(`Database error deleting notebook ${notebookId}:`, err);
          return res.status(500).json({ 
            message: 'Failed to delete notebook',
            code: 'db_error'
          });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ 
            message: 'Notebook not found',
            code: 'not_found'
          });
        }
        
        logger.info(`Notebook deleted: ${notebookId} by user ${req.user.id}`);
        res.status(200).json({ 
          message: 'Notebook deleted successfully',
          code: 'success'
        });
      }
    );
  } catch (error) {
    logger.error(`Error deleting notebook ${req.params.notebookId}:`, error);
    res.status(500).json({ 
      message: 'Failed to delete notebook',
      code: 'server_error'
    });
  }
}

/**
 * Add a collaborator to a notebook
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function addCollaborator(req, res) {
  try {
    const { notebookId } = req.params;
    const { email, permission } = req.body;
    
    // Check if user is the owner of the notebook
    const hasAccess = await checkNotebookOwnerAccess(notebookId, req.user.id);
    if (!hasAccess) {
      return res.status(403).json({ 
        message: 'You do not have permission to add collaborators to this notebook',
        code: 'access_denied'
      });
    }
    
    // Find the user by email
    db.get(
      'SELECT id, name, email FROM users WHERE email = ?',
      [email],
      (err, user) => {
        if (err) {
          logger.error('Database error finding user by email:', err);
          return res.status(500).json({ 
            message: 'Failed to find user',
            code: 'db_error'
          });
        }
        
        if (!user) {
          return res.status(404).json({ 
            message: 'User not found',
            code: 'user_not_found'
          });
        }
        
        // Check if user is already a collaborator
        db.get(
          'SELECT * FROM collaborators WHERE notebook_id = ? AND user_id = ?',
          [notebookId, user.id],
          (err, existingCollaborator) => {
            if (err) {
              logger.error('Database error checking existing collaborator:', err);
              return res.status(500).json({ 
                message: 'Failed to check existing collaborator',
                code: 'db_error'
              });
            }
            
            if (existingCollaborator) {
              // Update existing collaborator permission
              db.run(
                'UPDATE collaborators SET permission = ? WHERE notebook_id = ? AND user_id = ?',
                [permission, notebookId, user.id],
                function(err) {
                  if (err) {
                    logger.error('Database error updating collaborator:', err);
                    return res.status(500).json({ 
                      message: 'Failed to update collaborator',
                      code: 'db_error'
                    });
                  }
                  
                  logger.info(`Collaborator updated: ${user.id} on notebook ${notebookId} by user ${req.user.id}`);
                  res.json({
                    notebook_id: notebookId,
                    user_id: user.id,
                    permission,
                    name: user.name,
                    email: user.email,
                    updated: true
                  });
                }
              );
            } else {
              // Add new collaborator
              db.run(
                'INSERT INTO collaborators (notebook_id, user_id, permission) VALUES (?, ?, ?)',
                [notebookId, user.id, permission],
                function(err) {
                  if (err) {
                    logger.error('Database error adding collaborator:', err);
                    return res.status(500).json({ 
                      message: 'Failed to add collaborator',
                      code: 'db_error'
                    });
                  }
                  
                  logger.info(`Collaborator added: ${user.id} to notebook ${notebookId} by user ${req.user.id}`);
                  res.status(201).json({
                    notebook_id: notebookId,
                    user_id: user.id,
                    permission,
                    name: user.name,
                    email: user.email,
                    created_at: new Date().toISOString()
                  });
                }
              );
            }
          }
        );
      }
    );
  } catch (error) {
    logger.error(`Error adding collaborator to notebook ${req.params.notebookId}:`, error);
    res.status(500).json({ 
      message: 'Failed to add collaborator',
      code: 'server_error'
    });
  }
}

/**
 * Remove a collaborator from a notebook
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function removeCollaborator(req, res) {
  try {
    const { notebookId, userId } = req.params;
    
    // Check if user is the owner of the notebook
    const hasAccess = await checkNotebookOwnerAccess(notebookId, req.user.id);
    if (!hasAccess) {
      return res.status(403).json({ 
        message: 'You do not have permission to remove collaborators from this notebook',
        code: 'access_denied'
      });
    }
    
    // Remove the collaborator
    db.run(
      'DELETE FROM collaborators WHERE notebook_id = ? AND user_id = ?',
      [notebookId, userId],
      function(err) {
        if (err) {
          logger.error('Database error removing collaborator:', err);
          return res.status(500).json({ 
            message: 'Failed to remove collaborator',
            code: 'db_error'
          });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ 
            message: 'Collaborator not found',
            code: 'not_found'
          });
        }
        
        logger.info(`Collaborator removed: ${userId} from notebook ${notebookId} by user ${req.user.id}`);
        res.status(200).json({ 
          message: 'Collaborator removed successfully',
          code: 'success'
        });
      }
    );
  } catch (error) {
    logger.error(`Error removing collaborator from notebook ${req.params.notebookId}:`, error);
    res.status(500).json({ 
      message: 'Failed to remove collaborator',
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
 * Check if user is the owner of a notebook
 * @param {string} notebookId - Notebook ID
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} - Whether the user is the owner
 */
async function checkNotebookOwnerAccess(notebookId, userId) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM notebooks WHERE id = ? AND owner_id = ?',
      [notebookId, userId],
      (err, notebook) => {
        if (err) return reject(err);
        resolve(!!notebook);
      }
    );
  });
}

module.exports = {
  getNotebooks,
  createNotebook,
  getNotebook,
  updateNotebook,
  deleteNotebook,
  addCollaborator,
  removeCollaborator
};
