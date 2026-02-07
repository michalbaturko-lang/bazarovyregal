#!/usr/bin/env python3
"""
Master pSEO generator for Bazarovyregal.cz
Combines all 12 playbook modules, generates HTML files, and updates sitemap.
"""

import os
import sys
import json
from datetime import datetime

from pseo_config import BASE_URL, EXISTING_PAGES
from pseo_html_template import wrap_page

# Import all playbook generators
from pseo_playbooks_part1 import generate_location_pages, generate_persona_pages, generate_glossary_pages
from pseo_playbooks_part2 import generate_comparison_pages, generate_curation_pages, generate_template_pages
from pseo_playbooks_part3 import generate_example_pages, generate_directory_pages, generate_profile_pages


def validate_pages(pages):
    """Validate generated pages: no duplicate slugs, no thin content, minimum links."""
    seen_slugs = set()
    valid = []
    skipped = []

    for p in pages:
        slug = p["slug"]

        # Check duplicate slug
        if slug in seen_slugs:
            skipped.append((slug, "DUPLICATE_SLUG"))
            continue
        seen_slugs.add(slug)

        # Check minimum content length (rough word count from HTML)
        body = p.get("body_html", "")
        word_count = len(body.split())
        min_words = 200 if p.get("playbook_type") in ("directory", "conversions") else 300

        if word_count < min_words:
            skipped.append((slug, f"THIN_CONTENT ({word_count} words, min {min_words})"))
            continue

        # Check required fields
        if not p.get("title") or not p.get("h1") or not p.get("meta_desc"):
            skipped.append((slug, "MISSING_FIELDS"))
            continue

        valid.append(p)

    return valid, skipped


def generate_html_files(pages, output_dir):
    """Generate HTML files from page data."""
    generated = []
    for p in pages:
        html = wrap_page(
            slug=p["slug"],
            title=p["title"],
            meta_desc=p["meta_desc"],
            h1=p["h1"],
            body_html=p["body_html"],
            breadcrumb_category=p.get("breadcrumb_category", "Regaly"),
            schema_json=p.get("schema_json", ""),
            canonical_url=p.get("canonical_url", ""),
        )
        filepath = os.path.join(output_dir, f"{p['slug']}.html")
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(html)
        generated.append(p["slug"])
    return generated


def update_sitemap(new_slugs, output_dir):
    """Read existing sitemap, add new URLs, write updated sitemap."""
    sitemap_path = os.path.join(output_dir, "sitemap.xml")
    now = datetime.now().strftime("%Y-%m-%d")

    # Read existing sitemap to get existing URLs
    existing_urls = set()
    if os.path.exists(sitemap_path):
        with open(sitemap_path, "r", encoding="utf-8") as f:
            content = f.read()
            import re
            for m in re.finditer(r"<loc>(.*?)</loc>", content):
                existing_urls.add(m.group(1))

    # Build new sitemap
    sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n'
    sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

    # Keep all existing URLs
    for url in sorted(existing_urls):
        sitemap += f"  <url>\n"
        sitemap += f"    <loc>{url}</loc>\n"
        sitemap += f"    <lastmod>{now}</lastmod>\n"
        sitemap += f"    <changefreq>weekly</changefreq>\n"
        sitemap += f"    <priority>0.7</priority>\n"
        sitemap += f"  </url>\n"

    # Add new pSEO URLs
    added = 0
    for slug in sorted(new_slugs):
        url = f"{BASE_URL}/{slug}.html"
        if url not in existing_urls:
            sitemap += f"  <url>\n"
            sitemap += f"    <loc>{url}</loc>\n"
            sitemap += f"    <lastmod>{now}</lastmod>\n"
            sitemap += f"    <changefreq>weekly</changefreq>\n"
            sitemap += f"    <priority>0.7</priority>\n"
            sitemap += f"  </url>\n"
            added += 1

    sitemap += "</urlset>\n"

    with open(sitemap_path, "w", encoding="utf-8") as f:
        f.write(sitemap)

    return len(existing_urls), added


def generate_report(valid, skipped, generated, existing_count, added_count):
    """Print generation report."""
    print("\n" + "=" * 60)
    print("  PSEO GENERATION REPORT - Bazarovyregal.cz")
    print("=" * 60)

    # Count by playbook type
    by_type = {}
    for p in valid:
        t = p.get("playbook_type", "unknown")
        by_type[t] = by_type.get(t, 0) + 1

    print(f"\n  Pages generated: {len(generated)}")
    print(f"  Pages skipped:   {len(skipped)}")
    print(f"\n  By playbook type:")
    for t, count in sorted(by_type.items()):
        print(f"    {t:<20} {count:>3} pages")

    print(f"\n  Sitemap:")
    print(f"    Existing URLs:  {existing_count}")
    print(f"    New URLs added: {added_count}")
    print(f"    Total URLs:     {existing_count + added_count}")

    if skipped:
        print(f"\n  Skipped pages:")
        for slug, reason in skipped:
            print(f"    {slug}: {reason}")

    print("\n" + "=" * 60)


def main():
    output_dir = os.path.dirname(os.path.abspath(__file__))

    print("Generating pSEO pages for Bazarovyregal.cz...")
    print("=" * 50)

    # Collect all pages from all playbooks
    all_pages = []

    print("\n[1/9] Generating Location pages...")
    pages = generate_location_pages()
    print(f"       -> {len(pages)} pages")
    all_pages.extend(pages)

    print("[2/9] Generating Persona pages...")
    pages = generate_persona_pages()
    print(f"       -> {len(pages)} pages")
    all_pages.extend(pages)

    print("[3/9] Generating Glossary pages...")
    pages = generate_glossary_pages()
    print(f"       -> {len(pages)} pages")
    all_pages.extend(pages)

    print("[4/9] Generating Comparison pages...")
    pages = generate_comparison_pages()
    print(f"       -> {len(pages)} pages")
    all_pages.extend(pages)

    print("[5/9] Generating Curation pages...")
    pages = generate_curation_pages()
    print(f"       -> {len(pages)} pages")
    all_pages.extend(pages)

    print("[6/9] Generating Template pages...")
    pages = generate_template_pages()
    print(f"       -> {len(pages)} pages")
    all_pages.extend(pages)

    print("[7/9] Generating Example pages...")
    pages = generate_example_pages()
    print(f"       -> {len(pages)} pages")
    all_pages.extend(pages)

    print("[8/9] Generating Directory pages...")
    pages = generate_directory_pages()
    print(f"       -> {len(pages)} pages")
    all_pages.extend(pages)

    print("[9/9] Generating Profile pages...")
    pages = generate_profile_pages()
    print(f"       -> {len(pages)} pages")
    all_pages.extend(pages)

    print(f"\nTotal raw pages: {len(all_pages)}")

    # Validate
    print("\nValidating pages...")
    valid, skipped = validate_pages(all_pages)
    print(f"  Valid: {len(valid)}, Skipped: {len(skipped)}")

    # Generate HTML files
    print("\nGenerating HTML files...")
    generated = generate_html_files(valid, output_dir)
    print(f"  Written: {len(generated)} files")

    # Update sitemap
    print("\nUpdating sitemap.xml...")
    existing_count, added_count = update_sitemap(generated, output_dir)

    # Report
    generate_report(valid, skipped, generated, existing_count, added_count)

    # Write manifest JSON for tracking
    manifest = {
        "generated_at": datetime.now().isoformat(),
        "total_pages": len(generated),
        "pages": [
            {"slug": p["slug"], "type": p.get("playbook_type", ""), "title": p["title"]}
            for p in valid
        ],
    }
    manifest_path = os.path.join(output_dir, "pseo_manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f"\nManifest written to: pseo_manifest.json")


if __name__ == "__main__":
    main()
