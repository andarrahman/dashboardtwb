"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  RiArrowLeftLine,
  RiEditLine,
  RiMoreLine,
  RiAddLine,
  RiCalendarLine,
  RiArchiveLine,
  RiDeleteBin2Line,
} from "@remixicon/react";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { useToast } from "@/components/ui/toast";
import type { ProjectRow, ProjectTaskRow, ProjectWeeklyUpdateRow, ProjectStatus } from "@/lib/supabase/types";
import { TasksTab, FilterChip, TASK_CHIP_ORDER } from "./_components/tasks-tab";
import { WeeklyUpdatesTab } from "./_components/weekly-updates-tab";
import { EditProjectModal } from "./_components/edit-project-modal";
import { WeeklyUpdateModal } from "./_components/weekly-update-modal";
import { ActivityTab } from "./_components/activity-tab";
import { DiscussionTab } from "./_components/discussion-tab";

// ─── Helpers ───────────────────────────────────────────────────────────────────

const manrope = '"Manrope", system-ui, sans-serif';

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_MAP: Record<ProjectStatus, { dot: string; bg: string; label: string }> = {
  backlog:     { dot: "#7A8A93", bg: "#7A8A9326", label: "Backlog" },
  in_progress: { dot: "#14C4AE", bg: "#16DAC11F", label: "In Progress" },
  review:      { dot: "#F5A623", bg: "#FFB80026", label: "Review" },
  done:        { dot: "#22C55E", bg: "#22C55E1F", label: "Done" },
  archived:    { dot: "#7A8A93", bg: "#7A8A9326", label: "Archived" },
};

const STATUS_OPTIONS: ProjectStatus[] = ["backlog", "in_progress", "review", "done"];

function ProjectStatusDropdown({
  status, onUpdate,
}: {
  status: ProjectStatus;
  onUpdate: (s: ProjectStatus) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const s = STATUS_MAP[status] ?? STATUS_MAP.backlog;
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: s.bg, borderRadius: 999, paddingBlock: 4, paddingInline: 10,
            fontFamily: manrope, fontSize: 11, fontWeight: 700, color: "#0F2A37",
            border: "none", cursor: "pointer",
            transition: "filter 0.12s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.filter = "brightness(0.95)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.filter = ""; }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
          {s.label}
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 1, opacity: 0.5 }}>
            <path d="M2.5 4L5 6.5L7.5 4" stroke="#0F2A37" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6} align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
          style={{
            width: 160, borderRadius: 10,
            boxShadow: "0px 8px 24px rgba(93,100,99,0.14)",
            border: "1px solid #DEE8E8", backgroundColor: "#FFFFFF",
            zIndex: 99999, outline: "none", padding: 6,
          }}
        >
          {STATUS_OPTIONS.map((opt) => {
            const c = STATUS_MAP[opt];
            const isActive = status === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => { onUpdate(opt); setOpen(false); }}
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
                  {c.label}
                </span>
                {isActive && (
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M2.5 6.5L5.5 9.5L10.5 4" stroke="#16DAC1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            );
          })}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function MetaItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#BCCDD4", fontFamily: manrope }}>
        {label}
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#0F2A37", fontFamily: manrope }}>
        {value || "—"}
      </span>
    </div>
  );
}

function ProgressCircle({ pct, done, total }: { pct: number; done: number; total: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "16px 20px", background: "#F8FAFB", borderRadius: 14, border: "1px solid #DEE8E8", minWidth: 160 }}>
      <div style={{ position: "relative", width: 88, height: 88 }}>
        <svg width="88" height="88" viewBox="0 0 88 88" fill="none" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="44" cy="44" r={r} stroke="#EAEEF0" strokeWidth="8" fill="none" />
          <circle
            cx="44" cy="44" r={r} stroke="#14C4AE" strokeWidth="8" fill="none"
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.5s ease" }}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: "#0F2A37", fontFamily: manrope }}>{pct}%</span>
        </div>
      </div>
    </div>
  );
}

type ActiveTab = "tasks" | "weekly_updates" | "activity" | "discussion";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { workspaceId, loading: wsLoading } = useWorkspace();
  const { showToast } = useToast();

  const [project, setProject] = React.useState<ProjectRow | null>(null);
  const [tasks, setTasks] = React.useState<ProjectTaskRow[]>([]);
  const [updates, setUpdates] = React.useState<ProjectWeeklyUpdateRow[]>([]);
  const [activityCount, setActivityCount] = React.useState(0);
  const [discussionCount, setDiscussionCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  const [activeTab, setActiveTab] = React.useState<ActiveTab>("tasks");
  const [taskFilter, setTaskFilter] = React.useState<FilterChip>("all");
  const [editOpen, setEditOpen] = React.useState(() => searchParams.get("edit") === "1");
  const [weeklyOpen, setWeeklyOpen] = React.useState(false);
  const [moreOpen, setMoreOpen] = React.useState(false);
  const moreRef = React.useRef<HTMLDivElement>(null);

  // Inline title editing
  const [editingTitle, setEditingTitle] = React.useState(false);
  const [titleDraft, setTitleDraft] = React.useState("");
  const [savingTitle, setSavingTitle] = React.useState(false);
  const titleInputRef = React.useRef<HTMLInputElement>(null);

  function startEditTitle() {
    if (!project) return;
    setTitleDraft(project.title);
    setEditingTitle(true);
    setTimeout(() => titleInputRef.current?.select(), 0);
  }

  async function commitTitle() {
    if (!project || !workspaceId || !titleDraft.trim() || titleDraft.trim() === project.title) {
      setEditingTitle(false);
      return;
    }
    setSavingTitle(true);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId, title: titleDraft.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setProject(json.project);
    } catch {
      showToast({ title: "Failed to update title" });
    } finally {
      setSavingTitle(false);
      setEditingTitle(false);
    }
  }

  function handleTitleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); commitTitle(); }
    if (e.key === "Escape") { setEditingTitle(false); }
  }

  React.useEffect(() => {
    if (!moreOpen) return;
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [moreOpen]);

  const fetchProject = React.useCallback(async () => {
    if (!workspaceId || !id) return;
    try {
      const res = await fetch(`/api/projects/${id}?workspace_id=${workspaceId}`);
      if (!res.ok) throw new Error("Not found");
      const json = await res.json();
      setProject(json.project);
    } catch {
      showToast({ title: "Failed to load project" });
    }
  }, [workspaceId, id, showToast]);

  const fetchTasks = React.useCallback(async () => {
    if (!workspaceId || !id) return;
    try {
      const res = await fetch(`/api/projects/${id}/tasks?workspace_id=${workspaceId}`);
      if (!res.ok) return;
      const json = await res.json();
      setTasks(json.tasks ?? []);
    } catch { /* silent */ }
  }, [workspaceId, id]);

  const fetchUpdates = React.useCallback(async () => {
    if (!workspaceId || !id) return;
    try {
      const res = await fetch(`/api/projects/${id}/weekly-updates?workspace_id=${workspaceId}`);
      if (!res.ok) return;
      const json = await res.json();
      setUpdates(json.updates ?? []);
    } catch { /* silent */ }
  }, [workspaceId, id]);

  const fetchActivityCount = React.useCallback(async () => {
    if (!workspaceId || !id) return;
    try {
      const res = await fetch(`/api/projects/${id}/activity?workspace_id=${workspaceId}`);
      if (!res.ok) return;
      const json = await res.json();
      setActivityCount((json.logs ?? []).length);
    } catch { /* silent */ }
  }, [workspaceId, id]);

  React.useEffect(() => {
    if (!wsLoading && workspaceId) {
      setLoading(true);
      Promise.all([fetchProject(), fetchTasks(), fetchUpdates(), fetchActivityCount()]).finally(() => setLoading(false));
    }
  }, [wsLoading, workspaceId, fetchProject, fetchTasks, fetchUpdates]);

  // Progress from tasks
  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const totalTasks = tasks.length;
  const progressPct = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);

  async function handleDelete() {
    if (!workspaceId || !project) return;
    if (!confirm(`Delete "${project.title}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/projects/${id}?workspace_id=${workspaceId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      showToast({ title: "Project deleted" });
      router.push("/projects");
    } catch (err) {
      showToast({ title: "Error", subtitle: err instanceof Error ? err.message : undefined });
    }
  }

  // Check if current week already has a submitted update
  const currentWeekStart = (() => {
    const d = new Date();
    const day = d.getDay();
    const toMonday = day === 0 ? -6 : 1 - day;
    const mon = new Date(d);
    mon.setDate(d.getDate() + toMonday);
    return mon.toISOString().slice(0, 10);
  })();
  const hasThisWeekUpdate = updates.some(
    (u) => !u.is_draft && u.week_start === currentWeekStart
  );

  const TABS: { key: ActiveTab; label: string; count?: number }[] = [
    { key: "tasks", label: "Tasks", count: totalTasks },
    { key: "weekly_updates", label: "Weekly updates", count: updates.length },
    { key: "activity", label: "Activity", count: activityCount },
    { key: "discussion", label: "Discussion", count: discussionCount },
  ];

  if (loading || wsLoading) {
    return (
      <div style={{ padding: "32px 40px", fontFamily: manrope }} className="animate-pulse">
        <div style={{ height: 16, width: 120, background: "#EAEEF0", borderRadius: 4, marginBottom: 24 }} />
        <div style={{ height: 28, width: 340, background: "#EAEEF0", borderRadius: 4 }} />
        <div style={{ height: 16, width: 240, background: "#EAEEF0", borderRadius: 4, marginTop: 16 }} />
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ padding: "32px 40px", fontFamily: manrope }}>
        <Link href="/projects" style={{ color: "#4A5C66", fontSize: 13, display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
          <RiArrowLeftLine style={{ width: 14, height: 14 }} /> Back to projects
        </Link>
        <p style={{ marginTop: 48, textAlign: "center", color: "#7A8A93" }}>Project not found.</p>
      </div>
    );
  }

  const assignees = (
    Array.isArray(project.assignees) ? project.assignees : []
  ) as { id: string; name: string; avatar_url?: string | null }[];

  // Department badge colors
  const deptColors: Record<string, { bg: string; text: string; dot: string }> = {
    growth:      { dot: "#14C4AE", bg: "#E6FAF8", text: "#0D9488" },
    product:     { dot: "#6366F1", bg: "#EEF2FF", text: "#4F46E5" },
    engineering: { dot: "#1E293B", bg: "#F1F5F9", text: "#1E293B" },
    marketing:   { dot: "#F97316", bg: "#FFF7ED", text: "#EA580C" },
    operations:  { dot: "#F59E0B", bg: "#FFFBEB", text: "#D97706" },
    design:      { dot: "#EC4899", bg: "#FDF2F8", text: "#DB2777" },
    sales:       { dot: "#3B82F6", bg: "#EFF6FF", text: "#2563EB" },
    tech:        { dot: "#1E293B", bg: "#F1F5F9", text: "#1E293B" },
    finance:     { dot: "#22C55E", bg: "#F0FDF4", text: "#16A34A" },
  };
  // Match by first keyword in dept name
  const deptKey = project.department
    ? Object.keys(deptColors).find((k) => project.department!.toLowerCase().includes(k))
    : null;
  const dc = deptKey
    ? deptColors[deptKey]
    : project.department
    ? (() => {
        const palette = [
          { dot: "#14C4AE", bg: "#E6FAF8", text: "#0D9488" },
          { dot: "#6366F1", bg: "#EEF2FF", text: "#4F46E5" },
          { dot: "#F97316", bg: "#FFF7ED", text: "#EA580C" },
        ];
        let h = 0;
        for (const c of project.department!) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
        return palette[h % palette.length];
      })()
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", background: "#FFFFFF", minHeight: "100vh", fontFamily: manrope }}>
      {/* ── Single-line top bar ── */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 12,
          paddingInline: 32, paddingBlock: 16,
          borderBottom: "1px solid #F0F4F7",
          background: "#FFFFFF",
        }}
      >
        {/* Left: back + field badge + title + edit */}
        <Link
          href="/projects"
          style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#7A8A93", fontSize: 13, textDecoration: "none", flexShrink: 0 }}
        >
          <RiArrowLeftLine style={{ width: 14, height: 14 }} />
          Back to projects
        </Link>

        <span style={{ color: "#D0DCDC", fontSize: 14, flexShrink: 0 }}>·</span>

        {/* Department badge */}
        {project.department && dc && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            background: dc.bg, borderRadius: 999, paddingBlock: 4, paddingInline: 9,
            fontSize: 11, fontWeight: 700, color: dc.text, flexShrink: 0, letterSpacing: "0.04em",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: dc.dot }} />
            {project.department.toUpperCase()}
          </span>
        )}

        {/* Title — inline editable */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
          {editingTitle ? (
            <input
              ref={titleInputRef}
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={handleTitleKeyDown}
              disabled={savingTitle}
              style={{
                fontSize: 15, fontWeight: 800, color: "#0F2A37",
                fontFamily: manrope, lineHeight: "20px",
                border: "none", borderBottom: "2px solid #14C4AE",
                outline: "none", background: "transparent",
                padding: "0 2px", margin: 0,
                minWidth: 40, width: `${Math.max(titleDraft.length, 4)}ch`,
                opacity: savingTitle ? 0.6 : 1,
              }}
            />
          ) : (
            <h1
              onClick={startEditTitle}
              title="Click to edit title"
              style={{
                fontSize: 15, fontWeight: 800, color: "#0F2A37", margin: 0,
                lineHeight: "20px", overflow: "hidden", textOverflow: "ellipsis",
                whiteSpace: "nowrap", cursor: "text",
              }}
            >
              {project.title}
            </h1>
          )}
          {!editingTitle && (
            <button
              onClick={startEditTitle}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#AABBC2", display: "flex", flexShrink: 0 }}
              title="Edit title"
            >
              <RiEditLine style={{ width: 15, height: 15 }} />
            </button>
          )}
        </div>

        {/* Action buttons */}
        {!hasThisWeekUpdate && (
          <button
            onClick={() => setWeeklyOpen(true)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "#FFFFFF", border: "1px solid #E5EAEC", borderRadius: 999,
              paddingBlock: 8, paddingInline: 14, cursor: "pointer",
              fontSize: 13, fontWeight: 600, color: "#374151", fontFamily: manrope,
              flexShrink: 0,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#F8FAFB")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#FFFFFF")}
          >
            <RiCalendarLine style={{ width: 14, height: 14, color: "#7A8A93" }} />
            Submit weekly update
          </button>
        )}
        <button
          onClick={() => setActiveTab("tasks")}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "#16DAC1", border: "none", borderRadius: 999,
            paddingBlock: 8, paddingInline: 16, cursor: "pointer",
            fontSize: 13, fontWeight: 700, color: "#FFFFFF",
            boxShadow: "#14C4AE47 0px 4px 12px",
            fontFamily: manrope, flexShrink: 0,
          }}
        >
          <RiAddLine style={{ width: 14, height: 14 }} />
          Add task
        </button>

        {/* 3-dot menu */}
        <div className="relative" ref={moreRef} style={{ flexShrink: 0 }}>
          <button
            onClick={() => setMoreOpen((p) => !p)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 34, height: 34, borderRadius: 8,
              border: "1px solid #E5EAEC", background: "#FFFFFF",
              cursor: "pointer", color: "#4A5C66",
            }}
          >
            <RiMoreLine style={{ width: 15, height: 15 }} />
          </button>
          {moreOpen && (
            <div style={{
              position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 50,
              width: 180, background: "#FFFFFF", border: "1px solid #E5EAEC",
              borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
              padding: "4px 0", fontFamily: manrope,
            }}>
              <button
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#F0F7F7] text-[#0F2A37] transition-colors text-[13px]"
                onClick={() => { setMoreOpen(false); setEditOpen(true); }}
              >
                <RiEditLine className="size-4 text-[#7A8A93]" /> Edit project
              </button>
              <button
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#F0F7F7] text-[#0F2A37] transition-colors text-[13px]"
                onClick={() => setMoreOpen(false)}
              >
                <RiArchiveLine className="size-4 text-[#7A8A93]" /> Archive
              </button>
              <div style={{ height: 1, background: "#E5EAEC", margin: "4px 0" }} />
              <button
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#FEF2F2] text-red-600 transition-colors text-[13px]"
                onClick={() => { setMoreOpen(false); handleDelete(); }}
              >
                <RiDeleteBin2Line className="size-4" /> Delete project
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Info summary card ── */}
      <div style={{ paddingInline: 32, paddingTop: 20, paddingBottom: 0 }}>
        <div style={{
          background: "#FAFCFC", border: "1px solid #E8EDEF", borderRadius: 16,
          padding: "20px 24px",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24,
        }}>
          {/* Left: status badges + project ID + metadata */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Project title */}
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0F2A37", margin: "0 0 10px 0", fontFamily: manrope, lineHeight: "24px" }}>
              {project.title}
            </h2>
            {/* Status + weekly badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <ProjectStatusDropdown
                status={project.status}
                onUpdate={async (newStatus) => {
                  if (!workspaceId) return;
                  const prev = project.status;
                  setProject((p) => p ? { ...p, status: newStatus } : p);
                  try {
                    const res = await fetch(`/api/projects/${id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ workspace_id: workspaceId, status: newStatus }),
                    });
                    if (!res.ok) throw new Error();
                    const json = await res.json();
                    setProject(json.project);
                    fetchActivityCount();
                  } catch {
                    setProject((p) => p ? { ...p, status: prev } : p);
                    showToast({ title: "Failed to update status" });
                  }
                }}
              />
              {/* Weekly update badge */}
              {updates.length > 0 ? (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  background: "#F0FDF4", borderRadius: 999, paddingBlock: 4, paddingInline: 10,
                  fontSize: 11, fontWeight: 600, color: "#16A34A",
                }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5.5L4 7.5L8 3" stroke="#16A34A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Weekly update submitted
                </span>
              ) : (
                <button
                  onClick={() => setWeeklyOpen(true)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    background: "#FFF7ED", borderRadius: 999, paddingBlock: 4, paddingInline: 10,
                    fontSize: 11, fontWeight: 600, color: "#EA580C",
                    border: "none", cursor: "pointer",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#FFEDD5")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#FFF7ED")}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="4" stroke="#EA580C" strokeWidth="1.5"/><path d="M5 3V5.5M5 7H5.01" stroke="#EA580C" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  Need weekly update · Submit now
                </button>
              )}
            </div>
            {/* Metadata row */}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: "5px 40px" }}>
              {/* Owner */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#BCCDD4", marginBottom: 5 }}>Owner</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {project.owner_name ? (
                    <>
                      <div style={{
                        width: 22, height: 22, borderRadius: "50%", background: "#14C4AE",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 9, fontWeight: 700, color: "#fff", flexShrink: 0,
                      }}>
                        {project.owner_name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#0F2A37" }}>{project.owner_name}</span>
                    </>
                  ) : <span style={{ fontSize: 13, color: "#AABBC2" }}>—</span>}
                </div>
              </div>
              {/* Assignees */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#BCCDD4", marginBottom: 5 }}>Assignees</div>
                <div style={{ display: "flex", alignItems: "center" }}>
                  {assignees.length > 0 ? (
                    <>
                      {assignees.slice(0, 4).map((a, i) => (
                        <div key={a.id} style={{
                          marginLeft: i > 0 ? -6 : 0, zIndex: assignees.length - i,
                          width: 22, height: 22, borderRadius: "50%",
                          background: ["#14C4AE","#6366F1","#F97316","#EC4899"][i % 4],
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 8, fontWeight: 700, color: "#fff", border: "2px solid #FAFCFC", flexShrink: 0,
                        }}>
                          {a.name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)}
                        </div>
                      ))}
                      {assignees.length > 4 && (
                        <span style={{ marginLeft: 6, fontSize: 11, color: "#7A8A93" }}>+{assignees.length - 4}</span>
                      )}
                    </>
                  ) : <span style={{ fontSize: 13, color: "#AABBC2" }}>—</span>}
                </div>
              </div>
              <MetaItem label="Department" value={project.department} />
              <MetaItem label="Sprint"     value={project.sprint} />
              <MetaItem label="Quarter"    value={project.quarter} />
              <MetaItem label="Start date" value={fmt(project.start_date)} />
              <MetaItem
                label="Due date"
                value={
                  <span style={{ color: project.due_date && new Date(project.due_date) < new Date() && project.status !== "done" ? "#EF4444" : "#0F2A37" }}>
                    {fmt(project.due_date)}
                  </span>
                }
              />
            </div>
          </div>

          {/* Right: Progress circle */}
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            flexShrink: 0, minWidth: 140,
          }}>
            <ProgressCircle pct={progressPct} done={doneTasks} total={totalTasks} />
          </div>
        </div>
      </div>

      {/* ── Divider ── */}
      <div style={{ height: 1, background: "#F0F4F7", marginInline: 32, marginTop: 20 }} />

      {/* ── Tabs row (main tabs left · filter chips right) ── */}
      <div style={{ paddingInline: 32, paddingTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        {/* Main tabs */}
        <div style={{ display: "inline-flex", background: "#F0F4F7", borderRadius: 999, padding: 3, gap: 2 }}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  borderRadius: 999, paddingBlock: 7, paddingInline: 14,
                  border: "none", cursor: "pointer", fontFamily: manrope,
                  fontSize: 13, fontWeight: isActive ? 700 : 500,
                  color: isActive ? "#0F2A37" : "#7A8A93",
                  background: isActive ? "#FFFFFF" : "transparent",
                  boxShadow: isActive ? "0 1px 6px rgba(0,0,0,0.09)" : "none",
                  transition: "all 0.12s",
                }}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span style={{
                    background: isActive ? "#F0F4F7" : "transparent",
                    color: isActive ? "#4A5C66" : "#B0BEC5",
                    borderRadius: 999, paddingBlock: 1, paddingInline: 6,
                    fontSize: 11, fontWeight: 700,
                  }}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Filter chips — only visible on Tasks tab */}
        {activeTab === "tasks" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <button
              onClick={() => setTaskFilter("all")}
              style={{
                borderRadius: 999, paddingBlock: 5, paddingInline: 12, border: "none", cursor: "pointer",
                background: taskFilter === "all" ? "#0F2A37" : "#F0F7F7",
                color: taskFilter === "all" ? "#FFFFFF" : "#4A5C66",
                fontSize: 12, fontWeight: 600, fontFamily: manrope,
              }}
            >
              All · {tasks.length}
            </button>
            {(() => {
              const chipCounts: Partial<Record<string, number>> = {};
              for (const t of tasks) chipCounts[t.status] = (chipCounts[t.status] ?? 0) + 1;
              return TASK_CHIP_ORDER.filter((s) => chipCounts[s] !== undefined).map((s) => {
                const isActive = taskFilter === s;
                const CHIP_COLORS: Record<string, string> = {
                  done: "#22C55E", in_progress: "#14C4AE", backlog: "#7A8A93", planning: "#8B5CF6", review: "#F59E0B",
                };
                const CHIP_LABELS: Record<string, string> = {
                  done: "Done", in_progress: "In Progress", backlog: "Backlog", planning: "Planning", review: "Review",
                };
                return (
                  <button
                    key={s}
                    onClick={() => setTaskFilter(s)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      borderRadius: 999, paddingBlock: 5, paddingInline: 12,
                      border: "none", cursor: "pointer",
                      background: isActive ? CHIP_COLORS[s] : "#F0F7F7",
                      color: isActive ? "#FFFFFF" : "#4A5C66",
                      fontSize: 12, fontWeight: 600, fontFamily: manrope, transition: "all 0.15s",
                    }}
                  >
                    {CHIP_LABELS[s]} · {chipCounts[s]}
                  </button>
                );
              });
            })()}
          </div>
        )}
      </div>

      {/* ── Tab content ── */}
      <div style={{ flex: 1, paddingInline: 32, paddingTop: 20, paddingBottom: 40 }}>
        {activeTab === "tasks" && (
          <TasksTab
            projectId={id}
            tasks={tasks}
            filter={taskFilter}
            onTasksChanged={fetchTasks}
          />
        )}
        {activeTab === "weekly_updates" && (
          <WeeklyUpdatesTab
            projectId={id}
            projectTitle={project.title}
            updates={updates}
            onUpdatesChanged={fetchUpdates}
            onSubmitUpdate={() => setWeeklyOpen(true)}
          />
        )}
        {activeTab === "activity" && (
          <ActivityTab projectId={project.id} onCountChange={setActivityCount} />
        )}
        {activeTab === "discussion" && (
          <DiscussionTab projectId={id} onCountChange={setDiscussionCount} />
        )}
      </div>

      {/* Modals */}
      {editOpen && (
        <EditProjectModal
          open={editOpen}
          project={project}
          onClose={() => { setEditOpen(false); router.replace(`/projects/${project?.id}`); }}
          onSaved={(updated) => { setProject(updated); setEditOpen(false); router.replace(`/projects/${updated.id}`); }}
          onDeleted={() => { setEditOpen(false); router.push("/projects"); }}
        />
      )}
      {weeklyOpen && (
        <WeeklyUpdateModal
          open={weeklyOpen}
          projectId={id}
          projectTitle={project.title}
          existingUpdate={null}
          onClose={() => setWeeklyOpen(false)}
          onSaved={() => { setWeeklyOpen(false); fetchUpdates(); }}
        />
      )}
    </div>
  );
}
