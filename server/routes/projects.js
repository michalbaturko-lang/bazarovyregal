'use strict';

const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// In-memory project store for simple deployments (persists per process lifetime)
const projectDefaults = {
  default: {
    id: 'default',
    name: 'My Project',
    domain: '',
    retention_days: 90,
  },
};

// ============================================================================
// GET /api/projects — List all projects
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const { data: projects, error } = await supabase.from('projects')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Filter out projects with 0 sessions (stale/duplicate entries)
    const filtered = [];
    for (const p of (projects || [])) {
      const { count, error: cErr } = await supabase.from('sessions')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', p.id);
      if (!cErr && count > 0) {
        p.session_count = count;
        filtered.push(p);
      }
    }

    res.json({ projects: filtered });
  } catch (err) {
    console.error('[projects] GET / error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// DELETE /api/projects/:id — Delete a project (and optionally its data)
// ============================================================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true, deleted: id });
  } catch (err) {
    console.error('[projects] DELETE /:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/projects/:id — Get project details
// ============================================================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Try Supabase first
    try {
      const { data, error } = await supabase.from('projects')
        .select('*')
        .eq('id', id)
        .single();

      if (!error && data) {
        return res.json(data);
      }
    } catch (_) {
      // Supabase table may not exist, fall back to in-memory
    }

    // Fall back to in-memory store
    const project = projectDefaults[id];
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (err) {
    console.error('[projects] GET /:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/projects/:id/stats — Get data usage stats for a project
// ============================================================================
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;

    let sessionCount = 0;
    let eventCount = 0;

    try {
      // Count sessions
      const { count: sCount, error: sError } = await supabase.from('sessions')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', id);

      if (!sError) sessionCount = sCount || 0;

      // Count events - get session IDs first then count events
      const { data: sessionIds, error: sidError } = await supabase.from('sessions')
        .select('id')
        .eq('project_id', id);

      if (!sidError && sessionIds && sessionIds.length > 0) {
        const ids = sessionIds.map(s => s.id);
        const { count: eCount, error: eError } = await supabase.from('events')
          .select('*', { count: 'exact', head: true })
          .in('session_id', ids);

        if (!eError) eventCount = eCount || 0;
      }
    } catch (_) {
      // If Supabase is unavailable, return zeros
    }

    res.json({
      sessions: sessionCount,
      events: eventCount,
    });
  } catch (err) {
    console.error('[projects] GET /:id/stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// PUT /api/projects/:id — Update project (name, domain, retention_days)
// ============================================================================
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, domain, retention_days } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (domain !== undefined) updates.domain = domain;
    if (retention_days !== undefined) updates.retention_days = parseInt(retention_days, 10);

    // Try Supabase first
    try {
      const { data, error } = await supabase.from('projects')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (!error && data) {
        return res.json(data);
      }
    } catch (_) {
      // Supabase table may not exist, fall back to in-memory
    }

    // Fall back to in-memory store
    if (!projectDefaults[id]) {
      projectDefaults[id] = { id, name: 'My Project', domain: '', retention_days: 90 };
    }

    Object.assign(projectDefaults[id], updates);
    res.json(projectDefaults[id]);
  } catch (err) {
    console.error('[projects] PUT /:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// DELETE /api/sessions/all — Clear all sessions and events for a project
// Note: This is mounted under /api/projects but handles the /api/sessions/all
// path via the server router configuration. We also mount it here as a
// sub-route for flexibility.
// ============================================================================
router.delete('/sessions/all', async (req, res) => {
  try {
    const { project_id = 'default' } = req.query;

    // Get all session IDs for this project
    const { data: sessions, error: fetchError } = await supabase.from('sessions')
      .select('id')
      .eq('project_id', project_id);

    if (fetchError) throw fetchError;

    if (sessions && sessions.length > 0) {
      const sessionIds = sessions.map(s => s.id);

      // Delete events for these sessions
      const { error: evtError } = await supabase.from('events')
        .delete()
        .in('session_id', sessionIds);
      if (evtError) throw evtError;

      // Delete sessions
      const { error: sessError } = await supabase.from('sessions')
        .delete()
        .eq('project_id', project_id);
      if (sessError) throw sessError;
    }

    res.json({
      success: true,
      message: `All sessions cleared for project ${project_id}`,
      deleted: sessions ? sessions.length : 0,
    });
  } catch (err) {
    console.error('[projects] DELETE /sessions/all error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
