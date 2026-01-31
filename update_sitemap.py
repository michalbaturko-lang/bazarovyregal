#!/usr/bin/env python3
"""
Updates sitemap.xml with all HTML pages
"""

import os
from datetime import datetime

output_dir = os.path.dirname(os.path.abspath(__file__))

# Collect all HTML files
pages = []

for file in os.listdir(output_dir):
    if file.endswith('.html'):
        pages.append(file)

# Sort pages - priority order
def get_priority(filename):
    if filename == 'index.html':
        return (0, '1.0', filename)
    elif filename == 'katalog.html':
        return (1, '0.9', filename)
    elif filename.startswith('regaly-') and not filename.startswith('regal-'):  # city pages
        return (2, '0.8', filename)
    elif filename.startswith('regal-'):  # product pages
        return (3, '0.8', filename)
    elif filename in ['o-nas.html', 'kontakt.html', 'faq.html']:
        return (4, '0.7', filename)
    else:  # SEO articles
        return (5, '0.6', filename)

pages_sorted = sorted(pages, key=get_priority)

# Generate sitemap
today = datetime.now().strftime('%Y-%m-%d')

sitemap = '''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
'''

for filename in pages_sorted:
    priority_data = get_priority(filename)
    priority = priority_data[1]
    changefreq = 'daily' if priority_data[0] <= 2 else 'weekly'

    sitemap += f'''  <url>
    <loc>https://bazarovyregal.cz/{filename}</loc>
    <lastmod>{today}</lastmod>
    <changefreq>{changefreq}</changefreq>
    <priority>{priority}</priority>
  </url>
'''

sitemap += '</urlset>'

# Write sitemap
sitemap_path = os.path.join(output_dir, 'sitemap.xml')
with open(sitemap_path, 'w', encoding='utf-8') as f:
    f.write(sitemap)

print(f"✅ Updated sitemap.xml with {len(pages)} pages")
print(f"   - Core pages: {sum(1 for p in pages if get_priority(p)[0] <= 1)}")
print(f"   - City pages: {sum(1 for p in pages if p.startswith('regaly-') and not p.startswith('regal-'))}")
print(f"   - Product pages: {sum(1 for p in pages if p.startswith('regal-'))}")
print(f"   - SEO articles: {sum(1 for p in pages if get_priority(p)[0] == 5)}")
