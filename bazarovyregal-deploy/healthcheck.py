#!/usr/bin/env python3
"""
Health check script for bazarovyregal.cz
Run after every deployment to verify the site is working.

Usage:
    python healthcheck.py
    python healthcheck.py --full   (checks all pages from sitemap)
"""

import sys
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET

DOMAIN = "https://www.bazarovyregal.cz"

# Critical pages that MUST work
CRITICAL_PAGES = [
    "/",
    "/index.html",
    "/katalog.html",
    "/kontakt.html",
    "/faq.html",
    "/sitemap.xml",
    "/robots.txt",
]

# Sample pSEO pages
SAMPLE_PSEO = [
    "/kovove-regaly-praha.html",
    "/kovove-regaly-brno.html",
    "/regaly-do-garaze.html",
    "/srovnani-cerny-vs-zinkovany-regal.html",
    "/nejlepsi-kovove-regaly-2026.html",
]


def check_url(url):
    """Check if URL returns 200 OK."""
    try:
        req = urllib.request.Request(url, method="HEAD")
        req.add_header("User-Agent", "BazarovyregalHealthCheck/1.0")
        resp = urllib.request.urlopen(req, timeout=10)
        return resp.status, None
    except urllib.error.HTTPError as e:
        return e.code, str(e)
    except Exception as e:
        return 0, str(e)


def check_sitemap():
    """Download and parse sitemap, return list of URLs."""
    url = f"{DOMAIN}/sitemap.xml"
    try:
        req = urllib.request.Request(url)
        req.add_header("User-Agent", "BazarovyregalHealthCheck/1.0")
        resp = urllib.request.urlopen(req, timeout=15)
        content = resp.read().decode("utf-8")
        root = ET.fromstring(content)
        ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        urls = [loc.text for loc in root.findall(".//sm:loc", ns)]
        return urls
    except Exception as e:
        return []


def main():
    full_mode = "--full" in sys.argv
    errors = []
    warnings = []
    ok_count = 0

    print("=" * 60)
    print("  HEALTH CHECK - bazarovyregal.cz")
    print("=" * 60)

    # 1. Check critical pages
    print("\n[1] Checking critical pages...")
    for path in CRITICAL_PAGES:
        url = f"{DOMAIN}{path}"
        status, err = check_url(url)
        if status == 200:
            print(f"  OK  {path}")
            ok_count += 1
        else:
            print(f"  FAIL {path} -> {status} {err}")
            errors.append(f"CRITICAL: {path} returned {status}")

    # 2. Check sample pSEO pages
    print("\n[2] Checking sample pSEO pages...")
    for path in SAMPLE_PSEO:
        url = f"{DOMAIN}{path}"
        status, err = check_url(url)
        if status == 200:
            print(f"  OK  {path}")
            ok_count += 1
        elif status == 404:
            print(f"  WARN {path} -> 404 (page may not be deployed yet)")
            warnings.append(f"pSEO page not found: {path}")
        else:
            print(f"  FAIL {path} -> {status} {err}")
            errors.append(f"pSEO: {path} returned {status}")

    # 3. Check sitemap
    print("\n[3] Checking sitemap...")
    sitemap_urls = check_sitemap()
    if sitemap_urls:
        print(f"  OK  Sitemap loaded: {len(sitemap_urls)} URLs")
        ok_count += 1
    else:
        print("  FAIL Cannot load sitemap")
        errors.append("Cannot load sitemap.xml")

    # 4. Full mode: check all sitemap URLs
    if full_mode and sitemap_urls:
        print(f"\n[4] Full check: testing all {len(sitemap_urls)} sitemap URLs...")
        fail_count = 0
        for i, url in enumerate(sitemap_urls):
            status, err = check_url(url)
            if status != 200:
                fail_count += 1
                print(f"  FAIL [{i+1}/{len(sitemap_urls)}] {url} -> {status}")
                errors.append(f"Sitemap URL failed: {url} -> {status}")
            elif (i + 1) % 50 == 0:
                print(f"  ... checked {i+1}/{len(sitemap_urls)}")
        if fail_count == 0:
            print(f"  OK  All {len(sitemap_urls)} URLs return 200")

    # Summary
    print("\n" + "=" * 60)
    if errors:
        print(f"  RESULT: FAIL - {len(errors)} errors, {len(warnings)} warnings")
        for e in errors:
            print(f"    ERROR: {e}")
        for w in warnings:
            print(f"    WARN:  {w}")
        print("=" * 60)
        sys.exit(1)
    elif warnings:
        print(f"  RESULT: PASS with {len(warnings)} warnings")
        for w in warnings:
            print(f"    WARN:  {w}")
        print("=" * 60)
        sys.exit(0)
    else:
        print(f"  RESULT: PASS - {ok_count} checks passed")
        print("=" * 60)
        sys.exit(0)


if __name__ == "__main__":
    main()
