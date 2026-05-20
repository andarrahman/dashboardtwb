"use client";

import * as React from "react";
import { RiDeleteBin2Line, RiCloseLine, RiErrorWarningLine } from "@remixicon/react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CrmListRow } from "@/lib/supabase/types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface DeleteListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  list: CrmListRow | null;
  onConfirm: () => Promise<void>;
}

export function DeleteListModal({
  open,
  onOpenChange,
  list,
  onConfirm,
}: DeleteListModalProps) {
  const [checked, setChecked] = React.useState(false);
  const [confirmation, setConfirmation] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setChecked(false);
      setConfirmation("");
      setLoading(false);
    }
  }, [open]);

  if (!list) return null;

  const nameMatch = confirmation === list.name;
  const canDelete = checked && nameMatch;

  async function handleConfirm() {
    if (!canDelete) return;
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  }

  const impacts = [
    "All contacts in this list will be removed from the list",
    "Any campaigns targeting this list will lose their audience reference",
    "This list will no longer appear in any reports or outreach targeting",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" hideClose>
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-0">
          <div className="flex items-start gap-4">
            <div className="shrink-0 size-11 rounded-xl bg-destructive-subtle flex items-center justify-center">
              <RiDeleteBin2Line size={20} className="text-destructive" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-destructive mb-0.5">
                Delete list
              </p>
              <DialogTitle className="text-base font-semibold text-foreground">
                Delete &ldquo;{list.name}&rdquo;?
              </DialogTitle>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="size-8 inline-flex items-center justify-center rounded-full text-foreground-muted hover:bg-background-subtle hover:text-foreground transition-colors shrink-0"
            aria-label="Close"
          >
            <RiCloseLine size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pt-5 space-y-4">
          <p className="text-sm text-foreground-muted">
            The list will be permanently removed. Contacts in this list are not
            deleted — they stay in the workspace.
          </p>

          {/* List preview */}
          <div className="rounded-xl border border-border bg-background-subtle p-4">
            <p className="font-semibold text-sm">{list.name}</p>
            <p className="text-xs text-foreground-muted mt-0.5">
              {[list.folder, `Created ${formatDate(list.created_at)}`]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p className="text-xs text-foreground-muted mt-1">
              {list.contact_count} contact{list.contact_count !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Impact warnings */}
          <div className="space-y-1.5">
            {impacts.map((impact) => (
              <div key={impact} className="flex items-start gap-2 text-sm text-destructive">
                <RiErrorWarningLine size={15} className="shrink-0 mt-0.5" />
                <span>{impact}</span>
              </div>
            ))}
          </div>

          {/* Checkbox */}
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 size-4 rounded border-border cursor-pointer accent-destructive"
            />
            <span className="text-xs text-foreground-muted leading-relaxed">
              I understand contacts will stay in the workspace but the list itself
              will be permanently deleted and cannot be recovered.
            </span>
          </label>

          {/* Type-to-confirm */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">
              Type{" "}
              <span className="font-mono font-bold text-destructive">
                {list.name}
              </span>{" "}
              to confirm
            </label>
            <input
              type="text"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder={list.name}
              className={cn(
                "h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none placeholder:text-foreground-muted transition-colors",
                confirmation.length > 0 && !nameMatch
                  ? "border-destructive focus:border-destructive focus:ring-2 focus:ring-destructive/10"
                  : "border-border focus:border-primary focus:ring-2 focus:ring-primary/10"
              )}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-5 mt-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            disabled={!canDelete || loading}
          >
            {loading ? "Deleting…" : "Delete list"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
