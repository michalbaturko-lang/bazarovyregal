#!/usr/bin/env python3
"""
Generate product photos using Meshy.ai Text-to-Image API
Shows shelves in real-life settings (garage, basement, kitchen, etc.)
"""

import requests
import time
import json
import os

API_KEY = "msy_NAoNj5DjRCjmhHigpZ39kBjVFA0DKODGBcoU"
BASE_URL = "https://api.meshy.ai/openapi/v1"

# Diverse prompts for product photos
PROMPTS = [
    {
        "id": "garage_with_tools",
        "prompt": "A professional photo of a 5-tier gray metal storage shelf in a modern home garage, filled with organized power tools, toolboxes, and car accessories. Clean concrete floor, natural light from garage door, automotive workshop atmosphere. Realistic photography style, high quality, 4K",
        "negative_prompt": "blurry, low quality, text, watermark, distorted"
    },
    {
        "id": "basement_wine_storage",
        "prompt": "A cozy wine cellar with a galvanized metal shelving unit storing wine bottles and glass jars with preserves. Brick walls, soft warm lighting, rustic atmosphere. A person in casual clothes organizing bottles on the shelf. Realistic interior photography, high detail",
        "negative_prompt": "cartoon, blurry, low quality, text, watermark"
    },
    {
        "id": "modern_home_office",
        "prompt": "A minimalist white metal shelf unit in a bright Scandinavian home office. The shelf holds books, folders, decorative plants and a small desk lamp. Large window with natural daylight, wooden desk nearby. Professional interior design photography, clean aesthetic",
        "negative_prompt": "messy, cluttered, blurry, cartoon, text"
    },
    {
        "id": "workshop_heavy_duty",
        "prompt": "An industrial blue and orange heavy-duty metal storage rack in a professional workshop. Stacked with heavy machinery parts, metal boxes, and equipment. A worker in safety vest organizing items. Dramatic overhead lighting, authentic workshop environment. Commercial photography style",
        "negative_prompt": "fake, CGI looking, blurry, text, watermark"
    },
    {
        "id": "pantry_kitchen",
        "prompt": "A white metal kitchen pantry shelf in a bright modern kitchen, organized with canned foods, jars of spices, pasta containers, and kitchen supplies. Marble countertop visible, pendant lights above. Food storage organization inspiration photo, lifestyle photography",
        "negative_prompt": "dirty, messy, blurry, low quality, cartoon"
    }
]

def create_text_to_image_task(prompt_data):
    """Create a text-to-image generation task"""
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "prompt": prompt_data["prompt"],
        "negative_prompt": prompt_data.get("negative_prompt", ""),
        "model": "nano-banana-pro",  # or "nano-banana" for faster/cheaper
        "aspect_ratio": "16:9",  # Good for product photos
        "output_format": "png"
    }

    print(f"\n📸 Creating task: {prompt_data['id']}")
    print(f"   Prompt: {prompt_data['prompt'][:80]}...")

    try:
        response = requests.post(
            f"{BASE_URL}/text-to-image",
            headers=headers,
            json=payload,
            timeout=30
        )

        print(f"   Response status: {response.status_code}")

        if response.status_code in [200, 201, 202]:
            result = response.json()
            print(f"   Task created: {result}")
            return result
        else:
            print(f"   Error: {response.text}")
            return None

    except Exception as e:
        print(f"   Exception: {e}")
        return None

def check_task_status(task_id):
    """Check the status of a generation task"""
    headers = {
        "Authorization": f"Bearer {API_KEY}"
    }

    try:
        response = requests.get(
            f"{BASE_URL}/text-to-image/{task_id}",
            headers=headers,
            timeout=30
        )

        if response.status_code == 200:
            return response.json()
        else:
            print(f"   Status check error: {response.status_code} - {response.text}")
            return None

    except Exception as e:
        print(f"   Status check exception: {e}")
        return None

def wait_for_completion(task_id, max_wait=300):
    """Wait for a task to complete"""
    print(f"   Waiting for task {task_id} to complete...")
    start_time = time.time()

    while time.time() - start_time < max_wait:
        status = check_task_status(task_id)

        if status:
            state = status.get("status", "unknown")
            print(f"   Status: {state}")

            if state == "SUCCEEDED":
                return status
            elif state in ["FAILED", "EXPIRED"]:
                print(f"   Task failed: {status}")
                return None

        time.sleep(10)  # Check every 10 seconds

    print("   Timeout waiting for task")
    return None

def download_image(url, filename):
    """Download generated image"""
    try:
        response = requests.get(url, timeout=60)
        if response.status_code == 200:
            with open(filename, 'wb') as f:
                f.write(response.content)
            print(f"   ✅ Downloaded: {filename}")
            return True
    except Exception as e:
        print(f"   Download error: {e}")
    return False

def main():
    """Generate 5 test product photos"""
    print("=" * 60)
    print("🖼️  Meshy.ai Product Photo Generator")
    print("=" * 60)

    # First, let's test the API connection
    print("\n📡 Testing API connection...")
    headers = {"Authorization": f"Bearer {API_KEY}"}

    try:
        # Try to list existing tasks to verify API key
        response = requests.get(f"{BASE_URL}/text-to-image", headers=headers, timeout=10)
        print(f"API Test Response: {response.status_code}")
        print(f"Response: {response.text[:500] if response.text else 'Empty'}")
    except Exception as e:
        print(f"API Test Error: {e}")

    results = []

    # Generate each photo
    for i, prompt_data in enumerate(PROMPTS[:5], 1):
        print(f"\n{'='*60}")
        print(f"📷 Photo {i}/5: {prompt_data['id']}")
        print(f"{'='*60}")

        # Create task
        task = create_text_to_image_task(prompt_data)

        if task:
            task_id = task.get("result") or task.get("id") or task.get("task_id")
            if task_id:
                # Wait for completion
                completed = wait_for_completion(task_id)

                if completed:
                    # Get image URL
                    image_url = completed.get("image_url") or completed.get("output", {}).get("url")
                    if image_url:
                        # Download image
                        filename = f"product_photo_{prompt_data['id']}.png"
                        if download_image(image_url, filename):
                            results.append({
                                "id": prompt_data['id'],
                                "file": filename,
                                "url": image_url,
                                "status": "success"
                            })
                        else:
                            results.append({"id": prompt_data['id'], "status": "download_failed"})
                    else:
                        results.append({"id": prompt_data['id'], "status": "no_url", "data": completed})
                else:
                    results.append({"id": prompt_data['id'], "status": "generation_failed"})
            else:
                results.append({"id": prompt_data['id'], "status": "no_task_id", "data": task})
        else:
            results.append({"id": prompt_data['id'], "status": "task_creation_failed"})

    # Summary
    print("\n" + "=" * 60)
    print("📊 SUMMARY")
    print("=" * 60)

    for r in results:
        status_icon = "✅" if r["status"] == "success" else "❌"
        print(f"{status_icon} {r['id']}: {r['status']}")
        if r.get("file"):
            print(f"   File: {r['file']}")
        if r.get("data"):
            print(f"   Data: {json.dumps(r['data'], indent=2)[:200]}")

    return results

if __name__ == "__main__":
    main()
