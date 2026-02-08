'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const supabase = require('../supabase');

// ============================================================================
// SQL for reference:
//
// CREATE TABLE IF NOT EXISTS surveys (
//   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   project_id TEXT NOT NULL DEFAULT 'default',
//   name TEXT NOT NULL,
//   type TEXT NOT NULL DEFAULT 'nps', -- nps, csat, ces, custom, feedback
//   questions JSONB NOT NULL DEFAULT '[]',
//   trigger_type TEXT DEFAULT 'manual', -- manual, time_on_page, scroll_pct, exit_intent, page_url, event
//   trigger_config JSONB DEFAULT '{}',
//   targeting JSONB DEFAULT '{}', -- device, country, url_pattern, visitor_type, segment
//   appearance JSONB DEFAULT '{}', -- position, theme, colors, branding
//   enabled BOOLEAN DEFAULT true,
//   response_count INT DEFAULT 0,
//   created_at TIMESTAMPTZ DEFAULT now(),
//   updated_at TIMESTAMPTZ DEFAULT now()
// );
//
// CREATE TABLE IF NOT EXISTS survey_responses (
//   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
//   session_id TEXT,
//   visitor_id TEXT,
//   answers JSONB NOT NULL DEFAULT '{}',
//   score INT, -- NPS/CSAT/CES score
//   feedback TEXT,
//   page_url TEXT,
//   created_at TIMESTAMPTZ DEFAULT now()
// );
// ============================================================================

// ============================================================================
// GET /api/surveys — List surveys with response counts
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const { project_id = 'default' } = req.query;

    const { data: surveys, error } = await supabase.from('surveys')
      .select('*')
      .eq('project_id', project_id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    res.json({ surveys: surveys || [] });
  } catch (err) {
    console.error('[surveys] GET / error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/surveys/active — PUBLIC: List active surveys matching criteria
// Used by the tracker widget to fetch surveys to display.
// ============================================================================
router.get('/active', async (req, res) => {
  try {
    const { project_id = 'default', visitor_id, url, device } = req.query;

    let query = supabase.from('surveys')
      .select('id, name, type, questions, trigger_type, trigger_config, targeting, appearance')
      .eq('project_id', project_id)
      .eq('enabled', true);

    const { data: surveys, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;

    // Filter by targeting criteria on the server side
    const filtered = (surveys || []).filter(survey => {
      const targeting = survey.targeting || {};

      // Device targeting
      if (targeting.device && device && targeting.device !== 'all' && targeting.device !== device) {
        return false;
      }

      // URL pattern targeting
      if (targeting.url_pattern && url) {
        try {
          const pattern = new RegExp(targeting.url_pattern);
          if (!pattern.test(url)) return false;
        } catch (_) {
          // Invalid regex, skip filter
        }
      }

      return true;
    });

    res.json({ surveys: filtered });
  } catch (err) {
    console.error('[surveys] GET /active error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /api/surveys — Create a survey
// ============================================================================
router.post('/', async (req, res) => {
  try {
    const {
      name,
      projectId = 'default',
      type = 'nps',
      questions = [],
      trigger_type = 'manual',
      trigger_config = {},
      targeting = {},
      appearance = {},
      enabled = true,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }

    const validTypes = ['nps', 'csat', 'ces', 'custom', 'feedback'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'type must be one of: ' + validTypes.join(', ') });
    }

    const validTriggers = ['manual', 'time_on_page', 'scroll_pct', 'exit_intent', 'page_url', 'event'];
    if (!validTriggers.includes(trigger_type)) {
      return res.status(400).json({ error: 'trigger_type must be one of: ' + validTriggers.join(', ') });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    const { error: insertError } = await supabase.from('surveys')
      .insert({
        id,
        project_id: projectId,
        name: name.trim(),
        type,
        questions,
        trigger_type,
        trigger_config,
        targeting,
        appearance,
        enabled,
        response_count: 0,
        created_at: now,
        updated_at: now,
      });
    if (insertError) throw insertError;

    const { data: survey, error: fetchError } = await supabase.from('surveys')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchError) throw fetchError;

    res.status(201).json({ survey });
  } catch (err) {
    console.error('[surveys] POST / error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// PUT /api/surveys/:id — Update a survey
// ============================================================================
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      type,
      questions,
      trigger_type,
      trigger_config,
      targeting,
      appearance,
      enabled,
    } = req.body;

    const { data: existing, error: findError } = await supabase.from('surveys')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !existing) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    if (type !== undefined) {
      const validTypes = ['nps', 'csat', 'ces', 'custom', 'feedback'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({ error: 'type must be one of: ' + validTypes.join(', ') });
      }
    }

    if (trigger_type !== undefined) {
      const validTriggers = ['manual', 'time_on_page', 'scroll_pct', 'exit_intent', 'page_url', 'event'];
      if (!validTriggers.includes(trigger_type)) {
        return res.status(400).json({ error: 'trigger_type must be one of: ' + validTriggers.join(', ') });
      }
    }

    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name.trim();
    if (type !== undefined) updates.type = type;
    if (questions !== undefined) updates.questions = questions;
    if (trigger_type !== undefined) updates.trigger_type = trigger_type;
    if (trigger_config !== undefined) updates.trigger_config = trigger_config;
    if (targeting !== undefined) updates.targeting = targeting;
    if (appearance !== undefined) updates.appearance = appearance;
    if (enabled !== undefined) updates.enabled = enabled;

    const { error: updateError } = await supabase.from('surveys')
      .update(updates)
      .eq('id', id);
    if (updateError) throw updateError;

    const { data: survey, error: fetchError } = await supabase.from('surveys')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchError) throw fetchError;

    res.json({ survey });
  } catch (err) {
    console.error('[surveys] PUT /:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// DELETE /api/surveys/:id — Delete a survey and its responses
// ============================================================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existing, error: findError } = await supabase.from('surveys')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !existing) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    // Delete responses first (cascade should handle this, but be explicit)
    const { error: respDeleteError } = await supabase.from('survey_responses')
      .delete()
      .eq('survey_id', id);
    if (respDeleteError) throw respDeleteError;

    const { error: deleteError } = await supabase.from('surveys')
      .delete()
      .eq('id', id);
    if (deleteError) throw deleteError;

    res.json({ success: true, message: 'Survey deleted' });
  } catch (err) {
    console.error('[surveys] DELETE /:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/surveys/:id/responses — List responses with pagination
// ============================================================================
router.get('/:id/responses', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    // Verify survey exists
    const { data: survey, error: surveyError } = await supabase.from('surveys')
      .select('id, name, type')
      .eq('id', id)
      .single();

    if (surveyError || !survey) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    // Count total responses
    const { count, error: countError } = await supabase.from('survey_responses')
      .select('id', { count: 'exact', head: true })
      .eq('survey_id', id);
    if (countError) throw countError;

    // Fetch paginated responses
    const { data: responses, error } = await supabase.from('survey_responses')
      .select('*')
      .eq('survey_id', id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);
    if (error) throw error;

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / limitNum) || 1;

    res.json({
      survey,
      responses: responses || [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        pages: totalPages,
      },
    });
  } catch (err) {
    console.error('[surveys] GET /:id/responses error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /api/surveys/:id/respond — PUBLIC: Submit a survey response
// No auth required. Called by the tracker widget.
// ============================================================================
router.post('/:id/respond', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      session_id,
      visitor_id,
      answers = {},
      score,
      feedback,
      page_url,
    } = req.body;

    // Verify survey exists and is enabled
    const { data: survey, error: surveyError } = await supabase.from('surveys')
      .select('id, enabled')
      .eq('id', id)
      .single();

    if (surveyError || !survey) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    if (!survey.enabled) {
      return res.status(400).json({ error: 'Survey is not active' });
    }

    const responseId = uuidv4();

    const { error: insertError } = await supabase.from('survey_responses')
      .insert({
        id: responseId,
        survey_id: id,
        session_id: session_id || null,
        visitor_id: visitor_id || null,
        answers,
        score: score != null ? parseInt(score, 10) : null,
        feedback: feedback || null,
        page_url: page_url || null,
        created_at: new Date().toISOString(),
      });
    if (insertError) throw insertError;

    // Increment response_count on the survey
    const { error: updateError } = await supabase.rpc('increment_counter', {
      row_id: id,
      table_name: 'surveys',
      column_name: 'response_count',
    }).catch(() => {
      // Fallback: manual increment if RPC doesn't exist
      return supabase.from('surveys')
        .update({ response_count: (survey.response_count || 0) + 1, updated_at: new Date().toISOString() })
        .eq('id', id);
    });

    res.status(201).json({ success: true, response_id: responseId });
  } catch (err) {
    console.error('[surveys] POST /:id/respond error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/surveys/:id/stats — Aggregated stats (NPS score, avg CSAT, etc.)
// ============================================================================
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify survey exists
    const { data: survey, error: surveyError } = await supabase.from('surveys')
      .select('*')
      .eq('id', id)
      .single();

    if (surveyError || !survey) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    // Fetch all responses for aggregation
    const { data: responses, error } = await supabase.from('survey_responses')
      .select('score, feedback, answers, created_at')
      .eq('survey_id', id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const allResponses = responses || [];
    const totalResponses = allResponses.length;
    const scoredResponses = allResponses.filter(r => r.score != null);

    let stats = {
      total_responses: totalResponses,
      responses_with_score: scoredResponses.length,
      responses_with_feedback: allResponses.filter(r => r.feedback && r.feedback.trim()).length,
    };

    if (survey.type === 'nps') {
      // NPS: 0-6 = detractors, 7-8 = passives, 9-10 = promoters
      const detractors = scoredResponses.filter(r => r.score <= 6).length;
      const passives = scoredResponses.filter(r => r.score >= 7 && r.score <= 8).length;
      const promoters = scoredResponses.filter(r => r.score >= 9).length;
      const total = scoredResponses.length || 1;

      const npsScore = Math.round(((promoters - detractors) / total) * 100);

      // Score distribution (0-10)
      const distribution = {};
      for (let i = 0; i <= 10; i++) distribution[i] = 0;
      scoredResponses.forEach(r => {
        if (r.score >= 0 && r.score <= 10) distribution[r.score]++;
      });

      stats.nps_score = npsScore;
      stats.detractors = detractors;
      stats.passives = passives;
      stats.promoters = promoters;
      stats.detractor_pct = parseFloat(((detractors / total) * 100).toFixed(1));
      stats.passive_pct = parseFloat(((passives / total) * 100).toFixed(1));
      stats.promoter_pct = parseFloat(((promoters / total) * 100).toFixed(1));
      stats.distribution = distribution;

    } else if (survey.type === 'csat') {
      // CSAT: 1-5 stars, average
      const sum = scoredResponses.reduce((acc, r) => acc + r.score, 0);
      const avg = scoredResponses.length > 0 ? parseFloat((sum / scoredResponses.length).toFixed(2)) : 0;

      // Star distribution (1-5)
      const distribution = {};
      for (let i = 1; i <= 5; i++) distribution[i] = 0;
      scoredResponses.forEach(r => {
        if (r.score >= 1 && r.score <= 5) distribution[r.score]++;
      });

      stats.avg_score = avg;
      stats.distribution = distribution;
      stats.satisfaction_pct = scoredResponses.length > 0
        ? parseFloat(((scoredResponses.filter(r => r.score >= 4).length / scoredResponses.length) * 100).toFixed(1))
        : 0;

    } else if (survey.type === 'ces') {
      // CES: 1-7 scale, average
      const sum = scoredResponses.reduce((acc, r) => acc + r.score, 0);
      const avg = scoredResponses.length > 0 ? parseFloat((sum / scoredResponses.length).toFixed(2)) : 0;

      // Distribution (1-7)
      const distribution = {};
      for (let i = 1; i <= 7; i++) distribution[i] = 0;
      scoredResponses.forEach(r => {
        if (r.score >= 1 && r.score <= 7) distribution[r.score]++;
      });

      stats.avg_score = avg;
      stats.distribution = distribution;
      stats.easy_pct = scoredResponses.length > 0
        ? parseFloat(((scoredResponses.filter(r => r.score >= 5).length / scoredResponses.length) * 100).toFixed(1))
        : 0;
    }

    // Recent trend: responses per day for last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const trend = {};
    for (let d = 0; d < 30; d++) {
      const date = new Date(thirtyDaysAgo.getTime() + d * 24 * 60 * 60 * 1000);
      const key = date.toISOString().split('T')[0];
      trend[key] = 0;
    }
    allResponses.forEach(r => {
      const key = r.created_at.split('T')[0];
      if (trend[key] !== undefined) trend[key]++;
    });
    stats.trend = trend;

    res.json({ survey, stats });
  } catch (err) {
    console.error('[surveys] GET /:id/stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/surveys/:id/widget — PUBLIC: Return survey config for tracker widget
// ============================================================================
router.get('/:id/widget', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: survey, error } = await supabase.from('surveys')
      .select('id, name, type, questions, trigger_type, trigger_config, targeting, appearance, enabled')
      .eq('id', id)
      .single();

    if (error || !survey) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    if (!survey.enabled) {
      return res.status(400).json({ error: 'Survey is not active' });
    }

    res.json({ survey });
  } catch (err) {
    console.error('[surveys] GET /:id/widget error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
