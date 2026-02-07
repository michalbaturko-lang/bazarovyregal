'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const supabase = require('../supabase');
const dispatcher = require('../webhook-dispatcher');

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
router.post('/', async (req, res) => {
  try {
    const { sessionId, projectId = 'default', events } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'events array is required and must not be empty' });
    }

    let hasRageClick = false;
    let hasError = false;
    let latestTimestamp = 0;
    let pageNavigations = 0;

    const eventRows = [];
    let sessionUpsertData = null;
    let identifyData = null;

    for (const event of events) {
      const eventType = event.type;
      const eventTimestamp = event.timestamp || Date.now();
      const eventData = event.data || null;
      const eventUrl = event.url || null;

      // Track latest timestamp
      if (eventTimestamp > latestTimestamp) {
        latestTimestamp = eventTimestamp;
      }

      // Handle session_start events: build the session upsert payload
      if (eventType === EVENT_TYPES.SESSION_START && eventData) {
        const uaParsed = parseUserAgent(eventData.userAgent);

        sessionUpsertData = {
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
        };
      }

      // Handle identify events
      if (eventType === EVENT_TYPES.IDENTIFY && eventData) {
        identifyData = {
          identified_user_id: eventData.userId || null,
          identified_user_email: eventData.email || null,
          identified_user_name: eventData.name || null,
        };
      }

      // Track page navigations
      if (eventType === EVENT_TYPES.PAGE_NAVIGATION) {
        pageNavigations++;
      }

      // Track rage clicks and errors
      if (eventType === EVENT_TYPES.RAGE_CLICK) {
        hasRageClick = true;
      }
      if (eventType === EVENT_TYPES.ERROR) {
        hasError = true;
      }

      // Accumulate event row (data is stored as JSONB, pass object directly)
      eventRows.push({
        session_id: sessionId,
        type: eventType,
        timestamp: eventTimestamp,
        data: eventData || null,
        url: eventUrl,
      });
    }

    // --- Upsert session ---
    if (sessionUpsertData) {
      const { error: upsertError } = await supabase.from('sessions')
        .upsert(sessionUpsertData, { onConflict: 'id', ignoreDuplicates: false });
      if (upsertError) throw upsertError;
    }

    // --- Identify user on session ---
    if (identifyData) {
      const { error: identifyError } = await supabase.from('sessions')
        .update(identifyData)
        .eq('id', sessionId);
      if (identifyError) throw identifyError;
    }

    // --- Batch-insert events ---
    if (eventRows.length > 0) {
      const { error: insertError } = await supabase.from('events')
        .insert(eventRows);
      if (insertError) throw insertError;
    }

    // --- Update session counters ---
    if (latestTimestamp > 0) {
      // Fetch current session to compute duration properly
      const { data: currentSession, error: fetchError } = await supabase.from('sessions')
        .select('started_at, event_count, page_count, has_rage_clicks, has_errors')
        .eq('id', sessionId)
        .single();

      if (!fetchError && currentSession) {
        const startedAtMs = new Date(currentSession.started_at).getTime();
        const duration = Math.floor((latestTimestamp - startedAtMs) / 1000);

        const updates = {
          event_count: (currentSession.event_count || 0) + events.length,
          ended_at: new Date(latestTimestamp).toISOString(),
          duration: Math.max(0, duration),
        };

        if (pageNavigations > 0) {
          updates.page_count = (currentSession.page_count || 1) + pageNavigations;
        }
        if (hasRageClick) {
          updates.has_rage_clicks = true;
        }
        if (hasError) {
          updates.has_errors = true;
        }

        const { error: updateError } = await supabase.from('sessions')
          .update(updates)
          .eq('id', sessionId);
        if (updateError) throw updateError;
      }
    }

    // --- Dispatch webhook notifications (fire-and-forget) ---
    for (const event of events) {
      const eventType = event.type;
      const eventData = event.data || {};

      // JS Error (type 11 = ERROR)
      if (eventType === EVENT_TYPES.ERROR) {
        dispatcher.dispatch('js_error', { session_id: sessionId, ...eventData }, projectId).catch(() => {});
      }

      // Rage Click (type 12 = RAGE_CLICK)
      if (eventType === EVENT_TYPES.RAGE_CLICK) {
        dispatcher.dispatch('rage_click', { session_id: sessionId, ...eventData }, projectId).catch(() => {});
      }

      // Custom events: cart abandonment / form abandon detection
      if (eventType === EVENT_TYPES.CUSTOM_EVENT && eventData) {
        const eventName = (eventData.name || '').toLowerCase();
        if (eventName.includes('cart_abandonment') || eventName.includes('cart_abandon')) {
          dispatcher.dispatch('cart_abandonment', { session_id: sessionId, ...eventData }, projectId).catch(() => {});
        }
        if (eventName.includes('form_abandon')) {
          dispatcher.dispatch('form_abandon', { session_id: sessionId, ...eventData }, projectId).catch(() => {});
        }
      }

      // Rage click detection from click data
      if (eventType === EVENT_TYPES.MOUSE_CLICK && eventData && eventData.is_rage_click) {
        dispatcher.dispatch('rage_click', { session_id: sessionId, ...eventData }, projectId).catch(() => {});
      }
    }

    res.status(200).json({ success: true, stored: events.length });
  } catch (err) {
    console.error('[events] POST / error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/events/recent — Recent events across all sessions (for live feed)
// ============================================================================
router.get('/recent', async (req, res) => {
  try {
    const {
      project_id = 'default',
      minutes: rawMinutes = '5',
      limit: rawLimit = '50',
    } = req.query;

    const minutes = Math.max(1, Math.min(60, parseInt(rawMinutes, 10) || 5));
    const limit = Math.max(1, Math.min(200, parseInt(rawLimit, 10) || 50));
    const since = new Date(Date.now() - minutes * 60 * 1000).toISOString();

    // Fetch recent events — join is not directly available in Supabase JS client
    // so we fetch events first, then enrich with session data.
    const { data: events, error: eventsError } = await supabase.from('events')
      .select('id, session_id, type, timestamp, data, url, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (eventsError) throw eventsError;

    const rows = events || [];

    // Collect unique session IDs to fetch visitor info
    const sessionIds = [...new Set(rows.map(e => e.session_id).filter(Boolean))];
    let sessionMap = {};

    if (sessionIds.length > 0) {
      const { data: sessions, error: sessError } = await supabase.from('sessions')
        .select('id, visitor_id, identified_user_name, identified_user_email, url')
        .eq('project_id', project_id)
        .in('id', sessionIds);

      if (!sessError && sessions) {
        for (const s of sessions) {
          sessionMap[s.id] = s;
        }
      }
    }

    // Enrich events with session info
    const enriched = rows.map(e => {
      const sess = sessionMap[e.session_id] || {};
      return {
        id: e.id,
        type: e.type,
        timestamp: e.timestamp,
        data: e.data,
        url: e.url,
        session_id: e.session_id,
        visitor_id: sess.visitor_id || null,
        identified_user_name: sess.identified_user_name || null,
        created_at: e.created_at,
      };
    });

    res.json({ events: enriched });
  } catch (err) {
    console.error('[events] GET /recent error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/events — List events with filtering & pagination
// ============================================================================
router.get('/', async (req, res) => {
  try {
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

    // Build count query
    let countQuery = supabase.from('events')
      .select('*', { count: 'exact', head: true });

    let dataQuery = supabase.from('events')
      .select('*');

    function applyFilters(q) {
      if (session_id)           q = q.eq('session_id', session_id);
      if (type !== undefined)   q = q.eq('type', parseInt(type, 10));
      if (date_from)            q = q.gte('created_at', date_from);
      if (date_to)              q = q.lte('created_at', date_to);
      return q;
    }

    countQuery = applyFilters(countQuery);
    dataQuery = applyFilters(dataQuery);

    const { count: total, error: countError } = await countQuery;
    if (countError) throw countError;

    const { data: events, error: dataError } = await dataQuery
      .order('timestamp', { ascending: true })
      .range(offset, offset + limit - 1);
    if (dataError) throw dataError;

    // data column is JSONB so Supabase returns it already parsed
    const pages = Math.ceil((total || 0) / limit);

    res.json({ events: events || [], total: total || 0, page, pages });
  } catch (err) {
    console.error('[events] GET / error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
