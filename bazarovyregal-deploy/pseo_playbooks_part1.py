#!/usr/bin/env python3
"""pSEO Playbooks Part 1: Locations, Personas, Glossary"""

from pseo_config import LOCATIONS, PERSONAS, GLOSSARY_TERMS, PRODUCTS, IMAGES, CATEGORIES, EXISTING_PAGES
from pseo_html_template import get_product_cards


def _internal_links(exclude_slug, count=6):
    links = []
    for p in EXISTING_PAGES:
        if p["slug"] != exclude_slug and len(links) < count:
            links.append(f'<li><a href="{p["slug"]}.html" class="text-primary-600 hover:underline">{p["title"]}</a></li>')
    return '<ul class="grid sm:grid-cols-2 gap-2 mt-4 mb-8">' + "".join(links) + "</ul>"


def generate_location_pages():
    pages = []
    for loc in LOCATIONS:
        slug = f"kovove-regaly-{loc['id']}"
        city = loc["name"]
        region = loc["region"]
        pop = loc["population"]

        body = f'''
        <p class="text-xl text-gray-600 mb-8">Hledáte kovové regály v {city} a okolí? Nabízíme kvalitní kovové regály s dopravou přímo k vám.
        Slevy až 75 %, záruka 7 let, expedice ihned. Obsluhujeme celý {region} kraj.</p>

        <div class="bg-green-50 border border-green-200 rounded-xl p-6 mb-8">
            <h2 class="text-xl font-bold text-green-800 mb-2">Doprava do {city}</h2>
            <p class="text-green-700">Doručujeme přepravní službou přímo na vaši adresu v {city} ({loc["postal"]}) a okolí.
            Doprava od 99 Kč, doručení obvykle do 2–3 pracovních dnů. Expedujeme ihned ze skladu.</p>
        </div>

        <h2 class="text-2xl font-bold mb-4">Proč nakoupit regály u nás v {city}?</h2>
        <div class="grid md:grid-cols-2 gap-6 mb-8">
            <div class="bg-white rounded-xl p-6 shadow-sm">
                <h3 class="font-bold mb-2">Nejnižší ceny na trhu</h3>
                <p class="text-gray-600">Díky likvidaci skladu nabízíme regály od 549 Kč. To je cena, kterou nenajdete
                ani na bazaru v {city}. A naše regály jsou 100 % nové.</p>
            </div>
            <div class="bg-white rounded-xl p-6 shadow-sm">
                <h3 class="font-bold mb-2">Rychlé doručení do {region}ho kraje</h3>
                <p class="text-gray-600">Objednáte dnes, expedujeme ihned. Doručení na adresu v {city}
                a okolí do 2–3 pracovních dnů přepravní službou.</p>
            </div>
            <div class="bg-white rounded-xl p-6 shadow-sm">
                <h3 class="font-bold mb-2">Záruka 7 let</h3>
                <p class="text-gray-600">Na všechny regály poskytujeme plnou záruku 7 let.
                Reklamace vyřídíme rychle a bez problémů.</p>
            </div>
            <div class="bg-white rounded-xl p-6 shadow-sm">
                <h3 class="font-bold mb-2">Snadná montáž bez nářadí</h3>
                <p class="text-gray-600">Bezšroubová montáž za 10 minut. Nepotřebujete řemeslníka –
                zvládnete to sami.</p>
            </div>
        </div>

        <h2 class="text-2xl font-bold mb-4">Nejprodávanější regály v {city}</h2>
        {get_product_cards(PRODUCTS, 4)}

        <h2 class="text-2xl font-bold mb-4">Kde v {city} regály využijete?</h2>
        <div class="space-y-3 mb-8">
            <p class="text-gray-600">Naši zákazníci z {city} nejčastěji objednávají regály do těchto prostor:</p>
            <ul class="space-y-2">
                <li class="flex items-start gap-2"><span class="text-primary-500">&#10003;</span> <strong>Garáž</strong> – organizace nářadí, pneumatik, sportovního vybavení</li>
                <li class="flex items-start gap-2"><span class="text-primary-500">&#10003;</span> <strong>Sklep</strong> – zavařeniny, víno, sezónní věci (doporučujeme zinkované regály)</li>
                <li class="flex items-start gap-2"><span class="text-primary-500">&#10003;</span> <strong>Dílna</strong> – těžké nářadí, materiál, profesionální organizace</li>
                <li class="flex items-start gap-2"><span class="text-primary-500">&#10003;</span> <strong>Kancelář a sklad</strong> – dokumenty, šanony, skladové zásoby</li>
                <li class="flex items-start gap-2"><span class="text-primary-500">&#10003;</span> <strong>Domácnost</strong> – spíž, komora, šatna, dětský pokoj</li>
            </ul>
        </div>

        <h2 class="text-2xl font-bold mb-4">Často kladené otázky – regály {city}</h2>
        <div class="space-y-4 mb-8">
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Jak dlouho trvá doručení do {city}?</h3>
                <p class="text-gray-600">Expedujeme ihned po objednání. Doručení na adresu v {city} trvá obvykle 2–3 pracovní dny přepravní službou.</p>
            </div>
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Mohu si regál vyzvednout osobně?</h3>
                <p class="text-gray-600">Momentálně nabízíme pouze doručení přepravní službou. Doprava do {city} stojí od 99 Kč.</p>
            </div>
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Jaký regál doporučujete pro garáž v {city}?</h3>
                <p class="text-gray-600">Pro garáž doporučujeme regál 180×90×40 cm v černé nebo zinkované variantě. Nosnost 875 kg, cena od 649 Kč.</p>
            </div>
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Nabízíte množstevní slevy pro firmy v {city}?</h3>
                <p class="text-gray-600">Ano, pro větší objednávky nabízíme individuální cenovou nabídku. Kontaktujte nás na info@bazarovyregal.cz.</p>
            </div>
        </div>

        <h2 class="text-2xl font-bold mb-4">Další užitečné stránky</h2>
        {_internal_links(slug)}
        '''

        pages.append({
            "slug": slug,
            "title": f"Kovové regály {city} | Doprava od 99 Kč | Bazarovyregal.cz",
            "meta_desc": f"Kovové regály v {city} se slevou až 75 %. Doprava od 99 Kč, záruka 7 let. Regály do garáže, sklepa, dílny. Expedice ihned.",
            "h1": f"Kovové regály {city} – slevy až 75 %, doprava od 99 Kč",
            "body_html": body,
            "breadcrumb_category": "Lokality",
            "playbook_type": "locations",
        })
    return pages


def generate_persona_pages():
    pages = []
    for persona in PERSONAS:
        slug = persona["slug"]
        title_text = persona["title"]
        name = persona["name"]

        pain_items = "".join(f'<li class="flex items-start gap-2"><span class="text-red-500 text-lg">&#10007;</span> <span>{p}</span></li>' for p in persona["pain_points"])
        solution_items = "".join(f'<li class="flex items-start gap-2"><span class="text-green-500 text-lg">&#10003;</span> <span>{s}</span></li>' for s in persona["solutions"])

        rec_products = [p for p in PRODUCTS if p["url"] in persona.get("recommended_products", [])]
        if not rec_products:
            rec_products = PRODUCTS[:4]

        body = f'''
        <p class="text-xl text-gray-600 mb-8">Jste {name.lower()}? Pak víte, jak důležitá je správná organizace prostoru.
        Naše kovové regály jsou navrženy přesně pro vaše potřeby – vysoká nosnost, snadná montáž a ceny, které nepotká konkurence.</p>

        <h2 class="text-2xl font-bold mb-4">S čím se potýkáte?</h2>
        <div class="bg-red-50 border border-red-200 rounded-xl p-6 mb-8">
            <ul class="space-y-3">{pain_items}</ul>
        </div>

        <h2 class="text-2xl font-bold mb-4">Jak to řešíme</h2>
        <div class="bg-green-50 border border-green-200 rounded-xl p-6 mb-8">
            <ul class="space-y-3">{solution_items}</ul>
        </div>

        <h2 class="text-2xl font-bold mb-4">Proč jsou naše regály ideální pro {name.lower().split()[0]}?</h2>
        <div class="grid md:grid-cols-3 gap-6 mb-8">
            <div class="bg-white rounded-xl p-6 shadow-sm text-center">
                <div class="text-3xl mb-3">&#128176;</div>
                <h3 class="font-bold mb-2">Ceny od 549 Kč</h3>
                <p class="text-sm text-gray-600">Slevy až 75 % díky likvidaci skladu. Nové zboží za cenu bazaru.</p>
            </div>
            <div class="bg-white rounded-xl p-6 shadow-sm text-center">
                <div class="text-3xl mb-3">&#9889;</div>
                <h3 class="font-bold mb-2">Montáž za 10 min</h3>
                <p class="text-sm text-gray-600">Bezšroubový systém. Žádné nářadí, žádný stres.</p>
            </div>
            <div class="bg-white rounded-xl p-6 shadow-sm text-center">
                <div class="text-3xl mb-3">&#128170;</div>
                <h3 class="font-bold mb-2">Nosnost až 1050 kg</h3>
                <p class="text-sm text-gray-600">Profesionální regály pro náročné použití.</p>
            </div>
        </div>

        <h2 class="text-2xl font-bold mb-4">Doporučené regály pro {name.lower()}</h2>
        {get_product_cards(rec_products, 4)}

        <h2 class="text-2xl font-bold mb-4">Jak vybrat správný regál?</h2>
        <div class="space-y-3 mb-8">
            <p class="text-gray-600">Při výběru regálu zvažte tyto faktory:</p>
            <ol class="space-y-2 list-decimal list-inside text-gray-600">
                <li><strong>Prostor</strong> – změřte si místo, kam regál umístíte (výška, šířka, hloubka)</li>
                <li><strong>Nosnost</strong> – zvažte, co budete na regál ukládat a jakou hmotnost to představuje</li>
                <li><strong>Prostředí</strong> – do vlhkých prostor volte zinkovaný povrch</li>
                <li><strong>Počet polic</strong> – regály 180 cm a vyšší mají 5 polic, regál 150 cm má 4 police</li>
                <li><strong>Rozpočet</strong> – naše ceny začínají na 549 Kč za kompletní regál</li>
            </ol>
        </div>

        <h2 class="text-2xl font-bold mb-4">Časté dotazy</h2>
        <div class="space-y-4 mb-8">
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Jaký regál je nejlepší pro {name.lower()}?</h3>
                <p class="text-gray-600">Záleží na konkrétním využití. Pro většinu potřeb doporučujeme bestseller – regál 180×90×40 cm s nosností 875 kg za 739 Kč.</p>
            </div>
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Zvládnu montáž sám/sama?</h3>
                <p class="text-gray-600">Bezšroubová montáž je navržena tak, aby ji zvládl kdokoli za 10 minut bez nářadí. Máme i video návod.</p>
            </div>
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Lze regály později rozšířit?</h3>
                <p class="text-gray-600">Ano, náš modulární systém umožňuje přidávat další regály vedle sebe. Stačí dokoupit další kus.</p>
            </div>
        </div>

        <h2 class="text-2xl font-bold mb-4">Související stránky</h2>
        {_internal_links(slug)}
        '''

        pages.append({
            "slug": slug,
            "title": f"{title_text} | Bazarovyregal.cz",
            "meta_desc": f"{title_text}. Kovové regály se slevou až 75 %, záruka 7 let, montáž za 10 minut. Od 549 Kč.",
            "h1": title_text,
            "body_html": body,
            "breadcrumb_category": "Pro koho",
            "playbook_type": "personas",
        })
    return pages


def generate_glossary_pages():
    pages = []
    for term in GLOSSARY_TERMS:
        slug = term["slug"]
        term_name = term["term"]
        definition = term["definition"]
        detail = term["detail"]
        related = term.get("related", [])

        related_links = ""
        for r in related:
            matching = [t for t in GLOSSARY_TERMS if t["id"] == r]
            if matching:
                related_links += f'<a href="{matching[0]["slug"]}.html" class="inline-block bg-primary-50 text-primary-700 px-4 py-2 rounded-lg hover:bg-primary-100 text-sm font-medium">{matching[0]["term"]}</a> '

        body = f'''
        <div class="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
            <h2 class="text-lg font-bold text-blue-800 mb-2">Definice: {term_name}</h2>
            <p class="text-blue-700 text-lg">{definition}</p>
        </div>

        <h2 class="text-2xl font-bold mb-4">Podrobné vysvětlení</h2>
        <div class="text-gray-600 space-y-4 mb-8">
            <p>{detail}</p>
        </div>

        <h2 class="text-2xl font-bold mb-4">Proč je to důležité?</h2>
        <p class="text-gray-600 mb-8">Pochopení pojmu „{term_name.lower()}" vám pomůže správně vybrat regál
        a bezpečně ho používat. Při výběru kovového regálu je důležité znát základní parametry,
        abyste zvolili produkt odpovídající vašim potřebám.</p>

        <h2 class="text-2xl font-bold mb-4">Doporučené produkty</h2>
        {get_product_cards(PRODUCTS[:4], 4)}

        <h2 class="text-2xl font-bold mb-4">Související pojmy</h2>
        <div class="flex flex-wrap gap-3 mb-8">
            {related_links}
            <a href="slovnik.html" class="inline-block bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 text-sm font-medium">Celý slovník</a>
        </div>

        <h2 class="text-2xl font-bold mb-4">Často kladené otázky</h2>
        <div class="space-y-4 mb-8">
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Co přesně znamená {term_name.lower()}?</h3>
                <p class="text-gray-600">{definition}</p>
            </div>
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Jak to ovlivňuje výběr regálu?</h3>
                <p class="text-gray-600">Tento parametr je jedním z klíčových faktorů při výběru správného regálu.
                Doporučujeme konzultovat naše produktové stránky nebo kontaktovat náš tým na info@bazarovyregal.cz.</p>
            </div>
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Kde najdu další informace?</h3>
                <p class="text-gray-600">Podívejte se na náš kompletní <a href="slovnik.html" class="text-primary-600 hover:underline">slovník pojmů</a>
                nebo <a href="faq.html" class="text-primary-600 hover:underline">FAQ sekci</a>.</p>
            </div>
        </div>

        <h2 class="text-2xl font-bold mb-4">Další stránky</h2>
        {_internal_links(slug)}
        '''

        pages.append({
            "slug": slug,
            "title": f"{term_name} – co to je a proč je důležitá | Bazarovyregal.cz",
            "meta_desc": f"{term_name}: {definition[:140]}",
            "h1": f"{term_name} – vysvětlení pojmu",
            "body_html": body,
            "breadcrumb_category": "Slovník",
            "playbook_type": "glossary",
        })
    return pages


if __name__ == "__main__":
    pages = generate_location_pages() + generate_persona_pages() + generate_glossary_pages()
    print(f"Generated {len(pages)} pages")
    for p in pages:
        print(f"  {p['slug']}.html - {p['playbook_type']}")
