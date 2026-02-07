#!/usr/bin/env python3
"""
Master pSEO generator for Bazarovyregal.cz
Combines all 12 playbook modules, generates HTML files, and updates sitemap.
"""

import os
import sys
import json
from datetime import datetime

from pseo_config import BASE_URL, EXISTING_PAGES, PRODUCTS
from pseo_html_template import wrap_page, build_schema_json

# Import all playbook generators
from pseo_playbooks_part1 import generate_location_pages, generate_persona_pages, generate_glossary_pages
from pseo_playbooks_part2 import generate_comparison_pages, generate_curation_pages, generate_template_pages
from pseo_playbooks_part3 import generate_example_pages, generate_directory_pages, generate_profile_pages
from pseo_playbooks_part4 import generate_conversion_pages, generate_translation_pages, generate_integration_pages


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
    """Generate HTML files from page data with JSON-LD schema."""
    generated = []
    for p in pages:
        # Auto-generate schema markup
        schema = build_schema_json(
            slug=p["slug"],
            title=p["title"],
            meta_desc=p["meta_desc"],
            h1=p["h1"],
            breadcrumb_category=p.get("breadcrumb_category", "Regaly"),
            playbook_type=p.get("playbook_type", ""),
            products=PRODUCTS if p.get("playbook_type") == "conversions" else None,
        )
        html = wrap_page(
            slug=p["slug"],
            title=p["title"],
            meta_desc=p["meta_desc"],
            h1=p["h1"],
            body_html=p["body_html"],
            breadcrumb_category=p.get("breadcrumb_category", "Regaly"),
            schema_json=schema,
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


def _generate_hub_page(valid_pages, output_dir):
    """Generate vsechny-regaly.html - a hub page linking to all pSEO pages for crawling."""
    # Group pages by playbook type
    by_type = {}
    type_labels = {
        "locations": "Regály podle města",
        "personas": "Regály podle cílové skupiny",
        "glossary": "Slovník pojmů",
        "comparisons": "Srovnání regálů",
        "curation": "TOP žebříčky a doporučení",
        "templates": "Šablony a průvodci",
        "examples": "Příklady použití",
        "directory": "Regály podle parametrů",
        "profiles": "Produktové řady",
        "conversions": "Nákup a objednávka",
        "translations": "Slovensko",
        "integrations": "Příslušenství a doplňky",
    }

    for p in valid_pages:
        t = p.get("playbook_type", "other")
        if t not in by_type:
            by_type[t] = []
        by_type[t].append(p)

    sections_html = ""
    for ptype in ["curation", "comparisons", "directory", "locations", "personas",
                   "templates", "examples", "conversions", "glossary", "profiles",
                   "translations", "integrations"]:
        if ptype not in by_type:
            continue
        label = type_labels.get(ptype, ptype)
        links = ""
        for p in by_type[ptype]:
            links += f'<li><a href="{p["slug"]}.html" class="text-primary-600 hover:underline hover:text-primary-700">{p["h1"]}</a></li>\n'
        sections_html += f'''
        <section class="mb-10">
            <h2 class="text-2xl font-bold mb-4">{label}</h2>
            <ul class="space-y-2 list-disc list-inside text-gray-700">{links}</ul>
        </section>
        '''

    body_html = f'''
    <p class="text-xl text-gray-600 mb-8">Kompletní přehled všech stránek o kovových regálech.
    Najděte přesně to, co hledáte – podle města, účelu, rozměru nebo ceny.</p>

    <div class="bg-green-50 border border-green-200 rounded-xl p-6 mb-8">
        <p class="text-green-700"><strong>{len(valid_pages)} stránek</strong> s informacemi o kovových regálech.
        Regály od 549 Kč, doprava od 99 Kč, záruka 7 let.</p>
    </div>

    {sections_html}
    '''

    schema = build_schema_json(
        slug="vsechny-regaly",
        title="Všechny regály – kompletní přehled | Bazarovyregal.cz",
        meta_desc="Kompletní přehled všech kovových regálů. Regály podle města, účelu, rozměru, ceny. 112+ stránek s informacemi.",
        h1="Všechny regály – kompletní přehled stránek",
        breadcrumb_category="Přehled",
        playbook_type="directory",
    )

    html = wrap_page(
        slug="vsechny-regaly",
        title="Všechny regály – kompletní přehled | Bazarovyregal.cz",
        meta_desc="Kompletní přehled všech kovových regálů. Regály podle města, účelu, rozměru, ceny. 112+ stránek s informacemi.",
        h1="Všechny regály – kompletní přehled stránek",
        body_html=body_html,
        breadcrumb_category="Přehled",
        schema_json=schema,
    )

    filepath = os.path.join(output_dir, "vsechny-regaly.html")
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(html)
    print("  Written: vsechny-regaly.html")


def main():
    output_dir = os.path.dirname(os.path.abspath(__file__))

    print("Generating pSEO pages for Bazarovyregal.cz...")
    print("=" * 50)

    # Collect all pages from all playbooks
    all_pages = []

    print("\n[1/12] Generating Location pages...")
    pages = generate_location_pages()
    print(f"        -> {len(pages)} pages")
    all_pages.extend(pages)

    print("[2/12] Generating Persona pages...")
    pages = generate_persona_pages()
    print(f"        -> {len(pages)} pages")
    all_pages.extend(pages)

    print("[3/12] Generating Glossary pages...")
    pages = generate_glossary_pages()
    print(f"        -> {len(pages)} pages")
    all_pages.extend(pages)

    print("[4/12] Generating Comparison pages...")
    pages = generate_comparison_pages()
    print(f"        -> {len(pages)} pages")
    all_pages.extend(pages)

    print("[5/12] Generating Curation pages...")
    pages = generate_curation_pages()
    print(f"        -> {len(pages)} pages")
    all_pages.extend(pages)

    print("[6/12] Generating Template pages...")
    pages = generate_template_pages()
    print(f"        -> {len(pages)} pages")
    all_pages.extend(pages)

    print("[7/12] Generating Example pages...")
    pages = generate_example_pages()
    print(f"        -> {len(pages)} pages")
    all_pages.extend(pages)

    print("[8/12] Generating Directory pages...")
    pages = generate_directory_pages()
    print(f"        -> {len(pages)} pages")
    all_pages.extend(pages)

    print("[9/12] Generating Profile pages...")
    pages = generate_profile_pages()
    print(f"       -> {len(pages)} pages")
    all_pages.extend(pages)

    print("[10/12] Generating Conversion pages...")
    pages = generate_conversion_pages()
    print(f"        -> {len(pages)} pages")
    all_pages.extend(pages)

    print("[11/12] Generating Translation pages...")
    pages = generate_translation_pages()
    print(f"        -> {len(pages)} pages")
    all_pages.extend(pages)

    print("[12/12] Generating Integration pages...")
    pages = generate_integration_pages()
    print(f"        -> {len(pages)} pages")
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

    # Generate hub page (vsechny-regaly) for crawling/indexing
    print("\nGenerating hub page (vsechny-regaly.html)...")
    _generate_hub_page(valid, output_dir)
    # Add hub page to sitemap
    _, hub_added = update_sitemap(generated + ["vsechny-regaly"], output_dir)
    if hub_added:
        print(f"  Added {hub_added} hub URL(s) to sitemap")

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
