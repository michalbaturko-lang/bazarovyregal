#!/usr/bin/env python3
"""
Google Ads Campaign Optimizer for Bazarovyregal.cz

Start budget: 5 000 CZK/DEN
Ceiling: 100 000 CZK/DEN (škálování na základě PNO výsledků)
Target: tROAS 667% (PNO 15%)

Ramp-up (na základě PNO výsledků):
  Phase 1 (Týden 1-2):   5K/den  – Manual CPC, sbíráme data
  Phase 2 (30+ konverzí): 5K/den  – Přepínáme na tROAS 667%
  Phase 3 (PNO < 15%):  10K/den  – Škálujeme 2x
  Phase 4 (PNO < 15%):  20K/den  – Přidáváme PMax
  Phase 5 (PNO < 12%):  50K/den  – Plný Shopping + PMax + Search
  Phase 6 (PNO < 10%): 100K/den  – Maximum scale

Starting structure (5K/den):
  Shopping (2 500 Kč/den) – Manual CPC → tROAS 667%
  PMax     (1 500 Kč/den) – Maximize conversions → tROAS 667%
  Search Brand (1 000 Kč/den) – Maximize clicks

Usage:
    python3 ads_optimizer.py                     # Full report (Phase 1)
    python3 ads_optimizer.py --phase 3           # Show Phase 3 budgets
    python3 ads_optimizer.py --format json       # JSON export
    python3 ads_optimizer.py --format csv        # Google Ads Editor CSV
"""

import json
import csv
import sys
import os
from datetime import datetime

from pseo_config import BASE_URL

# ============================================================
# CORE PARAMETERS
# ============================================================

STARTING_DAILY_BUDGET = 5_000    # CZK/den (start)
MAX_DAILY_BUDGET = 100_000       # CZK/den (ceiling)
TARGET_TROAS = 667               # tROAS 667% = PNO 15%
TARGET_PNO = 15                  # PNO 15%
CURRENCY = "CZK"
AOV = 780                        # Average order value CZK
MARGIN_PCT = 0.40                # Marže 40%
CONV_RATE = 0.028                # Conversion rate 2.8%

# ============================================================
# SCALING PHASES (based on PNO results)
# ============================================================

PHASES = {
    1: {
        "daily_budget": 5_000,
        "label": "Phase 1 – Learning (Manual CPC)",
        "trigger": "Start",
        "note": "Manual CPC. Sbíráme data. Neprovádět změny. Sledovat Search Terms.",
        "bid_strategy_override": "Manual CPC",
        "campaigns": ["Shopping", "PMax", "Search Brand"],
    },
    2: {
        "daily_budget": 5_000,
        "label": "Phase 2 – tROAS activation",
        "trigger": "30+ konverzí",
        "note": "Přepínáme Shopping + PMax na tROAS 667%. Brand zůstává Max clicks.",
        "bid_strategy_override": None,  # Use campaign defaults
        "campaigns": ["Shopping", "PMax", "Search Brand"],
    },
    3: {
        "daily_budget": 10_000,
        "label": "Phase 3 – First scale (2x)",
        "trigger": "PNO < 15% stabilně 7 dní",
        "note": "Zdvojnásobení rozpočtu. Přidáváme Search Generic. Sledovat CPA trend.",
        "bid_strategy_override": None,
        "campaigns": ["Shopping", "PMax", "Search Brand", "Search Generic"],
    },
    4: {
        "daily_budget": 20_000,
        "label": "Phase 4 – Adding PMax segments",
        "trigger": "PNO < 15% stabilně 14 dní",
        "note": "Rozdělujeme PMax na segmenty (Garáže, Domácnost, B2B). Přidáváme Search Competitor.",
        "bid_strategy_override": None,
        "campaigns": ["Shopping High Margin", "Shopping Core", "Shopping Low Price",
                       "PMax Garáže", "PMax Domácnost", "PMax B2B",
                       "Search Brand", "Search Generic", "Search Competitor"],
    },
    5: {
        "daily_budget": 50_000,
        "label": "Phase 5 – Aggressive scaling",
        "trigger": "PNO < 12% stabilně",
        "note": "Plná struktura 9 kampaní. tROAS bidding na všech (kromě Brand). Weekly optimalizace.",
        "bid_strategy_override": None,
        "campaigns": ["Shopping High Margin", "Shopping Core", "Shopping Low Price",
                       "PMax Garáže", "PMax Domácnost", "PMax B2B",
                       "Search Brand", "Search Generic", "Search Competitor"],
    },
    6: {
        "daily_budget": 100_000,
        "label": "Phase 6 – Maximum scale",
        "trigger": "PNO < 10% stabilně",
        "note": "Plný rozpočet 100K/den. Denní monitoring. Weekly optimalizace.",
        "bid_strategy_override": None,
        "campaigns": ["Shopping High Margin", "Shopping Core", "Shopping Low Price",
                       "PMax Garáže", "PMax Domácnost", "PMax B2B",
                       "Search Brand", "Search Generic", "Search Competitor"],
    },
}


# ============================================================
# CAMPAIGN DEFINITIONS (all campaigns, activated per phase)
# ============================================================

# --- Phase 1-3: Simple structure ---
CAMPAIGNS_SIMPLE = [
    {
        "name": "Shopping",
        "type": "SHOPPING",
        "budget_pct": 0.50,
        "bid_strategy_default": "Target ROAS",
        "bid_strategy_phase1": "Manual CPC",
        "target_roas": 667,
        "description": "Všechny produkty z feedu. Hlavní kanál.",
        "avg_cpc": 3.5,
        "product_groups": [
            {"name": "Bestsellery", "filter": "custom_label_3 = bestseller", "bid_adj": "+20%"},
            {"name": "Premium (800+ Kč)", "filter": "custom_label_0 = premium OR custom_label_0 = high", "bid_adj": "+15%"},
            {"name": "Mid (600-800 Kč)", "filter": "custom_label_0 = mid", "bid_adj": "+10%"},
            {"name": "Budget (< 600 Kč)", "filter": "custom_label_0 = budget", "bid_adj": "0%"},
        ],
    },
    {
        "name": "PMax",
        "type": "PERFORMANCE_MAX",
        "budget_pct": 0.30,
        "bid_strategy_default": "Target ROAS",
        "bid_strategy_phase1": "Maximize conversions",
        "target_roas": 667,
        "description": "Jeden PMax pro všechny segmenty. Rozdělíme až v Phase 4.",
        "final_url": f"{BASE_URL}/katalog.html",
        "avg_cpc": 5.0,
        "asset_group": {
            "headlines": [
                "Kovové regály – LIKVIDACE SKLADU",
                "Regály od 489 Kč | Záruka 7 let",
                "Slevy až 40% na vše skladem",
                "Bezšroubová montáž za 10 minut",
                "Doprava zdarma nad 2000 Kč",
            ],
            "long_headlines": [
                "Likvidace skladu: Kovové regály za likvidační ceny. Záruka 7 let. Montáž bez nářadí.",
                "Nové kovové regály od 489 Kč. Do garáže, sklepa, dílny. Nosnost až 1050 kg.",
            ],
            "descriptions": [
                "Likvidace skladu! Kovové regály za nejnižší ceny. Nosnost až 1050 kg. Bezšroubová montáž. 7 let záruka. Doprava od 99 Kč.",
                "Nové kovové regály se slevou až 40%. Do garáže, sklepa, dílny. Skladem přes 10 000 ks. Objednejte dnes!",
            ],
            "audience_signal": "Kutilové a domácí majstři",
        },
    },
    {
        "name": "Search Brand",
        "type": "SEARCH",
        "budget_pct": 0.20,
        "bid_strategy_default": "Maximize clicks",
        "bid_strategy_phase1": "Maximize clicks",
        "target_roas": None,
        "description": "Ochrana značky. Nejnižší CPC, nejvyšší CTR.",
        "avg_cpc": 1.0,
        "ad_groups": [
            {
                "name": "Brand - Exact",
                "match_type": "EXACT",
                "keywords": [
                    "bazarovyregal",
                    "bazarovyregal.cz",
                    "bazarovy regal",
                    "bazarový regál",
                ],
            },
            {
                "name": "Brand - Checkout domain",
                "match_type": "EXACT",
                "keywords": [
                    "vyprodej regalu",
                    "vyprodej-regalu.cz",
                    "výprodej regálů",
                ],
            },
        ],
    },
    {
        "name": "Search Generic",
        "type": "SEARCH",
        "budget_pct": 0.00,  # Added in Phase 3
        "bid_strategy_default": "Target ROAS",
        "bid_strategy_phase1": "Manual CPC",
        "target_roas": 667,
        "description": "Generické klíčové slova s nákupním záměrem. Aktivuje se od Phase 3.",
        "avg_cpc": 6.0,
        "ad_groups": [
            {
                "name": "Kovové regály - purchase intent",
                "match_type": "PHRASE",
                "keywords": [
                    "kovové regály levně",
                    "kovový regál akce",
                    "kovové regály výprodej",
                    "levné kovové regály",
                    "kovový regál se slevou",
                ],
            },
            {
                "name": "Regály do garáže",
                "match_type": "PHRASE",
                "keywords": [
                    "regál do garáže",
                    "regál do garáže levně",
                    "kovový regál garáž",
                    "regály do garáže akce",
                ],
            },
            {
                "name": "Regály do sklepa/dílny",
                "match_type": "PHRASE",
                "keywords": [
                    "regál do sklepa",
                    "regál do dílny",
                    "regály do sklepa levně",
                    "skladový regál levně",
                ],
            },
            {
                "name": "Bezšroubové regály",
                "match_type": "PHRASE",
                "keywords": [
                    "bezšroubový regál",
                    "bezšroubové regály",
                    "regál bez šroubů",
                ],
            },
            {
                "name": "Regály podle rozměrů",
                "match_type": "PHRASE",
                "keywords": [
                    "regál 180x90x40",
                    "regál 180 cm",
                    "regál 200 cm",
                    "regál 150x70",
                ],
            },
        ],
    },
]

# --- Phase 4-6: Full structure ---
CAMPAIGNS_FULL = [
    # SHOPPING split
    {
        "name": "Shopping High Margin",
        "type": "SHOPPING",
        "budget_pct": 0.25,
        "bid_strategy_default": "Target ROAS",
        "target_roas": 700,
        "product_filter": "custom_label_0 = high OR custom_label_0 = premium",
        "description": "Profesionální regály 800+ Kč. Nejvyšší marže.",
        "priority": "HIGH",
        "avg_cpc": 5.0,
        "product_groups": [
            {"name": "Profesionální regály", "filter": "custom_label_0 = premium", "bid_adj": "+25%"},
            {"name": "High-margin regály", "filter": "custom_label_0 = high", "bid_adj": "+15%"},
            {"name": "Bestsellery", "filter": "custom_label_3 = bestseller", "bid_adj": "+20%"},
        ],
    },
    {
        "name": "Shopping Core",
        "type": "SHOPPING",
        "budget_pct": 0.20,
        "bid_strategy_default": "Target ROAS",
        "target_roas": 667,
        "product_filter": "custom_label_0 = mid",
        "description": "Střední cenová kategorie 600-800 Kč.",
        "priority": "MEDIUM",
        "avg_cpc": 3.5,
        "product_groups": [
            {"name": "Střední regály - černé", "filter": "custom_label_1 = cerna AND custom_label_0 = mid", "bid_adj": "+10%"},
            {"name": "Střední regály - zinkované", "filter": "custom_label_1 = zinkovany AND custom_label_0 = mid", "bid_adj": "+5%"},
            {"name": "Střední regály - barevné", "filter": "custom_label_1 IN (bila, cervena, modra)", "bid_adj": "0%"},
        ],
    },
    {
        "name": "Shopping Low Price",
        "type": "SHOPPING",
        "budget_pct": 0.10,
        "bid_strategy_default": "Target ROAS",
        "target_roas": 667,
        "product_filter": "custom_label_0 = budget",
        "description": "Budget regály pod 600 Kč.",
        "priority": "LOW",
        "avg_cpc": 2.5,
        "product_groups": [
            {"name": "Budget - zinkované", "filter": "custom_label_0 = budget AND custom_label_1 = zinkovany", "bid_adj": "+5%"},
            {"name": "Budget - ostatní", "filter": "custom_label_0 = budget", "bid_adj": "0%"},
        ],
    },
    # PMAX split
    {
        "name": "PMax Garáže",
        "type": "PERFORMANCE_MAX",
        "budget_pct": 0.10,
        "bid_strategy_default": "Target ROAS",
        "target_roas": 667,
        "description": "Regály do garáže. Kutilové, majitelé domů.",
        "final_url": f"{BASE_URL}/regaly-do-garaze.html",
        "avg_cpc": 4.5,
        "asset_group": {
            "headlines": [
                "Regály do garáže – LIKVIDACE SKLADU",
                "Kovové regály od 489 Kč | Skladem",
                "Zinkované regály do garáže -40%",
                "Nosnost až 875 kg | Záruka 7 let",
                "Bezšroubová montáž za 10 minut",
            ],
            "long_headlines": [
                "Kovové regály do garáže za likvidační ceny. Od 489 Kč. Záruka 7 let.",
                "Pořádek v garáži za 10 minut. Zinkované regály odolné vlhkosti.",
            ],
            "descriptions": [
                "Likvidace skladu! Kovové regály do garáže od 489 Kč. Zinkované, odolné vlhkosti. Nosnost až 875 kg. Záruka 7 let.",
                "Organizujte garáž s kovovými regály za výprodejové ceny. Skladem přes 10 000 ks. Doprava od 99 Kč.",
            ],
            "audience_signal": "Kutilové a domácí majstři",
        },
    },
    {
        "name": "PMax Domácnost",
        "type": "PERFORMANCE_MAX",
        "budget_pct": 0.10,
        "bid_strategy_default": "Target ROAS",
        "target_roas": 667,
        "description": "Regály do domácnosti. Sklep, spíž, dětský pokoj.",
        "final_url": f"{BASE_URL}/regaly-pro-domacnost.html",
        "avg_cpc": 5.0,
        "asset_group": {
            "headlines": [
                "Regály do domu a bytu – SLEVA 40%",
                "Kovové regály do sklepa od 489 Kč",
                "Regály do spíže | Montáž za 10 min",
                "Organizace domácnosti | Od 549 Kč",
                "Regály do dětského pokoje | Skladem",
            ],
            "long_headlines": [
                "Kovové regály pro domácnost. Do sklepa, spíže, komory. Od 489 Kč se zárukou 7 let.",
                "Pořádek v domácnosti snadno a levně. Bezšroubové regály s nosností až 875 kg.",
            ],
            "descriptions": [
                "Kovové regály do domácnosti za výprodejové ceny. Do sklepa, spíže, pokoje. Nosnost až 875 kg. Záruka 7 let.",
                "Likvidace skladu! Regály pro domácnost od 489 Kč. Nové, nerozbalené. Doprava od 99 Kč.",
            ],
            "audience_signal": "Noví majitelé domu/bytu",
        },
    },
    {
        "name": "PMax B2B",
        "type": "PERFORMANCE_MAX",
        "budget_pct": 0.08,
        "bid_strategy_default": "Target ROAS",
        "target_roas": 667,
        "description": "B2B segment. Sklady, kanceláře, e-shopy.",
        "final_url": f"{BASE_URL}/regaly-pro-firmy.html",
        "avg_cpc": 6.0,
        "asset_group": {
            "headlines": [
                "Skladové regály pro firmy – VÝPRODEJ",
                "Profesionální regály | Nosnost 1050 kg",
                "Regály do kanceláře od 549 Kč",
                "Regály pro e-shop sklad | -40%",
                "Vybavení skladu za výprodejové ceny",
            ],
            "long_headlines": [
                "Profesionální skladové regály pro firmy. Nosnost až 1050 kg. Slevy až 40%.",
                "Vybavte celý sklad za zlomek ceny. Kovové regály pro e-shopy a kanceláře.",
            ],
            "descriptions": [
                "Skladové regály pro firmy za velkoobchodní ceny. Nosnost až 1050 kg. Záruka 7 let. Expedice do 24h.",
                "Likvidace skladu! Profesionální regály od 549 Kč. Pro e-shopy, kanceláře, archivy.",
            ],
            "audience_signal": "E-shop provozovatelé a firmy",
        },
    },
    # SEARCH
    {
        "name": "Search Brand",
        "type": "SEARCH",
        "budget_pct": 0.05,
        "bid_strategy_default": "Maximize clicks",
        "target_roas": None,
        "description": "Ochrana značky.",
        "avg_cpc": 1.0,
        "ad_groups": [
            {
                "name": "Brand - Exact",
                "match_type": "EXACT",
                "keywords": ["bazarovyregal", "bazarovyregal.cz", "bazarovy regal", "bazarový regál"],
            },
            {
                "name": "Brand - Checkout domain",
                "match_type": "EXACT",
                "keywords": ["vyprodej regalu", "vyprodej-regalu.cz", "výprodej regálů"],
            },
        ],
    },
    {
        "name": "Search Generic",
        "type": "SEARCH",
        "budget_pct": 0.07,
        "bid_strategy_default": "Target ROAS",
        "target_roas": 667,
        "description": "Generické klíčové slova s nákupním záměrem.",
        "avg_cpc": 6.0,
        "ad_groups": [
            {
                "name": "Kovové regály - purchase",
                "match_type": "PHRASE",
                "keywords": ["kovové regály levně", "kovový regál akce", "kovové regály výprodej", "levné kovové regály"],
            },
            {
                "name": "Regály do garáže",
                "match_type": "PHRASE",
                "keywords": ["regál do garáže", "regál do garáže levně", "kovový regál garáž"],
            },
            {
                "name": "Regály do sklepa/dílny",
                "match_type": "PHRASE",
                "keywords": ["regál do sklepa", "regál do dílny", "regály do sklepa levně", "skladový regál levně"],
            },
            {
                "name": "Bezšroubové regály",
                "match_type": "PHRASE",
                "keywords": ["bezšroubový regál", "bezšroubové regály", "regál bez šroubů"],
            },
        ],
    },
    {
        "name": "Search Competitor",
        "type": "SEARCH",
        "budget_pct": 0.05,
        "bid_strategy_default": "Maximize clicks",
        "target_roas": None,
        "description": "Cílení na konkurenční značky.",
        "avg_cpc": 8.0,
        "ad_groups": [
            {
                "name": "Competitor - DIY řetězce",
                "match_type": "BROAD",
                "keywords": ["hornbach regály kovové", "obi kovový regál", "bauhaus regály", "mountfield regály"],
            },
            {
                "name": "Competitor - Online",
                "match_type": "BROAD",
                "keywords": ["mall.cz regály", "alza regály"],
            },
        ],
    },
]


# ============================================================
# NEGATIVE KEYWORDS
# ============================================================

NEGATIVE_KEYWORDS = {
    "campaign_level": [
        "dřevěné regály", "drevene regaly",
        "ikea regály", "ikea regaly",
        "plastové regály", "plastove regaly",
        "knihovna",
        "regál na boty", "regal na boty",
        "použité regály", "pouzite regaly",
        "bazarové regály použité",
        "starý regál", "stary regal",
        "regál na stěnu", "nástěnný regál",
        "paletové regály", "paletove regaly",
        "průjezdné regály", "prujezdne regaly",
        "regál na víno", "regal na vino",
        "regál do koupelny", "regál na květiny",
    ],
    "brand_campaign_negatives": [
        "bazar", "bazarový", "použitý", "starý", "ojetý", "second hand",
    ],
}

# ============================================================
# AUDIENCE SIGNALS
# ============================================================

AUDIENCE_SIGNALS = {
    "custom_segments": [
        {
            "name": "Kutilové a domácí majstři",
            "search_terms": [
                "regály do garáže", "organizace garáže", "úložné systémy dílna",
                "nářadí organizace", "jak zorganizovat garáž", "DIY garáž",
            ],
            "competitor_urls": [
                "https://www.hornbach.cz", "https://www.obi.cz",
                "https://www.bauhaus.cz", "https://www.mountfield.cz",
            ],
        },
        {
            "name": "E-shop provozovatelé a firmy",
            "search_terms": [
                "skladové regály", "vybavení skladu", "regály pro eshop",
                "organizace skladu", "vybavení kanceláře",
            ],
            "competitor_urls": [
                "https://www.shoptet.cz", "https://www.upgates.cz",
                "https://www.b2bpartner.cz",
            ],
        },
        {
            "name": "Noví majitelé domu/bytu",
            "search_terms": [
                "vybavení garáže", "organizace sklepa", "regály do bytu",
                "stěhování", "zařízení domu",
            ],
            "competitor_urls": [
                "https://www.sreality.cz", "https://www.bezrealitky.cz",
            ],
        },
    ],
    "demographic_targets": [
        {"age": "25-34", "gender": "All", "reason": "Mladí majitelé domů, začínající podnikatelé"},
        {"age": "35-54", "gender": "All", "reason": "Hlavní nakupující segment, DIY, firmy"},
        {"age": "55-64", "gender": "Male", "reason": "Seniori, garáž/dílna organizace"},
    ],
    "life_events": [
        "Nedávno se přestěhoval",
        "Koupil nový dům/byt",
        "Založení firmy",
    ],
}

# ============================================================
# BENCHMARKS
# ============================================================

BENCHMARKS = {
    "shopping_avg_cpc": 3.50,
    "pmax_avg_cpc": 5.00,
    "search_brand_cpc": 1.00,
    "search_generic_cpc": 6.00,
    "search_competitor_cpc": 8.00,
    "conversion_rate": CONV_RATE,
    "aov": AOV,
    "margin": MARGIN_PCT,
}


# ============================================================
# PROJECTIONS ENGINE
# ============================================================

def get_campaigns_for_phase(phase):
    """Get the right campaign list for the phase."""
    if phase <= 3:
        return CAMPAIGNS_SIMPLE
    return CAMPAIGNS_FULL


def get_budget_allocation(phase):
    """Return budget allocations for campaigns in a given phase."""
    phase_info = PHASES.get(phase, PHASES[1])
    daily_total = phase_info["daily_budget"]
    active_campaign_names = phase_info["campaigns"]
    campaigns = get_campaigns_for_phase(phase)

    allocations = []
    for c in campaigns:
        if c["name"] not in active_campaign_names:
            continue

        # For simple structure (Phase 1-3), use predefined percentages
        if phase <= 3:
            if c["name"] == "Shopping":
                daily = round(daily_total * 0.50)
            elif c["name"] == "PMax":
                daily = round(daily_total * 0.30)
            elif c["name"] == "Search Brand":
                daily = round(daily_total * 0.20)
            elif c["name"] == "Search Generic":
                daily = round(daily_total * 0.10) if phase >= 3 else 0
            else:
                daily = round(daily_total * c["budget_pct"])
            # Adjust for Phase 3 which adds Search Generic
            if phase == 3:
                if c["name"] == "Shopping":
                    daily = round(daily_total * 0.45)
                elif c["name"] == "PMax":
                    daily = round(daily_total * 0.25)
                elif c["name"] == "Search Brand":
                    daily = round(daily_total * 0.15)
                elif c["name"] == "Search Generic":
                    daily = round(daily_total * 0.15)
        else:
            daily = round(daily_total * c["budget_pct"])

        if daily <= 0:
            continue

        # Determine bid strategy
        bid_strategy = c["bid_strategy_default"] if not phase_info.get("bid_strategy_override") else phase_info["bid_strategy_override"]
        # Brand always stays on Maximize clicks
        if c["name"] == "Search Brand":
            bid_strategy = "Maximize clicks"

        allocations.append({
            "campaign": c,
            "daily_budget": daily,
            "monthly_budget": daily * 30,
            "bid_strategy": bid_strategy,
        })

    return allocations


def calculate_projections(phase=1):
    """Calculate traffic, conversion, and revenue projections."""
    allocations = get_budget_allocation(phase)
    results = []

    for alloc in allocations:
        c = alloc["campaign"]
        daily_budget = alloc["daily_budget"]
        monthly_budget = alloc["monthly_budget"]
        avg_cpc = c["avg_cpc"]

        est_clicks_daily = int(daily_budget / avg_cpc)
        est_clicks_monthly = est_clicks_daily * 30
        est_conversions_monthly = int(est_clicks_monthly * CONV_RATE)
        est_revenue_monthly = est_conversions_monthly * AOV

        actual_roas = (est_revenue_monthly / monthly_budget * 100) if monthly_budget > 0 else 0
        actual_pno = (monthly_budget / est_revenue_monthly * 100) if est_revenue_monthly > 0 else 0
        profit = est_revenue_monthly * MARGIN_PCT - monthly_budget

        results.append({
            "campaign": c["name"],
            "type": c["type"],
            "daily_budget": daily_budget,
            "monthly_budget": monthly_budget,
            "bid_strategy": alloc["bid_strategy"],
            "target_roas": c.get("target_roas"),
            "avg_cpc": avg_cpc,
            "est_clicks_daily": est_clicks_daily,
            "est_clicks_monthly": est_clicks_monthly,
            "est_conversions_monthly": est_conversions_monthly,
            "est_revenue_monthly": est_revenue_monthly,
            "est_roas_pct": round(actual_roas),
            "est_pno_pct": round(actual_pno, 1),
            "est_profit_monthly": round(profit),
        })

    return results


def calculate_totals(projections):
    """Sum up totals from projections."""
    totals = {
        "daily_budget": sum(p["daily_budget"] for p in projections),
        "monthly_budget": sum(p["monthly_budget"] for p in projections),
        "est_clicks_monthly": sum(p["est_clicks_monthly"] for p in projections),
        "est_conversions_monthly": sum(p["est_conversions_monthly"] for p in projections),
        "est_revenue_monthly": sum(p["est_revenue_monthly"] for p in projections),
    }
    totals["est_roas_pct"] = round(
        totals["est_revenue_monthly"] / totals["monthly_budget"] * 100
    ) if totals["monthly_budget"] > 0 else 0
    totals["est_pno_pct"] = round(
        totals["monthly_budget"] / totals["est_revenue_monthly"] * 100, 1
    ) if totals["est_revenue_monthly"] > 0 else 0
    totals["est_profit_monthly"] = round(
        totals["est_revenue_monthly"] * MARGIN_PCT - totals["monthly_budget"]
    )
    return totals


# ============================================================
# REPORT GENERATOR
# ============================================================

def print_report(phase=1):
    """Print comprehensive campaign report."""
    phase_info = PHASES.get(phase, PHASES[1])
    projections = calculate_projections(phase)
    totals = calculate_totals(projections)

    print("\n" + "=" * 75)
    print("  GOOGLE ADS CAMPAIGN OPTIMIZER – Bazarovyregal.cz")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 75)

    # Phase overview
    print(f"\n  START: {STARTING_DAILY_BUDGET:,} CZK/den | CEILING: {MAX_DAILY_BUDGET:,} CZK/den")
    print(f"  TARGET: tROAS {TARGET_TROAS}% | PNO {TARGET_PNO}%")
    print(f"\n  ŠKÁLOVACÍ PLÁN (na základě PNO výsledků):")
    for p, info in PHASES.items():
        marker = " <<<" if p == phase else ""
        print(f"    Phase {p}: {info['daily_budget']:>7,} CZK/den  –  {info['label']}")
        print(f"             Trigger: {info['trigger']}{marker}")

    print(f"\n  AKTUÁLNÍ: Phase {phase} – {phase_info['label']}")
    print(f"  Denní rozpočet:   {phase_info['daily_budget']:>10,} CZK")
    print(f"  Měsíční rozpočet: {phase_info['daily_budget'] * 30:>9,} CZK")
    print(f"  Bid strategy:     {phase_info.get('bid_strategy_override', 'Per campaign (viz níže)')}")
    print(f"  Poznámka: {phase_info['note']}")

    # Campaign structure
    campaigns = get_campaigns_for_phase(phase)
    active_names = phase_info["campaigns"]

    print(f"\n{'=' * 75}")
    print(f"  AKTIVNÍ KAMPANĚ – Phase {phase}")
    print(f"{'=' * 75}")

    for i, p in enumerate(projections, 1):
        # Find campaign definition
        c = None
        for camp in campaigns:
            if camp["name"] == p["campaign"]:
                c = camp
                break
        if not c:
            continue

        print(f"\n  [{i}] {c['name']}")
        print(f"      Typ:        {c['type']}")
        print(f"      Rozpočet:   {p['daily_budget']:,} CZK/den ({p['monthly_budget']:,} CZK/měsíc)")
        print(f"      Strategie:  {p['bid_strategy']}", end="")
        if c.get("target_roas") and "Manual" not in p["bid_strategy"] and "Maximize" not in p["bid_strategy"]:
            print(f" ({c['target_roas']}%)", end="")
        print()
        print(f"      Avg CPC:    {c['avg_cpc']} CZK")
        print(f"      Popis:      {c['description']}")

        if c.get("product_groups"):
            print(f"      Produktové skupiny:")
            for pg in c["product_groups"]:
                print(f"        • {pg['name']} (bid: {pg['bid_adj']})")

        if c.get("asset_group"):
            ag = c["asset_group"]
            print(f"      Asset group:")
            print(f"        Headlines:  {ag['headlines'][0]}")
            print(f"                    {ag['headlines'][1]}")
            print(f"        Audience:   {ag['audience_signal']}")
            print(f"        Landing:    {c.get('final_url', BASE_URL)}")

        if c.get("ad_groups"):
            print(f"      Ad Groups:")
            for ag in c["ad_groups"]:
                kws = ", ".join(ag["keywords"][:3])
                print(f"        • {ag['name']} [{ag['match_type']}]: {kws}...")

    # Projections table
    print(f"\n{'=' * 75}")
    print(f"  PROJEKCE VÝSLEDKŮ – Phase {phase}")
    print(f"{'=' * 75}")

    header = f"  {'Kampaň':<28} {'Budget/den':>10} {'Kliknutí':>9} {'Konverze':>9} {'Tržby':>10} {'ROAS':>7} {'PNO':>6}"
    print(f"\n{header}")
    print(f"  {'-' * 79}")

    for p in projections:
        name = p["campaign"][:28]
        print(f"  {name:<28} {p['daily_budget']:>9,} {p['est_clicks_monthly']:>9,} "
              f"{p['est_conversions_monthly']:>9} {p['est_revenue_monthly']:>9,} "
              f"{p['est_roas_pct']:>6}% {p['est_pno_pct']:>5.1f}%")

    print(f"  {'-' * 79}")
    print(f"  {'CELKEM':<28} {totals['daily_budget']:>9,} {totals['est_clicks_monthly']:>9,} "
          f"{totals['est_conversions_monthly']:>9} {totals['est_revenue_monthly']:>9,} "
          f"{totals['est_roas_pct']:>6}% {totals['est_pno_pct']:>5.1f}%")

    print(f"\n  Měsíční náklady:    {totals['monthly_budget']:>12,} CZK")
    print(f"  Měsíční tržby:      {totals['est_revenue_monthly']:>12,} CZK")
    print(f"  Měsíční zisk:       {totals['est_profit_monthly']:>12,} CZK")
    print(f"  ROAS:               {totals['est_roas_pct']:>12}%")
    print(f"  PNO:                {totals['est_pno_pct']:>11.1f}%")

    # Bid strategy transition guide
    print(f"\n{'=' * 75}")
    print("  BID STRATEGY PŘECHOD")
    print(f"{'=' * 75}")
    print("""
  START (Phase 1):  Manual CPC na Shopping + PMax
    → Nastavit max CPC = 5 Kč pro Shopping, 7 Kč pro PMax
    → Sbíráme konverzní data

  PO 30+ KONVERZÍCH (Phase 2):
    → Shopping: přepnout na Target ROAS 667%
    → PMax: přepnout na Target ROAS 667%
    → Brand Search: ponechat Maximize clicks

  ŠKÁLOVÁNÍ (Phase 3+):
    → Zvyšovat budget pouze pokud PNO < 15%
    → Zvyšovat max 2x za fázi
    → Nikdy neškálovat během learning period (7 dní po změně)
""")

    # Negative keywords
    print(f"{'=' * 75}")
    print("  NEGATIVNÍ KLÍČOVÁ SLOVA")
    print(f"{'=' * 75}")

    print(f"\n  Campaign-level (všechny kampaně):")
    for nk in NEGATIVE_KEYWORDS["campaign_level"]:
        print(f"    – {nk}")

    print(f"\n  Brand kampaň – extra negative:")
    for nk in NEGATIVE_KEYWORDS["brand_campaign_negatives"]:
        print(f"    – {nk}")

    # Implementation checklist
    print(f"\n{'=' * 75}")
    print("  IMPLEMENTAČNÍ CHECKLIST")
    print(f"{'=' * 75}")
    checklist = [
        "1. Vyplnit IDs v tracking_config.js (GA4 + Google Ads)",
        "2. Nahrát merchant_feed.xml do Google Merchant Center",
        "3. Propojit Merchant Center s Google Ads",
        "4. Vytvořit 3 kampaně: Shopping + PMax + Search Brand",
        "5. Nastavit Manual CPC (Shopping max 5 Kč, PMax max 7 Kč)",
        "6. Importovat negativní klíčová slova",
        "7. Nasadit checkout_tracking_snippet.html na vyprodej-regalu.cz",
        "8. V GA4 přidat cross-domain: bazarovyregal.cz + vyprodej-regalu.cz",
        "9. Aktivovat Enhanced Conversions v Google Ads",
        "10. Po 30+ konverzích přepnout na tROAS 667%",
        "11. Škálovat budget na základě PNO výsledků (viz fáze výše)",
    ]
    for item in checklist:
        print(f"  {item}")

    print(f"\n{'=' * 75}\n")


# ============================================================
# GOOGLE ADS EDITOR CSV EXPORT
# ============================================================

def export_google_ads_csv(phase=1, output_dir="."):
    """Export campaign structure as Google Ads Editor CSV."""
    projections = calculate_projections(phase)
    campaigns = get_campaigns_for_phase(phase)
    filepath = os.path.join(output_dir, "google_ads_campaigns.csv")

    rows = []
    for p in projections:
        # Find campaign definition
        c = None
        for camp in campaigns:
            if camp["name"] == p["campaign"]:
                c = camp
                break
        if not c:
            continue

        # Campaign row
        row = {
            "Campaign": c["name"],
            "Campaign Type": c["type"].replace("PERFORMANCE_MAX", "Performance Max"),
            "Campaign Daily Budget": p["daily_budget"],
            "Bid Strategy Type": p["bid_strategy"],
            "Target ROAS": c.get("target_roas", ""),
            "Campaign Status": "Paused",
            "Ad Group": "",
            "Keyword": "",
            "Match Type": "",
            "Max CPC": "",
            "Final URL": c.get("final_url", f"{BASE_URL}/katalog.html"),
            "Headline 1": "", "Headline 2": "", "Headline 3": "",
            "Description 1": "", "Description 2": "",
        }
        rows.append(row)

        # Search campaign keywords
        if c.get("ad_groups"):
            for ag in c["ad_groups"]:
                for kw in ag["keywords"]:
                    rows.append({
                        "Campaign": c["name"],
                        "Campaign Type": "", "Campaign Daily Budget": "",
                        "Bid Strategy Type": "", "Target ROAS": "", "Campaign Status": "",
                        "Ad Group": ag["name"],
                        "Keyword": kw,
                        "Match Type": ag["match_type"].capitalize(),
                        "Max CPC": "",
                        "Final URL": c.get("final_url", f"{BASE_URL}/katalog.html"),
                        "Headline 1": "", "Headline 2": "", "Headline 3": "",
                        "Description 1": "", "Description 2": "",
                    })

        # PMax asset groups
        if c.get("asset_group"):
            ag = c["asset_group"]
            rows.append({
                "Campaign": c["name"],
                "Campaign Type": "", "Campaign Daily Budget": "",
                "Bid Strategy Type": "", "Target ROAS": "", "Campaign Status": "",
                "Ad Group": f"Asset Group – {c['name']}",
                "Keyword": "", "Match Type": "", "Max CPC": "",
                "Final URL": c.get("final_url", f"{BASE_URL}/katalog.html"),
                "Headline 1": ag["headlines"][0] if ag["headlines"] else "",
                "Headline 2": ag["headlines"][1] if len(ag["headlines"]) > 1 else "",
                "Headline 3": ag["headlines"][2] if len(ag["headlines"]) > 2 else "",
                "Description 1": ag["descriptions"][0] if ag["descriptions"] else "",
                "Description 2": ag["descriptions"][1] if len(ag["descriptions"]) > 1 else "",
            })

    fieldnames = [
        "Campaign", "Campaign Type", "Campaign Daily Budget",
        "Bid Strategy Type", "Target ROAS", "Campaign Status",
        "Ad Group", "Keyword", "Match Type", "Max CPC", "Final URL",
        "Headline 1", "Headline 2", "Headline 3",
        "Description 1", "Description 2",
    ]

    with open(filepath, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    # Negative keywords CSV
    neg_filepath = os.path.join(output_dir, "google_ads_negative_keywords.csv")
    with open(neg_filepath, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(["Campaign", "Ad Group", "Keyword", "Match Type"])
        active_names = PHASES.get(phase, PHASES[1])["campaigns"]
        for nk in NEGATIVE_KEYWORDS["campaign_level"]:
            for camp in campaigns:
                if camp["name"] in active_names:
                    writer.writerow([camp["name"], "", nk, "Phrase"])
        for nk in NEGATIVE_KEYWORDS["brand_campaign_negatives"]:
            writer.writerow(["Search Brand", "", nk, "Exact"])

    print(f"  CSV exported: {filepath}")
    print(f"  Negative keywords CSV: {neg_filepath}")
    return filepath


# ============================================================
# JSON EXPORT
# ============================================================

def export_json(phase=1, output_dir="."):
    """Export full analysis as JSON."""
    projections = calculate_projections(phase)
    totals = calculate_totals(projections)

    data = {
        "generated_at": datetime.now().isoformat(),
        "starting_daily_budget": STARTING_DAILY_BUDGET,
        "max_daily_budget": MAX_DAILY_BUDGET,
        "target_troas": TARGET_TROAS,
        "target_pno": TARGET_PNO,
        "current_phase": phase,
        "phases": {str(k): v for k, v in PHASES.items()},
        "campaigns": [p for p in projections],
        "totals": totals,
        "negative_keywords": NEGATIVE_KEYWORDS,
        "audience_signals": AUDIENCE_SIGNALS,
        "benchmarks": BENCHMARKS,
    }

    filepath = os.path.join(output_dir, "ads_plan.json")
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=str)
    print(f"  JSON exported: {filepath}")
    return filepath


# ============================================================
# MAIN
# ============================================================

def main():
    output_format = "text"
    phase = 1  # Default to Phase 1 (starting budget)

    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] == "--format" and i + 1 < len(args):
            output_format = args[i + 1]
            i += 2
        elif args[i] == "--phase" and i + 1 < len(args):
            phase = int(args[i + 1])
            i += 2
        elif args[i] == "--week" and i + 1 < len(args):
            # Backward compat: map week to phase
            phase = int(args[i + 1])
            i += 2
        else:
            i += 1

    output_dir = os.path.dirname(os.path.abspath(__file__))

    if output_format == "json":
        export_json(phase, output_dir)
    elif output_format == "csv":
        export_google_ads_csv(phase, output_dir)
    else:
        print_report(phase)
        export_json(phase, output_dir)
        export_google_ads_csv(phase, output_dir)


if __name__ == "__main__":
    main()
