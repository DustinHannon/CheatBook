/**
 * Database initialization and schema setup
 * Supports multiple database types (SQLite, PostgreSQL)
 */

const path = require('path');
const fs = require('fs');
const { logger } = require('../utils/logging/logger');
const dbConfig = require('../config/database');

// Database connection pool
let db = null;
let pgPool = null;

/**
 * Initialize the database connection based on configuration
 */
async function initializeDatabase() {
  if (dbConfig.type === 'sqlite') {
    await initializeSQLite();
  } else if (dbConfig.type === 'postgres') {
    await initializePostgres();
  } else if (dbConfig.type === 'mysql') {
    await initializeMySQL();
  } else {
    throw new Error(`Unsupported database type: ${dbConfig.type}`);
  }
  
  // Run migrations regardless of DB type
  await runMigrations();
  
  logger.info(`Database initialized (${dbConfig.type})`);
}

/**
 * Initialize SQLite database
 */
async function initializeSQLite() {
  return new Promise((resolve, reject) => {
    try {
      const sqlite3 = require('sqlite3').verbose();
      
      // Ensure the database directory exists
      const dbDir = path.dirname(dbConfig.connection.database);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      
      // Initialize database connection
      db = new sqlite3.Database(dbConfig.connection.database, (err) => {
        if (err) {
          logger.error('Error connecting to SQLite database:', err);
          return reject(err);
        }
        
        // Enable foreign keys
        db.run('PRAGMA foreign_keys = ON', (err) => {
          if (err) {
            logger.warn('Failed to enable foreign keys in SQLite:', err);
          }
          
          logger.info(`Connected to SQLite database at ${dbConfig.connection.database}`);
          resolve();
        });
      });
    } catch (error) {
      logger.error('Error initializing SQLite:', error);
      reject(error);
    }
  });
}

/**
 * Initialize PostgreSQL database
 */
async function initializePostgres() {
  try {
    const { Pool } = require('pg');
    
    pgPool = new Pool({
      host: dbConfig.postgres.host,
      port: dbConfig.postgres.port,
      database: dbConfig.postgres.database,
      user: dbConfig.postgres.user,
      password: dbConfig.postgres.password,
      ssl: dbConfig.postgres.ssl ? { rejectUnauthorized: false } : false,
      max: dbConfig.postgres.max,
      idleTimeoutMillis: dbConfig.postgres.idleTimeoutMillis
    });
    
    // Test connection
    await pgPool.query('SELECT NOW()');
    
    // PostgreSQL adapter to match SQLite interface
    db = {
      all: async (sql, params, callback) => {
        try {
          const result = await pgPool.query(sql, params);
          callback(null, result.rows);
        } catch (error) {
          callback(error);
        }
      },
      get: async (sql, params, callback) => {
        try {
          const result = await pgPool.query(sql, params);
          callback(null, result.rows[0] || null);
        } catch (error) {
          callback(error);
        }
      },
      run: async (sql, params, callback) => {
        try {
          const result = await pgPool.query(sql, params);
          if (callback && typeof callback === 'function') {
            // Mimic the 'this' context of SQLite's run callback
            callback.call({ changes: result.rowCount, lastID: null });
          }
        } catch (error) {
          if (callback && typeof callback === 'function') {
            callback(error);
          } else {
            logger.error('Error executing query:', error);
          }
        }
      },
      exec: async (sql, callback) => {
        try {
          await pgPool.query(sql);
          if (callback) callback(null);
        } catch (error) {
          if (callback) callback(error);
        }
      },
      close: async (callback) => {
        try {
          await pgPool.end();
          if (callback) callback(null);
        } catch (error) {
          if (callback) callback(error);
        }
      }
    };
    
    logger.info(`Connected to PostgreSQL database at ${dbConfig.postgres.host}`);
  } catch (error) {
    logger.error('Error initializing PostgreSQL:', error);
    throw error;
  }
}

/**
 * Initialize MySQL database
 */
async function initializeMySQL() {
  try {
    const mysql = require('mysql2/promise');
    
    const mysqlPool = mysql.createPool({
      host: dbConfig.mysql.host,
      port: dbConfig.mysql.port,
      database: dbConfig.mysql.database,
      user: dbConfig.mysql.user,
      password: dbConfig.mysql.password,
      ssl: dbConfig.mysql.ssl ? { rejectUnauthorized: false } : false,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    
    // Test connection
    await mysqlPool.query('SELECT 1');
    
    // MySQL adapter to match SQLite interface
    db = {
      all: async (sql, params, callback) => {
        try {
          const [rows] = await mysqlPool.query(sql, params);
          callback(null, rows);
        } catch (error) {
          callback(error);
        }
      },
      get: async (sql, params, callback) => {
        try {
          const [rows] = await mysqlPool.query(sql, params);
          callback(null, rows[0] || null);
        } catch (error) {
          callback(error);
        }
      },
      run: async (sql, params, callback) => {
        try {
          const [result] = await mysqlPool.query(sql, params);
          if (callback && typeof callback === 'function') {
            // Mimic the 'this' context of SQLite's run callback
            callback.call({ changes: result.affectedRows, lastID: result.insertId });
          }
        } catch (error) {
          if (callback && typeof callback === 'function') {
            callback(error);
          } else {
            logger.error('Error executing query:', error);
          }
        }
      },
      exec: async (sql, callback) => {
        try {
          await mysqlPool.query(sql);
          if (callback) callback(null);
        } catch (error) {
          if (callback) callback(error);
        }
      },
      close: async (callback) => {
        try {
          await mysqlPool.end();
          if (callback) callback(null);
        } catch (error) {
          if (callback) callback(error);
        }
      }
    };
    
    logger.info(`Connected to MySQL database at ${dbConfig.mysql.host}`);
  } catch (error) {
    logger.error('Error initializing MySQL:', error);
    throw error;
  }
}

/**
 * Run database migrations
 * This ensures the schema is properly set up and upgraded
 */
async function runMigrations() {
  try {
    // Create migrations table if it doesn't exist
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS migrations (
          id INTEGER PRIMARY KEY ${dbConfig.type === 'sqlite' ? 'AUTOINCREMENT' : 'AUTO_INCREMENT'},
          name TEXT UNIQUE NOT NULL,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `, [], function(err) {
        if (err) return reject(err);
        resolve();
      });
    });
    
    // Initialize base schema (v1)
    await applyMigration('001_initial_schema', applyInitialSchema);
    
    // Apply additional migrations in order
    await applyMigration('002_add_refresh_tokens', applyRefreshTokensMigration);
    
    // Add more migrations here as needed
    
  } catch (error) {
    logger.error('Error applying migrations:', error);
    throw error;
  }
}

/**
 * Apply a migration if it hasn't been applied yet
 * @param {string} name - Migration name
 * @param {Function} migrationFn - Migration function
 */
async function applyMigration(name, migrationFn) {
  return new Promise((resolve, reject) => {
    // Check if migration has already been applied
    db.get('SELECT id FROM migrations WHERE name = ?', [name], async (err, row) => {
      if (err) return reject(err);
      
      if (row) {
        // Migration already applied
        logger.debug(`Migration ${name} already applied`);
        return resolve();
      }
      
      // Apply migration
      try {
        logger.info(`Applying migration: ${name}`);
        await migrationFn();
        
        // Record migration as applied
        db.run('INSERT INTO migrations (name) VALUES (?)', [name], function(err) {
          if (err) return reject(err);
          logger.info(`Migration ${name} applied successfully`);
          resolve();
        });
      } catch (error) {
        logger.error(`Error applying migration ${name}:`, error);
        reject(error);
      }
    });
  });
}

/**
 * Initial schema migration
 */
async function applyInitialSchema() {
  return new Promise((resolve, reject) => {
    // Users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        avatar TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      )
    `, [], (err) => {
      if (err) return reject(err);
      
      // Auth codes table (for email login)
      db.run(`
        CREATE TABLE IF NOT EXISTS auth_codes (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL,
          code_hash TEXT NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `, [], (err) => {
        if (err) return reject(err);
        
        // Notebooks table
        db.run(`
          CREATE TABLE IF NOT EXISTS notebooks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            owner_id TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (owner_id) REFERENCES users(id)
          )
        `, [], (err) => {
          if (err) return reject(err);
          
          // Notes table
          db.run(`
            CREATE TABLE IF NOT EXISTS notes (
              id TEXT PRIMARY KEY,
              title TEXT NOT NULL,
              content TEXT,
              notebook_id TEXT,
              owner_id TEXT NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE,
              FOREIGN KEY (owner_id) REFERENCES users(id)
            )
          `, [], (err) => {
            if (err) return reject(err);
            
            // Images table
            db.run(`
              CREATE TABLE IF NOT EXISTS images (
                id TEXT PRIMARY KEY,
                note_id TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_name TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                size INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
              )
            `, [], (err) => {
              if (err) return reject(err);
              
              // Collaborators table
              db.run(`
                CREATE TABLE IF NOT EXISTS collaborators (
                  notebook_id TEXT NOT NULL,
                  user_id TEXT NOT NULL,
                  permission TEXT CHECK(permission IN ('read', 'write', 'admin')) NOT NULL,
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  PRIMARY KEY (notebook_id, user_id),
                  FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE,
                  FOREIGN KEY (user_id) REFERENCES users(id)
                )
              `, [], (err) => {
                if (err) return reject(err);
                resolve();
              });
            });
          });
        });
      });
    });
  });
}

/**
 * Migration to add refresh tokens table
 */
async function applyRefreshTokensMigration() {
  return new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        revoked BOOLEAN NOT NULL DEFAULT 0,
        revoked_at TIMESTAMP,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `, [], (err) => {
      if (err) return reject(err);
      
      // Create index for faster token lookups
      db.run(`
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)
      `, [], (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  });
}

module.exports = {
  db,
  initializeDatabase,
  getPool: () => pgPool // For direct access to PostgreSQL pool when needed
};
