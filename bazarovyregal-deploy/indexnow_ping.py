#!/usr/bin/env python3
"""
IndexNow ping script for bazarovyregal.cz
Notifies Bing, Seznam, Yandex, and Naver about new/updated URLs.
IndexNow is free and triggers immediate crawling.

Usage:
    python indexnow_ping.py                 # Ping all pSEO pages
    python indexnow_ping.py --new-only      # Ping only pages not yet pinged
    python indexnow_ping.py --url URL       # Ping a specific URL
"""

import sys
import json
import urllib.request
import urllib.error
import os

BASE_URL = "https://www.bazarovyregal.cz"
# IndexNow key - also needs to be served as a file at /{key}.txt
INDEXNOW_KEY = "bazarovyregal2026indexnow"

INDEXNOW_ENDPOINTS = [
    "https://api.indexnow.org/indexnow",
    "https://www.bing.com/indexnow",
]

PING_LOG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "indexnow_pinged.json")


def load_pinged():
    if os.path.exists(PING_LOG):
        with open(PING_LOG, "r") as f:
            return set(json.load(f))
    return set()


def save_pinged(pinged):
    with open(PING_LOG, "w") as f:
        json.dump(sorted(list(pinged)), f, indent=2)


def get_all_pseo_urls():
    """Load all pSEO page URLs from manifest."""
    manifest_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pseo_manifest.json")
    if not os.path.exists(manifest_path):
        print("ERROR: pseo_manifest.json not found. Run generate_pseo_all.py first.")
        return []
    with open(manifest_path, "r") as f:
        manifest = json.load(f)
    urls = [f"{BASE_URL}/{p['slug']}.html" for p in manifest["pages"]]
    # Add hub page
    urls.append(f"{BASE_URL}/vsechny-regaly.html")
    return urls


def ping_indexnow(urls):
    """Submit URLs to IndexNow API."""
    if not urls:
        print("No URLs to ping.")
        return

    # IndexNow accepts max 10000 URLs per request
    batch_size = 10000
    total_ok = 0

    for endpoint in INDEXNOW_ENDPOINTS:
        for i in range(0, len(urls), batch_size):
            batch = urls[i:i + batch_size]
            payload = {
                "host": "www.bazarovyregal.cz",
                "key": INDEXNOW_KEY,
                "keyLocation": f"{BASE_URL}/{INDEXNOW_KEY}.txt",
                "urlList": batch
            }

            try:
                data = json.dumps(payload).encode("utf-8")
                req = urllib.request.Request(
                    endpoint,
                    data=data,
                    headers={"Content-Type": "application/json; charset=utf-8"},
                    method="POST"
                )
                resp = urllib.request.urlopen(req, timeout=15)
                status = resp.status
                print(f"  OK  {endpoint} -> {status} ({len(batch)} URLs)")
                total_ok += len(batch)
            except urllib.error.HTTPError as e:
                print(f"  WARN {endpoint} -> {e.code} {e.reason}")
            except Exception as e:
                print(f"  FAIL {endpoint} -> {e}")

    return total_ok


def main():
    new_only = "--new-only" in sys.argv
    single_url = None
    if "--url" in sys.argv:
        idx = sys.argv.index("--url")
        if idx + 1 < len(sys.argv):
            single_url = sys.argv[idx + 1]

    print("=" * 60)
    print("  IndexNow Ping - bazarovyregal.cz")
    print("=" * 60)

    if single_url:
        urls = [single_url]
        print(f"\n  Pinging 1 URL: {single_url}")
    else:
        all_urls = get_all_pseo_urls()
        if not all_urls:
            return

        if new_only:
            pinged = load_pinged()
            urls = [u for u in all_urls if u not in pinged]
            print(f"\n  Total URLs: {len(all_urls)}, Already pinged: {len(pinged)}, New: {len(urls)}")
        else:
            urls = all_urls
            print(f"\n  Pinging {len(urls)} URLs")

    if not urls:
        print("  Nothing to ping.")
        return

    print()
    ok = ping_indexnow(urls)

    # Save pinged URLs
    if ok:
        pinged = load_pinged()
        pinged.update(urls)
        save_pinged(pinged)
        print(f"\n  Pinged {ok} URLs. Log saved to indexnow_pinged.json")


if __name__ == "__main__":
    main()
