'use strict';

const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// ============================================================================
// CSV helper — no external library needed
// ============================================================================
function toCSV(headers, rows) {
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(','));
  }
  return lines.join('\n');
}

function sendCSV(res, filename, headers, rows) {
  const csv = toCSV(headers, rows);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

function sendJSON(res, filename, rows) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.json(rows);
}

// ============================================================================
// GET /api/export/sessions — Export sessions as CSV or JSON
// ============================================================================
router.get('/sessions', async (req, res) => {
  try {
    const {
      project_id = 'default',
      date_from,
      date_to,
      browser,
      os,
      device_type,
      country,
      has_rage_clicks,
      has_errors,
      format = 'csv',
    } = req.query;

    let query = supabase.from('sessions')
      .select('*')
      .eq('project_id', project_id)
      .order('started_at', { ascending: false });

    if (date_from) query = query.gte('started_at', date_from);
    if (date_to) query = query.lte('started_at', date_to);
    if (browser) query = query.eq('browser', browser);
    if (os) query = query.eq('os', os);
    if (device_type) query = query.eq('device_type', device_type);
    if (country) query = query.eq('country', country);
    if (has_rage_clicks !== undefined) {
      query = query.eq('has_rage_clicks', has_rage_clicks === 'true' || has_rage_clicks === '1');
    }
    if (has_errors !== undefined) {
      query = query.eq('has_errors', has_errors === 'true' || has_errors === '1');
    }

    // Supabase default limit is 1000; request up to 10 000 rows for export
    const { data: sessions, error } = await query.limit(10000);
    if (error) throw error;

    const rows = (sessions || []).map((s) => ({
      id: s.id,
      visitor_id: s.visitor_id,
      started_at: s.started_at,
      duration: s.duration,
      url: s.url,
      browser: s.browser,
      os: s.os,
      device_type: s.device_type,
      country: s.country,
      page_count: s.page_count,
      event_count: s.event_count,
      has_rage_clicks: s.has_rage_clicks,
      has_errors: s.has_errors,
      identified_user_email: s.identified_user_email,
      identified_user_name: s.identified_user_name,
      utm_source: s.utm_source,
      utm_medium: s.utm_medium,
      utm_campaign: s.utm_campaign,
    }));

    const headers = [
      'id', 'visitor_id', 'started_at', 'duration', 'url', 'browser', 'os',
      'device_type', 'country', 'page_count', 'event_count', 'has_rage_clicks',
      'has_errors', 'identified_user_email', 'identified_user_name',
      'utm_source', 'utm_medium', 'utm_campaign',
    ];

    const timestamp = new Date().toISOString().slice(0, 10);

    if (format === 'json') {
      return sendJSON(res, `sessions-export-${timestamp}.json`, rows);
    }

    sendCSV(res, `sessions-export-${timestamp}.csv`, headers, rows);
  } catch (err) {
    console.error('[export] GET /sessions error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/export/events — Export events for a specific session
// ============================================================================
router.get('/events', async (req, res) => {
  try {
    const { session_id, format = 'csv' } = req.query;

    if (!session_id) {
      return res.status(400).json({ error: 'session_id query parameter is required' });
    }

    const { data: events, error } = await supabase.from('events')
      .select('*')
      .eq('session_id', session_id)
      .order('timestamp', { ascending: true })
      .limit(50000);
    if (error) throw error;

    const rows = (events || []).map((e) => ({
      id: e.id,
      session_id: e.session_id,
      type: e.type,
      timestamp: e.timestamp,
      url: e.url,
      data: typeof e.data === 'object' ? JSON.stringify(e.data) : (e.data || ''),
      created_at: e.created_at,
    }));

    const headers = ['id', 'session_id', 'type', 'timestamp', 'url', 'data', 'created_at'];
    const timestamp = new Date().toISOString().slice(0, 10);

    if (format === 'json') {
      return sendJSON(res, `events-${session_id.substring(0, 8)}-${timestamp}.json`, rows);
    }

    sendCSV(res, `events-${session_id.substring(0, 8)}-${timestamp}.csv`, headers, rows);
  } catch (err) {
    console.error('[export] GET /events error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/export/funnel/:id — Export funnel results as CSV or JSON
// ============================================================================
router.get('/funnel/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { date_from, date_to, format = 'csv' } = req.query;

    // Fetch the funnel definition
    const { data: funnel, error: funnelError } = await supabase.from('funnels')
      .select('*')
      .eq('id', id)
      .single();

    if (funnelError || !funnel) {
      return res.status(404).json({ error: 'Funnel not found' });
    }

    const steps = funnel.steps;

    // Fetch qualifying session IDs
    let sessionQuery = supabase.from('sessions')
      .select('id')
      .eq('project_id', funnel.project_id);

    if (date_from) sessionQuery = sessionQuery.gte('started_at', date_from);
    if (date_to) sessionQuery = sessionQuery.lte('started_at', date_to);

    const { data: sessionRows, error: sessError } = await sessionQuery;
    if (sessError) throw sessError;

    const allSessionIds = (sessionRows || []).map((r) => r.id);
    const totalSessions = allSessionIds.length;

    // Compute funnel step results
    let qualifyingSessionIds = new Set(allSessionIds);
    const stepResults = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const nextQualifying = new Set();

      if (qualifyingSessionIds.size === 0) {
        stepResults.push({
          step_number: i + 1,
          step_name: step.name || `Step ${i + 1}`,
          type: step.type,
          value: step.value,
          users_entered: 0,
          conversion_from_prev: '0.00',
          conversion_from_first: '0.00',
          drop_off: 0,
        });
        continue;
      }

      const sessionIdArray = Array.from(qualifyingSessionIds);
      const BATCH_SIZE = 500;

      for (let b = 0; b < sessionIdArray.length; b += BATCH_SIZE) {
        const batch = sessionIdArray.slice(b, b + BATCH_SIZE);

        if (step.type === 'url') {
          const { data: rows, error: qErr } = await supabase.from('events')
            .select('session_id')
            .in('session_id', batch)
            .ilike('url', `%${step.value}%`);
          if (qErr) throw qErr;
          for (const row of (rows || [])) nextQualifying.add(row.session_id);
        } else if (step.type === 'event') {
          const eventTypeNum = parseInt(step.value, 10);
          if (!isNaN(eventTypeNum)) {
            const { data: rows, error: qErr } = await supabase.from('events')
              .select('session_id')
              .in('session_id', batch)
              .eq('type', eventTypeNum);
            if (qErr) throw qErr;
            for (const row of (rows || [])) nextQualifying.add(row.session_id);
          } else {
            const { data: rows, error: qErr } = await supabase.from('events')
              .select('session_id')
              .in('session_id', batch)
              .eq('type', 14)
              .eq('data->>name', step.value);
            if (qErr) throw qErr;
            for (const row of (rows || [])) nextQualifying.add(row.session_id);
          }
        }
      }

      const count = nextQualifying.size;
      const previousCount = i === 0 ? totalSessions : stepResults[i - 1].users_entered;
      const convFromPrev = previousCount > 0 ? ((count / previousCount) * 100).toFixed(2) : '0.00';
      const convFromFirst = totalSessions > 0 ? ((count / totalSessions) * 100).toFixed(2) : '0.00';
      const dropOff = previousCount - count;

      stepResults.push({
        step_number: i + 1,
        step_name: step.name || `Step ${i + 1}`,
        type: step.type,
        value: step.value,
        users_entered: count,
        conversion_from_prev: convFromPrev,
        conversion_from_first: convFromFirst,
        drop_off: dropOff,
      });

      qualifyingSessionIds = nextQualifying;
    }

    const csvHeaders = [
      'step_number', 'step_name', 'type', 'value',
      'users_entered', 'conversion_from_prev', 'conversion_from_first', 'drop_off',
    ];

    const timestamp = new Date().toISOString().slice(0, 10);
    const safeName = funnel.name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);

    if (format === 'json') {
      return sendJSON(res, `funnel-${safeName}-${timestamp}.json`, {
        funnel: { id: funnel.id, name: funnel.name },
        total_sessions: totalSessions,
        overall_conversion: totalSessions > 0
          ? ((stepResults[stepResults.length - 1]?.users_entered || 0) / totalSessions * 100).toFixed(2)
          : '0.00',
        steps: stepResults,
      });
    }

    sendCSV(res, `funnel-${safeName}-${timestamp}.csv`, csvHeaders, stepResults);
  } catch (err) {
    console.error('[export] GET /funnel/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
