/* ==========================================================================
   sessions-page.js  -  Sessions list & detail pages
   ========================================================================== */

const SessionsPage = (() => {

  /* ------------------------------------------------------------------
     State
  ------------------------------------------------------------------ */
  let sessions = [];
  let totalCount = 0;
  let currentPage = 1;
  const pageSize = 20;
  let savedSegments = [
    { name: 'All Sessions', filters: {} },
    { name: 'With Rage Clicks', filters: { hasRageClicks: true } },
    { name: 'With Errors', filters: { hasErrors: true } },
    { name: 'Mobile Users', filters: { device: 'Mobile' } },
    { name: 'Long Sessions (>5m)', filters: { durationMin: 300 } },
  ];

  let filters = {
    dateFrom: '',
    dateTo: '',
    durationMin: '',
    durationMax: '',
    browser: '',
    os: '',
    device: '',
    url: '',
    hasRageClicks: false,
    hasErrors: false,
    email: '',
    utmSource: '',
    utmMedium: '',
    utmCampaign: '',
  };

  /* ------------------------------------------------------------------
     Data
  ------------------------------------------------------------------ */
  async function fetchSessions() {
    try {
      // Map camelCase filter names to API snake_case query params
      const apiFilters = {};
      if (filters.dateFrom) apiFilters.date_from = filters.dateFrom;
      if (filters.dateTo) apiFilters.date_to = filters.dateTo;
      if (filters.durationMin) apiFilters.min_duration = filters.durationMin;
      if (filters.durationMax) apiFilters.max_duration = filters.durationMax;
      if (filters.browser) apiFilters.browser = filters.browser;
      if (filters.os) apiFilters.os = filters.os;
      if (filters.device) apiFilters.device_type = filters.device;
      if (filters.url) apiFilters.url = filters.url;
      if (filters.hasRageClicks) apiFilters.has_rage_clicks = 'true';
      if (filters.hasErrors) apiFilters.has_errors = 'true';
      if (filters.email) apiFilters.identified_user_email = filters.email;
      if (filters.utmSource) apiFilters.utm_source = filters.utmSource;
      if (filters.utmMedium) apiFilters.utm_medium = filters.utmMedium;
      if (filters.utmCampaign) apiFilters.utm_campaign = filters.utmCampaign;

      const params = new URLSearchParams({ project_id: App.state.project, page: currentPage, limit: pageSize, ...apiFilters });
      const result = await App.api(`/sessions?${params}`);
      // Map API snake_case → camelCase used by templates
      sessions = (result.sessions || []).map(mapSession);
      totalCount = result.total;
    } catch (_) {
      sessions = [];
      totalCount = 0;
    }
  }

  /** Transform API session (snake_case) → template format (camelCase) */
  function mapSession(s) {
    return {
      id: s.id,
      visitorId: s.visitor_id || 'anonymous',
      email: s.identified_user_email || null,
      name: s.identified_user_name || null,
      browser: s.browser || '',
      browserVersion: s.browser_version || '',
      os: s.os || '',
      device: s.device_type || '',
      country: s.country || null,
      city: s.city || null,
      duration: s.duration || 0,
      pageViews: s.page_count || 0,
      pages: s.pages || [],
      startedAt: s.started_at,
      endedAt: s.ended_at,
      rageClicks: s.has_rage_clicks ? (s.rage_click_count || 1) : 0,
      errors: s.has_errors ? (s.error_count || 1) : 0,
      eventCount: s.event_count || 0,
      utmSource: s.utm_source || null,
      utmMedium: s.utm_medium || null,
      utmCampaign: s.utm_campaign || null,
      url: s.url || '',
      language: s.language || '',
      // Keep raw fields too for detail view
      _raw: s,
    };
  }

  /* ------------------------------------------------------------------
     Render list
  ------------------------------------------------------------------ */
  async function render(container) {
    container.innerHTML = Components.loading();
    await fetchSessions();

    const totalPages = Math.ceil(totalCount / pageSize);
    const avgDuration = sessions.length
      ? Math.round(sessions.reduce((s, x) => s + x.duration, 0) / sessions.length)
      : 0;

    container.innerHTML = `
      <div>
        ${Components.sectionHeader('Sessions', `Browse and filter recorded sessions`)}

        <!-- Saved Segments -->
        <div class="flex items-center gap-2 mb-4 flex-wrap">
          <span class="text-xs font-medium text-slate-500 mr-1">Segments:</span>
          ${savedSegments.map((seg, i) =>
            `<button onclick="SessionsPage.loadSegment(${i})"
                     class="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                            ${isActiveSegment(seg) ? 'bg-blue-600/20 border-blue-500/40 text-blue-400' : 'bg-slate-800 border-slate-700/50 text-slate-400 hover:border-slate-600/50 hover:text-slate-300'}">
              ${seg.name}
            </button>`
          ).join('')}
        </div>

        <!-- Filter Bar -->
        <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-4 mb-6">
          <div class="flex items-center gap-2 mb-3">
            <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z"/>
            </svg>
            <span class="text-sm font-medium text-white">Filters</span>
          </div>

          ${Components.filterBar([
            { type: 'date', key: 'dateFrom', label: 'From Date', value: filters.dateFrom },
            { type: 'date', key: 'dateTo', label: 'To Date', value: filters.dateTo },
            { type: 'number', key: 'durationMin', label: 'Min Duration (s)', placeholder: '0', value: filters.durationMin, min: 0 },
            { type: 'number', key: 'durationMax', label: 'Max Duration (s)', placeholder: '3600', value: filters.durationMax, min: 0 },
            { type: 'select', key: 'browser', label: 'Browser', value: filters.browser, options: [
              { value: '', label: 'All Browsers' },
              { value: 'Chrome', label: 'Chrome' },
              { value: 'Firefox', label: 'Firefox' },
              { value: 'Safari', label: 'Safari' },
              { value: 'Edge', label: 'Edge' },
            ]},
            { type: 'select', key: 'os', label: 'Operating System', value: filters.os, options: [
              { value: '', label: 'All OS' },
              { value: 'Windows', label: 'Windows' },
              { value: 'macOS', label: 'macOS' },
              { value: 'Linux', label: 'Linux' },
              { value: 'iOS', label: 'iOS' },
              { value: 'Android', label: 'Android' },
            ]},
            { type: 'select', key: 'device', label: 'Device Type', value: filters.device, options: [
              { value: '', label: 'All Devices' },
              { value: 'Desktop', label: 'Desktop' },
              { value: 'Mobile', label: 'Mobile' },
              { value: 'Tablet', label: 'Tablet' },
            ]},
            { type: 'text', key: 'url', label: 'URL Contains', placeholder: '/pricing', value: filters.url },
            { type: 'checkbox', key: 'hasRageClicks', label: 'Has Rage Clicks', value: filters.hasRageClicks },
            { type: 'checkbox', key: 'hasErrors', label: 'Has Errors', value: filters.hasErrors },
            { type: 'text', key: 'email', label: 'User Email', placeholder: 'user@example.com', value: filters.email },
            { type: 'text', key: 'utmSource', label: 'UTM Source', placeholder: 'google', value: filters.utmSource },
            { type: 'text', key: 'utmMedium', label: 'UTM Medium', placeholder: 'cpc', value: filters.utmMedium },
            { type: 'text', key: 'utmCampaign', label: 'UTM Campaign', placeholder: 'summer_sale', value: filters.utmCampaign },
          ])}

          <div class="flex items-center gap-3 mt-4">
            <button onclick="SessionsPage.applyFilters()"
                    class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/>
              </svg>
              Apply Filters
            </button>
            <button onclick="SessionsPage.saveSegment()"
                    class="bg-slate-700 hover:bg-slate-600 text-slate-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"/>
              </svg>
              Save as Segment
            </button>
            <button onclick="SessionsPage.clearFilters()"
                    class="text-slate-400 hover:text-white px-3 py-2 rounded-lg text-sm transition-colors">
              Clear All
            </button>
          </div>
        </div>

        <!-- Summary Stats -->
        <div class="flex items-center gap-6 mb-4 text-sm">
          <span class="text-slate-400">
            <span class="text-white font-semibold">${App.formatNumber(totalCount)}</span> sessions found
          </span>
          <span class="text-slate-600">|</span>
          <span class="text-slate-400">
            Avg duration: <span class="text-white font-medium">${App.formatDuration(avgDuration)}</span>
          </span>
          <span class="text-slate-600">|</span>
          <span class="text-slate-400">
            Page ${currentPage} of ${totalPages || 1}
          </span>
          <span class="flex-1"></span>
          <div class="relative" id="sessions-export-dropdown-wrapper">
            <button onclick="SessionsPage.toggleExportDropdown()"
                    class="bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/>
              </svg>
              Export
              <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/>
              </svg>
            </button>
            <div id="sessions-export-dropdown" class="hidden absolute right-0 top-full mt-1 bg-slate-800 border border-slate-700/50 rounded-lg shadow-lg z-50 min-w-[140px]">
              <button onclick="SessionsPage.exportSessions('csv')"
                      class="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors rounded-t-lg flex items-center gap-2">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
                </svg>
                Export CSV
              </button>
              <button onclick="SessionsPage.exportSessions('json')"
                      class="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors rounded-b-lg flex items-center gap-2">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"/>
                </svg>
                Export JSON
              </button>
            </div>
          </div>
        </div>

        <!-- Sessions Table -->
        <div id="sessions-table-container"></div>

        <!-- Pagination -->
        <div id="sessions-pagination"></div>
      </div>`;

    renderSessionsTable();
    document.getElementById('sessions-pagination').innerHTML = Components.pagination(currentPage, totalPages, 'SessionsPage.goToPage');
  }

  /** Icon helpers for device/os/browser */
  function _deviceIcon(type) {
    const t = (type || '').toLowerCase();
    if (t.includes('mobile') || t.includes('phone')) return '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"/></svg>';
    if (t.includes('tablet')) return '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5h3m-6.75 2.25h10.5a2.25 2.25 0 002.25-2.25V4.5a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 4.5v15a2.25 2.25 0 002.25 2.25z"/></svg>';
    return '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z"/></svg>';
  }
  function _osIcon(os) {
    const o = (os || '').toLowerCase();
    if (o.includes('windows')) return '<svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M0 2.3l6.5-.9v6.3H0V2.3zm7.3-1l8.7-1.3v7.7H7.3V1.3zM16 8.7v7.6l-8.7-1.2V8.7H16zM6.5 15l-6.5-.9V8.7h6.5V15z"/></svg>';
    if (o.includes('mac') || o.includes('ios')) return '<svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M11.2 1.4c-.7.8-1.8 1.4-2.8 1.3-.1-1.1.4-2.3 1-3 .7-.8 1.9-1.4 2.9-1.4.1 1.1-.3 2.3-1.1 3.1zm1.1 1.6c-1.6-.1-3 .9-3.7.9-.8 0-2-.9-3.3-.8-1.7.1-3.3 1-4.1 2.5C-.6 8.8.7 14.1 2.4 16.3c.8 1.1 1.8 2.4 3.1 2.3 1.2-.1 1.7-.8 3.2-.8s1.9.8 3.2.7c1.3 0 2.2-1.1 3-2.2.9-1.3 1.3-2.6 1.3-2.6s-2.5-1-2.5-3.8c0-2.4 2-3.6 2.1-3.6-1.2-1.7-3-1.9-3.5-1.9z"/></svg>';
    if (o.includes('android')) return '<svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M2.8 6v5.2c0 .7.5 1.2 1.2 1.2h.8v2.4c0 .7.5 1.2 1.2 1.2s1.2-.5 1.2-1.2v-2.4h1.6v2.4c0 .7.5 1.2 1.2 1.2s1.2-.5 1.2-1.2v-2.4h.8c.7 0 1.2-.5 1.2-1.2V6H2.8zm-1.6 0c-.7 0-1.2.5-1.2 1.2v4c0 .7.5 1.2 1.2 1.2S2.4 11.9 2.4 11.2v-4C2.4 6.5 1.9 6 1.2 6zm13.6 0c-.7 0-1.2.5-1.2 1.2v4c0 .7.5 1.2 1.2 1.2s1.2-.5 1.2-1.2v-4c0-.7-.5-1.2-1.2-1.2zM10.4 1l.9-1.5c.1-.1 0-.3-.1-.3-.1-.1-.3 0-.3.1L10 1c-.6-.3-1.3-.4-2-.4s-1.4.1-2 .4L5.1-.7c-.1-.1-.3-.2-.3-.1-.2.1-.2.2-.1.3L5.6 1C4.1 1.8 3 3.3 3 5.2h10c0-1.9-1.1-3.4-2.6-4.2zM5.6 3.6c-.3 0-.6-.3-.6-.6s.3-.6.6-.6.6.3.6.6-.3.6-.6.6zm4.8 0c-.3 0-.6-.3-.6-.6s.3-.6.6-.6.6.3.6.6-.3.6-.6.6z"/></svg>';
    if (o.includes('linux')) return '<svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C5.2 0 3.7 2.4 3.7 5.3c0 1.4.4 2.6.8 3.7.3.8.6 1.5.6 2.3 0 .5-.1 1-.4 1.5l-.3.5c-.4.6-.8 1.3-.8 2.1 0 .3.2.6.5.6h8.8c.3 0 .5-.3.5-.6 0-.8-.4-1.5-.8-2.1l-.3-.5c-.3-.5-.4-1-.4-1.5 0-.8.3-1.5.6-2.3.4-1.1.8-2.3.8-3.7C13.3 2.4 10.8 0 8 0z"/></svg>';
    return '';
  }
  function _browserIcon(browser) {
    const b = (browser || '').toLowerCase();
    if (b.includes('chrome')) return '<svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 1a7 7 0 016.93 8H11a3 3 0 00-3-3V1z" opacity=".6"/><path d="M4.5 12.46A7 7 0 011 8h4a3 3 0 001.5 2.6l-2 3.86z" opacity=".4"/><path d="M11.5 12.46L9.5 8.6A3 3 0 008 11v4a7 7 0 003.5-2.54z" opacity=".3"/></svg>';
    if (b.includes('firefox')) return '<svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M14.8 4.4c-.5-1.2-1.6-2.3-2.3-2.7.7 1 1.1 2.1 1.2 2.7v.1c-.8-2-2.2-2.8-3.3-4.5-.1-.1-.1-.2-.2-.3 0-.1 0-.1-.1-.1.1 0 .1 0 0 0-1.8 1.1-2.4 3.1-2.5 4.1-.8.1-1.6.4-2.2.9 0 0-.1.1-.1.1.2.3.5.5.8.7-.6.5-1 1.1-1.2 1.9v.1c0 .1 0 .2-.1.3-.2 1-.1 2 .3 3C6.8 14 10 15.5 13 14c2.6-1.3 3.3-4.4 1.8-6.7.4-.7.2-2 0-2.9z"/></svg>';
    if (b.includes('safari')) return '<svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M5.5 10.5l1.2-3.8 3.8-1.2-1.2 3.8z"/></svg>';
    if (b.includes('edge')) return '<svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M14.5 8.2c0-.1.1-.5.1-.8 0-3.1-2.6-7.4-7.6-7.4C3.1 0 0 3.6 0 7.4c0 0 .4-3.4 4.6-3.4 3.9 0 5.3 3 5.3 4.5 0 1.6-1.5 3-3.5 3-3.1 0-3.8-2-3.8-2s.7 3.5 4.7 3.5c2.3 0 4.2-1.1 5.4-2.7.8-1 1.5-2.3 1.8-3.7v1.6z"/></svg>';
    if (b.includes('opera')) return '<svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 2.6C4.2 3.7 3.3 5.7 3.3 8s.9 4.3 2.2 5.4c-3-1.2-5-4.2-5-7.4C.5 3.6 1.7 1.4 3.6.3c.7-.2 1.3-.3 2-.3-.1 0-.1.1-.1.1-1.5.5-2.5 1.5-2.5 1.5s1.3-1 2.5-1C7 .6 8 .8 8.8 1.3c-1.2-.1-2.4.4-3.3 1.3zm5 5.4c0-2.3-.9-4.3-2.2-5.4C9.5.6 11 .3 12.4.3c.7 0 1.4.1 2 .3C16.3 1.4 15.5 3.6 15.5 6c0 3.2-2 6.2-5 7.4 1.3-1.1 2.2-3.1 2.2-5.4z"/></svg>';
    if (b.includes('samsung')) return '<svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M4 8h8" stroke="currentColor" stroke-width="1.2"/></svg>';
    return '<svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="8" cy="8" r="1.5"/></svg>';
  }

  function renderSessionsTable() {
    const el = document.getElementById('sessions-table-container');
    if (!el) return;

    if (sessions.length === 0) {
      el.innerHTML = '<div class="text-center py-12 text-slate-500 text-sm">No sessions found</div>';
      return;
    }

    // Smartlook-style compact session rows
    const rowsHtml = sessions.map((s, i) => {
      const flag = s.country ? App.countryFlag(s.country) : '';
      const loc = s.city || (s.country || '');
      const d = new Date(s.startedAt);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' +
                      d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

      // UTM tags
      const utmTags = [];
      if (s.utmSource) utmTags.push(`source: ${s.utmSource}`);
      if (s.utmMedium) utmTags.push(`medium: ${s.utmMedium}`);
      if (s.utmCampaign) utmTags.push(`campaign: ${s.utmCampaign}`);

      return `
        <div class="group border-b border-slate-700/40 hover:bg-slate-800/60 transition-colors cursor-pointer ${i % 2 === 0 ? 'bg-slate-800/20' : ''}"
             onclick="App.navigate('sessions/${s.id}')">
          <div class="flex items-center gap-3 px-4 py-3">
            <!-- Avatar + visitor info -->
            <div class="flex items-center gap-3 min-w-[200px] max-w-[220px]">
              ${Components.avatarPlaceholder(s.email || s.visitorId)}
              <div class="min-w-0">
                <div class="text-xs text-slate-200 font-medium truncate">${s.email || s.visitorId}</div>
                ${s.name ? `<div class="text-[10px] text-slate-500 truncate">${s.name}</div>` : ''}
              </div>
            </div>

            <!-- Play button -->
            <a href="#sessions/${s.id}" onclick="event.stopPropagation()"
               class="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600/20 hover:bg-blue-600/40 flex items-center justify-center transition-colors" title="Play replay">
              <svg class="w-3.5 h-3.5 text-blue-400 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </a>

            <!-- Date -->
            <div class="flex items-center gap-1.5 min-w-[130px] text-slate-400">
              <svg class="w-3.5 h-3.5 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25"/></svg>
              <span class="text-xs">${dateStr}</span>
            </div>

            <!-- Pages -->
            <div class="flex items-center gap-1.5 min-w-[50px] text-slate-400" title="${s.pageViews} pages">
              <svg class="w-3.5 h-3.5 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>
              <span class="text-xs font-medium text-slate-300">${s.pageViews}</span>
            </div>

            <!-- Duration -->
            <div class="flex items-center gap-1.5 min-w-[65px] text-slate-400" title="Duration">
              <svg class="w-3.5 h-3.5 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <span class="text-xs font-mono text-slate-300">${App.formatDuration(s.duration)}</span>
            </div>

            <!-- Events -->
            <div class="flex items-center gap-1.5 min-w-[45px] text-slate-400" title="${s.eventCount} events">
              <svg class="w-3.5 h-3.5 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z"/></svg>
              <span class="text-xs font-medium text-slate-300">${s.eventCount}</span>
            </div>

            <!-- Spacer -->
            <div class="flex-1"></div>

            <!-- Flags (rage/error) -->
            ${s.rageClicks ? `<span class="inline-flex items-center gap-1 text-yellow-400 mr-1" title="${s.rageClicks} rage clicks">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672z"/></svg>
            </span>` : ''}
            ${s.errors ? `<span class="inline-flex items-center gap-1 text-red-400 mr-1" title="${s.errors} errors">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"/></svg>
            </span>` : ''}

            <!-- Device / OS / Browser icons -->
            <div class="flex items-center gap-2 text-slate-500" title="${s.device} / ${s.os} / ${s.browser}">
              <span>${_deviceIcon(s.device)}</span>
              <span>${_osIcon(s.os)}</span>
              <span>${_browserIcon(s.browser)}</span>
            </div>

            <!-- Country flag -->
            <span class="text-base ml-1" title="${loc}">${flag || '<span class="text-slate-600 text-xs">--</span>'}</span>
          </div>
          ${utmTags.length > 0 ? `
            <div class="flex items-center gap-2 px-4 pb-2 -mt-1">
              <span class="text-[10px] font-semibold text-slate-500 uppercase">UTM</span>
              ${utmTags.map(t => `<span class="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">${t}</span>`).join('')}
            </div>
          ` : ''}
        </div>`;
    }).join('');

    el.innerHTML = `
      <div class="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
        <!-- Header -->
        <div class="flex items-center gap-3 px-4 py-2.5 border-b border-slate-700/50 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
          <div class="min-w-[200px] max-w-[220px]">Visitor</div>
          <div class="w-8"></div>
          <div class="min-w-[130px]">Date</div>
          <div class="min-w-[50px]">Pages</div>
          <div class="min-w-[65px]">Duration</div>
          <div class="min-w-[45px]">Events</div>
          <div class="flex-1"></div>
          <div>Device</div>
          <div class="w-8 text-right">Loc</div>
        </div>
        ${rowsHtml}
      </div>`;
  }

  /* ------------------------------------------------------------------
     Filter actions
  ------------------------------------------------------------------ */
  function readFiltersFromDOM() {
    const get = (key) => {
      const el = document.getElementById(`filter-${key}`);
      if (!el) return undefined;
      if (el.type === 'checkbox') return el.checked;
      return el.value;
    };
    filters.dateFrom = get('dateFrom') || '';
    filters.dateTo = get('dateTo') || '';
    filters.durationMin = get('durationMin') || '';
    filters.durationMax = get('durationMax') || '';
    filters.browser = get('browser') || '';
    filters.os = get('os') || '';
    filters.device = get('device') || '';
    filters.url = get('url') || '';
    filters.hasRageClicks = !!get('hasRageClicks');
    filters.hasErrors = !!get('hasErrors');
    filters.email = get('email') || '';
    filters.utmSource = get('utmSource') || '';
    filters.utmMedium = get('utmMedium') || '';
    filters.utmCampaign = get('utmCampaign') || '';
  }

  function applyFilters() {
    readFiltersFromDOM();
    currentPage = 1;
    const container = document.getElementById('main-content');
    render(container);
  }

  function clearFilters() {
    filters = {
      dateFrom: '', dateTo: '', durationMin: '', durationMax: '',
      browser: '', os: '', device: '', url: '',
      hasRageClicks: false, hasErrors: false, email: '',
      utmSource: '', utmMedium: '', utmCampaign: '',
    };
    currentPage = 1;
    const container = document.getElementById('main-content');
    render(container);
  }

  function isActiveSegment(seg) {
    return JSON.stringify(seg.filters) === JSON.stringify(
      Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== '' && v !== false))
    );
  }

  function loadSegment(index) {
    const seg = savedSegments[index];
    if (!seg) return;
    // Reset all filters, then apply segment filters
    filters = {
      dateFrom: '', dateTo: '', durationMin: '', durationMax: '',
      browser: '', os: '', device: '', url: '',
      hasRageClicks: false, hasErrors: false, email: '',
      utmSource: '', utmMedium: '', utmCampaign: '',
      ...seg.filters,
    };
    currentPage = 1;
    const container = document.getElementById('main-content');
    render(container);
    Components.toast(`Loaded segment: ${seg.name}`, 'info');
  }

  function saveSegment() {
    readFiltersFromDOM();
    const activeFilters = Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== '' && v !== false));
    if (Object.keys(activeFilters).length === 0) {
      Components.toast('Apply some filters first before saving a segment', 'warning');
      return;
    }

    const inputClass = 'w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50';
    Components.showModal(
      'Save Segment',
      `<div>
         <label class="block text-xs font-medium text-slate-400 mb-1.5">Segment Name</label>
         <input type="text" id="segment-name-input" placeholder="My Custom Segment" class="${inputClass}" autofocus />
         <p class="text-xs text-slate-500 mt-2">Active filters: ${Object.keys(activeFilters).join(', ')}</p>
       </div>`,
      [{
        label: 'Save Segment',
        onClick: `SessionsPage.confirmSaveSegment()`,
      }]
    );
    setTimeout(() => {
      const inp = document.getElementById('segment-name-input');
      if (inp) inp.focus();
    }, 100);
  }

  function confirmSaveSegment() {
    const nameEl = document.getElementById('segment-name-input');
    const name = nameEl ? nameEl.value.trim() : '';
    if (!name) {
      Components.toast('Please enter a segment name', 'warning');
      return;
    }
    readFiltersFromDOM();
    const activeFilters = Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== '' && v !== false));
    savedSegments.push({ name, filters: activeFilters });
    Components.closeModal();
    Components.toast(`Segment "${name}" saved`, 'success');
    const container = document.getElementById('main-content');
    render(container);
  }

  function goToPage(page) {
    currentPage = page;
    const container = document.getElementById('main-content');
    render(container);
    // Scroll to top of content
    container.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ------------------------------------------------------------------
     Session Detail View
  ------------------------------------------------------------------ */
  async function renderDetail(container, sessionId) {
    let session;
    try {
      const result = await App.api(`/sessions/${sessionId}`);
      // API returns { session: {...}, events: [...] }
      const rawSession = result.session || result;
      session = mapSession(rawSession);
      session.events = result.events || [];
    } catch (_) {
      container.innerHTML = Components.emptyState('Session Not Found', 'Could not load this session. It may have been deleted.');
      return;
    }

    const s = session;

    // Extract visited pages from events
    const visitedPages = [];
    if (s.url) visitedPages.push(s.url);
    if (session.events && session.events.length) {
      for (const evt of session.events) {
        const t = evt.type;
        const d = typeof evt.data === 'string' ? JSON.parse(evt.data) : (evt.data || {});
        // PAGE_NAVIGATION (type 14): {from, to}
        if (t === 14 && d.to && !visitedPages.includes(d.to)) {
          visitedPages.push(d.to);
        }
        // SESSION_START (type 0): {url}
        if (t === 0 && d.url && !visitedPages.includes(d.url)) {
          visitedPages.push(d.url);
        }
      }
    }
    s.pages = visitedPages;

    container.innerHTML = `
      <div>
        <!-- Breadcrumb -->
        <div class="flex items-center gap-2 text-sm text-slate-400 mb-6">
          <a href="#sessions" class="hover:text-white transition-colors">Sessions</a>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/>
          </svg>
          <span class="text-white">${s.id}</span>
        </div>

        <!-- Header -->
        <div class="flex items-start justify-between mb-6">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white" style="background:hsl(${Math.abs([...(s.email||s.visitorId)].reduce((h,c)=>(h<<5)-h+c.charCodeAt(0),0))%360},50%,40%)">
              ${(s.email || s.visitorId || '?').substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 class="text-xl font-bold text-white">${s.email || s.visitorId}</h1>
              <div class="flex items-center gap-3 mt-1 text-sm text-slate-400">
                <span>${s.country ? App.countryFlag(s.country) + ' ' : ''}${s.city || 'Unknown'}</span>
                <span class="text-slate-600">|</span>
                <span>${s.device} - ${s.browser} ${s.browserVersion || ''}</span>
                <span class="text-slate-600">|</span>
                <span>${s.os}</span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            ${s.rageClicks ? Components.badge(`${s.rageClicks} rage clicks`, 'yellow') : ''}
            ${s.errors ? Components.badge(`${s.errors} errors`, 'red') : ''}
          </div>
        </div>

        <!-- Session Info Cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          ${Components.metricCard('Duration', App.formatDuration(s.duration), null,
            `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`)}
          ${Components.metricCard('Page Views', String(s.pageViews), null,
            `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`)}
          ${Components.metricCard('Started', App.formatDateTime(s.startedAt), null,
            `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/></svg>`)}
          ${Components.metricCard('Referrer', s.utmSource || 'Direct', null,
            `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"/></svg>`)}
        </div>

        <!-- Session Replay -->
        <div id="session-replay-container" class="mb-6" style="height: 680px;">
          <div class="bg-slate-800 rounded-xl border border-slate-700/50 h-full flex items-center justify-center">
            <div class="text-center">
              <div class="relative w-12 h-12 mx-auto mb-4">
                <div class="absolute inset-0 rounded-full border-2 border-slate-700"></div>
                <div class="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500 animate-spin"></div>
              </div>
              <p class="text-slate-400 text-sm">Loading session replay...</p>
              <p class="text-slate-600 text-xs mt-1">${s.eventCount} events</p>
            </div>
          </div>
        </div>

        <!-- Pages Visited -->
        <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5 mb-6">
          <h3 class="text-sm font-semibold text-white mb-3">Pages Visited</h3>
          <div class="space-y-2">
            ${s.pages.map((page, i) => `
              <div class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-700/30 transition-colors">
                <span class="flex-shrink-0 w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs text-slate-400 font-medium">${i + 1}</span>
                <span class="text-sm text-blue-400">${page}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- UTM Info -->
        ${s.utmSource || s.utmMedium || s.utmCampaign ? `
          <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
            <h3 class="text-sm font-semibold text-white mb-3">Campaign Attribution</h3>
            <div class="grid grid-cols-3 gap-4">
              <div>
                <span class="block text-xs text-slate-500 mb-1">Source</span>
                <span class="text-sm text-slate-300">${s.utmSource || '-'}</span>
              </div>
              <div>
                <span class="block text-xs text-slate-500 mb-1">Medium</span>
                <span class="text-sm text-slate-300">${s.utmMedium || '-'}</span>
              </div>
              <div>
                <span class="block text-xs text-slate-500 mb-1">Campaign</span>
                <span class="text-sm text-slate-300">${s.utmCampaign || '-'}</span>
              </div>
            </div>
          </div>
        ` : ''}
      </div>`;

    // Initialize the session replay player
    _initReplayPlayer(session);
  }

  /** Stored reference to current player instance (for cleanup). */
  let _currentPlayer = null;

  /**
   * Initialize the replay player with session events.
   */
  async function _initReplayPlayer(session) {
    const replayContainer = document.getElementById('session-replay-container');
    if (!replayContainer) return;

    try {
      // Fetch all events for this session (paginated — events API has limit 1000)
      let allEvents = session.events || [];

      // If events weren't pre-loaded, or there may be more, fetch them
      if (allEvents.length === 0) {
        const params = new URLSearchParams({ session_id: session.id, limit: 1000 });
        const result = await App.api(`/events?${params}`);
        allEvents = result.events || [];

        // If there are more pages, fetch them too
        if (result.pages > 1) {
          for (let p = 2; p <= result.pages; p++) {
            const moreParams = new URLSearchParams({ session_id: session.id, page: p, limit: 1000 });
            const moreResult = await App.api(`/events?${moreParams}`);
            allEvents = allEvents.concat(moreResult.events || []);
          }
        }
      }

      if (allEvents.length === 0) {
        replayContainer.innerHTML = `
          <div class="bg-slate-800 rounded-xl border border-slate-700/50 h-full flex items-center justify-center">
            <div class="text-center">
              <svg class="w-16 h-16 text-slate-700 mx-auto mb-3" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"/>
              </svg>
              <p class="text-slate-400 text-sm">No events recorded for this session</p>
              <p class="text-slate-600 text-xs mt-1">The replay cannot be reconstructed</p>
            </div>
          </div>`;
        return;
      }

      // Destroy previous player if any
      if (_currentPlayer) {
        try { _currentPlayer.destroy(); } catch (_) {}
        _currentPlayer = null;
      }

      // Create the player
      _currentPlayer = new SessionPlayer(replayContainer, allEvents, {
        session: session._raw || session,
        speed: 1,
        skipInactivity: true,
        inactivityThreshold: 3,
      });

    } catch (err) {
      console.error('[sessions] Replay player init failed:', err);
      replayContainer.innerHTML = `
        <div class="bg-slate-800 rounded-xl border border-slate-700/50 h-full flex items-center justify-center">
          <div class="text-center">
            <svg class="w-12 h-12 text-red-500/50 mx-auto mb-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
            </svg>
            <p class="text-slate-400 text-sm">Failed to load replay</p>
            <p class="text-slate-600 text-xs mt-1">${err.message || 'Unknown error'}</p>
          </div>
        </div>`;
    }
  }

  /* ------------------------------------------------------------------
     Public API
  ------------------------------------------------------------------ */
  return {
    render,
    renderDetail,
    applyFilters,
    clearFilters,
    loadSegment,
    saveSegment,
    confirmSaveSegment,
    goToPage,
  };

})();
