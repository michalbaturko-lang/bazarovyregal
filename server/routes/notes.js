'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const supabase = require('../supabase');

// ============================================================================
// POST /api/notes — Create a session note
// ============================================================================
router.post('/', async (req, res) => {
  try {
    const { session_id, content, project_id = 'default', author = 'admin' } = req.body;

    if (!session_id || !session_id.trim()) {
      return res.status(400).json({ error: 'session_id is required' });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'content is required' });
    }

    const id = uuidv4();

    const { error: insertError } = await supabase.from('session_notes')
      .insert({
        id,
        session_id: session_id.trim(),
        project_id,
        content: content.trim(),
        author: author || 'admin',
      });
    if (insertError) throw insertError;

    const { data: note, error: fetchError } = await supabase.from('session_notes')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchError) throw fetchError;

    res.status(201).json({ note });
  } catch (err) {
    console.error('[notes] POST / error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/notes — List notes for a session
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const { session_id } = req.query;

    if (!session_id) {
      return res.status(400).json({ error: 'session_id query parameter is required' });
    }

    const { data: notes, error } = await supabase.from('session_notes')
      .select('*')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true });
    if (error) throw error;

    res.json({ notes: notes || [] });
  } catch (err) {
    console.error('[notes] GET / error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// DELETE /api/notes/:id — Delete a note
// ============================================================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existing, error: findError } = await supabase.from('session_notes')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !existing) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const { error: deleteError } = await supabase.from('session_notes')
      .delete()
      .eq('id', id);
    if (deleteError) throw deleteError;

    res.json({ success: true, message: 'Note deleted' });
  } catch (err) {
    console.error('[notes] DELETE /:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
