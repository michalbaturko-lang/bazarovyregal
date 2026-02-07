'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'sessions.db');

let _db = null;

/**
 * Returns a singleton better-sqlite3 database connection.
 * Creates the data directory if it does not exist.
 * Enables WAL mode on first open for better concurrent performance.
 */
function getDatabase() {
  if (_db) {
    return _db;
  }

  // Ensure the data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  _db = new Database(DB_PATH);

  // Performance pragmas
  _db.pragma('journal_mode = WAL');
  _db.pragma('synchronous = NORMAL');
  _db.pragma('foreign_keys = ON');
  _db.pragma('cache_size = -64000'); // 64 MB cache

  // Graceful shutdown — close the database when the process exits
  process.on('exit', () => {
    if (_db) {
      _db.close();
    }
  });

  return _db;
}

module.exports = getDatabase;
