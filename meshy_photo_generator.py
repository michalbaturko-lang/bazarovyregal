#!/usr/bin/env python3
"""
Meshy.ai Photo Generator - Text-to-Image
Generates photorealistic lifestyle photos of shelves
Based on product reference images
"""

import requests
import time
import json
import os
from datetime import datetime

API_KEY = "msy_NAoNj5DjRCjmhHigpZ39kBjVFA0DKODGBcoU"
BASE_URL = "https://api.meshy.ai/openapi/v1"

# Source product images for reference
PRODUCT_IMAGES = {
    "zinkovany": "https://vyprodej-regalucz.s26.cdn-upgates.com/z/z6914605330838-5-pol-pravy-zink.jpg",
    "cerny": "https://vyprodej-regalucz.s26.cdn-upgates.com/l/l690377af7480a-1-regal-1800x900x400-mm-lakovany-5-policovy-nosnost-875-kg-cerny-pravy-18090405875black1.jpeg",
    "bily": "https://vyprodej-regalucz.s26.cdn-upgates.com/6/6690a777ad6edc-1-18090405875white1.jpeg",
    "modro_oranzovy": "https://vyprodej-regalucz.s26.cdn-upgates.com/_cache/b/1/b17ce5b491bdb73a0df3160b51fbcf7e-1-regal-1800x1200x500-mm-lakovany-5-policovy-nosnost-1050-kg-modro-oranzovy-pravy-18120501050orangeblue1.jpeg",
}

# Photorealistic scene prompts - based on user's style
SCENES = [
    {
        "id": "garage_couple_tools",
        "shelf_color": "blue and orange",
        "shelf_type": "heavy-duty industrial",
        "prompt": """A single sleek, modern METAL shelf with minimalist MDF boards rests against a well-organized garage wall, illuminated by soft natural daylight. The floor gleams with polished concrete, complemented by neatly arranged tools, toolboxes, and car tires stored on the shelf. Two young adults in casual clothes discuss projects, vibrant sunlight streaming in through a large window, creating a serene atmosphere.

CRITICAL REQUIREMENTS:
- The shelf MUST be METAL with MDF shelves - blue metal frame with orange MDF boards
- Ultra photorealistic, 8K resolution, professional photography quality
- Natural lighting with soft shadows and realistic reflections
- Sharp details, high clarity, professional depth of field
- Ultra-realistic facial features, skin texture, natural expressions on the people
- Finely detailed textures on all surfaces""",
        "negative_prompt": "cartoon, anime, blurry, low quality, text, watermark, distorted faces, unrealistic skin, CGI looking, plastic, cheap looking, dark, gloomy"
    },
    {
        "id": "garage_man_organizing",
        "shelf_color": "galvanized silver/zinc",
        "shelf_type": "galvanized metal",
        "prompt": """A sturdy galvanized METAL storage shelf with MDF boards in a clean modern garage. The zinc-coated shelf holds organized plastic storage bins, power tools, and automotive supplies. Clean polished concrete floor, bright overhead LED lighting mixed with natural light from garage windows. A man in his 30s wearing casual jeans and t-shirt organizes items on the shelf, looking focused.

CRITICAL REQUIREMENTS:
- GALVANIZED/ZINC metal shelf with light wood MDF boards
- Ultra photorealistic, 8K resolution, professional photography
- Natural lighting, soft shadows, realistic reflections
- Ultra-realistic facial features and natural expression
- Professional interior photography quality""",
        "negative_prompt": "cartoon, blurry, low quality, text, watermark, unrealistic faces, distorted, CGI, fake looking"
    },
    {
        "id": "basement_couple_storage",
        "shelf_color": "galvanized silver/zinc",
        "shelf_type": "galvanized metal",
        "prompt": """A clean organized basement storage room with a galvanized METAL shelf unit. The zinc-coated shelf holds labeled storage boxes, seasonal decorations, and camping equipment. Neutral light concrete walls, bright ceiling LED lights. A young couple in casual weekend clothes sorting through items together, talking and smiling naturally.

CRITICAL REQUIREMENTS:
- GALVANIZED/ZINC metal shelf with MDF boards
- Ultra photorealistic rendering, 8K quality
- Bright, well-lit environment
- Natural facial expressions, realistic skin textures
- Professional lifestyle photography style""",
        "negative_prompt": "dark, scary, dirty, cartoon, blurry, fake looking, text, watermark, horror"
    },
    {
        "id": "home_office_woman",
        "shelf_color": "black",
        "shelf_type": "modern black metal",
        "prompt": """A sleek BLACK METAL shelf with light MDF boards in a bright modern home office. The shelf displays books, folders, decorative plants in white pots, and stylish office supplies. Large window with natural daylight, minimalist wooden desk nearby, Scandinavian interior design. A young professional woman in smart casual outfit works at the desk while the shelf provides organized storage behind her.

CRITICAL REQUIREMENTS:
- BLACK metal frame with light MDF shelf boards
- Ultra photorealistic, 8K, professional interior photography
- Soft natural lighting through window
- Modern minimalist aesthetic
- Realistic textures and materials""",
        "negative_prompt": "messy, cluttered, cartoon, blurry, unrealistic, dark, gloomy, text, watermark, cheap"
    },
    {
        "id": "workshop_professionals",
        "shelf_color": "blue and orange",
        "shelf_type": "heavy-duty industrial",
        "prompt": """A heavy-duty BLUE AND ORANGE METAL industrial storage rack in a professional automotive workshop. The robust shelf is loaded with heavy machinery parts, metal toolboxes, spray paint cans, and equipment. A technician in blue work clothes and safety glasses discusses with a colleague holding a tablet. Dramatic overhead industrial lighting creates professional atmosphere.

CRITICAL REQUIREMENTS:
- BLUE metal frame with ORANGE MDF shelf boards - industrial look
- Ultra photorealistic, commercial photography style, 8K
- Authentic workshop environment
- Natural skin textures, realistic facial expressions
- Professional lighting with some dramatic shadows""",
        "negative_prompt": "fake, CGI, cartoon, blurry, text, watermark, unrealistic faces, clean room"
    },
    {
        "id": "kitchen_pantry_family",
        "shelf_color": "white",
        "shelf_type": "white metal pantry",
        "prompt": """A WHITE METAL kitchen pantry shelf with light MDF boards in a bright modern kitchen. The shelf is neatly organized with canned foods, glass jars of spices, pasta containers, cereal boxes, and kitchen supplies. White marble countertop visible, modern pendant lights above. A mother arranges items while her young daughter helps hand her a jar, both smiling warmly.

CRITICAL REQUIREMENTS:
- WHITE metal frame with light MDF shelf boards
- Ultra photorealistic food photography style, 8K
- Bright, inviting kitchen atmosphere
- Natural window lighting
- Realistic family interaction, genuine expressions""",
        "negative_prompt": "dirty, messy, cartoon, blurry, low quality, unrealistic, dark, text, watermark, sad"
    },
    {
        "id": "living_room_couple",
        "shelf_color": "black",
        "shelf_type": "modern black metal",
        "prompt": """A modern BLACK METAL bookshelf with MDF shelves in a cozy contemporary living room. The shelf displays hardcover books, vinyl records, decorative objects, and green plants. Warm soft ambient lighting from floor lamp, comfortable gray sofa nearby. A young couple relaxing, man reading on couch while woman browses items on the shelf. Evening atmosphere.

CRITICAL REQUIREMENTS:
- BLACK metal frame with light MDF boards
- Ultra photorealistic interior photography, 8K
- Warm, cozy lighting atmosphere
- Realistic fabric textures on sofa
- Natural couple interaction""",
        "negative_prompt": "dark, gloomy, cartoon, blurry, unrealistic, cheap, text, watermark, empty room"
    },
    {
        "id": "warehouse_workers",
        "shelf_color": "blue and orange",
        "shelf_type": "industrial warehouse racking",
        "prompt": """Multiple BLUE AND ORANGE METAL industrial shelving units arranged in rows in a clean modern warehouse. Organized inventory boxes with barcode labels, pallets of goods. Two warehouse workers in company polo shirts checking inventory with handheld scanners. High ceiling with industrial LED lighting, clean epoxy concrete floors, large skylights letting in natural light.

CRITICAL REQUIREMENTS:
- BLUE metal frames with ORANGE shelf boards - professional warehouse look
- Ultra photorealistic commercial photography, 8K
- Clean, organized logistics environment
- Professional workers in realistic uniforms
- Bright, well-lit industrial space""",
        "negative_prompt": "dirty, chaotic, cartoon, blurry, text, watermark, unrealistic, dark, abandoned"
    }
]

def create_text_to_image(scene):
    """Create text-to-image task on Meshy.ai"""
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "prompt": scene["prompt"],
        "negative_prompt": scene.get("negative_prompt", ""),
        "ai_model": "nano-banana-pro",  # REQUIRED! Options: nano-banana, nano-banana-pro
        "aspect_ratio": "16:9",
        "enable_multi_view": False
    }

    print(f"\n{'='*60}")
    print(f"📸 Scene: {scene['id']}")
    print(f"   Shelf: {scene['shelf_color']} {scene['shelf_type']}")
    print(f"   Prompt length: {len(scene['prompt'])} chars")

    try:
        response = requests.post(
            f"{BASE_URL}/text-to-image",
            headers=headers,
            json=payload,
            timeout=60
        )

        print(f"   Response: {response.status_code}")

        if response.status_code in [200, 201, 202]:
            result = response.json()
            task_id = result.get("result")
            print(f"   ✅ Task created: {task_id}")
            return task_id
        else:
            error_text = response.text[:300]
            print(f"   ❌ Error: {error_text}")

            # If API structure is different, try to parse and adapt
            try:
                error_json = response.json()
                print(f"   Error details: {json.dumps(error_json, indent=2)[:500]}")
            except:
                pass

            return None

    except Exception as e:
        print(f"   ❌ Exception: {e}")
        return None

def check_status(task_id):
    """Check task status"""
    headers = {"Authorization": f"Bearer {API_KEY}"}

    try:
        response = requests.get(
            f"{BASE_URL}/text-to-image/{task_id}",
            headers=headers,
            timeout=30
        )

        if response.status_code == 200:
            return response.json()
        return None
    except:
        return None

def wait_for_completion(task_id, max_wait=300):
    """Wait for task to complete"""
    print(f"   ⏳ Waiting for completion...")
    start = time.time()

    while time.time() - start < max_wait:
        status = check_status(task_id)

        if status:
            state = status.get("status", "unknown")
            progress = status.get("progress", 0)

            if state == "SUCCEEDED":
                print(f"   ✅ Completed!")
                return status
            elif state in ["FAILED", "EXPIRED"]:
                print(f"   ❌ Failed: {status.get('task_error', {})}")
                return None
            else:
                print(f"   Status: {state} ({progress}%)", end="\r")

        time.sleep(10)

    print(f"   ⚠️ Timeout after {max_wait}s")
    return None

def download_image(url, filename):
    """Download generated image"""
    try:
        response = requests.get(url, timeout=60)
        if response.status_code == 200:
            os.makedirs("generated_photos", exist_ok=True)
            filepath = f"generated_photos/{filename}"
            with open(filepath, 'wb') as f:
                f.write(response.content)
            print(f"   📁 Saved: {filepath}")
            return filepath
    except Exception as e:
        print(f"   Download error: {e}")
    return None

def main():
    """Generate all lifestyle photos"""
    print("=" * 60)
    print("🖼️  MESHY.AI PHOTOREALISTIC LIFESTYLE GENERATOR")
    print("   Bazarovyregal.cz - Product Photography")
    print("=" * 60)
    print(f"   Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"   Scenes: {len(SCENES)}")

    # Test API
    print("\n📡 Testing API...")
    try:
        headers = {"Authorization": f"Bearer {API_KEY}"}
        r = requests.get(f"{BASE_URL}/text-to-image", headers=headers, timeout=10)
        print(f"   API response: {r.status_code}")

        if r.status_code == 401:
            print("   ❌ API key invalid!")
            return []
        elif r.status_code == 404:
            print("   ℹ️ Endpoint check - will try generation")
        else:
            print(f"   Response: {r.text[:200]}")
    except Exception as e:
        print(f"   Connection test: {e}")

    results = []

    for i, scene in enumerate(SCENES, 1):
        print(f"\n{'#'*60}")
        print(f"# PHOTO {i}/{len(SCENES)}")
        print(f"{'#'*60}")

        task_id = create_text_to_image(scene)

        if task_id:
            completed = wait_for_completion(task_id)

            if completed:
                # Debug: show all keys in response
                print(f"\n   📋 Response keys: {list(completed.keys())}")

                # Try to find output URL in various possible fields
                output_url = None

                # Check common field names for image output
                possible_fields = ['output', 'outputs', 'image_url', 'image_urls',
                                   'result_url', 'generated_image', 'generated_images',
                                   'thumbnail_url', 'preview_url', 'download_url']

                for field in possible_fields:
                    value = completed.get(field)
                    if value:
                        print(f"   Found '{field}': {str(value)[:150]}")
                        if isinstance(value, str) and 'http' in value:
                            output_url = value
                            break
                        elif isinstance(value, list) and value:
                            first = value[0]
                            if isinstance(first, str) and 'http' in first:
                                output_url = first
                                break
                            elif isinstance(first, dict):
                                output_url = first.get('url') or first.get('image_url') or first.get('download_url')
                                if output_url:
                                    break

                if output_url:
                    filename = f"{scene['id']}.png"
                    filepath = download_image(output_url, filename)
                    results.append({
                        "scene": scene["id"],
                        "status": "success",
                        "url": output_url,
                        "file": filepath
                    })
                else:
                    # Print full response for debugging
                    print(f"\n   ❌ No output URL found!")
                    print(f"   Full response:\n{json.dumps(completed, indent=2)}")
                    results.append({
                        "scene": scene["id"],
                        "status": "no_url",
                        "data": completed
                    })
            else:
                results.append({
                    "scene": scene["id"],
                    "status": "generation_failed"
                })
        else:
            results.append({
                "scene": scene["id"],
                "status": "task_failed"
            })

        # Delay between requests
        if i < len(SCENES):
            print("\n   Waiting 5s before next scene...")
            time.sleep(5)

    # Summary
    print("\n" + "=" * 60)
    print("📊 SUMMARY")
    print("=" * 60)

    success = [r for r in results if r["status"] == "success"]
    failed = [r for r in results if r["status"] != "success"]

    print(f"\n✅ Success: {len(success)}/{len(results)}")
    print(f"❌ Failed: {len(failed)}/{len(results)}")

    print("\nGenerated files:")
    for r in results:
        icon = "✅" if r["status"] == "success" else "❌"
        print(f"  {icon} {r['scene']}: {r.get('file', r['status'])}")

    # Save results
    os.makedirs("generated_photos", exist_ok=True)
    with open("generated_photos/results.json", "w") as f:
        json.dump(results, f, indent=2)

    print(f"\n📄 Results: generated_photos/results.json")

    return results

if __name__ == "__main__":
    results = main()
