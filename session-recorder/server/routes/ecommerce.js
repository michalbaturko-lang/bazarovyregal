'use strict';

const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// ============================================================================
// Helpers
// ============================================================================

/** E-commerce event names tracked by the client-side tracker. */
const ECOM_EVENTS = [
  'page_view', 'product_view', 'add_to_cart', 'remove_from_cart',
  'checkout_start', 'checkout_step', 'purchase', 'cart_abandonment', 'revenue'
];

/**
 * Fetch e-commerce custom events from the events table.
 * Custom events are stored with type = 12 (tracker CUSTOM_EVENT code).
 * The `data` JSONB column contains { name: '<event_name>', properties: {...} }.
 * We also handle the older format where props are in `data.props`.
 */
async function fetchEcommerceEvents(projectId, dateFrom, dateTo) {
  // First get session IDs for this project in the date range
  let sessQuery = supabase.from('sessions')
    .select('id')
    .eq('project_id', projectId);

  if (dateFrom) sessQuery = sessQuery.gte('started_at', dateFrom);
  if (dateTo) sessQuery = sessQuery.lte('started_at', dateTo);

  const { data: sessions, error: sessError } = await sessQuery;
  if (sessError) throw sessError;

  if (!sessions || sessions.length === 0) return { events: [], sessionIds: [] };

  const sessionIds = sessions.map(s => s.id);

  // Fetch events for these sessions — grab all event types and filter in JS
  // because the tracker's CUSTOM_EVENT code (12) may differ from server constants.
  // We batch session IDs in groups to avoid query-string limits.
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

  // Filter to only e-commerce events (check data.name against known event names)
  const ecomEvents = allEvents.filter(e => {
    if (!e.data) return false;
    const name = e.data.name;
    return name && ECOM_EVENTS.includes(name);
  });

  return { events: ecomEvents, sessionIds };
}

/** Extract properties from an event's data, handling both `properties` and `props` keys. */
function getProps(event) {
  if (!event || !event.data) return {};
  return event.data.properties || event.data.props || {};
}

// ============================================================================
// GET /api/ecommerce/overview
// ============================================================================
router.get('/overview', async (req, res) => {
  try {
    const {
      project_id = 'default',
      date_from,
      date_to,
    } = req.query;

    const { events, sessionIds } = await fetchEcommerceEvents(project_id, date_from, date_to);

    // Group events by session
    const sessionEvents = {};
    for (const e of events) {
      if (!sessionEvents[e.session_id]) sessionEvents[e.session_id] = [];
      sessionEvents[e.session_id].push(e);
    }

    // Compute metrics
    let totalRevenue = 0;
    let totalOrders = 0;
    const orderValues = [];
    let sessionsWithCart = 0;
    let sessionsWithPurchase = 0;
    const productViews = {};   // product_id -> count
    const productCarts = {};   // product_id -> count
    const productPurchases = {};  // product_id -> { count, revenue, name }
    const revenueByDay = {};

    for (const sid of Object.keys(sessionEvents)) {
      const sEvents = sessionEvents[sid];
      let hasCart = false;
      let hasPurchase = false;

      for (const e of sEvents) {
        const name = e.data.name;
        const props = getProps(e);

        if (name === 'product_view') {
          const pid = props.id || props.product_id || 'unknown';
          productViews[pid] = (productViews[pid] || 0) + 1;
        }

        if (name === 'add_to_cart') {
          hasCart = true;
          const pid = props.id || props.product_id || 'unknown';
          productCarts[pid] = (productCarts[pid] || 0) + 1;
        }

        if (name === 'purchase') {
          hasPurchase = true;
          const orderTotal = parseFloat(props.total) || 0;
          totalRevenue += orderTotal;
          totalOrders++;
          orderValues.push(orderTotal);

          // Revenue by day
          const day = e.created_at
            ? e.created_at.substring(0, 10)
            : new Date(e.timestamp).toISOString().substring(0, 10);
          revenueByDay[day] = (revenueByDay[day] || 0) + orderTotal;

          // Product purchases
          const items = props.items || [];
          for (const item of items) {
            const pid = item.id || 'unknown';
            if (!productPurchases[pid]) {
              productPurchases[pid] = { count: 0, revenue: 0, name: item.name || pid };
            }
            productPurchases[pid].count += (item.quantity || 1);
            productPurchases[pid].revenue += (parseFloat(item.price) || 0) * (item.quantity || 1);
          }
        }
      }

      if (hasCart) sessionsWithCart++;
      if (hasPurchase) sessionsWithPurchase++;
    }

    const totalSessions = sessionIds.length;
    const avgOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders) : 0;
    const cartAbandonmentRate = sessionsWithCart > 0
      ? ((sessionsWithCart - sessionsWithPurchase) / sessionsWithCart * 100)
      : 0;
    const conversionRate = totalSessions > 0
      ? (sessionsWithPurchase / totalSessions * 100)
      : 0;

    // Top products
    const allProductIds = new Set([
      ...Object.keys(productViews),
      ...Object.keys(productCarts),
      ...Object.keys(productPurchases),
    ]);

    const topProducts = Array.from(allProductIds).map(pid => ({
      product_id: pid,
      name: (productPurchases[pid] && productPurchases[pid].name) || pid,
      views: productViews[pid] || 0,
      add_to_cart: productCarts[pid] || 0,
      purchases: productPurchases[pid] ? productPurchases[pid].count : 0,
      revenue: productPurchases[pid] ? productPurchases[pid].revenue : 0,
    })).sort((a, b) => b.revenue - a.revenue).slice(0, 20);

    // Revenue by day sorted
    const revenueTimeline = Object.entries(revenueByDay)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, revenue]) => ({ date, revenue }));

    res.json({
      total_revenue: Math.round(totalRevenue * 100) / 100,
      total_orders: totalOrders,
      avg_order_value: Math.round(avgOrderValue * 100) / 100,
      cart_abandonment_rate: Math.round(cartAbandonmentRate * 10) / 10,
      conversion_rate: Math.round(conversionRate * 10) / 10,
      total_sessions: totalSessions,
      sessions_with_cart: sessionsWithCart,
      sessions_with_purchase: sessionsWithPurchase,
      top_products: topProducts,
      revenue_by_day: revenueTimeline,
    });
  } catch (err) {
    console.error('[ecommerce] GET /overview error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/ecommerce/cart-abandonment
// ============================================================================
router.get('/cart-abandonment', async (req, res) => {
  try {
    const {
      project_id = 'default',
      date_from,
      date_to,
    } = req.query;

    const { events } = await fetchEcommerceEvents(project_id, date_from, date_to);

    // Group events by session
    const sessionEvents = {};
    for (const e of events) {
      if (!sessionEvents[e.session_id]) sessionEvents[e.session_id] = [];
      sessionEvents[e.session_id].push(e);
    }

    let totalAbandoned = 0;
    let totalCompleted = 0;
    const abandonedSessions = [];
    const abandonedProducts = {};  // product_id -> { name, times_abandoned, times_purchased }
    const exitPages = {};  // url -> count
    const stepCounts = {
      product_view: 0,
      add_to_cart: 0,
      checkout_start: 0,
      checkout_step: 0,
      purchase: 0,
    };

    for (const sid of Object.keys(sessionEvents)) {
      const sEvents = sessionEvents[sid];
      let hasCart = false;
      let hasPurchase = false;
      const sessionProducts = [];
      let sessionTotal = 0;
      let lastUrl = '';
      const reachedSteps = new Set();

      for (const e of sEvents) {
        const name = e.data.name;
        const props = getProps(e);

        if (name === 'product_view') reachedSteps.add('product_view');
        if (name === 'add_to_cart') {
          hasCart = true;
          reachedSteps.add('add_to_cart');
          sessionProducts.push({
            id: props.id || props.product_id || 'unknown',
            name: props.name || props.product_name || 'Unknown',
            price: parseFloat(props.price) || 0,
            quantity: props.quantity || 1,
          });
          sessionTotal += (parseFloat(props.price) || 0) * (props.quantity || 1);
        }
        if (name === 'checkout_start') reachedSteps.add('checkout_start');
        if (name === 'checkout_step') reachedSteps.add('checkout_step');
        if (name === 'purchase') {
          hasPurchase = true;
          reachedSteps.add('purchase');
        }
        if (name === 'cart_abandonment') {
          const abProps = props;
          if (abProps.exit_url) lastUrl = abProps.exit_url;
        }

        // Track last URL from any event
        if (e.url) lastUrl = e.url;
      }

      // Count steps reached
      for (const step of Object.keys(stepCounts)) {
        if (reachedSteps.has(step)) stepCounts[step]++;
      }

      if (hasCart) {
        if (hasPurchase) {
          totalCompleted++;
          // Track purchased products
          for (const p of sessionProducts) {
            if (!abandonedProducts[p.id]) {
              abandonedProducts[p.id] = { name: p.name, times_abandoned: 0, times_purchased: 0 };
            }
            abandonedProducts[p.id].times_purchased++;
          }
        } else {
          totalAbandoned++;
          // Track abandoned products
          for (const p of sessionProducts) {
            if (!abandonedProducts[p.id]) {
              abandonedProducts[p.id] = { name: p.name, times_abandoned: 0, times_purchased: 0 };
            }
            abandonedProducts[p.id].times_abandoned++;
          }
          // Track exit page
          if (lastUrl) {
            exitPages[lastUrl] = (exitPages[lastUrl] || 0) + 1;
          }
          // Add to abandoned sessions list
          abandonedSessions.push({
            session_id: sid,
            products: sessionProducts,
            total_value: Math.round(sessionTotal * 100) / 100,
            exit_page: lastUrl || 'unknown',
          });
        }
      }
    }

    const totalWithCart = totalAbandoned + totalCompleted;
    const abandonmentRate = totalWithCart > 0
      ? Math.round((totalAbandoned / totalWithCart) * 1000) / 10
      : 0;

    // Abandonment by step (funnel drop-off)
    const abandonmentByStep = Object.entries(stepCounts)
      .map(([step, count]) => ({ step, count }));

    // Top abandoned products
    const topAbandonedProducts = Object.entries(abandonedProducts)
      .map(([id, data]) => ({
        product_id: id,
        product_name: data.name,
        times_abandoned: data.times_abandoned,
        times_purchased: data.times_purchased,
      }))
      .sort((a, b) => b.times_abandoned - a.times_abandoned)
      .slice(0, 20);

    // Common exit pages
    const commonExitPages = Object.entries(exitPages)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([url, count]) => ({ url, count }));

    res.json({
      abandonment_rate: abandonmentRate,
      total_abandoned: totalAbandoned,
      total_completed: totalCompleted,
      abandonment_by_step: abandonmentByStep,
      top_abandoned_products: topAbandonedProducts,
      sessions_with_abandonment: abandonedSessions.slice(0, 50),
      common_exit_pages: commonExitPages,
    });
  } catch (err) {
    console.error('[ecommerce] GET /cart-abandonment error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/ecommerce/products
// ============================================================================
router.get('/products', async (req, res) => {
  try {
    const {
      project_id = 'default',
      date_from,
      date_to,
    } = req.query;

    const { events } = await fetchEcommerceEvents(project_id, date_from, date_to);

    // Aggregate per product
    const products = {};  // product_id -> { name, views, add_to_cart, purchases, revenue }

    for (const e of events) {
      const name = e.data.name;
      const props = getProps(e);
      const pid = props.id || props.product_id;
      if (!pid) continue;

      if (!products[pid]) {
        products[pid] = {
          product_id: pid,
          name: props.name || props.product_name || pid,
          views: 0,
          add_to_cart_count: 0,
          purchase_count: 0,
          revenue: 0,
        };
      }

      if (name === 'product_view') {
        products[pid].views++;
        // Update name if we have a better one
        if (props.name) products[pid].name = props.name;
      } else if (name === 'add_to_cart') {
        products[pid].add_to_cart_count++;
        if (props.name) products[pid].name = props.name;
      } else if (name === 'purchase') {
        // Purchases may contain multiple items
        const items = props.items || [];
        for (const item of items) {
          const itemId = item.id;
          if (itemId === pid || (!itemId && items.length === 1)) {
            const qty = item.quantity || 1;
            const price = parseFloat(item.price) || 0;
            products[pid].purchase_count += qty;
            products[pid].revenue += price * qty;
          } else if (itemId && itemId !== pid) {
            // This purchase event has a different product — create/update entry
            if (!products[itemId]) {
              products[itemId] = {
                product_id: itemId,
                name: item.name || itemId,
                views: 0,
                add_to_cart_count: 0,
                purchase_count: 0,
                revenue: 0,
              };
            }
            const qty = item.quantity || 1;
            const price = parseFloat(item.price) || 0;
            products[itemId].purchase_count += qty;
            products[itemId].revenue += price * qty;
            if (item.name) products[itemId].name = item.name;
          }
        }
      }
    }

    // Compute conversion rates and sort by revenue
    const productList = Object.values(products).map(p => ({
      ...p,
      revenue: Math.round(p.revenue * 100) / 100,
      conversion_rate: p.views > 0
        ? Math.round((p.purchase_count / p.views) * 1000) / 10
        : 0,
    })).sort((a, b) => b.revenue - a.revenue);

    res.json({ products: productList });
  } catch (err) {
    console.error('[ecommerce] GET /products error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/ecommerce/checkout-funnel
// ============================================================================
router.get('/checkout-funnel', async (req, res) => {
  try {
    const {
      project_id = 'default',
      date_from,
      date_to,
    } = req.query;

    const { events } = await fetchEcommerceEvents(project_id, date_from, date_to);

    // Group events by session
    const sessionEvents = {};
    for (const e of events) {
      if (!sessionEvents[e.session_id]) sessionEvents[e.session_id] = [];
      sessionEvents[e.session_id].push(e);
    }

    // Define funnel steps
    const funnelSteps = ['product_view', 'add_to_cart', 'checkout_start', 'checkout_step', 'purchase'];
    const stepLabels = {
      'product_view': 'Product View',
      'add_to_cart': 'Add to Cart',
      'checkout_start': 'Checkout Start',
      'checkout_step': 'Checkout Step',
      'purchase': 'Purchase',
    };

    const stepReached = {};
    const stepTimestamps = {};  // step -> [durations from previous step]
    const dropOffSessions = {};

    for (const step of funnelSteps) {
      stepReached[step] = 0;
      stepTimestamps[step] = [];
      dropOffSessions[step] = [];
    }

    for (const sid of Object.keys(sessionEvents)) {
      const sEvents = sessionEvents[sid];
      const reached = {};
      const firstTimestamp = {};

      // Sort events by timestamp
      sEvents.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

      for (const e of sEvents) {
        const name = e.data.name;
        if (funnelSteps.includes(name) && !reached[name]) {
          reached[name] = true;
          firstTimestamp[name] = e.timestamp;
        }
      }

      // Count which steps each session reached
      let lastReachedStep = null;
      for (const step of funnelSteps) {
        if (reached[step]) {
          stepReached[step]++;
          lastReachedStep = step;

          // Calculate time from previous step
          const stepIdx = funnelSteps.indexOf(step);
          if (stepIdx > 0) {
            const prevStep = funnelSteps[stepIdx - 1];
            if (firstTimestamp[prevStep] && firstTimestamp[step]) {
              const duration = (firstTimestamp[step] - firstTimestamp[prevStep]) / 1000; // in seconds
              if (duration >= 0) stepTimestamps[step].push(duration);
            }
          }
        }
      }

      // Determine where the session dropped off
      if (lastReachedStep && lastReachedStep !== 'purchase') {
        dropOffSessions[lastReachedStep].push(sid);
      }
    }

    // Build funnel response
    const funnel = funnelSteps.map((step, i) => {
      const count = stepReached[step];
      const prevCount = i === 0 ? count : stepReached[funnelSteps[i - 1]];
      const conversionFromPrev = prevCount > 0 ? Math.round((count / prevCount) * 1000) / 10 : 0;
      const firstStepCount = stepReached[funnelSteps[0]] || 1;
      const conversionFromFirst = Math.round((count / firstStepCount) * 1000) / 10;
      const dropOff = prevCount - count;
      const dropOffRate = prevCount > 0 ? Math.round((dropOff / prevCount) * 1000) / 10 : 0;

      // Average time at this step
      const times = stepTimestamps[step];
      const avgTime = times.length > 0
        ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
        : 0;

      return {
        step,
        label: stepLabels[step] || step,
        count,
        conversion_from_prev: conversionFromPrev,
        conversion_from_first: conversionFromFirst,
        drop_off: dropOff,
        drop_off_rate: dropOffRate,
        avg_time_seconds: avgTime,
        drop_off_sessions: dropOffSessions[step].slice(0, 10),
      };
    });

    res.json({ funnel });
  } catch (err) {
    console.error('[ecommerce] GET /checkout-funnel error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
