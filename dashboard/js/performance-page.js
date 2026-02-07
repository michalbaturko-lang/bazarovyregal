/* ==========================================================================
   performance-page.js  -  Core Web Vitals & Performance Monitoring Page
   ========================================================================== */

const PerformancePage = (() => {

  let overviewData = null;
  let pagesData = null;
  let trendsData = null;
  let slowPagesData = null;

  /* ------------------------------------------------------------------
     Thresholds (match server-side)
  ------------------------------------------------------------------ */
  const THRESHOLDS = {
    lcp:  { good: 2500, poor: 4000, unit: 'ms', label: 'Largest Contentful Paint' },
    cls:  { good: 0.1,  poor: 0.25, unit: '',   label: 'Cumulative Layout Shift' },
    fid:  { good: 100,  poor: 300,  unit: 'ms', label: 'First Input Delay' },
    inp:  { good: 200,  poor: 500,  unit: 'ms', label: 'Interaction to Next Paint' },
    ttfb: { good: 800,  poor: 1800, unit: 'ms', label: 'Time to First Byte' },
  };

  function classify(metric, value) {
    if (value == null) return 'unknown';
    const t = THRESHOLDS[metric];
    if (!t) return 'unknown';
    if (value <= t.good) return 'good';
    if (value >= t.poor) return 'poor';
    return 'needs_improvement';
  }

  function classColor(classification) {
    if (classification === 'good') return { text: 'text-green-400', bg: 'bg-green-500/15', border: 'border-green-500/30', dot: 'bg-green-500' };
    if (classification === 'needs_improvement') return { text: 'text-yellow-400', bg: 'bg-yellow-500/15', border: 'border-yellow-500/30', dot: 'bg-yellow-500' };
    if (classification === 'poor') return { text: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/30', dot: 'bg-red-500' };
    return { text: 'text-slate-400', bg: 'bg-slate-700/30', border: 'border-slate-600/30', dot: 'bg-slate-500' };
  }

  function classLabel(classification) {
    if (classification === 'good') return 'Good';
    if (classification === 'needs_improvement') return 'Needs Improvement';
    if (classification === 'poor') return 'Poor';
    return '--';
  }

  function formatMetric(metric, value) {
    if (value == null) return '--';
    if (metric === 'cls') return value.toFixed(3);
    if (metric === 'lcp' || metric === 'fid' || metric === 'inp' || metric === 'ttfb') {
      if (value >= 1000) return (value / 1000).toFixed(2) + 's';
      return Math.round(value) + 'ms';
    }
    if (metric === 'page_load_time') {
      if (value >= 1000) return (value / 1000).toFixed(2) + 's';
      return Math.round(value) + 'ms';
    }
    return String(value);
  }

  /* ------------------------------------------------------------------
     Mock Data Generator (fallback when API unavailable)
  ------------------------------------------------------------------ */
  function generateMockData() {
    const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const randFloat = (min, max) => Math.round((min + Math.random() * (max - min)) * 1000) / 1000;
    const pages = ['/', '/pricing', '/docs', '/blog', '/about', '/contact', '/signup', '/features', '/dashboard', '/api'];

    overviewData = {
      sample_count: randInt(500, 3000),
      p75: {
        lcp: randInt(1800, 4500),
        cls: randFloat(0.02, 0.3),
        fid: randInt(30, 350),
        inp: randInt(80, 550),
        ttfb: randInt(300, 2000),
        page_load_time: randInt(1500, 6000),
      },
      avg: {
        lcp: randInt(1500, 3800),
        cls: randFloat(0.01, 0.2),
        fid: randInt(20, 250),
        inp: randInt(60, 400),
        ttfb: randInt(200, 1500),
        page_load_time: randInt(1200, 5000),
      },
      distributions: {
        lcp: { good: randInt(40, 75), needs_improvement: randInt(15, 35), poor: randInt(5, 25) },
        cls: { good: randInt(50, 80), needs_improvement: randInt(10, 30), poor: randInt(3, 20) },
        fid: { good: randInt(60, 90), needs_improvement: randInt(5, 25), poor: randInt(2, 15) },
        inp: { good: randInt(50, 80), needs_improvement: randInt(10, 30), poor: randInt(5, 20) },
        ttfb: { good: randInt(45, 75), needs_improvement: randInt(15, 30), poor: randInt(5, 25) },
      },
      score: randInt(35, 85),
    };

    pagesData = {
      pages: pages.map(url => ({
        url,
        sample_count: randInt(30, 500),
        p75: {
          lcp: randInt(1500, 5500),
          cls: randFloat(0.01, 0.35),
          fid: randInt(20, 400),
          inp: randInt(50, 600),
          ttfb: randInt(200, 2200),
          page_load_time: randInt(1000, 7000),
        },
        distributions: {
          lcp: { good: randInt(30, 80), needs_improvement: randInt(10, 40), poor: randInt(5, 30) },
          cls: { good: randInt(40, 85), needs_improvement: randInt(10, 35), poor: randInt(3, 25) },
          fid: { good: randInt(50, 90), needs_improvement: randInt(5, 30), poor: randInt(2, 20) },
        },
      })).sort((a, b) => b.sample_count - a.sample_count),
    };

    trendsData = {
      trends: (() => {
        const trend = [];
        for (let i = 29; i >= 0; i--) {
          const d = new Date(Date.now() - i * 86400000);
          trend.push({
            date: d.toISOString().slice(0, 10),
            samples: randInt(20, 150),
            p75: {
              lcp: randInt(1800, 4200),
              cls: randFloat(0.03, 0.25),
              fid: randInt(30, 300),
              inp: randInt(80, 480),
              ttfb: randInt(300, 1800),
              page_load_time: randInt(1500, 5500),
            },
            distributions: {
              lcp: { good: randInt(40, 75), needs_improvement: randInt(15, 35), poor: randInt(5, 25) },
              cls: { good: randInt(50, 80), needs_improvement: randInt(10, 30), poor: randInt(3, 20) },
              fid: { good: randInt(60, 90), needs_improvement: randInt(5, 25), poor: randInt(2, 15) },
            },
          });
        }
        return trend;
      })(),
    };

    slowPagesData = {
      slow_pages: pages.slice(0, 6).map(url => ({
        url,
        sample_count: randInt(20, 300),
        p75: {
          lcp: randInt(3000, 8000),
          cls: randFloat(0.05, 0.4),
          fid: randInt(50, 500),
          inp: randInt(100, 700),
          ttfb: randInt(500, 3000),
          page_load_time: randInt(2000, 10000),
        },
        classification: {
          lcp: ['good', 'needs_improvement', 'poor'][randInt(0, 2)],
          cls: ['good', 'needs_improvement', 'poor'][randInt(0, 2)],
          fid: ['good', 'needs_improvement', 'poor'][randInt(0, 2)],
          ttfb: ['good', 'needs_improvement', 'poor'][randInt(0, 2)],
        },
        connections: { '4g': randInt(40, 200), '3g': randInt(5, 30), '2g': randInt(0, 5) },
      })).sort((a, b) => b.p75.lcp - a.p75.lcp),
    };
  }

  /* ------------------------------------------------------------------
     Fetch data from API
  ------------------------------------------------------------------ */
  async function fetchData() {
    const { start, end } = App.state.dateRange;
    const project = App.state.project;
    const params = `project_id=${project}&date_from=${start}&date_to=${end}`;

    const fetchers = [
      App.api(`/performance/overview?${params}`).then(d => { overviewData = d; }).catch(() => null),
      App.api(`/performance/pages?${params}`).then(d => { pagesData = d; }).catch(() => null),
      App.api(`/performance/trends?${params}`).then(d => { trendsData = d; }).catch(() => null),
      App.api(`/performance/slow-pages?${params}`).then(d => { slowPagesData = d; }).catch(() => null),
    ];

    await Promise.all(fetchers);

    // Fallback to mock data if all APIs failed
    if (!overviewData && !pagesData && !trendsData && !slowPagesData) {
      generateMockData();
    } else {
      if (!overviewData) generateMockData();
      if (!pagesData) generateMockData();
      if (!trendsData) generateMockData();
      if (!slowPagesData) generateMockData();
    }
  }

  /* ------------------------------------------------------------------
     Chart defaults
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
     Score color helpers
  ------------------------------------------------------------------ */
  function scoreColor(score) {
    if (score >= 75) return '#22c55e';
    if (score >= 50) return '#eab308';
    return '#ef4444';
  }

  function scoreTextColor(score) {
    if (score >= 75) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-red-400';
  }

  function scoreLabel(score) {
    if (score >= 75) return 'Good';
    if (score >= 50) return 'Needs Work';
    return 'Poor';
  }

  /* ------------------------------------------------------------------
     Render - Main page layout
  ------------------------------------------------------------------ */
  async function render(container) {
    container.innerHTML = Components.loading();

    await fetchData();

    container.innerHTML = `
      <div>
        ${Components.sectionHeader('Performance Monitoring', 'Core Web Vitals and page load performance analysis')}

        <!-- Performance Score + CWV Cards -->
        <div class="grid grid-cols-1 lg:grid-cols-6 gap-5 mb-6">
          <!-- Performance Score -->
          <div class="lg:col-span-2 bg-slate-800 rounded-xl border border-slate-700/50 p-6 flex flex-col items-center justify-center">
            <h3 class="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Performance Score</h3>
            <div class="relative" style="width:180px;height:180px;">
              <svg viewBox="0 0 200 200" class="w-full h-full">
                <path d="M 30 160 A 85 85 0 1 1 170 160" fill="none" stroke="#334155" stroke-width="14" stroke-linecap="round"/>
                <path d="M 30 160 A 85 85 0 1 1 170 160" fill="none" stroke="${scoreColor(overviewData.score)}" stroke-width="14" stroke-linecap="round"
                      stroke-dasharray="${(overviewData.score / 100) * 270 * 1.87} 999" opacity="0.9"/>
                <text x="100" y="95" text-anchor="middle" fill="white" font-size="44" font-weight="700" font-family="Inter">${overviewData.score}</text>
                <text x="100" y="120" text-anchor="middle" fill="#94a3b8" font-size="13" font-family="Inter">${scoreLabel(overviewData.score)}</text>
              </svg>
            </div>
            <div class="mt-2 text-xs text-slate-500">${App.formatNumber(overviewData.sample_count)} samples analyzed</div>
          </div>

          <!-- Core Web Vitals Cards -->
          <div class="lg:col-span-4 grid grid-cols-2 xl:grid-cols-4 gap-4">
            ${cwvCard('lcp', 'LCP', overviewData.p75.lcp, overviewData.distributions.lcp)}
            ${cwvCard('cls', 'CLS', overviewData.p75.cls, overviewData.distributions.cls)}
            ${cwvCard('fid', 'FID', overviewData.p75.fid, overviewData.distributions.fid)}
            ${cwvCard('ttfb', 'TTFB', overviewData.p75.ttfb, overviewData.distributions.ttfb)}
          </div>
        </div>

        <!-- Additional Metrics Row -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          ${Components.metricCard('Avg LCP', formatMetric('lcp', overviewData.avg.lcp), null)}
          ${Components.metricCard('Avg TTFB', formatMetric('ttfb', overviewData.avg.ttfb), null)}
          ${Components.metricCard('Avg Page Load', formatMetric('page_load_time', overviewData.avg.page_load_time), null)}
          ${Components.metricCard('P75 Page Load', formatMetric('page_load_time', overviewData.p75.page_load_time), null)}
        </div>

        <!-- Trends Chart -->
        <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5 mb-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-semibold text-white">Performance Trends (P75)</h3>
            <div class="flex items-center gap-2">
              <button onclick="PerformancePage.switchTrendMetric('lcp')" data-trend-btn="lcp"
                      class="trend-metric-btn px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white transition-colors">LCP</button>
              <button onclick="PerformancePage.switchTrendMetric('cls')" data-trend-btn="cls"
                      class="trend-metric-btn px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:bg-slate-700/50 transition-colors">CLS</button>
              <button onclick="PerformancePage.switchTrendMetric('fid')" data-trend-btn="fid"
                      class="trend-metric-btn px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:bg-slate-700/50 transition-colors">FID</button>
              <button onclick="PerformancePage.switchTrendMetric('ttfb')" data-trend-btn="ttfb"
                      class="trend-metric-btn px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:bg-slate-700/50 transition-colors">TTFB</button>
            </div>
          </div>
          <div style="height:300px;position:relative;"><canvas id="chart-perf-trends"></canvas></div>
        </div>

        <!-- Distribution Charts -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
            <h3 class="text-sm font-semibold text-white mb-4">LCP Distribution</h3>
            <div style="height:240px;position:relative;"><canvas id="chart-dist-lcp"></canvas></div>
          </div>
          <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
            <h3 class="text-sm font-semibold text-white mb-4">CLS Distribution</h3>
            <div style="height:240px;position:relative;"><canvas id="chart-dist-cls"></canvas></div>
          </div>
          <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
            <h3 class="text-sm font-semibold text-white mb-4">FID Distribution</h3>
            <div style="height:240px;position:relative;"><canvas id="chart-dist-fid"></canvas></div>
          </div>
        </div>

        <!-- Page Performance Table -->
        <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5 mb-6">
          <h3 class="text-sm font-semibold text-white mb-4">Page Performance Breakdown</h3>
          <div id="perf-pages-table"></div>
        </div>

        <!-- Slowest Pages -->
        <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5 mb-6">
          <h3 class="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <svg class="w-4 h-4 text-red-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
            </svg>
            Slowest Pages
          </h3>
          <div id="perf-slow-pages"></div>
        </div>
      </div>`;

    renderTrendsChart('lcp');
    renderDistributionChart('lcp', overviewData.distributions.lcp, 'chart-dist-lcp');
    renderDistributionChart('cls', overviewData.distributions.cls, 'chart-dist-cls');
    renderDistributionChart('fid', overviewData.distributions.fid, 'chart-dist-fid');
    renderPagesTable();
    renderSlowPages();
  }

  /* ------------------------------------------------------------------
     Core Web Vital Card
  ------------------------------------------------------------------ */
  function cwvCard(metric, shortLabel, p75Value, distribution) {
    const cls = classify(metric, p75Value);
    const colors = classColor(cls);
    const info = THRESHOLDS[metric] || {};
    const formatted = formatMetric(metric, p75Value);
    const goodPct = distribution ? distribution.good : 0;
    const niPct = distribution ? distribution.needs_improvement : 0;
    const poorPct = distribution ? distribution.poor : 0;

    return `
      <div class="${colors.bg} rounded-xl border ${colors.border} p-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">${shortLabel}</span>
          <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${colors.text} ${colors.bg}">${classLabel(cls)}</span>
        </div>
        <div class="text-2xl font-bold ${colors.text} mb-1">${formatted}</div>
        <div class="text-[10px] text-slate-500 mb-3">P75 - ${info.label || metric}</div>

        <!-- Mini distribution bar -->
        <div class="flex h-2 rounded-full overflow-hidden bg-slate-700/50 mb-1.5">
          <div class="bg-green-500 transition-all" style="width:${goodPct}%" title="Good: ${goodPct}%"></div>
          <div class="bg-yellow-500 transition-all" style="width:${niPct}%" title="NI: ${niPct}%"></div>
          <div class="bg-red-500 transition-all" style="width:${poorPct}%" title="Poor: ${poorPct}%"></div>
        </div>
        <div class="flex justify-between text-[10px]">
          <span class="text-green-400">${goodPct}%</span>
          <span class="text-yellow-400">${niPct}%</span>
          <span class="text-red-400">${poorPct}%</span>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------
     Trends Chart
  ------------------------------------------------------------------ */
  function renderTrendsChart(metric) {
    const chartKey = 'perf-trends';
    if (App.state.chartInstances[chartKey]) {
      try { App.state.chartInstances[chartKey].destroy(); } catch (_) {}
    }

    const ctx = document.getElementById('chart-perf-trends');
    if (!ctx || !trendsData) return;

    const trends = trendsData.trends || [];
    const labels = trends.map(t => {
      const dt = new Date(t.date);
      return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    const values = trends.map(t => t.p75[metric]);
    const threshold = THRESHOLDS[metric];

    const datasets = [{
      label: `${metric.toUpperCase()} P75`,
      data: values,
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59,130,246,0.08)',
      borderWidth: 2.5,
      fill: true,
      tension: 0.35,
      pointRadius: 3,
      pointBackgroundColor: values.map(v => {
        const c = classify(metric, v);
        if (c === 'good') return '#22c55e';
        if (c === 'needs_improvement') return '#eab308';
        return '#ef4444';
      }),
      pointBorderColor: '#1e293b',
      pointBorderWidth: 2,
      pointHoverRadius: 6,
    }];

    // Add threshold lines
    if (threshold) {
      datasets.push({
        label: 'Good Threshold',
        data: Array(labels.length).fill(threshold.good),
        borderColor: 'rgba(34,197,94,0.4)',
        borderWidth: 1.5,
        borderDash: [6, 4],
        pointRadius: 0,
        fill: false,
      });
      datasets.push({
        label: 'Poor Threshold',
        data: Array(labels.length).fill(threshold.poor),
        borderColor: 'rgba(239,68,68,0.4)',
        borderWidth: 1.5,
        borderDash: [6, 4],
        pointRadius: 0,
        fill: false,
      });
    }

    // Add samples bar on secondary axis
    datasets.push({
      label: 'Samples',
      data: trends.map(t => t.samples),
      type: 'bar',
      backgroundColor: 'rgba(100,116,139,0.2)',
      borderRadius: 4,
      borderSkipped: false,
      yAxisID: 'y1',
      barThickness: 12,
    });

    App.state.chartInstances[chartKey] = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        ...chartDefaults(),
        scales: {
          x: { grid: { color: 'rgba(51,65,85,0.4)', drawBorder: false }, ticks: { color: '#64748b', font: { family: 'Inter', size: 11 }, maxTicksLimit: 10 } },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(51,65,85,0.4)', drawBorder: false },
            ticks: {
              color: '#64748b',
              font: { family: 'Inter', size: 11 },
              callback: function (v) {
                if (metric === 'cls') return v.toFixed(2);
                if (v >= 1000) return (v / 1000).toFixed(1) + 's';
                return v + 'ms';
              },
            },
            title: { display: true, text: metric.toUpperCase(), color: '#64748b', font: { family: 'Inter', size: 11 } },
          },
          y1: {
            position: 'right',
            beginAtZero: true,
            grid: { display: false },
            ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } },
            title: { display: true, text: 'Samples', color: '#64748b', font: { family: 'Inter', size: 11 } },
          },
        },
        plugins: {
          ...chartDefaults().plugins,
          legend: {
            position: 'top',
            labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 }, usePointStyle: true, pointStyleWidth: 10, padding: 16 },
          },
        },
      },
    });
  }

  function switchTrendMetric(metric) {
    document.querySelectorAll('.trend-metric-btn').forEach(btn => {
      btn.classList.remove('bg-blue-600', 'text-white');
      btn.classList.add('text-slate-400', 'hover:bg-slate-700/50');
    });
    const activeBtn = document.querySelector(`[data-trend-btn="${metric}"]`);
    if (activeBtn) {
      activeBtn.classList.add('bg-blue-600', 'text-white');
      activeBtn.classList.remove('text-slate-400', 'hover:bg-slate-700/50');
    }
    renderTrendsChart(metric);
  }

  /* ------------------------------------------------------------------
     Distribution Chart (doughnut showing good/ni/poor)
  ------------------------------------------------------------------ */
  function renderDistributionChart(metric, distribution, canvasId) {
    const ctx = document.getElementById(canvasId);
    if (!ctx || !distribution) return;

    const chartKey = 'perf-dist-' + metric;
    if (App.state.chartInstances[chartKey]) {
      try { App.state.chartInstances[chartKey].destroy(); } catch (_) {}
    }

    App.state.chartInstances[chartKey] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Good', 'Needs Improvement', 'Poor'],
        datasets: [{
          data: [distribution.good, distribution.needs_improvement, distribution.poor],
          backgroundColor: ['rgba(34,197,94,0.75)', 'rgba(234,179,8,0.75)', 'rgba(239,68,68,0.75)'],
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
            labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 }, usePointStyle: true, pointStyleWidth: 10, padding: 12 },
          },
        },
      },
    });
  }

  /* ------------------------------------------------------------------
     Page Performance Table
  ------------------------------------------------------------------ */
  function renderPagesTable() {
    const el = document.getElementById('perf-pages-table');
    if (!el || !pagesData) return;

    const pagesList = pagesData.pages || [];
    if (pagesList.length === 0) {
      el.innerHTML = Components.emptyState('No Performance Data', 'No web vitals data has been collected yet.');
      return;
    }

    const headers = [
      { key: 'url', label: 'URL', width: '28%' },
      { key: 'lcp', label: 'LCP', align: 'center' },
      { key: 'cls', label: 'CLS', align: 'center' },
      { key: 'fid', label: 'FID', align: 'center' },
      { key: 'ttfb', label: 'TTFB', align: 'center' },
      { key: 'load', label: 'Load Time', align: 'center' },
      { key: 'samples', label: 'Samples', align: 'right' },
    ];

    const rows = pagesList.slice(0, 20).map(p => ({
      cells: {
        url: `<span class="text-blue-400 font-mono text-xs">${p.url}</span>`,
        lcp: metricCell('lcp', p.p75.lcp),
        cls: metricCell('cls', p.p75.cls),
        fid: metricCell('fid', p.p75.fid),
        ttfb: metricCell('ttfb', p.p75.ttfb),
        load: metricCell('page_load_time', p.p75.page_load_time),
        samples: `<span class="text-slate-300">${App.formatNumber(p.sample_count)}</span>`,
      },
    }));

    el.innerHTML = Components.dataTable(headers, rows, { striped: true, hoverable: true });
  }

  function metricCell(metric, value) {
    if (value == null) return '<span class="text-slate-500">--</span>';
    const cls = classify(metric, value);
    const colors = classColor(cls);
    return `<span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold ${colors.bg} ${colors.text}">
      <span class="w-1.5 h-1.5 rounded-full ${colors.dot}"></span>
      ${formatMetric(metric, value)}
    </span>`;
  }

  /* ------------------------------------------------------------------
     Slowest Pages Ranking
  ------------------------------------------------------------------ */
  function renderSlowPages() {
    const el = document.getElementById('perf-slow-pages');
    if (!el || !slowPagesData) return;

    const pages = slowPagesData.slow_pages || [];
    if (pages.length === 0) {
      el.innerHTML = Components.emptyState('No Slow Pages', 'All pages are performing well.');
      return;
    }

    const maxLcp = Math.max(...pages.map(p => p.p75.lcp || 0), 1);

    el.innerHTML = `
      <div class="space-y-3">
        ${pages.slice(0, 10).map((page, i) => {
          const lcpPct = page.p75.lcp ? Math.min(100, (page.p75.lcp / maxLcp) * 100) : 0;
          const lcpClass = classify('lcp', page.p75.lcp);
          const lcpColors = classColor(lcpClass);
          const clsClass = classify('cls', page.p75.cls);
          const clsColors = classColor(clsClass);
          const ttfbClass = classify('ttfb', page.p75.ttfb);
          const ttfbColors = classColor(ttfbClass);

          return `
            <div class="p-4 rounded-xl bg-slate-800/50 border border-slate-700/30 hover:border-slate-600/50 transition-colors">
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-3">
                  <span class="w-7 h-7 rounded-lg ${lcpColors.bg} flex items-center justify-center text-xs font-bold ${lcpColors.text}">${i + 1}</span>
                  <span class="text-sm text-blue-400 font-mono">${page.url}</span>
                </div>
                <span class="text-xs text-slate-500">${page.sample_count} samples</span>
              </div>

              <!-- LCP Bar -->
              <div class="mb-2">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-xs text-slate-400">LCP</span>
                  <span class="text-xs font-semibold ${lcpColors.text}">${formatMetric('lcp', page.p75.lcp)}</span>
                </div>
                <div class="w-full h-2 rounded-full bg-slate-700/50">
                  <div class="h-full rounded-full transition-all ${lcpColors.dot}" style="width:${lcpPct}%"></div>
                </div>
              </div>

              <!-- Metric badges row -->
              <div class="flex items-center gap-2 flex-wrap">
                ${metricBadge('CLS', formatMetric('cls', page.p75.cls), clsColors)}
                ${metricBadge('TTFB', formatMetric('ttfb', page.p75.ttfb), ttfbColors)}
                ${metricBadge('FID', formatMetric('fid', page.p75.fid), classColor(classify('fid', page.p75.fid)))}
                ${page.p75.page_load_time ? metricBadge('Load', formatMetric('page_load_time', page.p75.page_load_time), classColor('unknown')) : ''}
                ${page.connections ? connectionBadges(page.connections) : ''}
              </div>
            </div>`;
        }).join('')}
      </div>`;
  }

  function metricBadge(label, value, colors) {
    return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium ${colors.bg} ${colors.text} border ${colors.border}">
      ${label}: ${value}
    </span>`;
  }

  function connectionBadges(connections) {
    if (!connections || Object.keys(connections).length === 0) return '';
    return Object.entries(connections)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type, count]) =>
        `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-700/30 text-slate-400 border border-slate-600/30">
          ${type}: ${count}
        </span>`
      ).join('');
  }

  /* ------------------------------------------------------------------
     Public API
  ------------------------------------------------------------------ */
  return {
    render,
    switchTrendMetric,
  };

})();
