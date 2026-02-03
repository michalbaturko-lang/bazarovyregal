#!/usr/bin/env python3
"""Add favicon to all HTML files"""
import os
import re

FAVICON_LINK = '  <link rel="icon" type="image/svg+xml" href="/favicon.svg">\n'

def add_favicon(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Check if favicon already exists
    if 'rel="icon"' in content or "rel='icon'" in content:
        return False

    # Add after <meta charset="UTF-8">
    if '<meta charset="UTF-8">' in content:
        content = content.replace(
            '<meta charset="UTF-8">',
            '<meta charset="UTF-8">\n' + FAVICON_LINK.strip()
        )
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

count = 0
for filename in os.listdir('.'):
    if filename.endswith('.html'):
        if add_favicon(filename):
            count += 1
            print(f"✅ {filename}")

print(f"\n📊 Favicon přidán do {count} souborů")
