/* ==========================================================================
   reports-page.js  -  Automated Email Reports configuration & history
   ========================================================================== */

const ReportsPage = (() => {

  /* ------------------------------------------------------------------
     State
  ------------------------------------------------------------------ */
  let config = null;
  let history = [];
  let historyPage = 1;
  let historyPages = 1;

  const SECTION_OPTIONS = [
    { value: 'overview', label: 'Overview KPIs', description: 'Total sessions, visitors, duration, bounce rate' },
    { value: 'top_pages', label: 'Top Pages', description: 'Most visited pages table' },
    { value: 'errors', label: 'Error Summary', description: 'Error counts and affected sessions' },
    { value: 'performance', label: 'Performance Scores', description: 'Core Web Vitals (LCP, CLS, TTFB)' },
    { value: 'ecommerce', label: 'E-commerce Revenue', description: 'Revenue, orders, avg order value' },
  ];

  const FREQUENCY_OPTIONS = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
  ];

  const DAY_OPTIONS = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
  ];

  /* ------------------------------------------------------------------
     Data loading
  ------------------------------------------------------------------ */
  async function loadConfig() {
    try {
      config = await App.api('/reports/config?project_id=' + App.state.project);
    } catch (err) {
      console.error('[ReportsPage] Failed to load config:', err);
      config = {
        enabled: false,
        recipients: [],
        frequency: 'weekly',
        day_of_week: 1,
        hour: 9,
        timezone: 'Europe/Prague',
        include_sections: ['overview', 'top_pages', 'errors', 'performance'],
        email_service_configured: false,
      };
    }
  }

  async function loadHistory(page) {
    try {
      const data = await App.api('/reports/history?project_id=' + App.state.project + '&page=' + page + '&limit=10');
      history = data.reports || [];
      historyPage = data.page || 1;
      historyPages = data.pages || 1;
    } catch (err) {
      console.error('[ReportsPage] Failed to load history:', err);
      history = [];
    }
  }

  /* ------------------------------------------------------------------
     Save configuration
  ------------------------------------------------------------------ */
  async function saveConfig() {
    try {
      // Read current form values
      const enabled = document.getElementById('report-enabled')?.checked || false;
      const frequency = document.getElementById('report-frequency')?.value || 'weekly';
      const dayOfWeek = parseInt(document.getElementById('report-day')?.value || '1', 10);
      const hour = parseInt(document.getElementById('report-hour')?.value || '9', 10);
      const timezone = document.getElementById('report-timezone')?.value || 'Europe/Prague';

      // Collect recipients
      const recipientEls = document.querySelectorAll('.report-recipient-input');
      const recipients = [];
      recipientEls.forEach(el => {
        const val = el.value.trim();
        if (val) recipients.push(val);
      });

      // Collect sections
      const sections = [];
      SECTION_OPTIONS.forEach(s => {
        const checked = document.getElementById('report-section-' + s.value)?.checked;
        if (checked) sections.push(s.value);
      });

      const result = await App.api('/reports/config', {
        method: 'POST',
        body: {
          project_id: App.state.project,
          enabled,
          recipients,
          frequency,
          day_of_week: dayOfWeek,
          hour,
          timezone,
          include_sections: sections,
        },
      });

      config = result;
      Components.toast('Report configuration saved', 'success');
    } catch (err) {
      Components.toast('Failed to save configuration: ' + err.message, 'error');
    }
  }

  /* ------------------------------------------------------------------
     Add / remove recipient
  ------------------------------------------------------------------ */
  function addRecipient() {
    const list = document.getElementById('recipients-list');
    if (!list) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'flex items-center gap-2 mt-2';
    wrapper.innerHTML = `
      <input type="email" placeholder="email@example.com"
             class="report-recipient-input flex-1 bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30" />
      <button onclick="this.parentElement.remove()"
              class="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Remove">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>`;
    list.appendChild(wrapper);

    // Focus the new input
    wrapper.querySelector('input').focus();
  }

  /* ------------------------------------------------------------------
     Preview report
  ------------------------------------------------------------------ */
  async function previewReport() {
    const previewBtn = document.getElementById('btn-preview');
    if (previewBtn) {
      previewBtn.disabled = true;
      previewBtn.innerHTML = `
        <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" opacity="0.25"></circle>
          <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" opacity="0.75"></path>
        </svg>
        Generating...`;
    }

    try {
      const data = await App.api('/reports/preview?project_id=' + App.state.project);

      // Show in a modal with an iframe
      Components.closeModal();
      const modalWrapper = document.createElement('div');
      modalWrapper.id = 'modal-overlay';
      modalWrapper.className = 'fixed inset-0 z-50 flex items-center justify-center p-4';
      modalWrapper.onclick = function(e) { if (e.target === this) Components.closeModal(); };
      modalWrapper.innerHTML = `
        <div class="fixed inset-0 bg-black/60 backdrop-blur-sm"></div>
        <div class="relative bg-slate-800 rounded-2xl border border-slate-700/50 shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <div class="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 flex-shrink-0">
            <h3 class="text-lg font-semibold text-white">Report Preview</h3>
            <button onclick="Components.closeModal()" class="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-700/50">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div class="flex-1 overflow-hidden">
            <iframe id="report-preview-iframe" style="width:100%; height:100%; min-height:500px; border:none; background:#0f172a;"></iframe>
          </div>
          <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700/50 flex-shrink-0">
            <button onclick="Components.closeModal()" class="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors">Close</button>
          </div>
        </div>`;
      document.body.appendChild(modalWrapper);

      // Write HTML into iframe
      setTimeout(() => {
        const iframe = document.getElementById('report-preview-iframe');
        if (iframe) {
          const doc = iframe.contentDocument || iframe.contentWindow.document;
          doc.open();
          doc.write(data.html);
          doc.close();
        }
      }, 100);

    } catch (err) {
      Components.toast('Failed to generate preview: ' + err.message, 'error');
    } finally {
      if (previewBtn) {
        previewBtn.disabled = false;
        previewBtn.innerHTML = `
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/>
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
          Preview Report`;
      }
    }
  }

  /* ------------------------------------------------------------------
     Send report now
  ------------------------------------------------------------------ */
  async function sendNow() {
    const sendBtn = document.getElementById('btn-send-now');
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.innerHTML = `
        <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" opacity="0.25"></circle>
          <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" opacity="0.75"></path>
        </svg>
        Sending...`;
    }

    try {
      const result = await App.api('/reports/send-now', {
        method: 'POST',
        body: { project_id: App.state.project },
      });

      Components.toast(result.message || 'Report sent successfully', result.email_sent ? 'success' : 'info');

      // Reload history
      await loadHistory(1);
      const histContainer = document.getElementById('reports-history-container');
      if (histContainer) {
        histContainer.innerHTML = renderHistory();
      }
    } catch (err) {
      Components.toast('Failed to send report: ' + err.message, 'error');
    } finally {
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.innerHTML = `
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/>
          </svg>
          Send Now`;
      }
    }
  }

  /* ------------------------------------------------------------------
     View a past report
  ------------------------------------------------------------------ */
  async function viewReport(reportId) {
    try {
      const data = await App.api('/reports/history/' + reportId);

      if (!data || !data.html_content) {
        Components.toast('Report content not available', 'warning');
        return;
      }

      // Show in modal with iframe
      Components.closeModal();
      const modalWrapper = document.createElement('div');
      modalWrapper.id = 'modal-overlay';
      modalWrapper.className = 'fixed inset-0 z-50 flex items-center justify-center p-4';
      modalWrapper.onclick = function(e) { if (e.target === this) Components.closeModal(); };
      modalWrapper.innerHTML = `
        <div class="fixed inset-0 bg-black/60 backdrop-blur-sm"></div>
        <div class="relative bg-slate-800 rounded-2xl border border-slate-700/50 shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <div class="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 flex-shrink-0">
            <div>
              <h3 class="text-lg font-semibold text-white">Past Report</h3>
              <p class="text-xs text-slate-400 mt-0.5">Sent ${new Date(data.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            <button onclick="Components.closeModal()" class="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-700/50">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div class="flex-1 overflow-hidden">
            <iframe id="report-view-iframe" style="width:100%; height:100%; min-height:500px; border:none; background:#0f172a;"></iframe>
          </div>
          <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700/50 flex-shrink-0">
            <button onclick="Components.closeModal()" class="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors">Close</button>
          </div>
        </div>`;
      document.body.appendChild(modalWrapper);

      setTimeout(() => {
        const iframe = document.getElementById('report-view-iframe');
        if (iframe) {
          const doc = iframe.contentDocument || iframe.contentWindow.document;
          doc.open();
          doc.write(data.html_content);
          doc.close();
        }
      }, 100);

    } catch (err) {
      Components.toast('Failed to load report: ' + err.message, 'error');
    }
  }

  /* ------------------------------------------------------------------
     History pagination
  ------------------------------------------------------------------ */
  async function goToHistoryPage(page) {
    await loadHistory(page);
    const histContainer = document.getElementById('reports-history-container');
    if (histContainer) {
      histContainer.innerHTML = renderHistory();
    }
  }

  /* ------------------------------------------------------------------
     Render helpers
  ------------------------------------------------------------------ */
  function renderRecipientsInputs() {
    const recipients = (config && config.recipients) || [];
    if (recipients.length === 0) {
      return `<div class="text-xs text-slate-500 py-2">No recipients added yet. Click "Add Recipient" below.</div>`;
    }
    return recipients.map(email => `
      <div class="flex items-center gap-2 mt-2">
        <input type="email" value="${email}"
               class="report-recipient-input flex-1 bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30" />
        <button onclick="this.parentElement.remove()"
                class="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Remove">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>`).join('');
  }

  function renderSectionCheckboxes() {
    const sections = (config && config.include_sections) || [];
    return SECTION_OPTIONS.map(s => {
      const checked = sections.includes(s.value);
      return `
        <label class="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-slate-700/30 transition-colors">
          <input type="checkbox" id="report-section-${s.value}" ${checked ? 'checked' : ''}
                 class="w-4 h-4 rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500/30 mt-0.5" />
          <div>
            <span class="text-sm text-slate-200 font-medium">${s.label}</span>
            <p class="text-xs text-slate-500 mt-0.5">${s.description}</p>
          </div>
        </label>`;
    }).join('');
  }

  function renderFrequencySelect() {
    const freq = (config && config.frequency) || 'weekly';
    return FREQUENCY_OPTIONS.map(o =>
      `<option value="${o.value}" ${o.value === freq ? 'selected' : ''}>${o.label}</option>`
    ).join('');
  }

  function renderDaySelect() {
    const day = config ? config.day_of_week : 1;
    return DAY_OPTIONS.map(o =>
      `<option value="${o.value}" ${o.value === day ? 'selected' : ''}>${o.label}</option>`
    ).join('');
  }

  function renderHourOptions() {
    const hour = config ? config.hour : 9;
    let opts = '';
    for (let h = 0; h < 24; h++) {
      const label = h === 0 ? '12:00 AM' : h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h - 12}:00 PM`;
      opts += `<option value="${h}" ${h === hour ? 'selected' : ''}>${label}</option>`;
    }
    return opts;
  }

  function renderHistory() {
    if (!history || history.length === 0) {
      return `
        <div class="flex flex-col items-center justify-center py-12 text-center">
          <svg class="w-10 h-10 text-slate-600 mb-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
          </svg>
          <p class="text-sm text-slate-400">No reports sent yet</p>
          <p class="text-xs text-slate-500 mt-1">Use "Send Now" to generate and send your first report</p>
        </div>`;
    }

    const rows = history.map(report => {
      const sentDate = new Date(report.sent_at).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
      const periodStart = new Date(report.period_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const periodEnd = new Date(report.period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const recipientCount = (report.recipients || []).length;

      return `
        <tr class="border-t border-slate-700/50 hover:bg-slate-700/30 transition-colors">
          <td class="px-4 py-3 text-sm text-slate-300">${sentDate}</td>
          <td class="px-4 py-3 text-sm text-slate-400">${periodStart} - ${periodEnd}</td>
          <td class="px-4 py-3 text-sm text-slate-400">${recipientCount} recipient${recipientCount !== 1 ? 's' : ''}</td>
          <td class="px-4 py-3">
            <button onclick="ReportsPage.viewReport('${report.id}')"
                    class="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium">
              View Report
            </button>
          </td>
        </tr>`;
    }).join('');

    let paginationHTML = '';
    if (historyPages > 1) {
      paginationHTML = Components.pagination(historyPage, historyPages, 'ReportsPage.goToHistoryPage');
    }

    return `
      <div class="overflow-x-auto rounded-xl border border-slate-700/50">
        <table class="w-full">
          <thead class="bg-slate-800/80">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Sent</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Period</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Recipients</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider" style="width:100px">Action</th>
            </tr>
          </thead>
          <tbody class="bg-slate-800/30">${rows}</tbody>
        </table>
      </div>
      ${paginationHTML}`;
  }

  /* ------------------------------------------------------------------
     Main render
  ------------------------------------------------------------------ */
  async function render(container) {
    container.innerHTML = Components.loading();

    await Promise.all([loadConfig(), loadHistory(1)]);

    const emailConfigured = config && config.email_service_configured;
    const isEnabled = config && config.enabled;
    const inputBase = 'bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-colors';

    container.innerHTML = `
      <div class="max-w-4xl">

        <!-- Header -->
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="text-lg font-semibold text-white">Email Reports</h2>
            <p class="text-sm text-slate-400 mt-0.5">Configure automated analytics reports delivered to your inbox</p>
          </div>
          <div class="flex items-center gap-3">
            <button id="btn-preview" onclick="ReportsPage.previewReport()"
                    class="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              Preview Report
            </button>
            <button id="btn-send-now" onclick="ReportsPage.sendNow()"
                    class="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/>
              </svg>
              Send Now
            </button>
          </div>
        </div>

        <!-- Email Service Status -->
        <div class="mb-6 p-4 rounded-xl border ${emailConfigured ? 'bg-green-500/5 border-green-500/20' : 'bg-yellow-500/5 border-yellow-500/20'}">
          <div class="flex items-center gap-3">
            ${emailConfigured
              ? `<div class="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center flex-shrink-0">
                   <svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                     <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                   </svg>
                 </div>
                 <div>
                   <span class="text-sm font-medium text-green-400">Email service configured</span>
                   <p class="text-xs text-slate-500 mt-0.5">Resend API key detected. Reports will be delivered via email.</p>
                 </div>`
              : `<div class="w-8 h-8 rounded-lg bg-yellow-500/15 flex items-center justify-center flex-shrink-0">
                   <svg class="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                     <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
                   </svg>
                 </div>
                 <div>
                   <span class="text-sm font-medium text-yellow-400">Email service not configured</span>
                   <p class="text-xs text-slate-500 mt-0.5">Set the <code class="text-slate-400 bg-slate-700/50 px-1.5 py-0.5 rounded text-xs">RESEND_API_KEY</code> environment variable to enable email delivery. Reports can still be generated and viewed in the dashboard.</p>
                 </div>`
            }
          </div>
        </div>

        <!-- Configuration Panel -->
        <div class="bg-slate-800 rounded-xl border border-slate-700/50 mb-6">
          <div class="px-6 py-4 border-b border-slate-700/50">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-white">Report Configuration</h3>
              <label class="flex items-center gap-3 cursor-pointer">
                <span class="text-xs font-medium ${isEnabled ? 'text-green-400' : 'text-slate-500'}">${isEnabled ? 'Enabled' : 'Disabled'}</span>
                <button onclick="ReportsPage.toggleEnabled()"
                        class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${isEnabled ? 'bg-green-600' : 'bg-slate-600'}"
                        title="${isEnabled ? 'Click to disable' : 'Click to enable'}">
                  <input type="checkbox" id="report-enabled" ${isEnabled ? 'checked' : ''} class="sr-only" />
                  <span class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${isEnabled ? 'translate-x-6' : 'translate-x-1'}"></span>
                </button>
              </label>
            </div>
          </div>

          <div class="p-6 space-y-6">

            <!-- Recipients -->
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-2">Email Recipients</label>
              <div id="recipients-list">
                ${renderRecipientsInputs()}
              </div>
              <button onclick="ReportsPage.addRecipient()"
                      class="mt-3 flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
                </svg>
                Add Recipient
              </button>
            </div>

            <!-- Schedule -->
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-2">Schedule</label>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label class="block text-xs text-slate-500 mb-1">Frequency</label>
                  <select id="report-frequency" class="${inputBase} w-full" onchange="ReportsPage.onFrequencyChange()">
                    ${renderFrequencySelect()}
                  </select>
                </div>
                <div id="day-select-wrapper" style="${(config && config.frequency === 'daily') ? 'display:none' : ''}">
                  <label class="block text-xs text-slate-500 mb-1">Day of Week</label>
                  <select id="report-day" class="${inputBase} w-full">
                    ${renderDaySelect()}
                  </select>
                </div>
                <div>
                  <label class="block text-xs text-slate-500 mb-1">Time</label>
                  <select id="report-hour" class="${inputBase} w-full">
                    ${renderHourOptions()}
                  </select>
                </div>
              </div>
            </div>

            <!-- Timezone -->
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-1.5">Timezone</label>
              <input type="text" id="report-timezone" value="${(config && config.timezone) || 'Europe/Prague'}"
                     class="${inputBase} w-full max-w-xs" placeholder="e.g. Europe/Prague" />
            </div>

            <!-- Sections -->
            <div>
              <label class="block text-xs font-medium text-slate-400 mb-2">Report Sections</label>
              <div class="space-y-1">
                ${renderSectionCheckboxes()}
              </div>
            </div>

            <!-- Save Button -->
            <div class="pt-2">
              <button onclick="ReportsPage.saveConfig()"
                      class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors">
                Save Configuration
              </button>
            </div>

          </div>
        </div>

        <!-- Report History -->
        <div class="mb-6">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-slate-300 uppercase tracking-wider">Report History</h3>
            <span class="text-xs text-slate-500">${history.length > 0 ? history.length + ' report' + (history.length !== 1 ? 's' : '') : ''}</span>
          </div>
          <div id="reports-history-container">
            ${renderHistory()}
          </div>
        </div>

      </div>`;
  }

  /* ------------------------------------------------------------------
     Toggle enabled
  ------------------------------------------------------------------ */
  function toggleEnabled() {
    const checkbox = document.getElementById('report-enabled');
    if (checkbox) {
      checkbox.checked = !checkbox.checked;
    }
    // Re-render the toggle UI
    const container = document.getElementById('main-content');
    // Just update the button visually without full re-render
    const toggleBtn = document.querySelector('[onclick="ReportsPage.toggleEnabled()"]');
    if (toggleBtn && checkbox) {
      const isEnabled = checkbox.checked;
      toggleBtn.className = `relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${isEnabled ? 'bg-green-600' : 'bg-slate-600'}`;
      const dot = toggleBtn.querySelector('span:last-child');
      if (dot) {
        dot.className = `inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${isEnabled ? 'translate-x-6' : 'translate-x-1'}`;
      }
      const label = toggleBtn.previousElementSibling;
      if (label) {
        label.textContent = isEnabled ? 'Enabled' : 'Disabled';
        label.className = `text-xs font-medium ${isEnabled ? 'text-green-400' : 'text-slate-500'}`;
      }
    }
  }

  /* ------------------------------------------------------------------
     Frequency change handler (show/hide day select)
  ------------------------------------------------------------------ */
  function onFrequencyChange() {
    const freqEl = document.getElementById('report-frequency');
    const dayWrapper = document.getElementById('day-select-wrapper');
    if (freqEl && dayWrapper) {
      dayWrapper.style.display = freqEl.value === 'daily' ? 'none' : '';
    }
  }

  /* ------------------------------------------------------------------
     Public API
  ------------------------------------------------------------------ */
  return {
    render,
    saveConfig,
    addRecipient,
    previewReport,
    sendNow,
    viewReport,
    goToHistoryPage,
    toggleEnabled,
    onFrequencyChange,
  };

})();
