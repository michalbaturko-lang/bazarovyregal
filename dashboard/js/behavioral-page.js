/* ==========================================================================
   behavioral-page.js  -  Advanced Behavioral Analytics Page
   ========================================================================== */

const BehavioralPage = (() => {

  let engagementData = null;
  let segmentsData = null;
  let cohortsData = null;
  let retentionData = null;
  let timingData = null;

  /* ------------------------------------------------------------------
     Mock Data Generator (fallback when API unavailable)
  ------------------------------------------------------------------ */
  function generateMockData() {
    const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const pages = ['/', '/pricing', '/docs', '/blog', '/about', '/contact', '/signup', '/login', '/dashboard', '/features', '/api', '/changelog'];
    const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

    // Engagement data
    engagementData = {
      engagement_score_distribution: Array.from({ length: 10 }, (_, i) => ({
        range: `${i * 10}-${i * 10 + 9}`,
        count: i < 2 ? randInt(50, 120) : i < 5 ? randInt(80, 200) : i < 8 ? randInt(40, 100) : randInt(10, 50),
      })),
      avg_engagement_score: randInt(38, 62),
      avg_pages_per_session: Math.round((2 + Math.random() * 5) * 10) / 10,
      avg_session_duration: randInt(60, 320),
      avg_scroll_depth: randInt(35, 75),
      avg_events_per_session: randInt(8, 35),
      engagement_by_device: {
        Desktop: randInt(45, 65),
        Mobile: randInt(30, 50),
        Tablet: randInt(35, 55),
      },
      engagement_by_time_of_day: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        avg_score: randInt(20, 75),
        sessions: hour >= 8 && hour <= 22 ? randInt(40, 200) : randInt(5, 40),
      })),
      most_engaging_pages: pages.slice(0, 6).map(url => ({
        url,
        sessions: randInt(100, 800),
        avg_time: randInt(30, 300),
        avg_scroll_depth: randInt(50, 95),
        bounce_rate: randInt(5, 30),
        engagement_score: randInt(55, 92),
      })).sort((a, b) => b.engagement_score - a.engagement_score),
      least_engaging_pages: pages.slice(6).map(url => ({
        url,
        sessions: randInt(30, 200),
        avg_time: randInt(5, 30),
        avg_scroll_depth: randInt(5, 35),
        bounce_rate: randInt(50, 90),
        engagement_score: randInt(8, 35),
      })).sort((a, b) => b.bounce_rate - a.bounce_rate),
      engagement_trend: (() => {
        const trend = [];
        for (let i = 29; i >= 0; i--) {
          const d = new Date(Date.now() - i * 86400000);
          trend.push({
            date: d.toISOString().slice(0, 10),
            avg_score: randInt(35, 65),
            sessions: randInt(80, 400),
          });
        }
        return trend;
      })(),
      all_pages: pages.map(url => ({
        url,
        sessions: randInt(50, 900),
        avg_time: randInt(10, 300),
        avg_scroll_depth: randInt(15, 95),
        bounce_rate: randInt(5, 80),
        engagement_score: randInt(10, 90),
      })).sort((a, b) => b.sessions - a.sessions),
    };

    // Segments data
    segmentsData = {
      total_visitors: randInt(800, 3000),
      segments: {
        power_users: {
          count: randInt(30, 120),
          avg_sessions: randInt(8, 20),
          avg_duration: randInt(600, 1800),
          avg_pages: Math.round((5 + Math.random() * 10) * 10) / 10,
        },
        bouncers: {
          count: randInt(150, 500),
          avg_duration: randInt(2, 9),
          top_landing_pages: [
            { url: '/', count: randInt(50, 200) },
            { url: '/blog', count: randInt(20, 80) },
            { url: '/pricing', count: randInt(10, 50) },
          ],
        },
        researchers: {
          count: randInt(50, 200),
          avg_pages: Math.round((6 + Math.random() * 8) * 10) / 10,
          avg_scroll_depth: randInt(65, 90),
          most_viewed_pages: [
            { url: '/docs', count: randInt(80, 200) },
            { url: '/api', count: randInt(40, 120) },
            { url: '/features', count: randInt(30, 100) },
          ],
        },
        converters: {
          count: randInt(40, 180),
          avg_duration: randInt(120, 600),
          conversion_pages: [
            { url: '/signup', count: randInt(30, 100) },
            { url: '/checkout', count: randInt(10, 60) },
          ],
        },
        frustrated: {
          count: randInt(20, 100),
          avg_events: randInt(15, 50),
          frustration_sources: {
            rage_clicks: randInt(15, 80),
            errors: randInt(10, 60),
          },
        },
      },
    };

    // Cohorts data
    cohortsData = {
      cohorts: (() => {
        const cohorts = [];
        for (let w = 7; w >= 0; w--) {
          const d = new Date(Date.now() - w * 7 * 86400000);
          const year = d.getFullYear();
          const jan1 = new Date(year, 0, 1);
          const weekNum = Math.ceil((((d - jan1) / 86400000) + jan1.getDay() + 1) / 7);
          const users = randInt(30, 120);
          const retention = [100];
          for (let r = 1; r <= Math.min(7, w); r++) {
            const prev = retention[retention.length - 1];
            retention.push(Math.max(2, Math.round(prev * (0.3 + Math.random() * 0.45))));
          }
          cohorts.push({
            week: `${year}-W${String(weekNum).padStart(2, '0')}`,
            users,
            retention,
          });
        }
        return cohorts;
      })(),
    };

    // Retention data
    retentionData = {
      new_vs_returning: { new: randInt(400, 1200), returning: randInt(200, 800) },
      return_frequency: {
        '1_day': randInt(50, 200),
        '2_3_days': randInt(80, 250),
        '4_7_days': randInt(40, 150),
        '7_plus_days': randInt(20, 80),
      },
      new_user_engagement: {
        avg_pages: Math.round((1.5 + Math.random() * 3) * 10) / 10,
        avg_duration: randInt(30, 120),
        avg_scroll_depth: randInt(20, 50),
        avg_engagement: randInt(20, 40),
        conversion_rate: Math.round(Math.random() * 50) / 10,
      },
      returning_user_engagement: {
        avg_pages: Math.round((3 + Math.random() * 6) * 10) / 10,
        avg_duration: randInt(120, 400),
        avg_scroll_depth: randInt(50, 80),
        avg_engagement: randInt(45, 70),
        conversion_rate: Math.round((5 + Math.random() * 100) / 10),
      },
      total_sessions: randInt(1500, 5000),
      total_visitors: randInt(800, 2500),
    };

    // Timing data
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    timingData = {
      sessions_by_hour: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        sessions: hour >= 8 && hour <= 22 ? randInt(50, 300) : randInt(5, 40),
        avg_duration: randInt(60, 300),
        conversions: randInt(0, 15),
        conversion_rate: Math.round(Math.random() * 80) / 10,
      })),
      sessions_by_day_of_week: dayNames.map((day, i) => ({
        day,
        day_index: i,
        sessions: (i >= 1 && i <= 5) ? randInt(200, 600) : randInt(80, 250),
        avg_duration: randInt(80, 280),
        conversions: randInt(5, 40),
        conversion_rate: Math.round(Math.random() * 100) / 10,
      })),
      best_conversion_hours: [
        { hour: 10, sessions: randInt(100, 250), conversion_rate: randInt(8, 15) },
        { hour: 14, sessions: randInt(80, 200), conversion_rate: randInt(6, 12) },
        { hour: 19, sessions: randInt(60, 180), conversion_rate: randInt(5, 10) },
      ],
      worst_conversion_hours: [
        { hour: 3, sessions: randInt(5, 20), conversion_rate: 0 },
        { hour: 4, sessions: randInt(3, 15), conversion_rate: 0 },
        { hour: 5, sessions: randInt(8, 25), conversion_rate: Math.round(Math.random() * 10) / 10 },
      ],
      avg_duration_by_hour: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        avg_duration: randInt(60, 300),
      })),
      timing_heatmap: (() => {
        const hm = [];
        for (let day = 0; day < 7; day++) {
          for (let hour = 0; hour < 24; hour++) {
            const isBusinessHour = hour >= 8 && hour <= 22;
            const isWeekday = day >= 1 && day <= 5;
            const base = (isBusinessHour ? 30 : 3) * (isWeekday ? 2 : 1);
            hm.push({
              day: dayNames[day],
              day_index: day,
              hour,
              sessions: randInt(Math.max(1, base - 15), base + 25),
              conversions: randInt(0, 5),
              conversion_rate: Math.round(Math.random() * 120) / 10,
            });
          }
        }
        return hm;
      })(),
    };
  }

  /* ------------------------------------------------------------------
     Fetch data from API
  ------------------------------------------------------------------ */
  async function fetchData() {
    const { start, end } = App.state.dateRange;
    const project = App.state.project;
    const params = `project_id=${project}&date_from=${start}&date_to=${end}`;

    const fetchers = [
      App.api(`/behavioral/engagement?${params}`).then(d => { engagementData = d; }).catch(() => null),
      App.api(`/behavioral/segments-analysis?project_id=${project}`).then(d => { segmentsData = d; }).catch(() => null),
      App.api(`/behavioral/cohorts?${params}`).then(d => { cohortsData = d; }).catch(() => null),
      App.api(`/behavioral/retention?project_id=${project}&days=30`).then(d => { retentionData = d; }).catch(() => null),
      App.api(`/behavioral/timing?${params}`).then(d => { timingData = d; }).catch(() => null),
    ];

    await Promise.all(fetchers);

    // Fallback to mock data if all APIs failed
    if (!engagementData && !segmentsData && !cohortsData && !retentionData && !timingData) {
      generateMockData();
    } else {
      if (!engagementData) generateMockEngagement();
      if (!segmentsData) generateMockSegments();
      if (!cohortsData) generateMockCohorts();
      if (!retentionData) generateMockRetention();
      if (!timingData) generateMockTiming();
    }
  }

  // Individual mock generators (reuse parts from full mock)
  function generateMockEngagement() { generateMockData(); }
  function generateMockSegments() { if (!segmentsData) generateMockData(); }
  function generateMockCohorts() { if (!cohortsData) generateMockData(); }
  function generateMockRetention() { if (!retentionData) generateMockData(); }
  function generateMockTiming() { if (!timingData) generateMockData(); }

  /* ------------------------------------------------------------------
     Chart defaults
  ------------------------------------------------------------------ */
  function chartDefaults() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 } } },
        tooltip: {
          backgroundColor: '#1e293b',
          titleColor: '#f1f5f9',
          bodyColor: '#cbd5e1',
          borderColor: '#334155',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
          titleFont: { family: 'Inter', weight: '600' },
          bodyFont: { family: 'Inter' },
        },
      },
    };
  }

  /* ------------------------------------------------------------------
     Color helpers
  ------------------------------------------------------------------ */
  function retentionColor(pct) {
    if (pct >= 80) return { bg: 'bg-green-500/80', text: 'text-white' };
    if (pct >= 60) return { bg: 'bg-green-500/60', text: 'text-white' };
    if (pct >= 40) return { bg: 'bg-green-500/40', text: 'text-white' };
    if (pct >= 25) return { bg: 'bg-yellow-500/50', text: 'text-white' };
    if (pct >= 15) return { bg: 'bg-orange-500/40', text: 'text-white' };
    if (pct >= 5) return { bg: 'bg-red-500/30', text: 'text-red-200' };
    return { bg: 'bg-slate-700/40', text: 'text-slate-400' };
  }

  function heatmapColor(value, max) {
    if (max === 0) return 'background:rgba(51,65,85,0.3)';
    const intensity = Math.min(1, value / max);
    if (intensity < 0.1) return 'background:rgba(51,65,85,0.3)';
    if (intensity < 0.25) return 'background:rgba(59,130,246,0.15)';
    if (intensity < 0.5) return 'background:rgba(59,130,246,0.3)';
    if (intensity < 0.75) return 'background:rgba(59,130,246,0.5)';
    return 'background:rgba(59,130,246,0.75)';
  }

  function scoreColor(score) {
    if (score >= 70) return 'text-green-400';
    if (score >= 50) return 'text-blue-400';
    if (score >= 30) return 'text-yellow-400';
    return 'text-red-400';
  }

  function scoreGaugeColor(score) {
    if (score >= 70) return '#22c55e';
    if (score >= 50) return '#3b82f6';
    if (score >= 30) return '#eab308';
    return '#ef4444';
  }

  /* ------------------------------------------------------------------
     Render - Main page layout
  ------------------------------------------------------------------ */
  async function render(container) {
    await fetchData();

    container.innerHTML = `
      <div>
        ${Components.sectionHeader('Behavioral Analytics', 'Deep insights into user behavior, engagement, and retention patterns')}

        <!-- Tab Navigation -->
        <div class="flex items-center gap-1 mb-6 bg-slate-800/50 rounded-xl p-1 border border-slate-700/50 overflow-x-auto">
          <button onclick="BehavioralPage.switchTab('engagement')" data-beh-tab="engagement"
                  class="beh-tab flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap bg-blue-600 text-white">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>
            Engagement
          </button>
          <button onclick="BehavioralPage.switchTab('segments')" data-beh-tab="segments"
                  class="beh-tab flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap text-slate-400 hover:bg-slate-700/50">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"/></svg>
            Segments
          </button>
          <button onclick="BehavioralPage.switchTab('cohorts')" data-beh-tab="cohorts"
                  class="beh-tab flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap text-slate-400 hover:bg-slate-700/50">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6z"/></svg>
            Cohorts
          </button>
          <button onclick="BehavioralPage.switchTab('timing')" data-beh-tab="timing"
                  class="beh-tab flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap text-slate-400 hover:bg-slate-700/50">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Timing
          </button>
          <button onclick="BehavioralPage.switchTab('retention')" data-beh-tab="retention"
                  class="beh-tab flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap text-slate-400 hover:bg-slate-700/50">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3"/></svg>
            Retention
          </button>
        </div>

        <!-- Tab Content Areas -->
        <div id="beh-tab-engagement" class="beh-tab-content"></div>
        <div id="beh-tab-segments" class="beh-tab-content hidden"></div>
        <div id="beh-tab-cohorts" class="beh-tab-content hidden"></div>
        <div id="beh-tab-timing" class="beh-tab-content hidden"></div>
        <div id="beh-tab-retention" class="beh-tab-content hidden"></div>
      </div>`;

    renderEngagementTab();
    renderSegmentsTab();
    renderCohortsTab();
    renderTimingTab();
    renderRetentionTab();
  }

  /* ------------------------------------------------------------------
     Tab Switching
  ------------------------------------------------------------------ */
  function switchTab(tabName) {
    document.querySelectorAll('.beh-tab').forEach(btn => {
      btn.classList.remove('bg-blue-600', 'text-white');
      btn.classList.add('text-slate-400', 'hover:bg-slate-700/50');
    });
    const activeBtn = document.querySelector(`[data-beh-tab="${tabName}"]`);
    if (activeBtn) {
      activeBtn.classList.add('bg-blue-600', 'text-white');
      activeBtn.classList.remove('text-slate-400', 'hover:bg-slate-700/50');
    }

    document.querySelectorAll('.beh-tab-content').forEach(el => el.classList.add('hidden'));
    const panel = document.getElementById(`beh-tab-${tabName}`);
    if (panel) panel.classList.remove('hidden');
  }

  /* ------------------------------------------------------------------
     Engagement Tab
  ------------------------------------------------------------------ */
  function renderEngagementTab() {
    const el = document.getElementById('beh-tab-engagement');
    if (!el || !engagementData) return;

    const d = engagementData;
    const gaugeColor = scoreGaugeColor(d.avg_engagement_score);
    const gaugeAngle = (d.avg_engagement_score / 100) * 270;

    el.innerHTML = `
      <!-- Engagement Score Gauge + Mini Metrics -->
      <div class="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
        <!-- Large Gauge -->
        <div class="lg:col-span-2 bg-slate-800 rounded-xl border border-slate-700/50 p-6 flex flex-col items-center justify-center">
          <h3 class="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Engagement Score</h3>
          <div class="relative" style="width:200px;height:200px;">
            <svg viewBox="0 0 200 200" class="w-full h-full">
              <!-- Background arc -->
              <path d="M 30 160 A 85 85 0 1 1 170 160" fill="none" stroke="#334155" stroke-width="14" stroke-linecap="round"/>
              <!-- Score arc -->
              <path d="M 30 160 A 85 85 0 1 1 170 160" fill="none" stroke="${gaugeColor}" stroke-width="14" stroke-linecap="round"
                    stroke-dasharray="${gaugeAngle * 1.87} 999" opacity="0.9"/>
              <!-- Score text -->
              <text x="100" y="100" text-anchor="middle" fill="white" font-size="42" font-weight="700" font-family="Inter">${d.avg_engagement_score}</text>
              <text x="100" y="125" text-anchor="middle" fill="#94a3b8" font-size="14" font-family="Inter">out of 100</text>
            </svg>
          </div>
          <div class="mt-2 text-xs text-slate-500">Average across all sessions</div>
        </div>

        <!-- Mini Metrics Grid -->
        <div class="lg:col-span-3 grid grid-cols-2 gap-4">
          ${miniMetric('Pages / Session', d.avg_pages_per_session.toFixed(1), pagesIcon(), 'blue')}
          ${miniMetric('Avg Duration', App.formatDuration(d.avg_session_duration), clockIcon(), 'purple')}
          ${miniMetric('Scroll Depth', d.avg_scroll_depth + '%', scrollIcon(), 'green')}
          ${miniMetric('Events / Session', d.avg_events_per_session, eventsIcon(), 'amber')}
        </div>
      </div>

      <!-- Engagement Trend -->
      <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5 mb-6">
        <h3 class="text-sm font-semibold text-white mb-4">Engagement Trend (Daily Average Score)</h3>
        <div style="height:280px;position:relative;"><canvas id="chart-engagement-trend"></canvas></div>
      </div>

      <!-- Engagement By Device + Time of Day -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
          <h3 class="text-sm font-semibold text-white mb-4">Engagement by Device</h3>
          <div style="height:260px;position:relative;"><canvas id="chart-engagement-device"></canvas></div>
        </div>
        <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
          <h3 class="text-sm font-semibold text-white mb-4">Engagement by Time of Day</h3>
          <div style="height:260px;position:relative;"><canvas id="chart-engagement-time"></canvas></div>
        </div>
      </div>

      <!-- Page Engagement Ranking -->
      <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5 mb-6">
        <h3 class="text-sm font-semibold text-white mb-4">Page Engagement Ranking</h3>
        <div id="page-engagement-table"></div>
      </div>
    `;

    renderEngagementTrendChart();
    renderEngagementDeviceChart();
    renderEngagementTimeChart();
    renderPageEngagementTable();
  }

  function miniMetric(label, value, icon, color) {
    const colors = {
      blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/20',
      purple: 'from-purple-500/20 to-purple-600/5 border-purple-500/20',
      green: 'from-green-500/20 to-green-600/5 border-green-500/20',
      amber: 'from-amber-500/20 to-amber-600/5 border-amber-500/20',
    };
    const textColors = {
      blue: 'text-blue-400',
      purple: 'text-purple-400',
      green: 'text-green-400',
      amber: 'text-amber-400',
    };
    return `
      <div class="bg-gradient-to-br ${colors[color]} rounded-xl border p-5">
        <div class="flex items-center gap-2 mb-3">
          <span class="${textColors[color]}">${icon}</span>
          <span class="text-xs font-medium text-slate-400 uppercase tracking-wider">${label}</span>
        </div>
        <div class="text-2xl font-bold text-white">${value}</div>
      </div>`;
  }

  // SVG icon helpers
  function pagesIcon() { return '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>'; }
  function clockIcon() { return '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'; }
  function scrollIcon() { return '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5-6L16.5 16.5m0 0L12 10.5m4.5 6V3"/></svg>'; }
  function eventsIcon() { return '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59"/></svg>'; }

  function renderEngagementTrendChart() {
    const ctx = document.getElementById('chart-engagement-trend');
    if (!ctx || !engagementData) return;
    const trend = engagementData.engagement_trend || [];

    App.state.chartInstances['beh-engagement-trend'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: trend.map(d => { const dt = new Date(d.date); return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }),
        datasets: [{
          label: 'Engagement Score',
          data: trend.map(d => d.avg_score),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.08)',
          borderWidth: 2.5,
          fill: true,
          tension: 0.35,
          pointRadius: 3,
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: '#1e293b',
          pointBorderWidth: 2,
          pointHoverRadius: 6,
        }, {
          label: 'Sessions',
          data: trend.map(d => d.sessions),
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139,92,246,0.08)',
          borderWidth: 2,
          fill: false,
          tension: 0.35,
          pointRadius: 2,
          pointBackgroundColor: '#8b5cf6',
          yAxisID: 'y1',
          borderDash: [5, 5],
        }],
      },
      options: {
        ...chartDefaults(),
        scales: {
          x: { grid: { color: 'rgba(51,65,85,0.4)', drawBorder: false }, ticks: { color: '#64748b', font: { family: 'Inter', size: 11 }, maxTicksLimit: 10 } },
          y: { beginAtZero: true, max: 100, grid: { color: 'rgba(51,65,85,0.4)', drawBorder: false }, ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } }, title: { display: true, text: 'Score', color: '#64748b', font: { family: 'Inter', size: 11 } } },
          y1: { position: 'right', beginAtZero: true, grid: { display: false }, ticks: { color: '#8b5cf6', font: { family: 'Inter', size: 11 } }, title: { display: true, text: 'Sessions', color: '#8b5cf6', font: { family: 'Inter', size: 11 } } },
        },
        plugins: {
          ...chartDefaults().plugins,
          legend: { position: 'top', labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 }, usePointStyle: true, pointStyleWidth: 10, padding: 20 } },
        },
      },
    });
  }

  function renderEngagementDeviceChart() {
    const ctx = document.getElementById('chart-engagement-device');
    if (!ctx || !engagementData) return;
    const devData = engagementData.engagement_by_device || {};
    const labels = Object.keys(devData);
    const values = Object.values(devData);

    App.state.chartInstances['beh-engagement-device'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Avg Engagement Score',
          data: values,
          backgroundColor: ['rgba(59,130,246,0.7)', 'rgba(16,185,129,0.7)', 'rgba(245,158,11,0.7)', 'rgba(139,92,246,0.7)'],
          borderRadius: 8,
          borderSkipped: false,
          barThickness: 50,
        }],
      },
      options: {
        ...chartDefaults(),
        scales: {
          x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { family: 'Inter', size: 12 } } },
          y: { beginAtZero: true, max: 100, grid: { color: 'rgba(51,65,85,0.4)', drawBorder: false }, ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } } },
        },
        plugins: { ...chartDefaults().plugins, legend: { display: false } },
      },
    });
  }

  function renderEngagementTimeChart() {
    const ctx = document.getElementById('chart-engagement-time');
    if (!ctx || !engagementData) return;
    const timeData = engagementData.engagement_by_time_of_day || [];

    App.state.chartInstances['beh-engagement-time'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: timeData.map(d => `${d.hour}:00`),
        datasets: [{
          label: 'Avg Score',
          data: timeData.map(d => d.avg_score),
          backgroundColor: timeData.map(d => {
            if (d.avg_score >= 60) return 'rgba(34,197,94,0.6)';
            if (d.avg_score >= 40) return 'rgba(59,130,246,0.6)';
            if (d.avg_score >= 20) return 'rgba(234,179,8,0.6)';
            return 'rgba(239,68,68,0.5)';
          }),
          borderRadius: 4,
          borderSkipped: false,
        }],
      },
      options: {
        ...chartDefaults(),
        scales: {
          x: { grid: { display: false }, ticks: { color: '#64748b', font: { family: 'Inter', size: 10 }, maxRotation: 0 } },
          y: { beginAtZero: true, max: 100, grid: { color: 'rgba(51,65,85,0.4)', drawBorder: false }, ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } } },
        },
        plugins: { ...chartDefaults().plugins, legend: { display: false } },
      },
    });
  }

  function renderPageEngagementTable() {
    const el = document.getElementById('page-engagement-table');
    if (!el || !engagementData) return;

    const pages = engagementData.all_pages || [];

    const headers = [
      { key: 'url', label: 'URL', width: '30%' },
      { key: 'sessions', label: 'Sessions', align: 'right' },
      { key: 'avg_time', label: 'Avg Time', align: 'right' },
      { key: 'scroll', label: 'Scroll Depth', align: 'center' },
      { key: 'bounce', label: 'Bounce Rate', align: 'right' },
      { key: 'score', label: 'Score', align: 'center' },
    ];

    const rows = pages.slice(0, 15).map(p => ({
      cells: {
        url: `<span class="text-blue-400 font-mono text-xs">${p.url}</span>`,
        sessions: `<span class="text-slate-300">${App.formatNumber(p.sessions)}</span>`,
        avg_time: `<span class="text-slate-300">${App.formatDuration(p.avg_time)}</span>`,
        scroll: `
          <div class="flex items-center gap-2">
            <div class="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden" style="max-width:80px;">
              <div class="h-full rounded-full ${p.avg_scroll_depth >= 70 ? 'bg-green-500' : p.avg_scroll_depth >= 40 ? 'bg-blue-500' : 'bg-red-500'}"
                   style="width:${p.avg_scroll_depth}%"></div>
            </div>
            <span class="text-xs text-slate-400">${p.avg_scroll_depth}%</span>
          </div>`,
        bounce: `<span class="${p.bounce_rate > 60 ? 'text-red-400' : p.bounce_rate > 30 ? 'text-yellow-400' : 'text-green-400'}">${p.bounce_rate}%</span>`,
        score: `<span class="inline-flex items-center justify-center w-10 h-7 rounded-lg text-xs font-bold ${p.engagement_score >= 70 ? 'bg-green-500/20 text-green-400' : p.engagement_score >= 50 ? 'bg-blue-500/20 text-blue-400' : p.engagement_score >= 30 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}">${p.engagement_score}</span>`,
      },
    }));

    el.innerHTML = Components.dataTable(headers, rows, { striped: true, hoverable: true });
  }

  /* ------------------------------------------------------------------
     Segments Tab
  ------------------------------------------------------------------ */
  function renderSegmentsTab() {
    const el = document.getElementById('beh-tab-segments');
    if (!el || !segmentsData) return;

    const s = segmentsData.segments;
    const total = segmentsData.total_visitors || 1;

    el.innerHTML = `
      <div class="mb-4">
        <div class="flex items-center gap-2 text-sm text-slate-400 mb-6">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"/></svg>
          Automatically discovered from <span class="text-white font-semibold">${App.formatNumber(total)}</span> unique visitors
        </div>
      </div>

      <!-- Segment Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mb-6">
        ${segmentCard('Power Users', s.power_users.count, total, 'blue',
          '<svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>',
          `<div class="space-y-2 text-xs">
            <div class="flex justify-between"><span class="text-slate-400">Avg Sessions</span><span class="text-white font-medium">${s.power_users.avg_sessions}</span></div>
            <div class="flex justify-between"><span class="text-slate-400">Avg Duration</span><span class="text-white font-medium">${App.formatDuration(s.power_users.avg_duration)}</span></div>
            <div class="flex justify-between"><span class="text-slate-400">Avg Pages</span><span class="text-white font-medium">${s.power_users.avg_pages}</span></div>
          </div>`,
          '>5 sessions, >10min avg duration'
        )}

        ${segmentCard('Bouncers', s.bouncers.count, total, 'red',
          '<svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"/></svg>',
          `<div class="space-y-2 text-xs">
            <div class="flex justify-between"><span class="text-slate-400">Avg Duration</span><span class="text-white font-medium">${s.bouncers.avg_duration}s</span></div>
            <div class="text-slate-400 mt-2">Top Landing Pages:</div>
            ${(Array.isArray(s.bouncers.top_landing_pages) ? s.bouncers.top_landing_pages : []).slice(0, 3).map(p => `<div class="flex justify-between"><span class="text-blue-400 font-mono">${p.url}</span><span class="text-slate-300">${p.count}</span></div>`).join('')}
          </div>`,
          '1 page view, <10s duration'
        )}

        ${segmentCard('Researchers', s.researchers.count, total, 'purple',
          '<svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/></svg>',
          `<div class="space-y-2 text-xs">
            <div class="flex justify-between"><span class="text-slate-400">Avg Pages</span><span class="text-white font-medium">${s.researchers.avg_pages}</span></div>
            <div class="flex justify-between"><span class="text-slate-400">Avg Scroll Depth</span><span class="text-white font-medium">${s.researchers.avg_scroll_depth}%</span></div>
            <div class="text-slate-400 mt-2">Most Viewed Pages:</div>
            ${(Array.isArray(s.researchers.most_viewed_pages) ? s.researchers.most_viewed_pages : []).slice(0, 3).map(p => `<div class="flex justify-between"><span class="text-blue-400 font-mono">${p.url}</span><span class="text-slate-300">${p.count}</span></div>`).join('')}
          </div>`,
          '>5 pages, high scroll, no conversion'
        )}

        ${segmentCard('Converters', s.converters.count, total, 'green',
          '<svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
          `<div class="space-y-2 text-xs">
            <div class="flex justify-between"><span class="text-slate-400">Avg Duration</span><span class="text-white font-medium">${App.formatDuration(s.converters.avg_duration)}</span></div>
            <div class="text-slate-400 mt-2">Conversion Pages:</div>
            ${(Array.isArray(s.converters.conversion_pages) ? s.converters.conversion_pages : []).slice(0, 3).map(p => `<div class="flex justify-between"><span class="text-blue-400 font-mono">${p.url}</span><span class="text-slate-300">${p.count}</span></div>`).join('')}
          </div>`,
          'Sessions leading to signup/purchase'
        )}

        ${segmentCard('Frustrated', s.frustrated.count, total, 'orange',
          '<svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z"/></svg>',
          `<div class="space-y-2 text-xs">
            <div class="flex justify-between"><span class="text-slate-400">Avg Events</span><span class="text-white font-medium">${s.frustrated.avg_events}</span></div>
            <div class="text-slate-400 mt-2">Frustration Sources:</div>
            <div class="flex justify-between"><span class="text-yellow-400">Rage Clicks</span><span class="text-white font-medium">${s.frustrated.frustration_sources.rage_clicks} users</span></div>
            <div class="flex justify-between"><span class="text-red-400">JS Errors</span><span class="text-white font-medium">${s.frustrated.frustration_sources.errors} users</span></div>
          </div>`,
          'Rage clicks or console errors'
        )}
      </div>

      <!-- Segments Distribution Chart -->
      <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5 mb-6">
        <h3 class="text-sm font-semibold text-white mb-4">Segment Distribution</h3>
        <div style="height:300px;position:relative;"><canvas id="chart-segments-dist"></canvas></div>
      </div>
    `;

    renderSegmentsChart();
  }

  function segmentCard(name, count, total, color, icon, details, description) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    const colorMap = {
      blue: { border: 'border-blue-500/30', bg: 'bg-blue-500/10', iconBg: 'bg-blue-500/20', iconText: 'text-blue-400', badge: 'bg-blue-500/20 text-blue-300', barBg: 'bg-blue-500' },
      red: { border: 'border-red-500/30', bg: 'bg-red-500/10', iconBg: 'bg-red-500/20', iconText: 'text-red-400', badge: 'bg-red-500/20 text-red-300', barBg: 'bg-red-500' },
      purple: { border: 'border-purple-500/30', bg: 'bg-purple-500/10', iconBg: 'bg-purple-500/20', iconText: 'text-purple-400', badge: 'bg-purple-500/20 text-purple-300', barBg: 'bg-purple-500' },
      green: { border: 'border-green-500/30', bg: 'bg-green-500/10', iconBg: 'bg-green-500/20', iconText: 'text-green-400', badge: 'bg-green-500/20 text-green-300', barBg: 'bg-green-500' },
      orange: { border: 'border-orange-500/30', bg: 'bg-orange-500/10', iconBg: 'bg-orange-500/20', iconText: 'text-orange-400', badge: 'bg-orange-500/20 text-orange-300', barBg: 'bg-orange-500' },
    };
    const c = colorMap[color] || colorMap.blue;

    return `
      <div class="group ${c.bg} rounded-xl border ${c.border} p-5 hover:border-opacity-60 transition-all cursor-pointer" onclick="BehavioralPage.filterBySegment('${name.toLowerCase().replace(/\s+/g, '_')}')">
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl ${c.iconBg} flex items-center justify-center ${c.iconText}">${icon}</div>
            <div>
              <h4 class="text-sm font-semibold text-white">${name}</h4>
              <p class="text-xs text-slate-500">${description}</p>
            </div>
          </div>
        </div>
        <div class="flex items-end justify-between mb-3">
          <div>
            <span class="text-3xl font-bold text-white">${App.formatNumber(count)}</span>
            <span class="text-xs text-slate-500 ml-1">visitors</span>
          </div>
          <span class="inline-flex items-center px-2 py-1 rounded-md text-xs font-bold ${c.badge}">${pct}%</span>
        </div>
        <div class="w-full h-1.5 rounded-full bg-slate-700/50 mb-4">
          <div class="h-full rounded-full ${c.barBg} transition-all" style="width:${Math.min(100, pct * 2)}%"></div>
        </div>
        ${details}
      </div>`;
  }

  function renderSegmentsChart() {
    const ctx = document.getElementById('chart-segments-dist');
    if (!ctx || !segmentsData) return;
    const s = segmentsData.segments;

    App.state.chartInstances['beh-segments-dist'] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Power Users', 'Bouncers', 'Researchers', 'Converters', 'Frustrated'],
        datasets: [{
          data: [s.power_users.count, s.bouncers.count, s.researchers.count, s.converters.count, s.frustrated.count],
          backgroundColor: [
            'rgba(59,130,246,0.75)',
            'rgba(239,68,68,0.75)',
            'rgba(139,92,246,0.75)',
            'rgba(34,197,94,0.75)',
            'rgba(249,115,22,0.75)',
          ],
          borderColor: '#1e293b',
          borderWidth: 3,
          hoverOffset: 8,
        }],
      },
      options: {
        ...chartDefaults(),
        cutout: '50%',
        plugins: {
          ...chartDefaults().plugins,
          legend: {
            position: 'right',
            labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 }, padding: 16, usePointStyle: true, pointStyleWidth: 10 },
          },
        },
      },
    });
  }

  function filterBySegment(segmentName) {
    Components.toast(`Filtering sessions by "${segmentName.replace(/_/g, ' ')}" segment`, 'info');
  }

  /* ------------------------------------------------------------------
     Cohorts Tab
  ------------------------------------------------------------------ */
  function renderCohortsTab() {
    const el = document.getElementById('beh-tab-cohorts');
    if (!el || !cohortsData) return;

    const cohorts = cohortsData.cohorts || [];
    if (cohorts.length === 0) {
      el.innerHTML = Components.emptyState('No Cohort Data', 'Not enough data to generate cohort analysis.');
      return;
    }

    // Find max retention columns
    const maxWeeks = Math.max(...cohorts.map(c => c.retention.length));

    // Header row
    const headerCells = ['<th class="px-3 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">Cohort</th>',
      '<th class="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Users</th>'];
    for (let i = 0; i < maxWeeks; i++) {
      headerCells.push(`<th class="px-3 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">${i === 0 ? 'W+0' : `W+${i}`}</th>`);
    }

    // Body rows
    const bodyRows = cohorts.map(c => {
      const cells = [
        `<td class="px-3 py-2.5 text-sm font-medium text-white whitespace-nowrap">${c.week}</td>`,
        `<td class="px-3 py-2.5 text-sm text-slate-300 text-center">${c.users}</td>`,
      ];
      for (let i = 0; i < maxWeeks; i++) {
        const pct = c.retention[i] !== undefined ? c.retention[i] : null;
        if (pct !== null) {
          const rc = retentionColor(pct);
          cells.push(`<td class="px-3 py-2.5 text-center"><span class="inline-flex items-center justify-center w-12 h-7 rounded-md text-xs font-bold ${rc.bg} ${rc.text}">${pct}%</span></td>`);
        } else {
          cells.push('<td class="px-3 py-2.5 text-center text-slate-600">-</td>');
        }
      }
      return `<tr class="border-t border-slate-700/50 hover:bg-slate-700/20 transition-colors">${cells.join('')}</tr>`;
    }).join('');

    el.innerHTML = `
      <div class="mb-4">
        <div class="flex items-center gap-2 text-sm text-slate-400 mb-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"/></svg>
          Users grouped by first visit week. Cells show what % returned in subsequent weeks.
        </div>
      </div>

      <!-- Retention Legend -->
      <div class="flex items-center gap-3 mb-4 flex-wrap">
        <span class="text-xs text-slate-500">Retention:</span>
        <span class="inline-flex items-center gap-1"><span class="w-3 h-3 rounded bg-green-500/80"></span><span class="text-xs text-slate-400">80%+</span></span>
        <span class="inline-flex items-center gap-1"><span class="w-3 h-3 rounded bg-green-500/60"></span><span class="text-xs text-slate-400">60%+</span></span>
        <span class="inline-flex items-center gap-1"><span class="w-3 h-3 rounded bg-green-500/40"></span><span class="text-xs text-slate-400">40%+</span></span>
        <span class="inline-flex items-center gap-1"><span class="w-3 h-3 rounded bg-yellow-500/50"></span><span class="text-xs text-slate-400">25%+</span></span>
        <span class="inline-flex items-center gap-1"><span class="w-3 h-3 rounded bg-orange-500/40"></span><span class="text-xs text-slate-400">15%+</span></span>
        <span class="inline-flex items-center gap-1"><span class="w-3 h-3 rounded bg-red-500/30"></span><span class="text-xs text-slate-400">5%+</span></span>
        <span class="inline-flex items-center gap-1"><span class="w-3 h-3 rounded bg-slate-700/40"></span><span class="text-xs text-slate-400"><5%</span></span>
      </div>

      <!-- Cohort Table -->
      <div class="overflow-x-auto rounded-xl border border-slate-700/50 mb-6">
        <table class="w-full">
          <thead class="bg-slate-800/80"><tr>${headerCells.join('')}</tr></thead>
          <tbody class="bg-slate-800/30">${bodyRows}</tbody>
        </table>
      </div>

      <!-- Retention Curve Chart -->
      <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
        <h3 class="text-sm font-semibold text-white mb-4">Retention Curves by Cohort</h3>
        <div style="height:300px;position:relative;"><canvas id="chart-retention-curves"></canvas></div>
      </div>
    `;

    renderRetentionCurvesChart();
  }

  function renderRetentionCurvesChart() {
    const ctx = document.getElementById('chart-retention-curves');
    if (!ctx || !cohortsData) return;

    const cohorts = cohortsData.cohorts || [];
    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444', '#84cc16'];

    const datasets = cohorts.slice(-5).map((c, i) => ({
      label: c.week,
      data: c.retention,
      borderColor: colors[i % colors.length],
      backgroundColor: 'transparent',
      borderWidth: 2,
      tension: 0.3,
      pointRadius: 4,
      pointBackgroundColor: colors[i % colors.length],
      pointBorderColor: '#1e293b',
      pointBorderWidth: 2,
    }));

    const maxLen = Math.max(...cohorts.map(c => c.retention.length));
    const labels = Array.from({ length: maxLen }, (_, i) => `W+${i}`);

    App.state.chartInstances['beh-retention-curves'] = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        ...chartDefaults(),
        scales: {
          x: { grid: { color: 'rgba(51,65,85,0.4)', drawBorder: false }, ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } } },
          y: { beginAtZero: true, max: 100, grid: { color: 'rgba(51,65,85,0.4)', drawBorder: false }, ticks: { color: '#64748b', font: { family: 'Inter', size: 11 }, callback: v => v + '%' } },
        },
        plugins: {
          ...chartDefaults().plugins,
          legend: { position: 'top', labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 }, usePointStyle: true, pointStyleWidth: 10, padding: 16 } },
        },
      },
    });
  }

  /* ------------------------------------------------------------------
     Timing Tab
  ------------------------------------------------------------------ */
  function renderTimingTab() {
    const el = document.getElementById('beh-tab-timing');
    if (!el || !timingData) return;

    // Generate heatmap HTML
    const heatmapData = timingData.timing_heatmap || [];
    const maxSessions = Math.max(...heatmapData.map(h => h.sessions), 1);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const heatmapRows = dayNames.map((day, dayIdx) => {
      const cells = Array.from({ length: 24 }, (_, hour) => {
        const cell = heatmapData.find(h => h.day_index === dayIdx && h.hour === hour) || { sessions: 0, conversion_rate: 0 };
        const style = heatmapColor(cell.sessions, maxSessions);
        return `<td class="px-0 py-0">
          <div class="w-full h-10 flex flex-col items-center justify-center text-center border border-slate-800/50 rounded-sm cursor-default" style="${style}" title="${day} ${hour}:00 - ${cell.sessions} sessions, ${cell.conversion_rate}% CVR">
            <span class="text-[10px] font-medium text-white/90">${cell.sessions > 0 ? cell.sessions : ''}</span>
            ${cell.conversion_rate > 0 ? `<span class="text-[8px] text-green-300/70">${cell.conversion_rate}%</span>` : ''}
          </div>
        </td>`;
      }).join('');
      return `<tr><td class="px-2 py-0 text-xs font-medium text-slate-400 whitespace-nowrap">${day}</td>${cells}</tr>`;
    }).join('');

    const hourHeaders = Array.from({ length: 24 }, (_, i) => `<th class="px-0 py-1 text-[10px] text-slate-500 text-center font-normal">${i}</th>`).join('');

    // Best/worst conversion hours
    const bestHours = (timingData.best_conversion_hours || []).slice(0, 3);
    const worstHours = (timingData.worst_conversion_hours || []).slice(0, 3);

    el.innerHTML = `
      <!-- Timing Heatmap -->
      <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5 mb-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-sm font-semibold text-white">Activity Heatmap</h3>
            <p class="text-xs text-slate-500 mt-0.5">Session volume by day and hour. Numbers show session count, small text shows conversion rate.</p>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-xs text-slate-500">Low</span>
            <div class="flex gap-0.5">
              <span class="w-4 h-3 rounded-sm" style="background:rgba(51,65,85,0.3)"></span>
              <span class="w-4 h-3 rounded-sm" style="background:rgba(59,130,246,0.15)"></span>
              <span class="w-4 h-3 rounded-sm" style="background:rgba(59,130,246,0.3)"></span>
              <span class="w-4 h-3 rounded-sm" style="background:rgba(59,130,246,0.5)"></span>
              <span class="w-4 h-3 rounded-sm" style="background:rgba(59,130,246,0.75)"></span>
            </div>
            <span class="text-xs text-slate-500">High</span>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full" style="min-width:700px;">
            <thead><tr><th class="px-2 py-1"></th>${hourHeaders}</tr></thead>
            <tbody>${heatmapRows}</tbody>
          </table>
        </div>
      </div>

      <!-- Sessions by Hour + Day of Week Charts -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
          <h3 class="text-sm font-semibold text-white mb-4">Sessions by Hour</h3>
          <div style="height:280px;position:relative;"><canvas id="chart-sessions-hour"></canvas></div>
        </div>
        <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
          <h3 class="text-sm font-semibold text-white mb-4">Sessions by Day of Week</h3>
          <div style="height:280px;position:relative;"><canvas id="chart-sessions-dow"></canvas></div>
        </div>
      </div>

      <!-- Best/Worst Conversion Hours -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
          <h3 class="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"/></svg>
            Best Conversion Hours
          </h3>
          <div class="space-y-3">
            ${bestHours.map((h, i) => `
              <div class="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <div class="flex items-center gap-3">
                  <span class="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center text-xs font-bold text-green-400">${i + 1}</span>
                  <span class="text-sm text-white font-medium">${h.hour}:00 - ${h.hour + 1}:00</span>
                </div>
                <div class="text-right">
                  <div class="text-sm font-bold text-green-400">${h.conversion_rate}%</div>
                  <div class="text-xs text-slate-500">${h.sessions} sessions</div>
                </div>
              </div>`).join('')}
          </div>
        </div>
        <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
          <h3 class="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <svg class="w-4 h-4 text-red-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 014.306 6.43l.776 2.898m0 0l3.182-5.511m-3.182 5.51l-5.511-3.181"/></svg>
            Worst Conversion Hours
          </h3>
          <div class="space-y-3">
            ${worstHours.map((h, i) => `
              <div class="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <div class="flex items-center gap-3">
                  <span class="w-7 h-7 rounded-full bg-red-500/20 flex items-center justify-center text-xs font-bold text-red-400">${i + 1}</span>
                  <span class="text-sm text-white font-medium">${h.hour}:00 - ${h.hour + 1}:00</span>
                </div>
                <div class="text-right">
                  <div class="text-sm font-bold text-red-400">${h.conversion_rate}%</div>
                  <div class="text-xs text-slate-500">${h.sessions} sessions</div>
                </div>
              </div>`).join('')}
          </div>
        </div>
      </div>

      <!-- Duration by Hour Chart -->
      <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
        <h3 class="text-sm font-semibold text-white mb-4">Avg Session Duration by Hour</h3>
        <div style="height:260px;position:relative;"><canvas id="chart-duration-hour"></canvas></div>
      </div>
    `;

    renderSessionsByHourChart();
    renderSessionsByDOWChart();
    renderDurationByHourChart();
  }

  function renderSessionsByHourChart() {
    const ctx = document.getElementById('chart-sessions-hour');
    if (!ctx || !timingData) return;
    const hourly = timingData.sessions_by_hour || [];

    App.state.chartInstances['beh-sessions-hour'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: hourly.map(h => `${h.hour}:00`),
        datasets: [{
          label: 'Sessions',
          data: hourly.map(h => h.sessions),
          backgroundColor: hourly.map(h => {
            if (h.sessions > 200) return 'rgba(59,130,246,0.7)';
            if (h.sessions > 100) return 'rgba(59,130,246,0.5)';
            if (h.sessions > 50) return 'rgba(59,130,246,0.35)';
            return 'rgba(59,130,246,0.2)';
          }),
          borderRadius: 4,
          borderSkipped: false,
        }],
      },
      options: {
        ...chartDefaults(),
        scales: {
          x: { grid: { display: false }, ticks: { color: '#64748b', font: { family: 'Inter', size: 10 }, maxRotation: 0 } },
          y: { beginAtZero: true, grid: { color: 'rgba(51,65,85,0.4)', drawBorder: false }, ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } } },
        },
        plugins: { ...chartDefaults().plugins, legend: { display: false } },
      },
    });
  }

  function renderSessionsByDOWChart() {
    const ctx = document.getElementById('chart-sessions-dow');
    if (!ctx || !timingData) return;
    const dow = timingData.sessions_by_day_of_week || [];

    App.state.chartInstances['beh-sessions-dow'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: dow.map(d => d.day),
        datasets: [{
          label: 'Sessions',
          data: dow.map(d => d.sessions),
          backgroundColor: ['rgba(139,92,246,0.5)', 'rgba(59,130,246,0.7)', 'rgba(59,130,246,0.7)', 'rgba(59,130,246,0.7)', 'rgba(59,130,246,0.7)', 'rgba(59,130,246,0.7)', 'rgba(139,92,246,0.5)'],
          borderRadius: 6,
          borderSkipped: false,
          barThickness: 40,
        }, {
          label: 'Conversions',
          data: dow.map(d => d.conversions),
          backgroundColor: 'rgba(34,197,94,0.6)',
          borderRadius: 6,
          borderSkipped: false,
          barThickness: 40,
        }],
      },
      options: {
        ...chartDefaults(),
        scales: {
          x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { family: 'Inter', size: 12 } } },
          y: { beginAtZero: true, grid: { color: 'rgba(51,65,85,0.4)', drawBorder: false }, ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } } },
        },
        plugins: {
          ...chartDefaults().plugins,
          legend: { position: 'top', labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 }, usePointStyle: true, pointStyleWidth: 10, padding: 16 } },
        },
      },
    });
  }

  function renderDurationByHourChart() {
    const ctx = document.getElementById('chart-duration-hour');
    if (!ctx || !timingData) return;
    const hourly = timingData.avg_duration_by_hour || [];

    App.state.chartInstances['beh-duration-hour'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: hourly.map(h => `${h.hour}:00`),
        datasets: [{
          label: 'Avg Duration (s)',
          data: hourly.map(h => h.avg_duration),
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139,92,246,0.08)',
          borderWidth: 2.5,
          fill: true,
          tension: 0.35,
          pointRadius: 3,
          pointBackgroundColor: '#8b5cf6',
          pointBorderColor: '#1e293b',
          pointBorderWidth: 2,
        }],
      },
      options: {
        ...chartDefaults(),
        scales: {
          x: { grid: { color: 'rgba(51,65,85,0.4)', drawBorder: false }, ticks: { color: '#64748b', font: { family: 'Inter', size: 10 }, maxRotation: 0 } },
          y: { beginAtZero: true, grid: { color: 'rgba(51,65,85,0.4)', drawBorder: false }, ticks: { color: '#64748b', font: { family: 'Inter', size: 11 }, callback: v => v + 's' } },
        },
        plugins: { ...chartDefaults().plugins, legend: { display: false } },
      },
    });
  }

  /* ------------------------------------------------------------------
     Retention Tab (New vs Returning)
  ------------------------------------------------------------------ */
  function renderRetentionTab() {
    const el = document.getElementById('beh-tab-retention');
    if (!el || !retentionData) return;

    const r = retentionData;
    const totalVisitors = (r.new_vs_returning.new || 0) + (r.new_vs_returning.returning || 0);
    const newPct = totalVisitors > 0 ? Math.round((r.new_vs_returning.new / totalVisitors) * 100) : 0;
    const retPct = totalVisitors > 0 ? Math.round((r.new_vs_returning.returning / totalVisitors) * 100) : 0;

    el.innerHTML = `
      <!-- New vs Returning Overview -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <!-- Donut Chart -->
        <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5 flex flex-col items-center">
          <h3 class="text-sm font-semibold text-white mb-4 self-start">New vs Returning Visitors</h3>
          <div style="height:240px;position:relative;width:100%;"><canvas id="chart-new-returning"></canvas></div>
          <div class="flex items-center gap-6 mt-4">
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full bg-blue-500"></span>
              <span class="text-xs text-slate-400">New (${newPct}%)</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full bg-green-500"></span>
              <span class="text-xs text-slate-400">Returning (${retPct}%)</span>
            </div>
          </div>
        </div>

        <!-- Comparison Table -->
        <div class="lg:col-span-2 bg-slate-800 rounded-xl border border-slate-700/50 p-5">
          <h3 class="text-sm font-semibold text-white mb-4">Engagement Comparison</h3>
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-slate-800/80">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Metric</th>
                  <th class="px-4 py-3 text-center text-xs font-semibold text-blue-400 uppercase tracking-wider">New Visitors</th>
                  <th class="px-4 py-3 text-center text-xs font-semibold text-green-400 uppercase tracking-wider">Returning</th>
                  <th class="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Diff</th>
                </tr>
              </thead>
              <tbody class="bg-slate-800/30">
                ${comparisonRow('Visitors', App.formatNumber(r.new_vs_returning.new), App.formatNumber(r.new_vs_returning.returning), null)}
                ${comparisonRow('Avg Pages', r.new_user_engagement.avg_pages, r.returning_user_engagement.avg_pages, true)}
                ${comparisonRow('Avg Duration', App.formatDuration(r.new_user_engagement.avg_duration), App.formatDuration(r.returning_user_engagement.avg_duration), r.returning_user_engagement.avg_duration > r.new_user_engagement.avg_duration)}
                ${comparisonRow('Scroll Depth', r.new_user_engagement.avg_scroll_depth + '%', r.returning_user_engagement.avg_scroll_depth + '%', r.returning_user_engagement.avg_scroll_depth > r.new_user_engagement.avg_scroll_depth)}
                ${comparisonRow('Engagement Score', r.new_user_engagement.avg_engagement, r.returning_user_engagement.avg_engagement, r.returning_user_engagement.avg_engagement > r.new_user_engagement.avg_engagement)}
                ${comparisonRow('Conversion Rate', r.new_user_engagement.conversion_rate + '%', r.returning_user_engagement.conversion_rate + '%', r.returning_user_engagement.conversion_rate > r.new_user_engagement.conversion_rate)}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Return Frequency -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
          <h3 class="text-sm font-semibold text-white mb-4">Return Frequency Distribution</h3>
          <div style="height:280px;position:relative;"><canvas id="chart-return-freq"></canvas></div>
        </div>
        <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
          <h3 class="text-sm font-semibold text-white mb-4">Return Frequency Breakdown</h3>
          <div class="space-y-4 mt-6">
            ${freqBar('Within 1 day', r.return_frequency['1_day'], sumFreq(r.return_frequency), '#3b82f6')}
            ${freqBar('2-3 days', r.return_frequency['2_3_days'], sumFreq(r.return_frequency), '#8b5cf6')}
            ${freqBar('4-7 days', r.return_frequency['4_7_days'], sumFreq(r.return_frequency), '#f59e0b')}
            ${freqBar('7+ days', r.return_frequency['7_plus_days'], sumFreq(r.return_frequency), '#ef4444')}
          </div>
          <div class="mt-6 pt-4 border-t border-slate-700/50">
            <div class="flex items-center justify-between text-sm">
              <span class="text-slate-400">Total Return Events</span>
              <span class="text-white font-semibold">${App.formatNumber(sumFreq(r.return_frequency))}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Summary Stats -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        ${Components.metricCard('Total Sessions', App.formatNumber(r.total_sessions), null)}
        ${Components.metricCard('Total Visitors', App.formatNumber(r.total_visitors), null)}
        ${Components.metricCard('New Visitors', App.formatNumber(r.new_vs_returning.new), null)}
        ${Components.metricCard('Returning Visitors', App.formatNumber(r.new_vs_returning.returning), null)}
      </div>
    `;

    renderNewReturningChart();
    renderReturnFreqChart();
  }

  function comparisonRow(label, newVal, retVal, retWins) {
    const indicator = retWins === null ? '' :
      retWins ? '<span class="text-green-400 text-xs font-medium">Better</span>' :
                '<span class="text-blue-400 text-xs font-medium">Better</span>';
    return `
      <tr class="border-t border-slate-700/50">
        <td class="px-4 py-3 text-sm text-slate-300 font-medium">${label}</td>
        <td class="px-4 py-3 text-sm text-center text-blue-300 font-semibold">${newVal}</td>
        <td class="px-4 py-3 text-sm text-center text-green-300 font-semibold">${retVal}</td>
        <td class="px-4 py-3 text-sm text-center">${indicator}</td>
      </tr>`;
  }

  function sumFreq(freq) {
    return Object.values(freq).reduce((a, b) => a + b, 0);
  }

  function freqBar(label, count, total, color) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return `
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-sm text-slate-300">${label}</span>
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold text-white">${App.formatNumber(count)}</span>
            <span class="text-xs text-slate-500">(${pct}%)</span>
          </div>
        </div>
        <div class="w-full h-2.5 rounded-full bg-slate-700/50">
          <div class="h-full rounded-full transition-all" style="width:${pct}%;background:${color}"></div>
        </div>
      </div>`;
  }

  function renderNewReturningChart() {
    const ctx = document.getElementById('chart-new-returning');
    if (!ctx || !retentionData) return;

    App.state.chartInstances['beh-new-returning'] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['New', 'Returning'],
        datasets: [{
          data: [retentionData.new_vs_returning.new, retentionData.new_vs_returning.returning],
          backgroundColor: ['rgba(59,130,246,0.8)', 'rgba(34,197,94,0.8)'],
          borderColor: '#1e293b',
          borderWidth: 4,
          hoverOffset: 8,
        }],
      },
      options: {
        ...chartDefaults(),
        cutout: '60%',
        plugins: {
          ...chartDefaults().plugins,
          legend: { display: false },
        },
      },
    });
  }

  function renderReturnFreqChart() {
    const ctx = document.getElementById('chart-return-freq');
    if (!ctx || !retentionData) return;
    const freq = retentionData.return_frequency;

    App.state.chartInstances['beh-return-freq'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Within 1 day', '2-3 days', '4-7 days', '7+ days'],
        datasets: [{
          label: 'Return Events',
          data: [freq['1_day'], freq['2_3_days'], freq['4_7_days'], freq['7_plus_days']],
          backgroundColor: ['rgba(59,130,246,0.7)', 'rgba(139,92,246,0.7)', 'rgba(245,158,11,0.7)', 'rgba(239,68,68,0.7)'],
          borderRadius: 8,
          borderSkipped: false,
          barThickness: 50,
        }],
      },
      options: {
        ...chartDefaults(),
        scales: {
          x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { family: 'Inter', size: 11 } } },
          y: { beginAtZero: true, grid: { color: 'rgba(51,65,85,0.4)', drawBorder: false }, ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } } },
        },
        plugins: { ...chartDefaults().plugins, legend: { display: false } },
      },
    });
  }

  /* ------------------------------------------------------------------
     Public API
  ------------------------------------------------------------------ */
  return {
    render,
    switchTab,
    filterBySegment,
  };

})();
