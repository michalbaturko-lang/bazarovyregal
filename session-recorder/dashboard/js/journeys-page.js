/* ==========================================================================
   journeys-page.js  -  User journey mapping & Sankey flow visualization
   ========================================================================== */

const JourneysPage = (() => {

  /* ------------------------------------------------------------------
     State
  ------------------------------------------------------------------ */
  let flowsData = null;
  let pathsData = null;
  let entryExitData = null;
  let pageFlowData = null;
  let activeTab = 'flows';
  let sankeyInstance = null;

  /* ------------------------------------------------------------------
     Mock Data (fallback when API is unavailable)
  ------------------------------------------------------------------ */
  const MockJourneys = (() => {
    const pages = ['/', '/katalog', '/regal-180x90', '/bile-regaly', '/kontakt',
      '/akce-regaly-2026', '/o-nas', '/policove-regaly', '/kovove-regaly',
      '/obchodni-podminky', '/kosik', '/dodani'];

    function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

    function flowsData() {
      const nodes = pages.map(p => ({
        id: p,
        sessions: randInt(20, 300),
        entry_count: p === '/' ? randInt(200, 400) : randInt(0, 40),
        exit_count: randInt(5, 80),
      }));
      nodes.sort((a, b) => b.sessions - a.sessions);

      const links = [];
      // Generate realistic transitions
      const transitionMap = [
        ['/', '/katalog', randInt(100, 200)],
        ['/', '/akce-regaly-2026', randInt(40, 90)],
        ['/', '/o-nas', randInt(20, 50)],
        ['/', '/kontakt', randInt(15, 35)],
        ['/katalog', '/regal-180x90', randInt(45, 95)],
        ['/katalog', '/bile-regaly', randInt(30, 70)],
        ['/katalog', '/policove-regaly', randInt(25, 55)],
        ['/katalog', '/kovove-regaly', randInt(20, 45)],
        ['/regal-180x90', '/kosik', randInt(15, 40)],
        ['/bile-regaly', '/kosik', randInt(10, 30)],
        ['/policove-regaly', '/regal-180x90', randInt(10, 25)],
        ['/kovove-regaly', '/kosik', randInt(8, 20)],
        ['/kosik', '/dodani', randInt(12, 35)],
        ['/akce-regaly-2026', '/katalog', randInt(25, 55)],
        ['/akce-regaly-2026', '/bile-regaly', randInt(18, 40)],
        ['/regal-180x90', '/kontakt', randInt(8, 20)],
        ['/kontakt', '/', randInt(5, 15)],
        ['/o-nas', '/katalog', randInt(10, 25)],
        ['/dodani', '/', randInt(5, 12)],
      ];
      for (const [source, target, value] of transitionMap) {
        links.push({ source, target, value });
      }

      return { nodes, links, total_sessions: randInt(400, 800) };
    }

    function pathsData() {
      const commonPaths = [
        { path: ['/', '/katalog', '/regal-180x90', '/kosik', '/dodani'], sessions: randInt(20, 45), avg_duration: randInt(180, 360) },
        { path: ['/', '/katalog', '/bile-regaly', '/kosik'], sessions: randInt(15, 35), avg_duration: randInt(120, 280) },
        { path: ['/', '/akce-regaly-2026', '/bile-regaly', '/kosik', '/dodani'], sessions: randInt(12, 30), avg_duration: randInt(150, 300) },
        { path: ['/', '/katalog', '/policove-regaly', '/regal-180x90'], sessions: randInt(10, 28), avg_duration: randInt(90, 200) },
        { path: ['/', '/katalog', '/kovove-regaly'], sessions: randInt(8, 22), avg_duration: randInt(60, 150) },
        { path: ['/', '/o-nas', '/katalog', '/regal-180x90'], sessions: randInt(6, 18), avg_duration: randInt(120, 240) },
        { path: ['/', '/kontakt'], sessions: randInt(15, 40), avg_duration: randInt(30, 90) },
        { path: ['/', '/akce-regaly-2026', '/katalog', '/policove-regaly', '/kosik'], sessions: randInt(5, 15), avg_duration: randInt(200, 400) },
        { path: ['/katalog', '/regal-180x90', '/kosik', '/dodani'], sessions: randInt(8, 20), avg_duration: randInt(150, 280) },
        { path: ['/', '/katalog'], sessions: randInt(25, 60), avg_duration: randInt(20, 60) },
      ];
      commonPaths.forEach(p => { p.steps = p.path.length; });
      commonPaths.sort((a, b) => b.sessions - a.sessions);
      return { paths: commonPaths, total_unique_paths: randInt(80, 200), total_sessions: randInt(400, 800) };
    }

    function entryExitData() {
      const entry_pages = [
        { url: '/', sessions: randInt(250, 500), bounce_rate: parseFloat((Math.random() * 30 + 15).toFixed(1)), avg_duration: randInt(60, 240) },
        { url: '/katalog', sessions: randInt(50, 120), bounce_rate: parseFloat((Math.random() * 20 + 10).toFixed(1)), avg_duration: randInt(80, 200) },
        { url: '/akce-regaly-2026', sessions: randInt(30, 80), bounce_rate: parseFloat((Math.random() * 25 + 12).toFixed(1)), avg_duration: randInt(50, 150) },
        { url: '/regal-180x90', sessions: randInt(20, 60), bounce_rate: parseFloat((Math.random() * 20 + 8).toFixed(1)), avg_duration: randInt(90, 250) },
        { url: '/bile-regaly', sessions: randInt(15, 45), bounce_rate: parseFloat((Math.random() * 25 + 10).toFixed(1)), avg_duration: randInt(70, 180) },
        { url: '/kontakt', sessions: randInt(10, 30), bounce_rate: parseFloat((Math.random() * 35 + 20).toFixed(1)), avg_duration: randInt(40, 120) },
        { url: '/o-nas', sessions: randInt(8, 25), bounce_rate: parseFloat((Math.random() * 40 + 25).toFixed(1)), avg_duration: randInt(30, 100) },
      ];
      const exit_pages = [
        { url: '/dodani', sessions: randInt(40, 100), exit_rate: parseFloat((Math.random() * 15 + 8).toFixed(1)), avg_time_before_exit: randInt(200, 400) },
        { url: '/kontakt', sessions: randInt(30, 80), exit_rate: parseFloat((Math.random() * 12 + 5).toFixed(1)), avg_time_before_exit: randInt(100, 250) },
        { url: '/', sessions: randInt(60, 150), exit_rate: parseFloat((Math.random() * 20 + 10).toFixed(1)), avg_time_before_exit: randInt(15, 60) },
        { url: '/katalog', sessions: randInt(25, 70), exit_rate: parseFloat((Math.random() * 10 + 5).toFixed(1)), avg_time_before_exit: randInt(60, 180) },
        { url: '/regal-180x90', sessions: randInt(15, 50), exit_rate: parseFloat((Math.random() * 8 + 3).toFixed(1)), avg_time_before_exit: randInt(80, 200) },
        { url: '/obchodni-podminky', sessions: randInt(10, 30), exit_rate: parseFloat((Math.random() * 6 + 2).toFixed(1)), avg_time_before_exit: randInt(30, 90) },
        { url: '/kosik', sessions: randInt(20, 55), exit_rate: parseFloat((Math.random() * 10 + 4).toFixed(1)), avg_time_before_exit: randInt(120, 300) },
      ];
      return { entry_pages, exit_pages, total_sessions: randInt(400, 800) };
    }

    function pageFlowData(url) {
      return {
        url,
        came_from: [
          { url: '/', count: randInt(40, 120) },
          { url: '/katalog', count: randInt(20, 60) },
          { url: '/akce-regaly-2026', count: randInt(10, 35) },
          { url: '/o-nas', count: randInt(5, 20) },
          { url: '/policove-regaly', count: randInt(3, 15) },
        ],
        went_to: [
          { url: '/kosik', count: randInt(25, 70) },
          { url: '/kontakt', count: randInt(10, 30) },
          { url: '/katalog', count: randInt(15, 40) },
          { url: '/bile-regaly', count: randInt(5, 20) },
          { url: '/', count: randInt(5, 15) },
        ],
        bounced: randInt(10, 50),
        total_visits: randInt(100, 300),
        avg_time_on_page: randInt(30, 180),
        avg_scroll_depth: randInt(40, 85),
      };
    }

    return { flowsData, pathsData, entryExitData, pageFlowData };
  })();

  /* ------------------------------------------------------------------
     Data Fetching
  ------------------------------------------------------------------ */
  async function fetchFlows() {
    try {
      const qs = `project_id=${App.state.project}&date_from=${App.state.dateRange.start}&date_to=${App.state.dateRange.end}&min_sessions=2`;
      flowsData = await App.api(`/journeys/flows?${qs}`);
    } catch (_) {
      flowsData = MockJourneys.flowsData();
    }
  }

  async function fetchPaths() {
    try {
      const qs = `project_id=${App.state.project}&date_from=${App.state.dateRange.start}&date_to=${App.state.dateRange.end}`;
      pathsData = await App.api(`/journeys/paths?${qs}`);
    } catch (_) {
      pathsData = MockJourneys.pathsData();
    }
  }

  async function fetchEntryExit() {
    try {
      const qs = `project_id=${App.state.project}&date_from=${App.state.dateRange.start}&date_to=${App.state.dateRange.end}`;
      entryExitData = await App.api(`/journeys/entry-exit?${qs}`);
    } catch (_) {
      entryExitData = MockJourneys.entryExitData();
    }
  }

  async function fetchPageFlow(url) {
    try {
      const encodedUrl = encodeURIComponent(url.replace(/^\//, ''));
      const qs = `project_id=${App.state.project}&date_from=${App.state.dateRange.start}&date_to=${App.state.dateRange.end}`;
      pageFlowData = await App.api(`/journeys/page-flow/${encodedUrl}?${qs}`);
    } catch (_) {
      pageFlowData = MockJourneys.pageFlowData(url);
    }
  }

  /* ==================================================================
     SankeyDiagram - Canvas-based Sankey flow visualization
  ================================================================== */
  class SankeyDiagram {
    constructor(canvas, data) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.rawNodes = data.nodes || [];
      this.rawLinks = data.links || [];
      this.totalSessions = data.total_sessions || 0;
      this.nodes = [];
      this.links = [];
      this.hoveredNode = null;
      this.hoveredLink = null;
      this.tooltip = null;
      this.dpr = window.devicePixelRatio || 1;
      this.padding = { top: 30, right: 30, bottom: 30, left: 30 };
      this.nodeWidth = 18;
      this.nodePadding = 12;
      this.columns = [];

      this._onMouseMove = this._onMouseMove.bind(this);
      this._onMouseLeave = this._onMouseLeave.bind(this);
      this._onClick = this._onClick.bind(this);

      this._setupCanvas();
      this._createTooltip();
      this._bindEvents();
      this.layout();
      this.render();
    }

    destroy() {
      this.canvas.removeEventListener('mousemove', this._onMouseMove);
      this.canvas.removeEventListener('mouseleave', this._onMouseLeave);
      this.canvas.removeEventListener('click', this._onClick);
      if (this.tooltip && this.tooltip.parentNode) {
        this.tooltip.parentNode.removeChild(this.tooltip);
      }
    }

    _setupCanvas() {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      const w = rect.width || 900;
      const h = rect.height || 500;
      this.width = w;
      this.height = h;
      this.canvas.width = w * this.dpr;
      this.canvas.height = h * this.dpr;
      this.canvas.style.width = w + 'px';
      this.canvas.style.height = h + 'px';
      this.ctx.scale(this.dpr, this.dpr);
    }

    _createTooltip() {
      this.tooltip = document.createElement('div');
      this.tooltip.className = 'fixed z-50 pointer-events-none opacity-0 transition-opacity duration-150';
      this.tooltip.style.cssText = 'background:#1e293b;border:1px solid #334155;border-radius:10px;padding:10px 14px;font-size:12px;color:#e2e8f0;box-shadow:0 8px 32px rgba(0,0,0,0.4);max-width:280px;';
      document.body.appendChild(this.tooltip);
    }

    /* -- Layout: assign columns, positions -- */
    layout() {
      if (this.rawNodes.length === 0) return;

      const nodeMap = new Map();
      for (const n of this.rawNodes) {
        nodeMap.set(n.id, { ...n, inLinks: [], outLinks: [], column: -1 });
      }

      // Build adjacency
      const validLinks = [];
      for (const l of this.rawLinks) {
        if (nodeMap.has(l.source) && nodeMap.has(l.target) && l.source !== l.target) {
          validLinks.push({ ...l });
          nodeMap.get(l.source).outLinks.push(l);
          nodeMap.get(l.target).inLinks.push(l);
        }
      }

      // Assign columns: entry pages (high entry_count) go left,
      // exit pages (high exit_count) go right, rest in middle
      const allNodes = Array.from(nodeMap.values());
      const maxEntry = Math.max(1, ...allNodes.map(n => n.entry_count || 0));
      const maxExit = Math.max(1, ...allNodes.map(n => n.exit_count || 0));

      // Classify nodes into columns
      const NUM_COLS = Math.min(5, Math.max(3, Math.ceil(allNodes.length / 4)));

      for (const node of allNodes) {
        const entryRatio = (node.entry_count || 0) / maxEntry;
        const exitRatio = (node.exit_count || 0) / maxExit;

        if (entryRatio > 0.3 && entryRatio > exitRatio) {
          node.column = 0;
        } else if (exitRatio > 0.3 && exitRatio > entryRatio) {
          node.column = NUM_COLS - 1;
        } else {
          // Assign based on traffic flow position
          const inFlow = node.inLinks.reduce((s, l) => s + l.value, 0);
          const outFlow = node.outLinks.reduce((s, l) => s + l.value, 0);
          const ratio = (inFlow + 1) / (outFlow + inFlow + 2);
          node.column = Math.min(NUM_COLS - 2, Math.max(1, Math.round(ratio * (NUM_COLS - 2)) + 1));
        }
      }

      // Resolve link conflicts: if source.column >= target.column, bump target
      for (const link of validLinks) {
        const src = nodeMap.get(link.source);
        const tgt = nodeMap.get(link.target);
        if (src.column >= tgt.column) {
          tgt.column = Math.min(NUM_COLS - 1, src.column + 1);
        }
      }

      // Group nodes by column
      const columnGroups = new Map();
      for (const node of allNodes) {
        if (!columnGroups.has(node.column)) columnGroups.set(node.column, []);
        columnGroups.get(node.column).push(node);
      }

      // Sort columns
      const colKeys = Array.from(columnGroups.keys()).sort((a, b) => a - b);

      // Compute layout dimensions
      const drawWidth = this.width - this.padding.left - this.padding.right - this.nodeWidth;
      const drawHeight = this.height - this.padding.top - this.padding.bottom;
      const colSpacing = colKeys.length > 1 ? drawWidth / (colKeys.length - 1) : 0;

      // Position nodes within columns
      this.nodes = [];

      for (let ci = 0; ci < colKeys.length; ci++) {
        const col = colKeys[ci];
        const colNodes = columnGroups.get(col);
        colNodes.sort((a, b) => b.sessions - a.sessions);

        // Calculate total height needed for this column
        const totalSessions = colNodes.reduce((s, n) => s + n.sessions, 0);

        let y = this.padding.top;
        const availableHeight = drawHeight - (colNodes.length - 1) * this.nodePadding;

        for (const node of colNodes) {
          const proportion = totalSessions > 0 ? node.sessions / totalSessions : 1 / colNodes.length;
          const nodeHeight = Math.max(20, proportion * availableHeight);

          const layoutNode = {
            ...node,
            x: this.padding.left + ci * colSpacing,
            y: y,
            width: this.nodeWidth,
            height: nodeHeight,
            columnIndex: ci,
          };
          this.nodes.push(layoutNode);
          y += nodeHeight + this.nodePadding;
        }
      }

      // Build node position lookup
      const nodePosMap = new Map();
      for (const n of this.nodes) {
        nodePosMap.set(n.id, n);
      }

      // Build links with bezier path data
      this.links = [];
      // Track port positions for links
      const nodeSourcePorts = new Map(); // nodeId -> current y offset for outgoing
      const nodeTargetPorts = new Map(); // nodeId -> current y offset for incoming

      for (const n of this.nodes) {
        nodeSourcePorts.set(n.id, n.y);
        nodeTargetPorts.set(n.id, n.y);
      }

      // Sort links by value descending for better layout
      const sortedLinks = [...validLinks].sort((a, b) => b.value - a.value);

      for (const link of sortedLinks) {
        const src = nodePosMap.get(link.source);
        const tgt = nodePosMap.get(link.target);
        if (!src || !tgt) continue;

        // Calculate link thickness proportional to value
        const maxLinkVal = Math.max(1, ...validLinks.map(l => l.value));
        const minThickness = 2;
        const maxThickness = Math.min(40, drawHeight * 0.08);
        const thickness = Math.max(minThickness, (link.value / maxLinkVal) * maxThickness);

        const sy = nodeSourcePorts.get(link.source);
        const ty = nodeTargetPorts.get(link.target);

        this.links.push({
          source: link.source,
          target: link.target,
          value: link.value,
          thickness,
          sy: sy + thickness / 2,
          ty: ty + thickness / 2,
          sx: src.x + src.width,
          tx: tgt.x,
        });

        nodeSourcePorts.set(link.source, sy + thickness + 1);
        nodeTargetPorts.set(link.target, ty + thickness + 1);
      }
    }

    /* -- Render -- */
    render() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.width, this.height);

      if (this.nodes.length === 0) {
        ctx.fillStyle = '#64748b';
        ctx.font = '14px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No flow data available for this period', this.width / 2, this.height / 2);
        return;
      }

      // Draw links
      for (const link of this.links) {
        this._drawLink(link);
      }

      // Draw nodes
      for (const node of this.nodes) {
        this._drawNode(node);
      }
    }

    _drawLink(link) {
      const ctx = this.ctx;
      const isHovered = this.hoveredLink === link;
      const isConnected = this.hoveredNode &&
        (this.hoveredNode.id === link.source || this.hoveredNode.id === link.target);
      const dimmed = (this.hoveredNode || this.hoveredLink) && !isHovered && !isConnected;

      const cpOffset = Math.abs(link.tx - link.sx) * 0.5;

      ctx.beginPath();
      ctx.moveTo(link.sx, link.sy - link.thickness / 2);
      ctx.bezierCurveTo(
        link.sx + cpOffset, link.sy - link.thickness / 2,
        link.tx - cpOffset, link.ty - link.thickness / 2,
        link.tx, link.ty - link.thickness / 2
      );
      ctx.lineTo(link.tx, link.ty + link.thickness / 2);
      ctx.bezierCurveTo(
        link.tx - cpOffset, link.ty + link.thickness / 2,
        link.sx + cpOffset, link.sy + link.thickness / 2,
        link.sx, link.sy + link.thickness / 2
      );
      ctx.closePath();

      // Gradient fill
      const grad = ctx.createLinearGradient(link.sx, 0, link.tx, 0);
      if (isHovered || isConnected) {
        grad.addColorStop(0, 'rgba(59, 130, 246, 0.55)');
        grad.addColorStop(1, 'rgba(99, 102, 241, 0.55)');
      } else if (dimmed) {
        grad.addColorStop(0, 'rgba(59, 130, 246, 0.06)');
        grad.addColorStop(1, 'rgba(99, 102, 241, 0.06)');
      } else {
        // Color based on whether target is an exit or conversion page
        const isExitFlow = link.target === '/kontakt' || link.target === '/dodani' || link.target === '/kosik';
        if (isExitFlow) {
          grad.addColorStop(0, 'rgba(34, 197, 94, 0.2)');
          grad.addColorStop(1, 'rgba(34, 197, 94, 0.3)');
        } else {
          grad.addColorStop(0, 'rgba(59, 130, 246, 0.18)');
          grad.addColorStop(1, 'rgba(99, 102, 241, 0.18)');
        }
      }
      ctx.fillStyle = grad;
      ctx.fill();

      // Border
      if (isHovered) {
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    _drawNode(node) {
      const ctx = this.ctx;
      const isHovered = this.hoveredNode === node;
      const isConnected = this.hoveredLink &&
        (this.hoveredLink.source === node.id || this.hoveredLink.target === node.id);
      const dimmed = (this.hoveredNode && this.hoveredNode !== node) && !this._isNodeConnected(node);

      const x = node.x;
      const y = node.y;
      const w = node.width;
      const h = node.height;
      const r = Math.min(5, w / 2, h / 2);

      // Node background
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

      // Color based on node type
      const entryRatio = node.entry_count / Math.max(1, node.sessions);
      const exitRatio = node.exit_count / Math.max(1, node.sessions);

      let fillColor, borderColor;
      if (dimmed) {
        fillColor = 'rgba(51, 65, 85, 0.3)';
        borderColor = 'rgba(71, 85, 105, 0.2)';
      } else if (isHovered || isConnected) {
        fillColor = 'rgba(59, 130, 246, 0.9)';
        borderColor = 'rgba(96, 165, 250, 1)';
      } else if (entryRatio > 0.4) {
        fillColor = 'rgba(59, 130, 246, 0.75)';
        borderColor = 'rgba(96, 165, 250, 0.8)';
      } else if (exitRatio > 0.5) {
        fillColor = 'rgba(239, 68, 68, 0.65)';
        borderColor = 'rgba(248, 113, 113, 0.7)';
      } else {
        fillColor = 'rgba(99, 102, 241, 0.65)';
        borderColor = 'rgba(129, 140, 248, 0.7)';
      }

      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = isHovered ? 2 : 1;
      ctx.stroke();

      // Glow effect for hovered
      if (isHovered) {
        ctx.shadowColor = 'rgba(59, 130, 246, 0.4)';
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }

      // Label
      const labelOpacity = dimmed ? 0.25 : 1;
      const fontSize = Math.min(12, Math.max(9, h * 0.3));
      ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      const labelX = x + w + 8;
      const labelY = y + h / 2;

      // Path label
      const displayName = node.id.length > 20 ? node.id.slice(0, 18) + '...' : node.id;
      ctx.fillStyle = `rgba(226, 232, 240, ${labelOpacity})`;
      ctx.fillText(displayName, labelX, labelY - fontSize * 0.5);

      // Session count
      ctx.font = `400 ${Math.max(8, fontSize - 2)}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = `rgba(148, 163, 184, ${labelOpacity})`;
      ctx.fillText(`${node.sessions} sessions`, labelX, labelY + fontSize * 0.6);
    }

    _isNodeConnected(node) {
      if (!this.hoveredNode) return false;
      return this.links.some(l =>
        (l.source === this.hoveredNode.id && l.target === node.id) ||
        (l.target === this.hoveredNode.id && l.source === node.id)
      );
    }

    /* -- Hit testing -- */
    _getMousePos(e) {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }

    _hitTestNode(pos) {
      for (const node of this.nodes) {
        if (pos.x >= node.x && pos.x <= node.x + node.width + 100 &&
            pos.y >= node.y && pos.y <= node.y + node.height) {
          return node;
        }
      }
      return null;
    }

    _hitTestLink(pos) {
      // Approximate: check if point is within link path area
      for (const link of this.links) {
        const midX = (link.sx + link.tx) / 2;
        const midY = (link.sy + link.ty) / 2;
        const t = (pos.x - link.sx) / (link.tx - link.sx);
        if (t < 0 || t > 1) continue;

        // Calculate expected y at this x using bezier approximation
        const expectedY = link.sy + (link.ty - link.sy) * (3 * t * t - 2 * t * t * t);
        const dist = Math.abs(pos.y - expectedY);
        if (dist < link.thickness / 2 + 4) {
          return link;
        }
      }
      return null;
    }

    /* -- Events -- */
    _bindEvents() {
      this.canvas.addEventListener('mousemove', this._onMouseMove);
      this.canvas.addEventListener('mouseleave', this._onMouseLeave);
      this.canvas.addEventListener('click', this._onClick);
    }

    _onMouseMove(e) {
      const pos = this._getMousePos(e);
      const prevNode = this.hoveredNode;
      const prevLink = this.hoveredLink;

      this.hoveredNode = this._hitTestNode(pos);
      if (!this.hoveredNode) {
        this.hoveredLink = this._hitTestLink(pos);
      } else {
        this.hoveredLink = null;
      }

      if (prevNode !== this.hoveredNode || prevLink !== this.hoveredLink) {
        this.render();
        this._updateTooltip(e);
      } else {
        this._positionTooltip(e);
      }

      this.canvas.style.cursor = (this.hoveredNode || this.hoveredLink) ? 'pointer' : 'default';
    }

    _onMouseLeave() {
      if (this.hoveredNode || this.hoveredLink) {
        this.hoveredNode = null;
        this.hoveredLink = null;
        this.render();
      }
      this.tooltip.style.opacity = '0';
    }

    _onClick(e) {
      if (this.hoveredNode) {
        showPageFlowDetail(this.hoveredNode.id);
      }
    }

    _updateTooltip(e) {
      if (this.hoveredNode) {
        const n = this.hoveredNode;
        const entryPct = this.totalSessions > 0 ? ((n.entry_count / this.totalSessions) * 100).toFixed(1) : 0;
        const exitPct = n.sessions > 0 ? ((n.exit_count / n.sessions) * 100).toFixed(1) : 0;
        this.tooltip.innerHTML = `
          <div style="font-weight:600;color:#f1f5f9;margin-bottom:6px;font-size:13px;">${escHtml(n.id)}</div>
          <div style="display:grid;grid-template-columns:auto auto;gap:2px 12px;">
            <span style="color:#94a3b8;">Sessions:</span><span style="color:#e2e8f0;font-weight:500;">${n.sessions}</span>
            <span style="color:#94a3b8;">Entries:</span><span style="color:#60a5fa;font-weight:500;">${n.entry_count} (${entryPct}%)</span>
            <span style="color:#94a3b8;">Exits:</span><span style="color:#f87171;font-weight:500;">${n.exit_count} (${exitPct}%)</span>
          </div>
          <div style="margin-top:6px;color:#64748b;font-size:10px;">Click for page flow detail</div>`;
        this.tooltip.style.opacity = '1';
      } else if (this.hoveredLink) {
        const l = this.hoveredLink;
        this.tooltip.innerHTML = `
          <div style="font-weight:600;color:#f1f5f9;margin-bottom:4px;font-size:13px;">${l.value} sessions</div>
          <div style="color:#94a3b8;font-size:11px;">
            <span style="color:#60a5fa;">${escHtml(l.source)}</span>
            <span style="margin:0 4px;color:#475569;">&#8594;</span>
            <span style="color:#818cf8;">${escHtml(l.target)}</span>
          </div>`;
        this.tooltip.style.opacity = '1';
      } else {
        this.tooltip.style.opacity = '0';
      }
      this._positionTooltip(e);
    }

    _positionTooltip(e) {
      const tx = e.clientX + 14;
      const ty = e.clientY - 10;
      this.tooltip.style.left = tx + 'px';
      this.tooltip.style.top = ty + 'px';
    }
  }

  /* ==================================================================
     Page Renderers
  ================================================================== */

  /* -- Tab nav builder -- */
  function tabNav() {
    const tabs = [
      { id: 'flows', label: 'Flow Diagram', icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"/></svg>' },
      { id: 'paths', label: 'Top Paths', icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12"/></svg>' },
      { id: 'entry-exit', label: 'Entry / Exit', icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"/></svg>' },
    ];

    return `
      <div class="flex items-center gap-1 bg-slate-900/50 rounded-xl p-1 border border-slate-800/60 mb-6">
        ${tabs.map(t => `
          <button onclick="JourneysPage.switchTab('${t.id}')"
                  class="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all
                         ${activeTab === t.id
                           ? 'bg-slate-800 text-white shadow-sm border border-slate-700/50'
                           : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'}">
            ${t.icon}
            <span>${t.label}</span>
          </button>
        `).join('')}
      </div>`;
  }

  /* -- Main render -- */
  async function render(container) {
    container.innerHTML = Components.loading();

    // Fetch all data in parallel
    await Promise.all([fetchFlows(), fetchPaths(), fetchEntryExit()]);

    renderContent(container);
  }

  function renderContent(container) {
    const headerAction = `
      <div class="flex items-center gap-2">
        <span class="text-xs text-slate-500">
          ${flowsData ? App.formatNumber(flowsData.total_sessions || 0) + ' sessions analyzed' : ''}
        </span>
      </div>`;

    container.innerHTML = `
      <div>
        ${Components.sectionHeader('User Flows', 'Visualize how users navigate through your site', headerAction)}
        ${tabNav()}
        <div id="journeys-tab-content"></div>
      </div>`;

    renderActiveTab();
  }

  function renderActiveTab() {
    const tabContent = document.getElementById('journeys-tab-content');
    if (!tabContent) return;

    // Destroy old sankey if it exists
    if (sankeyInstance) {
      sankeyInstance.destroy();
      sankeyInstance = null;
    }

    switch (activeTab) {
      case 'flows':
        renderFlowsTab(tabContent);
        break;
      case 'paths':
        renderPathsTab(tabContent);
        break;
      case 'entry-exit':
        renderEntryExitTab(tabContent);
        break;
    }
  }

  /* -- Flows Tab (Sankey) -- */
  function renderFlowsTab(container) {
    // Summary metrics
    const totalNodes = flowsData ? flowsData.nodes.length : 0;
    const totalLinks = flowsData ? flowsData.links.length : 0;
    const topEntryPage = flowsData && flowsData.nodes.length > 0
      ? flowsData.nodes.reduce((max, n) => (n.entry_count || 0) > (max.entry_count || 0) ? n : max, flowsData.nodes[0])
      : null;
    const topExitPage = flowsData && flowsData.nodes.length > 0
      ? flowsData.nodes.reduce((max, n) => (n.exit_count || 0) > (max.exit_count || 0) ? n : max, flowsData.nodes[0])
      : null;

    container.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        ${Components.metricCard('Pages Tracked', App.formatNumber(totalNodes), null,
          '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>')}
        ${Components.metricCard('Flow Transitions', App.formatNumber(totalLinks), null,
          '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"/></svg>')}
        ${Components.metricCard('Top Entry', topEntryPage ? topEntryPage.id : '--', null,
          '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"/></svg>')}
        ${Components.metricCard('Top Exit', topExitPage ? topExitPage.id : '--', null,
          '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"/></svg>')}
      </div>

      <!-- Sankey Diagram -->
      <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5 mb-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-semibold text-white">Page Flow Diagram</h3>
          <div class="flex items-center gap-4 text-xs text-slate-500">
            <div class="flex items-center gap-1.5">
              <span class="w-3 h-3 rounded-sm" style="background:rgba(59,130,246,0.75)"></span>
              Entry pages
            </div>
            <div class="flex items-center gap-1.5">
              <span class="w-3 h-3 rounded-sm" style="background:rgba(99,102,241,0.65)"></span>
              Middle pages
            </div>
            <div class="flex items-center gap-1.5">
              <span class="w-3 h-3 rounded-sm" style="background:rgba(239,68,68,0.65)"></span>
              Exit pages
            </div>
          </div>
        </div>
        <div style="position:relative;height:480px;">
          <canvas id="sankey-canvas" style="width:100%;height:100%;"></canvas>
        </div>
      </div>

      <!-- Page Flow Detail Panel (shown on click) -->
      <div id="page-flow-detail" class="hidden"></div>`;

    // Initialize Sankey diagram
    requestAnimationFrame(() => {
      const canvas = document.getElementById('sankey-canvas');
      if (canvas && flowsData) {
        sankeyInstance = new SankeyDiagram(canvas, flowsData);
      }
    });
  }

  /* -- Paths Tab -- */
  function renderPathsTab(container) {
    if (!pathsData || !pathsData.paths || pathsData.paths.length === 0) {
      container.innerHTML = Components.emptyState('No Path Data', 'No user paths found for the selected period.');
      return;
    }

    const summaryHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        ${Components.metricCard('Unique Paths', App.formatNumber(pathsData.total_unique_paths || 0), null,
          '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12"/></svg>')}
        ${Components.metricCard('Total Sessions', App.formatNumber(pathsData.total_sessions || 0), null,
          '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>')}
        ${Components.metricCard('Top Path Sessions', App.formatNumber(pathsData.paths[0] ? pathsData.paths[0].sessions : 0), null,
          '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.003 6.003 0 01-5.54 0"/></svg>')}
      </div>`;

    const pathRows = pathsData.paths.map((p, idx) => {
      // Build visual path representation
      const pathSteps = p.path.map((page, i) => {
        const isFirst = i === 0;
        const isLast = i === p.path.length - 1;
        const bgColor = isFirst ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
          : isLast ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
          : 'bg-slate-700/60 text-slate-300 border-slate-600/40';
        return `<span class="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${bgColor} whitespace-nowrap">${escHtml(page)}</span>`;
      });

      const arrowSvg = '<svg class="w-3 h-3 text-slate-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>';
      const pathViz = pathSteps.join(arrowSvg);

      // Is this a conversion path? (ends at /kosik, /dodani, or similar)
      const lastPage = p.path[p.path.length - 1];
      const isConversion = ['/kosik', '/dodani', '/checkout', '/thank-you', '/objednavka'].includes(lastPage);

      return `
        <div class="bg-slate-800/50 rounded-xl border border-slate-700/40 p-4 hover:border-slate-600/50 transition-colors">
          <div class="flex items-start justify-between gap-4 mb-3">
            <div class="flex items-center gap-2 text-sm">
              <span class="flex-shrink-0 w-7 h-7 rounded-lg bg-slate-700/60 flex items-center justify-center text-xs font-bold text-slate-400">#${idx + 1}</span>
              ${isConversion ? '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-500/15 text-green-400 border border-green-500/20">CONVERSION</span>' : ''}
            </div>
            <div class="flex items-center gap-4 text-right">
              <div>
                <div class="text-sm font-semibold text-white">${p.sessions}</div>
                <div class="text-[10px] text-slate-500 uppercase">sessions</div>
              </div>
              <div>
                <div class="text-sm font-medium text-slate-300">${App.formatDuration(p.avg_duration)}</div>
                <div class="text-[10px] text-slate-500 uppercase">avg time</div>
              </div>
              <div>
                <div class="text-sm font-medium text-slate-400">${p.steps} steps</div>
                <div class="text-[10px] text-slate-500 uppercase">depth</div>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-1.5 flex-wrap overflow-x-auto pb-1">
            ${pathViz}
          </div>
        </div>`;
    }).join('');

    container.innerHTML = `
      ${summaryHTML}
      <div class="space-y-3">
        <h3 class="text-sm font-semibold text-white">Most Common User Paths</h3>
        ${pathRows}
      </div>`;
  }

  /* -- Entry/Exit Tab -- */
  function renderEntryExitTab(container) {
    if (!entryExitData) {
      container.innerHTML = Components.emptyState('No Data', 'No entry/exit data available for the selected period.');
      return;
    }

    const totalSessions = entryExitData.total_sessions || 1;

    // Entry Pages Table
    const entryHeaders = [
      { key: 'url', label: 'Entry Page' },
      { key: 'sessions', label: 'Sessions', align: 'right' },
      { key: 'share', label: 'Share', align: 'right' },
      { key: 'bounce', label: 'Bounce Rate', align: 'right' },
      { key: 'duration', label: 'Avg Duration', align: 'right' },
    ];

    const entryRows = (entryExitData.entry_pages || []).map(p => {
      const share = ((p.sessions / totalSessions) * 100).toFixed(1);
      const bounceColor = p.bounce_rate > 50 ? 'text-red-400' : p.bounce_rate > 30 ? 'text-amber-400' : 'text-green-400';
      const barWidth = Math.min(100, Math.max(5, (p.sessions / (entryExitData.entry_pages[0]?.sessions || 1)) * 100));

      return {
        cells: {
          url: `<div class="flex items-center gap-2">
                  <button onclick="JourneysPage.showPageFlowDetail('${escHtml(p.url)}')" class="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors truncate max-w-[200px]" title="${escHtml(p.url)}">${escHtml(p.url)}</button>
                </div>`,
          sessions: `<div class="flex items-center justify-end gap-2">
                       <div class="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                         <div class="h-full bg-blue-500 rounded-full" style="width:${barWidth}%"></div>
                       </div>
                       <span class="text-sm font-medium text-white w-10 text-right">${App.formatNumber(p.sessions)}</span>
                     </div>`,
          share: `<span class="text-sm text-slate-300">${share}%</span>`,
          bounce: `<span class="text-sm font-medium ${bounceColor}">${p.bounce_rate}%</span>`,
          duration: `<span class="text-sm text-slate-300">${App.formatDuration(p.avg_duration)}</span>`,
        },
      };
    });

    // Exit Pages Table
    const exitHeaders = [
      { key: 'url', label: 'Exit Page' },
      { key: 'sessions', label: 'Sessions', align: 'right' },
      { key: 'exitRate', label: 'Exit Rate', align: 'right' },
      { key: 'duration', label: 'Avg Time Before Exit', align: 'right' },
    ];

    const exitRows = (entryExitData.exit_pages || []).map(p => {
      const exitColor = p.exit_rate > 20 ? 'text-red-400' : p.exit_rate > 10 ? 'text-amber-400' : 'text-slate-300';
      const barWidth = Math.min(100, Math.max(5, (p.sessions / (entryExitData.exit_pages[0]?.sessions || 1)) * 100));

      return {
        cells: {
          url: `<button onclick="JourneysPage.showPageFlowDetail('${escHtml(p.url)}')" class="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors truncate max-w-[200px]" title="${escHtml(p.url)}">${escHtml(p.url)}</button>`,
          sessions: `<div class="flex items-center justify-end gap-2">
                       <div class="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                         <div class="h-full bg-red-500/70 rounded-full" style="width:${barWidth}%"></div>
                       </div>
                       <span class="text-sm font-medium text-white w-10 text-right">${App.formatNumber(p.sessions)}</span>
                     </div>`,
          exitRate: `<span class="text-sm font-medium ${exitColor}">${p.exit_rate}%</span>`,
          duration: `<span class="text-sm text-slate-300">${App.formatDuration(p.avg_time_before_exit)}</span>`,
        },
      };
    });

    container.innerHTML = `
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <!-- Entry Pages -->
        <div>
          <div class="flex items-center gap-2 mb-3">
            <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"/>
            </svg>
            <h3 class="text-sm font-semibold text-white">Top Entry Pages</h3>
          </div>
          ${Components.dataTable(entryHeaders, entryRows, { striped: true, hoverable: true })}
        </div>

        <!-- Exit Pages -->
        <div>
          <div class="flex items-center gap-2 mb-3">
            <svg class="w-4 h-4 text-red-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"/>
            </svg>
            <h3 class="text-sm font-semibold text-white">Top Exit Pages</h3>
          </div>
          ${Components.dataTable(exitHeaders, exitRows, { striped: true, hoverable: true })}
        </div>
      </div>

      <!-- Page Flow Detail Panel -->
      <div id="page-flow-detail" class="mt-6 hidden"></div>`;
  }

  /* -- Page Flow Detail (shown on click) -- */
  async function showPageFlowDetail(url) {
    const detailEl = document.getElementById('page-flow-detail');
    if (!detailEl) return;

    detailEl.classList.remove('hidden');
    detailEl.innerHTML = `
      <div class="bg-slate-800 rounded-xl border border-slate-700/50 p-5">
        <div class="flex items-center justify-center py-6">
          <div class="relative w-6 h-6">
            <div class="absolute inset-0 rounded-full border-2 border-slate-700"></div>
            <div class="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500 animate-spin"></div>
          </div>
          <span class="ml-3 text-sm text-slate-500">Loading flow for ${escHtml(url)}...</span>
        </div>
      </div>`;

    // Scroll into view
    detailEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

    await fetchPageFlow(url);

    if (!pageFlowData) {
      detailEl.innerHTML = '';
      detailEl.classList.add('hidden');
      return;
    }

    const d = pageFlowData;

    // Build horizontal bar charts
    const maxCameFrom = d.came_from.length > 0 ? d.came_from[0].count : 1;
    const maxWentTo = d.went_to.length > 0 ? d.went_to[0].count : 1;

    const cameFromBars = d.came_from.map(item => {
      const pct = (item.count / maxCameFrom) * 100;
      return `
        <div class="flex items-center gap-3 group">
          <button onclick="JourneysPage.showPageFlowDetail('${escHtml(item.url)}')"
                  class="text-xs font-medium text-slate-300 hover:text-blue-400 transition-colors w-32 truncate text-right flex-shrink-0"
                  title="${escHtml(item.url)}">${escHtml(item.url)}</button>
          <div class="flex-1 h-5 bg-slate-700/40 rounded-md overflow-hidden">
            <div class="h-full bg-gradient-to-r from-blue-500/50 to-blue-500/30 rounded-md transition-all group-hover:from-blue-500/70 group-hover:to-blue-500/50"
                 style="width:${pct}%"></div>
          </div>
          <span class="text-xs font-medium text-slate-400 w-10 text-right flex-shrink-0">${item.count}</span>
        </div>`;
    }).join('');

    const wentToBars = d.went_to.map(item => {
      const pct = (item.count / maxWentTo) * 100;
      return `
        <div class="flex items-center gap-3 group">
          <button onclick="JourneysPage.showPageFlowDetail('${escHtml(item.url)}')"
                  class="text-xs font-medium text-slate-300 hover:text-blue-400 transition-colors w-32 truncate text-right flex-shrink-0"
                  title="${escHtml(item.url)}">${escHtml(item.url)}</button>
          <div class="flex-1 h-5 bg-slate-700/40 rounded-md overflow-hidden">
            <div class="h-full bg-gradient-to-r from-indigo-500/50 to-indigo-500/30 rounded-md transition-all group-hover:from-indigo-500/70 group-hover:to-indigo-500/50"
                 style="width:${pct}%"></div>
          </div>
          <span class="text-xs font-medium text-slate-400 w-10 text-right flex-shrink-0">${item.count}</span>
        </div>`;
    }).join('');

    detailEl.innerHTML = `
      <div class="bg-slate-800 rounded-xl border border-slate-700/50 overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
              <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-semibold text-white">Page Flow: ${escHtml(d.url)}</h3>
              <p class="text-xs text-slate-500">${App.formatNumber(d.total_visits || 0)} total visits</p>
            </div>
          </div>
          <button onclick="document.getElementById('page-flow-detail').classList.add('hidden')"
                  class="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-700/50">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Metrics -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-700/30">
          <div class="bg-slate-800 px-5 py-4">
            <div class="text-xs text-slate-500 mb-1">Avg Time on Page</div>
            <div class="text-lg font-bold text-white">${App.formatDuration(d.avg_time_on_page)}</div>
          </div>
          <div class="bg-slate-800 px-5 py-4">
            <div class="text-xs text-slate-500 mb-1">Avg Scroll Depth</div>
            <div class="text-lg font-bold text-white">${d.avg_scroll_depth || 0}%</div>
          </div>
          <div class="bg-slate-800 px-5 py-4">
            <div class="text-xs text-slate-500 mb-1">Bounced / Exited</div>
            <div class="text-lg font-bold text-red-400">${App.formatNumber(d.bounced)}</div>
          </div>
          <div class="bg-slate-800 px-5 py-4">
            <div class="text-xs text-slate-500 mb-1">Exit Rate</div>
            <div class="text-lg font-bold text-amber-400">${d.total_visits > 0 ? ((d.bounced / d.total_visits) * 100).toFixed(1) : 0}%</div>
          </div>
        </div>

        <!-- Flow bars -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-px bg-slate-700/30">
          <!-- Came From -->
          <div class="bg-slate-800 p-5">
            <div class="flex items-center gap-2 mb-4">
              <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"/>
              </svg>
              <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Where Users Came From</h4>
            </div>
            ${d.came_from.length > 0
              ? `<div class="space-y-2">${cameFromBars}</div>`
              : '<p class="text-xs text-slate-500 italic">No referral data (direct entry)</p>'}
          </div>

          <!-- Went To -->
          <div class="bg-slate-800 p-5">
            <div class="flex items-center gap-2 mb-4">
              <svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/>
              </svg>
              <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Where Users Went Next</h4>
            </div>
            ${d.went_to.length > 0
              ? `<div class="space-y-2">${wentToBars}</div>`
              : '<p class="text-xs text-slate-500 italic">No outbound navigation (exit page)</p>'}
          </div>
        </div>
      </div>`;
  }

  /* -- Tab switching -- */
  function switchTab(tab) {
    activeTab = tab;
    const container = document.getElementById('main-content');
    if (container) renderContent(container);
  }

  /* -- Helpers -- */
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
    switchTab,
    showPageFlowDetail,
  };

})();
