#!/usr/bin/env python3
"""
Add lifestyle photos to product pages
- Keeps main product image
- Adds lifestyle photo as second image
- Creates thumbnail gallery
"""

import os
import re
from pathlib import Path

# Mapping: color keyword -> lifestyle photo
COLOR_TO_LIFESTYLE = {
    # Zinkovany (galvanized)
    "zinkovany": ["garage_zinkovany.png", "basement_zinkovany.png"],
    "zinkovan": ["garage_zinkovany.png", "basement_zinkovany.png"],
    "pozinkovan": ["garage_zinkovany.png", "basement_zinkovany.png"],

    # Cerny (black)
    "cerna": ["office_cerny.png", "living_room_cerny.png"],
    "cerny": ["office_cerny.png", "living_room_cerny.png"],
    "černá": ["office_cerny.png", "living_room_cerny.png"],
    "černý": ["office_cerny.png", "living_room_cerny.png"],

    # Bila (white)
    "bila": ["kitchen_bily.png"],
    "bily": ["kitchen_bily.png"],
    "bílá": ["kitchen_bily.png"],
    "bílý": ["kitchen_bily.png"],

    # Modra/Modro-oranzovy (blue/blue-orange) - industrial
    "modra": ["garage_modro_oranzovy.png", "workshop_modro_oranzovy.png"],
    "modry": ["garage_modro_oranzovy.png", "workshop_modro_oranzovy.png"],
    "modrá": ["garage_modro_oranzovy.png", "workshop_modro_oranzovy.png"],
    "modrý": ["garage_modro_oranzovy.png", "workshop_modro_oranzovy.png"],
    "modro-oranzovy": ["warehouse_modro_oranzovy.png", "workshop_modro_oranzovy.png"],
    "orangeblue": ["warehouse_modro_oranzovy.png", "workshop_modro_oranzovy.png"],

    # Cervena (red) - use industrial
    "cervena": ["workshop_modro_oranzovy.png", "warehouse_modro_oranzovy.png"],
    "cerveny": ["workshop_modro_oranzovy.png", "warehouse_modro_oranzovy.png"],
    "červená": ["workshop_modro_oranzovy.png", "warehouse_modro_oranzovy.png"],
    "červený": ["workshop_modro_oranzovy.png", "warehouse_modro_oranzovy.png"],
}

# Scene descriptions for alt text
SCENE_DESCRIPTIONS = {
    "garage_zinkovany.png": "Zinkovaný regál v garáži s organizovaným nářadím",
    "basement_zinkovany.png": "Zinkovaný regál ve sklepě pro sezónní úložný prostor",
    "office_cerny.png": "Černý regál v moderní domácí kanceláři",
    "living_room_cerny.png": "Černý regál jako knihovna v útulném obývacím pokoji",
    "kitchen_bily.png": "Bílý regál v kuchyni pro organizaci potravin",
    "garage_modro_oranzovy.png": "Modro-oranžový průmyslový regál v garáži",
    "workshop_modro_oranzovy.png": "Modro-oranžový regál v profesionální dílně",
    "warehouse_modro_oranzovy.png": "Modro-oranžové regály ve skladu",
}

def detect_color(filename):
    """Detect product color from filename"""
    filename_lower = filename.lower()

    for color_key in COLOR_TO_LIFESTYLE:
        if color_key in filename_lower:
            return color_key

    return None

def get_lifestyle_photo(filename):
    """Get appropriate lifestyle photo for a product"""
    color = detect_color(filename)
    if color and color in COLOR_TO_LIFESTYLE:
        photos = COLOR_TO_LIFESTYLE[color]
        # Use hash of filename to consistently pick one photo
        index = hash(filename) % len(photos)
        return photos[index]
    return None

def add_gallery_to_html(html_content, lifestyle_photo, product_image_url):
    """Add thumbnail gallery with lifestyle photo"""

    if not lifestyle_photo:
        return html_content

    lifestyle_url = f"/lifestyle_photos/{lifestyle_photo}"
    alt_text = SCENE_DESCRIPTIONS.get(lifestyle_photo, "Regál v interiéru")

    # Find the main image section and add thumbnails
    # Look for: <div class="relative bg-white rounded-2xl p-6 shadow-sm mb-4">
    #           <img id="mainImage" ...

    # New gallery HTML to insert after main image div
    gallery_html = f'''
      <!-- Thumbnail Gallery -->
      <div class="flex gap-2 mt-4">
        <button onclick="changeImage('{product_image_url}')" class="thumbnail-btn w-20 h-20 border-2 border-primary-500 rounded-lg overflow-hidden p-1 bg-white">
          <img src="{product_image_url}" alt="Produktová fotka" class="thumbnail w-full h-full object-contain">
        </button>
        <button onclick="changeImage('{lifestyle_url}')" class="thumbnail-btn w-20 h-20 border-2 border-gray-200 hover:border-primary-300 rounded-lg overflow-hidden p-1 bg-white">
          <img src="{lifestyle_url}" alt="{alt_text}" class="thumbnail w-full h-full object-cover">
        </button>
      </div>
'''

    # Find the closing </div> after the main image and video section
    # Pattern: after </div> that follows mainImage, before <!-- Video -->
    pattern = r'(<div class="relative bg-white rounded-2xl p-6 shadow-sm mb-4">\s*<img id="mainImage"[^>]+>\s*</div>)'

    def replacement(match):
        return match.group(1) + gallery_html

    html_content = re.sub(pattern, replacement, html_content, flags=re.DOTALL)

    # Add JavaScript for image switching (if not already present)
    if 'function changeImage' not in html_content:
        js_code = '''
// Image gallery
function changeImage(src) {
  document.getElementById('mainImage').src = src;
  document.querySelectorAll('.thumbnail-btn').forEach(btn => {
    btn.classList.remove('border-primary-500');
    btn.classList.add('border-gray-200');
  });
  event.currentTarget.classList.remove('border-gray-200');
  event.currentTarget.classList.add('border-primary-500');
}
'''
        # Insert before </script> at the end
        html_content = html_content.replace('</script>\n\n<!-- AI CHAT', js_code + '</script>\n\n<!-- AI CHAT')

    return html_content

def extract_product_image_url(html_content):
    """Extract the main product image URL"""
    match = re.search(r'<img id="mainImage"[^>]+src="([^"]+)"', html_content)
    if match:
        return match.group(1)
    return None

def process_product_page(filepath):
    """Process a single product page"""
    filename = os.path.basename(filepath)

    # Skip non-product pages
    if not filename.startswith('regal-') or not filename.endswith('.html'):
        return False, "Not a product page"

    # Skip dimension-only pages (like regal-sirka-50-cm.html)
    if any(x in filename for x in ['sirka', 'hloubka', 'vyska', 'pruvodce', 'jak-vybrat', 'top-tipy']):
        return False, "Category/guide page, not product"

    lifestyle_photo = get_lifestyle_photo(filename)
    if not lifestyle_photo:
        return False, "No matching lifestyle photo"

    with open(filepath, 'r', encoding='utf-8') as f:
        html_content = f.read()

    # Check if already has gallery
    if 'thumbnail-btn' in html_content:
        return False, "Already has gallery"

    product_image_url = extract_product_image_url(html_content)
    if not product_image_url:
        return False, "Could not find product image"

    # Add gallery
    new_html = add_gallery_to_html(html_content, lifestyle_photo, product_image_url)

    if new_html == html_content:
        return False, "No changes made"

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_html)

    return True, lifestyle_photo

def main():
    """Process all product pages"""
    base_dir = Path('/sessions/vigilant-confident-ptolemy/mnt/bazarovyregal-deploy')

    # Find all product HTML files
    product_files = list(base_dir.glob('regal-*.html'))

    print(f"Found {len(product_files)} potential product pages")
    print("=" * 60)

    updated = 0
    skipped = 0
    by_color = {}

    for filepath in sorted(product_files):
        success, message = process_product_page(filepath)
        filename = filepath.name

        if success:
            print(f"✅ {filename} → {message}")
            updated += 1

            # Track by lifestyle photo
            if message not in by_color:
                by_color[message] = 0
            by_color[message] += 1
        else:
            print(f"⏭️  {filename}: {message}")
            skipped += 1

    print("\n" + "=" * 60)
    print(f"✅ Updated: {updated}")
    print(f"⏭️  Skipped: {skipped}")
    print("\nBy lifestyle photo:")
    for photo, count in sorted(by_color.items()):
        print(f"  {photo}: {count} products")

if __name__ == "__main__":
    main()
