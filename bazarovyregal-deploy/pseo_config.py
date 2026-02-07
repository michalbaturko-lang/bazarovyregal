#!/usr/bin/env python3
"""
Programmatic SEO Data Configuration for Bazarovyregal.cz
All input datasets for 12 pSEO playbooks.
"""

BASE_URL = "https://www.bazarovyregal.cz"

# Product images
IMAGES = {
    "black": "https://vyprodej-regalucz.s26.cdn-upgates.com/l/l690377af7480a-1-regal-1800x900x400-mm-lakovany-5-policovy-nosnost-875-kg-cerny-pravy-18090405875black1.jpeg",
    "white": "https://vyprodej-regalucz.s26.cdn-upgates.com/6/6690a777ad6edc-1-18090405875white1.jpeg",
    "red": "https://vyprodej-regalucz.s26.cdn-upgates.com/_cache/9/e/9eef5f9f2ad8880b75926a3eae58485b-1-regal-1500x700x300-mm-lakovany-4-policovy-nosnost-700-kg-cerveny-pravy-15070304700red1.jpeg",
    "blue": "https://vyprodej-regalucz.s26.cdn-upgates.com/_cache/1/c/1c64831c1231f5847cf9e7a36f6cdf6f-1-15070304700blue1.jpeg",
    "zinc": "https://vyprodej-regalucz.s26.cdn-upgates.com/z/z6914605330838-5-pol-pravy-zink.jpg",
    "pro": "https://vyprodej-regalucz.s26.cdn-upgates.com/_cache/b/1/b17ce5b491bdb73a0df3160b51fbcf7e-1-regal-1800x1200x500-mm-lakovany-5-policovy-nosnost-1050-kg-modro-oranzovy-pravy-18120501050orangeblue1.jpeg"
}

# Featured products for linking on pSEO pages
PRODUCTS = [
    {"name": "Regal 150x70x30 cm cerny", "price": 599, "url": "regal-150x70x30-cerna.html", "img": IMAGES["black"], "dims": "150x70x30", "color": "cerny", "capacity": 700},
    {"name": "Regal 150x70x30 cm zinkovany", "price": 549, "url": "regal-150x70x30-zinkovany.html", "img": IMAGES["zinc"], "dims": "150x70x30", "color": "zinkovany", "capacity": 700},
    {"name": "Regal 180x90x40 cm cerny", "price": 739, "url": "regal-180x90x40-cerna.html", "img": IMAGES["black"], "bestseller": True, "dims": "180x90x40", "color": "cerny", "capacity": 875},
    {"name": "Regal 180x90x40 cm zinkovany", "price": 649, "url": "regal-180x90x40-zinkovany.html", "img": IMAGES["zinc"], "dims": "180x90x40", "color": "zinkovany", "capacity": 875},
    {"name": "Regal 180x90x40 cm bily", "price": 739, "url": "regal-180x90x40-bila.html", "img": IMAGES["white"], "dims": "180x90x40", "color": "bily", "capacity": 875},
    {"name": "Regal 180x90x40 cm cerveny", "price": 759, "url": "regal-180x90x40-cervena.html", "img": IMAGES["red"], "dims": "180x90x40", "color": "cerveny", "capacity": 875},
    {"name": "Regal 180x90x40 cm modry", "price": 759, "url": "regal-180x90x40-modra.html", "img": IMAGES["blue"], "dims": "180x90x40", "color": "modry", "capacity": 875},
    {"name": "Regal 200x90x40 cm cerny", "price": 849, "url": "regal-200x90x40-cerna.html", "img": IMAGES["black"], "dims": "200x90x40", "color": "cerny", "capacity": 875},
    {"name": "Regal 200x120x50 cm cerny", "price": 1149, "url": "regal-180x120x50-cerna.html", "img": IMAGES["black"], "dims": "180x120x50", "color": "cerny", "capacity": 875},
    {"name": "Regal 180x120x50 cm profesionalni", "price": 1249, "url": "regal-180x120x50-profesionalni.html", "img": IMAGES["pro"], "dims": "180x120x50", "color": "profesionalni", "capacity": 1050},
]

# ============================================================
# CATEGORIES - use cases / spaces where shelves are placed
# ============================================================
CATEGORIES = [
    {"id": "garaz", "name": "Garaz", "name_cs": "garaz", "label": "Regaly do garaze", "slug_base": "regaly-do-garaze"},
    {"id": "sklep", "name": "Sklep", "name_cs": "sklep", "label": "Regaly do sklepa", "slug_base": "regaly-do-sklepa"},
    {"id": "dilna", "name": "Dilna", "name_cs": "dilna", "label": "Regaly do dilny", "slug_base": "regaly-do-dilny"},
    {"id": "kancelar", "name": "Kancelar", "name_cs": "kancelar", "label": "Regaly do kancelare", "slug_base": "regaly-do-kancelare"},
    {"id": "spiz", "name": "Spiz", "name_cs": "spiz", "label": "Regaly do spize", "slug_base": "regaly-do-spize"},
    {"id": "sklad", "name": "Sklad", "name_cs": "sklad", "label": "Skladove regaly", "slug_base": "skladove-regaly"},
    {"id": "archiv", "name": "Archiv", "name_cs": "archiv", "label": "Regaly do archivu", "slug_base": "regaly-do-archivu"},
    {"id": "satna", "name": "Satna", "name_cs": "satna", "label": "Regaly do satny", "slug_base": "regaly-do-satny"},
    {"id": "komora", "name": "Komora", "name_cs": "komora", "label": "Regaly do komory", "slug_base": "regaly-do-komory"},
    {"id": "eshop", "name": "E-shop sklad", "name_cs": "e-shop", "label": "Regaly pro e-shop", "slug_base": "regaly-pro-e-shop"},
    {"id": "byt", "name": "Byt", "name_cs": "byt", "label": "Regaly do bytu", "slug_base": "regaly-do-bytu"},
    {"id": "dum", "name": "Dum", "name_cs": "dum", "label": "Regaly do domu", "slug_base": "regaly-do-domu"},
]

# ============================================================
# LOCATIONS - Czech cities for local SEO pages
# ============================================================
LOCATIONS = [
    {"id": "praha", "name": "Praha", "region": "Stredocesky", "population": 1309000, "postal": "100 00"},
    {"id": "brno", "name": "Brno", "region": "Jihomoravsky", "population": 382000, "postal": "602 00"},
    {"id": "ostrava", "name": "Ostrava", "region": "Moravskoslezsky", "population": 285000, "postal": "702 00"},
    {"id": "plzen", "name": "Plzen", "region": "Plzensky", "population": 175000, "postal": "301 00"},
    {"id": "liberec", "name": "Liberec", "region": "Liberecky", "population": 105000, "postal": "460 01"},
    {"id": "olomouc", "name": "Olomouc", "region": "Olomoucky", "population": 101000, "postal": "779 00"},
    {"id": "ceske-budejovice", "name": "Ceske Budejovice", "region": "Jihocesky", "population": 95000, "postal": "370 01"},
    {"id": "hradec-kralove", "name": "Hradec Kralove", "region": "Kralovehradecky", "population": 93000, "postal": "500 02"},
    {"id": "usti-nad-labem", "name": "Usti nad Labem", "region": "Ustecky", "population": 92000, "postal": "400 01"},
    {"id": "pardubice", "name": "Pardubice", "region": "Pardubicky", "population": 91000, "postal": "530 02"},
    {"id": "zlin", "name": "Zlin", "region": "Zlinsky", "population": 75000, "postal": "760 01"},
    {"id": "havirov", "name": "Havirov", "region": "Moravskoslezsky", "population": 72000, "postal": "736 01"},
    {"id": "kladno", "name": "Kladno", "region": "Stredocesky", "population": 69000, "postal": "272 01"},
    {"id": "most", "name": "Most", "region": "Ustecky", "population": 63000, "postal": "434 01"},
    {"id": "opava", "name": "Opava", "region": "Moravskoslezsky", "population": 56000, "postal": "746 01"},
    {"id": "frydek-mistek", "name": "Frydek-Mistek", "region": "Moravskoslezsky", "population": 55000, "postal": "738 01"},
    {"id": "karlovy-vary", "name": "Karlovy Vary", "region": "Karlovarsky", "population": 49000, "postal": "360 01"},
    {"id": "jihlava", "name": "Jihlava", "region": "Vysocina", "population": 51000, "postal": "586 01"},
    {"id": "teplice", "name": "Teplice", "region": "Ustecky", "population": 50000, "postal": "415 01"},
    {"id": "chomutov", "name": "Chomutov", "region": "Ustecky", "population": 49000, "postal": "430 01"},
]

# ============================================================
# PERSONAS - target customer segments
# ============================================================
PERSONAS = [
    {
        "id": "kutil",
        "name": "Kutil a remeslnik",
        "slug": "regaly-pro-kutily",
        "title": "Regaly pro kutily a remeslniky",
        "pain_points": [
            "Neporadek v dilne a garazi",
            "Naradi se ztraci a hledani zabira cas",
            "Nedostatek ulozneho prostoru pro material",
            "Tezke predmety bez bezpecneho ulozeni"
        ],
        "solutions": [
            "Regaly s nosnosti az 875 kg pro tezke naradi",
            "Nastavitelne police pro ruzne velikosti naradi",
            "Modularni system - lze rozsirovat podle potreby",
            "Zinkovane provedeni odolne vlhkosti v dilne"
        ],
        "recommended_products": ["regal-180x90x40-cerna.html", "regal-200x90x40-cerna.html", "regal-180x120x50-profesionalni.html"]
    },
    {
        "id": "domacnost",
        "name": "Domacnost a rodina",
        "slug": "regaly-pro-domacnost",
        "title": "Regaly pro domacnost a rodinu",
        "pain_points": [
            "Malo mista v byte ci dome",
            "Sezonni veci zabori zbytecne prostor",
            "Spiz a komora jsou neorganizovane",
            "Detsky pokoj potrebuje vice ulozneho prostoru"
        ],
        "solutions": [
            "Kompaktni regaly od 40 cm sirky do malych prostoru",
            "Bile a cerne varianty ladici s interiérem",
            "Nastavitelne police pro ruzne potreby",
            "Cenove dostupne - od 549 Kc"
        ],
        "recommended_products": ["regal-150x70x30-cerna.html", "regal-180x90x40-bila.html", "regal-150x70x30-zinkovany.html"]
    },
    {
        "id": "firma",
        "name": "Firma a podnikatel",
        "slug": "regaly-pro-firmy",
        "title": "Regaly pro firmy a podnikatele",
        "pain_points": [
            "Neefektivni vyuziti skladovych prostor",
            "Vysoke naklady na regaly a vybaveni",
            "Potreba rychle expanze skladovych kapacit",
            "Organizace zbozi pro rychle vychystani"
        ],
        "solutions": [
            "Profesionalni regaly s nosnosti 1050 kg",
            "Velkoobchodni ceny - slevy az 75%",
            "Rychla montaz bez prostoju - 10 minut/regal",
            "Modularni system pro snadne rozsireni"
        ],
        "recommended_products": ["regal-180x120x50-profesionalni.html", "regal-200x90x40-cerna.html", "regal-180x120x50-cerna.html"]
    },
    {
        "id": "eshop",
        "name": "E-shop provozovatel",
        "slug": "regaly-pro-eshopy",
        "title": "Regaly pro e-shopy a online prodejce",
        "pain_points": [
            "Rostouci objem objednavek a zbozi",
            "Pomale vychystavani objednavek",
            "Nedostatecna organizace skladu",
            "Vysoke naklady na skladove prostory"
        ],
        "solutions": [
            "Systematicke oznaceni polic pro rychle hledani",
            "Ruzne sirky pro ruzne kategorie zbozi",
            "Vysoka nosnost pro tezke produkty",
            "Cenove dostupne vybaveni celeho skladu"
        ],
        "recommended_products": ["regal-180x90x40-cerna.html", "regal-180x120x50-cerna.html", "regal-200x90x40-cerna.html"]
    },
    {
        "id": "senior",
        "name": "Senior",
        "slug": "regaly-pro-seniory",
        "title": "Regaly pro seniory - snadna montaz a pristupnost",
        "pain_points": [
            "Obtizna montaz slozitych regalu",
            "Potreba snadneho pristupu ke vsem policicm",
            "Bezpecnost a stabilita regalu",
            "Cenova dostupnost pri duchodu"
        ],
        "solutions": [
            "Bezšroubova montaz bez naradi za 10 minut",
            "Nizsí regaly 150 cm s dobrym pristupem",
            "Stabilni konstrukce s moznosti kotveni ke zdi",
            "Nejnizsi ceny na trhu od 549 Kc"
        ],
        "recommended_products": ["regal-150x70x30-zinkovany.html", "regal-150x70x30-cerna.html", "regal-180x90x40-zinkovany.html"]
    },
    {
        "id": "student",
        "name": "Student",
        "slug": "regaly-pro-studenty",
        "title": "Regaly pro studenty - levne a prakticke",
        "pain_points": [
            "Omezeny rozpocet",
            "Male prostory na koleji nebo garsonce",
            "Potreba ulozit knihy, obleceni a studijni materialy",
            "Castá stěhování - potreba snadne demontáze"
        ],
        "solutions": [
            "Ceny od 549 Kc - nejlevnejsi na trhu",
            "Kompaktni rozmer 150x70x30 cm",
            "Snadna montaz i demontaz bez naradi",
            "Lehky ale pevny - snadne na prepravu"
        ],
        "recommended_products": ["regal-150x70x30-zinkovany.html", "regal-150x70x30-cerna.html", "regal-180x90x40-zinkovany.html"]
    },
]

# ============================================================
# GLOSSARY TERMS - technical terms related to shelving
# ============================================================
GLOSSARY_TERMS = [
    {"id": "nosnost", "term": "Nosnost regalu", "slug": "slovnik-nosnost-regalu",
     "definition": "Nosnost regalu udava maximalní hmotnost, kterou regal bezpecne unese. Rozlisujeme nosnost jedne police (typicky 175 kg) a celkovou nosnost regalu (700-1050 kg).",
     "detail": "Nosnost je testovana pri rovnomernem rozlozeni zateze po cele plose police. Prekroceni nosnosti muze vest k deformaci polic nebo zhrouceni cele konstrukce. Nase regaly maji nosnost certifikovanou nezavislou laboratori.",
     "related": ["nosnost-police", "celkova-nosnost", "zatizeni-regalu"]},
    {"id": "nosnost-police", "term": "Nosnost police", "slug": "slovnik-nosnost-police",
     "definition": "Nosnost jedne police je maximalní hmotnost, kterou unese jedna policie regalu pri rovnomernem rozlozeni.",
     "detail": "U standardnich regalu je nosnost 175 kg na polici, u profesionalnich 210 kg. Dulezite je rozlozit zatez rovnomerne - bodove zatizeni snizuje skutecnou nosnost. Tezsi predmety umistujte na spodni police.",
     "related": ["nosnost", "celkova-nosnost"]},
    {"id": "celkova-nosnost", "term": "Celkova nosnost regalu", "slug": "slovnik-celkova-nosnost",
     "definition": "Celkova nosnost je soucet nosnosti vsech polic regalu. U 5-policoveho regalu s 175 kg/polici je celkova nosnost 875 kg.",
     "detail": "Celkova nosnost predpoklada rovnomerne rozlozeni zateze. V praxi doporucujeme neprekracovat 80% uvedene nosnosti pro bezpecnostni rezervu. Pri umisteni tezkeho nakladu na jednu polici nezatezujte ostatni police maximalne.",
     "related": ["nosnost", "nosnost-police"]},
    {"id": "bezroubova-montaz", "term": "Bezroubova montaz", "slug": "slovnik-bezroubova-montaz",
     "definition": "Bezroubova (zarazeci) montaz je system sestaveni regalu bez pouziti sroubu a naradi. Dily se do sebe zasunou a zarazí.",
     "detail": "Tento system vyuziva kovove spony a pricne v profilu L, ktere se zasouvaji do otvoru ve stojnach. Montaz trvá 10-15 minut a nevyzaduje zadne naradi. Pro lepsi fixaci lze pouzit gumovou palicku. System umoznuje snadnou demontaz a prestaveni.",
     "related": ["montaz-regalu", "nastavitelne-police"]},
    {"id": "montaz-regalu", "term": "Montaz regalu", "slug": "slovnik-montaz-regalu",
     "definition": "Montaz regalu je proces sestaveni regalu z jednotlivych dilu. U bezroubovych regalu je montaz jednoducha a trva 10 minut.",
     "detail": "Postup: 1) Polozite 2 stojny na zem, 2) Nasadite pricek spodni police, 3) Pridáte zbyvajici stojny, 4) Postavite konstrukci, 5) Vlozite police. Doporucujeme montaz ve dvou a kotveni ke zdi pro zvyseni stability.",
     "related": ["bezroubova-montaz", "nastavitelne-police"]},
    {"id": "nastavitelne-police", "term": "Nastavitelne police", "slug": "slovnik-nastavitelne-police",
     "definition": "Nastavitelne police lze posouvat po vysce regalu v krocich po 5 cm, coz umoznuje prizpusobit regal konkretnim potrebam.",
     "detail": "Police se upevnuji do otvoru ve stojnách regalu. Otvory jsou rozmisteny v pravidelnych intervalech 50 mm. Zmena vysky police nevyzaduje zadne naradi - staci polici vysunout a zasunout do jine pozice.",
     "related": ["bezroubova-montaz", "montaz-regalu"]},
    {"id": "zinkovani", "term": "Zinkovani (povrchova uprava)", "slug": "slovnik-zinkovani",
     "definition": "Zinkovani je povrchova uprava kovu, pri ktere se na ocelovy povrch nanasi vrstva zinku. Chrani pred korozi a rzí.",
     "detail": "Zinkovani vytvari ochranny povlak, ktery brání kontaktu oceli s vlhkostí a kyslíkem. Zinkovane regaly jsou idealni do vlhkych prostor jako sklepy, garaze nebo venkovni prostory. Zivotnost zinkovaneho povrchu je 20+ let.",
     "related": ["lakovani", "povrchova-uprava", "koroze"]},
    {"id": "lakovani", "term": "Lakovani (povrchova uprava)", "slug": "slovnik-lakovani",
     "definition": "Lakovani je povrchova uprava, pri ktere se na ocelovy povrch nanasi praskovy lak. Umoznuje ruzne barevne varianty.",
     "detail": "Praskove lakovani (powder coating) vytvari odolny a esteticky povrch. Je k dispozici v cerné, bile, cervene a modre barve. Lakované regaly jsou vhodné do suchych a mirne vlhkych prostor. Pro vlhke prostredi doporucujeme zinkovane provedeni.",
     "related": ["zinkovani", "povrchova-uprava"]},
    {"id": "povrchova-uprava", "term": "Povrchova uprava regalu", "slug": "slovnik-povrchova-uprava",
     "definition": "Povrchova uprava chrání ocelovou konstrukci pred korozí a urcuje vzhled regálu. Zakladni typy jsou zinkovani a lakovani.",
     "detail": "Vyber povrchove upravy zalezi na miste umisteni regalu. Do vlhkych prostor (sklep, garaz) doporucujeme zinkovani. Do suchych prostor (kancelar, byt) je vhodne lakovani v pozadovane barve.",
     "related": ["zinkovani", "lakovani"]},
    {"id": "koroze", "term": "Koroze (rez)", "slug": "slovnik-koroze",
     "definition": "Koroze je chemicky proces degradace kovu zpusobeny vlhkosti a kyslíkem. U regalu se projevuje jako rez.",
     "detail": "Koroze oslabuje konstrukci a snizuje nosnost. Prevence: pouziti zinkovanych regalu ve vlhkych prostorech, pravidelna kontrola povrchu, okamzite oseceni a prelakování poskozených mist.",
     "related": ["zinkovani", "povrchova-uprava"]},
    {"id": "stojny", "term": "Stojny (sloupky regalu)", "slug": "slovnik-stojny",
     "definition": "Stojny jsou svisle nosne prvky regalu. Kazdy regal ma 4 stojny, ktere nesou police a urcuji vysku regalu.",
     "detail": "Stojny maji perforovany profil s otvory pro uchyceni pricek a polic. Jsou vyrobeny z oceloveho plechu o tloušce 1,5 mm. Na spodni casti maji patky pro stabilni stani na podlaze.",
     "related": ["police-regalu", "pricka"]},
    {"id": "police-regalu", "term": "Police regalu", "slug": "slovnik-police-regalu",
     "definition": "Police jsou vodorovne plochy regalu, na ktere se uklada zbozi. Vyrabeji se z oceloveho plechu s vyztuhami.",
     "detail": "Police jsou vyrobeny z oceloveho plechu 0,7 mm s vyztuhami po obvodu. Nosnost standardni police je 175 kg, profesionalni 210 kg. Police se vkladaji na pricky upevnene ve stojnach.",
     "related": ["stojny", "nosnost-police"]},
    {"id": "pricka", "term": "Pricka (traversa)", "slug": "slovnik-pricka",
     "definition": "Pricka je vodorovny nosny prvek ve tvaru L, ktery spojuje stojny a nese police regalu.",
     "detail": "Pricky se zasouvaji do otvoru ve stojnach a fixuji se zarazi. Kazda police je nesena dvema pricky (predni a zadni). Pricka ma profil L pro vyssi nosnost a stabilitu.",
     "related": ["stojny", "police-regalu", "bezroubova-montaz"]},
    {"id": "likvidace-skladu", "term": "Likvidace skladu", "slug": "slovnik-likvidace-skladu",
     "definition": "Likvidace skladu je proces vyprodeje skladovych zasob za vyrazne snizene ceny, typicky pri zmene sortimentu nebo uzavreni provozovny.",
     "detail": "Pri likvidaci skladu se zbozi prodava za ceny vyrazne pod beznou maloobchodni cenou. Zbozi je nové a nerozbalene, pouze za nizsí cenu. Likvidace je casove omezena a plati do vyprodani zasob.",
     "related": ["vyprodej", "slevy"]},
    {"id": "zatizeni-regalu", "term": "Zatizeni regalu", "slug": "slovnik-zatizeni-regalu",
     "definition": "Zatizeni regalu je aktualni hmotnost predmetu ulozenych na regalu. Nesmí prekrocit celkovou nosnost.",
     "detail": "Pro bezpecne pouzivani platí pravidla: nejtezsi predmety na spodni police, rovnomerne rozlozeni zateze, neprekracovat 80% nosnosti. Pri nerovnomernem zatizeni hrozi prevraceni regalu.",
     "related": ["nosnost", "celkova-nosnost"]},
]

# ============================================================
# COMPARISONS - product comparison pairs
# ============================================================
COMPARISONS = [
    {"id": "180-vs-200", "slug": "srovnani-regal-180-vs-200-cm",
     "title": "Srovnani regalu 180 vs 200 cm - ktery vybrat?",
     "item_a": {"name": "Regal 180 cm", "height": 180, "price_from": 629, "shelves": 5, "capacity": 875,
                "pros": ["Standardni vyska - vejde se vsude", "Sirsi nabidka barev", "Nizsi cena"],
                "cons": ["Mensi celkovy ulozny prostor", "Nizsí polozene predmety dole"]},
     "item_b": {"name": "Regal 200 cm", "height": 200, "price_from": 849, "shelves": 5, "capacity": 875,
                "pros": ["Vice ulozneho prostoru", "Lepsi vyuziti vertikalniho prostoru", "Ideální pro vysoke prostory"],
                "cons": ["Vyssi cena", "Horni police tezko pristupna pro nizsí postavy", "Ne vsude se vejde"]},
     "verdict": "Regal 180 cm je univerzalnejsi volba pro vetsinu prostor. Regal 200 cm doporucujeme do vysokych garazí a skladu."},
    {"id": "cerny-vs-zinkovany", "slug": "srovnani-cerny-vs-zinkovany-regal",
     "title": "Cerny vs zinkovany regal - co je lepsi?",
     "item_a": {"name": "Cerny (lakovany) regal", "price_from": 599, "surface": "Lakovany",
                "pros": ["Elegantni vzhled", "Vhodny do interieru", "Sirsi nabidka rozmeru"],
                "cons": ["Méne odolny vlhkosti", "Narocnejsi na udrzbu ve vlhku"]},
     "item_b": {"name": "Zinkovany regal", "price_from": 549, "surface": "Pozinkovany",
                "pros": ["Nejvyssi odolnost korozi", "Ideální do vlhka", "Nizsi cena", "Dlouha zivotnost 20+ let"],
                "cons": ["Prumyslovy vzhled", "Omezene barevne varianty"]},
     "verdict": "Do sucha (kancelar, byt) volte cerny lakovany regal. Do vlhka (sklep, garaz) jednoznacne zinkovany."},
    {"id": "150-vs-180", "slug": "srovnani-regal-150-vs-180-cm",
     "title": "Regal 150 cm vs 180 cm - srovnani a doporuceni",
     "item_a": {"name": "Regal 150 cm", "height": 150, "price_from": 549, "shelves": 4, "capacity": 700,
                "pros": ["Kompaktni velikost", "Nejnizsi cena", "4 police staci pro zakladni potreby", "Snadny pristup ke vsem policim"],
                "cons": ["Mensi ulozna kapacita", "Pouze 4 police"]},
     "item_b": {"name": "Regal 180 cm", "height": 180, "price_from": 629, "shelves": 5, "capacity": 875,
                "pros": ["5 polic = vice mista", "Vyssi celkova nosnost 875 kg", "Nejprodavanejsi velikost"],
                "cons": ["Horni police mene pristupna", "Vyssi cena"]},
     "verdict": "Regal 150 cm je idealni pro male prostory a tam kde potrebujete snadny pristup. Regal 180 cm nabizi lepsi pomer cena/ulozny prostor."},
    {"id": "90-vs-120-sirka", "slug": "srovnani-regal-sirka-90-vs-120-cm",
     "title": "Regal sirka 90 cm vs 120 cm - jak vybrat?",
     "item_a": {"name": "Regal sirka 90 cm", "width": 90, "price_from": 649,
                "pros": ["Univerzalni sirka", "Vejde se do vetsiny prostor", "Nizsi cena"],
                "cons": ["Mensi ulozna plocha"]},
     "item_b": {"name": "Regal sirka 120 cm", "width": 120, "price_from": 1149,
                "pros": ["Maximalni ulozna plocha", "Ideální pro velke predmety", "Profesionalni vyuziti"],
                "cons": ["Vyzaduje vetsi prostor", "Vyssi cena"]},
     "verdict": "Sirka 90 cm je standard pro domacnost a dilnu. Sirku 120 cm volte pro profesionalni sklady a e-shopy."},
    {"id": "novy-vs-bazar", "slug": "srovnani-novy-vs-bazarovy-regal",
     "title": "Novy regal z vyprodeje vs bazarovy regal",
     "item_a": {"name": "Novy regal z vyprodeje", "price_from": 549,
                "pros": ["100% novy a nerozbaleny", "Plna zaruka 7 let", "Vsechny dily kompletni", "Znamá nosnost a parametry"],
                "cons": ["O neco drazsi nez bazar (ale ne vzdy)"]},
     "item_b": {"name": "Bazarovy (pouzity) regal", "price_from": 300,
                "pros": ["Muze byt levnejsi", "Okamzite k vyzvednuti"],
                "cons": ["Zadna zaruka", "Neznamý stav a historie", "Mozne poškozeni a rez", "Chybejici dily"]},
     "verdict": "Novy regal z vyprodeje je jasna volba. Za cenu od 549 Kc ziskate nové zbozi se zarukou - casto levneji nez na bazaru."},
]

# ============================================================
# PRODUCT TYPES / COLORS for directory-style pages
# ============================================================
COLORS = [
    {"id": "cerna", "name": "Cerny", "name_cs": "cerny", "hex": "#1a1a1a", "label": "Cerne regaly", "slug": "cerne-regaly"},
    {"id": "bila", "name": "Bily", "name_cs": "bily", "hex": "#ffffff", "label": "Bile regaly", "slug": "bile-regaly"},
    {"id": "cervena", "name": "Cerveny", "name_cs": "cerveny", "hex": "#dc2626", "label": "Cervene regaly", "slug": "cervene-regaly"},
    {"id": "modra", "name": "Modry", "name_cs": "modry", "hex": "#2563eb", "label": "Modre regaly", "slug": "modre-regaly"},
    {"id": "zinkovany", "name": "Zinkovany", "name_cs": "zinkovany", "hex": "#9ca3af", "label": "Zinkovane regaly", "slug": "zinkovane-regaly"},
]

# ============================================================
# DIMENSIONS for directory-style pages
# ============================================================
HEIGHTS = [150, 180, 200, 220]
WIDTHS = [40, 60, 70, 90, 120]
DEPTHS = [30, 40, 45, 50]

# ============================================================
# USE CASES / ITEMS stored on shelves
# ============================================================
USE_CASES = [
    {"id": "naradi", "name": "Naradi", "slug": "regaly-na-naradi", "category": "garaz"},
    {"id": "pneumatiky", "name": "Pneumatiky", "slug": "regaly-na-pneumatiky", "category": "garaz"},
    {"id": "vino", "name": "Vino", "slug": "regaly-na-vino", "category": "sklep"},
    {"id": "zavareniny", "name": "Zavareniny", "slug": "regaly-na-zavareniny", "category": "sklep"},
    {"id": "knihy", "name": "Knihy", "slug": "regaly-na-knihy", "category": "byt"},
    {"id": "boxy", "name": "Ulozne boxy", "slug": "regaly-na-boxy", "category": "sklad"},
    {"id": "krabice", "name": "Krabice", "slug": "regaly-na-krabice", "category": "eshop"},
    {"id": "dokumenty", "name": "Dokumenty a sanony", "slug": "regaly-na-dokumenty", "category": "kancelar"},
    {"id": "potraviny", "name": "Potraviny", "slug": "regaly-na-potraviny", "category": "spiz"},
    {"id": "obleceni", "name": "Obleceni", "slug": "regaly-na-obleceni", "category": "satna"},
]

# ============================================================
# EXISTING PAGES (from current site) - for internal linking
# ============================================================
EXISTING_PAGES = [
    {"slug": "index", "title": "Uvod"},
    {"slug": "katalog", "title": "Katalog regalu"},
    {"slug": "faq", "title": "Caste dotazy"},
    {"slug": "kontakt", "title": "Kontakt"},
    {"slug": "o-nas", "title": "O nas"},
    {"slug": "likvidace-skladu-regaly", "title": "Likvidace skladu"},
    {"slug": "bazarove-regaly", "title": "Bazarove regaly"},
    {"slug": "slevy-na-regaly", "title": "Slevy na regaly"},
    {"slug": "regaly-do-garaze", "title": "Regaly do garaze"},
    {"slug": "regaly-do-sklepa", "title": "Regaly do sklepa"},
    {"slug": "regaly-do-dilny", "title": "Regaly do dilny"},
    {"slug": "zinkove-regaly", "title": "Zinkove regaly"},
    {"slug": "montaz-regalu", "title": "Montaz regalu"},
    {"slug": "nosnost-regalu", "title": "Nosnost regalu"},
    {"slug": "srovnani-regalu", "title": "Srovnani regalu"},
    {"slug": "jak-vybrat-regal", "title": "Jak vybrat regal"},
    {"slug": "cerne-regaly", "title": "Cerne regaly"},
    {"slug": "bile-regaly", "title": "Bile regaly"},
    {"slug": "cervene-regaly", "title": "Cervene regaly"},
    {"slug": "modre-regaly", "title": "Modre regaly"},
    {"slug": "regaly-do-kancelare", "title": "Regaly do kancelare"},
    {"slug": "regaly-do-spize", "title": "Regaly do spize"},
    {"slug": "regaly-do-satny", "title": "Regaly do satny"},
    {"slug": "regaly-pro-e-shop", "title": "Regaly pro e-shop"},
    {"slug": "regaly-do-archivu", "title": "Regaly do archivu"},
    {"slug": "slovnik", "title": "Slovnik pojmu"},
    {"slug": "srovnavac", "title": "Srovnavac regalu"},
    {"slug": "quiz", "title": "Vyber regalu - kviz"},
]
