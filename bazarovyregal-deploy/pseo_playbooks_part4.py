#!/usr/bin/env python3
"""pSEO Playbooks Part 4: Conversions, Translations, Integrations"""

from pseo_config import PRODUCTS, CATEGORIES, LOCATIONS, EXISTING_PAGES, IMAGES, BASE_URL
from pseo_html_template import get_product_cards


def _internal_links(exclude_slug, count=6):
    links = []
    for p in EXISTING_PAGES:
        if p["slug"] != exclude_slug and len(links) < count:
            links.append(f'<li><a href="{p["slug"]}.html" class="text-primary-600 hover:underline">{p["title"]}</a></li>')
    return '<ul class="grid sm:grid-cols-2 gap-2 mt-4 mb-8">' + "".join(links) + "</ul>"


# ============================================================
# CONVERSIONS PLAYBOOK
# High-intent pages targeting purchase/action keywords
# ============================================================
def generate_conversion_pages():
    conversions = [
        {
            "slug": "koupit-kovovy-regal-online",
            "title": "Koupit kovový regál online – nejnižší ceny na trhu",
            "h1": "Koupit kovový regál online – slevy až 75 %",
            "intent": "purchase",
            "intro": "Hledáte kde koupit kovový regál za nejlepší cenu? U nás nakoupíte nové kovové regály se slevou až 75 % díky likvidaci skladu. Expedice ihned, doprava od 99 Kč.",
            "urgency": "Likvidace skladu – platí do vyprodání zásob. Aktuálně skladem přes 500 kusů.",
            "cta_text": "Objednat nyní se slevou",
            "benefits": [
                ("Slevy až 75 %", "Díky likvidaci skladu nabízíme nové regály za zlomek původní ceny. Běžná cena regálu je 2 500 Kč, u nás od 549 Kč."),
                ("100 % nové zboží", "Nejde o bazarové regály. Každý kus je nový, zabalený v originálním kartonu, se zárukou 7 let."),
                ("Expedice ihned", "Objednáte dnes, expedujeme ještě dnes. Doručení přepravní službou za 2–3 pracovní dny."),
                ("Bezšroubová montáž", "Žádné nářadí, žádný řemeslník. Regál sestavíte sami za 10 minut."),
            ],
        },
        {
            "slug": "levne-kovove-regaly-vyprodej",
            "title": "Levné kovové regály – výprodej skladu od 549 Kč",
            "h1": "Levné kovové regály – výprodej od 549 Kč",
            "intent": "price",
            "intro": "Nejlevnější kovové regály na českém trhu. Nové zboží z likvidace skladu za ceny, které nenajdete ani na bazaru. Od 549 Kč za kompletní regál se zárukou.",
            "urgency": "Výprodej probíhá – zásoby jsou omezené. Nejprodávanější modely se vyprodávají nejrychleji.",
            "cta_text": "Zobrazit nejlevnější regály",
            "benefits": [
                ("Od 549 Kč", "Kompletní kovový regál se 4 policemi a nosností 700 kg. Levnější než většina bazarových regálů."),
                ("Porovnáno s konkurencí", "Běžná cena v hobbymarketech: 1 500–3 000 Kč. U nás stejný regál od 549 Kč."),
                ("Žádné skryté náklady", "Cena zahrnuje kompletní regál včetně všech polic. Doprava od 99 Kč."),
                ("Záruka 7 let", "I za nejnižší cenu dostáváte plnou záruku 7 let na celý regál."),
            ],
        },
        {
            "slug": "kovove-regaly-akce-sleva",
            "title": "Kovové regály v akci – aktuální slevy a nabídky",
            "h1": "Kovové regály v akci – aktuální slevy až 75 %",
            "intent": "deal",
            "intro": "Přehled aktuálních akcí a slev na kovové regály. Likvidace skladu = trvalé slevy až 75 % na celý sortiment. Nové zboží, plná záruka, expedice ihned.",
            "urgency": "Akce platí do vyprodání zásob. Při objednávce 3+ regálů další sleva na dopravu.",
            "cta_text": "Využít akční nabídku",
            "benefits": [
                ("Trvalé slevy 50–75 %", "Nejde o krátkodobou akci. Díky likvidaci skladu jsou ceny trvale snížené."),
                ("Množstevní slevy", "Při objednávce 3 a více regálů vám připravíme individuální cenovou nabídku."),
                ("Doprava zvýhodněna", "Standardní doprava od 99 Kč. Při větší objednávce sleva na dopravu."),
                ("Vše skladem", "Všechny velikosti a barvy ihned k expedici. Žádné čekání na naskladnění."),
            ],
        },
        {
            "slug": "kovove-regaly-s-dopravou-zdarma",
            "title": "Kovové regály s výhodnou dopravou – od 99 Kč po celé ČR",
            "h1": "Kovové regály s dopravou od 99 Kč po celé ČR",
            "intent": "shipping",
            "intro": "Objednejte kovové regály s rychlou a cenově dostupnou dopravou. Doručujeme přepravní službou po celé České republice. Expedice ihned, doručení do 2–3 dnů.",
            "urgency": "Objednáte dnes, expedujeme ještě dnes. Doručení kdekoliv v ČR do 2–3 pracovních dnů.",
            "cta_text": "Objednat s rychlou dopravou",
            "benefits": [
                ("Doprava od 99 Kč", "Cenově dostupná doprava přepravní službou po celé ČR. Bez ohledu na místo doručení."),
                ("Expedice v den objednání", "Objednávky přijaté do 14:00 expedujeme ještě týž den."),
                ("Doručení do 2–3 dnů", "Standardní doba doručení přepravní službou je 2–3 pracovní dny."),
                ("Bezpečné balení", "Regály jsou zabaleny v pevném kartonu, který chrání před poškozením při přepravě."),
            ],
        },
        {
            "slug": "kovove-regaly-se-zarukou",
            "title": "Kovové regály se zárukou 7 let – kvalita ověřena tisíci zákazníky",
            "h1": "Kovové regály se zárukou 7 let",
            "intent": "trust",
            "intro": "Každý náš regál má plnou záruku 7 let. Kvalita ověřena tisíci spokojených zákazníků s hodnocením 4.9/5. Certifikovaná nosnost, bezpečná konstrukce.",
            "urgency": "Přes 15 000 prodaných regálů. Hodnocení 4.9/5 na základě 2 847 recenzí.",
            "cta_text": "Vybrat regál se zárukou",
            "benefits": [
                ("Záruka 7 let", "Plná záruka na celý regál včetně všech dílů. Reklamace vyřídíme rychle a bez problémů."),
                ("Certifikovaná nosnost", "Nosnost každého regálu je testována nezávislou laboratoří. 175–210 kg na polici."),
                ("4.9/5 hodnocení", "Na základě 2 847 ověřených recenzí od skutečných zákazníků."),
                ("Profesionální kvalita", "Ocelová konstrukce tloušťky 1,5 mm. Žádný plast, žádné kompromisy."),
            ],
        },
        {
            "slug": "regaly-pro-firmy-velkoobchod",
            "title": "Regály pro firmy – velkoobchodní ceny, množstevní slevy",
            "h1": "Regály pro firmy – velkoobchodní ceny od 499 Kč/ks",
            "intent": "b2b",
            "intro": "Vybavte firemní sklad, dílnu nebo kancelář profesionálními regály za velkoobchodní ceny. Množstevní slevy, fakturace na IČO, individuální nabídky.",
            "urgency": "Pro objednávky nad 10 kusů připravíme individuální cenovou nabídku. Kontaktujte nás na info@bazarovyregal.cz.",
            "cta_text": "Získat firemní nabídku",
            "benefits": [
                ("Velkoobchodní ceny", "Od 10 kusů výrazně zvýhodněné ceny. Individuální nabídka pro větší objednávky."),
                ("Fakturace na IČO", "Plnohodnotný daňový doklad. Možnost platby převodem s odloženou splatností."),
                ("Profesionální řada", "Regály s nosností 875–1050 kg pro náročné firemní prostředí."),
                ("Konzultace zdarma", "Pomůžeme vám s výběrem a rozmístěním regálů pro váš sklad. Napište na info@bazarovyregal.cz."),
            ],
        },
        {
            "slug": "objednat-regal-bez-registrace",
            "title": "Objednat regál rychle – bez registrace, expedice ihned",
            "h1": "Objednat regál – bez registrace, doručení do 3 dnů",
            "intent": "quick_buy",
            "intro": "Jednoduchá objednávka bez nutnosti registrace. Vyberte regál, vyplňte adresu, zaplaťte. Expedice ihned, doručení do 2–3 pracovních dnů. Vrácení do 14 dnů.",
            "urgency": "Celý proces objednávky zabere méně než 2 minuty. Platba kartou, převodem nebo na dobírku.",
            "cta_text": "Objednat nyní",
            "benefits": [
                ("Bez registrace", "Žádné zakládání účtu. Objednáte během 2 minut."),
                ("3 způsoby platby", "Kartou online, bankovním převodem nebo na dobírku při doručení."),
                ("Vrácení do 14 dnů", "Pokud vám regál nevyhovuje, můžete ho vrátit do 14 dnů bez udání důvodu."),
                ("Sledování zásilky", "Po expedici obdržíte číslo zásilky pro sledování v reálném čase."),
            ],
        },
    ]

    pages = []
    for conv in conversions:
        slug = conv["slug"]

        benefits_html = ""
        for b_title, b_desc in conv["benefits"]:
            benefits_html += f'''
            <div class="bg-white rounded-xl p-6 shadow-sm">
                <h3 class="font-bold text-lg mb-2">{b_title}</h3>
                <p class="text-gray-600">{b_desc}</p>
            </div>'''

        # Price comparison table for price-intent pages
        price_table = ""
        if conv["intent"] in ("price", "purchase", "deal"):
            rows = ""
            for p in sorted(PRODUCTS, key=lambda x: x["price"])[:6]:
                badge = ' <span class="bg-primary-500 text-white text-xs px-2 py-1 rounded ml-2">Nejlevnější</span>' if p["price"] == 549 else ""
                rows += f'''
                <tr class="border-b hover:bg-gray-50">
                    <td class="py-3 px-4"><a href="{p['url']}" class="text-primary-600 hover:underline font-medium">{p['name']}</a>{badge}</td>
                    <td class="py-3 px-4 text-right"><span class="text-gray-400 line-through text-sm">{p['price']*4} Kč</span></td>
                    <td class="py-3 px-4 text-right font-bold text-primary-600 text-lg">{p['price']} Kč</td>
                    <td class="py-3 px-4 text-right text-green-600 font-medium">-{75 if p.get('bestseller') else 70}%</td>
                </tr>'''
            price_table = f'''
            <h2 class="text-2xl font-bold mb-4">Přehled cen</h2>
            <div class="overflow-x-auto mb-8">
                <table class="w-full bg-white rounded-xl shadow-sm">
                    <thead class="bg-gray-50">
                        <tr><th class="py-3 px-4 text-left">Produkt</th><th class="py-3 px-4 text-right">Běžná cena</th><th class="py-3 px-4 text-right">Naše cena</th><th class="py-3 px-4 text-right">Sleva</th></tr>
                    </thead>
                    <tbody>{rows}</tbody>
                </table>
            </div>'''

        # Trust signals
        trust_html = '''
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div class="bg-white rounded-xl p-4 shadow-sm text-center">
                <div class="text-2xl font-bold text-primary-600">15 000+</div>
                <div class="text-xs text-gray-500">Prodaných regálů</div>
            </div>
            <div class="bg-white rounded-xl p-4 shadow-sm text-center">
                <div class="text-2xl font-bold text-primary-600">4.9/5</div>
                <div class="text-xs text-gray-500">Hodnocení</div>
            </div>
            <div class="bg-white rounded-xl p-4 shadow-sm text-center">
                <div class="text-2xl font-bold text-primary-600">7 let</div>
                <div class="text-xs text-gray-500">Záruka</div>
            </div>
            <div class="bg-white rounded-xl p-4 shadow-sm text-center">
                <div class="text-2xl font-bold text-primary-600">2–3 dny</div>
                <div class="text-xs text-gray-500">Doručení</div>
            </div>
        </div>'''

        body = f'''
        <p class="text-xl text-gray-600 mb-8">{conv["intro"]}</p>

        <div class="bg-red-50 border border-red-200 rounded-xl p-6 mb-8">
            <div class="flex items-center gap-3">
                <span class="text-red-500 text-2xl">&#9888;</span>
                <p class="text-red-700 font-medium">{conv["urgency"]}</p>
            </div>
        </div>

        {trust_html}

        <h2 class="text-2xl font-bold mb-4">Proč nakoupit u nás?</h2>
        <div class="grid md:grid-cols-2 gap-6 mb-8">{benefits_html}</div>

        {price_table}

        <h2 class="text-2xl font-bold mb-4">Naše nejprodávanější regály</h2>
        {get_product_cards(PRODUCTS[:4], 4)}

        <div class="bg-gradient-to-r from-green-500 to-green-600 rounded-2xl p-8 mb-8 text-white text-center">
            <h2 class="text-2xl font-bold mb-3">{conv["cta_text"]}</h2>
            <p class="mb-6 text-white/90">Vyberte si z nabídky a objednejte ještě dnes. Expedice ihned.</p>
            <a href="katalog.html" class="inline-block bg-white text-green-600 px-8 py-3 rounded-xl font-bold hover:bg-gray-100 transition">{conv["cta_text"]}</a>
        </div>

        <h2 class="text-2xl font-bold mb-4">Často kladené otázky</h2>
        <div class="space-y-4 mb-8">
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Jsou regály opravdu nové?</h3>
                <p class="text-gray-600">Ano, 100 % nové zboží v originálním balení. Nízká cena je díky likvidaci skladu, ne kvůli kvalitě.</p>
            </div>
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Jak rychle doručíte?</h3>
                <p class="text-gray-600">Objednávky expedujeme v den přijetí. Doručení přepravní službou do 2–3 pracovních dnů kdekoliv v ČR.</p>
            </div>
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Mohu regál vrátit?</h3>
                <p class="text-gray-600">Samozřejmě. Máte 14 dní na vrácení bez udání důvodu dle zákona o ochraně spotřebitele.</p>
            </div>
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Jak objednat?</h3>
                <p class="text-gray-600">Vyberte regál v katalogu, klikněte na „Objednat" a vyplňte doručovací údaje. Celý proces trvá 2 minuty.</p>
            </div>
        </div>

        <h2 class="text-2xl font-bold mb-4">Další stránky</h2>
        {_internal_links(slug)}
        '''

        pages.append({
            "slug": slug,
            "title": conv["title"] + " | Bazarovyregal.cz",
            "meta_desc": conv["intro"][:155],
            "h1": conv["h1"],
            "body_html": body,
            "breadcrumb_category": "Nákup",
            "playbook_type": "conversions",
        })
    return pages


# ============================================================
# TRANSLATIONS PLAYBOOK
# Slovak language variants for Slovak search market
# ============================================================
def generate_translation_pages():
    translations = [
        {
            "slug": "kovove-regale-slovensko",
            "title": "Kovové regále – dodávka na Slovensko | Bazarovyregal.cz",
            "h1": "Kovové regále – objednajte s dodávkou na Slovensko",
            "intro": "Hľadáte kvalitné kovové regále za najnižšie ceny? Dodávame aj na Slovensko! Zľavy až 75 %, záruka 7 rokov, nové regále z likvidácie skladu.",
            "faq": [
                ("Dodávate na Slovensko?", "Áno, dodávame prepravnou službou na celé Slovensko. Dodacia lehota je 3–5 pracovných dní."),
                ("Aké sú náklady na dopravu na Slovensko?", "Doprava na Slovensko stojí od 199 Kč (cca 8 EUR). Presná cena závisí od počtu objednaných regálov."),
                ("Môžem platiť v eurách?", "Ceny sú uvedené v CZK, platba prebieha v CZK. Pri platbe kartou sa suma automaticky prepočíta."),
                ("Platí záruka aj na Slovensku?", "Áno, plná záruka 7 rokov platí bez obmedzenia aj na Slovensku."),
            ],
            "extra_content": """
            <h2 class="text-2xl font-bold mb-4">Dodávka na Slovensko</h2>
            <div class="grid md:grid-cols-3 gap-6 mb-8">
                <div class="bg-white rounded-xl p-6 shadow-sm text-center">
                    <div class="text-3xl mb-3">&#128666;</div>
                    <h3 class="font-bold mb-2">Preprava</h3>
                    <p class="text-sm text-gray-600">Doručenie prepravnou službou na celé Slovensko. 3–5 pracovných dní.</p>
                </div>
                <div class="bg-white rounded-xl p-6 shadow-sm text-center">
                    <div class="text-3xl mb-3">&#128176;</div>
                    <h3 class="font-bold mb-2">Ceny</h3>
                    <p class="text-sm text-gray-600">Rovnaké zľavnené ceny ako pre ČR. Od 549 Kč (cca 22 EUR).</p>
                </div>
                <div class="bg-white rounded-xl p-6 shadow-sm text-center">
                    <div class="text-3xl mb-3">&#128274;</div>
                    <h3 class="font-bold mb-2">Záruka</h3>
                    <p class="text-sm text-gray-600">Plná záruka 7 rokov platí aj na Slovensku.</p>
                </div>
            </div>

            <h2 class="text-2xl font-bold mb-4">Najpredávanejšie regále</h2>
            <div class="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
                <p class="text-blue-700">Slovenský zákazníci najčastejšie objednávajú regále 180×90×40 cm v čiernej alebo zinkovanej verzii.
                Tieto modely sú univerzálne a hodia sa do garáže, pivnice, dielne aj kancelárie.</p>
            </div>
            """,
        },
        {
            "slug": "regale-do-garaze-slovensko",
            "title": "Regále do garáže – dodávka na Slovensko | Bazarovyregal.cz",
            "h1": "Regále do garáže – objednajte s dodávkou na Slovensko",
            "intro": "Kovové regále do garáže za najnižšie ceny. Nosnosť až 875 kg, odolné voči vlhkosti. Dodávame na celé Slovensko za 3–5 dní.",
            "faq": [
                ("Aký regál odporúčate do garáže?", "Pre garáž odporúčame regál 180×90×40 cm v zinkovanom prevedení – odolný voči vlhkosti a korózii."),
                ("Unesie regál pneumatiky?", "Áno, naše regále majú nosnosť 175 kg na policu. 4 pneumatiky vážia cca 40 kg – žiadny problém."),
                ("Potrebujem náradie na montáž?", "Nie, regále majú bezskrutkovú montáž. Poskladáte ich za 10 minút bez náradia."),
            ],
            "extra_content": """
            <h2 class="text-2xl font-bold mb-4">Prečo kovový regál do garáže?</h2>
            <div class="grid md:grid-cols-2 gap-6 mb-8">
                <div class="bg-white rounded-xl p-6 shadow-sm">
                    <h3 class="font-bold mb-2">Vysoká nosnosť</h3>
                    <p class="text-gray-600">Až 175 kg na policu, celkom 875 kg na regál. Bez problémov unesie náradie, pneumatiky aj ťažký materiál.</p>
                </div>
                <div class="bg-white rounded-xl p-6 shadow-sm">
                    <h3 class="font-bold mb-2">Odolnosť voči vlhkosti</h3>
                    <p class="text-gray-600">Zinkované prevedenie chráni pred koróziou. Ideálne do vlhkej garáže.</p>
                </div>
                <div class="bg-white rounded-xl p-6 shadow-sm">
                    <h3 class="font-bold mb-2">Jednoduchá montáž</h3>
                    <p class="text-gray-600">Bezskrutková montáž za 10 minút. Žiadne náradie nie je potrebné.</p>
                </div>
                <div class="bg-white rounded-xl p-6 shadow-sm">
                    <h3 class="font-bold mb-2">Najnižšie ceny</h3>
                    <p class="text-gray-600">Likvidácia skladu – nové regále od 549 Kč (cca 22 EUR). Zľavy až 75 %.</p>
                </div>
            </div>
            """,
        },
        {
            "slug": "regale-do-pivnice-slovensko",
            "title": "Regále do pivnice – zinkované, odolné vlhkosti | Bazarovyregal.cz",
            "h1": "Regále do pivnice – zinkované regále s dodávkou na Slovensko",
            "intro": "Zinkované kovové regále ideálne do vlhkej pivnice. Odolné voči korózii, nosnosť až 875 kg. Dodávame na celé Slovensko.",
            "faq": [
                ("Prečo zinkovaný regál do pivnice?", "Pivnica je vlhký priestor. Zinkovaný povrch chráni oceľ pred hrdzou a koróziou na 20+ rokov."),
                ("Koľko regálov potrebujem do pivnice?", "Závisí od veľkosti pivnice. Zmerajte dĺžku steny a vydeľte šírkou regálu (70 alebo 90 cm)."),
                ("Dá sa regál ukotviť k stene?", "Áno, regály je možné ukotviť k stene pre zvýšenú stabilitu. Odporúčame to najmä v pivniciach."),
            ],
            "extra_content": """
            <h2 class="text-2xl font-bold mb-4">Zinkované regále – odolnosť bez kompromisov</h2>
            <div class="bg-green-50 border border-green-200 rounded-xl p-6 mb-8">
                <h3 class="font-bold text-green-800 mb-2">Prečo zinkovaný povrch?</h3>
                <p class="text-green-700">Zinkovanie vytvára ochrannú vrstvu, ktorá bráni kontaktu ocele s vlhkosťou.
                Životnosť zinkovaného povrchu je 20+ rokov aj v trvale vlhkom prostredí pivnice.</p>
            </div>

            <h2 class="text-2xl font-bold mb-4">Ideálne využitie v pivnici</h2>
            <ul class="space-y-2 mb-8">
                <li class="flex items-start gap-2"><span class="text-green-500">&#10003;</span> <strong>Zaváraniny a kompóty</strong> – prehľadné uskladnenie na nastaviteľných policiach</li>
                <li class="flex items-start gap-2"><span class="text-green-500">&#10003;</span> <strong>Víno a nápoje</strong> – nosnosť 175 kg na policu zvládne aj ťažké fľaše</li>
                <li class="flex items-start gap-2"><span class="text-green-500">&#10003;</span> <strong>Sezónne veci</strong> – lyže, stany, vianočné ozdoby v boxoch</li>
                <li class="flex items-start gap-2"><span class="text-green-500">&#10003;</span> <strong>Náradie a materiál</strong> – odolné police unesú aj ťažké predmety</li>
            </ul>
            """,
        },
        {
            "slug": "kovove-regaly-bratislava",
            "title": "Kovové regále Bratislava – dodávka do 3–5 dní | Bazarovyregal.cz",
            "h1": "Kovové regále s dodávkou do Bratislavy",
            "intro": "Objednajte kovové regále z Česka s rýchlou dodávkou do Bratislavy a okolia. Zľavy až 75 %, nové zboží z likvidácie skladu, záruka 7 rokov.",
            "faq": [
                ("Ako dlho trvá dodávka do Bratislavy?", "Dodacia lehota do Bratislavy je 3–5 pracovných dní od expedície. Expedujeme v deň objednávky."),
                ("Koľko stojí doprava do Bratislavy?", "Doprava do Bratislavy a okolia stojí od 199 Kč (cca 8 EUR)."),
                ("Môžem si regál vyzdvihnúť osobne?", "Momentálne ponúkame iba doručenie prepravnou službou. Osobný odber nie je možný."),
                ("Dodávate aj do iných miest na Slovensku?", "Áno, dodávame na celé Slovensko – Bratislava, Košice, Žilina, Banská Bystrica a ďalšie mestá."),
            ],
            "extra_content": """
            <h2 class="text-2xl font-bold mb-4">Dodávka do Bratislavy</h2>
            <div class="grid md:grid-cols-2 gap-6 mb-8">
                <div class="bg-blue-50 border border-blue-200 rounded-xl p-6">
                    <h3 class="font-bold text-blue-800 mb-2">Dodacie podmienky</h3>
                    <ul class="text-blue-700 space-y-2 text-sm">
                        <li>Dodacia lehota: 3–5 pracovných dní</li>
                        <li>Doprava: od 199 Kč (cca 8 EUR)</li>
                        <li>Prepravná služba: PPL / DPD</li>
                        <li>Sledovanie zásielky: áno</li>
                    </ul>
                </div>
                <div class="bg-blue-50 border border-blue-200 rounded-xl p-6">
                    <h3 class="font-bold text-blue-800 mb-2">Platobné podmienky</h3>
                    <ul class="text-blue-700 space-y-2 text-sm">
                        <li>Platba kartou online</li>
                        <li>Bankový prevod</li>
                        <li>Dobierka pri doručení</li>
                        <li>Ceny v CZK (automatický prepočet)</li>
                    </ul>
                </div>
            </div>
            """,
        },
        {
            "slug": "kovove-regaly-kosice",
            "title": "Kovové regále Košice – dodávka do 4–5 dní | Bazarovyregal.cz",
            "h1": "Kovové regále s dodávkou do Košíc",
            "intro": "Kovové regále za najnižšie ceny s dodávkou do Košíc a východného Slovenska. Zľavy až 75 %, záruka 7 rokov, expedícia ihneď.",
            "faq": [
                ("Ako dlho trvá dodávka do Košíc?", "Dodacia lehota do Košíc je 4–5 pracovných dní. Expedujeme v deň objednávky."),
                ("Dodávate aj do okolia Košíc?", "Áno, dodávame do celého košického a prešovského kraja."),
                ("Aké regále odporúčate?", "Najobľúbenejší model je regál 180×90×40 cm – univerzálna veľkosť za 739 Kč (cca 30 EUR)."),
            ],
            "extra_content": """
            <h2 class="text-2xl font-bold mb-4">Dodávka do Košíc a východného Slovenska</h2>
            <div class="bg-green-50 border border-green-200 rounded-xl p-6 mb-8">
                <p class="text-green-700">Dodávame prepravnou službou na adresu v Košiciach a okolí.
                Dodacia lehota 4–5 pracovných dní, doprava od 199 Kč (cca 8 EUR).
                Po expedícii obdržíte číslo zásielky pre sledovanie.</p>
            </div>

            <h2 class="text-2xl font-bold mb-4">Najobľúbenejšie regále na Slovensku</h2>
            """,
        },
    ]

    pages = []
    for tr in translations:
        slug = tr["slug"]

        faq_html = ""
        for q, a in tr["faq"]:
            faq_html += f'''
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">{q}</h3>
                <p class="text-gray-600">{a}</p>
            </div>'''

        body = f'''
        <p class="text-xl text-gray-600 mb-8">{tr["intro"]}</p>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div class="bg-white rounded-xl p-4 shadow-sm text-center">
                <div class="text-2xl font-bold text-primary-600">-75%</div>
                <div class="text-xs text-gray-500">Zľava</div>
            </div>
            <div class="bg-white rounded-xl p-4 shadow-sm text-center">
                <div class="text-2xl font-bold text-primary-600">7 rokov</div>
                <div class="text-xs text-gray-500">Záruka</div>
            </div>
            <div class="bg-white rounded-xl p-4 shadow-sm text-center">
                <div class="text-2xl font-bold text-primary-600">3–5 dní</div>
                <div class="text-xs text-gray-500">Dodávka</div>
            </div>
            <div class="bg-white rounded-xl p-4 shadow-sm text-center">
                <div class="text-2xl font-bold text-primary-600">od 549 Kč</div>
                <div class="text-xs text-gray-500">Cena</div>
            </div>
        </div>

        {tr.get("extra_content", "")}

        <h2 class="text-2xl font-bold mb-4">Odporúčané regále</h2>
        {get_product_cards(PRODUCTS[:4], 4)}

        <h2 class="text-2xl font-bold mb-4">Často kladené otázky</h2>
        <div class="space-y-4 mb-8">{faq_html}</div>

        <h2 class="text-2xl font-bold mb-4">Ďalšie stránky</h2>
        {_internal_links(slug)}
        '''

        pages.append({
            "slug": slug,
            "title": tr["title"],
            "meta_desc": tr["intro"][:155],
            "h1": tr["h1"],
            "body_html": body,
            "breadcrumb_category": "Slovensko",
            "playbook_type": "translations",
        })
    return pages


# ============================================================
# INTEGRATIONS PLAYBOOK
# Pages about how shelves integrate with spaces, tools, systems
# ============================================================
def generate_integration_pages():
    integrations = [
        {
            "slug": "regaly-a-ulozne-boxy-system",
            "title": "Regály + úložné boxy – kompletní organizační systém",
            "h1": "Regály + úložné boxy – systém pro dokonalou organizaci",
            "intro": "Kombinace kovových regálů a úložných boxů vytváří profesionální organizační systém. Podívejte se, jak je správně zkombinovat.",
            "sections": [
                ("Proč kombinovat regály s boxy?", """
                <p class="text-gray-600 mb-4">Samotný regál nabídne otevřené police. Přidáním úložných boxů získáte:</p>
                <ul class="space-y-2 mb-4">
                    <li class="flex items-start gap-2"><span class="text-green-500">&#10003;</span> Ochranu před prachem a vlhkostí</li>
                    <li class="flex items-start gap-2"><span class="text-green-500">&#10003;</span> Přehlednou organizaci drobných předmětů</li>
                    <li class="flex items-start gap-2"><span class="text-green-500">&#10003;</span> Popisky na boxech pro rychlé hledání</li>
                    <li class="flex items-start gap-2"><span class="text-green-500">&#10003;</span> Estetický a profesionální vzhled</li>
                </ul>"""),
                ("Jaké boxy se hodí?", """
                <div class="grid md:grid-cols-2 gap-4 mb-4">
                    <div class="bg-white rounded-xl p-5 shadow-sm">
                        <h4 class="font-bold mb-2">Plastové boxy s víkem</h4>
                        <p class="text-gray-600 text-sm">Pro sklep, garáž a sklad. Chrání před vlhkostí a prachem. Stohovatelné.</p>
                    </div>
                    <div class="bg-white rounded-xl p-5 shadow-sm">
                        <h4 class="font-bold mb-2">Průhledné boxy</h4>
                        <p class="text-gray-600 text-sm">Pro domácnost a šatnu. Vidíte obsah bez otevírání. Ideální pro oblečení a doplňky.</p>
                    </div>
                    <div class="bg-white rounded-xl p-5 shadow-sm">
                        <h4 class="font-bold mb-2">Kartonové archivační krabice</h4>
                        <p class="text-gray-600 text-sm">Pro kanceláře a archivy. Standardní rozměry, popisky po stranách.</p>
                    </div>
                    <div class="bg-white rounded-xl p-5 shadow-sm">
                        <h4 class="font-bold mb-2">Kovové přepravky</h4>
                        <p class="text-gray-600 text-sm">Pro dílny a profesionální použití. Odolné, stohovatelné, na těžké díly.</p>
                    </div>
                </div>"""),
                ("Rozměry boxů pro naše regály", """
                <div class="overflow-x-auto mb-4">
                    <table class="w-full bg-white rounded-xl shadow-sm">
                        <thead class="bg-gray-50">
                            <tr><th class="py-3 px-4 text-left">Šířka regálu</th><th class="py-3 px-4 text-left">Doporučená velikost boxu</th><th class="py-3 px-4 text-left">Počet boxů vedle sebe</th></tr>
                        </thead>
                        <tbody>
                            <tr class="border-b"><td class="py-3 px-4">70 cm</td><td class="py-3 px-4">30×40 cm</td><td class="py-3 px-4">2 boxy</td></tr>
                            <tr class="border-b"><td class="py-3 px-4">90 cm</td><td class="py-3 px-4">30×40 cm</td><td class="py-3 px-4">2–3 boxy</td></tr>
                            <tr class="border-b"><td class="py-3 px-4">120 cm</td><td class="py-3 px-4">40×60 cm</td><td class="py-3 px-4">2–3 boxy</td></tr>
                        </tbody>
                    </table>
                </div>"""),
            ],
        },
        {
            "slug": "regaly-kotveni-ke-zdi",
            "title": "Kotvení regálů ke zdi – návod a doporučení",
            "h1": "Kotvení regálů ke zdi – bezpečná instalace",
            "intro": "Jak správně přikotvit kovový regál ke zdi pro maximální stabilitu a bezpečnost. Krok za krokem s doporučením materiálu.",
            "sections": [
                ("Kdy je kotvení nutné?", """
                <div class="grid md:grid-cols-2 gap-4 mb-4">
                    <div class="bg-red-50 border border-red-200 rounded-xl p-5">
                        <h4 class="font-bold text-red-800 mb-2">Doporučeno kotvit</h4>
                        <ul class="text-red-700 text-sm space-y-1">
                            <li>Regál ve výšce 200+ cm</li>
                            <li>Těžký náklad na horních policích</li>
                            <li>Domácnost s dětmi nebo zvířaty</li>
                            <li>Nestabilní nebo nerovná podlaha</li>
                            <li>Seismicky aktivní oblasti</li>
                        </ul>
                    </div>
                    <div class="bg-green-50 border border-green-200 rounded-xl p-5">
                        <h4 class="font-bold text-green-800 mb-2">Kotvení nemusíte řešit</h4>
                        <ul class="text-green-700 text-sm space-y-1">
                            <li>Nízké regály 150 cm</li>
                            <li>Lehký náklad rovnoměrně rozložený</li>
                            <li>Regál v rohu místnosti</li>
                            <li>Řady regálů podpírající se navzájem</li>
                        </ul>
                    </div>
                </div>"""),
                ("Postup kotvení", """
                <div class="space-y-4 mb-4">
                    <div class="flex gap-4 bg-white rounded-xl p-5 shadow-sm">
                        <div class="w-10 h-10 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">1</div>
                        <div><h4 class="font-bold mb-1">Určete bod kotvení</h4><p class="text-gray-600">V horní třetině stojny, minimálně 120 cm od podlahy.</p></div>
                    </div>
                    <div class="flex gap-4 bg-white rounded-xl p-5 shadow-sm">
                        <div class="w-10 h-10 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">2</div>
                        <div><h4 class="font-bold mb-1">Vyvrtejte otvor</h4><p class="text-gray-600">Do zdi vyvrtejte otvor průměru 8 mm, hloubka 50 mm. Použijte hmoždinkový vrták.</p></div>
                    </div>
                    <div class="flex gap-4 bg-white rounded-xl p-5 shadow-sm">
                        <div class="w-10 h-10 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">3</div>
                        <div><h4 class="font-bold mb-1">Vložte hmoždinku a šroub</h4><p class="text-gray-600">Vložte plastovou hmoždinku 8×50 mm a přišroubujte L-úhelník ke stojně a zdi.</p></div>
                    </div>
                    <div class="flex gap-4 bg-white rounded-xl p-5 shadow-sm">
                        <div class="w-10 h-10 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">4</div>
                        <div><h4 class="font-bold mb-1">Zkontrolujte stabilitu</h4><p class="text-gray-600">Zkuste regálem mírně zatřást. Pokud se nehýbe, kotvení je správné.</p></div>
                    </div>
                </div>"""),
                ("Potřebný materiál", """
                <div class="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-4">
                    <h4 class="font-bold mb-3">Co budete potřebovat:</h4>
                    <ul class="space-y-2 text-sm">
                        <li class="flex items-center gap-2"><span>&#128295;</span> Příklepová vrtačka s vrtákem 8 mm</li>
                        <li class="flex items-center gap-2"><span>&#128295;</span> Hmoždinky 8×50 mm (2 ks na regál)</li>
                        <li class="flex items-center gap-2"><span>&#128295;</span> Vruty 5×50 mm (2 ks)</li>
                        <li class="flex items-center gap-2"><span>&#128295;</span> L-úhelníky (2 ks na regál)</li>
                        <li class="flex items-center gap-2"><span>&#128295;</span> Křížový šroubovák</li>
                    </ul>
                </div>"""),
            ],
        },
        {
            "slug": "regaly-a-stitky-organizace",
            "title": "Organizační systém – regály + štítky + kategorizace",
            "h1": "Regály + štítky = profesionální organizační systém",
            "intro": "Jak vytvořit profesionální organizační systém kombinací kovových regálů a systému štítků. Ideální pro sklady, e-shopy a archivy.",
            "sections": [
                ("Proč systém štítků?", """
                <p class="text-gray-600 mb-4">Regál bez systému je jen kovová polička. Se správným označením se z něj stane profesionální organizační nástroj.</p>
                <div class="grid md:grid-cols-3 gap-4 mb-4">
                    <div class="bg-white rounded-xl p-5 shadow-sm text-center">
                        <div class="text-3xl mb-2">&#128269;</div>
                        <h4 class="font-bold mb-1">Rychlejší hledání</h4>
                        <p class="text-xs text-gray-600">Z 5 minut na 10 sekund</p>
                    </div>
                    <div class="bg-white rounded-xl p-5 shadow-sm text-center">
                        <div class="text-3xl mb-2">&#128200;</div>
                        <h4 class="font-bold mb-1">Přehled o zásobách</h4>
                        <p class="text-xs text-gray-600">Víte co máte a kde</p>
                    </div>
                    <div class="bg-white rounded-xl p-5 shadow-sm text-center">
                        <div class="text-3xl mb-2">&#128101;</div>
                        <h4 class="font-bold mb-1">Sdílený systém</h4>
                        <p class="text-xs text-gray-600">Orientuje se každý</p>
                    </div>
                </div>"""),
                ("Systém číslování pozic", """
                <div class="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-4">
                    <h4 class="font-bold text-blue-800 mb-3">Formát: [Regál]-[Police]</h4>
                    <p class="text-blue-700 mb-3">Příklad: A3 = Regál A, 3. police zdola</p>
                    <div class="grid grid-cols-3 gap-2 text-center text-sm">
                        <div class="bg-white rounded p-2"><strong>A5</strong><br>Horní police</div>
                        <div class="bg-white rounded p-2"><strong>A4</strong></div>
                        <div class="bg-white rounded p-2"><strong>A3</strong><br>Ve výšce očí</div>
                        <div class="bg-white rounded p-2"><strong>A2</strong></div>
                        <div class="bg-white rounded p-2"><strong>A1</strong><br>Spodní police</div>
                        <div class="bg-white rounded p-2"><strong>B1–B5</strong><br>Další regál</div>
                    </div>
                </div>"""),
                ("Tipy pro e-shopy", """
                <div class="bg-green-50 border border-green-200 rounded-xl p-6 mb-4">
                    <h4 class="font-bold text-green-800 mb-2">Pro rychlé vychystávání objednávek:</h4>
                    <ul class="text-green-700 space-y-2 text-sm">
                        <li>Přiřaďte každému produktu pozici (SKU → A3)</li>
                        <li>Rychloobrátkové produkty na úroveň pasu (police 2–3)</li>
                        <li>Těžké produkty na spodní polici</li>
                        <li>QR kódy na policích pro rychlé skenování</li>
                    </ul>
                </div>"""),
            ],
        },
        {
            "slug": "regaly-modularni-system-rozsireni",
            "title": "Modulární systém – jak rozšířit regálový systém",
            "h1": "Modulární regálový systém – rozšíření a kombinace",
            "intro": "Naše regály jsou modulární – můžete je stavět vedle sebe, kombinovat různé výšky a vytvořit systém přesně na míru vašemu prostoru.",
            "sections": [
                ("Co znamená modulární systém?", """
                <p class="text-gray-600 mb-4">Každý náš regál je samostatný modul, který můžete libovolně kombinovat s dalšími.
                Stačí pořídit další regál a postavit ho vedle stávajícího.</p>
                <div class="grid md:grid-cols-3 gap-4 mb-4">
                    <div class="bg-white rounded-xl p-5 shadow-sm">
                        <h4 class="font-bold mb-2">Vedle sebe</h4>
                        <p class="text-sm text-gray-600">Regály stavte těsně vedle sebe podél stěny. Vznikne souvislá řada.</p>
                    </div>
                    <div class="bg-white rounded-xl p-5 shadow-sm">
                        <h4 class="font-bold mb-2">Různé výšky</h4>
                        <p class="text-sm text-gray-600">Kombinujte 150, 180, 200 cm podle výšky stropu v různých částech prostoru.</p>
                    </div>
                    <div class="bg-white rounded-xl p-5 shadow-sm">
                        <h4 class="font-bold mb-2">Různé šířky</h4>
                        <p class="text-sm text-gray-600">Regál 90 cm do hlavní řady, 40 cm do úzkého prostoru vedle dveří.</p>
                    </div>
                </div>"""),
                ("Příklady sestav", """
                <div class="space-y-4 mb-4">
                    <div class="bg-white rounded-xl p-5 shadow-sm">
                        <h4 class="font-bold mb-2">Garáž 4 m stěna</h4>
                        <p class="text-gray-600 text-sm">4× regál 180×90×40 cm = 360 cm regálové stěny. 20 polic, nosnost 3 500 kg celkem. Cena: 4× 739 = 2 956 Kč.</p>
                    </div>
                    <div class="bg-white rounded-xl p-5 shadow-sm">
                        <h4 class="font-bold mb-2">E-shop sklad 8 m</h4>
                        <p class="text-gray-600 text-sm">6× regál 180×120×50 cm profesionální = 720 cm. 30 polic, nosnost 6 300 kg. Cena: 6× 1 249 = 7 494 Kč.</p>
                    </div>
                    <div class="bg-white rounded-xl p-5 shadow-sm">
                        <h4 class="font-bold mb-2">Sklep 2.5 m</h4>
                        <p class="text-gray-600 text-sm">3× regál 180×70×30 cm zinkovaný = 210 cm. 15 polic, odolné vlhkosti. Cena: 3× 649 = 1 947 Kč.</p>
                    </div>
                </div>"""),
                ("Jak plánovat rozšíření", """
                <ol class="space-y-3 list-decimal list-inside text-gray-600 mb-4">
                    <li><strong>Změřte stěnu</strong> – délka stěny ÷ šířka regálu = počet regálů</li>
                    <li><strong>Nechte průchod</strong> – min. 80 cm uličky mezi řadami regálů</li>
                    <li><strong>Plánujte dopředu</strong> – objednejte o 1 regál více pro budoucí potřeby</li>
                    <li><strong>Kombinujte chytře</strong> – těžké věci na profesionální řadu, lehké na standardní</li>
                </ol>"""),
            ],
        },
        {
            "slug": "regaly-do-pronajateho-prostoru",
            "title": "Regály do pronajatého prostoru – bez vrtání, snadná demontáž",
            "h1": "Regály do pronajatého prostoru – bez zásahů do zdí",
            "intro": "Bydlíte v nájmu a nechcete vrtat do zdí? Naše bezšroubové regály nepotřebují žádné kotvení a snadno je demontujete při stěhování.",
            "sections": [
                ("Proč jsou ideální do nájmu?", """
                <div class="grid md:grid-cols-2 gap-4 mb-4">
                    <div class="bg-white rounded-xl p-6 shadow-sm">
                        <h3 class="font-bold mb-2">Žádné vrtání</h3>
                        <p class="text-gray-600">Bezšroubová montáž – regál stojí volně na podlaze. Žádné otvory ve zdech.</p>
                    </div>
                    <div class="bg-white rounded-xl p-6 shadow-sm">
                        <h3 class="font-bold mb-2">Snadná demontáž</h3>
                        <p class="text-gray-600">Při stěhování regál rozložíte za 5 minut a přestěhujete na nové místo.</p>
                    </div>
                    <div class="bg-white rounded-xl p-6 shadow-sm">
                        <h3 class="font-bold mb-2">Žádné stopy</h3>
                        <p class="text-gray-600">Po demontáži nezůstanou na podlaze ani na stěnách žádné stopy.</p>
                    </div>
                    <div class="bg-white rounded-xl p-6 shadow-sm">
                        <h3 class="font-bold mb-2">Levnější než nábytek</h3>
                        <p class="text-gray-600">Od 549 Kč za kompletní regál. Při stěhování vezmete s sebou, nábytok na míru ne.</p>
                    </div>
                </div>"""),
                ("Tipy pro stabilitu bez kotvení", """
                <ul class="space-y-2 mb-4">
                    <li class="flex items-start gap-2"><span class="text-primary-500">&#10003;</span> <strong>Těžké předměty dolů</strong> – snížíte těžiště regálu</li>
                    <li class="flex items-start gap-2"><span class="text-primary-500">&#10003;</span> <strong>Volte nižší variantu</strong> – regál 150 cm je stabilnější než 200 cm</li>
                    <li class="flex items-start gap-2"><span class="text-primary-500">&#10003;</span> <strong>Protiskluzové podložky</strong> – pod patky regálu pro pevnou pozici</li>
                    <li class="flex items-start gap-2"><span class="text-primary-500">&#10003;</span> <strong>K rohu místnosti</strong> – 2 stěny poskytují přirozenou oporu</li>
                </ul>"""),
                ("Doporučené varianty", """
                <div class="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-4">
                    <p class="text-blue-700">Pro pronajatý prostor doporučujeme regál <strong>150×70×30 cm</strong> nebo <strong>180×90×40 cm</strong>.
                    Kompaktní rozměry, snadná manipulace a stabilní i bez kotvení ke zdi.</p>
                </div>"""),
            ],
        },
    ]

    pages = []
    for integ in integrations:
        slug = integ["slug"]

        sections_html = ""
        for s_title, s_content in integ["sections"]:
            sections_html += f'''
            <h2 class="text-2xl font-bold mb-4">{s_title}</h2>
            {s_content}
            '''

        body = f'''
        <p class="text-xl text-gray-600 mb-8">{integ["intro"]}</p>

        {sections_html}

        <h2 class="text-2xl font-bold mb-4">Doporučené regály</h2>
        {get_product_cards(PRODUCTS[:4], 4)}

        <h2 class="text-2xl font-bold mb-4">Často kladené otázky</h2>
        <div class="space-y-4 mb-8">
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Potřebuji nějaké speciální příslušenství?</h3>
                <p class="text-gray-600">Ne, naše regály jsou kompletní a funkční rovnou z krabice. Příslušenství jako boxy nebo štítky si pořídíte zvlášť dle potřeby.</p>
            </div>
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Mohu regály kombinovat s jiným nábytkem?</h3>
                <p class="text-gray-600">Samozřejmě. Kovové regály se hodí do jakéhokoli prostoru a lze je kombinovat s existujícím vybavením.</p>
            </div>
            <div class="bg-white rounded-xl p-5 shadow-sm">
                <h3 class="font-bold mb-2">Jaká je životnost regálu?</h3>
                <p class="text-gray-600">Při správném použití 15–20+ let. Zinkovanie prodlužuje životnost v vlhkém prostředí.</p>
            </div>
        </div>

        <h2 class="text-2xl font-bold mb-4">Další stránky</h2>
        {_internal_links(slug)}
        '''

        pages.append({
            "slug": slug,
            "title": integ["title"] + " | Bazarovyregal.cz",
            "meta_desc": integ["intro"][:155],
            "h1": integ["h1"],
            "body_html": body,
            "breadcrumb_category": "Integrace",
            "playbook_type": "integrations",
        })
    return pages


if __name__ == "__main__":
    pages = generate_conversion_pages() + generate_translation_pages() + generate_integration_pages()
    print(f"Generated {len(pages)} pages")
    for p in pages:
        print(f"  {p['slug']}.html - {p['playbook_type']}")
