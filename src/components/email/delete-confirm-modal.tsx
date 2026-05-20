"use client";

import * as React from "react";
import { RiDeleteBinLine } from "@remixicon/react";
import type { EmailThreadRow } from "@/lib/supabase/types";

interface DeleteDraftModalProps {
  thread: EmailThreadRow;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function DeleteDraftModal({ thread, onConfirm, onCancel, loading }: DeleteDraftModalProps) {
  const contactName = (thread.contact as { name?: string } | null)?.name ?? "this contact";
  const [now] = React.useState(() => Date.now());
  const daysAgo = thread.created_at
    ? Math.floor((now - new Date(thread.created_at).getTime()) / 86_400_000)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-background shadow-2xl p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="size-10 rounded-full bg-red-100 flex items-center justify-center">
            <RiDeleteBinLine size={18} className="text-red-600" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-red-600">Draft Email</p>
            <h2 className="text-lg font-bold">Delete this draft permanently?</h2>
          </div>
        </div>
        <p className="text-sm text-foreground-muted mb-5">
          The draft to {contactName} has not been sent. Once deleted, the content cannot be recovered.
        </p>

        {/* Preview card */}
        <div className="rounded-xl border border-border bg-background-subtle p-4 mb-6">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold">{contactName}</span>
            <span className="text-xs text-foreground-muted">
              Draft{daysAgo !== null ? ` · ${daysAgo} day${daysAgo !== 1 ? "s" : ""} old` : ""}
            </span>
          </div>
          <p className="text-sm font-medium truncate">{thread.subject || "(No subject)"}</p>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-full border border-border hover:bg-background-subtle transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={loading}
            onClick={onConfirm}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-full bg-red-500 text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RiDeleteBinLine size={14} />
            {loading ? "Deleting…" : "Delete draft"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Remove sent email ────────────────────────────────────────────────────────

interface RemoveSentModalProps {
  thread: EmailThreadRow;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function RemoveSentModal({ thread, onConfirm, onCancel, loading }: RemoveSentModalProps) {
  const [acknowledged, setAcknowledged] = React.useState(false);
  const contactName = (thread.contact as { name?: string } | null)?.name ?? "this contact";
  const sentDate = thread.last_message_at
    ? new Date(thread.last_message_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-background shadow-2xl p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="size-10 rounded-full bg-red-100 flex items-center justify-center">
            <RiDeleteBinLine size={18} className="text-red-600" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-red-600">Sent Email</p>
            <h2 className="text-lg font-bold">Remove this email from CRM?</h2>
          </div>
        </div>
        <p className="text-sm text-foreground-muted mb-5">
          The email to {contactName} was already delivered. Deleting only removes it from this workspace — the recipient still has it in their inbox.
        </p>

        {/* Preview card */}
        <div className="rounded-xl border border-border bg-background-subtle p-4 mb-4">
          <div className="flex items-start justify-between gap-2 mb-1">
            <span className="text-sm font-semibold">{contactName}</span>
            {thread.is_stale && thread.stale_since_days && (
              <span className="shrink-0 text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5">
                Stale · {thread.stale_since_days}d
              </span>
            )}
          </div>
          <p className="text-sm font-medium truncate mb-1">{thread.subject || "(No subject)"}</p>
          {sentDate && (
            <p className="text-xs text-foreground-muted">
              Sent {sentDate} · {thread.message_count} message{thread.message_count !== 1 ? "s" : ""} in thread
            </p>
          )}
        </div>

        {/* Acknowledgment */}
        <label className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 cursor-pointer mb-6">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 accent-amber-600"
          />
          <span className="text-xs text-amber-800 font-medium">
            I understand the recipient still has this email. Activity log will keep the record.
          </span>
        </label>

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-full border border-border hover:bg-background-subtle transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={!acknowledged || loading}
            onClick={onConfirm}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-full bg-red-500 text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RiDeleteBinLine size={14} />
            {loading ? "Removing…" : "Remove from CRM"}
          </button>
        </div>
      </div>
    </div>
  );
}
