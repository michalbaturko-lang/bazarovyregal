/* ==========================================================================
   errors-page.js  -  JavaScript Error Tracking page
   ========================================================================== */

const ErrorsPage = (() => {

  /* ------------------------------------------------------------------
     State
  ------------------------------------------------------------------ */
  let overview = null;
  let errorList = [];
  let errorTotal = 0;
  let errorPage = 1;
  let errorPages = 0;
  let trends = [];
  let expandedHash = null;
  let expandedSessions = [];
  let sortField = 'count';
  let sortOrder = 'DESC';
  let containerEl = null;

  /* ------------------------------------------------------------------
     Data fetching
  ------------------------------------------------------------------ */
  function buildParams() {
    const params = new URLSearchParams();
    params.set('project_id', App.state.project || 'default');
    if (App.state.dateRange.start) params.set('date_from', App.state.dateRange.start);
    if (App.state.dateRange.end)   params.set('date_to', App.state.dateRange.end);
    return params.toString();
  }

  async function fetchOverview() {
    try {
      overview = await App.api(`/errors/overview?${buildParams()}`);
    } catch (_) {
      overview = null;
    }
  }

  async function fetchErrorList() {
    try {
      const params = buildParams();
      const extra = `&sort=${sortField}&order=${sortOrder}&page=${errorPage}&limit=50`;
      const result = await App.api(`/errors/list?${params}${extra}`);
      errorList = result.errors || [];
      errorTotal = result.total || 0;
      errorPages = result.pages || 0;
    } catch (_) {
      errorList = [];
      errorTotal = 0;
      errorPages = 0;
    }
  }

  async function fetchTrends() {
    try {
      const result = await App.api(`/errors/trends?${buildParams()}`);
      trends = result.trends || [];
    } catch (_) {
      trends = [];
    }
  }

  async function fetchErrorSessions(errorHash) {
    try {
      const result = await App.api(`/errors/${errorHash}/sessions?${buildParams()}&limit=20`);
      return result.sessions || [];
    } catch (_) {
      return [];
    }
  }

  /* ------------------------------------------------------------------
     Render - main entry point
  ------------------------------------------------------------------ */
  async function render(container) {
    containerEl = container;
    container.innerHTML = Components.loading();

    await Promise.all([fetchOverview(), fetchErrorList(), fetchTrends()]);

    renderPage();
  }

  function renderPage() {
    if (!containerEl) return;

    const errorIcon = `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>`;
    const uniqueIcon = `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z"/></svg>`;
    const sessionsIcon = `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5"/></svg>`;
    const checkIcon = `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;

    const ov = overview || {
      total_errors: 0,
      unique_errors: 0,
      affected_sessions_pct: 0,
      error_free_sessions_pct: 100,
    };

    containerEl.innerHTML = `
      <div>
        ${Components.sectionHeader('Error Tracking', 'JavaScript errors grouped by type with session replay links')}

        <!-- Overview Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          ${Components.metricCard('Total Errors', App.formatNumber(ov.total_errors), null,
            `<span class="text-red-400">${errorIcon}</span>`)}
          ${Components.metricCard('Unique Errors', App.formatNumber(ov.unique_errors), null,
            `<span class="text-orange-400">${uniqueIcon}</span>`)}
          ${Components.metricCard('Affected Sessions', ov.affected_sessions_pct + '%', null,
            `<span class="text-red-400">${sessionsIcon}</span>`)}
          ${Components.metricCard('Error-Free Sessions', ov.error_free_sessions_pct + '%', null,
            `<span class="text-green-400">${checkIcon}</span>`)}
        </div>

        <!-- Charts Row -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div class="lg:col-span-2 bg-slate-800 rounded-xl border border-slate-700/50 p-5">
            <h3 class="text-sm font-semibold text-white mb-4">Error Trend</h3>
            <div style="height:280px; position:relative;"><canvas id="chart-error-trend"></canvas></div>
          </div>
          <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
            <h3 class="text-sm font-semibold text-white mb-4">Top Error Pages</h3>
            <div style="height:280px; position:relative;"><canvas id="chart-error-pages"></canvas></div>
          </div>
        </div>

        <!-- Error List -->
        <div class="mb-6">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-white">Grouped Errors</h3>
            <span class="text-xs text-slate-500">${App.formatNumber(errorTotal)} unique error${errorTotal !== 1 ? 's' : ''}</span>
          </div>
          <div id="errors-list-container"></div>
          <div id="errors-pagination"></div>
        </div>
      </div>`;

    renderTrendChart();
    renderErrorPagesChart();
    renderErrorList();
  }

  /* ------------------------------------------------------------------
     Chart defaults (consistent with dashboard-page.js)
  ------------------------------------------------------------------ */
  function chartDefaults() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 } } },
        tooltip: {
          backgroundColor: '#1e293b',
          titleColor: '#f1f5f9',
          bodyColor: '#cbd5e1',
          borderColor: '#334155',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
          titleFont: { family: 'Inter', weight: '600' },
          bodyFont: { family: 'Inter' },
        },
      },
    };
  }

  /* ------------------------------------------------------------------
     Error Trend chart (line)
  ------------------------------------------------------------------ */
  function renderTrendChart() {
    const ctx = document.getElementById('chart-error-trend');
    if (!ctx) return;

    if (trends.length === 0) {
      ctx.parentElement.innerHTML = `<div class="flex items-center justify-center h-full text-slate-500 text-sm">No error data for this period</div>`;
      return;
    }

    const labels = trends.map(t => {
      const d = new Date(t.date + 'T00:00:00');
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    });
    const totalCounts = trends.map(t => t.count);
    const uniqueCounts = trends.map(t => t.unique_errors);

    App.state.chartInstances['error-trend'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Total Errors',
            data: totalCounts,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239,68,68,0.08)',
            borderWidth: 2.5,
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointBackgroundColor: '#ef4444',
            pointBorderColor: '#1e293b',
            pointBorderWidth: 2,
            pointHoverRadius: 6,
          },
          {
            label: 'Unique Errors',
            data: uniqueCounts,
            borderColor: '#f97316',
            backgroundColor: 'rgba(249,115,22,0.05)',
            borderWidth: 2,
            fill: false,
            tension: 0.35,
            pointRadius: 3,
            pointBackgroundColor: '#f97316',
            pointBorderColor: '#1e293b',
            pointBorderWidth: 2,
            pointHoverRadius: 5,
            borderDash: [5, 3],
          },
        ],
      },
      options: {
        ...chartDefaults(),
        scales: {
          x: {
            grid: { color: 'rgba(51,65,85,0.4)', drawBorder: false },
            ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } },
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(51,65,85,0.4)', drawBorder: false },
            ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } },
          },
        },
        plugins: {
          ...chartDefaults().plugins,
          legend: {
            position: 'top',
            align: 'end',
            labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 }, usePointStyle: true, pointStyleWidth: 8, padding: 16 },
          },
        },
      },
    });
  }

  /* ------------------------------------------------------------------
     Top Error Pages chart (horizontal bar)
  ------------------------------------------------------------------ */
  function renderErrorPagesChart() {
    const ctx = document.getElementById('chart-error-pages');
    if (!ctx) return;

    // Aggregate page counts from the error list
    const pageCounts = {};
    for (const err of errorList) {
      for (const page of (err.pages || [])) {
        pageCounts[page] = (pageCounts[page] || 0) + err.count;
      }
    }

    const sorted = Object.entries(pageCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    if (sorted.length === 0) {
      ctx.parentElement.innerHTML = `<div class="flex items-center justify-center h-full text-slate-500 text-sm">No page data available</div>`;
      return;
    }

    const labels = sorted.map(([url]) => truncateUrl(url));
    const values = sorted.map(([, count]) => count);

    App.state.chartInstances['error-pages'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Errors',
          data: values,
          backgroundColor: [
            'rgba(239,68,68,0.7)', 'rgba(249,115,22,0.7)', 'rgba(234,179,8,0.7)',
            'rgba(239,68,68,0.5)', 'rgba(249,115,22,0.5)', 'rgba(234,179,8,0.5)',
            'rgba(239,68,68,0.35)', 'rgba(249,115,22,0.35)',
          ],
          borderRadius: 6,
          borderSkipped: false,
        }],
      },
      options: {
        ...chartDefaults(),
        indexAxis: 'y',
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: 'rgba(51,65,85,0.4)', drawBorder: false },
            ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } },
          },
          y: {
            grid: { display: false },
            ticks: { color: '#94a3b8', font: { family: 'Inter', size: 11 } },
          },
        },
        plugins: {
          ...chartDefaults().plugins,
          legend: { display: false },
        },
      },
    });
  }

  /* ------------------------------------------------------------------
     Error List table
  ------------------------------------------------------------------ */
  function renderErrorList() {
    const container = document.getElementById('errors-list-container');
    if (!container) return;

    if (errorList.length === 0) {
      container.innerHTML = Components.emptyState(
        'No Errors Found',
        'No JavaScript errors were recorded in the selected date range.',
        `<svg class="w-12 h-12 text-green-500/50" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
      );
      return;
    }

    // Build the sortable column headers
    const sortIndicator = (field) => {
      if (sortField !== field) return `<span class="text-slate-600 ml-1">&#8597;</span>`;
      return sortOrder === 'ASC'
        ? `<span class="text-blue-400 ml-1">&#8593;</span>`
        : `<span class="text-blue-400 ml-1">&#8595;</span>`;
    };

    let html = `
      <div class="overflow-x-auto rounded-xl border border-slate-700/50">
        <table class="w-full">
          <thead class="bg-slate-800/80">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider" style="width:40%">Error Message</th>
              <th class="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer select-none"
                  onclick="ErrorsPage.changeSort('count')">
                Count ${sortIndicator('count')}
              </th>
              <th class="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer select-none"
                  onclick="ErrorsPage.changeSort('affected_sessions')">
                Sessions ${sortIndicator('affected_sessions')}
              </th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Pages</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer select-none"
                  onclick="ErrorsPage.changeSort('first_seen')">
                First Seen ${sortIndicator('first_seen')}
              </th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer select-none"
                  onclick="ErrorsPage.changeSort('last_seen')">
                Last Seen ${sortIndicator('last_seen')}
              </th>
            </tr>
          </thead>
          <tbody class="bg-slate-800/30">`;

    for (const err of errorList) {
      const isExpanded = expandedHash === err.error_hash;
      const truncMsg = truncateMessage(err.message, 80);
      const pageList = (err.pages || []).slice(0, 3).map(p => escapeHtml(truncateUrl(p))).join(', ');
      const morePages = (err.pages || []).length > 3 ? ` +${err.pages.length - 3}` : '';
      const firstSeen = formatTimestamp(err.first_seen);
      const lastSeen = formatTimestamp(err.last_seen);

      html += `
            <tr class="border-t border-slate-700/50 hover:bg-slate-700/30 cursor-pointer transition-colors"
                onclick="ErrorsPage.toggleError('${err.error_hash}')">
              <td class="px-4 py-3 text-sm">
                <div class="flex items-start gap-2">
                  <svg class="w-4 h-4 mt-0.5 flex-shrink-0 ${isExpanded ? 'text-red-400 rotate-90' : 'text-slate-500'} transition-transform" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/>
                  </svg>
                  <span class="text-red-400 font-mono text-xs leading-relaxed break-all">${escapeHtml(truncMsg)}</span>
                </div>
              </td>
              <td class="px-4 py-3 text-center">
                <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold border bg-red-500/15 text-red-400 border-red-500/20">${App.formatNumber(err.count)}</span>
              </td>
              <td class="px-4 py-3 text-center text-sm text-slate-300">${App.formatNumber(err.affected_sessions)}</td>
              <td class="px-4 py-3 text-sm text-slate-400 text-xs">${pageList}${morePages ? `<span class="text-slate-500">${morePages}</span>` : ''}</td>
              <td class="px-4 py-3 text-sm text-slate-400 text-xs">${firstSeen}</td>
              <td class="px-4 py-3 text-sm text-slate-400 text-xs">${lastSeen}</td>
            </tr>`;

      // Expanded detail row
      if (isExpanded) {
        html += `
            <tr class="border-t border-slate-700/30 bg-slate-900/50">
              <td colspan="6" class="px-4 py-4">
                <div id="error-detail-${err.error_hash}">
                  ${renderErrorDetail(err)}
                </div>
              </td>
            </tr>`;
      }
    }

    html += `
          </tbody>
        </table>
      </div>`;

    container.innerHTML = html;

    // Render pagination
    const paginationEl = document.getElementById('errors-pagination');
    if (paginationEl) {
      paginationEl.innerHTML = Components.pagination(errorPage, errorPages, 'ErrorsPage.goToPage');
    }
  }

  /* ------------------------------------------------------------------
     Error detail (expanded row)
  ------------------------------------------------------------------ */
  function renderErrorDetail(err) {
    const stackHtml = err.stack
      ? `<div class="mb-4">
           <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Stack Trace</h4>
           <pre class="bg-slate-950 rounded-lg border border-slate-700/50 p-4 text-xs text-red-300 font-mono overflow-x-auto max-h-64 leading-relaxed whitespace-pre-wrap break-all">${escapeHtml(err.stack)}</pre>
         </div>`
      : `<div class="mb-4">
           <p class="text-xs text-slate-500 italic">No stack trace available</p>
         </div>`;

    const pagesHtml = (err.pages || []).length > 0
      ? `<div class="mb-4">
           <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Affected Pages</h4>
           <div class="flex flex-wrap gap-2">
             ${err.pages.map(p => `<span class="inline-flex items-center px-2 py-1 rounded-md text-xs bg-slate-700/50 text-orange-300 border border-slate-600/50">${escapeHtml(p)}</span>`).join('')}
           </div>
         </div>`
      : '';

    const fullMsgHtml = `
      <div class="mb-4">
        <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Full Error Message</h4>
        <p class="text-sm text-red-400 font-mono bg-slate-950 rounded-lg border border-slate-700/50 p-3 break-all">${escapeHtml(err.message)}</p>
      </div>`;

    const sessionsHtml = `
      <div>
        <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Affected Sessions
          <span class="text-slate-500 normal-case font-normal">(${App.formatNumber(err.affected_sessions)} total)</span>
        </h4>
        <div id="error-sessions-${err.error_hash}">
          ${Components.loading()}
        </div>
      </div>`;

    // Kick off async session loading
    loadErrorSessions(err.error_hash);

    return fullMsgHtml + stackHtml + pagesHtml + sessionsHtml;
  }

  async function loadErrorSessions(errorHash) {
    const sessions = await fetchErrorSessions(errorHash);
    expandedSessions = sessions;

    const el = document.getElementById(`error-sessions-${errorHash}`);
    if (!el) return;

    if (sessions.length === 0) {
      el.innerHTML = `<p class="text-xs text-slate-500 italic">No session data available</p>`;
      return;
    }

    let html = `<div class="space-y-2">`;
    for (const s of sessions) {
      const userName = s.identified_user_name || s.identified_user_email || s.visitor_id || 'Anonymous';
      const dur = App.formatDuration(s.duration);
      const browser = s.browser || 'Unknown';
      const when = Components.timeAgo(s.started_at);

      html += `
        <a href="#sessions/${s.id}" class="flex items-center justify-between gap-4 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/30 hover:border-slate-600/50 hover:bg-slate-700/30 transition-colors group">
          <div class="flex items-center gap-3 min-w-0">
            ${Components.avatarPlaceholder(userName)}
            <div class="min-w-0">
              <div class="text-sm font-medium text-slate-200 truncate">${escapeHtml(userName)}</div>
              <div class="text-xs text-slate-500">${escapeHtml(browser)} &middot; ${dur} &middot; ${when}</div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">Watch replay</span>
            <svg class="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"/>
            </svg>
          </div>
        </a>`;
    }
    html += `</div>`;
    el.innerHTML = html;
  }

  /* ------------------------------------------------------------------
     Interaction handlers (exposed publicly)
  ------------------------------------------------------------------ */
  async function toggleError(errorHash) {
    if (expandedHash === errorHash) {
      expandedHash = null;
    } else {
      expandedHash = errorHash;
    }
    renderErrorList();
  }

  function changeSort(field) {
    if (sortField === field) {
      sortOrder = sortOrder === 'DESC' ? 'ASC' : 'DESC';
    } else {
      sortField = field;
      sortOrder = 'DESC';
    }
    errorPage = 1;
    refetch();
  }

  function goToPage(newPage) {
    if (newPage < 1 || newPage > errorPages) return;
    errorPage = newPage;
    expandedHash = null;
    refetch();
  }

  async function refetch() {
    if (!containerEl) return;
    const listContainer = document.getElementById('errors-list-container');
    if (listContainer) listContainer.innerHTML = Components.loading();

    await fetchErrorList();
    renderErrorList();
  }

  /* ------------------------------------------------------------------
     Utility helpers
  ------------------------------------------------------------------ */
  function truncateMessage(msg, maxLen) {
    if (!msg) return 'Unknown error';
    if (msg.length <= maxLen) return msg;
    return msg.slice(0, maxLen) + '...';
  }

  function truncateUrl(url) {
    if (!url) return '';
    try {
      const u = new URL(url);
      return u.pathname + u.search;
    } catch (_) {
      // If not a valid URL, just truncate
      if (url.length > 40) return url.slice(0, 37) + '...';
      return url;
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatTimestamp(ts) {
    if (!ts) return '--';
    try {
      const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
      if (isNaN(d.getTime())) return '--';
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch (_) {
      return '--';
    }
  }

  /* ------------------------------------------------------------------
     Public API
  ------------------------------------------------------------------ */
  return {
    render,
    toggleError,
    changeSort,
    goToPage,
  };

})();
