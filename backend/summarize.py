import os
import re
import anthropic
from datetime import datetime, timezone
from uuid import UUID
from supabase_client import supabase

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


class InvalidEstablishmentIdError(ValueError):
    pass


def validate_establishment_id(establishment_id: str) -> None:
    try:
        UUID(establishment_id)
    except (ValueError, AttributeError, TypeError):
        raise InvalidEstablishmentIdError("Invalid establishment ID") from None


def get_reviews_for_establishment(establishment_id: str):
    validate_establishment_id(establishment_id)
    try:
        response = supabase.table("reviews").select("rating, body").eq(
            "establishment_id", establishment_id
        ).eq("is_flagged", False).execute()
    except Exception as e:
        raise RuntimeError(f"Failed to fetch reviews: {e}") from e

    reviews = [r for r in response.data if (r.get("body") or "").strip()]
    return reviews


def build_summary_prompt(reviews: list) -> str:
    review_lines = []
    for r in reviews:
        body = (r.get("body") or "").strip()
        if not body:
            continue
        body = re.sub(r"\s+", " ", body)
        review_lines.append(f"- ({r['rating']}/5 stars) {body}")

    reviews_text = "\n".join(review_lines)

    return f"""You are summarizing student reviews of a campus dining establishment for other students deciding where to eat.

Here are the reviews:
{reviews_text}

Write exactly 1-2 short sentences (under 50 words total) that:
- Only includes claims that are actually stated in the reviews above — do not infer, assume, or add anything not written there
- Hits the main praise and main complaint only — skip minor details and specific menu items unless they're the dominant theme
- Stays neutral and factual in tone, even if individual reviews are emotional or crude
- Does not quote reviews directly, paraphrase instead
- Output plain prose only — no title, no heading, no markdown, no bullet points

Summary:"""


def sanitize_summary(text: str) -> str:
    text = text.strip()
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    while lines and re.match(r"^#+\s", lines[0]):
        lines.pop(0)
    text = " ".join(lines)
    return re.sub(r"\s+", " ", text).strip()


def generate_summary(prompt: str) -> str:
    try:
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=100,
            messages=[{"role": "user", "content": prompt}]
        )
    except anthropic.APIStatusError as e:
        # Covers rate limits, billing issues, invalid model, etc — anything the API itself rejected
        raise RuntimeError(f"Claude API error: {e.status_code} - {e.message}") from e
    except anthropic.APIConnectionError as e:
        raise RuntimeError(f"Could not reach Claude API: {e}") from e

    return sanitize_summary(response.content[0].text)


def save_summary(establishment_id: str, summary: str, reviews: list):
    try:
        supabase.table("establishments").update({
            "ai_summary": summary,
            "summary_updated_at": datetime.now(timezone.utc).isoformat(),
            "summary_review_count": len(reviews),
        }).eq("establishment_id", establishment_id).execute()
    except Exception as e:
        raise RuntimeError(f"Failed to save summary: {e}") from e