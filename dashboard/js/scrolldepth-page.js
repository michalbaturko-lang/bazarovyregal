/* ==========================================================================
   scrolldepth-page.js  -  Scroll Depth Analytics Dashboard
   ========================================================================== */

const ScrollDepthPage = (() => {

  /* ------------------------------------------------------------------
     State
  ------------------------------------------------------------------ */
  let overviewData = null;
  let pagesData = [];
  let pageDetailData = null;
  let selectedPageUrl = null;
  let sortKey = 'event_count';
  let sortAsc = false;
  let containerEl = null;

  /* ------------------------------------------------------------------
     Mock data generators (fallback when API unavailable)
  ------------------------------------------------------------------ */
  function mockOverview() {
    return {
      total_events: 4823,
      avg_depth_percent: 62.4,
      pct_reaching_25: 89.2,
      pct_reaching_50: 67.8,
      pct_reaching_75: 41.3,
      pct_reaching_100: 18.6,
      avg_time_on_page_ms: 47200,
    };
  }

  function mockPages() {
    const urls = ['/', '/pricing', '/features', '/docs', '/blog', '/about', '/contact', '/signup'];
    return urls.map(url => ({
      url,
      avg_depth_percent: Math.round((30 + Math.random() * 60) * 10) / 10,
      max_depth_percent: Math.round((70 + Math.random() * 30) * 10) / 10,
      bounce_rate: Math.round(Math.random() * 40 * 10) / 10,
      avg_time_on_page_ms: Math.round(10000 + Math.random() * 80000),
      event_count: Math.floor(100 + Math.random() * 1500),
    }));
  }

  function mockPageDetail(url) {
    const zones = [];
    let pct = 100;
    for (let z = 0; z < 10; z++) {
      const drop = z === 0 ? 0 : (Math.random() * 12 + 2);
      pct = Math.max(0, pct - drop);
      zones.push({
        zone_start: z * 10,
        zone_end: (z + 1) * 10,
        label: `${z * 10}%-${(z + 1) * 10}%`,
        visitors: Math.round(pct * 4.8),
        percentage: Math.round(pct * 10) / 10,
      });
    }
    return {
      url,
      total_events: 482,
      zones,
      avg_depth_percent: 58.3,
      avg_time_on_page_ms: 42100,
    };
  }

  /* ------------------------------------------------------------------
     Data fetching
  ------------------------------------------------------------------ */
  async function fetchOverview() {
    try {
      const params = new URLSearchParams({
        project_id: App.state.project,
        date_from: App.state.dateRange.start,
        date_to: App.state.dateRange.end,
      });
      overviewData = await App.api(`/scrolldepth/overview?${params}`);
    } catch (_) {
      overviewData = mockOverview();
    }
  }

  async function fetchPages() {
    try {
      const params = new URLSearchParams({
        project_id: App.state.project,
        date_from: App.state.dateRange.start,
        date_to: App.state.dateRange.end,
      });
      const data = await App.api(`/scrolldepth/pages?${params}`);
      pagesData = data.pages || [];
    } catch (_) {
      pagesData = mockPages();
    }
  }

  async function fetchPageDetail(url) {
    try {
      const params = new URLSearchParams({
        url,
        project_id: App.state.project,
        date_from: App.state.dateRange.start,
        date_to: App.state.dateRange.end,
      });
      pageDetailData = await App.api(`/scrolldepth/page-detail?${params}`);
    } catch (_) {
      pageDetailData = mockPageDetail(url);
    }
  }

  /* ------------------------------------------------------------------
     Render: Main page
  ------------------------------------------------------------------ */
  async function render(container) {
    containerEl = container;
    container.innerHTML = Components.loading();

    await Promise.all([fetchOverview(), fetchPages()]);
    renderPage();
  }

  function renderPage() {
    if (!containerEl) return;

    const ov = overviewData || {};
    const avgTimeSeconds = Math.round((ov.avg_time_on_page_ms || 0) / 1000);

    containerEl.innerHTML = `
      <div class="max-w-full">
        <!-- Header -->
        ${Components.sectionHeader('Scroll Depth Analytics', 'Understand how far visitors scroll on your pages')}

        <!-- Overview Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          ${Components.metricCard('Avg Scroll Depth', `${ov.avg_depth_percent || 0}%`, null,
            '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m0 0l6.75-6.75M12 19.5l-6.75-6.75"/></svg>'
          )}
          ${Components.metricCard('Reaching 50%', `${ov.pct_reaching_50 || 0}%`, null,
            '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5"/></svg>'
          )}
          ${Components.metricCard('Reaching 100%', `${ov.pct_reaching_100 || 0}%`, null,
            '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
          )}
          ${Components.metricCard('Avg Time on Page', App.formatDuration(avgTimeSeconds), null,
            '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
          )}
        </div>

        <!-- Scroll Depth Distribution Chart -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
            <h3 class="text-sm font-semibold text-white mb-4">Scroll Depth Distribution</h3>
            <div id="scrolldepth-distribution-chart" style="height: 320px; position: relative;">
              <canvas id="scrolldepth-dist-canvas"></canvas>
            </div>
          </div>

          <!-- Milestone Funnel -->
          <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
            <h3 class="text-sm font-semibold text-white mb-4">Scroll Milestones</h3>
            <div class="space-y-3">
              ${renderMilestoneBars(ov)}
            </div>
          </div>
        </div>

        <!-- Page Comparison Table -->
        <div class="mb-6">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-white">Page Comparison</h3>
            <span class="text-xs text-slate-500">${pagesData.length} pages tracked</span>
          </div>
          <div id="scrolldepth-pages-table">
            ${renderPagesTable()}
          </div>
        </div>

        <!-- Page Detail Panel (shown when a page is selected) -->
        <div id="scrolldepth-detail-panel">
          ${selectedPageUrl ? renderDetailPanel() : ''}
        </div>
      </div>
    `;

    renderDistributionChart();
  }

  /* ------------------------------------------------------------------
     Milestone bars - funnel-like horizontal bars
  ------------------------------------------------------------------ */
  function renderMilestoneBars(ov) {
    const milestones = [
      { label: '25% depth', pct: ov.pct_reaching_25 || 0, color: 'bg-green-500' },
      { label: '50% depth', pct: ov.pct_reaching_50 || 0, color: 'bg-blue-500' },
      { label: '75% depth', pct: ov.pct_reaching_75 || 0, color: 'bg-yellow-500' },
      { label: '100% depth', pct: ov.pct_reaching_100 || 0, color: 'bg-red-500' },
    ];

    return milestones.map(m => `
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-xs font-medium text-slate-300">${m.label}</span>
          <span class="text-xs font-bold text-white">${m.pct}%</span>
        </div>
        <div class="w-full h-3 bg-slate-700/50 rounded-full overflow-hidden">
          <div class="${m.color} h-full rounded-full transition-all duration-500" style="width: ${Math.min(100, m.pct)}%"></div>
        </div>
      </div>
    `).join('');
  }

  /* ------------------------------------------------------------------
     Distribution Chart (horizontal bar - funnel style)
  ------------------------------------------------------------------ */
  function renderDistributionChart() {
    const canvas = document.getElementById('scrolldepth-dist-canvas');
    if (!canvas) return;

    // Destroy existing chart if any
    if (App.state.chartInstances['scrolldepth-dist']) {
      App.state.chartInstances['scrolldepth-dist'].destroy();
    }

    const ov = overviewData || {};
    const zones = [
      { label: '0-10%', pct: 100 },
      { label: '10-20%', pct: ov.pct_reaching_25 ? Math.min(100, ov.pct_reaching_25 + 8) : 92 },
      { label: '20-30%', pct: ov.pct_reaching_25 || 89 },
      { label: '30-40%', pct: ov.pct_reaching_50 ? Math.min(100, ov.pct_reaching_50 + 15) : 78 },
      { label: '40-50%', pct: ov.pct_reaching_50 || 68 },
      { label: '50-60%', pct: ov.pct_reaching_50 ? Math.max(0, ov.pct_reaching_50 - 8) : 60 },
      { label: '60-70%', pct: ov.pct_reaching_75 ? Math.min(100, ov.pct_reaching_75 + 10) : 51 },
      { label: '70-80%', pct: ov.pct_reaching_75 || 41 },
      { label: '80-90%', pct: ov.pct_reaching_100 ? Math.min(100, ov.pct_reaching_100 + 10) : 28 },
      { label: '90-100%', pct: ov.pct_reaching_100 || 19 },
    ];

    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: zones.map(z => z.label),
        datasets: [{
          label: '% of visitors',
          data: zones.map(z => z.pct),
          backgroundColor: zones.map((_, i) => {
            const hue = 120 - (i / 9) * 120;
            return `hsla(${hue}, 70%, 50%, 0.7)`;
          }),
          borderColor: zones.map((_, i) => {
            const hue = 120 - (i / 9) * 120;
            return `hsla(${hue}, 70%, 50%, 1)`;
          }),
          borderWidth: 1,
          borderRadius: 4,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            borderColor: 'rgba(51, 65, 85, 0.5)',
            borderWidth: 1,
            titleColor: '#e2e8f0',
            bodyColor: '#94a3b8',
            callbacks: {
              label: (ctx) => `${ctx.parsed.x}% of visitors reached this zone`,
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            max: 100,
            grid: { color: 'rgba(51, 65, 85, 0.3)' },
            ticks: { color: '#94a3b8', callback: v => v + '%' },
          },
          y: {
            grid: { display: false },
            ticks: { color: '#cbd5e1', font: { size: 11 } },
          },
        },
      },
    });

    App.state.chartInstances['scrolldepth-dist'] = chart;
  }

  /* ------------------------------------------------------------------
     Pages Table
  ------------------------------------------------------------------ */
  function renderPagesTable() {
    const sorted = [...pagesData].sort((a, b) => {
      const valA = a[sortKey] || 0;
      const valB = b[sortKey] || 0;
      return sortAsc ? valA - valB : valB - valA;
    });

    const headers = [
      { key: 'url', label: 'Page URL', sortable: true },
      { key: 'avg_depth_percent', label: 'Avg Depth', sortable: true, align: 'right' },
      { key: 'readers', label: 'Readers (75%+)', sortable: false, align: 'right' },
      { key: 'bounce_rate', label: 'Bouncers (<10%)', sortable: true, align: 'right' },
      { key: 'avg_time', label: 'Avg Time', sortable: true, align: 'right' },
      { key: 'event_count', label: 'Events', sortable: true, align: 'right' },
    ];

    const rows = sorted.map(page => {
      const depthColor = page.avg_depth_percent >= 70 ? 'text-green-400'
        : page.avg_depth_percent >= 40 ? 'text-yellow-400'
        : 'text-red-400';

      const bounceColor = page.bounce_rate <= 15 ? 'text-green-400'
        : page.bounce_rate <= 30 ? 'text-yellow-400'
        : 'text-red-400';

      const timeStr = App.formatDuration(Math.round(page.avg_time_on_page_ms / 1000));

      return {
        id: page.url,
        onClick: `ScrollDepthPage.selectPage('${escapeAttr(page.url)}')`,
        cells: {
          url: `<span class="text-blue-400 hover:text-blue-300 cursor-pointer font-mono text-xs">${escapeHtml(page.url)}</span>`,
          avg_depth_percent: `<span class="${depthColor} font-semibold">${page.avg_depth_percent}%</span>`,
          readers: `<span class="text-slate-300">${page.avg_depth_percent >= 75 ? 'Yes' : '--'}</span>`,
          bounce_rate: `<span class="${bounceColor} font-semibold">${page.bounce_rate}%</span>`,
          avg_time: `<span class="text-slate-300">${timeStr}</span>`,
          event_count: `<span class="text-slate-300">${App.formatNumber(page.event_count)}</span>`,
        },
      };
    });

    return Components.dataTable(headers, rows, { striped: true, hoverable: true, id: 'scrolldepth-table' });
  }

  /* ------------------------------------------------------------------
     Page Detail Panel - Scroll Heatmap visualization
  ------------------------------------------------------------------ */
  function renderDetailPanel() {
    if (!pageDetailData) return '';

    const pd = pageDetailData;
    const zones = pd.zones || [];
    const avgTimeStr = App.formatDuration(Math.round((pd.avg_time_on_page_ms || 0) / 1000));

    // Build the vertical scroll heatmap bar
    const heatmapBars = zones.map(zone => {
      const pct = zone.percentage;
      // Color gradient: green (100% visitors) -> yellow -> orange -> red (few visitors)
      let bgColor;
      if (pct >= 80) bgColor = 'bg-green-500';
      else if (pct >= 60) bgColor = 'bg-green-400';
      else if (pct >= 45) bgColor = 'bg-yellow-400';
      else if (pct >= 30) bgColor = 'bg-orange-400';
      else if (pct >= 15) bgColor = 'bg-red-400';
      else bgColor = 'bg-red-600';

      return `
        <div class="flex items-center gap-3">
          <span class="text-[10px] text-slate-500 w-16 text-right font-mono">${zone.label}</span>
          <div class="flex-1 h-6 bg-slate-700/30 rounded overflow-hidden relative">
            <div class="${bgColor} h-full rounded transition-all duration-500" style="width: ${Math.min(100, pct)}%; opacity: 0.8;"></div>
            <span class="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow">${pct}% (${zone.visitors})</span>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5 mt-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-sm font-semibold text-white">Page Detail: <span class="text-blue-400 font-mono">${escapeHtml(pd.url)}</span></h3>
            <p class="text-xs text-slate-500 mt-1">${App.formatNumber(pd.total_events)} events tracked | Avg depth: ${pd.avg_depth_percent}% | Avg time: ${avgTimeStr}</p>
          </div>
          <button onclick="ScrollDepthPage.closeDetail()"
                  class="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-700/50">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Vertical Scroll Heatmap -->
          <div>
            <h4 class="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Scroll Heatmap</h4>
            <div class="space-y-1.5">
              ${heatmapBars}
            </div>
          </div>

          <!-- Zone Chart -->
          <div>
            <h4 class="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Zone Engagement Chart</h4>
            <div style="height: 280px; position: relative;">
              <canvas id="scrolldepth-zone-chart"></canvas>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderZoneChart() {
    const canvas = document.getElementById('scrolldepth-zone-chart');
    if (!canvas || !pageDetailData) return;

    if (App.state.chartInstances['scrolldepth-zone']) {
      App.state.chartInstances['scrolldepth-zone'].destroy();
    }

    const zones = pageDetailData.zones || [];

    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: zones.map(z => z.label),
        datasets: [{
          label: 'Visitors %',
          data: zones.map(z => z.percentage),
          backgroundColor: zones.map(z => {
            const pct = z.percentage;
            if (pct >= 70) return 'rgba(34, 197, 94, 0.7)';
            if (pct >= 45) return 'rgba(234, 179, 8, 0.7)';
            if (pct >= 20) return 'rgba(249, 115, 22, 0.7)';
            return 'rgba(239, 68, 68, 0.7)';
          }),
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
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
            max: 100,
            grid: { color: 'rgba(51, 65, 85, 0.3)' },
            ticks: { color: '#94a3b8', callback: v => v + '%' },
          },
          x: {
            grid: { display: false },
            ticks: { color: '#cbd5e1', font: { size: 10 }, maxRotation: 45 },
          },
        },
      },
    });

    App.state.chartInstances['scrolldepth-zone'] = chart;
  }

  /* ------------------------------------------------------------------
     Utility helpers
  ------------------------------------------------------------------ */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ------------------------------------------------------------------
     Public event handlers
  ------------------------------------------------------------------ */
  async function selectPage(url) {
    selectedPageUrl = url;
    await fetchPageDetail(url);

    const panel = document.getElementById('scrolldepth-detail-panel');
    if (panel) {
      panel.innerHTML = renderDetailPanel();
      renderZoneChart();
    }
  }

  function closeDetail() {
    selectedPageUrl = null;
    pageDetailData = null;
    const panel = document.getElementById('scrolldepth-detail-panel');
    if (panel) panel.innerHTML = '';
  }

  function sortTable(key) {
    if (sortKey === key) {
      sortAsc = !sortAsc;
    } else {
      sortKey = key;
      sortAsc = false;
    }
    const tableContainer = document.getElementById('scrolldepth-pages-table');
    if (tableContainer) {
      tableContainer.innerHTML = renderPagesTable();
    }
  }

  /* ------------------------------------------------------------------
     Public API
  ------------------------------------------------------------------ */
  return {
    render,
    selectPage,
    closeDetail,
    sortTable,
  };

})();
