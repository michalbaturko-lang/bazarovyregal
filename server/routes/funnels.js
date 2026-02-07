'use strict';

const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const getDatabase = require('../db');

const router = Router();

// ============================================================================
// POST /api/funnels — Create a funnel definition
// ============================================================================
router.post('/', (req, res) => {
  try {
    const db = getDatabase();
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

    db.prepare(`
      INSERT INTO funnels (id, project_id, name, steps, created_at, updated_at)
      VALUES (@id, @project_id, @name, @steps, @created_at, @updated_at)
    `).run({
      id,
      project_id: projectId,
      name: name.trim(),
      steps: JSON.stringify(steps),
      created_at: now,
      updated_at: now,
    });

    const funnel = db.prepare('SELECT * FROM funnels WHERE id = ?').get(id);
    funnel.steps = JSON.parse(funnel.steps);

    res.status(201).json({ funnel });
  } catch (err) {
    console.error('[funnels] POST / error:', err);
    res.status(500).json({ error: 'Failed to create funnel' });
  }
});

// ============================================================================
// GET /api/funnels — List funnels for a project
// ============================================================================
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const { project_id = 'default' } = req.query;

    const funnels = db.prepare(
      'SELECT * FROM funnels WHERE project_id = ? ORDER BY created_at DESC'
    ).all(project_id);

    // Parse JSON steps for each funnel
    const parsed = funnels.map((f) => ({
      ...f,
      steps: JSON.parse(f.steps),
    }));

    res.json({ funnels: parsed });
  } catch (err) {
    console.error('[funnels] GET / error:', err);
    res.status(500).json({ error: 'Failed to list funnels' });
  }
});

// ============================================================================
// GET /api/funnels/:id — Get funnel with calculated results
// ============================================================================
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { date_from, date_to } = req.query;

    const funnel = db.prepare('SELECT * FROM funnels WHERE id = ?').get(id);
    if (!funnel) {
      return res.status(404).json({ error: 'Funnel not found' });
    }

    const steps = JSON.parse(funnel.steps);

    // Build date filter conditions for the session query
    const dateConditions = ['s.project_id = @project_id'];
    const dateParams = { project_id: funnel.project_id };

    if (date_from) {
      dateConditions.push('s.started_at >= @date_from');
      dateParams.date_from = date_from;
    }
    if (date_to) {
      dateConditions.push('s.started_at <= @date_to');
      dateParams.date_to = date_to;
    }

    const dateWhere = dateConditions.join(' AND ');

    // Get all qualifying session IDs
    const sessionRows = db.prepare(
      `SELECT s.id FROM sessions s WHERE ${dateWhere}`
    ).all(dateParams);

    const allSessionIds = sessionRows.map((r) => r.id);
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

      funnel.steps = steps;
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
    // A session matches step N if it matched step N-1 AND has the required
    // URL visit or event type after the timestamp of step N-1's match.
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

      // Process in batches to avoid extremely long IN clauses
      const sessionIdArray = Array.from(qualifyingSessionIds);
      const BATCH_SIZE = 500;

      for (let b = 0; b < sessionIdArray.length; b += BATCH_SIZE) {
        const batch = sessionIdArray.slice(b, b + BATCH_SIZE);
        const placeholders = batch.map(() => '?').join(',');

        if (step.type === 'url') {
          // Check if the session visited the given URL
          const rows = db.prepare(`
            SELECT DISTINCT session_id FROM events
            WHERE session_id IN (${placeholders})
              AND url LIKE ?
          `).all(...batch, `%${step.value}%`);

          for (const row of rows) {
            nextQualifying.add(row.session_id);
          }
        } else if (step.type === 'event') {
          // Check if the session has a custom event matching the value
          // The value is matched against the event data or the event type number
          const eventTypeNum = parseInt(step.value, 10);
          if (!isNaN(eventTypeNum)) {
            const rows = db.prepare(`
              SELECT DISTINCT session_id FROM events
              WHERE session_id IN (${placeholders})
                AND type = ?
            `).all(...batch, eventTypeNum);

            for (const row of rows) {
              nextQualifying.add(row.session_id);
            }
          } else {
            // Match custom events by name in the JSON data
            const rows = db.prepare(`
              SELECT DISTINCT session_id FROM events
              WHERE session_id IN (${placeholders})
                AND type = 14
                AND json_extract(data, '$.name') = ?
            `).all(...batch, step.value);

            for (const row of rows) {
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

    funnel.steps = steps;

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
router.put('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { name, steps } = req.body;

    const existing = db.prepare('SELECT * FROM funnels WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Funnel not found' });
    }

    const updatedName = name !== undefined ? name.trim() : existing.name;
    const updatedSteps = steps !== undefined ? JSON.stringify(steps) : existing.steps;

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

    db.prepare(`
      UPDATE funnels SET name = ?, steps = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(updatedName, updatedSteps, id);

    const funnel = db.prepare('SELECT * FROM funnels WHERE id = ?').get(id);
    funnel.steps = JSON.parse(funnel.steps);

    res.json({ funnel });
  } catch (err) {
    console.error('[funnels] PUT /:id error:', err);
    res.status(500).json({ error: 'Failed to update funnel' });
  }
});

// ============================================================================
// DELETE /api/funnels/:id — Delete a funnel
// ============================================================================
router.delete('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const existing = db.prepare('SELECT id FROM funnels WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Funnel not found' });
    }

    db.prepare('DELETE FROM funnels WHERE id = ?').run(id);

    res.json({ success: true, message: 'Funnel deleted' });
  } catch (err) {
    console.error('[funnels] DELETE /:id error:', err);
    res.status(500).json({ error: 'Failed to delete funnel' });
  }
});

module.exports = router;
