#!/usr/bin/env python3
"""
Add FAQ Schema.org to faq.html for rich snippets in Google
"""

import json
import re

# FAQ data extracted from the page
FAQ_DATA = [
    # Objednávka a platba
    {
        "question": "Jak objednat?",
        "answer": "Objednávka je velmi jednoduchá: Vyberte si regál na našem webu nebo na Vyprodej-regalu.cz, přidejte regál do košíku, vyplňte doručovací adresu, zvolte způsob platby (karta, převod, dobírka) a potvrďte objednávku."
    },
    {
        "question": "Jaké jsou platební možnosti?",
        "answer": "Na Vyprodej-regalu.cz přijímáme: Platbu kartou (okamžitá platba, nejrychlejší zpracování), Převod na účet (můžete zaplatit převodem z banky) a Dobírku (zaplatíte při doručení zboží, bez poplatku)."
    },
    {
        "question": "Můžu objednat na firmu?",
        "answer": "Ano, zcela bez problému! Při objednávce si můžete vybrat jako zákazník fyzickou osobu nebo právnickou osobu. Pokud objednáváte na IČO, stačí to uvést při objednávce a faktura se vygeneruje automaticky."
    },
    {
        "question": "Je možné vyzvednout osobně?",
        "answer": "Ano, ale pouze v Praze po předchozí domluvě. Máme skladiště v Praze, kde si můžete zboží vyzvednout osobně. Vyzvednutí je bezplatné, domluvte se emailem: info@bazarovyregal.cz, Po-Pá 8:00-16:00."
    },
    # Doprava
    {
        "question": "Kolik stojí doprava?",
        "answer": "Základní sazba je 99 Kč pro regály do 30 kg. Těžší regály mají cenu vypočtenou podle hmotnosti. Doprava ZDARMA je pro objednávky nad 2000 Kč."
    },
    {
        "question": "Jak dlouho trvá doručení?",
        "answer": "Expediční lhůta je do 24 hodin od potvrzení objednávky. Doručení trvá 2-3 pracovní dny. Objednáte-li do 14:00, objednávka se expeduje do konce dne."
    },
    {
        "question": "Kam doručujete?",
        "answer": "Doručujeme do celé České republiky. Praha a okolí má výběr konkrétního času, ostatní části ČR mají doručení v pracovní dny. Doručujeme na adresu domu, kanceláře nebo skladu."
    },
    {
        "question": "Doručíte i na Slovensko?",
        "answer": "Ano! Pro slovenské zákazníky máme speciální web Bazarovyregal.sk se stejnými produkty a cenami, slovenskou podporou a fakturací."
    },
    # Produkty
    {
        "question": "Jsou regály nové?",
        "answer": "Ano, 100% nové a nerozbalené! Všechny regály jsou zcela nové, v originálním balení od výrobce, bez poškození a se všemi součástmi a návodem v češtině."
    },
    {
        "question": "Jaká je nosnost regálů?",
        "answer": "Nosnost se liší podle typu: Regály do domu (4-policové) mají 700 kg, regály do garáže 700-875 kg a profesionální regály 1000-1200 kg. Přesná nosnost je vždy uvedena v popisu produktu."
    },
    {
        "question": "Z čeho jsou regály vyrobené?",
        "answer": "Regály mají ocelové nosné sloupy. Lakované regály jsou přepískovány a pokryty kvalitní barvou (černá, bílá, červená, modrá). Zinkované regály mají zinkovou vrstvu metodou horké zinkování, ideální do garáží."
    },
    {
        "question": "Lze nastavit výšku polic?",
        "answer": "Ano! Výška polic je nastavitelná po 3,5 cm. Jednoduché vyjmutí a přesunutí police bez nářadí. Typicky 5-6 pozic na výšku."
    },
    # Montáž
    {
        "question": "Je montáž složitá?",
        "answer": "Ne! Montáž je velmi jednoduchá a trvá jen 10 minut. Naše regály mají bezšroubový systém - policie jednoduše vsuňete do sloupů. Bez vrtání, bez elektrického nářadí, zvládnete to sami."
    },
    {
        "question": "Potřebuji nářadí?",
        "answer": "Ne, stačí vám gumová palička, abyste polici lehčeji zasunuli do sloupů. Bez vrtačky, bez šroubováku."
    },
    {
        "question": "Je k dispozici návod?",
        "answer": "Ano! V balení je tištěný návod v češtině krok za krokem s barevnými ilustracemi. Online je také YouTube návod s postupem montáže."
    },
    # Záruka
    {
        "question": "Jaká je záruka?",
        "answer": "7 let záruka na všechny regály! Záruka pokrývá rozbitý nebo deformovaný ocelový rám, prasklé police, opotřebované části a jakékoliv výrobní vady."
    },
    {
        "question": "Co když mi regál nevyhovuje?",
        "answer": "Máte 30 dní na vrácení bez udání důvodu! Vrácení je bezplatné (platíme dopravu), peníze vrátíme do 14 dnů. Regál se musí vrátit v původním stavu."
    },
    {
        "question": "Jak reklamovat?",
        "answer": "Napište e-mail na info@bazarovyregal.cz, popište problém s fotografiemi a uveďte číslo objednávky. Odpověď do 48 hodin, řešení formou náhrady, vrácení peněz nebo opravy."
    },
    # O nás
    {
        "question": "Kdo jste?",
        "answer": "Bazarovyregal.cz je prezentační web pro nákupní platformu Vyprodej-regalu.cz. Všechny weby jsou spravovány stejným týmem se stejnými zárukami, cenami a službami."
    },
    {
        "question": "Proč jsou ceny tak nízké?",
        "answer": "Ceny jsou nízké, protože probíhá likvidace skladu! Máme velké přebytky zásob, regály se hromadily ve skladě a musíme je co nejrychleji prodat. Marže je nižší, počítáme na objem prodeje."
    },
    {
        "question": "Jsou slevy skutečné?",
        "answer": "Ano, všechny slevy jsou 100% skutečné! Procento slevy je vždy vypočteno oproti originální ceně od výrobce nebo standardní ceně v běžném obchodě. Nikdy si nenadzvedáme cenu a pak ji neslevujeme."
    }
]

def generate_faq_schema():
    """Generate FAQPage Schema.org JSON-LD."""
    schema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": []
    }

    for faq in FAQ_DATA:
        schema["mainEntity"].append({
            "@type": "Question",
            "name": faq["question"],
            "acceptedAnswer": {
                "@type": "Answer",
                "text": faq["answer"]
            }
        })

    return json.dumps(schema, ensure_ascii=False, indent=2)

def main():
    faq_path = '/sessions/modest-sweet-allen/mnt/Downloads/bazarovyregal-deploy/faq.html'

    with open(faq_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Check if FAQ schema already exists
    if '"@type": "FAQPage"' in content:
        print("FAQ Schema already exists!")
        return

    # Generate schema
    schema = generate_faq_schema()
    schema_tag = f'<script type="application/ld+json">\n{schema}\n</script>'

    # Add before </head>
    content = content.replace('</head>', f'{schema_tag}\n</head>')

    with open(faq_path, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"✅ Added FAQ Schema with {len(FAQ_DATA)} questions!")

if __name__ == '__main__':
    main()
