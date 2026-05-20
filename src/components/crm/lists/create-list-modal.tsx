"use client";

import * as React from "react";
import { RiAddLine, RiCloseLine } from "@remixicon/react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { CrmListRow } from "@/lib/supabase/types";

const FOLDER_OPTIONS = [
  { value: "", label: "No folder" },
  { value: "Partnerships", label: "Partnerships" },
  { value: "Education", label: "Education" },
  { value: "Campaigns", label: "Campaigns" },
  { value: "Marketing", label: "Marketing" },
  { value: "General", label: "General" },
];

interface CreateListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    name: string;
    description: string;
    folder: string;
  }) => Promise<CrmListRow | null>;
}

export function CreateListModal({
  open,
  onOpenChange,
  onSubmit,
}: CreateListModalProps) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [folder, setFolder] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [nameError, setNameError] = React.useState("");

  React.useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
      setFolder("");
      setLoading(false);
      setNameError("");
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("List name is required.");
      return;
    }
    if (trimmed.length > 80) {
      setNameError("Name must be 80 characters or fewer.");
      return;
    }
    setNameError("");
    setLoading(true);
    try {
      await onSubmit({ name: trimmed, description: description.trim(), folder });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" hideClose>
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-0">
            <DialogTitle className="text-base font-semibold">
              Create new list
            </DialogTitle>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="size-8 inline-flex items-center justify-center rounded-full text-foreground-muted hover:bg-background-subtle hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <RiCloseLine size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 pt-5 space-y-4">
            {/* List name */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-foreground">
                  List name <span className="text-destructive">*</span>
                </label>
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    name.length > 80 ? "text-destructive" : "text-foreground-muted"
                  )}
                >
                  {name.length}/80
                </span>
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError("");
                }}
                placeholder="e.g. Premium Creator Outreach Q3"
                maxLength={80}
                className={cn(
                  "h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none placeholder:text-foreground-muted transition-colors",
                  nameError
                    ? "border-destructive focus:border-destructive focus:ring-2 focus:ring-destructive/10"
                    : "border-border focus:border-primary focus:ring-2 focus:ring-primary/10"
                )}
                autoFocus
                autoComplete="off"
              />
              {nameError && (
                <p className="mt-1.5 text-xs text-destructive">{nameError}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this list for?"
                rows={3}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-foreground-muted focus:border-primary focus:ring-2 focus:ring-primary/10 resize-none transition-colors"
              />
            </div>

            {/* Folder */}
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">
                Folder
              </label>
              <Select
                value={folder}
                onChange={setFolder}
                options={FOLDER_OPTIONS}
                placeholder="No folder"
              />
            </div>

          </div>

          {/* Footer hint */}
          <p className="px-6 mt-4 text-xs text-foreground-muted">
            You&apos;ll be able to add contacts in the next step.
          </p>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-3 px-6 py-5 mt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={loading}>
              {loading ? (
                "Creating…"
              ) : (
                <>
                  <RiAddLine size={15} />
                  Create list
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
