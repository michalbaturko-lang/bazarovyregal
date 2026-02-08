/* ==========================================================================
   app.js  -  Main application controller
   Router, state management, API helpers, format helpers
   ========================================================================== */

const App = (() => {

  /* ------------------------------------------------------------------
     State
  ------------------------------------------------------------------ */
  const state = {
    currentPage: 'dashboard',
    currentParams: {},
    dateRange: {
      start: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
      end: new Date().toISOString().slice(0, 10),
    },
    project: 'default',
    filters: {},
    chartInstances: {},
  };

  /* ------------------------------------------------------------------
     Route definitions
  ------------------------------------------------------------------ */
  const routes = [
    { pattern: /^#?dashboard$/,      page: 'dashboard',      params: [] },
    { pattern: /^#?sessions\/(.+)$/, page: 'session-detail', params: ['id'] },
    { pattern: /^#?sessions$/,       page: 'sessions',       params: [] },
    { pattern: /^#?funnels\/(.+)$/,  page: 'funnel-detail',  params: ['id'] },
    { pattern: /^#?funnels$/,        page: 'funnels',        params: [] },
    { pattern: /^#?journeys$/,        page: 'journeys',       params: [] },
    { pattern: /^#?heatmaps$/,       page: 'heatmaps',       params: [] },
    { pattern: /^#?ecommerce$/,     page: 'ecommerce',      params: [] },
    { pattern: /^#?behavioral$/,     page: 'behavioral',     params: [] },
    { pattern: /^#?insights$/,       page: 'insights',       params: [] },
    { pattern: /^#?forms$/,          page: 'forms',          params: [] },
    { pattern: /^#?errors$/,         page: 'errors',         params: [] },
    { pattern: /^#?performance$/,    page: 'performance',    params: [] },
    { pattern: /^#?scrolldepth$/,    page: 'scrolldepth',    params: [] },
    { pattern: /^#?comparison$/,     page: 'comparison',     params: [] },
    { pattern: /^#?webhooks$/,       page: 'webhooks',       params: [] },
    { pattern: /^#?reports$/,        page: 'reports',        params: [] },
    { pattern: /^#?apikeys$/,        page: 'apikeys',        params: [] },
    { pattern: /^#?billing$/,        page: 'billing',        params: [] },
    { pattern: /^#?revenue$/,        page: 'revenue',        params: [] },
    { pattern: /^#?retention$/,      page: 'retention',      params: [] },
    { pattern: /^#?alerts$/,         page: 'alerts',         params: [] },
    { pattern: /^#?tags$/,           page: 'tags',           params: [] },
    { pattern: /^#?surveys$/,        page: 'surveys',        params: [] },
    { pattern: /^#?goals$/,          page: 'goals',          params: [] },
    { pattern: /^#?live$/,           page: 'live',           params: [] },
    { pattern: /^#?settings$/,       page: 'settings',       params: [] },
  ];

  /* ------------------------------------------------------------------
     Router
  ------------------------------------------------------------------ */
  function parseHash() {
    const hash = (window.location.hash || '#dashboard').replace(/^#\/?/, '');
    for (const route of routes) {
      const match = hash.match(route.pattern);
      if (match) {
        const params = {};
        route.params.forEach((key, i) => { params[key] = match[i + 1]; });
        return { page: route.page, params };
      }
    }
    return { page: 'dashboard', params: {} };
  }

  function navigate(hash) {
    window.location.hash = hash;
  }

  function handleRouteChange() {
    const { page, params } = parseHash();
    state.currentPage = page;
    state.currentParams = params;

    // Destroy existing Chart.js instances to prevent canvas reuse errors
    Object.values(state.chartInstances).forEach(c => { try { c.destroy(); } catch(_){} });
    state.chartInstances = {};

    // Destroy active SessionPlayer if navigating away from session detail
    if (window._activeSessionPlayer) {
      try { window._activeSessionPlayer.destroy(); } catch (_) {}
      window._activeSessionPlayer = null;
    }

    // Update active sidebar link
    document.querySelectorAll('[data-nav]').forEach(el => {
      const navTarget = el.getAttribute('data-nav');
      const isActive = page === navTarget || page.startsWith(navTarget.replace(/s$/, ''));
      el.classList.toggle('bg-slate-700/50', isActive);
      el.classList.toggle('text-white', isActive);
      el.classList.toggle('text-slate-400', !isActive);
    });

    const container = document.getElementById('main-content');
    if (!container) return;
    container.innerHTML = Components.loading();

    // Route to page renderer
    switch (page) {
      case 'dashboard':
        DashboardPage.render(container);
        break;
      case 'sessions':
        SessionsPage.render(container);
        break;
      case 'session-detail':
        SessionsPage.renderDetail(container, params.id);
        break;
      case 'funnels':
        FunnelsPage.render(container);
        break;
      case 'funnel-detail':
        FunnelsPage.renderDetail(container, params.id);
        break;
      case 'journeys':
        JourneysPage.render(container);
        break;
      case 'heatmaps':
        HeatmapsPage.render(container);
        break;
      case 'ecommerce':
        EcommercePage.render(container);
        break;
      case 'behavioral':
        BehavioralPage.render(container);
        break;
      case 'insights':
        InsightsPage.render(container);
        break;
      case 'forms':
        FormsPage.render(container);
        break;
      case 'errors':
        ErrorsPage.render(container);
        break;
      case 'performance':
        PerformancePage.render(container);
        break;
      case 'scrolldepth':
        ScrollDepthPage.render(container);
        break;
      case 'comparison':
        ComparisonPage.render(container);
        break;
      case 'webhooks':
        WebhooksPage.render(container);
        break;
      case 'reports':
        ReportsPage.render(container);
        break;
      case 'apikeys':
        ApiKeysPage.render(container);
        break;
      case 'billing':
        BillingPage.render(container);
        break;
      case 'revenue':
        RevenuePage.init(container);
        break;
      case 'retention':
        RetentionPage.init(container);
        break;
      case 'alerts':
        AlertsPage.render(container);
        break;
      case 'tags':
        TagsPage.render(container);
        break;
      case 'surveys':
        SurveysPage.render(container);
        break;
      case 'goals':
        GoalsPage.render(container);
        break;
      case 'live':
        LivePage.render(container);
        break;
      case 'settings':
        renderSettingsPage(container);
        break;
      default:
        container.innerHTML = Components.emptyState('Page Not Found', 'The page you requested does not exist.');
    }
  }

  /* ------------------------------------------------------------------
     Simple Settings Page (inline)
  ------------------------------------------------------------------ */
  function renderSettingsPage(container) {
    container.innerHTML = `
      <div class="max-w-2xl">
        ${Components.sectionHeader('Settings', 'Configure your project and recording preferences')}
        <div class="space-y-6">
          <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-6">
            <h3 class="text-sm font-semibold text-white mb-4">General</h3>
            <div class="space-y-4">
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-1.5">Project Name</label>
                <input type="text" value="My Project" class="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50" />
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-400 mb-1.5">Tracking Domain</label>
                <input type="text" value="example.com" class="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50" />
              </div>
            </div>
          </div>
          <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-6">
            <h3 class="text-sm font-semibold text-white mb-4">Recording</h3>
            <div class="space-y-4">
              <label class="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked class="w-4 h-4 rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500/30" />
                <span class="text-sm text-slate-300">Record sessions automatically</span>
              </label>
              <label class="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked class="w-4 h-4 rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500/30" />
                <span class="text-sm text-slate-300">Detect rage clicks</span>
              </label>
              <label class="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked class="w-4 h-4 rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500/30" />
                <span class="text-sm text-slate-300">Capture console errors</span>
              </label>
              <label class="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" class="w-4 h-4 rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500/30" />
                <span class="text-sm text-slate-300">Mask all text inputs (privacy mode)</span>
              </label>
            </div>
          </div>
          <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-6">
            <h3 class="text-sm font-semibold text-white mb-4">Data Retention</h3>
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1.5">Keep session data for</label>
              <select class="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50">
                <option>30 days</option>
                <option selected>90 days</option>
                <option>180 days</option>
                <option>365 days</option>
              </select>
            </div>
          </div>
          <button class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors">
            Save Settings
          </button>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------
     API Helper
  ------------------------------------------------------------------ */
  const API_BASE = '/api';

  async function api(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const defaultHeaders = { 'Content-Type': 'application/json' };
    try {
      const res = await fetch(url, {
        ...options,
        headers: { ...defaultHeaders, ...options.headers },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err);
      Components.toast(err.message || 'Network error', 'error');
      throw err;
    }
  }

  /* ------------------------------------------------------------------
     Mock Data Generator (for demo / when API unavailable)
  ------------------------------------------------------------------ */
  const Mock = (() => {
    const firstNames = ['Alice', 'Bob', 'Carol', 'David', 'Eve', 'Frank', 'Grace', 'Heidi', 'Ivan', 'Judy', 'Karl', 'Liam', 'Mia', 'Noah', 'Olivia'];
    const lastNames  = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Wilson', 'Moore'];
    const browsers   = ['Chrome', 'Firefox', 'Safari', 'Edge'];
    const oses       = ['Windows', 'macOS', 'Linux', 'iOS', 'Android'];
    const devices    = ['Desktop', 'Mobile', 'Tablet'];
    const countries  = ['US', 'UK', 'DE', 'FR', 'JP', 'CA', 'AU', 'BR', 'IN', 'KR'];
    const cities     = ['New York', 'London', 'Berlin', 'Paris', 'Tokyo', 'Toronto', 'Sydney', 'Sao Paulo', 'Mumbai', 'Seoul'];
    const pages      = ['/', '/pricing', '/docs', '/blog', '/about', '/contact', '/signup', '/login', '/dashboard', '/features', '/api', '/changelog'];
    const utmSources = ['google', 'twitter', 'facebook', 'linkedin', 'newsletter', 'direct', null];
    const utmMediums = ['cpc', 'organic', 'social', 'email', 'referral', null];

    function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
    function randId() { return Math.random().toString(36).slice(2, 10); }

    function generateSession(daysAgo) {
      const started = new Date(Date.now() - (daysAgo || randInt(0, 7)) * 86400000 - randInt(0, 86400000));
      const duration = randInt(5, 1800);
      const pageCount = randInt(1, 12);
      const fn = rand(firstNames);
      const ln = rand(lastNames);
      const hasEmail = Math.random() > 0.4;
      const device = rand(devices);
      return {
        id: randId(),
        visitorId: 'v_' + randId(),
        email: hasEmail ? `${fn.toLowerCase()}.${ln.toLowerCase()}@example.com` : null,
        name: hasEmail ? `${fn} ${ln}` : null,
        browser: rand(browsers),
        browserVersion: `${randInt(90, 130)}.0`,
        os: rand(oses),
        device: device,
        country: rand(countries),
        city: rand(cities),
        startedAt: started.toISOString(),
        duration: duration,
        pageViews: pageCount,
        pages: Array.from({ length: pageCount }, () => rand(pages)),
        rageClicks: Math.random() > 0.8 ? randInt(1, 8) : 0,
        errors: Math.random() > 0.85 ? randInt(1, 5) : 0,
        utmSource: rand(utmSources),
        utmMedium: rand(utmMediums),
        utmCampaign: Math.random() > 0.7 ? 'summer_sale' : null,
      };
    }

    function generateSessions(count, daysRange) {
      return Array.from({ length: count }, () => generateSession(randInt(0, daysRange || 7)))
        .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
    }

    function dashboardData() {
      const totalSessions = randInt(2400, 5800);
      const uniqueVisitors = Math.round(totalSessions * (0.55 + Math.random() * 0.2));
      const avgDuration = randInt(60, 320);
      const totalPageViews = totalSessions * randInt(3, 7);

      // Sessions over time (last 7 days)
      const sessionsOverTime = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        sessionsOverTime.push({
          date: d.toISOString().slice(0, 10),
          label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          count: randInt(200, 900),
        });
      }

      const topPages = pages.slice(0, 8).map(p => ({
        url: p,
        views: randInt(100, 2000),
      })).sort((a, b) => b.views - a.views);

      return {
        totalSessions,
        totalSessionsChange: (Math.random() > 0.3 ? '+' : '-') + (Math.random() * 25).toFixed(1) + '%',
        totalSessionsUp: Math.random() > 0.3,
        uniqueVisitors,
        uniqueVisitorsChange: (Math.random() > 0.3 ? '+' : '-') + (Math.random() * 20).toFixed(1) + '%',
        uniqueVisitorsUp: Math.random() > 0.4,
        avgDuration,
        avgDurationChange: (Math.random() > 0.5 ? '+' : '-') + (Math.random() * 15).toFixed(1) + '%',
        avgDurationUp: Math.random() > 0.5,
        totalPageViews,
        totalPageViewsChange: (Math.random() > 0.3 ? '+' : '-') + (Math.random() * 30).toFixed(1) + '%',
        totalPageViewsUp: Math.random() > 0.3,
        sessionsOverTime,
        topPages,
        deviceBreakdown: { Desktop: randInt(50, 70), Mobile: randInt(20, 35), Tablet: randInt(3, 12) },
        browserBreakdown: { Chrome: randInt(50, 65), Firefox: randInt(10, 20), Safari: randInt(12, 22), Edge: randInt(5, 12) },
        recentSessions: generateSessions(10, 2),
        rageClicks: Array.from({ length: 5 }, () => ({
          sessionId: randId(),
          page: rand(pages),
          element: rand(['button.cta', 'div.pricing-card', 'a.nav-link', 'input.search', 'img.hero']),
          count: randInt(3, 12),
          timestamp: new Date(Date.now() - randInt(0, 86400000 * 2)).toISOString(),
        })),
        errors: Array.from({ length: 5 }, () => ({
          sessionId: randId(),
          page: rand(pages),
          message: rand(['TypeError: Cannot read property of undefined', 'ReferenceError: x is not defined', 'NetworkError: Failed to fetch', 'SyntaxError: Unexpected token', 'RangeError: Maximum call stack']),
          timestamp: new Date(Date.now() - randInt(0, 86400000 * 2)).toISOString(),
        })),
      };
    }

    function funnelList() {
      return [
        {
          id: 'f1',
          name: 'Signup Flow',
          steps: [
            { type: 'url', value: '/', label: 'Homepage' },
            { type: 'url', value: '/pricing', label: 'Pricing Page' },
            { type: 'url', value: '/signup', label: 'Signup Page' },
            { type: 'event', value: 'signup_complete', label: 'Signup Complete' },
          ],
          overallConversion: 12.4,
          totalEntries: 4820,
        },
        {
          id: 'f2',
          name: 'Documentation Engagement',
          steps: [
            { type: 'url', value: '/', label: 'Homepage' },
            { type: 'url', value: '/docs', label: 'Docs Landing' },
            { type: 'event', value: 'docs_search', label: 'Search Docs' },
            { type: 'url', value: '/api', label: 'API Reference' },
          ],
          overallConversion: 8.7,
          totalEntries: 3200,
        },
        {
          id: 'f3',
          name: 'Blog to Signup',
          steps: [
            { type: 'url', value: '/blog', label: 'Blog' },
            { type: 'url', value: '/features', label: 'Features' },
            { type: 'url', value: '/signup', label: 'Signup' },
          ],
          overallConversion: 5.3,
          totalEntries: 1850,
        },
      ];
    }

    function funnelDetail(id) {
      const funnels = funnelList();
      const funnel = funnels.find(f => f.id === id) || funnels[0];
      let remaining = funnel.totalEntries;
      const stepsData = funnel.steps.map((step, i) => {
        const dropOff = i === 0 ? 0 : Math.round(remaining * (0.15 + Math.random() * 0.35));
        const entered = remaining;
        remaining = entered - dropOff;
        if (remaining < 10) remaining = 10;
        return {
          ...step,
          entered,
          exited: dropOff,
          conversionFromPrev: i === 0 ? 100 : ((entered - dropOff) / entered * 100).toFixed(1),
          conversionFromFirst: ((remaining / funnel.totalEntries) * 100).toFixed(1),
        };
      });
      return { ...funnel, stepsData };
    }

    return { generateSessions, dashboardData, funnelList, funnelDetail };
  })();

  /* ------------------------------------------------------------------
     Format Helpers
  ------------------------------------------------------------------ */
  function formatDuration(seconds) {
    if (seconds == null) return '--';
    const s = Math.round(seconds);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    if (m < 60) return `${m}m ${rem}s`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }

  function formatNumber(n) {
    if (n == null) return '--';
    return Number(n).toLocaleString('en-US');
  }

  function formatDate(d) {
    const date = d instanceof Date ? d : new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatDateTime(d) {
    const date = d instanceof Date ? d : new Date(d);
    return date.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  }

  function relativeDate(d) {
    return Components.timeAgo(d);
  }

  function countryFlag(code) {
    if (!code) return '';
    const c = code.toUpperCase();
    return String.fromCodePoint(...[...c].map(ch => 0x1F1E6 - 65 + ch.charCodeAt(0)));
  }

  /* ------------------------------------------------------------------
     Date range picker binding
  ------------------------------------------------------------------ */
  function initDateRange() {
    const startEl = document.getElementById('date-start');
    const endEl = document.getElementById('date-end');
    if (startEl) startEl.value = state.dateRange.start;
    if (endEl) endEl.value = state.dateRange.end;

    if (startEl) startEl.addEventListener('change', () => {
      state.dateRange.start = startEl.value;
      handleRouteChange();
    });
    if (endEl) endEl.addEventListener('change', () => {
      state.dateRange.end = endEl.value;
      handleRouteChange();
    });
  }

  /* ------------------------------------------------------------------
     Init
  ------------------------------------------------------------------ */
  async function checkAuth() {
    try {
      const res = await fetch('/api/auth/check');
      const data = await res.json();
      if (!data.authenticated) {
        window.location.href = '/login';
        return false;
      }
      return true;
    } catch (err) {
      console.error('Auth check failed:', err);
      window.location.href = '/login';
      return false;
    }
  }

  /* ------------------------------------------------------------------
     Project loader & selector
  ------------------------------------------------------------------ */
  async function loadProjects() {
    try {
      const result = await api('/projects');
      const projects = result.projects || [];
      state.availableProjects = projects;

      if (projects.length > 0) {
        // Set first real project as active (skip 'default' if there are others)
        const realProject = projects.find(p => p.id !== 'default') || projects[0];
        state.project = realProject.id;
      }

      renderProjectSelector();
    } catch (err) {
      console.warn('Failed to load projects:', err);
      state.availableProjects = [];
    }
  }

  function renderProjectSelector() {
    const container = document.getElementById('project-selector');
    if (!container) return;

    const projects = state.availableProjects || [];
    if (projects.length === 0) {
      container.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">RM</div>
          <div class="min-w-0">
            <p class="text-sm font-medium text-slate-200 truncate">No projects</p>
            <p class="text-xs text-slate-500 truncate">Waiting for data...</p>
          </div>
        </div>`;
      return;
    }

    const options = projects.map(p => {
      const isActive = p.id === state.project;
      const domain = p.domain || p.id;
      const initials = p.name ? p.name.substring(0, 2).toUpperCase() : p.id.substring(0, 2).toUpperCase();
      return `
        <button onclick="App.switchProject('${p.id}')"
                class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${isActive ? 'bg-blue-600/20 border border-blue-500/30' : 'hover:bg-slate-800/60 border border-transparent'}">
          <div class="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
               style="background:hsl(${Math.abs([...p.id].reduce((h,c)=>(h<<5)-h+c.charCodeAt(0),0))%360},50%,40%)">
            ${initials}
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-xs font-medium ${isActive ? 'text-blue-400' : 'text-slate-300'} truncate">${p.name || p.id}</p>
            <p class="text-[10px] ${isActive ? 'text-blue-500/60' : 'text-slate-600'} truncate">${domain}</p>
          </div>
          ${isActive ? '<svg class="w-3.5 h-3.5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>' : ''}
        </button>`;
    }).join('');

    const current = projects.find(p => p.id === state.project);
    const currentInitials = current ? (current.name || current.id).substring(0, 2).toUpperCase() : 'RM';
    const currentName = current ? (current.name || current.id) : 'Select Project';

    container.innerHTML = `
      <div class="relative">
        <button onclick="document.getElementById('project-dropdown').classList.toggle('hidden')"
                class="w-full flex items-center gap-3 px-1 py-1 rounded-lg hover:bg-slate-800/40 transition-colors">
          <div class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
               style="background:hsl(${current ? Math.abs([...current.id].reduce((h,c)=>(h<<5)-h+c.charCodeAt(0),0))%360 : 220},50%,40%)">
            ${currentInitials}
          </div>
          <div class="min-w-0 flex-1 text-left">
            <p class="text-sm font-medium text-slate-200 truncate">${currentName}</p>
            <p class="text-xs text-slate-500 truncate">${state.project}</p>
          </div>
          <svg class="w-4 h-4 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9"/>
          </svg>
        </button>
        <div id="project-dropdown" class="hidden absolute bottom-full left-0 right-0 mb-2 bg-slate-800 border border-slate-700/50 rounded-xl shadow-xl z-50 p-2 space-y-1 max-h-[280px] overflow-y-auto">
          <p class="text-[10px] font-semibold uppercase tracking-widest text-slate-600 px-3 py-1">Switch Project</p>
          ${options}
        </div>
      </div>`;
  }

  function switchProject(projectId) {
    state.project = projectId;
    // Close dropdown
    const dropdown = document.getElementById('project-dropdown');
    if (dropdown) dropdown.classList.add('hidden');
    // Re-render project selector
    renderProjectSelector();
    // Re-render current page
    handleRouteChange();
  }

  async function init() {
    const authed = await checkAuth();
    if (!authed) return;
    window.addEventListener('hashchange', handleRouteChange);
    initDateRange();
    await loadProjects();
    handleRouteChange();
  }

  /* ------------------------------------------------------------------
     Public API
  ------------------------------------------------------------------ */
  return {
    state,
    navigate,
    api,
    Mock,
    init,
    handleRouteChange,
    switchProject,
    loadProjects,
    formatDuration,
    formatNumber,
    formatDate,
    formatDateTime,
    relativeDate,
    countryFlag,
  };

})();

// Boot on DOM ready
document.addEventListener('DOMContentLoaded', () => App.init());
