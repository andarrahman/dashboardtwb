"use client";

import * as React from "react";
import { RiAlertLine, RiCalendarLine, RiTimeLine } from "@remixicon/react";
import type { ProjectWeeklyUpdateRow, WeeklyUpdateStatus } from "@/lib/supabase/types";
import { WeeklyUpdateModal } from "./weekly-update-modal";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtWeekRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${s.toLocaleDateString("en-US", opts)} — ${e.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function currentWeekStart(): string {
  const d = new Date();
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function currentWeekEnd(): string {
  const d = new Date();
  const diff = d.getDay() === 0 ? 0 : 7 - d.getDay();
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function isOverdue(): boolean {
  const now = new Date();
  return now.getDay() === 0 || now > new Date(currentWeekEnd() + "T23:59:59");
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CHIP: Record<WeeklyUpdateStatus, { pill: string; dot: string }> = {
  on_track: { pill: "bg-green-50 text-green-700 border-green-300",  dot: "bg-green-400"  },
  ongoing:  { pill: "bg-amber-50 text-amber-700 border-amber-300",  dot: "bg-amber-400"  },
  behind:   { pill: "bg-red-50   text-red-700   border-red-300",    dot: "bg-red-400"    },
};

const STATUS_LABEL: Record<WeeklyUpdateStatus, string> = {
  on_track: "On Track",
  ongoing:  "Ongoing",
  behind:   "Behind",
};

function StatusBadge({ status }: { status: WeeklyUpdateStatus }) {
  const c = STATUS_CHIP[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${c.pill}`}>
      <span className={`size-1.5 rounded-full ${c.dot}`} />
      {STATUS_LABEL[status]}
    </span>
  );
}

// ── Update card ───────────────────────────────────────────────────────────────

function UpdateCard({ update, onEdit }: { update: ProjectWeeklyUpdateRow; onEdit: (u: ProjectWeeklyUpdateRow) => void }) {
  return (
    <div
      onClick={() => onEdit(update)}
      className="bg-background border border-border rounded-2xl p-5 cursor-pointer transition-shadow hover:shadow-md group"
    >
      {/* Card header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <RiCalendarLine size={13} className="text-foreground-muted shrink-0" />
            <span className="text-sm font-bold text-foreground">
              Week of {fmtWeekRange(update.week_start, update.week_end)}
            </span>
          </div>
          <StatusBadge status={update.status} />
          {update.is_draft && (
            <span className="text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200 rounded-full px-2 py-0.5 tracking-wide">
              DRAFT
            </span>
          )}
        </div>
        <div className="text-right shrink-0 ml-4">
          {update.submitted_by_name && (
            <p className="text-xs font-semibold text-foreground">{update.submitted_by_name}</p>
          )}
          {update.submitted_at && (
            <p className="text-[11px] text-foreground-muted flex items-center gap-1 justify-end mt-0.5">
              <RiTimeLine size={10} />
              {fmtDateTime(update.submitted_at)}
            </p>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border mb-4" />

      {/* Content */}
      <div className="flex flex-col gap-4">
        {/* Result */}
        {update.result && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted mb-1.5">Result</p>
            <p className="text-sm text-foreground leading-relaxed">{update.result}</p>
          </div>
        )}

        {/* Concern */}
        {update.concern && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted mb-1.5">Concern</p>
            <p className="text-sm text-foreground leading-relaxed">{update.concern}</p>
          </div>
        )}

        {/* Plus / Minus */}
        {(update.plus || update.minus) && (
          <div className="grid grid-cols-2 gap-3">
            {update.plus && (
              <div className="rounded-xl border border-green-200 bg-green-50/60 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-green-600 mb-1.5">Plus</p>
                <p className="text-sm text-foreground leading-relaxed">{update.plus}</p>
              </div>
            )}
            {update.minus && (
              <div className="rounded-xl border border-red-200 bg-red-50/60 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-red-500 mb-1.5">Minus</p>
                <p className="text-sm text-foreground leading-relaxed">{update.minus}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface WeeklyUpdatesTabProps {
  projectId: string;
  projectTitle: string;
  updates: ProjectWeeklyUpdateRow[];
  onUpdatesChanged: () => void;
  onSubmitUpdate: () => void;
}

export function WeeklyUpdatesTab({ projectId, projectTitle, updates, onUpdatesChanged, onSubmitUpdate }: WeeklyUpdatesTabProps) {
  const [editUpdate, setEditUpdate]     = React.useState<ProjectWeeklyUpdateRow | null>(null);
  const [newUpdateOpen, setNewUpdateOpen] = React.useState(false);

  const weekStart = currentWeekStart();
  const weekEnd   = currentWeekEnd();
  const hasCurrentWeekUpdate = updates.some((u) => u.week_start === weekStart && !u.is_draft);
  const overdue = isOverdue() && !hasCurrentWeekUpdate;

  return (
    <div className="flex flex-col gap-4">

      {/* Overdue banner */}
      {overdue && (
        <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 gap-3">
          <div className="flex items-center gap-2.5">
            <RiAlertLine size={15} className="text-orange-500 shrink-0" />
            <span className="text-sm font-semibold text-orange-600">
              Week of {fmtWeekRange(weekStart, weekEnd)} update is overdue
            </span>
          </div>
          <button
            onClick={() => setNewUpdateOpen(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-orange-500 text-white text-xs font-semibold shrink-0 hover:opacity-90 transition-opacity"
          >
            <RiCalendarLine size={12} />
            Submit now
          </button>
        </div>
      )}

      {/* Cards or empty state */}
      {updates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-foreground-muted">
          <RiCalendarLine size={36} className="text-border" />
          <p className="text-sm">No weekly updates yet.</p>
          <button
            onClick={onSubmitUpdate}
            className="flex items-center gap-1.5 mt-1 px-5 py-2 rounded-full bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <RiCalendarLine size={14} />
            Submit first update
          </button>
        </div>
      ) : (
        updates.map((u) => (
          <UpdateCard key={u.id} update={u} onEdit={setEditUpdate} />
        ))
      )}

      {/* Edit modal */}
      {editUpdate && (
        <WeeklyUpdateModal
          open={!!editUpdate}
          projectId={projectId}
          projectTitle={projectTitle}
          existingUpdate={editUpdate}
          onClose={() => setEditUpdate(null)}
          onSaved={() => { setEditUpdate(null); onUpdatesChanged(); }}
        />
      )}

      {/* New update from overdue banner */}
      {newUpdateOpen && (
        <WeeklyUpdateModal
          open={newUpdateOpen}
          projectId={projectId}
          projectTitle={projectTitle}
          existingUpdate={null}
          onClose={() => setNewUpdateOpen(false)}
          onSaved={() => { setNewUpdateOpen(false); onUpdatesChanged(); }}
        />
      )}
    </div>
  );
}
