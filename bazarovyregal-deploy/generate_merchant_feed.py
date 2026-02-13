#!/usr/bin/env python3
"""
Google Merchant Center Product Feed Generator for Bazarovyregal.cz

Generates XML feed (RSS 2.0 with Google Shopping namespace) for:
- Google Shopping campaigns
- Performance Max campaigns
- Free product listings

Usage:
    python3 generate_merchant_feed.py

Output:
    merchant_feed.xml  - Main product feed for Google Merchant Center
    merchant_feed.txt  - Tab-delimited feed (alternative format)

Feed specification: https://support.google.com/merchants/answer/7052112
"""

import os
import xml.etree.ElementTree as ET
from xml.dom import minidom
from datetime import datetime

from pseo_config import BASE_URL, PRODUCTS, IMAGES, COLORS, CATEGORIES


# ============================================================
# Extended product data for Merchant Center
# (supplements the basic data from pseo_config.py)
# ============================================================

BRAND = "BazarovyRegal"
SHIPPING_CZ = {
    "country": "CZ",
    "service": "Ceska posta",
    "price_below_2000": "99 CZK",
    "price_above_2000": "0 CZK",  # Free shipping above 2000 CZK
}

# Google product category for metal shelving
# https://www.google.com/basepages/producttype/taxonomy-with-ids.cs-CZ.txt
GOOGLE_PRODUCT_CATEGORY = "Domacnost > Ulozne a organizacni systemy > Regaly a police"
GOOGLE_PRODUCT_CATEGORY_ID = 6356

# Map products to detailed descriptions for the feed
PRODUCT_DETAILS = {
    "regal-150x70x30-cerna.html": {
        "description": "Kovovy regal 150x70x30 cm v cerne barve. 4 police, nosnost 700 kg celkem (175 kg/police). "
                       "Bezroubova montaz za 10 minut bez naradi. Idealni do garaze, sklepa, dilny. "
                       "Novy, nerozbaleny, zaruka 7 let. Likvidace skladu - sleva 75%.",
        "shelves": 4, "capacity_total": 700, "capacity_shelf": 175,
        "height_cm": 150, "width_cm": 70, "depth_cm": 30,
        "weight_kg": 8.5, "color": "Cerny", "surface": "Lakovany",
        "condition": "new", "material": "Ocel",
    },
    "regal-150x70x30-zinkovany.html": {
        "description": "Zinkovany kovovy regal 150x70x30 cm. 4 police, nosnost 700 kg. "
                       "Odolny korozi - idealni do vlhkych prostor. Bezroubova montaz. "
                       "Novy, zaruka 7 let. Likvidace skladu.",
        "shelves": 4, "capacity_total": 700, "capacity_shelf": 175,
        "height_cm": 150, "width_cm": 70, "depth_cm": 30,
        "weight_kg": 8.5, "color": "Zinkovany", "surface": "Pozinkovany",
        "condition": "new", "material": "Ocel",
    },
    "regal-180x90x40-cerna.html": {
        "description": "Nejprodavanejsi kovovy regal 180x90x40 cm cerny. 5 polic, nosnost 875 kg celkem. "
                       "Bezroubova montaz za 10 minut. Skvely do garaze, skladu, dilny. "
                       "BESTSELLER. Novy, zaruka 7 let. Likvidace skladu - sleva 75%.",
        "shelves": 5, "capacity_total": 875, "capacity_shelf": 175,
        "height_cm": 180, "width_cm": 90, "depth_cm": 40,
        "weight_kg": 12.0, "color": "Cerny", "surface": "Lakovany",
        "condition": "new", "material": "Ocel",
    },
    "regal-180x90x40-zinkovany.html": {
        "description": "Zinkovany kovovy regal 180x90x40 cm. 5 polic, nosnost 875 kg. "
                       "Maximalni odolnost korozi a vlhkosti. Bezroubova montaz. "
                       "Novy, zaruka 7 let. Likvidace skladu.",
        "shelves": 5, "capacity_total": 875, "capacity_shelf": 175,
        "height_cm": 180, "width_cm": 90, "depth_cm": 40,
        "weight_kg": 12.0, "color": "Zinkovany", "surface": "Pozinkovany",
        "condition": "new", "material": "Ocel",
    },
    "regal-180x90x40-bila.html": {
        "description": "Bily kovovy regal 180x90x40 cm. 5 polic, nosnost 875 kg. "
                       "Elegantni bila barva do interieru, kancelare, bytu. Bezroubova montaz. "
                       "Novy, zaruka 7 let. Likvidace skladu.",
        "shelves": 5, "capacity_total": 875, "capacity_shelf": 175,
        "height_cm": 180, "width_cm": 90, "depth_cm": 40,
        "weight_kg": 12.0, "color": "Bily", "surface": "Lakovany",
        "condition": "new", "material": "Ocel",
    },
    "regal-180x90x40-cervena.html": {
        "description": "Cerveny kovovy regal 180x90x40 cm. 5 polic, nosnost 875 kg. "
                       "Vyrazna cervena barva do dilny a garaze. Bezroubova montaz. "
                       "Novy, zaruka 7 let. Likvidace skladu.",
        "shelves": 5, "capacity_total": 875, "capacity_shelf": 175,
        "height_cm": 180, "width_cm": 90, "depth_cm": 40,
        "weight_kg": 12.0, "color": "Cerveny", "surface": "Lakovany",
        "condition": "new", "material": "Ocel",
    },
    "regal-180x90x40-modra.html": {
        "description": "Modry kovovy regal 180x90x40 cm. 5 polic, nosnost 875 kg. "
                       "Profesionalni modra barva do skladu a dilny. Bezroubova montaz. "
                       "Novy, zaruka 7 let. Likvidace skladu.",
        "shelves": 5, "capacity_total": 875, "capacity_shelf": 175,
        "height_cm": 180, "width_cm": 90, "depth_cm": 40,
        "weight_kg": 12.0, "color": "Modry", "surface": "Lakovany",
        "condition": "new", "material": "Ocel",
    },
    "regal-200x90x40-cerna.html": {
        "description": "Vysoky kovovy regal 200x90x40 cm cerny. 5 polic, nosnost 875 kg. "
                       "Maximalni vyuziti vertikalniho prostoru. Bezroubova montaz. "
                       "Novy, zaruka 7 let. Likvidace skladu.",
        "shelves": 5, "capacity_total": 875, "capacity_shelf": 175,
        "height_cm": 200, "width_cm": 90, "depth_cm": 40,
        "weight_kg": 13.5, "color": "Cerny", "surface": "Lakovany",
        "condition": "new", "material": "Ocel",
    },
    "regal-180x120x50-cerna.html": {
        "description": "Siroky kovovy regal 180x120x50 cm cerny. 5 polic, nosnost 875 kg. "
                       "Velka ulozna plocha pro e-shopy a sklady. Bezroubova montaz. "
                       "Novy, zaruka 7 let. Likvidace skladu.",
        "shelves": 5, "capacity_total": 875, "capacity_shelf": 175,
        "height_cm": 180, "width_cm": 120, "depth_cm": 50,
        "weight_kg": 16.0, "color": "Cerny", "surface": "Lakovany",
        "condition": "new", "material": "Ocel",
    },
    "regal-180x120x50-profesionalni.html": {
        "description": "Profesionalni kovovy regal 180x120x50 cm modro-oranzovy. 5 polic, nosnost 1050 kg "
                       "(210 kg/police). Nejsilnejsi regal v nabidce. Pro narocne skladove vyuziti. "
                       "Bezroubova montaz. Novy, zaruka 7 let. Likvidace skladu.",
        "shelves": 5, "capacity_total": 1050, "capacity_shelf": 210,
        "height_cm": 180, "width_cm": 120, "depth_cm": 50,
        "weight_kg": 18.0, "color": "Modro-oranzovy", "surface": "Lakovany",
        "condition": "new", "material": "Ocel",
    },
}


def generate_xml_feed(output_dir):
    """Generate Google Merchant Center XML product feed."""

    # XML namespaces
    nsmap = {
        "g": "http://base.google.com/ns/1.0",
    }

    # Build RSS structure manually for better control
    lines = []
    lines.append('<?xml version="1.0" encoding="UTF-8"?>')
    lines.append('<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">')
    lines.append('  <channel>')
    lines.append(f'    <title>Bazarovyregal.cz - Kovove regaly</title>')
    lines.append(f'    <link>{BASE_URL}</link>')
    lines.append(f'    <description>Kovove regaly za likvidacni ceny. Slevy az 75%. Zaruka 7 let.</description>')

    for i, product in enumerate(PRODUCTS):
        url = product["url"]
        details = PRODUCT_DETAILS.get(url, {})

        if not details:
            print(f"  WARNING: No details for {url}, skipping")
            continue

        product_id = f"BR-{i+1:03d}"
        title = product["name"]
        description = details.get("description", "")
        link = f"{BASE_URL}/{url}"
        image_link = product["img"]
        price = product["price"]
        original_price = price * 4  # Original price before discount

        lines.append('    <item>')
        lines.append(f'      <g:id>{product_id}</g:id>')
        lines.append(f'      <g:title>{title}</g:title>')
        lines.append(f'      <g:description>{description}</g:description>')
        lines.append(f'      <g:link>{link}</g:link>')
        lines.append(f'      <g:image_link>{image_link}</g:image_link>')
        lines.append(f'      <g:availability>in_stock</g:availability>')
        lines.append(f'      <g:price>{price} CZK</g:price>')
        lines.append(f'      <g:sale_price>{price} CZK</g:sale_price>')
        lines.append(f'      <g:condition>new</g:condition>')
        lines.append(f'      <g:brand>{BRAND}</g:brand>')
        lines.append(f'      <g:mpn>{product_id}</g:mpn>')
        lines.append(f'      <g:google_product_category>{GOOGLE_PRODUCT_CATEGORY_ID}</g:google_product_category>')
        lines.append(f'      <g:product_type>Domacnost &gt; Regaly &gt; Kovove regaly</g:product_type>')

        # Custom labels for campaign segmentation (up to 5: custom_label_0 to custom_label_4)
        # Label 0: Price tier (for bid strategy)
        if price < 600:
            price_tier = "budget"
        elif price < 800:
            price_tier = "mid"
        else:
            price_tier = "premium"
        lines.append(f'      <g:custom_label_0>{price_tier}</g:custom_label_0>')

        # Label 1: Color
        lines.append(f'      <g:custom_label_1>{details.get("color", "")}</g:custom_label_1>')

        # Label 2: Size category
        h = details.get("height_cm", 0)
        size_cat = "compact" if h <= 150 else ("standard" if h <= 180 else "tall")
        lines.append(f'      <g:custom_label_2>{size_cat}</g:custom_label_2>')

        # Label 3: Bestseller flag
        if product.get("bestseller"):
            lines.append(f'      <g:custom_label_3>bestseller</g:custom_label_3>')
        else:
            lines.append(f'      <g:custom_label_3>standard</g:custom_label_3>')

        # Label 4: Surface type
        lines.append(f'      <g:custom_label_4>{details.get("surface", "")}</g:custom_label_4>')

        # Shipping
        lines.append(f'      <g:shipping>')
        lines.append(f'        <g:country>CZ</g:country>')
        lines.append(f'        <g:service>Standard</g:service>')
        shipping_price = "0 CZK" if price >= 2000 else "99 CZK"
        lines.append(f'        <g:price>{shipping_price}</g:price>')
        lines.append(f'      </g:shipping>')

        # Product dimensions
        if details.get("weight_kg"):
            lines.append(f'      <g:shipping_weight>{details["weight_kg"]} kg</g:shipping_weight>')

        lines.append('    </item>')

    lines.append('  </channel>')
    lines.append('</rss>')

    # Write XML feed
    xml_content = "\n".join(lines)
    feed_path = os.path.join(output_dir, "merchant_feed.xml")
    with open(feed_path, "w", encoding="utf-8") as f:
        f.write(xml_content)
    print(f"  XML feed written: {feed_path}")

    return feed_path


def generate_txt_feed(output_dir):
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

    for i, product in enumerate(PRODUCTS):
        url = product["url"]
        details = PRODUCT_DETAILS.get(url, {})
        if not details:
            continue

        product_id = f"BR-{i+1:03d}"
        price = product["price"]

        if price < 600:
            price_tier = "budget"
        elif price < 800:
            price_tier = "mid"
        else:
            price_tier = "premium"

        h = details.get("height_cm", 0)
        size_cat = "compact" if h <= 150 else ("standard" if h <= 180 else "tall")

        row = [
            product_id,
            product["name"],
            details.get("description", "").replace("\n", " "),
            f"{BASE_URL}/{url}",
            product["img"],
            "in_stock",
            f"{price} CZK",
            f"{price} CZK",
            "new",
            BRAND,
            product_id,
            str(GOOGLE_PRODUCT_CATEGORY_ID),
            "Domacnost > Regaly > Kovove regaly",
            price_tier,
            details.get("color", ""),
            size_cat,
            "bestseller" if product.get("bestseller") else "standard",
            details.get("surface", ""),
            f'{details.get("weight_kg", "")} kg' if details.get("weight_kg") else "",
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
    print(f"\n  Products in catalog: {len(PRODUCTS)}")
    print(f"  Products with details: {len(PRODUCT_DETAILS)}")

    print("\nGenerating XML feed...")
    xml_path = generate_xml_feed(output_dir)

    print("\nGenerating TXT feed...")
    txt_path = generate_txt_feed(output_dir)

    print("\n" + "=" * 60)
    print("  FEED GENERATION COMPLETE")
    print("=" * 60)
    print(f"\n  Files created:")
    print(f"    1. {xml_path}")
    print(f"    2. {txt_path}")
    print(f"\n  Next steps:")
    print(f"    1. Upload merchant_feed.xml to Google Merchant Center")
    print(f"    2. Set feed URL: {BASE_URL}/merchant_feed.xml")
    print(f"    3. Schedule automatic fetch (daily recommended)")
    print(f"    4. Verify products in Merchant Center diagnostics")
    print(f"    5. Link Merchant Center to Google Ads account")
    print()


if __name__ == "__main__":
    main()
