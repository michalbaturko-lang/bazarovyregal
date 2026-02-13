/**
 * Google Ads & GA4 Event Tracking for Bazarovyregal.cz
 *
 * Tracks key user interactions for campaign optimization:
 * - Product views (view_item)
 * - Add to cart clicks (add_to_cart)
 * - CTA button clicks (select_content)
 * - Catalog views (view_item_list)
 * - Outbound links to checkout domain (begin_checkout)
 *
 * Loaded after gtag.js and tracking_config.js
 */

(function () {
  'use strict';

  var config = window.BAZAROVYREGAL_TRACKING || {};
  var debug = config.DEBUG_MODE || false;

  function log() {
    if (debug) {
      console.log.apply(console, ['[BR-Track]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  // Wait for gtag to be available
  function sendEvent(eventName, params) {
    if (typeof gtag !== 'function') {
      log('gtag not available, skipping event:', eventName);
      return;
    }
    log('Event:', eventName, params);
    gtag('event', eventName, params);
  }

  // ============================================================
  // Product data extraction from page
  // ============================================================

  function extractProductFromCard(card) {
    var nameEl = card.querySelector('h3, h4, .product-name');
    var priceEl = card.querySelector('.text-primary-600, .font-bold');
    var imgEl = card.querySelector('img');
    var linkEl = card.tagName === 'A' ? card : card.querySelector('a');

    var name = nameEl ? nameEl.textContent.trim() : '';
    var priceText = priceEl ? priceEl.textContent.trim() : '';
    var price = parseFloat(priceText.replace(/[^\d]/g, '')) || 0;
    var url = linkEl ? linkEl.getAttribute('href') : '';
    var id = url ? url.replace('.html', '').replace(/\//g, '') : '';

    return {
      item_id: id,
      item_name: name,
      price: price,
      currency: config.CURRENCY || 'CZK',
      item_brand: 'BazarovyRegal',
      item_category: 'Kovove regaly',
    };
  }

  // ============================================================
  // Track product card clicks (view_item + select_item)
  // ============================================================

  function trackProductClicks() {
    var productCards = document.querySelectorAll(
      'a[href*="regal-"], a[href*="regaly-"], .product-card a'
    );

    productCards.forEach(function (card) {
      card.addEventListener('click', function () {
        var product = extractProductFromCard(card);
        if (product.item_name) {
          sendEvent('select_item', {
            items: [product],
          });
        }
      });
    });

    log('Product click tracking: ' + productCards.length + ' cards');
  }

  // ============================================================
  // Track product page views (view_item)
  // ============================================================

  function trackProductPageView() {
    var path = window.location.pathname;
    if (!path.match(/regal-\d+x\d+x\d+/)) return;

    var h1 = document.querySelector('h1');
    var priceEl = document.querySelector('.text-primary-600, .text-3xl.font-bold');
    var price = priceEl ? parseFloat(priceEl.textContent.replace(/[^\d]/g, '')) : 0;
    var name = h1 ? h1.textContent.trim() : '';
    var id = path.replace('.html', '').replace(/\//g, '');

    sendEvent('view_item', {
      currency: config.CURRENCY || 'CZK',
      value: price,
      items: [{
        item_id: id,
        item_name: name,
        price: price,
        currency: config.CURRENCY || 'CZK',
        item_brand: 'BazarovyRegal',
        item_category: 'Kovove regaly',
      }],
    });
  }

  // ============================================================
  // Track CTA button clicks
  // ============================================================

  function trackCTAClicks() {
    // "Do kosiku" / cart buttons
    var cartButtons = document.querySelectorAll(
      'a[href*="vyprodej-regalu"], button:not([onclick*="toggleChat"])'
    );

    cartButtons.forEach(function (btn) {
      var text = btn.textContent.toLowerCase();
      if (text.indexOf('ko') > -1 || text.indexOf('cart') > -1 ||
          text.indexOf('objednat') > -1 || text.indexOf('koupit') > -1) {
        btn.addEventListener('click', function () {
          // Track add_to_cart
          sendEvent('add_to_cart', {
            currency: config.CURRENCY || 'CZK',
            items: [{
              item_name: document.querySelector('h1') ? document.querySelector('h1').textContent.trim() : 'Unknown',
              item_brand: 'BazarovyRegal',
            }],
          });

          // Also send Google Ads conversion
          if (config.GOOGLE_ADS_ID && config.CONVERSION_LABEL_ADD_TO_CART &&
              config.GOOGLE_ADS_ID !== 'AW-XXXXXXXXX') {
            gtag('event', 'conversion', {
              send_to: config.GOOGLE_ADS_ID + '/' + config.CONVERSION_LABEL_ADD_TO_CART,
            });
          }
        });
      }
    });

    // "Katalog" / browse buttons
    var browseButtons = document.querySelectorAll(
      'a[href*="katalog"], a[href*="#produkty"], a[href*="#kategorie"]'
    );
    browseButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        sendEvent('select_content', {
          content_type: 'cta_button',
          content_id: btn.getAttribute('href') || 'unknown',
        });
      });
    });

    log('CTA tracking initialized');
  }

  // ============================================================
  // Track outbound links to checkout domain
  // ============================================================

  function trackOutboundLinks() {
    var crossDomain = config.CROSS_DOMAIN || 'vyprodej-regalu.cz';
    var links = document.querySelectorAll('a[href*="' + crossDomain + '"]');

    links.forEach(function (link) {
      link.addEventListener('click', function () {
        sendEvent('begin_checkout', {
          currency: config.CURRENCY || 'CZK',
          items: [{
            item_name: document.querySelector('h1') ? document.querySelector('h1').textContent.trim() : 'Checkout',
            item_brand: 'BazarovyRegal',
          }],
        });
        log('Outbound click to: ' + link.href);
      });
    });

    log('Outbound tracking: ' + links.length + ' links to ' + crossDomain);
  }

  // ============================================================
  // Track catalog/list views
  // ============================================================

  function trackCatalogView() {
    var path = window.location.pathname;
    if (path.indexOf('katalog') === -1 && path.indexOf('kategori') === -1) return;

    var products = [];
    var cards = document.querySelectorAll('a[href*="regal-"]');
    cards.forEach(function (card, index) {
      var product = extractProductFromCard(card);
      product.index = index;
      if (product.item_name) products.push(product);
    });

    if (products.length > 0) {
      sendEvent('view_item_list', {
        item_list_id: 'catalog',
        item_list_name: document.querySelector('h1') ? document.querySelector('h1').textContent.trim() : 'Katalog',
        items: products.slice(0, 10), // First 10 products
      });
    }
  }

  // ============================================================
  // Track search usage
  // ============================================================

  function trackSearch() {
    var searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    var searchTimeout;
    searchInput.addEventListener('input', function () {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(function () {
        var query = searchInput.value.trim();
        if (query.length >= 3) {
          sendEvent('search', {
            search_term: query,
          });
        }
      }, 1500);
    });

    log('Search tracking initialized');
  }

  // ============================================================
  // Track page scroll depth
  // ============================================================

  function trackScrollDepth() {
    var milestones = [25, 50, 75, 90];
    var reached = {};

    window.addEventListener('scroll', function () {
      var scrollPct = Math.round(
        (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
      );

      milestones.forEach(function (milestone) {
        if (scrollPct >= milestone && !reached[milestone]) {
          reached[milestone] = true;
          sendEvent('scroll', {
            percent_scrolled: milestone,
            page_path: window.location.pathname,
          });
        }
      });
    });
  }

  // ============================================================
  // Initialize all tracking
  // ============================================================

  function init() {
    log('Initializing tracking...');
    log('Config:', config);

    trackProductPageView();
    trackProductClicks();
    trackCTAClicks();
    trackOutboundLinks();
    trackCatalogView();
    trackSearch();
    trackScrollDepth();

    // Track page view timing
    if (window.performance) {
      window.addEventListener('load', function () {
        setTimeout(function () {
          var timing = performance.getEntriesByType('navigation')[0];
          if (timing) {
            sendEvent('page_timing', {
              page_load_time: Math.round(timing.loadEventEnd - timing.startTime),
              dom_interactive: Math.round(timing.domInteractive - timing.startTime),
              page_path: window.location.pathname,
            });
          }
        }, 100);
      });
    }

    log('Tracking initialized successfully');
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
