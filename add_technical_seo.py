#!/usr/bin/env python3
"""
Adds technical SEO improvements to all HTML pages:
- Canonical tags
- Preconnect/prefetch hints
- Lazy loading for images
- Improved meta tags
"""

import os
import re

output_dir = os.path.dirname(os.path.abspath(__file__))

# Preconnect hints to add
PRECONNECT_HINTS = '''
  <!-- Preconnect for performance -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preconnect" href="https://cdn.tailwindcss.com">
  <link rel="preconnect" href="https://vyprodej-regalucz.s26.cdn-upgates.com">
  <link rel="dns-prefetch" href="https://www.youtube.com">
'''

def add_canonical_and_preconnect(filepath):
    """Add canonical tag and preconnect hints to HTML file"""

    filename = os.path.basename(filepath)

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except:
        return False

    modified = False

    # Add canonical tag if not present
    if '<link rel="canonical"' not in content:
        canonical_tag = f'  <link rel="canonical" href="https://bazarovyregal.cz/{filename}">\n'
        # Insert after <meta charset>
        if '<meta charset=' in content:
            content = re.sub(
                r'(<meta charset="UTF-8">)',
                r'\1\n' + canonical_tag,
                content
            )
            modified = True

    # Add preconnect hints if not present
    if '<link rel="preconnect" href="https://vyprodej-regalucz' not in content:
        # Insert before </head>
        if '</head>' in content:
            # Check if preconnect for fonts already exists, don't duplicate
            if '<link rel="preconnect" href="https://fonts.googleapis.com">' not in content:
                content = content.replace('</head>', PRECONNECT_HINTS + '</head>')
            else:
                # Just add CDN preconnect
                cdn_preconnect = '  <link rel="preconnect" href="https://vyprodej-regalucz.s26.cdn-upgates.com">\n'
                content = content.replace('</head>', cdn_preconnect + '</head>')
            modified = True

    # Add lazy loading to images (except first/hero images)
    if 'loading="lazy"' not in content:
        # Find all img tags without loading attribute
        img_pattern = r'<img\s+([^>]*?)src="([^"]+)"([^>]*?)>'

        def add_lazy_loading(match):
            before = match.group(1)
            src = match.group(2)
            after = match.group(3)

            # Skip if already has loading attribute
            if 'loading=' in before or 'loading=' in after:
                return match.group(0)

            # Add lazy loading
            return f'<img {before}src="{src}" loading="lazy"{after}>'

        new_content = re.sub(img_pattern, add_lazy_loading, content)
        if new_content != content:
            content = new_content
            modified = True

    # Add viewport meta if missing
    if '<meta name="viewport"' not in content:
        viewport_tag = '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
        content = content.replace('<meta charset="UTF-8">', '<meta charset="UTF-8">\n' + viewport_tag)
        modified = True

    # Add theme-color meta for mobile browsers
    if '<meta name="theme-color"' not in content:
        theme_color = '  <meta name="theme-color" content="#f97316">\n'
        content = content.replace('</head>', theme_color + '</head>')
        modified = True

    if modified:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True

    return False

# Process all HTML files
print("Adding technical SEO improvements...")
count = 0

for file in os.listdir(output_dir):
    if file.endswith('.html'):
        filepath = os.path.join(output_dir, file)
        if add_canonical_and_preconnect(filepath):
            count += 1
            if count % 100 == 0:
                print(f"  Processed {count} pages...")

print(f"\n✅ Added technical SEO to {count} pages")
print("   - Canonical tags")
print("   - Preconnect hints")
print("   - Lazy loading images")
print("   - Theme color meta")
