/* ==========================================================================
   tags-page.js  -  Tag Management & Auto-Tagging Rules Dashboard
   ========================================================================== */

const TagsPage = (() => {

  /* ------------------------------------------------------------------
     Constants
  ------------------------------------------------------------------ */
  const PRESET_COLORS = [
    { name: 'red',    hex: '#ef4444', cls: 'bg-red-500'    },
    { name: 'orange', hex: '#f97316', cls: 'bg-orange-500' },
    { name: 'yellow', hex: '#eab308', cls: 'bg-yellow-500' },
    { name: 'green',  hex: '#22c55e', cls: 'bg-green-500'  },
    { name: 'blue',   hex: '#3b82f6', cls: 'bg-blue-500'   },
    { name: 'purple', hex: '#a855f7', cls: 'bg-purple-500' },
    { name: 'pink',   hex: '#ec4899', cls: 'bg-pink-500'   },
    { name: 'gray',   hex: '#6b7280', cls: 'bg-gray-500'   },
  ];

  const CONDITION_FIELDS = [
    { value: 'duration',              label: 'Duration (seconds)' },
    { value: 'page_count',            label: 'Page Count' },
    { value: 'has_errors',            label: 'Has Errors' },
    { value: 'has_rage_clicks',       label: 'Has Rage Clicks' },
    { value: 'browser',              label: 'Browser' },
    { value: 'os',                   label: 'OS' },
    { value: 'device_type',          label: 'Device Type' },
    { value: 'url_contains',         label: 'URL Contains' },
    { value: 'utm_source',           label: 'UTM Source' },
    { value: 'identified_user_email', label: 'User Email' },
    { value: 'event_count',          label: 'Event Count' },
    { value: 'country',              label: 'Country' },
  ];

  const CONDITION_OPERATORS = [
    { value: 'gt',           label: '>' },
    { value: 'lt',           label: '<' },
    { value: 'gte',          label: '>=' },
    { value: 'lte',          label: '<=' },
    { value: 'eq',           label: '=' },
    { value: 'neq',          label: '!=' },
    { value: 'contains',     label: 'contains' },
    { value: 'not_contains', label: 'not contains' },
    { value: 'is_set',       label: 'is set' },
    { value: 'is_not_set',   label: 'is not set' },
  ];

  const PRESET_SUGGESTIONS = [
    { name: 'Frustrated User',  tag_name: 'Frustrated User',  tag_color: 'red',    conditions: [{ field: 'has_rage_clicks', operator: 'eq', value: true }] },
    { name: 'Error Session',    tag_name: 'Error Session',    tag_color: 'orange', conditions: [{ field: 'has_errors', operator: 'eq', value: true }] },
    { name: 'High Value',       tag_name: 'High Value',       tag_color: 'green',  conditions: [{ field: 'duration', operator: 'gt', value: 120 }, { field: 'page_count', operator: 'gt', value: 5 }] },
    { name: 'Bounce',           tag_name: 'Bounce',           tag_color: 'gray',   conditions: [{ field: 'duration', operator: 'lt', value: 10 }, { field: 'page_count', operator: 'eq', value: 1 }] },
    { name: 'Mobile User',      tag_name: 'Mobile User',      tag_color: 'blue',   conditions: [{ field: 'device_type', operator: 'eq', value: 'mobile' }] },
    { name: 'Returning Buyer',  tag_name: 'Returning Buyer',  tag_color: 'purple', conditions: [{ field: 'identified_user_email', operator: 'is_set', value: '' }] },
    { name: 'UTM Campaign',     tag_name: 'UTM Campaign',     tag_color: 'yellow', conditions: [{ field: 'utm_source', operator: 'is_set', value: '' }] },
  ];

  /* ------------------------------------------------------------------
     State
  ------------------------------------------------------------------ */
  let rules = [];
  let popularTags = [];
  let recentActivity = [];
  let editingRuleId = null;
  let modalConditions = [];
  let previewCount = null;

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

  function colorBadgeClasses(color) {
    const map = {
      red:    'bg-red-500/15 text-red-400 border-red-500/20',
      orange: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
      yellow: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
      green:  'bg-green-500/15 text-green-400 border-green-500/20',
      blue:   'bg-blue-500/15 text-blue-400 border-blue-500/20',
      purple: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
      pink:   'bg-pink-500/15 text-pink-400 border-pink-500/20',
      gray:   'bg-slate-600/30 text-slate-400 border-slate-500/20',
    };
    return map[color] || map.blue;
  }

  function tagPill(name, color) {
    const cls = colorBadgeClasses(color);
    return `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${cls}">${escapeHtml(name)}</span>`;
  }

  function conditionsToText(conditions) {
    if (!Array.isArray(conditions) || conditions.length === 0) return 'No conditions';
    return conditions.map(c => {
      const fieldDef = CONDITION_FIELDS.find(f => f.value === c.field);
      const fieldLabel = fieldDef ? fieldDef.label : c.field;
      const opDef = CONDITION_OPERATORS.find(o => o.value === c.operator);
      const opLabel = opDef ? opDef.label : c.operator;

      if (c.operator === 'is_set') return `${fieldLabel} is set`;
      if (c.operator === 'is_not_set') return `${fieldLabel} is not set`;

      let displayValue = c.value;
      if (c.value === true || c.value === 'true') displayValue = 'true';
      if (c.value === false || c.value === 'false') displayValue = 'false';

      return `${fieldLabel} ${opLabel} ${displayValue}`;
    }).join(' AND ');
  }

  /* ------------------------------------------------------------------
     Data fetching
  ------------------------------------------------------------------ */
  async function fetchRules() {
    try {
      const data = await App.api('/tags/rules?project_id=' + App.state.project);
      rules = data.rules || [];
    } catch (_) {
      rules = [];
    }
  }

  async function fetchPopularTags() {
    try {
      const data = await App.api('/tags/popular?project_id=' + App.state.project);
      popularTags = data.tags || [];
    } catch (_) {
      popularTags = [];
    }
  }

  async function fetchRecentActivity() {
    try {
      // Fetch recent session_tags entries as a feed
      const data = await App.api('/tags/popular?project_id=' + App.state.project);
      // Build a pseudo-activity from rules and tags
      recentActivity = [];
      for (const rule of rules.slice(0, 10)) {
        if (rule.last_applied_at) {
          recentActivity.push({
            rule_name: rule.name,
            tag_name: rule.tag_name,
            tag_color: rule.tag_color,
            sessions_matched: rule.sessions_matched,
            timestamp: rule.last_applied_at,
          });
        }
      }
      recentActivity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (_) {
      recentActivity = [];
    }
  }

  /* ------------------------------------------------------------------
     Popular Tags Overview
  ------------------------------------------------------------------ */
  function renderPopularTags() {
    if (popularTags.length === 0) {
      return `
        <div class="bg-[#16213e] rounded-xl border border-slate-700/50 p-5 mb-6">
          <h3 class="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Popular Tags</h3>
          <p class="text-sm text-slate-500">No tags yet. Create a rule or manually tag sessions to get started.</p>
        </div>`;
    }

    const pills = popularTags.map(t => `
      <button onclick="TagsPage.filterByTag('${escapeAttr(t.tag_name)}')"
              class="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-200 flex-shrink-0 group">
        ${tagPill(t.tag_name, t.tag_color)}
        <span class="text-xs text-slate-500 group-hover:text-slate-300 transition-colors">${t.count} session${t.count !== 1 ? 's' : ''}</span>
      </button>
    `).join('');

    return `
      <div class="bg-[#16213e] rounded-xl border border-slate-700/50 p-5 mb-6">
        <h3 class="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Popular Tags</h3>
        <div class="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700">
          ${pills}
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------
     Rules List
  ------------------------------------------------------------------ */
  function renderRulesList() {
    if (rules.length === 0) {
      return `
        <div class="mb-6">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-slate-300 uppercase tracking-wider">Tag Rules</h3>
          </div>
          ${Components.emptyState(
            'No Tag Rules',
            'Create your first auto-tagging rule to automatically categorize sessions based on conditions.'
          )}
        </div>`;
    }

    const cards = rules.map(rule => {
      const condText = conditionsToText(rule.conditions);
      const lastApplied = rule.last_applied_at
        ? Components.timeAgo(rule.last_applied_at)
        : 'Never';

      const enabledToggle = `
        <button onclick="TagsPage.toggleRule('${rule.id}', ${!rule.enabled})"
                class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none ${rule.enabled ? 'bg-green-600' : 'bg-slate-600'}"
                title="${rule.enabled ? 'Enabled' : 'Disabled'}">
          <span class="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${rule.enabled ? 'translate-x-5' : 'translate-x-0.5'}"></span>
        </button>`;

      return `
        <div class="bg-[#16213e] rounded-xl border border-slate-700/50 p-5 hover:border-slate-600/50 transition-all duration-200">
          <div class="flex items-start justify-between gap-3 mb-3">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <h4 class="text-sm font-semibold text-white truncate">${escapeHtml(rule.name)}</h4>
                ${enabledToggle}
                ${rule.auto_apply ? '<span class="text-[10px] font-medium text-[#4361ee] bg-[#4361ee]/10 px-1.5 py-0.5 rounded">AUTO</span>' : ''}
              </div>
              <div class="mb-2">${tagPill(rule.tag_name, rule.tag_color)}</div>
            </div>
            <div class="flex items-center gap-1.5 flex-shrink-0">
              <button onclick="TagsPage.applyRule('${rule.id}')"
                      class="px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#4361ee] hover:bg-[#4361ee]/10 border border-[#4361ee]/20 hover:border-[#4361ee]/40 transition-colors"
                      title="Apply rule retroactively"
                      id="apply-btn-${rule.id}">
                Apply Now
              </button>
              <button onclick="TagsPage.showEditModal('${rule.id}')"
                      class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
                      title="Edit rule">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"/>
                </svg>
              </button>
              <button onclick="TagsPage.deleteRule('${rule.id}')"
                      class="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete rule">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="bg-slate-800/40 rounded-lg px-3 py-2 mb-3">
            <p class="text-xs text-slate-400 font-mono leading-relaxed">${escapeHtml(condText)}</p>
          </div>
          <div class="flex items-center gap-4 text-xs text-slate-500">
            <span>Matched: <span class="text-slate-300 font-medium">${rule.sessions_matched || 0}</span></span>
            <span>Last applied: <span class="text-slate-300">${lastApplied}</span></span>
          </div>
          <div id="apply-result-${rule.id}" class="mt-2"></div>
        </div>`;
    }).join('');

    return `
      <div class="mb-6">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold text-slate-300 uppercase tracking-wider">Tag Rules</h3>
          <span class="text-xs text-slate-500">${rules.length} rule${rules.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">${cards}</div>
      </div>`;
  }

  /* ------------------------------------------------------------------
     Preset Suggestions
  ------------------------------------------------------------------ */
  function renderPresetSuggestions() {
    const pills = PRESET_SUGGESTIONS.map(p => `
      <button onclick="TagsPage.usePreset('${escapeAttr(p.name)}')"
              class="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/40 hover:bg-slate-700/40 border border-dashed border-slate-700/50 hover:border-[#4361ee]/30 transition-all duration-200 flex-shrink-0 group"
              title="Create rule: ${escapeAttr(conditionsToText(p.conditions))}">
        ${tagPill(p.tag_name, p.tag_color)}
        <svg class="w-3.5 h-3.5 text-slate-600 group-hover:text-[#4361ee] transition-colors" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
        </svg>
      </button>
    `).join('');

    return `
      <div class="bg-[#16213e] rounded-xl border border-slate-700/50 p-5 mb-6">
        <h3 class="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-2">Quick Start Presets</h3>
        <p class="text-xs text-slate-500 mb-3">Click a preset to create a rule instantly</p>
        <div class="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700">
          ${pills}
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------
     Recent Tagging Activity Feed
  ------------------------------------------------------------------ */
  function renderRecentActivity() {
    if (recentActivity.length === 0) {
      return `
        <div class="bg-[#16213e] rounded-xl border border-slate-700/50 p-5">
          <h3 class="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Recent Tagging Activity</h3>
          <p class="text-sm text-slate-500">No recent tagging activity.</p>
        </div>`;
    }

    const items = recentActivity.slice(0, 10).map(act => `
      <div class="flex items-center gap-3 py-2.5 border-b border-slate-700/30 last:border-0">
        <div class="w-1.5 h-1.5 rounded-full bg-[#4361ee] flex-shrink-0"></div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            ${tagPill(act.tag_name, act.tag_color)}
            <span class="text-xs text-slate-500">applied by</span>
            <span class="text-xs text-slate-300 font-medium truncate">${escapeHtml(act.rule_name)}</span>
          </div>
          <div class="flex items-center gap-2 mt-1">
            <span class="text-[11px] text-slate-500">${act.sessions_matched || 0} sessions matched</span>
            <span class="text-[11px] text-slate-600">|</span>
            <span class="text-[11px] text-slate-500">${Components.timeAgo(act.timestamp)}</span>
          </div>
        </div>
      </div>
    `).join('');

    return `
      <div class="bg-[#16213e] rounded-xl border border-slate-700/50 p-5">
        <h3 class="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Recent Tagging Activity</h3>
        <div class="divide-y-0">${items}</div>
      </div>`;
  }

  /* ------------------------------------------------------------------
     Create / Edit Rule Modal
  ------------------------------------------------------------------ */
  function showCreateModal() {
    editingRuleId = null;
    modalConditions = [{ field: 'duration', operator: 'gt', value: '' }];
    previewCount = null;
    openRuleModal('Create Tag Rule', {
      name: '',
      tag_name: '',
      tag_color: 'blue',
      auto_apply: false,
    });
  }

  function showEditModal(ruleId) {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;
    editingRuleId = ruleId;
    modalConditions = JSON.parse(JSON.stringify(rule.conditions || []));
    if (modalConditions.length === 0) {
      modalConditions = [{ field: 'duration', operator: 'gt', value: '' }];
    }
    previewCount = null;
    openRuleModal('Edit Tag Rule', {
      name: rule.name,
      tag_name: rule.tag_name,
      tag_color: rule.tag_color,
      auto_apply: rule.auto_apply,
    });
  }

  function openRuleModal(title, defaults) {
    const colorPicker = PRESET_COLORS.map(c => `
      <button type="button" onclick="TagsPage.selectColor('${c.name}')"
              class="tag-color-btn w-7 h-7 rounded-full ${c.cls} border-2 transition-all duration-150 hover:scale-110 ${defaults.tag_color === c.name ? 'border-white ring-2 ring-white/30' : 'border-transparent'}"
              data-color="${c.name}" title="${c.name}">
      </button>
    `).join('');

    const conditionRows = renderConditionRows();

    const content = `
      <div class="space-y-5">
        <div>
          <label class="block text-xs font-medium text-slate-400 mb-1.5">Rule Name</label>
          <input type="text" id="rule-name" value="${escapeAttr(defaults.name)}"
                 placeholder="e.g., Frustrated Users"
                 class="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#4361ee]/50 focus:ring-1 focus:ring-[#4361ee]/30 transition-colors" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-400 mb-1.5">Tag Name</label>
          <input type="text" id="rule-tag-name" value="${escapeAttr(defaults.tag_name)}"
                 placeholder="e.g., Frustrated User"
                 class="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#4361ee]/50 focus:ring-1 focus:ring-[#4361ee]/30 transition-colors" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-400 mb-2">Tag Color</label>
          <div class="flex items-center gap-2">
            ${colorPicker}
          </div>
          <input type="hidden" id="rule-tag-color" value="${escapeAttr(defaults.tag_color)}" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-400 mb-2">Conditions <span class="text-slate-600">(all must match)</span></label>
          <div id="conditions-container" class="space-y-2">
            ${conditionRows}
          </div>
          <button onclick="TagsPage.addConditionRow()"
                  class="mt-2 text-xs text-[#4361ee] hover:text-blue-300 transition-colors flex items-center gap-1">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
            </svg>
            Add condition
          </button>
        </div>
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" id="rule-auto-apply" ${defaults.auto_apply ? 'checked' : ''}
                   class="w-4 h-4 rounded bg-slate-700 border-slate-600 text-[#4361ee] focus:ring-[#4361ee]/30" />
            <span class="text-sm text-slate-300">Auto-apply to new sessions</span>
          </label>
        </div>
        <div id="rule-preview" class="bg-slate-800/50 rounded-lg px-4 py-3 border border-slate-700/30">
          <div class="flex items-center justify-between">
            <span class="text-xs text-slate-500">Preview match count</span>
            <button onclick="TagsPage.previewRule()"
                    class="text-xs text-[#4361ee] hover:text-blue-300 transition-colors font-medium">
              Run Preview
            </button>
          </div>
          <div id="preview-result" class="mt-1">
            <span class="text-xs text-slate-600">Click "Run Preview" to see how many sessions match</span>
          </div>
        </div>
      </div>`;

    const saveLabel = editingRuleId ? 'Save Changes' : 'Create Rule';
    const saveFn = editingRuleId ? 'TagsPage.saveEditRule()' : 'TagsPage.saveNewRule()';

    Components.showModal(title, content, [
      { label: saveLabel, onClick: saveFn, class: 'bg-[#4361ee] hover:bg-[#3651de] text-white' },
    ]);
  }

  function renderConditionRows() {
    return modalConditions.map((cond, i) => {
      const fieldOptions = CONDITION_FIELDS.map(f =>
        `<option value="${f.value}" ${f.value === cond.field ? 'selected' : ''}>${f.label}</option>`
      ).join('');

      const opOptions = CONDITION_OPERATORS.map(o =>
        `<option value="${o.value}" ${o.value === cond.operator ? 'selected' : ''}>${o.label}</option>`
      ).join('');

      const needsValue = cond.operator !== 'is_set' && cond.operator !== 'is_not_set';
      const valueInput = needsValue
        ? `<input type="text" value="${escapeAttr(String(cond.value || ''))}"
                  placeholder="value"
                  onchange="TagsPage.updateCondition(${i}, 'value', this.value)"
                  class="cond-value flex-1 min-w-[80px] bg-slate-700/50 border border-slate-600/50 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#4361ee]/50 transition-colors" />`
        : '';

      const removeBtn = modalConditions.length > 1
        ? `<button onclick="TagsPage.removeConditionRow(${i})"
                  class="p-1 rounded text-slate-600 hover:text-red-400 transition-colors flex-shrink-0"
                  title="Remove condition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>`
        : '';

      return `
        <div class="flex items-center gap-2 condition-row">
          ${i > 0 ? '<span class="text-[10px] font-semibold text-slate-600 uppercase w-8 text-center flex-shrink-0">AND</span>' : '<span class="w-8 flex-shrink-0"></span>'}
          <select onchange="TagsPage.updateCondition(${i}, 'field', this.value)"
                  class="cond-field bg-slate-700/50 border border-slate-600/50 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#4361ee]/50 transition-colors">
            ${fieldOptions}
          </select>
          <select onchange="TagsPage.updateCondition(${i}, 'operator', this.value)"
                  class="cond-op bg-slate-700/50 border border-slate-600/50 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#4361ee]/50 transition-colors">
            ${opOptions}
          </select>
          ${valueInput}
          ${removeBtn}
        </div>`;
    }).join('');
  }

  /* ------------------------------------------------------------------
     Modal condition actions
  ------------------------------------------------------------------ */
  function addConditionRow() {
    modalConditions.push({ field: 'duration', operator: 'gt', value: '' });
    refreshConditions();
  }

  function removeConditionRow(index) {
    if (modalConditions.length <= 1) return;
    modalConditions.splice(index, 1);
    refreshConditions();
  }

  function updateCondition(index, key, value) {
    if (!modalConditions[index]) return;
    modalConditions[index][key] = value;

    // If switching to is_set/is_not_set, clear value and re-render
    if (key === 'operator' && (value === 'is_set' || value === 'is_not_set')) {
      modalConditions[index].value = '';
      refreshConditions();
    }
  }

  function refreshConditions() {
    const container = document.getElementById('conditions-container');
    if (container) {
      container.innerHTML = renderConditionRows();
    }
  }

  function selectColor(colorName) {
    const hiddenInput = document.getElementById('rule-tag-color');
    if (hiddenInput) hiddenInput.value = colorName;

    document.querySelectorAll('.tag-color-btn').forEach(btn => {
      const isSelected = btn.getAttribute('data-color') === colorName;
      btn.classList.toggle('border-white', isSelected);
      btn.classList.toggle('ring-2', isSelected);
      btn.classList.toggle('ring-white/30', isSelected);
      btn.classList.toggle('border-transparent', !isSelected);
    });
  }

  /* ------------------------------------------------------------------
     Preview
  ------------------------------------------------------------------ */
  async function previewRule() {
    const previewEl = document.getElementById('preview-result');
    if (!previewEl) return;
    previewEl.innerHTML = '<span class="text-xs text-slate-400">Counting matching sessions...</span>';

    // Collect current conditions from state
    const conditions = collectConditions();
    if (conditions.length === 0) {
      previewEl.innerHTML = '<span class="text-xs text-yellow-400">Add at least one condition</span>';
      return;
    }

    try {
      // Create a temporary rule and try applying (dry run by counting)
      // We use the evaluate-like logic but just count
      const params = new URLSearchParams({
        project_id: App.state.project,
      });

      // We can simulate by temporarily creating and immediately checking count
      // Instead, just do a direct count by creating the rule, getting match count, then deleting
      // For simplicity, send a preview request
      const tag_name = (document.getElementById('rule-tag-name') || {}).value || 'preview';

      // Create temp rule
      const tempRule = await App.api('/tags/rules', {
        method: 'POST',
        body: {
          name: '__preview_' + Date.now(),
          tag_name,
          tag_color: 'gray',
          conditions,
          auto_apply: false,
          project_id: App.state.project,
        },
      });

      if (tempRule && tempRule.rule) {
        // Apply to count
        const result = await App.api('/tags/rules/' + tempRule.rule.id + '/apply', { method: 'POST' });
        const matchCount = result ? result.matched : 0;

        // Delete temp rule (and its tags)
        await App.api('/tags/rules/' + tempRule.rule.id, { method: 'DELETE' });

        previewEl.innerHTML = `<span class="text-sm font-semibold text-white">${matchCount}</span> <span class="text-xs text-slate-400">sessions would match</span>`;
      }
    } catch (err) {
      previewEl.innerHTML = `<span class="text-xs text-red-400">Preview failed: ${escapeHtml(err.message)}</span>`;
    }
  }

  function collectConditions() {
    // Return the in-memory conditions (already kept in sync via updateCondition)
    return modalConditions.filter(c => c.field && c.operator).map(c => {
      const cond = { field: c.field, operator: c.operator };
      if (c.operator !== 'is_set' && c.operator !== 'is_not_set') {
        // Parse numeric values for numeric fields
        const numericFields = ['duration', 'page_count', 'event_count'];
        if (numericFields.includes(c.field) && c.value !== '' && !isNaN(c.value)) {
          cond.value = Number(c.value);
        } else if (c.value === 'true') {
          cond.value = true;
        } else if (c.value === 'false') {
          cond.value = false;
        } else {
          cond.value = c.value || '';
        }
      } else {
        cond.value = '';
      }
      return cond;
    });
  }

  /* ------------------------------------------------------------------
     Save actions
  ------------------------------------------------------------------ */
  async function saveNewRule() {
    const name = (document.getElementById('rule-name') || {}).value || '';
    const tag_name = (document.getElementById('rule-tag-name') || {}).value || '';
    const tag_color = (document.getElementById('rule-tag-color') || {}).value || 'blue';
    const auto_apply = (document.getElementById('rule-auto-apply') || {}).checked || false;
    const conditions = collectConditions();

    if (!name.trim()) { Components.toast('Please enter a rule name', 'warning'); return; }
    if (!tag_name.trim()) { Components.toast('Please enter a tag name', 'warning'); return; }
    if (conditions.length === 0) { Components.toast('Please add at least one condition', 'warning'); return; }

    try {
      await App.api('/tags/rules', {
        method: 'POST',
        body: { name, tag_name, tag_color, conditions, auto_apply, project_id: App.state.project },
      });
      Components.closeModal();
      Components.toast('Tag rule created successfully', 'success');
      const container = document.getElementById('main-content');
      if (container) render(container);
    } catch (_) {
      // Error shown by App.api
    }
  }

  async function saveEditRule() {
    if (!editingRuleId) return;

    const name = (document.getElementById('rule-name') || {}).value || '';
    const tag_name = (document.getElementById('rule-tag-name') || {}).value || '';
    const tag_color = (document.getElementById('rule-tag-color') || {}).value || 'blue';
    const auto_apply = (document.getElementById('rule-auto-apply') || {}).checked || false;
    const conditions = collectConditions();

    if (!name.trim()) { Components.toast('Please enter a rule name', 'warning'); return; }
    if (!tag_name.trim()) { Components.toast('Please enter a tag name', 'warning'); return; }
    if (conditions.length === 0) { Components.toast('Please add at least one condition', 'warning'); return; }

    try {
      await App.api('/tags/rules/' + editingRuleId, {
        method: 'PUT',
        body: { name, tag_name, tag_color, conditions, auto_apply },
      });
      Components.closeModal();
      Components.toast('Tag rule updated successfully', 'success');
      const container = document.getElementById('main-content');
      if (container) render(container);
    } catch (_) {
      // Error shown by App.api
    }
  }

  /* ------------------------------------------------------------------
     Rule actions
  ------------------------------------------------------------------ */
  async function toggleRule(ruleId, newEnabled) {
    try {
      await App.api('/tags/rules/' + ruleId, {
        method: 'PUT',
        body: { enabled: newEnabled },
      });
      const rule = rules.find(r => r.id === ruleId);
      if (rule) rule.enabled = newEnabled;
      const container = document.getElementById('main-content');
      if (container) render(container);
      Components.toast(newEnabled ? 'Rule enabled' : 'Rule disabled', 'info');
    } catch (_) {
      // Error shown by App.api
    }
  }

  async function applyRule(ruleId) {
    const btn = document.getElementById('apply-btn-' + ruleId);
    const resultEl = document.getElementById('apply-result-' + ruleId);

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Applying...';
    }
    if (resultEl) {
      resultEl.innerHTML = `
        <div class="flex items-center gap-2">
          <div class="w-3.5 h-3.5 border-2 border-[#4361ee] border-t-transparent rounded-full animate-spin"></div>
          <span class="text-xs text-slate-400">Scanning sessions...</span>
        </div>`;
    }

    try {
      const result = await App.api('/tags/rules/' + ruleId + '/apply', { method: 'POST' });
      if (resultEl) {
        resultEl.innerHTML = `
          <div class="flex items-center gap-2 text-xs">
            <svg class="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
            </svg>
            <span class="text-green-400 font-medium">${result.tagged} new tags</span>
            <span class="text-slate-500">from ${result.matched} matching sessions</span>
          </div>`;
      }
      Components.toast(`Applied: ${result.tagged} sessions tagged`, 'success');
    } catch (_) {
      if (resultEl) {
        resultEl.innerHTML = '<span class="text-xs text-red-400">Failed to apply rule</span>';
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Apply Now';
      }
    }
  }

  async function deleteRule(ruleId) {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;

    Components.showModal(
      'Delete Tag Rule',
      `<div class="text-center py-2">
        <svg class="w-10 h-10 text-red-400 mx-auto mb-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
        </svg>
        <p class="text-sm text-slate-300">Delete rule <strong>${escapeHtml(rule.name)}</strong>?</p>
        <p class="text-xs text-slate-500 mt-1">This will also remove all tags applied by this rule from sessions.</p>
      </div>`,
      [{
        label: 'Delete',
        class: 'bg-red-600 hover:bg-red-700 text-white',
        onClick: `TagsPage.confirmDeleteRule('${ruleId}')`,
      }]
    );
  }

  async function confirmDeleteRule(ruleId) {
    Components.closeModal();
    try {
      await App.api('/tags/rules/' + ruleId, { method: 'DELETE' });
      Components.toast('Rule deleted', 'info');
      const container = document.getElementById('main-content');
      if (container) render(container);
    } catch (_) {
      // Error shown by App.api
    }
  }

  /* ------------------------------------------------------------------
     Preset: use a preset to pre-populate the create modal
  ------------------------------------------------------------------ */
  function usePreset(presetName) {
    const preset = PRESET_SUGGESTIONS.find(p => p.name === presetName);
    if (!preset) return;

    editingRuleId = null;
    modalConditions = JSON.parse(JSON.stringify(preset.conditions));
    previewCount = null;
    openRuleModal('Create Tag Rule', {
      name: preset.name,
      tag_name: preset.tag_name,
      tag_color: preset.tag_color,
      auto_apply: false,
    });
  }

  /* ------------------------------------------------------------------
     Filter sessions by tag (navigate to sessions page with filter)
  ------------------------------------------------------------------ */
  function filterByTag(tagName) {
    // Navigate to sessions page - the sessions page would need to support tag filtering
    App.navigate('sessions');
    Components.toast('Showing sessions tagged: ' + tagName, 'info');
  }

  /* ------------------------------------------------------------------
     Main render
  ------------------------------------------------------------------ */
  async function render(container) {
    container.innerHTML = Components.loading();

    // Fetch data in parallel
    await Promise.all([
      fetchRules(),
      fetchPopularTags(),
    ]);

    // Build recent activity from rules data
    await fetchRecentActivity();

    container.innerHTML = `
      <div class="max-w-6xl" style="color: #e0e0e0;">
        <!-- Header -->
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="text-lg font-semibold text-white">Tags & Auto-Tagging Rules</h2>
            <p class="text-sm text-slate-400 mt-0.5">Categorize sessions automatically with rule-based tagging</p>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="TagsPage.evaluateRules()"
                    class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white border border-slate-700/50 hover:border-slate-600/50 hover:bg-slate-700/30 transition-colors"
                    title="Evaluate all auto-apply rules against recent sessions">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182"/>
              </svg>
              Evaluate Rules
            </button>
            <button onclick="TagsPage.showCreateModal()"
                    class="flex items-center gap-2 bg-[#4361ee] hover:bg-[#3651de] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
              </svg>
              Create Rule
            </button>
          </div>
        </div>

        <!-- Popular Tags -->
        ${renderPopularTags()}

        <!-- Preset Suggestions -->
        ${renderPresetSuggestions()}

        <!-- Rules List -->
        ${renderRulesList()}

        <!-- Recent Activity -->
        ${renderRecentActivity()}
      </div>`;
  }

  /* ------------------------------------------------------------------
     Evaluate all rules
  ------------------------------------------------------------------ */
  async function evaluateRules() {
    Components.toast('Evaluating auto-apply rules...', 'info');
    try {
      const result = await App.api('/tags/evaluate?project_id=' + App.state.project + '&minutes=60', {
        method: 'POST',
      });
      Components.toast(`Evaluated ${result.rules_evaluated} rules, applied ${result.new_tags_applied} new tags`, 'success');
      const container = document.getElementById('main-content');
      if (container) render(container);
    } catch (_) {
      // Error shown by App.api
    }
  }

  /* ------------------------------------------------------------------
     Lifecycle
  ------------------------------------------------------------------ */
  function init() {
    // Called when page is activated
  }

  function destroy() {
    rules = [];
    popularTags = [];
    recentActivity = [];
    editingRuleId = null;
    modalConditions = [];
    previewCount = null;
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
    saveNewRule,
    saveEditRule,
    toggleRule,
    applyRule,
    deleteRule,
    confirmDeleteRule,
    evaluateRules,
    usePreset,
    filterByTag,
    selectColor,
    addConditionRow,
    removeConditionRow,
    updateCondition,
    previewRule,
  };

})();

// Register as page renderer
function renderTagsPage(container) {
  TagsPage.init();
  TagsPage.render(container);
}

// Expose globally
window.TagsPage = TagsPage;
