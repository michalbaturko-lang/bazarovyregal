'use strict';

const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// ============================================================================
// GET /api/sessions — List sessions with filtering & pagination
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const {
      project_id = 'default',
      date_from,
      date_to,
      min_duration,
      max_duration,
      browser,
      os,
      device_type,
      country,
      url,
      has_rage_clicks,
      has_errors,
      identified_user_id,
      identified_user_email,
      utm_source,
      utm_medium,
      utm_campaign,
      sort = 'started_at',
      order = 'DESC',
      page: rawPage = '1',
      limit: rawLimit = '50',
    } = req.query;

    const page = Math.max(1, parseInt(rawPage, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(rawLimit, 10) || 50));
    const offset = (page - 1) * limit;

    // Whitelist sortable columns to prevent injection
    const SORTABLE_COLUMNS = [
      'started_at', 'ended_at', 'duration', 'event_count',
      'page_count', 'browser', 'os', 'device_type', 'country',
    ];
    const sortColumn = SORTABLE_COLUMNS.includes(sort) ? sort : 'started_at';
    const ascending = order.toUpperCase() === 'ASC';

    // --- Build the filtered query for counting ---
    let countQuery = supabase.from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', project_id);

    let dataQuery = supabase.from('sessions')
      .select('*')
      .eq('project_id', project_id);

    // Apply optional filters to both queries
    function applyFilters(q) {
      if (date_from)            q = q.gte('started_at', date_from);
      if (date_to)              q = q.lte('started_at', date_to + 'T23:59:59.999Z');
      if (min_duration !== undefined) q = q.gte('duration', parseInt(min_duration, 10));
      if (max_duration !== undefined) q = q.lte('duration', parseInt(max_duration, 10));
      if (browser)              q = q.eq('browser', browser);
      if (os)                   q = q.eq('os', os);
      if (device_type)          q = q.eq('device_type', device_type);
      if (country)              q = q.eq('country', country);
      if (url)                  q = q.ilike('url', `%${url}%`);
      if (has_rage_clicks !== undefined) {
        q = q.eq('has_rage_clicks', has_rage_clicks === 'true' || has_rage_clicks === '1');
      }
      if (has_errors !== undefined) {
        q = q.eq('has_errors', has_errors === 'true' || has_errors === '1');
      }
      if (identified_user_id)   q = q.eq('identified_user_id', identified_user_id);
      if (identified_user_email) q = q.eq('identified_user_email', identified_user_email);
      if (utm_source)           q = q.eq('utm_source', utm_source);
      if (utm_medium)           q = q.eq('utm_medium', utm_medium);
      if (utm_campaign)         q = q.eq('utm_campaign', utm_campaign);
      return q;
    }

    countQuery = applyFilters(countQuery);
    dataQuery = applyFilters(dataQuery);

    // Execute count
    const { count: total, error: countError } = await countQuery;
    if (countError) throw countError;

    // Execute data query with sort & pagination
    const { data: sessions, error: dataError } = await dataQuery
      .order(sortColumn, { ascending })
      .range(offset, offset + limit - 1);
    if (dataError) throw dataError;

    const pages = Math.ceil((total || 0) / limit);

    res.json({ sessions: sessions || [], total: total || 0, page, pages });
  } catch (err) {
    console.error('[sessions] GET / error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/sessions/:id — Get a single session with all its events
// ============================================================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch the session
    const { data: session, error: sessionError } = await supabase.from('sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Fetch associated events
    const { data: events, error: eventsError } = await supabase.from('events')
      .select('*')
      .eq('session_id', id)
      .order('timestamp', { ascending: true });

    if (eventsError) throw eventsError;

    // data is already JSONB so Supabase returns it parsed
    res.json({ session, events: events || [] });
  } catch (err) {
    console.error('[sessions] GET /:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// DELETE /api/sessions/:id — Delete session and its events
// ============================================================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check existence
    const { data: session, error: findError } = await supabase.from('sessions')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Delete events first (cascade should handle this, but be explicit)
    const { error: evtDelError } = await supabase.from('events')
      .delete()
      .eq('session_id', id);
    if (evtDelError) throw evtDelError;

    // Delete the session
    const { error: sessDelError } = await supabase.from('sessions')
      .delete()
      .eq('id', id);
    if (sessDelError) throw sessDelError;

    res.json({ success: true, message: 'Session deleted' });
  } catch (err) {
    console.error('[sessions] DELETE /:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
