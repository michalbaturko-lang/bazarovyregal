#!/usr/bin/env python3
"""
Google Ads Campaign Optimizer for Bazarovyregal.cz

Comprehensive tool for planning and optimizing Google Ads campaigns
(Shopping + Performance Max) with focus on minimizing CPC while
maximizing traffic.

Usage:
    python3 ads_optimizer.py                    # Full analysis report
    python3 ads_optimizer.py --budget 5000      # Analysis with 5000 CZK monthly budget
    python3 ads_optimizer.py --format json      # Output as JSON

Outputs:
    - Campaign structure recommendations
    - Budget allocation strategy
    - Keyword research & suggestions
    - Audience signals for PMax
    - ROI projections
    - Landing page optimization tips
"""

import json
import sys
import os
from datetime import datetime

from pseo_config import BASE_URL, PRODUCTS, CATEGORIES, LOCATIONS, PERSONAS, COLORS


# ============================================================
# MARKET DATA - Czech e-commerce benchmarks (2025-2026)
# ============================================================

BENCHMARKS = {
    "avg_cpc_shopping_czk": 3.50,       # Average CPC for Shopping in CZ (home & garden)
    "avg_cpc_pmax_czk": 5.00,           # Average CPC for PMax in CZ
    "avg_cpc_search_czk": 8.00,         # Average CPC for Search in CZ
    "avg_ctr_shopping": 0.018,           # 1.8% CTR for Shopping
    "avg_ctr_pmax": 0.025,              # 2.5% CTR for PMax
    "avg_conversion_rate": 0.025,        # 2.5% conversion rate for e-commerce CZ
    "avg_order_value_czk": 800,          # Estimated AOV for shelving
    "avg_margin_pct": 0.30,              # 30% margin estimate
    "min_daily_budget_shopping": 50,      # Min daily budget CZK for Shopping
    "min_daily_budget_pmax": 50,          # Min daily budget CZK for PMax
    "recommended_learning_period_days": 14,  # Google Ads learning period
}


# ============================================================
# KEYWORD DATABASE - Czech keywords for metal shelving
# ============================================================

KEYWORDS = {
    "high_intent": [
        {"keyword": "kovove regaly levne", "est_cpc": 4.5, "est_volume": 880, "intent": "purchase"},
        {"keyword": "regaly do garaze", "est_cpc": 3.8, "est_volume": 1200, "intent": "purchase"},
        {"keyword": "kovovy regal akce", "est_cpc": 3.2, "est_volume": 590, "intent": "purchase"},
        {"keyword": "regal do sklepa", "est_cpc": 3.5, "est_volume": 720, "intent": "purchase"},
        {"keyword": "kovove regaly vyprodej", "est_cpc": 2.8, "est_volume": 320, "intent": "purchase"},
        {"keyword": "regaly do dilny", "est_cpc": 4.0, "est_volume": 480, "intent": "purchase"},
        {"keyword": "skladove regaly levne", "est_cpc": 5.2, "est_volume": 390, "intent": "purchase"},
        {"keyword": "policovy regal kovovy", "est_cpc": 3.0, "est_volume": 260, "intent": "purchase"},
        {"keyword": "bezroubove regaly", "est_cpc": 3.8, "est_volume": 210, "intent": "purchase"},
        {"keyword": "regal 180x90x40", "est_cpc": 2.5, "est_volume": 170, "intent": "purchase"},
    ],
    "medium_intent": [
        {"keyword": "kovove regaly", "est_cpc": 6.0, "est_volume": 2400, "intent": "research"},
        {"keyword": "regaly na naradi", "est_cpc": 3.5, "est_volume": 480, "intent": "research"},
        {"keyword": "regaly do kancelare", "est_cpc": 5.0, "est_volume": 320, "intent": "research"},
        {"keyword": "zinkovane regaly", "est_cpc": 3.0, "est_volume": 260, "intent": "research"},
        {"keyword": "regaly do spize", "est_cpc": 2.8, "est_volume": 390, "intent": "research"},
        {"keyword": "nosnost regalu", "est_cpc": 1.5, "est_volume": 170, "intent": "research"},
        {"keyword": "regal na pneumatiky", "est_cpc": 3.5, "est_volume": 210, "intent": "research"},
        {"keyword": "jak vybrat regal", "est_cpc": 1.0, "est_volume": 140, "intent": "research"},
    ],
    "local_intent": [
        {"keyword": "kovove regaly praha", "est_cpc": 4.0, "est_volume": 320, "intent": "local"},
        {"keyword": "regaly brno", "est_cpc": 3.5, "est_volume": 210, "intent": "local"},
        {"keyword": "regaly ostrava", "est_cpc": 3.0, "est_volume": 140, "intent": "local"},
        {"keyword": "regaly plzen", "est_cpc": 2.8, "est_volume": 90, "intent": "local"},
        {"keyword": "kovove regaly olomouc", "est_cpc": 2.5, "est_volume": 70, "intent": "local"},
    ],
    "negative_keywords": [
        "drevene regaly",
        "ikea regaly",
        "plastove regaly",
        "knihovna",
        "regal na boty",
        "pouzite regaly",
        "bazarove regaly pouzite",
        "regal na stenu",
        "nastenny regal",
        "regaly bazar",
        "paletove regaly",
        "prujezdne regaly",
    ],
}


# ============================================================
# AUDIENCE SIGNALS for Performance Max
# ============================================================

AUDIENCE_SIGNALS = {
    "custom_segments": [
        {
            "name": "Kutilove a domaci majstri",
            "search_terms": [
                "regaly do garaze", "organizace garaze", "ulozne systemy dilna",
                "naradi organizace", "jak zorganizovat garaz",
            ],
            "urls": [
                "https://www.hornbach.cz", "https://www.obi.cz",
                "https://www.bauhaus.cz", "https://www.mountfield.cz",
            ],
        },
        {
            "name": "E-shop provozovatele",
            "search_terms": [
                "skladove regaly", "vybaveni skladu", "regaly pro eshop",
                "organizace skladu", "jak zacinat s eshopem",
            ],
            "urls": [
                "https://www.shoptet.cz", "https://www.upgates.cz",
            ],
        },
        {
            "name": "Noví majitele domu/bytu",
            "search_terms": [
                "vybaveni garaze", "organizace sklepa", "regaly do bytu",
                "stehovani", "zarizeni domu",
            ],
            "urls": [
                "https://www.sreality.cz", "https://www.bezrealitky.cz",
            ],
        },
    ],
    "demographic_targets": [
        {"age": "25-34", "reason": "Mladí majitelé domů, začínající podnikatelé"},
        {"age": "35-54", "reason": "Hlavní nakupující segment, DIY, firmy"},
        {"age": "55-64", "reason": "Seniori, organizace domácnosti"},
    ],
    "life_events": [
        "Nedávno se přestěhoval",
        "Koupil nový dům/byt",
        "Založení firmy",
    ],
    "interests": [
        "DIY a kutilství",
        "Domácí organizace",
        "E-commerce a podnikání",
        "Garáž a dílna",
    ],
}


# ============================================================
# CAMPAIGN STRUCTURE
# ============================================================

def plan_campaign_structure(monthly_budget_czk):
    """Generate optimal campaign structure based on budget."""

    daily_budget = monthly_budget_czk / 30

    campaigns = []

    # ---- SHOPPING CAMPAIGN (Standard) ----
    shopping_budget_pct = 0.45  # 45% to Shopping
    shopping_daily = daily_budget * shopping_budget_pct

    if shopping_daily >= BENCHMARKS["min_daily_budget_shopping"]:
        campaigns.append({
            "name": "Shopping - Kovove regaly",
            "type": "SHOPPING",
            "daily_budget_czk": round(shopping_daily),
            "monthly_budget_czk": round(shopping_daily * 30),
            "bid_strategy": "Maximize clicks" if monthly_budget_czk < 10000 else "Target ROAS",
            "target_roas": 400 if monthly_budget_czk >= 10000 else None,
            "product_groups": [
                {
                    "name": "Bestsellery",
                    "filter": "custom_label_3 = bestseller",
                    "bid_adjustment": "+20%",
                    "priority": "HIGH",
                },
                {
                    "name": "Budget regaly (do 600 Kc)",
                    "filter": "custom_label_0 = budget",
                    "bid_adjustment": "0%",
                    "priority": "MEDIUM",
                },
                {
                    "name": "Stredni trida (600-800 Kc)",
                    "filter": "custom_label_0 = mid",
                    "bid_adjustment": "+10%",
                    "priority": "MEDIUM",
                },
                {
                    "name": "Premium regaly (800+ Kc)",
                    "filter": "custom_label_0 = premium",
                    "bid_adjustment": "+15%",
                    "priority": "MEDIUM",
                },
            ],
            "notes": [
                "Zacnete s Maximize clicks pro sber dat",
                "Po 2 tydnech (50+ konverzi) prejdete na Target ROAS",
                "Pouzijte negativni klicova slova z ads_optimizer.py",
                "Sledujte Search terms report a pridavejte negative weekly",
            ],
        })

    # ---- PMAX CAMPAIGN ----
    pmax_budget_pct = 0.40  # 40% to PMax
    pmax_daily = daily_budget * pmax_budget_pct

    if pmax_daily >= BENCHMARKS["min_daily_budget_pmax"]:
        campaigns.append({
            "name": "PMax - Bazarovyregal.cz",
            "type": "PERFORMANCE_MAX",
            "daily_budget_czk": round(pmax_daily),
            "monthly_budget_czk": round(pmax_daily * 30),
            "bid_strategy": "Maximize conversions" if monthly_budget_czk < 15000 else "Maximize conversion value",
            "asset_groups": [
                {
                    "name": "Likvidace skladu - hlavni",
                    "final_url": f"{BASE_URL}/katalog.html",
                    "headlines": [
                        "Kovove regaly - LIKVIDACE SKLADU",
                        "Slevy az 40% na vse skladem",
                        "Regaly od 489 Kc | Zaruka 7 let",
                        "Bezroubova montaz za 10 minut",
                        "Doprava zdarma nad 2000 Kc",
                    ],
                    "long_headlines": [
                        "Likvidace skladu: Kovove regaly za likvidacni ceny. Zaruka 7 let.",
                        "Nove kovove regaly od 489 Kc. Montaz bez naradi za 10 minut.",
                    ],
                    "descriptions": [
                        "Likvidace skladu! Kovove regaly za nejnizsi ceny. Nosnost az 1050 kg. Bezroubova montaz. 7 let zaruka. Doprava od 99 Kc.",
                        "Nove kovove regaly se slevou az 40%. Do garaze, sklepa, dilny. Skladem pres 10000 ks. Objednejte dnes!",
                    ],
                    "audience_signal": "Kutilove a domaci majstri",
                },
                {
                    "name": "Regaly pro firmy",
                    "final_url": f"{BASE_URL}/regaly-pro-firmy.html",
                    "headlines": [
                        "Skladove regaly pro firmy",
                        "Nosnost az 1050 kg | Od 549 Kc",
                        "Profesionalni regaly do skladu",
                        "Velkoobchodni ceny pro firmy",
                        "E-shop sklad - regaly od 549 Kc",
                    ],
                    "long_headlines": [
                        "Profesionalni skladove regaly pro firmy. Nosnost 1050 kg. Slevy az 75%.",
                        "Vybavte cely sklad za zlomek ceny. Kovove regaly pro e-shopy a firmy.",
                    ],
                    "descriptions": [
                        "Profesionalni kovove regaly pro firmy a e-shopy. Nosnost az 1050 kg. Montaz za 10 minut. Slevy az 75%. Zaruka 7 let.",
                        "Skladove regaly za velkoobchodni ceny. Idealni pro e-shop, sklad, kancelar. Objednejte jiz od 1 kusu.",
                    ],
                    "audience_signal": "E-shop provozovatele",
                },
                {
                    "name": "Regaly do domacnosti",
                    "final_url": f"{BASE_URL}/regaly-pro-domacnost.html",
                    "headlines": [
                        "Regaly do garaze a sklepa",
                        "Od 489 Kc | Montaz bez naradi",
                        "Kovove regaly do bytu a domu",
                        "Organizace spize a komory",
                        "Regaly 150-200 cm | Skladem",
                    ],
                    "long_headlines": [
                        "Kovove regaly do garaze, sklepa a domacnosti. Od 489 Kc se zarukou 7 let.",
                        "Poradek v garazi za 10 minut. Bezroubove regaly s nosnosti az 875 kg.",
                    ],
                    "descriptions": [
                        "Kovove regaly pro domacnost. Do garaze, sklepa, spize. Bezroubova montaz. Nosnost az 875 kg. Zaruka 7 let. Od 489 Kc.",
                        "Likvidace skladu! Regaly pro domacnost za nejnizsi ceny. Skladem, doprava od 99 Kc. Objednejte dnes.",
                    ],
                    "audience_signal": "Noví majitele domu/bytu",
                },
            ],
            "notes": [
                "PMax potrebuje 2-4 tydny na uceni (learning period)",
                "Neprovadejte zmeny behem learning period",
                "Pridejte audience signals z ads_optimizer.py",
                "Pouzijte final URL expansion = ON pro lepsi pokryti",
            ],
        })

    # ---- SEARCH CAMPAIGN (brand protection + high-intent) ----
    search_budget_pct = 0.15  # 15% to Search
    search_daily = daily_budget * search_budget_pct

    if search_daily >= 50:  # Minimum viable for Search
        campaigns.append({
            "name": "Search - Brand + High Intent",
            "type": "SEARCH",
            "daily_budget_czk": round(search_daily),
            "monthly_budget_czk": round(search_daily * 30),
            "bid_strategy": "Maximize clicks",
            "ad_groups": [
                {
                    "name": "Brand - Bazarovyregal",
                    "keywords": [
                        "bazarovyregal",
                        "bazarovy regal",
                        "bazarovyregal.cz",
                        "vyprodej regalu",
                        "vyprodej-regalu.cz",
                    ],
                    "match_type": "PHRASE",
                },
                {
                    "name": "High Intent - Nakup",
                    "keywords": [
                        "kovove regaly levne",
                        "kovovy regal akce",
                        "kovove regaly vyprodej",
                        "regal do garaze levne",
                        "bezroubovy regal",
                    ],
                    "match_type": "PHRASE",
                },
            ],
            "notes": [
                "Brand kampan chrani pred konkurenci na vase klicova slova",
                "Nizke CPC na brand keywords (0.5-2 CZK)",
                "Sledujte Auction Insights pro konkurenci",
            ],
        })

    return campaigns


def calculate_projections(campaigns):
    """Calculate traffic and revenue projections."""
    projections = {
        "monthly": {"clicks": 0, "impressions": 0, "conversions": 0, "revenue_czk": 0, "cost_czk": 0},
        "by_campaign": [],
    }

    for campaign in campaigns:
        monthly_budget = campaign["monthly_budget_czk"]
        campaign_type = campaign["type"]

        if campaign_type == "SHOPPING":
            avg_cpc = BENCHMARKS["avg_cpc_shopping_czk"]
            ctr = BENCHMARKS["avg_ctr_shopping"]
        elif campaign_type == "PERFORMANCE_MAX":
            avg_cpc = BENCHMARKS["avg_cpc_pmax_czk"]
            ctr = BENCHMARKS["avg_ctr_pmax"]
        else:  # SEARCH
            avg_cpc = BENCHMARKS["avg_cpc_search_czk"]
            ctr = 0.035  # Higher CTR for brand/high-intent search

        est_clicks = int(monthly_budget / avg_cpc)
        est_impressions = int(est_clicks / ctr)
        est_conversions = int(est_clicks * BENCHMARKS["avg_conversion_rate"])
        est_revenue = est_conversions * BENCHMARKS["avg_order_value_czk"]
        est_roas = (est_revenue / monthly_budget * 100) if monthly_budget > 0 else 0

        campaign_proj = {
            "campaign": campaign["name"],
            "type": campaign_type,
            "monthly_budget_czk": monthly_budget,
            "est_clicks": est_clicks,
            "est_impressions": est_impressions,
            "est_conversions": est_conversions,
            "est_revenue_czk": est_revenue,
            "est_roas_pct": round(est_roas),
            "est_cpc_czk": avg_cpc,
        }
        projections["by_campaign"].append(campaign_proj)

        projections["monthly"]["clicks"] += est_clicks
        projections["monthly"]["impressions"] += est_impressions
        projections["monthly"]["conversions"] += est_conversions
        projections["monthly"]["revenue_czk"] += est_revenue
        projections["monthly"]["cost_czk"] += monthly_budget

    total_cost = projections["monthly"]["cost_czk"]
    total_revenue = projections["monthly"]["revenue_czk"]
    projections["monthly"]["roas_pct"] = round(total_revenue / total_cost * 100) if total_cost > 0 else 0
    projections["monthly"]["profit_czk"] = round(
        total_revenue * BENCHMARKS["avg_margin_pct"] - total_cost
    )

    return projections


def get_landing_page_recommendations():
    """Generate landing page optimization recommendations."""
    return {
        "shopping_landing_pages": [
            {
                "url": f"{BASE_URL}/katalog.html",
                "purpose": "Hlavni katalogova stranka - default pro Shopping",
                "tips": [
                    "Pridat filtrovani podle ceny, barvy, rozmeru",
                    "Zvyraznit 'Skladem' badge u vsech produktu",
                    "Pridat 'Pridat do kosiku' CTA na kazdou kartu",
                ],
            },
            {
                "url": f"{BASE_URL}/regal-180x90x40-cerna.html",
                "purpose": "Bestseller produkt - vysoke konverze",
                "tips": [
                    "Pridat vice fotek (detail, rozmer, montaz)",
                    "Pridat video montaze",
                    "Zvyraznit 'BESTSELLER' a '875 kg nosnost'",
                ],
            },
        ],
        "pmax_landing_pages": [
            {
                "url": f"{BASE_URL}/regaly-do-garaze.html",
                "purpose": "Kategorie garaze - vysoka konverze",
            },
            {
                "url": f"{BASE_URL}/regaly-pro-firmy.html",
                "purpose": "B2B segment - vyssi AOV",
            },
            {
                "url": f"{BASE_URL}/likvidace-skladu-regaly.html",
                "purpose": "Urgency/akce stranka",
            },
        ],
        "general_tips": [
            "Zajistete, ze vsechny landing pages maji rychlost nacitani pod 3s (LCP)",
            "Kazda stranka musi mit jasne CTA 'Do kosiku' / 'Objednat'",
            "Mobilni verze musi byt plne funkcni (60%+ trafficu z mobilu)",
            "Pridejte schema.org Product markup na vsechny produktove stranky",
            "Implementujte remarketing tagy pro navstevniky kteri neprovedly konverzi",
        ],
    }


def generate_tracking_setup_guide():
    """Generate tracking implementation guide."""
    return {
        "step_1_gtag": {
            "title": "Implementace Google Ads a GA4 tracking",
            "description": "Pridejte gtag.js snippet do vsech stranek webu",
            "code_location": "pseo_html_template.py (wrap_page funkce) + index.html",
            "status": "IMPLEMENTED - viz gtag snippet v HTML sablonach",
        },
        "step_2_conversions": {
            "title": "Nastaveni konverznich akci",
            "actions": [
                {
                    "name": "purchase",
                    "trigger": "Dokonceni objednavky na vyprodej-regalu.cz",
                    "note": "Toto vyzaduje spolupráci s Shoptet (vyprodej-regalu.cz) pro cross-domain tracking",
                },
                {
                    "name": "add_to_cart",
                    "trigger": "Klik na 'Do kosiku' tlacitko",
                    "note": "Implementovano v tracking.js pomoci gtag event",
                },
                {
                    "name": "view_item",
                    "trigger": "Navsteva produktove stranky",
                    "note": "Automaticky z GA4 enhanced measurement",
                },
                {
                    "name": "begin_checkout",
                    "trigger": "Presmerovani na vyprodej-regalu.cz kosik",
                    "note": "Mereno jako klik na externi odkaz do kosiku",
                },
            ],
        },
        "step_3_merchant_center": {
            "title": "Google Merchant Center nastaveni",
            "actions": [
                "Vytvorte ucet na merchants.google.com",
                "Overete vlastnictvi domeny bazarovyregal.cz",
                "Nahrajte merchant_feed.xml (vygeneroval generate_merchant_feed.py)",
                "Nastavte automaticky fetch feedu - URL: https://www.bazarovyregal.cz/merchant_feed.xml",
                "Propojte Merchant Center s Google Ads uctem",
                "Zkontrolujte diagnostiku - opravte pripadne errory",
            ],
        },
        "step_4_google_ads": {
            "title": "Google Ads nastaveni",
            "actions": [
                "Vytvorte kampane dle doporuceni z ads_optimizer.py",
                "Nastavte konverzni akce (purchase, add_to_cart)",
                "Importujte negativni klicova slova",
                "Nastavte audience signals pro PMax",
                "Aktivujte auto-tagging (GCLID)",
            ],
        },
        "step_5_cross_domain": {
            "title": "Cross-domain tracking (bazarovyregal.cz -> vyprodej-regalu.cz)",
            "description": "Dulezite: nakupni proces probiha na vyprodej-regalu.cz",
            "actions": [
                "V GA4: Nastaveni > Data Streams > Configure your domains > pridat vyprodej-regalu.cz",
                "Na vyprodej-regalu.cz: pridat stejny gtag.js snippet s vasim GA4 Measurement ID",
                "Otestovat cross-domain pomoci GA4 DebugView",
            ],
        },
    }


def print_report(monthly_budget_czk):
    """Print comprehensive campaign optimization report."""

    print("\n" + "=" * 70)
    print("  GOOGLE ADS CAMPAIGN OPTIMIZER - Bazarovyregal.cz")
    print("  " + datetime.now().strftime("%Y-%m-%d %H:%M"))
    print("=" * 70)

    # Budget analysis
    print(f"\n  MESICNI ROZPOCET: {monthly_budget_czk:,} CZK")
    print(f"  DENNI ROZPOCET:  {monthly_budget_czk/30:.0f} CZK")

    # Campaign structure
    campaigns = plan_campaign_structure(monthly_budget_czk)

    print(f"\n{'='*70}")
    print("  DOPORUCENA STRUKTURA KAMPANI")
    print(f"{'='*70}")

    for i, c in enumerate(campaigns, 1):
        print(f"\n  [{i}] {c['name']}")
        print(f"      Typ:      {c['type']}")
        print(f"      Rozpocet: {c['daily_budget_czk']} CZK/den ({c['monthly_budget_czk']:,} CZK/mesic)")
        print(f"      Strategie: {c['bid_strategy']}")

        if c.get("product_groups"):
            print(f"      Produktove skupiny:")
            for pg in c["product_groups"]:
                print(f"        - {pg['name']} [{pg['priority']}] (bid: {pg['bid_adjustment']})")

        if c.get("asset_groups"):
            print(f"      Asset skupiny:")
            for ag in c["asset_groups"]:
                print(f"        - {ag['name']}")
                print(f"          URL: {ag['final_url']}")
                print(f"          Audience: {ag['audience_signal']}")

        if c.get("ad_groups"):
            print(f"      Ad Groups:")
            for ag in c["ad_groups"]:
                print(f"        - {ag['name']} ({ag['match_type']})")
                print(f"          Keywords: {', '.join(ag['keywords'][:3])}...")

        if c.get("notes"):
            print(f"      Poznamky:")
            for note in c["notes"]:
                print(f"        * {note}")

    # Projections
    projections = calculate_projections(campaigns)

    print(f"\n{'='*70}")
    print("  PROJEKCE VYSLEDKU (mesicne)")
    print(f"{'='*70}")

    print(f"\n  {'Kampan':<35} {'Kliknuti':>10} {'Konverze':>10} {'ROAS':>8}")
    print(f"  {'-'*63}")
    for cp in projections["by_campaign"]:
        print(f"  {cp['campaign']:<35} {cp['est_clicks']:>10,} {cp['est_conversions']:>10} {cp['est_roas_pct']:>7}%")

    m = projections["monthly"]
    print(f"  {'-'*63}")
    print(f"  {'CELKEM':<35} {m['clicks']:>10,} {m['conversions']:>10} {m['roas_pct']:>7}%")
    print(f"\n  Odhadovane zobrazeni:  {m['impressions']:>12,}")
    print(f"  Odhadovane kliknuti:  {m['clicks']:>12,}")
    print(f"  Odhadovane konverze:  {m['conversions']:>12}")
    print(f"  Odhadovane trzby:     {m['revenue_czk']:>12,} CZK")
    print(f"  Naklady na reklamu:   {m['cost_czk']:>12,} CZK")
    print(f"  Odhadovany zisk:      {m['profit_czk']:>12,} CZK")
    print(f"  ROAS:                 {m['roas_pct']:>12}%")

    # Keywords
    print(f"\n{'='*70}")
    print("  DOPORUCENA KLICOVA SLOVA")
    print(f"{'='*70}")

    print(f"\n  HIGH INTENT (nakupni zamer):")
    for kw in KEYWORDS["high_intent"]:
        print(f"    {kw['keyword']:<35} CPC: {kw['est_cpc']:.1f} CZK  Vol: {kw['est_volume']:>5}/mes")

    print(f"\n  MEDIUM INTENT (vyzkum):")
    for kw in KEYWORDS["medium_intent"]:
        print(f"    {kw['keyword']:<35} CPC: {kw['est_cpc']:.1f} CZK  Vol: {kw['est_volume']:>5}/mes")

    print(f"\n  NEGATIVNI KLICOVA SLOVA (vylouci nepodstatny traffic):")
    for nk in KEYWORDS["negative_keywords"]:
        print(f"    - {nk}")

    # Audience signals
    print(f"\n{'='*70}")
    print("  AUDIENCE SIGNALS PRO PMAX")
    print(f"{'='*70}")

    for seg in AUDIENCE_SIGNALS["custom_segments"]:
        print(f"\n  Segment: {seg['name']}")
        print(f"    Hledane vyrazy: {', '.join(seg['search_terms'][:3])}...")
        print(f"    Konkurencni weby: {', '.join(seg['urls'][:2])}")

    print(f"\n  Demograficke cileni:")
    for demo in AUDIENCE_SIGNALS["demographic_targets"]:
        print(f"    Vek {demo['age']}: {demo['reason']}")

    # Tracking setup
    print(f"\n{'='*70}")
    print("  TRACKING & IMPLEMENTACE")
    print(f"{'='*70}")

    guide = generate_tracking_setup_guide()
    for step_key, step in guide.items():
        print(f"\n  {step['title']}")
        if step.get("actions"):
            for action in step["actions"]:
                if isinstance(action, dict):
                    print(f"    - {action['name']}: {action['trigger']}")
                else:
                    print(f"    - {action}")

    # Quick optimization tips
    print(f"\n{'='*70}")
    print("  TIPY PRO OPTIMALIZACI (minimalizace nakladu)")
    print(f"{'='*70}")

    tips = [
        "1. Zacnete s nizsim rozpoctem a postupne zvysujte na zaklade vysledku",
        "2. Prvnich 14 dni je learning period - nementte nastaveni kampani",
        "3. Kazdy tyden kontrolujte Search Terms Report a pridavejte negative keywords",
        "4. Pouzijte ad schedule - omezete reklamy na hodiny s nejvyssimi konverzemi",
        "5. Cilete geograficky na CR (pripadne i SK pro vyssi zasah)",
        "6. Optimalizujte produktovy feed - titulky s klicovymi slovy zvysuji CTR",
        "7. Pouzijte custom labels ve feedu pro segmentaci produktu v kampanich",
        "8. Testujte ruzne landing pages - A/B testovani zvysuje konverze",
        "9. Nastavte remarketing - navrat navstevniku je 3-5x levnejsi nez novy klik",
        "10. Monitorujte Quality Score - vyssi QS = nizsi CPC",
    ]
    for tip in tips:
        print(f"  {tip}")

    print(f"\n{'='*70}")
    print("  DALSI KROKY")
    print(f"{'='*70}")
    print("""
  1. Spustte generate_merchant_feed.py pro vygenerovani produktoveho feedu
  2. Nahrajte IDs do konfigurace:
     - GA4 Measurement ID (G-XXXXXXXXXX)
     - Google Ads Conversion ID (AW-XXXXXXXXX)
     do souboru tracking_config.js
  3. Vytvorte ucet Google Merchant Center
  4. Nahrajte feed a propojte s Google Ads
  5. Vytvorte kampane dle doporuceni vyse
  6. Sledujte vysledky a optimalizujte tydne
""")

    print("=" * 70)


def export_json(monthly_budget_czk, output_dir):
    """Export full analysis as JSON."""
    campaigns = plan_campaign_structure(monthly_budget_czk)
    projections = calculate_projections(campaigns)
    landing_pages = get_landing_page_recommendations()
    tracking = generate_tracking_setup_guide()

    data = {
        "generated_at": datetime.now().isoformat(),
        "monthly_budget_czk": monthly_budget_czk,
        "campaigns": campaigns,
        "projections": projections,
        "keywords": KEYWORDS,
        "audience_signals": AUDIENCE_SIGNALS,
        "landing_pages": landing_pages,
        "tracking_setup": tracking,
        "benchmarks": BENCHMARKS,
    }

    filepath = os.path.join(output_dir, "ads_plan.json")
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"\n  JSON exported: {filepath}")
    return filepath


def main():
    # Parse arguments
    monthly_budget = 5000  # Default 5000 CZK/month
    output_format = "text"

    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] == "--budget" and i + 1 < len(args):
            monthly_budget = int(args[i + 1])
            i += 2
        elif args[i] == "--format" and i + 1 < len(args):
            output_format = args[i + 1]
            i += 2
        else:
            i += 1

    output_dir = os.path.dirname(os.path.abspath(__file__))

    if output_format == "json":
        export_json(monthly_budget, output_dir)
    else:
        print_report(monthly_budget)

    # Always export JSON alongside text
    if output_format != "json":
        export_json(monthly_budget, output_dir)


if __name__ == "__main__":
    main()
