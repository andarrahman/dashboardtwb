#!/usr/bin/env python3
"""
checkdailyemail.py
──────────────────
Daily email checker for CRM Discovery Call pipeline.

Scans both INBOX (inbound from contacts) and Sent Mail (outbound replies to
contacts) then saves matched threads + body preview to contact_email_logs.

Run manually   : python3 checkdailyemail.py
Catchup mode   : python3 checkdailyemail.py --since-days 30
Daemon mode    : python3 checkdailyemail.py --schedule

Requirements:
  pip install supabase python-dotenv schedule
"""

import imaplib
import email
import email.header
import os
import re
import sys
import logging
import argparse
import schedule
import time
import base64
import uuid
from typing import Optional
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime, parseaddr, getaddresses
from dotenv import load_dotenv
from supabase import create_client, Client

# ─── Config ───────────────────────────────────────────────────────────────────

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env.local"))

IMAP_HOST     = os.getenv("IMAP_HOST", "imap.gmail.com")
IMAP_PORT     = int(os.getenv("IMAP_PORT", "993"))
IMAP_USER     = os.getenv("IMAP_USER", "andar@twibbonize.com")
IMAP_PASSWORD = os.getenv("IMAP_PASSWORD", "")

SUPABASE_URL  = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY  = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
WORKSPACE_ID  = os.getenv("CRM_WORKSPACE_ID", "")

LOG_FILE      = os.path.join(os.path.dirname(__file__), "checkdailyemail.log")
WIB_OFFSET    = timezone(timedelta(hours=7))

INBOX_FOLDER  = "INBOX"
SENT_FOLDER   = '"[Gmail]/Sent Mail"'

BODY_MAX_CHARS = 500   # max chars stored in body_preview

# ─── Logging ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
    ],
)
log = logging.getLogger("checkdailyemail")

# ─── Header helpers ───────────────────────────────────────────────────────────

def decode_header_value(raw: str) -> str:
    parts = email.header.decode_header(raw or "")
    decoded = []
    for chunk, charset in parts:
        if isinstance(chunk, bytes):
            decoded.append(chunk.decode(charset or "utf-8", errors="replace"))
        else:
            decoded.append(chunk)
    return " ".join(decoded).strip()


def extract_email_address(header_value: str) -> str:
    _, addr = parseaddr(header_value or "")
    return addr.strip().lower()


def extract_all_addresses(header_value: str) -> list:
    pairs = getaddresses([header_value or ""])
    return [addr.strip().lower() for _, addr in pairs if addr.strip()]


# ─── Body extraction ──────────────────────────────────────────────────────────

def _clean_text(text: str, max_chars: int) -> str:
    """Remove whitespace, quoted lines, markdown formatting, URLs, and truncate."""
    lines = []
    for line in text.splitlines():
        stripped = line.strip()
        # Skip quoted reply lines and email headers in replies
        if stripped.startswith(">") or stripped.startswith("On ") and "wrote:" in stripped:
            continue
        lines.append(stripped)
    result = " ".join(lines)
    # Strip markdown-style formatting
    result = re.sub(r'\*{2}([^*]+)\*{2}', r'\1', result)   # **bold**
    result = re.sub(r'\*([^*\n]+)\*',      r'\1', result)   # *italic*
    result = re.sub(r'_{2}([^_]+)_{2}',    r'\1', result)   # __underline__
    result = re.sub(r'_([^_\n]+)_',        r'\1', result)   # _italic_
    # Strip inline image references and angle-bracket URLs
    result = re.sub(r'\[image:[^\]]*\]', '', result)         # [image: ...]
    result = re.sub(r'<https?://[^>]+>',  '', result)        # <https://...>
    result = re.sub(r'https?://\S+',      '', result)        # bare URLs
    result = re.sub(r"\s{2,}", " ", result).strip()
    if len(result) > max_chars:
        result = result[:max_chars].rsplit(" ", 1)[0] + "…"
    return result


def _strip_html(html: str) -> str:
    """Very basic HTML → plain text."""
    text = re.sub(r"<br\s*/?>|<p[^>]*>|<div[^>]*>", "\n", html, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&lt;", "<", text)
    text = re.sub(r"&gt;", ">", text)
    return text


def extract_body(raw_bytes: bytes) -> dict:
    """
    Parse RFC822 bytes and return:
      { body_preview: str, body_html: str|None, attachments: list }

    Inline images (cid: references) are converted to base64 data URIs so
    they render correctly in the browser without needing external storage.

    File attachments include a temporary '_content_b64' field so
    save_email_logs() can upload them to Supabase Storage.
    """
    result = {"body_preview": None, "body_html": None, "attachments": []}
    try:
        msg = email.message_from_bytes(raw_bytes)

        plain_text = None
        html_text  = None
        cid_map: dict = {}   # content-id → base64 data URI (inline images)

        parts = list(msg.walk()) if msg.is_multipart() else [msg]
        for part in parts:
            ct = part.get_content_type()
            cd = str(part.get("Content-Disposition", ""))
            content_id = part.get("Content-ID", "").strip().strip("<>")

            # ── Inline image (cid: reference in HTML body) ─────────────────
            if content_id and ct.startswith("image/") and "attachment" not in cd:
                payload = part.get_payload(decode=True) or b""
                if payload:
                    b64 = base64.b64encode(payload).decode("ascii")
                    cid_map[content_id] = f"data:{ct};base64,{b64}"
                continue

            # ── File attachment ─────────────────────────────────────────────
            if "attachment" in cd or (part.get_filename() and ct not in ("text/plain", "text/html")):
                filename = decode_header_value(part.get_filename() or "attachment")
                payload  = part.get_payload(decode=True) or b""
                result["attachments"].append({
                    "name":          filename,
                    "mime_type":     ct,
                    "size":          len(payload),
                    "_content_b64":  base64.b64encode(payload).decode("ascii") if payload else None,
                })
                continue

            payload = part.get_payload(decode=True)
            if not payload:
                continue
            charset = part.get_content_charset() or "utf-8"
            try:
                text = payload.decode(charset, errors="replace")
            except Exception:
                text = payload.decode("utf-8", errors="replace")

            if ct == "text/plain" and not plain_text:
                plain_text = _clean_text(text, BODY_MAX_CHARS)
            elif ct == "text/html" and not html_text:
                html_text = text  # store full HTML; truncate only preview

        # Replace cid: references in HTML with base64 data URIs
        if html_text and cid_map:
            for cid, data_uri in cid_map.items():
                html_text = html_text.replace(f"cid:{cid}", data_uri)

        # body_preview = plain text if available, else strip HTML
        if plain_text:
            result["body_preview"] = plain_text
        elif html_text:
            result["body_preview"] = _clean_text(_strip_html(html_text), BODY_MAX_CHARS)

        # body_html = full HTML if available
        result["body_html"] = html_text

    except Exception as e:
        log.debug(f"Body extraction error: {e}")
    return result


# Keep old name as alias for backward compat
def extract_body_preview(raw_bytes: bytes) -> Optional[str]:
    return extract_body(raw_bytes)["body_preview"]


# ─── Supabase Storage upload ──────────────────────────────────────────────────

STORAGE_BUCKET = "email-images"

def upload_attachment(supabase: Client, workspace_id: str, contact_id: str, received_iso: str, att: dict) -> Optional[str]:
    """
    Upload a file attachment to Supabase Storage.
    Returns the public URL, or None if upload failed.
    Removes the temporary '_content_b64' key from att in-place.
    """
    content_b64 = att.pop("_content_b64", None)
    if not content_b64:
        return None
    try:
        content   = base64.b64decode(content_b64)
        ts        = received_iso[:19].replace(":", "-").replace("T", "_")
        safe_name = re.sub(r"[^a-zA-Z0-9._-]", "_", att["name"])
        uid       = uuid.uuid4().hex[:8]
        path      = f"attachments/{workspace_id}/{contact_id}/{ts}_{uid}_{safe_name}"
        mime      = att.get("mime_type") or "application/octet-stream"
        supabase.storage.from_(STORAGE_BUCKET).upload(
            path, content,
            file_options={"content-type": mime, "upsert": True},
        )
        url = supabase.storage.from_(STORAGE_BUCKET).get_public_url(path)
        log.debug(f"  📎 Uploaded attachment '{att['name']}' → {path}")
        return url
    except Exception as e:
        log.debug(f"  Attachment upload failed for '{att.get('name')}': {e}")
        return None


# ─── IMAP ─────────────────────────────────────────────────────────────────────

def open_imap_connection() -> Optional[imaplib.IMAP4_SSL]:
    if not IMAP_PASSWORD:
        log.error("IMAP_PASSWORD is not set.")
        return None
    try:
        conn = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
        conn.login(IMAP_USER, IMAP_PASSWORD)
        return conn
    except imaplib.IMAP4.error as e:
        log.error(f"IMAP login failed: {e}")
        return None


def fetch_messages_from_folder(
    conn: imaplib.IMAP4_SSL,
    folder: str,
    since_dt: datetime,
    direction: str,
    contact_emails: set,
) -> list:
    """
    Returns list of matched message dicts, each including 'imap_id'
    so we can later fetch the body for matched messages only.
    """
    since_str = since_dt.strftime("%d-%b-%Y")

    status, _ = conn.select(folder, readonly=True)
    if status != "OK":
        log.warning(f"Could not select folder {folder} — skipping.")
        return []

    status, data = conn.search(None, f'(SINCE "{since_str}")')
    if status != "OK" or not data[0]:
        return []

    message_ids = data[0].split()
    log.info(f"  {folder}: {len(message_ids)} message(s) since {since_str}")

    messages = []
    for msg_id in message_ids:
        status, raw = conn.fetch(
            msg_id,
            "(BODY.PEEK[HEADER.FIELDS (FROM TO CC SUBJECT DATE)])"
        )
        if status != "OK":
            continue

        msg = email.message_from_bytes(raw[0][1])
        from_raw   = decode_header_value(msg.get("From", ""))
        from_email = extract_email_address(msg.get("From", ""))
        to_raw     = decode_header_value(msg.get("To", ""))
        cc_raw     = decode_header_value(msg.get("Cc", ""))
        subject    = decode_header_value(msg.get("Subject", "(no subject)"))
        date_raw   = msg.get("Date", "")

        try:
            msg_dt = parsedate_to_datetime(date_raw).astimezone(WIB_OFFSET)
        except Exception:
            msg_dt = None

        if msg_dt and msg_dt < since_dt:
            continue

        if direction == "inbound":
            if from_email not in contact_emails:
                continue
            messages.append({
                "imap_id":       msg_id,
                "imap_folder":   folder,
                "direction":     "inbound",
                "from_name":     from_raw,
                "from_email":    from_email,
                "to_email":      IMAP_USER,
                "subject":       subject,
                "date":          msg_dt.strftime("%Y-%m-%d %H:%M WIB") if msg_dt else date_raw,
                "date_obj":      msg_dt,
                "contact_email": from_email,
            })
        else:
            all_recipients = extract_all_addresses(to_raw) + extract_all_addresses(cc_raw)
            matched = [a for a in all_recipients if a in contact_emails]
            if not matched:
                continue
            for recipient in matched:
                messages.append({
                    "imap_id":       msg_id,
                    "imap_folder":   folder,
                    "direction":     "outbound",
                    "from_name":     "Andar Rahman",
                    "from_email":    IMAP_USER,
                    "to_email":      recipient,
                    "subject":       subject,
                    "date":          msg_dt.strftime("%Y-%m-%d %H:%M WIB") if msg_dt else date_raw,
                    "date_obj":      msg_dt,
                    "contact_email": recipient,
                })

    return messages


def fetch_body_for_messages(conn: imaplib.IMAP4_SSL, folder: str, messages: list) -> list:
    """
    Re-fetch the body for a list of matched messages (same folder).
    Mutates each dict to add 'body_preview'.
    """
    status, _ = conn.select(folder, readonly=True)
    if status != "OK":
        return messages

    # Group by imap_id to avoid duplicate fetches
    id_to_msgs: dict = {}
    for m in messages:
        if m["imap_folder"] == folder:
            id_to_msgs.setdefault(m["imap_id"], []).append(m)

    for imap_id, msgs in id_to_msgs.items():
        status, raw = conn.fetch(imap_id, "(BODY.PEEK[])")
        if status != "OK" or not raw or not raw[0]:
            continue
        try:
            body_bytes = raw[0][1] if isinstance(raw[0], tuple) else None
            if not body_bytes:
                continue
            extracted = extract_body(body_bytes)
            for m in msgs:
                m["body_preview"]  = extracted["body_preview"]
                m["body_html"]     = extracted["body_html"]
                m["attachments"]   = extracted["attachments"]
        except Exception as e:
            log.debug(f"Body fetch error for msg {imap_id}: {e}")

    return messages


# ─── Supabase ─────────────────────────────────────────────────────────────────

def fetch_contacts(supabase: Client) -> list:
    try:
        query = (
            supabase.table("contacts")
            .select("id, name, email, type, workspace_id")
            .is_("deleted_at", "null")
        )
        if WORKSPACE_ID:
            query = query.eq("workspace_id", WORKSPACE_ID)
        return query.execute().data or []
    except Exception as e:
        log.error(f"Supabase contacts fetch error: {e}")
        return []


def fetch_crm_thread_map(supabase: Client, workspace_id: str) -> dict:
    """
    Return a dict mapping (contact_id, subject_lower) → thread_id for every
    CRM-managed thread (email_threads table).

    Used for two purposes:
      1. Prevent double-logging outbound emails (already tracked in email_threads).
      2. Link inbound replies to their parent thread in email_messages.
    """
    try:
        res = (
            supabase.table("email_threads")
            .select("id, contact_id, subject")
            .eq("workspace_id", workspace_id)
            .execute()
        )
        result: dict = {}
        for r in (res.data or []):
            if r.get("contact_id") and r.get("subject"):
                key = (r["contact_id"], (r["subject"] or "").strip().lower())
                result[key] = r["id"]
        return result
    except Exception as e:
        log.debug(f"Could not fetch CRM thread map: {e}")
        return {}


def _strip_re(subject: str) -> str:
    """Remove leading 'Re:', 'Re[2]:', etc. from a subject for matching."""
    return re.sub(r'^(Re(\[\d+\])?:\s*)+', '', subject, flags=re.IGNORECASE).strip()


def link_inbound_reply_to_thread(
    supabase: Client,
    contact_id: str,
    workspace_id: str,
    m: dict,
    thread_id: str,
    received_iso: str,
    log_row_id: str | None = None,
):
    """
    Insert an inbound email reply into email_messages (so it appears in the
    CRM thread view) and update the thread's last_message_at.
    Also updates the contact_email_logs row to set thread_id if row_id provided.
    """
    try:
        # Insert into email_messages
        supabase.table("email_messages").insert({
            "thread_id":    thread_id,
            "workspace_id": workspace_id,
            "direction":    "inbound",
            "from_email":   m["from_email"],
            "to_email":     IMAP_USER,
            "body":         m.get("body_preview") or "",
            "sent_at":      received_iso,
        }).execute()
        log.info(f"  ↪  Linked reply '{m['subject']}' to thread {thread_id[:8]}")
    except Exception as e:
        log.debug(f"email_messages insert failed (may already exist): {e}")

    try:
        # Update thread last_message_at + status to 'replied' + mark unread
        # Also restore thread if it was soft-deleted (contact replied to a deleted thread)
        supabase.table("email_threads").update({
            "last_message_at": received_iso,
            "status":          "replied",
            "updated_at":      received_iso,
            "is_read":         False,
            "deleted_at":      None,
        }).eq("id", thread_id).execute()
    except Exception as e:
        log.debug(f"email_threads update failed: {e}")

    if log_row_id:
        try:
            # Link the contact_email_log row so it doesn't float as duplicate
            supabase.table("contact_email_logs").update({
                "thread_id": thread_id
            }).eq("id", log_row_id).execute()
        except Exception as e:
            log.debug(f"contact_email_logs thread_id update failed: {e}")


def save_email_logs(supabase: Client, matched: list, crm_thread_map: dict | None = None):
    rows = []
    skipped_crm = 0
    linked_replies = 0

    for m in matched:
        c = m["crm_contact"]
        received_iso = m["date_obj"].isoformat() if m.get("date_obj") else None
        if not received_iso:
            continue

        # ── Skip outbound emails already tracked as CRM threads ───────────────
        # When a user sends via the CRM platform it's saved to email_threads +
        # email_messages. The Gmail sync picks the same message from Sent folder
        # and would create a duplicate in contact_email_logs. Skip it.
        if m["direction"] == "outbound" and crm_thread_map:
            sig = (c["id"], m["subject"].strip().lower())
            if sig in crm_thread_map:
                log.debug(
                    f"  ↳ Skipping outbound '{m['subject']}' for {c['name']} "
                    f"— already tracked as CRM thread"
                )
                skipped_crm += 1
                continue

        # ── Detect inbound replies to CRM threads ─────────────────────────────
        # If subject is "Re: <thread_subject>", link it to the parent thread
        # by inserting into email_messages (shows in thread detail view).
        inbound_thread_id = None
        if m["direction"] == "inbound" and crm_thread_map:
            bare = _strip_re(m["subject"])
            sig  = (c["id"], bare.lower())
            if sig in crm_thread_map:
                inbound_thread_id = crm_thread_map[sig]

        # ── Upload file attachments to Supabase Storage ──────────────────────
        # Each attachment dict may have a temp '_content_b64' field; upload it
        # and replace with a public URL. Strip the temp field regardless.
        raw_attachments = m.get("attachments") or []
        uploaded_attachments = []
        for att in raw_attachments:
            att = dict(att)  # copy so we don't mutate the original
            url = upload_attachment(supabase, c["workspace_id"], c["id"], received_iso, att)
            if url:
                att["url"] = url
            uploaded_attachments.append(att)

        rows.append({
            "contact_id":         c["id"],
            "workspace_id":       c["workspace_id"],
            "from_email":         m["from_email"],
            "from_name":          m["from_name"],
            "to_email":           m.get("to_email"),
            "subject":            m["subject"],
            "received_at":        received_iso,
            "direction":          m["direction"],
            "body_preview":       m.get("body_preview"),
            "body_html":          m.get("body_html"),
            "attachments":        uploaded_attachments,
            # New inbound emails start as unread; outbound start as read
            "is_read":            m["direction"] != "inbound",
            "_inbound_thread_id": inbound_thread_id,  # scratch field, not saved to DB
        })

    if skipped_crm:
        log.info(f"   ⏭️  Skipped {skipped_crm} outbound email(s) already in CRM threads.")

    if not rows:
        return

    # Deduplicate rows within the batch (same contact_id + from_email + received_at)
    seen: set = set()
    deduped = []
    for r in rows:
        key = (r["contact_id"], r["from_email"], r["received_at"])
        if key not in seen:
            seen.add(key)
            deduped.append(r)
    rows = deduped

    inserted = 0
    updated  = 0

    for r in rows:
        # Pop internal scratch field before saving to DB
        inbound_thread_id = r.pop("_inbound_thread_id", None)

        log_row_id: str | None = None
        is_new_row = False

        # 1. Try INSERT — skip if row already exists
        try:
            res = supabase.table("contact_email_logs").insert(r).execute()
            if res.data:
                log_row_id = res.data[0].get("id")
            inserted += 1
            is_new_row = True   # ← only link reply / mark unread for NEW rows
        except Exception:
            # Row exists — patch body_html / attachments if still NULL
            patch = {}
            if r.get("body_preview"):    patch["body_preview"] = r["body_preview"]
            if r.get("body_html"):       patch["body_html"]    = r["body_html"]
            if r.get("attachments"):     patch["attachments"]  = r["attachments"]
            if patch:
                try:
                    (supabase.table("contact_email_logs")
                        .update(patch)
                        .eq("contact_id",  r["contact_id"])
                        .eq("from_email",  r["from_email"])
                        .eq("received_at", r["received_at"])
                        .is_("body_html", "null")
                        .execute())
                    updated += 1
                except Exception as ue:
                    log.debug(f"patch failed: {ue}")

        # 2. Only link reply to CRM thread if this email is NEW
        #    (prevents re-marking thread as unread on every script run)
        if inbound_thread_id and is_new_row:
            link_inbound_reply_to_thread(
                supabase,
                contact_id=r["contact_id"],
                workspace_id=r["workspace_id"],
                m={**r, "from_email": r["from_email"], "subject": r["subject"],
                   "body_preview": r.get("body_preview")},
                thread_id=inbound_thread_id,
                received_iso=r["received_at"],
                log_row_id=log_row_id,
            )
            linked_replies += 1

    if linked_replies:
        log.info(f"   🔗  Linked {linked_replies} inbound reply(ies) to CRM threads.")

    saved   = sum(1 for r in rows if r["direction"] == "inbound")
    replied = sum(1 for r in rows if r["direction"] == "outbound")
    log.info(f"   💾 Saved — {saved} inbound, {replied} outbound  (new: {inserted}, patched: {updated}).")


# ─── Main ─────────────────────────────────────────────────────────────────────

def run_check(since_days: int = 1):
    now_wib  = datetime.now(tz=WIB_OFFSET)
    since_dt = now_wib - timedelta(days=since_days)

    log.info("=" * 60)
    log.info(f"Email check — {now_wib.strftime('%Y-%m-%d %H:%M WIB')}  (last {since_days}d)")
    log.info("=" * 60)

    if not SUPABASE_URL or not SUPABASE_KEY:
        log.error("Supabase credentials missing.")
        return

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    contacts  = fetch_contacts(supabase)
    contact_map: dict = {}
    for c in contacts:
        if c.get("email"):
            contact_map[c["email"].strip().lower()] = c

    contact_emails = set(contact_map.keys())
    log.info(f"\n👥 CRM contacts with email: {len(contact_emails)}")
    for e in sorted(contact_emails):
        log.info(f"   • {e}")

    # Pre-fetch CRM thread map — used to:
    #   1. Skip outbound emails already tracked (avoid duplicates)
    #   2. Link inbound replies to their parent thread
    crm_thread_map = fetch_crm_thread_map(supabase, WORKSPACE_ID) if WORKSPACE_ID else {}
    log.info(f"   📋 CRM-tracked threads (dedup + reply-link guard): {len(crm_thread_map)}")

    conn = open_imap_connection()
    if not conn:
        return

    log.info(f"\n📬 Scanning mailboxes…")
    inbound  = fetch_messages_from_folder(conn, INBOX_FOLDER, since_dt, "inbound",  contact_emails)
    outbound = fetch_messages_from_folder(conn, SENT_FOLDER,  since_dt, "outbound", contact_emails)

    # Fetch body for matched messages (second pass, headers-only first pass)
    if inbound:
        log.info(f"   Fetching body for {len(inbound)} inbound match(es)…")
        fetch_body_for_messages(conn, INBOX_FOLDER, inbound)

    if outbound:
        log.info(f"   Fetching body for {len(outbound)} outbound match(es)…")
        fetch_body_for_messages(conn, SENT_FOLDER, outbound)

    conn.logout()

    all_messages = inbound + outbound
    if not all_messages:
        log.info("\n✓ No matching emails found.")
        return

    # Attach CRM contact
    matched = []
    for msg in all_messages:
        crm = contact_map.get(msg["contact_email"])
        if crm:
            matched.append({**msg, "crm_contact": crm})

    if matched:
        save_email_logs(supabase, matched, crm_thread_map=crm_thread_map)

    # Print grouped summary
    log.info("\n" + "─" * 60)
    log.info(f"📧  EMAIL ACTIVITY ({len(matched)} message(s))")
    log.info("─" * 60)

    by_contact: dict = {}
    for m in sorted(matched, key=lambda x: x.get("date_obj") or datetime.min.replace(tzinfo=WIB_OFFSET), reverse=True):
        by_contact.setdefault(m["contact_email"], []).append(m)

    for contact_email, msgs in by_contact.items():
        crm = msgs[0]["crm_contact"]
        log.info(f"\n  👤 {crm['name']} <{contact_email}>")
        for m in msgs:
            arrow = "←" if m["direction"] == "inbound" else "→"
            preview = (m.get("body_preview") or "")[:60]
            log.info(f"     {arrow} [{m['date']}]  {m['subject']}")
            if preview:
                log.info(f"         \"{preview}\"")

    log.info("\n" + "=" * 60)
    recv = sum(1 for m in matched if m["direction"] == "inbound")
    sent = sum(1 for m in matched if m["direction"] == "outbound")
    log.info(f"Summary  |  Contacts: {len(by_contact)}  ·  Received: {recv}  ·  Sent: {sent}")
    log.info("=" * 60 + "\n")


# ─── Entry point ──────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="CRM daily email checker")
    parser.add_argument("--since-days", type=int, default=1, metavar="N",
                        help="Days back to scan (default: 1). Use 30 for catchup.")
    parser.add_argument("--schedule", action="store_true",
                        help="Run as daemon: daily at 08:00 WIB")
    args = parser.parse_args()

    if args.schedule:
        log.info("Daemon mode — 08:00 WIB daily.")
        run_check(since_days=args.since_days)
        schedule.every().day.at("08:00").do(run_check, since_days=1)
        while True:
            schedule.run_pending()
            time.sleep(30)
    else:
        run_check(since_days=args.since_days)


if __name__ == "__main__":
    main()
