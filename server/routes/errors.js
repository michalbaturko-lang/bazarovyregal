'use strict';

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const supabase = require('../supabase');

// JS_ERROR event type (must match tracker EVT.JS_ERROR)
const JS_ERROR_TYPE = 11;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Normalize an error message by stripping variable parts so that
 * semantically identical errors are grouped together.
 *   - Strips line/column numbers (e.g. "at foo.js:123:45")
 *   - Replaces hex addresses (0x...)
 *   - Replaces long numeric sequences
 *   - Collapses whitespace
 */
function normalizeMessage(msg) {
  if (!msg) return 'Unknown error';
  return msg
    .replace(/:\d+:\d+/g, ':*:*')             // line:col
    .replace(/:\d+\)?$/gm, ':*)')             // trailing line numbers
    .replace(/0x[0-9a-fA-F]+/g, '0x*')        // hex addresses
    .replace(/\b\d{6,}\b/g, '*')              // long numeric IDs
    .replace(/\s+/g, ' ')                      // collapse whitespace
    .trim();
}

/**
 * Create a stable hash from a normalized error message for grouping.
 */
function hashMessage(normalizedMsg) {
  return crypto.createHash('md5').update(normalizedMsg).digest('hex').slice(0, 12);
}

/**
 * Build a base sessions query filtered by project_id and date range,
 * returning only the session IDs.
 */
async function getFilteredSessionIds(projectId, dateFrom, dateTo) {
  let query = supabase.from('sessions')
    .select('id')
    .eq('project_id', projectId);

  if (dateFrom) query = query.gte('started_at', dateFrom);
  if (dateTo)   query = query.lte('started_at', dateTo);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(s => s.id);
}

/**
 * Fetch error events for a set of session IDs.
 * Returns raw event rows with type = JS_ERROR_TYPE.
 * Supabase .in() has a practical limit, so we batch if needed.
 */
async function getErrorEvents(sessionIds) {
  if (!sessionIds || sessionIds.length === 0) return [];

  const BATCH_SIZE = 200;
  const allEvents = [];

  for (let i = 0; i < sessionIds.length; i += BATCH_SIZE) {
    const batch = sessionIds.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase.from('events')
      .select('id, session_id, type, timestamp, data, url, created_at')
      .eq('type', JS_ERROR_TYPE)
      .in('session_id', batch)
      .order('timestamp', { ascending: true });

    if (error) throw error;
    if (data) allEvents.push(...data);
  }

  return allEvents;
}

// ============================================================================
// GET /api/errors/overview — Error summary stats
// ============================================================================
router.get('/overview', async (req, res) => {
  try {
    const {
      project_id = 'default',
      date_from,
      date_to,
    } = req.query;

    const sessionIds = await getFilteredSessionIds(project_id, date_from, date_to);
    const totalSessions = sessionIds.length;

    if (totalSessions === 0) {
      return res.json({
        total_errors: 0,
        unique_errors: 0,
        affected_sessions: 0,
        affected_sessions_pct: 0,
        error_free_sessions_pct: 100,
        error_rate: 0,
      });
    }

    const errorEvents = await getErrorEvents(sessionIds);

    // Count unique error messages (by hash)
    const hashSet = new Set();
    const affectedSessionSet = new Set();

    for (const evt of errorEvents) {
      const msg = (evt.data && evt.data.message) || 'Unknown error';
      hashSet.add(hashMessage(normalizeMessage(msg)));
      affectedSessionSet.add(evt.session_id);
    }

    const affectedSessions = affectedSessionSet.size;
    const affectedPct = totalSessions > 0
      ? parseFloat(((affectedSessions / totalSessions) * 100).toFixed(1))
      : 0;

    res.json({
      total_errors: errorEvents.length,
      unique_errors: hashSet.size,
      affected_sessions: affectedSessions,
      affected_sessions_pct: affectedPct,
      error_free_sessions_pct: parseFloat((100 - affectedPct).toFixed(1)),
      error_rate: totalSessions > 0
        ? parseFloat((errorEvents.length / totalSessions).toFixed(2))
        : 0,
    });
  } catch (err) {
    console.error('[errors] GET /overview error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/errors/list — Grouped error list
// ============================================================================
router.get('/list', async (req, res) => {
  try {
    const {
      project_id = 'default',
      date_from,
      date_to,
      sort = 'count',
      order = 'DESC',
      page: rawPage = '1',
      limit: rawLimit = '50',
    } = req.query;

    const page = Math.max(1, parseInt(rawPage, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(rawLimit, 10) || 50));

    const sessionIds = await getFilteredSessionIds(project_id, date_from, date_to);

    if (sessionIds.length === 0) {
      return res.json({ errors: [], total: 0, page, pages: 0 });
    }

    const errorEvents = await getErrorEvents(sessionIds);

    // Group errors by normalized message hash
    const groups = {};

    for (const evt of errorEvents) {
      const rawMsg = (evt.data && evt.data.message) || 'Unknown error';
      const normalized = normalizeMessage(rawMsg);
      const hash = hashMessage(normalized);

      if (!groups[hash]) {
        groups[hash] = {
          error_hash: hash,
          message: rawMsg,
          normalized_message: normalized,
          count: 0,
          session_ids: new Set(),
          pages: new Set(),
          first_seen: evt.timestamp || evt.created_at,
          last_seen: evt.timestamp || evt.created_at,
          stack: (evt.data && evt.data.stack) || null,
          source: (evt.data && evt.data.source) || null,
        };
      }

      const group = groups[hash];
      group.count++;
      group.session_ids.add(evt.session_id);

      // Track pages where the error occurs
      const errorUrl = (evt.data && evt.data.url) || evt.url;
      if (errorUrl) group.pages.add(errorUrl);

      // Update first/last seen
      const ts = evt.timestamp || new Date(evt.created_at).getTime();
      if (ts < group.first_seen) group.first_seen = ts;
      if (ts > group.last_seen) group.last_seen = ts;

      // Keep the most recent stack trace
      if (evt.data && evt.data.stack) {
        group.stack = evt.data.stack;
      }
    }

    // Convert to array
    let errorList = Object.values(groups).map(g => ({
      error_hash: g.error_hash,
      message: g.message,
      normalized_message: g.normalized_message,
      count: g.count,
      affected_sessions: g.session_ids.size,
      pages: [...g.pages],
      first_seen: g.first_seen,
      last_seen: g.last_seen,
      stack: g.stack,
      source: g.source,
    }));

    // Sort
    const SORTABLE_FIELDS = ['count', 'affected_sessions', 'first_seen', 'last_seen'];
    const sortField = SORTABLE_FIELDS.includes(sort) ? sort : 'count';
    const ascending = order.toUpperCase() === 'ASC';

    errorList.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (valA < valB) return ascending ? -1 : 1;
      if (valA > valB) return ascending ? 1 : -1;
      return 0;
    });

    const total = errorList.length;
    const pages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginated = errorList.slice(offset, offset + limit);

    res.json({ errors: paginated, total, page, pages });
  } catch (err) {
    console.error('[errors] GET /list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/errors/:errorHash/sessions — Sessions affected by a specific error
// ============================================================================
router.get('/:errorHash/sessions', async (req, res) => {
  try {
    const { errorHash } = req.params;
    const {
      project_id = 'default',
      date_from,
      date_to,
      page: rawPage = '1',
      limit: rawLimit = '20',
    } = req.query;

    const page = Math.max(1, parseInt(rawPage, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(rawLimit, 10) || 20));

    const sessionIds = await getFilteredSessionIds(project_id, date_from, date_to);

    if (sessionIds.length === 0) {
      return res.json({ sessions: [], total: 0, page, pages: 0 });
    }

    const errorEvents = await getErrorEvents(sessionIds);

    // Find sessions matching this error hash
    const matchingSessionIds = new Set();
    let matchedMessage = null;

    for (const evt of errorEvents) {
      const rawMsg = (evt.data && evt.data.message) || 'Unknown error';
      const hash = hashMessage(normalizeMessage(rawMsg));
      if (hash === errorHash) {
        matchingSessionIds.add(evt.session_id);
        if (!matchedMessage) matchedMessage = rawMsg;
      }
    }

    const matchingIds = [...matchingSessionIds];
    const total = matchingIds.length;
    const pages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedIds = matchingIds.slice(offset, offset + limit);

    // Fetch session details for the paginated set
    let sessions = [];
    if (paginatedIds.length > 0) {
      const { data, error } = await supabase.from('sessions')
        .select('id, visitor_id, identified_user_name, identified_user_email, url, started_at, ended_at, duration, browser, os, device_type, country, page_count, has_rage_clicks, has_errors')
        .in('id', paginatedIds)
        .order('started_at', { ascending: false });

      if (error) throw error;
      sessions = data || [];
    }

    res.json({
      error_hash: errorHash,
      error_message: matchedMessage,
      sessions,
      total,
      page,
      pages,
    });
  } catch (err) {
    console.error('[errors] GET /:errorHash/sessions error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/errors/trends — Error trend over time (daily counts)
// ============================================================================
router.get('/trends', async (req, res) => {
  try {
    const {
      project_id = 'default',
      date_from,
      date_to,
    } = req.query;

    const sessionIds = await getFilteredSessionIds(project_id, date_from, date_to);

    if (sessionIds.length === 0) {
      return res.json({ trends: [] });
    }

    const errorEvents = await getErrorEvents(sessionIds);

    // Aggregate by day
    const dayCounts = {};
    const dayUnique = {};

    for (const evt of errorEvents) {
      const ts = evt.timestamp
        ? new Date(typeof evt.timestamp === 'number' ? evt.timestamp : evt.timestamp)
        : new Date(evt.created_at);
      const day = ts.toISOString().slice(0, 10);

      dayCounts[day] = (dayCounts[day] || 0) + 1;

      if (!dayUnique[day]) dayUnique[day] = new Set();
      const rawMsg = (evt.data && evt.data.message) || 'Unknown error';
      dayUnique[day].add(hashMessage(normalizeMessage(rawMsg)));
    }

    // Build sorted array with all days in range
    const trends = Object.entries(dayCounts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({
        date,
        count,
        unique_errors: dayUnique[date] ? dayUnique[date].size : 0,
      }));

    res.json({ trends });
  } catch (err) {
    console.error('[errors] GET /trends error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
