"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  RiArrowLeftLine,
  RiEditLine,
  RiArrowRightLine,
  RiListCheck2,
  RiFileTextLine,
  RiCalendarLine,
  RiUserUnfollowLine,
  RiCodeLine,
  RiMegaphoneLine,
  RiAddLine,
  RiDeleteBin2Line,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { createClient } from "@/lib/supabase/browser";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/select";
import type { AutomationTriggerType, AutomationTriggerConfig } from "@/lib/supabase/types";

interface CrmList { id: string; name: string; contact_count: number }

const TRIGGER_ICONS: Record<AutomationTriggerType, React.ElementType> = {
  list_subscription: RiListCheck2,
  form_submitted: RiFileTextLine,
  date_time: RiCalendarLine,
  contact_inactive: RiUserUnfollowLine,
  custom_event: RiCodeLine,
  twibbonize_campaign: RiMegaphoneLine,
};

const TRIGGER_TITLES: Record<AutomationTriggerType, string> = {
  list_subscription: "A contact is added to a list",
  form_submitted: "A form is submitted",
  date_time: "Specific date & time",
  contact_inactive: "Contact has been inactive",
  custom_event: "Custom event via API",
  twibbonize_campaign: "Twibbonize campaign created",
};

export default function ConfigureTriggerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { workspaceId, loading: wsLoading } = useWorkspace();
  const { showToast } = useToast();

  const triggerType = (searchParams.get("trigger") ?? "list_subscription") as AutomationTriggerType;
  const nameParam = searchParams.get("name") ?? "Untitled workflow";

  const [name, setName] = React.useState(nameParam);
  const [editingName, setEditingName] = React.useState(false);
  const [nameInput, setNameInput] = React.useState(nameParam);
  const nameRef = React.useRef<HTMLInputElement>(null);

  // Config state
  const [listId, setListId] = React.useState("");
  const [listName, setListName] = React.useState("");
  const [enrollExisting, setEnrollExisting] = React.useState(false);
  const [reEnroll, setReEnroll] = React.useState<"never" | "once_per_90d" | "always">("never");
  const [filters, setFilters] = React.useState<Array<{ field: string; operator: string; value: string }>>([]);
  const [inactiveDays, setInactiveDays] = React.useState(30);
  const [scheduledAt, setScheduledAt] = React.useState("");
  const [eventName, setEventName] = React.useState("");

  // Exit conditions
  const [exitOnReply, setExitOnReply] = React.useState(false);
  const [exitOnGoal, setExitOnGoal] = React.useState(false);
  const [exitOnListRemoval, setExitOnListRemoval] = React.useState(false);

  // Send time settings
  const [sendWindowEnabled, setSendWindowEnabled] = React.useState(false);
  const [sendWindowStart, setSendWindowStart] = React.useState("09:00");
  const [sendWindowEnd, setSendWindowEnd] = React.useState("17:00");
  const [sendWindowTimezone, setSendWindowTimezone] = React.useState("UTC");
  const [skipWeekends, setSkipWeekends] = React.useState(false);

  // CRM lists
  const [lists, setLists] = React.useState<CrmList[]>([]);
  const [creating, setCreating] = React.useState(false);

  React.useEffect(() => {
    if (editingName) nameRef.current?.focus();
  }, [editingName]);

  React.useEffect(() => {
    if (!workspaceId) return;
    const supabase = createClient();
    (supabase as any)
      .from("crm_lists")
      .select("id, name, contact_count")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("name")
      .limit(100)
      .then(({ data }: { data: CrmList[] | null }) => {
        if (data) setLists(data);
      });
  }, [workspaceId]);

  function commitName() {
    if (nameInput.trim()) setName(nameInput.trim());
    setEditingName(false);
  }

  async function handleContinue() {
    if (!workspaceId) return;
    setCreating(true);
    try {
      const config: AutomationTriggerConfig & {
        exit_conditions?: { exit_on_reply: boolean; exit_on_goal: boolean; exit_on_list_removal: boolean };
        send_window?: { enabled: boolean; start: string; end: string; timezone: string; skip_weekends: boolean };
      } = {};
      if (triggerType === "list_subscription") {
        config.list_id = listId || undefined;
        config.list_name = listName || undefined;
        config.enroll_existing = enrollExisting;
        config.re_enroll = reEnroll;
        if (filters.length > 0) config.filters = filters;
      } else if (triggerType === "contact_inactive") {
        config.inactive_days = inactiveDays;
      } else if (triggerType === "date_time") {
        config.scheduled_at = scheduledAt;
      } else if (triggerType === "custom_event") {
        config.event_name = eventName;
      }

      // Exit conditions
      config.exit_conditions = {
        exit_on_reply: exitOnReply,
        exit_on_goal: exitOnGoal,
        exit_on_list_removal: exitOnListRemoval,
      };

      // Send time settings
      config.send_window = {
        enabled: sendWindowEnabled,
        start: sendWindowStart,
        end: sendWindowEnd,
        timezone: sendWindowTimezone,
        skip_weekends: skipWeekends,
      };

      // Template pre-population
      const templateParam = searchParams.get("template");
      let preSteps: object[] = [];
      if (templateParam) {
        const { AUTOMATION_TEMPLATES } = await import("@/lib/automation-templates");
        const tpl = AUTOMATION_TEMPLATES.find((t) => t.id === templateParam);
        if (tpl) preSteps = tpl.steps;
      }

      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          name,
          trigger_type: triggerType,
          trigger_config: config,
          steps: preSteps,
        }),
      });

      if (!res.ok) throw new Error("Failed to create automation");
      const json = await res.json();
      const id = json.automation?.id;
      if (id) {
        // Clear localStorage draft
        localStorage.removeItem("automation_draft");
        router.push(`/marketing/automations/${id}/edit`);
      }
    } catch (err) {
      showToast({ title: "Error", subtitle: err instanceof Error ? err.message : undefined });
    } finally {
      setCreating(false);
    }
  }

  const Icon = TRIGGER_ICONS[triggerType] ?? RiListCheck2;
  const triggerTitle = TRIGGER_TITLES[triggerType] ?? triggerType;

  const selectedList = lists.find((l) => l.id === listId);
  const estimatedPerDay = selectedList
    ? Math.round(selectedList.contact_count / 30)
    : null;

  return (
    <div className="flex flex-col h-full min-h-screen bg-background">
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingInline: 20, paddingBlock: 12, borderBottom: "1px solid #DEE8E8", fontFamily: '"Manrope", system-ui, sans-serif' }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Link href="/marketing/automations/new" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#4A5C66", textDecoration: "none" }}>
            <RiArrowLeftLine className="size-4" />
            Back to automations
          </Link>
          <span style={{ width: 1, height: 16, background: "#DEE8E8", display: "inline-block" }} />
          {editingName ? (
            <input
              ref={nameRef}
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => { if (e.key === "Enter") commitName(); if (e.key === "Escape") setEditingName(false); }}
              style={{ fontSize: 13, fontWeight: 600, color: "#0F2A37", background: "transparent", borderBottom: "1px solid #14C4AE", outline: "none", padding: "2px 0", minWidth: 200, fontFamily: '"Manrope", system-ui, sans-serif' }}
            />
          ) : (
            <button
              onClick={() => { setNameInput(name); setEditingName(true); }}
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#0F2A37", background: "none", border: "none", cursor: "pointer" }}
            >
              {name}
              <RiEditLine style={{ width: 13, height: 13, color: "#7A8A93" }} />
            </button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 500 }}>
          <span style={{ color: "#0F2A37", background: "#16DAC11F", paddingBlock: 4, paddingInline: 10, borderRadius: 999, fontWeight: 700 }}>1 Choose trigger</span>
          <span style={{ color: "#DEE8E8" }}>—</span>
          <span style={{ color: "#7A8A93", paddingBlock: 4, paddingInline: 10 }}>2 Build workflow</span>
          <span style={{ color: "#DEE8E8" }}>—</span>
          <span style={{ color: "#7A8A93", paddingBlock: 4, paddingInline: 10 }}>3 Review &amp; publish</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => router.push("/marketing/automations")}
            style={{
              display: "flex", alignItems: "center",
              background: "#FFFFFF", border: "1px solid #DEE8E8", borderRadius: 999,
              paddingBlock: 8, paddingInline: 16, cursor: "pointer",
              fontSize: 13, fontWeight: 600, color: "#1B1B1B",
            }}
          >
            Save draft
          </button>
          <button
            onClick={handleContinue}
            disabled={creating || wsLoading}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: creating || wsLoading ? "#B0E8E1" : "#16DAC1", border: "none", borderRadius: 999,
              paddingBlock: 8, paddingInline: 16, cursor: creating || wsLoading ? "not-allowed" : "pointer",
              boxShadow: "#14C4AE47 0px 6px 14px",
              fontSize: 13, fontWeight: 700, color: "#FFFFFF",
            }}
          >
            {creating ? "Creating…" : "Continue to builder"}
            {!creating && <RiArrowRightLine style={{ width: 14, height: 14 }} />}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto px-6 py-10">
          <p className="text-xs font-semibold tracking-widest text-text-tertiary uppercase mb-2">Step 1 of 3</p>
          <h2 className="text-2xl font-semibold text-text-primary mb-1">Configure your trigger</h2>
          <p className="text-sm text-text-secondary mb-8">Set up the conditions that enroll contacts into this workflow.</p>

          {/* Selected trigger summary */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-teal-200 bg-teal-50/40 mb-8">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-teal-100 flex items-center justify-center">
                <Icon className="size-4.5 text-teal-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">{triggerTitle}</p>
                <p className="text-xs text-text-tertiary">Selected trigger</p>
              </div>
            </div>
            <Link
              href="/marketing/automations/new"
              className="text-xs font-medium text-teal-600 hover:text-teal-700 underline"
            >
              Change trigger
            </Link>
          </div>

          {/* Trigger-specific config */}
          {triggerType === "list_subscription" && (
            <div className="space-y-6">
              {/* Which list */}
              <div>
                <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wide block mb-2">
                  Which list?
                </label>
                <Select
                  value={listId}
                  onChange={(val) => {
                    const l = lists.find((x) => x.id === val);
                    setListId(val);
                    setListName(l?.name ?? "");
                  }}
                  placeholder="Select a list…"
                  options={lists.map((l) => ({
                    value: l.id,
                    label: `${l.name} (${l.contact_count} contacts)`,
                  }))}
                />
              </div>

              {/* Who should enter */}
              <div>
                <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wide block mb-2">
                  Who should enter?
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={!enrollExisting}
                      onChange={() => setEnrollExisting(false)}
                      className="accent-teal-500"
                    />
                    <span className="text-sm text-text-primary">
                      Only new contacts <span className="text-xs text-teal-600 ml-1">Recommended</span>
                    </span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={enrollExisting}
                      onChange={() => setEnrollExisting(true)}
                      className="accent-teal-500"
                    />
                    <span className="text-sm text-text-primary">All existing + new contacts</span>
                  </label>
                </div>
              </div>

              {/* Re-enroll */}
              <div>
                <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wide block mb-2">
                  If a contact re-enters the list
                </label>
                <div className="flex rounded-lg border border-border overflow-hidden text-sm">
                  {(["never", "once_per_90d", "always"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setReEnroll(v)}
                      className={cn(
                        "flex-1 px-3 py-2 font-medium transition-colors border-r border-border last:border-r-0",
                        reEnroll === v
                          ? "bg-teal-500 text-white"
                          : "bg-background text-text-secondary hover:bg-background-subtle"
                      )}
                    >
                      {v === "never" ? "Don't re-enroll" : v === "once_per_90d" ? "Once per 90 days" : "Re-enroll every time"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filters */}
              <div>
                <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wide block mb-2">
                  Additional filter <span className="text-text-tertiary font-normal normal-case">(optional)</span>
                </label>
                {filters.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2">
                    <input
                      className="flex-1 border border-border rounded-lg px-3 py-1.5 text-sm bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                      placeholder="Field (e.g. country)"
                      value={f.field}
                      onChange={(e) => {
                        const updated = [...filters];
                        updated[i] = { ...f, field: e.target.value };
                        setFilters(updated);
                      }}
                    />
                    <Select
                      value={f.operator}
                      onChange={(val) => {
                        const updated = [...filters];
                        updated[i] = { ...f, operator: val };
                        setFilters(updated);
                      }}
                      options={[
                        { value: "equals", label: "equals" },
                        { value: "contains", label: "contains" },
                        { value: "not_equals", label: "not equals" },
                      ]}
                      className="w-36"
                    />
                    <input
                      className="flex-1 border border-border rounded-lg px-3 py-1.5 text-sm bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                      placeholder="Value"
                      value={f.value}
                      onChange={(e) => {
                        const updated = [...filters];
                        updated[i] = { ...f, value: e.target.value };
                        setFilters(updated);
                      }}
                    />
                    <button
                      onClick={() => setFilters(filters.filter((_, j) => j !== i))}
                      className="p-1.5 text-text-tertiary hover:text-red-500 transition-colors"
                    >
                      <RiDeleteBin2Line className="size-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setFilters([...filters, { field: "", operator: "equals", value: "" }])}
                  className="flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700 font-medium"
                >
                  <RiAddLine className="size-4" />
                  Add condition
                </button>
              </div>

              {/* Preview */}
              {estimatedPerDay != null && (
                <div className="p-4 rounded-xl bg-background-subtle border border-border text-sm text-text-secondary">
                  <span className="font-semibold text-text-primary">~{estimatedPerDay} contacts/day</span> will enter this workflow based on your list size.
                </div>
              )}
            </div>
          )}

          {triggerType === "contact_inactive" && (
            <div>
              <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wide block mb-2">
                Days of inactivity
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={inactiveDays}
                  onChange={(e) => setInactiveDays(Number(e.target.value))}
                  className="w-24 border border-border rounded-lg px-3 py-2 text-sm bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                />
                <span className="text-sm text-text-secondary">days without opening or clicking any email</span>
              </div>
            </div>
          )}

          {triggerType === "date_time" && (
            <div>
              <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wide block mb-2">
                Schedule date & time
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              />
            </div>
          )}

          {triggerType === "custom_event" && (
            <div>
              <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wide block mb-2">
                Event name
              </label>
              <input
                type="text"
                placeholder="e.g. user.signup"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              />
              <p className="text-xs text-text-tertiary mt-1.5">
                Send this event name in your API webhook payload to trigger the automation.
              </p>
            </div>
          )}

          {(triggerType === "form_submitted" || triggerType === "twibbonize_campaign") && (
            <div className="p-4 rounded-xl bg-background-subtle border border-border text-sm text-text-secondary">
              This trigger will fire automatically when the specified event occurs. No additional configuration is required.
            </div>
          )}

          {/* Exit Conditions */}
          <div className="mt-10 pt-8 border-t border-border">
            <h3 className="text-base font-semibold text-text-primary mb-1">Exit conditions</h3>
            <p className="text-sm text-text-secondary mb-4">Define when a contact should exit this automation early.</p>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exitOnReply}
                  onChange={(e) => setExitOnReply(e.target.checked)}
                  className="size-4 accent-teal-500"
                />
                <div>
                  <span className="text-sm font-medium text-text-primary">Exit if contact replies to any email</span>
                  <p className="text-xs text-text-tertiary">Removes contact when a reply is detected</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exitOnGoal}
                  onChange={(e) => setExitOnGoal(e.target.checked)}
                  className="size-4 accent-teal-500"
                />
                <div>
                  <span className="text-sm font-medium text-text-primary">Exit if goal is achieved</span>
                  <p className="text-xs text-text-tertiary">Exit when the contact clicks a goal link</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exitOnListRemoval}
                  onChange={(e) => setExitOnListRemoval(e.target.checked)}
                  className="size-4 accent-teal-500"
                />
                <div>
                  <span className="text-sm font-medium text-text-primary">Exit if removed from trigger list</span>
                  <p className="text-xs text-text-tertiary">Only applies to list-based triggers</p>
                </div>
              </label>
            </div>
          </div>

          {/* Send Time Settings */}
          <div className="mt-8 pt-8 border-t border-border">
            <h3 className="text-base font-semibold text-text-primary mb-1">Send time settings</h3>
            <p className="text-sm text-text-secondary mb-4">Restrict when emails are sent to contacts.</p>

            <label className="flex items-center gap-3 cursor-pointer mb-4">
              <input
                type="checkbox"
                checked={sendWindowEnabled}
                onChange={(e) => setSendWindowEnabled(e.target.checked)}
                className="size-4 accent-teal-500"
              />
              <span className="text-sm font-medium text-text-primary">Enable send time window</span>
            </label>

            {sendWindowEnabled && (
              <div className="space-y-4 pl-7">
                <div className="flex items-center gap-4 flex-wrap">
                  <div>
                    <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wide block mb-1.5">Start time</label>
                    <input
                      type="time"
                      value={sendWindowStart}
                      onChange={(e) => setSendWindowStart(e.target.value)}
                      className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wide block mb-1.5">End time</label>
                    <input
                      type="time"
                      value={sendWindowEnd}
                      onChange={(e) => setSendWindowEnd(e.target.value)}
                      className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-text-tertiary uppercase tracking-wide block mb-1.5">Timezone</label>
                    <Select
                      value={sendWindowTimezone}
                      onChange={setSendWindowTimezone}
                      options={[
                        { value: "UTC", label: "UTC" },
                        { value: "America/New_York", label: "US Eastern" },
                        { value: "America/Chicago", label: "US Central" },
                        { value: "America/Denver", label: "US Mountain" },
                        { value: "America/Los_Angeles", label: "US Pacific" },
                        { value: "Europe/London", label: "London" },
                        { value: "Europe/Paris", label: "Paris / Berlin" },
                        { value: "Asia/Singapore", label: "Singapore" },
                        { value: "Asia/Jakarta", label: "Jakarta (WIB)" },
                        { value: "Asia/Kuala_Lumpur", label: "Kuala Lumpur" },
                        { value: "Asia/Tokyo", label: "Tokyo" },
                      ]}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skipWeekends}
                    onChange={(e) => setSkipWeekends(e.target.checked)}
                    className="size-4 accent-teal-500"
                  />
                  <span className="text-sm font-medium text-text-primary">Skip weekends</span>
                </label>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
