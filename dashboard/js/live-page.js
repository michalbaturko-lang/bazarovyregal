/* ==========================================================================
   live-page.js  -  Real-time Live Dashboard Page
   Shows currently active visitors on tracked e-shops with auto-refresh,
   world map, page ticker, and live activity feed.
   ========================================================================== */

window.LivePage = (() => {

  /* ------------------------------------------------------------------
     Constants
  ------------------------------------------------------------------ */
  const POLL_INTERVAL = 5000; // 5 seconds
  const IDLE_THRESHOLD = 60;  // seconds without events before "idle"

  const THEME = {
    bg: '#0a0a1a',
    card: '#16213e',
    cardBorder: 'rgba(22, 33, 62, 0.6)',
    accent: '#00c853',
    activePulse: '#00e676',
    text: '#e0e0e0',
    textMuted: '#8892b0',
    textDim: '#5a6480',
    border: 'rgba(0, 200, 83, 0.15)',
    borderHover: 'rgba(0, 200, 83, 0.35)',
    yellow: '#ffd600',
    red: '#ff1744',
    blue: '#4361ee',
  };

  // Target markets for the world map highlight
  const TARGET_MARKETS = ['CZ', 'SK', 'HU'];

  /* ------------------------------------------------------------------
     State
  ------------------------------------------------------------------ */
  let pollTimer = null;
  let durationTimer = null;
  let tickerTimer = null;
  let lastUpdatedTimer = null;
  let containerEl = null;
  let isActive = false;
  let previousSessions = [];
  let previousSessionIds = new Set();
  let lastFetchTime = null;
  let currentData = null;

  /* ------------------------------------------------------------------
     Country flag helper (regional indicator symbols)
  ------------------------------------------------------------------ */
  function countryFlag(code) {
    if (!code) return '';
    const c = code.toUpperCase();
    return String.fromCodePoint(...[...c].map(ch => 0x1F1E6 - 65 + ch.charCodeAt(0)));
  }

  /* ------------------------------------------------------------------
     Avatar generation from visitor_id hash
  ------------------------------------------------------------------ */
  function visitorAvatar(visitorId, name) {
    const str = name || visitorId || 'anonymous';
    const hue = Math.abs([...str].reduce((h, c) => (h << 5) - h + c.charCodeAt(0), 0)) % 360;
    const initials = str
      .split(/[\s@._-]/)
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0].toUpperCase())
      .join('') || '?';
    return `<div class="live-avatar" style="background:hsl(${hue},55%,38%)">${initials}</div>`;
  }

  /* ------------------------------------------------------------------
     Device / Browser / OS icon helpers
  ------------------------------------------------------------------ */
  function deviceIcon(type) {
    switch ((type || '').toLowerCase()) {
      case 'mobile':
        return '<svg class="live-icon-sm" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"/></svg>';
      case 'tablet':
        return '<svg class="live-icon-sm" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5h3m-6.75 2.25h10.5a2.25 2.25 0 002.25-2.25V4.5a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 4.5v15a2.25 2.25 0 002.25 2.25z"/></svg>';
      default: // desktop
        return '<svg class="live-icon-sm" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z"/></svg>';
    }
  }

  function browserIcon(browser) {
    const b = (browser || '').toLowerCase();
    if (b.includes('chrome')) return 'Chrome';
    if (b.includes('firefox')) return 'Firefox';
    if (b.includes('safari')) return 'Safari';
    if (b.includes('edge')) return 'Edge';
    if (b.includes('opera')) return 'Opera';
    return browser || 'Unknown';
  }

  /* ------------------------------------------------------------------
     Live duration - computes ticking time from started_at
  ------------------------------------------------------------------ */
  function liveDuration(startedAt) {
    const start = new Date(startedAt).getTime();
    const now = Date.now();
    const seconds = Math.max(0, Math.floor((now - start) / 1000));
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m < 60) return `${m}m ${String(s).padStart(2, '0')}s`;
    const h = Math.floor(m / 60);
    return `${h}h ${String(m % 60).padStart(2, '0')}m`;
  }

  /* ------------------------------------------------------------------
     Session activity status: green (active), yellow (idle), gray (ended)
  ------------------------------------------------------------------ */
  function sessionStatus(session) {
    const dur = session.duration || 0;
    const eventRate = session.event_count ? session.event_count / Math.max(dur, 1) : 0;
    if (eventRate > 0.1) return 'active';
    if (dur > IDLE_THRESHOLD && eventRate <= 0.1) return 'idle';
    return 'active'; // default to active for live sessions
  }

  function statusColor(status) {
    switch (status) {
      case 'active': return THEME.accent;
      case 'idle': return THEME.yellow;
      case 'ended': return '#6b7280';
      default: return THEME.accent;
    }
  }

  function statusLabel(status) {
    switch (status) {
      case 'active': return 'Active';
      case 'idle': return 'Idle';
      case 'ended': return 'Ended';
      default: return 'Active';
    }
  }

  /* ------------------------------------------------------------------
     Format short URL for display
  ------------------------------------------------------------------ */
  function shortUrl(url, maxLen) {
    if (!url) return '/';
    const max = maxLen || 40;
    try {
      const u = new URL(url, 'https://placeholder.com');
      const path = u.pathname + u.search;
      return path.length > max ? path.substring(0, max) + '...' : path;
    } catch (e) {
      return url.length > max ? url.substring(0, max) + '...' : url;
    }
  }

  /* ------------------------------------------------------------------
     Build the CSS styles (injected into the page)
  ------------------------------------------------------------------ */
  function buildStyles() {
    return `
      <style id="live-page-styles">
        .live-page-root {
          background: ${THEME.bg};
          min-height: 100vh;
          margin: -1.5rem;
          padding: 1.5rem;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          color: ${THEME.text};
        }

        /* --- Pulsing green dot --- */
        @keyframes livePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0, 200, 83, 0.5); }
          50% { box-shadow: 0 0 0 8px rgba(0, 200, 83, 0); }
        }
        .live-pulse-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: ${THEME.accent};
          animation: livePulse 2s ease-in-out infinite;
          display: inline-block;
          flex-shrink: 0;
        }
        .live-pulse-dot-sm {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: ${THEME.accent};
          animation: livePulse 2s ease-in-out infinite;
          display: inline-block;
          flex-shrink: 0;
        }

        /* --- Counter animation --- */
        @keyframes counterPop {
          0% { transform: scale(1); }
          50% { transform: scale(1.08); }
          100% { transform: scale(1); }
        }
        .live-counter-pop {
          animation: counterPop 0.4s ease-out;
        }

        /* --- Slide in for new sessions --- */
        @keyframes liveSlideIn {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .live-slide-in {
          animation: liveSlideIn 0.4s ease-out both;
        }

        /* --- Fade out for ended sessions --- */
        @keyframes liveFadeOut {
          from { opacity: 1; transform: scale(1); }
          to { opacity: 0; transform: scale(0.95); }
        }
        .live-fade-out {
          animation: liveFadeOut 0.5s ease-in both;
        }

        /* --- Fade in generic --- */
        @keyframes liveFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .live-fade-in {
          animation: liveFadeIn 0.3s ease-out both;
        }

        /* --- Card styles --- */
        .live-card {
          background: ${THEME.card};
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .live-card:hover {
          border-color: rgba(255, 255, 255, 0.12);
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
        }

        /* --- Session card status borders --- */
        .live-session-card {
          position: relative;
          overflow: hidden;
        }
        .live-session-card::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
          border-radius: 3px 0 0 3px;
        }
        .live-session-card.status-active::before { background: ${THEME.accent}; }
        .live-session-card.status-idle::before { background: ${THEME.yellow}; }
        .live-session-card.status-ended::before { background: #6b7280; }

        /* --- Avatar --- */
        .live-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 700;
          color: white;
          flex-shrink: 0;
          letter-spacing: 0.5px;
        }

        /* --- Icon sizes --- */
        .live-icon-sm {
          width: 14px;
          height: 14px;
          flex-shrink: 0;
        }

        /* --- Stats bar cards --- */
        .live-stat-card {
          background: ${THEME.card};
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 16px 20px;
          text-align: center;
        }
        .live-stat-value {
          font-size: 24px;
          font-weight: 700;
          line-height: 1.2;
          margin-bottom: 4px;
        }
        .live-stat-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: ${THEME.textMuted};
        }

        /* --- Badge styles --- */
        .live-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 600;
          line-height: 1.4;
        }
        .live-badge-green {
          background: rgba(0, 200, 83, 0.15);
          color: ${THEME.accent};
          border: 1px solid rgba(0, 200, 83, 0.25);
        }
        .live-badge-red {
          background: rgba(255, 23, 68, 0.15);
          color: ${THEME.red};
          border: 1px solid rgba(255, 23, 68, 0.25);
        }
        .live-badge-yellow {
          background: rgba(255, 214, 0, 0.15);
          color: ${THEME.yellow};
          border: 1px solid rgba(255, 214, 0, 0.25);
        }

        /* --- World map --- */
        .live-map-container {
          position: relative;
          background: rgba(10, 10, 26, 0.6);
          border-radius: 12px;
          overflow: hidden;
          height: 220px;
        }
        .live-map-dot {
          position: absolute;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          transition: all 0.3s;
        }
        .live-map-dot.target-market {
          background: ${THEME.accent};
          box-shadow: 0 0 12px rgba(0, 200, 83, 0.6);
        }
        .live-map-dot.other-market {
          background: ${THEME.blue};
          box-shadow: 0 0 8px rgba(67, 97, 238, 0.5);
        }
        @keyframes mapDotPing {
          0% { box-shadow: 0 0 0 0 rgba(0, 200, 83, 0.6); }
          70% { box-shadow: 0 0 0 12px rgba(0, 200, 83, 0); }
          100% { box-shadow: 0 0 0 0 rgba(0, 200, 83, 0); }
        }
        .live-map-dot.pinging {
          animation: mapDotPing 2s ease-out infinite;
        }

        /* --- Page ticker --- */
        .live-ticker {
          background: rgba(22, 33, 62, 0.9);
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          padding: 10px 0;
          overflow: hidden;
          position: relative;
        }
        .live-ticker-track {
          display: flex;
          gap: 32px;
          animation: tickerScroll var(--ticker-duration, 30s) linear infinite;
          white-space: nowrap;
        }
        @keyframes tickerScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .live-ticker-item {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: ${THEME.textMuted};
          flex-shrink: 0;
        }
        .live-ticker-count {
          background: rgba(0, 200, 83, 0.15);
          color: ${THEME.accent};
          padding: 1px 6px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
        }

        /* --- Last updated indicator --- */
        .live-last-updated {
          font-size: 11px;
          color: ${THEME.textDim};
          display: flex;
          align-items: center;
          gap: 6px;
        }

        /* --- Watch button --- */
        .live-watch-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          color: ${THEME.accent};
          background: rgba(0, 200, 83, 0.1);
          border: 1px solid rgba(0, 200, 83, 0.2);
          cursor: pointer;
          transition: all 0.15s;
          text-decoration: none;
        }
        .live-watch-btn:hover {
          background: rgba(0, 200, 83, 0.2);
          border-color: rgba(0, 200, 83, 0.4);
          color: ${THEME.activePulse};
        }

        /* --- Stagger delay classes --- */
        .live-stagger-1 { animation-delay: 0.05s; }
        .live-stagger-2 { animation-delay: 0.1s; }
        .live-stagger-3 { animation-delay: 0.15s; }
        .live-stagger-4 { animation-delay: 0.2s; }
        .live-stagger-5 { animation-delay: 0.25s; }
        .live-stagger-6 { animation-delay: 0.3s; }

        /* --- Country chip --- */
        .live-country-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          font-size: 13px;
        }
        .live-country-chip .count {
          font-weight: 600;
          color: ${THEME.text};
        }
        .live-country-chip .label {
          color: ${THEME.textMuted};
          font-size: 11px;
        }
      </style>`;
  }

  /* ------------------------------------------------------------------
     Country approximate map coordinates (percentage-based)
     Used for the simple world map representation
  ------------------------------------------------------------------ */
  const COUNTRY_COORDS = {
    CZ: { x: 52, y: 28 }, SK: { x: 54, y: 29 }, HU: { x: 54, y: 31 },
    PL: { x: 53, y: 26 }, DE: { x: 50, y: 27 }, AT: { x: 51, y: 30 },
    US: { x: 22, y: 32 }, CA: { x: 20, y: 24 }, GB: { x: 47, y: 25 },
    FR: { x: 48, y: 30 }, ES: { x: 46, y: 34 }, IT: { x: 51, y: 32 },
    NL: { x: 49, y: 26 }, BE: { x: 49, y: 27 }, RO: { x: 55, y: 30 },
    UA: { x: 57, y: 27 }, RU: { x: 65, y: 22 }, SE: { x: 52, y: 20 },
    NO: { x: 50, y: 19 }, FI: { x: 55, y: 19 }, DK: { x: 50, y: 24 },
    CH: { x: 50, y: 29 }, PT: { x: 44, y: 34 }, GR: { x: 54, y: 34 },
    TR: { x: 59, y: 33 }, JP: { x: 83, y: 32 }, CN: { x: 76, y: 32 },
    IN: { x: 72, y: 38 }, AU: { x: 82, y: 58 }, BR: { x: 32, y: 52 },
    MX: { x: 18, y: 38 }, AR: { x: 30, y: 60 }, KR: { x: 81, y: 32 },
    IL: { x: 59, y: 35 }, ZA: { x: 55, y: 60 }, EG: { x: 57, y: 37 },
    NG: { x: 50, y: 42 }, KE: { x: 59, y: 47 }, SG: { x: 76, y: 46 },
    TH: { x: 76, y: 40 }, VN: { x: 77, y: 39 }, PH: { x: 80, y: 40 },
    ID: { x: 78, y: 48 }, NZ: { x: 88, y: 62 }, CL: { x: 28, y: 58 },
    CO: { x: 26, y: 44 }, PE: { x: 25, y: 50 },
  };

  /* ------------------------------------------------------------------
     Build world map HTML
  ------------------------------------------------------------------ */
  function buildWorldMap(countryBreakdown) {
    if (!countryBreakdown || Object.keys(countryBreakdown).length === 0) {
      return `
        <div class="live-card live-map-container" style="display:flex;align-items:center;justify-content:center;">
          <div style="text-align:center;color:${THEME.textDim};">
            <svg style="width:32px;height:32px;margin:0 auto 8px;opacity:0.4;" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"/>
            </svg>
            <div style="font-size:12px;">No visitor locations yet</div>
          </div>
        </div>`;
    }

    const totalVisitors = Object.values(countryBreakdown).reduce((a, b) => a + b, 0);
    const dots = Object.entries(countryBreakdown).map(([code, count]) => {
      const coords = COUNTRY_COORDS[code.toUpperCase()];
      if (!coords) return '';
      const isTarget = TARGET_MARKETS.includes(code.toUpperCase());
      const size = Math.min(6 + Math.floor(count / totalVisitors * 30), 18);
      const pingClass = isTarget ? 'pinging' : '';
      const marketClass = isTarget ? 'target-market' : 'other-market';
      return `<div class="live-map-dot ${marketClass} ${pingClass}"
                   style="left:${coords.x}%;top:${coords.y}%;width:${size}px;height:${size}px;"
                   title="${countryFlag(code)} ${code}: ${count} visitor${count !== 1 ? 's' : ''}"></div>`;
    }).join('');

    // Simple continent outlines drawn as SVG paths for context
    return `
      <div class="live-card live-map-container">
        <svg viewBox="0 0 200 100" style="position:absolute;inset:0;width:100%;height:100%;opacity:0.08;" preserveAspectRatio="xMidYMid meet">
          <!-- Simplified continent outlines -->
          <path d="M38 18 L48 16 L50 22 L44 28 L36 30 L32 24 Z" fill="${THEME.text}" opacity="0.5"/>
          <path d="M20 28 L38 26 L42 32 L40 42 L28 48 L18 38 Z" fill="${THEME.text}" opacity="0.4"/>
          <path d="M86 22 L110 18 L120 24 L116 38 L98 44 L84 34 Z" fill="${THEME.text}" opacity="0.4"/>
          <path d="M92 26 L100 24 L108 28 L106 36 L96 38 L90 32 Z" fill="${THEME.text}" opacity="0.5"/>
          <path d="M58 30 L72 28 L78 36 L70 46 L56 42 L52 34 Z" fill="${THEME.text}" opacity="0.4"/>
          <path d="M130 38 L144 34 L152 42 L146 52 L134 50 L128 44 Z" fill="${THEME.text}" opacity="0.4"/>
          <path d="M150 50 L170 44 L178 52 L172 64 L154 62 L148 56 Z" fill="${THEME.text}" opacity="0.35"/>
          <path d="M48 34 L60 32 L66 42 L60 54 L48 52 L44 42 Z" fill="${THEME.text}" opacity="0.35"/>
          <path d="M28 44 L38 42 L40 56 L32 68 L24 62 L22 50 Z" fill="${THEME.text}" opacity="0.3"/>
        </svg>
        <!-- Target market region highlight -->
        <div style="position:absolute;left:49%;top:24%;width:14%;height:16%;border:2px dashed rgba(0,200,83,0.2);border-radius:50%;pointer-events:none;"></div>
        <div style="position:absolute;left:52%;top:18%;font-size:9px;color:${THEME.accent};opacity:0.5;letter-spacing:0.05em;">CZ/SK/HU</div>
        ${dots}
      </div>`;
  }

  /* ------------------------------------------------------------------
     Build session card HTML
  ------------------------------------------------------------------ */
  function buildSessionCard(session, isNew) {
    const name = session.identified_user_name || session.identified_user_email || null;
    const displayName = name || session.visitor_id || 'Anonymous';
    const truncatedName = displayName.length > 22 ? displayName.substring(0, 22) + '...' : displayName;
    const pageUrl = shortUrl(session.url, 35);
    const flag = countryFlag(session.country);
    const pages = session.page_count || 1;
    const events = session.event_count || 0;
    const browser = browserIcon(session.browser);
    const status = sessionStatus(session);
    const animClass = isNew ? 'live-slide-in' : 'live-fade-in';

    const rageHtml = session.has_rage_clicks
      ? `<span class="live-badge live-badge-yellow" title="Rage clicks detected">
           <svg style="width:10px;height:10px;" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672z"/></svg>
           Rage
         </span>`
      : '';

    const errorHtml = session.has_errors
      ? `<span class="live-badge live-badge-red" title="JS errors detected">
           <svg style="width:10px;height:10px;" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"/></svg>
           Error
         </span>`
      : '';

    const identifiedHtml = name
      ? `<div style="font-size:11px;color:${THEME.textDim};margin-top:1px;">
           <svg style="width:10px;height:10px;display:inline;vertical-align:-1px;margin-right:2px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0"/></svg>
           ${session.identified_user_email || 'identified'}
         </div>`
      : '';

    return `
      <div class="live-card live-session-card status-${status} ${animClass}"
           data-session-id="${session.id}"
           style="padding:14px 16px;cursor:pointer;"
           onclick="App.navigate('sessions/${session.id}')">
        <div style="display:flex;align-items:flex-start;gap:12px;">
          <!-- Avatar with status dot -->
          <div style="position:relative;flex-shrink:0;">
            ${visitorAvatar(session.visitor_id, name)}
            <div style="position:absolute;bottom:-1px;right:-1px;width:12px;height:12px;border-radius:50%;background:${statusColor(status)};border:2px solid ${THEME.card};"></div>
          </div>

          <!-- Main info -->
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
              <span style="font-size:13px;font-weight:600;color:${THEME.text};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;">${truncatedName}</span>
              ${flag ? `<span style="font-size:14px;line-height:1;">${flag}</span>` : ''}
            </div>
            <div style="font-size:12px;color:${THEME.textMuted};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:6px;" title="${session.url || '/'}">${pageUrl}</div>
            ${identifiedHtml}
            <div style="display:flex;align-items:center;gap:10px;font-size:11px;color:${THEME.textDim};margin-top:6px;">
              <span style="display:flex;align-items:center;gap:3px;" title="${session.device_type || 'Desktop'}">${deviceIcon(session.device_type)}</span>
              <span>${browser}</span>
              <span style="color:${THEME.textDim};">${session.os || ''}</span>
              <span style="display:flex;align-items:center;gap:3px;">
                <svg class="live-icon-sm" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>
                ${pages} pg
              </span>
              <span style="display:flex;align-items:center;gap:3px;">
                <svg class="live-icon-sm" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>
                ${events} ev
              </span>
            </div>
          </div>

          <!-- Right side: duration + badges + watch button -->
          <div style="flex-shrink:0;text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
            <div class="live-duration-ticker" data-started="${session.started_at}"
                 style="font-size:13px;font-weight:600;color:${THEME.accent};font-variant-numeric:tabular-nums;">
              ${liveDuration(session.started_at)}
            </div>
            <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;">
              ${rageHtml}
              ${errorHtml}
            </div>
            <a class="live-watch-btn" href="#sessions/${session.id}" onclick="event.stopPropagation();">
              <svg style="width:12px;height:12px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"/></svg>
              Watch
            </a>
          </div>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------
     Build stats bar HTML
  ------------------------------------------------------------------ */
  function buildStatsBar(stats) {
    const active = stats.active_count || 0;
    const pages = stats.unique_pages || 0;
    const avgDur = App.formatDuration(stats.avg_duration || 0);
    const epm = stats.events_per_minute || 0;

    const countryBreakdown = stats.country_breakdown || {};
    const countryChips = Object.entries(countryBreakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([code, count]) => {
        const isTarget = TARGET_MARKETS.includes(code.toUpperCase());
        const borderStyle = isTarget ? `border-color:rgba(0,200,83,0.2);` : '';
        return `<span class="live-country-chip" style="${borderStyle}">
          <span>${countryFlag(code)}</span>
          <span class="count">${count}</span>
          <span class="label">${code}</span>
        </span>`;
      }).join('');

    return `
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:12px;margin-bottom:20px;">
        <div class="live-stat-card">
          <div class="live-stat-value" style="color:${THEME.accent};" id="live-stat-active">${active}</div>
          <div class="live-stat-label">Active Visitors</div>
        </div>
        <div class="live-stat-card">
          <div class="live-stat-value" style="color:${THEME.blue};" id="live-stat-pages">${pages}</div>
          <div class="live-stat-label">Unique Pages</div>
        </div>
        <div class="live-stat-card">
          <div class="live-stat-value" style="color:#a78bfa;" id="live-stat-duration">${avgDur}</div>
          <div class="live-stat-label">Avg Duration</div>
        </div>
        <div class="live-stat-card">
          <div class="live-stat-value" style="color:#fb923c;" id="live-stat-epm">${epm}</div>
          <div class="live-stat-label">Events / min</div>
        </div>
      </div>
      ${countryChips ? `
        <div style="margin-bottom:20px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <svg style="width:14px;height:14px;color:${THEME.textDim};" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/>
            </svg>
            <span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:${THEME.textDim};">Visitor Locations</span>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;" id="live-country-chips">
            ${countryChips}
          </div>
        </div>` : ''}`;
  }

  /* ------------------------------------------------------------------
     Build page ticker HTML
  ------------------------------------------------------------------ */
  function buildPageTicker(sessions) {
    if (!sessions || sessions.length === 0) return '';

    // Count visitors per page URL
    const pageCounts = {};
    sessions.forEach(s => {
      const url = shortUrl(s.url, 50);
      pageCounts[url] = (pageCounts[url] || 0) + 1;
    });

    const items = Object.entries(pageCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([url, count]) => `
        <span class="live-ticker-item">
          <span class="live-ticker-count">${count}</span>
          <span>${url}</span>
        </span>
      `).join('');

    // Duplicate items for seamless scroll
    const tickerContent = items + items;
    const itemCount = Object.keys(pageCounts).length;
    const duration = Math.max(itemCount * 5, 20);

    return `
      <div class="live-ticker" id="live-page-ticker">
        <div style="display:flex;align-items:center;gap:8px;padding:0 16px;margin-bottom:6px;">
          <svg style="width:12px;height:12px;color:${THEME.textDim};" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"/>
          </svg>
          <span style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:${THEME.textDim};">Pages Being Viewed Now</span>
        </div>
        <div class="live-ticker-track" style="--ticker-duration:${duration}s;">
          ${tickerContent}
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------
     Render the full page shell
  ------------------------------------------------------------------ */
  function renderPageShell(container) {
    const emptyStats = { active_count: 0, unique_pages: 0, avg_duration: 0, events_per_minute: 0, country_breakdown: {} };

    container.innerHTML = `
      ${buildStyles()}
      <div class="live-page-root">

        <!-- Live Counter Header -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">
          <div style="display:flex;align-items:center;gap:16px;">
            <div style="display:flex;align-items:baseline;gap:12px;">
              <span id="live-hero-count" style="font-size:48px;font-weight:800;color:${THEME.text};line-height:1;font-variant-numeric:tabular-nums;">0</span>
              <span style="font-size:16px;color:${THEME.textMuted};font-weight:500;">active visitor${currentData && currentData.count !== 1 ? 's' : ''}</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="live-pulse-dot"></span>
              <span class="live-badge live-badge-green" style="font-size:12px;font-weight:700;letter-spacing:0.04em;">LIVE</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:16px;">
            <div class="live-last-updated" id="live-last-updated">
              <svg style="width:12px;height:12px;opacity:0.5;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span id="live-last-updated-text">Updating...</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:${THEME.textDim};">
              <svg style="width:14px;height:14px;animation:spin 3s linear infinite;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.182-3.182"/>
              </svg>
              <span>Auto-refresh 5s</span>
            </div>
          </div>
        </div>

        <!-- Stats Bar -->
        <div id="live-stats-bar">
          ${buildStatsBar(emptyStats)}
        </div>

        <!-- Main content grid: Sessions + Map -->
        <div style="display:grid;grid-template-columns:1fr 320px;gap:20px;margin-bottom:20px;" id="live-main-grid">
          <!-- Sessions Feed -->
          <div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
              <div style="display:flex;align-items:center;gap:8px;">
                <h3 style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:${THEME.textMuted};">Active Sessions</h3>
                <span id="live-sessions-count" style="font-size:11px;color:${THEME.textDim};">0 sessions</span>
              </div>
            </div>
            <div id="live-sessions-feed" style="display:flex;flex-direction:column;gap:8px;">
              <div style="text-align:center;padding:48px 0;color:${THEME.textDim};">
                <div style="position:relative;width:32px;height:32px;margin:0 auto 12px;">
                  <div style="position:absolute;inset:0;border-radius:50%;border:2px solid rgba(255,255,255,0.05);"></div>
                  <div style="position:absolute;inset:0;border-radius:50%;border:2px solid transparent;border-top-color:${THEME.accent};animation:spin 1s linear infinite;"></div>
                </div>
                <div style="font-size:13px;">Loading live sessions...</div>
              </div>
            </div>
          </div>

          <!-- Right sidebar: World Map -->
          <div>
            <div style="margin-bottom:12px;">
              <h3 style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:${THEME.textMuted};">Visitor Map</h3>
            </div>
            <div id="live-world-map">
              ${buildWorldMap(null)}
            </div>
          </div>
        </div>

        <!-- Page Ticker -->
        <div id="live-ticker-container"></div>

      </div>

      <style>
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      </style>`;
  }

  /* ------------------------------------------------------------------
     Update sessions feed with diff detection
  ------------------------------------------------------------------ */
  function updateSessionsFeed(sessions) {
    const feed = document.getElementById('live-sessions-feed');
    if (!feed) return;

    if (!sessions || sessions.length === 0) {
      feed.innerHTML = `
        <div style="text-align:center;padding:48px 0;color:${THEME.textDim};">
          <svg style="width:48px;height:48px;margin:0 auto 12px;opacity:0.3;" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"/>
          </svg>
          <h3 style="font-size:15px;font-weight:600;color:${THEME.textMuted};margin-bottom:4px;">No Active Sessions</h3>
          <p style="font-size:12px;color:${THEME.textDim};max-width:280px;margin:0 auto;">Sessions will appear here when visitors are browsing your site.</p>
        </div>`;
      previousSessionIds = new Set();
      previousSessions = [];
      return;
    }

    const currentIds = new Set(sessions.map(s => s.id));
    const newIds = new Set();
    sessions.forEach(s => {
      if (!previousSessionIds.has(s.id)) newIds.add(s.id);
    });

    // Detect ended sessions (were in previous, not in current)
    const endedIds = new Set();
    previousSessionIds.forEach(id => {
      if (!currentIds.has(id)) endedIds.add(id);
    });

    // If there are ended sessions, fade them out before removing
    if (endedIds.size > 0) {
      endedIds.forEach(id => {
        const card = feed.querySelector(`[data-session-id="${id}"]`);
        if (card) {
          card.classList.add('live-fade-out');
        }
      });
    }

    // Rebuild the feed after a short delay if there are endings, otherwise immediately
    const rebuildDelay = endedIds.size > 0 ? 400 : 0;

    setTimeout(() => {
      if (!isActive) return;
      feed.innerHTML = sessions.map((s, i) => {
        const isNew = newIds.has(s.id);
        return buildSessionCard(s, isNew);
      }).join('');
      previousSessionIds = currentIds;
      previousSessions = [...sessions];
    }, rebuildDelay);
  }

  /* ------------------------------------------------------------------
     Update hero counter with animation
  ------------------------------------------------------------------ */
  function updateHeroCount(count) {
    const el = document.getElementById('live-hero-count');
    if (!el) return;
    const prev = parseInt(el.textContent, 10) || 0;
    if (count !== prev) {
      el.textContent = count;
      el.classList.remove('live-counter-pop');
      void el.offsetWidth; // force reflow to restart animation
      el.classList.add('live-counter-pop');
    }
  }

  /* ------------------------------------------------------------------
     Update "last updated X seconds ago" indicator
  ------------------------------------------------------------------ */
  function updateLastUpdatedIndicator() {
    const el = document.getElementById('live-last-updated-text');
    if (!el || !lastFetchTime) return;
    const diffSec = Math.floor((Date.now() - lastFetchTime) / 1000);
    if (diffSec < 2) {
      el.textContent = 'Just updated';
    } else {
      el.textContent = `Updated ${diffSec}s ago`;
    }
  }

  /* ------------------------------------------------------------------
     Update all live duration tickers (every second)
  ------------------------------------------------------------------ */
  function startDurationTicker() {
    if (durationTimer) clearInterval(durationTimer);
    durationTimer = setInterval(() => {
      if (!isActive) return;
      const els = document.querySelectorAll('.live-duration-ticker');
      els.forEach(el => {
        const started = el.getAttribute('data-started');
        if (started) {
          el.textContent = liveDuration(started);
        }
      });
    }, 1000);
  }

  /* ------------------------------------------------------------------
     Start the "last updated" indicator timer
  ------------------------------------------------------------------ */
  function startLastUpdatedTimer() {
    if (lastUpdatedTimer) clearInterval(lastUpdatedTimer);
    lastUpdatedTimer = setInterval(() => {
      if (!isActive) return;
      updateLastUpdatedIndicator();
    }, 1000);
  }

  /* ------------------------------------------------------------------
     Fetch live data from the API and update the UI
  ------------------------------------------------------------------ */
  async function fetchAndUpdate() {
    if (!isActive) return;

    try {
      const projectParam = App.state.project ? `?project_id=${App.state.project}` : '';
      const data = await App.api(`/dashboard/live${projectParam}`);

      if (!isActive) return; // Check again after async call

      currentData = data;
      lastFetchTime = Date.now();

      const sessions = data.active_sessions || [];
      const stats = data.stats || {};
      const count = data.count || 0;

      // Update hero counter
      updateHeroCount(count);

      // Update count badge
      const countEl = document.getElementById('live-sessions-count');
      if (countEl) {
        countEl.textContent = `${sessions.length} session${sessions.length !== 1 ? 's' : ''}`;
      }

      // Update stats bar
      const statsBarEl = document.getElementById('live-stats-bar');
      if (statsBarEl) {
        statsBarEl.innerHTML = buildStatsBar(stats);
      }

      // Update sessions feed
      updateSessionsFeed(sessions);

      // Update world map
      const mapEl = document.getElementById('live-world-map');
      if (mapEl) {
        mapEl.innerHTML = buildWorldMap(stats.country_breakdown || {});
      }

      // Update page ticker
      const tickerContainer = document.getElementById('live-ticker-container');
      if (tickerContainer) {
        tickerContainer.innerHTML = buildPageTicker(sessions);
      }

      // Update "last updated" text
      updateLastUpdatedIndicator();

    } catch (err) {
      console.warn('[LivePage] Fetch error:', err.message);
      // Keep polling on error; don't tear down the UI
    }
  }

  /* ------------------------------------------------------------------
     Polling: start / stop
  ------------------------------------------------------------------ */
  function startPolling() {
    stopPolling();
    pollTimer = setInterval(fetchAndUpdate, POLL_INTERVAL);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  /* ------------------------------------------------------------------
     render(container) - Main entry point
  ------------------------------------------------------------------ */
  async function render(container) {
    containerEl = container || document.getElementById('main-content');
    if (!containerEl) return;

    isActive = true;
    previousSessions = [];
    previousSessionIds = new Set();
    lastFetchTime = null;
    currentData = null;

    renderPageShell(containerEl);
    startDurationTicker();
    startLastUpdatedTimer();

    // Initial data fetch
    await fetchAndUpdate();

    // Start auto-refresh polling
    startPolling();
  }

  /* ------------------------------------------------------------------
     init(container) - Alias for render, matches project pattern
  ------------------------------------------------------------------ */
  async function init(container) {
    await render(container);
  }

  /* ------------------------------------------------------------------
     destroy() - Cleanup all timers and state
  ------------------------------------------------------------------ */
  function destroy() {
    isActive = false;
    stopPolling();

    if (durationTimer) {
      clearInterval(durationTimer);
      durationTimer = null;
    }
    if (tickerTimer) {
      clearInterval(tickerTimer);
      tickerTimer = null;
    }
    if (lastUpdatedTimer) {
      clearInterval(lastUpdatedTimer);
      lastUpdatedTimer = null;
    }

    previousSessions = [];
    previousSessionIds = new Set();
    lastFetchTime = null;
    currentData = null;
    containerEl = null;
  }

  /* ------------------------------------------------------------------
     Public API
  ------------------------------------------------------------------ */
  return {
    init,
    render,
    destroy,
  };

})();

/* Global render function for route registration */
function renderLivePage(container) {
  window.LivePage.init(container);
}
