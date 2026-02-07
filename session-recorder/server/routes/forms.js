'use strict';

const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// ============================================================================
// Helpers
// ============================================================================

/** Form-related event names tracked by the client-side tracker. */
const FORM_EVENTS = [
  'form_start', 'form_field_focus', 'form_field_blur',
  'form_field_change', 'form_submit', 'form_abandon'
];

/**
 * Fetch form custom events from the events table.
 * Custom events are stored with type = 12 (tracker CUSTOM_EVENT code).
 * The `data` JSONB column contains { name: '<event_name>', properties: {...} }.
 */
async function fetchFormEvents(projectId, dateFrom, dateTo) {
  // First get session IDs for this project in the date range
  let sessQuery = supabase.from('sessions')
    .select('id')
    .eq('project_id', projectId);

  if (dateFrom) sessQuery = sessQuery.gte('started_at', dateFrom);
  if (dateTo) sessQuery = sessQuery.lte('started_at', dateTo);

  const { data: sessions, error: sessError } = await sessQuery;
  if (sessError) throw sessError;

  if (!sessions || sessions.length === 0) return { events: [], sessionIds: [] };

  const sessionIds = sessions.map(s => s.id);

  // Fetch events for these sessions in batches to avoid query-string limits
  const allEvents = [];
  const BATCH = 100;

  for (let i = 0; i < sessionIds.length; i += BATCH) {
    const batch = sessionIds.slice(i, i + BATCH);
    const { data: events, error: evtError } = await supabase.from('events')
      .select('id, session_id, type, timestamp, data, url, created_at')
      .in('session_id', batch)
      .order('timestamp', { ascending: true });

    if (evtError) throw evtError;
    if (events) allEvents.push(...events);
  }

  // Filter to only form events (check data.name against known event names)
  const formEvents = allEvents.filter(e => {
    if (!e.data) return false;
    const name = e.data.name;
    return name && FORM_EVENTS.includes(name);
  });

  return { events: formEvents, sessionIds };
}

/** Extract properties from an event's data, handling both `properties` and `props` keys. */
function getProps(event) {
  if (!event || !event.data) return {};
  return event.data.properties || event.data.props || {};
}

// ============================================================================
// GET /api/forms/overview
// List all detected forms with completion rates, avg time, abandonment rate
// ============================================================================
router.get('/overview', async (req, res) => {
  try {
    const {
      project_id = 'default',
      date_from,
      date_to,
    } = req.query;

    const { events, sessionIds } = await fetchFormEvents(project_id, date_from, date_to);

    // Group events by form_id
    const formMap = {}; // form_id -> { name, sessions: Set, submits, abandons, fields: Set, totalTime, timeCount }

    for (const e of events) {
      const name = e.data.name;
      const props = getProps(e);
      const formId = props.form_id;
      if (!formId) continue;

      if (!formMap[formId]) {
        formMap[formId] = {
          form_name: props.form_name || formId,
          sessions: new Set(),
          starts: 0,
          submits: 0,
          abandons: 0,
          fields: new Set(),
          totalTimeMs: 0,
          timeCount: 0,
        };
      }

      const form = formMap[formId];
      form.sessions.add(e.session_id);

      if (name === 'form_start') {
        form.starts++;
      } else if (name === 'form_submit') {
        form.submits++;
      } else if (name === 'form_abandon') {
        form.abandons++;
      } else if (name === 'form_field_blur' || name === 'form_field_focus') {
        if (props.field_name) form.fields.add(props.field_name);
        if (name === 'form_field_blur' && props.time_spent_ms) {
          form.totalTimeMs += props.time_spent_ms;
          form.timeCount++;
        }
      } else if (name === 'form_field_change') {
        if (props.field_name) form.fields.add(props.field_name);
      }
    }

    // Build response
    const forms = Object.entries(formMap).map(([formId, f]) => {
      const interactions = f.starts || (f.submits + f.abandons) || f.sessions.size;
      const completionRate = interactions > 0
        ? Math.round((f.submits / interactions) * 1000) / 10
        : 0;
      const abandonmentRate = interactions > 0
        ? Math.round((f.abandons / interactions) * 1000) / 10
        : 0;
      const avgTimeMs = f.timeCount > 0
        ? Math.round(f.totalTimeMs / f.timeCount)
        : 0;

      return {
        form_id: formId,
        form_name: f.form_name,
        sessions: f.sessions.size,
        submissions: f.submits,
        abandonment_rate: abandonmentRate,
        completion_rate: completionRate,
        avg_completion_time_ms: avgTimeMs,
        field_count: f.fields.size,
      };
    }).sort((a, b) => b.sessions - a.sessions);

    res.json({
      forms,
      total_forms: forms.length,
      total_sessions: sessionIds.length,
    });
  } catch (err) {
    console.error('[forms] GET /overview error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/forms/:formId/fields
// Field-level analytics: time spent, drop-off rate, correction count, error rate
// ============================================================================
router.get('/:formId/fields', async (req, res) => {
  try {
    const { formId } = req.params;
    const {
      project_id = 'default',
      date_from,
      date_to,
    } = req.query;

    const { events } = await fetchFormEvents(project_id, date_from, date_to);

    // Filter to events for this specific form
    const formEvents = events.filter(e => {
      const props = getProps(e);
      return props.form_id === formId;
    });

    // Group by session to track field progression
    const sessionEvents = {};
    for (const e of formEvents) {
      if (!sessionEvents[e.session_id]) sessionEvents[e.session_id] = [];
      sessionEvents[e.session_id].push(e);
    }

    // Aggregate field-level stats
    const fieldMap = {}; // field_name -> stats
    let totalSessions = Object.keys(sessionEvents).length;
    const fieldOrder = []; // preserve encounter order

    for (const sid of Object.keys(sessionEvents)) {
      const sEvents = sessionEvents[sid];
      const fieldsInteracted = new Set();
      let hasSubmit = false;

      for (const e of sEvents) {
        const name = e.data.name;
        const props = getProps(e);
        const fieldName = props.field_name;

        if (name === 'form_submit') {
          hasSubmit = true;
          continue;
        }

        if (!fieldName) continue;
        fieldsInteracted.add(fieldName);

        if (!fieldMap[fieldName]) {
          fieldMap[fieldName] = {
            field_name: fieldName,
            field_type: props.field_type || 'text',
            interactions: 0,
            total_time_ms: 0,
            time_count: 0,
            total_corrections: 0,
            correction_events: 0,
            error_count: 0,
            focus_count: 0,
            sessions: new Set(),
          };
          fieldOrder.push(fieldName);
        }

        const field = fieldMap[fieldName];
        field.sessions.add(sid);

        if (name === 'form_field_focus') {
          field.focus_count++;
          field.interactions++;
        } else if (name === 'form_field_blur') {
          if (props.time_spent_ms) {
            field.total_time_ms += props.time_spent_ms;
            field.time_count++;
          }
          if (props.corrections) {
            field.total_corrections += props.corrections;
            field.correction_events++;
          }
          if (props.had_error) {
            field.error_count++;
          }
          field.interactions++;
        } else if (name === 'form_field_change') {
          field.interactions++;
        }
      }
    }

    // Build field-level response with drop-off rates
    const fields = fieldOrder.map((fieldName, idx) => {
      const f = fieldMap[fieldName];
      const sessionCount = f.sessions.size;
      const dropOffRate = totalSessions > 0
        ? Math.round(((totalSessions - sessionCount) / totalSessions) * 1000) / 10
        : 0;
      const avgTimeMs = f.time_count > 0
        ? Math.round(f.total_time_ms / f.time_count)
        : 0;
      const avgCorrections = f.correction_events > 0
        ? Math.round((f.total_corrections / f.correction_events) * 10) / 10
        : 0;
      const errorRate = sessionCount > 0
        ? Math.round((f.error_count / sessionCount) * 1000) / 10
        : 0;

      return {
        field_name: fieldName,
        field_type: f.field_type,
        order: idx,
        sessions: sessionCount,
        focus_count: f.focus_count,
        interactions: f.interactions,
        avg_time_ms: avgTimeMs,
        drop_off_rate: dropOffRate,
        avg_corrections: avgCorrections,
        total_corrections: f.total_corrections,
        error_count: f.error_count,
        error_rate: errorRate,
      };
    });

    res.json({
      form_id: formId,
      total_sessions: totalSessions,
      fields,
    });
  } catch (err) {
    console.error('[forms] GET /:formId/fields error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/forms/:formId/sessions
// Sessions that interacted with this form
// ============================================================================
router.get('/:formId/sessions', async (req, res) => {
  try {
    const { formId } = req.params;
    const {
      project_id = 'default',
      date_from,
      date_to,
      limit = 50,
      offset = 0,
    } = req.query;

    const { events } = await fetchFormEvents(project_id, date_from, date_to);

    // Filter to events for this specific form
    const formEvents = events.filter(e => {
      const props = getProps(e);
      return props.form_id === formId;
    });

    // Group by session
    const sessionData = {};
    for (const e of formEvents) {
      const sid = e.session_id;
      if (!sessionData[sid]) {
        sessionData[sid] = {
          session_id: sid,
          events: [],
          started: false,
          submitted: false,
          abandoned: false,
          fields_interacted: new Set(),
          total_time_ms: 0,
          first_event_ts: e.timestamp,
          last_event_ts: e.timestamp,
          url: e.url || '',
        };
      }

      const session = sessionData[sid];
      session.events.push(e);
      if (e.timestamp < session.first_event_ts) session.first_event_ts = e.timestamp;
      if (e.timestamp > session.last_event_ts) session.last_event_ts = e.timestamp;

      const name = e.data.name;
      const props = getProps(e);

      if (name === 'form_start') session.started = true;
      if (name === 'form_submit') session.submitted = true;
      if (name === 'form_abandon') session.abandoned = true;
      if (props.field_name) session.fields_interacted.add(props.field_name);
      if (props.time_spent_ms) session.total_time_ms += props.time_spent_ms;
    }

    // Build response
    const allSessions = Object.values(sessionData).map(s => ({
      session_id: s.session_id,
      submitted: s.submitted,
      abandoned: s.abandoned,
      fields_interacted: s.fields_interacted.size,
      total_time_ms: s.total_time_ms,
      duration_ms: s.last_event_ts - s.first_event_ts,
      url: s.url,
      status: s.submitted ? 'completed' : s.abandoned ? 'abandoned' : 'in_progress',
    })).sort((a, b) => {
      // Show abandoned first, then in_progress, then completed
      const order = { abandoned: 0, in_progress: 1, completed: 2 };
      return (order[a.status] || 0) - (order[b.status] || 0);
    });

    const lim = parseInt(limit, 10) || 50;
    const off = parseInt(offset, 10) || 0;
    const paginated = allSessions.slice(off, off + lim);

    res.json({
      form_id: formId,
      total: allSessions.length,
      completed: allSessions.filter(s => s.submitted).length,
      abandoned: allSessions.filter(s => s.abandoned).length,
      sessions: paginated,
    });
  } catch (err) {
    console.error('[forms] GET /:formId/sessions error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/forms/abandonment
// Form abandonment analysis: which step/field do users quit at most
// ============================================================================
router.get('/abandonment', async (req, res) => {
  try {
    const {
      project_id = 'default',
      date_from,
      date_to,
    } = req.query;

    const { events } = await fetchFormEvents(project_id, date_from, date_to);

    // Group events by session and form
    const sessionFormMap = {}; // `${session_id}::${form_id}` -> events[]
    for (const e of events) {
      const props = getProps(e);
      const formId = props.form_id;
      if (!formId) continue;
      const key = `${e.session_id}::${formId}`;
      if (!sessionFormMap[key]) sessionFormMap[key] = [];
      sessionFormMap[key].push(e);
    }

    // Analyze abandonment per form
    const formAbandonments = {}; // form_id -> { form_name, total_starts, total_abandons, field_abandons: { field_name: count } }
    const abandonmentFields = {}; // field_name -> count (global across all forms)
    let totalAbandoned = 0;
    let totalCompleted = 0;

    for (const key of Object.keys(sessionFormMap)) {
      const sEvents = sessionFormMap[key];
      const formId = key.split('::')[1];
      let formName = formId;
      let hasSubmit = false;
      let hasAbandon = false;
      let lastField = null;

      // Sort events by timestamp
      sEvents.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

      for (const e of sEvents) {
        const name = e.data.name;
        const props = getProps(e);

        if (props.form_name) formName = props.form_name;

        if (name === 'form_submit') {
          hasSubmit = true;
        } else if (name === 'form_abandon') {
          hasAbandon = true;
          // The abandon event may specify which field the user was on
          if (props.field_name) lastField = props.field_name;
        } else if (name === 'form_field_focus' || name === 'form_field_blur') {
          if (props.field_name) lastField = props.field_name;
        }
      }

      if (!formAbandonments[formId]) {
        formAbandonments[formId] = {
          form_id: formId,
          form_name: formName,
          total_starts: 0,
          total_submits: 0,
          total_abandons: 0,
          field_abandons: {},
        };
      }

      const fa = formAbandonments[formId];
      fa.total_starts++;
      fa.form_name = formName;

      if (hasSubmit) {
        fa.total_submits++;
        totalCompleted++;
      } else if (hasAbandon) {
        fa.total_abandons++;
        totalAbandoned++;
        // Track which field the user was on when abandoning
        if (lastField) {
          fa.field_abandons[lastField] = (fa.field_abandons[lastField] || 0) + 1;
          abandonmentFields[lastField] = (abandonmentFields[lastField] || 0) + 1;
        }
      }
    }

    // Build per-form abandonment breakdown
    const formAnalysis = Object.values(formAbandonments).map(fa => {
      const abandonRate = fa.total_starts > 0
        ? Math.round((fa.total_abandons / fa.total_starts) * 1000) / 10
        : 0;

      // Sort fields by abandonment count
      const fieldBreakdown = Object.entries(fa.field_abandons)
        .map(([field, count]) => ({
          field_name: field,
          abandon_count: count,
          abandon_pct: fa.total_abandons > 0
            ? Math.round((count / fa.total_abandons) * 1000) / 10
            : 0,
        }))
        .sort((a, b) => b.abandon_count - a.abandon_count);

      return {
        form_id: fa.form_id,
        form_name: fa.form_name,
        total_starts: fa.total_starts,
        total_submits: fa.total_submits,
        total_abandons: fa.total_abandons,
        abandonment_rate: abandonRate,
        field_breakdown: fieldBreakdown,
      };
    }).sort((a, b) => b.total_abandons - a.total_abandons);

    // Top abandonment fields across all forms
    const topAbandonFields = Object.entries(abandonmentFields)
      .map(([field, count]) => ({
        field_name: field,
        abandon_count: count,
        abandon_pct: totalAbandoned > 0
          ? Math.round((count / totalAbandoned) * 1000) / 10
          : 0,
      }))
      .sort((a, b) => b.abandon_count - a.abandon_count)
      .slice(0, 20);

    res.json({
      total_abandoned: totalAbandoned,
      total_completed: totalCompleted,
      overall_abandonment_rate: (totalAbandoned + totalCompleted) > 0
        ? Math.round((totalAbandoned / (totalAbandoned + totalCompleted)) * 1000) / 10
        : 0,
      forms: formAnalysis,
      top_abandon_fields: topAbandonFields,
    });
  } catch (err) {
    console.error('[forms] GET /abandonment error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
