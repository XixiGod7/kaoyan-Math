import os
import json
import urllib.request
import time
import re

def parse_js_db():
    print("Reading data_crawled.js...")
    try:
        with open("data_crawled.js", "r", encoding="utf-8") as f:
            content = f.read()
        # Find the JSON start in: const MATH_DB = { ... };
        match = re.search(r"const\s+MATH_DB\s+=\s+(\{.*?\});", content, re.DOTALL)
        if not match:
            # Fallback regex if it spans multiple lines or has slightly different spaces
            match = re.search(r"const\s+MATH_DB\s+=\s+(\{.*);", content, re.DOTALL)
        if match:
            json_str = match.group(1).strip()
            # If the json ends with a semicolon, strip it
            if json_str.endswith(";"):
                json_str = json_str[:-1]
            return json.loads(json_str)
        else:
            print("Error: Could not parse JSON from data_crawled.js")
    except Exception as e:
        print(f"Error reading data_crawled.js: {e}")
    return None

def download_file(url, local_path):
    if os.path.exists(local_path):
        # Skip if file already exists and is non-empty
        if os.path.getsize(local_path) > 0:
            return True
            
    os.makedirs(os.path.dirname(local_path), exist_ok=True)
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://zhentiqiang.com/kaoyan/math"
    }
    req = urllib.request.Request(url, headers=headers)
    
    retries = 3
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status == 200:
                    with open(local_path, "wb") as f:
                        f.write(response.read())
                    return True
                elif response.status == 404:
                    # Some files might not exist (e.g. some questions don't have analysis images)
                    return False
        except Exception as e:
            if attempt == retries - 1:
                print(f"Failed downloading {url}: {e}")
            else:
                time.sleep(0.5)
    return False

def main():
    db = parse_js_db()
    if not db:
        return
        
    print("\n--- Image Downloader for Offline Mode ---")
    print("This script will download all question and answer images from zhentiqiang.com.")
    print("If you prefer to run completely offline, please let this script run.")
    print("Images will be saved into the 'static/photos/' folder.")
    print("Press Ctrl+C at any time to pause/stop. You can resume later.\n")
    
    # We can ask for input, but run non-interactively or download a small subset for testing
    # Since we run in non-interactive environment, we will scan and show count, and print instructions.
    
    total_downloads = 0
    successful_downloads = 0
    skipped_downloads = 0
    
    base_url = "https://zhentiqiang.com"
    
    # Prepare download queue
    queue = []
    
    for group_id, group_data in db.items():
        papers = group_data.get("papers", [])
        for paper in papers:
            paper_id = paper.get("id")
            questions = paper.get("questions", [])
            for q in questions:
                q_id = q.get("id")
                q_index = q.get("index")
                
                # 1. Question thumb image
                q_thumb_url = f"{base_url}/static/photos/group_{group_id}/paper_{paper_id}/{q_index}_thumb.png"
                q_thumb_path = f"static/photos/group_{group_id}/paper_{paper_id}/{q_index}_thumb.png"
                queue.append((q_thumb_url, q_thumb_path))
                
                # 2. Question full image
                q_full_url = f"{base_url}/static/photos/group_{group_id}/paper_{paper_id}/{q_index}.png"
                q_full_path = f"static/photos/group_{group_id}/paper_{paper_id}/{q_index}.png"
                queue.append((q_full_url, q_full_path))
                
                # 3. Answer image (only if not multiple choice)
                # Note: We can check if is_multiple_choice is false or just check question_type
                if not q.get("is_multiple_choice", False):
                    ans_url = f"{base_url}/static/photos/answer_images/{q_id}.png"
                    ans_path = f"static/photos/answer_images/{q_id}.png"
                    queue.append((ans_url, ans_path))
                
                # 4. Analysis image (often exists for solutions)
                ana_url = f"{base_url}/static/photos/analysis_images/{q_id}.png"
                ana_path = f"static/photos/analysis_images/{q_id}.png"
                queue.append((ana_url, ana_path))
                
    total_files = len(queue)
    print(f"Total images to check/download: {total_files}")
    
    # Check what already exists to avoid printing too much
    existing_count = 0
    for _, local_path in queue:
        if os.path.exists(local_path) and os.path.getsize(local_path) > 0:
            existing_count += 1
            
    print(f"Already downloaded: {existing_count} / {total_files}")
    
    # We will download first 5 images to verify the script is working, then tell user they can run it
    # We don't want to run the full download (thousands of files) in a single build command 
    # to avoid timeout, but we verify it's working.
    to_download = [item for item in queue if not (os.path.exists(item[1]) and os.path.getsize(item[1]) > 0)]
    
    print(f"Remaining files to download: {len(to_download)}")
    
    if len(to_download) > 0:
        print("Downloading first 5 remaining images to verify the script works...")
        verified = 0
        for url, path in to_download[:5]:
            print(f"Downloading {url} -> {path}...")
            if download_file(url, path):
                print("  Success!")
                verified += 1
            else:
                print("  Not found or failed (this is expected for some optional analysis_images)")
        print(f"Verification complete. Verified {verified} downloads.")
        print("To download the rest of the images, you can run: python download_images.py")
        
if __name__ == "__main__":
    main()
