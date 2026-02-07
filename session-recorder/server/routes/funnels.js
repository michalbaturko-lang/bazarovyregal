'use strict';

const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const router = Router();

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

    const { error: insertError } = await db.query('funnels')
      .insert({
        id,
        project_id: projectId,
        name: name.trim(),
        steps,           // JSONB — pass as object directly
        created_at: now,
        updated_at: now,
      });
    if (insertError) throw insertError;

    const { data: funnel, error: fetchError } = await db.query('funnels')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchError) throw fetchError;

    // steps is already parsed from JSONB
    res.status(201).json({ funnel });
  } catch (err) {
    console.error('[funnels] POST / error:', err);
    res.status(500).json({ error: 'Failed to create funnel' });
  }
});

// ============================================================================
// GET /api/funnels — List funnels for a project
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const { project_id = 'default' } = req.query;

    const { data: funnels, error } = await db.query('funnels')
      .select('*')
      .eq('project_id', project_id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    // steps is already parsed from JSONB
    res.json({ funnels: funnels || [] });
  } catch (err) {
    console.error('[funnels] GET / error:', err);
    res.status(500).json({ error: 'Failed to list funnels' });
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
    const { data: funnel, error: funnelError } = await db.query('funnels')
      .select('*')
      .eq('id', id)
      .single();

    if (funnelError || !funnel) {
      return res.status(404).json({ error: 'Funnel not found' });
    }

    const steps = funnel.steps; // already parsed from JSONB

    // Fetch qualifying session IDs
    let sessionQuery = db.query('sessions')
      .select('id')
      .eq('project_id', funnel.project_id);

    if (date_from) sessionQuery = sessionQuery.gte('started_at', date_from);
    if (date_to)   sessionQuery = sessionQuery.lte('started_at', date_to);

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
          // Check if the session visited the given URL
          const { data: rows, error: qErr } = await db.query('events')
            .select('session_id')
            .in('session_id', batch)
            .ilike('url', `%${step.value}%`);
          if (qErr) throw qErr;

          for (const row of (rows || [])) {
            nextQualifying.add(row.session_id);
          }
        } else if (step.type === 'event') {
          const eventTypeNum = parseInt(step.value, 10);

          if (!isNaN(eventTypeNum)) {
            // Match by event type number
            const { data: rows, error: qErr } = await db.query('events')
              .select('session_id')
              .in('session_id', batch)
              .eq('type', eventTypeNum);
            if (qErr) throw qErr;

            for (const row of (rows || [])) {
              nextQualifying.add(row.session_id);
            }
          } else {
            // Match custom events by name in the JSONB data field
            // Supabase filter: data->>'name' = step.value
            const { data: rows, error: qErr } = await db.query('events')
              .select('session_id')
              .in('session_id', batch)
              .eq('type', 14)
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
    res.status(500).json({ error: 'Failed to calculate funnel results' });
  }
});

// ============================================================================
// PUT /api/funnels/:id — Update a funnel
// ============================================================================
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, steps } = req.body;

    const { data: existing, error: findError } = await db.query('funnels')
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

    const { error: updateError } = await db.query('funnels')
      .update({
        name: updatedName,
        steps: updatedSteps,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (updateError) throw updateError;

    const { data: funnel, error: fetchError } = await db.query('funnels')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchError) throw fetchError;

    res.json({ funnel });
  } catch (err) {
    console.error('[funnels] PUT /:id error:', err);
    res.status(500).json({ error: 'Failed to update funnel' });
  }
});

// ============================================================================
// DELETE /api/funnels/:id — Delete a funnel
// ============================================================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existing, error: findError } = await db.query('funnels')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !existing) {
      return res.status(404).json({ error: 'Funnel not found' });
    }

    const { error: deleteError } = await db.query('funnels')
      .delete()
      .eq('id', id);
    if (deleteError) throw deleteError;

    res.json({ success: true, message: 'Funnel deleted' });
  } catch (err) {
    console.error('[funnels] DELETE /:id error:', err);
    res.status(500).json({ error: 'Failed to delete funnel' });
  }
});

module.exports = router;
