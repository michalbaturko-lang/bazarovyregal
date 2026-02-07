/* ==========================================================================
   apikeys-page.js  -  API Keys & Developer API management page
   ========================================================================== */

const ApiKeysPage = (() => {

  /* ------------------------------------------------------------------
     State
  ------------------------------------------------------------------ */
  let apiKeys = [];
  let activeTab = 'keys';

  /* ------------------------------------------------------------------
     Data fetching
  ------------------------------------------------------------------ */
  async function fetchApiKeys() {
    try {
      const data = await App.api('/apikeys/list');
      apiKeys = (data && data.keys) || [];
    } catch (_) {
      apiKeys = [];
    }
  }

  /* ------------------------------------------------------------------
     Helpers
  ------------------------------------------------------------------ */
  function escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function scopeColor(scope) {
    if (scope.startsWith('read:')) return 'blue';
    if (scope.startsWith('write:')) return 'yellow';
    return 'slate';
  }

  /* ------------------------------------------------------------------
     Tab rendering
  ------------------------------------------------------------------ */
  function renderTabs() {
    const tabs = [
      { id: 'keys', label: 'API Keys', icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"/></svg>' },
      { id: 'docs', label: 'API Documentation', icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/></svg>' },
    ];

    return `
      <div class="flex items-center gap-1 border-b border-slate-700/50 mb-6">
        ${tabs.map(tab => `
          <button onclick="ApiKeysPage.switchTab('${tab.id}')"
                  class="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                         ${activeTab === tab.id
                           ? 'border-blue-500 text-blue-400'
                           : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'}">
            ${tab.icon}
            ${tab.label}
          </button>
        `).join('')}
      </div>`;
  }

  /* ------------------------------------------------------------------
     Tab: API Keys List
  ------------------------------------------------------------------ */
  function renderKeysTab() {
    const createButton = `
      <button onclick="ApiKeysPage.showCreateModal()"
              class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
        </svg>
        Create API Key
      </button>`;

    if (apiKeys.length === 0) {
      return `
        <div class="mb-4 flex justify-end">${createButton}</div>
        ${Components.emptyState(
          'No API Keys',
          'Create an API key to access the Developer API for custom integrations.',
          '<svg class="w-12 h-12 text-slate-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"/></svg>'
        )}`;
    }

    const headers = [
      { key: 'name', label: 'Name' },
      { key: 'prefix', label: 'Key' },
      { key: 'scopes', label: 'Scopes' },
      { key: 'created', label: 'Created' },
      { key: 'last_used', label: 'Last Used' },
      { key: 'requests', label: 'Requests', align: 'right' },
      { key: 'status', label: 'Status', align: 'center' },
      { key: 'actions', label: '', align: 'right' },
    ];

    const rows = apiKeys.map(key => ({
      id: key.id,
      cells: {
        name: `<span class="font-medium text-white">${escapeHtml(key.name)}</span>`,
        prefix: `<code class="bg-slate-700/50 px-2 py-0.5 rounded text-xs font-mono text-slate-300">${escapeHtml(key.key_prefix)}</code>`,
        scopes: `<div class="flex flex-wrap gap-1">${(key.scopes || []).map(s => Components.badge(s, scopeColor(s))).join('')}</div>`,
        created: `<span class="text-slate-400 text-xs">${formatDate(key.created_at)}</span>`,
        last_used: `<span class="text-slate-400 text-xs">${key.last_used_at ? Components.timeAgo(key.last_used_at) : 'Never'}</span>`,
        requests: `<span class="text-slate-300 font-mono text-sm">${App.formatNumber(key.request_count || 0)}</span>`,
        status: key.active
          ? `<button onclick="ApiKeysPage.toggleKey('${key.id}', false)" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/15 text-green-400 border border-green-500/20 hover:bg-green-500/25 transition-colors cursor-pointer">
               <span class="w-1.5 h-1.5 rounded-full bg-green-400"></span> Active
             </button>`
          : `<button onclick="ApiKeysPage.toggleKey('${key.id}', true)" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-600/30 text-slate-400 border border-slate-500/20 hover:bg-slate-600/50 transition-colors cursor-pointer">
               <span class="w-1.5 h-1.5 rounded-full bg-slate-500"></span> Inactive
             </button>`,
        actions: `
          <div class="flex items-center gap-1 justify-end">
            <button onclick="ApiKeysPage.showUsage('${key.id}')"
                    class="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-700/50 transition-colors"
                    title="View usage">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/>
              </svg>
            </button>
            <button onclick="ApiKeysPage.confirmDelete('${key.id}', '${escapeHtml(key.name)}')"
                    class="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700/50 transition-colors"
                    title="Revoke key">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/>
              </svg>
            </button>
          </div>`,
      },
    }));

    return `
      <div class="mb-4 flex justify-end">${createButton}</div>
      ${Components.dataTable(headers, rows, { striped: true, hoverable: false, id: 'apikeys-table' })}`;
  }

  /* ------------------------------------------------------------------
     Tab: API Documentation
  ------------------------------------------------------------------ */
  function renderDocsTab() {
    const baseUrl = 'https://regal-master-look.vercel.app/api/v1';

    const endpoints = [
      {
        method: 'GET',
        path: '/sessions',
        desc: 'List sessions with pagination',
        scope: 'read:sessions',
        params: 'limit (default 50), offset (default 0), date_from, date_to',
        curl: `curl -H "Authorization: Bearer rml_k_YOUR_KEY" \\\n  "${baseUrl}/sessions?limit=10&offset=0"`,
        response: `{
  "data": [
    {
      "id": "sess_abc123",
      "visitor_id": "v_xyz",
      "started_at": "2025-01-15T10:30:00Z",
      "duration": 125,
      "url": "https://example.com/",
      "browser": "Chrome 120",
      "os": "Windows 10+",
      "device_type": "desktop",
      "page_count": 4,
      "event_count": 87
    }
  ],
  "total": 1542,
  "limit": 10,
  "offset": 0,
  "has_more": true
}`,
      },
      {
        method: 'GET',
        path: '/sessions/:id',
        desc: 'Get session details',
        scope: 'read:sessions',
        params: 'None',
        curl: `curl -H "Authorization: Bearer rml_k_YOUR_KEY" \\\n  "${baseUrl}/sessions/sess_abc123"`,
        response: `{
  "data": {
    "id": "sess_abc123",
    "visitor_id": "v_xyz",
    "started_at": "2025-01-15T10:30:00Z",
    "ended_at": "2025-01-15T10:32:05Z",
    "duration": 125,
    "url": "https://example.com/",
    "browser": "Chrome 120",
    "page_count": 4,
    "event_count": 87,
    "has_rage_clicks": false,
    "has_errors": true
  }
}`,
      },
      {
        method: 'GET',
        path: '/sessions/:id/events',
        desc: 'Get events for a session',
        scope: 'read:events',
        params: 'limit (default 500), offset (default 0)',
        curl: `curl -H "Authorization: Bearer rml_k_YOUR_KEY" \\\n  "${baseUrl}/sessions/sess_abc123/events?limit=100"`,
        response: `{
  "data": [
    {
      "id": 1234,
      "type": 4,
      "timestamp": 1705312200000,
      "data": { "x": 450, "y": 320 },
      "url": "https://example.com/"
    }
  ],
  "total": 87,
  "limit": 100,
  "offset": 0,
  "has_more": false
}`,
      },
      {
        method: 'GET',
        path: '/analytics/overview',
        desc: 'Get dashboard stats (sessions, visitors, avg duration, bounce rate)',
        scope: 'read:analytics',
        params: 'date_from, date_to',
        curl: `curl -H "Authorization: Bearer rml_k_YOUR_KEY" \\\n  "${baseUrl}/analytics/overview?date_from=2025-01-01"`,
        response: `{
  "data": {
    "total_sessions": 1542,
    "unique_visitors": 876,
    "avg_duration": 94,
    "bounce_rate": 34.2
  }
}`,
      },
      {
        method: 'GET',
        path: '/analytics/pages',
        desc: 'Top pages with metrics',
        scope: 'read:analytics',
        params: 'date_from, date_to, limit (default 20)',
        curl: `curl -H "Authorization: Bearer rml_k_YOUR_KEY" \\\n  "${baseUrl}/analytics/pages?limit=5"`,
        response: `{
  "data": [
    {
      "url": "https://example.com/",
      "views": 523,
      "unique_visitors": 312,
      "avg_duration": 45
    }
  ]
}`,
      },
      {
        method: 'GET',
        path: '/analytics/errors',
        desc: 'Error summary',
        scope: 'read:analytics',
        params: 'date_from, date_to',
        curl: `curl -H "Authorization: Bearer rml_k_YOUR_KEY" \\\n  "${baseUrl}/analytics/errors"`,
        response: `{
  "data": {
    "total_errors": 23,
    "unique_errors": 5,
    "affected_sessions": 12,
    "error_rate": 0.78
  }
}`,
      },
      {
        method: 'GET',
        path: '/analytics/performance',
        desc: 'Web Vitals summary (LCP, CLS, FID, INP, TTFB)',
        scope: 'read:analytics',
        params: 'date_from, date_to',
        curl: `curl -H "Authorization: Bearer rml_k_YOUR_KEY" \\\n  "${baseUrl}/analytics/performance"`,
        response: `{
  "data": {
    "sample_count": 340,
    "lcp": { "p75": 2100, "avg": 1850 },
    "cls": { "p75": 0.08, "avg": 0.05 },
    "fid": { "p75": 12, "avg": 8 },
    "ttfb": { "p75": 650, "avg": 520 }
  }
}`,
      },
      {
        method: 'POST',
        path: '/events',
        desc: 'Ingest custom events (server-side tracking)',
        scope: 'write:events',
        params: 'Body: { session_id, events: [{ name, properties, timestamp?, url? }] }',
        curl: `curl -X POST -H "Authorization: Bearer rml_k_YOUR_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"session_id":"sess_abc","events":[{"name":"purchase","properties":{"amount":49.99}}]}' \\\n  "${baseUrl}/events"`,
        response: `{
  "success": true,
  "stored": 1
}`,
      },
    ];

    return `
      <div class="max-w-4xl space-y-6">
        <!-- Overview -->
        <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-6">
          <h3 class="text-sm font-semibold text-white mb-3">Developer API Overview</h3>
          <p class="text-sm text-slate-400 mb-4">
            The Regal Master Look API allows you to programmatically access your session recording data,
            analytics, and ingest custom events for server-side integrations.
          </p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-slate-900 rounded-lg p-4">
              <div class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Base URL</div>
              <code class="text-sm text-blue-400 font-mono">${escapeHtml(baseUrl)}/</code>
            </div>
            <div class="bg-slate-900 rounded-lg p-4">
              <div class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Authentication</div>
              <code class="text-sm text-green-400 font-mono">Authorization: Bearer rml_k_xxx</code>
            </div>
            <div class="bg-slate-900 rounded-lg p-4">
              <div class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Rate Limit</div>
              <span class="text-sm text-slate-300">100 requests per minute per API key</span>
            </div>
            <div class="bg-slate-900 rounded-lg p-4">
              <div class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Response Format</div>
              <span class="text-sm text-slate-300">JSON with <code class="text-slate-400 bg-slate-800 px-1 py-0.5 rounded">data</code> wrapper</span>
            </div>
          </div>
        </div>

        <!-- Rate Limits -->
        <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-6">
          <h3 class="text-sm font-semibold text-white mb-3">Rate Limiting</h3>
          <p class="text-sm text-slate-400 mb-3">
            Each API key is limited to <strong class="text-white">100 requests per minute</strong>.
            Rate limit headers are included in every response:
          </p>
          <div class="bg-slate-900 rounded-lg p-4 font-mono text-sm space-y-1">
            <div><span class="text-slate-500">X-RateLimit-Limit:</span> <span class="text-green-400">100</span></div>
            <div><span class="text-slate-500">X-RateLimit-Remaining:</span> <span class="text-green-400">97</span></div>
            <div><span class="text-slate-500">X-RateLimit-Reset:</span> <span class="text-green-400">1705312260</span></div>
          </div>
          <p class="text-xs text-slate-500 mt-3">
            When the rate limit is exceeded, a <code class="bg-slate-700 px-1 py-0.5 rounded text-red-400">429 Too Many Requests</code> response is returned with a <code class="bg-slate-700 px-1 py-0.5 rounded text-slate-400">retry_after</code> field in seconds.
          </p>
        </div>

        <!-- Scopes -->
        <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-6">
          <h3 class="text-sm font-semibold text-white mb-3">Available Scopes</h3>
          <div class="space-y-2">
            <div class="flex items-center gap-3 p-2 bg-slate-900 rounded-lg">
              ${Components.badge('read:sessions', 'blue')}
              <span class="text-sm text-slate-300">Read session data and details</span>
            </div>
            <div class="flex items-center gap-3 p-2 bg-slate-900 rounded-lg">
              ${Components.badge('read:events', 'blue')}
              <span class="text-sm text-slate-300">Read event data for sessions</span>
            </div>
            <div class="flex items-center gap-3 p-2 bg-slate-900 rounded-lg">
              ${Components.badge('read:analytics', 'blue')}
              <span class="text-sm text-slate-300">Read analytics, errors, and performance data</span>
            </div>
            <div class="flex items-center gap-3 p-2 bg-slate-900 rounded-lg">
              ${Components.badge('write:events', 'yellow')}
              <span class="text-sm text-slate-300">Ingest custom events via the API</span>
            </div>
          </div>
        </div>

        <!-- Endpoints -->
        <div class="space-y-4">
          <h3 class="text-sm font-semibold text-white">Endpoints</h3>
          ${endpoints.map((ep, idx) => `
            <div class="bg-slate-800 rounded-xl border border-slate-700/50 overflow-hidden">
              <button onclick="ApiKeysPage.toggleEndpoint(${idx})"
                      class="w-full flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors text-left">
                <div class="flex items-center gap-3">
                  <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${ep.method === 'GET' ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-400'}">
                    ${ep.method}
                  </span>
                  <code class="text-sm font-mono text-slate-200">${escapeHtml(ep.path)}</code>
                  <span class="text-xs text-slate-500 hidden sm:inline">${escapeHtml(ep.desc)}</span>
                </div>
                <div class="flex items-center gap-2">
                  ${Components.badge(ep.scope, scopeColor(ep.scope))}
                  <svg class="w-4 h-4 text-slate-500 transform transition-transform" id="endpoint-chevron-${idx}" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/>
                  </svg>
                </div>
              </button>
              <div id="endpoint-detail-${idx}" class="hidden border-t border-slate-700/50 p-4 space-y-3">
                <p class="text-sm text-slate-400">${escapeHtml(ep.desc)}</p>
                <div>
                  <div class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Parameters</div>
                  <p class="text-sm text-slate-300">${escapeHtml(ep.params)}</p>
                </div>
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Example Request</span>
                    <button onclick="ApiKeysPage.copyText(this, \`${ep.curl.replace(/`/g, '\\`').replace(/\\/g, '\\\\')}\`)"
                            class="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"/>
                      </svg>
                      Copy
                    </button>
                  </div>
                  <pre class="bg-slate-900 rounded-lg border border-slate-700/50 p-3 text-xs text-green-400 font-mono overflow-x-auto leading-relaxed">${escapeHtml(ep.curl)}</pre>
                </div>
                <div>
                  <div class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Example Response</div>
                  <pre class="bg-slate-900 rounded-lg border border-slate-700/50 p-3 text-xs text-blue-400 font-mono overflow-x-auto leading-relaxed">${escapeHtml(ep.response)}</pre>
                </div>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Error Responses -->
        <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-6">
          <h3 class="text-sm font-semibold text-white mb-3">Error Responses</h3>
          <div class="space-y-2 text-sm">
            <div class="flex items-start gap-3 p-2 bg-slate-900 rounded-lg">
              <code class="text-red-400 font-mono shrink-0">401</code>
              <span class="text-slate-300">Unauthorized - Invalid or missing API key</span>
            </div>
            <div class="flex items-start gap-3 p-2 bg-slate-900 rounded-lg">
              <code class="text-red-400 font-mono shrink-0">403</code>
              <span class="text-slate-300">Forbidden - API key lacks required scope</span>
            </div>
            <div class="flex items-start gap-3 p-2 bg-slate-900 rounded-lg">
              <code class="text-red-400 font-mono shrink-0">404</code>
              <span class="text-slate-300">Not Found - Resource does not exist</span>
            </div>
            <div class="flex items-start gap-3 p-2 bg-slate-900 rounded-lg">
              <code class="text-yellow-400 font-mono shrink-0">429</code>
              <span class="text-slate-300">Too Many Requests - Rate limit exceeded</span>
            </div>
            <div class="flex items-start gap-3 p-2 bg-slate-900 rounded-lg">
              <code class="text-red-400 font-mono shrink-0">500</code>
              <span class="text-slate-300">Internal Server Error</span>
            </div>
          </div>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------
     Create key modal
  ------------------------------------------------------------------ */
  function showCreateModal() {
    const content = `
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-slate-400 mb-1.5">Key Name</label>
          <input type="text" id="apikey-name"
                 class="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                 placeholder="e.g. Production Integration, CI/CD Pipeline" />
          <p class="text-xs text-slate-500 mt-1">A descriptive name to identify this key.</p>
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-400 mb-2">Scopes</label>
          <div class="space-y-2">
            <label class="flex items-center gap-3 p-2.5 bg-slate-900 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
              <input type="checkbox" value="read:sessions" checked
                     class="w-4 h-4 rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500/30" />
              <div>
                <span class="text-sm text-white font-medium">read:sessions</span>
                <p class="text-xs text-slate-500">List and view session data</p>
              </div>
            </label>
            <label class="flex items-center gap-3 p-2.5 bg-slate-900 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
              <input type="checkbox" value="read:events" checked
                     class="w-4 h-4 rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500/30" />
              <div>
                <span class="text-sm text-white font-medium">read:events</span>
                <p class="text-xs text-slate-500">Read event data for sessions</p>
              </div>
            </label>
            <label class="flex items-center gap-3 p-2.5 bg-slate-900 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
              <input type="checkbox" value="read:analytics" checked
                     class="w-4 h-4 rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500/30" />
              <div>
                <span class="text-sm text-white font-medium">read:analytics</span>
                <p class="text-xs text-slate-500">Access analytics, errors, and performance data</p>
              </div>
            </label>
            <label class="flex items-center gap-3 p-2.5 bg-slate-900 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
              <input type="checkbox" value="write:events"
                     class="w-4 h-4 rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500/30" />
              <div>
                <span class="text-sm text-white font-medium">write:events</span>
                <p class="text-xs text-slate-500">Ingest custom events via API (server-side tracking)</p>
              </div>
            </label>
          </div>
        </div>
      </div>`;

    Components.showModal('Create API Key', content, [{
      label: 'Create Key',
      class: 'bg-blue-600 hover:bg-blue-700 text-white',
      onClick: 'ApiKeysPage.executeCreate()',
    }]);
  }

  async function executeCreate() {
    const nameEl = document.getElementById('apikey-name');
    if (!nameEl) return;

    const name = nameEl.value.trim();
    if (!name) {
      Components.toast('Please enter a name for the API key', 'warning');
      return;
    }

    // Collect selected scopes
    const checkboxes = document.querySelectorAll('#modal-overlay input[type="checkbox"]:checked');
    const scopes = Array.from(checkboxes).map(cb => cb.value);

    if (scopes.length === 0) {
      Components.toast('Please select at least one scope', 'warning');
      return;
    }

    try {
      const result = await App.api('/apikeys/create', {
        method: 'POST',
        body: { name, scopes },
      });

      Components.closeModal();

      // Show the full key in a special modal (shown only once)
      showKeyRevealModal(result);

      // Refresh the list
      await fetchApiKeys();
      renderTabContent();
    } catch (err) {
      Components.toast('Failed to create API key', 'error');
    }
  }

  function showKeyRevealModal(result) {
    const content = `
      <div class="space-y-4">
        <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <div class="flex items-start gap-3">
            <svg class="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
            </svg>
            <div>
              <p class="text-sm font-semibold text-yellow-300">Save this key now!</p>
              <p class="text-xs text-yellow-400/80 mt-1">This is the only time you will see the full API key. Copy it and store it securely. It cannot be retrieved later.</p>
            </div>
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-400 mb-1.5">Your API Key</label>
          <div class="relative">
            <input type="text" readonly value="${escapeHtml(result.key)}" id="revealed-api-key"
                   class="w-full bg-slate-900 border border-slate-600/50 rounded-lg px-3 py-3 text-sm text-green-400 font-mono focus:outline-none pr-20" />
            <button onclick="ApiKeysPage.copyRevealedKey()"
                    class="absolute right-2 top-1/2 -translate-y-1/2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5" id="copy-key-btn">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"/>
              </svg>
              Copy
            </button>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 text-xs">
          <div class="bg-slate-900 rounded-lg p-3">
            <span class="text-slate-500">Name:</span>
            <span class="text-white ml-1">${escapeHtml(result.name)}</span>
          </div>
          <div class="bg-slate-900 rounded-lg p-3">
            <span class="text-slate-500">Key ID:</span>
            <span class="text-slate-300 font-mono ml-1">${escapeHtml(result.id)}</span>
          </div>
        </div>

        <div>
          <span class="text-xs text-slate-500">Scopes:</span>
          <div class="flex flex-wrap gap-1 mt-1">
            ${(result.scopes || []).map(s => Components.badge(s, scopeColor(s))).join('')}
          </div>
        </div>
      </div>`;

    Components.showModal('API Key Created', content, [{
      label: 'I have saved my key',
      class: 'bg-green-600 hover:bg-green-700 text-white',
      onClick: 'Components.closeModal()',
    }]);
  }

  function copyRevealedKey() {
    const input = document.getElementById('revealed-api-key');
    if (!input) return;

    navigator.clipboard.writeText(input.value).then(() => {
      const btn = document.getElementById('copy-key-btn');
      if (btn) {
        const originalHTML = btn.innerHTML;
        btn.innerHTML = `
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
          </svg>
          Copied!`;
        btn.classList.add('bg-green-600');
        btn.classList.remove('bg-slate-700');
        setTimeout(() => {
          btn.innerHTML = originalHTML;
          btn.classList.remove('bg-green-600');
          btn.classList.add('bg-slate-700');
        }, 2000);
      }
      Components.toast('API key copied to clipboard', 'success');
    }).catch(() => {
      Components.toast('Failed to copy', 'error');
    });
  }

  /* ------------------------------------------------------------------
     Toggle key active/inactive
  ------------------------------------------------------------------ */
  async function toggleKey(id, active) {
    try {
      await App.api(`/apikeys/${id}`, {
        method: 'PATCH',
        body: { active },
      });
      Components.toast(`API key ${active ? 'activated' : 'deactivated'}`, 'success');
      await fetchApiKeys();
      renderTabContent();
    } catch (_) {
      Components.toast('Failed to update API key', 'error');
    }
  }

  /* ------------------------------------------------------------------
     Delete key
  ------------------------------------------------------------------ */
  function confirmDelete(id, name) {
    Components.showModal(
      'Revoke API Key',
      `<div class="text-center py-2">
        <svg class="w-12 h-12 text-red-400 mx-auto mb-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
        </svg>
        <p class="text-sm text-slate-300 mb-2">Are you sure you want to revoke the API key <strong class="text-white">"${escapeHtml(name)}"</strong>?</p>
        <p class="text-xs text-slate-500">This action cannot be undone. Any integrations using this key will immediately stop working.</p>
      </div>`,
      [{
        label: 'Revoke Key',
        class: 'bg-red-600 hover:bg-red-700 text-white',
        onClick: `ApiKeysPage.executeDelete('${id}')`,
      }]
    );
  }

  async function executeDelete(id) {
    Components.closeModal();
    try {
      await App.api(`/apikeys/${id}`, { method: 'DELETE' });
      Components.toast('API key revoked successfully', 'success');
      await fetchApiKeys();
      renderTabContent();
    } catch (_) {
      Components.toast('Failed to revoke API key', 'error');
    }
  }

  /* ------------------------------------------------------------------
     Usage stats modal
  ------------------------------------------------------------------ */
  async function showUsage(id) {
    try {
      const usage = await App.api(`/apikeys/${id}/usage`);

      const content = `
        <div class="space-y-4">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-sm font-medium text-white">${escapeHtml(usage.name)}</span>
            <code class="bg-slate-700/50 px-2 py-0.5 rounded text-xs font-mono text-slate-400">${escapeHtml(usage.key_prefix)}</code>
          </div>

          <div class="grid grid-cols-3 gap-3">
            <div class="bg-slate-900 rounded-lg p-4 text-center">
              <div class="text-xl font-bold text-white">${App.formatNumber(usage.requests_24h)}</div>
              <div class="text-xs text-slate-400 mt-1">Last 24h</div>
            </div>
            <div class="bg-slate-900 rounded-lg p-4 text-center">
              <div class="text-xl font-bold text-white">${App.formatNumber(usage.requests_7d)}</div>
              <div class="text-xs text-slate-400 mt-1">Last 7 days</div>
            </div>
            <div class="bg-slate-900 rounded-lg p-4 text-center">
              <div class="text-xl font-bold text-white">${App.formatNumber(usage.requests_30d)}</div>
              <div class="text-xs text-slate-400 mt-1">Last 30 days</div>
            </div>
          </div>

          <div class="bg-slate-900 rounded-lg p-4">
            <div class="grid grid-cols-2 gap-y-2 text-sm">
              <span class="text-slate-500">Total Requests</span>
              <span class="text-white text-right font-mono">${App.formatNumber(usage.total_requests)}</span>
              <span class="text-slate-500">Last Used</span>
              <span class="text-white text-right">${usage.last_used_at ? Components.timeAgo(usage.last_used_at) : 'Never'}</span>
              <span class="text-slate-500">Created</span>
              <span class="text-white text-right">${formatDate(usage.created_at)}</span>
              <span class="text-slate-500">Status</span>
              <span class="text-right">${usage.active
                ? '<span class="text-green-400">Active</span>'
                : '<span class="text-slate-500">Inactive</span>'
              }</span>
            </div>
          </div>
        </div>`;

      Components.showModal('API Key Usage', content, []);
    } catch (_) {
      Components.toast('Failed to load usage data', 'error');
    }
  }

  /* ------------------------------------------------------------------
     Toggle endpoint details
  ------------------------------------------------------------------ */
  function toggleEndpoint(idx) {
    const detail = document.getElementById(`endpoint-detail-${idx}`);
    const chevron = document.getElementById(`endpoint-chevron-${idx}`);
    if (!detail) return;

    const isHidden = detail.classList.contains('hidden');
    detail.classList.toggle('hidden');
    if (chevron) {
      chevron.style.transform = isHidden ? 'rotate(180deg)' : '';
    }
  }

  /* ------------------------------------------------------------------
     Copy text utility
  ------------------------------------------------------------------ */
  function copyText(btnEl, text) {
    navigator.clipboard.writeText(text).then(() => {
      const orig = btnEl.textContent;
      btnEl.textContent = 'Copied!';
      setTimeout(() => { btnEl.textContent = orig; }, 1500);
      Components.toast('Copied to clipboard', 'success');
    }).catch(() => {
      Components.toast('Failed to copy', 'error');
    });
  }

  /* ------------------------------------------------------------------
     Tab switching & content rendering
  ------------------------------------------------------------------ */
  function switchTab(tab) {
    activeTab = tab;
    renderTabContent();
  }

  function renderTabContent() {
    const tabContent = document.getElementById('apikeys-tab-content');
    if (!tabContent) return;

    const tabsContainer = document.getElementById('apikeys-tabs');
    if (tabsContainer) {
      tabsContainer.innerHTML = renderTabs();
    }

    switch (activeTab) {
      case 'keys':
        tabContent.innerHTML = renderKeysTab();
        break;
      case 'docs':
        tabContent.innerHTML = renderDocsTab();
        break;
      default:
        tabContent.innerHTML = renderKeysTab();
    }
  }

  /* ------------------------------------------------------------------
     Main render
  ------------------------------------------------------------------ */
  async function render(container) {
    container.innerHTML = Components.loading();

    await fetchApiKeys();

    container.innerHTML = `
      <div>
        ${Components.sectionHeader(
          'API Keys & Developer API',
          'Create API keys and access the public REST API for custom integrations',
          `<div class="flex items-center gap-2">
            <span class="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-500/15 text-blue-400 border border-blue-500/20">
              <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"/>
              </svg>
              REST API v1
            </span>
          </div>`
        )}
        <div id="apikeys-tabs">${renderTabs()}</div>
        <div id="apikeys-tab-content"></div>
      </div>`;

    renderTabContent();
  }

  /* ------------------------------------------------------------------
     Public API
  ------------------------------------------------------------------ */
  return {
    render,
    switchTab,
    showCreateModal,
    executeCreate,
    copyRevealedKey,
    toggleKey,
    confirmDelete,
    executeDelete,
    showUsage,
    toggleEndpoint,
    copyText,
  };

})();
