#!/usr/bin/env python3
"""
Generates complete "top" version product detail pages for Bazarovyregal.cz
Based on the original template with:
- Sticky add to cart bar
- Image gallery with thumbnails
- Video section
- Quantity selector
- Tabs (Popis, Parametry, Rozměry, Montáž, Recenze, FAQ)
- SVG dimension visualization
- Related products
"""

import os
import json

# Product data - matching the catalog
products = [
    {"height": 150, "width": 70, "depth": 30, "color": "Černá", "price": 599, "priceOrig": 2396, "shelves": 4, "capacity": 700, "image": "https://vyprodej-regalucz.s26.cdn-upgates.com/v/v6903779a99ff1-1-regal-1500x700x300-mm-lakovany-4-policovy-nosnost-700-kg-cerny-pravy-15070304700black1.jpeg", "seoUrl": "regal-1500x700x300-mm-lakovany-4-policovy-nosnost-700-kg-cerny"},
    {"height": 150, "width": 70, "depth": 30, "color": "Červená", "price": 599, "priceOrig": 2396, "shelves": 4, "capacity": 700, "image": "https://vyprodej-regalucz.s26.cdn-upgates.com/_cache/9/e/9eef5f9f2ad8880b75926a3eae58485b-1-regal-1500x700x300-mm-lakovany-4-policovy-nosnost-700-kg-cerveny-pravy-15070304700red1.jpeg", "seoUrl": "regal-1500x700x300-mm-lakovany-4-policovy-nosnost-700-kg-cerveny"},
    {"height": 150, "width": 70, "depth": 30, "color": "Bílá", "price": 599, "priceOrig": 2396, "shelves": 4, "capacity": 700, "image": "https://vyprodej-regalucz.s26.cdn-upgates.com/6/6690a777ad6edc-1-18090405875white1.jpeg", "seoUrl": "regal-1500x700x300-mm-lakovany-4-policovy-nosnost-700-kg-bily"},
    {"height": 150, "width": 70, "depth": 30, "color": "Zinkovaný", "price": 549, "priceOrig": 2196, "shelves": 4, "capacity": 700, "image": "https://vyprodej-regalucz.s26.cdn-upgates.com/z/z6914605330838-5-pol-pravy-zink.jpg", "seoUrl": "regal-1500x700x300-mm-zinkovany-4-policovy-nosnost-700-kg"},
    {"height": 180, "width": 90, "depth": 40, "color": "Černá", "price": 739, "priceOrig": 2956, "shelves": 5, "capacity": 875, "image": "https://vyprodej-regalucz.s26.cdn-upgates.com/l/l690377af7480a-1-regal-1800x900x400-mm-lakovany-5-policovy-nosnost-875-kg-cerny-pravy-18090405875black1.jpeg", "seoUrl": "regal-1800x900x400-mm-lakovany-5-policovy-nosnost-875-kg-cerny", "bestseller": True},
    {"height": 180, "width": 90, "depth": 40, "color": "Bílá", "price": 739, "priceOrig": 2956, "shelves": 5, "capacity": 875, "image": "https://vyprodej-regalucz.s26.cdn-upgates.com/6/6690a777ad6edc-1-18090405875white1.jpeg", "seoUrl": "regal-1800x900x400-mm-lakovany-5-policovy-nosnost-875-kg-bily"},
    {"height": 180, "width": 90, "depth": 40, "color": "Zinkovaný", "price": 649, "priceOrig": 2596, "shelves": 5, "capacity": 875, "image": "https://vyprodej-regalucz.s26.cdn-upgates.com/z/z6914605330838-5-pol-pravy-zink.jpg", "seoUrl": "regal-1800x900x400-mm-zinkovany-5-policovy-nosnost-875-kg"},
    {"height": 180, "width": 90, "depth": 40, "color": "Červená", "price": 759, "priceOrig": 3036, "shelves": 5, "capacity": 875, "image": "https://vyprodej-regalucz.s26.cdn-upgates.com/_cache/9/e/9eef5f9f2ad8880b75926a3eae58485b-1-regal-1500x700x300-mm-lakovany-4-policovy-nosnost-700-kg-cerveny-pravy-15070304700red1.jpeg", "seoUrl": "regal-1800x900x400-mm-lakovany-5-policovy-nosnost-875-kg-cerveny"},
    {"height": 180, "width": 90, "depth": 40, "color": "Modrá", "price": 759, "priceOrig": 3036, "shelves": 5, "capacity": 875, "image": "https://vyprodej-regalucz.s26.cdn-upgates.com/_cache/1/c/1c64831c1231f5847cf9e7a36f6cdf6f-1-15070304700blue1.jpeg", "seoUrl": "regal-1800x900x400-mm-lakovany-5-policovy-nosnost-875-kg-modry"},
    {"height": 180, "width": 60, "depth": 40, "color": "Černá", "price": 689, "priceOrig": 2756, "shelves": 5, "capacity": 875, "image": "https://vyprodej-regalucz.s26.cdn-upgates.com/j/j690377a5dc94d-1-regal-1800x600x400-mm-lakovany-5-policovy-nosnost-875-kg-cerny-pravy-18060405875black1.jpeg", "seoUrl": "regal-1800x600x400-mm-lakovany-5-policovy-nosnost-875-kg-cerny"},
    {"height": 180, "width": 60, "depth": 40, "color": "Bílá", "price": 689, "priceOrig": 2756, "shelves": 5, "capacity": 875, "image": "https://vyprodej-regalucz.s26.cdn-upgates.com/6/6690a777ad6edc-1-18090405875white1.jpeg", "seoUrl": "regal-1800x600x400-mm-lakovany-5-policovy-nosnost-875-kg-bily"},
    {"height": 180, "width": 40, "depth": 40, "color": "Černá", "price": 629, "priceOrig": 2516, "shelves": 5, "capacity": 875, "image": "https://vyprodej-regalucz.s26.cdn-upgates.com/2/2690377a330269-1-regal-1800x400x400-mm-lakovany-5-policovy-nosnost-875-kg-cerny-pravy-18040405875black1.jpeg", "seoUrl": "regal-1800x400x400-mm-lakovany-5-policovy-nosnost-875-kg-cerny"},
    {"height": 180, "width": 40, "depth": 40, "color": "Zinkovaný", "price": 579, "priceOrig": 2316, "shelves": 5, "capacity": 875, "image": "https://vyprodej-regalucz.s26.cdn-upgates.com/z/z6914605330838-5-pol-pravy-zink.jpg", "seoUrl": "regal-1800x400x400-mm-zinkovany-5-policovy-nosnost-875-kg"},
    {"height": 180, "width": 40, "depth": 30, "color": "Zinkovaný", "price": 549, "priceOrig": 2196, "shelves": 5, "capacity": 875, "image": "https://vyprodej-regalucz.s26.cdn-upgates.com/z/z6914605330838-5-pol-pravy-zink.jpg", "seoUrl": "regal-1800x400x300-mm-zinkovany-5-policovy-nosnost-875-kg"},
    {"height": 200, "width": 90, "depth": 40, "color": "Černá", "price": 849, "priceOrig": 3396, "shelves": 5, "capacity": 875, "image": "https://vyprodej-regalucz.s26.cdn-upgates.com/l/l690377af7480a-1-regal-1800x900x400-mm-lakovany-5-policovy-nosnost-875-kg-cerny-pravy-18090405875black1.jpeg", "seoUrl": "regal-2000x900x400-mm-lakovany-5-policovy-nosnost-875-kg-cerny"},
    {"height": 220, "width": 90, "depth": 45, "color": "Černá", "price": 899, "priceOrig": 3596, "shelves": 5, "capacity": 875, "image": "https://vyprodej-regalucz.s26.cdn-upgates.com/l/l690377af7480a-1-regal-1800x900x400-mm-lakovany-5-policovy-nosnost-875-kg-cerny-pravy-18090405875black1.jpeg", "seoUrl": "regal-2200x900x450-mm-lakovany-5-policovy-nosnost-875-kg-cerny"},
    {"height": 180, "width": 120, "depth": 50, "color": "Černá", "price": 1149, "priceOrig": 4596, "shelves": 5, "capacity": 875, "image": "https://vyprodej-regalucz.s26.cdn-upgates.com/l/l690377af7480a-1-regal-1800x900x400-mm-lakovany-5-policovy-nosnost-875-kg-cerny-pravy-18090405875black1.jpeg", "seoUrl": "regal-1800x1200x500-mm-lakovany-5-policovy-nosnost-875-kg-cerny"},
    {"height": 180, "width": 120, "depth": 50, "color": "Profesionální", "price": 1249, "priceOrig": 4996, "shelves": 5, "capacity": 1050, "image": "https://vyprodej-regalucz.s26.cdn-upgates.com/_cache/b/1/b17ce5b491bdb73a0df3160b51fbcf7e-1-regal-1800x1200x500-mm-lakovany-5-policovy-nosnost-1050-kg-modro-oranzovy-pravy-18120501050orangeblue1.jpeg", "seoUrl": "regal-1800x1200x500-mm-lakovany-5-policovy-nosnost-1050-kg-modro-oranzovy"},
]

# Additional generated products
colors = ["Černá", "Bílá", "Červená", "Modrá", "Zinkovaný"]
heights = [150, 180, 200, 220]
widths = [40, 60, 70, 90, 120]
depths = [30, 40, 45, 50]

color_images = {
    "Černá": "https://vyprodej-regalucz.s26.cdn-upgates.com/l/l690377af7480a-1-regal-1800x900x400-mm-lakovany-5-policovy-nosnost-875-kg-cerny-pravy-18090405875black1.jpeg",
    "Bílá": "https://vyprodej-regalucz.s26.cdn-upgates.com/6/6690a777ad6edc-1-18090405875white1.jpeg",
    "Červená": "https://vyprodej-regalucz.s26.cdn-upgates.com/_cache/9/e/9eef5f9f2ad8880b75926a3eae58485b-1-regal-1500x700x300-mm-lakovany-4-policovy-nosnost-700-kg-cerveny-pravy-15070304700red1.jpeg",
    "Modrá": "https://vyprodej-regalucz.s26.cdn-upgates.com/_cache/1/c/1c64831c1231f5847cf9e7a36f6cdf6f-1-15070304700blue1.jpeg",
    "Zinkovaný": "https://vyprodej-regalucz.s26.cdn-upgates.com/z/z6914605330838-5-pol-pravy-zink.jpg",
    "Profesionální": "https://vyprodej-regalucz.s26.cdn-upgates.com/_cache/b/1/b17ce5b491bdb73a0df3160b51fbcf7e-1-regal-1800x1200x500-mm-lakovany-5-policovy-nosnost-1050-kg-modro-oranzovy-pravy-18120501050orangeblue1.jpeg"
}

color_czech_map = {
    'Černá': 'černá',
    'Bílá': 'bílá',
    'Červená': 'červená',
    'Modrá': 'modrá',
    'Zinkovaný': 'zinkovaný',
    'Profesionální': 'profesionální'
}

color_slug_map = {
    'Černá': 'cerna',
    'Bílá': 'bila',
    'Červená': 'cervena',
    'Modrá': 'modra',
    'Zinkovaný': 'zinkovany',
    'Profesionální': 'profesionalni'
}

# Generate more products to match existing files
import random
random.seed(42)

existing_files = [
    "regal-150x70x30-cerna", "regal-150x70x30-cervena", "regal-150x70x30-zinkovany", "regal-180x90x40-bila", "regal-180x90x40-zinkovany",
    "regal-180x60x40-cerna", "regal-180x40x40-cerna", "regal-200x90x40-cerna", "regal-220x90x45-cerna",
    "regal-180x120x50-cerna", "regal-180x90x40-modra", "regal-180x40x30-zinkovany", "regal-180x90x45-cerna",
    "regal-220x70x45-bila", "regal-200x40x30-modra", "regal-200x70x45-cerna", "regal-200x120x40-cerna",
    "regal-220x70x50-cervena", "regal-150x120x40-zinkovany", "regal-180x90x50-cervena", "regal-180x70x30-bila",
    "regal-200x60x50-modra", "regal-220x60x45-bila", "regal-200x120x50-zinkovany", "regal-200x60x40-zinkovany",
    "regal-150x40x30-bila", "regal-150x120x45-cervena", "regal-200x90x40-modra", "regal-200x120x40-zinkovany",
    "regal-220x40x30-cervena", "regal-180x40x40-zinkovany", "regal-150x90x30-zinkovany", "regal-180x90x40-cervena",
    "regal-200x90x50-cerna", "regal-180x40x45-cerna", "regal-180x120x40-cerna", "regal-150x60x30-cerna",
    "regal-150x120x40-cervena", "regal-220x60x40-zinkovany", "regal-220x60x50-modra", "regal-150x40x50-cervena",
    "regal-220x90x30-cerna", "regal-220x70x30-bila", "regal-180x120x50-bila", "regal-180x70x50-bila",
    "regal-150x40x40-bila", "regal-220x90x40-modra", "regal-180x90x30-modra", "regal-220x70x50-zinkovany",
    "regal-220x60x40-cervena", "regal-150x120x30-cervena", "regal-150x120x50-zinkovany", "regal-180x40x30-bila",
    "regal-150x60x50-cerna", "regal-180x120x30-zinkovany", "regal-220x120x45-cervena", "regal-200x60x45-modra",
    "regal-200x90x45-cerna", "regal-180x120x45-bila", "regal-150x60x45-cervena", "regal-220x120x45-zinkovany",
    "regal-150x120x45-cerna", "regal-200x70x40-cervena", "regal-200x120x50-cervena", "regal-150x90x45-cerna",
    "regal-200x60x45-bila", "regal-220x120x30-cerna", "regal-180x120x30-cervena", "regal-180x90x40-cerna",
    "regal-200x40x45-bila", "regal-180x40x45-zinkovany", "regal-180x60x40-bila", "regal-150x60x45-modra",
    "regal-180x70x40-cerna", "regal-150x90x40-bila", "regal-200x70x40-bila", "regal-180x90x45-cervena",
    "regal-150x40x45-bila", "regal-200x40x30-zinkovany", "regal-200x70x50-zinkovany", "regal-150x90x40-cervena",
    "regal-220x40x40-cervena", "regal-150x70x45-cerna", "regal-200x90x45-modra", "regal-200x120x40-bila",
    "regal-150x70x30-bila", "regal-180x120x50-profesionalni"
]

# Parse existing files and generate product data
all_products = []
for filename in existing_files:
    parts = filename.replace("regal-", "").split("-")
    dims = parts[0].split("x")
    height = int(dims[0])
    width = int(dims[1])
    depth = int(dims[2])
    color_slug = parts[1]

    color_reverse_map = {v: k for k, v in color_slug_map.items()}
    color = color_reverse_map.get(color_slug, "Černá")

    surface = "Pozinkovaný" if color == "Zinkovaný" else "Lakovaný"
    shelves = 5 if height >= 180 else 4
    capacity_per_shelf = 175 if color != "Profesionální" else 210
    capacity = shelves * capacity_per_shelf

    base_price = 400 + (height // 10) * 15 + (width // 10) * 10 + (depth // 10) * 5
    if color == "Zinkovaný":
        base_price -= 50
    elif color == "Profesionální":
        base_price += 200
    price = (base_price // 10) * 10 - 1
    priceOrig = price * 4

    image = color_images.get(color, color_images["Černá"])

    all_products.append({
        "height": height,
        "width": width,
        "depth": depth,
        "color": color,
        "price": price,
        "priceOrig": priceOrig,
        "shelves": shelves,
        "capacity": capacity,
        "image": image,
        "surface": surface,
        "filename": filename
    })

def get_filename(p):
    if "filename" in p:
        return p["filename"]
    color_slug = color_slug_map.get(p["color"], p["color"].lower())
    return f"regal-{p['height']}x{p['width']}x{p['depth']}-{color_slug}"

def get_seo_url(p):
    """Generate SEO URL for vyprodej-regalu.cz"""
    surface_text = "zinkovany" if p.get("surface") == "Pozinkovaný" or p["color"] == "Zinkovaný" else "lakovany"
    color_seo = {
        "Černá": "cerny",
        "Bílá": "bily",
        "Červená": "cerveny",
        "Modrá": "modry",
        "Zinkovaný": "",
        "Profesionální": "modro-oranzovy"
    }.get(p["color"], "")

    if p["color"] == "Zinkovaný":
        return f"regal-{p['height']*10}x{p['width']*10}x{p['depth']*10}-mm-{surface_text}-{p['shelves']}-policovy-nosnost-{p['capacity']}-kg"
    else:
        return f"regal-{p['height']*10}x{p['width']*10}x{p['depth']*10}-mm-{surface_text}-{p['shelves']}-policovy-nosnost-{p['capacity']}-kg-{color_seo}"

def generate_html(p):
    filename = get_filename(p)
    height = p["height"]
    width = p["width"]
    depth = p["depth"]
    color = p["color"]
    color_czech = color_czech_map.get(color, color.lower())
    price = p["price"]
    priceOrig = p["priceOrig"]
    shelves = p["shelves"]
    capacity = p["capacity"]
    capacity_per_shelf = capacity // shelves
    image = p["image"]
    surface = p.get("surface", "Pozinkovaný" if color == "Zinkovaný" else "Lakovaný")
    discount = round((1 - price / priceOrig) * 100)
    savings = priceOrig - price
    price_no_vat = round(price / 1.21)

    seo_url = get_seo_url(p)

    # Product name
    if color == "Profesionální":
        name = f"Regál {height}×{width}×{depth} cm profesionální"
        full_name = f"Regál {height*10}x{width*10}x{depth*10} mm lakovaný {shelves}-policový, nosnost {capacity} kg - profesionální"
    elif color == "Zinkovaný":
        name = f"Regál {height}×{width}×{depth} cm zinkovaný"
        full_name = f"Regál {height*10}x{width*10}x{depth*10} mm pozinkovaný {shelves}-policový, nosnost {capacity} kg"
    else:
        name = f"Regál {height}×{width}×{depth} cm {color_czech}"
        full_name = f"Regál {height*10}x{width*10}x{depth*10} mm lakovaný {shelves}-policový, nosnost {capacity} kg - {color_czech}"

    # Related products
    related = []
    for rp in all_products:
        if rp != p and len(related) < 4:
            if (rp["height"] == height and rp["width"] == width) or (rp["color"] == color):
                related.append(rp)

    # Fill up with random products if needed
    for rp in all_products:
        if rp != p and rp not in related and len(related) < 4:
            related.append(rp)

    html = f'''<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{full_name} | Bazarovyregal.cz</title>
  <meta name="description" content="Profesionální kovový regál {height}×{width}×{depth} cm s nosností {capacity} kg. {shelves} nastavitelných polic, bezšroubová montáž za 10 minut. Záruka 7 let. Skladem.">

  <!-- OpenGraph Meta Tags -->
  <meta property="og:title" content="{full_name} | Bazarovyregal.cz">
  <meta property="og:description" content="🔥 SLEVA {discount}%! Kovový regál {height}×{width}×{depth} cm s nosností {capacity} kg. Pouze {price} Kč místo {priceOrig} Kč. Záruka 7 let, montáž za 10 min.">
  <meta property="og:image" content="{image}">
  <meta property="og:url" content="https://bazarovyregal.cz/{filename}.html">
  <meta property="og:type" content="product">
  <meta property="og:site_name" content="Bazarovyregal.cz">
  <meta property="og:locale" content="cs_CZ">
  <meta property="product:price:amount" content="{price}">
  <meta property="product:price:currency" content="CZK">
  <meta property="product:availability" content="in stock">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{full_name}">
  <meta name="twitter:description" content="🔥 SLEVA {discount}%! Pouze {price} Kč. Záruka 7 let, montáž za 10 min.">
  <meta name="twitter:image" content="{image}">

  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <script>
    tailwind.config = {{
      theme: {{
        extend: {{
          fontFamily: {{ sans: ['Inter', 'sans-serif'] }},
          colors: {{
            primary: {{ 50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74', 400: '#fb923c', 500: '#f97316', 600: '#ea580c', 700: '#c2410c', 800: '#9a3412', 900: '#7c2d12' }}
          }}
        }}
      }}
    }}
  </script>
  <style>
    .product-image {{ aspect-ratio: 1; object-fit: contain; background: #f8fafc; }}
    .thumbnail {{ aspect-ratio: 1; object-fit: contain; }}
    .spec-row:nth-child(odd) {{ background: #f8fafc; }}
    .tab-active {{ border-bottom: 3px solid #f97316; color: #f97316; }}
    .sticky-bar {{ transform: translateY(-100%); transition: transform 0.3s; }}
    .sticky-bar.visible {{ transform: translateY(0); }}
    .pulse-badge {{ animation: pulse 2s infinite; }}
    @keyframes pulse {{ 0%, 100% {{ opacity: 1; }} 50% {{ opacity: 0.7; }} }}
    .faq-answer {{ max-height: 0; overflow: hidden; transition: max-height 0.3s ease; }}
    .faq-item.open .faq-answer {{ max-height: 500px; }}
    .faq-item.open .faq-icon {{ transform: rotate(180deg); }}
    .video-wrapper {{ position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 12px; }}
    .video-wrapper iframe {{ position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0; }}
    .product-card {{ transition: all 0.3s; }}
    .product-card:hover {{ transform: translateY(-4px); box-shadow: 0 12px 30px rgba(0,0,0,0.12); }}
  </style>
</head>
<body class="bg-gray-50 font-sans">

<!-- Sticky Add to Cart Bar -->
<div id="stickyBar" class="sticky-bar fixed top-0 left-0 right-0 bg-white shadow-lg z-50 py-3 border-b">
  <div class="container mx-auto px-4 flex items-center justify-between gap-4">
    <div class="flex items-center gap-4">
      <img src="{image}" alt="" class="w-12 h-12 object-contain bg-gray-100 rounded">
      <div class="hidden sm:block">
        <div class="font-medium text-sm line-clamp-1">{name}</div>
        <div class="text-xs text-gray-500">{height}×{width}×{depth} cm • {capacity} kg</div>
      </div>
    </div>
    <div class="flex items-center gap-4">
      <div class="text-right">
        <div class="text-xl font-bold text-primary-600">{price} Kč</div>
        <div class="text-xs text-green-600">✓ Skladem</div>
      </div>
      <button onclick="addToCart()" class="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-lg font-bold transition-colors whitespace-nowrap">
        🛒 Koupit
      </button>
    </div>
  </div>
</div>

<!-- Top Bar -->
<div class="bg-gray-900 text-white text-sm py-2">
  <div class="container mx-auto px-4 flex justify-between items-center">
    <div class="flex items-center gap-6">
      <span>✉️ info@bazarovyregal.cz</span>
    </div>
    <div class="flex items-center gap-4">
      <span>🚚 Doprava od 99 Kč</span>
      <span>⭐ 4.9/5 (2847 recenzí)</span>
    </div>
  </div>
</div>

<!-- Header -->
<header class="bg-white shadow-sm">
  <div class="container mx-auto px-4 py-4 flex items-center justify-between">
    <a href="index.html" class="flex items-center gap-2">
      <div class="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
        <span class="text-white text-xl font-bold">🏭</span>
      </div>
      <div>
        <div class="text-xl font-bold text-gray-900">Bazarovyregal<span class="text-primary-500">.cz</span></div>
        <div class="text-xs text-red-600 font-medium">Největší slevy na regály</div>
      </div>
    </a>
    <nav class="hidden md:flex gap-4 text-sm font-medium text-gray-600">
      <a href="index.html" class="hover:text-primary-500">🏠 Úvod</a>
      <a href="katalog.html" class="hover:text-primary-500">📦 Všechny regály</a>
      <a href="o-nas.html" class="hover:text-primary-500">ℹ️ O nás</a>
      <a href="faq.html" class="hover:text-primary-500">❓ FAQ</a>
      <a href="kontakt.html" class="hover:text-primary-500">📧 Kontakt</a>
    </nav>
    <button class="flex items-center gap-2 bg-primary-500 text-white px-4 py-2 rounded-lg">
      🛒 Košík <span class="bg-white text-primary-600 text-xs font-bold px-2 py-0.5 rounded-full">0</span>
    </button>
  </div>
</header>

<!-- Breadcrumb -->
<nav class="bg-white border-b">
  <div class="container mx-auto px-4 py-3 text-sm">
    <ol class="flex items-center gap-2 text-gray-500">
      <li><a href="index.html" class="hover:text-primary-500">Úvod</a></li>
      <span>›</span>
      <li><a href="katalog.html" class="hover:text-primary-500">Kovové regály</a></li>
      <span>›</span>
      <li class="text-gray-900 font-medium truncate max-w-xs">{name}</li>
    </ol>
  </div>
</nav>

<main class="container mx-auto px-4 py-8">

  <!-- Product Info -->
  <div class="grid lg:grid-cols-2 gap-8 lg:gap-12 mb-12">

    <!-- Left Column - Images -->
    <div>
      <div class="flex flex-wrap gap-2 mb-4">
        <span class="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full pulse-badge">🔥 VÝPRODEJ -{discount}%</span>
        <span class="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">✓ Skladem</span>
      </div>

      <!-- Main Image -->
      <div class="relative bg-white rounded-2xl p-6 shadow-sm mb-4">
        <img id="mainImage" src="{image}" alt="{full_name}" class="product-image w-full">
      </div>

      <!-- Video -->
      <div class="bg-white rounded-2xl shadow-sm overflow-hidden p-4">
        <h3 class="font-bold mb-3">🎬 Video - montáž regálu</h3>
        <div class="video-wrapper">
          <iframe width="560" height="315" src="https://www.youtube.com/embed/BBjY5IomYkk" title="Video - montáž regálu" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
        </div>
      </div>
    </div>

    <!-- Right Column - Product Details -->
    <div>
      <h1 class="text-2xl lg:text-3xl font-bold text-gray-900 mb-3">
        {full_name}
      </h1>

      <div class="flex items-center gap-4 mb-4">
        <div class="flex items-center gap-1">
          <span class="text-yellow-400 text-lg">★★★★★</span>
          <span class="font-medium">4.8</span>
          <a href="#reviews" class="text-primary-500 hover:underline text-sm">(127 recenzí)</a>
        </div>
      </div>

      <p class="text-gray-600 mb-6">
        Robustní kovový regál do domácnosti i dílny. {shelves} nastavitelných polic s nosností {capacity_per_shelf} kg každá.
        Bezšroubová montáž za 10 minut bez nářadí. Ideální pro garáž, spíž, sklep nebo kancelář.
      </p>

      <!-- Price Section -->
      <div class="bg-gradient-to-r from-primary-50 to-orange-50 rounded-xl p-6 mb-6">
        <div class="flex items-baseline gap-3 mb-2">
          <span class="text-4xl font-extrabold text-primary-600">{price} Kč</span>
          <span class="text-xl text-gray-400 line-through">{priceOrig} Kč</span>
          <span class="bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full">-{discount}%</span>
        </div>
        <div class="text-sm text-gray-500 mb-3">
          Cena bez DPH: {price_no_vat} Kč | <span class="text-green-600 font-medium">Ušetříte {savings} Kč</span>
        </div>

        <div class="flex items-center gap-4 text-sm">
          <div class="flex items-center gap-2 text-green-600">
            <span class="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
            <span class="font-medium">Skladem</span>
          </div>
          <span class="text-gray-400">|</span>
          <span class="text-orange-600">🔥 Za posledních 24h koupilo 23 lidí</span>
        </div>
      </div>

      <!-- Key Specs Quick View -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div class="bg-white rounded-xl p-4 text-center shadow-sm">
          <div class="text-2xl mb-1">📏</div>
          <div class="text-xs text-gray-500">Rozměry</div>
          <div class="font-bold">{height}×{width}×{depth} cm</div>
        </div>
        <div class="bg-white rounded-xl p-4 text-center shadow-sm">
          <div class="text-2xl mb-1">⚖️</div>
          <div class="text-xs text-gray-500">Celk. nosnost</div>
          <div class="font-bold">{capacity} kg</div>
        </div>
        <div class="bg-white rounded-xl p-4 text-center shadow-sm">
          <div class="text-2xl mb-1">📚</div>
          <div class="text-xs text-gray-500">Počet polic</div>
          <div class="font-bold">{shelves} ks</div>
        </div>
        <div class="bg-white rounded-xl p-4 text-center shadow-sm">
          <div class="text-2xl mb-1">🎨</div>
          <div class="text-xs text-gray-500">Povrch</div>
          <div class="font-bold">{surface}</div>
        </div>
      </div>

      <!-- Quantity & Add to Cart -->
      <div class="flex gap-4 mb-6">
        <div class="flex items-center border-2 border-gray-200 rounded-xl overflow-hidden">
          <button onclick="changeQty(-1)" class="px-4 py-3 hover:bg-gray-100 text-xl font-bold">−</button>
          <input type="number" id="qty" value="1" min="1" class="w-16 text-center border-x-2 py-3 text-lg font-medium">
          <button onclick="changeQty(1)" class="px-4 py-3 hover:bg-gray-100 text-xl font-bold">+</button>
        </div>
        <button onclick="addToCart()" class="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-4 rounded-xl font-bold text-lg transition-all hover:scale-[1.02] shadow-lg shadow-primary-200 flex items-center justify-center gap-3">
          <span class="text-2xl">🛒</span>
          <span>Do košíku</span>
        </button>
      </div>

      <!-- Trust Badges -->
      <div class="grid grid-cols-2 gap-3">
        <div class="flex items-center gap-3 bg-green-50 rounded-xl p-3">
          <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-xl">🚚</div>
          <div>
            <div class="font-medium text-sm">Doprava od 99 Kč</div>
            <div class="text-xs text-gray-500">Expedujeme ihned</div>
          </div>
        </div>
        <div class="flex items-center gap-3 bg-blue-50 rounded-xl p-3">
          <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-xl">🛡️</div>
          <div>
            <div class="font-medium text-sm">Záruka 7 let</div>
            <div class="text-xs text-gray-500">Na celý regál</div>
          </div>
        </div>
        <div class="flex items-center gap-3 bg-purple-50 rounded-xl p-3">
          <div class="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-xl">↩️</div>
          <div>
            <div class="font-medium text-sm">14 dní na vrácení</div>
            <div class="text-xs text-gray-500">Bez udání důvodu</div>
          </div>
        </div>
        <div class="flex items-center gap-3 bg-orange-50 rounded-xl p-3">
          <div class="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-xl">🔧</div>
          <div>
            <div class="font-medium text-sm">Snadná montáž</div>
            <div class="text-xs text-gray-500">Za 10 minut bez nářadí</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Tabs Section -->
  <div class="bg-white rounded-2xl shadow-sm overflow-hidden mb-12">
    <div class="border-b flex overflow-x-auto">
      <button onclick="showTab('description')" class="tab-btn px-6 py-4 font-medium text-gray-600 hover:text-primary-500 whitespace-nowrap tab-active" data-tab="description">📝 Popis</button>
      <button onclick="showTab('specs')" class="tab-btn px-6 py-4 font-medium text-gray-600 hover:text-primary-500 whitespace-nowrap" data-tab="specs">📋 Parametry</button>
      <button onclick="showTab('dimensions')" class="tab-btn px-6 py-4 font-medium text-gray-600 hover:text-primary-500 whitespace-nowrap" data-tab="dimensions">📐 Rozměry</button>
      <button onclick="showTab('assembly')" class="tab-btn px-6 py-4 font-medium text-gray-600 hover:text-primary-500 whitespace-nowrap" data-tab="assembly">🔧 Montáž</button>
      <button onclick="showTab('reviews')" class="tab-btn px-6 py-4 font-medium text-gray-600 hover:text-primary-500 whitespace-nowrap" data-tab="reviews">⭐ Recenze (127)</button>
      <button onclick="showTab('faq')" class="tab-btn px-6 py-4 font-medium text-gray-600 hover:text-primary-500 whitespace-nowrap" data-tab="faq">❓ Dotazy</button>
    </div>

    <div class="p-6 lg:p-8">

      <!-- Description Tab -->
      <div id="tab-description" class="tab-content">
        <h2 class="text-2xl font-bold mb-4">Profesionální kovový regál pro náročné použití</h2>
        <p class="text-lg text-gray-600 mb-6">
          Hledáte spolehlivé úložné řešení, které zvládne i těžší předměty a zároveň bude vypadat elegantně?
          Náš regál {height}×{width}×{depth} cm je přesně to, co potřebujete. Díky celkové nosnosti
          <strong>{capacity} kg</strong> a <strong>{shelves} nastavitelným policím</strong> pojme vše od knih přes nářadí až po těžké krabice.
        </p>

        <div class="grid md:grid-cols-2 gap-6 mb-8">
          <div class="flex gap-4 bg-gray-50 rounded-xl p-5">
            <div class="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">💪</div>
            <div>
              <h3 class="font-bold mb-1">Vysoká nosnost {capacity_per_shelf} kg/polici</h3>
              <p class="text-sm text-gray-600">Každá z {shelves} polic unese až {capacity_per_shelf} kg. Celkem tedy {capacity} kg na celý regál.</p>
            </div>
          </div>
          <div class="flex gap-4 bg-gray-50 rounded-xl p-5">
            <div class="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">⚡</div>
            <div>
              <h3 class="font-bold mb-1">Bezšroubová montáž za 10 minut</h3>
              <p class="text-sm text-gray-600">Systém zapadacích spojek nevyžaduje šrouby ani nářadí.</p>
            </div>
          </div>
          <div class="flex gap-4 bg-gray-50 rounded-xl p-5">
            <div class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">🎨</div>
            <div>
              <h3 class="font-bold mb-1">Odolný {surface.lower()} povrch</h3>
              <p class="text-sm text-gray-600">Kvalitní povrchová úprava chrání před korozí a zaručuje dlouhou životnost.</p>
            </div>
          </div>
          <div class="flex gap-4 bg-gray-50 rounded-xl p-5">
            <div class="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">📏</div>
            <div>
              <h3 class="font-bold mb-1">Nastavitelná výška polic</h3>
              <p class="text-sm text-gray-600">Police můžete nastavit po 5 cm podle potřeby.</p>
            </div>
          </div>
        </div>

        <h3 class="text-xl font-bold mb-3">Pro koho je tento regál vhodný?</h3>
        <ul class="space-y-2 text-gray-600 mb-6">
          <li class="flex items-start gap-2"><span class="text-primary-500">✓</span> <strong>Garáž a dílnu</strong> – uložte nářadí, barvy, chemii i náhradní díly</li>
          <li class="flex items-start gap-2"><span class="text-primary-500">✓</span> <strong>Spíž a sklep</strong> – konzervace, zavařeniny, víno a potraviny na jednom místě</li>
          <li class="flex items-start gap-2"><span class="text-primary-500">✓</span> <strong>Kancelář a archiv</strong> – šanony, dokumenty a kancelářské potřeby</li>
          <li class="flex items-start gap-2"><span class="text-primary-500">✓</span> <strong>Šatnu a komoru</strong> – boxy s oblečením, boty, sezónní věci</li>
          <li class="flex items-start gap-2"><span class="text-primary-500">✓</span> <strong>Sklad e-shopu</strong> – rychlý přístup ke zboží a přehledná organizace</li>
        </ul>

        <div class="bg-gray-50 rounded-xl p-6">
          <h3 class="font-bold text-lg mb-4 flex items-center gap-2">📦 Co je v balení</h3>
          <div class="grid sm:grid-cols-2 gap-4">
            <div class="flex items-center gap-3"><span class="w-8 h-8 bg-white rounded-full flex items-center justify-center text-sm font-bold">4×</span><span>Sloupky (stojny) {height} cm</span></div>
            <div class="flex items-center gap-3"><span class="w-8 h-8 bg-white rounded-full flex items-center justify-center text-sm font-bold">{shelves}×</span><span>Police {width}×{depth} cm</span></div>
            <div class="flex items-center gap-3"><span class="w-8 h-8 bg-white rounded-full flex items-center justify-center text-sm font-bold">{shelves*4}×</span><span>Spojovací příčky</span></div>
            <div class="flex items-center gap-3"><span class="w-8 h-8 bg-white rounded-full flex items-center justify-center text-sm font-bold">1×</span><span>Návod k montáži</span></div>
          </div>
        </div>
      </div>

      <!-- Specifications Tab -->
      <div id="tab-specs" class="tab-content hidden">
        <h2 class="text-2xl font-bold mb-6">Technické parametry</h2>

        <!-- Dimension Visualization -->
        <div class="bg-gradient-to-br from-orange-50 to-primary-50 rounded-2xl p-6 mb-8">
          <h3 class="font-bold text-lg mb-4">📐 Vizualizace rozměrů</h3>
          <div class="flex flex-col lg:flex-row gap-8 items-center">
            <div class="flex-shrink-0">
              <svg viewBox="0 0 300 400" class="w-64 h-80">
                <rect x="50" y="20" width="120" height="340" fill="none" stroke="#374151" stroke-width="3"></rect>
                <line x1="50" y1="88" x2="170" y2="88" stroke="#374151" stroke-width="2"></line>
                <line x1="50" y1="156" x2="170" y2="156" stroke="#374151" stroke-width="2"></line>
                <line x1="50" y1="224" x2="170" y2="224" stroke="#374151" stroke-width="2"></line>
                <line x1="50" y1="292" x2="170" y2="292" stroke="#374151" stroke-width="2"></line>
                <line x1="25" y1="20" x2="25" y2="360" stroke="#ef4444" stroke-width="3"></line>
                <line x1="18" y1="20" x2="32" y2="20" stroke="#ef4444" stroke-width="2"></line>
                <line x1="18" y1="360" x2="32" y2="360" stroke="#ef4444" stroke-width="2"></line>
                <text x="12" y="195" fill="#ef4444" font-size="14" font-weight="bold" transform="rotate(-90 12 195)">{height} cm</text>
                <line x1="50" y1="380" x2="170" y2="380" stroke="#3b82f6" stroke-width="3"></line>
                <line x1="50" y1="373" x2="50" y2="387" stroke="#3b82f6" stroke-width="2"></line>
                <line x1="170" y1="373" x2="170" y2="387" stroke="#3b82f6" stroke-width="2"></line>
                <text x="85" y="398" fill="#3b82f6" font-size="14" font-weight="bold">{width} cm</text>
                <line x1="180" y1="350" x2="230" y2="320" stroke="#22c55e" stroke-width="3"></line>
                <polygon points="230,320 220,325 222,315" fill="#22c55e"></polygon>
                <text x="200" y="310" fill="#22c55e" font-size="14" font-weight="bold">{depth} cm</text>
              </svg>
            </div>
            <div class="flex-1 space-y-4">
              <div class="flex items-center gap-4 bg-white rounded-xl p-4 shadow-sm">
                <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <span class="text-red-500 font-bold text-lg">V</span>
                </div>
                <div class="flex-1">
                  <div class="text-sm text-gray-500">Výška (od podlahy po vrch)</div>
                  <div class="text-2xl font-bold text-red-500">{height} cm</div>
                </div>
                <div class="text-gray-400 text-sm">= {height*10} mm</div>
              </div>
              <div class="flex items-center gap-4 bg-white rounded-xl p-4 shadow-sm">
                <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <span class="text-blue-500 font-bold text-lg">Š</span>
                </div>
                <div class="flex-1">
                  <div class="text-sm text-gray-500">Šířka (mezi stojnami)</div>
                  <div class="text-2xl font-bold text-blue-500">{width} cm</div>
                </div>
                <div class="text-gray-400 text-sm">= {width*10} mm</div>
              </div>
              <div class="flex items-center gap-4 bg-white rounded-xl p-4 shadow-sm">
                <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <span class="text-green-500 font-bold text-lg">H</span>
                </div>
                <div class="flex-1">
                  <div class="text-sm text-gray-500">Hloubka (od zdi)</div>
                  <div class="text-2xl font-bold text-green-500">{depth} cm</div>
                </div>
                <div class="text-gray-400 text-sm">= {depth*10} mm</div>
              </div>
            </div>
          </div>
        </div>

        <div class="grid lg:grid-cols-2 gap-8">
          <div>
            <h3 class="font-bold text-lg mb-4">📐 Rozměry a konstrukce</h3>
            <table class="w-full">
              <tbody>
                <tr class="spec-row"><td class="py-3 px-4 text-gray-600">Výška</td><td class="py-3 px-4 font-medium text-right">{height*10} mm ({height} cm)</td></tr>
                <tr class="spec-row"><td class="py-3 px-4 text-gray-600">Šířka</td><td class="py-3 px-4 font-medium text-right">{width*10} mm ({width} cm)</td></tr>
                <tr class="spec-row"><td class="py-3 px-4 text-gray-600">Hloubka</td><td class="py-3 px-4 font-medium text-right">{depth*10} mm ({depth} cm)</td></tr>
                <tr class="spec-row"><td class="py-3 px-4 text-gray-600">Rozteč polic</td><td class="py-3 px-4 font-medium text-right">Nastavitelná po 50 mm</td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <h3 class="font-bold text-lg mb-4">⚖️ Nosnost</h3>
            <table class="w-full">
              <tbody>
                <tr class="spec-row"><td class="py-3 px-4 text-gray-600">Nosnost jedné police</td><td class="py-3 px-4 font-medium text-right">{capacity_per_shelf} kg</td></tr>
                <tr class="spec-row"><td class="py-3 px-4 text-gray-600">Celková nosnost regálu</td><td class="py-3 px-4 font-medium text-right">{capacity} kg</td></tr>
                <tr class="spec-row"><td class="py-3 px-4 text-gray-600">Počet polic</td><td class="py-3 px-4 font-medium text-right">{shelves} ks</td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <h3 class="font-bold text-lg mb-4">🔩 Materiál a povrch</h3>
            <table class="w-full">
              <tbody>
                <tr class="spec-row"><td class="py-3 px-4 text-gray-600">Materiál konstrukce</td><td class="py-3 px-4 font-medium text-right">Ocelový plech</td></tr>
                <tr class="spec-row"><td class="py-3 px-4 text-gray-600">Povrchová úprava</td><td class="py-3 px-4 font-medium text-right">{surface}</td></tr>
                <tr class="spec-row"><td class="py-3 px-4 text-gray-600">Barva</td><td class="py-3 px-4 font-medium text-right">{color}</td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <h3 class="font-bold text-lg mb-4">📦 Ostatní údaje</h3>
            <table class="w-full">
              <tbody>
                <tr class="spec-row"><td class="py-3 px-4 text-gray-600">Typ montáže</td><td class="py-3 px-4 font-medium text-right">Bezšroubová</td></tr>
                <tr class="spec-row"><td class="py-3 px-4 text-gray-600">Záruka</td><td class="py-3 px-4 font-medium text-right">7 let</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Dimensions Tab -->
      <div id="tab-dimensions" class="tab-content hidden">
        <h2 class="text-2xl font-bold mb-6">Rozměrový nákres</h2>
        <div class="grid lg:grid-cols-2 gap-8">
          <div class="bg-gray-50 rounded-xl p-8">
            <svg viewBox="0 0 400 450" class="w-full max-w-md mx-auto">
              <rect x="100" y="50" width="180" height="360" fill="none" stroke="#374151" stroke-width="2"></rect>
              <line x1="100" y1="122" x2="280" y2="122" stroke="#374151" stroke-width="2"></line>
              <line x1="100" y1="194" x2="280" y2="194" stroke="#374151" stroke-width="2"></line>
              <line x1="100" y1="266" x2="280" y2="266" stroke="#374151" stroke-width="2"></line>
              <line x1="100" y1="338" x2="280" y2="338" stroke="#374151" stroke-width="2"></line>
              <line x1="60" y1="50" x2="60" y2="410" stroke="#f97316" stroke-width="2"></line>
              <line x1="55" y1="50" x2="65" y2="50" stroke="#f97316" stroke-width="2"></line>
              <line x1="55" y1="410" x2="65" y2="410" stroke="#f97316" stroke-width="2"></line>
              <text x="40" y="235" fill="#374151" font-size="14" font-weight="600" transform="rotate(-90 40 235)">{height} cm</text>
              <line x1="100" y1="430" x2="280" y2="430" stroke="#f97316" stroke-width="2"></line>
              <line x1="100" y1="425" x2="100" y2="435" stroke="#f97316" stroke-width="2"></line>
              <line x1="280" y1="425" x2="280" y2="435" stroke="#f97316" stroke-width="2"></line>
              <text x="175" y="448" fill="#374151" font-size="14" font-weight="600">{width} cm</text>
              <text x="320" y="235" fill="#6b7280" font-size="12">Hloubka: {depth} cm</text>
            </svg>
          </div>
          <div>
            <h3 class="font-bold text-lg mb-4">Detailní rozměry</h3>
            <div class="space-y-4">
              <div class="bg-white border rounded-xl p-4">
                <div class="flex items-center justify-between mb-2">
                  <span class="font-medium">Celková výška</span>
                  <span class="text-xl font-bold text-primary-600">{height} cm</span>
                </div>
                <div class="text-sm text-gray-500">Od podlahy po horní hranu</div>
              </div>
              <div class="bg-white border rounded-xl p-4">
                <div class="flex items-center justify-between mb-2">
                  <span class="font-medium">Šířka</span>
                  <span class="text-xl font-bold text-primary-600">{width} cm</span>
                </div>
                <div class="text-sm text-gray-500">Vnější rozměr mezi stojnami</div>
              </div>
              <div class="bg-white border rounded-xl p-4">
                <div class="flex items-center justify-between mb-2">
                  <span class="font-medium">Hloubka</span>
                  <span class="text-xl font-bold text-primary-600">{depth} cm</span>
                </div>
                <div class="text-sm text-gray-500">Využitelná plocha police</div>
              </div>
              <div class="bg-primary-50 border border-primary-200 rounded-xl p-4">
                <div class="flex items-center gap-3">
                  <span class="text-2xl">💡</span>
                  <div>
                    <div class="font-medium">Tip: Změřte si prostor</div>
                    <div class="text-sm text-gray-600">Nechte alespoň 5 cm volného místa okolo regálu.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Assembly Tab -->
      <div id="tab-assembly" class="tab-content hidden">
        <h2 class="text-2xl font-bold mb-6">Montáž regálu</h2>

        <div class="bg-green-50 border border-green-200 rounded-xl p-6 mb-8">
          <div class="flex items-start gap-4">
            <span class="text-3xl">⏱️</span>
            <div>
              <h3 class="font-bold text-lg text-green-800">Montáž za 10 minut bez nářadí!</h3>
              <p class="text-green-700">Díky bezšroubovému systému je sestavení regálu hračka.</p>
            </div>
          </div>
        </div>

        <div class="mb-8">
          <h3 class="font-bold text-lg mb-4">🎬 Video návod k montáži</h3>
          <div class="bg-white rounded-xl shadow-sm overflow-hidden">
            <div class="video-wrapper">
              <iframe width="560" height="315" src="https://www.youtube.com/embed/BBjY5IomYkk" title="Video - montáž regálu" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
            </div>
          </div>
        </div>

        <div class="grid md:grid-cols-2 gap-8">
          <div>
            <h3 class="font-bold text-lg mb-4">Postup montáže</h3>
            <ol class="space-y-4">
              <li class="flex gap-4">
                <span class="w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">1</span>
                <div><div class="font-medium">Položte 2 stojny na zem</div><div class="text-sm text-gray-500">Rovnoběžně vedle sebe</div></div>
              </li>
              <li class="flex gap-4">
                <span class="w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">2</span>
                <div><div class="font-medium">Nasaďte příčky spodní police</div><div class="text-sm text-gray-500">Zaklapněte do otvorů</div></div>
              </li>
              <li class="flex gap-4">
                <span class="w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">3</span>
                <div><div class="font-medium">Postavte konstrukci</div><div class="text-sm text-gray-500">Přidejte zbývající stojny</div></div>
              </li>
              <li class="flex gap-4">
                <span class="w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">4</span>
                <div><div class="font-medium">Vložte police</div><div class="text-sm text-gray-500">Položte na příčky</div></div>
              </li>
              <li class="flex gap-4">
                <span class="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">✓</span>
                <div><div class="font-medium">Hotovo!</div><div class="text-sm text-gray-500">Zkontrolujte stabilitu</div></div>
              </li>
            </ol>
          </div>
          <div>
            <h3 class="font-bold text-lg mb-4">Tipy pro montáž</h3>
            <div class="space-y-3">
              <div class="flex items-start gap-3 bg-gray-50 rounded-lg p-4"><span class="text-xl">💡</span><p class="text-sm">Montáž provádějte ve dvou lidech.</p></div>
              <div class="flex items-start gap-3 bg-gray-50 rounded-lg p-4"><span class="text-xl">💡</span><p class="text-sm">Použijte gumovou paličku pro doražení spojů.</p></div>
              <div class="flex items-start gap-3 bg-gray-50 rounded-lg p-4"><span class="text-xl">💡</span><p class="text-sm">Pro stabilitu přikotvěte regál ke zdi.</p></div>
              <div class="flex items-start gap-3 bg-gray-50 rounded-lg p-4"><span class="text-xl">💡</span><p class="text-sm">Těžké předměty umísťujte na spodní police.</p></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Reviews Tab -->
      <div id="tab-reviews" class="tab-content hidden">
        <h2 class="text-2xl font-bold mb-6">Recenze zákazníků</h2>
        <div class="flex items-center gap-4 mb-8">
          <div class="text-5xl font-bold text-primary-600">4.8</div>
          <div>
            <div class="text-yellow-400 text-2xl">★★★★★</div>
            <div class="text-gray-500">127 hodnocení</div>
          </div>
        </div>
        <div class="space-y-4">
          <div class="bg-gray-50 rounded-xl p-4">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-yellow-400">★★★★★</span>
              <span class="font-medium">Pavel K.</span>
              <span class="text-gray-400 text-sm">• před 3 dny</span>
            </div>
            <p class="text-gray-600">Skvělý regál za super cenu. Montáž opravdu jednoduchá, zvládl jsem sám za 15 minut.</p>
          </div>
          <div class="bg-gray-50 rounded-xl p-4">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-yellow-400">★★★★★</span>
              <span class="font-medium">Marie S.</span>
              <span class="text-gray-400 text-sm">• před týdnem</span>
            </div>
            <p class="text-gray-600">Regál vypadá přesně jako na fotce. Police jsou pevné a nosnost je dostatečná pro naše potřeby.</p>
          </div>
          <div class="bg-gray-50 rounded-xl p-4">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-yellow-400">★★★★☆</span>
              <span class="font-medium">Tomáš H.</span>
              <span class="text-gray-400 text-sm">• před 2 týdny</span>
            </div>
            <p class="text-gray-600">Kvalitní zpracování. Jediná výtka - instrukce mohly být podrobnější, ale video pomohlo.</p>
          </div>
        </div>
      </div>

      <!-- FAQ Tab -->
      <div id="tab-faq" class="tab-content hidden">
        <h2 class="text-2xl font-bold mb-6">Časté dotazy</h2>
        <div class="space-y-4 max-w-3xl">
          <div class="faq-item border rounded-xl overflow-hidden">
            <button onclick="toggleFaq(this)" class="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50">
              <span class="font-medium">Jaká je skutečná nosnost police?</span>
              <span class="faq-icon text-xl transition-transform">▼</span>
            </button>
            <div class="faq-answer px-5 pb-5">
              <p class="text-gray-600">Nosnost {capacity_per_shelf} kg na polici platí při rovnoměrném rozložení zátěže.</p>
            </div>
          </div>
          <div class="faq-item border rounded-xl overflow-hidden">
            <button onclick="toggleFaq(this)" class="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50">
              <span class="font-medium">Mohu regál použít ve vlhkém prostředí?</span>
              <span class="faq-icon text-xl transition-transform">▼</span>
            </button>
            <div class="faq-answer px-5 pb-5">
              <p class="text-gray-600">{"Pozinkovaný regál je vhodný do vlhkých prostor jako jsou sklepy nebo garáže." if color == "Zinkovaný" else "Lakovaný regál je vhodný do suchých a mírně vlhkých prostor. Pro vlhké prostředí doporučujeme zinkovanou variantu."}</p>
            </div>
          </div>
          <div class="faq-item border rounded-xl overflow-hidden">
            <button onclick="toggleFaq(this)" class="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50">
              <span class="font-medium">Jak dlouho trvá doručení?</span>
              <span class="faq-icon text-xl transition-transform">▼</span>
            </button>
            <div class="faq-answer px-5 pb-5">
              <p class="text-gray-600">Produkt je skladem, expedujeme ihned. Doručení trvá obvykle 2-3 pracovní dny.</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>

  <!-- Related Products -->
  <section class="mb-12">
    <h2 class="text-2xl font-bold mb-6">🔗 Podobné produkty</h2>
    <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
'''

    # Add related products
    for rp in related[:4]:
        rp_filename = get_filename(rp)
        rp_name = f"Regál {rp['height']}×{rp['width']}×{rp['depth']} cm {color_czech_map.get(rp['color'], rp['color'].lower())}"
        rp_discount = round((1 - rp['price'] / rp['priceOrig']) * 100)
        html += f'''      <a href="{rp_filename}.html" class="product-card bg-white rounded-xl shadow-sm overflow-hidden group hover:shadow-lg transition-all block">
        <div class="relative">
          <img src="{rp['image']}" alt="{rp_name}" class="product-image w-full p-4">
          <span class="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">-{rp_discount}%</span>
        </div>
        <div class="p-4">
          <h3 class="font-medium text-sm mb-2 group-hover:text-primary-500">{rp_name}</h3>
          <div class="flex items-baseline gap-2">
            <span class="text-xl font-bold text-primary-600">{rp['price']} Kč</span>
            <span class="text-sm text-gray-400 line-through">{rp['priceOrig']} Kč</span>
          </div>
        </div>
      </a>
'''

    html += f'''    </div>
  </section>

</main>

<!-- Footer -->
<footer class="bg-gray-900 text-white py-12 mt-12">
  <div class="container mx-auto px-4">
    <div class="grid md:grid-cols-4 gap-8 mb-8">
      <div>
        <div class="text-xl font-bold mb-4">Bazarovyregal<span class="text-primary-500">.cz</span></div>
        <p class="text-gray-400 text-sm">Největší slevy na regály. Pouze nové a nerozbalené zboží.</p>
      </div>
      <div>
        <h4 class="font-bold mb-4">Kategorie</h4>
        <ul class="space-y-2 text-gray-400 text-sm">
          <li><a href="regaly-do-garaze.html" class="hover:text-primary-400">Regály do garáže</a></li>
          <li><a href="regaly-do-sklepa.html" class="hover:text-primary-400">Regály do sklepa</a></li>
          <li><a href="zinkove-regaly.html" class="hover:text-primary-400">Zinkové regály</a></li>
        </ul>
      </div>
      <div>
        <h4 class="font-bold mb-4">Informace</h4>
        <ul class="space-y-2 text-gray-400 text-sm">
          <li><a href="o-nas.html" class="hover:text-primary-400">O nás</a></li>
          <li><a href="faq.html" class="hover:text-primary-400">FAQ</a></li>
          <li><a href="kontakt.html" class="hover:text-primary-400">Kontakt</a></li>
        </ul>
      </div>
      <div>
        <h4 class="font-bold mb-4">Kontakt</h4>
        <ul class="space-y-2 text-gray-400 text-sm">
          <li>✉️ info@bazarovyregal.cz</li>
        </ul>
      </div>
    </div>
    <div class="border-t border-gray-800 pt-8 text-center text-gray-500 text-sm">
      © 2026 Bazarovyregal.cz - Shoptet.cz - Budujeme regálové impérium
    </div>
  </div>
</footer>

<script>
// Sticky bar
window.addEventListener('scroll', () => {{
  const stickyBar = document.getElementById('stickyBar');
  if (window.scrollY > 500) {{
    stickyBar.classList.add('visible');
  }} else {{
    stickyBar.classList.remove('visible');
  }}
}});

// Quantity
function changeQty(delta) {{
  const input = document.getElementById('qty');
  input.value = Math.max(1, parseInt(input.value) + delta);
}}

// Add to Cart - redirects to vyprodej-regalu.cz
function addToCart() {{
  const qty = document.getElementById('qty').value;
  const url = `https://www.vyprodej-regalu.cz/p/{seo_url}?addtocart=1&quantity=${{qty}}&return=cart&utm_source=bazarovyregal&utm_medium=affiliate&utm_campaign=detail`;
  window.open(url, '_blank');
}}

// Tabs
function showTab(tabId) {{
  document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-active'));
  document.getElementById('tab-' + tabId).classList.remove('hidden');
  document.querySelector(`[data-tab="${{tabId}}"]`).classList.add('tab-active');
}}

// FAQ
function toggleFaq(btn) {{
  btn.closest('.faq-item').classList.toggle('open');
}}
</script>

<!-- AI CHAT WIDGET -->
<div id="chatWidget" class="fixed bottom-6 right-4 z-40">
  <button onclick="toggleChat()" class="bg-primary-500 hover:bg-primary-600 text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-2xl transition-transform hover:scale-110">
    💬
  </button>

  <div id="chatWindow" class="hidden absolute bottom-16 right-0 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl overflow-hidden">
    <div class="bg-gradient-to-r from-primary-500 to-orange-500 text-white p-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">🤖</div>
          <div>
            <div class="font-bold">RegálBot</div>
            <div class="text-xs text-white/80 flex items-center gap-1">
              <span class="w-2 h-2 bg-green-400 rounded-full"></span> Online
            </div>
          </div>
        </div>
        <button onclick="toggleChat()" class="text-white/80 hover:text-white text-xl">✕</button>
      </div>
    </div>

    <div id="chatMessages" class="h-80 overflow-y-auto p-4 space-y-4">
      <div class="flex gap-3">
        <div class="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">🤖</div>
        <div class="bg-gray-100 rounded-2xl rounded-tl-none p-3 text-sm max-w-[80%]">
          Ahoj! 👋 Jsem RegálBot a pomohu vám vybrat ideální regál. Na co se chcete zeptat?
        </div>
      </div>
    </div>

    <div class="border-t p-4">
      <div class="flex gap-2">
        <input type="text" id="chatInput" placeholder="Napište zprávu..." class="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500" onkeypress="if(event.key==='Enter')sendMessage()">
        <button onclick="sendMessage()" class="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg transition">➤</button>
      </div>
      <div class="flex flex-wrap gap-1 mt-2">
        <button onclick="quickQuestion('Jaký regál do garáže?')" class="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-full">🚗 Do garáže</button>
        <button onclick="quickQuestion('Regál do vlhka?')" class="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-full">💧 Do vlhka</button>
        <button onclick="quickQuestion('Nejlevnější regál?')" class="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-full">💰 Nejlevnější</button>
      </div>
    </div>
  </div>
</div>

<script src="chatbot.js"></script>

<!-- Regal Master Look -->
<script src="https://regalmaster.vyprodej-regalu.cz/tracker.js" data-project-id="vyprodej-regalu" data-api-url="https://regalmaster.vyprodej-regalu.cz/api/events" data-sample-rate="1.0" async></script>
</body>
</html>'''

    return html

# Generate all product pages
output_dir = os.path.dirname(os.path.abspath(__file__))
print(f"Generating product pages in: {output_dir}")

for p in all_products:
    filename = get_filename(p)
    filepath = os.path.join(output_dir, f"{filename}.html")
    html = generate_html(p)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f"Generated: {filename}.html")

print(f"\nDone! Generated {len(all_products)} product pages.")
