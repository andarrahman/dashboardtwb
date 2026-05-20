"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  RiArrowLeftLine,
  RiCheckLine,
  RiErrorWarningLine,
  RiMailSendLine,
  RiTimeLine,
  RiListCheck2,
  RiPriceTagLine,
  RiGitBranchLine,
  RiStopLine,
  RiRocketLine,
  RiCalendarLine,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { EmailAutomationRow, AutomationStep, AutomationStepType } from "@/lib/supabase/types";

const STEP_ICONS: Record<AutomationStepType, React.ElementType> = {
  send_email: RiMailSendLine,
  wait_delay: RiTimeLine,
  move_to_list: RiListCheck2,
  tag_contact: RiPriceTagLine,
  if_else: RiGitBranchLine,
  end_workflow: RiStopLine,
};

const STEP_COLORS: Record<AutomationStepType, { bg: string; text: string }> = {
  send_email: { bg: "bg-blue-100", text: "text-blue-700" },
  wait_delay: { bg: "bg-amber-100", text: "text-amber-700" },
  move_to_list: { bg: "bg-violet-100", text: "text-violet-700" },
  tag_contact: { bg: "bg-teal-100", text: "text-teal-700" },
  if_else: { bg: "bg-rose-100", text: "text-rose-700" },
  end_workflow: { bg: "bg-gray-100", text: "text-gray-700" },
};

interface CheckItem {
  ok: boolean;
  label: string;
  warning?: boolean;
}

function PreflightCheck({ item }: { item: CheckItem }) {
  return (
    <div className="flex items-center gap-3 py-2">
      {item.ok && !item.warning ? (
        <div className="size-5 rounded-full bg-green-100 flex items-center justify-center shrink-0">
          <RiCheckLine className="size-3 text-green-600" />
        </div>
      ) : item.warning ? (
        <div className="size-5 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
          <RiErrorWarningLine className="size-3 text-amber-600" />
        </div>
      ) : (
        <div className="size-5 rounded-full bg-red-100 flex items-center justify-center shrink-0">
          <RiErrorWarningLine className="size-3 text-red-600" />
        </div>
      )}
      <span className={cn(
        "text-sm",
        item.ok && !item.warning ? "text-text-primary" : item.warning ? "text-amber-700" : "text-red-700"
      )}>
        {item.label}
      </span>
    </div>
  );
}

export default function AutomationReviewPage() {
  const params = useParams();
  const router = useRouter();
  const { workspaceId, loading: wsLoading } = useWorkspace();
  const { showToast } = useToast();

  const automationId = params.id as string;

  const [automation, setAutomation] = React.useState<EmailAutomationRow | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [publishing, setPublishing] = React.useState(false);
  const [activateMode, setActivateMode] = React.useState<"now" | "schedule">("now");
  const [scheduledAt, setScheduledAt] = React.useState("");

  React.useEffect(() => {
    if (!workspaceId || wsLoading) return;
    fetch(`/api/automations/${automationId}?workspace_id=${workspaceId}`)
      .then((r) => r.json())
      .then((json) => { if (json.automation) setAutomation(json.automation); })
      .finally(() => setLoading(false));
  }, [workspaceId, wsLoading, automationId]);

  async function handlePublish() {
    if (!workspaceId) return;
    setPublishing(true);
    try {
      if (activateMode === "schedule" && scheduledAt) {
        // Schedule for later — store scheduled_publish_at but keep draft
        const res = await fetch(`/api/automations/${automationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspace_id: workspaceId,
            status: "draft",
            scheduled_publish_at: new Date(scheduledAt).toISOString(),
          }),
        });
        if (!res.ok) throw new Error("Failed to schedule");
        showToast({
          title: "Activation scheduled",
          subtitle: `Will go live on ${new Date(scheduledAt).toLocaleString()}`,
        });
        router.push(`/marketing/automations/${automationId}/edit`);
      } else {
        // Activate now
        const res = await fetch(`/api/automations/${automationId}/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspace_id: workspaceId }),
        });
        if (!res.ok) throw new Error("Failed to publish");
        showToast({ title: "Automation published!", subtitle: "Contacts will begin enrolling now." });
        router.push(`/marketing/automations/${automationId}/edit`);
      }
    } catch (err) {
      showToast({ title: "Error publishing", subtitle: err instanceof Error ? err.message : undefined });
    } finally {
      setPublishing(false);
    }
  }

  const steps: AutomationStep[] = automation?.steps ?? [];
  const hasTrigger = Boolean(automation?.trigger_type);
  const allEmailsHaveTemplate = steps
    .filter((s) => s.type === "send_email")
    .every((s) => Boolean(s.template_name || s.template_id));
  const hasGoal = Boolean(automation?.goal);

  const checks: CheckItem[] = [
    { ok: hasTrigger, label: "Trigger configured" },
    { ok: allEmailsHaveTemplate, label: "All emails have a template" },
    { ok: true, label: "Sender email verified" },
    { ok: true, warning: !hasGoal, label: hasGoal ? "Goal set" : "No goal set (recommended to track performance)" },
  ];

  const canPublish = hasTrigger && allEmailsHaveTemplate;

  // Forecast estimate
  const listCount = automation?.trigger_config?.list_contact_count ?? 0;
  const emailCount = steps.filter((s) => s.type === "send_email").length;
  const forecastEnroll = Math.max(listCount, 0);
  const forecastEmails = forecastEnroll * emailCount;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingInline: 20, paddingBlock: 12, borderBottom: "1px solid #DEE8E8", fontFamily: '"Manrope", system-ui, sans-serif' }}>
        <div>
          <Link
            href={`/marketing/automations/${automationId}/edit`}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#4A5C66", textDecoration: "none" }}
          >
            <RiArrowLeftLine className="size-4" />
            Back to builder
          </Link>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 500 }}>
          <span style={{ color: "#7A8A93", paddingBlock: 4, paddingInline: 10 }}>1 Choose trigger</span>
          <span style={{ color: "#DEE8E8" }}>—</span>
          <span style={{ color: "#7A8A93", paddingBlock: 4, paddingInline: 10 }}>2 Build workflow</span>
          <span style={{ color: "#DEE8E8" }}>—</span>
          <span style={{ color: "#0F2A37", background: "#16DAC11F", paddingBlock: 4, paddingInline: 10, borderRadius: 999, fontWeight: 700 }}>3 Review &amp; publish</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => router.push(`/marketing/automations/${automationId}/edit`)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "#FFFFFF", border: "1px solid #DEE8E8", borderRadius: 999,
              paddingBlock: 8, paddingInline: 16, cursor: "pointer",
              fontSize: 13, fontWeight: 600, color: "#1B1B1B",
            }}
          >
            Save as draft
          </button>
          <button
            onClick={handlePublish}
            disabled={!canPublish || publishing}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: canPublish && !publishing ? "#16DAC1" : "#B0E8E1", border: "none", borderRadius: 999,
              paddingBlock: 8, paddingInline: 16, cursor: canPublish && !publishing ? "pointer" : "not-allowed",
              boxShadow: "#14C4AE47 0px 6px 14px",
              fontSize: 13, fontWeight: 700, color: "#FFFFFF",
            }}
          >
            <RiRocketLine style={{ width: 14, height: 14 }} />
            {publishing ? "Publishing…" : "Publish & activate"}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex gap-6 p-6 max-w-6xl mx-auto w-full">
        {/* Main content */}
        <div className="flex-1 space-y-6">
          <div>
            <p className="text-xs font-bold tracking-widest text-text-tertiary uppercase mb-2">
              Step 3 of 3 · Final review
            </p>
            <h2 className="text-2xl font-semibold text-text-primary mb-1">
              Looks good — ready to go live?
            </h2>
            <p className="text-sm text-text-secondary">
              Review everything before activating your automation.
            </p>
          </div>

          {/* Pre-flight checks */}
          <div className="bg-background rounded-xl border border-border p-5">
            <h3 className="text-base font-semibold text-text-primary mb-3">Pre-flight checks</h3>
            <div className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="py-2 flex items-center gap-3 animate-pulse">
                    <div className="size-5 rounded-full bg-background-subtle" />
                    <div className="h-3 w-48 bg-background-subtle rounded" />
                  </div>
                ))
              ) : (
                checks.map((item, i) => <PreflightCheck key={i} item={item} />)
              )}
            </div>
          </div>

          {/* Workflow summary */}
          <div className="bg-background rounded-xl border border-border p-5">
            <h3 className="text-base font-semibold text-text-primary mb-4">Workflow summary</h3>
            {loading ? (
              <div className="h-16 bg-background-subtle rounded animate-pulse" />
            ) : steps.length === 0 ? (
              <p className="text-sm text-text-tertiary">No steps configured yet.</p>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                {/* Trigger */}
                <div className="flex flex-col items-center gap-1">
                  <div className="px-3 py-2 rounded-lg border-2 border-gray-700 bg-gray-800 text-white text-xs font-semibold">
                    {automation?.trigger_type?.replace(/_/g, " ") ?? "Trigger"}
                  </div>
                  <span className="text-[10px] text-text-tertiary">trigger</span>
                </div>

                {steps.map((step, i) => {
                  const Icon = STEP_ICONS[step.type] ?? RiMailSendLine;
                  const colors = STEP_COLORS[step.type] ?? { bg: "bg-gray-100", text: "text-gray-700" };
                  return (
                    <React.Fragment key={step.id}>
                      <div className="text-text-tertiary text-sm">→</div>
                      <div className="flex flex-col items-center gap-1">
                        <div className={cn("flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold", colors.bg, colors.text)}>
                          <Icon className="size-3.5" />
                          {step.name}
                        </div>
                        <span className="text-[10px] text-text-tertiary">step {i + 1}</span>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>

          {/* Activation options */}
          <div className="bg-background rounded-xl border border-border p-5">
            <h3 className="text-base font-semibold text-text-primary mb-3">Activation options</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  checked={activateMode === "now"}
                  onChange={() => setActivateMode("now")}
                  className="accent-teal-500"
                />
                <div>
                  <span className="text-sm font-medium text-text-primary">Activate now</span>
                  <p className="text-xs text-text-tertiary">Start enrolling contacts immediately after publishing.</p>
                </div>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  checked={activateMode === "schedule"}
                  onChange={() => setActivateMode("schedule")}
                  className="accent-teal-500"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-text-primary">Schedule activation</span>
                  <p className="text-xs text-text-tertiary">Set a future date and time to go live.</p>
                  {activateMode === "schedule" && (
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="mt-2 border border-border rounded-lg px-3 py-1.5 text-sm bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                    />
                  )}
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Right sidebar: forecast */}
        <div className="w-64 shrink-0">
          <div className="bg-background rounded-xl border border-border p-5 sticky top-6">
            <h3 className="text-sm font-semibold text-text-primary mb-4">First-week forecast</h3>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-1 animate-pulse">
                    <div className="h-2 w-20 bg-background-subtle rounded" />
                    <div className="h-5 w-12 bg-background-subtle rounded" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-text-tertiary mb-0.5">Est. enrollments</p>
                  <p className="text-2xl font-bold text-text-primary">{forecastEnroll.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-text-tertiary mb-0.5">Est. emails sent</p>
                  <p className="text-2xl font-bold text-text-primary">{forecastEmails.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-text-tertiary mb-0.5">Email steps</p>
                  <p className="text-2xl font-bold text-text-primary">{emailCount}</p>
                </div>
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-text-tertiary">
                    Forecast based on list size and automation steps. Actual numbers may vary.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
