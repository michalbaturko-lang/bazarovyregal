'use strict';

const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// ============================================================================
// Helper: Normalize URL path (strip trailing slash, query string, hash)
// ============================================================================
function normalizePath(url) {
  if (!url) return '/';
  try {
    // Handle full URLs
    let path = url;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const u = new URL(url);
      path = u.pathname;
    }
    // Remove query string and hash
    path = path.split('?')[0].split('#')[0];
    // Remove trailing slash (keep root /)
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    return path || '/';
  } catch (_) {
    return url || '/';
  }
}

// ============================================================================
// Helper: Fetch page navigation events for the given filters
// ============================================================================
async function fetchNavigationEvents(projectId, dateFrom, dateTo) {
  // Fetch sessions in the date range
  let sessQuery = supabase.from('sessions')
    .select('id, started_at, duration')
    .eq('project_id', projectId);

  if (dateFrom) sessQuery = sessQuery.gte('started_at', dateFrom);
  if (dateTo)   sessQuery = sessQuery.lte('started_at', dateTo);

  const { data: sessions, error: sessError } = await sessQuery
    .order('started_at', { ascending: true })
    .limit(5000);
  if (sessError) throw sessError;
  if (!sessions || sessions.length === 0) return { sessions: [], events: [] };

  const sessionIds = sessions.map(s => s.id);
  const sessionMap = new Map(sessions.map(s => [s.id, s]));

  // Fetch events for these sessions (page navigations are type 14,
  // but also look for any event that has a url field indicating page change)
  const BATCH_SIZE = 500;
  let allEvents = [];

  for (let i = 0; i < sessionIds.length; i += BATCH_SIZE) {
    const batch = sessionIds.slice(i, i + BATCH_SIZE);

    const { data: events, error: evtError } = await supabase.from('events')
      .select('id, session_id, type, url, timestamp, data')
      .in('session_id', batch)
      .order('timestamp', { ascending: true });
    if (evtError) throw evtError;
    if (events) allEvents = allEvents.concat(events);
  }

  return { sessions, events: allEvents, sessionMap };
}

// ============================================================================
// Helper: Build page sequences from events
// ============================================================================
function buildPageSequences(events, sessionMap) {
  // Group events by session
  const sessionEvents = new Map();
  for (const evt of events) {
    if (!sessionEvents.has(evt.session_id)) {
      sessionEvents.set(evt.session_id, []);
    }
    sessionEvents.get(evt.session_id).push(evt);
  }

  const sequences = new Map(); // session_id -> [{url, timestamp, duration_on_page}]

  for (const [sessionId, evts] of sessionEvents) {
    // Sort by timestamp
    evts.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Extract page sequence by finding URL changes
    const pages = [];
    let lastUrl = null;

    for (const evt of evts) {
      let pageUrl = null;

      // Check url field directly
      if (evt.url) {
        pageUrl = normalizePath(evt.url);
      }
      // Check data field for href / url
      else if (evt.data) {
        const d = typeof evt.data === 'string' ? JSON.parse(evt.data) : evt.data;
        if (d.href) pageUrl = normalizePath(d.href);
        else if (d.url) pageUrl = normalizePath(d.url);
      }

      if (pageUrl && pageUrl !== lastUrl) {
        pages.push({
          url: pageUrl,
          timestamp: evt.timestamp,
        });
        lastUrl = pageUrl;
      }
    }

    // Calculate duration on each page
    for (let i = 0; i < pages.length; i++) {
      if (i < pages.length - 1) {
        pages[i].duration = (new Date(pages[i + 1].timestamp) - new Date(pages[i].timestamp)) / 1000;
      } else {
        // Last page - estimate from session duration
        const sess = sessionMap.get(sessionId);
        if (sess && sess.duration && pages.length > 1) {
          const sessionStart = new Date(sess.started_at);
          const pageStart = new Date(pages[i].timestamp);
          const sessionEnd = new Date(sessionStart.getTime() + sess.duration * 1000);
          pages[i].duration = Math.max(0, (sessionEnd - pageStart) / 1000);
        } else {
          pages[i].duration = sess ? (sess.duration || 0) : 0;
        }
      }
    }

    if (pages.length > 0) {
      sequences.set(sessionId, pages);
    }
  }

  return sequences;
}

// ============================================================================
// GET /api/journeys/flows — Page-to-page transitions for Sankey diagram
// ============================================================================
router.get('/flows', async (req, res) => {
  try {
    const {
      project_id = 'default',
      date_from,
      date_to,
      min_sessions = '2',
    } = req.query;

    const minSess = parseInt(min_sessions, 10) || 2;
    const { sessions, events, sessionMap } = await fetchNavigationEvents(project_id, date_from, date_to);

    if (sessions.length === 0) {
      return res.json({ nodes: [], links: [] });
    }

    const sequences = buildPageSequences(events, sessionMap);

    // Count sessions per page (nodes)
    const nodeSessionCounts = new Map(); // url -> Set of session_ids
    // Count transitions (links)
    const transitionCounts = new Map(); // "source|||target" -> count

    for (const [sessionId, pages] of sequences) {
      // Track which pages this session visited
      const visited = new Set();
      for (const page of pages) {
        visited.add(page.url);
      }
      for (const url of visited) {
        if (!nodeSessionCounts.has(url)) nodeSessionCounts.set(url, new Set());
        nodeSessionCounts.get(url).add(sessionId);
      }

      // Track transitions
      for (let i = 0; i < pages.length - 1; i++) {
        const key = `${pages[i].url}|||${pages[i + 1].url}`;
        transitionCounts.set(key, (transitionCounts.get(key) || 0) + 1);
      }
    }

    // Build nodes
    const nodes = [];
    for (const [url, sessionSet] of nodeSessionCounts) {
      if (sessionSet.size >= minSess) {
        nodes.push({ id: url, sessions: sessionSet.size });
      }
    }
    nodes.sort((a, b) => b.sessions - a.sessions);

    // Build links (only between nodes that passed the threshold)
    const nodeIds = new Set(nodes.map(n => n.id));
    const links = [];
    for (const [key, count] of transitionCounts) {
      if (count < Math.max(1, Math.floor(minSess / 2))) continue;
      const [source, target] = key.split('|||');
      if (nodeIds.has(source) && nodeIds.has(target)) {
        links.push({ source, target, value: count });
      }
    }
    links.sort((a, b) => b.value - a.value);

    // Identify entry and exit pages
    const entryPages = new Map();
    const exitPages = new Map();
    for (const [sessionId, pages] of sequences) {
      if (pages.length > 0) {
        const entry = pages[0].url;
        entryPages.set(entry, (entryPages.get(entry) || 0) + 1);
        const exit = pages[pages.length - 1].url;
        exitPages.set(exit, (exitPages.get(exit) || 0) + 1);
      }
    }

    // Annotate nodes with entry/exit info
    for (const node of nodes) {
      node.entry_count = entryPages.get(node.id) || 0;
      node.exit_count = exitPages.get(node.id) || 0;
    }

    res.json({
      nodes: nodes.slice(0, 50),
      links: links.slice(0, 200),
      total_sessions: sequences.size,
    });
  } catch (err) {
    console.error('[journeys] GET /flows error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/journeys/paths — Top user paths (page sequences)
// ============================================================================
router.get('/paths', async (req, res) => {
  try {
    const {
      project_id = 'default',
      date_from,
      date_to,
      max_steps = '8',
      limit: rawLimit = '50',
    } = req.query;

    const maxSteps = Math.min(12, Math.max(2, parseInt(max_steps, 10) || 8));
    const limit = Math.min(100, Math.max(1, parseInt(rawLimit, 10) || 50));

    const { sessions, events, sessionMap } = await fetchNavigationEvents(project_id, date_from, date_to);

    if (sessions.length === 0) {
      return res.json({ paths: [] });
    }

    const sequences = buildPageSequences(events, sessionMap);

    // Group sessions by their page path (truncated to maxSteps)
    const pathGroups = new Map(); // pathKey -> { path, sessions: [], totalDuration }

    for (const [sessionId, pages] of sequences) {
      const pathUrls = pages.slice(0, maxSteps).map(p => p.url);
      const pathKey = pathUrls.join(' -> ');
      const totalDuration = pages.reduce((sum, p) => sum + (p.duration || 0), 0);

      if (!pathGroups.has(pathKey)) {
        pathGroups.set(pathKey, {
          path: pathUrls,
          sessions: [],
          totalDuration: 0,
        });
      }

      const group = pathGroups.get(pathKey);
      group.sessions.push(sessionId);
      group.totalDuration += totalDuration;
    }

    // Convert to array, compute averages, sort by count
    const paths = [];
    for (const [, group] of pathGroups) {
      if (group.sessions.length < 2) continue;
      paths.push({
        path: group.path,
        sessions: group.sessions.length,
        avg_duration: Math.round(group.totalDuration / group.sessions.length),
        steps: group.path.length,
      });
    }

    paths.sort((a, b) => b.sessions - a.sessions);

    res.json({
      paths: paths.slice(0, limit),
      total_unique_paths: pathGroups.size,
      total_sessions: sequences.size,
    });
  } catch (err) {
    console.error('[journeys] GET /paths error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/journeys/entry-exit — Entry and exit page analysis
// ============================================================================
router.get('/entry-exit', async (req, res) => {
  try {
    const {
      project_id = 'default',
      date_from,
      date_to,
    } = req.query;

    const { sessions, events, sessionMap } = await fetchNavigationEvents(project_id, date_from, date_to);

    if (sessions.length === 0) {
      return res.json({ entry_pages: [], exit_pages: [] });
    }

    const sequences = buildPageSequences(events, sessionMap);

    // Entry pages analysis
    const entryStats = new Map(); // url -> { sessions, bounces, totalDuration }
    // Exit pages analysis
    const exitStats = new Map(); // url -> { sessions, totalTimeBeforeExit }

    for (const [sessionId, pages] of sequences) {
      if (pages.length === 0) continue;

      const entryUrl = pages[0].url;
      const exitUrl = pages[pages.length - 1].url;
      const isBounce = pages.length === 1;
      const totalDuration = pages.reduce((sum, p) => sum + (p.duration || 0), 0);

      // Entry
      if (!entryStats.has(entryUrl)) {
        entryStats.set(entryUrl, { sessions: 0, bounces: 0, totalDuration: 0 });
      }
      const entry = entryStats.get(entryUrl);
      entry.sessions++;
      if (isBounce) entry.bounces++;
      entry.totalDuration += totalDuration;

      // Exit
      if (!exitStats.has(exitUrl)) {
        exitStats.set(exitUrl, { sessions: 0, totalTimeBeforeExit: 0 });
      }
      const exit = exitStats.get(exitUrl);
      exit.sessions++;
      exit.totalTimeBeforeExit += totalDuration;
    }

    const totalSessions = sequences.size;

    // Build entry pages response
    const entry_pages = [];
    for (const [url, stats] of entryStats) {
      entry_pages.push({
        url,
        sessions: stats.sessions,
        bounce_rate: stats.sessions > 0
          ? parseFloat(((stats.bounces / stats.sessions) * 100).toFixed(1))
          : 0,
        avg_duration: stats.sessions > 0
          ? Math.round(stats.totalDuration / stats.sessions)
          : 0,
      });
    }
    entry_pages.sort((a, b) => b.sessions - a.sessions);

    // Build exit pages response
    const exit_pages = [];
    for (const [url, stats] of exitStats) {
      exit_pages.push({
        url,
        sessions: stats.sessions,
        exit_rate: totalSessions > 0
          ? parseFloat(((stats.sessions / totalSessions) * 100).toFixed(1))
          : 0,
        avg_time_before_exit: stats.sessions > 0
          ? Math.round(stats.totalTimeBeforeExit / stats.sessions)
          : 0,
      });
    }
    exit_pages.sort((a, b) => b.sessions - a.sessions);

    res.json({
      entry_pages: entry_pages.slice(0, 30),
      exit_pages: exit_pages.slice(0, 30),
      total_sessions: totalSessions,
    });
  } catch (err) {
    console.error('[journeys] GET /entry-exit error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/journeys/page-flow/:url — Flow detail for a specific page
// ============================================================================
router.get('/page-flow/:url(*)', async (req, res) => {
  try {
    const targetUrl = normalizePath('/' + req.params.url);
    const {
      project_id = 'default',
      date_from,
      date_to,
    } = req.query;

    const { sessions, events, sessionMap } = await fetchNavigationEvents(project_id, date_from, date_to);

    if (sessions.length === 0) {
      return res.json({
        url: targetUrl,
        came_from: [],
        went_to: [],
        bounced: 0,
        avg_time_on_page: 0,
        avg_scroll_depth: 0,
      });
    }

    const sequences = buildPageSequences(events, sessionMap);

    const cameFrom = new Map(); // url -> count
    const wentTo = new Map();   // url -> count
    let bounced = 0;
    let totalTimeOnPage = 0;
    let pageVisitCount = 0;

    for (const [, pages] of sequences) {
      for (let i = 0; i < pages.length; i++) {
        if (pages[i].url === targetUrl) {
          pageVisitCount++;
          totalTimeOnPage += pages[i].duration || 0;

          // Came from
          if (i > 0) {
            const prev = pages[i - 1].url;
            cameFrom.set(prev, (cameFrom.get(prev) || 0) + 1);
          }

          // Went to
          if (i < pages.length - 1) {
            const next = pages[i + 1].url;
            wentTo.set(next, (wentTo.get(next) || 0) + 1);
          } else {
            // This was the last page (exit / bounce)
            bounced++;
          }
        }
      }
    }

    // Build came_from array
    const came_from = [];
    for (const [url, count] of cameFrom) {
      came_from.push({ url, count });
    }
    came_from.sort((a, b) => b.count - a.count);

    // Build went_to array
    const went_to = [];
    for (const [url, count] of wentTo) {
      went_to.push({ url, count });
    }
    went_to.sort((a, b) => b.count - a.count);

    // Try to get scroll depth data for this page
    let avgScrollDepth = 0;
    try {
      const { data: scrollEvents } = await supabase.from('events')
        .select('data')
        .ilike('url', `%${targetUrl}%`)
        .eq('type', 6) // scroll events
        .limit(500);

      if (scrollEvents && scrollEvents.length > 0) {
        let totalDepth = 0;
        let depthCount = 0;
        for (const evt of scrollEvents) {
          const d = typeof evt.data === 'string' ? JSON.parse(evt.data) : evt.data;
          if (d && (d.scrollDepth || d.scroll_depth || d.y)) {
            totalDepth += d.scrollDepth || d.scroll_depth || d.y || 0;
            depthCount++;
          }
        }
        if (depthCount > 0) avgScrollDepth = Math.round(totalDepth / depthCount);
      }
    } catch (_) {
      // Scroll depth is optional
    }

    res.json({
      url: targetUrl,
      came_from: came_from.slice(0, 15),
      went_to: went_to.slice(0, 15),
      bounced,
      total_visits: pageVisitCount,
      avg_time_on_page: pageVisitCount > 0 ? Math.round(totalTimeOnPage / pageVisitCount) : 0,
      avg_scroll_depth: avgScrollDepth,
    });
  } catch (err) {
    console.error('[journeys] GET /page-flow error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
