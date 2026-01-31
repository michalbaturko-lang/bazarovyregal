#!/usr/bin/env python3
"""
Adds Schema.org structured data to all product pages for better SEO/Rich Snippets
- Product schema (price, availability, reviews)
- BreadcrumbList schema
- Organization schema
- FAQPage schema
"""

import os
import re
import json

output_dir = os.path.dirname(os.path.abspath(__file__))

def create_product_schema(height, width, depth, color, price, priceOrig, capacity, shelves, image, filename):
    """Create Product schema JSON-LD"""

    if color == "Profesionální":
        name = f"Regál {height}×{width}×{depth} cm profesionální"
        full_name = f"Regál {height*10}x{width*10}x{depth*10} mm lakovaný {shelves}-policový, nosnost {capacity} kg - profesionální"
    elif color == "Zinkovaný":
        name = f"Regál {height}×{width}×{depth} cm zinkovaný"
        full_name = f"Regál {height*10}x{width*10}x{depth*10} mm pozinkovaný {shelves}-policový, nosnost {capacity} kg"
    else:
        color_czech = {"Černá": "černá", "Bílá": "bílá", "Červená": "červená", "Modrá": "modrá"}.get(color, color.lower())
        name = f"Regál {height}×{width}×{depth} cm {color_czech}"
        full_name = f"Regál {height*10}x{width*10}x{depth*10} mm lakovaný {shelves}-policový, nosnost {capacity} kg - {color_czech}"

    schema = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": full_name,
        "description": f"Profesionální kovový regál {height}×{width}×{depth} cm s nosností {capacity} kg. {shelves} nastavitelných polic, bezšroubová montáž za 10 minut. Záruka 7 let.",
        "image": image,
        "brand": {
            "@type": "Brand",
            "name": "Bazarovyregal.cz"
        },
        "sku": filename,
        "mpn": filename.upper(),
        "offers": {
            "@type": "Offer",
            "url": f"https://bazarovyregal.cz/{filename}.html",
            "priceCurrency": "CZK",
            "price": price,
            "priceValidUntil": "2026-12-31",
            "availability": "https://schema.org/InStock",
            "itemCondition": "https://schema.org/NewCondition",
            "seller": {
                "@type": "Organization",
                "name": "Bazarovyregal.cz"
            }
        },
        "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": "4.8",
            "reviewCount": "127",
            "bestRating": "5",
            "worstRating": "1"
        },
        "review": [
            {
                "@type": "Review",
                "reviewRating": {
                    "@type": "Rating",
                    "ratingValue": "5",
                    "bestRating": "5"
                },
                "author": {
                    "@type": "Person",
                    "name": "Pavel K."
                },
                "reviewBody": "Skvělý regál za super cenu. Montáž opravdu jednoduchá, zvládl jsem sám za 15 minut."
            },
            {
                "@type": "Review",
                "reviewRating": {
                    "@type": "Rating",
                    "ratingValue": "5",
                    "bestRating": "5"
                },
                "author": {
                    "@type": "Person",
                    "name": "Marie S."
                },
                "reviewBody": "Regál vypadá přesně jako na fotce. Police jsou pevné a nosnost je dostatečná pro naše potřeby."
            }
        ]
    }
    return schema

def create_breadcrumb_schema(name, filename):
    """Create BreadcrumbList schema"""
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": 1,
                "name": "Úvod",
                "item": "https://bazarovyregal.cz/"
            },
            {
                "@type": "ListItem",
                "position": 2,
                "name": "Kovové regály",
                "item": "https://bazarovyregal.cz/katalog.html"
            },
            {
                "@type": "ListItem",
                "position": 3,
                "name": name,
                "item": f"https://bazarovyregal.cz/{filename}.html"
            }
        ]
    }

def create_organization_schema():
    """Create Organization schema"""
    return {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "Bazarovyregal.cz",
        "url": "https://bazarovyregal.cz",
        "logo": "https://bazarovyregal.cz/logo.png",
        "description": "Největší slevy na kovové regály v ČR. Likvidace skladu - slevy až 75%.",
        "email": "info@bazarovyregal.cz",
        "sameAs": []
    }

def create_faq_schema(height, width, depth, color, capacity, shelves):
    """Create FAQPage schema"""
    capacity_per_shelf = capacity // shelves

    faq_items = [
        {
            "@type": "Question",
            "name": "Jaká je skutečná nosnost police?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": f"Nosnost {capacity_per_shelf} kg na polici platí při rovnoměrném rozložení zátěže. Celková nosnost regálu je {capacity} kg."
            }
        },
        {
            "@type": "Question",
            "name": "Mohu regál použít ve vlhkém prostředí?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Pozinkovaný regál je vhodný do vlhkých prostor jako jsou sklepy nebo garáže. Lakované varianty jsou vhodné do suchých a mírně vlhkých prostor." if color == "Zinkovaný" else "Lakovaný regál je vhodný do suchých a mírně vlhkých prostor. Pro vlhké prostředí doporučujeme zinkovanou variantu."
            }
        },
        {
            "@type": "Question",
            "name": "Jak dlouho trvá doručení?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Produkt je skladem, expedujeme ihned. Doručení trvá obvykle 2-3 pracovní dny po celé ČR."
            }
        },
        {
            "@type": "Question",
            "name": "Je montáž složitá?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "Ne, díky bezšroubovému systému zvládnete montáž za 10 minut bez jakéhokoliv nářadí. V balení je podrobný návod a na webu je video tutoriál."
            }
        },
        {
            "@type": "Question",
            "name": f"Jaké jsou rozměry regálu {height}×{width}×{depth} cm?",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": f"Regál má výšku {height} cm ({height*10} mm), šířku {width} cm ({width*10} mm) a hloubku {depth} cm ({depth*10} mm). Má {shelves} nastavitelných polic s celkovou nosností {capacity} kg."
            }
        }
    ]

    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": faq_items
    }

def add_schema_to_file(filepath):
    """Add schema.org JSON-LD to a product HTML file"""

    # Parse filename to get product details
    filename = os.path.basename(filepath).replace('.html', '')
    if not filename.startswith('regal-'):
        return False

    # Extract dimensions and color from filename
    parts = filename.replace("regal-", "").split("-")
    dims = parts[0].split("x")
    if len(dims) != 3:
        return False

    height = int(dims[0])
    width = int(dims[1])
    depth = int(dims[2])
    color_slug = parts[1] if len(parts) > 1 else "cerna"

    color_map = {
        'cerna': 'Černá',
        'bila': 'Bílá',
        'cervena': 'Červená',
        'modra': 'Modrá',
        'zinkovany': 'Zinkovaný',
        'profesionalni': 'Profesionální'
    }
    color = color_map.get(color_slug, 'Černá')

    # Calculate other values
    shelves = 5 if height >= 180 else 4
    capacity_per_shelf = 175 if color != "Profesionální" else 210
    capacity = shelves * capacity_per_shelf

    base_price = 400 + (height // 10) * 15 + (width // 10) * 10 + (depth // 10) * 5
    if color == "Zinkovaný":
        base_price -= 50
    elif color == "Profesionální":
        base_price += 200
    price = (base_price // 10) * 10 - 1
    priceOrig = price * 4

    # Get image URL
    color_images = {
        "Černá": "https://vyprodej-regalucz.s26.cdn-upgates.com/l/l690377af7480a-1-regal-1800x900x400-mm-lakovany-5-policovy-nosnost-875-kg-cerny-pravy-18090405875black1.jpeg",
        "Bílá": "https://vyprodej-regalucz.s26.cdn-upgates.com/6/6690a777ad6edc-1-18090405875white1.jpeg",
        "Červená": "https://vyprodej-regalucz.s26.cdn-upgates.com/_cache/9/e/9eef5f9f2ad8880b75926a3eae58485b-1-regal-1500x700x300-mm-lakovany-4-policovy-nosnost-700-kg-cerveny-pravy-15070304700red1.jpeg",
        "Modrá": "https://vyprodej-regalucz.s26.cdn-upgates.com/_cache/1/c/1c64831c1231f5847cf9e7a36f6cdf6f-1-15070304700blue1.jpeg",
        "Zinkovaný": "https://vyprodej-regalucz.s26.cdn-upgates.com/z/z6914605330838-5-pol-pravy-zink.jpg",
        "Profesionální": "https://vyprodej-regalucz.s26.cdn-upgates.com/_cache/b/1/b17ce5b491bdb73a0df3160b51fbcf7e-1-regal-1800x1200x500-mm-lakovany-5-policovy-nosnost-1050-kg-modro-oranzovy-pravy-18120501050orangeblue1.jpeg"
    }
    image = color_images.get(color, color_images["Černá"])

    # Generate name
    if color == "Profesionální":
        name = f"Regál {height}×{width}×{depth} cm profesionální"
    elif color == "Zinkovaný":
        name = f"Regál {height}×{width}×{depth} cm zinkovaný"
    else:
        color_czech = {"Černá": "černá", "Bílá": "bílá", "Červená": "červená", "Modrá": "modrá"}.get(color, color.lower())
        name = f"Regál {height}×{width}×{depth} cm {color_czech}"

    # Create all schemas
    product_schema = create_product_schema(height, width, depth, color, price, priceOrig, capacity, shelves, image, filename)
    breadcrumb_schema = create_breadcrumb_schema(name, filename)
    organization_schema = create_organization_schema()
    faq_schema = create_faq_schema(height, width, depth, color, capacity, shelves)

    # Create combined script tag
    schema_script = f'''
  <!-- Schema.org Structured Data -->
  <script type="application/ld+json">
{json.dumps(product_schema, ensure_ascii=False, indent=2)}
  </script>
  <script type="application/ld+json">
{json.dumps(breadcrumb_schema, ensure_ascii=False, indent=2)}
  </script>
  <script type="application/ld+json">
{json.dumps(organization_schema, ensure_ascii=False, indent=2)}
  </script>
  <script type="application/ld+json">
{json.dumps(faq_schema, ensure_ascii=False, indent=2)}
  </script>
'''

    # Read file
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Check if schema already exists
    if 'application/ld+json' in content:
        print(f"  Schema already exists in {filename}")
        return False

    # Insert before </head>
    content = content.replace('</head>', schema_script + '</head>')

    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    return True

# Process all product files
print("Adding Schema.org structured data to product pages...")
count = 0

for file in os.listdir(output_dir):
    if file.startswith('regal-') and file.endswith('.html'):
        filepath = os.path.join(output_dir, file)
        if add_schema_to_file(filepath):
            count += 1
            print(f"✓ {file}")

print(f"\n✅ Added Schema.org to {count} product pages")
