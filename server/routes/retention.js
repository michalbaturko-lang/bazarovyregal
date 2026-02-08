'use strict';

const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// ============================================================================
// Helper utilities
// ============================================================================

/** Get ISO date string (YYYY-MM-DD) from a Date */
function toDateStr(date) {
  return date.toISOString().slice(0, 10);
}

/** Get Monday of the ISO week for a given date */
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Get first day of the month for a given date */
function getMonthStart(date) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Get the period key for a date based on granularity */
function getPeriodKey(date, granularity) {
  const d = new Date(date);
  switch (granularity) {
    case 'daily':
      return toDateStr(d);
    case 'weekly':
      return toDateStr(getWeekStart(d));
    case 'monthly':
      return d.toISOString().slice(0, 7); // YYYY-MM
    default:
      return toDateStr(getWeekStart(d));
  }
}

/** Get period label for display */
function getPeriodLabel(index, granularity) {
  switch (granularity) {
    case 'daily':  return `Day ${index}`;
    case 'weekly':  return `Week ${index}`;
    case 'monthly': return `Month ${index}`;
    default:        return `Week ${index}`;
  }
}

/** Advance a date by one period based on granularity */
function advancePeriod(date, granularity) {
  const d = new Date(date);
  switch (granularity) {
    case 'daily':
      d.setDate(d.getDate() + 1);
      break;
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + 1);
      break;
    default:
      d.setDate(d.getDate() + 7);
  }
  return d;
}

/** Compute median from a sorted array of numbers */
function median(sorted) {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/** Parse optional segment filters from a comma-separated string */
function parseSegments(segmentsStr) {
  if (!segmentsStr) return [];
  return segmentsStr.split(',').map(s => s.trim()).filter(Boolean);
}

// ============================================================================
// GET /api/retention/cohort
// Cohort retention table - group visitors by first session date
// ============================================================================
router.get('/cohort', async (req, res) => {
  try {
    const {
      project_id = 'default',
      granularity = 'weekly',
      date_from,
      date_to,
      segments,
    } = req.query;

    let sessQuery = supabase.from('sessions')
      .select('visitor_id, started_at')
      .eq('project_id', project_id);
    if (date_from) sessQuery = sessQuery.gte('started_at', date_from);
    if (date_to) sessQuery = sessQuery.lte('started_at', date_to);

    const { data: sessions, error } = await sessQuery;
    if (error) throw error;

    const rows = sessions || [];

    // Build visitor -> list of period keys
    const visitorPeriods = {};
    const visitorFirstPeriod = {};

    for (const s of rows) {
      if (!s.visitor_id || !s.started_at) continue;
      const vid = s.visitor_id;
      const periodKey = getPeriodKey(new Date(s.started_at), granularity);

      if (!visitorPeriods[vid]) visitorPeriods[vid] = new Set();
      visitorPeriods[vid].add(periodKey);

      // Track earliest period for each visitor
      if (!visitorFirstPeriod[vid] || periodKey < visitorFirstPeriod[vid]) {
        visitorFirstPeriod[vid] = periodKey;
      }
    }

    // Group visitors by their cohort (first period)
    const cohortVisitors = {};
    for (const [vid, firstPeriod] of Object.entries(visitorFirstPeriod)) {
      if (!cohortVisitors[firstPeriod]) cohortVisitors[firstPeriod] = [];
      cohortVisitors[firstPeriod].push(vid);
    }

    // Collect all unique period keys, sorted
    const allPeriodsSet = new Set();
    for (const periods of Object.values(visitorPeriods)) {
      for (const p of periods) allPeriodsSet.add(p);
    }
    const allPeriods = [...allPeriodsSet].sort();

    // Build sorted cohort keys
    const cohortKeys = Object.keys(cohortVisitors).sort();

    // For each cohort, calculate retention across subsequent periods
    const cohorts = cohortKeys.map(cohortKey => {
      const visitors = cohortVisitors[cohortKey];
      const cohortSize = visitors.length;
      const cohortIdx = allPeriods.indexOf(cohortKey);
      if (cohortIdx === -1) return null;

      const retention = [];
      const maxPeriods = Math.min(allPeriods.length - cohortIdx, 12);

      for (let offset = 0; offset < maxPeriods; offset++) {
        const targetPeriod = allPeriods[cohortIdx + offset];
        let returnedCount = 0;
        for (const vid of visitors) {
          if (visitorPeriods[vid].has(targetPeriod)) returnedCount++;
        }
        const pct = cohortSize > 0 ? Math.round((returnedCount / cohortSize) * 100) : 0;
        retention.push(pct);
      }

      return {
        period: cohortKey,
        size: cohortSize,
        retention,
      };
    }).filter(Boolean);

    // Build period labels
    const maxRetentionLen = cohorts.length > 0
      ? Math.max(...cohorts.map(c => c.retention.length))
      : 0;
    const periods = Array.from({ length: maxRetentionLen }, (_, i) =>
      getPeriodLabel(i, granularity)
    );

    res.json({ cohorts, periods });
  } catch (err) {
    console.error('[retention] GET /cohort error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/retention/returning
// Returning vs new visitors over time
// ============================================================================
router.get('/returning', async (req, res) => {
  try {
    const {
      project_id = 'default',
      date_from,
      date_to,
      granularity = 'daily',
    } = req.query;

    // Fetch all sessions for the project (we need full history to know
    // whether a visitor is truly "new" within the window)
    let sessQuery = supabase.from('sessions')
      .select('visitor_id, started_at')
      .eq('project_id', project_id);

    const { data: allSessions, error } = await sessQuery;
    if (error) throw error;

    const rows = allSessions || [];

    // Determine each visitor's absolute first session date
    const visitorFirstSeen = {};
    for (const s of rows) {
      if (!s.visitor_id || !s.started_at) continue;
      const vid = s.visitor_id;
      if (!visitorFirstSeen[vid] || s.started_at < visitorFirstSeen[vid]) {
        visitorFirstSeen[vid] = s.started_at;
      }
    }

    // Filter sessions to date range and group by period
    const periodStats = {};
    for (const s of rows) {
      if (!s.visitor_id || !s.started_at) continue;
      if (date_from && s.started_at < date_from) continue;
      if (date_to && s.started_at > date_to) continue;

      const periodKey = getPeriodKey(new Date(s.started_at), granularity);
      if (!periodStats[periodKey]) {
        periodStats[periodKey] = { newVisitors: new Set(), returningVisitors: new Set() };
      }

      const vid = s.visitor_id;
      const firstSeenPeriod = getPeriodKey(new Date(visitorFirstSeen[vid]), granularity);

      // A visitor is "new" in their first-seen period, "returning" otherwise
      if (firstSeenPeriod === periodKey) {
        periodStats[periodKey].newVisitors.add(vid);
      } else {
        periodStats[periodKey].returningVisitors.add(vid);
      }
    }

    // Build sorted periods array
    const sortedPeriods = Object.keys(periodStats).sort();
    const periods = sortedPeriods.map(date => {
      const stats = periodStats[date];
      const newCount = stats.newVisitors.size;
      const retCount = stats.returningVisitors.size;
      const total = newCount + retCount;
      return {
        date,
        new_visitors: newCount,
        returning_visitors: retCount,
        return_rate: total > 0 ? Math.round((retCount / total) * 1000) / 10 : 0,
      };
    });

    res.json({ periods });
  } catch (err) {
    console.error('[retention] GET /returning error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/retention/frequency
// Session frequency distribution
// ============================================================================
router.get('/frequency', async (req, res) => {
  try {
    const {
      project_id = 'default',
      date_from,
      date_to,
    } = req.query;

    let sessQuery = supabase.from('sessions')
      .select('visitor_id, started_at')
      .eq('project_id', project_id);
    if (date_from) sessQuery = sessQuery.gte('started_at', date_from);
    if (date_to) sessQuery = sessQuery.lte('started_at', date_to);

    const { data: sessions, error } = await sessQuery;
    if (error) throw error;

    const rows = sessions || [];

    // Count sessions per visitor
    const visitorCounts = {};
    for (const s of rows) {
      if (!s.visitor_id) continue;
      visitorCounts[s.visitor_id] = (visitorCounts[s.visitor_id] || 0) + 1;
    }

    // Bucket definitions
    const buckets = [
      { label: '1 session', min: 1, max: 1, count: 0 },
      { label: '2 sessions', min: 2, max: 2, count: 0 },
      { label: '3-5 sessions', min: 3, max: 5, count: 0 },
      { label: '6-10 sessions', min: 6, max: 10, count: 0 },
      { label: '11-20 sessions', min: 11, max: 20, count: 0 },
      { label: '20+ sessions', min: 21, max: Infinity, count: 0 },
    ];

    let totalSessions = 0;
    let totalVisitors = 0;

    for (const count of Object.values(visitorCounts)) {
      totalVisitors++;
      totalSessions += count;
      for (const bucket of buckets) {
        if (count >= bucket.min && count <= bucket.max) {
          bucket.count++;
          break;
        }
      }
    }

    const distribution = buckets.map(b => ({
      bucket: b.label,
      count: b.count,
    }));

    const avg_sessions_per_visitor = totalVisitors > 0
      ? Math.round((totalSessions / totalVisitors) * 10) / 10
      : 0;

    // Compute median sessions per visitor
    const countsArray = Object.values(visitorCounts).sort((a, b) => a - b);
    const median_sessions_per_visitor = Math.round(median(countsArray) * 10) / 10;

    res.json({
      distribution,
      avg_sessions_per_visitor,
      median_sessions_per_visitor,
      total_visitors: totalVisitors,
      total_sessions: totalSessions,
    });
  } catch (err) {
    console.error('[retention] GET /frequency error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/retention/lifetime
// Visitor lifetime metrics
// ============================================================================
router.get('/lifetime', async (req, res) => {
  try {
    const {
      project_id = 'default',
      date_from,
      date_to,
    } = req.query;

    let sessQuery = supabase.from('sessions')
      .select('visitor_id, started_at, page_count')
      .eq('project_id', project_id);
    if (date_from) sessQuery = sessQuery.gte('started_at', date_from);
    if (date_to) sessQuery = sessQuery.lte('started_at', date_to);

    const { data: sessions, error } = await sessQuery;
    if (error) throw error;

    const rows = sessions || [];

    // Group sessions by visitor
    const visitorData = {};
    for (const s of rows) {
      if (!s.visitor_id || !s.started_at) continue;
      const vid = s.visitor_id;
      if (!visitorData[vid]) {
        visitorData[vid] = { sessions: 0, pages: 0, firstSeen: s.started_at, lastSeen: s.started_at };
      }
      visitorData[vid].sessions++;
      visitorData[vid].pages += (s.page_count || 0);
      if (s.started_at < visitorData[vid].firstSeen) visitorData[vid].firstSeen = s.started_at;
      if (s.started_at > visitorData[vid].lastSeen) visitorData[vid].lastSeen = s.started_at;
    }

    const visitors = Object.values(visitorData);
    if (visitors.length === 0) {
      return res.json({
        avg_lifetime_days: 0,
        avg_sessions: 0,
        avg_pages: 0,
        median_lifetime_days: 0,
        total_visitors: 0,
      });
    }

    // Calculate lifetime (days between first and last session)
    const lifetimes = visitors.map(v => {
      const first = new Date(v.firstSeen);
      const last = new Date(v.lastSeen);
      return Math.max(0, (last - first) / 86400000);
    });

    const totalLifetime = lifetimes.reduce((sum, d) => sum + d, 0);
    const totalSessions = visitors.reduce((sum, v) => sum + v.sessions, 0);
    const totalPages = visitors.reduce((sum, v) => sum + v.pages, 0);

    const sortedLifetimes = [...lifetimes].sort((a, b) => a - b);

    res.json({
      avg_lifetime_days: Math.round((totalLifetime / visitors.length) * 10) / 10,
      avg_sessions: Math.round((totalSessions / visitors.length) * 10) / 10,
      avg_pages: Math.round((totalPages / visitors.length) * 10) / 10,
      median_lifetime_days: Math.round(median(sortedLifetimes) * 10) / 10,
      total_visitors: visitors.length,
    });
  } catch (err) {
    console.error('[retention] GET /lifetime error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/retention/churn
// Churn analysis - visitors whose last session was > inactive_days ago
// ============================================================================
router.get('/churn', async (req, res) => {
  try {
    const {
      project_id = 'default',
      inactive_days = 30,
    } = req.query;

    const inactiveDaysNum = parseInt(inactive_days, 10) || 30;
    const cutoffDate = new Date(Date.now() - inactiveDaysNum * 86400000);

    // Fetch all sessions for this project
    const { data: sessions, error } = await supabase.from('sessions')
      .select('visitor_id, started_at')
      .eq('project_id', project_id);
    if (error) throw error;

    const rows = sessions || [];

    // Determine each visitor's last session date
    const visitorLastSeen = {};
    const visitorFirstSeen = {};
    for (const s of rows) {
      if (!s.visitor_id || !s.started_at) continue;
      const vid = s.visitor_id;
      if (!visitorLastSeen[vid] || s.started_at > visitorLastSeen[vid]) {
        visitorLastSeen[vid] = s.started_at;
      }
      if (!visitorFirstSeen[vid] || s.started_at < visitorFirstSeen[vid]) {
        visitorFirstSeen[vid] = s.started_at;
      }
    }

    const totalVisitors = Object.keys(visitorLastSeen).length;
    let totalChurned = 0;

    // Group churned visitors by the period (week) they churned
    // "Churn period" = the week of their last session
    const churnedByPeriod = {};

    for (const [vid, lastSeenStr] of Object.entries(visitorLastSeen)) {
      const lastSeen = new Date(lastSeenStr);
      if (lastSeen < cutoffDate) {
        totalChurned++;
        const churnWeek = toDateStr(getWeekStart(lastSeen));
        if (!churnedByPeriod[churnWeek]) churnedByPeriod[churnWeek] = 0;
        churnedByPeriod[churnWeek]++;
      }
    }

    const churn_rate = totalVisitors > 0
      ? Math.round((totalChurned / totalVisitors) * 1000) / 10
      : 0;

    const churned_by_period = Object.entries(churnedByPeriod)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([period, count]) => ({ period, count }));

    res.json({
      total_churned: totalChurned,
      churn_rate,
      churned_by_period,
      total_visitors: totalVisitors,
      inactive_days_threshold: inactiveDaysNum,
    });
  } catch (err) {
    console.error('[retention] GET /churn error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
