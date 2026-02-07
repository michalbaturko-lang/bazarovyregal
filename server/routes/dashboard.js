'use strict';

const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// ============================================================================
// GET /api/dashboard/stats — Overall stats for a date range
// ============================================================================
router.get('/stats', async (req, res) => {
  try {
    const {
      project_id = 'default',
      date_from,
      date_to,
    } = req.query;

    // --- Fetch all matching sessions (select only needed columns) ---
    let sessQuery = supabase.from('sessions')
      .select('url, browser, device_type, visitor_id, duration, page_count, has_rage_clicks, has_errors, started_at')
      .eq('project_id', project_id);

    if (date_from) sessQuery = sessQuery.gte('started_at', date_from);
    if (date_to)   sessQuery = sessQuery.lte('started_at', date_to);

    const { data: sessions, error } = await sessQuery;
    if (error) throw error;

    const rows = sessions || [];

    // ---- Aggregate stats (computed in JS) ----
    let totalPageviews = 0;
    let totalDuration = 0;
    let rageClickSessions = 0;
    let errorSessions = 0;
    const visitorSet = new Set();
    const urlCounts = {};
    const browserCounts = {};
    const deviceCounts = {};
    const dayCounts = {};

    for (const s of rows) {
      totalPageviews += s.page_count || 0;
      totalDuration += s.duration || 0;
      if (s.has_rage_clicks) rageClickSessions++;
      if (s.has_errors) errorSessions++;
      if (s.visitor_id) visitorSet.add(s.visitor_id);

      // Top pages
      if (s.url) {
        urlCounts[s.url] = (urlCounts[s.url] || 0) + 1;
      }
      // Top browsers
      if (s.browser) {
        browserCounts[s.browser] = (browserCounts[s.browser] || 0) + 1;
      }
      // Top devices
      if (s.device_type) {
        deviceCounts[s.device_type] = (deviceCounts[s.device_type] || 0) + 1;
      }
      // Sessions by day
      if (s.started_at) {
        const day = s.started_at.substring(0, 10); // YYYY-MM-DD
        dayCounts[day] = (dayCounts[day] || 0) + 1;
      }
    }

    const totalSessions = rows.length;
    const avgDuration = totalSessions > 0 ? Math.floor(totalDuration / totalSessions) : 0;

    const topPages = Object.entries(urlCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([url, count]) => ({ url, count }));

    const topBrowsers = Object.entries(browserCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([browser, count]) => ({ browser, count }));

    const topDevices = Object.entries(deviceCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([device_type, count]) => ({ device_type, count }));

    const sessionsByDay = Object.entries(dayCounts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));

    res.json({
      total_sessions: totalSessions,
      total_pageviews: totalPageviews,
      unique_visitors: visitorSet.size,
      avg_duration: avgDuration,
      rage_click_sessions: rageClickSessions,
      error_sessions: errorSessions,
      top_pages: topPages,
      top_browsers: topBrowsers,
      top_devices: topDevices,
      sessions_by_day: sessionsByDay,
    });
  } catch (err) {
    console.error('[dashboard] GET /stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/dashboard/live — Currently active sessions (last 5 minutes)
// ============================================================================
router.get('/live', async (req, res) => {
  try {
    const { project_id = 'default' } = req.query;

    // A session is considered "active" if its ended_at is within the last 5 min,
    // or if its started_at is within the last 5 min and it has no ended_at.
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data: activeSessions, error } = await supabase.from('sessions')
      .select('id, visitor_id, url, started_at, ended_at, browser, os, device_type, country, identified_user_name, identified_user_email, page_count, event_count, duration, has_rage_clicks, has_errors, language')
      .eq('project_id', project_id)
      .or(`ended_at.gte.${fiveMinutesAgo},and(ended_at.is.null,started_at.gte.${fiveMinutesAgo})`)
      .order('ended_at', { ascending: false, nullsFirst: false })
      .order('started_at', { ascending: false });

    if (error) throw error;

    const sessions = activeSessions || [];

    // Compute summary stats for active sessions
    const uniquePages = new Set();
    let totalDuration = 0;
    let totalEvents = 0;
    const countryCounts = {};

    for (const s of sessions) {
      if (s.url) uniquePages.add(s.url);
      totalDuration += s.duration || 0;
      totalEvents += s.event_count || 0;
      if (s.country) {
        countryCounts[s.country] = (countryCounts[s.country] || 0) + 1;
      }
    }

    const avgDuration = sessions.length > 0 ? Math.floor(totalDuration / sessions.length) : 0;

    // Estimate events per minute based on active sessions
    const eventsPerMinute = sessions.length > 0
      ? Math.round(totalEvents / Math.max(1, totalDuration / 60))
      : 0;

    res.json({
      active_sessions: sessions,
      count: sessions.length,
      stats: {
        active_count: sessions.length,
        unique_pages: uniquePages.size,
        avg_duration: avgDuration,
        events_per_minute: eventsPerMinute,
        country_breakdown: countryCounts,
      },
    });
  } catch (err) {
    console.error('[dashboard] GET /live error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
