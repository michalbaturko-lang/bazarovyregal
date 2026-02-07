'use strict';

const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const getDatabase = require('../db');

const router = Router();

// ============================================================================
// GET /api/segments — List segments for a project
// ============================================================================
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const { project_id = 'default' } = req.query;

    const segments = db.prepare(
      'SELECT * FROM segments WHERE project_id = ? ORDER BY created_at DESC'
    ).all(project_id);

    // Parse JSON filters
    const parsed = segments.map((s) => ({
      ...s,
      filters: JSON.parse(s.filters),
    }));

    res.json({ segments: parsed });
  } catch (err) {
    console.error('[segments] GET / error:', err);
    res.status(500).json({ error: 'Failed to list segments' });
  }
});

// ============================================================================
// POST /api/segments — Create a segment
// ============================================================================
router.post('/', (req, res) => {
  try {
    const db = getDatabase();
    const { name, projectId = 'default', filters } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (!filters || typeof filters !== 'object') {
      return res.status(400).json({ error: 'filters must be a valid object' });
    }

    const id = uuidv4();

    db.prepare(`
      INSERT INTO segments (id, project_id, name, filters)
      VALUES (@id, @project_id, @name, @filters)
    `).run({
      id,
      project_id: projectId,
      name: name.trim(),
      filters: JSON.stringify(filters),
    });

    const segment = db.prepare('SELECT * FROM segments WHERE id = ?').get(id);
    segment.filters = JSON.parse(segment.filters);

    res.status(201).json({ segment });
  } catch (err) {
    console.error('[segments] POST / error:', err);
    res.status(500).json({ error: 'Failed to create segment' });
  }
});

// ============================================================================
// GET /api/segments/:id — Get a single segment
// ============================================================================
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const segment = db.prepare('SELECT * FROM segments WHERE id = ?').get(id);
    if (!segment) {
      return res.status(404).json({ error: 'Segment not found' });
    }

    segment.filters = JSON.parse(segment.filters);

    res.json({ segment });
  } catch (err) {
    console.error('[segments] GET /:id error:', err);
    res.status(500).json({ error: 'Failed to get segment' });
  }
});

// ============================================================================
// PUT /api/segments/:id — Update a segment
// ============================================================================
router.put('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { name, filters } = req.body;

    const existing = db.prepare('SELECT * FROM segments WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Segment not found' });
    }

    const updatedName = name !== undefined ? name.trim() : existing.name;
    const updatedFilters = filters !== undefined ? JSON.stringify(filters) : existing.filters;

    if (filters !== undefined && (typeof filters !== 'object' || filters === null)) {
      return res.status(400).json({ error: 'filters must be a valid object' });
    }

    db.prepare(`
      UPDATE segments SET name = ?, filters = ? WHERE id = ?
    `).run(updatedName, updatedFilters, id);

    const segment = db.prepare('SELECT * FROM segments WHERE id = ?').get(id);
    segment.filters = JSON.parse(segment.filters);

    res.json({ segment });
  } catch (err) {
    console.error('[segments] PUT /:id error:', err);
    res.status(500).json({ error: 'Failed to update segment' });
  }
});

// ============================================================================
// DELETE /api/segments/:id — Delete a segment
// ============================================================================
router.delete('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const existing = db.prepare('SELECT id FROM segments WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Segment not found' });
    }

    db.prepare('DELETE FROM segments WHERE id = ?').run(id);

    res.json({ success: true, message: 'Segment deleted' });
  } catch (err) {
    console.error('[segments] DELETE /:id error:', err);
    res.status(500).json({ error: 'Failed to delete segment' });
  }
});

module.exports = router;
