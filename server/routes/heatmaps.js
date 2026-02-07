'use strict';

const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// ============================================================================
// Event type constants (must match tracker & events.js)
// ============================================================================
const EVENT_TYPES = {
  MOUSE_MOVE: 3,
  MOUSE_CLICK: 4,
  SCROLL: 5,
};

const MAX_EVENTS = 10000;

// ============================================================================
// Helper: build base query with common filters
// ============================================================================
function applyFilters(query, { url, date_from, date_to, project_id }) {
  if (url) {
    query = query.eq('url', url);
  }
  if (date_from) {
    query = query.gte('created_at', date_from);
  }
  if (date_to) {
    query = query.lte('created_at', date_to);
  }
  // project_id filter requires joining with sessions; we filter by session
  // data after fetch if needed, or rely on session-level project_id.
  return query;
}

// ============================================================================
// GET /api/heatmaps/clicks
// Returns aggregated click positions for a given URL
// Query params: url, date_from, date_to, project_id
// ============================================================================
router.get('/clicks', async (req, res) => {
  try {
    const { url, date_from, date_to, project_id } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'url parameter is required' });
    }

    let query = supabase
      .from('events')
      .select('data, url, session_id')
      .eq('type', EVENT_TYPES.MOUSE_CLICK)
      .limit(MAX_EVENTS);

    query = applyFilters(query, { url, date_from, date_to, project_id });

    const { data: events, error } = await query;
    if (error) throw error;

    // Aggregate clicks into grid cells (round x,y to nearest 10px)
    const grid = {};
    let maxViewportWidth = 1920;
    let maxViewportHeight = 1080;

    for (const event of (events || [])) {
      const d = event.data;
      if (!d || d.x == null || d.y == null) continue;

      const gx = Math.round(d.x / 10) * 10;
      const gy = Math.round(d.y / 10) * 10;
      const key = `${gx},${gy}`;

      if (!grid[key]) {
        grid[key] = { x: gx, y: gy, count: 0 };
      }
      grid[key].count++;

      // Track viewport dimensions if available
      if (d.viewportWidth && d.viewportWidth > 0) {
        maxViewportWidth = Math.max(maxViewportWidth, d.viewportWidth);
      }
      if (d.viewportHeight && d.viewportHeight > 0) {
        maxViewportHeight = Math.max(maxViewportHeight, d.viewportHeight);
      }
    }

    const points = Object.values(grid).sort((a, b) => b.count - a.count);

    res.json({
      url,
      total_clicks: (events || []).length,
      points,
      viewport: { width: maxViewportWidth, height: maxViewportHeight },
    });
  } catch (err) {
    console.error('[heatmaps] GET /clicks error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/heatmaps/scroll
// Returns scroll depth data
// Query params: url, date_from, date_to, project_id
// ============================================================================
router.get('/scroll', async (req, res) => {
  try {
    const { url, date_from, date_to, project_id } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'url parameter is required' });
    }

    let query = supabase
      .from('events')
      .select('data, session_id')
      .eq('type', EVENT_TYPES.SCROLL)
      .eq('url', url)
      .limit(MAX_EVENTS);

    query = applyFilters(query, { url, date_from, date_to, project_id });

    const { data: events, error } = await query;
    if (error) throw error;

    // Calculate max scroll depth per session
    const sessionMaxScroll = {};
    for (const event of (events || [])) {
      const d = event.data;
      if (!d) continue;

      const scrollY = d.y || d.scrollY || d.scrollTop || 0;
      const sid = event.session_id;

      if (!sessionMaxScroll[sid] || scrollY > sessionMaxScroll[sid]) {
        sessionMaxScroll[sid] = scrollY;
      }
    }

    const totalSessions = Object.keys(sessionMaxScroll).length;

    // Bucket by 100px increments
    const maxDepth = Math.max(0, ...Object.values(sessionMaxScroll));
    const bucketCount = Math.ceil(maxDepth / 100) + 1;
    const depths = [];

    for (let i = 0; i < bucketCount && i < 200; i++) {
      const depthY = i * 100;
      // Count sessions that scrolled at least to this depth
      const sessionsReaching = Object.values(sessionMaxScroll).filter(
        maxY => maxY >= depthY
      ).length;
      const percentage = totalSessions > 0
        ? Math.round((sessionsReaching / totalSessions) * 1000) / 10
        : 0;

      depths.push({
        y: depthY,
        sessions: sessionsReaching,
        percentage,
      });
    }

    res.json({
      url,
      total_sessions: totalSessions,
      depths,
    });
  } catch (err) {
    console.error('[heatmaps] GET /scroll error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/heatmaps/moves
// Returns mouse movement heatmap data
// Query params: url, date_from, date_to, project_id
// ============================================================================
router.get('/moves', async (req, res) => {
  try {
    const { url, date_from, date_to, project_id } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'url parameter is required' });
    }

    let query = supabase
      .from('events')
      .select('data, url')
      .eq('type', EVENT_TYPES.MOUSE_MOVE)
      .limit(MAX_EVENTS);

    query = applyFilters(query, { url, date_from, date_to, project_id });

    const { data: events, error } = await query;
    if (error) throw error;

    // Sample and aggregate positions (round to 20px grid for moves)
    const grid = {};

    for (const event of (events || [])) {
      const d = event.data;
      if (!d) continue;

      // Mouse move events may contain positions array or single x,y
      const positions = d.positions || (d.x != null ? [{ x: d.x, y: d.y }] : []);

      for (const pos of positions) {
        if (pos.x == null || pos.y == null) continue;
        const gx = Math.round(pos.x / 20) * 20;
        const gy = Math.round(pos.y / 20) * 20;
        const key = `${gx},${gy}`;

        if (!grid[key]) {
          grid[key] = { x: gx, y: gy, count: 0 };
        }
        grid[key].count++;
      }
    }

    const points = Object.values(grid).sort((a, b) => b.count - a.count);
    const maxIntensity = points.length > 0 ? points[0].count : 0;

    // Normalize intensity to 0-1 range
    const normalizedPoints = points.map(p => ({
      x: p.x,
      y: p.y,
      intensity: maxIntensity > 0 ? Math.round((p.count / maxIntensity) * 100) / 100 : 0,
      count: p.count,
    }));

    res.json({
      url,
      total_moves: (events || []).length,
      points: normalizedPoints,
    });
  } catch (err) {
    console.error('[heatmaps] GET /moves error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/heatmaps/pages
// Returns list of URLs that have recorded click data, with counts
// Query params: project_id
// ============================================================================
router.get('/pages', async (req, res) => {
  try {
    const { project_id } = req.query;

    // Fetch click events to find unique pages
    let query = supabase
      .from('events')
      .select('url')
      .eq('type', EVENT_TYPES.MOUSE_CLICK)
      .not('url', 'is', null)
      .limit(MAX_EVENTS);

    const { data: events, error } = await query;
    if (error) throw error;

    // Aggregate by URL
    const urlCounts = {};
    for (const event of (events || [])) {
      if (!event.url) continue;
      if (!urlCounts[event.url]) {
        urlCounts[event.url] = 0;
      }
      urlCounts[event.url]++;
    }

    const pages = Object.entries(urlCounts)
      .map(([url, clicks]) => ({ url, clicks }))
      .sort((a, b) => b.clicks - a.clicks);

    res.json({ pages });
  } catch (err) {
    console.error('[heatmaps] GET /pages error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
