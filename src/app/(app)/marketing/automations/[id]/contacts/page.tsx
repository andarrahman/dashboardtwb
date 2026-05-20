"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import {
  RiDownloadLine,
  RiUserLine,
  RiFlashlightLine,
  RiCheckLine,
  RiTimeLine,
  RiErrorWarningLine,
  RiLogoutBoxLine,
  RiCloseLine,
  RiMailSendLine,
  RiMailOpenLine,
  RiCursorLine,
  RiUploadCloud2Line,
  RiPauseLine,
  RiPlayLine,
  RiFlowChart,
} from "@remixicon/react";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AutomationHeader } from "@/components/marketing/automation-header";
import type {
  EmailAutomationRow,
  AutomationEnrollmentRow,
  AutomationLogRow,
  AutomationEventType,
} from "@/lib/supabase/types";

// ─── Event configs (for timeline) ─────────────────────────────────────────────

const EV: Record<AutomationEventType, { label: string; icon: React.ElementType; dot: string; bg: string; fg: string }> = {
  enrolled:      { label: "Enrolled",      icon: RiCheckLine,        dot: "#14C4AE", bg: "#16DAC11F", fg: "#0D6B5E" },
  email_sent:    { label: "Email sent",    icon: RiMailSendLine,     dot: "#3B82F6", bg: "#3B82F61F", fg: "#1D4ED8" },
  opened:        { label: "Opened",        icon: RiMailOpenLine,     dot: "#8B5CF6", bg: "#8B5CF61F", fg: "#6D28D9" },
  clicked:       { label: "Clicked",       icon: RiCursorLine,       dot: "#6366F1", bg: "#6366F11F", fg: "#4338CA" },
  exited:        { label: "Exited",        icon: RiLogoutBoxLine,    dot: "#F5A623", bg: "#FFB80026", fg: "#B45309" },
  error:         { label: "Error",         icon: RiErrorWarningLine, dot: "#EF4444", bg: "#EF44441F", fg: "#DC2626" },
  workflow_edit: { label: "Workflow edit", icon: RiFlowChart,        dot: "#8D8D8D", bg: "#8D8D8D1A", fg: "#5F5F5F" },
  paused:        { label: "Paused",        icon: RiPauseLine,        dot: "#F5A623", bg: "#FFB80026", fg: "#B45309" },
  resumed:       { label: "Resumed",       icon: RiPlayLine,         dot: "#14C4AE", bg: "#16DAC11F", fg: "#0D6B5E" },
  published:     { label: "Published",     icon: RiUploadCloud2Line, dot: "#22C55E", bg: "#22C55E1F", fg: "#16A34A" },
};

// ─── Contact timeline dialog ───────────────────────────────────────────────────

function ContactTimeline({
  enrollment,
  automationId,
  workspaceId,
  onClose,
}: {
  enrollment: AutomationEnrollmentRow;
  automationId: string;
  workspaceId: string;
  onClose: () => void;
}) {
  const manrope: React.CSSProperties = { fontFamily: '"Manrope", system-ui, sans-serif' };
  const [events, setEvents] = React.useState<AutomationLogRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const contactName = enrollment.contact?.name ?? "Unknown contact";
  const contactEmail = enrollment.contact?.email ?? "";
  const ini = contactName.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

  React.useEffect(() => {
    if (!enrollment.contact_id) return;
    const url = `/api/automations/${automationId}/logs?workspace_id=${workspaceId}&contact_id=${enrollment.contact_id}&pageSize=100`;
    fetch(url)
      .then((r) => r.json())
      .then((j) => setEvents(j.logs ?? []))
      .finally(() => setLoading(false));
  }, [automationId, workspaceId, enrollment.contact_id]);

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent size="md" hideClose>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "20px 20px 0", ...manrope }}>
          <div style={{
            width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
            background: "#16DAC124", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 700, color: "#0D6B5E",
          }}>
            {ini}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#0F2A37", margin: 0 }}>{contactName}</p>
            <p style={{ fontSize: 12, color: "#7A8A93", marginTop: 2 }}>{contactEmail}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              background: enrollment.status === "active" ? "#16DAC11F" : enrollment.status === "completed" ? "#22C55E1F" : "#EF44441F",
              borderRadius: 999, paddingBlock: 3, paddingInline: 10,
              fontSize: 11, fontWeight: 700, color: enrollment.status === "active" ? "#0D6B5E" : enrollment.status === "completed" ? "#16A34A" : "#DC2626",
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                background: enrollment.status === "active" ? "#14C4AE" : enrollment.status === "completed" ? "#22C55E" : "#EF4444",
              }} />
              {enrollment.status.charAt(0).toUpperCase() + enrollment.status.slice(1)}
            </span>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#7A8A93", display: "flex", padding: 4 }}>
              <RiCloseLine style={{ width: 18, height: 18 }} />
            </button>
          </div>
        </div>

        {/* Current step info */}
        <div style={{ margin: "14px 20px 0", padding: "10px 14px", background: "#F5F8F8", borderRadius: 10, ...manrope }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#7A8A93", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
            Current step
          </p>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#0F2A37", marginTop: 4, marginBottom: 0 }}>
            {enrollment.current_step_name ?? `Step ${(enrollment.current_step_index ?? 0) + 1}`}
          </p>
          {enrollment.next_action_at && (
            <p style={{ fontSize: 11, color: "#7A8A93", marginTop: 2, marginBottom: 0 }}>
              Next action: {new Date(enrollment.next_action_at).toLocaleString()}
            </p>
          )}
        </div>

        {/* Timeline */}
        <div style={{ padding: "16px 20px 20px", maxHeight: 360, overflowY: "auto", ...manrope }}>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "#EAEEF0" }} className="animate-pulse" />
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 11, width: 150, background: "#EAEEF0", borderRadius: 4 }} className="animate-pulse" />
                    <div style={{ height: 9, width: 90, background: "#EAEEF0", borderRadius: 4, marginTop: 5 }} className="animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : events.length === 0 ? (
            <p style={{ fontSize: 13, color: "#7A8A93", textAlign: "center", paddingBlock: 24 }}>No events yet</p>
          ) : (
            <div style={{ position: "relative" }}>
              {/* Vertical line */}
              <div style={{ position: "absolute", left: 15, top: 16, bottom: 16, width: 2, background: "#E5EAEC" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {events.map((ev) => {
                  const cfg = EV[ev.event_type] ?? EV.enrolled;
                  const Icon = cfg.icon;
                  return (
                    <div key={ev.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", position: "relative" }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center",
                        zIndex: 1, position: "relative",
                      }}>
                        <Icon style={{ width: 14, height: 14, color: cfg.fg }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0, paddingTop: 6 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "#0F2A37", margin: 0 }}>{ev.event_label}</p>
                          <p style={{ fontSize: 11, color: "#7A8A93", flexShrink: 0, margin: 0 }}>
                            {new Date(ev.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        {ev.description && (
                          <p style={{ fontSize: 12, color: "#4A5C66", marginTop: 3, marginBottom: 0 }}>{ev.description}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function relativeDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function initials(name: string) {
  return (name || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function exportContactsCSV(enrollments: AutomationEnrollmentRow[]) {
  const rows: string[][] = [
    ["Contact", "Email", "Current Step", "Status", "Enrolled At"],
    ...enrollments.map((e) => [
      e.contact?.name ?? "",
      e.contact?.email ?? "",
      e.current_step_name ?? `Step ${e.current_step_index + 1}`,
      e.status,
      new Date(e.enrolled_at).toLocaleDateString(),
    ]),
  ];
  const csv = rows
    .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `contacts-in-flow-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Enrollment status badge ───────────────────────────────────────────────────

function EnrollBadge({ status }: { status: AutomationEnrollmentRow["status"] }) {
  const styles: Record<string, { dot: string; bg: string; label: string }> = {
    active:    { dot: "#10B89F", bg: "#16DAC11F", label: "Active" },
    completed: { dot: "#22C55E", bg: "#22C55E1F", label: "Completed" },
    exited:    { dot: "#F5A623", bg: "#FFB80026", label: "Exited" },
    error:     { dot: "#EF4444", bg: "#EF44441F", label: "Error" },
  };
  const s = styles[status] ?? styles.active;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: s.bg, borderRadius: 999, paddingBlock: 3, paddingInline: 9,
      fontFamily: '"Manrope", system-ui, sans-serif',
      fontSize: 11, fontWeight: 700, color: "#0F2A37",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {s.label}
    </span>
  );
}

// ─── Avatar ────────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  { bg: "#E8FBF9", fg: "#0D9488" },
  { bg: "#FEF3C7", fg: "#B45309" },
  { bg: "#EDE9FE", fg: "#7C3AED" },
  { bg: "#FCE7F3", fg: "#BE185D" },
  { bg: "#DBEAFE", fg: "#1D4ED8" },
];
function avatarColor(name: string) {
  return AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
}

// ─── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, iconBg, iconColor, value, label }: {
  icon: React.ElementType; iconBg: string; iconColor: string;
  value: string | number; label: string;
}) {
  return (
    <div style={{
      background: "#FFFFFF", border: "1px solid #E5EAEC", borderRadius: 14,
      padding: 20, fontFamily: '"Manrope", system-ui, sans-serif',
      display: "flex", flexDirection: "column", gap: 12,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: iconBg, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon style={{ width: 18, height: 18, color: iconColor }} />
      </div>
      <div>
        <p style={{ fontSize: 24, fontWeight: 700, color: "#0F2A37", margin: 0, lineHeight: "30px" }}>{value}</p>
        <p style={{ fontSize: 12, color: "#7A8A93", marginTop: 4 }}>{label}</p>
      </div>
    </div>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ isDraft, listContactCount }: { isDraft: boolean; listContactCount: number | null }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", paddingBlock: 80, gap: 16,
      fontFamily: '"Manrope", system-ui, sans-serif',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: "50%",
        background: "#16DAC124", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <RiUserLine style={{ width: 26, height: 26, color: "#14C4AE" }} />
      </div>
      <div style={{ textAlign: "center", maxWidth: 360 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: "#0F2A37", margin: 0 }}>
          No contacts in this workflow yet
        </p>
        {isDraft ? (
          <>
            <p style={{ fontSize: 13, color: "#7A8A93", marginTop: 8, lineHeight: "20px" }}>
              This automation is still a <strong style={{ color: "#0F2A37" }}>Draft</strong>.
              Contacts will be enrolled automatically once you publish and activate it.
            </p>
            {listContactCount !== null && listContactCount > 0 && (
              <div style={{
                marginTop: 14, display: "inline-flex", alignItems: "center", gap: 8,
                background: "#16DAC10F", border: "1px solid #16DAC133",
                borderRadius: 10, paddingBlock: 10, paddingInline: 16,
              }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#14C4AE", flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#0D6B5E" }}>
                  {listContactCount.toLocaleString()} contact{listContactCount !== 1 ? "s" : ""} in trigger list — ready to enroll when activated
                </span>
              </div>
            )}
          </>
        ) : (
          <p style={{ fontSize: 13, color: "#7A8A93", marginTop: 8, lineHeight: "20px" }}>
            Contacts will appear here once they are enrolled into this workflow.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center",
          paddingBlock: 14, paddingInline: 20,
          borderBottom: "1px solid #EAEEF0",
          gap: 0,
        }}>
          <div style={{ width: 260, flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#EAEEF0", flexShrink: 0 }} className="animate-pulse" />
            <div>
              <div style={{ width: 100, height: 11, background: "#EAEEF0", borderRadius: 4 }} className="animate-pulse" />
              <div style={{ width: 70, height: 9, background: "#EAEEF0", borderRadius: 4, marginTop: 5 }} className="animate-pulse" />
            </div>
          </div>
          <div style={{ width: 140, flexShrink: 0 }}>
            <div style={{ width: 60, height: 20, background: "#EAEEF0", borderRadius: 999 }} className="animate-pulse" />
          </div>
          <div style={{ flex: 1, height: 11, background: "#EAEEF0", borderRadius: 4 }} className="animate-pulse" />
          <div style={{ width: 140, flexShrink: 0, height: 11, background: "#EAEEF0", borderRadius: 4 }} className="animate-pulse" />
          <div style={{ width: 100, flexShrink: 0, height: 11, background: "#EAEEF0", borderRadius: 4 }} className="animate-pulse" />
        </div>
      ))}
    </>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────

type StatusFilter = "" | AutomationEnrollmentRow["status"];

export default function AutomationContactsPage() {
  const params = useParams();
  const { workspaceId, loading: wsLoading } = useWorkspace();
  const { showToast } = useToast();

  const automationId = params.id as string;

  const [automation, setAutomation] = React.useState<EmailAutomationRow | null>(null);
  const [enrollments, setEnrollments] = React.useState<AutomationEnrollmentRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("");
  const [retryingId, setRetryingId] = React.useState<string | null>(null);
  const [listContactCount, setListContactCount] = React.useState<number | null>(null);
  const [processing, setProcessing] = React.useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = React.useState<AutomationEnrollmentRow | null>(null);

  async function loadEnrollments() {
    if (!workspaceId) return;
    const p = new URLSearchParams({ workspace_id: workspaceId });
    if (statusFilter) p.set("status", statusFilter);
    const json = await fetch(`/api/automations/${automationId}/enrollments?${p}`).then((r) => r.json());
    setEnrollments(json.enrollments ?? []);
    setTotal(json.total ?? 0);
  }

  React.useEffect(() => {
    if (!workspaceId || wsLoading) return;

    setLoading(true);
    Promise.all([
      fetch(`/api/automations/${automationId}?workspace_id=${workspaceId}`).then((r) => r.json()),
      fetch(`/api/automations/${automationId}/enrollments?workspace_id=${workspaceId}`).then((r) => r.json()),
    ])
      .then(async ([autoJson, enrollJson]) => {
        const auto: EmailAutomationRow | undefined = autoJson.automation;
        if (auto) {
          setAutomation(auto);
          // Fetch list contact count for draft automations
          if (auto.status === "draft" && auto.trigger_type === "list_subscription" && auto.trigger_config?.list_id) {
            const supabase = createClient();
            const { data } = await (supabase as any)
              .from("contact_lists")
              .select("contact_count")
              .eq("id", auto.trigger_config.list_id)
              .single();
            setListContactCount(data?.contact_count ?? 0);
          }
        }
        setEnrollments(enrollJson.enrollments ?? []);
        setTotal(enrollJson.total ?? 0);
      })
      .catch(() => showToast({ title: "Error loading contacts" }))
      .finally(() => setLoading(false));
  }, [workspaceId, wsLoading, automationId, showToast]);

  // Re-fetch enrollments when filter changes (skip initial load)
  const isFirstRender = React.useRef(true);
  React.useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (!workspaceId || wsLoading) return;
    loadEnrollments();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function handleRetry(enrollmentId: string) {
    if (!workspaceId) return;
    setRetryingId(enrollmentId);
    try {
      await fetch(`/api/automations/${automationId}/enrollments/${enrollmentId}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });
      showToast({ title: "Enrollment requeued" });
      await loadEnrollments();
    } catch {
      showToast({ title: "Retry failed" });
    } finally {
      setRetryingId(null);
    }
  }

  const STATUS_FILTERS: { key: StatusFilter; label: string; icon: React.ElementType }[] = [
    { key: "",           label: "All",       icon: RiUserLine },
    { key: "active",     label: "Active",    icon: RiFlashlightLine },
    { key: "completed",  label: "Completed", icon: RiCheckLine },
    { key: "exited",     label: "Exited",    icon: RiLogoutBoxLine },
    { key: "error",      label: "Error",     icon: RiErrorWarningLine },
  ];

  const counts = {
    active:    enrollments.filter((e) => e.status === "active").length,
    completed: enrollments.filter((e) => e.status === "completed").length,
    exited:    enrollments.filter((e) => e.status === "exited").length,
    error:     enrollments.filter((e) => e.status === "error").length,
  };

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

  async function handleProcessNow() {
    setProcessing(true);
    try {
      const res = await fetch("/api/cron/process-automations");
      const json = await res.json() as { processed?: number; errors?: number; skipped?: number };
      showToast({
        title: `Processed ${json.processed ?? 0} enrollment(s)`,
        subtitle: json.errors ? `${json.errors} error(s)` : undefined,
      });
      await loadEnrollments();
    } catch {
      showToast({ title: "Processing failed" });
    } finally {
      setProcessing(false);
    }
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
  const isDraft = automation?.status === "draft";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#FFFFFF" }}>

      {/* ── Top bar ── */}
      {automation && (
        <AutomationHeader
          automationId={automationId}
          automationName={automation.name}
          automationStatus={automation.status}
          activeTab="Contacts in flow"
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

        {/* Header row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#8D8D8D", margin: 0 }}>
              Contacts in flow
            </p>
            <h2 style={{ fontSize: 28, fontWeight: 700, color: "#1B1B1B", margin: "6px 0 0", lineHeight: "34px", ...manrope }}>
              {loading ? "…" : total.toLocaleString()} enrolled
            </h2>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {/* Process now — triggers the automation cron manually (dev / on-demand) */}
            <button
              onClick={handleProcessNow}
              disabled={processing}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                background: processing ? "#F0FDF9" : "#FFFFFF",
                border: "1px solid #DEE8E8", borderRadius: 999,
                paddingBlock: 8, paddingInline: 16, cursor: processing ? "default" : "pointer",
                fontSize: 13, fontWeight: 600, color: "#10B89F",
                opacity: processing ? 0.7 : 1,
                ...manrope,
              }}
            >
              <RiFlashlightLine style={{ width: 14, height: 14 }} />
              {processing ? "Processing…" : "Process now"}
            </button>

            <button
              onClick={() => exportContactsCSV(enrollments)}
              disabled={enrollments.length === 0}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "#FFFFFF", border: "1px solid #DEE8E8", borderRadius: 999,
                paddingBlock: 8, paddingInline: 16, cursor: "pointer",
                fontSize: 13, fontWeight: 600, color: "#1B1B1B",
                opacity: enrollments.length === 0 ? 0.5 : 1,
                ...manrope,
              }}
            >
              <RiDownloadLine style={{ width: 14, height: 14 }} />
              Export CSV
            </button>
          </div>
        </div>

        {/* Stat cards */}
        {!loading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            <StatCard icon={RiFlashlightLine} iconBg="#16DAC124" iconColor="#14C4AE" value={counts.active}    label="Active in workflow" />
            <StatCard icon={RiCheckLine}       iconBg="#22C55E1F" iconColor="#16A34A" value={counts.completed} label="Completed" />
            <StatCard icon={RiLogoutBoxLine}   iconBg="#FFB80026" iconColor="#D97706" value={counts.exited}    label="Exited early" />
            <StatCard icon={RiErrorWarningLine} iconBg="#EF44441F" iconColor="#DC2626" value={counts.error}    label="Error" />
          </div>
        )}

        {/* Status filter tabs */}
        <div style={{ display: "inline-flex", background: "#F0F7F7", borderRadius: 999, padding: 4, gap: 4, alignSelf: "flex-start" }}>
          {STATUS_FILTERS.map(({ key, label }) => {
            const isActive = statusFilter === key;
            return (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  borderRadius: 999, paddingBlock: 7, paddingInline: 14,
                  border: "none", cursor: "pointer",
                  background: isActive ? "#FFFFFF" : "transparent",
                  boxShadow: isActive ? "#00000014 0px 4px 16px" : "none",
                  transition: "all 0.15s",
                  ...manrope,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? "#1B1B1B" : "#5F5F5F" }}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div style={{
          background: "#FFFFFF", border: "1px solid #E5EAEC",
          borderRadius: 14, overflow: "clip", ...manrope,
        }}>
          {/* Table header */}
          <div style={{
            display: "flex", alignItems: "center",
            background: "#F8FAFB", borderBottom: "1px solid #E5EAEC",
            paddingBlock: 12, paddingInline: 20,
          }}>
            {[
              { label: "CONTACT",      w: 260 },
              { label: "STATUS",       w: 140 },
              { label: "CURRENT STEP", w: undefined },
              { label: "NEXT ACTION",  w: 180 },
              { label: "ENROLLED",     w: 100 },
            ].map(({ label, w }) => (
              <div
                key={label}
                style={{
                  width: w, flex: w ? undefined : 1,
                  flexShrink: 0,
                  fontSize: 11, fontWeight: 700,
                  letterSpacing: "0.06em", textTransform: "uppercase", color: "#4A5C66",
                }}
              >
                {label}
              </div>
            ))}
            <div style={{ width: 60, flexShrink: 0 }} />
          </div>

          {/* Rows */}
          {loading ? (
            <RowSkeleton />
          ) : enrollments.length === 0 ? (
            <EmptyState isDraft={isDraft} listContactCount={listContactCount} />
          ) : (
            enrollments.map((enrollment) => {
              const contact = enrollment.contact;
              const displayName = contact?.name || contact?.email || "Unknown";
              const color = avatarColor(displayName);

              return (
                <div
                  key={enrollment.id}
                  onClick={() => setSelectedEnrollment(enrollment)}
                  style={{
                    display: "flex", alignItems: "center",
                    paddingBlock: 14, paddingInline: 20,
                    borderBottom: "1px solid #EAEEF0",
                    transition: "background 0.1s",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#F8FAFB")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {/* Contact */}
                  <div style={{ width: 260, flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                      background: color.bg, display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 700, color: color.fg,
                    }}>
                      {initials(displayName)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#0F2A37", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {displayName}
                      </p>
                      {contact?.email && (
                        <p style={{ fontSize: 11, color: "#7A8A93", margin: 0, marginTop: 2 }}>
                          {contact.email}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Status */}
                  <div style={{ width: 140, flexShrink: 0 }}>
                    <EnrollBadge status={enrollment.status} />
                  </div>

                  {/* Current step */}
                  <div style={{ flex: 1, fontSize: 13, color: "#4A5C66", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingRight: 16 }}>
                    {enrollment.current_step_name ?? `Step ${enrollment.current_step_index + 1}`}
                  </div>

                  {/* Next action */}
                  <div style={{ width: 180, flexShrink: 0, fontSize: 13, color: "#4A5C66" }}>
                    {enrollment.next_step_name
                      ? <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <RiTimeLine style={{ width: 12, height: 12, color: "#14C4AE", flexShrink: 0 }} />
                          {enrollment.next_step_name}
                        </span>
                      : enrollment.next_action_at
                        ? new Date(enrollment.next_action_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                        : "—"
                    }
                  </div>

                  {/* Enrolled */}
                  <div style={{ width: 100, flexShrink: 0, fontSize: 12, color: "#7A8A93" }}>
                    {relativeDate(enrollment.enrolled_at)}
                  </div>

                  {/* Actions */}
                  <div style={{ width: 60, flexShrink: 0, display: "flex", justifyContent: "flex-end" }}>
                    {enrollment.status === "error" && (
                      <button
                        onClick={() => handleRetry(enrollment.id)}
                        disabled={retryingId === enrollment.id}
                        style={{
                          paddingBlock: 4, paddingInline: 10, borderRadius: 6,
                          background: "#FEF3C7", border: "1px solid #FDE68A",
                          fontSize: 11, fontWeight: 600, color: "#92400E",
                          cursor: "pointer", opacity: retryingId === enrollment.id ? 0.5 : 1,
                          ...manrope,
                        }}
                      >
                        {retryingId === enrollment.id ? "…" : "Retry"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer count */}
        {!loading && total > 0 && (
          <p style={{ fontSize: 12, color: "#7A8A93", ...manrope }}>
            {total} contact{total !== 1 ? "s" : ""} enrolled
          </p>
        )}
      </div>

      {/* ── Contact timeline dialog ── */}
      {selectedEnrollment && workspaceId && (
        <ContactTimeline
          enrollment={selectedEnrollment}
          automationId={automationId}
          workspaceId={workspaceId}
          onClose={() => setSelectedEnrollment(null)}
        />
      )}
    </div>
  );
}
