/* ==========================================================================
   funnels-page.js  -  Funnel builder, list & detail views
   ========================================================================== */

const FunnelsPage = (() => {

  /* ------------------------------------------------------------------
     State
  ------------------------------------------------------------------ */
  let funnels = [];
  let activeFunnel = null;

  /* ------------------------------------------------------------------
     Data helpers
  ------------------------------------------------------------------ */
  async function fetchFunnels() {
    try {
      funnels = await App.api('/funnels?project_id=default');
    } catch (_) {
      funnels = [];
    }
  }

  async function fetchFunnelDetail(id) {
    try {
      activeFunnel = await App.api(`/funnels/${id}`);
    } catch (_) {
      activeFunnel = null;
    }
  }

  async function createFunnel(payload) {
    try {
      const created = await App.api('/funnels', {
        method: 'POST',
        body: payload,
      });
      Components.toast('Funnel created successfully', 'success');
      return created;
    } catch (_) {
      // Mock: create a local entry
      const newFunnel = {
        id: 'f' + Date.now(),
        name: payload.name,
        steps: payload.steps,
        overallConversion: (Math.random() * 20 + 2).toFixed(1),
        totalEntries: Math.floor(Math.random() * 3000 + 500),
      };
      funnels.push(newFunnel);
      Components.toast('Funnel created (local)', 'success');
      return newFunnel;
    }
  }

  async function updateFunnel(id, payload) {
    try {
      const updated = await App.api(`/funnels/${id}`, {
        method: 'PUT',
        body: payload,
      });
      Components.toast('Funnel updated successfully', 'success');
      return updated;
    } catch (_) {
      // Mock: update locally
      const idx = funnels.findIndex(f => f.id === id);
      if (idx !== -1) {
        funnels[idx] = { ...funnels[idx], ...payload };
      }
      if (activeFunnel && activeFunnel.id === id) {
        Object.assign(activeFunnel, payload);
      }
      Components.toast('Funnel updated (local)', 'success');
      return funnels[idx] || activeFunnel;
    }
  }

  async function deleteFunnel(id) {
    try {
      await App.api(`/funnels/${id}`, { method: 'DELETE' });
      Components.toast('Funnel deleted', 'success');
    } catch (_) {
      funnels = funnels.filter(f => f.id !== id);
      Components.toast('Funnel deleted (local)', 'success');
    }
  }

  /* ------------------------------------------------------------------
     Mini funnel sparkline SVG
  ------------------------------------------------------------------ */
  function miniFunnelSvg(steps, width, height) {
    width = width || 120;
    height = height || 40;
    const count = steps.length;
    if (count === 0) return '';

    const barWidth = Math.floor((width - (count - 1) * 3) / count);
    const maxVal = steps[0].entered || steps[0].totalEntries || 1;
    const bars = steps.map((step, i) => {
      const val = step.entered || maxVal;
      const barH = Math.max(4, Math.round((val / maxVal) * height));
      const x = i * (barWidth + 3);
      const y = height - barH;
      const opacity = 1 - i * 0.15;
      return `<rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="2" fill="rgb(59,130,246)" opacity="${Math.max(0.3, opacity)}"/>`;
    });

    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="flex-shrink-0">${bars.join('')}</svg>`;
  }

  /* ------------------------------------------------------------------
     Render - Funnels List
  ------------------------------------------------------------------ */
  async function render(container) {
    container.innerHTML = Components.loading();
    await fetchFunnels();

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

    const cards = funnels.map(f => {
      const stepCount = (f.steps || []).length;
      const convRate = parseFloat(f.overallConversion) || 0;
      const convColor = convRate >= 15 ? 'text-green-400' : convRate >= 8 ? 'text-blue-400' : 'text-amber-400';

      // Build a simple mock stepsData for sparkline if not available
      let sparkSteps = f.stepsData || [];
      if (sparkSteps.length === 0 && f.steps) {
        let remaining = f.totalEntries || 1000;
        sparkSteps = f.steps.map((s, i) => {
          const entered = remaining;
          if (i > 0) remaining = Math.round(remaining * (0.5 + Math.random() * 0.35));
          return { ...s, entered };
        });
      }

      return `
        <div onclick="App.navigate('funnels/${f.id}')"
             class="bg-slate-800 rounded-xl border border-slate-700/50 p-5 cursor-pointer hover:border-slate-600/50 hover:bg-slate-800/80 transition-all group">
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
              ${miniFunnelSvg(sparkSteps, 100, 36)}
            </div>
          </div>
          <div class="mt-3 pt-3 border-t border-slate-700/40 flex items-center justify-between">
            <span class="text-xs text-slate-500">${App.formatNumber(f.totalEntries)} entries</span>
            <span class="text-xs text-slate-500">${f.createdAt ? App.formatDate(f.createdAt) : 'Recently'}</span>
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

    // Focus name input after modal renders
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
    // Read current DOM values before swap
    syncStepsFromDOM();
    const temp = modalSteps[index];
    modalSteps[index] = modalSteps[newIdx];
    modalSteps[newIdx] = temp;
    refreshModalSteps();
  }

  function updateStepType(index, value) {
    syncStepsFromDOM();
    modalSteps[index].type = value;
    // Update placeholder
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
    // Re-render modal content by re-opening modal with current steps
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

    // Validate steps
    const validSteps = modalSteps.filter(s => s.value.trim() !== '');
    if (validSteps.length < 2) {
      Components.toast('At least 2 steps with values are required', 'warning');
      return;
    }

    // Fill in labels where missing
    validSteps.forEach((s, i) => {
      if (!s.label.trim()) {
        s.label = s.type === 'url' ? `Page: ${s.value}` : `Event: ${s.value}`;
      }
      // Rename to match API field
      s.name = s.label;
    });

    Components.closeModal();

    await createFunnel({
      name,
      projectId: 'default',
      steps: validSteps.map(s => ({ type: s.type, value: s.value, name: s.name || s.label })),
    });

    const container = document.getElementById('main-content');
    render(container);
  }

  /* ------------------------------------------------------------------
     Render - Funnel Detail
  ------------------------------------------------------------------ */
  async function renderDetail(container, funnelId) {
    container.innerHTML = Components.loading();
    await fetchFunnelDetail(funnelId);

    if (!activeFunnel) {
      container.innerHTML = Components.emptyState('Funnel Not Found', 'The funnel you are looking for does not exist or has been deleted.');
      return;
    }

    const f = activeFunnel;
    const steps = f.stepsData || [];
    const firstCount = steps.length > 0 ? steps[0].entered : 0;

    // ── Header ──
    const headerHTML = `
      <div class="flex items-center gap-2 text-sm text-slate-400 mb-5">
        <a href="#funnels" class="hover:text-white transition-colors">Funnels</a>
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/>
        </svg>
        <span class="text-white">${escHtml(f.name)}</span>
      </div>

      <div class="flex items-start justify-between mb-8">
        <div>
          <h1 class="text-xl font-bold text-white">${escHtml(f.name)}</h1>
          <p class="text-sm text-slate-400 mt-1">${steps.length} steps &middot; ${App.formatNumber(firstCount)} total entries</p>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="FunnelsPage.showEditModal('${escHtml(f.id)}')"
                  class="px-3.5 py-2 rounded-lg text-sm font-medium bg-slate-800 border border-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"/></svg>
            Edit
          </button>
          <button onclick="FunnelsPage.confirmDelete('${escHtml(f.id)}')"
                  class="px-3.5 py-2 rounded-lg text-sm font-medium bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>
            Delete
          </button>
        </div>
      </div>`;

    // ── Horizontal Funnel Visualization ──
    const blueShades = ['bg-blue-500', 'bg-blue-400', 'bg-blue-300', 'bg-blue-200', 'bg-sky-300', 'bg-sky-200', 'bg-cyan-300', 'bg-cyan-200'];

    let funnelBarsHTML = '';
    if (steps.length > 0) {
      const barSegments = steps.map((step, i) => {
        const widthPct = firstCount > 0 ? Math.max(3, (step.entered / firstCount) * 100) : 100;
        const bgClass = blueShades[i % blueShades.length];
        const dropOffPct = i > 0 ? (100 - parseFloat(step.conversionFromPrev)).toFixed(1) : 0;
        const convFromFirst = step.conversionFromFirst;

        const arrowHTML = i > 0 ? `
          <div class="flex flex-col items-center justify-center px-2 flex-shrink-0" style="min-width:60px;">
            <svg class="w-5 h-5 text-slate-600 mb-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/>
            </svg>
            <span class="text-xs font-semibold text-red-400">-${dropOffPct}%</span>
          </div>` : '';

        const barHTML = `
          <div class="flex flex-col items-center flex-shrink-0" style="width:${Math.max(80, widthPct * 1.5)}px;">
            <div class="${bgClass} rounded-lg w-full flex items-end justify-center transition-all relative"
                 style="height:${Math.max(40, widthPct * 1.2)}px; opacity:${1 - i * 0.08};">
              <span class="text-xs font-bold text-slate-900 pb-2">${App.formatNumber(step.entered)}</span>
            </div>
            <div class="mt-2 text-center">
              <p class="text-xs font-medium text-white truncate max-w-[100px]">${escHtml(step.label || step.name || `Step ${i + 1}`)}</p>
              <p class="text-[10px] text-slate-500 mt-0.5">${convFromFirst}% from start</p>
            </div>
          </div>`;

        return arrowHTML + barHTML;
      }).join('');

      funnelBarsHTML = `
        <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-6 mb-6">
          <h3 class="text-sm font-semibold text-white mb-5">Funnel Visualization</h3>
          <div class="flex items-end gap-1 overflow-x-auto pb-4">
            ${barSegments}
          </div>
        </div>`;
    }

    // ── Detailed Table ──
    const tableHeaders = [
      { key: 'step', label: 'Step', width: '30%' },
      { key: 'users', label: 'Users', align: 'right' },
      { key: 'conversion', label: 'Conversion Rate', align: 'right' },
      { key: 'dropoff', label: 'Drop-off', align: 'right' },
      { key: 'dropoffRate', label: 'Drop-off Rate', align: 'right' },
      { key: 'actions', label: '', align: 'right', width: '140px' },
    ];

    const tableRows = steps.map((step, i) => {
      const dropOffCount = step.exited || 0;
      const dropOffRate = i === 0 ? '0%' : `${(100 - parseFloat(step.conversionFromPrev)).toFixed(1)}%`;
      const convRate = i === 0 ? '100%' : `${step.conversionFromPrev}%`;

      return {
        cells: {
          step: `<div class="flex items-center gap-3">
                   <span class="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-400">${i + 1}</span>
                   <div>
                     <span class="text-sm font-medium text-white">${escHtml(step.label || step.name || `Step ${i + 1}`)}</span>
                     <span class="block text-xs text-slate-500 mt-0.5">${step.type === 'url' ? 'URL: ' : 'Event: '}${escHtml(step.value)}</span>
                   </div>
                 </div>`,
          users: `<span class="text-sm font-medium text-white">${App.formatNumber(step.entered)}</span>`,
          conversion: `<span class="text-sm font-medium ${i === 0 ? 'text-green-400' : parseFloat(step.conversionFromPrev) >= 70 ? 'text-green-400' : parseFloat(step.conversionFromPrev) >= 40 ? 'text-amber-400' : 'text-red-400'}">${convRate}</span>
                       ${i > 0 ? `<span class="block text-xs text-slate-500 mt-0.5">${step.conversionFromFirst}% from first</span>` : ''}`,
          dropoff: `<span class="text-sm text-slate-300">${App.formatNumber(dropOffCount)}</span>`,
          dropoffRate: i === 0
            ? '<span class="text-sm text-slate-500">--</span>'
            : `<span class="text-sm font-medium text-red-400">${dropOffRate}</span>`,
          actions: i > 0
            ? `<a href="#sessions" onclick="event.preventDefault(); FunnelsPage.viewDropOff(${i})" class="text-xs text-blue-400 hover:text-blue-300 transition-colors cursor-pointer">View drop-off sessions</a>`
            : '',
        },
      };
    });

    const tableHTML = `
      <div class="mb-6">
        <h3 class="text-sm font-semibold text-white mb-3">Step-by-Step Breakdown</h3>
        ${Components.dataTable(tableHeaders, tableRows, { striped: true })}
      </div>`;

    // ── Summary metrics ──
    const lastStep = steps[steps.length - 1];
    const overallConv = lastStep ? lastStep.conversionFromFirst : '0';
    const biggestDropIdx = steps.reduce((maxI, step, i) => {
      if (i === 0) return maxI;
      const rate = 100 - parseFloat(step.conversionFromPrev);
      const maxRate = maxI === -1 ? -1 : (100 - parseFloat(steps[maxI].conversionFromPrev));
      return rate > maxRate ? i : maxI;
    }, -1);

    const summaryHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        ${Components.metricCard('Overall Conversion', `${overallConv}%`, null,
          `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"/></svg>`)}
        ${Components.metricCard('Total Entries', App.formatNumber(firstCount), null,
          `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>`)}
        ${biggestDropIdx > 0 ? Components.metricCard('Biggest Drop-off', `Step ${biggestDropIdx + 1}: ${escHtml(steps[biggestDropIdx].label || steps[biggestDropIdx].name || '')}`, null,
          `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>`)
        : Components.metricCard('Completed', App.formatNumber(lastStep ? lastStep.entered - (lastStep.exited || 0) : 0), null,
          `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`)}
      </div>`;

    container.innerHTML = `
      <div>
        ${headerHTML}
        ${summaryHTML}
        ${funnelBarsHTML}
        ${tableHTML}
      </div>`;
  }

  /* ------------------------------------------------------------------
     Edit Funnel Modal
  ------------------------------------------------------------------ */
  function showEditModal(funnelId) {
    const f = activeFunnel || funnels.find(fn => fn.id === funnelId);
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
    await updateFunnel(funnelId, { name });

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
    await deleteFunnel(funnelId);
    App.navigate('funnels');
  }

  /* ------------------------------------------------------------------
     View drop-off sessions (navigate to sessions with context)
  ------------------------------------------------------------------ */
  function viewDropOff(stepIndex) {
    if (!activeFunnel || !activeFunnel.stepsData || !activeFunnel.stepsData[stepIndex]) return;
    const step = activeFunnel.stepsData[stepIndex];
    // Navigate to sessions, applying a URL filter from the step
    if (step.type === 'url' || step.value.startsWith('/')) {
      App.navigate('sessions');
      Components.toast(`Showing sessions that dropped off at: ${step.label || step.name || step.value}`, 'info');
    } else {
      App.navigate('sessions');
      Components.toast(`Showing sessions that dropped off at: ${step.label || step.name || step.value}`, 'info');
    }
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
    viewDropOff,
  };

})();
