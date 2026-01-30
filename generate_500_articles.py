#!/usr/bin/env python3
"""
Generates 500 unique SEO articles for Bazarovyregal.cz
Based on keyword analysis from Excel file
"""

import pandas as pd
import os
import re
import random
from datetime import datetime
from collections import defaultdict

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

# Featured products for linking
PRODUCTS = [
    {"name": "Regál 150×70×30 cm černý", "price": 599, "url": "regal-150x70x30-cerna.html", "img": IMAGES["black"], "capacity": 700},
    {"name": "Regál 150×70×30 cm zinkovaný", "price": 549, "url": "regal-150x70x30-zinkovany.html", "img": IMAGES["zinc"], "capacity": 700},
    {"name": "Regál 180×90×40 cm černý", "price": 739, "url": "regal-180x90x40-cerna.html", "img": IMAGES["black"], "capacity": 875, "bestseller": True},
    {"name": "Regál 180×90×40 cm zinkovaný", "price": 649, "url": "regal-180x90x40-zinkovany.html", "img": IMAGES["zinc"], "capacity": 875},
    {"name": "Regál 180×90×40 cm bílý", "price": 739, "url": "regal-180x90x40-bila.html", "img": IMAGES["white"], "capacity": 875},
    {"name": "Regál 180×90×40 cm červený", "price": 759, "url": "regal-180x90x40-cervena.html", "img": IMAGES["red"], "capacity": 875},
    {"name": "Regál 180×90×40 cm modrý", "price": 759, "url": "regal-180x90x40-modra.html", "img": IMAGES["blue"], "capacity": 875},
    {"name": "Regál 200×90×40 cm černý", "price": 849, "url": "regal-200x90x40-cerna.html", "img": IMAGES["black"], "capacity": 875},
    {"name": "Regál 220×90×45 cm černý", "price": 899, "url": "regal-220x90x45-cerna.html", "img": IMAGES["black"], "capacity": 875},
    {"name": "Regál 180×120×50 cm profesionální", "price": 1249, "url": "regal-180x120x50-profesionalni.html", "img": IMAGES["pro"], "capacity": 1050},
    {"name": "Regál 180×60×40 cm černý", "price": 689, "url": "regal-180x60x40-cerna.html", "img": IMAGES["black"], "capacity": 875},
    {"name": "Regál 180×40×40 cm zinkovaný", "price": 579, "url": "regal-180x40x40-zinkovany.html", "img": IMAGES["zinc"], "capacity": 875},
]

def slugify(text):
    """Convert text to URL-safe slug"""
    text = text.lower()
    # Czech character mapping
    replacements = {
        'á': 'a', 'č': 'c', 'ď': 'd', 'é': 'e', 'ě': 'e', 'í': 'i',
        'ň': 'n', 'ó': 'o', 'ř': 'r', 'š': 's', 'ť': 't', 'ú': 'u',
        'ů': 'u', 'ý': 'y', 'ž': 'z', 'ä': 'a', 'ö': 'o', 'ü': 'u'
    }
    for cz, en in replacements.items():
        text = text.replace(cz, en)
    # Remove special characters and replace spaces with hyphens
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    text = re.sub(r'[\s_]+', '-', text)
    text = re.sub(r'-+', '-', text)
    return text.strip('-')

def get_keyword_category(keyword):
    """Determine category based on keyword content"""
    kw = keyword.lower()

    if any(x in kw for x in ['garáž', 'garaz', 'auto', 'pneumat', 'nářadí', 'naradi']):
        return 'garage'
    elif any(x in kw for x in ['sklep', 'víno', 'vino', 'zavařen', 'zavaren']):
        return 'cellar'
    elif any(x in kw for x in ['díln', 'diln', 'řemesln', 'remesln', 'profes']):
        return 'workshop'
    elif any(x in kw for x in ['kancelář', 'kancelar', 'archiv', 'šanon']):
        return 'office'
    elif any(x in kw for x in ['kuchyň', 'kuchyn', 'spíž', 'spiz']):
        return 'kitchen'
    elif any(x in kw for x in ['koupeln', 'wc', 'toalet']):
        return 'bathroom'
    elif any(x in kw for x in ['dět', 'det', 'hračk', 'hrack', 'pokoj']):
        return 'kids'
    elif any(x in kw for x in ['šatn', 'satn', 'obleč', 'oblec', 'boty']):
        return 'wardrobe'
    elif any(x in kw for x in ['sklad', 'e-shop', 'eshop', 'logist']):
        return 'warehouse'
    elif any(x in kw for x in ['zink', 'pozink', 'vlhk']):
        return 'zinc'
    elif any(x in kw for x in ['montáž', 'montaz', 'sestav', 'návod', 'navod', 'jak']):
        return 'howto'
    elif any(x in kw for x in ['nosnost', 'kapacit', 'váha', 'vaha', 'kg']):
        return 'capacity'
    elif any(x in kw for x in ['rozměr', 'rozmer', 'výška', 'vyska', 'šířka', 'sirka', 'cm', 'mm']):
        return 'dimensions'
    elif any(x in kw for x in ['slev', 'akce', 'výprodej', 'vyprodej', 'levn', 'cena']):
        return 'deals'
    elif any(x in kw for x in ['kovov', 'ocel', 'železn', 'zelezn', 'metal']):
        return 'metal'
    elif any(x in kw for x in ['bíl', 'bil', 'čern', 'cern', 'červen', 'cerven', 'modr', 'barv']):
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
        'bathroom': 'Regály do koupelny',
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
    if category in ['cellar', 'zinc']:
        # Prefer zinc for cellars
        prods = [p for p in PRODUCTS if 'zink' in p['url']]
        prods += [p for p in PRODUCTS if 'zink' not in p['url']]
    elif category in ['garage', 'workshop', 'warehouse']:
        # Prefer black and large for garage/workshop
        prods = [p for p in PRODUCTS if 'cerna' in p['url'] or 'profesionalni' in p['url']]
        prods += [p for p in PRODUCTS if 'cerna' not in p['url'] and 'profesionalni' not in p['url']]
    elif category == 'office':
        # Prefer white for office
        prods = [p for p in PRODUCTS if 'bila' in p['url']]
        prods += [p for p in PRODUCTS if 'bila' not in p['url']]
    elif category == 'colors':
        # Mix of colors
        prods = [p for p in PRODUCTS if any(c in p['url'] for c in ['cervena', 'modra', 'bila'])]
        prods += [p for p in PRODUCTS if not any(c in p['url'] for c in ['cervena', 'modra', 'bila'])]
    else:
        prods = PRODUCTS.copy()
        random.shuffle(prods)
    return prods[:count]

# Content generation templates by category
CONTENT_TEMPLATES = {
    'garage': {
        'intro': [
            "Garáž je místem, kde se hromadí nářadí, náhradní díly, sezónní pneumatiky a desítky dalších věcí. Bez správného úložného systému se rychle změní v nepřehledný chaos.",
            "Každý majitel garáže zná ten problém - nářadí je všude po zemi, pneumatiky zabírají polovinu prostoru a najít potřebnou věc trvá věčnost. Řešením jsou kvalitní kovové regály.",
            "Garáž slouží nejen pro parkování auta, ale často také jako dílna, sklad sezónních věcí i místo pro hobby. Správná organizace pomocí regálů změní chaos v přehledný systém."
        ],
        'benefits': [
            "maximální využití vertikálního prostoru",
            "snadný přístup k nářadí a dílům",
            "ochrana před vlhkostí díky zinkovanému povrchu",
            "nosnost až 875 kg na regál",
            "odolnost proti oleji a chemikáliím"
        ],
        'tips': [
            "Těžké předměty (pneumatiky, akumulátory) umísťujte na spodní police",
            "Pro garáž volte zinkované regály odolné vlhkosti",
            "Využijte celou výšku prostoru - regály 200-220 cm jsou ideální",
            "Nechte průchozí prostor minimálně 80 cm pro pohodlný pohyb"
        ]
    },
    'cellar': {
        'intro': [
            "Sklep je tradičním místem pro skladování vína, zavařenin a sezónních zásob. Vlhké prostředí však klade vysoké nároky na použité materiály - obyčejné regály rychle zrezivějí.",
            "Správně zorganizovaný sklep je pokladnicí každé domácnosti. Zavařeniny, víno, brambory - vše potřebuje své místo. Pozinkované regály jsou ideálním řešením do vlhkého prostředí.",
            "V sklepě panuje specifické mikroklima s vyšší vlhkostí. Proto je klíčové vybrat regály s odpovídající povrchovou úpravou, která odolá těmto podmínkám."
        ],
        'benefits': [
            "pozinkovaný povrch odolný vlhkosti",
            "stabilní konstrukce pro těžké sklenice",
            "nastavitelná výška polic pro různé velikosti nádob",
            "snadná údržba a čištění",
            "dlouhá životnost i ve vlhkém prostředí"
        ],
        'tips': [
            "Volte výhradně pozinkované regály do vlhkých prostor",
            "Víno skladujte v nejtmavší a nejchladnější části sklepa",
            "Zavařeniny umístěte tak, abyste viděli etikety",
            "Těžší věci (brambory, jablka) dávejte dolů"
        ]
    },
    'workshop': {
        'intro': [
            "Profesionální dílna vyžaduje profesionální vybavení. Kvalitní kovové regály jsou základem každého řemeslníka - ať už jste truhlář, automechanik nebo domácí kutil.",
            "V dílně je organizace základem efektivity. Když máte vše po ruce a přehledně uspořádané, práce jde rychleji a bezpečněji. Robustní kovové regály jsou proto nezbytností.",
            "Dílna je srdcem každého řemeslníka. Správné uspořádání nářadí, materiálu a dílů pomocí kvalitních regálů zvyšuje produktivitu a snižuje riziko úrazů."
        ],
        'benefits': [
            "vysoká nosnost pro těžké nářadí a materiál",
            "odolnost proti mechanickému poškození",
            "snadná montáž bez speciálního nářadí",
            "možnost rozšíření a propojení více regálů",
            "stabilní konstrukce i při plném zatížení"
        ],
        'tips': [
            "Nářadí organizujte podle frekvence používání",
            "Využijte magnetické lišty a háčky na boky regálů",
            "Pro těžký materiál volte regály s nosností 875+ kg",
            "Zajistěte regály ke zdi pro maximální stabilitu"
        ]
    },
    'metal': {
        'intro': [
            "Kovové regály představují nejodolnější a nejspolehlivější řešení pro skladování. Na rozdíl od dřevěných nebo plastových variant nabízejí nesrovnatelnou nosnost a životnost.",
            "Když hledáte regál, který vydrží roky intenzivního používání, kovová konstrukce je jasnou volbou. Ocelové profily a kvalitní povrchová úprava garantují dlouhou životnost.",
            "Kovové regály jsou synonymem pro profesionální skladování. Ať už je využijete doma nebo ve firmě, jejich robustní konstrukce zvládne i to nejtěžší zatížení."
        ],
        'benefits': [
            "nosnost až 1050 kg na regál",
            "ocelová konstrukce s dlouhou životností",
            "odolnost proti požáru a škůdcům",
            "snadná údržba a čištění",
            "ekologická recyklovatelnost"
        ],
        'tips': [
            "Pro vlhké prostředí volte pozinkované provedení",
            "Lakované regály jsou ideální do interiéru",
            "Pravidelně kontrolujte utažení spojů",
            "Nepřetěžujte jednotlivé police nad stanovenou nosnost"
        ]
    },
    'deals': {
        'intro': [
            "Hledáte kvalitní regály za výhodnou cenu? Právě probíhá velký výprodej skladových zásob se slevami až 75%. Všechny regály jsou nové, nerozbalené a s plnou zárukou 7 let.",
            "Využijte jedinečnou příležitost pořídit si profesionální kovové regály za zlomek běžné ceny. Likvidace skladu znamená slevy, které se neopakují.",
            "Aktuální akce na kovové regály nabízí nebývalé slevy. Kvalitní české regály se zárukou 7 let nyní za ceny, které jinde nenajdete."
        ],
        'benefits': [
            "slevy až 75% oproti běžným cenám",
            "100% nové a nerozbalené zboží",
            "plná záruka 7 let jako na běžné produkty",
            "okamžitá expedice ze skladu",
            "doprava již od 99 Kč"
        ],
        'tips': [
            "Nejoblíbenější kusy mizí jako první - neváhejte",
            "Zkontrolujte, zda máte dost místa pro váš nový regál",
            "Objednejte více kusů najednou a ušetřete na dopravě",
            "Akce platí pouze do vyprodání zásob"
        ]
    },
    'howto': {
        'intro': [
            "Montáž kovového regálu je jednodušší, než si myslíte. Díky bezšroubovému systému zvládnete sestavení za pouhých 10 minut, a to zcela bez nářadí.",
            "Správná montáž je základem bezpečného používání regálu. V tomto návodu vás provedeme celým procesem krok za krokem.",
            "Naše regály jsou navrženy tak, aby jejich montáž zvládl opravdu každý. Bezšroubový systém zapadacích spojek nevyžaduje žádné speciální dovednosti ani nástroje."
        ],
        'benefits': [
            "montáž za 10 minut bez nářadí",
            "bezšroubový systém zapadacích spojek",
            "srozumitelný obrázkový návod v balení",
            "video návod k dispozici online",
            "možnost kdykoliv přeskládat police"
        ],
        'tips': [
            "Před montáží si rozložte všechny díly a zkontrolujte kompletnost",
            "Montáž ve dvou je rychlejší a jednodušší",
            "Pro stabilitu začněte od spodní police",
            "Po sestavení zkontrolujte vodorovnost vodováhou"
        ]
    },
    'general': {
        'intro': [
            "Regály jsou nepostradatelným pomocníkem v každé domácnosti i firmě. Správně zvolený regál přinese pořádek, přehlednost a maximální využití dostupného prostoru.",
            "Výběr správného regálu může zásadně změnit organizaci vašeho prostoru. Ať už potřebujete úložné řešení do garáže, sklepa nebo kanceláře, nabízíme regály pro každou potřebu.",
            "Kvalitní kovový regál je investicí na roky. Díky robustní konstrukci, vysoké nosnosti a dlouhé životnosti vám bude sloužit bez problémů celá desetiletí."
        ],
        'benefits': [
            "vysoká nosnost až 1050 kg",
            "bezšroubová montáž za 10 minut",
            "nastavitelná výška polic po 5 cm",
            "záruka 7 let na celý regál",
            "široký výběr rozměrů a barev"
        ],
        'tips': [
            "Před nákupem změřte dostupný prostor včetně výšky",
            "Zvažte, co budete skladovat, a podle toho vyberte nosnost",
            "Do vlhkých prostor volte pozinkované provedení",
            "Nechte prostor pro snadný přístup ze všech stran"
        ]
    }
}

# Add more categories with same structure
for cat in ['office', 'kitchen', 'bathroom', 'kids', 'wardrobe', 'warehouse', 'zinc', 'capacity', 'dimensions', 'colors']:
    if cat not in CONTENT_TEMPLATES:
        CONTENT_TEMPLATES[cat] = CONTENT_TEMPLATES['general'].copy()

def generate_article_content(keyword, category, all_articles):
    """Generate unique article content for a keyword"""

    template = CONTENT_TEMPLATES.get(category, CONTENT_TEMPLATES['general'])
    products = get_relevant_products(category)

    # Select random intro
    intro = random.choice(template['intro'])
    benefits = template['benefits']
    tips = template['tips']

    # Get related articles (from same category)
    related = [a for a in all_articles if a['category'] == category and a['slug'] != slugify(keyword)][:5]

    # Generate content sections based on keyword
    kw_lower = keyword.lower()

    # Dynamic content based on keyword type
    if any(x in kw_lower for x in ['jak', 'návod', 'montáž', 'postup']):
        main_content = generate_howto_content(keyword, products)
    elif any(x in kw_lower for x in ['nejlepší', 'top', 'srovnání', 'recenze']):
        main_content = generate_comparison_content(keyword, products)
    elif any(x in kw_lower for x in ['cena', 'kolik', 'levn', 'sleva']):
        main_content = generate_price_content(keyword, products)
    elif any(x in kw_lower for x in ['rozměr', 'velikost', 'cm', 'mm']):
        main_content = generate_dimension_content(keyword, products)
    else:
        main_content = generate_general_content(keyword, category, products)

    return {
        'intro': intro,
        'main_content': main_content,
        'benefits': benefits,
        'tips': tips,
        'products': products,
        'related': related
    }

def generate_howto_content(keyword, products):
    """Generate how-to style content"""
    return f"""
        <h2 class="text-2xl font-bold mb-4 mt-8">Podrobný návod krok za krokem</h2>
        <p class="mb-4">Následující postup vám pomůže rychle a správně dosáhnout požadovaného výsledku. Každý krok je důležitý pro bezpečnost a dlouhou životnost.</p>

        <div class="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h3 class="font-bold text-lg mb-4">Příprava</h3>
            <ol class="space-y-3">
                <li class="flex gap-4">
                    <span class="w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">1</span>
                    <div><strong>Zkontrolujte balení</strong> - ujistěte se, že máte všechny díly podle seznamu</div>
                </li>
                <li class="flex gap-4">
                    <span class="w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">2</span>
                    <div><strong>Připravte prostor</strong> - potřebujete rovnou podlahu a dostatek místa</div>
                </li>
                <li class="flex gap-4">
                    <span class="w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">3</span>
                    <div><strong>Rozložte díly</strong> - seskupte podobné komponenty pro rychlejší práci</div>
                </li>
            </ol>
        </div>

        <div class="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h3 class="font-bold text-lg mb-4">Vlastní postup</h3>
            <ol class="space-y-3">
                <li class="flex gap-4">
                    <span class="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">1</span>
                    <div><strong>Položte dvě stojny na zem</strong> rovnoběžně vedle sebe</div>
                </li>
                <li class="flex gap-4">
                    <span class="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">2</span>
                    <div><strong>Nasaďte příčky spodní police</strong> a zaklapněte do otvorů</div>
                </li>
                <li class="flex gap-4">
                    <span class="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">3</span>
                    <div><strong>Postavte konstrukci</strong> a přidejte zbývající dvě stojny</div>
                </li>
                <li class="flex gap-4">
                    <span class="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">4</span>
                    <div><strong>Vložte police</strong> na požadované pozice</div>
                </li>
                <li class="flex gap-4">
                    <span class="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">5</span>
                    <div><strong>Zkontrolujte stabilitu</strong> a případně vyrovnejte</div>
                </li>
            </ol>
        </div>

        <div class="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6">
            <h3 class="font-bold text-yellow-800 mb-2">⚠️ Důležité upozornění</h3>
            <p class="text-yellow-700">Pro maximální stabilitu doporučujeme regál přikotvit ke zdi, zejména pokud budete skladovat těžší předměty nebo pokud máte doma děti či domácí mazlíčky.</p>
        </div>
    """

def generate_comparison_content(keyword, products):
    """Generate comparison/review style content"""
    return f"""
        <h2 class="text-2xl font-bold mb-4 mt-8">Srovnání nejlepších variant</h2>
        <p class="mb-6">Vybrali jsme pro vás ty nejlepší produkty v dané kategorii. Každý z nich má své přednosti a hodí se pro jiný typ použití.</p>

        <div class="overflow-x-auto mb-8">
            <table class="w-full bg-white rounded-xl shadow-sm">
                <thead class="bg-gray-100">
                    <tr>
                        <th class="px-4 py-3 text-left font-bold">Produkt</th>
                        <th class="px-4 py-3 text-left font-bold">Rozměry</th>
                        <th class="px-4 py-3 text-left font-bold">Nosnost</th>
                        <th class="px-4 py-3 text-left font-bold">Cena</th>
                        <th class="px-4 py-3 text-left font-bold">Hodnocení</th>
                    </tr>
                </thead>
                <tbody>
                    <tr class="border-t">
                        <td class="px-4 py-3 font-medium">Regál 180×90×40 cm</td>
                        <td class="px-4 py-3">180×90×40 cm</td>
                        <td class="px-4 py-3">875 kg</td>
                        <td class="px-4 py-3 text-primary-600 font-bold">739 Kč</td>
                        <td class="px-4 py-3 text-yellow-500">★★★★★</td>
                    </tr>
                    <tr class="border-t bg-gray-50">
                        <td class="px-4 py-3 font-medium">Regál 200×90×40 cm</td>
                        <td class="px-4 py-3">200×90×40 cm</td>
                        <td class="px-4 py-3">875 kg</td>
                        <td class="px-4 py-3 text-primary-600 font-bold">849 Kč</td>
                        <td class="px-4 py-3 text-yellow-500">★★★★★</td>
                    </tr>
                    <tr class="border-t">
                        <td class="px-4 py-3 font-medium">Regál 150×70×30 cm</td>
                        <td class="px-4 py-3">150×70×30 cm</td>
                        <td class="px-4 py-3">700 kg</td>
                        <td class="px-4 py-3 text-primary-600 font-bold">599 Kč</td>
                        <td class="px-4 py-3 text-yellow-500">★★★★☆</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <h3 class="text-xl font-bold mb-4">Náš verdikt</h3>
        <p class="mb-4">Pro většinu uživatelů doporučujeme <strong>Regál 180×90×40 cm</strong> - nabízí ideální poměr velikosti, nosnosti a ceny. Je dostatečně prostorný pro běžné použití a jeho nosnost 875 kg zvládne i náročnější zatížení.</p>

        <p class="mb-4">Pokud potřebujete extra výšku, sáhněte po variantě 200 cm nebo 220 cm. Pro menší prostory je ideální kompaktní verze 150×70×30 cm.</p>
    """

def generate_price_content(keyword, products):
    """Generate price-focused content"""
    return f"""
        <h2 class="text-2xl font-bold mb-4 mt-8">Aktuální ceny a slevy</h2>
        <p class="mb-6">Přinášíme vám přehled aktuálních cen kovových regálů. Díky probíhající likvidaci skladu můžete ušetřit až 75% oproti běžným cenám.</p>

        <div class="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl p-6 mb-8">
            <div class="flex items-center gap-4 mb-4">
                <span class="text-4xl">🔥</span>
                <div>
                    <h3 class="text-xl font-bold text-red-600">Výprodejová akce</h3>
                    <p class="text-gray-600">Slevy až 75% - pouze do vyprodání zásob!</p>
                </div>
            </div>
            <div class="grid sm:grid-cols-3 gap-4">
                <div class="bg-white rounded-lg p-4 text-center">
                    <div class="text-3xl font-bold text-primary-600">od 549 Kč</div>
                    <div class="text-sm text-gray-500">Nejlevnější regál</div>
                </div>
                <div class="bg-white rounded-lg p-4 text-center">
                    <div class="text-3xl font-bold text-primary-600">739 Kč</div>
                    <div class="text-sm text-gray-500">Nejprodávanější</div>
                </div>
                <div class="bg-white rounded-lg p-4 text-center">
                    <div class="text-3xl font-bold text-primary-600">1249 Kč</div>
                    <div class="text-sm text-gray-500">Profesionální</div>
                </div>
            </div>
        </div>

        <h3 class="text-xl font-bold mb-4">Co ovlivňuje cenu regálu?</h3>
        <ul class="space-y-3 mb-6">
            <li class="flex items-start gap-3">
                <span class="text-primary-500 text-xl">📏</span>
                <div><strong>Rozměry</strong> - větší regály jsou logicky dražší, ale nabízejí lepší poměr cena/úložný prostor</div>
            </li>
            <li class="flex items-start gap-3">
                <span class="text-primary-500 text-xl">⚖️</span>
                <div><strong>Nosnost</strong> - vyšší nosnost znamená silnější materiál a vyšší cenu</div>
            </li>
            <li class="flex items-start gap-3">
                <span class="text-primary-500 text-xl">🎨</span>
                <div><strong>Povrchová úprava</strong> - pozinkované regály jsou levnější než lakované barevné varianty</div>
            </li>
            <li class="flex items-start gap-3">
                <span class="text-primary-500 text-xl">📚</span>
                <div><strong>Počet polic</strong> - více polic = vyšší cena, ale lepší organizace</div>
            </li>
        </ul>

        <div class="bg-green-50 border-l-4 border-green-500 p-4 mb-6">
            <h3 class="font-bold text-green-800 mb-2">💡 Tip pro úsporu</h3>
            <p class="text-green-700">Objednejte více regálů najednou a ušetřete na dopravě. Při objednávce nad 2000 Kč máte dopravu se slevou!</p>
        </div>
    """

def generate_dimension_content(keyword, products):
    """Generate dimension-focused content"""
    return f"""
        <h2 class="text-2xl font-bold mb-4 mt-8">Průvodce rozměry regálů</h2>
        <p class="mb-6">Správná volba rozměrů je klíčová pro maximální využití prostoru. Nabízíme regály v široké škále velikostí, aby vyhověly každé potřebě.</p>

        <div class="grid md:grid-cols-2 gap-6 mb-8">
            <div class="bg-white rounded-xl shadow-sm p-6">
                <h3 class="font-bold text-lg mb-4 flex items-center gap-2">📐 Standardní rozměry</h3>
                <ul class="space-y-2">
                    <li class="flex justify-between"><span>Výška:</span> <strong>150 - 220 cm</strong></li>
                    <li class="flex justify-between"><span>Šířka:</span> <strong>40 - 120 cm</strong></li>
                    <li class="flex justify-between"><span>Hloubka:</span> <strong>30 - 50 cm</strong></li>
                </ul>
            </div>
            <div class="bg-white rounded-xl shadow-sm p-6">
                <h3 class="font-bold text-lg mb-4 flex items-center gap-2">⚖️ Nosnost podle velikosti</h3>
                <ul class="space-y-2">
                    <li class="flex justify-between"><span>Kompaktní (150 cm):</span> <strong>700 kg</strong></li>
                    <li class="flex justify-between"><span>Standardní (180 cm):</span> <strong>875 kg</strong></li>
                    <li class="flex justify-between"><span>Profesionální:</span> <strong>1050 kg</strong></li>
                </ul>
            </div>
        </div>

        <h3 class="text-xl font-bold mb-4">Jak vybrat správnou velikost?</h3>
        <div class="space-y-4 mb-6">
            <div class="flex gap-4 bg-gray-50 rounded-xl p-5">
                <div class="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">🏠</div>
                <div>
                    <h4 class="font-bold mb-1">Do bytu nebo domu</h4>
                    <p class="text-sm text-gray-600">Doporučujeme výšku 150-180 cm a hloubku 30-40 cm. Menší rozměry lépe zapadnou do interiéru.</p>
                </div>
            </div>
            <div class="flex gap-4 bg-gray-50 rounded-xl p-5">
                <div class="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">🚗</div>
                <div>
                    <h4 class="font-bold mb-1">Do garáže nebo dílny</h4>
                    <p class="text-sm text-gray-600">Využijte maximální výšku 200-220 cm a větší hloubku 40-50 cm pro objemnější předměty.</p>
                </div>
            </div>
            <div class="flex gap-4 bg-gray-50 rounded-xl p-5">
                <div class="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">📦</div>
                <div>
                    <h4 class="font-bold mb-1">Do skladu</h4>
                    <p class="text-sm text-gray-600">Pro profesionální použití volte nejširší varianty (90-120 cm) s maximální nosností.</p>
                </div>
            </div>
        </div>

        <div class="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
            <h3 class="font-bold text-blue-800 mb-2">📏 Tip pro měření</h3>
            <p class="text-blue-700">Vždy nechte alespoň 5 cm volného prostoru na každé straně regálu pro snadnou montáž a přístup. U stěny počítejte i s lištami a zásuvkami.</p>
        </div>
    """

def generate_general_content(keyword, category, products):
    """Generate general article content"""
    category_name = get_category_name(category)

    return f"""
        <h2 class="text-2xl font-bold mb-4 mt-8">Proč si vybrat naše regály?</h2>
        <p class="mb-6">Naše kovové regály jsou navrženy tak, aby splnily ty nejnáročnější požadavky na skladování. Kombinují vysokou nosnost, snadnou montáž a dlouhou životnost.</p>

        <div class="grid md:grid-cols-2 gap-6 mb-8">
            <div class="flex gap-4 bg-white rounded-xl p-5 shadow-sm">
                <div class="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">💪</div>
                <div>
                    <h3 class="font-bold mb-1">Vysoká nosnost</h3>
                    <p class="text-sm text-gray-600">Až 1050 kg na regál díky robustní ocelové konstrukci. Každá police unese 175-210 kg.</p>
                </div>
            </div>
            <div class="flex gap-4 bg-white rounded-xl p-5 shadow-sm">
                <div class="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">⚡</div>
                <div>
                    <h3 class="font-bold mb-1">Rychlá montáž</h3>
                    <p class="text-sm text-gray-600">Bezšroubový systém umožňuje sestavení za 10 minut bez jakéhokoliv nářadí.</p>
                </div>
            </div>
            <div class="flex gap-4 bg-white rounded-xl p-5 shadow-sm">
                <div class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">🛡️</div>
                <div>
                    <h3 class="font-bold mb-1">Záruka 7 let</h3>
                    <p class="text-sm text-gray-600">Na všechny naše regály poskytujeme prodlouženou záruku 7 let.</p>
                </div>
            </div>
            <div class="flex gap-4 bg-white rounded-xl p-5 shadow-sm">
                <div class="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">📏</div>
                <div>
                    <h3 class="font-bold mb-1">Nastavitelné police</h3>
                    <p class="text-sm text-gray-600">Výšku polic lze nastavit po 5 cm podle vašich potřeb.</p>
                </div>
            </div>
        </div>

        <h2 class="text-2xl font-bold mb-4 mt-8">Pro koho jsou naše regály určeny?</h2>
        <p class="mb-4">Naše regály najdou uplatnění prakticky kdekoliv, kde potřebujete efektivně skladovat věci:</p>

        <ul class="space-y-3 mb-6">
            <li class="flex items-start gap-3">
                <span class="text-green-500 text-xl">✓</span>
                <div><strong>Domácnosti</strong> - do garáže, sklepa, spíže, šatny nebo pracovny</div>
            </li>
            <li class="flex items-start gap-3">
                <span class="text-green-500 text-xl">✓</span>
                <div><strong>Dílny a řemeslníci</strong> - pro nářadí, materiál a díly</div>
            </li>
            <li class="flex items-start gap-3">
                <span class="text-green-500 text-xl">✓</span>
                <div><strong>E-shopy a sklady</strong> - pro efektivní organizaci zboží</div>
            </li>
            <li class="flex items-start gap-3">
                <span class="text-green-500 text-xl">✓</span>
                <div><strong>Kanceláře a archivy</strong> - pro dokumenty, šanony a kancelářské potřeby</div>
            </li>
        </ul>

        <h2 class="text-2xl font-bold mb-4 mt-8">Materiál a povrchová úprava</h2>
        <p class="mb-4">Všechny naše regály jsou vyrobeny z kvalitního ocelového plechu. Nabízíme dvě varianty povrchové úpravy:</p>

        <div class="grid md:grid-cols-2 gap-6 mb-6">
            <div class="bg-gray-100 rounded-xl p-5">
                <h3 class="font-bold mb-2">🔩 Pozinkované</h3>
                <p class="text-sm text-gray-600 mb-2">Ideální do vlhkých prostor jako sklepy a garáže. Zinkový povlak chrání před korozí.</p>
                <p class="text-primary-600 font-bold">od 549 Kč</p>
            </div>
            <div class="bg-gray-900 text-white rounded-xl p-5">
                <h3 class="font-bold mb-2">🎨 Lakované</h3>
                <p class="text-sm text-gray-300 mb-2">Elegantní vzhled do interiéru. K dispozici v černé, bílé, červené a modré barvě.</p>
                <p class="text-primary-400 font-bold">od 599 Kč</p>
            </div>
        </div>
    """

def generate_faq_section(keyword, category):
    """Generate FAQ section for the article"""
    faqs = [
        ("Jaká je nosnost regálu?", f"Naše regály mají nosnost od 700 kg do 1050 kg podle modelu. Nosnost jednotlivé police je 175-210 kg při rovnoměrném rozložení zátěže."),
        ("Jak dlouho trvá montáž?", "Díky bezšroubovému systému zvládnete montáž za 10-15 minut bez jakéhokoliv nářadí. V balení je přiložen obrázkový návod."),
        ("Mohu regál použít ve vlhkém prostředí?", "Ano, pro vlhké prostory doporučujeme pozinkované regály, které jsou odolné proti korozi. Lakované varianty jsou vhodné do suchých prostor."),
        ("Jaká je záruka?", "Na všechny naše regály poskytujeme záruku 7 let. Vztahuje se na vady materiálu a zpracování."),
        ("Lze nastavit výšku polic?", "Ano, police jsou nastavitelné po 5 cm výšky. Můžete je kdykoliv přeskládat podle vašich aktuálních potřeb."),
        ("Jak dlouho trvá doručení?", "Všechny produkty jsou skladem a expedujeme je ihned. Doručení trvá obvykle 2-3 pracovní dny."),
    ]

    html = '<div class="space-y-4">'
    for q, a in faqs[:4]:
        html += f'''
        <div class="border rounded-xl overflow-hidden">
            <button onclick="this.parentElement.classList.toggle('open')" class="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50">
                <span class="font-medium">{q}</span>
                <span class="text-xl transition-transform">▼</span>
            </button>
            <div class="px-5 pb-5 hidden">
                <p class="text-gray-600">{a}</p>
            </div>
        </div>
        '''
    html += '</div>'
    return html

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

def generate_related_links_html(related_articles):
    """Generate HTML for related article links"""
    if not related_articles:
        return ""

    html = '<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">'
    for article in related_articles[:6]:
        html += f'''
        <a href="{article['slug']}.html" class="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow group">
            <h3 class="font-medium group-hover:text-primary-500">{article['title']}</h3>
            <p class="text-sm text-gray-500 mt-1 line-clamp-2">{article['description'][:80]}...</p>
        </a>
        '''
    html += '</div>'
    return html

def generate_html_page(article, all_articles):
    """Generate complete HTML page for an article"""

    content = generate_article_content(article['keyword'], article['category'], all_articles)
    category_name = get_category_name(article['category'])
    og_image = random.choice(list(IMAGES.values()))

    # Select random tips and benefits
    tips_html = ''.join([f'<li class="flex items-start gap-3"><span class="text-primary-500 text-xl">💡</span><span>{tip}</span></li>' for tip in content['tips'][:4]])
    benefits_html = ''.join([f'<li class="flex items-start gap-3"><span class="text-green-500 text-xl">✓</span><span>{b}</span></li>' for b in content['benefits'][:5]])

    html = f'''<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{article['title']} | Bazarovyregal.cz</title>
    <meta name="description" content="{article['description']}">
    <link rel="canonical" href="{BASE_URL}/{article['slug']}.html">

    <!-- OpenGraph -->
    <meta property="og:title" content="{article['title']}">
    <meta property="og:description" content="{article['description']}">
    <meta property="og:image" content="{og_image}">
    <meta property="og:url" content="{BASE_URL}/{article['slug']}.html">
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="Bazarovyregal.cz">
    <meta property="og:locale" content="cs_CZ">

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{article['title']}">
    <meta name="twitter:description" content="{article['description']}">
    <meta name="twitter:image" content="{og_image}">

    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <script>
        tailwind.config = {{
            theme: {{
                extend: {{
                    fontFamily: {{ sans: ['Inter', 'sans-serif'] }},
                    colors: {{
                        primary: {{ 50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74', 400: '#fb923c', 500: '#f97316', 600: '#ea580c', 700: '#c2410c', 800: '#9a3412', 900: '#7c2d12' }}
                    }}
                }}
            }}
        }}
    </script>
    <style>
        .faq-item.open .hidden {{ display: block; }}
        .faq-item.open button span:last-child {{ transform: rotate(180deg); }}
    </style>
</head>
<body class="bg-gray-50 font-sans">

<!-- Top Bar -->
<div class="bg-gray-900 text-white text-sm py-2">
    <div class="container mx-auto px-4 flex justify-between items-center">
        <div class="flex items-center gap-6">
            <span>✉️ info@bazarovyregal.cz</span>
        </div>
        <div class="flex items-center gap-4">
            <span>🚚 Doprava od 99 Kč</span>
            <span>⭐ 4.9/5 (2847 recenzí)</span>
        </div>
    </div>
</div>

<!-- Header -->
<header class="bg-white shadow-sm sticky top-0 z-40">
    <div class="container mx-auto px-4 py-4 flex items-center justify-between">
        <a href="index.html" class="flex items-center gap-2">
            <div class="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
                <span class="text-white text-xl font-bold">🏭</span>
            </div>
            <div>
                <div class="text-xl font-bold text-gray-900">Bazarovyregal<span class="text-primary-500">.cz</span></div>
                <div class="text-xs text-red-600 font-medium">Slevy až 75% na regály</div>
            </div>
        </a>
        <nav class="hidden md:flex gap-4 text-sm font-medium text-gray-600">
            <a href="index.html" class="hover:text-primary-500">🏠 Úvod</a>
            <a href="katalog.html" class="hover:text-primary-500">📦 Všechny regály</a>
            <a href="likvidace-skladu-regaly.html" class="hover:text-primary-500">🔥 Likvidace skladu</a>
            <a href="kontakt.html" class="hover:text-primary-500">📧 Kontakt</a>
        </nav>
        <a href="katalog.html" class="flex items-center gap-2 bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition">
            🛒 Objednat
        </a>
    </div>
</header>

<!-- Breadcrumb -->
<nav class="bg-white border-b">
    <div class="container mx-auto px-4 py-3 text-sm">
        <ol class="flex items-center gap-2 text-gray-500 flex-wrap">
            <li><a href="index.html" class="hover:text-primary-500">Úvod</a></li>
            <span>›</span>
            <li><a href="katalog.html" class="hover:text-primary-500">{category_name}</a></li>
            <span>›</span>
            <li class="text-gray-900 font-medium">{article['h1'][:50]}...</li>
        </ol>
    </div>
</nav>

<main class="container mx-auto px-4 py-8">
    <article class="max-w-4xl mx-auto">

        <!-- Article Header -->
        <header class="mb-8">
            <div class="flex items-center gap-2 mb-4">
                <span class="bg-primary-100 text-primary-700 text-xs font-medium px-3 py-1 rounded-full">{category_name}</span>
                <span class="text-gray-400 text-sm">• Aktualizováno {datetime.now().strftime('%d.%m.%Y')}</span>
            </div>
            <h1 class="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">{article['h1']}</h1>
            <p class="text-xl text-gray-600">{content['intro']}</p>
        </header>

        <!-- Featured Products CTA -->
        <div class="bg-gradient-to-r from-primary-500 to-orange-500 rounded-2xl p-6 mb-8 text-white">
            <div class="flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                    <h2 class="text-2xl font-bold mb-2">🔥 Výprodej skladu - slevy až 75%!</h2>
                    <p class="text-white/90">Kvalitní kovové regály za bezkonkurenční ceny. Pouze nové zboží se zárukou 7 let.</p>
                </div>
                <a href="katalog.html" class="bg-white text-primary-600 px-6 py-3 rounded-xl font-bold hover:bg-gray-100 transition whitespace-nowrap">
                    Zobrazit nabídku →
                </a>
            </div>
        </div>

        <!-- Main Content -->
        <div class="prose prose-lg max-w-none">
            {content['main_content']}
        </div>

        <!-- Benefits Section -->
        <section class="my-12">
            <h2 class="text-2xl font-bold mb-6">✅ Hlavní výhody našich regálů</h2>
            <ul class="space-y-3 bg-green-50 rounded-xl p-6">
                {benefits_html}
            </ul>
        </section>

        <!-- Recommended Products -->
        <section class="my-12">
            <h2 class="text-2xl font-bold mb-6">🛒 Doporučené produkty</h2>
            {generate_product_cards_html(content['products'])}
            <div class="text-center">
                <a href="katalog.html" class="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-8 py-3 rounded-xl font-bold transition">
                    Zobrazit všechny regály →
                </a>
            </div>
        </section>

        <!-- Tips Section -->
        <section class="my-12">
            <h2 class="text-2xl font-bold mb-6">💡 Užitečné tipy</h2>
            <ul class="space-y-3 bg-yellow-50 rounded-xl p-6">
                {tips_html}
            </ul>
        </section>

        <!-- FAQ Section -->
        <section class="my-12">
            <h2 class="text-2xl font-bold mb-6">❓ Často kladené dotazy</h2>
            {generate_faq_section(article['keyword'], article['category'])}
        </section>

        <!-- Related Articles -->
        <section class="my-12">
            <h2 class="text-2xl font-bold mb-6">📚 Související články</h2>
            {generate_related_links_html(content['related'])}
        </section>

        <!-- Final CTA -->
        <div class="bg-gray-900 text-white rounded-2xl p-8 text-center my-12">
            <h2 class="text-2xl font-bold mb-4">Připraveni objednat?</h2>
            <p class="text-gray-300 mb-6">Využijte aktuální slevy až 75% a získejte kvalitní regál za bezkonkurenční cenu.</p>
            <div class="flex flex-col sm:flex-row gap-4 justify-center">
                <a href="katalog.html" class="bg-primary-500 hover:bg-primary-600 text-white px-8 py-3 rounded-xl font-bold transition">
                    🛒 Zobrazit nabídku
                </a>
                <a href="kontakt.html" class="bg-white/10 hover:bg-white/20 text-white px-8 py-3 rounded-xl font-bold transition">
                    📧 Kontaktovat nás
                </a>
            </div>
        </div>

    </article>
</main>

<!-- Footer -->
<footer class="bg-gray-900 text-white py-12">
    <div class="container mx-auto px-4">
        <div class="grid md:grid-cols-4 gap-8 mb-8">
            <div>
                <div class="text-xl font-bold mb-4">Bazarovyregal<span class="text-primary-500">.cz</span></div>
                <p class="text-gray-400 text-sm">Největší slevy na kovové regály. Pouze nové zboží se zárukou 7 let.</p>
            </div>
            <div>
                <h4 class="font-bold mb-4">Kategorie</h4>
                <ul class="space-y-2 text-gray-400 text-sm">
                    <li><a href="regaly-do-garaze.html" class="hover:text-primary-400">Regály do garáže</a></li>
                    <li><a href="regaly-do-sklepa.html" class="hover:text-primary-400">Regály do sklepa</a></li>
                    <li><a href="zinkove-regaly.html" class="hover:text-primary-400">Zinkové regály</a></li>
                    <li><a href="likvidace-skladu-regaly.html" class="hover:text-primary-400">Likvidace skladu</a></li>
                </ul>
            </div>
            <div>
                <h4 class="font-bold mb-4">Informace</h4>
                <ul class="space-y-2 text-gray-400 text-sm">
                    <li><a href="montaz-regalu.html" class="hover:text-primary-400">Montáž regálů</a></li>
                    <li><a href="nosnost-regalu.html" class="hover:text-primary-400">Nosnost regálů</a></li>
                    <li><a href="faq.html" class="hover:text-primary-400">FAQ</a></li>
                    <li><a href="kontakt.html" class="hover:text-primary-400">Kontakt</a></li>
                </ul>
            </div>
            <div>
                <h4 class="font-bold mb-4">Kontakt</h4>
                <ul class="space-y-2 text-gray-400 text-sm">
                    <li>✉️ info@bazarovyregal.cz</li>
                    <li>🚚 Doprava od 99 Kč</li>
                    <li>🛡️ Záruka 7 let</li>
                </ul>
            </div>
        </div>
        <div class="border-t border-gray-800 pt-8 text-center text-gray-500 text-sm">
            © 2026 Bazarovyregal.cz - Shoptet.cz - Budujeme regálové impérium
        </div>
    </div>
</footer>

<script>
// FAQ toggle
document.querySelectorAll('.faq-item button').forEach(btn => {{
    btn.addEventListener('click', () => {{
        btn.parentElement.classList.toggle('open');
    }});
}});
</script>

</body>
</html>'''

    return html

def process_keywords(excel_path, max_articles=500):
    """Process keywords from Excel and generate article definitions"""

    df = pd.read_excel(excel_path)

    # Get keywords with search volume
    df_sorted = df.sort_values('Searches total (avg. per month)', ascending=False)

    # Track used slugs to avoid duplicates
    used_slugs = set()
    articles = []

    for _, row in df_sorted.iterrows():
        if len(articles) >= max_articles:
            break

        keyword = str(row['Keyword']).strip()
        if not keyword or keyword == 'nan':
            continue

        slug = slugify(keyword)

        # Skip if slug already used or too short
        if slug in used_slugs or len(slug) < 5:
            continue

        # Skip non-relevant keywords
        kw_lower = keyword.lower()
        skip_terms = ['ikea', 'obi', 'hornbach', 'bauhaus', 'baumax', 'jysk', 'lidl', 'aldi', 'tesco', 'penny']
        if any(term in kw_lower for term in skip_terms):
            continue

        category = get_keyword_category(keyword)
        searches = row['Searches total (avg. per month)'] if pd.notna(row['Searches total (avg. per month)']) else 0

        # Generate title and description
        title = keyword.capitalize()
        if not any(x in kw_lower for x in ['regál', 'regal', 'police', 'stojan']):
            title = f"{keyword} - regály a police"

        # Create H1
        h1 = f"{keyword.capitalize()} - kompletní průvodce"
        if 'jak' in kw_lower or 'návod' in kw_lower:
            h1 = keyword.capitalize()
        elif 'nejlepší' in kw_lower or 'top' in kw_lower:
            h1 = f"{keyword.capitalize()} roku 2026"

        # Create description
        description = f"{keyword.capitalize()}. Kvalitní kovové regály se slevou až 75%. Nosnost až 1050 kg, záruka 7 let, montáž za 10 minut. Skladem, expedice ihned."

        articles.append({
            'keyword': keyword,
            'slug': slug,
            'title': title,
            'h1': h1,
            'description': description,
            'category': category,
            'searches': searches
        })

        used_slugs.add(slug)

    return articles

def main():
    excel_path = '/sessions/modest-gallant-ptolemy/mnt/uploads/Analyza_KW_regaly Jun.xlsx'

    print("Načítám klíčová slova z Excelu...")
    articles = process_keywords(excel_path, max_articles=500)

    print(f"Připraveno {len(articles)} článků k vygenerování")
    print()

    # Generate HTML files
    print("Generuji HTML soubory...")
    for i, article in enumerate(articles):
        html = generate_html_page(article, articles)
        filepath = os.path.join(OUTPUT_DIR, f"{article['slug']}.html")

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(html)

        if (i + 1) % 50 == 0:
            print(f"  Vygenerováno {i + 1}/{len(articles)} článků...")

    print(f"\n✅ Hotovo! Vygenerováno {len(articles)} SEO článků.")

    # Generate updated sitemap
    print("\nAktualizuji sitemap.xml...")
    generate_sitemap(articles)

    return articles

def generate_sitemap(articles):
    """Generate updated sitemap with all articles"""
    now = datetime.now().strftime('%Y-%m-%d')

    sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n'
    sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

    # Main pages
    main_pages = [
        ('index.html', '1.0', 'daily'),
        ('katalog.html', '1.0', 'daily'),
        ('kontakt.html', '0.6', 'monthly'),
        ('o-nas.html', '0.6', 'monthly'),
        ('faq.html', '0.7', 'weekly'),
    ]

    for page, priority, freq in main_pages:
        sitemap += f'''    <url>
        <loc>{BASE_URL}/{page}</loc>
        <lastmod>{now}</lastmod>
        <changefreq>{freq}</changefreq>
        <priority>{priority}</priority>
    </url>\n'''

    # Article pages
    for article in articles:
        priority = '0.8' if article['searches'] > 500 else '0.7'
        sitemap += f'''    <url>
        <loc>{BASE_URL}/{article['slug']}.html</loc>
        <lastmod>{now}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>{priority}</priority>
    </url>\n'''

    # Product pages
    product_files = [
        "regal-150x70x30-cerna", "regal-150x70x30-cervena", "regal-150x70x30-zinkovany",
        "regal-180x90x40-bila", "regal-180x90x40-zinkovany", "regal-180x60x40-cerna",
        "regal-180x40x40-cerna", "regal-200x90x40-cerna", "regal-220x90x45-cerna",
        "regal-180x120x50-cerna", "regal-180x90x40-modra", "regal-180x40x30-zinkovany",
        "regal-180x90x45-cerna", "regal-220x70x45-bila", "regal-200x40x30-modra",
        "regal-200x70x45-cerna", "regal-200x120x40-cerna", "regal-220x70x50-cervena",
        "regal-150x120x40-zinkovany", "regal-180x90x50-cervena", "regal-180x70x30-bila",
        "regal-200x60x50-modra", "regal-220x60x45-bila", "regal-200x120x50-zinkovany",
        "regal-200x60x40-zinkovany", "regal-150x40x30-bila", "regal-150x120x45-cervena",
        "regal-200x90x40-modra", "regal-200x120x40-zinkovany", "regal-220x40x30-cervena",
        "regal-180x40x40-zinkovany", "regal-150x90x30-zinkovany", "regal-180x90x40-cervena",
        "regal-200x90x50-cerna", "regal-180x40x45-cerna", "regal-180x120x40-cerna",
        "regal-150x60x30-cerna", "regal-150x120x40-cervena", "regal-220x60x40-zinkovany",
        "regal-220x60x50-modra", "regal-150x40x50-cervena", "regal-220x90x30-cerna",
        "regal-220x70x30-bila", "regal-180x120x50-bila", "regal-180x70x50-bila",
        "regal-150x40x40-bila", "regal-220x90x40-modra", "regal-180x90x30-modra",
        "regal-220x70x50-zinkovany", "regal-220x60x40-cervena", "regal-150x120x30-cervena",
        "regal-150x120x50-zinkovany", "regal-180x40x30-bila", "regal-150x60x50-cerna",
        "regal-180x120x30-zinkovany", "regal-220x120x45-cervena", "regal-200x60x45-modra",
        "regal-200x90x45-cerna", "regal-180x120x45-bila", "regal-150x60x45-cervena",
        "regal-220x120x45-zinkovany", "regal-150x120x45-cerna", "regal-200x70x40-cervena",
        "regal-200x120x50-cervena", "regal-150x90x45-cerna", "regal-200x60x45-bila",
        "regal-220x120x30-cerna", "regal-180x120x30-cervena", "regal-180x90x40-cerna",
        "regal-200x40x45-bila", "regal-180x40x45-zinkovany", "regal-180x60x40-bila",
        "regal-150x60x45-modra", "regal-180x70x40-cerna", "regal-150x90x40-bila",
        "regal-200x70x40-bila", "regal-180x90x45-cervena", "regal-150x40x45-bila",
        "regal-200x40x30-zinkovany", "regal-200x70x50-zinkovany", "regal-150x90x40-cervena",
        "regal-220x40x40-cervena", "regal-150x70x45-cerna", "regal-200x90x45-modra",
        "regal-200x120x40-bila", "regal-150x70x30-bila", "regal-180x120x50-profesionalni"
    ]

    for pf in product_files:
        sitemap += f'''    <url>
        <loc>{BASE_URL}/{pf}.html</loc>
        <lastmod>{now}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.9</priority>
    </url>\n'''

    sitemap += '</urlset>'

    with open(os.path.join(OUTPUT_DIR, 'sitemap.xml'), 'w', encoding='utf-8') as f:
        f.write(sitemap)

    print(f"✅ Sitemap aktualizován s {len(articles) + len(product_files) + len(main_pages)} URL")

if __name__ == "__main__":
    main()
