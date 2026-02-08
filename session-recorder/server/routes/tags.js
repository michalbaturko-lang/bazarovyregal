'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const supabase = require('../supabase');

/*
-- ==========================================================================
-- session_tags: Links tags to individual sessions
-- ==========================================================================
CREATE TABLE IF NOT EXISTS session_tags (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  tag_name      TEXT NOT NULL,
  tag_color     TEXT NOT NULL DEFAULT 'blue',
  applied_by    TEXT NOT NULL DEFAULT 'manual',   -- 'manual' | 'rule'
  rule_id       UUID REFERENCES tag_rules(id) ON DELETE SET NULL,
  project_id    TEXT NOT NULL DEFAULT 'default',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, tag_name)
);

CREATE INDEX idx_session_tags_session ON session_tags(session_id);
CREATE INDEX idx_session_tags_project ON session_tags(project_id);
CREATE INDEX idx_session_tags_tag     ON session_tags(tag_name);

-- ==========================================================================
-- tag_rules: Defines auto-tagging rules with conditions
-- ==========================================================================
CREATE TABLE IF NOT EXISTS tag_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  tag_name        TEXT NOT NULL,
  tag_color       TEXT NOT NULL DEFAULT 'blue',
  conditions      JSONB NOT NULL DEFAULT '[]',
  auto_apply      BOOLEAN NOT NULL DEFAULT false,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  project_id      TEXT NOT NULL DEFAULT 'default',
  sessions_matched INTEGER NOT NULL DEFAULT 0,
  last_applied_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tag_rules_project ON tag_rules(project_id);
*/

// ============================================================================
// Helper: Build a Supabase filter chain from a conditions array
// ============================================================================
// Each condition: { field, operator, value }
//
// Supported fields:
//   duration, page_count, has_errors, has_rage_clicks, browser, os,
//   device_type, url_contains, utm_source, identified_user_email,
//   event_count, country
//
// Supported operators:
//   gt, lt, gte, lte, eq, neq, contains, not_contains, is_set, is_not_set
// ============================================================================
function buildSessionFilter(query, conditions) {
  if (!Array.isArray(conditions)) return query;

  for (const cond of conditions) {
    const { field, operator, value } = cond;
    if (!field || !operator) continue;

    // Map logical field names to actual column names where they differ
    const columnMap = {
      url_contains: 'url',
    };
    const column = columnMap[field] || field;

    switch (operator) {
      case 'gt':
        query = query.gt(column, value);
        break;
      case 'lt':
        query = query.lt(column, value);
        break;
      case 'gte':
        query = query.gte(column, value);
        break;
      case 'lte':
        query = query.lte(column, value);
        break;
      case 'eq':
        if (value === true || value === 'true') {
          query = query.eq(column, true);
        } else if (value === false || value === 'false') {
          query = query.eq(column, false);
        } else {
          query = query.eq(column, value);
        }
        break;
      case 'neq':
        query = query.neq(column, value);
        break;
      case 'contains':
        query = query.ilike(column, `%${value}%`);
        break;
      case 'not_contains':
        query = query.not(column, 'ilike', `%${value}%`);
        break;
      case 'is_set':
        query = query.not(column, 'is', null);
        break;
      case 'is_not_set':
        query = query.is(column, null);
        break;
      default:
        break;
    }
  }

  return query;
}

// ============================================================================
// GET /api/tags/rules — List tag rules for a project
// ============================================================================
router.get('/rules', async (req, res) => {
  try {
    const { project_id = 'default' } = req.query;

    const { data: rules, error } = await supabase.from('tag_rules')
      .select('*')
      .eq('project_id', project_id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    res.json({ rules: rules || [] });
  } catch (err) {
    console.error('[tags] GET /rules error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /api/tags/rules — Create a tag rule
// ============================================================================
router.post('/rules', async (req, res) => {
  try {
    const { name, tag_name, tag_color = 'blue', conditions, auto_apply = false, project_id = 'default' } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (!tag_name || !tag_name.trim()) {
      return res.status(400).json({ error: 'tag_name is required' });
    }
    if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
      return res.status(400).json({ error: 'conditions must be a non-empty array' });
    }

    // Validate each condition
    const VALID_FIELDS = [
      'duration', 'page_count', 'has_errors', 'has_rage_clicks', 'browser',
      'os', 'device_type', 'url_contains', 'utm_source', 'identified_user_email',
      'event_count', 'country',
    ];
    const VALID_OPERATORS = [
      'gt', 'lt', 'gte', 'lte', 'eq', 'neq', 'contains', 'not_contains',
      'is_set', 'is_not_set',
    ];

    for (const cond of conditions) {
      if (!VALID_FIELDS.includes(cond.field)) {
        return res.status(400).json({ error: `Invalid condition field: ${cond.field}` });
      }
      if (!VALID_OPERATORS.includes(cond.operator)) {
        return res.status(400).json({ error: `Invalid condition operator: ${cond.operator}` });
      }
    }

    const id = uuidv4();

    const { error: insertError } = await supabase.from('tag_rules')
      .insert({
        id,
        name: name.trim(),
        tag_name: tag_name.trim(),
        tag_color,
        conditions,
        auto_apply,
        enabled: true,
        project_id,
        sessions_matched: 0,
      });
    if (insertError) throw insertError;

    const { data: rule, error: fetchError } = await supabase.from('tag_rules')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchError) throw fetchError;

    res.status(201).json({ rule });
  } catch (err) {
    console.error('[tags] POST /rules error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// PUT /api/tags/rules/:id — Update a tag rule
// ============================================================================
router.put('/rules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, tag_name, tag_color, conditions, auto_apply, enabled } = req.body;

    const { data: existing, error: findError } = await supabase.from('tag_rules')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !existing) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    const updates = {};
    if (name !== undefined)       updates.name = name.trim();
    if (tag_name !== undefined)   updates.tag_name = tag_name.trim();
    if (tag_color !== undefined)  updates.tag_color = tag_color;
    if (conditions !== undefined) updates.conditions = conditions;
    if (auto_apply !== undefined) updates.auto_apply = auto_apply;
    if (enabled !== undefined)    updates.enabled = enabled;
    updates.updated_at = new Date().toISOString();

    const { error: updateError } = await supabase.from('tag_rules')
      .update(updates)
      .eq('id', id);
    if (updateError) throw updateError;

    const { data: rule, error: fetchError } = await supabase.from('tag_rules')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchError) throw fetchError;

    res.json({ rule });
  } catch (err) {
    console.error('[tags] PUT /rules/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// DELETE /api/tags/rules/:id — Delete a tag rule and its tag associations
// ============================================================================
router.delete('/rules/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existing, error: findError } = await supabase.from('tag_rules')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !existing) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    // Remove all session_tags that were applied by this rule
    const { error: tagsDeleteError } = await supabase.from('session_tags')
      .delete()
      .eq('rule_id', id);
    if (tagsDeleteError) throw tagsDeleteError;

    // Delete the rule itself
    const { error: deleteError } = await supabase.from('tag_rules')
      .delete()
      .eq('id', id);
    if (deleteError) throw deleteError;

    res.json({ success: true, message: 'Rule deleted' });
  } catch (err) {
    console.error('[tags] DELETE /rules/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /api/tags/rules/:id/apply — Apply a rule to all matching sessions
// ============================================================================
router.post('/rules/:id/apply', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: rule, error: ruleError } = await supabase.from('tag_rules')
      .select('*')
      .eq('id', id)
      .single();

    if (ruleError || !rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    // Find sessions matching the rule conditions
    let sessionsQuery = supabase.from('sessions')
      .select('id')
      .eq('project_id', rule.project_id);

    sessionsQuery = buildSessionFilter(sessionsQuery, rule.conditions);

    const { data: matchingSessions, error: sessionsError } = await sessionsQuery;
    if (sessionsError) throw sessionsError;

    const matched = (matchingSessions || []).length;
    let tagged = 0;

    // For each matching session, insert a tag if it doesn't already exist
    for (const session of (matchingSessions || [])) {
      // Check if tag already exists for this session
      const { data: existingTag } = await supabase.from('session_tags')
        .select('id')
        .eq('session_id', session.id)
        .eq('tag_name', rule.tag_name)
        .maybeSingle();

      if (!existingTag) {
        const { error: insertError } = await supabase.from('session_tags')
          .insert({
            id: uuidv4(),
            session_id: session.id,
            tag_name: rule.tag_name,
            tag_color: rule.tag_color,
            applied_by: 'rule',
            rule_id: rule.id,
            project_id: rule.project_id,
          });
        if (!insertError) tagged++;
      }
    }

    // Update the rule's matched count and last applied time
    await supabase.from('tag_rules')
      .update({
        sessions_matched: matched,
        last_applied_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    res.json({ matched, tagged });
  } catch (err) {
    console.error('[tags] POST /rules/:id/apply error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/tags/sessions/:session_id — Get tags for a session
// ============================================================================
router.get('/sessions/:session_id', async (req, res) => {
  try {
    const { session_id } = req.params;

    const { data: tags, error } = await supabase.from('session_tags')
      .select('id, tag_name, tag_color, applied_by, rule_id, created_at')
      .eq('session_id', session_id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    // Enrich with rule names for tags applied by rules
    const enrichedTags = [];
    for (const tag of (tags || [])) {
      const enriched = {
        id: tag.id,
        tag_name: tag.tag_name,
        tag_color: tag.tag_color,
        applied_by_rule: tag.applied_by === 'rule',
        rule_name: null,
        created_at: tag.created_at,
      };

      if (tag.rule_id) {
        const { data: rule } = await supabase.from('tag_rules')
          .select('name')
          .eq('id', tag.rule_id)
          .maybeSingle();
        if (rule) enriched.rule_name = rule.name;
      }

      enrichedTags.push(enriched);
    }

    res.json({ tags: enrichedTags });
  } catch (err) {
    console.error('[tags] GET /sessions/:session_id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /api/tags/sessions/:session_id — Manually add a tag to a session
// ============================================================================
router.post('/sessions/:session_id', async (req, res) => {
  try {
    const { session_id } = req.params;
    const { tag_name, tag_color = 'blue', project_id = 'default' } = req.body;

    if (!tag_name || !tag_name.trim()) {
      return res.status(400).json({ error: 'tag_name is required' });
    }

    // Check if tag already exists
    const { data: existingTag } = await supabase.from('session_tags')
      .select('id')
      .eq('session_id', session_id)
      .eq('tag_name', tag_name.trim())
      .maybeSingle();

    if (existingTag) {
      return res.status(409).json({ error: 'Tag already exists on this session' });
    }

    const id = uuidv4();

    const { error: insertError } = await supabase.from('session_tags')
      .insert({
        id,
        session_id,
        tag_name: tag_name.trim(),
        tag_color,
        applied_by: 'manual',
        rule_id: null,
        project_id,
      });
    if (insertError) throw insertError;

    const { data: tag, error: fetchError } = await supabase.from('session_tags')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchError) throw fetchError;

    res.status(201).json({ tag });
  } catch (err) {
    console.error('[tags] POST /sessions/:session_id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// DELETE /api/tags/sessions/:session_id/:tag_id — Remove tag from session
// ============================================================================
router.delete('/sessions/:session_id/:tag_id', async (req, res) => {
  try {
    const { session_id, tag_id } = req.params;

    const { data: existing, error: findError } = await supabase.from('session_tags')
      .select('id')
      .eq('id', tag_id)
      .eq('session_id', session_id)
      .single();

    if (findError || !existing) {
      return res.status(404).json({ error: 'Tag not found on this session' });
    }

    const { error: deleteError } = await supabase.from('session_tags')
      .delete()
      .eq('id', tag_id);
    if (deleteError) throw deleteError;

    res.json({ success: true, message: 'Tag removed' });
  } catch (err) {
    console.error('[tags] DELETE /sessions/:session_id/:tag_id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/tags/popular — Most used tags with counts
// ============================================================================
router.get('/popular', async (req, res) => {
  try {
    const { project_id = 'default' } = req.query;

    // Fetch all session_tags for the project, then aggregate in-memory
    const { data: allTags, error } = await supabase.from('session_tags')
      .select('tag_name, tag_color')
      .eq('project_id', project_id);
    if (error) throw error;

    const tagCounts = {};
    for (const t of (allTags || [])) {
      if (!tagCounts[t.tag_name]) {
        tagCounts[t.tag_name] = { tag_name: t.tag_name, tag_color: t.tag_color, count: 0 };
      }
      tagCounts[t.tag_name].count++;
    }

    const tags = Object.values(tagCounts)
      .sort((a, b) => b.count - a.count);

    res.json({ tags });
  } catch (err) {
    console.error('[tags] GET /popular error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /api/tags/evaluate — Evaluate all enabled auto-apply rules against
//                           recent sessions within a time window
// ============================================================================
router.post('/evaluate', async (req, res) => {
  try {
    const { project_id = 'default', minutes = '60' } = req.query;

    const windowMinutes = Math.max(1, parseInt(minutes, 10) || 60);
    const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

    // Get all enabled auto-apply rules for the project
    const { data: rules, error: rulesError } = await supabase.from('tag_rules')
      .select('*')
      .eq('project_id', project_id)
      .eq('auto_apply', true)
      .eq('enabled', true);
    if (rulesError) throw rulesError;

    let rulesEvaluated = 0;
    let newTagsApplied = 0;

    for (const rule of (rules || [])) {
      rulesEvaluated++;

      // Find sessions in the time window matching this rule's conditions
      let sessionsQuery = supabase.from('sessions')
        .select('id')
        .eq('project_id', project_id)
        .gte('started_at', cutoff);

      sessionsQuery = buildSessionFilter(sessionsQuery, rule.conditions);

      const { data: matchingSessions, error: sessionsError } = await sessionsQuery;
      if (sessionsError) {
        console.error(`[tags] evaluate rule ${rule.id} sessions error:`, sessionsError);
        continue;
      }

      let ruleTagged = 0;

      for (const session of (matchingSessions || [])) {
        // Check if this tag already exists on the session
        const { data: existingTag } = await supabase.from('session_tags')
          .select('id')
          .eq('session_id', session.id)
          .eq('tag_name', rule.tag_name)
          .maybeSingle();

        if (!existingTag) {
          const { error: insertError } = await supabase.from('session_tags')
            .insert({
              id: uuidv4(),
              session_id: session.id,
              tag_name: rule.tag_name,
              tag_color: rule.tag_color,
              applied_by: 'rule',
              rule_id: rule.id,
              project_id,
            });
          if (!insertError) {
            newTagsApplied++;
            ruleTagged++;
          }
        }
      }

      // Update matched count on the rule
      if (ruleTagged > 0) {
        const newMatched = (rule.sessions_matched || 0) + ruleTagged;
        await supabase.from('tag_rules')
          .update({
            sessions_matched: newMatched,
            last_applied_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', rule.id);
      }
    }

    res.json({ rules_evaluated: rulesEvaluated, new_tags_applied: newTagsApplied });
  } catch (err) {
    console.error('[tags] POST /evaluate error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
