/* ==========================================================================
   goals-page.js  –  Conversion Goals Management Dashboard
   Overview cards, goal list, create/edit modal, goal detail view
   ========================================================================== */

window.GoalsPage = (() => {

  /* ------------------------------------------------------------------
     State
  ------------------------------------------------------------------ */
  let _goals = [];
  let _overview = null;
  let _activeGoal = null;
  let _activeGoalTrends = null;
  let _activeGoalConversions = null;
  let _convPage = 1;
  let _sortBy = 'conversion_rate'; // conversion_rate, conversion_count, total_value, name
  let _sortDir = 'desc';
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

  const GOAL_TYPES = [
    { key: 'url_visit',      label: 'URL Visit',      desc: 'Visitor reaches a specific page',       configLabel: 'URL Pattern',    placeholder: '/thank-you*',    icon: goalTypeIcon('url_visit') },
    { key: 'click_element',  label: 'Click Element',   desc: 'Visitor clicks a specific element',     configLabel: 'CSS Selector',   placeholder: '#cta-button',    icon: goalTypeIcon('click_element') },
    { key: 'form_submit',    label: 'Form Submit',     desc: 'Visitor submits a form',                configLabel: 'Form Selector',  placeholder: '#signup-form',   icon: goalTypeIcon('form_submit') },
    { key: 'custom_event',   label: 'Custom Event',    desc: 'Tracker fires custom event',            configLabel: 'Event Name',     placeholder: 'signup_complete', icon: goalTypeIcon('custom_event') },
    { key: 'purchase',       label: 'Purchase',        desc: 'Visitor completes a purchase',          configLabel: null,             placeholder: null,             icon: goalTypeIcon('purchase') },
    { key: 'time_on_page',   label: 'Time on Page',    desc: 'Visitor spends X seconds',              configLabel: 'Seconds',        placeholder: '60',             icon: goalTypeIcon('time_on_page') },
    { key: 'scroll_depth',   label: 'Scroll Depth',    desc: 'Visitor scrolls X% of page',            configLabel: 'Percentage (%)', placeholder: '75',             icon: goalTypeIcon('scroll_depth') },
    { key: 'page_count',     label: 'Page Count',      desc: 'Visitor views X+ pages',                configLabel: 'Page Count',     placeholder: '5',              icon: goalTypeIcon('page_count') },
  ];

  const VALUE_TYPES = [
    { key: 'count',   label: 'No monetary value' },
    { key: 'revenue', label: 'Fixed value per conversion' },
    { key: 'custom',  label: 'Dynamic (from event data)' },
  ];

  /* ------------------------------------------------------------------
     Goal type icons (SVG strings)
  ------------------------------------------------------------------ */
  function goalTypeIcon(type) {
    const icons = {
      url_visit: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-4.808a4.5 4.5 0 00-6.364-6.364L4.34 5.97a4.5 4.5 0 001.242 7.244"/></svg>`,
      click_element: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59"/></svg>`,
      form_submit: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"/></svg>`,
      custom_event: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>`,
      purchase: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"/></svg>`,
      time_on_page: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
      scroll_depth: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h5.25m5.25-.75L17.25 9m0 0L21 12.75M17.25 9v12"/></svg>`,
      page_count: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0L12 17.25 6.43 14.25m11.14 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25"/></svg>`,
    };
    return icons[type] || icons.custom_event;
  }

  /* ------------------------------------------------------------------
     Format helpers
  ------------------------------------------------------------------ */
  function fmtCurrency(val) {
    if (val == null || isNaN(val)) return '--';
    return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function fmtPercent(val) {
    if (val == null || isNaN(val)) return '--';
    return val.toFixed(2) + '%';
  }

  function fmtNumber(val) {
    if (val == null || isNaN(val)) return '--';
    return Number(val).toLocaleString('en-US');
  }

  function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  /* ------------------------------------------------------------------
     Query string builder
  ------------------------------------------------------------------ */
  function qs() {
    const { start, end } = App.state.dateRange;
    return `project_id=${App.state.project}&date_from=${start}&date_to=${end}`;
  }

  /* ------------------------------------------------------------------
     Data fetching
  ------------------------------------------------------------------ */
  async function fetchGoals() {
    try {
      const result = await App.api(`/goals?${qs()}`);
      _goals = (result && result.goals) || [];
    } catch (_) {
      _goals = [];
    }
  }

  async function fetchOverview() {
    try {
      _overview = await App.api(`/goals/overview?project_id=${App.state.project}`);
    } catch (_) {
      _overview = null;
    }
  }

  async function fetchGoalTrends(goalId) {
    try {
      const { start, end } = App.state.dateRange;
      _activeGoalTrends = await App.api(`/goals/${goalId}/trends?date_from=${start}&date_to=${end}`);
    } catch (_) {
      _activeGoalTrends = null;
    }
  }

  async function fetchGoalConversions(goalId, page) {
    try {
      const { start, end } = App.state.dateRange;
      _activeGoalConversions = await App.api(`/goals/${goalId}/conversions?page=${page}&limit=15&date_from=${start}&date_to=${end}`);
    } catch (_) {
      _activeGoalConversions = null;
    }
  }

  /* ------------------------------------------------------------------
     Mini sparkline SVG (7-day trend)
  ------------------------------------------------------------------ */
  function sparklineSvg(data, width, height, color) {
    width = width || 80;
    height = height || 24;
    color = color || COLORS.accent;

    if (!data || data.length === 0) {
      return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><line x1="0" y1="${height / 2}" x2="${width}" y2="${height / 2}" stroke="${COLORS.muted}" stroke-width="1" stroke-dasharray="2,2"/></svg>`;
    }

    const max = Math.max(...data, 1);
    const step = width / Math.max(data.length - 1, 1);
    const points = data.map((v, i) => {
      const x = i * step;
      const y = height - (v / max) * (height - 4) - 2;
      return `${x},${y}`;
    }).join(' ');

    // Fill area
    const firstX = 0;
    const lastX = (data.length - 1) * step;
    const fillPoints = `${firstX},${height} ${points} ${lastX},${height}`;

    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <polygon points="${fillPoints}" fill="${color}" opacity="0.15"/>
      <polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  /* ------------------------------------------------------------------
     Overview Cards
  ------------------------------------------------------------------ */
  function renderOverviewCards() {
    const o = _overview || {};
    const today = o.today || {};
    const trend = o.trend || {};
    const topGoal = o.top_goal;

    const convChange = trend.conversions_change || 0;
    const valueChange = trend.value_change || 0;
    const rateChange = trend.rate_change || 0;

    const convIcon = `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>`;
    const valueIcon = `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
    const rateIcon = `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"/></svg>`;
    const topIcon = `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.023 6.023 0 01-7.54 0"/></svg>`;

    const topGoalHTML = topGoal
      ? `<div class="text-lg font-bold text-white truncate">${escHtml(topGoal.name)}</div>
         <div class="text-xs text-slate-400 mt-0.5">${fmtPercent(topGoal.rate)} rate</div>`
      : `<div class="text-lg font-bold text-slate-500">--</div>
         <div class="text-xs text-slate-500 mt-0.5">No conversions yet</div>`;

    return `
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        ${Components.metricCard(
          'Conversions Today',
          fmtNumber(today.conversions || 0),
          convChange !== 0 ? { value: (convChange > 0 ? '+' : '') + convChange + ' vs yesterday', positive: convChange > 0 } : null,
          convIcon
        )}
        ${Components.metricCard(
          'Total Value Today',
          fmtCurrency(today.value || 0),
          valueChange !== 0 ? { value: (valueChange > 0 ? '+' : '') + fmtCurrency(valueChange), positive: valueChange > 0 } : null,
          valueIcon
        )}
        ${Components.metricCard(
          'Conversion Rate',
          fmtPercent(today.conversion_rate || 0),
          rateChange !== 0 ? { value: (rateChange > 0 ? '+' : '') + rateChange.toFixed(2) + 'pp', positive: rateChange > 0 } : null,
          rateIcon
        )}
        <div class="bg-slate-800 rounded-xl p-5 border border-slate-700/50 hover:border-slate-600/50 transition-colors">
          <div class="flex items-start justify-between mb-3">
            <span class="text-xs font-medium text-slate-400 uppercase tracking-wider">Top Performing Goal</span>
            <span class="text-slate-500">${topIcon}</span>
          </div>
          ${topGoalHTML}
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------
     Goals List
  ------------------------------------------------------------------ */
  function renderGoalsList() {
    if (_goals.length === 0) {
      return Components.emptyState(
        'No Goals Yet',
        'Create your first conversion goal to start tracking what matters most.',
        `<svg class="w-12 h-12 text-slate-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
           <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/>
         </svg>`
      );
    }

    // Sort goals
    const sorted = [..._goals].sort((a, b) => {
      let aVal, bVal;
      switch (_sortBy) {
        case 'name':
          aVal = (a.name || '').toLowerCase();
          bVal = (b.name || '').toLowerCase();
          return _sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        case 'conversion_count':
          aVal = a.conversion_count || 0;
          bVal = b.conversion_count || 0;
          break;
        case 'total_value':
          aVal = a.total_value || 0;
          bVal = b.total_value || 0;
          break;
        case 'conversion_rate':
        default:
          aVal = a.conversion_rate || 0;
          bVal = b.conversion_rate || 0;
          break;
      }
      return _sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });

    // Sort controls
    const sortOptions = [
      { key: 'conversion_rate', label: 'Conversion Rate' },
      { key: 'conversion_count', label: 'Count' },
      { key: 'total_value', label: 'Value' },
      { key: 'name', label: 'Name' },
    ];

    const sortBarHTML = `
      <div class="flex items-center gap-2 mb-4">
        <span class="text-xs text-slate-500">Sort by:</span>
        ${sortOptions.map(opt => `
          <button onclick="GoalsPage.setSort('${opt.key}')"
                  class="px-2.5 py-1 rounded-md text-xs font-medium transition-colors
                         ${_sortBy === opt.key ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}">
            ${opt.label}
            ${_sortBy === opt.key ? (_sortDir === 'desc' ? '&#9660;' : '&#9650;') : ''}
          </button>
        `).join('')}
      </div>`;

    // Goal cards
    const cards = sorted.map(goal => {
      const typeDef = GOAL_TYPES.find(t => t.key === goal.type) || GOAL_TYPES[0];
      const rate = goal.conversion_rate || 0;
      const count = goal.conversion_count || 0;
      const value = goal.total_value || 0;
      const trend = goal.trend || {};
      const enabled = goal.enabled !== false;

      // Color for rate
      const rateColor = rate >= 10 ? 'text-green-400' : rate >= 5 ? 'text-blue-400' : rate >= 1 ? 'text-amber-400' : 'text-slate-400';
      const barColor = rate >= 10 ? 'bg-green-500' : rate >= 5 ? 'bg-blue-500' : rate >= 1 ? 'bg-amber-500' : 'bg-slate-600';
      const barWidth = Math.min(rate, 100);

      // Fake 7-day sparkline from trend data (or generate placeholder)
      const sparkData = trend.daily || [];
      const sparkColor = (trend.conversion_count_change || 0) >= 0 ? '#22c55e' : '#ef4444';

      return `
        <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5 hover:border-slate-600/50 transition-all ${!enabled ? 'opacity-50' : ''}"
             style="background: ${COLORS.card}; border-color: ${COLORS.border};">
          <div class="flex items-start justify-between mb-3">
            <div class="flex items-center gap-3 min-w-0 flex-1 cursor-pointer" onclick="GoalsPage.showDetail('${escHtml(goal.id)}')">
              <div class="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                   style="background: rgba(67, 97, 238, 0.15); color: ${COLORS.accent};">
                ${typeDef.icon}
              </div>
              <div class="min-w-0">
                <h3 class="text-sm font-semibold text-white truncate hover:text-blue-400 transition-colors">${escHtml(goal.name)}</h3>
                <p class="text-xs mt-0.5" style="color: ${COLORS.muted};">${typeDef.label}</p>
              </div>
            </div>
            <div class="flex items-center gap-1 flex-shrink-0 ml-2">
              <!-- Enable/disable toggle -->
              <button onclick="GoalsPage.toggleEnabled('${escHtml(goal.id)}', ${!enabled})"
                      class="relative w-9 h-5 rounded-full transition-colors ${enabled ? 'bg-blue-600' : 'bg-slate-600'}" title="${enabled ? 'Disable' : 'Enable'}">
                <span class="absolute top-0.5 ${enabled ? 'left-4.5' : 'left-0.5'} w-4 h-4 bg-white rounded-full shadow transition-all"
                      style="left: ${enabled ? '18px' : '2px'};"></span>
              </button>
              <!-- Edit -->
              <button onclick="GoalsPage.showEditModal('${escHtml(goal.id)}')"
                      class="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-700/50 transition-colors" title="Edit">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/>
                </svg>
              </button>
              <!-- Delete -->
              <button onclick="GoalsPage.confirmDelete('${escHtml(goal.id)}')"
                      class="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Conversion stats -->
          <div class="flex items-end justify-between gap-4 mb-3 cursor-pointer" onclick="GoalsPage.showDetail('${escHtml(goal.id)}')">
            <div>
              <div class="text-2xl font-bold ${rateColor}">${fmtPercent(rate)}</div>
              <div class="text-xs mt-0.5" style="color: ${COLORS.muted};">${fmtNumber(count)} conversion${count !== 1 ? 's' : ''}</div>
            </div>
            <div class="flex flex-col items-end gap-1">
              ${value > 0 ? `<div class="text-sm font-semibold text-green-400">${fmtCurrency(value)}</div>` : ''}
              <div class="opacity-60 hover:opacity-100 transition-opacity">
                ${sparklineSvg(sparkData, 72, 20, sparkColor)}
              </div>
            </div>
          </div>

          <!-- Progress bar -->
          <div class="h-1.5 rounded-full overflow-hidden" style="background: rgba(67, 97, 238, 0.1);">
            <div class="h-full rounded-full transition-all duration-700 ${barColor}" style="width: ${barWidth}%;"></div>
          </div>

          <!-- Trend footer -->
          ${trend.conversion_count_change != null ? `
          <div class="mt-3 pt-3 flex items-center justify-between" style="border-top: 1px solid ${COLORS.border};">
            <span class="text-xs ${trend.conversion_count_change >= 0 ? 'text-green-400' : 'text-red-400'}">
              ${trend.conversion_count_change >= 0 ? '+' : ''}${trend.conversion_count_change} vs prev period
            </span>
            <span class="text-xs" style="color: ${COLORS.muted};">
              ${trend.rate_change >= 0 ? '+' : ''}${trend.rate_change.toFixed(2)}pp rate
            </span>
          </div>` : ''}
        </div>`;
    }).join('');

    return `${sortBarHTML}
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        ${cards}
      </div>`;
  }

  /* ------------------------------------------------------------------
     Create / Edit Goal Modal
  ------------------------------------------------------------------ */
  let _modalGoal = null; // null for create, object for edit
  let _modalType = 'url_visit';
  let _modalValueType = 'count';

  function showCreateModal() {
    _modalGoal = null;
    _modalType = 'url_visit';
    _modalValueType = 'count';
    renderGoalModal();
  }

  function showEditModal(goalId) {
    const goal = _goals.find(g => g.id === goalId);
    if (!goal) return;
    _modalGoal = goal;
    _modalType = goal.type || 'url_visit';
    _modalValueType = goal.value_type || 'count';
    renderGoalModal();
  }

  function renderGoalModal() {
    const isEdit = !!_modalGoal;
    const title = isEdit ? 'Edit Goal' : 'Create Goal';
    const goal = _modalGoal || {};
    const config = goal.config || {};

    const typeDef = GOAL_TYPES.find(t => t.key === _modalType) || GOAL_TYPES[0];

    // Type selector with icons
    const typeOptionsHTML = GOAL_TYPES.map(t => `
      <button onclick="GoalsPage.setModalType('${t.key}')"
              class="flex items-start gap-3 p-3 rounded-lg border transition-all text-left
                     ${_modalType === t.key
                       ? 'border-blue-500/50 bg-blue-500/10'
                       : 'border-slate-600/30 bg-slate-700/20 hover:border-slate-500/40 hover:bg-slate-700/40'}">
        <div class="flex-shrink-0 mt-0.5 ${_modalType === t.key ? 'text-blue-400' : 'text-slate-500'}">${t.icon}</div>
        <div class="min-w-0">
          <div class="text-xs font-semibold ${_modalType === t.key ? 'text-blue-400' : 'text-white'}">${t.label}</div>
          <div class="text-[10px] mt-0.5" style="color: ${COLORS.muted};">${t.desc}</div>
        </div>
      </button>
    `).join('');

    // Config input based on type
    let configInputHTML = '';
    if (typeDef.configLabel) {
      const configKey = _modalType === 'url_visit' ? 'url_pattern'
        : _modalType === 'click_element' || _modalType === 'form_submit' ? 'selector'
        : _modalType === 'custom_event' ? 'event_name'
        : 'threshold';
      const currentVal = config[configKey] || '';

      configInputHTML = `
        <div class="mt-4">
          <label class="block text-xs font-medium text-slate-400 mb-1.5">${typeDef.configLabel}</label>
          <input type="${_modalType === 'time_on_page' || _modalType === 'scroll_depth' || _modalType === 'page_count' ? 'number' : 'text'}"
                 id="goal-config-input"
                 value="${escHtml(currentVal)}"
                 placeholder="${typeDef.placeholder || ''}"
                 class="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50" />
        </div>`;
    }

    // Value type selector
    const valueTypeHTML = `
      <div class="mt-4">
        <label class="block text-xs font-medium text-slate-400 mb-1.5">Conversion Value</label>
        <div class="space-y-2">
          ${VALUE_TYPES.map(vt => `
            <label class="flex items-center gap-2.5 cursor-pointer p-2 rounded-lg transition-colors
                          ${_modalValueType === vt.key ? 'bg-slate-700/40' : 'hover:bg-slate-700/20'}">
              <input type="radio" name="goal-value-type" value="${vt.key}"
                     ${_modalValueType === vt.key ? 'checked' : ''}
                     onchange="GoalsPage.setModalValueType('${vt.key}')"
                     class="w-3.5 h-3.5 text-blue-500 bg-slate-700 border-slate-600 focus:ring-blue-500/30" />
              <span class="text-xs text-slate-300">${vt.label}</span>
            </label>
          `).join('')}
        </div>
        ${_modalValueType === 'revenue' ? `
          <div class="mt-2">
            <label class="block text-xs font-medium text-slate-400 mb-1.5">Value per Conversion ($)</label>
            <input type="number" id="goal-value-amount" step="0.01" min="0"
                   value="${goal.value_amount || 0}"
                   class="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50" />
          </div>` : ''}
      </div>`;

    const content = `
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-slate-400 mb-1.5">Goal Name</label>
          <input type="text" id="goal-name-input" placeholder="e.g. Signup Completion"
                 value="${escHtml(goal.name || '')}"
                 class="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-400 mb-1.5">Description (optional)</label>
          <input type="text" id="goal-desc-input" placeholder="Describe what this goal measures"
                 value="${escHtml(goal.description || '')}"
                 class="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-400 mb-2">Goal Type</label>
          <div class="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto pr-1">
            ${typeOptionsHTML}
          </div>
        </div>
        ${configInputHTML}
        ${valueTypeHTML}
        <div id="goal-preview-container" class="mt-4 p-3 rounded-lg border border-slate-600/30 bg-slate-700/20">
          <div class="text-xs text-slate-500 text-center">Preview will show after saving</div>
        </div>
      </div>`;

    Components.showModal(title, content, [{
      label: isEdit ? 'Save Changes' : 'Create Goal',
      onClick: isEdit ? `GoalsPage.confirmEdit('${escHtml(goal.id)}')` : 'GoalsPage.confirmCreate()',
    }]);

    setTimeout(() => {
      const inp = document.getElementById('goal-name-input');
      if (inp && !isEdit) inp.focus();
    }, 100);
  }

  function setModalType(type) {
    _modalType = type;
    Components.closeModal();
    renderGoalModal();
  }

  function setModalValueType(valueType) {
    _modalValueType = valueType;
    Components.closeModal();
    renderGoalModal();
  }

  function getModalConfig() {
    const configInput = document.getElementById('goal-config-input');
    const configVal = configInput ? configInput.value.trim() : '';
    const config = {};

    switch (_modalType) {
      case 'url_visit':
        config.url_pattern = configVal;
        break;
      case 'click_element':
      case 'form_submit':
        config.selector = configVal;
        break;
      case 'custom_event':
        config.event_name = configVal;
        break;
      case 'time_on_page':
      case 'scroll_depth':
      case 'page_count':
        config.threshold = parseFloat(configVal) || 0;
        break;
      case 'purchase':
        // No additional config needed
        break;
    }

    return config;
  }

  async function confirmCreate() {
    const nameEl = document.getElementById('goal-name-input');
    const descEl = document.getElementById('goal-desc-input');
    const name = nameEl ? nameEl.value.trim() : '';
    const description = descEl ? descEl.value.trim() : '';

    if (!name) {
      Components.toast('Please enter a goal name', 'warning');
      return;
    }

    const config = getModalConfig();
    const valueAmountEl = document.getElementById('goal-value-amount');
    const valueAmount = valueAmountEl ? parseFloat(valueAmountEl.value) || 0 : 0;

    Components.closeModal();

    try {
      await App.api('/goals', {
        method: 'POST',
        body: {
          name,
          description: description || null,
          type: _modalType,
          config,
          value_type: _modalValueType,
          value_amount: _modalValueType === 'revenue' ? valueAmount : 0,
          projectId: App.state.project,
        },
      });
      Components.toast('Goal created successfully', 'success');
    } catch (err) {
      Components.toast('Failed to create goal: ' + (err.message || 'Unknown error'), 'error');
    }

    const container = document.getElementById('main-content');
    if (container) render(container);
  }

  async function confirmEdit(goalId) {
    const nameEl = document.getElementById('goal-name-input');
    const descEl = document.getElementById('goal-desc-input');
    const name = nameEl ? nameEl.value.trim() : '';
    const description = descEl ? descEl.value.trim() : '';

    if (!name) {
      Components.toast('Name cannot be empty', 'warning');
      return;
    }

    const config = getModalConfig();
    const valueAmountEl = document.getElementById('goal-value-amount');
    const valueAmount = valueAmountEl ? parseFloat(valueAmountEl.value) || 0 : 0;

    Components.closeModal();

    try {
      await App.api(`/goals/${goalId}`, {
        method: 'PUT',
        body: {
          name,
          description: description || null,
          type: _modalType,
          config,
          value_type: _modalValueType,
          value_amount: _modalValueType === 'revenue' ? valueAmount : 0,
        },
      });
      Components.toast('Goal updated successfully', 'success');
    } catch (err) {
      Components.toast('Failed to update goal: ' + (err.message || 'Unknown error'), 'error');
    }

    const container = document.getElementById('main-content');
    if (container) render(container);
  }

  /* ------------------------------------------------------------------
     Toggle enabled / Delete
  ------------------------------------------------------------------ */
  async function toggleEnabled(goalId, enabled) {
    try {
      await App.api(`/goals/${goalId}`, {
        method: 'PUT',
        body: { enabled },
      });
      Components.toast(enabled ? 'Goal enabled' : 'Goal disabled', 'success');
    } catch (err) {
      Components.toast('Failed to update goal', 'error');
    }

    const container = document.getElementById('main-content');
    if (container) render(container);
  }

  function confirmDelete(goalId) {
    Components.showModal(
      'Delete Goal',
      `<p class="text-sm text-slate-300">Are you sure you want to delete this goal and all its conversion data? This action cannot be undone.</p>`,
      [{
        label: 'Delete',
        class: 'bg-red-600 hover:bg-red-700 text-white',
        onClick: `GoalsPage.executeDelete('${escHtml(goalId)}')`,
      }]
    );
  }

  async function executeDelete(goalId) {
    Components.closeModal();
    try {
      await App.api(`/goals/${goalId}`, { method: 'DELETE' });
      Components.toast('Goal deleted', 'success');
    } catch (err) {
      Components.toast('Failed to delete goal', 'error');
    }

    _activeGoal = null;
    const container = document.getElementById('main-content');
    if (container) render(container);
  }

  /* ------------------------------------------------------------------
     Goal Detail View
  ------------------------------------------------------------------ */
  async function showDetail(goalId) {
    const container = document.getElementById('main-content');
    if (!container) return;
    container.innerHTML = Components.loading();

    _activeGoal = _goals.find(g => g.id === goalId) || null;
    _convPage = 1;

    await Promise.all([
      fetchGoalTrends(goalId),
      fetchGoalConversions(goalId, 1),
    ]);

    if (_destroyed) return;
    renderDetailView(container);
  }

  function renderDetailView(container) {
    const goal = _activeGoal;
    if (!goal) {
      container.innerHTML = Components.emptyState('Goal Not Found', 'The goal you are looking for does not exist.');
      return;
    }

    const typeDef = GOAL_TYPES.find(t => t.key === goal.type) || GOAL_TYPES[0];
    const rate = goal.conversion_rate || 0;
    const count = goal.conversion_count || 0;
    const value = goal.total_value || 0;

    // Header with breadcrumb
    const headerHTML = `
      <div class="flex items-center gap-2 text-sm text-slate-400 mb-5">
        <a href="javascript:void(0)" onclick="GoalsPage.backToList()" class="hover:text-white transition-colors">Goals</a>
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/>
        </svg>
        <span class="text-white">${escHtml(goal.name)}</span>
      </div>
      <div class="flex items-start justify-between mb-8">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background: rgba(67, 97, 238, 0.15); color: ${COLORS.accent};">${typeDef.icon}</div>
          <div>
            <h1 class="text-xl font-bold text-white">${escHtml(goal.name)}</h1>
            <p class="text-sm mt-0.5" style="color: ${COLORS.muted};">${typeDef.label}${goal.description ? ' &middot; ' + escHtml(goal.description) : ''}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="GoalsPage.showEditModal('${escHtml(goal.id)}')"
                  class="px-3.5 py-2 rounded-lg text-sm font-medium bg-slate-800 border border-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/></svg>
            Edit
          </button>
          <button onclick="GoalsPage.confirmDelete('${escHtml(goal.id)}')"
                  class="px-3.5 py-2 rounded-lg text-sm font-medium bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>
            Delete
          </button>
        </div>
      </div>`;

    // Summary metrics
    const rateColor = rate >= 10 ? 'text-green-400' : rate >= 5 ? 'text-blue-400' : 'text-amber-400';
    const summaryHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        ${Components.metricCard('Conversion Rate', fmtPercent(rate), null,
          `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"/></svg>`)}
        ${Components.metricCard('Total Conversions', fmtNumber(count), null,
          `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75z"/></svg>`)}
        ${Components.metricCard('Total Value', fmtCurrency(value), null,
          `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`)}
      </div>`;

    // Trends chart
    const trends = (_activeGoalTrends && _activeGoalTrends.trends) || [];
    const chartHTML = trends.length > 0
      ? `<div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5 mb-8" style="background: ${COLORS.card}; border-color: ${COLORS.border};">
           <h3 class="text-sm font-semibold text-white mb-4">Conversion Trend</h3>
           <div style="height: 280px; position: relative;">
             <canvas id="goal-trend-chart"></canvas>
           </div>
         </div>`
      : `<div class="bg-slate-800 rounded-xl border border-slate-700/50 p-8 mb-8 text-center text-sm text-slate-500" style="background: ${COLORS.card}; border-color: ${COLORS.border};">
           No trend data available for the selected period.
         </div>`;

    // Recent conversions table
    const conversions = (_activeGoalConversions && _activeGoalConversions.conversions) || [];
    const pagination = (_activeGoalConversions && _activeGoalConversions.pagination) || {};

    let conversionsTableHTML;
    if (conversions.length === 0) {
      conversionsTableHTML = `<p class="text-sm text-slate-500 py-4 text-center">No conversions recorded yet.</p>`;
    } else {
      const tableRows = conversions.map(c => {
        const sessionShort = (c.session_id || '').substring(0, 12);
        const visitorShort = (c.visitor_id || 'Anonymous').substring(0, 10);
        const ts = c.converted_at ? new Date(c.converted_at).toLocaleString() : '--';
        const val = parseFloat(c.value) || 0;
        const meta = c.metadata || {};
        const source = meta.utm_source || meta.referrer || '--';

        return `
          <tr class="border-t border-slate-700/50 hover:bg-slate-700/30 transition-colors cursor-pointer"
              onclick="App.navigate('sessions/${escHtml(c.session_id)}')">
            <td class="px-4 py-3 text-sm">
              <span class="text-blue-400 hover:underline font-mono text-xs">${escHtml(sessionShort)}...</span>
            </td>
            <td class="px-4 py-3 text-sm text-slate-300">${escHtml(visitorShort)}</td>
            <td class="px-4 py-3 text-sm text-slate-400">${ts}</td>
            <td class="px-4 py-3 text-sm text-right font-medium ${val > 0 ? 'text-green-400' : 'text-slate-500'}">${val > 0 ? fmtCurrency(val) : '--'}</td>
            <td class="px-4 py-3 text-sm text-slate-400">${escHtml(source)}</td>
          </tr>`;
      }).join('');

      conversionsTableHTML = `
        <div class="overflow-x-auto rounded-xl border border-slate-700/50">
          <table class="w-full">
            <thead class="bg-slate-800/80">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Session</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Visitor</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Timestamp</th>
                <th class="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Value</th>
                <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Source</th>
              </tr>
            </thead>
            <tbody class="bg-slate-800/30">${tableRows}</tbody>
          </table>
        </div>
        ${pagination.total_pages > 1 ? Components.pagination(pagination.page, pagination.total_pages, 'GoalsPage.loadConversionsPage') : ''}`;
    }

    container.innerHTML = `
      <div>
        ${headerHTML}
        ${summaryHTML}
        ${chartHTML}
        <div class="mb-8">
          <h3 class="text-sm font-semibold text-white mb-3">Recent Conversions</h3>
          <div id="goal-conversions-table">
            ${conversionsTableHTML}
          </div>
        </div>
      </div>`;

    // Render chart after DOM
    if (trends.length > 0) {
      requestAnimationFrame(() => {
        renderTrendChart('goal-trend-chart', trends);
      });
    }
  }

  function renderTrendChart(canvasId, trends) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    // Destroy existing chart
    if (_chartInstance) {
      try { _chartInstance.destroy(); } catch (_) {}
    }

    const labels = trends.map(t => {
      const dt = new Date(t.date);
      return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    const convData = trends.map(t => t.conversions);
    const valueData = trends.map(t => t.value);
    const hasValue = valueData.some(v => v > 0);

    const datasets = [{
      label: 'Conversions',
      data: convData,
      borderColor: COLORS.accent,
      backgroundColor: 'rgba(67, 97, 238, 0.1)',
      borderWidth: 2,
      fill: true,
      tension: 0.3,
      pointRadius: 3,
      pointBackgroundColor: COLORS.accent,
      pointBorderColor: COLORS.accent,
      pointHoverRadius: 5,
      yAxisID: 'y',
    }];

    if (hasValue) {
      datasets.push({
        label: 'Value',
        data: valueData,
        borderColor: COLORS.green,
        backgroundColor: 'rgba(0, 200, 83, 0.08)',
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 2,
        pointBackgroundColor: COLORS.green,
        pointBorderColor: COLORS.green,
        pointHoverRadius: 4,
        yAxisID: 'y1',
      });
    }

    _chartInstance = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: hasValue,
            labels: { color: COLORS.muted, font: { size: 11 }, usePointStyle: true, pointStyleWidth: 8 },
          },
          tooltip: {
            backgroundColor: COLORS.card,
            titleColor: COLORS.text,
            bodyColor: COLORS.muted,
            borderColor: COLORS.border,
            borderWidth: 1,
          },
        },
        scales: {
          x: {
            grid: { color: COLORS.gridLine },
            ticks: { color: COLORS.muted, font: { size: 11 } },
          },
          y: {
            position: 'left',
            grid: { color: COLORS.gridLine },
            ticks: {
              color: COLORS.muted,
              font: { size: 11 },
              stepSize: 1,
            },
            beginAtZero: true,
          },
          ...(hasValue ? {
            y1: {
              position: 'right',
              grid: { display: false },
              ticks: {
                color: COLORS.muted,
                font: { size: 11 },
                callback: (v) => '$' + v,
              },
              beginAtZero: true,
            },
          } : {}),
        },
      },
    });
    App.state.chartInstances['goal-trend'] = _chartInstance;
  }

  async function loadConversionsPage(page) {
    if (!_activeGoal) return;
    _convPage = page;
    await fetchGoalConversions(_activeGoal.id, page);

    const container = document.getElementById('main-content');
    if (container && _activeGoal) {
      renderDetailView(container);
    }
  }

  function backToList() {
    _activeGoal = null;
    _activeGoalTrends = null;
    _activeGoalConversions = null;
    const container = document.getElementById('main-content');
    if (container) render(container);
  }

  /* ------------------------------------------------------------------
     Sort handler
  ------------------------------------------------------------------ */
  function setSort(column) {
    if (_sortBy === column) {
      _sortDir = _sortDir === 'desc' ? 'asc' : 'desc';
    } else {
      _sortBy = column;
      _sortDir = 'desc';
    }

    const container = document.getElementById('main-content');
    if (container) render(container);
  }

  /* ------------------------------------------------------------------
     Main Render
  ------------------------------------------------------------------ */
  async function render(container) {
    container.innerHTML = Components.loading();
    _destroyed = false;
    _activeGoal = null;

    await Promise.all([
      fetchGoals(),
      fetchOverview(),
    ]);

    if (_destroyed) return;

    const createBtnHTML = `
      <button onclick="GoalsPage.showCreateModal()"
              class="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors flex items-center gap-2"
              style="background: ${COLORS.accent};">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
        </svg>
        Create Goal
      </button>`;

    container.innerHTML = `
      <div>
        ${Components.sectionHeader('Conversion Goals', 'Track and measure goal completions across your site', createBtnHTML)}
        ${renderOverviewCards()}
        ${renderGoalsList()}
      </div>`;
  }

  /* ------------------------------------------------------------------
     Init / Destroy (lifecycle)
  ------------------------------------------------------------------ */
  function init(container) {
    _destroyed = false;
    render(container);
  }

  function destroy() {
    _destroyed = true;
    if (_chartInstance) {
      try { _chartInstance.destroy(); } catch (_) {}
      _chartInstance = null;
    }
  }

  /* ------------------------------------------------------------------
     Public API
  ------------------------------------------------------------------ */
  return {
    init,
    destroy,
    render,
    showCreateModal,
    showEditModal,
    setModalType,
    setModalValueType,
    confirmCreate,
    confirmEdit,
    toggleEnabled,
    confirmDelete,
    executeDelete,
    showDetail,
    loadConversionsPage,
    backToList,
    setSort,
  };

})();

/* Register as renderGoalsPage for router compatibility */
function renderGoalsPage(container) {
  GoalsPage.init(container);
}
