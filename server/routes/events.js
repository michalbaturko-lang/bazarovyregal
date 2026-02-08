'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const supabase = require('../supabase');
const dispatcher = require('../webhook-dispatcher');

// ============================================================================
// Event type constants (must match the tracker)
// ============================================================================
// Must match the tracker's EVT constants exactly
const EVENT_TYPES = {
  SESSION_START:   0,
  DOM_SNAPSHOT:    1,
  DOM_MUTATION:    2,
  MOUSE_MOVE:      3,
  MOUSE_CLICK:     4,
  SCROLL:          5,
  RESIZE:          6,
  INPUT:           7,
  PAGE_VISIBILITY: 8,
  RAGE_CLICK:      9,
  DEAD_CLICK:     10,
  JS_ERROR:       11,
  CUSTOM_EVENT:   12,
  IDENTIFY:       13,
  PAGE_NAVIGATION: 14,
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
// GeoIP lookup via ipapi.co (free: 1000 req/day, no key needed)
// Returns { country, city, region } or nulls on failure.
// Only called when Vercel headers don't provide city detail.
// ============================================================================
async function lookupGeoIP(ip) {
  if (!ip || ip === '127.0.0.1' || ip === '::1') return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const resp = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'RegalMasterLook/1.0' },
    });
    clearTimeout(timeout);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.error) return null;
    return {
      country: data.country_code || null,
      city: data.city || null,
      region: data.region || null,
    };
  } catch (_) {
    return null;
  }
}

/** Extract client IP from request headers. */
function getClientIP(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return xff.split(',')[0].trim();
  return req.headers['x-real-ip'] || req.ip || null;
}

// ============================================================================
// POST /api/events — Receive batched events from the tracker
// ============================================================================
router.post('/', async (req, res) => {
  try {
    // Accept both full names (sessionId/projectId) and short names (sid/pid) from tracker
    const sessionId = req.body.sessionId || req.body.sid;
    const projectId = req.body.projectId || req.body.pid || 'default';
    const events = req.body.events;

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
      // Accept both full (type/timestamp/data) and short (e/ts/d) field names
      const eventType = event.type !== undefined ? event.type : event.e;
      const eventTimestamp = event.timestamp || event.ts || Date.now();
      const eventData = event.data || event.d || null;
      const eventUrl = event.url || event.u || null;

      // Track latest timestamp
      if (eventTimestamp > latestTimestamp) {
        latestTimestamp = eventTimestamp;
      }

      // Handle session_start events: build the session upsert payload
      // Supports both tracker format (screen:{w,h}, utm:{source,...}) and legacy format
      if (eventType === EVENT_TYPES.SESSION_START && eventData) {
        // Tracker sends browser/os/device directly; fallback to UA parsing
        const uaParsed = eventData.browser ? {} : parseUserAgent(req.headers['user-agent']);

        // Handle screen dimensions: tracker sends {w,h} objects
        const sw = eventData.screenWidth || (eventData.screen && eventData.screen.w) || null;
        const sh = eventData.screenHeight || (eventData.screen && eventData.screen.h) || null;
        const vw = eventData.viewportWidth || (eventData.viewport && eventData.viewport.w) || null;
        const vh = eventData.viewportHeight || (eventData.viewport && eventData.viewport.h) || null;

        // Handle UTM: tracker sends {source, medium, campaign, ...} object
        const utm = eventData.utm || {};

        sessionUpsertData = {
          id: sessionId,
          project_id: projectId,
          visitor_id: eventData.visitorId || null,
          started_at: new Date(eventTimestamp).toISOString(),
          url: eventData.url || eventUrl || null,
          referrer: eventData.referrer || null,
          user_agent: req.headers['user-agent'] || null,
          screen_width: sw,
          screen_height: sh,
          viewport_width: vw,
          viewport_height: vh,
          browser: eventData.browser || uaParsed.browser || null,
          os: eventData.os || uaParsed.os || null,
          device_type: eventData.device || uaParsed.device_type || 'desktop',
          language: eventData.language || null,
          utm_source: eventData.utmSource || utm.source || null,
          utm_medium: eventData.utmMedium || utm.medium || null,
          utm_campaign: eventData.utmCampaign || utm.campaign || null,
          utm_term: eventData.utmTerm || utm.term || null,
          utm_content: eventData.utmContent || utm.content || null,
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
      if (eventType === EVENT_TYPES.JS_ERROR) {
        hasError = true;
      }

      // Derive URL from event data when not provided at top level.
      // SESSION_START has url in data; PAGE_NAVIGATION has 'to' destination.
      let derivedUrl = eventUrl;
      if (!derivedUrl && eventData) {
        if (eventType === EVENT_TYPES.SESSION_START && eventData.url) {
          derivedUrl = eventData.url;
        } else if (eventType === EVENT_TYPES.PAGE_NAVIGATION && eventData.to) {
          derivedUrl = eventData.to;
        }
      }

      // Accumulate event row (data is stored as JSONB, pass object directly)
      eventRows.push({
        session_id: sessionId,
        type: eventType,
        timestamp: eventTimestamp,
        data: eventData || null,
        url: derivedUrl,
      });
    }

    // --- GeoIP: extract country & city from Vercel geo headers ---
    let geoCountry = req.headers['x-vercel-ip-country'] || null;
    let geoCity = req.headers['x-vercel-ip-city']
      ? decodeURIComponent(req.headers['x-vercel-ip-city'])
      : null;
    let geoRegion = req.headers['x-vercel-ip-country-region'] || null;

    // Fallback: if Vercel doesn't provide city (or on SESSION_START for max detail),
    // look up via ipapi.co for accurate city + region
    if ((!geoCity || sessionUpsertData) && events.length > 0) {
      const clientIP = getClientIP(req);
      if (clientIP) {
        const ipGeo = await lookupGeoIP(clientIP);
        if (ipGeo) {
          if (!geoCountry && ipGeo.country) geoCountry = ipGeo.country;
          // Prefer ipapi.co city — more detailed than Vercel
          if (ipGeo.city) geoCity = ipGeo.city;
          if (ipGeo.region) geoRegion = ipGeo.region;
        }
      }
    }

    // Build compact location string: "City, Region" or just "City"
    const geoLocation = geoCity && geoRegion && geoRegion !== geoCity
      ? `${geoCity}, ${geoRegion}`
      : geoCity || null;

    // Inject geo data into session upsert if available
    if (sessionUpsertData) {
      if (geoCountry) sessionUpsertData.country = geoCountry;
      if (geoLocation) sessionUpsertData.city = geoLocation;
    }

    // --- Ensure project exists (sessions.project_id FK → projects.id) ---
    // Auto-create the project row if it doesn't exist yet.
    // Detect domain from session URL to set a meaningful project name.
    {
      let detectedDomain = null;
      let detectedName = projectId;
      const firstUrl = (sessionUpsertData && sessionUpsertData.url) ||
                       (events[0] && (events[0].url || events[0].u)) || null;
      if (firstUrl) {
        try {
          const u = new URL(firstUrl);
          detectedDomain = u.hostname.replace(/^www\./, '');
          detectedName = detectedDomain.split('.')[0]
            .split('-')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
        } catch (_) { /* invalid URL */ }
      }

      const projectData = { id: projectId, name: detectedName };
      if (detectedDomain) projectData.domain = detectedDomain;

      const { error: projErr } = await supabase.from('projects')
        .upsert(projectData, { onConflict: 'id', ignoreDuplicates: true });
      if (projErr) {
        console.warn('[events] Project upsert failed:', projErr.message);
        const { error: projErr2 } = await supabase.from('projects')
          .upsert({ id: projectId }, { onConflict: 'id', ignoreDuplicates: true });
        if (projErr2) console.error('[events] Project auto-create failed:', projErr2.message);
      }
    }

    // --- Ensure session exists (must happen BEFORE inserting events due to FK constraint) ---
    // Strategy: try full upsert → medium upsert → bare minimum upsert
    // This handles missing columns in the sessions table gracefully.
    const startedAt = sessionUpsertData
      ? sessionUpsertData.started_at
      : new Date().toISOString();
    const ignoreDups = !sessionUpsertData; // only ignore duplicates for non-SESSION_START batches

    // Attempt 1: Full upsert (all columns from SESSION_START)
    let sessionOk = false;
    if (sessionUpsertData) {
      const { error } = await supabase.from('sessions')
        .upsert(sessionUpsertData, { onConflict: 'id', ignoreDuplicates: false });
      if (!error) sessionOk = true;
      else console.warn('[events] Full session upsert failed:', error.message);
    }

    // Attempt 2: Medium upsert (common columns only)
    if (!sessionOk) {
      const uaParsed = parseUserAgent(req.headers['user-agent']);
      const mediumData = {
        id: sessionId,
        project_id: projectId,
        started_at: startedAt,
        url: (sessionUpsertData && sessionUpsertData.url) || null,
        browser: (sessionUpsertData && sessionUpsertData.browser) || uaParsed.browser,
        os: (sessionUpsertData && sessionUpsertData.os) || uaParsed.os,
        device_type: (sessionUpsertData && sessionUpsertData.device_type) || uaParsed.device_type,
      };
      if (geoCountry) mediumData.country = geoCountry;
      if (geoLocation) mediumData.city = geoLocation;
      const { error } = await supabase.from('sessions')
        .upsert(mediumData, { onConflict: 'id', ignoreDuplicates: ignoreDups });
      if (!error) sessionOk = true;
      else console.warn('[events] Medium session upsert failed:', error.message);
    }

    // Attempt 3: Bare minimum upsert (just id + project_id + started_at)
    if (!sessionOk) {
      const { error } = await supabase.from('sessions')
        .upsert({
          id: sessionId,
          project_id: projectId,
          started_at: startedAt,
        }, { onConflict: 'id', ignoreDuplicates: ignoreDups });
      if (!error) sessionOk = true;
      else console.warn('[events] Bare minimum session upsert failed:', error.message);
    }

    // Attempt 4: Absolute last resort — just id and project_id
    if (!sessionOk) {
      const { error } = await supabase.from('sessions')
        .upsert({ id: sessionId, project_id: projectId },
          { onConflict: 'id', ignoreDuplicates: true });
      if (error) {
        console.error('[events] All session upsert attempts failed:', error.message);
        throw new Error('Cannot create session: ' + error.message);
      }
    }

    // --- Backfill GeoIP on existing sessions that lack it (non-fatal) ---
    if ((geoCountry || geoLocation) && !sessionUpsertData) {
      try {
        const { data: existing } = await supabase.from('sessions')
          .select('country, city')
          .eq('id', sessionId)
          .single();
        if (existing && !existing.country && !existing.city) {
          const geoUpdate = {};
          if (geoCountry) geoUpdate.country = geoCountry;
          if (geoLocation) geoUpdate.city = geoLocation;
          await supabase.from('sessions').update(geoUpdate).eq('id', sessionId);
        }
      } catch (_) { /* non-fatal */ }
    }

    // --- Identify user on session (non-fatal) ---
    if (identifyData) {
      const { error: identifyError } = await supabase.from('sessions')
        .update(identifyData)
        .eq('id', sessionId);
      if (identifyError) console.warn('[events] Identify update failed:', identifyError.message);
    }

    // --- Batch-insert events ---
    if (eventRows.length > 0) {
      const { error: insertError } = await supabase.from('events')
        .insert(eventRows);
      if (insertError) {
        // If batch insert fails, try inserting one by one to save what we can
        console.warn('[events] Batch insert failed:', insertError.message, '— trying one-by-one');
        let savedCount = 0;
        for (const row of eventRows) {
          const { error: singleErr } = await supabase.from('events').insert(row);
          if (!singleErr) savedCount++;
          else console.warn('[events] Single event insert failed:', singleErr.message);
        }
        if (savedCount === 0) throw new Error('All event inserts failed: ' + insertError.message);
      }
    }

    // --- Update session counters (non-fatal — don't lose events over counter updates) ---
    try {
      if (latestTimestamp > 0) {
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
          if (updateError) console.warn('[events] Counter update failed:', updateError.message);
        }
      }
    } catch (counterErr) {
      console.warn('[events] Counter update exception:', counterErr.message);
    }

    // --- Dispatch webhook notifications (fire-and-forget) ---
    for (const event of events) {
      const evtType = event.type !== undefined ? event.type : event.e;
      const evtData = event.data || event.d || {};

      // JS Error (type 11)
      if (evtType === EVENT_TYPES.JS_ERROR) {
        dispatcher.dispatch('js_error', { session_id: sessionId, ...evtData }, projectId).catch(() => {});
      }

      // Rage Click (type 9)
      if (evtType === EVENT_TYPES.RAGE_CLICK) {
        dispatcher.dispatch('rage_click', { session_id: sessionId, ...evtData }, projectId).catch(() => {});
      }

      // Custom events: cart abandonment / form abandon detection
      if (evtType === EVENT_TYPES.CUSTOM_EVENT && evtData) {
        const eventName = (evtData.name || '').toLowerCase();
        if (eventName.includes('cart_abandonment') || eventName.includes('cart_abandon')) {
          dispatcher.dispatch('cart_abandonment', { session_id: sessionId, ...evtData }, projectId).catch(() => {});
        }
        if (eventName.includes('form_abandon')) {
          dispatcher.dispatch('form_abandon', { session_id: sessionId, ...evtData }, projectId).catch(() => {});
        }
      }

      // Rage click detection from click data
      if (evtType === EVENT_TYPES.MOUSE_CLICK && evtData && evtData.is_rage_click) {
        dispatcher.dispatch('rage_click', { session_id: sessionId, ...evtData }, projectId).catch(() => {});
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

// ============================================================================
// GET /api/events/diagnostic — Quick health check for tracker integration
// ============================================================================
router.get('/diagnostic', async (req, res) => {
  try {
    const project_id = req.query.project_id || 'default';

    // Count total sessions
    const { count: sessionCount, error: sessErr } = await supabase.from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', project_id);

    // Count total events
    const { count: eventCount, error: evtErr } = await supabase.from('events')
      .select('*', { count: 'exact', head: true });

    // Get last 5 sessions
    const { data: recentSessions, error: recSessErr } = await supabase.from('sessions')
      .select('id, visitor_id, started_at, url, browser, os, device_type, event_count, duration')
      .eq('project_id', project_id)
      .order('started_at', { ascending: false })
      .limit(5);

    // Get last 10 events
    const { data: recentEvents, error: recEvtErr } = await supabase.from('events')
      .select('id, session_id, type, timestamp, url, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    // Event type distribution
    const eventTypeCounts = {};
    if (recentEvents) {
      for (const e of recentEvents) {
        const typeName = Object.keys(EVENT_TYPES).find(k => EVENT_TYPES[k] === e.type) || `unknown(${e.type})`;
        eventTypeCounts[typeName] = (eventTypeCounts[typeName] || 0) + 1;
      }
    }

    res.json({
      status: 'ok',
      project_id,
      summary: {
        total_sessions: sessionCount || 0,
        total_events: eventCount || 0,
      },
      recent_sessions: recentSessions || [],
      recent_events: (recentEvents || []).map(e => ({
        ...e,
        type_name: Object.keys(EVENT_TYPES).find(k => EVENT_TYPES[k] === e.type) || `unknown(${e.type})`,
      })),
      event_type_distribution: eventTypeCounts,
      errors: {
        sessions: sessErr ? sessErr.message : null,
        events: evtErr ? evtErr.message : null,
        recent_sessions: recSessErr ? recSessErr.message : null,
        recent_events: recEvtErr ? recEvtErr.message : null,
      },
    });
  } catch (err) {
    console.error('[events] GET /diagnostic error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/events/debug-schema — Show table columns & test insert
// ============================================================================
router.get('/debug-schema', async (req, res) => {
  const results = {};

  // 1. Try to read one row from sessions to see which columns exist
  try {
    const { data, error } = await supabase.from('sessions').select('*').limit(1);
    if (error) {
      results.sessions_error = error.message;
    } else {
      results.sessions_columns = data && data.length > 0 ? Object.keys(data[0]) : 'table exists but empty';
    }
  } catch (e) {
    results.sessions_error = e.message;
  }

  // 2. Try to read one row from events to see which columns exist
  try {
    const { data, error } = await supabase.from('events').select('*').limit(1);
    if (error) {
      results.events_error = error.message;
    } else {
      results.events_columns = data && data.length > 0 ? Object.keys(data[0]) : 'table exists but empty';
    }
  } catch (e) {
    results.events_error = e.message;
  }

  // 3. Check projects table columns
  try {
    const { data, error } = await supabase.from('projects').select('*').limit(1);
    if (error) {
      results.projects_error = error.message;
    } else {
      results.projects_columns = data && data.length > 0 ? Object.keys(data[0]) : 'table exists but empty';
    }
  } catch (e) {
    results.projects_error = e.message;
  }

  // 4. Test full chain: create project → create session → create event → clean up
  const testProjectId = '_debug_test_' + Date.now();
  const testSessionId = 'test-sess-' + Date.now();

  // Step A: Create project
  try {
    const { error } = await supabase.from('projects')
      .insert({ id: testProjectId, name: 'Debug Test' });
    results.test_project_insert = error ? 'FAILED: ' + error.message : 'OK';
  } catch (e) {
    results.test_project_insert = 'EXCEPTION: ' + e.message;
  }

  // Step B: Create session (requires project)
  try {
    const { error } = await supabase.from('sessions')
      .insert({ id: testSessionId, project_id: testProjectId, started_at: new Date().toISOString() });
    results.test_session_insert = error ? 'FAILED: ' + error.message : 'OK';
  } catch (e) {
    results.test_session_insert = 'EXCEPTION: ' + e.message;
  }

  // Step C: Create event (requires session)
  try {
    const { error } = await supabase.from('events')
      .insert({ session_id: testSessionId, type: 0, timestamp: Date.now(), data: {} });
    results.test_event_insert = error ? 'FAILED: ' + error.message : 'OK';
  } catch (e) {
    results.test_event_insert = 'EXCEPTION: ' + e.message;
  }

  // Clean up test data
  try {
    await supabase.from('events').delete().eq('session_id', testSessionId);
    await supabase.from('sessions').delete().eq('id', testSessionId);
    await supabase.from('projects').delete().eq('id', testProjectId);
    results.test_cleanup = 'OK';
  } catch (e) {
    results.test_cleanup = 'FAILED: ' + e.message;
  }

  res.json({ debug_schema: results });
});

module.exports = router;
