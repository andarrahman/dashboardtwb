"use client";

import * as React from "react";
import {
  RiCloseLine,
  RiComputerLine,
  RiSmartphoneLine,
  RiMailLine,
  RiSendPlaneLine,
  RiInformationLine,
  RiLinkM,
  RiShieldCheckLine,
  RiCodeLine,
} from "@remixicon/react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MarketingTemplateRow } from "@/lib/supabase/types";

// ─── HTML renderer ─────────────────────────────────────────────────────────────

function categoryLabel(cat: string | null) {
  if (!cat) return null;
  const map: Record<string, string> = {
    newsletter: "Newsletter",
    promo: "Promotional",
    onboarding: "Onboarding",
    reactivation: "Reactivation",
    transactional: "Transactional",
  };
  return map[cat] ?? cat;
}

function relativeDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function extractLinks(html: string): string[] {
  const regex = /href="([^"#][^"]*)"/g;
  const links: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null) {
    if (!links.includes(m[1])) links.push(m[1]);
  }
  return links;
}

// ─── Spam check heuristics ────────────────────────────────────────────────────

function runSpamCheck(template: MarketingTemplateRow): {
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  const subject = template.subject_line ?? "";

  if (!subject) issues.push("Missing subject line");
  if (subject.toUpperCase() === subject && subject.length > 5)
    issues.push("Subject line is ALL CAPS");
  if (/free|win|winner|guaranteed|prize/i.test(subject))
    issues.push("Subject contains spam trigger words");
  if (subject.includes("!"))
    issues.push("Subject contains exclamation marks");
  if (!template.preview_text)
    issues.push("Missing preview text");
  if (!template.subject_line)
    issues.push("No subject line set");

  return {
    score: Math.max(0, 100 - issues.length * 20),
    issues,
  };
}

// ─── Modal ─────────────────────────────────────────────────────────────────────

type PreviewTab = "desktop" | "mobile" | "inbox";
type InfoTab = "details" | "links" | "spam" | "variables";

function applyVariables(html: string, data: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return data[key] !== undefined && data[key] !== "" ? data[key] : match;
  });
}

interface PreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: MarketingTemplateRow | null;
  renderedHtml: string;
  onSendTest: () => void;
  onUseTemplate: () => void;
}

export function PreviewModal({
  open,
  onOpenChange,
  template,
  renderedHtml,
  onSendTest,
  onUseTemplate,
}: PreviewModalProps) {
  const [viewTab, setViewTab] = React.useState<PreviewTab>("desktop");
  const [infoTab, setInfoTab] = React.useState<InfoTab>("details");
  // Store the iframe node imperatively so we can write to it at any time
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const [sampleData, setSampleData] = React.useState<Record<string, string>>({
    first_name: "",
    last_name: "",
    full_name: "",
    email: "",
    company: "",
    unsubscribe_url: "https://yoursite.com/unsubscribe?token=sample",
  });

  // Keep latest values in refs so the callback ref can read them without stale closures
  const renderedHtmlRef = React.useRef(renderedHtml);
  const sampleDataRef  = React.useRef(sampleData);
  renderedHtmlRef.current = renderedHtml;
  sampleDataRef.current   = sampleData;

  function writeToIframe(iframe: HTMLIFrameElement) {
    const html = renderedHtmlRef.current;
    if (!html) return;
    const doc = iframe.contentDocument;
    if (!doc) return;
    const resolved = applyVariables(html, sampleDataRef.current);
    doc.open();
    doc.write(resolved);
    doc.close();
    // auto-resize after paint
    requestAnimationFrame(() => {
      if (iframe.contentDocument?.body) {
        iframe.style.height = `${iframe.contentDocument.body.scrollHeight}px`;
      }
    });
  }

  // Callback ref: fires synchronously the moment the iframe is mounted in the DOM
  const iframeCallbackRef = React.useCallback((node: HTMLIFrameElement | null) => {
    iframeRef.current = node;
    if (node) writeToIframe(node);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!open) {
      setViewTab("desktop");
      setInfoTab("details");
    }
  }, [open]);

  // Re-write when HTML, tab, or sample data changes (after initial mount)
  React.useEffect(() => {
    if (iframeRef.current && renderedHtml) {
      writeToIframe(iframeRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderedHtml, viewTab, sampleData]);

  if (!template) return null;

  const links = extractLinks(renderedHtml);
  const spamCheck = runSpamCheck(template);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="xl"
        hideClose
        className="!max-w-[1080px] !w-[calc(100vw-48px)] h-[calc(100vh-80px)] flex flex-col p-0"
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
          <DialogTitle className="text-base font-semibold truncate max-w-xs">
            {template.name}
          </DialogTitle>

          {/* View tabs */}
          <div className="flex items-center gap-1 bg-background-subtle rounded-full p-1">
            {(
              [
                { id: "desktop", icon: RiComputerLine, label: "Desktop" },
                { id: "mobile", icon: RiSmartphoneLine, label: "Mobile" },
                { id: "inbox", icon: RiMailLine, label: "Inbox" },
              ] as { id: PreviewTab; icon: React.ElementType; label: string }[]
            ).map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setViewTab(id)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors",
                  viewTab === id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-foreground-muted hover:text-foreground"
                )}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onSendTest}>
              <RiSendPlaneLine size={14} />
              Send test
            </Button>
            <Button variant="primary" size="sm" onClick={onUseTemplate}>
              Use template
            </Button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="size-8 inline-flex items-center justify-center rounded-full text-foreground-muted hover:bg-background-subtle hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <RiCloseLine size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 min-h-0">
          {/* Preview area */}
          <div className="flex-1 bg-gray-100 flex items-start justify-center overflow-auto p-6 min-h-0">
            <div
              className="bg-white shadow-lg transition-all"
              style={{
                width:
                  viewTab === "mobile"
                    ? 375
                    : viewTab === "inbox"
                    ? 680
                    : 660,
                minHeight: 400,
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              {viewTab === "inbox" && (
                <div className="px-4 py-3 border-b border-gray-200 bg-white">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {template.subject_line || "(No subject)"}
                  </p>
                  {template.preview_text && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {template.preview_text}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">From: noreply@twibbonize.com</p>
                </div>
              )}
              <iframe
                ref={iframeCallbackRef}
                title="Email preview"
                sandbox="allow-same-origin"
                style={{
                  width: "100%",
                  border: "none",
                  display: "block",
                  minHeight: 400,
                }}
                scrolling="no"
              />
            </div>
          </div>

          {/* Right panel */}
          <div className="w-64 shrink-0 border-l border-border flex flex-col overflow-hidden">
            {/* Info tabs */}
            <div className="flex border-b border-border">
              {(
                [
                  { id: "details", icon: RiInformationLine, label: "Details" },
                  { id: "links", icon: RiLinkM, label: "Links" },
                  { id: "spam", icon: RiShieldCheckLine, label: "Spam" },
                  { id: "variables", icon: RiCodeLine, label: "Variables" },
                ] as { id: InfoTab; icon: React.ElementType; label: string }[]
              ).map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => setInfoTab(id)}
                  className={cn(
                    "flex-1 inline-flex flex-col items-center gap-0.5 py-3 text-[11px] font-semibold transition-colors",
                    infoTab === id
                      ? "text-primary border-b-2 border-primary"
                      : "text-foreground-muted hover:text-foreground border-b-2 border-transparent"
                  )}
                >
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto p-4">
              {infoTab === "details" && (
                <div className="space-y-3">
                  {[
                    { label: "Name", value: template.name },
                    {
                      label: "Status",
                      value:
                        template.status.charAt(0).toUpperCase() +
                        template.status.slice(1),
                    },
                    {
                      label: "Category",
                      value: categoryLabel(template.category) ?? "—",
                    },
                    { label: "Version", value: `v${template.version}` },
                    {
                      label: "Subject",
                      value: template.subject_line ?? "—",
                    },
                    {
                      label: "Preview text",
                      value: template.preview_text ?? "—",
                    },
                    {
                      label: "Owner",
                      value: template.owner_name ?? "—",
                    },
                    {
                      label: "Last updated",
                      value: relativeDate(template.updated_at),
                    },
                    {
                      label: "Times used",
                      value: template.times_used.toString(),
                    },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">
                        {label}
                      </p>
                      <p className="text-sm text-foreground mt-0.5 break-words">{value}</p>
                    </div>
                  ))}
                </div>
              )}

              {infoTab === "links" && (
                <div>
                  {links.length === 0 ? (
                    <p className="text-sm text-foreground-muted text-center py-6">
                      No links found in this template.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-foreground-muted mb-3">
                        {links.length} link{links.length !== 1 ? "s" : ""} found
                      </p>
                      {links.map((link, i) => (
                        <a
                          key={i}
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-start gap-2 group"
                        >
                          <RiLinkM
                            size={13}
                            className="shrink-0 mt-0.5 text-foreground-muted"
                          />
                          <span className="text-xs text-primary group-hover:underline break-all">
                            {link}
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {infoTab === "variables" && (
                <div className="space-y-4">
                  <div className="rounded-lg bg-background-subtle border border-border px-3 py-2">
                    <p className="text-xs text-foreground-muted">
                      Filled values replace {"{{variables}}"} in the preview.
                    </p>
                  </div>
                  {[
                    { key: "first_name", label: "First name", placeholder: "e.g. John" },
                    { key: "last_name", label: "Last name", placeholder: "e.g. Doe" },
                    { key: "full_name", label: "Full name", placeholder: "e.g. John Doe" },
                    { key: "email", label: "Email", placeholder: "e.g. john@example.com" },
                    { key: "company", label: "Company", placeholder: "e.g. Acme Corp" },
                    { key: "unsubscribe_url", label: "Unsubscribe URL", placeholder: "https://..." },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <label className="text-xs font-medium text-foreground-muted block mb-1">{label}</label>
                      <input
                        type="text"
                        value={sampleData[key] ?? ""}
                        onChange={(e) =>
                          setSampleData((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        placeholder={placeholder}
                        className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/10"
                      />
                    </div>
                  ))}
                </div>
              )}

              {infoTab === "spam" && (
                <div>
                  {/* Score */}
                  <div className="text-center py-4">
                    <div
                      className={cn(
                        "text-3xl font-bold",
                        spamCheck.score >= 80
                          ? "text-teal-600"
                          : spamCheck.score >= 60
                          ? "text-amber-600"
                          : "text-red-600"
                      )}
                    >
                      {spamCheck.score}
                    </div>
                    <p className="text-xs text-foreground-muted mt-1">Spam score / 100</p>
                    <p
                      className={cn(
                        "text-xs font-semibold mt-1",
                        spamCheck.score >= 80
                          ? "text-teal-600"
                          : spamCheck.score >= 60
                          ? "text-amber-600"
                          : "text-red-600"
                      )}
                    >
                      {spamCheck.score >= 80
                        ? "Good"
                        : spamCheck.score >= 60
                        ? "Needs attention"
                        : "High risk"}
                    </p>
                  </div>

                  {spamCheck.issues.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-lg bg-teal-50 border border-teal-100 px-3 py-2">
                      <RiShieldCheckLine size={14} className="text-teal-600 shrink-0" />
                      <p className="text-xs text-teal-700 font-medium">
                        No spam issues detected
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 mt-2">
                      {spamCheck.issues.map((issue) => (
                        <div
                          key={issue}
                          className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2"
                        >
                          <RiInformationLine
                            size={13}
                            className="text-amber-600 shrink-0 mt-0.5"
                          />
                          <p className="text-xs text-amber-800">{issue}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
