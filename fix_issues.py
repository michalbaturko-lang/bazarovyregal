#!/usr/bin/env python3
"""Fix 3 issues: lifestyle photos, diacritics, unified menu"""
import os
import re
from pathlib import Path

BASE_DIR = Path('/sessions/vigilant-confident-ptolemy/mnt/bazarovyregal-deploy')

# Standardní menu pro všechny stránky
STANDARD_MENU = '''    <nav class="flex gap-1 pb-3 overflow-x-auto">
      <a href="index.html" class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-primary-500 hover:bg-primary-50 rounded-lg whitespace-nowrap transition-colors">🏠 Úvod</a>
      <a href="katalog.html" class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-primary-500 hover:bg-primary-50 rounded-lg whitespace-nowrap transition-colors">📦 Všechny regály</a>
      <a href="regaly-do-garaze.html" class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-primary-500 hover:bg-primary-50 rounded-lg whitespace-nowrap transition-colors">🚗 Do garáže</a>
      <a href="regaly-do-sklepa.html" class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-primary-500 hover:bg-primary-50 rounded-lg whitespace-nowrap transition-colors">🏚️ Do sklepa</a>
      <a href="blog.html" class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-primary-500 hover:bg-primary-50 rounded-lg whitespace-nowrap transition-colors">📝 Blog</a>
      <a href="slovnik.html" class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-primary-500 hover:bg-primary-50 rounded-lg whitespace-nowrap transition-colors">📖 Slovník</a>
      <a href="katalog.html" class="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg whitespace-nowrap flex items-center gap-1">
        🔥 <span>VÝPRODEJ</span>
      </a>
    </nav>'''

# Mapování barev na lifestyle fotky
COLOR_LIFESTYLE_MAP = {
    'zinkovany': [
        ('/lifestyle_photos/garage_zinkovany.png', 'Zinkovaný regál v garáži'),
        ('/lifestyle_photos/basement_zinkovany.png', 'Zinkovaný regál ve sklepě'),
    ],
    'cerna': [
        ('/lifestyle_photos/office_cerny.png', 'Černý regál v kanceláři'),
        ('/lifestyle_photos/living_room_cerny.png', 'Černý regál v obýváku'),
    ],
    'bila': [
        ('/lifestyle_photos/kitchen_bily.png', 'Bílý regál v kuchyni'),
        ('/lifestyle_photos/kitchen_bily.png', 'Bílý regál v prádelně'),
    ],
    'modro-oranzovy': [
        ('/lifestyle_photos/garage_modro_oranzovy.png', 'Profesionální regál v garáži'),
        ('/lifestyle_photos/workshop_modro_oranzovy.png', 'Profesionální regál v dílně'),
    ],
    'profesionalni': [
        ('/lifestyle_photos/garage_modro_oranzovy.png', 'Profesionální regál v garáži'),
        ('/lifestyle_photos/workshop_modro_oranzovy.png', 'Profesionální regál v dílně'),
    ],
    'cervena': [
        ('/lifestyle_photos/garage_modro_oranzovy.png', 'Červený regál v garáži'),
        ('/lifestyle_photos/warehouse_modro_oranzovy.png', 'Červený regál ve skladu'),
    ],
    'modra': [
        ('/lifestyle_photos/garage_modro_oranzovy.png', 'Modrý regál v garáži'),
        ('/lifestyle_photos/workshop_modro_oranzovy.png', 'Modrý regál v dílně'),
    ],
}

def get_color_from_filename(filename):
    """Zjistí barvu z názvu souboru"""
    name = filename.lower()
    if 'profesionalni' in name or 'modro-oranzov' in name:
        return 'profesionalni'
    elif 'cern' in name:
        return 'cerna'
    elif 'bil' in name:
        return 'bila'
    elif 'cerven' in name:
        return 'cervena'
    elif 'modr' in name and 'oranz' not in name:
        return 'modra'
    else:
        return 'zinkovany'

def fix_lifestyle_photos(content, color):
    """Opraví lifestyle fotky podle barvy produktu"""
    photos = COLOR_LIFESTYLE_MAP.get(color, COLOR_LIFESTYLE_MAP['zinkovany'])

    # Najdi thumbnail sekci a nahraď lifestyle fotky
    # Pattern pro druhou thumbnail button (první lifestyle foto)
    pattern1 = r"(<button onclick=\"changeImage\('/lifestyle_photos/)[^']+('.*?alt=\")[^\"]+(\".+?<img src=\"/lifestyle_photos/)[^\"]+(\".+?alt=\")[^\"]+(\".+?</button>)"

    # Hledáme všechny lifestyle photo buttony
    lifestyle_pattern = r'<button onclick="changeImage\(\'/lifestyle_photos/[^\']+\'\)"[^>]*>.*?<img src="/lifestyle_photos/[^"]+"[^>]*alt="[^"]+"[^>]*>.*?</button>'

    matches = list(re.finditer(lifestyle_pattern, content, re.DOTALL))

    if len(matches) >= 2:
        # Máme 2 lifestyle buttony, nahradíme je
        for i, match in enumerate(matches):
            if i < len(photos):
                photo_url, photo_alt = photos[i]
                new_button = f'''<button onclick="changeImage('{photo_url}')" class="thumbnail-btn aspect-square border-2 border-gray-200 hover:border-primary-300 rounded-lg overflow-hidden p-1 bg-white hover:shadow-md transition-all">
            <img src="{photo_url}" alt="{photo_alt}" class="thumbnail w-full h-full object-cover">
          </button>'''
                content = content[:match.start()] + new_button + content[match.end():]
                # Přepočítat pozice pro další match
                matches = list(re.finditer(lifestyle_pattern, content, re.DOTALL))

    return content

def fix_menu(content):
    """Nahradí staré menu novým standardním menu"""
    # Pattern pro staré menu v product pages
    old_menu_pattern = r'<nav class="hidden md:flex gap-4[^>]*>.*?</nav>'

    if re.search(old_menu_pattern, content, re.DOTALL):
        # Toto je product page s jiným menu - nahradíme celou header sekci
        pass

    # Najdi nav element s menu odkazy
    nav_pattern = r'<nav class="flex gap-1 pb-3[^"]*">\s*.*?</nav>'
    if re.search(nav_pattern, content, re.DOTALL):
        content = re.sub(nav_pattern, STANDARD_MENU, content, flags=re.DOTALL)

    return content

def fix_diacritics(content):
    """Opraví chybějící diakritiku"""
    replacements = {
        'souvisejici': 'související',
        'Souvisejici': 'Související',
        'clanky': 'články',
        'Clanky': 'Články',
        'clanek': 'článek',
        'Clanek': 'Článek',
        'moznosti': 'možnosti',
        'Moznosti': 'Možnosti',
        'dulezite': 'důležité',
        'Dulezite': 'Důležité',
        'nabidka': 'nabídka',
        'Nabidka': 'Nabídka',
        'vice': 'více',
        'Vice': 'Více',
        'nize': 'níže',
        'Nize': 'Níže',
        'ceny': 'ceny',  # OK
        'kvalita': 'kvalita',  # OK
        'zaruka': 'záruka',
        'Zaruka': 'Záruka',
        'sluzby': 'služby',
        'Sluzby': 'Služby',
        'bezpecnost': 'bezpečnost',
        'Bezpecnost': 'Bezpečnost',
    }

    for wrong, correct in replacements.items():
        # Pouze celá slova (ne části slov)
        content = re.sub(r'\b' + wrong + r'\b', correct, content)

    return content

def add_standard_menu_to_product_pages(content):
    """Přidá standardní navigační lištu do product pages"""
    # Pokud stránka nemá standardní menu, přidáme ho
    if 'flex gap-1 pb-3' not in content and '<header' in content:
        # Najdeme konec header sekce a přidáme menu
        header_end = content.find('</header>')
        if header_end > 0:
            # Přidáme menu nav před breadcrumbs
            menu_section = f'''
  <!-- Navigation Menu -->
  <div class="bg-white border-b">
    <div class="container mx-auto px-4">
{STANDARD_MENU}
    </div>
  </div>
'''
            content = content[:header_end + 9] + menu_section + content[header_end + 9:]

    return content

def process_file(filepath):
    """Zpracuje jeden soubor"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    filename = filepath.name

    # 1. Oprav diakritiku
    content = fix_diacritics(content)

    # 2. Oprav menu (přidej standardní menu do product pages)
    if filename.startswith('regal-'):
        content = add_standard_menu_to_product_pages(content)
        # 3. Oprav lifestyle fotky podle barvy
        color = get_color_from_filename(filename)
        content = fix_lifestyle_photos(content, color)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def main():
    html_files = list(BASE_DIR.glob('*.html'))
    modified = 0

    for filepath in html_files:
        if process_file(filepath):
            print(f"✓ Opraveno: {filepath.name}")
            modified += 1

    print(f"\n=== Celkem opraveno: {modified} souborů ===")

if __name__ == '__main__':
    main()
