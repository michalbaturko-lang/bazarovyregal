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
-- Webhooks
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  event_types TEXT[] NOT NULL DEFAULT '{}',
  headers JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_webhooks') THEN
    CREATE POLICY "service_role_all_webhooks" ON webhooks FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS webhook_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  webhook_id TEXT REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  success BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_webhook_logs') THEN
    CREATE POLICY "service_role_all_webhook_logs" ON webhook_logs FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- -----------------------------------------------------------
-- Report configs (automated email reports)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS report_configs (
  id TEXT PRIMARY KEY DEFAULT 'default',
  project_id TEXT NOT NULL DEFAULT 'default',
  enabled BOOLEAN DEFAULT false,
  recipients TEXT[] DEFAULT '{}',
  frequency TEXT DEFAULT 'weekly',
  day_of_week INTEGER DEFAULT 1,
  hour INTEGER DEFAULT 9,
  timezone TEXT DEFAULT 'Europe/Prague',
  include_sections TEXT[] DEFAULT '{overview,top_pages,errors,performance}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE report_configs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_report_configs') THEN
    CREATE POLICY "service_role_all_report_configs" ON report_configs FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS report_history (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id TEXT NOT NULL DEFAULT 'default',
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  recipients TEXT[] DEFAULT '{}',
  html_content TEXT,
  sent_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE report_history ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_report_history') THEN
    CREATE POLICY "service_role_all_report_history" ON report_history FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- -----------------------------------------------------------
-- API Keys (Developer API)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  scopes TEXT[] DEFAULT '{read:sessions,read:events,read:analytics}',
  last_used_at TIMESTAMPTZ,
  request_count INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_api_keys') THEN
    CREATE POLICY "service_role_all_api_keys" ON api_keys FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- -----------------------------------------------------------
-- Tenants (multi-tenant billing & white-label)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  domain TEXT,
  owner_email TEXT,
  plan_id TEXT DEFAULT 'free',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  sessions_limit INTEGER DEFAULT 1000,
  sessions_used INTEGER DEFAULT 0,
  billing_cycle_start TIMESTAMPTZ DEFAULT now(),
  branding JSONB DEFAULT '{"primary_color": "#3b82f6", "company_name": "Regal Master Look"}',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_tenants') THEN
    CREATE POLICY "service_role_all_tenants" ON tenants FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- -----------------------------------------------------------
-- Default project
-- -----------------------------------------------------------
INSERT INTO projects (id, name, domain)
VALUES ('default', 'Default Project', 'localhost')
ON CONFLICT (id) DO NOTHING;
