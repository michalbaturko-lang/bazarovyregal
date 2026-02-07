'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'sessions.db');

function initDatabase() {
  // Ensure the data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const db = new Database(DB_PATH);

  // Enable WAL mode for better concurrent read/write performance
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  // Run all table creation in a transaction
  const migrate = db.transaction(() => {
    // -----------------------------------------------------------
    // Projects (multi-tenant support)
    // -----------------------------------------------------------
    db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        domain     TEXT,
        created_at DATETIME DEFAULT (datetime('now'))
      )
    `);

    // -----------------------------------------------------------
    // Sessions
    // -----------------------------------------------------------
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id                     TEXT PRIMARY KEY,
        project_id             TEXT NOT NULL,
        visitor_id             TEXT,
        started_at             DATETIME DEFAULT (datetime('now')),
        ended_at               DATETIME,
        duration               INTEGER DEFAULT 0,
        url                    TEXT,
        referrer               TEXT,
        user_agent             TEXT,
        screen_width           INTEGER,
        screen_height          INTEGER,
        viewport_width         INTEGER,
        viewport_height        INTEGER,
        browser                TEXT,
        os                     TEXT,
        device_type            TEXT,
        country                TEXT,
        city                   TEXT,
        language               TEXT,
        utm_source             TEXT,
        utm_medium             TEXT,
        utm_campaign           TEXT,
        utm_term               TEXT,
        utm_content            TEXT,
        page_count             INTEGER DEFAULT 1,
        event_count            INTEGER DEFAULT 0,
        has_rage_clicks        BOOLEAN DEFAULT 0,
        has_errors             BOOLEAN DEFAULT 0,
        identified_user_id     TEXT,
        identified_user_email  TEXT,
        identified_user_name   TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);

    // -----------------------------------------------------------
    // Events (all event types stored in a single table)
    // -----------------------------------------------------------
    db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        type       INTEGER NOT NULL,
        timestamp  INTEGER NOT NULL,
        data       TEXT,
        url        TEXT,
        created_at DATETIME DEFAULT (datetime('now')),
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )
    `);

    // -----------------------------------------------------------
    // Funnels
    // -----------------------------------------------------------
    db.exec(`
      CREATE TABLE IF NOT EXISTS funnels (
        id         TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name       TEXT NOT NULL,
        steps      TEXT NOT NULL,
        created_at DATETIME DEFAULT (datetime('now')),
        updated_at DATETIME DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);

    // -----------------------------------------------------------
    // Segments (saved filters)
    // -----------------------------------------------------------
    db.exec(`
      CREATE TABLE IF NOT EXISTS segments (
        id         TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name       TEXT NOT NULL,
        filters    TEXT NOT NULL,
        created_at DATETIME DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);

    // -----------------------------------------------------------
    // Indexes
    // -----------------------------------------------------------
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_project_started
        ON sessions(project_id, started_at);

      CREATE INDEX IF NOT EXISTS idx_sessions_visitor
        ON sessions(visitor_id);

      CREATE INDEX IF NOT EXISTS idx_sessions_identified_user
        ON sessions(identified_user_id);

      CREATE INDEX IF NOT EXISTS idx_events_session_type
        ON events(session_id, type);

      CREATE INDEX IF NOT EXISTS idx_events_session_timestamp
        ON events(session_id, timestamp);
    `);

    // -----------------------------------------------------------
    // Default project
    // -----------------------------------------------------------
    const existing = db.prepare('SELECT id FROM projects WHERE id = ?').get('default');
    if (!existing) {
      db.prepare(`
        INSERT INTO projects (id, name, domain) VALUES (?, ?, ?)
      `).run('default', 'Default Project', 'localhost');
      console.log('[init-db] Inserted default project.');
    }
  });

  migrate();

  console.log('[init-db] Database initialized successfully at', DB_PATH);
  db.close();
}

// Allow running as a standalone script or importing as a module
if (require.main === module) {
  initDatabase();
} else {
  module.exports = initDatabase;
}
