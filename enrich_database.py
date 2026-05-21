import json
import re
import urllib.request
import concurrent.futures
import time
import sys

# Set stdout to UTF-8
sys.stdout.reconfigure(encoding='utf-8')

db_file = r"d:\PersonalFiles\anti-gravity_test\kaoyan-Math\data_crawled.js"

print("Reading database...")
with open(db_file, 'r', encoding='utf-8') as f:
    content = f.read()

match = re.search(r'const\s+MATH_DB\s*=\s*({[\s\S]*});?', content)
if not match:
    print("Could not find MATH_DB in data_crawled.js!")
    sys.exit(1)

db = json.loads(match.group(1))

# Extract all unique question IDs
unique_q_ids = set()
for group_id, data in db.items():
    for paper in data.get('papers', []):
        for q in paper.get('questions', []):
            if 'id' in q:
                unique_q_ids.add(q['id'])

print(f"Found {len(unique_q_ids)} unique question IDs across all groups.")

# Dictionary to store fetched details
q_details = {}

def fetch_q_info(q_id):
    url = f"https://zhentiqiang.com/api/question_info/{q_id}"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                res_data = json.loads(response.read().decode('utf-8'))
                if res_data.get('success'):
                    return q_id, res_data
        except Exception as e:
            time.sleep(0.5)
    return q_id, None

# Fetch in parallel
print("Fetching question info from API...")
start_time = time.time()
with concurrent.futures.ThreadPoolExecutor(max_workers=30) as executor:
    results = executor.map(fetch_q_info, unique_q_ids)
    
    success_count = 0
    for idx, (q_id, info) in enumerate(results):
        if info:
            q_details[q_id] = info
            success_count += 1
        if (idx + 1) % 100 == 0:
            print(f"Progress: {idx + 1}/{len(unique_q_ids)} checked, {success_count} succeeded.")

print(f"Finished fetching in {time.time() - start_time:.2f} seconds. Successful: {success_count}/{len(unique_q_ids)}")

# Enrich the database
print("Enriching database...")
for group_id, data in db.items():
    for paper in data.get('papers', []):
        for q in paper.get('questions', []):
            q_id = q.get('id')
            if q_id in q_details:
                info = q_details[q_id]
                q['answer'] = info.get('answer')
                q['knowledge_point_name'] = info.get('knowledge_point_name')
                # Overwrite question_type, score, video_url if they differ or are missing
                if info.get('question_type'):
                    q['question_type'] = info.get('question_type')
                if info.get('score'):
                    q['score'] = info.get('score')
                if info.get('video_url'):
                    q['video_url'] = info.get('video_url')

# Write back to file
new_db_js = f"const MATH_DB = {json.dumps(db, ensure_ascii=False, indent=2)};\n"
with open(db_file, 'w', encoding='utf-8') as f:
    f.write(new_db_js)

print("Database data_crawled.js enriched successfully!")
