/* ==========================================================================
   components.js - Reusable UI components (return HTML strings)
   ========================================================================== */

const Components = (() => {

  /* ------------------------------------------------------------------
     metricCard(title, value, change, icon)
     change: { value: "+12.5%", positive: true } or null
     icon: SVG string or emoji
  ------------------------------------------------------------------ */
  function metricCard(title, value, change, icon) {
    const trendHTML = change
      ? `<div class="flex items-center gap-1 text-xs font-medium ${change.positive ? 'text-green-400' : 'text-red-400'}">
           <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5"
                viewBox="0 0 24 24">
             <path stroke-linecap="round" stroke-linejoin="round"
                   d="${change.positive
                     ? 'M4.5 15.75l7.5-7.5 7.5 7.5'
                     : 'M19.5 8.25l-7.5 7.5-7.5-7.5'}"/>
           </svg>
           <span>${change.value}</span>
           <span class="text-slate-500">vs prev</span>
         </div>`
      : '';

    return `
      <div class="bg-slate-800 rounded-xl p-5 border border-slate-700/50 hover:border-slate-600/50 transition-colors">
        <div class="flex items-start justify-between mb-3">
          <span class="text-xs font-medium text-slate-400 uppercase tracking-wider">${title}</span>
          <span class="text-slate-500">${icon || ''}</span>
        </div>
        <div class="text-2xl font-bold text-white mb-1">${value}</div>
        ${trendHTML}
      </div>`;
  }

  /* ------------------------------------------------------------------
     dataTable(headers, rows, options)
     headers: [{ key, label, sortable?, width?, align? }]
     rows: [{ id, cells: { key: html }, onClick? }]
     options: { striped?, hoverable?, compact?, id? }
  ------------------------------------------------------------------ */
  function dataTable(headers, rows, options = {}) {
    const tableId = options.id || 'table-' + Math.random().toString(36).slice(2, 8);
    const headerCells = headers.map(h => {
      const align = h.align === 'right' ? 'text-right' : h.align === 'center' ? 'text-center' : 'text-left';
      const width = h.width ? `style="width:${h.width}"` : '';
      const sortIcon = h.sortable
        ? `<svg class="w-3 h-3 inline ml-1 opacity-40" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
             <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9"/>
           </svg>`
        : '';
      return `<th class="px-4 py-3 ${align} text-xs font-semibold text-slate-400 uppercase tracking-wider" ${width}>${h.label}${sortIcon}</th>`;
    }).join('');

    const bodyRows = rows.length === 0
      ? `<tr><td colspan="${headers.length}" class="px-4 py-12 text-center text-slate-500">No data available</td></tr>`
      : rows.map((row, i) => {
          const bgClass = options.striped && i % 2 === 1 ? 'bg-slate-800/50' : '';
          const hoverClass = options.hoverable ? 'hover:bg-slate-700/50 cursor-pointer' : '';
          const clickAttr = row.onClick ? `onclick="${row.onClick}"` : '';
          const cells = headers.map(h => {
            const align = h.align === 'right' ? 'text-right' : h.align === 'center' ? 'text-center' : 'text-left';
            return `<td class="px-4 py-3 ${align} text-sm text-slate-300">${row.cells[h.key] || ''}</td>`;
          }).join('');
          return `<tr class="${bgClass} ${hoverClass} border-t border-slate-700/50 transition-colors" ${clickAttr} ${row.id ? `data-id="${row.id}"` : ''}>${cells}</tr>`;
        }).join('');

    return `
      <div class="overflow-x-auto rounded-xl border border-slate-700/50">
        <table id="${tableId}" class="w-full">
          <thead class="bg-slate-800/80">
            <tr>${headerCells}</tr>
          </thead>
          <tbody class="bg-slate-800/30">${bodyRows}</tbody>
        </table>
      </div>`;
  }

  /* ------------------------------------------------------------------
     pagination(page, totalPages, onChangeFnName)
  ------------------------------------------------------------------ */
  function pagination(page, totalPages, onChangeFnName) {
    if (totalPages <= 1) return '';

    const pages = [];
    const maxVisible = 7;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }

    if (start > 1) {
      pages.push({ num: 1, label: '1' });
      if (start > 2) pages.push({ num: null, label: '...' });
    }
    for (let i = start; i <= end; i++) {
      pages.push({ num: i, label: String(i) });
    }
    if (end < totalPages) {
      if (end < totalPages - 1) pages.push({ num: null, label: '...' });
      pages.push({ num: totalPages, label: String(totalPages) });
    }

    const prevDisabled = page <= 1;
    const nextDisabled = page >= totalPages;

    const pageButtons = pages.map(p => {
      if (p.num === null) {
        return `<span class="px-2 py-1 text-slate-500 text-sm">...</span>`;
      }
      const active = p.num === page;
      const cls = active
        ? 'bg-blue-600 text-white'
        : 'text-slate-400 hover:bg-slate-700 hover:text-white';
      return `<button onclick="${onChangeFnName}(${p.num})" class="px-3 py-1.5 rounded-lg text-sm font-medium ${cls} transition-colors">${p.label}</button>`;
    }).join('');

    return `
      <div class="flex items-center justify-between mt-4 px-1">
        <span class="text-sm text-slate-500">Page ${page} of ${totalPages}</span>
        <div class="flex items-center gap-1">
          <button onclick="${onChangeFnName}(${page - 1})" ${prevDisabled ? 'disabled' : ''}
                  class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                         ${prevDisabled ? 'text-slate-600 cursor-not-allowed' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}">
            Prev
          </button>
          ${pageButtons}
          <button onclick="${onChangeFnName}(${page + 1})" ${nextDisabled ? 'disabled' : ''}
                  class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                         ${nextDisabled ? 'text-slate-600 cursor-not-allowed' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}">
            Next
          </button>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------
     filterBar(filters)
     filters: [{ type, key, label, options?, placeholder?, value? }]
  ------------------------------------------------------------------ */
  function filterBar(filters) {
    const inputBase = 'bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-colors';
    const fields = filters.map(f => {
      let input = '';
      switch (f.type) {
        case 'text':
          input = `<input type="text" id="filter-${f.key}" placeholder="${f.placeholder || ''}"
                     value="${f.value || ''}" class="${inputBase} w-full" />`;
          break;
        case 'number':
          input = `<input type="number" id="filter-${f.key}" placeholder="${f.placeholder || ''}"
                     value="${f.value || ''}" class="${inputBase} w-full" min="${f.min || ''}" max="${f.max || ''}" />`;
          break;
        case 'date':
          input = `<input type="date" id="filter-${f.key}" value="${f.value || ''}" class="${inputBase} w-full" />`;
          break;
        case 'select':
          const opts = (f.options || []).map(o =>
            `<option value="${o.value}" ${o.value === f.value ? 'selected' : ''}>${o.label}</option>`
          ).join('');
          input = `<select id="filter-${f.key}" class="${inputBase} w-full">${opts}</select>`;
          break;
        case 'checkbox':
          input = `<label class="flex items-center gap-2 cursor-pointer select-none">
                     <input type="checkbox" id="filter-${f.key}" ${f.value ? 'checked' : ''}
                            class="w-4 h-4 rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500/30" />
                     <span class="text-sm text-slate-300">${f.label}</span>
                   </label>`;
          return `<div class="flex items-end">${input}</div>`;
        default:
          input = '';
      }
      return `
        <div>
          <label class="block text-xs font-medium text-slate-400 mb-1.5">${f.label}</label>
          ${input}
        </div>`;
    }).join('');

    return `<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">${fields}</div>`;
  }

  /* ------------------------------------------------------------------
     modal(title, content, actions)
     actions: [{ label, class?, onClick }]
  ------------------------------------------------------------------ */
  function modal(title, content, actions) {
    const actionButtons = (actions || []).map(a =>
      `<button onclick="${a.onClick}" class="${a.class || 'bg-blue-600 hover:bg-blue-700 text-white'} px-4 py-2 rounded-lg text-sm font-medium transition-colors">${a.label}</button>`
    ).join('');

    return `
      <div id="modal-overlay" class="fixed inset-0 z-50 flex items-center justify-center p-4" onclick="if(event.target===this)Components.closeModal()">
        <div class="fixed inset-0 bg-black/60 backdrop-blur-sm"></div>
        <div class="relative bg-slate-800 rounded-2xl border border-slate-700/50 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
          <div class="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
            <h3 class="text-lg font-semibold text-white">${title}</h3>
            <button onclick="Components.closeModal()" class="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-700/50">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div class="px-6 py-4 overflow-y-auto max-h-[60vh]">${content}</div>
          <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700/50">
            <button onclick="Components.closeModal()" class="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors">Cancel</button>
            ${actionButtons}
          </div>
        </div>
      </div>`;
  }

  function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.remove();
  }

  function showModal(title, content, actions) {
    closeModal();
    const wrapper = document.createElement('div');
    wrapper.innerHTML = modal(title, content, actions);
    document.body.appendChild(wrapper.firstElementChild);
  }

  /* ------------------------------------------------------------------
     badge(text, color)
     color: 'blue', 'green', 'red', 'yellow', 'purple', 'slate'
  ------------------------------------------------------------------ */
  function badge(text, color = 'blue') {
    const colors = {
      blue:   'bg-blue-500/15 text-blue-400 border-blue-500/20',
      green:  'bg-green-500/15 text-green-400 border-green-500/20',
      red:    'bg-red-500/15 text-red-400 border-red-500/20',
      yellow: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
      purple: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
      slate:  'bg-slate-600/30 text-slate-400 border-slate-500/20',
    };
    const cls = colors[color] || colors.blue;
    return `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${cls}">${text}</span>`;
  }

  /* ------------------------------------------------------------------
     emptyState(title, description, icon)
  ------------------------------------------------------------------ */
  function emptyState(title, description, icon) {
    const defaultIcon = `<svg class="w-12 h-12 text-slate-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/>
    </svg>`;

    return `
      <div class="flex flex-col items-center justify-center py-16 text-center">
        <div class="mb-4">${icon || defaultIcon}</div>
        <h3 class="text-lg font-semibold text-slate-300 mb-2">${title}</h3>
        <p class="text-sm text-slate-500 max-w-sm">${description}</p>
      </div>`;
  }

  /* ------------------------------------------------------------------
     toast(message, type)
     type: 'success', 'error', 'info', 'warning'
  ------------------------------------------------------------------ */
  function toast(message, type = 'info') {
    const icons = {
      success: `<svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
      error:   `<svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>`,
      info:    `<svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"/></svg>`,
      warning: `<svg class="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>`,
    };
    const borderColors = { success: 'border-green-500/30', error: 'border-red-500/30', info: 'border-blue-500/30', warning: 'border-yellow-500/30' };

    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none';
      document.body.appendChild(container);
    }

    const el = document.createElement('div');
    el.className = `pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800 border ${borderColors[type] || borderColors.info} shadow-lg transform transition-all duration-300 translate-x-full opacity-0`;
    el.innerHTML = `${icons[type] || icons.info}<span class="text-sm text-white">${message}</span>`;
    container.appendChild(el);

    requestAnimationFrame(() => {
      el.classList.remove('translate-x-full', 'opacity-0');
    });

    setTimeout(() => {
      el.classList.add('translate-x-full', 'opacity-0');
      setTimeout(() => el.remove(), 300);
    }, 3500);
  }

  /* ------------------------------------------------------------------
     loading()
  ------------------------------------------------------------------ */
  function loading() {
    return `
      <div class="flex flex-col items-center justify-center py-20">
        <div class="relative w-10 h-10">
          <div class="absolute inset-0 rounded-full border-2 border-slate-700"></div>
          <div class="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500 animate-spin"></div>
        </div>
        <span class="mt-4 text-sm text-slate-500">Loading...</span>
      </div>`;
  }

  /* ------------------------------------------------------------------
     deviceIcon(type)  -  'desktop' | 'mobile' | 'tablet'
  ------------------------------------------------------------------ */
  function deviceIcon(type) {
    switch ((type || '').toLowerCase()) {
      case 'mobile':
        return `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"/></svg>`;
      case 'tablet':
        return `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5h3m-6.75 2.25h10.5a2.25 2.25 0 002.25-2.25V4.5a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 4.5v15a2.25 2.25 0 002.25 2.25z"/></svg>`;
      default: // desktop
        return `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z"/></svg>`;
    }
  }

  /* ------------------------------------------------------------------
     browserIcon(name)  -  text-based icon
  ------------------------------------------------------------------ */
  function browserIcon(name) {
    const n = (name || '').toLowerCase();
    const labels = {
      chrome:  { letter: 'C', color: 'text-green-400 bg-green-500/15' },
      firefox: { letter: 'F', color: 'text-orange-400 bg-orange-500/15' },
      safari:  { letter: 'S', color: 'text-blue-400 bg-blue-500/15' },
      edge:    { letter: 'E', color: 'text-cyan-400 bg-cyan-500/15' },
      opera:   { letter: 'O', color: 'text-red-400 bg-red-500/15' },
      brave:   { letter: 'B', color: 'text-orange-400 bg-orange-500/15' },
    };
    const info = labels[n] || { letter: (name || '?')[0].toUpperCase(), color: 'text-slate-400 bg-slate-500/15' };
    return `<span class="inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold ${info.color}">${info.letter}</span>`;
  }

  /* ------------------------------------------------------------------
     timeAgo(date)  -  returns relative time string
  ------------------------------------------------------------------ */
  function timeAgo(date) {
    const d = date instanceof Date ? date : new Date(date);
    const now = new Date();
    const seconds = Math.floor((now - d) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks}w ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(days / 365);
    return `${years}y ago`;
  }

  /* ------------------------------------------------------------------
     sectionHeader(title, subtitle, actionHTML)
  ------------------------------------------------------------------ */
  function sectionHeader(title, subtitle, actionHTML) {
    return `
      <div class="flex items-center justify-between mb-5">
        <div>
          <h2 class="text-lg font-semibold text-white">${title}</h2>
          ${subtitle ? `<p class="text-sm text-slate-400 mt-0.5">${subtitle}</p>` : ''}
        </div>
        ${actionHTML ? `<div>${actionHTML}</div>` : ''}
      </div>`;
  }

  /* ------------------------------------------------------------------
     chartContainer(id, height)
  ------------------------------------------------------------------ */
  function chartContainer(id, height = '300px') {
    return `
      <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
        <div style="height:${height}; position:relative;">
          <canvas id="${id}"></canvas>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------
     avatarPlaceholder(name)
  ------------------------------------------------------------------ */
  function avatarPlaceholder(name) {
    const initials = (name || '?').split(/[\s@]/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
    const hue = Math.abs([...name || ''].reduce((h, c) => (h << 5) - h + c.charCodeAt(0), 0)) % 360;
    return `<div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style="background:hsl(${hue},50%,40%)">${initials}</div>`;
  }

  /* ------------------------------------------------------------------
     Public API
  ------------------------------------------------------------------ */
  return {
    metricCard,
    dataTable,
    pagination,
    filterBar,
    modal,
    closeModal,
    showModal,
    badge,
    emptyState,
    toast,
    loading,
    deviceIcon,
    browserIcon,
    timeAgo,
    sectionHeader,
    chartContainer,
    avatarPlaceholder,
  };

})();
