"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  RiAddLine, RiTeamLine, RiUserLine, RiSearchLine, RiCalendarLine, RiEditLine,
  RiCloseLine, RiLayoutColumnLine, RiAlertLine, RiCheckboxCircleLine, RiBarChartBoxLine,
} from "@remixicon/react";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { createClient } from "@/lib/supabase/browser";
import {
  getDiscoveryCalls,
  createDiscoveryCall,
  updateDiscoveryCall,
  moveDiscoveryCallStage,
  deleteDiscoveryCall,
  restoreDiscoveryCall,
} from "@/lib/queries/discovery-calls";
import type {
  DiscoveryCallRow,
  DiscoveryCallStage,
} from "@/lib/supabase/types";
import { KanbanBoard } from "@/components/discovery-call/kanban-board";
import { ScheduleView } from "@/components/discovery-call/schedule-view";
import { FilterDropdown } from "@/components/ui/filter-dropdown";
import { AddEditModal, type DiscoveryCallFormState } from "@/components/discovery-call/add-edit-modal";
import { StageTransitionModal, type TransitionPayload } from "@/components/discovery-call/stage-transition-modal";
import { DeleteConfirmModal } from "@/components/discovery-call/delete-confirm-modal";
import { ContactQuickView } from "@/components/contacts/contact-quick-view";
import { isStale } from "@/components/discovery-call/constants";
import type { ContactRow } from "@/lib/supabase/types";

// ─── File upload helper ───────────────────────────────────────────────────────

async function uploadAttachments(
  callId: string,
  workspaceId: string,
  userId: string,
  files: File[]
): Promise<{ uploaded: number; errors: string[] }> {
  const { createClient } = await import("@/lib/supabase/browser");
  const supabase = createClient();
  let uploaded = 0;
  const errors: string[] = [];

  for (const file of files) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${workspaceId}/${callId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("dc-attachments")
      .upload(path, file, { upsert: false });

    if (uploadError) {
      errors.push(`${file.name}: ${uploadError.message}`);
      continue;
    }

    const { error: dbError } = await (supabase as any)
      .from("discovery_call_attachments")
      .insert({
        discovery_call_id: callId,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
        uploaded_by: userId,
      });

    if (dbError) {
      // Remove orphaned storage file if DB insert fails
      await supabase.storage.from("dc-attachments").remove([path]);
      errors.push(`${file.name}: ${dbError.message}`);
    } else {
      uploaded++;
    }
  }

  return { uploaded, errors };
}

// ─── Toast ────────────────────────────────────────────────────────────────────

interface Toast { id: string; message: string; onUndo?: () => void }

function ToastBar({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto flex items-center gap-3 bg-foreground text-background rounded-full px-5 py-3 shadow-xl text-sm font-medium">
          <span>{t.message}</span>
          {t.onUndo && (
            <button onClick={t.onUndo} className="text-primary font-semibold hover:underline">
              Undo
            </button>
          )}
          <button onClick={() => onDismiss(t.id)} className="text-background/60 hover:text-background">✕</button>
        </div>
      ))}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 py-24">
      <div className="relative mb-6">
        <div className="size-16 rounded-2xl bg-background-subtle border border-border flex items-center justify-center">
          <RiSearchLine size={28} className="text-foreground-muted" />
        </div>
        <div className="absolute -bottom-2 -right-2 size-8 rounded-full bg-primary flex items-center justify-center">
          <RiAddLine size={16} className="text-white" />
        </div>
      </div>
      <h2 className="text-xl font-bold mb-2">No discovery calls yet</h2>
      <p className="text-sm text-foreground-muted text-center max-w-sm mb-6">
        When a prospect replies via Email, WhatsApp, LinkedIn, or Instagram, add a card here.
        Move it through Replied → Waiting Reschedule → Scheduled → Waiting Result → Finished as the conversation progresses.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={onAdd}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          <RiAddLine size={16} /> Add discovery call
        </button>
      </div>
      <div className="mt-6 border border-border rounded-xl px-5 py-4 flex items-start gap-3 max-w-sm">
        <span className="text-primary">⚡</span>
        <div>
          <p className="text-sm font-semibold">Quick start</p>
          <p className="text-xs text-foreground-muted">Each discovery call belongs to one contact. Owner is set to you automatically. Survey, interview date, and result can be filled in as you go.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Warn Date Modal ──────────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  scheduled:      "Scheduled",
  waiting_result: "Waiting Result",
  finished:       "Finished",
};

function WarnDateModal({
  call,
  toStage,
  onEdit,
  onCancel,
}: {
  call: DiscoveryCallRow;
  toStage: DiscoveryCallStage;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const contact = call.contact as unknown as { name: string } | undefined;
  const stageName = STAGE_LABELS[toStage] ?? toStage;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-[400px] rounded-2xl bg-background shadow-2xl p-6">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="size-14 rounded-full bg-amber-100 flex items-center justify-center">
            <RiCalendarLine size={26} className="text-amber-500" />
          </div>
        </div>

        <h2 className="text-lg font-bold text-center mb-1">Interview date required</h2>
        <p className="text-sm text-foreground-muted text-center mb-2">
          To move <span className="font-semibold text-foreground">{contact?.name ?? "this card"}</span> to{" "}
          <span className="font-semibold text-foreground">{stageName}</span>, please fill in the interview date first.
        </p>
        <p className="text-xs text-foreground-muted text-center mb-6">
          An interview date helps the team track timelines and prevents stale cards.
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={onEdit}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm font-semibold rounded-full bg-primary text-white hover:opacity-90 transition-opacity"
          >
            <RiEditLine size={15} /> Edit card & add date
          </button>
          <button
            onClick={onCancel}
            className="w-full px-4 py-2.5 text-sm font-medium rounded-full border border-border hover:bg-background-subtle transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// Stages that require an interview date before moving into them
const STAGES_REQUIRE_DATE: DiscoveryCallStage[] = ["scheduled", "waiting_result", "finished"];

type ModalState =
  | { type: "none" }
  | { type: "add"; defaultStage?: DiscoveryCallStage }
  | { type: "edit"; call: DiscoveryCallRow }
  | { type: "move"; call: DiscoveryCallRow; toStage: DiscoveryCallStage }
  | { type: "delete"; call: DiscoveryCallRow }
  | { type: "warn_date"; call: DiscoveryCallRow; toStage: DiscoveryCallStage };

export default function DiscoveryCallPage() {
  const { workspaceId } = useWorkspace();
  const router = useRouter();

  const [calls, setCalls] = React.useState<DiscoveryCallRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [myCallsOnly, setMyCallsOnly] = React.useState(true);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [userName, setUserName] = React.useState("You");
  const [modal, setModal] = React.useState<ModalState>({ type: "none" });
  const [saving, setSaving] = React.useState(false);
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const [quickViewContact, setQuickViewContact] = React.useState<ContactRow | null>(null);
  const [viewMode, setViewMode] = React.useState<"kanban" | "schedule">("kanban");
  // Stores the stage we intended to move to after the user edits the card (from warn_date flow)
  const pendingMoveStage = React.useRef<DiscoveryCallStage | null>(null);

  // ── Filter state ───────────────────────────────────────────────────────────
  const [search,        setSearch]        = React.useState("");
  const [filterSources, setFilterSources] = React.useState<string[]>([]);
  const [filterResults, setFilterResults] = React.useState<string[]>([]);
  const [filterOwnerIds, setFilterOwnerIds] = React.useState<string[]>([]);
  // Year — single select; Quarter — multi-select string[] ("1"…"4")
  // Default: current year & current quarter
  const [filterYear,    setFilterYear]    = React.useState<number | null>(() => new Date().getFullYear());
  const [filterQuarters, setFilterQuarters] = React.useState<string[]>(
    () => [String(Math.ceil((new Date().getMonth() + 1) / 3))]
  );

  // Unique owners derived from all calls (for team-view owner filter)
  const kanbanOwners = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const call of calls) {
      const ownerId = (call as any).owner_id as string | undefined;
      const owner   = call.owner as { display_name: string | null; email: string | null } | undefined;
      if (ownerId && !map.has(ownerId)) {
        const name = owner?.display_name ?? owner?.email?.split("@")[0] ?? "?";
        map.set(ownerId, { id: ownerId, name });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [calls]);

  const filteredCalls = React.useMemo(() => {
    let list = calls;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => {
        const contact = c.contact as unknown as { name: string } | undefined;
        return contact?.name?.toLowerCase().includes(q);
      });
    }
    if (filterSources.length > 0) {
      list = list.filter((c) => filterSources.includes(c.lead_source));
    }
    if (filterResults.length > 0) {
      list = list.filter((c) => filterResults.includes(c.result));
    }
    if (filterOwnerIds.length > 0) {
      list = list.filter((c) => filterOwnerIds.includes((c as any).owner_id));
    }
    if (filterYear !== null) {
      list = list.filter((c) => {
        const createdYear   = parseInt(c.created_at.slice(0, 4), 10);
        const interviewYear = c.interview_date ? parseInt(c.interview_date.slice(0, 4), 10) : null;
        const yearMatch = createdYear === filterYear || interviewYear === filterYear;
        if (!yearMatch) return false;

        if (filterQuarters.length > 0) {
          const createdMonth   = parseInt(c.created_at.slice(5, 7), 10);
          const createdQ       = String(Math.ceil(createdMonth / 3));
          const interviewMonth = c.interview_date ? parseInt(c.interview_date.slice(5, 7), 10) : null;
          const interviewQ     = interviewMonth ? String(Math.ceil(interviewMonth / 3)) : null;
          return filterQuarters.includes(createdQ) || (interviewQ !== null && filterQuarters.includes(interviewQ));
        }
        return true;
      });
    }
    return list;
  }, [calls, search, filterSources, filterResults, filterOwnerIds, filterYear, filterQuarters]);

  const hasActiveFilter =
    search.trim() !== "" || filterSources.length > 0 || filterResults.length > 0 ||
    filterOwnerIds.length > 0 || filterYear !== null || filterQuarters.length > 0;

  // ── Pipeline stats (computed from filteredCalls — respects year/quarter filter) ──
  const pipelineStats = React.useMemo(() => {
    const now = new Date();

    // Monday of current week
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    const weekStartIso = weekStart.toISOString().slice(0, 10);
    const weekEndIso = weekEnd.toISOString().slice(0, 10);

    // This month
    const thisYear  = now.getFullYear();
    const thisMonth = now.getMonth();

    const active = filteredCalls.filter((c) => c.stage !== "finished" && c.stage !== "skipped");
    const stale  = active.filter((c) => isStale(c.stage, c.last_stage_change_at, c.interview_date));
    const thisWeek = filteredCalls.filter(
      (c) => c.interview_date && c.interview_date >= weekStartIso && c.interview_date <= weekEndIso
    );
    const qualifiedMTD = filteredCalls.filter((c) => {
      if (c.result !== "qualified" || !c.result_decided_at) return false;
      const d = new Date(c.result_decided_at);
      return d.getFullYear() === thisYear && d.getMonth() === thisMonth;
    });

    return {
      active: active.length,
      stale: stale.length,
      thisWeek: thisWeek.length,
      qualifiedMTD: qualifiedMTD.length,
    };
  }, [filteredCalls]);

  function clearFilters() {
    setSearch("");
    setFilterSources([]);
    setFilterResults([]);
    setFilterOwnerIds([]);
    setFilterYear(null);
    setFilterQuarters([]);
  }

  // ── Load user ──────────────────────────────────────────────────────────────
  React.useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      const name = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split("@")[0] ?? "You";
      setUserName(name);
    });
  }, []);

  // ── Fetch calls ────────────────────────────────────────────────────────────
  const fetchCalls = React.useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const { data } = await getDiscoveryCalls(workspaceId, {
      myCallsOnly,
      ownerId: userId ?? undefined,
    });
    setCalls(data);
    setLoading(false);
  }, [workspaceId, myCallsOnly, userId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => { fetchCalls(); }, [fetchCalls]);

  // ── Toasts ─────────────────────────────────────────────────────────────────
  function addToast(message: string, onUndo?: () => void) {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, onUndo }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }

  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  // ── CRUD handlers ──────────────────────────────────────────────────────────

  async function handleSave(form: DiscoveryCallFormState) {
    if (!workspaceId || !userId || !form.contact) return;
    setSaving(true);

    if (modal.type === "add") {
      const { data, error } = await createDiscoveryCall(workspaceId, userId, {
        contact_id: form.contact.id,
        stage: form.stage,
        lead_source: form.lead_source as never,
        interview_date: form.interview_date || null,
        interview_time: form.interview_time || null,
        interview_meeting_url: form.interview_meeting_url || null,
        interview_document_url: (form as any).interview_document_url || null,
        survey_status: form.survey_status,
        result: form.result,
        notes: form.notes || null,
      });
      if (data) {
        if (form.newAttachments.length > 0) {
          const { uploaded, errors } = await uploadAttachments(data.id, workspaceId, userId, form.newAttachments);
          if (errors.length) addToast(`⚠ ${errors.length} file(s) failed to upload: ${errors[0]}`);
          else if (uploaded) addToast(`${uploaded} file(s) attached ✓`);
        }
        setCalls((prev) => [data, ...prev]);
        addToast("Discovery call added to pipeline ✓");
      } else if (error) {
        addToast(`Error: ${error}`);
      }
    } else if (modal.type === "edit") {
      const { data, error } = await updateDiscoveryCall(workspaceId, modal.call.id, userId, {
        contact_id: form.contact.id,
        lead_source: form.lead_source as never,
        interview_date: form.interview_date || null,
        interview_time: form.interview_time || null,
        interview_meeting_url: form.interview_meeting_url || null,
        interview_document_url: (form as any).interview_document_url || null,
        survey_status: form.survey_status,
        result: form.result,
        notes: form.notes || null,
        owner_id: form.owner_id || undefined,
      });
      if (data) {
        if (form.newAttachments.length > 0) {
          const { errors } = await uploadAttachments(data.id, workspaceId, userId, form.newAttachments);
          if (errors.length) addToast(`⚠ ${errors.length} file(s) failed to upload: ${errors[0]}`);
        }
        setCalls((prev) => prev.map((c) => (c.id === data.id ? data : c)));

        // If this edit came from the warn_date flow, auto-retry the move
        const pendingStage = pendingMoveStage.current;
        pendingMoveStage.current = null;

        if (pendingStage) {
          setSaving(false);
          setModal({ type: "none" });
          // Small tick to let state settle before triggering the move
          setTimeout(() => handleMoveRequest(data, pendingStage), 50);
          return;
        }

        addToast("Changes saved ✓");
      } else if (error) {
        addToast(`Error: ${error}`);
      }
    }

    setSaving(false);
    setModal({ type: "none" });
  }

  async function handleMove(payload: TransitionPayload) {
    if (!workspaceId || !userId || modal.type !== "move") return;
    setSaving(true);

    const { data, error } = await moveDiscoveryCallStage(
      workspaceId,
      modal.call.id,
      userId,
      modal.call.stage,
      payload
    );

    if (data) {
      setCalls((prev) => prev.map((c) => (c.id === data.id ? data : c)));
      const stageLabel = payload.to_stage.replace(/_/g, " ");
      addToast(`Moved to ${stageLabel} ✓`);
    } else if (error) {
      addToast(`Error: ${error}`);
    }

    setSaving(false);
    setModal({ type: "none" });
  }

  async function handleDelete() {
    if (!workspaceId || !userId || modal.type !== "delete") return;
    setSaving(true);
    const target = modal.call;

    const { error } = await deleteDiscoveryCall(workspaceId, target.id, userId);
    if (!error) {
      setCalls((prev) => prev.filter((c) => c.id !== target.id));
      addToast("Discovery call removed · moved to Pipeline trash · auto-purge in 30 days", async () => {
        const { data } = await restoreDiscoveryCall(workspaceId, target.id, userId);
        if (data) setCalls((prev) => [data, ...prev]);
      });
    } else {
      addToast(`Error: ${error}`);
    }

    setSaving(false);
    setModal({ type: "none" });
  }

  function handleMoveRequest(call: DiscoveryCallRow, toStage: DiscoveryCallStage) {
    // Check interview date requirement before allowing the move
    if (STAGES_REQUIRE_DATE.includes(toStage) && !call.interview_date) {
      setModal({ type: "warn_date", call, toStage });
      return;
    }

    if (toStage === "waiting_reschedule" || toStage === "skipped" || toStage === "finished") {
      setModal({ type: "move", call, toStage });
    } else {
      // Direct move without prompt
      if (!workspaceId || !userId) return;
      moveDiscoveryCallStage(workspaceId, call.id, userId, call.stage, { to_stage: toStage }).then(({ data }) => {
        if (data) setCalls((prev) => prev.map((c) => (c.id === data.id ? data : c)));
      });
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const isEmpty = !loading && calls.length === 0;
  const isFilteredEmpty = !loading && calls.length > 0 && filteredCalls.length === 0;

  return (
    <main className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="px-8 pt-8 pb-4 shrink-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted mb-1">
          Outreach Creator · Discovery Call
        </p>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-bold">Discovery Call · Pipeline</h1>
          <div className="flex items-center gap-2 shrink-0">
            {/* My calls / Team toggle */}
            <div className="flex items-center rounded-full border border-border bg-background-subtle p-1">
              <button
                onClick={() => { setMyCallsOnly(true); setFilterOwnerIds([]); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  myCallsOnly ? "bg-background shadow-sm text-foreground" : "text-foreground-muted hover:text-foreground"
                }`}
              >
                <RiUserLine size={14} /> My calls
              </button>
              <button
                onClick={() => setMyCallsOnly(false)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  !myCallsOnly ? "bg-background shadow-sm text-foreground" : "text-foreground-muted hover:text-foreground"
                }`}
              >
                <RiTeamLine size={14} /> Team view
              </button>
            </div>

            {/* Kanban / Schedule view toggle */}
            <div className="flex items-center rounded-full border border-border bg-background-subtle p-1">
              <button
                onClick={() => setViewMode("kanban")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  viewMode === "kanban" ? "bg-background shadow-sm text-foreground" : "text-foreground-muted hover:text-foreground"
                }`}
              >
                <RiLayoutColumnLine size={14} /> Kanban
              </button>
              <button
                onClick={() => setViewMode("schedule")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  viewMode === "schedule" ? "bg-background shadow-sm text-foreground" : "text-foreground-muted hover:text-foreground"
                }`}
              >
                <RiCalendarLine size={14} /> Schedule
              </button>
            </div>

            <button
              onClick={() => setModal({ type: "add" })}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-white font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              <RiAddLine size={16} /> Add manually
            </button>
          </div>
        </div>
      </div>

      {/* Pipeline stats strip */}
      {!loading && calls.length > 0 && (
        <div className="px-8 pb-2 shrink-0 flex items-center gap-2 flex-wrap">
          <StatChip
            icon={<RiBarChartBoxLine size={13} />}
            label="Active"
            value={pipelineStats.active}
            tone="neutral"
          />
          <StatChip
            icon={<RiAlertLine size={13} />}
            label="Stale"
            value={pipelineStats.stale}
            tone={pipelineStats.stale > 0 ? "red" : "neutral"}
          />
          <StatChip
            icon={<RiCalendarLine size={13} />}
            label="This week"
            value={pipelineStats.thisWeek}
            tone={pipelineStats.thisWeek > 0 ? "primary" : "neutral"}
            onClick={() => setViewMode("schedule")}
            clickable
          />
          <StatChip
            icon={<RiCheckboxCircleLine size={13} />}
            label="Qualified MTD"
            value={pipelineStats.qualifiedMTD}
            tone={pipelineStats.qualifiedMTD > 0 ? "green" : "neutral"}
          />
        </div>
      )}

      {/* Filter bar */}
      {!loading && calls.length > 0 && viewMode === "kanban" && (
        <div className="px-8 pb-3 shrink-0 flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3.5 h-10 min-w-[200px]">
            <RiSearchLine size={14} className="text-foreground-muted shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name…"
              className="text-sm bg-transparent outline-none flex-1 min-w-0"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-foreground-muted hover:text-foreground">
                <RiCloseLine size={14} />
              </button>
            )}
          </div>

          {/* Owner — team view only */}
          {!myCallsOnly && (
            <FilterDropdown
              label="Owner"
              values={filterOwnerIds}
              onChange={setFilterOwnerIds}
              options={kanbanOwners.map((o) => ({ value: o.id, label: o.name }))}
            />
          )}

          {/* Lead source */}
          <FilterDropdown
            label="Lead source"
            values={filterSources}
            onChange={setFilterSources}
            options={[
              { value: "email",     label: "Email" },
              { value: "whatsapp",  label: "WhatsApp" },
              { value: "linkedin",  label: "LinkedIn" },
              { value: "instagram", label: "Instagram" },
            ]}
          />

          {/* Result */}
          <FilterDropdown
            label="Result"
            values={filterResults}
            onChange={setFilterResults}
            options={[
              { value: "qualified",     label: "Qualified" },
              { value: "nurture",       label: "Nurture" },
              { value: "not_qualified", label: "Not qualified" },
            ]}
          />

          {/* Year */}
          <YearDropdown
            value={filterYear}
            onChange={(y) => { setFilterYear(y); if (y === null) setFilterQuarters([]); }}
          />

          {/* Quarter */}
          <FilterDropdown
            label="Quarter"
            values={filterQuarters}
            onChange={(v) => {
              if (filterYear === null && v.length > 0) setFilterYear(new Date().getFullYear());
              setFilterQuarters(v);
            }}
            options={[
              { value: "1", label: "Q1 · Jan – Mar" },
              { value: "2", label: "Q2 · Apr – Jun" },
              { value: "3", label: "Q3 · Jul – Sep" },
              { value: "4", label: "Q4 · Oct – Dec" },
            ]}
          />

          {/* Clear all */}
          {hasActiveFilter && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 h-10 rounded-full text-xs font-semibold text-foreground-muted hover:text-foreground border border-dashed border-border hover:border-foreground-muted transition-colors"
            >
              <RiCloseLine size={12} /> Clear all
            </button>
          )}

          {/* Count */}
          {hasActiveFilter && (
            <span className="text-xs text-foreground-muted ml-auto">
              {filteredCalls.length} card{filteredCalls.length !== 1 ? "s" : ""} shown
            </span>
          )}
        </div>
      )}

      {/* Board / Schedule */}
      <div className="flex-1 overflow-auto px-8 pb-8">
        {loading ? (
          <div className="flex gap-4 pt-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="w-[280px] shrink-0 h-64 rounded-2xl bg-background-subtle border border-border animate-pulse" />
            ))}
          </div>
        ) : isEmpty ? (
          <EmptyState onAdd={() => setModal({ type: "add" })} />
        ) : viewMode === "schedule" ? (
          <ScheduleView
            calls={calls}
            isTeamView={!myCallsOnly}
            onEdit={(call) => setModal({ type: "edit", call })}
            onOpenContact={(call) => setQuickViewContact(call.contact as unknown as ContactRow)}
          />
        ) : isFilteredEmpty ? (
          <div className="flex flex-col items-center justify-center flex-1 py-24">
            <div className="size-14 rounded-2xl bg-background-subtle border border-border flex items-center justify-center mb-4">
              <RiSearchLine size={24} className="text-foreground-muted" />
            </div>
            <h2 className="text-lg font-bold mb-1">No cards match your filters</h2>
            <p className="text-sm text-foreground-muted mb-4">Try adjusting your search or removing a filter.</p>
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-border text-sm font-semibold hover:bg-background-subtle transition-colors"
            >
              <RiCloseLine size={14} /> Clear all filters
            </button>
          </div>
        ) : (
          <KanbanBoard
            calls={filteredCalls}
            isTeamView={!myCallsOnly}
            onEdit={(call) => setModal({ type: "edit", call })}
            onMove={handleMoveRequest}
            onDelete={(call) => setModal({ type: "delete", call })}
            onOpenContact={(call) => setQuickViewContact(call.contact as unknown as ContactRow)}
            onAddToStage={(stage) => setModal({ type: "add", defaultStage: stage })}
          />
        )}
      </div>

      {/* Modals */}
      {(modal.type === "add" || modal.type === "edit") && (
        <AddEditModal
          mode={modal.type}
          call={modal.type === "edit" ? modal.call : undefined}
          ownerName={userName}
          currentOwnerId={userId ?? ""}
          isTeamView={!myCallsOnly}
          onSave={handleSave}
          onCancel={() => setModal({ type: "none" })}
          onEditExisting={(existingCall) => setModal({ type: "edit", call: existingCall })}
          loading={saving}
        />
      )}

      {modal.type === "move" && (
        <StageTransitionModal
          call={modal.call}
          toStage={modal.toStage}
          onConfirm={handleMove}
          onCancel={() => setModal({ type: "none" })}
          loading={saving}
        />
      )}

      {modal.type === "delete" && (
        <DeleteConfirmModal
          call={modal.call}
          onConfirm={handleDelete}
          onCancel={() => setModal({ type: "none" })}
          loading={saving}
        />
      )}

      {modal.type === "warn_date" && (
        <WarnDateModal
          call={modal.call}
          toStage={modal.toStage}
          onEdit={() => {
            // Remember the destination so handleSave can retry the move after editing
            pendingMoveStage.current = modal.toStage;
            setModal({ type: "edit", call: modal.call });
          }}
          onCancel={() => {
            pendingMoveStage.current = null;
            setModal({ type: "none" });
          }}
        />
      )}

      {/* Contact quick view */}
      <ContactQuickView
        contact={quickViewContact}
        open={!!quickViewContact}
        onOpenChange={(open) => { if (!open) setQuickViewContact(null); }}
      />

      {/* Toasts */}
      <ToastBar toasts={toasts} onDismiss={dismissToast} />
    </main>
  );
}

// ─── YearDropdown ─────────────────────────────────────────────────────────────

function YearDropdown({ value, onChange }: { value: number | null; onChange: (y: number | null) => void }) {
  const [open, setOpen] = React.useState(false);
  const ref  = React.useRef<HTMLDivElement>(null);

  // Generate years from 2024 to current year + 1
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2023 }, (_, i) => 2024 + i);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-3 h-9 rounded-full text-xs font-semibold border transition-colors ${
          value !== null
            ? "border-primary bg-primary/10 text-primary"
            : "border-border text-foreground-muted hover:border-foreground-muted hover:text-foreground"
        }`}
      >
        <RiCalendarLine size={12} />
        {value ?? "Year"}
        {value !== null && (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
            className="ml-0.5 text-primary/60 hover:text-primary leading-none"
          >
            ✕
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-11 left-0 z-50 rounded-xl border border-border bg-background shadow-[0_8px_24px_rgba(0,0,0,0.10)] py-1.5 min-w-[110px]">
          <p className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted px-3 pt-1.5 pb-2">Year</p>
          {years.map((y) => (
            <button
              key={y}
              onClick={() => { onChange(y); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm font-medium transition-colors hover:bg-background-subtle ${
                value === y ? "text-primary font-semibold" : "text-foreground"
              }`}
            >
              {y}
              {y === currentYear && <span className="ml-1.5 text-[10px] text-foreground-muted">current</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── StatChip ─────────────────────────────────────────────────────────────────

function StatChip({
  icon,
  label,
  value,
  tone,
  onClick,
  clickable,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "neutral" | "red" | "primary" | "green";
  onClick?: () => void;
  clickable?: boolean;
}) {
  const colors: Record<string, string> = {
    neutral: "bg-background-subtle border-border text-foreground-muted",
    red:     "bg-red-50 border-red-200 text-red-700",
    primary: "bg-primary/8 border-primary/30 text-primary",
    green:   "bg-emerald-50 border-emerald-200 text-emerald-700",
  };

  const base = `inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-semibold transition-colors ${colors[tone]}`;
  const hoverClass = clickable ? "cursor-pointer hover:opacity-80" : "";

  if (clickable && onClick) {
    return (
      <button onClick={onClick} className={`${base} ${hoverClass}`}>
        {icon}
        <span className="text-[13px] font-bold">{value}</span>
        {label}
      </button>
    );
  }

  return (
    <div className={base}>
      {icon}
      <span className="text-[13px] font-bold">{value}</span>
      {label}
    </div>
  );
}
