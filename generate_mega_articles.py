#!/usr/bin/env python3
"""
Mega Article Generator for Bazarovyregal.cz
- Top 200 keywords: 3 articles each (different angles)
- Remaining keywords: 1 article each
- Total: 600+ articles with unique content
"""

import pandas as pd
import os
import re
import random
from datetime import datetime

# Configuration
BASE_URL = "https://bazarovyregal.vercel.app"
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))

# Product images
IMAGES = {
    "black": "https://vyprodej-regalucz.s26.cdn-upgates.com/l/l690377af7480a-1-regal-1800x900x400-mm-lakovany-5-policovy-nosnost-875-kg-cerny-pravy-18090405875black1.jpeg",
    "white": "https://vyprodej-regalucz.s26.cdn-upgates.com/6/6690a777ad6edc-1-18090405875white1.jpeg",
    "red": "https://vyprodej-regalucz.s26.cdn-upgates.com/_cache/9/e/9eef5f9f2ad8880b75926a3eae58485b-1-regal-1500x700x300-mm-lakovany-4-policovy-nosnost-700-kg-cerveny-pravy-15070304700red1.jpeg",
    "blue": "https://vyprodej-regalucz.s26.cdn-upgates.com/_cache/1/c/1c64831c1231f5847cf9e7a36f6cdf6f-1-15070304700blue1.jpeg",
    "zinc": "https://vyprodej-regalucz.s26.cdn-upgates.com/z/z6914605330838-5-pol-pravy-zink.jpg",
    "pro": "https://vyprodej-regalucz.s26.cdn-upgates.com/_cache/b/1/b17ce5b491bdb73a0df3160b51fbcf7e-1-regal-1800x1200x500-mm-lakovany-5-policovy-nosnost-1050-kg-modro-oranzovy-pravy-18120501050orangeblue1.jpeg"
}

# Products for linking
PRODUCTS = [
    {"name": "Regál 150×70×30 cm černý", "price": 599, "url": "regal-150x70x30-cerna.html", "img": IMAGES["black"], "capacity": 700},
    {"name": "Regál 150×70×30 cm zinkovaný", "price": 549, "url": "regal-150x70x30-zinkovany.html", "img": IMAGES["zinc"], "capacity": 700},
    {"name": "Regál 180×90×40 cm černý", "price": 739, "url": "regal-180x90x40-cerna.html", "img": IMAGES["black"], "capacity": 875, "bestseller": True},
    {"name": "Regál 180×90×40 cm zinkovaný", "price": 649, "url": "regal-180x90x40-zinkovany.html", "img": IMAGES["zinc"], "capacity": 875},
    {"name": "Regál 180×90×40 cm bílý", "price": 739, "url": "regal-180x90x40-bila.html", "img": IMAGES["white"], "capacity": 875},
    {"name": "Regál 200×90×40 cm černý", "price": 849, "url": "regal-200x90x40-cerna.html", "img": IMAGES["black"], "capacity": 875},
    {"name": "Regál 220×90×45 cm černý", "price": 899, "url": "regal-220x90x45-cerna.html", "img": IMAGES["black"], "capacity": 875},
    {"name": "Regál 180×120×50 cm profesionální", "price": 1249, "url": "regal-180x120x50-profesionalni.html", "img": IMAGES["pro"], "capacity": 1050},
]

# Three different article angles for top keywords
ARTICLE_ANGLES = [
    {
        "suffix": "pruvodce",
        "title_template": "{keyword} - Kompletní průvodce 2026",
        "h1_template": "{keyword}: Vše co potřebujete vědět",
        "angle": "comprehensive",
        "intro_style": "educational"
    },
    {
        "suffix": "jak-vybrat",
        "title_template": "Jak vybrat {keyword}? Rady od expertů",
        "h1_template": "Jak vybrat správný {keyword}?",
        "angle": "buying_guide",
        "intro_style": "advisory"
    },
    {
        "suffix": "top-tipy",
        "title_template": "{keyword} - Top 10 tipů a doporučení",
        "h1_template": "Top 10 tipů pro {keyword}",
        "angle": "tips",
        "intro_style": "listicle"
    }
]

def slugify(text):
    """Convert text to URL-safe slug"""
    text = text.lower()
    replacements = {
        'á': 'a', 'č': 'c', 'ď': 'd', 'é': 'e', 'ě': 'e', 'í': 'i',
        'ň': 'n', 'ó': 'o', 'ř': 'r', 'š': 's', 'ť': 't', 'ú': 'u',
        'ů': 'u', 'ý': 'y', 'ž': 'z', 'ä': 'a', 'ö': 'o', 'ü': 'u'
    }
    for cz, en in replacements.items():
        text = text.replace(cz, en)
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    text = re.sub(r'[\s_]+', '-', text)
    text = re.sub(r'-+', '-', text)
    return text.strip('-')

def get_keyword_category(keyword):
    """Determine category based on keyword"""
    kw = keyword.lower()
    if any(x in kw for x in ['garáž', 'garaz', 'auto', 'pneumat', 'nářadí']):
        return 'garage'
    elif any(x in kw for x in ['sklep', 'víno', 'vino', 'zavařen']):
        return 'cellar'
    elif any(x in kw for x in ['díln', 'diln', 'řemesln', 'profes']):
        return 'workshop'
    elif any(x in kw for x in ['kancelář', 'kancelar', 'archiv']):
        return 'office'
    elif any(x in kw for x in ['kuchyň', 'kuchyn', 'spíž']):
        return 'kitchen'
    elif any(x in kw for x in ['dět', 'det', 'hračk', 'pokoj']):
        return 'kids'
    elif any(x in kw for x in ['šatn', 'satn', 'obleč', 'boty']):
        return 'wardrobe'
    elif any(x in kw for x in ['sklad', 'e-shop', 'logist']):
        return 'warehouse'
    elif any(x in kw for x in ['zink', 'pozink', 'vlhk']):
        return 'zinc'
    elif any(x in kw for x in ['montáž', 'montaz', 'sestav', 'návod', 'jak']):
        return 'howto'
    elif any(x in kw for x in ['nosnost', 'kapacit', 'kg']):
        return 'capacity'
    elif any(x in kw for x in ['rozměr', 'rozmer', 'cm', 'mm']):
        return 'dimensions'
    elif any(x in kw for x in ['slev', 'akce', 'výprodej', 'levn', 'cena']):
        return 'deals'
    elif any(x in kw for x in ['kovov', 'ocel', 'železn', 'metal']):
        return 'metal'
    elif any(x in kw for x in ['bíl', 'bil', 'čern', 'cern', 'červen', 'modr', 'barv']):
        return 'colors'
    else:
        return 'general'

def get_category_name(cat):
    """Get Czech name for category"""
    names = {
        'garage': 'Regály do garáže',
        'cellar': 'Regály do sklepa',
        'workshop': 'Regály do dílny',
        'office': 'Regály do kanceláře',
        'kitchen': 'Regály do kuchyně',
        'kids': 'Dětské regály',
        'wardrobe': 'Regály do šatny',
        'warehouse': 'Skladové regály',
        'zinc': 'Zinkované regály',
        'howto': 'Návody',
        'capacity': 'Nosnost regálů',
        'dimensions': 'Rozměry regálů',
        'deals': 'Slevy a akce',
        'metal': 'Kovové regály',
        'colors': 'Barvy regálů',
        'general': 'Regály'
    }
    return names.get(cat, 'Regály')

def get_relevant_products(category, count=4):
    """Get products relevant to the category"""
    prods = PRODUCTS.copy()
    random.shuffle(prods)
    return prods[:count]

# Content generators for different angles
def generate_comprehensive_content(keyword, category):
    """Generate comprehensive guide content"""
    return f"""
        <h2 class="text-2xl font-bold mb-4 mt-8">Co je {keyword}?</h2>
        <p class="mb-4">Termín "{keyword}" označuje specifickou kategorii regálů nebo způsob jejich využití. V této sekci vám vysvětlíme vše podstatné, co byste měli vědět před nákupem.</p>
        <p class="mb-6">Správná volba regálu může výrazně ovlivnit organizaci vašeho prostoru, ať už jde o domácnost, dílnu nebo sklad. Proto je důležité pochopit všechny aspekty tohoto tématu.</p>

        <div class="bg-blue-50 border-l-4 border-blue-500 p-6 mb-8">
            <h3 class="font-bold text-blue-800 mb-2">📚 Definice</h3>
            <p class="text-blue-700">{keyword.capitalize()} představuje řešení pro efektivní skladování a organizaci předmětů. Kvalitní regály nabízejí vysokou nosnost, snadnou montáž a dlouhou životnost.</p>
        </div>

        <h2 class="text-2xl font-bold mb-4 mt-8">Historie a vývoj</h2>
        <p class="mb-4">Regály se používají již tisíce let. Od jednoduchých dřevěných polic ve starověkých knihovnách až po moderní kovové regálové systémy - vývoj byl značný.</p>
        <p class="mb-6">Současné kovové regály kombinují tradiční účelnost s moderními technologiemi zpracování oceli, což přináší produkty s výjimečnou nosností a životností.</p>

        <h2 class="text-2xl font-bold mb-4 mt-8">Typy a varianty</h2>
        <div class="grid md:grid-cols-2 gap-6 mb-8">
            <div class="bg-white rounded-xl shadow-sm p-6">
                <h3 class="font-bold text-lg mb-3">🔩 Pozinkované regály</h3>
                <p class="text-gray-600 mb-2">Ideální do vlhkých prostor jako sklepy a garáže. Zinkový povlak chrání před korozí.</p>
                <p class="text-primary-600 font-bold">od 549 Kč</p>
            </div>
            <div class="bg-white rounded-xl shadow-sm p-6">
                <h3 class="font-bold text-lg mb-3">🎨 Lakované regály</h3>
                <p class="text-gray-600 mb-2">Elegantní vzhled pro interiér. K dispozici v černé, bílé, červené a modré barvě.</p>
                <p class="text-primary-600 font-bold">od 599 Kč</p>
            </div>
        </div>

        <h2 class="text-2xl font-bold mb-4 mt-8">Technické parametry</h2>
        <p class="mb-4">Při výběru regálu je důležité zohlednit několik klíčových parametrů:</p>
        <ul class="space-y-3 mb-6">
            <li class="flex items-start gap-3"><span class="text-primary-500 text-xl">📏</span><div><strong>Rozměry</strong> - výška 150-220 cm, šířka 40-120 cm, hloubka 30-50 cm</div></li>
            <li class="flex items-start gap-3"><span class="text-primary-500 text-xl">⚖️</span><div><strong>Nosnost</strong> - od 700 kg do 1050 kg na celý regál</div></li>
            <li class="flex items-start gap-3"><span class="text-primary-500 text-xl">📚</span><div><strong>Počet polic</strong> - 4-5 nastavitelných polic</div></li>
            <li class="flex items-start gap-3"><span class="text-primary-500 text-xl">🔧</span><div><strong>Montáž</strong> - bezšroubový systém, 10 minut bez nářadí</div></li>
        </ul>
    """

def generate_buying_guide_content(keyword, category):
    """Generate buying guide content"""
    return f"""
        <h2 class="text-2xl font-bold mb-4 mt-8">Na co se zaměřit při výběru?</h2>
        <p class="mb-4">Výběr správného regálu může být matoucí vzhledem k množství možností na trhu. Proto jsme pro vás připravili přehled nejdůležitějších kritérií.</p>

        <div class="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-6 mb-8">
            <h3 class="font-bold text-lg mb-4">🎯 5 klíčových otázek před nákupem</h3>
            <ol class="space-y-3">
                <li class="flex gap-3"><span class="w-6 h-6 bg-primary-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span><span>Jaký prostor mám k dispozici? (změřte výšku, šířku, hloubku)</span></li>
                <li class="flex gap-3"><span class="w-6 h-6 bg-primary-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span><span>Co budu skladovat? (určí potřebnou nosnost)</span></li>
                <li class="flex gap-3"><span class="w-6 h-6 bg-primary-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span><span>Jaké je prostředí? (vlhké = pozinkovaný, suché = lakovaný)</span></li>
                <li class="flex gap-3"><span class="w-6 h-6 bg-primary-500 text-white rounded-full flex items-center justify-center text-sm font-bold">4</span><span>Jaký mám rozpočet? (naše ceny od 549 Kč)</span></li>
                <li class="flex gap-3"><span class="w-6 h-6 bg-primary-500 text-white rounded-full flex items-center justify-center text-sm font-bold">5</span><span>Potřebuji konkrétní barvu? (černá, bílá, červená, modrá, zink)</span></li>
            </ol>
        </div>

        <h2 class="text-2xl font-bold mb-4 mt-8">Podle čeho vybírat {keyword}?</h2>

        <h3 class="text-xl font-bold mb-3 mt-6">1. Nosnost - kolik kg potřebujete?</h3>
        <p class="mb-4">Nosnost je nejdůležitější parametr. Naše regály nabízejí:</p>
        <div class="grid sm:grid-cols-3 gap-4 mb-6">
            <div class="bg-white rounded-xl p-4 text-center shadow-sm">
                <div class="text-2xl font-bold text-primary-600 mb-1">700 kg</div>
                <div class="text-sm text-gray-500">Kompaktní regály 150 cm</div>
                <div class="text-xs text-gray-400">175 kg/police</div>
            </div>
            <div class="bg-white rounded-xl p-4 text-center shadow-sm border-2 border-primary-500">
                <div class="text-2xl font-bold text-primary-600 mb-1">875 kg</div>
                <div class="text-sm text-gray-500">Standardní regály 180+ cm</div>
                <div class="text-xs text-gray-400">175 kg/police</div>
            </div>
            <div class="bg-white rounded-xl p-4 text-center shadow-sm">
                <div class="text-2xl font-bold text-primary-600 mb-1">1050 kg</div>
                <div class="text-sm text-gray-500">Profesionální regály</div>
                <div class="text-xs text-gray-400">210 kg/police</div>
            </div>
        </div>

        <h3 class="text-xl font-bold mb-3 mt-6">2. Rozměry - změřte si prostor</h3>
        <p class="mb-4">Před objednáním si vždy změřte dostupný prostor. Pamatujte na:</p>
        <ul class="space-y-2 mb-6">
            <li class="flex items-start gap-2"><span class="text-green-500">✓</span> Nechte 5 cm volného místa na každé straně</li>
            <li class="flex items-start gap-2"><span class="text-green-500">✓</span> Počítejte s prostorem pro otevírání dveří</li>
            <li class="flex items-start gap-2"><span class="text-green-500">✓</span> Zkontrolujte výšku stropu (regál + 10 cm nahoře)</li>
            <li class="flex items-start gap-2"><span class="text-green-500">✓</span> Zvažte průchozí prostor (min. 80 cm)</li>
        </ul>

        <h3 class="text-xl font-bold mb-3 mt-6">3. Materiál a povrch - kde budete regál používat?</h3>
        <div class="grid md:grid-cols-2 gap-6 mb-6">
            <div class="bg-gray-100 rounded-xl p-5">
                <h4 class="font-bold mb-2">Do vlhkých prostor</h4>
                <p class="text-sm text-gray-600 mb-2">Sklep, garáž, venkovní přístřešek</p>
                <p class="text-primary-600 font-bold">→ Pozinkované regály</p>
            </div>
            <div class="bg-gray-900 text-white rounded-xl p-5">
                <h4 class="font-bold mb-2">Do suchých interiérů</h4>
                <p class="text-sm text-gray-300 mb-2">Kancelář, šatna, obývák, dílna</p>
                <p class="text-primary-400 font-bold">→ Lakované barevné regály</p>
            </div>
        </div>
    """

def generate_tips_content(keyword, category):
    """Generate tips/listicle content"""
    return f"""
        <h2 class="text-2xl font-bold mb-4 mt-8">Top 10 tipů pro {keyword}</h2>
        <p class="mb-6">Připravili jsme pro vás 10 nejdůležitějších tipů, které vám pomohou vybrat a používat regály efektivně.</p>

        <div class="space-y-6 mb-8">
            <div class="flex gap-4 bg-white rounded-xl p-5 shadow-sm">
                <div class="w-12 h-12 bg-primary-500 text-white rounded-xl flex items-center justify-center text-xl font-bold flex-shrink-0">1</div>
                <div>
                    <h3 class="font-bold mb-1">Změřte prostor PŘEDTÍM, než objednáte</h3>
                    <p class="text-gray-600 text-sm">Nejčastější chyba zákazníků. Vezměte metr a zapište si výšku, šířku a hloubku prostoru. Nechte rezervu 5 cm na každé straně.</p>
                </div>
            </div>

            <div class="flex gap-4 bg-white rounded-xl p-5 shadow-sm">
                <div class="w-12 h-12 bg-primary-500 text-white rounded-xl flex items-center justify-center text-xl font-bold flex-shrink-0">2</div>
                <div>
                    <h3 class="font-bold mb-1">Zvolte správný povrch podle prostředí</h3>
                    <p class="text-gray-600 text-sm">Vlhké prostory (sklep, garáž) = pozinkovaný. Suché prostory (kancelář, pokoj) = lakovaný. Tím prodloužíte životnost regálu.</p>
                </div>
            </div>

            <div class="flex gap-4 bg-white rounded-xl p-5 shadow-sm">
                <div class="w-12 h-12 bg-primary-500 text-white rounded-xl flex items-center justify-center text-xl font-bold flex-shrink-0">3</div>
                <div>
                    <h3 class="font-bold mb-1">Těžké věci dolů, lehké nahoru</h3>
                    <p class="text-gray-600 text-sm">Základní pravidlo stability. Nejtěžší předměty umísťujte na spodní police. Regál bude stabilnější a bezpečnější.</p>
                </div>
            </div>

            <div class="flex gap-4 bg-white rounded-xl p-5 shadow-sm">
                <div class="w-12 h-12 bg-primary-500 text-white rounded-xl flex items-center justify-center text-xl font-bold flex-shrink-0">4</div>
                <div>
                    <h3 class="font-bold mb-1">Přikotvěte regál ke zdi</h3>
                    <p class="text-gray-600 text-sm">Zejména v domácnostech s dětmi nebo mazlíčky. Zvýšíte bezpečnost a stabilitu. Stačí dva šrouby nahoře.</p>
                </div>
            </div>

            <div class="flex gap-4 bg-white rounded-xl p-5 shadow-sm">
                <div class="w-12 h-12 bg-primary-500 text-white rounded-xl flex items-center justify-center text-xl font-bold flex-shrink-0">5</div>
                <div>
                    <h3 class="font-bold mb-1">Využijte nastavitelnost polic</h3>
                    <p class="text-gray-600 text-sm">Police lze nastavit po 5 cm. Přizpůsobte výšku podle toho, co skladujete. Vysoké předměty? Větší mezera mezi policemi.</p>
                </div>
            </div>

            <div class="flex gap-4 bg-white rounded-xl p-5 shadow-sm">
                <div class="w-12 h-12 bg-primary-500 text-white rounded-xl flex items-center justify-center text-xl font-bold flex-shrink-0">6</div>
                <div>
                    <h3 class="font-bold mb-1">Organizujte podle frekvence použití</h3>
                    <p class="text-gray-600 text-sm">Věci, které používáte denně, dejte do výšky očí. Sezónní věci mohou být nahoře nebo dole.</p>
                </div>
            </div>

            <div class="flex gap-4 bg-white rounded-xl p-5 shadow-sm">
                <div class="w-12 h-12 bg-primary-500 text-white rounded-xl flex items-center justify-center text-xl font-bold flex-shrink-0">7</div>
                <div>
                    <h3 class="font-bold mb-1">Používejte úložné boxy a koše</h3>
                    <p class="text-gray-600 text-sm">Drobné předměty organizujte do boxů. Budete mít lepší přehled a regál bude vypadat upraveněji.</p>
                </div>
            </div>

            <div class="flex gap-4 bg-white rounded-xl p-5 shadow-sm">
                <div class="w-12 h-12 bg-primary-500 text-white rounded-xl flex items-center justify-center text-xl font-bold flex-shrink-0">8</div>
                <div>
                    <h3 class="font-bold mb-1">Popisky a štítky jsou vaši přátelé</h3>
                    <p class="text-gray-600 text-sm">Označte boxy a police. Za měsíc si nebudete pamatovat, co kde je. Ušetříte čas hledáním.</p>
                </div>
            </div>

            <div class="flex gap-4 bg-white rounded-xl p-5 shadow-sm">
                <div class="w-12 h-12 bg-primary-500 text-white rounded-xl flex items-center justify-center text-xl font-bold flex-shrink-0">9</div>
                <div>
                    <h3 class="font-bold mb-1">Nepřetěžujte jednotlivé police</h3>
                    <p class="text-gray-600 text-sm">Každá police má svůj limit (175-210 kg). Rozložte zátěž rovnoměrně. Koncentrovaná váha uprostřed může poškodit polici.</p>
                </div>
            </div>

            <div class="flex gap-4 bg-white rounded-xl p-5 shadow-sm">
                <div class="w-12 h-12 bg-primary-500 text-white rounded-xl flex items-center justify-center text-xl font-bold flex-shrink-0">10</div>
                <div>
                    <h3 class="font-bold mb-1">Pravidelně kontrolujte spoje</h3>
                    <p class="text-gray-600 text-sm">Jednou za rok zkontrolujte, zda jsou všechny spoje pevné. U bezšroubových regálů stačí pohledová kontrola.</p>
                </div>
            </div>
        </div>

        <div class="bg-green-50 border-l-4 border-green-500 p-6 mb-8">
            <h3 class="font-bold text-green-800 mb-2">💡 Bonus tip</h3>
            <p class="text-green-700">Pokud kupujete více regálů, objednejte je najednou. Ušetříte na dopravě a budete mít jistotu, že všechny budou ze stejné výrobní série se shodným odstínem barvy.</p>
        </div>
    """

def generate_product_cards_html(products):
    """Generate HTML for product cards"""
    html = '<div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">'
    for p in products:
        discount = 75 if p.get("bestseller") else 70
        html += f'''
        <a href="{p['url']}" class="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-shadow group">
            <div class="relative">
                <img src="{p['img']}" alt="{p['name']}" class="w-full aspect-square object-contain p-4 bg-gray-50">
                <span class="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">-{discount}%</span>
            </div>
            <div class="p-4">
                <h3 class="font-medium text-sm group-hover:text-primary-500 mb-2">{p['name']}</h3>
                <div class="flex items-baseline gap-2">
                    <span class="text-xl font-bold text-primary-600">{p['price']} Kč</span>
                    <span class="text-sm text-gray-400 line-through">{p['price'] * 4} Kč</span>
                </div>
                <div class="text-xs text-green-600 mt-1">✓ Skladem • Nosnost {p['capacity']} kg</div>
            </div>
        </a>
        '''
    html += '</div>'
    return html

def generate_faq_html(keyword):
    """Generate FAQ section"""
    faqs = [
        (f"Jaká je nosnost regálu?", "Naše regály mají nosnost od 700 kg do 1050 kg. Nosnost jedné police je 175-210 kg při rovnoměrném rozložení."),
        (f"Jak dlouho trvá montáž?", "Bezšroubová montáž trvá 10-15 minut bez nářadí. V balení je obrázkový návod."),
        (f"Mohu regál použít venku?", "Pro venkovní použití doporučujeme pozinkované regály. Lakované jsou určeny do interiéru."),
        (f"Jaká je záruka?", "Na všechny regály poskytujeme záruku 7 let na vady materiálu a zpracování."),
    ]
    html = '<div class="space-y-4">'
    for q, a in faqs:
        html += f'''
        <div class="border rounded-xl overflow-hidden">
            <button onclick="this.parentElement.classList.toggle('open')" class="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50">
                <span class="font-medium">{q}</span>
                <span class="text-xl">▼</span>
            </button>
            <div class="px-5 pb-5 hidden">
                <p class="text-gray-600">{a}</p>
            </div>
        </div>'''
    html += '</div>'
    return html

def generate_html_page(article, all_articles):
    """Generate complete HTML page"""
    keyword = article['keyword']
    category = article['category']
    angle = article.get('angle', 'comprehensive')
    category_name = get_category_name(category)
    products = get_relevant_products(category)
    og_image = random.choice(list(IMAGES.values()))

    # Generate content based on angle
    if angle == 'buying_guide':
        main_content = generate_buying_guide_content(keyword, category)
    elif angle == 'tips':
        main_content = generate_tips_content(keyword, category)
    else:
        main_content = generate_comprehensive_content(keyword, category)

    # Get related articles
    related = [a for a in all_articles if a['category'] == category and a['slug'] != article['slug']][:6]
    related_html = ''
    if related:
        related_html = '<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">'
        for r in related:
            related_html += f'''
            <a href="{r['slug']}.html" class="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition group">
                <h3 class="font-medium group-hover:text-primary-500">{r['title'][:50]}...</h3>
                <p class="text-sm text-gray-500 mt-1">{r['description'][:60]}...</p>
            </a>'''
        related_html += '</div>'

    html = f'''<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{article['title']} | Bazarovyregal.cz</title>
    <meta name="description" content="{article['description']}">
    <link rel="canonical" href="{BASE_URL}/{article['slug']}.html">

    <meta property="og:title" content="{article['title']}">
    <meta property="og:description" content="{article['description']}">
    <meta property="og:image" content="{og_image}">
    <meta property="og:url" content="{BASE_URL}/{article['slug']}.html">
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="Bazarovyregal.cz">
    <meta property="og:locale" content="cs_CZ">

    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{article['title']}">
    <meta name="twitter:description" content="{article['description']}">

    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <script>
        tailwind.config = {{
            theme: {{ extend: {{ fontFamily: {{ sans: ['Inter', 'sans-serif'] }}, colors: {{ primary: {{ 50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74', 400: '#fb923c', 500: '#f97316', 600: '#ea580c', 700: '#c2410c', 800: '#9a3412', 900: '#7c2d12' }} }} }} }}
        }}
    </script>
    <style>.faq-item.open .hidden {{ display: block; }} .faq-item.open button span:last-child {{ transform: rotate(180deg); }}</style>
</head>
<body class="bg-gray-50 font-sans">

<div class="bg-gray-900 text-white text-sm py-2">
    <div class="container mx-auto px-4 flex justify-between items-center">
        <span>✉️ info@bazarovyregal.cz</span>
        <div class="flex gap-4"><span>🚚 Doprava od 99 Kč</span><span>⭐ 4.9/5</span></div>
    </div>
</div>

<header class="bg-white shadow-sm sticky top-0 z-40">
    <div class="container mx-auto px-4 py-4 flex items-center justify-between">
        <a href="index.html" class="flex items-center gap-2">
            <div class="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center"><span class="text-white text-xl font-bold">🏭</span></div>
            <div><div class="text-xl font-bold text-gray-900">Bazarovyregal<span class="text-primary-500">.cz</span></div><div class="text-xs text-red-600 font-medium">Slevy až 75%</div></div>
        </a>
        <nav class="hidden md:flex gap-4 text-sm font-medium text-gray-600">
            <a href="index.html" class="hover:text-primary-500">🏠 Úvod</a>
            <a href="katalog.html" class="hover:text-primary-500">📦 Regály</a>
            <a href="likvidace-skladu-regaly.html" class="hover:text-primary-500">🔥 Likvidace</a>
            <a href="kontakt.html" class="hover:text-primary-500">📧 Kontakt</a>
        </nav>
        <a href="katalog.html" class="bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600">🛒 Objednat</a>
    </div>
</header>

<nav class="bg-white border-b">
    <div class="container mx-auto px-4 py-3 text-sm">
        <ol class="flex items-center gap-2 text-gray-500 flex-wrap">
            <li><a href="index.html" class="hover:text-primary-500">Úvod</a></li><span>›</span>
            <li><a href="katalog.html" class="hover:text-primary-500">{category_name}</a></li><span>›</span>
            <li class="text-gray-900 font-medium">{article['h1'][:40]}...</li>
        </ol>
    </div>
</nav>

<main class="container mx-auto px-4 py-8">
    <article class="max-w-4xl mx-auto">
        <header class="mb-8">
            <div class="flex items-center gap-2 mb-4">
                <span class="bg-primary-100 text-primary-700 text-xs font-medium px-3 py-1 rounded-full">{category_name}</span>
                <span class="text-gray-400 text-sm">• {datetime.now().strftime('%d.%m.%Y')}</span>
            </div>
            <h1 class="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">{article['h1']}</h1>
            <p class="text-xl text-gray-600">{article['description']}</p>
        </header>

        <div class="bg-gradient-to-r from-primary-500 to-orange-500 rounded-2xl p-6 mb-8 text-white">
            <div class="flex flex-col md:flex-row items-center justify-between gap-4">
                <div><h2 class="text-2xl font-bold mb-2">🔥 Výprodej skladu - slevy až 75%!</h2><p class="text-white/90">Kvalitní kovové regály za bezkonkurenční ceny.</p></div>
                <a href="katalog.html" class="bg-white text-primary-600 px-6 py-3 rounded-xl font-bold hover:bg-gray-100 transition">Zobrazit nabídku →</a>
            </div>
        </div>

        <div class="prose prose-lg max-w-none">{main_content}</div>

        <section class="my-12">
            <h2 class="text-2xl font-bold mb-6">🛒 Doporučené produkty</h2>
            {generate_product_cards_html(products)}
            <div class="text-center"><a href="katalog.html" class="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-8 py-3 rounded-xl font-bold transition">Zobrazit všechny regály →</a></div>
        </section>

        <section class="my-12">
            <h2 class="text-2xl font-bold mb-6">❓ Často kladené dotazy</h2>
            {generate_faq_html(keyword)}
        </section>

        <section class="my-12">
            <h2 class="text-2xl font-bold mb-6">📚 Související články</h2>
            {related_html}
        </section>

        <div class="bg-gray-900 text-white rounded-2xl p-8 text-center my-12">
            <h2 class="text-2xl font-bold mb-4">Připraveni objednat?</h2>
            <p class="text-gray-300 mb-6">Využijte slevy až 75% a získejte kvalitní regál za bezkonkurenční cenu.</p>
            <div class="flex flex-col sm:flex-row gap-4 justify-center">
                <a href="katalog.html" class="bg-primary-500 hover:bg-primary-600 text-white px-8 py-3 rounded-xl font-bold">🛒 Zobrazit nabídku</a>
                <a href="kontakt.html" class="bg-white/10 hover:bg-white/20 text-white px-8 py-3 rounded-xl font-bold">📧 Kontakt</a>
            </div>
        </div>
    </article>
</main>

<footer class="bg-gray-900 text-white py-12">
    <div class="container mx-auto px-4">
        <div class="grid md:grid-cols-4 gap-8 mb-8">
            <div><div class="text-xl font-bold mb-4">Bazarovyregal<span class="text-primary-500">.cz</span></div><p class="text-gray-400 text-sm">Největší slevy na kovové regály.</p></div>
            <div><h4 class="font-bold mb-4">Kategorie</h4><ul class="space-y-2 text-gray-400 text-sm"><li><a href="regaly-do-garaze.html" class="hover:text-primary-400">Regály do garáže</a></li><li><a href="regaly-do-sklepa.html" class="hover:text-primary-400">Regály do sklepa</a></li><li><a href="zinkove-regaly.html" class="hover:text-primary-400">Zinkové regály</a></li></ul></div>
            <div><h4 class="font-bold mb-4">Informace</h4><ul class="space-y-2 text-gray-400 text-sm"><li><a href="montaz-regalu.html" class="hover:text-primary-400">Montáž regálů</a></li><li><a href="faq.html" class="hover:text-primary-400">FAQ</a></li><li><a href="kontakt.html" class="hover:text-primary-400">Kontakt</a></li></ul></div>
            <div><h4 class="font-bold mb-4">Kontakt</h4><ul class="space-y-2 text-gray-400 text-sm"><li>✉️ info@bazarovyregal.cz</li><li>🚚 Doprava od 99 Kč</li><li>🛡️ Záruka 7 let</li></ul></div>
        </div>
        <div class="border-t border-gray-800 pt-8 text-center text-gray-500 text-sm">© 2026 Bazarovyregal.cz - Shoptet.cz - Budujeme regálové impérium</div>
    </div>
</footer>

<script>document.querySelectorAll('.faq-item button').forEach(btn => {{ btn.addEventListener('click', () => {{ btn.parentElement.classList.toggle('open'); }}); }});</script>
</body>
</html>'''
    return html

def main():
    excel_path = '/sessions/modest-gallant-ptolemy/mnt/uploads/Analyza_KW_regaly Jun.xlsx'

    print("Načítám klíčová slova z Excelu...")
    df = pd.read_excel(excel_path)
    df_sorted = df.sort_values('Searches total (avg. per month)', ascending=False)

    articles = []
    used_slugs = set()

    # Skip these competitor terms
    skip_terms = ['ikea', 'obi', 'hornbach', 'bauhaus', 'baumax', 'jysk', 'lidl', 'penny', 'tesco']

    # Top 200 keywords - 3 articles each
    print("Generuji 3 články pro každé z top 200 klíčových slov...")
    top_count = 0
    for _, row in df_sorted.iterrows():
        if top_count >= 200:
            break

        keyword = str(row['Keyword']).strip()
        if not keyword or keyword == 'nan':
            continue
        if any(term in keyword.lower() for term in skip_terms):
            continue

        base_slug = slugify(keyword)
        if len(base_slug) < 4:
            continue

        category = get_keyword_category(keyword)

        # Generate 3 articles for this keyword
        for angle_info in ARTICLE_ANGLES:
            slug = f"{base_slug}-{angle_info['suffix']}"
            if slug in used_slugs:
                continue

            title = angle_info['title_template'].format(keyword=keyword.capitalize())
            h1 = angle_info['h1_template'].format(keyword=keyword)
            desc = f"{keyword.capitalize()}. Kvalitní kovové regály se slevou až 75%. Nosnost až 1050 kg, záruka 7 let."

            articles.append({
                'keyword': keyword,
                'slug': slug,
                'title': title,
                'h1': h1,
                'description': desc,
                'category': category,
                'angle': angle_info['angle']
            })
            used_slugs.add(slug)

        top_count += 1

    print(f"  Vytvořeno {len(articles)} článků z top 200 klíčových slov")

    # Remaining keywords - 1 article each (up to 400 more)
    print("Generuji další články pro zbývající klíčová slova...")
    remaining_count = 0
    for _, row in df_sorted.iloc[200:].iterrows():
        if remaining_count >= 400:
            break

        keyword = str(row['Keyword']).strip()
        if not keyword or keyword == 'nan':
            continue
        if any(term in keyword.lower() for term in skip_terms):
            continue

        slug = slugify(keyword)
        if slug in used_slugs or len(slug) < 4:
            continue

        category = get_keyword_category(keyword)
        title = f"{keyword.capitalize()} - Kompletní průvodce"
        h1 = f"{keyword.capitalize()}: Vše co potřebujete vědět"
        desc = f"{keyword.capitalize()}. Kvalitní kovové regály se slevou až 75%. Nosnost až 1050 kg, záruka 7 let."

        articles.append({
            'keyword': keyword,
            'slug': slug,
            'title': title,
            'h1': h1,
            'description': desc,
            'category': category,
            'angle': 'comprehensive'
        })
        used_slugs.add(slug)
        remaining_count += 1

    print(f"  Celkem připraveno {len(articles)} článků")

    # Generate HTML files
    print("\nGeneruji HTML soubory...")
    for i, article in enumerate(articles):
        html = generate_html_page(article, articles)
        filepath = os.path.join(OUTPUT_DIR, f"{article['slug']}.html")

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(html)

        if (i + 1) % 100 == 0:
            print(f"  Vygenerováno {i + 1}/{len(articles)} článků...")

    print(f"\n✅ Hotovo! Vygenerováno {len(articles)} SEO článků.")

    # Update sitemap
    print("\nAktualizuji sitemap.xml...")
    generate_sitemap(articles)

    return articles

def generate_sitemap(articles):
    """Generate sitemap with all articles and products"""
    now = datetime.now().strftime('%Y-%m-%d')

    sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

    # Main pages
    for page, priority in [('index.html', '1.0'), ('katalog.html', '1.0'), ('kontakt.html', '0.6'), ('o-nas.html', '0.6'), ('faq.html', '0.7')]:
        sitemap += f'    <url><loc>{BASE_URL}/{page}</loc><lastmod>{now}</lastmod><priority>{priority}</priority></url>\n'

    # Articles
    for article in articles:
        sitemap += f'    <url><loc>{BASE_URL}/{article["slug"]}.html</loc><lastmod>{now}</lastmod><priority>0.8</priority></url>\n'

    # Product pages
    product_files = [f for f in os.listdir(OUTPUT_DIR) if f.startswith('regal-') and f.endswith('.html')]
    for pf in product_files:
        sitemap += f'    <url><loc>{BASE_URL}/{pf}</loc><lastmod>{now}</lastmod><priority>0.9</priority></url>\n'

    sitemap += '</urlset>'

    with open(os.path.join(OUTPUT_DIR, 'sitemap.xml'), 'w', encoding='utf-8') as f:
        f.write(sitemap)

    total_urls = 5 + len(articles) + len(product_files)
    print(f"✅ Sitemap aktualizován s {total_urls} URL")

if __name__ == "__main__":
    main()
