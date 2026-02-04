#!/usr/bin/env python3
"""
SEO Page Regenerator for Bazarovyregal.cz
Generates rich, unique content with contextual internal linking
"""

import os
import re
import json
from pathlib import Path

# ============================================================================
# PRODUCT DATABASE - All products with their attributes
# ============================================================================

PRODUCTS = [
    # Zinkované regály - do vlhka (sklep, garáž)
    {"file": "regal-150x70x30-zinkovany.html", "name": "Regál 150×70×30 cm zinkovaný", "price": 659, "old_price": 2636, "capacity": 700, "shelves": 4, "color": "zinkovaný", "height": 150, "width": 70, "depth": 30, "environment": "vlhké", "use": ["sklep", "garáž", "dílna"], "img": "https://vyprodej-regalucz.s26.cdn-upgates.com/z/z6914605330838-5-pol-pravy-zink.jpg"},
    {"file": "regal-180x40x30-zinkovany.html", "name": "Regál 180×40×30 cm zinkovaný", "price": 679, "old_price": 2716, "capacity": 875, "shelves": 5, "color": "zinkovaný", "height": 180, "width": 40, "depth": 30, "environment": "vlhké", "use": ["sklep", "spíž", "úzké prostory"], "img": "https://vyprodej-regalucz.s26.cdn-upgates.com/z/z6914605330838-5-pol-pravy-zink.jpg"},
    {"file": "regal-180x90x40-zinkovany.html", "name": "Regál 180×90×40 cm zinkovaný", "price": 739, "old_price": 2956, "capacity": 875, "shelves": 5, "color": "zinkovaný", "height": 180, "width": 90, "depth": 40, "environment": "vlhké", "use": ["garáž", "sklep", "dílna"], "img": "https://vyprodej-regalucz.s26.cdn-upgates.com/z/z6914605330838-5-pol-pravy-zink.jpg"},

    # Černé regály - elegantní do interiéru
    {"file": "regal-150x70x30-cerna.html", "name": "Regál 150×70×30 cm černý", "price": 709, "old_price": 2836, "capacity": 700, "shelves": 4, "color": "černý", "height": 150, "width": 70, "depth": 30, "environment": "suché", "use": ["kancelář", "obývák", "ložnice"], "img": "https://vyprodej-regalucz.s26.cdn-upgates.com/l/l690377af7480a-1-regal-1800x900x400-mm-lakovany-5-policovy-nosnost-875-kg-cerny-pravy-18090405875black1.jpeg"},
    {"file": "regal-180x90x40-cerna.html", "name": "Regál 180×90×40 cm černý", "price": 739, "old_price": 2956, "capacity": 875, "shelves": 5, "color": "černý", "height": 180, "width": 90, "depth": 40, "environment": "suché", "use": ["kancelář", "dílna", "garáž"], "img": "https://vyprodej-regalucz.s26.cdn-upgates.com/l/l690377af7480a-1-regal-1800x900x400-mm-lakovany-5-policovy-nosnost-875-kg-cerny-pravy-18090405875black1.jpeg"},
    {"file": "regal-200x90x40-cerna.html", "name": "Regál 200×90×40 cm černý", "price": 849, "old_price": 3396, "capacity": 875, "shelves": 5, "color": "černý", "height": 200, "width": 90, "depth": 40, "environment": "suché", "use": ["sklad", "dílna", "garáž"], "img": "https://vyprodej-regalucz.s26.cdn-upgates.com/l/l690377af7480a-1-regal-1800x900x400-mm-lakovany-5-policovy-nosnost-875-kg-cerny-pravy-18090405875black1.jpeg"},

    # Bílé regály - do domácnosti
    {"file": "regal-150x70x30-bila.html", "name": "Regál 150×70×30 cm bílý", "price": 709, "old_price": 2836, "capacity": 700, "shelves": 4, "color": "bílý", "height": 150, "width": 70, "depth": 30, "environment": "suché", "use": ["koupelna", "kuchyně", "ložnice", "dětský pokoj"], "img": "https://vyprodej-regalucz.s26.cdn-upgates.com/b/b1753e36e3f0cc-1-regal-1500x700x300-mm-lakovany-4-policovy-nosnost-700-kg-bily-pravy-15070304700white1.jpeg"},
    {"file": "regal-180x120x45-bila.html", "name": "Regál 180×120×45 cm bílý", "price": 949, "old_price": 3796, "capacity": 875, "shelves": 5, "color": "bílý", "height": 180, "width": 120, "depth": 45, "environment": "suché", "use": ["šatna", "kancelář", "obývák"], "img": "https://vyprodej-regalucz.s26.cdn-upgates.com/b/b1753e36e3f0cc-1-regal-1500x700x300-mm-lakovany-4-policovy-nosnost-700-kg-bily-pravy-15070304700white1.jpeg"},

    # Červené regály
    {"file": "regal-150x70x30-cervena.html", "name": "Regál 150×70×30 cm červený", "price": 709, "old_price": 2836, "capacity": 700, "shelves": 4, "color": "červený", "height": 150, "width": 70, "depth": 30, "environment": "suché", "use": ["dílna", "garáž", "dětský pokoj"], "img": "https://vyprodej-regalucz.s26.cdn-upgates.com/c/c1753e36e3f0cc-regal-cerveny.jpeg"},

    # Profesionální regály
    {"file": "regal-180x120x50-profesionalni.html", "name": "Regál profesionální 180×120×50 cm", "price": 1009, "old_price": 4036, "capacity": 1050, "shelves": 5, "color": "modro-oranžový", "height": 180, "width": 120, "depth": 50, "environment": "průmyslové", "use": ["sklad", "dílna", "garáž", "průmysl"], "img": "https://vyprodej-regalucz.s26.cdn-upgates.com/_cache/b/1/b17ce5b491bdb73a0df3160b51fbcf7e-1-regal-1800x1200x500-mm-lakovany-5-policovy-nosnost-1050-kg-modro-oranzovy-pravy-18120501050orangeblue1.jpeg"},
]

# ============================================================================
# TOPIC CATEGORIES - Different types of content for different topics
# ============================================================================

CATEGORIES = {
    "garáž": {
        "keywords": ["garáž", "garaze", "garazovy", "auto", "pneumatik", "pneu", "naradi"],
        "description": "Regály do garáže musí odolat náročným podmínkám - vlhkosti, prachu a těžkým předmětům jako jsou pneumatiky či nářadí.",
        "recommended_products": ["zinkovaný", "černý", "profesionální"],
        "environment": "vlhké",
        "typical_items": ["pneumatiky", "nářadí", "oleje", "autochemie", "náhradní díly", "kola"],
        "tips": [
            "Pro pneumatiky volte regál s hloubkou min. 40 cm",
            "Zinkované regály odolají vlhkosti v nevytápěné garáži",
            "Nosnost 175+ kg na polici je ideální pro těžké nářadí"
        ]
    },
    "sklep": {
        "keywords": ["sklep", "sklepa", "sklepni", "vlhk"],
        "description": "Sklepní prostory vyžadují regály odolné vůči vlhkosti. Pozinkované provedení je zde nezbytností.",
        "recommended_products": ["zinkovaný"],
        "environment": "vlhké",
        "typical_items": ["zavařeniny", "víno", "brambory", "zelenina", "nápoje", "zásoby"],
        "tips": [
            "Zinkovaný povrch je odolný vůči vlhkosti a korozi",
            "Pro víno volte regál s hloubkou 30-40 cm",
            "Umístěte regál 5 cm od zdi pro cirkulaci vzduchu"
        ]
    },
    "dílna": {
        "keywords": ["diln", "dilensk", "ponk", "pracovn", "stul"],
        "description": "V dílně potřebujete robustní regály s vysokou nosností pro nářadí, materiál a komponenty.",
        "recommended_products": ["černý", "profesionální", "zinkovaný"],
        "environment": "průmyslové",
        "typical_items": ["nářadí", "šrouby", "materiál", "stroje", "boxy", "komponenty"],
        "tips": [
            "Profesionální regály unesou až 210 kg na polici",
            "Černá barva maskuje drobné škrábance a nečistoty",
            "Kombinujte s úložnými boxy pro drobný materiál"
        ]
    },
    "kuchyně": {
        "keywords": ["kuchyn", "spiz", "potrav", "jidl"],
        "description": "Regály do kuchyně a spíže pomáhají s organizací potravin a kuchyňského náčiní.",
        "recommended_products": ["bílý", "zinkovaný"],
        "environment": "suché",
        "typical_items": ["potraviny", "konzervy", "koření", "nádobí", "spotřebiče", "zásoby"],
        "tips": [
            "Bílé regály ladí s většinou kuchyní",
            "Do spíže volte užší regál (30-40 cm) pro lepší přehled",
            "Nastavitelné police umožní přizpůsobit výšku obsahu"
        ]
    },
    "koupelna": {
        "keywords": ["koupeln", "pracka", "toalet", "hygien"],
        "description": "Koupelnové regály musí být odolné vůči vlhkosti a často úzké kvůli omezenému prostoru.",
        "recommended_products": ["bílý", "zinkovaný"],
        "environment": "vlhké",
        "typical_items": ["ručníky", "kosmetika", "prací prostředky", "toaletní potřeby"],
        "tips": [
            "Úzké regály (30-40 cm) se vejdou i do malých koupelen",
            "Bílá barva opticky zvětšuje prostor",
            "Regál nad pračku šetří místo"
        ]
    },
    "kancelář": {
        "keywords": ["kancelar", "sanon", "dokument", "archiv", "pracovn"],
        "description": "Kancelářské regály slouží k ukládání dokumentů, šanonů a kancelářských potřeb.",
        "recommended_products": ["bílý", "černý"],
        "environment": "suché",
        "typical_items": ["šanony", "dokumenty", "knihy", "kancelářské potřeby", "technika"],
        "tips": [
            "Pro šanony volte hloubku min. 30 cm",
            "Černé regály působí profesionálně",
            "5 polic pojme až 50 šanonů"
        ]
    },
    "knihy": {
        "keywords": ["knih", "knihovn", "cteni", "literatura"],
        "description": "Knihovny a regály na knihy vyžadují dostatečnou nosnost a správnou hloubku polic.",
        "recommended_products": ["bílý", "černý"],
        "environment": "suché",
        "typical_items": ["knihy", "časopisy", "alba", "dekorace"],
        "tips": [
            "Hloubka 25-30 cm je ideální pro většinu knih",
            "Nastavitelné police umožní přizpůsobit výšku různým formátům",
            "Nosnost 175 kg/police pojme i těžké encyklopedie"
        ]
    },
    "šatna": {
        "keywords": ["satn", "oble", "saty", "boty", "obuv"],
        "description": "Šatní regály pomohou s organizací oblečení, bot a doplňků.",
        "recommended_products": ["bílý", "černý"],
        "environment": "suché",
        "typical_items": ["oblečení", "boty", "tašky", "doplňky", "boxy"],
        "tips": [
            "Bílé regály ladí s většinou šaten",
            "Pro boty volte regál s více policemi",
            "Kombinujte s úložnými boxy pro drobnosti"
        ]
    },
    "děti": {
        "keywords": ["detsk", "hracky", "hrac", "dite"],
        "description": "Dětské regály na hračky musí být stabilní a bezpečné.",
        "recommended_products": ["bílý", "červený"],
        "environment": "suché",
        "typical_items": ["hračky", "knihy", "hry", "stavebnice", "plyšáci"],
        "tips": [
            "Nižší regály (150 cm) jsou bezpečnější pro děti",
            "Barevné regály oživí dětský pokoj",
            "Ukotvení ke zdi zvyšuje stabilitu"
        ]
    },
    "víno": {
        "keywords": ["vin", "lahv", "alkohol"],
        "description": "Regály na víno musí zajistit správné skladování lahví v horizontální poloze.",
        "recommended_products": ["zinkovaný", "černý"],
        "environment": "vlhké",
        "typical_items": ["lahve vína", "nápoje", "sklenice"],
        "tips": [
            "Zinkované regály jsou ideální do vinného sklepa",
            "Hloubka 30 cm stačí pro většinu lahví",
            "Udržujte konstantní teplotu 10-15°C"
        ]
    },
    "kovové": {
        "keywords": ["kovov", "kov", "ocel", "metal"],
        "description": "Kovové regály jsou nejodolnější volbou pro náročné použití. Nabízejí vysokou nosnost a dlouhou životnost.",
        "recommended_products": ["zinkovaný", "černý", "profesionální"],
        "environment": "univerzální",
        "typical_items": ["těžké předměty", "nářadí", "zásoby", "materiál"],
        "tips": [
            "Ocelová konstrukce unese až 1050 kg",
            "Bezšroubová montáž za 10 minut",
            "7letá záruka na všechny regály"
        ]
    },
    "police": {
        "keywords": ["polic", "polick"],
        "description": "Police a regálové systémy nabízejí flexibilní řešení pro různé prostory a potřeby.",
        "recommended_products": ["bílý", "černý", "zinkovaný"],
        "environment": "univerzální",
        "typical_items": ["různé předměty", "dekorace", "knihy", "zásoby"],
        "tips": [
            "Nastavitelné police lze přizpůsobit obsahu",
            "4-5 polic na jeden regál je optimální",
            "Nosnost 175-210 kg na polici"
        ]
    },
    "levné": {
        "keywords": ["levn", "slev", "akc", "vyprode", "bazar"],
        "description": "Hledáte kvalitní regál za rozumnou cenu? Naše regály nabízejí nejlepší poměr cena/výkon na trhu.",
        "recommended_products": ["zinkovaný", "černý"],
        "environment": "univerzální",
        "typical_items": ["různé předměty"],
        "tips": [
            "Slevy až 75% z běžné ceny",
            "Stejná kvalita jako dražší značky",
            "Doprava zdarma nad 2000 Kč"
        ]
    },
    "default": {
        "keywords": [],
        "description": "Kvalitní kovové regály pro domácnost, dílnu i sklad. Vysoká nosnost, snadná montáž, 7letá záruka.",
        "recommended_products": ["zinkovaný", "černý", "bílý"],
        "environment": "univerzální",
        "typical_items": ["různé předměty", "zásoby", "nářadí", "knihy"],
        "tips": [
            "Nosnost až 1050 kg na celý regál",
            "Bezšroubová montáž za 10 minut",
            "7letá záruka na materiál i zpracování"
        ]
    }
}

# ============================================================================
# CONTENT TEMPLATES - Rich content sections for different article types
# ============================================================================

def get_category_for_topic(topic):
    """Determine the best category for a given topic"""
    topic_lower = topic.lower()
    for cat_name, cat_data in CATEGORIES.items():
        if cat_name == "default":
            continue
        for keyword in cat_data["keywords"]:
            if keyword in topic_lower:
                return cat_name, cat_data
    return "default", CATEGORIES["default"]

def get_recommended_products(category_data, limit=4):
    """Get products recommended for this category"""
    recommended = []
    for prod in PRODUCTS:
        for rec_type in category_data["recommended_products"]:
            if rec_type in prod["color"].lower() or rec_type in prod.get("name", "").lower():
                if prod not in recommended:
                    recommended.append(prod)
    return recommended[:limit] if recommended else PRODUCTS[:limit]

def format_topic_title(topic):
    """Format topic into readable Czech title"""
    # Replace hyphens with spaces and capitalize
    title = topic.replace("-", " ")
    # Capitalize first letter
    return title.capitalize()

def generate_intro_content(topic, category_name, category_data):
    """Generate introduction content based on topic and category"""
    topic_title = format_topic_title(topic)

    intros = {
        "jak-vybrat": f"""
        <h2 class="text-2xl font-bold mb-4 mt-8">Jak správně vybrat {topic_title.lower()}?</h2>
        <p class="mb-4">{category_data['description']}</p>
        <p class="mb-6">V tomto komplexním průvodci vám ukážeme, na co se zaměřit při výběru, jaké parametry jsou klíčové a které produkty doporučujeme pro vaše konkrétní potřeby.</p>

        <div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 mb-8">
            <h3 class="font-bold text-lg mb-4">🎯 Klíčové faktory při výběru</h3>
            <div class="grid md:grid-cols-2 gap-4">
                <div class="flex items-start gap-3">
                    <span class="text-2xl">📏</span>
                    <div>
                        <strong class="block">Rozměry prostoru</strong>
                        <span class="text-gray-600 text-sm">Změřte výšku, šířku a hloubku dostupného místa</span>
                    </div>
                </div>
                <div class="flex items-start gap-3">
                    <span class="text-2xl">⚖️</span>
                    <div>
                        <strong class="block">Nosnost</strong>
                        <span class="text-gray-600 text-sm">Určete, kolik kg budete skladovat</span>
                    </div>
                </div>
                <div class="flex items-start gap-3">
                    <span class="text-2xl">🌡️</span>
                    <div>
                        <strong class="block">Prostředí</strong>
                        <span class="text-gray-600 text-sm">Vlhké = zinkovaný, suché = lakovaný</span>
                    </div>
                </div>
                <div class="flex items-start gap-3">
                    <span class="text-2xl">🎨</span>
                    <div>
                        <strong class="block">Design</strong>
                        <span class="text-gray-600 text-sm">Barva a styl podle interiéru</span>
                    </div>
                </div>
            </div>
        </div>
        """,

        "pruvodce": f"""
        <h2 class="text-2xl font-bold mb-4 mt-8">Kompletní průvodce: {topic_title}</h2>
        <p class="mb-4">{category_data['description']}</p>
        <p class="mb-6">Připravili jsme pro vás ucelený přehled všeho, co potřebujete vědět o tomto tématu - od základních informací až po tipy od expertů.</p>

        <div class="bg-amber-50 border-l-4 border-amber-500 p-6 mb-8">
            <h3 class="font-bold text-amber-800 mb-2">💡 Věděli jste?</h3>
            <p class="text-amber-700">Správně zvolený regál může prodloužit životnost skladovaných věcí a ušetřit vám až 30% prostoru díky efektivní organizaci.</p>
        </div>
        """,

        "top-tipy": f"""
        <h2 class="text-2xl font-bold mb-4 mt-8">Top tipy pro {topic_title.lower()}</h2>
        <p class="mb-4">{category_data['description']}</p>
        <p class="mb-6">Sebrali jsme nejužitečnější rady a tipy, které vám pomohou vybrat a využít regál na maximum.</p>

        <div class="bg-green-50 rounded-xl p-6 mb-8">
            <h3 class="font-bold text-lg mb-4 text-green-800">✅ Naše doporučení</h3>
            <ul class="space-y-3">
                {"".join([f'<li class="flex items-start gap-2"><span class="text-green-500 mt-1">✓</span><span>{tip}</span></li>' for tip in category_data['tips']])}
            </ul>
        </div>
        """
    }

    # Determine article type from topic
    if "jak-vybrat" in topic:
        return intros["jak-vybrat"]
    elif "pruvodce" in topic:
        return intros["pruvodce"]
    elif "top-tipy" in topic:
        return intros["top-tipy"]
    return intros["pruvodce"]

def generate_detailed_content(topic, category_name, category_data):
    """Generate detailed middle content"""
    typical_items = category_data.get("typical_items", ["různé předměty"])
    items_text = ", ".join(typical_items[:5])

    return f"""
        <h2 class="text-2xl font-bold mb-4 mt-8">Co můžete skladovat?</h2>
        <p class="mb-4">Typické položky pro tento typ využití zahrnují: <strong>{items_text}</strong> a mnoho dalšího.</p>

        <div class="grid md:grid-cols-3 gap-4 mb-8">
            <div class="bg-white rounded-xl shadow-sm p-5 text-center">
                <div class="text-4xl mb-3">📦</div>
                <h4 class="font-bold mb-2">Nosnost</h4>
                <p class="text-gray-600 text-sm">Až <strong>1050 kg</strong> na celý regál, 175-210 kg na polici</p>
            </div>
            <div class="bg-white rounded-xl shadow-sm p-5 text-center">
                <div class="text-4xl mb-3">🔧</div>
                <h4 class="font-bold mb-2">Montáž</h4>
                <p class="text-gray-600 text-sm">Bezšroubový systém, <strong>10 minut</strong> bez nářadí</p>
            </div>
            <div class="bg-white rounded-xl shadow-sm p-5 text-center">
                <div class="text-4xl mb-3">🛡️</div>
                <h4 class="font-bold mb-2">Záruka</h4>
                <p class="text-gray-600 text-sm"><strong>7 let</strong> na materiál i zpracování</p>
            </div>
        </div>

        <h2 class="text-2xl font-bold mb-4 mt-8">Jak vybrat správnou velikost?</h2>
        <p class="mb-4">Správná velikost regálu závisí na dostupném prostoru a vašich potřebách. Zde je přehled našich rozměrů:</p>

        <div class="overflow-x-auto mb-8">
            <table class="w-full text-sm">
                <thead class="bg-gray-100">
                    <tr>
                        <th class="p-3 text-left">Rozměr (V×Š×H)</th>
                        <th class="p-3 text-left">Vhodné pro</th>
                        <th class="p-3 text-left">Nosnost</th>
                        <th class="p-3 text-left">Cena od</th>
                    </tr>
                </thead>
                <tbody>
                    <tr class="border-b">
                        <td class="p-3 font-medium">150×70×30 cm</td>
                        <td class="p-3">Menší prostory, koupelny, spíže</td>
                        <td class="p-3">700 kg</td>
                        <td class="p-3 text-primary-600 font-bold">659 Kč</td>
                    </tr>
                    <tr class="border-b bg-gray-50">
                        <td class="p-3 font-medium">180×90×40 cm</td>
                        <td class="p-3">Garáže, sklepy, dílny</td>
                        <td class="p-3">875 kg</td>
                        <td class="p-3 text-primary-600 font-bold">739 Kč</td>
                    </tr>
                    <tr class="border-b">
                        <td class="p-3 font-medium">180×120×50 cm</td>
                        <td class="p-3">Sklady, profesionální použití</td>
                        <td class="p-3">1050 kg</td>
                        <td class="p-3 text-primary-600 font-bold">1009 Kč</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <h2 class="text-2xl font-bold mb-4 mt-8">Povrchová úprava</h2>
        <p class="mb-4">Volba povrchu závisí na prostředí, kde budete regál používat:</p>

        <div class="grid md:grid-cols-2 gap-6 mb-8">
            <div class="bg-gray-100 rounded-xl p-5">
                <h4 class="font-bold text-lg mb-3">🔩 Pozinkované regály</h4>
                <p class="text-gray-600 mb-3">Odolné vůči vlhkosti a korozi. Ideální do:</p>
                <ul class="space-y-1 text-sm">
                    <li>✓ Sklepů a vinných sklepů</li>
                    <li>✓ Nevytápěných garáží</li>
                    <li>✓ Venkovních přístřešků</li>
                    <li>✓ Vlhkých prostor</li>
                </ul>
            </div>
            <div class="bg-gray-900 text-white rounded-xl p-5">
                <h4 class="font-bold text-lg mb-3">🎨 Lakované regály</h4>
                <p class="text-gray-300 mb-3">Elegantní vzhled v různých barvách. Ideální do:</p>
                <ul class="space-y-1 text-sm">
                    <li>✓ Obývacích pokojů a ložnic</li>
                    <li>✓ Kanceláří a pracoven</li>
                    <li>✓ Šaten a dětských pokojů</li>
                    <li>✓ Suchých vytápěných prostor</li>
                </ul>
            </div>
        </div>
    """

def generate_faq_content(topic, category_name, category_data):
    """Generate topic-specific FAQ"""
    # Base FAQs
    faqs = [
        {"q": "Jaká je nosnost regálů?", "a": "Naše regály mají celkovou nosnost od 700 kg do 1050 kg. Nosnost jedné police je 175-210 kg při rovnoměrném rozložení zátěže."},
        {"q": "Jak dlouho trvá montáž?", "a": "Bezšroubová montáž je velmi jednoduchá a zvládnete ji za 10-15 minut bez jakéhokoliv nářadí. V balení najdete podrobný obrázkový návod."},
        {"q": "Jaká je záruka?", "a": "Na všechny naše regály poskytujeme záruku 7 let na vady materiálu a zpracování. V případě problému regál vyměníme nebo vrátíme peníze."},
    ]

    # Category-specific FAQs
    category_faqs = {
        "garáž": [
            {"q": "Mohu regál použít v nevytápěné garáži?", "a": "Ano, pro nevytápěné garáže doporučujeme pozinkované regály, které odolávají vlhkosti a teplotním výkyvům."},
            {"q": "Unesou regály pneumatiky?", "a": "Rozhodně ano! Naše regály s nosností 875 kg bez problémů unesou sadu 4 pneumatik na každé polici."},
        ],
        "sklep": [
            {"q": "Jsou regály vhodné do vlhkého sklepa?", "a": "Ano, pozinkované regály jsou speciálně navrženy pro vlhké prostory a odolávají korozi."},
            {"q": "Mohu skladovat zavařeniny?", "a": "Samozřejmě! Police unesou až 175 kg, takže i těžké sklenice s zavařeninami nejsou problém."},
        ],
        "koupelna": [
            {"q": "Snesou regály vlhkost v koupelně?", "a": "Pro koupelny doporučujeme pozinkované regály nebo bílé lakované do sušších částí."},
            {"q": "Vejde se regál nad pračku?", "a": "Máme úzké modely (30-40 cm hloubky), které se perfektně vejdou nad pračku nebo sušičku."},
        ],
        "dílna": [
            {"q": "Unesou regály těžké nářadí?", "a": "Ano, profesionální regály mají nosnost až 1050 kg. Jedna police unese 210 kg."},
            {"q": "Mohu regál kombinovat s dílenským stolem?", "a": "Rozhodně! Naše regály lze umístit vedle ponku nebo dílenského stolu pro maximální efektivitu."},
        ],
    }

    # Add category-specific FAQs if available
    if category_name in category_faqs:
        faqs.extend(category_faqs[category_name])

    # Generate HTML
    faq_html = ""
    for faq in faqs[:5]:  # Limit to 5 FAQs
        faq_html += f"""
        <div class="border rounded-xl overflow-hidden faq-item">
            <button onclick="this.parentElement.classList.toggle('open')" class="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50">
                <span class="font-medium">{faq['q']}</span>
                <span class="text-xl transition-transform">▼</span>
            </button>
            <div class="px-5 pb-5 hidden">
                <p class="text-gray-600">{faq['a']}</p>
            </div>
        </div>
        """

    return f"""
        <section class="my-12">
            <h2 class="text-2xl font-bold mb-6">❓ Často kladené dotazy</h2>
            <div class="space-y-4">{faq_html}</div>
        </section>
    """

def generate_product_cards(products):
    """Generate HTML for product recommendation cards"""
    cards = ""
    for prod in products[:4]:
        discount = int((1 - prod['price'] / prod['old_price']) * 100)
        cards += f"""
        <a href="{prod['file']}" class="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-shadow group">
            <div class="relative">
                <img src="{prod['img']}" loading="lazy" alt="{prod['name']}" class="w-full aspect-square object-contain p-4 bg-gray-50">
                <span class="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">-{discount}%</span>
            </div>
            <div class="p-4">
                <h3 class="font-medium text-sm group-hover:text-primary-500 mb-2">{prod['name']}</h3>
                <div class="flex items-baseline gap-2">
                    <span class="text-xl font-bold text-primary-600">{prod['price']} Kč</span>
                    <span class="text-sm text-gray-400 line-through">{prod['old_price']} Kč</span>
                </div>
                <div class="text-xs text-green-600 mt-1">✓ Skladem • Nosnost {prod['capacity']} kg</div>
            </div>
        </a>
        """
    return cards

def find_related_articles(current_topic, all_topics, limit=6):
    """Find truly related articles based on topic similarity"""
    current_lower = current_topic.lower().replace("-jak-vybrat", "").replace("-pruvodce", "").replace("-top-tipy", "")

    # Extract keywords from current topic
    current_words = set(current_lower.replace("-", " ").split())

    related = []
    for topic in all_topics:
        if topic == current_topic:
            continue

        topic_lower = topic.lower().replace("-jak-vybrat", "").replace("-pruvodce", "").replace("-top-tipy", "")
        topic_words = set(topic_lower.replace("-", " ").split())

        # Calculate similarity based on common words
        common = current_words.intersection(topic_words)
        if len(common) > 0:
            score = len(common) / max(len(current_words), len(topic_words))
            related.append((topic, score))

    # Sort by score and return top matches
    related.sort(key=lambda x: x[1], reverse=True)
    return [t[0] for t in related[:limit]]

def generate_related_articles_html(related_topics):
    """Generate HTML for related articles section"""
    if not related_topics:
        return ""

    articles = ""
    for topic in related_topics:
        title = format_topic_title(topic.replace(".html", ""))
        articles += f"""
            <a href="{topic}.html" class="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition group border border-gray-100">
                <h3 class="font-medium group-hover:text-primary-500 line-clamp-2">{title}</h3>
                <span class="text-primary-500 text-sm mt-2 inline-flex items-center">Číst více →</span>
            </a>
        """

    return f"""
        <section class="my-12">
            <h2 class="text-2xl font-bold mb-6">📚 Související články</h2>
            <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{articles}</div>
        </section>
    """

# ============================================================================
# MAIN PAGE TEMPLATE
# ============================================================================

def generate_page_html(topic, category_name, category_data, products, related_topics):
    """Generate complete HTML page"""
    topic_title = format_topic_title(topic)

    # Determine article type for title
    if "jak-vybrat" in topic:
        page_title = f"Jak vybrat {topic_title.replace('Jak vybrat ', '').replace(' jak vybrat', '')}? Kompletní průvodce 2026"
        h1_title = f"Jak vybrat {topic_title.replace('Jak vybrat ', '').replace(' jak vybrat', '')}?"
    elif "pruvodce" in topic:
        page_title = f"{topic_title.replace(' pruvodce', '')} - Kompletní průvodce 2026"
        h1_title = f"{topic_title.replace(' pruvodce', '')}: Kompletní průvodce"
    elif "top-tipy" in topic:
        page_title = f"{topic_title.replace(' top tipy', '')} - Top 10 tipů a doporučení 2026"
        h1_title = f"{topic_title.replace(' top tipy', '')}: Top tipy a doporučení"
    else:
        page_title = f"{topic_title} | Bazarovyregal.cz"
        h1_title = topic_title

    # Generate meta description
    meta_desc = f"{category_data['description'][:100]}... Slevy až 75%, nosnost až 1050 kg, záruka 7 let."

    # Generate content sections
    intro_content = generate_intro_content(topic, category_name, category_data)
    detailed_content = generate_detailed_content(topic, category_name, category_data)
    faq_content = generate_faq_content(topic, category_name, category_data)
    product_cards = generate_product_cards(products)
    related_html = generate_related_articles_html(related_topics)

    return f'''<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{page_title} | Bazarovyregal.cz</title>
    <meta name="description" content="{meta_desc}">
    <link rel="canonical" href="https://www.bazarovyregal.cz/{topic}.html">

    <meta property="og:title" content="{page_title}">
    <meta property="og:description" content="{meta_desc}">
    <meta property="og:image" content="https://vyprodej-regalucz.s26.cdn-upgates.com/_cache/b/1/b17ce5b491bdb73a0df3160b51fbcf7e-1-regal-1800x1200x500-mm-lakovany-5-policovy-nosnost-1050-kg-modro-oranzovy-pravy-18120501050orangeblue1.jpeg">
    <meta property="og:url" content="https://www.bazarovyregal.cz/{topic}.html">
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="Bazarovyregal.cz">
    <meta property="og:locale" content="cs_CZ">

    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <script>
        tailwind.config = {{
            theme: {{ extend: {{ fontFamily: {{ sans: ['Inter', 'sans-serif'] }}, colors: {{ primary: {{ 50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74', 400: '#fb923c', 500: '#f97316', 600: '#ea580c', 700: '#c2410c', 800: '#9a3412', 900: '#7c2d12' }} }} }} }}
        }}
    </script>
    <style>
        .faq-item.open .hidden {{ display: block; }}
        .faq-item.open button span:last-child {{ transform: rotate(180deg); }}
        .line-clamp-2 {{ display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }}
    </style>

    <script type="application/ld+json">
    {{
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": "{h1_title}",
        "description": "{meta_desc}",
        "author": {{ "@type": "Organization", "name": "Bazarovyregal.cz" }},
        "publisher": {{ "@type": "Organization", "name": "Bazarovyregal.cz", "logo": {{ "@type": "ImageObject", "url": "https://www.bazarovyregal.cz/logo.png" }} }},
        "datePublished": "2026-01-15",
        "dateModified": "2026-02-04"
    }}
    </script>
</head>
<body class="bg-gray-50 font-sans">

<div class="bg-gray-900 text-white text-sm py-2">
    <div class="container mx-auto px-4 flex justify-between items-center">
        <span>✉️ info@bazarovyregal.cz</span>
        <div class="flex gap-4"><span>🚚 Doprava od 99 Kč</span><span>⭐ 4.9/5 (2847 recenzí)</span></div>
    </div>
</div>

<header class="bg-white shadow-sm sticky top-0 z-40">
    <div class="container mx-auto px-4 py-4 flex items-center justify-between">
        <a href="index.html" class="flex items-center gap-2">
            <div class="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center"><span class="text-white text-xl font-bold">B</span></div>
            <div><div class="text-xl font-bold text-gray-900">Bazarovyregal<span class="text-primary-500">.cz</span></div><div class="text-xs text-primary-600 font-medium">LIKVIDACE SKLADU</div></div>
        </a>
        <nav class="hidden md:flex gap-6 text-sm font-medium text-gray-600">
            <a href="index.html" class="hover:text-primary-500">🏠 Úvod</a>
            <a href="katalog.html" class="hover:text-primary-500">📦 Všechny regály</a>
            <a href="o-nas.html" class="hover:text-primary-500">ℹ️ O nás</a>
            <a href="faq.html" class="hover:text-primary-500">❓ FAQ</a>
            <a href="kontakt.html" class="hover:text-primary-500">📧 Kontakt</a>
        </nav>
        <a href="katalog.html" class="bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 font-medium">🛒 Koupit regál</a>
    </div>
</header>

<nav class="bg-gray-100 py-3 px-4">
    <div class="container mx-auto">
        <ol class="flex items-center text-sm flex-wrap">
            <a href="index.html" class="text-primary-500 hover:underline">Domů</a>
            <span class="text-gray-400 mx-2">›</span>
            <a href="blog.html" class="text-primary-500 hover:underline">Blog</a>
            <span class="text-gray-400 mx-2">›</span>
            <span class="text-gray-600">{h1_title[:50]}...</span>
        </ol>
    </div>
</nav>

<main class="container mx-auto px-4 py-8">
    <article class="max-w-4xl mx-auto">
        <header class="mb-8">
            <div class="flex items-center gap-2 mb-4">
                <span class="bg-primary-100 text-primary-700 text-xs font-medium px-3 py-1 rounded-full">{category_name.capitalize()}</span>
                <span class="text-gray-400 text-sm">• Aktualizováno 4.2.2026</span>
            </div>
            <h1 class="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">{h1_title}</h1>
            <p class="text-xl text-gray-600">{category_data['description']}</p>
        </header>

        <div class="bg-gradient-to-r from-primary-500 to-orange-500 rounded-2xl p-6 mb-8 text-white">
            <div class="flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                    <h2 class="text-2xl font-bold mb-2">🔥 Výprodej skladu - slevy až 75%!</h2>
                    <p class="text-white/90">Kvalitní kovové regály za bezkonkurenční ceny. Pouze do vyprodání zásob.</p>
                </div>
                <a href="katalog.html" class="bg-white text-primary-600 px-6 py-3 rounded-xl font-bold hover:bg-gray-100 transition whitespace-nowrap">Zobrazit nabídku →</a>
            </div>
        </div>

        <div class="prose prose-lg max-w-none">
            {intro_content}
            {detailed_content}
        </div>

        <section class="my-12">
            <h2 class="text-2xl font-bold mb-6">🛒 Doporučené produkty pro vás</h2>
            <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {product_cards}
            </div>
            <div class="text-center">
                <a href="katalog.html" class="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-8 py-3 rounded-xl font-bold transition">
                    Zobrazit všech 102 regálů →
                </a>
            </div>
        </section>

        {faq_content}
        {related_html}

        <div class="bg-gray-900 text-white rounded-2xl p-8 text-center my-12">
            <h2 class="text-2xl font-bold mb-4">Připraveni objednat?</h2>
            <p class="text-gray-300 mb-6">Využijte slevy až 75% a získejte kvalitní regál za bezkonkurenční cenu. Doprava od 99 Kč, nad 2000 Kč zdarma.</p>
            <div class="flex flex-col sm:flex-row gap-4 justify-center">
                <a href="katalog.html" class="bg-primary-500 hover:bg-primary-600 text-white px-8 py-3 rounded-xl font-bold">🛒 Zobrazit nabídku</a>
                <a href="kontakt.html" class="bg-white/10 hover:bg-white/20 text-white px-8 py-3 rounded-xl font-bold">📧 Kontaktujte nás</a>
            </div>
        </div>
    </article>
</main>

<footer class="bg-gray-900 text-white py-12">
    <div class="container mx-auto px-4">
        <div class="grid md:grid-cols-4 gap-8 mb-8">
            <div>
                <div class="text-xl font-bold mb-4">Bazarovyregal<span class="text-primary-500">.cz</span></div>
                <p class="text-gray-400 text-sm">Likvidace skladu kovových regálů. Pouze nové a nerozbalené zboží se zárukou 7 let.</p>
            </div>
            <div>
                <h4 class="font-bold mb-4">Kategorie</h4>
                <ul class="space-y-2 text-gray-400 text-sm">
                    <li><a href="regaly-do-garaze.html" class="hover:text-primary-400">Regály do garáže</a></li>
                    <li><a href="regaly-do-sklepa.html" class="hover:text-primary-400">Regály do sklepa</a></li>
                    <li><a href="regaly-do-dilny.html" class="hover:text-primary-400">Regály do dílny</a></li>
                    <li><a href="bile-regaly.html" class="hover:text-primary-400">Bílé regály</a></li>
                </ul>
            </div>
            <div>
                <h4 class="font-bold mb-4">Informace</h4>
                <ul class="space-y-2 text-gray-400 text-sm">
                    <li><a href="o-nas.html" class="hover:text-primary-400">O nás</a></li>
                    <li><a href="faq.html" class="hover:text-primary-400">Často kladené dotazy</a></li>
                    <li><a href="obchodni-podminky.html" class="hover:text-primary-400">Obchodní podmínky</a></li>
                    <li><a href="kontakt.html" class="hover:text-primary-400">Kontakt</a></li>
                </ul>
            </div>
            <div>
                <h4 class="font-bold mb-4">Kontakt</h4>
                <ul class="space-y-2 text-gray-400 text-sm">
                    <li>✉️ info@bazarovyregal.cz</li>
                    <li>🕐 Po-Pá 8:00 - 16:00</li>
                    <li>🚚 Doprava od 99 Kč</li>
                    <li>🛡️ Záruka 7 let</li>
                </ul>
            </div>
        </div>
        <div class="border-t border-gray-800 pt-8 text-center text-gray-500 text-sm">
            © 2026 Bazarovyregal.cz - Budujeme regálové impérium
        </div>
    </div>
</footer>

</body>
</html>'''


# ============================================================================
# MAIN EXECUTION
# ============================================================================

def main():
    """Main function to regenerate all SEO pages"""
    import glob

    # Find all SEO pages
    seo_patterns = ["*-jak-vybrat.html", "*-pruvodce.html", "*-top-tipy.html"]
    seo_files = []
    for pattern in seo_patterns:
        seo_files.extend(glob.glob(pattern))

    # Extract unique topics (without suffix)
    all_topics = set()
    for f in seo_files:
        topic = f.replace(".html", "")
        all_topics.add(topic)

    print(f"Found {len(seo_files)} SEO pages to regenerate")

    # Process each file
    regenerated = 0
    for filepath in seo_files:
        topic = filepath.replace(".html", "")

        # Get category
        category_name, category_data = get_category_for_topic(topic)

        # Get recommended products
        products = get_recommended_products(category_data)

        # Find related articles
        related = find_related_articles(topic, all_topics)

        # Generate new HTML
        new_html = generate_page_html(topic, category_name, category_data, products, related)

        # Write file
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_html)

        regenerated += 1
        if regenerated % 50 == 0:
            print(f"  Regenerated {regenerated} pages...")

    print(f"✅ Successfully regenerated {regenerated} SEO pages!")
    return regenerated

if __name__ == "__main__":
    main()
