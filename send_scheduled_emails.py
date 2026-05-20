#!/usr/bin/env python3
"""
send_scheduled_emails.py
────────────────────────
Checks the database for emails whose scheduled_at time has passed and sends
them via Gmail SMTP, then marks the thread as 'sent'.

Run once   : python3 send_scheduled_emails.py
Daemon mode: python3 send_scheduled_emails.py --schedule   (checks every minute)
Dry-run    : python3 send_scheduled_emails.py --dry-run

Requirements:
  pip install supabase python-dotenv schedule
"""

import smtplib
import logging
import argparse
import sys
import os
import time
import schedule
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, timezone
from typing import Optional, List
from dotenv import load_dotenv
from supabase import create_client, Client

# ─── Config ───────────────────────────────────────────────────────────────────

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env.local"))

SMTP_HOST     = "smtp.gmail.com"
SMTP_PORT     = 587
IMAP_USER     = os.getenv("IMAP_USER", "")
IMAP_PASSWORD = os.getenv("IMAP_PASSWORD", "")
FROM_NAME     = "Andar · Twibbonize"

SUPABASE_URL  = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY  = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
WORKSPACE_ID  = os.getenv("CRM_WORKSPACE_ID", "")

LOG_FILE = os.path.join(os.path.dirname(__file__), "send_scheduled_emails.log")

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
log = logging.getLogger("send_scheduled")


# ─── SMTP ─────────────────────────────────────────────────────────────────────

def send_via_smtp(
    to: str,
    subject: str,
    body_text: str,
    body_html: Optional[str] = None,
    cc: Optional[List[str]] = None,
    bcc: Optional[List[str]] = None,
) -> str:
    """
    Send an email via Gmail SMTP.
    Returns the Message-ID on success, raises on failure.
    """
    msg = MIMEMultipart("alternative")
    msg["From"]    = f"{FROM_NAME} <{IMAP_USER}>"
    msg["To"]      = to
    msg["Subject"] = subject
    if cc:
        msg["Cc"] = ", ".join(cc)

    msg.attach(MIMEText(body_text, "plain", "utf-8"))
    if body_html:
        msg.attach(MIMEText(body_html, "html", "utf-8"))

    all_recipients = [to] + (cc or []) + (bcc or [])

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(IMAP_USER, IMAP_PASSWORD)
        server.sendmail(IMAP_USER, all_recipients, msg.as_string())

    return msg.get("Message-ID", "")


# ─── Supabase helpers ─────────────────────────────────────────────────────────

def fetch_due_threads(supabase: Client) -> list[dict]:
    """
    Return email_threads rows where status='scheduled' and scheduled_at <= now.
    Joins the first outbound email_message for each thread.
    """
    now_iso = datetime.now(tz=timezone.utc).isoformat()
    try:
        res = (
            supabase.table("email_threads")
            .select("id, workspace_id, subject, scheduled_at, contact_id")
            .eq("workspace_id", WORKSPACE_ID)
            .eq("status", "scheduled")
            .lte("scheduled_at", now_iso)
            .execute()
        )
        return res.data or []
    except Exception as e:
        log.error(f"Failed to fetch due threads: {e}")
        return []


def fetch_message_for_thread(supabase: Client, thread_id: str) -> Optional[dict]:
    """Return the outbound email_message for this thread (body text + html)."""
    try:
        res = (
            supabase.table("email_messages")
            .select("id, body, body_html, to_email, cc_emails, bcc_emails")
            .eq("thread_id", thread_id)
            .eq("direction", "outbound")
            .order("created_at", desc=False)
            .limit(1)
            .execute()
        )
        return (res.data or [None])[0]
    except Exception as e:
        log.error(f"Failed to fetch message for thread {thread_id}: {e}")
        return None


def mark_thread_sent(supabase: Client, thread_id: str, message_id: str):
    """Update thread status → 'sent' and message sent_at."""
    now_iso = datetime.now(tz=timezone.utc).isoformat()
    try:
        supabase.table("email_threads").update({
            "status":          "sent",
            "last_message_at": now_iso,
            "updated_at":      now_iso,
        }).eq("id", thread_id).execute()

        supabase.table("email_messages").update({
            "sent_at":    now_iso,
            "updated_at": now_iso,
        }).eq("id", message_id).execute()

        log.info(f"   ✅ Thread {thread_id[:8]} marked as sent.")
    except Exception as e:
        log.error(f"   ⚠️  Failed to mark thread {thread_id[:8]} as sent: {e}")


def mark_thread_failed(supabase: Client, thread_id: str, reason: str):
    """On SMTP failure, update thread notes so the user knows it failed."""
    now_iso = datetime.now(tz=timezone.utc).isoformat()
    try:
        supabase.table("email_threads").update({
            "status":     "draft",   # revert to draft so it's not lost
            "updated_at": now_iso,
        }).eq("id", thread_id).execute()
        log.warning(f"   ↩️  Thread {thread_id[:8]} reverted to draft. Reason: {reason}")
    except Exception as e:
        log.error(f"   Failed to revert thread {thread_id[:8]}: {e}")


# ─── Core run ─────────────────────────────────────────────────────────────────

def run_check(dry_run: bool = False):
    log.info("=" * 60)
    log.info(f"Scheduled email check — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    log.info("=" * 60)

    if not SUPABASE_URL or not SUPABASE_KEY:
        log.error("Supabase credentials missing — check .env.local")
        return

    if not IMAP_USER or not IMAP_PASSWORD:
        log.error("SMTP credentials missing (IMAP_USER / IMAP_PASSWORD) — check .env.local")
        return

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    due_threads = fetch_due_threads(supabase)

    if not due_threads:
        log.info("✓ No scheduled emails due right now.")
        log.info("")
        return

    log.info(f"📬  Found {len(due_threads)} email(s) due to send.")

    sent_count  = 0
    failed_count = 0

    for thread in due_threads:
        thread_id = thread["id"]
        subject   = thread.get("subject") or "(no subject)"
        sched_at  = thread.get("scheduled_at", "")

        log.info(f"\n  → Thread {thread_id[:8]}  |  '{subject}'")
        log.info(f"     Scheduled at: {sched_at[:16].replace('T', ' ')} UTC")

        # Fetch the message (recipient + body live in email_messages)
        message = fetch_message_for_thread(supabase, thread_id)
        if not message:
            log.warning("     ⚠️  No outbound message found for this thread — skipping.")
            failed_count += 1
            continue

        to_email  = message.get("to_email") or ""
        body_text = message.get("body") or ""
        body_html = message.get("body_html") or None
        msg_id    = message["id"]
        cc  = message.get("cc_emails")  or []
        bcc = message.get("bcc_emails") or []

        log.info(f"     Recipient: {to_email}")

        if not to_email:
            log.warning("     ⚠️  No recipient (to_email) — skipping.")
            failed_count += 1
            continue

        if dry_run:
            log.info(f"     [DRY-RUN] Would send to {to_email}  cc={cc}  bcc={bcc}")
            log.info(f"     Body preview: {body_text[:80]}…")
            sent_count += 1
            continue

        # Send!
        try:
            send_via_smtp(
                to=to_email,
                subject=subject,
                body_text=body_text,
                body_html=body_html,
                cc=cc or None,
                bcc=bcc or None,
            )
            log.info(f"     📨 Sent successfully to {to_email}")
            mark_thread_sent(supabase, thread_id, msg_id)
            sent_count += 1
        except Exception as e:
            log.error(f"     ❌ SMTP error: {e}")
            mark_thread_failed(supabase, thread_id, str(e))
            failed_count += 1

    log.info("\n" + "─" * 60)
    label = "[DRY-RUN] " if dry_run else ""
    log.info(f"📊  {label}Summary  |  Sent: {sent_count}  ·  Failed: {failed_count}")
    log.info("=" * 60 + "\n")


# ─── Entry point ──────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Send scheduled CRM emails")
    parser.add_argument(
        "--schedule", action="store_true",
        help="Run as daemon — checks every minute for due emails"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Check what would be sent without actually sending"
    )
    args = parser.parse_args()

    if args.schedule:
        log.info("🕐  Daemon mode — checking every minute for scheduled emails.")
        run_check(dry_run=args.dry_run)
        schedule.every(1).minutes.do(run_check, dry_run=args.dry_run)
        while True:
            schedule.run_pending()
            time.sleep(10)
    else:
        run_check(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
