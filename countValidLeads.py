import redis
import json

def count_unexported_valid_leads():
    # connect to local redis (default: localhost:6379, db=0)
    r = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)

    # fetch all lead keys
    lead_keys = r.keys("lead_*")
    print(f"Total leads found: {len(lead_keys)}")

    valid_unexported = 0
    valid_exported = 0
    invalid_count = 0

    for key in lead_keys:
        value = r.get(key)  # each lead stored as JSON string
        if not value:
            continue
        try:
            data = json.loads(value)
            lead_data = data.get("leadData", {})

            if lead_data.get("emailStatus") == "valid":
                if data.get("exported") is True:
                    valid_exported += 1
                else:
                    valid_unexported += 1
            else:
                invalid_count += 1

        except json.JSONDecodeError:
            print(f"⚠️ Could not parse JSON for key: {key}")

    print(f"📊 Stats:")
    print(f"   • Valid leads (unexported): {valid_unexported}")
    print(f"   • Valid leads (already exported): {valid_exported}")
    print(f"   • Non-valid leads: {invalid_count}")

if __name__ == "__main__":
    count_unexported_valid_leads()