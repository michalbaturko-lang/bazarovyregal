'use strict';

const { Router } = require('express');
const getDatabase = require('../db');

const router = Router();

// ============================================================================
// GET /api/sessions — List sessions with filtering & pagination
// ============================================================================
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
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

    // Build dynamic WHERE clause
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
    if (min_duration !== undefined) {
      conditions.push('duration >= @min_duration');
      params.min_duration = parseInt(min_duration, 10);
    }
    if (max_duration !== undefined) {
      conditions.push('duration <= @max_duration');
      params.max_duration = parseInt(max_duration, 10);
    }
    if (browser) {
      conditions.push('browser = @browser');
      params.browser = browser;
    }
    if (os) {
      conditions.push('os = @os');
      params.os = os;
    }
    if (device_type) {
      conditions.push('device_type = @device_type');
      params.device_type = device_type;
    }
    if (country) {
      conditions.push('country = @country');
      params.country = country;
    }
    if (url) {
      conditions.push('url LIKE @url');
      params.url = `%${url}%`;
    }
    if (has_rage_clicks !== undefined) {
      conditions.push('has_rage_clicks = @has_rage_clicks');
      params.has_rage_clicks = has_rage_clicks === 'true' || has_rage_clicks === '1' ? 1 : 0;
    }
    if (has_errors !== undefined) {
      conditions.push('has_errors = @has_errors');
      params.has_errors = has_errors === 'true' || has_errors === '1' ? 1 : 0;
    }
    if (identified_user_id) {
      conditions.push('identified_user_id = @identified_user_id');
      params.identified_user_id = identified_user_id;
    }
    if (identified_user_email) {
      conditions.push('identified_user_email = @identified_user_email');
      params.identified_user_email = identified_user_email;
    }
    if (utm_source) {
      conditions.push('utm_source = @utm_source');
      params.utm_source = utm_source;
    }
    if (utm_medium) {
      conditions.push('utm_medium = @utm_medium');
      params.utm_medium = utm_medium;
    }
    if (utm_campaign) {
      conditions.push('utm_campaign = @utm_campaign');
      params.utm_campaign = utm_campaign;
    }

    const whereClause = conditions.length > 0
      ? 'WHERE ' + conditions.join(' AND ')
      : '';

    // Whitelist sortable columns to prevent SQL injection
    const SORTABLE_COLUMNS = [
      'started_at', 'ended_at', 'duration', 'event_count',
      'page_count', 'browser', 'os', 'device_type', 'country',
    ];
    const sortColumn = SORTABLE_COLUMNS.includes(sort) ? sort : 'started_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Count total matching rows
    const countRow = db.prepare(
      `SELECT COUNT(*) AS total FROM sessions ${whereClause}`
    ).get(params);
    const total = countRow.total;

    // Fetch the page of results
    const sessions = db.prepare(
      `SELECT * FROM sessions ${whereClause}
       ORDER BY ${sortColumn} ${sortOrder}
       LIMIT @limit OFFSET @offset`
    ).all({ ...params, limit, offset });

    const pages = Math.ceil(total / limit);

    res.json({ sessions, total, page, pages });
  } catch (err) {
    console.error('[sessions] GET / error:', err);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// ============================================================================
// GET /api/sessions/:id — Get a single session with all its events
// ============================================================================
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const events = db.prepare(
      'SELECT * FROM events WHERE session_id = ? ORDER BY timestamp ASC'
    ).all(id);

    // Parse JSON data field for each event
    const parsedEvents = events.map((evt) => ({
      ...evt,
      data: evt.data ? JSON.parse(evt.data) : null,
    }));

    res.json({ session, events: parsedEvents });
  } catch (err) {
    console.error('[sessions] GET /:id error:', err);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

// ============================================================================
// DELETE /api/sessions/:id — Delete session and its events
// ============================================================================
router.delete('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const session = db.prepare('SELECT id FROM sessions WHERE id = ?').get(id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const deleteAll = db.transaction(() => {
      db.prepare('DELETE FROM events WHERE session_id = ?').run(id);
      db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
    });
    deleteAll();

    res.json({ success: true, message: 'Session deleted' });
  } catch (err) {
    console.error('[sessions] DELETE /:id error:', err);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

module.exports = router;
