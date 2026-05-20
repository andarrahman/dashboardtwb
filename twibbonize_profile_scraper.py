"""
Twibbonize public profile scraper with optional AI-powered enrichment.

Fetches a public Twibbonize profile via the same JSON endpoints the
frontend uses (no headless browser needed) and maps fields into the
`contacts` table schema.

Usage:
    python3 twibbonize_profile_scraper.py palangmerahindonesia
    python3 twibbonize_profile_scraper.py palangmerahindonesia --enrich
    python3 twibbonize_profile_scraper.py palangmerahindonesia --enrich --raw

Flags:
    --enrich   Use Perplexity Sonar (via OpenRouter) to search the web and
               auto-fill: instagram_handle, website_url, country,
               summary_profile, segment, use_case_category.
               Requires OPENROUTER_API_KEY env var.
    --raw      Also dump raw API response for diagnostics.

Endpoints used (all public, no auth):
- GET /v2/public-profile/data/{username}        — account + aggregate stats
- GET /v2/campaign/search/creator?username=...  — campaign list (paginated)

------------------------------------------------------------------------
Guideline: filling `summary_profile`, `segment`, `use_case_category`
(Auto-filled by --enrich via Gemini with Google Search grounding)
------------------------------------------------------------------------

1. Read `_search_context.snippets` from the output to understand the org.
   Identify: country/region, org type, flagship campaign, thematic focus,
   official social media & website.

2. Write `summary_profile` in this exact one-paragraph format
   (Bahasa Indonesia, ~30-50 words):

       <flag-emoji> <Country> = Kreator dari <Org name (expansion if
       acronym)> <city/region>, dengan kampanye unggulan <Year>
       <Campaign Name> yang meraih <NK+> hits. Fokus pada <theme>.

   Canonical example:
       🇵🇭 Filipina = Kreator dari DHVSU (Don Honorio Ventura State
       University) Pampanga dengan kampanye unggulan 2025 DHVSU
       National Women's Month Campaign yang meraih 10K+ hits. Fokus
       pada konten kampus dan program sosial universitas.

   Rules:
   - Flag emoji + Indonesian country name before `=`.
   - Expand acronyms in parentheses on first mention.
   - Use `top_campaign_hit_band` from campaigns_summary for the hit band
     (e.g. 25K+), not total_supporters.
   - "Fokus pada ..." reflects recurring theme, not only the flagship.

3. `segment` (one of): `education`, `ngo-social-activism`,
   `government-public-sector`, `religious`, `communities-associations`,
   `brands-agency`, `political`, `fan-community`, `personal-creator`,
   `unknown`. Classify by org type, not campaign topic.

4. `use_case_category` (one of): `advocacy-awareness`, `fundraising`,
   `event-promotion`, `religious-celebration`, `school-spirit`,
   `political-campaign`, `brand-marketing`, `fan-engagement`,
   `internal-rallying`. Always pick the single most prominent campaign
   type — never return null or a catch-all label.

If signal is insufficient, set null + flag for manual review.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.parse
import urllib.request
import warnings
from datetime import datetime, timezone
from typing import Any

warnings.filterwarnings("ignore", category=Warning, module="urllib3")

API_BASE = "https://api.twibbonize.com"
PAGE_SIZE = 10
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def fetch_json(url: str, timeout: int = 15) -> Any:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def epoch_ms_to_iso(ms: int | None) -> str | None:
    if not ms:
        return None
    try:
        return datetime.fromtimestamp(int(ms) / 1000, tz=timezone.utc).isoformat()
    except (ValueError, TypeError, OSError):
        return None


# ---------------------------------------------------------------------------
# Twibbonize API
# ---------------------------------------------------------------------------

def fetch_profile(username: str) -> dict[str, Any]:
    return fetch_json(f"{API_BASE}/v2/public-profile/data/{urllib.parse.quote(username)}")


def fetch_all_campaigns(username: str) -> tuple[list[dict[str, Any]], int]:
    """Iterate all pages of /campaign/search/creator. Returns (campaigns, total)."""
    all_campaigns: list[dict[str, Any]] = []
    total_reported = 0
    page = 1
    while True:
        url = (
            f"{API_BASE}/v2/campaign/search/creator"
            f"?page={page}&numItems={PAGE_SIZE}"
            f"&username={urllib.parse.quote(username)}&sort=newest"
        )
        resp = fetch_json(url)
        data = resp.get("data", {}) or {}
        page_items = data.get("campaigns", []) or []
        if page == 1:
            total_reported = int(data.get("total", 0) or 0)
        if not page_items:
            break
        all_campaigns.extend(page_items)
        if len(all_campaigns) >= total_reported:
            break
        page += 1
        if page > 50:
            break
    return all_campaigns, total_reported


# ---------------------------------------------------------------------------
# Campaign summary
# ---------------------------------------------------------------------------

def hit_band(hits: int) -> str:
    for band in (1_000_000, 100_000, 50_000, 25_000, 10_000, 5_000, 1_000, 500, 100):
        if hits >= band:
            n = band // 1000 if band >= 1000 else band
            suffix = "M+" if band >= 1_000_000 else "K+" if band >= 1_000 else "+"
            return f"{n}{suffix}"
    return str(hits)


def _hit_int(c: dict[str, Any]) -> int:
    try:
        return int(c.get("hit") or 0)
    except (ValueError, TypeError):
        return 0


def _publish_ms(c: dict[str, Any]) -> int | None:
    for k in ("firstPublish", "createdAt"):
        v = c.get(k)
        if v:
            try:
                return int(v)
            except (ValueError, TypeError):
                continue
    return None


def summarize_campaigns(campaigns: list[dict[str, Any]]) -> dict[str, Any]:
    if not campaigns:
        return {
            "count": 0,
            "top_campaign": None,
            "top_campaign_url": None,
            "top_campaign_hits": 0,
            "top_campaign_hit_band": None,
            "top_campaign_first_publish_at": None,
            "first_publish_at": None,
            "latest_publish_at": None,
            "category_counts": {},
            "total_hits_sum": 0,
            "recent_campaigns": [],
        }

    top = max(campaigns, key=_hit_int)
    top_hits = _hit_int(top)
    publish_times = [t for t in (_publish_ms(c) for c in campaigns) if t]

    categories: dict[str, int] = {}
    for c in campaigns:
        cat = c.get("category") or "UNKNOWN"
        categories[cat] = categories.get(cat, 0) + 1

    recent = [
        {
            "name": c.get("name"),
            "url": c.get("url"),
            "category": c.get("category"),
            "hit": _hit_int(c),
            "first_publish_at": epoch_ms_to_iso(_publish_ms(c)),
        }
        for c in campaigns[:10]
    ]

    return {
        "count": len(campaigns),
        "top_campaign": top.get("name"),
        "top_campaign_url": top.get("url"),
        "top_campaign_hits": top_hits,
        "top_campaign_hit_band": hit_band(top_hits),
        "top_campaign_first_publish_at": epoch_ms_to_iso(_publish_ms(top)),
        "first_publish_at": epoch_ms_to_iso(min(publish_times)) if publish_times else None,
        "latest_publish_at": epoch_ms_to_iso(max(publish_times)) if publish_times else None,
        "category_counts": categories,
        "total_hits_sum": sum(_hit_int(c) for c in campaigns),
        "recent_campaigns": recent,
    }


# ---------------------------------------------------------------------------
# Build contact
# ---------------------------------------------------------------------------

def build_contact(
    username: str,
    profile_resp: dict[str, Any],
    campaigns: list[dict[str, Any]],
    total_campaigns: int,
) -> dict[str, Any]:
    data = (profile_resp or {}).get("data", {}) or {}
    acct = data.get("accountData", {}) or {}
    pp = acct.get("publicProfile", {}) or {}

    def to_int(v: Any) -> int | None:
        if v is None or v == "":
            return None
        try:
            return int(v)
        except (ValueError, TypeError):
            return None

    summary = summarize_campaigns(campaigns)
    plan = acct.get("currentPlan")
    account_tier = plan if plan else "free"

    return {
        "profile_url": f"https://www.twibbonize.com/u/{username}",
        "name": acct.get("name") or None,
        "summary_profile": None,                          # ← auto via --enrich
        "instagram_handle": None,                         # ← auto via --enrich
        "website_url": pp.get("websiteLink") or None,     # ← auto via --enrich fallback
        "twibbonize_user_id": None,                       # not exposed by public API
        "account_tier": account_tier,
        "country": None,                                  # ← auto via --enrich
        "account_created_at": epoch_ms_to_iso(acct.get("createdAt")),
        "first_campaign_at": summary["first_publish_at"],
        "latest_campaign_at": summary["latest_publish_at"],
        "total_campaigns": to_int(data.get("total-campaign")) or total_campaigns or summary["count"],
        "total_supporters": to_int(data.get("total-hit")),
        "top_supporter_countries": None,                  # not exposed by public API
        "segment": None,                                  # ← auto via --enrich
        "use_case_category": None,                        # ← auto via --enrich
        "is_verified": acct.get("isVerified"),
        "suspended": acct.get("suspended"),
        "avatar": acct.get("avatar"),
        "banner": pp.get("banner"),
        "public_profile_created_at": epoch_ms_to_iso(pp.get("createdAt")),
        "public_profile_updated_at": epoch_ms_to_iso(pp.get("updatedAt")),
        "campaigns_summary": summary,
    }


# ---------------------------------------------------------------------------
# AI enrichment via OpenRouter (Perplexity Sonar — built-in web search)
# ---------------------------------------------------------------------------

_ENRICH_SYSTEM = (
    "You are a data analyst. Search the web for information about the given "
    "Twibbonize creator, then return ONLY a valid JSON object — no markdown "
    "fences, no explanation, nothing else."
)

_ENRICH_PROMPT = """\
Search the web for "{name}" (Twibbonize username: {username}) and return a \
JSON object with exactly these keys:

{{
  "instagram_handle": "<Instagram username without @, or null>",
  "website_url": "<official website URL starting with https://, skip social media / news sites, or null>",
  "country": "<ISO 3166-1 alpha-2 e.g. ID PH MY SG, or null>",
  "summary_profile": "<one paragraph in Bahasa Indonesia: <flag-emoji> <Country in Indonesian> = Kreator dari <Org full name (expand acronyms in parentheses)> <city/region>, dengan kampanye unggulan <Year> <Campaign Name> yang meraih {top_campaign_hit_band} hits. Fokus pada <theme>. ~30-50 words.>",
  "segment": "<one of: education | ngo-social-activism | government-public-sector | religious | communities-associations | brands-agency | political | fan-community | personal-creator | unknown>",
  "use_case_category": "<one of: advocacy-awareness | fundraising | event-promotion | religious-celebration | school-spirit | political-campaign | brand-marketing | fan-engagement | internal-rallying>"
}}

Context from Twibbonize API:
- Total campaigns: {total_campaigns}
- Top campaign: "{top_campaign}" ({top_campaign_hit_band} hits, {top_campaign_year})
- Recent campaigns: {recent_campaigns}

Rules:
- segment: classify by org type, NOT campaign topic
- use_case_category: always pick the single most prominent campaign type — never use "mixed" or null, always commit to the best-fit category
- Output ONLY the JSON object."""


def ai_enrich(contact: dict[str, Any], dump_raw: bool = False) -> dict[str, Any]:
    """
    Use Perplexity Sonar via OpenRouter (web search + AI) to fill all
    enrichment fields in a single API call.
    """
    try:
        from openai import OpenAI  # type: ignore[import]
    except ImportError:
        return {"error": "openai not installed. Run: pip3 install openai"}

    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    if not api_key:
        return {"error": "OPENROUTER_API_KEY environment variable not set."}

    username = (contact.get("profile_url") or "").split("/")[-1]
    name = contact.get("name") or username
    summary = contact.get("campaigns_summary") or {}
    top_year = (summary.get("top_campaign_first_publish_at") or "")[:4] or "unknown"

    prompt = _ENRICH_PROMPT.format(
        name=name,
        username=username,
        total_campaigns=summary.get("count", 0),
        top_campaign=summary.get("top_campaign") or "-",
        top_campaign_hit_band=summary.get("top_campaign_hit_band") or "-",
        top_campaign_year=top_year,
        recent_campaigns=json.dumps(
            [c.get("name") for c in (summary.get("recent_campaigns") or [])[:5]]
        ),
    )

    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
    )

    raw_text = ""
    try:
        response = client.chat.completions.create(
            model="perplexity/sonar",
            max_tokens=1024,
            messages=[
                {"role": "system", "content": _ENRICH_SYSTEM},
                {"role": "user", "content": prompt},
            ],
        )
        raw_text = (response.choices[0].message.content or "").strip()

        # Strip markdown fences if model adds them
        raw_text = re.sub(r'^```(?:json)?\s*', '', raw_text)
        raw_text = re.sub(r'\s*```$', '', raw_text.strip())

        # Extract JSON object if there's surrounding text
        json_match = re.search(r'\{[\s\S]*\}', raw_text)
        if json_match:
            raw_text = json_match.group(0)

        parsed = json.loads(raw_text)
        result: dict[str, Any] = {
            "instagram_handle": parsed.get("instagram_handle"),
            "website_url": parsed.get("website_url"),
            "country": parsed.get("country"),
            "summary_profile": parsed.get("summary_profile"),
            "segment": parsed.get("segment"),
            "use_case_category": parsed.get("use_case_category"),
        }
        if dump_raw:
            result["_ai_raw"] = raw_text
        return result

    except json.JSONDecodeError as exc:
        return {"error": f"Model returned non-JSON: {exc}", "_ai_raw": raw_text}
    except Exception as exc:  # noqa: BLE001
        return {"error": str(exc)}


# ---------------------------------------------------------------------------
# Main scrape
# ---------------------------------------------------------------------------

def scrape(username: str, enrich: bool = False, dump_raw: bool = False) -> dict[str, Any]:
    profile_resp = fetch_profile(username)
    campaigns, total = fetch_all_campaigns(username)
    contact = build_contact(username, profile_resp, campaigns, total)

    result: dict[str, Any] = {"contact": contact}

    if enrich:
        enriched = ai_enrich(contact, dump_raw=dump_raw)
        if "error" in enriched:
            result["enrich_error"] = enriched["error"]
            if "_ai_raw" in enriched:
                result["_ai_raw"] = enriched["_ai_raw"]
        else:
            for k, v in enriched.items():
                if k == "_ai_raw":
                    result["_ai_raw"] = v
                elif v is not None and contact.get(k) is None:
                    contact[k] = v

    if dump_raw:
        result["raw_api_responses"] = {
            "profile": profile_resp,
            "campaigns_total": total,
        }

    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Scrape a public Twibbonize profile.")
    parser.add_argument("username", help="Twibbonize username, e.g. palangmerahindonesia")
    parser.add_argument(
        "--enrich",
        action="store_true",
        help=(
            "Use Perplexity Sonar via OpenRouter to search the web and auto-fill "
            "instagram_handle, website_url, country, summary_profile, segment, "
            "use_case_category. Requires OPENROUTER_API_KEY env var."
        ),
    )
    parser.add_argument(
        "--raw",
        action="store_true",
        help="Include raw API responses and Gemini output in result.",
    )
    args = parser.parse_args()

    try:
        result = scrape(args.username, enrich=args.enrich, dump_raw=args.raw)
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"error": str(exc), "username": args.username}), file=sys.stderr)
        return 1

    print(json.dumps(result, indent=2, default=str, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
