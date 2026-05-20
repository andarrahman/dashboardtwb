"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { useRouter } from "next/navigation";
import {
  RiAddLine,
  RiSearchLine,
  RiMoreLine,
  RiMore2Fill,
  RiEditLine,
  RiArchiveLine,
  RiDeleteBin2Line,
  RiFolderLine,
  RiLayoutGridLine,
  RiListCheck,
  RiCheckLine,
  RiArrowRightLine,
  RiCalendarLine,
  RiTimeLine,
  RiUserLine,
  RiTeamLine,
  RiArrowDownSLine,
  RiArrowUpSLine,
} from "@remixicon/react";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { useToast } from "@/components/ui/toast";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/browser";
import type { ProjectRow } from "@/lib/supabase/types";
import { CreateProjectModal } from "./_create-project-modal";
import { EditProjectModal } from "./[id]/_components/edit-project-modal";

// ── Font ───────────────────────────────────────────────────────────────────────
const manrope = '"Manrope", system-ui, sans-serif';

// ── Formatters ─────────────────────────────────────────────────────────────────
function fmtShort(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function fmtFull(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function isOverdue(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso) < new Date();
}

// ── Status badge ───────────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { dot: string; bg: string; label: string }> = {
  backlog:     { dot: "#94A3B8", bg: "#F1F5F9", label: "Backlog"     },
  in_progress: { dot: "#14C4AE", bg: "#E6FAF8", label: "In Progress" },
  review:      { dot: "#F59E0B", bg: "#FFFBEB", label: "Review"      },
  done:        { dot: "#22C55E", bg: "#F0FDF4", label: "Done"        },
  archived:    { dot: "#94A3B8", bg: "#F1F5F9", label: "Archived"    },
  planning:    { dot: "#8B5CF6", bg: "#F5F3FF", label: "Planning"    },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.backlog;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: s.bg,
        borderRadius: 999,
        paddingBlock: 4,
        paddingInline: 10,
        fontFamily: manrope,
        fontSize: 11,
        fontWeight: 600,
        color: "#374151",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: s.dot,
          flexShrink: 0,
        }}
      />
      {s.label}
    </span>
  );
}

// ── Department badge ───────────────────────────────────────────────────────────
function getDeptColor(dept: string | null) {
  if (!dept) return { dot: "#94A3B8", bg: "#F1F5F9", text: "#64748B" };
  const d = dept.toLowerCase();
  if (d.includes("growth"))      return { dot: "#14C4AE", bg: "#E6FAF8", text: "#0D9488" };
  if (d.includes("product"))     return { dot: "#6366F1", bg: "#EEF2FF", text: "#4F46E5" };
  if (d.includes("engineering")) return { dot: "#1E293B", bg: "#F1F5F9", text: "#1E293B" };
  if (d.includes("marketing"))   return { dot: "#F97316", bg: "#FFF7ED", text: "#EA580C" };
  if (d.includes("operations"))  return { dot: "#F59E0B", bg: "#FFFBEB", text: "#D97706" };
  if (d.includes("design"))      return { dot: "#EC4899", bg: "#FDF2F8", text: "#DB2777" };
  if (d.includes("sales"))       return { dot: "#3B82F6", bg: "#EFF6FF", text: "#2563EB" };
  if (d.includes("tech"))        return { dot: "#1E293B", bg: "#F1F5F9", text: "#1E293B" };
  if (d.includes("finance"))     return { dot: "#22C55E", bg: "#F0FDF4", text: "#16A34A" };
  if (d.includes("hr") || d.includes("people")) return { dot: "#8B5CF6", bg: "#F5F3FF", text: "#7C3AED" };
  // hash fallback
  const palette = [
    { dot: "#14C4AE", bg: "#E6FAF8", text: "#0D9488" },
    { dot: "#6366F1", bg: "#EEF2FF", text: "#4F46E5" },
    { dot: "#F97316", bg: "#FFF7ED", text: "#EA580C" },
    { dot: "#EC4899", bg: "#FDF2F8", text: "#DB2777" },
    { dot: "#3B82F6", bg: "#EFF6FF", text: "#2563EB" },
    { dot: "#F59E0B", bg: "#FFFBEB", text: "#D97706" },
  ];
  let h = 0;
  for (const c of dept) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return palette[h % palette.length];
}

function DeptBadge({ dept }: { dept: string | null }) {
  if (!dept) return <span style={{ fontSize: 12, color: "#94A3B8" }}>—</span>;
  const c = getDeptColor(dept);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: c.bg,
        borderRadius: 999,
        paddingBlock: 4,
        paddingInline: 9,
        fontFamily: manrope,
        fontSize: 11,
        fontWeight: 700,
        color: c.text,
        whiteSpace: "nowrap",
        letterSpacing: "0.04em",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: c.dot,
          flexShrink: 0,
        }}
      />
      {dept.toUpperCase()}
    </span>
  );
}

// ── Avatar ─────────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  "#14C4AE", "#6366F1", "#F97316", "#EC4899",
  "#3B82F6", "#F59E0B", "#22C55E", "#8B5CF6",
];
function avatarColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function Avatar({
  name,
  avatarUrl,
  size = 24,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: number;
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          border: "2px solid #fff",
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: avatarColor(name),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.36,
        fontWeight: 700,
        color: "#fff",
        border: "2px solid #fff",
        flexShrink: 0,
        fontFamily: manrope,
      }}
    >
      {initials(name)}
    </div>
  );
}

// ── Row menu ───────────────────────────────────────────────────────────────────
function RowMenu({
  project,
  onEdit,
  onDelete,
}: {
  project: ProjectRow;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState({ top: 0, right: 0 });
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node) &&
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen((p) => !p);
  }

  const menu = (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        top: pos.top,
        right: pos.right,
        zIndex: 9999,
        minWidth: 160,
        background: "#FFFFFF",
        border: "1px solid #E5EAEC",
        borderRadius: 12,
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        padding: "4px 0",
        fontFamily: manrope,
        fontSize: 13,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#F0F7F7] text-[#0F2A37] transition-colors"
        onClick={() => {
          setOpen(false);
          router.push(`/projects/${project.id}`);
        }}
      >
        <RiFolderLine className="size-4 text-[#7A8A93]" /> View
      </button>
      <button
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#F0F7F7] text-[#0F2A37] transition-colors"
        onClick={() => { setOpen(false); onEdit(); }}
      >
        <RiEditLine className="size-4 text-[#7A8A93]" /> Edit
      </button>
      <button
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#F0F7F7] text-[#0F2A37] transition-colors"
        onClick={() => setOpen(false)}
      >
        <RiArchiveLine className="size-4 text-[#7A8A93]" /> Archive
      </button>
      <div style={{ height: 1, background: "#E5EAEC", margin: "4px 0" }} />
      <button
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#FEF2F2] text-red-600 transition-colors"
        onClick={() => {
          setOpen(false);
          onDelete();
        }}
      >
        <RiDeleteBin2Line className="size-4" /> Delete
      </button>
    </div>
  );

  return (
    <div>
      <button
        ref={triggerRef}
        onClick={handleToggle}
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          background: open ? "#F0F7F7" : "transparent",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#F0F7F7")}
        onMouseLeave={(e) => {
          if (!open) e.currentTarget.style.background = "transparent";
        }}
      >
        <RiMoreLine style={{ width: 14, height: 14, color: "#4A5C66" }} />
      </button>
      {open &&
        typeof window !== "undefined" &&
        createPortal(menu, document.body)}
    </div>
  );
}

// ── Filter dropdown ────────────────────────────────────────────────────────────
function FilterDropdown({
  label,
  value,
  options,
  onChange,
  highlight = true,
}: {
  label: string;
  value: string;
  options: { key: string; label: string }[];
  onChange: (v: string) => void;
  highlight?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const current = options.find((o) => o.key === value)?.label ?? label;

  const triggerCls = [
    "inline-flex items-center justify-between gap-2 rounded-full border px-4 py-2 text-sm outline-none transition-all cursor-pointer whitespace-nowrap",
    open
      ? "border-primary ring-[3px] ring-primary/10 bg-white"
      : "border-border bg-white hover:border-foreground-muted/50",
  ].join(" ");

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className={triggerCls} style={{ fontFamily: manrope }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: "#7A8A93" }}>{label}:</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#0F2A37" }}>{current}</span>
          {open
            ? <RiArrowUpSLine size={14} className="text-foreground-muted shrink-0" />
            : <RiArrowDownSLine size={14} className="text-foreground-muted shrink-0" />}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
          style={{
            minWidth: 160,
            borderRadius: 12,
            boxShadow: "0px 8px 24px rgba(93,100,99,0.14)",
            border: "1px solid #DEE8E8",
            backgroundColor: "#FFFFFF",
            zIndex: 99999,
            outline: "none",
            padding: 6,
          }}
        >
          {options.map((o) => {
            const isActive = o.key === value;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => { onChange(o.key); setOpen(false); }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  gap: 8, padding: "8px 12px", borderRadius: 8, border: "none",
                  cursor: "pointer", fontFamily: manrope, fontSize: 13,
                  fontWeight: isActive ? 600 : 500, color: "#1B1B1B",
                  background: isActive ? "#EDF8F8" : "transparent",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "#F5FAFA"; }}
                onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = ""; }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 4, height: 16, borderRadius: 9999, background: isActive ? "#16DAC1" : "#DEE8E8", flexShrink: 0 }} />
                  {o.label}
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

// ── Sort dropdown ─────────────────────────────────────────────────────────────
function SortDropdown({
  sortBy,
  sortDir,
  setSortBy,
  setSortDir,
}: {
  sortBy: "name" | "due_date" | "progress" | "created_at";
  sortDir: "asc" | "desc";
  setSortBy: (v: "name" | "due_date" | "progress" | "created_at") => void;
  setSortDir: (v: "asc" | "desc") => void;
}) {
  const [open, setOpen] = React.useState(false);

  const SORT_OPTIONS: { key: "name" | "due_date" | "progress" | "created_at"; label: string }[] = [
    { key: "name",       label: "Name"     },
    { key: "due_date",   label: "Due date" },
    { key: "progress",   label: "Progress" },
    { key: "created_at", label: "Created"  },
  ];

  const currentLabel = SORT_OPTIONS.find((o) => o.key === sortBy)?.label ?? "Name";
  const dirArrow = sortDir === "asc" ? "↑" : "↓";

  const triggerCls = [
    "inline-flex items-center justify-between gap-2 rounded-full border px-4 py-2 text-sm outline-none transition-all cursor-pointer whitespace-nowrap",
    open
      ? "border-primary ring-[3px] ring-primary/10 bg-white"
      : "border-border bg-white hover:border-foreground-muted/50",
  ].join(" ");

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className={triggerCls} style={{ fontFamily: manrope }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: "#7A8A93" }}>Sort:</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#0F2A37" }}>{currentLabel} {dirArrow}</span>
          {open
            ? <RiArrowUpSLine size={14} className="text-foreground-muted shrink-0" />
            : <RiArrowDownSLine size={14} className="text-foreground-muted shrink-0" />}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
          style={{
            minWidth: 160,
            borderRadius: 12,
            boxShadow: "0px 8px 24px rgba(93,100,99,0.14)",
            border: "1px solid #DEE8E8",
            backgroundColor: "#FFFFFF",
            zIndex: 99999,
            outline: "none",
            padding: 6,
          }}
        >
          {SORT_OPTIONS.map((o) => {
            const isActive = o.key === sortBy;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => {
                  if (isActive) setSortDir(sortDir === "asc" ? "desc" : "asc");
                  else { setSortBy(o.key); setSortDir("asc"); }
                  setOpen(false);
                }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  gap: 8, padding: "8px 12px", borderRadius: 8, border: "none",
                  cursor: "pointer", fontFamily: manrope, fontSize: 13,
                  fontWeight: isActive ? 600 : 500, color: "#1B1B1B",
                  background: isActive ? "#EDF8F8" : "transparent",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "#F5FAFA"; }}
                onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = ""; }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 4, height: 16, borderRadius: 9999, background: isActive ? "#16DAC1" : "#DEE8E8", flexShrink: 0 }} />
                  {o.label}
                </span>
                {isActive && (
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#16DAC1" }}>{dirArrow}</span>
                    <RiCheckLine size={13} style={{ color: "#16DAC1" }} />
                  </span>
                )}
              </button>
            );
          })}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ── Project card ───────────────────────────────────────────────────────────────
function ProjectCard({
  project,
  onEdit,
  onDelete,
}: {
  project: ProjectRow;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const assignees = (
    Array.isArray(project.assignees) ? project.assignees : []
  ) as { id: string; name: string; avatar_url?: string | null }[];
  const visible = assignees.slice(0, 3);
  const extra = assignees.length - visible.length;
  const overdue =
    isOverdue(project.due_date) && project.status !== "done" && project.status !== "archived";

  const progressColor =
    project.progress >= 80
      ? "#22C55E"
      : project.progress >= 40
      ? "#14C4AE"
      : "#F59E0B";

  return (
    <div
      onClick={() => router.push(`/projects/${project.id}`)}
      style={{
        background: "#FFFFFF",
        border: "1px solid #E8EDEF",
        borderRadius: 16,
        padding: "18px 20px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        transition: "box-shadow 0.15s, border-color 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.08)";
        e.currentTarget.style.borderColor = "#C8D8DC";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.borderColor = "#E8EDEF";
      }}
    >
      {/* Top row: field + status + weekly update chip + 3-dot */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <DeptBadge dept={project.department} />
        <StatusBadge status={project.status} />
        {(project as any).needs_weekly_update && (
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            background: "#FFFBEB",
            border: "1px solid #FDE68A",
            borderRadius: 999,
            paddingBlock: 3,
            paddingInline: 8,
            fontSize: 11,
            fontWeight: 600,
            color: "#B45309",
            whiteSpace: "nowrap",
            fontFamily: manrope,
          }}>
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM8 5v3.5M8 10.5v.5" stroke="#D97706" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
            Need weekly update
          </span>
        )}
        <div style={{ flex: 1 }} />
        <div onClick={(e) => e.stopPropagation()}>
          <RowMenu project={project} onEdit={onEdit} onDelete={onDelete} />
        </div>
      </div>

      {/* Title + owner */}
      <div>
        <h3
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "#0F2A37",
            margin: 0,
            lineHeight: "22px",
            fontFamily: manrope,
          }}
        >
          {project.title}
        </h3>
        {project.owner_name && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 7,
            }}
          >
            <Avatar name={project.owner_name} size={20} />
            <span
              style={{
                fontSize: 12,
                color: "#7A8A93",
                fontFamily: manrope,
              }}
            >
              {project.owner_name}{" "}
              <span style={{ color: "#BCCDD4", fontWeight: 400 }}>owner</span>
            </span>
          </div>
        )}
      </div>

      {/* Progress */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 7,
          }}
        >
          <span style={{ fontSize: 11, color: "#94A3B8", fontFamily: manrope }}>
            Progress
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#374151",
              fontFamily: manrope,
            }}
          >
            {project.progress}%
          </span>
        </div>
        <div
          style={{
            height: 8,
            background: "#E8EDEF",
            borderRadius: 999,
          }}
        >
          <div
            style={{
              height: 8,
              borderRadius: 999,
              width: `${project.progress}%`,
              background: progressColor,
              transition: "width 0.3s",
            }}
          />
        </div>
      </div>

      {/* Meta grid: Sprint | Quarter | Start */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {(
          [
            ["SPRINT", project.sprint ?? "—"],
            ["QUARTER", project.quarter ?? "—"],
            ["START", fmtShort(project.start_date)],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.06em",
                color: "#BCCDD4",
                textTransform: "uppercase",
                fontFamily: manrope,
                marginBottom: 3,
              }}
            >
              {label}
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#4A5C66",
                fontFamily: manrope,
              }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Due date */}
      {project.due_date && (
        <div>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.06em",
              color: "#BCCDD4",
              textTransform: "uppercase",
              fontFamily: manrope,
              marginBottom: 3,
            }}
          >
            DUE
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: overdue ? "#EF4444" : "#4A5C66",
              fontFamily: manrope,
            }}
          >
            {fmtFull(project.due_date)}
          </div>
        </div>
      )}

      {/* Footer: assignees + project code */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 4,
          borderTop: "1px solid #F0F4F7",
        }}
      >
        {/* Assignee stack */}
        <div style={{ display: "flex", alignItems: "center" }}>
          {visible.map((a, i) => (
            <div
              key={a.id}
              style={{
                marginLeft: i > 0 ? -6 : 0,
                zIndex: visible.length - i,
              }}
            >
              <Avatar
                name={a.name}
                avatarUrl={a.avatar_url}
                size={24}
              />
            </div>
          ))}
          {extra > 0 && (
            <div
              style={{
                marginLeft: -6,
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: "#E5EAEC",
                border: "2px solid #fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 9,
                fontWeight: 700,
                color: "#7A8A93",
                zIndex: 0,
                fontFamily: manrope,
              }}
            >
              +{extra}
            </div>
          )}
          {visible.length === 0 && (
            <span style={{ fontSize: 11, color: "#C0CDD4", fontFamily: manrope }}>
              No assignees
            </span>
          )}
        </div>
        {/* Project code */}
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: "#AABBC2",
            fontFamily: manrope,
            letterSpacing: "0.04em",
          }}
        >
          {project.project_code}
        </span>
      </div>
    </div>
  );
}

// ── Date helpers ───────────────────────────────────────────────────────────────
function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); // Monday
  return d;
}

// ── Kanban columns config ──────────────────────────────────────────────────────
const KANBAN_COLS: { key: string; label: string; dotCls: string; colCls: string }[] = [
  { key: "backlog",     label: "Backlog",     dotCls: "bg-slate-400",  colCls: "bg-slate-50/60 border-slate-200"    },
  { key: "in_progress", label: "In Progress", dotCls: "bg-teal-400",   colCls: "bg-teal-50/30 border-teal-100/60"  },
  { key: "review",      label: "Review",      dotCls: "bg-amber-400",  colCls: "bg-amber-50/40 border-amber-100"   },
  { key: "done",        label: "Done",        dotCls: "bg-green-400",  colCls: "bg-green-50/30 border-green-100/60"},
];

// ── Kanban menu row ───────────────────────────────────────────────────────────
function KanbanMenuRow({
  icon, label, trailing, onClick, destructive, active,
}: {
  icon: React.ReactNode; label: string; trailing?: React.ReactNode;
  onClick: () => void; destructive?: boolean; active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${
        destructive
          ? "text-destructive hover:bg-destructive-subtle"
          : active
          ? "bg-background-subtle text-foreground"
          : "text-foreground hover:bg-background-subtle"
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1" style={{ fontFamily: manrope }}>{label}</span>
      {trailing && <span className="shrink-0">{trailing}</span>}
    </button>
  );
}

// ── Kanban card menu (3-dot) ──────────────────────────────────────────────────
function KanbanCardMenu({
  project, onEdit, onMove, onDelete,
}: {
  project: ProjectRow;
  onEdit: () => void;
  onMove: (status: string) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [showMove, setShowMove] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowMove(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const closeAll = () => { setOpen(false); setShowMove(false); };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); setShowMove(false); }}
        className="rounded-full p-1 hover:bg-background-subtle text-foreground-muted transition-colors opacity-0 group-hover:opacity-100"
      >
        <RiMore2Fill size={14} />
      </button>

      {open && (
        <div className="absolute right-0 top-6 z-50" onClick={(e) => e.stopPropagation()}>
          <div className="relative min-w-[180px] rounded-xl border border-border bg-background shadow-[0_8px_24px_rgba(0,0,0,0.08)] py-1.5">
            <KanbanMenuRow icon={<RiEditLine size={14} />} label="Open project" onClick={() => { closeAll(); onEdit(); }} />
            <KanbanMenuRow
              icon={<RiArrowRightLine size={14} />}
              label="Move to stage"
              trailing={<RiArrowRightLine size={12} className={`transition-colors ${showMove ? "text-primary" : "text-foreground-muted"}`} />}
              onClick={() => setShowMove((v) => !v)}
              active={showMove}
            />
            <div className="my-1 border-t border-border" />
            <KanbanMenuRow icon={<RiDeleteBin2Line size={14} />} label="Delete project" destructive onClick={() => { closeAll(); onDelete(); }} />

            {showMove && (
              <div className="absolute left-full top-0 ml-1 min-w-[180px] rounded-xl border border-border bg-background shadow-[0_8px_24px_rgba(0,0,0,0.10)] py-1.5 z-50">
                <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">Move to stage</p>
                {KANBAN_COLS.map((col) => (
                  <button
                    key={col.key}
                    onClick={() => { closeAll(); if (col.key !== project.status) onMove(col.key); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                      col.key === project.status ? "opacity-50 cursor-default" : "hover:bg-background-subtle"
                    }`}
                  >
                    <span className={`size-2 rounded-full ${col.dotCls}`} />
                    <span className="flex-1" style={{ fontFamily: manrope }}>{col.label}</span>
                    {col.key === project.status && (
                      <span className="text-[10px] border border-border rounded px-1 text-foreground-muted">CURRENT</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Kanban card ───────────────────────────────────────────────────────────────
function KanbanCard({
  project,
  isDragging,
  onDragStart,
  onDragEnd,
  onEdit,
  onMove,
  onDelete,
}: {
  project: ProjectRow;
  isDragging?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onEdit: () => void;
  onMove: (status: string) => void;
  onDelete: () => void;
}) {
  const overdue =
    project.due_date &&
    new Date(project.due_date) < new Date() &&
    project.status !== "done";

  const progressColor =
    project.progress >= 80 ? "#22C55E"
    : project.progress >= 40 ? "#14C4AE"
    : "#F59E0B";

  const assignees = (project.assignees ?? []) as { name: string }[];

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("projectId", project.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragEnd={onDragEnd}
      onClick={onEdit}
      className={`group rounded-xl border bg-background p-3 cursor-grab active:cursor-grabbing transition-all duration-200 ${
        isDragging
          ? "opacity-40 scale-95 rotate-1 shadow-none border-border"
          : "border-border hover:shadow-md hover:-translate-y-0.5"
      }`}
    >
      {/* Header: title + 3-dot menu */}
      <div className="flex items-start gap-2 mb-2.5">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight line-clamp-2" style={{ fontFamily: manrope, color: "#0F2A37" }}>
            {project.title}
          </p>
          <p className="text-[11px] mt-0.5 text-foreground-muted" style={{ fontFamily: manrope }}>
            {project.project_code}
          </p>
        </div>
        <KanbanCardMenu project={project} onEdit={onEdit} onMove={onMove} onDelete={onDelete} />
      </div>

      {/* Fields */}
      <div className="space-y-1.5 mb-2.5">
        {project.department && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted w-[80px] shrink-0" style={{ fontFamily: manrope }}>DEPT</span>
            <DeptBadge dept={project.department} />
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted w-[80px] shrink-0" style={{ fontFamily: manrope }}>OWNER</span>
          {project.owner_name ? (
            <div className="flex items-center gap-1.5">
              <Avatar name={project.owner_name} size={16} />
              <span className="text-[12px] text-foreground-muted truncate" style={{ fontFamily: manrope }}>
                {project.owner_name.split(" ")[0]}{project.owner_name.split(" ")[1]?.[0] ? ` ${project.owner_name.split(" ")[1][0]}.` : ""}
              </span>
            </div>
          ) : (
            <span className="text-[12px] text-foreground-muted">—</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted w-[80px] shrink-0" style={{ fontFamily: manrope }}>DUE</span>
          {project.due_date ? (
            <span className={`text-[12px] font-medium flex items-center gap-1 ${overdue ? "text-red-500" : "text-foreground-muted"}`} style={{ fontFamily: manrope }}>
              {overdue && <RiCalendarLine size={11} />}
              {fmtShort(project.due_date)}
            </span>
          ) : (
            <span className="text-[12px] text-foreground-muted">—</span>
          )}
        </div>
      </div>

      {/* Footer: progress bar + quarter */}
      <div className="pt-2 border-t border-border/60">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-semibold text-foreground-muted" style={{ fontFamily: manrope }}>{project.progress}%</span>
          <div className="flex items-center gap-1">
            {assignees.slice(0, 3).map((a, i) => (
              <Avatar key={i} name={a.name} size={16} />
            ))}
            {assignees.length > 3 && (
              <span className="text-[10px] text-foreground-muted font-semibold" style={{ fontFamily: manrope }}>+{assignees.length - 3}</span>
            )}
            {project.quarter && (
              <span className="text-[10px] text-foreground-muted ml-1" style={{ fontFamily: manrope }}>{project.quarter}</span>
            )}
          </div>
        </div>
        <div className="h-2 rounded-full bg-border/60 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${project.progress}%`, background: progressColor }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Kanban column header ──────────────────────────────────────────────────────
function KanbanColHeader({
  col, count, onAdd,
}: {
  col: (typeof KANBAN_COLS)[number];
  count: number;
  onAdd: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-3 shrink-0">
      <div className="flex items-center gap-2">
        <span className={`size-2 rounded-full ${col.dotCls}`} />
        <span className="text-sm font-semibold" style={{ fontFamily: manrope }}>{col.label}</span>
        {count > 0 && (
          <span className="text-xs font-semibold bg-background-subtle border border-border rounded-full px-2 py-0.5" style={{ fontFamily: manrope }}>
            {count}
          </span>
        )}
      </div>
      <button
        onClick={onAdd}
        className="size-6 flex items-center justify-center rounded-full hover:bg-background-subtle text-foreground-muted transition-colors"
      >
        <RiAddLine size={14} />
      </button>
    </div>
  );
}

// ── Kanban view ───────────────────────────────────────────────────────────────
function KanbanView({
  projects,
  onNavigate,
  onNewProject,
  onMove,
  onDelete,
}: {
  projects: ProjectRow[];
  onNavigate: (id: string) => void;
  onNewProject: () => void;
  onMove: (project: ProjectRow, newStatus: string) => void;
  onDelete: (project: ProjectRow) => void;
}) {
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [overCol, setOverCol] = React.useState<string | null>(null);
  const enterCounters = React.useRef<Partial<Record<string, number>>>({});

  const grouped = React.useMemo(() => {
    const m: Record<string, ProjectRow[]> = {};
    for (const col of KANBAN_COLS) m[col.key] = [];
    for (const p of projects) {
      if (m[p.status]) m[p.status].push(p);
    }
    return m;
  }, [projects]);

  function handleDragEnter(colKey: string) {
    enterCounters.current[colKey] = (enterCounters.current[colKey] ?? 0) + 1;
    setOverCol(colKey);
  }
  function handleDragLeave(colKey: string) {
    enterCounters.current[colKey] = (enterCounters.current[colKey] ?? 1) - 1;
    if ((enterCounters.current[colKey] ?? 0) <= 0) {
      enterCounters.current[colKey] = 0;
      setOverCol((prev) => (prev === colKey ? null : prev));
    }
  }
  function handleDrop(e: React.DragEvent, colKey: string) {
    e.preventDefault();
    const projectId = e.dataTransfer.getData("projectId");
    const dragged = projects.find((p) => p.id === projectId);
    if (dragged && dragged.status !== colKey) onMove(dragged, colKey);
    setDraggingId(null);
    setOverCol(null);
    enterCounters.current = {};
  }
  function handleDragEnd() {
    setDraggingId(null);
    setOverCol(null);
    enterCounters.current = {};
  }

  const isDraggingAny = draggingId !== null;

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-220px)]">
      {KANBAN_COLS.map((col) => {
        const cards = grouped[col.key] ?? [];
        const isOver = overCol === col.key;
        const isSameCol = draggingId ? projects.find((p) => p.id === draggingId)?.status === col.key : false;

        return (
          <div
            key={col.key}
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={() => handleDragEnter(col.key)}
            onDragLeave={() => handleDragLeave(col.key)}
            onDrop={(e) => handleDrop(e, col.key)}
            className={`flex flex-col shrink-0 rounded-2xl p-3 border transition-all duration-200 w-[280px] ${col.colCls} ${
              isOver && !isSameCol
                ? "ring-2 ring-primary ring-inset !border-primary/40 scale-[1.01] shadow-lg"
                : isDraggingAny && !isSameCol
                ? "opacity-80"
                : ""
            }`}
          >
            <KanbanColHeader col={col} count={cards.length} onAdd={onNewProject} />

            <div className="flex flex-col gap-2 flex-1">
              {isOver && !isSameCol && (
                <div className="h-1.5 rounded-full bg-primary/40 animate-pulse mx-1" />
              )}

              {cards.length === 0 ? (
                isDraggingAny && !isSameCol ? (
                  <div className={`flex-1 min-h-[80px] rounded-xl border-2 border-dashed flex items-center justify-center transition-all duration-200 ${
                    isOver ? "border-primary bg-primary/5 text-primary scale-[1.02]" : "border-border/40 text-foreground-muted"
                  }`}>
                    <p className="text-xs font-semibold" style={{ fontFamily: manrope }}>{isOver ? "↓ Drop here" : ""}</p>
                  </div>
                ) : (
                  <div className="flex-1 rounded-xl border-2 border-dashed border-border/50 flex flex-col items-center justify-center text-center gap-2 min-h-[100px] p-4">
                    <p className="text-xs text-foreground-muted" style={{ fontFamily: manrope }}>No projects in this stage.</p>
                    <button onClick={onNewProject} className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline transition-colors">
                      <RiAddLine size={12} /> Add project
                    </button>
                  </div>
                )
              ) : (
                cards.map((p) => (
                  <KanbanCard
                    key={p.id}
                    project={p}
                    isDragging={draggingId === p.id}
                    onDragStart={() => setDraggingId(p.id)}
                    onDragEnd={handleDragEnd}
                    onEdit={() => onNavigate(p.id)}
                    onMove={(newStatus) => onMove(p, newStatus)}
                    onDelete={() => onDelete(p)}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Timeline view ──────────────────────────────────────────────────────────────
const TIMELINE_BAR_COLORS: Record<string, string> = {
  in_progress: "#14C4AE",
  review:      "#F59E0B",
  done:        "#22C55E",
  backlog:     "#94A3B8",
  archived:    "#CBD5E1",
};

function TimelineView({
  projects,
  offsetWeeks,
  scale,
}: {
  projects: ProjectRow[];
  offsetWeeks: number;
  scale: "week" | "month";
}) {
  const today = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const COL_W  = scale === "week" ? 150 : 200;
  const LEFT_W = 220;
  const ROW_H  = 58;
  const NUM_COLS = scale === "week" ? 10 : 6;

  // Timeline start
  const tlStart = React.useMemo(() => {
    if (scale === "week") {
      const base = startOfWeek(today);
      base.setDate(base.getDate() - 14 + offsetWeeks * 7);
      return base;
    } else {
      const base = new Date(today.getFullYear(), today.getMonth() - 2, 1);
      base.setMonth(base.getMonth() + offsetWeeks);
      return base;
    }
  }, [today, offsetWeeks, scale]);

  // Generate columns
  const cols = React.useMemo(() => {
    return Array.from({ length: NUM_COLS }, (_, i) => {
      let d: Date;
      let label: string;
      let isNow: boolean;

      if (scale === "week") {
        d = new Date(tlStart);
        d.setDate(d.getDate() + i * 7);
        const mo = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
        const wk = Math.ceil(d.getDate() / 7);
        isNow = today >= d && today < new Date(d.getTime() + 7 * 86400_000);
        label = isNow ? `${mo} W${wk} · NOW` : `${mo} W${wk}`;
      } else {
        d = new Date(tlStart.getFullYear(), tlStart.getMonth() + i, 1);
        const mo = d.toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        }).toUpperCase();
        isNow = today.getFullYear() === d.getFullYear() && today.getMonth() === d.getMonth();
        label = isNow ? mo + " · NOW" : mo;
      }

      return { date: d, label, isNow };
    });
  }, [tlStart, NUM_COLS, scale, today]);

  const tlEnd = React.useMemo(() => {
    if (scale === "week") {
      const d = new Date(tlStart);
      d.setDate(d.getDate() + NUM_COLS * 7);
      return d;
    } else {
      return new Date(tlStart.getFullYear(), tlStart.getMonth() + NUM_COLS, 1);
    }
  }, [tlStart, NUM_COLS, scale]);

  const totalMs = tlEnd.getTime() - tlStart.getTime();
  const totalW  = NUM_COLS * COL_W;

  function dateToX(date: Date): number {
    return ((date.getTime() - tlStart.getTime()) / totalMs) * totalW;
  }

  const todayX = dateToX(today);

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E5EAEC",
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      {/* Sticky header */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid #E5EAEC",
          background: "#F8FAFB",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        {/* Left: project label */}
        <div
          style={{
            width: LEFT_W,
            flexShrink: 0,
            padding: "11px 16px",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.07em",
            color: "#94A3B8",
            textTransform: "uppercase",
            borderRight: "1px solid #E5EAEC",
            fontFamily: manrope,
          }}
        >
          Project
        </div>

        {/* Timeline columns */}
        <div
          style={{
            display: "flex",
            position: "relative",
            overflowX: "hidden",
            flex: "0 0 auto",
            width: totalW,
          }}
        >
          {cols.map((col, i) => (
            <div
              key={i}
              style={{
                width: COL_W,
                flexShrink: 0,
                padding: "11px 0",
                textAlign: "center",
                fontSize: 11,
                fontWeight: col.isNow ? 700 : 500,
                color: col.isNow ? "#0F2A37" : "#94A3B8",
                borderLeft: i > 0 ? "1px solid #E8EDEF" : "none",
                fontFamily: manrope,
              }}
            >
              {col.label}
            </div>
          ))}

          {/* TODAY pill label */}
          {todayX >= 0 && todayX <= totalW && (
            <div
              style={{
                position: "absolute",
                top: 2,
                left: todayX,
                transform: "translateX(-50%)",
                background: "#EF4444",
                color: "#FFFFFF",
                fontSize: 9,
                fontWeight: 700,
                borderRadius: 999,
                padding: "2px 7px",
                whiteSpace: "nowrap",
                letterSpacing: "0.05em",
                pointerEvents: "none",
                fontFamily: manrope,
              }}
            >
              TODAY ·{" "}
              {today
                .toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
                .toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: LEFT_W + totalW }}>
          {projects.map((p, rowIdx) => {
            const hasStart = !!p.start_date;
            const hasEnd   = !!p.due_date;
            const isDashed = !hasStart || !hasEnd;

            let barL = todayX;
            let barW = COL_W * 0.8;

            if (hasStart && hasEnd) {
              const s = new Date(p.start_date!);
              const e = new Date(p.due_date!);
              barL = dateToX(s);
              barW = Math.max(28, dateToX(e) - barL);
            }

            const bc = TIMELINE_BAR_COLORS[p.status] ?? "#94A3B8";
            const isOverdueBar =
              p.due_date &&
              new Date(p.due_date) < today &&
              p.status !== "done";
            const finalColor = isOverdueBar ? "#F87171" : bc;

            return (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  height: ROW_H,
                  borderBottom: "1px solid #F0F4F7",
                  background: rowIdx % 2 === 0 ? "#FFFFFF" : "#FAFCFC",
                }}
              >
                {/* Name column */}
                <div
                  style={{
                    width: LEFT_W,
                    flexShrink: 0,
                    borderRight: "1px solid #E8EDEF",
                    padding: "0 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: finalColor,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#0F2A37",
                        fontFamily: manrope,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: LEFT_W - 52,
                      }}
                    >
                      {p.title}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "#94A3B8",
                        fontFamily: manrope,
                      }}
                    >
                      {p.owner_name ? `${p.owner_name.split(" ")[0]} ${p.owner_name.split(" ")[1]?.[0] ?? ""}.` : "—"}
                    </div>
                  </div>
                </div>

                {/* Gantt area */}
                <div
                  style={{
                    position: "relative",
                    width: totalW,
                    flexShrink: 0,
                    height: ROW_H,
                  }}
                >
                  {/* Grid lines */}
                  {cols.map((_, ci) =>
                    ci > 0 ? (
                      <div
                        key={ci}
                        style={{
                          position: "absolute",
                          left: ci * COL_W,
                          top: 0,
                          bottom: 0,
                          width: 1,
                          background: "#F0F4F7",
                        }}
                      />
                    ) : null
                  )}

                  {/* Today line */}
                  {todayX >= 0 && todayX <= totalW && (
                    <div
                      style={{
                        position: "absolute",
                        left: todayX,
                        top: 0,
                        bottom: 0,
                        width: 1.5,
                        background: "#FCA5A5",
                        zIndex: 1,
                      }}
                    />
                  )}

                  {/* Gantt bar */}
                  <div
                    style={{
                      position: "absolute",
                      left: Math.max(0, barL),
                      top: "50%",
                      transform: "translateY(-50%)",
                      height: 30,
                      width:
                        barL < 0
                          ? Math.max(0, barW + barL)
                          : barW,
                      background: isDashed
                        ? "transparent"
                        : finalColor,
                      border: isDashed
                        ? `1.5px dashed ${finalColor}`
                        : "none",
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      paddingInline: 10,
                      overflow: "hidden",
                      zIndex: 2,
                      cursor: "default",
                    }}
                  >
                    {(isDashed ? barW > 80 : barW > 60) && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: isDashed ? finalColor : "#FFFFFF",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          fontFamily: manrope,
                        }}
                      >
                        {isDashed
                          ? `${STATUS_MAP[p.status]?.label ?? p.status}${p.due_date ? " · " + fmtShort(p.due_date) : ""}`
                          : `${p.progress}%${p.sprint ? " · " + p.sprint : ""}`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────
type ActiveTab = "all" | "backlog" | "in_progress" | "review" | "done" | "archived";
type ViewMode = "cards" | "list" | "kanban" | "timeline";

// ── Page ───────────────────────────────────────────────────────────────────────
export default function ProjectsPage() {
  const { workspaceId, loading: wsLoading } = useWorkspace();
  const router = useRouter();
  const { showToast } = useToast();

  const [allProjects, setAllProjects] = React.useState<ProjectRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<ActiveTab>("all");
  const [viewMode, setViewMode] = React.useState<ViewMode>("cards");
  const [myProjectOnly, setMyProjectOnly] = React.useState(true);
  const [timelineOffset, setTimelineOffset] = React.useState(0);
  const [timelineScale, setTimelineScale] = React.useState<"week" | "month">("week");
  const [search, setSearch] = React.useState("");
  const [deptFilter, setDeptFilter] = React.useState("all");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editProject, setEditProject] = React.useState<ProjectRow | null>(null);
  const [deleteProject, setDeleteProject] = React.useState<ProjectRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [sortBy, setSortBy] = React.useState<"name" | "due_date" | "progress" | "created_at">("name");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");
  const [filterPanelOpen, setFilterPanelOpen] = React.useState(false);
  const filterPanelRef = React.useRef<HTMLDivElement>(null);

  // Close filter panel on outside click
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (filterPanelRef.current && !filterPanelRef.current.contains(e.target as Node)) {
        setFilterPanelOpen(false);
      }
    }
    if (filterPanelOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [filterPanelOpen]);

  // Get current user for "Mine" tab
  React.useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setCurrentUserId(data.user?.id ?? null))
      .catch(() => {});
  }, []);

  const fetchProjects = React.useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/projects?workspace_id=${workspaceId}&limit=100`
      );
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setAllProjects(json.projects ?? []);
    } catch (err) {
      showToast({
        title: "Error loading projects",
        subtitle: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [workspaceId, showToast]);

  React.useEffect(() => {
    if (!wsLoading && workspaceId) fetchProjects();
  }, [wsLoading, workspaceId, fetchProjects]);

  // Unique departments for filter dropdown
  const uniqueDepts = React.useMemo(
    () => [...new Set(allProjects.map((p) => p.department).filter(Boolean) as string[])].sort(),
    [allProjects]
  );

  // Tab counts — mengikuti filter My/Team project
  const tabCounts = React.useMemo(() => {
    let base = allProjects;
    if (myProjectOnly && currentUserId) {
      base = base.filter(
        (p) =>
          p.owner_id === currentUserId ||
          (p.assignee_ids as string[] | null)?.includes(currentUserId)
      );
    }
    return {
      all:         base.filter((p) => p.status !== "archived").length,
      backlog:     base.filter((p) => p.status === "backlog").length,
      in_progress: base.filter((p) => p.status === "in_progress").length,
      review:      base.filter((p) => p.status === "review").length,
      done:        base.filter((p) => p.status === "done").length,
      archived:    base.filter((p) => p.status === "archived").length,
    };
  }, [allProjects, myProjectOnly, currentUserId]);

  // Apply tab + filters + search
  const filtered = React.useMemo(() => {
    let r = allProjects;
    if (activeTab === "all")         r = r.filter((p) => p.status !== "archived");
    if (activeTab === "backlog")     r = r.filter((p) => p.status === "backlog");
    if (activeTab === "in_progress") r = r.filter((p) => p.status === "in_progress");
    if (activeTab === "review")      r = r.filter((p) => p.status === "review");
    if (activeTab === "done")        r = r.filter((p) => p.status === "done");
    if (activeTab === "archived")    r = r.filter((p) => p.status === "archived");
    // My Project filter: owner or assignee is current user
    if (myProjectOnly && currentUserId) {
      r = r.filter(
        (p) =>
          p.owner_id === currentUserId ||
          (p.assignee_ids as string[] | null)?.includes(currentUserId)
      );
    }
    if (deptFilter !== "all")    r = r.filter((p) => p.department === deptFilter);
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.owner_name?.toLowerCase().includes(q) ||
          p.project_code.toLowerCase().includes(q) ||
          p.sprint?.toLowerCase().includes(q)
      );
    }
    // Sort
    r = [...r].sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name") cmp = a.title.localeCompare(b.title);
      else if (sortBy === "due_date") {
        const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
        cmp = da - db;
      } else if (sortBy === "progress") cmp = a.progress - b.progress;
      else if (sortBy === "created_at") cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [allProjects, activeTab, currentUserId, myProjectOnly, deptFilter, search, sortBy, sortDir]);

  function handleDelete(project: ProjectRow) {
    setDeleteProject(project);
  }

  async function confirmDelete() {
    if (!workspaceId || !deleteProject) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/projects/${deleteProject.id}?workspace_id=${workspaceId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed");
      showToast({ title: "Project deleted" });
      setDeleteProject(null);
      fetchProjects();
    } catch (err) {
      showToast({
        title: "Error",
        subtitle: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setDeleting(false);
    }
  }

  async function handleMoveStatus(project: ProjectRow, newStatus: string) {
    if (!workspaceId) return;
    // Optimistic update
    setAllProjects((prev) =>
      prev.map((p) => (p.id === project.id ? { ...p, status: newStatus as ProjectRow["status"] } : p))
    );
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId, status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
    } catch (err) {
      // Rollback
      fetchProjects();
      showToast({ title: "Error", subtitle: err instanceof Error ? err.message : undefined });
    }
  }

  const TABS: { key: ActiveTab; label: string }[] = [
    { key: "all",         label: "All"         },
    { key: "backlog",     label: "Backlog"      },
    { key: "in_progress", label: "In Progress"  },
    { key: "review",      label: "Review"       },
    { key: "done",        label: "Done"         },
    { key: "archived",    label: "Archived"     },
  ];

  const deptOptions = [
    { key: "all", label: "All" },
    ...uniqueDepts.map((d) => ({ key: d, label: d })),
  ];

  function exportCSV() {
    const headers = ["Title", "Code", "Department", "Status", "Owner", "Sprint", "Quarter", "Progress", "Start Date", "Due Date", "Created At"];
    const rows = filtered.map(p => [
      `"${p.title.replace(/"/g, '""')}"`,
      p.project_code,
      p.department ?? "",
      p.status,
      p.owner_name ?? "",
      p.sprint ?? "",
      p.quarter ?? "",
      `${p.progress}%`,
      p.start_date ?? "",
      p.due_date ?? "",
      p.created_at.slice(0, 10),
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `projects-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        paddingBlock: 32,
        paddingInline: 40,
        gap: 24,
        background: "#F8FAFB",
        minHeight: "100vh",
        fontFamily: manrope,
      }}
    >
      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#AABBC2",
              margin: 0,
              marginBottom: 4,
            }}
          >
            WORKSPACE · PROJECT MANAGEMENT
          </p>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 800,
              color: "#0F2A37",
              lineHeight: "40px",
              margin: 0,
              fontFamily: manrope,
            }}
          >
            Projects
          </h1>
          <p style={{ fontSize: 13, color: "#7A8A93", margin: 0, marginTop: 6 }}>
            Track every project, sprint, task, and weekly status update across the team.
          </p>
        </div>

        {/* Header actions */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
            paddingTop: 8,
          }}
        >
          <button
            onClick={exportCSV}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              paddingBlock: 9,
              paddingInline: 14,
              background: "#FFFFFF",
              border: "1px solid #E5EAEC",
              borderRadius: 10,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              color: "#374151",
              fontFamily: manrope,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#F8FAFB")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#FFFFFF")}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v7M4 6.5L7 9.5L10 6.5M2 11h10" stroke="#7A8A93" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Export CSV
          </button>
          <div style={{ position: "relative" }} ref={filterPanelRef}>
            {/* Filters button */}
            {(() => {
              const activeCount = [
                viewMode !== "cards",
                deptFilter !== "all",
                sortBy !== "name" || sortDir !== "asc",
                search.trim() !== "",
              ].filter(Boolean).length;
              return (
                <button
                  onClick={() => setFilterPanelOpen((o) => !o)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    paddingBlock: 9,
                    paddingInline: 14,
                    background: filterPanelOpen ? "#F0FDFB" : "#FFFFFF",
                    border: filterPanelOpen ? "1px solid #16DAC1" : "1px solid #E5EAEC",
                    borderRadius: 10,
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                    color: filterPanelOpen ? "#0F9D8A" : "#374151",
                    fontFamily: manrope,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M1.5 3.5h11M3.5 7h7M5.5 10.5h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                  Filters
                  {activeCount > 0 && (
                    <span style={{
                      background: "#16DAC1",
                      color: "#fff",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 700,
                      minWidth: 18,
                      height: 18,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      paddingInline: 4,
                    }}>
                      {activeCount}
                    </span>
                  )}
                </button>
              );
            })()}

            {/* Filter dropdown panel */}
            {filterPanelOpen && (
              <div style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                background: "#FFFFFF",
                border: "1px solid #E8EDEF",
                borderRadius: 16,
                boxShadow: "0 12px 32px rgba(15,42,55,0.12), 0 2px 8px rgba(15,42,55,0.06)",
                zIndex: 50,
                width: 360,
                overflow: "hidden",
              }}>
                {/* Panel header */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "14px 16px 12px",
                  borderBottom: "1px solid #F1F5F7",
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0F2A37", fontFamily: manrope }}>Filters</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {(viewMode !== "cards" || deptFilter !== "all" || sortBy !== "name" || sortDir !== "asc" || search) && (
                      <button
                        onClick={() => { setViewMode("cards"); setDeptFilter("all"); setSortBy("name"); setSortDir("asc"); setSearch(""); }}
                        style={{
                          fontSize: 12, fontWeight: 600, color: "#16DAC1",
                          background: "none", border: "none", cursor: "pointer",
                          padding: "2px 8px", borderRadius: 6, fontFamily: manrope,
                          lineHeight: "20px",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#F0FDFB")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                      >
                        Reset
                      </button>
                    )}
                    <button
                      onClick={() => setFilterPanelOpen(false)}
                      style={{
                        width: 24, height: 24, borderRadius: 6, border: "none",
                        background: "#F1F5F7", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#7A8A93", flexShrink: 0,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#E5EAEC")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "#F1F5F7")}
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>
                </div>

                <div style={{ padding: "4px 0 8px" }}>
                  {/* Search */}
                  <div style={{ padding: "10px 16px 2px" }}>
                    <div style={{ position: "relative" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                        <circle cx="11" cy="11" r="8" stroke="#B0BFC8" strokeWidth="2"/>
                        <path d="M21 21l-4.35-4.35" stroke="#B0BFC8" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      <input
                        type="text"
                        placeholder="Search projects, owner, sprint…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        autoFocus
                        style={{
                          width: "100%", boxSizing: "border-box",
                          paddingBlock: 8, paddingLeft: 32, paddingRight: 12,
                          background: "#F8FAFB", border: "1px solid #E8EDEF",
                          borderRadius: 9, fontSize: 13, fontWeight: 500,
                          color: "#0F2A37", outline: "none", fontFamily: manrope,
                          transition: "border-color 0.15s",
                        }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = "#16DAC1")}
                        onBlur={(e) => (e.currentTarget.style.borderColor = "#E8EDEF")}
                      />
                      {search && (
                        <button
                          onClick={() => setSearch("")}
                          style={{
                            position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                            background: "#CBD5E1", border: "none", borderRadius: "50%",
                            width: 16, height: 16, cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "#fff", flexShrink: 0,
                          }}
                        >
                          <svg width="7" height="7" viewBox="0 0 10 10" fill="none">
                            <path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Divider */}
                  <div style={{ height: 1, background: "#F1F5F7", margin: "12px 0 0" }} />

                  {/* View */}
                  <div style={{ padding: "12px 16px 4px" }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: "#B0BFC8", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: manrope, margin: "0 0 8px" }}>View</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                      {([
                        { key: "cards",    label: "Cards",    icon: <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="8" y="1" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="1" y="8" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="8" y="8" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.3"/></svg> },
                        { key: "list",     label: "List",     icon: <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M1.5 3.5h11M1.5 7h11M1.5 10.5h11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg> },
                        { key: "kanban",   label: "Kanban",   icon: <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="3.5" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="5.25" y="1" width="3.5" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="9.5" y="1" width="3.5" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3"/></svg> },
                        { key: "timeline", label: "Timeline", icon: <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M1.5 4h5M1.5 7h9M1.5 10h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><circle cx="8" cy="4" r="1.2" fill="currentColor"/><circle cx="12" cy="7" r="1.2" fill="currentColor"/><circle cx="10" cy="10" r="1.2" fill="currentColor"/></svg> },
                      ] as { key: ViewMode; label: string; icon: React.ReactNode }[]).map(({ key, label, icon }) => {
                        const isActive = viewMode === key;
                        return (
                          <button key={key} onClick={() => setViewMode(key)} style={{
                            display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                            paddingBlock: 9, paddingInline: 4,
                            borderRadius: 10, border: "1.5px solid",
                            borderColor: isActive ? "#16DAC1" : "#E8EDEF",
                            background: isActive ? "#F0FDFB" : "#FAFBFC",
                            color: isActive ? "#0C8A7C" : "#7A8A93",
                            fontSize: 11, fontWeight: isActive ? 700 : 500,
                            cursor: "pointer", fontFamily: manrope,
                            transition: "all 0.12s",
                          }}
                          onMouseEnter={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.borderColor = "#C5E8E4"; (e.currentTarget as HTMLElement).style.background = "#F5FDFB"; } }}
                          onMouseLeave={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.borderColor = "#E8EDEF"; (e.currentTarget as HTMLElement).style.background = "#FAFBFC"; } }}
                          >
                            {icon}
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Divider */}
                  <div style={{ height: 1, background: "#F1F5F7", margin: "12px 0 0" }} />

                  {/* Department */}
                  {uniqueDepts.length > 0 && (
                    <div style={{ padding: "12px 16px 4px" }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: "#B0BFC8", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: manrope, margin: "0 0 8px" }}>Department</p>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {[{ key: "all", label: "All" }, ...uniqueDepts.map((d) => ({ key: d, label: d }))].map(({ key, label }) => {
                          const isActive = deptFilter === key;
                          return (
                            <button key={key} onClick={() => setDeptFilter(key)} style={{
                              paddingBlock: 5, paddingInline: 11,
                              borderRadius: 20, border: "1.5px solid",
                              borderColor: isActive ? "#16DAC1" : "#E8EDEF",
                              background: isActive ? "#F0FDFB" : "#FAFBFC",
                              color: isActive ? "#0C8A7C" : "#4A5C66",
                              fontSize: 12, fontWeight: isActive ? 700 : 500,
                              cursor: "pointer", fontFamily: manrope,
                              transition: "all 0.12s",
                            }}
                            onMouseEnter={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.borderColor = "#C5E8E4"; (e.currentTarget as HTMLElement).style.background = "#F5FDFB"; } }}
                            onMouseLeave={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.borderColor = "#E8EDEF"; (e.currentTarget as HTMLElement).style.background = "#FAFBFC"; } }}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Divider */}
                  <div style={{ height: 1, background: "#F1F5F7", margin: "12px 0 0" }} />

                  {/* Sort */}
                  <div style={{ padding: "12px 16px 8px" }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: "#B0BFC8", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: manrope, margin: "0 0 8px" }}>Sort by</p>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {([
                        { key: "name",       label: "Name"     },
                        { key: "due_date",   label: "Due date" },
                        { key: "progress",   label: "Progress" },
                        { key: "created_at", label: "Created"  },
                      ] as { key: typeof sortBy; label: string }[]).map(({ key, label }) => {
                        const isActive = sortBy === key;
                        return (
                          <button key={key} onClick={() => {
                            if (isActive) setSortDir((d) => d === "asc" ? "desc" : "asc");
                            else { setSortBy(key); setSortDir("asc"); }
                          }} style={{
                            display: "flex", alignItems: "center", gap: 4,
                            paddingBlock: 5, paddingInline: 11,
                            borderRadius: 20, border: "1.5px solid",
                            borderColor: isActive ? "#16DAC1" : "#E8EDEF",
                            background: isActive ? "#F0FDFB" : "#FAFBFC",
                            color: isActive ? "#0C8A7C" : "#4A5C66",
                            fontSize: 12, fontWeight: isActive ? 700 : 500,
                            cursor: "pointer", fontFamily: manrope,
                            transition: "all 0.12s",
                          }}
                          onMouseEnter={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.borderColor = "#C5E8E4"; (e.currentTarget as HTMLElement).style.background = "#F5FDFB"; } }}
                          onMouseLeave={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.borderColor = "#E8EDEF"; (e.currentTarget as HTMLElement).style.background = "#FAFBFC"; } }}
                          >
                            {label}
                            {isActive && (
                              <span style={{
                                display: "inline-flex", alignItems: "center", justifyContent: "center",
                                width: 14, height: 14, borderRadius: "50%",
                                background: "#16DAC1", color: "#fff", fontSize: 9, fontWeight: 800,
                              }}>
                                {sortDir === "asc" ? "↑" : "↓"}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              paddingBlock: 9,
              paddingInline: 18,
              background: "#16DAC1",
              border: "none",
              borderRadius: 999,
              cursor: "pointer",
              boxShadow: "#14C4AE47 0px 6px 14px",
              fontSize: 13,
              fontWeight: 700,
              color: "#FFFFFF",
              fontFamily: manrope,
            }}
          >
            <RiAddLine style={{ width: 14, height: 14 }} />
            New project
          </button>
        </div>
      </div>

      {/* ── Toolbar: tabs + view toggle + filters + search ───────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        {/* Status tabs */}
        <div className="flex items-center rounded-full border border-border bg-background-subtle p-1 gap-0.5">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const count = tabCounts[tab.key];
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 rounded-full text-sm font-medium transition-colors ${
                  isActive ? "bg-background shadow-sm text-foreground" : "text-foreground-muted hover:text-foreground"
                }`}
                style={{ fontFamily: manrope, height: 32, lineHeight: "32px" }}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    className={`text-xs font-bold rounded-full px-1.5 min-w-[18px] text-center leading-none ${
                      isActive ? "bg-background-subtle text-foreground-muted" : "text-foreground-muted/50"
                    }`}
                    style={{ lineHeight: "18px", display: "inline-block" }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* My Project / Team Project toggle */}
          <div className="flex items-center rounded-full border border-border bg-background-subtle p-1">
            <button
              onClick={() => setMyProjectOnly(true)}
              className={`flex items-center gap-1.5 px-3 rounded-full text-sm font-medium transition-colors ${
                myProjectOnly ? "bg-background shadow-sm text-foreground" : "text-foreground-muted hover:text-foreground"
              }`}
              style={{ fontFamily: manrope, height: 32 }}
            >
              <RiUserLine size={14} /> My project
            </button>
            <button
              onClick={() => setMyProjectOnly(false)}
              className={`flex items-center gap-1.5 px-3 rounded-full text-sm font-medium transition-colors ${
                !myProjectOnly ? "bg-background shadow-sm text-foreground" : "text-foreground-muted hover:text-foreground"
              }`}
              style={{ fontFamily: manrope, height: 32 }}
            >
              <RiTeamLine size={14} /> Team project
            </button>
          </div>

        </div>
      </div>

      {/* ── Timeline controls (only in timeline view) ────────────────────── */}
      {viewMode === "timeline" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Scale toggle */}
          <div style={{ display: "flex", background: "#EAEEF0", borderRadius: 8, padding: 3, gap: 2 }}>
            {(["week", "month"] as const).map((s) => (
              <button
                key={s}
                onClick={() => { setTimelineScale(s); setTimelineOffset(0); }}
                style={{
                  paddingBlock: 5, paddingInline: 12, borderRadius: 6, border: "none", cursor: "pointer",
                  background: timelineScale === s ? "#FFFFFF" : "transparent",
                  boxShadow: timelineScale === s ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                  fontSize: 12, fontWeight: timelineScale === s ? 700 : 500,
                  color: timelineScale === s ? "#0F2A37" : "#94A3B8", fontFamily: manrope,
                }}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <button
            onClick={() => setTimelineOffset((o) => o - 1)}
            style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #E5EAEC", background: "#FFFFFF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#4A5C66" }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M7.5 2L3.5 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <button
            onClick={() => setTimelineOffset(0)}
            style={{ paddingBlock: 6, paddingInline: 14, borderRadius: 8, border: "1px solid #E5EAEC", background: "#FFFFFF", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#0F2A37", fontFamily: manrope }}
          >
            Today
          </button>
          <button
            onClick={() => setTimelineOffset((o) => o + 1)}
            style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #E5EAEC", background: "#FFFFFF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#4A5C66" }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 2L8.5 6l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      )}

      {/* ── Content area ────────────────────────────────────────────────────── */}
      {loading || wsLoading ? (
        /* Skeleton */
        viewMode === "cards" ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 16,
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse"
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E8EDEF",
                  borderRadius: 16,
                  padding: 20,
                  height: 270,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <div style={{ display: "flex", gap: 6 }}>
                  <div style={{ height: 22, width: 70, background: "#EAEEF0", borderRadius: 999 }} />
                  <div style={{ height: 22, width: 80, background: "#EAEEF0", borderRadius: 999 }} />
                </div>
                <div style={{ height: 20, width: "75%", background: "#EAEEF0", borderRadius: 6 }} />
                <div style={{ height: 14, width: "45%", background: "#EAEEF0", borderRadius: 6 }} />
                <div style={{ height: 5, background: "#EAEEF0", borderRadius: 3 }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  {[0, 1, 2].map((j) => (
                    <div key={j} style={{ height: 30, background: "#EAEEF0", borderRadius: 6 }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            className="animate-pulse"
            style={{
              background: "#FFFFFF",
              border: "1px solid #E5EAEC",
              borderRadius: 14,
              overflow: "hidden",
            }}
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  paddingBlock: 16,
                  paddingInline: 20,
                  borderBottom: "1px solid #EAEEF0",
                  gap: 12,
                }}
              >
                <div style={{ width: 15, height: 15, background: "#EAEEF0", borderRadius: 4 }} />
                <div style={{ flex: 1, height: 14, background: "#EAEEF0", borderRadius: 4 }} />
                <div style={{ width: 80, height: 20, background: "#EAEEF0", borderRadius: 999 }} />
                <div style={{ width: 80, height: 20, background: "#EAEEF0", borderRadius: 999 }} />
              </div>
            ))}
          </div>
        )
      ) : filtered.length === 0 ? (
        /* Empty state */
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            paddingBlock: 96,
            gap: 16,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "#16DAC124",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <RiFolderLine style={{ width: 28, height: 28, color: "#14C4AE" }} />
          </div>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontWeight: 700, color: "#0F2A37", fontSize: 15, margin: 0 }}>
              No projects found
            </p>
            <p style={{ fontSize: 13, color: "#7A8A93", marginTop: 4 }}>
              {activeTab === "archived"
                ? "No archived projects."
                : activeTab === "backlog"
                ? "No backlog projects."
                : activeTab === "in_progress"
                ? "No in-progress projects."
                : activeTab === "review"
                ? "No projects in review."
                : activeTab === "done"
                ? "No completed projects."
                : search || deptFilter !== "all"
                ? "Try adjusting your filters or search."
                : "Create your first project to get started."}
            </p>
          </div>
          {activeTab === "all" && !search && deptFilter === "all" && (
            <button
              onClick={() => setCreateOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                paddingBlock: 10,
                paddingInline: 20,
                background: "#16DAC1",
                border: "none",
                borderRadius: 999,
                cursor: "pointer",
                boxShadow: "#14C4AE47 0px 6px 14px",
                fontSize: 13,
                fontWeight: 700,
                color: "#FFFFFF",
                fontFamily: manrope,
              }}
            >
              <RiAddLine style={{ width: 14, height: 14 }} />
              New project
            </button>
          )}
        </div>
      ) : viewMode === "kanban" ? (
        /* ── KANBAN VIEW ────────────────────────────────────────────────────── */
        <KanbanView
          projects={filtered}
          onNavigate={(id) => router.push(`/projects/${id}`)}
          onNewProject={() => setCreateOpen(true)}
          onMove={handleMoveStatus}
          onDelete={handleDelete}
        />
      ) : viewMode === "timeline" ? (
        /* ── TIMELINE VIEW ──────────────────────────────────────────────────── */
        <TimelineView
          projects={filtered}
          offsetWeeks={timelineOffset}
          scale={timelineScale}
        />
      ) : viewMode === "cards" ? (
        /* ── CARD VIEW ──────────────────────────────────────────────────────── */
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
          }}
        >
          {filtered.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onEdit={() => setEditProject(p)}
              onDelete={() => handleDelete(p)}
            />
          ))}
        </div>
      ) : (
        /* ── LIST VIEW ──────────────────────────────────────────────────────── */
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #E5EAEC",
            borderRadius: 14,
            overflow: "clip",
          }}
        >
          {/* Table header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "#F8FAFB",
              borderBottom: "1px solid #E5EAEC",
              paddingBlock: 12,
              paddingInline: 20,
            }}
          >
            {/* Checkbox spacer */}
            <div style={{ width: 28, flexShrink: 0 }} />
            {(
              [
                ["PROJECT",  320],
                ["DEPT",     130],
                ["STATUS",   130],
                ["OWNER",    160],
                ["SPRINT",   110],
                ["PROGRESS", 150],
                ["DUE",      110],
              ] as const
            ).map(([col, w]) => (
              <div
                key={col}
                style={{
                  width: w,
                  flexShrink: 0,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                  color: "#94A3B8",
                }}
              >
                {col}
              </div>
            ))}
            <div style={{ flex: 1 }} />
            <div style={{ width: 32 }} />
          </div>

          {/* Rows */}
          {filtered.map((p) => {
            const overdue =
              isOverdue(p.due_date) &&
              p.status !== "done" &&
              p.status !== "archived";
            return (
              <div
                key={p.id}
                onClick={() => router.push(`/projects/${p.id}`)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  paddingBlock: 14,
                  paddingInline: 20,
                  borderBottom: "1px solid #EAEEF0",
                  cursor: "pointer",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#F8FAFB")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                {/* Checkbox */}
                <div
                  style={{ width: 28, flexShrink: 0 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    style={{
                      width: 15,
                      height: 15,
                      border: "1.5px solid #D0DCDC",
                      borderRadius: 4,
                      background: "#FFFFFF",
                    }}
                  />
                </div>

                {/* Project */}
                <div style={{ width: 320, flexShrink: 0, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#0F2A37",
                      margin: 0,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {p.title}
                  </p>
                  <p
                    style={{
                      fontSize: 11,
                      color: "#94A3B8",
                      margin: 0,
                      marginTop: 2,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {p.project_code}
                    {p.quarter ? ` · ${p.quarter}` : ""}
                    {overdue && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          background: "#FEF2F2",
                          color: "#EF4444",
                          border: "1px solid #FECACA",
                          borderRadius: 999,
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "1px 6px",
                        }}
                      >
                        ⚠ Overdue
                      </span>
                    )}
                  </p>
                </div>

                {/* Dept */}
                <div style={{ width: 130, flexShrink: 0 }}>
                  <DeptBadge dept={p.department} />
                </div>

                {/* Status */}
                <div style={{ width: 130, flexShrink: 0 }}>
                  <StatusBadge status={p.status} />
                </div>

                {/* Owner */}
                <div
                  style={{
                    width: 160,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {p.owner_name ? (
                    <>
                      <Avatar name={p.owner_name} size={22} />
                      <span
                        style={{
                          fontSize: 12,
                          color: "#374151",
                          fontFamily: manrope,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {p.owner_name
                          .split(" ")
                          .map((w, i) => (i === 0 ? w : w[0] + "."))
                          .join(" ")}
                      </span>
                    </>
                  ) : (
                    <span style={{ fontSize: 12, color: "#C0CDD4" }}>—</span>
                  )}
                </div>

                {/* Sprint */}
                <div
                  style={{
                    width: 110,
                    flexShrink: 0,
                    fontSize: 12,
                    color: "#4A5C66",
                    fontFamily: manrope,
                  }}
                >
                  {p.sprint ?? "—"}
                </div>

                {/* Progress */}
                <div style={{ width: 150, flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                      style={{
                        flex: 1,
                        height: 4,
                        background: "#E8EDEF",
                        borderRadius: 2,
                      }}
                    >
                      <div
                        style={{
                          height: 4,
                          borderRadius: 2,
                          width: `${p.progress}%`,
                          background:
                            p.progress >= 80
                              ? "#22C55E"
                              : p.progress >= 40
                              ? "#14C4AE"
                              : "#F59E0B",
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#374151",
                        flexShrink: 0,
                        minWidth: 32,
                        textAlign: "right",
                        fontFamily: manrope,
                      }}
                    >
                      {p.progress}%
                    </span>
                  </div>
                </div>

                {/* Due */}
                <div
                  style={{
                    width: 110,
                    flexShrink: 0,
                    fontSize: 12,
                    fontWeight: overdue ? 700 : 500,
                    color: overdue ? "#EF4444" : "#4A5C66",
                    fontFamily: manrope,
                  }}
                >
                  {fmtShort(p.due_date)}
                </div>

                <div style={{ flex: 1 }} />

                {/* 3-dot */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{ width: 32, flexShrink: 0 }}
                >
                  <RowMenu project={p} onEdit={() => setEditProject(p)} onDelete={() => handleDelete(p)} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer count */}
      {!loading && allProjects.length > 0 && (
        <p style={{ fontSize: 12, color: "#B0BEC5", fontFamily: manrope, margin: 0 }}>
          Showing {filtered.length} of{" "}
          {allProjects.filter((p) => p.status !== "archived").length} projects
        </p>
      )}

      {/* Create modal */}
      {createOpen && (
        <CreateProjectModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={(project) => {
            setCreateOpen(false);
            router.push(`/projects/${project.id}`);
          }}
        />
      )}

      {editProject && (
        <EditProjectModal
          open={!!editProject}
          project={editProject}
          onClose={() => setEditProject(null)}
          onSaved={(updated) => {
            setAllProjects((prev) =>
              prev.map((p) => (p.id === updated.id ? updated : p))
            );
            setEditProject(null);
          }}
          onDeleted={() => {
            setAllProjects((prev) => prev.filter((p) => p.id !== editProject.id));
            setEditProject(null);
          }}
        />
      )}

      {/* Delete confirmation modal */}
      {deleteProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-[420px] rounded-2xl bg-background shadow-2xl flex flex-col">
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-border">
              <div className="flex items-center gap-3 mb-1">
                <div className="flex size-9 items-center justify-center rounded-full bg-red-100 shrink-0">
                  <RiDeleteBin2Line size={16} className="text-red-500" />
                </div>
                <h2 className="text-lg font-bold">Delete project</h2>
              </div>
            </div>
            {/* Body */}
            <div className="px-6 py-5">
              <p className="text-sm text-foreground-muted leading-relaxed">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-foreground">"{deleteProject.title}"</span>?
                {" "}All tasks and data within this project will be permanently removed.
                This action <span className="font-semibold text-red-500">cannot be undone</span>.
              </p>
            </div>
            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
              <button
                type="button"
                onClick={() => setDeleteProject(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium rounded-full border border-border hover:bg-background-subtle transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-40"
              >
                <RiDeleteBin2Line size={14} />
                {deleting ? "Deleting…" : "Delete project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
