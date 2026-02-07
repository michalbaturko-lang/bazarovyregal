-- ==========================================================================
-- Regal Master Look — Remove ALL seed/demo data
-- Run this in Supabase SQL Editor to clean up test data
-- Real data from your e-shops will continue flowing in via the tracker
-- ==========================================================================

-- Delete in correct order (respecting foreign keys)
DELETE FROM session_notes;
DELETE FROM events;
DELETE FROM sessions;
DELETE FROM funnels;
DELETE FROM segments;

-- Keep the default project (tracker sends data to project_id = 'default')
-- If you want to reset it too, uncomment the next 2 lines:
-- DELETE FROM projects;
-- INSERT INTO projects (id, name, domain) VALUES ('default', 'Default Project', 'localhost') ON CONFLICT (id) DO NOTHING;

-- Verify cleanup
SELECT 'sessions' AS table_name, COUNT(*) AS row_count FROM sessions
UNION ALL
SELECT 'events', COUNT(*) FROM events
UNION ALL
SELECT 'funnels', COUNT(*) FROM funnels
UNION ALL
SELECT 'segments', COUNT(*) FROM segments
UNION ALL
SELECT 'session_notes', COUNT(*) FROM session_notes;
