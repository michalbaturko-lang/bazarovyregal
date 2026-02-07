'use strict';

const express = require('express');
const router = express.Router();
const supabase = require('../supabase');

// ============================================================================
// Helper utilities
// ============================================================================

/** Get ISO week string like "2026-W06" from a Date */
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/** Get Monday of the ISO week for a given date */
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Compute engagement score (0-100) from session metrics */
function engagementScore(session) {
  let score = 0;
  const dur = session.duration || 0;
  const pages = session.page_count || 0;
  const scroll = session.scroll_depth || 0;
  const events = session.event_count || 0;

  // Duration component (max 30): 0-300s scaled
  score += Math.min(30, (dur / 300) * 30);
  // Page count component (max 25): 1-10 pages scaled
  score += Math.min(25, ((pages - 1) / 9) * 25);
  // Scroll depth component (max 20): 0-100% scaled
  score += Math.min(20, (scroll / 100) * 20);
  // Event count component (max 15): 0-50 events scaled
  score += Math.min(15, (events / 50) * 15);
  // Bonus for returning visitor (max 10)
  if (session.is_returning) score += 10;

  return Math.round(Math.min(100, Math.max(0, score)));
}

/** Build a base query with project + date filters */
function buildSessionQuery(query, projectId, dateFrom, dateTo, selectCols) {
  let q = supabase.from('sessions').select(selectCols).eq('project_id', projectId);
  if (dateFrom) q = q.gte('started_at', dateFrom);
  if (dateTo) q = q.lte('started_at', dateTo);
  return q;
}

// ============================================================================
// GET /api/behavioral/cohorts
// Cohort retention analysis - group users by first visit week
// ============================================================================
router.get('/cohorts', async (req, res) => {
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

    // Map visitor -> list of session dates
    const visitorSessions = {};
    for (const s of rows) {
      if (!s.visitor_id || !s.started_at) continue;
      if (!visitorSessions[s.visitor_id]) visitorSessions[s.visitor_id] = [];
      visitorSessions[s.visitor_id].push(new Date(s.started_at));
    }

    // Determine first visit week for each visitor
    const visitorFirstWeek = {};
    for (const [vid, dates] of Object.entries(visitorSessions)) {
      dates.sort((a, b) => a - b);
      visitorFirstWeek[vid] = getISOWeek(dates[0]);
    }

    // Group visitors by cohort week
    const cohortVisitors = {};
    for (const [vid, week] of Object.entries(visitorFirstWeek)) {
      if (!cohortVisitors[week]) cohortVisitors[week] = new Set();
      cohortVisitors[week].add(vid);
    }

    // For each cohort, compute retention per subsequent week
    const cohortWeeks = Object.keys(cohortVisitors).sort();
    const allWeeks = new Set();
    for (const s of rows) {
      if (s.started_at) allWeeks.add(getISOWeek(new Date(s.started_at)));
    }
    const sortedAllWeeks = [...allWeeks].sort();

    const cohorts = cohortWeeks.map(cohortWeek => {
      const visitors = cohortVisitors[cohortWeek];
      const cohortSize = visitors.size;
      const cohortWeekIdx = sortedAllWeeks.indexOf(cohortWeek);
      if (cohortWeekIdx === -1) return null;

      const retention = [];
      for (let wi = cohortWeekIdx; wi < Math.min(sortedAllWeeks.length, cohortWeekIdx + 8); wi++) {
        const targetWeek = sortedAllWeeks[wi];
        let returnedCount = 0;
        for (const vid of visitors) {
          const vDates = visitorSessions[vid];
          const hasSessionInWeek = vDates.some(d => getISOWeek(d) === targetWeek);
          if (hasSessionInWeek) returnedCount++;
        }
        retention.push(cohortSize > 0 ? Math.round((returnedCount / cohortSize) * 100) : 0);
      }

      return {
        week: cohortWeek,
        users: cohortSize,
        retention,
      };
    }).filter(Boolean);

    res.json({ cohorts });
  } catch (err) {
    console.error('[behavioral] GET /cohorts error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/behavioral/segments-analysis
// Auto-discover behavioral segments
// ============================================================================
router.get('/segments-analysis', async (req, res) => {
  try {
    const { project_id = 'default' } = req.query;

    const { data: sessions, error } = await supabase.from('sessions')
      .select('id, visitor_id, duration, page_count, scroll_depth, event_count, has_rage_clicks, has_errors, url, started_at, device_type')
      .eq('project_id', project_id);
    if (error) throw error;

    const rows = sessions || [];

    // Group sessions by visitor
    const visitorMap = {};
    for (const s of rows) {
      const vid = s.visitor_id || s.id;
      if (!visitorMap[vid]) visitorMap[vid] = [];
      visitorMap[vid].push(s);
    }

    // Classify each visitor
    const segments = {
      power_users: { count: 0, visitors: [], avg_sessions: 0, avg_duration: 0, avg_pages: 0 },
      bouncers: { count: 0, visitors: [], top_landing_pages: {}, avg_duration: 0 },
      researchers: { count: 0, visitors: [], most_viewed_pages: {}, avg_pages: 0, avg_scroll_depth: 0 },
      converters: { count: 0, visitors: [], conversion_pages: {}, avg_duration: 0 },
      frustrated: { count: 0, visitors: [], frustration_sources: { rage_clicks: 0, errors: 0 }, avg_events: 0 },
    };

    for (const [vid, visSessions] of Object.entries(visitorMap)) {
      const sessionCount = visSessions.length;
      const avgDuration = visSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / sessionCount;
      const avgPages = visSessions.reduce((sum, s) => sum + (s.page_count || 0), 0) / sessionCount;
      const avgScroll = visSessions.reduce((sum, s) => sum + (s.scroll_depth || 0), 0) / sessionCount;
      const avgEvents = visSessions.reduce((sum, s) => sum + (s.event_count || 0), 0) / sessionCount;
      const hasRageClicks = visSessions.some(s => s.has_rage_clicks);
      const hasErrors = visSessions.some(s => s.has_errors);

      // Check for form submissions / purchase pages (conversion signals)
      const hasConversion = visSessions.some(s => {
        const url = (s.url || '').toLowerCase();
        return url.includes('thank') || url.includes('success') || url.includes('confirm') ||
               url.includes('checkout') || url.includes('purchase') || url.includes('signup');
      });

      // Power users: >5 sessions, >600s (10min) avg duration
      if (sessionCount > 5 && avgDuration > 600) {
        segments.power_users.count++;
        segments.power_users.avg_sessions += sessionCount;
        segments.power_users.avg_duration += avgDuration;
        segments.power_users.avg_pages += avgPages;
      }

      // Bouncers: single-page sessions with <10s duration
      const bounceSessions = visSessions.filter(s => (s.page_count || 0) <= 1 && (s.duration || 0) < 10);
      if (bounceSessions.length > 0 && bounceSessions.length === sessionCount) {
        segments.bouncers.count++;
        segments.bouncers.avg_duration += avgDuration;
        for (const s of bounceSessions) {
          if (s.url) {
            segments.bouncers.top_landing_pages[s.url] = (segments.bouncers.top_landing_pages[s.url] || 0) + 1;
          }
        }
      }

      // Researchers: >5 avg pages, high scroll depth (>60%), no conversion
      if (avgPages > 5 && avgScroll > 60 && !hasConversion) {
        segments.researchers.count++;
        segments.researchers.avg_pages += avgPages;
        segments.researchers.avg_scroll_depth += avgScroll;
        for (const s of visSessions) {
          if (s.url) {
            segments.researchers.most_viewed_pages[s.url] = (segments.researchers.most_viewed_pages[s.url] || 0) + 1;
          }
        }
      }

      // Converters: sessions that led to conversion pages
      if (hasConversion) {
        segments.converters.count++;
        segments.converters.avg_duration += avgDuration;
        for (const s of visSessions) {
          const url = (s.url || '').toLowerCase();
          if (url.includes('thank') || url.includes('success') || url.includes('confirm') ||
              url.includes('checkout') || url.includes('purchase') || url.includes('signup')) {
            segments.converters.conversion_pages[s.url] = (segments.converters.conversion_pages[s.url] || 0) + 1;
          }
        }
      }

      // Frustrated: sessions with rage clicks or errors
      if (hasRageClicks || hasErrors) {
        segments.frustrated.count++;
        segments.frustrated.avg_events += avgEvents;
        if (hasRageClicks) segments.frustrated.frustration_sources.rage_clicks++;
        if (hasErrors) segments.frustrated.frustration_sources.errors++;
      }
    }

    // Compute averages
    if (segments.power_users.count > 0) {
      segments.power_users.avg_sessions = Math.round(segments.power_users.avg_sessions / segments.power_users.count);
      segments.power_users.avg_duration = Math.round(segments.power_users.avg_duration / segments.power_users.count);
      segments.power_users.avg_pages = Math.round(segments.power_users.avg_pages / segments.power_users.count * 10) / 10;
    }
    if (segments.bouncers.count > 0) {
      segments.bouncers.avg_duration = Math.round(segments.bouncers.avg_duration / segments.bouncers.count);
      segments.bouncers.top_landing_pages = Object.entries(segments.bouncers.top_landing_pages)
        .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([url, count]) => ({ url, count }));
    } else {
      segments.bouncers.top_landing_pages = [];
    }
    if (segments.researchers.count > 0) {
      segments.researchers.avg_pages = Math.round(segments.researchers.avg_pages / segments.researchers.count * 10) / 10;
      segments.researchers.avg_scroll_depth = Math.round(segments.researchers.avg_scroll_depth / segments.researchers.count);
      segments.researchers.most_viewed_pages = Object.entries(segments.researchers.most_viewed_pages)
        .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([url, count]) => ({ url, count }));
    } else {
      segments.researchers.most_viewed_pages = [];
    }
    if (segments.converters.count > 0) {
      segments.converters.avg_duration = Math.round(segments.converters.avg_duration / segments.converters.count);
      segments.converters.conversion_pages = Object.entries(segments.converters.conversion_pages)
        .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([url, count]) => ({ url, count }));
    } else {
      segments.converters.conversion_pages = [];
    }
    if (segments.frustrated.count > 0) {
      segments.frustrated.avg_events = Math.round(segments.frustrated.avg_events / segments.frustrated.count);
    }

    res.json({
      total_visitors: Object.keys(visitorMap).length,
      segments,
    });
  } catch (err) {
    console.error('[behavioral] GET /segments-analysis error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/behavioral/engagement
// Engagement metrics and distributions
// ============================================================================
router.get('/engagement', async (req, res) => {
  try {
    const {
      project_id = 'default',
      date_from,
      date_to,
    } = req.query;

    let sessQuery = supabase.from('sessions')
      .select('id, visitor_id, duration, page_count, scroll_depth, event_count, url, started_at, device_type, has_rage_clicks, has_errors')
      .eq('project_id', project_id);
    if (date_from) sessQuery = sessQuery.gte('started_at', date_from);
    if (date_to) sessQuery = sessQuery.lte('started_at', date_to);

    const { data: sessions, error } = await sessQuery;
    if (error) throw error;

    const rows = sessions || [];
    if (rows.length === 0) {
      return res.json({
        engagement_score_distribution: [],
        avg_engagement_score: 0,
        avg_pages_per_session: 0,
        avg_session_duration: 0,
        avg_scroll_depth: 0,
        avg_events_per_session: 0,
        engagement_by_device: {},
        engagement_by_source: {},
        engagement_by_time_of_day: [],
        most_engaging_pages: [],
        least_engaging_pages: [],
        engagement_trend: [],
      });
    }

    // Calculate engagement scores
    const scores = rows.map(s => engagementScore(s));

    // Score distribution histogram (10 buckets: 0-9, 10-19, ..., 90-100)
    const histogram = Array(10).fill(0);
    for (const score of scores) {
      const bucket = Math.min(9, Math.floor(score / 10));
      histogram[bucket]++;
    }
    const engagement_score_distribution = histogram.map((count, i) => ({
      range: `${i * 10}-${i * 10 + 9}`,
      count,
    }));

    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const avgPages = Math.round(rows.reduce((s, r) => s + (r.page_count || 0), 0) / rows.length * 10) / 10;
    const avgDuration = Math.round(rows.reduce((s, r) => s + (r.duration || 0), 0) / rows.length);
    const avgScroll = Math.round(rows.reduce((s, r) => s + (r.scroll_depth || 0), 0) / rows.length);
    const avgEvents = Math.round(rows.reduce((s, r) => s + (r.event_count || 0), 0) / rows.length);

    // Engagement by device
    const deviceGroups = {};
    for (let i = 0; i < rows.length; i++) {
      const dev = rows[i].device_type || 'Unknown';
      if (!deviceGroups[dev]) deviceGroups[dev] = [];
      deviceGroups[dev].push(scores[i]);
    }
    const engagement_by_device = {};
    for (const [dev, devScores] of Object.entries(deviceGroups)) {
      engagement_by_device[dev] = Math.round(devScores.reduce((a, b) => a + b, 0) / devScores.length);
    }

    // Engagement by time of day (hourly)
    const hourlyScores = Array.from({ length: 24 }, () => []);
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].started_at) {
        const hour = new Date(rows[i].started_at).getHours();
        hourlyScores[hour].push(scores[i]);
      }
    }
    const engagement_by_time_of_day = hourlyScores.map((hs, hour) => ({
      hour,
      avg_score: hs.length > 0 ? Math.round(hs.reduce((a, b) => a + b, 0) / hs.length) : 0,
      sessions: hs.length,
    }));

    // Per-page engagement
    const pageStats = {};
    for (let i = 0; i < rows.length; i++) {
      const url = rows[i].url;
      if (!url) continue;
      if (!pageStats[url]) {
        pageStats[url] = { sessions: 0, totalDuration: 0, totalScroll: 0, totalScore: 0, bounces: 0 };
      }
      pageStats[url].sessions++;
      pageStats[url].totalDuration += rows[i].duration || 0;
      pageStats[url].totalScroll += rows[i].scroll_depth || 0;
      pageStats[url].totalScore += scores[i];
      if ((rows[i].page_count || 0) <= 1 && (rows[i].duration || 0) < 10) {
        pageStats[url].bounces++;
      }
    }

    const pageList = Object.entries(pageStats).map(([url, stats]) => ({
      url,
      sessions: stats.sessions,
      avg_time: Math.round(stats.totalDuration / stats.sessions),
      avg_scroll_depth: Math.round(stats.totalScroll / stats.sessions),
      bounce_rate: Math.round((stats.bounces / stats.sessions) * 100),
      engagement_score: Math.round(stats.totalScore / stats.sessions),
    }));

    const most_engaging_pages = [...pageList].sort((a, b) => b.engagement_score - a.engagement_score).slice(0, 10);
    const least_engaging_pages = [...pageList].sort((a, b) => b.bounce_rate - a.bounce_rate).slice(0, 10);

    // Engagement trend (daily avg score)
    const dayScores = {};
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].started_at) {
        const day = rows[i].started_at.substring(0, 10);
        if (!dayScores[day]) dayScores[day] = [];
        dayScores[day].push(scores[i]);
      }
    }
    const engagement_trend = Object.entries(dayScores)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, ds]) => ({
        date,
        avg_score: Math.round(ds.reduce((a, b) => a + b, 0) / ds.length),
        sessions: ds.length,
      }));

    res.json({
      engagement_score_distribution,
      avg_engagement_score: avgScore,
      avg_pages_per_session: avgPages,
      avg_session_duration: avgDuration,
      avg_scroll_depth: avgScroll,
      avg_events_per_session: avgEvents,
      engagement_by_device,
      engagement_by_time_of_day,
      most_engaging_pages,
      least_engaging_pages,
      engagement_trend,
      all_pages: pageList.sort((a, b) => b.sessions - a.sessions),
    });
  } catch (err) {
    console.error('[behavioral] GET /engagement error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/behavioral/retention
// New vs returning visitor analysis
// ============================================================================
router.get('/retention', async (req, res) => {
  try {
    const {
      project_id = 'default',
      days = 30,
    } = req.query;

    const dateFrom = new Date(Date.now() - parseInt(days) * 86400000).toISOString();

    const { data: sessions, error } = await supabase.from('sessions')
      .select('id, visitor_id, duration, page_count, scroll_depth, event_count, started_at, has_rage_clicks, has_errors, url')
      .eq('project_id', project_id)
      .gte('started_at', dateFrom);
    if (error) throw error;

    const rows = sessions || [];

    // Group by visitor
    const visitorMap = {};
    for (const s of rows) {
      const vid = s.visitor_id || s.id;
      if (!visitorMap[vid]) visitorMap[vid] = [];
      visitorMap[vid].push(s);
    }

    // Determine new vs returning based on session count within window
    let newVisitors = 0;
    let returningVisitors = 0;
    const newSessions = [];
    const returningSessions = [];
    const returnGaps = [];

    for (const [vid, visSessions] of Object.entries(visitorMap)) {
      visSessions.sort((a, b) => new Date(a.started_at) - new Date(b.started_at));

      if (visSessions.length === 1) {
        newVisitors++;
        newSessions.push(...visSessions);
      } else {
        returningVisitors++;
        returningSessions.push(...visSessions);
        // Compute return gaps between consecutive sessions
        for (let i = 1; i < visSessions.length; i++) {
          const gap = (new Date(visSessions[i].started_at) - new Date(visSessions[i - 1].started_at)) / 86400000;
          returnGaps.push(gap);
        }
      }
    }

    // Return frequency distribution
    const return_frequency = { '1_day': 0, '2_3_days': 0, '4_7_days': 0, '7_plus_days': 0 };
    for (const gap of returnGaps) {
      if (gap <= 1) return_frequency['1_day']++;
      else if (gap <= 3) return_frequency['2_3_days']++;
      else if (gap <= 7) return_frequency['4_7_days']++;
      else return_frequency['7_plus_days']++;
    }

    // Compute engagement stats for new vs returning
    function computeGroupStats(sessionList) {
      if (sessionList.length === 0) return { avg_pages: 0, avg_duration: 0, avg_scroll_depth: 0, avg_engagement: 0, conversion_rate: 0 };
      const totalPages = sessionList.reduce((s, r) => s + (r.page_count || 0), 0);
      const totalDuration = sessionList.reduce((s, r) => s + (r.duration || 0), 0);
      const totalScroll = sessionList.reduce((s, r) => s + (r.scroll_depth || 0), 0);
      const totalScore = sessionList.reduce((s, r) => s + engagementScore(r), 0);
      const conversions = sessionList.filter(s => {
        const url = (s.url || '').toLowerCase();
        return url.includes('thank') || url.includes('success') || url.includes('confirm') ||
               url.includes('checkout') || url.includes('purchase') || url.includes('signup');
      }).length;
      return {
        avg_pages: Math.round(totalPages / sessionList.length * 10) / 10,
        avg_duration: Math.round(totalDuration / sessionList.length),
        avg_scroll_depth: Math.round(totalScroll / sessionList.length),
        avg_engagement: Math.round(totalScore / sessionList.length),
        conversion_rate: Math.round((conversions / sessionList.length) * 1000) / 10,
      };
    }

    res.json({
      new_vs_returning: {
        new: newVisitors,
        returning: returningVisitors,
      },
      return_frequency,
      new_user_engagement: computeGroupStats(newSessions),
      returning_user_engagement: computeGroupStats(returningSessions),
      total_sessions: rows.length,
      total_visitors: Object.keys(visitorMap).length,
    });
  } catch (err) {
    console.error('[behavioral] GET /retention error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/behavioral/timing
// Session timing analysis (hour of day, day of week)
// ============================================================================
router.get('/timing', async (req, res) => {
  try {
    const {
      project_id = 'default',
      date_from,
      date_to,
    } = req.query;

    let sessQuery = supabase.from('sessions')
      .select('id, started_at, duration, page_count, url, has_rage_clicks, has_errors, scroll_depth, event_count')
      .eq('project_id', project_id);
    if (date_from) sessQuery = sessQuery.gte('started_at', date_from);
    if (date_to) sessQuery = sessQuery.lte('started_at', date_to);

    const { data: sessions, error } = await sessQuery;
    if (error) throw error;

    const rows = sessions || [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Sessions by hour
    const hourBuckets = Array.from({ length: 24 }, () => ({ sessions: 0, totalDuration: 0, conversions: 0 }));
    // Sessions by day of week
    const dayBuckets = Array.from({ length: 7 }, () => ({ sessions: 0, totalDuration: 0, conversions: 0 }));
    // Heatmap: 7 days x 24 hours
    const heatmap = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ sessions: 0, conversions: 0 })));

    for (const s of rows) {
      if (!s.started_at) continue;
      const d = new Date(s.started_at);
      const hour = d.getHours();
      const dayOfWeek = d.getDay();
      const isConversion = ((s.url || '').toLowerCase().match(/thank|success|confirm|checkout|purchase|signup/)) !== null;

      hourBuckets[hour].sessions++;
      hourBuckets[hour].totalDuration += s.duration || 0;
      if (isConversion) hourBuckets[hour].conversions++;

      dayBuckets[dayOfWeek].sessions++;
      dayBuckets[dayOfWeek].totalDuration += s.duration || 0;
      if (isConversion) dayBuckets[dayOfWeek].conversions++;

      heatmap[dayOfWeek][hour].sessions++;
      if (isConversion) heatmap[dayOfWeek][hour].conversions++;
    }

    const sessions_by_hour = hourBuckets.map((b, hour) => ({
      hour,
      sessions: b.sessions,
      avg_duration: b.sessions > 0 ? Math.round(b.totalDuration / b.sessions) : 0,
      conversions: b.conversions,
      conversion_rate: b.sessions > 0 ? Math.round((b.conversions / b.sessions) * 1000) / 10 : 0,
    }));

    const sessions_by_day_of_week = dayBuckets.map((b, i) => ({
      day: dayNames[i],
      day_index: i,
      sessions: b.sessions,
      avg_duration: b.sessions > 0 ? Math.round(b.totalDuration / b.sessions) : 0,
      conversions: b.conversions,
      conversion_rate: b.sessions > 0 ? Math.round((b.conversions / b.sessions) * 1000) / 10 : 0,
    }));

    // Best / worst conversion hours
    const hoursWithSessions = sessions_by_hour.filter(h => h.sessions > 0);
    const sortedByConversion = [...hoursWithSessions].sort((a, b) => b.conversion_rate - a.conversion_rate);
    const best_conversion_hours = sortedByConversion.slice(0, 3);
    const worst_conversion_hours = sortedByConversion.slice(-3).reverse();

    // Duration by hour
    const avg_duration_by_hour = sessions_by_hour.map(h => ({
      hour: h.hour,
      avg_duration: h.avg_duration,
    }));

    // Format heatmap for frontend
    const timing_heatmap = [];
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        timing_heatmap.push({
          day: dayNames[day],
          day_index: day,
          hour,
          sessions: heatmap[day][hour].sessions,
          conversions: heatmap[day][hour].conversions,
          conversion_rate: heatmap[day][hour].sessions > 0
            ? Math.round((heatmap[day][hour].conversions / heatmap[day][hour].sessions) * 1000) / 10
            : 0,
        });
      }
    }

    res.json({
      sessions_by_hour,
      sessions_by_day_of_week,
      best_conversion_hours,
      worst_conversion_hours,
      avg_duration_by_hour,
      timing_heatmap,
    });
  } catch (err) {
    console.error('[behavioral] GET /timing error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
