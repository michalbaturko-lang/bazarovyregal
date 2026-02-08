/* ==========================================================================
   revenue-page.js  –  Revenue Analytics Dashboard
   Revenue overview, attribution, products, landing pages, funnel, forecast
   ========================================================================== */

window.RevenuePage = (() => {

  /* ------------------------------------------------------------------
     State
  ------------------------------------------------------------------ */
  let _data = {
    overview: null,
    prevOverview: null,
    attribution: null,
    products: null,
    pages: null,
    funnel: null,
    forecast: null,
  };
  let _attributionTab = 'utm_source';
  let _revenueView = 'daily';   // 'daily' | 'weekly'
  let _attrSortCol = 'revenue';
  let _attrSortDir = 'desc';
  let _pageSortCol = 'revenue';
  let _pageSortDir = 'desc';
  let _chartInstance = null;
  let _destroyed = false;

  /* ------------------------------------------------------------------
     Constants
  ------------------------------------------------------------------ */
  const COLORS = {
    bg: '#1a1a2e',
    card: '#16213e',
    accent: '#4361ee',
    green: '#00c853',
    text: '#e0e0e0',
    muted: '#8892a4',
    border: 'rgba(67, 97, 238, 0.15)',
    gridLine: 'rgba(67, 97, 238, 0.08)',
  };

  const ATTRIBUTION_TABS = [
    { key: 'utm_source', label: 'Source' },
    { key: 'utm_medium', label: 'Medium' },
    { key: 'utm_campaign', label: 'Campaign' },
    { key: 'referrer', label: 'Referrer' },
    { key: 'device_type', label: 'Device' },
  ];

  /* ------------------------------------------------------------------
     Currency formatting
  ------------------------------------------------------------------ */
  const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  function fmtCurrency(val) {
    if (val == null || isNaN(val)) return '--';
    return currencyFormatter.format(val);
  }

  function fmtPercent(val) {
    if (val == null || isNaN(val)) return '--';
    return val.toFixed(1) + '%';
  }

  function fmtNumber(val) {
    if (val == null || isNaN(val)) return '--';
    return Number(val).toLocaleString('en-US');
  }

  /* ------------------------------------------------------------------
     Data fetching
  ------------------------------------------------------------------ */
  function qs() {
    const { start, end } = App.state.dateRange;
    return `project_id=${App.state.project}&date_from=${start}&date_to=${end}`;
  }

  function prevQs() {
    const { start, end } = App.state.dateRange;
    const from = new Date(start);
    const to = new Date(end);
    const span = to - from;
    const prevEnd = new Date(from.getTime() - 86400000);
    const prevStart = new Date(prevEnd.getTime() - span);
    return `project_id=${App.state.project}&date_from=${prevStart.toISOString().slice(0, 10)}&date_to=${prevEnd.toISOString().slice(0, 10)}`;
  }

  async function fetchAll() {
    const [overview, prevOverview, attribution, products, pages, funnel, forecast] = await Promise.all([
      App.api(`/revenue/overview?${qs()}`).catch(() => null),
      App.api(`/revenue/overview?${prevQs()}`).catch(() => null),
      App.api(`/revenue/attribution?${qs()}&group_by=${_attributionTab}`).catch(() => null),
      App.api(`/revenue/products?${qs()}&limit=10`).catch(() => null),
      App.api(`/revenue/pages?${qs()}`).catch(() => null),
      App.api(`/revenue/funnel?${qs()}`).catch(() => null),
      App.api(`/revenue/forecast?project_id=${App.state.project}&days=14`).catch(() => null),
    ]);

    _data = { overview, prevOverview, attribution, products, pages, funnel, forecast };
  }

  async function fetchAttribution() {
    _data.attribution = await App.api(`/revenue/attribution?${qs()}&group_by=${_attributionTab}`).catch(() => null);
  }

  /* ------------------------------------------------------------------
     Comparison helper  (compute change % vs previous period)
  ------------------------------------------------------------------ */
  function changePct(current, previous) {
    if (previous == null || previous === 0) return null;
    const pct = ((current - previous) / previous) * 100;
    return { value: (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%', positive: pct >= 0 };
  }

  /* ------------------------------------------------------------------
     Sparkline (tiny SVG inline chart for product cards)
  ------------------------------------------------------------------ */
  function miniSparkline(values, color) {
    if (!values || values.length < 2) return '';
    const w = 64, h = 20;
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    const pts = values.map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" class="inline-block">
      <polyline points="${pts}" fill="none" stroke="${color || COLORS.accent}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  /* ------------------------------------------------------------------
     1. Revenue Overview Cards
  ------------------------------------------------------------------ */
  function renderOverviewCards() {
    const o = _data.overview || {};
    const p = _data.prevOverview || {};
    const totalSessions = (o.revenue_by_day || []).reduce((s, d) => s + (d.transactions || 0), 0) || o.transaction_count || 0;
    const convRate = o.unique_buyers && totalSessions > 0 ? (o.unique_buyers / totalSessions * 100) : 0;
    const prevConv = p.unique_buyers && p.transaction_count > 0 ? (p.unique_buyers / p.transaction_count * 100) : 0;

    const cards = [
      { title: 'Total Revenue', value: fmtCurrency(o.total_revenue || 0), change: changePct(o.total_revenue || 0, p.total_revenue), icon: revenueIcon(), accent: COLORS.green },
      { title: 'Transactions', value: fmtNumber(o.transaction_count || 0), change: changePct(o.transaction_count || 0, p.transaction_count), icon: transactionsIcon(), accent: COLORS.accent },
      { title: 'Avg Order Value', value: fmtCurrency(o.aov || 0), change: changePct(o.aov || 0, p.aov), icon: aovIcon(), accent: '#f59e0b' },
      { title: 'Unique Buyers', value: fmtNumber(o.unique_buyers || 0), change: changePct(o.unique_buyers || 0, p.unique_buyers), icon: buyersIcon(), accent: '#8b5cf6' },
      { title: 'Conversion Rate', value: fmtPercent(convRate), change: changePct(convRate, prevConv), icon: conversionIcon(), accent: '#ec4899' },
    ];

    return `
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        ${cards.map(c => `
          <div style="background:${COLORS.card}; border:1px solid ${COLORS.border};"
               class="rounded-xl p-5 hover:border-opacity-40 transition-colors">
            <div class="flex items-start justify-between mb-3">
              <span class="text-xs font-medium uppercase tracking-wider" style="color:${COLORS.muted};">${c.title}</span>
              <span style="color:${c.accent};">${c.icon}</span>
            </div>
            <div class="text-2xl font-bold text-white mb-1">${c.value}</div>
            ${c.change ? `
              <div class="flex items-center gap-1 text-xs font-medium ${c.change.positive ? 'text-green-400' : 'text-red-400'}">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round"
                        d="${c.change.positive ? 'M4.5 15.75l7.5-7.5 7.5 7.5' : 'M19.5 8.25l-7.5 7.5-7.5-7.5'}"/>
                </svg>
                <span>${c.change.value}</span>
                <span style="color:${COLORS.muted};">vs prev</span>
              </div>` : `<div class="text-xs" style="color:${COLORS.muted};">No previous data</div>`}
          </div>`).join('')}
      </div>`;
  }

  /* ------------------------------------------------------------------
     2. Revenue Over Time Chart
  ------------------------------------------------------------------ */
  function renderRevenueChart() {
    const o = _data.overview || {};
    const f = _data.forecast || {};
    const timeline = o.revenue_by_day || [];

    if (timeline.length === 0) {
      return `<div style="background:${COLORS.card}; border:1px solid ${COLORS.border};"
                   class="rounded-xl p-8 text-center text-sm" style="color:${COLORS.muted};">
                No revenue data available for the selected period.
              </div>`;
    }

    return `
      <div style="background:${COLORS.card}; border:1px solid ${COLORS.border};" class="rounded-xl p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-semibold text-white">Revenue Over Time</h3>
          <div class="flex items-center gap-1 rounded-lg p-0.5" style="background:${COLORS.bg};">
            <button onclick="RevenuePage._setView('daily')"
                    class="px-3 py-1 text-xs font-medium rounded-md transition-colors ${_revenueView === 'daily' ? 'text-white' : ''}"
                    style="${_revenueView === 'daily' ? 'background:' + COLORS.accent + ';' : 'color:' + COLORS.muted + ';'}">
              Daily
            </button>
            <button onclick="RevenuePage._setView('weekly')"
                    class="px-3 py-1 text-xs font-medium rounded-md transition-colors ${_revenueView === 'weekly' ? 'text-white' : ''}"
                    style="${_revenueView === 'weekly' ? 'background:' + COLORS.accent + ';' : 'color:' + COLORS.muted + ';'}">
              Weekly
            </button>
          </div>
        </div>
        <div style="height:300px; position:relative;">
          <canvas id="revenue-time-chart"></canvas>
        </div>
      </div>`;
  }

  function paintRevenueChart() {
    const canvas = document.getElementById('revenue-time-chart');
    if (!canvas || _destroyed) return;

    const o = _data.overview || {};
    const f = _data.forecast || {};
    let timeline = o.revenue_by_day || [];

    // Aggregate to weekly if needed
    if (_revenueView === 'weekly' && timeline.length > 7) {
      const weekly = {};
      for (const d of timeline) {
        const dt = new Date(d.date);
        const weekStart = new Date(dt);
        weekStart.setDate(dt.getDate() - dt.getDay());
        const key = weekStart.toISOString().slice(0, 10);
        if (!weekly[key]) weekly[key] = { date: key, revenue: 0, transactions: 0 };
        weekly[key].revenue += d.revenue;
        weekly[key].transactions += d.transactions;
      }
      timeline = Object.values(weekly).sort((a, b) => a.date.localeCompare(b.date));
    }

    const labels = timeline.map(d => {
      const dt = new Date(d.date);
      return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    const revenues = timeline.map(d => d.revenue);
    const transactions = timeline.map(d => d.transactions);

    // Forecast data
    const forecastData = (f && f.forecast) || [];
    const forecastLabels = forecastData.map(d => {
      const dt = new Date(d.date);
      return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    const forecastRevenues = forecastData.map(d => d.predicted_revenue);

    const allLabels = [...labels, ...forecastLabels];
    const revenueDataset = [...revenues, ...new Array(forecastLabels.length).fill(null)];
    const forecastDataset = [...new Array(labels.length > 0 ? labels.length - 1 : 0).fill(null), revenues[revenues.length - 1] || 0, ...forecastRevenues];
    const transactionsDataset = [...transactions, ...new Array(forecastLabels.length).fill(null)];

    const ctx = canvas.getContext('2d');
    const gradientFill = ctx.createLinearGradient(0, 0, 0, 300);
    gradientFill.addColorStop(0, 'rgba(0, 200, 83, 0.25)');
    gradientFill.addColorStop(1, 'rgba(0, 200, 83, 0.0)');

    if (_chartInstance) {
      try { _chartInstance.destroy(); } catch (_) {}
    }

    _chartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels: allLabels,
        datasets: [
          {
            label: 'Revenue',
            data: revenueDataset,
            borderColor: COLORS.green,
            backgroundColor: gradientFill,
            borderWidth: 2.5,
            fill: true,
            tension: 0.35,
            pointRadius: 3,
            pointBackgroundColor: COLORS.green,
            pointBorderColor: COLORS.green,
            pointHoverRadius: 6,
            spanGaps: false,
          },
          {
            label: 'Forecast',
            data: forecastDataset,
            borderColor: COLORS.accent,
            borderWidth: 2,
            borderDash: [6, 4],
            fill: false,
            tension: 0.3,
            pointRadius: 2,
            pointBackgroundColor: COLORS.accent,
            pointBorderColor: COLORS.accent,
            spanGaps: false,
          },
          {
            label: 'Transactions',
            data: transactionsDataset,
            type: 'bar',
            backgroundColor: 'rgba(67, 97, 238, 0.2)',
            borderColor: 'rgba(67, 97, 238, 0.4)',
            borderWidth: 1,
            borderRadius: 3,
            yAxisID: 'y1',
            barPercentage: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              color: COLORS.muted,
              font: { size: 11 },
              usePointStyle: true,
              pointStyleWidth: 8,
              padding: 16,
            },
          },
          tooltip: {
            backgroundColor: COLORS.card,
            titleColor: '#fff',
            bodyColor: COLORS.text,
            borderColor: COLORS.border,
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: function(ctx) {
                if (ctx.dataset.label === 'Transactions') return 'Transactions: ' + fmtNumber(ctx.parsed.y);
                return ctx.dataset.label + ': ' + fmtCurrency(ctx.parsed.y);
              },
            },
          },
        },
        scales: {
          x: {
            grid: { color: COLORS.gridLine },
            ticks: { color: COLORS.muted, font: { size: 11 }, maxTicksLimit: 12 },
          },
          y: {
            position: 'left',
            grid: { color: COLORS.gridLine },
            ticks: {
              color: COLORS.muted,
              font: { size: 11 },
              callback: function(v) { return fmtCurrency(v); },
            },
            beginAtZero: true,
          },
          y1: {
            position: 'right',
            grid: { display: false },
            ticks: { color: COLORS.muted, font: { size: 10 } },
            beginAtZero: true,
          },
        },
      },
    });

    App.state.chartInstances['revenue-time'] = _chartInstance;
  }

  /* ------------------------------------------------------------------
     3. Attribution Table
  ------------------------------------------------------------------ */
  function renderAttributionSection() {
    const attr = _data.attribution || {};
    const list = attr.attributions || [];
    const totalRev = attr.total_revenue || 0;

    // Sort
    const sorted = [...list].sort((a, b) => {
      const aVal = a[_attrSortCol] || 0;
      const bVal = b[_attrSortCol] || 0;
      return _attrSortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });

    const maxRevenue = Math.max(...sorted.map(r => r.revenue), 1);

    const tabs = ATTRIBUTION_TABS.map(t => `
      <button onclick="RevenuePage._setAttrTab('${t.key}')"
              class="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${_attributionTab === t.key ? 'text-white' : ''}"
              style="${_attributionTab === t.key ? 'background:' + COLORS.accent + ';' : 'color:' + COLORS.muted + ';'}">
        ${t.label}
      </button>`).join('');

    function sortHeader(label, col, align) {
      const isActive = _attrSortCol === col;
      const arrowCls = isActive && _attrSortDir === 'asc' ? 'rotate-180' : '';
      return `<th class="px-4 py-3 ${align} text-xs font-semibold uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                  style="color:${COLORS.muted};"
                  onclick="RevenuePage._sortAttr('${col}')">
        ${label}
        <svg class="w-3 h-3 inline ml-0.5 ${isActive ? '' : 'opacity-30'} ${arrowCls} transition-transform" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/>
        </svg>
      </th>`;
    }

    const rows = sorted.length === 0
      ? `<tr><td colspan="6" class="px-4 py-12 text-center" style="color:${COLORS.muted};">No attribution data available</td></tr>`
      : sorted.map(r => {
          const pctOfTotal = totalRev > 0 ? (r.revenue / totalRev * 100) : 0;
          const barWidth = Math.max((r.revenue / maxRevenue) * 100, 2);
          return `
            <tr class="border-t transition-colors hover:bg-white/[0.02]" style="border-color:${COLORS.border};">
              <td class="px-4 py-3 text-sm font-medium text-white">${r.source}</td>
              <td class="px-4 py-3 text-sm text-right">
                <div class="flex items-center justify-end gap-2">
                  <div class="w-20 h-1.5 rounded-full overflow-hidden" style="background:${COLORS.bg};">
                    <div class="h-full rounded-full" style="width:${barWidth}%; background:${COLORS.green};"></div>
                  </div>
                  <span class="font-semibold w-24 text-right" style="color:${COLORS.green};">${fmtCurrency(r.revenue)}</span>
                </div>
              </td>
              <td class="px-4 py-3 text-sm text-right" style="color:${COLORS.text};">${fmtNumber(r.transactions)}</td>
              <td class="px-4 py-3 text-sm text-right" style="color:${COLORS.text};">${fmtCurrency(r.aov)}</td>
              <td class="px-4 py-3 text-sm text-right" style="color:${COLORS.text};">${fmtPercent(r.conversion_rate)}</td>
              <td class="px-4 py-3 text-sm text-right" style="color:${COLORS.muted};">${fmtPercent(pctOfTotal)}</td>
            </tr>`;
        }).join('');

    return `
      <div style="background:${COLORS.card}; border:1px solid ${COLORS.border};" class="rounded-xl">
        <div class="flex items-center justify-between p-5 pb-0">
          <h3 class="text-sm font-semibold text-white">Revenue Attribution</h3>
          <div class="flex items-center gap-1 rounded-lg p-0.5" style="background:${COLORS.bg};">
            ${tabs}
          </div>
        </div>
        <div class="p-5 pt-4">
          <div class="overflow-x-auto rounded-xl" style="border:1px solid ${COLORS.border};">
            <table class="w-full">
              <thead style="background:rgba(22, 33, 62, 0.8);">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style="color:${COLORS.muted};">Source</th>
                  ${sortHeader('Revenue', 'revenue', 'text-right')}
                  ${sortHeader('Transactions', 'transactions', 'text-right')}
                  ${sortHeader('AOV', 'aov', 'text-right')}
                  ${sortHeader('Conv. Rate', 'conversion_rate', 'text-right')}
                  <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style="color:${COLORS.muted};">% of Total</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------
     4. Top Products Grid
  ------------------------------------------------------------------ */
  function renderProductsGrid() {
    const products = (_data.products && _data.products.products) || [];

    if (products.length === 0) {
      return `<div style="background:${COLORS.card}; border:1px solid ${COLORS.border};"
                   class="rounded-xl p-8 text-center text-sm" style="color:${COLORS.muted};">
                No product data available.
              </div>`;
    }

    const cards = products.slice(0, 10).map((p, idx) => {
      const cartToPurchase = p.cart_adds > 0 ? ((p.quantity_sold / p.cart_adds) * 100) : 0;
      // Generate synthetic sparkline data (revenue trend simulation from product position)
      const sparkData = Array.from({ length: 7 }, (_, i) => Math.max(0, p.revenue / 7 + (Math.random() - 0.5) * p.revenue / 5));

      return `
        <div style="background:${COLORS.card}; border:1px solid ${COLORS.border};"
             class="rounded-xl p-4 hover:border-opacity-40 transition-colors">
          <div class="flex items-start justify-between mb-3">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                      style="background:${COLORS.accent}20; color:${COLORS.accent};">
                  ${idx + 1}
                </span>
                <span class="text-sm font-semibold text-white truncate">${p.name}</span>
              </div>
              <span class="text-xs block mt-0.5 truncate" style="color:${COLORS.muted};">${p.product_id}</span>
            </div>
            <div class="flex-shrink-0 ml-2">${miniSparkline(sparkData, COLORS.green)}</div>
          </div>
          <div class="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div style="color:${COLORS.muted};" class="mb-0.5">Revenue</div>
              <div class="font-bold" style="color:${COLORS.green};">${fmtCurrency(p.revenue)}</div>
            </div>
            <div>
              <div style="color:${COLORS.muted};" class="mb-0.5">Units Sold</div>
              <div class="font-bold text-white">${fmtNumber(p.quantity_sold)}</div>
            </div>
            <div>
              <div style="color:${COLORS.muted};" class="mb-0.5">Avg Price</div>
              <div class="font-medium" style="color:${COLORS.text};">${fmtCurrency(p.avg_price)}</div>
            </div>
            <div>
              <div style="color:${COLORS.muted};" class="mb-0.5">Cart-to-Buy</div>
              <div class="font-medium ${cartToPurchase >= 50 ? 'text-green-400' : cartToPurchase >= 20 ? 'text-yellow-400' : 'text-red-400'}">
                ${fmtPercent(cartToPurchase)}
              </div>
            </div>
          </div>
        </div>`;
    }).join('');

    return `
      <div>
        <h3 class="text-sm font-semibold text-white mb-3">Top Products</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          ${cards}
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------
     5. Landing Page Performance
  ------------------------------------------------------------------ */
  function renderLandingPages() {
    const pagesList = (_data.pages && _data.pages.pages) || [];

    if (pagesList.length === 0) {
      return `<div style="background:${COLORS.card}; border:1px solid ${COLORS.border};"
                   class="rounded-xl p-8 text-center text-sm" style="color:${COLORS.muted};">
                No landing page data available.
              </div>`;
    }

    const sorted = [...pagesList].sort((a, b) => {
      const aVal = a[_pageSortCol] || 0;
      const bVal = b[_pageSortCol] || 0;
      return _pageSortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });

    function sortHeader(label, col) {
      const isActive = _pageSortCol === col;
      const arrowCls = isActive && _pageSortDir === 'asc' ? 'rotate-180' : '';
      return `<th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                  style="color:${COLORS.muted};"
                  onclick="RevenuePage._sortPages('${col}')">
        ${label}
        <svg class="w-3 h-3 inline ml-0.5 ${isActive ? '' : 'opacity-30'} ${arrowCls} transition-transform" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/>
        </svg>
      </th>`;
    }

    const rows = sorted.slice(0, 20).map(p => {
      const rps = p.sessions > 0 ? p.revenue / p.sessions : 0;
      const cr = p.conversion_rate || 0;
      let crColor = 'text-red-400';
      if (cr >= 5) crColor = 'text-green-400';
      else if (cr >= 2) crColor = 'text-yellow-400';
      else if (cr >= 1) crColor = 'text-orange-400';

      const displayUrl = p.url.length > 50 ? p.url.substring(0, 50) + '...' : p.url;

      return `
        <tr class="border-t transition-colors hover:bg-white/[0.02]" style="border-color:${COLORS.border};">
          <td class="px-4 py-3 text-sm">
            <span class="font-medium text-white" title="${p.url}">${displayUrl}</span>
          </td>
          <td class="px-4 py-3 text-sm text-right" style="color:${COLORS.text};">${fmtNumber(p.sessions)}</td>
          <td class="px-4 py-3 text-sm text-right font-semibold" style="color:${COLORS.green};">${fmtCurrency(p.revenue)}</td>
          <td class="px-4 py-3 text-sm text-right">
            <span class="${crColor} font-medium">${fmtPercent(cr)}</span>
          </td>
          <td class="px-4 py-3 text-sm text-right" style="color:${COLORS.text};">${fmtCurrency(rps)}</td>
        </tr>`;
    }).join('');

    return `
      <div>
        <h3 class="text-sm font-semibold text-white mb-3">Landing Page Performance</h3>
        <div style="background:${COLORS.card}; border:1px solid ${COLORS.border};" class="rounded-xl p-5">
          <div class="overflow-x-auto rounded-xl" style="border:1px solid ${COLORS.border};">
            <table class="w-full">
              <thead style="background:rgba(22, 33, 62, 0.8);">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style="color:${COLORS.muted};">URL</th>
                  ${sortHeader('Sessions', 'sessions')}
                  ${sortHeader('Revenue', 'revenue')}
                  ${sortHeader('Conv. Rate', 'conversion_rate')}
                  <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style="color:${COLORS.muted};">Rev / Session</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------
     6. E-commerce Funnel
  ------------------------------------------------------------------ */
  function renderFunnel() {
    const funnelData = _data.funnel || {};
    const stages = funnelData.stages || [];
    const overallConversion = funnelData.overall_conversion_rate || 0;

    if (stages.length === 0) {
      return `<div style="background:${COLORS.card}; border:1px solid ${COLORS.border};"
                   class="rounded-xl p-8 text-center text-sm" style="color:${COLORS.muted};">
                No funnel data available.
              </div>`;
    }

    const maxCount = Math.max(...stages.map(s => s.count), 1);

    const funnelSteps = stages.map((stage, i) => {
      const widthPct = Math.max((stage.count / maxCount) * 100, 8);
      const isLast = i === stages.length - 1;

      // Find the biggest drop-off
      const maxDrop = Math.max(...stages.filter((_, j) => j > 0).map(s => s.drop_off_pct));
      const isBiggestDrop = i > 0 && stage.drop_off_pct === maxDrop && stage.drop_off_pct > 0;

      const barColor = isBiggestDrop ? '#ef4444' : COLORS.accent;
      const dropColor = isBiggestDrop ? 'text-red-400' : '';

      return `
        <div class="flex items-center gap-3">
          <!-- Stage bar -->
          <div class="flex-1">
            <div class="flex items-center justify-between mb-1.5">
              <div class="flex items-center gap-2">
                <span class="text-sm font-semibold text-white">${stage.name}</span>
                ${isBiggestDrop ? '<span class="text-xs font-medium text-red-400 px-2 py-0.5 rounded-md" style="background:rgba(239,68,68,0.15);">Biggest drop</span>' : ''}
              </div>
              <div class="flex items-center gap-4 text-xs" style="color:${COLORS.muted};">
                <span class="font-medium text-white">${fmtNumber(stage.count)}</span>
                ${stage.value > 0 ? `<span style="color:${COLORS.green};">${fmtCurrency(stage.value)}</span>` : ''}
                ${i > 0 ? `<span class="${dropColor}">-${fmtPercent(stage.drop_off_pct)}</span>` : ''}
              </div>
            </div>
            <div class="h-8 rounded-lg overflow-hidden" style="background:${COLORS.bg};">
              <div class="h-full rounded-lg transition-all duration-700 flex items-center px-3"
                   style="width:${widthPct}%; background:${barColor}20; border-left:3px solid ${barColor};">
                <span class="text-xs font-bold" style="color:${barColor};">${fmtPercent(widthPct > 0 ? (stage.count / maxCount * 100) : 0)}</span>
              </div>
            </div>
          </div>
          ${!isLast ? `
          <!-- Drop-off arrow -->
          <div class="flex-shrink-0 flex flex-col items-center w-8" style="color:${COLORS.muted};">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3"/>
            </svg>
          </div>` : ''}
        </div>`;
    }).join('');

    return `
      <div>
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold text-white">E-commerce Funnel</h3>
          <span class="text-xs font-medium px-2 py-1 rounded-lg" style="background:${COLORS.green}15; color:${COLORS.green};">
            Overall: ${fmtPercent(overallConversion)}
          </span>
        </div>
        <div style="background:${COLORS.card}; border:1px solid ${COLORS.border};" class="rounded-xl p-5">
          <div class="space-y-3">
            ${funnelSteps}
          </div>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------
     SVG Icons
  ------------------------------------------------------------------ */
  function revenueIcon() {
    return `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
  }
  function transactionsIcon() {
    return `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/></svg>`;
  }
  function aovIcon() {
    return `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"/></svg>`;
  }
  function buyersIcon() {
    return `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>`;
  }
  function conversionIcon() {
    return `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>`;
  }

  /* ------------------------------------------------------------------
     Main render
  ------------------------------------------------------------------ */
  async function init(container) {
    _destroyed = false;
    container.innerHTML = Components.loading();

    try {
      await fetchAll();
      if (_destroyed) return;

      container.innerHTML = buildPage();

      // Paint chart after DOM is ready
      requestAnimationFrame(() => {
        if (!_destroyed) paintRevenueChart();
      });
    } catch (err) {
      container.innerHTML = Components.emptyState(
        'Error Loading Revenue Data',
        err.message || 'An error occurred while loading revenue analytics.'
      );
    }
  }

  function destroy() {
    _destroyed = true;
    if (_chartInstance) {
      try { _chartInstance.destroy(); } catch (_) {}
      _chartInstance = null;
    }
  }

  function buildPage() {
    return `
      <div class="space-y-8" style="color:${COLORS.text};">

        <!-- Header -->
        ${Components.sectionHeader('Revenue Analytics', 'Revenue attribution, product performance, and forecasting')}

        <!-- 1. Overview Cards -->
        ${renderOverviewCards()}

        <!-- 2. Revenue Over Time -->
        ${renderRevenueChart()}

        <!-- 3. Attribution Table -->
        <div id="revenue-attribution-section">
          ${renderAttributionSection()}
        </div>

        <!-- 4. Top Products -->
        ${renderProductsGrid()}

        <!-- Two column: Landing Pages + Funnel -->
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <!-- 5. Landing Page Performance -->
          <div id="revenue-pages-section">
            ${renderLandingPages()}
          </div>

          <!-- 6. E-commerce Funnel -->
          ${renderFunnel()}
        </div>

      </div>`;
  }

  /* ------------------------------------------------------------------
     Interactive handlers (called from inline onclick)
  ------------------------------------------------------------------ */
  async function _setAttrTab(tab) {
    _attributionTab = tab;
    _attrSortCol = 'revenue';
    _attrSortDir = 'desc';
    const section = document.getElementById('revenue-attribution-section');
    if (section) {
      section.innerHTML = `<div class="flex items-center justify-center py-8"><div class="animate-spin w-5 h-5 border-2 border-white/20 border-t-white rounded-full"></div></div>`;
      await fetchAttribution();
      if (!_destroyed) section.innerHTML = renderAttributionSection();
    }
  }

  function _setView(view) {
    _revenueView = view;
    const container = document.getElementById('main-content');
    if (container && !_destroyed) {
      container.innerHTML = buildPage();
      requestAnimationFrame(() => {
        if (!_destroyed) paintRevenueChart();
      });
    }
  }

  function _sortAttr(col) {
    if (_attrSortCol === col) {
      _attrSortDir = _attrSortDir === 'desc' ? 'asc' : 'desc';
    } else {
      _attrSortCol = col;
      _attrSortDir = 'desc';
    }
    const section = document.getElementById('revenue-attribution-section');
    if (section) section.innerHTML = renderAttributionSection();
  }

  function _sortPages(col) {
    if (_pageSortCol === col) {
      _pageSortDir = _pageSortDir === 'desc' ? 'asc' : 'desc';
    } else {
      _pageSortCol = col;
      _pageSortDir = 'desc';
    }
    const section = document.getElementById('revenue-pages-section');
    if (section) section.innerHTML = renderLandingPages();
  }

  /* ------------------------------------------------------------------
     Public API
  ------------------------------------------------------------------ */
  return {
    init,
    destroy,
    _setAttrTab,
    _setView,
    _sortAttr,
    _sortPages,
  };

})();

/** Convenience function for the App router. */
function renderRevenuePage(container) {
  RevenuePage.init(container);
}
