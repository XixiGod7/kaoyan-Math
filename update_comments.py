import json
import re
import urllib.request
import concurrent.futures
import time
import sys

sys.stdout.reconfigure(encoding='utf-8')

print("Reading data_crawled.js...")
with open("data_crawled.js", "r", encoding="utf-8") as f:
    content = f.read()

match = re.search(r"const\s+MATH_DB\s*=\s*({[\s\S]*});?", content)
if not match:
    print("Could not find MATH_DB!")
    sys.exit(1)

db = json.loads(match.group(1))

q_ids = []
for g, data in db.items():
    for p in data.get('papers', []):
        for q in p.get('questions', []):
            if 'id' in q:
                q_ids.append(str(q['id']))

q_ids = sorted(list(set(q_ids)))
print(f"Total unique question IDs: {len(q_ids)}")

print("Reading existing data_comments.js...")
existing_comments = {}
try:
    with open("data_comments.js", "r", encoding="utf-8") as f:
        c_content = f.read()
    match_c = re.search(r"const\s+COMMENTS_DB\s*=\s*({[\s\S]*});?", c_content)
    if match_c:
        existing_comments = json.loads(match_c.group(1))
        print(f"Loaded existing comments for {len(existing_comments)} questions.")
except Exception as e:
    print(f"Could not load existing comments: {e}")

all_comments = dict(existing_comments)

def fetch_comments(q_id):
    url = f"https://zhentiqiang.com/api/comments/{q_id}"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                res_data = json.loads(response.read().decode('utf-8'))
                if res_data.get('success'):
                    return q_id, res_data.get('comments', [])
        except Exception as e:
            time.sleep(0.5)
    return q_id, None

print("Fetching comments in parallel...")
start_time = time.time()
with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
    results = executor.map(fetch_comments, q_ids)
    
    total_comments_count = 0
    updated_count = 0
    for idx, (q_id, comments) in enumerate(results):
        if comments is not None:
            all_comments[q_id] = comments
            total_comments_count += len(comments)
            updated_count += 1
        if (idx + 1) % 100 == 0 or (idx + 1) == len(q_ids):
            print(f"Progress: {idx + 1}/{len(q_ids)} fetched...")

print(f"Done in {time.time() - start_time:.2f}s. Total questions with comments entry: {len(all_comments)}, Total comments: {total_comments_count}")

out_js = f"const COMMENTS_DB = {json.dumps(all_comments, ensure_ascii=False, indent=2)};\n"
with open("data_comments.js", "w", encoding="utf-8") as f:
    f.write(out_js)

print("data_comments.js updated successfully!")
