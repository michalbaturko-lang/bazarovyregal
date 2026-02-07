'use strict';

const { v4: uuidv4 } = require('uuid');
const supabase = require('./supabase');

// ============================================================================
// Event type constants (must match routes/events.js)
// ============================================================================
const EVENT_TYPES = {
  SESSION_START: 0,
  DOM_SNAPSHOT: 1,
  DOM_MUTATION: 2,
  MOUSE_MOVE: 3,
  MOUSE_CLICK: 4,
  SCROLL: 5,
  INPUT: 6,
  RESIZE: 7,
  PAGE_NAVIGATION: 8,
  CONSOLE: 9,
  NETWORK: 10,
  ERROR: 11,
  RAGE_CLICK: 12,
  IDENTIFY: 13,
  CUSTOM_EVENT: 14,
};

// ============================================================================
// Helpers
// ============================================================================

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedPick(items) {
  // items: [{ value, weight }, ...]
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item.value;
  }
  return items[items.length - 1].value;
}

/** Generate a weighted random duration (seconds). Most sessions 30-180s. */
function randomDuration() {
  const bucket = weightedPick([
    { value: 'short', weight: 15 },   // 15-30s
    { value: 'medium', weight: 50 },   // 30-180s
    { value: 'long', weight: 25 },     // 180-400s
    { value: 'vlong', weight: 10 },    // 400-600s
  ]);
  switch (bucket) {
    case 'short':  return randomInt(15, 30);
    case 'medium': return randomInt(30, 180);
    case 'long':   return randomInt(180, 400);
    case 'vlong':  return randomInt(400, 600);
  }
}

/** Generate a random timestamp over the last 30 days, weighted towards recent days. */
function randomStartedAt() {
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  // Use a power distribution to weight towards recent dates
  const r = Math.pow(Math.random(), 1.8); // higher exponent = more recent bias
  const offsetMs = r * thirtyDaysMs;
  const ts = now - offsetMs;
  // Add random hour offset for natural spread
  return new Date(ts - randomInt(0, 3600000));
}

// ============================================================================
// Data pools
// ============================================================================

const URLS = [
  '/',
  '/katalog',
  '/akce-regaly-2026',
  '/bile-regaly',
  '/cerne-regaly',
  '/regal-180x90x40-cerna',
  '/regal-150x70x30-zinkovany',
  '/regal-200x100x50-bila',
  '/regal-120x60x30-drevo',
  '/jak-vybrat-regal',
  '/kontakt',
  '/faq',
  '/o-nas',
  '/doprava-a-platba',
  '/obchodni-podminky',
];

const URL_WEIGHTS = [
  { value: '/', weight: 25 },
  { value: '/katalog', weight: 20 },
  { value: '/akce-regaly-2026', weight: 15 },
  { value: '/bile-regaly', weight: 8 },
  { value: '/cerne-regaly', weight: 7 },
  { value: '/regal-180x90x40-cerna', weight: 6 },
  { value: '/regal-150x70x30-zinkovany', weight: 5 },
  { value: '/regal-200x100x50-bila', weight: 3 },
  { value: '/regal-120x60x30-drevo', weight: 2 },
  { value: '/jak-vybrat-regal', weight: 4 },
  { value: '/kontakt', weight: 3 },
  { value: '/faq', weight: 2 },
];

const PAGE_TITLES = {
  '/': 'Výprodej Regálů | Levné regály skladem',
  '/katalog': 'Katalog regálů | Výprodej Regálů',
  '/akce-regaly-2026': 'Akce regály 2026 - slevy až 40% | Výprodej Regálů',
  '/bile-regaly': 'Bílé regály | Výprodej Regálů',
  '/cerne-regaly': 'Černé regály | Výprodej Regálů',
  '/regal-180x90x40-cerna': 'Regál 180x90x40 černý | Výprodej Regálů',
  '/regal-150x70x30-zinkovany': 'Regál 150x70x30 zinkovaný | Výprodej Regálů',
  '/regal-200x100x50-bila': 'Regál 200x100x50 bílý | Výprodej Regálů',
  '/regal-120x60x30-drevo': 'Regál 120x60x30 dřevo | Výprodej Regálů',
  '/jak-vybrat-regal': 'Jak vybrat regál - průvodce | Výprodej Regálů',
  '/kontakt': 'Kontakt | Výprodej Regálů',
  '/faq': 'Časté dotazy | Výprodej Regálů',
  '/o-nas': 'O nás | Výprodej Regálů',
  '/doprava-a-platba': 'Doprava a platba | Výprodej Regálů',
  '/obchodni-podminky': 'Obchodní podmínky | Výprodej Regálů',
};

const REFERRERS = [
  { value: '', weight: 35 },                                      // direct
  { value: 'https://www.google.com/', weight: 25 },
  { value: 'https://www.seznam.cz/', weight: 15 },
  { value: 'https://www.facebook.com/', weight: 10 },
  { value: 'https://www.instagram.com/', weight: 5 },
  { value: 'https://www.google.cz/', weight: 5 },
  { value: 'https://www.zbozi.cz/', weight: 3 },
  { value: 'https://www.heureka.cz/', weight: 2 },
];

const BROWSERS = [
  { value: 'Chrome', weight: 60 },
  { value: 'Safari', weight: 20 },
  { value: 'Firefox', weight: 15 },
  { value: 'Edge', weight: 5 },
];

const OS_LIST = [
  { value: 'Windows', weight: 45 },
  { value: 'macOS', weight: 25 },
  { value: 'Android', weight: 15 },
  { value: 'iOS', weight: 15 },
];

const DEVICE_TYPES = [
  { value: 'desktop', weight: 60 },
  { value: 'mobile', weight: 35 },
  { value: 'tablet', weight: 5 },
];

const COUNTRIES = [
  { value: 'CZ', weight: 80 },
  { value: 'SK', weight: 10 },
  { value: 'DE', weight: 3 },
  { value: 'PL', weight: 3 },
  { value: 'AT', weight: 2 },
  { value: 'HU', weight: 1 },
  { value: 'US', weight: 1 },
];

const CITIES_CZ = ['Praha', 'Brno', 'Ostrava', 'Plzeň', 'Liberec', 'Olomouc', 'České Budějovice', 'Hradec Králové', 'Pardubice', 'Zlín'];
const CITIES_SK = ['Bratislava', 'Košice', 'Žilina', 'Banská Bystrica', 'Nitra'];
const CITIES_OTHER = ['Berlin', 'Wien', 'Warszawa', 'Budapest', 'New York'];

const LANGUAGES = [
  { value: 'cs', weight: 85 },
  { value: 'sk', weight: 8 },
  { value: 'en', weight: 7 },
];

const CZECH_FIRST_NAMES = ['Jan', 'Petr', 'Martin', 'Tomáš', 'Jakub', 'David', 'Lukáš', 'Filip', 'Ondřej', 'Michal', 'Petra', 'Jana', 'Tereza', 'Lucie', 'Kateřina', 'Eva', 'Anna', 'Marie', 'Markéta', 'Veronika'];
const CZECH_LAST_NAMES = ['Novák', 'Svoboda', 'Novotný', 'Dvořák', 'Černý', 'Procházka', 'Kučera', 'Veselý', 'Horák', 'Němec', 'Nováková', 'Svobodová', 'Novotná', 'Dvořáková', 'Černá', 'Procházková', 'Kučerová', 'Veselá', 'Horáková', 'Němcová'];
const EMAIL_DOMAINS = ['email.cz', 'seznam.cz', 'centrum.cz', 'gmail.com', 'post.cz', 'volny.cz'];

const CLICK_SELECTORS = [
  'button.add-to-cart',
  'a.nav-link',
  'a.product-card',
  'button.btn-primary',
  'a.category-link',
  'button.filter-apply',
  'a.logo',
  'button.cookie-accept',
  'a.breadcrumb-link',
  'input.search-input',
  'button.search-submit',
  'a.footer-link',
  'button.menu-toggle',
  'a.pagination-next',
];

const CLICK_TEXTS = [
  'Koupit',
  'Do košíku',
  'Přidat do košíku',
  'Zobrazit detail',
  'Katalog',
  'Akce',
  'Kontakt',
  'Odeslat',
  'Filtrovat',
  'Další',
  'Přijmout cookies',
  'Hledat',
  'Domů',
  'Bílé regály',
  'Černé regály',
];

const CUSTOM_EVENT_NAMES = ['add_to_cart', 'search', 'view_product', 'scroll_to_bottom', 'newsletter_signup', 'filter_applied', 'share_product'];

const PRODUCTS = [
  { name: 'Regál 180x90x40 černý', price: 749 },
  { name: 'Regál 150x70x30 zinkovaný', price: 599 },
  { name: 'Regál 200x100x50 bílý', price: 1299 },
  { name: 'Regál 120x60x30 dřevo', price: 899 },
  { name: 'Rohový regál 160x40x40', price: 1099 },
  { name: 'Policový regál 5 polic', price: 649 },
  { name: 'Kovový regál garáž', price: 1499 },
  { name: 'Dětský regál barevný', price: 449 },
];

const JS_ERROR_MESSAGES = [
  "TypeError: Cannot read properties of undefined (reading 'length')",
  "TypeError: Cannot read properties of null (reading 'style')",
  "ReferenceError: gtag is not defined",
  "TypeError: document.querySelector(...) is null",
  "SyntaxError: Unexpected token '<'",
  "TypeError: Failed to fetch",
  "RangeError: Maximum call stack size exceeded",
  "TypeError: Cannot set properties of undefined (setting 'innerHTML')",
];

const JS_ERROR_SOURCES = [
  'chatbot.js',
  'analytics.js',
  'main.bundle.js',
  'vendor.js',
  'tracking.js',
  'app.js',
];

const SEARCH_TERMS = [
  'regál černý',
  'police',
  'akce',
  'kovový regál',
  'bílý regál',
  'garáž',
  'dětský pokoj',
  '180x90',
  'levný regál',
  'doprava zdarma',
];

// ============================================================================
// UTM configuration
// ============================================================================

const UTM_CONFIGS = [
  { weight: 65, utm: null },  // no UTM
  { weight: 12, utm: { utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'regaly-vyhledavani' } },
  { weight: 8, utm: { utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'akce-regaly-2026' } },
  { weight: 5, utm: { utm_source: 'facebook', utm_medium: 'social', utm_campaign: 'retargeting-katalog' } },
  { weight: 4, utm: { utm_source: 'facebook', utm_medium: 'social', utm_campaign: 'vyprodej-zima' } },
  { weight: 3, utm: { utm_source: 'seznam', utm_medium: 'cpc', utm_campaign: 'sklik-regaly' } },
  { weight: 2, utm: { utm_source: 'instagram', utm_medium: 'social', utm_campaign: 'stories-novinky' } },
  { weight: 1, utm: { utm_source: 'newsletter', utm_medium: 'email', utm_campaign: 'leden-2026' } },
];

// ============================================================================
// Screen / viewport dimensions by device type
// ============================================================================

const SCREEN_CONFIGS = {
  desktop: [
    { sw: 1920, sh: 1080, vw: 1920, vh: 937 },
    { sw: 1920, sh: 1080, vw: 1536, vh: 864 },
    { sw: 2560, sh: 1440, vw: 2560, vh: 1297 },
    { sw: 1366, sh: 768, vw: 1366, vh: 625 },
    { sw: 1440, sh: 900, vw: 1440, vh: 757 },
    { sw: 1680, sh: 1050, vw: 1680, vh: 907 },
  ],
  mobile: [
    { sw: 390, sh: 844, vw: 390, vh: 664 },
    { sw: 412, sh: 915, vw: 412, vh: 735 },
    { sw: 375, sh: 812, vw: 375, vh: 632 },
    { sw: 360, sh: 800, vw: 360, vh: 640 },
    { sw: 414, sh: 896, vw: 414, vh: 715 },
    { sw: 393, sh: 851, vw: 393, vh: 671 },
  ],
  tablet: [
    { sw: 768, sh: 1024, vw: 768, vh: 954 },
    { sw: 810, sh: 1080, vw: 810, vh: 1010 },
    { sw: 820, sh: 1180, vw: 820, vh: 1110 },
    { sw: 1024, sh: 1366, vw: 1024, vh: 1296 },
  ],
};

// ============================================================================
// Session generator
// ============================================================================

function generateVisitorPool(count) {
  const pool = [];
  for (let i = 0; i < count; i++) {
    pool.push(uuidv4());
  }
  return pool;
}

function generateEmail() {
  const first = pick(CZECH_FIRST_NAMES).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const last = pick(CZECH_LAST_NAMES).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const domain = pick(EMAIL_DOMAINS);
  return `${first}.${last}@${domain}`;
}

function generateUserName() {
  return `${pick(CZECH_FIRST_NAMES)} ${pick(CZECH_LAST_NAMES)}`;
}

function cityForCountry(country) {
  switch (country) {
    case 'CZ': return pick(CITIES_CZ);
    case 'SK': return pick(CITIES_SK);
    default: return pick(CITIES_OTHER);
  }
}

function generateSession(visitorPool) {
  const id = uuidv4();
  const isReturning = Math.random() < 0.3;
  const visitor_id = isReturning
    ? visitorPool[randomInt(0, Math.min(29, visitorPool.length - 1))]  // reuse from first 30
    : pick(visitorPool);

  const started_at = randomStartedAt();
  const duration = randomDuration();
  const ended_at = new Date(started_at.getTime() + duration * 1000);

  const landingUrl = weightedPick(URL_WEIGHTS);
  const referrer = weightedPick(REFERRERS);
  const browser = weightedPick(BROWSERS);
  const os = weightedPick(OS_LIST);
  const device_type = weightedPick(DEVICE_TYPES);
  const country = weightedPick(COUNTRIES);
  const city = cityForCountry(country);
  const language = weightedPick(LANGUAGES);

  const screenConfig = pick(SCREEN_CONFIGS[device_type]);
  const page_count = randomInt(1, 8);
  const has_rage_clicks = Math.random() < 0.08;
  const has_errors = Math.random() < 0.05;

  // UTM
  const utmConfig = weightedPick(UTM_CONFIGS);

  // Identified user (~20%)
  const isIdentified = Math.random() < 0.20;
  const identified_user_id = isIdentified ? uuidv4() : null;
  const identified_user_email = isIdentified ? generateEmail() : null;
  const identified_user_name = isIdentified ? generateUserName() : null;

  // Generate navigation path
  const visitedUrls = [landingUrl];
  for (let i = 1; i < page_count; i++) {
    let nextUrl;
    do {
      nextUrl = weightedPick(URL_WEIGHTS);
    } while (nextUrl === visitedUrls[visitedUrls.length - 1] && URLS.length > 1);
    visitedUrls.push(nextUrl);
  }

  // Event count (will be computed after generating events)
  const session = {
    id,
    project_id: 'default',
    visitor_id,
    started_at: started_at.toISOString(),
    ended_at: ended_at.toISOString(),
    duration,
    url: landingUrl,
    referrer,
    user_agent: null,
    screen_width: screenConfig.sw,
    screen_height: screenConfig.sh,
    viewport_width: screenConfig.vw,
    viewport_height: screenConfig.vh,
    browser,
    os,
    device_type,
    country,
    city,
    language,
    utm_source: utmConfig ? utmConfig.utm_source : null,
    utm_medium: utmConfig ? utmConfig.utm_medium : null,
    utm_campaign: utmConfig ? utmConfig.utm_campaign : null,
    utm_term: null,
    utm_content: null,
    page_count,
    event_count: 0,  // will be updated
    has_rage_clicks,
    has_errors,
    identified_user_id,
    identified_user_email,
    identified_user_name,
  };

  return { session, visitedUrls, screenConfig };
}

// ============================================================================
// Event generator
// ============================================================================

function generateEventsForSession(session, visitedUrls, screenConfig) {
  const events = [];
  const sessionStartMs = new Date(session.started_at).getTime();
  const durationMs = session.duration * 1000;
  const maxX = screenConfig.sw;

  // --- Type 0: SESSION_START (1 per session, at timestamp 0) ---
  events.push({
    session_id: session.id,
    type: EVENT_TYPES.SESSION_START,
    timestamp: sessionStartMs,
    data: {
      url: `https://vyprodej-regalu.cz${visitedUrls[0]}`,
      referrer: session.referrer,
      screenWidth: screenConfig.sw,
      screenHeight: screenConfig.sh,
      viewportWidth: screenConfig.vw,
      viewportHeight: screenConfig.vh,
      browser: session.browser,
      os: session.os,
      language: session.language,
      visitorId: session.visitor_id,
    },
    url: `https://vyprodej-regalu.cz${visitedUrls[0]}`,
  });

  // --- Type 1: DOM_SNAPSHOT (1 per session, at ~50ms) ---
  events.push({
    session_id: session.id,
    type: EVENT_TYPES.DOM_SNAPSHOT,
    timestamp: sessionStartMs + randomInt(40, 80),
    data: {
      html: '<!DOCTYPE html><html lang="cs"><head><title>' + (PAGE_TITLES[visitedUrls[0]] || 'Výprodej Regálů') + '</title></head><body><!-- snapshot placeholder --></body></html>',
    },
    url: `https://vyprodej-regalu.cz${visitedUrls[0]}`,
  });

  // --- Type 3: MOUSE_MOVE (10-50 per session) ---
  const mouseMoveCount = randomInt(10, 50);
  for (let i = 0; i < mouseMoveCount; i++) {
    const t = sessionStartMs + randomInt(200, durationMs);
    events.push({
      session_id: session.id,
      type: EVENT_TYPES.MOUSE_MOVE,
      timestamp: t,
      data: {
        x: randomInt(0, maxX),
        y: randomInt(0, 5000),
      },
      url: null,
    });
  }

  // --- Type 4: MOUSE_CLICK (3-15 per session) ---
  const clickCount = randomInt(3, 15);
  for (let i = 0; i < clickCount; i++) {
    const t = sessionStartMs + randomInt(500, durationMs);
    events.push({
      session_id: session.id,
      type: EVENT_TYPES.MOUSE_CLICK,
      timestamp: t,
      data: {
        x: randomInt(50, maxX - 50),
        y: randomInt(100, 3000),
        selector: pick(CLICK_SELECTORS),
        text: pick(CLICK_TEXTS),
      },
      url: null,
    });
  }

  // --- Type 5: SCROLL (5-20 per session) ---
  const scrollCount = randomInt(5, 20);
  let currentScrollY = 0;
  for (let i = 0; i < scrollCount; i++) {
    const t = sessionStartMs + Math.floor((durationMs / scrollCount) * (i + 0.5)) + randomInt(-500, 500);
    currentScrollY = Math.min(currentScrollY + randomInt(50, 400), 5000);
    events.push({
      session_id: session.id,
      type: EVENT_TYPES.SCROLL,
      timestamp: Math.max(sessionStartMs + 100, t),
      data: {
        x: 0,
        y: currentScrollY,
      },
      url: null,
    });
  }

  // --- Type 6: INPUT (0-5 per session) ---
  const inputCount = randomInt(0, 5);
  for (let i = 0; i < inputCount; i++) {
    const t = sessionStartMs + randomInt(1000, durationMs);
    events.push({
      session_id: session.id,
      type: EVENT_TYPES.INPUT,
      timestamp: t,
      data: {
        selector: pick(['input.search', 'input[name="email"]', 'input[name="phone"]', 'textarea.message', 'input.newsletter-email']),
        value: '***',
      },
      url: null,
    });
  }

  // --- Type 12: RAGE_CLICK (0-3 for sessions with rage clicks) ---
  if (session.has_rage_clicks) {
    const rageCount = randomInt(1, 3);
    for (let i = 0; i < rageCount; i++) {
      const t = sessionStartMs + randomInt(2000, durationMs);
      const rx = randomInt(100, maxX - 100);
      const ry = randomInt(200, 2000);
      events.push({
        session_id: session.id,
        type: EVENT_TYPES.RAGE_CLICK,
        timestamp: t,
        data: {
          x: rx,
          y: ry,
          count: randomInt(4, 8),
          selector: pick(['button.add-to-cart', 'a.broken-link', 'div.loading-spinner', 'button.submit', 'img.product-image']),
        },
        url: null,
      });
    }
  }

  // --- Type 11: ERROR (0-2 for sessions with errors) ---
  if (session.has_errors) {
    const errorCount = randomInt(1, 2);
    for (let i = 0; i < errorCount; i++) {
      const t = sessionStartMs + randomInt(500, durationMs);
      const source = pick(JS_ERROR_SOURCES);
      const message = pick(JS_ERROR_MESSAGES);
      const line = randomInt(1, 500);
      events.push({
        session_id: session.id,
        type: EVENT_TYPES.ERROR,
        timestamp: t,
        data: {
          message,
          source,
          line,
          column: randomInt(1, 80),
          stack: `${message}\n    at Object.<anonymous> (https://vyprodej-regalu.cz/assets/${source}:${line}:${randomInt(1, 40)})\n    at Module._compile (node:internal/modules/cjs/loader:1275:14)\n    at Object.Module._extensions..js (node:internal/modules/cjs/loader:1329:10)`,
        },
        url: null,
      });
    }
  }

  // --- Type 14: CUSTOM_EVENT (0-5 per session) ---
  const customEventCount = randomInt(0, 5);
  for (let i = 0; i < customEventCount; i++) {
    const t = sessionStartMs + randomInt(1000, durationMs);
    const eventName = pick(CUSTOM_EVENT_NAMES);
    let eventData = { name: eventName };

    switch (eventName) {
      case 'add_to_cart': {
        const product = pick(PRODUCTS);
        eventData.product = product.name;
        eventData.price = product.price;
        eventData.currency = 'CZK';
        eventData.quantity = 1;
        break;
      }
      case 'view_product': {
        const product = pick(PRODUCTS);
        eventData.product = product.name;
        eventData.price = product.price;
        eventData.currency = 'CZK';
        break;
      }
      case 'search': {
        eventData.query = pick(SEARCH_TERMS);
        eventData.results_count = randomInt(0, 25);
        break;
      }
      case 'scroll_to_bottom': {
        eventData.page = pick(visitedUrls);
        eventData.time_to_bottom = randomFloat(3, 30).toFixed(1);
        break;
      }
      case 'newsletter_signup': {
        eventData.email_hash = uuidv4().slice(0, 12);
        break;
      }
      case 'filter_applied': {
        eventData.filter_type = pick(['color', 'size', 'price', 'material']);
        eventData.filter_value = pick(['černá', 'bílá', 'zinkovaný', '0-500', '500-1000', '1000+', 'kov', 'dřevo']);
        break;
      }
      case 'share_product': {
        eventData.platform = pick(['facebook', 'whatsapp', 'email', 'copy_link']);
        eventData.product = pick(PRODUCTS).name;
        break;
      }
    }

    events.push({
      session_id: session.id,
      type: EVENT_TYPES.CUSTOM_EVENT,
      timestamp: t,
      data: eventData,
      url: null,
    });
  }

  // --- Type 8: PAGE_NAVIGATION (page_count - 1 per session) ---
  for (let i = 1; i < visitedUrls.length; i++) {
    const fraction = i / visitedUrls.length;
    const t = sessionStartMs + Math.floor(fraction * durationMs) + randomInt(-2000, 2000);
    const navUrl = `https://vyprodej-regalu.cz${visitedUrls[i]}`;
    events.push({
      session_id: session.id,
      type: EVENT_TYPES.PAGE_NAVIGATION,
      timestamp: Math.max(sessionStartMs + 1000, t),
      data: {
        url: navUrl,
        title: PAGE_TITLES[visitedUrls[i]] || 'Výprodej Regálů',
        previousUrl: `https://vyprodej-regalu.cz${visitedUrls[i - 1]}`,
      },
      url: navUrl,
    });
  }

  // Sort all events by timestamp
  events.sort((a, b) => a.timestamp - b.timestamp);

  return events;
}

// ============================================================================
// Batch insert helper (Supabase has row limits per insert)
// ============================================================================

async function batchInsert(table, rows, batchSize = 500) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).insert(batch);
    if (error) {
      throw new Error(`Error inserting into ${table} (batch ${Math.floor(i / batchSize) + 1}): ${error.message}`);
    }
    inserted += batch.length;
  }
  return inserted;
}

// ============================================================================
// Main seed function
// ============================================================================

async function seed() {
  const startTime = Date.now();
  console.log('='.repeat(60));
  console.log('  Regal Master Look — Seed Data Generator');
  console.log('='.repeat(60));
  console.log();

  // ------------------------------------------------------------------
  // 1. Upsert the default project
  // ------------------------------------------------------------------
  console.log('[1/5] Upserting default project...');
  const { error: projectError } = await supabase.from('projects').upsert({
    id: 'default',
    name: 'Výprodej Regálů',
    domain: 'vyprodej-regalu.cz',
  });
  if (projectError) throw new Error(`Project upsert failed: ${projectError.message}`);
  console.log('  -> Project "Výprodej Regálů" (vyprodej-regalu.cz) ready.');
  console.log();

  // ------------------------------------------------------------------
  // 2. Generate sessions
  // ------------------------------------------------------------------
  console.log('[2/5] Generating 150 sessions...');
  const SESSION_COUNT = 150;
  const visitorPool = generateVisitorPool(100); // 100 unique visitors, ~30% reuse

  const allSessions = [];
  const allEvents = [];

  for (let i = 0; i < SESSION_COUNT; i++) {
    const { session, visitedUrls, screenConfig } = generateSession(visitorPool);
    const events = generateEventsForSession(session, visitedUrls, screenConfig);

    // Update event_count on the session
    session.event_count = events.length;

    allSessions.push(session);
    allEvents.push(...events);

    if ((i + 1) % 25 === 0 || i === SESSION_COUNT - 1) {
      console.log(`  -> Generated ${i + 1}/${SESSION_COUNT} sessions (${allEvents.length} events so far)`);
    }
  }
  console.log();

  // ------------------------------------------------------------------
  // 3. Insert sessions into database
  // ------------------------------------------------------------------
  console.log('[3/5] Inserting sessions and events into database...');

  console.log(`  -> Inserting ${allSessions.length} sessions...`);
  await batchInsert('sessions', allSessions);
  console.log(`  -> Sessions inserted.`);

  console.log(`  -> Inserting ${allEvents.length} events (in batches of 500)...`);
  const totalEventsInserted = await batchInsert('events', allEvents, 500);
  console.log(`  -> ${totalEventsInserted} events inserted.`);
  console.log();

  // ------------------------------------------------------------------
  // 4. Create sample funnels
  // ------------------------------------------------------------------
  console.log('[4/5] Creating sample funnels...');

  const funnels = [
    {
      id: 'funnel-purchase',
      project_id: 'default',
      name: 'Nákupní cesta',
      steps: [
        { type: 'url', value: '/', name: 'Hlavní stránka' },
        { type: 'url', value: '/katalog', name: 'Katalog' },
        { type: 'event', value: 'view_product', name: 'Zobrazení produktu' },
        { type: 'event', value: 'add_to_cart', name: 'Přidání do košíku' },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'funnel-contact',
      project_id: 'default',
      name: 'SEO → Kontakt',
      steps: [
        { type: 'url', value: '/akce-regaly-2026', name: 'Akce stránka' },
        { type: 'url', value: '/jak-vybrat-regal', name: 'Jak vybrat regál' },
        { type: 'url', value: '/kontakt', name: 'Kontaktní formulář' },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  for (const funnel of funnels) {
    const { error } = await supabase.from('funnels').upsert(funnel);
    if (error) throw new Error(`Funnel "${funnel.name}" insert failed: ${error.message}`);
    console.log(`  -> Funnel "${funnel.name}" (${funnel.steps.length} steps) created.`);
  }
  console.log();

  // ------------------------------------------------------------------
  // 5. Create sample segments
  // ------------------------------------------------------------------
  console.log('[5/5] Creating sample segments...');

  const segments = [
    {
      id: 'seg-mobile',
      project_id: 'default',
      name: 'Mobilní uživatelé',
      filters: { device_type: 'mobile' },
      created_at: new Date().toISOString(),
    },
    {
      id: 'seg-rage',
      project_id: 'default',
      name: 'Frustrovaní uživatelé',
      filters: { has_rage_clicks: true },
      created_at: new Date().toISOString(),
    },
  ];

  for (const segment of segments) {
    const { error } = await supabase.from('segments').upsert(segment);
    if (error) throw new Error(`Segment "${segment.name}" insert failed: ${error.message}`);
    console.log(`  -> Segment "${segment.name}" created.`);
  }
  console.log();

  // ------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // Compute some stats
  const uniqueVisitors = new Set(allSessions.map((s) => s.visitor_id)).size;
  const identifiedCount = allSessions.filter((s) => s.identified_user_email).length;
  const rageClickCount = allSessions.filter((s) => s.has_rage_clicks).length;
  const errorCount = allSessions.filter((s) => s.has_errors).length;
  const avgDuration = Math.round(allSessions.reduce((s, sess) => s + sess.duration, 0) / allSessions.length);
  const avgEvents = Math.round(allEvents.length / allSessions.length);

  console.log('='.repeat(60));
  console.log('  Seed complete!');
  console.log('='.repeat(60));
  console.log();
  console.log(`  Sessions:         ${allSessions.length}`);
  console.log(`  Events:           ${totalEventsInserted}`);
  console.log(`  Funnels:          ${funnels.length}`);
  console.log(`  Segments:         ${segments.length}`);
  console.log();
  console.log(`  Unique visitors:  ${uniqueVisitors}`);
  console.log(`  Identified users: ${identifiedCount}`);
  console.log(`  Rage click sess:  ${rageClickCount}`);
  console.log(`  Error sessions:   ${errorCount}`);
  console.log(`  Avg duration:     ${avgDuration}s`);
  console.log(`  Avg events/sess:  ${avgEvents}`);
  console.log();
  console.log(`  Time elapsed:     ${elapsed}s`);
  console.log();
}

// ============================================================================
// Run
// ============================================================================

seed()
  .then(() => {
    console.log('Done. Exiting.');
    process.exit(0);
  })
  .catch((err) => {
    console.error();
    console.error('ERROR: Seed failed!');
    console.error(err.message || err);
    console.error();
    if (err.stack) console.error(err.stack);
    process.exit(1);
  });
