#!/usr/bin/env python3
"""
Meshy.ai Photo Generator v2 - IMAGE-TO-IMAGE
Takes actual product photos and places them in lifestyle scenes
KEEPS the original shelf design!
"""

import requests
import time
import json
import os
from datetime import datetime

API_KEY = "msy_NAoNj5DjRCjmhHigpZ39kBjVFA0DKODGBcoU"
BASE_URL = "https://api.meshy.ai/openapi/v1"

# ACTUAL product images - these will be transformed
PRODUCT_IMAGES = {
    "modro_oranzovy": {
        "url": "https://vyprodej-regalucz.s26.cdn-upgates.com/_cache/b/1/b17ce5b491bdb73a0df3160b51fbcf7e-1-regal-1800x1200x500-mm-lakovany-5-policovy-nosnost-1050-kg-modro-oranzovy-pravy-18120501050orangeblue1.jpeg",
        "description": "blue and orange industrial metal shelf"
    },
    "zinkovany": {
        "url": "https://vyprodej-regalucz.s26.cdn-upgates.com/z/z6914605330838-5-pol-pravy-zink.jpg",
        "description": "galvanized zinc metal shelf"
    },
    "cerny": {
        "url": "https://vyprodej-regalucz.s26.cdn-upgates.com/l/l690377af7480a-1-regal-1800x900x400-mm-lakovany-5-policovy-nosnost-875-kg-cerny-pravy-18090405875black1.jpeg",
        "description": "black metal shelf"
    },
    "bily": {
        "url": "https://vyprodej-regalucz.s26.cdn-upgates.com/6/6690a777ad6edc-1-18090405875white1.jpeg",
        "description": "white metal shelf"
    }
}

# Scenes - each uses a specific product image as reference
SCENES = [
    {
        "id": "garage_modro_oranzovy",
        "product": "modro_oranzovy",
        "prompt": """Place this exact blue and orange metal shelf in a modern garage interior.
Keep the shelf design EXACTLY as shown - blue metal frame with orange MDF boards.
Add organized tools, toolboxes, and car tires on the shelves.
Two young adults in casual clothes discussing near the shelf.
Polished concrete floor, natural daylight from window.
Ultra photorealistic, 8K, professional photography."""
    },
    {
        "id": "workshop_modro_oranzovy",
        "product": "modro_oranzovy",
        "prompt": """Place this exact blue and orange industrial shelf in a professional automotive workshop.
Keep the shelf design EXACTLY as shown - blue metal frame with orange shelves.
Fill with heavy machinery parts, metal toolboxes, spray cans.
Two technicians in work clothes discussing with tablet.
Industrial overhead lighting. Ultra photorealistic, 8K."""
    },
    {
        "id": "warehouse_modro_oranzovy",
        "product": "modro_oranzovy",
        "prompt": """Place multiple of these exact blue and orange shelving units in a clean warehouse.
Keep the shelf design EXACTLY as shown - blue frames with orange boards.
Filled with organized cardboard boxes with labels.
Two warehouse workers checking inventory with scanners.
High ceiling, industrial LED lighting, clean epoxy floor. 8K photorealistic."""
    },
    {
        "id": "garage_zinkovany",
        "product": "zinkovany",
        "prompt": """Place this exact galvanized zinc metal shelf in a clean modern garage.
Keep the shelf design EXACTLY as shown - silver/zinc metal with MDF boards.
Add organized storage bins, power tools, automotive supplies.
Man in casual clothes organizing items on the shelf.
Bright LED lighting, natural light from garage window. 8K photorealistic."""
    },
    {
        "id": "basement_zinkovany",
        "product": "zinkovany",
        "prompt": """Place this exact galvanized zinc shelf in an organized basement storage room.
Keep the shelf design EXACTLY as shown - zinc metal frame with MDF boards.
Labeled storage boxes, seasonal decorations, camping gear on shelves.
Young couple sorting items together, smiling.
Bright ceiling lights, neutral walls. 8K photorealistic."""
    },
    {
        "id": "office_cerny",
        "product": "cerny",
        "prompt": """Place this exact black metal shelf in a bright modern home office.
Keep the shelf design EXACTLY as shown - black metal frame with MDF boards.
Display books, folders, plants in white pots, office supplies.
Professional woman working at desk nearby.
Large window with natural daylight, Scandinavian design. 8K photorealistic."""
    },
    {
        "id": "living_room_cerny",
        "product": "cerny",
        "prompt": """Place this exact black metal bookshelf in a cozy contemporary living room.
Keep the shelf design EXACTLY as shown - black metal frame with MDF shelves.
Display books, vinyl records, decorative objects, green plants.
Couple relaxing - man reading on sofa, woman browsing shelf.
Warm ambient lighting, comfortable gray sofa. 8K photorealistic."""
    },
    {
        "id": "kitchen_bily",
        "product": "bily",
        "prompt": """Place this exact white metal pantry shelf in a bright modern kitchen.
Keep the shelf design EXACTLY as shown - white metal frame with MDF boards.
Organize with canned foods, glass jars of spices, pasta containers.
Mother and young daughter organizing items together, smiling.
Marble countertop, pendant lights, natural window light. 8K photorealistic."""
    }
]

def create_image_to_image(scene):
    """Create image-to-image task - transforms product photo into lifestyle scene"""
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    product = PRODUCT_IMAGES[scene["product"]]

    payload = {
        "reference_image_urls": [product["url"]],  # Array of reference images
        "prompt": scene["prompt"],
        "ai_model": "nano-banana-pro",
        "aspect_ratio": "16:9"
    }

    print(f"\n{'='*60}")
    print(f"📸 Scene: {scene['id']}")
    print(f"   Product: {scene['product']} ({product['description']})")
    print(f"   Source: {product['url'][:60]}...")

    try:
        response = requests.post(
            f"{BASE_URL}/image-to-image",
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
            print(f"   ❌ Error: {response.text[:300]}")
            return None

    except Exception as e:
        print(f"   ❌ Exception: {e}")
        return None

def check_status(task_id):
    """Check task status"""
    headers = {"Authorization": f"Bearer {API_KEY}"}
    try:
        response = requests.get(
            f"{BASE_URL}/image-to-image/{task_id}",
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
                print(f"   ✅ Completed!")
                return status
            elif state in ["FAILED", "EXPIRED"]:
                print(f"   ❌ Failed: {status.get('task_error', {})}")
                return None
            else:
                print(f"   Status: {state} ({progress}%)", end="\r")

        time.sleep(10)

    print(f"   ⚠️ Timeout")
    return None

def download_image(url, filename):
    """Download generated image"""
    try:
        response = requests.get(url, timeout=60)
        if response.status_code == 200:
            os.makedirs("generated_photos_v2", exist_ok=True)
            filepath = f"generated_photos_v2/{filename}"
            with open(filepath, 'wb') as f:
                f.write(response.content)
            print(f"   📁 Saved: {filepath}")
            return filepath
    except Exception as e:
        print(f"   Download error: {e}")
    return None

def main():
    """Generate lifestyle photos using IMAGE-TO-IMAGE"""
    print("=" * 60)
    print("🖼️  MESHY.AI IMAGE-TO-IMAGE GENERATOR v2")
    print("   Preserves original shelf design!")
    print("=" * 60)
    print(f"   Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"   Scenes: {len(SCENES)}")

    results = []

    for i, scene in enumerate(SCENES, 1):
        print(f"\n{'#'*60}")
        print(f"# PHOTO {i}/{len(SCENES)}")
        print(f"{'#'*60}")

        task_id = create_image_to_image(scene)

        if task_id:
            completed = wait_for_completion(task_id)

            if completed:
                print(f"\n   📋 Response keys: {list(completed.keys())}")

                output_url = None
                for field in ['output', 'outputs', 'image_url', 'image_urls', 'output_url']:
                    value = completed.get(field)
                    if value:
                        print(f"   Found '{field}': {str(value)[:100]}")
                        if isinstance(value, str) and 'http' in value:
                            output_url = value
                            break
                        elif isinstance(value, list) and value:
                            first = value[0]
                            if isinstance(first, str) and 'http' in first:
                                output_url = first
                                break

                if output_url:
                    filename = f"{scene['id']}.png"
                    filepath = download_image(output_url, filename)
                    results.append({
                        "scene": scene["id"],
                        "product": scene["product"],
                        "status": "success",
                        "url": output_url,
                        "file": filepath
                    })
                else:
                    print(f"\n   ❌ No output URL. Full response:")
                    print(json.dumps(completed, indent=2))
                    results.append({
                        "scene": scene["id"],
                        "status": "no_url",
                        "data": completed
                    })
            else:
                results.append({"scene": scene["id"], "status": "generation_failed"})
        else:
            results.append({"scene": scene["id"], "status": "task_failed"})

        if i < len(SCENES):
            print("\n   Waiting 5s...")
            time.sleep(5)

    # Summary
    print("\n" + "=" * 60)
    print("📊 SUMMARY")
    print("=" * 60)

    success = [r for r in results if r["status"] == "success"]
    print(f"\n✅ Success: {len(success)}/{len(results)}")

    for r in results:
        icon = "✅" if r["status"] == "success" else "❌"
        print(f"  {icon} {r['scene']}: {r.get('file', r['status'])}")

    os.makedirs("generated_photos_v2", exist_ok=True)
    with open("generated_photos_v2/results.json", "w") as f:
        json.dump(results, f, indent=2)

    return results

if __name__ == "__main__":
    main()
