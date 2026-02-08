/* ==========================================================================
   surveys-page.js  -  Survey & Feedback Management Dashboard
   Create, manage, and analyze embeddable surveys (NPS, CSAT, CES, Custom, Feedback)
   ========================================================================== */

const SurveysPage = (() => {

  /* ------------------------------------------------------------------
     Constants
  ------------------------------------------------------------------ */
  const SURVEY_TYPES = [
    { value: 'nps',      label: 'NPS',      description: 'Net Promoter Score (0-10)',      color: '#4361ee' },
    { value: 'csat',     label: 'CSAT',     description: 'Customer Satisfaction (1-5 stars)', color: '#22c55e' },
    { value: 'ces',      label: 'CES',      description: 'Customer Effort Score (1-7)',     color: '#f59e0b' },
    { value: 'custom',   label: 'Custom',   description: 'Multi-question survey',           color: '#8b5cf6' },
    { value: 'feedback', label: 'Feedback', description: 'Open text feedback',              color: '#ec4899' },
  ];

  const TRIGGER_TYPES = [
    { value: 'manual',       label: 'Manual',          description: 'Show via API or tracker call' },
    { value: 'time_on_page', label: 'Time on Page',    description: 'After X seconds on page' },
    { value: 'scroll_pct',   label: 'Scroll %',        description: 'When user scrolls past threshold' },
    { value: 'exit_intent',  label: 'Exit Intent',     description: 'When user moves to leave page' },
    { value: 'page_url',     label: 'Page URL',        description: 'On specific page URL pattern' },
    { value: 'event',        label: 'Custom Event',    description: 'On a tracked custom event' },
  ];

  const POSITIONS = [
    { value: 'bottom-right', label: 'Bottom Right' },
    { value: 'bottom-left',  label: 'Bottom Left' },
    { value: 'center',       label: 'Center Modal' },
    { value: 'slide-in',     label: 'Slide In Right' },
  ];

  const QUESTION_TYPES = [
    { value: 'rating',       label: 'Rating' },
    { value: 'text',         label: 'Text' },
    { value: 'select',       label: 'Single Select' },
    { value: 'multi-select', label: 'Multi Select' },
  ];

  /* ------------------------------------------------------------------
     State
  ------------------------------------------------------------------ */
  let surveys = [];
  let viewingSurveyId = null;
  let viewingResponses = [];
  let viewingStats = null;
  let viewingPagination = null;
  let editingSurvey = null;
  let modalQuestions = [];

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

  function typeInfo(type) {
    return SURVEY_TYPES.find(t => t.value === type) || SURVEY_TYPES[0];
  }

  function triggerInfo(trigger) {
    return TRIGGER_TYPES.find(t => t.value === trigger) || TRIGGER_TYPES[0];
  }

  function formatDate(dateStr) {
    if (!dateStr) return '--';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function formatShortDate(dateStr) {
    if (!dateStr) return '--';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  function destroyChart(key) {
    if (App.state.chartInstances[key]) {
      try { App.state.chartInstances[key].destroy(); } catch (_) {}
      delete App.state.chartInstances[key];
    }
  }

  /* ------------------------------------------------------------------
     Data fetching
  ------------------------------------------------------------------ */
  async function fetchSurveys() {
    try {
      const data = await App.api('/surveys?project_id=' + App.state.project);
      surveys = data.surveys || [];
    } catch (_) {
      surveys = [];
    }
  }

  async function fetchResponses(surveyId, page) {
    try {
      const data = await App.api(`/surveys/${surveyId}/responses?page=${page || 1}&limit=50`);
      viewingResponses = data.responses || [];
      viewingPagination = data.pagination || { page: 1, pages: 1, total: 0 };
    } catch (_) {
      viewingResponses = [];
      viewingPagination = { page: 1, pages: 1, total: 0 };
    }
  }

  async function fetchStats(surveyId) {
    try {
      const data = await App.api(`/surveys/${surveyId}/stats`);
      viewingStats = data.stats || null;
    } catch (_) {
      viewingStats = null;
    }
  }

  async function createSurvey(payload) {
    const data = await App.api('/surveys', { method: 'POST', body: payload });
    Components.toast('Survey created successfully', 'success');
    return data;
  }

  async function updateSurvey(id, payload) {
    const data = await App.api(`/surveys/${id}`, { method: 'PUT', body: payload });
    Components.toast('Survey updated successfully', 'success');
    return data;
  }

  async function deleteSurvey(id) {
    await App.api(`/surveys/${id}`, { method: 'DELETE' });
    Components.toast('Survey deleted', 'success');
  }

  async function toggleEnabled(id, enabled) {
    try {
      await App.api(`/surveys/${id}`, { method: 'PUT', body: { enabled } });
      const idx = surveys.findIndex(s => s.id === id);
      if (idx !== -1) surveys[idx].enabled = enabled;
      Components.toast(enabled ? 'Survey enabled' : 'Survey disabled', 'success');
      renderSurveyList();
    } catch (err) {
      Components.toast('Failed to update survey', 'error');
    }
  }

  /* ------------------------------------------------------------------
     Summary Cards
  ------------------------------------------------------------------ */
  function renderSummaryCards() {
    const totalSurveys = surveys.length;
    const totalResponses = surveys.reduce((acc, s) => acc + (s.response_count || 0), 0);

    // Compute average NPS from NPS surveys that have responses
    const npsSurveys = surveys.filter(s => s.type === 'nps' && (s.response_count || 0) > 0);
    const avgNpsLabel = npsSurveys.length > 0 ? '--' : '--'; // Will be shown from stats if loaded

    // Compute average CSAT similarly
    const csatSurveys = surveys.filter(s => s.type === 'csat' && (s.response_count || 0) > 0);

    const surveyIcon = '<svg style="width:20px;height:20px;" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"/></svg>';
    const responseIcon = '<svg style="width:20px;height:20px;" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/></svg>';
    const npsIcon = '<svg style="width:20px;height:20px;" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>';
    const activeIcon = '<svg style="width:20px;height:20px;" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.348 14.651a3.75 3.75 0 010-5.303m5.304 0a3.75 3.75 0 010 5.303m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.808-3.808-9.98 0-13.789m13.788 0c3.808 3.808 3.808 9.981 0 13.79M12 12h.008v.007H12V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/></svg>';

    const activeSurveys = surveys.filter(s => s.enabled).length;

    return `
      <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:16px; margin-bottom:24px;">
        <div style="background:#16213e; border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:20px; display:flex; align-items:center; gap:16px;">
          <div style="width:44px; height:44px; border-radius:10px; background:rgba(67,97,238,0.1); border:1px solid rgba(67,97,238,0.25); display:flex; align-items:center; justify-content:center; flex-shrink:0; color:#4361ee;">
            ${surveyIcon}
          </div>
          <div>
            <div style="font-size:22px; font-weight:700; color:#e0e0e0; line-height:1;">${totalSurveys}</div>
            <div style="font-size:12px; color:#888; margin-top:4px;">Total Surveys</div>
          </div>
        </div>
        <div style="background:#16213e; border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:20px; display:flex; align-items:center; gap:16px;">
          <div style="width:44px; height:44px; border-radius:10px; background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.25); display:flex; align-items:center; justify-content:center; flex-shrink:0; color:#22c55e;">
            ${responseIcon}
          </div>
          <div>
            <div style="font-size:22px; font-weight:700; color:#e0e0e0; line-height:1;">${App.formatNumber(totalResponses)}</div>
            <div style="font-size:12px; color:#888; margin-top:4px;">Total Responses</div>
          </div>
        </div>
        <div style="background:#16213e; border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:20px; display:flex; align-items:center; gap:16px;">
          <div style="width:44px; height:44px; border-radius:10px; background:rgba(67,97,238,0.1); border:1px solid rgba(67,97,238,0.25); display:flex; align-items:center; justify-content:center; flex-shrink:0; color:#4361ee;">
            ${npsIcon}
          </div>
          <div>
            <div style="font-size:22px; font-weight:700; color:#e0e0e0; line-height:1;">${npsSurveys.length}</div>
            <div style="font-size:12px; color:#888; margin-top:4px;">NPS Surveys</div>
          </div>
        </div>
        <div style="background:#16213e; border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:20px; display:flex; align-items:center; gap:16px;">
          <div style="width:44px; height:44px; border-radius:10px; background:rgba(0,200,83,0.1); border:1px solid rgba(0,200,83,0.25); display:flex; align-items:center; justify-content:center; flex-shrink:0; color:#00c853;">
            ${activeIcon}
          </div>
          <div>
            <div style="font-size:22px; font-weight:700; color:#e0e0e0; line-height:1;">${activeSurveys}</div>
            <div style="font-size:12px; color:#888; margin-top:4px;">Active Surveys</div>
          </div>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------
     Survey List
  ------------------------------------------------------------------ */
  function renderSurveyList() {
    const listContainer = document.getElementById('surveys-list-container');
    if (!listContainer) return;

    if (surveys.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align:center; padding:48px 20px;">
          <svg style="width:48px; height:48px; color:#444; margin:0 auto 12px;" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"/>
          </svg>
          <p style="font-size:14px; color:#999; margin:0;">No surveys created yet</p>
          <p style="font-size:12px; color:#666; margin-top:6px;">Create your first survey to start collecting user feedback</p>
        </div>`;
      return;
    }

    const cards = surveys.map(survey => {
      const ti = typeInfo(survey.type);
      const tri = triggerInfo(survey.trigger_type);
      const responseCount = survey.response_count || 0;

      return `
        <div style="background:#16213e; border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:20px; transition:border-color 0.2s;"
             onmouseenter="this.style.borderColor='rgba(255,255,255,0.12)'" onmouseleave="this.style.borderColor='rgba(255,255,255,0.06)'">

          <!-- Header row -->
          <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:12px;">
            <div style="flex:1; min-width:0;">
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                <h4 style="font-size:14px; font-weight:600; color:#e0e0e0; margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(survey.name)}</h4>
                <span style="display:inline-block; padding:2px 8px; border-radius:6px; font-size:10px; font-weight:600; background:${ti.color}18; color:${ti.color}; border:1px solid ${ti.color}35; flex-shrink:0;">${ti.label}</span>
                ${!survey.enabled ? '<span style="display:inline-block; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:600; background:rgba(255,255,255,0.05); color:#666; border:1px solid rgba(255,255,255,0.08);">Disabled</span>' : ''}
              </div>
              <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                <span style="font-size:11px; color:#666;">Trigger: <span style="color:#999;">${tri.label}</span></span>
                <span style="font-size:11px; color:#666;">Responses: <span style="color:#999;">${App.formatNumber(responseCount)}</span></span>
              </div>
            </div>

            <!-- Toggle -->
            <button onclick="event.stopPropagation(); SurveysPage.toggleEnabled('${survey.id}', ${!survey.enabled})"
                    style="position:relative; width:40px; height:22px; border-radius:11px; border:none; cursor:pointer; transition:background 0.2s; background:${survey.enabled ? '#22c55e' : '#444'}; flex-shrink:0;"
                    title="${survey.enabled ? 'Enabled - click to disable' : 'Disabled - click to enable'}">
              <span style="position:absolute; top:3px; width:16px; height:16px; border-radius:50%; background:white; box-shadow:0 1px 3px rgba(0,0,0,0.3); transition:left 0.2s; left:${survey.enabled ? '21px' : '3px'};"></span>
            </button>
          </div>

          <!-- Actions -->
          <div style="display:flex; align-items:center; gap:6px; border-top:1px solid rgba(255,255,255,0.04); padding-top:12px;">
            <button onclick="SurveysPage.viewResponses('${survey.id}')"
                    style="flex:1; padding:6px 10px; border-radius:8px; border:1px solid rgba(67,97,238,0.25); background:rgba(67,97,238,0.08); color:#4361ee; cursor:pointer; font-size:11px; font-weight:600; transition:all 0.15s;"
                    onmouseenter="this.style.background='rgba(67,97,238,0.15)'" onmouseleave="this.style.background='rgba(67,97,238,0.08)'">
              Responses
            </button>
            <button onclick="SurveysPage.showEditModal('${survey.id}')"
                    style="flex:1; padding:6px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.03); color:#999; cursor:pointer; font-size:11px; font-weight:600; transition:all 0.15s;"
                    onmouseenter="this.style.background='rgba(255,255,255,0.06)'" onmouseleave="this.style.background='rgba(255,255,255,0.03)'">
              Edit
            </button>
            <button onclick="SurveysPage.confirmDelete('${survey.id}')"
                    style="padding:6px 10px; border-radius:8px; border:1px solid rgba(239,68,68,0.2); background:rgba(239,68,68,0.06); color:#ef4444; cursor:pointer; font-size:11px; font-weight:600; transition:all 0.15s;"
                    onmouseenter="this.style.background='rgba(239,68,68,0.12)'" onmouseleave="this.style.background='rgba(239,68,68,0.06)'">
              Delete
            </button>
          </div>
        </div>`;
    }).join('');

    listContainer.innerHTML = `
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(340px, 1fr)); gap:16px;">
        ${cards}
      </div>`;
  }

  /* ------------------------------------------------------------------
     Create / Edit Survey Modal
  ------------------------------------------------------------------ */
  function showCreateModal() {
    editingSurvey = null;
    modalQuestions = [];
    renderSurveyModal({
      name: '',
      type: 'nps',
      trigger_type: 'manual',
      trigger_config: {},
      targeting: {},
      appearance: { position: 'bottom-right', theme: 'dark' },
      questions: [],
    });
  }

  function showEditModal(surveyId) {
    const survey = surveys.find(s => s.id === surveyId);
    if (!survey) return;
    editingSurvey = survey;
    modalQuestions = Array.isArray(survey.questions) ? JSON.parse(JSON.stringify(survey.questions)) : [];
    renderSurveyModal(survey);
  }

  function renderSurveyModal(data) {
    const isEdit = !!editingSurvey;

    const typeOptions = SURVEY_TYPES.map(t =>
      `<option value="${t.value}" ${data.type === t.value ? 'selected' : ''}>${t.label} - ${t.description}</option>`
    ).join('');

    const triggerOptions = TRIGGER_TYPES.map(t =>
      `<option value="${t.value}" ${data.trigger_type === t.value ? 'selected' : ''}>${t.label}</option>`
    ).join('');

    const posOptions = POSITIONS.map(p =>
      `<option value="${p.value}" ${(data.appearance || {}).position === p.value ? 'selected' : ''}>${p.label}</option>`
    ).join('');

    // Trigger config fields
    const triggerConfig = data.trigger_config || {};
    const triggerConfigHTML = `
      <div id="survey-trigger-config-fields" style="margin-top:8px;">
        ${renderTriggerConfigFields(data.trigger_type, triggerConfig)}
      </div>`;

    // Questions builder (only for custom type)
    const questionsHTML = renderQuestionsBuilder();

    // Targeting
    const targeting = data.targeting || {};

    // Widget preview
    const appearance = data.appearance || {};
    const previewTheme = appearance.theme || 'dark';

    const content = `
      <div style="display:flex; flex-direction:column; gap:16px; max-height:70vh; overflow-y:auto; padding-right:8px;">

        <!-- Name -->
        <div>
          <label style="display:block; font-size:11px; font-weight:600; color:#888; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px;">Survey Name</label>
          <input type="text" id="survey-name" value="${escapeHtml(data.name)}" placeholder="e.g. Post-Purchase Feedback"
                 style="width:100%; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:8px 12px; font-size:13px; color:#e0e0e0; outline:none; box-sizing:border-box;" />
        </div>

        <!-- Type -->
        <div>
          <label style="display:block; font-size:11px; font-weight:600; color:#888; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px;">Survey Type</label>
          <select id="survey-type" onchange="SurveysPage.onTypeChange(this.value)"
                  style="width:100%; background:#16213e; border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:8px 12px; font-size:13px; color:#e0e0e0; outline:none; box-sizing:border-box;">
            ${typeOptions}
          </select>
        </div>

        <!-- Questions Builder (Custom only) -->
        <div id="survey-questions-section" style="display:${data.type === 'custom' ? 'block' : 'none'};">
          <label style="display:block; font-size:11px; font-weight:600; color:#888; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px;">Questions</label>
          <div id="survey-questions-container">
            ${questionsHTML}
          </div>
          <button onclick="SurveysPage.addQuestion()"
                  style="margin-top:8px; width:100%; padding:8px; border-radius:8px; border:1px dashed rgba(255,255,255,0.12); background:transparent; color:#888; cursor:pointer; font-size:12px; font-weight:500; transition:all 0.15s;"
                  onmouseenter="this.style.borderColor='rgba(67,97,238,0.4)'; this.style.color='#4361ee'" onmouseleave="this.style.borderColor='rgba(255,255,255,0.12)'; this.style.color='#888'">
            + Add Question
          </button>
        </div>

        <!-- Trigger -->
        <div>
          <label style="display:block; font-size:11px; font-weight:600; color:#888; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px;">Trigger</label>
          <select id="survey-trigger" onchange="SurveysPage.onTriggerChange(this.value)"
                  style="width:100%; background:#16213e; border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:8px 12px; font-size:13px; color:#e0e0e0; outline:none; box-sizing:border-box;">
            ${triggerOptions}
          </select>
          ${triggerConfigHTML}
        </div>

        <!-- Targeting -->
        <div>
          <label style="display:block; font-size:11px; font-weight:600; color:#888; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px;">Targeting</label>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <div>
              <label style="font-size:10px; color:#666; display:block; margin-bottom:4px;">Device</label>
              <select id="survey-target-device"
                      style="width:100%; background:#16213e; border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:6px 10px; font-size:12px; color:#e0e0e0; outline:none; box-sizing:border-box;">
                <option value="all" ${(targeting.device || 'all') === 'all' ? 'selected' : ''}>All Devices</option>
                <option value="desktop" ${targeting.device === 'desktop' ? 'selected' : ''}>Desktop</option>
                <option value="mobile" ${targeting.device === 'mobile' ? 'selected' : ''}>Mobile</option>
                <option value="tablet" ${targeting.device === 'tablet' ? 'selected' : ''}>Tablet</option>
              </select>
            </div>
            <div>
              <label style="font-size:10px; color:#666; display:block; margin-bottom:4px;">Visitor Type</label>
              <select id="survey-target-visitor"
                      style="width:100%; background:#16213e; border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:6px 10px; font-size:12px; color:#e0e0e0; outline:none; box-sizing:border-box;">
                <option value="all" ${(targeting.visitor_type || 'all') === 'all' ? 'selected' : ''}>All Visitors</option>
                <option value="new" ${targeting.visitor_type === 'new' ? 'selected' : ''}>New Visitors</option>
                <option value="returning" ${targeting.visitor_type === 'returning' ? 'selected' : ''}>Returning Visitors</option>
              </select>
            </div>
          </div>
          <div style="margin-top:8px;">
            <label style="font-size:10px; color:#666; display:block; margin-bottom:4px;">URL Pattern (regex)</label>
            <input type="text" id="survey-target-url" value="${escapeHtml(targeting.url_pattern || '')}" placeholder="e.g. /checkout.*"
                   style="width:100%; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:6px 10px; font-size:12px; color:#e0e0e0; outline:none; box-sizing:border-box;" />
          </div>
        </div>

        <!-- Appearance -->
        <div>
          <label style="display:block; font-size:11px; font-weight:600; color:#888; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px;">Appearance</label>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <div>
              <label style="font-size:10px; color:#666; display:block; margin-bottom:4px;">Position</label>
              <select id="survey-appearance-position"
                      style="width:100%; background:#16213e; border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:6px 10px; font-size:12px; color:#e0e0e0; outline:none; box-sizing:border-box;">
                ${posOptions}
              </select>
            </div>
            <div>
              <label style="font-size:10px; color:#666; display:block; margin-bottom:4px;">Theme</label>
              <select id="survey-appearance-theme"
                      style="width:100%; background:#16213e; border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:6px 10px; font-size:12px; color:#e0e0e0; outline:none; box-sizing:border-box;">
                <option value="dark" ${previewTheme === 'dark' ? 'selected' : ''}>Dark</option>
                <option value="light" ${previewTheme === 'light' ? 'selected' : ''}>Light</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Preview -->
        <div>
          <label style="display:block; font-size:11px; font-weight:600; color:#888; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px;">Preview</label>
          <div id="survey-preview-area" style="background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:20px; display:flex; justify-content:center;">
            ${renderWidgetPreview(data.type, previewTheme)}
          </div>
        </div>

      </div>`;

    Components.showModal(isEdit ? 'Edit Survey' : 'Create Survey', content, [
      { label: isEdit ? 'Save Changes' : 'Create Survey', onClick: 'SurveysPage.confirmSave()' },
    ]);

    setTimeout(() => {
      const inp = document.getElementById('survey-name');
      if (inp) inp.focus();
    }, 100);
  }

  /* -- Trigger config fields -- */
  function renderTriggerConfigFields(triggerType, config) {
    config = config || {};
    if (triggerType === 'time_on_page') {
      return `
        <div style="margin-top:6px;">
          <label style="font-size:10px; color:#666; display:block; margin-bottom:4px;">Seconds on page</label>
          <input type="number" id="survey-trigger-seconds" value="${config.seconds || 30}" min="1" max="3600" placeholder="30"
                 style="width:120px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:6px 10px; font-size:12px; color:#e0e0e0; outline:none;" />
        </div>`;
    }
    if (triggerType === 'scroll_pct') {
      return `
        <div style="margin-top:6px;">
          <label style="font-size:10px; color:#666; display:block; margin-bottom:4px;">Scroll percentage (0-100)</label>
          <input type="number" id="survey-trigger-scroll" value="${config.scroll_pct || 50}" min="0" max="100" placeholder="50"
                 style="width:120px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:6px 10px; font-size:12px; color:#e0e0e0; outline:none;" />
        </div>`;
    }
    if (triggerType === 'page_url') {
      return `
        <div style="margin-top:6px;">
          <label style="font-size:10px; color:#666; display:block; margin-bottom:4px;">URL pattern (regex or path)</label>
          <input type="text" id="survey-trigger-url" value="${escapeHtml(config.url_pattern || '')}" placeholder="/pricing"
                 style="width:100%; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:6px 10px; font-size:12px; color:#e0e0e0; outline:none; box-sizing:border-box;" />
        </div>`;
    }
    if (triggerType === 'event') {
      return `
        <div style="margin-top:6px;">
          <label style="font-size:10px; color:#666; display:block; margin-bottom:4px;">Event name</label>
          <input type="text" id="survey-trigger-event" value="${escapeHtml(config.event_name || '')}" placeholder="purchase_complete"
                 style="width:100%; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:6px 10px; font-size:12px; color:#e0e0e0; outline:none; box-sizing:border-box;" />
        </div>`;
    }
    // manual and exit_intent have no extra config
    return '';
  }

  function onTriggerChange(triggerType) {
    const container = document.getElementById('survey-trigger-config-fields');
    if (container) {
      container.innerHTML = renderTriggerConfigFields(triggerType, {});
    }
  }

  function onTypeChange(type) {
    const questionsSection = document.getElementById('survey-questions-section');
    if (questionsSection) {
      questionsSection.style.display = type === 'custom' ? 'block' : 'none';
    }
    // Update preview
    const themeEl = document.getElementById('survey-appearance-theme');
    const theme = themeEl ? themeEl.value : 'dark';
    const previewArea = document.getElementById('survey-preview-area');
    if (previewArea) {
      previewArea.innerHTML = renderWidgetPreview(type, theme);
    }
  }

  /* -- Questions builder -- */
  function renderQuestionsBuilder() {
    if (modalQuestions.length === 0) {
      return '<p style="font-size:12px; color:#666; text-align:center; padding:12px 0;">No questions added yet.</p>';
    }

    return modalQuestions.map((q, i) => {
      const qTypeOptions = QUESTION_TYPES.map(qt =>
        `<option value="${qt.value}" ${q.type === qt.value ? 'selected' : ''}>${qt.label}</option>`
      ).join('');

      return `
        <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:8px; padding:10px; margin-bottom:6px; display:flex; align-items:flex-start; gap:8px;">
          <span style="flex-shrink:0; width:22px; height:22px; border-radius:50%; background:rgba(67,97,238,0.15); border:1px solid rgba(67,97,238,0.3); display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700; color:#4361ee; margin-top:2px;">${i + 1}</span>
          <div style="flex:1; display:flex; flex-direction:column; gap:6px;">
            <input type="text" value="${escapeHtml(q.text || '')}" placeholder="Question text"
                   onchange="SurveysPage.updateQuestion(${i}, 'text', this.value)"
                   style="width:100%; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:6px 10px; font-size:12px; color:#e0e0e0; outline:none; box-sizing:border-box;" />
            <div style="display:flex; gap:6px; align-items:center;">
              <select onchange="SurveysPage.updateQuestion(${i}, 'type', this.value)"
                      style="background:#16213e; border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:4px 8px; font-size:11px; color:#e0e0e0; outline:none;">
                ${qTypeOptions}
              </select>
              ${(q.type === 'select' || q.type === 'multi-select') ? `
                <input type="text" value="${escapeHtml((q.options || []).join(', '))}" placeholder="Option 1, Option 2, ..."
                       onchange="SurveysPage.updateQuestion(${i}, 'options', this.value)"
                       style="flex:1; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:4px 8px; font-size:11px; color:#e0e0e0; outline:none; box-sizing:border-box;" />
              ` : ''}
            </div>
          </div>
          <button onclick="SurveysPage.removeQuestion(${i})"
                  style="flex-shrink:0; background:transparent; border:none; cursor:pointer; color:#666; padding:2px; transition:color 0.15s;"
                  onmouseenter="this.style.color='#ef4444'" onmouseleave="this.style.color='#666'">
            <svg style="width:16px; height:16px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>`;
    }).join('');
  }

  function addQuestion() {
    modalQuestions.push({ type: 'text', text: '', options: [] });
    refreshQuestions();
  }

  function removeQuestion(index) {
    modalQuestions.splice(index, 1);
    refreshQuestions();
  }

  function updateQuestion(index, field, value) {
    if (field === 'options') {
      modalQuestions[index].options = value.split(',').map(o => o.trim()).filter(Boolean);
    } else {
      modalQuestions[index][field] = value;
    }
  }

  function refreshQuestions() {
    const container = document.getElementById('survey-questions-container');
    if (container) {
      container.innerHTML = renderQuestionsBuilder();
    }
  }

  /* -- Widget preview -- */
  function renderWidgetPreview(type, theme) {
    const bg = theme === 'dark' ? '#1a1a2e' : '#ffffff';
    const text = theme === 'dark' ? '#e0e0e0' : '#1a1a2e';
    const subtext = theme === 'dark' ? '#888' : '#666';
    const border = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    const accent = '#4361ee';

    let bodyHTML = '';

    if (type === 'nps') {
      const buttons = [];
      for (let i = 0; i <= 10; i++) {
        const btnBg = i <= 6 ? 'rgba(239,68,68,0.15)' : i <= 8 ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)';
        const btnColor = i <= 6 ? '#ef4444' : i <= 8 ? '#f59e0b' : '#22c55e';
        buttons.push(`<span style="width:22px; height:22px; border-radius:4px; background:${btnBg}; color:${btnColor}; font-size:9px; font-weight:700; display:flex; align-items:center; justify-content:center;">${i}</span>`);
      }
      bodyHTML = `
        <div style="font-size:11px; color:${text}; font-weight:600; margin-bottom:8px;">How likely are you to recommend us?</div>
        <div style="display:flex; gap:3px; flex-wrap:wrap;">${buttons.join('')}</div>
        <div style="display:flex; justify-content:space-between; margin-top:4px;">
          <span style="font-size:8px; color:${subtext};">Not likely</span>
          <span style="font-size:8px; color:${subtext};">Very likely</span>
        </div>`;
    } else if (type === 'csat') {
      const stars = [];
      for (let i = 1; i <= 5; i++) {
        stars.push(`<span style="font-size:18px; cursor:pointer; color:${i <= 3 ? '#f59e0b' : '#444'};">&#9733;</span>`);
      }
      bodyHTML = `
        <div style="font-size:11px; color:${text}; font-weight:600; margin-bottom:8px;">How satisfied are you?</div>
        <div style="display:flex; gap:4px; justify-content:center;">${stars.join('')}</div>`;
    } else if (type === 'ces') {
      const scale = [];
      for (let i = 1; i <= 7; i++) {
        scale.push(`<span style="width:24px; height:24px; border-radius:50%; background:rgba(67,97,238,0.1); border:1px solid rgba(67,97,238,0.25); color:#4361ee; font-size:10px; font-weight:600; display:flex; align-items:center; justify-content:center;">${i}</span>`);
      }
      bodyHTML = `
        <div style="font-size:11px; color:${text}; font-weight:600; margin-bottom:8px;">How easy was it to complete your task?</div>
        <div style="display:flex; gap:4px; justify-content:center;">${scale.join('')}</div>
        <div style="display:flex; justify-content:space-between; margin-top:4px;">
          <span style="font-size:8px; color:${subtext};">Very difficult</span>
          <span style="font-size:8px; color:${subtext};">Very easy</span>
        </div>`;
    } else if (type === 'feedback') {
      bodyHTML = `
        <div style="font-size:11px; color:${text}; font-weight:600; margin-bottom:8px;">We'd love your feedback</div>
        <div style="background:rgba(255,255,255,0.04); border:1px solid ${border}; border-radius:6px; padding:6px 8px; font-size:10px; color:${subtext}; min-height:40px;">Type your feedback here...</div>`;
    } else {
      bodyHTML = `
        <div style="font-size:11px; color:${text}; font-weight:600; margin-bottom:8px;">Custom Survey</div>
        <div style="font-size:10px; color:${subtext};">Multiple questions configured</div>`;
    }

    return `
      <div style="width:260px; background:${bg}; border:1px solid ${border}; border-radius:12px; padding:16px; box-shadow:0 4px 24px rgba(0,0,0,0.3); position:relative;">
        <button style="position:absolute; top:8px; right:8px; background:transparent; border:none; color:${subtext}; cursor:pointer; font-size:14px; line-height:1;">x</button>
        ${bodyHTML}
        <button style="margin-top:12px; width:100%; padding:6px; border-radius:6px; border:none; background:${accent}; color:white; font-size:11px; font-weight:600; cursor:pointer;">Submit</button>
      </div>`;
  }

  /* -- Save handler -- */
  async function confirmSave() {
    const name = (document.getElementById('survey-name') || {}).value;
    const type = (document.getElementById('survey-type') || {}).value;
    const triggerType = (document.getElementById('survey-trigger') || {}).value;

    if (!name || !name.trim()) {
      Components.toast('Survey name is required', 'warning');
      return;
    }

    // Build trigger config
    const triggerConfig = {};
    if (triggerType === 'time_on_page') {
      const el = document.getElementById('survey-trigger-seconds');
      triggerConfig.seconds = el ? parseInt(el.value, 10) || 30 : 30;
    } else if (triggerType === 'scroll_pct') {
      const el = document.getElementById('survey-trigger-scroll');
      triggerConfig.scroll_pct = el ? parseInt(el.value, 10) || 50 : 50;
    } else if (triggerType === 'page_url') {
      const el = document.getElementById('survey-trigger-url');
      triggerConfig.url_pattern = el ? el.value : '';
    } else if (triggerType === 'event') {
      const el = document.getElementById('survey-trigger-event');
      triggerConfig.event_name = el ? el.value : '';
    }

    // Build targeting
    const targeting = {};
    const deviceEl = document.getElementById('survey-target-device');
    const visitorEl = document.getElementById('survey-target-visitor');
    const urlPatEl = document.getElementById('survey-target-url');
    if (deviceEl && deviceEl.value !== 'all') targeting.device = deviceEl.value;
    if (visitorEl && visitorEl.value !== 'all') targeting.visitor_type = visitorEl.value;
    if (urlPatEl && urlPatEl.value) targeting.url_pattern = urlPatEl.value;

    // Build appearance
    const appearance = {};
    const posEl = document.getElementById('survey-appearance-position');
    const themeEl = document.getElementById('survey-appearance-theme');
    if (posEl) appearance.position = posEl.value;
    if (themeEl) appearance.theme = themeEl.value;

    const payload = {
      name: name.trim(),
      type,
      questions: type === 'custom' ? modalQuestions : [],
      trigger_type: triggerType,
      trigger_config: triggerConfig,
      targeting,
      appearance,
      projectId: App.state.project,
    };

    try {
      if (editingSurvey) {
        await updateSurvey(editingSurvey.id, payload);
      } else {
        await createSurvey(payload);
      }
      Components.closeModal();
      await fetchSurveys();
      const container = document.getElementById('surveys-page-root');
      if (container) renderPage(container);
    } catch (err) {
      Components.toast('Error: ' + (err.message || 'Failed to save survey'), 'error');
    }
  }

  /* -- Delete confirmation -- */
  function confirmDelete(surveyId) {
    const survey = surveys.find(s => s.id === surveyId);
    const surveyName = survey ? escapeHtml(survey.name) : 'this survey';

    Components.showModal('Delete Survey', `
      <div style="text-align:center; padding:12px 0;">
        <svg style="width:40px; height:40px; color:#ef4444; margin:0 auto 12px;" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
        </svg>
        <p style="font-size:14px; color:#e0e0e0; margin:0 0 4px;">Delete <strong>${surveyName}</strong>?</p>
        <p style="font-size:12px; color:#888;">This will permanently delete the survey and all its responses.</p>
      </div>
    `, [
      { label: 'Delete', onClick: `SurveysPage.executeDelete('${surveyId}')`, danger: true },
    ]);
  }

  async function executeDelete(surveyId) {
    try {
      await deleteSurvey(surveyId);
      Components.closeModal();
      viewingSurveyId = null;
      await fetchSurveys();
      const container = document.getElementById('surveys-page-root');
      if (container) renderPage(container);
    } catch (err) {
      Components.toast('Error: ' + (err.message || 'Failed to delete'), 'error');
    }
  }

  /* ------------------------------------------------------------------
     Response View
  ------------------------------------------------------------------ */
  async function viewResponses(surveyId) {
    viewingSurveyId = surveyId;
    const container = document.getElementById('surveys-page-root');
    if (!container) return;

    container.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:center; padding:48px; color:#888;">
        <div style="text-align:center;">
          <div style="width:32px; height:32px; border:3px solid #4361ee; border-top-color:transparent; border-radius:50%; animation:spin 0.8s linear infinite; margin:0 auto 12px;"></div>
          <div style="font-size:13px;">Loading responses...</div>
        </div>
      </div>`;

    await Promise.all([
      fetchResponses(surveyId, 1),
      fetchStats(surveyId),
    ]);

    renderResponseView(container);
  }

  function renderResponseView(container) {
    const survey = surveys.find(s => s.id === viewingSurveyId);
    if (!survey) {
      container.innerHTML = '<p style="color:#999; text-align:center; padding:20px;">Survey not found.</p>';
      return;
    }

    const ti = typeInfo(survey.type);
    const stats = viewingStats || {};

    // Stats section based on type
    let statsHTML = '';

    if (survey.type === 'nps' && stats.nps_score !== undefined) {
      // NPS gauge and distribution
      const npsColor = stats.nps_score >= 50 ? '#22c55e' : stats.nps_score >= 0 ? '#f59e0b' : '#ef4444';
      statsHTML = `
        <div style="display:grid; grid-template-columns:1fr 2fr; gap:16px; margin-bottom:24px;">
          <!-- NPS Score Gauge -->
          <div style="background:#16213e; border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:24px; text-align:center;">
            <div style="font-size:11px; font-weight:600; color:#888; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:12px;">NPS Score</div>
            <div style="font-size:48px; font-weight:800; color:${npsColor}; line-height:1;">${stats.nps_score}</div>
            <div style="display:flex; justify-content:center; gap:16px; margin-top:16px;">
              <div>
                <div style="font-size:18px; font-weight:700; color:#ef4444;">${stats.detractor_pct || 0}%</div>
                <div style="font-size:10px; color:#888;">Detractors</div>
              </div>
              <div>
                <div style="font-size:18px; font-weight:700; color:#f59e0b;">${stats.passive_pct || 0}%</div>
                <div style="font-size:10px; color:#888;">Passives</div>
              </div>
              <div>
                <div style="font-size:18px; font-weight:700; color:#22c55e;">${stats.promoter_pct || 0}%</div>
                <div style="font-size:10px; color:#888;">Promoters</div>
              </div>
            </div>
          </div>
          <!-- NPS Distribution Chart -->
          <div style="background:#16213e; border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:20px;">
            <div style="font-size:11px; font-weight:600; color:#888; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:12px;">Score Distribution</div>
            <div style="height:200px; position:relative;">
              <canvas id="survey-nps-dist-chart"></canvas>
            </div>
          </div>
        </div>`;
    } else if (survey.type === 'csat' && stats.avg_score !== undefined) {
      const starDisplay = [];
      for (let i = 1; i <= 5; i++) {
        starDisplay.push(`<span style="font-size:24px; color:${i <= Math.round(stats.avg_score) ? '#f59e0b' : '#444'};">&#9733;</span>`);
      }
      statsHTML = `
        <div style="display:grid; grid-template-columns:1fr 2fr; gap:16px; margin-bottom:24px;">
          <div style="background:#16213e; border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:24px; text-align:center;">
            <div style="font-size:11px; font-weight:600; color:#888; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:12px;">Average Rating</div>
            <div style="font-size:42px; font-weight:800; color:#f59e0b; line-height:1;">${stats.avg_score}</div>
            <div style="margin-top:8px;">${starDisplay.join('')}</div>
            <div style="font-size:12px; color:#888; margin-top:8px;">${stats.satisfaction_pct || 0}% satisfied (4-5 stars)</div>
          </div>
          <div style="background:#16213e; border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:20px;">
            <div style="font-size:11px; font-weight:600; color:#888; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:12px;">Star Distribution</div>
            <div style="height:200px; position:relative;">
              <canvas id="survey-csat-dist-chart"></canvas>
            </div>
          </div>
        </div>`;
    } else if (survey.type === 'ces' && stats.avg_score !== undefined) {
      statsHTML = `
        <div style="display:grid; grid-template-columns:1fr 2fr; gap:16px; margin-bottom:24px;">
          <div style="background:#16213e; border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:24px; text-align:center;">
            <div style="font-size:11px; font-weight:600; color:#888; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:12px;">Average Effort Score</div>
            <div style="font-size:42px; font-weight:800; color:#4361ee; line-height:1;">${stats.avg_score}</div>
            <div style="font-size:12px; color:#888; margin-top:8px;">${stats.easy_pct || 0}% found it easy (5-7)</div>
          </div>
          <div style="background:#16213e; border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:20px;">
            <div style="font-size:11px; font-weight:600; color:#888; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:12px;">Score Distribution</div>
            <div style="height:200px; position:relative;">
              <canvas id="survey-ces-dist-chart"></canvas>
            </div>
          </div>
        </div>`;
    }

    // Response count summary
    const totalResp = stats.total_responses || 0;
    const withScore = stats.responses_with_score || 0;
    const withFeedback = stats.responses_with_feedback || 0;

    // Response list
    let responsesTableHTML = '';
    if (viewingResponses.length === 0) {
      responsesTableHTML = `
        <div style="text-align:center; padding:32px 20px;">
          <p style="font-size:13px; color:#888;">No responses yet for this survey.</p>
        </div>`;
    } else {
      const rows = viewingResponses.map(r => {
        const scoreDisplay = r.score != null ? r.score : '--';
        const feedbackText = r.feedback ? escapeHtml(r.feedback.length > 100 ? r.feedback.substring(0, 100) + '...' : r.feedback) : '<span style="color:#555;">--</span>';
        const pageDisplay = r.page_url ? escapeHtml(r.page_url.length > 40 ? r.page_url.substring(0, 40) + '...' : r.page_url) : '--';

        return `
          <tr style="border-top:1px solid rgba(255,255,255,0.04);">
            <td style="padding:10px 14px; font-size:12px; color:#999;">${formatShortDate(r.created_at)}</td>
            <td style="padding:10px 14px; font-size:13px; font-weight:600; color:#e0e0e0; text-align:center;">${scoreDisplay}</td>
            <td style="padding:10px 14px; font-size:12px; color:#ccc; max-width:300px;">${feedbackText}</td>
            <td style="padding:10px 14px; font-size:11px; color:#888; font-family:monospace;">${pageDisplay}</td>
          </tr>`;
      }).join('');

      responsesTableHTML = `
        <div style="overflow-x:auto; border:1px solid rgba(255,255,255,0.06); border-radius:10px;">
          <table style="width:100%; border-collapse:collapse;">
            <thead>
              <tr style="background:rgba(255,255,255,0.03);">
                <th style="padding:10px 14px; text-align:left; font-size:10px; font-weight:600; color:#888; text-transform:uppercase; letter-spacing:0.05em;">Date</th>
                <th style="padding:10px 14px; text-align:center; font-size:10px; font-weight:600; color:#888; text-transform:uppercase; letter-spacing:0.05em;">Score</th>
                <th style="padding:10px 14px; text-align:left; font-size:10px; font-weight:600; color:#888; text-transform:uppercase; letter-spacing:0.05em;">Feedback</th>
                <th style="padding:10px 14px; text-align:left; font-size:10px; font-weight:600; color:#888; text-transform:uppercase; letter-spacing:0.05em;">Page</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;

      // Pagination
      if (viewingPagination && viewingPagination.pages > 1) {
        const pg = viewingPagination;
        responsesTableHTML += `
          <div style="display:flex; align-items:center; justify-content:center; gap:8px; margin-top:16px;">
            <button onclick="SurveysPage.loadResponsesPage(${pg.page - 1})" ${pg.page <= 1 ? 'disabled' : ''}
                    style="padding:5px 12px; border-radius:6px; border:1px solid rgba(255,255,255,0.08); background:transparent; color:${pg.page <= 1 ? '#444' : '#999'}; cursor:${pg.page <= 1 ? 'default' : 'pointer'}; font-size:12px;">Prev</button>
            <span style="font-size:12px; color:#888;">Page ${pg.page} of ${pg.pages}</span>
            <button onclick="SurveysPage.loadResponsesPage(${pg.page + 1})" ${pg.page >= pg.pages ? 'disabled' : ''}
                    style="padding:5px 12px; border-radius:6px; border:1px solid rgba(255,255,255,0.08); background:transparent; color:${pg.page >= pg.pages ? '#444' : '#999'}; cursor:${pg.page >= pg.pages ? 'default' : 'pointer'}; font-size:12px;">Next</button>
          </div>`;
      }
    }

    container.innerHTML = `
      <div id="surveys-page-root">
        <!-- Back button -->
        <div style="margin-bottom:20px;">
          <button onclick="SurveysPage.backToList()"
                  style="display:flex; align-items:center; gap:6px; padding:6px 14px; border-radius:8px; border:1px solid rgba(255,255,255,0.08); background:transparent; color:#999; cursor:pointer; font-size:12px; font-weight:500; transition:all 0.15s;"
                  onmouseenter="this.style.background='rgba(255,255,255,0.05)'" onmouseleave="this.style.background='transparent'">
            <svg style="width:14px; height:14px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"/></svg>
            Back to Surveys
          </button>
        </div>

        <!-- Survey header -->
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:24px;">
          <div>
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:4px;">
              <h2 style="font-size:20px; font-weight:700; color:#e0e0e0; margin:0;">${escapeHtml(survey.name)}</h2>
              <span style="display:inline-block; padding:3px 10px; border-radius:6px; font-size:11px; font-weight:600; background:${ti.color}18; color:${ti.color}; border:1px solid ${ti.color}35;">${ti.label}</span>
            </div>
            <div style="font-size:12px; color:#888;">${App.formatNumber(totalResp)} responses &middot; ${App.formatNumber(withScore)} scored &middot; ${App.formatNumber(withFeedback)} with feedback</div>
          </div>
          <button onclick="SurveysPage.exportResponses('${survey.id}')"
                  style="display:flex; align-items:center; gap:6px; padding:8px 16px; border-radius:8px; border:1px solid rgba(67,97,238,0.25); background:rgba(67,97,238,0.08); color:#4361ee; cursor:pointer; font-size:12px; font-weight:600; transition:all 0.15s;"
                  onmouseenter="this.style.background='rgba(67,97,238,0.15)'" onmouseleave="this.style.background='rgba(67,97,238,0.08)'">
            <svg style="width:14px; height:14px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
            Export CSV
          </button>
        </div>

        <!-- Stats -->
        ${statsHTML}

        <!-- Response list -->
        <div>
          <div style="font-size:11px; font-weight:600; color:#888; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:12px;">Individual Responses</div>
          ${responsesTableHTML}
        </div>
      </div>`;

    // Render distribution charts after DOM is ready
    requestAnimationFrame(() => {
      if (survey.type === 'nps' && stats.distribution) {
        renderNPSDistChart('survey-nps-dist-chart', stats.distribution);
      } else if (survey.type === 'csat' && stats.distribution) {
        renderCSATDistChart('survey-csat-dist-chart', stats.distribution);
      } else if (survey.type === 'ces' && stats.distribution) {
        renderCESDistChart('survey-ces-dist-chart', stats.distribution);
      }
    });
  }

  /* ------------------------------------------------------------------
     Distribution Charts
  ------------------------------------------------------------------ */
  function renderNPSDistChart(canvasId, distribution) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const labels = [];
    const data = [];
    const colors = [];
    for (let i = 0; i <= 10; i++) {
      labels.push(String(i));
      data.push(distribution[i] || 0);
      if (i <= 6) colors.push('rgba(239, 68, 68, 0.7)');
      else if (i <= 8) colors.push('rgba(245, 158, 11, 0.7)');
      else colors.push('rgba(34, 197, 94, 0.7)');
    }

    destroyChart('survey-nps-dist');
    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Responses',
          data,
          backgroundColor: colors,
          borderColor: colors.map(c => c.replace('0.7', '1')),
          borderWidth: 1,
          borderRadius: 4,
        }],
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
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#94a3b8', font: { size: 11 } },
          },
          y: {
            grid: { color: 'rgba(51, 65, 85, 0.3)' },
            ticks: { color: '#64748b', font: { size: 11 }, stepSize: 1 },
            beginAtZero: true,
          },
        },
      },
    });
    App.state.chartInstances['survey-nps-dist'] = chart;
  }

  function renderCSATDistChart(canvasId, distribution) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const labels = [];
    const data = [];
    const colors = ['rgba(239,68,68,0.7)', 'rgba(245,158,11,0.7)', 'rgba(234,179,8,0.7)', 'rgba(34,197,94,0.6)', 'rgba(34,197,94,0.9)'];
    for (let i = 1; i <= 5; i++) {
      labels.push(i + ' star' + (i > 1 ? 's' : ''));
      data.push(distribution[i] || 0);
    }

    destroyChart('survey-csat-dist');
    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Responses',
          data,
          backgroundColor: colors,
          borderColor: colors.map(c => c.replace(/[\d.]+\)$/, '1)')),
          borderWidth: 1,
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: '#1e293b', titleColor: '#e2e8f0', bodyColor: '#94a3b8', borderColor: '#334155', borderWidth: 1 },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 11 } } },
          y: { grid: { color: 'rgba(51,65,85,0.3)' }, ticks: { color: '#64748b', font: { size: 11 }, stepSize: 1 }, beginAtZero: true },
        },
      },
    });
    App.state.chartInstances['survey-csat-dist'] = chart;
  }

  function renderCESDistChart(canvasId, distribution) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const labels = [];
    const data = [];
    const colors = [];
    for (let i = 1; i <= 7; i++) {
      labels.push(String(i));
      data.push(distribution[i] || 0);
      const ratio = (i - 1) / 6;
      colors.push(`rgba(${Math.round(239 - ratio * 205)}, ${Math.round(68 + ratio * 129)}, ${Math.round(68 + ratio * 170)}, 0.7)`);
    }

    destroyChart('survey-ces-dist');
    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Responses',
          data,
          backgroundColor: colors,
          borderColor: colors.map(c => c.replace('0.7', '1')),
          borderWidth: 1,
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: '#1e293b', titleColor: '#e2e8f0', bodyColor: '#94a3b8', borderColor: '#334155', borderWidth: 1 },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 11 } } },
          y: { grid: { color: 'rgba(51,65,85,0.3)' }, ticks: { color: '#64748b', font: { size: 11 }, stepSize: 1 }, beginAtZero: true },
        },
      },
    });
    App.state.chartInstances['survey-ces-dist'] = chart;
  }

  /* ------------------------------------------------------------------
     Export CSV
  ------------------------------------------------------------------ */
  function exportResponses(surveyId) {
    const survey = surveys.find(s => s.id === surveyId);
    if (!survey || viewingResponses.length === 0) {
      Components.toast('No responses to export', 'warning');
      return;
    }

    const headers = ['Date', 'Score', 'Feedback', 'Page URL', 'Session ID', 'Visitor ID'];
    const rows = viewingResponses.map(r => [
      r.created_at || '',
      r.score != null ? r.score : '',
      (r.feedback || '').replace(/"/g, '""'),
      r.page_url || '',
      r.session_id || '',
      r.visitor_id || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => '"' + cell + '"').join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `survey-${survey.name.replace(/\s+/g, '-').toLowerCase()}-responses.csv`;
    link.click();
    URL.revokeObjectURL(url);

    Components.toast('CSV exported successfully', 'success');
  }

  /* ------------------------------------------------------------------
     Pagination handler
  ------------------------------------------------------------------ */
  async function loadResponsesPage(page) {
    if (!viewingSurveyId || page < 1) return;
    if (viewingPagination && page > viewingPagination.pages) return;

    await fetchResponses(viewingSurveyId, page);
    const container = document.getElementById('surveys-page-root');
    if (container) renderResponseView(container);
  }

  /* ------------------------------------------------------------------
     Navigation
  ------------------------------------------------------------------ */
  function backToList() {
    viewingSurveyId = null;
    viewingResponses = [];
    viewingStats = null;
    viewingPagination = null;
    destroyChart('survey-nps-dist');
    destroyChart('survey-csat-dist');
    destroyChart('survey-ces-dist');
    const container = document.getElementById('surveys-page-root');
    if (container) renderPage(container);
  }

  /* ------------------------------------------------------------------
     Main Render
  ------------------------------------------------------------------ */
  async function renderPage(container) {
    container.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:center; padding:48px; color:#888;">
        <div style="text-align:center;">
          <div style="width:32px; height:32px; border:3px solid #4361ee; border-top-color:transparent; border-radius:50%; animation:spin 0.8s linear infinite; margin:0 auto 12px;"></div>
          <div style="font-size:13px;">Loading surveys...</div>
        </div>
      </div>`;

    await fetchSurveys();

    const createBtnHTML = `
      <button onclick="SurveysPage.showCreateModal()"
              style="display:flex; align-items:center; gap:6px; padding:8px 16px; border-radius:8px; border:none; background:#4361ee; color:white; cursor:pointer; font-size:13px; font-weight:600; transition:opacity 0.15s;"
              onmouseenter="this.style.opacity='0.85'" onmouseleave="this.style.opacity='1'">
        <svg style="width:16px; height:16px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
        </svg>
        Create Survey
      </button>`;

    container.innerHTML = `
      <div id="surveys-page-root">
        <!-- Header -->
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:24px;">
          <div>
            <h1 style="font-size:20px; font-weight:700; color:#e0e0e0; margin:0 0 4px;">Surveys & Feedback</h1>
            <p style="font-size:13px; color:#888; margin:0;">Create and manage embeddable surveys to collect user feedback</p>
          </div>
          ${createBtnHTML}
        </div>

        <!-- Summary Cards -->
        ${renderSummaryCards()}

        <!-- Survey List -->
        <div>
          <div style="font-size:11px; font-weight:600; color:#888; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:12px;">Your Surveys</div>
          <div id="surveys-list-container"></div>
        </div>
      </div>`;

    renderSurveyList();
  }

  /* ------------------------------------------------------------------
     Lifecycle
  ------------------------------------------------------------------ */
  async function init(container) {
    await render(container);
  }

  function destroy() {
    viewingSurveyId = null;
    viewingResponses = [];
    viewingStats = null;
    viewingPagination = null;
    editingSurvey = null;
    modalQuestions = [];
    destroyChart('survey-nps-dist');
    destroyChart('survey-csat-dist');
    destroyChart('survey-ces-dist');
  }

  async function render(container) {
    if (viewingSurveyId) {
      await viewResponses(viewingSurveyId);
    } else {
      await renderPage(container);
    }
  }

  /* ------------------------------------------------------------------
     Public API
  ------------------------------------------------------------------ */
  return {
    init,
    destroy,
    render,
    showCreateModal,
    showEditModal,
    confirmSave,
    confirmDelete,
    executeDelete,
    toggleEnabled,
    viewResponses,
    backToList,
    loadResponsesPage,
    exportResponses,
    onTypeChange,
    onTriggerChange,
    addQuestion,
    removeQuestion,
    updateQuestion,
  };

})();

/* Global registration for router compatibility */
function renderSurveysPage(container) {
  SurveysPage.render(container);
}

window.SurveysPage = SurveysPage;
