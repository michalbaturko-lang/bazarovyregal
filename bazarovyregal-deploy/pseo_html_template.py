#!/usr/bin/env python3
"""Shared HTML template for all pSEO pages."""

import json as _json
from pseo_config import BASE_URL, IMAGES, PRODUCTS


def build_schema_json(slug, title, meta_desc, h1, breadcrumb_category, playbook_type="", products=None):
    """Generate JSON-LD structured data for a pSEO page."""
    canonical = f"{BASE_URL}/{slug}.html"
    schemas = []

    # BreadcrumbList - every page gets this
    schemas.append({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Úvod", "item": f"{BASE_URL}/index.html"},
            {"@type": "ListItem", "position": 2, "name": breadcrumb_category, "item": f"{BASE_URL}/katalog.html"},
            {"@type": "ListItem", "position": 3, "name": h1},
        ]
    })

    # FAQPage - for pages with FAQ sections
    if playbook_type in ("locations", "personas", "glossary", "comparisons", "curation",
                          "templates", "conversions", "translations", "integrations",
                          "examples", "profiles", "directory"):
        schemas.append({
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": title,
            "description": meta_desc,
            "url": canonical,
            "inLanguage": "cs",
            "isPartOf": {
                "@type": "WebSite",
                "name": "Bazarovyregal.cz",
                "url": BASE_URL
            },
            "publisher": {
                "@type": "Organization",
                "name": "Bazarovyregal.cz",
                "url": BASE_URL,
                "email": "info@bazarovyregal.cz"
            }
        })

    # Product offers for conversion pages
    if playbook_type == "conversions" and products:
        offers = []
        for p in products[:6]:
            offers.append({
                "@type": "Offer",
                "name": p["name"],
                "price": p["price"],
                "priceCurrency": "CZK",
                "availability": "https://schema.org/InStock",
                "url": f"{BASE_URL}/{p['url']}"
            })
        if offers:
            schemas.append({
                "@context": "https://schema.org",
                "@type": "OfferCatalog",
                "name": h1,
                "description": meta_desc,
                "itemListElement": offers
            })

    # Build script tags
    tags = ""
    for s in schemas:
        tags += f'\n    <script type="application/ld+json">{_json.dumps(s, ensure_ascii=False)}</script>'
    return tags

def get_product_cards(products, count=4):
    html = '<div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">'
    for p in products[:count]:
        discount = 75 if p.get("bestseller") else 70
        html += f'''
        <a href="{p['url']}" class="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-shadow group">
            <div class="relative">
                <img src="{p['img']}" alt="{p['name']}" class="w-full aspect-square object-contain p-4 bg-gray-50" loading="lazy">
                <span class="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">-{discount}%</span>
            </div>
            <div class="p-4">
                <h3 class="font-medium text-sm group-hover:text-primary-500 mb-2">{p['name']}</h3>
                <div class="flex items-baseline gap-2">
                    <span class="text-xl font-bold text-primary-600">{p['price']} Kc</span>
                    <span class="text-sm text-gray-400 line-through">{p['price'] * 4} Kc</span>
                </div>
                <div class="text-xs text-green-600 mt-1">Skladem</div>
            </div>
        </a>'''
    html += '</div>'
    return html


def wrap_page(slug, title, meta_desc, h1, body_html, breadcrumb_category, schema_json="", canonical_url=""):
    og_image = IMAGES["black"]
    if not canonical_url:
        canonical_url = f"{BASE_URL}/{slug}.html"

    return f'''<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <meta name="description" content="{meta_desc}">
    <meta name="seznam-wmt" content="gsVJMRIZ0wBQpM8lNS073cpS20Kruq25" />
    <meta property="og:title" content="{title}">
    <meta property="og:description" content="{meta_desc}">
    <meta property="og:image" content="{og_image}">
    <meta property="og:url" content="{canonical_url}">
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="Bazarovyregal.cz">
    <meta property="og:locale" content="cs_CZ">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{title}">
    <meta name="twitter:description" content="{meta_desc}">
    <meta name="twitter:image" content="{og_image}">
    <link rel="canonical" href="{canonical_url}">
    <!-- Google Ads & GA4 Tracking -->
    <script src="tracking_config.js"></script>
    <script>
        (function(){{
          var c = window.BAZAROVYREGAL_TRACKING || {{}};
          var gaId = c.GA4_MEASUREMENT_ID || '';
          var adsId = c.GOOGLE_ADS_ID || '';
          if (gaId && gaId !== 'G-XXXXXXXXXX') {{
            var s = document.createElement('script');
            s.async = true;
            s.src = 'https://www.googletagmanager.com/gtag/js?id=' + gaId;
            document.head.appendChild(s);
            window.dataLayer = window.dataLayer || [];
            window.gtag = function(){{dataLayer.push(arguments);}};
            gtag('js', new Date());
            gtag('config', gaId, {{
              send_page_view: true,
              linker: {{ domains: c.LINKER_DOMAINS || ['bazarovyregal.cz', 'vyprodej-regalu.cz'] }}
            }});
            if (adsId && adsId !== 'AW-XXXXXXXXX') {{
              gtag('config', adsId);
            }}
          }}
        }})();
    </script>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <script>
        tailwind.config = {{
            theme: {{
                extend: {{
                    fontFamily: {{ sans: ['Inter', 'sans-serif'] }},
                    colors: {{
                        primary: {{ 50:'#fff7ed',100:'#ffedd5',200:'#fed7aa',300:'#fdba74',400:'#fb923c',500:'#f97316',600:'#ea580c',700:'#c2410c',800:'#9a3412',900:'#7c2d12' }}
                    }}
                }}
            }}
        }}
    </script>
    {schema_json}
</head>
<body class="bg-gray-50 font-sans">

<div class="bg-gray-900 text-white text-sm py-2">
    <div class="container mx-auto px-4 flex justify-between items-center">
        <span>info@bazarovyregal.cz</span>
        <div class="flex items-center gap-4">
            <span>Doprava od 99 Kc</span>
            <span>4.9/5 (2847 recenzi)</span>
        </div>
    </div>
</div>

<header class="bg-white shadow-sm sticky top-0 z-50">
    <div class="container mx-auto px-4 py-4 flex items-center justify-between">
        <a href="index.html" class="flex items-center gap-3">
            <div class="w-12 h-12 bg-primary-500 rounded-xl flex items-center justify-center shadow-lg">
                <span class="text-white text-3xl font-black">B</span>
            </div>
            <div>
                <div class="text-2xl font-black text-gray-900">Bazarovyregal<span class="text-primary-500">.cz</span></div>
                <div class="text-xs text-red-600 font-bold uppercase">Likvidace skladu</div>
            </div>
        </a>
        <nav class="hidden md:flex gap-4 text-sm font-medium">
            <a href="index.html" class="text-gray-600 hover:text-primary-500">Uvod</a>
            <a href="katalog.html" class="text-gray-600 hover:text-primary-500">Katalog</a>
            <a href="likvidace-skladu-regaly.html" class="text-gray-600 hover:text-primary-500">Likvidace</a>
            <a href="kontakt.html" class="text-gray-600 hover:text-primary-500">Kontakt</a>
        </nav>
        <a href="katalog.html" class="bg-primary-500 hover:bg-primary-600 text-white px-5 py-2 rounded-lg font-bold">Katalog</a>
    </div>
</header>

<nav class="bg-white border-b">
    <div class="container mx-auto px-4 py-3">
        <ol class="flex items-center gap-2 text-sm text-gray-500">
            <li><a href="index.html" class="hover:text-primary-500">Uvod</a></li>
            <span>&rsaquo;</span>
            <li><a href="katalog.html" class="hover:text-primary-500">{breadcrumb_category}</a></li>
            <span>&rsaquo;</span>
            <li class="text-gray-900 font-medium truncate max-w-xs">{h1}</li>
        </ol>
    </div>
</nav>

<main class="container mx-auto px-4 py-8">
    <article class="max-w-4xl mx-auto">
        <h1 class="text-3xl md:text-4xl font-bold text-gray-900 mb-6">{h1}</h1>
        <div class="prose prose-lg max-w-none">
            {body_html}
        </div>

        <div class="bg-gradient-to-r from-primary-500 to-orange-500 rounded-2xl p-8 mt-12 text-white text-center">
            <h2 class="text-2xl font-bold mb-2">Pripraveni nakoupit?</h2>
            <p class="mb-6 text-white/90">Prohlednete si nas kompletni katalog regalu se slevami az 75%</p>
            <a href="katalog.html" class="inline-block bg-white text-primary-600 px-8 py-3 rounded-xl font-bold hover:bg-gray-100 transition">Zobrazit katalog</a>
        </div>
    </article>
</main>

<footer class="bg-gray-900 text-white py-12 mt-12">
    <div class="container mx-auto px-4">
        <div class="grid md:grid-cols-4 gap-8 mb-8">
            <div>
                <div class="text-xl font-bold mb-4">Bazarovyregal<span class="text-primary-500">.cz</span></div>
                <p class="text-gray-400 text-sm">Nejvetsi slevy na kovove regaly. Likvidace skladu - nove zbozi za ceny bazaru.</p>
            </div>
            <div>
                <h4 class="font-bold mb-4">Kategorie</h4>
                <ul class="space-y-2 text-gray-400 text-sm">
                    <li><a href="likvidace-skladu-regaly.html" class="hover:text-primary-400">Likvidace skladu</a></li>
                    <li><a href="bazarove-regaly.html" class="hover:text-primary-400">Bazarove regaly</a></li>
                    <li><a href="slevy-na-regaly.html" class="hover:text-primary-400">Slevy na regaly</a></li>
                    <li><a href="regaly-do-garaze.html" class="hover:text-primary-400">Regaly do garaze</a></li>
                </ul>
            </div>
            <div>
                <h4 class="font-bold mb-4">Informace</h4>
                <ul class="space-y-2 text-gray-400 text-sm">
                    <li><a href="montaz-regalu.html" class="hover:text-primary-400">Montaz regalu</a></li>
                    <li><a href="nosnost-regalu.html" class="hover:text-primary-400">Nosnost regalu</a></li>
                    <li><a href="faq.html" class="hover:text-primary-400">FAQ</a></li>
                    <li><a href="kontakt.html" class="hover:text-primary-400">Kontakt</a></li>
                </ul>
            </div>
            <div>
                <h4 class="font-bold mb-4">Kontakt</h4>
                <ul class="space-y-2 text-gray-400 text-sm">
                    <li>info@bazarovyregal.cz</li>
                    <li>Doprava od 99 Kc</li>
                    <li>Zaruka 7 let</li>
                </ul>
            </div>
        </div>
        <div class="border-t border-gray-800 pt-8 text-center text-gray-500 text-sm">
            &copy; 2026 Bazarovyregal.cz - Shoptet.cz
        </div>
    </div>
</footer>

<div id="chatWidget" class="fixed bottom-6 right-4 z-40">
    <button onclick="toggleChat()" class="bg-primary-500 hover:bg-primary-600 text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-2xl transition-transform hover:scale-110">?</button>
</div>
<script src="chatbot.js"></script>
<script src="tracking.js"></script>
</body>
</html>'''
