'use strict';

const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// ============================================================================
// Event type constants (must match tracker & events.js)
// ============================================================================
const EVENT_TYPES = {
  SESSION_START: 0,
  MOUSE_MOVE: 3,
  MOUSE_CLICK: 4,
  SCROLL: 5,
  PAGE_NAVIGATION: 14,
};

const MAX_EVENTS = 10000;

// ============================================================================
// Helper: get session IDs for a project (for filtering events by project)
// ============================================================================
async function getProjectSessionIds(project_id, date_from, date_to) {
  if (!project_id) return null; // no filter

  let q = supabase.from('sessions').select('id').eq('project_id', project_id);
  if (date_from) q = q.gte('started_at', date_from);
  if (date_to) q = q.lte('started_at', date_to.length === 10 ? date_to + 'T23:59:59.999Z' : date_to);

  const { data, error } = await q.limit(5000);
  if (error) throw error;
  return (data || []).map(s => s.id);
}

// ============================================================================
// Helper: apply session filter to events query
// ============================================================================
function applySessionFilter(query, sessionIds) {
  if (sessionIds && sessionIds.length > 0) {
    // Process in batches if too many
    if (sessionIds.length <= 500) {
      query = query.in('session_id', sessionIds);
    }
    // For larger sets we skip session filtering to avoid massive IN clauses
  }
  return query;
}

// ============================================================================
// GET /api/heatmaps/pages
// Returns list of URLs that have recorded data, with click counts.
// Uses events (click URLs) + sessions (start URLs) + page navigation events.
// Query params: project_id
// ============================================================================
router.get('/pages', async (req, res) => {
  try {
    const { project_id } = req.query;

    // Get session IDs for this project
    const sessionIds = await getProjectSessionIds(project_id);

    // 1. Get URLs from click events
    let clickQuery = supabase
      .from('events')
      .select('url')
      .eq('type', EVENT_TYPES.MOUSE_CLICK)
      .not('url', 'is', null)
      .limit(MAX_EVENTS);
    clickQuery = applySessionFilter(clickQuery, sessionIds);
    const { data: clickEvents, error: clickErr } = await clickQuery;
    if (clickErr) console.warn('[heatmaps] click events query error:', clickErr.message);

    // 2. Get URLs from sessions (starting page)
    let sessQuery = supabase.from('sessions').select('url').not('url', 'is', null);
    if (project_id) sessQuery = sessQuery.eq('project_id', project_id);
    const { data: sessRows, error: sessErr } = await sessQuery.limit(2000);
    if (sessErr) console.warn('[heatmaps] sessions query error:', sessErr.message);

    // 3. Get URLs from PAGE_NAVIGATION events (data->>'to')
    let navQuery = supabase
      .from('events')
      .select('data')
      .eq('type', EVENT_TYPES.PAGE_NAVIGATION)
      .limit(MAX_EVENTS);
    navQuery = applySessionFilter(navQuery, sessionIds);
    const { data: navEvents, error: navErr } = await navQuery;
    if (navErr) console.warn('[heatmaps] nav events query error:', navErr.message);

    // Aggregate all URLs
    const urlCounts = {};

    for (const e of (clickEvents || [])) {
      if (!e.url) continue;
      // Normalize: strip query params and hash for grouping
      const normalized = normalizeUrl(e.url);
      urlCounts[normalized] = (urlCounts[normalized] || 0) + 1;
    }

    // Add session start URLs (count as 1 "visit" each)
    for (const s of (sessRows || [])) {
      if (!s.url) continue;
      const normalized = normalizeUrl(s.url);
      if (!urlCounts[normalized]) urlCounts[normalized] = 0;
      // Don't inflate click count — just ensure the page appears in the list
    }

    // Add PAGE_NAVIGATION destinations
    for (const e of (navEvents || [])) {
      const d = e.data;
      if (!d || !d.to) continue;
      const normalized = normalizeUrl(d.to);
      if (!urlCounts[normalized]) urlCounts[normalized] = 0;
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

    const sessionIds = await getProjectSessionIds(project_id, date_from, date_to);

    let query = supabase
      .from('events')
      .select('data, url, session_id')
      .eq('type', EVENT_TYPES.MOUSE_CLICK)
      .limit(MAX_EVENTS);

    // URL matching: use ilike for partial match (events store full URLs)
    query = query.ilike('url', `%${url}%`);

    if (date_from) query = query.gte('created_at', date_from);
    if (date_to) query = query.lte('created_at', date_to.length === 10 ? date_to + 'T23:59:59.999Z' : date_to);
    query = applySessionFilter(query, sessionIds);

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

    const sessionIds = await getProjectSessionIds(project_id, date_from, date_to);

    let query = supabase
      .from('events')
      .select('data, session_id')
      .eq('type', EVENT_TYPES.SCROLL)
      .ilike('url', `%${url}%`)
      .limit(MAX_EVENTS);

    if (date_from) query = query.gte('created_at', date_from);
    if (date_to) query = query.lte('created_at', date_to.length === 10 ? date_to + 'T23:59:59.999Z' : date_to);
    query = applySessionFilter(query, sessionIds);

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

    const sessionIds = await getProjectSessionIds(project_id, date_from, date_to);

    let query = supabase
      .from('events')
      .select('data, url')
      .eq('type', EVENT_TYPES.MOUSE_MOVE)
      .ilike('url', `%${url}%`)
      .limit(MAX_EVENTS);

    if (date_from) query = query.gte('created_at', date_from);
    if (date_to) query = query.lte('created_at', date_to.length === 10 ? date_to + 'T23:59:59.999Z' : date_to);
    query = applySessionFilter(query, sessionIds);

    const { data: events, error } = await query;
    if (error) throw error;

    // Sample and aggregate positions (round to 20px grid for moves)
    const grid = {};

    for (const event of (events || [])) {
      const d = event.data;
      if (!d) continue;

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
// Helper: normalize URL for grouping (strip query params, hash, trailing slash)
// ============================================================================
function normalizeUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    let path = u.pathname.replace(/\/+$/, '') || '/';
    return u.origin + path;
  } catch (_) {
    return rawUrl;
  }
}

module.exports = router;
