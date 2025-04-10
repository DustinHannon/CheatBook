/**
 * Database Configuration
 * Configures database connections for both development and production
 * Supports SQLite, MySQL, and PostgreSQL
 */

require('dotenv').config();

// Default database type is SQLite for development
const dbType = process.env.DB_TYPE || 'sqlite';

// Database configuration based on type
const dbConfig = {
  // SQLite configuration (default for development)
  sqlite: {
    type: 'sqlite',
    // Store in a mounted volume or absolute path for Azure for persistence
    database: process.env.SQLITE_DB_PATH || 'server/db/cheatbook.sqlite',
    // Enable foreign keys for referential integrity
    enableForeignKeys: true
  },
  
  // MySQL configuration
  mysql: {
    type: 'mysql',
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'cheatbook',
    // Enable connection pooling
    pool: {
      min: 2,
      max: 10
    },
    // Character set for UTF-8 storage
    charset: 'utf8mb4'
  },
  
  // PostgreSQL configuration
  postgres: {
    type: 'postgres',
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432', 10),
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || '',
    database: process.env.PG_DATABASE || 'cheatbook',
    // Enable connection pooling
    pool: {
      min: 2,
      max: 10
    },
    ssl: process.env.PG_SSL === 'true' ? {
      rejectUnauthorized: false
    } : false
  },
  
  // Azure Database for PostgreSQL configuration
  azurePostgres: {
    type: 'postgres',
    host: process.env.AZURE_PG_HOST,
    port: parseInt(process.env.AZURE_PG_PORT || '5432', 10),
    user: process.env.AZURE_PG_USER,
    password: process.env.AZURE_PG_PASSWORD,
    database: process.env.AZURE_PG_DATABASE,
    ssl: true,
    pool: {
      min: 2,
      max: 20,
      idleTimeoutMillis: 30000
    }
  }
};

// Connection timeout settings
const connectionSettings = {
  // Number of retry attempts for connecting
  retryAttempts: 5,
  // Delay between retry attempts (ms)
  retryDelay: 1000,
  // Connection timeout (ms)
  connectionTimeout: 10000
};

// Migration options for database schema
const migrationOptions = {
  // Directory containing migration files
  migrationsDir: 'server/db/migrations',
  // Whether to run migrations on startup
  runMigrations: process.env.RUN_MIGRATIONS === 'true'
};

// Database configuration for application
module.exports = {
  // Current database configuration based on type
  connection: dbConfig[dbType] || dbConfig.sqlite,
  // Database type
  type: dbType,
  // Connection settings
  connectionSettings,
  // Migration options
  migrationOptions,
  // For handling multiple database connections
  connections: dbConfig,
  // Whether to use transactions for multi-step operations
  useTransactions: true,
  // Database connection retry logic
  connectionRetry: true,
  // Logging level for database operations
  logLevel: process.env.NODE_ENV === 'production' ? 'error' : 'info'
};
