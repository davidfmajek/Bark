import os
import sys
import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from supabase_client import supabase

API_BASE_URL = os.getenv("BARK_API_BASE_URL", "http://localhost:5000")
# Regenerate only when at least one new eligible review exists since the last summary.
REGENERATION_THRESHOLD = 1


def get_eligible_review_counts():
    """Returns {establishment_id: eligible_review_count} for every establishment."""
    response = supabase.table("reviews").select("establishment_id, body").eq("is_flagged", False).execute()

    counts = {}
    for row in response.data:
        if not (row.get("body") or "").strip():
            continue
        eid = row["establishment_id"]
        counts[eid] = counts.get(eid, 0) + 1
    return counts


def get_establishments_summary_state():
    """Returns {establishment_id: summary_review_count} for every establishment."""
    response = supabase.table("establishments").select("establishment_id, summary_review_count").execute()
    return {row["establishment_id"]: row["summary_review_count"] for row in response.data}


def main():
    current_counts = get_eligible_review_counts()
    summary_state = get_establishments_summary_state()

    to_regenerate = []
    for establishment_id, current_count in current_counts.items():
        last_summarized_count = summary_state.get(establishment_id) or 0
        new_reviews = current_count - last_summarized_count
        if new_reviews >= REGENERATION_THRESHOLD:
            to_regenerate.append((establishment_id, new_reviews))

    skipped = len(current_counts) - len(to_regenerate)
    print(f"Checked {len(current_counts)} establishments with reviews.")
    print(f"{len(to_regenerate)} have new reviews and need regeneration.")
    print(f"{skipped} skipped (no new reviews since last summary).")

    failures = 0
    for establishment_id, new_reviews in to_regenerate:
        url = f"{API_BASE_URL}/api/spots/{establishment_id}/summarize"
        print(f"  Summarizing {establishment_id} ({new_reviews} new review{'s' if new_reviews != 1 else ''})...")
        try:
            resp = requests.post(url, timeout=60)
            if resp.ok:
                print(f"    {resp.json().get('review_count')} reviews summarized")
            else:
                failures += 1
                print(f"    {resp.status_code}: {resp.text}")
        except requests.RequestException as e:
            failures += 1
            print(f"    Request failed: {e}")

    if failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
