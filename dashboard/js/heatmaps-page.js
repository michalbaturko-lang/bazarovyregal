/* ==========================================================================
   heatmaps-page.js  -  Heatmap visualization with Click, Scroll & Move modes
   ========================================================================== */

const HeatmapsPage = (() => {

  /* ------------------------------------------------------------------
     State
  ------------------------------------------------------------------ */
  let currentUrl = '';
  let currentMode = 'click'; // 'click' | 'scroll' | 'move'
  let pages = [];
  let clickData = null;
  let scrollData = null;
  let moveData = null;
  let renderer = null;
  let containerEl = null;

  /* ------------------------------------------------------------------
     HeatmapRenderer - Canvas-based heatmap rendering engine
  ------------------------------------------------------------------ */
  class HeatmapRenderer {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.radius = options.radius || 30;
      this.maxOpacity = options.maxOpacity || 0.8;
      this.blur = options.blur || 15;
      this.points = [];
      this.max = 1;
      this._tooltipActive = false;
    }

    resize(width, height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    setData(points) {
      this.points = points || [];
      this.max = this.points.length > 0
        ? Math.max(...this.points.map(p => p.count || p.intensity || 1))
        : 1;
      this.render();
    }

    clear() {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    render() {
      this.clear();
      if (this.points.length === 0) return;

      // Draw intensity map in grayscale using alpha channel
      for (const point of this.points) {
        const intensity = (point.count || point.intensity || 1) / this.max;
        this._drawPoint(point.x, point.y, intensity);
      }

      // Colorize the grayscale intensity map
      this._colorize();
    }

    _drawPoint(x, y, intensity) {
      const ctx = this.ctx;
      const radius = this.radius;

      // Create radial gradient centered at the point
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      const alpha = Math.min(1, intensity);

      gradient.addColorStop(0, `rgba(0, 0, 0, ${alpha})`);
      gradient.addColorStop(0.4, `rgba(0, 0, 0, ${alpha * 0.6})`);
      gradient.addColorStop(0.7, `rgba(0, 0, 0, ${alpha * 0.2})`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    _colorize() {
      const ctx = this.ctx;
      const w = this.canvas.width;
      const h = this.canvas.height;

      if (w === 0 || h === 0) return;

      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3];
        if (alpha > 0) {
          const normalizedAlpha = Math.min(alpha / 255, 1);
          const [r, g, b] = this._getColor(normalizedAlpha);
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
          data[i + 3] = Math.min(Math.round(normalizedAlpha * 2 * this.maxOpacity * 255), 220);
        }
      }

      ctx.globalCompositeOperation = 'source-over';
      ctx.putImageData(imageData, 0, 0);
    }

    // Heatmap gradient: blue -> cyan -> green -> yellow -> red
    _getColor(value) {
      const v = Math.max(0, Math.min(1, value));
      let r, g, b;

      if (v < 0.15) {
        // Dark blue to blue
        const t = v / 0.15;
        r = 0;
        g = 0;
        b = Math.round(80 + t * 175);
      } else if (v < 0.35) {
        // Blue to cyan
        const t = (v - 0.15) / 0.2;
        r = 0;
        g = Math.round(t * 255);
        b = 255;
      } else if (v < 0.55) {
        // Cyan to green
        const t = (v - 0.35) / 0.2;
        r = 0;
        g = 255;
        b = Math.round(255 * (1 - t));
      } else if (v < 0.75) {
        // Green to yellow
        const t = (v - 0.55) / 0.2;
        r = Math.round(255 * t);
        g = 255;
        b = 0;
      } else {
        // Yellow to red
        const t = (v - 0.75) / 0.25;
        r = 255;
        g = Math.round(255 * (1 - t));
        b = 0;
      }

      return [r, g, b];
    }

    // Get intensity at a specific point (for tooltips)
    getIntensityAt(x, y) {
      if (this.canvas.width === 0 || this.canvas.height === 0) return 0;
      const pixel = this.ctx.getImageData(x, y, 1, 1).data;
      return pixel[3] / 255;
    }

    // Find nearest data point within radius
    findNearestPoint(x, y, searchRadius) {
      searchRadius = searchRadius || this.radius;
      let nearest = null;
      let nearestDist = Infinity;

      for (const p of this.points) {
        const dx = p.x - x;
        const dy = p.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < searchRadius && dist < nearestDist) {
          nearest = p;
          nearestDist = dist;
        }
      }
      return nearest;
    }
  }

  /* ------------------------------------------------------------------
     Mock data generators (fallback when API unavailable)
  ------------------------------------------------------------------ */
  function mockPages() {
    return [
      { url: '/', clicks: 1842 },
      { url: '/pricing', clicks: 967 },
      { url: '/features', clicks: 723 },
      { url: '/docs', clicks: 589 },
      { url: '/blog', clicks: 412 },
      { url: '/about', clicks: 287 },
      { url: '/contact', clicks: 156 },
      { url: '/signup', clicks: 1203 },
    ];
  }

  function mockClickData(url) {
    const points = [];
    const hotspots = [
      { cx: 400, cy: 80, spread: 60, weight: 40 },   // Navigation area
      { cx: 700, cy: 350, spread: 80, weight: 60 },   // CTA button
      { cx: 200, cy: 500, spread: 50, weight: 25 },   // Sidebar
      { cx: 900, cy: 200, spread: 70, weight: 35 },   // Feature card
      { cx: 500, cy: 700, spread: 90, weight: 45 },   // Content area
      { cx: 300, cy: 150, spread: 40, weight: 30 },    // Logo area
      { cx: 800, cy: 550, spread: 60, weight: 20 },   // Footer area
      { cx: 600, cy: 120, spread: 100, weight: 50 },  // Menu bar
    ];

    for (const spot of hotspots) {
      const count = Math.floor(Math.random() * spot.weight) + 10;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * spot.spread;
        const x = Math.round((spot.cx + Math.cos(angle) * dist) / 10) * 10;
        const y = Math.round((spot.cy + Math.sin(angle) * dist) / 10) * 10;
        const existing = points.find(p => p.x === x && p.y === y);
        if (existing) {
          existing.count++;
        } else {
          points.push({ x, y, count: Math.floor(Math.random() * 5) + 1 });
        }
      }
    }

    return {
      url,
      total_clicks: points.reduce((s, p) => s + p.count, 0),
      points,
      viewport: { width: 1280, height: 900 },
    };
  }

  function mockScrollData(url) {
    const depths = [];
    let pct = 100;
    for (let y = 0; y <= 4000; y += 100) {
      const drop = y === 0 ? 0 : (Math.random() * 8 + 2);
      pct = Math.max(0, pct - drop);
      depths.push({
        y,
        sessions: Math.round(pct * 3.2),
        percentage: Math.round(pct * 10) / 10,
      });
      if (pct <= 0) break;
    }
    return {
      url,
      total_sessions: 320,
      depths,
    };
  }

  function mockMoveData(url) {
    const points = [];
    // Generate move heatmap along common cursor paths
    const paths = [
      { x1: 100, y1: 50, x2: 900, y2: 50, weight: 0.8 },  // Top nav
      { x1: 500, y1: 100, x2: 700, y2: 400, weight: 0.6 },  // Reading path
      { x1: 200, y1: 200, x2: 200, y2: 800, weight: 0.4 },  // Left column
      { x1: 600, y1: 300, x2: 800, y2: 350, weight: 0.9 },  // CTA hover
    ];

    for (const path of paths) {
      const steps = 30 + Math.floor(Math.random() * 20);
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const x = Math.round((path.x1 + (path.x2 - path.x1) * t + (Math.random() - 0.5) * 40) / 20) * 20;
        const y = Math.round((path.y1 + (path.y2 - path.y1) * t + (Math.random() - 0.5) * 40) / 20) * 20;
        const existing = points.find(p => p.x === x && p.y === y);
        if (existing) {
          existing.count++;
          existing.intensity = Math.min(1, existing.intensity + 0.1);
        } else {
          points.push({ x, y, intensity: path.weight * Math.random(), count: 1 });
        }
      }
    }

    return {
      url,
      total_moves: points.reduce((s, p) => s + p.count, 0),
      points,
    };
  }

  /* ------------------------------------------------------------------
     Data fetching
  ------------------------------------------------------------------ */
  async function fetchPages() {
    try {
      const projectId = App.state.project || 'default';
      const data = await App.api(`/heatmaps/pages?project_id=${encodeURIComponent(projectId)}`);
      pages = data.pages || [];
    } catch (_) {
      pages = mockPages();
    }
  }

  async function fetchClickData(url) {
    try {
      const params = new URLSearchParams({
        url,
        date_from: App.state.dateRange.start,
        date_to: App.state.dateRange.end,
        project_id: App.state.project,
      });
      clickData = await App.api(`/heatmaps/clicks?${params}`);
    } catch (_) {
      clickData = mockClickData(url);
    }
  }

  async function fetchScrollData(url) {
    try {
      const params = new URLSearchParams({
        url,
        date_from: App.state.dateRange.start,
        date_to: App.state.dateRange.end,
        project_id: App.state.project,
      });
      scrollData = await App.api(`/heatmaps/scroll?${params}`);
    } catch (_) {
      scrollData = mockScrollData(url);
    }
  }

  async function fetchMoveData(url) {
    try {
      const params = new URLSearchParams({
        url,
        date_from: App.state.dateRange.start,
        date_to: App.state.dateRange.end,
        project_id: App.state.project,
      });
      moveData = await App.api(`/heatmaps/moves?${params}`);
    } catch (_) {
      moveData = mockMoveData(url);
    }
  }

  /* ------------------------------------------------------------------
     Render: Main page
  ------------------------------------------------------------------ */
  async function render(container) {
    containerEl = container;
    container.innerHTML = Components.loading();

    await fetchPages();

    // Default to first page if available
    if (pages.length > 0 && !currentUrl) {
      currentUrl = pages[0].url;
    }

    renderPage();

    // Load initial data
    if (currentUrl) {
      await loadHeatmapData();
    }
  }

  function renderPage() {
    if (!containerEl) return;

    const pageOptions = pages.map(p =>
      `<option value="${escapeAttr(p.url)}" ${p.url === currentUrl ? 'selected' : ''}>${escapeHtml(p.url)} (${App.formatNumber(p.clicks)} clicks)</option>`
    ).join('');

    const modeButtons = [
      { id: 'click', label: 'Click Map', icon: clickIcon() },
      { id: 'scroll', label: 'Scroll Map', icon: scrollIcon() },
      { id: 'move', label: 'Move Map', icon: moveIcon() },
    ].map(m => {
      const active = m.id === currentMode;
      const cls = active
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
        : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200';
      return `<button onclick="HeatmapsPage.setMode('${m.id}')" class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${cls}">
        ${m.icon}
        <span>${m.label}</span>
      </button>`;
    }).join('');

    containerEl.innerHTML = `
      <div class="max-w-full">
        <!-- Header -->
        ${Components.sectionHeader('Heatmaps', 'Visualize user interactions on your pages')}

        <!-- Controls bar -->
        <div class="flex flex-wrap items-center gap-4 mb-6">
          <!-- Page selector -->
          <div class="flex items-center gap-2">
            <label class="text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap">Page URL</label>
            <select id="heatmap-url-select"
                    onchange="HeatmapsPage.onUrlChange(this.value)"
                    class="bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-colors min-w-[240px]">
              ${pages.length === 0 ? '<option value="">No pages recorded yet</option>' : ''}
              ${pageOptions}
            </select>
          </div>

          <!-- Mode tabs -->
          <div class="flex items-center gap-1 bg-slate-800 rounded-xl p-1 border border-slate-700/50">
            ${modeButtons}
          </div>

          <!-- Refresh -->
          <button onclick="HeatmapsPage.refresh()"
                  class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 bg-slate-700/50 border border-slate-600/50 hover:bg-slate-700 hover:text-white transition-colors ml-auto">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.182-3.182"/>
            </svg>
            Refresh
          </button>
        </div>

        <!-- Main content: heatmap + sidebar -->
        <div class="flex gap-6">
          <!-- Heatmap viewport -->
          <div class="flex-1 min-w-0">
            <div id="heatmap-viewport" class="relative bg-slate-800 rounded-xl border border-slate-700/50 overflow-hidden" style="min-height: 600px;">
              <!-- Heatmap canvas layers go here -->
              <div id="heatmap-canvas-wrapper" class="relative w-full" style="height: 600px;">
                <!-- Page background simulation -->
                <div id="heatmap-page-bg" class="absolute inset-0 bg-white rounded-t-xl overflow-hidden">
                  <div id="heatmap-page-placeholder" class="w-full h-full flex flex-col">
                    <!-- Simulated page content -->
                  </div>
                </div>

                <!-- Scroll overlay (for scroll mode) -->
                <div id="heatmap-scroll-overlay" class="absolute inset-0 pointer-events-none" style="display: none;"></div>

                <!-- Canvas overlay -->
                <canvas id="heatmap-canvas" class="absolute inset-0 pointer-events-none" style="z-index: 10;"></canvas>

                <!-- Tooltip -->
                <div id="heatmap-tooltip" class="absolute z-20 hidden pointer-events-none">
                  <div class="bg-slate-900/95 backdrop-blur-sm border border-slate-700/80 rounded-lg px-3 py-2 shadow-xl">
                    <div id="heatmap-tooltip-text" class="text-xs text-white font-medium whitespace-nowrap"></div>
                  </div>
                </div>

                <!-- Loading indicator -->
                <div id="heatmap-loading" class="absolute inset-0 flex items-center justify-center bg-slate-800/80 z-30" style="display: none;">
                  <div class="flex flex-col items-center gap-3">
                    <div class="relative w-8 h-8">
                      <div class="absolute inset-0 rounded-full border-2 border-slate-700"></div>
                      <div class="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500 animate-spin"></div>
                    </div>
                    <span class="text-sm text-slate-400">Loading heatmap...</span>
                  </div>
                </div>
              </div>

              <!-- Legend -->
              <div id="heatmap-legend" class="flex items-center justify-between px-4 py-3 bg-slate-900/60 border-t border-slate-700/50">
                <div class="flex items-center gap-3">
                  <span class="text-xs text-slate-500 uppercase tracking-wider font-medium">Intensity</span>
                  <div class="flex items-center gap-1">
                    <span class="text-[10px] text-slate-500">Low</span>
                    <div class="w-32 h-2.5 rounded-full" style="background: linear-gradient(to right, rgba(0,0,200,0.7), rgba(0,200,255,0.7), rgba(0,255,0,0.7), rgba(255,255,0,0.7), rgba(255,0,0,0.7));"></div>
                    <span class="text-[10px] text-slate-500">High</span>
                  </div>
                </div>
                <div id="heatmap-legend-info" class="text-xs text-slate-500"></div>
              </div>
            </div>
          </div>

          <!-- Sidebar stats -->
          <div class="w-72 flex-shrink-0 space-y-4">
            <div id="heatmap-stats" class="space-y-4">
              <!-- Stats cards rendered here -->
            </div>

            <!-- Top positions list -->
            <div id="heatmap-top-positions" class="bg-slate-800 rounded-xl border border-slate-700/50 overflow-hidden">
              <!-- Rendered by updateStats -->
            </div>
          </div>
        </div>
      </div>
    `;

    // Render the simulated page background
    renderPageBackground();

    // Set up mouse tracking for tooltips
    setupTooltip();
  }

  /* ------------------------------------------------------------------
     Simulated page background
  ------------------------------------------------------------------ */
  function renderPageBackground() {
    const placeholder = document.getElementById('heatmap-page-placeholder');
    if (!placeholder) return;

    placeholder.innerHTML = `
      <!-- Simulated header -->
      <div class="flex items-center justify-between px-6 py-3 bg-gray-50 border-b border-gray-200">
        <div class="flex items-center gap-4">
          <div class="w-8 h-8 bg-blue-500 rounded-lg"></div>
          <div class="w-24 h-3 bg-gray-200 rounded"></div>
        </div>
        <div class="flex items-center gap-6">
          <div class="w-16 h-2.5 bg-gray-200 rounded"></div>
          <div class="w-16 h-2.5 bg-gray-200 rounded"></div>
          <div class="w-16 h-2.5 bg-gray-200 rounded"></div>
          <div class="w-16 h-2.5 bg-gray-200 rounded"></div>
          <div class="w-20 h-8 bg-blue-500 rounded-lg"></div>
        </div>
      </div>

      <!-- Hero section -->
      <div class="px-16 py-12 text-center">
        <div class="w-3/5 h-5 bg-gray-300 rounded mx-auto mb-4"></div>
        <div class="w-2/5 h-5 bg-gray-300 rounded mx-auto mb-6"></div>
        <div class="w-4/5 h-3 bg-gray-100 rounded mx-auto mb-2"></div>
        <div class="w-3/5 h-3 bg-gray-100 rounded mx-auto mb-8"></div>
        <div class="flex justify-center gap-3">
          <div class="w-32 h-10 bg-blue-500 rounded-lg"></div>
          <div class="w-32 h-10 bg-gray-200 rounded-lg border border-gray-300"></div>
        </div>
      </div>

      <!-- Feature cards -->
      <div class="px-12 py-8 bg-gray-50">
        <div class="grid grid-cols-3 gap-6">
          ${[1,2,3].map(() => `
            <div class="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div class="w-10 h-10 bg-blue-100 rounded-lg mb-4"></div>
              <div class="w-3/4 h-3.5 bg-gray-200 rounded mb-3"></div>
              <div class="w-full h-2 bg-gray-100 rounded mb-1.5"></div>
              <div class="w-5/6 h-2 bg-gray-100 rounded mb-1.5"></div>
              <div class="w-2/3 h-2 bg-gray-100 rounded"></div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Content section -->
      <div class="px-12 py-8">
        <div class="flex gap-8">
          <div class="flex-1">
            <div class="w-2/3 h-4 bg-gray-300 rounded mb-4"></div>
            <div class="w-full h-2 bg-gray-100 rounded mb-2"></div>
            <div class="w-full h-2 bg-gray-100 rounded mb-2"></div>
            <div class="w-5/6 h-2 bg-gray-100 rounded mb-2"></div>
            <div class="w-full h-2 bg-gray-100 rounded mb-2"></div>
            <div class="w-3/4 h-2 bg-gray-100 rounded mb-6"></div>
            <div class="w-full h-2 bg-gray-100 rounded mb-2"></div>
            <div class="w-full h-2 bg-gray-100 rounded mb-2"></div>
            <div class="w-2/3 h-2 bg-gray-100 rounded"></div>
          </div>
          <div class="w-64 flex-shrink-0">
            <div class="bg-gray-50 rounded-xl border border-gray-200 p-4">
              <div class="w-full h-32 bg-gray-200 rounded-lg mb-3"></div>
              <div class="w-3/4 h-3 bg-gray-200 rounded mb-2"></div>
              <div class="w-full h-2 bg-gray-100 rounded mb-1"></div>
              <div class="w-5/6 h-2 bg-gray-100 rounded"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="mt-auto px-12 py-6 bg-gray-800">
        <div class="flex justify-between">
          <div class="space-y-2">
            <div class="w-20 h-3 bg-gray-600 rounded"></div>
            <div class="w-16 h-2 bg-gray-700 rounded"></div>
            <div class="w-16 h-2 bg-gray-700 rounded"></div>
          </div>
          <div class="space-y-2">
            <div class="w-20 h-3 bg-gray-600 rounded"></div>
            <div class="w-16 h-2 bg-gray-700 rounded"></div>
            <div class="w-16 h-2 bg-gray-700 rounded"></div>
          </div>
          <div class="space-y-2">
            <div class="w-20 h-3 bg-gray-600 rounded"></div>
            <div class="w-16 h-2 bg-gray-700 rounded"></div>
            <div class="w-16 h-2 bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    `;
  }

  /* ------------------------------------------------------------------
     Tooltip setup
  ------------------------------------------------------------------ */
  function setupTooltip() {
    const wrapper = document.getElementById('heatmap-canvas-wrapper');
    const tooltip = document.getElementById('heatmap-tooltip');
    const tooltipText = document.getElementById('heatmap-tooltip-text');
    if (!wrapper || !tooltip || !tooltipText) return;

    wrapper.addEventListener('mousemove', (e) => {
      if (!renderer || currentMode === 'scroll') return;

      const rect = wrapper.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const point = renderer.findNearestPoint(x, y, renderer.radius * 1.5);
      if (point) {
        const count = point.count || 0;
        const label = currentMode === 'click' ? 'clicks' : 'movements';
        tooltipText.textContent = `${count} ${label} at (${point.x}, ${point.y})`;

        // Position tooltip
        let tx = e.clientX - rect.left + 12;
        let ty = e.clientY - rect.top - 30;
        if (tx + 180 > rect.width) tx = e.clientX - rect.left - 180;
        if (ty < 0) ty = e.clientY - rect.top + 20;

        tooltip.style.left = tx + 'px';
        tooltip.style.top = ty + 'px';
        tooltip.classList.remove('hidden');
      } else {
        tooltip.classList.add('hidden');
      }
    });

    wrapper.addEventListener('mouseleave', () => {
      if (tooltip) tooltip.classList.add('hidden');
    });
  }

  /* ------------------------------------------------------------------
     Load heatmap data and render
  ------------------------------------------------------------------ */
  async function loadHeatmapData() {
    showLoading(true);

    try {
      switch (currentMode) {
        case 'click':
          await fetchClickData(currentUrl);
          renderClickHeatmap();
          break;
        case 'scroll':
          await fetchScrollData(currentUrl);
          renderScrollHeatmap();
          break;
        case 'move':
          await fetchMoveData(currentUrl);
          renderMoveHeatmap();
          break;
      }
      updateStats();
    } catch (err) {
      console.error('Failed to load heatmap data:', err);
    }

    showLoading(false);
  }

  /* ------------------------------------------------------------------
     Render: Click heatmap
  ------------------------------------------------------------------ */
  function renderClickHeatmap() {
    const canvas = document.getElementById('heatmap-canvas');
    const scrollOverlay = document.getElementById('heatmap-scroll-overlay');
    if (!canvas) return;

    if (scrollOverlay) scrollOverlay.style.display = 'none';
    canvas.style.display = 'block';
    canvas.style.pointerEvents = 'none';

    const wrapper = document.getElementById('heatmap-canvas-wrapper');
    if (!wrapper) return;

    const w = wrapper.offsetWidth;
    const h = wrapper.offsetHeight;

    canvas.width = w;
    canvas.height = h;

    renderer = new HeatmapRenderer(canvas, {
      radius: 30,
      maxOpacity: 0.8,
    });

    if (clickData && clickData.points && clickData.points.length > 0) {
      // Scale points to fit canvas
      const vw = clickData.viewport ? clickData.viewport.width : 1280;
      const vh = clickData.viewport ? clickData.viewport.height : 900;
      const scaleX = w / vw;
      const scaleY = h / vh;

      const scaledPoints = clickData.points.map(p => ({
        x: Math.round(p.x * scaleX),
        y: Math.round(p.y * scaleY),
        count: p.count,
      }));

      renderer.setData(scaledPoints);
    } else {
      renderer.clear();
    }

    // Update legend info
    const legendInfo = document.getElementById('heatmap-legend-info');
    if (legendInfo) {
      legendInfo.textContent = clickData
        ? `${App.formatNumber(clickData.total_clicks)} total clicks`
        : 'No click data';
    }
  }

  /* ------------------------------------------------------------------
     Render: Scroll heatmap
  ------------------------------------------------------------------ */
  function renderScrollHeatmap() {
    const canvas = document.getElementById('heatmap-canvas');
    const scrollOverlay = document.getElementById('heatmap-scroll-overlay');
    if (!canvas || !scrollOverlay) return;

    canvas.style.display = 'none';
    scrollOverlay.style.display = 'block';
    renderer = null;

    if (!scrollData || !scrollData.depths || scrollData.depths.length === 0) {
      scrollOverlay.innerHTML = `
        <div class="flex items-center justify-center h-full">
          <span class="text-sm text-slate-500">No scroll data available</span>
        </div>`;
      return;
    }

    const wrapper = document.getElementById('heatmap-canvas-wrapper');
    const wrapperHeight = wrapper ? wrapper.offsetHeight : 600;
    const wrapperWidth = wrapper ? wrapper.offsetWidth : 800;
    const maxDepthInData = scrollData.depths[scrollData.depths.length - 1].y;
    const scale = maxDepthInData > 0 ? wrapperHeight / maxDepthInData : 1;

    let bandsHtml = '';

    // Find where the fold line should be (approximate at ~700px in page coords)
    const foldY = Math.min(700 * scale, wrapperHeight * 0.6);

    for (let i = 0; i < scrollData.depths.length - 1; i++) {
      const current = scrollData.depths[i];
      const next = scrollData.depths[i + 1];
      const top = current.y * scale;
      const height = (next.y - current.y) * scale;
      const pct = current.percentage;

      // Color: red (100%) -> orange -> yellow -> green -> blue (0%)
      const color = getScrollColor(pct / 100);

      if (top + height > wrapperHeight) break;

      bandsHtml += `
        <div class="absolute left-0 right-0" style="top: ${top}px; height: ${Math.max(height, 1)}px; background-color: ${color}; opacity: 0.45;">
        </div>`;

      // Show percentage labels at key intervals
      if (pct % 10 < 8 && i % 2 === 0) {
        bandsHtml += `
          <div class="absolute left-3 flex items-center gap-2" style="top: ${top + height / 2 - 8}px; z-index: 5;">
            <span class="text-[11px] font-bold text-white drop-shadow-lg bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded">${Math.round(pct)}% of users</span>
          </div>`;
      }
    }

    // Fold line
    bandsHtml += `
      <div class="absolute left-0 right-0 flex items-center" style="top: ${foldY}px; z-index: 6;">
        <div class="flex-1 border-t-2 border-dashed border-orange-400/80"></div>
        <span class="mx-3 text-[11px] font-bold text-orange-300 bg-orange-500/20 backdrop-blur-sm px-3 py-1 rounded-full border border-orange-400/30 whitespace-nowrap">Average Fold</span>
        <div class="flex-1 border-t-2 border-dashed border-orange-400/80"></div>
      </div>`;

    scrollOverlay.innerHTML = bandsHtml;

    // Update legend info
    const legendInfo = document.getElementById('heatmap-legend-info');
    if (legendInfo) {
      legendInfo.textContent = `${App.formatNumber(scrollData.total_sessions)} sessions tracked`;
    }
  }

  function getScrollColor(value) {
    // value from 0 to 1 (0 = cold/nobody, 1 = hot/everyone)
    const v = Math.max(0, Math.min(1, value));
    let r, g, b;

    if (v > 0.75) {
      // Red zone (most users)
      const t = (v - 0.75) / 0.25;
      r = 220 + Math.round(35 * t);
      g = Math.round(60 * (1 - t));
      b = 30;
    } else if (v > 0.5) {
      // Orange/Yellow zone
      const t = (v - 0.5) / 0.25;
      r = 200 + Math.round(20 * t);
      g = 150 - Math.round(90 * t);
      b = 30;
    } else if (v > 0.25) {
      // Green/Teal zone
      const t = (v - 0.25) / 0.25;
      r = 40 + Math.round(160 * t);
      g = 180 - Math.round(30 * t);
      b = 80 - Math.round(50 * t);
    } else {
      // Blue/Purple zone (fewest users)
      const t = v / 0.25;
      r = Math.round(40 * t);
      g = 80 + Math.round(100 * t);
      b = 180 - Math.round(100 * t);
    }

    return `rgb(${r}, ${g}, ${b})`;
  }

  /* ------------------------------------------------------------------
     Render: Move heatmap
  ------------------------------------------------------------------ */
  function renderMoveHeatmap() {
    const canvas = document.getElementById('heatmap-canvas');
    const scrollOverlay = document.getElementById('heatmap-scroll-overlay');
    if (!canvas) return;

    if (scrollOverlay) scrollOverlay.style.display = 'none';
    canvas.style.display = 'block';
    canvas.style.pointerEvents = 'none';

    const wrapper = document.getElementById('heatmap-canvas-wrapper');
    if (!wrapper) return;

    const w = wrapper.offsetWidth;
    const h = wrapper.offsetHeight;

    canvas.width = w;
    canvas.height = h;

    renderer = new HeatmapRenderer(canvas, {
      radius: 50,
      maxOpacity: 0.55,
    });

    if (moveData && moveData.points && moveData.points.length > 0) {
      // Scale points to fit canvas (assume 1280 wide page)
      const scaleX = w / 1280;
      const scaleY = h / 900;

      const scaledPoints = moveData.points.map(p => ({
        x: Math.round(p.x * scaleX),
        y: Math.round(p.y * scaleY),
        count: p.count || Math.round((p.intensity || 0) * 10),
        intensity: p.intensity || 0,
      }));

      renderer.setData(scaledPoints);
    } else {
      renderer.clear();
    }

    // Update legend info
    const legendInfo = document.getElementById('heatmap-legend-info');
    if (legendInfo) {
      legendInfo.textContent = moveData
        ? `${App.formatNumber(moveData.total_moves)} movement events`
        : 'No movement data';
    }
  }

  /* ------------------------------------------------------------------
     Update sidebar stats
  ------------------------------------------------------------------ */
  function updateStats() {
    const statsEl = document.getElementById('heatmap-stats');
    const topPosEl = document.getElementById('heatmap-top-positions');
    if (!statsEl || !topPosEl) return;

    let statsHtml = '';
    let topPosHtml = '';

    if (currentMode === 'click' && clickData) {
      const totalClicks = clickData.total_clicks || 0;
      const hottest = clickData.points && clickData.points.length > 0 ? clickData.points[0] : null;
      const uniquePositions = clickData.points ? clickData.points.length : 0;
      const avgClicks = uniquePositions > 0 ? Math.round(totalClicks / uniquePositions * 10) / 10 : 0;

      statsHtml = `
        ${statCard('Total Clicks', App.formatNumber(totalClicks), clickStatIcon(), 'blue')}
        ${statCard('Unique Positions', App.formatNumber(uniquePositions), positionsIcon(), 'purple')}
        ${statCard('Avg Clicks/Position', String(avgClicks), avgIcon(), 'green')}
        ${statCard('Hottest Spot', hottest ? `(${hottest.x}, ${hottest.y})` : '--', hotspotIcon(), 'red')}
      `;

      // Top clicked positions
      const topPoints = (clickData.points || []).slice(0, 8);
      topPosHtml = `
        <div class="px-4 py-3 border-b border-slate-700/50">
          <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Top Click Positions</h4>
        </div>
        <div class="divide-y divide-slate-700/30">
          ${topPoints.length === 0 ? '<div class="px-4 py-6 text-center text-xs text-slate-500">No data</div>' : ''}
          ${topPoints.map((p, i) => `
            <div class="flex items-center justify-between px-4 py-2.5">
              <div class="flex items-center gap-2.5">
                <span class="w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold ${i < 3 ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700/50 text-slate-500'}">${i + 1}</span>
                <span class="text-xs text-slate-300 font-mono">(${p.x}, ${p.y})</span>
              </div>
              <span class="text-xs font-semibold ${i === 0 ? 'text-red-400' : 'text-slate-400'}">${p.count} clicks</span>
            </div>
          `).join('')}
        </div>
      `;
    } else if (currentMode === 'scroll' && scrollData) {
      const totalSessions = scrollData.total_sessions || 0;
      const depths = scrollData.depths || [];
      const fiftyPctDepth = depths.find(d => d.percentage <= 50);
      const twentyFivePctDepth = depths.find(d => d.percentage <= 25);
      const maxDepth = depths.length > 0 ? depths[depths.length - 1].y : 0;

      statsHtml = `
        ${statCard('Sessions Tracked', App.formatNumber(totalSessions), scrollStatIcon(), 'blue')}
        ${statCard('50% Reach Depth', fiftyPctDepth ? `${fiftyPctDepth.y}px` : '--', depthIcon(), 'yellow')}
        ${statCard('25% Reach Depth', twentyFivePctDepth ? `${twentyFivePctDepth.y}px` : '--', depthIcon(), 'orange')}
        ${statCard('Max Page Depth', `${maxDepth}px`, rulerIcon(), 'purple')}
      `;

      // Scroll depth breakdown
      const keyDepths = depths.filter((d, i) => i % 3 === 0).slice(0, 10);
      topPosHtml = `
        <div class="px-4 py-3 border-b border-slate-700/50">
          <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Scroll Depth Breakdown</h4>
        </div>
        <div class="divide-y divide-slate-700/30">
          ${keyDepths.map(d => {
            const barWidth = Math.max(0, Math.min(100, d.percentage));
            const barColor = d.percentage > 75 ? 'bg-green-500/60' : d.percentage > 50 ? 'bg-yellow-500/60' : d.percentage > 25 ? 'bg-orange-500/60' : 'bg-red-500/60';
            return `
              <div class="px-4 py-2.5">
                <div class="flex items-center justify-between mb-1.5">
                  <span class="text-xs text-slate-300 font-mono">${d.y}px</span>
                  <span class="text-xs font-semibold text-slate-400">${d.percentage}%</span>
                </div>
                <div class="w-full h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                  <div class="${barColor} h-full rounded-full transition-all" style="width: ${barWidth}%"></div>
                </div>
              </div>`;
          }).join('')}
        </div>
      `;
    } else if (currentMode === 'move' && moveData) {
      const totalMoves = moveData.total_moves || 0;
      const totalPoints = moveData.points ? moveData.points.length : 0;
      const hottestMove = moveData.points && moveData.points.length > 0 ? moveData.points[0] : null;

      statsHtml = `
        ${statCard('Movement Events', App.formatNumber(totalMoves), moveStatIcon(), 'blue')}
        ${statCard('Unique Positions', App.formatNumber(totalPoints), positionsIcon(), 'purple')}
        ${statCard('Hottest Area', hottestMove ? `(${hottestMove.x}, ${hottestMove.y})` : '--', hotspotIcon(), 'red')}
      `;

      const topMoves = (moveData.points || []).slice(0, 8);
      topPosHtml = `
        <div class="px-4 py-3 border-b border-slate-700/50">
          <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Hottest Areas</h4>
        </div>
        <div class="divide-y divide-slate-700/30">
          ${topMoves.length === 0 ? '<div class="px-4 py-6 text-center text-xs text-slate-500">No data</div>' : ''}
          ${topMoves.map((p, i) => `
            <div class="flex items-center justify-between px-4 py-2.5">
              <div class="flex items-center gap-2.5">
                <span class="w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold ${i < 3 ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-700/50 text-slate-500'}">${i + 1}</span>
                <span class="text-xs text-slate-300 font-mono">(${p.x}, ${p.y})</span>
              </div>
              <span class="text-xs font-semibold text-slate-400">${Math.round((p.intensity || 0) * 100)}%</span>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      statsHtml = `
        <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-6 text-center">
          <p class="text-sm text-slate-500">Select a page to view heatmap data</p>
        </div>
      `;
      topPosHtml = '';
    }

    statsEl.innerHTML = statsHtml;
    topPosEl.innerHTML = topPosHtml;
  }

  /* ------------------------------------------------------------------
     Stat card helper
  ------------------------------------------------------------------ */
  function statCard(title, value, icon, color) {
    const borderColors = {
      blue: 'border-blue-500/20',
      purple: 'border-purple-500/20',
      green: 'border-green-500/20',
      red: 'border-red-500/20',
      yellow: 'border-yellow-500/20',
      orange: 'border-orange-500/20',
    };
    const iconBgColors = {
      blue: 'bg-blue-500/10 text-blue-400',
      purple: 'bg-purple-500/10 text-purple-400',
      green: 'bg-green-500/10 text-green-400',
      red: 'bg-red-500/10 text-red-400',
      yellow: 'bg-yellow-500/10 text-yellow-400',
      orange: 'bg-orange-500/10 text-orange-400',
    };

    return `
      <div class="bg-slate-800 rounded-xl border ${borderColors[color] || 'border-slate-700/50'} p-4">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg ${iconBgColors[color] || 'bg-slate-700 text-slate-400'} flex items-center justify-center flex-shrink-0">
            ${icon}
          </div>
          <div class="min-w-0">
            <p class="text-[11px] font-medium text-slate-500 uppercase tracking-wider">${title}</p>
            <p class="text-base font-bold text-white truncate">${value}</p>
          </div>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------
     SVG Icons
  ------------------------------------------------------------------ */
  function clickIcon() {
    return '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59"/></svg>';
  }

  function scrollIcon() {
    return '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5"/></svg>';
  }

  function moveIcon() {
    return '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.115 5.19l.319 1.913A6 6 0 008.11 10.36L9.75 12l-.387.775c-.217.433-.132.956.21 1.298l1.348 1.348c.21.21.329.497.329.795v1.089c0 .426.24.815.622 1.006l.153.076c.433.217.956.132 1.298-.21l.723-.723a8.7 8.7 0 002.288-4.042 1.087 1.087 0 00-.358-1.099l-1.33-1.108c-.251-.21-.582-.299-.905-.245l-1.17.195a1.125 1.125 0 01-.98-.314l-.295-.295a1.125 1.125 0 010-1.591l.13-.132a1.125 1.125 0 011.3-.21l.603.302a.809.809 0 001.086-1.086L14.25 7.5l1.256-.837a4.5 4.5 0 001.528-1.732l.146-.292M6.115 5.19A9 9 0 1017.18 4.64M6.115 5.19A8.965 8.965 0 0112 3c1.929 0 3.72.608 5.18 1.64"/></svg>';
  }

  function clickStatIcon() {
    return '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59"/></svg>';
  }

  function scrollStatIcon() {
    return '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5"/></svg>';
  }

  function moveStatIcon() {
    return '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.115 5.19l.319 1.913A6 6 0 008.11 10.36L9.75 12"/></svg>';
  }

  function positionsIcon() {
    return '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6z"/><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 15.75A2.25 2.25 0 0115.75 13.5H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"/></svg>';
  }

  function avgIcon() {
    return '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z"/></svg>';
  }

  function hotspotIcon() {
    return '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z"/></svg>';
  }

  function depthIcon() {
    return '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m0 0l6.75-6.75M12 19.5l-6.75-6.75"/></svg>';
  }

  function rulerIcon() {
    return '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"/></svg>';
  }

  /* ------------------------------------------------------------------
     Utility helpers
  ------------------------------------------------------------------ */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function showLoading(show) {
    const el = document.getElementById('heatmap-loading');
    if (el) el.style.display = show ? 'flex' : 'none';
  }

  /* ------------------------------------------------------------------
     Public event handlers
  ------------------------------------------------------------------ */
  async function onUrlChange(url) {
    currentUrl = url;
    if (url) {
      await loadHeatmapData();
    }
  }

  async function setMode(mode) {
    if (mode === currentMode) return;
    currentMode = mode;
    renderPage();
    if (currentUrl) {
      await loadHeatmapData();
    }
  }

  async function refresh() {
    if (currentUrl) {
      await loadHeatmapData();
    }
  }

  /* ------------------------------------------------------------------
     Public API
  ------------------------------------------------------------------ */
  return {
    render,
    onUrlChange,
    setMode,
    refresh,
  };

})();
