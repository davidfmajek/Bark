"""Manual bootstrap only — regenerates every establishment with reviews.

Not used by the daily cron. The scheduled job runs check_and_summarize.py instead,
which only updates spots that have new reviews since the last summary.
"""

import os
import sys

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from supabase_client import supabase
from summarize import (
    build_summary_prompt,
    generate_summary,
    get_reviews_for_establishment,
    save_summary,
)


def main():
    response = supabase.table("reviews").select("establishment_id, body").eq("is_flagged", False).execute()

    establishment_ids = set()
    for row in response.data:
        if (row.get("body") or "").strip():
            establishment_ids.add(row["establishment_id"])

    print(f"Regenerating summaries for {len(establishment_ids)} establishments...")

    failures = 0
    for establishment_id in sorted(establishment_ids):
        try:
            reviews = get_reviews_for_establishment(establishment_id)
            if not reviews:
                continue
            prompt = build_summary_prompt(reviews)
            summary = generate_summary(prompt)
            save_summary(establishment_id, summary, reviews)
            print(f"  {establishment_id}: {len(reviews)} reviews")
            print(f"    {summary}")
        except Exception as e:
            failures += 1
            print(f"  {establishment_id}: failed — {e}")

    if failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
