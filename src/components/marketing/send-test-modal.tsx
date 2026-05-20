"use client";

import * as React from "react";
import {
  RiSendPlaneLine,
  RiCloseLine,
  RiMailLine,
  RiAddLine,
} from "@remixicon/react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SendTestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateName: string;
  subjectLine: string | null;
  onSend: (emails: string[], addPrefix: boolean) => Promise<void>;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function SendTestModal({
  open,
  onOpenChange,
  templateName,
  subjectLine,
  onSend,
}: SendTestModalProps) {
  const [emailInput, setEmailInput] = React.useState("");
  const [emails, setEmails] = React.useState<string[]>([]);
  const [addPrefix, setAddPrefix] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [inputError, setInputError] = React.useState("");

  React.useEffect(() => {
    if (!open) {
      setEmailInput("");
      setEmails([]);
      setAddPrefix(true);
      setLoading(false);
      setInputError("");
    }
  }, [open]);

  function addEmail(raw: string) {
    const trimmed = raw.trim().toLowerCase();
    if (!trimmed) return;
    if (!isValidEmail(trimmed)) {
      setInputError("Please enter a valid email address.");
      return;
    }
    if (emails.includes(trimmed)) {
      setInputError("This email is already added.");
      return;
    }
    if (emails.length >= 5) {
      setInputError("You can add up to 5 recipients.");
      return;
    }
    setEmails((prev) => [...prev, trimmed]);
    setEmailInput("");
    setInputError("");
  }

  function removeEmail(email: string) {
    setEmails((prev) => prev.filter((e) => e !== email));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      e.preventDefault();
      addEmail(emailInput);
    } else if (e.key === "Backspace" && emailInput === "" && emails.length > 0) {
      setEmails((prev) => prev.slice(0, -1));
    }
  }

  async function handleSend() {
    // Commit any pending input first
    if (emailInput.trim()) addEmail(emailInput);
    const finalEmails = emailInput.trim()
      ? isValidEmail(emailInput.trim())
        ? [...emails, emailInput.trim().toLowerCase()]
        : emails
      : emails;

    if (finalEmails.length === 0) {
      setInputError("Add at least one recipient email.");
      return;
    }
    setLoading(true);
    try {
      await onSend(finalEmails, addPrefix);
    } finally {
      setLoading(false);
    }
  }

  const previewSubject = addPrefix
    ? `[TEST] ${subjectLine || templateName}`
    : subjectLine || templateName;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" hideClose>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-0">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <RiMailLine size={18} className="text-primary" />
            </div>
            <DialogTitle className="text-base font-semibold">
              Send test email
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

        {/* Body */}
        <div className="px-6 pt-5 space-y-4">
          {/* Subject preview */}
          <div className="rounded-xl border border-border bg-background-subtle p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted mb-1">
              Subject preview
            </p>
            <p className="text-sm font-medium text-foreground truncate">{previewSubject}</p>
          </div>

          {/* Recipients */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-foreground">
                Recipients <span className="text-destructive">*</span>
              </label>
              <span className="text-xs text-foreground-muted">{emails.length}/5</span>
            </div>

            {/* Tag input */}
            <div
              className={cn(
                "min-h-10 w-full rounded-lg border bg-background px-3 py-2 flex flex-wrap gap-1.5 cursor-text transition-colors",
                inputError
                  ? "border-destructive focus-within:ring-2 focus-within:ring-destructive/10"
                  : "border-border focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10"
              )}
              onClick={() => {
                document.getElementById("email-tag-input")?.focus();
              }}
            >
              {emails.map((email) => (
                <span
                  key={email}
                  className="inline-flex items-center gap-1 rounded-md bg-background-subtle border border-border px-2 py-0.5 text-xs font-medium"
                >
                  {email}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeEmail(email);
                    }}
                    className="text-foreground-muted hover:text-foreground transition-colors"
                    aria-label={`Remove ${email}`}
                  >
                    <RiCloseLine size={12} />
                  </button>
                </span>
              ))}
              {emails.length < 5 && (
                <input
                  id="email-tag-input"
                  type="text"
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    setInputError("");
                  }}
                  onKeyDown={handleKeyDown}
                  onBlur={() => { if (emailInput.trim()) addEmail(emailInput); }}
                  placeholder={emails.length === 0 ? "Add email addresses…" : ""}
                  className="flex-1 min-w-32 bg-transparent text-sm outline-none placeholder:text-foreground-muted"
                  autoComplete="off"
                />
              )}
            </div>

            {inputError && (
              <p className="mt-1.5 text-xs text-destructive">{inputError}</p>
            )}
            <p className="mt-1.5 text-xs text-foreground-muted">
              Press Enter or comma to add. Up to 5 recipients.
            </p>
          </div>

          {/* Add prefix toggle */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={addPrefix}
              onChange={(e) => setAddPrefix(e.target.checked)}
              className="size-4 rounded border-border cursor-pointer accent-primary"
            />
            <span className="text-sm text-foreground">
              Add{" "}
              <span className="font-mono font-semibold text-foreground">[TEST]</span>{" "}
              prefix to subject line
            </span>
          </label>
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
            variant="primary"
            size="sm"
            onClick={handleSend}
            disabled={loading || (emails.length === 0 && !emailInput.trim())}
          >
            {loading ? (
              "Sending…"
            ) : (
              <>
                <RiSendPlaneLine size={15} />
                Send test
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
