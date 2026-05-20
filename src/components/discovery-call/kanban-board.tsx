"use client";

import * as React from "react";
import { RiAddLine } from "@remixicon/react";
import type { DiscoveryCallRow, DiscoveryCallStage } from "@/lib/supabase/types";
import { STAGES } from "./constants";
import { KanbanCard } from "./kanban-card";

// ─── Empty column state ───────────────────────────────────────────────────────

const STAGE_DESCRIPTIONS: Record<DiscoveryCallStage, string> = {
  replied: "Prospects who have replied to your outreach go here.",
  waiting_reschedule: "Cards where the interview was missed or postponed.",
  scheduled: "Interviews confirmed with a date and time.",
  waiting_result: "Interviews done — awaiting survey or review.",
  finished: "Calls with a final result: Qualified, Nurture, or Not qualified.",
  skipped: "Prospects who dropped without resolution.",
};

function EmptyColumn({ stage, onAdd }: { stage: DiscoveryCallStage; onAdd: () => void }) {
  return (
    <div className="flex-1 rounded-xl border-2 border-dashed border-border/60 p-4 flex flex-col items-center justify-center text-center gap-2 min-h-[120px]">
      <p className="text-xs text-foreground-muted">{STAGE_DESCRIPTIONS[stage]}</p>
      <button
        onClick={onAdd}
        className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline transition-colors"
      >
        <RiAddLine size={12} /> Add manually
      </button>
    </div>
  );
}

// ─── Column header ────────────────────────────────────────────────────────────

function ColumnHeader({ stageKey, count, onAdd }: { stageKey: DiscoveryCallStage; count: number; onAdd: () => void }) {
  const stage = STAGES.find((s) => s.key === stageKey)!;
  return (
    <div className="flex items-center justify-between mb-3 shrink-0">
      <div className="flex items-center gap-2">
        <span className={`size-2 rounded-full ${stage.dot}`} />
        <span className="text-sm font-semibold">{stage.label}</span>
        {count > 0 && (
          <span className="text-xs font-semibold bg-background-subtle border border-border rounded-full px-2 py-0.5">
            {count}
          </span>
        )}
      </div>
      <button
        onClick={onAdd}
        className="size-6 flex items-center justify-center rounded-full hover:bg-background-subtle text-foreground-muted transition-colors"
      >
        <RiAddLine size={14} />
      </button>
    </div>
  );
}

// ─── Board ────────────────────────────────────────────────────────────────────

interface KanbanBoardProps {
  calls: DiscoveryCallRow[];
  isTeamView: boolean;
  onEdit: (call: DiscoveryCallRow) => void;
  onMove: (call: DiscoveryCallRow, stage: DiscoveryCallStage) => void;
  onDelete: (call: DiscoveryCallRow) => void;
  onOpenContact: (call: DiscoveryCallRow) => void;
  onAddToStage: (stage: DiscoveryCallStage) => void;
}

export function KanbanBoard({ calls, isTeamView, onEdit, onMove, onDelete, onOpenContact, onAddToStage }: KanbanBoardProps) {
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [overStage, setOverStage] = React.useState<DiscoveryCallStage | null>(null);
  // Track enter/leave counts per column to handle child element events correctly
  const enterCounters = React.useRef<Partial<Record<DiscoveryCallStage, number>>>({});

  // Group calls by stage
  const byStage = React.useMemo(() => {
    const map: Record<DiscoveryCallStage, DiscoveryCallRow[]> = {
      replied: [],
      waiting_reschedule: [],
      scheduled: [],
      waiting_result: [],
      finished: [],
      skipped: [],
    };
    for (const c of calls) {
      if (map[c.stage]) map[c.stage].push(c);
    }
    return map;
  }, [calls]);

  function handleDragEnter(stage: DiscoveryCallStage) {
    enterCounters.current[stage] = (enterCounters.current[stage] ?? 0) + 1;
    setOverStage(stage);
  }

  function handleDragLeave(stage: DiscoveryCallStage) {
    enterCounters.current[stage] = (enterCounters.current[stage] ?? 1) - 1;
    if ((enterCounters.current[stage] ?? 0) <= 0) {
      enterCounters.current[stage] = 0;
      setOverStage((prev) => (prev === stage ? null : prev));
    }
  }

  function handleDrop(e: React.DragEvent, stage: DiscoveryCallStage) {
    e.preventDefault();
    const callId = e.dataTransfer.getData("callId");
    const draggedCall = calls.find((c) => c.id === callId);
    if (draggedCall && draggedCall.stage !== stage) {
      onMove(draggedCall, stage);
    }
    setDraggingId(null);
    setOverStage(null);
    enterCounters.current = {};
  }

  function handleDragEnd() {
    setDraggingId(null);
    setOverStage(null);
    enterCounters.current = {};
  }

  const isDraggingAny = draggingId !== null;

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-180px)]">
      {STAGES.map((stage) => {
        const stageCalls = byStage[stage.key];
        const isOver = overStage === stage.key;
        const isSameStage = draggingId ? calls.find((c) => c.id === draggingId)?.stage === stage.key : false;

        return (
          <div
            key={stage.key}
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={() => handleDragEnter(stage.key)}
            onDragLeave={() => handleDragLeave(stage.key)}
            onDrop={(e) => handleDrop(e, stage.key)}
            className={`flex flex-col shrink-0 rounded-2xl p-3 transition-all duration-200 ${
              stage.key === "waiting_reschedule"
                ? "bg-amber-50/60 border border-amber-100 w-[280px]"
                : stage.key === "finished"
                ? "bg-red-50/30 border border-red-100/60 w-[280px]"
                : stage.key === "skipped"
                ? "bg-background-subtle border border-border w-[260px]"
                : "bg-background-subtle border border-border w-[280px]"
            } ${
              isOver && !isSameStage
                ? "ring-2 ring-primary ring-inset !border-primary/40 scale-[1.01] shadow-lg"
                : isDraggingAny && !isSameStage
                ? "opacity-80"
                : ""
            }`}
          >
            <ColumnHeader stageKey={stage.key} count={stageCalls.length} onAdd={() => onAddToStage(stage.key)} />

            <div className="flex flex-col gap-2 flex-1">
              {/* Drop indicator at top when column is empty or being hovered */}
              {isOver && !isSameStage && (
                <div className="h-1.5 rounded-full bg-primary/40 animate-pulse mx-1" />
              )}

              {stageCalls.length === 0 ? (
                isDraggingAny && !isSameStage ? (
                  <div
                    className={`flex-1 min-h-[80px] rounded-xl border-2 border-dashed flex items-center justify-center transition-all duration-200 ${
                      isOver
                        ? "border-primary bg-primary/5 text-primary scale-[1.02]"
                        : "border-border/40 text-foreground-muted"
                    }`}
                  >
                    <p className="text-xs font-semibold">
                      {isOver ? "↓ Drop here" : ""}
                    </p>
                  </div>
                ) : null
              ) : (
                stageCalls.map((call) => (
                  <KanbanCard
                    key={call.id}
                    call={call}
                    isTeamView={isTeamView}
                    isDragging={draggingId === call.id}
                    onDragStart={() => setDraggingId(call.id)}
                    onDragEnd={handleDragEnd}
                    onEdit={() => onEdit(call)}
                    onMove={(stage) => onMove(call, stage)}
                    onDelete={() => onDelete(call)}
                    onOpenContact={() => onOpenContact(call)}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
