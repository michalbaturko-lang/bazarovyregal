'use strict';

/**
 * SessionDetailPage - Integrates the SessionPlayer with the application.
 *
 * Fetches session data and events from the API, initialises the player,
 * renders the full page layout, and wires up keyboard shortcuts.
 *
 * Usage:
 *   const page = new SessionDetailPage({
 *     containerId: 'session-player',   // DOM element id to mount into
 *     sessionId:   '<uuid>',           // Session id (or pulled from URL)
 *     apiBase:     '/api',             // Base URL for API calls
 *   });
 *   page.init();
 */

// ─── Page Styles ──────────────────────────────────────────────────────────────

const PAGE_STYLES = `
  /* ── Root page layout ────────────────────────────────── */
  .sdp-root {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100vh;
    background: #0a0c10;
    color: #e2e8f0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    overflow: hidden;
  }

  /* ── Top nav bar ─────────────────────────────────────── */
  .sdp-nav {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 20px;
    height: 48px;
    background: #0f1117;
    border-bottom: 1px solid #1e2130;
    flex-shrink: 0;
    z-index: 10;
  }

  .sdp-back-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    font-size: 13px;
    color: #94a3b8;
    background: transparent;
    border: 1px solid #2a2d3e;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
    text-decoration: none;
    font-family: inherit;
  }

  .sdp-back-btn:hover {
    background: #1c1f2e;
    color: #e2e8f0;
    border-color: #3b82f6;
  }

  .sdp-back-btn svg {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .sdp-nav-title {
    font-size: 14px;
    font-weight: 600;
    color: #e2e8f0;
  }

  .sdp-nav-session-id {
    font-size: 12px;
    color: #64748b;
    font-family: 'SFMono-Regular', 'Consolas', 'Liberation Mono', monospace;
  }

  .sdp-nav-spacer {
    flex: 1;
  }

  .sdp-nav-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 12px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .sdp-nav-badge--rage {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .sdp-nav-badge--error {
    background: rgba(249, 115, 22, 0.15);
    color: #f59e0b;
    border: 1px solid rgba(249, 115, 22, 0.3);
  }

  .sdp-keyboard-hint {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: #64748b;
  }

  .sdp-kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 5px;
    font-size: 10px;
    font-family: 'SFMono-Regular', 'Consolas', monospace;
    color: #94a3b8;
    background: #1c1f2e;
    border: 1px solid #2a2d3e;
    border-radius: 3px;
  }

  /* ── Share button ────────────────────────────────────── */
  .sdp-share-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    font-size: 13px;
    color: #94a3b8;
    background: transparent;
    border: 1px solid #2a2d3e;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
  }

  .sdp-share-btn:hover {
    background: #1c1f2e;
    color: #e2e8f0;
    border-color: #3b82f6;
  }

  .sdp-share-btn svg {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* ── Toast notification ──────────────────────────────── */
  .sdp-toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%) translateY(80px);
    padding: 10px 20px;
    background: #1e293b;
    color: #e2e8f0;
    border: 1px solid #334155;
    border-radius: 8px;
    font-size: 13px;
    font-family: inherit;
    z-index: 9999;
    opacity: 0;
    transition: all 0.3s ease;
    pointer-events: none;
  }

  .sdp-toast--visible {
    transform: translateX(-50%) translateY(0);
    opacity: 1;
  }

  /* ── Player container ────────────────────────────────── */
  .sdp-player-container {
    flex: 1;
    min-height: 0;
    padding: 0;
  }

  /* ── Notes section ───────────────────────────────────── */
  .sdp-notes-section {
    background: #0f1117;
    border-top: 1px solid #1e2130;
    padding: 16px 20px;
    max-height: 260px;
    overflow-y: auto;
    flex-shrink: 0;
  }

  .sdp-notes-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .sdp-notes-title {
    font-size: 13px;
    font-weight: 600;
    color: #e2e8f0;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .sdp-notes-title svg {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .sdp-notes-count {
    font-size: 11px;
    color: #64748b;
    background: #1c1f2e;
    padding: 1px 8px;
    border-radius: 10px;
  }

  .sdp-notes-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 12px;
  }

  .sdp-note-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 8px 12px;
    background: #1c1f2e;
    border-radius: 6px;
    border: 1px solid #2a2d3e;
  }

  .sdp-note-content {
    flex: 1;
    font-size: 13px;
    color: #cbd5e1;
    line-height: 1.4;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .sdp-note-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
    font-size: 11px;
    color: #64748b;
  }

  .sdp-note-delete {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
    padding: 0;
  }

  .sdp-note-delete:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }

  .sdp-note-delete svg {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .sdp-notes-empty {
    font-size: 12px;
    color: #475569;
    text-align: center;
    padding: 8px 0;
  }

  .sdp-note-form {
    display: flex;
    gap: 8px;
  }

  .sdp-note-input {
    flex: 1;
    padding: 8px 12px;
    font-size: 13px;
    color: #e2e8f0;
    background: #1c1f2e;
    border: 1px solid #2a2d3e;
    border-radius: 6px;
    outline: none;
    font-family: inherit;
    transition: border-color 0.15s;
  }

  .sdp-note-input:focus {
    border-color: #3b82f6;
  }

  .sdp-note-input::placeholder {
    color: #475569;
  }

  .sdp-note-submit {
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 500;
    color: #fff;
    background: #3b82f6;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s;
    font-family: inherit;
    white-space: nowrap;
  }

  .sdp-note-submit:hover {
    background: #2563eb;
  }

  .sdp-note-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ── Loading state ───────────────────────────────────── */
  .sdp-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 16px;
    color: #64748b;
  }

  .sdp-loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #1c1f2e;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: sdp-spin 0.8s linear infinite;
  }

  @keyframes sdp-spin {
    to { transform: rotate(360deg); }
  }

  .sdp-loading-text {
    font-size: 14px;
  }

  .sdp-loading-subtext {
    font-size: 12px;
    color: #475569;
  }

  /* ── Error state ─────────────────────────────────────── */
  .sdp-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 12px;
    color: #64748b;
  }

  .sdp-error-icon {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: rgba(239, 68, 68, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .sdp-error-icon svg {
    width: 24px;
    height: 24px;
    fill: #ef4444;
  }

  .sdp-error-title {
    font-size: 16px;
    font-weight: 600;
    color: #e2e8f0;
  }

  .sdp-error-message {
    font-size: 13px;
    color: #94a3b8;
    max-width: 400px;
    text-align: center;
  }

  .sdp-retry-btn {
    margin-top: 8px;
    padding: 8px 20px;
    font-size: 13px;
    font-weight: 500;
    color: #fff;
    background: #3b82f6;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s;
    font-family: inherit;
  }

  .sdp-retry-btn:hover {
    background: #2563eb;
  }
`;

// ─── SessionDetailPage Class ──────────────────────────────────────────────────

class SessionDetailPage {
  /**
   * @param {Object} options
   * @param {string} options.containerId  - DOM id of container element
   * @param {string} options.sessionId    - Session UUID (optional, auto-detected from URL)
   * @param {string} options.apiBase      - API base path (default '/api')
   * @param {string} options.sessionsListUrl - URL to navigate back to (default '/sessions')
   */
  constructor(options = {}) {
    this.containerId = options.containerId || 'session-player';
    this.sessionId = options.sessionId || this._extractSessionIdFromUrl();
    this.apiBase = options.apiBase || '/api';
    this.sessionsListUrl = options.sessionsListUrl || '/sessions';

    this.container = null;
    this.player = null;
    this._session = null;
    this._events = [];
    this._notes = [];
    this._keyHandler = null;
  }

  // ─── Public API ──────────────────────────────────────────

  async init() {
    this.container = document.getElementById(this.containerId);
    if (!this.container) {
      console.error('[SessionDetailPage] Container element #' + this.containerId + ' not found.');
      return;
    }

    this._injectStyles();
    this._renderShell();

    if (!this.sessionId) {
      this._renderError('No session ID', 'Could not determine the session ID from the URL. Please navigate to a valid session URL.');
      return;
    }

    this._renderLoading();

    try {
      const data = await this._fetchSession(this.sessionId);
      this._session = data.session || data;
      this._events = data.events || [];

      if (!this._events.length) {
        this._renderError('No events', 'This session has no recorded events to replay.');
        return;
      }

      this._renderPlayer();
      this._bindKeyboard();
    } catch (err) {
      console.error('[SessionDetailPage] Failed to load session:', err);
      this._renderError('Failed to load session', err.message || 'An unexpected error occurred while loading the session data.');
    }
  }

  destroy() {
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
    if (this._styleEl && this._styleEl.parentNode) {
      this._styleEl.parentNode.removeChild(this._styleEl);
    }
  }

  // ─── Data Fetching ───────────────────────────────────────

  async _fetchSession(sessionId) {
    const url = this.apiBase + '/sessions/' + encodeURIComponent(sessionId);
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Session not found. It may have been deleted or the ID is invalid.');
      }
      throw new Error('Server responded with status ' + response.status + '.');
    }

    const data = await response.json();
    return data;
  }

  _extractSessionIdFromUrl() {
    // Try URL patterns:
    //   /sessions/:id
    //   /session/:id
    //   ?session=:id
    //   ?id=:id
    const pathname = window.location.pathname;
    const patterns = [
      /\/sessions?\/([\w-]+)/,
      /\/replay\/([\w-]+)/,
    ];

    for (const pattern of patterns) {
      const match = pathname.match(pattern);
      if (match) return match[1];
    }

    // Check query params
    const params = new URLSearchParams(window.location.search);
    return params.get('session') || params.get('id') || params.get('sessionId') || null;
  }

  // ─── Style Injection ─────────────────────────────────────

  _injectStyles() {
    if (document.getElementById('sdp-page-styles')) return;
    const style = document.createElement('style');
    style.id = 'sdp-page-styles';
    style.textContent = PAGE_STYLES;
    document.head.appendChild(style);
    this._styleEl = style;
  }

  // ─── Rendering ───────────────────────────────────────────

  _renderShell() {
    this.container.innerHTML = '';
    const root = document.createElement('div');
    root.className = 'sdp-root';
    this.container.appendChild(root);
    this._rootEl = root;
  }

  _renderLoading() {
    this._rootEl.innerHTML = `
      <div class="sdp-loading">
        <div class="sdp-loading-spinner"></div>
        <div class="sdp-loading-text">Loading session replay...</div>
        <div class="sdp-loading-subtext">Session ${this._escHtml(this.sessionId || '')}</div>
      </div>
    `;
  }

  _renderError(title, message) {
    this._rootEl.innerHTML = `
      <div class="sdp-nav">
        <a href="${this._escHtml(this.sessionsListUrl)}" class="sdp-back-btn">
          <svg viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Sessions
        </a>
        <span class="sdp-nav-title">${this._escHtml(title)}</span>
      </div>
      <div class="sdp-error">
        <div class="sdp-error-icon">
          <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
        </div>
        <div class="sdp-error-title">${this._escHtml(title)}</div>
        <div class="sdp-error-message">${this._escHtml(message)}</div>
        <button class="sdp-retry-btn" onclick="location.reload()">Retry</button>
      </div>
    `;
  }

  _renderPlayer() {
    const s = this._session;

    // Build nav bar
    const nav = document.createElement('div');
    nav.className = 'sdp-nav';

    // Back button
    const backBtn = document.createElement('a');
    backBtn.href = this.sessionsListUrl;
    backBtn.className = 'sdp-back-btn';
    backBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg> Sessions';
    nav.appendChild(backBtn);

    // Title
    const title = document.createElement('span');
    title.className = 'sdp-nav-title';
    title.textContent = 'Session Replay';
    nav.appendChild(title);

    // Session id
    const sessionIdEl = document.createElement('span');
    sessionIdEl.className = 'sdp-nav-session-id';
    sessionIdEl.textContent = this.sessionId ? this.sessionId.substring(0, 8) + '...' : '';
    sessionIdEl.title = this.sessionId || '';
    nav.appendChild(sessionIdEl);

    // Badges
    if (s.has_rage_clicks) {
      const badge = document.createElement('span');
      badge.className = 'sdp-nav-badge sdp-nav-badge--rage';
      badge.textContent = 'Rage Clicks';
      nav.appendChild(badge);
    }

    if (s.has_errors) {
      const badge = document.createElement('span');
      badge.className = 'sdp-nav-badge sdp-nav-badge--error';
      badge.textContent = 'JS Errors';
      nav.appendChild(badge);
    }

    // Spacer
    const spacer = document.createElement('div');
    spacer.className = 'sdp-nav-spacer';
    nav.appendChild(spacer);

    // Share button
    const shareBtn = document.createElement('button');
    shareBtn.className = 'sdp-share-btn';
    shareBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> Share';
    shareBtn.addEventListener('click', () => this._shareSession());
    nav.appendChild(shareBtn);

    // Keyboard hints
    const hints = document.createElement('div');
    hints.className = 'sdp-keyboard-hint';
    hints.innerHTML = `
      <kbd class="sdp-kbd">Space</kbd> Play
      <kbd class="sdp-kbd">&larr;</kbd><kbd class="sdp-kbd">&rarr;</kbd> Seek
      <kbd class="sdp-kbd">1-4</kbd> Speed
      <kbd class="sdp-kbd">F</kbd> Fullscreen
    `;
    nav.appendChild(hints);

    // Player container
    const playerContainer = document.createElement('div');
    playerContainer.className = 'sdp-player-container';

    // Notes section
    const notesSection = document.createElement('div');
    notesSection.className = 'sdp-notes-section';
    notesSection.id = 'sdp-notes-section';

    // Assemble
    this._rootEl.innerHTML = '';
    this._rootEl.appendChild(nav);
    this._rootEl.appendChild(playerContainer);
    this._rootEl.appendChild(notesSection);

    // Initialise the SessionPlayer
    this.player = new SessionPlayer(playerContainer, this._events, {
      session: s,
      speed: 1,
      skipInactivity: true,
      inactivityThreshold: 3,
    });

    // Load and render notes
    this._loadNotes();
  }

  // ─── Keyboard Shortcuts ──────────────────────────────────

  _bindKeyboard() {
    this._keyHandler = (e) => {
      // Don't capture if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }

      if (!this.player) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          this.player.toggle();
          break;

        case 'ArrowLeft':
          e.preventDefault();
          this.player.seekTo(Math.max(0, this.player._elapsedAtPause - 5000));
          break;

        case 'ArrowRight':
          e.preventDefault();
          this.player.seekTo(Math.min(this.player._totalDuration, this.player._elapsedAtPause + 5000));
          break;

        case '1':
          this.player.setSpeed(1);
          break;

        case '2':
          this.player.setSpeed(2);
          break;

        case '3':
          this.player.setSpeed(4);
          break;

        case '4':
          this.player.setSpeed(8);
          break;

        case 'f':
        case 'F':
          e.preventDefault();
          this.player._toggleFullscreen();
          break;
      }
    };

    document.addEventListener('keydown', this._keyHandler);
  }

  // ─── Share ───────────────────────────────────────────────

  _shareSession() {
    const shareUrl = window.location.origin + '/#sessions/' + this.sessionId;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        this._showToast('Link copied!');
      }).catch(() => {
        this._fallbackCopyToClipboard(shareUrl);
      });
    } else {
      this._fallbackCopyToClipboard(shareUrl);
    }
  }

  _fallbackCopyToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      this._showToast('Link copied!');
    } catch (e) {
      this._showToast('Could not copy link');
    }
    document.body.removeChild(textarea);
  }

  _showToast(message) {
    // Remove any existing toasts
    const existing = document.querySelector('.sdp-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'sdp-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('sdp-toast--visible');
    });

    // Auto-hide after 2s
    setTimeout(() => {
      toast.classList.remove('sdp-toast--visible');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  // ─── Notes ──────────────────────────────────────────────

  async _loadNotes() {
    try {
      const url = this.apiBase + '/notes?session_id=' + encodeURIComponent(this.sessionId);
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        this._notes = data.notes || [];
      } else {
        this._notes = [];
      }
    } catch (err) {
      console.warn('[SessionDetailPage] Could not load notes:', err);
      this._notes = [];
    }
    this._renderNotes();
  }

  _renderNotes() {
    const section = document.getElementById('sdp-notes-section');
    if (!section) return;

    const notesListHTML = this._notes.length > 0
      ? this._notes.map(note => `
          <div class="sdp-note-item" data-note-id="${this._escHtml(note.id)}">
            <div style="flex:1;">
              <div class="sdp-note-content">${this._escHtml(note.content)}</div>
              <div class="sdp-note-meta">
                <span>${this._escHtml(note.author || 'admin')}</span>
                <span>${this._formatNoteDate(note.created_at)}</span>
              </div>
            </div>
            <button class="sdp-note-delete" data-note-delete="${this._escHtml(note.id)}" title="Delete note">
              <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        `).join('')
      : '<div class="sdp-notes-empty">No notes yet. Add one below.</div>';

    section.innerHTML = `
      <div class="sdp-notes-header">
        <span class="sdp-notes-title">
          <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Notes
        </span>
        <span class="sdp-notes-count">${this._notes.length}</span>
      </div>
      <div class="sdp-notes-list">
        ${notesListHTML}
      </div>
      <div class="sdp-note-form">
        <input type="text" class="sdp-note-input" id="sdp-note-input" placeholder="Add a note about this session..." />
        <button class="sdp-note-submit" id="sdp-note-submit">Add Note</button>
      </div>
    `;

    // Bind events
    const submitBtn = document.getElementById('sdp-note-submit');
    const input = document.getElementById('sdp-note-input');

    if (submitBtn) {
      submitBtn.addEventListener('click', () => this._addNote());
    }
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this._addNote();
        }
      });
    }

    // Bind delete buttons
    const deleteButtons = section.querySelectorAll('[data-note-delete]');
    deleteButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const noteId = btn.getAttribute('data-note-delete');
        this._deleteNote(noteId);
      });
    });
  }

  async _addNote() {
    const input = document.getElementById('sdp-note-input');
    const content = input ? input.value.trim() : '';
    if (!content) return;

    // Optimistic UI: add note immediately
    const tempNote = {
      id: 'temp-' + Date.now(),
      session_id: this.sessionId,
      project_id: 'default',
      content: content,
      author: 'admin',
      created_at: new Date().toISOString(),
    };
    this._notes.push(tempNote);
    this._renderNotes();

    try {
      const response = await fetch(this.apiBase + '/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.sessionId,
          content: content,
          project_id: 'default',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Replace temp note with real one
        const tempIdx = this._notes.findIndex(n => n.id === tempNote.id);
        if (tempIdx !== -1 && data.note) {
          this._notes[tempIdx] = data.note;
        }
        this._renderNotes();
      } else {
        // Remove temp note on failure
        this._notes = this._notes.filter(n => n.id !== tempNote.id);
        this._renderNotes();
        this._showToast('Failed to add note');
      }
    } catch (err) {
      console.error('[SessionDetailPage] Failed to add note:', err);
      this._notes = this._notes.filter(n => n.id !== tempNote.id);
      this._renderNotes();
      this._showToast('Failed to add note');
    }
  }

  async _deleteNote(noteId) {
    // Optimistic removal
    const removedNote = this._notes.find(n => n.id === noteId);
    this._notes = this._notes.filter(n => n.id !== noteId);
    this._renderNotes();

    try {
      const response = await fetch(this.apiBase + '/notes/' + encodeURIComponent(noteId), {
        method: 'DELETE',
      });

      if (!response.ok && removedNote) {
        // Restore on failure
        this._notes.push(removedNote);
        this._notes.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        this._renderNotes();
        this._showToast('Failed to delete note');
      }
    } catch (err) {
      console.error('[SessionDetailPage] Failed to delete note:', err);
      if (removedNote) {
        this._notes.push(removedNote);
        this._notes.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        this._renderNotes();
        this._showToast('Failed to delete note');
      }
    }
  }

  _formatNoteDate(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now - d;
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return diffMins + 'm ago';
      const diffHrs = Math.floor(diffMins / 60);
      if (diffHrs < 24) return diffHrs + 'h ago';
      const diffDays = Math.floor(diffHrs / 24);
      if (diffDays < 7) return diffDays + 'd ago';
      return d.toLocaleDateString();
    } catch (e) {
      return dateStr;
    }
  }

  // ─── Helpers ─────────────────────────────────────────────

  _escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }
}

// ─── Auto-init ────────────────────────────────────────────────────────────────

// If the page has a #session-player container, auto-initialise when DOM is ready
function _autoInit() {
  const container = document.getElementById('session-player');
  if (container) {
    const page = new SessionDetailPage();
    page.init();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _autoInit);
} else {
  _autoInit();
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SessionDetailPage;
} else {
  window.SessionDetailPage = SessionDetailPage;
}
