/**
 * Regal Master Look - Survey Widget v1.0.0
 *
 * Self-contained, embeddable survey widget loaded dynamically by the tracker.
 * Supports NPS, CSAT, CES, Feedback, and Custom survey types.
 *
 * Usage (called by tracker.js):
 *   window.RMLSurveyWidget.init({ apiBase: 'https://...', projectId: '...', visitorId: '...', sessionId: '...' });
 *   window.RMLSurveyWidget.show(surveyId);  // optional: force-show a specific survey
 *   window.RMLSurveyWidget.destroy();
 */
(function () {
  'use strict';

  if (window.RMLSurveyWidget) return;

  // ---------------------------------------------------------------------------
  // Configuration & State
  // ---------------------------------------------------------------------------
  var config = {
    apiBase: '',
    projectId: 'default',
    visitorId: '',
    sessionId: '',
  };

  var activeSurveys = [];
  var currentSurvey = null;
  var widgetEl = null;
  var styleEl = null;
  var triggerTimers = [];
  var scrollHandler = null;
  var exitIntentHandler = null;
  var initialized = false;

  var STORAGE_KEY = 'rml_surveys_shown';

  // ---------------------------------------------------------------------------
  // Utility helpers
  // ---------------------------------------------------------------------------
  function getShownSurveys() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function markSurveyShown(surveyId) {
    try {
      var shown = getShownSurveys();
      shown[surveyId] = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shown));
    } catch (e) { /* */ }
  }

  function wasSurveyShown(surveyId) {
    var shown = getShownSurveys();
    return !!shown[surveyId];
  }

  function getDevice() {
    var w = window.innerWidth;
    if (w <= 768) return 'mobile';
    if (w <= 1024) return 'tablet';
    return 'desktop';
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }

  // ---------------------------------------------------------------------------
  // CSS Injection
  // ---------------------------------------------------------------------------
  function injectStyles() {
    if (styleEl) return;
    styleEl = document.createElement('style');
    styleEl.id = 'rml-survey-widget-styles';
    styleEl.textContent = [
      '.rml-sw-overlay {',
      '  position: fixed;',
      '  z-index: 2147483646;',
      '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;',
      '  font-size: 14px;',
      '  line-height: 1.5;',
      '  box-sizing: border-box;',
      '  transition: opacity 0.3s ease, transform 0.35s cubic-bezier(0.4,0,0.2,1);',
      '  opacity: 0;',
      '  pointer-events: none;',
      '}',
      '.rml-sw-overlay.rml-sw-visible {',
      '  opacity: 1;',
      '  pointer-events: auto;',
      '}',
      '.rml-sw-overlay.rml-sw-pos-bottom-right {',
      '  bottom: 20px; right: 20px;',
      '  transform: translateY(20px);',
      '}',
      '.rml-sw-overlay.rml-sw-pos-bottom-right.rml-sw-visible {',
      '  transform: translateY(0);',
      '}',
      '.rml-sw-overlay.rml-sw-pos-bottom-left {',
      '  bottom: 20px; left: 20px;',
      '  transform: translateY(20px);',
      '}',
      '.rml-sw-overlay.rml-sw-pos-bottom-left.rml-sw-visible {',
      '  transform: translateY(0);',
      '}',
      '.rml-sw-overlay.rml-sw-pos-center {',
      '  top: 0; left: 0; right: 0; bottom: 0;',
      '  display: flex; align-items: center; justify-content: center;',
      '  background: rgba(0,0,0,0.5);',
      '  transform: none;',
      '}',
      '.rml-sw-overlay.rml-sw-pos-slide-in {',
      '  top: 50%; right: 0;',
      '  transform: translate(100%, -50%);',
      '}',
      '.rml-sw-overlay.rml-sw-pos-slide-in.rml-sw-visible {',
      '  transform: translate(0, -50%);',
      '}',
      '.rml-sw-card {',
      '  width: 340px;',
      '  max-width: calc(100vw - 32px);',
      '  border-radius: 14px;',
      '  padding: 24px;',
      '  position: relative;',
      '  box-shadow: 0 8px 32px rgba(0,0,0,0.35);',
      '  box-sizing: border-box;',
      '}',
      '.rml-sw-card.rml-sw-dark {',
      '  background: #1a1a2e;',
      '  color: #e0e0e0;',
      '  border: 1px solid rgba(255,255,255,0.08);',
      '}',
      '.rml-sw-card.rml-sw-light {',
      '  background: #ffffff;',
      '  color: #1a1a2e;',
      '  border: 1px solid rgba(0,0,0,0.08);',
      '}',
      '.rml-sw-close {',
      '  position: absolute;',
      '  top: 10px; right: 12px;',
      '  background: transparent;',
      '  border: none;',
      '  cursor: pointer;',
      '  font-size: 18px;',
      '  line-height: 1;',
      '  padding: 4px;',
      '  opacity: 0.5;',
      '  transition: opacity 0.15s;',
      '}',
      '.rml-sw-close:hover { opacity: 1; }',
      '.rml-sw-dark .rml-sw-close { color: #888; }',
      '.rml-sw-light .rml-sw-close { color: #999; }',
      '.rml-sw-title {',
      '  font-size: 15px;',
      '  font-weight: 600;',
      '  margin: 0 0 16px 0;',
      '  padding-right: 24px;',
      '}',
      '.rml-sw-subtitle {',
      '  font-size: 12px;',
      '  margin: 0 0 12px 0;',
      '  opacity: 0.6;',
      '}',
      /* NPS Buttons */
      '.rml-sw-nps-row {',
      '  display: flex;',
      '  gap: 4px;',
      '  flex-wrap: wrap;',
      '  justify-content: center;',
      '  margin-bottom: 6px;',
      '}',
      '.rml-sw-nps-btn {',
      '  width: 28px; height: 28px;',
      '  border-radius: 6px;',
      '  border: 1px solid rgba(255,255,255,0.1);',
      '  cursor: pointer;',
      '  font-size: 11px;',
      '  font-weight: 700;',
      '  display: flex; align-items: center; justify-content: center;',
      '  transition: all 0.15s;',
      '  background: transparent;',
      '}',
      '.rml-sw-dark .rml-sw-nps-btn { color: #ccc; border-color: rgba(255,255,255,0.1); }',
      '.rml-sw-light .rml-sw-nps-btn { color: #333; border-color: rgba(0,0,0,0.12); }',
      '.rml-sw-nps-btn.rml-sw-selected { background: #4361ee; color: #fff; border-color: #4361ee; }',
      '.rml-sw-nps-btn:hover { border-color: #4361ee; }',
      '.rml-sw-nps-labels {',
      '  display: flex;',
      '  justify-content: space-between;',
      '  margin-bottom: 12px;',
      '}',
      '.rml-sw-nps-labels span {',
      '  font-size: 10px;',
      '  opacity: 0.5;',
      '}',
      /* Stars */
      '.rml-sw-stars {',
      '  display: flex;',
      '  gap: 6px;',
      '  justify-content: center;',
      '  margin-bottom: 14px;',
      '}',
      '.rml-sw-star {',
      '  font-size: 28px;',
      '  cursor: pointer;',
      '  transition: transform 0.15s, color 0.15s;',
      '  background: transparent;',
      '  border: none;',
      '  padding: 0;',
      '  line-height: 1;',
      '}',
      '.rml-sw-star:hover { transform: scale(1.2); }',
      '.rml-sw-dark .rml-sw-star { color: #444; }',
      '.rml-sw-light .rml-sw-star { color: #ccc; }',
      '.rml-sw-star.rml-sw-filled { color: #f59e0b; }',
      /* CES Scale */
      '.rml-sw-ces-row {',
      '  display: flex;',
      '  gap: 6px;',
      '  justify-content: center;',
      '  margin-bottom: 6px;',
      '}',
      '.rml-sw-ces-btn {',
      '  width: 34px; height: 34px;',
      '  border-radius: 50%;',
      '  border: 1px solid rgba(67,97,238,0.25);',
      '  cursor: pointer;',
      '  font-size: 13px;',
      '  font-weight: 600;',
      '  display: flex; align-items: center; justify-content: center;',
      '  transition: all 0.15s;',
      '  background: transparent;',
      '}',
      '.rml-sw-dark .rml-sw-ces-btn { color: #4361ee; }',
      '.rml-sw-light .rml-sw-ces-btn { color: #4361ee; }',
      '.rml-sw-ces-btn.rml-sw-selected { background: #4361ee; color: #fff; border-color: #4361ee; }',
      '.rml-sw-ces-btn:hover { border-color: #4361ee; background: rgba(67,97,238,0.1); }',
      /* Textarea */
      '.rml-sw-textarea {',
      '  width: 100%;',
      '  min-height: 80px;',
      '  border-radius: 8px;',
      '  padding: 10px 12px;',
      '  font-size: 13px;',
      '  font-family: inherit;',
      '  resize: vertical;',
      '  outline: none;',
      '  box-sizing: border-box;',
      '  margin-bottom: 12px;',
      '  transition: border-color 0.15s;',
      '}',
      '.rml-sw-dark .rml-sw-textarea {',
      '  background: rgba(255,255,255,0.04);',
      '  border: 1px solid rgba(255,255,255,0.1);',
      '  color: #e0e0e0;',
      '}',
      '.rml-sw-light .rml-sw-textarea {',
      '  background: #f8f9fa;',
      '  border: 1px solid rgba(0,0,0,0.1);',
      '  color: #1a1a2e;',
      '}',
      '.rml-sw-textarea:focus {',
      '  border-color: #4361ee;',
      '}',
      /* Submit Button */
      '.rml-sw-submit {',
      '  width: 100%;',
      '  padding: 10px;',
      '  border: none;',
      '  border-radius: 8px;',
      '  background: #4361ee;',
      '  color: #fff;',
      '  font-size: 13px;',
      '  font-weight: 600;',
      '  cursor: pointer;',
      '  transition: opacity 0.15s;',
      '}',
      '.rml-sw-submit:hover { opacity: 0.85; }',
      '.rml-sw-submit:disabled { opacity: 0.4; cursor: default; }',
      /* Thank you */
      '.rml-sw-thankyou {',
      '  text-align: center;',
      '  padding: 20px 0;',
      '}',
      '.rml-sw-thankyou-icon {',
      '  font-size: 40px;',
      '  margin-bottom: 12px;',
      '}',
      '.rml-sw-thankyou-title {',
      '  font-size: 16px;',
      '  font-weight: 700;',
      '  margin: 0 0 6px 0;',
      '}',
      '.rml-sw-thankyou-sub {',
      '  font-size: 12px;',
      '  opacity: 0.6;',
      '  margin: 0;',
      '}',
      /* Custom question items */
      '.rml-sw-question {',
      '  margin-bottom: 16px;',
      '}',
      '.rml-sw-question-label {',
      '  font-size: 13px;',
      '  font-weight: 600;',
      '  margin-bottom: 8px;',
      '}',
      '.rml-sw-input {',
      '  width: 100%;',
      '  padding: 8px 10px;',
      '  border-radius: 6px;',
      '  font-size: 13px;',
      '  font-family: inherit;',
      '  outline: none;',
      '  box-sizing: border-box;',
      '  transition: border-color 0.15s;',
      '}',
      '.rml-sw-dark .rml-sw-input {',
      '  background: rgba(255,255,255,0.04);',
      '  border: 1px solid rgba(255,255,255,0.1);',
      '  color: #e0e0e0;',
      '}',
      '.rml-sw-light .rml-sw-input {',
      '  background: #f8f9fa;',
      '  border: 1px solid rgba(0,0,0,0.1);',
      '  color: #1a1a2e;',
      '}',
      '.rml-sw-input:focus { border-color: #4361ee; }',
      '.rml-sw-select { cursor: pointer; }',
      '.rml-sw-option-group {',
      '  display: flex;',
      '  flex-direction: column;',
      '  gap: 6px;',
      '}',
      '.rml-sw-option-item {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 8px;',
      '  cursor: pointer;',
      '  font-size: 13px;',
      '  padding: 6px 10px;',
      '  border-radius: 6px;',
      '  transition: background 0.15s;',
      '}',
      '.rml-sw-dark .rml-sw-option-item:hover { background: rgba(255,255,255,0.04); }',
      '.rml-sw-light .rml-sw-option-item:hover { background: rgba(0,0,0,0.03); }',
      '.rml-sw-rating-row {',
      '  display: flex;',
      '  gap: 4px;',
      '  justify-content: center;',
      '}',
      '.rml-sw-rating-btn {',
      '  width: 32px; height: 32px;',
      '  border-radius: 6px;',
      '  border: 1px solid rgba(67,97,238,0.25);',
      '  cursor: pointer;',
      '  font-size: 12px;',
      '  font-weight: 600;',
      '  display: flex; align-items: center; justify-content: center;',
      '  transition: all 0.15s;',
      '  background: transparent;',
      '  color: #4361ee;',
      '}',
      '.rml-sw-rating-btn.rml-sw-selected { background: #4361ee; color: #fff; border-color: #4361ee; }',
      '.rml-sw-rating-btn:hover { border-color: #4361ee; background: rgba(67,97,238,0.1); }',
      /* Followup area */
      '.rml-sw-followup {',
      '  margin-top: 14px;',
      '}',
      '.rml-sw-followup-label {',
      '  font-size: 12px;',
      '  margin-bottom: 6px;',
      '  opacity: 0.7;',
      '}',
      /* Mobile responsive */
      '@media (max-width: 480px) {',
      '  .rml-sw-overlay.rml-sw-pos-bottom-right,',
      '  .rml-sw-overlay.rml-sw-pos-bottom-left,',
      '  .rml-sw-overlay.rml-sw-pos-slide-in {',
      '    left: 0 !important;',
      '    right: 0 !important;',
      '    bottom: 0 !important;',
      '    top: auto !important;',
      '    transform: translateY(100%) !important;',
      '  }',
      '  .rml-sw-overlay.rml-sw-pos-bottom-right.rml-sw-visible,',
      '  .rml-sw-overlay.rml-sw-pos-bottom-left.rml-sw-visible,',
      '  .rml-sw-overlay.rml-sw-pos-slide-in.rml-sw-visible {',
      '    transform: translateY(0) !important;',
      '  }',
      '  .rml-sw-card {',
      '    width: 100% !important;',
      '    max-width: 100% !important;',
      '    border-radius: 14px 14px 0 0 !important;',
      '  }',
      '}',
    ].join('\n');
    document.head.appendChild(styleEl);
  }

  // ---------------------------------------------------------------------------
  // API helpers
  // ---------------------------------------------------------------------------
  function fetchJSON(url, opts) {
    opts = opts || {};
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open(opts.method || 'GET', url, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)); } catch (e) { reject(e); }
        } else {
          reject(new Error('HTTP ' + xhr.status));
        }
      };
      xhr.onerror = function () { reject(new Error('Network error')); };
      xhr.send(opts.body ? JSON.stringify(opts.body) : null);
    });
  }

  function apiUrl(path) {
    var base = config.apiBase.replace(/\/$/, '');
    return base + path;
  }

  // ---------------------------------------------------------------------------
  // Fetch active surveys
  // ---------------------------------------------------------------------------
  function fetchActiveSurveys() {
    var url = apiUrl('/api/surveys/active?project_id=' + encodeURIComponent(config.projectId));
    if (config.visitorId) url += '&visitor_id=' + encodeURIComponent(config.visitorId);
    url += '&url=' + encodeURIComponent(window.location.href);
    url += '&device=' + encodeURIComponent(getDevice());

    return fetchJSON(url).then(function (data) {
      activeSurveys = (data.surveys || []).filter(function (s) {
        return !wasSurveyShown(s.id);
      });
      return activeSurveys;
    }).catch(function () {
      activeSurveys = [];
      return [];
    });
  }

  // ---------------------------------------------------------------------------
  // Trigger management
  // ---------------------------------------------------------------------------
  function setupTriggers() {
    clearTriggers();

    activeSurveys.forEach(function (survey) {
      var trigger = survey.trigger_type;
      var tConfig = survey.trigger_config || {};

      if (trigger === 'manual') {
        // No auto-trigger; show only via RMLSurveyWidget.show()
        return;
      }

      if (trigger === 'time_on_page') {
        var seconds = parseInt(tConfig.seconds, 10) || 30;
        var timer = setTimeout(function () {
          showSurvey(survey);
        }, seconds * 1000);
        triggerTimers.push(timer);
      }

      if (trigger === 'scroll_pct') {
        var targetPct = parseInt(tConfig.scroll_pct, 10) || 50;
        if (!scrollHandler) {
          scrollHandler = function () {
            var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            var docHeight = Math.max(
              document.body.scrollHeight, document.documentElement.scrollHeight,
              document.body.offsetHeight, document.documentElement.offsetHeight
            );
            var winHeight = window.innerHeight;
            var pct = docHeight > winHeight ? (scrollTop / (docHeight - winHeight)) * 100 : 100;

            activeSurveys.forEach(function (s) {
              if (s.trigger_type === 'scroll_pct' && !wasSurveyShown(s.id) && !currentSurvey) {
                var sPct = parseInt((s.trigger_config || {}).scroll_pct, 10) || 50;
                if (pct >= sPct) {
                  showSurvey(s);
                }
              }
            });
          };
          window.addEventListener('scroll', scrollHandler, { passive: true });
        }
      }

      if (trigger === 'exit_intent') {
        if (!exitIntentHandler) {
          exitIntentHandler = function (e) {
            if (e.clientY <= 5 && !currentSurvey) {
              // Find first exit_intent survey not yet shown
              for (var i = 0; i < activeSurveys.length; i++) {
                if (activeSurveys[i].trigger_type === 'exit_intent' && !wasSurveyShown(activeSurveys[i].id)) {
                  showSurvey(activeSurveys[i]);
                  break;
                }
              }
            }
          };
          document.addEventListener('mouseleave', exitIntentHandler);
        }
      }

      if (trigger === 'page_url') {
        var urlPattern = tConfig.url_pattern || '';
        if (urlPattern) {
          try {
            var re = new RegExp(urlPattern);
            if (re.test(window.location.href) || re.test(window.location.pathname)) {
              // Show after a brief delay
              var urlTimer = setTimeout(function () {
                if (!currentSurvey) showSurvey(survey);
              }, 1000);
              triggerTimers.push(urlTimer);
            }
          } catch (e) { /* invalid regex */ }
        }
      }
    });
  }

  function clearTriggers() {
    triggerTimers.forEach(function (t) { clearTimeout(t); });
    triggerTimers = [];

    if (scrollHandler) {
      window.removeEventListener('scroll', scrollHandler);
      scrollHandler = null;
    }
    if (exitIntentHandler) {
      document.removeEventListener('mouseleave', exitIntentHandler);
      exitIntentHandler = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Render Survey Widget
  // ---------------------------------------------------------------------------
  function showSurvey(survey) {
    if (currentSurvey) return; // Only one at a time
    if (wasSurveyShown(survey.id)) return;

    currentSurvey = survey;
    markSurveyShown(survey.id);

    var appearance = survey.appearance || {};
    var position = appearance.position || 'bottom-right';
    var theme = appearance.theme || 'dark';

    // Create overlay
    widgetEl = document.createElement('div');
    widgetEl.className = 'rml-sw-overlay rml-sw-pos-' + position;
    widgetEl.setAttribute('data-survey-id', survey.id);

    // Create card
    var card = document.createElement('div');
    card.className = 'rml-sw-card rml-sw-' + theme;

    // Close button
    var closeBtn = document.createElement('button');
    closeBtn.className = 'rml-sw-close';
    closeBtn.innerHTML = '&#215;';
    closeBtn.setAttribute('aria-label', 'Close survey');
    closeBtn.addEventListener('click', function () { dismissWidget(); });
    card.appendChild(closeBtn);

    // Render survey body based on type
    var bodyEl = document.createElement('div');
    bodyEl.className = 'rml-sw-body';

    switch (survey.type) {
      case 'nps':   renderNPS(bodyEl, survey, theme); break;
      case 'csat':  renderCSAT(bodyEl, survey, theme); break;
      case 'ces':   renderCES(bodyEl, survey, theme); break;
      case 'feedback': renderFeedback(bodyEl, survey, theme); break;
      case 'custom': renderCustom(bodyEl, survey, theme); break;
      default: renderFeedback(bodyEl, survey, theme);
    }

    card.appendChild(bodyEl);
    widgetEl.appendChild(card);
    document.body.appendChild(widgetEl);

    // Animate in
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        widgetEl.classList.add('rml-sw-visible');
      });
    });
  }

  // ---------------------------------------------------------------------------
  // NPS Survey (0-10)
  // ---------------------------------------------------------------------------
  function renderNPS(container, survey, theme) {
    var selectedScore = null;

    var title = document.createElement('div');
    title.className = 'rml-sw-title';
    title.textContent = 'How likely are you to recommend us?';
    container.appendChild(title);

    // Score buttons
    var row = document.createElement('div');
    row.className = 'rml-sw-nps-row';

    for (var i = 0; i <= 10; i++) {
      (function (score) {
        var btn = document.createElement('button');
        btn.className = 'rml-sw-nps-btn';
        btn.textContent = score;
        btn.addEventListener('click', function () {
          selectedScore = score;
          // Highlight selected
          var allBtns = row.querySelectorAll('.rml-sw-nps-btn');
          for (var j = 0; j < allBtns.length; j++) {
            allBtns[j].classList.remove('rml-sw-selected');
          }
          btn.classList.add('rml-sw-selected');
          // Show followup
          var followup = container.querySelector('.rml-sw-followup');
          if (followup) followup.style.display = 'block';
          // Enable submit
          var submitBtn = container.querySelector('.rml-sw-submit');
          if (submitBtn) submitBtn.disabled = false;
        });
        row.appendChild(btn);
      })(i);
    }
    container.appendChild(row);

    // Labels
    var labels = document.createElement('div');
    labels.className = 'rml-sw-nps-labels';
    var lbl1 = document.createElement('span');
    lbl1.textContent = 'Not likely';
    var lbl2 = document.createElement('span');
    lbl2.textContent = 'Very likely';
    labels.appendChild(lbl1);
    labels.appendChild(lbl2);
    container.appendChild(labels);

    // Optional follow-up text
    var followup = document.createElement('div');
    followup.className = 'rml-sw-followup';
    followup.style.display = 'none';
    var flabel = document.createElement('div');
    flabel.className = 'rml-sw-followup-label';
    flabel.textContent = 'Tell us more (optional)';
    followup.appendChild(flabel);
    var textarea = document.createElement('textarea');
    textarea.className = 'rml-sw-textarea';
    textarea.placeholder = 'What could we improve?';
    textarea.rows = 3;
    followup.appendChild(textarea);
    container.appendChild(followup);

    // Submit button
    var submitBtn = document.createElement('button');
    submitBtn.className = 'rml-sw-submit';
    submitBtn.textContent = 'Submit';
    submitBtn.disabled = true;
    submitBtn.addEventListener('click', function () {
      if (selectedScore === null) return;
      submitResponse(survey.id, {
        score: selectedScore,
        feedback: textarea.value || '',
        answers: {},
      }, container);
    });
    container.appendChild(submitBtn);
  }

  // ---------------------------------------------------------------------------
  // CSAT Survey (1-5 stars)
  // ---------------------------------------------------------------------------
  function renderCSAT(container, survey, theme) {
    var selectedScore = null;

    var title = document.createElement('div');
    title.className = 'rml-sw-title';
    title.textContent = 'How satisfied are you?';
    container.appendChild(title);

    var starsRow = document.createElement('div');
    starsRow.className = 'rml-sw-stars';

    for (var i = 1; i <= 5; i++) {
      (function (score) {
        var star = document.createElement('button');
        star.className = 'rml-sw-star';
        star.innerHTML = '&#9733;';
        star.setAttribute('aria-label', score + ' star' + (score > 1 ? 's' : ''));
        star.addEventListener('click', function () {
          selectedScore = score;
          updateStars(starsRow, score);
          var followup = container.querySelector('.rml-sw-followup');
          if (followup) followup.style.display = 'block';
          var submitBtn = container.querySelector('.rml-sw-submit');
          if (submitBtn) submitBtn.disabled = false;
        });
        star.addEventListener('mouseenter', function () {
          updateStars(starsRow, score);
        });
        star.addEventListener('mouseleave', function () {
          updateStars(starsRow, selectedScore || 0);
        });
        starsRow.appendChild(star);
      })(i);
    }
    container.appendChild(starsRow);

    // Follow-up
    var followup = document.createElement('div');
    followup.className = 'rml-sw-followup';
    followup.style.display = 'none';
    var flabel = document.createElement('div');
    flabel.className = 'rml-sw-followup-label';
    flabel.textContent = 'Any additional comments? (optional)';
    followup.appendChild(flabel);
    var textarea = document.createElement('textarea');
    textarea.className = 'rml-sw-textarea';
    textarea.placeholder = 'Share your thoughts...';
    textarea.rows = 3;
    followup.appendChild(textarea);
    container.appendChild(followup);

    // Submit
    var submitBtn = document.createElement('button');
    submitBtn.className = 'rml-sw-submit';
    submitBtn.textContent = 'Submit';
    submitBtn.disabled = true;
    submitBtn.addEventListener('click', function () {
      if (selectedScore === null) return;
      submitResponse(survey.id, {
        score: selectedScore,
        feedback: textarea.value || '',
        answers: {},
      }, container);
    });
    container.appendChild(submitBtn);
  }

  function updateStars(starsRow, score) {
    var stars = starsRow.querySelectorAll('.rml-sw-star');
    for (var i = 0; i < stars.length; i++) {
      if (i < score) {
        stars[i].classList.add('rml-sw-filled');
      } else {
        stars[i].classList.remove('rml-sw-filled');
      }
    }
  }

  // ---------------------------------------------------------------------------
  // CES Survey (1-7 scale)
  // ---------------------------------------------------------------------------
  function renderCES(container, survey, theme) {
    var selectedScore = null;

    var title = document.createElement('div');
    title.className = 'rml-sw-title';
    title.textContent = 'How easy was it to complete your task?';
    container.appendChild(title);

    var row = document.createElement('div');
    row.className = 'rml-sw-ces-row';

    for (var i = 1; i <= 7; i++) {
      (function (score) {
        var btn = document.createElement('button');
        btn.className = 'rml-sw-ces-btn';
        btn.textContent = score;
        btn.addEventListener('click', function () {
          selectedScore = score;
          var allBtns = row.querySelectorAll('.rml-sw-ces-btn');
          for (var j = 0; j < allBtns.length; j++) {
            allBtns[j].classList.remove('rml-sw-selected');
          }
          btn.classList.add('rml-sw-selected');
          var followup = container.querySelector('.rml-sw-followup');
          if (followup) followup.style.display = 'block';
          var submitBtn = container.querySelector('.rml-sw-submit');
          if (submitBtn) submitBtn.disabled = false;
        });
        row.appendChild(btn);
      })(i);
    }
    container.appendChild(row);

    // Scale labels
    var labels = document.createElement('div');
    labels.className = 'rml-sw-nps-labels';
    var lbl1 = document.createElement('span');
    lbl1.textContent = 'Very difficult';
    var lbl2 = document.createElement('span');
    lbl2.textContent = 'Very easy';
    labels.appendChild(lbl1);
    labels.appendChild(lbl2);
    container.appendChild(labels);

    // Follow-up
    var followup = document.createElement('div');
    followup.className = 'rml-sw-followup';
    followup.style.display = 'none';
    var flabel = document.createElement('div');
    flabel.className = 'rml-sw-followup-label';
    flabel.textContent = 'Any additional feedback? (optional)';
    followup.appendChild(flabel);
    var textarea = document.createElement('textarea');
    textarea.className = 'rml-sw-textarea';
    textarea.placeholder = 'Tell us more...';
    textarea.rows = 3;
    followup.appendChild(textarea);
    container.appendChild(followup);

    // Submit
    var submitBtn = document.createElement('button');
    submitBtn.className = 'rml-sw-submit';
    submitBtn.textContent = 'Submit';
    submitBtn.disabled = true;
    submitBtn.addEventListener('click', function () {
      if (selectedScore === null) return;
      submitResponse(survey.id, {
        score: selectedScore,
        feedback: textarea.value || '',
        answers: {},
      }, container);
    });
    container.appendChild(submitBtn);
  }

  // ---------------------------------------------------------------------------
  // Feedback Survey (open text)
  // ---------------------------------------------------------------------------
  function renderFeedback(container, survey, theme) {
    var title = document.createElement('div');
    title.className = 'rml-sw-title';
    title.textContent = survey.name || "We'd love your feedback";
    container.appendChild(title);

    var textarea = document.createElement('textarea');
    textarea.className = 'rml-sw-textarea';
    textarea.placeholder = 'Share your thoughts, suggestions, or issues...';
    textarea.rows = 4;
    container.appendChild(textarea);

    var submitBtn = document.createElement('button');
    submitBtn.className = 'rml-sw-submit';
    submitBtn.textContent = 'Submit Feedback';
    submitBtn.addEventListener('click', function () {
      var text = textarea.value.trim();
      if (!text) return;
      submitResponse(survey.id, {
        score: null,
        feedback: text,
        answers: {},
      }, container);
    });
    container.appendChild(submitBtn);
  }

  // ---------------------------------------------------------------------------
  // Custom Survey (multi-question)
  // ---------------------------------------------------------------------------
  function renderCustom(container, survey, theme) {
    var questions = survey.questions || [];
    var answers = {};

    var title = document.createElement('div');
    title.className = 'rml-sw-title';
    title.textContent = survey.name || 'Quick Survey';
    container.appendChild(title);

    questions.forEach(function (q, idx) {
      var qDiv = document.createElement('div');
      qDiv.className = 'rml-sw-question';

      var label = document.createElement('div');
      label.className = 'rml-sw-question-label';
      label.textContent = (idx + 1) + '. ' + (q.text || 'Question');
      qDiv.appendChild(label);

      if (q.type === 'text') {
        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'rml-sw-input';
        input.placeholder = 'Your answer...';
        input.addEventListener('input', function () {
          answers['q' + idx] = input.value;
        });
        qDiv.appendChild(input);

      } else if (q.type === 'rating') {
        var rRow = document.createElement('div');
        rRow.className = 'rml-sw-rating-row';
        for (var r = 1; r <= 5; r++) {
          (function (val) {
            var btn = document.createElement('button');
            btn.className = 'rml-sw-rating-btn';
            btn.textContent = val;
            btn.addEventListener('click', function () {
              answers['q' + idx] = val;
              var allBtns = rRow.querySelectorAll('.rml-sw-rating-btn');
              for (var j = 0; j < allBtns.length; j++) {
                allBtns[j].classList.remove('rml-sw-selected');
              }
              btn.classList.add('rml-sw-selected');
            });
            rRow.appendChild(btn);
          })(r);
        }
        qDiv.appendChild(rRow);

      } else if (q.type === 'select') {
        var optGroup = document.createElement('div');
        optGroup.className = 'rml-sw-option-group';
        (q.options || []).forEach(function (opt) {
          var optItem = document.createElement('label');
          optItem.className = 'rml-sw-option-item';
          var radio = document.createElement('input');
          radio.type = 'radio';
          radio.name = 'rml-q' + idx;
          radio.value = opt;
          radio.addEventListener('change', function () {
            answers['q' + idx] = opt;
          });
          optItem.appendChild(radio);
          var optText = document.createElement('span');
          optText.textContent = opt;
          optItem.appendChild(optText);
          optGroup.appendChild(optItem);
        });
        qDiv.appendChild(optGroup);

      } else if (q.type === 'multi-select') {
        answers['q' + idx] = [];
        var msGroup = document.createElement('div');
        msGroup.className = 'rml-sw-option-group';
        (q.options || []).forEach(function (opt) {
          var optItem = document.createElement('label');
          optItem.className = 'rml-sw-option-item';
          var checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.value = opt;
          checkbox.addEventListener('change', function () {
            if (checkbox.checked) {
              answers['q' + idx].push(opt);
            } else {
              answers['q' + idx] = answers['q' + idx].filter(function (v) { return v !== opt; });
            }
          });
          optItem.appendChild(checkbox);
          var optText = document.createElement('span');
          optText.textContent = opt;
          optItem.appendChild(optText);
          msGroup.appendChild(optItem);
        });
        qDiv.appendChild(msGroup);
      }

      container.appendChild(qDiv);
    });

    // Submit
    var submitBtn = document.createElement('button');
    submitBtn.className = 'rml-sw-submit';
    submitBtn.textContent = 'Submit';
    submitBtn.addEventListener('click', function () {
      submitResponse(survey.id, {
        score: null,
        feedback: '',
        answers: answers,
      }, container);
    });
    container.appendChild(submitBtn);
  }

  // ---------------------------------------------------------------------------
  // Submit response
  // ---------------------------------------------------------------------------
  function submitResponse(surveyId, data, container) {
    var submitBtn = container.querySelector('.rml-sw-submit');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';
    }

    var payload = {
      session_id: config.sessionId,
      visitor_id: config.visitorId,
      score: data.score,
      feedback: data.feedback,
      answers: data.answers,
      page_url: window.location.href,
    };

    fetchJSON(apiUrl('/api/surveys/' + surveyId + '/respond'), {
      method: 'POST',
      body: payload,
    }).then(function () {
      showThankYou(container);
    }).catch(function () {
      // Still show thank you even on failure to not frustrate the user
      showThankYou(container);
    });
  }

  // ---------------------------------------------------------------------------
  // Thank you screen
  // ---------------------------------------------------------------------------
  function showThankYou(container) {
    container.innerHTML = '';

    var thankYou = document.createElement('div');
    thankYou.className = 'rml-sw-thankyou';

    var icon = document.createElement('div');
    icon.className = 'rml-sw-thankyou-icon';
    icon.textContent = '\u2714';
    thankYou.appendChild(icon);

    var titleEl = document.createElement('div');
    titleEl.className = 'rml-sw-thankyou-title';
    titleEl.textContent = 'Thank you!';
    thankYou.appendChild(titleEl);

    var sub = document.createElement('p');
    sub.className = 'rml-sw-thankyou-sub';
    sub.textContent = 'Your feedback helps us improve.';
    thankYou.appendChild(sub);

    container.appendChild(thankYou);

    // Auto-dismiss after 2.5 seconds
    setTimeout(function () {
      dismissWidget();
    }, 2500);
  }

  // ---------------------------------------------------------------------------
  // Dismiss
  // ---------------------------------------------------------------------------
  function dismissWidget() {
    if (!widgetEl) return;

    widgetEl.classList.remove('rml-sw-visible');

    setTimeout(function () {
      if (widgetEl && widgetEl.parentNode) {
        widgetEl.parentNode.removeChild(widgetEl);
      }
      widgetEl = null;
      currentSurvey = null;
    }, 400);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  window.RMLSurveyWidget = {
    /**
     * Initialize the survey widget.
     * @param {Object} cfg - Configuration object
     * @param {string} cfg.apiBase - Base URL for the API (e.g., 'https://regal-master-look.vercel.app')
     * @param {string} cfg.projectId - Project identifier
     * @param {string} cfg.visitorId - Unique visitor identifier
     * @param {string} cfg.sessionId - Current session identifier
     */
    init: function (cfg) {
      if (initialized) return;
      initialized = true;

      config.apiBase = cfg.apiBase || '';
      config.projectId = cfg.projectId || 'default';
      config.visitorId = cfg.visitorId || '';
      config.sessionId = cfg.sessionId || '';

      injectStyles();

      // Wait for DOM ready then fetch and set up triggers
      function boot() {
        fetchActiveSurveys().then(function () {
          if (activeSurveys.length > 0) {
            setupTriggers();
          }
        });
      }

      if (document.readyState !== 'loading') {
        boot();
      } else {
        document.addEventListener('DOMContentLoaded', boot);
      }
    },

    /**
     * Force-show a specific survey by ID.
     * @param {string} surveyId - The survey UUID to display
     */
    show: function (surveyId) {
      if (currentSurvey) return;

      // Check if we already have it in activeSurveys
      var survey = null;
      for (var i = 0; i < activeSurveys.length; i++) {
        if (activeSurveys[i].id === surveyId) {
          survey = activeSurveys[i];
          break;
        }
      }

      if (survey) {
        showSurvey(survey);
      } else {
        // Fetch from widget endpoint
        fetchJSON(apiUrl('/api/surveys/' + surveyId + '/widget')).then(function (data) {
          if (data.survey) {
            injectStyles();
            showSurvey(data.survey);
          }
        }).catch(function () {
          // Silently fail
        });
      }
    },

    /**
     * Destroy the widget, remove DOM elements, and clear all triggers.
     */
    destroy: function () {
      clearTriggers();
      dismissWidget();

      if (styleEl && styleEl.parentNode) {
        styleEl.parentNode.removeChild(styleEl);
        styleEl = null;
      }

      activeSurveys = [];
      currentSurvey = null;
      initialized = false;
    },
  };

})();
