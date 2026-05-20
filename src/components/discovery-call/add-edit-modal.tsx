/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import {
  RiCloseLine, RiSearchLine, RiMailLine, RiWhatsappLine, RiLinkedinLine,
  RiInstagramLine, RiLockLine, RiTimeLine, RiInformationLine, RiArrowRightLine,
  RiLinksLine, RiFileTextLine, RiDeleteBinLine, RiUploadCloudLine, RiDownloadLine,
  RiUserLine,
} from "@remixicon/react";
import { NEXT_ACTION_OPTIONS } from "./constants";
import type { DiscoveryCallRow, DiscoveryCallLeadSource, DiscoveryCallSurveyStatus, DiscoveryCallResult, DiscoveryCallStage, ContactRow } from "@/lib/supabase/types";
import { STAGE_MAP, STAGES } from "./constants";
import { createClient } from "@/lib/supabase/browser";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { Select } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { getOpenCallForContact } from "@/lib/queries/discovery-calls";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AttachmentRow {
  id: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_at: string;
}

interface FormState {
  contact: ContactRow | null;
  stage: DiscoveryCallStage;
  lead_source: DiscoveryCallLeadSource | "";
  interview_date: string;
  interview_time: string;
  interview_meeting_url: string;
  interview_document_url: string;
  survey_status: DiscoveryCallSurveyStatus;
  result: DiscoveryCallResult;
  notes: string;
  newAttachments: File[];
  owner_id: string;
}

interface AddEditModalProps {
  mode: "add" | "edit";
  call?: DiscoveryCallRow;
  ownerName: string;
  currentOwnerId?: string;
  isTeamView?: boolean;
  onSave: (form: FormState) => Promise<void>;
  onCancel: () => void;
  onEditExisting?: (call: DiscoveryCallRow) => void;
  loading?: boolean;
  /** Pre-fill and lock the contact field (cannot be changed) */
  initialContact?: ContactRow;
  /** Pre-select and lock the lead source field (cannot be changed) */
  lockedLeadSource?: DiscoveryCallLeadSource;
}

// ─── Workspace members hook ───────────────────────────────────────────────────

interface WorkspaceMember { id: string; name: string }

function useWorkspaceMembers(workspaceId: string, enabled: boolean): WorkspaceMember[] {
  const [members, setMembers] = React.useState<WorkspaceMember[]>([]);

  React.useEffect(() => {
    if (!workspaceId || !enabled) return;
    const supabase = createClient();
    (async () => {
      const { data: memberRows } = await (supabase as any)
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspaceId);
      if (!memberRows?.length) return;
      const ids = memberRows.map((m: any) => m.user_id);
      const { data: profiles } = await (supabase as any)
        .from("profiles")
        .select("id, display_name, email")
        .in("id", ids);
      setMembers(
        (profiles ?? []).map((p: any) => ({
          id: p.id,
          name: p.display_name ?? p.email?.split("@")[0] ?? "?",
        }))
      );
    })();
  }, [workspaceId, enabled]);

  return members;
}

// ─── Contact search ───────────────────────────────────────────────────────────

const TONES = ["bg-violet-400", "bg-sky-400", "bg-amber-400", "bg-emerald-400", "bg-rose-400"];

function ContactAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const ini = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const tone = TONES[name.charCodeAt(0) % TONES.length];
  const sz = size === "sm" ? "size-7 text-[10px]" : "size-9 text-xs";
  return (
    <div className={`${sz} ${tone} shrink-0 rounded-full flex items-center justify-center font-semibold text-white`}>
      {ini}
    </div>
  );
}

function useContactSearch(workspaceId: string) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<ContactRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("contacts")
        .select("id, name, type, email, account_tier, country, company, business_category, segment")
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .ilike("name", `%${query}%`)
        .limit(8);
      setResults((data ?? []) as unknown as ContactRow[]);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, workspaceId]);

  return { query, setQuery, results, loading };
}

// ─── Chip selector ────────────────────────────────────────────────────────────

function ChipGroup<T extends string>({
  value, onChange, options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: React.ReactNode }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
            value === opt.value
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-foreground hover:border-foreground-muted"
          }`}
        >
          {opt.icon && <span>{opt.icon}</span>}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Existing attachments hook ────────────────────────────────────────────────

function useCallAttachments(callId: string | undefined) {
  const [attachments, setAttachments] = React.useState<AttachmentRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!callId) { setAttachments([]); return; }
    setLoading(true);
    const supabase = createClient();
    (supabase as any)
      .from("discovery_call_attachments")
      .select("id, file_name, storage_path, mime_type, size_bytes, uploaded_at")
      .eq("discovery_call_id", callId)
      .order("uploaded_at", { ascending: false })
      .then(({ data }: { data: AttachmentRow[] | null }) => {
        setAttachments(data ?? []);
        setLoading(false);
      });
  }, [callId]);

  return { attachments, setAttachments, loading };
}

// ─── File helpers ─────────────────────────────────────────────────────────────

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const isImage = ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext);
  return isImage ? <RiFileTextLine size={14} className="text-sky-500" /> : <RiFileTextLine size={14} className="text-foreground-muted" />;
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function AddEditModal({ mode, call, ownerName, currentOwnerId, isTeamView, onSave, onCancel, onEditExisting, loading, initialContact, lockedLeadSource }: AddEditModalProps) {
  const { workspaceId } = useWorkspace();
  const existingContact = call?.contact as unknown as ContactRow | undefined;

  const [form, setForm] = React.useState<FormState>({
    contact: initialContact ?? existingContact ?? null,
    stage: call?.stage ?? "replied",
    lead_source: lockedLeadSource ?? call?.lead_source ?? "",
    interview_date: call?.interview_date ?? "",
    interview_time: call?.interview_time?.slice(0, 5) ?? "",
    interview_meeting_url: call?.interview_meeting_url ?? "",
    interview_document_url: (call as any)?.interview_document_url ?? "",
    survey_status: call?.survey_status ?? "not_sent",
    result: call?.result ?? "pending",
    notes: call?.notes ?? "",
    newAttachments: [],
    owner_id: (call as any)?.owner_id ?? currentOwnerId ?? "",
  });

  const wsMembers = useWorkspaceMembers(workspaceId ?? "", !!isTeamView);

  const { attachments: existingAttachments, setAttachments: setExistingAttachments } = useCallAttachments(call?.id);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);

  const [searching, setSearching] = React.useState(mode === "add" && !form.contact && !initialContact);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [existingCall, setExistingCall] = React.useState<DiscoveryCallRow | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = React.useState(false);
  const { query, setQuery, results, loading: searchLoading } = useContactSearch(workspaceId ?? "");

  // Check for existing open call whenever contact changes (add mode only)
  React.useEffect(() => {
    const contactId = form.contact?.id;
    if (mode !== "add" || !contactId || !workspaceId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExistingCall(null);
      return;
    }
    setCheckingDuplicate(true);
    getOpenCallForContact(workspaceId, contactId).then(({ data }) => {
      setExistingCall(data);
      setCheckingDuplicate(false);
    });
  }, [mode, form.contact?.id, workspaceId]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.contact) e.contact = "Contact is required";
    if (!lockedLeadSource && !form.lead_source) e.lead_source = "Lead source is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    set("newAttachments", [...form.newAttachments, ...arr]);
  }

  function removeNewAttachment(index: number) {
    set("newAttachments", form.newAttachments.filter((_, i) => i !== index));
  }

  async function downloadAttachment(att: AttachmentRow) {
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from("dc-attachments")
      .createSignedUrl(att.storage_path, 60);
    if (error || !data?.signedUrl) {
      console.error("Download failed:", error?.message);
      return;
    }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = att.file_name;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function removeExistingAttachment(att: AttachmentRow) {
    const supabase = createClient();
    const { error: dbError } = await (supabase as any)
      .from("discovery_call_attachments")
      .delete()
      .eq("id", att.id);

    if (dbError) {
      console.error("Failed to delete attachment:", dbError.message);
      return; // Don't update UI if DB delete failed
    }

    await supabase.storage.from("dc-attachments").remove([att.storage_path]);
    setExistingAttachments((prev) => prev.filter((a) => a.id !== att.id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    await onSave(form);
  }

  const stageInfo = STAGE_MAP[form.stage];
  const updatedAgo = call
    ? new Date(call.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  const leadSourceOptions: { value: DiscoveryCallLeadSource; label: string; icon: React.ReactNode }[] = [
    { value: "email",     label: "Email",     icon: <RiMailLine size={14} /> },
    { value: "whatsapp",  label: "WhatsApp",  icon: <RiWhatsappLine size={14} /> },
    { value: "linkedin",  label: "LinkedIn",  icon: <RiLinkedinLine size={14} /> },
    { value: "instagram", label: "Instagram", icon: <RiInstagramLine size={14} /> },
  ];

  const surveyOptions: { value: DiscoveryCallSurveyStatus; label: string }[] = [
    { value: "not_sent",     label: "Not sent" },
    { value: "sent_pending", label: "Sent · pending" },
    { value: "completed",    label: "Completed" },
    { value: "skipped",      label: "Skipped" },
  ];

  const resultOptions: { value: DiscoveryCallResult; label: string }[] = [
    { value: "pending",       label: "Pending" },
    { value: "qualified",     label: "Qualified" },
    { value: "nurture",       label: "Nurture" },
    { value: "not_qualified", label: "Not qualified" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-[560px] rounded-2xl bg-background shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
              Outreach Creator · Discovery Call
            </p>
            <h2 className="text-xl font-bold">{mode === "add" ? "Add discovery call" : "Edit discovery call"}</h2>
          </div>
          <button onClick={onCancel} className="rounded-full p-1.5 hover:bg-background-subtle text-foreground-muted transition-colors">
            <RiCloseLine size={20} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Contact */}
          <div>
            <label className="block text-sm font-semibold mb-2">Contact *</label>
            {form.contact && !searching ? (
              <div className={`flex items-center gap-3 p-3 rounded-xl border ${errors.contact ? "border-red-400" : "border-primary bg-primary/5"}`}>
                <ContactAvatar name={form.contact.name} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{form.contact.name}</p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      form.contact.type === "twibbonize" ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-700"
                    }`}>
                      {form.contact.type === "twibbonize" ? "Twibbonize" : "External"}
                    </span>
                    {form.contact.account_tier && (
                      <span className="text-[10px] text-foreground-muted">{form.contact.account_tier === "premium_creator" ? "Premium Creator" : form.contact.account_tier === "premium_supporter" ? "Premium Supporter" : "Free"}</span>
                    )}
                  </div>
                  <p className="text-xs text-foreground-muted">
                    {[form.contact.email, form.contact.country].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {!initialContact && (
                  <button
                    type="button"
                    onClick={() => setSearching(true)}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Change
                  </button>
                )}
              </div>
            ) : (
              <div className="relative">
                <div className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 ${errors.contact ? "border-red-400" : "border-primary ring-[3px] ring-primary/10"}`}>
                  <RiSearchLine size={16} className="text-foreground-muted shrink-0" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search contacts by name…"
                    className="flex-1 text-sm bg-transparent outline-none"
                  />
                  {query && (
                    <button type="button" onClick={() => setQuery("")} className="text-foreground-muted hover:text-foreground">
                      <RiCloseLine size={14} />
                    </button>
                  )}
                </div>
                {(results.length > 0 || searchLoading) && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-10 rounded-xl border border-border bg-background shadow-lg overflow-hidden">
                    {searchLoading ? (
                      <p className="px-4 py-3 text-sm text-foreground-muted">Searching…</p>
                    ) : (
                      <ul>
                        {results.map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              onClick={() => { set("contact", c); setSearching(false); setQuery(""); }}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-background-subtle transition-colors text-left"
                            >
                              <ContactAvatar name={c.name} size="sm" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-sm font-semibold">{c.name}</p>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${c.type === "twibbonize" ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-700"}`}>
                                    {c.type === "twibbonize" ? "Twibbonize" : "External"}
                                  </span>
                                </div>
                                <p className="text-xs text-foreground-muted truncate">
                                  {[(c as unknown as Record<string, string>).segment, c.country, c.email].filter(Boolean).join(" · ")}
                                </p>
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
            {errors.contact && <p className="mt-1 text-xs text-red-500">{errors.contact}</p>}
          </div>

          {/* Duplicate call warning */}
          {mode === "add" && !checkingDuplicate && existingCall && (() => {
            const existingStage = STAGE_MAP[existingCall.stage];
            const dateStr = existingCall.interview_date
              ? new Date(existingCall.interview_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : null;
            return (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="flex items-start gap-3">
                  <RiInformationLine size={18} className="text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-amber-800">
                      This contact already has an active discovery call
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Currently in{" "}
                      <span className="font-semibold">{existingStage?.label ?? existingCall.stage}</span>
                      {dateStr && <> · Interview on <span className="font-semibold">{dateStr}</span></>}
                      . Please move or finish the existing card before creating a new one.
                    </p>
                  </div>
                </div>
                {onEditExisting && (
                  <button
                    type="button"
                    onClick={() => onEditExisting(existingCall)}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-100 hover:bg-amber-200 transition-colors px-3 py-2 text-xs font-semibold text-amber-800"
                  >
                    <RiArrowRightLine size={13} />
                    Open & edit existing card
                  </button>
                )}
              </div>
            );
          })()}

          {/* Stage + Owner (side by side) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Stage *</label>
              <Select
                value={form.stage}
                onChange={(v) => set("stage", v as DiscoveryCallStage)}
                options={STAGES.map((s) => ({ value: s.key, label: s.label }))}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Owner</label>
              {isTeamView && mode === "edit" ? (
                <>
                  <Select
                    value={form.owner_id}
                    onChange={(v) => set("owner_id", v)}
                    options={wsMembers.map((m) => ({ value: m.id, label: m.name }))}
                  />
                  <p className="mt-1 text-[11px] text-foreground-muted flex items-center gap-1">
                    <RiUserLine size={11} /> Team view · reassign allowed
                  </p>
                </>
              ) : (
                <>
                  <div className="h-10 w-full rounded-full border border-border/60 bg-background-subtle px-4 flex items-center gap-2 text-sm text-foreground-muted">
                    <RiLockLine size={14} />
                    <span>{ownerName} (you)</span>
                  </div>
                  <p className="mt-1 text-[11px] text-foreground-muted">Set automatically.</p>
                </>
              )}
            </div>
          </div>

          {/* Interview date + Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Interview date</label>
              <DatePicker
                value={form.interview_date}
                onChange={(v) => set("interview_date", v)}
                placeholder="Pick a date"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Time</label>
              <div className="relative">
                <RiTimeLine size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none" />
                <input
                  type="time"
                  value={form.interview_time}
                  onChange={(e) => set("interview_time", e.target.value)}
                  className="h-10 w-full rounded-full border border-border bg-background pl-10 pr-4 text-sm font-medium outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/10 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Lead source */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Lead source *
              {lockedLeadSource && (
                <span className="ml-2 text-[11px] font-normal text-foreground-muted inline-flex items-center gap-1">
                  <RiLockLine size={11} /> Auto-set from email
                </span>
              )}
            </label>
            {lockedLeadSource ? (
              <div className="flex flex-wrap gap-2">
                {leadSourceOptions.map((opt) => (
                  <div
                    key={opt.value}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${
                      opt.value === lockedLeadSource
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-foreground-muted opacity-30"
                    }`}
                  >
                    {opt.icon && <span>{opt.icon}</span>}
                    {opt.label}
                  </div>
                ))}
              </div>
            ) : (
              <ChipGroup
                value={form.lead_source as DiscoveryCallLeadSource}
                onChange={(v) => set("lead_source", v)}
                options={leadSourceOptions}
              />
            )}
            {errors.lead_source && <p className="mt-1 text-xs text-red-500">{errors.lead_source}</p>}
          </div>

          {/* Survey */}
          <div>
            <label className="block text-sm font-semibold mb-2">Survey</label>
            <ChipGroup
              value={form.survey_status}
              onChange={(v) => set("survey_status", v)}
              options={surveyOptions}
            />
          </div>

          {/* Result */}
          <div>
            <label className="block text-sm font-semibold mb-2">Result</label>
            <ChipGroup
              value={form.result}
              onChange={(v) => set("result", v)}
              options={resultOptions}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold mb-2">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              placeholder="Add context, talking points, or reschedule reasons..."
              className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/10 transition-colors resize-none"
            />
          </div>

          {/* Two URL fields side by side */}
          <div className="grid grid-cols-1 gap-4">
            {/* Meeting URL */}
            <div>
              <label className="block text-sm font-semibold mb-1">Meeting URL</label>
              <p className="text-xs text-foreground-muted mb-2">Zoom, Google Meet, or any video call link.</p>
              <div className={`flex items-center gap-2 rounded-full border px-4 h-10 transition-colors ${
                form.interview_meeting_url ? "border-primary/40 bg-primary/5" : "border-border bg-background"
              } focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/10`}>
                <RiLinksLine size={15} className="text-foreground-muted shrink-0" />
                <input
                  type="url"
                  value={form.interview_meeting_url}
                  onChange={(e) => set("interview_meeting_url", e.target.value)}
                  placeholder="https://meet.google.com/…"
                  className="flex-1 text-sm bg-transparent outline-none"
                />
                {form.interview_meeting_url && (
                  <button type="button" onClick={() => set("interview_meeting_url", "")} className="text-foreground-muted hover:text-foreground transition-colors">
                    <RiCloseLine size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Interview document */}
            <div>
              <label className="block text-sm font-semibold mb-1">Interview document</label>
              <p className="text-xs text-foreground-muted mb-2">Google Docs, Notion, or any brief / script URL.</p>
              <div className={`flex items-center gap-2 rounded-full border px-4 h-10 transition-colors ${
                form.interview_document_url ? "border-primary/40 bg-primary/5" : "border-border bg-background"
              } focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/10`}>
                <RiLinksLine size={15} className="text-foreground-muted shrink-0" />
                <input
                  type="url"
                  value={form.interview_document_url}
                  onChange={(e) => set("interview_document_url", e.target.value)}
                  placeholder="https://docs.google.com/…"
                  className="flex-1 text-sm bg-transparent outline-none"
                />
                {form.interview_document_url && (
                  <button type="button" onClick={() => set("interview_document_url", "")} className="text-foreground-muted hover:text-foreground transition-colors">
                    <RiCloseLine size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Next action — read-only when editing a finished card */}
          {mode === "edit" && form.stage === "finished" && (call as any)?.next_action && (
            <div>
              <label className="block text-sm font-semibold mb-1">Next action</label>
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-background-subtle">
                <span className="text-sm font-medium text-foreground">
                  {NEXT_ACTION_OPTIONS.find((o) => o.value === (call as any).next_action)?.label ?? (call as any).next_action}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-foreground-muted">Set when the call was finished. Re-open the card to change it.</p>
            </div>
          )}

          {/* Attachments — only for Scheduled & Finished */}
          {(form.stage === "scheduled" || form.stage === "waiting_result" || form.stage === "finished") && <>

          {/* Attachments */}
          <div>
            <label className="block text-sm font-semibold mb-1">Attachments</label>
            <p className="text-xs text-foreground-muted mb-2">Upload files related to this call — brief, recording, notes, etc. Multiple supported.</p>

            {/* Existing attachments (edit mode) */}
            {existingAttachments.length > 0 && (
              <div className="mb-2 flex flex-col gap-1.5">
                {existingAttachments.map((att) => (
                  <div key={att.id} className="flex items-center gap-2.5 rounded-xl border border-border bg-background-subtle px-3 py-2">
                    {fileIcon(att.file_name)}
                    <span className="flex-1 min-w-0 text-sm font-medium truncate">{att.file_name}</span>
                    {att.size_bytes && (
                      <span className="text-xs text-foreground-muted shrink-0">{formatBytes(att.size_bytes)}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => downloadAttachment(att)}
                      className="shrink-0 text-foreground-muted hover:text-primary transition-colors"
                      title="Download"
                    >
                      <RiDownloadLine size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeExistingAttachment(att)}
                      className="shrink-0 text-foreground-muted hover:text-destructive transition-colors"
                      title="Remove"
                    >
                      <RiDeleteBinLine size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* New files selected */}
            {form.newAttachments.length > 0 && (
              <div className="mb-2 flex flex-col gap-1.5">
                {form.newAttachments.map((file, i) => (
                  <div key={i} className="flex items-center gap-2.5 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
                    {fileIcon(file.name)}
                    <span className="flex-1 min-w-0 text-sm font-medium truncate">{file.name}</span>
                    <span className="text-xs text-foreground-muted shrink-0">{formatBytes(file.size)}</span>
                    <button
                      type="button"
                      onClick={() => removeNewAttachment(i)}
                      className="shrink-0 text-foreground-muted hover:text-destructive transition-colors"
                      title="Remove"
                    >
                      <RiCloseLine size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-5 cursor-pointer transition-all ${
                dragOver
                  ? "border-primary bg-primary/5 scale-[1.01]"
                  : "border-border hover:border-primary/40 hover:bg-background-subtle"
              }`}
            >
              <RiUploadCloudLine size={22} className={dragOver ? "text-primary" : "text-foreground-muted"} />
              <p className="text-sm font-medium text-foreground-muted">
                {dragOver ? "Drop to add files" : "Click or drag & drop files"}
              </p>
              <p className="text-xs text-foreground-muted/70">PDF, DOCX, images, etc.</p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => { if (e.target.files) { addFiles(e.target.files); e.target.value = ""; } }}
            />
          </div>

          </>} {/* end scheduled/finished gate */}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0">
          <p className="text-xs text-foreground-muted">
            {mode === "add"
              ? existingCall
                ? "Finish the active call first"
                : form.contact
                ? `Card will appear in ${stageInfo?.label}`
                : "Select a contact to continue"
              : updatedAgo
              ? `Last updated ${updatedAgo}`
              : ""}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium rounded-full border border-border hover:bg-background-subtle transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !form.contact || (!lockedLeadSource && !form.lead_source) || !!existingCall || checkingDuplicate}
              onClick={handleSubmit}
              className="px-5 py-2 text-sm font-semibold rounded-full bg-primary text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading
                ? mode === "add" ? "Adding…" : "Saving…"
                : mode === "add" ? "Add to pipeline" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export type { FormState as DiscoveryCallFormState };
