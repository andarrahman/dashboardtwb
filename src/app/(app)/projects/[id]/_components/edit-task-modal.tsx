"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { RiCloseLine, RiArrowDownSLine, RiArrowUpSLine, RiCheckLine } from "@remixicon/react";
import { DatePicker } from "@/components/ui/date-picker";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/browser";
import type { ProjectTaskRow, ProjectTaskStatus, TaskComment } from "@/lib/supabase/types";

// ── Priority ──────────────────────────────────────────────────────────────────

type TaskPriority = "low" | "medium" | "high" | "urgent";

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bg: string; icon: string }> = {
  low:    { label: "Low",    color: "#64748B", bg: "#F1F5F9", icon: "↓" },
  medium: { label: "Medium", color: "#F59E0B", bg: "#FFFBEB", icon: "→" },
  high:   { label: "High",   color: "#F97316", bg: "#FFF7ED", icon: "↑" },
  urgent: { label: "Urgent", color: "#EF4444", bg: "#FEF2F2", icon: "⚡" },
};

// ── Workspace members ─────────────────────────────────────────────────────────

interface WorkspaceMember { id: string; name: string }

const AVATAR_TONES = ["bg-violet-400","bg-sky-400","bg-amber-400","bg-emerald-400","bg-rose-400","bg-fuchsia-400"];

function MemberAvatar({ name }: { name: string }) {
  const ini = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const tone = AVATAR_TONES[name.charCodeAt(0) % AVATAR_TONES.length];
  return (
    <div className={`size-5 ${tone} shrink-0 rounded-full flex items-center justify-center font-semibold text-white text-[9px]`}>
      {ini}
    </div>
  );
}

function useWorkspaceMembers(workspaceId: string | null) {
  const [members, setMembers] = React.useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = React.useState(false);
  React.useEffect(() => {
    if (!workspaceId) return;
    setLoading(true);
    const supabase = createClient();
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rows } = await (supabase as any).from("workspace_members").select("user_id").eq("workspace_id", workspaceId);
      if (!rows?.length) { setLoading(false); return; }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profiles } = await (supabase as any).from("profiles").select("id, display_name, email").in("id", rows.map((r: any) => r.user_id));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setMembers((profiles ?? []).map((p: any) => ({ id: p.id, name: p.display_name ?? p.email?.split("@")[0] ?? "?" })));
      setLoading(false);
    })();
  }, [workspaceId]);
  return { members, loading };
}

function AssigneePicker({ members, loading, value, onChange }: {
  members: WorkspaceMember[]; loading: boolean;
  value: WorkspaceMember | null; onChange: (m: WorkspaceMember | null) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const triggerClass = [
    "h-10 w-full inline-flex items-center justify-between gap-3 rounded-full border px-[18px] text-sm outline-none transition-colors",
    open ? "border-primary ring-[3px] ring-primary/10 bg-white" : "border-border bg-white hover:border-foreground-muted/50",
    "cursor-pointer",
  ].join(" ");

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className={triggerClass}>
          <span className="flex items-center gap-2.5 min-w-0">
            {value ? (
              <><MemberAvatar name={value.name} /><span className="truncate font-semibold" style={{ color: "#1B1B1B" }}>{value.name}</span></>
            ) : (
              <><span className="shrink-0" style={{ width: 4, height: 16, borderRadius: 9999, backgroundColor: "#DEE8E8" }} /><span style={{ color: "#8D8D8D", fontWeight: 500 }}>{loading ? "Loading members…" : "Select assignee…"}</span></>
            )}
          </span>
          {open ? <RiArrowUpSLine size={14} className="text-foreground-muted shrink-0" /> : <RiArrowDownSLine size={14} className="text-foreground-muted shrink-0" />}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={4} align="start" avoidCollisions onOpenAutoFocus={(e) => e.preventDefault()}
          style={{ width: "var(--radix-popover-trigger-width)", borderRadius: 10, boxShadow: "0px 8px 24px rgba(93,100,99,0.14)", border: "1px solid #DEE8E8", backgroundColor: "#FFFFFF", zIndex: 99999, outline: "none" }}>
          <div style={{ padding: 6, maxHeight: 240, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
            {value && (
              <button type="button" onClick={() => { onChange(null); setOpen(false); }}
                className="w-full flex items-center gap-2.5 text-left transition-colors"
                style={{ borderRadius: 8, padding: "8px 12px" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F5FAFA")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "")}>
                <span className="shrink-0" style={{ width: 4, height: 16, borderRadius: 9999, backgroundColor: "#DEE8E8" }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: "#8D8D8D" }}>No assignee</span>
              </button>
            )}
            {loading ? (
              <p style={{ padding: "10px 12px", fontSize: 13, color: "#8D8D8D" }}>Loading…</p>
            ) : members.length === 0 ? (
              <p style={{ padding: "10px 12px", fontSize: 13, color: "#8D8D8D" }}>No members found.</p>
            ) : members.map((m) => {
              const isSelected = value?.id === m.id;
              return (
                <button key={m.id} type="button" onClick={() => { onChange(m); setOpen(false); }}
                  className="w-full flex items-center justify-between gap-2.5 text-left transition-colors"
                  style={{ borderRadius: 8, padding: "8px 12px", backgroundColor: isSelected ? "#EDF8F8" : undefined }}
                  onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = "#F5FAFA"; }}
                  onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = ""; }}>
                  <span className="flex items-center gap-2.5 min-w-0">
                    <MemberAvatar name={m.name} />
                    <span style={{ fontSize: 13, fontWeight: isSelected ? 600 : 500, color: "#1B1B1B" }} className="truncate">{m.name}</span>
                  </span>
                  <RiCheckLine size={14} style={{ color: "#16DAC1", flexShrink: 0, opacity: isSelected ? 1 : 0, transition: "opacity 0.12s" }} />
                </button>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ── Status chips ──────────────────────────────────────────────────────────────

const STATUSES: { value: ProjectTaskStatus; label: string }[] = [
  { value: "backlog",     label: "Backlog"     },
  { value: "planning",   label: "Planning"    },
  { value: "in_progress", label: "In Progress" },
  { value: "review",     label: "Review"      },
  { value: "done",       label: "Done"        },
];

const STATUS_CHIP_STYLES: Record<ProjectTaskStatus, { active: string; dot: string }> = {
  backlog:     { active: "border-slate-400 bg-slate-50 text-slate-700",  dot: "bg-slate-400" },
  planning:    { active: "border-blue-400 bg-blue-50 text-blue-700",     dot: "bg-blue-400"  },
  in_progress: { active: "border-teal-400 bg-teal-50 text-teal-700",    dot: "bg-teal-400"  },
  review:      { active: "border-amber-400 bg-amber-50 text-amber-700", dot: "bg-amber-400" },
  done:        { active: "border-green-400 bg-green-50 text-green-700", dot: "bg-green-400" },
};

function StatusChips({ value, onChange }: { value: ProjectTaskStatus; onChange: (v: ProjectTaskStatus) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {STATUSES.map((opt) => {
        const s = STATUS_CHIP_STYLES[opt.value];
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              isActive ? s.active : "border-border text-foreground hover:border-foreground-muted"
            }`}
          >
            <span className={`size-2 rounded-full ${s.dot} ${!isActive ? "opacity-40" : ""}`} />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderWithMentions(text: string) {
  const parts = text.split(/(@\w+(?:\s\w+)?)/g);
  return parts.map((part, i) =>
    part.startsWith("@")
      ? <span key={i} style={{ color: "#14C4AE", fontWeight: 600 }}>{part}</span>
      : <React.Fragment key={i}>{part}</React.Fragment>
  );
}

function relativeTime(iso: string | null) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface EditTaskModalProps {
  open: boolean;
  task: ProjectTaskRow;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export function EditTaskModal({ open, task, onClose, onSaved, onDeleted }: EditTaskModalProps) {
  const { workspaceId } = useWorkspace();
  const { showToast } = useToast();
  const { members, loading: membersLoading } = useWorkspaceMembers(workspaceId ?? null);

  const [title, setTitle]           = React.useState(task.title);
  const [status, setStatus]         = React.useState<ProjectTaskStatus>(task.status);
  const [assignee, setAssignee]     = React.useState<WorkspaceMember | null>(null);
  const [startDate, setStartDate]   = React.useState(task.start_date ?? "");
  const [dueDate, setDueDate]       = React.useState(task.due_date ?? "");
  const [priority, setPriority]     = React.useState<TaskPriority>((task.priority as TaskPriority) ?? "medium");

  // Comments state
  const [comments, setComments]           = React.useState<TaskComment[]>([]);
  const [commentsLoading, setCommentsLoading] = React.useState(false);
  const [commentBody, setCommentBody]     = React.useState("");
  const [sendingComment, setSendingComment] = React.useState(false);
  const [currentUser, setCurrentUser]     = React.useState<{ id: string; name: string } | null>(null);
  const [mentionQuery, setMentionQuery] = React.useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = React.useState(0);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Pre-populate assignee once members load
  React.useEffect(() => {
    if (!members.length) return;
    const match = members.find((m) => m.id === task.assignee_id)
      ?? members.find((m) => m.name === task.assignee_name);
    if (match) setAssignee(match);
  }, [members, task.assignee_id, task.assignee_name]);
  const [saving, setSaving]         = React.useState(false);
  const [titleError, setTitleError] = React.useState(false);

  // Load current user
  React.useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from("profiles").select("display_name, email").eq("id", data.user.id).single().then(({ data: p }: any) => {
          const rawName = p?.display_name ?? p?.email ?? "You";
          const cleanName = rawName.includes("@") ? rawName.split("@")[0] : rawName;
          setCurrentUser({ id: data.user!.id, name: cleanName });
        });
      }
    });
  }, []);

  // Load comments
  React.useEffect(() => {
    if (!workspaceId || !open) return;
    setCommentsLoading(true);
    fetch(`/api/projects/${task.project_id}/tasks/${task.id}/comments?workspace_id=${workspaceId}`)
      .then(r => r.json())
      .then(d => setComments(d.comments ?? []))
      .catch(() => {})
      .finally(() => setCommentsLoading(false));
  }, [task.id, task.project_id, workspaceId, open]);

  const mentionSuggestions = mentionQuery !== null
    ? members.filter(m => m.name.toLowerCase().includes(mentionQuery)).slice(0, 5)
    : [];

  function handleCommentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setCommentBody(val);
    // Detect @mention
    const cursor = e.target.selectionStart ?? val.length;
    const textBefore = val.slice(0, cursor);
    const match = textBefore.match(/@(\w*)$/);
    if (match) {
      setMentionQuery(match[1].toLowerCase());
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  }

  function insertMention(member: WorkspaceMember) {
    const cursor = textareaRef.current?.selectionStart ?? commentBody.length;
    const textBefore = commentBody.slice(0, cursor);
    const textAfter = commentBody.slice(cursor);
    const replaced = textBefore.replace(/@\w*$/, `@${member.name} `);
    setCommentBody(replaced + textAfter);
    setMentionQuery(null);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId) return;
    if (!title.trim()) { setTitleError(true); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${task.project_id}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          title: title.trim(),
          status,
          priority,
          assignee_id:   assignee?.id   ?? null,
          assignee_name: assignee?.name ?? null,
          start_date: startDate || null,
          due_date: dueDate || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to update task");
      showToast({ title: "Task updated" });
      onSaved();
    } catch (err) {
      showToast({ title: "Error", subtitle: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentBody.trim() || !workspaceId || !currentUser) return;
    setSendingComment(true);
    try {
      const res = await fetch(`/api/projects/${task.project_id}/tasks/${task.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          body: commentBody.trim(),
          author_name: currentUser.name,
          author_id: currentUser.id,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setComments(prev => [...prev, d.comment]);
      setCommentBody("");
    } catch (err) {
      showToast({ title: "Failed to add comment", subtitle: err instanceof Error ? err.message : undefined });
    } finally {
      setSendingComment(false);
    }
  }

  const lastEditedBy = task.updated_by_name || task.created_by_name;
  const lastEditedAt = task.updated_at || task.created_at;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-[540px] rounded-2xl bg-background shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
          <div>
            {lastEditedBy && lastEditedAt ? (
              <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
                Last edited {relativeTime(lastEditedAt)} by {lastEditedBy}
              </p>
            ) : (
              <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
                Task Management
              </p>
            )}
            <h2 className="text-xl font-bold">Edit task</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-background-subtle text-foreground-muted transition-colors"
          >
            <RiCloseLine size={20} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Task title */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Task title <span className="text-red-400">*</span>
            </label>
            <input
              autoFocus
              value={title}
              onChange={(e) => { setTitle(e.target.value); setTitleError(false); }}
              placeholder="Describe the task…"
              className={`h-10 w-full rounded-full border px-4 text-sm font-medium bg-background outline-none transition-colors ${
                titleError
                  ? "border-red-400 ring-[3px] ring-red-400/10"
                  : "border-border focus:border-primary focus:ring-[3px] focus:ring-primary/10"
              }`}
            />
            {titleError && (
              <p className="mt-1 text-xs text-red-500">Task title is required.</p>
            )}
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-semibold mb-2">Status</label>
            <StatusChips value={status} onChange={setStatus} />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-semibold mb-2">Priority</label>
            <div className="flex gap-2 flex-wrap">
              {(["low", "medium", "high", "urgent"] as TaskPriority[]).map((p) => {
                const cfg = PRIORITY_CONFIG[p];
                const isActive = priority === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      paddingBlock: 6, paddingInline: 12,
                      borderRadius: 999, border: isActive ? `1.5px solid ${cfg.color}` : "1.5px solid #E5EAEC",
                      background: isActive ? cfg.bg : "#FFFFFF",
                      cursor: "pointer", fontSize: 12, fontWeight: isActive ? 700 : 500,
                      color: isActive ? cfg.color : "#7A8A93",
                      transition: "all 0.12s",
                    }}
                  >
                    <span style={{ fontSize: 13 }}>{cfg.icon}</span>
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Assignee */}
          <div>
            <label className="block text-sm font-semibold mb-2">Assignee</label>
            <AssigneePicker members={members} loading={membersLoading} value={assignee} onChange={setAssignee} />
          </div>

          {/* Start date + Due date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Start date</label>
              <DatePicker value={startDate} onChange={setStartDate} placeholder="Pick a date" position="up" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Due date</label>
              <DatePicker value={dueDate} onChange={setDueDate} placeholder="Pick a date" position="up" align="end" />
            </div>
          </div>

          {/* Comments */}
          <div>
            <label className="block text-sm font-semibold mb-3">
              Comments
              {comments.length > 0 && (
                <span className="ml-2 text-xs font-bold text-foreground-muted bg-background-subtle px-1.5 py-0.5 rounded-full">{comments.length}</span>
              )}
            </label>

            {/* Comment list */}
            {commentsLoading ? (
              <div className="text-xs text-foreground-muted py-2">Loading comments…</div>
            ) : comments.length === 0 ? (
              <div className="text-xs text-foreground-muted py-1 mb-2">No comments yet. Be the first.</div>
            ) : (
              <div className="space-y-3 mb-3">
                {comments.map(c => {
                  const ini = c.author_name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
                  const timeAgo = (() => {
                    const diff = Date.now() - new Date(c.created_at).getTime();
                    const m = Math.floor(diff / 60000);
                    if (m < 1) return "just now";
                    if (m < 60) return `${m}m ago`;
                    const h = Math.floor(m / 60);
                    if (h < 24) return `${h}h ago`;
                    return `${Math.floor(h / 24)}d ago`;
                  })();
                  return (
                    <div key={c.id} className="flex gap-2.5 items-start">
                      <div className="size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                        {ini}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-foreground">{c.author_name}</span>
                          <span className="text-[10px] text-foreground-muted">{timeAgo}</span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed m-0" style={{ whiteSpace: "pre-wrap" }}>{renderWithMentions(c.body)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add comment input */}
            <div className="flex gap-2 items-start">
              <div className="size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-1">
                {currentUser?.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) ?? "?"}
              </div>
              <div className="flex-1 relative">
                {/* Mention suggestions */}
                {mentionQuery !== null && mentionSuggestions.length > 0 && (
                  <div style={{
                    position: "absolute", bottom: "100%", left: 0, right: 0, marginBottom: 4,
                    background: "#FFFFFF", border: "1px solid #DEE8E8", borderRadius: 10,
                    boxShadow: "0px 8px 24px rgba(93,100,99,0.14)",
                    zIndex: 99999, overflow: "hidden",
                  }}>
                    {mentionSuggestions.map((m, i) => {
                      const ini = m.name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
                      const isActive = i === mentionIndex;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); insertMention(m); }}
                          style={{
                            width: "100%", display: "flex", alignItems: "center", gap: 8,
                            padding: "8px 12px", border: "none", cursor: "pointer",
                            background: isActive ? "#EDF8F8" : "transparent",
                            transition: "background 0.1s",
                            fontFamily: "inherit",
                          }}
                          onMouseEnter={() => setMentionIndex(i)}
                        >
                          <div style={{
                            width: 24, height: 24, borderRadius: "50%", background: "#14C4AE1F",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 9, fontWeight: 700, color: "#14C4AE", flexShrink: 0,
                          }}>{ini}</div>
                          <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 500, color: "#1B1B1B" }}>{m.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <textarea
                  ref={textareaRef}
                  value={commentBody}
                  onChange={handleCommentChange}
                  onKeyDown={e => {
                    if (mentionQuery !== null && mentionSuggestions.length > 0) {
                      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, mentionSuggestions.length - 1)); return; }
                      if (e.key === "ArrowUp") { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); return; }
                      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertMention(mentionSuggestions[mentionIndex]); return; }
                      if (e.key === "Escape") { setMentionQuery(null); return; }
                    }
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleAddComment(e as unknown as React.FormEvent); }
                  }}
                  placeholder="Add a comment… (Ctrl+Enter to send)"
                  rows={2}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none resize-none transition-colors focus:border-primary focus:ring-[3px] focus:ring-primary/10"
                  style={{ fontFamily: "inherit" }}
                />
                {commentBody.trim() && (
                  <button
                    type="button"
                    onClick={handleAddComment}
                    disabled={sendingComment}
                    className="absolute right-2 bottom-2 px-3 py-1 text-xs font-semibold rounded-full bg-primary text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
                  >
                    {sendingComment ? "…" : "Send"}
                  </button>
                )}
              </div>
            </div>
          </div>

        </form>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0">
          <p className="text-xs text-foreground-muted">
            {title.trim() ? `Status: ${status.replace("_", " ")}` : "Fill in the task title to continue"}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium rounded-full border border-border hover:bg-background-subtle transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              form=""
              disabled={saving || !title.trim()}
              onClick={handleSave}
              className="px-5 py-2 text-sm font-semibold rounded-full bg-primary text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
