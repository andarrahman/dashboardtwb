"use client";

import * as React from "react";
import {
  RiMore2Fill,
  RiEditLine,
  RiArrowRightLine,
  RiUserLine,
  RiDeleteBin2Line,
  RiRefreshLine,
  RiMailLine,
  RiWhatsappLine,
  RiLinkedinLine,
  RiInstagramLine,
  RiTimeLine,
  RiCalendarLine,
  RiAlertLine,
  RiExternalLinkLine,
} from "@remixicon/react";
import type { DiscoveryCallRow, DiscoveryCallStage } from "@/lib/supabase/types";
import {
  STAGE_MAP,
  STAGES,
  LEAD_SOURCE_LABELS,
  SURVEY_STATUS_LABELS,
  RESULT_LABELS,
  SKIP_REASON_LABELS,
  NEXT_ACTION_LABELS,
  isStale,
  staleDays,
  daysUntil,
  timeAgo,
} from "./constants";

// ─── Avatar ───────────────────────────────────────────────────────────────────

const TONES = ["bg-violet-400", "bg-sky-400", "bg-amber-400", "bg-emerald-400", "bg-rose-400", "bg-fuchsia-400"];

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const ini = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const tone = TONES[name.charCodeAt(0) % TONES.length];
  const sz = size === "sm" ? "size-6 text-[9px]" : "size-9 text-xs";
  return (
    <div className={`${sz} ${tone} shrink-0 rounded-full flex items-center justify-center font-semibold text-white`}>
      {ini}
    </div>
  );
}

// ─── Lead source icon ─────────────────────────────────────────────────────────

function LeadSourceIcon({ source }: { source: string }) {
  const icons: Record<string, React.ReactNode> = {
    email:     <RiMailLine size={12} />,
    whatsapp:  <RiWhatsappLine size={12} />,
    linkedin:  <RiLinkedinLine size={12} />,
    instagram: <RiInstagramLine size={12} />,
  };
  return (
    <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary">
      {icons[source] ?? <RiMailLine size={12} />}
    </span>
  );
}

// ─── Survey pill ──────────────────────────────────────────────────────────────

function SurveyPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    not_sent:     "text-foreground-muted",
    sent_pending: "text-amber-600 bg-amber-50 border border-amber-200",
    completed:    "text-emerald-600 bg-emerald-50 border border-emerald-200",
    skipped:      "text-foreground-muted line-through",
  };
  return (
    <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${styles[status] ?? ""}`}>
      {SURVEY_STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ─── Result pill ──────────────────────────────────────────────────────────────

function ResultPill({ result }: { result: string }) {
  if (result === "pending") return <span className="text-[11px] text-foreground-muted">—</span>;
  const styles: Record<string, string> = {
    qualified:     "text-emerald-700 bg-emerald-50 border border-emerald-200",
    nurture:       "text-amber-700 bg-amber-50 border border-amber-200",
    not_qualified: "text-red-700 bg-red-50 border border-red-200",
  };
  return (
    <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${styles[result] ?? ""}`}>
      {RESULT_LABELS[result]}
    </span>
  );
}

// ─── Time chip ────────────────────────────────────────────────────────────────

function TimeChip({ call }: { call: DiscoveryCallRow }) {
  const stale = isStale(call.stage, call.last_stage_change_at, call.interview_date);
  const days = staleDays(call.last_stage_change_at);

  if (call.stage === "scheduled" && call.interview_date) {
    const d = daysUntil(call.interview_date);
    if (d > 0) {
      return (
        <span className="flex items-center gap-1 text-[11px] font-medium text-primary">
          <RiCalendarLine size={12} /> in {d} days
        </span>
      );
    } else {
      return (
        <span className="flex items-center gap-1 text-[11px] font-medium text-red-500">
          <RiAlertLine size={12} /> past date
        </span>
      );
    }
  }

  if (stale) {
    return (
      <span className="flex items-center gap-1 text-[11px] font-medium text-red-500">
        <RiAlertLine size={12} /> Stale · {days}d
      </span>
    );
  }

  if (call.stage === "waiting_result") {
    return (
      <span className="flex items-center gap-1 text-[11px] text-foreground-muted">
        <RiTimeLine size={12} /> {days}d waiting
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 text-[11px] text-foreground-muted">
      <RiTimeLine size={12} /> {timeAgo(call.last_activity_at)}
    </span>
  );
}

// ─── Card menu ────────────────────────────────────────────────────────────────

interface CardMenuProps {
  call: DiscoveryCallRow;
  onEdit: () => void;
  onMove: (stage: DiscoveryCallStage) => void;
  onOpenContact: () => void;
  onDelete: () => void;
}

function CardMenu({ call, onEdit, onMove, onOpenContact, onDelete }: CardMenuProps) {
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
        aria-label="Card actions"
      >
        <RiMore2Fill size={14} />
      </button>

      {open && (
        <div className="absolute right-0 top-6 z-50" onClick={(e) => e.stopPropagation()}>

          {/* Main menu — submenu flies out to the RIGHT via left-full */}
          <div className="relative min-w-[180px] rounded-xl border border-border bg-background shadow-[0_8px_24px_rgba(0,0,0,0.08)] py-1.5">
            <MenuRow icon={<RiEditLine size={14} />} label="Edit details" onClick={() => { closeAll(); onEdit(); }} />
            <MenuRow
              icon={<RiArrowRightLine size={14} />}
              label="Move to stage"
              trailing={<RiArrowRightLine size={12} className={`transition-colors ${showMove ? "text-primary" : "text-foreground-muted"}`} />}
              onClick={() => setShowMove((v) => !v)}
              active={showMove}
            />
            <MenuRow icon={<RiUserLine size={14} />} label="Open contact" onClick={() => { closeAll(); onOpenContact(); }} />
            <div className="my-1 border-t border-border" />
            <MenuRow icon={<RiDeleteBin2Line size={14} />} label="Delete card" destructive onClick={() => { closeAll(); onDelete(); }} />

            {/* Move to stage flyout — absolutely positioned to the RIGHT of main menu */}
            {showMove && (
              <div className="absolute left-full top-0 ml-1 min-w-[200px] rounded-xl border border-border bg-background shadow-[0_8px_24px_rgba(0,0,0,0.10)] py-1.5 z-50">
                <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">Move to stage</p>
                {STAGES.filter((s) => s.key !== "skipped").map((s) => (
                  <button
                    key={s.key}
                    onClick={() => { closeAll(); if (s.key !== call.stage) onMove(s.key); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                      s.key === call.stage ? "opacity-50 cursor-default" : "hover:bg-background-subtle"
                    }`}
                  >
                    <span className={`size-2 rounded-full ${s.dot}`} />
                    <span className="flex-1">{s.label}</span>
                    {s.key === call.stage && (
                      <span className="text-[10px] border border-border rounded px-1 text-foreground-muted">CURRENT</span>
                    )}
                  </button>
                ))}
                <div className="my-1 border-t border-border" />
                <button
                  onClick={() => { closeAll(); onMove("skipped"); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-foreground-muted hover:bg-background-subtle transition-colors"
                >
                  <span className="size-2 rounded-full bg-foreground-muted" />
                  Skipped
                </button>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

function MenuRow({
  icon, label, trailing, onClick, destructive, active,
}: {
  icon: React.ReactNode;
  label: string;
  trailing?: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
  active?: boolean;
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
      <span className="flex-1">{label}</span>
      {trailing && <span className="shrink-0">{trailing}</span>}
    </button>
  );
}

// ─── Main card ────────────────────────────────────────────────────────────────

interface KanbanCardProps {
  call: DiscoveryCallRow;
  isTeamView?: boolean;
  onEdit: () => void;
  onMove: (stage: DiscoveryCallStage) => void;
  onDelete: () => void;
  onOpenContact: () => void;
  isDragging?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export function KanbanCard({ call, isTeamView, onEdit, onMove, onDelete, onOpenContact, isDragging, onDragStart, onDragEnd }: KanbanCardProps) {
  const contact = call.contact as unknown as {
    name: string; type: string; account_tier: string | null;
    country: string | null; email: string | null; company: string | null;
    business_category: string | null; segment: string | null;
  } | undefined;

  const subLine = contact?.type === "twibbonize"
    ? [contact?.segment, contact?.country].filter(Boolean).join(" · ")
    : [contact?.company, contact?.business_category].filter(Boolean).join(" · ");

  const stale = isStale(call.stage, call.last_stage_change_at, call.interview_date);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("callId", call.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragEnd={onDragEnd}
      className={`group rounded-xl border bg-background p-3 cursor-grab active:cursor-grabbing transition-all duration-200 ${
        stale ? "border-red-200 bg-red-50/30" : "border-border"
      } ${
        isDragging
          ? "opacity-40 scale-95 rotate-1 shadow-none"
          : "hover:shadow-md hover:-translate-y-0.5"
      }`}
      onClick={onEdit}
    >
      {/* Header */}
      <div className="flex items-start gap-2 mb-2.5">
        <Avatar name={contact?.name ?? "?"} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight line-clamp-1">{contact?.name ?? "Unknown"}</p>
          <p className="text-[11px] text-foreground-muted mt-0.5 line-clamp-1">{subLine || "—"}</p>
        </div>
        <CardMenu call={call} onEdit={onEdit} onMove={onMove} onDelete={onDelete} onOpenContact={onOpenContact} />
      </div>

      {/* Fields */}
      <div className="space-y-1.5 mb-2.5">
        <FieldRow label="INTERVIEW DATE">
          {call.interview_date
            ? <span className="text-[12px] font-medium">
                {new Date(call.interview_date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                {call.interview_time ? ` · ${call.interview_time.slice(0, 5)}` : ""}
              </span>
            : <span className="text-[12px] text-foreground-muted">—</span>
          }
        </FieldRow>
        <FieldRow label="SURVEY">
          {call.survey_status === "not_sent"
            ? <span className="text-[12px] text-foreground-muted">—</span>
            : <SurveyPill status={call.survey_status} />
          }
        </FieldRow>
        <FieldRow label="RESULT">
          <ResultPill result={call.result} />
        </FieldRow>
        {call.stage === "finished" && (call as any).next_action && (
          <FieldRow label="NEXT ACTION">
            <span className="text-[12px] font-medium text-foreground">
              {NEXT_ACTION_LABELS[(call as any).next_action] ?? (call as any).next_action}
            </span>
          </FieldRow>
        )}
      </div>

      {/* Skip reason */}
      {call.stage === "skipped" && call.skip_reason && (
        <div className="flex items-center gap-1.5 mb-2.5 px-2 py-1.5 rounded-lg bg-foreground-muted/8 border border-border/60">
          <span className="size-1.5 rounded-full bg-foreground-muted shrink-0" />
          <span className="text-[11px] font-medium text-foreground-muted">
            {SKIP_REASON_LABELS[call.skip_reason] ?? call.skip_reason}
          </span>
          {call.skip_note && (
            <span className="text-[11px] text-foreground-muted/70 truncate">· {call.skip_note}</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border/60">
        <TimeChip call={call} />
        <div className="flex items-center gap-2">
          {(call as any).interview_meeting_url && (
            <a
              href={(call as any).interview_meeting_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-0.5 text-[11px] font-semibold text-primary hover:underline shrink-0"
            >
              <RiExternalLinkLine size={11} /> Join
            </a>
          )}
          {(call as any).interview_document_url && (
            <a
              href={(call as any).interview_document_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-0.5 text-[11px] font-medium text-foreground-muted hover:text-foreground hover:underline shrink-0"
            >
              <RiExternalLinkLine size={11} /> Doc
            </a>
          )}
          <div className="flex items-center gap-1.5">
          <LeadSourceIcon source={call.lead_source} />
          {isTeamView && call.owner && (() => {
            const owner = call.owner as { display_name: string | null; email: string | null };
            const name = owner.display_name ?? owner.email?.split("@")[0] ?? "?";
            const ini = name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
            const tones = ["bg-violet-400", "bg-sky-400", "bg-amber-400", "bg-emerald-400", "bg-rose-400"];
            const tone = tones[name.charCodeAt(0) % tones.length];
            return (
              <div className="flex items-center gap-1 pl-1 border-l border-border/60">
                <div className={`size-5 rounded-full ${tone} flex items-center justify-center text-[9px] font-bold text-white shrink-0`}>
                  {ini}
                </div>
                <span className="text-[11px] text-foreground-muted font-medium max-w-[60px] truncate">{name}</span>
              </div>
            );
          })()}
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted w-[90px] shrink-0">{label}</span>
      {children}
    </div>
  );
}
