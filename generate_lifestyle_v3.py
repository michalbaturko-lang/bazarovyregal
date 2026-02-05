#!/usr/bin/env python3
"""
Meshy.ai Lifestyle Photo Generator V3
Generates additional lifestyle photos for all product colors
"""

import requests
import time
import json
import os
from datetime import datetime

API_KEY = "msy_NAoNj5DjRCjmhHigpZ39kBjVFA0DKODGBcoU"
BASE_URL = "https://api.meshy.ai/openapi/v1"

# Additional scenes needed for each color
SCENES_TO_GENERATE = [
    # ZINKOVANY - needs 1 more (has garage, basement)
    {
        "id": "workshop_zinkovany",
        "color": "zinkovany",
        "prompt": """A sturdy GALVANIZED METAL storage shelf with natural MDF boards in a bright DIY workshop. The silver zinc-coated metal frame shelf holds organized power tools, hardware storage bins, and woodworking supplies. Clean concrete floor, workbench visible, bright natural light through windows. A man in his 40s wearing casual clothes examines a power drill from the shelf.

CRITICAL: GALVANIZED/ZINC silver metal frame, natural wood MDF shelves
Ultra photorealistic, 8K, professional photography, natural lighting""",
        "negative_prompt": "cartoon, blurry, low quality, text, watermark, colored metal frame"
    },

    # CERNY - needs 1 more (has office, living_room)
    {
        "id": "bedroom_cerny",
        "color": "cerny",
        "prompt": """A sleek BLACK METAL shelf with light MDF boards in a modern minimalist bedroom. The black metal frame shelf displays books, plants in white pots, decorative items and framed photos. Soft neutral bedding visible, large window with sheer curtains, Scandinavian design aesthetic. Morning sunlight creates warm atmosphere.

CRITICAL: BLACK metal frame, light wood MDF shelves
Ultra photorealistic, 8K, interior design photography, soft natural light""",
        "negative_prompt": "cartoon, blurry, text, watermark, dark, gloomy, messy"
    },

    # BILY - needs 2 more (has kitchen)
    {
        "id": "bathroom_bily",
        "color": "bily",
        "prompt": """A clean WHITE METAL shelf with light MDF boards in a bright modern bathroom. The white metal frame shelf holds neatly folded towels, bathroom supplies in baskets, plants and decorative items. White tiles, natural light through frosted window, spa-like atmosphere. Everything organized and pristine.

CRITICAL: WHITE metal frame, light wood MDF shelves
Ultra photorealistic, 8K, interior photography, bright clean lighting""",
        "negative_prompt": "dirty, messy, cartoon, blurry, text, watermark, dark"
    },
    {
        "id": "laundry_bily",
        "color": "bily",
        "prompt": """A practical WHITE METAL storage shelf with light MDF boards in a bright laundry room. The white metal frame shelf holds laundry baskets, detergent bottles, cleaning supplies organized in bins. Modern washing machine visible, bright overhead lighting, clean tile floor. A woman organizing supplies on the shelf.

CRITICAL: WHITE metal frame, light wood MDF shelves
Ultra photorealistic, 8K, lifestyle photography, bright interior""",
        "negative_prompt": "dirty, cartoon, blurry, text, watermark, dark, cluttered"
    },

    # MODRA (blue) - needs 3 new dedicated blue photos
    {
        "id": "garage_modra",
        "color": "modra",
        "prompt": """A sturdy BLUE METAL storage shelf with natural MDF boards in an organized garage. The BRIGHT BLUE powder-coated metal frame shelf holds tools, storage boxes and automotive supplies. Clean concrete floor, good overhead lighting, car visible in background. A man organizing items on the blue shelf.

CRITICAL: BRIGHT BLUE metal frame (not dark navy), natural MDF shelves
Ultra photorealistic, 8K, lifestyle photography""",
        "negative_prompt": "orange, cartoon, blurry, text, watermark, dark blue, navy"
    },
    {
        "id": "workshop_modra",
        "color": "modra",
        "prompt": """A heavy-duty BLUE METAL industrial shelf with MDF boards in a professional workshop. The BRIGHT BLUE powder-coated steel frame holds heavy equipment, tools and parts. Industrial concrete floor, bright overhead lights. Two workers in work clothes discussing near the blue shelf.

CRITICAL: BRIGHT BLUE metal frame only (no orange), MDF shelves
Ultra photorealistic, 8K, industrial photography""",
        "negative_prompt": "orange shelves, cartoon, blurry, text, watermark"
    },
    {
        "id": "basement_modra",
        "color": "modra",
        "prompt": """A practical BLUE METAL storage shelf with natural MDF boards in a clean organized basement. The BRIGHT BLUE metal frame shelf holds labeled storage boxes, seasonal items, and sports equipment. Good LED lighting, neutral walls, clean floor.

CRITICAL: BRIGHT BLUE metal frame, natural MDF shelves
Ultra photorealistic, 8K, interior photography""",
        "negative_prompt": "orange, dark, scary, cartoon, blurry, text, watermark"
    },

    # CERVENA (red) - needs 3 new dedicated red photos
    {
        "id": "garage_cervena",
        "color": "cervena",
        "prompt": """A sturdy RED METAL storage shelf with natural MDF boards in a well-organized garage. The BRIGHT RED powder-coated metal frame shelf holds tools, automotive supplies and storage bins. Clean garage floor, bright lighting, tool wall visible. A man retrieving tools from the red shelf.

CRITICAL: BRIGHT RED metal frame (fire engine red), natural MDF shelves
Ultra photorealistic, 8K, lifestyle photography""",
        "negative_prompt": "orange, blue, cartoon, blurry, text, watermark, dark red, maroon"
    },
    {
        "id": "workshop_cervena",
        "color": "cervena",
        "prompt": """A heavy-duty RED METAL industrial shelf with MDF boards in a professional auto workshop. The BRIGHT RED steel frame holds heavy tools, car parts and equipment. Industrial setting with lifts visible, bright overhead lights. Mechanic in work clothes near the red shelf.

CRITICAL: BRIGHT RED metal frame only, natural MDF shelves
Ultra photorealistic, 8K, industrial photography""",
        "negative_prompt": "blue frame, orange, cartoon, blurry, text, watermark"
    },
    {
        "id": "utility_cervena",
        "color": "cervena",
        "prompt": """A practical RED METAL storage shelf with natural MDF boards in a utility room. The BRIGHT RED metal frame shelf holds cleaning supplies, tools and storage boxes. Concrete floor, good lighting, functional space. Items neatly organized on the bold red shelf.

CRITICAL: BRIGHT RED metal frame, natural MDF shelves
Ultra photorealistic, 8K, interior photography""",
        "negative_prompt": "orange, blue, cartoon, blurry, text, watermark, dark"
    },
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
        "ai_model": "nano-banana-pro",
        "aspect_ratio": "4:3",
        "enable_multi_view": False
    }

    print(f"\n{'='*60}")
    print(f"📸 Generating: {scene['id']} ({scene['color']})")

    try:
        response = requests.post(
            f"{BASE_URL}/text-to-image",
            headers=headers,
            json=payload,
            timeout=60
        )

        if response.status_code in [200, 201, 202]:
            result = response.json()
            task_id = result.get("result")
            print(f"   ✅ Task: {task_id}")
            return task_id
        else:
            print(f"   ❌ Error {response.status_code}: {response.text[:200]}")
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
    print(f"   ⏳ Waiting...")
    start = time.time()

    while time.time() - start < max_wait:
        status = check_status(task_id)
        if status:
            state = status.get("status", "unknown")
            progress = status.get("progress", 0)

            if state == "SUCCEEDED":
                print(f"   ✅ Done!")
                return status
            elif state in ["FAILED", "EXPIRED"]:
                print(f"   ❌ Failed: {status.get('task_error', {})}")
                return None
            else:
                print(f"   {state} ({progress}%)    ", end="\r")

        time.sleep(10)

    print(f"   ⚠️ Timeout")
    return None

def download_image(url, filename, output_dir="lifestyle_photos"):
    """Download generated image"""
    try:
        response = requests.get(url, timeout=60)
        if response.status_code == 200:
            os.makedirs(output_dir, exist_ok=True)
            filepath = f"{output_dir}/{filename}"
            with open(filepath, 'wb') as f:
                f.write(response.content)
            print(f"   📁 Saved: {filepath}")
            return filepath
    except Exception as e:
        print(f"   Download error: {e}")
    return None

def get_output_url(completed):
    """Extract output URL from response"""
    possible_fields = ['output', 'outputs', 'image_url', 'image_urls',
                       'result_url', 'generated_image', 'generated_images']

    for field in possible_fields:
        value = completed.get(field)
        if value:
            if isinstance(value, str) and 'http' in value:
                return value
            elif isinstance(value, list) and value:
                first = value[0]
                if isinstance(first, str) and 'http' in first:
                    return first
                elif isinstance(first, dict):
                    return first.get('url') or first.get('image_url')
    return None

def main():
    """Generate all lifestyle photos"""
    print("=" * 60)
    print("🖼️  MESHY LIFESTYLE PHOTO GENERATOR V3")
    print(f"   {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"   Scenes to generate: {len(SCENES_TO_GENERATE)}")
    print("=" * 60)

    results = []

    for i, scene in enumerate(SCENES_TO_GENERATE, 1):
        print(f"\n[{i}/{len(SCENES_TO_GENERATE)}]")

        task_id = create_text_to_image(scene)

        if task_id:
            completed = wait_for_completion(task_id)

            if completed:
                output_url = get_output_url(completed)

                if output_url:
                    filename = f"{scene['id']}.png"
                    filepath = download_image(output_url, filename)
                    results.append({
                        "scene": scene["id"],
                        "color": scene["color"],
                        "status": "success",
                        "file": filepath
                    })
                else:
                    print(f"   ❌ No output URL")
                    results.append({"scene": scene["id"], "status": "no_url"})
            else:
                results.append({"scene": scene["id"], "status": "failed"})
        else:
            results.append({"scene": scene["id"], "status": "task_error"})

        # Wait between requests
        if i < len(SCENES_TO_GENERATE):
            print("   Waiting 5s...")
            time.sleep(5)

    # Summary
    print("\n" + "=" * 60)
    print("📊 SUMMARY")
    print("=" * 60)

    success = [r for r in results if r.get("status") == "success"]
    print(f"\n✅ Success: {len(success)}/{len(results)}")

    for r in results:
        icon = "✅" if r.get("status") == "success" else "❌"
        print(f"  {icon} {r['scene']}: {r.get('file', r.get('status'))}")

    # Save results
    with open("lifestyle_photos/generation_results_v3.json", "w") as f:
        json.dump(results, f, indent=2)

    return results

if __name__ == "__main__":
    main()
