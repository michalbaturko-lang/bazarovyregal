/* ==========================================================================
   dashboard-page.js  -  Dashboard overview page
   ========================================================================== */

const DashboardPage = (() => {

  let data = null;

  async function fetchData() {
    try {
      data = await App.api('/dashboard/overview');
    } catch (_) {
      // Fallback to mock data
      data = App.Mock.dashboardData();
    }
  }

  /* ------------------------------------------------------------------
     Render
  ------------------------------------------------------------------ */
  async function render(container) {
    await fetchData();

    const sessionsIcon = `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5"/></svg>`;
    const visitorsIcon = `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>`;
    const durationIcon = `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
    const pageViewsIcon = `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`;

    container.innerHTML = `
      <div>
        ${Components.sectionHeader('Dashboard', 'Overview of your session recording analytics')}

        <!-- Metric Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          ${Components.metricCard('Total Sessions', App.formatNumber(data.totalSessions),
            { value: data.totalSessionsChange, positive: data.totalSessionsUp }, sessionsIcon)}
          ${Components.metricCard('Unique Visitors', App.formatNumber(data.uniqueVisitors),
            { value: data.uniqueVisitorsChange, positive: data.uniqueVisitorsUp }, visitorsIcon)}
          ${Components.metricCard('Avg Duration', App.formatDuration(data.avgDuration),
            { value: data.avgDurationChange, positive: data.avgDurationUp }, durationIcon)}
          ${Components.metricCard('Page Views', App.formatNumber(data.totalPageViews),
            { value: data.totalPageViewsChange, positive: data.totalPageViewsUp }, pageViewsIcon)}
        </div>

        <!-- Charts Row 1 -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div class="lg:col-span-2 bg-slate-800 rounded-xl border border-slate-700/50 p-5">
            <h3 class="text-sm font-semibold text-white mb-4">Sessions Over Time</h3>
            <div style="height:280px; position:relative;"><canvas id="chart-sessions-time"></canvas></div>
          </div>
          <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
            <h3 class="text-sm font-semibold text-white mb-4">Top Pages</h3>
            <div style="height:280px; position:relative;"><canvas id="chart-top-pages"></canvas></div>
          </div>
        </div>

        <!-- Charts Row 2 -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
            <h3 class="text-sm font-semibold text-white mb-4">Device Breakdown</h3>
            <div style="height:260px; position:relative;"><canvas id="chart-devices"></canvas></div>
          </div>
          <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
            <h3 class="text-sm font-semibold text-white mb-4">Browser Breakdown</h3>
            <div style="height:260px; position:relative;"><canvas id="chart-browsers"></canvas></div>
          </div>
        </div>

        <!-- Tables Row -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <!-- Recent Sessions -->
          <div>
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-sm font-semibold text-white">Recent Sessions</h3>
              <a href="#sessions" class="text-xs text-blue-400 hover:text-blue-300 transition-colors">View all</a>
            </div>
            <div id="recent-sessions-table"></div>
          </div>

          <!-- Rage Clicks & Errors -->
          <div>
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-sm font-semibold text-white">Recent Rage Clicks</h3>
            </div>
            <div id="rage-clicks-table" class="mb-6"></div>

            <div class="flex items-center justify-between mb-3">
              <h3 class="text-sm font-semibold text-white">Recent Errors</h3>
            </div>
            <div id="errors-table"></div>
          </div>
        </div>
      </div>`;

    // Render charts and tables
    renderSessionsChart();
    renderTopPagesChart();
    renderDevicesChart();
    renderBrowsersChart();
    renderRecentSessionsTable();
    renderRageClicksTable();
    renderErrorsTable();
  }

  /* ------------------------------------------------------------------
     Charts
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

  function renderSessionsChart() {
    const ctx = document.getElementById('chart-sessions-time');
    if (!ctx) return;
    const labels = data.sessionsOverTime.map(d => d.label);
    const values = data.sessionsOverTime.map(d => d.count);

    App.state.chartInstances['sessions-time'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Sessions',
          data: values,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.08)',
          borderWidth: 2.5,
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: '#1e293b',
          pointBorderWidth: 2,
          pointHoverRadius: 6,
        }],
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
          legend: { display: false },
        },
      },
    });
  }

  function renderTopPagesChart() {
    const ctx = document.getElementById('chart-top-pages');
    if (!ctx) return;
    const labels = data.topPages.map(p => p.url);
    const values = data.topPages.map(p => p.views);

    App.state.chartInstances['top-pages'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Views',
          data: values,
          backgroundColor: [
            'rgba(59,130,246,0.7)', 'rgba(99,102,241,0.7)', 'rgba(139,92,246,0.7)',
            'rgba(168,85,247,0.7)', 'rgba(59,130,246,0.5)', 'rgba(99,102,241,0.5)',
            'rgba(139,92,246,0.5)', 'rgba(168,85,247,0.5)',
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

  function renderDevicesChart() {
    const ctx = document.getElementById('chart-devices');
    if (!ctx) return;
    const labels = Object.keys(data.deviceBreakdown);
    const values = Object.values(data.deviceBreakdown);

    App.state.chartInstances['devices'] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: ['rgba(59,130,246,0.8)', 'rgba(16,185,129,0.8)', 'rgba(245,158,11,0.8)'],
          borderColor: '#1e293b',
          borderWidth: 3,
          hoverOffset: 6,
        }],
      },
      options: {
        ...chartDefaults(),
        cutout: '55%',
        plugins: {
          ...chartDefaults().plugins,
          legend: {
            position: 'bottom',
            labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 }, padding: 16, usePointStyle: true, pointStyleWidth: 10 },
          },
        },
      },
    });
  }

  function renderBrowsersChart() {
    const ctx = document.getElementById('chart-browsers');
    if (!ctx) return;
    const labels = Object.keys(data.browserBreakdown);
    const values = Object.values(data.browserBreakdown);

    App.state.chartInstances['browsers'] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: ['rgba(34,197,94,0.8)', 'rgba(249,115,22,0.8)', 'rgba(59,130,246,0.8)', 'rgba(6,182,212,0.8)'],
          borderColor: '#1e293b',
          borderWidth: 3,
          hoverOffset: 6,
        }],
      },
      options: {
        ...chartDefaults(),
        cutout: '55%',
        plugins: {
          ...chartDefaults().plugins,
          legend: {
            position: 'bottom',
            labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 }, padding: 16, usePointStyle: true, pointStyleWidth: 10 },
          },
        },
      },
    });
  }

  /* ------------------------------------------------------------------
     Tables
  ------------------------------------------------------------------ */
  function renderRecentSessionsTable() {
    const el = document.getElementById('recent-sessions-table');
    if (!el) return;

    const headers = [
      { key: 'visitor', label: 'Visitor', width: '35%' },
      { key: 'pages', label: 'Pages', align: 'center' },
      { key: 'duration', label: 'Duration' },
      { key: 'started', label: 'Started' },
      { key: 'flags', label: '', align: 'right', width: '80px' },
    ];

    const rows = data.recentSessions.map(s => ({
      id: s.id,
      onClick: `App.navigate('sessions/${s.id}')`,
      cells: {
        visitor: `<div class="flex items-center gap-2.5">
                    ${Components.avatarPlaceholder(s.email || s.visitorId)}
                    <div>
                      <div class="text-sm font-medium text-slate-200">${s.email || s.visitorId}</div>
                      <div class="text-xs text-slate-500">${s.country ? App.countryFlag(s.country) + ' ' : ''}${s.city || ''}</div>
                    </div>
                  </div>`,
        pages: `<span class="text-slate-300">${s.pageViews}</span>`,
        duration: `<span class="text-slate-300">${App.formatDuration(s.duration)}</span>`,
        started: `<span class="text-slate-400">${Components.timeAgo(s.startedAt)}</span>`,
        flags: `${s.rageClicks ? '<span class="inline-block mr-1" title="Rage clicks: ' + s.rageClicks + '"><svg class="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59"/></svg></span>' : ''}${s.errors ? '<span class="inline-block" title="Errors: ' + s.errors + '"><svg class="w-4 h-4 text-red-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg></span>' : ''}`,
      },
    }));

    el.innerHTML = Components.dataTable(headers, rows, { hoverable: true, compact: true });
  }

  function renderRageClicksTable() {
    const el = document.getElementById('rage-clicks-table');
    if (!el) return;

    const headers = [
      { key: 'page', label: 'Page' },
      { key: 'element', label: 'Element' },
      { key: 'count', label: 'Clicks', align: 'center' },
      { key: 'time', label: 'When' },
    ];

    const rows = data.rageClicks.map(r => ({
      onClick: `App.navigate('sessions/${r.sessionId}')`,
      cells: {
        page: `<span class="text-blue-400">${r.page}</span>`,
        element: `<code class="text-xs bg-slate-700/50 px-1.5 py-0.5 rounded text-slate-300">${r.element}</code>`,
        count: `<span class="text-yellow-400 font-medium">${r.count}</span>`,
        time: `<span class="text-slate-400">${Components.timeAgo(r.timestamp)}</span>`,
      },
    }));

    el.innerHTML = Components.dataTable(headers, rows, { hoverable: true, compact: true });
  }

  function renderErrorsTable() {
    const el = document.getElementById('errors-table');
    if (!el) return;

    const headers = [
      { key: 'message', label: 'Error', width: '55%' },
      { key: 'page', label: 'Page' },
      { key: 'time', label: 'When' },
    ];

    const rows = data.errors.map(e => ({
      onClick: `App.navigate('sessions/${e.sessionId}')`,
      cells: {
        message: `<span class="text-red-400 text-xs font-mono">${e.message}</span>`,
        page: `<span class="text-blue-400">${e.page}</span>`,
        time: `<span class="text-slate-400">${Components.timeAgo(e.timestamp)}</span>`,
      },
    }));

    el.innerHTML = Components.dataTable(headers, rows, { hoverable: true, compact: true });
  }

  /* ------------------------------------------------------------------
     Public API
  ------------------------------------------------------------------ */
  return { render };

})();
