/* ==========================================================================
   funnels-page.js  -  Funnel builder, list & detail views
   Connects to real /api/funnels endpoints, auto-seeds e-commerce funnel
   ========================================================================== */

const FunnelsPage = (() => {

  /* ------------------------------------------------------------------
     State
  ------------------------------------------------------------------ */
  let funnels = [];
  let activeFunnel = null;   // { funnel, results }
  let dateFrom = '';
  let dateTo   = '';
  let seeding  = false;

  /* ------------------------------------------------------------------
     Data helpers
  ------------------------------------------------------------------ */
  async function fetchFunnels() {
    try {
      const projectId = App.state.project || 'default';
      const resp = await App.api(`/funnels?project_id=${encodeURIComponent(projectId)}`);
      funnels = resp.funnels || resp || [];
    } catch (_) {
      funnels = [];
    }
  }

  async function fetchFunnelDetail(id, df, dt) {
    try {
      let url = `/funnels/${id}`;
      const params = [];
      if (df) params.push(`date_from=${encodeURIComponent(df)}`);
      if (dt) params.push(`date_to=${encodeURIComponent(dt)}`);
      if (params.length) url += '?' + params.join('&');
      activeFunnel = await App.api(url);
    } catch (_) {
      activeFunnel = null;
    }
  }

  async function seedEcommerceFunnel() {
    try {
      const projectId = App.state.project || 'default';
      const resp = await App.api('/funnels/seed-ecommerce', {
        method: 'POST',
        body: { project_id: projectId },
      });
      return resp;
    } catch (err) {
      console.error('[funnels] seed error:', err);
      return null;
    }
  }

  async function createFunnel(payload) {
    const created = await App.api('/funnels', {
      method: 'POST',
      body: payload,
    });
    Components.toast('Funnel created successfully', 'success');
    return created;
  }

  async function updateFunnel(id, payload) {
    const updated = await App.api(`/funnels/${id}`, {
      method: 'PUT',
      body: payload,
    });
    Components.toast('Funnel updated successfully', 'success');
    return updated;
  }

  async function deleteFunnel(id) {
    await App.api(`/funnels/${id}`, { method: 'DELETE' });
    Components.toast('Funnel deleted', 'success');
  }

  /* ------------------------------------------------------------------
     Transform API results to display format
     API: { name, type, value, count, rate, dropoff }
     Display: { name, type, value, entered, exited, conversionFromPrev, conversionFromFirst }
  ------------------------------------------------------------------ */
  function transformSteps(apiSteps, totalSessions) {
    if (!apiSteps || apiSteps.length === 0) return [];
    return apiSteps.map((step, i) => {
      const entered = step.count || 0;
      const prevCount = i === 0 ? totalSessions : (apiSteps[i - 1].count || 0);
      const exited = step.dropoff || 0;
      const convFromPrev = i === 0 ? '100.0' : (prevCount > 0 ? ((entered / prevCount) * 100).toFixed(1) : '0.0');
      const convFromFirst = totalSessions > 0 ? ((entered / totalSessions) * 100).toFixed(1) : '0.0';
      return {
        name: step.name || `Step ${i + 1}`,
        type: step.type,
        value: step.value,
        entered,
        exited,
        conversionFromPrev: convFromPrev,
        conversionFromFirst: convFromFirst,
      };
    });
  }

  /* ------------------------------------------------------------------
     Render - Funnels List
  ------------------------------------------------------------------ */
  async function render(container) {
    container.innerHTML = Components.loading();
    await fetchFunnels();

    // Always call seed to keep e-commerce funnel steps up-to-date (creates if missing, updates if exists)
    if (!seeding) {
      seeding = true;
      if (funnels.length === 0) {
        container.innerHTML = `
          <div class="flex flex-col items-center justify-center py-20">
            <div class="relative w-10 h-10 mb-4">
              <div class="absolute inset-0 rounded-full border-2 border-slate-700"></div>
              <div class="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500 animate-spin"></div>
            </div>
            <span class="text-sm text-slate-400">Setting up E-commerce Conversion Funnel...</span>
          </div>`;
      }
      const seedResult = await seedEcommerceFunnel();
      seeding = false;
      if (seedResult) {
        if (funnels.length === 0) Components.toast('E-commerce funnel created automatically', 'success');
        await fetchFunnels();
      }
    }

    const createBtnHTML = `
      <button onclick="FunnelsPage.showCreateModal()"
              class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
        </svg>
        Create Funnel
      </button>`;

    if (funnels.length === 0) {
      container.innerHTML = `
        <div>
          ${Components.sectionHeader('Conversion Funnels', 'Build and analyze multi-step conversion funnels', createBtnHTML)}
          ${Components.emptyState(
            'No Funnels Yet',
            'Create your first funnel to start tracking conversion rates across user journeys.',
            `<svg class="w-12 h-12 text-slate-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
               <path stroke-linecap="round" stroke-linejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z"/>
             </svg>`
          )}
        </div>`;
      return;
    }

    // For each funnel in the list, we need to fetch its detail to get real conversion data
    // Fetch all funnel details in parallel for the list view
    const detailPromises = funnels.map(f =>
      App.api(`/funnels/${f.id}`).catch(() => null)
    );
    const details = await Promise.all(detailPromises);

    const cards = funnels.map((f, idx) => {
      const detail = details[idx];
      const results = detail ? detail.results : null;
      const totalSessions = results ? results.total_sessions : 0;
      const overallConversion = results ? results.overall_conversion : 0;
      const stepsData = results ? transformSteps(results.steps, totalSessions) : [];
      const stepCount = (f.steps || []).length;

      const convRate = parseFloat(overallConversion) || 0;
      const convColor = convRate >= 15 ? 'text-green-400' : convRate >= 5 ? 'text-blue-400' : convRate > 0 ? 'text-amber-400' : 'text-slate-500';

      // Mini funnel sparkline
      const sparkSvg = miniBarsSvg(stepsData, 100, 36);

      return `
        <div onclick="App.navigate('funnels/${f.id}')"
             class="bg-slate-800 rounded-xl border border-slate-700/50 p-5 cursor-pointer hover:border-blue-500/30 hover:bg-slate-800/80 transition-all group">
          <div class="flex items-start justify-between mb-4">
            <div class="min-w-0 flex-1">
              <h3 class="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors truncate">${escHtml(f.name)}</h3>
              <p class="text-xs text-slate-500 mt-0.5">${stepCount} step${stepCount !== 1 ? 's' : ''}</p>
            </div>
            <svg class="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/>
            </svg>
          </div>
          <div class="flex items-end justify-between gap-4">
            <div>
              <div class="text-2xl font-bold ${convColor}">${convRate}%</div>
              <div class="text-xs text-slate-500 mt-0.5">conversion rate</div>
            </div>
            <div class="opacity-60 group-hover:opacity-100 transition-opacity">
              ${sparkSvg}
            </div>
          </div>
          <div class="mt-3 pt-3 border-t border-slate-700/40 flex items-center justify-between">
            <span class="text-xs text-slate-500">${App.formatNumber(totalSessions)} sessions</span>
            <span class="text-xs text-slate-500">${f.created_at ? App.formatDate(f.created_at) : 'Recently'}</span>
          </div>
        </div>`;
    }).join('');

    container.innerHTML = `
      <div>
        ${Components.sectionHeader('Conversion Funnels', 'Build and analyze multi-step conversion funnels', createBtnHTML)}
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          ${cards}
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------
     Mini bar sparkline SVG for list view
  ------------------------------------------------------------------ */
  function miniBarsSvg(steps, width, height) {
    width = width || 120;
    height = height || 40;
    if (!steps || steps.length === 0) return '';

    const count = steps.length;
    const barWidth = Math.floor((width - (count - 1) * 3) / count);
    const maxVal = steps[0].entered || 1;
    const bars = steps.map((step, i) => {
      const val = step.entered || 0;
      const barH = Math.max(4, Math.round((val / maxVal) * height));
      const x = i * (barWidth + 3);
      const y = height - barH;
      const opacity = 1 - i * 0.12;
      return `<rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="2" fill="rgb(59,130,246)" opacity="${Math.max(0.3, opacity)}"/>`;
    });

    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="flex-shrink-0">${bars.join('')}</svg>`;
  }

  /* ------------------------------------------------------------------
     Render - Funnel Detail (beautiful visualization)
  ------------------------------------------------------------------ */
  async function renderDetail(container, funnelId) {
    container.innerHTML = Components.loading();

    // Use global date range or funnel-specific
    const df = dateFrom || App.state.dateRange.start;
    const dt = dateTo || App.state.dateRange.end;
    await fetchFunnelDetail(funnelId, df, dt);

    if (!activeFunnel || !activeFunnel.funnel) {
      container.innerHTML = Components.emptyState('Funnel Not Found', 'The funnel you are looking for does not exist or has been deleted.');
      return;
    }

    const f = activeFunnel.funnel;
    const results = activeFunnel.results || {};
    const totalSessions = results.total_sessions || 0;
    const overallConversion = results.overall_conversion || 0;
    const steps = transformSteps(results.steps || [], totalSessions);

    // ── Header ──
    const headerHTML = `
      <div class="flex items-center gap-2 text-sm text-slate-400 mb-5">
        <a href="#funnels" class="hover:text-white transition-colors">Funnels</a>
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/>
        </svg>
        <span class="text-white">${escHtml(f.name)}</span>
      </div>

      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 class="text-xl font-bold text-white">${escHtml(f.name)}</h1>
          <p class="text-sm text-slate-400 mt-1">${steps.length} steps &middot; ${App.formatNumber(totalSessions)} total sessions</p>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <!-- Date filter -->
          <div class="flex items-center gap-2 bg-slate-800 rounded-lg border border-slate-700/50 px-3 py-1.5">
            <svg class="w-4 h-4 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/>
            </svg>
            <input type="date" id="funnel-date-from" value="${escHtml(df)}"
                   onchange="FunnelsPage.setDateFrom(this.value)"
                   class="bg-transparent border-none text-xs text-slate-300 focus:outline-none w-[105px] cursor-pointer" />
            <span class="text-slate-600 text-xs">to</span>
            <input type="date" id="funnel-date-to" value="${escHtml(dt)}"
                   onchange="FunnelsPage.setDateTo(this.value)"
                   class="bg-transparent border-none text-xs text-slate-300 focus:outline-none w-[105px] cursor-pointer" />
          </div>
          <button onclick="FunnelsPage.refreshDetail('${escHtml(f.id)}')"
                  class="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors">
            Apply
          </button>
          <button onclick="FunnelsPage.showEditModal('${escHtml(f.id)}')"
                  class="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 border border-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">
            Edit
          </button>
          <button onclick="FunnelsPage.confirmDelete('${escHtml(f.id)}')"
                  class="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors">
            Delete
          </button>
        </div>
      </div>`;

    // ── Summary metrics ──
    const lastStep = steps.length > 0 ? steps[steps.length - 1] : null;
    const biggestDropIdx = steps.reduce((maxI, step, i) => {
      if (i === 0) return maxI;
      const rate = 100 - parseFloat(step.conversionFromPrev);
      const maxRate = maxI === -1 ? -1 : (100 - parseFloat(steps[maxI].conversionFromPrev));
      return rate > maxRate ? i : maxI;
    }, -1);

    const summaryHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        ${Components.metricCard('Overall Conversion', `${overallConversion}%`, null,
          `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"/></svg>`)}
        ${Components.metricCard('Total Sessions', App.formatNumber(totalSessions), null,
          `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>`)}
        ${Components.metricCard('Completed', App.formatNumber(lastStep ? lastStep.entered : 0), null,
          `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`)}
        ${biggestDropIdx > 0
          ? Components.metricCard('Biggest Drop-off', `Step ${biggestDropIdx + 1}`, null,
              `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>`)
          : Components.metricCard('Funnel Steps', `${steps.length}`, null,
              `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z"/></svg>`)}
      </div>`;

    // ── Beautiful Funnel Visualization ──
    const funnelVizHTML = buildFunnelVisualization(steps, totalSessions);

    // ── Detailed Table ──
    const tableHTML = buildStepsTable(steps, totalSessions);

    container.innerHTML = `
      <div>
        ${headerHTML}
        ${summaryHTML}
        ${funnelVizHTML}
        ${tableHTML}
      </div>`;
  }

  /* ------------------------------------------------------------------
     Beautiful gradient funnel visualization
  ------------------------------------------------------------------ */
  function buildFunnelVisualization(steps, totalSessions) {
    if (steps.length === 0 || totalSessions === 0) {
      return `
        <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-8 mb-6 text-center">
          <svg class="w-16 h-16 text-slate-600 mx-auto mb-3" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z"/>
          </svg>
          <p class="text-sm text-slate-400">No session data yet for this date range.</p>
          <p class="text-xs text-slate-500 mt-1">Funnel results will appear here once sessions are recorded.</p>
        </div>`;
    }

    const maxCount = steps[0].entered || 1;

    // Build trapezoid funnel sections
    const sections = steps.map((step, i) => {
      const widthPct = Math.max(15, (step.entered / maxCount) * 100);
      const nextWidthPct = i < steps.length - 1
        ? Math.max(15, (steps[i + 1].entered / maxCount) * 100)
        : widthPct * 0.7;

      const hue = 220 - (i * 25);
      const sat = 70 + (i * 3);
      const light = 55 + (i * 5);
      const color = `hsl(${Math.max(170, hue)}, ${Math.min(90, sat)}%, ${Math.min(75, light)}%)`;

      const convPrev = i === 0 ? 100 : parseFloat(step.conversionFromPrev);
      const dropColor = convPrev >= 70 ? 'text-green-400' : convPrev >= 40 ? 'text-amber-400' : 'text-red-400';

      // Arrow between sections
      const arrowHTML = i < steps.length - 1 ? `
        <div class="flex flex-col items-center py-1">
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3"/>
            </svg>
            <span class="text-xs font-semibold ${steps[i + 1] ? (100 - parseFloat(steps[i + 1].conversionFromPrev) > 50 ? 'text-red-400' : 100 - parseFloat(steps[i + 1].conversionFromPrev) > 30 ? 'text-amber-400' : 'text-green-400') : 'text-slate-500'}">
              -${steps[i + 1] ? (100 - parseFloat(steps[i + 1].conversionFromPrev)).toFixed(1) : 0}% drop
            </span>
            <span class="text-[10px] text-slate-600">(${App.formatNumber(steps[i + 1] ? steps[i + 1].exited : 0)} left)</span>
          </div>
        </div>` : '';

      return `
        <div class="flex flex-col items-center">
          <!-- Funnel section -->
          <div class="relative transition-all duration-300" style="width:${widthPct}%; min-width:200px;">
            <div class="relative rounded-xl py-4 px-5 text-center border border-white/10"
                 style="background: linear-gradient(135deg, ${color}, ${color}dd); box-shadow: 0 4px 20px ${color}33;">
              <!-- Step number badge -->
              <div class="absolute -top-2.5 -left-2.5 w-6 h-6 rounded-full bg-slate-900 border-2 flex items-center justify-center text-[10px] font-bold text-white"
                   style="border-color: ${color};">
                ${i + 1}
              </div>
              <p class="text-sm font-semibold text-white mb-1">${escHtml(step.name)}</p>
              <div class="flex items-center justify-center gap-3">
                <span class="text-lg font-bold text-white">${App.formatNumber(step.entered)}</span>
                <span class="text-xs font-medium text-white/70">${step.conversionFromFirst}%</span>
              </div>
              <p class="text-[10px] text-white/50 mt-1">${step.type === 'url' ? step.value : 'Event: ' + step.value}</p>
            </div>
          </div>
          ${arrowHTML}
        </div>`;
    }).join('');

    return `
      <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-6 mb-6">
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-sm font-semibold text-white">Funnel Visualization</h3>
          <span class="text-xs text-slate-500">${App.formatNumber(totalSessions)} total sessions</span>
        </div>
        <div class="flex flex-col items-center gap-1 py-4">
          ${sections}
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------
     Detailed steps table
  ------------------------------------------------------------------ */
  function buildStepsTable(steps, totalSessions) {
    if (steps.length === 0) return '';

    const rows = steps.map((step, i) => {
      const convPrev = parseFloat(step.conversionFromPrev);
      const convFirst = parseFloat(step.conversionFromFirst);
      const dropRate = i === 0 ? 0 : (100 - convPrev);

      // Progress bar width
      const barWidth = totalSessions > 0 ? Math.max(2, (step.entered / totalSessions) * 100) : 0;

      const convColor = i === 0 ? 'text-green-400' : convPrev >= 70 ? 'text-green-400' : convPrev >= 40 ? 'text-amber-400' : 'text-red-400';
      const dropColor = dropRate > 50 ? 'text-red-400' : dropRate > 30 ? 'text-amber-400' : 'text-green-400';

      return `
        <tr class="border-t border-slate-700/50 hover:bg-slate-700/30 transition-colors">
          <td class="px-4 py-3.5">
            <div class="flex items-center gap-3">
              <span class="flex-shrink-0 w-7 h-7 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-400">${i + 1}</span>
              <div>
                <span class="text-sm font-medium text-white">${escHtml(step.name)}</span>
                <span class="block text-xs text-slate-500 mt-0.5">${step.type === 'url' ? 'URL: ' : 'Event: '}${escHtml(step.value)}</span>
              </div>
            </div>
          </td>
          <td class="px-4 py-3.5 text-right">
            <span class="text-sm font-semibold text-white">${App.formatNumber(step.entered)}</span>
            <div class="mt-1.5 w-24 ml-auto">
              <div class="h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
                <div class="h-full rounded-full bg-blue-500 transition-all" style="width:${barWidth}%"></div>
              </div>
            </div>
          </td>
          <td class="px-4 py-3.5 text-right">
            <span class="text-sm font-semibold ${convColor}">${i === 0 ? '100%' : convPrev.toFixed(1) + '%'}</span>
            ${i > 0 ? `<span class="block text-xs text-slate-500 mt-0.5">${convFirst}% from start</span>` : ''}
          </td>
          <td class="px-4 py-3.5 text-right">
            <span class="text-sm text-slate-300">${i === 0 ? '--' : App.formatNumber(step.exited)}</span>
          </td>
          <td class="px-4 py-3.5 text-right">
            ${i === 0
              ? '<span class="text-sm text-slate-500">--</span>'
              : `<span class="text-sm font-semibold ${dropColor}">${dropRate.toFixed(1)}%</span>`}
          </td>
        </tr>`;
    }).join('');

    return `
      <div class="mb-6">
        <h3 class="text-sm font-semibold text-white mb-3">Step-by-Step Breakdown</h3>
        <div class="overflow-x-auto rounded-xl border border-slate-700/50">
          <table class="w-full">
            <thead class="bg-slate-800/80">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider" style="width:35%">Step</th>
                <th class="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Sessions</th>
                <th class="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Conversion</th>
                <th class="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Drop-off</th>
                <th class="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Drop Rate</th>
              </tr>
            </thead>
            <tbody class="bg-slate-800/30">
              ${rows}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------
     Date filter helpers
  ------------------------------------------------------------------ */
  function setDateFrom(val) { dateFrom = val; }
  function setDateTo(val) { dateTo = val; }

  function refreshDetail(funnelId) {
    const container = document.getElementById('main-content');
    if (container) renderDetail(container, funnelId);
  }

  /* ------------------------------------------------------------------
     Create Funnel Modal
  ------------------------------------------------------------------ */
  let modalSteps = [];

  function showCreateModal() {
    modalSteps = [
      { type: 'url', value: '', label: '' },
      { type: 'url', value: '', label: '' },
    ];
    renderCreateModal();
  }

  function renderCreateModal() {
    const stepsHTML = modalSteps.map((step, i) => `
      <div class="flex items-start gap-2 p-3 bg-slate-700/30 rounded-lg border border-slate-600/30" data-step-idx="${i}">
        <div class="flex flex-col gap-1.5 mt-1.5 flex-shrink-0">
          ${i > 0 ? `<button onclick="FunnelsPage.moveStep(${i}, -1)" class="text-slate-500 hover:text-slate-300 transition-colors" title="Move up">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5"/></svg>
          </button>` : '<div class="w-3.5 h-3.5"></div>'}
          ${i < modalSteps.length - 1 ? `<button onclick="FunnelsPage.moveStep(${i}, 1)" class="text-slate-500 hover:text-slate-300 transition-colors" title="Move down">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>
          </button>` : '<div class="w-3.5 h-3.5"></div>'}
        </div>
        <span class="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-400 mt-1.5">${i + 1}</span>
        <div class="flex-1 grid grid-cols-3 gap-2">
          <select id="step-type-${i}" onchange="FunnelsPage.updateStepType(${i}, this.value)"
                  class="bg-slate-700/60 border border-slate-600/40 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/50">
            <option value="url" ${step.type === 'url' ? 'selected' : ''}>URL Visit</option>
            <option value="event" ${step.type === 'event' ? 'selected' : ''}>Custom Event</option>
          </select>
          <input type="text" id="step-value-${i}" value="${escHtml(step.value)}" placeholder="${step.type === 'url' ? '/pricing' : 'signup_complete'}"
                 onchange="FunnelsPage.updateStepValue(${i}, this.value)"
                 class="bg-slate-700/60 border border-slate-600/40 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50" />
          <input type="text" id="step-label-${i}" value="${escHtml(step.label)}" placeholder="Step label"
                 onchange="FunnelsPage.updateStepLabel(${i}, this.value)"
                 class="bg-slate-700/60 border border-slate-600/40 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50" />
        </div>
        ${modalSteps.length > 2 ? `
          <button onclick="FunnelsPage.removeStep(${i})" class="flex-shrink-0 mt-1.5 text-slate-500 hover:text-red-400 transition-colors p-0.5" title="Remove step">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        ` : '<div class="w-5"></div>'}
      </div>
    `).join('');

    const content = `
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-slate-400 mb-1.5">Funnel Name</label>
          <input type="text" id="funnel-name-input" placeholder="e.g. Signup Flow"
                 class="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50" />
        </div>
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="block text-xs font-medium text-slate-400">Steps</label>
            <span class="text-xs text-slate-500">${modalSteps.length} step${modalSteps.length !== 1 ? 's' : ''} (min 2)</span>
          </div>
          <div class="space-y-2" id="modal-steps-container">
            ${stepsHTML}
          </div>
          <button onclick="FunnelsPage.addStep()"
                  class="mt-3 w-full py-2 rounded-lg border border-dashed border-slate-600/50 text-xs font-medium text-slate-400 hover:text-blue-400 hover:border-blue-500/40 transition-colors flex items-center justify-center gap-1.5">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
            Add Step
          </button>
        </div>
      </div>`;

    Components.showModal('Create Funnel', content, [
      { label: 'Create Funnel', onClick: 'FunnelsPage.confirmCreate()' },
    ]);

    setTimeout(() => {
      const inp = document.getElementById('funnel-name-input');
      if (inp) inp.focus();
    }, 100);
  }

  /* -- Step manipulation for modal -- */

  function addStep() {
    modalSteps.push({ type: 'url', value: '', label: '' });
    refreshModalSteps();
  }

  function removeStep(index) {
    if (modalSteps.length <= 2) {
      Components.toast('Minimum 2 steps required', 'warning');
      return;
    }
    modalSteps.splice(index, 1);
    refreshModalSteps();
  }

  function moveStep(index, direction) {
    const newIdx = index + direction;
    if (newIdx < 0 || newIdx >= modalSteps.length) return;
    syncStepsFromDOM();
    const temp = modalSteps[index];
    modalSteps[index] = modalSteps[newIdx];
    modalSteps[newIdx] = temp;
    refreshModalSteps();
  }

  function updateStepType(index, value) {
    syncStepsFromDOM();
    modalSteps[index].type = value;
    const valInput = document.getElementById(`step-value-${index}`);
    if (valInput) valInput.placeholder = value === 'url' ? '/pricing' : 'signup_complete';
  }

  function updateStepValue(index, value) {
    modalSteps[index].value = value;
  }

  function updateStepLabel(index, value) {
    modalSteps[index].label = value;
  }

  function syncStepsFromDOM() {
    modalSteps.forEach((step, i) => {
      const typeEl = document.getElementById(`step-type-${i}`);
      const valEl = document.getElementById(`step-value-${i}`);
      const lblEl = document.getElementById(`step-label-${i}`);
      if (typeEl) step.type = typeEl.value;
      if (valEl) step.value = valEl.value;
      if (lblEl) step.label = lblEl.value;
    });
  }

  function refreshModalSteps() {
    Components.closeModal();
    renderCreateModal();
  }

  async function confirmCreate() {
    const nameEl = document.getElementById('funnel-name-input');
    const name = nameEl ? nameEl.value.trim() : '';

    if (!name) {
      Components.toast('Please enter a funnel name', 'warning');
      return;
    }

    syncStepsFromDOM();

    const validSteps = modalSteps.filter(s => s.value.trim() !== '');
    if (validSteps.length < 2) {
      Components.toast('At least 2 steps with values are required', 'warning');
      return;
    }

    validSteps.forEach((s, i) => {
      if (!s.label.trim()) {
        s.label = s.type === 'url' ? `Page: ${s.value}` : `Event: ${s.value}`;
      }
      s.name = s.label;
    });

    Components.closeModal();

    try {
      await createFunnel({
        name,
        projectId: App.state.project || 'default',
        steps: validSteps.map(s => ({ type: s.type, value: s.value, name: s.name || s.label })),
      });
    } catch (_) {
      // toast already shown by API helper
    }

    const container = document.getElementById('main-content');
    render(container);
  }

  /* ------------------------------------------------------------------
     Edit Funnel Modal
  ------------------------------------------------------------------ */
  function showEditModal(funnelId) {
    const f = (activeFunnel && activeFunnel.funnel) ? activeFunnel.funnel : funnels.find(fn => fn.id === funnelId);
    if (!f) return;

    const inputClass = 'w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50';

    Components.showModal(
      'Edit Funnel',
      `<div>
         <label class="block text-xs font-medium text-slate-400 mb-1.5">Funnel Name</label>
         <input type="text" id="edit-funnel-name" value="${escHtml(f.name)}" class="${inputClass}" />
       </div>`,
      [{
        label: 'Save Changes',
        onClick: `FunnelsPage.confirmEdit('${escHtml(funnelId)}')`,
      }]
    );

    setTimeout(() => {
      const inp = document.getElementById('edit-funnel-name');
      if (inp) { inp.focus(); inp.select(); }
    }, 100);
  }

  async function confirmEdit(funnelId) {
    const nameEl = document.getElementById('edit-funnel-name');
    const name = nameEl ? nameEl.value.trim() : '';
    if (!name) {
      Components.toast('Name cannot be empty', 'warning');
      return;
    }

    Components.closeModal();
    try {
      await updateFunnel(funnelId, { name });
    } catch (_) {}

    const container = document.getElementById('main-content');
    renderDetail(container, funnelId);
  }

  /* ------------------------------------------------------------------
     Delete Funnel
  ------------------------------------------------------------------ */
  function confirmDelete(funnelId) {
    Components.showModal(
      'Delete Funnel',
      `<p class="text-sm text-slate-300">Are you sure you want to delete this funnel? This action cannot be undone.</p>`,
      [{
        label: 'Delete',
        class: 'bg-red-600 hover:bg-red-700 text-white',
        onClick: `FunnelsPage.executeDelete('${escHtml(funnelId)}')`,
      }]
    );
  }

  async function executeDelete(funnelId) {
    Components.closeModal();
    try {
      await deleteFunnel(funnelId);
    } catch (_) {}
    App.navigate('funnels');
  }

  /* ------------------------------------------------------------------
     Helpers
  ------------------------------------------------------------------ */
  function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  /* ------------------------------------------------------------------
     Public API
  ------------------------------------------------------------------ */
  return {
    render,
    renderDetail,
    showCreateModal,
    addStep,
    removeStep,
    moveStep,
    updateStepType,
    updateStepValue,
    updateStepLabel,
    confirmCreate,
    showEditModal,
    confirmEdit,
    confirmDelete,
    executeDelete,
    setDateFrom,
    setDateTo,
    refreshDetail,
  };

})();
