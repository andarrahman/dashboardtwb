"use client";

import * as React from "react";
import {
  RiMailSendLine,
  RiSearchLine,
  RiMoreLine,
  RiCloseLine,
  RiArrowLeftLine,
  RiArrowRightLine,
  RiDeleteBinLine,
  RiCheckboxLine,
  RiCheckboxBlankLine,
} from "@remixicon/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { createClient } from "@/lib/supabase/browser";
import {
  getUnifiedEmails,
  getUnifiedEmailCounts,
  getEmailThread,
  createEmailDraft,
  updateEmailThread,
  updateEmailMessage,
  logOutboundEmail,
  scheduleEmail,
  deleteEmailDraft,
  removeEmailFromCRM,
  markThreadRead,
  markLogRead,
  markAllRead,
  deleteEmailLog,
  type UnifiedEmailRow,
  type EmailThreadRow,
  type EmailFilters,
} from "@/lib/queries/emails";

import { ComposeModal, type ComposePayload } from "@/components/email/compose-modal";
import { EmailContactDetail, type ReplyContext, type ForwardContext } from "@/components/email/thread-detail";
import { DeleteDraftModal, RemoveSentModal } from "@/components/email/delete-confirm-modal";
import { useToast } from "@/components/ui/toast";
import { formatRelativeTime, formatShortDate } from "@/components/email/utils";

type TabValue = "all" | "sent" | "drafts" | "scheduled" | "replied";

const PAGE_SIZE = 100;

function EmailPageInner() {
  const { workspaceId } = useWorkspace();
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlEmailId = searchParams.get("id");

  // ─── Auth ────────────────────────────────────────────────────────────────
  const [userId, setUserId] = React.useState<string | null>(null);
  const [userEmail, setUserEmail] = React.useState("andar@twibbonize.com");
  const [userName, setUserName] = React.useState("Andar R.");

  React.useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      setUserEmail(user.email ?? "andar@twibbonize.com");
      const name = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split("@")[0] ?? "Me";
      setUserName(name);
    });
  }, []);

  // ─── State ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = React.useState<TabValue>("all");
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [myEmailsOnly, setMyEmailsOnly] = React.useState(true);

  // Data
  const [emails, setEmails] = React.useState<UnifiedEmailRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [counts, setCounts] = React.useState({ all: 0, sent: 0, drafts: 0, scheduled: 0, replied: 0, unread: 0 });
  const [loading, setLoading] = React.useState(true);

  // View: list → unified email detail (CRM thread or Gmail log)
  const [activeEmail, setActiveEmail] = React.useState<UnifiedEmailRow | null>(null);
  // Threads augmented with messages (fetched on selection)
  const [threadWithMessages, setThreadWithMessages] = React.useState<EmailThreadRow | null>(null);
  const [threadLoading, setThreadLoading] = React.useState(false);

  // ── URL ↔ active email sync ──────────────────────────────────────────────
  const [urlRestored, setUrlRestored] = React.useState(false);

  /** Select an email and push its ID to the URL */
  function selectEmail(email: UnifiedEmailRow) {
    const isUnreadThread = email.source === "thread" && email.thread?.is_read === false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isUnreadLog = email.source === "log" && (email.log as any)?.is_read === false;

    // Optimistically mark as read in local state so unread styling disappears immediately
    const readEmail = isUnreadThread
      ? { ...email, thread: { ...email.thread!, is_read: true } }
      : isUnreadLog
        ? { ...email, log: { ...(email.log as any), is_read: true } }
        : email;

    setActiveEmail(readEmail);
    // Also update the email list so the row loses its unread styling
    setEmails((prev) =>
      prev.map((e) => {
        if (e.id !== email.id) return e;
        if (isUnreadThread) return { ...e, thread: { ...e.thread!, is_read: true } };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (isUnreadLog) return { ...e, log: { ...(e.log as any), is_read: true } };
        return e;
      })
    );
    router.push(`/email?id=${email.id}`, { scroll: false });
    // Persist to DB
    if (workspaceId && isUnreadThread && email.thread) {
      markThreadRead(workspaceId, email.thread.id, true);
    }
    if (workspaceId && isUnreadLog && email.log) {
      markLogRead(workspaceId, email.log.id, true);
    }
  }

  // After first email list load, restore selected email from ?id= URL param
  React.useEffect(() => {
    if (urlRestored || !urlEmailId || loading || !workspaceId) return;
    setUrlRestored(true);

    // 1. Try current page list first
    const inList = emails.find((e) => e.id === urlEmailId);
    if (inList) { setActiveEmail(inList); return; }

    // 2. Try fetching as a thread
    getEmailThread(workspaceId, urlEmailId).then(({ thread, messages }) => {
      if (thread) {
        const unified: UnifiedEmailRow = {
          id: thread.id,
          source: "thread" as const,
          workspace_id: thread.workspace_id,
          contact_id: thread.contact_id,
          contact: thread.contact ?? null,
          subject: thread.subject,
          body_preview: null,
          direction: "outbound" as const,
          status: thread.status,
          from_email: null,
          to_email: null,
          owner_id: thread.owner_id,
          owner: thread.owner ?? null,
          is_stale: thread.is_stale,
          stale_since_days: thread.stale_since_days,
          scheduled_at: thread.scheduled_at,
          last_message_at: thread.last_message_at,
          message_count: thread.message_count,
          thread: { ...thread, messages },
        };
        setActiveEmail(unified);
        return;
      }

      // 3. Try fetching as a log email
      const supabase = createClient();
      (supabase as any)
        .from("contact_email_logs")
        .select(`id, contact_id, workspace_id, from_email, from_name, to_email,
          subject, received_at, direction, body_preview, thread_id, created_at,
          contact:contacts (id, name, type, email, account_tier, country, company,
            business_category, segment, profile_url, whatsapp_number)`)
        .eq("id", urlEmailId)
        .single()
        .then(({ data }: { data: any }) => {
          if (!data) return;
          const dir = (data.direction ?? "inbound") as "inbound" | "outbound";
          const unified: UnifiedEmailRow = {
            id: data.id,
            source: "log" as const,
            workspace_id: data.workspace_id,
            contact_id: data.contact_id,
            contact: data.contact ?? null,
            subject: data.subject ?? "(no subject)",
            body_preview: data.body_preview,
            direction: dir,
            status: dir === "outbound" ? "sent" as const : "replied" as const,
            from_email: data.from_email,
            to_email: data.to_email,
            owner_id: null,
            owner: null,
            is_stale: false,
            stale_since_days: null,
            scheduled_at: null,
            last_message_at: data.received_at,
            message_count: 1,
            log: data,
          };
          setActiveEmail(unified);
        });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emails, loading, urlEmailId, urlRestored, workspaceId]);

  // Derived — keep for legacy references in handleConfirmDelete
  const activeThreadId = activeEmail?.thread?.id ?? null;

  // Fetch messages when a thread email is selected
  React.useEffect(() => {
    const threadId = activeEmail?.source === "thread" ? activeEmail.thread?.id : null;
    if (!threadId || !workspaceId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setThreadWithMessages(null);
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThreadLoading(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThreadWithMessages(null);
    getEmailThread(workspaceId, threadId).then(({ thread, messages }) => {
      if (thread) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setThreadWithMessages({ ...thread, messages });
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setThreadLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEmail?.thread?.id, workspaceId]);

  // Auto-save draft ref — tracks the draft created by background auto-save
  const autoSaveDraftIdsRef = React.useRef<{ threadId: string; messageId: string } | null>(null);

  // Compose
  const [showCompose, setShowCompose] = React.useState(false);
  const [composeSending, setComposeSending] = React.useState(false);
  const [composeError, setComposeError] = React.useState<string | null>(null);
  const [draftToEdit, setDraftToEdit] = React.useState<{
    threadId: string;
    messageId: string;
    subject: string;
    bodyHtml: string;
    toEmail: string;
    contact: import("@/lib/supabase/types").ContactRow | null;
    attachments: import("@/lib/queries/emails").EmailAttachment[];
  } | null>(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = React.useState<EmailThreadRow | null>(null);
  const [deleteLogTarget, setDeleteLogTarget] = React.useState<string | null>(null); // log email id
  const [deleteLoading, setDeleteLoading] = React.useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = React.useState(false);

  // Clear selection when tab / page changes
  React.useEffect(() => { setSelectedIds(new Set()); }, [activeTab, page]);

  const selectableEmails = emails; // all emails on current page are selectable
  const allPageSelected = selectableEmails.length > 0 && selectableEmails.every((e) => selectedIds.has(e.id));

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allPageSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableEmails.map((e) => e.id)));
    }
  }

  async function handleBulkMarkRead() {
    if (!workspaceId || selectedIds.size === 0) return;
    const toMark = emails.filter((e) => selectedIds.has(e.id));

    // Optimistic update
    setEmails((prev) =>
      prev.map((e) => {
        if (!selectedIds.has(e.id)) return e;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (e.source === "thread" && e.thread?.is_read === false)
          return { ...e, thread: { ...e.thread!, is_read: true } };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (e.source === "log" && (e.log as any)?.is_read === false)
          return { ...e, log: { ...(e.log as any), is_read: true } };
        return e;
      })
    );
    setSelectedIds(new Set());

    // Persist to DB
    await Promise.all(
      toMark.map((e) => {
        if (e.source === "thread" && e.thread) return markThreadRead(workspaceId, e.thread.id, true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (e.source === "log" && (e.log as any)?.is_read === false) return markLogRead(workspaceId, e.id, true);
        return Promise.resolve();
      })
    );
    showToast({ title: `${toMark.length} email${toMark.length !== 1 ? "s" : ""} marked as read` });
    // Refresh counts so the unread badge updates
    const ownerIds = myEmailsOnly && userId ? [userId] : undefined;
    getUnifiedEmailCounts(workspaceId, ownerIds).then((c) =>
      setCounts({ all: c.all, sent: c.sent, drafts: c.drafts, scheduled: c.scheduled, replied: c.replied, unread: c.unread ?? 0 })
    );
  }

  async function handleBulkDelete() {
    if (!workspaceId || selectedIds.size === 0) return;
    setBulkDeleting(true);
    const toDelete = emails.filter((e) => selectedIds.has(e.id));
    await Promise.all(
      toDelete.map((e) => {
        if (e.source === "log") return deleteEmailLog(workspaceId, e.id);
        if (!e.thread) return Promise.resolve(); // guard: thread should always exist for source=thread
        if (e.thread.status === "draft") return deleteEmailDraft(workspaceId, e.thread.id);
        return removeEmailFromCRM(workspaceId, e.thread.id);
      })
    );
    setSelectedIds(new Set());
    setBulkDeleting(false);
    showToast({ title: `${toDelete.length} email${toDelete.length !== 1 ? "s" : ""} deleted` });
    refresh();
  }

  // ─── Search debounce ─────────────────────────────────────────────────────
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // ─── Fetch data ──────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!workspaceId) return;

    async function load() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setLoading(true);

      const ownerIds = myEmailsOnly && userId ? [userId] : undefined;
      const filters: EmailFilters = {
        status: activeTab === "all" ? undefined : activeTab === "drafts" ? "draft" : activeTab,
        ownerIds,
        search: debouncedSearch || undefined,
        page,
        pageSize: PAGE_SIZE,
      };

      const [emailsResult, countsResult] = await Promise.all([
        getUnifiedEmails(workspaceId!, filters),
        getUnifiedEmailCounts(workspaceId!, ownerIds),
      ]);

      setEmails(emailsResult.data);
      setTotal(emailsResult.total);
      setCounts({
        all: countsResult.all,
        sent: countsResult.sent,
        drafts: countsResult.drafts,
        scheduled: countsResult.scheduled,
        replied: countsResult.replied,
        unread: countsResult.unread ?? 0,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setLoading(false);
    }

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, userId, activeTab, debouncedSearch, page, myEmailsOnly]);

  function refresh() {
    if (!workspaceId) return;
    const ownerIds = myEmailsOnly && userId ? [userId] : undefined;
    const filters: EmailFilters = {
      status: activeTab === "all" ? undefined : activeTab === "drafts" ? "draft" : activeTab,
      ownerIds,
      search: debouncedSearch || undefined,
      page,
      pageSize: PAGE_SIZE,
    };
    Promise.all([
      getUnifiedEmails(workspaceId, filters),
      getUnifiedEmailCounts(workspaceId, ownerIds),
    ]).then(([emailsResult, countsResult]) => {
      setEmails(emailsResult.data);
      setTotal(emailsResult.total);
      setCounts({
        all: countsResult.all,
        sent: countsResult.sent,
        drafts: countsResult.drafts,
        scheduled: countsResult.scheduled,
        replied: countsResult.replied,
        unread: countsResult.unread ?? 0,
      });
    });
  }

  // ─── Auto-save draft (background — no modal close, no toast) ─────────────
  async function handleAutoSaveDraft(payload: ComposePayload) {
    if (!workspaceId || !userId) return;

    // Use draftToEdit IDs (existing draft opened by user) OR previously auto-saved IDs
    const autoIds = autoSaveDraftIdsRef.current;
    const editIds =
      draftToEdit?.threadId && draftToEdit?.messageId
        ? { threadId: draftToEdit.threadId, messageId: draftToEdit.messageId }
        : autoIds;

    if (editIds?.threadId && editIds?.messageId) {
      // Update existing draft silently
      await Promise.all([
        updateEmailThread(workspaceId, editIds.threadId, {
          subject: payload.subject,
          contact_id: payload.contact_id,
        }),
        updateEmailMessage(editIds.messageId, {
          to_email: payload.to_email,
          body: payload.body,
          body_html: payload.bodyHtml,
          cc_emails: payload.cc_emails,
          bcc_emails: payload.bcc_emails,
          attachments: payload.attachments.map(({ content: _c, ...meta }) => meta),
        }),
      ]);
      return;
    }

    // Create a brand-new draft silently
    const { thread, error } = await createEmailDraft(workspaceId, userId, {
      contact_id: payload.contact_id,
      subject: payload.subject,
      body: payload.body,
      body_html: payload.bodyHtml,
      to_email: payload.to_email,
      cc_emails: payload.cc_emails,
      bcc_emails: payload.bcc_emails,
      attachments: payload.attachments.map(({ content: _c, ...meta }) => meta),
      ai_generated: payload.ai_generated,
      ai_tone: payload.ai_tone,
    });
    if (thread && !error) {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: msgRow } = await (supabase as any)
        .from("email_messages")
        .select("id")
        .eq("thread_id", thread.id)
        .limit(1)
        .single();
      autoSaveDraftIdsRef.current = { threadId: thread.id, messageId: msgRow?.id ?? "" };
      refresh(); // bump draft count in tabs
    }
  }

  // ─── Compose handlers ─────────────────────────────────────────────────────
  async function handleSend(payload: ComposePayload) {
    if (!workspaceId || !userId) return;
    setComposeError(null);
    setComposeSending(true);

    let resolvedThreadId: string;
    let resolvedMessageId: string;

    // Determine draft IDs: user-opened draft → auto-saved draft → nothing
    const sendDraftIds =
      draftToEdit?.threadId && draftToEdit?.messageId ? draftToEdit
      : autoSaveDraftIdsRef.current ?? null;

    if (sendDraftIds?.threadId && sendDraftIds?.messageId) {
      // Sending from an existing draft → update in place
      const [threadRes, msgRes] = await Promise.all([
        updateEmailThread(workspaceId, sendDraftIds.threadId, {
          subject: payload.subject,
          contact_id: payload.contact_id,
        }),
        updateEmailMessage(sendDraftIds.messageId, {
          to_email: payload.to_email,
          body: payload.body,
          body_html: payload.bodyHtml,
          cc_emails: payload.cc_emails,
          bcc_emails: payload.bcc_emails,
          // Keep url but strip base64 content before saving to DB
          attachments: payload.attachments.map(({ content: _c, ...meta }) => meta),
        }),
      ]);
      if (threadRes.error || msgRes.error) {
        showToast({ title: "Failed to send", subtitle: threadRes.error ?? msgRes.error ?? "" });
        setComposeSending(false);
        return;
      }
      resolvedThreadId  = sendDraftIds.threadId;
      resolvedMessageId = sendDraftIds.messageId;
    } else {
      // New email → create draft thread + message in DB first
      const { thread, error: draftErr } = await createEmailDraft(workspaceId, userId, {
        contact_id: payload.contact_id,
        subject: payload.subject,
        body: payload.body,
        body_html: payload.bodyHtml,
        to_email: payload.to_email,
        cc_emails: payload.cc_emails,
        bcc_emails: payload.bcc_emails,
        // Keep url but strip base64 content before saving to DB
        attachments: payload.attachments.map(({ content: _c, ...meta }) => meta),
        ai_generated: payload.ai_generated,
        ai_tone: payload.ai_tone,
      });

      if (draftErr || !thread) {
        showToast({ title: "Failed to send", subtitle: draftErr ?? "Unknown error" });
        setComposeSending(false);
        return;
      }

      // Get the message ID just created
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: msgRow } = await (supabase as any)
        .from("email_messages")
        .select("id")
        .eq("thread_id", thread.id)
        .limit(1)
        .single();

      resolvedThreadId  = thread.id;
      resolvedMessageId = msgRow?.id ?? "";
    }

    // 3. Send via Gmail SMTP (server-side API route) + mark sent in DB
    const sendRes = await fetch("/api/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId:  resolvedThreadId,
        messageId: resolvedMessageId,
        workspaceId,
        to: payload.to_email,
        cc: payload.cc_emails,
        bcc: payload.bcc_emails,
        subject: payload.subject,
        text: payload.body,
        html: payload.bodyHtml ?? payload.body,
        attachments: (payload.attachments ?? [])
          .filter((a) => a.content) // only send attachments with actual file content
          .map((a) => ({ name: a.name, mime_type: a.mime_type, content: a.content })),
      }),
    });

    const sendResult = await sendRes.json();

    if (!sendRes.ok || sendResult.error) {
      const errMsg = sendResult.error ?? "SMTP error — check server logs";
      setComposeError(errMsg);
      setComposeSending(false);
      return;
    }

    // 4. Log to contact activity timeline
    if (payload.contact_id) {
      await logOutboundEmail(workspaceId, payload.contact_id, resolvedThreadId, {
        from_email: userEmail,
        from_name: userName,
        to_email: payload.to_email,
        subject: payload.subject,
        body_preview: payload.body.slice(0, 200),
      });
    }

    setComposeSending(false);
    setShowCompose(false);
    setDraftToEdit(null);
    setComposeError(null);
    autoSaveDraftIdsRef.current = null;
    showToast({ title: "Email sent!", subtitle: `To ${payload.to_email}` });
    refresh();
  }

  async function handleSchedule(payload: ComposePayload, scheduledAt: string) {
    if (!workspaceId || !userId) return;
    setComposeSending(true);

    let targetThreadId: string | null = null;

    if (draftToEdit?.threadId && draftToEdit?.messageId) {
      // Scheduling from existing draft → update in place
      const [threadRes, msgRes] = await Promise.all([
        updateEmailThread(workspaceId, draftToEdit.threadId, {
          subject: payload.subject,
          contact_id: payload.contact_id,
        }),
        updateEmailMessage(draftToEdit.messageId, {
          to_email: payload.to_email,
          body: payload.body,
          body_html: payload.bodyHtml,
          cc_emails: payload.cc_emails,
          bcc_emails: payload.bcc_emails,
          attachments: payload.attachments,
        }),
      ]);
      if (threadRes.error || msgRes.error) {
        showToast({ title: "Failed to schedule", subtitle: threadRes.error ?? msgRes.error ?? "" });
        setComposeSending(false);
        return;
      }
      targetThreadId = draftToEdit.threadId;
    } else {
      const { thread, error } = await createEmailDraft(workspaceId, userId, {
        contact_id: payload.contact_id,
        subject: payload.subject,
        body: payload.body,
        body_html: payload.bodyHtml,
        to_email: payload.to_email,
        cc_emails: payload.cc_emails,
        bcc_emails: payload.bcc_emails,
        attachments: payload.attachments.map(({ content: _c, ...meta }) => meta),
        ai_generated: payload.ai_generated,
        ai_tone: payload.ai_tone,
      });
      if (error || !thread) {
        showToast({ title: "Failed to schedule", subtitle: error ?? "" });
        setComposeSending(false);
        return;
      }
      targetThreadId = thread.id;
    }

    await scheduleEmail(workspaceId, targetThreadId, scheduledAt);
    showToast({ title: "Email scheduled!", subtitle: new Date(scheduledAt).toLocaleString() });
    setShowCompose(false);
    setDraftToEdit(null);
    refresh();
    setComposeSending(false);
  }

  // Open compose pre-filled when user clicks a draft email row
  async function handleDraftClick(email: UnifiedEmailRow) {
    if (!workspaceId || !email.thread) return;
    const { thread, messages } = await getEmailThread(workspaceId, email.thread.id);
    const msg = messages?.[0]; // first (usually only) outbound message
    setDraftToEdit({
      threadId:    thread?.id ?? "",
      messageId:   msg?.id    ?? "",
      subject:     thread?.subject ?? "",
      bodyHtml:    msg?.body_html ?? msg?.body ?? "",
      toEmail:     msg?.to_email  ?? "",
      attachments: (msg?.attachments as import("@/lib/queries/emails").EmailAttachment[]) ?? [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      contact:     (thread as any)?.contact ?? null,
    });
    setShowCompose(true);
  }

  async function handleSaveDraft(payload: ComposePayload) {
    if (!workspaceId || !userId) return;

    // Determine IDs: user-opened draft first, then auto-saved draft
    const autoIds = autoSaveDraftIdsRef.current;
    const saveDraftIds =
      draftToEdit?.threadId && draftToEdit?.messageId ? draftToEdit
      : autoIds ?? null;

    if (saveDraftIds?.threadId && saveDraftIds?.messageId) {
      // Existing draft (user-opened or auto-saved) → update in place
      const [threadRes, msgRes] = await Promise.all([
        updateEmailThread(workspaceId, saveDraftIds.threadId, {
          subject: payload.subject,
          contact_id: payload.contact_id,
        }),
        updateEmailMessage(saveDraftIds.messageId, {
          to_email: payload.to_email,
          body: payload.body,
          body_html: payload.bodyHtml,
          cc_emails: payload.cc_emails,
          bcc_emails: payload.bcc_emails,
          attachments: payload.attachments,
        }),
      ]);
      const error = threadRes.error ?? msgRes.error;
      if (!error) {
        showToast({ title: "Draft updated" });
        setShowCompose(false);
        setDraftToEdit(null);
        autoSaveDraftIdsRef.current = null;
        refresh();
      } else {
        showToast({ title: "Failed to update draft", subtitle: error });
      }
      return;
    }

    // Completely new draft (no auto-save yet)
    const { error } = await createEmailDraft(workspaceId, userId, {
      contact_id: payload.contact_id,
      subject: payload.subject,
      body: payload.body,
      body_html: payload.bodyHtml,
      to_email: payload.to_email,
      cc_emails: payload.cc_emails,
      bcc_emails: payload.bcc_emails,
      attachments: payload.attachments.map(({ content: _c, ...meta }) => meta),
      ai_generated: payload.ai_generated,
      ai_tone: payload.ai_tone,
    });
    if (!error) {
      showToast({ title: "Draft saved" });
      setShowCompose(false);
      autoSaveDraftIdsRef.current = null;
      refresh();
    } else {
      showToast({ title: "Failed to save draft", subtitle: error });
    }
  }

  // ─── Delete handler ───────────────────────────────────────────────────────
  async function handleConfirmDelete() {
    if (!deleteTarget || !workspaceId) return;
    setDeleteLoading(true);

    let err: string | null = null;
    if (deleteTarget.status === "draft") {
      const res = await deleteEmailDraft(workspaceId, deleteTarget.id);
      err = res.error;
    } else {
      const res = await removeEmailFromCRM(workspaceId, deleteTarget.id);
      err = res.error;
    }

    setDeleteLoading(false);
    if (err) {
      showToast({ title: "Delete failed", subtitle: err });
    } else {
      showToast({ title: deleteTarget.status === "draft" ? "Draft deleted" : "Email removed from CRM" });
      setDeleteTarget(null);
      if (activeThreadId === deleteTarget.id) { setActiveEmail(null); router.push("/email", { scroll: false }); }
      refresh();
    }
  }

  async function handleConfirmDeleteLog() {
    if (!deleteLogTarget || !workspaceId) return;
    setDeleteLoading(true);
    const { error } = await deleteEmailLog(workspaceId, deleteLogTarget);
    setDeleteLoading(false);
    if (error) {
      showToast({ title: "Delete failed", subtitle: error });
    } else {
      showToast({ title: "Email deleted" });
      setDeleteLogTarget(null);
      if (activeEmail?.id === deleteLogTarget) { setActiveEmail(null); router.push("/email", { scroll: false }); }
      refresh();
    }
  }

  // ─── Pagination ───────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ─── Detail view (unified) ────────────────────────────────────────────────
  const isDetailView = !!activeEmail;

  // Breadcrumb label — contact name first, then subject fallback
  const detailLabel = activeEmail
    ? (
        (activeEmail.contact as { name?: string } | null)?.name ??
        (threadWithMessages?.contact as { name?: string } | null)?.name ??
        activeEmail.from_email ??
        activeEmail.subject ??
        "Email"
      )
    : "";

  function handleBackToInbox() {
    setActiveEmail(null);
    setThreadWithMessages(null);
    router.push("/email", { scroll: false });
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Page header */}
      <div className="flex items-start justify-between px-8 pt-8 pb-4 shrink-0">
        <div>
          {isDetailView ? (
            <>
              {/* Breadcrumb — matches new-contact page style */}
              <div className="flex items-center gap-2 text-sm text-foreground-muted mb-3">
                <button
                  onClick={handleBackToInbox}
                  className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <RiArrowLeftLine size={14} />
                  Back
                </button>
                <span>/</span>
                <span>Email</span>
                <span>/</span>
                <span className="text-foreground font-medium truncate max-w-[400px]">
                  {detailLabel}
                </span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight truncate max-w-[600px]">
                {detailLabel}
              </h1>
            </>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-widest text-foreground-muted mb-1">
                Outreach Creator · Email
              </p>
              <h1 className="text-3xl font-bold tracking-tight">Email</h1>
              <p className="text-sm text-foreground-muted mt-1">
                All one-to-one outreach across email. Compose, schedule, and track replies in one place.
              </p>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => { setDraftToEdit(null); setShowCompose(true); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <RiMailSendLine size={15} />
            Compose
          </button>
        </div>
      </div>

      {/* Tabs */}
      {!isDetailView && (
        <div className="px-8 shrink-0">
          <div className="flex items-center gap-0.5 border-b border-border">
            {(
              [
                { value: "all", label: "All", count: counts.all },
                { value: "replied", label: "Inbox", count: counts.replied },
                { value: "sent", label: "Sent", count: counts.sent },
                { value: "drafts", label: "Drafts", count: counts.drafts },
                { value: "scheduled", label: "Scheduled", count: counts.scheduled },
              ] as { value: TabValue; label: string; count: number }[]
            ).map((tab) => (
              <button
                key={tab.value}
                onClick={() => { setActiveTab(tab.value); setPage(1); }}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.value
                    ? "border-primary text-primary"
                    : "border-transparent text-foreground-muted hover:text-foreground"
                }`}
              >
                {tab.label}
                <span
                  className={`text-xs font-semibold rounded-full px-1.5 py-0.5 min-w-[22px] text-center ${
                    activeTab === tab.value
                      ? "bg-primary/10 text-primary"
                      : "bg-background-subtle text-foreground-muted"
                  }`}
                >
                  {tab.count}
                </span>
                {/* Unread count badge — only on Inbox tab */}
                {tab.value === "replied" && counts.unread > 0 && (
                  <span className="text-[10px] font-bold bg-teal-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center -ml-1">
                    {counts.unread}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter + Search bar */}
      {!isDetailView && (
        <div className="flex items-center justify-between gap-4 px-8 py-3 shrink-0">
          <div className="flex items-center gap-2">
            {!myEmailsOnly && (
              <>
                <span className="inline-flex items-center gap-1.5 bg-primary/8 border border-primary/20 text-primary rounded-full px-3 py-1.5 text-xs font-medium">
                  Owner: All
                  <button onClick={() => setMyEmailsOnly(true)}>
                    <RiCloseLine size={12} />
                  </button>
                </span>
                <button
                  onClick={() => { setMyEmailsOnly(true); setPage(1); }}
                  className="text-xs text-foreground-muted hover:text-foreground transition-colors"
                >
                  · Clear all
                </button>
              </>
            )}
            {myEmailsOnly && (
              <button
                onClick={() => { setMyEmailsOnly(false); setPage(1); }}
                className="text-xs text-foreground-muted hover:text-foreground border border-border rounded-full px-3 py-1.5 transition-colors"
              >
                My emails only — show all
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Mark all as read button — only shown when there are unread emails */}
            {emails.some(e =>
              (e.source === "thread" && e.thread?.is_read === false) ||
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (e.source === "log" && e.direction === "inbound" && (e.log as any)?.is_read === false)
            ) && (
              <button
                onClick={async () => {
                  if (!workspaceId) return;
                  // Optimistic update
                  setEmails(prev => prev.map(e => {
                    if (e.source === "thread" && e.thread?.is_read === false)
                      return { ...e, thread: { ...e.thread!, is_read: true } };
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    if (e.source === "log" && (e.log as any)?.is_read === false)
                      return { ...e, log: { ...(e.log as any), is_read: true } };
                    return e;
                  }));
                  await markAllRead(workspaceId);
                }}
                className="text-xs font-medium text-foreground-muted hover:text-foreground border border-border rounded-full px-3 py-1.5 transition-colors whitespace-nowrap"
              >
                Mark all as read
              </button>
            )}
            <div className="relative w-72">
              <RiSearchLine size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search subject, body, or contact..."
                className="w-full pl-9 pr-4 py-2 text-sm rounded-full border border-border bg-background outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/10"
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── Content ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        {activeEmail ? (
          <EmailContactDetail
            workspaceId={workspaceId!}
            userId={userId ?? undefined}
            ownerName={userName}
            activeEmail={activeEmail}
            allThreads={emails
              .filter((e) => e.source === "thread" && e.thread)
              .map((e) =>
                e.thread!.id === activeEmail.thread?.id && threadWithMessages
                  ? threadWithMessages
                  : e.thread!
              )}
            onSelectEmail={(email) => {
              selectEmail(email);
            }}
            onReply={(ctx?: ReplyContext) => {
              if (ctx) {
                setDraftToEdit({
                  threadId: "",
                  messageId: "",
                  subject: ctx.subject,
                  bodyHtml: ctx.bodyHtml,
                  toEmail: ctx.to,
                  contact: (activeEmail.contact as import("@/lib/supabase/types").ContactRow) ?? null,
                  attachments: [],
                });
              } else {
                setDraftToEdit(null);
              }
              setShowCompose(true);
            }}
            onForward={(ctx?: ForwardContext) => {
              if (ctx) {
                setDraftToEdit({
                  threadId: "",
                  messageId: "",
                  subject: ctx.subject,
                  bodyHtml: ctx.bodyHtml,
                  toEmail: "",
                  contact: null,
                  attachments: ctx.attachments ?? [],
                });
              } else {
                setDraftToEdit(null);
              }
              setShowCompose(true);
            }}
            onCompose={() => { setDraftToEdit(null); setShowCompose(true); }}
            loading={threadLoading}
          />
        ) : (
          <div className="px-8 overflow-y-auto h-full pb-8">
            {loading ? (
              <EmailListSkeleton />
            ) : emails.length === 0 ? (
              <EmailEmpty tab={activeTab} onCompose={() => setShowCompose(true)} />
            ) : (
              <>
                {/* ── Bulk action bar ── */}
                {selectedIds.size > 0 && (
                  <div className="flex items-center gap-3 mb-3 px-4 py-2.5 bg-foreground text-background rounded-2xl">
                    <button
                      onClick={toggleSelectAll}
                      className="flex items-center gap-2 text-sm font-medium opacity-80 hover:opacity-100 transition-opacity"
                    >
                      {allPageSelected
                        ? <RiCheckboxLine size={16} className="text-primary" />
                        : <RiCheckboxBlankLine size={16} />}
                      {selectedIds.size} selected
                    </button>
                    <span className="h-4 w-px bg-background/20" />
                    <button
                      onClick={toggleSelectAll}
                      className="text-xs font-medium opacity-70 hover:opacity-100 transition-opacity"
                    >
                      {allPageSelected ? "Deselect all" : "Select all on page"}
                    </button>
                    <div className="flex-1" />
                    {/* Mark as read — only shown when at least one selected email is unread */}
                    {emails.some((e) =>
                      selectedIds.has(e.id) && (
                        (e.source === "thread" && e.thread?.is_read === false) ||
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (e.source === "log" && e.direction === "inbound" && (e.log as any)?.is_read === false)
                      )
                    ) && (
                      <button
                        onClick={handleBulkMarkRead}
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500 text-white text-sm font-semibold hover:bg-teal-600 transition-colors"
                      >
                        Mark as read
                      </button>
                    )}
                    <button
                      onClick={handleBulkDelete}
                      disabled={bulkDeleting}
                      className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors"
                    >
                      <RiDeleteBinLine size={14} />
                      {bulkDeleting ? "Deleting…" : `Delete ${selectedIds.size}`}
                    </button>
                    <button
                      onClick={() => setSelectedIds(new Set())}
                      className="opacity-60 hover:opacity-100 transition-opacity"
                    >
                      <RiCloseLine size={16} />
                    </button>
                  </div>
                )}

                <div className="divide-y divide-border border border-border rounded-2xl overflow-hidden">
                  {emails.map((email) => (
                    <EmailRow
                      key={email.id}
                      email={email}
                      checked={selectedIds.has(email.id)}
                      onCheck={() => toggleSelect(email.id)}
                      onClick={() => {
                        if (email.source === "thread" && email.thread) {
                          // Draft → open compose pre-filled instead of thread detail
                          if (email.status === "draft") {
                            handleDraftClick(email);
                          } else {
                            selectEmail(email);
                          }
                        } else if (email.source === "log") {
                          selectEmail(email);
                        }
                      }}
                      onDelete={() => {
                        if (email.source === "thread" && email.thread) {
                          setDeleteTarget(email.thread);
                        } else if (email.source === "log") {
                          setDeleteLogTarget(email.id);
                        }
                      }}
                    />
                  ))}
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-foreground-muted">
                    Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} email{total !== 1 ? "s" : ""}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                      className="size-9 rounded-full border border-border flex items-center justify-center text-foreground-muted hover:bg-background-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <RiArrowLeftLine size={14} />
                    </button>
                    {Array.from({ length: Math.min(Math.ceil(total / PAGE_SIZE), 5) }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`size-9 rounded-full text-sm font-medium transition-colors ${
                          p === page
                            ? "bg-primary text-white"
                            : "border border-border text-foreground hover:bg-background-subtle"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      disabled={page >= Math.ceil(total / PAGE_SIZE)}
                      onClick={() => setPage((p) => p + 1)}
                      className="size-9 rounded-full border border-border flex items-center justify-center text-foreground-muted hover:bg-background-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <RiArrowRightLine size={14} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ─── Modals ───────────────────────────────────────────────────────── */}
      {showCompose && (
        <ComposeModal
          key={draftToEdit?.threadId ? `draft-${draftToEdit.threadId}` : "new"}
          initialContact={draftToEdit?.contact ?? undefined}
          initialSubject={draftToEdit?.subject}
          initialBodyHtml={draftToEdit?.bodyHtml}
          initialToEmail={draftToEdit?.toEmail}
          initialAttachments={draftToEdit?.attachments}
          onClose={() => { setShowCompose(false); setDraftToEdit(null); setComposeError(null); autoSaveDraftIdsRef.current = null; }}
          onSend={handleSend}
          onSchedule={handleSchedule}
          onSaveDraft={handleSaveDraft}
          onAutoSaveDraft={handleAutoSaveDraft}
          fromEmail={userEmail}
          fromName={userName}
          loading={composeSending}
          sendError={composeError}
          onDismissSendError={() => setComposeError(null)}
        />
      )}

      {deleteTarget && deleteTarget.status === "draft" && (
        <DeleteDraftModal
          thread={deleteTarget}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}

      {deleteTarget && deleteTarget.status !== "draft" && (
        <RemoveSentModal
          thread={deleteTarget}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}

      {/* Confirm delete for Gmail log emails */}
      {deleteLogTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-background rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-bold mb-1">Delete email?</h2>
            <p className="text-sm text-foreground-muted mb-6">This email will be permanently removed from the CRM. This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteLogTarget(null)}
                className="px-4 py-2 rounded-full border border-border text-sm font-medium hover:bg-background-subtle transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteLog}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-full bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {deleteLoading ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EmailPage() {
  return (
    <React.Suspense>
      <EmailPageInner />
    </React.Suspense>
  );
}

// ─── Email Row ────────────────────────────────────────────────────────────────

function EmailRow({
  email,
  checked,
  onCheck,
  onClick,
  onDelete,
}: {
  email: UnifiedEmailRow;
  checked?: boolean;
  onCheck?: () => void;
  onClick: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const contact = email.contact as { name?: string; email?: string } | null;
  const isInbound = email.direction === "inbound";
  const isUnread =
    (email.source === "thread" && email.thread?.is_read === false) ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (email.source === "log" && email.direction === "inbound" && (email.log as any)?.is_read === false);

  React.useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div
      className={`relative flex items-center gap-4 px-5 py-4 transition-colors cursor-pointer group ${
        isUnread
          ? "bg-teal-50 hover:bg-teal-100/60 dark:bg-teal-950/30 dark:hover:bg-teal-950/40"
          : "hover:bg-background-subtle"
      }`}
      onClick={onClick}
    >
      {/* Unread accent bar */}
      {isUnread && (
        <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-teal-500 rounded-l-2xl" />
      )}

      {/* Checkbox */}
      <input
        type="checkbox"
        className="shrink-0 accent-primary size-4 cursor-pointer"
        checked={checked ?? false}
        onChange={(e) => { e.stopPropagation(); onCheck?.(); }}
        onClick={(e) => e.stopPropagation()}
      />

      {/* Avatar — inbound shows contact, outbound shows us */}
      <div className={`size-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${isInbound ? "bg-sky-100 text-sky-700" : "bg-primary/10 text-primary"}`}>
        {isInbound
          ? (contact?.name?.slice(0, 2).toUpperCase() ?? email.from_email?.slice(0, 2).toUpperCase() ?? "?")
          : (contact?.name?.slice(0, 2).toUpperCase() ?? "?")}
      </div>

      {/* Contact / From */}
      <div className="w-40 shrink-0">
        <div className="flex items-center gap-1.5">
          {isUnread && (
            <span className="size-2 rounded-full bg-teal-500 shrink-0" title="Unread" />
          )}
          <p className={`text-sm truncate ${isUnread ? "font-bold text-foreground" : "font-semibold"}`}>
            {isInbound
              ? (contact?.name ?? email.from_email ?? "—")
              : (contact?.name ?? "—")}
          </p>
        </div>
        <p className="text-xs text-foreground-muted truncate">
          {isInbound ? email.from_email : contact?.email ?? "—"}
        </p>
      </div>

      {/* Subject + Preview */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <p className={`text-sm truncate ${isUnread ? "font-bold text-foreground" : "font-semibold"}`}>
          {email.subject || "(No subject)"}
        </p>
        <p className={`text-xs truncate ${isUnread ? "text-foreground-muted font-medium" : "text-foreground-muted"}`}>
          {(email.body_preview ?? "")
            .replace(/^(To|From|Cc|Bcc):\s*\S+\s*/gi, "")
            .replace(/\*{2}([^*]+)\*{2}/g, "$1")
            .replace(/\*([^*\n]+)\*/g, "$1")
            .replace(/_{2}([^_]+)_{2}/g, "$1")
            .replace(/_([^_\n]+)_/g, "$1")
            .replace(/\[image:[^\]]*\]/g, "")
            .replace(/<https?:\/\/[^>]+>/g, "")
            .replace(/https?:\/\/\S+/g, "")
            .replace(/\s{2,}/g, " ")
            .trim()}
        </p>
      </div>

      {/* Status + Date — fixed widths so columns always align */}
      <div className="shrink-0 flex items-center gap-4">
        <div className="w-16 flex justify-end">
          <EmailStatusBadge email={email} />
        </div>
        <div className="w-10 text-right">
          <span className="text-xs text-foreground-muted whitespace-nowrap">
            {formatShortDate(email.last_message_at)}
          </span>
        </div>
      </div>

      {/* 3-dot menu — always reserves w-8, visible for all emails on hover */}
      <div className="shrink-0 w-8 relative" ref={menuRef} onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="size-8 rounded-full flex items-center justify-center text-foreground-muted hover:bg-background-muted transition-colors opacity-0 group-hover:opacity-100"
        >
          <RiMoreLine size={16} />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-44 bg-background border border-border rounded-xl shadow-lg z-20 overflow-hidden">
            <button
              onClick={() => { setMenuOpen(false); onClick(); }}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-background-subtle transition-colors"
            >
              Open
            </button>
            <button
              onClick={() => { setMenuOpen(false); onDelete(); }}
              className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
            >
              {email.source === "thread" && email.status === "draft" ? "Delete draft" :
               email.source === "thread" ? "Remove from CRM" : "Delete"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function EmailStatusBadge({ email }: { email: UnifiedEmailRow }) {
  // Inbound email from contact
  if (email.direction === "inbound") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
        <span className="size-2 rounded-full bg-primary" />
        Inbox
      </span>
    );
  }

  if (email.status === "replied") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
        <span className="size-2 rounded-full bg-primary" />
        Inbox
      </span>
    );
  }

  if (email.status === "scheduled" && email.scheduled_at) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
        <span className="size-2 rounded-full bg-primary" />
        Scheduled
      </span>
    );
  }

  if (email.status === "draft") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground-muted">
        <span className="size-2 rounded-full bg-foreground-muted/50" />
        Draft
      </span>
    );
  }

  if (email.is_stale && email.stale_since_days) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-500">
        <span className="size-2 rounded-full bg-orange-500" />
        Stale
      </span>
    );
  }

  // Sent
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground-muted">
      <span className="size-2 rounded-full bg-foreground-muted/40" />
      Sent
    </span>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmailEmpty({ tab, onCompose }: { tab: TabValue; onCompose: () => void }) {
  const messages: Record<TabValue, { title: string; sub: string }> = {
    all: { title: "No emails yet", sub: "Start by composing your first email." },
    sent: { title: "No sent emails", sub: "Sent emails will appear here." },
    drafts: { title: "No drafts", sub: "Saved drafts will appear here." },
    scheduled: { title: "No scheduled emails", sub: "Schedule an email to send it later." },
    replied: { title: "No replies yet", sub: "When contacts reply, threads appear here." },
  };
  const { title, sub } = messages[tab];

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="size-16 rounded-full bg-background-subtle flex items-center justify-center mb-4">
        <RiMailSendLine size={28} className="text-foreground-muted" />
      </div>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      <p className="text-sm text-foreground-muted mb-6">{sub}</p>
      {tab === "all" && (
        <button
          onClick={onCompose}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <RiMailSendLine size={14} />
          Compose
        </button>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function EmailListSkeleton() {
  return (
    <div className="divide-y divide-border border border-border rounded-2xl overflow-hidden animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <div className="size-4 rounded bg-border shrink-0" />
          <div className="size-9 rounded-full bg-border shrink-0" />
          <div className="w-36 space-y-1.5 shrink-0">
            <div className="h-3 rounded bg-border w-full" />
            <div className="h-2.5 rounded bg-border w-3/4" />
          </div>
          <div className="flex-1 space-y-1.5">
            <div className="h-3 rounded bg-border w-1/2" />
            <div className="h-2.5 rounded bg-border w-4/5" />
          </div>
          <div className="w-36 h-3 rounded bg-border shrink-0" />
          <div className="w-10 h-2.5 rounded bg-border shrink-0" />
        </div>
      ))}
    </div>
  );
}
