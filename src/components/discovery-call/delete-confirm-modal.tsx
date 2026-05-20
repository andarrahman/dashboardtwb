"use client";

import * as React from "react";
import { RiDeleteBin2Line } from "@remixicon/react";
import type { DiscoveryCallRow } from "@/lib/supabase/types";
import { STAGE_MAP, SURVEY_STATUS_LABELS } from "./constants";

interface DeleteConfirmModalProps {
  call: DiscoveryCallRow;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function DeleteConfirmModal({ call, onConfirm, onCancel, loading }: DeleteConfirmModalProps) {
  const [checked, setChecked] = React.useState(false);
  const contact = call.contact as unknown as { name: string; type: string; company: string | null; email: string | null } | undefined;
  const stage = STAGE_MAP[call.stage];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-[480px] rounded-2xl bg-background shadow-2xl p-6">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="size-14 rounded-full bg-red-100 flex items-center justify-center">
            <RiDeleteBin2Line size={24} className="text-red-500" />
          </div>
        </div>

        <h2 className="text-xl font-bold text-center mb-1">Remove this discovery call?</h2>
        <p className="text-sm text-foreground-muted text-center mb-5">
          This card will be removed from the pipeline. The contact and previous activity will stay on the contact's profile.
        </p>

        {/* Card preview */}
        <div className="rounded-xl border border-border bg-background-subtle p-4 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-9 rounded-full bg-violet-400 flex items-center justify-center text-xs font-semibold text-white">
              {contact?.name?.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{contact?.name ?? "Unknown"}</p>
              <p className="text-xs text-foreground-muted">{contact?.email ?? contact?.company ?? "—"}</p>
            </div>
            <span className={`text-[11px] font-semibold px-2 py-1 rounded-full border ${
              call.stage === "finished" ? "border-red-200 text-red-600 bg-red-50" :
              call.stage === "skipped" ? "border-gray-200 text-gray-600 bg-gray-50" :
              "border-primary/20 text-primary bg-primary/5"
            }`}>
              {stage?.label ?? call.stage}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <p className="font-semibold text-foreground-muted mb-0.5">INTERVIEW</p>
              <p className="font-medium">
                {call.interview_date
                  ? new Date(call.interview_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
                    (call.interview_time ? " · " + call.interview_time.slice(0, 5) : "")
                  : "—"}
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground-muted mb-0.5">SURVEY</p>
              <p className="font-medium">{SURVEY_STATUS_LABELS[call.survey_status] ?? "—"}</p>
            </div>
            <div>
              <p className="font-semibold text-foreground-muted mb-0.5">RESULT</p>
              <p className="font-medium">{call.result === "pending" ? "—" : call.result}</p>
            </div>
          </div>
        </div>

        {/* Checkbox */}
        <label className="flex items-start gap-3 p-3 rounded-xl border border-red-200 bg-red-50 cursor-pointer mb-5">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 accent-red-500"
          />
          <span className="text-sm text-red-700">
            I understand this card will be archived. It can be restored from Pipeline trash within 30 days.
          </span>
        </label>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-full border border-border hover:bg-background-subtle transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={!checked || loading}
            onClick={onConfirm}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-full bg-red-500 text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RiDeleteBin2Line size={14} />
            {loading ? "Removing…" : "Remove from pipeline"}
          </button>
        </div>
      </div>
    </div>
  );
}
