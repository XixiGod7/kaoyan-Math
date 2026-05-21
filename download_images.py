import os
import json
import urllib.request
import time
import re
from concurrent.futures import ThreadPoolExecutor, as_completed

def parse_js_db():
    print("Reading data_crawled.js...")
    try:
        with open("data_crawled.js", "r", encoding="utf-8") as f:
            content = f.read()
        match = re.search(r"const\s+MATH_DB\s+=\s+(\{.*?\});", content, re.DOTALL)
        if not match:
            match = re.search(r"const\s+MATH_DB\s+=\s+(\{.*);", content, re.DOTALL)
        if match:
            json_str = match.group(1).strip()
            if json_str.endswith(";"):
                json_str = json_str[:-1]
            return json.loads(json_str)
        else:
            print("Error: Could not parse JSON from data_crawled.js")
    except Exception as e:
        print(f"Error reading data_crawled.js: {e}")
    return None

def download_file(item):
    url, local_path = item
    if os.path.exists(local_path):
        if os.path.getsize(local_path) > 0:
            return local_path, True
            
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
                    return local_path, True
                elif response.status == 404:
                    return local_path, False
        except Exception as e:
            if attempt == retries - 1:
                return local_path, False
            time.sleep(0.5)
    return local_path, False

def main():
    db = parse_js_db()
    if not db:
        return
        
    print("\n--- Image Downloader for Offline Mode ---")
    
    base_url = "https://zhentiqiang.com"
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
                queue.append((f"{base_url}/static/photos/group_{group_id}/paper_{paper_id}/{q_index}_thumb.png", f"static/photos/group_{group_id}/paper_{paper_id}/{q_index}_thumb.png"))
                # 2. Question full image
                queue.append((f"{base_url}/static/photos/group_{group_id}/paper_{paper_id}/{q_index}.png", f"static/photos/group_{group_id}/paper_{paper_id}/{q_index}.png"))
                
                # 3. Answer image
                if not q.get("is_multiple_choice", False):
                    queue.append((f"{base_url}/static/photos/answer_images/{q_id}.png", f"static/photos/answer_images/{q_id}.png"))
                
                # 4. Analysis image
                queue.append((f"{base_url}/static/photos/analysis_images/{q_id}.png", f"static/photos/analysis_images/{q_id}.png"))
                
    total_files = len(queue)
    print(f"Total possible images: {total_files}")
    
    to_download = [item for item in queue if not (os.path.exists(item[1]) and os.path.getsize(item[1]) > 0)]
    existing_count = total_files - len(to_download)
    print(f"Already downloaded: {existing_count} / {total_files}")
    print(f"Remaining files to attempt downloading: {len(to_download)}")
    
    if len(to_download) > 0:
        print("Starting concurrent download...")
        with ThreadPoolExecutor(max_workers=20) as executor:
            futures = {executor.submit(download_file, item): item for item in to_download}
            count = 0
            successful = 0
            for future in as_completed(futures):
                count += 1
                path, success = future.result()
                if success:
                    successful += 1
                if count % 100 == 0:
                    print(f"Progress: {count}/{len(to_download)} (Successful: {successful})")
                    
        print(f"Download complete! Successfully downloaded {successful} new images.")
    else:
        print("All images are already downloaded!")

if __name__ == "__main__":
    main()
