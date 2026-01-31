#!/usr/bin/env python3
"""
Advanced SEO Optimization Script for Bazarovyregal.cz
- Adds internal linking (related articles)
- Adds breadcrumbs navigation with Schema.org
- Optimizes images for lazy loading
- Adds preload hints for critical resources
"""

import os
import re
from collections import defaultdict
from datetime import datetime

# Define category mappings for internal linking
CATEGORIES = {
    'garaz': ['garaz', 'garáž', 'auto', 'nářadí', 'dílna'],
    'sklep': ['sklep', 'sklípek', 'vinný', 'lahve', 'zavařovací'],
    'dilna': ['dílna', 'workshop', 'nářadí', 'šrouby', 'nástroje'],
    'kancelar': ['kancelář', 'office', 'archiv', 'dokumenty', 'šanon'],
    'sklad': ['sklad', 'warehouse', 'paleta', 'příhradové', 'průmysl'],
    'domacnost': ['domácnost', 'byt', 'pokoj', 'koupelna', 'kuchyň'],
    'kovove': ['kovové', 'ocelové', 'železné', 'metal', 'pozink'],
    'plastove': ['plastové', 'plast', 'lehké'],
    'drevene': ['dřevěné', 'dřevo', 'masiv', 'bambus'],
    'bazar': ['bazar', 'bazarové', 'použité', 'second hand', 'výprodej'],
    'akce': ['akce', 'sleva', 'výprodej', 'black friday', 'likvidace'],
    'navod': ['návod', 'montáž', 'jak', 'postup', 'tipy'],
}

# Breadcrumb mappings
BREADCRUMBS = {
    'index.html': [('Domů', 'index.html')],
    'katalog.html': [('Domů', 'index.html'), ('Katalog', 'katalog.html')],
    'kontakt.html': [('Domů', 'index.html'), ('Kontakt', 'kontakt.html')],
    'o-nas.html': [('Domů', 'index.html'), ('O nás', 'o-nas.html')],
    'faq.html': [('Domů', 'index.html'), ('Časté dotazy', 'faq.html')],
    'blog.html': [('Domů', 'index.html'), ('Blog', 'blog.html')],
}

def get_category_for_file(filename):
    """Determine category based on filename."""
    filename_lower = filename.lower()
    for cat, keywords in CATEGORIES.items():
        for kw in keywords:
            if kw in filename_lower:
                return cat
    return 'ostatni'

def get_breadcrumbs_for_file(filename):
    """Generate breadcrumbs based on filename."""
    if filename in BREADCRUMBS:
        return BREADCRUMBS[filename]

    # For product pages (regal-*.html)
    if filename.startswith('regal-'):
        return [
            ('Domů', 'index.html'),
            ('Katalog', 'katalog.html'),
            ('Produkt', filename)
        ]

    # For article pages - determine category
    category = get_category_for_file(filename)
    category_names = {
        'garaz': 'Regály do garáže',
        'sklep': 'Regály do sklepa',
        'dilna': 'Regály do dílny',
        'kancelar': 'Kancelářské regály',
        'sklad': 'Skladové regály',
        'domacnost': 'Regály pro domácnost',
        'kovove': 'Kovové regály',
        'plastove': 'Plastové regály',
        'drevene': 'Dřevěné regály',
        'bazar': 'Bazarové regály',
        'akce': 'Akce a slevy',
        'navod': 'Návody',
        'ostatni': 'Články'
    }

    return [
        ('Domů', 'index.html'),
        (category_names.get(category, 'Články'), 'blog.html'),
        ('Článek', filename)
    ]

def generate_breadcrumbs_html(breadcrumbs):
    """Generate HTML for breadcrumbs navigation."""
    items = []
    for i, (name, url) in enumerate(breadcrumbs):
        is_last = i == len(breadcrumbs) - 1
        if is_last:
            items.append(f'<span class="text-gray-500">{name}</span>')
        else:
            items.append(f'<a href="{url}" class="text-primary-500 hover:text-primary-600 hover:underline">{name}</a>')

    separator = ' <span class="text-gray-400 mx-2">›</span> '
    html = f'''
<!-- Breadcrumbs Navigation -->
<nav aria-label="Breadcrumb" class="bg-gray-100 py-3 px-4">
  <div class="container mx-auto">
    <ol class="flex items-center text-sm">
      {separator.join(items)}
    </ol>
  </div>
</nav>
'''
    return html

def generate_breadcrumbs_schema(breadcrumbs, base_url='https://bazarovyregal.cz'):
    """Generate Schema.org JSON-LD for breadcrumbs."""
    items = []
    for i, (name, url) in enumerate(breadcrumbs):
        items.append({
            "@type": "ListItem",
            "position": i + 1,
            "name": name,
            "item": f"{base_url}/{url}" if not url.startswith('http') else url
        })

    schema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": items
    }

    import json
    return f'<script type="application/ld+json">{json.dumps(schema, ensure_ascii=False)}</script>'

def find_related_articles(filename, all_files):
    """Find related articles based on category and keywords."""
    current_category = get_category_for_file(filename)
    related = []

    # Get files in same category
    for f in all_files:
        if f == filename or not f.endswith('.html'):
            continue
        if f.startswith('regal-'):  # Skip product pages
            continue
        if f in ['index.html', 'katalog.html', 'kontakt.html', 'o-nas.html', 'faq.html', 'blog.html']:
            continue

        f_category = get_category_for_file(f)
        if f_category == current_category:
            related.append((f, 1.0))  # High relevance
        elif any(kw in f.lower() for kw in filename.lower().replace('.html', '').split('-')):
            related.append((f, 0.5))  # Partial match

    # Sort by relevance and return top 6
    related.sort(key=lambda x: x[1], reverse=True)
    return [f for f, _ in related[:6]]

def generate_related_articles_html(related_files):
    """Generate HTML for related articles section."""
    if not related_files:
        return ''

    articles_html = []
    for f in related_files[:6]:
        title = f.replace('.html', '').replace('-', ' ').title()
        # Truncate long titles
        if len(title) > 50:
            title = title[:47] + '...'
        articles_html.append(f'''
      <a href="{f}" class="group block bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all border border-gray-100">
        <h4 class="font-semibold text-gray-800 group-hover:text-primary-500 transition-colors line-clamp-2">{title}</h4>
        <span class="text-primary-500 text-sm mt-2 inline-flex items-center">
          Číst více →
        </span>
      </a>
''')

    return f'''
<!-- Related Articles -->
<section class="mt-12 py-8 bg-gray-50 rounded-2xl">
  <div class="container mx-auto px-6">
    <h3 class="text-2xl font-bold text-gray-900 mb-6">📚 Související články</h3>
    <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {''.join(articles_html)}
    </div>
  </div>
</section>
'''

def generate_popular_products_html():
    """Generate HTML for popular products sidebar."""
    return '''
<!-- Popular Products Widget -->
<aside class="bg-gradient-to-br from-primary-50 to-orange-50 rounded-2xl p-6 mt-8">
  <h3 class="text-xl font-bold text-gray-900 mb-4">🔥 Nejprodávanější regály</h3>
  <div class="space-y-4">
    <a href="regal-180x90x40-cerna.html" class="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm hover:shadow-md transition group">
      <div class="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-2xl">🏷️</div>
      <div>
        <div class="font-semibold text-gray-800 group-hover:text-primary-500">Regál 180×90×40 cm</div>
        <div class="text-sm text-gray-500">Černý, 5 polic</div>
        <div class="text-primary-600 font-bold">899 Kč</div>
      </div>
    </a>
    <a href="regal-150x70x30-zinkovany.html" class="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm hover:shadow-md transition group">
      <div class="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-2xl">⭐</div>
      <div>
        <div class="font-semibold text-gray-800 group-hover:text-primary-500">Regál 150×70×30 cm</div>
        <div class="text-sm text-gray-500">Zinkovaný, 4 police</div>
        <div class="text-primary-600 font-bold">649 Kč</div>
      </div>
    </a>
    <a href="katalog.html" class="block text-center py-3 bg-primary-500 text-white rounded-xl font-semibold hover:bg-primary-600 transition">
      Zobrazit všechny regály →
    </a>
  </div>
</aside>
'''

def add_lazy_loading(html_content):
    """Add lazy loading to images."""
    # Add loading="lazy" to images that don't have it
    html_content = re.sub(
        r'<img(?![^>]*loading=)([^>]*)(src=["\'][^"\']+["\'])([^>]*)>',
        r'<img\1\2 loading="lazy"\3>',
        html_content
    )
    return html_content

def add_preload_hints(html_content):
    """Add preload hints for critical resources."""
    preload_hints = '''
  <!-- Preload Critical Resources -->
  <link rel="preload" href="https://cdn.tailwindcss.com" as="script">
  <link rel="dns-prefetch" href="https://fonts.googleapis.com">
  <link rel="dns-prefetch" href="https://fonts.gstatic.com">
  <link rel="dns-prefetch" href="https://vyprodej-regalucz.s26.cdn-upgates.com">
'''

    # Add after <head> tag if not already present
    if 'rel="preload"' not in html_content:
        html_content = html_content.replace('<head>', f'<head>{preload_hints}', 1)

    return html_content

def process_html_file(filepath, all_files):
    """Process a single HTML file with all SEO improvements."""
    filename = os.path.basename(filepath)

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    # Skip if already processed
    if 'aria-label="Breadcrumb"' in content:
        print(f"  Skipping {filename} - already processed")
        return False

    # 1. Add breadcrumbs after header
    breadcrumbs = get_breadcrumbs_for_file(filename)
    breadcrumbs_html = generate_breadcrumbs_html(breadcrumbs)
    breadcrumbs_schema = generate_breadcrumbs_schema(breadcrumbs)

    # Add schema to head
    content = content.replace('</head>', f'{breadcrumbs_schema}\n</head>')

    # Add breadcrumbs HTML after header (look for </header>)
    if '</header>' in content:
        content = content.replace('</header>', f'</header>\n{breadcrumbs_html}')

    # 2. Add related articles for article pages (not products, not main pages)
    if not filename.startswith('regal-') and filename not in ['index.html', 'katalog.html', 'kontakt.html', 'o-nas.html', 'faq.html', 'blog.html']:
        related = find_related_articles(filename, all_files)
        if related:
            related_html = generate_related_articles_html(related)
            # Add before footer
            if '<footer' in content:
                content = re.sub(r'(<footer)', f'{related_html}\n\\1', content, count=1)

    # 3. Add lazy loading to images
    content = add_lazy_loading(content)

    # 4. Add preload hints
    content = add_preload_hints(content)

    # Save if changed
    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True

    return False

def main():
    base_dir = '/sessions/modest-sweet-allen/mnt/Downloads/bazarovyregal-deploy'

    # Get all HTML files
    all_files = [f for f in os.listdir(base_dir) if f.endswith('.html')]
    print(f"Found {len(all_files)} HTML files")

    processed = 0
    skipped = 0

    for filename in sorted(all_files):
        filepath = os.path.join(base_dir, filename)
        print(f"Processing {filename}...")

        if process_html_file(filepath, all_files):
            processed += 1
        else:
            skipped += 1

    print(f"\n✅ Done! Processed: {processed}, Skipped: {skipped}")

if __name__ == '__main__':
    main()
