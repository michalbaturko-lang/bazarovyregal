/* ==========================================================================
   alerts-page.js  -  Alert Rules & Alert Log (MVP with localStorage)
   Configurable alert rules that check conditions on page load
   ========================================================================== */

const AlertsPage = (() => {

  /* ------------------------------------------------------------------
     Constants
  ------------------------------------------------------------------ */
  const STORAGE_KEY_RULES = 'rml_alert_rules';
  const STORAGE_KEY_LOG = 'rml_alert_log';

  const ALERT_TYPES = [
    { value: 'rage_clicks', label: 'Rage Clicks Spike', description: 'Triggers when rage click sessions exceed threshold in the last hour' },
    { value: 'error_spike', label: 'Error Spike', description: 'Triggers when JS error sessions exceed threshold in the last hour' },
    { value: 'session_drop', label: 'Session Drop', description: 'Triggers when sessions drop by more than threshold % vs previous period' },
    { value: 'conversion_drop', label: 'Conversion Drop', description: 'Triggers when funnel conversion drops by more than threshold %' },
  ];

  const ALERT_TYPE_ICONS = {
    rage_clicks: '\uD83D\uDE21',
    error_spike: '\u274C',
    session_drop: '\uD83D\uDCC9',
    conversion_drop: '\uD83D\uDCC9',
  };

  const ALERT_TYPE_COLORS = {
    rage_clicks: { bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-400' },
    error_spike: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400' },
    session_drop: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', text: 'text-yellow-400' },
    conversion_drop: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400' },
  };

  /* ------------------------------------------------------------------
     localStorage helpers
  ------------------------------------------------------------------ */
  function loadRules() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_RULES);
      return raw ? JSON.parse(raw) : getDefaultRules();
    } catch (e) {
      return getDefaultRules();
    }
  }

  function saveRules(rules) {
    try {
      localStorage.setItem(STORAGE_KEY_RULES, JSON.stringify(rules));
    } catch (e) {
      console.warn('[AlertsPage] Failed to save rules:', e);
    }
  }

  function loadLog() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_LOG);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveLog(log) {
    try {
      localStorage.setItem(STORAGE_KEY_LOG, JSON.stringify(log));
    } catch (e) {
      console.warn('[AlertsPage] Failed to save log:', e);
    }
  }

  function getDefaultRules() {
    return [
      { id: 'rule_1', name: 'Rage Clicks Spike', type: 'rage_clicks', threshold: 5, active: true, created_at: new Date().toISOString() },
      { id: 'rule_2', name: 'Error Spike', type: 'error_spike', threshold: 10, active: true, created_at: new Date().toISOString() },
      { id: 'rule_3', name: 'Session Drop', type: 'session_drop', threshold: 30, active: false, created_at: new Date().toISOString() },
      { id: 'rule_4', name: 'Conversion Drop', type: 'conversion_drop', threshold: 20, active: false, created_at: new Date().toISOString() },
    ];
  }

  function generateId() {
    return 'rule_' + Math.random().toString(36).slice(2, 10);
  }

  /* ------------------------------------------------------------------
     Check alert conditions against dashboard data
  ------------------------------------------------------------------ */
  async function checkAlertConditions(rules) {
    const log = loadLog();
    const now = new Date();
    let newAlerts = 0;

    try {
      // Fetch current stats to check conditions
      const stats = await App.api('/dashboard/stats?project_id=' + App.state.project +
        '&date_from=' + new Date(Date.now() - 3600000).toISOString() +
        '&date_to=' + now.toISOString());

      for (const rule of rules) {
        if (!rule.active) continue;

        let triggered = false;
        let conditionText = '';

        switch (rule.type) {
          case 'rage_clicks':
            if ((stats.rage_click_sessions || 0) > rule.threshold) {
              triggered = true;
              conditionText = `${stats.rage_click_sessions} rage click sessions (threshold: ${rule.threshold})`;
            }
            break;
          case 'error_spike':
            if ((stats.error_sessions || 0) > rule.threshold) {
              triggered = true;
              conditionText = `${stats.error_sessions} error sessions (threshold: ${rule.threshold})`;
            }
            break;
          case 'session_drop':
            // Simple heuristic: compare total sessions vs a baseline
            // In MVP we just check if sessions are below the threshold number
            if ((stats.total_sessions || 0) < rule.threshold) {
              triggered = true;
              conditionText = `Only ${stats.total_sessions} sessions (threshold: ${rule.threshold})`;
            }
            break;
          case 'conversion_drop':
            // MVP: This would require funnel data, skip real check
            // Just demonstrate the structure
            break;
        }

        if (triggered) {
          // Check if we already alerted for this rule in the last hour
          const recentAlert = log.find(l =>
            l.rule_id === rule.id &&
            (now - new Date(l.triggered_at)) < 3600000
          );

          if (!recentAlert) {
            log.unshift({
              id: 'alert_' + Math.random().toString(36).slice(2, 10),
              rule_id: rule.id,
              rule_name: rule.name,
              type: rule.type,
              triggered_at: now.toISOString(),
              condition: conditionText,
              status: 'new',
            });
            newAlerts++;
          }
        }
      }
    } catch (err) {
      // Silently fail - don't break the page if API is down
      console.warn('[AlertsPage] Alert check failed:', err.message);
    }

    // Keep only last 100 log entries
    const trimmedLog = log.slice(0, 100);
    saveLog(trimmedLog);

    if (newAlerts > 0) {
      Components.toast(`${newAlerts} alert${newAlerts > 1 ? 's' : ''} triggered`, 'warning');
    }

    return trimmedLog;
  }

  /* ------------------------------------------------------------------
     Render alert rules list
  ------------------------------------------------------------------ */
  function renderRulesList(rules) {
    if (!rules || rules.length === 0) {
      return `
        <div class="flex flex-col items-center justify-center py-12 text-center">
          <svg class="w-10 h-10 text-slate-600 mb-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/>
          </svg>
          <p class="text-sm text-slate-400">No alert rules configured</p>
          <p class="text-xs text-slate-500 mt-1">Create your first alert rule to start monitoring</p>
        </div>`;
    }

    return rules.map((rule, idx) => {
      const typeInfo = ALERT_TYPES.find(t => t.value === rule.type) || { label: rule.type };
      const colors = ALERT_TYPE_COLORS[rule.type] || { bg: 'bg-slate-500/10', border: 'border-slate-500/20', text: 'text-slate-400' };
      const icon = ALERT_TYPE_ICONS[rule.type] || '\uD83D\uDD14';

      return `
        <div class="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4 hover:border-slate-600/50 transition-all duration-200"
             style="animation: fadeInUp 0.3s ease-out ${idx * 0.05}s both;">
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 rounded-lg ${colors.bg} border ${colors.border} flex items-center justify-center text-lg flex-shrink-0">
                ${icon}
              </div>
              <div>
                <h4 class="text-sm font-semibold text-white mb-0.5">${rule.name}</h4>
                <p class="text-xs text-slate-400 mb-1.5">${typeInfo.description || typeInfo.label}</p>
                <div class="flex items-center gap-3">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${colors.bg} ${colors.border} ${colors.text}">${typeInfo.label}</span>
                  <span class="text-xs text-slate-500">Threshold: <strong class="text-slate-300">${rule.threshold}</strong></span>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <!-- Toggle -->
              <button onclick="AlertsPage.toggleRule('${rule.id}')"
                      class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${rule.active ? 'bg-green-600' : 'bg-slate-600'}"
                      title="${rule.active ? 'Active - click to pause' : 'Paused - click to activate'}">
                <span class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${rule.active ? 'translate-x-6' : 'translate-x-1'}"></span>
              </button>
              <!-- Delete -->
              <button onclick="AlertsPage.deleteRule('${rule.id}')"
                      class="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete rule">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/>
                </svg>
              </button>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  /* ------------------------------------------------------------------
     Render alert log table
  ------------------------------------------------------------------ */
  function renderAlertLog(log) {
    if (!log || log.length === 0) {
      return `
        <div class="flex flex-col items-center justify-center py-10 text-center">
          <svg class="w-8 h-8 text-slate-600 mb-2" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"/>
          </svg>
          <p class="text-sm text-slate-400">No alerts triggered yet</p>
          <p class="text-xs text-slate-500 mt-1">Alerts will appear here when conditions are met</p>
        </div>`;
    }

    const rows = log.slice(0, 50).map(entry => {
      const colors = ALERT_TYPE_COLORS[entry.type] || { bg: 'bg-slate-500/10', border: 'border-slate-500/20', text: 'text-slate-400' };
      const icon = ALERT_TYPE_ICONS[entry.type] || '\uD83D\uDD14';
      const statusClass = entry.status === 'new'
        ? 'bg-red-500/15 text-red-400 border-red-500/20'
        : 'bg-slate-600/30 text-slate-400 border-slate-500/20';
      const statusLabel = entry.status === 'new' ? 'New' : 'Acknowledged';
      const timeStr = new Date(entry.triggered_at).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      });

      return `
        <tr class="border-t border-slate-700/50 hover:bg-slate-700/30 transition-colors">
          <td class="px-4 py-3 text-sm">
            <div class="flex items-center gap-2">
              <span>${icon}</span>
              <span class="text-white font-medium">${entry.rule_name}</span>
            </div>
          </td>
          <td class="px-4 py-3 text-sm text-slate-400">${timeStr}</td>
          <td class="px-4 py-3 text-sm text-slate-400 max-w-xs truncate">${entry.condition || '-'}</td>
          <td class="px-4 py-3">
            <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${statusClass}">${statusLabel}</span>
          </td>
          <td class="px-4 py-3">
            ${entry.status === 'new' ? `
              <button onclick="AlertsPage.acknowledgeAlert('${entry.id}')"
                      class="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                Acknowledge
              </button>
            ` : ''}
          </td>
        </tr>`;
    }).join('');

    return `
      <div class="overflow-x-auto rounded-xl border border-slate-700/50">
        <table class="w-full">
          <thead class="bg-slate-800/80">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Alert</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Triggered</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Condition</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider" style="width:100px">Action</th>
            </tr>
          </thead>
          <tbody class="bg-slate-800/30">${rows}</tbody>
        </table>
      </div>`;
  }

  /* ------------------------------------------------------------------
     Show create rule modal
  ------------------------------------------------------------------ */
  function showCreateModal() {
    const typeOptions = ALERT_TYPES.map(t =>
      `<option value="${t.value}">${t.label}</option>`
    ).join('');

    const content = `
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-slate-400 mb-1.5">Rule Name</label>
          <input type="text" id="alert-rule-name" placeholder="e.g., High Error Rate"
                 class="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-400 mb-1.5">Alert Type</label>
          <select id="alert-rule-type"
                  class="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30">
            ${typeOptions}
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-400 mb-1.5">Threshold</label>
          <input type="number" id="alert-rule-threshold" placeholder="e.g., 10" min="1"
                 class="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30" />
          <p id="alert-threshold-hint" class="text-xs text-slate-500 mt-1">Number of rage click sessions to trigger alert</p>
        </div>
        <div>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" id="alert-rule-active" checked
                   class="w-4 h-4 rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500/30" />
            <span class="text-sm text-slate-300">Enable immediately</span>
          </label>
        </div>
      </div>`;

    Components.showModal('Create Alert Rule', content, [
      { label: 'Create Rule', onClick: 'AlertsPage.saveNewRule()', class: 'bg-blue-600 hover:bg-blue-700 text-white' },
    ]);

    // Update threshold hint when type changes
    setTimeout(() => {
      const typeSelect = document.getElementById('alert-rule-type');
      const hint = document.getElementById('alert-threshold-hint');
      if (typeSelect && hint) {
        typeSelect.addEventListener('change', () => {
          const selected = ALERT_TYPES.find(t => t.value === typeSelect.value);
          if (selected) {
            hint.textContent = selected.description;
          }
        });
      }
    }, 100);
  }

  /* ------------------------------------------------------------------
     Save new rule from modal
  ------------------------------------------------------------------ */
  function saveNewRule() {
    const nameEl = document.getElementById('alert-rule-name');
    const typeEl = document.getElementById('alert-rule-type');
    const thresholdEl = document.getElementById('alert-rule-threshold');
    const activeEl = document.getElementById('alert-rule-active');

    const name = (nameEl ? nameEl.value : '').trim();
    const type = typeEl ? typeEl.value : '';
    const threshold = thresholdEl ? parseInt(thresholdEl.value, 10) : 0;
    const active = activeEl ? activeEl.checked : true;

    if (!name) {
      Components.toast('Please enter a rule name', 'warning');
      return;
    }
    if (!threshold || threshold < 1) {
      Components.toast('Please enter a valid threshold', 'warning');
      return;
    }

    const rules = loadRules();
    rules.push({
      id: generateId(),
      name,
      type,
      threshold,
      active,
      created_at: new Date().toISOString(),
    });
    saveRules(rules);

    Components.closeModal();
    Components.toast('Alert rule created', 'success');

    // Re-render
    const container = document.getElementById('main-content');
    if (container) render(container);
  }

  /* ------------------------------------------------------------------
     Toggle rule active state
  ------------------------------------------------------------------ */
  function toggleRule(ruleId) {
    const rules = loadRules();
    const rule = rules.find(r => r.id === ruleId);
    if (rule) {
      rule.active = !rule.active;
      saveRules(rules);

      // Re-render the rules section only
      const rulesContainer = document.getElementById('alerts-rules-list');
      if (rulesContainer) {
        rulesContainer.innerHTML = renderRulesList(rules);
      }

      Components.toast(
        rule.active ? `"${rule.name}" activated` : `"${rule.name}" paused`,
        'info'
      );
    }
  }

  /* ------------------------------------------------------------------
     Delete rule
  ------------------------------------------------------------------ */
  function deleteRule(ruleId) {
    const rules = loadRules();
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;

    const filtered = rules.filter(r => r.id !== ruleId);
    saveRules(filtered);

    Components.toast(`"${rule.name}" deleted`, 'info');

    // Re-render rules
    const rulesContainer = document.getElementById('alerts-rules-list');
    if (rulesContainer) {
      rulesContainer.innerHTML = renderRulesList(filtered);
    }
  }

  /* ------------------------------------------------------------------
     Acknowledge alert
  ------------------------------------------------------------------ */
  function acknowledgeAlert(alertId) {
    const log = loadLog();
    const entry = log.find(l => l.id === alertId);
    if (entry) {
      entry.status = 'acknowledged';
      saveLog(log);

      // Re-render log
      const logContainer = document.getElementById('alerts-log-container');
      if (logContainer) {
        logContainer.innerHTML = renderAlertLog(log);
      }
    }
  }

  /* ------------------------------------------------------------------
     Clear all alerts
  ------------------------------------------------------------------ */
  function clearLog() {
    saveLog([]);
    const logContainer = document.getElementById('alerts-log-container');
    if (logContainer) {
      logContainer.innerHTML = renderAlertLog([]);
    }
    Components.toast('Alert log cleared', 'info');
  }

  /* ------------------------------------------------------------------
     Main render
  ------------------------------------------------------------------ */
  async function render(container) {
    const rules = loadRules();

    // Save default rules if first time
    if (!localStorage.getItem(STORAGE_KEY_RULES)) {
      saveRules(rules);
    }

    // Check conditions and get updated log
    const log = await checkAlertConditions(rules);

    // Count new alerts
    const newCount = log.filter(l => l.status === 'new').length;
    const newBadge = newCount > 0
      ? `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/20">${newCount} new</span>`
      : '';

    container.innerHTML = `
      <div class="max-w-5xl">
        <!-- Header -->
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="text-lg font-semibold text-white">Alerts & Monitoring</h2>
            <p class="text-sm text-slate-400 mt-0.5">Configure alert rules and monitor triggered conditions</p>
          </div>
          <button onclick="AlertsPage.showCreateModal()"
                  class="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
            </svg>
            Create Rule
          </button>
        </div>

        <!-- Alert Rules Section -->
        <div class="mb-8">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-slate-300 uppercase tracking-wider">Alert Rules</h3>
            <span class="text-xs text-slate-500">${rules.length} rule${rules.length !== 1 ? 's' : ''} configured</span>
          </div>
          <div id="alerts-rules-list" class="space-y-3">
            ${renderRulesList(rules)}
          </div>
        </div>

        <!-- Alert Log Section -->
        <div>
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-semibold text-slate-300 uppercase tracking-wider">Alert Log</h3>
              ${newBadge}
            </div>
            ${log.length > 0 ? `
              <button onclick="AlertsPage.clearLog()"
                      class="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                Clear all
              </button>
            ` : ''}
          </div>
          <div id="alerts-log-container">
            ${renderAlertLog(log)}
          </div>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------
     Public API
  ------------------------------------------------------------------ */
  return {
    render,
    showCreateModal,
    saveNewRule,
    toggleRule,
    deleteRule,
    acknowledgeAlert,
    clearLog,
  };

})();
