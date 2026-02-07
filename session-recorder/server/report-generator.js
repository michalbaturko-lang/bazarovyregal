'use strict';

const supabase = require('./supabase');

// ============================================================================
// Report Generator — Builds HTML email reports from analytics data
// ============================================================================

const JS_ERROR_TYPE = 11;
const ECOM_EVENTS = ['purchase', 'product_view', 'add_to_cart'];

// ============================================================================
// Data fetching helpers
// ============================================================================

/**
 * Fetch sessions within a date range for a project.
 */
async function fetchSessions(projectId, periodStart, periodEnd) {
  const { data, error } = await supabase.from('sessions')
    .select('id, visitor_id, url, duration, page_count, has_rage_clicks, has_errors, browser, device_type, country, started_at, event_count')
    .eq('project_id', projectId)
    .gte('started_at', periodStart)
    .lte('started_at', periodEnd);

  if (error) throw error;
  return data || [];
}

/**
 * Fetch error events for a batch of session IDs.
 */
async function fetchErrorEvents(sessionIds) {
  if (!sessionIds.length) return [];
  const allEvents = [];
  const BATCH = 200;

  for (let i = 0; i < sessionIds.length; i += BATCH) {
    const batch = sessionIds.slice(i, i + BATCH);
    const { data, error } = await supabase.from('events')
      .select('id, session_id, data')
      .eq('type', JS_ERROR_TYPE)
      .in('session_id', batch);

    if (error) throw error;
    if (data) allEvents.push(...data);
  }
  return allEvents;
}

/**
 * Fetch e-commerce events for a batch of session IDs.
 */
async function fetchEcommerceEvents(sessionIds) {
  if (!sessionIds.length) return [];
  const allEvents = [];
  const BATCH = 100;

  for (let i = 0; i < sessionIds.length; i += BATCH) {
    const batch = sessionIds.slice(i, i + BATCH);
    const { data, error } = await supabase.from('events')
      .select('id, session_id, data')
      .in('session_id', batch);

    if (error) throw error;
    if (data) allEvents.push(...data);
  }

  return allEvents.filter(e => {
    if (!e.data) return false;
    return e.data.name && ECOM_EVENTS.includes(e.data.name);
  });
}

/**
 * Fetch web vitals events for a batch of session IDs.
 */
async function fetchWebVitalsEvents(sessionIds) {
  if (!sessionIds.length) return [];
  const allEvents = [];
  const BATCH = 100;

  for (let i = 0; i < sessionIds.length; i += BATCH) {
    const batch = sessionIds.slice(i, i + BATCH);
    const { data, error } = await supabase.from('events')
      .select('id, session_id, data')
      .in('session_id', batch);

    if (error) throw error;
    if (data) allEvents.push(...data);
  }

  return allEvents.filter(e => {
    if (!e.data) return false;
    return e.data.name === 'web_vitals';
  });
}

// ============================================================================
// Stats computation
// ============================================================================

function computeOverviewStats(sessions) {
  const totalSessions = sessions.length;
  const visitorSet = new Set();
  let totalDuration = 0;
  let totalPageviews = 0;
  let bounceSessions = 0;

  for (const s of sessions) {
    if (s.visitor_id) visitorSet.add(s.visitor_id);
    totalDuration += s.duration || 0;
    totalPageviews += s.page_count || 0;
    if ((s.page_count || 0) <= 1 && (s.duration || 0) < 10) bounceSessions++;
  }

  return {
    totalSessions,
    uniqueVisitors: visitorSet.size,
    avgDuration: totalSessions > 0 ? Math.round(totalDuration / totalSessions) : 0,
    totalPageviews,
    bounceRate: totalSessions > 0 ? Math.round((bounceSessions / totalSessions) * 1000) / 10 : 0,
  };
}

function computeTopPages(sessions, limit = 10) {
  const urlCounts = {};
  for (const s of sessions) {
    if (s.url) {
      urlCounts[s.url] = (urlCounts[s.url] || 0) + 1;
    }
  }
  return Object.entries(urlCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([url, count]) => ({ url, count }));
}

function computeErrorStats(errorEvents) {
  const uniqueMessages = new Set();
  const affectedSessions = new Set();

  for (const evt of errorEvents) {
    const msg = (evt.data && evt.data.message) || 'Unknown error';
    uniqueMessages.add(msg);
    affectedSessions.add(evt.session_id);
  }

  return {
    totalErrors: errorEvents.length,
    uniqueErrors: uniqueMessages.size,
    affectedSessions: affectedSessions.size,
  };
}

function computePerformanceStats(webVitalsEvents) {
  const lcpValues = [];
  const clsValues = [];
  const ttfbValues = [];

  for (const evt of webVitalsEvents) {
    const props = (evt.data && (evt.data.properties || evt.data.props)) || {};
    if (props.lcp != null) lcpValues.push(Number(props.lcp));
    if (props.cls != null) clsValues.push(Number(props.cls));
    if (props.ttfb != null) ttfbValues.push(Number(props.ttfb));
  }

  function median(arr) {
    if (!arr.length) return null;
    const sorted = arr.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }

  function p75(arr) {
    if (!arr.length) return null;
    const sorted = arr.slice().sort((a, b) => a - b);
    const idx = Math.ceil(0.75 * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }

  function goodPct(arr, threshold) {
    if (!arr.length) return 0;
    const good = arr.filter(v => v <= threshold).length;
    return Math.round((good / arr.length) * 100);
  }

  // Compute an overall score (0-100) from good percentages
  const scores = [];
  if (lcpValues.length) scores.push(goodPct(lcpValues, 2500));
  if (clsValues.length) scores.push(goodPct(clsValues, 0.1));
  if (ttfbValues.length) scores.push(goodPct(ttfbValues, 800));
  const overallScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  return {
    sampleCount: webVitalsEvents.length,
    lcp: { median: median(lcpValues), p75: p75(lcpValues), goodPct: goodPct(lcpValues, 2500) },
    cls: { median: median(clsValues), p75: p75(clsValues), goodPct: goodPct(clsValues, 0.1) },
    ttfb: { median: median(ttfbValues), p75: p75(ttfbValues), goodPct: goodPct(ttfbValues, 800) },
    overallScore,
  };
}

function computeEcommerceStats(ecomEvents) {
  let totalRevenue = 0;
  let totalOrders = 0;

  for (const evt of ecomEvents) {
    if (evt.data && evt.data.name === 'purchase') {
      const props = (evt.data.properties || evt.data.props) || {};
      totalRevenue += parseFloat(props.total) || 0;
      totalOrders++;
    }
  }

  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalOrders,
    avgOrderValue: totalOrders > 0 ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0,
  };
}

// ============================================================================
// HTML Email Generation
// ============================================================================

function formatDuration(seconds) {
  if (seconds == null) return '--';
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return `${m}m ${rem}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function formatNumber(n) {
  if (n == null) return '--';
  return Number(n).toLocaleString('en-US');
}

function formatCurrency(n) {
  if (n == null) return '--';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateRange(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  const opts = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${s.toLocaleDateString('en-US', opts)} - ${e.toLocaleDateString('en-US', opts)}`;
}

function changeArrow(currentVal, prevVal) {
  if (prevVal == null || prevVal === 0) return { arrow: '', color: '#94a3b8', pct: 'N/A' };
  const change = ((currentVal - prevVal) / prevVal) * 100;
  const pct = (change >= 0 ? '+' : '') + change.toFixed(1) + '%';
  if (change > 0) return { arrow: '&#9650;', color: '#4ade80', pct };
  if (change < 0) return { arrow: '&#9660;', color: '#f87171', pct };
  return { arrow: '&#8212;', color: '#94a3b8', pct: '0%' };
}

function cssBarWidth(value, max) {
  if (!max || !value) return 0;
  return Math.min(100, Math.round((value / max) * 100));
}

function scoreColor(score) {
  if (score == null) return '#94a3b8';
  if (score >= 75) return '#4ade80';
  if (score >= 50) return '#facc15';
  return '#f87171';
}

/**
 * Generate the complete HTML email content.
 */
function buildEmailHTML(stats, prevStats, sections, periodStart, periodEnd, frequency, dashboardUrl) {
  const periodLabel = frequency === 'daily' ? 'Daily' : frequency === 'weekly' ? 'Weekly' : 'Monthly';
  const dateRange = formatDateRange(periodStart, periodEnd);

  // KPI cards for overview
  function kpiCard(label, value, prevValue, formatter) {
    const formatted = formatter ? formatter(value) : formatNumber(value);
    const ch = changeArrow(value, prevValue);
    return `
      <td style="width:25%; padding:8px;">
        <div style="background:#1e293b; border:1px solid #334155; border-radius:12px; padding:20px 16px; text-align:center;">
          <div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8; margin-bottom:8px;">${label}</div>
          <div style="font-size:26px; font-weight:700; color:#f1f5f9; margin-bottom:6px;">${formatted}</div>
          <div style="font-size:12px; color:${ch.color}; font-weight:500;">
            <span style="font-size:10px;">${ch.arrow}</span> ${ch.pct} vs prev
          </div>
        </div>
      </td>`;
  }

  // Build sections
  let overviewHTML = '';
  if (sections.includes('overview')) {
    const prev = prevStats.overview || {};
    overviewHTML = `
      <!-- KPI Cards -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          ${kpiCard('Total Sessions', stats.overview.totalSessions, prev.totalSessions)}
          ${kpiCard('Unique Visitors', stats.overview.uniqueVisitors, prev.uniqueVisitors)}
          ${kpiCard('Avg Duration', stats.overview.avgDuration, prev.avgDuration, formatDuration)}
          ${kpiCard('Bounce Rate', stats.overview.bounceRate, prev.bounceRate, v => v + '%')}
        </tr>
      </table>`;
  }

  let topPagesHTML = '';
  if (sections.includes('top_pages') && stats.topPages && stats.topPages.length > 0) {
    const maxCount = stats.topPages[0] ? stats.topPages[0].count : 1;
    const rows = stats.topPages.map((p, i) => {
      const barW = cssBarWidth(p.count, maxCount);
      return `
        <tr style="border-bottom:1px solid #1e293b;">
          <td style="padding:10px 16px; font-size:13px; color:#94a3b8; width:30px;">${i + 1}</td>
          <td style="padding:10px 16px;">
            <div style="font-size:13px; color:#e2e8f0; font-weight:500; margin-bottom:4px;">${p.url}</div>
            <div style="background:#0f172a; border-radius:4px; height:6px; overflow:hidden;">
              <div style="background:linear-gradient(90deg, #3b82f6, #6366f1); height:100%; width:${barW}%; border-radius:4px;"></div>
            </div>
          </td>
          <td style="padding:10px 16px; text-align:right; font-size:13px; color:#e2e8f0; font-weight:600; white-space:nowrap;">${formatNumber(p.count)}</td>
        </tr>`;
    }).join('');

    topPagesHTML = `
      <!-- Top Pages -->
      <div style="background:#1e293b; border:1px solid #334155; border-radius:12px; overflow:hidden; margin-bottom:24px;">
        <div style="padding:16px 20px; border-bottom:1px solid #334155;">
          <h3 style="margin:0; font-size:14px; font-weight:600; color:#f1f5f9;">Top Pages</h3>
        </div>
        <table width="100%" cellpadding="0" cellspacing="0">
          <thead>
            <tr style="background:#0f172a;">
              <th style="padding:10px 16px; text-align:left; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:#64748b; width:30px;">#</th>
              <th style="padding:10px 16px; text-align:left; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:#64748b;">Page</th>
              <th style="padding:10px 16px; text-align:right; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:#64748b;">Views</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  let errorsHTML = '';
  if (sections.includes('errors') && stats.errors) {
    const prev = prevStats.errors || {};
    const ch = changeArrow(stats.errors.totalErrors, prev.totalErrors);
    errorsHTML = `
      <!-- Errors Summary -->
      <div style="background:#1e293b; border:1px solid #334155; border-radius:12px; padding:20px; margin-bottom:24px;">
        <h3 style="margin:0 0 16px 0; font-size:14px; font-weight:600; color:#f1f5f9;">Error Summary</h3>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:8px 0;">
              <div style="background:#0f172a; border:1px solid #1e293b; border-radius:10px; padding:16px; text-align:center;">
                <div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8; margin-bottom:6px;">Total Errors</div>
                <div style="font-size:22px; font-weight:700; color:#f87171;">${formatNumber(stats.errors.totalErrors)}</div>
                <div style="font-size:11px; color:${ch.color}; margin-top:4px;">${ch.arrow} ${ch.pct}</div>
              </div>
            </td>
            <td style="width:16px;"></td>
            <td style="padding:8px 0;">
              <div style="background:#0f172a; border:1px solid #1e293b; border-radius:10px; padding:16px; text-align:center;">
                <div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8; margin-bottom:6px;">Unique Errors</div>
                <div style="font-size:22px; font-weight:700; color:#fb923c;">${formatNumber(stats.errors.uniqueErrors)}</div>
              </div>
            </td>
            <td style="width:16px;"></td>
            <td style="padding:8px 0;">
              <div style="background:#0f172a; border:1px solid #1e293b; border-radius:10px; padding:16px; text-align:center;">
                <div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8; margin-bottom:6px;">Affected Sessions</div>
                <div style="font-size:22px; font-weight:700; color:#fbbf24;">${formatNumber(stats.errors.affectedSessions)}</div>
              </div>
            </td>
          </tr>
        </table>
      </div>`;
  }

  let performanceHTML = '';
  if (sections.includes('performance') && stats.performance) {
    const perf = stats.performance;
    const sc = perf.overallScore;
    const sColor = scoreColor(sc);

    function metricRow(name, label, p75Val, goodPct, unit) {
      const displayVal = p75Val != null ? (unit === 'ms' ? `${Math.round(p75Val)}${unit}` : p75Val.toFixed(3)) : 'N/A';
      const barColor = goodPct >= 75 ? '#4ade80' : goodPct >= 50 ? '#facc15' : '#f87171';
      return `
        <tr style="border-bottom:1px solid #1e293b;">
          <td style="padding:12px 16px; font-size:13px; color:#e2e8f0; font-weight:500;">${label}</td>
          <td style="padding:12px 16px; text-align:right; font-size:13px; color:#e2e8f0; font-weight:600;">${displayVal}</td>
          <td style="padding:12px 16px; width:120px;">
            <div style="background:#0f172a; border-radius:4px; height:6px; overflow:hidden;">
              <div style="background:${barColor}; height:100%; width:${goodPct}%; border-radius:4px;"></div>
            </div>
          </td>
          <td style="padding:12px 16px; text-align:right; font-size:12px; color:${barColor}; font-weight:600;">${goodPct}% good</td>
        </tr>`;
    }

    performanceHTML = `
      <!-- Performance -->
      <div style="background:#1e293b; border:1px solid #334155; border-radius:12px; overflow:hidden; margin-bottom:24px;">
        <div style="padding:16px 20px; border-bottom:1px solid #334155; display:flex; align-items:center; justify-content:space-between;">
          <h3 style="margin:0; font-size:14px; font-weight:600; color:#f1f5f9; display:inline;">Performance Score</h3>
          ${sc != null ? `<span style="font-size:28px; font-weight:800; color:${sColor}; float:right;">${sc}</span>` : ''}
        </div>
        <table width="100%" cellpadding="0" cellspacing="0">
          <thead>
            <tr style="background:#0f172a;">
              <th style="padding:10px 16px; text-align:left; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:#64748b;">Metric</th>
              <th style="padding:10px 16px; text-align:right; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:#64748b;">P75</th>
              <th style="padding:10px 16px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:#64748b;"></th>
              <th style="padding:10px 16px; text-align:right; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:#64748b;">Rating</th>
            </tr>
          </thead>
          <tbody>
            ${metricRow('lcp', 'LCP (Largest Contentful Paint)', perf.lcp.p75, perf.lcp.goodPct, 'ms')}
            ${metricRow('cls', 'CLS (Cumulative Layout Shift)', perf.cls.p75, perf.cls.goodPct, '')}
            ${metricRow('ttfb', 'TTFB (Time to First Byte)', perf.ttfb.p75, perf.ttfb.goodPct, 'ms')}
          </tbody>
        </table>
        <div style="padding:12px 16px; text-align:center; font-size:11px; color:#64748b;">
          Based on ${formatNumber(perf.sampleCount)} performance samples
        </div>
      </div>`;
  }

  let ecommerceHTML = '';
  if (sections.includes('ecommerce') && stats.ecommerce) {
    const ecom = stats.ecommerce;
    const prevEcom = prevStats.ecommerce || {};
    const revCh = changeArrow(ecom.totalRevenue, prevEcom.totalRevenue);
    const ordCh = changeArrow(ecom.totalOrders, prevEcom.totalOrders);

    ecommerceHTML = `
      <!-- E-commerce -->
      <div style="background:#1e293b; border:1px solid #334155; border-radius:12px; padding:20px; margin-bottom:24px;">
        <h3 style="margin:0 0 16px 0; font-size:14px; font-weight:600; color:#f1f5f9;">E-commerce Revenue</h3>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:8px; width:33%;">
              <div style="background:#0f172a; border:1px solid #1e293b; border-radius:10px; padding:16px; text-align:center;">
                <div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8; margin-bottom:6px;">Revenue</div>
                <div style="font-size:22px; font-weight:700; color:#4ade80;">${formatCurrency(ecom.totalRevenue)}</div>
                <div style="font-size:11px; color:${revCh.color}; margin-top:4px;">${revCh.arrow} ${revCh.pct}</div>
              </div>
            </td>
            <td style="padding:8px; width:33%;">
              <div style="background:#0f172a; border:1px solid #1e293b; border-radius:10px; padding:16px; text-align:center;">
                <div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8; margin-bottom:6px;">Orders</div>
                <div style="font-size:22px; font-weight:700; color:#60a5fa;">${formatNumber(ecom.totalOrders)}</div>
                <div style="font-size:11px; color:${ordCh.color}; margin-top:4px;">${ordCh.arrow} ${ordCh.pct}</div>
              </div>
            </td>
            <td style="padding:8px; width:33%;">
              <div style="background:#0f172a; border:1px solid #1e293b; border-radius:10px; padding:16px; text-align:center;">
                <div style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8; margin-bottom:6px;">Avg Order</div>
                <div style="font-size:22px; font-weight:700; color:#a78bfa;">${formatCurrency(ecom.avgOrderValue)}</div>
              </div>
            </td>
          </tr>
        </table>
      </div>`;
  }

  // CTA button
  const ctaURL = dashboardUrl || '#';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Regal Master Look - ${periodLabel} Report</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0; padding:0; background-color:#0f172a; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing:antialiased;">
  <div style="max-width:640px; margin:0 auto; padding:24px 16px;">

    <!-- Header -->
    <div style="text-align:center; padding:32px 20px; background:linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border:1px solid #334155; border-radius:16px 16px 0 0; border-bottom:none;">
      <div style="display:inline-block; background:linear-gradient(135deg, #3b82f6, #6366f1); border-radius:12px; padding:10px 14px; margin-bottom:16px;">
        <span style="font-size:20px; font-weight:800; color:#ffffff; letter-spacing:-0.02em;">RML</span>
      </div>
      <h1 style="margin:0 0 4px 0; font-size:22px; font-weight:700; color:#f1f5f9;">Regal Master Look</h1>
      <h2 style="margin:0 0 8px 0; font-size:16px; font-weight:600; color:#94a3b8;">${periodLabel} Analytics Report</h2>
      <p style="margin:0; font-size:13px; color:#64748b;">${dateRange}</p>
    </div>

    <!-- Body -->
    <div style="background:#0f172a; border:1px solid #334155; border-top:none; border-radius:0 0 16px 16px; padding:24px 20px;">

      ${overviewHTML}
      ${topPagesHTML}
      ${errorsHTML}
      ${performanceHTML}
      ${ecommerceHTML}

      <!-- CTA -->
      <div style="text-align:center; padding:24px 0 8px 0;">
        <a href="${ctaURL}" style="display:inline-block; background:linear-gradient(135deg, #3b82f6, #6366f1); color:#ffffff; text-decoration:none; padding:12px 32px; border-radius:10px; font-size:14px; font-weight:600; letter-spacing:0.01em;">
          View Full Dashboard
        </a>
      </div>

    </div>

    <!-- Footer -->
    <div style="text-align:center; padding:20px 0;">
      <p style="margin:0; font-size:11px; color:#475569;">
        This report was generated automatically by Regal Master Look.
      </p>
      <p style="margin:4px 0 0 0; font-size:11px; color:#475569;">
        You can manage your report preferences in the dashboard settings.
      </p>
    </div>

  </div>
</body>
</html>`;

  return html;
}

// ============================================================================
// Main export: generateReport
// ============================================================================

/**
 * Generate a report for a given project and time period.
 *
 * @param {string} projectId
 * @param {string} periodStart - ISO date string
 * @param {string} periodEnd   - ISO date string
 * @param {string[]} sections  - Which sections to include
 * @param {string} [frequency] - 'daily', 'weekly', or 'monthly'
 * @param {string} [dashboardUrl] - URL to link back to dashboard
 * @returns {Promise<{html: string, stats: object}>}
 */
async function generateReport(projectId, periodStart, periodEnd, sections, frequency, dashboardUrl) {
  // Compute the previous period of equal length for comparison
  const startMs = new Date(periodStart).getTime();
  const endMs = new Date(periodEnd).getTime();
  const periodLength = endMs - startMs;
  const prevStart = new Date(startMs - periodLength).toISOString();
  const prevEnd = new Date(startMs).toISOString();

  // Fetch current period data
  const sessions = await fetchSessions(projectId, periodStart, periodEnd);
  const sessionIds = sessions.map(s => s.id);

  // Fetch previous period data
  const prevSessions = await fetchSessions(projectId, prevStart, prevEnd);
  const prevSessionIds = prevSessions.map(s => s.id);

  // Build stats
  const stats = {};
  const prevStats = {};

  // Always compute overview for the stats return value
  stats.overview = computeOverviewStats(sessions);
  prevStats.overview = computeOverviewStats(prevSessions);

  // Top pages
  if (sections.includes('top_pages')) {
    stats.topPages = computeTopPages(sessions);
  }

  // Errors
  if (sections.includes('errors')) {
    const errorEvents = await fetchErrorEvents(sessionIds);
    const prevErrorEvents = await fetchErrorEvents(prevSessionIds);
    stats.errors = computeErrorStats(errorEvents);
    prevStats.errors = computeErrorStats(prevErrorEvents);
  }

  // Performance
  if (sections.includes('performance')) {
    const webVitalsEvents = await fetchWebVitalsEvents(sessionIds);
    stats.performance = computePerformanceStats(webVitalsEvents);
  }

  // E-commerce
  if (sections.includes('ecommerce')) {
    const ecomEvents = await fetchEcommerceEvents(sessionIds);
    const prevEcomEvents = await fetchEcommerceEvents(prevSessionIds);
    stats.ecommerce = computeEcommerceStats(ecomEvents);
    prevStats.ecommerce = computeEcommerceStats(prevEcomEvents);
  }

  const html = buildEmailHTML(stats, prevStats, sections, periodStart, periodEnd, frequency || 'weekly', dashboardUrl);

  return { html, stats };
}

module.exports = { generateReport };
