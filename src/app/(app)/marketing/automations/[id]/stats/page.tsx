"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import {
  RiDownloadLine,
  RiUserLine,
  RiMailOpenLine,
  RiCursorLine,
  RiCheckLine,
  RiLogoutBoxLine,
  RiBarChartBoxLine,
} from "@remixicon/react";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/browser";
import { AutomationHeader } from "@/components/marketing/automation-header";
import type { EmailAutomationRow, AutomationStep, AutomationStatus } from "@/lib/supabase/types";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface StatsData {
  total_enrolled: number;
  total_completed: number;
  total_active: number;
  total_exited: number;
  avg_open_rate: number | null;
  avg_click_rate: number | null;
  completion_rate: number | null;
}

interface StepStat { sent: number; opens: number; clicks: number }

// ─── Helpers ───────────────────────────────────────────────────────────────────

function exportStatsCSV(
  name: string,
  steps: AutomationStep[],
  stats: StatsData | null,
  stepStats: Map<number, StepStat>,
) {
  const rows = [
    ["Step", "Type", "Reached", "Opens", "Clicks", "Open Rate", "Click Rate"],
    ...steps.map((s, i) => {
      const st = stepStats.get(i);
      if (s.type === "send_email" && st) {
        const openRate  = st.sent > 0 ? ((st.opens  / st.sent) * 100).toFixed(1) + "%" : "0.0%";
        const clickRate = st.sent > 0 ? ((st.clicks / st.sent) * 100).toFixed(1) + "%" : "0.0%";
        return [`${i + 1}. ${s.name}`, "send email", String(st.sent), String(st.opens), String(st.clicks), openRate, clickRate];
      }
      return [`${i + 1}. ${s.name}`, s.type.replace(/_/g, " "), "—", "N/A", "N/A", "N/A", "N/A"];
    }),
    [],
    ["Summary"],
    ["Total enrolled",   String(stats?.total_enrolled  ?? 0)],
    ["Total completed",  String(stats?.total_completed ?? 0)],
    ["Completion rate",  stats?.completion_rate != null ? `${stats.completion_rate}%` : "—"],
    ["Avg open rate",    stats?.avg_open_rate  != null ? `${stats.avg_open_rate.toFixed(1)}%`  : "—"],
    ["Avg click rate",   stats?.avg_click_rate != null ? `${stats.avg_click_rate.toFixed(1)}%` : "—"],
  ];
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `automation-stats-${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ─── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, iconBg, iconFg, value, label, sub }: {
  icon: React.ElementType; iconBg: string; iconFg: string;
  value: string | number; label: string; sub?: string;
}) {
  const manrope: React.CSSProperties = { fontFamily: '"Manrope", system-ui, sans-serif' };
  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #E5EAEC", borderRadius: 14, padding: 20, ...manrope }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, marginBottom: 16,
        background: iconBg, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon style={{ width: 18, height: 18, color: iconFg }} />
      </div>
      <p style={{ fontSize: 26, fontWeight: 700, color: "#0F2A37", margin: 0, lineHeight: "32px" }}>{value}</p>
      <p style={{ fontSize: 13, fontWeight: 500, color: "#4A5C66", marginTop: 5 }}>{label}</p>
      {sub && <p style={{ fontSize: 11, color: "#7A8A93", marginTop: 3 }}>{sub}</p>}
    </div>
  );
}

// ─── Skeleton cards ────────────────────────────────────────────────────────────

function StatCardSkeleton() {
  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #E5EAEC", borderRadius: 14, padding: 20 }} className="animate-pulse">
      <div style={{ width: 40, height: 40, borderRadius: 10, background: "#EAEEF0", marginBottom: 16 }} />
      <div style={{ height: 26, width: 60, background: "#EAEEF0", borderRadius: 6, marginBottom: 8 }} />
      <div style={{ height: 12, width: 100, background: "#EAEEF0", borderRadius: 4 }} />
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────

const DATE_RANGE_OPTIONS = [
  { value: "30",  label: "Last 30 days" },
  { value: "7",   label: "Last 7 days" },
  { value: "90",  label: "Last 90 days" },
  { value: "all", label: "All time" },
];

export default function AutomationStatsPage() {
  const params = useParams();
  const { workspaceId, loading: wsLoading } = useWorkspace();
  const { showToast } = useToast();

  const automationId = params.id as string;

  const [automation, setAutomation]       = React.useState<EmailAutomationRow | null>(null);
  const [stats, setStats]                 = React.useState<StatsData | null>(null);
  const [loading, setLoading]             = React.useState(true);
  const [stepStats, setStepStats]         = React.useState<Map<number, StepStat>>(new Map());
  const [goalAchievedCount, setGoalAchievedCount] = React.useState(0);
  const [dateRange, setDateRange]         = React.useState("30");

  React.useEffect(() => {
    if (!workspaceId || wsLoading) return;
    const supabase = createClient();

    Promise.all([
      fetch(`/api/automations/${automationId}?workspace_id=${workspaceId}`).then((r) => r.json()),
      fetch(`/api/automations/${automationId}/stats?workspace_id=${workspaceId}`).then((r) => r.json()),
      (supabase as any)
        .from("automation_logs")
        .select("event_type, metadata")
        .eq("automation_id", automationId)
        .eq("workspace_id", workspaceId)
        .in("event_type", ["email_sent", "opened", "clicked"]),
      (supabase as any)
        .from("automation_enrollments")
        .select("id")
        .eq("automation_id", automationId)
        .eq("workspace_id", workspaceId)
        .eq("exit_reason", "goal_achieved"),
    ])
      .then(([autoJson, statsJson, logsRes, goalRes]: [
        { automation?: EmailAutomationRow },
        { stats?: StatsData },
        { data: { event_type: string; metadata: Record<string, unknown> | null }[] | null },
        { data: { id: string }[] | null },
      ]) => {
        if (autoJson.automation) setAutomation(autoJson.automation);
        if (statsJson.stats) setStats(statsJson.stats);
        setGoalAchievedCount((goalRes.data ?? []).length);

        const map = new Map<number, StepStat>();
        for (const log of logsRes.data ?? []) {
          const idx = (log.metadata as { step_index?: number } | null)?.step_index ?? 0;
          const s = map.get(idx) ?? { sent: 0, opens: 0, clicks: 0 };
          if (log.event_type === "email_sent") s.sent++;
          else if (log.event_type === "opened") s.opens++;
          else if (log.event_type === "clicked") s.clicks++;
          map.set(idx, s);
        }
        setStepStats(map);
      })
      .catch(() => showToast({ title: "Error loading statistics" }))
      .finally(() => setLoading(false));
  }, [workspaceId, wsLoading, automationId, showToast]);

  async function handlePauseResume() {
    if (!workspaceId || !automation) return;
    try {
      const res = await fetch(`/api/automations/${automationId}/pause`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });
      const json = await res.json();
      if (json.automation) setAutomation(json.automation);
    } catch { showToast({ title: "Error" }); }
  }

  async function handleDuplicate() {
    if (!workspaceId) return;
    try {
      const res = await fetch(`/api/automations/${automationId}/duplicate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });
      const json = await res.json();
      if (json.automation) showToast({ title: "Duplicated", subtitle: `${json.automation.name} created as draft` });
    } catch { showToast({ title: "Error duplicating" }); }
  }

  const manrope: React.CSSProperties = { fontFamily: '"Manrope", system-ui, sans-serif' };
  const dateLabel = DATE_RANGE_OPTIONS.find((o) => o.value === dateRange)?.label ?? "Last 30 days";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#FFFFFF" }}>

      {/* ── Top bar ── */}
      {automation && (
        <AutomationHeader
          automationId={automationId}
          automationName={automation.name}
          automationStatus={automation.status}
          activeTab="Statistics"
          onNameSaved={(name) => setAutomation({ ...automation, name })}
          onPauseResume={handlePauseResume}
          onDuplicate={handleDuplicate}
          onPublished={(a) => setAutomation((prev) => prev ? { ...prev, status: a.status as typeof prev.status } : prev)}
          triggerConfig={automation.trigger_config as { send_window?: { enabled?: boolean; start?: string; end?: string; timezone?: string; skip_weekends?: boolean } } | undefined}
          onSettingsSaved={(updated) => setAutomation((prev) => prev ? { ...prev, trigger_config: { ...(prev.trigger_config ?? {}), ...updated } } : prev)}
        />
      )}

      {/* ── Body ── */}
      <div style={{ flex: 1, overflow: "auto", padding: 32, display: "flex", flexDirection: "column", gap: 28 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#8D8D8D", margin: 0 }}>
              Workflow performance
            </p>
            <h2 style={{ fontSize: 28, fontWeight: 700, color: "#1B1B1B", margin: "6px 0 0", lineHeight: "34px", ...manrope }}>
              Statistics
            </h2>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Date range pill tabs */}
            <div style={{ display: "inline-flex", background: "#F0F7F7", borderRadius: 999, padding: 4, gap: 2 }}>
              {DATE_RANGE_OPTIONS.map((opt) => {
                const isActive = dateRange === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setDateRange(opt.value)}
                    style={{
                      borderRadius: 999, paddingBlock: 6, paddingInline: 12,
                      border: "none", cursor: "pointer",
                      background: isActive ? "#FFFFFF" : "transparent",
                      boxShadow: isActive ? "#00000014 0px 4px 16px" : "none",
                      fontSize: 12, fontWeight: isActive ? 700 : 500,
                      color: isActive ? "#1B1B1B" : "#5F5F5F",
                      transition: "all 0.15s", ...manrope,
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => exportStatsCSV(automation?.name ?? "automation", automation?.steps ?? [], stats, stepStats)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "#FFFFFF", border: "1px solid #DEE8E8", borderRadius: 999,
                paddingBlock: 8, paddingInline: 16, cursor: "pointer",
                fontSize: 13, fontWeight: 600, color: "#1B1B1B", ...manrope,
              }}
            >
              <RiDownloadLine style={{ width: 14, height: 14 }} />
              Export CSV
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)
          ) : (
            <>
              <StatCard
                icon={RiUserLine}
                iconBg="#16DAC124" iconFg="#14C4AE"
                value={(stats?.total_enrolled ?? 0).toLocaleString()}
                label="Total enrolled"
              />
              <StatCard
                icon={RiMailOpenLine}
                iconBg="#3B82F61F" iconFg="#2563EB"
                value={stats?.avg_open_rate != null ? `${stats.avg_open_rate.toFixed(1)}%` : "—"}
                label="Avg open rate"
                sub="Per email step"
              />
              <StatCard
                icon={RiCursorLine}
                iconBg="#8B5CF61F" iconFg="#7C3AED"
                value={stats?.avg_click_rate != null ? `${stats.avg_click_rate.toFixed(1)}%` : "—"}
                label="Avg click rate"
                sub="Per email step"
              />
              <StatCard
                icon={RiCheckLine}
                iconBg="#22C55E1F" iconFg="#16A34A"
                value={stats?.completion_rate != null ? `${stats.completion_rate}%` : "—"}
                label="Completion rate"
                sub={`${stats?.total_completed ?? 0} completed`}
              />
              <StatCard
                icon={RiLogoutBoxLine}
                iconBg="#FFB80026" iconFg="#D97706"
                value={(stats?.total_exited ?? 0).toLocaleString()}
                label="Early exits"
                sub="Before completion"
              />
            </>
          )}
        </div>

        {/* Goal banner */}
        {automation?.goal && !loading && (
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 14,
            background: "#16DAC10A", border: "1px solid #16DAC133",
            borderRadius: 14, padding: 18,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9, flexShrink: 0,
              background: "#16DAC124", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <RiCheckLine style={{ width: 16, height: 16, color: "#14C4AE" }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#0D6B5E", margin: 0, ...manrope }}>
                Automation goal
              </p>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#0F2A37", marginTop: 4, ...manrope }}>
                {automation.goal}
              </p>
            </div>
            {stats && stats.total_enrolled > 0 && (
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <p style={{ fontSize: 22, fontWeight: 700, color: "#0D9488", margin: 0, ...manrope }}>
                  {((goalAchievedCount / stats.total_enrolled) * 100).toFixed(1)}%
                </p>
                <p style={{ fontSize: 11, color: "#0D6B5E", marginTop: 2, ...manrope }}>
                  {goalAchievedCount} achieved
                </p>
              </div>
            )}
          </div>
        )}

        {/* Per-step performance */}
        {!loading && automation && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: "#0F2A37", margin: 0, ...manrope }}>
                Per-step performance
              </p>
              <div style={{ flex: 1, height: 1, background: "#E5EAEC" }} />
            </div>

            {(automation.steps ?? []).length === 0 ? (
              /* Empty state */
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", paddingBlock: 60, gap: 14,
                border: "1px solid #E5EAEC", borderRadius: 14, ...manrope,
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: "50%",
                  background: "#16DAC124", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <RiBarChartBoxLine style={{ width: 22, height: 22, color: "#14C4AE" }} />
                </div>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#0F2A37", margin: 0 }}>No steps yet</p>
                  <p style={{ fontSize: 13, color: "#7A8A93", marginTop: 5 }}>Add steps in the builder to see per-step stats.</p>
                </div>
              </div>
            ) : (
              /* Steps table */
              <div style={{ background: "#FFFFFF", border: "1px solid #E5EAEC", borderRadius: 14, overflow: "clip" }}>
                {/* Header */}
                <div style={{
                  display: "flex", alignItems: "center",
                  background: "#F8FAFB", borderBottom: "1px solid #E5EAEC",
                  paddingBlock: 12, paddingInline: 20,
                }}>
                  {[
                    { label: "STEP",        w: 280 },
                    { label: "TYPE",        w: 160 },
                    { label: "REACHED",     w: 100 },
                    { label: "PERFORMANCE", w: undefined },
                  ].map(({ label, w }) => (
                    <div key={label} style={{
                      width: w, flex: w ? undefined : 1, flexShrink: 0,
                      fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
                      textTransform: "uppercase", color: "#4A5C66", ...manrope,
                    }}>
                      {label}
                    </div>
                  ))}
                </div>

                {/* Rows */}
                {(automation.steps ?? []).map((step: AutomationStep, i: number) => {
                  const s = stepStats.get(i);
                  const sent = s?.sent ?? 0;
                  const opens = s?.opens ?? 0;
                  const clicks = s?.clicks ?? 0;
                  const openRate = sent > 0 ? (opens / sent) * 100 : null;
                  const clickRate = sent > 0 ? (clicks / sent) * 100 : null;

                  return (
                    <div
                      key={step.id}
                      style={{
                        display: "flex", alignItems: "center",
                        paddingBlock: 14, paddingInline: 20,
                        borderBottom: i < (automation.steps ?? []).length - 1 ? "1px solid #EAEEF0" : "none",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#F8FAFB")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* Step name */}
                      <div style={{ width: 280, flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                          background: "#F0F7F7", display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: 700, color: "#7A8A93", ...manrope,
                        }}>
                          {i + 1}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#0F2A37", ...manrope }}>{step.name}</span>
                      </div>

                      {/* Type */}
                      <div style={{ width: 160, flexShrink: 0, fontSize: 12, color: "#7A8A93", ...manrope }}>
                        {step.type.replace(/_/g, " ")}
                      </div>

                      {/* Reached */}
                      <div style={{ width: 100, flexShrink: 0, fontSize: 13, fontWeight: 600, color: "#0F2A37", ...manrope }}>
                        {step.type === "send_email" ? sent.toLocaleString() : "—"}
                      </div>

                      {/* Performance bars */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {step.type === "send_email" ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {/* Open rate */}
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 11, color: "#7A8A93", width: 36, flexShrink: 0, ...manrope }}>Open</span>
                              <div style={{ flex: 1, height: 5, background: "#EAEEF0", borderRadius: 99 }}>
                                <div style={{
                                  height: 5, background: "#3B82F6", borderRadius: 99,
                                  width: openRate != null ? `${Math.min(openRate, 100)}%` : "0%",
                                  transition: "width 0.6s ease",
                                }} />
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 600, color: "#0F2A37", width: 44, textAlign: "right", flexShrink: 0, ...manrope }}>
                                {openRate != null ? `${openRate.toFixed(1)}%` : "—"}
                              </span>
                            </div>
                            {/* Click rate */}
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 11, color: "#7A8A93", width: 36, flexShrink: 0, ...manrope }}>Click</span>
                              <div style={{ flex: 1, height: 5, background: "#EAEEF0", borderRadius: 99 }}>
                                <div style={{
                                  height: 5, background: "#8B5CF6", borderRadius: 99,
                                  width: clickRate != null ? `${Math.min(clickRate, 100)}%` : "0%",
                                  transition: "width 0.6s ease",
                                }} />
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 600, color: "#0F2A37", width: 44, textAlign: "right", flexShrink: 0, ...manrope }}>
                                {clickRate != null ? `${clickRate.toFixed(1)}%` : "—"}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: "#B0BEC5", ...manrope }}>N/A</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Skeleton for per-step */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ height: 14, width: 160, background: "#EAEEF0", borderRadius: 4 }} className="animate-pulse" />
            <div style={{ background: "#FFFFFF", border: "1px solid #E5EAEC", borderRadius: 14, overflow: "clip" }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 16,
                  paddingBlock: 16, paddingInline: 20,
                  borderBottom: i < 2 ? "1px solid #EAEEF0" : "none",
                }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#EAEEF0", flexShrink: 0 }} className="animate-pulse" />
                  <div style={{ width: 120, height: 12, background: "#EAEEF0", borderRadius: 4 }} className="animate-pulse" />
                  <div style={{ flex: 1, height: 12, background: "#EAEEF0", borderRadius: 4 }} className="animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
