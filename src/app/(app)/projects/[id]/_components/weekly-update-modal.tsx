"use client";

import * as React from "react";
import { RiCloseLine, RiSaveLine, RiSendPlaneLine, RiCalendarLine } from "@remixicon/react";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { useToast } from "@/components/ui/toast";
import type { ProjectWeeklyUpdateRow, WeeklyUpdateStatus } from "@/lib/supabase/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getWeekBounds(): { start: string; end: string } {
  const d = new Date();
  const day = d.getDay();
  const toMonday = day === 0 ? -6 : 1 - day;
  const toSunday  = day === 0 ?  0 : 7 - day;
  const mon = new Date(d); mon.setDate(d.getDate() + toMonday);
  const sun = new Date(d); sun.setDate(d.getDate() + toSunday);
  return { start: mon.toISOString().slice(0, 10), end: sun.toISOString().slice(0, 10) };
}

function fmtWeekRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${s.toLocaleDateString("en-US", opts)} — ${e.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
}

function getEditWindowRemaining(closesAt: string | null): string | null {
  if (!closesAt) return null;
  const diff = new Date(closesAt).getTime() - Date.now();
  if (diff <= 0) return null;
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} min left`;
  return `${Math.floor(mins / 60)}h left`;
}

// ── Status chips ──────────────────────────────────────────────────────────────

const STATUSES: { value: WeeklyUpdateStatus; label: string }[] = [
  { value: "on_track", label: "On Track" },
  { value: "ongoing",  label: "Ongoing"  },
  { value: "behind",   label: "Behind"   },
];

const STATUS_CHIP: Record<WeeklyUpdateStatus, { active: string; dot: string }> = {
  on_track: { active: "border-green-400 bg-green-50 text-green-700",   dot: "bg-green-400"  },
  ongoing:  { active: "border-amber-400 bg-amber-50 text-amber-700",   dot: "bg-amber-400"  },
  behind:   { active: "border-red-400   bg-red-50   text-red-700",     dot: "bg-red-400"    },
};

function StatusChips({ value, onChange }: { value: WeeklyUpdateStatus; onChange: (v: WeeklyUpdateStatus) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {STATUSES.map((opt) => {
        const s = STATUS_CHIP[opt.value];
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
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

interface WeeklyUpdateModalProps {
  open: boolean;
  projectId: string;
  projectTitle: string;
  existingUpdate: ProjectWeeklyUpdateRow | null;
  onClose: () => void;
  onSaved: () => void;
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export function WeeklyUpdateModal({
  open, projectId, projectTitle, existingUpdate, onClose, onSaved,
}: WeeklyUpdateModalProps) {
  const { workspaceId } = useWorkspace();
  const { showToast } = useToast();

  const weekBounds = getWeekBounds();
  const weekStart = existingUpdate?.week_start ?? weekBounds.start;
  const weekEnd   = existingUpdate?.week_end   ?? weekBounds.end;

  const [status, setStatus]   = React.useState<WeeklyUpdateStatus>(existingUpdate?.status ?? "on_track");
  const [result, setResult]   = React.useState(existingUpdate?.result  ?? "");
  const [concern, setConcern] = React.useState(existingUpdate?.concern ?? "");
  const [plus, setPlus]       = React.useState(existingUpdate?.plus    ?? "");
  const [minus, setMinus]     = React.useState(existingUpdate?.minus   ?? "");

  const [saving, setSaving]         = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = React.useState<"idle" | "saving" | "saved">("idle");
  const [resultError, setResultError] = React.useState(false);

  const draftIdRef  = React.useRef<string | null>(existingUpdate?.id ?? null);
  const isDirtyRef  = React.useRef(false);
  const prevDataRef = React.useRef({ status, result, concern, plus, minus });

  React.useEffect(() => {
    const prev = prevDataRef.current;
    if (prev.status !== status || prev.result !== result || prev.concern !== concern || prev.plus !== plus || prev.minus !== minus) {
      isDirtyRef.current = true;
      prevDataRef.current = { status, result, concern, plus, minus };
    }
  }, [status, result, concern, plus, minus]);

  // Auto-save every 5s
  React.useEffect(() => {
    if (!open) return;
    const interval = setInterval(async () => {
      if (!isDirtyRef.current || !workspaceId) return;
      isDirtyRef.current = false;
      setAutoSaveStatus("saving");
      try {
        await saveDraft(true);
        setAutoSaveStatus("saved");
        setTimeout(() => setAutoSaveStatus("idle"), 2000);
      } catch { setAutoSaveStatus("idle"); }
    }, 5000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, workspaceId, status, result, concern, plus, minus]);

  async function saveDraft(silent = false) {
    if (!workspaceId) return;
    const body = { workspace_id: workspaceId, week_start: weekStart, week_end: weekEnd, status, result, concern: concern || null, plus: plus || null, minus: minus || null, is_draft: true };
    if (draftIdRef.current) {
      const res = await fetch(`/api/projects/${projectId}/weekly-updates/${draftIdRef.current}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error("Auto-save failed");
    } else {
      const res = await fetch(`/api/projects/${projectId}/weekly-updates`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error("Auto-save failed");
      const json = await res.json();
      draftIdRef.current = json.update?.id ?? null;
    }
    if (!silent) showToast({ title: "Draft saved" });
  }

  async function handleSaveDraft() {
    setSaving(true);
    try { await saveDraft(false); }
    catch (err) { showToast({ title: "Error", subtitle: err instanceof Error ? err.message : undefined }); }
    finally { setSaving(false); }
  }

  async function handleSubmit() {
    if (!workspaceId) return;
    if (!result.trim()) { setResultError(true); return; }
    setSubmitting(true);
    try {
      const body = { workspace_id: workspaceId, week_start: weekStart, week_end: weekEnd, status, result, concern: concern || null, plus: plus || null, minus: minus || null, is_draft: false };
      if (draftIdRef.current) {
        const res = await fetch(`/api/projects/${projectId}/weekly-updates/${draftIdRef.current}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error("Failed to submit");
      } else {
        const res = await fetch(`/api/projects/${projectId}/weekly-updates`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error("Failed to submit");
      }
      showToast({ title: "Weekly update submitted" });
      onSaved();
    } catch (err) { showToast({ title: "Error", subtitle: err instanceof Error ? err.message : undefined }); }
    finally { setSubmitting(false); }
  }

  const isEditing = !!existingUpdate;
  const editWindowRemaining = isEditing ? getEditWindowRemaining(existingUpdate.edit_window_closes_at) : null;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-[600px] rounded-2xl bg-background shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
              {projectTitle}
            </p>
            <h2 className="text-xl font-bold">
              {isEditing ? "Edit weekly update" : "Submit weekly update"}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {/* Week badge */}
            <div className="flex items-center gap-1.5 bg-background-subtle rounded-full px-3 py-1.5">
              <RiCalendarLine size={12} className="text-primary shrink-0" />
              <span className="text-[11px] font-semibold text-foreground-muted whitespace-nowrap">
                Week of {fmtWeekRange(weekStart, weekEnd)}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 hover:bg-background-subtle text-foreground-muted transition-colors"
            >
              <RiCloseLine size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Weekly status */}
          <div>
            <label className="block text-sm font-semibold mb-2">Weekly status</label>
            <StatusChips value={status} onChange={setStatus} />
          </div>

          {/* Result */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Result <span className="text-red-400">*</span>
            </label>
            <textarea
              value={result}
              onChange={(e) => { setResult(e.target.value); setResultError(false); }}
              placeholder="What was accomplished this week?"
              rows={3}
              className={`w-full rounded-xl border px-4 py-3 text-sm font-medium bg-background outline-none transition-colors resize-none leading-relaxed ${
                resultError
                  ? "border-red-400 ring-[3px] ring-red-400/10"
                  : "border-border focus:border-primary focus:ring-[3px] focus:ring-primary/10"
              }`}
            />
            {resultError && <p className="mt-1 text-xs text-red-500">Result is required.</p>}
          </div>

          {/* Concern */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Concern <span className="text-[11px] font-normal text-foreground-muted">(optional)</span>
            </label>
            <textarea
              value={concern}
              onChange={(e) => setConcern(e.target.value)}
              placeholder="Any blockers or concerns?"
              rows={2}
              className="w-full rounded-xl border border-border px-4 py-3 text-sm font-medium bg-background outline-none transition-colors resize-none leading-relaxed focus:border-primary focus:ring-[3px] focus:ring-primary/10"
            />
          </div>

          {/* Plus / Minus */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2 text-green-600">Plus</label>
              <textarea
                value={plus}
                onChange={(e) => setPlus(e.target.value)}
                placeholder="What went well?"
                rows={3}
                className="w-full rounded-xl border border-green-200 bg-green-50/60 px-4 py-3 text-sm font-medium outline-none transition-colors resize-none leading-relaxed focus:border-green-400 focus:ring-[3px] focus:ring-green-400/10"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-red-500">Minus</label>
              <textarea
                value={minus}
                onChange={(e) => setMinus(e.target.value)}
                placeholder="What could improve?"
                rows={3}
                className="w-full rounded-xl border border-red-200 bg-red-50/60 px-4 py-3 text-sm font-medium outline-none transition-colors resize-none leading-relaxed focus:border-red-400 focus:ring-[3px] focus:ring-red-400/10"
              />
            </div>
          </div>

          {/* Edit window notice */}
          {isEditing && editWindowRemaining && (
            <p className="text-xs text-foreground-muted">
              Editable until Sunday 11:59pm · <span className="text-primary font-semibold">{editWindowRemaining}</span>
            </p>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0">
          <p className="text-xs text-foreground-muted">
            {autoSaveStatus === "saving" && "Auto-saving draft…"}
            {autoSaveStatus === "saved"  && "✓ Draft auto-saved"}
            {autoSaveStatus === "idle"   && "Auto-saves as draft every 5s"}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving || submitting}
              className="px-4 py-2 text-sm font-medium rounded-full border border-border hover:bg-background-subtle transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving || submitting}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full border border-border bg-background hover:bg-background-subtle transition-colors disabled:opacity-40"
            >
              <RiSaveLine size={13} />
              {saving ? "Saving…" : "Save draft"}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !result.trim()}
              className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold rounded-full bg-primary text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RiSendPlaneLine size={13} />
              {submitting ? "Submitting…" : "Submit update"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
