/* ==========================================================================
   alerts-page.js  -  Alert Rules & Notifications Management
   Full-featured dashboard for managing alert rules, viewing history,
   and monitoring alert health.
   ========================================================================== */

const AlertsPage = (() => {

  /* ------------------------------------------------------------------
     Constants
  ------------------------------------------------------------------ */
  const METRICS = [
    { value: 'error_rate',             label: 'Error Rate',             unit: '%',  description: 'Percentage of sessions with JS errors' },
    { value: 'rage_clicks',            label: 'Rage Clicks',            unit: '',   description: 'Number of sessions with rage clicks' },
    { value: 'conversion_rate',        label: 'Conversion Rate',        unit: '%',  description: 'Percentage of sessions resulting in a purchase' },
    { value: 'session_count',          label: 'Session Count',          unit: '',   description: 'Total number of sessions in the window' },
    { value: 'avg_duration',           label: 'Avg Session Duration',   unit: 's',  description: 'Average session length in seconds' },
    { value: 'bounce_rate',            label: 'Bounce Rate',            unit: '%',  description: 'Percentage of single-page sessions' },
    { value: 'cart_abandonment_rate',  label: 'Cart Abandonment Rate',  unit: '%',  description: 'Percentage of cart sessions without purchase' },
    { value: 'page_load_time',         label: 'Page Load Time',         unit: 'ms', description: 'Average page load time in milliseconds' },
    { value: 'custom_event_count',     label: 'Custom Event Count',     unit: '',   description: 'Number of custom events tracked' },
  ];

  const CONDITIONS = [
    { value: 'gt',         label: 'Greater than',        symbol: '>' },
    { value: 'lt',         label: 'Less than',           symbol: '<' },
    { value: 'gte',        label: 'Greater or equal to', symbol: '>=' },
    { value: 'lte',        label: 'Less or equal to',    symbol: '<=' },
    { value: 'eq',         label: 'Equals',              symbol: '=' },
    { value: 'change_pct', label: 'Changed by %',        symbol: '~%' },
  ];

  const WINDOWS = [
    { value: 5,    label: '5 minutes' },
    { value: 15,   label: '15 minutes' },
    { value: 30,   label: '30 minutes' },
    { value: 60,   label: '1 hour' },
    { value: 360,  label: '6 hours' },
    { value: 1440, label: '24 hours' },
  ];

  const COOLDOWNS = [
    { value: 15,   label: '15 minutes' },
    { value: 30,   label: '30 minutes' },
    { value: 60,   label: '1 hour' },
    { value: 360,  label: '6 hours' },
    { value: 1440, label: '24 hours' },
  ];

  const MUTE_OPTIONS = [
    { minutes: 60,   label: '1 hour' },
    { minutes: 240,  label: '4 hours' },
    { minutes: 1440, label: '24 hours' },
  ];

  const METRIC_COLORS = {
    error_rate:            { bg: 'rgba(255, 23, 68, 0.1)',  border: 'rgba(255, 23, 68, 0.25)', text: '#ff1744' },
    rage_clicks:           { bg: 'rgba(255, 109, 0, 0.1)',  border: 'rgba(255, 109, 0, 0.25)', text: '#ff6d00' },
    conversion_rate:       { bg: 'rgba(0, 200, 83, 0.1)',   border: 'rgba(0, 200, 83, 0.25)',  text: '#00c853' },
    session_count:         { bg: 'rgba(67, 97, 238, 0.1)',  border: 'rgba(67, 97, 238, 0.25)', text: '#4361ee' },
    avg_duration:          { bg: 'rgba(67, 97, 238, 0.1)',  border: 'rgba(67, 97, 238, 0.25)', text: '#4361ee' },
    bounce_rate:           { bg: 'rgba(255, 214, 0, 0.1)',  border: 'rgba(255, 214, 0, 0.25)', text: '#ffd600' },
    cart_abandonment_rate: { bg: 'rgba(255, 214, 0, 0.1)',  border: 'rgba(255, 214, 0, 0.25)', text: '#ffd600' },
    page_load_time:        { bg: 'rgba(156, 39, 176, 0.1)', border: 'rgba(156, 39, 176, 0.25)', text: '#ab47bc' },
    custom_event_count:    { bg: 'rgba(67, 97, 238, 0.1)',  border: 'rgba(67, 97, 238, 0.25)', text: '#4361ee' },
  };

  /* ------------------------------------------------------------------
     State
  ------------------------------------------------------------------ */
  let rules = [];
  let history = [];
  let summary = {};
  let historyPage = 1;
  let historyPages = 1;
  let editingRuleId = null;
  let openMuteMenuId = null;
  let refreshTimer = null;

  /* ------------------------------------------------------------------
     Helpers
  ------------------------------------------------------------------ */
  function escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function metricInfo(metric) {
    return METRICS.find(m => m.value === metric) || { value: metric, label: metric, unit: '', description: '' };
  }

  function conditionInfo(cond) {
    return CONDITIONS.find(c => c.value === cond) || { value: cond, label: cond, symbol: cond };
  }

  function windowLabel(mins) {
    const w = WINDOWS.find(w => w.value === mins);
    return w ? w.label : mins + 'm';
  }

  function formatThreshold(metric, threshold) {
    const info = metricInfo(metric);
    if (info.unit === '%') return threshold + '%';
    if (info.unit === 'ms') return threshold + 'ms';
    if (info.unit === 's') return threshold + 's';
    return String(threshold);
  }

  function timeAgo(dateStr) {
    if (!dateStr) return 'Never';
    const diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return Math.floor(diff / 86400000) + 'd ago';
  }

  function formatTimestamp(dateStr) {
    if (!dateStr) return '--';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  function isMuted(rule) {
    return rule.muted_until && new Date(rule.muted_until) > new Date();
  }

  /* ------------------------------------------------------------------
     Data fetching
  ------------------------------------------------------------------ */
  async function fetchRules() {
    try {
      const data = await App.api('/alerts/rules?project_id=' + App.state.project);
      rules = data.rules || [];
    } catch (_) {
      rules = [];
    }
  }

  async function fetchHistory(page) {
    try {
      const data = await App.api('/alerts/history?project_id=' + App.state.project + '&page=' + page + '&limit=20');
      history = data.history || [];
      historyPage = data.page || 1;
      historyPages = data.pages || 1;
    } catch (_) {
      history = [];
    }
  }

  async function fetchSummary() {
    try {
      summary = await App.api('/alerts/summary?project_id=' + App.state.project);
    } catch (_) {
      summary = { total_rules: 0, active_rules: 0, muted_rules: 0, triggers_today: 0 };
    }
  }

  /* ------------------------------------------------------------------
     Summary bar
  ------------------------------------------------------------------ */
  function renderSummaryBar() {
    const cards = [
      {
        label: 'Active Rules',
        value: summary.active_rules || 0,
        total: summary.total_rules || 0,
        color: '#4361ee',
        icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M9.348 14.651a3.75 3.75 0 010-5.303m5.304 0a3.75 3.75 0 010 5.303m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.808-3.808-9.98 0-13.789m13.788 0c3.808 3.808 3.808 9.981 0 13.79M12 12h.008v.007H12V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/>',
      },
      {
        label: 'Triggers Today',
        value: summary.triggers_today || 0,
        total: null,
        color: (summary.triggers_today || 0) > 0 ? '#ff1744' : '#00c853',
        icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/>',
      },
      {
        label: 'Muted Rules',
        value: summary.muted_rules || 0,
        total: null,
        color: (summary.muted_rules || 0) > 0 ? '#ffd600' : '#4361ee',
        icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.531V19.94a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.506-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z"/>',
      },
    ];

    return `
      <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:16px; margin-bottom:24px;">
        ${cards.map(card => `
          <div style="background:#16213e; border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:20px; display:flex; align-items:center; gap:16px;">
            <div style="width:44px; height:44px; border-radius:10px; background:${card.color}18; border:1px solid ${card.color}35; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              <svg style="width:22px; height:22px; color:${card.color};" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">${card.icon}</svg>
            </div>
            <div>
              <div style="font-size:22px; font-weight:700; color:#e0e0e0; line-height:1;">
                ${card.value}${card.total !== null ? '<span style="font-size:13px; font-weight:400; color:#666;"> / ' + card.total + '</span>' : ''}
              </div>
              <div style="font-size:12px; color:#888; margin-top:4px;">${card.label}</div>
            </div>
          </div>
        `).join('')}
      </div>`;
  }

  /* ------------------------------------------------------------------
     Rules list
  ------------------------------------------------------------------ */
  function renderRulesList() {
    if (!rules || rules.length === 0) {
      return `
        <div style="text-align:center; padding:48px 20px;">
          <svg style="width:48px; height:48px; color:#444; margin:0 auto 12px;" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/>
          </svg>
          <p style="font-size:14px; color:#999; margin:0;">No alert rules configured</p>
          <p style="font-size:12px; color:#666; margin-top:6px;">Create your first alert rule to start monitoring your sessions</p>
        </div>`;
    }

    return rules.map((rule, idx) => {
      const mi = metricInfo(rule.metric);
      const ci = conditionInfo(rule.condition);
      const colors = METRIC_COLORS[rule.metric] || METRIC_COLORS.session_count;
      const muted = isMuted(rule);
      const muteMenuOpen = openMuteMenuId === rule.id;

      const channelBadges = (rule.notify_channels || []).map(ch => {
        const chColors = { dashboard: '#4361ee', webhook: '#ab47bc', email: '#00c853' };
        const chLabels = { dashboard: 'Dashboard', webhook: 'Webhook', email: 'Email' };
        return `<span style="display:inline-block; padding:2px 8px; border-radius:6px; font-size:10px; font-weight:600; background:${chColors[ch] || '#555'}22; color:${chColors[ch] || '#888'}; border:1px solid ${chColors[ch] || '#555'}35;">${chLabels[ch] || ch}</span>`;
      }).join(' ');

      return `
        <div style="background:#16213e; border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:20px; transition:border-color 0.2s; ${muted ? 'opacity:0.6;' : ''}"
             onmouseenter="this.style.borderColor='rgba(255,255,255,0.12)'" onmouseleave="this.style.borderColor='rgba(255,255,255,0.06)'"
             data-rule-card="${rule.id}">
          <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:16px;">
            <!-- Left: Info -->
            <div style="flex:1; min-width:0;">
              <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                <div style="width:36px; height:36px; border-radius:8px; background:${colors.bg}; border:1px solid ${colors.border}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                  <span style="font-size:14px; font-weight:700; color:${colors.text};">${ci.symbol}</span>
                </div>
                <div>
                  <h4 style="font-size:14px; font-weight:600; color:#e0e0e0; margin:0; line-height:1.2;">
                    ${escapeHtml(rule.name)}
                    ${muted ? '<span style="font-size:10px; padding:2px 6px; border-radius:4px; background:rgba(255,214,0,0.12); color:#ffd600; border:1px solid rgba(255,214,0,0.25); margin-left:8px; vertical-align:middle;">MUTED</span>' : ''}
                  </h4>
                  ${rule.description ? `<p style="font-size:11px; color:#777; margin:2px 0 0 0;">${escapeHtml(rule.description)}</p>` : ''}
                </div>
              </div>

              <!-- Metric/Condition display -->
              <div style="display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-bottom:10px;">
                <span style="display:inline-block; padding:3px 10px; border-radius:6px; font-size:11px; font-weight:600; background:${colors.bg}; color:${colors.text}; border:1px solid ${colors.border};">${mi.label}</span>
                <span style="font-size:12px; color:#999;">${ci.label}</span>
                <span style="font-size:13px; font-weight:700; color:#e0e0e0;">${formatThreshold(rule.metric, rule.threshold)}</span>
                <span style="font-size:11px; color:#666;">over ${windowLabel(rule.window_minutes)}</span>
              </div>

              <!-- Channels and meta -->
              <div style="display:flex; flex-wrap:wrap; align-items:center; gap:12px;">
                <div style="display:flex; gap:4px;">${channelBadges}</div>
                <span style="font-size:11px; color:#666;">Cooldown: ${windowLabel(rule.cooldown_minutes)}</span>
                <span style="font-size:11px; color:#666;">Last triggered: <span style="color:#999;">${timeAgo(rule.last_triggered_at)}</span></span>
              </div>
            </div>

            <!-- Right: Actions -->
            <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
              <!-- Toggle enabled -->
              <button onclick="AlertsPage.toggleEnabled('${rule.id}', ${!rule.enabled})"
                      style="position:relative; width:40px; height:22px; border-radius:11px; border:none; cursor:pointer; transition:background 0.2s; background:${rule.enabled ? '#00c853' : '#444'};"
                      title="${rule.enabled ? 'Enabled - click to disable' : 'Disabled - click to enable'}">
                <span style="position:absolute; top:3px; width:16px; height:16px; border-radius:50%; background:white; box-shadow:0 1px 3px rgba(0,0,0,0.3); transition:left 0.2s; left:${rule.enabled ? '21px' : '3px'};"></span>
              </button>

              <!-- Mute -->
              <div style="position:relative;">
                <button onclick="AlertsPage.toggleMuteMenu('${rule.id}')"
                        style="padding:6px 8px; border-radius:8px; border:1px solid rgba(255,255,255,0.08); background:transparent; color:${muted ? '#ffd600' : '#888'}; cursor:pointer; font-size:12px; transition:all 0.15s;"
                        onmouseenter="this.style.background='rgba(255,255,255,0.05)'" onmouseleave="this.style.background='transparent'"
                        title="${muted ? 'Muted until ' + formatTimestamp(rule.muted_until) : 'Mute this rule'}">
                  <svg style="width:16px; height:16px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.531V19.94a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.506-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z"/>
                  </svg>
                </button>
                ${muteMenuOpen ? `
                  <div style="position:absolute; right:0; top:100%; margin-top:4px; background:#1a1a2e; border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:4px; z-index:50; min-width:140px; box-shadow:0 8px 24px rgba(0,0,0,0.4);">
                    ${muted ? `
                      <button onclick="AlertsPage.unmute('${rule.id}')"
                              style="display:block; width:100%; text-align:left; padding:8px 12px; border:none; background:transparent; color:#00c853; font-size:12px; cursor:pointer; border-radius:6px; transition:background 0.15s;"
                              onmouseenter="this.style.background='rgba(0,200,83,0.1)'" onmouseleave="this.style.background='transparent'">
                        Unmute
                      </button>
                    ` : ''}
                    ${MUTE_OPTIONS.map(opt => `
                      <button onclick="AlertsPage.mute('${rule.id}', ${opt.minutes})"
                              style="display:block; width:100%; text-align:left; padding:8px 12px; border:none; background:transparent; color:#e0e0e0; font-size:12px; cursor:pointer; border-radius:6px; transition:background 0.15s;"
                              onmouseenter="this.style.background='rgba(255,255,255,0.05)'" onmouseleave="this.style.background='transparent'">
                        Mute for ${opt.label}
                      </button>
                    `).join('')}
                  </div>
                ` : ''}
              </div>

              <!-- Test -->
              <button onclick="AlertsPage.testRule('${rule.id}')"
                      style="padding:6px 12px; border-radius:8px; border:1px solid rgba(67,97,238,0.3); background:transparent; color:#4361ee; cursor:pointer; font-size:12px; font-weight:500; transition:all 0.15s;"
                      onmouseenter="this.style.background='rgba(67,97,238,0.1)'" onmouseleave="this.style.background='transparent'"
                      title="Test this rule">
                Test
              </button>

              <!-- Edit -->
              <button onclick="AlertsPage.showEditModal('${rule.id}')"
                      style="padding:6px 8px; border-radius:8px; border:1px solid rgba(255,255,255,0.08); background:transparent; color:#888; cursor:pointer; transition:all 0.15s;"
                      onmouseenter="this.style.color='#e0e0e0'; this.style.background='rgba(255,255,255,0.05)'"
                      onmouseleave="this.style.color='#888'; this.style.background='transparent'"
                      title="Edit rule">
                <svg style="width:16px; height:16px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"/>
                </svg>
              </button>

              <!-- Delete -->
              <button onclick="AlertsPage.deleteRule('${rule.id}')"
                      style="padding:6px 8px; border-radius:8px; border:1px solid rgba(255,255,255,0.08); background:transparent; color:#666; cursor:pointer; transition:all 0.15s;"
                      onmouseenter="this.style.color='#ff1744'; this.style.background='rgba(255,23,68,0.08)'"
                      onmouseleave="this.style.color='#666'; this.style.background='transparent'"
                      title="Delete rule">
                <svg style="width:16px; height:16px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/>
                </svg>
              </button>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  /* ------------------------------------------------------------------
     Alert history table
  ------------------------------------------------------------------ */
  function renderHistoryTable() {
    if (!history || history.length === 0) {
      return `
        <div style="text-align:center; padding:40px 20px;">
          <svg style="width:40px; height:40px; color:#444; margin:0 auto 10px;" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <p style="font-size:13px; color:#999; margin:0;">No alerts triggered yet</p>
          <p style="font-size:11px; color:#666; margin-top:4px;">Alerts will appear here when rule conditions are met</p>
        </div>`;
    }

    const rows = history.map(entry => {
      const mi = metricInfo(entry.metric);
      const ci = conditionInfo(entry.condition);
      const colors = METRIC_COLORS[entry.metric] || METRIC_COLORS.session_count;

      const statusStyles = {
        triggered: { bg: 'rgba(255,23,68,0.1)', color: '#ff1744', border: 'rgba(255,23,68,0.25)', label: 'Triggered' },
        test:      { bg: 'rgba(67,97,238,0.1)',  color: '#4361ee', border: 'rgba(67,97,238,0.25)', label: 'Test' },
        resolved:  { bg: 'rgba(0,200,83,0.1)',   color: '#00c853', border: 'rgba(0,200,83,0.25)',  label: 'Resolved' },
      };
      const st = statusStyles[entry.status] || statusStyles.triggered;

      return `
        <tr style="border-top:1px solid rgba(255,255,255,0.04);"
            onmouseenter="this.style.background='rgba(255,255,255,0.02)'" onmouseleave="this.style.background='transparent'">
          <td style="padding:12px 16px; font-size:13px; color:#e0e0e0; white-space:nowrap;">${formatTimestamp(entry.triggered_at)}</td>
          <td style="padding:12px 16px; font-size:13px; font-weight:500; color:#e0e0e0;">${escapeHtml(entry.rule_name)}</td>
          <td style="padding:12px 16px;">
            <span style="display:inline-block; padding:2px 8px; border-radius:6px; font-size:11px; font-weight:600; background:${colors.bg}; color:${colors.text}; border:1px solid ${colors.border};">${mi.label}</span>
          </td>
          <td style="padding:12px 16px; font-size:13px;">
            <span style="color:#e0e0e0; font-weight:600;">${entry.metric_value !== undefined ? entry.metric_value : '--'}</span>
            <span style="color:#666; margin:0 4px;">${ci.symbol}</span>
            <span style="color:#999;">${entry.threshold !== undefined ? entry.threshold : '--'}</span>
          </td>
          <td style="padding:12px 16px;">
            <span style="display:inline-block; padding:2px 8px; border-radius:6px; font-size:11px; font-weight:600; background:${st.bg}; color:${st.color}; border:1px solid ${st.border};">${st.label}</span>
          </td>
          <td style="padding:12px 16px;">
            <button onclick="App.navigate('sessions')"
                    style="font-size:11px; color:#4361ee; background:none; border:none; cursor:pointer; text-decoration:underline; padding:0;"
                    title="View related sessions">
              View Sessions
            </button>
          </td>
        </tr>`;
    }).join('');

    const pagination = historyPages > 1 ? `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-top:1px solid rgba(255,255,255,0.04);">
        <span style="font-size:12px; color:#666;">Page ${historyPage} of ${historyPages}</span>
        <div style="display:flex; gap:6px;">
          <button onclick="AlertsPage.loadHistoryPage(${historyPage - 1})"
                  style="padding:4px 12px; border-radius:6px; border:1px solid rgba(255,255,255,0.08); background:transparent; color:${historyPage > 1 ? '#e0e0e0' : '#444'}; cursor:${historyPage > 1 ? 'pointer' : 'default'}; font-size:12px; transition:background 0.15s;"
                  ${historyPage <= 1 ? 'disabled' : ''}
                  onmouseenter="if(${historyPage > 1})this.style.background='rgba(255,255,255,0.05)'" onmouseleave="this.style.background='transparent'">
            Previous
          </button>
          <button onclick="AlertsPage.loadHistoryPage(${historyPage + 1})"
                  style="padding:4px 12px; border-radius:6px; border:1px solid rgba(255,255,255,0.08); background:transparent; color:${historyPage < historyPages ? '#e0e0e0' : '#444'}; cursor:${historyPage < historyPages ? 'pointer' : 'default'}; font-size:12px; transition:background 0.15s;"
                  ${historyPage >= historyPages ? 'disabled' : ''}
                  onmouseenter="if(${historyPage < historyPages})this.style.background='rgba(255,255,255,0.05)'" onmouseleave="this.style.background='transparent'">
            Next
          </button>
        </div>
      </div>
    ` : '';

    return `
      <div style="border:1px solid rgba(255,255,255,0.06); border-radius:12px; overflow:hidden;">
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr style="background:rgba(22,33,62,0.8);">
              <th style="padding:12px 16px; text-align:left; font-size:11px; font-weight:600; color:#888; text-transform:uppercase; letter-spacing:0.5px;">Time</th>
              <th style="padding:12px 16px; text-align:left; font-size:11px; font-weight:600; color:#888; text-transform:uppercase; letter-spacing:0.5px;">Rule</th>
              <th style="padding:12px 16px; text-align:left; font-size:11px; font-weight:600; color:#888; text-transform:uppercase; letter-spacing:0.5px;">Metric</th>
              <th style="padding:12px 16px; text-align:left; font-size:11px; font-weight:600; color:#888; text-transform:uppercase; letter-spacing:0.5px;">Value / Threshold</th>
              <th style="padding:12px 16px; text-align:left; font-size:11px; font-weight:600; color:#888; text-transform:uppercase; letter-spacing:0.5px;">Status</th>
              <th style="padding:12px 16px; text-align:left; font-size:11px; font-weight:600; color:#888; text-transform:uppercase; letter-spacing:0.5px; width:100px;">Action</th>
            </tr>
          </thead>
          <tbody style="background:rgba(22,33,62,0.3);">${rows}</tbody>
        </table>
        ${pagination}
      </div>`;
  }

  /* ------------------------------------------------------------------
     Create / Edit modal
  ------------------------------------------------------------------ */
  function buildRuleForm(rule) {
    const isEdit = !!rule;
    const r = rule || {
      name: '', description: '', metric: 'error_rate', condition: 'gt',
      threshold: 10, window_minutes: 60, cooldown_minutes: 60,
      notify_channels: ['dashboard'], webhook_url: '', email_to: '',
      filters: {},
    };

    const metricOptions = METRICS.map(m =>
      `<option value="${m.value}" ${r.metric === m.value ? 'selected' : ''}>${m.label} - ${m.description}</option>`
    ).join('');

    const conditionOptions = CONDITIONS.map(c =>
      `<option value="${c.value}" ${r.condition === c.value ? 'selected' : ''}>${c.label} (${c.symbol})</option>`
    ).join('');

    const windowOptions = WINDOWS.map(w =>
      `<option value="${w.value}" ${r.window_minutes === w.value ? 'selected' : ''}>${w.label}</option>`
    ).join('');

    const cooldownOptions = COOLDOWNS.map(c =>
      `<option value="${c.value}" ${r.cooldown_minutes === c.value ? 'selected' : ''}>${c.label}</option>`
    ).join('');

    const hasDashboard = (r.notify_channels || []).includes('dashboard');
    const hasWebhook = (r.notify_channels || []).includes('webhook');
    const hasEmail = (r.notify_channels || []).includes('email');

    const mi = metricInfo(r.metric);
    const thresholdLabel = mi.unit ? `Threshold (${mi.unit})` : 'Threshold';

    return `
      <div style="display:flex; flex-direction:column; gap:16px;">
        ${isEdit ? `<input type="hidden" id="alert-edit-id" value="${r.id}" />` : ''}

        <!-- Name -->
        <div>
          <label style="display:block; font-size:12px; font-weight:500; color:#888; margin-bottom:6px;">Rule Name</label>
          <input type="text" id="alert-name" value="${escapeAttr(r.name)}" placeholder="e.g., High Error Rate Alert"
                 style="width:100%; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:10px 12px; font-size:13px; color:#e0e0e0; outline:none; transition:border-color 0.2s;"
                 onfocus="this.style.borderColor='#4361ee'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'" />
        </div>

        <!-- Description -->
        <div>
          <label style="display:block; font-size:12px; font-weight:500; color:#888; margin-bottom:6px;">Description (optional)</label>
          <input type="text" id="alert-description" value="${escapeAttr(r.description || '')}" placeholder="Brief description of what this alert monitors"
                 style="width:100%; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:10px 12px; font-size:13px; color:#e0e0e0; outline:none; transition:border-color 0.2s;"
                 onfocus="this.style.borderColor='#4361ee'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'" />
        </div>

        <!-- Metric + Condition row -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>
            <label style="display:block; font-size:12px; font-weight:500; color:#888; margin-bottom:6px;">Metric</label>
            <select id="alert-metric" onchange="AlertsPage.onMetricChange()"
                    style="width:100%; background:#1a1a2e; border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:10px 12px; font-size:13px; color:#e0e0e0; outline:none; cursor:pointer;">
              ${metricOptions}
            </select>
          </div>
          <div>
            <label style="display:block; font-size:12px; font-weight:500; color:#888; margin-bottom:6px;">Condition</label>
            <select id="alert-condition"
                    style="width:100%; background:#1a1a2e; border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:10px 12px; font-size:13px; color:#e0e0e0; outline:none; cursor:pointer;">
              ${conditionOptions}
            </select>
          </div>
        </div>

        <!-- Threshold -->
        <div>
          <label id="alert-threshold-label" style="display:block; font-size:12px; font-weight:500; color:#888; margin-bottom:6px;">${thresholdLabel}</label>
          <input type="number" id="alert-threshold" value="${r.threshold}" min="0" step="any"
                 style="width:100%; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:10px 12px; font-size:13px; color:#e0e0e0; outline:none; transition:border-color 0.2s;"
                 onfocus="this.style.borderColor='#4361ee'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'" />
        </div>

        <!-- Window + Cooldown row -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>
            <label style="display:block; font-size:12px; font-weight:500; color:#888; margin-bottom:6px;">Time Window</label>
            <select id="alert-window"
                    style="width:100%; background:#1a1a2e; border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:10px 12px; font-size:13px; color:#e0e0e0; outline:none; cursor:pointer;">
              ${windowOptions}
            </select>
          </div>
          <div>
            <label style="display:block; font-size:12px; font-weight:500; color:#888; margin-bottom:6px;">Cooldown</label>
            <select id="alert-cooldown"
                    style="width:100%; background:#1a1a2e; border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:10px 12px; font-size:13px; color:#e0e0e0; outline:none; cursor:pointer;">
              ${cooldownOptions}
            </select>
          </div>
        </div>

        <!-- Notification Channels -->
        <div>
          <label style="display:block; font-size:12px; font-weight:500; color:#888; margin-bottom:8px;">Notification Channels</label>
          <div style="display:flex; flex-wrap:wrap; gap:16px;">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" class="alert-channel-cb" value="dashboard" ${hasDashboard ? 'checked' : ''}
                     style="width:16px; height:16px; accent-color:#4361ee; cursor:pointer;" />
              <span style="font-size:13px; color:#ccc;">Dashboard</span>
            </label>
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" class="alert-channel-cb" value="webhook" ${hasWebhook ? 'checked' : ''}
                     onchange="AlertsPage.onChannelChange()"
                     style="width:16px; height:16px; accent-color:#4361ee; cursor:pointer;" />
              <span style="font-size:13px; color:#ccc;">Webhook</span>
            </label>
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" class="alert-channel-cb" value="email" ${hasEmail ? 'checked' : ''}
                     onchange="AlertsPage.onChannelChange()"
                     style="width:16px; height:16px; accent-color:#4361ee; cursor:pointer;" />
              <span style="font-size:13px; color:#ccc;">Email</span>
            </label>
          </div>
        </div>

        <!-- Webhook URL (conditional) -->
        <div id="alert-webhook-section" style="display:${hasWebhook ? 'block' : 'none'};">
          <label style="display:block; font-size:12px; font-weight:500; color:#888; margin-bottom:6px;">Webhook URL</label>
          <input type="text" id="alert-webhook-url" value="${escapeAttr(r.webhook_url || '')}" placeholder="https://your-server.com/alerts-webhook"
                 style="width:100%; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:10px 12px; font-size:13px; color:#e0e0e0; outline:none; transition:border-color 0.2s;"
                 onfocus="this.style.borderColor='#4361ee'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'" />
        </div>

        <!-- Email (conditional) -->
        <div id="alert-email-section" style="display:${hasEmail ? 'block' : 'none'};">
          <label style="display:block; font-size:12px; font-weight:500; color:#888; margin-bottom:6px;">Email Address</label>
          <input type="email" id="alert-email-to" value="${escapeAttr(r.email_to || '')}" placeholder="alerts@yourcompany.com"
                 style="width:100%; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:10px 12px; font-size:13px; color:#e0e0e0; outline:none; transition:border-color 0.2s;"
                 onfocus="this.style.borderColor='#4361ee'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'" />
        </div>

        <!-- URL Pattern Filter (optional) -->
        <div>
          <label style="display:block; font-size:12px; font-weight:500; color:#888; margin-bottom:6px;">URL Pattern Filter (optional)</label>
          <input type="text" id="alert-url-pattern" value="${escapeAttr((r.filters && r.filters.url_pattern) || '')}" placeholder="e.g., /checkout or /pricing"
                 style="width:100%; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:10px 12px; font-size:13px; color:#e0e0e0; outline:none; transition:border-color 0.2s;"
                 onfocus="this.style.borderColor='#4361ee'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'" />
          <p style="font-size:11px; color:#666; margin:4px 0 0 0;">Only monitor sessions matching this URL pattern</p>
        </div>
      </div>`;
  }

  function showCreateModal() {
    editingRuleId = null;
    const content = buildRuleForm(null);
    Components.showModal('Create Alert Rule', content, [
      { label: 'Create Rule', onClick: 'AlertsPage.saveRule()', class: 'bg-blue-600 hover:bg-blue-700 text-white' },
    ]);
  }

  function showEditModal(ruleId) {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;
    editingRuleId = ruleId;
    const content = buildRuleForm(rule);
    Components.showModal('Edit Alert Rule', content, [
      { label: 'Save Changes', onClick: 'AlertsPage.saveRule()', class: 'bg-blue-600 hover:bg-blue-700 text-white' },
    ]);
  }

  /* ------------------------------------------------------------------
     Modal callbacks for dynamic fields
  ------------------------------------------------------------------ */
  function onMetricChange() {
    const metricEl = document.getElementById('alert-metric');
    const labelEl = document.getElementById('alert-threshold-label');
    if (!metricEl || !labelEl) return;
    const mi = metricInfo(metricEl.value);
    labelEl.textContent = mi.unit ? `Threshold (${mi.unit})` : 'Threshold';
  }

  function onChannelChange() {
    const webhookSection = document.getElementById('alert-webhook-section');
    const emailSection = document.getElementById('alert-email-section');
    const checkboxes = document.querySelectorAll('.alert-channel-cb');

    let hasWebhook = false;
    let hasEmail = false;
    checkboxes.forEach(cb => {
      if (cb.value === 'webhook' && cb.checked) hasWebhook = true;
      if (cb.value === 'email' && cb.checked) hasEmail = true;
    });

    if (webhookSection) webhookSection.style.display = hasWebhook ? 'block' : 'none';
    if (emailSection) emailSection.style.display = hasEmail ? 'block' : 'none';
  }

  /* ------------------------------------------------------------------
     Save rule (create or update)
  ------------------------------------------------------------------ */
  async function saveRule() {
    const editIdEl = document.getElementById('alert-edit-id');
    const isEdit = editIdEl && editIdEl.value;

    const nameEl = document.getElementById('alert-name');
    const descEl = document.getElementById('alert-description');
    const metricEl = document.getElementById('alert-metric');
    const condEl = document.getElementById('alert-condition');
    const threshEl = document.getElementById('alert-threshold');
    const windowEl = document.getElementById('alert-window');
    const cooldownEl = document.getElementById('alert-cooldown');
    const webhookUrlEl = document.getElementById('alert-webhook-url');
    const emailToEl = document.getElementById('alert-email-to');
    const urlPatternEl = document.getElementById('alert-url-pattern');

    const name = nameEl ? nameEl.value.trim() : '';
    const description = descEl ? descEl.value.trim() : '';
    const metric = metricEl ? metricEl.value : '';
    const condition = condEl ? condEl.value : '';
    const threshold = threshEl ? parseFloat(threshEl.value) : 0;
    const window_minutes = windowEl ? parseInt(windowEl.value, 10) : 60;
    const cooldown_minutes = cooldownEl ? parseInt(cooldownEl.value, 10) : 60;
    const webhook_url = webhookUrlEl ? webhookUrlEl.value.trim() : '';
    const email_to = emailToEl ? emailToEl.value.trim() : '';
    const url_pattern = urlPatternEl ? urlPatternEl.value.trim() : '';

    // Collect channels
    const notify_channels = [];
    document.querySelectorAll('.alert-channel-cb:checked').forEach(cb => {
      notify_channels.push(cb.value);
    });

    // Validation
    if (!name) { Components.toast('Please enter a rule name', 'warning'); return; }
    if (isNaN(threshold)) { Components.toast('Please enter a valid threshold', 'warning'); return; }
    if (notify_channels.length === 0) { Components.toast('Please select at least one notification channel', 'warning'); return; }
    if (notify_channels.includes('webhook') && !webhook_url) { Components.toast('Please enter a webhook URL', 'warning'); return; }
    if (notify_channels.includes('email') && !email_to) { Components.toast('Please enter an email address', 'warning'); return; }

    const filters = {};
    if (url_pattern) filters.url_pattern = url_pattern;

    const payload = {
      name,
      description,
      metric,
      condition,
      threshold,
      window_minutes,
      cooldown_minutes,
      notify_channels,
      webhook_url: webhook_url || null,
      email_to: email_to || null,
      filters,
      project_id: App.state.project,
    };

    try {
      if (isEdit) {
        await App.api('/alerts/rules/' + editIdEl.value, { method: 'PUT', body: payload });
        Components.toast('Alert rule updated', 'success');
      } else {
        await App.api('/alerts/rules', { method: 'POST', body: payload });
        Components.toast('Alert rule created', 'success');
      }
      Components.closeModal();
      const container = document.getElementById('main-content');
      if (container) render(container);
    } catch (_) {
      // Error displayed by App.api
    }
  }

  /* ------------------------------------------------------------------
     Actions
  ------------------------------------------------------------------ */
  async function toggleEnabled(ruleId, newEnabled) {
    try {
      await App.api('/alerts/rules/' + ruleId, { method: 'PUT', body: { enabled: newEnabled } });
      const rule = rules.find(r => r.id === ruleId);
      if (rule) rule.enabled = newEnabled;
      const rulesContainer = document.getElementById('alerts-rules-container');
      if (rulesContainer) rulesContainer.innerHTML = renderRulesList();
      Components.toast(newEnabled ? 'Rule enabled' : 'Rule disabled', 'info');
    } catch (_) {
      // Error shown by App.api
    }
  }

  async function deleteRule(ruleId) {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;

    Components.showModal(
      'Delete Alert Rule',
      `<div style="text-align:center; padding:8px 0;">
        <svg style="width:48px; height:48px; color:#ff1744; margin:0 auto 12px;" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
        </svg>
        <p style="font-size:14px; color:#ccc; margin:0;">Delete alert rule <strong style="color:#e0e0e0;">${escapeHtml(rule.name)}</strong>?</p>
        <p style="font-size:12px; color:#777; margin-top:6px;">This will also delete all alert history for this rule.</p>
      </div>`,
      [{
        label: 'Delete Rule',
        class: 'bg-red-600 hover:bg-red-700 text-white',
        onClick: `AlertsPage.confirmDelete('${ruleId}')`,
      }]
    );
  }

  async function confirmDelete(ruleId) {
    Components.closeModal();
    try {
      await App.api('/alerts/rules/' + ruleId, { method: 'DELETE' });
      Components.toast('Alert rule deleted', 'info');
      const container = document.getElementById('main-content');
      if (container) render(container);
    } catch (_) {
      // Error shown by App.api
    }
  }

  async function testRule(ruleId) {
    Components.toast('Testing alert rule...', 'info');
    try {
      const result = await App.api('/alerts/rules/' + ruleId + '/test', { method: 'POST' });
      if (result.fired) {
        Components.toast(
          'Rule would fire! Metric value: ' + result.metric_value + ' ' + result.condition + ' ' + result.threshold,
          'warning'
        );
      } else {
        Components.toast(
          'Rule would NOT fire. Metric value: ' + result.metric_value + ' (threshold: ' + result.threshold + ')',
          'success'
        );
      }
      // Refresh history to show test entry
      await fetchHistory(1);
      const histContainer = document.getElementById('alerts-history-container');
      if (histContainer) histContainer.innerHTML = renderHistoryTable();
    } catch (_) {
      // Error shown by App.api
    }
  }

  function toggleMuteMenu(ruleId) {
    openMuteMenuId = openMuteMenuId === ruleId ? null : ruleId;
    const rulesContainer = document.getElementById('alerts-rules-container');
    if (rulesContainer) rulesContainer.innerHTML = renderRulesList();
  }

  async function mute(ruleId, minutes) {
    openMuteMenuId = null;
    const muteUntil = new Date(Date.now() + minutes * 60000).toISOString();
    try {
      await App.api('/alerts/rules/' + ruleId, { method: 'PUT', body: { muted_until: muteUntil } });
      const rule = rules.find(r => r.id === ruleId);
      if (rule) rule.muted_until = muteUntil;
      const rulesContainer = document.getElementById('alerts-rules-container');
      if (rulesContainer) rulesContainer.innerHTML = renderRulesList();
      Components.toast('Rule muted', 'info');
    } catch (_) {
      // Error shown by App.api
    }
  }

  async function unmute(ruleId) {
    openMuteMenuId = null;
    try {
      await App.api('/alerts/rules/' + ruleId, { method: 'PUT', body: { muted_until: null } });
      const rule = rules.find(r => r.id === ruleId);
      if (rule) rule.muted_until = null;
      const rulesContainer = document.getElementById('alerts-rules-container');
      if (rulesContainer) rulesContainer.innerHTML = renderRulesList();
      Components.toast('Rule unmuted', 'info');
    } catch (_) {
      // Error shown by App.api
    }
  }

  async function loadHistoryPage(page) {
    if (page < 1 || page > historyPages) return;
    await fetchHistory(page);
    const histContainer = document.getElementById('alerts-history-container');
    if (histContainer) histContainer.innerHTML = renderHistoryTable();
  }

  /* ------------------------------------------------------------------
     Main render
  ------------------------------------------------------------------ */
  async function render(container) {
    container.innerHTML = `
      <div style="max-width:960px;">
        <div style="display:flex; align-items:center; justify-content:center; padding:60px 0;">
          <div style="width:32px; height:32px; border:3px solid #4361ee; border-top-color:transparent; border-radius:50%; animation:spin 0.8s linear infinite;"></div>
        </div>
      </div>`;

    // Fetch all data in parallel
    await Promise.all([
      fetchRules(),
      fetchHistory(1),
      fetchSummary(),
    ]);

    container.innerHTML = `
      <div style="max-width:960px;">
        <!-- Header -->
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:24px;">
          <div>
            <h2 style="font-size:18px; font-weight:600; color:#e0e0e0; margin:0;">Alerts & Monitoring</h2>
            <p style="font-size:13px; color:#888; margin:4px 0 0 0;">Configure alert rules, manage notifications, and review triggered alerts</p>
          </div>
          <button onclick="AlertsPage.showCreateModal()"
                  style="display:flex; align-items:center; gap:8px; background:#4361ee; color:white; border:none; padding:10px 18px; border-radius:8px; font-size:13px; font-weight:500; cursor:pointer; transition:background 0.2s;"
                  onmouseenter="this.style.background='#3651d4'" onmouseleave="this.style.background='#4361ee'">
            <svg style="width:16px; height:16px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
            </svg>
            Create Rule
          </button>
        </div>

        <!-- Summary Bar -->
        ${renderSummaryBar()}

        <!-- Alert Rules Section -->
        <div style="margin-bottom:32px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px;">
            <h3 style="font-size:12px; font-weight:600; color:#999; text-transform:uppercase; letter-spacing:0.8px; margin:0;">Alert Rules</h3>
            <span style="font-size:12px; color:#666;">${rules.length} rule${rules.length !== 1 ? 's' : ''} configured</span>
          </div>
          <div id="alerts-rules-container" style="display:flex; flex-direction:column; gap:12px;">
            ${renderRulesList()}
          </div>
        </div>

        <!-- Alert History Section -->
        <div>
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px;">
            <h3 style="font-size:12px; font-weight:600; color:#999; text-transform:uppercase; letter-spacing:0.8px; margin:0;">Alert History</h3>
            ${history.length > 0 ? `<span style="font-size:11px; padding:2px 8px; border-radius:6px; background:rgba(255,23,68,0.1); color:#ff1744; border:1px solid rgba(255,23,68,0.25);">${summary.triggers_today || 0} today</span>` : ''}
          </div>
          <div id="alerts-history-container">
            ${renderHistoryTable()}
          </div>
        </div>
      </div>`;

    // Close mute menus on outside click
    document.addEventListener('click', handleOutsideClick);
  }

  function handleOutsideClick(e) {
    if (openMuteMenuId && !e.target.closest('[data-rule-card]')) {
      openMuteMenuId = null;
      const rulesContainer = document.getElementById('alerts-rules-container');
      if (rulesContainer) rulesContainer.innerHTML = renderRulesList();
    }
  }

  /* ------------------------------------------------------------------
     Init / Destroy lifecycle
  ------------------------------------------------------------------ */
  function init() {
    const container = document.getElementById('main-content');
    if (container) render(container);

    // Auto-refresh every 60 seconds
    refreshTimer = setInterval(() => {
      fetchSummary().then(() => {
        const container = document.getElementById('main-content');
        if (container && document.getElementById('alerts-rules-container')) {
          // Soft refresh just the summary bar section
          fetchRules().then(() => {
            const rulesContainer = document.getElementById('alerts-rules-container');
            if (rulesContainer) rulesContainer.innerHTML = renderRulesList();
          });
        }
      });
    }, 60000);
  }

  function destroy() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
    document.removeEventListener('click', handleOutsideClick);
    rules = [];
    history = [];
    summary = {};
    editingRuleId = null;
    openMuteMenuId = null;
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
    saveRule,
    toggleEnabled,
    deleteRule,
    confirmDelete,
    testRule,
    toggleMuteMenu,
    mute,
    unmute,
    loadHistoryPage,
    onMetricChange,
    onChannelChange,
  };

})();

/* Global registration for router compatibility */
function renderAlertsPage(container) {
  AlertsPage.render(container);
}

window.AlertsPage = AlertsPage;
