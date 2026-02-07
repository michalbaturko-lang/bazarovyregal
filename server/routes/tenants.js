'use strict';

const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// ============================================================================
// GET /api/tenants/list - List all tenants/organizations (admin only)
// ============================================================================
router.get('/list', async (req, res) => {
  try {
    const {
      page: rawPage = '1',
      limit: rawLimit = '50',
      search,
      plan_id,
      active,
    } = req.query;

    const page = Math.max(1, parseInt(rawPage, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(rawLimit, 10) || 50));
    const offset = (page - 1) * limit;

    let query = supabase.from('tenants').select('*', { count: 'exact' });

    if (search) {
      query = query.or(`name.ilike.%${search}%,domain.ilike.%${search}%,owner_email.ilike.%${search}%`);
    }
    if (plan_id) {
      query = query.eq('plan_id', plan_id);
    }
    if (active !== undefined) {
      query = query.eq('active', active === 'true');
    }

    query = query.order('created_at', { ascending: false });

    const { data: tenants, error, count } = await query.range(offset, offset + limit - 1);
    if (error) throw error;

    const pages = Math.ceil((count || 0) / limit);

    res.json({
      tenants: tenants || [],
      total: count || 0,
      page,
      pages,
    });
  } catch (err) {
    console.error('[tenants] GET /list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /api/tenants/create - Create new tenant
// ============================================================================
router.post('/create', async (req, res) => {
  try {
    const { name, domain, owner_email } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Tenant name is required.' });
    }

    const tenantData = {
      name: name.trim(),
      domain: domain ? domain.trim() : null,
      owner_email: owner_email ? owner_email.trim() : null,
      plan_id: 'free',
      sessions_limit: 1000,
      sessions_used: 0,
      branding: JSON.stringify({
        primary_color: '#3b82f6',
        company_name: name.trim(),
      }),
      active: true,
    };

    const { data: tenant, error } = await supabase
      .from('tenants')
      .insert(tenantData)
      .select('*')
      .single();

    if (error) throw error;

    // Also create a corresponding project for this tenant
    const { error: projError } = await supabase
      .from('projects')
      .insert({
        id: tenant.id,
        name: tenant.name,
        domain: tenant.domain,
      });

    if (projError && projError.code !== '23505') {
      // 23505 = unique_violation, ignore if project already exists
      console.warn('[tenants] Could not create project for tenant:', projError.message);
    }

    res.status(201).json(tenant);
  } catch (err) {
    console.error('[tenants] POST /create error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/tenants/:id - Get tenant details
// ============================================================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Tenant not found.' });
      }
      throw error;
    }

    res.json(tenant);
  } catch (err) {
    console.error('[tenants] GET /:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// PUT /api/tenants/:id - Update tenant
// ============================================================================
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, domain, owner_email, branding } = req.body;

    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name.trim();
    if (domain !== undefined) updates.domain = domain ? domain.trim() : null;
    if (owner_email !== undefined) updates.owner_email = owner_email ? owner_email.trim() : null;
    if (branding !== undefined) updates.branding = typeof branding === 'string' ? branding : JSON.stringify(branding);

    const { data: tenant, error } = await supabase
      .from('tenants')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Tenant not found.' });
      }
      throw error;
    }

    res.json(tenant);
  } catch (err) {
    console.error('[tenants] PUT /:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/tenants/:id/usage - Tenant usage stats
// ============================================================================
router.get('/:id/usage', async (req, res) => {
  try {
    const { id } = req.params;

    // Get tenant
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', id)
      .single();

    if (tenantErr) {
      if (tenantErr.code === 'PGRST116') {
        return res.status(404).json({ error: 'Tenant not found.' });
      }
      throw tenantErr;
    }

    // Count sessions this billing cycle
    const cycleStart = tenant.billing_cycle_start || new Date(new Date().setDate(1)).toISOString();

    const { count: sessionCount, error: countErr } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', id)
      .gte('started_at', cycleStart);

    if (countErr) throw countErr;

    // Count total events this cycle
    const { count: eventCount, error: eventErr } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', cycleStart);

    // Get unique visitors this cycle
    const { data: visitorData, error: visitorErr } = await supabase
      .from('sessions')
      .select('visitor_id')
      .eq('project_id', id)
      .gte('started_at', cycleStart);

    const uniqueVisitors = visitorData
      ? new Set(visitorData.map(v => v.visitor_id).filter(Boolean)).size
      : 0;

    const sessionsUsed = tenant.sessions_used || 0;
    const sessionsLimit = tenant.sessions_limit || 1000;
    const percentage = sessionsLimit > 0 ? Math.min(100, Math.round((sessionsUsed / sessionsLimit) * 100)) : 0;

    res.json({
      tenant_id: id,
      plan_id: tenant.plan_id,
      sessions_used: sessionsUsed,
      sessions_limit: sessionsLimit,
      percentage,
      sessions_actual: sessionCount || 0,
      events_count: eventCount || 0,
      unique_visitors: uniqueVisitors,
      billing_cycle_start: cycleStart,
      active: tenant.active,
    });
  } catch (err) {
    console.error('[tenants] GET /:id/usage error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /api/tenants/:id/branding - Set custom branding (white-label)
// ============================================================================
router.post('/:id/branding', async (req, res) => {
  try {
    const { id } = req.params;
    const { logo_url, primary_color, company_name } = req.body;

    // Fetch current branding to merge
    const { data: tenant, error: fetchErr } = await supabase
      .from('tenants')
      .select('branding')
      .eq('id', id)
      .single();

    if (fetchErr) {
      if (fetchErr.code === 'PGRST116') {
        return res.status(404).json({ error: 'Tenant not found.' });
      }
      throw fetchErr;
    }

    let currentBranding = {};
    try {
      currentBranding = typeof tenant.branding === 'string'
        ? JSON.parse(tenant.branding)
        : (tenant.branding || {});
    } catch (_) {
      currentBranding = {};
    }

    // Merge new branding fields
    const newBranding = { ...currentBranding };
    if (logo_url !== undefined) newBranding.logo_url = logo_url;
    if (primary_color !== undefined) newBranding.primary_color = primary_color;
    if (company_name !== undefined) newBranding.company_name = company_name;

    const { data: updated, error: updateErr } = await supabase
      .from('tenants')
      .update({
        branding: JSON.stringify(newBranding),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (updateErr) throw updateErr;

    res.json({
      tenant_id: updated.id,
      branding: newBranding,
    });
  } catch (err) {
    console.error('[tenants] POST /:id/branding error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
