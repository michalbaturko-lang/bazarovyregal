'use strict';

const supabase = require('../supabase');

/**
 * Usage enforcement middleware for session recording limits.
 *
 * Checks if the project's tenant has exceeded their session limit.
 * - If exceeded, returns 429 with upgrade_url
 * - Increments sessions_used counter when a new session is created
 * - Resets sessions_used at the start of each billing cycle
 *
 * Usage:
 *   const usageMiddleware = require('./middleware/usage');
 *   app.use('/api/events', usageMiddleware());
 *
 * In self-hosted mode (no STRIPE_SECRET_KEY), always allows requests.
 */
function usageMiddleware() {
  return async function checkUsage(req, res, next) {
    // Only enforce on POST (event ingestion)
    if (req.method !== 'POST') {
      return next();
    }

    // Self-hosted mode: no limits
    if (!process.env.STRIPE_SECRET_KEY) {
      return next();
    }

    try {
      const projectId = (req.body && req.body.projectId) || 'default';
      const events = req.body && req.body.events;
      const isNewSession = Array.isArray(events) && events.some(e => e.type === 0); // SESSION_START = 0

      // Fetch tenant for this project
      const { data: tenant, error } = await supabase
        .from('tenants')
        .select('id, plan_id, sessions_limit, sessions_used, billing_cycle_start, active')
        .eq('id', projectId)
        .single();

      // If no tenant record exists, allow (first-time / default project)
      if (error && error.code === 'PGRST116') {
        return next();
      }
      if (error) {
        console.error('[usage] Tenant lookup error:', error.message);
        return next(); // fail open
      }

      // Check if tenant is active
      if (!tenant.active) {
        return res.status(429).json({
          error: 'Account suspended. Please update your payment method.',
          upgrade_url: '/billing',
        });
      }

      // Check if billing cycle needs reset
      const cycleStart = tenant.billing_cycle_start ? new Date(tenant.billing_cycle_start) : null;
      if (cycleStart) {
        const now = new Date();
        // If the billing cycle start is more than 30 days ago, reset
        const daysSinceCycleStart = (now - cycleStart) / (1000 * 60 * 60 * 24);
        if (daysSinceCycleStart >= 30) {
          await supabase
            .from('tenants')
            .update({
              sessions_used: 0,
              billing_cycle_start: now.toISOString(),
              updated_at: now.toISOString(),
            })
            .eq('id', tenant.id);

          // Reset local state for this request
          tenant.sessions_used = 0;
          tenant.billing_cycle_start = now.toISOString();
        }
      }

      // Unlimited plan (enterprise or sessions_limit = -1)
      if (tenant.sessions_limit < 0) {
        // Still increment for tracking, but never block
        if (isNewSession) {
          await supabase
            .from('tenants')
            .update({
              sessions_used: (tenant.sessions_used || 0) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq('id', tenant.id);
        }
        return next();
      }

      // Check session limit
      const currentUsage = tenant.sessions_used || 0;
      const limit = tenant.sessions_limit || 1000;

      if (isNewSession && currentUsage >= limit) {
        return res.status(429).json({
          error: 'Session limit exceeded',
          upgrade_url: '/billing',
          usage: {
            sessions_used: currentUsage,
            sessions_limit: limit,
          },
        });
      }

      // Increment sessions_used for new sessions
      if (isNewSession) {
        await supabase
          .from('tenants')
          .update({
            sessions_used: currentUsage + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', tenant.id);
      }

      return next();
    } catch (err) {
      console.error('[usage] Middleware error:', err);
      // Fail open - don't block event ingestion on middleware errors
      return next();
    }
  };
}

module.exports = usageMiddleware;
