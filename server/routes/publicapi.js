'use strict';

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const supabase = require('../supabase');

// ============================================================================
// Rate limiting — in-memory, 100 requests/minute per API key
// ============================================================================
const RATE_LIMIT = 100;
const RATE_WINDOW_MS = 60 * 1000; // 1 minute
const rateBuckets = new Map(); // keyHash -> { count, resetAt }

/** Clean up expired rate limit entries every 5 minutes */
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets) {
    if (bucket.resetAt <= now) {
      rateBuckets.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Check and increment rate limit for a given key hash.
 * Returns { allowed: boolean, remaining: number, resetAt: number }
 */
function checkRateLimit(keyHash) {
  const now = Date.now();
  let bucket = rateBuckets.get(keyHash);

  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + RATE_WINDOW_MS };
    rateBuckets.set(keyHash, bucket);
  }

  bucket.count++;

  return {
    allowed: bucket.count <= RATE_LIMIT,
    remaining: Math.max(0, RATE_LIMIT - bucket.count),
    resetAt: bucket.resetAt,
  };
}

// ============================================================================
// API Key Authentication Middleware
// ============================================================================
async function apiKeyAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header. Use: Authorization: Bearer rml_k_xxx',
      });
    }

    const rawKey = authHeader.replace('Bearer ', '').trim();

    if (!rawKey.startsWith('rml_k_')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key format. Keys must start with rml_k_',
      });
    }

    // Hash the key and look up in the database
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const { data: apiKey, error } = await supabase.from('api_keys')
      .select('id, project_id, name, scopes, active')
      .eq('key_hash', keyHash)
      .single();

    if (error || !apiKey) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key',
      });
    }

    if (!apiKey.active) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'This API key has been deactivated',
      });
    }

    // Rate limiting
    const rateResult = checkRateLimit(keyHash);
    res.set('X-RateLimit-Limit', String(RATE_LIMIT));
    res.set('X-RateLimit-Remaining', String(rateResult.remaining));
    res.set('X-RateLimit-Reset', String(Math.ceil(rateResult.resetAt / 1000)));

    if (!rateResult.allowed) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit of ${RATE_LIMIT} requests per minute exceeded`,
        retry_after: Math.ceil((rateResult.resetAt - Date.now()) / 1000),
      });
    }

    // Increment usage counter and update last_used_at (fire-and-forget)
    supabase.from('api_keys')
      .update({
        request_count: (apiKey.request_count || 0) + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', apiKey.id)
      .then(() => {})
      .catch(() => {});

    // Also do an RPC-style increment to avoid race conditions
    supabase.rpc('', {}).catch(() => {});
    // Fallback: simple update with raw SQL-like increment isn't available in JS client,
    // so we just do the update above. For production, use an RPC function.

    // Attach API key info to request
    req.apiKey = apiKey;
    req.projectId = apiKey.project_id;

    next();
  } catch (err) {
    console.error('[publicapi] Auth middleware error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Apply auth middleware to all routes
router.use(apiKeyAuth);

// ============================================================================
// Scope checking helper
// ============================================================================
function requireScope(scope) {
  return (req, res, next) => {
    const scopes = req.apiKey.scopes || [];
    if (!scopes.includes(scope)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `This API key does not have the '${scope}' scope`,
      });
    }
    next();
  };
}

// ============================================================================
// GET /api/v1/sessions — List sessions with pagination
// ============================================================================
router.get('/sessions', requireScope('read:sessions'), async (req, res) => {
  try {
    const {
      limit: rawLimit = '50',
      offset: rawOffset = '0',
      date_from,
      date_to,
    } = req.query;

    const limit = Math.min(200, Math.max(1, parseInt(rawLimit, 10) || 50));
    const offset = Math.max(0, parseInt(rawOffset, 10) || 0);

    // Count query
    let countQuery = supabase.from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', req.projectId);

    let dataQuery = supabase.from('sessions')
      .select('id, visitor_id, started_at, ended_at, duration, url, browser, os, device_type, country, language, page_count, event_count, has_rage_clicks, has_errors, identified_user_id, identified_user_email, identified_user_name')
      .eq('project_id', req.projectId);

    if (date_from) {
      countQuery = countQuery.gte('started_at', date_from);
      dataQuery = dataQuery.gte('started_at', date_from);
    }
    if (date_to) {
      countQuery = countQuery.lte('started_at', date_to);
      dataQuery = dataQuery.lte('started_at', date_to);
    }

    const { count: total, error: countError } = await countQuery;
    if (countError) throw countError;

    const { data: sessions, error: dataError } = await dataQuery
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (dataError) throw dataError;

    res.json({
      data: sessions || [],
      total: total || 0,
      limit,
      offset,
      has_more: (offset + limit) < (total || 0),
    });
  } catch (err) {
    console.error('[publicapi] GET /sessions error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/v1/sessions/:id — Get session details
// ============================================================================
router.get('/sessions/:id', requireScope('read:sessions'), async (req, res) => {
  try {
    const { id } = req.params;

    const { data: session, error } = await supabase.from('sessions')
      .select('*')
      .eq('id', id)
      .eq('project_id', req.projectId)
      .single();

    if (error || !session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ data: session });
  } catch (err) {
    console.error('[publicapi] GET /sessions/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/v1/sessions/:id/events — Get events for a session
// ============================================================================
router.get('/sessions/:id/events', requireScope('read:events'), async (req, res) => {
  try {
    const { id } = req.params;
    const { limit: rawLimit = '500', offset: rawOffset = '0' } = req.query;

    const limit = Math.min(1000, Math.max(1, parseInt(rawLimit, 10) || 500));
    const offset = Math.max(0, parseInt(rawOffset, 10) || 0);

    // Verify session belongs to this project
    const { data: session, error: sessError } = await supabase.from('sessions')
      .select('id')
      .eq('id', id)
      .eq('project_id', req.projectId)
      .single();

    if (sessError || !session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const { count: total, error: countError } = await supabase.from('events')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', id);
    if (countError) throw countError;

    const { data: events, error: dataError } = await supabase.from('events')
      .select('id, session_id, type, timestamp, data, url, created_at')
      .eq('session_id', id)
      .order('timestamp', { ascending: true })
      .range(offset, offset + limit - 1);
    if (dataError) throw dataError;

    res.json({
      data: events || [],
      total: total || 0,
      limit,
      offset,
      has_more: (offset + limit) < (total || 0),
    });
  } catch (err) {
    console.error('[publicapi] GET /sessions/:id/events error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/v1/analytics/overview — Dashboard stats
// ============================================================================
router.get('/analytics/overview', requireScope('read:analytics'), async (req, res) => {
  try {
    const { date_from, date_to } = req.query;

    let sessQuery = supabase.from('sessions')
      .select('url, visitor_id, duration, page_count, has_rage_clicks, has_errors, started_at')
      .eq('project_id', req.projectId);

    if (date_from) sessQuery = sessQuery.gte('started_at', date_from);
    if (date_to) sessQuery = sessQuery.lte('started_at', date_to);

    const { data: sessions, error } = await sessQuery;
    if (error) throw error;

    const rows = sessions || [];
    let totalDuration = 0;
    let bounceSessions = 0;
    const visitorSet = new Set();

    for (const s of rows) {
      totalDuration += s.duration || 0;
      if (s.visitor_id) visitorSet.add(s.visitor_id);
      if ((s.page_count || 1) <= 1 && (s.duration || 0) < 10) {
        bounceSessions++;
      }
    }

    const totalSessions = rows.length;
    const avgDuration = totalSessions > 0 ? Math.floor(totalDuration / totalSessions) : 0;
    const bounceRate = totalSessions > 0
      ? parseFloat(((bounceSessions / totalSessions) * 100).toFixed(1))
      : 0;

    res.json({
      data: {
        total_sessions: totalSessions,
        unique_visitors: visitorSet.size,
        avg_duration: avgDuration,
        bounce_rate: bounceRate,
      },
    });
  } catch (err) {
    console.error('[publicapi] GET /analytics/overview error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/v1/analytics/pages — Top pages with metrics
// ============================================================================
router.get('/analytics/pages', requireScope('read:analytics'), async (req, res) => {
  try {
    const { date_from, date_to, limit: rawLimit = '20' } = req.query;
    const limit = Math.min(100, Math.max(1, parseInt(rawLimit, 10) || 20));

    let sessQuery = supabase.from('sessions')
      .select('url, duration, visitor_id')
      .eq('project_id', req.projectId);

    if (date_from) sessQuery = sessQuery.gte('started_at', date_from);
    if (date_to) sessQuery = sessQuery.lte('started_at', date_to);

    const { data: sessions, error } = await sessQuery;
    if (error) throw error;

    const rows = sessions || [];
    const pageMap = {};

    for (const s of rows) {
      if (!s.url) continue;
      if (!pageMap[s.url]) {
        pageMap[s.url] = { views: 0, totalDuration: 0, visitors: new Set() };
      }
      pageMap[s.url].views++;
      pageMap[s.url].totalDuration += s.duration || 0;
      if (s.visitor_id) pageMap[s.url].visitors.add(s.visitor_id);
    }

    const pages = Object.entries(pageMap)
      .map(([url, stats]) => ({
        url,
        views: stats.views,
        unique_visitors: stats.visitors.size,
        avg_duration: stats.views > 0 ? Math.floor(stats.totalDuration / stats.views) : 0,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, limit);

    res.json({ data: pages });
  } catch (err) {
    console.error('[publicapi] GET /analytics/pages error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/v1/analytics/errors — Error summary
// ============================================================================
router.get('/analytics/errors', requireScope('read:analytics'), async (req, res) => {
  try {
    const { date_from, date_to } = req.query;

    // Get session IDs for the project
    let sessQuery = supabase.from('sessions')
      .select('id')
      .eq('project_id', req.projectId);

    if (date_from) sessQuery = sessQuery.gte('started_at', date_from);
    if (date_to) sessQuery = sessQuery.lte('started_at', date_to);

    const { data: sessions, error: sessError } = await sessQuery;
    if (sessError) throw sessError;

    const sessionIds = (sessions || []).map(s => s.id);
    const totalSessions = sessionIds.length;

    if (totalSessions === 0) {
      return res.json({
        data: {
          total_errors: 0,
          unique_errors: 0,
          affected_sessions: 0,
          error_rate: 0,
        },
      });
    }

    // Fetch error events (type = 11) in batches
    const BATCH = 200;
    const allErrors = [];
    for (let i = 0; i < sessionIds.length; i += BATCH) {
      const batch = sessionIds.slice(i, i + BATCH);
      const { data: events, error: evtError } = await supabase.from('events')
        .select('session_id, data')
        .eq('type', 11)
        .in('session_id', batch);
      if (evtError) throw evtError;
      if (events) allErrors.push(...events);
    }

    const messageSet = new Set();
    const affectedSet = new Set();

    for (const evt of allErrors) {
      const msg = (evt.data && evt.data.message) || 'Unknown';
      messageSet.add(msg);
      affectedSet.add(evt.session_id);
    }

    res.json({
      data: {
        total_errors: allErrors.length,
        unique_errors: messageSet.size,
        affected_sessions: affectedSet.size,
        error_rate: totalSessions > 0
          ? parseFloat((allErrors.length / totalSessions).toFixed(2))
          : 0,
      },
    });
  } catch (err) {
    console.error('[publicapi] GET /analytics/errors error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/v1/analytics/performance — Web Vitals summary
// ============================================================================
router.get('/analytics/performance', requireScope('read:analytics'), async (req, res) => {
  try {
    const { date_from, date_to } = req.query;

    // Get session IDs
    let sessQuery = supabase.from('sessions')
      .select('id')
      .eq('project_id', req.projectId);

    if (date_from) sessQuery = sessQuery.gte('started_at', date_from);
    if (date_to) sessQuery = sessQuery.lte('started_at', date_to);

    const { data: sessions, error: sessError } = await sessQuery;
    if (sessError) throw sessError;

    const sessionIds = (sessions || []).map(s => s.id);

    if (sessionIds.length === 0) {
      return res.json({
        data: { sample_count: 0, lcp: null, cls: null, fid: null, inp: null, ttfb: null },
      });
    }

    // Fetch web_vitals events in batches
    const BATCH = 100;
    const allVitals = [];
    for (let i = 0; i < sessionIds.length; i += BATCH) {
      const batch = sessionIds.slice(i, i + BATCH);
      const { data: events, error: evtError } = await supabase.from('events')
        .select('data')
        .in('session_id', batch);
      if (evtError) throw evtError;
      if (events) {
        for (const evt of events) {
          if (evt.data && evt.data.name === 'web_vitals') {
            allVitals.push(evt.data.properties || evt.data.props || {});
          }
        }
      }
    }

    // Collect metric values
    const metrics = { lcp: [], cls: [], fid: [], inp: [], ttfb: [] };
    for (const props of allVitals) {
      if (props.lcp != null) metrics.lcp.push(Number(props.lcp));
      if (props.cls != null) metrics.cls.push(Number(props.cls));
      if (props.fid != null) metrics.fid.push(Number(props.fid));
      if (props.inp != null) metrics.inp.push(Number(props.inp));
      if (props.ttfb != null) metrics.ttfb.push(Number(props.ttfb));
    }

    // Compute p75 for each metric
    function p75(arr) {
      if (!arr.length) return null;
      const sorted = arr.slice().sort((a, b) => a - b);
      const idx = Math.ceil(0.75 * sorted.length) - 1;
      return sorted[Math.max(0, idx)];
    }

    res.json({
      data: {
        sample_count: allVitals.length,
        lcp: { p75: p75(metrics.lcp), avg: metrics.lcp.length ? Math.round(metrics.lcp.reduce((a, b) => a + b, 0) / metrics.lcp.length) : null },
        cls: { p75: p75(metrics.cls), avg: metrics.cls.length ? Math.round(metrics.cls.reduce((a, b) => a + b, 0) / metrics.cls.length * 1000) / 1000 : null },
        fid: { p75: p75(metrics.fid), avg: metrics.fid.length ? Math.round(metrics.fid.reduce((a, b) => a + b, 0) / metrics.fid.length) : null },
        inp: { p75: p75(metrics.inp), avg: metrics.inp.length ? Math.round(metrics.inp.reduce((a, b) => a + b, 0) / metrics.inp.length) : null },
        ttfb: { p75: p75(metrics.ttfb), avg: metrics.ttfb.length ? Math.round(metrics.ttfb.reduce((a, b) => a + b, 0) / metrics.ttfb.length) : null },
      },
    });
  } catch (err) {
    console.error('[publicapi] GET /analytics/performance error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /api/v1/events — Ingest custom events (server-side tracking)
// ============================================================================
router.post('/events', requireScope('write:events'), async (req, res) => {
  try {
    const { session_id, events } = req.body;

    if (!session_id || typeof session_id !== 'string') {
      return res.status(400).json({ error: 'session_id is required' });
    }

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'events array is required and must not be empty' });
    }

    if (events.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 events per request' });
    }

    // Verify session exists and belongs to this project
    const { data: session, error: sessError } = await supabase.from('sessions')
      .select('id')
      .eq('id', session_id)
      .eq('project_id', req.projectId)
      .single();

    if (sessError || !session) {
      return res.status(404).json({ error: 'Session not found or does not belong to this project' });
    }

    // Build event rows (custom events = type 14)
    const eventRows = events.map(evt => ({
      session_id,
      type: 14, // CUSTOM_EVENT
      timestamp: evt.timestamp || Date.now(),
      data: {
        name: evt.name || 'custom_event',
        properties: evt.properties || {},
      },
      url: evt.url || null,
    }));

    const { error: insertError } = await supabase.from('events')
      .insert(eventRows);
    if (insertError) throw insertError;

    // Update session event_count
    const { data: currentSession } = await supabase.from('sessions')
      .select('event_count')
      .eq('id', session_id)
      .single();

    if (currentSession) {
      await supabase.from('sessions')
        .update({ event_count: (currentSession.event_count || 0) + eventRows.length })
        .eq('id', session_id);
    }

    res.json({
      success: true,
      stored: eventRows.length,
    });
  } catch (err) {
    console.error('[publicapi] POST /events error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
