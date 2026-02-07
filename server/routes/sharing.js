'use strict';

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const supabase = require('../supabase');

// ============================================================================
// POST /api/sharing/create — Create a shareable link for a session
// ============================================================================
router.post('/create', async (req, res) => {
  try {
    const { session_id, expires_hours = 72 } = req.body;

    if (!session_id) {
      return res.status(400).json({ error: 'session_id is required' });
    }

    // Verify the session exists
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, project_id')
      .eq('id', session_id)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Generate a random 32-char hex token
    const token = crypto.randomBytes(16).toString('hex');

    // Calculate expiration
    const expiresAt = new Date(Date.now() + expires_hours * 60 * 60 * 1000).toISOString();

    // Insert share link record
    const { error: insertError } = await supabase
      .from('share_links')
      .insert({
        token,
        session_id,
        project_id: session.project_id,
        created_by: 'admin',
        expires_at: expiresAt,
      });

    if (insertError) {
      console.error('[sharing] Insert error:', insertError);
      return res.status(500).json({ error: 'Failed to create share link. The share_links table may not exist yet — please run schema.sql.' });
    }

    // Build the share URL
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const shareUrl = `${protocol}://${host}/shared?token=${token}`;

    res.json({
      token,
      share_url: shareUrl,
      session_id,
      expires_at: expiresAt,
      expires_hours,
    });
  } catch (err) {
    console.error('[sharing] POST /create error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/sharing/list — List all active share links for the project
// ============================================================================
router.get('/list', async (req, res) => {
  try {
    const { project_id = 'default' } = req.query;

    const { data: links, error } = await supabase
      .from('share_links')
      .select('*')
      .eq('project_id', project_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[sharing] List error:', error);
      return res.status(500).json({ error: 'Failed to list share links. The share_links table may not exist yet.' });
    }

    // Mark expired links
    const now = new Date();
    const enriched = (links || []).map(link => ({
      ...link,
      is_expired: new Date(link.expires_at) < now,
    }));

    res.json({ share_links: enriched });
  } catch (err) {
    console.error('[sharing] GET /list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/sharing/:token — Get shared session data (NO auth required)
// ============================================================================
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token || token.length !== 32) {
      return res.status(400).json({ error: 'Invalid share token' });
    }

    // Look up the share link
    const { data: link, error: linkError } = await supabase
      .from('share_links')
      .select('*')
      .eq('token', token)
      .single();

    if (linkError || !link) {
      return res.status(404).json({ error: 'Share link not found or has been revoked' });
    }

    // Check expiration
    if (new Date(link.expires_at) < new Date()) {
      return res.status(410).json({ error: 'This share link has expired' });
    }

    // Fetch the session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', link.session_id)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: 'Session not found — it may have been deleted' });
    }

    // Fetch session events
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('session_id', link.session_id)
      .order('timestamp', { ascending: true });

    if (eventsError) throw eventsError;

    res.json({
      session,
      events: events || [],
      share: {
        token: link.token,
        created_at: link.created_at,
        expires_at: link.expires_at,
        created_by: link.created_by,
      },
    });
  } catch (err) {
    console.error('[sharing] GET /:token error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// DELETE /api/sharing/:token — Revoke a share link
// ============================================================================
router.delete('/:token', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Check existence
    const { data: link, error: findError } = await supabase
      .from('share_links')
      .select('token')
      .eq('token', token)
      .single();

    if (findError || !link) {
      return res.status(404).json({ error: 'Share link not found' });
    }

    // Delete the share link
    const { error: deleteError } = await supabase
      .from('share_links')
      .delete()
      .eq('token', token);

    if (deleteError) throw deleteError;

    res.json({ success: true, message: 'Share link revoked' });
  } catch (err) {
    console.error('[sharing] DELETE /:token error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
