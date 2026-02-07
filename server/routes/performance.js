'use strict';

const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// ============================================================================
// Helpers
// ============================================================================

/** Google Core Web Vitals thresholds */
const THRESHOLDS = {
  lcp:  { good: 2500, poor: 4000 },   // ms
  cls:  { good: 0.1,  poor: 0.25 },   // unitless
  fid:  { good: 100,  poor: 300 },     // ms
  inp:  { good: 200,  poor: 500 },     // ms
  ttfb: { good: 800,  poor: 1800 },    // ms
};

/** Classify a metric value as 'good', 'needs_improvement', or 'poor'. */
function classify(metric, value) {
  if (value == null || value === undefined) return null;
  const t = THRESHOLDS[metric];
  if (!t) return null;
  if (value <= t.good) return 'good';
  if (value >= t.poor) return 'poor';
  return 'needs_improvement';
}

/** Compute the Nth percentile from a sorted array of numbers. */
function percentile(sortedArr, p) {
  if (!sortedArr.length) return null;
  const idx = Math.ceil((p / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, idx)];
}

/** Sort numbers ascending (for percentile calculations). */
function numSort(arr) {
  return arr.slice().sort((a, b) => a - b);
}

/**
 * Fetch web vitals custom events for a given project and date range.
 * Custom events are stored with type = 12 (CUSTOM_EVENT).
 * The `data` JSONB column contains { name: 'web_vitals', properties: {...} }.
 */
async function fetchWebVitalsEvents(projectId, dateFrom, dateTo) {
  // Step 1: get session IDs for this project in the date range
  let sessQuery = supabase.from('sessions')
    .select('id')
    .eq('project_id', projectId);

  if (dateFrom) sessQuery = sessQuery.gte('started_at', dateFrom);
  if (dateTo) sessQuery = sessQuery.lte('started_at', dateTo);

  const { data: sessions, error: sessError } = await sessQuery;
  if (sessError) throw sessError;

  if (!sessions || sessions.length === 0) return [];

  const sessionIds = sessions.map(s => s.id);

  // Step 2: fetch events in batches, then filter to web_vitals
  const allEvents = [];
  const BATCH = 100;

  for (let i = 0; i < sessionIds.length; i += BATCH) {
    const batch = sessionIds.slice(i, i + BATCH);
    const { data: events, error: evtError } = await supabase.from('events')
      .select('id, session_id, type, timestamp, data, created_at')
      .in('session_id', batch)
      .order('timestamp', { ascending: true });

    if (evtError) throw evtError;
    if (events) allEvents.push(...events);
  }

  // Filter to web_vitals events
  return allEvents.filter(e => {
    if (!e.data) return false;
    return e.data.name === 'web_vitals';
  });
}

/** Extract properties from an event, handling both `properties` and `props` keys. */
function getProps(event) {
  if (!event || !event.data) return {};
  return event.data.properties || event.data.props || {};
}

/** Compute Good/NI/Poor percentages for a metric across an array of values. */
function distributionPcts(metric, values) {
  if (!values.length) return { good: 0, needs_improvement: 0, poor: 0 };
  let good = 0, ni = 0, poor = 0;
  for (const v of values) {
    const c = classify(metric, v);
    if (c === 'good') good++;
    else if (c === 'needs_improvement') ni++;
    else if (c === 'poor') poor++;
  }
  const total = values.length;
  return {
    good: Math.round((good / total) * 1000) / 10,
    needs_improvement: Math.round((ni / total) * 1000) / 10,
    poor: Math.round((poor / total) * 1000) / 10,
  };
}

/** Compute overall performance score 0-100 based on percentage of "good" CWVs. */
function performanceScore(lcpValues, clsValues, fidValues, ttfbValues) {
  const metrics = [
    { metric: 'lcp', values: lcpValues },
    { metric: 'cls', values: clsValues },
    { metric: 'fid', values: fidValues },
    { metric: 'ttfb', values: ttfbValues },
  ].filter(m => m.values.length > 0);

  if (metrics.length === 0) return 0;

  let totalGoodPct = 0;
  for (const m of metrics) {
    const dist = distributionPcts(m.metric, m.values);
    totalGoodPct += dist.good;
  }
  return Math.round(totalGoodPct / metrics.length);
}

// ============================================================================
// GET /api/performance/overview
// Overall performance metrics across all pages
// ============================================================================
router.get('/overview', async (req, res) => {
  try {
    const {
      project_id = 'default',
      date_from,
      date_to,
    } = req.query;

    const events = await fetchWebVitalsEvents(project_id, date_from, date_to);

    // Collect metric arrays
    const lcpValues = [];
    const clsValues = [];
    const fidValues = [];
    const inpValues = [];
    const ttfbValues = [];
    const loadTimeValues = [];

    for (const evt of events) {
      const props = getProps(evt);
      if (props.lcp != null) lcpValues.push(Number(props.lcp));
      if (props.cls != null) clsValues.push(Number(props.cls));
      if (props.fid != null) fidValues.push(Number(props.fid));
      if (props.inp != null) inpValues.push(Number(props.inp));
      if (props.ttfb != null) ttfbValues.push(Number(props.ttfb));
      if (props.page_load_time != null) loadTimeValues.push(Number(props.page_load_time));
    }

    // 75th percentile values
    const p75 = {
      lcp: percentile(numSort(lcpValues), 75),
      cls: percentile(numSort(clsValues), 75),
      fid: percentile(numSort(fidValues), 75),
      inp: percentile(numSort(inpValues), 75),
      ttfb: percentile(numSort(ttfbValues), 75),
      page_load_time: percentile(numSort(loadTimeValues), 75),
    };

    // Averages
    const avg = {
      lcp: lcpValues.length ? Math.round(lcpValues.reduce((a, b) => a + b, 0) / lcpValues.length) : null,
      cls: clsValues.length ? Math.round(clsValues.reduce((a, b) => a + b, 0) / clsValues.length * 1000) / 1000 : null,
      fid: fidValues.length ? Math.round(fidValues.reduce((a, b) => a + b, 0) / fidValues.length) : null,
      inp: inpValues.length ? Math.round(inpValues.reduce((a, b) => a + b, 0) / inpValues.length) : null,
      ttfb: ttfbValues.length ? Math.round(ttfbValues.reduce((a, b) => a + b, 0) / ttfbValues.length) : null,
      page_load_time: loadTimeValues.length ? Math.round(loadTimeValues.reduce((a, b) => a + b, 0) / loadTimeValues.length) : null,
    };

    // Good / NI / Poor distributions
    const distributions = {
      lcp: distributionPcts('lcp', lcpValues),
      cls: distributionPcts('cls', clsValues),
      fid: distributionPcts('fid', fidValues),
      inp: distributionPcts('inp', inpValues),
      ttfb: distributionPcts('ttfb', ttfbValues),
    };

    // Overall performance score
    const score = performanceScore(lcpValues, clsValues, fidValues, ttfbValues);

    res.json({
      sample_count: events.length,
      p75,
      avg,
      distributions,
      score,
    });
  } catch (err) {
    console.error('[performance] GET /overview error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/performance/pages
// Per-page performance breakdown
// ============================================================================
router.get('/pages', async (req, res) => {
  try {
    const {
      project_id = 'default',
      date_from,
      date_to,
    } = req.query;

    const events = await fetchWebVitalsEvents(project_id, date_from, date_to);

    // Group by URL
    const pageMap = {};
    for (const evt of events) {
      const props = getProps(evt);
      const url = props.url || 'unknown';
      if (!pageMap[url]) {
        pageMap[url] = { lcp: [], cls: [], fid: [], inp: [], ttfb: [], page_load_time: [] };
      }
      if (props.lcp != null) pageMap[url].lcp.push(Number(props.lcp));
      if (props.cls != null) pageMap[url].cls.push(Number(props.cls));
      if (props.fid != null) pageMap[url].fid.push(Number(props.fid));
      if (props.inp != null) pageMap[url].inp.push(Number(props.inp));
      if (props.ttfb != null) pageMap[url].ttfb.push(Number(props.ttfb));
      if (props.page_load_time != null) pageMap[url].page_load_time.push(Number(props.page_load_time));
    }

    const pages = Object.entries(pageMap).map(([url, metrics]) => {
      const sampleCount = Math.max(
        metrics.lcp.length, metrics.cls.length, metrics.fid.length,
        metrics.ttfb.length, metrics.page_load_time.length
      );
      return {
        url,
        sample_count: sampleCount,
        p75: {
          lcp: percentile(numSort(metrics.lcp), 75),
          cls: percentile(numSort(metrics.cls), 75),
          fid: percentile(numSort(metrics.fid), 75),
          inp: percentile(numSort(metrics.inp), 75),
          ttfb: percentile(numSort(metrics.ttfb), 75),
          page_load_time: percentile(numSort(metrics.page_load_time), 75),
        },
        distributions: {
          lcp: distributionPcts('lcp', metrics.lcp),
          cls: distributionPcts('cls', metrics.cls),
          fid: distributionPcts('fid', metrics.fid),
        },
      };
    }).sort((a, b) => b.sample_count - a.sample_count);

    res.json({ pages });
  } catch (err) {
    console.error('[performance] GET /pages error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/performance/trends
// Daily performance trends over time
// ============================================================================
router.get('/trends', async (req, res) => {
  try {
    const {
      project_id = 'default',
      date_from,
      date_to,
    } = req.query;

    const events = await fetchWebVitalsEvents(project_id, date_from, date_to);

    // Group by date
    const dayMap = {};
    for (const evt of events) {
      const ts = evt.created_at || evt.timestamp;
      if (!ts) continue;
      const day = typeof ts === 'string' ? ts.substring(0, 10) : new Date(ts).toISOString().substring(0, 10);
      if (!dayMap[day]) {
        dayMap[day] = { lcp: [], cls: [], fid: [], inp: [], ttfb: [], page_load_time: [] };
      }
      const props = getProps(evt);
      if (props.lcp != null) dayMap[day].lcp.push(Number(props.lcp));
      if (props.cls != null) dayMap[day].cls.push(Number(props.cls));
      if (props.fid != null) dayMap[day].fid.push(Number(props.fid));
      if (props.inp != null) dayMap[day].inp.push(Number(props.inp));
      if (props.ttfb != null) dayMap[day].ttfb.push(Number(props.ttfb));
      if (props.page_load_time != null) dayMap[day].page_load_time.push(Number(props.page_load_time));
    }

    const trends = Object.entries(dayMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, metrics]) => ({
        date,
        samples: Math.max(metrics.lcp.length, metrics.cls.length, metrics.fid.length),
        p75: {
          lcp: percentile(numSort(metrics.lcp), 75),
          cls: percentile(numSort(metrics.cls), 75),
          fid: percentile(numSort(metrics.fid), 75),
          inp: percentile(numSort(metrics.inp), 75),
          ttfb: percentile(numSort(metrics.ttfb), 75),
          page_load_time: percentile(numSort(metrics.page_load_time), 75),
        },
        distributions: {
          lcp: distributionPcts('lcp', metrics.lcp),
          cls: distributionPcts('cls', metrics.cls),
          fid: distributionPcts('fid', metrics.fid),
        },
      }));

    res.json({ trends });
  } catch (err) {
    console.error('[performance] GET /trends error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/performance/slow-pages
// Pages ranked by worst performance (highest LCP p75)
// ============================================================================
router.get('/slow-pages', async (req, res) => {
  try {
    const {
      project_id = 'default',
      date_from,
      date_to,
      limit = 20,
    } = req.query;

    const events = await fetchWebVitalsEvents(project_id, date_from, date_to);

    // Group by URL
    const pageMap = {};
    for (const evt of events) {
      const props = getProps(evt);
      const url = props.url || 'unknown';
      if (!pageMap[url]) {
        pageMap[url] = { lcp: [], cls: [], fid: [], inp: [], ttfb: [], page_load_time: [], connections: {} };
      }
      if (props.lcp != null) pageMap[url].lcp.push(Number(props.lcp));
      if (props.cls != null) pageMap[url].cls.push(Number(props.cls));
      if (props.fid != null) pageMap[url].fid.push(Number(props.fid));
      if (props.inp != null) pageMap[url].inp.push(Number(props.inp));
      if (props.ttfb != null) pageMap[url].ttfb.push(Number(props.ttfb));
      if (props.page_load_time != null) pageMap[url].page_load_time.push(Number(props.page_load_time));
      if (props.connection_type) {
        pageMap[url].connections[props.connection_type] = (pageMap[url].connections[props.connection_type] || 0) + 1;
      }
    }

    const slowPages = Object.entries(pageMap)
      .map(([url, metrics]) => {
        const lcpP75 = percentile(numSort(metrics.lcp), 75);
        const sampleCount = Math.max(
          metrics.lcp.length, metrics.cls.length, metrics.fid.length,
          metrics.ttfb.length, metrics.page_load_time.length
        );
        return {
          url,
          sample_count: sampleCount,
          p75: {
            lcp: lcpP75,
            cls: percentile(numSort(metrics.cls), 75),
            fid: percentile(numSort(metrics.fid), 75),
            inp: percentile(numSort(metrics.inp), 75),
            ttfb: percentile(numSort(metrics.ttfb), 75),
            page_load_time: percentile(numSort(metrics.page_load_time), 75),
          },
          classification: {
            lcp: classify('lcp', lcpP75),
            cls: classify('cls', percentile(numSort(metrics.cls), 75)),
            fid: classify('fid', percentile(numSort(metrics.fid), 75)),
            ttfb: classify('ttfb', percentile(numSort(metrics.ttfb), 75)),
          },
          connections: metrics.connections,
        };
      })
      // Sort by LCP p75 descending (slowest first), fallback to page_load_time
      .sort((a, b) => {
        const aVal = a.p75.lcp != null ? a.p75.lcp : (a.p75.page_load_time || 0);
        const bVal = b.p75.lcp != null ? b.p75.lcp : (b.p75.page_load_time || 0);
        return bVal - aVal;
      })
      .slice(0, parseInt(limit));

    res.json({ slow_pages: slowPages });
  } catch (err) {
    console.error('[performance] GET /slow-pages error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
