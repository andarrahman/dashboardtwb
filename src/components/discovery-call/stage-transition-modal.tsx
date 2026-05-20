"use client";

import * as React from "react";
import { RiRefreshLine, RiSkipForwardLine, RiCheckLine } from "@remixicon/react";
import type {
  DiscoveryCallRow,
  DiscoveryCallStage,
  DiscoveryCallRescheduleReason,
  DiscoveryCallSkipReason,
  DiscoveryCallResult,
  DiscoveryCallNextAction,
} from "@/lib/supabase/types";
import {
  RESCHEDULE_REASON_LABELS,
  SKIP_REASON_OPTIONS,
  NEXT_ACTION_OPTIONS,
  STAGE_MAP,
} from "./constants";

interface StageTransitionModalProps {
  call: DiscoveryCallRow;
  toStage: DiscoveryCallStage;
  onConfirm: (payload: TransitionPayload) => void;
  onCancel: () => void;
  loading?: boolean;
}

export interface TransitionPayload {
  to_stage: DiscoveryCallStage;
  reschedule_reason?: DiscoveryCallRescheduleReason;
  reschedule_note?: string;
  skip_reason?: DiscoveryCallSkipReason;
  skip_note?: string;
  result?: DiscoveryCallResult;
  next_action?: DiscoveryCallNextAction;
}

export function StageTransitionModal({ call, toStage, onConfirm, onCancel, loading }: StageTransitionModalProps) {
  const contact = call.contact as unknown as { name: string } | undefined;
  const contactName = contact?.name ?? "this contact";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-[520px] rounded-2xl bg-background shadow-2xl">
        {toStage === "waiting_reschedule" && (
          <ReschedulePrompt call={call} contactName={contactName} onConfirm={onConfirm} onCancel={onCancel} loading={loading} />
        )}
        {toStage === "skipped" && (
          <SkipPrompt call={call} contactName={contactName} onConfirm={onConfirm} onCancel={onCancel} loading={loading} />
        )}
        {toStage === "finished" && (
          <FinishPrompt call={call} contactName={contactName} onConfirm={onConfirm} onCancel={onCancel} loading={loading} />
        )}
      </div>
    </div>
  );
}

// ─── Reschedule ───────────────────────────────────────────────────────────────

function ReschedulePrompt({ call, contactName, onConfirm, onCancel, loading }: {
  call: DiscoveryCallRow;
  contactName: string;
  onConfirm: (p: TransitionPayload) => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  const [reason, setReason] = React.useState<DiscoveryCallRescheduleReason | "">("");
  const [note, setNote] = React.useState("");
  const fromLabel = STAGE_MAP[call.stage]?.label ?? call.stage;

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="size-10 rounded-full bg-amber-100 flex items-center justify-center">
          <RiRefreshLine size={18} className="text-amber-600" />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">
            {fromLabel} → Waiting Reschedule
          </p>
          <h2 className="text-lg font-bold">Why is this rescheduled?</h2>
        </div>
      </div>
      <p className="text-sm text-foreground-muted mb-5">
        Help the team understand what happened with {contactName}&apos;s interview.
      </p>

      <div className="mb-4">
        <label className="block text-sm font-semibold mb-2">Reason *</label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(RESCHEDULE_REASON_LABELS) as DiscoveryCallRescheduleReason[]).map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                reason === r
                  ? "border-amber-500 bg-amber-50 text-amber-700"
                  : "border-border text-foreground hover:border-foreground-muted"
              }`}
            >
              {RESCHEDULE_REASON_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-semibold mb-2">Note (optional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Add context for the team..."
          className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/10 resize-none"
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-foreground-muted">Card moves to Waiting Reschedule</p>
        <div className="flex items-center gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium rounded-full border border-border hover:bg-background-subtle transition-colors">
            Cancel
          </button>
          <button
            disabled={!reason || loading}
            onClick={() => reason && onConfirm({ to_stage: "waiting_reschedule", reschedule_reason: reason, reschedule_note: note })}
            className="px-4 py-2 text-sm font-semibold rounded-full bg-amber-500 text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Moving…" : "Move to Reschedule"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Skip ─────────────────────────────────────────────────────────────────────

function SkipPrompt({ contactName, onConfirm, onCancel, loading }: {
  call?: DiscoveryCallRow;
  contactName: string;
  onConfirm: (p: TransitionPayload) => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  const [reason, setReason] = React.useState<DiscoveryCallSkipReason | "">("");
  const [note, setNote] = React.useState("");

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="size-10 rounded-full bg-foreground-muted/10 flex items-center justify-center">
          <RiSkipForwardLine size={18} className="text-foreground-muted" />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
            Any Stage → Skipped
          </p>
          <h2 className="text-lg font-bold">Skip this discovery call?</h2>
        </div>
      </div>
      <p className="text-sm text-foreground-muted mb-5">
        Card for {contactName} will move to Skipped. The contact stays on Twibbonize; only this call is closed.
      </p>

      <div className="mb-4">
        <label className="block text-sm font-semibold mb-2">Skip reason *</label>
        <div className="space-y-2">
          {SKIP_REASON_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                reason === opt.value ? "border-primary bg-primary/5" : "border-border hover:bg-background-subtle"
              }`}
            >
              <input
                type="radio"
                name="skip_reason"
                value={opt.value}
                checked={reason === opt.value}
                onChange={() => setReason(opt.value as DiscoveryCallSkipReason)}
                className="mt-0.5 accent-primary"
              />
              <div>
                <p className="text-sm font-semibold">{opt.label}</p>
                {opt.description && <p className="text-xs text-foreground-muted">{opt.description}</p>}
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-semibold mb-2">Note (optional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Add context for the team..."
          className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/10 resize-none"
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-foreground-muted">Can be reopened from Skipped column</p>
        <div className="flex items-center gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium rounded-full border border-border hover:bg-background-subtle transition-colors">
            Cancel
          </button>
          <button
            disabled={!reason || loading}
            onClick={() => reason && onConfirm({ to_stage: "skipped", skip_reason: reason as DiscoveryCallSkipReason, skip_note: note })}
            className="px-4 py-2 text-sm font-semibold rounded-full bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Moving…" : "Move to Skipped"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Finish ───────────────────────────────────────────────────────────────────

function FinishPrompt({ call, contactName, onConfirm, onCancel, loading }: {
  call: DiscoveryCallRow;
  contactName: string;
  onConfirm: (p: TransitionPayload) => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  const [result, setResult] = React.useState<DiscoveryCallResult | "">("");
  const [nextAction, setNextAction] = React.useState<DiscoveryCallNextAction | "">("");

  const resultOptions: { value: DiscoveryCallResult; label: string; description: string }[] = [
    { value: "qualified",     label: "Qualified",     description: "Ready for partnership" },
    { value: "nurture",       label: "Nurture",       description: "Re-check later" },
    { value: "not_qualified", label: "Not qualified", description: "Not a fit" },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="size-10 rounded-full bg-emerald-100 flex items-center justify-center">
          <RiCheckLine size={18} className="text-emerald-600" />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">
            Waiting Result → Finished
          </p>
          <h2 className="text-lg font-bold">Set the result for {contactName}</h2>
        </div>
      </div>
      <p className="text-sm text-foreground-muted mb-5">
        Pick a result and what happens next.
      </p>

      <div className="mb-4">
        <label className="block text-sm font-semibold mb-2">Result *</label>
        <div className="grid grid-cols-3 gap-2">
          {resultOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setResult(opt.value);
                if (opt.value === "qualified") setNextAction("to_partnership");
                else if (opt.value === "nurture") setNextAction("nurture_90d");
                else setNextAction("archive");
              }}
              className={`flex flex-col items-center p-3 rounded-xl border text-center transition-colors ${
                result === opt.value ? "border-primary bg-primary/5" : "border-border hover:bg-background-subtle"
              }`}
            >
              <p className="text-sm font-semibold">{opt.label}</p>
              <p className="text-xs text-foreground-muted">{opt.description}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-semibold mb-2">Next action *</label>
        <div className="space-y-2">
          {NEXT_ACTION_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                nextAction === opt.value ? "border-primary bg-primary/5" : "border-border hover:bg-background-subtle"
              }`}
            >
              <input
                type="radio"
                name="next_action"
                value={opt.value}
                checked={nextAction === opt.value}
                onChange={() => setNextAction(opt.value as DiscoveryCallNextAction)}
                className="mt-0.5 accent-primary"
              />
              <div>
                <p className="text-sm font-semibold">{opt.label}</p>
                {opt.description && <p className="text-xs text-foreground-muted">{opt.description}</p>}
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-foreground-muted">Activity will be logged on the contact</p>
        <div className="flex items-center gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium rounded-full border border-border hover:bg-background-subtle transition-colors">
            Cancel
          </button>
          <button
            disabled={!result || !nextAction || loading}
            onClick={() => result && nextAction && onConfirm({
              to_stage: "finished",
              result: result as DiscoveryCallResult,
              next_action: nextAction as DiscoveryCallNextAction,
            })}
            className="px-4 py-2 text-sm font-semibold rounded-full bg-primary text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Finishing…" : "Finish & hand off"}
          </button>
        </div>
      </div>
    </div>
  );
}
