#!/usr/bin/env python3
"""
clean_body_previews.py
──────────────────────
One-off script to clean existing body_preview values in contact_email_logs.

Applies the same markdown / URL stripping that checkdailyemail.py now does
for new emails, so old previews look consistent in the CRM email list.

Run:
  python3 clean_body_previews.py
"""

import os
import re
import sys
import logging
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env.local"))

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
WORKSPACE_ID = os.getenv("CRM_WORKSPACE_ID", "")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("clean_previews")

BODY_MAX_CHARS = 500


def clean_preview(text: str) -> str:
    """Strip markdown formatting, image refs, and URLs from a body_preview string."""
    if not text:
        return text

    # Strip quoted reply lines
    lines = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith(">") or (stripped.startswith("On ") and "wrote:" in stripped):
            continue
        lines.append(stripped)
    result = " ".join(lines)

    # Strip markdown formatting
    result = re.sub(r'\*{2}([^*]+)\*{2}', r'\1', result)   # **bold**
    result = re.sub(r'\*([^*\n]+)\*',      r'\1', result)   # *italic*
    result = re.sub(r'_{2}([^_]+)_{2}',    r'\1', result)   # __underline__
    result = re.sub(r'_([^_\n]+)_',        r'\1', result)   # _italic_

    # Strip inline image references and URLs
    result = re.sub(r'\[image:[^\]]*\]', '', result)         # [image: ...]
    result = re.sub(r'<https?://[^>]+>',  '', result)        # <https://...>
    result = re.sub(r'https?://\S+',      '', result)        # bare URLs

    # Normalise whitespace
    result = re.sub(r'\s{2,}', ' ', result).strip()

    # Truncate
    if len(result) > BODY_MAX_CHARS:
        result = result[:BODY_MAX_CHARS].rsplit(' ', 1)[0] + '…'

    return result


def needs_cleaning(preview: str) -> bool:
    """Return True if the preview contains patterns we want to strip."""
    if not preview:
        return False
    patterns = [
        r'\*{2}',            # **
        r'\*[^*\n]+\*',      # *text*
        r'_{2}',             # __
        r'\[image:',         # [image:
        r'<https?://',       # <https://
        r'https?://',        # bare URL
    ]
    return any(re.search(p, preview) for p in patterns)


def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        log.error("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set.")
        sys.exit(1)

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    log.info("Fetching contact_email_logs with body_preview …")

    # Fetch in batches of 1000
    batch_size = 1000
    offset = 0
    total_fetched = 0
    total_updated = 0
    total_skipped = 0

    while True:
        query = (
            supabase.table("contact_email_logs")
            .select("id, body_preview")
            .not_.is_("body_preview", "null")
        )
        if WORKSPACE_ID:
            query = query.eq("workspace_id", WORKSPACE_ID)
        result = query.range(offset, offset + batch_size - 1).execute()

        rows = result.data or []
        if not rows:
            break

        total_fetched += len(rows)
        log.info(f"  Processing batch of {len(rows)} rows (offset {offset}) …")

        updates = []
        for row in rows:
            preview = row.get("body_preview") or ""
            if not needs_cleaning(preview):
                total_skipped += 1
                continue
            cleaned = clean_preview(preview)
            if cleaned != preview:
                updates.append({"id": row["id"], "body_preview": cleaned})

        if updates:
            for u in updates:
                supabase.table("contact_email_logs") \
                    .update({"body_preview": u["body_preview"]}) \
                    .eq("id", u["id"]) \
                    .execute()
            total_updated += len(updates)
            log.info(f"  ✓ Updated {len(updates)} rows in this batch")
        else:
            log.info(f"  – No rows needed cleaning in this batch")

        if len(rows) < batch_size:
            break
        offset += batch_size

    log.info("─" * 60)
    log.info(f"Done.  Fetched: {total_fetched}  |  Updated: {total_updated}  |  Skipped (clean): {total_fetched - total_updated}")


if __name__ == "__main__":
    main()
