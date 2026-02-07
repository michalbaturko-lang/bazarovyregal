'use strict';

/**
 * SessionAnalyzer - AI-powered session analysis engine
 *
 * Processes session events to detect frustration, confusion, hesitation,
 * and other behavioural patterns. Produces actionable insights and scores.
 *
 * Event types (custom event type field):
 *   1 = page view        5 = scroll           9  = rage click
 *   2 = click            6 = resize          10  = dead click
 *   3 = mouse move       7 = input           11  = JS error
 *   4 = DOM mutation      8 = form submit    12  = custom event
 */

class SessionAnalyzer {
  /**
   * @param {Array}  events       - Array of event objects for the session
   * @param {Object} sessionMeta  - Session metadata (from sessions table)
   */
  constructor(events, sessionMeta) {
    this.events = (events || []).sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );
    this.meta = sessionMeta || {};
    this.insights = [];
    this.score = { engagement: 0, frustration: 0, conversion: 0 };

    // Derived helpers
    this._pageViews = this._extractPageViews();
    this._sessionStart = this.events.length
      ? new Date(this.events[0].timestamp)
      : null;
    this._sessionEnd = this.events.length
      ? new Date(this.events[this.events.length - 1].timestamp)
      : null;
    this._sessionDurationMs = this._sessionStart && this._sessionEnd
      ? this._sessionEnd - this._sessionStart
      : 0;
  }

  /* ====================================================================
     Public
  ==================================================================== */

  analyze() {
    if (!this.events.length) {
      return {
        insights: [],
        score: { engagement: 0, frustration: 0, conversion: 0 },
        summary: 'No events recorded for this session.',
      };
    }

    this._detectFrustration();
    this._detectConfusion();
    this._detectHesitation();
    this._detectExitIntent();
    this._detectFormAbandonment();
    this._detectDeadEnds();
    this._detectSpeedBrowsing();
    this._detectDeepEngagement();
    this._calculateSessionScore();

    // De-duplicate insights that are essentially the same
    this._deduplicateInsights();

    // Sort by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    this.insights.sort(
      (a, b) => (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5)
    );

    return {
      insights: this.insights,
      score: this.score,
      summary: this._generateSummary(),
    };
  }

  /* ====================================================================
     Helpers - page view extraction
  ==================================================================== */

  _extractPageViews() {
    const views = [];
    for (const evt of this.events) {
      const evtType = evt.event_type ?? evt.type;
      if (evtType === 1 || evtType === 'page_view' || evtType === 'pageview') {
        const url =
          (evt.data && (evt.data.url || evt.data.href || evt.data.page)) ||
          evt.url ||
          evt.page ||
          null;
        views.push({
          url,
          timestamp: new Date(evt.timestamp),
          event: evt,
        });
      }
    }
    return views;
  }

  _getEventType(evt) {
    return evt.event_type ?? evt.type;
  }

  _getEventDataField(evt, field, fallback) {
    if (evt.data && evt.data[field] !== undefined) return evt.data[field];
    if (evt[field] !== undefined) return evt[field];
    return fallback;
  }

  _addInsight(obj) {
    this.insights.push({
      type: obj.type || 'general',
      severity: obj.severity || 'low',
      title: obj.title || '',
      description: obj.description || '',
      timestamp: obj.timestamp || null,
      recommendation: obj.recommendation || '',
      element: obj.element || null,
      page: obj.page || null,
      count: obj.count || 1,
    });
  }

  _timePageUrl(pageEvt) {
    if (!pageEvt) return '';
    return pageEvt.url || '(unknown page)';
  }

  /* ====================================================================
     Frustration Detection
  ==================================================================== */

  _detectFrustration() {
    // --- Rage clicks (type 9) ---
    const rageClicks = this.events.filter(e => this._getEventType(e) === 9);
    if (rageClicks.length > 0) {
      // Group by page/element
      const byPage = {};
      for (const rc of rageClicks) {
        const page = this._getEventDataField(rc, 'url', '') ||
                     this._getEventDataField(rc, 'page', '(unknown)');
        const el = this._getEventDataField(rc, 'selector', '') ||
                   this._getEventDataField(rc, 'element', '');
        const key = `${page}::${el}`;
        if (!byPage[key]) byPage[key] = { page, element: el, count: 0, first: rc.timestamp };
        byPage[key].count++;
      }

      for (const key of Object.keys(byPage)) {
        const info = byPage[key];
        const severity = info.count >= 5 ? 'critical' : info.count >= 3 ? 'high' : 'medium';
        this._addInsight({
          type: 'frustration',
          severity,
          title: info.count >= 3
            ? 'High frustration - repeated rage clicks'
            : 'Rage click detected',
          description: `${info.count} rage click(s) on "${info.element || 'page element'}" at ${info.page}.`,
          timestamp: info.first,
          recommendation: 'Check if the element is responsive and provides proper visual feedback on click.',
          element: info.element,
          page: info.page,
          count: info.count,
        });
      }
    }

    // --- Dead clicks (type 10) ---
    const deadClicks = this.events.filter(e => this._getEventType(e) === 10);
    if (deadClicks.length > 0) {
      const byElement = {};
      for (const dc of deadClicks) {
        const el = this._getEventDataField(dc, 'selector', '') ||
                   this._getEventDataField(dc, 'element', '');
        const page = this._getEventDataField(dc, 'url', '') ||
                     this._getEventDataField(dc, 'page', '(unknown)');
        const key = `${page}::${el}`;
        if (!byElement[key]) byElement[key] = { page, element: el, count: 0, first: dc.timestamp };
        byElement[key].count++;
      }

      for (const key of Object.keys(byElement)) {
        const info = byElement[key];
        this._addInsight({
          type: 'frustration',
          severity: info.count >= 5 ? 'high' : 'medium',
          title: 'UI element appears clickable but is not',
          description: `${info.count} dead click(s) on "${info.element || 'element'}" at ${info.page}. Users expect this element to be interactive.`,
          timestamp: info.first,
          recommendation: 'Either make this element interactive or change its styling so it does not appear clickable.',
          element: info.element,
          page: info.page,
          count: info.count,
        });
      }
    }

    // --- JS error (type 11) followed by exit within 10s ---
    const errors = this.events.filter(e => this._getEventType(e) === 11);
    for (const err of errors) {
      const errTime = new Date(err.timestamp).getTime();
      const eventsAfter = this.events.filter(
        e => new Date(e.timestamp).getTime() > errTime &&
             new Date(e.timestamp).getTime() <= errTime + 10000
      );
      const hasPageView = eventsAfter.some(e => {
        const t = this._getEventType(e);
        return t === 1 || t === 'page_view';
      });
      // If no further page views within 10s and error is among last events
      const isNearEnd = errTime >= (this._sessionEnd.getTime() - 10000);
      if (!hasPageView && isNearEnd) {
        const msg = this._getEventDataField(err, 'message', '') ||
                    this._getEventDataField(err, 'error', '');
        const source = this._getEventDataField(err, 'source', '') ||
                       this._getEventDataField(err, 'filename', '');
        const line = this._getEventDataField(err, 'lineno', '') ||
                     this._getEventDataField(err, 'line', '');
        this._addInsight({
          type: 'frustration',
          severity: 'critical',
          title: 'JavaScript error caused user to leave',
          description: `Error "${msg}" ${source ? 'in ' + source : ''}${line ? ' line ' + line : ''} occurred and the user left within seconds.`,
          timestamp: err.timestamp,
          recommendation: source
            ? `Fix the JavaScript error in ${source}${line ? ' line ' + line : ''}.`
            : 'Investigate and fix the JavaScript error causing users to leave.',
          page: this._getEventDataField(err, 'url', null),
        });
      }
    }

    // --- Rapid back-and-forth between 2 pages ---
    if (this._pageViews.length >= 4) {
      for (let i = 0; i < this._pageViews.length - 3; i++) {
        const a = this._pageViews[i].url;
        const b = this._pageViews[i + 1].url;
        const c = this._pageViews[i + 2].url;
        const d = this._pageViews[i + 3].url;
        if (a && b && a === c && b === d && a !== b) {
          this._addInsight({
            type: 'frustration',
            severity: 'medium',
            title: 'Rapid back-and-forth navigation',
            description: `User navigated back and forth between "${a}" and "${b}" multiple times, suggesting confusion.`,
            timestamp: this._pageViews[i].timestamp,
            recommendation: 'Review the relationship between these pages. Users may be unable to find what they need.',
            page: a,
          });
          break; // Only report once
        }
      }
    }
  }

  /* ====================================================================
     Confusion Detection
  ==================================================================== */

  _detectConfusion() {
    // --- Same page visited 3+ times ---
    const pageCounts = {};
    for (const pv of this._pageViews) {
      if (!pv.url) continue;
      if (!pageCounts[pv.url]) pageCounts[pv.url] = { count: 0, first: pv.timestamp };
      pageCounts[pv.url].count++;
    }

    for (const [url, info] of Object.entries(pageCounts)) {
      if (info.count >= 3) {
        this._addInsight({
          type: 'confusion',
          severity: 'medium',
          title: 'User seems lost - revisiting pages',
          description: `The page "${url}" was visited ${info.count} times during this session, suggesting the user could not find what they needed.`,
          timestamp: info.first,
          recommendation: 'Improve the information architecture and navigation on this page.',
          page: url,
          count: info.count,
        });
      }
    }

    // --- Navigation A->B->A->B pattern ---
    if (this._pageViews.length >= 4) {
      for (let i = 0; i < this._pageViews.length - 3; i++) {
        const seq = this._pageViews.slice(i, i + 4).map(p => p.url);
        if (seq[0] && seq[1] && seq[0] === seq[2] && seq[1] === seq[3] && seq[0] !== seq[1]) {
          this._addInsight({
            type: 'confusion',
            severity: 'medium',
            title: 'Navigation confusion detected',
            description: `User navigated in a loop: "${seq[0]}" -> "${seq[1]}" -> "${seq[0]}" -> "${seq[1]}".`,
            timestamp: this._pageViews[i].timestamp,
            recommendation: 'Check if the navigation between these pages is clear and the content meets user expectations.',
            page: seq[0],
          });
          break;
        }
      }
    }

    // --- Long idle (>30s) on a page without scrolling ---
    for (let i = 0; i < this._pageViews.length; i++) {
      const pageStart = this._pageViews[i].timestamp.getTime();
      const pageEnd = i + 1 < this._pageViews.length
        ? this._pageViews[i + 1].timestamp.getTime()
        : this._sessionEnd.getTime();
      const timeOnPage = pageEnd - pageStart;

      if (timeOnPage > 30000) {
        // Check if there were scroll events during that period
        const scrollsDuring = this.events.filter(e => {
          const t = new Date(e.timestamp).getTime();
          return t >= pageStart && t <= pageEnd && this._getEventType(e) === 5;
        });
        if (scrollsDuring.length === 0) {
          this._addInsight({
            type: 'confusion',
            severity: 'low',
            title: 'User may be confused or idle',
            description: `Spent ${Math.round(timeOnPage / 1000)}s on "${this._pageViews[i].url || '(unknown)'}" with no scrolling, suggesting confusion or distraction.`,
            timestamp: this._pageViews[i].timestamp,
            recommendation: 'Ensure the page content is clear, with a visible call-to-action above the fold.',
            page: this._pageViews[i].url,
          });
        }
      }
    }

    // --- Scroll up after reaching bottom ---
    const scrollEvents = this.events.filter(e => this._getEventType(e) === 5);
    let reachedBottom = false;
    for (const se of scrollEvents) {
      const depth = this._getEventDataField(se, 'scrollDepth', null) ??
                    this._getEventDataField(se, 'depth', null) ??
                    this._getEventDataField(se, 'percentage', null);
      if (depth !== null && depth >= 90) {
        reachedBottom = true;
      } else if (reachedBottom && depth !== null && depth < 50) {
        this._addInsight({
          type: 'confusion',
          severity: 'low',
          title: 'User may not have found what they were looking for',
          description: 'The user scrolled to the bottom of the page and then scrolled back up, suggesting the content did not meet their expectations.',
          timestamp: se.timestamp,
          recommendation: 'Review the page content. Consider better content structure or a search feature.',
          page: this._getEventDataField(se, 'url', null),
        });
        reachedBottom = false;
        break;
      }
    }

    // --- Quick page exits (<5s) repeatedly ---
    let quickExits = 0;
    for (let i = 0; i < this._pageViews.length; i++) {
      const pageStart = this._pageViews[i].timestamp.getTime();
      const pageEnd = i + 1 < this._pageViews.length
        ? this._pageViews[i + 1].timestamp.getTime()
        : this._sessionEnd.getTime();
      if (pageEnd - pageStart < 5000) {
        quickExits++;
      }
    }
    if (quickExits >= 3) {
      this._addInsight({
        type: 'confusion',
        severity: 'medium',
        title: 'Content not matching expectations',
        description: `${quickExits} pages were exited in under 5 seconds, suggesting the content does not match what the user expected.`,
        timestamp: this._pageViews[0] ? this._pageViews[0].timestamp : null,
        recommendation: 'Review page titles, meta descriptions, and navigation labels to ensure they accurately describe the content.',
        count: quickExits,
      });
    }
  }

  /* ====================================================================
     Hesitation Detection
  ==================================================================== */

  _detectHesitation() {
    // --- Mouse hovers near CTA for >3s without clicking ---
    const mouseEvents = this.events.filter(e => this._getEventType(e) === 3);
    const clickEvents = this.events.filter(e =>
      this._getEventType(e) === 2 || this._getEventType(e) === 9
    );

    // Group mouse moves by element and detect prolonged hover on CTA-like elements
    const ctaPatterns = /button|btn|cta|submit|buy|koupit|add.to.cart|sign.?up|register|checkout|objednat/i;
    const hoverMap = {};

    for (const me of mouseEvents) {
      const el = this._getEventDataField(me, 'selector', '') ||
                 this._getEventDataField(me, 'element', '');
      if (!el || !ctaPatterns.test(el)) continue;

      const ts = new Date(me.timestamp).getTime();
      if (!hoverMap[el]) hoverMap[el] = { start: ts, end: ts, page: this._getEventDataField(me, 'url', null) };
      hoverMap[el].end = ts;
    }

    for (const [el, info] of Object.entries(hoverMap)) {
      const hoverDuration = info.end - info.start;
      if (hoverDuration > 3000) {
        // Check if a click followed on this element
        const clicked = clickEvents.some(ce => {
          const cel = this._getEventDataField(ce, 'selector', '') ||
                      this._getEventDataField(ce, 'element', '');
          const cts = new Date(ce.timestamp).getTime();
          return cel === el && cts >= info.start && cts <= info.end + 2000;
        });
        if (!clicked) {
          this._addInsight({
            type: 'hesitation',
            severity: 'medium',
            title: 'Hesitation before CTA',
            description: `User hovered over "${el}" for ${Math.round(hoverDuration / 1000)}s without clicking, showing hesitation.`,
            timestamp: new Date(info.start).toISOString(),
            recommendation: 'Consider improving the CTA copy, adding social proof, or reducing friction near this element.',
            element: el,
            page: info.page,
          });
        }
      }
    }

    // --- Scroll to pricing/CTA, pause, scroll away ---
    for (const se of this.events.filter(e => this._getEventType(e) === 5)) {
      const url = this._getEventDataField(se, 'url', '') || '';
      const depth = this._getEventDataField(se, 'scrollDepth', null);
      if (/pricing|cena|price|tarif/i.test(url) && depth !== null && depth > 50 && depth < 80) {
        // Check if next scroll goes back up within 5s
        const seTime = new Date(se.timestamp).getTime();
        const nextScrolls = this.events.filter(e => {
          const t = new Date(e.timestamp).getTime();
          return this._getEventType(e) === 5 && t > seTime && t <= seTime + 5000;
        });
        const scrolledAway = nextScrolls.some(ns => {
          const d = this._getEventDataField(ns, 'scrollDepth', null);
          return d !== null && d < depth - 20;
        });
        if (scrolledAway) {
          this._addInsight({
            type: 'hesitation',
            severity: 'medium',
            title: 'Price/CTA hesitation',
            description: `User scrolled to pricing section on "${url}" and then scrolled away, indicating hesitation.`,
            timestamp: se.timestamp,
            recommendation: 'Consider adding testimonials, a money-back guarantee, or clearer value proposition near pricing.',
            page: url,
          });
          break;
        }
      }
    }

    // --- Input field focused but no typing for >5s ---
    const inputFocusEvents = this.events.filter(e => {
      const t = this._getEventType(e);
      return t === 7 || t === 'input' || t === 'focus';
    });

    for (let i = 0; i < inputFocusEvents.length; i++) {
      const fe = inputFocusEvents[i];
      const feTime = new Date(fe.timestamp).getTime();
      const hasValue = this._getEventDataField(fe, 'value', '') ||
                       this._getEventDataField(fe, 'text', '');

      if (!hasValue) {
        // Check if the next input event on the same field is >5s later
        const field = this._getEventDataField(fe, 'selector', '') ||
                      this._getEventDataField(fe, 'element', '');
        const nextInput = inputFocusEvents.find((e, idx) => {
          if (idx <= i) return false;
          const ef = this._getEventDataField(e, 'selector', '') ||
                     this._getEventDataField(e, 'element', '');
          return ef === field;
        });

        const gap = nextInput
          ? new Date(nextInput.timestamp).getTime() - feTime
          : (this._sessionEnd.getTime() - feTime);

        if (gap > 5000) {
          this._addInsight({
            type: 'hesitation',
            severity: 'low',
            title: 'Form hesitation',
            description: `User focused on input "${field || 'form field'}" but did not type for ${Math.round(gap / 1000)}s.`,
            timestamp: fe.timestamp,
            recommendation: 'Review the field label and placeholder text. Consider adding helper text or examples.',
            element: field,
          });
          break; // Report once
        }
      }
    }

    // --- Multiple visits to same product page without add-to-cart ---
    const productPattern = /product|produkt|katalog|item|detail/i;
    const productPages = {};
    for (const pv of this._pageViews) {
      if (!pv.url || !productPattern.test(pv.url)) continue;
      if (!productPages[pv.url]) productPages[pv.url] = 0;
      productPages[pv.url]++;
    }

    const cartActions = this.events.filter(e => {
      const t = this._getEventType(e);
      const el = this._getEventDataField(e, 'selector', '') ||
                 this._getEventDataField(e, 'element', '');
      const evName = this._getEventDataField(e, 'name', '') ||
                     this._getEventDataField(e, 'event', '');
      return /add.to.cart|addtocart|do.kosiku|pridat/i.test(el + ' ' + evName) ||
             (t === 12 && /cart|kosik/i.test(evName));
    });

    for (const [url, count] of Object.entries(productPages)) {
      if (count >= 2 && cartActions.length === 0) {
        this._addInsight({
          type: 'hesitation',
          severity: 'medium',
          title: 'Purchase hesitation',
          description: `User visited product page "${url}" ${count} times without adding to cart.`,
          timestamp: this._pageViews.find(p => p.url === url)?.timestamp,
          recommendation: 'Consider adding reviews, better product images, or a limited-time offer to encourage conversion.',
          page: url,
          count,
        });
      }
    }
  }

  /* ====================================================================
     Exit Intent Analysis
  ==================================================================== */

  _detectExitIntent() {
    if (!this._pageViews.length) return;

    const lastPage = this._pageViews[this._pageViews.length - 1];
    const lastUrl = lastPage ? lastPage.url || '' : '';
    const durationSec = Math.round(this._sessionDurationMs / 1000);

    // --- Bounce (<10s total) ---
    if (durationSec < 10 && this._pageViews.length <= 1) {
      this._addInsight({
        type: 'exit_intent',
        severity: 'medium',
        title: 'Bounce - content mismatch',
        description: `Session lasted only ${durationSec}s with a single page view, suggesting the content did not match the user\'s expectations.`,
        timestamp: this._sessionEnd ? this._sessionEnd.toISOString() : null,
        recommendation: 'Review the landing page content and traffic sources. Ensure the page matches ad/search intent.',
        page: lastUrl,
      });
      return;
    }

    // --- Exit after error ---
    const lastErrors = this.events.filter(e => {
      const t = this._getEventType(e);
      return t === 11 &&
             new Date(e.timestamp).getTime() >= this._sessionEnd.getTime() - 15000;
    });
    if (lastErrors.length > 0) {
      const err = lastErrors[lastErrors.length - 1];
      const msg = this._getEventDataField(err, 'message', 'Unknown error');
      this._addInsight({
        type: 'exit_intent',
        severity: 'high',
        title: 'Error-driven exit',
        description: `User left the site shortly after encountering an error: "${msg}" on "${lastUrl}".`,
        timestamp: this._sessionEnd ? this._sessionEnd.toISOString() : null,
        recommendation: 'Fix the JavaScript error to prevent users from leaving.',
        page: lastUrl,
      });
      return;
    }

    // --- Exit after rage click ---
    const lastRageClicks = this.events.filter(e => {
      return this._getEventType(e) === 9 &&
             new Date(e.timestamp).getTime() >= this._sessionEnd.getTime() - 15000;
    });
    if (lastRageClicks.length > 0) {
      this._addInsight({
        type: 'exit_intent',
        severity: 'high',
        title: 'Frustration-driven exit',
        description: `User left after rage-clicking on "${lastUrl}". The last rage click was on "${this._getEventDataField(lastRageClicks[lastRageClicks.length - 1], 'selector', 'unknown element')}".`,
        timestamp: this._sessionEnd ? this._sessionEnd.toISOString() : null,
        recommendation: 'Investigate what the user was trying to do and ensure the interface is responsive.',
        page: lastUrl,
      });
      return;
    }

    // --- Abandoned on product/cart/checkout page ---
    if (/cart|kosik|checkout|pokladna|order|objednavka|product|produkt/i.test(lastUrl)) {
      this._addInsight({
        type: 'exit_intent',
        severity: 'high',
        title: `Abandoned at ${lastUrl}`,
        description: `User was on "${lastUrl}" (a conversion-critical page) when they left the site.`,
        timestamp: this._sessionEnd ? this._sessionEnd.toISOString() : null,
        recommendation: 'Review the page for friction points. Consider exit-intent popups, simplified checkout, or trust badges.',
        page: lastUrl,
      });
      return;
    }

    // --- Viewed many pages but still left ---
    if (this._pageViews.length >= 6 && durationSec > 120) {
      this._addInsight({
        type: 'exit_intent',
        severity: 'low',
        title: 'Could not find what they needed',
        description: `User viewed ${this._pageViews.length} pages over ${Math.round(durationSec / 60)}m but still left from "${lastUrl}".`,
        timestamp: this._sessionEnd ? this._sessionEnd.toISOString() : null,
        recommendation: 'Consider improving site search, navigation, or adding a chatbot to help users find content.',
        page: lastUrl,
      });
    }
  }

  /* ====================================================================
     Form Abandonment Detection
  ==================================================================== */

  _detectFormAbandonment() {
    const inputEvents = this.events.filter(e => {
      const t = this._getEventType(e);
      return t === 7 || t === 'input';
    });
    const submitEvents = this.events.filter(e => {
      const t = this._getEventType(e);
      return t === 8 || t === 'form_submit' || t === 'submit';
    });

    if (inputEvents.length > 0 && submitEvents.length === 0) {
      // Count unique fields
      const fields = new Set();
      for (const ie of inputEvents) {
        const f = this._getEventDataField(ie, 'selector', '') ||
                  this._getEventDataField(ie, 'element', '') ||
                  this._getEventDataField(ie, 'field', '');
        if (f) fields.add(f);
      }

      this._addInsight({
        type: 'form_abandonment',
        severity: fields.size >= 3 ? 'high' : 'medium',
        title: 'Form abandoned',
        description: `User interacted with ${fields.size} form field(s) but never submitted the form.`,
        timestamp: inputEvents[0].timestamp,
        recommendation: fields.size >= 3
          ? 'The form may be too long or confusing. Consider reducing the number of fields or adding progress indicators.'
          : 'Review the form for friction points. Ensure validation messages are clear.',
        count: fields.size,
      });
    }

    // --- Field focus -> blur without input ---
    const focusEvents = this.events.filter(e => {
      const action = this._getEventDataField(e, 'action', '');
      return action === 'focus' || action === 'blur';
    });

    const focusBlurPairs = {};
    for (const fe of focusEvents) {
      const field = this._getEventDataField(fe, 'selector', '') ||
                    this._getEventDataField(fe, 'element', '');
      const action = this._getEventDataField(fe, 'action', '');
      if (!field) continue;

      if (action === 'focus') {
        focusBlurPairs[field] = { focused: true, hadInput: false };
      } else if (action === 'blur' && focusBlurPairs[field]) {
        if (!focusBlurPairs[field].hadInput) {
          this._addInsight({
            type: 'form_abandonment',
            severity: 'low',
            title: 'Field label may be unclear',
            description: `User focused on "${field}" and left it without typing, suggesting the field label or purpose is unclear.`,
            timestamp: fe.timestamp,
            recommendation: 'Review the field label, placeholder text, and consider adding helper text.',
            element: field,
          });
        }
        delete focusBlurPairs[field];
      }
    }
  }

  /* ====================================================================
     Dead End Detection
  ==================================================================== */

  _detectDeadEnds() {
    if (!this._pageViews.length) return;

    // Last page in session with no further navigation
    const lastPage = this._pageViews[this._pageViews.length - 1];
    if (!lastPage || !lastPage.url) return;

    const lastPageStart = lastPage.timestamp.getTime();
    const timeOnLastPage = this._sessionEnd.getTime() - lastPageStart;

    // Get clicks on the last page
    const clicksOnLastPage = this.events.filter(e => {
      const t = this._getEventType(e);
      const ts = new Date(e.timestamp).getTime();
      return (t === 2 || t === 9 || t === 10) && ts >= lastPageStart;
    });

    // If user spent time and clicked but didn't navigate, it is a dead end
    if (timeOnLastPage > 10000 && clicksOnLastPage.length > 0) {
      const lastClick = clicksOnLastPage[clicksOnLastPage.length - 1];
      const lastEl = this._getEventDataField(lastClick, 'selector', '') ||
                     this._getEventDataField(lastClick, 'element', '');
      const isLinkOrButton = /^(a|button|input\[type="submit"\])/i.test(lastEl) ||
                             /link|btn|button/i.test(lastEl);

      if (!isLinkOrButton) {
        this._addInsight({
          type: 'dead_end',
          severity: 'medium',
          title: 'No clear next step on page',
          description: `The last click on "${lastPage.url}" was on "${lastEl || 'a non-interactive element'}", suggesting there is no clear call-to-action.`,
          timestamp: lastClick.timestamp,
          recommendation: 'Add a clear call-to-action or navigation element to guide users to the next step.',
          page: lastPage.url,
          element: lastEl,
        });
      }
    }
  }

  /* ====================================================================
     Speed Browsing Detection
  ==================================================================== */

  _detectSpeedBrowsing() {
    if (this._pageViews.length < 3) return;

    let speedPages = 0;
    let minScrollPages = 0;

    for (let i = 0; i < this._pageViews.length; i++) {
      const pageStart = this._pageViews[i].timestamp.getTime();
      const pageEnd = i + 1 < this._pageViews.length
        ? this._pageViews[i + 1].timestamp.getTime()
        : this._sessionEnd.getTime();
      const timeOnPage = pageEnd - pageStart;

      if (timeOnPage < 3000) {
        speedPages++;
      }

      // Check scroll depth during this page
      const scrollsOnPage = this.events.filter(e => {
        const t = new Date(e.timestamp).getTime();
        return this._getEventType(e) === 5 && t >= pageStart && t <= pageEnd;
      });
      const maxDepth = scrollsOnPage.reduce((max, e) => {
        const d = this._getEventDataField(e, 'scrollDepth', 0) ??
                  this._getEventDataField(e, 'depth', 0);
        return Math.max(max, d || 0);
      }, 0);

      if (maxDepth < 25) {
        minScrollPages++;
      }
    }

    if (speedPages >= 3) {
      this._addInsight({
        type: 'speed_browsing',
        severity: 'low',
        title: 'User is scanning, not reading',
        description: `${speedPages} out of ${this._pageViews.length} pages were viewed for less than 3 seconds each.`,
        timestamp: this._pageViews[0].timestamp,
        recommendation: 'Improve page headlines, visual hierarchy, and above-the-fold content to capture attention quickly.',
        count: speedPages,
      });
    }

    if (minScrollPages >= 3 && minScrollPages >= this._pageViews.length * 0.5) {
      this._addInsight({
        type: 'speed_browsing',
        severity: 'low',
        title: 'Content not engaging - minimal scroll depth',
        description: `${minScrollPages} pages had less than 25% scroll depth, suggesting the content above the fold is not engaging enough.`,
        timestamp: this._pageViews[0].timestamp,
        recommendation: 'Review above-the-fold content. Add compelling visuals, clear value propositions, and engaging CTAs.',
        count: minScrollPages,
      });
    }
  }

  /* ====================================================================
     Deep Engagement Detection
  ==================================================================== */

  _detectDeepEngagement() {
    // --- >80% scroll depth ---
    for (let i = 0; i < this._pageViews.length; i++) {
      const pageStart = this._pageViews[i].timestamp.getTime();
      const pageEnd = i + 1 < this._pageViews.length
        ? this._pageViews[i + 1].timestamp.getTime()
        : this._sessionEnd.getTime();

      const scrollsOnPage = this.events.filter(e => {
        const t = new Date(e.timestamp).getTime();
        return this._getEventType(e) === 5 && t >= pageStart && t <= pageEnd;
      });
      const maxDepth = scrollsOnPage.reduce((max, e) => {
        const d = this._getEventDataField(e, 'scrollDepth', 0) ??
                  this._getEventDataField(e, 'depth', 0);
        return Math.max(max, d || 0);
      }, 0);

      if (maxDepth >= 80) {
        this._addInsight({
          type: 'engagement',
          severity: 'info',
          title: 'High scroll engagement',
          description: `User scrolled to ${maxDepth}% depth on "${this._pageViews[i].url || '(unknown)'}".`,
          timestamp: this._pageViews[i].timestamp,
          recommendation: 'This page is performing well in terms of engagement. Consider what makes it work and apply those patterns elsewhere.',
          page: this._pageViews[i].url,
        });
      }
    }

    // --- >3 minutes on page with interactions ---
    for (let i = 0; i < this._pageViews.length; i++) {
      const pageStart = this._pageViews[i].timestamp.getTime();
      const pageEnd = i + 1 < this._pageViews.length
        ? this._pageViews[i + 1].timestamp.getTime()
        : this._sessionEnd.getTime();
      const timeOnPage = pageEnd - pageStart;

      if (timeOnPage > 180000) {
        const interactions = this.events.filter(e => {
          const t = new Date(e.timestamp).getTime();
          const type = this._getEventType(e);
          return t >= pageStart && t <= pageEnd && [2, 5, 7, 8].includes(type);
        });

        if (interactions.length >= 3) {
          this._addInsight({
            type: 'engagement',
            severity: 'info',
            title: 'Deep engagement detected',
            description: `User spent ${Math.round(timeOnPage / 60000)}m on "${this._pageViews[i].url || '(unknown)'}" with ${interactions.length} interactions.`,
            timestamp: this._pageViews[i].timestamp,
            recommendation: 'This page is highly engaging. Ensure the conversion path from this page is optimized.',
            page: this._pageViews[i].url,
          });
        }
      }
    }

    // --- Multiple product views + add to cart ---
    const productViews = this._pageViews.filter(p =>
      p.url && /product|produkt|katalog|item|detail/i.test(p.url)
    );
    const cartActions = this.events.filter(e => {
      const el = this._getEventDataField(e, 'selector', '') ||
                 this._getEventDataField(e, 'element', '');
      const evName = this._getEventDataField(e, 'name', '') ||
                     this._getEventDataField(e, 'event', '');
      return /add.to.cart|addtocart|do.kosiku|pridat/i.test(el + ' ' + evName);
    });

    if (productViews.length >= 2 && cartActions.length > 0) {
      this._addInsight({
        type: 'engagement',
        severity: 'info',
        title: 'High purchase intent',
        description: `User viewed ${productViews.length} product pages and added items to cart.`,
        timestamp: productViews[0].timestamp,
        recommendation: 'Ensure the checkout flow is frictionless. Consider upsell/cross-sell opportunities.',
        count: productViews.length,
      });
    }
  }

  /* ====================================================================
     Session Score Calculation
  ==================================================================== */

  _calculateSessionScore() {
    // ─── Engagement Score (0-100) ───
    let engagement = 0;

    // Pages viewed (up to 30 points)
    const pagePoints = Math.min(30, this._pageViews.length * 5);
    engagement += pagePoints;

    // Time spent (up to 30 points) - max at ~5 min
    const timePoints = Math.min(30, (this._sessionDurationMs / 300000) * 30);
    engagement += timePoints;

    // Scroll depth (up to 20 points)
    const allScrollDepths = this.events
      .filter(e => this._getEventType(e) === 5)
      .map(e =>
        this._getEventDataField(e, 'scrollDepth', 0) ??
        this._getEventDataField(e, 'depth', 0) ?? 0
      );
    const avgDepth = allScrollDepths.length > 0
      ? allScrollDepths.reduce((s, d) => s + d, 0) / allScrollDepths.length
      : 0;
    engagement += Math.min(20, avgDepth * 0.2);

    // Interactions - clicks, inputs (up to 20 points)
    const interactionCount = this.events.filter(e => {
      const t = this._getEventType(e);
      return [2, 7, 8].includes(t);
    }).length;
    engagement += Math.min(20, interactionCount * 2);

    this.score.engagement = Math.round(Math.min(100, Math.max(0, engagement)));

    // ─── Frustration Score (0-100) ───
    let frustration = 0;

    // Rage clicks (up to 40 points)
    const rageCount = this.events.filter(e => this._getEventType(e) === 9).length;
    frustration += Math.min(40, rageCount * 10);

    // Dead clicks (up to 20 points)
    const deadCount = this.events.filter(e => this._getEventType(e) === 10).length;
    frustration += Math.min(20, deadCount * 5);

    // JS errors (up to 20 points)
    const errorCount = this.events.filter(e => this._getEventType(e) === 11).length;
    frustration += Math.min(20, errorCount * 10);

    // Confusion patterns (from insights)
    const confusionInsights = this.insights.filter(i => i.type === 'confusion').length;
    frustration += Math.min(20, confusionInsights * 5);

    this.score.frustration = Math.round(Math.min(100, Math.max(0, frustration)));

    // ─── Conversion Score (0-100) ───
    let conversion = 0;

    // Funnel progress - visited key pages
    const urls = this._pageViews.map(p => (p.url || '').toLowerCase());
    const funnelPages = {
      landing: url => /^\/$|home|landing/i.test(url),
      product: url => /product|produkt|katalog|item|detail/i.test(url),
      cart: url => /cart|kosik|basket/i.test(url),
      checkout: url => /checkout|pokladna|order|objednavka/i.test(url),
      thankyou: url => /thank|dekujeme|success|complete/i.test(url),
    };

    let funnelSteps = 0;
    for (const [, checker] of Object.entries(funnelPages)) {
      if (urls.some(u => checker(u))) funnelSteps++;
    }
    conversion += funnelSteps * 15;

    // Cart activity
    const cartActivity = this.events.filter(e => {
      const el = this._getEventDataField(e, 'selector', '') +
                 ' ' + (this._getEventDataField(e, 'name', '') || '');
      return /cart|kosik|add.to.cart|pridat/i.test(el);
    }).length;
    conversion += Math.min(20, cartActivity * 10);

    // Form completion
    const formSubmits = this.events.filter(e =>
      this._getEventType(e) === 8 || this._getEventType(e) === 'submit'
    ).length;
    conversion += Math.min(25, formSubmits * 12);

    this.score.conversion = Math.round(Math.min(100, Math.max(0, conversion)));
  }

  /* ====================================================================
     Summary Generation
  ==================================================================== */

  _generateSummary() {
    const duration = this._sessionDurationMs;
    const mins = Math.floor(duration / 60000);
    const secs = Math.floor((duration % 60000) / 1000);
    const durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    const pages = this._pageViews.length;
    const country = this.meta.country || null;

    // Determine session character
    const highSeverity = this.insights.filter(i =>
      i.severity === 'critical' || i.severity === 'high'
    );
    const frustrations = this.insights.filter(i => i.type === 'frustration');
    const engagements = this.insights.filter(i => i.type === 'engagement');
    const exits = this.insights.filter(i => i.type === 'exit_intent');

    let parts = [];

    // Opening line
    const visitorDesc = country ? `This visitor from ${country}` : 'This visitor';
    parts.push(`${visitorDesc} spent ${durationStr} browsing ${pages} page${pages !== 1 ? 's' : ''}.`);

    // Main behavior description
    if (engagements.length > 0 && frustrations.length === 0) {
      const engPages = engagements.map(e => e.page).filter(Boolean);
      if (engPages.length > 0) {
        parts.push(`They showed strong engagement on ${engPages.slice(0, 2).join(' and ')}.`);
      } else {
        parts.push('The session showed good overall engagement.');
      }
    } else if (frustrations.length > 0) {
      const topFrustration = frustrations[0];
      parts.push(`They showed frustration ${topFrustration.page ? 'on ' + topFrustration.page : ''}: ${topFrustration.title.toLowerCase()}.`);
    }

    // Product/conversion interest
    const productViews = this._pageViews.filter(p =>
      p.url && /product|produkt|katalog|item/i.test(p.url)
    );
    if (productViews.length >= 2) {
      parts.push(`They showed high interest in product pages (${productViews.length} views).`);
    }

    // Exit context
    if (exits.length > 0) {
      const exitInsight = exits[0];
      if (exitInsight.title.includes('Error-driven')) {
        parts.push(`They left after encountering a JavaScript error.`);
      } else if (exitInsight.title.includes('Frustration-driven')) {
        parts.push(`They left due to frustration.`);
      } else if (exitInsight.title.includes('Abandoned')) {
        parts.push(`They abandoned the session at a critical conversion page.`);
      } else if (exitInsight.title.includes('Bounce')) {
        parts.push(`The session was a bounce - the content likely did not match their expectations.`);
      }
    }

    // Recommendation
    if (highSeverity.length > 0) {
      const topRec = highSeverity[0].recommendation;
      if (topRec) {
        parts.push(`Recommendation: ${topRec}`);
      }
    } else if (this.score.engagement > 70) {
      parts.push('Overall, this was a healthy session with good engagement.');
    }

    return parts.join(' ');
  }

  /* ====================================================================
     De-duplication
  ==================================================================== */

  _deduplicateInsights() {
    const seen = new Set();
    this.insights = this.insights.filter(insight => {
      const key = `${insight.type}::${insight.title}::${insight.page || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

module.exports = SessionAnalyzer;
