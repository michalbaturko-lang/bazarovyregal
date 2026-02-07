/* ==========================================================================
   forms-page.js  –  Form Analytics Dashboard
   Form completion, field-level analytics, abandonment analysis
   ========================================================================== */

const FormsPage = (() => {

  /* ------------------------------------------------------------------
     State
  ------------------------------------------------------------------ */
  let _selectedFormId = null;
  let _cachedOverview = null;

  /* ------------------------------------------------------------------
     Data fetching
  ------------------------------------------------------------------ */
  async function fetchOverview() {
    const { start, end } = App.state.dateRange;
    return App.api(`/forms/overview?project_id=${App.state.project}&date_from=${start}&date_to=${end}`);
  }

  async function fetchFields(formId) {
    const { start, end } = App.state.dateRange;
    return App.api(`/forms/${encodeURIComponent(formId)}/fields?project_id=${App.state.project}&date_from=${start}&date_to=${end}`);
  }

  async function fetchSessions(formId) {
    const { start, end } = App.state.dateRange;
    return App.api(`/forms/${encodeURIComponent(formId)}/sessions?project_id=${App.state.project}&date_from=${start}&date_to=${end}`);
  }

  async function fetchAbandonment() {
    const { start, end } = App.state.dateRange;
    return App.api(`/forms/abandonment?project_id=${App.state.project}&date_from=${start}&date_to=${end}`);
  }

  /* ------------------------------------------------------------------
     Format helpers
  ------------------------------------------------------------------ */
  function formatMs(ms) {
    if (ms == null || isNaN(ms)) return '--';
    if (ms < 1000) return ms + 'ms';
    const s = Math.round(ms / 1000);
    if (s < 60) return s + 's';
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return m + 'm ' + rem + 's';
  }

  function formatPercent(val) {
    if (val == null || isNaN(val)) return '--';
    return val.toFixed(1) + '%';
  }

  /* ------------------------------------------------------------------
     Destroy existing charts
  ------------------------------------------------------------------ */
  function destroyChart(key) {
    if (App.state.chartInstances[key]) {
      try { App.state.chartInstances[key].destroy(); } catch (_) {}
      delete App.state.chartInstances[key];
    }
  }

  /* ------------------------------------------------------------------
     Field Funnel Chart (horizontal bars showing drop-off)
  ------------------------------------------------------------------ */
  function renderFieldFunnelChart(canvasId, fields, totalSessions) {
    const ctx = document.getElementById(canvasId);
    if (!ctx || !fields || fields.length === 0) return;

    const labels = fields.map(f => f.field_name);
    const counts = fields.map(f => f.sessions);
    const maxCount = Math.max(totalSessions, ...counts, 1);

    // Color gradient from green (high engagement) to red (high drop-off)
    const colors = fields.map((f) => {
      const ratio = f.drop_off_rate / 100;
      const r = Math.round(34 + ratio * (239 - 34));
      const g = Math.round(197 - ratio * (197 - 68));
      const b = Math.round(94 - ratio * (94 - 68));
      return `rgba(${r}, ${g}, ${b}, 0.7)`;
    });

    destroyChart('forms-funnel');

    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Sessions',
          data: counts,
          backgroundColor: colors,
          borderColor: colors.map(c => c.replace('0.7', '1')),
          borderWidth: 1,
          borderRadius: 4,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e293b',
            titleColor: '#e2e8f0',
            bodyColor: '#94a3b8',
            borderColor: '#334155',
            borderWidth: 1,
            callbacks: {
              afterLabel: function(ctx) {
                const field = fields[ctx.dataIndex];
                return 'Drop-off: ' + formatPercent(field.drop_off_rate);
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(51, 65, 85, 0.3)' },
            ticks: { color: '#64748b', font: { size: 11 } },
            beginAtZero: true,
            max: maxCount,
          },
          y: {
            grid: { display: false },
            ticks: { color: '#e2e8f0', font: { size: 12, weight: '500' } },
          }
        }
      }
    });
    App.state.chartInstances['forms-funnel'] = chart;
  }

  /* ------------------------------------------------------------------
     Abandonment Pie Chart
  ------------------------------------------------------------------ */
  function renderAbandonmentPieChart(canvasId, topFields) {
    const ctx = document.getElementById(canvasId);
    if (!ctx || !topFields || topFields.length === 0) return;

    const labels = topFields.slice(0, 8).map(f => {
      const name = f.field_name || 'Unknown';
      return name.length > 25 ? name.substring(0, 25) + '...' : name;
    });
    const values = topFields.slice(0, 8).map(f => f.abandon_count);
    const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#22c55e', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

    destroyChart('forms-abandon-pie');

    const chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors.slice(0, values.length),
          borderColor: '#1e293b',
          borderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#94a3b8',
              font: { size: 11 },
              padding: 12,
              usePointStyle: true,
              pointStyleWidth: 8,
            }
          },
          tooltip: {
            backgroundColor: '#1e293b',
            titleColor: '#e2e8f0',
            bodyColor: '#94a3b8',
            borderColor: '#334155',
            borderWidth: 1,
            callbacks: {
              label: function(ctx) {
                const field = topFields[ctx.dataIndex];
                return field.field_name + ': ' + field.abandon_count + ' (' + formatPercent(field.abandon_pct) + ')';
              }
            }
          }
        },
        cutout: '60%',
      }
    });
    App.state.chartInstances['forms-abandon-pie'] = chart;
  }

  /* ------------------------------------------------------------------
     Time Distribution Bar Chart
  ------------------------------------------------------------------ */
  function renderTimeDistChart(canvasId, fields) {
    const ctx = document.getElementById(canvasId);
    if (!ctx || !fields || fields.length === 0) return;

    const labels = fields.map(f => f.field_name);
    const times = fields.map(f => Math.round((f.avg_time_ms || 0) / 1000 * 10) / 10); // seconds

    destroyChart('forms-time-dist');

    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Avg Time (s)',
          data: times,
          backgroundColor: 'rgba(59, 130, 246, 0.6)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 1,
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e293b',
            titleColor: '#e2e8f0',
            bodyColor: '#94a3b8',
            borderColor: '#334155',
            borderWidth: 1,
            callbacks: {
              label: function(ctx) {
                const field = fields[ctx.dataIndex];
                return 'Avg time: ' + formatMs(field.avg_time_ms);
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: '#94a3b8',
              font: { size: 11 },
              maxRotation: 45,
              minRotation: 0,
            },
          },
          y: {
            grid: { color: 'rgba(51, 65, 85, 0.3)' },
            ticks: {
              color: '#64748b',
              font: { size: 11 },
              callback: function(v) { return v + 's'; }
            },
            beginAtZero: true,
          }
        }
      }
    });
    App.state.chartInstances['forms-time-dist'] = chart;
  }

  /* ------------------------------------------------------------------
     Forms Overview Table
  ------------------------------------------------------------------ */
  function renderFormsTable(forms) {
    if (!forms || forms.length === 0) {
      return Components.emptyState('No Forms Detected', 'No form interactions have been recorded yet. Form tracking data will appear here once users interact with forms on your site.');
    }

    const rows = forms.map(f => {
      const compColor = f.completion_rate >= 70 ? 'text-green-400' :
                         f.completion_rate >= 40 ? 'text-yellow-400' : 'text-red-400';
      const abandColor = f.abandonment_rate > 50 ? 'text-red-400' :
                          f.abandonment_rate > 25 ? 'text-yellow-400' : 'text-green-400';

      return `
        <tr class="border-t border-slate-700/50 hover:bg-slate-700/30 transition-colors cursor-pointer"
            onclick="FormsPage.selectForm('${f.form_id.replace(/'/g, "\\'")}')">
          <td class="px-4 py-3 text-sm">
            <span class="font-medium text-white">${f.form_name}</span>
            <span class="block text-xs text-slate-500">${f.form_id}</span>
          </td>
          <td class="px-4 py-3 text-sm text-right text-slate-300">${App.formatNumber(f.submissions)}</td>
          <td class="px-4 py-3 text-sm text-right">
            <span class="font-medium ${abandColor}">${formatPercent(f.abandonment_rate)}</span>
          </td>
          <td class="px-4 py-3 text-sm text-right">
            <span class="font-medium ${compColor}">${formatPercent(f.completion_rate)}</span>
          </td>
          <td class="px-4 py-3 text-sm text-right text-slate-300">${formatMs(f.avg_completion_time_ms)}</td>
          <td class="px-4 py-3 text-sm text-right text-slate-300">${f.field_count}</td>
        </tr>`;
    }).join('');

    return `
      <div class="overflow-x-auto rounded-xl border border-slate-700/50">
        <table class="w-full">
          <thead class="bg-slate-800/80">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Form</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Submissions</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Abandonment</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Completion</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Avg Time</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Fields</th>
            </tr>
          </thead>
          <tbody class="bg-slate-800/30">${rows}</tbody>
        </table>
      </div>`;
  }

  /* ------------------------------------------------------------------
     Field Heatmap Table
  ------------------------------------------------------------------ */
  function renderFieldHeatmap(fields, totalSessions) {
    if (!fields || fields.length === 0) {
      return `<p class="text-sm text-slate-500 py-4 text-center">No field data available for this form.</p>`;
    }

    const maxTime = Math.max(...fields.map(f => f.avg_time_ms || 0), 1);
    const maxCorrections = Math.max(...fields.map(f => f.avg_corrections || 0), 1);

    const rows = fields.map(f => {
      // Heatmap-style background intensity based on time
      const timeRatio = (f.avg_time_ms || 0) / maxTime;
      const timeHeatBg = timeRatio > 0.7 ? 'bg-red-500/20' :
                          timeRatio > 0.4 ? 'bg-yellow-500/20' : 'bg-green-500/20';
      const timeColor = timeRatio > 0.7 ? 'text-red-400' :
                         timeRatio > 0.4 ? 'text-yellow-400' : 'text-green-400';

      // Correction heat
      const corrRatio = maxCorrections > 0 ? (f.avg_corrections || 0) / maxCorrections : 0;
      const corrColor = corrRatio > 0.7 ? 'text-red-400' :
                         corrRatio > 0.4 ? 'text-yellow-400' : 'text-slate-300';

      // Error heat
      const errColor = f.error_rate > 30 ? 'text-red-400' :
                        f.error_rate > 10 ? 'text-yellow-400' : 'text-green-400';

      // Drop-off heat
      const dropColor = f.drop_off_rate > 50 ? 'text-red-400' :
                         f.drop_off_rate > 25 ? 'text-yellow-400' : 'text-green-400';

      return `
        <tr class="border-t border-slate-700/50 hover:bg-slate-700/30 transition-colors">
          <td class="px-4 py-3 text-sm">
            <span class="font-medium text-white">${f.field_name}</span>
            <span class="block text-xs text-slate-500">${f.field_type}</span>
          </td>
          <td class="px-4 py-3 text-sm text-right">
            <span class="${timeHeatBg} ${timeColor} px-2 py-1 rounded-md font-medium">${formatMs(f.avg_time_ms)}</span>
          </td>
          <td class="px-4 py-3 text-sm text-right">
            <span class="font-medium ${corrColor}">${f.avg_corrections}</span>
            <span class="text-xs text-slate-500 ml-1">(${f.total_corrections} total)</span>
          </td>
          <td class="px-4 py-3 text-sm text-right">
            <span class="font-medium ${errColor}">${formatPercent(f.error_rate)}</span>
            <span class="text-xs text-slate-500 ml-1">(${f.error_count})</span>
          </td>
          <td class="px-4 py-3 text-sm text-right">
            <span class="font-medium ${dropColor}">${formatPercent(f.drop_off_rate)}</span>
          </td>
          <td class="px-4 py-3 text-sm text-right text-slate-300">${App.formatNumber(f.sessions)}</td>
        </tr>`;
    }).join('');

    return `
      <div class="overflow-x-auto rounded-xl border border-slate-700/50">
        <table class="w-full">
          <thead class="bg-slate-800/80">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Field</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Avg Time</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Corrections</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Error Rate</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Drop-off</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Sessions</th>
            </tr>
          </thead>
          <tbody class="bg-slate-800/30">${rows}</tbody>
        </table>
      </div>`;
  }

  /* ------------------------------------------------------------------
     Sessions Table for a specific form
  ------------------------------------------------------------------ */
  function renderFormSessionsTable(sessionsData) {
    if (!sessionsData || !sessionsData.sessions || sessionsData.sessions.length === 0) {
      return `<p class="text-sm text-slate-500 py-4 text-center">No sessions found for this form.</p>`;
    }

    const rows = sessionsData.sessions.slice(0, 20).map(s => {
      const statusColors = {
        completed: 'bg-green-500/15 text-green-400',
        abandoned: 'bg-red-500/15 text-red-400',
        in_progress: 'bg-yellow-500/15 text-yellow-400',
      };
      const statusClass = statusColors[s.status] || statusColors.in_progress;

      return `
        <tr class="border-t border-slate-700/50 hover:bg-slate-700/30 transition-colors cursor-pointer"
            onclick="App.navigate('sessions/${s.session_id}')">
          <td class="px-4 py-3 text-sm">
            <span class="text-blue-400 hover:underline font-mono text-xs">${(s.session_id || '').substring(0, 8)}...</span>
          </td>
          <td class="px-4 py-3 text-sm">
            <span class="px-2 py-0.5 rounded-md text-xs font-medium ${statusClass}">${s.status}</span>
          </td>
          <td class="px-4 py-3 text-sm text-right text-slate-300">${s.fields_interacted}</td>
          <td class="px-4 py-3 text-sm text-right text-slate-300">${formatMs(s.total_time_ms)}</td>
        </tr>`;
    }).join('');

    return `
      <div class="overflow-x-auto rounded-xl border border-slate-700/50">
        <table class="w-full">
          <thead class="bg-slate-800/80">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Session</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Fields</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Time Spent</th>
            </tr>
          </thead>
          <tbody class="bg-slate-800/30">${rows}</tbody>
        </table>
      </div>`;
  }

  /* ------------------------------------------------------------------
     Abandonment Analysis Section
  ------------------------------------------------------------------ */
  function renderAbandonmentSection(data) {
    if (!data) {
      return Components.emptyState('No Abandonment Data', 'No form abandonment data available for this period.');
    }

    const formsBreakdown = (data.forms || []).map(f => {
      const rateColor = f.abandonment_rate > 50 ? 'text-red-400' :
                         f.abandonment_rate > 25 ? 'text-yellow-400' : 'text-green-400';

      const fieldRows = (f.field_breakdown || []).slice(0, 5).map(fb => `
        <div class="flex items-center justify-between py-1.5 text-sm">
          <span class="text-slate-300">${fb.field_name}</span>
          <div class="flex items-center gap-3">
            <div class="w-24 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
              <div class="h-full bg-red-500/70 rounded-full" style="width:${Math.min(fb.abandon_pct, 100)}%"></div>
            </div>
            <span class="text-red-400 font-medium w-12 text-right">${formatPercent(fb.abandon_pct)}</span>
          </div>
        </div>`
      ).join('');

      return `
        <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
          <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-semibold text-white">${f.form_name}</span>
            <span class="text-sm font-medium ${rateColor}">${formatPercent(f.abandonment_rate)} abandoned</span>
          </div>
          <div class="grid grid-cols-3 gap-4 mb-4">
            <div>
              <div class="text-xs text-slate-500">Starts</div>
              <div class="text-lg font-bold text-white">${App.formatNumber(f.total_starts)}</div>
            </div>
            <div>
              <div class="text-xs text-slate-500">Completed</div>
              <div class="text-lg font-bold text-green-400">${App.formatNumber(f.total_submits)}</div>
            </div>
            <div>
              <div class="text-xs text-slate-500">Abandoned</div>
              <div class="text-lg font-bold text-red-400">${App.formatNumber(f.total_abandons)}</div>
            </div>
          </div>
          ${fieldRows ? `
            <div class="border-t border-slate-700/50 pt-3 mt-2">
              <div class="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Abandon at field</div>
              ${fieldRows}
            </div>` : ''}
        </div>`;
    }).join('');

    return formsBreakdown || `<p class="text-sm text-slate-500 text-center py-4">No abandonment breakdown available.</p>`;
  }

  /* ------------------------------------------------------------------
     Form Detail Section (loaded when a form is selected)
  ------------------------------------------------------------------ */
  async function renderFormDetail(formId) {
    const detailContainer = document.getElementById('forms-detail-section');
    if (!detailContainer) return;

    detailContainer.innerHTML = Components.loading();

    try {
      const [fieldsData, sessionsData] = await Promise.all([
        fetchFields(formId).catch(() => null),
        fetchSessions(formId).catch(() => null),
      ]);

      const fields = (fieldsData && fieldsData.fields) || [];
      const totalSessions = (fieldsData && fieldsData.total_sessions) || 0;

      // Icons
      const fieldsIcon = `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z"/></svg>`;
      const sessionsIcon = `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>`;
      const completedIcon = `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
      const abandonIcon = `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>`;

      const completedCount = sessionsData ? sessionsData.completed : 0;
      const abandonedCount = sessionsData ? sessionsData.abandoned : 0;

      detailContainer.innerHTML = `
        <div class="border-t border-slate-800 pt-8 space-y-6">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-lg font-semibold text-white mb-1">Field Analysis: ${formId}</h2>
              <p class="text-sm text-slate-400">Detailed field-level metrics for this form.</p>
            </div>
            <button onclick="FormsPage.clearSelection()" class="text-sm text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-700/50">
              Clear selection
            </button>
          </div>

          <!-- Summary metrics -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            ${Components.metricCard('Fields', fields.length, null, fieldsIcon)}
            ${Components.metricCard('Sessions', App.formatNumber(totalSessions), null, sessionsIcon)}
            ${Components.metricCard('Completed', App.formatNumber(completedCount), null, completedIcon)}
            ${Components.metricCard('Abandoned', App.formatNumber(abandonedCount), null, abandonIcon)}
          </div>

          <!-- Field Funnel -->
          <div>
            <h3 class="text-sm font-semibold text-white mb-3">Field-Level Funnel</h3>
            ${fields.length > 0
              ? `<div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
                  <div style="height:${Math.max(fields.length * 40 + 40, 200)}px; position:relative;">
                    <canvas id="forms-funnel-chart"></canvas>
                  </div>
                </div>`
              : `<div class="bg-slate-800 rounded-xl border border-slate-700/50 p-8 text-center text-sm text-slate-500">
                  No field funnel data available.
                </div>`
            }
          </div>

          <!-- Field Heatmap Table -->
          <div>
            <h3 class="text-sm font-semibold text-white mb-3">Field Heatmap</h3>
            ${renderFieldHeatmap(fields, totalSessions)}
          </div>

          <!-- Time Distribution Chart -->
          <div>
            <h3 class="text-sm font-semibold text-white mb-3">Time Spent Per Field</h3>
            ${fields.length > 0
              ? `<div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
                  <div style="height:280px; position:relative;">
                    <canvas id="forms-time-dist-chart"></canvas>
                  </div>
                </div>`
              : `<div class="bg-slate-800 rounded-xl border border-slate-700/50 p-8 text-center text-sm text-slate-500">
                  No time distribution data available.
                </div>`
            }
          </div>

          <!-- Sessions that interacted with this form -->
          <div>
            <h3 class="text-sm font-semibold text-white mb-3">Sessions</h3>
            ${renderFormSessionsTable(sessionsData)}
          </div>
        </div>`;

      // Render charts after DOM is ready
      requestAnimationFrame(() => {
        if (fields.length > 0) {
          renderFieldFunnelChart('forms-funnel-chart', fields, totalSessions);
          renderTimeDistChart('forms-time-dist-chart', fields);
        }
      });

    } catch (err) {
      detailContainer.innerHTML = Components.error(
        'Error Loading Field Data',
        err.message || 'An error occurred while loading field analytics.'
      );
    }
  }

  /* ------------------------------------------------------------------
     Main Render
  ------------------------------------------------------------------ */
  async function render(container) {
    container.innerHTML = Components.loading();
    _selectedFormId = null;

    try {
      // Fetch overview and abandonment data in parallel
      const [overview, abandonment] = await Promise.all([
        fetchOverview().catch(() => null),
        fetchAbandonment().catch(() => null),
      ]);

      _cachedOverview = overview;

      const forms = (overview && overview.forms) || [];
      const totalForms = (overview && overview.total_forms) || 0;

      // Top-level metrics
      const totalSubmissions = forms.reduce((acc, f) => acc + (f.submissions || 0), 0);
      const avgAbandonRate = forms.length > 0
        ? Math.round(forms.reduce((acc, f) => acc + (f.abandonment_rate || 0), 0) / forms.length * 10) / 10
        : 0;
      const avgCompletionRate = forms.length > 0
        ? Math.round(forms.reduce((acc, f) => acc + (f.completion_rate || 0), 0) / forms.length * 10) / 10
        : 0;

      // Icons
      const formIcon = `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>`;
      const submitIcon = `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/></svg>`;
      const abandonIcon = `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>`;
      const completionIcon = `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;

      const abData = abandonment || {};

      container.innerHTML = `
        <div class="space-y-8">

          <!-- Header -->
          ${Components.sectionHeader('Form Analytics', 'Track form interactions, field-level metrics, and abandonment patterns')}

          <!-- Metric Cards -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            ${Components.metricCard('Total Forms', App.formatNumber(totalForms), null, formIcon)}
            ${Components.metricCard('Total Submissions', App.formatNumber(totalSubmissions), null, submitIcon)}
            ${Components.metricCard('Avg Abandonment', formatPercent(avgAbandonRate), null, abandonIcon)}
            ${Components.metricCard('Avg Completion', formatPercent(avgCompletionRate), null, completionIcon)}
          </div>

          <!-- Forms Overview Table -->
          <div>
            <h3 class="text-sm font-semibold text-white mb-3">Forms Overview</h3>
            <p class="text-xs text-slate-500 mb-3">Click on a form to view field-level analytics.</p>
            ${renderFormsTable(forms)}
          </div>

          <!-- Abandonment Analysis -->
          <div class="border-t border-slate-800 pt-8">
            <h2 class="text-lg font-semibold text-white mb-1">Abandonment Analysis</h2>
            <p class="text-sm text-slate-400 mb-5">Where users give up on your forms.</p>

            <!-- Overall abandonment stats -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
                <div class="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Overall Abandonment</div>
                <div class="text-3xl font-bold ${(abData.overall_abandonment_rate || 0) > 50 ? 'text-red-400' : 'text-yellow-400'}">${formatPercent(abData.overall_abandonment_rate || 0)}</div>
              </div>
              <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
                <div class="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Total Abandoned</div>
                <div class="text-3xl font-bold text-red-400">${App.formatNumber(abData.total_abandoned || 0)}</div>
              </div>
              <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
                <div class="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Total Completed</div>
                <div class="text-3xl font-bold text-green-400">${App.formatNumber(abData.total_completed || 0)}</div>
              </div>
            </div>

            <!-- Abandonment Pie + Per-form breakdown side by side -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <!-- Pie chart: which fields cause abandonment -->
              <div>
                <h3 class="text-sm font-semibold text-white mb-3">Fields Causing Abandonment</h3>
                ${abData.top_abandon_fields && abData.top_abandon_fields.length > 0
                  ? `<div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
                      <div style="height:280px; position:relative;">
                        <canvas id="forms-abandon-pie-chart"></canvas>
                      </div>
                    </div>`
                  : `<div class="bg-slate-800 rounded-xl border border-slate-700/50 p-8 text-center text-sm text-slate-500">
                      No abandonment field data available.
                    </div>`
                }
              </div>

              <!-- Top abandon fields table -->
              <div>
                <h3 class="text-sm font-semibold text-white mb-3">Top Abandon Fields</h3>
                ${abData.top_abandon_fields && abData.top_abandon_fields.length > 0
                  ? `<div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5 space-y-3">
                      ${abData.top_abandon_fields.slice(0, 8).map(f => `
                        <div class="flex items-center justify-between">
                          <span class="text-sm text-slate-300">${f.field_name}</span>
                          <div class="flex items-center gap-3">
                            <div class="w-32 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                              <div class="h-full bg-red-500/70 rounded-full" style="width:${Math.min(f.abandon_pct, 100)}%"></div>
                            </div>
                            <span class="text-sm font-medium text-red-400 w-16 text-right">${App.formatNumber(f.abandon_count)}</span>
                            <span class="text-xs text-slate-500 w-12 text-right">${formatPercent(f.abandon_pct)}</span>
                          </div>
                        </div>`
                      ).join('')}
                    </div>`
                  : `<div class="bg-slate-800 rounded-xl border border-slate-700/50 p-8 text-center text-sm text-slate-500">
                      No abandonment data available.
                    </div>`
                }
              </div>
            </div>

            <!-- Per-form abandonment breakdown -->
            <div>
              <h3 class="text-sm font-semibold text-white mb-3">Per-Form Breakdown</h3>
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                ${renderAbandonmentSection(abData)}
              </div>
            </div>
          </div>

          <!-- Detail Section (populated when a form is selected) -->
          <div id="forms-detail-section"></div>

        </div>`;

      // Render charts after DOM is ready
      requestAnimationFrame(() => {
        if (abData.top_abandon_fields && abData.top_abandon_fields.length > 0) {
          renderAbandonmentPieChart('forms-abandon-pie-chart', abData.top_abandon_fields);
        }
      });

    } catch (err) {
      container.innerHTML = Components.emptyState(
        'Error Loading Form Analytics',
        err.message || 'An error occurred while loading form analytics data.'
      );
    }
  }

  /* ------------------------------------------------------------------
     Form selection handler
  ------------------------------------------------------------------ */
  function selectForm(formId) {
    _selectedFormId = formId;
    renderFormDetail(formId);

    // Scroll to detail section
    const detailSection = document.getElementById('forms-detail-section');
    if (detailSection) {
      detailSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function clearSelection() {
    _selectedFormId = null;
    destroyChart('forms-funnel');
    destroyChart('forms-time-dist');
    const detailContainer = document.getElementById('forms-detail-section');
    if (detailContainer) detailContainer.innerHTML = '';
  }

  /* ------------------------------------------------------------------
     Public API
  ------------------------------------------------------------------ */
  return {
    render,
    selectForm,
    clearSelection,
  };

})();
