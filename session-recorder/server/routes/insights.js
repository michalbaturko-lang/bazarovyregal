'use strict';

const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const SessionAnalyzer = require('../analyzer');

// ============================================================================
// GET /api/insights/session/:id — Analyse a single session
// ============================================================================
router.get('/session/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch session
    const { data: session, error: sErr } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (sErr || !session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Fetch events
    const { data: events, error: eErr } = await supabase
      .from('events')
      .select('*')
      .eq('session_id', id)
      .order('timestamp', { ascending: true });

    if (eErr) throw eErr;

    const analyzer = new SessionAnalyzer(events || [], session);
    const result = analyzer.analyze();

    res.json({
      session_id: id,
      insights: result.insights,
      score: result.score,
      summary: result.summary,
    });
  } catch (err) {
    console.error('[insights] GET /session/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/insights/overview — Aggregate insights across sessions
// ============================================================================
router.get('/overview', async (req, res) => {
  try {
    const {
      project_id = 'default',
      date_from,
      date_to,
      limit: rawLimit = '100',
    } = req.query;

    const limit = Math.min(500, Math.max(1, parseInt(rawLimit, 10) || 100));

    // Fetch sessions in range
    let query = supabase
      .from('sessions')
      .select('*')
      .eq('project_id', project_id)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (date_from) query = query.gte('started_at', date_from);
    if (date_to) query = query.lte('started_at', date_to);

    const { data: sessions, error: sessErr } = await query;
    if (sessErr) throw sessErr;

    if (!sessions || sessions.length === 0) {
      return res.json({
        total_sessions: 0,
        health_score: 100,
        frustration_rate: 0,
        avg_engagement: 0,
        issues_found: 0,
        top_issues: [],
        frustration_hotspots: [],
        common_exit_pages: [],
        sessions_needing_attention: [],
        form_abandonment_rate: 0,
        dead_end_pages: [],
      });
    }

    // Analyse each session (batch fetch events)
    const sessionIds = sessions.map(s => s.id);
    const allInsights = [];
    const allScores = [];
    const issueMap = {};
    const exitPageMap = {};
    const frustrationPageMap = {};
    const formAbandonmentCount = { total: 0, abandoned: 0 };
    const deadEndMap = {};
    const sessionsWithFrustration = [];

    // Fetch events for all sessions in chunks
    const chunkSize = 10;
    for (let i = 0; i < sessionIds.length; i += chunkSize) {
      const chunk = sessionIds.slice(i, i + chunkSize);

      const { data: events, error: evtErr } = await supabase
        .from('events')
        .select('*')
        .in('session_id', chunk)
        .order('timestamp', { ascending: true });

      if (evtErr) throw evtErr;

      // Group events by session
      const eventsBySession = {};
      for (const evt of (events || [])) {
        if (!eventsBySession[evt.session_id]) eventsBySession[evt.session_id] = [];
        eventsBySession[evt.session_id].push(evt);
      }

      for (const sid of chunk) {
        const session = sessions.find(s => s.id === sid);
        const sessionEvents = eventsBySession[sid] || [];
        const analyzer = new SessionAnalyzer(sessionEvents, session);
        const result = analyzer.analyze();

        allScores.push(result.score);

        for (const insight of result.insights) {
          allInsights.push({ ...insight, session_id: sid });

          // Aggregate issues
          const issueKey = `${insight.type}::${insight.title}`;
          if (!issueMap[issueKey]) {
            issueMap[issueKey] = {
              type: insight.type,
              severity: insight.severity,
              title: insight.title,
              description: insight.description,
              recommendation: insight.recommendation,
              affected_sessions: [],
              count: 0,
              page: insight.page,
            };
          }
          issueMap[issueKey].count++;
          if (!issueMap[issueKey].affected_sessions.includes(sid)) {
            issueMap[issueKey].affected_sessions.push(sid);
          }
          // Promote severity if more sessions affected
          if (issueMap[issueKey].affected_sessions.length >= 10 && issueMap[issueKey].severity === 'medium') {
            issueMap[issueKey].severity = 'high';
          }
          if (issueMap[issueKey].affected_sessions.length >= 20 && issueMap[issueKey].severity === 'high') {
            issueMap[issueKey].severity = 'critical';
          }

          // Frustration hotspots
          if (insight.type === 'frustration' && insight.page) {
            if (!frustrationPageMap[insight.page]) {
              frustrationPageMap[insight.page] = { page: insight.page, count: 0, elements: {} };
            }
            frustrationPageMap[insight.page].count++;
            if (insight.element) {
              if (!frustrationPageMap[insight.page].elements[insight.element]) {
                frustrationPageMap[insight.page].elements[insight.element] = 0;
              }
              frustrationPageMap[insight.page].elements[insight.element]++;
            }
          }

          // Exit pages
          if (insight.type === 'exit_intent' && insight.page) {
            if (!exitPageMap[insight.page]) exitPageMap[insight.page] = 0;
            exitPageMap[insight.page]++;
          }

          // Form abandonment
          if (insight.type === 'form_abandonment') {
            formAbandonmentCount.abandoned++;
          }

          // Dead ends
          if (insight.type === 'dead_end' && insight.page) {
            if (!deadEndMap[insight.page]) deadEndMap[insight.page] = 0;
            deadEndMap[insight.page]++;
          }
        }

        // Track sessions with high frustration
        if (result.score.frustration >= 40) {
          sessionsWithFrustration.push({
            session_id: sid,
            frustration_score: result.score.frustration,
            engagement_score: result.score.engagement,
            started_at: session.started_at,
            duration: session.duration,
            country: session.country,
            top_issue: result.insights[0] ? result.insights[0].title : null,
          });
        }

        // Count sessions with form input
        const hasInput = (events || []).some(e =>
          (e.event_type ?? e.type) === 7 || (e.event_type ?? e.type) === 'input'
        );
        if (hasInput) formAbandonmentCount.total++;
      }
    }

    // Compute aggregates
    const avgEngagement = allScores.length > 0
      ? Math.round(allScores.reduce((s, sc) => s + sc.engagement, 0) / allScores.length)
      : 0;
    const avgFrustration = allScores.length > 0
      ? Math.round(allScores.reduce((s, sc) => s + sc.frustration, 0) / allScores.length)
      : 0;
    const healthScore = Math.round(Math.max(0, Math.min(100, 100 - avgFrustration * 0.6 + avgEngagement * 0.4)));
    const frustrationRate = sessions.length > 0
      ? Math.round((sessionsWithFrustration.length / sessions.length) * 100)
      : 0;

    // Sort issues by frequency
    const topIssues = Object.values(issueMap)
      .sort((a, b) => b.affected_sessions.length - a.affected_sessions.length)
      .slice(0, 20);

    // Frustration hotspots
    const frustrationHotspots = Object.values(frustrationPageMap)
      .map(fp => ({
        page: fp.page,
        count: fp.count,
        top_elements: Object.entries(fp.elements)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([el, cnt]) => ({ element: el, count: cnt })),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Common exit pages
    const commonExitPages = Object.entries(exitPageMap)
      .map(([page, count]) => ({ page, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Dead end pages
    const deadEndPages = Object.entries(deadEndMap)
      .map(([page, count]) => ({ page, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Sessions needing attention (sorted by frustration)
    const sessionsNeedingAttention = sessionsWithFrustration
      .sort((a, b) => b.frustration_score - a.frustration_score)
      .slice(0, 20);

    const formAbandonmentRate = formAbandonmentCount.total > 0
      ? Math.round((formAbandonmentCount.abandoned / formAbandonmentCount.total) * 100)
      : 0;

    res.json({
      total_sessions: sessions.length,
      health_score: healthScore,
      frustration_rate: frustrationRate,
      avg_engagement: avgEngagement,
      issues_found: topIssues.length,
      top_issues: topIssues,
      frustration_hotspots: frustrationHotspots,
      common_exit_pages: commonExitPages,
      sessions_needing_attention: sessionsNeedingAttention,
      form_abandonment_rate: formAbandonmentRate,
      dead_end_pages: deadEndPages,
    });
  } catch (err) {
    console.error('[insights] GET /overview error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/insights/page/:url — Page-level analysis
// ============================================================================
router.get('/page/:url(*)', async (req, res) => {
  try {
    const pageUrl = req.params.url ? '/' + req.params.url : '/';
    const { project_id = 'default', date_from, date_to } = req.query;

    // Find sessions that visited this page
    let sessQuery = supabase
      .from('sessions')
      .select('*')
      .eq('project_id', project_id)
      .order('started_at', { ascending: false })
      .limit(200);

    if (date_from) sessQuery = sessQuery.gte('started_at', date_from);
    if (date_to) sessQuery = sessQuery.lte('started_at', date_to);

    const { data: sessions, error: sessErr } = await sessQuery;
    if (sessErr) throw sessErr;

    if (!sessions || sessions.length === 0) {
      return res.json({
        page: pageUrl,
        views: 0,
        avg_time_on_page: 0,
        bounce_rate: 0,
        scroll_depth_distribution: {},
        click_hotspots: [],
        common_next_pages: [],
        common_prev_pages: [],
        frustration_events: [],
      });
    }

    const sessionIds = sessions.map(s => s.id);
    let totalViews = 0;
    let totalTimeOnPage = 0;
    let bounces = 0;
    const scrollDepths = [];
    const clickElements = {};
    const nextPages = {};
    const prevPages = {};
    const frustrationEvents = [];

    // Process in chunks
    const chunkSize = 10;
    for (let i = 0; i < sessionIds.length; i += chunkSize) {
      const chunk = sessionIds.slice(i, i + chunkSize);

      const { data: events, error: evtErr } = await supabase
        .from('events')
        .select('*')
        .in('session_id', chunk)
        .order('timestamp', { ascending: true });

      if (evtErr) throw evtErr;

      // Group by session
      const eventsBySession = {};
      for (const evt of (events || [])) {
        if (!eventsBySession[evt.session_id]) eventsBySession[evt.session_id] = [];
        eventsBySession[evt.session_id].push(evt);
      }

      for (const sid of chunk) {
        const sessionEvents = eventsBySession[sid] || [];

        // Extract page views
        const pageViews = sessionEvents.filter(e => {
          const t = e.event_type ?? e.type;
          return t === 1 || t === 'page_view';
        });

        for (let j = 0; j < pageViews.length; j++) {
          const pv = pageViews[j];
          const pvUrl = (pv.data && (pv.data.url || pv.data.href || pv.data.page)) ||
                        pv.url || pv.page || '';

          if (pvUrl !== pageUrl) continue;

          totalViews++;

          // Time on page
          const pageStart = new Date(pv.timestamp).getTime();
          const pageEnd = j + 1 < pageViews.length
            ? new Date(pageViews[j + 1].timestamp).getTime()
            : (sessionEvents.length > 0
              ? new Date(sessionEvents[sessionEvents.length - 1].timestamp).getTime()
              : pageStart);
          const timeOnPage = pageEnd - pageStart;
          totalTimeOnPage += timeOnPage;

          // Bounce (single page view session or <10s)
          if (pageViews.length === 1 || timeOnPage < 10000) {
            bounces++;
          }

          // Scroll depth during this page
          const scrollsOnPage = sessionEvents.filter(e => {
            const t = new Date(e.timestamp).getTime();
            const et = e.event_type ?? e.type;
            return et === 5 && t >= pageStart && t <= pageEnd;
          });
          for (const se of scrollsOnPage) {
            const d = (se.data && (se.data.scrollDepth || se.data.depth || se.data.percentage)) || 0;
            if (d > 0) scrollDepths.push(d);
          }

          // Clicks on this page
          const clicksOnPage = sessionEvents.filter(e => {
            const t = new Date(e.timestamp).getTime();
            const et = e.event_type ?? e.type;
            return (et === 2 || et === 9 || et === 10) && t >= pageStart && t <= pageEnd;
          });
          for (const ce of clicksOnPage) {
            const el = (ce.data && (ce.data.selector || ce.data.element)) || '';
            if (el) {
              if (!clickElements[el]) clickElements[el] = 0;
              clickElements[el]++;
            }
          }

          // Previous page
          if (j > 0) {
            const prevUrl = (pageViews[j - 1].data && (pageViews[j - 1].data.url || pageViews[j - 1].data.href || pageViews[j - 1].data.page)) ||
                            pageViews[j - 1].url || '';
            if (prevUrl) {
              if (!prevPages[prevUrl]) prevPages[prevUrl] = 0;
              prevPages[prevUrl]++;
            }
          }

          // Next page
          if (j + 1 < pageViews.length) {
            const nextUrl = (pageViews[j + 1].data && (pageViews[j + 1].data.url || pageViews[j + 1].data.href || pageViews[j + 1].data.page)) ||
                            pageViews[j + 1].url || '';
            if (nextUrl) {
              if (!nextPages[nextUrl]) nextPages[nextUrl] = 0;
              nextPages[nextUrl]++;
            }
          }

          // Frustration events on this page
          const frustEvents = sessionEvents.filter(e => {
            const t = new Date(e.timestamp).getTime();
            const et = e.event_type ?? e.type;
            return (et === 9 || et === 10 || et === 11) && t >= pageStart && t <= pageEnd;
          });
          for (const fe of frustEvents) {
            frustrationEvents.push({
              session_id: sid,
              type: fe.event_type ?? fe.type,
              timestamp: fe.timestamp,
              element: (fe.data && (fe.data.selector || fe.data.element)) || null,
              message: (fe.data && (fe.data.message || fe.data.error)) || null,
            });
          }
        }
      }
    }

    // Build scroll depth distribution
    const depthBuckets = { '0-25': 0, '25-50': 0, '50-75': 0, '75-100': 0 };
    for (const d of scrollDepths) {
      if (d < 25) depthBuckets['0-25']++;
      else if (d < 50) depthBuckets['25-50']++;
      else if (d < 75) depthBuckets['50-75']++;
      else depthBuckets['75-100']++;
    }

    res.json({
      page: pageUrl,
      views: totalViews,
      avg_time_on_page: totalViews > 0 ? Math.round(totalTimeOnPage / totalViews / 1000) : 0,
      bounce_rate: totalViews > 0 ? Math.round((bounces / totalViews) * 100) : 0,
      scroll_depth_distribution: depthBuckets,
      click_hotspots: Object.entries(clickElements)
        .map(([element, count]) => ({ element, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20),
      common_next_pages: Object.entries(nextPages)
        .map(([page, count]) => ({ page, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      common_prev_pages: Object.entries(prevPages)
        .map(([page, count]) => ({ page, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      frustration_events: frustrationEvents.slice(0, 50),
    });
  } catch (err) {
    console.error('[insights] GET /page/:url error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GET /api/insights/trends — Trend analysis over time
// ============================================================================
router.get('/trends', async (req, res) => {
  try {
    const {
      project_id = 'default',
      days: rawDays = '30',
    } = req.query;

    const days = Math.min(90, Math.max(1, parseInt(rawDays, 10) || 30));
    const dateFrom = new Date(Date.now() - days * 86400000).toISOString();

    // Fetch sessions
    const { data: sessions, error: sessErr } = await supabase
      .from('sessions')
      .select('*')
      .eq('project_id', project_id)
      .gte('started_at', dateFrom)
      .order('started_at', { ascending: true })
      .limit(1000);

    if (sessErr) throw sessErr;

    if (!sessions || sessions.length === 0) {
      return res.json({
        days,
        daily: [],
        top_growing_issues: [],
      });
    }

    // Group sessions by day
    const dayMap = {};
    for (let d = 0; d < days; d++) {
      const date = new Date(Date.now() - (days - 1 - d) * 86400000);
      const key = date.toISOString().slice(0, 10);
      dayMap[key] = {
        date: key,
        sessions: 0,
        frustrated_sessions: 0,
        errors: 0,
        total_engagement: 0,
        total_frustration: 0,
      };
    }

    // Fetch events and analyse
    const sessionIds = sessions.map(s => s.id);
    const issueGrowth = {};

    const chunkSize = 10;
    for (let i = 0; i < sessionIds.length; i += chunkSize) {
      const chunk = sessionIds.slice(i, i + chunkSize);

      const { data: events, error: evtErr } = await supabase
        .from('events')
        .select('*')
        .in('session_id', chunk)
        .order('timestamp', { ascending: true });

      if (evtErr) throw evtErr;

      const eventsBySession = {};
      for (const evt of (events || [])) {
        if (!eventsBySession[evt.session_id]) eventsBySession[evt.session_id] = [];
        eventsBySession[evt.session_id].push(evt);
      }

      for (const sid of chunk) {
        const session = sessions.find(s => s.id === sid);
        if (!session) continue;
        const dayKey = session.started_at ? session.started_at.slice(0, 10) : null;
        if (!dayKey || !dayMap[dayKey]) continue;

        const sessionEvents = eventsBySession[sid] || [];
        const analyzer = new SessionAnalyzer(sessionEvents, session);
        const result = analyzer.analyze();

        dayMap[dayKey].sessions++;
        dayMap[dayKey].total_engagement += result.score.engagement;
        dayMap[dayKey].total_frustration += result.score.frustration;

        if (result.score.frustration >= 40) {
          dayMap[dayKey].frustrated_sessions++;
        }

        // Count errors
        const errorCount = sessionEvents.filter(e =>
          (e.event_type ?? e.type) === 11
        ).length;
        dayMap[dayKey].errors += errorCount;

        // Track issue growth
        for (const insight of result.insights) {
          if (insight.severity === 'low' || insight.severity === 'info') continue;
          const key = `${insight.type}::${insight.title}`;
          if (!issueGrowth[key]) {
            issueGrowth[key] = {
              type: insight.type,
              title: insight.title,
              severity: insight.severity,
              first_half: 0,
              second_half: 0,
            };
          }
          const sessionDate = new Date(session.started_at);
          const midpoint = new Date(Date.now() - (days / 2) * 86400000);
          if (sessionDate < midpoint) {
            issueGrowth[key].first_half++;
          } else {
            issueGrowth[key].second_half++;
          }
        }
      }
    }

    // Compute daily averages
    const daily = Object.values(dayMap).map(d => ({
      date: d.date,
      sessions: d.sessions,
      frustrated_sessions: d.frustrated_sessions,
      frustration_rate: d.sessions > 0
        ? Math.round((d.frustrated_sessions / d.sessions) * 100)
        : 0,
      avg_engagement: d.sessions > 0
        ? Math.round(d.total_engagement / d.sessions)
        : 0,
      avg_frustration: d.sessions > 0
        ? Math.round(d.total_frustration / d.sessions)
        : 0,
      errors: d.errors,
      error_rate: d.sessions > 0
        ? Math.round((d.errors / d.sessions) * 100)
        : 0,
    }));

    // Top growing issues (issues that are increasing)
    const topGrowingIssues = Object.values(issueGrowth)
      .filter(ig => ig.second_half > ig.first_half)
      .map(ig => ({
        type: ig.type,
        title: ig.title,
        severity: ig.severity,
        growth: ig.first_half > 0
          ? Math.round(((ig.second_half - ig.first_half) / ig.first_half) * 100)
          : 100,
        recent_count: ig.second_half,
        previous_count: ig.first_half,
      }))
      .sort((a, b) => b.growth - a.growth)
      .slice(0, 10);

    res.json({
      days,
      daily,
      top_growing_issues: topGrowingIssues,
    });
  } catch (err) {
    console.error('[insights] GET /trends error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
