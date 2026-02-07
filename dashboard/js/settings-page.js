/* ==========================================================================
   settings-page.js  -  Settings page with tabs
   ========================================================================== */

const SettingsPage = (() => {

  /* ------------------------------------------------------------------
     State
  ------------------------------------------------------------------ */
  let activeTab = 'general';
  let projectData = { name: 'My Project', domain: '' };
  let dataStats = { sessions: 0, events: 0, total: 0 };
  let retention = 90;

  /* ------------------------------------------------------------------
     Data fetching
  ------------------------------------------------------------------ */
  async function fetchProjectData() {
    try {
      const data = await App.api('/projects/default');
      if (data) {
        projectData.name = data.name || 'My Project';
        projectData.domain = data.domain || '';
        retention = data.retention_days || 90;
      }
    } catch (_) {
      // Use defaults
    }
  }

  async function fetchDataStats() {
    try {
      const data = await App.api('/projects/default/stats');
      if (data) {
        dataStats.sessions = data.sessions || 0;
        dataStats.events = data.events || 0;
        dataStats.total = data.sessions + data.events;
      }
    } catch (_) {
      // Use defaults
    }
  }

  /* ------------------------------------------------------------------
     Tab rendering
  ------------------------------------------------------------------ */
  function renderTabs() {
    const tabs = [
      { id: 'general', label: 'General', icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>' },
      { id: 'tracking', label: 'Tracking Code', icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"/></svg>' },
      { id: 'data', label: 'Data Management', icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"/></svg>' },
      { id: 'security', label: 'Security', icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/></svg>' },
    ];

    return `
      <div class="flex items-center gap-1 border-b border-slate-700/50 mb-6">
        ${tabs.map(tab => `
          <button onclick="SettingsPage.switchTab('${tab.id}')"
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
     Tab: General
  ------------------------------------------------------------------ */
  function renderGeneralTab() {
    return `
      <div class="max-w-xl space-y-6">
        <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-6">
          <h3 class="text-sm font-semibold text-white mb-4">Project Settings</h3>
          <div class="space-y-4">
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1.5">Project Name</label>
              <input type="text" id="settings-project-name" value="${escapeAttr(projectData.name)}"
                     class="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                     placeholder="My Project" />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1.5">Project Domain</label>
              <input type="text" id="settings-project-domain" value="${escapeAttr(projectData.domain)}"
                     class="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                     placeholder="example.com" />
              <p class="text-xs text-slate-500 mt-1.5">The domain where your tracker is installed.</p>
            </div>
          </div>
        </div>

        <button onclick="SettingsPage.saveGeneral()"
                class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
          </svg>
          Save Settings
        </button>
      </div>`;
  }

  /* ------------------------------------------------------------------
     Tab: Tracking Code
  ------------------------------------------------------------------ */
  function renderTrackingTab() {
    const trackerSnippet = `<script src="https://regal-master-look.vercel.app/tracker.js" \n  data-project-id="default" \n  data-api-url="https://regal-master-look.vercel.app/api/events" \n  async><\/script>`;

    const consentSnippet = `<script src="https://regal-master-look.vercel.app/consent-banner.js" async><\/script>`;

    const customEventsSnippet = `// Track custom event
window.RegalMasterLook.track('add_to_cart', { product: 'Reg\u00e1l 180x90', price: 749 });

// Identify user
window.RegalMasterLook.identify('user-123', { email: 'jan@email.cz', name: 'Jan Nov\u00e1k' });`;

    return `
      <div class="max-w-3xl space-y-6">
        <!-- Tracker Snippet -->
        <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-6">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-white">Tracking Snippet</h3>
            <span class="text-xs text-slate-500">Add this to your website's &lt;head&gt;</span>
          </div>
          <p class="text-xs text-slate-400 mb-3">Copy and paste this code into the <code class="bg-slate-700 px-1.5 py-0.5 rounded text-blue-400">&lt;head&gt;</code> section of every page you want to track.</p>
          <div class="relative group">
            <pre class="bg-slate-900 rounded-lg border border-slate-700/50 p-4 text-sm text-green-400 font-mono overflow-x-auto leading-relaxed"><code id="snippet-tracker">${escapeHtml(trackerSnippet)}</code></pre>
            <button onclick="SettingsPage.copySnippet('snippet-tracker')"
                    class="absolute top-3 right-3 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors opacity-0 group-hover:opacity-100 flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"/>
              </svg>
              Copy
            </button>
          </div>
        </div>

        <!-- GDPR Consent Banner -->
        <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-6">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-white flex items-center gap-2">
              GDPR Consent Banner
              <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-500/15 text-green-400 border border-green-500/20">Optional</span>
            </h3>
          </div>
          <p class="text-xs text-slate-400 mb-3">Add this if you need GDPR consent before tracking. The banner will show automatically and recording starts only after user consent.</p>
          <div class="relative group">
            <pre class="bg-slate-900 rounded-lg border border-slate-700/50 p-4 text-sm text-green-400 font-mono overflow-x-auto leading-relaxed"><code id="snippet-consent">${escapeHtml(consentSnippet)}</code></pre>
            <button onclick="SettingsPage.copySnippet('snippet-consent')"
                    class="absolute top-3 right-3 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors opacity-0 group-hover:opacity-100 flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"/>
              </svg>
              Copy
            </button>
          </div>
        </div>

        <!-- Custom Events -->
        <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-6">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-white">Custom Event Tracking</h3>
          </div>
          <p class="text-xs text-slate-400 mb-3">Use the JavaScript API to track custom events and identify users in your application code.</p>
          <div class="relative group">
            <pre class="bg-slate-900 rounded-lg border border-slate-700/50 p-4 text-sm text-blue-400 font-mono overflow-x-auto leading-relaxed"><code id="snippet-events">${escapeHtml(customEventsSnippet)}</code></pre>
            <button onclick="SettingsPage.copySnippet('snippet-events')"
                    class="absolute top-3 right-3 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors opacity-0 group-hover:opacity-100 flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"/>
              </svg>
              Copy
            </button>
          </div>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------
     Tab: Data Management
  ------------------------------------------------------------------ */
  function renderDataTab() {
    return `
      <div class="max-w-xl space-y-6">
        <!-- Data Usage -->
        <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-6">
          <h3 class="text-sm font-semibold text-white mb-4">Current Data Usage</h3>
          <div class="grid grid-cols-3 gap-4">
            <div class="bg-slate-900 rounded-lg p-4 text-center">
              <div class="text-2xl font-bold text-white">${App.formatNumber(dataStats.sessions)}</div>
              <div class="text-xs text-slate-400 mt-1">Sessions</div>
            </div>
            <div class="bg-slate-900 rounded-lg p-4 text-center">
              <div class="text-2xl font-bold text-white">${App.formatNumber(dataStats.events)}</div>
              <div class="text-xs text-slate-400 mt-1">Events</div>
            </div>
            <div class="bg-slate-900 rounded-lg p-4 text-center">
              <div class="text-2xl font-bold text-white">${App.formatNumber(dataStats.total)}</div>
              <div class="text-xs text-slate-400 mt-1">Total Records</div>
            </div>
          </div>
        </div>

        <!-- Data Retention -->
        <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-6">
          <h3 class="text-sm font-semibold text-white mb-4">Data Retention</h3>
          <div>
            <label class="block text-xs font-medium text-slate-400 mb-1.5">Keep session data for</label>
            <select id="settings-retention"
                    class="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-colors">
              <option value="30" ${retention === 30 ? 'selected' : ''}>30 days</option>
              <option value="60" ${retention === 60 ? 'selected' : ''}>60 days</option>
              <option value="90" ${retention === 90 ? 'selected' : ''}>90 days</option>
            </select>
            <p class="text-xs text-slate-500 mt-1.5">Sessions older than this will be automatically deleted.</p>
          </div>
        </div>

        <!-- Danger Zone -->
        <div class="bg-slate-800 rounded-xl border border-red-500/20 p-6">
          <h3 class="text-sm font-semibold text-red-400 mb-2">Danger Zone</h3>
          <p class="text-xs text-slate-400 mb-4">This action cannot be undone. All sessions and events will be permanently deleted.</p>
          <button onclick="SettingsPage.confirmClearAll()"
                  class="bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 hover:text-red-300 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/>
            </svg>
            Clear All Sessions
          </button>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------
     Tab: Security
  ------------------------------------------------------------------ */
  function renderSecurityTab() {
    return `
      <div class="max-w-xl space-y-6">
        <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-6">
          <h3 class="text-sm font-semibold text-white mb-4">Change Dashboard Password</h3>
          <div class="space-y-4">
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1.5">Current Password</label>
              <input type="password" id="settings-current-password"
                     class="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                     placeholder="Enter current password" />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1.5">New Password</label>
              <input type="password" id="settings-new-password"
                     class="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                     placeholder="Enter new password" />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1.5">Confirm New Password</label>
              <input type="password" id="settings-confirm-password"
                     class="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                     placeholder="Confirm new password" />
            </div>
          </div>
          <div class="mt-4 p-3 bg-slate-900 rounded-lg border border-slate-700/30">
            <p class="text-xs text-slate-500">
              <svg class="w-3.5 h-3.5 inline mr-1 text-amber-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
              </svg>
              Password changes apply to the current session only. Update the <code class="bg-slate-800 px-1 py-0.5 rounded text-slate-400">DASHBOARD_PASSWORD</code> environment variable on Vercel for permanent changes.
            </p>
          </div>
        </div>

        <button onclick="SettingsPage.changePassword()"
                class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/>
          </svg>
          Update Password
        </button>
      </div>`;
  }

  /* ------------------------------------------------------------------
     Actions
  ------------------------------------------------------------------ */
  async function saveGeneral() {
    const nameEl = document.getElementById('settings-project-name');
    const domainEl = document.getElementById('settings-project-domain');
    if (!nameEl || !domainEl) return;

    const name = nameEl.value.trim();
    const domain = domainEl.value.trim();

    if (!name) {
      Components.toast('Project name is required', 'warning');
      return;
    }

    try {
      await App.api('/projects/default', {
        method: 'PUT',
        body: { name, domain },
      });
      projectData.name = name;
      projectData.domain = domain;
      Components.toast('Settings saved successfully', 'success');
    } catch (_) {
      Components.toast('Failed to save settings', 'error');
    }
  }

  function copySnippet(elementId) {
    const codeEl = document.getElementById(elementId);
    if (!codeEl) return;

    const text = codeEl.textContent;
    navigator.clipboard.writeText(text).then(() => {
      // Find the button near this element
      const pre = codeEl.closest('pre') || codeEl.parentElement;
      const btn = pre.parentElement.querySelector('button');
      if (btn) {
        const originalHTML = btn.innerHTML;
        btn.innerHTML = `
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
          </svg>
          Copied!`;
        btn.classList.add('bg-green-600', 'hover:bg-green-700', 'text-white');
        btn.classList.remove('bg-slate-700', 'hover:bg-slate-600');
        setTimeout(() => {
          btn.innerHTML = originalHTML;
          btn.classList.remove('bg-green-600', 'hover:bg-green-700');
          btn.classList.add('bg-slate-700', 'hover:bg-slate-600');
        }, 2000);
      }
      Components.toast('Copied to clipboard', 'success');
    }).catch(() => {
      Components.toast('Failed to copy', 'error');
    });
  }

  function confirmClearAll() {
    Components.showModal(
      'Clear All Sessions',
      `<div class="text-center py-2">
        <svg class="w-12 h-12 text-red-400 mx-auto mb-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
        </svg>
        <p class="text-sm text-slate-300 mb-2">Are you sure you want to delete all sessions and events?</p>
        <p class="text-xs text-slate-500">This action is irreversible. All recorded data will be permanently lost.</p>
      </div>`,
      [{
        label: 'Delete Everything',
        class: 'bg-red-600 hover:bg-red-700 text-white',
        onClick: 'SettingsPage.executeClearAll()',
      }]
    );
  }

  async function executeClearAll() {
    Components.closeModal();
    try {
      await App.api('/sessions/all', { method: 'DELETE' });
      Components.toast('All sessions cleared successfully', 'success');
      dataStats = { sessions: 0, events: 0, total: 0 };
      renderTabContent();
    } catch (_) {
      Components.toast('Failed to clear sessions', 'error');
    }
  }

  async function changePassword() {
    const currentEl = document.getElementById('settings-current-password');
    const newEl = document.getElementById('settings-new-password');
    const confirmEl = document.getElementById('settings-confirm-password');

    if (!currentEl || !newEl || !confirmEl) return;

    const currentPassword = currentEl.value;
    const newPassword = newEl.value;
    const confirmPassword = confirmEl.value;

    if (!currentPassword || !newPassword || !confirmPassword) {
      Components.toast('Please fill in all password fields', 'warning');
      return;
    }

    if (newPassword !== confirmPassword) {
      Components.toast('New passwords do not match', 'warning');
      return;
    }

    if (newPassword.length < 4) {
      Components.toast('New password must be at least 4 characters', 'warning');
      return;
    }

    try {
      const result = await App.api('/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      });
      Components.toast(result.note || 'Password changed successfully', 'success');
      currentEl.value = '';
      newEl.value = '';
      confirmEl.value = '';
    } catch (_) {
      // Error already shown by App.api
    }
  }

  function switchTab(tab) {
    activeTab = tab;
    renderTabContent();
  }

  function renderTabContent() {
    const tabContent = document.getElementById('settings-tab-content');
    if (!tabContent) return;

    // Also re-render tabs to update active state
    const tabsContainer = document.getElementById('settings-tabs');
    if (tabsContainer) {
      tabsContainer.innerHTML = renderTabs();
    }

    switch (activeTab) {
      case 'general':
        tabContent.innerHTML = renderGeneralTab();
        break;
      case 'tracking':
        tabContent.innerHTML = renderTrackingTab();
        break;
      case 'data':
        tabContent.innerHTML = renderDataTab();
        break;
      case 'security':
        tabContent.innerHTML = renderSecurityTab();
        break;
      default:
        tabContent.innerHTML = renderGeneralTab();
    }
  }

  /* ------------------------------------------------------------------
     Helpers
  ------------------------------------------------------------------ */
  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttr(str) {
    return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  /* ------------------------------------------------------------------
     Main render
  ------------------------------------------------------------------ */
  async function render(container) {
    container.innerHTML = Components.loading();

    // Fetch data in parallel
    await Promise.all([fetchProjectData(), fetchDataStats()]);

    container.innerHTML = `
      <div>
        ${Components.sectionHeader('Settings', 'Configure your project, tracking code, and security preferences')}
        <div id="settings-tabs">${renderTabs()}</div>
        <div id="settings-tab-content"></div>
      </div>`;

    renderTabContent();
  }

  /* ------------------------------------------------------------------
     Public API
  ------------------------------------------------------------------ */
  return {
    render,
    switchTab,
    saveGeneral,
    copySnippet,
    confirmClearAll,
    executeClearAll,
    changePassword,
  };

})();
