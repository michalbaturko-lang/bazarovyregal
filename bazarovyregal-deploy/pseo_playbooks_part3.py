#!/usr/bin/env python3
"""pSEO Playbooks Part 3: Examples, Directory, Profiles"""

from pseo_config import PRODUCTS, HEIGHTS, WIDTHS, USE_CASES, EXISTING_PAGES
from pseo_html_template import get_product_cards


def _internal_links(exclude_slug, count=6):
    links = []
    for p in EXISTING_PAGES:
        if p["slug"] != exclude_slug and len(links) < count:
            links.append(f'<li><a href="{p["slug"]}.html" class="text-primary-600 hover:underline">{p["title"]}</a></li>')
    return '<ul class="grid sm:grid-cols-2 gap-2 mt-4 mb-8">' + "".join(links) + "</ul>"


def generate_example_pages():
    examples = [
        {"slug": "priklad-organizace-garaze-regaly", "title": "Příklad: Jak zorganizovat garáž s regály",
         "scenario": "Pan Novák měl garáž plnou nářadí, pneumatik a sportovního vybavení bez jakéhokoli systému.",
         "solution": "Pořídil 3 regály 180×90×40 cm (černé) a 1 zinkovaný regál na pneumatiky.",
         "steps": ["Vyčistil garáž a roztřídil věci do 4 kategorií", "Umístil 2 regály podél zadní stěny pro nářadí",
                   "1 regál u bočí stěny na sportovní vybavení", "Zinkovaný regál na pneumatiky do rohu (vlhkost)"],
         "result": "Garáž je přehledná, vše má své místo. Časová úspora: 15 min denně při hledání věcí.", "cat": "Garáž"},
        {"slug": "priklad-organizace-sklepa-regaly", "title": "Příklad: Organizace sklepa s regály",
         "scenario": "Rodina Dvořákových měla sklep plný zavařenin, vína a sezónních věcí v krabicích na zemi.",
         "solution": "Objednali 4 zinkované regály 180×90×40 cm – ideální do vlhkého sklepa.",
         "steps": ["Vynesli vše ze sklepa a vyřadili nepotřebné", "Nainstalovali 4 regály podél stěn",
                   "Zavařeniny a víno na oddělené regály", "Sezónní věci do popsaných boxů na horní police"],
         "result": "Sklep je přehledný, zavařeniny na dosah ruky. Kapacita skladu se ztrojnásobila.", "cat": "Sklep"},
        {"slug": "priklad-sklad-eshopu-regaly", "title": "Příklad: Jak vybavit sklad e-shopu regály",
         "scenario": "E-shop s 500 produkty řešil pomalé vychystávání objednávek v malém skladu.",
         "solution": "Zakoupili 8 profesionálních regálů 180×120×50 cm a zavedli systém číslování.",
         "steps": ["Zmapovali sortiment a frekvenci objednávek", "Navrhli layout skladu s uličkami 90 cm",
                   "Sestavili 8 regálů a očíslovali pozice (A1–H5)", "Rychloobrátkové zboží do výšky pasu"],
         "result": "Čas vychystání objednávky klesl z 8 na 2 minuty. Návratnost investice za 3 týdny.", "cat": "E-shop"},
        {"slug": "priklad-dilna-organizace", "title": "Příklad: Profesionální organizace dílny",
         "scenario": "Řemeslník s vlastní dílnou trávil 30 % času hledáním nářadí a materiálu.",
         "solution": "Pořídil 2 profesionální regály (1050 kg nosnost) a 2 standardní regály.",
         "steps": ["Rozdělil dílnu na pracovní a skladovací zónu", "Profesionální regály na těžký materiál a stroje",
                   "Standardní regály na ruční nářadí a drobný materiál", "Zavedl systém: každý nástroj má své místo"],
         "result": "Produktivita vzrostla o 25 %. Nářadí vždy po ruce, materiál přehledně uložen.", "cat": "Dílna"},
        {"slug": "priklad-spiz-organizace", "title": "Příklad: Jak zorganizovat spíž pomocí regálů",
         "scenario": "Spíž 2×3 metry plná potravin bez systému – prošlé potraviny, duplicitní nákupy.",
         "solution": "2 regály 150×70×30 cm (bílé) – kompaktní rozměr ideální do malé spíže.",
         "steps": ["Vytřídila potraviny a vyhodila prošlé", "Regály umístila naproti sobě podél stěn",
                   "Konzervy a trvanlivé potraviny na spodní police", "Denně používané potraviny ve výšce očí"],
         "result": "Žádné prošlé potraviny, úspora na nákupech 800 Kč měsíčně díky přehlednosti.", "cat": "Spíž"},
        {"slug": "priklad-archiv-dokumenty", "title": "Příklad: Archivace dokumentů na regálech",
         "scenario": "Účetní firma potřebovala archivovat 10 let dokumentů v malé kanceláři.",
         "solution": "5 regálů 220×90×45 cm (černé) – maximální výška pro maximální kapacitu.",
         "steps": ["Roztřídili dokumenty po letech a kategorii", "Regály umístili do archivní místnosti v řadách",
                   "Šanony s popisky podle roku a typu", "Archivační krabice na horní police pro starší dokumenty"],
         "result": "Kompletní archiv 10 let na 12 m². Přístup k jakémukoli dokumentu do 2 minut.", "cat": "Archiv"},
        {"slug": "priklad-satna-ulozny-system", "title": "Příklad: Šatní úložný systém z regálů",
         "scenario": "Rodina se 2 dětmi neměla dost místa na oblečení. Šatní skříně byly plné.",
         "solution": "3 regály 180×90×40 cm (bílé) jako otevřený šatní systém v ložnici.",
         "steps": ["Změřili prostor podél stěny v ložnici", "Bílé regály ladí s interiérem",
                   "Oblečení v boxech na policích podle sezóny a osoby", "Boty v boxech na spodních policích"],
         "result": "2× více místa na oblečení za 1/3 ceny šatní skříně. Přehledný systém.", "cat": "Šatna"},
        {"slug": "priklad-domaci-knihovna", "title": "Příklad: Domácí knihovna z kovových regálů",
         "scenario": "Knihomol s 800+ knihami hledal cenově dostupné řešení pro domácí knihovnu.",
         "solution": "4 regály 200×90×40 cm (černé) – industriální vzhled, vysoká nosnost pro knihy.",
         "steps": ["Naplánoval stěnu knih v obývacím pokoji", "Černé regály vytvořily industriální knihovnu",
                   "Knihy seřazeny podle žánru a autora", "Dekorace a doplňky na horních policích"],
         "result": "Všech 800 knih přehledně na jednom místě. Industriální design jako z interiérového časopisu.", "cat": "Domácnost"},
    ]

    pages = []
    for ex in examples:
        slug = ex["slug"]
        steps_html = "".join(f'<li class="flex gap-3"><span class="w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0 text-sm">{i+1}</span><span class="pt-1">{s}</span></li>'
                             for i, s in enumerate(ex["steps"]))

        body = f'''
        <p class="text-xl text-gray-600 mb-8">Reálný příklad, jak naši zákazníci využívají kovové regály. Inspirujte se a vytvořte si vlastní organizační systém.</p>

        <h2 class="text-2xl font-bold mb-4">Výchozí situace</h2>
        <div class="bg-red-50 border border-red-200 rounded-xl p-6 mb-8">
            <p class="text-red-700">{ex["scenario"]}</p>
        </div>

        <h2 class="text-2xl font-bold mb-4">Řešení</h2>
        <div class="bg-green-50 border border-green-200 rounded-xl p-6 mb-8">
            <p class="text-green-700 font-medium">{ex["solution"]}</p>
        </div>

        <h2 class="text-2xl font-bold mb-4">Postup realizace</h2>
        <ol class="space-y-4 mb-8">{steps_html}</ol>

        <h2 class="text-2xl font-bold mb-4">Výsledek</h2>
        <div class="bg-primary-50 border border-primary-200 rounded-xl p-6 mb-8">
            <p class="text-primary-700 font-medium">{ex["result"]}</p>
        </div>

        <h2 class="text-2xl font-bold mb-4">Použité produkty</h2>
        {get_product_cards(PRODUCTS[:4], 4)}

        <h2 class="text-2xl font-bold mb-4">Časté otázky</h2>
        <div class="space-y-4 mb-8">
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Mohu dosáhnout stejného výsledku?</h3>
                <p class="text-gray-600">Samozřejmě. Naše regály jsou univerzální a přizpůsobí se jakémukoli prostoru.</p>
            </div>
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Kolik to celé stálo?</h3>
                <p class="text-gray-600">Cena závisí na počtu regálů. Jeden regál stojí od 549 Kč, kompletní organizační systém od cca 2 000 Kč.</p>
            </div>
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Jak dlouho trvala realizace?</h3>
                <p class="text-gray-600">Montáž jednoho regálu trvá 10 minut. Celý projekt zvládnete za jedno odpoledne.</p>
            </div>
        </div>

        <h2 class="text-2xl font-bold mb-4">Další příklady a stránky</h2>
        {_internal_links(slug)}
        '''

        pages.append({
            "slug": slug,
            "title": ex["title"] + " | Bazarovyregal.cz",
            "meta_desc": f"{ex['title']}. {ex['scenario'][:80]} Inspirujte se reálným příkladem.",
            "h1": ex["title"],
            "body_html": body,
            "breadcrumb_category": ex["cat"],
            "playbook_type": "examples",
        })
    return pages


def generate_directory_pages():
    pages = []

    # Height directory pages
    for h in HEIGHTS:
        shelves = 5 if h >= 180 else 4
        capacity = shelves * 175
        slug = f"regaly-vyska-{h}-cm"

        body = f'''
        <p class="text-xl text-gray-600 mb-8">Přehled všech kovových regálů s výškou {h} cm. Regály s {shelves} policemi a celkovou nosností {capacity} kg.</p>

        <div class="grid md:grid-cols-3 gap-6 mb-8">
            <div class="bg-white rounded-xl p-6 shadow-sm text-center">
                <div class="text-3xl font-bold text-primary-600">{h} cm</div>
                <div class="text-gray-500">Výška</div>
            </div>
            <div class="bg-white rounded-xl p-6 shadow-sm text-center">
                <div class="text-3xl font-bold text-primary-600">{shelves}</div>
                <div class="text-gray-500">Počet polic</div>
            </div>
            <div class="bg-white rounded-xl p-6 shadow-sm text-center">
                <div class="text-3xl font-bold text-primary-600">{capacity} kg</div>
                <div class="text-gray-500">Celková nosnost</div>
            </div>
        </div>

        <h2 class="text-2xl font-bold mb-4">Dostupné varianty – výška {h} cm</h2>
        <p class="text-gray-600 mb-4">Regály výšky {h} cm jsou k dispozici v šířkách 40, 60, 70, 90 a 120 cm.
        Hloubka police od 30 do 50 cm. Barvy: černá, bílá, červená, modrá, zinkovaný.</p>

        {get_product_cards(PRODUCTS[:4], 4)}

        <h2 class="text-2xl font-bold mb-4">Pro koho je výška {h} cm ideální?</h2>
        <ul class="space-y-2 mb-8 text-gray-600">
            {"<li>Kompaktní prostory – spíž, komora, malá garáž</li><li>Snadný přístup ke všem policím bez žebříku</li><li>Ideální pro seniory a menší postavy</li>" if h == 150 else ""}
            {"<li>Univerzální výška – vejde se téměř všude</li><li>Nejprodávanější velikost</li><li>5 polic = optimální poměr výška/kapacita</li>" if h == 180 else ""}
            {"<li>Vysoké garáže a sklady</li><li>Maximalizace vertikálního prostoru</li><li>Profesionální použití</li>" if h == 200 else ""}
            {"<li>Nejvyšší varianta pro maximální kapacitu</li><li>Profesionální sklady s vysokými stropy</li><li>Archivní prostory</li>" if h == 220 else ""}
        </ul>

        <h2 class="text-2xl font-bold mb-4">Časté otázky</h2>
        <div class="space-y-4 mb-8">
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Kolik polic má regál výšky {h} cm?</h3>
                <p class="text-gray-600">{shelves} polic s nastavitelnou výškou po 5 cm.</p>
            </div>
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Jaká je nosnost?</h3>
                <p class="text-gray-600">175 kg na polici, celkem {capacity} kg na celý regál.</p>
            </div>
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">V jakých barvách je dostupný?</h3>
                <p class="text-gray-600">Černá, bílá, červená, modrá a zinkovaný povrch.</p>
            </div>
        </div>
        {_internal_links(slug)}
        '''

        pages.append({
            "slug": slug,
            "title": f"Regály výška {h} cm – {shelves} police, nosnost {capacity} kg | Bazarovyregal.cz",
            "meta_desc": f"Kovové regály výšky {h} cm. {shelves} nastavitelných polic, nosnost {capacity} kg. Od 549 Kč. Všechny barvy skladem.",
            "h1": f"Kovové regály – výška {h} cm",
            "body_html": body,
            "breadcrumb_category": "Podle výšky",
            "playbook_type": "directory",
        })

    # Width directory pages
    for w in WIDTHS:
        slug = f"regaly-sirka-{w}-cm"
        desc = {40: "nejužší varianta do stísněných prostor", 60: "kompaktní šířka pro menší prostory",
                70: "standardní šířka pro domácnost", 90: "nejprodávanější šířka – univerzální",
                120: "nejširší varianta pro profesionální použití"}.get(w, "")

        body = f'''
        <p class="text-xl text-gray-600 mb-8">Kovové regály šířky {w} cm – {desc}. Dostupné ve všech výškách a barvách.</p>

        <h2 class="text-2xl font-bold mb-4">Regály šířky {w} cm</h2>
        <p class="text-gray-600 mb-8">Šířka {w} cm je {desc}. Regály jsou dostupné ve výškách 150, 180, 200 a 220 cm.
        Hloubka police od 30 do 50 cm. Nosnost 175 kg na polici.</p>

        {get_product_cards(PRODUCTS[:4], 4)}

        <h2 class="text-2xl font-bold mb-4">Časté otázky</h2>
        <div class="space-y-4 mb-8">
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Kam se hodí regál šířky {w} cm?</h3>
                <p class="text-gray-600">Šířka {w} cm je {desc}.</p>
            </div>
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Kolik regálů se vejde na stěnu 3 metry?</h3>
                <p class="text-gray-600">Na 3 m stěnu se vejde {300 // w} regálů šířky {w} cm vedle sebe.</p>
            </div>
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Jaká je cena?</h3>
                <p class="text-gray-600">Ceny regálů šířky {w} cm začínají od 549 Kč podle výšky a povrchu.</p>
            </div>
        </div>
        {_internal_links(slug)}
        '''

        pages.append({
            "slug": slug,
            "title": f"Regály šířka {w} cm – {desc} | Bazarovyregal.cz",
            "meta_desc": f"Kovové regály šířky {w} cm. {desc.capitalize()}. Všechny výšky a barvy. Od 549 Kč.",
            "h1": f"Kovové regály – šířka {w} cm",
            "body_html": body,
            "breadcrumb_category": "Podle šířky",
            "playbook_type": "directory",
        })

    # Use case directory pages
    for uc in USE_CASES:
        slug = uc["slug"]
        name = uc["name"]

        body = f'''
        <p class="text-xl text-gray-600 mb-8">Kovové regály na {name.lower()} – pevné, spolehlivé a cenově dostupné řešení
        pro přehledné uložení. Nosnost až 175 kg na polici.</p>

        <h2 class="text-2xl font-bold mb-4">Proč kovový regál na {name.lower()}?</h2>
        <div class="grid md:grid-cols-2 gap-6 mb-8">
            <div class="bg-white rounded-xl p-6 shadow-sm">
                <h3 class="font-bold mb-2">Vysoká nosnost</h3>
                <p class="text-gray-600">Až 175 kg na polici – bez problémů unese i těžší předměty.</p>
            </div>
            <div class="bg-white rounded-xl p-6 shadow-sm">
                <h3 class="font-bold mb-2">Nastavitelné police</h3>
                <p class="text-gray-600">Výšku polic přizpůsobíte velikosti ukládaných předmětů.</p>
            </div>
        </div>

        <h2 class="text-2xl font-bold mb-4">Doporučené regály na {name.lower()}</h2>
        {get_product_cards(PRODUCTS[:4], 4)}

        <h2 class="text-2xl font-bold mb-4">Časté otázky</h2>
        <div class="space-y-4 mb-8">
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Jaký regál je nejlepší na {name.lower()}?</h3>
                <p class="text-gray-600">Doporučujeme regál 180×90×40 cm – univerzální velikost s nosností 875 kg celkem.</p>
            </div>
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Kolik {name.lower()} se vejde na jeden regál?</h3>
                <p class="text-gray-600">Záleží na velikosti předmětů. Regál má 4–5 polic, každá o rozměrech až 120×50 cm.</p>
            </div>
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Jaká je cena?</h3>
                <p class="text-gray-600">Ceny začínají od 549 Kč za kompletní regál včetně všech polic.</p>
            </div>
        </div>
        {_internal_links(slug)}
        '''

        pages.append({
            "slug": slug,
            "title": f"Regály na {name.lower()} – pevné a levné | Bazarovyregal.cz",
            "meta_desc": f"Kovové regály na {name.lower()}. Nosnost až 175 kg/police, nastavitelné police. Od 549 Kč se zárukou 7 let.",
            "h1": f"Regály na {name.lower()} – přehledné uložení",
            "body_html": body,
            "breadcrumb_category": "Podle využití",
            "playbook_type": "directory",
        })

    # Special directory pages
    for spec in [
        {"slug": "regaly-podle-nosnosti", "title": "Regály podle nosnosti – 700, 875, 1050 kg",
         "body_extra": """
         <div class="grid md:grid-cols-3 gap-6 mb-8">
             <div class="bg-white rounded-xl p-6 shadow-sm text-center border-2 border-gray-200">
                 <div class="text-3xl font-bold text-gray-600 mb-2">700 kg</div>
                 <div class="font-medium mb-2">Řada 150 cm</div>
                 <p class="text-sm text-gray-500">4 police × 175 kg. Vhodné pro domácnost.</p>
                 <div class="mt-3 text-primary-600 font-bold">od 549 Kč</div>
             </div>
             <div class="bg-white rounded-xl p-6 shadow-sm text-center border-2 border-primary-500">
                 <span class="bg-primary-500 text-white text-xs px-2 py-1 rounded mb-2 inline-block">Bestseller</span>
                 <div class="text-3xl font-bold text-primary-600 mb-2">875 kg</div>
                 <div class="font-medium mb-2">Řada 180–220 cm</div>
                 <p class="text-sm text-gray-500">5 polic × 175 kg. Univerzální použití.</p>
                 <div class="mt-3 text-primary-600 font-bold">od 629 Kč</div>
             </div>
             <div class="bg-white rounded-xl p-6 shadow-sm text-center border-2 border-gray-200">
                 <span class="bg-gray-800 text-white text-xs px-2 py-1 rounded mb-2 inline-block">Profi</span>
                 <div class="text-3xl font-bold text-gray-800 mb-2">1050 kg</div>
                 <div class="font-medium mb-2">Profesionální řada</div>
                 <p class="text-sm text-gray-500">5 polic × 210 kg. Pro náročné prostředí.</p>
                 <div class="mt-3 text-primary-600 font-bold">od 1249 Kč</div>
             </div>
         </div>"""},
        {"slug": "regaly-podle-ceny", "title": "Regály podle ceny – od nejlevnějšího",
         "body_extra": """
         <div class="space-y-4 mb-8">
             <div class="bg-white rounded-xl p-5 shadow-sm flex justify-between items-center">
                 <div><span class="font-bold text-lg">549 Kč</span> – Regál 150×70×30 cm zinkovaný</div>
                 <a href="regal-150x70x30-zinkovany.html" class="text-primary-600 hover:underline">Detail</a>
             </div>
             <div class="bg-white rounded-xl p-5 shadow-sm flex justify-between items-center">
                 <div><span class="font-bold text-lg">599 Kč</span> – Regál 150×70×30 cm černý</div>
                 <a href="regal-150x70x30-cerna.html" class="text-primary-600 hover:underline">Detail</a>
             </div>
             <div class="bg-white rounded-xl p-5 shadow-sm flex justify-between items-center">
                 <div><span class="font-bold text-lg">649 Kč</span> – Regál 180×90×40 cm zinkovaný</div>
                 <a href="regal-180x90x40-zinkovany.html" class="text-primary-600 hover:underline">Detail</a>
             </div>
             <div class="bg-white rounded-xl p-5 shadow-sm flex justify-between items-center">
                 <div><span class="font-bold text-lg">739 Kč</span> – Regál 180×90×40 cm černý (BESTSELLER)</div>
                 <a href="regal-180x90x40-cerna.html" class="text-primary-600 hover:underline">Detail</a>
             </div>
             <div class="bg-white rounded-xl p-5 shadow-sm flex justify-between items-center">
                 <div><span class="font-bold text-lg">849 Kč</span> – Regál 200×90×40 cm černý</div>
                 <a href="regal-200x90x40-cerna.html" class="text-primary-600 hover:underline">Detail</a>
             </div>
             <div class="bg-white rounded-xl p-5 shadow-sm flex justify-between items-center">
                 <div><span class="font-bold text-lg">1249 Kč</span> – Regál 180×120×50 cm profesionální</div>
                 <a href="regal-180x120x50-profesionalni.html" class="text-primary-600 hover:underline">Detail</a>
             </div>
         </div>"""},
    ]:
        slug = spec["slug"]
        body = f'''
        <p class="text-xl text-gray-600 mb-8">Přehledný seznam všech regálů seřazených pro snadný výběr.</p>
        {spec["body_extra"]}
        {get_product_cards(PRODUCTS[:4], 4)}
        <h2 class="text-2xl font-bold mb-4">Časté otázky</h2>
        <div class="space-y-4 mb-8">
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Jak vybrat správnou nosnost?</h3>
                <p class="text-gray-600">Sečtěte hmotnost předmětů na jedné polici. Standardní 175 kg stačí pro většinu potřeb.</p>
            </div>
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Jsou všechny regály skladem?</h3>
                <p class="text-gray-600">Ano, všechny regály v nabídce jsou skladem a expedujeme ihned.</p>
            </div>
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Mohu kombinovat různé velikosti?</h3>
                <p class="text-gray-600">Ano, regály jsou modulární a lze je stavět vedle sebe.</p>
            </div>
        </div>
        {_internal_links(slug)}
        '''

        pages.append({
            "slug": slug,
            "title": spec["title"] + " | Bazarovyregal.cz",
            "meta_desc": spec["title"] + ". Kompletní přehled kovových regálů. Od 549 Kč se zárukou 7 let.",
            "h1": spec["title"],
            "body_html": body,
            "breadcrumb_category": "Přehled",
            "playbook_type": "directory",
        })

    return pages


def generate_profile_pages():
    profiles = [
        {"slug": "profil-regal-150-serie", "title": "Řada 150 cm – kompletní profil",
         "height": 150, "shelves": 4, "capacity": 700, "price_from": 549,
         "desc": "Nejkompaktnější řada vhodná do malých prostor. 4 police, výška 150 cm.",
         "ideal": "spíž, komora, malá garáž, dětský pokoj, studentský pokoj"},
        {"slug": "profil-regal-180-serie", "title": "Řada 180 cm – nejprodávanější",
         "height": 180, "shelves": 5, "capacity": 875, "price_from": 629,
         "desc": "Nejprodávanější řada. Univerzální výška, 5 polic. Bestseller.",
         "ideal": "garáž, sklep, dílna, kancelář, sklad, domácnost"},
        {"slug": "profil-regal-200-serie", "title": "Řada 200 cm – extra kapacita",
         "height": 200, "shelves": 5, "capacity": 875, "price_from": 849,
         "desc": "Vyšší varianta pro prostory s vysokým stropem. Maximum úložného prostoru.",
         "ideal": "vysoké garáže, sklady, archivní prostory"},
        {"slug": "profil-regal-220-serie", "title": "Řada 220 cm – maximální výška",
         "height": 220, "shelves": 5, "capacity": 875, "price_from": 899,
         "desc": "Nejvyšší varianta pro profesionální sklady a archivy.",
         "ideal": "profesionální sklady, archivy, e-shop sklady"},
        {"slug": "profil-profesionalni-rada", "title": "Profesionální řada – nosnost 1050 kg",
         "height": 180, "shelves": 5, "capacity": 1050, "price_from": 1249,
         "desc": "Nejvyšší nosnost v nabídce. 210 kg na polici, celkem 1050 kg.",
         "ideal": "průmyslové sklady, dílny, e-shopy s těžkým zbožím"},
        {"slug": "profil-zinkovane-regaly", "title": "Zinkovaná řada – odolnost vlhkosti",
         "height": 180, "shelves": 5, "capacity": 875, "price_from": 549,
         "desc": "Zinkovaný povrch chrání před korozí. Ideální do vlhkých prostor.",
         "ideal": "sklep, vlhká garáž, venkovní přístřešek, skleník"},
    ]

    pages = []
    for prof in profiles:
        slug = prof["slug"]

        body = f'''
        <p class="text-xl text-gray-600 mb-8">{prof["desc"]}</p>

        <div class="grid md:grid-cols-4 gap-4 mb-8">
            <div class="bg-white rounded-xl p-5 shadow-sm text-center">
                <div class="text-2xl font-bold text-primary-600">{prof["height"]} cm</div>
                <div class="text-sm text-gray-500">Výška</div>
            </div>
            <div class="bg-white rounded-xl p-5 shadow-sm text-center">
                <div class="text-2xl font-bold text-primary-600">{prof["shelves"]}</div>
                <div class="text-sm text-gray-500">Polic</div>
            </div>
            <div class="bg-white rounded-xl p-5 shadow-sm text-center">
                <div class="text-2xl font-bold text-primary-600">{prof["capacity"]} kg</div>
                <div class="text-sm text-gray-500">Nosnost</div>
            </div>
            <div class="bg-white rounded-xl p-5 shadow-sm text-center">
                <div class="text-2xl font-bold text-primary-600">od {prof["price_from"]} Kč</div>
                <div class="text-sm text-gray-500">Cena</div>
            </div>
        </div>

        <h2 class="text-2xl font-bold mb-4">Přehled variant</h2>
        <p class="text-gray-600 mb-4">Dostupné šířky: 40, 60, 70, 90 a 120 cm. Hloubky: 30, 40, 45 a 50 cm.
        Barvy: černá, bílá, červená, modrá, zinkovaný.</p>

        <h2 class="text-2xl font-bold mb-4">Ideální použití</h2>
        <p class="text-gray-600 mb-8">Tato řada je ideální pro: <strong>{prof["ideal"]}</strong>.</p>

        <h2 class="text-2xl font-bold mb-4">Klíčové vlastnosti</h2>
        <div class="grid md:grid-cols-2 gap-4 mb-8">
            <div class="flex items-start gap-3 bg-white rounded-xl p-4 shadow-sm">
                <span class="text-green-500 text-xl">&#10003;</span>
                <div><strong>Bezšroubová montáž</strong> – za 10 minut bez nářadí</div>
            </div>
            <div class="flex items-start gap-3 bg-white rounded-xl p-4 shadow-sm">
                <span class="text-green-500 text-xl">&#10003;</span>
                <div><strong>Nastavitelné police</strong> – po 5 cm podle potřeby</div>
            </div>
            <div class="flex items-start gap-3 bg-white rounded-xl p-4 shadow-sm">
                <span class="text-green-500 text-xl">&#10003;</span>
                <div><strong>Záruka 7 let</strong> – na celý regál</div>
            </div>
            <div class="flex items-start gap-3 bg-white rounded-xl p-4 shadow-sm">
                <span class="text-green-500 text-xl">&#10003;</span>
                <div><strong>Expedice ihned</strong> – vše skladem</div>
            </div>
        </div>

        {get_product_cards(PRODUCTS[:4], 4)}

        <h2 class="text-2xl font-bold mb-4">Časté otázky</h2>
        <div class="space-y-4 mb-8">
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Jaký je rozdíl oproti ostatním řadám?</h3>
                <p class="text-gray-600">Hlavní rozdíl je ve výšce ({prof["height"]} cm) a tím i v celkovém úložném prostoru a počtu polic ({prof["shelves"]}).</p>
            </div>
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Mohu kombinovat s jinými řadami?</h3>
                <p class="text-gray-600">Ano, všechny naše regály mají stejnou konstrukční šířku a lze je stavět vedle sebe.</p>
            </div>
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Kolik regálů doporučujete?</h3>
                <p class="text-gray-600">Záleží na velikosti prostoru. Změřte dostupnou stěnu a vydělte šířkou regálu.</p>
            </div>
        </div>
        {_internal_links(slug)}
        '''

        pages.append({
            "slug": slug,
            "title": prof["title"] + " | Bazarovyregal.cz",
            "meta_desc": f"{prof['title']}. {prof['desc']} Od {prof['price_from']} Kč, záruka 7 let.",
            "h1": prof["title"],
            "body_html": body,
            "breadcrumb_category": "Profil řady",
            "playbook_type": "profiles",
        })
    return pages


if __name__ == "__main__":
    pages = generate_example_pages() + generate_directory_pages() + generate_profile_pages()
    print(f"Generated {len(pages)} pages")
    for p in pages:
        print(f"  {p['slug']}.html - {p['playbook_type']}")
