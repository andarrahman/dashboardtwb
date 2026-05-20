"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RiAddLine,
  RiSearchLine,
  RiMoreLine,
  RiEditLine,
  RiBarChartLine,
  RiFileCopyLine,
  RiPauseLine,
  RiPlayLine,
  RiArchiveLine,
  RiDeleteBin2Line,
  RiCheckLine,
  RiMailSendLine,
  RiTimeLine,
  RiFlowChart,
  RiUploadLine,
  RiLayoutGridLine,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/browser";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/select";
import type { EmailAutomationRow, AutomationStatus, AutomationTriggerType, AutomationStep } from "@/lib/supabase/types";

// ─── Helpers ───────────────────────────────────────────────────────────────────

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

function triggerLabel(type: AutomationTriggerType | null, config: EmailAutomationRow["trigger_config"]): string {
  if (!type) return "—";
  switch (type) {
    case "list_subscription":
      return config?.list_name ? `Added to list · ${config.list_name}` : "Added to list";
    case "form_submitted":
      return "Form submitted";
    case "date_time":
      return "Date trigger";
    case "contact_inactive":
      return `Inactive · ${config?.inactive_days ?? "?"} days`;
    case "custom_event":
      return config?.event_name ? `Event · ${config.event_name}` : "Custom event";
    case "twibbonize_campaign":
      return "Twibbonize campaign";
    default:
      return type;
  }
}

function stepSummary(steps: AutomationStep[]): string {
  const emails = steps.filter((s) => s.type === "send_email").length;
  const delays = steps.filter((s) => s.type === "wait_delay").length;
  const totalDays = steps
    .filter((s) => s.type === "wait_delay")
    .reduce((acc, s) => acc + (s.delay_days ?? 0) + Math.round((s.delay_hours ?? 0) / 24), 0);

  const parts: string[] = [];
  if (emails) parts.push(`${emails} email${emails > 1 ? "s" : ""}`);
  if (delays) parts.push(`${delays} delay${delays > 1 ? "s" : ""}`);
  if (totalDays > 0) parts.push(`${totalDays}-day total`);
  return parts.join(" · ") || "No steps yet";
}

type ActiveTab = "all" | "active" | "paused" | "draft" | "archived";

interface AutomationCounts {
  all: number;
  active: number;
  paused: number;
  draft: number;
  archived: number;
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="animate-pulse" style={{ fontFamily: '"Manrope", system-ui, sans-serif' }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", paddingBlock: 16, paddingInline: 20, borderBottom: "1px solid #EAEEF0" }}>
          <div style={{ width: 380, flexShrink: 0, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: "#EAEEF0", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: 12, width: 140, background: "#EAEEF0", borderRadius: 4 }} />
              <div style={{ height: 10, width: 90, background: "#EAEEF0", borderRadius: 4, marginTop: 6 }} />
            </div>
          </div>
          <div style={{ width: 160, flexShrink: 0 }}>
            <div style={{ height: 22, width: 70, background: "#EAEEF0", borderRadius: 999 }} />
          </div>
          <div style={{ width: 220, flexShrink: 0, height: 12, background: "#EAEEF0", borderRadius: 4 }} />
          <div style={{ width: 120, flexShrink: 0, height: 12, background: "#EAEEF0", borderRadius: 4 }} />
          <div style={{ width: 120, flexShrink: 0, height: 12, background: "#EAEEF0", borderRadius: 4 }} />
          <div style={{ width: 140, flexShrink: 0, height: 12, background: "#EAEEF0", borderRadius: 4 }} />
        </div>
      ))}
    </div>
  );
}

// ─── Row menu ──────────────────────────────────────────────────────────────────

function RowMenu({
  automation,
  onEdit,
  onStats,
  onDuplicate,
  onPauseResume,
  onArchive,
  onDelete,
}: {
  automation: EmailAutomationRow;
  onEdit: () => void;
  onStats: () => void;
  onDuplicate: () => void;
  onPauseResume: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState({ top: 0, right: 0 });
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on scroll too
  React.useEffect(() => {
    if (!open) return;
    const handler = () => setOpen(false);
    window.addEventListener("scroll", handler, true);
    return () => window.removeEventListener("scroll", handler, true);
  }, [open]);

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
    setOpen((p) => !p);
  }

  const isPaused = automation.status === "paused";
  const isActive = automation.status === "active";

  const menu = (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        top: pos.top,
        right: pos.right,
        zIndex: 9999,
        minWidth: 176,
        background: "#FFFFFF",
        border: "1px solid #E5EAEC",
        borderRadius: 12,
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        padding: "4px 0",
        fontFamily: '"Manrope", system-ui, sans-serif',
        fontSize: 13,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#F0F7F7] text-[#0F2A37] transition-colors"
        onClick={() => { setOpen(false); onEdit(); }}
      >
        <RiEditLine className="size-4 text-[#7A8A93]" /> Edit
      </button>
      <button
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#F0F7F7] text-[#0F2A37] transition-colors"
        onClick={() => { setOpen(false); onStats(); }}
      >
        <RiBarChartLine className="size-4 text-[#7A8A93]" /> Statistics
      </button>
      <button
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#F0F7F7] text-[#0F2A37] transition-colors"
        onClick={() => { setOpen(false); onDuplicate(); }}
      >
        <RiFileCopyLine className="size-4 text-[#7A8A93]" /> Duplicate
      </button>
      {(isActive || isPaused) && (
        <button
          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#F0F7F7] text-[#0F2A37] transition-colors"
          onClick={() => { setOpen(false); onPauseResume(); }}
        >
          {isPaused
            ? <><RiPlayLine className="size-4 text-[#7A8A93]" /> Resume</>
            : <><RiPauseLine className="size-4 text-[#7A8A93]" /> Pause</>}
        </button>
      )}
      {automation.status !== "archived" && (
        <button
          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#F0F7F7] text-[#0F2A37] transition-colors"
          onClick={() => { setOpen(false); onArchive(); }}
        >
          <RiArchiveLine className="size-4 text-[#7A8A93]" /> Archive
        </button>
      )}
      <div style={{ height: 1, background: "#E5EAEC", margin: "4px 0" }} />
      <button
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#FEF2F2] text-red-600 transition-colors"
        onClick={() => { setOpen(false); onDelete(); }}
      >
        <RiDeleteBin2Line className="size-4" /> Delete
      </button>
    </div>
  );

  return (
    <div>
      <button
        ref={triggerRef}
        onClick={handleToggle}
        style={{
          width: 30, height: 30, borderRadius: 6,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "none", background: open ? "#F0F7F7" : "transparent", cursor: "pointer",
          transition: "background 0.12s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#F0F7F7")}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.background = "transparent"; }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="5" r="1.5" fill="#4A5C66" />
          <circle cx="12" cy="12" r="1.5" fill="#4A5C66" />
          <circle cx="12" cy="19" r="1.5" fill="#4A5C66" />
        </svg>
      </button>
      {open && typeof window !== "undefined" && createPortal(menu, document.body)}
    </div>
  );
}

// ─── Delete modal ──────────────────────────────────────────────────────────────

function DeleteModal({
  open,
  automation,
  onClose,
  onConfirm,
  loading,
}: {
  open: boolean;
  automation: EmailAutomationRow | null;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  const [confirmName, setConfirmName] = React.useState("");

  React.useEffect(() => {
    if (!open) setConfirmName("");
  }, [open]);

  const canConfirm = confirmName === automation?.name;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="md">
        <DialogTitle>Delete automation</DialogTitle>
        <div className="mt-2 space-y-4">
          <p className="text-sm text-text-secondary">
            This will permanently delete <span className="font-semibold text-text-primary">{automation?.name}</span> and remove all associated data.
            {automation && automation.total_enrolled > 0 && (
              <span className="text-amber-600 ml-1">
                Warning: {automation.total_enrolled} contact{automation.total_enrolled > 1 ? "s are" : " is"} currently in this workflow and will be exited immediately.
              </span>
            )}
          </p>
          <div>
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wide block mb-1.5">
              Type the automation name to confirm
            </label>
            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
              placeholder={automation?.name ?? ""}
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <button
              disabled={!canConfirm || loading}
              onClick={onConfirm}
              className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Deleting…" : "Delete automation"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function AutomationsPage() {
  const { workspaceId, loading: wsLoading } = useWorkspace();
  const router = useRouter();
  const { showToast } = useToast();

  const [automations, setAutomations] = React.useState<EmailAutomationRow[]>([]);
  const [counts, setCounts] = React.useState<AutomationCounts>({ all: 0, active: 0, paused: 0, draft: 0, archived: 0 });
  const [loading, setLoading] = React.useState(true);
  const [total, setTotal] = React.useState(0);

  const [activeTab, setActiveTab] = React.useState<ActiveTab>("all");
  const [search, setSearch] = React.useState("");
  const [triggerFilter, setTriggerFilter] = React.useState<AutomationTriggerType | "">("");

  // List contact counts for trigger lists: { list_id → contact_count }
  const [listCounts, setListCounts] = React.useState<Record<string, number>>({});

  // Delete modal
  const [deleteTarget, setDeleteTarget] = React.useState<EmailAutomationRow | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = React.useState(false);

  const fetchAutomations = React.useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ workspace_id: workspaceId });
      if (activeTab !== "all") params.set("status", activeTab);
      if (search) params.set("search", search);
      if (triggerFilter) params.set("trigger", triggerFilter);

      const res = await fetch(`/api/automations?${params}`);
      if (!res.ok) throw new Error("Failed to load automations");
      const json = await res.json();
      const rows: EmailAutomationRow[] = json.automations ?? [];
      setAutomations(rows);
      setTotal(json.total ?? 0);
      if (json.counts) setCounts(json.counts);

      // Fetch contact counts for list-subscription triggers
      const listIds = Array.from(new Set(
        rows
          .filter((a) => a.trigger_type === "list_subscription" && a.trigger_config?.list_id)
          .map((a) => a.trigger_config!.list_id as string)
      ));
      if (listIds.length > 0) {
        const supabase = createClient();
        const { data: listRows } = await (supabase as any)
          .from("contact_lists")
          .select("id, contact_count")
          .in("id", listIds);
        const map: Record<string, number> = {};
        for (const r of listRows ?? []) map[r.id] = r.contact_count ?? 0;
        setListCounts(map);
      }
    } catch (err) {
      showToast({ title: "Error loading automations", subtitle: err instanceof Error ? err.message : undefined });
    } finally {
      setLoading(false);
    }
  }, [workspaceId, activeTab, search, triggerFilter, showToast]);

  React.useEffect(() => {
    if (!wsLoading && workspaceId) fetchAutomations();
  }, [wsLoading, workspaceId, fetchAutomations]);

  // Clear selection when automations change
  React.useEffect(() => {
    setSelectedIds(new Set());
  }, [automations]);

  async function handleDuplicate(automation: EmailAutomationRow) {
    if (!workspaceId) return;
    try {
      const res = await fetch(`/api/automations/${automation.id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });
      if (!res.ok) throw new Error("Failed to duplicate");
      showToast({ title: "Automation duplicated", subtitle: `${automation.name} (copy) created as draft` });
      fetchAutomations();
    } catch (err) {
      showToast({ title: "Error", subtitle: err instanceof Error ? err.message : undefined });
    }
  }

  async function handlePauseResume(automation: EmailAutomationRow) {
    if (!workspaceId) return;
    try {
      const res = await fetch(`/api/automations/${automation.id}/pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      const newStatus = json.automation?.status;
      showToast({ title: newStatus === "paused" ? "Automation paused" : "Automation resumed" });
      fetchAutomations();
    } catch (err) {
      showToast({ title: "Error", subtitle: err instanceof Error ? err.message : undefined });
    }
  }

  async function handleArchive(automation: EmailAutomationRow) {
    if (!workspaceId) return;
    try {
      const res = await fetch(`/api/automations/${automation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId, status: "archived" }),
      });
      if (!res.ok) throw new Error("Failed to archive");
      showToast({ title: "Automation archived" });
      fetchAutomations();
    } catch (err) {
      showToast({ title: "Error", subtitle: err instanceof Error ? err.message : undefined });
    }
  }

  async function handleDelete() {
    if (!workspaceId || !deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/automations/${deleteTarget.id}?workspace_id=${workspaceId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      showToast({ title: "Automation deleted", subtitle: deleteTarget.name });
      setDeleteOpen(false);
      setDeleteTarget(null);
      fetchAutomations();
    } catch (err) {
      showToast({ title: "Error", subtitle: err instanceof Error ? err.message : undefined });
    } finally {
      setDeleting(false);
    }
  }

  // ─── Bulk actions ──────────────────────────────────────────────────────────

  function toggleSelectAll() {
    if (selectedIds.size === automations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(automations.map((a) => a.id)));
    }
  }

  function toggleSelectOne(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  async function handleBulkPause() {
    if (!workspaceId) return;
    setBulkLoading(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/automations/${id}/pause`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ workspace_id: workspaceId }),
          })
        )
      );
      showToast({ title: `${selectedIds.size} automation(s) paused` });
      setSelectedIds(new Set());
      fetchAutomations();
    } catch {
      showToast({ title: "Bulk pause failed" });
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleBulkArchive() {
    if (!workspaceId) return;
    setBulkLoading(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/automations/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ workspace_id: workspaceId, status: "archived" }),
          })
        )
      );
      showToast({ title: `${selectedIds.size} automation(s) archived` });
      setSelectedIds(new Set());
      fetchAutomations();
    } catch {
      showToast({ title: "Bulk archive failed" });
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleBulkDelete() {
    if (!workspaceId) return;
    if (!window.confirm(`Delete ${selectedIds.size} automation(s)? This cannot be undone.`)) return;
    setBulkLoading(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/automations/${id}?workspace_id=${workspaceId}`, { method: "DELETE" })
        )
      );
      showToast({ title: `${selectedIds.size} automation(s) deleted` });
      setSelectedIds(new Set());
      fetchAutomations();
    } catch {
      showToast({ title: "Bulk delete failed" });
    } finally {
      setBulkLoading(false);
    }
  }

  const allSelected = automations.length > 0 && selectedIds.size === automations.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < automations.length;

  const TABS: { key: ActiveTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "paused", label: "Paused" },
    { key: "draft", label: "Drafts" },
    { key: "archived", label: "Archived" },
  ];

  const TRIGGER_OPTIONS: { value: AutomationTriggerType | ""; label: string }[] = [
    { value: "", label: "Trigger: All" },
    { value: "list_subscription", label: "Added to list" },
    { value: "form_submitted", label: "Form submitted" },
    { value: "date_time", label: "Date & time" },
    { value: "contact_inactive", label: "Contact inactive" },
    { value: "twibbonize_campaign", label: "Twibbonize campaign" },
    { value: "custom_event", label: "Custom event" },
  ];

  // ─── Reusable inline styles ─────────────────────────────────────────────────
  const manrope: React.CSSProperties = { fontFamily: '"Manrope", system-ui, sans-serif' };

  return (
    <div style={{ display: "flex", flexDirection: "column", paddingBlock: 32, paddingInline: 40, gap: 20, background: "#FFFFFF", minHeight: "100vh" }}>

      {/* ── Page header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#8D8D8D", marginBottom: 6 }}>
            Marketing · Email Automation
          </p>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: "#1B1B1B", lineHeight: "40px", margin: 0 }}>
            Automations
          </h1>
          <p style={{ fontSize: 13, fontWeight: 500, color: "#8D8D8D", marginTop: 6 }}>
            Build automated email workflows triggered by contact behavior.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, paddingTop: 4 }}>
          <button style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#FFFFFF", border: "1px solid #DEE8E8", borderRadius: 999,
            paddingBlock: 10, paddingInline: 16, cursor: "pointer",
            fontSize: 13, fontWeight: 600, color: "#1B1B1B",
          }}>
            <RiUploadLine style={{ width: 14, height: 14 }} />
            Import workflow
          </button>
          <button style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#FFFFFF", border: "1px solid #DEE8E8", borderRadius: 999,
            paddingBlock: 10, paddingInline: 16, cursor: "pointer",
            fontSize: 13, fontWeight: 600, color: "#1B1B1B",
          }}>
            <RiLayoutGridLine style={{ width: 14, height: 14 }} />
            Templates
          </button>
          <Link href="/marketing/automations/new" style={{ textDecoration: "none" }}>
            <button style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "#16DAC1", border: "none", borderRadius: 999,
              paddingBlock: 10, paddingInline: 20, cursor: "pointer",
              boxShadow: "#14C4AE47 0px 6px 14px",
              fontSize: 13, fontWeight: 700, color: "#FFFFFF",
            }}>
              <RiAddLine style={{ width: 14, height: 14, color: "#000000" }} />
              New automation
            </button>
          </Link>
        </div>
      </div>

      {/* ── Tabs row ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        {/* Pill tab container */}
        <div style={{ display: "inline-flex", background: "#F0F7F7", borderRadius: 999, padding: 4, gap: 4 }}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  borderRadius: 999, paddingBlock: 8, paddingInline: 16,
                  border: "none", cursor: "pointer",
                  background: isActive ? "#FFFFFF" : "transparent",
                  boxShadow: isActive ? "#00000014 0px 4px 16px" : "none",
                  transition: "all 0.15s",
                  ...manrope,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? "#1B1B1B" : "#5F5F5F" }}>
                  {tab.label}
                </span>
                {isActive ? (
                  <span style={{
                    background: "#F0F7F7", borderRadius: 999,
                    paddingBlock: 2, paddingInline: 8,
                    fontSize: 11, fontWeight: 600, color: "#8D8D8D",
                  }}>
                    {counts[tab.key]}
                  </span>
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#8D8D8D" }}>
                    {counts[tab.key]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Trigger filter + Search */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Select
            value={triggerFilter}
            onChange={(val) => setTriggerFilter(val as AutomationTriggerType | "")}
            options={TRIGGER_OPTIONS}
            className="w-44"
          />
          <div style={{ position: "relative" }}>
            <RiSearchLine style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", width: 12, height: 12, color: "#8D8D8D" }} />
            <input
              type="text"
              placeholder="Search automations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                paddingBlock: 8, paddingLeft: 34, paddingRight: 14,
                background: "#F0F7F7", border: "1px solid #DEE8E8", borderRadius: 999,
                fontSize: 13, fontWeight: 500, color: "#0F2A37",
                minWidth: 240, outline: "none",
                ...manrope,
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Automations table ── */}
      <div style={{
        background: "#FFFFFF", border: "1px solid #E5EAEC",
        borderRadius: 14, overflow: "clip",
        ...manrope,
      }}>
        {/* Table header */}
        <div style={{
          display: "flex", alignItems: "center",
          background: "#F8FAFB", borderBottom: "1px solid #E5EAEC",
          paddingBlock: 14, paddingInline: 20,
        }}>
          <div style={{ width: 28, flexShrink: 0, marginRight: 8 }}>
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => { if (el) el.indeterminate = someSelected; }}
              onChange={toggleSelectAll}
              style={{ accentColor: "#16DAC1", cursor: "pointer" }}
            />
          </div>
          {(["AUTOMATION", "STATUS", "TRIGGER", "CONTACTS", "OPEN RATE", "LAST EDITED"] as const).map((col) => {
            const widths: Record<string, number> = { AUTOMATION: 380, STATUS: 160, TRIGGER: 220, CONTACTS: 120, "OPEN RATE": 120, "LAST EDITED": 140 };
            return (
              <div key={col} style={{
                width: widths[col], flexShrink: 0,
                fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
                textTransform: "uppercase", color: "#4A5C66",
              }}>
                {col}
              </div>
            );
          })}
          <div style={{ flex: 1 }} />
          <div style={{ width: 30 }} />
        </div>

        {/* Table body */}
        {loading || wsLoading ? (
          <TableSkeleton />
        ) : automations.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingBlock: 96, gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#16DAC124", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <RiFlowChart style={{ width: 28, height: 28, color: "#14C4AE" }} />
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontWeight: 700, color: "#0F2A37", fontSize: 14 }}>No automations yet</p>
              <p style={{ fontSize: 13, color: "#7A8A93", marginTop: 4 }}>Create your first workflow to start automating emails.</p>
            </div>
            <Link href="/marketing/automations/new" style={{ textDecoration: "none" }}>
              <button style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "#16DAC1", border: "none", borderRadius: 999,
                paddingBlock: 10, paddingInline: 20, cursor: "pointer",
                boxShadow: "#14C4AE47 0px 6px 14px",
                fontSize: 13, fontWeight: 700, color: "#FFFFFF",
                ...manrope,
              }}>
                <RiAddLine style={{ width: 14, height: 14 }} />
                New automation
              </button>
            </Link>
          </div>
        ) : (
          automations.map((a) => (
            <div
              key={a.id}
              onClick={() => router.push(`/marketing/automations/${a.id}/edit`)}
              style={{
                display: "flex", alignItems: "center",
                paddingBlock: 16, paddingInline: 20,
                borderBottom: "1px solid #EAEEF0",
                cursor: "pointer", transition: "background 0.12s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#F8FAFB")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {/* Checkbox */}
              <div style={{ width: 28, flexShrink: 0, marginRight: 8 }} onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(a.id)}
                  onChange={() => toggleSelectOne(a.id)}
                  style={{ accentColor: "#16DAC1", cursor: "pointer" }}
                />
              </div>

              {/* Automation col */}
              <div style={{ width: 380, flexShrink: 0, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: "#16DAC124", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8L6.5 11.5L13 4.5" stroke="#14C4AE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#0F2A37", lineHeight: "18px", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {a.name}
                  </p>
                  <p style={{ fontSize: 11, fontWeight: 400, color: "#7A8A93", lineHeight: "14px", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {stepSummary(a.steps ?? [])}
                    {a.owner_name && ` · Owner: ${a.owner_name}`}
                  </p>
                </div>
              </div>

              {/* Status col */}
              <div style={{ width: 160, flexShrink: 0 }}>
                <StatusBadge status={a.status} />
              </div>

              {/* Trigger col */}
              <div style={{ width: 220, flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
                  <circle cx="6" cy="6" r="5" stroke="#4A5C66" strokeWidth="1.5" />
                  <path d="M6 4V6L7.5 7.5" stroke="#4A5C66" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span style={{ fontSize: 12, fontWeight: 500, color: "#0F2A37", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {triggerLabel(a.trigger_type, a.trigger_config)}
                </span>
              </div>

              {/* Contacts col */}
              <div style={{ width: 120, flexShrink: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#0F2A37", margin: 0, lineHeight: "18px" }}>
                  {a.total_enrolled.toLocaleString()}
                  <span style={{ fontSize: 11, fontWeight: 400, color: "#7A8A93", marginLeft: 4 }}>enrolled</span>
                </p>
                {a.trigger_type === "list_subscription" && a.trigger_config?.list_id && listCounts[a.trigger_config.list_id as string] !== undefined && (
                  <p style={{ fontSize: 11, fontWeight: 500, color: "#14C4AE", margin: 0, marginTop: 3, lineHeight: "14px", display: "flex", alignItems: "center", gap: 3 }}>
                    <svg width="9" height="9" viewBox="0 0 9 9" fill="none" style={{ flexShrink: 0 }}>
                      <circle cx="4.5" cy="4.5" r="4.5" fill="#14C4AE" fillOpacity="0.2" />
                      <circle cx="4.5" cy="4.5" r="2" fill="#14C4AE" />
                    </svg>
                    {(listCounts[a.trigger_config.list_id as string] ?? 0).toLocaleString()} in list
                  </p>
                )}
              </div>

              {/* Open rate col */}
              <div style={{ width: 120, flexShrink: 0 }}>
                {a.avg_open_rate != null ? (
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#0F2A37", margin: 0 }}>{a.avg_open_rate.toFixed(1)}%</p>
                    <div style={{ width: 80, height: 4, background: "#EAEEF0", borderRadius: 2, marginTop: 4 }}>
                      <div style={{ height: 4, background: "#14C4AE", borderRadius: 2, width: `${Math.min(a.avg_open_rate, 100) * 0.8}px` }} />
                    </div>
                  </div>
                ) : (
                  <span style={{ color: "#7A8A93" }}>—</span>
                )}
              </div>

              {/* Last edited col */}
              <div style={{ width: 140, flexShrink: 0, fontSize: 12, fontWeight: 400, color: "#4A5C66" }}>
                {relativeDate(a.updated_at)}
              </div>

              <div style={{ flex: 1 }} />

              {/* 3-dot button */}
              <div onClick={(e) => e.stopPropagation()} style={{ width: 30, flexShrink: 0 }}>
                <RowMenu
                  automation={a}
                  onEdit={() => router.push(`/marketing/automations/${a.id}/edit`)}
                  onStats={() => router.push(`/marketing/automations/${a.id}/stats`)}
                  onDuplicate={() => handleDuplicate(a)}
                  onPauseResume={() => handlePauseResume(a)}
                  onArchive={() => handleArchive(a)}
                  onDelete={() => { setDeleteTarget(a); setDeleteOpen(true); }}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer count */}
      {!loading && total > 0 && (
        <div style={{ fontSize: 12, color: "#7A8A93", ...manrope }}>
          {total} automation{total !== 1 ? "s" : ""}
        </div>
      )}

      {/* Delete modal */}
      <DeleteModal
        open={deleteOpen}
        automation={deleteTarget}
        onClose={() => { setDeleteOpen(false); setDeleteTarget(null); }}
        onConfirm={handleDelete}
        loading={deleting}
      />

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-xl">
          <span className="text-sm font-medium" style={manrope}>{selectedIds.size} selected</span>
          <div className="w-px h-4 bg-white/20" />
          <button
            onClick={handleBulkPause}
            disabled={bulkLoading}
            className="text-sm hover:text-amber-300 transition-colors disabled:opacity-50"
            style={manrope}
          >
            Pause all
          </button>
          <button
            onClick={handleBulkArchive}
            disabled={bulkLoading}
            className="text-sm hover:text-gray-300 transition-colors disabled:opacity-50"
            style={manrope}
          >
            Archive all
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={bulkLoading}
            className="text-sm hover:text-red-400 transition-colors disabled:opacity-50"
            style={manrope}
          >
            Delete all
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="size-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center ml-1 text-xs"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AutomationStatus }) {
  const map: Record<AutomationStatus, { dot: string; bg: string }> = {
    active: { dot: "#10B89F", bg: "#16DAC11F" },
    paused: { dot: "#F5A623", bg: "#FFB80026" },
    draft: { dot: "#7A8A93", bg: "#7A8A9326" },
    archived: { dot: "#7A8A93", bg: "#7A8A9326" },
  };
  const s = map[status] ?? map.draft;
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      background: s.bg, borderRadius: 999,
      paddingBlock: 4, paddingInline: 10,
      fontFamily: '"Manrope", system-ui, sans-serif',
      fontSize: 11, fontWeight: 700, color: "#0F2A37",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {label}
    </span>
  );
}
