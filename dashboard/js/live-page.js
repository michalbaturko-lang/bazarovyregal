/* ==========================================================================
   live-page.js  -  Real-time Live Sessions View
   Shows currently active users with auto-refresh and live activity feed
   ========================================================================== */

const LivePage = (() => {

  /* ------------------------------------------------------------------
     Constants
  ------------------------------------------------------------------ */
  const POLL_INTERVAL = 5000; // 5 seconds
  const MAX_FEED_EVENTS = 50;

  const EVENT_TYPES = {
    SESSION_START: 0,
    DOM_SNAPSHOT: 1,
    DOM_MUTATION: 2,
    MOUSE_MOVE: 3,
    MOUSE_CLICK: 4,
    SCROLL: 5,
    INPUT: 6,
    RESIZE: 7,
    PAGE_NAVIGATION: 8,
    CONSOLE: 9,
    NETWORK: 10,
    ERROR: 11,
    RAGE_CLICK: 12,
    IDENTIFY: 13,
    CUSTOM_EVENT: 14,
  };

  const EVENT_TYPE_NAMES = {
    [EVENT_TYPES.SESSION_START]: 'Session Start',
    [EVENT_TYPES.MOUSE_CLICK]: 'Click',
    [EVENT_TYPES.PAGE_NAVIGATION]: 'Page View',
    [EVENT_TYPES.INPUT]: 'Input',
    [EVENT_TYPES.ERROR]: 'JS Error',
    [EVENT_TYPES.RAGE_CLICK]: 'Rage Click',
    [EVENT_TYPES.SCROLL]: 'Scroll',
    [EVENT_TYPES.CONSOLE]: 'Console',
    [EVENT_TYPES.NETWORK]: 'Network',
    [EVENT_TYPES.CUSTOM_EVENT]: 'Custom Event',
    [EVENT_TYPES.IDENTIFY]: 'Identify',
  };

  /* ------------------------------------------------------------------
     State
  ------------------------------------------------------------------ */
  let pollTimer = null;
  let durationTimers = [];
  let feedEvents = [];
  let isActive = false;
  let previousSessionIds = new Set();

  /* ------------------------------------------------------------------
     Country flag helper
  ------------------------------------------------------------------ */
  function countryFlag(code) {
    if (!code) return '';
    const c = code.toUpperCase();
    return String.fromCodePoint(...[...c].map(ch => 0x1F1E6 - 65 + ch.charCodeAt(0)));
  }

  /* ------------------------------------------------------------------
     Format event for feed display
  ------------------------------------------------------------------ */
  function formatEventForFeed(event) {
    const type = event.type;
    const data = event.data || {};
    const url = event.url || '';
    const shortUrl = url ? (url.length > 35 ? url.substring(0, 35) + '...' : url) : '';

    switch (type) {
      case EVENT_TYPES.MOUSE_CLICK: {
        const target = data.selector || data.tag || 'element';
        const text = data.text ? ` '${data.text.substring(0, 20)}'` : '';
        return {
          icon: '\uD83D\uDC46',
          text: `Click on${text || ' ' + target}`,
          detail: shortUrl ? ` - ${shortUrl}` : '',
          colorClass: 'text-blue-400',
          bgClass: 'bg-blue-500/10 border-blue-500/20',
        };
      }
      case EVENT_TYPES.PAGE_NAVIGATION:
        return {
          icon: '\uD83D\uDCC4',
          text: `Page view: ${data.url || shortUrl || 'unknown'}`,
          detail: '',
          colorClass: 'text-slate-300',
          bgClass: 'bg-slate-500/10 border-slate-500/20',
        };
      case EVENT_TYPES.ERROR: {
        const msg = data.message || 'Unknown error';
        const shortMsg = msg.length > 40 ? msg.substring(0, 40) + '...' : msg;
        return {
          icon: '\u274C',
          text: `JS Error: ${shortMsg}`,
          detail: shortUrl ? ` - ${shortUrl}` : '',
          colorClass: 'text-red-400',
          bgClass: 'bg-red-500/10 border-red-500/20',
        };
      }
      case EVENT_TYPES.RAGE_CLICK: {
        const target = data.selector || 'element';
        return {
          icon: '\uD83D\uDE21',
          text: `Rage click on ${target}`,
          detail: shortUrl ? ` - ${shortUrl}` : '',
          colorClass: 'text-orange-400',
          bgClass: 'bg-orange-500/10 border-orange-500/20',
        };
      }
      case EVENT_TYPES.INPUT: {
        const field = data.selector || data.type || 'field';
        return {
          icon: '\u2328\uFE0F',
          text: `Input on ${field}`,
          detail: shortUrl ? ` - ${shortUrl}` : '',
          colorClass: 'text-purple-400',
          bgClass: 'bg-purple-500/10 border-purple-500/20',
        };
      }
      case EVENT_TYPES.CUSTOM_EVENT: {
        const name = data.name || 'custom_event';
        return {
          icon: '\u2B50',
          text: `Event: ${name}`,
          detail: shortUrl ? ` - ${shortUrl}` : '',
          colorClass: 'text-yellow-400',
          bgClass: 'bg-yellow-500/10 border-yellow-500/20',
        };
      }
      case EVENT_TYPES.SESSION_START:
        return {
          icon: '\uD83D\uDE80',
          text: 'New session started',
          detail: shortUrl ? ` - ${shortUrl}` : '',
          colorClass: 'text-green-400',
          bgClass: 'bg-green-500/10 border-green-500/20',
        };
      case EVENT_TYPES.IDENTIFY:
        return {
          icon: '\uD83D\uDC64',
          text: `User identified: ${data.name || data.email || data.userId || 'unknown'}`,
          detail: '',
          colorClass: 'text-cyan-400',
          bgClass: 'bg-cyan-500/10 border-cyan-500/20',
        };
      default:
        return null; // Skip non-interesting events (mutations, mouse moves, scrolls, resizes)
    }
  }

  /* ------------------------------------------------------------------
     Format time for feed items
  ------------------------------------------------------------------ */
  function formatFeedTime(timestamp) {
    const d = new Date(typeof timestamp === 'number' ? timestamp : Date.parse(timestamp));
    const now = new Date();
    const diffMs = now - d;
    if (diffMs < 60000) return 'just now';
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  /* ------------------------------------------------------------------
     Compute live duration string
  ------------------------------------------------------------------ */
  function liveDuration(startedAt) {
    const start = new Date(startedAt).getTime();
    const now = Date.now();
    const seconds = Math.floor((now - start) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m < 60) return `${m}m ${s}s`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }

  /* ------------------------------------------------------------------
     Device icon helper
  ------------------------------------------------------------------ */
  function deviceIconSmall(type) {
    switch ((type || '').toLowerCase()) {
      case 'mobile':
        return '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"/></svg>';
      case 'tablet':
        return '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5h3m-6.75 2.25h10.5a2.25 2.25 0 002.25-2.25V4.5a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 4.5v15a2.25 2.25 0 002.25 2.25z"/></svg>';
      default:
        return '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z"/></svg>';
    }
  }

  /* ------------------------------------------------------------------
     Build session card HTML
  ------------------------------------------------------------------ */
  function sessionCard(session) {
    const name = session.identified_user_name || session.identified_user_email || session.visitor_id || 'Anonymous';
    const shortName = name.length > 20 ? name.substring(0, 20) + '...' : name;
    const pageUrl = session.url || '/';
    const shortUrl = pageUrl.length > 30 ? pageUrl.substring(0, 30) + '...' : pageUrl;
    const flag = countryFlag(session.country);
    const pages = session.page_count || 1;
    const browser = (session.browser || 'Unknown').split(' ')[0];

    // Avatar color from name hash
    const hue = Math.abs([...name].reduce((h, c) => (h << 5) - h + c.charCodeAt(0), 0)) % 360;
    const initials = name.split(/[\s@]/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';

    return `
      <div class="live-session-card bg-slate-800/60 rounded-xl border border-slate-700/50 p-4 hover:border-slate-600/50 hover:bg-slate-800/80 transition-all duration-200 cursor-pointer group"
           onclick="App.navigate('#sessions/${session.id}')">
        <div class="flex items-start gap-3">
          <!-- Avatar -->
          <div class="relative flex-shrink-0">
            <div class="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white" style="background:hsl(${hue},50%,40%)">${initials}</div>
            <div class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-slate-800 live-pulse-dot"></div>
          </div>
          <!-- Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-sm font-semibold text-white truncate">${shortName}</span>
              ${flag ? `<span class="text-sm">${flag}</span>` : ''}
            </div>
            <div class="text-xs text-slate-400 truncate mb-2" title="${pageUrl}">${shortUrl}</div>
            <div class="flex items-center gap-3 text-xs text-slate-500">
              <span class="flex items-center gap-1" title="${session.device_type || 'desktop'}">
                ${deviceIconSmall(session.device_type)}
              </span>
              <span title="${session.browser || ''}">${browser}</span>
              <span class="flex items-center gap-1">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>
                ${pages}
              </span>
            </div>
          </div>
          <!-- Duration -->
          <div class="text-right flex-shrink-0">
            <div class="text-xs font-medium text-green-400 live-duration" data-started="${session.started_at}">${liveDuration(session.started_at)}</div>
          </div>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------
     Build stats bar HTML
  ------------------------------------------------------------------ */
  function statsBar(stats) {
    return `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div class="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4 text-center">
          <div class="text-2xl font-bold text-white mb-1">${stats.active_count || 0}</div>
          <div class="text-xs text-slate-400 uppercase tracking-wider">Active Now</div>
        </div>
        <div class="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4 text-center">
          <div class="text-2xl font-bold text-blue-400 mb-1">${stats.unique_pages || 0}</div>
          <div class="text-xs text-slate-400 uppercase tracking-wider">Pages Viewed</div>
        </div>
        <div class="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4 text-center">
          <div class="text-2xl font-bold text-purple-400 mb-1">${App.formatDuration(stats.avg_duration || 0)}</div>
          <div class="text-xs text-slate-400 uppercase tracking-wider">Avg Duration</div>
        </div>
        <div class="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4 text-center">
          <div class="text-2xl font-bold text-orange-400 mb-1">${stats.events_per_minute || 0}</div>
          <div class="text-xs text-slate-400 uppercase tracking-wider">Events / min</div>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------
     Build location summary
  ------------------------------------------------------------------ */
  function locationSummary(countryBreakdown) {
    if (!countryBreakdown || Object.keys(countryBreakdown).length === 0) {
      return '<span class="text-slate-500 text-sm">No location data</span>';
    }
    return Object.entries(countryBreakdown)
      .sort((a, b) => b[1] - a[1])
      .map(([code, count]) => {
        const flag = countryFlag(code);
        return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-700/40 border border-slate-600/30 text-sm">
          <span>${flag}</span>
          <span class="text-slate-300 font-medium">${code}:</span>
          <span class="text-slate-400">${count} active</span>
        </span>`;
      }).join(' ');
  }

  /* ------------------------------------------------------------------
     Build feed event HTML
  ------------------------------------------------------------------ */
  function feedEventHTML(event) {
    const formatted = formatEventForFeed(event);
    if (!formatted) return '';

    const visitorName = event.identified_user_name || event.visitor_id || 'Visitor';
    const shortVisitor = visitorName.length > 15 ? visitorName.substring(0, 15) + '...' : visitorName;
    const timeStr = formatFeedTime(event.timestamp || event.created_at);

    return `
      <div class="live-feed-item flex items-start gap-3 px-3 py-2.5 rounded-lg border ${formatted.bgClass} transition-all duration-300"
           style="animation: liveSlideIn 0.3s ease-out both;">
        <span class="text-base flex-shrink-0 mt-0.5">${formatted.icon}</span>
        <div class="flex-1 min-w-0">
          <div class="text-sm ${formatted.colorClass}">
            ${formatted.text}<span class="text-slate-500">${formatted.detail}</span>
          </div>
          <div class="flex items-center gap-2 mt-0.5">
            <span class="text-[11px] text-slate-500">${shortVisitor}</span>
            <span class="text-[11px] text-slate-600">${timeStr}</span>
          </div>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------
     Render page structure
  ------------------------------------------------------------------ */
  function renderPageShell(container) {
    container.innerHTML = `
      <style>
        @keyframes livePulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
          50% { opacity: 0.8; box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
        }
        .live-pulse-dot {
          animation: livePulse 2s ease-in-out infinite;
        }
        @keyframes liveHeaderPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .live-header-dot {
          animation: liveHeaderPulse 1.5s ease-in-out infinite;
        }
        @keyframes liveSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .live-feed-item {
          animation: liveSlideIn 0.3s ease-out both;
        }
        .live-session-card {
          animation: fadeInUp 0.3s ease-out both;
        }
      </style>

      <div class="max-w-full">
        <!-- Header -->
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-3">
            <h2 class="text-lg font-semibold text-white">Live Sessions</h2>
            <div class="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">
              <div class="w-2.5 h-2.5 rounded-full bg-green-500 live-header-dot"></div>
              <span id="live-count-badge" class="text-sm font-medium text-green-400">0 active now</span>
            </div>
          </div>
          <div class="flex items-center gap-2 text-xs text-slate-500">
            <svg class="w-3.5 h-3.5 animate-spin" style="animation-duration:3s" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.182-3.182"/>
            </svg>
            <span>Auto-refresh every 5s</span>
          </div>
        </div>

        <!-- Stats Bar -->
        <div id="live-stats-bar">
          ${statsBar({ active_count: 0, unique_pages: 0, avg_duration: 0, events_per_minute: 0 })}
        </div>

        <!-- Location summary -->
        <div class="mb-6">
          <div class="bg-slate-800/40 rounded-xl border border-slate-700/40 px-5 py-3">
            <div class="flex items-center gap-2 mb-2">
              <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/>
              </svg>
              <span class="text-xs font-medium text-slate-400 uppercase tracking-wider">Visitor Locations</span>
            </div>
            <div id="live-location-summary" class="flex flex-wrap gap-2">
              <span class="text-slate-500 text-sm">Loading...</span>
            </div>
          </div>
        </div>

        <!-- Main content: Grid + Feed -->
        <div class="flex gap-6">
          <!-- Sessions Grid -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-sm font-semibold text-slate-300 uppercase tracking-wider">Active Sessions</h3>
              <span id="live-session-count" class="text-xs text-slate-500">0 sessions</span>
            </div>
            <div id="live-sessions-grid" class="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div class="col-span-full text-center py-12 text-slate-500">
                <div class="relative w-8 h-8 mx-auto mb-3">
                  <div class="absolute inset-0 rounded-full border-2 border-slate-700"></div>
                  <div class="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500 animate-spin"></div>
                </div>
                Loading live sessions...
              </div>
            </div>
          </div>

          <!-- Live Activity Feed (Sidebar) -->
          <div class="w-80 flex-shrink-0 hidden xl:block">
            <div class="sticky top-20">
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-sm font-semibold text-slate-300 uppercase tracking-wider">Activity Feed</h3>
                <span class="text-[11px] text-slate-500">Last 5 min</span>
              </div>
              <div id="live-feed-container" class="bg-slate-800/30 rounded-xl border border-slate-700/40 overflow-hidden" style="max-height: calc(100vh - 320px);">
                <div id="live-feed-list" class="space-y-1 p-2 overflow-y-auto" style="max-height: calc(100vh - 340px);">
                  <div class="text-center py-8 text-slate-500 text-sm">
                    Waiting for events...
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------
     Update sessions grid (with diff to avoid full re-render flicker)
  ------------------------------------------------------------------ */
  function updateSessionsGrid(sessions) {
    const grid = document.getElementById('live-sessions-grid');
    if (!grid) return;

    if (!sessions || sessions.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full flex flex-col items-center justify-center py-16 text-center">
          <svg class="w-12 h-12 text-slate-600 mb-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"/>
          </svg>
          <h3 class="text-lg font-semibold text-slate-300 mb-2">No Active Sessions</h3>
          <p class="text-sm text-slate-500 max-w-sm">There are no active sessions right now. Sessions will appear here when visitors are browsing your site.</p>
        </div>`;
      return;
    }

    // Check which sessions are new
    const currentIds = new Set(sessions.map(s => s.id));
    const newIds = new Set();
    sessions.forEach(s => {
      if (!previousSessionIds.has(s.id)) newIds.add(s.id);
    });

    // Rebuild the grid
    grid.innerHTML = sessions.map((s, i) => {
      const card = sessionCard(s);
      const isNew = newIds.has(s.id);
      // Add stagger delay for new cards
      return isNew
        ? card.replace('live-session-card', `live-session-card stagger-${Math.min(i + 1, 10)}`)
        : card;
    }).join('');

    previousSessionIds = currentIds;
  }

  /* ------------------------------------------------------------------
     Update feed
  ------------------------------------------------------------------ */
  function updateFeed(newEvents) {
    const feedList = document.getElementById('live-feed-list');
    if (!feedList) return;

    // Filter to only interesting event types
    const interestingTypes = new Set([
      EVENT_TYPES.SESSION_START,
      EVENT_TYPES.MOUSE_CLICK,
      EVENT_TYPES.PAGE_NAVIGATION,
      EVENT_TYPES.INPUT,
      EVENT_TYPES.ERROR,
      EVENT_TYPES.RAGE_CLICK,
      EVENT_TYPES.CUSTOM_EVENT,
      EVENT_TYPES.IDENTIFY,
    ]);

    const filtered = (newEvents || []).filter(e => interestingTypes.has(e.type));

    if (filtered.length === 0 && feedEvents.length === 0) {
      feedList.innerHTML = `
        <div class="text-center py-8 text-slate-500 text-sm">
          Waiting for events...
        </div>`;
      return;
    }

    // Merge new events (deduplicate by id)
    const existingIds = new Set(feedEvents.map(e => e.id));
    const trulyNew = filtered.filter(e => !existingIds.has(e.id));
    feedEvents = [...trulyNew, ...feedEvents].slice(0, MAX_FEED_EVENTS);

    // Render feed
    const html = feedEvents.map(e => feedEventHTML(e)).filter(Boolean).join('');
    if (html) {
      feedList.innerHTML = html;
    }
  }

  /* ------------------------------------------------------------------
     Update duration counters
  ------------------------------------------------------------------ */
  function startDurationUpdater() {
    // Clear any existing timers
    durationTimers.forEach(t => clearInterval(t));
    durationTimers = [];

    const timer = setInterval(() => {
      const els = document.querySelectorAll('.live-duration');
      els.forEach(el => {
        const started = el.getAttribute('data-started');
        if (started) {
          el.textContent = liveDuration(started);
        }
      });
    }, 1000);

    durationTimers.push(timer);
  }

  /* ------------------------------------------------------------------
     Fetch and update data
  ------------------------------------------------------------------ */
  async function fetchLiveData() {
    if (!isActive) return;

    try {
      // Fetch live sessions and recent events in parallel
      const [liveData, eventsData] = await Promise.all([
        App.api('/dashboard/live?project_id=' + App.state.project),
        App.api('/events/recent?project_id=' + App.state.project + '&minutes=5&limit=50'),
      ]);

      if (!isActive) return; // Check again after async

      // Update count badge
      const countBadge = document.getElementById('live-count-badge');
      if (countBadge) {
        const count = liveData.count || 0;
        countBadge.textContent = `${count} active now`;
      }

      // Update stats bar
      const statsBarEl = document.getElementById('live-stats-bar');
      if (statsBarEl && liveData.stats) {
        statsBarEl.innerHTML = statsBar(liveData.stats);
      }

      // Update location summary
      const locEl = document.getElementById('live-location-summary');
      if (locEl && liveData.stats) {
        locEl.innerHTML = locationSummary(liveData.stats.country_breakdown || {});
      }

      // Update session count label
      const sessionCountEl = document.getElementById('live-session-count');
      if (sessionCountEl) {
        sessionCountEl.textContent = `${(liveData.active_sessions || []).length} sessions`;
      }

      // Update sessions grid
      updateSessionsGrid(liveData.active_sessions || []);

      // Update activity feed
      updateFeed(eventsData.events || []);

    } catch (err) {
      // On error, show a subtle message but keep polling
      console.warn('[LivePage] Fetch error:', err.message);
    }
  }

  /* ------------------------------------------------------------------
     Start / Stop polling
  ------------------------------------------------------------------ */
  function startPolling() {
    stopPolling();
    pollTimer = setInterval(fetchLiveData, POLL_INTERVAL);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    durationTimers.forEach(t => clearInterval(t));
    durationTimers = [];
  }

  /* ------------------------------------------------------------------
     Main render entry point
  ------------------------------------------------------------------ */
  async function render(container) {
    isActive = true;
    feedEvents = [];
    previousSessionIds = new Set();

    renderPageShell(container);
    startDurationUpdater();

    // Initial fetch
    await fetchLiveData();

    // Start auto-refresh
    startPolling();
  }

  /* ------------------------------------------------------------------
     Cleanup (called when navigating away)
  ------------------------------------------------------------------ */
  function destroy() {
    isActive = false;
    stopPolling();
    feedEvents = [];
    previousSessionIds = new Set();
  }

  /* ------------------------------------------------------------------
     Public API
  ------------------------------------------------------------------ */
  return {
    render,
    destroy,
  };

})();
