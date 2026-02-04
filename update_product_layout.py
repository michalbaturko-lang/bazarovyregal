#!/usr/bin/env python3
"""
Update product page layout:
- Big image on LEFT
- 3 small thumbnails stacked vertically on RIGHT
"""

import os
import re
from pathlib import Path

def get_lifestyle_photos_for_color(filename):
    """Get 2 lifestyle photos based on product color"""
    filename_lower = filename.lower()

    if 'zinkov' in filename_lower or 'pozink' in filename_lower:
        return [
            ('/lifestyle_photos/garage_zinkovany.png', 'Zinkovaný regál v garáži'),
            ('/lifestyle_photos/basement_zinkovany.png', 'Zinkovaný regál ve sklepě')
        ]
    elif 'cern' in filename_lower or 'čern' in filename_lower:
        return [
            ('/lifestyle_photos/office_cerny.png', 'Černý regál v kanceláři'),
            ('/lifestyle_photos/living_room_cerny.png', 'Černý regál v obývacím pokoji')
        ]
    elif 'bil' in filename_lower or 'bíl' in filename_lower:
        return [
            ('/lifestyle_photos/kitchen_bily.png', 'Bílý regál v kuchyni'),
            ('/lifestyle_photos/kitchen_bily.png', 'Bílý regál v interiéru')
        ]
    elif 'modro-oran' in filename_lower or 'orangeblue' in filename_lower:
        return [
            ('/lifestyle_photos/warehouse_modro_oranzovy.png', 'Modro-oranžový regál ve skladu'),
            ('/lifestyle_photos/workshop_modro_oranzovy.png', 'Modro-oranžový regál v dílně')
        ]
    elif 'modr' in filename_lower:
        return [
            ('/lifestyle_photos/garage_modro_oranzovy.png', 'Modrý regál v garáži'),
            ('/lifestyle_photos/workshop_modro_oranzovy.png', 'Modrý regál v dílně')
        ]
    elif 'cerven' in filename_lower or 'červen' in filename_lower:
        return [
            ('/lifestyle_photos/workshop_modro_oranzovy.png', 'Červený regál v dílně'),
            ('/lifestyle_photos/warehouse_modro_oranzovy.png', 'Červený regál ve skladu')
        ]
    else:
        return [
            ('/lifestyle_photos/garage_zinkovany.png', 'Regál v garáži'),
            ('/lifestyle_photos/basement_zinkovany.png', 'Regál ve sklepě')
        ]

def create_new_gallery_html(main_image_url, lifestyle_photos, product_alt):
    """Create new gallery layout: big left, 3 small right"""

    photo1_url, photo1_alt = lifestyle_photos[0]
    photo2_url, photo2_alt = lifestyle_photos[1]

    return f'''
      <!-- New Gallery Layout: Big Left, Thumbnails Right -->
      <div class="flex gap-3">
        <!-- Main Image - Left (Large) -->
        <div class="flex-1 bg-white rounded-2xl p-4 shadow-sm">
          <img id="mainImage" src="{main_image_url}" loading="lazy" alt="{product_alt}" class="product-image w-full h-auto max-h-[500px] object-contain cursor-zoom-in" onclick="openLightbox(this.src)">
        </div>

        <!-- Thumbnails - Right (Vertical Stack) -->
        <div class="flex flex-col gap-2 w-24">
          <button onclick="changeImage('{main_image_url}')" class="thumbnail-btn aspect-square border-2 border-primary-500 rounded-lg overflow-hidden p-1 bg-white hover:shadow-md transition-all">
            <img src="{main_image_url}" alt="Produktová fotka" class="thumbnail w-full h-full object-contain">
          </button>
          <button onclick="changeImage('{photo1_url}')" class="thumbnail-btn aspect-square border-2 border-gray-200 hover:border-primary-300 rounded-lg overflow-hidden p-1 bg-white hover:shadow-md transition-all">
            <img src="{photo1_url}" alt="{photo1_alt}" class="thumbnail w-full h-full object-cover">
          </button>
          <button onclick="changeImage('{photo2_url}')" class="thumbnail-btn aspect-square border-2 border-gray-200 hover:border-primary-300 rounded-lg overflow-hidden p-1 bg-white hover:shadow-md transition-all">
            <img src="{photo2_url}" alt="{photo2_alt}" class="thumbnail w-full h-full object-cover">
          </button>
        </div>
      </div>
'''

def update_product_page(filepath):
    """Update single product page with new layout"""

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Check if it's a product page (has mainImage)
    if 'id="mainImage"' not in content:
        return False

    # Extract main image URL
    main_img_match = re.search(r'<img id="mainImage"[^>]*src="([^"]+)"', content)
    if not main_img_match:
        return False

    main_image_url = main_img_match.group(1)

    # Extract product alt text
    alt_match = re.search(r'<img id="mainImage"[^>]*alt="([^"]+)"', content)
    product_alt = alt_match.group(1) if alt_match else "Regál"

    # Get lifestyle photos for this product
    filename = os.path.basename(filepath)
    lifestyle_photos = get_lifestyle_photos_for_color(filename)

    # Create new gallery HTML
    new_gallery = create_new_gallery_html(main_image_url, lifestyle_photos, product_alt)

    # Pattern to match old gallery structure
    # Old: <div class="relative bg-white..."><img id="mainImage"...></div> + thumbnail gallery
    old_pattern = r'''<div class="relative bg-white rounded-2xl p-6 shadow-sm mb-4">\s*<img id="mainImage"[^>]+>\s*</div>\s*<!-- Thumbnail Gallery -->\s*<div class="flex gap-2 mt-4">.*?</div>'''

    # Try to replace
    new_content, count = re.subn(old_pattern, new_gallery, content, flags=re.DOTALL)

    if count == 0:
        # Try alternative pattern (without thumbnail gallery)
        alt_pattern = r'<div class="relative bg-white rounded-2xl p-6 shadow-sm mb-4">\s*<img id="mainImage"[^>]+>\s*</div>'
        new_content, count = re.subn(alt_pattern, new_gallery, content, flags=re.DOTALL)

    if count > 0:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        return True

    return False

def main():
    """Update all product pages"""

    product_dir = Path('/sessions/vigilant-confident-ptolemy/mnt/bazarovyregal-deploy')
    product_files = list(product_dir.glob('regal-*.html'))

    print(f"Found {len(product_files)} product pages")

    updated = 0
    failed = 0

    for filepath in product_files:
        try:
            if update_product_page(filepath):
                print(f"✅ {filepath.name}")
                updated += 1
            else:
                print(f"⏭️  {filepath.name} (skipped)")
        except Exception as e:
            print(f"❌ {filepath.name}: {e}")
            failed += 1

    print(f"\n{'='*50}")
    print(f"Updated: {updated}")
    print(f"Failed: {failed}")
    print(f"Total: {len(product_files)}")

if __name__ == "__main__":
    main()
