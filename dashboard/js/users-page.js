/* ==========================================================================
   users-page.js  -  Identified Users list & detail pages
   ========================================================================== */

const UsersPage = (() => {

  /* ------------------------------------------------------------------
     State
  ------------------------------------------------------------------ */
  let users = [];
  let totalCount = 0;
  let currentPage = 1;
  const pageSize = 50;
  let searchQuery = '';

  /* ------------------------------------------------------------------
     Mock data for fallback
  ------------------------------------------------------------------ */
  function generateMockUsers(count) {
    const firstNames = ['Jan', 'Petr', 'Eva', 'Marie', 'Tom', 'Anna', 'David', 'Lucie', 'Martin', 'Klara', 'Alice', 'Bob', 'Carol', 'Frank', 'Grace'];
    const lastNames = ['Novak', 'Svoboda', 'Dvorak', 'Cerny', 'Kral', 'Nemec', 'Marek', 'Vesely', 'Horak', 'Pokorny'];
    const devices = ['Desktop', 'Mobile', 'Tablet'];

    function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

    return Array.from({ length: count }, (_, i) => {
      const fn = rand(firstNames);
      const ln = rand(lastNames);
      const totalSessions = randInt(1, 45);
      const totalDuration = totalSessions * randInt(30, 600);
      return {
        id: 'user_' + (i + 1),
        name: `${fn} ${ln}`,
        email: `${fn.toLowerCase()}.${ln.toLowerCase()}@email.cz`,
        total_sessions: totalSessions,
        last_seen: new Date(Date.now() - randInt(0, 14) * 86400000).toISOString(),
        first_seen: new Date(Date.now() - randInt(14, 90) * 86400000).toISOString(),
        total_duration: totalDuration,
        device: rand(devices),
      };
    });
  }

  /* ------------------------------------------------------------------
     Data fetching
  ------------------------------------------------------------------ */
  async function fetchUsers() {
    try {
      const params = new URLSearchParams({
        project_id: 'default',
        page: currentPage,
        limit: pageSize,
      });
      if (searchQuery) params.set('search', searchQuery);

      const result = await App.api(`/users?${params}`);
      users = result.users || [];
      totalCount = result.total || 0;
    } catch (_) {
      // Fallback to mock
      let allUsers = generateMockUsers(78);
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        allUsers = allUsers.filter(u =>
          (u.name && u.name.toLowerCase().includes(q)) ||
          (u.email && u.email.toLowerCase().includes(q))
        );
      }
      totalCount = allUsers.length;
      const start = (currentPage - 1) * pageSize;
      users = allUsers.slice(start, start + pageSize);
    }
  }

  async function fetchUserDetail(userId) {
    try {
      const result = await App.api(`/users/${encodeURIComponent(userId)}`);
      return result;
    } catch (_) {
      // Mock detail
      const mockUsers = generateMockUsers(78);
      const user = mockUsers.find(u => u.id === userId) || mockUsers[0];
      const sessions = App.Mock.generateSessions(user.total_sessions || 5, 30);
      return {
        user,
        sessions: sessions.map(s => ({
          ...s,
          identified_user_id: userId,
          identified_user_email: user.email,
          identified_user_name: user.name,
        })),
      };
    }
  }

  async function fetchUserEvents(userId) {
    try {
      const result = await App.api(`/users/${encodeURIComponent(userId)}/events`);
      return result.events || [];
    } catch (_) {
      return [];
    }
  }

  /* ------------------------------------------------------------------
     Render: User List
  ------------------------------------------------------------------ */
  async function render(container) {
    container.innerHTML = Components.loading();
    await fetchUsers();

    const totalPages = Math.ceil(totalCount / pageSize);

    container.innerHTML = `
      <div>
        ${Components.sectionHeader('Identified Users', `Users who have been identified via the tracking API`)}

        <!-- Search Bar -->
        <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-4 mb-6">
          <div class="flex items-center gap-3">
            <div class="flex-1 relative">
              <svg class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/>
              </svg>
              <input type="text" id="users-search" value="${escapeAttr(searchQuery)}"
                     placeholder="Search by name or email..."
                     class="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                     onkeydown="if(event.key==='Enter')UsersPage.applySearch()" />
            </div>
            <button onclick="UsersPage.applySearch()"
                    class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/>
              </svg>
              Search
            </button>
            ${searchQuery ? `
              <button onclick="UsersPage.clearSearch()"
                      class="text-slate-400 hover:text-white px-3 py-2.5 rounded-lg text-sm transition-colors">
                Clear
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Summary -->
        <div class="flex items-center gap-6 mb-4 text-sm">
          <span class="text-slate-400">
            <span class="text-white font-semibold">${App.formatNumber(totalCount)}</span> identified users
          </span>
          <span class="text-slate-600">|</span>
          <span class="text-slate-400">
            Page ${currentPage} of ${totalPages || 1}
          </span>
        </div>

        <!-- Users Table -->
        <div id="users-table-container"></div>

        <!-- Pagination -->
        <div id="users-pagination"></div>
      </div>`;

    renderUsersTable();
    document.getElementById('users-pagination').innerHTML =
      Components.pagination(currentPage, totalPages, 'UsersPage.goToPage');
  }

  function renderUsersTable() {
    const el = document.getElementById('users-table-container');
    if (!el) return;

    const headers = [
      { key: 'avatar', label: '', width: '48px' },
      { key: 'name', label: 'Name', sortable: true },
      { key: 'email', label: 'Email', sortable: true },
      { key: 'sessions', label: 'Sessions', align: 'center', sortable: true },
      { key: 'lastSeen', label: 'Last Seen', sortable: true },
      { key: 'totalTime', label: 'Total Time', sortable: true },
      { key: 'device', label: 'Device' },
    ];

    const rows = users.map(u => ({
      id: u.id,
      onClick: `App.navigate('users/${encodeURIComponent(u.id)}')`,
      cells: {
        avatar: Components.avatarPlaceholder(u.name || u.email || u.id),
        name: `<span class="text-sm font-medium text-slate-200">${escapeHtml(u.name || '--')}</span>`,
        email: `<span class="text-sm text-blue-400">${escapeHtml(u.email || '--')}</span>`,
        sessions: `<span class="text-sm font-medium text-white">${u.total_sessions || 0}</span>`,
        lastSeen: `<span class="text-sm text-slate-400">${u.last_seen ? Components.timeAgo(u.last_seen) : '--'}</span>`,
        totalTime: `<span class="text-sm text-slate-300 font-mono text-xs">${App.formatDuration(u.total_duration)}</span>`,
        device: `<div class="flex items-center gap-1.5 text-slate-400">
                   <span title="${escapeAttr(u.device || 'Desktop')}">${Components.deviceIcon(u.device || 'Desktop')}</span>
                   <span class="text-xs">${escapeHtml(u.device || 'Desktop')}</span>
                 </div>`,
      },
    }));

    if (rows.length === 0 && searchQuery) {
      el.innerHTML = Components.emptyState(
        'No users found',
        `No users matching "${escapeHtml(searchQuery)}". Try a different search term.`,
        `<svg class="w-12 h-12 text-slate-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/>
        </svg>`
      );
    } else if (rows.length === 0) {
      el.innerHTML = Components.emptyState(
        'No Identified Users',
        'Users will appear here once they are identified via the RegalMasterLook.identify() API.',
        `<svg class="w-12 h-12 text-slate-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/>
        </svg>`
      );
    } else {
      el.innerHTML = Components.dataTable(headers, rows, { hoverable: true, striped: true });
    }
  }

  /* ------------------------------------------------------------------
     Render: User Detail
  ------------------------------------------------------------------ */
  async function renderDetail(container, userId) {
    container.innerHTML = Components.loading();

    const data = await fetchUserDetail(userId);
    const user = data.user || {};
    const sessions = data.sessions || [];

    // Compute activity summary
    const pageVisits = {};
    let totalEvents = 0;
    let rageClickCount = 0;

    sessions.forEach(s => {
      if (s.pages && Array.isArray(s.pages)) {
        s.pages.forEach(p => {
          pageVisits[p] = (pageVisits[p] || 0) + 1;
        });
      }
      totalEvents += (s.event_count || s.pageViews || 0);
      rageClickCount += (s.rage_clicks || s.rageClicks || 0);
    });

    const topPages = Object.entries(pageVisits)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const totalDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const firstSeen = sessions.length
      ? sessions.reduce((min, s) => {
          const d = new Date(s.started_at || s.startedAt);
          return d < min ? d : min;
        }, new Date())
      : null;
    const lastSeen = sessions.length
      ? sessions.reduce((max, s) => {
          const d = new Date(s.started_at || s.startedAt);
          return d > max ? d : max;
        }, new Date(0))
      : null;

    container.innerHTML = `
      <div>
        <!-- Breadcrumb -->
        <div class="flex items-center gap-2 text-sm text-slate-400 mb-6">
          <a href="#users" class="hover:text-white transition-colors">Users</a>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/>
          </svg>
          <span class="text-white">${escapeHtml(user.name || user.email || userId)}</span>
        </div>

        <!-- User Profile Header -->
        <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-6 mb-6">
          <div class="flex items-start gap-4">
            <div class="flex-shrink-0">
              ${avatarLarge(user.name || user.email || userId)}
            </div>
            <div class="flex-1 min-w-0">
              <h1 class="text-xl font-bold text-white">${escapeHtml(user.name || '--')}</h1>
              <p class="text-sm text-blue-400 mt-0.5">${escapeHtml(user.email || '--')}</p>
              <div class="flex items-center gap-4 mt-3 text-sm text-slate-400">
                <span>ID: <code class="text-xs bg-slate-700 px-1.5 py-0.5 rounded text-slate-300">${escapeHtml(userId)}</code></span>
              </div>
            </div>
          </div>

          <!-- User Stats -->
          <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
            <div class="bg-slate-900 rounded-lg p-3 text-center">
              <div class="text-lg font-bold text-white">${sessions.length}</div>
              <div class="text-xs text-slate-400">Total Sessions</div>
            </div>
            <div class="bg-slate-900 rounded-lg p-3 text-center">
              <div class="text-lg font-bold text-white">${App.formatDuration(totalDuration)}</div>
              <div class="text-xs text-slate-400">Total Time</div>
            </div>
            <div class="bg-slate-900 rounded-lg p-3 text-center">
              <div class="text-lg font-bold text-white">${App.formatNumber(totalEvents)}</div>
              <div class="text-xs text-slate-400">Total Events</div>
            </div>
            <div class="bg-slate-900 rounded-lg p-3 text-center">
              <div class="text-lg font-bold text-white">${firstSeen ? App.formatDate(firstSeen) : '--'}</div>
              <div class="text-xs text-slate-400">First Seen</div>
            </div>
            <div class="bg-slate-900 rounded-lg p-3 text-center">
              <div class="text-lg font-bold text-white">${lastSeen ? Components.timeAgo(lastSeen) : '--'}</div>
              <div class="text-xs text-slate-400">Last Seen</div>
            </div>
          </div>
        </div>

        <!-- Activity Summary -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <!-- Top Pages -->
          <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
            <h3 class="text-sm font-semibold text-white mb-3">Most Visited Pages</h3>
            ${topPages.length > 0 ? `
              <div class="space-y-2">
                ${topPages.map(([url, count]) => `
                  <div class="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-700/30 transition-colors">
                    <span class="text-sm text-blue-400 truncate mr-3">${escapeHtml(url)}</span>
                    <span class="text-xs text-slate-400 font-medium flex-shrink-0">${count} visits</span>
                  </div>
                `).join('')}
              </div>
            ` : '<p class="text-sm text-slate-500">No page data available</p>'}
          </div>

          <!-- Activity Summary -->
          <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
            <h3 class="text-sm font-semibold text-white mb-3">Activity Summary</h3>
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-sm text-slate-400">Total events</span>
                <span class="text-sm font-medium text-white">${App.formatNumber(totalEvents)}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm text-slate-400">Rage clicks</span>
                <span class="text-sm font-medium ${rageClickCount > 0 ? 'text-yellow-400' : 'text-white'}">${rageClickCount}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm text-slate-400">Avg session duration</span>
                <span class="text-sm font-medium text-white">${sessions.length ? App.formatDuration(Math.round(totalDuration / sessions.length)) : '--'}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm text-slate-400">Avg pages per session</span>
                <span class="text-sm font-medium text-white">${sessions.length ? Math.round(Object.values(pageVisits).reduce((s, v) => s + v, 0) / sessions.length) : '--'}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Session Timeline -->
        <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
          <h3 class="text-sm font-semibold text-white mb-4">Session Timeline</h3>
          ${sessions.length > 0 ? `
            <div class="space-y-3">
              ${sessions.sort((a, b) => new Date(b.started_at || b.startedAt) - new Date(a.started_at || a.startedAt)).map(s => {
                const sessionId = s.id;
                const startedAt = s.started_at || s.startedAt;
                const duration = s.duration || 0;
                const pageCount = s.page_count || s.pageViews || 0;
                const device = s.device_type || s.device || 'Desktop';
                const browser = s.browser || '';
                const rageClicks = s.rage_clicks || s.rageClicks || 0;
                const errors = s.error_count || s.errors || 0;
                const entryUrl = s.entry_url || (s.pages && s.pages[0]) || '/';

                return `
                  <a href="#sessions/${sessionId}"
                     class="flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-slate-700/40 transition-colors border border-transparent hover:border-slate-600/30 group">
                    <!-- Timeline dot -->
                    <div class="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-blue-500/10"></div>

                    <!-- Session info -->
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 text-sm">
                        <span class="font-medium text-slate-200">${App.formatDateTime(startedAt)}</span>
                        <span class="text-slate-600">-</span>
                        <span class="text-slate-400 font-mono text-xs">${App.formatDuration(duration)}</span>
                      </div>
                      <div class="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        <span>${pageCount} pages</span>
                        <span class="text-slate-700">|</span>
                        <span class="truncate">${escapeHtml(entryUrl)}</span>
                      </div>
                    </div>

                    <!-- Device & flags -->
                    <div class="flex items-center gap-3 flex-shrink-0">
                      <div class="flex items-center gap-1.5 text-slate-500">
                        ${Components.deviceIcon(device)}
                        ${Components.browserIcon(browser)}
                      </div>
                      ${rageClicks > 0 ? `<span class="inline-flex items-center gap-1 text-yellow-400 text-xs">${rageClicks} rage</span>` : ''}
                      ${errors > 0 ? `<span class="inline-flex items-center gap-1 text-red-400 text-xs">${errors} err</span>` : ''}
                      <svg class="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/>
                      </svg>
                    </div>
                  </a>`;
              }).join('')}
            </div>
          ` : Components.emptyState('No Sessions', 'This user has no recorded sessions yet.')}
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------
     Search & Pagination
  ------------------------------------------------------------------ */
  function applySearch() {
    const el = document.getElementById('users-search');
    searchQuery = el ? el.value.trim() : '';
    currentPage = 1;
    const container = document.getElementById('main-content');
    render(container);
  }

  function clearSearch() {
    searchQuery = '';
    currentPage = 1;
    const container = document.getElementById('main-content');
    render(container);
  }

  function goToPage(page) {
    currentPage = page;
    const container = document.getElementById('main-content');
    render(container);
    container.scrollTo({ top: 0, behavior: 'smooth' });
  }

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

  function avatarLarge(name) {
    const initials = (name || '?').split(/[\s@]/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
    const hue = Math.abs([...name || ''].reduce((h, c) => (h << 5) - h + c.charCodeAt(0), 0)) % 360;
    return `<div class="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white" style="background:hsl(${hue},50%,40%)">${initials}</div>`;
  }

  /* ------------------------------------------------------------------
     Public API
  ------------------------------------------------------------------ */
  return {
    render,
    renderDetail,
    applySearch,
    clearSearch,
    goToPage,
  };

})();
