import redis
import json
import csv

def export_valid_leads_to_csv(output_file="valid_leads.csv", use_local_redis=False):
    # Connect to Redis (Cloud by default, local for development)
    if use_local_redis:
        print("🔧 Using local Redis for development")
        r = redis.StrictRedis(
            host="localhost",
            port=6379,
            decode_responses=True
        )
    else:
        print("☁️  Using Redis Cloud (production)")
        r = redis.StrictRedis(
            host="redis-19391.c305.ap-south-1-1.ec2.redns.redis-cloud.com",
            port=19391,
            username="default",
            password="NnYhD1fDHufXmeuRc0y2MLoaxEFuKdps",
            db=0,
            decode_responses=True,
            socket_timeout=30,
            socket_connect_timeout=10
        )

    # Test Redis connection
    try:
        r.ping()
        print("✅ Connected to Redis Cloud successfully")
    except Exception as e:
        print(f"❌ Failed to connect to Redis Cloud: {e}")
        print("Check Redis Cloud connection and credentials")
        return

    seen = set()           # avoid duplicate emails in CSV
    exported_count = 0
    exported_with_email_content = 0
    exported_without_email_content = 0
    skipped_already_exported = 0
    skipped_not_valid = 0

    with open(output_file, mode="w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(["firstName", "lastName", "companyName", "email", "subject", "body"])

        for key in r.scan_iter("lead_*"):
            try:
                if key != "lead_ayush.malik@razorpay.com":
                    continue
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

                # Fetch email content (subject and body) from email cache
                subject = ""
                body = ""
                email_key = f"email_{email}"
                try:
                    email_data_raw = r.get(email_key)
                    if email_data_raw:
                        email_cache = json.loads(email_data_raw)
                        email_content = email_cache.get("emailData", {})
                        subject = email_content.get("subject", "")
                        body = email_content.get("body", "")
                        print(f"📧 Found email content for {email}")
                        print(f"   Subject: {subject[:50]}...")
                        print(f"   Body: {body[:100]}...")
                except Exception as e:
                    print(f"⚠️  Could not fetch email content for {email}: {e}")

                # Write to CSV
                writer.writerow([first_name, last_name, company_name, email, subject, body])
                seen.add(email)
                exported_count += 1
                
                # Track email content statistics
                if subject and body:
                    exported_with_email_content += 1
                else:
                    exported_without_email_content += 1

                # Mark lead as exported in Redis (update root-level key)
                data["exported"] = True
                # Optional: preserve the same JSON formatting (ensure ascii handled)
                r.set(key, json.dumps(data, ensure_ascii=False))

            except Exception as e:
                print(f"❌ Error processing {key}: {e}")

    print("✅ Export completed!")
    print(f"  • Total exported and marked: {exported_count}")
    print(f"  • With email content (subject + body): {exported_with_email_content}")
    print(f"  • Without email content: {exported_without_email_content}")
    print(f"  • Skipped (already exported): {skipped_already_exported}")
    print(f"  • Skipped (not valid): {skipped_not_valid}")

if __name__ == "__main__":
    export_valid_leads_to_csv()