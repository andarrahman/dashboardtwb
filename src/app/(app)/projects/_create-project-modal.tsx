"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { RiCloseLine, RiArrowDownSLine, RiArrowUpSLine, RiCheckLine } from "@remixicon/react";
import { Select } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { DatePicker } from "@/components/ui/date-picker";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/browser";
import type { ProjectRow, ProjectStatus } from "@/lib/supabase/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeQuarter(dueDateStr: string): string {
  const d = new Date(dueDateStr);
  const q = Math.ceil((d.getMonth() + 1) / 3);
  return `Q${q} ${d.getFullYear()}`;
}

// ── Workspace members hook ────────────────────────────────────────────────────

interface WorkspaceMember { id: string; name: string }

function useWorkspaceMembers(workspaceId: string | null): { members: WorkspaceMember[]; loading: boolean } {
  const [members, setMembers] = React.useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!workspaceId) return;
    setLoading(true);
    const supabase = createClient();
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: memberRows } = await (supabase as any)
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspaceId);
      if (!memberRows?.length) { setLoading(false); return; }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ids = memberRows.map((m: any) => m.user_id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profiles } = await (supabase as any)
        .from("profiles")
        .select("id, display_name, email")
        .in("id", ids);
      setMembers(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (profiles ?? []).map((p: any) => ({
          id: p.id,
          name: p.display_name ?? p.email?.split("@")[0] ?? "?",
        }))
      );
      setLoading(false);
    })();
  }, [workspaceId]);

  return { members, loading };
}

// ── Member avatar ─────────────────────────────────────────────────────────────

const AVATAR_TONES = ["bg-violet-400", "bg-sky-400", "bg-amber-400", "bg-emerald-400", "bg-rose-400", "bg-fuchsia-400"];

function MemberAvatar({ name, size = "sm" }: { name: string; size?: "sm" | "xs" }) {
  const ini = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const tone = AVATAR_TONES[name.charCodeAt(0) % AVATAR_TONES.length];
  const sz = size === "xs" ? "size-5 text-[9px]" : "size-7 text-[10px]";
  return (
    <div className={`${sz} ${tone} shrink-0 rounded-full flex items-center justify-center font-semibold text-white`}>
      {ini}
    </div>
  );
}

// ── Owner picker ──────────────────────────────────────────────────────────────

function OwnerPicker({
  members,
  loading,
  value,
  onChange,
}: {
  members: WorkspaceMember[];
  loading: boolean;
  value: WorkspaceMember | null;
  onChange: (m: WorkspaceMember | null) => void;
}) {
  const [open, setOpen] = React.useState(false);

  const triggerClass = [
    "h-10 w-full inline-flex items-center justify-between gap-3 rounded-full border px-[18px] text-sm outline-none transition-colors",
    open
      ? "border-primary ring-[3px] ring-primary/10 bg-white"
      : "border-border bg-white hover:border-foreground-muted/50",
    "cursor-pointer",
  ].join(" ");

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className={triggerClass}>
          <span className="flex items-center gap-2.5 min-w-0">
            {value ? (
              <>
                <MemberAvatar name={value.name} size="xs" />
                <span className="truncate font-semibold" style={{ color: "#1B1B1B" }}>
                  {value.name}
                </span>
              </>
            ) : (
              <>
                <span className="shrink-0" style={{ width: 4, height: 16, borderRadius: 9999, backgroundColor: "#DEE8E8" }} />
                <span style={{ color: "#8D8D8D", fontWeight: 500 }}>
                  {loading ? "Loading members…" : "Select owner…"}
                </span>
              </>
            )}
          </span>
          {open
            ? <RiArrowUpSLine size={14} className="text-foreground-muted shrink-0" />
            : <RiArrowDownSLine size={14} className="text-foreground-muted shrink-0" />
          }
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          sideOffset={4}
          align="start"
          avoidCollisions
          onOpenAutoFocus={(e) => e.preventDefault()}
          style={{
            width: "var(--radix-popover-trigger-width)",
            borderRadius: 10,
            boxShadow: "0px 8px 24px rgba(93,100,99,0.14)",
            border: "1px solid #DEE8E8",
            backgroundColor: "#FFFFFF",
            zIndex: 99999,
            outline: "none",
          }}
        >
          <div style={{ padding: 6, maxHeight: 240, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
            {/* Clear option */}
            {value && (
              <button
                type="button"
                onClick={() => { onChange(null); setOpen(false); }}
                className="w-full flex items-center gap-2.5 text-left transition-colors"
                style={{ borderRadius: 8, padding: "8px 12px" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F5FAFA")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "")}
              >
                <span className="shrink-0" style={{ width: 4, height: 16, borderRadius: 9999, backgroundColor: "#DEE8E8" }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: "#8D8D8D" }}>No owner</span>
              </button>
            )}

            {loading ? (
              <p style={{ padding: "10px 12px", fontSize: 13, color: "#8D8D8D" }}>Loading…</p>
            ) : members.length === 0 ? (
              <p style={{ padding: "10px 12px", fontSize: 13, color: "#8D8D8D" }}>No members found.</p>
            ) : (
              members.map((m) => {
                const isSelected = value?.id === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { onChange(m); setOpen(false); }}
                    className="w-full flex items-center justify-between gap-2.5 text-left transition-colors"
                    style={{
                      borderRadius: 8,
                      padding: "8px 12px",
                      backgroundColor: isSelected ? "#EDF8F8" : undefined,
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = "#F5FAFA";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = "";
                    }}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <MemberAvatar name={m.name} size="xs" />
                      <span style={{ fontSize: 13, fontWeight: isSelected ? 600 : 500, color: "#1B1B1B" }} className="truncate">
                        {m.name}
                      </span>
                    </span>
                    <RiCheckLine
                      size={14}
                      style={{ color: "#16DAC1", flexShrink: 0, opacity: isSelected ? 1 : 0, transition: "opacity 0.12s" }}
                    />
                  </button>
                );
              })
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ── Assignees picker (multi) ──────────────────────────────────────────────────

function AssigneesPicker({
  members,
  loading,
  value,
  onChange,
}: {
  members: WorkspaceMember[];
  loading: boolean;
  value: WorkspaceMember[];
  onChange: (m: WorkspaceMember[]) => void;
}) {
  const [open, setOpen] = React.useState(false);

  const triggerClass = [
    "h-10 w-full inline-flex items-center justify-between gap-3 rounded-full border px-[18px] text-sm outline-none transition-colors",
    open ? "border-primary ring-[3px] ring-primary/10 bg-white" : "border-border bg-white hover:border-foreground-muted/50",
    "cursor-pointer",
  ].join(" ");

  function toggle(m: WorkspaceMember) {
    if (value.find((v) => v.id === m.id)) {
      onChange(value.filter((v) => v.id !== m.id));
    } else {
      onChange([...value, m]);
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className={triggerClass}>
          <span className="flex items-center gap-2 min-w-0 flex-1">
            {value.length === 0 ? (
              <>
                <span className="shrink-0" style={{ width: 4, height: 16, borderRadius: 9999, backgroundColor: "#DEE8E8" }} />
                <span style={{ color: "#8D8D8D", fontWeight: 500 }}>
                  {loading ? "Loading members…" : "Select assignees…"}
                </span>
              </>
            ) : (
              <>
                {/* Avatar stack */}
                <span className="flex items-center">
                  {value.slice(0, 4).map((m, i) => (
                    <span key={m.id} style={{ marginLeft: i > 0 ? -6 : 0, zIndex: value.length - i }} className="shrink-0">
                      <MemberAvatar name={m.name} size="xs" />
                    </span>
                  ))}
                </span>
                <span className="truncate font-semibold text-sm" style={{ color: "#1B1B1B" }}>
                  {value.length === 1 ? value[0].name : `${value.length} assignees`}
                </span>
              </>
            )}
          </span>
          {open ? <RiArrowUpSLine size={14} className="text-foreground-muted shrink-0" /> : <RiArrowDownSLine size={14} className="text-foreground-muted shrink-0" />}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={4} align="start" avoidCollisions
          onOpenAutoFocus={(e) => e.preventDefault()}
          style={{ width: "var(--radix-popover-trigger-width)", borderRadius: 10, boxShadow: "0px 8px 24px rgba(93,100,99,0.14)", border: "1px solid #DEE8E8", backgroundColor: "#FFFFFF", zIndex: 99999, outline: "none" }}
        >
          <div style={{ padding: 6, maxHeight: 240, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
            {loading ? (
              <p style={{ padding: "10px 12px", fontSize: 13, color: "#8D8D8D" }}>Loading…</p>
            ) : members.length === 0 ? (
              <p style={{ padding: "10px 12px", fontSize: 13, color: "#8D8D8D" }}>No members found.</p>
            ) : members.map((m) => {
              const isSelected = !!value.find((v) => v.id === m.id);
              return (
                <button key={m.id} type="button" onClick={() => toggle(m)}
                  className="w-full flex items-center justify-between gap-2.5 text-left transition-colors"
                  style={{ borderRadius: 8, padding: "8px 12px", backgroundColor: isSelected ? "#EDF8F8" : undefined }}
                  onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = "#F5FAFA"; }}
                  onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = ""; }}>
                  <span className="flex items-center gap-2.5 min-w-0">
                    <MemberAvatar name={m.name} size="xs" />
                    <span style={{ fontSize: 13, fontWeight: isSelected ? 600 : 500, color: "#1B1B1B" }} className="truncate">{m.name}</span>
                  </span>
                  <RiCheckLine size={14} style={{ color: "#16DAC1", flexShrink: 0, opacity: isSelected ? 1 : 0, transition: "opacity 0.12s" }} />
                </button>
              );
            })}
          </div>
          {value.length > 0 && (
            <div style={{ padding: "8px 12px", borderTop: "1px solid #F0F7F7" }}>
              <button type="button" onClick={() => onChange([])}
                className="text-xs font-medium text-foreground-muted hover:text-red-500 transition-colors">
                Clear all ({value.length})
              </button>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ── Options ───────────────────────────────────────────────────────────────────

const DEPARTMENT_OPTIONS = [
  "Product", "Engineering", "Marketing", "Growth", "COO", "Finance", "CX",
].map((d) => ({ value: d, label: d }));

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "backlog",     label: "Backlog"     },
  { value: "in_progress", label: "In Progress" },
  { value: "review",      label: "Review"      },
  { value: "done",        label: "Done"        },
];

const SPRINT_OPTIONS = [
  "Sprint 1", "Sprint 2", "Sprint 3", "Sprint 4",
  "Sprint 5", "Sprint 6", "Sprint 7", "Sprint 8",
].map((s) => ({ value: s, label: s }));

// ── Status chips ──────────────────────────────────────────────────────────────

const STATUS_CHIP_STYLES: Record<ProjectStatus, { active: string; dot: string }> = {
  backlog:     { active: "border-slate-400 bg-slate-50 text-slate-700",  dot: "bg-slate-400" },
  in_progress: { active: "border-teal-400 bg-teal-50 text-teal-700",    dot: "bg-teal-400"  },
  review:      { active: "border-amber-400 bg-amber-50 text-amber-700", dot: "bg-amber-400" },
  done:        { active: "border-green-400 bg-green-50 text-green-700", dot: "bg-green-400" },
  archived:    { active: "border-slate-300 bg-slate-50 text-slate-500", dot: "bg-slate-300" },
};

function StatusChips({ value, onChange }: { value: ProjectStatus; onChange: (v: ProjectStatus) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {STATUS_OPTIONS.map((opt) => {
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

// ── Props ─────────────────────────────────────────────────────────────────────

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (project: ProjectRow) => void;
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export function CreateProjectModal({ open, onClose, onCreated }: CreateProjectModalProps) {
  const { workspaceId } = useWorkspace();
  const { showToast } = useToast();
  const { members, loading: membersLoading } = useWorkspaceMembers(workspaceId ?? null);

  const [title, setTitle]           = React.useState("");
  const [department, setDepartment] = React.useState("");
  const [owner, setOwner]           = React.useState<WorkspaceMember | null>(null);
  const [assignees, setAssignees]   = React.useState<WorkspaceMember[]>([]);
  const [status, setStatus]         = React.useState<ProjectStatus>("backlog");
  const [sprints, setSprints]       = React.useState<string[]>([]);
  const [startDate, setStartDate]   = React.useState("");
  const [dueDate, setDueDate]       = React.useState("");
  const [saving, setSaving]         = React.useState(false);
  const [titleError, setTitleError] = React.useState(false);

  // Reset when opened
  React.useEffect(() => {
    if (open) {
      setTitle(""); setDepartment(""); setOwner(null); setAssignees([]);
      setStatus("backlog"); setSprints([]); setStartDate(""); setDueDate("");
      setTitleError(false);
    }
  }, [open]);

  const quarter = dueDate ? computeQuarter(dueDate) : "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId) return;
    if (!title.trim()) { setTitleError(true); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          title: title.trim(),
          department: department || null,
          owner_id:    owner?.id   ?? null,
          owner_name:  owner?.name ?? null,
          assignee_ids: assignees.map((a) => a.id),
          assignees:    assignees.map((a) => ({ id: a.id, name: a.name, avatar_url: null })),
          status,
          sprint: sprints.length > 0 ? sprints.join(", ") : null,
          start_date: startDate || null,
          due_date:   dueDate   || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error ?? "Failed to create project");
      }
      const json = await res.json();
      showToast({ title: "Project created" });
      onCreated(json.project);
    } catch (err) {
      showToast({ title: "Error", subtitle: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-[560px] rounded-2xl bg-background shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
              Project Management
            </p>
            <h2 className="text-xl font-bold">Create project</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-background-subtle text-foreground-muted transition-colors"
          >
            <RiCloseLine size={20} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Project title */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Project title <span className="text-red-400">*</span>
            </label>
            <input
              autoFocus
              value={title}
              onChange={(e) => { setTitle(e.target.value); setTitleError(false); }}
              placeholder="Enter project title…"
              className={`h-10 w-full rounded-full border px-4 text-sm font-medium bg-background outline-none transition-colors ${
                titleError
                  ? "border-red-400 ring-[3px] ring-red-400/10"
                  : "border-border focus:border-primary focus:ring-[3px] focus:ring-primary/10"
              }`}
            />
            {titleError && (
              <p className="mt-1 text-xs text-red-500">Project title is required.</p>
            )}
          </div>

          {/* Department */}
          <div>
            <label className="block text-sm font-semibold mb-2">Department</label>
            <Select
              value={department}
              onChange={setDepartment}
              options={DEPARTMENT_OPTIONS}
              placeholder="Select department…"
            />
          </div>

          {/* Owner */}
          <div>
            <label className="block text-sm font-semibold mb-2">Owner</label>
            <OwnerPicker
              members={members}
              loading={membersLoading}
              value={owner}
              onChange={setOwner}
            />
          </div>

          {/* Assignees */}
          <div>
            <label className="block text-sm font-semibold mb-2">Assignees</label>
            <AssigneesPicker members={members} loading={membersLoading} value={assignees} onChange={setAssignees} />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-semibold mb-2">Status</label>
            <StatusChips value={status} onChange={setStatus} />
          </div>

          {/* Sprint — multi-select dropdown */}
          <div>
            <label className="block text-sm font-semibold mb-2">Sprint</label>
            <MultiSelect
              values={sprints}
              onChange={setSprints}
              options={SPRINT_OPTIONS}
              placeholder="Select sprint(s)…"
              position="up"
            />
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

          {/* Quarter auto-computed */}
          {quarter && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-background-subtle px-4 py-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">Quarter</span>
              <span className="text-sm font-bold text-primary ml-auto">{quarter}</span>
              <span className="text-[11px] text-foreground-muted">Auto-computed from due date</span>
            </div>
          )}

        </form>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0">
          <p className="text-xs text-foreground-muted">
            {title.trim()
              ? `Will be created as ${status.replace("_", " ")}`
              : "Fill in the project title to continue"}
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
              onClick={handleSubmit}
              className="px-5 py-2 text-sm font-semibold rounded-full bg-primary text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Creating…" : "Create project"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
