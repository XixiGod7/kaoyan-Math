import urllib.request
import json
import os

def fetch_group_data(group_id):
    url = f"https://zhentiqiang.com/api/bootstrap?group_id={group_id}"
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
    )
    print(f"Fetching data for group_id={group_id}...")
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            if response.status == 200:
                data = json.loads(response.read().decode('utf-8'))
                print(f"Successfully fetched data for group_id={group_id}. Papers: {len(data.get('papers', []))}")
                return data
            else:
                print(f"Failed to fetch group_id={group_id}. Status: {response.status}")
    except Exception as e:
        print(f"Error fetching group_id={group_id}: {e}")
    return None

def main():
    groups = {
        8: "数学一",
        9: "数学二",
        10: "数学三"
    }
    
    db = {}
    for gid, name in groups.items():
        data = fetch_group_data(gid)
        if data:
            db[gid] = data
        else:
            print(f"Warning: Could not fetch data for {name} (group_id={gid})")
            
    if not db:
        print("Error: No data fetched. Aborting.")
        return

    # Write data to JS file
    out_path = "data_crawled.js"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("/**\n")
        f.write(" * 考研数学真题系统 - 爬取的原始结构化数据\n")
        f.write(" * 包含数学一(8), 数学二(9), 数学三(10)的完整试卷与考点\n")
        f.write(" */\n\n")
        f.write("const MATH_DB = ")
        json.dump(db, f, ensure_ascii=False, indent=2)
        f.write(";\n")
        
    print(f"Successfully wrote database to {out_path} ({os.path.getsize(out_path)} bytes)")

if __name__ == "__main__":
    main()
