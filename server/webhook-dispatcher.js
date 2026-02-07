'use strict';

const supabase = require('./supabase');

// ============================================================================
// Webhook Dispatcher
// Queries active webhooks, delivers payloads, logs results.
// ============================================================================

const TIMEOUT_MS = 5000;
const RETRY_DELAY_MS = 3000;
const DASHBOARD_BASE = 'https://regal-master-look.vercel.app';

// ============================================================================
// Event metadata for Slack formatting
// ============================================================================
const EVENT_META = {
  rage_click:       { color: '#e74c3c', emoji: ':rage:', label: 'Rage Click Detected' },
  js_error:         { color: '#e74c3c', emoji: ':x:', label: 'JavaScript Error' },
  cart_abandonment: { color: '#f39c12', emoji: ':shopping_trolley:', label: 'Cart Abandonment' },
  high_bounce:      { color: '#f39c12', emoji: ':chart_with_downwards_trend:', label: 'High Bounce Rate' },
  slow_page:        { color: '#f39c12', emoji: ':snail:', label: 'Slow Page Load' },
  new_session:      { color: '#3498db', emoji: ':new:', label: 'New Session Started' },
  form_abandon:     { color: '#f39c12', emoji: ':memo:', label: 'Form Abandoned' },
};

// ============================================================================
// Build the standard webhook payload
// ============================================================================
function buildPayload(eventType, data, projectId) {
  const sessionId = data.session_id || data.sessionId || null;
  return {
    event: eventType,
    timestamp: new Date().toISOString(),
    project_id: projectId || 'default',
    session_id: sessionId,
    data: data,
    dashboard_url: sessionId
      ? `${DASHBOARD_BASE}/#sessions/${sessionId}`
      : `${DASHBOARD_BASE}/#dashboard`,
  };
}

// ============================================================================
// Build a Slack Block Kit message from the payload
// ============================================================================
function buildSlackMessage(payload) {
  const meta = EVENT_META[payload.event] || { color: '#3498db', emoji: ':bell:', label: payload.event };
  const sessionId = payload.session_id || 'N/A';
  const truncatedSession = sessionId.length > 12 ? sessionId.slice(0, 12) + '...' : sessionId;

  // Build detail fields from event data
  const fields = [];
  if (payload.data) {
    const d = payload.data;
    if (d.message)    fields.push({ type: 'mrkdwn', text: `*Error:*\n\`${truncateStr(d.message, 120)}\`` });
    if (d.url)        fields.push({ type: 'mrkdwn', text: `*Page:*\n${truncateStr(d.url, 100)}` });
    if (d.selector)   fields.push({ type: 'mrkdwn', text: `*Element:*\n\`${truncateStr(d.selector, 80)}\`` });
    if (d.click_count) fields.push({ type: 'mrkdwn', text: `*Clicks:*\n${d.click_count}` });
    if (d.load_time)  fields.push({ type: 'mrkdwn', text: `*Load Time:*\n${d.load_time}ms` });
    if (d.cart_value) fields.push({ type: 'mrkdwn', text: `*Cart Value:*\n$${d.cart_value}` });
  }

  // Ensure even number of fields for Slack layout (max 10)
  const slackFields = fields.slice(0, 10);

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${meta.emoji} *${meta.label}*\nSession: \`${truncatedSession}\` | Project: \`${payload.project_id}\``,
      },
    },
  ];

  if (slackFields.length > 0) {
    blocks.push({
      type: 'section',
      fields: slackFields,
    });
  }

  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: 'View Session', emoji: true },
        url: payload.dashboard_url,
        style: 'primary',
      },
    ],
  });

  blocks.push({
    type: 'context',
    elements: [
      { type: 'mrkdwn', text: `Regal Master Look | ${new Date(payload.timestamp).toLocaleString()}` },
    ],
  });

  return {
    attachments: [
      {
        color: meta.color,
        blocks: blocks,
      },
    ],
  };
}

// ============================================================================
// Helper: truncate string
// ============================================================================
function truncateStr(str, max) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '...' : str;
}

// ============================================================================
// Deliver payload to a single webhook URL
// ============================================================================
async function deliverToWebhook(webhook, payload) {
  const isSlack = webhook.url.includes('hooks.slack.com');
  const body = isSlack ? buildSlackMessage(payload) : payload;

  // Merge custom headers
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'RegalMasterLook-Webhook/1.0',
    ...(webhook.headers || {}),
  };

  let responseStatus = null;
  let responseBody = '';
  let success = false;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const res = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      responseStatus = res.status;
      try {
        responseBody = await res.text();
      } catch (_) {
        responseBody = '';
      }
      // Truncate stored response body
      if (responseBody.length > 2000) {
        responseBody = responseBody.slice(0, 2000);
      }

      success = res.ok;
      if (success) break; // No retry needed on success
    } catch (err) {
      responseStatus = 0;
      responseBody = err.message || 'Request failed';
      success = false;
    }

    // If first attempt failed and there is a second attempt, wait before retry
    if (attempt === 0 && !success) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  return { responseStatus, responseBody, success };
}

// ============================================================================
// Log webhook delivery result
// ============================================================================
async function logDelivery(webhookId, eventType, payload, result) {
  try {
    await supabase.from('webhook_logs').insert({
      webhook_id: webhookId,
      event_type: eventType,
      payload: payload,
      response_status: result.responseStatus,
      response_body: result.responseBody,
      success: result.success,
    });
  } catch (err) {
    console.error('[webhook-dispatcher] Failed to log delivery:', err.message);
  }
}

// ============================================================================
// Main dispatch function
// Exported for use by event ingestion and the notify endpoint.
// ============================================================================
async function dispatch(eventType, data, projectId) {
  projectId = projectId || 'default';

  try {
    // Fetch active webhooks that subscribe to this event type
    const { data: webhooks, error } = await supabase.from('webhooks')
      .select('*')
      .eq('project_id', projectId)
      .eq('active', true)
      .contains('event_types', [eventType]);

    if (error) {
      console.error('[webhook-dispatcher] Error fetching webhooks:', error.message);
      return;
    }

    if (!webhooks || webhooks.length === 0) return;

    const payload = buildPayload(eventType, data, projectId);

    // Deliver to all matching webhooks in parallel
    const deliveries = webhooks.map(async (webhook) => {
      const result = await deliverToWebhook(webhook, payload);
      await logDelivery(webhook.id, eventType, payload, result);
      return { webhookId: webhook.id, ...result };
    });

    await Promise.allSettled(deliveries);
  } catch (err) {
    console.error('[webhook-dispatcher] Dispatch error:', err.message);
  }
}

// ============================================================================
// Exports
// ============================================================================
module.exports = {
  dispatch,
  buildPayload,
  buildSlackMessage,
  deliverToWebhook,
};
