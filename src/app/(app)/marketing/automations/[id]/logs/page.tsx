"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import {
  RiDownloadLine,
  RiRefreshLine,
  RiCheckLine,
  RiMailSendLine,
  RiMailOpenLine,
  RiCursorLine,
  RiLogoutBoxLine,
  RiErrorWarningLine,
  RiFlowChart,
  RiPauseLine,
  RiPlayLine,
  RiUploadCloud2Line,
  RiFileListLine,
} from "@remixicon/react";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { useToast } from "@/components/ui/toast";
import { AutomationHeader } from "@/components/marketing/automation-header";
import type { EmailAutomationRow, AutomationLogRow, AutomationEventType, AutomationStatus } from "@/lib/supabase/types";

// ─── Event config ──────────────────────────────────────────────────────────────

const EVENT_CONFIGS: Record<AutomationEventType, { label: string; icon: React.ElementType; dot: string; bg: string; fg: string }> = {
  enrolled:      { label: "Enrolled",      icon: RiCheckLine,         dot: "#14C4AE", bg: "#16DAC11F", fg: "#0D6B5E" },
  email_sent:    { label: "Email sent",    icon: RiMailSendLine,      dot: "#3B82F6", bg: "#3B82F61F", fg: "#1D4ED8" },
  opened:        { label: "Opened",        icon: RiMailOpenLine,      dot: "#8B5CF6", bg: "#8B5CF61F", fg: "#6D28D9" },
  clicked:       { label: "Clicked",       icon: RiCursorLine,        dot: "#6366F1", bg: "#6366F11F", fg: "#4338CA" },
  exited:        { label: "Exited",        icon: RiLogoutBoxLine,     dot: "#F5A623", bg: "#FFB80026", fg: "#B45309" },
  error:         { label: "Error",         icon: RiErrorWarningLine,  dot: "#EF4444", bg: "#EF44441F", fg: "#DC2626" },
  workflow_edit: { label: "Workflow edit", icon: RiFlowChart,         dot: "#8D8D8D", bg: "#8D8D8D1A", fg: "#5F5F5F" },
  paused:        { label: "Paused",        icon: RiPauseLine,         dot: "#F5A623", bg: "#FFB80026", fg: "#B45309" },
  resumed:       { label: "Resumed",       icon: RiPlayLine,          dot: "#14C4AE", bg: "#16DAC11F", fg: "#0D6B5E" },
  published:     { label: "Published",     icon: RiUploadCloud2Line,  dot: "#22C55E", bg: "#22C55E1F", fg: "#16A34A" },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatLogDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function groupByDate(logs: AutomationLogRow[]): { date: string; logs: AutomationLogRow[] }[] {
  const map = new Map<string, AutomationLogRow[]>();
  for (const log of logs) {
    const key = new Date(log.created_at).toLocaleDateString(undefined, {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(log);
  }
  return Array.from(map.entries()).map(([date, logs]) => ({ date, logs }));
}

function exportLogsCSV(logs: AutomationLogRow[]) {
  const rows = [
    ["Time", "Event", "Label", "Contact", "Description"],
    ...logs.map((l) => [
      new Date(l.created_at).toLocaleString(),
      l.event_type,
      l.event_label,
      l.contact?.name ?? l.contact?.email ?? "",
      l.description ?? "",
    ]),
  ];
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `automation-logs-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function LogSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {Array.from({ length: 3 }).map((_, g) => (
        <div key={g}>
          <div style={{ height: 10, width: 160, background: "#EAEEF0", borderRadius: 4, marginBottom: 12 }} className="animate-pulse" />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Array.from({ length: 4 }).map((__, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: 14, borderRadius: 12, border: "1px solid #E5EAEC",
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: "#EAEEF0", flexShrink: 0 }} className="animate-pulse" />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 11, width: 200, background: "#EAEEF0", borderRadius: 4 }} className="animate-pulse" />
                  <div style={{ height: 9, width: 120, background: "#EAEEF0", borderRadius: 4, marginTop: 6 }} className="animate-pulse" />
                </div>
                <div style={{ height: 10, width: 80, background: "#EAEEF0", borderRadius: 4 }} className="animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export default function AutomationLogsPage() {
  const params = useParams();
  const { workspaceId, loading: wsLoading } = useWorkspace();
  const { showToast } = useToast();

  const automationId = params.id as string;

  const [automation, setAutomation] = React.useState<EmailAutomationRow | null>(null);
  const [logs, setLogs] = React.useState<AutomationLogRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [eventFilter, setEventFilter] = React.useState<AutomationEventType | "">("");
  const [refreshing, setRefreshing] = React.useState(false);
  const [liveMode, setLiveMode] = React.useState(true);

  async function fetchLogs() {
    if (!workspaceId) return;
    const p = new URLSearchParams({ workspace_id: workspaceId });
    if (eventFilter) p.set("event_type", eventFilter);
    const [autoRes, logsRes] = await Promise.all([
      fetch(`/api/automations/${automationId}?workspace_id=${workspaceId}`),
      fetch(`/api/automations/${automationId}/logs?${p}`),
    ]);
    const [autoJson, logsJson] = await Promise.all([autoRes.json(), logsRes.json()]);
    if (autoJson.automation) setAutomation(autoJson.automation);
    setLogs(logsJson.logs ?? []);
    setTotal(logsJson.total ?? 0);
  }

  React.useEffect(() => {
    if (!workspaceId || wsLoading) return;
    setLoading(true);
    fetchLogs().catch(() => showToast({ title: "Error loading logs" })).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, wsLoading, automationId, eventFilter]);

  const fetchLogsRef = React.useRef(fetchLogs);
  fetchLogsRef.current = fetchLogs;
  React.useEffect(() => {
    if (!liveMode) return;
    const interval = setInterval(() => fetchLogsRef.current().catch(console.error), 15000);
    return () => clearInterval(interval);
  }, [liveMode]);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchLogs().catch(() => showToast({ title: "Error refreshing" }));
    setRefreshing(false);
  }

  const grouped = groupByDate(logs);

  const FILTER_OPTIONS: { value: AutomationEventType | ""; label: string }[] = [
    { value: "",            label: "All" },
    { value: "enrolled",    label: "Enrolled" },
    { value: "email_sent",  label: "Email sent" },
    { value: "opened",      label: "Opened" },
    { value: "clicked",     label: "Clicked" },
    { value: "exited",      label: "Exited" },
    { value: "error",       label: "Errors" },
  ];

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

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#FFFFFF" }}>

      {/* ── Top bar ── */}
      {automation && (
        <AutomationHeader
          automationId={automationId}
          automationName={automation.name}
          automationStatus={automation.status}
          activeTab="Logs"
          onNameSaved={(name) => setAutomation({ ...automation, name })}
          onPauseResume={handlePauseResume}
          onDuplicate={handleDuplicate}
          onPublished={(a) => setAutomation((prev) => prev ? { ...prev, status: a.status as typeof prev.status } : prev)}
          triggerConfig={automation.trigger_config as { send_window?: { enabled?: boolean; start?: string; end?: string; timezone?: string; skip_weekends?: boolean } } | undefined}
          onSettingsSaved={(updated) => setAutomation((prev) => prev ? { ...prev, trigger_config: { ...(prev.trigger_config ?? {}), ...updated } } : prev)}
        />
      )}

      {/* ── Body ── */}
      <div style={{ flex: 1, overflow: "auto", padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#8D8D8D", margin: 0 }}>
              Activity log
            </p>
            <h2 style={{ fontSize: 28, fontWeight: 700, color: "#1B1B1B", margin: "6px 0 0", lineHeight: "34px", ...manrope }}>
              {loading ? "…" : total.toLocaleString()} events
            </h2>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Live toggle */}
            <button
              onClick={() => setLiveMode((p) => !p)}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                background: liveMode ? "#16DAC10F" : "#FFFFFF",
                border: `1px solid ${liveMode ? "#16DAC133" : "#DEE8E8"}`,
                borderRadius: 999, paddingBlock: 8, paddingInline: 14,
                cursor: "pointer", fontSize: 13, fontWeight: 600,
                color: liveMode ? "#0D6B5E" : "#5F5F5F",
                ...manrope,
              }}
            >
              <span style={{
                width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                background: liveMode ? "#14C4AE" : "#8D8D8D",
                boxShadow: liveMode ? "0 0 0 3px rgba(20,196,174,0.25)" : "none",
              }} />
              {liveMode ? "Live" : "Paused"}
            </button>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "#FFFFFF", border: "1px solid #DEE8E8", borderRadius: 999,
                paddingBlock: 8, paddingInline: 16, cursor: refreshing ? "default" : "pointer",
                fontSize: 13, fontWeight: 600, color: "#1B1B1B",
                opacity: refreshing ? 0.6 : 1, ...manrope,
              }}
            >
              <RiRefreshLine style={{ width: 14, height: 14, animation: refreshing ? "spin 1s linear infinite" : "none" }} />
              Refresh
            </button>

            <button
              onClick={() => exportLogsCSV(logs)}
              disabled={logs.length === 0}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "#FFFFFF", border: "1px solid #DEE8E8", borderRadius: 999,
                paddingBlock: 8, paddingInline: 16, cursor: "pointer",
                fontSize: 13, fontWeight: 600, color: "#1B1B1B",
                opacity: logs.length === 0 ? 0.5 : 1, ...manrope,
              }}
            >
              <RiDownloadLine style={{ width: 14, height: 14 }} />
              Export logs
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "inline-flex", background: "#F0F7F7", borderRadius: 999, padding: 4, gap: 4, alignSelf: "flex-start" }}>
          {FILTER_OPTIONS.map((opt) => {
            const isActive = eventFilter === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setEventFilter(opt.value)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  borderRadius: 999, paddingBlock: 7, paddingInline: 14,
                  border: "none", cursor: "pointer",
                  background: isActive ? "#FFFFFF" : "transparent",
                  boxShadow: isActive ? "#00000014 0px 4px 16px" : "none",
                  transition: "all 0.15s", ...manrope,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? "#1B1B1B" : "#5F5F5F" }}>
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Log content */}
        {loading ? (
          <LogSkeleton />
        ) : logs.length === 0 ? (
          /* Empty state */
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", paddingBlock: 80, gap: 16, ...manrope,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "#16DAC124", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <RiFileListLine style={{ width: 26, height: 26, color: "#14C4AE" }} />
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#0F2A37", margin: 0 }}>No activity yet</p>
              <p style={{ fontSize: 13, color: "#7A8A93", marginTop: 6, lineHeight: "20px" }}>
                Events will appear here once this automation is active and processing contacts.
              </p>
            </div>
          </div>
        ) : (
          /* Grouped log entries */
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {grouped.map(({ date, logs: dateLogs }) => (
              <div key={date}>
                {/* Date label */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#7A8A93", ...manrope }}>
                    {date}
                  </span>
                  <div style={{ flex: 1, height: 1, background: "#E5EAEC" }} />
                  <span style={{ fontSize: 11, color: "#7A8A93", ...manrope }}>{dateLogs.length} event{dateLogs.length !== 1 ? "s" : ""}</span>
                </div>

                {/* Log rows */}
                <div style={{
                  background: "#FFFFFF", border: "1px solid #E5EAEC",
                  borderRadius: 14, overflow: "clip",
                }}>
                  {dateLogs.map((log, idx) => {
                    const cfg = EVENT_CONFIGS[log.event_type] ?? EVENT_CONFIGS.workflow_edit;
                    const Icon = cfg.icon;
                    const contact = log.contact;
                    const displayName = contact?.name || contact?.email || null;

                    return (
                      <div
                        key={log.id}
                        style={{
                          display: "flex", alignItems: "center", gap: 14,
                          paddingBlock: 14, paddingInline: 20,
                          borderBottom: idx < dateLogs.length - 1 ? "1px solid #EAEEF0" : "none",
                          transition: "background 0.1s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#F8FAFB")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        {/* Icon */}
                        <div style={{
                          width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                          background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <Icon style={{ width: 16, height: 16, color: cfg.fg }} />
                        </div>

                        {/* Event badge + label */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: 5,
                              background: cfg.bg, borderRadius: 999,
                              paddingBlock: 3, paddingInline: 9,
                              fontSize: 11, fontWeight: 700, color: cfg.fg, ...manrope,
                            }}>
                              <span style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
                              {cfg.label}
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "#0F2A37", ...manrope }}>
                              {log.event_label}
                            </span>
                            {displayName && (
                              <span style={{ fontSize: 12, color: "#7A8A93", ...manrope }}>· {displayName}</span>
                            )}
                          </div>
                          {log.description && (
                            <p style={{ fontSize: 12, color: "#4A5C66", margin: "4px 0 0", ...manrope }}>
                              {log.description}
                            </p>
                          )}
                        </div>

                        {/* Time + ID */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                          <span style={{ fontSize: 12, color: "#4A5C66", ...manrope }}>{formatLogDate(log.created_at)}</span>
                          <span style={{ fontSize: 10, color: "#B0BEC5", fontFamily: "monospace" }}>
                            #{log.id.slice(0, 8)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        {!loading && total > 0 && (
          <p style={{ fontSize: 12, color: "#7A8A93", ...manrope }}>
            {total} event{total !== 1 ? "s" : ""} total
          </p>
        )}
      </div>

      {/* Spin keyframe for refresh icon */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
