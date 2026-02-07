'use strict';

const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const getDatabase = require('../db');

const router = Router();

// ============================================================================
// Event type constants (must match the tracker)
// ============================================================================
const EVENT_TYPES = {
  SESSION_START: 0,
  DOM_SNAPSHOT: 1,
  DOM_MUTATION: 2,
  MOUSE_MOVE: 3,
  MOUSE_CLICK: 4,
  SCROLL: 5,
  INPUT: 6,
  RESIZE: 7,
  PAGE_NAVIGATION: 8,
  CONSOLE: 9,
  NETWORK: 10,
  ERROR: 11,
  RAGE_CLICK: 12,
  IDENTIFY: 13,
  CUSTOM_EVENT: 14,
};

// ============================================================================
// Simple User-Agent parser
// ============================================================================
function parseUserAgent(ua) {
  if (!ua) return { browser: 'Unknown', os: 'Unknown', device_type: 'desktop' };

  let browser = 'Unknown';
  let os = 'Unknown';
  let device_type = 'desktop';

  // --- Browser detection ---
  if (/Edg(?:e|A|iOS)?\/(\d+)/i.test(ua)) {
    browser = 'Edge ' + RegExp.$1;
  } else if (/OPR\/(\d+)/i.test(ua) || /Opera\/(\d+)/i.test(ua)) {
    browser = 'Opera ' + RegExp.$1;
  } else if (/SamsungBrowser\/(\d+)/i.test(ua)) {
    browser = 'Samsung Browser ' + RegExp.$1;
  } else if (/UCBrowser\/(\d+)/i.test(ua)) {
    browser = 'UC Browser ' + RegExp.$1;
  } else if (/Firefox\/(\d+)/i.test(ua)) {
    browser = 'Firefox ' + RegExp.$1;
  } else if (/Chrome\/(\d+)/i.test(ua)) {
    browser = 'Chrome ' + RegExp.$1;
  } else if (/Safari\/(\d+)/i.test(ua) && /Version\/(\d+)/i.test(ua)) {
    browser = 'Safari ' + RegExp.$1;
  } else if (/MSIE\s(\d+)/i.test(ua) || /Trident.*rv:(\d+)/i.test(ua)) {
    browser = 'IE ' + RegExp.$1;
  }

  // --- OS detection ---
  if (/Windows NT 10/i.test(ua)) {
    os = 'Windows 10+';
  } else if (/Windows NT 6\.3/i.test(ua)) {
    os = 'Windows 8.1';
  } else if (/Windows NT 6\.2/i.test(ua)) {
    os = 'Windows 8';
  } else if (/Windows NT 6\.1/i.test(ua)) {
    os = 'Windows 7';
  } else if (/Windows/i.test(ua)) {
    os = 'Windows';
  } else if (/Mac OS X\s([\d_]+)/i.test(ua)) {
    os = 'macOS ' + RegExp.$1.replace(/_/g, '.');
  } else if (/Mac OS X/i.test(ua)) {
    os = 'macOS';
  } else if (/CrOS/i.test(ua)) {
    os = 'Chrome OS';
  } else if (/Android\s([\d.]+)/i.test(ua)) {
    os = 'Android ' + RegExp.$1;
  } else if (/Android/i.test(ua)) {
    os = 'Android';
  } else if (/iPhone OS\s([\d_]+)/i.test(ua) || /CPU OS\s([\d_]+)/i.test(ua)) {
    os = 'iOS ' + RegExp.$1.replace(/_/g, '.');
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    os = 'iOS';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
  }

  // --- Device type detection ---
  if (/Mobi|Android.*Mobile|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    device_type = 'mobile';
  } else if (/Tablet|iPad|Android(?!.*Mobile)|Kindle|Silk/i.test(ua)) {
    device_type = 'tablet';
  }

  return { browser, os, device_type };
}

// ============================================================================
// POST /api/events — Receive batched events from the tracker
// ============================================================================
router.post('/', (req, res) => {
  try {
    const db = getDatabase();
    const { sessionId, projectId = 'default', events } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'events array is required and must not be empty' });
    }

    const insertEvent = db.prepare(`
      INSERT INTO events (session_id, type, timestamp, data, url)
      VALUES (@session_id, @type, @timestamp, @data, @url)
    `);

    const upsertSession = db.prepare(`
      INSERT INTO sessions (
        id, project_id, visitor_id, started_at, url, referrer, user_agent,
        screen_width, screen_height, viewport_width, viewport_height,
        browser, os, device_type, language,
        utm_source, utm_medium, utm_campaign, utm_term, utm_content
      ) VALUES (
        @id, @project_id, @visitor_id, @started_at, @url, @referrer, @user_agent,
        @screen_width, @screen_height, @viewport_width, @viewport_height,
        @browser, @os, @device_type, @language,
        @utm_source, @utm_medium, @utm_campaign, @utm_term, @utm_content
      )
      ON CONFLICT(id) DO UPDATE SET
        url        = COALESCE(excluded.url, sessions.url),
        referrer   = COALESCE(excluded.referrer, sessions.referrer),
        user_agent = COALESCE(excluded.user_agent, sessions.user_agent),
        screen_width    = COALESCE(excluded.screen_width, sessions.screen_width),
        screen_height   = COALESCE(excluded.screen_height, sessions.screen_height),
        viewport_width  = COALESCE(excluded.viewport_width, sessions.viewport_width),
        viewport_height = COALESCE(excluded.viewport_height, sessions.viewport_height),
        browser    = COALESCE(excluded.browser, sessions.browser),
        os         = COALESCE(excluded.os, sessions.os),
        device_type = COALESCE(excluded.device_type, sessions.device_type),
        language   = COALESCE(excluded.language, sessions.language),
        utm_source   = COALESCE(excluded.utm_source, sessions.utm_source),
        utm_medium   = COALESCE(excluded.utm_medium, sessions.utm_medium),
        utm_campaign = COALESCE(excluded.utm_campaign, sessions.utm_campaign),
        utm_term     = COALESCE(excluded.utm_term, sessions.utm_term),
        utm_content  = COALESCE(excluded.utm_content, sessions.utm_content)
    `);

    const identifySession = db.prepare(`
      UPDATE sessions SET
        identified_user_id    = @user_id,
        identified_user_email = @user_email,
        identified_user_name  = @user_name
      WHERE id = @session_id
    `);

    const updateSessionCounters = db.prepare(`
      UPDATE sessions SET
        event_count    = event_count + @new_event_count,
        has_rage_clicks = CASE WHEN @has_rage_click = 1 THEN 1 ELSE has_rage_clicks END,
        has_errors      = CASE WHEN @has_error = 1 THEN 1 ELSE has_errors END,
        ended_at        = datetime(@ended_at_epoch, 'unixepoch'),
        duration        = CAST((@ended_at_epoch - CAST(strftime('%%s', started_at) AS INTEGER)) AS INTEGER)
      WHERE id = @session_id
    `);

    const updatePageCount = db.prepare(`
      UPDATE sessions SET page_count = page_count + 1 WHERE id = ?
    `);

    // Process everything in a single transaction for performance
    const processBatch = db.transaction(() => {
      let hasRageClick = 0;
      let hasError = 0;
      let latestTimestamp = 0;

      for (const event of events) {
        const eventType = event.type;
        const eventTimestamp = event.timestamp || Date.now();
        const eventData = event.data || null;
        const eventUrl = event.url || null;

        // Track latest timestamp
        if (eventTimestamp > latestTimestamp) {
          latestTimestamp = eventTimestamp;
        }

        // Handle session_start events: create or update the session record
        if (eventType === EVENT_TYPES.SESSION_START && eventData) {
          const uaParsed = parseUserAgent(eventData.userAgent);

          upsertSession.run({
            id: sessionId,
            project_id: projectId,
            visitor_id: eventData.visitorId || null,
            started_at: new Date(eventTimestamp).toISOString(),
            url: eventData.url || eventUrl || null,
            referrer: eventData.referrer || null,
            user_agent: eventData.userAgent || null,
            screen_width: eventData.screenWidth || null,
            screen_height: eventData.screenHeight || null,
            viewport_width: eventData.viewportWidth || null,
            viewport_height: eventData.viewportHeight || null,
            browser: uaParsed.browser,
            os: uaParsed.os,
            device_type: uaParsed.device_type,
            language: eventData.language || null,
            utm_source: eventData.utmSource || null,
            utm_medium: eventData.utmMedium || null,
            utm_campaign: eventData.utmCampaign || null,
            utm_term: eventData.utmTerm || null,
            utm_content: eventData.utmContent || null,
          });
        }

        // Handle identify events: update session with user information
        if (eventType === EVENT_TYPES.IDENTIFY && eventData) {
          identifySession.run({
            session_id: sessionId,
            user_id: eventData.userId || null,
            user_email: eventData.email || null,
            user_name: eventData.name || null,
          });
        }

        // Handle page navigation: increment page count
        if (eventType === EVENT_TYPES.PAGE_NAVIGATION) {
          updatePageCount.run(sessionId);
        }

        // Track rage clicks and errors
        if (eventType === EVENT_TYPES.RAGE_CLICK) {
          hasRageClick = 1;
        }
        if (eventType === EVENT_TYPES.ERROR) {
          hasError = 1;
        }

        // Insert the event
        insertEvent.run({
          session_id: sessionId,
          type: eventType,
          timestamp: eventTimestamp,
          data: eventData ? JSON.stringify(eventData) : null,
          url: eventUrl,
        });
      }

      // Update session counters
      if (latestTimestamp > 0) {
        updateSessionCounters.run({
          session_id: sessionId,
          new_event_count: events.length,
          has_rage_click: hasRageClick,
          has_error: hasError,
          ended_at_epoch: Math.floor(latestTimestamp / 1000),
        });
      }
    });

    processBatch();

    res.status(200).json({ success: true, stored: events.length });
  } catch (err) {
    console.error('[events] POST / error:', err);
    res.status(500).json({ error: 'Failed to store events' });
  }
});

// ============================================================================
// GET /api/events — List events with filtering & pagination
// ============================================================================
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const {
      session_id,
      type,
      date_from,
      date_to,
      page: rawPage = '1',
      limit: rawLimit = '100',
    } = req.query;

    const page = Math.max(1, parseInt(rawPage, 10) || 1);
    const limit = Math.min(1000, Math.max(1, parseInt(rawLimit, 10) || 100));
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = {};

    if (session_id) {
      conditions.push('session_id = @session_id');
      params.session_id = session_id;
    }
    if (type !== undefined) {
      conditions.push('type = @type');
      params.type = parseInt(type, 10);
    }
    if (date_from) {
      conditions.push('created_at >= @date_from');
      params.date_from = date_from;
    }
    if (date_to) {
      conditions.push('created_at <= @date_to');
      params.date_to = date_to;
    }

    const whereClause = conditions.length > 0
      ? 'WHERE ' + conditions.join(' AND ')
      : '';

    const countRow = db.prepare(
      `SELECT COUNT(*) AS total FROM events ${whereClause}`
    ).get(params);
    const total = countRow.total;

    const events = db.prepare(
      `SELECT * FROM events ${whereClause}
       ORDER BY timestamp ASC
       LIMIT @limit OFFSET @offset`
    ).all({ ...params, limit, offset });

    // Parse JSON data
    const parsedEvents = events.map((evt) => ({
      ...evt,
      data: evt.data ? JSON.parse(evt.data) : null,
    }));

    const pages = Math.ceil(total / limit);

    res.json({ events: parsedEvents, total, page, pages });
  } catch (err) {
    console.error('[events] GET / error:', err);
    res.status(500).json({ error: 'Failed to list events' });
  }
});

module.exports = router;
