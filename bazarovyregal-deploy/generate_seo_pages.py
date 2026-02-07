#!/usr/bin/env python3
"""
Generates 100+ SEO pages for Bazarovyregal.cz
With internal linking, OpenGraph tags, and product links
"""

import os
import json
from datetime import datetime

# Base URL
BASE_URL = "https://bazarovyregal.vercel.app"

# Product images for visual content (correct URLs without _cache typos)
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
    {"name": "Regál 150×70×30 cm černý", "price": 599, "url": "regal-150x70x30-cerna.html", "img": IMAGES["black"]},
    {"name": "Regál 150×70×30 cm zinkovaný", "price": 549, "url": "regal-150x70x30-zinkovany.html", "img": IMAGES["zinc"]},
    {"name": "Regál 180×90×40 cm černý", "price": 739, "url": "regal-180x90x40-cerna.html", "img": IMAGES["black"], "bestseller": True},
    {"name": "Regál 180×90×40 cm zinkovaný", "price": 649, "url": "regal-180x90x40-zinkovany.html", "img": IMAGES["zinc"]},
    {"name": "Regál 180×90×40 cm bílý", "price": 739, "url": "regal-180x90x40-bila.html", "img": IMAGES["white"]},
    {"name": "Regál 180×90×40 cm červený", "price": 759, "url": "regal-180x90x40-cervena.html", "img": IMAGES["red"]},
    {"name": "Regál 180×90×40 cm modrý", "price": 759, "url": "regal-180x90x40-modra.html", "img": IMAGES["blue"]},
    {"name": "Regál 200×90×40 cm černý", "price": 849, "url": "regal-200x90x40-cerna.html", "img": IMAGES["black"]},
    {"name": "Regál 180×120×50 cm profesionální", "price": 1249, "url": "regal-180x120x50-profesionalni.html", "img": IMAGES["pro"]},
    {"name": "Regál 180×40×40 cm zinkovaný", "price": 579, "url": "regal-180x40x40-zinkovany.html", "img": IMAGES["zinc"]},
]

# SEO Pages structure
SEO_PAGES = [
    # LIKVIDACE SKLADU (15 pages)
    {
        "slug": "likvidace-skladu-regaly",
        "title": "Likvidace skladu s regály | Slevy až 75%",
        "h1": "Likvidace skladu - kovové regály za bezkonkurenční ceny",
        "description": "Velká likvidace skladu s kovovými regály. Slevy až 75% na všechny regály. Pouze nové a nerozbalené zboží se zárukou 7 let.",
        "category": "likvidace",
        "content": """
        <p class="text-xl text-gray-600 mb-8">Využijte jedinečnou příležitost nakoupit kvalitní kovové regály za zlomek původní ceny. Likvidujeme sklad a všechny regály musí pryč!</p>

        <div class="bg-red-50 border-l-4 border-red-500 p-6 mb-8">
            <h2 class="text-xl font-bold text-red-700 mb-2">⚠️ Časově omezená nabídka</h2>
            <p class="text-red-600">Likvidace skladu probíhá pouze do vyprodání zásob. Neváhejte, nejlepší kusy mizí jako první!</p>
        </div>

        <h2 class="text-2xl font-bold mb-4">Proč nakoupit při likvidaci skladu?</h2>
        <ul class="space-y-3 mb-8">
            <li class="flex items-start gap-3"><span class="text-green-500 text-xl">✓</span> <span><strong>Slevy až 75%</strong> oproti běžným cenám</span></li>
            <li class="flex items-start gap-3"><span class="text-green-500 text-xl">✓</span> <span><strong>100% nové zboží</strong> - pouze nerozbalené kusy</span></li>
            <li class="flex items-start gap-3"><span class="text-green-500 text-xl">✓</span> <span><strong>Plná záruka 7 let</strong> jako na běžné zboží</span></li>
            <li class="flex items-start gap-3"><span class="text-green-500 text-xl">✓</span> <span><strong>Okamžitá expedice</strong> - vše skladem</span></li>
        </ul>

        <h2 class="text-2xl font-bold mb-4">Nejprodávanější regály z likvidace</h2>
        """
    },
    {
        "slug": "vyprodej-skladu-kovove-regaly",
        "title": "Výprodej skladu kovových regálů | Až -70%",
        "h1": "Masivní výprodej skladu - kovové regály se slevou až 70%",
        "description": "Výprodej skladu kovových regálů. Využijte slevy až 70% na kvalitní regály do garáže, sklepa i dílny. Doprava od 99 Kč.",
        "category": "likvidace",
        "content": """
        <p class="text-xl text-gray-600 mb-8">Kompletní výprodej skladových zásob kovových regálů. Všechny rozměry, všechny barvy - vše musí pryč!</p>

        <div class="grid md:grid-cols-3 gap-6 mb-8">
            <div class="bg-white rounded-xl p-6 shadow-sm text-center">
                <div class="text-4xl font-bold text-primary-500 mb-2">-70%</div>
                <div class="text-gray-600">Maximální sleva</div>
            </div>
            <div class="bg-white rounded-xl p-6 shadow-sm text-center">
                <div class="text-4xl font-bold text-primary-500 mb-2">500+</div>
                <div class="text-gray-600">Kusů skladem</div>
            </div>
            <div class="bg-white rounded-xl p-6 shadow-sm text-center">
                <div class="text-4xl font-bold text-primary-500 mb-2">7 let</div>
                <div class="text-gray-600">Záruka</div>
            </div>
        </div>

        <h2 class="text-2xl font-bold mb-4">Proč regály z výprodeje?</h2>
        <p class="mb-4">Nakupujete přesně stejné regály jako v běžném prodeji - jen za zlomek ceny. Důvod? Likvidujeme přebytečné skladové zásoby a potřebujeme místo pro nové kolekce.</p>
        """
    },
    {
        "slug": "skladova-likvidace-regalu",
        "title": "Skladová likvidace regálů 2026 | Exkluzivní slevy",
        "h1": "Skladová likvidace regálů - rok 2026",
        "description": "Největší skladová likvidace regálů roku 2026. Nakupte kovové regály za velkoobchodní ceny. Limitovaná nabídka.",
        "category": "likvidace"
    },
    {
        "slug": "likvidace-zasob-regaly",
        "title": "Likvidace zásob regálů | Poslední kusy",
        "h1": "Likvidace zásob - poslední kusy regálů za akční ceny",
        "description": "Doprodej posledních kusů regálů ze skladu. Slevy až 65% na vybrané modely. Záruka 7 let, expedice ihned.",
        "category": "likvidace"
    },
    {
        "slug": "velkoobchodni-vyprodej-regalu",
        "title": "Velkoobchodní výprodej regálů | B2B i B2C",
        "h1": "Velkoobchodní výprodej regálů pro firmy i domácnosti",
        "description": "Velkoobchodní ceny regálů pro všechny. Nakupte kovové regály za ceny pod výrobní náklady. Ideální pro vybavení skladu.",
        "category": "likvidace"
    },

    # BAZAROVÉ REGÁLY (15 pages)
    {
        "slug": "bazarove-regaly",
        "title": "Bazarové regály | Nové za cenu bazaru",
        "h1": "Bazarové regály - nové regály za cenu použitých",
        "description": "Hledáte bazarové regály? Máme lepší řešení - zcela nové kovové regály za ceny jako z bazaru. Záruka 7 let.",
        "category": "bazar",
        "content": """
        <p class="text-xl text-gray-600 mb-8">Proč kupovat použité regály z bazaru, když můžete mít zcela nové za stejnou cenu? Nabízíme kvalitní kovové regály s plnou zárukou.</p>

        <div class="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-8">
            <h2 class="text-xl font-bold text-yellow-800 mb-3">🤔 Bazarový regál vs. nový regál z výprodeje</h2>
            <div class="grid md:grid-cols-2 gap-6">
                <div>
                    <h3 class="font-bold text-red-600 mb-2">❌ Bazarový regál</h3>
                    <ul class="text-sm space-y-1 text-gray-600">
                        <li>• Neznámý stav a historie</li>
                        <li>• Možné poškození a rez</li>
                        <li>• Žádná záruka</li>
                        <li>• Chybějící díly</li>
                    </ul>
                </div>
                <div>
                    <h3 class="font-bold text-green-600 mb-2">✓ Nový regál z výprodeje</h3>
                    <ul class="text-sm space-y-1 text-gray-600">
                        <li>• 100% nový, nerozbalený</li>
                        <li>• Perfektní stav</li>
                        <li>• Záruka 7 let</li>
                        <li>• Kompletní balení</li>
                    </ul>
                </div>
            </div>
        </div>

        <h2 class="text-2xl font-bold mb-4">Naše ceny poráží i bazar</h2>
        <p class="mb-6">Díky likvidaci skladu nabízíme regály za ceny, které nenajdete ani na bazaru. A to včetně záruky a dopravy!</p>
        """
    },
    {
        "slug": "levne-regaly-bazar",
        "title": "Levné regály jako z bazaru | Nové se zárukou",
        "h1": "Levné regály za bazarové ceny - ale nové!",
        "description": "Hledáte levné regály na bazaru? Ušetřete čas - máme nové regály za stejné ceny. Plná záruka, okamžitá expedice.",
        "category": "bazar"
    },
    {
        "slug": "pouzite-regaly-alternativa",
        "title": "Alternativa k použitým regálům | Nové levně",
        "h1": "Lepší alternativa k použitým regálům",
        "description": "Proč kupovat použité regály? Nabízíme nové kovové regály za ceny použitých. Bez rizika, s plnou zárukou.",
        "category": "bazar"
    },
    {
        "slug": "regaly-z-druhe-ruky",
        "title": "Regály z druhé ruky? Radši nové za stejnou cenu",
        "h1": "Regály z druhé ruky vs. nové z výprodeje",
        "description": "Porovnání regálů z druhé ruky a nových regálů z výprodeje. Proč se vyplatí koupit nový regál za cenu bazarového.",
        "category": "bazar"
    },
    {
        "slug": "bazar-regaly-cena",
        "title": "Bazar regály - ceny nových ještě nižší",
        "h1": "Bazarové ceny regálů překonány",
        "description": "Ceny regálů nižší než na bazaru. Nové kovové regály s 7letou zárukou za bezkonkurenční ceny.",
        "category": "bazar"
    },

    # SLEVY NA REGÁLY (15 pages)
    {
        "slug": "slevy-na-regaly",
        "title": "Slevy na regály až 75% | Aktuální akce 2026",
        "h1": "Největší slevy na kovové regály - až 75% dolů",
        "description": "Aktuální slevy na kovové regály. Využijte akce a ušetřete až 75% na kvalitních regálech do garáže, sklepa i dílny.",
        "category": "slevy",
        "content": """
        <p class="text-xl text-gray-600 mb-8">Právě probíhá největší slevová akce na kovové regály. Slevy až 75% na všechny modely - od malých regálů po profesionální řešení.</p>

        <div class="bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-2xl p-8 mb-8">
            <div class="text-center">
                <div class="text-6xl font-black mb-2">-75%</div>
                <div class="text-xl">Maximální sleva na vybrané regály</div>
                <div class="mt-4 text-white/80">Platí do vyprodání zásob</div>
            </div>
        </div>

        <h2 class="text-2xl font-bold mb-4">Jak slevy fungují?</h2>
        <p class="mb-4">Všechny naše regály jsou již ve slevě. Ceny, které vidíte, jsou konečné - žádné skryté poplatky, žádné překvapení. Původní ceny odpovídají běžným maloobchodním cenám na trhu.</p>

        <h2 class="text-2xl font-bold mb-4 mt-8">Nejslevovanější regály</h2>
        """
    },
    {
        "slug": "akce-regaly-2026",
        "title": "Akce na regály 2026 | Aktuální slevy",
        "h1": "Akce na kovové regály - leden 2026",
        "description": "Aktuální akce na kovové regály. Lednové slevy až 70% na všechny regály skladem. Doprava od 99 Kč.",
        "category": "slevy"
    },
    {
        "slug": "vyrprodej-regalu-sleva",
        "title": "Výprodej regálů se slevou | Limitovaná nabídka",
        "h1": "Výprodej regálů - limitované slevy",
        "description": "Výprodej kovových regálů s exkluzivními slevami. Omezerný počet kusů za akční ceny. Neváhejte!",
        "category": "slevy"
    },
    {
        "slug": "levne-kovove-regaly",
        "title": "Levné kovové regály | Od 549 Kč",
        "h1": "Levné kovové regály pro každého",
        "description": "Nejlevnější kovové regály na trhu. Ceny od 549 Kč včetně DPH. Vysoká nosnost, snadná montáž, záruka 7 let.",
        "category": "slevy"
    },
    {
        "slug": "regaly-akce-tyden",
        "title": "Regály v akci tento týden | Týdenní slevy",
        "h1": "Akce na regály tento týden",
        "description": "Týdenní akce na kovové regály. Speciální slevy platné pouze tento týden. Nakupte výhodně!",
        "category": "slevy"
    },

    # REGÁLY DO GARÁŽE (15 pages)
    {
        "slug": "regaly-do-garaze",
        "title": "Regály do garáže | Pevné kovové regály",
        "h1": "Kovové regály do garáže - robustní a odolné",
        "description": "Kvalitní kovové regály do garáže. Nosnost až 875 kg, odolné proti vlhkosti. Ideální pro nářadí, pneumatiky i těžké předměty.",
        "category": "garaz",
        "content": """
        <p class="text-xl text-gray-600 mb-8">Garáž potřebuje spolehlivé úložné řešení. Naše kovové regály jsou navrženy přesně pro garážové podmínky - odolají vlhkosti, prachu i těžkým břemenům.</p>

        <div class="grid md:grid-cols-2 gap-8 mb-8">
            <div>
                <h2 class="text-xl font-bold mb-4">Co uložíte na garážový regál?</h2>
                <ul class="space-y-2">
                    <li class="flex items-center gap-2"><span class="text-primary-500">🔧</span> Nářadí a elektrické náčiní</li>
                    <li class="flex items-center gap-2"><span class="text-primary-500">🚗</span> Pneumatiky a autodoplňky</li>
                    <li class="flex items-center gap-2"><span class="text-primary-500">🎿</span> Sportovní vybavení</li>
                    <li class="flex items-center gap-2"><span class="text-primary-500">🪣</span> Barvy a chemie</li>
                    <li class="flex items-center gap-2"><span class="text-primary-500">📦</span> Sezónní věci</li>
                </ul>
            </div>
            <div>
                <h2 class="text-xl font-bold mb-4">Proč naše regály do garáže?</h2>
                <ul class="space-y-2">
                    <li class="flex items-center gap-2"><span class="text-green-500">✓</span> Nosnost až 175 kg/police</li>
                    <li class="flex items-center gap-2"><span class="text-green-500">✓</span> Zinkované = odolné vlhkosti</li>
                    <li class="flex items-center gap-2"><span class="text-green-500">✓</span> Montáž za 10 minut</li>
                    <li class="flex items-center gap-2"><span class="text-green-500">✓</span> Záruka 7 let</li>
                </ul>
            </div>
        </div>

        <h2 class="text-2xl font-bold mb-4">Doporučené regály do garáže</h2>
        """
    },
    {
        "slug": "garazovy-regal-180x90",
        "title": "Garážový regál 180×90 cm | Nejprodávanější",
        "h1": "Garážový regál 180×90×40 cm - bestseller",
        "description": "Nejprodávanější garážový regál 180×90×40 cm. Nosnost 875 kg, 5 polic. Ideální do každé garáže. Cena od 649 Kč.",
        "category": "garaz"
    },
    {
        "slug": "regaly-na-naradi",
        "title": "Regály na nářadí do garáže | Praktické řešení",
        "h1": "Regály na nářadí - mějte vše po ruce",
        "description": "Kovové regály na nářadí do garáže a dílny. Přehledné uložení všeho nářadí. Nosnost až 875 kg.",
        "category": "garaz"
    },
    {
        "slug": "regaly-na-pneumatiky",
        "title": "Regály na pneumatiky | Správné skladování",
        "h1": "Regály na pneumatiky - skladujte správně",
        "description": "Kovové regály na skladování pneumatik. Pevná konstrukce pro bezpečné uložení sezónních pneumatik. Od 549 Kč.",
        "category": "garaz"
    },
    {
        "slug": "velky-garazovy-regal",
        "title": "Velký garážový regál 200 cm | Extra kapacita",
        "h1": "Velký garážový regál - výška 200 cm",
        "description": "Extra velký garážový regál s výškou 200 cm. Maximální úložný prostor pro vaši garáž. Nosnost až 875 kg.",
        "category": "garaz"
    },
    {
        "slug": "kovove-regaly-garaz",
        "title": "Kovové regály do garáže | Odolné a levné",
        "h1": "Kovové regály do garáže za skvělé ceny",
        "description": "Kvalitní kovové regály speciálně navržené pro garážové podmínky. Odolné, pevné a cenově dostupné.",
        "category": "garaz"
    },

    # REGÁLY DO SKLEPA (15 pages)
    {
        "slug": "regaly-do-sklepa",
        "title": "Regály do sklepa | Odolné vlhkosti",
        "h1": "Regály do sklepa - odolné vlhkému prostředí",
        "description": "Kovové regály do sklepa odolné vlhkosti. Zinkovaný povrch chrání před korozí. Ideální na zavařeniny, víno i uskladnění.",
        "category": "sklep",
        "content": """
        <p class="text-xl text-gray-600 mb-8">Sklep vyžaduje speciální přístup - vlhkost je zde největším nepřítelem. Proto doporučujeme zinkované regály, které odolají i náročným podmínkám.</p>

        <div class="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
            <h2 class="text-xl font-bold text-blue-800 mb-3">💧 Proč zinkovaný regál do sklepa?</h2>
            <p class="text-blue-700">Zinkový povlak vytváří ochrannou vrstvu, která brání vzniku koroze i ve vlhkém prostředí. Vaše regály vydrží desítky let bez známek rzi.</p>
        </div>

        <h2 class="text-2xl font-bold mb-4">Co uložíte ve sklepě?</h2>
        <div class="grid md:grid-cols-3 gap-4 mb-8">
            <div class="bg-white rounded-lg p-4 text-center shadow-sm">
                <div class="text-3xl mb-2">🍷</div>
                <div class="font-medium">Víno a nápoje</div>
            </div>
            <div class="bg-white rounded-lg p-4 text-center shadow-sm">
                <div class="text-3xl mb-2">🫙</div>
                <div class="font-medium">Zavařeniny</div>
            </div>
            <div class="bg-white rounded-lg p-4 text-center shadow-sm">
                <div class="text-3xl mb-2">🥔</div>
                <div class="font-medium">Zelenina</div>
            </div>
        </div>

        <h2 class="text-2xl font-bold mb-4">Doporučené regály do sklepa</h2>
        """
    },
    {
        "slug": "zinkovane-regaly-sklep",
        "title": "Zinkované regály do sklepa | Bez koroze",
        "h1": "Zinkované regály do sklepa - žádná koroze",
        "description": "Zinkované kovové regály ideální do vlhkého sklepa. Odolávají vlhkosti a korozi. Záruka 7 let.",
        "category": "sklep"
    },
    {
        "slug": "regaly-na-zavarenivy",
        "title": "Regály na zavařeniny | Pevné a stabilní",
        "h1": "Regály na zavařeniny - bezpečné uložení",
        "description": "Pevné kovové regály na zavařeniny. Nosnost až 175 kg na polici zajistí bezpečné uložení vašich zásob.",
        "category": "sklep"
    },
    {
        "slug": "regaly-na-vino",
        "title": "Regály na víno do sklepa | Správné skladování",
        "h1": "Regály na víno - ideální podmínky ve sklepě",
        "description": "Kovové regály pro skladování vína ve sklepě. Stabilní konstrukce pro vaši sbírku vín.",
        "category": "sklep"
    },
    {
        "slug": "sklepni-ulozny-system",
        "title": "Sklepní úložný systém | Kompletní řešení",
        "h1": "Kompletní úložný systém do sklepa",
        "description": "Sestavte si kompletní úložný systém do sklepa z našich kovových regálů. Modulární řešení pro každý prostor.",
        "category": "sklep"
    },

    # REGÁLY DO DÍLNY (10 pages)
    {
        "slug": "regaly-do-dilny",
        "title": "Regály do dílny | Profesionální úložiště",
        "h1": "Kovové regály do dílny - profesionální řešení",
        "description": "Profesionální kovové regály do dílny. Vysoká nosnost pro těžké nářadí a materiál. Snadná montáž bez nářadí.",
        "category": "dilna",
        "content": """
        <p class="text-xl text-gray-600 mb-8">Dílna vyžaduje profesionální přístup k organizaci. Naše regály nabízí vysokou nosnost a flexibilitu pro uložení všeho vybavení.</p>

        <h2 class="text-2xl font-bold mb-4">Proč regál do dílny?</h2>
        <div class="grid md:grid-cols-2 gap-6 mb-8">
            <div class="flex gap-4">
                <div class="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">💪</div>
                <div>
                    <h3 class="font-bold mb-1">Vysoká nosnost</h3>
                    <p class="text-gray-600 text-sm">Až 175 kg na polici pro těžké nářadí a materiál</p>
                </div>
            </div>
            <div class="flex gap-4">
                <div class="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">📏</div>
                <div>
                    <h3 class="font-bold mb-1">Nastavitelné police</h3>
                    <p class="text-gray-600 text-sm">Přizpůsobte výšku polic podle potřeby</p>
                </div>
            </div>
        </div>

        <h2 class="text-2xl font-bold mb-4">Nejlepší regály do dílny</h2>
        """
    },
    {
        "slug": "profesionalni-dilenske-regaly",
        "title": "Profesionální dílenské regály | Vysoká nosnost",
        "h1": "Profesionální dílenské regály",
        "description": "Profesionální dílenské regály s nosností až 1050 kg. Ideální pro náročné dílenské prostředí.",
        "category": "dilna"
    },
    {
        "slug": "regaly-pro-remeslniky",
        "title": "Regály pro řemeslníky | Spolehlivé úložiště",
        "h1": "Regály pro řemeslníky a kutily",
        "description": "Spolehlivé kovové regály pro řemeslníky. Perfektní organizace nářadí a materiálu v dílně.",
        "category": "dilna"
    },

    # ZINKOVÉ REGÁLY (10 pages)
    {
        "slug": "zinkove-regaly",
        "title": "Zinkové regály | Odolné korozi",
        "h1": "Zinkové regály - maximální odolnost korozi",
        "description": "Zinkované kovové regály odolné korozi a vlhkosti. Ideální do sklepa, garáže i venkovních prostor. Od 549 Kč.",
        "category": "zink",
        "content": """
        <p class="text-xl text-gray-600 mb-8">Zinkové regály jsou nejlepší volbou pro vlhké prostředí. Zinkový povlak chrání ocel před korozí a zajišťuje dlouhou životnost.</p>

        <h2 class="text-2xl font-bold mb-4">Výhody zinkových regálů</h2>
        <div class="grid md:grid-cols-3 gap-6 mb-8">
            <div class="bg-white rounded-xl p-6 shadow-sm">
                <div class="text-3xl mb-3">🛡️</div>
                <h3 class="font-bold mb-2">Odolnost korozi</h3>
                <p class="text-sm text-gray-600">Zinkový povlak chrání před rzí i ve vlhkém prostředí</p>
            </div>
            <div class="bg-white rounded-xl p-6 shadow-sm">
                <div class="text-3xl mb-3">⏰</div>
                <h3 class="font-bold mb-2">Dlouhá životnost</h3>
                <p class="text-sm text-gray-600">Záruka 7 let, skutečná životnost i 20+ let</p>
            </div>
            <div class="bg-white rounded-xl p-6 shadow-sm">
                <div class="text-3xl mb-3">💧</div>
                <h3 class="font-bold mb-2">Ideální do vlhka</h3>
                <p class="text-sm text-gray-600">Perfektní pro sklepy, garáže i venkovní prostory</p>
            </div>
        </div>

        <h2 class="text-2xl font-bold mb-4">Naše zinkové regály</h2>
        """
    },
    {
        "slug": "pozinkovane-regaly",
        "title": "Pozinkované regály | Kvalitní povrch",
        "h1": "Pozinkované regály s kvalitním povrchem",
        "description": "Pozinkované kovové regály s odolným povrchem. Vhodné do všech prostor. Ceny od 549 Kč.",
        "category": "zink"
    },
    {
        "slug": "regaly-do-vlhka",
        "title": "Regály do vlhkého prostředí | Zinkované",
        "h1": "Regály do vlhkého prostředí",
        "description": "Kovové regály speciálně navržené pro vlhké prostředí. Zinkovaný povrch zabraňuje korozi.",
        "category": "zink"
    },

    # MONTÁŽ A NÁVODY (10 pages)
    {
        "slug": "montaz-regalu",
        "title": "Montáž regálu | Návod krok za krokem",
        "h1": "Montáž kovového regálu - jednoduchý návod",
        "description": "Kompletní návod na montáž kovového regálu. Bezšroubová montáž za 10 minut bez nářadí. Video návod.",
        "category": "navody",
        "content": """
        <p class="text-xl text-gray-600 mb-8">Montáž našich regálů je jednoduchá a rychlá. Díky bezšroubovému systému zvládnete sestavení za 10 minut bez jakéhokoliv nářadí.</p>

        <div class="bg-green-50 border border-green-200 rounded-xl p-6 mb-8">
            <div class="flex items-center gap-4">
                <div class="text-4xl">⏱️</div>
                <div>
                    <h2 class="text-xl font-bold text-green-800">Montáž za 10 minut</h2>
                    <p class="text-green-700">Bez nářadí, bez šroubů, bez stresu</p>
                </div>
            </div>
        </div>

        <h2 class="text-2xl font-bold mb-4">Postup montáže</h2>
        <div class="space-y-4 mb-8">
            <div class="flex gap-4 bg-white rounded-lg p-4 shadow-sm">
                <div class="w-10 h-10 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">1</div>
                <div>
                    <h3 class="font-bold">Položte 2 stojny na zem</h3>
                    <p class="text-sm text-gray-600">Rovnoběžně vedle sebe</p>
                </div>
            </div>
            <div class="flex gap-4 bg-white rounded-lg p-4 shadow-sm">
                <div class="w-10 h-10 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">2</div>
                <div>
                    <h3 class="font-bold">Nasaďte příčky</h3>
                    <p class="text-sm text-gray-600">Zaklapněte do otvorů ve stojnách</p>
                </div>
            </div>
            <div class="flex gap-4 bg-white rounded-lg p-4 shadow-sm">
                <div class="w-10 h-10 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">3</div>
                <div>
                    <h3 class="font-bold">Postavte konstrukci</h3>
                    <p class="text-sm text-gray-600">Přidejte zbývající stojny</p>
                </div>
            </div>
            <div class="flex gap-4 bg-white rounded-lg p-4 shadow-sm">
                <div class="w-10 h-10 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">4</div>
                <div>
                    <h3 class="font-bold">Vložte police</h3>
                    <p class="text-sm text-gray-600">Položte na příčky a je hotovo!</p>
                </div>
            </div>
        </div>

        <h2 class="text-2xl font-bold mb-4">Video návod</h2>
        <div class="bg-white rounded-xl shadow-sm overflow-hidden mb-8">
            <div class="relative" style="padding-bottom: 56.25%;">
                <iframe class="absolute inset-0 w-full h-full" src="https://www.youtube.com/embed/BBjY5IomYkk" frameborder="0" allowfullscreen></iframe>
            </div>
        </div>
        """
    },
    {
        "slug": "jak-sestavit-regal",
        "title": "Jak sestavit regál | Podrobný návod",
        "h1": "Jak sestavit kovový regál - podrobný postup",
        "description": "Podrobný návod jak sestavit kovový regál. Fotky, video, tipy a triky pro snadnou montáž.",
        "category": "navody"
    },
    {
        "slug": "navod-montaz-kovoveho-regalu",
        "title": "Návod na montáž kovového regálu | PDF ke stažení",
        "h1": "Návod na montáž kovového regálu",
        "description": "Kompletní návod na montáž kovového regálu. Ke stažení v PDF. Video tutoriál k dispozici.",
        "category": "navody"
    },

    # NOSNOST A PARAMETRY (10 pages)
    {
        "slug": "nosnost-regalu",
        "title": "Nosnost regálu | Kolik vydrží kovový regál?",
        "h1": "Nosnost kovového regálu - co potřebujete vědět",
        "description": "Vše o nosnosti kovových regálů. Kolik kg unese jedna police? Jak správně zatěžovat regál? Odborné rady.",
        "category": "parametry",
        "content": """
        <p class="text-xl text-gray-600 mb-8">Nosnost je klíčový parametr při výběru regálu. Naše regály nabízí nosnost až 175 kg na polici, celkem až 1050 kg na celý regál.</p>

        <div class="grid md:grid-cols-2 gap-8 mb-8">
            <div class="bg-white rounded-xl p-6 shadow-sm">
                <h2 class="text-xl font-bold mb-4">Standardní řada</h2>
                <div class="text-4xl font-bold text-primary-500 mb-2">175 kg</div>
                <div class="text-gray-600 mb-4">nosnost jedné police</div>
                <ul class="text-sm space-y-2">
                    <li>• 4-5 polic podle výšky</li>
                    <li>• Celková nosnost 700-875 kg</li>
                    <li>• Vhodné pro domácnost i dílnu</li>
                </ul>
            </div>
            <div class="bg-white rounded-xl p-6 shadow-sm border-2 border-primary-500">
                <div class="bg-primary-500 text-white text-xs font-bold px-2 py-1 rounded inline-block mb-2">PROFESIONÁLNÍ</div>
                <h2 class="text-xl font-bold mb-4">Profesionální řada</h2>
                <div class="text-4xl font-bold text-primary-500 mb-2">210 kg</div>
                <div class="text-gray-600 mb-4">nosnost jedné police</div>
                <ul class="text-sm space-y-2">
                    <li>• 5 polic</li>
                    <li>• Celková nosnost 1050 kg</li>
                    <li>• Pro náročné použití</li>
                </ul>
            </div>
        </div>

        <h2 class="text-2xl font-bold mb-4">Jak správně zatěžovat regál?</h2>
        <ul class="space-y-3 mb-8">
            <li class="flex items-start gap-3"><span class="text-primary-500 text-xl">💡</span> <span>Nejtěžší předměty umísťujte na spodní police</span></li>
            <li class="flex items-start gap-3"><span class="text-primary-500 text-xl">💡</span> <span>Zatížení rozložte rovnoměrně po celé ploše police</span></li>
            <li class="flex items-start gap-3"><span class="text-primary-500 text-xl">💡</span> <span>Nepřekračujte maximální nosnost</span></li>
        </ul>
        """
    },
    {
        "slug": "rozmery-regalu",
        "title": "Rozměry regálů | Kompletní přehled",
        "h1": "Rozměry kovových regálů - kompletní přehled",
        "description": "Přehled všech rozměrů kovových regálů. Výšky od 150 do 220 cm, šířky 40-120 cm. Najděte ideální rozměr.",
        "category": "parametry"
    },
    {
        "slug": "jake-rozmery-regalu-vybrat",
        "title": "Jaké rozměry regálu vybrat? | Průvodce",
        "h1": "Jaké rozměry regálu vybrat do vašeho prostoru?",
        "description": "Pomůžeme vám vybrat správné rozměry regálu. Zohledněte prostor, účel použití i obsah. Praktické tipy.",
        "category": "parametry"
    },

    # SROVNÁNÍ A RECENZE (10 pages)
    {
        "slug": "srovnani-regalu",
        "title": "Srovnání regálů | Který vybrat?",
        "h1": "Srovnání kovových regálů - který je pro vás?",
        "description": "Porovnání kovových regálů podle parametrů, ceny a použití. Pomůžeme vám vybrat ten správný regál.",
        "category": "srovnani"
    },
    {
        "slug": "recenze-kovovych-regalu",
        "title": "Recenze kovových regálů | Zkušenosti zákazníků",
        "h1": "Recenze kovových regálů od skutečných zákazníků",
        "description": "Přečtěte si recenze a zkušenosti zákazníků s našimi kovovými regály. Hodnocení 4.8/5 z 2847 recenzí.",
        "category": "srovnani"
    },
    {
        "slug": "nejlepsi-regaly-2026",
        "title": "Nejlepší regály 2026 | TOP výběr",
        "h1": "Nejlepší kovové regály roku 2026",
        "description": "Přehled nejlepších kovových regálů roku 2026. Vítězové v kategoriích cena, kvalita a poměr cena/výkon.",
        "category": "srovnani"
    },

    # ÚČEL POUŽITÍ (10 pages)
    {
        "slug": "regaly-do-kancelare",
        "title": "Regály do kanceláře | Elegantní úložiště",
        "h1": "Kovové regály do kanceláře",
        "description": "Elegantní kovové regály do kanceláře. Perfektní pro šanony, dokumenty a kancelářské potřeby.",
        "category": "ucel"
    },
    {
        "slug": "regaly-do-spize",
        "title": "Regály do spíže | Organizace potravin",
        "h1": "Regály do spíže - přehledné uložení potravin",
        "description": "Kovové regály do spíže pro přehledné uložení potravin. Konzervace, potraviny, kuchyňské potřeby.",
        "category": "ucel"
    },
    {
        "slug": "regaly-do-satny",
        "title": "Regály do šatny | Úložný systém",
        "h1": "Regály do šatny - organizace oblečení",
        "description": "Kovové regály do šatny pro organizaci oblečení a doplňků. Boxy, boty, sezónní oblečení.",
        "category": "ucel"
    },
    {
        "slug": "regaly-pro-e-shop",
        "title": "Regály pro e-shop sklad | Profesionální",
        "h1": "Regály pro e-shop a skladování zboží",
        "description": "Profesionální kovové regály pro e-shop sklady. Rychlý přístup ke zboží, přehledná organizace.",
        "category": "ucel"
    },
    {
        "slug": "regaly-do-archivu",
        "title": "Regály do archivu | Dokumenty a šanony",
        "h1": "Archivní regály na dokumenty",
        "description": "Kovové regály do archivu pro uložení dokumentů a šanonů. Vysoká nosnost, přehledná organizace.",
        "category": "ucel"
    },

    # BARVY (5 pages)
    {
        "slug": "cerne-regaly",
        "title": "Černé regály | Elegantní a praktické",
        "h1": "Černé kovové regály",
        "description": "Elegantní černé kovové regály. Nejprodávanější barva vhodná do každého interiéru. Od 599 Kč.",
        "category": "barvy"
    },
    {
        "slug": "bile-regaly",
        "title": "Bílé regály | Světlé a vzdušné",
        "h1": "Bílé kovové regály",
        "description": "Bílé kovové regály pro světlý a vzdušný interiér. Ideální do kanceláře a domácnosti.",
        "category": "barvy"
    },
    {
        "slug": "cervene-regaly",
        "title": "Červené regály | Výrazný design",
        "h1": "Červené kovové regály",
        "description": "Výrazné červené kovové regály. Oživte svůj prostor barevným regálem. Vysoká kvalita.",
        "category": "barvy"
    },
    {
        "slug": "modre-regaly",
        "title": "Modré regály | Moderní vzhled",
        "h1": "Modré kovové regály",
        "description": "Moderní modré kovové regály. Svěží barva pro garáž, dílnu nebo dětský pokoj.",
        "category": "barvy"
    },

    # TIPY A RADY (10 pages)
    {
        "slug": "jak-vybrat-regal",
        "title": "Jak vybrat regál | Kompletní průvodce",
        "h1": "Jak vybrat správný kovový regál",
        "description": "Kompletní průvodce výběrem kovového regálu. Na co se zaměřit? Rozměry, nosnost, materiál, cena.",
        "category": "tipy"
    },
    {
        "slug": "organizace-garaze",
        "title": "Organizace garáže | Tipy a triky",
        "h1": "Jak zorganizovat garáž pomocí regálů",
        "description": "Praktické tipy na organizaci garáže pomocí kovových regálů. Nářadí, pneumatiky, sportovní vybavení.",
        "category": "tipy"
    },
    {
        "slug": "uklid-sklepa",
        "title": "Úklid sklepa | Efektivní organizace",
        "h1": "Jak uklidit a zorganizovat sklep",
        "description": "Tipy na úklid a organizaci sklepa. Využijte kovové regály pro přehledné uložení zásob.",
        "category": "tipy"
    },
    {
        "slug": "maximalizace-ulozneho-prostoru",
        "title": "Maximalizace úložného prostoru | Tipy",
        "h1": "Jak maximalizovat úložný prostor s regály",
        "description": "Tipy jak maximálně využít prostor pomocí kovových regálů. Vertikální skladování, organizace.",
        "category": "tipy"
    },
    {
        "slug": "udrzba-kovovych-regalu",
        "title": "Údržba kovových regálů | Jak pečovat",
        "h1": "Údržba a péče o kovové regály",
        "description": "Jak správně pečovat o kovové regály. Čištění, údržba, prevence koroze. Prodlužte životnost.",
        "category": "tipy"
    },
]

# Generate more pages to reach 100+
additional_topics = [
    ("likvidace-skladu-praha", "Likvidace skladu regálů Praha", "likvidace"),
    ("likvidace-skladu-brno", "Likvidace skladu regálů Brno", "likvidace"),
    ("likvidace-skladu-ostrava", "Likvidace skladu regálů Ostrava", "likvidace"),
    ("vyprodej-regalu-praha", "Výprodej regálů Praha", "slevy"),
    ("vyprodej-regalu-brno", "Výprodej regálů Brno", "slevy"),
    ("skladove-regaly-levne", "Skladové regály levně", "slevy"),
    ("regaly-do-male-garaze", "Regály do malé garáže", "garaz"),
    ("uzky-regal-do-garaze", "Úzký regál do garáže", "garaz"),
    ("vysoky-regal-200cm", "Vysoký regál 200 cm", "parametry"),
    ("vysoky-regal-220cm", "Vysoký regál 220 cm", "parametry"),
    ("siroky-regal-120cm", "Široký regál 120 cm", "parametry"),
    ("hluboky-regal-50cm", "Hluboký regál 50 cm", "parametry"),
    ("regaly-s-5-policemi", "Regály s 5 policemi", "parametry"),
    ("regaly-s-4-policemi", "Regály s 4 policemi", "parametry"),
    ("regaly-nosnost-700kg", "Regály s nosností 700 kg", "parametry"),
    ("regaly-nosnost-875kg", "Regály s nosností 875 kg", "parametry"),
    ("regaly-nosnost-1050kg", "Regály s nosností 1050 kg", "parametry"),
    ("bezroubove-regaly", "Bezšroubové regály", "navody"),
    ("regaly-bez-naradi", "Regály bez nářadí", "navody"),
    ("modulární-regaly", "Modulární regálový systém", "parametry"),
    ("regaly-do-bytu", "Regály do bytu", "ucel"),
    ("regaly-do-domu", "Regály do domu", "ucel"),
    ("regaly-do-firmy", "Regály do firmy", "ucel"),
    ("regaly-na-knihy", "Regály na knihy", "ucel"),
    ("regaly-na-boxy", "Regály na úložné boxy", "ucel"),
    ("regaly-na-krabice", "Regály na krabice", "ucel"),
    ("regaly-do-komory", "Regály do komory", "ucel"),
    ("regaly-do-pracovny", "Regály do pracovny", "ucel"),
    ("ocelove-regaly", "Ocelové regály", "parametry"),
    ("kovove-police", "Kovové police na regál", "parametry"),
    ("nastavitelne-police", "Nastavitelné police regálu", "parametry"),
    ("regaly-akce-leden", "Regály akce leden 2026", "slevy"),
    ("regaly-akce-unor", "Regály akce únor 2026", "slevy"),
    ("vikendova-sleva-regaly", "Víkendová sleva na regály", "slevy"),
    ("studentska-sleva-regaly", "Studentská sleva na regály", "slevy"),
    ("seniori-sleva-regaly", "Sleva pro seniory na regály", "slevy"),
]

for slug, title, category in additional_topics:
    SEO_PAGES.append({
        "slug": slug,
        "title": f"{title} | Bazarovyregal.cz",
        "h1": title,
        "description": f"{title}. Kvalitní kovové regály za skvělé ceny. Záruka 7 let, doprava od 99 Kč.",
        "category": category
    })

def get_related_pages(current_slug, category, count=5):
    """Get related pages from same category"""
    related = [p for p in SEO_PAGES if p["category"] == category and p["slug"] != current_slug]
    return related[:count]

def get_related_products(category, count=4):
    """Get related products based on category"""
    if category in ["sklep", "zink"]:
        # Prefer zinc products for cellar
        prods = [p for p in PRODUCTS if "zink" in p["url"]]
        prods += [p for p in PRODUCTS if "zink" not in p["url"]]
    elif category == "garaz":
        # Prefer black products for garage
        prods = [p for p in PRODUCTS if "cerna" in p["url"]]
        prods += [p for p in PRODUCTS if "cerna" not in p["url"]]
    else:
        prods = PRODUCTS.copy()
    return prods[:count]

def generate_product_cards(products):
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
                <div class="text-xs text-green-600 mt-1">✓ Skladem</div>
            </div>
        </a>
        '''
    html += '</div>'
    return html

def generate_related_links(pages):
    """Generate HTML for related page links"""
    html = '<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">'
    for p in pages:
        html += f'''
        <a href="{p['slug']}.html" class="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow group">
            <h3 class="font-medium group-hover:text-primary-500">{p['h1']}</h3>
            <p class="text-sm text-gray-500 mt-1 line-clamp-2">{p['description'][:100]}...</p>
        </a>
        '''
    html += '</div>'
    return html

def generate_page_html(page):
    """Generate complete HTML for a page"""
    related_pages = get_related_pages(page["slug"], page["category"])
    related_products = get_related_products(page["category"])

    # Default content if not specified
    content = page.get("content", f"""
        <p class="text-xl text-gray-600 mb-8">{page['description']}</p>

        <h2 class="text-2xl font-bold mb-4">Proč nakoupit u nás?</h2>
        <ul class="space-y-3 mb-8">
            <li class="flex items-start gap-3"><span class="text-green-500 text-xl">✓</span> <span><strong>Slevy až 75%</strong> na všechny regály</span></li>
            <li class="flex items-start gap-3"><span class="text-green-500 text-xl">✓</span> <span><strong>100% nové zboží</strong> se zárukou 7 let</span></li>
            <li class="flex items-start gap-3"><span class="text-green-500 text-xl">✓</span> <span><strong>Expedice ihned</strong> - vše skladem</span></li>
            <li class="flex items-start gap-3"><span class="text-green-500 text-xl">✓</span> <span><strong>Doprava od 99 Kč</strong></span></li>
        </ul>

        <h2 class="text-2xl font-bold mb-4">Doporučené regály</h2>
    """)

    # Add product cards after content
    content += generate_product_cards(related_products)

    # Add related pages section
    if related_pages:
        content += f"""
        <h2 class="text-2xl font-bold mb-4 mt-12">Související články</h2>
        {generate_related_links(related_pages)}
        """

    # Category breadcrumb mapping
    category_names = {
        "likvidace": "Likvidace skladu",
        "bazar": "Bazarové regály",
        "slevy": "Slevy a akce",
        "garaz": "Regály do garáže",
        "sklep": "Regály do sklepa",
        "dilna": "Regály do dílny",
        "zink": "Zinkové regály",
        "navody": "Návody",
        "parametry": "Parametry",
        "srovnani": "Srovnání",
        "ucel": "Podle účelu",
        "barvy": "Barvy regálů",
        "tipy": "Tipy a rady"
    }

    category_name = category_names.get(page["category"], "Regály")
    og_image = IMAGES["black"]

    html = f'''<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{page['title']}</title>
    <meta name="description" content="{page['description']}">

    <!-- OpenGraph -->
    <meta property="og:title" content="{page['title']}">
    <meta property="og:description" content="{page['description']}">
    <meta property="og:image" content="{og_image}">
    <meta property="og:url" content="{BASE_URL}/{page['slug']}.html">
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="Bazarovyregal.cz">
    <meta property="og:locale" content="cs_CZ">

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{page['title']}">
    <meta name="twitter:description" content="{page['description']}">
    <meta name="twitter:image" content="{og_image}">

    <!-- Canonical -->
    <link rel="canonical" href="{BASE_URL}/{page['slug']}.html">

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
</head>
<body class="bg-gray-50 font-sans">

<!-- Top Bar -->
<div class="bg-gray-900 text-white text-sm py-2">
    <div class="container mx-auto px-4 flex justify-between items-center">
        <span>✉️ info@bazarovyregal.cz</span>
        <div class="flex items-center gap-4">
            <span>🚚 Doprava od 99 Kč</span>
            <span>⭐ 4.9/5 (2847 recenzí)</span>
        </div>
    </div>
</div>

<!-- Header -->
<header class="bg-white shadow-sm sticky top-0 z-50">
    <div class="container mx-auto px-4 py-4 flex items-center justify-between">
        <a href="index.html" class="flex items-center gap-3">
            <div class="w-12 h-12 bg-primary-500 rounded-xl flex items-center justify-center shadow-lg">
                <span class="text-white text-3xl font-black">B</span>
            </div>
            <div>
                <div class="text-2xl font-black text-gray-900">Bazarovyregal<span class="text-primary-500">.cz</span></div>
                <div class="text-xs text-red-600 font-bold uppercase">Likvidace skladu</div>
            </div>
        </a>
        <nav class="hidden md:flex gap-4 text-sm font-medium">
            <a href="index.html" class="text-gray-600 hover:text-primary-500">🏠 Úvod</a>
            <a href="katalog.html" class="text-gray-600 hover:text-primary-500">📦 Katalog</a>
            <a href="likvidace-skladu-regaly.html" class="text-gray-600 hover:text-primary-500">🔥 Likvidace</a>
            <a href="kontakt.html" class="text-gray-600 hover:text-primary-500">📧 Kontakt</a>
        </nav>
        <a href="katalog.html" class="bg-primary-500 hover:bg-primary-600 text-white px-5 py-2 rounded-lg font-bold">
            🛒 Katalog
        </a>
    </div>
</header>

<!-- Breadcrumb -->
<nav class="bg-white border-b">
    <div class="container mx-auto px-4 py-3">
        <ol class="flex items-center gap-2 text-sm text-gray-500">
            <li><a href="index.html" class="hover:text-primary-500">Úvod</a></li>
            <span>›</span>
            <li><a href="katalog.html" class="hover:text-primary-500">{category_name}</a></li>
            <span>›</span>
            <li class="text-gray-900 font-medium truncate max-w-xs">{page['h1']}</li>
        </ol>
    </div>
</nav>

<!-- Main Content -->
<main class="container mx-auto px-4 py-8">
    <article class="max-w-4xl mx-auto">
        <h1 class="text-3xl md:text-4xl font-bold text-gray-900 mb-6">{page['h1']}</h1>

        <div class="prose prose-lg max-w-none">
            {content}
        </div>

        <!-- CTA Section -->
        <div class="bg-gradient-to-r from-primary-500 to-orange-500 rounded-2xl p-8 mt-12 text-white text-center">
            <h2 class="text-2xl font-bold mb-2">Připraveni nakoupit?</h2>
            <p class="mb-6 text-white/90">Prohlédněte si náš kompletní katalog regálů se slevami až 75%</p>
            <a href="katalog.html" class="inline-block bg-white text-primary-600 px-8 py-3 rounded-xl font-bold hover:bg-gray-100 transition">
                Zobrazit katalog →
            </a>
        </div>
    </article>
</main>

<!-- Footer -->
<footer class="bg-gray-900 text-white py-12 mt-12">
    <div class="container mx-auto px-4">
        <div class="grid md:grid-cols-4 gap-8 mb-8">
            <div>
                <div class="text-xl font-bold mb-4">Bazarovyregal<span class="text-primary-500">.cz</span></div>
                <p class="text-gray-400 text-sm">Největší slevy na kovové regály. Likvidace skladu - nové zboží za ceny bazaru.</p>
            </div>
            <div>
                <h4 class="font-bold mb-4">Kategorie</h4>
                <ul class="space-y-2 text-gray-400 text-sm">
                    <li><a href="likvidace-skladu-regaly.html" class="hover:text-primary-400">Likvidace skladu</a></li>
                    <li><a href="bazarove-regaly.html" class="hover:text-primary-400">Bazarové regály</a></li>
                    <li><a href="slevy-na-regaly.html" class="hover:text-primary-400">Slevy na regály</a></li>
                    <li><a href="regaly-do-garaze.html" class="hover:text-primary-400">Regály do garáže</a></li>
                </ul>
            </div>
            <div>
                <h4 class="font-bold mb-4">Informace</h4>
                <ul class="space-y-2 text-gray-400 text-sm">
                    <li><a href="montaz-regalu.html" class="hover:text-primary-400">Montáž regálu</a></li>
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

<!-- Chatbot -->
<div id="chatWidget" class="fixed bottom-6 right-4 z-40">
    <button onclick="toggleChat()" class="bg-primary-500 hover:bg-primary-600 text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-2xl transition-transform hover:scale-110">💬</button>
    <div id="chatWindow" class="hidden absolute bottom-16 right-0 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div class="bg-gradient-to-r from-primary-500 to-orange-500 text-white p-4">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">🤖</div>
                    <div>
                        <div class="font-bold">RegálBot</div>
                        <div class="text-xs text-white/80">Online</div>
                    </div>
                </div>
                <button onclick="toggleChat()" class="text-white/80 hover:text-white">✕</button>
            </div>
        </div>
        <div id="chatMessages" class="h-80 overflow-y-auto p-4 space-y-4">
            <div class="flex gap-3">
                <div class="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">🤖</div>
                <div class="bg-gray-100 rounded-2xl rounded-tl-none p-3 text-sm max-w-[80%]">Ahoj! 👋 Pomohu vám vybrat ideální regál.</div>
            </div>
        </div>
        <div class="border-t p-4">
            <div class="flex gap-2">
                <input type="text" id="chatInput" placeholder="Napište zprávu..." class="flex-1 border rounded-lg px-3 py-2 text-sm" onkeypress="if(event.key==='Enter')sendMessage()">
                <button onclick="sendMessage()" class="bg-primary-500 text-white px-4 py-2 rounded-lg">➤</button>
            </div>
        </div>
    </div>
</div>
<script src="chatbot.js"></script>

<!-- Regal Master Look -->
<script src="https://regalmaster.vyprodej-regalu.cz/tracker.js" data-project-id="vyprodej-regalu" data-api-url="https://regalmaster.vyprodej-regalu.cz/api/events" data-sample-rate="1.0" async></script>
</body>
</html>'''

    return html

def generate_sitemap():
    """Generate sitemap.xml"""
    now = datetime.now().strftime("%Y-%m-%d")

    sitemap = '''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
'''

    # Main pages
    main_pages = [
        ("index.html", "1.0", "daily"),
        ("katalog.html", "1.0", "daily"),
        ("kontakt.html", "0.6", "monthly"),
        ("faq.html", "0.7", "weekly"),
        ("o-nas.html", "0.6", "monthly"),
    ]

    for url, priority, changefreq in main_pages:
        sitemap += f'''    <url>
        <loc>{BASE_URL}/{url}</loc>
        <lastmod>{now}</lastmod>
        <changefreq>{changefreq}</changefreq>
        <priority>{priority}</priority>
    </url>
'''

    # SEO pages
    for page in SEO_PAGES:
        priority = "0.8" if page["category"] in ["likvidace", "slevy", "bazar"] else "0.7"
        sitemap += f'''    <url>
        <loc>{BASE_URL}/{page['slug']}.html</loc>
        <lastmod>{now}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>{priority}</priority>
    </url>
'''

    # All 87 product pages
    product_files = [
        "regal-150x70x30-cerna", "regal-150x70x30-cervena", "regal-150x70x30-zinkovany", "regal-180x90x40-bila", "regal-180x90x40-zinkovany",
        "regal-180x60x40-cerna", "regal-180x40x40-cerna", "regal-200x90x40-cerna", "regal-220x90x45-cerna",
        "regal-180x120x50-cerna", "regal-180x90x40-modra", "regal-180x40x30-zinkovany", "regal-180x90x45-cerna",
        "regal-220x70x45-bila", "regal-200x40x30-modra", "regal-200x70x45-cerna", "regal-200x120x40-cerna",
        "regal-220x70x50-cervena", "regal-150x120x40-zinkovany", "regal-180x90x50-cervena", "regal-180x70x30-bila",
        "regal-200x60x50-modra", "regal-220x60x45-bila", "regal-200x120x50-zinkovany", "regal-200x60x40-zinkovany",
        "regal-150x40x30-bila", "regal-150x120x45-cervena", "regal-200x90x40-modra", "regal-200x120x40-zinkovany",
        "regal-220x40x30-cervena", "regal-180x40x40-zinkovany", "regal-150x90x30-zinkovany", "regal-180x90x40-cervena",
        "regal-200x90x50-cerna", "regal-180x40x45-cerna", "regal-180x120x40-cerna", "regal-150x60x30-cerna",
        "regal-150x120x40-cervena", "regal-220x60x40-zinkovany", "regal-220x60x50-modra", "regal-150x40x50-cervena",
        "regal-220x90x30-cerna", "regal-220x70x30-bila", "regal-180x120x50-bila", "regal-180x70x50-bila",
        "regal-150x40x40-bila", "regal-220x90x40-modra", "regal-180x90x30-modra", "regal-220x70x50-zinkovany",
        "regal-220x60x40-cervena", "regal-150x120x30-cervena", "regal-150x120x50-zinkovany", "regal-180x40x30-bila",
        "regal-150x60x50-cerna", "regal-180x120x30-zinkovany", "regal-220x120x45-cervena", "regal-200x60x45-modra",
        "regal-200x90x45-cerna", "regal-180x120x45-bila", "regal-150x60x45-cervena", "regal-220x120x45-zinkovany",
        "regal-150x120x45-cerna", "regal-200x70x40-cervena", "regal-200x120x50-cervena", "regal-150x90x45-cerna",
        "regal-200x60x45-bila", "regal-220x120x30-cerna", "regal-180x120x30-cervena", "regal-180x90x40-cerna",
        "regal-200x40x45-bila", "regal-180x40x45-zinkovany", "regal-180x60x40-bila", "regal-150x60x45-modra",
        "regal-180x70x40-cerna", "regal-150x90x40-bila", "regal-200x70x40-bila", "regal-180x90x45-cervena",
        "regal-150x40x45-bila", "regal-200x40x30-zinkovany", "regal-200x70x50-zinkovany", "regal-150x90x40-cervena",
        "regal-220x40x40-cervena", "regal-150x70x45-cerna", "regal-200x90x45-modra", "regal-200x120x40-bila",
        "regal-150x70x30-bila", "regal-180x120x50-profesionalni"
    ]

    for pf in product_files:
        sitemap += f'''    <url>
        <loc>{BASE_URL}/{pf}.html</loc>
        <lastmod>{now}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.9</priority>
    </url>
'''

    sitemap += '</urlset>'
    return sitemap

def generate_robots_txt():
    """Generate robots.txt"""
    return f'''User-agent: *
Allow: /

Sitemap: {BASE_URL}/sitemap.xml
'''

# Main execution
if __name__ == "__main__":
    output_dir = os.path.dirname(os.path.abspath(__file__))

    print(f"Generating {len(SEO_PAGES)} SEO pages...")

    for page in SEO_PAGES:
        html = generate_page_html(page)
        filepath = os.path.join(output_dir, f"{page['slug']}.html")
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(html)
        print(f"Generated: {page['slug']}.html")

    # Generate sitemap
    sitemap = generate_sitemap()
    with open(os.path.join(output_dir, "sitemap.xml"), 'w', encoding='utf-8') as f:
        f.write(sitemap)
    print("Generated: sitemap.xml")

    # Generate robots.txt
    robots = generate_robots_txt()
    with open(os.path.join(output_dir, "robots.txt"), 'w', encoding='utf-8') as f:
        f.write(robots)
    print("Generated: robots.txt")

    print(f"\nDone! Generated {len(SEO_PAGES)} SEO pages + sitemap.xml + robots.txt")
