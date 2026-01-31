#!/usr/bin/env python3
"""
Fix all Vercel URLs to use the proper domain bazarovyregal.cz
"""
import os
import re
from pathlib import Path

def fix_urls_in_file(filepath):
    """Replace all vercel.app URLs with bazarovyregal.cz"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        original_content = content

        # Replace all variations of vercel URLs
        replacements = [
            ('https://bazarovyregal.vercel.app', 'https://www.bazarovyregal.cz'),
            ('http://bazarovyregal.vercel.app', 'https://www.bazarovyregal.cz'),
            ('bazarovyregal.vercel.app', 'www.bazarovyregal.cz'),
            # Also fix any non-www versions to www for consistency
            ('https://bazarovyregal.cz/', 'https://www.bazarovyregal.cz/'),
            ('http://bazarovyregal.cz/', 'https://www.bazarovyregal.cz/'),
        ]

        for old, new in replacements:
            content = content.replace(old, new)

        if content != original_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        return False
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False

def main():
    project_dir = Path(__file__).parent

    # File types to process
    extensions = ['.html', '.xml', '.txt', '.json', '.js', '.css']

    fixed_count = 0
    total_count = 0

    for ext in extensions:
        for filepath in project_dir.glob(f'*{ext}'):
            total_count += 1
            if fix_urls_in_file(filepath):
                fixed_count += 1
                print(f"✓ Fixed: {filepath.name}")

    print(f"\n{'='*50}")
    print(f"HOTOVO! Opraveno {fixed_count} z {total_count} souborů")
    print(f"{'='*50}")

    # Verify robots.txt
    robots_path = project_dir / 'robots.txt'
    if robots_path.exists():
        with open(robots_path, 'r') as f:
            content = f.read()
        if 'www.bazarovyregal.cz' in content:
            print("✓ robots.txt: OK")
        else:
            print("✗ robots.txt: CHYBA - chybí správná doména")

    # Verify sitemap.xml
    sitemap_path = project_dir / 'sitemap.xml'
    if sitemap_path.exists():
        with open(sitemap_path, 'r') as f:
            content = f.read()
        if 'vercel' in content.lower():
            print("✗ sitemap.xml: CHYBA - obsahuje vercel odkazy")
        elif 'www.bazarovyregal.cz' in content:
            print("✓ sitemap.xml: OK")
        else:
            print("? sitemap.xml: Zkontrolujte ručně")

if __name__ == '__main__':
    main()
