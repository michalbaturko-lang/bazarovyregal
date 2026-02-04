#!/usr/bin/env python3
"""
Meshy.ai - Generate blue-orange industrial shelf photos
Uses TEXT-TO-IMAGE with very specific descriptions
"""

import requests
import time
import json
import os
from datetime import datetime

API_KEY = "msy_NAoNj5DjRCjmhHigpZ39kBjVFA0DKODGBcoU"
BASE_URL = "https://api.meshy.ai/openapi/v1"

# Very specific prompts for BLUE METAL FRAME + ORANGE MDF shelf
SCENES = [
    {
        "id": "garage_modro_oranzovy",
        "prompt": """A heavy-duty industrial metal storage shelf in a modern garage interior.
The shelf has a BLUE painted steel/metal frame structure with 5 ORANGE colored MDF wooden board shelves.
The blue frame is a vibrant industrial blue color, the shelves are warm orange/amber colored MDF boards.
On the shelves: organized tools, toolboxes, car tires, automotive supplies.
Two young adults in casual clothes discussing near the shelf.
Polished concrete floor, natural daylight from window.
Ultra photorealistic, 8K resolution, professional product photography, sharp details.""",
        "negative_prompt": "cartoon, anime, blurry, low quality, text, watermark, distorted faces, black shelf, white shelf, silver shelf, gray shelf"
    },
    {
        "id": "workshop_modro_oranzovy",
        "prompt": """A professional automotive workshop with an industrial metal shelving unit.
The shelf has a BLUE painted metal frame with 5 ORANGE MDF wooden board shelves.
Blue metal frame structure, orange/amber colored MDF shelf boards.
Filled with heavy machinery parts, metal toolboxes, spray cans, equipment.
Two technicians in blue work clothes discussing, one holding a tablet.
Industrial overhead lighting, concrete floor.
Ultra photorealistic, 8K, commercial photography, authentic workshop environment.""",
        "negative_prompt": "cartoon, blurry, low quality, text, watermark, unrealistic faces, black shelf, white shelf, gray shelf, CGI"
    },
    {
        "id": "warehouse_modro_oranzovy",
        "prompt": """A clean modern warehouse with multiple industrial metal shelving units in rows.
Each shelf has a BLUE metal frame structure with ORANGE MDF wooden board shelves.
Vibrant blue painted steel frames, warm orange colored MDF boards on each level.
Filled with organized cardboard boxes with labels.
Two warehouse workers in polo shirts checking inventory with handheld scanners.
High ceiling with industrial LED lighting, clean epoxy floor, skylights.
Ultra photorealistic, 8K, professional logistics photography.""",
        "negative_prompt": "dirty, chaotic, cartoon, blurry, text, watermark, unrealistic, dark, abandoned, gray shelf, black shelf"
    }
]

def create_text_to_image(scene):
    """Create text-to-image task"""
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "prompt": scene["prompt"],
        "negative_prompt": scene.get("negative_prompt", ""),
        "ai_model": "nano-banana-pro",
        "aspect_ratio": "16:9",
        "enable_multi_view": False
    }

    print(f"\n{'='*60}")
    print(f"📸 Scene: {scene['id']}")
    print(f"   Generating blue-orange industrial shelf...")

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
    """Generate blue-orange shelf photos using TEXT-TO-IMAGE"""
    print("=" * 60)
    print("🖼️  BLUE-ORANGE SHELF GENERATOR (Text-to-Image)")
    print("=" * 60)
    print(f"   Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"   Scenes: {len(SCENES)}")

    results = []

    for i, scene in enumerate(SCENES, 1):
        print(f"\n{'#'*60}")
        print(f"# PHOTO {i}/{len(SCENES)}")
        print(f"{'#'*60}")

        task_id = create_text_to_image(scene)

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

    return results

if __name__ == "__main__":
    main()
