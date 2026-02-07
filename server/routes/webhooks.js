'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const supabase = require('../supabase');
const dispatcher = require('../webhook-dispatcher');

// ============================================================================
// Valid event types for webhook subscriptions
// ============================================================================
const VALID_EVENT_TYPES = [
  'rage_click',
  'js_error',
  'cart_abandonment',
  'high_bounce',
  'slow_page',
  'new_session',
  'form_abandon',
];

// ============================================================================
// GET /api/webhooks/list — List all configured webhooks for the project
// ============================================================================
router.get('/list', async (req, res) => {
  try {
    const { project_id = 'default' } = req.query;

    const { data: webhooks, error } = await supabase.from('webhooks')
      .select('*')
      .eq('project_id', project_id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    // For each webhook, fetch recent logs summary
    const enriched = [];
    for (const wh of (webhooks || [])) {
      // Get last 10 logs for success rate and last triggered
      const { data: logs, error: logErr } = await supabase.from('webhook_logs')
        .select('success, created_at')
        .eq('webhook_id', wh.id)
        .order('created_at', { ascending: false })
        .limit(20);

      let lastTriggered = null;
      let successRate = null;

      if (!logErr && logs && logs.length > 0) {
        lastTriggered = logs[0].created_at;
        const successCount = logs.filter(l => l.success).length;
        successRate = Math.round((successCount / logs.length) * 100);
      }

      enriched.push({
        ...wh,
        last_triggered: lastTriggered,
        success_rate: successRate,
        delivery_count: logs ? logs.length : 0,
      });
    }

    res.json({ webhooks: enriched });
  } catch (err) {
    console.error('[webhooks] GET /list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /api/webhooks/create — Create a new webhook
// ============================================================================
router.post('/create', async (req, res) => {
  try {
    const {
      name,
      url,
      event_types = [],
      headers = {},
      active = true,
      project_id = 'default',
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (!url || !url.trim()) {
      return res.status(400).json({ error: 'url is required' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (_) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Validate event types
    const validTypes = event_types.filter(t => VALID_EVENT_TYPES.includes(t));
    if (validTypes.length === 0) {
      return res.status(400).json({ error: 'At least one valid event_type is required. Valid types: ' + VALID_EVENT_TYPES.join(', ') });
    }

    const id = uuidv4();

    const { error: insertError } = await supabase.from('webhooks')
      .insert({
        id,
        project_id,
        name: name.trim(),
        url: url.trim(),
        event_types: validTypes,
        headers: headers || {},
        active: active !== false,
      });
    if (insertError) throw insertError;

    const { data: webhook, error: fetchError } = await supabase.from('webhooks')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchError) throw fetchError;

    res.status(201).json({ webhook });
  } catch (err) {
    console.error('[webhooks] POST /create error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// PUT /api/webhooks/:id — Update a webhook
// ============================================================================
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, url, event_types, headers, active } = req.body;

    // Check webhook exists
    const { data: existing, error: findError } = await supabase.from('webhooks')
      .select('id')
      .eq('id', id)
      .single();
    if (findError || !existing) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const updates = { updated_at: new Date().toISOString() };

    if (name !== undefined) updates.name = name.trim();
    if (url !== undefined) {
      try {
        new URL(url);
      } catch (_) {
        return res.status(400).json({ error: 'Invalid URL format' });
      }
      updates.url = url.trim();
    }
    if (event_types !== undefined) {
      const validTypes = event_types.filter(t => VALID_EVENT_TYPES.includes(t));
      if (validTypes.length === 0) {
        return res.status(400).json({ error: 'At least one valid event_type is required' });
      }
      updates.event_types = validTypes;
    }
    if (headers !== undefined) updates.headers = headers;
    if (active !== undefined) updates.active = active;

    const { error: updateError } = await supabase.from('webhooks')
      .update(updates)
      .eq('id', id);
    if (updateError) throw updateError;

    const { data: webhook, error: fetchError } = await supabase.from('webhooks')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchError) throw fetchError;

    res.json({ webhook });
  } catch (err) {
    console.error('[webhooks] PUT /:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// DELETE /api/webhooks/:id — Delete a webhook
// ============================================================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existing, error: findError } = await supabase.from('webhooks')
      .select('id')
      .eq('id', id)
      .single();
    if (findError || !existing) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const { error: deleteError } = await supabase.from('webhooks')
      .delete()
      .eq('id', id);
    if (deleteError) throw deleteError;

    res.json({ success: true, message: 'Webhook deleted' });
  } catch (err) {
    console.error('[webhooks] DELETE /:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /api/webhooks/test/:id — Send a test payload to a webhook
// ============================================================================
router.post('/test/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: webhook, error: findError } = await supabase.from('webhooks')
      .select('*')
      .eq('id', id)
      .single();
    if (findError || !webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    // Build a test payload with the first subscribed event type
    const testEventType = (webhook.event_types && webhook.event_types.length > 0)
      ? webhook.event_types[0]
      : 'js_error';

    const testData = {
      session_id: 'test-session-' + Date.now(),
      message: 'This is a test event from Regal Master Look',
      url: 'https://example.com/test-page',
      selector: 'button.test-element',
      test: true,
    };

    const payload = dispatcher.buildPayload(testEventType, testData, webhook.project_id);
    const result = await dispatcher.deliverToWebhook(webhook, payload);

    // Log the test delivery
    try {
      await supabase.from('webhook_logs').insert({
        webhook_id: webhook.id,
        event_type: testEventType,
        payload: payload,
        response_status: result.responseStatus,
        response_body: result.responseBody,
        success: result.success,
      });
    } catch (_) {
      // Non-critical, don't fail the response
    }

    res.json({
      success: result.success,
      response_status: result.responseStatus,
      response_body: result.responseBody,
      payload_sent: payload,
    });
  } catch (err) {
    console.error('[webhooks] POST /test/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /api/webhooks/slack/setup — Quick Slack incoming webhook setup
// ============================================================================
router.post('/slack/setup', async (req, res) => {
  try {
    const {
      webhook_url,
      channel = '#general',
      events = ['js_error', 'rage_click'],
      project_id = 'default',
    } = req.body;

    if (!webhook_url || !webhook_url.trim()) {
      return res.status(400).json({ error: 'webhook_url is required' });
    }

    // Validate it looks like a Slack webhook URL
    if (!webhook_url.includes('hooks.slack.com')) {
      return res.status(400).json({ error: 'URL does not appear to be a Slack incoming webhook. Expected hooks.slack.com domain.' });
    }

    // Validate event types
    const validTypes = events.filter(t => VALID_EVENT_TYPES.includes(t));
    if (validTypes.length === 0) {
      return res.status(400).json({ error: 'At least one valid event type is required' });
    }

    // Check if a Slack webhook already exists for this project
    const { data: existingSlack } = await supabase.from('webhooks')
      .select('id')
      .eq('project_id', project_id)
      .like('url', '%hooks.slack.com%')
      .limit(1);

    let webhookId;

    if (existingSlack && existingSlack.length > 0) {
      // Update existing Slack webhook
      webhookId = existingSlack[0].id;
      const { error: updateError } = await supabase.from('webhooks')
        .update({
          url: webhook_url.trim(),
          name: `Slack ${channel}`,
          event_types: validTypes,
          active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', webhookId);
      if (updateError) throw updateError;
    } else {
      // Create new Slack webhook
      webhookId = uuidv4();
      const { error: insertError } = await supabase.from('webhooks')
        .insert({
          id: webhookId,
          project_id,
          name: `Slack ${channel}`,
          url: webhook_url.trim(),
          event_types: validTypes,
          headers: {},
          active: true,
        });
      if (insertError) throw insertError;
    }

    const { data: webhook, error: fetchError } = await supabase.from('webhooks')
      .select('*')
      .eq('id', webhookId)
      .single();
    if (fetchError) throw fetchError;

    res.json({ success: true, webhook });
  } catch (err) {
    console.error('[webhooks] POST /slack/setup error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/webhooks/slack/config — Get current Slack webhook config
// ============================================================================
router.get('/slack/config', async (req, res) => {
  try {
    const { project_id = 'default' } = req.query;

    const { data: slackWebhooks, error } = await supabase.from('webhooks')
      .select('*')
      .eq('project_id', project_id)
      .like('url', '%hooks.slack.com%')
      .limit(1);
    if (error) throw error;

    if (!slackWebhooks || slackWebhooks.length === 0) {
      return res.json({ configured: false, webhook: null });
    }

    const webhook = slackWebhooks[0];
    res.json({
      configured: true,
      webhook: {
        id: webhook.id,
        name: webhook.name,
        channel: webhook.name.replace('Slack ', '') || '#general',
        event_types: webhook.event_types,
        active: webhook.active,
        created_at: webhook.created_at,
        updated_at: webhook.updated_at,
      },
    });
  } catch (err) {
    console.error('[webhooks] GET /slack/config error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /api/webhooks/notify — Internal endpoint to trigger notifications
// Called by the event ingestion pipeline or other internal processes.
// ============================================================================
router.post('/notify', async (req, res) => {
  try {
    const { event_type, data = {}, project_id = 'default' } = req.body;

    if (!event_type) {
      return res.status(400).json({ error: 'event_type is required' });
    }

    if (!VALID_EVENT_TYPES.includes(event_type)) {
      return res.status(400).json({ error: 'Invalid event_type. Valid types: ' + VALID_EVENT_TYPES.join(', ') });
    }

    // Fire and forget — dispatch asynchronously
    dispatcher.dispatch(event_type, data, project_id).catch(err => {
      console.error('[webhooks] Notify dispatch error:', err.message);
    });

    res.json({ success: true, message: `Notification dispatched for event: ${event_type}` });
  } catch (err) {
    console.error('[webhooks] POST /notify error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/webhooks/logs/:webhookId — Get delivery logs for a specific webhook
// ============================================================================
router.get('/logs/:webhookId', async (req, res) => {
  try {
    const { webhookId } = req.params;
    const { limit: rawLimit = '50' } = req.query;
    const limit = Math.min(200, Math.max(1, parseInt(rawLimit, 10) || 50));

    const { data: logs, error } = await supabase.from('webhook_logs')
      .select('*')
      .eq('webhook_id', webhookId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;

    res.json({ logs: logs || [] });
  } catch (err) {
    console.error('[webhooks] GET /logs/:webhookId error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
