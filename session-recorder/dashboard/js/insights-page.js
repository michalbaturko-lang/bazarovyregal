/* ==========================================================================
   insights-page.js  -  AI Insights Dashboard
   Renders the full insights page with overview metrics, issues feed,
   page health table, score distribution, exit analysis, and trend charts.
   ========================================================================== */

const InsightsPage = (() => {

  /* ------------------------------------------------------------------
     State
  ------------------------------------------------------------------ */
  let _overviewData = null;
  let _trendsData = null;
  let _loading = true;

  /* ------------------------------------------------------------------
     Severity helpers
  ------------------------------------------------------------------ */
  const SEVERITY_CONFIG = {
    critical: { label: 'Critical', bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', dot: 'bg-red-500' },
    high:     { label: 'High',     bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30', dot: 'bg-orange-500' },
    medium:   { label: 'Medium',   bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', dot: 'bg-yellow-500' },
    low:      { label: 'Low',      bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', dot: 'bg-blue-500' },
    info:     { label: 'Info',     bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/30', dot: 'bg-slate-500' },
  };

  function severityBadge(severity) {
    const c = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.low;
    return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${c.bg} ${c.text} border ${c.border}">
      <span class="w-1.5 h-1.5 rounded-full ${c.dot}"></span>${c.label}
    </span>`;
  }

  /* ------------------------------------------------------------------
     Score gauge (SVG ring)
  ------------------------------------------------------------------ */
  function scoreGauge(value, label, color) {
    const r = 36;
    const circumference = 2 * Math.PI * r;
    const offset = circumference - (value / 100) * circumference;
    const clr = color || (value >= 70 ? '#22c55e' : value >= 40 ? '#eab308' : '#ef4444');
    return `
      <div class="flex flex-col items-center">
        <svg width="88" height="88" viewBox="0 0 88 88" class="transform -rotate-90">
          <circle cx="44" cy="44" r="${r}" fill="none" stroke="#1e293b" stroke-width="7"/>
          <circle cx="44" cy="44" r="${r}" fill="none" stroke="${clr}" stroke-width="7"
                  stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
                  style="transition: stroke-dashoffset 0.8s ease;"/>
        </svg>
        <span class="text-xl font-bold text-white -mt-14">${value}</span>
        <span class="text-xs text-slate-400 mt-8">${label}</span>
      </div>`;
  }

  /* ------------------------------------------------------------------
     Sparkline (tiny inline SVG)
  ------------------------------------------------------------------ */
  function sparkline(values, color) {
    if (!values || values.length < 2) return '';
    const w = 80, h = 24;
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    const points = values.map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" class="inline-block ml-2 opacity-60">
      <polyline points="${points}" fill="none" stroke="${color || '#3b82f6'}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  /* ------------------------------------------------------------------
     Health color
  ------------------------------------------------------------------ */
  function healthColor(score) {
    if (score >= 70) return 'text-green-400';
    if (score >= 40) return 'text-yellow-400';
    return 'text-red-400';
  }

  function healthBg(score) {
    if (score >= 70) return 'bg-green-500/10 border-green-500/20';
    if (score >= 40) return 'bg-yellow-500/10 border-yellow-500/20';
    return 'bg-red-500/10 border-red-500/20';
  }

  /* ------------------------------------------------------------------
     Main render
  ------------------------------------------------------------------ */
  async function render(container) {
    container.innerHTML = Components.loading();
    _loading = true;

    try {
      const dateRange = App.state.dateRange;
      const [overview, trends] = await Promise.all([
        App.api(`/insights/overview?project_id=${App.state.project}&date_from=${dateRange.start}&date_to=${dateRange.end}`).catch(() => null),
        App.api(`/insights/trends?project_id=${App.state.project}&days=30`).catch(() => null),
      ]);

      _overviewData = overview;
      _trendsData = trends;
    } catch (e) {
      console.warn('[InsightsPage] API unavailable, using mock data');
    }

    // Fall back to mock if API failed
    if (!_overviewData) _overviewData = _generateMockOverview();
    if (!_trendsData) _trendsData = _generateMockTrends();

    _loading = false;
    _renderPage(container);
  }

  function _renderPage(container) {
    const d = _overviewData;
    const t = _trendsData;

    // Trend sparkline data
    const engagementValues = t.daily ? t.daily.map(d => d.avg_engagement) : [];
    const frustrationValues = t.daily ? t.daily.map(d => d.frustration_rate) : [];
    const errorValues = t.daily ? t.daily.map(d => d.errors) : [];

    container.innerHTML = `
      <div class="space-y-6">

        <!-- Header -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"/>
              </svg>
            </div>
            <div>
              <h2 class="text-lg font-semibold text-white">AI Insights</h2>
              <p class="text-sm text-slate-400">Automated analysis of ${d.total_sessions} sessions</p>
            </div>
          </div>
          <div class="text-xs text-slate-500">${App.state.dateRange.start} to ${App.state.dateRange.end}</div>
        </div>

        <!-- Top Metric Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          <!-- Health Score -->
          <div class="bg-slate-800 rounded-xl p-5 border border-slate-700/50">
            <div class="flex items-start justify-between mb-3">
              <span class="text-xs font-medium text-slate-400 uppercase tracking-wider">Health Score</span>
              <svg class="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/>
              </svg>
            </div>
            <div class="text-3xl font-bold ${healthColor(d.health_score)}">${d.health_score}</div>
            <div class="flex items-center gap-1 mt-1">
              <span class="text-xs text-slate-500">out of 100</span>
              ${sparkline(engagementValues, d.health_score >= 70 ? '#22c55e' : '#eab308')}
            </div>
          </div>

          <!-- Frustration Rate -->
          <div class="bg-slate-800 rounded-xl p-5 border border-slate-700/50">
            <div class="flex items-start justify-between mb-3">
              <span class="text-xs font-medium text-slate-400 uppercase tracking-wider">Frustration Rate</span>
              <svg class="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z"/>
              </svg>
            </div>
            <div class="text-3xl font-bold ${d.frustration_rate > 30 ? 'text-red-400' : d.frustration_rate > 15 ? 'text-yellow-400' : 'text-green-400'}">${d.frustration_rate}%</div>
            <div class="flex items-center gap-1 mt-1">
              <span class="text-xs text-slate-500">of sessions</span>
              ${sparkline(frustrationValues, '#ef4444')}
            </div>
          </div>

          <!-- Avg Engagement -->
          <div class="bg-slate-800 rounded-xl p-5 border border-slate-700/50">
            <div class="flex items-start justify-between mb-3">
              <span class="text-xs font-medium text-slate-400 uppercase tracking-wider">Avg Engagement</span>
              <svg class="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/>
              </svg>
            </div>
            <div class="text-3xl font-bold ${d.avg_engagement >= 60 ? 'text-green-400' : d.avg_engagement >= 35 ? 'text-yellow-400' : 'text-red-400'}">${d.avg_engagement}</div>
            <div class="flex items-center gap-1 mt-1">
              <span class="text-xs text-slate-500">out of 100</span>
              ${sparkline(engagementValues, '#3b82f6')}
            </div>
          </div>

          <!-- Issues Found -->
          <div class="bg-slate-800 rounded-xl p-5 border border-slate-700/50">
            <div class="flex items-start justify-between mb-3">
              <span class="text-xs font-medium text-slate-400 uppercase tracking-wider">Issues Found</span>
              <svg class="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
              </svg>
            </div>
            <div class="text-3xl font-bold text-white">${d.issues_found}</div>
            <div class="flex items-center gap-1 mt-1">
              <span class="text-xs text-slate-500">unique issues</span>
              ${sparkline(errorValues, '#f59e0b')}
            </div>
          </div>

        </div>

        <!-- Two-column layout: Issues Feed + Score Distribution -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

          <!-- Issues Feed (2/3) -->
          <div class="lg:col-span-2 space-y-3">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-white">Priority Issues</h3>
              <span class="text-xs text-slate-500">${d.top_issues ? d.top_issues.length : 0} issues</span>
            </div>
            <div id="insights-issues-feed" class="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              ${_renderIssuesFeed(d.top_issues || [])}
            </div>
          </div>

          <!-- Right column: Score Distribution + Sessions needing attention -->
          <div class="space-y-6">
            <!-- Score Distribution -->
            <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
              <h3 class="text-sm font-semibold text-white mb-4">Session Score Overview</h3>
              <div class="flex justify-around">
                ${scoreGauge(d.avg_engagement, 'Engagement', '#3b82f6')}
                ${scoreGauge(d.frustration_rate, 'Frustration', d.frustration_rate > 30 ? '#ef4444' : '#eab308')}
                ${scoreGauge(d.form_abandonment_rate || 0, 'Form Drop', '#f59e0b')}
              </div>
            </div>

            <!-- Sessions Needing Attention -->
            <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
              <h3 class="text-sm font-semibold text-white mb-3">Sessions Needing Attention</h3>
              <div class="space-y-2 max-h-[300px] overflow-y-auto">
                ${_renderAttentionSessions(d.sessions_needing_attention || [])}
              </div>
            </div>
          </div>

        </div>

        <!-- Page Health Table -->
        <div>
          <h3 class="text-sm font-semibold text-white mb-3">Frustration Hotspots</h3>
          ${_renderFrustrationHotspots(d.frustration_hotspots || [])}
        </div>

        <!-- Exit Analysis -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Exit Pages -->
          <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
            <h3 class="text-sm font-semibold text-white mb-4">Top Exit Pages</h3>
            ${_renderExitPages(d.common_exit_pages || [])}
          </div>

          <!-- Dead End Pages -->
          <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
            <h3 class="text-sm font-semibold text-white mb-4">Dead End Pages</h3>
            ${_renderDeadEndPages(d.dead_end_pages || [])}
          </div>
        </div>

        <!-- Trend Charts -->
        <div>
          <h3 class="text-sm font-semibold text-white mb-3">Trends (Last ${t.days || 30} Days)</h3>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
              <h4 class="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Frustration & Engagement</h4>
              <div style="height:250px; position:relative;">
                <canvas id="insights-trend-chart"></canvas>
              </div>
            </div>
            <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
              <h4 class="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Errors Over Time</h4>
              <div style="height:250px; position:relative;">
                <canvas id="insights-error-chart"></canvas>
              </div>
            </div>
          </div>
        </div>

        <!-- Growing Issues -->
        ${t.top_growing_issues && t.top_growing_issues.length > 0 ? `
        <div>
          <h3 class="text-sm font-semibold text-white mb-3">Growing Issues</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            ${t.top_growing_issues.map(issue => `
              <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-4">
                <div class="flex items-center gap-2 mb-2">
                  ${severityBadge(issue.severity)}
                  <span class="text-green-400 text-xs font-semibold">+${issue.growth}%</span>
                </div>
                <p class="text-sm text-white font-medium mb-1">${_escHtml(issue.title)}</p>
                <p class="text-xs text-slate-400">
                  ${issue.recent_count} occurrences recently vs ${issue.previous_count} previously
                </p>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}

      </div>
    `;

    // Render charts after DOM is ready
    requestAnimationFrame(() => {
      _renderTrendChart(t);
      _renderErrorChart(t);
    });
  }

  /* ------------------------------------------------------------------
     Issues Feed renderer
  ------------------------------------------------------------------ */
  function _renderIssuesFeed(issues) {
    if (!issues || issues.length === 0) {
      return `<div class="bg-slate-800 rounded-xl border border-slate-700/50 p-8 text-center">
        <svg class="w-10 h-10 text-green-500/50 mx-auto mb-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p class="text-sm text-slate-400">No issues detected. Your site is performing well!</p>
      </div>`;
    }

    return issues.map(issue => {
      const sessCount = issue.affected_sessions ? issue.affected_sessions.length : 0;
      return `
        <div class="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4 hover:border-slate-600/50 transition-colors">
          <div class="flex items-start justify-between gap-3 mb-2">
            <div class="flex items-center gap-2 flex-wrap">
              ${severityBadge(issue.severity)}
              <span class="text-xs text-slate-500">${_escHtml(issue.type)}</span>
            </div>
            <span class="text-xs text-slate-500 whitespace-nowrap">${sessCount} session${sessCount !== 1 ? 's' : ''}</span>
          </div>
          <h4 class="text-sm font-medium text-white mb-1">${_escHtml(issue.title)}</h4>
          <p class="text-xs text-slate-400 mb-2 line-clamp-2">${_escHtml(issue.description)}</p>
          ${issue.recommendation ? `
          <div class="flex items-start gap-2 bg-slate-900/50 rounded-lg p-2.5 mt-2">
            <svg class="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"/>
            </svg>
            <span class="text-xs text-blue-300/80">${_escHtml(issue.recommendation)}</span>
          </div>
          ` : ''}
          ${sessCount > 0 && issue.affected_sessions ? `
          <div class="mt-2">
            <button onclick="InsightsPage.viewAffectedSessions('${_escHtml(issue.title)}')"
                    class="text-xs text-blue-400 hover:text-blue-300 transition-colors">
              View affected sessions &rarr;
            </button>
          </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  /* ------------------------------------------------------------------
     Attention Sessions renderer
  ------------------------------------------------------------------ */
  function _renderAttentionSessions(sessions) {
    if (!sessions || sessions.length === 0) {
      return '<p class="text-xs text-slate-500 text-center py-4">No sessions need attention.</p>';
    }

    return sessions.slice(0, 10).map(s => `
      <a href="#sessions/${s.session_id}" class="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-700/40 transition-colors group">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-2 h-2 rounded-full flex-shrink-0 ${s.frustration_score >= 70 ? 'bg-red-500' : s.frustration_score >= 40 ? 'bg-orange-500' : 'bg-yellow-500'}"></div>
          <div class="min-w-0">
            <div class="text-xs font-medium text-slate-300 truncate group-hover:text-white">${s.session_id.substring(0, 8)}...</div>
            <div class="text-[10px] text-slate-500">${s.top_issue ? _escHtml(s.top_issue).substring(0, 40) : 'High frustration'}</div>
          </div>
        </div>
        <div class="text-right flex-shrink-0 ml-2">
          <div class="text-xs font-semibold ${s.frustration_score >= 70 ? 'text-red-400' : 'text-orange-400'}">${s.frustration_score}</div>
          <div class="text-[10px] text-slate-500">frust.</div>
        </div>
      </a>
    `).join('');
  }

  /* ------------------------------------------------------------------
     Frustration Hotspots table
  ------------------------------------------------------------------ */
  function _renderFrustrationHotspots(hotspots) {
    if (!hotspots || hotspots.length === 0) {
      return `<div class="bg-slate-800 rounded-xl border border-slate-700/50 p-6 text-center">
        <p class="text-sm text-slate-400">No frustration hotspots detected.</p>
      </div>`;
    }

    const rows = hotspots.map(h => {
      const barWidth = Math.min(100, (h.count / (hotspots[0].count || 1)) * 100);
      const topEls = (h.top_elements || []).slice(0, 3).map(e =>
        `<span class="inline-block bg-slate-700 rounded px-1.5 py-0.5 text-[10px] text-slate-300 mr-1">${_escHtml(e.element).substring(0, 30)}</span>`
      ).join('');
      const frustColor = h.count >= 10 ? 'bg-red-500' : h.count >= 5 ? 'bg-orange-500' : 'bg-yellow-500';

      return `<tr class="border-t border-slate-700/50 hover:bg-slate-700/30 transition-colors">
        <td class="px-4 py-3 text-sm">
          <span class="text-slate-300 font-medium">${_escHtml(h.page)}</span>
        </td>
        <td class="px-4 py-3 text-sm text-right">
          <span class="text-white font-semibold">${h.count}</span>
        </td>
        <td class="px-4 py-3">
          <div class="w-full bg-slate-700/50 rounded-full h-2">
            <div class="${frustColor} h-2 rounded-full" style="width:${barWidth}%"></div>
          </div>
        </td>
        <td class="px-4 py-3 text-sm">${topEls || '<span class="text-slate-500 text-xs">-</span>'}</td>
      </tr>`;
    }).join('');

    return `<div class="overflow-x-auto rounded-xl border border-slate-700/50">
      <table class="w-full">
        <thead class="bg-slate-800/80">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Page</th>
            <th class="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Events</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider" style="width:200px">Severity</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Top Elements</th>
          </tr>
        </thead>
        <tbody class="bg-slate-800/30">${rows}</tbody>
      </table>
    </div>`;
  }

  /* ------------------------------------------------------------------
     Exit Pages renderer
  ------------------------------------------------------------------ */
  function _renderExitPages(pages) {
    if (!pages || pages.length === 0) {
      return '<p class="text-xs text-slate-500 text-center py-4">No exit page data available.</p>';
    }

    const maxCount = pages[0].count || 1;
    return `<div class="space-y-3">
      ${pages.slice(0, 8).map(p => {
        const pct = Math.round((p.count / maxCount) * 100);
        return `
          <div>
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs text-slate-300 truncate max-w-[70%]">${_escHtml(p.page)}</span>
              <span class="text-xs text-slate-400 font-medium">${p.count} exits</span>
            </div>
            <div class="w-full bg-slate-700/50 rounded-full h-1.5">
              <div class="bg-red-500/70 h-1.5 rounded-full" style="width:${pct}%"></div>
            </div>
          </div>
        `;
      }).join('')}
    </div>`;
  }

  /* ------------------------------------------------------------------
     Dead End Pages renderer
  ------------------------------------------------------------------ */
  function _renderDeadEndPages(pages) {
    if (!pages || pages.length === 0) {
      return '<p class="text-xs text-slate-500 text-center py-4">No dead end pages detected.</p>';
    }

    const maxCount = pages[0].count || 1;
    return `<div class="space-y-3">
      ${pages.slice(0, 8).map(p => {
        const pct = Math.round((p.count / maxCount) * 100);
        return `
          <div>
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs text-slate-300 truncate max-w-[70%]">${_escHtml(p.page)}</span>
              <span class="text-xs text-slate-400 font-medium">${p.count} dead ends</span>
            </div>
            <div class="w-full bg-slate-700/50 rounded-full h-1.5">
              <div class="bg-orange-500/70 h-1.5 rounded-full" style="width:${pct}%"></div>
            </div>
          </div>
        `;
      }).join('')}
    </div>`;
  }

  /* ------------------------------------------------------------------
     Trend Chart (frustration & engagement)
  ------------------------------------------------------------------ */
  function _renderTrendChart(trends) {
    const canvas = document.getElementById('insights-trend-chart');
    if (!canvas || !trends || !trends.daily) return;

    const labels = trends.daily.map(d => {
      const date = new Date(d.date);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Avg Engagement',
            data: trends.daily.map(d => d.avg_engagement),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
          },
          {
            label: 'Frustration Rate %',
            data: trends.daily.map(d => d.frustration_rate),
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            fill: true,
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: {
            labels: { color: '#94a3b8', usePointStyle: true, pointStyle: 'circle', padding: 16, font: { size: 11 } },
          },
          tooltip: {
            backgroundColor: '#1e293b',
            borderColor: '#334155',
            borderWidth: 1,
            titleColor: '#e2e8f0',
            bodyColor: '#94a3b8',
            padding: 10,
            titleFont: { size: 12 },
            bodyFont: { size: 11 },
          },
        },
        scales: {
          x: {
            ticks: { color: '#64748b', font: { size: 10 }, maxTicksLimit: 10 },
            grid: { color: '#1e293b' },
          },
          y: {
            min: 0,
            max: 100,
            ticks: { color: '#64748b', font: { size: 10 }, stepSize: 25 },
            grid: { color: '#1e293b' },
          },
        },
      },
    });

    App.state.chartInstances['insights-trend'] = chart;
  }

  /* ------------------------------------------------------------------
     Error Chart
  ------------------------------------------------------------------ */
  function _renderErrorChart(trends) {
    const canvas = document.getElementById('insights-error-chart');
    if (!canvas || !trends || !trends.daily) return;

    const labels = trends.daily.map(d => {
      const date = new Date(d.date);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'JS Errors',
            data: trends.daily.map(d => d.errors),
            backgroundColor: 'rgba(249, 115, 22, 0.5)',
            borderColor: '#f97316',
            borderWidth: 1,
            borderRadius: 3,
          },
          {
            label: 'Frustrated Sessions',
            data: trends.daily.map(d => d.frustrated_sessions),
            backgroundColor: 'rgba(239, 68, 68, 0.4)',
            borderColor: '#ef4444',
            borderWidth: 1,
            borderRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: {
            labels: { color: '#94a3b8', usePointStyle: true, pointStyle: 'rect', padding: 16, font: { size: 11 } },
          },
          tooltip: {
            backgroundColor: '#1e293b',
            borderColor: '#334155',
            borderWidth: 1,
            titleColor: '#e2e8f0',
            bodyColor: '#94a3b8',
            padding: 10,
          },
        },
        scales: {
          x: {
            ticks: { color: '#64748b', font: { size: 10 }, maxTicksLimit: 10 },
            grid: { display: false },
          },
          y: {
            beginAtZero: true,
            ticks: { color: '#64748b', font: { size: 10 } },
            grid: { color: '#1e293b' },
          },
        },
      },
    });

    App.state.chartInstances['insights-error'] = chart;
  }

  /* ------------------------------------------------------------------
     View affected sessions action
  ------------------------------------------------------------------ */
  function viewAffectedSessions(issueTitle) {
    // Navigate to sessions page - in future, could pass filter
    Components.toast('Navigating to sessions with this issue...', 'info');
    App.navigate('sessions');
  }

  /* ------------------------------------------------------------------
     Mock Data Generators
  ------------------------------------------------------------------ */
  function _generateMockOverview() {
    const pages = ['/', '/pricing', '/docs', '/blog', '/about', '/contact', '/signup', '/katalog', '/product/1', '/checkout'];
    const elements = ['button.cta', 'div.pricing-card', 'a.nav-link', 'input.search', 'img.hero', 'button.koupit', 'div.chatbot-trigger'];
    const issueTypes = ['frustration', 'confusion', 'hesitation', 'exit_intent', 'form_abandonment', 'dead_end'];
    const severities = ['critical', 'high', 'medium', 'low'];
    const titles = [
      'Rage clicks on "Koupit" button',
      'UI element appears clickable but is not',
      'JavaScript error caused user to leave',
      'Navigation confusion detected',
      'Form abandoned',
      'Price/CTA hesitation',
      'Content not matching expectations',
      'Purchase hesitation on product pages',
      'Dead end - no clear next step',
      'Bounce - content mismatch',
    ];
    const recommendations = [
      'Check if the button is responsive and provides visual feedback',
      'Fix the JavaScript error in chatbot.js line 142',
      'Improve navigation between product and cart pages',
      'Reduce the number of required form fields',
      'Add social proof near pricing section',
      'Add clear CTA above the fold',
      'Review page meta descriptions for accuracy',
    ];

    function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
    function randId() { return Math.random().toString(36).slice(2, 10); }

    const topIssues = titles.map((title, i) => ({
      type: rand(issueTypes),
      severity: i < 2 ? 'critical' : i < 4 ? 'high' : i < 7 ? 'medium' : 'low',
      title,
      description: `${randInt(5, 25)} sessions in the last 7 days showed this issue.`,
      recommendation: rand(recommendations),
      affected_sessions: Array.from({ length: randInt(3, 20) }, () => randId()),
      count: randInt(5, 40),
      page: rand(pages),
    }));

    const frustrationHotspots = pages.slice(0, 5).map(page => ({
      page,
      count: randInt(3, 30),
      top_elements: Array.from({ length: randInt(1, 3) }, () => ({
        element: rand(elements),
        count: randInt(1, 15),
      })),
    })).sort((a, b) => b.count - a.count);

    const commonExitPages = pages.slice(0, 6).map(page => ({
      page,
      count: randInt(5, 50),
    })).sort((a, b) => b.count - a.count);

    const sessionsNeeding = Array.from({ length: 8 }, () => ({
      session_id: randId(),
      frustration_score: randInt(40, 95),
      engagement_score: randInt(10, 60),
      started_at: new Date(Date.now() - randInt(0, 7 * 86400000)).toISOString(),
      duration: randInt(10, 600),
      country: rand(['CZ', 'SK', 'DE', 'US', 'UK']),
      top_issue: rand(titles),
    })).sort((a, b) => b.frustration_score - a.frustration_score);

    return {
      total_sessions: randInt(200, 800),
      health_score: randInt(45, 85),
      frustration_rate: randInt(8, 35),
      avg_engagement: randInt(35, 72),
      issues_found: topIssues.length,
      top_issues: topIssues,
      frustration_hotspots: frustrationHotspots,
      common_exit_pages: commonExitPages,
      sessions_needing_attention: sessionsNeeding,
      form_abandonment_rate: randInt(15, 55),
      dead_end_pages: pages.slice(3, 7).map(p => ({ page: p, count: randInt(2, 15) })),
    };
  }

  function _generateMockTrends() {
    const daily = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86400000);
      const sessions = Math.floor(30 + Math.random() * 50);
      const frustrated = Math.floor(sessions * (0.05 + Math.random() * 0.25));
      daily.push({
        date: date.toISOString().slice(0, 10),
        sessions,
        frustrated_sessions: frustrated,
        frustration_rate: Math.round((frustrated / sessions) * 100),
        avg_engagement: Math.floor(35 + Math.random() * 40),
        avg_frustration: Math.floor(5 + Math.random() * 35),
        errors: Math.floor(Math.random() * 15),
        error_rate: Math.floor(Math.random() * 20),
      });
    }

    return {
      days: 30,
      daily,
      top_growing_issues: [
        {
          type: 'frustration',
          title: 'Rage clicks on checkout button',
          severity: 'high',
          growth: 150,
          recent_count: 15,
          previous_count: 6,
        },
        {
          type: 'confusion',
          title: 'Navigation confusion on catalog pages',
          severity: 'medium',
          growth: 80,
          recent_count: 9,
          previous_count: 5,
        },
        {
          type: 'form_abandonment',
          title: 'Contact form abandoned',
          severity: 'medium',
          growth: 50,
          recent_count: 12,
          previous_count: 8,
        },
      ],
    };
  }

  /* ------------------------------------------------------------------
     HTML escape helper
  ------------------------------------------------------------------ */
  function _escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  /* ------------------------------------------------------------------
     Public API
  ------------------------------------------------------------------ */
  return {
    render,
    viewAffectedSessions,
  };

})();
