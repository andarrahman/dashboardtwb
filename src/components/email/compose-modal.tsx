"use client";

import * as React from "react";
import {
  RiSendPlaneLine,
  RiCloseLine,
  RiAttachmentLine,
  RiDeleteBinLine,
  RiTimeLine,
  RiBold,
  RiItalic,
  RiUnderline,
  RiListUnordered,
  RiLinkM,
  RiImageLine,
  RiCodeLine,
  RiArrowDownSLine,
  RiSearchLine,
  RiCheckLine,
} from "@remixicon/react";
import { AiGenerate, type AiTone, type AiState } from "./ai-generate";
import { DatePicker } from "@/components/ui/date-picker";
import type { ContactRow, EmailAttachment } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/browser";
import { useWorkspace } from "@/lib/hooks/use-workspace";

interface ComposeModalProps {
  initialContact?: ContactRow | null;
  /** Pre-fill subject (when opening from a draft) */
  initialSubject?: string;
  /** Pre-fill editor with saved HTML body (when opening from a draft) */
  initialBodyHtml?: string;
  /** Pre-fill To field with a raw email address (when no contact object) */
  initialToEmail?: string;
  /** Pre-fill attachments (when opening from a draft) */
  initialAttachments?: EmailAttachment[];
  onClose: () => void;
  onSend: (payload: ComposePayload) => void;
  onSchedule: (payload: ComposePayload, scheduledAt: string) => void;
  onSaveDraft: (payload: ComposePayload) => void;
  /** Called every 30 s with the current draft payload — does NOT close the modal */
  onAutoSaveDraft?: (payload: ComposePayload) => void;
  fromEmail?: string;
  fromName?: string;
  loading?: boolean;
  /** If set, shows a red error banner above the footer so the user can fix & retry */
  sendError?: string | null;
  /** Called when the user dismisses the send error banner */
  onDismissSendError?: () => void;
}

export interface ComposePayload {
  contact_id?: string | null;
  to_email: string;
  cc_emails: string[];
  bcc_emails: string[];
  subject: string;
  body: string;      // plain text
  bodyHtml?: string; // HTML (for email sending)
  attachments: EmailAttachment[];
  ai_generated: boolean;
  ai_tone?: string;
}

export function ComposeModal({
  initialContact,
  initialSubject = "",
  initialBodyHtml = "",
  initialToEmail = "",
  initialAttachments,
  onClose,
  onSend,
  onSchedule,
  onSaveDraft,
  onAutoSaveDraft,
  fromEmail = "andar@twibbonize.com",
  fromName = "Andar R.",
  loading,
  sendError,
  onDismissSendError,
}: ComposeModalProps) {
  const { workspaceId } = useWorkspace();

  // Contact
  const [contact, setContact] = React.useState<ContactRow | null>(initialContact ?? null);
  const [contactSearch, setContactSearch] = React.useState("");
  const [contactResults, setContactResults] = React.useState<ContactRow[]>([]);
  const [showContactSearch, setShowContactSearch] = React.useState(!initialContact && !initialToEmail);

  // Fields
  const [toEmail, setToEmail] = React.useState(initialContact?.email ?? initialToEmail);
  const [subject, setSubject] = React.useState(initialSubject);
  const [body, setBody] = React.useState("");
  const [showCcBcc, setShowCcBcc] = React.useState(false);
  const [ccEmails, setCcEmails] = React.useState("");
  const [bccEmails, setBccEmails] = React.useState("");
  const [attachments, setAttachments] = React.useState<EmailAttachment[]>(initialAttachments ?? []);
  const fileInputRef  = React.useRef<HTMLInputElement>(null);
  const imageInputRef = React.useRef<HTMLInputElement>(null);

  // Rich text editor
  const editorRef = React.useRef<HTMLDivElement>(null);
  const [activeFmt, setActiveFmt] = React.useState({ bold: false, italic: false, underline: false, list: false });
  const [showLinkInput, setShowLinkInput] = React.useState(false);
  const linkPopoverRef   = React.useRef<HTMLDivElement>(null);
  const linkTextInputRef = React.useRef<HTMLInputElement>(null);
  const linkUrlInputRef  = React.useRef<HTMLInputElement>(null);
  const [linkUrl, setLinkUrl]   = React.useState("");
  const [linkText, setLinkText] = React.useState("");
  const savedLinkRangeRef = React.useRef<Range | null>(null);
  const [showVariables, setShowVariables] = React.useState(false);

  // Link tooltip (shown when clicking an existing link in the editor)
  const [linkTooltip, setLinkTooltip] = React.useState<{
    url: string;
    element: HTMLAnchorElement;
    rect: DOMRect;
  } | null>(null);
  const [generatedBody, setGeneratedBody] = React.useState(""); // AI-generated plain text

  // AI
  const [aiState, setAiState] = React.useState<AiState>("idle");
  const [aiTone, setAiTone] = React.useState<AiTone>("warm_followup");
  const [aiProgress, setAiProgress] = React.useState(0);
  const [aiAccepted, setAiAccepted] = React.useState(false);

  // Schedule
  const [showSchedule, setShowSchedule] = React.useState(false);
  const [scheduleDate, setScheduleDate] = React.useState(""); // YYYY-MM-DD
  const [scheduleTime, setScheduleTime] = React.useState("09:00"); // HH:mm

  // Auto-save indicator
  const [lastSaved, setLastSaved] = React.useState<Date | null>(null);
  const [nowTick, setNowTick] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  // Contact search
  // Inject draft body HTML into editor on first mount
  React.useEffect(() => {
    if (initialBodyHtml && editorRef.current) {
      editorRef.current.innerHTML = initialBodyHtml;
      setBody(initialBodyHtml);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!contactSearch || contactSearch.length < 2 || !workspaceId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setContactResults([]);
      return;
    }
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("contacts")
      .select("id, name, email, type, account_tier, country, company, segment")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .ilike("name", `%${contactSearch}%`)
      .limit(5)
      .then(({ data }: { data: ContactRow[] | null }) => {
        setContactResults(data ?? []);
      });
  }, [contactSearch, workspaceId]);

  // Ref that always holds the latest field values — avoids stale closures in setInterval
  const autoSaveStateRef = React.useRef({
    contact, toEmail, subject, body,
    ccEmails, bccEmails, attachments, aiAccepted, aiTone,
  });
  React.useEffect(() => {
    autoSaveStateRef.current = {
      contact, toEmail, subject, body,
      ccEmails, bccEmails, attachments, aiAccepted, aiTone,
    };
  }, [contact, toEmail, subject, body, ccEmails, bccEmails, attachments, aiAccepted, aiTone]);

  // Auto-save every 30 s (only when there is content and the callback is provided)
  React.useEffect(() => {
    if (!onAutoSaveDraft) return;
    const timer = setInterval(() => {
      const d = autoSaveStateRef.current;
      const editorHtml = editorRef.current?.innerHTML ?? d.body;
      const editorText = editorRef.current?.innerText  ?? d.body;
      const hasContent = !!(editorText.trim() || d.subject.trim());
      if (!hasContent) return;

      const payload: ComposePayload = {
        contact_id: d.contact?.id ?? null,
        to_email:   d.toEmail || d.contact?.email || "",
        cc_emails:  d.ccEmails ? d.ccEmails.split(",").map((e) => e.trim()).filter(Boolean) : [],
        bcc_emails: d.bccEmails ? d.bccEmails.split(",").map((e) => e.trim()).filter(Boolean) : [],
        subject:    d.subject,
        body:       editorText,
        bodyHtml:   editorHtml, // skip inline-image upload for auto-save
        attachments: d.attachments,
        ai_generated: d.aiAccepted,
        ai_tone:    d.aiAccepted ? d.aiTone : undefined,
      };
      onAutoSaveDraft(payload);
      setLastSaved(new Date());
    }, 30_000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onAutoSaveDraft]);

  // Read the current format state from the browser
  const updateFmt = React.useCallback(() => {
    try {
      setActiveFmt({
        bold:      document.queryCommandState("bold"),
        italic:    document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        list:      document.queryCommandState("insertUnorderedList"),
      });
    } catch { /* ignore */ }
  }, []);

  // Track active format state as cursor moves / selection changes
  React.useEffect(() => {
    document.addEventListener("selectionchange", updateFmt);
    return () => document.removeEventListener("selectionchange", updateFmt);
  }, [updateFmt]);

  // Auto-focus: Text field first (if empty), otherwise URL field
  React.useEffect(() => {
    if (showLinkInput) {
      requestAnimationFrame(() => {
        if (linkTextInputRef.current && !linkTextInputRef.current.value) {
          linkTextInputRef.current.focus();
        } else {
          linkUrlInputRef.current?.focus();
        }
      });
    }
  }, [showLinkInput]);

  // Close link popover on click outside
  React.useEffect(() => {
    if (!showLinkInput) return;
    function handleMouseDown(e: MouseEvent) {
      if (linkPopoverRef.current && !linkPopoverRef.current.contains(e.target as Node)) {
        closeLinkInput();
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLinkInput]);

  // Sync editor HTML → body state
  function syncBody() {
    if (editorRef.current) setBody(editorRef.current.innerHTML);
  }

  // Apply execCommand (Bold / Italic / Underline / List).
  // NOTE: do NOT call editorRef.current?.focus() when the editor already has
  // focus — the ToolbarBtn preserves it via e.preventDefault() on mousedown.
  // Calling focus() again resets the cursor in Chrome/Safari, breaking toggle.
  function execFormat(command: string, value?: string) {
    // Only (re)focus if the editor doesn't currently own the active element
    if (document.activeElement !== editorRef.current) {
      editorRef.current?.focus();
    }
    document.execCommand(command, false, value);
    syncBody();
    // Update button active-state immediately (selectionchange may lag)
    requestAnimationFrame(updateFmt);
  }

  // Open the link popover — save the current selection & pre-fill display text
  function openLinkInput() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedLinkRangeRef.current = sel.getRangeAt(0).cloneRange();
      setLinkText(sel.toString());
    } else {
      savedLinkRangeRef.current = null;
      setLinkText("");
    }
    setLinkUrl("");
    setShowLinkInput(true);
    setShowVariables(false);
  }

  function closeLinkInput() {
    setShowLinkInput(false);
    setLinkUrl("");
    setLinkText("");
    savedLinkRangeRef.current = null;
  }

  // Handle clicks inside the editor — detect if user clicked an <a> link
  function handleEditorClick(e: React.MouseEvent<HTMLDivElement>) {
    const anchor = (e.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null;
    if (anchor) {
      e.preventDefault();
      setLinkTooltip({ url: anchor.href, element: anchor, rect: anchor.getBoundingClientRect() });
      setShowLinkInput(false);
    } else {
      setLinkTooltip(null);
    }
  }

  // "Change" — re-open link popover pre-filled with the existing link
  function handleChangeLink() {
    if (!linkTooltip) return;
    const el = linkTooltip.element;
    editorRef.current?.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    sel?.removeAllRanges();
    sel?.addRange(range);
    savedLinkRangeRef.current = range.cloneRange();
    setLinkText(el.textContent ?? "");
    setLinkUrl(el.getAttribute("href") ?? "");
    setLinkTooltip(null);
    setShowLinkInput(true);
  }

  // "Remove" — unwrap the <a> tag, keep the text
  function handleRemoveLink() {
    if (!linkTooltip) return;
    editorRef.current?.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNode(linkTooltip.element);
    sel?.removeAllRanges();
    sel?.addRange(range);
    document.execCommand("unlink");
    setLinkTooltip(null);
    syncBody();
  }

  // Apply the hyperlink using saved selection + display text
  function commitLink() {
    if (!linkUrl) return;
    const href = linkUrl.startsWith("http") ? linkUrl : `https://${linkUrl}`;
    editorRef.current?.focus();

    const sel = window.getSelection();
    // Restore the selection that was saved when the popover opened
    if (savedLinkRangeRef.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedLinkRangeRef.current);
    }

    // Build anchor element so we control display text precisely
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.textContent = linkText || href;

    if (savedLinkRangeRef.current) {
      savedLinkRangeRef.current.deleteContents();
      savedLinkRangeRef.current.insertNode(anchor);
      // Collapse cursor to just after the inserted link
      const range = document.createRange();
      range.setStartAfter(anchor);
      range.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(range);
    } else {
      document.execCommand("insertHTML", false, anchor.outerHTML);
    }

    closeLinkInput();
    syncBody();
  }

  // Wrap selection in <code> tag
  // Also called from ToolbarBtn (focus already preserved by e.preventDefault)
  function insertCode() {
    const sel = window.getSelection();
    const text = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).toString() : "";
    document.execCommand(
      "insertHTML",
      false,
      `<code style="font-family:monospace;background:#f4f4f5;padding:0.1em 0.4em;border-radius:4px;font-size:0.85em">${text || "code"}</code>`
    );
    syncBody();
  }

  // Saved selection range for variable picker (focus leaves editor when picker opens)
  const savedRangeRef = React.useRef<Range | null>(null);

  function saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  }

  function restoreSelection() {
    const sel = window.getSelection();
    if (sel && savedRangeRef.current) {
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
    }
  }

  // Insert a {variable} token at cursor position
  function insertVariable(v: string) {
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand("insertText", false, v);
    setShowVariables(false);
    syncBody();
  }

  // Handle image file → convert to data URL (base64) for instant, reliable preview
  function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (imageInputRef.current) imageInputRef.current.value = "";

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      editorRef.current?.focus();
      document.execCommand("insertImage", false, dataUrl);
      syncBody();
    };
    reader.readAsDataURL(file);
  }

  // At send time: find all data:image/... in HTML, upload to Supabase, replace with public URL.
  // Falls back to keeping the data URL if upload fails (image preserved, just heavier).
  async function resolveInlineImages(html: string): Promise<string> {
    const supabase = createClient();
    let result = html;

    // Match every data:image src (base64 inline images)
    const dataImgRegex = /src="(data:image\/([a-zA-Z+]+);base64,[^"]+)"/g;
    const matches = [...result.matchAll(dataImgRegex)];
    if (matches.length === 0) return result;

    for (const match of matches) {
      const dataUrl  = match[1]; // full data:image/... string
      const subtype  = match[2]; // e.g. "png", "jpeg", "gif"
      const mimeType = `image/${subtype}`;

      try {
        // Convert data URL → Blob
        const res  = await fetch(dataUrl);
        const blob = await res.blob();
        const ext  = subtype === "jpeg" ? "jpg" : subtype;
        const path = `email-inline/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        // Try the public email-images bucket first, fall back to signed URL from dc-attachments
        let publicImageUrl: string | null = null;

        const { error: uploadErr } = await (supabase as any).storage
          .from("email-images")
          .upload(path, blob, { contentType: mimeType, upsert: false });

        if (!uploadErr) {
          const { data: urlData } = (supabase as any).storage
            .from("email-images")
            .getPublicUrl(path);
          publicImageUrl = urlData.publicUrl;
        } else {
          // Fallback: upload to dc-attachments with a long-lived signed URL (1 year)
          const { error: dcErr } = await (supabase as any).storage
            .from("dc-attachments")
            .upload(`email-inline/${path.split("/").pop()}`, blob, { contentType: mimeType, upsert: false });
          if (!dcErr) {
            const { data: signedData } = await (supabase as any).storage
              .from("dc-attachments")
              .createSignedUrl(`email-inline/${path.split("/").pop()}`, 31536000); // 1 year
            if (signedData?.signedUrl) publicImageUrl = signedData.signedUrl;
          }
        }

        if (publicImageUrl) {
          result = result.replace(dataUrl, publicImageUrl);
        }
        // If all uploads fail: leave the data URL as-is (image preserved, slightly heavier)
      } catch {
        // Network error etc. → keep data URL
      }
    }

    return result;
  }

  // Discard everything
  function handleDiscard() {
    setBody("");
    setSubject("");
    setToEmail(initialContact?.email ?? "");
    setContact(initialContact ?? null);
    setShowContactSearch(!initialContact);
    setAttachments([]);
    setCcEmails("");
    setBccEmails("");
    setAiState("idle");
    setAiAccepted(false);
    setGeneratedBody("");
    if (editorRef.current) editorRef.current.innerHTML = "";
  }

  // AI generate simulation
  function handleGenerate() {
    setAiState("generating");
    setAiProgress(0);
    const interval = setInterval(() => {
      setAiProgress((p) => {
        if (p >= 95) {
          clearInterval(interval);
          setAiState("done");
          // Populate with generated content
          setSubject(`Re: ${contact?.name ?? "Follow-up"} — next steps`);
          setGeneratedBody(
            `Halo ${contact?.name?.split(" ")[0] ?? "there"},\n\nTerima kasih sudah meluangkan waktu untuk interview minggu lalu dan mengisi survey-nya. Senang sekali mendengar antusiasme Anda untuk program kami.\n\nUpdate dari sisi kami: hasil interview sudah masuk tahap review tim partnership. Saya akan kembali dengan keputusan paling lambat Jumat, 16 Mei, termasuk timeline onboarding kalau lanjut.\n\nSementara itu, kalau ada pertanyaan atau materi tambahan yang ingin Anda bagikan, silakan balas email ini.\n\nSalam,\n${fromName}\nTwibbonize Partnership Team`
          );
          return 100;
        }
        return p + Math.floor(Math.random() * 15) + 5;
      });
    }, 300);
  }

  function handleAcceptAi() {
    setAiAccepted(true);
    setAiState("idle");
    // Inject AI-generated plain text into the rich text editor
    if (editorRef.current && generatedBody) {
      // Replace \n with <br> for proper HTML line breaks
      editorRef.current.innerHTML = generatedBody
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>");
      setBody(editorRef.current.innerHTML);
    }
    setGeneratedBody("");
  }

  async function buildPayload(): Promise<ComposePayload> {
    // Get plain text for body preview; HTML for rich content
    const rawHtml = editorRef.current?.innerHTML ?? body;
    const plain   = editorRef.current?.innerText  ?? body;
    // Upload any base64 inline images to Supabase and replace with public URLs.
    // The editor itself is NOT modified — no broken-image flash during sending.
    const html = await resolveInlineImages(rawHtml);

    return {
      contact_id: contact?.id ?? null,
      to_email: toEmail || contact?.email || "",
      cc_emails: ccEmails ? ccEmails.split(",").map((e) => e.trim()).filter(Boolean) : [],
      bcc_emails: bccEmails ? bccEmails.split(",").map((e) => e.trim()).filter(Boolean) : [],
      subject,
      body: plain,   // plain text (for DB preview, logging)
      bodyHtml: html, // HTML (for SMTP sending)
      // attachments already have base64 content from handleFileChange
      attachments,
      ai_generated: aiAccepted,
      ai_tone: aiAccepted ? aiTone : undefined,
    };
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (fileInputRef.current) fileInputRef.current.value = "";

    files.forEach((f) => {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target?.result as string;
        const base64  = dataUrl.split(",")[1] ?? "";

        // Add to state immediately with content (for SMTP sending)
        // url starts as undefined — we'll update it after upload
        setAttachments((prev) => [
          ...prev,
          { name: f.name, size: f.size, mime_type: f.type, content: base64 },
        ]);

        // Upload to Supabase storage in background so we have a persistent download URL
        try {
          const supabase = createClient();
          const ext  = f.name.split(".").pop() ?? "bin";
          const path = `email-attachments/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const { error } = await (supabase as any).storage
            .from("dc-attachments")
            .upload(path, f, { contentType: f.type || "application/octet-stream", upsert: false });
          if (!error) {
            const { data: signed } = await (supabase as any).storage
              .from("dc-attachments")
              .createSignedUrl(path, 31536000); // 1 year
            if (signed?.signedUrl) {
              // Patch the attachment state entry with the URL
              setAttachments((prev) =>
                prev.map((a) =>
                  a.name === f.name && a.size === f.size && !a.url
                    ? { ...a, url: signed.signedUrl }
                    : a
                )
              );
            }
          }
        } catch {
          // Upload failed — attachment still works for SMTP sending via base64
        }
      };
      reader.readAsDataURL(f);
    });
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const editorHasContent = !!(editorRef.current?.innerText.trim() || body.trim());
  const hasAnyContent   = !!(subject.trim() || editorHasContent);
  const canSend = !!(toEmail || contact?.email) && editorHasContent;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-full max-w-[560px] rounded-2xl shadow-2xl overflow-hidden border border-border bg-background flex flex-col" style={{ maxHeight: "calc(100vh - 3rem)" }}>
        {/* ─── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 py-3 bg-foreground text-background shrink-0">
          <span className="text-sm font-semibold flex-1">
            {contact ? `New email · ${contact.name}` : "New email"}
          </span>
          {lastSaved && (
            <span className="text-xs text-background/60 bg-background/10 rounded-full px-2.5 py-0.5">
              Auto-saved {Math.floor((nowTick - lastSaved.getTime()) / 1000)}s ago
            </span>
          )}
          <button onClick={onClose} aria-label="Close" className="opacity-60 hover:opacity-100 transition-opacity">
            <RiCloseLine size={16} />
          </button>
        </div>

        {/* ─── Scrollable body ─────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {/* From */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <span className="text-xs text-foreground-muted w-14 shrink-0">From</span>
            <div className="flex items-center gap-2 text-sm">
              <div className="size-6 rounded-full bg-primary flex items-center justify-center text-white text-[10px] font-bold">
                {fromName.slice(0, 2).toUpperCase()}
              </div>
              <span className="font-medium">{fromName} · {fromEmail}</span>
            </div>
          </div>

          {/* To */}
          <div className="flex items-start gap-3 px-4 py-3 border-b border-border">
            <span className="text-xs text-foreground-muted w-14 shrink-0 mt-1.5">To</span>
            <div className="flex-1 min-w-0">
              {contact ? (
                <div className="flex items-center flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary rounded-full px-2.5 py-1 text-xs font-medium">
                    <span className="size-4 rounded-full bg-primary flex items-center justify-center text-white text-[9px] font-bold">
                      {contact.name.slice(0, 1)}
                    </span>
                    {contact.name}
                    <button
                      onClick={() => { setContact(null); setShowContactSearch(true); setToEmail(""); }}
                      className="opacity-60 hover:opacity-100"
                    >
                      <RiCloseLine size={12} />
                    </button>
                  </span>
                  <span className="text-xs text-foreground-muted">{contact.email}</span>
                </div>
              ) : showContactSearch ? (
                <div className="relative">
                  <div className="flex items-center gap-2">
                    <RiSearchLine size={14} className="text-foreground-muted shrink-0" />
                    <input
                      autoFocus
                      value={contactSearch}
                      onChange={(e) => setContactSearch(e.target.value)}
                      placeholder="Search contact..."
                      className="flex-1 text-sm outline-none bg-transparent"
                    />
                    {contactSearch && (
                      <button onClick={() => { setContactSearch(""); setShowContactSearch(false); }}>
                        <RiCloseLine size={14} className="text-foreground-muted" />
                      </button>
                    )}
                  </div>
                  {contactResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-xl shadow-lg z-10 overflow-hidden">
                      {contactResults.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => {
                            setContact(r);
                            setToEmail(r.email ?? "");
                            setContactSearch("");
                            setShowContactSearch(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-background-subtle text-left text-sm"
                        >
                          <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                            {r.name.slice(0, 1)}
                          </div>
                          <span className="font-medium truncate">{r.name}</span>
                          <span className="text-foreground-muted text-xs truncate">{r.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <input
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full text-sm outline-none bg-transparent"
                />
              )}
            </div>
            <button
              onClick={() => setShowCcBcc((v) => !v)}
              className="text-xs text-foreground-muted hover:text-foreground transition-colors shrink-0"
            >
              + Cc · Bcc
            </button>
          </div>

          {/* CC / BCC */}
          {showCcBcc && (
            <>
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border">
                <span className="text-xs text-foreground-muted w-14 shrink-0">Cc</span>
                <input
                  value={ccEmails}
                  onChange={(e) => setCcEmails(e.target.value)}
                  placeholder="cc@example.com, ..."
                  className="flex-1 text-sm outline-none bg-transparent"
                />
              </div>
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border">
                <span className="text-xs text-foreground-muted w-14 shrink-0">Bcc</span>
                <input
                  value={bccEmails}
                  onChange={(e) => setBccEmails(e.target.value)}
                  placeholder="bcc@example.com, ..."
                  className="flex-1 text-sm outline-none bg-transparent"
                />
              </div>
            </>
          )}

          {/* Subject */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <span className="text-xs text-foreground-muted w-14 shrink-0">Subject</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Add a subject..."
              className="flex-1 text-sm outline-none bg-transparent font-medium"
            />
          </div>

          {/* Body area */}
          <div className="px-4 pt-4 pb-2">
            {/* AI generate (only show if not accepted yet) */}
            {!aiAccepted && (
              <div className={hasAnyContent && aiState === "idle" ? "mb-2" : "mb-4"}>
                <AiGenerate
                  state={aiState}
                  tone={aiTone}
                  progress={aiProgress}
                  collapsed={hasAnyContent}
                  contextChips={["Segment: Indie creator", "Country: ID", "Stage: Waiting Result"]}
                  onToneChange={setAiTone}
                  onGenerate={handleGenerate}
                  onRegenerate={handleGenerate}
                  onStop={() => { setAiState("idle"); setAiProgress(0); }}
                  onAccept={handleAcceptAi}
                  onDiscard={() => { setAiState("idle"); setGeneratedBody(""); setSubject(""); if (editorRef.current) editorRef.current.innerHTML = ""; setBody(""); }}
                  onTryAnotherTone={() => setAiState("idle")}
                  generatedLabel={`Generated by AI · ${aiTone.replace("_", " ")} · Warm follow-up`}
                />
              </div>
            )}

            {/* Rich text editor (contentEditable) */}
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={syncBody}
              onClick={handleEditorClick}
              data-placeholder={aiAccepted ? "Type your message…" : "Write your message — or use Generate above…"}
              className={[
                "w-full min-h-[120px] text-sm outline-none bg-transparent leading-relaxed",
                "prose prose-sm max-w-none",
                // Ensure bullet / ordered lists render correctly inside contentEditable
                "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1",
                "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1",
                "[&_li]:my-0 [&_li]:marker:text-foreground",
                // Links — blue + underline so they're clearly clickable
                "[&_a]:text-blue-600 [&_a]:underline [&_a]:cursor-pointer",
                // Placeholder via CSS ::before
                "empty:before:content-[attr(data-placeholder)] empty:before:text-foreground-muted empty:before:pointer-events-none",
              ].join(" ")}
              style={{ wordBreak: "break-word" }}
            />

            {/* Link tooltip — appears when clicking an existing link */}
            {linkTooltip && (
              <>
                {/* Invisible backdrop to close tooltip on outside click */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setLinkTooltip(null)}
                />
                <div
                  className="fixed z-50 flex items-center gap-1.5 px-3 py-2 bg-background border border-border rounded-xl shadow-lg text-sm whitespace-nowrap"
                  style={{
                    top:  linkTooltip.rect.bottom + 6,
                    left: Math.min(linkTooltip.rect.left, window.innerWidth - 360),
                  }}
                >
                  <span className="text-foreground-muted text-xs">Go to link:</span>
                  <a
                    href={linkTooltip.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-xs max-w-[180px] truncate"
                  >
                    {linkTooltip.url.replace(/^https?:\/\//, "")}
                  </a>
                  <span className="text-border mx-1">|</span>
                  <button
                    onClick={handleChangeLink}
                    className="text-blue-600 text-xs font-medium hover:underline"
                  >
                    Change
                  </button>
                  <span className="text-border mx-1">|</span>
                  <button
                    onClick={handleRemoveLink}
                    className="text-blue-600 text-xs font-medium hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </>
            )}

            {/* Attachments */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {attachments.map((att, i) => (
                  <div key={i} className="inline-flex items-center gap-2 rounded-lg border border-border bg-background-subtle px-3 py-1.5 text-xs">
                    <RiAttachmentLine size={12} className="text-foreground-muted shrink-0" />
                    <span className="font-medium truncate max-w-[160px]">{att.name}</span>
                    <span className="text-foreground-muted">{formatSize(att.size)}</span>
                    <button
                      onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-foreground-muted hover:text-foreground"
                    >
                      <RiCloseLine size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── Toolbar + Footer ─────────────────────────────────────── */}
        <div className="shrink-0 border-t border-border">
          {/* Formatting toolbar */}
          <div className="relative flex items-center gap-0.5 px-4 py-2 border-b border-border">

          {/* Link popover — Gmail-style floating card */}
          {showLinkInput && (
            <div ref={linkPopoverRef} className="absolute bottom-full left-4 mb-2 w-72 bg-background border border-border rounded-2xl shadow-xl z-30 overflow-hidden">
              {/* Display text row */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                <span className="text-xs text-foreground-muted w-8 shrink-0">Text</span>
                <input
                  ref={linkTextInputRef}
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { linkUrlInputRef.current?.focus(); e.preventDefault(); }
                    if (e.key === "Escape") closeLinkInput();
                  }}
                  placeholder="Display text"
                  className="flex-1 text-sm outline-none bg-transparent"
                />
              </div>
              {/* URL row */}
              <div className="flex items-center gap-3 px-4 py-3">
                <RiLinkM size={14} className="text-foreground-muted shrink-0" />
                <input
                  ref={linkUrlInputRef}
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") commitLink(); if (e.key === "Escape") closeLinkInput(); }}
                  placeholder="https://..."
                  className="flex-1 text-sm outline-none bg-transparent"
                />
                <button
                  onClick={commitLink}
                  disabled={!linkUrl}
                  className="text-sm font-semibold text-primary hover:opacity-70 transition-opacity disabled:opacity-30"
                >
                  Apply
                </button>
              </div>
            </div>
          )}
            {/* B — Bold */}
            <ToolbarBtn
              active={activeFmt.bold}
              title="Bold (⌘B)"
              onClick={() => execFormat("bold")}
            >
              <RiBold size={15} />
            </ToolbarBtn>

            {/* I — Italic */}
            <ToolbarBtn
              active={activeFmt.italic}
              title="Italic (⌘I)"
              onClick={() => execFormat("italic")}
            >
              <RiItalic size={15} />
            </ToolbarBtn>

            {/* U — Underline */}
            <ToolbarBtn
              active={activeFmt.underline}
              title="Underline (⌘U)"
              onClick={() => execFormat("underline")}
            >
              <RiUnderline size={15} />
            </ToolbarBtn>

            {/* List */}
            <ToolbarBtn
              active={activeFmt.list}
              title="Bullet list"
              onClick={() => execFormat("insertUnorderedList")}
            >
              <RiListUnordered size={15} />
            </ToolbarBtn>

            <span className="mx-1 h-4 w-px bg-border shrink-0" />

            {/* Link */}
            <ToolbarBtn
              active={showLinkInput}
              title="Insert link"
              onClick={() => showLinkInput ? closeLinkInput() : openLinkInput()}
            >
              <RiLinkM size={15} />
            </ToolbarBtn>

            {/* Attach file */}
            <ToolbarBtn title="Attach file" onClick={() => fileInputRef.current?.click()}>
              <RiAttachmentLine size={15} />
            </ToolbarBtn>

            {/* Insert image */}
            <ToolbarBtn title="Insert image" onClick={() => imageInputRef.current?.click()}>
              <RiImageLine size={15} />
            </ToolbarBtn>

            <span className="mx-1 h-4 w-px bg-border shrink-0" />

            {/* Variable picker */}
            <div className="relative">
              <button
                title="Insert variable"
                onMouseDown={(e) => {
                  e.preventDefault(); // keep editor focus
                  saveSelection();    // remember cursor position
                  setShowVariables((v) => !v);
                  setShowLinkInput(false);
                }}
                className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
                  showVariables
                    ? "bg-primary/10 text-primary"
                    : "text-foreground-muted hover:bg-background-subtle hover:text-foreground"
                }`}
              >
                {"{variable}"}
              </button>

              {showVariables && (
                <div className="absolute bottom-full left-0 mb-1 w-52 bg-background border border-border rounded-xl shadow-lg z-20 overflow-hidden">
                  <p className="text-[11px] font-semibold text-foreground-muted uppercase tracking-wide px-3 pt-2.5 pb-1">
                    Insert variable
                  </p>
                  {[
                    { label: "Contact name",    value: "{{contact_name}}" },
                    { label: "Contact email",   value: "{{contact_email}}" },
                    { label: "Contact company", value: "{{contact_company}}" },
                    { label: "Contact country", value: "{{contact_country}}" },
                    { label: "My name",         value: "{{my_name}}" },
                    { label: "My email",        value: "{{my_email}}" },
                    { label: "Today's date",    value: "{{today}}" },
                  ].map(({ label, value }) => (
                    <button
                      key={value}
                      onClick={() => insertVariable(value)}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-background-subtle transition-colors text-left"
                    >
                      <span className="text-foreground">{label}</span>
                      <code className="text-[11px] text-foreground-muted font-mono">{value}</code>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Discard */}
            <div className="ml-auto">
              <button
                title="Discard"
                onClick={handleDiscard}
                className="size-7 rounded-lg flex items-center justify-center text-foreground-muted hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <RiDeleteBinLine size={15} />
              </button>
            </div>
          </div>

          {/* Hidden file inputs */}
          <input ref={fileInputRef}  type="file" multiple className="hidden" onChange={handleFileChange} />
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />

          {/* Schedule picker */}
          {showSchedule && (
            <div className="px-4 py-3 border-b border-border bg-background-subtle space-y-2">
              <div className="flex items-center gap-2">
                <RiTimeLine size={14} className="text-foreground-muted shrink-0" />
                <span className="text-xs font-medium text-foreground-muted">Schedule send</span>
                <button onClick={() => setShowSchedule(false)} className="ml-auto text-foreground-muted hover:text-foreground">
                  <RiCloseLine size={14} />
                </button>
              </div>
              <div className="flex items-center gap-2">
                {/* Date via existing DatePicker component */}
                <div className="flex-1">
                  <DatePicker
                    value={scheduleDate}
                    onChange={setScheduleDate}
                    placeholder="Select date"
                    position="up"
                  />
                </div>
                {/* Time input */}
                <div className="flex items-center gap-1.5 h-10 px-3 rounded-full border border-border bg-white text-sm">
                  <RiTimeLine size={14} className="text-foreground-muted shrink-0" />
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="outline-none bg-transparent text-sm w-[70px]"
                  />
                </div>
              </div>
              <button
                onClick={async () => {
                  if (scheduleDate) {
                    const iso = `${scheduleDate}T${scheduleTime || "09:00"}:00`;
                    onSchedule(await buildPayload(), iso);
                  }
                  setShowSchedule(false);
                }}
                disabled={!scheduleDate}
                className="w-full py-2 text-sm font-semibold text-white bg-primary rounded-full disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                Confirm schedule
              </button>
            </div>
          )}

          {/* Send error banner */}
          {sendError && (
            <div className="mx-4 mb-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400">
              <span className="flex-1">{sendError}</span>
              <button
                onClick={onDismissSendError}
                className="shrink-0 rounded p-0.5 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                aria-label="Dismiss error"
              >
                <RiCloseLine size={14} />
              </button>
            </div>
          )}

          {/* Action footer */}
          <div className="flex items-center gap-2 px-4 py-3">
            <button
              disabled={!canSend || loading}
              onClick={async () => onSend(await buildPayload())}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-semibold bg-primary text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RiSendPlaneLine size={14} />
              {loading ? "Sending…" : "Send"}
            </button>

            <button
              onClick={() => setShowSchedule((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-foreground-muted border border-border rounded-full hover:bg-background-subtle transition-colors"
            >
              <RiTimeLine size={14} />
              Schedule send
            </button>

            <button
              onClick={async () => onSaveDraft(await buildPayload())}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-foreground-muted border border-border rounded-full hover:bg-background-subtle transition-colors"
            >
              Save draft
            </button>
          </div>
        </div>
      </div>
  );
}

// ─── Toolbar button helper ─────────────────────────────────────────────────────
function ToolbarBtn({
  children,
  onClick,
  title,
  active = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        // Prevent editor from losing focus
        e.preventDefault();
        onClick?.();
      }}
      className={`size-7 rounded-lg flex items-center justify-center transition-colors ${
        active
          ? "bg-primary/10 text-primary"
          : "text-foreground-muted hover:bg-background-subtle hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
