import redis
import json
import csv

def export_valid_leads_to_csv(redis_host="localhost", redis_port=6379, output_file="valid_leads.csv"):
    # Connect to Redis
    r = redis.StrictRedis(host=redis_host, port=redis_port, decode_responses=True)

    seen = set()           # avoid duplicate emails in CSV
    exported_count = 0
    skipped_already_exported = 0
    skipped_not_valid = 0

    with open(output_file, mode="w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(["firstName", "lastName", "companyName", "email"])

        for key in r.scan_iter("lead_*"):
            try:
                value = r.get(key)
                if not value:
                    continue

                data = json.loads(value)

                # Skip if already marked exported at root level
                if data.get("exported") is True:
                    skipped_already_exported += 1
                    continue

                lead_data = data.get("leadData", {})

                # Only consider leads with emailStatus == "valid"
                if lead_data.get("emailStatus") != "valid":
                    skipped_not_valid += 1
                    continue

                email = lead_data.get("email", "")
                if not email or email in seen:
                    continue

                first_name = lead_data.get("firstName", "")
                last_name = lead_data.get("lastName", "")
                company_name = lead_data.get("companyName", "")

                # Write to CSV
                writer.writerow([first_name, last_name, company_name, email])
                seen.add(email)
                exported_count += 1

                # Mark lead as exported in Redis (update root-level key)
                data["exported"] = True
                # Optional: preserve the same JSON formatting (ensure ascii handled)
                r.set(key, json.dumps(data, ensure_ascii=False))

            except Exception as e:
                print(f"❌ Error processing {key}: {e}")

    print("✅ Export completed!")
    print(f"  • Exported and marked: {exported_count}")
    print(f"  • Skipped (already exported): {skipped_already_exported}")
    print(f"  • Skipped (not valid): {skipped_not_valid}")

if __name__ == "__main__":
    export_valid_leads_to_csv()