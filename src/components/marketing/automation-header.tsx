"use client";

import * as React from "react";
import Link from "next/link";
import {
  RiArrowLeftLine, RiEditLine, RiCheckLine,
  RiSaveLine, RiFlashlightLine, RiPauseLine, RiPlayLine,
  RiMoreLine, RiFileCopyLine, RiArchiveLine,
  RiGlobalLine, RiSendPlaneLine, RiSettings3Line,
} from "@remixicon/react";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AutomationStatus } from "@/lib/supabase/types";

// ─── Status badge ──────────────────────────────────────────────────────────────

function AutomationStatusBadge({ status }: { status: AutomationStatus }) {
  const map: Record<AutomationStatus, { dot: string; bg: string }> = {
    active:   { dot: "#10B89F", bg: "#16DAC11F" },
    paused:   { dot: "#F5A623", bg: "#FFB80026" },
    draft:    { dot: "#7A8A93", bg: "#7A8A9326" },
    archived: { dot: "#7A8A93", bg: "#7A8A9326" },
  };
  const s = map[status] ?? map.draft;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      background: s.bg, borderRadius: 999, paddingBlock: 4, paddingInline: 10,
      fontFamily: '"Manrope", system-ui, sans-serif',
      fontSize: 11, fontWeight: 700, color: "#0F2A37",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export type AutomationTab = "Builder" | "Statistics" | "Contacts in flow" | "Logs";

interface AutomationHeaderProps {
  automationId: string;
  automationName: string;
  automationStatus: AutomationStatus;
  activeTab: AutomationTab;

  /** Called after the name is successfully saved so parent can update its state */
  onNameSaved?: (newName: string) => void;

  // ── Save action ──────────────────────────────────────────────────────────────
  onSave?: () => void | Promise<void>;
  isSaving?: boolean;
  hasUnsavedChanges?: boolean;
  autoSaveStatus?: "idle" | "saving" | "saved" | "error";

  // ── Pause / Resume ───────────────────────────────────────────────────────────
  onPauseResume?: () => void;

  // ── Publish ──────────────────────────────────────────────────────────────────
  /** Called after publish succeeds so parent can update its state */
  onPublished?: (automation: { status: string; published_at: string }) => void;

  // ── Duplicate ────────────────────────────────────────────────────────────────
  onDuplicate?: () => void;

  // ── Automation settings (send window) ────────────────────────────────────────
  triggerConfig?: {
    send_window?: {
      enabled?: boolean;
      start?: string;
      end?: string;
      timezone?: string;
      skip_weekends?: boolean;
    };
  };
  onSettingsSaved?: (updated: { send_window: { enabled: boolean; start: string; end: string; timezone: string; skip_weekends: boolean } }) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AutomationHeader({
  automationId,
  automationName,
  automationStatus,
  activeTab,
  onNameSaved,
  onSave,
  isSaving = false,
  hasUnsavedChanges = false,
  autoSaveStatus = "idle",
  onPauseResume,
  onPublished,
  onDuplicate,
  triggerConfig,
  onSettingsSaved,
}: AutomationHeaderProps) {
  const { workspaceId } = useWorkspace();

  // ── Inline name edit ─────────────────────────────────────────────────────────
  const [editing, setEditing]     = React.useState(false);
  const [nameInput, setNameInput] = React.useState(automationName);
  const [nameSaveStatus, setNameSaveStatus] = React.useState<"idle" | "saving" | "saved">("idle");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!editing) setNameInput(automationName);
  }, [automationName, editing]);
  React.useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function commitName() {
    const trimmed = nameInput.trim();
    setEditing(false);
    if (!trimmed || trimmed === automationName || !workspaceId) return;
    setNameSaveStatus("saving");
    try {
      const res = await fetch(`/api/automations/${automationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId, name: trimmed }),
      });
      if (!res.ok) throw new Error("Failed");
      onNameSaved?.(trimmed);
      setNameSaveStatus("saved");
      setTimeout(() => setNameSaveStatus("idle"), 2500);
    } catch {
      setNameSaveStatus("idle");
      setNameInput(automationName);
    }
  }

  // ── Test run dialog ──────────────────────────────────────────────────────────
  const [testRunOpen, setTestRunOpen]   = React.useState(false);
  const [testEmail, setTestEmail]       = React.useState("");
  const [testRunning, setTestRunning]   = React.useState(false);
  const [testResults, setTestResults]   = React.useState<{ success: boolean; messages: string[] } | null>(null);

  async function handleTestRun() {
    if (!workspaceId || !testEmail) return;
    setTestRunning(true);
    setTestResults(null);
    try {
      const res = await fetch(`/api/automations/${automationId}/test-run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId, test_email: testEmail }),
      });
      const json = await res.json() as { sent: number; errors?: string[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed");

      const messages: string[] = [];
      if (json.sent > 0) messages.push(`${json.sent} email${json.sent > 1 ? "s" : ""} sent to ${testEmail}`);
      if (json.errors?.length) json.errors.forEach((e) => messages.push(e));

      const allFailed = json.sent === 0 && (json.errors?.length ?? 0) > 0;
      setTestResults({ success: !allFailed, messages });

      if (!allFailed) {
        setTimeout(() => { setTestRunOpen(false); setTestEmail(""); setTestResults(null); }, 3000);
      }
    } catch (err) {
      setTestResults({ success: false, messages: [err instanceof Error ? err.message : "Failed"] });
    } finally {
      setTestRunning(false);
    }
  }

  // ── 3-dot menu ───────────────────────────────────────────────────────────────
  const [moreOpen, setMoreOpen] = React.useState(false);
  const moreRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!moreOpen) return;
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [moreOpen]);

  // ── Automation settings (send window) ────────────────────────────────────────
  const [showSettings, setShowSettings] = React.useState(false);
  const sw = triggerConfig?.send_window;
  const [swEnabled,      setSwEnabled]      = React.useState(sw?.enabled      ?? false);
  const [swStart,        setSwStart]        = React.useState(sw?.start        ?? "09:00");
  const [swEnd,          setSwEnd]          = React.useState(sw?.end          ?? "17:00");
  const [swTimezone,     setSwTimezone]     = React.useState(sw?.timezone     ?? "Asia/Jakarta");
  const [swSkipWeekends, setSwSkipWeekends] = React.useState(sw?.skip_weekends ?? false);
  const [swSaving,       setSwSaving]       = React.useState(false);

  // Sync from props when triggerConfig changes
  React.useEffect(() => {
    if (!showSettings && sw) {
      setSwEnabled(sw.enabled ?? false);
      setSwStart(sw.start ?? "09:00");
      setSwEnd(sw.end ?? "17:00");
      setSwTimezone(sw.timezone ?? "Asia/Jakarta");
      setSwSkipWeekends(sw.skip_weekends ?? false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerConfig]);

  async function handleSaveSettings() {
    if (!workspaceId) return;
    setSwSaving(true);
    const send_window = { enabled: swEnabled, start: swStart, end: swEnd, timezone: swTimezone, skip_weekends: swSkipWeekends };
    try {
      const res = await fetch(`/api/automations/${automationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          trigger_config: { ...(triggerConfig ?? {}), send_window },
        }),
      });
      if (!res.ok) throw new Error("Failed");
      onSettingsSaved?.({ send_window });
      setShowSettings(false);
    } catch { /* silent */ }
    finally { setSwSaving(false); }
  }

  // ── Publish ──────────────────────────────────────────────────────────────────
  const [publishing, setPublishing] = React.useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = React.useState(false);

  async function handlePublish() {
    if (!workspaceId) return;
    setPublishing(true);
    setShowPublishConfirm(false);
    try {
      const res = await fetch(`/api/automations/${automationId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });
      if (!res.ok) throw new Error("Failed to publish");
      const json = await res.json();
      if (json.automation) onPublished?.(json.automation);
    } catch {
      // silently fail — user can retry
    } finally {
      setPublishing(false);
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const isPaused = automationStatus === "paused";
  const isActive = automationStatus === "active";
  const isDraft  = automationStatus === "draft";
  const isSavingNow = isSaving || autoSaveStatus === "saving";
  const justSaved   = !hasUnsavedChanges && autoSaveStatus === "saved";

  const manrope = '"Manrope", system-ui, sans-serif';

  const NAV_TABS: { label: AutomationTab; href: string }[] = [
    { label: "Builder",          href: `/marketing/automations/${automationId}/edit` },
    { label: "Statistics",       href: `/marketing/automations/${automationId}/stats` },
    { label: "Contacts in flow", href: `/marketing/automations/${automationId}/contacts` },
    { label: "Logs",             href: `/marketing/automations/${automationId}/logs` },
  ];

  return (
    <>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        paddingInline: 20, paddingBlock: 12,
        borderBottom: "1px solid #DEE8E8", background: "#FFFFFF", flexShrink: 0, zIndex: 10,
        fontFamily: manrope,
      }}>
        {/* ── Left: breadcrumb + editable title + status ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <Link href="/marketing/automations" style={{ color: "#4A5C66", display: "flex", flexShrink: 0 }}>
            <RiArrowLeftLine style={{ width: 16, height: 16 }} />
          </Link>
          <span style={{ fontSize: 13, color: "#7A8A93", flexShrink: 0 }}>Email automation</span>
          <span style={{ color: "#DEE8E8", flexShrink: 0 }}>/</span>

          {editing ? (
            <input
              ref={inputRef}
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitName();
                if (e.key === "Escape") { setEditing(false); setNameInput(automationName); }
              }}
              style={{
                fontSize: 13, fontWeight: 600, color: "#0F2A37",
                background: "transparent", border: "none",
                borderBottom: "2px solid #14C4AE", outline: "none",
                padding: "0 0 2px 0", minWidth: 160,
                fontFamily: manrope,
              }}
            />
          ) : (
            <button
              onClick={() => { setNameInput(automationName); setEditing(true); }}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                fontSize: 13, fontWeight: 600, color: "#0F2A37",
                background: "none", border: "none", cursor: "pointer", padding: 0,
                fontFamily: manrope,
              }}
              className="group"
            >
              {automationName}
              <RiEditLine
                style={{ width: 13, height: 13, color: "#B0BEC5", flexShrink: 0, transition: "color 0.15s" }}
                className="group-hover:!text-[#14C4AE]"
              />
            </button>
          )}

          <AutomationStatusBadge status={automationStatus} />

          {/* Name save status */}
          {nameSaveStatus === "saving" && (
            <span style={{ fontSize: 11, fontWeight: 600, color: "#7A8A93" }}>Saving…</span>
          )}
          {nameSaveStatus === "saved" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "#10B89F" }}>
              <RiCheckLine style={{ width: 12, height: 12 }} /> Saved
            </span>
          )}

          {/* Builder auto-save status */}
          {activeTab === "Builder" && autoSaveStatus === "saving" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: "#7A8A93" }}>
              <svg width="12" height="12" viewBox="0 0 12 12" style={{ animation: "spin 1s linear infinite" }}>
                <circle cx="6" cy="6" r="5" fill="none" stroke="#DEE8E8" strokeWidth="1.5" />
                <path d="M6 1 A5 5 0 0 1 11 6" fill="none" stroke="#14C4AE" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Saving…
            </span>
          )}
          {activeTab === "Builder" && autoSaveStatus === "saved" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: "#10B89F" }}>
              <RiCheckLine style={{ width: 13, height: 13 }} /> Saved
            </span>
          )}
          {activeTab === "Builder" && autoSaveStatus === "error" && (
            <span style={{ fontSize: 11, fontWeight: 600, color: "#E05959", background: "#FFF1F1", borderRadius: 999, paddingInline: 8, paddingBlock: 2 }}>
              Save failed — click Save
            </span>
          )}
          {activeTab === "Builder" && autoSaveStatus === "idle" && hasUnsavedChanges && (
            <span style={{ fontSize: 11, fontWeight: 600, color: "#A08C4A", background: "#FFF8E6", borderRadius: 999, paddingInline: 8, paddingBlock: 2 }}>
              Unsaved
            </span>
          )}
        </div>

        {/* ── Center: tabs ── */}
        <div style={{ display: "inline-flex", background: "#F0F7F7", borderRadius: 999, padding: 4, gap: 4 }}>
          {NAV_TABS.map((tab) => {
            const isActiveTab = tab.label === activeTab;
            return (
              <Link key={tab.label} href={tab.href} style={{ textDecoration: "none" }}>
                <span style={{
                  display: "block", borderRadius: 999, paddingBlock: 6, paddingInline: 14,
                  fontSize: 13, fontWeight: isActiveTab ? 700 : 500,
                  color: isActiveTab ? "#1B1B1B" : "#5F5F5F",
                  background: isActiveTab ? "#FFFFFF" : "transparent",
                  boxShadow: isActiveTab ? "#00000014 0px 4px 16px" : "none",
                  cursor: "pointer", whiteSpace: "nowrap",
                }}>
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>

        {/* ── Right: action buttons (always visible) ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Test run */}
          <button
            onClick={() => setTestRunOpen(true)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "#FFFFFF", border: "1px solid #DEE8E8", borderRadius: 999,
              paddingBlock: 8, paddingInline: 14, cursor: "pointer",
              fontSize: 13, fontWeight: 600, color: "#1B1B1B", fontFamily: manrope,
            }}
          >
            <RiFlashlightLine style={{ width: 14, height: 14 }} />
            Test run
          </button>

          {/* Pause / Resume — only when active or paused */}
          {(isActive || isPaused) && onPauseResume && (
            <button
              onClick={onPauseResume}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "#FFFFFF", border: "1px solid #DEE8E8", borderRadius: 999,
                paddingBlock: 8, paddingInline: 14, cursor: "pointer",
                fontSize: 13, fontWeight: 600, color: "#1B1B1B", fontFamily: manrope,
              }}
            >
              {isPaused
                ? <><RiPlayLine style={{ width: 14, height: 14 }} /> Resume</>
                : <><RiPauseLine style={{ width: 14, height: 14 }} /> Pause</>
              }
            </button>
          )}

          {/* Save changes — Builder only */}
          {onSave && (
            <button
              onClick={onSave}
              disabled={isSavingNow}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                background: justSaved ? "#10B89F" : "#16DAC1",
                border: "none", borderRadius: 999,
                paddingBlock: 8, paddingInline: 16, cursor: isSavingNow ? "default" : "pointer",
                boxShadow: "#14C4AE47 0px 6px 14px",
                fontSize: 13, fontWeight: 700, color: "#FFFFFF",
                opacity: isSavingNow ? 0.7 : 1,
                transition: "background 0.3s",
                fontFamily: manrope,
              }}
            >
              {justSaved
                ? <><RiCheckLine style={{ width: 14, height: 14 }} /> Saved</>
                : isSavingNow
                  ? <><RiSaveLine style={{ width: 14, height: 14 }} /> Saving…</>
                  : <><RiSaveLine style={{ width: 14, height: 14 }} /> Save changes</>
              }
            </button>
          )}

          {/* Publish — only when draft */}
          {isDraft && (
            <button
              onClick={() => setShowPublishConfirm(true)}
              disabled={publishing}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                background: publishing ? "#A3E6DF" : "#0F2A37",
                border: "none", borderRadius: 999,
                paddingBlock: 8, paddingInline: 16, cursor: publishing ? "default" : "pointer",
                fontSize: 13, fontWeight: 700, color: "#FFFFFF",
                opacity: publishing ? 0.75 : 1,
                transition: "background 0.2s",
                fontFamily: manrope,
              }}
            >
              {publishing
                ? <><RiCheckLine style={{ width: 14, height: 14 }} /> Publishing…</>
                : <><RiCheckLine style={{ width: 14, height: 14 }} /> Publish</>
              }
            </button>
          )}

          {/* 3-dot menu */}
          <div className="relative" ref={moreRef}>
            <button
              onClick={() => setMoreOpen((p) => !p)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 36, height: 36, borderRadius: 8,
                border: "1px solid #DEE8E8", background: "#FFFFFF",
                cursor: "pointer", color: "#4A5C66",
              }}
            >
              <RiMoreLine style={{ width: 16, height: 16 }} />
            </button>
            {moreOpen && (
              <div style={{
                position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 50,
                width: 180, background: "#FFFFFF", border: "1px solid #E5EAEC",
                borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
                padding: "4px 0", fontFamily: manrope,
              }}>
                {/* Settings */}
                <button
                  onClick={() => { setMoreOpen(false); setShowSettings(true); }}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 8,
                    padding: "9px 12px", background: "none", border: "none",
                    cursor: "pointer", fontSize: 13, color: "#0F2A37", fontFamily: manrope,
                    textAlign: "left",
                  }}
                  className="hover:bg-[#F5F8F8]"
                >
                  <RiSettings3Line style={{ width: 15, height: 15, color: "#7A8A93" }} /> Automation settings
                </button>
                <div style={{ height: 1, background: "#E5EAEC", margin: "4px 0" }} />

                {onDuplicate && (
                  <button
                    onClick={() => { setMoreOpen(false); onDuplicate(); }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 8,
                      padding: "9px 12px", background: "none", border: "none",
                      cursor: "pointer", fontSize: 13, color: "#0F2A37", fontFamily: manrope,
                      textAlign: "left",
                    }}
                    className="hover:bg-[#F5F8F8]"
                  >
                    <RiFileCopyLine style={{ width: 15, height: 15, color: "#7A8A93" }} /> Duplicate
                  </button>
                )}
                <div style={{ height: 1, background: "#E5EAEC", margin: "4px 0" }} />
                <button
                  onClick={() => setMoreOpen(false)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 8,
                    padding: "9px 12px", background: "none", border: "none",
                    cursor: "pointer", fontSize: 13, color: "#0F2A37", fontFamily: manrope,
                    textAlign: "left",
                  }}
                  className="hover:bg-[#F5F8F8]"
                >
                  <RiArchiveLine style={{ width: 15, height: 15, color: "#7A8A93" }} /> Archive
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Test run dialog ── */}
      <Dialog open={testRunOpen} onOpenChange={(v) => { if (!v) { setTestRunOpen(false); setTestEmail(""); setTestResults(null); } }}>
        <DialogContent size="sm" hideClose>
          {/* Header */}
          <div className="flex items-start gap-4 p-6 pb-0">
            <div className="shrink-0 size-11 rounded-xl bg-primary-subtle flex items-center justify-center">
              <RiFlashlightLine size={20} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-semibold text-foreground">
                Test run
              </DialogTitle>
              <p className="mt-1 text-sm text-foreground-muted leading-relaxed">
                Send all email steps to a test address at once — no delays applied.
              </p>
            </div>
          </div>

          {/* Input */}
          <div className="px-6 mt-5">
            <label className="text-sm font-medium text-foreground block mb-1.5">
              Test email address
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && testEmail) handleTestRun(); }}
              autoFocus
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none placeholder:text-foreground-muted focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors"
              style={{ fontFamily: manrope }}
            />
          </div>

          {/* Result */}
          {testResults && (
            <div className="mx-6 mt-3 rounded-lg border border-border bg-background-subtle px-3 py-3 text-sm flex flex-col gap-1.5">
              {testResults.messages.map((msg, i) => {
                // First message when success = sent count (green); all errors = red
                const isSuccess = testResults.success && i === 0;
                return (
                  <div key={i} className={cn(
                    "flex items-start gap-2 font-medium",
                    isSuccess ? "text-[#10B89F]" : "text-destructive"
                  )}>
                    <span className="shrink-0">{isSuccess ? "✓" : "✗"}</span>
                    <span>{msg}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-5 mt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setTestRunOpen(false); setTestEmail(""); setTestResults(null); }}
              disabled={testRunning}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleTestRun}
              disabled={!testEmail || testRunning}
            >
              <RiSendPlaneLine size={14} />
              {testRunning ? "Sending…" : "Send test"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Automation settings dialog ── */}
      <Dialog open={showSettings} onOpenChange={(v) => { if (!v) setShowSettings(false); }}>
        <DialogContent size="sm" hideClose>
          {/* Header */}
          <div className="flex items-start gap-4 p-6 pb-0">
            <div className="shrink-0 size-11 rounded-xl bg-primary-subtle flex items-center justify-center">
              <RiSettings3Line size={20} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-semibold text-foreground">
                Automation settings
              </DialogTitle>
              <p className="mt-1 text-sm text-foreground-muted leading-relaxed">
                Configure send window and delivery preferences.
              </p>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 mt-5 space-y-5">
            {/* Send window toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Send window</p>
                <p className="text-xs text-foreground-muted mt-0.5">Only send emails during specified hours</p>
              </div>
              <button
                type="button"
                onClick={() => setSwEnabled((p) => !p)}
                style={{
                  width: 40, height: 22, borderRadius: 999, border: "none", cursor: "pointer",
                  background: swEnabled ? "#16DAC1" : "#DEE8E8",
                  position: "relative", flexShrink: 0, transition: "background 0.2s",
                }}
                aria-checked={swEnabled}
                role="switch"
              >
                <span style={{
                  position: "absolute", top: 3, left: swEnabled ? 21 : 3,
                  width: 16, height: 16, borderRadius: "50%", background: "#FFFFFF",
                  transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }} />
              </button>
            </div>

            {/* Time range */}
            {swEnabled && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-foreground-muted block mb-1.5">Start time</label>
                    <input
                      type="time"
                      value={swStart}
                      onChange={(e) => setSwStart(e.target.value)}
                      className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors"
                      style={{ fontFamily: manrope }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground-muted block mb-1.5">End time</label>
                    <input
                      type="time"
                      value={swEnd}
                      onChange={(e) => setSwEnd(e.target.value)}
                      className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors"
                      style={{ fontFamily: manrope }}
                    />
                  </div>
                </div>

                {/* Timezone */}
                <div>
                  <label className="text-xs font-semibold text-foreground-muted block mb-1.5">Timezone</label>
                  <select
                    value={swTimezone}
                    onChange={(e) => setSwTimezone(e.target.value)}
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-colors"
                    style={{ fontFamily: manrope }}
                  >
                    <optgroup label="Asia">
                      <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
                      <option value="Asia/Makassar">Asia/Makassar (WITA)</option>
                      <option value="Asia/Jayapura">Asia/Jayapura (WIT)</option>
                      <option value="Asia/Singapore">Asia/Singapore</option>
                      <option value="Asia/Kuala_Lumpur">Asia/Kuala_Lumpur</option>
                      <option value="Asia/Bangkok">Asia/Bangkok</option>
                      <option value="Asia/Tokyo">Asia/Tokyo</option>
                      <option value="Asia/Shanghai">Asia/Shanghai</option>
                      <option value="Asia/Kolkata">Asia/Kolkata</option>
                    </optgroup>
                    <optgroup label="Europe">
                      <option value="Europe/London">Europe/London</option>
                      <option value="Europe/Paris">Europe/Paris</option>
                      <option value="Europe/Berlin">Europe/Berlin</option>
                    </optgroup>
                    <optgroup label="Americas">
                      <option value="America/New_York">America/New_York</option>
                      <option value="America/Chicago">America/Chicago</option>
                      <option value="America/Denver">America/Denver</option>
                      <option value="America/Los_Angeles">America/Los_Angeles</option>
                      <option value="America/Sao_Paulo">America/Sao_Paulo</option>
                    </optgroup>
                    <optgroup label="UTC">
                      <option value="UTC">UTC</option>
                    </optgroup>
                  </select>
                </div>

                {/* Skip weekends */}
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={swSkipWeekends}
                    onChange={(e) => setSwSkipWeekends(e.target.checked)}
                    className="size-4 rounded border-border accent-primary cursor-pointer"
                  />
                  <span className="text-sm text-foreground">Skip weekends (Saturday &amp; Sunday)</span>
                </label>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-5 mt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowSettings(false)}
              disabled={swSaving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveSettings}
              disabled={swSaving}
            >
              <RiCheckLine size={14} />
              {swSaving ? "Saving…" : "Save settings"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Publish confirmation dialog ── */}
      <Dialog open={showPublishConfirm} onOpenChange={(v) => { if (!v) setShowPublishConfirm(false); }}>
        <DialogContent size="sm" hideClose>
          {/* Header */}
          <div className="flex items-start gap-4 p-6 pb-0">
            <div className="shrink-0 size-11 rounded-xl bg-primary-subtle flex items-center justify-center">
              <RiGlobalLine size={20} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-semibold text-foreground">
                Publish automation
              </DialogTitle>
              <p className="mt-1 text-sm text-foreground-muted leading-relaxed">
                Contacts matching the trigger will start enrolling immediately once published.
              </p>
            </div>
          </div>

          {/* Checklist card */}
          <div className="mx-6 mt-5 rounded-xl border border-border bg-background-subtle p-4">
            <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wide mb-3">
              Before you publish
            </p>
            <ul className="space-y-2.5">
              {[
                "Emails will be sent to real contacts",
                "You can pause the automation at any time",
                "Unsaved changes in the Builder will not be included",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-foreground">
                  <span className="shrink-0 mt-0.5 size-4 rounded-full bg-primary/15 flex items-center justify-center">
                    <RiCheckLine size={10} className="text-primary" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-5 mt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowPublishConfirm(false)}
              disabled={publishing}
            >
              Cancel
            </Button>
            <Button
              variant="inverse"
              size="sm"
              onClick={handlePublish}
              disabled={publishing}
            >
              <RiGlobalLine size={14} />
              {publishing ? "Publishing…" : "Publish now"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
