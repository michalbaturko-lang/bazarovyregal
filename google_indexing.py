#!/usr/bin/env python3
"""
Google Indexing API - Hromadné indexování pro bazarovyregal.cz
Odesílá URL do Google pro okamžitou indexaci (až 200/den)
"""

import json
import requests
from google.oauth2 import service_account
from google.auth.transport.requests import Request
from xml.etree import ElementTree
import time
import os
from datetime import datetime

# === KONFIGURACE ===
JSON_KEY_FILE = "google-indexing-key.json"  # Název JSON klíče
SITEMAP_FILE = "sitemap.xml"
LOG_FILE = "indexing_log.txt"
BATCH_SIZE = 200  # Google limit je 200/den

# API endpoint
SCOPES = ["https://www.googleapis.com/auth/indexing"]
ENDPOINT = "https://indexing.googleapis.com/v3/urlNotifications:publish"


def load_urls_from_sitemap(sitemap_path):
    """Načte URL ze sitemap.xml"""
    tree = ElementTree.parse(sitemap_path)
    root = tree.getroot()

    # Handle namespace
    namespace = {'ns': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
    urls = []

    for url in root.findall('ns:url', namespace):
        loc = url.find('ns:loc', namespace)
        if loc is not None:
            urls.append(loc.text)

    return urls


def get_credentials():
    """Načte credentials z JSON klíče"""
    if not os.path.exists(JSON_KEY_FILE):
        print(f"❌ CHYBA: Soubor {JSON_KEY_FILE} nebyl nalezen!")
        print(f"   Vlož JSON klíč do složky a přejmenuj ho na '{JSON_KEY_FILE}'")
        return None

    credentials = service_account.Credentials.from_service_account_file(
        JSON_KEY_FILE,
        scopes=SCOPES
    )
    return credentials


def send_url_to_indexing_api(credentials, url):
    """Odešle jednu URL do Indexing API"""
    # Refresh token if needed
    credentials.refresh(Request())

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {credentials.token}"
    }

    data = {
        "url": url,
        "type": "URL_UPDATED"
    }

    response = requests.post(ENDPOINT, headers=headers, json=data)

    return response.status_code, response.json()


def main():
    print("=" * 60)
    print("🚀 Google Indexing API - bazarovyregal.cz")
    print("=" * 60)
    print()

    # Načti credentials
    credentials = get_credentials()
    if not credentials:
        return

    # Načti URL ze sitemap
    print(f"📄 Načítám URL ze {SITEMAP_FILE}...")
    urls = load_urls_from_sitemap(SITEMAP_FILE)
    print(f"   Nalezeno {len(urls)} URL")
    print()

    # Zkontroluj, které URL už byly odeslány
    sent_urls = set()
    if os.path.exists(LOG_FILE):
        with open(LOG_FILE, 'r') as f:
            for line in f:
                if "✅" in line:
                    # Extrahuj URL z logu
                    parts = line.split(" ")
                    for part in parts:
                        if part.startswith("https://"):
                            sent_urls.add(part.strip())

    # Filtruj URL, které ještě nebyly odeslány
    urls_to_send = [url for url in urls if url not in sent_urls]

    if not urls_to_send:
        print("✨ Všechny URL již byly odeslány!")
        return

    print(f"📤 K odeslání: {len(urls_to_send)} URL")
    print(f"   (Již odesláno: {len(sent_urls)})")
    print(f"   Denní limit: {BATCH_SIZE}")
    print()

    # Odesílej po dávkách
    batch = urls_to_send[:BATCH_SIZE]

    print(f"🔄 Odesílám {len(batch)} URL...")
    print("-" * 40)

    success_count = 0
    error_count = 0

    with open(LOG_FILE, 'a') as log:
        log.write(f"\n--- {datetime.now().isoformat()} ---\n")

        for i, url in enumerate(batch, 1):
            try:
                status_code, result = send_url_to_indexing_api(credentials, url)

                if status_code == 200:
                    print(f"✅ [{i}/{len(batch)}] {url}")
                    log.write(f"✅ {url}\n")
                    success_count += 1
                else:
                    error_msg = result.get('error', {}).get('message', 'Unknown error')
                    print(f"❌ [{i}/{len(batch)}] {url} - {error_msg}")
                    log.write(f"❌ {url} - {error_msg}\n")
                    error_count += 1

                # Malá pauza mezi requesty
                time.sleep(0.3)

            except Exception as e:
                print(f"❌ [{i}/{len(batch)}] {url} - {str(e)}")
                log.write(f"❌ {url} - {str(e)}\n")
                error_count += 1

    print()
    print("-" * 40)
    print(f"📊 VÝSLEDEK:")
    print(f"   ✅ Úspěšně: {success_count}")
    print(f"   ❌ Chyby: {error_count}")
    print(f"   📝 Zbývá: {len(urls_to_send) - len(batch)}")
    print()

    if len(urls_to_send) > BATCH_SIZE:
        remaining = len(urls_to_send) - BATCH_SIZE
        days_needed = (remaining // BATCH_SIZE) + 1
        print(f"⏰ Spusť skript znovu zítra pro dalších {BATCH_SIZE} URL")
        print(f"   Celkem potřeba: {days_needed} dní pro zbývajících {remaining} URL")


if __name__ == "__main__":
    main()
