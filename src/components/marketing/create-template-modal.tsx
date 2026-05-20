"use client";

import * as React from "react";
import { RiAddLine, RiCloseLine, RiMailLine, RiArrowLeftLine } from "@remixicon/react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { STARTER_TEMPLATES, type StarterTemplate } from "@/lib/starter-templates";
import type { EmailBlock } from "@/lib/supabase/types";

const CATEGORY_OPTIONS = [
  { value: "", label: "No category" },
  { value: "newsletter", label: "Newsletter" },
  { value: "promo", label: "Promotional" },
  { value: "onboarding", label: "Onboarding" },
  { value: "reactivation", label: "Reactivation" },
  { value: "transactional", label: "Transactional" },
];

interface CreateTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; category: string; subject_line: string; preview_text: string; starterBlocks: EmailBlock[] }) => Promise<void>;
}

export function CreateTemplateModal({
  open,
  onOpenChange,
  onSubmit,
}: CreateTemplateModalProps) {
  const [step, setStep] = React.useState<"choose" | "form">("choose");
  const [selectedStarter, setSelectedStarter] = React.useState<StarterTemplate | null>(null);
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [subjectLine, setSubjectLine] = React.useState("");
  const [previewText, setPreviewText] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [nameError, setNameError] = React.useState("");

  React.useEffect(() => {
    if (!open) {
      setStep("choose");
      setSelectedStarter(null);
      setName("");
      setCategory("");
      setSubjectLine("");
      setPreviewText("");
      setLoading(false);
      setNameError("");
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Template name is required.");
      return;
    }
    if (trimmed.length > 120) {
      setNameError("Name must be 120 characters or fewer.");
      return;
    }
    setNameError("");
    setLoading(true);
    try {
      await onSubmit({
        name: trimmed,
        category,
        subject_line: subjectLine.trim(),
        preview_text: previewText.trim(),
        starterBlocks: selectedStarter?.blocks ?? [],
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" hideClose>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-0">
          <div className="flex items-center gap-2">
            {step === "form" && (
              <button
                type="button"
                onClick={() => setStep("choose")}
                className="inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground transition-colors"
              >
                <RiArrowLeftLine size={14} />
                Back
              </button>
            )}
            <DialogTitle className="text-base font-semibold">
              {step === "choose" ? "Create email template" : "Template details"}
            </DialogTitle>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="size-8 inline-flex items-center justify-center rounded-full text-foreground-muted hover:bg-background-subtle hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <RiCloseLine size={18} />
          </button>
        </div>

        {step === "choose" ? (
          /* Gallery step */
          <div className="px-6 pt-5 pb-6">
            <p className="text-sm text-foreground-muted mb-4">Start from scratch or use a starter template.</p>
            <div className="grid grid-cols-2 gap-3">
              {/* Blank */}
              <button
                type="button"
                onClick={() => { setSelectedStarter(null); setStep("form"); }}
                className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-background hover:border-primary/40 hover:bg-background-subtle transition-all p-4 text-center"
              >
                <div className="size-10 rounded-xl bg-background-subtle border border-border flex items-center justify-center">
                  <RiMailLine size={20} className="text-foreground-muted" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Blank template</p>
                  <p className="text-xs text-foreground-muted mt-0.5">Start from scratch</p>
                </div>
              </button>

              {/* Starter templates */}
              {STARTER_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => { setSelectedStarter(tpl); setStep("form"); }}
                  className="flex flex-col items-center gap-2 rounded-xl border border-border bg-background hover:border-primary/40 hover:shadow-sm transition-all p-4 text-center"
                >
                  <div className={cn("w-full h-12 rounded-lg flex items-center justify-center", tpl.thumbnailBg)}>
                    <RiMailLine size={18} className="text-foreground-muted opacity-40" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{tpl.name}</p>
                    <p className="text-xs text-foreground-muted mt-0.5 line-clamp-2">{tpl.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Form step */
          <form onSubmit={handleSubmit}>
            <div className="px-6 pt-5 space-y-4">
              {selectedStarter && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                  Using: {selectedStarter.name}
                </div>
              )}

              {/* Template name */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-foreground">
                    Template name <span className="text-destructive">*</span>
                  </label>
                  <span
                    className={cn(
                      "text-xs tabular-nums",
                      name.length > 120 ? "text-destructive" : "text-foreground-muted"
                    )}
                  >
                    {name.length}/120
                  </span>
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameError("");
                  }}
                  placeholder="e.g. Q3 Partnership Announcement"
                  maxLength={120}
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

              {/* Category */}
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  Category
                </label>
                <Select
                  value={category}
                  onChange={setCategory}
                  options={CATEGORY_OPTIONS}
                  placeholder="No category"
                />
              </div>

              {/* Subject line */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-foreground">
                    Subject line
                  </label>
                  <span className={cn("text-xs tabular-nums", subjectLine.length > 255 ? "text-destructive" : "text-foreground-muted")}>
                    {subjectLine.length}/255
                  </span>
                </div>
                <input
                  type="text"
                  value={subjectLine}
                  onChange={(e) => setSubjectLine(e.target.value)}
                  placeholder="e.g. Hi {{first_name}}, exciting news inside"
                  maxLength={255}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none placeholder:text-foreground-muted focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors"
                  autoComplete="off"
                />
              </div>

              {/* Preview text */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-foreground">
                    Preview text
                  </label>
                  <span className={cn("text-xs tabular-nums", previewText.length > 255 ? "text-destructive" : "text-foreground-muted")}>
                    {previewText.length}/255
                  </span>
                </div>
                <textarea
                  value={previewText}
                  onChange={(e) => setPreviewText(e.target.value)}
                  placeholder="Short summary shown in inbox preview"
                  maxLength={255}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none placeholder:text-foreground-muted focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors resize-none"
                />
              </div>
            </div>

            {/* Footer hint */}
            <p className="px-6 mt-4 text-xs text-foreground-muted">
              You&apos;ll be taken to the email builder to design your template.
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
                    Create &amp; open builder
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
