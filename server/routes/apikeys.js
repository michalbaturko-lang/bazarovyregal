'use strict';

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const supabase = require('../supabase');

// ============================================================================
// Constants
// ============================================================================
const KEY_PREFIX = 'rml_k_';
const VALID_SCOPES = ['read:sessions', 'read:events', 'read:analytics', 'write:events'];

// ============================================================================
// Helpers
// ============================================================================

/** Generate a new API key: rml_k_ + 32 random hex chars */
function generateApiKey() {
  return KEY_PREFIX + crypto.randomBytes(16).toString('hex');
}

/** Hash an API key with SHA-256 for storage */
function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/** Create a display prefix from a full key, e.g. "rml_k_abc...xyz" */
function makeKeyPrefix(key) {
  return key.substring(0, 10) + '...' + key.substring(key.length - 3);
}

// ============================================================================
// GET /api/apikeys/list — List all API keys (prefix only, never full key)
// ============================================================================
router.get('/list', async (req, res) => {
  try {
    const { project_id = 'default' } = req.query;

    const { data: keys, error } = await supabase.from('api_keys')
      .select('id, project_id, name, key_prefix, scopes, last_used_at, request_count, active, created_at')
      .eq('project_id', project_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ keys: keys || [] });
  } catch (err) {
    console.error('[apikeys] GET /list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /api/apikeys/create — Create a new API key
// ============================================================================
router.post('/create', async (req, res) => {
  try {
    const { name, scopes, project_id = 'default' } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'name is required' });
    }

    // Validate scopes
    const requestedScopes = Array.isArray(scopes) ? scopes : VALID_SCOPES.slice(0, 3);
    const validatedScopes = requestedScopes.filter(s => VALID_SCOPES.includes(s));

    if (validatedScopes.length === 0) {
      return res.status(400).json({ error: 'At least one valid scope is required. Valid scopes: ' + VALID_SCOPES.join(', ') });
    }

    // Generate the key
    const rawKey = generateApiKey();
    const keyHash = hashKey(rawKey);
    const keyPrefix = makeKeyPrefix(rawKey);

    // Store in database (hash only, never the raw key)
    const { data: inserted, error } = await supabase.from('api_keys')
      .insert({
        project_id,
        name: name.trim(),
        key_hash: keyHash,
        key_prefix: keyPrefix,
        scopes: validatedScopes,
      })
      .select('id, name, key_prefix, scopes, active, created_at')
      .single();

    if (error) throw error;

    // Return the full key ONCE — it will never be shown again
    res.json({
      key: rawKey,
      id: inserted.id,
      name: inserted.name,
      key_prefix: inserted.key_prefix,
      scopes: inserted.scopes,
      active: inserted.active,
      created_at: inserted.created_at,
      warning: 'Save this key now. It will not be shown again.',
    });
  } catch (err) {
    console.error('[apikeys] POST /create error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// DELETE /api/apikeys/:id — Revoke (delete) an API key
// ============================================================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existing, error: findError } = await supabase.from('api_keys')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !existing) {
      return res.status(404).json({ error: 'API key not found' });
    }

    const { error: deleteError } = await supabase.from('api_keys')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    res.json({ success: true, message: 'API key revoked' });
  } catch (err) {
    console.error('[apikeys] DELETE /:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/apikeys/:id/usage — Usage stats for a key
// ============================================================================
router.get('/:id/usage', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: apiKey, error } = await supabase.from('api_keys')
      .select('id, name, key_prefix, request_count, last_used_at, active, created_at')
      .eq('id', id)
      .single();

    if (error || !apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    // Since we track total request_count in the api_keys table itself,
    // provide estimated breakdowns based on creation date and usage pattern.
    const now = new Date();
    const createdAt = new Date(apiKey.created_at);
    const lastUsed = apiKey.last_used_at ? new Date(apiKey.last_used_at) : null;
    const totalRequests = apiKey.request_count || 0;

    // Calculate age in days
    const ageDays = Math.max(1, Math.ceil((now - createdAt) / (1000 * 60 * 60 * 24)));
    const avgPerDay = totalRequests / ageDays;

    // Estimate usage for different time windows
    const requests_24h = Math.min(totalRequests, Math.round(avgPerDay));
    const requests_7d = Math.min(totalRequests, Math.round(avgPerDay * 7));
    const requests_30d = Math.min(totalRequests, Math.round(avgPerDay * 30));

    res.json({
      id: apiKey.id,
      name: apiKey.name,
      key_prefix: apiKey.key_prefix,
      active: apiKey.active,
      total_requests: totalRequests,
      requests_24h,
      requests_7d,
      requests_30d,
      last_used_at: apiKey.last_used_at,
      created_at: apiKey.created_at,
    });
  } catch (err) {
    console.error('[apikeys] GET /:id/usage error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// PATCH /api/apikeys/:id — Toggle active status
// ============================================================================
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;

    if (typeof active !== 'boolean') {
      return res.status(400).json({ error: 'active must be a boolean' });
    }

    const { data: updated, error } = await supabase.from('api_keys')
      .update({ active })
      .eq('id', id)
      .select('id, name, key_prefix, scopes, active, last_used_at, request_count, created_at')
      .single();

    if (error) throw error;
    if (!updated) {
      return res.status(404).json({ error: 'API key not found' });
    }

    res.json(updated);
  } catch (err) {
    console.error('[apikeys] PATCH /:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
