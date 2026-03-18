/**
 * Storage Configuration
 * Contains settings for file storage, both local and cloud
 */

module.exports = {
  // Local file storage settings
  local: {
    // Base directory for uploads
    uploadDir: 'uploads',
    // URL base path for accessing uploads
    uploadPath: '/uploads',
    // Maximum file sizes in bytes for different file types
    limits: {
      images: 5 * 1024 * 1024, // 5MB
      documents: 10 * 1024 * 1024, // 10MB
      avatars: 2 * 1024 * 1024, // 2MB
      default: 5 * 1024 * 1024 // 5MB
    },
    // Allowed MIME types for different file categories
    allowedTypes: {
      images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      documents: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
      avatars: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      default: ['application/octet-stream']
    }
  },
  
  // Azure Blob Storage settings
  azure: {
    accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME || '',
    accountKey: process.env.AZURE_STORAGE_ACCOUNT_KEY || '',
    // Default container names
    containers: {
      images: 'images',
      documents: 'documents',
      avatars: 'avatars',
      temp: 'temp'
    }
  }
};
