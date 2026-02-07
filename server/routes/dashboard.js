'use strict';

const { Router } = require('express');
const getDatabase = require('../db');

const router = Router();

// ============================================================================
// GET /api/dashboard/stats — Overall stats for a date range
// ============================================================================
router.get('/stats', (req, res) => {
  try {
    const db = getDatabase();
    const {
      project_id = 'default',
      date_from,
      date_to,
    } = req.query;

    // Build WHERE conditions
    const conditions = ['project_id = @project_id'];
    const params = { project_id };

    if (date_from) {
      conditions.push('started_at >= @date_from');
      params.date_from = date_from;
    }
    if (date_to) {
      conditions.push('started_at <= @date_to');
      params.date_to = date_to;
    }

    const whereClause = 'WHERE ' + conditions.join(' AND ');

    // ---- Aggregate stats ----
    const aggregates = db.prepare(`
      SELECT
        COUNT(*)                       AS total_sessions,
        SUM(page_count)                AS total_pageviews,
        COUNT(DISTINCT visitor_id)     AS unique_visitors,
        CAST(AVG(duration) AS INTEGER) AS avg_duration,
        SUM(CASE WHEN has_rage_clicks = 1 THEN 1 ELSE 0 END) AS rage_click_sessions,
        SUM(CASE WHEN has_errors = 1 THEN 1 ELSE 0 END)      AS error_sessions
      FROM sessions
      ${whereClause}
    `).get(params);

    // ---- Top pages ----
    const topPages = db.prepare(`
      SELECT url, COUNT(*) AS count
      FROM sessions
      ${whereClause} AND url IS NOT NULL
      GROUP BY url
      ORDER BY count DESC
      LIMIT 10
    `).all(params);

    // ---- Top browsers ----
    const topBrowsers = db.prepare(`
      SELECT browser, COUNT(*) AS count
      FROM sessions
      ${whereClause} AND browser IS NOT NULL
      GROUP BY browser
      ORDER BY count DESC
      LIMIT 10
    `).all(params);

    // ---- Top devices ----
    const topDevices = db.prepare(`
      SELECT device_type, COUNT(*) AS count
      FROM sessions
      ${whereClause} AND device_type IS NOT NULL
      GROUP BY device_type
      ORDER BY count DESC
      LIMIT 10
    `).all(params);

    // ---- Sessions by day ----
    const sessionsByDay = db.prepare(`
      SELECT
        date(started_at) AS date,
        COUNT(*)         AS count
      FROM sessions
      ${whereClause}
      GROUP BY date(started_at)
      ORDER BY date ASC
    `).all(params);

    res.json({
      total_sessions: aggregates.total_sessions || 0,
      total_pageviews: aggregates.total_pageviews || 0,
      unique_visitors: aggregates.unique_visitors || 0,
      avg_duration: aggregates.avg_duration || 0,
      rage_click_sessions: aggregates.rage_click_sessions || 0,
      error_sessions: aggregates.error_sessions || 0,
      top_pages: topPages,
      top_browsers: topBrowsers,
      top_devices: topDevices,
      sessions_by_day: sessionsByDay,
    });
  } catch (err) {
    console.error('[dashboard] GET /stats error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// ============================================================================
// GET /api/dashboard/live — Currently active sessions (last 5 minutes)
// ============================================================================
router.get('/live', (req, res) => {
  try {
    const db = getDatabase();
    const { project_id = 'default' } = req.query;

    // A session is considered "active" if its ended_at is within the last 5 min,
    // or if its started_at is within the last 5 min and it has no ended_at.
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const activeSessions = db.prepare(`
      SELECT *
      FROM sessions
      WHERE project_id = @project_id
        AND (
          ended_at >= @cutoff
          OR (ended_at IS NULL AND started_at >= @cutoff)
        )
      ORDER BY ended_at DESC, started_at DESC
    `).all({
      project_id,
      cutoff: fiveMinutesAgo,
    });

    res.json({
      active_sessions: activeSessions,
      count: activeSessions.length,
    });
  } catch (err) {
    console.error('[dashboard] GET /live error:', err);
    res.status(500).json({ error: 'Failed to fetch live sessions' });
  }
});

module.exports = router;
