"use client";

import * as React from "react";
import { RiDeleteBin2Line } from "@remixicon/react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import type { ContactRow } from "@/lib/supabase/types";

interface DeleteContactDialogProps {
  contact: ContactRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (contact: ContactRow) => Promise<void>;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const TONES = [
  "bg-turquoise-100 text-turquoise-700",
  "bg-amber-100 text-amber-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
];

function avatarTone(name: string) {
  return TONES[name.charCodeAt(0) % TONES.length];
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function DeleteContactDialog({
  contact,
  open,
  onOpenChange,
  onConfirm,
}: DeleteContactDialogProps) {
  const [confirmation, setConfirmation] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [inputError, setInputError] = React.useState(false);

  // Reset state when dialog opens/closes
  React.useEffect(() => {
    if (!open) {
      setConfirmation("");
      setInputError(false);
      setLoading(false);
    }
  }, [open]);

  if (!contact) return null;

  const isMatch = confirmation === "DELETE";

  async function handleConfirm() {
    if (!isMatch) {
      setInputError(true);
      return;
    }
    setLoading(true);
    try {
      await onConfirm(contact!);
    } finally {
      setLoading(false);
    }
  }

  const ini = initials(contact.name);
  const tone = avatarTone(contact.name);

  const subInfo = [
    contact.email,
    contact.company,
    formatDate(contact.created_at) ? `Added ${formatDate(contact.created_at)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" hideClose>
        {/* Header */}
        <div className="flex items-start gap-4 p-6 pb-0">
          <div className="shrink-0 size-11 rounded-xl bg-destructive-subtle flex items-center justify-center">
            <RiDeleteBin2Line size={20} className="text-destructive" />
          </div>
          <div>
            <DialogTitle className="text-base font-semibold text-foreground">
              Delete this contact?
            </DialogTitle>
            <p className="mt-1 text-sm text-foreground-muted">
              This is a soft delete. The record is hidden from the list and recoverable for 30 days
              from Settings → Trash.
            </p>
          </div>
        </div>

        {/* Contact preview */}
        <div className="mx-6 mt-5 rounded-xl border border-border bg-background-subtle p-4 flex items-center gap-3">
          <Avatar initials={ini} size="md" tone={tone} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm">{contact.name}</p>
              <Badge
                variant={contact.type === "twibbonize" ? "twibbonize" : "external"}
                size="xs"
              >
                {contact.type === "twibbonize" ? "Twibbonize" : "External"}
              </Badge>
            </div>
            {subInfo && (
              <p className="text-xs text-foreground-muted mt-0.5 truncate">{subInfo}</p>
            )}
          </div>
        </div>

        {/* Confirmation input */}
        <div className="px-6 mt-5">
          <label className="text-sm font-medium text-foreground block mb-1.5">
            Type <span className="font-mono font-bold">DELETE</span> to confirm
          </label>
          <input
            type="text"
            value={confirmation}
            onChange={(e) => {
              setConfirmation(e.target.value);
              setInputError(false);
            }}
            placeholder="DELETE"
            className={[
              "h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none placeholder:text-foreground-muted transition-colors",
              inputError
                ? "border-destructive focus:border-destructive focus:ring-2 focus:ring-destructive/10"
                : "border-border focus:border-primary focus:ring-2 focus:ring-primary/10",
            ].join(" ")}
            autoComplete="off"
            spellCheck={false}
          />
          {inputError && (
            <p className="mt-1.5 text-xs text-destructive">
              Please type DELETE exactly to confirm.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-5 mt-4">
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
            disabled={!isMatch || loading}
          >
            {loading ? "Deleting…" : "Delete contact"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
