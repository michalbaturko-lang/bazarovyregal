'use strict';

const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// ============================================================================
// Helpers
// ============================================================================

/** E-commerce event names relevant for revenue analytics. */
const REVENUE_EVENTS = [
  'page_view', 'product_view', 'add_to_cart', 'remove_from_cart',
  'checkout_start', 'checkout_step', 'purchase'
];

/**
 * Fetch sessions with their e-commerce events and session metadata for a
 * given project and date range.  Returns both the raw events and full
 * session objects (with UTM / referrer / device info for attribution).
 */
async function fetchSessionsAndEvents(projectId, dateFrom, dateTo) {
  // 1. Get sessions in the date range with metadata needed for attribution
  let sessQuery = supabase.from('sessions')
    .select('id, started_at, utm_source, utm_medium, utm_campaign, referrer, browser, device_type, country, entry_url')
    .eq('project_id', projectId);

  if (dateFrom) sessQuery = sessQuery.gte('started_at', dateFrom);
  if (dateTo) sessQuery = sessQuery.lte('started_at', dateTo);

  const { data: sessions, error: sessError } = await sessQuery;
  if (sessError) throw sessError;
  if (!sessions || sessions.length === 0) return { events: [], sessions: [], sessionMap: {} };

  const sessionMap = {};
  for (const s of sessions) sessionMap[s.id] = s;
  const sessionIds = sessions.map(s => s.id);

  // 2. Fetch events in batches
  const allEvents = [];
  const BATCH = 100;

  for (let i = 0; i < sessionIds.length; i += BATCH) {
    const batch = sessionIds.slice(i, i + BATCH);
    const { data: events, error: evtError } = await supabase.from('events')
      .select('id, session_id, type, timestamp, data, url, created_at')
      .in('session_id', batch)
      .order('timestamp', { ascending: true });

    if (evtError) throw evtError;
    if (events) allEvents.push(...events);
  }

  // 3. Filter to e-commerce events
  const ecomEvents = allEvents.filter(e => {
    if (!e.data) return false;
    const name = e.data.name;
    return name && REVENUE_EVENTS.includes(name);
  });

  return { events: ecomEvents, sessions, sessionMap };
}

/** Extract properties from an event's data, handling both `properties` and `props` keys. */
function getProps(event) {
  if (!event || !event.data) return {};
  return event.data.properties || event.data.props || {};
}

/** Round to two decimal places. */
function round2(n) {
  return Math.round(n * 100) / 100;
}

/** Get the date string (YYYY-MM-DD) from an event. */
function eventDate(e) {
  if (e.created_at) return e.created_at.substring(0, 10);
  if (e.timestamp) return new Date(e.timestamp).toISOString().substring(0, 10);
  return new Date().toISOString().substring(0, 10);
}

/**
 * Simple linear regression on an array of { x, y } points.
 * Returns { slope, intercept, r2 }.
 */
function linearRegression(points) {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: 0, r2: 0 };

  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, sumYY = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumXX += p.x * p.x;
    sumYY += p.y * p.y;
  }

  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n, r2: 0 };

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  // R-squared
  const meanY = sumY / n;
  let ssTot = 0, ssRes = 0;
  for (const p of points) {
    ssTot += (p.y - meanY) ** 2;
    ssRes += (p.y - (slope * p.x + intercept)) ** 2;
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return { slope, intercept, r2 };
}

// ============================================================================
// GET /api/revenue/overview
// ============================================================================
router.get('/overview', async (req, res) => {
  try {
    const {
      project_id = 'default',
      date_from,
      date_to,
    } = req.query;

    const { events, sessions } = await fetchSessionsAndEvents(project_id, date_from, date_to);

    // Group events by session
    const sessionEvents = {};
    for (const e of events) {
      if (!sessionEvents[e.session_id]) sessionEvents[e.session_id] = [];
      sessionEvents[e.session_id].push(e);
    }

    let totalRevenue = 0;
    let transactionCount = 0;
    const buyerSessions = new Set();
    const revenueByDay = {};

    for (const sid of Object.keys(sessionEvents)) {
      const sEvents = sessionEvents[sid];
      for (const e of sEvents) {
        if (e.data.name !== 'purchase') continue;
        const props = getProps(e);
        const orderTotal = parseFloat(props.total) || 0;

        totalRevenue += orderTotal;
        transactionCount++;
        buyerSessions.add(sid);

        const day = eventDate(e);
        if (!revenueByDay[day]) revenueByDay[day] = { revenue: 0, transactions: 0 };
        revenueByDay[day].revenue += orderTotal;
        revenueByDay[day].transactions++;
      }
    }

    const aov = transactionCount > 0 ? totalRevenue / transactionCount : 0;
    const uniqueBuyers = buyerSessions.size;

    // Revenue by day sorted
    const revenueTimeline = Object.entries(revenueByDay)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, d]) => ({
        date,
        revenue: round2(d.revenue),
        transactions: d.transactions,
      }));

    res.json({
      total_revenue: round2(totalRevenue),
      transaction_count: transactionCount,
      aov: round2(aov),
      unique_buyers: uniqueBuyers,
      revenue_by_day: revenueTimeline,
    });
  } catch (err) {
    console.error('[revenue] GET /overview error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/revenue/attribution
// ============================================================================
router.get('/attribution', async (req, res) => {
  try {
    const {
      project_id = 'default',
      date_from,
      date_to,
      group_by = 'utm_source',
    } = req.query;

    const validGroupBy = ['utm_source', 'utm_medium', 'utm_campaign', 'referrer', 'browser', 'device_type', 'country'];
    const groupField = validGroupBy.includes(group_by) ? group_by : 'utm_source';

    const { events, sessions, sessionMap } = await fetchSessionsAndEvents(project_id, date_from, date_to);

    // Group events by session
    const sessionEvents = {};
    for (const e of events) {
      if (!sessionEvents[e.session_id]) sessionEvents[e.session_id] = [];
      sessionEvents[e.session_id].push(e);
    }

    // Track revenue attribution per group value
    const attributionMap = {};  // groupValue -> { revenue, transactions, sessions (Set) }
    const totalSessions = sessions.length;
    let totalRevenue = 0;

    // First pass: count all sessions per group value
    const sessionsPerGroup = {};
    for (const s of sessions) {
      const groupValue = s[groupField] || '(direct / none)';
      if (!sessionsPerGroup[groupValue]) sessionsPerGroup[groupValue] = 0;
      sessionsPerGroup[groupValue]++;
    }

    // Second pass: attribute revenue
    for (const sid of Object.keys(sessionEvents)) {
      const sEvents = sessionEvents[sid];
      const session = sessionMap[sid];
      if (!session) continue;

      const groupValue = session[groupField] || '(direct / none)';

      for (const e of sEvents) {
        if (e.data.name !== 'purchase') continue;
        const props = getProps(e);
        const orderTotal = parseFloat(props.total) || 0;

        if (!attributionMap[groupValue]) {
          attributionMap[groupValue] = { revenue: 0, transactions: 0, sessions: new Set() };
        }
        attributionMap[groupValue].revenue += orderTotal;
        attributionMap[groupValue].transactions++;
        attributionMap[groupValue].sessions.add(sid);
        totalRevenue += orderTotal;
      }
    }

    // Build attribution list
    const attributions = Object.entries(attributionMap)
      .map(([source, data]) => {
        const groupSessions = sessionsPerGroup[source] || 1;
        return {
          source,
          revenue: round2(data.revenue),
          transactions: data.transactions,
          aov: data.transactions > 0 ? round2(data.revenue / data.transactions) : 0,
          conversion_rate: round2((data.sessions.size / groupSessions) * 100),
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    res.json({
      attributions,
      total_revenue: round2(totalRevenue),
    });
  } catch (err) {
    console.error('[revenue] GET /attribution error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/revenue/pages
// ============================================================================
router.get('/pages', async (req, res) => {
  try {
    const {
      project_id = 'default',
      date_from,
      date_to,
    } = req.query;

    const { events, sessions, sessionMap } = await fetchSessionsAndEvents(project_id, date_from, date_to);

    // Group events by session
    const sessionEvents = {};
    for (const e of events) {
      if (!sessionEvents[e.session_id]) sessionEvents[e.session_id] = [];
      sessionEvents[e.session_id].push(e);
    }

    // Count total sessions per entry URL
    const sessionsPerPage = {};
    for (const s of sessions) {
      const url = s.entry_url || '(unknown)';
      if (!sessionsPerPage[url]) sessionsPerPage[url] = 0;
      sessionsPerPage[url]++;
    }

    // Attribute revenue to landing pages (entry_url)
    const pageMap = {};  // entry_url -> { revenue, transactions, sessions (Set) }

    for (const sid of Object.keys(sessionEvents)) {
      const sEvents = sessionEvents[sid];
      const session = sessionMap[sid];
      if (!session) continue;

      const entryUrl = session.entry_url || '(unknown)';

      for (const e of sEvents) {
        if (e.data.name !== 'purchase') continue;
        const props = getProps(e);
        const orderTotal = parseFloat(props.total) || 0;

        if (!pageMap[entryUrl]) {
          pageMap[entryUrl] = { revenue: 0, transactions: 0, sessions: new Set() };
        }
        pageMap[entryUrl].revenue += orderTotal;
        pageMap[entryUrl].transactions++;
        pageMap[entryUrl].sessions.add(sid);
      }
    }

    const pages = Object.entries(pageMap)
      .map(([url, data]) => {
        const totalPageSessions = sessionsPerPage[url] || 1;
        return {
          url,
          revenue: round2(data.revenue),
          transactions: data.transactions,
          sessions: totalPageSessions,
          conversion_rate: round2((data.sessions.size / totalPageSessions) * 100),
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    res.json({ pages });
  } catch (err) {
    console.error('[revenue] GET /pages error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/revenue/products
// ============================================================================
router.get('/products', async (req, res) => {
  try {
    const {
      project_id = 'default',
      date_from,
      date_to,
      limit = 50,
    } = req.query;

    const maxLimit = Math.min(parseInt(limit, 10) || 50, 200);

    const { events } = await fetchSessionsAndEvents(project_id, date_from, date_to);

    // Aggregate per product across purchase and add_to_cart events
    const products = {};  // product_id -> { name, revenue, quantity_sold, prices[], cart_adds }

    for (const e of events) {
      const name = e.data.name;
      const props = getProps(e);

      if (name === 'add_to_cart') {
        const pid = props.id || props.product_id;
        if (!pid) continue;

        if (!products[pid]) {
          products[pid] = { name: props.name || props.product_name || pid, revenue: 0, quantity_sold: 0, prices: [], cart_adds: 0 };
        }
        products[pid].cart_adds++;
        if (props.name) products[pid].name = props.name;
      }

      if (name === 'purchase') {
        const items = props.items || [];
        for (const item of items) {
          const pid = item.id || item.product_id;
          if (!pid) continue;

          if (!products[pid]) {
            products[pid] = { name: item.name || pid, revenue: 0, quantity_sold: 0, prices: [], cart_adds: 0 };
          }
          const qty = item.quantity || 1;
          const price = parseFloat(item.price) || 0;
          products[pid].revenue += price * qty;
          products[pid].quantity_sold += qty;
          products[pid].prices.push(price);
          if (item.name) products[pid].name = item.name;
        }
      }
    }

    const productList = Object.entries(products)
      .map(([product_id, data]) => {
        const avgPrice = data.prices.length > 0
          ? data.prices.reduce((a, b) => a + b, 0) / data.prices.length
          : 0;
        return {
          product_id,
          name: data.name,
          revenue: round2(data.revenue),
          quantity_sold: data.quantity_sold,
          avg_price: round2(avgPrice),
          cart_adds: data.cart_adds,
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, maxLimit);

    res.json({ products: productList });
  } catch (err) {
    console.error('[revenue] GET /products error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/revenue/funnel
// ============================================================================
router.get('/funnel', async (req, res) => {
  try {
    const {
      project_id = 'default',
      date_from,
      date_to,
    } = req.query;

    const { events, sessions } = await fetchSessionsAndEvents(project_id, date_from, date_to);

    // Group events by session
    const sessionEvents = {};
    for (const e of events) {
      if (!sessionEvents[e.session_id]) sessionEvents[e.session_id] = [];
      sessionEvents[e.session_id].push(e);
    }

    // Define funnel stages
    const funnelStages = [
      { name: 'visit', label: 'Visit', eventName: null },
      { name: 'product_view', label: 'Product View', eventName: 'product_view' },
      { name: 'add_to_cart', label: 'Add to Cart', eventName: 'add_to_cart' },
      { name: 'checkout_start', label: 'Checkout Start', eventName: 'checkout_start' },
      { name: 'purchase', label: 'Purchase', eventName: 'purchase' },
    ];

    // Track which stages each session reached and revenue at each stage
    const stageCounts = {};
    const stageRevenue = {};
    for (const stage of funnelStages) {
      stageCounts[stage.name] = 0;
      stageRevenue[stage.name] = 0;
    }

    // All sessions count as visits
    const totalSessions = sessions.length;
    stageCounts['visit'] = totalSessions;

    for (const sid of Object.keys(sessionEvents)) {
      const sEvents = sessionEvents[sid];
      const reached = new Set();
      let sessionRevenue = 0;

      for (const e of sEvents) {
        const eName = e.data.name;
        reached.add(eName);

        if (eName === 'purchase') {
          const props = getProps(e);
          sessionRevenue += parseFloat(props.total) || 0;
        }
      }

      for (const stage of funnelStages) {
        if (stage.eventName && reached.has(stage.eventName)) {
          stageCounts[stage.name]++;
          // Revenue value flows through all reached stages
          if (sessionRevenue > 0) {
            stageRevenue[stage.name] += sessionRevenue;
          }
        }
      }
    }

    // Add visit-level revenue (same as purchase revenue — total from all purchasing sessions)
    stageRevenue['visit'] = stageRevenue['purchase'];

    // Build stage response with drop-off percentages
    const stages = funnelStages.map((stage, i) => {
      const count = stageCounts[stage.name];
      const prevCount = i === 0 ? count : stageCounts[funnelStages[i - 1].name];
      const dropOffPct = prevCount > 0 ? round2(((prevCount - count) / prevCount) * 100) : 0;

      return {
        name: stage.label,
        count,
        value: round2(stageRevenue[stage.name]),
        drop_off_pct: i === 0 ? 0 : dropOffPct,
      };
    });

    const overallConversionRate = totalSessions > 0
      ? round2((stageCounts['purchase'] / totalSessions) * 100)
      : 0;

    res.json({
      stages,
      overall_conversion_rate: overallConversionRate,
    });
  } catch (err) {
    console.error('[revenue] GET /funnel error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/revenue/forecast
// ============================================================================
router.get('/forecast', async (req, res) => {
  try {
    const {
      project_id = 'default',
      days = 7,
    } = req.query;

    const forecastDays = Math.min(parseInt(days, 10) || 7, 30);

    // Fetch last 30 days of data to build the regression model
    const now = new Date();
    const lookbackFrom = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
    const lookbackTo = now.toISOString().slice(0, 10);

    const { events } = await fetchSessionsAndEvents(project_id, lookbackFrom, lookbackTo);

    // Aggregate daily revenue for the lookback period
    const dailyRevenue = {};
    for (let d = 0; d < 30; d++) {
      const date = new Date(now.getTime() - (29 - d) * 86400000).toISOString().slice(0, 10);
      dailyRevenue[date] = 0;
    }

    for (const e of events) {
      if (e.data.name !== 'purchase') continue;
      const props = getProps(e);
      const orderTotal = parseFloat(props.total) || 0;
      const day = eventDate(e);
      if (dailyRevenue.hasOwnProperty(day)) {
        dailyRevenue[day] += orderTotal;
      }
    }

    // Build regression points (x = day index, y = revenue)
    const sortedDays = Object.entries(dailyRevenue).sort((a, b) => a[0].localeCompare(b[0]));
    const points = sortedDays.map(([, rev], i) => ({ x: i, y: rev }));
    const { slope, intercept, r2 } = linearRegression(points);

    // Calculate standard error for confidence interval
    const n = points.length;
    let ssRes = 0;
    for (const p of points) {
      ssRes += (p.y - (slope * p.x + intercept)) ** 2;
    }
    const stdError = n > 2 ? Math.sqrt(ssRes / (n - 2)) : 0;
    const confidenceMultiplier = 1.96; // 95% confidence

    // Generate forecast
    const forecast = [];
    for (let d = 1; d <= forecastDays; d++) {
      const forecastDate = new Date(now.getTime() + d * 86400000).toISOString().slice(0, 10);
      const x = n - 1 + d;
      const predicted = Math.max(0, slope * x + intercept);
      const margin = confidenceMultiplier * stdError * Math.sqrt(1 + 1 / n + ((x - (n - 1) / 2) ** 2) / (n * ((n - 1) / 2) ** 2 || 1));

      forecast.push({
        date: forecastDate,
        predicted_revenue: round2(predicted),
        confidence_low: round2(Math.max(0, predicted - margin)),
        confidence_high: round2(predicted + margin),
      });
    }

    // Determine trend
    let trend = 'stable';
    if (slope > 0.5) trend = 'up';
    else if (slope < -0.5) trend = 'down';

    res.json({
      forecast,
      trend,
      model: {
        slope: round2(slope),
        r_squared: round2(r2),
        lookback_days: 30,
      },
    });
  } catch (err) {
    console.error('[revenue] GET /forecast error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
