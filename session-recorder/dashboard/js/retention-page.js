/* ==========================================================================
   retention-page.js  -  Retention & Cohort Analysis Dashboard
   ========================================================================== */

window.RetentionPage = (() => {

  /* ------------------------------------------------------------------
     State
  ------------------------------------------------------------------ */
  let cohortData = null;
  let returningData = null;
  let frequencyData = null;
  let lifetimeData = null;
  let churnData = null;
  let containerEl = null;
  let currentGranularity = 'weekly';
  let canvasInstances = {};

  /* ------------------------------------------------------------------
     Theme constants
  ------------------------------------------------------------------ */
  const COLORS = {
    bg: '#1a1a2e',
    card: '#16213e',
    accent: '#4361ee',
    text: '#e0e0e0',
    textMuted: '#8892b0',
    textDim: '#5a6480',
    border: 'rgba(67, 97, 238, 0.15)',
    borderHover: 'rgba(67, 97, 238, 0.35)',
    retentionHigh: '#00c853',
    retentionMedium: '#ffd600',
    retentionLow: '#ff1744',
    newVisitor: '#4361ee',
    returningVisitor: '#00c853',
    churnAlert: '#ff1744',
  };

  /* ------------------------------------------------------------------
     Mock Data Generators (fallback when API unavailable)
  ------------------------------------------------------------------ */
  function generateMockCohortData() {
    const cohorts = [];
    const now = new Date();
    for (let w = 11; w >= 0; w--) {
      const d = new Date(now);
      d.setDate(d.getDate() - w * 7);
      const day = d.getDay() || 7;
      d.setDate(d.getDate() - day + 1);
      const period = d.toISOString().slice(0, 10);
      const size = Math.floor(60 + Math.random() * 120);
      const retention = [100];
      for (let r = 1; r <= Math.min(11, w); r++) {
        const prev = retention[retention.length - 1];
        retention.push(Math.max(1, Math.round(prev * (0.35 + Math.random() * 0.4))));
      }
      cohorts.push({ period, size, retention });
    }
    const maxLen = Math.max(...cohorts.map(c => c.retention.length));
    const periods = Array.from({ length: maxLen }, (_, i) => `Week ${i}`);
    return { cohorts, periods };
  }

  function generateMockReturningData() {
    const periods = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const newV = Math.floor(20 + Math.random() * 80);
      const retV = Math.floor(10 + Math.random() * 60);
      const total = newV + retV;
      periods.push({
        date: d.toISOString().slice(0, 10),
        new_visitors: newV,
        returning_visitors: retV,
        return_rate: total > 0 ? Math.round((retV / total) * 1000) / 10 : 0,
      });
    }
    return { periods };
  }

  function generateMockFrequencyData() {
    return {
      distribution: [
        { bucket: '1 session', count: Math.floor(300 + Math.random() * 400) },
        { bucket: '2 sessions', count: Math.floor(100 + Math.random() * 200) },
        { bucket: '3-5 sessions', count: Math.floor(60 + Math.random() * 140) },
        { bucket: '6-10 sessions', count: Math.floor(20 + Math.random() * 80) },
        { bucket: '11-20 sessions', count: Math.floor(5 + Math.random() * 30) },
        { bucket: '20+ sessions', count: Math.floor(2 + Math.random() * 15) },
      ],
      avg_sessions_per_visitor: Math.round((1.5 + Math.random() * 3) * 10) / 10,
      median_sessions_per_visitor: 1,
      total_visitors: Math.floor(500 + Math.random() * 800),
      total_sessions: Math.floor(900 + Math.random() * 2000),
    };
  }

  function generateMockLifetimeData() {
    return {
      avg_lifetime_days: Math.round((2 + Math.random() * 25) * 10) / 10,
      avg_sessions: Math.round((1.5 + Math.random() * 6) * 10) / 10,
      avg_pages: Math.round((3 + Math.random() * 12) * 10) / 10,
      median_lifetime_days: Math.round((0.5 + Math.random() * 15) * 10) / 10,
      total_visitors: Math.floor(500 + Math.random() * 800),
    };
  }

  function generateMockChurnData() {
    const periods = [];
    for (let w = 7; w >= 0; w--) {
      const d = new Date(Date.now() - w * 7 * 86400000);
      const day = d.getDay() || 7;
      d.setDate(d.getDate() - day + 1);
      periods.push({
        period: d.toISOString().slice(0, 10),
        count: Math.floor(5 + Math.random() * 40),
      });
    }
    const totalChurned = periods.reduce((s, p) => s + p.count, 0);
    const totalVisitors = Math.floor(totalChurned * (2 + Math.random() * 4));
    return {
      total_churned: totalChurned,
      churn_rate: totalVisitors > 0 ? Math.round((totalChurned / totalVisitors) * 1000) / 10 : 0,
      churned_by_period: periods,
      total_visitors: totalVisitors,
      inactive_days_threshold: 30,
    };
  }

  /* ------------------------------------------------------------------
     Data fetching
  ------------------------------------------------------------------ */
  async function fetchAllData() {
    const { start, end } = App.state.dateRange;
    const project = App.state.project;
    const baseParams = `project_id=${project}&date_from=${start}&date_to=${end}`;

    const fetchers = [
      App.api(`/retention/cohort?${baseParams}&granularity=${currentGranularity}`)
        .then(d => { cohortData = d; }).catch(() => null),
      App.api(`/retention/returning?${baseParams}&granularity=daily`)
        .then(d => { returningData = d; }).catch(() => null),
      App.api(`/retention/frequency?${baseParams}`)
        .then(d => { frequencyData = d; }).catch(() => null),
      App.api(`/retention/lifetime?${baseParams}`)
        .then(d => { lifetimeData = d; }).catch(() => null),
      App.api(`/retention/churn?project_id=${project}&inactive_days=30`)
        .then(d => { churnData = d; }).catch(() => null),
    ];

    await Promise.all(fetchers);

    // Fallback to mock data if APIs fail
    if (!cohortData) cohortData = generateMockCohortData();
    if (!returningData) returningData = generateMockReturningData();
    if (!frequencyData) frequencyData = generateMockFrequencyData();
    if (!lifetimeData) lifetimeData = generateMockLifetimeData();
    if (!churnData) churnData = generateMockChurnData();
  }

  /* ------------------------------------------------------------------
     Canvas rendering utilities
  ------------------------------------------------------------------ */

  /** Destroy a tracked canvas context */
  function destroyCanvas(id) {
    if (canvasInstances[id]) {
      canvasInstances[id] = null;
    }
  }

  /** Get a 2D context for a canvas element, track it */
  function getCtx(canvasId) {
    const el = document.getElementById(canvasId);
    if (!el) return null;
    const ctx = el.getContext('2d');
    canvasInstances[canvasId] = ctx;
    // Set canvas size to match CSS size
    const rect = el.parentElement.getBoundingClientRect();
    el.width = rect.width * (window.devicePixelRatio || 1);
    el.height = rect.height * (window.devicePixelRatio || 1);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    el.style.width = rect.width + 'px';
    el.style.height = rect.height + 'px';
    return { ctx, width: rect.width, height: rect.height };
  }

  /** Draw text helper */
  function drawText(ctx, text, x, y, opts = {}) {
    ctx.font = `${opts.weight || 'normal'} ${opts.size || 12}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = opts.color || COLORS.text;
    ctx.textAlign = opts.align || 'left';
    ctx.textBaseline = opts.baseline || 'middle';
    ctx.fillText(text, x, y);
  }

  /** Draw rounded rect */
  function roundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /* ------------------------------------------------------------------
     Retention cell color based on percentage
  ------------------------------------------------------------------ */
  function retentionCellColor(pct) {
    if (pct >= 80) return 'rgba(0,200,83,0.85)';
    if (pct >= 60) return 'rgba(0,200,83,0.65)';
    if (pct >= 40) return 'rgba(0,200,83,0.45)';
    if (pct >= 25) return 'rgba(255,214,0,0.55)';
    if (pct >= 15) return 'rgba(255,214,0,0.35)';
    if (pct >= 5) return 'rgba(255,23,68,0.35)';
    return 'rgba(90,100,128,0.25)';
  }

  function retentionCellTextColor(pct) {
    if (pct >= 25) return '#ffffff';
    if (pct >= 5) return '#ffcdd2';
    return '#5a6480';
  }

  function retentionCSSClass(pct) {
    if (pct >= 80) return 'ret-cell-highest';
    if (pct >= 60) return 'ret-cell-high';
    if (pct >= 40) return 'ret-cell-mid-high';
    if (pct >= 25) return 'ret-cell-mid';
    if (pct >= 15) return 'ret-cell-mid-low';
    if (pct >= 5) return 'ret-cell-low';
    return 'ret-cell-none';
  }

  /* ------------------------------------------------------------------
     Stat card helper
  ------------------------------------------------------------------ */
  function statCard(label, value, subtitle, iconSvg, accentColor) {
    return `
      <div class="ret-stat-card" style="background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:12px;padding:20px;position:relative;overflow:hidden;transition:border-color 0.2s;"
           onmouseenter="this.style.borderColor='${COLORS.borderHover}'"
           onmouseleave="this.style.borderColor='${COLORS.border}'">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
          <div style="width:36px;height:36px;border-radius:10px;background:${accentColor}22;display:flex;align-items:center;justify-content:center;">
            ${iconSvg}
          </div>
          <span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:${COLORS.textMuted};">${label}</span>
        </div>
        <div style="font-size:28px;font-weight:700;color:${COLORS.text};line-height:1.2;">${value}</div>
        ${subtitle ? `<div style="font-size:12px;color:${COLORS.textDim};margin-top:4px;">${subtitle}</div>` : ''}
      </div>`;
  }

  /* ------------------------------------------------------------------
     Render - Main page layout
  ------------------------------------------------------------------ */
  async function init(container) {
    containerEl = container || document.getElementById('main-content');
    if (!containerEl) return;

    containerEl.innerHTML = Components.loading();
    await fetchAllData();
    renderPage();
  }

  function destroy() {
    // Clean up canvas instances
    Object.keys(canvasInstances).forEach(id => destroyCanvas(id));
    canvasInstances = {};

    // Destroy any Chart.js instances we created
    ['ret-returning-chart', 'ret-frequency-chart', 'ret-churn-chart'].forEach(key => {
      if (App.state.chartInstances[key]) {
        try { App.state.chartInstances[key].destroy(); } catch (_) {}
        delete App.state.chartInstances[key];
      }
    });

    cohortData = null;
    returningData = null;
    frequencyData = null;
    lifetimeData = null;
    churnData = null;
    containerEl = null;
  }

  function renderPage() {
    if (!containerEl) return;

    // Inject scoped styles
    const styleId = 'retention-page-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = buildStyles();
      document.head.appendChild(style);
    }

    containerEl.innerHTML = `
      <div class="ret-page" style="color:${COLORS.text};">
        ${Components.sectionHeader('Retention & Cohort Analysis', 'Understand how visitors return, churn, and engage over time')}

        <!-- Lifetime Metric Cards -->
        <div id="ret-lifetime-cards" class="ret-grid-4" style="margin-bottom:24px;"></div>

        <!-- Cohort Retention Table -->
        <div id="ret-cohort-section" class="ret-card" style="margin-bottom:24px;"></div>

        <!-- Returning vs New + Frequency -->
        <div class="ret-grid-2" style="margin-bottom:24px;">
          <div id="ret-returning-section" class="ret-card"></div>
          <div id="ret-frequency-section" class="ret-card"></div>
        </div>

        <!-- Churn Analysis -->
        <div id="ret-churn-section" class="ret-card"></div>
      </div>`;

    renderLifetimeCards();
    renderCohortTable();
    renderReturningChart();
    renderFrequencyChart();
    renderChurnSection();
  }

  /* ------------------------------------------------------------------
     Styles
  ------------------------------------------------------------------ */
  function buildStyles() {
    return `
      .ret-page { font-family: Inter, system-ui, -apple-system, sans-serif; }
      .ret-card {
        background: ${COLORS.card};
        border: 1px solid ${COLORS.border};
        border-radius: 12px;
        padding: 20px;
        transition: border-color 0.2s;
      }
      .ret-card:hover { border-color: ${COLORS.borderHover}; }
      .ret-grid-4 {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
      }
      .ret-grid-2 {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
      }
      @media (max-width: 1024px) {
        .ret-grid-4 { grid-template-columns: repeat(2, 1fr); }
        .ret-grid-2 { grid-template-columns: 1fr; }
      }
      @media (max-width: 640px) {
        .ret-grid-4 { grid-template-columns: 1fr; }
      }

      .ret-section-title {
        font-size: 14px;
        font-weight: 600;
        color: ${COLORS.text};
        margin-bottom: 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      /* Cohort table */
      .ret-cohort-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 2px;
        font-size: 12px;
      }
      .ret-cohort-table th {
        padding: 8px 6px;
        text-align: center;
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: ${COLORS.textMuted};
        white-space: nowrap;
      }
      .ret-cohort-table th:first-child,
      .ret-cohort-table th:nth-child(2) {
        text-align: left;
      }
      .ret-cohort-table td {
        padding: 0;
        text-align: center;
      }
      .ret-cohort-table td:first-child {
        text-align: left;
        padding: 6px 8px;
        font-weight: 500;
        color: ${COLORS.text};
        white-space: nowrap;
      }
      .ret-cohort-table td:nth-child(2) {
        text-align: left;
        padding: 6px 8px;
        color: ${COLORS.textMuted};
        font-weight: 500;
      }

      .ret-cell {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        min-width: 48px;
        height: 32px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
        cursor: default;
        position: relative;
        transition: transform 0.1s;
      }
      .ret-cell:hover {
        transform: scale(1.08);
        z-index: 2;
      }

      .ret-cell-highest { background: rgba(0,200,83,0.85); color: #fff; }
      .ret-cell-high    { background: rgba(0,200,83,0.65); color: #fff; }
      .ret-cell-mid-high { background: rgba(0,200,83,0.45); color: #fff; }
      .ret-cell-mid     { background: rgba(255,214,0,0.55); color: #fff; }
      .ret-cell-mid-low { background: rgba(255,214,0,0.35); color: #fff; }
      .ret-cell-low     { background: rgba(255,23,68,0.35); color: #ffcdd2; }
      .ret-cell-none    { background: rgba(90,100,128,0.25); color: #5a6480; }
      .ret-cell-empty   { background: transparent; color: transparent; }

      /* Tooltip */
      .ret-tooltip {
        display: none;
        position: absolute;
        bottom: calc(100% + 6px);
        left: 50%;
        transform: translateX(-50%);
        background: #0f1729;
        border: 1px solid ${COLORS.border};
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 11px;
        color: ${COLORS.text};
        white-space: nowrap;
        z-index: 100;
        pointer-events: none;
        box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      }
      .ret-cell:hover .ret-tooltip { display: block; }

      /* Granularity toggle */
      .ret-gran-btn {
        padding: 4px 12px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        border: 1px solid transparent;
        transition: all 0.15s;
        color: ${COLORS.textMuted};
        background: transparent;
      }
      .ret-gran-btn:hover { background: rgba(67,97,238,0.1); }
      .ret-gran-btn.active {
        background: ${COLORS.accent};
        color: #fff;
        border-color: ${COLORS.accent};
      }

      /* Legend */
      .ret-legend {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 12px;
        font-size: 11px;
        color: ${COLORS.textDim};
      }
      .ret-legend-item {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .ret-legend-swatch {
        width: 12px;
        height: 12px;
        border-radius: 3px;
      }

      /* Frequency bars */
      .ret-freq-row {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 10px;
      }
      .ret-freq-label {
        width: 100px;
        font-size: 12px;
        color: ${COLORS.textMuted};
        text-align: right;
        flex-shrink: 0;
      }
      .ret-freq-bar-bg {
        flex: 1;
        height: 28px;
        background: rgba(90,100,128,0.15);
        border-radius: 6px;
        overflow: hidden;
        position: relative;
      }
      .ret-freq-bar-fill {
        height: 100%;
        border-radius: 6px;
        transition: width 0.4s ease;
        display: flex;
        align-items: center;
        padding-left: 8px;
      }
      .ret-freq-bar-value {
        font-size: 11px;
        font-weight: 600;
        color: #fff;
        white-space: nowrap;
      }
      .ret-freq-bar-value-outside {
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 11px;
        font-weight: 500;
        color: ${COLORS.textMuted};
      }

      /* Churn alert */
      .ret-churn-alert {
        background: rgba(255,23,68,0.08);
        border: 1px solid rgba(255,23,68,0.25);
        border-radius: 10px;
        padding: 14px 18px;
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
        font-size: 13px;
        color: #ff8a80;
      }
    `;
  }

  /* ------------------------------------------------------------------
     Lifetime Metric Cards
  ------------------------------------------------------------------ */
  function renderLifetimeCards() {
    const el = document.getElementById('ret-lifetime-cards');
    if (!el || !lifetimeData || !churnData) return;

    const calendarIcon = `<svg width="18" height="18" fill="none" stroke="${COLORS.accent}" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/></svg>`;
    const sessionsIcon = `<svg width="18" height="18" fill="none" stroke="${COLORS.retentionHigh}" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>`;
    const pagesIcon = `<svg width="18" height="18" fill="none" stroke="${COLORS.retentionMedium}" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>`;
    const churnIcon = `<svg width="18" height="18" fill="none" stroke="${COLORS.churnAlert}" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"/></svg>`;

    el.innerHTML =
      statCard('Avg Lifetime', lifetimeData.avg_lifetime_days + ' days', `Median: ${lifetimeData.median_lifetime_days} days`, calendarIcon, COLORS.accent) +
      statCard('Avg Sessions', lifetimeData.avg_sessions, `Per visitor`, sessionsIcon, COLORS.retentionHigh) +
      statCard('Avg Pages', lifetimeData.avg_pages, `Per visitor`, pagesIcon, COLORS.retentionMedium) +
      statCard('Churn Rate', churnData.churn_rate + '%', `${churnData.total_churned} churned of ${churnData.total_visitors}`, churnIcon, COLORS.churnAlert);
  }

  /* ------------------------------------------------------------------
     Cohort Retention Table
  ------------------------------------------------------------------ */
  function renderCohortTable() {
    const el = document.getElementById('ret-cohort-section');
    if (!el || !cohortData) return;

    const cohorts = cohortData.cohorts || [];
    const periodLabels = cohortData.periods || [];

    // Header
    let headerHTML = '<th>Cohort</th><th>Size</th>';
    for (let i = 0; i < periodLabels.length; i++) {
      headerHTML += `<th>${periodLabels[i]}</th>`;
    }

    // Body
    let bodyHTML = '';
    for (const c of cohorts) {
      bodyHTML += '<tr>';
      bodyHTML += `<td>${c.period}</td>`;
      bodyHTML += `<td>${App.formatNumber(c.size)}</td>`;
      for (let i = 0; i < periodLabels.length; i++) {
        if (i < c.retention.length) {
          const pct = c.retention[i];
          const actualCount = Math.round((pct / 100) * c.size);
          bodyHTML += `<td>
            <div class="ret-cell ${retentionCSSClass(pct)}">
              ${pct}%
              <div class="ret-tooltip">
                <div style="font-weight:600;margin-bottom:2px;">${periodLabels[i]}</div>
                <div>${actualCount} of ${c.size} visitors (${pct}%)</div>
                <div style="color:${COLORS.textDim};margin-top:2px;">Cohort: ${c.period}</div>
              </div>
            </div>
          </td>`;
        } else {
          bodyHTML += '<td><div class="ret-cell ret-cell-empty"></div></td>';
        }
      }
      bodyHTML += '</tr>';
    }

    el.innerHTML = `
      <div class="ret-section-title">
        <span>Cohort Retention Table</span>
        <div style="display:flex;gap:4px;">
          <button class="ret-gran-btn ${currentGranularity === 'daily' ? 'active' : ''}" onclick="RetentionPage.setGranularity('daily')">Daily</button>
          <button class="ret-gran-btn ${currentGranularity === 'weekly' ? 'active' : ''}" onclick="RetentionPage.setGranularity('weekly')">Weekly</button>
          <button class="ret-gran-btn ${currentGranularity === 'monthly' ? 'active' : ''}" onclick="RetentionPage.setGranularity('monthly')">Monthly</button>
        </div>
      </div>

      <div class="ret-legend">
        <span style="color:${COLORS.textDim};font-weight:500;">Retention:</span>
        <div class="ret-legend-item"><div class="ret-legend-swatch" style="background:rgba(0,200,83,0.85)"></div>80%+</div>
        <div class="ret-legend-item"><div class="ret-legend-swatch" style="background:rgba(0,200,83,0.65)"></div>60%+</div>
        <div class="ret-legend-item"><div class="ret-legend-swatch" style="background:rgba(0,200,83,0.45)"></div>40%+</div>
        <div class="ret-legend-item"><div class="ret-legend-swatch" style="background:rgba(255,214,0,0.55)"></div>25%+</div>
        <div class="ret-legend-item"><div class="ret-legend-swatch" style="background:rgba(255,214,0,0.35)"></div>15%+</div>
        <div class="ret-legend-item"><div class="ret-legend-swatch" style="background:rgba(255,23,68,0.35)"></div>5%+</div>
        <div class="ret-legend-item"><div class="ret-legend-swatch" style="background:rgba(90,100,128,0.25)"></div>&lt;5%</div>
      </div>

      <div style="overflow-x:auto;margin:0 -4px;padding:0 4px;">
        <table class="ret-cohort-table">
          <thead><tr>${headerHTML}</tr></thead>
          <tbody>${bodyHTML}</tbody>
        </table>
      </div>

      ${cohorts.length === 0 ? `<div style="text-align:center;padding:40px 0;color:${COLORS.textDim};">Not enough data to generate cohort analysis.</div>` : ''}
    `;
  }

  /* ------------------------------------------------------------------
     Returning vs New Chart (stacked bar with return rate line)
  ------------------------------------------------------------------ */
  function renderReturningChart() {
    const el = document.getElementById('ret-returning-section');
    if (!el || !returningData) return;

    const periods = returningData.periods || [];
    const avgReturnRate = periods.length > 0
      ? Math.round(periods.reduce((s, p) => s + p.return_rate, 0) / periods.length * 10) / 10
      : 0;

    el.innerHTML = `
      <div class="ret-section-title">
        <span>New vs Returning Visitors</span>
        <span style="font-size:12px;font-weight:500;color:${COLORS.textMuted};">Avg return rate: <span style="color:${COLORS.returningVisitor};font-weight:700;">${avgReturnRate}%</span></span>
      </div>
      <div style="height:300px;position:relative;"><canvas id="ret-canvas-returning"></canvas></div>
      <div style="display:flex;justify-content:center;gap:20px;margin-top:12px;">
        <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:${COLORS.textMuted};">
          <span style="width:12px;height:12px;border-radius:3px;background:${COLORS.newVisitor};display:inline-block;"></span>
          New Visitors
        </div>
        <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:${COLORS.textMuted};">
          <span style="width:12px;height:12px;border-radius:3px;background:${COLORS.returningVisitor};display:inline-block;"></span>
          Returning Visitors
        </div>
        <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:${COLORS.textMuted};">
          <span style="width:20px;height:2px;background:${COLORS.retentionMedium};display:inline-block;border-radius:1px;"></span>
          Return Rate
        </div>
      </div>
    `;

    renderReturningCanvas();
  }

  function renderReturningCanvas() {
    const canvas = getCtx('ret-canvas-returning');
    if (!canvas || !returningData) return;
    const { ctx, width, height } = canvas;
    const periods = returningData.periods || [];
    if (periods.length === 0) return;

    const padding = { top: 20, right: 50, bottom: 40, left: 50 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // Calculate max for stacked values
    const maxStacked = Math.max(...periods.map(p => p.new_visitors + p.returning_visitors), 1);
    const yScale = chartH / (maxStacked * 1.15);
    const barWidth = Math.max(4, (chartW / periods.length) * 0.65);
    const barGap = (chartW / periods.length) - barWidth;

    // Draw grid lines
    ctx.strokeStyle = 'rgba(90,100,128,0.15)';
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + chartH - (i / gridLines) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      const val = Math.round((i / gridLines) * maxStacked * 1.15);
      drawText(ctx, val, padding.left - 8, y, { size: 10, color: COLORS.textDim, align: 'right' });
    }

    // Draw right axis labels (return rate %)
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + chartH - (i / gridLines) * chartH;
      const val = Math.round((i / gridLines) * 100);
      drawText(ctx, val + '%', width - padding.right + 8, y, { size: 10, color: COLORS.retentionMedium, align: 'left' });
    }

    // Draw stacked bars
    for (let i = 0; i < periods.length; i++) {
      const p = periods[i];
      const x = padding.left + i * (barWidth + barGap) + barGap / 2;
      const baseY = padding.top + chartH;

      // New visitors (bottom)
      const newH = p.new_visitors * yScale;
      const newGrad = ctx.createLinearGradient(x, baseY - newH, x, baseY);
      newGrad.addColorStop(0, COLORS.newVisitor);
      newGrad.addColorStop(1, COLORS.newVisitor + '88');
      ctx.fillStyle = newGrad;
      roundedRect(ctx, x, baseY - newH, barWidth, newH, Math.min(3, barWidth / 4));
      ctx.fill();

      // Returning visitors (top)
      const retH = p.returning_visitors * yScale;
      const retGrad = ctx.createLinearGradient(x, baseY - newH - retH, x, baseY - newH);
      retGrad.addColorStop(0, COLORS.returningVisitor);
      retGrad.addColorStop(1, COLORS.returningVisitor + '88');
      ctx.fillStyle = retGrad;
      roundedRect(ctx, x, baseY - newH - retH, barWidth, retH, Math.min(3, barWidth / 4));
      ctx.fill();

      // X-axis labels (show every Nth depending on count)
      const labelEvery = Math.max(1, Math.floor(periods.length / 10));
      if (i % labelEvery === 0) {
        const dateStr = p.date.length > 7 ? p.date.slice(5) : p.date;
        drawText(ctx, dateStr, x + barWidth / 2, baseY + 16, { size: 10, color: COLORS.textDim, align: 'center' });
      }
    }

    // Draw return rate line
    ctx.beginPath();
    ctx.strokeStyle = COLORS.retentionMedium;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const rateScale = chartH / 100;
    for (let i = 0; i < periods.length; i++) {
      const p = periods[i];
      const x = padding.left + i * (barWidth + barGap) + barGap / 2 + barWidth / 2;
      const y = padding.top + chartH - p.return_rate * rateScale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw dots on the line
    for (let i = 0; i < periods.length; i++) {
      const p = periods[i];
      const x = padding.left + i * (barWidth + barGap) + barGap / 2 + barWidth / 2;
      const y = padding.top + chartH - p.return_rate * rateScale;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.retentionMedium;
      ctx.fill();
      ctx.strokeStyle = COLORS.card;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  /* ------------------------------------------------------------------
     Session Frequency Distribution (horizontal bar chart)
  ------------------------------------------------------------------ */
  function renderFrequencyChart() {
    const el = document.getElementById('ret-frequency-section');
    if (!el || !frequencyData) return;

    const dist = frequencyData.distribution || [];
    const maxCount = Math.max(...dist.map(d => d.count), 1);

    let barsHTML = '';
    const barColors = [COLORS.accent, '#5e72e4', '#7c3aed', '#a855f7', '#d946ef', '#ec4899'];

    for (let i = 0; i < dist.length; i++) {
      const d = dist[i];
      const pct = Math.round((d.count / maxCount) * 100);
      const color = barColors[i % barColors.length];
      const showInside = pct > 15;

      barsHTML += `
        <div class="ret-freq-row">
          <div class="ret-freq-label">${d.bucket}</div>
          <div class="ret-freq-bar-bg">
            <div class="ret-freq-bar-fill" style="width:${Math.max(2, pct)}%;background:${color};">
              ${showInside ? `<span class="ret-freq-bar-value">${App.formatNumber(d.count)}</span>` : ''}
            </div>
            ${!showInside ? `<span class="ret-freq-bar-value-outside">${App.formatNumber(d.count)}</span>` : ''}
          </div>
        </div>`;
    }

    el.innerHTML = `
      <div class="ret-section-title">
        <span>Session Frequency</span>
      </div>
      ${barsHTML}
      <div style="display:flex;gap:24px;margin-top:16px;padding-top:14px;border-top:1px solid ${COLORS.border};">
        <div>
          <div style="font-size:11px;color:${COLORS.textDim};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px;">Average</div>
          <div style="font-size:20px;font-weight:700;color:${COLORS.text};">${frequencyData.avg_sessions_per_visitor}</div>
          <div style="font-size:11px;color:${COLORS.textDim};">sessions/visitor</div>
        </div>
        <div>
          <div style="font-size:11px;color:${COLORS.textDim};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px;">Median</div>
          <div style="font-size:20px;font-weight:700;color:${COLORS.text};">${frequencyData.median_sessions_per_visitor || 1}</div>
          <div style="font-size:11px;color:${COLORS.textDim};">sessions/visitor</div>
        </div>
        <div>
          <div style="font-size:11px;color:${COLORS.textDim};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px;">Total Visitors</div>
          <div style="font-size:20px;font-weight:700;color:${COLORS.text};">${App.formatNumber(frequencyData.total_visitors || 0)}</div>
        </div>
      </div>
    `;
  }

  /* ------------------------------------------------------------------
     Churn Analysis
  ------------------------------------------------------------------ */
  function renderChurnSection() {
    const el = document.getElementById('ret-churn-section');
    if (!el || !churnData) return;

    const periods = churnData.churned_by_period || [];
    const isHighChurn = churnData.churn_rate > 50;

    let alertHTML = '';
    if (isHighChurn) {
      alertHTML = `
        <div class="ret-churn-alert">
          <svg width="20" height="20" fill="none" stroke="${COLORS.churnAlert}" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
          <div>
            <strong>High churn detected.</strong> ${churnData.churn_rate}% of visitors have not returned in ${churnData.inactive_days_threshold || 30} days.
            Consider re-engagement campaigns or investigating UX issues.
          </div>
        </div>`;
    }

    // Build churn timeline with canvas
    el.innerHTML = `
      <div class="ret-section-title">
        <span>Churn Analysis</span>
        <span style="font-size:12px;color:${COLORS.textMuted};">Inactive threshold: <strong style="color:${COLORS.text};">${churnData.inactive_days_threshold || 30} days</strong></span>
      </div>

      ${alertHTML}

      <div class="ret-grid-2" style="margin-bottom:16px;gap:12px;">
        <div style="background:rgba(90,100,128,0.08);border-radius:10px;padding:16px;">
          <div style="font-size:11px;color:${COLORS.textDim};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Total Churned</div>
          <div style="font-size:28px;font-weight:700;color:${COLORS.churnAlert};">${App.formatNumber(churnData.total_churned)}</div>
          <div style="font-size:12px;color:${COLORS.textDim};">of ${App.formatNumber(churnData.total_visitors)} total visitors</div>
        </div>
        <div style="background:rgba(90,100,128,0.08);border-radius:10px;padding:16px;">
          <div style="font-size:11px;color:${COLORS.textDim};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Churn Rate</div>
          <div style="font-size:28px;font-weight:700;color:${churnData.churn_rate > 50 ? COLORS.churnAlert : churnData.churn_rate > 25 ? COLORS.retentionMedium : COLORS.retentionHigh};">${churnData.churn_rate}%</div>
          <div style="font-size:12px;color:${COLORS.textDim};">last ${churnData.inactive_days_threshold || 30} day threshold</div>
        </div>
      </div>

      <div style="margin-top:16px;">
        <div style="font-size:12px;font-weight:600;color:${COLORS.textMuted};margin-bottom:12px;">Churned Visitors by Period</div>
        <div style="height:220px;position:relative;"><canvas id="ret-canvas-churn"></canvas></div>
      </div>
    `;

    renderChurnCanvas();
  }

  function renderChurnCanvas() {
    const canvas = getCtx('ret-canvas-churn');
    if (!canvas || !churnData) return;
    const { ctx, width, height } = canvas;
    const periods = churnData.churned_by_period || [];
    if (periods.length === 0) return;

    const padding = { top: 10, right: 20, bottom: 35, left: 45 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const maxVal = Math.max(...periods.map(p => p.count), 1);
    const barWidth = Math.max(8, (chartW / periods.length) * 0.6);
    const barGap = (chartW / periods.length) - barWidth;

    // Grid
    ctx.strokeStyle = 'rgba(90,100,128,0.12)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + chartH - (i / 4) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      drawText(ctx, Math.round((i / 4) * maxVal * 1.1), padding.left - 8, y, { size: 10, color: COLORS.textDim, align: 'right' });
    }

    const yScale = chartH / (maxVal * 1.1);

    for (let i = 0; i < periods.length; i++) {
      const p = periods[i];
      const x = padding.left + i * (barWidth + barGap) + barGap / 2;
      const barH = p.count * yScale;
      const baseY = padding.top + chartH;

      const grad = ctx.createLinearGradient(x, baseY - barH, x, baseY);
      grad.addColorStop(0, COLORS.churnAlert);
      grad.addColorStop(1, COLORS.churnAlert + '55');
      ctx.fillStyle = grad;
      roundedRect(ctx, x, baseY - barH, barWidth, barH, Math.min(4, barWidth / 3));
      ctx.fill();

      // Value on top
      if (barH > 16) {
        drawText(ctx, p.count, x + barWidth / 2, baseY - barH - 8, { size: 10, color: COLORS.churnAlert, align: 'center', weight: '600' });
      }

      // Label
      const label = p.period.length > 7 ? p.period.slice(5) : p.period;
      drawText(ctx, label, x + barWidth / 2, baseY + 14, { size: 10, color: COLORS.textDim, align: 'center' });
    }
  }

  /* ------------------------------------------------------------------
     Granularity change (re-fetches cohort data)
  ------------------------------------------------------------------ */
  async function setGranularity(gran) {
    if (gran === currentGranularity) return;
    currentGranularity = gran;

    // Show loading in cohort section
    const cohortEl = document.getElementById('ret-cohort-section');
    if (cohortEl) cohortEl.innerHTML = Components.loading();

    try {
      const { start, end } = App.state.dateRange;
      const project = App.state.project;
      cohortData = await App.api(`/retention/cohort?project_id=${project}&date_from=${start}&date_to=${end}&granularity=${gran}`);
    } catch (_) {
      cohortData = generateMockCohortData();
    }

    renderCohortTable();
  }

  /* ------------------------------------------------------------------
     Public API
  ------------------------------------------------------------------ */
  return {
    init,
    destroy,
    setGranularity,
  };

})();

/* Global render function for route registration */
function renderRetentionPage(container) {
  window.RetentionPage.init(container);
}
