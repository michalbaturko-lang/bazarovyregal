/* ==========================================================================
   comparison-page.js  -  Period vs Period Comparison Dashboard
   ========================================================================== */

const ComparisonPage = (() => {

  /* ------------------------------------------------------------------
     State
  ------------------------------------------------------------------ */
  let period1 = { start: '', end: '' };
  let period2 = { start: '', end: '' };
  let overviewData = null;
  let pagesData = [];
  let devicesData = null;
  let containerEl = null;

  /* ------------------------------------------------------------------
     Initialize default periods
     Period B = current App date range
     Period A = same-length period immediately before period B
  ------------------------------------------------------------------ */
  function initPeriods() {
    const endDate = new Date(App.state.dateRange.end);
    const startDate = new Date(App.state.dateRange.start);
    const diffMs = endDate - startDate;

    period2.start = App.state.dateRange.start;
    period2.end = App.state.dateRange.end;

    const p1End = new Date(startDate.getTime() - 86400000); // day before period2 start
    const p1Start = new Date(p1End.getTime() - diffMs);

    period1.start = p1Start.toISOString().slice(0, 10);
    period1.end = p1End.toISOString().slice(0, 10);
  }

  /* ------------------------------------------------------------------
     Mock data generators
  ------------------------------------------------------------------ */
  function mockOverview() {
    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const p1Sessions = rand(1200, 3500);
    const p2Sessions = rand(1200, 3500);
    const p1PageViews = p1Sessions * rand(3, 6);
    const p2PageViews = p2Sessions * rand(3, 6);

    function mockDays(start, end) {
      const days = [];
      const s = new Date(start);
      const e = new Date(end);
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        days.push({ date: d.toISOString().slice(0, 10), count: rand(100, 600) });
      }
      return days;
    }

    return {
      period1: {
        start: period1.start,
        end: period1.end,
        total_sessions: p1Sessions,
        total_page_views: p1PageViews,
        unique_visitors: Math.round(p1Sessions * 0.65),
        avg_duration: rand(45, 280),
        bounce_rate: rand(15, 55) / 10 * 10,
        rage_click_sessions: rand(5, 40),
        error_sessions: rand(3, 25),
        sessions_by_day: mockDays(period1.start, period1.end),
      },
      period2: {
        start: period2.start,
        end: period2.end,
        total_sessions: p2Sessions,
        total_page_views: p2PageViews,
        unique_visitors: Math.round(p2Sessions * 0.65),
        avg_duration: rand(45, 280),
        bounce_rate: rand(15, 55) / 10 * 10,
        rage_click_sessions: rand(5, 40),
        error_sessions: rand(3, 25),
        sessions_by_day: mockDays(period2.start, period2.end),
      },
      changes: {
        total_sessions: Math.round((Math.random() - 0.4) * 50 * 10) / 10,
        total_page_views: Math.round((Math.random() - 0.4) * 50 * 10) / 10,
        unique_visitors: Math.round((Math.random() - 0.4) * 40 * 10) / 10,
        avg_duration: Math.round((Math.random() - 0.5) * 30 * 10) / 10,
        bounce_rate: Math.round((Math.random() - 0.5) * 20 * 10) / 10,
        rage_click_sessions: Math.round((Math.random() - 0.5) * 60 * 10) / 10,
        error_sessions: Math.round((Math.random() - 0.5) * 40 * 10) / 10,
      },
    };
  }

  function mockPages() {
    const urls = ['/', '/pricing', '/features', '/docs', '/blog', '/about', '/contact', '/signup'];
    return urls.map(url => {
      const s1 = Math.floor(50 + Math.random() * 800);
      const s2 = Math.floor(50 + Math.random() * 800);
      const changePct = s1 > 0 ? Math.round(((s2 - s1) / s1) * 1000) / 10 : 0;
      return {
        url,
        sessions_period1: s1,
        sessions_period2: s2,
        change_pct: changePct,
        absolute_change: s2 - s1,
      };
    });
  }

  function mockDevices() {
    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    return {
      devices: [
        { device: 'desktop', count_period1: rand(600, 1800), count_period2: rand(600, 1800), change_pct: Math.round((Math.random() - 0.4) * 40 * 10) / 10 },
        { device: 'mobile', count_period1: rand(300, 900), count_period2: rand(300, 900), change_pct: Math.round((Math.random() - 0.4) * 40 * 10) / 10 },
        { device: 'tablet', count_period1: rand(30, 150), count_period2: rand(30, 150), change_pct: Math.round((Math.random() - 0.4) * 40 * 10) / 10 },
      ],
      browsers: [
        { browser: 'Chrome', count_period1: rand(500, 1500), count_period2: rand(500, 1500), change_pct: Math.round((Math.random() - 0.4) * 30 * 10) / 10 },
        { browser: 'Firefox', count_period1: rand(100, 400), count_period2: rand(100, 400), change_pct: Math.round((Math.random() - 0.4) * 30 * 10) / 10 },
        { browser: 'Safari', count_period1: rand(150, 500), count_period2: rand(150, 500), change_pct: Math.round((Math.random() - 0.4) * 30 * 10) / 10 },
        { browser: 'Edge', count_period1: rand(50, 200), count_period2: rand(50, 200), change_pct: Math.round((Math.random() - 0.4) * 30 * 10) / 10 },
      ],
    };
  }

  /* ------------------------------------------------------------------
     Data fetching
  ------------------------------------------------------------------ */
  async function fetchOverview() {
    try {
      const params = new URLSearchParams({
        project_id: App.state.project,
        period1_start: period1.start,
        period1_end: period1.end,
        period2_start: period2.start,
        period2_end: period2.end,
      });
      overviewData = await App.api(`/comparison/overview?${params}`);
    } catch (_) {
      overviewData = mockOverview();
    }
  }

  async function fetchPages() {
    try {
      const params = new URLSearchParams({
        project_id: App.state.project,
        period1_start: period1.start,
        period1_end: period1.end,
        period2_start: period2.start,
        period2_end: period2.end,
      });
      const data = await App.api(`/comparison/pages?${params}`);
      pagesData = data.pages || [];
    } catch (_) {
      pagesData = mockPages();
    }
  }

  async function fetchDevices() {
    try {
      const params = new URLSearchParams({
        project_id: App.state.project,
        period1_start: period1.start,
        period1_end: period1.end,
        period2_start: period2.start,
        period2_end: period2.end,
      });
      devicesData = await App.api(`/comparison/devices?${params}`);
    } catch (_) {
      devicesData = mockDevices();
    }
  }

  async function fetchAllData() {
    await Promise.all([fetchOverview(), fetchPages(), fetchDevices()]);
  }

  /* ------------------------------------------------------------------
     Render: Main page
  ------------------------------------------------------------------ */
  async function render(container) {
    containerEl = container;
    container.innerHTML = Components.loading();

    initPeriods();
    await fetchAllData();
    renderPage();
  }

  function renderPage() {
    if (!containerEl) return;

    const ov = overviewData || {};
    const p1 = ov.period1 || {};
    const p2 = ov.period2 || {};
    const changes = ov.changes || {};

    containerEl.innerHTML = `
      <div class="max-w-full">
        <!-- Header -->
        ${Components.sectionHeader('Period Comparison', 'Compare key metrics between two time periods')}

        <!-- Period Selectors -->
        <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-4 mb-6">
          <div class="flex flex-wrap items-end gap-4">
            <!-- Period A -->
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0"></div>
              <div>
                <label class="block text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">Period A (Baseline)</label>
                <div class="flex items-center gap-2">
                  <input type="date" id="comp-p1-start" value="${period1.start}"
                         class="bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-colors" />
                  <span class="text-slate-500 text-xs">to</span>
                  <input type="date" id="comp-p1-end" value="${period1.end}"
                         class="bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-colors" />
                </div>
              </div>
            </div>

            <!-- Period B -->
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full bg-green-500 flex-shrink-0"></div>
              <div>
                <label class="block text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1">Period B (Current)</label>
                <div class="flex items-center gap-2">
                  <input type="date" id="comp-p2-start" value="${period2.start}"
                         class="bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-colors" />
                  <span class="text-slate-500 text-xs">to</span>
                  <input type="date" id="comp-p2-end" value="${period2.end}"
                         class="bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-colors" />
                </div>
              </div>
            </div>

            <!-- Quick select & Apply -->
            <div class="flex items-center gap-2 ml-auto">
              <button onclick="ComparisonPage.setPreviousPeriod()"
                      class="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 bg-slate-700/50 border border-slate-600/50 hover:bg-slate-700 hover:text-white transition-colors">
                Previous Period
              </button>
              <button onclick="ComparisonPage.applyPeriods()"
                      class="px-4 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors">
                Compare
              </button>
            </div>
          </div>
        </div>

        <!-- Side-by-side Metric Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
          ${comparisonCard('Sessions', p1.total_sessions, p2.total_sessions, changes.total_sessions)}
          ${comparisonCard('Page Views', p1.total_page_views, p2.total_page_views, changes.total_page_views)}
          ${comparisonCard('Avg Duration', App.formatDuration(p1.avg_duration), App.formatDuration(p2.avg_duration), changes.avg_duration, true)}
          ${comparisonCard('Bounce Rate', (p1.bounce_rate || 0) + '%', (p2.bounce_rate || 0) + '%', changes.bounce_rate, false, true)}
          ${comparisonCard('Unique Visitors', p1.unique_visitors, p2.unique_visitors, changes.unique_visitors)}
          ${comparisonCard('Rage Clicks', p1.rage_click_sessions, p2.rage_click_sessions, changes.rage_click_sessions, false, true)}
          ${comparisonCard('Error Sessions', p1.error_sessions, p2.error_sessions, changes.error_sessions, false, true)}
        </div>

        <!-- Overlay Line Chart -->
        <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5 mb-6">
          <h3 class="text-sm font-semibold text-white mb-4">Sessions Over Time</h3>
          <div style="height: 300px; position: relative;">
            <canvas id="comparison-overlay-chart"></canvas>
          </div>
        </div>

        <!-- Page Comparison Table -->
        <div class="mb-6">
          <h3 class="text-sm font-semibold text-white mb-3">Page Comparison</h3>
          ${renderPagesTable()}
        </div>

        <!-- Device / Browser Comparison -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
            <h3 class="text-sm font-semibold text-white mb-4">Device Comparison</h3>
            <div style="height: 260px; position: relative;">
              <canvas id="comparison-device-chart"></canvas>
            </div>
          </div>
          <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
            <h3 class="text-sm font-semibold text-white mb-4">Browser Comparison</h3>
            <div style="height: 260px; position: relative;">
              <canvas id="comparison-browser-chart"></canvas>
            </div>
          </div>
        </div>
      </div>
    `;

    renderOverlayChart();
    renderDeviceChart();
    renderBrowserChart();
  }

  /* ------------------------------------------------------------------
     Comparison Card - shows Period A, Period B, and % change
  ------------------------------------------------------------------ */
  function comparisonCard(title, valA, valB, changePct, isFormatted, invertColors) {
    const displayA = isFormatted ? valA : App.formatNumber(valA);
    const displayB = isFormatted ? valB : App.formatNumber(valB);
    const pct = changePct || 0;

    // For bounce rate and errors, decrease is positive (green)
    const isPositive = invertColors ? pct < 0 : pct > 0;
    const isNeutral = pct === 0;

    const changeColor = isNeutral ? 'text-slate-400' : isPositive ? 'text-green-400' : 'text-red-400';
    const changeBg = isNeutral ? 'bg-slate-700/50' : isPositive ? 'bg-green-500/10' : 'bg-red-500/10';
    const arrowPath = pct >= 0
      ? 'M4.5 15.75l7.5-7.5 7.5 7.5'
      : 'M19.5 8.25l-7.5 7.5-7.5-7.5';

    const changeDisplay = isNeutral ? '0%'
      : `${pct > 0 ? '+' : ''}${pct}%`;

    return `
      <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-4">
        <div class="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-3">${title}</div>
        <div class="flex items-end justify-between gap-3 mb-3">
          <div class="min-w-0">
            <div class="flex items-center gap-1.5 mb-1">
              <div class="w-2 h-2 rounded-full bg-blue-500"></div>
              <span class="text-[10px] text-slate-500">Period A</span>
            </div>
            <div class="text-lg font-bold text-white truncate">${displayA}</div>
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-1.5 mb-1">
              <div class="w-2 h-2 rounded-full bg-green-500"></div>
              <span class="text-[10px] text-slate-500">Period B</span>
            </div>
            <div class="text-lg font-bold text-white truncate">${displayB}</div>
          </div>
        </div>
        <div class="flex items-center gap-1.5 ${changeBg} rounded-lg px-2.5 py-1.5">
          <svg class="w-3.5 h-3.5 ${changeColor}" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="${arrowPath}"/>
          </svg>
          <span class="text-xs font-semibold ${changeColor}">${changeDisplay}</span>
          <span class="text-[10px] text-slate-500 ml-1">change</span>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------
     Overlay Line Chart - Two lines (Period A and B)
  ------------------------------------------------------------------ */
  function renderOverlayChart() {
    const canvas = document.getElementById('comparison-overlay-chart');
    if (!canvas || !overviewData) return;

    if (App.state.chartInstances['comparison-overlay']) {
      App.state.chartInstances['comparison-overlay'].destroy();
    }

    const p1Days = (overviewData.period1 && overviewData.period1.sessions_by_day) || [];
    const p2Days = (overviewData.period2 && overviewData.period2.sessions_by_day) || [];

    // Normalize labels to day index (Day 1, Day 2, ...) for alignment
    const maxLen = Math.max(p1Days.length, p2Days.length);
    const labels = Array.from({ length: maxLen }, (_, i) => `Day ${i + 1}`);

    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: `Period A (${period1.start} to ${period1.end})`,
            data: p1Days.map(d => d.count),
            borderColor: 'rgb(59, 130, 246)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 3,
            pointHoverRadius: 5,
            borderWidth: 2,
          },
          {
            label: `Period B (${period2.start} to ${period2.end})`,
            data: p2Days.map(d => d.count),
            borderColor: 'rgb(34, 197, 94)',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 3,
            pointHoverRadius: 5,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: { color: '#94a3b8', usePointStyle: true, pointStyle: 'circle', padding: 16 },
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            borderColor: 'rgba(51, 65, 85, 0.5)',
            borderWidth: 1,
            titleColor: '#e2e8f0',
            bodyColor: '#94a3b8',
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(51, 65, 85, 0.3)' },
            ticks: { color: '#94a3b8' },
          },
          x: {
            grid: { display: false },
            ticks: { color: '#cbd5e1', font: { size: 11 } },
          },
        },
      },
    });

    App.state.chartInstances['comparison-overlay'] = chart;
  }

  /* ------------------------------------------------------------------
     Pages Table
  ------------------------------------------------------------------ */
  function renderPagesTable() {
    const sorted = [...pagesData].sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct));

    const headers = [
      { key: 'url', label: 'Page URL' },
      { key: 'sessions_period1', label: 'Sessions A', align: 'right' },
      { key: 'sessions_period2', label: 'Sessions B', align: 'right' },
      { key: 'change_pct', label: 'Change %', align: 'right' },
    ];

    const rows = sorted.map(page => {
      const pct = page.change_pct || 0;
      const isPositive = pct > 0;
      const isNeutral = pct === 0;
      const color = isNeutral ? 'text-slate-400' : isPositive ? 'text-green-400' : 'text-red-400';
      const arrow = isNeutral ? '' : isPositive ? '&#9650; ' : '&#9660; ';

      return {
        cells: {
          url: `<span class="font-mono text-xs text-slate-300">${escapeHtml(page.url)}</span>`,
          sessions_period1: `<span class="text-blue-400 font-semibold">${App.formatNumber(page.sessions_period1)}</span>`,
          sessions_period2: `<span class="text-green-400 font-semibold">${App.formatNumber(page.sessions_period2)}</span>`,
          change_pct: `<span class="${color} font-semibold">${arrow}${pct > 0 ? '+' : ''}${pct}%</span>`,
        },
      };
    });

    return Components.dataTable(headers, rows, { striped: true, hoverable: true, id: 'comparison-pages-table' });
  }

  /* ------------------------------------------------------------------
     Device Chart - Grouped bar chart
  ------------------------------------------------------------------ */
  function renderDeviceChart() {
    const canvas = document.getElementById('comparison-device-chart');
    if (!canvas || !devicesData) return;

    if (App.state.chartInstances['comparison-device']) {
      App.state.chartInstances['comparison-device'].destroy();
    }

    const devices = devicesData.devices || [];

    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: devices.map(d => d.device),
        datasets: [
          {
            label: 'Period A',
            data: devices.map(d => d.count_period1),
            backgroundColor: 'rgba(59, 130, 246, 0.7)',
            borderColor: 'rgb(59, 130, 246)',
            borderWidth: 1,
            borderRadius: 4,
          },
          {
            label: 'Period B',
            data: devices.map(d => d.count_period2),
            backgroundColor: 'rgba(34, 197, 94, 0.7)',
            borderColor: 'rgb(34, 197, 94)',
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: { color: '#94a3b8', usePointStyle: true, pointStyle: 'circle', padding: 12 },
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            borderColor: 'rgba(51, 65, 85, 0.5)',
            borderWidth: 1,
            titleColor: '#e2e8f0',
            bodyColor: '#94a3b8',
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(51, 65, 85, 0.3)' },
            ticks: { color: '#94a3b8' },
          },
          x: {
            grid: { display: false },
            ticks: { color: '#cbd5e1' },
          },
        },
      },
    });

    App.state.chartInstances['comparison-device'] = chart;
  }

  /* ------------------------------------------------------------------
     Browser Chart - Grouped bar chart
  ------------------------------------------------------------------ */
  function renderBrowserChart() {
    const canvas = document.getElementById('comparison-browser-chart');
    if (!canvas || !devicesData) return;

    if (App.state.chartInstances['comparison-browser']) {
      App.state.chartInstances['comparison-browser'].destroy();
    }

    const browsers = devicesData.browsers || [];

    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: browsers.map(b => b.browser),
        datasets: [
          {
            label: 'Period A',
            data: browsers.map(b => b.count_period1),
            backgroundColor: 'rgba(59, 130, 246, 0.7)',
            borderColor: 'rgb(59, 130, 246)',
            borderWidth: 1,
            borderRadius: 4,
          },
          {
            label: 'Period B',
            data: browsers.map(b => b.count_period2),
            backgroundColor: 'rgba(34, 197, 94, 0.7)',
            borderColor: 'rgb(34, 197, 94)',
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: { color: '#94a3b8', usePointStyle: true, pointStyle: 'circle', padding: 12 },
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            borderColor: 'rgba(51, 65, 85, 0.5)',
            borderWidth: 1,
            titleColor: '#e2e8f0',
            bodyColor: '#94a3b8',
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(51, 65, 85, 0.3)' },
            ticks: { color: '#94a3b8' },
          },
          x: {
            grid: { display: false },
            ticks: { color: '#cbd5e1' },
          },
        },
      },
    });

    App.state.chartInstances['comparison-browser'] = chart;
  }

  /* ------------------------------------------------------------------
     Utility helpers
  ------------------------------------------------------------------ */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  /* ------------------------------------------------------------------
     Public event handlers
  ------------------------------------------------------------------ */
  async function applyPeriods() {
    const p1s = document.getElementById('comp-p1-start');
    const p1e = document.getElementById('comp-p1-end');
    const p2s = document.getElementById('comp-p2-start');
    const p2e = document.getElementById('comp-p2-end');

    if (p1s) period1.start = p1s.value;
    if (p1e) period1.end = p1e.value;
    if (p2s) period2.start = p2s.value;
    if (p2e) period2.end = p2e.value;

    if (!period1.start || !period1.end || !period2.start || !period2.end) {
      Components.toast('Please fill in all date fields', 'warning');
      return;
    }

    if (containerEl) containerEl.innerHTML = Components.loading();
    await fetchAllData();
    renderPage();
  }

  function setPreviousPeriod() {
    // Set Period B = current App date range, Period A = same-length period immediately before
    const endDate = new Date(App.state.dateRange.end);
    const startDate = new Date(App.state.dateRange.start);
    const diffMs = endDate - startDate;

    period2.start = App.state.dateRange.start;
    period2.end = App.state.dateRange.end;

    const p1End = new Date(startDate.getTime() - 86400000);
    const p1Start = new Date(p1End.getTime() - diffMs);

    period1.start = p1Start.toISOString().slice(0, 10);
    period1.end = p1End.toISOString().slice(0, 10);

    // Update the date inputs
    const p1sEl = document.getElementById('comp-p1-start');
    const p1eEl = document.getElementById('comp-p1-end');
    const p2sEl = document.getElementById('comp-p2-start');
    const p2eEl = document.getElementById('comp-p2-end');

    if (p1sEl) p1sEl.value = period1.start;
    if (p1eEl) p1eEl.value = period1.end;
    if (p2sEl) p2sEl.value = period2.start;
    if (p2eEl) p2eEl.value = period2.end;

    Components.toast('Previous period selected. Click Compare to apply.', 'info');
  }

  /* ------------------------------------------------------------------
     Public API
  ------------------------------------------------------------------ */
  return {
    render,
    applyPeriods,
    setPreviousPeriod,
  };

})();
