'use strict';

const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// ============================================================================
// Plan definitions
// ============================================================================
const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    currency: 'EUR',
    sessions_limit: 1000,
    features: ['Session recording', 'Basic analytics'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 29,
    currency: 'EUR',
    sessions_limit: 10000,
    features: ['All Free features', 'Heatmaps', 'Funnels', 'Error tracking', 'Email reports'],
  },
  {
    id: 'business',
    name: 'Business',
    price: 79,
    currency: 'EUR',
    sessions_limit: 50000,
    features: [
      'All Pro features',
      'AI Insights',
      'E-commerce analytics',
      'API access',
      'Webhooks',
      'Priority support',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: -1,
    currency: 'EUR',
    sessions_limit: -1,
    features: ['Everything', 'White-label', 'Custom domain', 'Dedicated support', 'SLA'],
  },
];

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// Map plan IDs to Stripe Price IDs (configured via env vars)
const STRIPE_PRICE_MAP = {
  pro: process.env.STRIPE_PRICE_PRO || '',
  business: process.env.STRIPE_PRICE_BUSINESS || '',
};

// ============================================================================
// Helpers
// ============================================================================

function isStripeConfigured() {
  return STRIPE_SECRET_KEY.length > 0;
}

/**
 * Call the Stripe API using fetch() with Basic auth.
 * @param {string} endpoint - e.g. '/v1/checkout/sessions'
 * @param {object} body - form-encoded body fields
 * @returns {Promise<object>}
 */
async function stripeRequest(endpoint, body = {}) {
  const url = `https://api.stripe.com${endpoint}`;
  const auth = Buffer.from(`${STRIPE_SECRET_KEY}:`).toString('base64');

  // Convert nested objects to Stripe's bracket notation for form encoding
  const formParts = [];
  function encodeField(prefix, value) {
    if (value === null || value === undefined) return;
    if (typeof value === 'object' && !Array.isArray(value)) {
      for (const key of Object.keys(value)) {
        encodeField(`${prefix}[${key}]`, value[key]);
      }
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (typeof item === 'object') {
          encodeField(`${prefix}[${i}]`, item);
        } else {
          formParts.push(`${encodeURIComponent(`${prefix}[${i}]`)}=${encodeURIComponent(item)}`);
        }
      });
    } else {
      formParts.push(`${encodeURIComponent(prefix)}=${encodeURIComponent(value)}`);
    }
  }

  for (const key of Object.keys(body)) {
    encodeField(key, body[key]);
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formParts.join('&'),
  });

  const data = await res.json();
  if (!res.ok) {
    const errMsg = data.error ? data.error.message : `Stripe API error ${res.status}`;
    throw new Error(errMsg);
  }
  return data;
}

/**
 * Get or create the tenant row for a given project.
 * Returns the tenant object.
 */
async function getTenantForProject(projectId) {
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', projectId)
    .single();

  if (error && error.code === 'PGRST116') {
    // Not found -- create a default tenant row
    const { data: newTenant, error: insertErr } = await supabase
      .from('tenants')
      .insert({
        id: projectId,
        name: 'Default Tenant',
        plan_id: 'free',
        sessions_limit: 1000,
        sessions_used: 0,
      })
      .select('*')
      .single();
    if (insertErr) throw insertErr;
    return newTenant;
  }
  if (error) throw error;
  return tenant;
}

// ============================================================================
// GET /api/billing/plans - List available plans
// ============================================================================
router.get('/plans', (req, res) => {
  res.json(PLANS);
});

// ============================================================================
// GET /api/billing/current - Get current project's plan + usage
// ============================================================================
router.get('/current', async (req, res) => {
  try {
    const projectId = req.query.project_id || 'default';

    if (!isStripeConfigured()) {
      return res.json({
        mode: 'self-hosted',
        plan: {
          id: 'enterprise',
          name: 'Self-Hosted',
          price: 0,
          sessions_limit: -1,
          features: PLANS.find(p => p.id === 'enterprise').features,
        },
        usage: { sessions_used: 0, sessions_limit: -1 },
        stripe_configured: false,
      });
    }

    const tenant = await getTenantForProject(projectId);
    const plan = PLANS.find(p => p.id === tenant.plan_id) || PLANS[0];

    res.json({
      mode: 'cloud',
      plan: {
        id: plan.id,
        name: plan.name,
        price: plan.price,
        currency: plan.currency,
        sessions_limit: tenant.sessions_limit,
        features: plan.features,
      },
      usage: {
        sessions_used: tenant.sessions_used || 0,
        sessions_limit: tenant.sessions_limit,
        billing_cycle_start: tenant.billing_cycle_start,
      },
      stripe_customer_id: tenant.stripe_customer_id || null,
      stripe_subscription_id: tenant.stripe_subscription_id || null,
      stripe_configured: true,
    });
  } catch (err) {
    console.error('[billing] GET /current error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /api/billing/checkout - Create Stripe Checkout session
// ============================================================================
router.post('/checkout', async (req, res) => {
  try {
    if (!isStripeConfigured()) {
      return res.status(400).json({ error: 'Stripe is not configured. Running in self-hosted mode.' });
    }

    const { plan_id } = req.body;
    const projectId = req.body.project_id || req.query.project_id || 'default';

    if (!plan_id || !STRIPE_PRICE_MAP[plan_id]) {
      return res.status(400).json({ error: 'Invalid plan_id. Use "pro" or "business".' });
    }

    const stripePriceId = STRIPE_PRICE_MAP[plan_id];
    if (!stripePriceId) {
      return res.status(400).json({ error: `Stripe price not configured for plan "${plan_id}".` });
    }

    const tenant = await getTenantForProject(projectId);

    const checkoutParams = {
      mode: 'subscription',
      'line_items[0][price]': stripePriceId,
      'line_items[0][quantity]': '1',
      success_url: `${APP_URL}/#billing?checkout=success`,
      cancel_url: `${APP_URL}/#billing?checkout=cancelled`,
      'metadata[project_id]': projectId,
      'metadata[plan_id]': plan_id,
    };

    // Attach existing Stripe customer if available
    if (tenant.stripe_customer_id) {
      checkoutParams.customer = tenant.stripe_customer_id;
    } else {
      checkoutParams.customer_creation = 'always';
      if (tenant.owner_email) {
        checkoutParams.customer_email = tenant.owner_email;
      }
    }

    const session = await stripeRequest('/v1/checkout/sessions', checkoutParams);

    res.json({ checkout_url: session.url });
  } catch (err) {
    console.error('[billing] POST /checkout error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /api/billing/webhook - Stripe webhook endpoint (no auth)
// ============================================================================
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // In production you should verify the Stripe signature.
    // For simplicity we parse the body directly. The raw body middleware is
    // applied above; Express may have already parsed it as JSON from the
    // global middleware, so handle both cases.
    let event;
    if (typeof req.body === 'string') {
      event = JSON.parse(req.body);
    } else if (Buffer.isBuffer(req.body)) {
      event = JSON.parse(req.body.toString('utf-8'));
    } else {
      event = req.body;
    }

    const eventType = event.type;
    const data = event.data && event.data.object ? event.data.object : {};

    switch (eventType) {
      // -----------------------------------------------------------------
      // checkout.session.completed
      // -----------------------------------------------------------------
      case 'checkout.session.completed': {
        const projectId = data.metadata && data.metadata.project_id ? data.metadata.project_id : null;
        const planId = data.metadata && data.metadata.plan_id ? data.metadata.plan_id : null;
        const customerId = data.customer || null;
        const subscriptionId = data.subscription || null;

        if (projectId && planId) {
          const plan = PLANS.find(p => p.id === planId);
          const sessionsLimit = plan ? plan.sessions_limit : 1000;

          await supabase
            .from('tenants')
            .upsert({
              id: projectId,
              plan_id: planId,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              sessions_limit: sessionsLimit,
              sessions_used: 0,
              billing_cycle_start: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }, { onConflict: 'id' });
        }
        break;
      }

      // -----------------------------------------------------------------
      // customer.subscription.updated
      // -----------------------------------------------------------------
      case 'customer.subscription.updated': {
        const customerId = data.customer || null;
        if (customerId) {
          const status = data.status; // 'active', 'past_due', 'canceled', etc.
          const isActive = status === 'active' || status === 'trialing';

          const { data: tenants } = await supabase
            .from('tenants')
            .select('id')
            .eq('stripe_customer_id', customerId);

          if (tenants && tenants.length > 0) {
            for (const t of tenants) {
              await supabase
                .from('tenants')
                .update({
                  active: isActive,
                  stripe_subscription_id: data.id,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', t.id);
            }
          }
        }
        break;
      }

      // -----------------------------------------------------------------
      // customer.subscription.deleted
      // -----------------------------------------------------------------
      case 'customer.subscription.deleted': {
        const customerId = data.customer || null;
        if (customerId) {
          const { data: tenants } = await supabase
            .from('tenants')
            .select('id')
            .eq('stripe_customer_id', customerId);

          if (tenants && tenants.length > 0) {
            for (const t of tenants) {
              await supabase
                .from('tenants')
                .update({
                  plan_id: 'free',
                  sessions_limit: 1000,
                  stripe_subscription_id: null,
                  active: true,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', t.id);
            }
          }
        }
        break;
      }

      // -----------------------------------------------------------------
      // invoice.payment_failed
      // -----------------------------------------------------------------
      case 'invoice.payment_failed': {
        const customerId = data.customer || null;
        if (customerId) {
          const { data: tenants } = await supabase
            .from('tenants')
            .select('id')
            .eq('stripe_customer_id', customerId);

          if (tenants && tenants.length > 0) {
            for (const t of tenants) {
              await supabase
                .from('tenants')
                .update({
                  active: false,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', t.id);
            }
          }
        }
        break;
      }

      default:
        // Unhandled event type - ignore
        break;
    }

    res.json({ received: true });
  } catch (err) {
    console.error('[billing] POST /webhook error:', err);
    res.status(400).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/billing/portal - Create Stripe Customer Portal session
// ============================================================================
router.get('/portal', async (req, res) => {
  try {
    if (!isStripeConfigured()) {
      return res.status(400).json({ error: 'Stripe is not configured. Running in self-hosted mode.' });
    }

    const projectId = req.query.project_id || 'default';
    const tenant = await getTenantForProject(projectId);

    if (!tenant.stripe_customer_id) {
      return res.status(400).json({ error: 'No Stripe customer found. Please subscribe to a plan first.' });
    }

    const portalSession = await stripeRequest('/v1/billing_portal/sessions', {
      customer: tenant.stripe_customer_id,
      return_url: `${APP_URL}/#billing`,
    });

    res.json({ portal_url: portalSession.url });
  } catch (err) {
    console.error('[billing] GET /portal error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/billing/usage - Current month usage
// ============================================================================
router.get('/usage', async (req, res) => {
  try {
    const projectId = req.query.project_id || 'default';

    if (!isStripeConfigured()) {
      // Self-hosted: count sessions this month, no limit
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count, error } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .gte('started_at', startOfMonth.toISOString());

      if (error) throw error;

      return res.json({
        mode: 'self-hosted',
        sessions_used: count || 0,
        sessions_limit: -1,
        percentage: 0,
        billing_cycle_start: startOfMonth.toISOString(),
      });
    }

    const tenant = await getTenantForProject(projectId);
    const used = tenant.sessions_used || 0;
    const limit = tenant.sessions_limit || 1000;
    const percentage = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

    res.json({
      mode: 'cloud',
      sessions_used: used,
      sessions_limit: limit,
      percentage,
      billing_cycle_start: tenant.billing_cycle_start,
    });
  } catch (err) {
    console.error('[billing] GET /usage error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
