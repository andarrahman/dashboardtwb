"use client";

import * as React from "react";
import { useWorkspace } from "@/lib/hooks/use-workspace";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ActivityLog {
  id: string;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_title: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const manrope = '"Manrope", system-ui, sans-serif';

const AVATAR_COLORS = ["#14C4AE","#6366F1","#F97316","#EC4899","#8B5CF6","#22C55E"];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function fmtDateGroup(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const logDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (logDay.getTime() === today.getTime()) return "Today";
  if (logDay.getTime() === yesterday.getTime()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function statusLabel(s: string) {
  return s === "in_progress" ? "In Progress" : s.charAt(0).toUpperCase() + s.slice(1).replace("_", " ");
}

function buildDescription(log: ActivityLog): string {
  const entity = log.entity_type === "subtask" ? "subtask" : log.entity_type === "task" ? "task" : log.entity_type === "project" ? "project" : "update";
  const title = log.entity_title ? `"${log.entity_title}"` : entity;

  switch (log.action) {
    case "created":
      return `Created ${entity} ${title}`;
    case "deleted":
      return `Deleted ${entity} ${title}`;
    case "status_changed": {
      const oldV = statusLabel(String(log.meta?.old_value ?? ""));
      const newV = statusLabel(String(log.meta?.new_value ?? ""));
      return `Changed status of ${entity} ${title} from ${oldV} to ${newV}`;
    }
    case "updated": {
      const fields = (log.meta?.fields as string[] | undefined) ?? [];
      const pretty = fields.map(f => f.replace(/_/g, " ")).join(", ");
      return `Updated ${pretty ? pretty + " of" : ""} ${entity} ${title}`;
    }
    default:
      return `${log.action} ${entity} ${title}`;
  }
}

// ── Action icon ────────────────────────────────────────────────────────────────

function ActionIcon({ action, entityType }: { action: string; entityType: string }) {
  const isTask = entityType === "task" || entityType === "subtask";

  if (action === "created") {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="7" fill="#DCFCE7"/>
        <path d="M4 7h6M7 4v6" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    );
  }
  if (action === "deleted") {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="7" fill="#FEE2E2"/>
        <path d="M4.5 4.5l5 5M9.5 4.5l-5 5" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    );
  }
  if (action === "status_changed") {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="7" fill="#EDE9FE"/>
        <path d="M4.5 7.5L6.5 9.5L9.5 5" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  }
  // updated
  if (isTask) {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="7" fill="#FFF7ED"/>
        <path d="M4 7.5h4.5M8.5 5.5l2 2-2 2" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="7" fill="#E0F2FE"/>
      <path d="M5 7h4M7 9V5" stroke="#0EA5E9" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

interface ActivityTabProps {
  projectId: string;
  onCountChange?: (count: number) => void;
}

export function ActivityTab({ projectId, onCountChange }: ActivityTabProps) {
  const { workspaceId } = useWorkspace();
  const [logs, setLogs] = React.useState<ActivityLog[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/projects/${projectId}/activity?workspace_id=${workspaceId}`)
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? `Error ${r.status}`);
        const fetched = d.logs ?? [];
        setLogs(fetched);
        onCountChange?.(fetched.length);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [projectId, workspaceId]);

  // Group by date
  const groups: { label: string; logs: ActivityLog[] }[] = [];
  for (const log of logs) {
    const label = fmtDateGroup(log.created_at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.logs.push(log);
    } else {
      groups.push({ label, logs: [log] });
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "48px 0", color: "#AABBC2", fontFamily: manrope, fontSize: 13 }}>
        Loading activity…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "48px 0", gap: 10,
      }}>
        <div style={{
          background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10,
          padding: "12px 18px", maxWidth: 480, textAlign: "center",
        }}>
          <p style={{ fontFamily: manrope, fontSize: 13, fontWeight: 600, color: "#DC2626", margin: "0 0 4px 0" }}>
            Failed to load activity
          </p>
          <p style={{ fontFamily: manrope, fontSize: 12, color: "#EF4444", margin: 0 }}>
            {error}
          </p>
          {error.toLowerCase().includes("relation") || error.toLowerCase().includes("column") || error.toLowerCase().includes("does not exist") ? (
            <p style={{ fontFamily: manrope, fontSize: 11, color: "#7A8A93", margin: "8px 0 0 0" }}>
              Pastikan migration SQL sudah dijalankan di Supabase SQL Editor.
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 0", gap: 10 }}>
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <circle cx="20" cy="20" r="20" fill="#F0F4F5"/>
          <path d="M13 14h14M13 20h10M13 26h7" stroke="#B0BEC5" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
        <p style={{ fontFamily: manrope, fontSize: 13, color: "#7A8A93", margin: 0 }}>No activity yet.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {groups.map((group) => (
        <div key={group.label}>
          {/* Date label */}
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
            color: "#AABBC2", fontFamily: manrope,
            padding: "16px 0 8px 0",
          }}>
            {group.label}
          </div>

          {/* Log entries */}
          <div style={{
            background: "#FFFFFF", border: "1px solid #E5EAEC", borderRadius: 12, overflow: "hidden",
          }}>
            {group.logs.map((log, i) => (
              <div
                key={log.id}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 12,
                  padding: "12px 16px",
                  borderBottom: i < group.logs.length - 1 ? "1px solid #F0F4F5" : "none",
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: avatarColor(log.actor_name),
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 700, color: "#fff", flexShrink: 0,
                  fontFamily: manrope,
                }}>
                  {initials(log.actor_name)}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0F2A37", fontFamily: manrope }}>
                      {log.actor_name}
                    </span>
                    <ActionIcon action={log.action} entityType={log.entity_type} />
                    <span style={{ fontSize: 13, color: "#4A5C66", fontFamily: manrope }}>
                      {buildDescription(log).replace(`${log.actor_name} `, "")}
                    </span>
                  </div>
                </div>

                {/* Time */}
                <span style={{ fontSize: 11, color: "#AABBC2", fontFamily: manrope, flexShrink: 0, paddingTop: 1 }}>
                  {fmtTime(log.created_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
