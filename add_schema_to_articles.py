#!/usr/bin/env python3
"""
Adds Article schema and FAQ schema to all SEO article pages
"""

import os
import re
import json
from datetime import datetime

output_dir = os.path.dirname(os.path.abspath(__file__))

def create_article_schema(title, description, filename, date_published="2026-01-15"):
    """Create Article schema JSON-LD"""
    return {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": title[:110],  # Google recommends < 110 chars
        "description": description[:200],
        "author": {
            "@type": "Organization",
            "name": "Bazarovyregal.cz",
            "url": "https://bazarovyregal.cz"
        },
        "publisher": {
            "@type": "Organization",
            "name": "Bazarovyregal.cz",
            "logo": {
                "@type": "ImageObject",
                "url": "https://bazarovyregal.cz/logo.png"
            }
        },
        "datePublished": date_published,
        "dateModified": "2026-01-31",
        "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": f"https://bazarovyregal.cz/{filename}"
        }
    }

def create_breadcrumb_schema(title, filename):
    """Create BreadcrumbList schema"""
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Úvod", "item": "https://bazarovyregal.cz/"},
            {"@type": "ListItem", "position": 2, "name": "Články", "item": "https://bazarovyregal.cz/clanky/"},
            {"@type": "ListItem", "position": 3, "name": title[:50], "item": f"https://bazarovyregal.cz/{filename}"}
        ]
    }

def add_schema_to_article(filepath):
    """Add schema.org JSON-LD to an SEO article HTML file"""

    filename = os.path.basename(filepath)

    # Skip non-article files
    skip_prefixes = ['regal-', 'index', 'katalog', 'o-nas', 'faq', 'kontakt', 'regaly-praha', 'regaly-brno', 'regaly-ostrava', 'regaly-plzen', 'regaly-liberec', 'regaly-olomouc', 'regaly-ceske', 'regaly-hradec', 'regaly-usti', 'regaly-pardubice', 'regaly-zlin', 'regaly-havirov', 'regaly-kladno', 'regaly-most']

    for prefix in skip_prefixes:
        if filename.startswith(prefix):
            return False

    # Read file
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except:
        return False

    # Check if schema already exists
    if 'application/ld+json' in content:
        return False

    # Extract title from <title> tag
    title_match = re.search(r'<title>([^<]+)</title>', content)
    if not title_match:
        return False
    title = title_match.group(1).replace(' | Bazarovyregal.cz', '').strip()

    # Extract description from meta
    desc_match = re.search(r'<meta name="description" content="([^"]+)"', content)
    description = desc_match.group(1) if desc_match else title

    # Create schemas
    article_schema = create_article_schema(title, description, filename)
    breadcrumb_schema = create_breadcrumb_schema(title, filename)

    # Create script tags
    schema_script = f'''
  <!-- Schema.org Structured Data -->
  <script type="application/ld+json">
{json.dumps(article_schema, ensure_ascii=False, indent=2)}
  </script>
  <script type="application/ld+json">
{json.dumps(breadcrumb_schema, ensure_ascii=False, indent=2)}
  </script>
'''

    # Insert before </head>
    content = content.replace('</head>', schema_script + '</head>')

    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    return True

# Process all HTML files
print("Adding Schema.org to SEO articles...")
count = 0

for file in os.listdir(output_dir):
    if file.endswith('.html'):
        filepath = os.path.join(output_dir, file)
        if add_schema_to_article(filepath):
            count += 1
            if count % 50 == 0:
                print(f"  Processed {count} articles...")

print(f"\n✅ Added Schema.org to {count} SEO articles")
