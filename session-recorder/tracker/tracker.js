/**
 * Regal Master Look Tracker v1.0.0
 * Self-contained client-side session recording script.
 * Embed via <script src="/tracker/tracker.js"></script>
 * Initialize: window.RegalMasterLook.init({ projectId: 'xxx' })
 */
(function () {
  'use strict';

  // Guard against double-initialization
  if (window.__RML_INITIALIZED__) return;
  window.__RML_INITIALIZED__ = true;

  // Event type codes
  var EVT = {
    SESSION_START:    0,
    DOM_SNAPSHOT:     1,
    DOM_MUTATION:     2,
    MOUSE_MOVE:       3,
    MOUSE_CLICK:      4,
    SCROLL:           5,
    RESIZE:           6,
    INPUT:            7,
    PAGE_VISIBILITY:  8,
    RAGE_CLICK:       9,
    DEAD_CLICK:      10,
    JS_ERROR:        11,
    CUSTOM_EVENT:    12,
    IDENTIFY:        13,
    PAGE_NAVIGATION: 14
  };

  // Utility helpers

  /** Generate a UUID v4 without external dependencies. */
  function uuidv4() {
    // Use crypto.getRandomValues when available for better entropy
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      var buf = new Uint8Array(16);
      crypto.getRandomValues(buf);
      buf[6] = (buf[6] & 0x0f) | 0x40; // version 4
      buf[8] = (buf[8] & 0x3f) | 0x80; // variant 1
      var hex = '';
      for (var i = 0; i < 16; i++) {
        var h = buf[i].toString(16);
        hex += h.length === 1 ? '0' + h : h;
      }
      return (
        hex.slice(0, 8) + '-' +
        hex.slice(8, 12) + '-' +
        hex.slice(12, 16) + '-' +
        hex.slice(16, 20) + '-' +
        hex.slice(20)
      );
    }
    // Fallback using Math.random
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  /** Current high-resolution timestamp in ms since session start. */
  function relativeTime() {
    return Math.round(performance.now());
  }

  /** Absolute timestamp (Unix epoch ms). */
  function now() {
    return Date.now();
  }

  /** Simple throttle – returns a wrapper that fires at most once per `wait` ms. */
  function throttle(fn, wait) {
    var lastTime = 0;
    var timer = null;
    return function () {
      var context = this;
      var args = arguments;
      var elapsed = performance.now() - lastTime;
      if (elapsed >= wait) {
        lastTime = performance.now();
        fn.apply(context, args);
      } else if (!timer) {
        timer = setTimeout(function () {
          lastTime = performance.now();
          timer = null;
          fn.apply(context, args);
        }, wait - elapsed);
      }
    };
  }

  /** Build a short CSS-like selector for a DOM element. */
  function getSelector(el) {
    if (!el || el.nodeType !== 1) return '';
    try {
      if (el.id) return '#' + el.id;
      var parts = [];
      while (el && el.nodeType === 1) {
        var selector = el.nodeName.toLowerCase();
        if (el.id) {
          parts.unshift('#' + el.id);
          break;
        }
        if (el.className && typeof el.className === 'string') {
          var cls = el.className.trim().split(/\s+/).slice(0, 2).join('.');
          if (cls) selector += '.' + cls;
        }
        var parent = el.parentElement;
        if (parent) {
          var siblings = parent.children;
          if (siblings.length > 1) {
            var idx = 0;
            for (var i = 0; i < siblings.length; i++) {
              if (siblings[i] === el) { idx = i + 1; break; }
            }
            selector += ':nth-child(' + idx + ')';
          }
        }
        parts.unshift(selector);
        el = parent;
        if (parts.length >= 4) break; // keep selectors short
      }
      return parts.join(' > ');
    } catch (e) {
      return '';
    }
  }

  /** Check if an element or any ancestor has data-rml-ignore. */
  function isIgnored(el) {
    if (!el || el.nodeType !== 1) return false;
    try {
      var node = el;
      while (node && node.nodeType === 1) {
        if (node.hasAttribute && node.hasAttribute('data-rml-ignore')) return true;
        node = node.parentElement;
      }
    } catch (e) { /* cross-origin frame, etc. */ }
    return false;
  }

  /** Detect whether an input should be masked. */
  function shouldMaskInput(el, config) {
    if (!el || el.nodeType !== 1) return true;
    var tag = el.tagName;
    if (!tag) return true;
    tag = tag.toLowerCase();
    // Always mask passwords
    if (tag === 'input' && el.type === 'password') return true;
    // Credit card heuristic
    var name = (el.name || '').toLowerCase();
    var autocomp = (el.getAttribute('autocomplete') || '').toLowerCase();
    if (/card|cc[-_]?num|cvv|cvc|ccv|expir/i.test(name + autocomp)) return true;
    // Config-driven masking
    if (config.maskAllInputs) return true;
    if (config.maskSelectors && config.maskSelectors.length) {
      try {
        for (var i = 0; i < config.maskSelectors.length; i++) {
          if (el.matches(config.maskSelectors[i])) return true;
        }
      } catch (e) { /* ignore bad selectors */ }
    }
    return false;
  }

  /** Mask a value to asterisks. */
  function maskValue(val) {
    if (typeof val !== 'string') return '***';
    return val.replace(/./g, '*');
  }

  /** Parse UTM parameters from the current URL. */
  function getUtmParams() {
    var params = {};
    try {
      var search = window.location.search;
      if (!search) return params;
      var pairs = search.substring(1).split('&');
      for (var i = 0; i < pairs.length; i++) {
        var kv = pairs[i].split('=');
        var key = decodeURIComponent(kv[0]);
        if (/^utm_/.test(key)) {
          params[key] = decodeURIComponent(kv[1] || '');
        }
      }
    } catch (e) { /* ignore */ }
    return params;
  }

  /** Parse user-agent to extract browser, OS, device type. */
  function parseUA() {
    var ua = navigator.userAgent || '';
    var b = 'Unknown', o = 'Unknown', d = 'desktop';
    // Browser
    var bTests = [['Edg/','Edge'],['OPR/','Opera'],['Firefox/','Firefox'],['Trident','IE']];
    for (var i = 0; i < bTests.length; i++) { if (ua.indexOf(bTests[i][0]) > -1) { b = bTests[i][1]; break; } }
    if (b === 'Unknown') b = ua.indexOf('Chrome/') > -1 ? 'Chrome' : ua.indexOf('Safari/') > -1 ? 'Safari' : b;
    // OS
    var oTests = [['Windows','Windows'],['Macintosh','macOS'],['Android','Android'],['iPhone','iOS'],['iPad','iOS'],['CrOS','ChromeOS'],['Linux','Linux']];
    for (var j = 0; j < oTests.length; j++) { if (ua.indexOf(oTests[j][0]) > -1) { o = oTests[j][1]; break; } }
    // Device
    if (/Mobi|Android.*Mobile|iPhone|iPod/i.test(ua)) d = 'mobile';
    else if (/iPad|Android(?!.*Mobile)|Tablet/i.test(ua)) d = 'tablet';
    return { browser: b, os: o, device: d };
  }

  // DOM Serializer – produces a lightweight virtual-DOM tree
  var Serializer = {
    _nodeId: 1,
    _nodeMap: typeof WeakMap !== 'undefined' ? new WeakMap() : null,

    id: function (node) {
      if (!this._nodeMap) return 0;
      var id = this._nodeMap.get(node);
      if (!id) {
        id = this._nodeId++;
        this._nodeMap.set(node, id);
      }
      return id;
    },

    serializeNode: function (node, config) {
      if (!node) return null;
      var nt = node.nodeType;
      if (nt === 1 && isIgnored(node)) return null;
      if (nt === 8) return null; // skip comments
      var nid = this.id(node);
      if (nt === 1) {
        var tag = node.tagName.toLowerCase();
        var attrs = {};
        for (var i = 0; i < node.attributes.length; i++) {
          var a = node.attributes[i];
          attrs[a.name] = a.name === 'value' && shouldMaskInput(node, config) ? maskValue(a.value) : a.value;
        }
        return { id: nid, t: 1, tag: tag, a: attrs, c: [] };
      }
      if (nt === 3) {
        var text = node.textContent;
        var pe = node.parentElement;
        if (pe && shouldMaskInput(pe, config)) text = maskValue(text);
        return { id: nid, t: 3, v: text };
      }
      if (nt === 10) return { id: nid, t: 10, name: node.name || 'html', publicId: node.publicId || '', systemId: node.systemId || '' };
      if (nt === 9 || nt === 11) return { id: nid, t: nt, c: [] };
      return null;
    },

    serialize: function (root, config) {
      var self = this;
      function walk(node) {
        var vNode = self.serializeNode(node, config);
        if (!vNode) return null;
        if (node.childNodes && vNode.c !== undefined) {
          for (var i = 0; i < node.childNodes.length; i++) {
            var child = walk(node.childNodes[i]);
            if (child) vNode.c.push(child);
          }
        }
        // Special handling for shadow DOM
        if (node.shadowRoot) {
          var shadow = walk(node.shadowRoot);
          if (shadow) vNode.shadow = shadow;
        }
        return vNode;
      }
      return walk(root);
    }
  };

  // Core Recorder
  var Recorder = {
    _config: null,
    _sessionId: null,
    _sessionStart: 0,
    _buffer: [],
    _flushTimer: null,
    _observer: null,
    _listeners: [],
    _clickLog: [],        // for rage-click detection
    _pendingClicks: [],   // for dead-click detection
    _userId: null,
    _userTraits: null,
    _retryQueue: [],
    _sampled: true,
    _initialized: false,
    _recording: false,
    _pageUrl: '',
    _hasAddToCart: false,  // e-commerce: tracks if add_to_cart fired in session
    _hasPurchase: false,   // e-commerce: tracks if purchase fired in session
    _lastCartData: null,   // e-commerce: stores last cart state for abandonment
    _scrollDepthMax: 0,          // scroll depth: max depth percent reached
    _scrollZonesSeen: [],        // scroll depth: which 10% zones have been seen
    _scrollPageLoadTime: 0,      // scroll depth: timestamp when page loaded
    _scrollDepthFlushed: false,  // scroll depth: whether we already sent the event

    // Form tracking state
    _formState: {},        // form_id -> { started, submitted, fields: { field_name -> { focusTime, corrections, lastValue } }, currentField }

    init: function (options) {
      if (this._initialized) return;
      options = options || {};

      var rawApiUrl = options.apiUrl || '/api/events';
      // If apiUrl is a base URL (doesn't end with /api/events), append the path
      if (rawApiUrl && rawApiUrl.indexOf('/api/events') === -1) {
        rawApiUrl = rawApiUrl.replace(/\/+$/, '') + '/api/events';
      }

      var config = {
        projectId:      options.projectId || '',
        apiUrl:         rawApiUrl,
        maskAllInputs:  options.maskInputs !== undefined ? !!options.maskInputs : true,
        maskSelectors:  options.maskSelectors || [],
        sampleRate:     typeof options.sampleRate === 'number' ? options.sampleRate : 1.0,
        respectDNT:     options.respectDNT !== undefined ? !!options.respectDNT : false,
        requireConsent: options.requireConsent !== undefined ? !!options.requireConsent : false,
        batchSize:      options.batchSize || 50,
        flushInterval:  options.flushInterval || 5000,
        maxRetries:     options.maxRetries || 3
      };

      // Respect Do Not Track if configured
      if (config.respectDNT && navigator.doNotTrack === '1') return;

      // Sampling – decide once per session
      if (config.sampleRate < 1.0) {
        var stored = this._storageGet('sr_sampled');
        if (stored !== null) {
          this._sampled = stored === '1';
        } else {
          this._sampled = Math.random() < config.sampleRate;
          this._storageSet('sr_sampled', this._sampled ? '1' : '0');
        }
        if (!this._sampled) return;
      }

      this._config = config;
      this._initialized = true;
      this._pageUrl = window.location.href;

      // Session management
      this._initSession();

      // GDPR consent check – if requireConsent is enabled, only start
      // recording when the user has previously granted consent.
      if (config.requireConsent) {
        var consent = null;
        try { consent = localStorage.getItem('rml_consent'); } catch (e) { /* blocked */ }
        if (consent === 'granted') {
          this._startRecording();
        }
        // Otherwise wait for grantConsent() to be called
      } else {
        // Legacy behaviour – start immediately
        this._startRecording();
      }
    },

    /** Begin (or resume) recording – sets up observers, listeners, timers. */
    _startRecording: function () {
      if (this._recording) return;
      this._recording = true;

      this._emitSessionStart();
      this._takeDOMSnapshot();
      this._observeMutations();
      this._bindEvents();
      this._startFlushTimer();
      this._bindUnload();
      this._bindErrors();
      this._bindVisibility();
      this._bindNavigation();
      this._trackScrollDepth();
      this._collectWebVitals();
    },

    /** Stop recording – flush remaining data, tear down observers & listeners. */
    _stopRecording: function () {
      if (!this._recording) return;
      this._recording = false;

      this._flush(true);
      if (this._flushTimer) { clearInterval(this._flushTimer); this._flushTimer = null; }
      if (this._observer) { this._observer.disconnect(); this._observer = null; }
      for (var i = 0; i < this._listeners.length; i++) {
        var l = this._listeners[i];
        l.cleanup ? l.cleanup() : l.target && l.target.removeEventListener(l.event, l.handler, l.options);
      }
      for (var j = 0; j < this._pendingClicks.length; j++) {
        if (this._pendingClicks[j].timer) clearTimeout(this._pendingClicks[j].timer);
      }
      this._listeners = [];
      this._pendingClicks = [];
      this._buffer = [];
      this._clickLog = [];
      this._formState = {};
    },


    _initSession: function () {
      var existing = this._storageGet('sr_sid');
      var startStr = this._storageGet('sr_start');
      if (existing && startStr) {
        this._sessionId = existing;
        this._sessionStart = parseInt(startStr, 10);
      } else {
        this._sessionId = uuidv4();
        this._sessionStart = now();
        this._storageSet('sr_sid', this._sessionId);
        this._storageSet('sr_start', String(this._sessionStart));
      }
    },

    _storageGet: function (key) {
      try { return sessionStorage.getItem(key); } catch (e) { return null; }
    },

    _storageSet: function (key, val) {
      try { sessionStorage.setItem(key, val); } catch (e) { /* quota / blocked */ }
    },


    _push: function (type, data) {
      if (!this._initialized) return;
      var event = {
        e: type,
        t: relativeTime(),
        ts: now(),
        d: data || {}
      };
      this._buffer.push(event);
      if (this._buffer.length >= this._config.batchSize) {
        this._flush();
      }
    },

    _emitSessionStart: function () {
      var ua = parseUA();
      this._push(EVT.SESSION_START, {
        url:        window.location.href,
        referrer:   document.referrer || '',
        screen:     { w: screen.width, h: screen.height },
        viewport:   { w: window.innerWidth, h: window.innerHeight },
        browser:    ua.browser,
        os:         ua.os,
        device:     ua.device,
        language:   navigator.language || '',
        utm:        getUtmParams(),
        pixelRatio: window.devicePixelRatio || 1
      });
    },


    _takeDOMSnapshot: function () {
      var tree = Serializer.serialize(document, this._config);
      this._push(EVT.DOM_SNAPSHOT, { dom: tree });
    },

    _observeMutations: function () {
      if (typeof MutationObserver === 'undefined') return;
      var self = this;
      this._observer = new MutationObserver(function (mutations) {
        var batch = [];
        for (var i = 0; i < mutations.length; i++) {
          var m = mutations[i];
          var target = m.target;
          if (isIgnored(target)) continue;

          var entry = {
            type: m.type,
            targetId: Serializer.id(target)
          };

          if (m.type === 'childList') {
            // Added nodes
            if (m.addedNodes.length) {
              entry.adds = [];
              for (var a = 0; a < m.addedNodes.length; a++) {
                var addedNode = m.addedNodes[a];
                if (isIgnored(addedNode)) continue;
                var serialized = Serializer.serialize(addedNode, self._config);
                if (serialized) {
                  var prev = m.previousSibling ? Serializer.id(m.previousSibling) : null;
                  var next = m.nextSibling ? Serializer.id(m.nextSibling) : null;
                  entry.adds.push({ node: serialized, prev: prev, next: next });
                }
              }
              if (!entry.adds.length) delete entry.adds;
            }
            // Removed nodes
            if (m.removedNodes.length) {
              entry.removes = [];
              for (var r = 0; r < m.removedNodes.length; r++) {
                entry.removes.push({ id: Serializer.id(m.removedNodes[r]) });
              }
            }
          } else if (m.type === 'attributes') {
            entry.attr = m.attributeName;
            var val = target.getAttribute(m.attributeName);
            if (m.attributeName === 'value' && shouldMaskInput(target, self._config)) {
              val = maskValue(val || '');
            }
            entry.val = val;
          } else if (m.type === 'characterData') {
            var textVal = m.target.textContent;
            if (m.target.parentElement && shouldMaskInput(m.target.parentElement, self._config)) {
              textVal = maskValue(textVal);
            }
            entry.text = textVal;
          }

          batch.push(entry);
        }

        if (batch.length) {
          self._push(EVT.DOM_MUTATION, { mutations: batch });
          // Notify dead-click detector that DOM changed
          self._onDOMMutation();
        }
      });

      this._observer.observe(document.documentElement, {
        childList: true,
        attributes: true,
        characterData: true,
        subtree: true,
        attributeOldValue: false,
        characterDataOldValue: false
      });
    },


    _bindEvents: function () {
      var self = this;

      // --- Mouse move (throttled 50ms via rAF) ---
      var lastMoveTime = 0;
      var pendingMove = null;
      var moveHandler = function (e) {
        var t = performance.now();
        if (t - lastMoveTime < 50) {
          // Store the latest position, will be picked up on next eligible frame
          pendingMove = { x: e.clientX, y: e.clientY };
          return;
        }
        lastMoveTime = t;
        pendingMove = null;
        self._push(EVT.MOUSE_MOVE, { x: e.clientX, y: e.clientY });
      };

      // Use rAF wrapper for smooth sampling
      var rafMoveHandler = function (e) {
        requestAnimationFrame(function () {
          moveHandler(e);
        });
      };
      this._listen(document, 'mousemove', rafMoveHandler, { passive: true });

      // Periodically flush pending move that may have been throttled
      var moveFlusher = setInterval(function () {
        if (pendingMove) {
          self._push(EVT.MOUSE_MOVE, { x: pendingMove.x, y: pendingMove.y });
          pendingMove = null;
          lastMoveTime = performance.now();
        }
      }, 100);
      this._listeners.push({ cleanup: function () { clearInterval(moveFlusher); } });

      // --- Mouse click ---
      this._listen(document, 'click', function (e) {
        if (isIgnored(e.target)) return;
        var selector = getSelector(e.target);
        var text = '';
        try {
          text = (e.target.textContent || '').substring(0, 100).trim();
        } catch (ex) { /* */ }

        var clickData = {
          x: e.clientX,
          y: e.clientY,
          selector: selector,
          text: text,
          tag: e.target.tagName ? e.target.tagName.toLowerCase() : ''
        };

        self._push(EVT.MOUSE_CLICK, clickData);
        self._trackClickForRage(e);
        self._trackClickForDead(e, clickData);
      }, true);

      this._listen(window, 'scroll', throttle(function () {
        self._push(EVT.SCROLL, { x: window.scrollX | 0, y: window.scrollY | 0 });
      }, 100), { passive: true });

      this._listen(window, 'resize', throttle(function () {
        self._push(EVT.RESIZE, { w: window.innerWidth, h: window.innerHeight });
      }, 200), { passive: true });

      // Input / form changes
      var emitInput = function (el, val, masked) {
        self._push(EVT.INPUT, { selector: getSelector(el), masked: masked, value: val });
      };
      this._listen(document, 'input', function (e) {
        if (isIgnored(e.target)) return;
        var el = e.target, tag = (el.tagName || '').toLowerCase();
        if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') return;
        if (tag === 'input' && el.type === 'password') { emitInput(el, '********', true); return; }
        var m = shouldMaskInput(el, self._config);
        emitInput(el, m ? maskValue(el.value) : el.value, m);
      }, true);

      this._listen(document, 'change', function (e) {
        if (isIgnored(e.target)) return;
        var el = e.target, tag = (el.tagName || '').toLowerCase(), tp = el.type;
        if (tag !== 'select' && !(tag === 'input' && (tp === 'checkbox' || tp === 'radio'))) return;
        var val = (tp === 'checkbox' || tp === 'radio') ? (el.checked ? 'checked' : 'unchecked') : el.value;
        var m = shouldMaskInput(el, self._config);
        emitInput(el, m ? maskValue(val) : val, m);
      }, true);

      // --- Form tracking ---
      this._bindFormTracking();
    },

    _listen: function (target, event, handler, options) {
      target.addEventListener(event, handler, options || false);
      this._listeners.push({ target: target, event: event, handler: handler, options: options || false });
    },


    // ── Form Tracking ─────────────────────────────────────────────────

    /** Detect form ID from a form element. */
    _getFormId: function (formEl) {
      if (!formEl) return null;
      return formEl.id || formEl.getAttribute('name') || formEl.getAttribute('action') || 'form_' + Serializer.id(formEl);
    },

    /** Detect form name from a form element. */
    _getFormName: function (formEl) {
      if (!formEl) return null;
      return formEl.getAttribute('data-form-name') || formEl.getAttribute('name') || formEl.id || 'Unnamed Form';
    },

    /** Detect field name from an input element. */
    _getFieldName: function (el) {
      if (!el) return null;
      return el.getAttribute('name') || el.id || el.getAttribute('placeholder') || el.getAttribute('aria-label') || 'unnamed_field';
    },

    /** Detect field type from an input element. */
    _getFieldType: function (el) {
      if (!el) return 'text';
      var tag = (el.tagName || '').toLowerCase();
      if (tag === 'select') return 'select';
      if (tag === 'textarea') return 'textarea';
      return el.type || 'text';
    },

    /** Check if an element is a form field. */
    _isFormField: function (el) {
      if (!el || el.nodeType !== 1) return false;
      var tag = (el.tagName || '').toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select';
    },

    /** Get the parent form element for a field. */
    _getParentForm: function (el) {
      if (!el) return null;
      // Use the native form property first
      if (el.form) return el.form;
      // Walk up the DOM
      var node = el.parentElement;
      while (node) {
        if (node.tagName && node.tagName.toLowerCase() === 'form') return node;
        node = node.parentElement;
      }
      return null;
    },

    /** Ensure form state exists for a given form, return it. */
    _ensureFormState: function (formId, formName) {
      if (!this._formState[formId]) {
        this._formState[formId] = {
          started: false,
          submitted: false,
          fields: {},
          currentField: null,
          formName: formName || formId,
        };
      }
      return this._formState[formId];
    },

    /** Bind form-level tracking listeners. */
    _bindFormTracking: function () {
      var self = this;

      // --- focusin on form fields → track form_field_focus ---
      this._listen(document, 'focusin', function (e) {
        var el = e.target;
        if (!self._isFormField(el) || isIgnored(el)) return;

        var formEl = self._getParentForm(el);
        if (!formEl) return;

        var formId = self._getFormId(formEl);
        var formName = self._getFormName(formEl);
        var fieldName = self._getFieldName(el);
        var fieldType = self._getFieldType(el);

        var fs = self._ensureFormState(formId, formName);

        // Emit form_start on first interaction
        if (!fs.started) {
          fs.started = true;
          self._push(EVT.CUSTOM_EVENT, {
            name: 'form_start',
            properties: {
              form_id: formId,
              form_name: formName,
            }
          });
        }

        // Initialize field state if needed
        if (!fs.fields[fieldName]) {
          fs.fields[fieldName] = {
            focusTime: 0,
            corrections: 0,
            lastValue: '',
            changeCount: 0,
            hadError: false,
          };
        }

        fs.fields[fieldName].focusTime = performance.now();
        fs.currentField = fieldName;

        self._push(EVT.CUSTOM_EVENT, {
          name: 'form_field_focus',
          properties: {
            form_id: formId,
            form_name: formName,
            field_name: fieldName,
            field_type: fieldType,
          }
        });
      }, true);

      // --- focusout on form fields → track form_field_blur with time_spent ---
      this._listen(document, 'focusout', function (e) {
        var el = e.target;
        if (!self._isFormField(el) || isIgnored(el)) return;

        var formEl = self._getParentForm(el);
        if (!formEl) return;

        var formId = self._getFormId(formEl);
        var formName = self._getFormName(formEl);
        var fieldName = self._getFieldName(el);
        var fieldType = self._getFieldType(el);

        var fs = self._ensureFormState(formId, formName);
        var fieldState = fs.fields[fieldName];

        var timeSpent = 0;
        if (fieldState && fieldState.focusTime > 0) {
          timeSpent = Math.round(performance.now() - fieldState.focusTime);
          fieldState.focusTime = 0;
        }

        var corrections = fieldState ? fieldState.corrections : 0;
        var hadError = fieldState ? fieldState.hadError : false;
        var valueLength = 0;
        try { valueLength = (el.value || '').length; } catch (ex) { /* */ }

        // Reset corrections counter for next focus cycle
        if (fieldState) {
          fieldState.corrections = 0;
          fieldState.changeCount = 0;
        }

        self._push(EVT.CUSTOM_EVENT, {
          name: 'form_field_blur',
          properties: {
            form_id: formId,
            form_name: formName,
            field_name: fieldName,
            field_type: fieldType,
            value_length: valueLength,
            time_spent_ms: timeSpent,
            corrections: corrections,
            had_error: hadError,
          }
        });
      }, true);

      // --- input/change on form fields → track corrections ---
      this._listen(document, 'input', function (e) {
        var el = e.target;
        if (!self._isFormField(el) || isIgnored(el)) return;

        var formEl = self._getParentForm(el);
        if (!formEl) return;

        var formId = self._getFormId(formEl);
        var formName = self._getFormName(formEl);
        var fieldName = self._getFieldName(el);

        var fs = self._ensureFormState(formId, formName);
        if (!fs.fields[fieldName]) {
          fs.fields[fieldName] = {
            focusTime: 0,
            corrections: 0,
            lastValue: '',
            changeCount: 0,
            hadError: false,
          };
        }

        var fieldState = fs.fields[fieldName];
        var currentValue = '';
        try { currentValue = el.value || ''; } catch (ex) { /* */ }

        fieldState.changeCount++;

        // Detect correction: value got shorter (user deleted text) after initial input
        if (fieldState.changeCount > 1 && currentValue.length < fieldState.lastValue.length) {
          fieldState.corrections++;
        }

        fieldState.lastValue = currentValue;

        // Check for validation errors
        try {
          if (el.validity && !el.validity.valid) {
            fieldState.hadError = true;
          }
        } catch (ex) { /* */ }
      }, true);

      // --- form submit → track form_submit ---
      this._listen(document, 'submit', function (e) {
        var formEl = e.target;
        if (!formEl || (formEl.tagName || '').toLowerCase() !== 'form') return;
        if (isIgnored(formEl)) return;

        var formId = self._getFormId(formEl);
        var formName = self._getFormName(formEl);

        var fs = self._ensureFormState(formId, formName);
        fs.submitted = true;

        // Count fields interacted with
        var fieldCount = Object.keys(fs.fields).length;

        self._push(EVT.CUSTOM_EVENT, {
          name: 'form_submit',
          properties: {
            form_id: formId,
            form_name: formName,
            field_count: fieldCount,
          }
        });
      }, true);
    },

    /** Check for form abandonment on page unload: started but not submitted forms. */
    _checkFormAbandonment: function () {
      for (var formId in this._formState) {
        if (!this._formState.hasOwnProperty(formId)) continue;
        var fs = this._formState[formId];
        if (fs.started && !fs.submitted) {
          this._push(EVT.CUSTOM_EVENT, {
            name: 'form_abandon',
            properties: {
              form_id: formId,
              form_name: fs.formName,
              field_name: fs.currentField || null,
              fields_filled: Object.keys(fs.fields).length,
            }
          });
          // Prevent duplicate firing
          fs.started = false;
        }
      }
    },


    _trackClickForRage: function (e) {
      var t = performance.now();
      var entry = { x: e.clientX, y: e.clientY, t: t };
      this._clickLog.push(entry);

      // Prune entries older than 500ms
      while (this._clickLog.length && t - this._clickLog[0].t > 500) {
        this._clickLog.shift();
      }

      if (this._clickLog.length >= 3) {
        // Check if all recent clicks are within a 30px radius of each other
        var first = this._clickLog[0];
        var allClose = true;
        for (var i = 1; i < this._clickLog.length; i++) {
          var dx = this._clickLog[i].x - first.x;
          var dy = this._clickLog[i].y - first.y;
          if (Math.sqrt(dx * dx + dy * dy) > 30) {
            allClose = false;
            break;
          }
        }
        if (allClose) {
          this._push(EVT.RAGE_CLICK, {
            x: e.clientX,
            y: e.clientY,
            clicks: this._clickLog.length,
            selector: getSelector(e.target)
          });
          this._clickLog = []; // reset after detection
        }
      }
    },


    _trackClickForDead: function (e, clickData) {
      var self = this;
      var pending = {
        data: clickData,
        url: window.location.href,
        domChanged: false,
        timer: null
      };

      pending.timer = setTimeout(function () {
        // After 1 second, check if anything happened
        var navigated = window.location.href !== pending.url;
        if (!navigated && !pending.domChanged) {
          self._push(EVT.DEAD_CLICK, {
            x: clickData.x,
            y: clickData.y,
            selector: clickData.selector,
            tag: clickData.tag
          });
        }
        // Remove from pending list
        var idx = self._pendingClicks.indexOf(pending);
        if (idx !== -1) self._pendingClicks.splice(idx, 1);
      }, 1000);

      this._pendingClicks.push(pending);
    },

    _onDOMMutation: function () {
      for (var i = 0; i < this._pendingClicks.length; i++) {
        this._pendingClicks[i].domChanged = true;
      }
    },


    _bindErrors: function () {
      var self = this;

      // window.onerror
      var prevOnError = window.onerror;
      window.onerror = function (message, source, lineno, colno, error) {
        self._push(EVT.JS_ERROR, {
          message: String(message),
          source: source || '',
          line: lineno || 0,
          col: colno || 0,
          stack: (error && error.stack) ? error.stack.substring(0, 2000) : ''
        });
        if (typeof prevOnError === 'function') {
          return prevOnError.apply(this, arguments);
        }
        return false;
      };

      // unhandledrejection
      this._listen(window, 'unhandledrejection', function (e) {
        var reason = e.reason;
        var message = 'Unhandled Promise Rejection';
        var stack = '';
        if (reason) {
          if (typeof reason === 'string') {
            message = reason;
          } else if (reason.message) {
            message = reason.message;
            stack = (reason.stack || '').substring(0, 2000);
          }
        }
        self._push(EVT.JS_ERROR, {
          message: message,
          source: '',
          line: 0,
          col: 0,
          stack: stack,
          type: 'unhandledrejection'
        });
      });
    },


    _bindVisibility: function () {
      var self = this;
      this._listen(document, 'visibilitychange', function () {
        self._push(EVT.PAGE_VISIBILITY, {
          state: document.visibilityState
        });
      });
    },


    _bindNavigation: function () {
      var self = this;

      // Intercept pushState / replaceState for SPA navigation detection
      var origPushState = history.pushState;
      var origReplaceState = history.replaceState;

      history.pushState = function () {
        origPushState.apply(this, arguments);
        self._onNavigation();
      };
      history.replaceState = function () {
        origReplaceState.apply(this, arguments);
        self._onNavigation();
      };

      this._listen(window, 'popstate', function () {
        self._onNavigation();
      });

      this._listen(window, 'hashchange', function () {
        self._onNavigation();
      });
    },

    _onNavigation: function () {
      var newUrl = window.location.href;
      if (newUrl === this._pageUrl) return;
      var oldUrl = this._pageUrl;
      this._pageUrl = newUrl;
      this._push(EVT.PAGE_NAVIGATION, {
        from: oldUrl,
        to: newUrl
      });
    },


    _bindUnload: function () {
      var self = this;

      var unloadHandler = function () {
        // Auto-detect form abandonment on page unload
        self._checkFormAbandonment();
        // Auto-detect cart abandonment on page unload
        self._checkCartAbandonment();
        self._flush(true); // beacon = true
      };

      // Use both for maximum coverage
      this._listen(window, 'beforeunload', unloadHandler);
      this._listen(document, 'visibilitychange', function () {
        if (document.visibilityState === 'hidden') {
          self._checkFormAbandonment();
          self._checkCartAbandonment();
          self._flush(true);
        }
      });
    },

    /** Auto-fire cart_abandonment if there were add_to_cart events but no purchase. */
    _checkCartAbandonment: function () {
      if (this._hasAddToCart && !this._hasPurchase && this._lastCartData) {
        this._push(EVT.CUSTOM_EVENT, {
          name: 'cart_abandonment',
          properties: {
            items: this._lastCartData.items,
            total: this._lastCartData.total,
            currency: this._lastCartData.currency || 'CZK',
            exit_url: window.location.href,
            auto_detected: true
          }
        });
        // Prevent duplicate firing
        this._hasAddToCart = false;
      }
    },


    // ── Scroll Depth Tracking ──────────────────────────────────────────

    /** Set up scroll depth tracking: listen for scroll events (throttled)
     *  and emit a scroll_depth custom event on page unload / navigation. */
    _trackScrollDepth: function () {
      var self = this;

      // Record the page load time for time-on-page calculation
      this._scrollPageLoadTime = now();
      this._scrollDepthMax = 0;
      this._scrollZonesSeen = [0]; // zone 0% is always "seen"
      this._scrollDepthFlushed = false;

      // Compute current scroll depth percentage
      function computeDepth() {
        try {
          var scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
          var viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
          var docHeight = Math.max(
            document.body.scrollHeight || 0,
            document.documentElement.scrollHeight || 0,
            document.body.offsetHeight || 0,
            document.documentElement.offsetHeight || 0,
            document.body.clientHeight || 0,
            document.documentElement.clientHeight || 0
          );
          if (docHeight <= 0) return 0;
          var depth = ((scrollTop + viewportHeight) / docHeight) * 100;
          return Math.min(100, Math.round(depth * 10) / 10);
        } catch (e) {
          return 0;
        }
      }

      // Update max depth and zones seen
      function updateDepth() {
        var depth = computeDepth();
        if (depth > self._scrollDepthMax) {
          self._scrollDepthMax = depth;
        }
        // Determine which 10% zones the user has reached
        for (var z = 0; z <= 90; z += 10) {
          if (depth >= z && self._scrollZonesSeen.indexOf(z) === -1) {
            self._scrollZonesSeen.push(z);
          }
        }
      }

      // Capture initial depth (above-the-fold content)
      updateDepth();

      // Throttled scroll listener (every 500ms)
      this._listen(window, 'scroll', throttle(function () {
        updateDepth();
      }, 500), { passive: true });

      // On beforeunload, send the scroll_depth event
      var flushScrollDepth = function () {
        self._flushScrollDepth();
      };

      this._listen(window, 'beforeunload', flushScrollDepth);
      this._listen(document, 'visibilitychange', function () {
        if (document.visibilityState === 'hidden') {
          self._flushScrollDepth();
        }
      });
    },

    /** Emit the scroll_depth custom event (called on unload/navigation). */
    _flushScrollDepth: function () {
      if (this._scrollDepthFlushed) return;
      this._scrollDepthFlushed = true;

      var timeOnPageMs = now() - (this._scrollPageLoadTime || now());
      this._scrollZonesSeen.sort(function (a, b) { return a - b; });

      this._push(EVT.CUSTOM_EVENT, {
        name: 'scroll_depth',
        properties: {
          url: window.location.href,
          max_depth_percent: this._scrollDepthMax,
          time_on_page_ms: Math.max(0, timeOnPageMs),
          zones_seen: this._scrollZonesSeen
        }
      });
    },


    /** Collect Core Web Vitals (LCP, CLS, FID, INP, TTFB, page load time). */
    _collectWebVitals: function () {
      var self = this;
      var vitals = { lcp: null, cls: 0, fid: null, inp: null, ttfb: null, page_load_time: null };
      var hasSent = false;

      function sendVitals() {
        if (hasSent) return;
        hasSent = true;

        // Gather navigation timing for TTFB and page load time
        try {
          var navEntries = performance.getEntriesByType('navigation');
          if (navEntries && navEntries.length > 0) {
            var nav = navEntries[0];
            vitals.ttfb = Math.round(nav.responseStart);
            vitals.page_load_time = Math.round(nav.loadEventEnd > 0 ? nav.loadEventEnd : nav.domComplete);
          }
        } catch (e) { /* navigation timing unavailable */ }

        var connType = null;
        try {
          connType = navigator && navigator.connection ? navigator.connection.effectiveType : null;
        } catch (e) { /* connection API unavailable */ }

        self._push(EVT.CUSTOM_EVENT, {
          name: 'web_vitals',
          properties: {
            lcp: vitals.lcp,
            cls: Math.round(vitals.cls * 1000) / 1000,
            fid: vitals.fid,
            inp: vitals.inp,
            ttfb: vitals.ttfb,
            page_load_time: vitals.page_load_time,
            url: location.href,
            connection_type: connType
          }
        });
      }

      // Observe LCP
      try {
        if (typeof PerformanceObserver !== 'undefined') {
          var lcpObserver = new PerformanceObserver(function (list) {
            var entries = list.getEntries();
            if (entries.length > 0) {
              vitals.lcp = Math.round(entries[entries.length - 1].startTime);
            }
          });
          lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
          self._listeners.push({ cleanup: function () { try { lcpObserver.disconnect(); } catch (e) {} } });
        }
      } catch (e) { /* LCP observer not supported */ }

      // Observe CLS (accumulate all layout shift values)
      try {
        if (typeof PerformanceObserver !== 'undefined') {
          var clsObserver = new PerformanceObserver(function (list) {
            var entries = list.getEntries();
            for (var i = 0; i < entries.length; i++) {
              if (!entries[i].hadRecentInput) {
                vitals.cls += entries[i].value;
              }
            }
          });
          clsObserver.observe({ type: 'layout-shift', buffered: true });
          self._listeners.push({ cleanup: function () { try { clsObserver.disconnect(); } catch (e) {} } });
        }
      } catch (e) { /* CLS observer not supported */ }

      // Observe FID (first-input)
      try {
        if (typeof PerformanceObserver !== 'undefined') {
          var fidObserver = new PerformanceObserver(function (list) {
            var entries = list.getEntries();
            if (entries.length > 0) {
              vitals.fid = Math.round(entries[0].processingStart - entries[0].startTime);
            }
          });
          fidObserver.observe({ type: 'first-input', buffered: true });
          self._listeners.push({ cleanup: function () { try { fidObserver.disconnect(); } catch (e) {} } });
        }
      } catch (e) { /* FID observer not supported */ }

      // Observe INP (event timing for Interaction to Next Paint)
      try {
        if (typeof PerformanceObserver !== 'undefined') {
          var maxINP = 0;
          var inpObserver = new PerformanceObserver(function (list) {
            var entries = list.getEntries();
            for (var i = 0; i < entries.length; i++) {
              var duration = entries[i].duration;
              if (duration > maxINP) {
                maxINP = duration;
                vitals.inp = Math.round(duration);
              }
            }
          });
          inpObserver.observe({ type: 'event', buffered: true });
          self._listeners.push({ cleanup: function () { try { inpObserver.disconnect(); } catch (e) {} } });
        }
      } catch (e) { /* INP observer not supported */ }

      // Fire after page load with a delay to capture late metrics
      if (document.readyState === 'complete') {
        setTimeout(sendVitals, 5000);
      } else {
        var onLoad = function () {
          setTimeout(sendVitals, 5000);
        };
        window.addEventListener('load', onLoad);
        self._listeners.push({ target: window, event: 'load', handler: onLoad, options: false });
      }
    },

    _startFlushTimer: function () {
      var self = this;
      this._flushTimer = setInterval(function () {
        self._flush();
      }, this._config.flushInterval);
    },

    _flush: function (useBeacon) {
      if (!this._buffer.length) return;

      var events = this._buffer.splice(0, this._buffer.length);
      var payload = {
        sid: this._sessionId,
        pid: this._config.projectId,
        uid: this._userId || null,
        ts: now(),
        events: events
      };

      if (useBeacon) {
        this._sendBeacon(payload);
      } else {
        this._sendFetch(payload, 0);
      }
    },

    _sendBeacon: function (payload) {
      try {
        var data = JSON.stringify(payload);
        if (navigator.sendBeacon) {
          var blob = new Blob([data], { type: 'application/json' });
          var sent = navigator.sendBeacon(this._config.apiUrl, blob);
          if (!sent) {
            // Fallback to sync XHR on beacon failure
            this._sendXHRSync(data);
          }
        } else {
          this._sendXHRSync(data);
        }
      } catch (e) { /* best effort on unload */ }
    },

    _sendXHRSync: function (data) {
      try {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', this._config.apiUrl, false); // synchronous
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(data);
      } catch (e) { /* best effort */ }
    },

    _sendFetch: function (payload, attempt) {
      var self = this;
      var max = this._config.maxRetries;
      var data = JSON.stringify(payload);
      var retry = function () {
        if (attempt < max) {
          setTimeout(function () { self._sendFetch(payload, attempt + 1); },
            Math.min(1000 << attempt, 30000));
        }
      };
      try {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', this._config.apiUrl, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onload = function () { if (xhr.status >= 400) retry(); };
        xhr.onerror = retry;
        xhr.send(data);
      } catch (e) { retry(); }
    },



    track: function (eventName, properties) {
      if (!this._initialized) return;
      if (typeof eventName !== 'string' || !eventName) return;
      this._push(EVT.CUSTOM_EVENT, {
        name: eventName,
        props: properties || {}
      });
    },

    /** Internal: track an e-commerce event and update cart/purchase state. */
    _trackEcommerceEvent: function (name, properties) {
      if (!this._initialized) return;
      this._push(EVT.CUSTOM_EVENT, {
        name: name,
        properties: properties || {}
      });
      // Track cart state for auto-abandonment detection
      if (name === 'add_to_cart') {
        this._hasAddToCart = true;
        // Build running cart data from add_to_cart events
        if (!this._lastCartData) {
          this._lastCartData = { items: [], total: 0, currency: 'CZK' };
        }
        if (properties) {
          this._lastCartData.items.push({
            id: properties.id,
            name: properties.name,
            price: properties.price,
            quantity: properties.quantity || 1
          });
          this._lastCartData.total += (properties.price || 0) * (properties.quantity || 1);
        }
      } else if (name === 'remove_from_cart' && this._lastCartData) {
        // Try to remove item from tracked cart
        var items = this._lastCartData.items;
        for (var i = 0; i < items.length; i++) {
          if (items[i].id === (properties && properties.id)) {
            this._lastCartData.total -= (items[i].price || 0) * (items[i].quantity || 1);
            items.splice(i, 1);
            break;
          }
        }
        if (items.length === 0) {
          this._hasAddToCart = false;
          this._lastCartData = null;
        }
      } else if (name === 'checkout_start' && properties) {
        // Update cart data with full checkout cart info
        this._lastCartData = {
          items: properties.items || (this._lastCartData ? this._lastCartData.items : []),
          total: properties.total || (this._lastCartData ? this._lastCartData.total : 0),
          currency: properties.currency || 'CZK'
        };
      } else if (name === 'purchase') {
        this._hasPurchase = true;
        // Reset cart state after purchase
        this._hasAddToCart = false;
        this._lastCartData = null;
      }
    },

    identify: function (userId, traits) {
      if (!this._initialized) return;
      this._userId = userId ? String(userId) : null;
      this._userTraits = traits || {};
      this._push(EVT.IDENTIFY, {
        userId: this._userId,
        traits: this._userTraits
      });
    },

    destroy: function () {
      if (!this._initialized) return;
      this._flush(true);
      if (this._flushTimer) clearInterval(this._flushTimer);
      if (this._observer) this._observer.disconnect();
      for (var i = 0; i < this._listeners.length; i++) {
        var l = this._listeners[i];
        l.cleanup ? l.cleanup() : l.target && l.target.removeEventListener(l.event, l.handler, l.options);
      }
      for (var j = 0; j < this._pendingClicks.length; j++) {
        if (this._pendingClicks[j].timer) clearTimeout(this._pendingClicks[j].timer);
      }
      this._listeners = []; this._pendingClicks = []; this._buffer = [];
      this._clickLog = []; this._observer = null; this._flushTimer = null;
      this._formState = {};
      this._initialized = false; window.__RML_INITIALIZED__ = false;
    },

    getSessionId: function () {
      return this._sessionId;
    }
  };

  // Public API
  window.RegalMasterLook = {
    init: function (options) { Recorder.init(options); },
    track: function (eventName, properties) { Recorder.track(eventName, properties); },
    identify: function (userId, traits) { Recorder.identify(userId, traits); },
    destroy: function () { Recorder.destroy(); },
    getSessionId: function () { return Recorder.getSessionId(); },

    // GDPR consent helpers

    /** Grant consent – persists choice and starts recording if not already active. */
    grantConsent: function () {
      try { localStorage.setItem('rml_consent', 'granted'); } catch (e) { /* blocked */ }
      if (Recorder._initialized && !Recorder._recording) {
        Recorder._startRecording();
      }
    },

    /** Revoke consent – persists choice, stops recording and clears buffered data. */
    revokeConsent: function () {
      try { localStorage.setItem('rml_consent', 'revoked'); } catch (e) { /* blocked */ }
      if (Recorder._initialized) {
        Recorder._stopRecording();
      }
    },

    /** Check whether the user has previously granted consent. */
    hasConsent: function () {
      try { return localStorage.getItem('rml_consent') === 'granted'; } catch (e) { return false; }
    },

    // ── E-commerce Tracking ──────────────────────────────────

    /** Track a page view with optional e-commerce context. */
    // pageData: { url, title, category, product_id, product_name, price }
    trackPageView: function (pageData) {
      if (Recorder._initialized) Recorder._trackEcommerceEvent('page_view', pageData);
    },

    /** Track a product detail view. */
    // product: { id, name, price, category, variant }
    trackProductView: function (product) {
      if (Recorder._initialized) Recorder._trackEcommerceEvent('product_view', product);
    },

    /** Track adding a product to the cart. */
    // product: { id, name, price, quantity, category }
    trackAddToCart: function (product) {
      if (Recorder._initialized) Recorder._trackEcommerceEvent('add_to_cart', product);
    },

    /** Track removing a product from the cart. */
    trackRemoveFromCart: function (product) {
      if (Recorder._initialized) Recorder._trackEcommerceEvent('remove_from_cart', product);
    },

    /** Track the start of checkout. */
    // cart: { total, items: [{id, name, price, quantity}], currency }
    trackCheckoutStart: function (cart) {
      if (Recorder._initialized) Recorder._trackEcommerceEvent('checkout_start', cart);
    },

    /** Track a checkout step (e.g. shipping, payment). */
    // step: { step_number, step_name } e.g. { step_number: 2, step_name: 'shipping' }
    trackCheckoutStep: function (step) {
      if (Recorder._initialized) Recorder._trackEcommerceEvent('checkout_step', step);
    },

    /** Track a completed purchase. */
    // order: { order_id, total, currency, items, shipping, tax }
    trackPurchase: function (order) {
      if (Recorder._initialized) Recorder._trackEcommerceEvent('purchase', order);
    },

    /** Track cart abandonment (usually auto-detected on page unload). */
    trackCartAbandonment: function (cart) {
      if (Recorder._initialized) Recorder._trackEcommerceEvent('cart_abandonment', cart);
    },

    /** Set revenue for the current session. */
    setRevenue: function (amount, currency) {
      if (Recorder._initialized) Recorder._trackEcommerceEvent('revenue', {
        amount: amount,
        currency: currency || 'CZK'
      });
    },

    _EVT: EVT
  };

  // Auto-initialize from data attributes on script tag
  (function autoInit() {
    try {
      var scripts = document.getElementsByTagName('script');
      var current = scripts[scripts.length - 1];
      if (current && current.hasAttribute('data-project-id')) {
        var opts = {
          projectId: current.getAttribute('data-project-id') || ''
        };
        if (current.hasAttribute('data-api-url')) {
          opts.apiUrl = current.getAttribute('data-api-url');
        }
        if (current.hasAttribute('data-sample-rate')) {
          opts.sampleRate = parseFloat(current.getAttribute('data-sample-rate'));
        }
        if (current.hasAttribute('data-mask-inputs')) {
          opts.maskInputs = current.getAttribute('data-mask-inputs') !== 'false';
        }
        if (current.hasAttribute('data-respect-dnt')) {
          opts.respectDNT = current.getAttribute('data-respect-dnt') !== 'false';
        }
        if (current.hasAttribute('data-require-consent')) {
          opts.requireConsent = current.getAttribute('data-require-consent') !== 'false';
        }
        Recorder.init(opts);
      }
    } catch (e) { /* auto-init is best-effort */ }
  })();
})();
