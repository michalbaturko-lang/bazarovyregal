/* ==========================================================================
   ecommerce-page.js  –  E-commerce Analytics Dashboard
   Revenue overview, cart abandonment, product performance, checkout funnel
   ========================================================================== */

const EcommercePage = (() => {

  /* ------------------------------------------------------------------
     State
  ------------------------------------------------------------------ */
  let _sortColumn = 'revenue';
  let _sortDir = 'desc';

  /* ------------------------------------------------------------------
     Data fetching
  ------------------------------------------------------------------ */
  async function fetchOverview() {
    const { start, end } = App.state.dateRange;
    return App.api(`/ecommerce/overview?project_id=${App.state.project}&date_from=${start}&date_to=${end}`);
  }

  async function fetchCartAbandonment() {
    const { start, end } = App.state.dateRange;
    return App.api(`/ecommerce/cart-abandonment?project_id=${App.state.project}&date_from=${start}&date_to=${end}`);
  }

  async function fetchProducts() {
    const { start, end } = App.state.dateRange;
    return App.api(`/ecommerce/products?project_id=${App.state.project}&date_from=${start}&date_to=${end}`);
  }

  async function fetchCheckoutFunnel() {
    const { start, end } = App.state.dateRange;
    return App.api(`/ecommerce/checkout-funnel?project_id=${App.state.project}&date_from=${start}&date_to=${end}`);
  }

  /* ------------------------------------------------------------------
     Format helpers
  ------------------------------------------------------------------ */
  function formatCurrency(amount, currency) {
    currency = currency || 'CZK';
    if (amount == null || isNaN(amount)) return '--';
    return Number(amount).toLocaleString('cs-CZ', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }

  function formatPercent(val) {
    if (val == null || isNaN(val)) return '--';
    return val.toFixed(1) + '%';
  }

  /* ------------------------------------------------------------------
     Revenue Chart
  ------------------------------------------------------------------ */
  function renderRevenueChart(canvasId, data) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const labels = data.map(d => {
      const dt = new Date(d.date);
      return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    const values = data.map(d => d.revenue);

    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Revenue',
          data: values,
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: '#22c55e',
          pointBorderColor: '#22c55e',
          pointHoverRadius: 5,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e293b',
            titleColor: '#e2e8f0',
            bodyColor: '#94a3b8',
            borderColor: '#334155',
            borderWidth: 1,
            callbacks: {
              label: function(ctx) {
                return 'Revenue: ' + formatCurrency(ctx.parsed.y);
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(51, 65, 85, 0.3)' },
            ticks: { color: '#64748b', font: { size: 11 } },
          },
          y: {
            grid: { color: 'rgba(51, 65, 85, 0.3)' },
            ticks: {
              color: '#64748b',
              font: { size: 11 },
              callback: function(v) { return formatCurrency(v); }
            },
            beginAtZero: true,
          }
        }
      }
    });
    App.state.chartInstances['ecom-revenue'] = chart;
  }

  /* ------------------------------------------------------------------
     Funnel Chart (horizontal bar)
  ------------------------------------------------------------------ */
  function renderFunnelChart(canvasId, funnel) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const labels = funnel.map(s => s.label);
    const counts = funnel.map(s => s.count);
    const maxCount = Math.max(...counts, 1);

    // Color gradient from green to red
    const colors = funnel.map((s, i) => {
      const ratio = i / Math.max(funnel.length - 1, 1);
      const r = Math.round(34 + ratio * (239 - 34));
      const g = Math.round(197 - ratio * (197 - 68));
      const b = Math.round(94 - ratio * (94 - 68));
      return `rgba(${r}, ${g}, ${b}, 0.7)`;
    });

    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Sessions',
          data: counts,
          backgroundColor: colors,
          borderColor: colors.map(c => c.replace('0.7', '1')),
          borderWidth: 1,
          borderRadius: 4,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e293b',
            titleColor: '#e2e8f0',
            bodyColor: '#94a3b8',
            borderColor: '#334155',
            borderWidth: 1,
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(51, 65, 85, 0.3)' },
            ticks: { color: '#64748b', font: { size: 11 } },
            beginAtZero: true,
          },
          y: {
            grid: { display: false },
            ticks: { color: '#e2e8f0', font: { size: 12, weight: '500' } },
          }
        }
      }
    });
    App.state.chartInstances['ecom-funnel'] = chart;
  }

  /* ------------------------------------------------------------------
     Exit Reasons Pie Chart
  ------------------------------------------------------------------ */
  function renderExitPieChart(canvasId, exitPages) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const labels = exitPages.slice(0, 6).map(p => {
      const url = p.url || 'Unknown';
      return url.length > 30 ? url.substring(0, 30) + '...' : url;
    });
    const values = exitPages.slice(0, 6).map(p => p.count);
    const colors = ['#3b82f6', '#ef4444', '#f59e0b', '#22c55e', '#8b5cf6', '#ec4899'];

    const chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors.slice(0, values.length),
          borderColor: '#1e293b',
          borderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#94a3b8',
              font: { size: 11 },
              padding: 12,
              usePointStyle: true,
              pointStyleWidth: 8,
            }
          },
          tooltip: {
            backgroundColor: '#1e293b',
            titleColor: '#e2e8f0',
            bodyColor: '#94a3b8',
            borderColor: '#334155',
            borderWidth: 1,
          }
        },
        cutout: '60%',
      }
    });
    App.state.chartInstances['ecom-exitpie'] = chart;
  }

  /* ------------------------------------------------------------------
     Funnel Visualization (step boxes)
  ------------------------------------------------------------------ */
  function renderFunnelVisualization(funnel) {
    if (!funnel || funnel.length === 0) {
      return Components.emptyState('No Funnel Data', 'No checkout funnel data available for this period.');
    }

    // Find the biggest drop-off step
    let maxDropIdx = -1;
    let maxDropRate = 0;
    funnel.forEach((s, i) => {
      if (i > 0 && s.drop_off_rate > maxDropRate) {
        maxDropRate = s.drop_off_rate;
        maxDropIdx = i;
      }
    });

    const steps = funnel.map((step, i) => {
      const isMaxDrop = (i === maxDropIdx);
      const borderColor = isMaxDrop ? 'border-red-500/60' : 'border-slate-700/50';
      const dropBg = isMaxDrop ? 'bg-red-500/10' : '';

      // Width based on conversion from first step
      const widthPct = Math.max(step.conversion_from_first, 8);

      return `
        <div class="flex items-stretch gap-0">
          <div class="flex-1 ${dropBg} rounded-xl border ${borderColor} p-4 transition-colors">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-semibold text-white">${step.label}</span>
              ${isMaxDrop ? '<span class="text-xs font-medium text-red-400 bg-red-500/15 px-2 py-0.5 rounded-md">Biggest drop</span>' : ''}
            </div>
            <div class="text-2xl font-bold text-white mb-1">${App.formatNumber(step.count)}</div>
            <div class="flex items-center gap-3 text-xs text-slate-400">
              ${i > 0 ? `<span>Conv: <span class="text-slate-200 font-medium">${formatPercent(step.conversion_from_prev)}</span></span>` : '<span>Entry point</span>'}
              ${i > 0 ? `<span>Drop: <span class="${isMaxDrop ? 'text-red-400' : 'text-slate-200'} font-medium">${App.formatNumber(step.drop_off)}</span></span>` : ''}
              ${step.avg_time_seconds > 0 ? `<span>Avg time: <span class="text-slate-200 font-medium">${App.formatDuration(step.avg_time_seconds)}</span></span>` : ''}
            </div>
            <!-- Progress bar showing relative size -->
            <div class="mt-3 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-500 ${isMaxDrop ? 'bg-red-500' : 'bg-blue-500'}"
                   style="width: ${widthPct}%"></div>
            </div>
          </div>
          ${i < funnel.length - 1 ? `
          <div class="flex items-center px-2 text-slate-600">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/>
            </svg>
          </div>` : ''}
        </div>`;
    }).join('');

    return `<div class="flex items-stretch gap-0 overflow-x-auto pb-2">${steps}</div>`;
  }

  /* ------------------------------------------------------------------
     Product Performance Table
  ------------------------------------------------------------------ */
  function renderProductTable(products) {
    if (!products || products.length === 0) {
      return Components.emptyState('No Product Data', 'No product performance data available yet.');
    }

    // Sort products
    const sorted = [...products].sort((a, b) => {
      const aVal = a[_sortColumn] || 0;
      const bVal = b[_sortColumn] || 0;
      return _sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });

    const maxViews = Math.max(...sorted.map(p => p.views), 1);
    const maxCart = Math.max(...sorted.map(p => p.add_to_cart_count), 1);
    const maxPurchase = Math.max(...sorted.map(p => p.purchase_count), 1);
    const maxRevenue = Math.max(...sorted.map(p => p.revenue), 1);

    const rows = sorted.map(p => {
      // Color code conversion rate
      const cr = p.conversion_rate || 0;
      let crColor = 'text-red-400';
      if (cr >= 10) crColor = 'text-green-400';
      else if (cr >= 5) crColor = 'text-yellow-400';
      else if (cr >= 2) crColor = 'text-orange-400';

      // Mini bar widths
      const viewsW = Math.max((p.views / maxViews) * 100, 2);
      const cartW = Math.max((p.add_to_cart_count / maxCart) * 100, 2);
      const purchaseW = Math.max((p.purchase_count / maxPurchase) * 100, 2);
      const revenueW = Math.max((p.revenue / maxRevenue) * 100, 2);

      return `
        <tr class="border-t border-slate-700/50 hover:bg-slate-700/30 transition-colors">
          <td class="px-4 py-3 text-sm">
            <span class="font-medium text-white">${p.name || p.product_id}</span>
            <span class="block text-xs text-slate-500">${p.product_id}</span>
          </td>
          <td class="px-4 py-3 text-sm text-right">
            <div class="flex items-center justify-end gap-2">
              <div class="w-16 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                <div class="h-full bg-blue-500/70 rounded-full" style="width:${viewsW}%"></div>
              </div>
              <span class="text-slate-300 w-12 text-right">${App.formatNumber(p.views)}</span>
            </div>
          </td>
          <td class="px-4 py-3 text-sm text-right">
            <div class="flex items-center justify-end gap-2">
              <div class="w-16 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                <div class="h-full bg-yellow-500/70 rounded-full" style="width:${cartW}%"></div>
              </div>
              <span class="text-slate-300 w-12 text-right">${App.formatNumber(p.add_to_cart_count)}</span>
            </div>
          </td>
          <td class="px-4 py-3 text-sm text-right">
            <div class="flex items-center justify-end gap-2">
              <div class="w-16 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                <div class="h-full bg-green-500/70 rounded-full" style="width:${purchaseW}%"></div>
              </div>
              <span class="text-slate-300 w-12 text-right">${App.formatNumber(p.purchase_count)}</span>
            </div>
          </td>
          <td class="px-4 py-3 text-sm text-right">
            <span class="font-medium ${crColor}">${formatPercent(cr)}</span>
          </td>
          <td class="px-4 py-3 text-sm text-right">
            <div class="flex items-center justify-end gap-2">
              <div class="w-16 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                <div class="h-full bg-emerald-500/70 rounded-full" style="width:${revenueW}%"></div>
              </div>
              <span class="font-semibold text-green-400 w-20 text-right">${formatCurrency(p.revenue)}</span>
            </div>
          </td>
        </tr>`;
    }).join('');

    function sortIcon(col) {
      const active = _sortColumn === col;
      const arrow = active && _sortDir === 'asc' ? 'rotate-180' : '';
      return `<svg class="w-3 h-3 inline ml-0.5 ${active ? 'text-blue-400' : 'opacity-30'} ${arrow} transition-transform" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/>
      </svg>`;
    }

    return `
      <div class="overflow-x-auto rounded-xl border border-slate-700/50">
        <table class="w-full">
          <thead class="bg-slate-800/80">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Product</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200"
                  onclick="EcommercePage.sortProducts('views')">Views ${sortIcon('views')}</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200"
                  onclick="EcommercePage.sortProducts('add_to_cart_count')">Add to Cart ${sortIcon('add_to_cart_count')}</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200"
                  onclick="EcommercePage.sortProducts('purchase_count')">Purchases ${sortIcon('purchase_count')}</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200"
                  onclick="EcommercePage.sortProducts('conversion_rate')">Conversion ${sortIcon('conversion_rate')}</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200"
                  onclick="EcommercePage.sortProducts('revenue')">Revenue ${sortIcon('revenue')}</th>
            </tr>
          </thead>
          <tbody class="bg-slate-800/30">${rows}</tbody>
        </table>
      </div>`;
  }

  /* ------------------------------------------------------------------
     Abandoned Carts Table
  ------------------------------------------------------------------ */
  function renderAbandonedCartsTable(sessions) {
    if (!sessions || sessions.length === 0) {
      return `<p class="text-sm text-slate-500 py-4 text-center">No abandoned carts in this period.</p>`;
    }

    const rows = sessions.slice(0, 15).map(s => {
      const productNames = (s.products || []).map(p => p.name || p.id).join(', ');
      const truncatedProducts = productNames.length > 60
        ? productNames.substring(0, 60) + '...'
        : productNames;

      return `
        <tr class="border-t border-slate-700/50 hover:bg-slate-700/30 transition-colors cursor-pointer"
            onclick="App.navigate('sessions/${s.session_id}')">
          <td class="px-4 py-3 text-sm">
            <span class="text-blue-400 hover:underline font-mono text-xs">${(s.session_id || '').substring(0, 8)}...</span>
          </td>
          <td class="px-4 py-3 text-sm text-slate-300" title="${productNames}">${truncatedProducts}</td>
          <td class="px-4 py-3 text-sm text-right font-semibold text-white">${formatCurrency(s.total_value)}</td>
          <td class="px-4 py-3 text-sm text-slate-400 text-right" title="${s.exit_page}">
            ${(s.exit_page || '').length > 30 ? (s.exit_page || '').substring(0, 30) + '...' : (s.exit_page || 'Unknown')}
          </td>
        </tr>`;
    }).join('');

    return `
      <div class="overflow-x-auto rounded-xl border border-slate-700/50">
        <table class="w-full">
          <thead class="bg-slate-800/80">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Session</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Products</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Value</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Exit Page</th>
            </tr>
          </thead>
          <tbody class="bg-slate-800/30">${rows}</tbody>
        </table>
      </div>`;
  }

  /* ------------------------------------------------------------------
     Checkout Flow Analysis
  ------------------------------------------------------------------ */
  function renderCheckoutFlow(funnel) {
    if (!funnel || funnel.length === 0) {
      return Components.emptyState('No Checkout Data', 'No checkout flow data available for this period.');
    }

    const steps = funnel.map((step, i) => {
      const dropRateColor = step.drop_off_rate > 50 ? 'text-red-400' : step.drop_off_rate > 25 ? 'text-yellow-400' : 'text-green-400';

      return `
        <div class="flex items-center gap-4 py-3 ${i > 0 ? 'border-t border-slate-700/30' : ''}">
          <!-- Step number -->
          <div class="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-sm font-bold text-blue-400">
            ${i + 1}
          </div>
          <!-- Step info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-0.5">
              <span class="text-sm font-semibold text-white">${step.label}</span>
              <span class="text-xs text-slate-500">${App.formatNumber(step.count)} sessions</span>
            </div>
            <!-- Progress bar -->
            <div class="h-2 bg-slate-700/50 rounded-full overflow-hidden">
              <div class="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-700"
                   style="width: ${Math.max(step.conversion_from_first, 2)}%"></div>
            </div>
          </div>
          <!-- Metrics -->
          <div class="flex items-center gap-4 flex-shrink-0 text-right">
            ${step.avg_time_seconds > 0 ? `
              <div>
                <div class="text-xs text-slate-500">Avg Time</div>
                <div class="text-sm font-medium text-slate-200">${App.formatDuration(step.avg_time_seconds)}</div>
              </div>` : ''}
            ${i > 0 ? `
              <div>
                <div class="text-xs text-slate-500">Drop-off</div>
                <div class="text-sm font-medium ${dropRateColor}">${formatPercent(step.drop_off_rate)}</div>
              </div>` : ''}
            <div>
              <div class="text-xs text-slate-500">Overall</div>
              <div class="text-sm font-medium text-slate-200">${formatPercent(step.conversion_from_first)}</div>
            </div>
          </div>
        </div>`;
    }).join('');

    return `<div class="space-y-0">${steps}</div>`;
  }

  /* ------------------------------------------------------------------
     Main Render
  ------------------------------------------------------------------ */
  let _cachedProducts = [];

  async function render(container) {
    container.innerHTML = Components.loading();

    try {
      // Fetch all data in parallel
      const [overview, abandonment, products, funnel] = await Promise.all([
        fetchOverview().catch(() => null),
        fetchCartAbandonment().catch(() => null),
        fetchProducts().catch(() => null),
        fetchCheckoutFunnel().catch(() => null),
      ]);

      _cachedProducts = (products && products.products) || [];

      // Build page
      container.innerHTML = buildPage(overview, abandonment, products, funnel);

      // Render charts after DOM is ready
      requestAnimationFrame(() => {
        if (overview && overview.revenue_by_day && overview.revenue_by_day.length > 0) {
          renderRevenueChart('ecom-revenue-chart', overview.revenue_by_day);
        }
        if (funnel && funnel.funnel && funnel.funnel.length > 0) {
          renderFunnelChart('ecom-funnel-chart', funnel.funnel);
        }
        if (abandonment && abandonment.common_exit_pages && abandonment.common_exit_pages.length > 0) {
          renderExitPieChart('ecom-exit-chart', abandonment.common_exit_pages);
        }
      });

    } catch (err) {
      container.innerHTML = Components.emptyState(
        'Error Loading E-commerce Data',
        err.message || 'An error occurred while loading analytics data.'
      );
    }
  }

  function buildPage(overview, abandonment, products, funnel) {
    const o = overview || {};
    const a = abandonment || {};
    const p = (products && products.products) || [];
    const f = (funnel && funnel.funnel) || [];

    // Icon SVGs
    const revenueIcon = `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
    const orderIcon = `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/></svg>`;
    const aovIcon = `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"/></svg>`;
    const convIcon = `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>`;
    const cartIcon = `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"/></svg>`;

    return `
      <div class="space-y-8">

        <!-- Header -->
        ${Components.sectionHeader('E-commerce Analytics', 'Revenue, cart abandonment, and product performance')}

        <!-- ── Revenue Overview ────────────────────────────────────── -->

        <!-- Big revenue number -->
        <div class="bg-gradient-to-br from-emerald-900/40 to-slate-800 rounded-2xl border border-emerald-700/30 p-6">
          <div class="flex items-center gap-3 mb-2">
            <div class="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              ${revenueIcon}
            </div>
            <span class="text-sm font-medium text-emerald-300 uppercase tracking-wider">Total Revenue</span>
          </div>
          <div class="text-4xl font-extrabold text-white tracking-tight">${formatCurrency(o.total_revenue || 0)}</div>
          <p class="text-sm text-slate-400 mt-1">${App.formatNumber(o.total_orders || 0)} orders in this period</p>
        </div>

        <!-- Metric Cards Row -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          ${Components.metricCard('Orders', App.formatNumber(o.total_orders || 0), null, orderIcon)}
          ${Components.metricCard('Avg Order Value', formatCurrency(o.avg_order_value || 0), null, aovIcon)}
          ${Components.metricCard('Conversion Rate', formatPercent(o.conversion_rate || 0), null, convIcon)}
          ${Components.metricCard('Cart Abandonment', formatPercent(o.cart_abandonment_rate || 0), null, cartIcon)}
        </div>

        <!-- Revenue Chart -->
        <div>
          <h3 class="text-sm font-semibold text-white mb-3">Revenue Over Time</h3>
          ${o.revenue_by_day && o.revenue_by_day.length > 0
            ? `<div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
                <div style="height:280px; position:relative;">
                  <canvas id="ecom-revenue-chart"></canvas>
                </div>
              </div>`
            : `<div class="bg-slate-800 rounded-xl border border-slate-700/50 p-8 text-center text-sm text-slate-500">
                No revenue data available for the selected period.
              </div>`
          }
        </div>

        <!-- ── Cart Abandonment Section ───────────────────────────── -->

        <div class="border-t border-slate-800 pt-8">
          <h2 class="text-lg font-semibold text-white mb-1">Cart Abandonment</h2>
          <p class="text-sm text-slate-400 mb-5">Understand where and why customers leave without purchasing.</p>

          <!-- Abandonment stats -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
              <div class="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Abandonment Rate</div>
              <div class="text-3xl font-bold ${(a.abandonment_rate || 0) > 50 ? 'text-red-400' : 'text-yellow-400'}">${formatPercent(a.abandonment_rate || 0)}</div>
            </div>
            <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
              <div class="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Abandoned Carts</div>
              <div class="text-3xl font-bold text-red-400">${App.formatNumber(a.total_abandoned || 0)}</div>
            </div>
            <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
              <div class="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Completed Purchases</div>
              <div class="text-3xl font-bold text-green-400">${App.formatNumber(a.total_completed || 0)}</div>
            </div>
          </div>

          <!-- Checkout Funnel Visualization -->
          <div class="mb-6">
            <h3 class="text-sm font-semibold text-white mb-3">Checkout Funnel</h3>
            ${renderFunnelVisualization(f)}
          </div>

          <!-- Exit reasons + funnel chart side by side -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <!-- Funnel bar chart -->
            <div>
              <h3 class="text-sm font-semibold text-white mb-3">Funnel Overview</h3>
              ${f.length > 0
                ? `<div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
                    <div style="height:250px; position:relative;">
                      <canvas id="ecom-funnel-chart"></canvas>
                    </div>
                  </div>`
                : `<div class="bg-slate-800 rounded-xl border border-slate-700/50 p-8 text-center text-sm text-slate-500">
                    No funnel data available.
                  </div>`
              }
            </div>

            <!-- Exit page reasons pie -->
            <div>
              <h3 class="text-sm font-semibold text-white mb-3">Common Exit Pages</h3>
              ${a.common_exit_pages && a.common_exit_pages.length > 0
                ? `<div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
                    <div style="height:250px; position:relative;">
                      <canvas id="ecom-exit-chart"></canvas>
                    </div>
                  </div>`
                : `<div class="bg-slate-800 rounded-xl border border-slate-700/50 p-8 text-center text-sm text-slate-500">
                    No exit page data available.
                  </div>`
              }
            </div>
          </div>

          <!-- Recently Abandoned Carts -->
          <div class="mb-6">
            <h3 class="text-sm font-semibold text-white mb-3">Recently Abandoned Carts</h3>
            ${renderAbandonedCartsTable(a.sessions_with_abandonment)}
          </div>

          <!-- Top Abandoned Products -->
          ${a.top_abandoned_products && a.top_abandoned_products.length > 0 ? `
          <div>
            <h3 class="text-sm font-semibold text-white mb-3">Most Abandoned Products</h3>
            <div class="overflow-x-auto rounded-xl border border-slate-700/50">
              <table class="w-full">
                <thead class="bg-slate-800/80">
                  <tr>
                    <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Product</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Times Abandoned</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Times Purchased</th>
                    <th class="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Abandon Rate</th>
                  </tr>
                </thead>
                <tbody class="bg-slate-800/30">
                  ${a.top_abandoned_products.slice(0, 10).map(p => {
                    const total = p.times_abandoned + p.times_purchased;
                    const rate = total > 0 ? (p.times_abandoned / total * 100) : 0;
                    const rateColor = rate > 75 ? 'text-red-400' : rate > 50 ? 'text-yellow-400' : 'text-green-400';
                    return `
                      <tr class="border-t border-slate-700/50">
                        <td class="px-4 py-3 text-sm text-white font-medium">${p.product_name}</td>
                        <td class="px-4 py-3 text-sm text-right text-red-400 font-medium">${App.formatNumber(p.times_abandoned)}</td>
                        <td class="px-4 py-3 text-sm text-right text-green-400 font-medium">${App.formatNumber(p.times_purchased)}</td>
                        <td class="px-4 py-3 text-sm text-right ${rateColor} font-medium">${formatPercent(rate)}</td>
                      </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>` : ''}
        </div>

        <!-- ── Product Performance ────────────────────────────────── -->

        <div class="border-t border-slate-800 pt-8">
          <h2 class="text-lg font-semibold text-white mb-1">Product Performance</h2>
          <p class="text-sm text-slate-400 mb-5">Views, cart additions, purchases, and revenue for each product.</p>
          <div id="ecom-product-table">
            ${renderProductTable(p)}
          </div>
        </div>

        <!-- ── Checkout Flow Analysis ─────────────────────────────── -->

        <div class="border-t border-slate-800 pt-8">
          <h2 class="text-lg font-semibold text-white mb-1">Checkout Flow Analysis</h2>
          <p class="text-sm text-slate-400 mb-5">Step-by-step breakdown of the checkout process.</p>
          <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
            ${renderCheckoutFlow(f)}
          </div>
        </div>

      </div>`;
  }

  /* ------------------------------------------------------------------
     Sort handler for product table
  ------------------------------------------------------------------ */
  function sortProducts(column) {
    if (_sortColumn === column) {
      _sortDir = _sortDir === 'desc' ? 'asc' : 'desc';
    } else {
      _sortColumn = column;
      _sortDir = 'desc';
    }
    const tableContainer = document.getElementById('ecom-product-table');
    if (tableContainer) {
      tableContainer.innerHTML = renderProductTable(_cachedProducts);
    }
  }

  /* ------------------------------------------------------------------
     Public API
  ------------------------------------------------------------------ */
  return {
    render,
    sortProducts,
  };

})();
