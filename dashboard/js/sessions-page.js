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
      const params = new URLSearchParams({ page: currentPage, limit: pageSize, ...filters });
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

  function renderSessionsTable() {
    const el = document.getElementById('sessions-table-container');
    if (!el) return;

    const headers = [
      { key: 'visitor', label: 'Visitor', width: '22%', sortable: true },
      { key: 'location', label: 'Location', sortable: true },
      { key: 'pages', label: 'Pages', align: 'center', sortable: true },
      { key: 'duration', label: 'Duration', sortable: true },
      { key: 'device', label: 'Device' },
      { key: 'started', label: 'Started', sortable: true },
      { key: 'flags', label: '', align: 'right', width: '70px' },
    ];

    const rows = sessions.map(s => ({
      id: s.id,
      onClick: `App.navigate('sessions/${s.id}')`,
      cells: {
        visitor: `<div class="flex items-center gap-2.5">
                    ${Components.avatarPlaceholder(s.email || s.visitorId)}
                    <div>
                      <div class="text-sm font-medium text-slate-200 truncate max-w-[160px]">${s.email || s.visitorId}</div>
                      ${s.name ? `<div class="text-xs text-slate-500">${s.name}</div>` : ''}
                    </div>
                  </div>`,
        location: `<div class="text-sm">
                     <span>${s.country ? App.countryFlag(s.country) : ''} ${s.city || 'Unknown'}</span>
                   </div>`,
        pages: `<span class="text-slate-300">${s.pageViews}</span>`,
        duration: `<span class="text-slate-300 font-mono text-xs">${App.formatDuration(s.duration)}</span>`,
        device: `<div class="flex items-center gap-2 text-slate-400">
                   <span title="${s.device}">${Components.deviceIcon(s.device)}</span>
                   ${Components.browserIcon(s.browser)}
                   <span class="text-xs text-slate-500">${s.os}</span>
                 </div>`,
        started: `<span class="text-slate-400 text-sm">${Components.timeAgo(s.startedAt)}</span>`,
        flags: `<div class="flex items-center gap-1.5">
                  ${s.rageClicks ? `<span class="inline-flex items-center gap-1 text-yellow-400" title="${s.rageClicks} rage clicks">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59"/></svg>
                    <span class="text-xs font-medium">${s.rageClicks}</span>
                  </span>` : ''}
                  ${s.errors ? `<span class="inline-flex items-center gap-1 text-red-400" title="${s.errors} errors">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
                    <span class="text-xs font-medium">${s.errors}</span>
                  </span>` : ''}
                </div>`,
      },
    }));

    el.innerHTML = Components.dataTable(headers, rows, { hoverable: true, striped: true });
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

        <!-- Session Replay Placeholder -->
        <div class="bg-slate-800 rounded-xl border border-slate-700/50 mb-6 overflow-hidden">
          <div class="px-5 py-3 border-b border-slate-700/50 flex items-center justify-between">
            <h3 class="text-sm font-semibold text-white flex items-center gap-2">
              <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"/>
              </svg>
              Session Replay
            </h3>
            <div class="flex items-center gap-2">
              <span class="text-xs text-slate-500">${App.formatDuration(s.duration)}</span>
              <button class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"/>
                </svg>
                Play
              </button>
            </div>
          </div>
          <div class="aspect-video bg-slate-900 flex items-center justify-center">
            <div class="text-center">
              <svg class="w-16 h-16 text-slate-700 mx-auto mb-3" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"/>
              </svg>
              <p class="text-slate-500 text-sm">Click play to start session replay</p>
            </div>
          </div>
          <!-- Playback timeline -->
          <div class="px-5 py-3 border-t border-slate-700/50">
            <div class="h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div class="h-full w-0 bg-blue-500 rounded-full"></div>
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
