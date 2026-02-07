'use strict';

const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// ============================================================================
// Constants
// ============================================================================
const EVENT_TYPE_CUSTOM = 12;
const MAX_EVENTS = 10000;

// ============================================================================
// Helper: fetch scroll_depth custom events for a project + date range
// ============================================================================
async function fetchScrollDepthEvents(project_id, date_from, date_to) {
  // Step 1: Get session IDs from sessions table by project_id + date range
  let sessQuery = supabase.from('sessions')
    .select('id')
    .eq('project_id', project_id || 'default');

  if (date_from) sessQuery = sessQuery.gte('started_at', date_from);
  if (date_to)   sessQuery = sessQuery.lte('started_at', date_to);

  const { data: sessions, error: sessError } = await sessQuery;
  if (sessError) throw sessError;

  if (!sessions || sessions.length === 0) return [];

  const sessionIds = sessions.map(s => s.id);

  // Step 2: Fetch custom events for those sessions, filtered by type
  // Process in batches to avoid query limits
  const batchSize = 200;
  let allEvents = [];

  for (let i = 0; i < sessionIds.length; i += batchSize) {
    const batch = sessionIds.slice(i, i + batchSize);
    const { data: events, error: evtError } = await supabase.from('events')
      .select('data, session_id')
      .eq('type', EVENT_TYPE_CUSTOM)
      .in('session_id', batch)
      .limit(MAX_EVENTS);

    if (evtError) throw evtError;
    if (events) allEvents = allEvents.concat(events);
  }

  // Step 3: Filter by data.name = 'scroll_depth'
  return allEvents.filter(e => e.data && e.data.name === 'scroll_depth');
}

// ============================================================================
// Helper: extract scroll depth properties from an event
// ============================================================================
function getProps(event) {
  const d = event.data || {};
  const props = d.properties || d.props || {};
  return {
    url: props.url || d.url || '',
    max_depth_percent: parseFloat(props.max_depth_percent) || 0,
    time_on_page_ms: parseInt(props.time_on_page_ms, 10) || 0,
    zones_seen: Array.isArray(props.zones_seen) ? props.zones_seen : [],
  };
}

// ============================================================================
// GET /api/scrolldepth/overview
// Average scroll depth across all pages, % reaching 25/50/75/100%
// ============================================================================
router.get('/overview', async (req, res) => {
  try {
    const { project_id = 'default', date_from, date_to } = req.query;

    const events = await fetchScrollDepthEvents(project_id, date_from, date_to);

    if (events.length === 0) {
      return res.json({
        total_events: 0,
        avg_depth_percent: 0,
        pct_reaching_25: 0,
        pct_reaching_50: 0,
        pct_reaching_75: 0,
        pct_reaching_100: 0,
        avg_time_on_page_ms: 0,
      });
    }

    let totalDepth = 0;
    let totalTime = 0;
    let reaching25 = 0;
    let reaching50 = 0;
    let reaching75 = 0;
    let reaching100 = 0;

    for (const event of events) {
      const props = getProps(event);
      totalDepth += props.max_depth_percent;
      totalTime += props.time_on_page_ms;
      if (props.max_depth_percent >= 25) reaching25++;
      if (props.max_depth_percent >= 50) reaching50++;
      if (props.max_depth_percent >= 75) reaching75++;
      if (props.max_depth_percent >= 100) reaching100++;
    }

    const count = events.length;

    res.json({
      total_events: count,
      avg_depth_percent: Math.round((totalDepth / count) * 10) / 10,
      pct_reaching_25: Math.round((reaching25 / count) * 1000) / 10,
      pct_reaching_50: Math.round((reaching50 / count) * 1000) / 10,
      pct_reaching_75: Math.round((reaching75 / count) * 1000) / 10,
      pct_reaching_100: Math.round((reaching100 / count) * 1000) / 10,
      avg_time_on_page_ms: Math.round(totalTime / count),
    });
  } catch (err) {
    console.error('[scrolldepth] GET /overview error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/scrolldepth/pages
// Per-page scroll depth data
// ============================================================================
router.get('/pages', async (req, res) => {
  try {
    const { project_id = 'default', date_from, date_to } = req.query;

    const events = await fetchScrollDepthEvents(project_id, date_from, date_to);

    // Group by URL
    const pageMap = {};

    for (const event of events) {
      const props = getProps(event);
      const url = props.url;
      if (!url) continue;

      if (!pageMap[url]) {
        pageMap[url] = {
          url,
          depths: [],
          maxDepths: [],
          times: [],
          bounceCount: 0,
          totalEvents: 0,
        };
      }

      const page = pageMap[url];
      page.depths.push(props.max_depth_percent);
      page.maxDepths.push(props.max_depth_percent);
      page.times.push(props.time_on_page_ms);
      page.totalEvents++;

      // Bounce = didn't scroll past 10%
      if (props.max_depth_percent <= 10) {
        page.bounceCount++;
      }
    }

    const pages = Object.values(pageMap).map(page => {
      const count = page.totalEvents;
      const avgDepth = count > 0
        ? Math.round((page.depths.reduce((a, b) => a + b, 0) / count) * 10) / 10
        : 0;
      const maxDepth = Math.max(0, ...page.maxDepths);
      const bounceRate = count > 0
        ? Math.round((page.bounceCount / count) * 1000) / 10
        : 0;
      const avgTime = count > 0
        ? Math.round(page.times.reduce((a, b) => a + b, 0) / count)
        : 0;

      return {
        url: page.url,
        avg_depth_percent: avgDepth,
        max_depth_percent: Math.round(maxDepth * 10) / 10,
        bounce_rate: bounceRate,
        avg_time_on_page_ms: avgTime,
        event_count: count,
      };
    }).sort((a, b) => b.event_count - a.event_count);

    res.json({ pages });
  } catch (err) {
    console.error('[scrolldepth] GET /pages error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/scrolldepth/page-detail?url=X
// Detailed scroll depth for a specific page: zone-by-zone engagement
// ============================================================================
router.get('/page-detail', async (req, res) => {
  try {
    const { url, project_id = 'default', date_from, date_to } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'url parameter is required' });
    }

    const events = await fetchScrollDepthEvents(project_id, date_from, date_to);

    // Filter to specific URL
    const pageEvents = events.filter(e => {
      const props = getProps(e);
      return props.url === url;
    });

    if (pageEvents.length === 0) {
      return res.json({
        url,
        total_events: 0,
        zones: [],
        avg_depth_percent: 0,
        avg_time_on_page_ms: 0,
      });
    }

    // Build zone data: split page into 10 zones (0-10%, 10-20%, ... 90-100%)
    const zoneThresholds = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90];
    const zoneCounts = new Array(10).fill(0);
    let totalDepth = 0;
    let totalTime = 0;

    for (const event of pageEvents) {
      const props = getProps(event);
      totalDepth += props.max_depth_percent;
      totalTime += props.time_on_page_ms;

      // Count visitors reaching each zone
      for (let z = 0; z < zoneThresholds.length; z++) {
        if (props.max_depth_percent >= zoneThresholds[z]) {
          zoneCounts[z]++;
        }
      }
    }

    const count = pageEvents.length;

    const zones = zoneThresholds.map((threshold, i) => {
      const visitors = zoneCounts[i];
      const pct = count > 0 ? Math.round((visitors / count) * 1000) / 10 : 0;
      return {
        zone_start: threshold,
        zone_end: threshold + 10,
        label: `${threshold}%-${threshold + 10}%`,
        visitors,
        percentage: pct,
      };
    });

    res.json({
      url,
      total_events: count,
      zones,
      avg_depth_percent: Math.round((totalDepth / count) * 10) / 10,
      avg_time_on_page_ms: Math.round(totalTime / count),
    });
  } catch (err) {
    console.error('[scrolldepth] GET /page-detail error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
