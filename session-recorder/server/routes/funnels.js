'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const supabase = require('../supabase');

// ============================================================================
// Auto-create funnels table if it doesn't exist
// ============================================================================
let tableChecked = false;
async function ensureFunnelsTable() {
  if (tableChecked) return;
  try {
    // Try a simple query — if it fails, create the table via RPC
    const { error } = await supabase.from('funnels').select('id').limit(1);
    if (error && error.message.includes('does not exist')) {
      // Create table via raw SQL (requires Supabase service role)
      const { error: createErr } = await supabase.rpc('exec_sql', {
        sql: `CREATE TABLE IF NOT EXISTS funnels (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id TEXT NOT NULL,
          name TEXT NOT NULL,
          steps JSONB NOT NULL DEFAULT '[]',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )`
      });
      if (createErr) {
        console.warn('[funnels] Could not auto-create table:', createErr.message);
      }
    }
  } catch (_) { /* ignore */ }
  tableChecked = true;
}

// E-commerce funnel step templates for Upgates shops
const ECOMMERCE_STEPS = [
  { type: 'url', value: '/', name: 'Website Visit' },
  { type: 'event', value: 'add_to_cart', name: 'Add to Cart Click' },
  { type: 'url', value: '/cart', name: 'Cart Page' },
  { type: 'url', value: '/shipment', name: 'Shipping & Payment' },
  { type: 'url', value: '/checkout', name: 'Checkout' },
  { type: 'url', value: '/Order-received', name: 'Order Complete' },
];

// ============================================================================
// POST /api/funnels/seed-ecommerce — Auto-create e-commerce funnel for a project
// ============================================================================
router.post('/seed-ecommerce', async (req, res) => {
  try {
    await ensureFunnelsTable();
    const { project_id } = req.body;
    if (!project_id) return res.status(400).json({ error: 'project_id required' });

    // Check if already exists
    const { data: existing } = await supabase.from('funnels')
      .select('id')
      .eq('project_id', project_id)
      .ilike('name', '%commerce%')
      .limit(1);

    if (existing && existing.length > 0) {
      return res.json({ funnel: existing[0], message: 'E-commerce funnel already exists' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    const { error: insertError } = await supabase.from('funnels')
      .insert({
        id,
        project_id,
        name: 'E-commerce Conversion Funnel',
        steps: ECOMMERCE_STEPS,
        created_at: now,
        updated_at: now,
      });

    if (insertError) throw insertError;
    const { data: funnel } = await supabase.from('funnels').select('*').eq('id', id).single();
    res.status(201).json({ funnel });
  } catch (err) {
    console.error('[funnels] seed-ecommerce error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /api/funnels — Create a funnel definition
// ============================================================================
router.post('/', async (req, res) => {
  try {
    const { name, projectId = 'default', steps } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (!Array.isArray(steps) || steps.length === 0) {
      return res.status(400).json({ error: 'steps must be a non-empty array' });
    }

    // Validate each step
    for (const step of steps) {
      if (!step.type || !['url', 'event'].includes(step.type)) {
        return res.status(400).json({ error: 'Each step must have type "url" or "event"' });
      }
      if (!step.value) {
        return res.status(400).json({ error: 'Each step must have a value' });
      }
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    const { error: insertError } = await supabase.from('funnels')
      .insert({
        id,
        project_id: projectId,
        name: name.trim(),
        steps,           // JSONB — pass as object directly
        created_at: now,
        updated_at: now,
      });
    if (insertError) throw insertError;

    const { data: funnel, error: fetchError } = await supabase.from('funnels')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchError) throw fetchError;

    // steps is already parsed from JSONB
    res.status(201).json({ funnel });
  } catch (err) {
    console.error('[funnels] POST / error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/funnels — List funnels for a project
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const { project_id = 'default' } = req.query;

    const { data: funnels, error } = await supabase.from('funnels')
      .select('*')
      .eq('project_id', project_id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    // steps is already parsed from JSONB
    res.json({ funnels: funnels || [] });
  } catch (err) {
    console.error('[funnels] GET / error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/funnels/:id — Get funnel with calculated results
// ============================================================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { date_from, date_to } = req.query;

    // Fetch the funnel definition
    const { data: funnel, error: funnelError } = await supabase.from('funnels')
      .select('*')
      .eq('id', id)
      .single();

    if (funnelError || !funnel) {
      return res.status(404).json({ error: 'Funnel not found' });
    }

    const steps = funnel.steps; // already parsed from JSONB

    // Fetch qualifying session IDs
    let sessionQuery = supabase.from('sessions')
      .select('id')
      .eq('project_id', funnel.project_id);

    if (date_from) sessionQuery = sessionQuery.gte('started_at', date_from);
    if (date_to)   sessionQuery = sessionQuery.lte('started_at', date_to.length === 10 ? date_to + 'T23:59:59.999Z' : date_to);

    const { data: sessionRows, error: sessError } = await sessionQuery;
    if (sessError) throw sessError;

    const allSessionIds = (sessionRows || []).map((r) => r.id);
    const totalSessions = allSessionIds.length;

    if (totalSessions === 0) {
      const emptyResults = steps.map((step, i) => ({
        name: step.name || `Step ${i + 1}`,
        type: step.type,
        value: step.value,
        count: 0,
        rate: 0,
        dropoff: 0,
      }));

      return res.json({
        funnel,
        results: {
          steps: emptyResults,
          total_sessions: 0,
          overall_conversion: 0,
        },
      });
    }

    // For each step, compute which sessions match (in order).
    // A session qualifies for step N only if it qualified for step N-1 and
    // has the required URL visit or event type.
    let qualifyingSessionIds = new Set(allSessionIds);
    const stepResults = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const nextQualifying = new Set();

      if (qualifyingSessionIds.size === 0) {
        stepResults.push({
          name: step.name || `Step ${i + 1}`,
          type: step.type,
          value: step.value,
          count: 0,
          rate: 0,
          dropoff: 0,
        });
        continue;
      }

      // Process in batches to avoid very large IN clauses
      const sessionIdArray = Array.from(qualifyingSessionIds);
      const BATCH_SIZE = 500;

      for (let b = 0; b < sessionIdArray.length; b += BATCH_SIZE) {
        const batch = sessionIdArray.slice(b, b + BATCH_SIZE);

        if (step.type === 'url') {
          // Check if the session visited the given URL.
          // Strategy: search 3 places (url column, data->>'url', data->>'to')
          // because older events may not have the url column populated.
          // Use OR via multiple queries and merge results.

          // 1. Check events.url column (populated for new events)
          const { data: rows1, error: qErr1 } = await supabase.from('events')
            .select('session_id')
            .in('session_id', batch)
            .ilike('url', `%${step.value}%`);
          if (qErr1) throw qErr1;
          for (const row of (rows1 || [])) nextQualifying.add(row.session_id);

          // 2. Check SESSION_START data->>'url' (type 0, for initial page)
          const { data: rows2, error: qErr2 } = await supabase.from('events')
            .select('session_id')
            .in('session_id', batch)
            .eq('type', 0)
            .ilike('data->>url', `%${step.value}%`);
          if (qErr2) console.warn('[funnels] data->>url query failed:', qErr2.message);
          else for (const row of (rows2 || [])) nextQualifying.add(row.session_id);

          // 3. Check PAGE_NAVIGATION data->>'to' (type 14, for navigated pages)
          const { data: rows3, error: qErr3 } = await supabase.from('events')
            .select('session_id')
            .in('session_id', batch)
            .eq('type', 14)
            .ilike('data->>to', `%${step.value}%`);
          if (qErr3) console.warn('[funnels] data->>to query failed:', qErr3.message);
          else for (const row of (rows3 || [])) nextQualifying.add(row.session_id);

        } else if (step.type === 'event') {
          const eventTypeNum = parseInt(step.value, 10);

          if (!isNaN(eventTypeNum)) {
            // Match by event type number
            const { data: rows, error: qErr } = await supabase.from('events')
              .select('session_id')
              .in('session_id', batch)
              .eq('type', eventTypeNum);
            if (qErr) throw qErr;

            for (const row of (rows || [])) {
              nextQualifying.add(row.session_id);
            }
          } else {
            // Match custom events by name in the JSONB data field
            // CUSTOM_EVENT = type 12. Check data->>'name' for the event name.
            const { data: rows, error: qErr } = await supabase.from('events')
              .select('session_id')
              .in('session_id', batch)
              .eq('type', 12)
              .eq('data->>name', step.value);
            if (qErr) throw qErr;

            for (const row of (rows || [])) {
              nextQualifying.add(row.session_id);
            }
          }
        }
      }

      const count = nextQualifying.size;
      const previousCount = i === 0 ? totalSessions : stepResults[i - 1].count;
      const dropoff = previousCount > 0 ? previousCount - count : 0;
      const rate = totalSessions > 0 ? parseFloat(((count / totalSessions) * 100).toFixed(2)) : 0;

      stepResults.push({
        name: step.name || `Step ${i + 1}`,
        type: step.type,
        value: step.value,
        count,
        rate,
        dropoff,
      });

      qualifyingSessionIds = nextQualifying;
    }

    const lastStepCount = stepResults.length > 0 ? stepResults[stepResults.length - 1].count : 0;
    const overallConversion = totalSessions > 0
      ? parseFloat(((lastStepCount / totalSessions) * 100).toFixed(2))
      : 0;

    res.json({
      funnel,
      results: {
        steps: stepResults,
        total_sessions: totalSessions,
        overall_conversion: overallConversion,
      },
    });
  } catch (err) {
    console.error('[funnels] GET /:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// PUT /api/funnels/:id — Update a funnel
// ============================================================================
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, steps } = req.body;

    const { data: existing, error: findError } = await supabase.from('funnels')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !existing) {
      return res.status(404).json({ error: 'Funnel not found' });
    }

    if (steps !== undefined) {
      if (!Array.isArray(steps) || steps.length === 0) {
        return res.status(400).json({ error: 'steps must be a non-empty array' });
      }
      for (const step of steps) {
        if (!step.type || !['url', 'event'].includes(step.type)) {
          return res.status(400).json({ error: 'Each step must have type "url" or "event"' });
        }
        if (!step.value) {
          return res.status(400).json({ error: 'Each step must have a value' });
        }
      }
    }

    const updatedName = name !== undefined ? name.trim() : existing.name;
    const updatedSteps = steps !== undefined ? steps : existing.steps;

    const { error: updateError } = await supabase.from('funnels')
      .update({
        name: updatedName,
        steps: updatedSteps,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (updateError) throw updateError;

    const { data: funnel, error: fetchError } = await supabase.from('funnels')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchError) throw fetchError;

    res.json({ funnel });
  } catch (err) {
    console.error('[funnels] PUT /:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// DELETE /api/funnels/:id — Delete a funnel
// ============================================================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existing, error: findError } = await supabase.from('funnels')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !existing) {
      return res.status(404).json({ error: 'Funnel not found' });
    }

    const { error: deleteError } = await supabase.from('funnels')
      .delete()
      .eq('id', id);
    if (deleteError) throw deleteError;

    res.json({ success: true, message: 'Funnel deleted' });
  } catch (err) {
    console.error('[funnels] DELETE /:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
