#!/usr/bin/env python3
"""
IndexNow - Hromadné oznámení pro Bing, Yandex, Seznam
Odešle až 10000 URL najednou!
"""

import requests
import json
from xml.etree import ElementTree

# === KONFIGURACE ===
INDEXNOW_KEY = "afd695fa47fcbfe9a97565483a7d8415"
HOST = "www.bazarovyregal.cz"
SITEMAP_FILE = "sitemap.xml"

# IndexNow endpoints
ENDPOINTS = [
    "https://api.indexnow.org/indexnow",
    "https://www.bing.com/indexnow",
    "https://yandex.com/indexnow",
]


def load_urls_from_sitemap(sitemap_path):
    """Načte URL ze sitemap.xml"""
    tree = ElementTree.parse(sitemap_path)
    root = tree.getroot()
    namespace = {'ns': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
    urls = []

    for url in root.findall('ns:url', namespace):
        loc = url.find('ns:loc', namespace)
        if loc is not None:
            urls.append(loc.text)

    return urls


def submit_to_indexnow(urls):
    """Odešle URL do IndexNow"""
    payload = {
        "host": HOST,
        "key": INDEXNOW_KEY,
        "keyLocation": f"https://{HOST}/{INDEXNOW_KEY}.txt",
        "urlList": urls
    }

    headers = {
        "Content-Type": "application/json; charset=utf-8"
    }

    results = {}

    for endpoint in ENDPOINTS:
        try:
            response = requests.post(
                endpoint,
                headers=headers,
                data=json.dumps(payload),
                timeout=30
            )
            results[endpoint] = {
                "status": response.status_code,
                "success": response.status_code in [200, 202]
            }

            if response.status_code in [200, 202]:
                print(f"✅ {endpoint} - OK ({response.status_code})")
            else:
                print(f"❌ {endpoint} - Chyba ({response.status_code})")

        except Exception as e:
            results[endpoint] = {"status": "error", "message": str(e)}
            print(f"❌ {endpoint} - {str(e)}")

    return results


def main():
    print("=" * 60)
    print("🚀 IndexNow - bazarovyregal.cz")
    print("   Bing + Yandex + Seznam")
    print("=" * 60)
    print()

    # Načti URL
    print(f"📄 Načítám URL ze {SITEMAP_FILE}...")
    urls = load_urls_from_sitemap(SITEMAP_FILE)
    print(f"   Nalezeno {len(urls)} URL")
    print()

    # IndexNow limit je 10000 URL najednou
    batch_size = 10000

    for i in range(0, len(urls), batch_size):
        batch = urls[i:i+batch_size]
        print(f"📤 Odesílám dávku {i//batch_size + 1} ({len(batch)} URL)...")
        print("-" * 40)
        submit_to_indexnow(batch)
        print()

    print("=" * 60)
    print("✨ Hotovo! URL byly odeslány do IndexNow.")
    print()
    print("📋 Co se stane dál:")
    print("   • Bing: Crawl během hodin až dní")
    print("   • Yandex: Crawl během hodin")
    print("   • Seznam: Crawl během hodin až dní")
    print()
    print("💡 TIP: Nezapomeň pushnout soubor klíče na web:")
    print(f"   {INDEXNOW_KEY}.txt")


if __name__ == "__main__":
    main()
