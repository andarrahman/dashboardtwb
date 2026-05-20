"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  RiAddLine,
  RiDeleteBin2Line,
  RiSearchLine,
  RiMailSendLine,
  RiTimeLine,
  RiListCheck2,
  RiPriceTagLine,
  RiGitBranchLine,
  RiStopLine,
  RiCheckLine,
  RiArrowUpLine,
  RiArrowDownLine,
} from "@remixicon/react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/select";
import { AutomationHeader } from "@/components/marketing/automation-header";
import type { EmailAutomationRow, AutomationStep, AutomationStepType } from "@/lib/supabase/types";

// ─── Step definitions ──────────────────────────────────────────────────────────

interface StepDef {
  type: AutomationStepType;
  label: string;
  icon: React.ElementType;
  section: "trigger" | "action" | "logic";
  color: string;
  bgColor: string;
}

const STEP_DEFS: StepDef[] = [
  { type: "send_email", label: "Send email", icon: RiMailSendLine, section: "action", color: "text-blue-600", bgColor: "bg-blue-50 border-blue-200" },
  { type: "wait_delay", label: "Wait / Delay", icon: RiTimeLine, section: "action", color: "text-amber-600", bgColor: "bg-amber-50 border-amber-200" },
  { type: "move_to_list", label: "Move to list", icon: RiListCheck2, section: "action", color: "text-violet-600", bgColor: "bg-violet-50 border-violet-200" },
  { type: "tag_contact", label: "Tag contact", icon: RiPriceTagLine, section: "action", color: "text-teal-600", bgColor: "bg-teal-50 border-teal-200" },
  { type: "if_else", label: "If / Else branch", icon: RiGitBranchLine, section: "logic", color: "text-rose-600", bgColor: "bg-rose-50 border-rose-200" },
  { type: "end_workflow", label: "End workflow", icon: RiStopLine, section: "logic", color: "text-gray-600", bgColor: "bg-gray-100 border-gray-200" },
];

function getStepDef(type: AutomationStepType): StepDef {
  return STEP_DEFS.find((d) => d.type === type) ?? STEP_DEFS[0];
}

// ─── Drop zone between nodes ───────────────────────────────────────────────────

function DropZone({
  onClickAdd,
  onDrop,
  isDragging,
  isLast,
  isEmpty,
}: {
  onClickAdd: () => void;
  onDrop: () => void;
  isDragging: boolean;
  isLast?: boolean;
  isEmpty?: boolean;  // no steps yet — show "Add first step" label
}) {
  const [isOver, setIsOver] = React.useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsOver(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false);
    onDrop();
  };

  if (isDragging) {
    return (
      <div className="flex flex-col items-center w-full max-w-[340px] py-1">
        <div
          className={cn(
            "w-full rounded-xl border-2 border-dashed flex items-center justify-center",
            "transition-all duration-200",
            isOver
              ? "h-14 border-teal-500 bg-teal-50/80 scale-[1.02] shadow-[0_0_0_4px_rgba(20,196,174,0.15)]"
              : "h-10 animate-drop-zone-pulse",
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isOver ? (
            <span className="text-xs font-semibold text-teal-600 flex items-center gap-1.5 pointer-events-none">
              <RiAddLine className="size-3.5" /> Drop here
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center">
        <div className="w-px h-6 bg-border" />
        <button
          onClick={onClickAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-border text-sm text-text-tertiary hover:border-teal-400 hover:text-teal-500 transition-colors"
        >
          <RiAddLine className="size-4" />
          Add first step
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="w-px h-4 bg-border animate-connector-grow" />
      <button
        onClick={onClickAdd}
        className="size-6 rounded-full border-2 border-dashed border-border flex items-center justify-center text-text-tertiary hover:border-teal-400 hover:text-teal-500 transition-all hover:scale-110 active:scale-95"
      >
        <RiAddLine className="size-3.5" />
      </button>
      {!isLast && <div className="w-px h-2 bg-border" />}
    </div>
  );
}

// ─── Node card ─────────────────────────────────────────────────────────────────

function StepNode({
  step,
  selected,
  onSelect,
  onDelete,
  isLast,
  onMoveUp,
  onMoveDown,
  isFirst,
  isNew,
}: {
  step: AutomationStep;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isNew?: boolean;
}) {
  const def = getStepDef(step.type);
  const Icon = def.icon;
  const [hovered, setHovered] = React.useState(false);

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "w-full max-w-[340px] rounded-xl border-2 p-3 cursor-pointer transition-all relative",
        selected
          ? "border-teal-500 bg-teal-50/30 shadow-sm"
          : `border ${def.bgColor} hover:border-teal-300`,
        isNew ? "animate-drop-pop" : "",
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn("size-8 rounded-lg flex items-center justify-center shrink-0", def.bgColor)}>
          <Icon className={cn("size-4", def.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-primary truncate">{step.name}</p>
          <p className="text-xs text-text-tertiary truncate">{stepSubtitle(step)}</p>
        </div>
        {/* Reorder buttons — shown on hover */}
        {(hovered || selected) && (
          <div className="flex flex-col gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              disabled={isFirst}
              onClick={onMoveUp}
              className="p-0.5 text-text-tertiary hover:text-teal-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Move up"
            >
              <RiArrowUpLine className="size-3.5" />
            </button>
            <button
              disabled={isLast}
              onClick={onMoveDown}
              className="p-0.5 text-text-tertiary hover:text-teal-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Move down"
            >
              <RiArrowDownLine className="size-3.5" />
            </button>
          </div>
        )}
        {selected && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1 text-text-tertiary hover:text-red-500 transition-colors"
          >
            <RiDeleteBin2Line className="size-3.5" />
          </button>
        )}
      </div>
      {/* if_else branch indicator */}
      {step.type === "if_else" && (
        <div className="mt-2 flex gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700 border border-green-200">
            YES: {step.yes_steps?.length ?? 0} steps
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
            NO: {step.no_steps?.length ?? 0} steps
          </span>
        </div>
      )}
    </div>
  );
}

function stepSubtitle(step: AutomationStep): string {
  switch (step.type) {
    case "send_email": return step.template_name ?? step.subject_line ?? "No template selected";
    case "wait_delay": {
      const parts = [];
      if (step.delay_days) parts.push(`${step.delay_days}d`);
      if (step.delay_hours) parts.push(`${step.delay_hours}h`);
      return parts.length ? `Wait ${parts.join(" ")}` : "Set delay duration";
    }
    case "tag_contact": return step.tag ? `Tag: ${step.tag}` : "Set tag";
    case "move_to_list": return step.list_name ?? "Select list";
    case "if_else": {
      const f = step.condition_field;
      const o = step.condition_operator;
      const v = step.condition_value;
      if (f && o && v) return `${f} ${o} ${v}`;
      return "Conditional branch";
    }
    case "end_workflow": return "End of workflow";
    default: return "";
  }
}

// ─── Right panel: step editor ──────────────────────────────────────────────────

const IF_ELSE_FIELDS = [
  { value: "opened_email", label: "Opened email" },
  { value: "clicked_link", label: "Clicked link" },
  { value: "has_tag", label: "Has tag" },
  { value: "country", label: "Country" },
  { value: "account_tier", label: "Account tier" },
];

const IF_ELSE_OPERATORS = [
  { value: "is", label: "is" },
  { value: "is_not", label: "is not" },
  { value: "contains", label: "contains" },
];

function StepEditor({
  step,
  onChange,
  onClose,
  workspaceId,
}: {
  step: AutomationStep;
  onChange: (updated: AutomationStep) => void;
  onClose: () => void;
  workspaceId: string | null;
}) {
  const def = getStepDef(step.type);
  const Icon = def.icon;

  const [availableTemplates, setAvailableTemplates] = React.useState<
    { id: string; name: string; subject_line: string | null; status: string }[]
  >([]);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewHtml, setPreviewHtml] = React.useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);

  React.useEffect(() => {
    if (!workspaceId || step.type !== "send_email") return;
    const supabase = createClient();
    (supabase as any)
      .from("marketing_templates")
      .select("id, name, subject_line, status")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .in("status", ["published", "draft"])
      .order("name")
      .then(({ data }: { data: { id: string; name: string; subject_line: string | null; status: string }[] | null }) => {
        setAvailableTemplates(data ?? []);
      });
  }, [workspaceId, step.type]);

  async function handlePreview() {
    if (!workspaceId || !step.template_id) return;
    setPreviewLoading(true);
    setPreviewOpen(true);
    try {
      const supabase = createClient();
      const { data: tpl } = await (supabase as any)
        .from("marketing_templates")
        .select("html_content, subject_line")
        .eq("id", step.template_id)
        .single();
      if (tpl) {
        let html = (tpl as { html_content?: string | null }).html_content ?? "";
        // Apply sample variables
        const sampleVars: Record<string, string> = {
          first_name: "John",
          full_name: "John Doe",
          email: "john@example.com",
          company_name: "Twibbonize",
          unsubscribe_url: "#",
          manage_preferences_url: "#",
        };
        for (const [k, v] of Object.entries(sampleVars)) {
          html = html.replace(new RegExp(`{{\\s*${k}\\s*}}`, "g"), v);
        }
        setPreviewHtml(html);
      }
    } catch {
      setPreviewHtml("<p style='padding:24px;color:#999'>Failed to load template preview.</p>");
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className={cn("size-7 rounded-md flex items-center justify-center", def.bgColor)}>
            <Icon className={cn("size-3.5", def.color)} />
          </div>
          <span className="text-sm font-semibold text-text-primary">{def.label}</span>
        </div>
        <button onClick={onClose} className="text-text-tertiary hover:text-text-primary text-xs">
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Step name */}
        <div>
          <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wide block mb-1.5">
            Step name
          </label>
          <input
            value={step.name}
            onChange={(e) => onChange({ ...step, name: e.target.value })}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-teal-500/30"
          />
        </div>

        {/* Template Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-2xl w-full p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <DialogTitle className="text-sm font-semibold text-text-primary">
                Email Preview — {step.template_name ?? "Template"}
              </DialogTitle>
            </div>
            <div className="overflow-auto" style={{ maxHeight: "70vh" }}>
              {previewLoading ? (
                <div className="flex items-center justify-center py-16 text-sm text-text-tertiary">
                  Loading preview…
                </div>
              ) : previewHtml ? (
                <iframe
                  srcDoc={previewHtml}
                  className="w-full border-0"
                  style={{ minHeight: 500 }}
                  title="Email preview"
                  sandbox="allow-same-origin"
                />
              ) : (
                <div className="flex items-center justify-center py-16 text-sm text-text-tertiary">
                  No preview available.
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* send_email fields */}
        {step.type === "send_email" && (
          <>
            {/* Email Template Picker */}
            <div>
              <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wide block mb-1.5">
                Email template
              </label>
              {step.template_id ? (
                <div className="flex items-center gap-2 p-2 border border-border rounded-lg bg-background">
                  <span className="flex-1 text-sm font-medium text-text-primary truncate">
                    {step.template_name ?? step.template_id}
                  </span>
                  <button
                    onClick={handlePreview}
                    className="text-xs text-teal-600 hover:text-teal-700 shrink-0 font-medium"
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => onChange({ ...step, template_id: undefined, template_name: undefined })}
                    className="text-xs text-text-tertiary hover:text-text-primary shrink-0"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <Select
                  value={step.template_id ?? ""}
                  onChange={(val) => {
                    const t = availableTemplates.find((t) => t.id === val);
                    if (t) {
                      onChange({
                        ...step,
                        template_id: t.id,
                        template_name: t.name,
                        subject_line: step.subject_line || t.subject_line || "",
                      });
                    }
                  }}
                  placeholder="Select a template…"
                  options={availableTemplates.map((t) => ({
                    value: t.id,
                    label: `${t.name}${t.status === "draft" ? " (draft)" : ""}`,
                  }))}
                />
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wide block mb-1.5">
                Subject line
              </label>
              <input
                placeholder="Email subject…"
                value={step.subject_line ?? ""}
                onChange={(e) => onChange({ ...step, subject_line: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wide block mb-1.5">
                Preview text
              </label>
              <input
                placeholder="Preview text…"
                value={step.preview_text ?? ""}
                onChange={(e) => onChange({ ...step, preview_text: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wide block mb-1.5">
                From name
              </label>
              <input
                placeholder="Sender name…"
                value={step.from_name ?? ""}
                onChange={(e) => onChange({ ...step, from_name: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wide block mb-1.5">
                From email
              </label>
              <input
                type="email"
                placeholder="sender@example.com"
                value={step.from_email ?? ""}
                onChange={(e) => onChange({ ...step, from_email: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wide block mb-1.5">
                Goal (optional)
              </label>
              <input
                placeholder="e.g. Get a reply"
                value={step.goal ?? ""}
                onChange={(e) => onChange({ ...step, goal: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              />
            </div>
          </>
        )}

        {/* wait_delay fields */}
        {step.type === "wait_delay" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wide block mb-1.5">
                Days
              </label>
              <input
                type="number"
                min={0}
                value={step.delay_days ?? 0}
                onChange={(e) => onChange({ ...step, delay_days: Number(e.target.value) })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wide block mb-1.5">
                Hours
              </label>
              <input
                type="number"
                min={0}
                max={23}
                value={step.delay_hours ?? 0}
                onChange={(e) => onChange({ ...step, delay_hours: Number(e.target.value) })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              />
            </div>
          </div>
        )}

        {/* tag_contact fields */}
        {step.type === "tag_contact" && (
          <div>
            <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wide block mb-1.5">
              Tag
            </label>
            <input
              placeholder="e.g. interested-premium"
              value={step.tag ?? ""}
              onChange={(e) => onChange({ ...step, tag: e.target.value })}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-teal-500/30"
            />
          </div>
        )}

        {/* move_to_list fields */}
        {step.type === "move_to_list" && (
          <div>
            <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wide block mb-1.5">
              List name
            </label>
            <input
              placeholder="Destination list…"
              value={step.list_name ?? ""}
              onChange={(e) => onChange({ ...step, list_name: e.target.value })}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-teal-500/30"
            />
          </div>
        )}

        {/* if_else fields */}
        {step.type === "if_else" && (
          <>
            <div>
              <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wide block mb-2">
                Condition
              </label>
              <div className="space-y-2">
                <Select
                  value={step.condition_field ?? ""}
                  onChange={(val) => onChange({ ...step, condition_field: val })}
                  placeholder="Select field…"
                  options={IF_ELSE_FIELDS}
                />
                <Select
                  value={step.condition_operator ?? ""}
                  onChange={(val) => onChange({ ...step, condition_operator: val })}
                  placeholder="Select operator…"
                  options={IF_ELSE_OPERATORS}
                />
                <input
                  placeholder="Value…"
                  value={step.condition_value ?? ""}
                  onChange={(e) => onChange({ ...step, condition_value: e.target.value })}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border border-green-200 bg-green-50">
                <p className="text-xs font-semibold text-green-700 mb-1">YES branch</p>
                <p className="text-sm text-green-800">{step.yes_steps?.length ?? 0} step{(step.yes_steps?.length ?? 0) !== 1 ? "s" : ""}</p>
              </div>
              <div className="p-3 rounded-lg border border-rose-200 bg-rose-50">
                <p className="text-xs font-semibold text-rose-700 mb-1">NO branch</p>
                <p className="text-sm text-rose-800">{step.no_steps?.length ?? 0} step{(step.no_steps?.length ?? 0) !== 1 ? "s" : ""}</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Trigger panel (right panel when trigger node is selected) ────────────────

interface TriggerConfig {
  list_id?: string;
  list_name?: string;
  enroll_existing?: boolean;
  re_enroll?: "never" | "once_per_90d" | "always";
  send_window?: {
    enabled: boolean;
    start: string;
    end: string;
    timezone: string;
    skip_weekends: boolean;
  };
}

interface ContactList { id: string; name: string; contact_count: number }

function TriggerPanel({
  triggerConfig,
  onClose,
  onChange,
}: {
  triggerConfig: TriggerConfig;
  onClose: () => void;
  onChange: (updated: TriggerConfig) => void;
}) {
  const { workspaceId } = useWorkspace();
  const [lists, setLists] = React.useState<ContactList[]>([]);
  const cfg = triggerConfig;

  React.useEffect(() => {
    if (!workspaceId) return;
    const supabase = createClient();
    (supabase as any)
      .from("contact_lists")
      .select("id, name, contact_count")
      .eq("workspace_id", workspaceId)
      .order("name")
      .then(({ data }: { data: ContactList[] | null }) => setLists(data ?? []));
  }, [workspaceId]);

  const listOptions = lists.map((l) => ({
    value: l.id,
    label: l.name,
    sublabel: `${l.contact_count ?? 0} contacts`,
  }));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Trigger settings</h3>
        <button onClick={onClose} className="text-foreground-muted hover:text-foreground p-0.5">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Trigger type */}
        <div>
          <label className="text-xs font-semibold text-foreground-muted uppercase tracking-wide block mb-2">Trigger type</label>
          <div className="px-3 py-2.5 rounded-lg border border-border bg-background-subtle text-sm text-foreground font-medium">
            List subscription
          </div>
        </div>

        {/* List picker */}
        <div>
          <label className="text-xs font-semibold text-foreground-muted uppercase tracking-wide block mb-2">Trigger list</label>
          <Select
            value={cfg.list_id ?? ""}
            onChange={(val) => {
              const list = lists.find((l) => l.id === val);
              onChange({ ...cfg, list_id: val, list_name: list?.name });
            }}
            placeholder="Select a list…"
            options={listOptions}
          />
          {cfg.list_name && (
            <p className="text-xs text-foreground-muted mt-1.5">
              Contacts added to <strong>{cfg.list_name}</strong> will start this automation.
            </p>
          )}
        </div>

        {/* Enroll existing contacts */}
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="enroll-existing"
            checked={cfg.enroll_existing ?? false}
            onChange={(e) => onChange({ ...cfg, enroll_existing: e.target.checked })}
            className="mt-0.5 size-4 accent-teal-500 cursor-pointer"
          />
          <label htmlFor="enroll-existing" className="text-sm cursor-pointer" style={{ userSelect: "none" }}>
            <span className="font-medium text-foreground">Enroll existing contacts</span>
            <span className="block text-xs text-foreground-muted mt-0.5">Contacts already in the list when published will be enrolled immediately.</span>
          </label>
        </div>

        {/* Divider */}
        <div className="h-px bg-border" />

        {/* Re-enrollment */}
        <div>
          <label className="text-xs font-semibold text-foreground-muted uppercase tracking-wide block mb-3">Re-enrollment</label>
          <div className="space-y-2">
            {([
              ["never",         "Never",            "A contact can only go through this automation once."],
              ["once_per_90d",  "Once per 90 days", "A contact can re-enroll after 90 days have passed."],
              ["always",        "Always",           "Contacts can re-enroll every time they trigger the automation."],
            ] as const).map(([val, label, desc]) => (
              <label key={val} className="flex items-start gap-3 cursor-pointer group" style={{ userSelect: "none" }}>
                <input
                  type="radio"
                  name="re_enroll"
                  value={val}
                  checked={(cfg.re_enroll ?? "never") === val}
                  onChange={() => onChange({ ...cfg, re_enroll: val })}
                  className="mt-0.5 size-4 accent-teal-500 cursor-pointer"
                />
                <div>
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-foreground-muted">{desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main builder ──────────────────────────────────────────────────────────────

export default function AutomationEditPage() {
  const params = useParams();
  const router = useRouter();
  const { workspaceId, loading: wsLoading } = useWorkspace();
  const { showToast } = useToast();

  const automationId = params.id as string;

  const [automation, setAutomation] = React.useState<EmailAutomationRow | null>(null);
  const [steps, setSteps] = React.useState<AutomationStep[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);

  const [nameInput, setNameInput] = React.useState("");

  const [selectedStepId, setSelectedStepId] = React.useState<string | null>(null);
  const [triggerSelected, setTriggerSelected] = React.useState(false);
  const [sidebarSearch, setSidebarSearch] = React.useState("");

  // Drag & drop
  const [dragType, setDragType] = React.useState<AutomationStepType | null>(null);
  // Track newly added step id for entry animation
  const [newStepId, setNewStepId] = React.useState<string | null>(null);

  // Auto-save
  type AutoSaveStatus = "idle" | "saving" | "saved" | "error";
  const [autoSaveStatus, setAutoSaveStatus] = React.useState<AutoSaveStatus>("idle");
  const autoSaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep refs in sync so the debounced callback always reads latest values
  const stepsRef = React.useRef(steps);
  const automationRef = React.useRef(automation);
  React.useEffect(() => { stepsRef.current = steps; }, [steps]);
  React.useEffect(() => { automationRef.current = automation; }, [automation]);

  // Load automation
  React.useEffect(() => {
    if (!workspaceId || wsLoading) return;
    fetch(`/api/automations/${automationId}?workspace_id=${workspaceId}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.automation) {
          setAutomation(json.automation);
          setSteps(json.automation.steps ?? []);
          setNameInput(json.automation.name);
        }
      })
      .finally(() => setLoading(false));
  }, [workspaceId, wsLoading, automationId]);

  function scheduleAutoSave() {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => { void performAutoSave(); }, 2000);
  }

  async function performAutoSave() {
    const currentAutomation = automationRef.current;
    const currentSteps = stepsRef.current;
    if (!workspaceId || !currentAutomation) return;
    setAutoSaveStatus("saving");
    try {
      const res = await fetch(`/api/automations/${automationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          name: currentAutomation.name,
          steps: currentSteps,
        }),
      });
      if (!res.ok) throw new Error("Auto-save failed");
      const json = await res.json();
      if (json.automation) setAutomation(json.automation);
      setHasUnsavedChanges(false);
      setAutoSaveStatus("saved");
      setTimeout(() => setAutoSaveStatus("idle"), 3000);
    } catch {
      setAutoSaveStatus("error");
      setTimeout(() => setAutoSaveStatus("idle"), 5000);
    }
  }

  const selectedStep = steps.find((s) => s.id === selectedStepId) ?? null;

  function addStep(type: AutomationStepType, insertAfterIndex?: number) {
    const def = getStepDef(type);
    const newStep: AutomationStep = {
      id: crypto.randomUUID(),
      type,
      name: def.label,
    };
    setSteps((prev) => {
      const updated = [...prev];
      const idx = insertAfterIndex != null ? insertAfterIndex + 1 : updated.length;
      updated.splice(idx, 0, newStep);
      return updated;
    });
    setSelectedStepId(newStep.id);
    setHasUnsavedChanges(true);
    scheduleAutoSave();
    // Trigger entry animation
    setNewStepId(newStep.id);
    setTimeout(() => setNewStepId(null), 600);
  }

  function updateStep(updated: AutomationStep) {
    setSteps((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setHasUnsavedChanges(true);
    scheduleAutoSave();
  }

  function deleteStep(id: string) {
    setSteps((prev) => prev.filter((s) => s.id !== id));
    if (selectedStepId === id) setSelectedStepId(null);
    setHasUnsavedChanges(true);
    scheduleAutoSave();
  }

  function moveStep(index: number, direction: "up" | "down") {
    const newSteps = [...steps];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSteps.length) return;
    [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
    setSteps(newSteps);
    setHasUnsavedChanges(true);
    scheduleAutoSave();
  }

  function dropStep(insertAfterIndex: number) {
    if (!dragType) return;
    addStep(dragType, insertAfterIndex);
    setDragType(null);
  }

  async function updateTriggerConfig(updated: TriggerConfig) {
    if (!automation || !workspaceId) return;
    const newAutomation = { ...automation, trigger_config: { ...automation.trigger_config, ...updated } };
    setAutomation(newAutomation);
    // Save immediately
    try {
      const res = await fetch(`/api/automations/${automationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId, trigger_config: newAutomation.trigger_config }),
      });
      const json = await res.json();
      if (json.automation) setAutomation(json.automation);
    } catch { /* silent */ }
  }

  async function handleSave() {
    if (!workspaceId || !automation) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/automations/${automationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          name: automation.name,
          steps,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const json = await res.json();
      if (json.automation) setAutomation(json.automation);
      setHasUnsavedChanges(false);
      showToast({ title: "Changes saved" });
    } catch (err) {
      showToast({ title: "Error saving", subtitle: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  async function handlePauseResume() {
    if (!workspaceId) return;
    try {
      const res = await fetch(`/api/automations/${automationId}/pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      if (json.automation) {
        setAutomation(json.automation);
        showToast({ title: json.automation.status === "paused" ? "Automation paused" : "Automation resumed" });
      }
    } catch (err) {
      showToast({ title: "Error", subtitle: err instanceof Error ? err.message : undefined });
    }
  }

  async function handleDuplicate() {
    if (!workspaceId) return;
    try {
      const res = await fetch(`/api/automations/${automationId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });
      if (!res.ok) throw new Error("Failed to duplicate");
      const json = await res.json();
      showToast({ title: "Duplicated", subtitle: `${json.automation?.name} created as draft` });
      router.push(`/marketing/automations/${json.automation?.id}/edit`);
    } catch (err) {
      showToast({ title: "Error", subtitle: err instanceof Error ? err.message : undefined });
    }
  }

  const filteredSidebarItems = STEP_DEFS.filter((d) =>
    !sidebarSearch || d.label.toLowerCase().includes(sidebarSearch.toLowerCase())
  );

  const sidebarSections = ["action", "logic"] as const;

  const SECTION_LABELS: Record<string, string> = {
    action: "ACTIONS",
    logic: "LOGIC",
  };

  if (loading || wsLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-sm text-text-tertiary">Loading workflow…</div>
      </div>
    );
  }

  if (!automation) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-sm text-text-tertiary">Automation not found.</div>
      </div>
    );
  }

  const isPaused = automation.status === "paused";
  const isActive = automation.status === "active";

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top bar */}
      <AutomationHeader
        automationId={automationId}
        automationName={automation.name}
        automationStatus={automation.status}
        activeTab="Builder"
        onNameSaved={(name) => { setAutomation({ ...automation, name }); setNameInput(name); }}
        onSave={handleSave}
        isSaving={saving}
        hasUnsavedChanges={hasUnsavedChanges}
        autoSaveStatus={autoSaveStatus}
        onPauseResume={handlePauseResume}
        onDuplicate={handleDuplicate}
        onPublished={(a) => setAutomation((prev) => prev ? { ...prev, status: a.status as typeof prev.status } : prev)}
        triggerConfig={automation.trigger_config as TriggerConfig | undefined}
        onSettingsSaved={(updated) => setAutomation((prev) => prev ? { ...prev, trigger_config: { ...(prev.trigger_config ?? {}), ...updated } } : prev)}
      />

      {/* Body: sidebar + canvas + right panel */}
      <div className="flex flex-1 min-h-0">
        {/* Left sidebar */}
        <div className="w-52 shrink-0 border-r border-border overflow-y-auto flex flex-col bg-background-subtle/30">
          <div className="p-3">
            <div className="relative mb-3">
              <RiSearchLine className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-text-tertiary" />
              <input
                type="text"
                placeholder="Search steps…"
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                className="w-full pl-7 pr-2 py-1.5 text-xs border border-border rounded-lg bg-background text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-teal-500/30"
              />
            </div>

            {sidebarSections.map((section) => {
              const items = filteredSidebarItems.filter((d) => d.section === section);
              if (!items.length) return null;
              return (
                <div key={section} className="mb-4">
                  <p className="text-[10px] font-bold tracking-widest text-text-tertiary uppercase mb-1.5 px-1">
                    {SECTION_LABELS[section]}
                  </p>
                  <div className="space-y-1">
                    {items.map((def) => {
                      const Icon = def.icon;
                      return (
                        <div
                          key={def.type}
                          draggable
                          onClick={() => addStep(def.type)}
                          onDragStart={(e) => {
                            e.dataTransfer.setData("step-type", def.type);
                            e.dataTransfer.effectAllowed = "copy";
                            setDragType(def.type);
                          }}
                          onDragEnd={() => setDragType(null)}
                          className={cn(
                            "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors group select-none",
                            "hover:bg-background-subtle cursor-grab active:cursor-grabbing",
                            dragType === def.type && "opacity-50",
                          )}
                        >
                          <div className={cn("size-6 rounded-md flex items-center justify-center shrink-0", def.bgColor)}>
                            <Icon className={cn("size-3.5", def.color)} />
                          </div>
                          <span className="text-xs font-medium text-text-secondary group-hover:text-text-primary">{def.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center canvas */}
        <div
          className="flex-1 overflow-auto bg-[radial-gradient(ellipse_at_center,_#e5e7eb_1px,_transparent_1px)] bg-[size:20px_20px]"
          // Prevent drop on the canvas background itself (only drop zones accept)
          onDragOver={(e) => e.preventDefault()}
        >
          <div className="flex flex-col items-center py-10 min-h-full">
            {/* Trigger node */}
            <div className="w-full max-w-[340px]">
              <button
                onClick={() => { setTriggerSelected(true); setSelectedStepId(null); }}
                className={cn(
                  "w-full rounded-xl border-2 p-3 text-left transition-all",
                  triggerSelected
                    ? "border-teal-500 bg-gray-800 ring-2 ring-teal-500/30"
                    : "border-gray-700 bg-gray-800 hover:border-gray-500",
                )}
                style={{ cursor: "pointer" }}
              >
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-lg bg-gray-600 flex items-center justify-center shrink-0">
                    <RiCheckLine className="size-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">Trigger</p>
                    <p className="text-xs text-gray-400 truncate">
                      {automation.trigger_config?.list_name
                        ? `List: ${automation.trigger_config.list_name}`
                        : automation.trigger_type
                          ? automation.trigger_type.replace(/_/g, " ")
                          : "Click to configure"}
                    </p>
                  </div>
                </div>
              </button>
            </div>

            {/* Drop zone: before all steps (insert at index 0) */}
            <DropZone
              onClickAdd={() => addStep("send_email", -1)}
              onDrop={() => dropStep(-1)}
              isDragging={!!dragType}
              isEmpty={steps.length === 0}
              isLast={steps.length === 0}
            />

            {/* Step nodes interleaved with drop zones */}
            {steps.map((step, i) => (
              <React.Fragment key={step.id}>
                <div className={cn(
                  "w-full max-w-[340px]",
                  newStepId === step.id ? "animate-step-enter" : "",
                )}>
                  <StepNode
                    step={step}
                    selected={selectedStepId === step.id}
                    onSelect={() => setSelectedStepId(selectedStepId === step.id ? null : step.id)}
                    onDelete={() => deleteStep(step.id)}
                    isLast={i === steps.length - 1}
                    isFirst={i === 0}
                    onMoveUp={() => moveStep(i, "up")}
                    onMoveDown={() => moveStep(i, "down")}
                    isNew={newStepId === step.id}
                  />
                </div>
                {/* Drop zone after each step */}
                <DropZone
                  onClickAdd={() => addStep("send_email", i)}
                  onDrop={() => dropStep(i)}
                  isDragging={!!dragType}
                  isLast={i === steps.length - 1}
                />
              </React.Fragment>
            ))}

            {/* Bottom padding */}
            <div className="h-24" />
          </div>
        </div>

        {/* Right panel — step editor OR trigger panel */}
        {(selectedStep || triggerSelected) && (
          <div className="w-64 shrink-0 border-l border-border bg-background overflow-y-auto">
            {triggerSelected ? (
              <TriggerPanel
                triggerConfig={(automation.trigger_config ?? {}) as TriggerConfig}
                onClose={() => setTriggerSelected(false)}
                onChange={updateTriggerConfig}
              />
            ) : selectedStep ? (
              <StepEditor
                step={selectedStep}
                onChange={updateStep}
                onClose={() => setSelectedStepId(null)}
                workspaceId={workspaceId}
              />
            ) : null}
          </div>
        )}
      </div>

    </div>
  );
}
