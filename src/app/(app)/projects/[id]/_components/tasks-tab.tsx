"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { RiAddLine, RiCheckLine, RiArrowRightSLine } from "@remixicon/react";
import type { ProjectTaskRow, ProjectTaskStatus } from "@/lib/supabase/types";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { useToast } from "@/components/ui/toast";
import { AddTaskModal } from "./add-task-modal";
import { EditTaskModal } from "./edit-task-modal";

// ─── Helpers ───────────────────────────────────────────────────────────────────

const manrope = '"Manrope", system-ui, sans-serif';

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function dueDateStatus(iso: string | null, status: string): "overdue" | "today" | "soon" | "upcoming" | "none" {
  if (!iso || status === "done") return "none";
  const due = new Date(iso);
  due.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((due.getTime() - now.getTime()) / 86400000);
  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "today";
  if (diffDays <= 3) return "soon";
  return "none";
}

function DueDateCell({ iso, status }: { iso: string; status: string }) {
  const ds = dueDateStatus(iso, status);
  const date = new Date(iso);
  const dateStr = date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  const CONFIG = {
    overdue: { color: "#EF4444", bg: "#FEF2F2", border: "#FECACA", label: "Overdue" },
    today:   { color: "#F97316", bg: "#FFF7ED", border: "#FED7AA", label: "Today" },
    soon:    { color: "#F59E0B", bg: "#FFFBEB", border: "#FDE68A", label: (() => {
      const diff = Math.floor((new Date(iso).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000);
      return diff === 1 ? "Tomorrow" : `In ${diff}d`;
    })() },
    upcoming: { color: "#7A8A93", bg: "transparent", border: "transparent", label: "" },
    none:     { color: "#7A8A93", bg: "transparent", border: "transparent", label: "" },
  };

  const cfg = CONFIG[ds];

  if (ds === "none" || ds === "upcoming") {
    return <span style={{ color: "#7A8A93" }}>{dateStr}</span>;
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
      <span style={{ color: cfg.color, fontWeight: 600 }}>{dateStr}</span>
      <span style={{
        fontSize: 9, fontWeight: 700, fontFamily: manrope,
        color: cfg.color, background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: 999, paddingInline: 5, paddingBlock: 1,
        textTransform: "uppercase", letterSpacing: "0.04em",
      }}>
        {cfg.label}
      </span>
    </span>
  );
}

const STATUS_CONFIG: Record<ProjectTaskStatus, { label: string; dot: string; bg: string; icon: React.ReactNode }> = {
  done: {
    label: "Done",
    dot: "#22C55E", bg: "#22C55E1F",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" stroke="#22C55E" strokeWidth="1.5" fill="#22C55E1F" />
        <path d="M5 8L7 10L11 6" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  in_progress: {
    label: "In Progress",
    dot: "#14C4AE", bg: "#16DAC11F",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" stroke="#14C4AE" strokeWidth="1.5" fill="#16DAC11F" />
        <circle cx="8" cy="8" r="3" fill="#14C4AE" />
      </svg>
    ),
  },
  backlog: {
    label: "Backlog",
    dot: "#7A8A93", bg: "#7A8A9326",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" stroke="#B0BEC5" strokeWidth="1.5" fill="none" strokeDasharray="3 2" />
      </svg>
    ),
  },
  planning: {
    label: "Planning",
    dot: "#8B5CF6", bg: "#8B5CF61F",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" stroke="#8B5CF6" strokeWidth="1.5" fill="#8B5CF61F" />
        <rect x="5.5" y="5.5" width="5" height="5" rx="1" fill="#8B5CF6" />
      </svg>
    ),
  },
  review: {
    label: "Review",
    dot: "#F59E0B", bg: "#F59E0B1F",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" stroke="#F59E0B" strokeWidth="1.5" fill="#F59E0B1F" />
        <path d="M8 5V8.5L10 10" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
};

// ─── Status dropdown ──────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: ProjectTaskStatus; label: string }[] = [
  { value: "backlog",     label: "Backlog"     },
  { value: "planning",   label: "Planning"    },
  { value: "in_progress", label: "In Progress" },
  { value: "review",     label: "Review"      },
  { value: "done",       label: "Done"        },
];

function StatusDropdown({
  task,
  onUpdated,
  onRefresh,
}: {
  task: ProjectTaskRow;
  onUpdated: (taskId: string, newStatus: ProjectTaskStatus) => void;
  onRefresh: () => void;
}) {
  const { workspaceId } = useWorkspace();
  const { showToast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  async function handleSelect(newStatus: ProjectTaskStatus) {
    if (newStatus === task.status || !workspaceId) { setOpen(false); return; }
    setSaving(true);
    setOpen(false);
    onUpdated(task.id, newStatus);
    try {
      const res = await fetch(`/api/projects/${task.project_id}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId, status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed");
      onRefresh();
    } catch {
      onUpdated(task.id, task.status);
      showToast({ title: "Failed to update status" });
    } finally {
      setSaving(false);
    }
  }

  const cfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.backlog;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          disabled={saving}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            background: cfg.bg, borderRadius: 999, paddingBlock: 3, paddingInline: 8,
            border: "none", cursor: "pointer", fontFamily: manrope,
            fontSize: 11, fontWeight: 700, color: "#0F2A37",
            opacity: saving ? 0.6 : 1,
            transition: "opacity 0.12s, filter 0.12s",
          }}
          onMouseEnter={(e) => { if (!saving) (e.currentTarget as HTMLElement).style.filter = "brightness(0.95)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.filter = ""; }}
        >
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
          {cfg.label}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 180, borderRadius: 10,
            boxShadow: "0px 8px 24px rgba(93,100,99,0.14)",
            border: "1px solid #DEE8E8", backgroundColor: "#FFFFFF",
            zIndex: 99999, outline: "none", padding: 6,
          }}
        >
          {STATUS_OPTIONS.map((opt) => {
            const c = STATUS_CONFIG[opt.value];
            const isActive = task.status === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={(e) => { e.stopPropagation(); handleSelect(opt.value); }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  gap: 8, padding: "8px 10px", borderRadius: 7, border: "none",
                  cursor: "pointer", fontFamily: manrope, fontSize: 13,
                  fontWeight: isActive ? 600 : 500, color: "#1B1B1B",
                  background: isActive ? "#EDF8F8" : "transparent",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "#F5FAFA"; }}
                onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = ""; }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
                  {opt.label}
                </span>
                {isActive && <RiCheckLine size={13} style={{ color: "#16DAC1", flexShrink: 0 }} />}
              </button>
            );
          })}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ─── Progress pill ────────────────────────────────────────────────────────────

function ProgressPill({ done, total }: { done: number; total: number }) {
  if (total === 0) {
    return <span style={{ color: "#B0BEC5", fontFamily: manrope, fontSize: 12 }}>—</span>;
  }
  const pct = Math.round((done / total) * 100);
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {/* Bar */}
      <div style={{
        width: 40, height: 4, borderRadius: 9999,
        background: "#E5EAEC", overflow: "hidden", flexShrink: 0,
      }}>
        <div style={{
          width: `${pct}%`, height: "100%",
          background: pct === 100 ? "#22C55E" : "#14C4AE",
          borderRadius: 9999,
          transition: "width 0.25s",
        }} />
      </div>
      <span style={{
        fontFamily: manrope, fontSize: 11, fontWeight: 700,
        color: pct === 100 ? "#22C55E" : "#4A5C66",
        minWidth: 28,
      }}>
        {done}/{total}
      </span>
    </div>
  );
}

// ─── Filter chips ──────────────────────────────────────────────────────────────

export type FilterChip = ProjectTaskStatus | "all";

export const TASK_CHIP_ORDER: ProjectTaskStatus[] = ["done", "in_progress", "backlog", "planning", "review"];

// ─── Grid columns ─────────────────────────────────────────────────────────────

const GRID = "1fr 140px 200px 120px 96px 96px";

// ─── Component ────────────────────────────────────────────────────────────────

interface TasksTabProps {
  projectId: string;
  tasks: ProjectTaskRow[];
  filter: FilterChip;
  onTasksChanged: () => void;
}

export function TasksTab({ projectId, tasks, filter, onTasksChanged }: TasksTabProps) {
  const [addOpen, setAddOpen] = React.useState(false);
  const [editTask, setEditTask] = React.useState<ProjectTaskRow | null>(null);
  const [localTasks, setLocalTasks] = React.useState<ProjectTaskRow[]>(tasks);
  const [expandedTasks, setExpandedTasks] = React.useState<Set<string>>(new Set());
  const [addSubtaskFor, setAddSubtaskFor] = React.useState<string | null>(null);

  // Sync when parent tasks change
  React.useEffect(() => { setLocalTasks(tasks); }, [tasks]);

  function handleStatusUpdated(taskId: string, newStatus: ProjectTaskStatus) {
    setLocalTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));
  }

  function toggleExpand(id: string) {
    setExpandedTasks((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }

  // Derive parent tasks and subtask lookup
  const parentTasks = localTasks.filter((t) => !t.parent_task_id);
  const subtasksOf = (id: string) => localTasks.filter((t) => t.parent_task_id === id);

  // Apply filter only to parent tasks
  const filteredParents = filter === "all"
    ? parentTasks
    : parentTasks.filter((t) => t.status === filter);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Table */}
      <div style={{ background: "#FFFFFF", border: "1px solid #E5EAEC", borderRadius: 12, overflow: "clip" }}>

        {/* Header */}
        <div style={{
          display: "grid", gridTemplateColumns: GRID,
          alignItems: "center", background: "#F8FAFB",
          borderBottom: "1px solid #E5EAEC", paddingBlock: 10, paddingInline: 16, gap: 8,
        }}>
          {["Task", "Status", "Assignee", "Progress", "Start", "Due"].map((h) => (
            <div key={h} style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#4A5C66", fontFamily: manrope }}>{h}</div>
          ))}
        </div>

        {/* Rows */}
        {filteredParents.length === 0 ? (
          <div style={{ paddingBlock: 40, textAlign: "center", color: "#7A8A93", fontSize: 13, fontFamily: manrope }}>
            No tasks yet. Add one below.
          </div>
        ) : (
          filteredParents.map((task) => {
            const cfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.backlog;
            const subtasks = subtasksOf(task.id);
            const hasSubtasks = subtasks.length > 0;
            const isExpanded = expandedTasks.has(task.id);
            const doneSubtasks = subtasks.filter((s) => s.status === "done").length;

            return (
              <React.Fragment key={task.id}>
                {/* Parent task row */}
                <div
                  onClick={() => setEditTask(task)}
                  style={{
                    display: "grid", gridTemplateColumns: GRID,
                    alignItems: "center", gap: 8,
                    paddingBlock: 12, paddingInline: 16,
                    borderBottom: "1px solid #EAEEF0", cursor: "pointer",
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#F8FAFB")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {/* Task title with chevron */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    {/* Chevron — always reserve space; visible when has subtasks or on hover */}
                    {hasSubtasks ? (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleExpand(task.id); }}
                        title={isExpanded ? "Collapse subtasks" : "Expand subtasks"}
                        style={{
                          flexShrink: 0,
                          width: 20, height: 20,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          border: "none", cursor: "pointer", padding: 0,
                          borderRadius: "50%", background: "transparent",
                          color: "#4A5C66",
                          transition: "background 0.12s",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#E5EAEC"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                      >
                        <RiArrowRightSLine
                          size={14}
                          style={{
                            transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                            transition: "transform 0.18s",
                          }}
                        />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setAddSubtaskFor(task.id); }}
                        title="Add subtask"
                        style={{
                          flexShrink: 0,
                          width: 20, height: 20,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          border: "none", cursor: "pointer", padding: 0,
                          borderRadius: "50%", background: "transparent",
                          color: "#22C55E",
                          transition: "opacity 0.12s",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.7"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                      >
                        <RiAddLine size={14} />
                      </button>
                    )}
                    <span style={{ flexShrink: 0 }}>{cfg.icon}</span>
                    <span style={{
                      fontSize: 13, fontWeight: 600, color: "#0F2A37", fontFamily: manrope,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      textDecoration: task.status === "done" ? "line-through" : "none",
                      opacity: task.status === "done" ? 0.6 : 1,
                    }}>
                      {task.title}
                    </span>
                    {task.priority && task.priority !== "medium" && (
                      <span style={{
                        flexShrink: 0,
                        fontSize: 9, fontWeight: 700, fontFamily: manrope,
                        color: task.priority === "urgent" ? "#EF4444" : task.priority === "high" ? "#F97316" : "#64748B",
                        background: task.priority === "urgent" ? "#FEF2F2" : task.priority === "high" ? "#FFF7ED" : "#F1F5F9",
                        borderRadius: 999, paddingInline: 5, paddingBlock: 1, marginLeft: 2,
                        textTransform: "uppercase",
                      }}>
                        {task.priority === "urgent" ? "⚡ URGENT" : task.priority === "high" ? "↑ HIGH" : "↓ LOW"}
                      </span>
                    )}
                    {hasSubtasks && (
                      <span style={{
                        flexShrink: 0, fontSize: 10, fontWeight: 700, fontFamily: manrope,
                        color: "#7A8A93", background: "#F0F4F5", borderRadius: 999,
                        paddingInline: 5, paddingBlock: 1, marginLeft: 2,
                      }}>
                        {subtasks.length}
                      </span>
                    )}
                  </div>

                  {/* Status */}
                  <div>
                    <StatusDropdown task={task} onUpdated={handleStatusUpdated} onRefresh={onTasksChanged} />
                  </div>

                  {/* Assignee */}
                  <div style={{ fontSize: 12, color: "#4A5C66", fontFamily: manrope, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {task.assignee_name ?? <span style={{ color: "#B0BEC5" }}>—</span>}
                  </div>

                  {/* Progress */}
                  <div>
                    <ProgressPill done={doneSubtasks} total={subtasks.length} />
                  </div>

                  {/* Start */}
                  <div style={{ fontSize: 12, color: "#7A8A93", fontFamily: manrope }}>
                    {fmt(task.start_date)}
                  </div>

                  {/* Due */}
                  <div style={{ fontSize: 12, fontFamily: manrope }}>
                    {task.due_date ? <DueDateCell iso={task.due_date} status={task.status} /> : <span style={{ color: "#B0BEC5" }}>—</span>}
                  </div>
                </div>

                {/* Subtask rows — shown when expanded */}
                {isExpanded && (
                  <>
                    {subtasks.map((sub) => {
                      const subCfg = STATUS_CONFIG[sub.status] ?? STATUS_CONFIG.backlog;
                      return (
                        <div
                          key={sub.id}
                          onClick={() => setEditTask(sub)}
                          style={{
                            display: "grid", gridTemplateColumns: GRID,
                            alignItems: "center", gap: 8,
                            paddingBlock: 10, paddingInline: 16,
                            paddingLeft: 44,
                            borderBottom: "1px solid #EAEEF0",
                            background: "rgba(240,244,245,0.45)",
                            cursor: "pointer",
                            transition: "background 0.12s",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#EDF8F8")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(240,244,245,0.45)")}
                        >
                          {/* Subtask title */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                            {/* Indent connector line decoration */}
                            <span style={{
                              flexShrink: 0, width: 12, height: 1,
                              background: "#CBD5DA", borderRadius: 1, marginRight: 2,
                            }} />
                            <span style={{ flexShrink: 0 }}>{subCfg.icon}</span>
                            <span style={{
                              fontSize: 12, fontWeight: 500, color: "#0F2A37", fontFamily: manrope,
                              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                              textDecoration: sub.status === "done" ? "line-through" : "none",
                              opacity: sub.status === "done" ? 0.55 : 1,
                            }}>
                              {sub.title}
                            </span>
                          </div>

                          {/* Status */}
                          <div>
                            <StatusDropdown task={sub} onUpdated={handleStatusUpdated} onRefresh={onTasksChanged} />
                          </div>

                          {/* Assignee */}
                          <div style={{ fontSize: 12, color: "#4A5C66", fontFamily: manrope, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {sub.assignee_name ?? <span style={{ color: "#B0BEC5" }}>—</span>}
                          </div>

                          {/* Progress — n/a for subtasks */}
                          <div style={{ color: "#B0BEC5", fontFamily: manrope, fontSize: 12 }}>—</div>

                          {/* Start */}
                          <div style={{ fontSize: 12, color: "#7A8A93", fontFamily: manrope }}>
                            {fmt(sub.start_date)}
                          </div>

                          {/* Due */}
                          <div style={{ fontSize: 12, fontFamily: manrope }}>
                            {sub.due_date ? <DueDateCell iso={sub.due_date} status={sub.status} /> : <span style={{ color: "#B0BEC5" }}>—</span>}
                          </div>
                        </div>
                      );
                    })}

                    {/* Add subtask row */}
                    <div style={{
                      display: "flex", alignItems: "center",
                      paddingBlock: 8, paddingInline: 16, paddingLeft: 44,
                      borderBottom: "1px solid #EAEEF0",
                      background: "rgba(240,244,245,0.45)",
                    }}>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setAddSubtaskFor(task.id); }}
                        className="flex items-center gap-2 group"
                        style={{ background: "none", border: "none", cursor: "pointer", fontFamily: manrope }}
                      >
                        <span className="flex items-center justify-center size-5 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors shrink-0">
                          <RiAddLine size={11} className="text-primary" />
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#4A5C66" }}>Add subtask</span>
                      </button>
                    </div>
                  </>
                )}
              </React.Fragment>
            );
          })
        )}

        {/* Add task row */}
        <button
          onClick={() => setAddOpen(true)}
          className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-[#F8FAFB] transition-colors group"
          style={{ background: "none", border: "none", cursor: "pointer", fontFamily: manrope }}
        >
          <span className="flex items-center justify-center size-6 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors shrink-0">
            <RiAddLine size={13} className="text-primary" />
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#4A5C66" }}>Add task</span>
        </button>
      </div>

      {/* Modals */}
      {addOpen && (
        <AddTaskModal
          open={addOpen}
          projectId={projectId}
          onClose={() => setAddOpen(false)}
          onCreated={() => { onTasksChanged(); }}
        />
      )}
      {addSubtaskFor && (
        <AddTaskModal
          open={!!addSubtaskFor}
          projectId={projectId}
          parentTaskId={addSubtaskFor}
          onClose={() => setAddSubtaskFor(null)}
          onCreated={() => {
            setAddSubtaskFor(null);
            // Auto-expand the parent when a subtask is added
            setExpandedTasks((prev) => {
              const s = new Set(prev);
              s.add(addSubtaskFor!);
              return s;
            });
            onTasksChanged();
          }}
        />
      )}
      {editTask && (
        <EditTaskModal
          open={!!editTask}
          task={editTask}
          onClose={() => setEditTask(null)}
          onSaved={() => { setEditTask(null); onTasksChanged(); }}
          onDeleted={() => { setEditTask(null); onTasksChanged(); }}
        />
      )}
    </div>
  );
}
