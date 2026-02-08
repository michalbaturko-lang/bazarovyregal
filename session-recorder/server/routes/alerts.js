'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const supabase = require('../supabase');

// ============================================================================
// Constants
// ============================================================================

const VALID_METRICS = [
  'error_rate',
  'rage_clicks',
  'conversion_rate',
  'session_count',
  'avg_duration',
  'bounce_rate',
  'cart_abandonment_rate',
  'page_load_time',
  'custom_event_count',
];

const VALID_CONDITIONS = ['gt', 'lt', 'gte', 'lte', 'eq', 'change_pct'];
const VALID_WINDOWS = [5, 15, 30, 60, 360, 1440];
const VALID_COOLDOWNS = [15, 30, 60, 360, 1440];
const VALID_CHANNELS = ['dashboard', 'webhook', 'email'];

// ============================================================================
// Helpers
// ============================================================================

/**
 * Compute the actual metric value from sessions/events data within a time
 * window. Returns a numeric value that can be compared against a threshold.
 */
async function computeMetric(rule, projectId) {
  const now = new Date();
  const windowStart = new Date(now.getTime() - rule.window_minutes * 60000).toISOString();
  const windowEnd = now.toISOString();

  // Build session query with optional filters
  function applyFilters(query) {
    if (rule.filters) {
      if (rule.filters.browser) query = query.eq('browser', rule.filters.browser);
      if (rule.filters.device_type) query = query.eq('device_type', rule.filters.device_type);
      if (rule.filters.country) query = query.eq('country', rule.filters.country);
      if (rule.filters.url_pattern) query = query.ilike('url', `%${rule.filters.url_pattern}%`);
    }
    return query;
  }

  switch (rule.metric) {
    case 'session_count': {
      let q = supabase.from('sessions')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .gte('started_at', windowStart)
        .lte('started_at', windowEnd);
      q = applyFilters(q);
      const { count, error } = await q;
      if (error) throw error;
      return count || 0;
    }

    case 'error_rate': {
      let totalQ = supabase.from('sessions')
        .select('id, has_errors')
        .eq('project_id', projectId)
        .gte('started_at', windowStart)
        .lte('started_at', windowEnd);
      totalQ = applyFilters(totalQ);
      const { data: sessions, error } = await totalQ;
      if (error) throw error;
      const rows = sessions || [];
      if (rows.length === 0) return 0;
      const errorCount = rows.filter(s => s.has_errors).length;
      return parseFloat(((errorCount / rows.length) * 100).toFixed(2));
    }

    case 'rage_clicks': {
      let q = supabase.from('sessions')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .eq('has_rage_clicks', true)
        .gte('started_at', windowStart)
        .lte('started_at', windowEnd);
      q = applyFilters(q);
      const { count, error } = await q;
      if (error) throw error;
      return count || 0;
    }

    case 'avg_duration': {
      let q = supabase.from('sessions')
        .select('duration')
        .eq('project_id', projectId)
        .gte('started_at', windowStart)
        .lte('started_at', windowEnd);
      q = applyFilters(q);
      const { data: sessions, error } = await q;
      if (error) throw error;
      const rows = sessions || [];
      if (rows.length === 0) return 0;
      const total = rows.reduce((sum, s) => sum + (s.duration || 0), 0);
      return Math.round(total / rows.length);
    }

    case 'bounce_rate': {
      let q = supabase.from('sessions')
        .select('page_count')
        .eq('project_id', projectId)
        .gte('started_at', windowStart)
        .lte('started_at', windowEnd);
      q = applyFilters(q);
      const { data: sessions, error } = await q;
      if (error) throw error;
      const rows = sessions || [];
      if (rows.length === 0) return 0;
      const bounced = rows.filter(s => (s.page_count || 0) <= 1).length;
      return parseFloat(((bounced / rows.length) * 100).toFixed(2));
    }

    case 'conversion_rate': {
      // Conversion is tracked via ecommerce purchases vs total sessions
      let totalQ = supabase.from('sessions')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .gte('started_at', windowStart)
        .lte('started_at', windowEnd);
      totalQ = applyFilters(totalQ);
      const { count: totalCount, error: totalErr } = await totalQ;
      if (totalErr) throw totalErr;
      if (!totalCount || totalCount === 0) return 0;

      // Count sessions that have a purchase event (type 30 = ecommerce purchase)
      const { data: purchaseSessions, error: purchaseErr } = await supabase.from('events')
        .select('session_id')
        .eq('type', 30)
        .gte('timestamp', new Date(windowStart).getTime());
      if (purchaseErr) throw purchaseErr;
      const uniquePurchaseSessions = new Set((purchaseSessions || []).map(e => e.session_id));
      return parseFloat(((uniquePurchaseSessions.size / totalCount) * 100).toFixed(2));
    }

    case 'cart_abandonment_rate': {
      // Sessions that added to cart but did not purchase
      const { data: cartEvents, error: cartErr } = await supabase.from('events')
        .select('session_id, type')
        .in('type', [28, 30]) // 28 = add_to_cart, 30 = purchase
        .gte('timestamp', new Date(windowStart).getTime());
      if (cartErr) throw cartErr;

      const cartSessions = new Set();
      const purchaseSessions = new Set();
      for (const evt of (cartEvents || [])) {
        if (evt.type === 28) cartSessions.add(evt.session_id);
        if (evt.type === 30) purchaseSessions.add(evt.session_id);
      }
      if (cartSessions.size === 0) return 0;
      const abandoned = [...cartSessions].filter(id => !purchaseSessions.has(id)).length;
      return parseFloat(((abandoned / cartSessions.size) * 100).toFixed(2));
    }

    case 'page_load_time': {
      // Average page load time from performance entries
      const { data: perfEvents, error: perfErr } = await supabase.from('events')
        .select('data')
        .eq('type', 20) // performance entry type
        .gte('timestamp', new Date(windowStart).getTime());
      if (perfErr) throw perfErr;

      const loadTimes = (perfEvents || [])
        .map(e => e.data && e.data.load_time)
        .filter(t => typeof t === 'number' && t > 0);
      if (loadTimes.length === 0) return 0;
      const avg = loadTimes.reduce((sum, t) => sum + t, 0) / loadTimes.length;
      return Math.round(avg);
    }

    case 'custom_event_count': {
      // Count custom events (type 50)
      const { data: customEvents, error: customErr } = await supabase.from('events')
        .select('id', { count: 'exact', head: true })
        .eq('type', 50)
        .gte('timestamp', new Date(windowStart).getTime());
      if (customErr) throw customErr;
      return customEvents || 0;
    }

    default:
      return 0;
  }
}

/**
 * Evaluate whether a condition is met.
 */
function evaluateCondition(condition, value, threshold) {
  switch (condition) {
    case 'gt':  return value > threshold;
    case 'lt':  return value < threshold;
    case 'gte': return value >= threshold;
    case 'lte': return value <= threshold;
    case 'eq':  return value === threshold;
    case 'change_pct': return Math.abs(value) >= threshold;
    default: return false;
  }
}

/**
 * Format a condition for human-readable display.
 */
function formatCondition(condition) {
  const labels = {
    gt: '>',
    lt: '<',
    gte: '>=',
    lte: '<=',
    eq: '=',
    change_pct: 'changed by %',
  };
  return labels[condition] || condition;
}

/**
 * Validate and sanitize an alert rule payload.
 */
function validateRulePayload(body) {
  const errors = [];

  if (!body.name || !body.name.trim()) {
    errors.push('name is required');
  }
  if (!VALID_METRICS.includes(body.metric)) {
    errors.push('Invalid metric. Valid metrics: ' + VALID_METRICS.join(', '));
  }
  if (!VALID_CONDITIONS.includes(body.condition)) {
    errors.push('Invalid condition. Valid conditions: ' + VALID_CONDITIONS.join(', '));
  }
  if (typeof body.threshold !== 'number' || isNaN(body.threshold)) {
    errors.push('threshold must be a number');
  }
  if (!VALID_WINDOWS.includes(body.window_minutes)) {
    errors.push('Invalid window_minutes. Valid values: ' + VALID_WINDOWS.join(', '));
  }
  if (body.cooldown_minutes !== undefined && !VALID_COOLDOWNS.includes(body.cooldown_minutes)) {
    errors.push('Invalid cooldown_minutes. Valid values: ' + VALID_COOLDOWNS.join(', '));
  }
  if (body.notify_channels) {
    const invalid = body.notify_channels.filter(c => !VALID_CHANNELS.includes(c));
    if (invalid.length > 0) {
      errors.push('Invalid notify_channels: ' + invalid.join(', '));
    }
  }
  if (body.webhook_url) {
    try {
      new URL(body.webhook_url);
    } catch (_) {
      errors.push('Invalid webhook_url format');
    }
  }
  if (body.email_to && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email_to)) {
    errors.push('Invalid email_to format');
  }

  return errors;
}

// ============================================================================
// GET /api/alerts/rules — List alert rules for a project
// ============================================================================
router.get('/rules', async (req, res) => {
  try {
    const { project_id = 'default' } = req.query;

    const { data: rules, error } = await supabase.from('alert_rules')
      .select('*')
      .eq('project_id', project_id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    res.json({ rules: rules || [] });
  } catch (err) {
    console.error('[alerts] GET /rules error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /api/alerts/rules — Create a new alert rule
// ============================================================================
router.post('/rules', async (req, res) => {
  try {
    const {
      name,
      description = '',
      metric,
      condition,
      threshold,
      window_minutes = 60,
      cooldown_minutes = 60,
      notify_channels = ['dashboard'],
      webhook_url = null,
      email_to = null,
      enabled = true,
      filters = {},
      project_id = 'default',
    } = req.body;

    const validationErrors = validateRulePayload({
      name, metric, condition, threshold,
      window_minutes, cooldown_minutes,
      notify_channels, webhook_url, email_to,
    });

    if (validationErrors.length > 0) {
      return res.status(400).json({ error: validationErrors.join('; ') });
    }

    // Ensure webhook channel has a URL
    if (notify_channels.includes('webhook') && !webhook_url) {
      return res.status(400).json({ error: 'webhook_url is required when webhook channel is selected' });
    }
    // Ensure email channel has an address
    if (notify_channels.includes('email') && !email_to) {
      return res.status(400).json({ error: 'email_to is required when email channel is selected' });
    }

    const id = uuidv4();

    const { error: insertError } = await supabase.from('alert_rules')
      .insert({
        id,
        project_id,
        name: name.trim(),
        description: (description || '').trim(),
        enabled: enabled !== false,
        metric,
        condition,
        threshold,
        window_minutes,
        cooldown_minutes,
        notify_channels,
        webhook_url: webhook_url || null,
        email_to: email_to || null,
        filters: filters || {},
        last_triggered_at: null,
        muted_until: null,
      });
    if (insertError) throw insertError;

    const { data: rule, error: fetchError } = await supabase.from('alert_rules')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchError) throw fetchError;

    res.status(201).json({ rule });
  } catch (err) {
    console.error('[alerts] POST /rules error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// PUT /api/alerts/rules/:id — Update an alert rule
// ============================================================================
router.put('/rules/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check rule exists
    const { data: existing, error: findError } = await supabase.from('alert_rules')
      .select('id')
      .eq('id', id)
      .single();
    if (findError || !existing) {
      return res.status(404).json({ error: 'Alert rule not found' });
    }

    const updates = { updated_at: new Date().toISOString() };
    const body = req.body;

    // Apply only provided fields
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.description !== undefined) updates.description = (body.description || '').trim();
    if (body.enabled !== undefined) updates.enabled = body.enabled;
    if (body.metric !== undefined) {
      if (!VALID_METRICS.includes(body.metric)) {
        return res.status(400).json({ error: 'Invalid metric' });
      }
      updates.metric = body.metric;
    }
    if (body.condition !== undefined) {
      if (!VALID_CONDITIONS.includes(body.condition)) {
        return res.status(400).json({ error: 'Invalid condition' });
      }
      updates.condition = body.condition;
    }
    if (body.threshold !== undefined) {
      if (typeof body.threshold !== 'number' || isNaN(body.threshold)) {
        return res.status(400).json({ error: 'threshold must be a number' });
      }
      updates.threshold = body.threshold;
    }
    if (body.window_minutes !== undefined) {
      if (!VALID_WINDOWS.includes(body.window_minutes)) {
        return res.status(400).json({ error: 'Invalid window_minutes' });
      }
      updates.window_minutes = body.window_minutes;
    }
    if (body.cooldown_minutes !== undefined) {
      if (!VALID_COOLDOWNS.includes(body.cooldown_minutes)) {
        return res.status(400).json({ error: 'Invalid cooldown_minutes' });
      }
      updates.cooldown_minutes = body.cooldown_minutes;
    }
    if (body.notify_channels !== undefined) {
      const invalid = body.notify_channels.filter(c => !VALID_CHANNELS.includes(c));
      if (invalid.length > 0) {
        return res.status(400).json({ error: 'Invalid notify_channels: ' + invalid.join(', ') });
      }
      updates.notify_channels = body.notify_channels;
    }
    if (body.webhook_url !== undefined) updates.webhook_url = body.webhook_url || null;
    if (body.email_to !== undefined) updates.email_to = body.email_to || null;
    if (body.filters !== undefined) updates.filters = body.filters || {};
    if (body.muted_until !== undefined) updates.muted_until = body.muted_until;

    const { error: updateError } = await supabase.from('alert_rules')
      .update(updates)
      .eq('id', id);
    if (updateError) throw updateError;

    const { data: rule, error: fetchError } = await supabase.from('alert_rules')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchError) throw fetchError;

    res.json({ rule });
  } catch (err) {
    console.error('[alerts] PUT /rules/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// DELETE /api/alerts/rules/:id — Delete an alert rule
// ============================================================================
router.delete('/rules/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existing, error: findError } = await supabase.from('alert_rules')
      .select('id')
      .eq('id', id)
      .single();
    if (findError || !existing) {
      return res.status(404).json({ error: 'Alert rule not found' });
    }

    // Delete associated alert history
    await supabase.from('alert_history')
      .delete()
      .eq('rule_id', id);

    const { error: deleteError } = await supabase.from('alert_rules')
      .delete()
      .eq('id', id);
    if (deleteError) throw deleteError;

    res.json({ success: true, message: 'Alert rule deleted' });
  } catch (err) {
    console.error('[alerts] DELETE /rules/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/alerts/history — List triggered alerts with pagination
// ============================================================================
router.get('/history', async (req, res) => {
  try {
    const {
      project_id = 'default',
      rule_id,
      status,
      page: rawPage = '1',
      limit: rawLimit = '50',
    } = req.query;

    const page = Math.max(1, parseInt(rawPage, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(rawLimit, 10) || 50));
    const offset = (page - 1) * limit;

    let countQuery = supabase.from('alert_history')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', project_id);

    let dataQuery = supabase.from('alert_history')
      .select('*')
      .eq('project_id', project_id);

    if (rule_id) {
      countQuery = countQuery.eq('rule_id', rule_id);
      dataQuery = dataQuery.eq('rule_id', rule_id);
    }
    if (status) {
      countQuery = countQuery.eq('status', status);
      dataQuery = dataQuery.eq('status', status);
    }

    const { count, error: countError } = await countQuery;
    if (countError) throw countError;

    const total = count || 0;
    const pages = Math.ceil(total / limit);

    const { data: history, error: dataError } = await dataQuery
      .order('triggered_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (dataError) throw dataError;

    res.json({
      history: history || [],
      total,
      page,
      pages,
    });
  } catch (err) {
    console.error('[alerts] GET /history error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /api/alerts/rules/:id/test — Test-fire an alert rule
// ============================================================================
router.post('/rules/:id/test', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: rule, error: findError } = await supabase.from('alert_rules')
      .select('*')
      .eq('id', id)
      .single();
    if (findError || !rule) {
      return res.status(404).json({ error: 'Alert rule not found' });
    }

    // Compute the actual metric value
    let metricValue = 0;
    try {
      metricValue = await computeMetric(rule, rule.project_id);
    } catch (metricErr) {
      console.warn('[alerts] Metric computation failed during test:', metricErr.message);
    }

    const fired = evaluateCondition(rule.condition, metricValue, rule.threshold);

    // Record a test entry in alert_history
    const historyId = uuidv4();
    const historyEntry = {
      id: historyId,
      project_id: rule.project_id,
      rule_id: rule.id,
      rule_name: rule.name,
      metric: rule.metric,
      metric_value: metricValue,
      threshold: rule.threshold,
      condition: rule.condition,
      triggered_at: new Date().toISOString(),
      status: 'test',
      notify_channels: rule.notify_channels,
    };

    try {
      await supabase.from('alert_history').insert(historyEntry);
    } catch (_) {
      // Non-critical — don't fail the test response
    }

    // If webhook channel is configured, fire test webhook
    let webhookResult = null;
    if (rule.webhook_url && rule.notify_channels.includes('webhook')) {
      try {
        const payload = {
          alert: 'test',
          rule_name: rule.name,
          metric: rule.metric,
          metric_value: metricValue,
          threshold: rule.threshold,
          condition: formatCondition(rule.condition),
          fired,
          timestamp: new Date().toISOString(),
        };

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(rule.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        webhookResult = {
          status: resp.status,
          success: resp.ok,
        };
      } catch (webhookErr) {
        webhookResult = {
          status: 0,
          success: false,
          error: webhookErr.message,
        };
      }
    }

    res.json({
      fired,
      metric: rule.metric,
      metric_value: metricValue,
      threshold: rule.threshold,
      condition: formatCondition(rule.condition),
      webhook_result: webhookResult,
      history_id: historyId,
    });
  } catch (err) {
    console.error('[alerts] POST /rules/:id/test error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/alerts/summary — Quick summary: active rules, recent triggers, muted
// ============================================================================
router.get('/summary', async (req, res) => {
  try {
    const { project_id = 'default' } = req.query;

    // Fetch all rules for the project
    const { data: rules, error: rulesError } = await supabase.from('alert_rules')
      .select('id, enabled, muted_until')
      .eq('project_id', project_id);
    if (rulesError) throw rulesError;

    const allRules = rules || [];
    const now = new Date();

    const activeRules = allRules.filter(r => r.enabled).length;
    const mutedRules = allRules.filter(r => r.muted_until && new Date(r.muted_until) > now).length;
    const totalRules = allRules.length;

    // Count triggers today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count: triggersToday, error: historyError } = await supabase.from('alert_history')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', project_id)
      .gte('triggered_at', todayStart.toISOString())
      .neq('status', 'test');
    if (historyError) throw historyError;

    // Last 5 recent triggers for quick preview
    const { data: recentTriggers, error: recentError } = await supabase.from('alert_history')
      .select('id, rule_name, metric, metric_value, threshold, triggered_at, status')
      .eq('project_id', project_id)
      .neq('status', 'test')
      .order('triggered_at', { ascending: false })
      .limit(5);
    if (recentError) throw recentError;

    res.json({
      total_rules: totalRules,
      active_rules: activeRules,
      muted_rules: mutedRules,
      triggers_today: triggersToday || 0,
      recent_triggers: recentTriggers || [],
    });
  } catch (err) {
    console.error('[alerts] GET /summary error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /api/alerts/evaluate — Evaluate all active rules for a project
// Called internally or on a cron schedule to check and fire alerts.
// ============================================================================
router.post('/evaluate', async (req, res) => {
  try {
    const { project_id = 'default' } = req.body;

    const { data: rules, error: rulesError } = await supabase.from('alert_rules')
      .select('*')
      .eq('project_id', project_id)
      .eq('enabled', true);
    if (rulesError) throw rulesError;

    const now = new Date();
    const results = [];

    for (const rule of (rules || [])) {
      // Skip muted rules
      if (rule.muted_until && new Date(rule.muted_until) > now) {
        results.push({ rule_id: rule.id, rule_name: rule.name, skipped: true, reason: 'muted' });
        continue;
      }

      // Enforce cooldown — skip if fired too recently
      if (rule.last_triggered_at) {
        const lastFired = new Date(rule.last_triggered_at);
        const cooldownEnd = new Date(lastFired.getTime() + (rule.cooldown_minutes || 60) * 60000);
        if (now < cooldownEnd) {
          results.push({ rule_id: rule.id, rule_name: rule.name, skipped: true, reason: 'cooldown' });
          continue;
        }
      }

      // Compute the metric
      let metricValue;
      try {
        metricValue = await computeMetric(rule, project_id);
      } catch (metricErr) {
        results.push({ rule_id: rule.id, rule_name: rule.name, error: metricErr.message });
        continue;
      }

      const fired = evaluateCondition(rule.condition, metricValue, rule.threshold);

      if (fired) {
        // Record in alert_history
        const historyId = uuidv4();
        await supabase.from('alert_history').insert({
          id: historyId,
          project_id,
          rule_id: rule.id,
          rule_name: rule.name,
          metric: rule.metric,
          metric_value: metricValue,
          threshold: rule.threshold,
          condition: rule.condition,
          triggered_at: now.toISOString(),
          status: 'triggered',
          notify_channels: rule.notify_channels,
        });

        // Update last_triggered_at on the rule
        await supabase.from('alert_rules')
          .update({ last_triggered_at: now.toISOString() })
          .eq('id', rule.id);

        // Fire webhook notification if configured
        if (rule.webhook_url && rule.notify_channels.includes('webhook')) {
          try {
            const payload = {
              alert: 'triggered',
              rule_id: rule.id,
              rule_name: rule.name,
              metric: rule.metric,
              metric_value: metricValue,
              threshold: rule.threshold,
              condition: formatCondition(rule.condition),
              project_id,
              triggered_at: now.toISOString(),
            };
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            await fetch(rule.webhook_url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              signal: controller.signal,
            });
            clearTimeout(timeout);
          } catch (webhookErr) {
            console.warn('[alerts] Webhook delivery failed for rule', rule.id, ':', webhookErr.message);
          }
        }

        results.push({
          rule_id: rule.id,
          rule_name: rule.name,
          fired: true,
          metric_value: metricValue,
          threshold: rule.threshold,
          history_id: historyId,
        });
      } else {
        results.push({
          rule_id: rule.id,
          rule_name: rule.name,
          fired: false,
          metric_value: metricValue,
          threshold: rule.threshold,
        });
      }
    }

    res.json({
      evaluated: results.length,
      triggered: results.filter(r => r.fired).length,
      results,
    });
  } catch (err) {
    console.error('[alerts] POST /evaluate error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
