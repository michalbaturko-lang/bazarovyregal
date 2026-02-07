#!/usr/bin/env python3
"""pSEO Playbooks Part 2: Comparisons, Curation, Templates"""

from pseo_config import COMPARISONS, PRODUCTS, CATEGORIES, EXISTING_PAGES
from pseo_html_template import get_product_cards


def _internal_links(exclude_slug, count=6):
    links = []
    for p in EXISTING_PAGES:
        if p["slug"] != exclude_slug and len(links) < count:
            links.append(f'<li><a href="{p["slug"]}.html" class="text-primary-600 hover:underline">{p["title"]}</a></li>')
    return '<ul class="grid sm:grid-cols-2 gap-2 mt-4 mb-8">' + "".join(links) + "</ul>"


def generate_comparison_pages():
    pages = []
    for comp in COMPARISONS:
        slug = comp["slug"]
        a = comp["item_a"]
        b = comp["item_b"]

        pros_a = "".join(f"<li class='text-green-700'>&#10003; {p}</li>" for p in a["pros"])
        cons_a = "".join(f"<li class='text-red-600'>&#10007; {c}</li>" for c in a["cons"])
        pros_b = "".join(f"<li class='text-green-700'>&#10003; {p}</li>" for p in b["pros"])
        cons_b = "".join(f"<li class='text-red-600'>&#10007; {c}</li>" for c in b["cons"])

        # Feature matrix rows
        features = []
        for key in ["price_from", "height", "width", "shelves", "capacity", "surface"]:
            if key in a or key in b:
                label = {"price_from": "Cena od", "height": "Výška", "width": "Šířka", "shelves": "Počet polic",
                         "capacity": "Nosnost", "surface": "Povrch"}.get(key, key)
                val_a = a.get(key, "–")
                val_b = b.get(key, "–")
                if key == "price_from":
                    val_a = f"{val_a} Kč" if val_a != "–" else "–"
                    val_b = f"{val_b} Kč" if val_b != "–" else "–"
                elif key in ("height", "width"):
                    val_a = f"{val_a} cm" if val_a != "–" else "–"
                    val_b = f"{val_b} cm" if val_b != "–" else "–"
                elif key == "capacity":
                    val_a = f"{val_a} kg" if val_a != "–" else "–"
                    val_b = f"{val_b} kg" if val_b != "–" else "–"
                features.append(f"<tr class='border-b'><td class='py-3 px-4 font-medium'>{label}</td><td class='py-3 px-4 text-center'>{val_a}</td><td class='py-3 px-4 text-center'>{val_b}</td></tr>")

        feature_rows = "".join(features)

        body = f'''
        <p class="text-xl text-gray-600 mb-8">Porovnáváme {a["name"]} a {b["name"]}. Který je lepší volbou pro vaše potřeby?
        Přečtěte si detailní srovnání včetně výhod, nevýhod a našeho doporučení.</p>

        <h2 class="text-2xl font-bold mb-4">Srovnávací tabulka</h2>
        <div class="overflow-x-auto mb-8">
            <table class="w-full bg-white rounded-xl shadow-sm">
                <thead class="bg-gray-50">
                    <tr><th class="py-3 px-4 text-left">Parametr</th><th class="py-3 px-4 text-center">{a["name"]}</th><th class="py-3 px-4 text-center">{b["name"]}</th></tr>
                </thead>
                <tbody>{feature_rows}</tbody>
            </table>
        </div>

        <div class="grid md:grid-cols-2 gap-8 mb-8">
            <div class="bg-white rounded-xl p-6 shadow-sm">
                <h2 class="text-xl font-bold mb-4">{a["name"]}</h2>
                <h3 class="font-medium text-green-700 mb-2">Výhody:</h3>
                <ul class="space-y-1 mb-4">{pros_a}</ul>
                <h3 class="font-medium text-red-600 mb-2">Nevýhody:</h3>
                <ul class="space-y-1">{cons_a}</ul>
            </div>
            <div class="bg-white rounded-xl p-6 shadow-sm">
                <h2 class="text-xl font-bold mb-4">{b["name"]}</h2>
                <h3 class="font-medium text-green-700 mb-2">Výhody:</h3>
                <ul class="space-y-1 mb-4">{pros_b}</ul>
                <h3 class="font-medium text-red-600 mb-2">Nevýhody:</h3>
                <ul class="space-y-1">{cons_b}</ul>
            </div>
        </div>

        <h2 class="text-2xl font-bold mb-4">Kdy vybrat {a["name"]}?</h2>
        <p class="text-gray-600 mb-4">Vyberte {a["name"]}, pokud hledáte {a["pros"][0].lower() if a["pros"] else "dobrou volbu"}.
        Je ideální pro běžné domácí použití a nabízí výborný poměr cena/výkon.</p>

        <h2 class="text-2xl font-bold mb-4">Kdy vybrat {b["name"]}?</h2>
        <p class="text-gray-600 mb-4">Vyberte {b["name"]}, pokud potřebujete {b["pros"][0].lower() if b["pros"] else "speciální řešení"}.
        Hodí se zejména pro náročnější použití.</p>

        <div class="bg-primary-50 border border-primary-200 rounded-xl p-6 mb-8">
            <h2 class="text-xl font-bold text-primary-800 mb-2">Náš verdikt</h2>
            <p class="text-primary-700">{comp["verdict"]}</p>
        </div>

        <h2 class="text-2xl font-bold mb-4">Doporučené produkty</h2>
        {get_product_cards(PRODUCTS[:4], 4)}

        <h2 class="text-2xl font-bold mb-4">Časté otázky</h2>
        <div class="space-y-4 mb-8">
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Který je celkově lepší – {a["name"]} nebo {b["name"]}?</h3>
                <p class="text-gray-600">{comp["verdict"]}</p>
            </div>
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Mohu oba typy kombinovat?</h3>
                <p class="text-gray-600">Ano, naše regály jsou modulární a lze je stavět vedle sebe bez ohledu na výšku nebo barvu.</p>
            </div>
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Liší se kvalita zpracování?</h3>
                <p class="text-gray-600">Ne, všechny naše regály mají stejnou kvalitu zpracování. Rozdíl je pouze v rozměrech a povrchové úpravě.</p>
            </div>
        </div>

        <h2 class="text-2xl font-bold mb-4">Další srovnání a stránky</h2>
        {_internal_links(slug)}
        '''

        pages.append({
            "slug": slug,
            "title": comp["title"] + " | Bazarovyregal.cz",
            "meta_desc": f"Srovnání {a['name']} vs {b['name']}. Výhody, nevýhody, srovnávací tabulka a doporučení. {comp['verdict'][:80]}",
            "h1": comp["title"],
            "body_html": body,
            "breadcrumb_category": "Srovnání",
            "playbook_type": "comparisons",
        })
    return pages


def generate_curation_pages():
    curations = [
        {"slug": "nejlepsi-kovove-regaly-2026", "title": "Nejlepší kovové regály 2026 – TOP výběr",
         "intro": "Vybrali jsme TOP kovové regály roku 2026 na základě poměru cena/výkon, nosnosti a zpětné vazby zákazníků.",
         "criteria": ["Poměr cena/výkon", "Celková nosnost", "Kvalita zpracování", "Hodnocení zákazníků", "Šířka nabídky rozměrů"],
         "products": PRODUCTS[:6], "cat": "Kovové regály"},
        {"slug": "nejlepsi-regaly-do-garaze", "title": "TOP regály do garáže 2026",
         "intro": "Garáž potřebuje odolné regály s vysokou nosností. Vybrali jsme nejlepší modely pro garážové podmínky.",
         "criteria": ["Odolnost vlhkosti", "Nosnost", "Rozměry vhodné do garáže", "Cena", "Snadnost montáže"],
         "products": [p for p in PRODUCTS if "cerna" in p["url"] or "zinkovany" in p["url"]][:5], "cat": "Do garáže"},
        {"slug": "nejlepsi-regaly-do-sklepa", "title": "TOP regály do sklepa 2026 – odolné vlhkosti",
         "intro": "Sklep vyžaduje regály odolné vlhkosti. Jednoznačně doporučujeme zinkované varianty.",
         "criteria": ["Odolnost korozi", "Zinkovaný povrch", "Nosnost pro zavařeniny/víno", "Cena"],
         "products": [p for p in PRODUCTS if "zinkovany" in p["url"]][:3] + PRODUCTS[:2], "cat": "Do sklepa"},
        {"slug": "nejlepsi-zinkovane-regaly", "title": "TOP zinkované regály – odolnost bez kompromisů",
         "intro": "Zinkované regály jsou nejlepší volbou do vlhkých prostor. Srovnáváme dostupné varianty.",
         "criteria": ["Kvalita zinkového povlaku", "Nosnost", "Dostupné rozměry", "Cena"],
         "products": [p for p in PRODUCTS if "zinkovany" in p["url"]][:3] + PRODUCTS[:2], "cat": "Zinkované"},
        {"slug": "nejlepsi-regaly-do-dilny", "title": "TOP regály do dílny 2026",
         "intro": "Dílna vyžaduje profesionální přístup. Tyto regály zvládnou i to nejtěžší nářadí.",
         "criteria": ["Maximální nosnost", "Profesionální povrch", "Šířka police", "Modularita"],
         "products": [PRODUCTS[9], PRODUCTS[7]] + PRODUCTS[:3], "cat": "Do dílny"},
        {"slug": "nejlevnejsi-regaly", "title": "Nejlevnější kovové regály – od 549 Kč",
         "intro": "Hledáte nejlevnější regály na trhu? Díky likvidaci skladu nabízíme nové regály za ceny bazaru.",
         "criteria": ["Absolutní cena", "Poměr cena/výkon", "Dostupnost skladem"],
         "products": sorted(PRODUCTS, key=lambda x: x["price"])[:5], "cat": "Levné regály"},
        {"slug": "nejprodavanejsi-regaly", "title": "Nejprodávanější regály 2026 – co kupují ostatní",
         "intro": "Podívejte se, které regály naši zákazníci kupují nejčastěji a proč.",
         "criteria": ["Počet prodaných kusů", "Hodnocení zákazníků", "Opakované nákupy"],
         "products": [PRODUCTS[2], PRODUCTS[3], PRODUCTS[0]] + PRODUCTS[4:6], "cat": "Bestsellery"},
        {"slug": "top-regaly-pro-firmy", "title": "TOP regály pro firmy a podnikatele 2026",
         "intro": "Profesionální regály pro firemní sklady, e-shopy a kanceláře. Vysoká nosnost, množstevní slevy.",
         "criteria": ["Nosnost 875–1050 kg", "Profesionální provedení", "Velké rozměry", "Možnost objednat více kusů"],
         "products": [PRODUCTS[9], PRODUCTS[8], PRODUCTS[7]] + PRODUCTS[:2], "cat": "Pro firmy"},
    ]

    pages = []
    for cur in curations:
        slug = cur["slug"]
        criteria_items = "".join(f"<li class='flex items-center gap-2'><span class='w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center text-xs font-bold text-primary-600'>{i+1}</span> {c}</li>"
                                 for i, c in enumerate(cur["criteria"]))

        product_rows = ""
        for i, p in enumerate(cur["products"][:5]):
            badge = '<span class="bg-primary-500 text-white text-xs px-2 py-1 rounded">TOP volba</span>' if i == 0 else ""
            product_rows += f'''
            <tr class="border-b hover:bg-gray-50">
                <td class="py-4 px-4 font-bold text-lg text-primary-600">#{i+1}</td>
                <td class="py-4 px-4"><div class="font-medium">{p["name"]}</div>{badge}</td>
                <td class="py-4 px-4 text-right font-bold text-primary-600">{p["price"]} Kč</td>
                <td class="py-4 px-4 text-right">{p.get("capacity", 875)} kg</td>
                <td class="py-4 px-4 text-right"><a href="{p["url"]}" class="text-primary-600 hover:underline font-medium">Detail</a></td>
            </tr>'''

        body = f'''
        <p class="text-xl text-gray-600 mb-8">{cur["intro"]}</p>

        <h2 class="text-2xl font-bold mb-4">Jak hodnotíme</h2>
        <div class="bg-gray-50 rounded-xl p-6 mb-8">
            <ul class="space-y-3">{criteria_items}</ul>
        </div>

        <h2 class="text-2xl font-bold mb-4">Žebříček – {cur["title"]}</h2>
        <div class="overflow-x-auto mb-8">
            <table class="w-full bg-white rounded-xl shadow-sm">
                <thead class="bg-gray-50">
                    <tr><th class="py-3 px-4 text-left">#</th><th class="py-3 px-4 text-left">Produkt</th><th class="py-3 px-4 text-right">Cena</th><th class="py-3 px-4 text-right">Nosnost</th><th class="py-3 px-4 text-right">Odkaz</th></tr>
                </thead>
                <tbody>{product_rows}</tbody>
            </table>
        </div>

        <h2 class="text-2xl font-bold mb-4">Proč těmto regálům věřit?</h2>
        <p class="text-gray-600 mb-8">Všechny regály v našem žebříčku jsou prověřeny tisíci zákazníky (hodnocení 4.8/5).
        Jsou vyrobeny z kvalitní oceli, mají certifikovanou nosnost a poskytujeme na ně záruku 7 let.
        Díky likvidaci skladu je nabízíme za zlomek běžné ceny.</p>

        {get_product_cards(cur["products"][:4], 4)}

        <h2 class="text-2xl font-bold mb-4">Často kladené otázky</h2>
        <div class="space-y-4 mb-8">
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Jak často aktualizujete žebříček?</h3>
                <p class="text-gray-600">Žebříček aktualizujeme pravidelně na základě prodejních dat a zpětné vazby zákazníků.</p>
            </div>
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Jsou všechny produkty skladem?</h3>
                <p class="text-gray-600">Ano, všechny regály v žebříčku jsou aktuálně skladem a expedujeme je ihned.</p>
            </div>
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Mohu vrátit regál, pokud mi nevyhovuje?</h3>
                <p class="text-gray-600">Samozřejmě, máte 14 dní na vrácení bez udání důvodu.</p>
            </div>
        </div>

        <h2 class="text-2xl font-bold mb-4">Další stránky</h2>
        {_internal_links(slug)}
        '''

        pages.append({
            "slug": slug,
            "title": cur["title"] + " | Bazarovyregal.cz",
            "meta_desc": cur["intro"][:155],
            "h1": cur["title"],
            "body_html": body,
            "breadcrumb_category": cur["cat"],
            "playbook_type": "curation",
        })
    return pages


def generate_template_pages():
    templates = [
        {"slug": "sablona-organizace-garaze", "title": "Šablona pro organizaci garáže s regály",
         "steps": [
             ("Změřte prostor", "Změřte výšku, šířku a hloubku dostupného prostoru v garáži. Nechte 5 cm rezervu kolem regálu."),
             ("Kategorizujte věci", "Rozdělte věci do skupin: nářadí, pneumatiky, sportovní vybavení, chemie, sezónní předměty."),
             ("Vyberte regály", "Pro garáž doporučujeme regál 180×90×40 cm. Do vlhké garáže volte zinkovaný povrch."),
             ("Rozmístěte regály", "Těžké předměty na spodní police, často používané věci ve výšce očí, sezónní věci nahoře."),
             ("Označte police", "Použijte štítky pro snadnou orientaci. Každá police by měla mít jasný účel."),
         ],
         "checklist": ["Prostor změřen", "Věci roztříděny", "Regály objednány", "Regály sestaveny", "Věci organizovány", "Police označeny"],
         "cat": "Garáž"},
        {"slug": "sablona-organizace-sklepa", "title": "Šablona pro organizaci sklepa s regály",
         "steps": [
             ("Vyčistěte sklep", "Odstraňte nepotřebné věci a vyčistěte prostor před instalací regálů."),
             ("Zkontrolujte vlhkost", "Sklep bývá vlhký – použijte výhradně zinkované regály odolné korozi."),
             ("Naplánujte rozmístění", "Zohledněte přístup ke všem regálům a dostatečný prostor pro průchod."),
             ("Organizujte podle typu", "Zavařeniny na jednom regálu, víno na druhém, sezónní věci na třetím."),
             ("Zajistěte stabilitu", "V nestabilním podloží přikotvěte regály ke zdi."),
         ],
         "checklist": ["Sklep vyčištěn", "Vlhkost zkontrolována", "Zinkované regály objednány", "Regály sestaveny a ukotveny", "Věci organizovány"],
         "cat": "Sklep"},
        {"slug": "sablona-organizace-dilny", "title": "Šablona pro organizaci dílny s regály",
         "steps": [
             ("Určete zóny", "Rozdělte dílnu na zóny: pracovní zóna, skladovací zóna, zóna nářadí."),
             ("Vyberte profesionální regály", "Pro dílnu doporučujeme regály s nosností 875–1050 kg pro těžké nářadí."),
             ("Organizujte nářadí", "Ruční nářadí ve výšce očí, elektrické nářadí na stabilních policích, drobný materiál v boxech."),
             ("Přidejte příslušenství", "Úložné boxy, organizéry na šrouby, háčky pro zavěšení."),
             ("Udržujte pořádek", "Po každé práci vracejte nářadí na místo. Pravidelně kontrolujte stav regálů."),
         ],
         "checklist": ["Zóny dílny určeny", "Regály vybrány a objednány", "Nářadí roztříděno", "Boxy a organizéry pořízeny", "Systém označení zaveden"],
         "cat": "Dílna"},
        {"slug": "sablona-vybaveni-skladu", "title": "Šablona pro vybavení skladu regály",
         "steps": [
             ("Analyzujte potřeby", "Spočítejte objem zboží, frekvenci přístupu a maximální hmotnost na polici."),
             ("Navrhněte layout", "Naplánujte řady regálů s dostatečnými uličkami (min. 80 cm) pro průchod."),
             ("Objednejte regály", "Pro sklady doporučujeme profesionální řadu 180×120×50 cm s nosností 1050 kg."),
             ("Zavedete systém", "Očíslujte regály a police. Zavedete systém umístění zboží (A1, B3 apod.)."),
             ("Optimalizujte", "Rychloobrátkové zboží v dosahu, těžké na spodní police, lehké nahoru."),
         ],
         "checklist": ["Potřeby analyzovány", "Layout navržen", "Regály objednány", "Systém číslování zaveden", "Zboží rozmístěno"],
         "cat": "Sklad"},
        {"slug": "pruvodce-vyberem-regalu", "title": "Průvodce výběrem regálu – krok za krokem",
         "steps": [
             ("Určete místo", "Kam regál umístíte? Garáž, sklep, dílna, kancelář, domácnost? To určuje typ povrchu."),
             ("Změřte prostor", "Výška stropu, šířka stěny, hloubka od zdi. Nechte 5 cm rezervu."),
             ("Zvažte zatížení", "Co budete ukládat? Lehké předměty (knihy) vs. těžké (nářadí, pneumatiky)?"),
             ("Vyberte povrch", "Sucho → lakovaný (černý, bílý, červený, modrý). Vlhko → zinkovaný."),
             ("Vyberte rozměr", "150 cm pro malé prostory, 180 cm standard, 200–220 cm pro vysoké prostory."),
         ],
         "checklist": ["Místo určeno", "Prostor změřen", "Zatížení odhadnuto", "Povrch vybrán", "Rozměr zvolen", "Objednávka odeslána"],
         "cat": "Průvodce"},
        {"slug": "kalkulacka-ulozneho-prostoru", "title": "Kalkulačka úložného prostoru – kolik regálů potřebujete",
         "steps": [
             ("Změřte dostupný prostor", "Délka stěny × výška stropu = maximální plocha pro regály."),
             ("Spočítejte regály na stěnu", "Šířka stěny ÷ šířka regálu = počet regálů vedle sebe."),
             ("Vypočítejte úložnou plochu", "Počet regálů × počet polic × plocha police = celková úložná plocha."),
             ("Zkontrolujte nosnost", "Celková hmotnost věcí ÷ počet polic = zatížení na polici. Nesmí přesáhnout 175 kg."),
             ("Objednejte s rezervou", "Doporučujeme objednat o 1 regál více pro budoucí potřeby."),
         ],
         "checklist": ["Prostor změřen", "Počet regálů spočítán", "Nosnost ověřena", "Rozpočet schválen", "Objednáno"],
         "cat": "Kalkulačka"},
    ]

    pages = []
    for tmpl in templates:
        slug = tmpl["slug"]

        steps_html = ""
        for i, (step_title, step_desc) in enumerate(tmpl["steps"]):
            steps_html += f'''
            <div class="flex gap-4 bg-white rounded-xl p-5 shadow-sm">
                <div class="w-10 h-10 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">{i+1}</div>
                <div><h3 class="font-bold mb-1">{step_title}</h3><p class="text-gray-600">{step_desc}</p></div>
            </div>'''

        checklist_html = "".join(f'''
            <li class="flex items-center gap-3 bg-white rounded-lg p-3">
                <input type="checkbox" class="w-5 h-5 rounded border-gray-300">
                <span>{item}</span>
            </li>''' for item in tmpl["checklist"])

        body = f'''
        <p class="text-xl text-gray-600 mb-8">Kompletní šablona krok za krokem. Postupujte podle návodu a budete mít dokonale organizovaný prostor.</p>

        <h2 class="text-2xl font-bold mb-4">Postup – krok za krokem</h2>
        <div class="space-y-4 mb-8">{steps_html}</div>

        <h2 class="text-2xl font-bold mb-4">Kontrolní seznam</h2>
        <div class="bg-gray-50 rounded-xl p-6 mb-8">
            <p class="text-sm text-gray-500 mb-4">Zaškrtávejte splněné body:</p>
            <ul class="space-y-3">{checklist_html}</ul>
        </div>

        <h2 class="text-2xl font-bold mb-4">Doporučené regály</h2>
        {get_product_cards(PRODUCTS[:4], 4)}

        <h2 class="text-2xl font-bold mb-4">Tipy od profesionálů</h2>
        <div class="grid md:grid-cols-2 gap-4 mb-8">
            <div class="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
                <h3 class="font-bold mb-2">Tip: Měřte dvakrát</h3>
                <p class="text-sm text-gray-600">Vždy si prostor změřte dvakrát. Nechte min. 5 cm rezervu od stropu a stěn.</p>
            </div>
            <div class="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
                <h3 class="font-bold mb-2">Tip: Těžké dolů</h3>
                <p class="text-sm text-gray-600">Nejtěžší předměty vždy na spodní police. Zvýšíte stabilitu a bezpečnost.</p>
            </div>
        </div>

        <h2 class="text-2xl font-bold mb-4">Časté otázky</h2>
        <div class="space-y-4 mb-8">
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Kolik regálů budu potřebovat?</h3>
                <p class="text-gray-600">Záleží na velikosti prostoru. Změřte délku stěny a vydělte šířkou regálu (40–120 cm).</p>
            </div>
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Jaký regál je nejuniverzálnější?</h3>
                <p class="text-gray-600">Regál 180×90×40 cm je náš bestseller. Vejde se téměř všude a nabízí 5 polic s nosností 875 kg.</p>
            </div>
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Potřebuji nářadí na montáž?</h3>
                <p class="text-gray-600">Ne, naše regály mají bezšroubovou montáž. Žádné nářadí není potřeba.</p>
            </div>
        </div>

        <h2 class="text-2xl font-bold mb-4">Další šablony a stránky</h2>
        {_internal_links(slug)}
        '''

        pages.append({
            "slug": slug,
            "title": tmpl["title"] + " | Bazarovyregal.cz",
            "meta_desc": f"{tmpl['title']}. Praktický návod krok za krokem s kontrolním seznamem. Doporučení od profesionálů.",
            "h1": tmpl["title"],
            "body_html": body,
            "breadcrumb_category": tmpl["cat"],
            "playbook_type": "templates",
        })
    return pages


if __name__ == "__main__":
    pages = generate_comparison_pages() + generate_curation_pages() + generate_template_pages()
    print(f"Generated {len(pages)} pages")
    for p in pages:
        print(f"  {p['slug']}.html - {p['playbook_type']}")
