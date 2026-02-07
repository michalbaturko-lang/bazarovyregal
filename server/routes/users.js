'use strict';

const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// ============================================================================
// GET /api/users — List identified users
// Query sessions where identified_user_id IS NOT NULL,
// aggregate in JS since Supabase client doesn't support GROUP BY well.
// Supports: search (ilike on email or name), page, limit
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const {
      project_id = 'default',
      search,
      page: rawPage = '1',
      limit: rawLimit = '50',
    } = req.query;

    const page = Math.max(1, parseInt(rawPage, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(rawLimit, 10) || 50));

    // Fetch all sessions with identified users
    let query = supabase.from('sessions')
      .select('identified_user_id, identified_user_email, identified_user_name, started_at, duration, device_type, id')
      .eq('project_id', project_id)
      .not('identified_user_id', 'is', null);

    const { data: sessions, error } = await query;
    if (error) throw error;

    // Group by identified_user_id and aggregate
    const userMap = {};
    (sessions || []).forEach(s => {
      const uid = s.identified_user_id;
      if (!uid) return;

      if (!userMap[uid]) {
        userMap[uid] = {
          id: uid,
          name: s.identified_user_name || null,
          email: s.identified_user_email || null,
          total_sessions: 0,
          last_seen: s.started_at,
          first_seen: s.started_at,
          total_duration: 0,
          devices: {},
        };
      }

      const u = userMap[uid];
      u.total_sessions += 1;
      u.total_duration += (s.duration || 0);

      // Update name/email if we have newer data
      if (s.identified_user_name) u.name = s.identified_user_name;
      if (s.identified_user_email) u.email = s.identified_user_email;

      // Track last seen and first seen
      if (s.started_at && s.started_at > u.last_seen) u.last_seen = s.started_at;
      if (s.started_at && s.started_at < u.first_seen) u.first_seen = s.started_at;

      // Track most common device
      const device = s.device_type || 'Desktop';
      u.devices[device] = (u.devices[device] || 0) + 1;
    });

    // Convert to array and determine most common device
    let userList = Object.values(userMap).map(u => {
      const deviceEntries = Object.entries(u.devices);
      const mostCommonDevice = deviceEntries.length > 0
        ? deviceEntries.sort((a, b) => b[1] - a[1])[0][0]
        : 'Desktop';
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        total_sessions: u.total_sessions,
        last_seen: u.last_seen,
        first_seen: u.first_seen,
        total_duration: u.total_duration,
        device: mostCommonDevice,
      };
    });

    // Apply search filter
    if (search) {
      const q = search.toLowerCase();
      userList = userList.filter(u =>
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.name && u.name.toLowerCase().includes(q))
      );
    }

    // Sort by last_seen descending
    userList.sort((a, b) => new Date(b.last_seen) - new Date(a.last_seen));

    // Paginate
    const total = userList.length;
    const offset = (page - 1) * limit;
    const paginatedUsers = userList.slice(offset, offset + limit);
    const pages = Math.ceil(total / limit);

    res.json({
      users: paginatedUsers,
      total,
      page,
      pages,
    });
  } catch (err) {
    console.error('[users] GET / error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/users/:id — Get user detail with all sessions
// ============================================================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { project_id = 'default' } = req.query;

    // Fetch all sessions for this user
    const { data: sessions, error } = await supabase.from('sessions')
      .select('*')
      .eq('project_id', project_id)
      .eq('identified_user_id', id)
      .order('started_at', { ascending: false });

    if (error) throw error;

    if (!sessions || sessions.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Build user info from the sessions
    const latestSession = sessions[0];
    const user = {
      id: id,
      name: latestSession.identified_user_name || null,
      email: latestSession.identified_user_email || null,
      total_sessions: sessions.length,
      total_duration: sessions.reduce((sum, s) => sum + (s.duration || 0), 0),
      first_seen: sessions[sessions.length - 1].started_at,
      last_seen: sessions[0].started_at,
    };

    res.json({ user, sessions });
  } catch (err) {
    console.error('[users] GET /:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/users/:id/events — Get all events across all sessions for a user
// ============================================================================
router.get('/:id/events', async (req, res) => {
  try {
    const { id } = req.params;
    const { project_id = 'default' } = req.query;

    // First, get all session IDs for this user
    const { data: sessions, error: sessError } = await supabase.from('sessions')
      .select('id')
      .eq('project_id', project_id)
      .eq('identified_user_id', id);

    if (sessError) throw sessError;

    if (!sessions || sessions.length === 0) {
      return res.json({ events: [] });
    }

    const sessionIds = sessions.map(s => s.id);

    // Fetch events for all those sessions
    const { data: events, error: evtError } = await supabase.from('events')
      .select('*')
      .in('session_id', sessionIds)
      .order('timestamp', { ascending: true });

    if (evtError) throw evtError;

    res.json({ events: events || [] });
  } catch (err) {
    console.error('[users] GET /:id/events error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
