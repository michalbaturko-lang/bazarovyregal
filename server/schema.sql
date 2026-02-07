-- ==========================================================================
-- Regal Master Look — PostgreSQL / Supabase schema
-- Translated from the original SQLite schema in init-db.js
-- ==========================================================================

-- -----------------------------------------------------------
-- Projects (multi-tenant support)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  domain     TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------------
-- Sessions
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id                     TEXT PRIMARY KEY,
  project_id             TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  visitor_id             TEXT,
  started_at             TIMESTAMPTZ DEFAULT now(),
  ended_at               TIMESTAMPTZ,
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
  has_rage_clicks        BOOLEAN DEFAULT false,
  has_errors             BOOLEAN DEFAULT false,
  identified_user_id     TEXT,
  identified_user_email  TEXT,
  identified_user_name   TEXT
);

-- -----------------------------------------------------------
-- Events (all event types stored in a single table)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
  id         SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  type       INTEGER NOT NULL,
  timestamp  BIGINT NOT NULL,
  data       JSONB,
  url        TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------------
-- Funnels
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS funnels (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  steps      JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------------
-- Segments (saved filters)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS segments (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  filters    JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------
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

-- -----------------------------------------------------------
-- Row Level Security (disabled for service role access)
-- -----------------------------------------------------------
ALTER TABLE projects  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE funnels   ENABLE ROW LEVEL SECURITY;
ALTER TABLE segments  ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (bypasses RLS by default, but
-- explicit policies ensure clarity for non-service-role clients).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_projects') THEN
    CREATE POLICY "service_role_all_projects" ON projects FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_sessions') THEN
    CREATE POLICY "service_role_all_sessions" ON sessions FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_events') THEN
    CREATE POLICY "service_role_all_events" ON events FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_funnels') THEN
    CREATE POLICY "service_role_all_funnels" ON funnels FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_segments') THEN
    CREATE POLICY "service_role_all_segments" ON segments FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- -----------------------------------------------------------
-- Default project
-- -----------------------------------------------------------
-- -----------------------------------------------------------
-- Session notes
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS session_notes (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  content TEXT NOT NULL,
  author TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_session ON session_notes(session_id);

-- -----------------------------------------------------------
-- RLS for session_notes
-- -----------------------------------------------------------
ALTER TABLE session_notes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_session_notes') THEN
    CREATE POLICY "service_role_all_session_notes" ON session_notes FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- -----------------------------------------------------------
-- Share links (session sharing)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS share_links (
  token TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  created_by TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_share_links_session ON share_links(session_id);
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_share_links') THEN
    CREATE POLICY "service_role_all_share_links" ON share_links FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- -----------------------------------------------------------
-- Default project
-- -----------------------------------------------------------
INSERT INTO projects (id, name, domain)
VALUES ('default', 'Default Project', 'localhost')
ON CONFLICT (id) DO NOTHING;
