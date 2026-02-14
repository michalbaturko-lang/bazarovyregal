#!/usr/bin/env python3
"""
Google Merchant Center Product Feed Generator for Bazarovyregal.cz

Generates XML feed (RSS 2.0 with Google Shopping namespace) for:
- Google Shopping campaigns
- Performance Max campaigns
- Free product listings

Covers ALL 87 products from the full catalog.

Usage:
    python3 generate_merchant_feed.py

Output:
    merchant_feed.xml  - Main product feed for Google Merchant Center
    merchant_feed.txt  - Tab-delimited feed (alternative format)

Feed specification: https://support.google.com/merchants/answer/7052112
"""

import os
from datetime import datetime

from pseo_config import BASE_URL


# ============================================================
# Constants
# ============================================================

BRAND = "BazarovyRegal"
GOOGLE_PRODUCT_CATEGORY_ID = 6356  # Home > Storage > Shelving

# Image URLs by color
COLOR_IMAGES = {
    "Černá": "https://vyprodej-regalucz.s26.cdn-upgates.com/l/l690377af7480a-1-regal-1800x900x400-mm-lakovany-5-policovy-nosnost-875-kg-cerny-pravy-18090405875black1.jpeg",
    "Bílá": "https://vyprodej-regalucz.s26.cdn-upgates.com/6/6690a777ad6edc-1-18090405875white1.jpeg",
    "Červená": "https://vyprodej-regalucz.s26.cdn-upgates.com/_cache/9/e/9eef5f9f2ad8880b75926a3eae58485b-1-regal-1500x700x300-mm-lakovany-4-policovy-nosnost-700-kg-cerveny-pravy-15070304700red1.jpeg",
    "Modrá": "https://vyprodej-regalucz.s26.cdn-upgates.com/_cache/1/c/1c64831c1231f5847cf9e7a36f6cdf6f-1-15070304700blue1.jpeg",
    "Zinkovaný": "https://vyprodej-regalucz.s26.cdn-upgates.com/z/z6914605330838-5-pol-pravy-zink.jpg",
    "Profesionální": "https://vyprodej-regalucz.s26.cdn-upgates.com/_cache/b/1/b17ce5b491bdb73a0df3160b51fbcf7e-1-regal-1800x1200x500-mm-lakovany-5-policovy-nosnost-1050-kg-modro-oranzovy-pravy-18120501050orangeblue1.jpeg",
}

COLOR_SLUG_MAP = {
    "Černá": "cerna", "Bílá": "bila", "Červená": "cervena",
    "Modrá": "modra", "Zinkovaný": "zinkovany", "Profesionální": "profesionalni",
}

COLOR_LABEL_MAP = {
    "Černá": "cerny", "Bílá": "bily", "Červená": "cerveny",
    "Modrá": "modry", "Zinkovaný": "zinkovany", "Profesionální": "profesionalni",
}

# All 87 product slugs (same as in generate_full_product_pages.py)
PRODUCT_SLUGS = [
    "regal-150x70x30-cerna", "regal-150x70x30-cervena", "regal-150x70x30-zinkovany",
    "regal-180x90x40-bila", "regal-180x90x40-zinkovany",
    "regal-180x60x40-cerna", "regal-180x40x40-cerna", "regal-200x90x40-cerna",
    "regal-220x90x45-cerna", "regal-180x120x50-cerna", "regal-180x90x40-modra",
    "regal-180x40x30-zinkovany", "regal-180x90x45-cerna",
    "regal-220x70x45-bila", "regal-200x40x30-modra", "regal-200x70x45-cerna",
    "regal-200x120x40-cerna", "regal-220x70x50-cervena", "regal-150x120x40-zinkovany",
    "regal-180x90x50-cervena", "regal-180x70x30-bila", "regal-200x60x50-modra",
    "regal-220x60x45-bila", "regal-200x120x50-zinkovany", "regal-200x60x40-zinkovany",
    "regal-150x40x30-bila", "regal-150x120x45-cervena", "regal-200x90x40-modra",
    "regal-200x120x40-zinkovany", "regal-220x40x30-cervena", "regal-180x40x40-zinkovany",
    "regal-150x90x30-zinkovany", "regal-180x90x40-cervena", "regal-200x90x50-cerna",
    "regal-180x40x45-cerna", "regal-180x120x40-cerna", "regal-150x60x30-cerna",
    "regal-150x120x40-cervena", "regal-220x60x40-zinkovany", "regal-220x60x50-modra",
    "regal-150x40x50-cervena", "regal-220x90x30-cerna", "regal-220x70x30-bila",
    "regal-180x120x50-bila", "regal-180x70x50-bila", "regal-150x40x40-bila",
    "regal-220x90x40-modra", "regal-180x90x30-modra", "regal-220x70x50-zinkovany",
    "regal-220x60x40-cervena", "regal-150x120x30-cervena", "regal-150x120x50-zinkovany",
    "regal-180x40x30-bila", "regal-150x60x50-cerna", "regal-180x120x30-zinkovany",
    "regal-220x120x45-cervena", "regal-200x60x45-modra", "regal-200x90x45-cerna",
    "regal-180x120x45-bila", "regal-150x60x45-cervena", "regal-220x120x45-zinkovany",
    "regal-150x120x45-cerna", "regal-200x70x40-cervena", "regal-200x120x50-cervena",
    "regal-150x90x45-cerna", "regal-200x60x45-bila", "regal-220x120x30-cerna",
    "regal-180x120x30-cervena", "regal-180x90x40-cerna", "regal-200x40x45-bila",
    "regal-180x40x45-zinkovany", "regal-180x60x40-bila", "regal-150x60x45-modra",
    "regal-180x70x40-cerna", "regal-150x90x40-bila", "regal-200x70x40-bila",
    "regal-180x90x45-cervena", "regal-150x40x45-bila", "regal-200x40x30-zinkovany",
    "regal-200x70x50-zinkovany", "regal-150x90x40-cervena", "regal-220x40x40-cervena",
    "regal-150x70x45-cerna", "regal-200x90x45-modra", "regal-200x120x40-bila",
    "regal-150x70x30-bila", "regal-180x120x50-profesionalni",
]


def parse_product(slug):
    """Parse product slug into structured product data."""
    # Parse slug: regal-{H}x{W}x{D}-{color_slug}
    parts = slug.replace("regal-", "").split("-")
    dims = parts[0].split("x")
    height = int(dims[0])
    width = int(dims[1])
    depth = int(dims[2])
    color_slug = parts[1]

    # Reverse color slug to full name
    slug_to_color = {v: k for k, v in COLOR_SLUG_MAP.items()}
    color = slug_to_color.get(color_slug, "Černá")

    # Calculate product attributes
    surface = "Pozinkovany" if color == "Zinkovaný" else "Lakovany"
    shelves = 5 if height >= 180 else 4
    capacity_per_shelf = 210 if color == "Profesionální" else 175
    capacity = shelves * capacity_per_shelf

    # Price formula (matches generate_full_product_pages.py)
    base_price = 400 + (height // 10) * 15 + (width // 10) * 10 + (depth // 10) * 5
    if color == "Zinkovaný":
        base_price -= 50
    elif color == "Profesionální":
        base_price += 200
    price = (base_price // 10) * 10 - 1
    price_orig = price * 4

    # Estimate weight from dimensions
    volume_factor = (height * width * depth) / 1000000
    weight_kg = round(5 + volume_factor * 20, 1)

    # Image URL
    image = COLOR_IMAGES.get(color, COLOR_IMAGES["Černá"])

    # Detect bestseller
    is_bestseller = (slug == "regal-180x90x40-cerna")

    # Build description
    color_label = COLOR_LABEL_MAP.get(color, color.lower())
    if color == "Profesionální":
        desc = (f"Profesionalni kovovy regal {height}x{width}x{depth} cm modro-oranzovy. "
                f"{shelves} polic, nosnost {capacity} kg ({capacity_per_shelf} kg/police). "
                f"Nejsilnejsi regal v nabidce. Bezroubova montaz. "
                f"Novy, zaruka 7 let. Likvidace skladu.")
    elif color == "Zinkovaný":
        desc = (f"Zinkovany kovovy regal {height}x{width}x{depth} cm. "
                f"{shelves} polic, nosnost {capacity} kg. "
                f"Maximalni odolnost korozi - idealni do vlhkych prostor. "
                f"Bezroubova montaz. Novy, zaruka 7 let. Likvidace skladu.")
    else:
        extra = " BESTSELLER." if is_bestseller else ""
        desc = (f"Kovovy regal {height}x{width}x{depth} cm {color_label}. "
                f"{shelves} polic, nosnost {capacity} kg ({capacity_per_shelf} kg/police). "
                f"Bezroubova montaz za 10 minut.{extra} "
                f"Novy, zaruka 7 let. Likvidace skladu.")

    return {
        "slug": slug,
        "filename": f"{slug}.html",
        "title": f"Regal {height}x{width}x{depth} cm {color_label}",
        "description": desc,
        "height": height,
        "width": width,
        "depth": depth,
        "color": color,
        "color_label": color_label,
        "surface": surface,
        "shelves": shelves,
        "capacity": capacity,
        "capacity_per_shelf": capacity_per_shelf,
        "price": price,
        "price_orig": price_orig,
        "weight_kg": weight_kg,
        "image": image,
        "is_bestseller": is_bestseller,
    }


def build_all_products():
    """Build full product catalog from slugs."""
    products = []
    for slug in PRODUCT_SLUGS:
        products.append(parse_product(slug))
    return products


def generate_xml_feed(products, output_dir):
    """Generate Google Merchant Center XML product feed."""

    lines = []
    lines.append('<?xml version="1.0" encoding="UTF-8"?>')
    lines.append('<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">')
    lines.append('  <channel>')
    lines.append('    <title>Bazarovyregal.cz - Kovove regaly</title>')
    lines.append(f'    <link>{BASE_URL}</link>')
    lines.append('    <description>Kovove regaly za likvidacni ceny. Slevy az 75%. Zaruka 7 let. 87 produktu skladem.</description>')

    for i, p in enumerate(products):
        product_id = f"BR-{i+1:03d}"
        link = f"{BASE_URL}/{p['filename']}"

        # Price tier
        if p["price"] < 600:
            price_tier = "budget"
        elif p["price"] < 800:
            price_tier = "mid"
        else:
            price_tier = "premium"

        # Size category
        size_cat = "compact" if p["height"] <= 150 else ("standard" if p["height"] <= 180 else "tall")

        # Shipping
        shipping_price = "0 CZK" if p["price"] >= 2000 else "99 CZK"

        lines.append('    <item>')
        lines.append(f'      <g:id>{product_id}</g:id>')
        lines.append(f'      <g:title>{p["title"]}</g:title>')
        lines.append(f'      <g:description>{p["description"]}</g:description>')
        lines.append(f'      <g:link>{link}</g:link>')
        lines.append(f'      <g:image_link>{p["image"]}</g:image_link>')
        lines.append(f'      <g:availability>in_stock</g:availability>')
        lines.append(f'      <g:price>{p["price_orig"]} CZK</g:price>')
        lines.append(f'      <g:sale_price>{p["price"]} CZK</g:sale_price>')
        lines.append(f'      <g:condition>new</g:condition>')
        lines.append(f'      <g:brand>{BRAND}</g:brand>')
        lines.append(f'      <g:mpn>{product_id}</g:mpn>')
        lines.append(f'      <g:google_product_category>{GOOGLE_PRODUCT_CATEGORY_ID}</g:google_product_category>')
        lines.append(f'      <g:product_type>Domacnost &gt; Regaly &gt; Kovove regaly</g:product_type>')

        # Custom labels for campaign segmentation
        lines.append(f'      <g:custom_label_0>{price_tier}</g:custom_label_0>')
        lines.append(f'      <g:custom_label_1>{p["color_label"]}</g:custom_label_1>')
        lines.append(f'      <g:custom_label_2>{size_cat}</g:custom_label_2>')
        lines.append(f'      <g:custom_label_3>{"bestseller" if p["is_bestseller"] else "standard"}</g:custom_label_3>')
        lines.append(f'      <g:custom_label_4>{p["surface"]}</g:custom_label_4>')

        # Shipping
        lines.append('      <g:shipping>')
        lines.append('        <g:country>CZ</g:country>')
        lines.append('        <g:service>Standard</g:service>')
        lines.append(f'        <g:price>{shipping_price}</g:price>')
        lines.append('      </g:shipping>')

        # Weight
        lines.append(f'      <g:shipping_weight>{p["weight_kg"]} kg</g:shipping_weight>')

        lines.append('    </item>')

    lines.append('  </channel>')
    lines.append('</rss>')

    xml_content = "\n".join(lines)
    feed_path = os.path.join(output_dir, "merchant_feed.xml")
    with open(feed_path, "w", encoding="utf-8") as f:
        f.write(xml_content)
    print(f"  XML feed written: {feed_path}")
    return feed_path


def generate_txt_feed(products, output_dir):
    """Generate tab-delimited feed as alternative format for Merchant Center."""

    headers = [
        "id", "title", "description", "link", "image_link",
        "availability", "price", "sale_price", "condition", "brand", "mpn",
        "google_product_category", "product_type",
        "custom_label_0", "custom_label_1", "custom_label_2",
        "custom_label_3", "custom_label_4",
        "shipping_weight",
    ]

    rows = ["\t".join(headers)]

    for i, p in enumerate(products):
        product_id = f"BR-{i+1:03d}"

        if p["price"] < 600:
            price_tier = "budget"
        elif p["price"] < 800:
            price_tier = "mid"
        else:
            price_tier = "premium"

        size_cat = "compact" if p["height"] <= 150 else ("standard" if p["height"] <= 180 else "tall")

        row = [
            product_id,
            p["title"],
            p["description"].replace("\t", " "),
            f"{BASE_URL}/{p['filename']}",
            p["image"],
            "in_stock",
            f"{p['price_orig']} CZK",
            f"{p['price']} CZK",
            "new",
            BRAND,
            product_id,
            str(GOOGLE_PRODUCT_CATEGORY_ID),
            "Domacnost > Regaly > Kovove regaly",
            price_tier,
            p["color_label"],
            size_cat,
            "bestseller" if p["is_bestseller"] else "standard",
            p["surface"],
            f"{p['weight_kg']} kg",
        ]

        rows.append("\t".join(row))

    txt_content = "\n".join(rows)
    feed_path = os.path.join(output_dir, "merchant_feed.txt")
    with open(feed_path, "w", encoding="utf-8") as f:
        f.write(txt_content)
    print(f"  TXT feed written: {feed_path}")
    return feed_path


def main():
    output_dir = os.path.dirname(os.path.abspath(__file__))

    print("=" * 60)
    print("  GOOGLE MERCHANT CENTER FEED GENERATOR")
    print("  Bazarovyregal.cz")
    print("=" * 60)

    products = build_all_products()
    print(f"\n  Products in catalog: {len(products)}")

    # Stats
    prices = [p["price"] for p in products]
    print(f"  Price range: {min(prices)} - {max(prices)} CZK")
    print(f"  Colors: {len(set(p['color'] for p in products))}")
    print(f"  Heights: {sorted(set(p['height'] for p in products))}")

    print("\nGenerating XML feed...")
    xml_path = generate_xml_feed(products, output_dir)

    print("\nGenerating TXT feed...")
    txt_path = generate_txt_feed(products, output_dir)

    print("\n" + "=" * 60)
    print("  FEED GENERATION COMPLETE")
    print("=" * 60)
    print(f"\n  Files created:")
    print(f"    1. {xml_path}")
    print(f"    2. {txt_path}")
    print(f"  Total products in feed: {len(products)}")
    print(f"\n  Next steps:")
    print(f"    1. Upload merchant_feed.xml to Google Merchant Center")
    print(f"    2. Set feed URL: {BASE_URL}/merchant_feed.xml")
    print(f"    3. Schedule automatic fetch (daily recommended)")
    print(f"    4. Verify products in Merchant Center diagnostics")
    print(f"    5. Link Merchant Center to Google Ads account")
    print()


if __name__ == "__main__":
    main()
