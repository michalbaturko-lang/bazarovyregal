'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const supabase = require('../supabase');

// ============================================================================
// SQL Schema (for reference)
// ============================================================================
//
// CREATE TABLE IF NOT EXISTS goals (
//   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   project_id TEXT NOT NULL DEFAULT 'default',
//   name TEXT NOT NULL,
//   description TEXT,
//   type TEXT NOT NULL, -- url_visit, click_element, form_submit, custom_event, purchase, time_on_page, scroll_depth, page_count
//   config JSONB NOT NULL DEFAULT '{}', -- url_pattern, selector, event_name, threshold, etc.
//   value_type TEXT DEFAULT 'count', -- count, revenue, custom
//   value_amount DECIMAL DEFAULT 0, -- fixed value per conversion
//   enabled BOOLEAN DEFAULT true,
//   conversion_count INT DEFAULT 0,
//   total_value DECIMAL DEFAULT 0,
//   created_at TIMESTAMPTZ DEFAULT now()
// );
//
// CREATE TABLE IF NOT EXISTS goal_conversions (
//   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
//   session_id TEXT NOT NULL,
//   visitor_id TEXT,
//   value DECIMAL DEFAULT 0,
//   metadata JSONB DEFAULT '{}',
//   converted_at TIMESTAMPTZ DEFAULT now()
// );
//

// ============================================================================
// Helper: evaluate whether sessions/events match a goal's criteria
// ============================================================================

/**
 * Evaluate a single goal against a set of sessions and events.
 * Returns an array of { session_id, visitor_id, value, metadata } for matches.
 */
function evaluateGoal(goal, sessions, events) {
  const matches = [];
  const config = goal.config || {};

  switch (goal.type) {
    case 'url_visit': {
      const pattern = (config.url_pattern || '').toLowerCase();
      if (!pattern) break;
      for (const evt of events) {
        if (!evt.url) continue;
        const url = evt.url.toLowerCase();
        const isMatch = pattern.includes('*')
          ? new RegExp('^' + pattern.replace(/\*/g, '.*') + '$').test(url)
          : url.includes(pattern);
        if (isMatch) {
          matches.push({
            session_id: evt.session_id,
            visitor_id: null,
            value: parseFloat(goal.value_amount) || 0,
            metadata: { url: evt.url },
          });
        }
      }
      break;
    }

    case 'click_element': {
      const selector = config.selector || '';
      if (!selector) break;
      // Click events typically have type = 2 (mousedown/click) and data.selector
      for (const evt of events) {
        if (!evt.data) continue;
        const evtSelector = evt.data.selector || evt.data.target || '';
        if (evtSelector && evtSelector.includes(selector)) {
          matches.push({
            session_id: evt.session_id,
            visitor_id: null,
            value: parseFloat(goal.value_amount) || 0,
            metadata: { selector: evtSelector, url: evt.url },
          });
        }
      }
      break;
    }

    case 'form_submit': {
      const formSelector = config.selector || config.form_page || '';
      // Form submit events are custom events with name 'form_submit' or type 14
      for (const evt of events) {
        if (!evt.data) continue;
        const name = evt.data.name || '';
        if (name === 'form_submit' || name === 'formSubmit') {
          const props = evt.data.properties || evt.data.props || {};
          const matchesSelector = !formSelector ||
            (props.form_id || '').includes(formSelector) ||
            (props.selector || '').includes(formSelector) ||
            (evt.url || '').includes(formSelector);
          if (matchesSelector) {
            matches.push({
              session_id: evt.session_id,
              visitor_id: null,
              value: parseFloat(goal.value_amount) || 0,
              metadata: { form: props.form_id || formSelector, url: evt.url },
            });
          }
        }
      }
      break;
    }

    case 'custom_event': {
      const eventName = config.event_name || '';
      if (!eventName) break;
      for (const evt of events) {
        if (!evt.data) continue;
        const name = evt.data.name || '';
        if (name === eventName) {
          const props = evt.data.properties || evt.data.props || {};
          matches.push({
            session_id: evt.session_id,
            visitor_id: null,
            value: parseFloat(props.value || props.revenue || goal.value_amount) || 0,
            metadata: { event_name: name, properties: props },
          });
        }
      }
      break;
    }

    case 'purchase': {
      for (const evt of events) {
        if (!evt.data) continue;
        const name = evt.data.name || '';
        if (name === 'purchase') {
          const props = evt.data.properties || evt.data.props || {};
          const orderTotal = parseFloat(props.total || props.revenue || props.value) || 0;
          matches.push({
            session_id: evt.session_id,
            visitor_id: null,
            value: goal.value_type === 'revenue' ? orderTotal : (parseFloat(goal.value_amount) || 0),
            metadata: { order_total: orderTotal, order_id: props.order_id || props.id },
          });
        }
      }
      break;
    }

    case 'time_on_page': {
      const threshold = parseFloat(config.threshold) || 30; // seconds
      // Group events by session to compute time on page
      const sessionMap = {};
      for (const s of sessions) {
        if (s.duration && s.duration >= threshold) {
          sessionMap[s.id] = true;
        }
      }
      for (const sid of Object.keys(sessionMap)) {
        matches.push({
          session_id: sid,
          visitor_id: null,
          value: parseFloat(goal.value_amount) || 0,
          metadata: { threshold },
        });
      }
      break;
    }

    case 'scroll_depth': {
      const depthThreshold = parseFloat(config.threshold) || 75; // percentage
      // Scroll events may have data.depth or data.percentage
      const matchedSessions = new Set();
      for (const evt of events) {
        if (!evt.data) continue;
        const depth = parseFloat(evt.data.depth || evt.data.percentage || evt.data.scroll_depth || 0);
        if (depth >= depthThreshold && !matchedSessions.has(evt.session_id)) {
          matchedSessions.add(evt.session_id);
          matches.push({
            session_id: evt.session_id,
            visitor_id: null,
            value: parseFloat(goal.value_amount) || 0,
            metadata: { scroll_depth: depth, threshold: depthThreshold },
          });
        }
      }
      break;
    }

    case 'page_count': {
      const pageThreshold = parseInt(config.threshold, 10) || 3;
      for (const s of sessions) {
        const pc = s.page_count || 0;
        if (pc >= pageThreshold) {
          matches.push({
            session_id: s.id,
            visitor_id: s.visitor_id || null,
            value: parseFloat(goal.value_amount) || 0,
            metadata: { page_count: pc, threshold: pageThreshold },
          });
        }
      }
      break;
    }

    default:
      break;
  }

  // Deduplicate by session_id — one conversion per session per goal
  const seen = new Set();
  const unique = [];
  for (const m of matches) {
    if (!seen.has(m.session_id)) {
      seen.add(m.session_id);
      unique.push(m);
    }
  }

  return unique;
}

// ============================================================================
// GET /api/goals — List goals with conversion stats for date range
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const {
      project_id = 'default',
      date_from,
      date_to,
    } = req.query;

    // Fetch goals
    const { data: goals, error: goalsError } = await supabase.from('goals')
      .select('*')
      .eq('project_id', project_id)
      .order('created_at', { ascending: false });
    if (goalsError) throw goalsError;

    if (!goals || goals.length === 0) {
      return res.json({ goals: [] });
    }

    // Count total sessions in this date range for conversion rate
    let sessQuery = supabase.from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', project_id);
    if (date_from) sessQuery = sessQuery.gte('started_at', date_from);
    if (date_to) sessQuery = sessQuery.lte('started_at', date_to);
    const { count: totalSessions, error: sessError } = await sessQuery;
    if (sessError) throw sessError;

    // Compute previous period for trend comparison
    let prevTotalSessions = 0;
    if (date_from && date_to) {
      const from = new Date(date_from);
      const to = new Date(date_to);
      const span = to - from;
      const prevEnd = new Date(from.getTime() - 86400000);
      const prevStart = new Date(prevEnd.getTime() - span);

      const { count: prevCount, error: prevSessErr } = await supabase.from('sessions')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', project_id)
        .gte('started_at', prevStart.toISOString().slice(0, 10))
        .lte('started_at', prevEnd.toISOString().slice(0, 10));
      if (!prevSessErr) prevTotalSessions = prevCount || 0;
    }

    // For each goal, fetch conversion stats
    const goalIds = goals.map(g => g.id);

    const enrichedGoals = await Promise.all(goals.map(async (goal) => {
      // Current period conversions
      let convQuery = supabase.from('goal_conversions')
        .select('id, value', { count: 'exact' })
        .eq('goal_id', goal.id);
      if (date_from) convQuery = convQuery.gte('converted_at', date_from);
      if (date_to) convQuery = convQuery.lte('converted_at', date_to);

      const { data: conversions, count: convCount, error: convError } = await convQuery;
      if (convError) throw convError;

      const conversionCount = convCount || 0;
      const totalValue = (conversions || []).reduce((sum, c) => sum + (parseFloat(c.value) || 0), 0);
      const conversionRate = totalSessions > 0
        ? Math.round((conversionCount / totalSessions) * 10000) / 100
        : 0;

      // Previous period conversions for trend
      let prevConvCount = 0;
      let prevTotalValue = 0;
      if (date_from && date_to) {
        const from = new Date(date_from);
        const to = new Date(date_to);
        const span = to - from;
        const prevEnd = new Date(from.getTime() - 86400000);
        const prevStart = new Date(prevEnd.getTime() - span);

        let prevConvQuery = supabase.from('goal_conversions')
          .select('id, value', { count: 'exact' })
          .eq('goal_id', goal.id)
          .gte('converted_at', prevStart.toISOString().slice(0, 10))
          .lte('converted_at', prevEnd.toISOString().slice(0, 10));

        const { data: prevConv, count: pCount, error: pErr } = await prevConvQuery;
        if (!pErr) {
          prevConvCount = pCount || 0;
          prevTotalValue = (prevConv || []).reduce((sum, c) => sum + (parseFloat(c.value) || 0), 0);
        }
      }

      const prevConversionRate = prevTotalSessions > 0
        ? Math.round((prevConvCount / prevTotalSessions) * 10000) / 100
        : 0;

      const trend = {
        conversion_count_change: conversionCount - prevConvCount,
        conversion_rate_change: Math.round((conversionRate - prevConversionRate) * 100) / 100,
        value_change: Math.round((totalValue - prevTotalValue) * 100) / 100,
      };

      return {
        ...goal,
        conversion_count: conversionCount,
        conversion_rate: conversionRate,
        total_value: Math.round(totalValue * 100) / 100,
        trend,
      };
    }));

    res.json({ goals: enrichedGoals, total_sessions: totalSessions || 0 });
  } catch (err) {
    console.error('[goals] GET / error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /api/goals — Create a goal
// ============================================================================
router.post('/', async (req, res) => {
  try {
    const {
      name,
      description,
      type,
      config = {},
      value_type = 'count',
      value_amount = 0,
      enabled = true,
      projectId = 'default',
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }

    const validTypes = [
      'url_visit', 'click_element', 'form_submit', 'custom_event',
      'purchase', 'time_on_page', 'scroll_depth', 'page_count',
    ];
    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({
        error: `type must be one of: ${validTypes.join(', ')}`,
      });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    const { error: insertError } = await supabase.from('goals')
      .insert({
        id,
        project_id: projectId,
        name: name.trim(),
        description: description || null,
        type,
        config,
        value_type,
        value_amount: parseFloat(value_amount) || 0,
        enabled,
        conversion_count: 0,
        total_value: 0,
        created_at: now,
      });
    if (insertError) throw insertError;

    const { data: goal, error: fetchError } = await supabase.from('goals')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchError) throw fetchError;

    res.status(201).json({ goal });
  } catch (err) {
    console.error('[goals] POST / error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// PUT /api/goals/:id — Update a goal
// ============================================================================
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, type, config, value_type, value_amount, enabled } = req.body;

    const { data: existing, error: findError } = await supabase.from('goals')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !existing) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    if (type !== undefined) {
      const validTypes = [
        'url_visit', 'click_element', 'form_submit', 'custom_event',
        'purchase', 'time_on_page', 'scroll_depth', 'page_count',
      ];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          error: `type must be one of: ${validTypes.join(', ')}`,
        });
      }
    }

    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description;
    if (type !== undefined) updates.type = type;
    if (config !== undefined) updates.config = config;
    if (value_type !== undefined) updates.value_type = value_type;
    if (value_amount !== undefined) updates.value_amount = parseFloat(value_amount) || 0;
    if (enabled !== undefined) updates.enabled = enabled;

    const { error: updateError } = await supabase.from('goals')
      .update(updates)
      .eq('id', id);
    if (updateError) throw updateError;

    const { data: goal, error: fetchError } = await supabase.from('goals')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchError) throw fetchError;

    res.json({ goal });
  } catch (err) {
    console.error('[goals] PUT /:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// DELETE /api/goals/:id — Delete goal + conversions (cascade)
// ============================================================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existing, error: findError } = await supabase.from('goals')
      .select('id')
      .eq('id', id)
      .single();

    if (findError || !existing) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    // Delete conversions first (in case CASCADE is not configured)
    await supabase.from('goal_conversions')
      .delete()
      .eq('goal_id', id);

    const { error: deleteError } = await supabase.from('goals')
      .delete()
      .eq('id', id);
    if (deleteError) throw deleteError;

    res.json({ success: true, message: 'Goal deleted' });
  } catch (err) {
    console.error('[goals] DELETE /:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/goals/:id/conversions — List conversions with pagination
// ============================================================================
router.get('/:id/conversions', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      page = 1,
      limit = 25,
      date_from,
      date_to,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const offset = (pageNum - 1) * limitNum;

    // Verify goal exists
    const { data: goal, error: goalError } = await supabase.from('goals')
      .select('id, name')
      .eq('id', id)
      .single();
    if (goalError || !goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    // Count total conversions
    let countQuery = supabase.from('goal_conversions')
      .select('id', { count: 'exact', head: true })
      .eq('goal_id', id);
    if (date_from) countQuery = countQuery.gte('converted_at', date_from);
    if (date_to) countQuery = countQuery.lte('converted_at', date_to);

    const { count: totalCount, error: countError } = await countQuery;
    if (countError) throw countError;

    // Fetch conversions page
    let convQuery = supabase.from('goal_conversions')
      .select('*')
      .eq('goal_id', id)
      .order('converted_at', { ascending: false })
      .range(offset, offset + limitNum - 1);
    if (date_from) convQuery = convQuery.gte('converted_at', date_from);
    if (date_to) convQuery = convQuery.lte('converted_at', date_to);

    const { data: conversions, error: convError } = await convQuery;
    if (convError) throw convError;

    const totalPages = Math.ceil((totalCount || 0) / limitNum);

    res.json({
      conversions: conversions || [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount || 0,
        total_pages: totalPages,
      },
    });
  } catch (err) {
    console.error('[goals] GET /:id/conversions error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/goals/:id/trends — Daily conversion trend for date range
// ============================================================================
router.get('/:id/trends', async (req, res) => {
  try {
    const { id } = req.params;
    const { date_from, date_to } = req.query;

    // Verify goal exists
    const { data: goal, error: goalError } = await supabase.from('goals')
      .select('id, name')
      .eq('id', id)
      .single();
    if (goalError || !goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    // Fetch conversions in date range
    let convQuery = supabase.from('goal_conversions')
      .select('converted_at, value')
      .eq('goal_id', id)
      .order('converted_at', { ascending: true });
    if (date_from) convQuery = convQuery.gte('converted_at', date_from);
    if (date_to) convQuery = convQuery.lte('converted_at', date_to);

    const { data: conversions, error: convError } = await convQuery;
    if (convError) throw convError;

    // Group by day
    const dailyMap = {};
    for (const conv of (conversions || [])) {
      const day = conv.converted_at
        ? conv.converted_at.substring(0, 10)
        : new Date().toISOString().substring(0, 10);
      if (!dailyMap[day]) {
        dailyMap[day] = { date: day, conversions: 0, value: 0 };
      }
      dailyMap[day].conversions++;
      dailyMap[day].value += parseFloat(conv.value) || 0;
    }

    // Fill in empty days between date_from and date_to
    const trends = [];
    if (date_from && date_to) {
      const current = new Date(date_from);
      const end = new Date(date_to);
      while (current <= end) {
        const dayStr = current.toISOString().slice(0, 10);
        trends.push(dailyMap[dayStr] || { date: dayStr, conversions: 0, value: 0 });
        current.setDate(current.getDate() + 1);
      }
    } else {
      // Just return whatever we have, sorted
      trends.push(...Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)));
    }

    // Round values
    for (const t of trends) {
      t.value = Math.round(t.value * 100) / 100;
    }

    res.json({ goal_id: id, goal_name: goal.name, trends });
  } catch (err) {
    console.error('[goals] GET /:id/trends error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// POST /api/goals/evaluate — Evaluate goals against recent sessions
// ============================================================================
router.post('/evaluate', async (req, res) => {
  try {
    const {
      project_id = 'default',
      date_from,
      date_to,
    } = req.body;

    // Fetch all enabled goals
    const { data: goals, error: goalsError } = await supabase.from('goals')
      .select('*')
      .eq('project_id', project_id)
      .eq('enabled', true);
    if (goalsError) throw goalsError;

    if (!goals || goals.length === 0) {
      return res.json({ evaluated: 0, new_conversions: 0, results: [] });
    }

    // Fetch recent sessions
    let sessQuery = supabase.from('sessions')
      .select('id, visitor_id, started_at, duration, page_count')
      .eq('project_id', project_id);
    if (date_from) sessQuery = sessQuery.gte('started_at', date_from);
    if (date_to) sessQuery = sessQuery.lte('started_at', date_to);

    const { data: sessions, error: sessError } = await sessQuery;
    if (sessError) throw sessError;

    if (!sessions || sessions.length === 0) {
      return res.json({ evaluated: goals.length, new_conversions: 0, results: [] });
    }

    // Fetch events for these sessions (in batches)
    const sessionIds = sessions.map(s => s.id);
    const allEvents = [];
    const BATCH_SIZE = 500;

    for (let i = 0; i < sessionIds.length; i += BATCH_SIZE) {
      const batch = sessionIds.slice(i, i + BATCH_SIZE);
      const { data: events, error: evtError } = await supabase.from('events')
        .select('id, session_id, type, timestamp, data, url')
        .in('session_id', batch);
      if (evtError) throw evtError;
      if (events) allEvents.push(...events);
    }

    // Build session lookup for visitor_id
    const sessionLookup = {};
    for (const s of sessions) {
      sessionLookup[s.id] = s;
    }

    // Evaluate each goal
    let totalNewConversions = 0;
    const results = [];

    for (const goal of goals) {
      const matches = evaluateGoal(goal, sessions, allEvents);

      // Fetch existing conversions for this goal to avoid duplicates
      const existingSessionIds = new Set();
      if (matches.length > 0) {
        const matchSessionIds = matches.map(m => m.session_id);
        // Batch fetch existing conversions
        for (let i = 0; i < matchSessionIds.length; i += BATCH_SIZE) {
          const batch = matchSessionIds.slice(i, i + BATCH_SIZE);
          const { data: existing } = await supabase.from('goal_conversions')
            .select('session_id')
            .eq('goal_id', goal.id)
            .in('session_id', batch);
          if (existing) {
            for (const e of existing) existingSessionIds.add(e.session_id);
          }
        }
      }

      // Insert new conversions
      const newMatches = matches.filter(m => !existingSessionIds.has(m.session_id));
      let newConversions = 0;
      let newValue = 0;

      if (newMatches.length > 0) {
        const inserts = newMatches.map(m => ({
          id: uuidv4(),
          goal_id: goal.id,
          session_id: m.session_id,
          visitor_id: m.visitor_id || (sessionLookup[m.session_id] || {}).visitor_id || null,
          value: m.value,
          metadata: m.metadata,
          converted_at: new Date().toISOString(),
        }));

        const { error: insertError } = await supabase.from('goal_conversions')
          .insert(inserts);
        if (insertError) {
          console.error(`[goals] evaluate insert error for goal ${goal.id}:`, insertError);
        } else {
          newConversions = inserts.length;
          newValue = inserts.reduce((sum, ins) => sum + (parseFloat(ins.value) || 0), 0);

          // Update goal aggregate counters
          await supabase.from('goals')
            .update({
              conversion_count: (goal.conversion_count || 0) + newConversions,
              total_value: (parseFloat(goal.total_value) || 0) + newValue,
            })
            .eq('id', goal.id);
        }
      }

      totalNewConversions += newConversions;
      results.push({
        goal_id: goal.id,
        goal_name: goal.name,
        goal_type: goal.type,
        matches_found: matches.length,
        already_recorded: existingSessionIds.size,
        new_conversions: newConversions,
        new_value: Math.round(newValue * 100) / 100,
      });
    }

    res.json({
      evaluated: goals.length,
      new_conversions: totalNewConversions,
      results,
    });
  } catch (err) {
    console.error('[goals] POST /evaluate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/goals/overview — Summary: conversions today, total value, top goal
// ============================================================================
router.get('/overview', async (req, res) => {
  try {
    const { project_id = 'default' } = req.query;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStr = todayStart.toISOString();

    const yesterdayStart = new Date(todayStart.getTime() - 86400000);
    const yesterdayStr = yesterdayStart.toISOString();

    // Total conversions today
    const { data: todayConversions, error: todayErr } = await supabase.from('goal_conversions')
      .select('id, value, goal_id')
      .gte('converted_at', todayStr);
    if (todayErr) throw todayErr;

    const todayCount = (todayConversions || []).length;
    const todayValue = (todayConversions || []).reduce((sum, c) => sum + (parseFloat(c.value) || 0), 0);

    // Yesterday conversions for trend
    const { data: yesterdayConversions, error: yesterdayErr } = await supabase.from('goal_conversions')
      .select('id, value')
      .gte('converted_at', yesterdayStr)
      .lt('converted_at', todayStr);
    if (yesterdayErr) throw yesterdayErr;

    const yesterdayCount = (yesterdayConversions || []).length;
    const yesterdayValue = (yesterdayConversions || []).reduce((sum, c) => sum + (parseFloat(c.value) || 0), 0);

    // Total sessions today for conversion rate
    const { count: todaySessions, error: sessErr } = await supabase.from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', project_id)
      .gte('started_at', todayStr);
    if (sessErr) throw sessErr;

    const overallConversionRate = todaySessions > 0
      ? Math.round((todayCount / todaySessions) * 10000) / 100
      : 0;

    // Yesterday sessions for rate trend
    const { count: yesterdaySessions } = await supabase.from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', project_id)
      .gte('started_at', yesterdayStr)
      .lt('started_at', todayStr);

    const yesterdayRate = yesterdaySessions > 0
      ? Math.round((yesterdayCount / yesterdaySessions) * 10000) / 100
      : 0;

    // Top performing goal today
    const goalConvCounts = {};
    for (const c of (todayConversions || [])) {
      if (!goalConvCounts[c.goal_id]) goalConvCounts[c.goal_id] = 0;
      goalConvCounts[c.goal_id]++;
    }

    let topGoal = null;
    if (Object.keys(goalConvCounts).length > 0) {
      const topGoalId = Object.entries(goalConvCounts)
        .sort((a, b) => b[1] - a[1])[0][0];
      const topGoalCount = goalConvCounts[topGoalId];

      const { data: goalData } = await supabase.from('goals')
        .select('id, name')
        .eq('id', topGoalId)
        .single();

      if (goalData) {
        topGoal = {
          id: goalData.id,
          name: goalData.name,
          conversions: topGoalCount,
          rate: todaySessions > 0
            ? Math.round((topGoalCount / todaySessions) * 10000) / 100
            : 0,
        };
      }
    }

    res.json({
      today: {
        conversions: todayCount,
        value: Math.round(todayValue * 100) / 100,
        conversion_rate: overallConversionRate,
      },
      yesterday: {
        conversions: yesterdayCount,
        value: Math.round(yesterdayValue * 100) / 100,
        conversion_rate: yesterdayRate,
      },
      trend: {
        conversions_change: todayCount - yesterdayCount,
        value_change: Math.round((todayValue - yesterdayValue) * 100) / 100,
        rate_change: Math.round((overallConversionRate - yesterdayRate) * 100) / 100,
      },
      top_goal: topGoal,
      total_sessions_today: todaySessions || 0,
    });
  } catch (err) {
    console.error('[goals] GET /overview error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
