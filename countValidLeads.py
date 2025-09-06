import redis
import json

def count_valid_leads():
    # connect to local redis (default: localhost:6379, db=0)
    r = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)

    # fetch all lead keys
    lead_keys = r.keys("lead_*")
    print(f"Total leads found: {len(lead_keys)}")

    valid_count = 0
    invalid_count = 0

    for key in lead_keys:
        value = r.get(key)  # each lead stored as JSON string
        if not value:
            continue
        try:
            lead_data = json.loads(value)
            if lead_data.get("leadData", {}).get("emailStatus") == "valid":
                valid_count += 1
            else:
                invalid_count += 1
        except json.JSONDecodeError:
            print(f"⚠️ Could not parse JSON for key: {key}")

    print(f"✅ Valid leads: {valid_count}")
    print(f"❌ Non-valid leads: {invalid_count}")

if __name__ == "__main__":
    count_valid_leads()