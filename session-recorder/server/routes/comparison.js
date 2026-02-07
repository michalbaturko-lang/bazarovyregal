'use strict';

const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// ============================================================================
// Constants
// ============================================================================
const EVENT_TYPE_CUSTOM = 12;

// ============================================================================
// Helper: fetch sessions for a given period
// ============================================================================
async function fetchSessionsForPeriod(project_id, period_start, period_end) {
  let query = supabase.from('sessions')
    .select('id, url, browser, os, device_type, visitor_id, duration, page_count, has_rage_clicks, has_errors, started_at, event_count')
    .eq('project_id', project_id || 'default');

  if (period_start) query = query.gte('started_at', period_start);
  if (period_end)   query = query.lte('started_at', period_end);

  const { data: sessions, error } = await query;
  if (error) throw error;

  return sessions || [];
}

// ============================================================================
// Helper: compute aggregate metrics from sessions array
// ============================================================================
function computeMetrics(sessions) {
  const totalSessions = sessions.length;
  let totalDuration = 0;
  let totalPageViews = 0;
  let rageClickSessions = 0;
  let errorSessions = 0;
  const visitorSet = new Set();
  const urlCounts = {};
  const browserCounts = {};
  const deviceCounts = {};
  const dayCounts = {};

  // Bounce = sessions with only 1 page view or duration < 10 seconds
  let bounceSessions = 0;

  for (const s of sessions) {
    totalDuration += s.duration || 0;
    totalPageViews += s.page_count || 0;
    if (s.has_rage_clicks) rageClickSessions++;
    if (s.has_errors) errorSessions++;
    if (s.visitor_id) visitorSet.add(s.visitor_id);

    if ((s.page_count || 0) <= 1 && (s.duration || 0) < 10) {
      bounceSessions++;
    }

    if (s.url) {
      urlCounts[s.url] = (urlCounts[s.url] || 0) + 1;
    }
    if (s.browser) {
      browserCounts[s.browser] = (browserCounts[s.browser] || 0) + 1;
    }
    if (s.device_type) {
      deviceCounts[s.device_type] = (deviceCounts[s.device_type] || 0) + 1;
    }
    if (s.started_at) {
      const day = s.started_at.substring(0, 10);
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    }
  }

  const avgDuration = totalSessions > 0 ? Math.round(totalDuration / totalSessions) : 0;
  const bounceRate = totalSessions > 0 ? Math.round((bounceSessions / totalSessions) * 1000) / 10 : 0;

  return {
    total_sessions: totalSessions,
    total_page_views: totalPageViews,
    unique_visitors: visitorSet.size,
    avg_duration: avgDuration,
    bounce_rate: bounceRate,
    rage_click_sessions: rageClickSessions,
    error_sessions: errorSessions,
    url_counts: urlCounts,
    browser_counts: browserCounts,
    device_counts: deviceCounts,
    day_counts: dayCounts,
  };
}

// ============================================================================
// Helper: calculate percentage change between two values
// ============================================================================
function pctChange(newVal, oldVal) {
  if (oldVal === 0) {
    return newVal > 0 ? 100 : 0;
  }
  return Math.round(((newVal - oldVal) / oldVal) * 1000) / 10;
}

// ============================================================================
// GET /api/comparison/overview
// Compare two date periods: sessions, page views, avg duration, bounce rate
// ============================================================================
router.get('/overview', async (req, res) => {
  try {
    const {
      project_id = 'default',
      period1_start,
      period1_end,
      period2_start,
      period2_end,
    } = req.query;

    if (!period1_start || !period1_end || !period2_start || !period2_end) {
      return res.status(400).json({
        error: 'period1_start, period1_end, period2_start, and period2_end are all required',
      });
    }

    const [sessions1, sessions2] = await Promise.all([
      fetchSessionsForPeriod(project_id, period1_start, period1_end),
      fetchSessionsForPeriod(project_id, period2_start, period2_end),
    ]);

    const metrics1 = computeMetrics(sessions1);
    const metrics2 = computeMetrics(sessions2);

    const changes = {
      total_sessions: pctChange(metrics2.total_sessions, metrics1.total_sessions),
      total_page_views: pctChange(metrics2.total_page_views, metrics1.total_page_views),
      unique_visitors: pctChange(metrics2.unique_visitors, metrics1.unique_visitors),
      avg_duration: pctChange(metrics2.avg_duration, metrics1.avg_duration),
      bounce_rate: pctChange(metrics2.bounce_rate, metrics1.bounce_rate),
      rage_click_sessions: pctChange(metrics2.rage_click_sessions, metrics1.rage_click_sessions),
      error_sessions: pctChange(metrics2.error_sessions, metrics1.error_sessions),
    };

    // Sessions by day for overlay chart
    const days1 = Object.entries(metrics1.day_counts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));

    const days2 = Object.entries(metrics2.day_counts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));

    res.json({
      period1: {
        start: period1_start,
        end: period1_end,
        total_sessions: metrics1.total_sessions,
        total_page_views: metrics1.total_page_views,
        unique_visitors: metrics1.unique_visitors,
        avg_duration: metrics1.avg_duration,
        bounce_rate: metrics1.bounce_rate,
        rage_click_sessions: metrics1.rage_click_sessions,
        error_sessions: metrics1.error_sessions,
        sessions_by_day: days1,
      },
      period2: {
        start: period2_start,
        end: period2_end,
        total_sessions: metrics2.total_sessions,
        total_page_views: metrics2.total_page_views,
        unique_visitors: metrics2.unique_visitors,
        avg_duration: metrics2.avg_duration,
        bounce_rate: metrics2.bounce_rate,
        rage_click_sessions: metrics2.rage_click_sessions,
        error_sessions: metrics2.error_sessions,
        sessions_by_day: days2,
      },
      changes,
    });
  } catch (err) {
    console.error('[comparison] GET /overview error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/comparison/pages
// Compare per-page metrics between two periods
// ============================================================================
router.get('/pages', async (req, res) => {
  try {
    const {
      project_id = 'default',
      period1_start,
      period1_end,
      period2_start,
      period2_end,
    } = req.query;

    if (!period1_start || !period1_end || !period2_start || !period2_end) {
      return res.status(400).json({
        error: 'All period parameters are required',
      });
    }

    const [sessions1, sessions2] = await Promise.all([
      fetchSessionsForPeriod(project_id, period1_start, period1_end),
      fetchSessionsForPeriod(project_id, period2_start, period2_end),
    ]);

    const metrics1 = computeMetrics(sessions1);
    const metrics2 = computeMetrics(sessions2);

    // Collect all unique URLs
    const allUrls = new Set([
      ...Object.keys(metrics1.url_counts),
      ...Object.keys(metrics2.url_counts),
    ]);

    const pages = Array.from(allUrls).map(url => {
      const count1 = metrics1.url_counts[url] || 0;
      const count2 = metrics2.url_counts[url] || 0;
      return {
        url,
        sessions_period1: count1,
        sessions_period2: count2,
        change_pct: pctChange(count2, count1),
        absolute_change: count2 - count1,
      };
    }).sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct));

    res.json({ pages });
  } catch (err) {
    console.error('[comparison] GET /pages error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/comparison/devices
// Compare device/browser breakdown between two periods
// ============================================================================
router.get('/devices', async (req, res) => {
  try {
    const {
      project_id = 'default',
      period1_start,
      period1_end,
      period2_start,
      period2_end,
    } = req.query;

    if (!period1_start || !period1_end || !period2_start || !period2_end) {
      return res.status(400).json({
        error: 'All period parameters are required',
      });
    }

    const [sessions1, sessions2] = await Promise.all([
      fetchSessionsForPeriod(project_id, period1_start, period1_end),
      fetchSessionsForPeriod(project_id, period2_start, period2_end),
    ]);

    const metrics1 = computeMetrics(sessions1);
    const metrics2 = computeMetrics(sessions2);

    // Device comparison
    const allDevices = new Set([
      ...Object.keys(metrics1.device_counts),
      ...Object.keys(metrics2.device_counts),
    ]);

    const devices = Array.from(allDevices).map(device => ({
      device,
      count_period1: metrics1.device_counts[device] || 0,
      count_period2: metrics2.device_counts[device] || 0,
      change_pct: pctChange(
        metrics2.device_counts[device] || 0,
        metrics1.device_counts[device] || 0
      ),
    })).sort((a, b) => (b.count_period1 + b.count_period2) - (a.count_period1 + a.count_period2));

    // Browser comparison
    const allBrowsers = new Set([
      ...Object.keys(metrics1.browser_counts),
      ...Object.keys(metrics2.browser_counts),
    ]);

    const browsers = Array.from(allBrowsers).map(browser => ({
      browser,
      count_period1: metrics1.browser_counts[browser] || 0,
      count_period2: metrics2.browser_counts[browser] || 0,
      change_pct: pctChange(
        metrics2.browser_counts[browser] || 0,
        metrics1.browser_counts[browser] || 0
      ),
    })).sort((a, b) => (b.count_period1 + b.count_period2) - (a.count_period1 + a.count_period2));

    res.json({ devices, browsers });
  } catch (err) {
    console.error('[comparison] GET /devices error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
