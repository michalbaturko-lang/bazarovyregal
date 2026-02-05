#!/usr/bin/env python3
"""
Fix duplicate menu issue - remove the old inline menu and keep only the unified navigation
"""

import os
import re
import glob

# The correct unified navigation menu
UNIFIED_NAV = '''    <nav class="hidden md:flex gap-4 text-sm font-medium text-gray-600">
      <a href="index.html" class="hover:text-primary-500">🏠 Úvod</a>
      <a href="katalog.html" class="hover:text-primary-500">📦 Všechny regály</a>
      <a href="regaly-do-garaze.html" class="hover:text-primary-500">🚗 Do garáže</a>
      <a href="regaly-do-sklepa.html" class="hover:text-primary-500">🏚️ Do sklepa</a>
      <a href="blog.html" class="hover:text-primary-500">📝 Blog</a>
      <a href="slovnik.html" class="hover:text-primary-500">📖 Slovník</a>
      <a href="katalog.html" class="text-red-600 font-semibold hover:text-red-700">🔥 VÝPRODEJ</a>
    </nav>'''

def fix_html_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # Pattern to match the old inline menu (O nás, FAQ, Kontakt version)
    old_menu_pattern = r'<nav class="hidden md:flex gap-4 text-sm font-medium text-gray-600">\s*<a href="index\.html"[^>]*>🏠 Úvod</a>\s*<a href="katalog\.html"[^>]*>📦 Všechny regály</a>\s*<a href="o-nas\.html"[^>]*>ℹ️ O nás</a>\s*<a href="faq\.html"[^>]*>❓ FAQ</a>\s*<a href="kontakt\.html"[^>]*>📧 Kontakt</a>\s*</nav>'

    # Replace old menu with unified one
    content = re.sub(old_menu_pattern, UNIFIED_NAV, content, flags=re.DOTALL)

    # Remove the duplicate navigation section that was added below header
    # Pattern: <!-- Navigation Menu --> ... </nav> </div> </div>
    dup_nav_pattern = r'\s*<!-- Navigation Menu -->\s*<div class="bg-white border-b">\s*<div class="container mx-auto px-4">\s*<nav class="flex gap-1 pb-3 overflow-x-auto">.*?</nav>\s*</div>\s*</div>'
    content = re.sub(dup_nav_pattern, '', content, flags=re.DOTALL)

    # Also remove duplicate breadcrumb if present (keep only one)
    # We have two breadcrumbs - keep the second one (more detailed) and remove the first
    first_breadcrumb_pattern = r'\s*<!-- Breadcrumbs Navigation -->\s*<nav aria-label="Breadcrumb" class="bg-gray-100 py-3 px-4">.*?</nav>'
    content = re.sub(first_breadcrumb_pattern, '', content, flags=re.DOTALL)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def main():
    html_files = glob.glob('*.html')
    fixed = 0

    for filepath in html_files:
        if fix_html_file(filepath):
            print(f"Fixed: {filepath}")
            fixed += 1

    print(f"\nTotal fixed: {fixed} files")

if __name__ == '__main__':
    main()
