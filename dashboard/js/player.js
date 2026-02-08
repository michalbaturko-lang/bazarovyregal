'use strict';

/**
 * SessionPlayer - Core session replay player component.
 *
 * Replays recorded user sessions inside a sandboxed iframe, rendering mouse
 * movements, clicks, scrolls, DOM mutations, and other captured events on a
 * precise timeline.
 *
 * Event type codes:
 *   0  session_start      4  mouse_click    8  page_visibility   12 custom_event
 *   1  dom_snapshot       5  scroll         9  rage_click        13 identify
 *   2  dom_mutation       6  resize        10  dead_click        14 page_navigation
 *   3  mouse_move         7  input         11  js_error
 */

const EVENT_TYPES = Object.freeze({
  SESSION_START:    0,
  DOM_SNAPSHOT:     1,
  DOM_MUTATION:     2,
  MOUSE_MOVE:      3,
  MOUSE_CLICK:     4,
  SCROLL:          5,
  RESIZE:          6,
  INPUT:           7,
  PAGE_VISIBILITY: 8,
  RAGE_CLICK:      9,
  DEAD_CLICK:      10,
  JS_ERROR:        11,
  CUSTOM_EVENT:    12,
  IDENTIFY:        13,
  PAGE_NAVIGATION: 14,
});

const EVENT_TYPE_NAMES = Object.freeze({
  [EVENT_TYPES.SESSION_START]:    'Session Start',
  [EVENT_TYPES.DOM_SNAPSHOT]:     'Page Load',
  [EVENT_TYPES.DOM_MUTATION]:     'DOM Change',
  [EVENT_TYPES.MOUSE_MOVE]:      'Mouse Move',
  [EVENT_TYPES.MOUSE_CLICK]:     'Click',
  [EVENT_TYPES.SCROLL]:          'Scroll',
  [EVENT_TYPES.RESIZE]:          'Resize',
  [EVENT_TYPES.INPUT]:           'Input',
  [EVENT_TYPES.PAGE_VISIBILITY]: 'Tab Switch',
  [EVENT_TYPES.RAGE_CLICK]:      'Rage Click',
  [EVENT_TYPES.DEAD_CLICK]:      'Dead Click',
  [EVENT_TYPES.JS_ERROR]:        'JS Error',
  [EVENT_TYPES.CUSTOM_EVENT]:    'Custom Event',
  [EVENT_TYPES.IDENTIFY]:        'Identify',
  [EVENT_TYPES.PAGE_NAVIGATION]: 'Navigation',
});

const EVENT_TYPE_ICONS = Object.freeze({
  [EVENT_TYPES.SESSION_START]:    '<svg viewBox="0 0 16 16" width="14" height="14"><circle cx="8" cy="8" r="6" fill="#10b981"/></svg>',
  [EVENT_TYPES.DOM_SNAPSHOT]:     '<svg viewBox="0 0 16 16" width="14" height="14"><rect x="2" y="2" width="12" height="12" rx="2" fill="#6366f1" opacity="0.8"/></svg>',
  [EVENT_TYPES.DOM_MUTATION]:     '<svg viewBox="0 0 16 16" width="14" height="14"><path d="M4 4h8v2H4zM4 8h6v2H4zM4 12h8v2H4z" fill="#8b5cf6" opacity="0.7"/></svg>',
  [EVENT_TYPES.MOUSE_MOVE]:      '<svg viewBox="0 0 16 16" width="14" height="14"><path d="M3 2l4 12 2-5 5-2z" fill="#94a3b8"/></svg>',
  [EVENT_TYPES.MOUSE_CLICK]:     '<svg viewBox="0 0 16 16" width="14" height="14"><circle cx="8" cy="8" r="4" fill="#3b82f6"/><circle cx="8" cy="8" r="6" fill="none" stroke="#3b82f6" stroke-width="1.5"/></svg>',
  [EVENT_TYPES.SCROLL]:          '<svg viewBox="0 0 16 16" width="14" height="14"><path d="M8 2l3 4H5zM8 14l-3-4h6z" fill="#64748b"/></svg>',
  [EVENT_TYPES.RESIZE]:          '<svg viewBox="0 0 16 16" width="14" height="14"><path d="M14 10l-4 4m4-8l-8 8" stroke="#64748b" stroke-width="1.5" fill="none"/></svg>',
  [EVENT_TYPES.INPUT]:           '<svg viewBox="0 0 16 16" width="14" height="14"><rect x="2" y="5" width="12" height="6" rx="1" fill="none" stroke="#f59e0b" stroke-width="1.5"/><line x1="5" y1="7" x2="5" y2="9" stroke="#f59e0b" stroke-width="1.5"/></svg>',
  [EVENT_TYPES.PAGE_VISIBILITY]: '<svg viewBox="0 0 16 16" width="14" height="14"><circle cx="8" cy="8" r="3" fill="#94a3b8"/><path d="M2 8s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5z" fill="none" stroke="#94a3b8" stroke-width="1.2"/></svg>',
  [EVENT_TYPES.RAGE_CLICK]:      '<svg viewBox="0 0 16 16" width="14" height="14"><circle cx="8" cy="8" r="4" fill="#ef4444"/><circle cx="8" cy="8" r="6" fill="none" stroke="#ef4444" stroke-width="1.5"/><circle cx="8" cy="8" r="2" fill="#fff"/></svg>',
  [EVENT_TYPES.DEAD_CLICK]:      '<svg viewBox="0 0 16 16" width="14" height="14"><circle cx="8" cy="8" r="4" fill="#f97316" opacity="0.7"/><line x1="5" y1="5" x2="11" y2="11" stroke="#fff" stroke-width="1.5"/><line x1="11" y1="5" x2="5" y2="11" stroke="#fff" stroke-width="1.5"/></svg>',
  [EVENT_TYPES.JS_ERROR]:        '<svg viewBox="0 0 16 16" width="14" height="14"><path d="M8 1l7 13H1z" fill="#ef4444" opacity="0.9"/><text x="8" y="12" text-anchor="middle" fill="#fff" font-size="9" font-weight="bold">!</text></svg>',
  [EVENT_TYPES.CUSTOM_EVENT]:    '<svg viewBox="0 0 16 16" width="14" height="14"><polygon points="8,1 10,6 15,6 11,9 13,15 8,11 3,15 5,9 1,6 6,6" fill="#10b981"/></svg>',
  [EVENT_TYPES.IDENTIFY]:        '<svg viewBox="0 0 16 16" width="14" height="14"><circle cx="8" cy="5" r="3" fill="#6366f1"/><path d="M3 14c0-3 2-5 5-5s5 2 5 5" fill="#6366f1" opacity="0.6"/></svg>',
  [EVENT_TYPES.PAGE_NAVIGATION]: '<svg viewBox="0 0 16 16" width="14" height="14"><path d="M3 8h10M10 4l4 4-4 4" fill="none" stroke="#8b5cf6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const PLAYER_STYLES = `
  /* ── Reset ───────────────────────────────────────────────── */
  .sp-root *, .sp-root *::before, .sp-root *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  .sp-root {
    --sp-bg: #0f1117;
    --sp-bg-secondary: #161923;
    --sp-bg-tertiary: #1c1f2e;
    --sp-border: #2a2d3e;
    --sp-text: #e2e8f0;
    --sp-text-secondary: #94a3b8;
    --sp-text-dim: #64748b;
    --sp-accent: #3b82f6;
    --sp-accent-hover: #2563eb;
    --sp-danger: #ef4444;
    --sp-warning: #f59e0b;
    --sp-success: #10b981;
    --sp-purple: #8b5cf6;

    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background: var(--sp-bg);
    color: var(--sp-text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 13px;
    line-height: 1.4;
    overflow: hidden;
    border-radius: 8px;
    border: 1px solid var(--sp-border);
  }

  /* ── Session info bar (top) ──────────────────────────────── */
  .sp-info-bar {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 8px 16px;
    background: var(--sp-bg-secondary);
    border-bottom: 1px solid var(--sp-border);
    flex-shrink: 0;
    min-height: 40px;
    overflow: hidden;
  }

  .sp-info-item {
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
    font-size: 12px;
    color: var(--sp-text-secondary);
  }

  .sp-info-item .sp-info-label {
    color: var(--sp-text-dim);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .sp-info-item .sp-info-value {
    color: var(--sp-text);
    font-weight: 500;
  }

  .sp-info-divider {
    width: 1px;
    height: 20px;
    background: var(--sp-border);
    flex-shrink: 0;
  }

  /* ── Main area (viewport + sidebar) ─────────────────────── */
  .sp-main {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  /* ── Viewport area ──────────────────────────────────────── */
  .sp-viewport-wrap {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0a0c10;
    position: relative;
    overflow: hidden;
    min-width: 0;
  }

  .sp-viewport-scaler {
    position: relative;
    overflow: hidden;
    background: #fff;
    box-shadow: 0 4px 24px rgba(0,0,0,0.4);
    border-radius: 2px;
  }

  .sp-iframe {
    border: none;
    width: 100%;
    height: 100%;
    display: block;
    pointer-events: none;
    background: #fff;
  }

  /* ── Cursor overlay ─────────────────────────────────────── */
  .sp-cursor-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 10;
    overflow: hidden;
  }

  .sp-cursor {
    position: absolute;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--sp-accent);
    border: 2px solid #fff;
    box-shadow: 0 1px 4px rgba(0,0,0,0.3);
    transform: translate(-50%, -50%);
    transition: left 0.08s linear, top 0.08s linear;
    z-index: 20;
    pointer-events: none;
    opacity: 0;
  }

  .sp-cursor.sp-cursor--visible {
    opacity: 1;
  }

  .sp-cursor-trail {
    position: absolute;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(59, 130, 246, 0.3);
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 19;
    animation: sp-trail-fade 0.5s ease-out forwards;
  }

  @keyframes sp-trail-fade {
    0% { opacity: 0.6; transform: translate(-50%, -50%) scale(1); }
    100% { opacity: 0; transform: translate(-50%, -50%) scale(0.3); }
  }

  /* ── Click ripple ───────────────────────────────────────── */
  .sp-click-ripple {
    position: absolute;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 2px solid var(--sp-accent);
    transform: translate(-50%, -50%) scale(0.3);
    pointer-events: none;
    z-index: 21;
    animation: sp-ripple-expand 0.6s ease-out forwards;
  }

  @keyframes sp-ripple-expand {
    0% { transform: translate(-50%, -50%) scale(0.3); opacity: 1; }
    100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
  }

  .sp-click-ripple--inner {
    position: absolute;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--sp-accent);
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 22;
    animation: sp-inner-dot 0.3s ease-out forwards;
  }

  @keyframes sp-inner-dot {
    0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    100% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
  }

  /* ── Rage click ─────────────────────────────────────────── */
  .sp-rage-pulse {
    position: absolute;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    border: 3px solid var(--sp-danger);
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 23;
    animation: sp-rage-expand 0.9s ease-out forwards;
  }

  .sp-rage-pulse--inner {
    position: absolute;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: rgba(239, 68, 68, 0.5);
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 24;
    animation: sp-rage-inner 0.9s ease-out forwards;
  }

  @keyframes sp-rage-expand {
    0% { transform: translate(-50%, -50%) scale(0.4); opacity: 1; border-color: #ef4444; }
    33% { transform: translate(-50%, -50%) scale(1.5); opacity: 0.8; }
    66% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.9; }
    100% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; }
  }

  @keyframes sp-rage-inner {
    0% { opacity: 0.8; transform: translate(-50%, -50%) scale(1); }
    50% { opacity: 0.5; transform: translate(-50%, -50%) scale(1.4); }
    100% { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
  }

  /* ── Page transition overlay ────────────────────────────── */
  .sp-page-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 30;
    pointer-events: none;
    animation: sp-page-transition 0.8s ease-out forwards;
  }

  .sp-page-overlay-text {
    color: #fff;
    font-size: 14px;
    font-weight: 500;
    padding: 8px 20px;
    background: rgba(0,0,0,0.5);
    border-radius: 6px;
    backdrop-filter: blur(4px);
  }

  @keyframes sp-page-transition {
    0% { opacity: 0; }
    20% { opacity: 1; }
    80% { opacity: 1; }
    100% { opacity: 0; }
  }

  /* ── Paused overlay ─────────────────────────────────────── */
  .sp-paused-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 25;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .sp-paused-overlay.sp-paused-overlay--visible {
    opacity: 1;
  }

  .sp-paused-icon {
    width: 64px;
    height: 64px;
    background: rgba(0,0,0,0.5);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(4px);
  }

  .sp-paused-icon svg {
    width: 28px;
    height: 28px;
    fill: #fff;
    margin-left: 4px;
  }

  /* ── Skipping indicator ─────────────────────────────────── */
  .sp-skip-indicator {
    position: absolute;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.7);
    color: #fff;
    padding: 6px 16px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 500;
    z-index: 28;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s ease;
    backdrop-filter: blur(4px);
  }

  .sp-skip-indicator--visible {
    opacity: 1;
  }

  /* ── Timeline ───────────────────────────────────────────── */
  .sp-timeline-wrap {
    position: relative;
    padding: 0 16px;
    background: var(--sp-bg-secondary);
    border-top: 1px solid var(--sp-border);
    flex-shrink: 0;
  }

  .sp-timeline {
    position: relative;
    height: 32px;
    cursor: pointer;
    display: flex;
    align-items: center;
  }

  .sp-timeline-track {
    position: relative;
    width: 100%;
    height: 4px;
    background: var(--sp-bg-tertiary);
    border-radius: 2px;
    overflow: visible;
  }

  .sp-timeline-track:hover {
    height: 6px;
  }

  .sp-timeline-progress {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background: var(--sp-accent);
    border-radius: 2px;
    transition: width 0.1s linear;
    pointer-events: none;
  }

  .sp-timeline-thumb {
    position: absolute;
    top: 50%;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--sp-accent);
    border: 2px solid #fff;
    transform: translate(-50%, -50%);
    box-shadow: 0 1px 4px rgba(0,0,0,0.3);
    pointer-events: none;
    z-index: 5;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .sp-timeline:hover .sp-timeline-thumb {
    opacity: 1;
  }

  .sp-timeline-markers {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 3;
  }

  .sp-timeline-marker {
    position: absolute;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    pointer-events: auto;
    cursor: pointer;
    z-index: 4;
  }

  .sp-timeline-marker:hover {
    transform: translate(-50%, -50%) scale(1.6);
  }

  .sp-timeline-marker--click { background: var(--sp-accent); }
  .sp-timeline-marker--rage { background: var(--sp-danger); width: 8px; height: 8px; }
  .sp-timeline-marker--error { background: var(--sp-warning); }
  .sp-timeline-marker--custom { background: var(--sp-success); }
  .sp-timeline-marker--nav { background: var(--sp-purple); }

  .sp-timeline-tooltip {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.85);
    color: #fff;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s;
    z-index: 100;
  }

  .sp-timeline:hover .sp-timeline-tooltip--active {
    opacity: 1;
  }

  /* ── Time display ───────────────────────────────────────── */
  .sp-time-display {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 0;
    font-size: 11px;
    color: var(--sp-text-secondary);
    font-variant-numeric: tabular-nums;
    user-select: none;
  }

  .sp-time-current {
    color: var(--sp-text);
    font-weight: 500;
  }

  /* ── Controls bar ───────────────────────────────────────── */
  .sp-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 16px;
    background: var(--sp-bg-secondary);
    border-top: 1px solid var(--sp-border);
    flex-shrink: 0;
    min-height: 44px;
  }

  .sp-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    color: var(--sp-text);
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    flex-shrink: 0;
  }

  .sp-btn:hover {
    background: var(--sp-bg-tertiary);
  }

  .sp-btn svg {
    width: 18px;
    height: 18px;
    fill: currentColor;
  }

  .sp-btn--play {
    width: 36px;
    height: 36px;
    background: var(--sp-accent);
    border-radius: 50%;
  }

  .sp-btn--play:hover {
    background: var(--sp-accent-hover);
  }

  .sp-btn--play svg {
    width: 16px;
    height: 16px;
    fill: #fff;
  }

  .sp-speed-select {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    background: var(--sp-bg-tertiary);
    border-radius: 6px;
    padding: 2px;
    flex-shrink: 0;
  }

  .sp-speed-btn {
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 600;
    color: var(--sp-text-dim);
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
  }

  .sp-speed-btn:hover {
    color: var(--sp-text-secondary);
  }

  .sp-speed-btn--active {
    background: var(--sp-accent);
    color: #fff;
  }

  .sp-speed-btn--active:hover {
    color: #fff;
  }

  .sp-skip-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--sp-text-secondary);
    cursor: pointer;
    user-select: none;
    padding: 4px 8px;
    border-radius: 6px;
    transition: background 0.15s;
    flex-shrink: 0;
  }

  .sp-skip-toggle:hover {
    background: var(--sp-bg-tertiary);
  }

  .sp-skip-checkbox {
    position: relative;
    width: 28px;
    height: 16px;
    background: var(--sp-bg-tertiary);
    border-radius: 8px;
    border: 1px solid var(--sp-border);
    transition: background 0.2s, border-color 0.2s;
    flex-shrink: 0;
  }

  .sp-skip-checkbox::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 10px;
    height: 10px;
    background: var(--sp-text-dim);
    border-radius: 50%;
    transition: transform 0.2s, background 0.2s;
  }

  .sp-skip-toggle--active .sp-skip-checkbox {
    background: var(--sp-accent);
    border-color: var(--sp-accent);
  }

  .sp-skip-toggle--active .sp-skip-checkbox::after {
    transform: translateX(12px);
    background: #fff;
  }

  .sp-url-display {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
    color: var(--sp-text-dim);
    padding: 4px 12px;
    background: var(--sp-bg-tertiary);
    border-radius: 4px;
    font-family: 'SFMono-Regular', 'Consolas', 'Liberation Mono', monospace;
  }

  .sp-controls-spacer {
    flex: 1;
  }

  /* ── Sidebar ────────────────────────────────────────────── */
  .sp-sidebar {
    width: 280px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    background: var(--sp-bg-secondary);
    border-left: 1px solid var(--sp-border);
    overflow: hidden;
  }

  .sp-sidebar-header {
    padding: 10px 12px;
    border-bottom: 1px solid var(--sp-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }

  .sp-sidebar-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--sp-text);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .sp-sidebar-count {
    font-size: 11px;
    color: var(--sp-text-dim);
    background: var(--sp-bg-tertiary);
    padding: 2px 8px;
    border-radius: 10px;
  }

  /* ── Sidebar filters ────────────────────────────────────── */
  .sp-sidebar-filters {
    padding: 8px 12px;
    border-bottom: 1px solid var(--sp-border);
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    flex-shrink: 0;
  }

  .sp-filter-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    font-size: 10px;
    font-weight: 500;
    color: var(--sp-text-secondary);
    background: var(--sp-bg-tertiary);
    border: 1px solid transparent;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.15s;
    user-select: none;
    font-family: inherit;
  }

  .sp-filter-chip:hover {
    border-color: var(--sp-border);
  }

  .sp-filter-chip--active {
    border-color: var(--sp-accent);
    color: var(--sp-accent);
    background: rgba(59, 130, 246, 0.1);
  }

  /* ── Event list ─────────────────────────────────────────── */
  .sp-event-list {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .sp-event-list::-webkit-scrollbar {
    width: 5px;
  }

  .sp-event-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .sp-event-list::-webkit-scrollbar-thumb {
    background: var(--sp-border);
    border-radius: 3px;
  }

  .sp-event-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid rgba(42, 45, 62, 0.4);
    cursor: pointer;
    transition: background 0.1s;
    min-height: 40px;
  }

  .sp-event-item:hover {
    background: var(--sp-bg-tertiary);
  }

  .sp-event-item--active {
    background: rgba(59, 130, 246, 0.08);
    border-left: 2px solid var(--sp-accent);
  }

  .sp-event-item--rage {
    background: rgba(239, 68, 68, 0.06);
  }

  .sp-event-item--rage.sp-event-item--active {
    border-left-color: var(--sp-danger);
  }

  .sp-event-item--error {
    background: rgba(249, 115, 22, 0.06);
  }

  .sp-event-item--error.sp-event-item--active {
    border-left-color: var(--sp-warning);
  }

  .sp-event-icon {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 1px;
  }

  .sp-event-body {
    flex: 1;
    min-width: 0;
  }

  .sp-event-type {
    font-size: 12px;
    font-weight: 500;
    color: var(--sp-text);
    line-height: 1.3;
  }

  .sp-event-detail {
    font-size: 11px;
    color: var(--sp-text-dim);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 180px;
    margin-top: 1px;
  }

  .sp-event-time {
    font-size: 10px;
    color: var(--sp-text-dim);
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
    margin-top: 2px;
  }

  /* ── Fullscreen ─────────────────────────────────────────── */
  .sp-root--fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 999999;
    border-radius: 0;
  }

  /* ── Loading / empty state ──────────────────────────────── */
  .sp-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    color: var(--sp-text-dim);
    font-size: 14px;
    gap: 10px;
  }

  .sp-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid var(--sp-border);
    border-top-color: var(--sp-accent);
    border-radius: 50%;
    animation: sp-spin 0.7s linear infinite;
  }

  @keyframes sp-spin {
    to { transform: rotate(360deg); }
  }
`;

// ─── SessionPlayer Class ──────────────────────────────────────────────────────

class SessionPlayer {
  /**
   * @param {HTMLElement} containerEl  - Element to mount the player into
   * @param {Array}       events      - Sorted array of event objects
   * @param {Object}      options     - Player options
   * @param {Object}      options.session - Session metadata
   * @param {number}      options.speed - Initial playback speed (default 1)
   * @param {boolean}     options.skipInactivity - Auto-skip inactivity (default true)
   * @param {number}      options.inactivityThreshold - Seconds of inactivity to skip (default 3)
   */
  constructor(containerEl, events, options = {}) {
    this.container = containerEl;
    this.events = this._normalizeEvents(events || []);
    this.session = options.session || {};
    this.speed = options.speed || 1;
    this.skipInactivityEnabled = options.skipInactivity !== false;
    this.inactivityThreshold = (options.inactivityThreshold || 3) * 1000;

    // Playback state
    this._playing = false;
    this._currentIndex = 0;
    this._startTime = 0;
    this._elapsedAtPause = 0;
    this._rafId = null;
    this._totalDuration = 0;

    // Rendering state
    this._viewportWidth = 1920;
    this._viewportHeight = 1080;
    this._currentUrl = '';
    this._cursorX = 0;
    this._cursorY = 0;
    this._trailTimer = null;
    this._lastTrailTime = 0;

    // Node ID map for virtual DOM reconstruction (id → real DOM node)
    this._nodeMap = new Map();

    // Sidebar filter state
    this._activeFilters = new Set();

    // DOM references
    this._els = {};

    // Compute session timeline
    this._computeTimeline();

    // Build UI
    this._injectStyles();
    this._buildUI();
    this._buildTimeline();
    this._buildSidebar();
    this._bindEvents();

    // Render initial state
    this._renderInitialState();
  }

  // ─── Public API ──────────────────────────────────────────

  play() {
    if (this._playing) return;
    if (this._currentIndex >= this.events.length) {
      this.seekTo(0);
    }
    this._playing = true;
    this._startTime = performance.now() - this._elapsedAtPause;
    this._tick();
    this._updatePlayButton();
    this._setPausedOverlay(false);
  }

  pause() {
    if (!this._playing) return;
    this._playing = false;
    this._elapsedAtPause = performance.now() - this._startTime;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._updatePlayButton();
    this._setPausedOverlay(true);
  }

  toggle() {
    if (this._playing) {
      this.pause();
    } else {
      this.play();
    }
  }

  setSpeed(speed) {
    const wasPlaying = this._playing;
    if (wasPlaying) {
      this._elapsedAtPause = this._getElapsed();
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this.speed = speed;
    if (wasPlaying) {
      this._startTime = performance.now() - this._elapsedAtPause;
      this._tick();
    }
    this._updateSpeedButtons();
  }

  seekTo(timestamp) {
    const wasPlaying = this._playing;
    if (wasPlaying) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }

    // If passed a raw ms value from session start
    let targetTime = typeof timestamp === 'number' ? timestamp : 0;
    if (targetTime < 0) targetTime = 0;
    if (targetTime > this._totalDuration) targetTime = this._totalDuration;

    // Reset and replay events up to target time
    this._resetRendering();
    this._currentIndex = 0;

    for (let i = 0; i < this.events.length; i++) {
      const evt = this.events[i];
      if (evt._relativeTime > targetTime) break;
      this._applyEvent(evt, true); // silent = true (no animations)
      this._currentIndex = i + 1;
    }

    this._elapsedAtPause = targetTime;
    this._updateTimelinePosition(targetTime);
    this._updateTimeDisplay(targetTime);
    this._highlightCurrentEvent();

    if (wasPlaying) {
      this._startTime = performance.now() - this._elapsedAtPause;
      this._playing = true;
      this._tick();
    }
  }

  skipInactivity(threshold) {
    if (typeof threshold === 'number') {
      this.inactivityThreshold = threshold * 1000;
    }
    this.skipInactivityEnabled = !this.skipInactivityEnabled;
    this._updateSkipToggle();
  }

  destroy() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    if (this._styleEl && this._styleEl.parentNode) {
      this._styleEl.parentNode.removeChild(this._styleEl);
    }
    this.container.innerHTML = '';
  }

  // ─── Timeline Computation ────────────────────────────────

  _normalizeEvents(events) {
    // Ensure events are sorted by timestamp and have parsed data
    return events.map((e) => {
      const evt = { ...e };
      if (typeof evt.data === 'string') {
        try { evt.data = JSON.parse(evt.data); } catch (_) { /* keep as string */ }
      }
      return evt;
    }).sort((a, b) => a.timestamp - b.timestamp);
  }

  _computeTimeline() {
    if (this.events.length === 0) {
      this._totalDuration = 0;
      return;
    }

    const baseTime = this.events[0].timestamp;
    let adjustedOffset = 0;
    let prevTimestamp = baseTime;

    for (let i = 0; i < this.events.length; i++) {
      const evt = this.events[i];
      const rawDelta = evt.timestamp - prevTimestamp;

      // Compress inactivity gaps
      if (rawDelta > this.inactivityThreshold && this.skipInactivityEnabled) {
        adjustedOffset += rawDelta - 1000; // compress to 1s
        evt._skipped = rawDelta - 1000;
      }

      evt._relativeTime = evt.timestamp - baseTime - adjustedOffset;
      evt._rawRelativeTime = evt.timestamp - baseTime;
      prevTimestamp = evt.timestamp;
    }

    const last = this.events[this.events.length - 1];
    this._totalDuration = last._relativeTime;
  }

  // ─── Style Injection ─────────────────────────────────────

  _injectStyles() {
    if (document.getElementById('sp-player-styles')) return;
    const style = document.createElement('style');
    style.id = 'sp-player-styles';
    style.textContent = PLAYER_STYLES;
    document.head.appendChild(style);
    this._styleEl = style;
  }

  // ─── UI Construction ─────────────────────────────────────

  _buildUI() {
    const root = document.createElement('div');
    root.className = 'sp-root';

    // ── Session info bar ──
    const infoBar = this._buildInfoBar();

    // ── Main area ──
    const main = document.createElement('div');
    main.className = 'sp-main';

    // ── Viewport ──
    const vpWrap = document.createElement('div');
    vpWrap.className = 'sp-viewport-wrap';

    const vpScaler = document.createElement('div');
    vpScaler.className = 'sp-viewport-scaler';

    const iframe = document.createElement('iframe');
    iframe.className = 'sp-iframe';
    iframe.sandbox = 'allow-same-origin';
    iframe.title = 'Session Replay';

    const cursorLayer = document.createElement('div');
    cursorLayer.className = 'sp-cursor-layer';

    const cursor = document.createElement('div');
    cursor.className = 'sp-cursor';

    cursorLayer.appendChild(cursor);
    vpScaler.appendChild(iframe);
    vpScaler.appendChild(cursorLayer);

    // Paused overlay
    const pausedOverlay = document.createElement('div');
    pausedOverlay.className = 'sp-paused-overlay sp-paused-overlay--visible';
    pausedOverlay.innerHTML = '<div class="sp-paused-icon"><svg viewBox="0 0 24 24"><polygon points="8,5 19,12 8,19"/></svg></div>';
    vpScaler.appendChild(pausedOverlay);

    // Skip indicator
    const skipIndicator = document.createElement('div');
    skipIndicator.className = 'sp-skip-indicator';
    skipIndicator.textContent = 'Skipping inactivity...';
    vpScaler.appendChild(skipIndicator);

    vpWrap.appendChild(vpScaler);

    // ── Sidebar ──
    const sidebar = document.createElement('div');
    sidebar.className = 'sp-sidebar';

    main.appendChild(vpWrap);
    main.appendChild(sidebar);

    // ── Timeline ──
    const timelineWrap = document.createElement('div');
    timelineWrap.className = 'sp-timeline-wrap';

    const timeline = document.createElement('div');
    timeline.className = 'sp-timeline';

    const timelineTrack = document.createElement('div');
    timelineTrack.className = 'sp-timeline-track';

    const timelineProgress = document.createElement('div');
    timelineProgress.className = 'sp-timeline-progress';

    const timelineThumb = document.createElement('div');
    timelineThumb.className = 'sp-timeline-thumb';

    const timelineMarkers = document.createElement('div');
    timelineMarkers.className = 'sp-timeline-markers';

    const timelineTooltip = document.createElement('div');
    timelineTooltip.className = 'sp-timeline-tooltip';

    timelineTrack.appendChild(timelineProgress);
    timelineTrack.appendChild(timelineThumb);
    timelineTrack.appendChild(timelineMarkers);
    timeline.appendChild(timelineTrack);
    timeline.appendChild(timelineTooltip);
    timelineWrap.appendChild(timeline);

    // Time display
    const timeDisplay = document.createElement('div');
    timeDisplay.className = 'sp-time-display';
    timeDisplay.innerHTML = '<span class="sp-time-current">0:00</span> / <span class="sp-time-total">0:00</span>';
    timelineWrap.appendChild(timeDisplay);

    // ── Controls ──
    const controls = this._buildControls();

    // ── Assemble ──
    root.appendChild(infoBar);
    root.appendChild(main);
    root.appendChild(timelineWrap);
    root.appendChild(controls);

    this.container.innerHTML = '';
    this.container.appendChild(root);

    // Store references
    this._els.root = root;
    this._els.infoBar = infoBar;
    this._els.main = main;
    this._els.vpWrap = vpWrap;
    this._els.vpScaler = vpScaler;
    this._els.iframe = iframe;
    this._els.cursorLayer = cursorLayer;
    this._els.cursor = cursor;
    this._els.pausedOverlay = pausedOverlay;
    this._els.skipIndicator = skipIndicator;
    this._els.sidebar = sidebar;
    this._els.timeline = timeline;
    this._els.timelineTrack = timelineTrack;
    this._els.timelineProgress = timelineProgress;
    this._els.timelineThumb = timelineThumb;
    this._els.timelineMarkers = timelineMarkers;
    this._els.timelineTooltip = timelineTooltip;
    this._els.timeDisplay = timeDisplay;
    this._els.timeCurrent = timeDisplay.querySelector('.sp-time-current');
    this._els.timeTotal = timeDisplay.querySelector('.sp-time-total');
    this._els.controls = controls;
  }

  _buildInfoBar() {
    const bar = document.createElement('div');
    bar.className = 'sp-info-bar';

    const s = this.session;

    const items = [];

    // User info
    const userName = s.identified_user_name || s.identified_user_email || s.visitor_id || 'Anonymous';
    items.push(this._makeInfoItem('User', userName));

    // Device/Browser/OS
    const deviceParts = [];
    if (s.browser) deviceParts.push(s.browser);
    if (s.os) deviceParts.push(s.os);
    if (s.device_type) deviceParts.push(s.device_type);
    if (deviceParts.length > 0) {
      items.push(this._makeInfoItem('Device', deviceParts.join(' / ')));
    }

    // Location
    const locParts = [];
    if (s.city) locParts.push(s.city);
    if (s.country) locParts.push(s.country);
    if (locParts.length > 0) {
      items.push(this._makeInfoItem('Location', locParts.join(', ')));
    }

    // Duration
    if (s.duration) {
      items.push(this._makeInfoItem('Duration', this._formatDuration(s.duration * 1000)));
    }

    // Date
    if (s.started_at) {
      const dateStr = new Date(s.started_at).toLocaleString();
      items.push(this._makeInfoItem('Started', dateStr));
    }

    items.forEach((item, idx) => {
      if (idx > 0) {
        const divider = document.createElement('div');
        divider.className = 'sp-info-divider';
        bar.appendChild(divider);
      }
      bar.appendChild(item);
    });

    return bar;
  }

  _makeInfoItem(label, value) {
    const el = document.createElement('div');
    el.className = 'sp-info-item';
    el.innerHTML = `<span class="sp-info-label">${this._esc(label)}</span><span class="sp-info-value">${this._esc(value)}</span>`;
    return el;
  }

  _buildControls() {
    const controls = document.createElement('div');
    controls.className = 'sp-controls';

    // Play/Pause button
    const playBtn = document.createElement('button');
    playBtn.className = 'sp-btn sp-btn--play';
    playBtn.setAttribute('aria-label', 'Play');
    playBtn.setAttribute('title', 'Play / Pause (Space)');
    playBtn.innerHTML = this._getPlayIcon();
    controls.appendChild(playBtn);
    this._els.playBtn = playBtn;

    // Speed selector
    const speedSelect = document.createElement('div');
    speedSelect.className = 'sp-speed-select';
    [1, 2, 4, 8].forEach((s) => {
      const btn = document.createElement('button');
      btn.className = 'sp-speed-btn' + (s === this.speed ? ' sp-speed-btn--active' : '');
      btn.textContent = s + 'x';
      btn.dataset.speed = s;
      btn.title = 'Set speed to ' + s + 'x';
      speedSelect.appendChild(btn);
    });
    controls.appendChild(speedSelect);
    this._els.speedSelect = speedSelect;

    // Skip inactivity toggle
    const skipToggle = document.createElement('div');
    skipToggle.className = 'sp-skip-toggle' + (this.skipInactivityEnabled ? ' sp-skip-toggle--active' : '');
    skipToggle.title = 'Skip periods of inactivity';
    skipToggle.innerHTML = '<div class="sp-skip-checkbox"></div><span>Skip idle</span>';
    controls.appendChild(skipToggle);
    this._els.skipToggle = skipToggle;

    // URL display
    const urlDisplay = document.createElement('div');
    urlDisplay.className = 'sp-url-display';
    urlDisplay.textContent = this.session.url || '';
    controls.appendChild(urlDisplay);
    this._els.urlDisplay = urlDisplay;
    this._currentUrl = this.session.url || '';

    // Spacer
    const spacer = document.createElement('div');
    spacer.className = 'sp-controls-spacer';
    controls.appendChild(spacer);

    // Fullscreen button
    const fsBtn = document.createElement('button');
    fsBtn.className = 'sp-btn';
    fsBtn.setAttribute('aria-label', 'Fullscreen');
    fsBtn.title = 'Fullscreen (F)';
    fsBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/>
    </svg>`;
    controls.appendChild(fsBtn);
    this._els.fsBtn = fsBtn;

    return controls;
  }

  _getPlayIcon() {
    return '<svg viewBox="0 0 24 24"><polygon points="8,5 19,12 8,19"/></svg>';
  }

  _getPauseIcon() {
    return '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
  }

  // ─── Timeline Markers ────────────────────────────────────

  _buildTimeline() {
    const markers = this._els.timelineMarkers;
    markers.innerHTML = '';

    if (this._totalDuration === 0) return;

    this.events.forEach((evt, idx) => {
      let markerClass = null;

      switch (evt.type) {
        case EVENT_TYPES.MOUSE_CLICK:
          markerClass = 'sp-timeline-marker--click';
          break;
        case EVENT_TYPES.RAGE_CLICK:
          markerClass = 'sp-timeline-marker--rage';
          break;
        case EVENT_TYPES.JS_ERROR:
          markerClass = 'sp-timeline-marker--error';
          break;
        case EVENT_TYPES.CUSTOM_EVENT:
          markerClass = 'sp-timeline-marker--custom';
          break;
        case EVENT_TYPES.PAGE_NAVIGATION:
          markerClass = 'sp-timeline-marker--nav';
          break;
        default:
          return; // Only show notable events on timeline
      }

      const pct = (evt._relativeTime / this._totalDuration) * 100;
      const marker = document.createElement('div');
      marker.className = 'sp-timeline-marker ' + markerClass;
      marker.style.left = pct + '%';
      marker.dataset.index = idx;
      marker.title = EVENT_TYPE_NAMES[evt.type] + ' - ' + this._formatTime(evt._relativeTime);
      markers.appendChild(marker);
    });

    // Update total time display
    this._els.timeTotal.textContent = this._formatTime(this._totalDuration);
  }

  // ─── Sidebar ─────────────────────────────────────────────

  _buildSidebar() {
    const sidebar = this._els.sidebar;
    sidebar.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = 'sp-sidebar-header';

    const filteredCount = this._getFilteredEvents().length;
    header.innerHTML = `
      <span class="sp-sidebar-title">Events</span>
      <span class="sp-sidebar-count">${filteredCount}</span>
    `;
    sidebar.appendChild(header);
    this._els.sidebarCount = header.querySelector('.sp-sidebar-count');

    // Filters
    const filters = document.createElement('div');
    filters.className = 'sp-sidebar-filters';

    const filterTypes = [
      { type: EVENT_TYPES.MOUSE_CLICK, label: 'Clicks' },
      { type: EVENT_TYPES.RAGE_CLICK, label: 'Rage' },
      { type: EVENT_TYPES.JS_ERROR, label: 'Errors' },
      { type: EVENT_TYPES.CUSTOM_EVENT, label: 'Custom' },
      { type: EVENT_TYPES.PAGE_NAVIGATION, label: 'Nav' },
      { type: EVENT_TYPES.INPUT, label: 'Input' },
      { type: EVENT_TYPES.DOM_SNAPSHOT, label: 'Pages' },
    ];

    filterTypes.forEach(({ type, label }) => {
      const chip = document.createElement('button');
      chip.className = 'sp-filter-chip' + (this._activeFilters.has(type) ? ' sp-filter-chip--active' : '');
      chip.dataset.type = type;
      chip.textContent = label;
      filters.appendChild(chip);
    });

    sidebar.appendChild(filters);
    this._els.sidebarFilters = filters;

    // Event list
    const list = document.createElement('div');
    list.className = 'sp-event-list';
    sidebar.appendChild(list);
    this._els.eventList = list;

    this._renderEventList();
  }

  _getFilteredEvents() {
    if (this._activeFilters.size === 0) {
      // Show all events except mouse_move and dom_mutation (too noisy)
      return this.events.filter((e) =>
        e.type !== EVENT_TYPES.MOUSE_MOVE &&
        e.type !== EVENT_TYPES.DOM_MUTATION &&
        e.type !== EVENT_TYPES.SCROLL
      );
    }
    return this.events.filter((e) => this._activeFilters.has(e.type));
  }

  _renderEventList() {
    const list = this._els.eventList;
    list.innerHTML = '';

    const filtered = this._getFilteredEvents();
    this._filteredEventIndices = [];

    filtered.forEach((evt) => {
      const idx = this.events.indexOf(evt);
      this._filteredEventIndices.push(idx);

      const item = document.createElement('div');
      item.className = 'sp-event-item';
      item.dataset.index = idx;

      if (evt.type === EVENT_TYPES.RAGE_CLICK) item.classList.add('sp-event-item--rage');
      if (evt.type === EVENT_TYPES.JS_ERROR) item.classList.add('sp-event-item--error');

      const icon = document.createElement('div');
      icon.className = 'sp-event-icon';
      icon.innerHTML = EVENT_TYPE_ICONS[evt.type] || '';

      const body = document.createElement('div');
      body.className = 'sp-event-body';

      const typeName = document.createElement('div');
      typeName.className = 'sp-event-type';
      typeName.textContent = EVENT_TYPE_NAMES[evt.type] || 'Event ' + evt.type;

      const detail = document.createElement('div');
      detail.className = 'sp-event-detail';
      detail.textContent = this._getEventDetail(evt);

      body.appendChild(typeName);
      if (detail.textContent) body.appendChild(detail);

      const time = document.createElement('div');
      time.className = 'sp-event-time';
      time.textContent = this._formatTime(evt._relativeTime);

      item.appendChild(icon);
      item.appendChild(body);
      item.appendChild(time);
      list.appendChild(item);
    });

    // Update count
    if (this._els.sidebarCount) {
      this._els.sidebarCount.textContent = filtered.length;
    }
  }

  _getEventDetail(evt) {
    const d = evt.data || {};
    switch (evt.type) {
      case EVENT_TYPES.SESSION_START:
        return d.url || '';
      case EVENT_TYPES.DOM_SNAPSHOT:
        return 'Full page snapshot';
      case EVENT_TYPES.DOM_MUTATION:
        return (d.mutations ? d.mutations.length + ' changes' : 'DOM update');
      case EVENT_TYPES.MOUSE_CLICK:
        return d.text ? d.text.substring(0, 40) : (d.target || '');
      case EVENT_TYPES.SCROLL:
        return 'x:' + (d.x || d.scrollX || 0) + ' y:' + (d.y || d.scrollY || 0);
      case EVENT_TYPES.RESIZE:
        return (d.w || d.width || 0) + ' x ' + (d.h || d.height || 0);
      case EVENT_TYPES.INPUT:
        return d.target || '';
      case EVENT_TYPES.PAGE_VISIBILITY:
        return d.state || d.visible || '';
      case EVENT_TYPES.RAGE_CLICK:
        return (d.count || 0) + ' rapid clicks';
      case EVENT_TYPES.DEAD_CLICK:
        return d.target || 'No effect';
      case EVENT_TYPES.JS_ERROR:
        return d.message ? d.message.substring(0, 60) : '';
      case EVENT_TYPES.CUSTOM_EVENT:
        return d.name || '';
      case EVENT_TYPES.IDENTIFY:
        return d.userId || d.user_id || '';
      case EVENT_TYPES.PAGE_NAVIGATION:
        return d.to || d.url || d.title || '';
      default:
        return '';
    }
  }

  // ─── Event Binding ───────────────────────────────────────

  _bindEvents() {
    // Play/pause
    this._els.playBtn.addEventListener('click', () => this.toggle());

    // Viewport click to toggle
    this._els.vpWrap.addEventListener('click', () => this.toggle());

    // Speed buttons
    this._els.speedSelect.addEventListener('click', (e) => {
      const btn = e.target.closest('.sp-speed-btn');
      if (!btn) return;
      this.setSpeed(parseInt(btn.dataset.speed, 10));
    });

    // Skip inactivity toggle
    this._els.skipToggle.addEventListener('click', () => {
      this.skipInactivityEnabled = !this.skipInactivityEnabled;
      this._updateSkipToggle();
      this._recomputeAndRebuild();
    });

    // Timeline seek
    this._els.timeline.addEventListener('mousedown', (e) => this._onTimelineSeek(e));
    this._els.timeline.addEventListener('mousemove', (e) => this._onTimelineHover(e));
    this._els.timeline.addEventListener('mouseleave', () => {
      this._els.timelineTooltip.classList.remove('sp-timeline-tooltip--active');
    });

    // Timeline marker click
    this._els.timelineMarkers.addEventListener('click', (e) => {
      const marker = e.target.closest('.sp-timeline-marker');
      if (!marker) return;
      e.stopPropagation();
      const idx = parseInt(marker.dataset.index, 10);
      const evt = this.events[idx];
      if (evt) this.seekTo(evt._relativeTime);
    });

    // Sidebar filter chips
    this._els.sidebarFilters.addEventListener('click', (e) => {
      const chip = e.target.closest('.sp-filter-chip');
      if (!chip) return;
      const type = parseInt(chip.dataset.type, 10);
      if (this._activeFilters.has(type)) {
        this._activeFilters.delete(type);
        chip.classList.remove('sp-filter-chip--active');
      } else {
        this._activeFilters.add(type);
        chip.classList.add('sp-filter-chip--active');
      }
      this._renderEventList();
    });

    // Sidebar event click
    this._els.eventList.addEventListener('click', (e) => {
      const item = e.target.closest('.sp-event-item');
      if (!item) return;
      const idx = parseInt(item.dataset.index, 10);
      const evt = this.events[idx];
      if (evt) this.seekTo(evt._relativeTime);
    });

    // Fullscreen
    this._els.fsBtn.addEventListener('click', () => this._toggleFullscreen());

    // Resize observer
    this._resizeObserver = new ResizeObserver(() => this._updateViewportScale());
    this._resizeObserver.observe(this._els.vpWrap);
  }

  _onTimelineSeek(e) {
    const rect = this._els.timelineTrack.getBoundingClientRect();
    const updateSeek = (clientX) => {
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const time = pct * this._totalDuration;
      this.seekTo(time);
    };

    updateSeek(e.clientX);

    const onMove = (ev) => updateSeek(ev.clientX);
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  _onTimelineHover(e) {
    const rect = this._els.timelineTrack.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = pct * this._totalDuration;

    const tooltip = this._els.timelineTooltip;
    tooltip.textContent = this._formatTime(time);
    tooltip.style.left = (pct * 100) + '%';
    tooltip.classList.add('sp-timeline-tooltip--active');
  }

  // ─── Playback Engine ─────────────────────────────────────

  _getElapsed() {
    if (!this._playing) return this._elapsedAtPause;
    return (performance.now() - this._startTime) * this.speed;
  }

  _tick() {
    if (!this._playing) return;

    const elapsed = this._getElapsed();

    // Process all events up to the current time
    while (this._currentIndex < this.events.length) {
      const evt = this.events[this._currentIndex];
      if (evt._relativeTime > elapsed) break;

      // Check for inactivity skip
      if (this._currentIndex > 0) {
        const prevEvt = this.events[this._currentIndex - 1];
        const gap = evt._relativeTime - prevEvt._relativeTime;
        if (evt._skipped && gap < 100) {
          this._showSkipIndicator();
        }
      }

      this._applyEvent(evt, false);
      this._currentIndex++;
    }

    // Update UI
    this._updateTimelinePosition(elapsed);
    this._updateTimeDisplay(elapsed);
    this._highlightCurrentEvent();

    // Check if we reached the end
    if (elapsed >= this._totalDuration) {
      this.pause();
      return;
    }

    this._rafId = requestAnimationFrame(() => this._tick());
  }

  // ─── Event Application ───────────────────────────────────

  _applyEvent(evt, silent) {
    const d = evt.data || {};

    switch (evt.type) {
      case EVENT_TYPES.SESSION_START:
        this._handleSessionStart(d);
        break;
      case EVENT_TYPES.DOM_SNAPSHOT:
        this._handleDomSnapshot(d);
        break;
      case EVENT_TYPES.DOM_MUTATION:
        this._handleDomMutation(d);
        break;
      case EVENT_TYPES.MOUSE_MOVE:
        this._handleMouseMove(d, silent);
        break;
      case EVENT_TYPES.MOUSE_CLICK:
        this._handleMouseClick(d, silent);
        break;
      case EVENT_TYPES.SCROLL:
        this._handleScroll(d);
        break;
      case EVENT_TYPES.RESIZE:
        this._handleResize(d);
        break;
      case EVENT_TYPES.INPUT:
        this._handleInput(d);
        break;
      case EVENT_TYPES.PAGE_VISIBILITY:
        this._handlePageVisibility(d);
        break;
      case EVENT_TYPES.RAGE_CLICK:
        this._handleRageClick(d, silent);
        break;
      case EVENT_TYPES.DEAD_CLICK:
        // Show same as regular click but muted
        this._handleMouseClick(d, silent);
        break;
      case EVENT_TYPES.JS_ERROR:
        // Errors shown on timeline; no rendering needed in viewport
        break;
      case EVENT_TYPES.CUSTOM_EVENT:
        // No visual rendering
        break;
      case EVENT_TYPES.IDENTIFY:
        this._handleIdentify(d);
        break;
      case EVENT_TYPES.PAGE_NAVIGATION:
        this._handlePageNavigation(d, silent);
        break;
    }
  }

  _handleSessionStart(d) {
    // Handle multiple viewport formats
    if (d.viewport_width) this._viewportWidth = d.viewport_width;
    if (d.viewport_height) this._viewportHeight = d.viewport_height;
    if (d.viewportWidth) this._viewportWidth = d.viewportWidth;
    if (d.viewportHeight) this._viewportHeight = d.viewportHeight;
    // Tracker sends viewport: {w, h}
    if (d.viewport) {
      if (d.viewport.w) this._viewportWidth = d.viewport.w;
      if (d.viewport.h) this._viewportHeight = d.viewport.h;
    }
    if (d.url) {
      this._currentUrl = d.url;
      this._els.urlDisplay.textContent = d.url;
    }
    this._updateViewportScale();
  }

  _handleDomSnapshot(d) {
    const iframe = this._els.iframe;
    const doc = iframe.contentDocument;
    if (!doc) return;

    // Clear node map for fresh snapshot
    this._nodeMap = new Map();

    // Support tracker's virtual DOM format: d.dom = {id, t, tag, a, c}
    if (d.dom && typeof d.dom === 'object') {
      this._rebuildFromVDom(doc, d.dom);
      this._updateViewportScale();
      return;
    }

    // Legacy format: HTML string
    let html = d.html || d.snapshot || d;
    if (typeof html !== 'string') {
      html = String(html);
    }

    // Disable scripts by replacing script tags
    html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
    // Remove on* event handlers
    html = html.replace(/\son\w+\s*=\s*"[^"]*"/gi, '');
    html = html.replace(/\son\w+\s*=\s*'[^']*'/gi, '');

    doc.open();
    doc.write(html);
    doc.close();

    // After writing, disable forms and links
    this._disableInteractiveElements(doc);
    this._injectReplayStyle(doc);
    this._updateViewportScale();
  }

  /**
   * Rebuild the iframe document from a virtual DOM tree (tracker format).
   * Virtual node format:
   *   Element:  { id, t:1,  tag, a:{attrs}, c:[children] }
   *   Text:     { id, t:3,  v:text }
   *   Doctype:  { id, t:10, name, publicId, systemId }
   *   Document: { id, t:9,  c:[children] }
   *   Fragment: { id, t:11, c:[children] }
   */
  _rebuildFromVDom(doc, vNode) {
    // Start fresh
    doc.open();
    doc.write('<!DOCTYPE html><html><head></head><body></body></html>');
    doc.close();

    if (!vNode) return;

    // The root vNode is t:9 (document) — process its children
    if (vNode.t === 9 && vNode.c) {
      // Find the html element child
      for (const child of vNode.c) {
        if (child.t === 10) {
          // Doctype node — already written above
          if (child.id) this._nodeMap.set(child.id, doc.doctype);
          continue;
        }
        if (child.t === 1 && child.tag === 'html') {
          // Rebuild the <html> element in place
          this._applyVNodeToElement(doc, doc.documentElement, child);
          continue;
        }
      }
    } else if (vNode.t === 1 && vNode.tag === 'html') {
      // Directly an <html> node
      this._applyVNodeToElement(doc, doc.documentElement, vNode);
    }

    if (vNode.id) this._nodeMap.set(vNode.id, doc);

    // Inject <base> tag so relative URLs (CSS, images, fonts) resolve to the original site
    this._injectBaseTag(doc);

    this._disableInteractiveElements(doc);
    this._injectReplayStyle(doc);
  }

  /**
   * Inject a <base href="..."> tag into the iframe <head> so that relative
   * URLs in stylesheets, images, and fonts resolve to the original website.
   */
  _injectBaseTag(doc) {
    try {
      // Determine the base URL from session data or current URL being replayed
      let baseUrl = this._currentUrl || '';
      if (!baseUrl && this.session) {
        baseUrl = this.session.url || '';
      }
      if (!baseUrl) return;

      // Extract origin (e.g., "https://vyprodej-regalu.cz")
      let origin;
      try {
        const parsed = new URL(baseUrl);
        origin = parsed.origin;
      } catch (_) {
        // Try to extract origin manually
        const match = baseUrl.match(/^(https?:\/\/[^\/]+)/);
        if (match) origin = match[1];
      }
      if (!origin) return;

      // Remove any existing <base> tag first
      const existingBase = doc.querySelector('base');
      if (existingBase) existingBase.remove();

      // Create and insert <base> as first child of <head>
      const base = doc.createElement('base');
      base.href = origin + '/';
      if (doc.head) {
        doc.head.insertBefore(base, doc.head.firstChild);
      }
    } catch (_) { /* safe to ignore */ }
  }

  /**
   * Apply a virtual node's attributes and children onto an existing DOM element.
   */
  _applyVNodeToElement(doc, el, vNode) {
    if (!el || !vNode) return;

    // Map node ID
    if (vNode.id) this._nodeMap.set(vNode.id, el);

    // Set attributes
    if (vNode.a) {
      for (const [name, val] of Object.entries(vNode.a)) {
        // Skip event handlers and scripts
        if (name.startsWith('on')) continue;
        try {
          el.setAttribute(name, val);
        } catch (_) { /* ignore invalid attributes */ }
      }
    }

    // Clear existing children
    while (el.firstChild) el.removeChild(el.firstChild);

    // Create children
    if (vNode.c) {
      for (const childVNode of vNode.c) {
        const childEl = this._createDomNode(doc, childVNode);
        if (childEl) {
          try { el.appendChild(childEl); } catch (_) { /* ignore */ }
        }
      }
    }
  }

  /**
   * Create a real DOM node from a virtual node recursively.
   */
  _createDomNode(doc, vNode) {
    if (!vNode) return null;

    // Text node
    if (vNode.t === 3) {
      const text = doc.createTextNode(vNode.v || '');
      if (vNode.id) this._nodeMap.set(vNode.id, text);
      return text;
    }

    // Element node
    if (vNode.t === 1) {
      const tag = (vNode.tag || 'div').toLowerCase();

      // Skip script/noscript tags for security
      if (tag === 'script' || tag === 'noscript') return null;

      let el;
      try {
        el = doc.createElement(tag);
      } catch (_) {
        el = doc.createElement('div');
      }

      if (vNode.id) this._nodeMap.set(vNode.id, el);

      // Set attributes
      if (vNode.a) {
        for (const [name, val] of Object.entries(vNode.a)) {
          if (name.startsWith('on')) continue; // Skip event handlers
          // Skip src for script/iframe (security) but allow for img, source, video, audio
          if (name === 'src' && (tag === 'script' || tag === 'iframe')) continue;
          // Skip integrity/nonce attributes that could block loading
          if (name === 'integrity' || name === 'nonce') continue;
          try {
            el.setAttribute(name, val);
          } catch (_) { /* ignore */ }
        }
      }

      // Recurse children
      if (vNode.c) {
        for (const childVNode of vNode.c) {
          const childEl = this._createDomNode(doc, childVNode);
          if (childEl) {
            try { el.appendChild(childEl); } catch (_) { /* ignore */ }
          }
        }
      }

      return el;
    }

    // Document fragment (t:11)
    if (vNode.t === 11) {
      const frag = doc.createDocumentFragment();
      if (vNode.id) this._nodeMap.set(vNode.id, frag);
      if (vNode.c) {
        for (const childVNode of vNode.c) {
          const childEl = this._createDomNode(doc, childVNode);
          if (childEl) frag.appendChild(childEl);
        }
      }
      return frag;
    }

    return null;
  }

  /**
   * Inject a style tag to disable interactive elements in the replay iframe.
   */
  _injectReplayStyle(doc) {
    try {
      const style = doc.createElement('style');
      style.textContent = `
        a, button, input, select, textarea, form { pointer-events: none !important; }
        * { cursor: default !important; }
      `;
      if (doc.head) {
        doc.head.appendChild(style);
      }
    } catch (_) { /* cross-origin issues, safe to ignore */ }
  }

  _disableInteractiveElements(doc) {
    try {
      // Disable all links
      const links = doc.querySelectorAll('a[href]');
      links.forEach((a) => {
        a.removeAttribute('href');
        a.style.cursor = 'default';
      });
      // Disable forms
      const forms = doc.querySelectorAll('form');
      forms.forEach((f) => {
        f.setAttribute('onsubmit', 'return false');
        f.addEventListener('submit', (e) => e.preventDefault());
      });
    } catch (_) { /* safe to ignore */ }
  }

  _handleDomMutation(d) {
    const iframe = this._els.iframe;
    const doc = iframe.contentDocument;
    if (!doc) return;

    const mutations = d.mutations || d.changes || (Array.isArray(d) ? d : [d]);

    mutations.forEach((mut) => {
      try {
        this._applyMutation(doc, mut);
      } catch (_) { /* safe to ignore failed mutations */ }
    });
  }

  _applyMutation(doc, mut) {
    const type = mut.type || mut.mutationType;

    // Resolve target: prefer node ID map (tracker format), fall back to CSS selector
    let target = null;
    if (mut.targetId !== undefined && this._nodeMap.has(mut.targetId)) {
      target = this._nodeMap.get(mut.targetId);
    } else if (mut.target && typeof mut.target === 'string') {
      try { target = doc.querySelector(mut.target); } catch (_) { /* ignore */ }
    }

    if (!target) return;

    switch (type) {
      case 'childList': {
        // Removals (tracker format: [{id}])
        if (mut.removes) {
          for (const removed of mut.removes) {
            const node = this._nodeMap.get(removed.id);
            if (node && node.parentNode) {
              node.parentNode.removeChild(node);
              this._nodeMap.delete(removed.id);
            }
          }
        }
        // Legacy removals
        if (mut.removedNodes) {
          for (const removed of mut.removedNodes) {
            if (removed.id !== undefined && this._nodeMap.has(removed.id)) {
              const node = this._nodeMap.get(removed.id);
              if (node && node.parentNode) node.parentNode.removeChild(node);
              this._nodeMap.delete(removed.id);
            } else if (removed.selector) {
              try {
                const el = doc.querySelector(removed.selector);
                if (el && el.parentNode) el.parentNode.removeChild(el);
              } catch (_) { /* ignore */ }
            }
          }
        }

        // Additions (tracker format: [{node: vNode, prev, next}])
        if (mut.adds) {
          for (const added of mut.adds) {
            const newNode = this._createDomNode(doc, added.node);
            if (!newNode) continue;

            // Try to insert relative to sibling references
            let inserted = false;
            if (added.next !== null && added.next !== undefined && this._nodeMap.has(added.next)) {
              const nextSibling = this._nodeMap.get(added.next);
              if (nextSibling && nextSibling.parentNode === target) {
                target.insertBefore(newNode, nextSibling);
                inserted = true;
              }
            }
            if (!inserted && added.prev !== null && added.prev !== undefined && this._nodeMap.has(added.prev)) {
              const prevSibling = this._nodeMap.get(added.prev);
              if (prevSibling && prevSibling.parentNode === target && prevSibling.nextSibling) {
                target.insertBefore(newNode, prevSibling.nextSibling);
                inserted = true;
              }
            }
            if (!inserted) {
              target.appendChild(newNode);
            }
          }
        }
        // Legacy additions
        if (mut.addedNodes) {
          for (const added of mut.addedNodes) {
            if (added.html) {
              const temp = doc.createElement('div');
              temp.innerHTML = added.html.replace(/<script[\s\S]*?<\/script>/gi, '');
              while (temp.firstChild) {
                target.appendChild(temp.firstChild);
              }
            }
          }
        }
        break;
      }

      case 'attributes': {
        // Tracker format: attr + val
        const attrName = mut.attr || mut.attributeName || mut.name;
        const attrValue = mut.val !== undefined ? mut.val : (mut.value !== undefined ? mut.value : mut.newValue);
        if (!attrName) break;
        if (attrValue === null || attrValue === undefined) {
          target.removeAttribute(attrName);
        } else {
          // Skip event handlers
          if (attrName.startsWith('on')) break;
          target.setAttribute(attrName, attrValue);
        }
        break;
      }

      case 'characterData': {
        // Tracker format: text field
        target.textContent = mut.text !== undefined ? mut.text : (mut.value !== undefined ? mut.value : (mut.newValue || ''));
        break;
      }
    }
  }

  _handleMouseMove(d, silent) {
    const x = d.x || d.clientX || 0;
    const y = d.y || d.clientY || 0;
    this._cursorX = x;
    this._cursorY = y;

    const cursor = this._els.cursor;
    cursor.classList.add('sp-cursor--visible');

    // Convert page coords to scaled coords
    const { sx, sy } = this._pageToScaled(x, y);
    cursor.style.left = sx + 'px';
    cursor.style.top = sy + 'px';

    // Trail effect (throttled)
    if (!silent) {
      const now = performance.now();
      if (now - this._lastTrailTime > 50) {
        this._lastTrailTime = now;
        this._spawnTrail(sx, sy);
      }
    }
  }

  _handleMouseClick(d, silent) {
    const x = d.x || d.clientX || 0;
    const y = d.y || d.clientY || 0;
    this._cursorX = x;
    this._cursorY = y;

    const { sx, sy } = this._pageToScaled(x, y);

    // Move cursor
    const cursor = this._els.cursor;
    cursor.classList.add('sp-cursor--visible');
    cursor.style.left = sx + 'px';
    cursor.style.top = sy + 'px';

    // Click animation
    if (!silent) {
      this._spawnClickRipple(sx, sy);
    }
  }

  _handleRageClick(d, silent) {
    const x = d.x || d.clientX || 0;
    const y = d.y || d.clientY || 0;

    const { sx, sy } = this._pageToScaled(x, y);

    // Move cursor
    const cursor = this._els.cursor;
    cursor.classList.add('sp-cursor--visible');
    cursor.style.left = sx + 'px';
    cursor.style.top = sy + 'px';

    if (!silent) {
      this._spawnRagePulse(sx, sy);
    }
  }

  _handleScroll(d) {
    const iframe = this._els.iframe;
    const doc = iframe.contentDocument;
    if (!doc || !doc.documentElement) return;

    // Tracker sends {x: scrollX, y: scrollY}
    const x = d.x || d.scrollX || 0;
    const y = d.y || d.scrollY || 0;

    try {
      doc.documentElement.scrollTop = y;
      doc.documentElement.scrollLeft = x;
      if (doc.body) {
        doc.body.scrollTop = y;
        doc.body.scrollLeft = x;
      }
    } catch (_) { /* ignore */ }
  }

  _handleResize(d) {
    const w = d.w || d.width || d.innerWidth || this._viewportWidth;
    const h = d.h || d.height || d.innerHeight || this._viewportHeight;
    this._viewportWidth = w;
    this._viewportHeight = h;
    this._updateViewportScale();
  }

  _handleInput(d) {
    const iframe = this._els.iframe;
    const doc = iframe.contentDocument;
    if (!doc) return;

    const selector = d.selector || d.target;
    if (!selector) return;

    try {
      const el = doc.querySelector(selector);
      if (el) {
        const value = d.value || d.maskedValue || '';
        if (d.masked) {
          // Show masked placeholder
          el.value = value;
        } else if (el.tagName === 'SELECT') {
          el.value = value;
        } else if (el.type === 'checkbox' || el.type === 'radio') {
          el.checked = (value === 'checked' || !!d.checked);
        } else {
          el.value = value;
        }
      }
    } catch (_) { /* ignore */ }
  }

  _handlePageVisibility(d) {
    // Nothing visual to render; could dim the viewport
  }

  _handleIdentify(d) {
    // Update user info in the info bar if available
    const name = d.traits?.name || d.userName || d.userId || d.user_id;
    const email = d.traits?.email || d.userEmail;
    if (name || email) {
      const infoVal = this._els.infoBar.querySelector('.sp-info-value');
      if (infoVal) {
        infoVal.textContent = name || email;
      }
    }
  }

  _handlePageNavigation(d, silent) {
    // Tracker sends {from, to} for page navigations
    const url = d.to || d.url || d.href || '';
    const title = d.title || '';
    this._currentUrl = url;
    this._els.urlDisplay.textContent = url;

    if (!silent) {
      // Show page transition overlay
      this._showPageTransition(url || title);
    }
  }

  // ─── Visual Effects ──────────────────────────────────────

  _spawnTrail(x, y) {
    const trail = document.createElement('div');
    trail.className = 'sp-cursor-trail';
    trail.style.left = x + 'px';
    trail.style.top = y + 'px';
    this._els.cursorLayer.appendChild(trail);
    setTimeout(() => {
      if (trail.parentNode) trail.parentNode.removeChild(trail);
    }, 500);
  }

  _spawnClickRipple(x, y) {
    const layer = this._els.cursorLayer;

    // Outer ripple
    const ripple = document.createElement('div');
    ripple.className = 'sp-click-ripple';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    layer.appendChild(ripple);

    // Inner dot
    const dot = document.createElement('div');
    dot.className = 'sp-click-ripple--inner';
    dot.style.left = x + 'px';
    dot.style.top = y + 'px';
    layer.appendChild(dot);

    setTimeout(() => {
      if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
      if (dot.parentNode) dot.parentNode.removeChild(dot);
    }, 700);
  }

  _spawnRagePulse(x, y) {
    const layer = this._els.cursorLayer;

    // Multiple expanding rings for rage effect
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const pulse = document.createElement('div');
        pulse.className = 'sp-rage-pulse';
        pulse.style.left = x + 'px';
        pulse.style.top = y + 'px';
        layer.appendChild(pulse);

        setTimeout(() => {
          if (pulse.parentNode) pulse.parentNode.removeChild(pulse);
        }, 1000);
      }, i * 150);
    }

    // Inner red dot
    const inner = document.createElement('div');
    inner.className = 'sp-rage-pulse--inner';
    inner.style.left = x + 'px';
    inner.style.top = y + 'px';
    layer.appendChild(inner);

    setTimeout(() => {
      if (inner.parentNode) inner.parentNode.removeChild(inner);
    }, 1000);
  }

  _showPageTransition(text) {
    const overlay = document.createElement('div');
    overlay.className = 'sp-page-overlay';
    overlay.innerHTML = '<div class="sp-page-overlay-text">Navigating to ' + this._esc(text) + '</div>';
    this._els.vpScaler.appendChild(overlay);

    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 900);
  }

  _showSkipIndicator() {
    const indicator = this._els.skipIndicator;
    indicator.classList.add('sp-skip-indicator--visible');
    clearTimeout(this._skipIndicatorTimer);
    this._skipIndicatorTimer = setTimeout(() => {
      indicator.classList.remove('sp-skip-indicator--visible');
    }, 1200);
  }

  // ─── Coordinate Conversion ───────────────────────────────

  _pageToScaled(x, y) {
    const scaler = this._els.vpScaler;
    const scale = parseFloat(scaler.dataset.scale) || 1;
    return {
      sx: x * scale,
      sy: y * scale,
    };
  }

  _updateViewportScale() {
    const wrap = this._els.vpWrap;
    const scaler = this._els.vpScaler;
    if (!wrap || !scaler) return;

    const wrapRect = wrap.getBoundingClientRect();
    const availW = wrapRect.width - 32; // padding
    const availH = wrapRect.height - 32;

    if (availW <= 0 || availH <= 0) return;

    const vpW = this._viewportWidth || 1920;
    const vpH = this._viewportHeight || 1080;

    const scaleX = availW / vpW;
    const scaleY = availH / vpH;
    const scale = Math.min(scaleX, scaleY, 1); // Don't scale up

    const displayW = vpW * scale;
    const displayH = vpH * scale;

    scaler.style.width = displayW + 'px';
    scaler.style.height = displayH + 'px';
    scaler.dataset.scale = scale;

    // Set iframe to full viewport size, then scale down the scaler
    const iframe = this._els.iframe;
    iframe.style.width = vpW + 'px';
    iframe.style.height = vpH + 'px';
    iframe.style.transform = 'scale(' + scale + ')';
    iframe.style.transformOrigin = 'top left';

    // Cursor layer matches scaled size
    this._els.cursorLayer.style.width = displayW + 'px';
    this._els.cursorLayer.style.height = displayH + 'px';
  }

  // ─── UI Updates ──────────────────────────────────────────

  _updatePlayButton() {
    if (this._els.playBtn) {
      this._els.playBtn.innerHTML = this._playing ? this._getPauseIcon() : this._getPlayIcon();
      this._els.playBtn.setAttribute('aria-label', this._playing ? 'Pause' : 'Play');
    }
  }

  _updateSpeedButtons() {
    const btns = this._els.speedSelect.querySelectorAll('.sp-speed-btn');
    btns.forEach((btn) => {
      const s = parseInt(btn.dataset.speed, 10);
      btn.classList.toggle('sp-speed-btn--active', s === this.speed);
    });
  }

  _updateSkipToggle() {
    if (this._els.skipToggle) {
      this._els.skipToggle.classList.toggle('sp-skip-toggle--active', this.skipInactivityEnabled);
    }
  }

  _updateTimelinePosition(elapsed) {
    if (this._totalDuration === 0) return;
    const pct = Math.min(100, (elapsed / this._totalDuration) * 100);
    this._els.timelineProgress.style.width = pct + '%';
    this._els.timelineThumb.style.left = pct + '%';
  }

  _updateTimeDisplay(elapsed) {
    this._els.timeCurrent.textContent = this._formatTime(elapsed);
  }

  _highlightCurrentEvent() {
    const items = this._els.eventList.querySelectorAll('.sp-event-item');
    let lastActiveItem = null;

    items.forEach((item) => {
      const idx = parseInt(item.dataset.index, 10);
      const isActive = idx < this._currentIndex && idx >= this._currentIndex - 1;
      // Actually, highlight the most recent event we've played
      const isPast = idx < this._currentIndex;
      item.classList.remove('sp-event-item--active');

      if (isPast) {
        lastActiveItem = item;
      }
    });

    if (lastActiveItem) {
      lastActiveItem.classList.add('sp-event-item--active');
      // Scroll into view if needed
      const list = this._els.eventList;
      const itemTop = lastActiveItem.offsetTop;
      const itemBottom = itemTop + lastActiveItem.offsetHeight;
      const listTop = list.scrollTop;
      const listBottom = listTop + list.clientHeight;

      if (itemTop < listTop || itemBottom > listBottom) {
        lastActiveItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }

  _setPausedOverlay(show) {
    if (this._els.pausedOverlay) {
      this._els.pausedOverlay.classList.toggle('sp-paused-overlay--visible', show);
    }
  }

  _toggleFullscreen() {
    const root = this._els.root;
    if (root.classList.contains('sp-root--fullscreen')) {
      root.classList.remove('sp-root--fullscreen');
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } else {
      root.classList.add('sp-root--fullscreen');
      if (root.requestFullscreen) {
        root.requestFullscreen().catch(() => {});
      }
    }
    // Re-scale after transition
    setTimeout(() => this._updateViewportScale(), 100);
  }

  // ─── Reset / Recompute ───────────────────────────────────

  _resetRendering() {
    // Reset iframe
    const doc = this._els.iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write('<!DOCTYPE html><html><head></head><body></body></html>');
      doc.close();
    }

    // Clear node map
    this._nodeMap = new Map();

    // Hide cursor
    this._els.cursor.classList.remove('sp-cursor--visible');

    // Clear animations
    const layer = this._els.cursorLayer;
    const transient = layer.querySelectorAll('.sp-cursor-trail, .sp-click-ripple, .sp-click-ripple--inner, .sp-rage-pulse, .sp-rage-pulse--inner');
    transient.forEach((el) => el.parentNode.removeChild(el));

    // Clear page overlays
    const overlays = this._els.vpScaler.querySelectorAll('.sp-page-overlay');
    overlays.forEach((el) => el.parentNode.removeChild(el));
  }

  _recomputeAndRebuild() {
    const currentTime = this._elapsedAtPause;
    this._computeTimeline();
    this._buildTimeline();
    this._renderEventList();
    this.seekTo(Math.min(currentTime, this._totalDuration));
  }

  _renderInitialState() {
    // Process session_start if first event
    if (this.events.length > 0 && this.events[0].type === EVENT_TYPES.SESSION_START) {
      this._applyEvent(this.events[0], true);
    }
    this._updateViewportScale();
    this._els.timeTotal.textContent = this._formatTime(this._totalDuration);
    this._setPausedOverlay(true);
  }

  // ─── Helpers ─────────────────────────────────────────────

  _formatTime(ms) {
    if (!ms || ms < 0) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes + ':' + String(seconds).padStart(2, '0');
  }

  _formatDuration(ms) {
    if (!ms || ms < 0) return '0s';
    const totalSeconds = Math.floor(ms / 1000);
    if (totalSeconds < 60) return totalSeconds + 's';
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes < 60) return minutes + 'm ' + seconds + 's';
    const hours = Math.floor(minutes / 60);
    const remainMins = minutes % 60;
    return hours + 'h ' + remainMins + 'm';
  }

  _esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

// Export for use in other modules and also attach to window
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SessionPlayer, EVENT_TYPES, EVENT_TYPE_NAMES };
} else {
  window.SessionPlayer = SessionPlayer;
  window.SP_EVENT_TYPES = EVENT_TYPES;
  window.SP_EVENT_TYPE_NAMES = EVENT_TYPE_NAMES;
}
