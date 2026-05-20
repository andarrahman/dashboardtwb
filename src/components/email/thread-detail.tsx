"use client";

import * as React from "react";
import {
  RiReplyLine,
  RiShareForwardLine,
  RiExternalLinkLine,
  RiDownloadLine,
  RiSearchLine,
  RiSearchEyeLine,
  RiMoreLine,
  RiCloseLine,
} from "@remixicon/react";
import type { EmailThreadRow, ContactRow, UnifiedEmailRow } from "@/lib/supabase/types";
import { getContactEmailLogs } from "@/lib/queries/emails";
import { createDiscoveryCall } from "@/lib/queries/discovery-calls";
import { AddEditModal, type DiscoveryCallFormState } from "@/components/discovery-call/add-edit-modal";
import { ContactQuickView } from "@/components/contacts/contact-quick-view";
import { formatRelativeTime, formatDate } from "./utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReplyContext {
  to: string;
  subject: string;
  bodyHtml: string;
}

export interface ForwardContext {
  subject: string;
  bodyHtml: string;
  attachments?: import("@/lib/supabase/types").EmailAttachment[];
}

// ─── Unified Email Contact Detail ────────────────────────────────────────────
// Single component for both CRM threads and Gmail-synced log emails.
// Left panel  : all emails with this contact (logs + CRM threads), sorted newest first.
// Right panel : detail of the selected email.

const LOG_PAGE_SIZE = 10;

export interface EmailContactDetailProps {
  workspaceId: string;
  /** Logged-in user id — needed for creating discovery calls */
  userId?: string;
  /** Display name for the owner field in the discovery call modal */
  ownerName?: string;
  /** The email the user clicked to open this view */
  activeEmail: UnifiedEmailRow;
  /** All CRM threads already fetched for the page (used to show thread siblings) */
  allThreads: EmailThreadRow[];
  onSelectEmail: (email: UnifiedEmailRow) => void;
  /** Called when the user wants to open the full compose modal for a reply */
  onReply: (context?: ReplyContext) => void;
  /** Called when the user wants to open the full compose modal for a forward */
  onForward?: (context?: ForwardContext) => void;
  onCompose: () => void;
  /** True while the CRM thread messages are being fetched */
  loading?: boolean;
}

export function EmailContactDetail({
  workspaceId,
  userId,
  ownerName,
  activeEmail,
  allThreads,
  onSelectEmail,
  onReply,
  onForward,
  onCompose,
  loading = false,
}: EmailContactDetailProps) {
  const contact = activeEmail.contact as ContactRow | null;
  const contactId = activeEmail.contact_id;

  // ── Left panel: contact log emails (infinite scroll) ──────────────────────
  const [logEmails, setLogEmails]       = React.useState<UnifiedEmailRow[]>([]);
  const [logTotal, setLogTotal]         = React.useState(0);
  const [logPage, setLogPage]           = React.useState(1);
  const [logReady, setLogReady]         = React.useState(false);
  const [loadingMore, setLoadingMore]   = React.useState(false);
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  const listRef     = React.useRef<HTMLDivElement>(null);

  // ── Local read tracking (optimistic — cleared on re-mount) ────────────────
  // Tracks IDs the user has clicked in this session so unread styling
  // disappears immediately without waiting for a DB round-trip.
  const [localReadIds, setLocalReadIds] = React.useState<Set<string>>(new Set());

  // ── Search ─────────────────────────────────────────────────────────────────
  const [searchOpen, setSearchOpen]       = React.useState(false);
  const [searchQuery, setSearchQuery]     = React.useState("");
  const [searchAllLogs, setSearchAllLogs] = React.useState<UnifiedEmailRow[]>([]);
  const [searchLoading, setSearchLoading] = React.useState(false);

  // When a search query is typed, fetch ALL log emails for this contact (no pagination).
  React.useEffect(() => {
    if (!searchQuery.trim() || !contactId) {
      setSearchAllLogs([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      const { data } = await getContactEmailLogs(workspaceId, contactId, { page: 1, pageSize: 9999 });
      if (!cancelled) {
        setSearchAllLogs(data);
        setSearchLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, workspaceId, contactId]);

  // ── Discovery Call Modal ───────────────────────────────────────────────────
  const [showDiscovery, setShowDiscovery] = React.useState(false);
  const [dcSaving, setDcSaving]           = React.useState(false);

  // ── Contact Quick View ─────────────────────────────────────────────────────
  const [showContactView, setShowContactView] = React.useState(false);

  // (inline composer removed — Reply/Forward open ComposeModal directly)

  // ─────────────────────────────────────────────────────────────────────────
  // Load log emails for left panel
  React.useEffect(() => {
    if (!contactId) return;
    setLogReady(false);
    setLogEmails([]);
    setLogPage(1);
    setLogTotal(0);
    getContactEmailLogs(workspaceId, contactId, { page: 1, pageSize: LOG_PAGE_SIZE }).then(
      ({ data, total }) => {
        setLogEmails(data);
        setLogTotal(total);
        setLogReady(true);
      }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, contactId]);

  // Infinite scroll
  React.useEffect(() => {
    if (!logReady) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingMore && logEmails.length < logTotal) {
          const next = logPage + 1;
          setLoadingMore(true);
          getContactEmailLogs(workspaceId, contactId!, { page: next, pageSize: LOG_PAGE_SIZE }).then(
            ({ data }) => {
              setLogEmails((prev) => [...prev, ...data]);
              setLogPage(next);
              setLoadingMore(false);
            }
          );
        }
      },
      { root: listRef.current, threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logReady, loadingMore, logEmails.length, logTotal, logPage]);

  // ── Merge CRM threads + log emails for this contact ───────────────────────
  // Only show threads that belong to this specific contact.
  // Guard: if contact is null, return empty — without this, null === null would match every thread.
  const contactThreadRows: UnifiedEmailRow[] = contact?.id
    ? allThreads
        .filter((t) => (t.contact as ContactRow | null)?.id === contact.id)
        .map((t) => ({
          id: t.id,
          source: "thread" as const,
          workspace_id: t.workspace_id,
          contact_id: t.contact_id,
          contact: t.contact ?? null,
          subject: t.subject,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          body_preview: (t as any).preview_messages?.[0]?.body?.slice(0, 120) ?? null,
          direction: "outbound" as const,
          status: t.status,
          from_email: null,
          to_email: null,
          owner_id: t.owner_id,
          owner: t.owner ?? null,
          is_stale: t.is_stale,
          stale_since_days: t.stale_since_days,
          scheduled_at: t.scheduled_at,
          last_message_at: t.last_message_at,
          message_count: t.message_count,
          thread: t,
        }))
    : [];

  // Memoize both the CRM thread ID set and the merged email list — avoids re-running
  // deduplication + sort on every parent re-render.
  const crmThreadIds = React.useMemo(
    () => new Set(contactThreadRows.map((r) => r.thread?.id).filter(Boolean) as string[]),
    [contactThreadRows]
  );

  const allContactEmails: UnifiedEmailRow[] = React.useMemo(() => {
    const seen = new Set<string>();
    return [...contactThreadRows, ...logEmails]
      .filter((e) => {
        // Skip log emails whose thread_id points to an existing CRM thread — it's a duplicate
        if (e.source === "log" && e.log?.thread_id && crmThreadIds.has(e.log.thread_id)) return false;
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      })
      .sort((a, b) => {
        const ta = new Date(a.last_message_at ?? 0).getTime();
        const tb = new Date(b.last_message_at ?? 0).getTime();
        return tb - ta;
      });
  }, [contactThreadRows, logEmails, crmThreadIds]);

  // Search filter — when query is active, use the full-fetch pool (searchAllLogs + threads)
  const filteredEmails = React.useMemo(() => {
    if (!searchQuery.trim()) return allContactEmails;

    // Merge threads + ALL log emails (full fetch) then deduplicate (same logic as allContactEmails)
    const seen2 = new Set<string>();
    const searchPool: UnifiedEmailRow[] = [...contactThreadRows, ...searchAllLogs]
      .filter((e) => {
        if (e.source === "log" && e.log?.thread_id && crmThreadIds.has(e.log.thread_id)) return false;
        if (seen2.has(e.id)) return false;
        seen2.add(e.id);
        return true;
      })
      .sort((a, b) => new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime());

    const q = searchQuery.toLowerCase();
    return searchPool.filter((e) =>
      [e.subject, e.body_preview, e.from_email, e.to_email,
       (e.contact as ContactRow | null)?.name,
       (e.contact as ContactRow | null)?.email,
      ].some((v) => v?.toLowerCase().includes(q))
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, allContactEmails, searchAllLogs]);

  // ── Right panel: selected message state ───────────────────────────────────
  const [threadMessages, setThreadMessages] = React.useState<
    import("@/lib/supabase/types").EmailMessageRow[]
  >([]);
  const [selectedMsgId, setSelectedMsgId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (activeEmail.source !== "thread" || !activeEmail.thread?.id) {
      setThreadMessages([]);
      setSelectedMsgId(null);
      return;
    }
    const t = allThreads.find((t) => t.id === activeEmail.thread?.id);
    setThreadMessages(t?.messages ?? []);
    setSelectedMsgId(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEmail.id, activeEmail.source]);

  // Re-sync messages when allThreads updates (after loading finishes)
  React.useEffect(() => {
    if (activeEmail.source !== "thread") return;
    const t = allThreads.find((t) => t.id === activeEmail.thread?.id);
    if (t?.messages?.length) setThreadMessages(t.messages);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allThreads]);

  const selectedMsg =
    threadMessages.find((m) => m.id === selectedMsgId) ??
    threadMessages[threadMessages.length - 1] ??
    null;

  const isThreadView = activeEmail.source === "thread";
  const isInbound = isThreadView
    ? selectedMsg?.direction === "inbound"
    : activeEmail.direction === "inbound";

  // Attachments: from selected thread message OR from log email
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const attachments = (isThreadView ? (selectedMsg?.attachments ?? []) : ((activeEmail.log as any)?.attachments ?? [])) as {
    name: string; size: number; url?: string; mime_type?: string;
  }[];

  // ── Discovery Call handlers ───────────────────────────────────────────────
  async function handleSaveDiscovery(form: DiscoveryCallFormState) {
    if (!contact?.id || !workspaceId) return;
    setDcSaving(true);
    const resolvedUserId = userId ?? "unknown";
    await createDiscoveryCall(workspaceId, resolvedUserId, {
      contact_id: contact.id,
      stage: form.stage,
      lead_source: "email",
      interview_date: form.interview_date || null,
      interview_time: form.interview_time || null,
      interview_meeting_url: form.interview_meeting_url || null,
      survey_status: form.survey_status,
      result: form.result,
      notes: form.notes || null,
    });
    setDcSaving(false);
    setShowDiscovery(false);
  }

  // ── Select email + mark as read locally ───────────────────────────────────
  function handleSelectEmail(email: UnifiedEmailRow) {
    setLocalReadIds((prev) => new Set([...prev, email.id]));
    onSelectEmail(email);
  }

  // ── Reply / Forward — open ComposeModal directly with full context ────────
  function buildQuotedBlock() {
    const originalBody = isThreadView
      ? (selectedMsg?.body_html || (selectedMsg?.body ?? "").replace(/\n/g, "<br>"))
      // Log email body_preview is plain text — HTML-escape it before injecting into contentEditable HTML
      : (activeEmail.body_preview ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\n/g, "<br>");

    const senderLabel = isInbound
      ? `${contact?.name ?? "Contact"} &lt;${
          (isThreadView ? selectedMsg?.from_email : activeEmail.from_email) ?? ""
        }&gt;`
      : `You &lt;${
          (isThreadView ? selectedMsg?.to_email : activeEmail.to_email) ?? ""
        }&gt;`;

    return `<br><br><div style="border-left:3px solid #d1d5db;padding-left:12px;color:#6b7280;font-size:13px;margin-top:8px"><p style="margin:0 0 6px">On ${formatDate(activeEmail.last_message_at)}, ${senderLabel} wrote:</p>${originalBody}</div>`;
  }

  function handleReply() {
    const toEmail = isInbound
      ? (isThreadView ? selectedMsg?.from_email : activeEmail.from_email) ?? (contact?.email ?? "")
      : contact?.email ?? "";
    const subject = `Re: ${activeEmail.subject ?? ""}`;
    const greeting = `<p>Hi ${contact?.name ?? "there"},</p><p></p>`;
    const bodyHtml = greeting + buildQuotedBlock();
    onReply({ to: toEmail, subject, bodyHtml });
  }

  function handleForward() {
    const subject = `Fwd: ${activeEmail.subject ?? ""}`;
    const intro = `<p>Hi,</p><p></p>`;
    const bodyHtml = intro + buildQuotedBlock();
    // Pass attachment metadata (url-only, no content) so compose modal shows them
    const fwdAttachments = attachments
      .filter((a) => a.url)
      .map(({ name, size, mime_type, url }) => ({ name, size: size ?? 0, mime_type: mime_type ?? "", url }));
    onForward?.({ subject, bodyHtml, attachments: fwdAttachments });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden relative">
      {/* ─── Left: all emails with this contact ─────────────────── */}
      <div className="w-[340px] shrink-0 border-r border-border flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-[60px] border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
              {(contact?.name ?? "?").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-bold leading-none">{contact?.name ?? "—"}</p>
              {allContactEmails.length > 0 && (
                <p className="text-[11px] text-foreground-muted mt-0.5">
                  {allContactEmails.length} email{allContactEmails.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => { setSearchOpen((v) => !v); setSearchQuery(""); }}
            className={`transition-colors ${searchOpen ? "text-primary" : "text-foreground-muted hover:text-foreground"}`}
          >
            {searchOpen ? <RiCloseLine size={16} /> : <RiSearchLine size={16} />}
          </button>
        </div>

        {/* Search input */}
        {searchOpen && (
          <div className="px-3 py-2 border-b border-border shrink-0">
            <div className="relative">
              <RiSearchLine size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none" />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Subject, name, email, body…"
                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-border bg-background-subtle outline-none focus:border-primary focus:ring-[2px] focus:ring-primary/10"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground"
                >
                  <RiCloseLine size={12} />
                </button>
              )}
            </div>
            {searchQuery && (
              <p className="text-[11px] text-foreground-muted mt-1.5 px-0.5">
                {searchLoading
                  ? "Searching…"
                  : `${filteredEmails.length} result${filteredEmails.length !== 1 ? "s" : ""}`}
              </p>
            )}
          </div>
        )}

        {/* Email list */}
        <div ref={listRef} className="flex-1 overflow-y-auto">
          {!logReady ? (
            <div className="animate-pulse space-y-0">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start gap-2.5 px-4 py-3 border-b border-border">
                  <div className="size-8 rounded-full bg-border shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 rounded bg-border w-3/4" />
                    <div className="h-2.5 rounded bg-border w-full" />
                    <div className="h-2.5 rounded bg-border w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredEmails.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <RiSearchLine size={24} className="text-foreground-muted mb-2" />
              <p className="text-xs text-foreground-muted">
                {searchQuery ? `No emails matching "${searchQuery}"` : "No emails found"}
              </p>
            </div>
          ) : (
            <>
              {filteredEmails.map((email) => {
                const isActive = email.id === activeEmail.id;
                const emailInbound = email.direction === "inbound";
                const isUnread = !localReadIds.has(email.id) && (
                  (email.source === "thread" && email.thread?.is_read === false) ||
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (email.source === "log" && emailInbound && (email.log as any)?.is_read === false)
                );
                return (
                  <button
                    key={email.id}
                    onClick={() => handleSelectEmail(email)}
                    className={`relative w-full text-left px-4 py-3 border-b border-border transition-colors hover:bg-background-subtle ${
                      isActive ? "bg-primary/5 border-l-2 border-l-primary" :
                      isUnread ? "bg-teal-50" : ""
                    }`}
                  >
                    {/* Unread left accent bar */}
                    {isUnread && !isActive && (
                      <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-teal-500 rounded-r" />
                    )}
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`size-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          emailInbound ? "bg-sky-100 text-sky-700" : "bg-primary/10 text-primary"
                        }`}
                      >
                        {emailInbound
                          ? (contact?.name ?? "?").slice(0, 2).toUpperCase()
                          : "Me"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className={`text-xs font-semibold ${isUnread ? "text-teal-700" : "text-foreground-muted"}`}>
                            {emailInbound ? "Inbound" : "Outbound"}
                            {isUnread && <span className="ml-1.5 inline-block size-1.5 rounded-full bg-teal-500 align-middle" />}
                          </span>
                          <span className="text-[11px] text-foreground-muted shrink-0">
                            {formatRelativeTime(email.last_message_at)}
                          </span>
                        </div>
                        <p className={`text-xs truncate ${isUnread ? "font-bold text-foreground" : "font-semibold text-foreground"}`}>
                          {email.subject || "(No subject)"}
                        </p>
                        <p className="text-[11px] text-foreground-muted truncate mt-0.5">
                          {(email.body_preview ?? "")
                            .replace(/\*{2}([^*]+)\*{2}/g, "$1")
                            .replace(/\*([^*\n]+)\*/g, "$1")
                            .replace(/\[image:[^\]]*\]/g, "")
                            .replace(/<https?:\/\/[^>]+>/g, "")
                            .replace(/https?:\/\/\S+/g, "")
                            .replace(/\s{2,}/g, " ")
                            .trim()
                            .slice(0, 60)}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}

              {/* Infinite scroll sentinel */}
              {logEmails.length < logTotal && (
                <div ref={sentinelRef} className="py-3 flex items-center justify-center">
                  {loadingMore ? (
                    <div className="flex items-center gap-2 text-xs text-foreground-muted">
                      <svg className="animate-spin size-3.5 text-primary" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Loading more…
                    </div>
                  ) : (
                    <span className="text-[11px] text-foreground-muted">Scroll for more</span>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ─── Right: email detail ─────────────────────────────────── */}
      {loading ? (
        <RightPanelSkeleton />
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header — subject + actions */}
          <div className="flex items-center gap-3 px-6 h-[60px] border-b border-border shrink-0">
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold truncate">
                {activeEmail.subject || "(No subject)"}
              </h2>
              <p className="text-xs text-foreground-muted">
                {isInbound
                  ? `From ${(isThreadView ? selectedMsg?.from_email : activeEmail.from_email) ?? "—"}`
                  : `To ${(isThreadView ? selectedMsg?.to_email : activeEmail.to_email) ?? contact?.email ?? "—"}`}
                {" · "}
                {formatDate(activeEmail.last_message_at)}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleReply}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-background text-sm font-medium hover:bg-background-subtle transition-colors"
              >
                <RiReplyLine size={14} />
                Reply
              </button>
              <button
                onClick={handleForward}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-background text-sm font-medium hover:bg-background-subtle transition-colors"
              >
                <RiShareForwardLine size={14} />
                Forward
              </button>
              <button
                onClick={() => setShowDiscovery(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary bg-primary/5 text-primary text-sm font-medium hover:bg-primary/10 transition-colors"
              >
                <RiSearchEyeLine size={14} />
                Move to Discovery Call
              </button>
            </div>
          </div>

          {/* Contact info bar */}
          {contact && (
            <ContactInfoBar
              contact={contact}
              onOpenQuickView={() => setShowContactView(true)}
            />
          )}

          {/* Message body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div
              className={`rounded-xl border p-5 ${
                "border-border bg-background"
              }`}
            >
              {/* Sender row */}
              <div className="flex items-start justify-between gap-2 mb-4">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`size-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      isInbound ? "bg-sky-100 text-sky-700" : "bg-primary/10 text-primary"
                    }`}
                  >
                    {isInbound ? (contact?.name ?? "?").slice(0, 2).toUpperCase() : "Me"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">
                        {isInbound ? (contact?.name ?? activeEmail.from_email ?? "—") : "You"}
                      </span>
                      <span
                        className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${
                          isInbound
                            ? "bg-primary/10 text-primary"
                            : "bg-background-subtle text-foreground-muted"
                        }`}
                      >
                        {isInbound ? "Inbound" : isThreadView ? "Sent" : "Sent via Gmail"}
                      </span>
                    </div>
                    <p className="text-[11px] text-foreground-muted">
                      {isInbound
                        ? (isThreadView ? selectedMsg?.from_email : activeEmail.from_email)
                        : (isThreadView ? selectedMsg?.to_email : activeEmail.to_email)}
                      {" · "}
                      {formatDate(
                        isThreadView
                          ? (selectedMsg?.sent_at ?? selectedMsg?.created_at ?? activeEmail.last_message_at)
                          : activeEmail.last_message_at
                      )}
                    </p>
                    {/* CC / BCC — only for CRM thread messages */}
                    {isThreadView && (selectedMsg?.cc_emails?.length ?? 0) > 0 && (
                      <p className="text-[11px] text-foreground-muted mt-0.5">
                        <span className="font-medium">CC:</span> {(selectedMsg?.cc_emails ?? []).join(", ")}
                      </p>
                    )}
                    {isThreadView && (selectedMsg?.bcc_emails?.length ?? 0) > 0 && (
                      <p className="text-[11px] text-foreground-muted mt-0.5">
                        <span className="font-medium">BCC:</span> {(selectedMsg?.bcc_emails ?? []).join(", ")}
                      </p>
                    )}
                  </div>
                </div>
                <span className={`text-[11px] font-semibold shrink-0 ${isInbound ? "text-primary" : "text-foreground-muted"}`}>
                  {isInbound ? "Reply" : "Sent"}
                </span>
              </div>

              {/* Subject line */}
              <p className="text-xs text-foreground-muted mb-3 pb-3 border-b border-border">
                <span className="font-semibold text-foreground">{activeEmail.subject}</span>
              </p>

              {/* Body */}
              {isThreadView ? (
                (selectedMsg?.body_html || selectedMsg?.body) ? (
                  selectedMsg.body_html ? (
                    <div
                      className="text-sm text-foreground leading-relaxed mb-3 [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic [&_u]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0 [&_a]:text-blue-600 [&_a]:underline [&_img]:max-w-full [&_img]:rounded [&_p]:mb-1"
                      dangerouslySetInnerHTML={{ __html: selectedMsg.body_html }}
                    />
                  ) : (
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap mb-3">
                      {selectedMsg?.body}
                    </p>
                  )
                ) : null
              ) : (() => {
                const logHtml = (activeEmail.log as any)?.body_html as string | null
                const logPreview = activeEmail.body_preview
                if (logHtml) {
                  return (
                    <div
                      className="text-sm text-foreground leading-relaxed [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic [&_u]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-blue-600 [&_a]:underline [&_img]:max-w-full [&_p]:mb-2"
                      dangerouslySetInnerHTML={{ __html: logHtml }}
                    />
                  )
                }
                if (logPreview) {
                  // Strip markdown-style asterisk formatting (*bold* → bold) from plain text
                  const cleanPreview = logPreview
                    .replace(/\*{2}([^*]+)\*{2}/g, '$1')  // **bold**
                    .replace(/\*([^*\n]+)\*/g, '$1')       // *italic/bold*
                    .replace(/_{2}([^_]+)_{2}/g, '$1')     // __underline__
                    .replace(/_([^_\n]+)_/g, '$1')         // _italic_
                    .trim()
                  return (
                    <>
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                        {cleanPreview}
                      </p>
                      {logPreview.length >= 199 && (
                        <p className="text-xs text-foreground-muted mt-4 pt-3 border-t border-border">
                          Showing preview only · Full email visible in Gmail
                        </p>
                      )}
                    </>
                  )
                }
                return <p className="text-sm text-foreground-muted italic">No preview available</p>
              })()}

              {/* Attachments */}
              {attachments.length > 0 && (
                <div className="space-y-2 mt-3">
                  {attachments.map((att, i) => (
                    <div key={i} className="flex items-center gap-2.5 rounded-lg border border-border bg-background-subtle px-3 py-2">
                      {att.url ? (
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={att.name}
                          className="size-7 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0 hover:bg-primary/20 transition-colors"
                        >
                          <RiDownloadLine size={14} />
                        </a>
                      ) : (
                        <div className="size-7 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          <RiDownloadLine size={14} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{att.name}</p>
                        <p className="text-[11px] text-foreground-muted">
                          {att.size
                            ? att.size < 1024
                              ? `${att.size} B`
                              : att.size < 1024 * 1024
                                ? `${(att.size / 1024).toFixed(1)} KB`
                                : `${(att.size / (1024 * 1024)).toFixed(1)} MB`
                            : ""}
                        </p>
                      </div>
                      {att.url && (
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={att.name}
                          className="text-xs font-semibold text-primary hover:underline shrink-0"
                        >
                          Download
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ─── Discovery Call Modal (reuses the full AddEditModal) ────── */}
      {showDiscovery && (
        <AddEditModal
          mode="add"
          ownerName={ownerName ?? "you"}
          currentOwnerId={userId}
          initialContact={contact ?? undefined}
          lockedLeadSource="email"
          onSave={handleSaveDiscovery}
          onCancel={() => setShowDiscovery(false)}
          loading={dcSaving}
        />
      )}

      {/* ─── Contact Quick View — reuses existing ContactQuickView ──── */}
      <ContactQuickView
        contact={contact}
        open={showContactView}
        onOpenChange={setShowContactView}
      />
    </div>
  );
}

// ─── Right panel skeleton ─────────────────────────────────────────────────────

function RightPanelSkeleton() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-pulse">
      <div className="flex items-center gap-3 px-6 h-[60px] border-b border-border shrink-0">
        <div className="flex-1 space-y-2">
          <div className="h-4 rounded bg-border w-48" />
          <div className="h-3 rounded bg-border w-72" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-20 rounded-full bg-border" />
          <div className="h-8 w-24 rounded-full bg-border" />
          <div className="h-8 w-40 rounded-full bg-border" />
        </div>
      </div>
      <div className="flex items-center gap-4 px-6 py-3 border-b border-border">
        <div className="size-10 rounded-full bg-border shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 rounded bg-border w-40" />
          <div className="h-2.5 rounded bg-border w-56" />
        </div>
      </div>
      <div className="flex-1 px-6 py-5">
        <div className="rounded-xl border border-border p-5 space-y-3">
          <div className="flex items-center gap-3 pb-3 border-b border-border">
            <div className="size-9 rounded-full bg-border shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 rounded bg-border w-32" />
              <div className="h-2.5 rounded bg-border w-48" />
            </div>
          </div>
          <div className="h-3 rounded bg-border w-full" />
          <div className="h-3 rounded bg-border w-5/6" />
          <div className="h-3 rounded bg-border w-4/5" />
          <div className="h-48 rounded-lg bg-border w-full mt-4" />
        </div>
      </div>
    </div>
  );
}

// ─── Contact info bar ─────────────────────────────────────────────────────────

function ContactInfoBar({
  contact,
  onOpenQuickView,
}: {
  contact: ContactRow;
  onOpenQuickView: () => void;
}) {
  const tierLabel: Record<string, string> = {
    premium_creator: "Premium Creator",
    premium_supporter: "Premium Supporter",
    free: "Free",
  };
  return (
    <div className="flex items-center gap-4 px-6 py-3 border-b border-border bg-background-subtle/50 shrink-0">
      <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
        {contact.name?.slice(0, 2).toUpperCase() ?? "?"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold">{contact.name}</span>
          {contact.account_tier && (
            <span className="text-[11px] font-semibold bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
              {tierLabel[contact.account_tier] ?? contact.account_tier}
            </span>
          )}
          {contact.type && (
            <span className="text-[11px] text-foreground-muted capitalize">
              {contact.type === "twibbonize" ? "Twibbonize User" : "External"} · {contact.country ?? "—"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-foreground-muted">
          {contact.email && <span>{contact.email}</span>}
          {contact.profile_url && (
            <a
              href={contact.profile_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-primary hover:underline"
            >
              {contact.profile_url.replace("https://", "")}
            </a>
          )}
        </div>
      </div>
      {/* Quick view trigger instead of direct navigation */}
      <button
        onClick={onOpenQuickView}
        className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 shrink-0"
      >
        Open contact profile <RiExternalLinkLine size={11} />
      </button>
    </div>
  );
}
