'use strict';

const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const router = Router();

// ============================================================================
// GET /api/segments — List segments for a project
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const { project_id = 'default' } = req.query;

    const { data: segments, error } = await db.query('segments')
      .select('*')
      .eq('project_id', project_id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    // filters is already parsed from JSONB
    res.json({ segments: segments || [] });
  } catch (err) {
    console.error('[segments] GET / error:', err);
    res.status(500).json({ error: 'Failed to list segments' });
  }
});

// ============================================================================
// POST /api/segments — Create a segment
// ============================================================================
router.post('/', async (req, res) => {
  try {
    const { name, projectId = 'default', filters } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (!filters || typeof filters !== 'object') {
      return res.status(400).json({ error: 'filters must be a valid object' });
    }

    const id = uuidv4();

    const { error: insertError } = await db.query('segments')
      .insert({
        id,
        project_id: projectId,
        name: name.trim(),
        filters,          // JSONB — pass as object directly
      });
    if (insertError) throw insertError;

    const { data: segment, error: fetchError } = await db.query('segments')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchError) throw fetchError;

    res.status(201).json({ segment });
  } catch (err) {
    console.error('[segments] POST / error:', err);
    res.status(500).json({ error: 'Failed to create segment' });
  }
});

// ============================================================================
// GET /api/segments/:id — Get a single segment
// ============================================================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: segment, error } = await db.query('segments')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !segment) {
      return res.status(404).json({ error: 'Segment not found' });
    }

    // filters is already parsed from JSONB
    res.json({ segment });
  } catch (err) {
    console.error('[segments] GET /:id error:', err);
    res.status(500).json({ error: 'Failed to get segment' });
  }
});

// ============================================================================
// PUT /api/segments/:id — Update a segment
// ============================================================================
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, filters } = req.body;

    const { data: existing, error: findError } = await db.query('segments')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !existing) {
      return res.status(404).json({ error: 'Segment not found' });
    }

    if (filters !== undefined && (typeof filters !== 'object' || filters === null)) {
      return res.status(400).json({ error: 'filters must be a valid object' });
    }

    const updatedName = name !== undefined ? name.trim() : existing.name;
    const updatedFilters = filters !== undefined ? filters : existing.filters;

    const { error: updateError } = await db.query('segments')
      .update({
        name: updatedName,
        filters: updatedFilters,
      })
      .eq('id', id);
    if (updateError) throw updateError;

    const { data: segment, error: fetchError } = await db.query('segments')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchError) throw fetchError;

    res.json({ segment });
  } catch (err) {
    console.error('[segments] PUT /:id error:', err);
    res.status(500).json({ error: 'Failed to update segment' });
  }
});

// ============================================================================
// DELETE /api/segments/:id — Delete a segment
// ============================================================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existing, error: findError } = await db.query('segments')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !existing) {
      return res.status(404).json({ error: 'Segment not found' });
    }

    const { error: deleteError } = await db.query('segments')
      .delete()
      .eq('id', id);
    if (deleteError) throw deleteError;

    res.json({ success: true, message: 'Segment deleted' });
  } catch (err) {
    console.error('[segments] DELETE /:id error:', err);
    res.status(500).json({ error: 'Failed to delete segment' });
  }
});

module.exports = router;
