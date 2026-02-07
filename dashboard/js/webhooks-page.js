/* ==========================================================================
   webhooks-page.js  -  Webhook & Slack Notification Management
   ========================================================================== */

const WebhooksPage = (() => {

  /* ------------------------------------------------------------------
     Constants
  ------------------------------------------------------------------ */
  const EVENT_TYPES = [
    { value: 'rage_click',       label: 'Rage Click',       color: 'red' },
    { value: 'js_error',         label: 'JS Error',         color: 'red' },
    { value: 'cart_abandonment', label: 'Cart Abandonment', color: 'yellow' },
    { value: 'high_bounce',      label: 'High Bounce',      color: 'yellow' },
    { value: 'slow_page',        label: 'Slow Page',        color: 'yellow' },
    { value: 'new_session',      label: 'New Session',      color: 'blue' },
    { value: 'form_abandon',     label: 'Form Abandon',     color: 'purple' },
  ];

  /* ------------------------------------------------------------------
     State
  ------------------------------------------------------------------ */
  let webhooks = [];
  let expandedLogId = null;
  let expandedLogs = [];

  /* ------------------------------------------------------------------
     Helpers
  ------------------------------------------------------------------ */
  function maskUrl(url) {
    try {
      const u = new URL(url);
      const host = u.hostname;
      const path = u.pathname;
      if (path.length > 20) {
        return host + path.slice(0, 20) + '...';
      }
      return host + path;
    } catch (_) {
      if (url && url.length > 40) return url.slice(0, 40) + '...';
      return url || '';
    }
  }

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

  function eventBadge(eventType) {
    const et = EVENT_TYPES.find(e => e.value === eventType);
    if (!et) return Components.badge(eventType, 'slate');
    return Components.badge(et.label, et.color);
  }

  /* ------------------------------------------------------------------
     Data fetching
  ------------------------------------------------------------------ */
  async function fetchWebhooks() {
    try {
      const data = await App.api('/webhooks/list?project_id=' + App.state.project);
      webhooks = data.webhooks || [];
    } catch (_) {
      webhooks = [];
    }
  }

  async function fetchSlackConfig() {
    try {
      const data = await App.api('/webhooks/slack/config?project_id=' + App.state.project);
      return data;
    } catch (_) {
      return { configured: false, webhook: null };
    }
  }

  async function fetchWebhookLogs(webhookId) {
    try {
      const data = await App.api('/webhooks/logs/' + webhookId + '?limit=20');
      return data.logs || [];
    } catch (_) {
      return [];
    }
  }

  /* ------------------------------------------------------------------
     Slack quick setup card
  ------------------------------------------------------------------ */
  function renderSlackCard(slackConfig) {
    const isConfigured = slackConfig && slackConfig.configured;
    const wh = slackConfig ? slackConfig.webhook : null;

    const eventCheckboxes = EVENT_TYPES.map(et => {
      const checked = isConfigured && wh && wh.event_types && wh.event_types.includes(et.value) ? 'checked' : '';
      return `
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" class="slack-event-cb w-4 h-4 rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500/30"
                 value="${et.value}" ${checked} />
          <span class="text-sm text-slate-300">${et.label}</span>
        </label>`;
    }).join('');

    const statusBadge = isConfigured
      ? '<span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-green-500/15 text-green-400 border border-green-500/20">Connected</span>'
      : '<span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-600/30 text-slate-400 border border-slate-500/20">Not configured</span>';

    return `
      <div class="bg-gradient-to-r from-slate-800 to-slate-800/80 rounded-xl border border-slate-700/50 p-6 mb-6">
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-[#4A154B]/20 border border-[#4A154B]/30 flex items-center justify-center flex-shrink-0">
              <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none">
                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" fill="#E01E5A"/>
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-semibold text-white flex items-center gap-2">
                Slack Integration
                ${statusBadge}
              </h3>
              <p class="text-xs text-slate-400 mt-0.5">Receive real-time session alerts directly in your Slack channel</p>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1.5">Slack Webhook URL</label>
              <input type="text" id="slack-webhook-url"
                     placeholder="https://hooks.slack.com/services/T00/B00/xxx"
                     class="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-colors" />
              <p class="text-xs text-slate-500 mt-1">Create one at <span class="text-blue-400">api.slack.com/apps</span> > Incoming Webhooks</p>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1.5">Channel Name</label>
              <input type="text" id="slack-channel" value="${isConfigured && wh ? escapeAttr(wh.channel) : '#alerts'}"
                     placeholder="#alerts"
                     class="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-colors" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-400 mb-1.5">Events to Notify</label>
            <div class="grid grid-cols-2 gap-2">
              ${eventCheckboxes}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3 mt-4">
          <button onclick="WebhooksPage.saveSlack()"
                  class="bg-[#4A154B] hover:bg-[#5B2C5E] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
            </svg>
            ${isConfigured ? 'Update Slack' : 'Connect Slack'}
          </button>
          ${isConfigured ? `
            <span class="text-xs text-slate-500">Last updated: ${wh && wh.updated_at ? Components.timeAgo(wh.updated_at) : 'N/A'}</span>
          ` : ''}
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------
     Webhook list table
  ------------------------------------------------------------------ */
  function renderWebhookList() {
    if (webhooks.length === 0) {
      return Components.emptyState(
        'No Webhooks Configured',
        'Create your first webhook to start receiving real-time event notifications via HTTP POST.'
      );
    }

    const rows = webhooks.map(wh => {
      const isSlack = wh.url && wh.url.includes('hooks.slack.com');
      const nameIcon = isSlack
        ? '<span class="text-[#E01E5A] mr-1.5" title="Slack webhook">S</span>'
        : '<span class="text-blue-400 mr-1.5" title="HTTP webhook">W</span>';

      const eventTags = (wh.event_types || []).map(et => eventBadge(et)).join(' ');

      const statusToggle = `
        <button onclick="WebhooksPage.toggleActive('${wh.id}', ${!wh.active})"
                class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none ${wh.active ? 'bg-green-600' : 'bg-slate-600'}"
                title="${wh.active ? 'Active' : 'Inactive'}">
          <span class="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${wh.active ? 'translate-x-5' : 'translate-x-0.5'}"></span>
        </button>`;

      const successRateHtml = wh.success_rate !== null
        ? `<span class="text-xs font-medium ${wh.success_rate >= 80 ? 'text-green-400' : wh.success_rate >= 50 ? 'text-yellow-400' : 'text-red-400'}">${wh.success_rate}%</span>`
        : '<span class="text-xs text-slate-500">--</span>';

      const lastTriggeredHtml = wh.last_triggered
        ? `<span class="text-xs text-slate-400">${Components.timeAgo(wh.last_triggered)}</span>`
        : '<span class="text-xs text-slate-500">Never</span>';

      const isExpanded = expandedLogId === wh.id;

      return `
        <div class="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden hover:border-slate-600/50 transition-all duration-200">
          <div class="p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  ${nameIcon}
                  <h4 class="text-sm font-semibold text-white truncate">${escapeHtml(wh.name)}</h4>
                  ${statusToggle}
                </div>
                <p class="text-xs text-slate-500 font-mono truncate mb-2" title="${escapeAttr(wh.url)}">${escapeHtml(maskUrl(wh.url))}</p>
                <div class="flex flex-wrap gap-1 mb-2">${eventTags}</div>
                <div class="flex items-center gap-4 text-xs">
                  <span class="text-slate-500">Success: ${successRateHtml}</span>
                  <span class="text-slate-500">Last: ${lastTriggeredHtml}</span>
                  <span class="text-slate-500">Deliveries: <span class="text-slate-300">${wh.delivery_count || 0}</span></span>
                </div>
              </div>
              <div class="flex items-center gap-1.5 flex-shrink-0">
                <button onclick="WebhooksPage.testWebhook('${wh.id}')"
                        class="px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-400 hover:bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/40 transition-colors"
                        title="Send test payload">
                  Test
                </button>
                <button onclick="WebhooksPage.toggleLogs('${wh.id}')"
                        class="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:bg-slate-700/50 border border-slate-600/30 hover:border-slate-500/50 transition-colors"
                        title="View delivery logs">
                  Logs
                </button>
                <button onclick="WebhooksPage.showEditModal('${wh.id}')"
                        class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
                        title="Edit webhook">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"/>
                  </svg>
                </button>
                <button onclick="WebhooksPage.deleteWebhook('${wh.id}')"
                        class="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete webhook">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
          ${isExpanded ? renderLogsSection(wh.id) : ''}
        </div>`;
    }).join('');

    return `<div class="space-y-3">${rows}</div>`;
  }

  /* ------------------------------------------------------------------
     Delivery logs section (expandable)
  ------------------------------------------------------------------ */
  function renderLogsSection(webhookId) {
    if (!expandedLogs || expandedLogs.length === 0) {
      return `
        <div class="border-t border-slate-700/50 px-4 py-6 text-center">
          <p class="text-xs text-slate-500">No delivery logs yet</p>
        </div>`;
    }

    const logRows = expandedLogs.map(log => {
      const statusColor = log.success ? 'text-green-400' : 'text-red-400';
      const statusIcon = log.success
        ? '<svg class="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>'
        : '<svg class="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>';

      const timeStr = new Date(log.created_at).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
      });

      return `
        <tr class="border-t border-slate-700/30">
          <td class="px-3 py-2 text-xs">
            <div class="flex items-center gap-1.5">${statusIcon} <span class="${statusColor} font-medium">${log.response_status || 0}</span></div>
          </td>
          <td class="px-3 py-2 text-xs">${eventBadge(log.event_type)}</td>
          <td class="px-3 py-2 text-xs text-slate-400">${timeStr}</td>
          <td class="px-3 py-2 text-xs text-slate-500 max-w-[200px] truncate">${escapeHtml(log.response_body || '')}</td>
        </tr>`;
    }).join('');

    return `
      <div class="border-t border-slate-700/50">
        <div class="px-4 py-2 bg-slate-900/50">
          <span class="text-xs font-medium text-slate-400">Recent Deliveries</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-slate-900/30">
              <tr>
                <th class="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase">Status</th>
                <th class="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase">Event</th>
                <th class="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase">Time</th>
                <th class="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase">Response</th>
              </tr>
            </thead>
            <tbody>${logRows}</tbody>
          </table>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------
     Add webhook modal
  ------------------------------------------------------------------ */
  function showAddModal() {
    const eventCheckboxes = EVENT_TYPES.map(et => `
      <label class="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" class="wh-event-cb w-4 h-4 rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500/30"
               value="${et.value}" />
        <span class="text-sm text-slate-300">${et.label}</span>
      </label>
    `).join('');

    const content = `
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-slate-400 mb-1.5">Webhook Name</label>
          <input type="text" id="wh-name" placeholder="e.g., Error Alerts Webhook"
                 class="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-400 mb-1.5">Webhook URL</label>
          <input type="text" id="wh-url" placeholder="https://your-server.com/webhook"
                 class="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-400 mb-1.5">Event Types</label>
          <div class="grid grid-cols-2 gap-2">${eventCheckboxes}</div>
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-400 mb-1.5">Custom Headers (optional)</label>
          <div id="wh-headers-container" class="space-y-2">
            <div class="flex gap-2 wh-header-row">
              <input type="text" placeholder="Header name" class="wh-header-key flex-1 bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50" />
              <input type="text" placeholder="Header value" class="wh-header-val flex-1 bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50" />
            </div>
          </div>
          <button onclick="WebhooksPage.addHeaderRow()"
                  class="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors">
            + Add header
          </button>
        </div>
      </div>`;

    Components.showModal('Add Webhook', content, [
      { label: 'Create Webhook', onClick: 'WebhooksPage.saveNewWebhook()', class: 'bg-blue-600 hover:bg-blue-700 text-white' },
    ]);
  }

  /* ------------------------------------------------------------------
     Edit webhook modal
  ------------------------------------------------------------------ */
  function showEditModal(webhookId) {
    const wh = webhooks.find(w => w.id === webhookId);
    if (!wh) return;

    const eventCheckboxes = EVENT_TYPES.map(et => {
      const checked = (wh.event_types || []).includes(et.value) ? 'checked' : '';
      return `
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" class="wh-event-cb w-4 h-4 rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500/30"
                 value="${et.value}" ${checked} />
          <span class="text-sm text-slate-300">${et.label}</span>
        </label>`;
    }).join('');

    const headers = wh.headers || {};
    const headerKeys = Object.keys(headers);
    const headerRows = headerKeys.length > 0
      ? headerKeys.map(k => `
          <div class="flex gap-2 wh-header-row">
            <input type="text" placeholder="Header name" value="${escapeAttr(k)}" class="wh-header-key flex-1 bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50" />
            <input type="text" placeholder="Header value" value="${escapeAttr(headers[k])}" class="wh-header-val flex-1 bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50" />
          </div>`).join('')
      : `<div class="flex gap-2 wh-header-row">
           <input type="text" placeholder="Header name" class="wh-header-key flex-1 bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50" />
           <input type="text" placeholder="Header value" class="wh-header-val flex-1 bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50" />
         </div>`;

    const content = `
      <div class="space-y-4">
        <input type="hidden" id="wh-edit-id" value="${wh.id}" />
        <div>
          <label class="block text-xs font-medium text-slate-400 mb-1.5">Webhook Name</label>
          <input type="text" id="wh-name" value="${escapeAttr(wh.name)}"
                 class="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-400 mb-1.5">Webhook URL</label>
          <input type="text" id="wh-url" value="${escapeAttr(wh.url)}"
                 class="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-400 mb-1.5">Event Types</label>
          <div class="grid grid-cols-2 gap-2">${eventCheckboxes}</div>
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-400 mb-1.5">Custom Headers (optional)</label>
          <div id="wh-headers-container" class="space-y-2">${headerRows}</div>
          <button onclick="WebhooksPage.addHeaderRow()"
                  class="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors">
            + Add header
          </button>
        </div>
      </div>`;

    Components.showModal('Edit Webhook', content, [
      { label: 'Save Changes', onClick: 'WebhooksPage.saveEditWebhook()', class: 'bg-blue-600 hover:bg-blue-700 text-white' },
    ]);
  }

  /* ------------------------------------------------------------------
     Modal helpers
  ------------------------------------------------------------------ */
  function addHeaderRow() {
    const container = document.getElementById('wh-headers-container');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'flex gap-2 wh-header-row';
    row.innerHTML = `
      <input type="text" placeholder="Header name" class="wh-header-key flex-1 bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50" />
      <input type="text" placeholder="Header value" class="wh-header-val flex-1 bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50" />
      <button onclick="this.parentElement.remove()" class="text-slate-500 hover:text-red-400 px-1 transition-colors">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>`;
    container.appendChild(row);
  }

  function collectModalData() {
    const nameEl = document.getElementById('wh-name');
    const urlEl = document.getElementById('wh-url');

    const name = nameEl ? nameEl.value.trim() : '';
    const url = urlEl ? urlEl.value.trim() : '';

    // Collect event types
    const event_types = [];
    document.querySelectorAll('.wh-event-cb:checked').forEach(cb => {
      event_types.push(cb.value);
    });

    // Collect headers
    const headers = {};
    document.querySelectorAll('.wh-header-row').forEach(row => {
      const key = row.querySelector('.wh-header-key');
      const val = row.querySelector('.wh-header-val');
      if (key && val && key.value.trim()) {
        headers[key.value.trim()] = val.value.trim();
      }
    });

    return { name, url, event_types, headers };
  }

  /* ------------------------------------------------------------------
     Actions
  ------------------------------------------------------------------ */
  async function saveNewWebhook() {
    const { name, url, event_types, headers } = collectModalData();

    if (!name) { Components.toast('Please enter a webhook name', 'warning'); return; }
    if (!url) { Components.toast('Please enter a webhook URL', 'warning'); return; }
    if (event_types.length === 0) { Components.toast('Please select at least one event type', 'warning'); return; }

    try {
      await App.api('/webhooks/create', {
        method: 'POST',
        body: { name, url, event_types, headers, project_id: App.state.project },
      });
      Components.closeModal();
      Components.toast('Webhook created successfully', 'success');
      const container = document.getElementById('main-content');
      if (container) render(container);
    } catch (_) {
      // Error shown by App.api
    }
  }

  async function saveEditWebhook() {
    const editIdEl = document.getElementById('wh-edit-id');
    const id = editIdEl ? editIdEl.value : null;
    if (!id) return;

    const { name, url, event_types, headers } = collectModalData();

    if (!name) { Components.toast('Please enter a webhook name', 'warning'); return; }
    if (!url) { Components.toast('Please enter a webhook URL', 'warning'); return; }
    if (event_types.length === 0) { Components.toast('Please select at least one event type', 'warning'); return; }

    try {
      await App.api('/webhooks/' + id, {
        method: 'PUT',
        body: { name, url, event_types, headers },
      });
      Components.closeModal();
      Components.toast('Webhook updated successfully', 'success');
      const container = document.getElementById('main-content');
      if (container) render(container);
    } catch (_) {
      // Error shown by App.api
    }
  }

  async function deleteWebhook(webhookId) {
    const wh = webhooks.find(w => w.id === webhookId);
    if (!wh) return;

    Components.showModal(
      'Delete Webhook',
      `<div class="text-center py-2">
        <svg class="w-10 h-10 text-red-400 mx-auto mb-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
        </svg>
        <p class="text-sm text-slate-300">Delete webhook <strong>${escapeHtml(wh.name)}</strong>?</p>
        <p class="text-xs text-slate-500 mt-1">This will also delete all delivery logs for this webhook.</p>
      </div>`,
      [{
        label: 'Delete',
        class: 'bg-red-600 hover:bg-red-700 text-white',
        onClick: `WebhooksPage.confirmDelete('${webhookId}')`,
      }]
    );
  }

  async function confirmDelete(webhookId) {
    Components.closeModal();
    try {
      await App.api('/webhooks/' + webhookId, { method: 'DELETE' });
      Components.toast('Webhook deleted', 'info');
      const container = document.getElementById('main-content');
      if (container) render(container);
    } catch (_) {
      // Error shown by App.api
    }
  }

  async function toggleActive(webhookId, newActive) {
    try {
      await App.api('/webhooks/' + webhookId, {
        method: 'PUT',
        body: { active: newActive },
      });
      // Update local state
      const wh = webhooks.find(w => w.id === webhookId);
      if (wh) wh.active = newActive;
      // Re-render the list only
      const listContainer = document.getElementById('webhooks-list-container');
      if (listContainer) listContainer.innerHTML = renderWebhookList();
      Components.toast(newActive ? 'Webhook activated' : 'Webhook paused', 'info');
    } catch (_) {
      // Error shown by App.api
    }
  }

  async function testWebhook(webhookId) {
    Components.toast('Sending test payload...', 'info');
    try {
      const result = await App.api('/webhooks/test/' + webhookId, { method: 'POST' });
      if (result.success) {
        Components.toast('Test delivered successfully (HTTP ' + result.response_status + ')', 'success');
      } else {
        Components.toast('Test delivery failed (HTTP ' + (result.response_status || 'timeout') + ')', 'error');
      }
    } catch (_) {
      // Error shown by App.api
    }
  }

  async function toggleLogs(webhookId) {
    if (expandedLogId === webhookId) {
      expandedLogId = null;
      expandedLogs = [];
    } else {
      expandedLogId = webhookId;
      expandedLogs = await fetchWebhookLogs(webhookId);
    }
    const listContainer = document.getElementById('webhooks-list-container');
    if (listContainer) listContainer.innerHTML = renderWebhookList();
  }

  async function saveSlack() {
    const urlEl = document.getElementById('slack-webhook-url');
    const channelEl = document.getElementById('slack-channel');

    const webhook_url = urlEl ? urlEl.value.trim() : '';
    const channel = channelEl ? channelEl.value.trim() : '#alerts';

    if (!webhook_url) {
      Components.toast('Please enter a Slack webhook URL', 'warning');
      return;
    }

    // Collect selected events
    const events = [];
    document.querySelectorAll('.slack-event-cb:checked').forEach(cb => {
      events.push(cb.value);
    });

    if (events.length === 0) {
      Components.toast('Please select at least one event type', 'warning');
      return;
    }

    try {
      await App.api('/webhooks/slack/setup', {
        method: 'POST',
        body: { webhook_url, channel, events, project_id: App.state.project },
      });
      Components.toast('Slack integration saved successfully', 'success');
      const container = document.getElementById('main-content');
      if (container) render(container);
    } catch (_) {
      // Error shown by App.api
    }
  }

  /* ------------------------------------------------------------------
     Main render
  ------------------------------------------------------------------ */
  async function render(container) {
    container.innerHTML = Components.loading();

    // Fetch data in parallel
    const [slackConfig] = await Promise.all([
      fetchSlackConfig(),
      fetchWebhooks(),
    ]);

    container.innerHTML = `
      <div class="max-w-5xl">
        <!-- Header -->
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="text-lg font-semibold text-white">Webhooks & Notifications</h2>
            <p class="text-sm text-slate-400 mt-0.5">Configure webhooks and Slack notifications for real-time event alerts</p>
          </div>
          <button onclick="WebhooksPage.showAddModal()"
                  class="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
            </svg>
            Add Webhook
          </button>
        </div>

        <!-- Slack Quick Setup -->
        ${renderSlackCard(slackConfig)}

        <!-- Webhooks List -->
        <div class="mb-6">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-slate-300 uppercase tracking-wider">Webhooks</h3>
            <span class="text-xs text-slate-500">${webhooks.length} webhook${webhooks.length !== 1 ? 's' : ''} configured</span>
          </div>
          <div id="webhooks-list-container">
            ${renderWebhookList()}
          </div>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------
     Public API
  ------------------------------------------------------------------ */
  return {
    render,
    showAddModal,
    showEditModal,
    addHeaderRow,
    saveNewWebhook,
    saveEditWebhook,
    deleteWebhook,
    confirmDelete,
    toggleActive,
    testWebhook,
    toggleLogs,
    saveSlack,
  };

})();
