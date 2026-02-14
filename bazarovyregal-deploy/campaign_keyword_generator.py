#!/usr/bin/env python3
"""
Longtail Keyword Generator for Bazarovyregal.cz Google Ads

Generates longtail keywords from product attribute combinations:
  barva × výška × typ × použití

Segments keywords by intent:
  - purchase: "kovový regál do garáže 180cm černý levně"
  - info:     "jaký regál do garáže vybrat"
  - comparison: "kovový vs dřevěný regál do garáže"

Adds negative keywords (bazarový, použitý, starý - protože jsou NOVÉ)
Exports to Google Ads Editor CSV format.

Usage:
    python3 campaign_keyword_generator.py                  # Full report + CSV
    python3 campaign_keyword_generator.py --format csv     # CSV only
    python3 campaign_keyword_generator.py --format json    # JSON only
    python3 campaign_keyword_generator.py --intent purchase # Only purchase intent
"""

import csv
import json
import sys
import os
from datetime import datetime
from itertools import product as iterproduct

# ============================================================
# PRODUCT ATTRIBUTES
# ============================================================

BARVY = [
    {"id": "cerna", "name": "černý", "adj_f": "černá", "adj_n": "černé"},
    {"id": "zinkovany", "name": "zinkovaný", "adj_f": "zinkovaná", "adj_n": "zinkované"},
    {"id": "bila", "name": "bílý", "adj_f": "bílá", "adj_n": "bílé"},
    {"id": "cervena", "name": "červený", "adj_f": "červená", "adj_n": "červené"},
    {"id": "modra", "name": "modrý", "adj_f": "modrá", "adj_n": "modré"},
]

VYSKY = [
    {"cm": 150, "label": "150cm", "desc": "nízký"},
    {"cm": 180, "label": "180cm", "desc": "střední"},
    {"cm": 200, "label": "200cm", "desc": "vysoký"},
]

TYPY = [
    {"id": "kovovy", "name": "kovový regál", "plural": "kovové regály"},
    {"id": "policovy", "name": "policový regál", "plural": "policové regály"},
    {"id": "bezroubovy", "name": "bezšroubový regál", "plural": "bezšroubové regály"},
    {"id": "skladovy", "name": "skladový regál", "plural": "skladové regály"},
]

POUZITI = [
    {"id": "garaz", "name": "do garáže", "adj": "garážový"},
    {"id": "sklep", "name": "do sklepa", "adj": "sklepní"},
    {"id": "dilna", "name": "do dílny", "adj": "dílenský"},
    {"id": "domacnost", "name": "do domácnosti", "adj": "domácí"},
    {"id": "kancelar", "name": "do kanceláře", "adj": "kancelářský"},
    {"id": "sklad", "name": "do skladu", "adj": "skladový"},
    {"id": "spiz", "name": "do spíže", "adj": "spížní"},
    {"id": "archiv", "name": "do archivu", "adj": "archivační"},
]

# ============================================================
# KEYWORD TEMPLATES BY INTENT
# ============================================================

PURCHASE_TEMPLATES = [
    "{typ} {pouziti} {vyska} {barva}",
    "{typ} {pouziti} {barva} {vyska}",
    "{barva} {typ} {pouziti}",
    "{typ} {pouziti} levně",
    "{typ} {pouziti} akce",
    "{typ} {pouziti} výprodej",
    "{typ} {pouziti} se slevou",
    "{typ} {pouziti} skladem",
    "{typ} {barva} {vyska} levně",
    "{plural} {pouziti} levně",
    "levný {typ} {pouziti}",
    "{typ} {vyska} {barva}",
    "regál {pouziti} {vyska} {barva}",
    "regál {barva} {vyska}",
    "regály {pouziti} akce",
    "regály {pouziti} výprodej",
    "regály {pouziti} se slevou",
    "{barva} regál {pouziti} levně",
    "kovové regály {barva} {pouziti}",
]

INFO_TEMPLATES = [
    "jaký regál {pouziti} vybrat",
    "jak vybrat regál {pouziti}",
    "nejlepší regál {pouziti}",
    "doporučení regál {pouziti}",
    "regál {pouziti} recenze",
    "regál {pouziti} zkušenosti",
    "nosnost regálu {pouziti}",
    "kolik unese regál {pouziti}",
    "{typ} {pouziti} rozměry",
    "montáž regálu {pouziti}",
]

COMPARISON_TEMPLATES = [
    "{barva} vs zinkovaný regál {pouziti}",
    "kovový vs dřevěný regál {pouziti}",
    "kovový vs plastový regál {pouziti}",
    "bezšroubový vs šroubový regál",
    "regál {pouziti} srovnání cen",
    "porovnání regálů {pouziti}",
    "nejlevnější regál {pouziti}",
]

# ============================================================
# NEGATIVE KEYWORDS
# ============================================================

NEGATIVE_KEYWORDS = [
    # Protože prodáváme NOVÉ, ne použité
    "bazarový",
    "bazarové",
    "bazarovy",
    "bazarove",
    "použitý",
    "použité",
    "pouzity",
    "pouzite",
    "starý",
    "staré",
    "stary",
    "stare",
    "ojetý",
    "ojety",
    "second hand",
    "z druhé ruky",
    # Materiály které neprodáváme
    "dřevěný",
    "dreveny",
    "dřevěné",
    "drevene",
    "plastový",
    "plastovy",
    "plastové",
    "plastove",
    # Typy které neprodáváme
    "paletový",
    "paletove",
    "průjezdný",
    "prujezdny",
    "nástěnný",
    "nastenny",
    "závěsný",
    "zavesny",
    # Nesouvisející
    "ikea",
    "knihovna",
    "na boty",
    "na víno",
    "na květiny",
    "do koupelny",
]


# ============================================================
# KEYWORD GENERATOR
# ============================================================

def generate_keywords(intent_filter=None):
    """Generate all keyword combinations."""
    keywords = []
    seen = set()

    def add_kw(text, intent, ad_group, match_type="Phrase"):
        # Clean up whitespace
        text = " ".join(text.split()).strip().lower()
        if text and text not in seen and len(text) > 5:
            seen.add(text)
            keywords.append({
                "keyword": text,
                "intent": intent,
                "ad_group": ad_group,
                "match_type": match_type,
            })

    # PURCHASE INTENT keywords
    if not intent_filter or intent_filter == "purchase":
        for pouziti in POUZITI:
            for barva in BARVY:
                for vyska in VYSKY:
                    for typ in TYPY:
                        ctx = {
                            "typ": typ["name"],
                            "plural": typ["plural"],
                            "pouziti": pouziti["name"],
                            "barva": barva["name"],
                            "vyska": vyska["label"],
                        }
                        ad_group = f"Purchase - {pouziti['name'].replace('do ', '').capitalize()}"

                        for template in PURCHASE_TEMPLATES:
                            try:
                                kw = template.format(**ctx)
                                add_kw(kw, "purchase", ad_group)
                            except KeyError:
                                pass

        # Extra purchase keywords without color
        for pouziti in POUZITI:
            for typ in TYPY:
                add_kw(f"{typ['name']} {pouziti['name']} koupit", "purchase",
                       f"Purchase - {pouziti['name'].replace('do ', '').capitalize()}")
                add_kw(f"kde koupit {typ['name']} {pouziti['name']}", "purchase",
                       f"Purchase - {pouziti['name'].replace('do ', '').capitalize()}")
                add_kw(f"{typ['name']} {pouziti['name']} eshop", "purchase",
                       f"Purchase - {pouziti['name'].replace('do ', '').capitalize()}")
                add_kw(f"{typ['name']} {pouziti['name']} online", "purchase",
                       f"Purchase - {pouziti['name'].replace('do ', '').capitalize()}")

        # Size-specific purchase keywords
        for vyska in VYSKY:
            for sirka in ["70", "90", "120"]:
                for hloubka in ["30", "40", "50"]:
                    add_kw(f"regál {vyska['cm']}x{sirka}x{hloubka}", "purchase",
                           "Purchase - Rozměry", "Exact")
                    add_kw(f"kovový regál {vyska['cm']}x{sirka}x{hloubka}", "purchase",
                           "Purchase - Rozměry", "Exact")

    # INFO INTENT keywords
    if not intent_filter or intent_filter == "info":
        for pouziti in POUZITI:
            for typ in TYPY:
                ctx = {
                    "typ": typ["name"],
                    "pouziti": pouziti["name"],
                }
                ad_group = f"Info - {pouziti['name'].replace('do ', '').capitalize()}"

                for template in INFO_TEMPLATES:
                    try:
                        kw = template.format(**ctx)
                        add_kw(kw, "info", ad_group)
                    except KeyError:
                        pass

        # General info keywords
        general_info = [
            "jak vybrat kovový regál",
            "typy kovových regálů",
            "nosnost kovového regálu",
            "bezšroubový regál montáž návod",
            "kovový regál údržba",
            "kolik stojí kovový regál",
            "rozměry kovových regálů",
            "materiály kovových regálů",
            "lakovaný vs zinkovaný regál",
        ]
        for kw in general_info:
            add_kw(kw, "info", "Info - Obecné")

    # COMPARISON INTENT keywords
    if not intent_filter or intent_filter == "comparison":
        for pouziti in POUZITI:
            for barva in BARVY:
                ctx = {
                    "barva": barva["name"],
                    "pouziti": pouziti["name"],
                }
                ad_group = f"Comparison - {pouziti['name'].replace('do ', '').capitalize()}"

                for template in COMPARISON_TEMPLATES:
                    try:
                        kw = template.format(**ctx)
                        add_kw(kw, "comparison", ad_group)
                    except KeyError:
                        pass

        # General comparison keywords
        comparisons = [
            "hornbach vs bazarovyregal regály",
            "obi vs bazarovyregal",
            "nejlevnější kovové regály srovnání",
            "kovové regály cenové srovnání",
            "kde jsou nejlevnější kovové regály",
            "porovnání kovových regálů",
        ]
        for kw in comparisons:
            add_kw(kw, "comparison", "Comparison - Obecné")

    return keywords


# ============================================================
# EXPORT FUNCTIONS
# ============================================================

def export_google_ads_csv(keywords, output_dir="."):
    """Export keywords in Google Ads Editor CSV format."""
    filepath = os.path.join(output_dir, "keyword_campaigns.csv")

    fieldnames = [
        "Campaign", "Ad Group", "Keyword", "Match Type",
        "Max CPC", "Final URL", "Status",
    ]

    with open(filepath, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for kw in keywords:
            # Determine campaign based on intent
            if kw["intent"] == "purchase":
                campaign = "Search - Generic"
            elif kw["intent"] == "info":
                campaign = "Search - Info Content"
            else:
                campaign = "Search - Comparisons"

            writer.writerow({
                "Campaign": campaign,
                "Ad Group": kw["ad_group"],
                "Keyword": kw["keyword"],
                "Match Type": kw["match_type"],
                "Max CPC": "",
                "Final URL": "https://www.bazarovyregal.cz/katalog.html",
                "Status": "Paused",
            })

    # Negative keywords CSV
    neg_filepath = os.path.join(output_dir, "keyword_negatives.csv")
    with open(neg_filepath, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(["Campaign", "Ad Group", "Keyword", "Match Type"])
        campaigns = ["Search - Generic", "Search - Info Content", "Search - Comparisons"]
        for nk in NEGATIVE_KEYWORDS:
            for campaign in campaigns:
                writer.writerow([campaign, "", nk, "Phrase"])

    print(f"  Keywords CSV: {filepath}")
    print(f"  Negative keywords CSV: {neg_filepath}")
    return filepath


def export_json(keywords, output_dir="."):
    """Export keywords as JSON."""
    filepath = os.path.join(output_dir, "keyword_campaigns.json")

    # Group by intent and ad_group
    by_intent = {}
    for kw in keywords:
        intent = kw["intent"]
        if intent not in by_intent:
            by_intent[intent] = {}
        ag = kw["ad_group"]
        if ag not in by_intent[intent]:
            by_intent[intent][ag] = []
        by_intent[intent][ag].append(kw["keyword"])

    data = {
        "generated_at": datetime.now().isoformat(),
        "total_keywords": len(keywords),
        "by_intent": {
            intent: {
                "count": sum(len(kws) for kws in groups.values()),
                "ad_groups": {ag: kws for ag, kws in groups.items()},
            }
            for intent, groups in by_intent.items()
        },
        "negative_keywords": NEGATIVE_KEYWORDS,
        "attributes": {
            "barvy": [b["name"] for b in BARVY],
            "vysky": [v["label"] for v in VYSKY],
            "typy": [t["name"] for t in TYPY],
            "pouziti": [p["name"] for p in POUZITI],
        },
    }

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  JSON exported: {filepath}")
    return filepath


def print_report(keywords):
    """Print keyword generation report."""
    print("\n" + "=" * 70)
    print("  LONGTAIL KEYWORD GENERATOR – Bazarovyregal.cz")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 70)

    # Stats
    intents = {}
    ad_groups = {}
    for kw in keywords:
        intents[kw["intent"]] = intents.get(kw["intent"], 0) + 1
        ad_groups[kw["ad_group"]] = ad_groups.get(kw["ad_group"], 0) + 1

    print(f"\n  CELKEM KEYWORDS: {len(keywords)}")
    print(f"\n  Podle záměru (intent):")
    for intent, count in sorted(intents.items()):
        print(f"    {intent:<15} {count:>6} keywords")

    print(f"\n  Podle ad group:")
    for ag, count in sorted(ad_groups.items(), key=lambda x: -x[1]):
        print(f"    {ag:<45} {count:>5}")

    # Attribute dimensions
    print(f"\n  DIMENZE KOMBINACÍ:")
    print(f"    Barvy:    {len(BARVY)} ({', '.join(b['name'] for b in BARVY)})")
    print(f"    Výšky:    {len(VYSKY)} ({', '.join(v['label'] for v in VYSKY)})")
    print(f"    Typy:     {len(TYPY)} ({', '.join(t['name'] for t in TYPY)})")
    print(f"    Použití:  {len(POUZITI)} ({', '.join(p['name'] for p in POUZITI)})")
    print(f"    Celkem kombinací: {len(BARVY) * len(VYSKY) * len(TYPY) * len(POUZITI)}")

    # Sample keywords
    print(f"\n  VZORKY KEYWORDS:")
    for intent in ["purchase", "info", "comparison"]:
        intent_kws = [kw for kw in keywords if kw["intent"] == intent]
        print(f"\n  {intent.upper()} ({len(intent_kws)} total):")
        for kw in intent_kws[:8]:
            print(f"    • {kw['keyword']}")
        if len(intent_kws) > 8:
            print(f"    ... a dalších {len(intent_kws) - 8}")

    # Negative keywords
    print(f"\n{'=' * 70}")
    print(f"  NEGATIVNÍ KLÍČOVÁ SLOVA ({len(NEGATIVE_KEYWORDS)})")
    print(f"{'=' * 70}")
    for nk in NEGATIVE_KEYWORDS:
        print(f"    – {nk}")

    print(f"\n{'=' * 70}\n")


# ============================================================
# MAIN
# ============================================================

def main():
    output_format = "text"
    intent_filter = None

    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] == "--format" and i + 1 < len(args):
            output_format = args[i + 1]
            i += 2
        elif args[i] == "--intent" and i + 1 < len(args):
            intent_filter = args[i + 1]
            i += 2
        else:
            i += 1

    output_dir = os.path.dirname(os.path.abspath(__file__))
    keywords = generate_keywords(intent_filter)

    if output_format == "json":
        export_json(keywords, output_dir)
    elif output_format == "csv":
        export_google_ads_csv(keywords, output_dir)
    else:
        print_report(keywords)
        export_json(keywords, output_dir)
        export_google_ads_csv(keywords, output_dir)


if __name__ == "__main__":
    main()
