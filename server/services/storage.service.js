/**
 * Storage Service
 * Provides functionality for file handling and cloud storage integration
 * Implements Azure Blob Storage for persistent file storage
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { BlobServiceClient, StorageSharedKeyCredential } = require('@azure/storage-blob');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/logging/logger');
const storageConfig = require('../config/storage');

// Container names for different storage types
const CONTAINERS = storageConfig.azure.containers;

/**
 * Initialize Azure Blob Storage client
 * Falls back to local storage if Azure credentials are not configured
 */
let blobServiceClient = null;
let useLocalStorage = true;

try {
  if (storageConfig.azure.accountName && storageConfig.azure.accountKey) {
    const sharedKeyCredential = new StorageSharedKeyCredential(
      storageConfig.azure.accountName, 
      storageConfig.azure.accountKey
    );
    
    blobServiceClient = new BlobServiceClient(
      `https://${storageConfig.azure.accountName}.blob.core.windows.net`,
      sharedKeyCredential
    );
    
    useLocalStorage = false;
    
    logger.info('Azure Blob Storage client initialized');
  } else {
    logger.warn('Azure Blob Storage credentials not found, using local file storage');
  }
} catch (error) {
  logger.error('Error initializing Azure Blob Storage client:', error);
  logger.info('Falling back to local file storage');
}

/**
 * Get file size limit for a specific file type
 * @param {string} fileType - Type of file (images, documents, etc.)
 * @returns {number} - Size limit in bytes
 */
function getFileSizeLimit(fileType) {
  return storageConfig.local.limits[fileType] || storageConfig.local.limits.default;
}

/**
 * Get allowed MIME types for a specific file type
 * @param {string} fileType - Type of file (images, documents, etc.)
 * @returns {string[]} - Array of allowed MIME types
 */
function getAllowedMimeTypes(fileType) {
  return storageConfig.local.allowedTypes[fileType] || storageConfig.local.allowedTypes.default;
}

/**
 * Configure multer storage
 * @param {string} fileType - Type of file being uploaded (images, documents, etc.)
 * @returns {Object} - Configured multer middleware
 */
function configureMulter(fileType = 'temp') {
  // Determine file size limits based on file type
  const limits = {
    fileSize: getFileSizeLimit(fileType)
  };
  
  // Set up multer storage configuration
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      // Use a specific directory for file type
      const uploadDir = path.join(__dirname, `../uploads/${fileType}`);
      
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
  
  // Configure file filter based on file type
  const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = getAllowedMimeTypes(fileType);
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`), false);
    }
  };
  
  return multer({ 
    storage, 
    limits,
    fileFilter
  });
}

/**
 * Upload a file to Azure Blob Storage or local file system
 * @param {Object} file - File object from multer
 * @param {string} fileType - Type of file being uploaded
 * @returns {Promise<Object>} - Upload result with file information
 */
async function uploadFile(file, fileType = 'temp') {
  try {
    // If Azure Blob Storage is configured, upload to cloud
    if (!useLocalStorage) {
      const containerClient = blobServiceClient.getContainerClient(CONTAINERS[fileType] || 'temp');
      
      // Create container if it doesn't exist
      try {
        await containerClient.createIfNotExists({
          access: fileType === 'avatars' || fileType === 'images' 
            ? 'blob' // Public read access for images and avatars
            : 'private' // Private access for other file types
        });
      } catch (err) {
        logger.warn(`Error creating container ${CONTAINERS[fileType]}:`, err);
        // Continue with upload even if container creation fails
      }
      
      // Generate a unique blob name
      const blobName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      
      // Read file content
      const fileBuffer = fs.readFileSync(file.path);
      
      // Upload to Azure
      await blockBlobClient.upload(fileBuffer, fileBuffer.length);
      
      // Set content type
      await blockBlobClient.setHTTPHeaders({
        blobContentType: file.mimetype
      });
      
      // Delete local temp file
      fs.unlinkSync(file.path);
      
      // Return file information
      return {
        fileName: file.originalname,
        filePath: blockBlobClient.url,
        url: blockBlobClient.url,
        mimeType: file.mimetype,
        size: file.size,
        isCloud: true
      };
    } else {
      // Using local file system storage
      // File is already saved by multer
      const localFilePath = file.path;
      const relativePath = path.relative(process.cwd(), localFilePath);
      
      // Generate URL for local file
      const urlPath = relativePath.replace(/\\/g, '/');
      
      // Return file information
      return {
        fileName: file.originalname,
        filePath: localFilePath,
        url: `/${urlPath}`,
        mimeType: file.mimetype,
        size: file.size,
        isCloud: false
      };
    }
  } catch (error) {
    logger.error(`Error uploading file ${file.originalname}:`, error);
    
    // Cleanup temp file if it exists
    if (file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    
    throw error;
  }
}

/**
 * Delete a file from storage
 * @param {string} filePath - Path or URL of the file to delete
 * @returns {Promise<boolean>} - Whether the deletion was successful
 */
async function deleteFile(filePath) {
  try {
    // Check if the file is an Azure Blob Storage URL
    if (filePath.includes('.blob.core.windows.net/')) {
      if (useLocalStorage) {
        logger.warn(`Cannot delete cloud file ${filePath} - Azure Blob Storage not configured`);
        return false;
      }
      
      // Extract container and blob name from URL
      const url = new URL(filePath);
      const pathParts = url.pathname.split('/');
      
      if (pathParts.length < 3) {
        logger.error(`Invalid Azure Blob Storage URL: ${filePath}`);
        return false;
      }
      
      const containerName = pathParts[1];
      const blobName = pathParts.slice(2).join('/');
      
      // Delete from Azure
      const containerClient = blobServiceClient.getContainerClient(containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      
      await blockBlobClient.delete();
      logger.info(`Deleted file from Azure: ${filePath}`);
      
      return true;
    } else {
      // Local file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.info(`Deleted local file: ${filePath}`);
        return true;
      } else {
        logger.warn(`File not found for deletion: ${filePath}`);
        return false;
      }
    }
  } catch (error) {
    logger.error(`Error deleting file ${filePath}:`, error);
    return false;
  }
}

module.exports = {
  configureMulter,
  uploadFile,
  deleteFile,
  getFileSizeLimit,
  getAllowedMimeTypes
};
