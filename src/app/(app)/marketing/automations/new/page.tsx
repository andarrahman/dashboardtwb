"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RiArrowLeftLine,
  RiEditLine,
  RiCheckLine,
  RiListCheck2,
  RiFileTextLine,
  RiCalendarLine,
  RiUserUnfollowLine,
  RiCodeLine,
  RiMegaphoneLine,
  RiSearchLine,
  RiGitBranchLine,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AutomationTriggerType } from "@/lib/supabase/types";
import { AUTOMATION_TEMPLATES } from "@/lib/automation-templates";

// ─── Trigger definitions ───────────────────────────────────────────────────────

interface TriggerDef {
  type: AutomationTriggerType;
  icon: React.ElementType;
  title: string;
  description: string;
  badge?: string;
  category: string[];
  usedBy: number;
}

const TRIGGERS: TriggerDef[] = [
  {
    type: "list_subscription",
    icon: RiListCheck2,
    title: "A contact is added to a list",
    description: "Trigger when a contact is added to a specific list or segment.",
    badge: "RECOMMENDED",
    category: ["all", "contact"],
    usedBy: 3,
  },
  {
    type: "form_submitted",
    icon: RiFileTextLine,
    title: "A form is submitted",
    description: "Trigger when a contact fills out a form or landing page.",
    category: ["all", "forms"],
    usedBy: 1,
  },
  {
    type: "date_time",
    icon: RiCalendarLine,
    title: "Specific date & time",
    description: "Send a one-time broadcast on a scheduled date and time.",
    category: ["all", "datetime"],
    usedBy: 0,
  },
  {
    type: "twibbonize_campaign",
    icon: RiMegaphoneLine,
    title: "Twibbonize campaign created",
    description: "Trigger when a contact creates or joins a Twibbonize campaign.",
    category: ["all", "twibbonize"],
    usedBy: 2,
  },
  {
    type: "contact_inactive",
    icon: RiUserUnfollowLine,
    title: "Contact has been inactive",
    description: "Re-engage contacts who haven't opened or clicked in N days.",
    category: ["all", "contact"],
    usedBy: 1,
  },
  {
    type: "custom_event",
    icon: RiCodeLine,
    title: "Custom event via API",
    description: "Fire a trigger from your app via the automation webhook endpoint.",
    badge: "DEVELOPER",
    category: ["all", "api"],
    usedBy: 0,
  },
];

const FILTER_TABS = [
  { key: "all", label: "All triggers", count: 6 },
  { key: "contact", label: "Contact activity", count: 2 },
  { key: "forms", label: "Forms & pages", count: 1 },
  { key: "datetime", label: "Date & time", count: 1 },
  { key: "twibbonize", label: "Twibbonize events", count: 1 },
  { key: "api", label: "API / Webhook", count: 1 },
];

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function NewAutomationPage() {
  const router = useRouter();
  const [name, setName] = React.useState("Untitled workflow");
  const [editingName, setEditingName] = React.useState(false);
  const [nameInput, setNameInput] = React.useState("Untitled workflow");
  const [selectedTrigger, setSelectedTrigger] = React.useState<AutomationTriggerType | null>(null);
  const [filterTab, setFilterTab] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const nameRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editingName) nameRef.current?.focus();
  }, [editingName]);

  // Persist to localStorage so configure page can pick it up
  React.useEffect(() => {
    const draft = { name, trigger_type: selectedTrigger };
    localStorage.setItem("automation_draft", JSON.stringify(draft));
  }, [name, selectedTrigger]);

  function commitName() {
    if (nameInput.trim()) setName(nameInput.trim());
    setEditingName(false);
  }

  const filteredTriggers = TRIGGERS.filter((t) => {
    const matchesCategory = t.category.includes(filterTab);
    const matchesSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  function handleContinue() {
    if (!selectedTrigger) return;
    router.push(`/marketing/automations/new/configure?trigger=${selectedTrigger}&name=${encodeURIComponent(name)}`);
  }

  return (
    <div className="flex flex-col h-full min-h-screen bg-background">
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingInline: 20, paddingBlock: 12, borderBottom: "1px solid #DEE8E8", fontFamily: '"Manrope", system-ui, sans-serif' }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Link href="/marketing/automations" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#4A5C66", textDecoration: "none" }}>
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
              style={{ fontSize: 13, fontWeight: 600, color: "#0F2A37", background: "transparent", borderBottom: "1px solid #14C4AE", outline: "none", padding: "2px 0", minWidth: 200, ...({ fontFamily: '"Manrope", system-ui, sans-serif' }) }}
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

        {/* Step progress */}
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
            disabled={!selectedTrigger}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: selectedTrigger ? "#16DAC1" : "#B0E8E1", border: "none", borderRadius: 999,
              paddingBlock: 8, paddingInline: 16, cursor: selectedTrigger ? "pointer" : "not-allowed",
              boxShadow: selectedTrigger ? "#14C4AE47 0px 6px 14px" : "none",
              fontSize: 13, fontWeight: 700, color: "#FFFFFF",
            }}
          >
            Continue
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-6 py-10">
          <p className="text-xs font-semibold tracking-widest text-text-tertiary uppercase mb-2">
            Step 1 of 3
          </p>
          <h2 className="text-2xl font-semibold text-text-primary mb-1">Choose a trigger to start the workflow</h2>
          <p className="text-sm text-text-secondary mb-8">
            The trigger is the event that enrolls a contact into this automation.
          </p>

          {/* Search */}
          <div className="relative mb-4">
            <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search triggers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-background text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-teal-500/30"
            />
          </div>

          {/* Filter tabs */}
          <div style={{ display: "inline-flex", background: "#F0F7F7", borderRadius: 999, padding: 4, gap: 4, marginBottom: 24, flexWrap: "wrap", fontFamily: '"Manrope", system-ui, sans-serif' }}>
            {FILTER_TABS.map((tab) => {
              const isActive = filterTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setFilterTab(tab.key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    borderRadius: 999, paddingBlock: 8, paddingInline: 14,
                    border: "none", cursor: "pointer",
                    background: isActive ? "#FFFFFF" : "transparent",
                    boxShadow: isActive ? "#00000014 0px 4px 16px" : "none",
                    fontSize: 13, fontWeight: isActive ? 700 : 500,
                    color: isActive ? "#1B1B1B" : "#5F5F5F",
                  }}
                >
                  {tab.label}
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#8D8D8D" }}>{tab.count}</span>
                </button>
              );
            })}
          </div>

          {/* Trigger cards grid */}
          <div className="grid grid-cols-2 gap-3">
            {filteredTriggers.map((trigger) => {
              const Icon = trigger.icon;
              const isSelected = selectedTrigger === trigger.type;
              return (
                <button
                  key={trigger.type}
                  onClick={() => setSelectedTrigger(trigger.type)}
                  className={cn(
                    "relative text-left p-4 rounded-xl border-2 transition-all",
                    isSelected
                      ? "border-teal-500 bg-teal-50/50"
                      : "border-border bg-background hover:border-teal-200 hover:bg-background-subtle"
                  )}
                >
                  {/* Selected checkmark */}
                  {isSelected && (
                    <div className="absolute top-3 right-3 size-5 rounded-full bg-teal-500 flex items-center justify-center">
                      <RiCheckLine className="size-3 text-white" />
                    </div>
                  )}

                  {/* Badge */}
                  {trigger.badge && (
                    <span className={cn(
                      "inline-block text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded mb-2",
                      trigger.badge === "RECOMMENDED"
                        ? "bg-teal-100 text-teal-700"
                        : "bg-violet-100 text-violet-700"
                    )}>
                      {trigger.badge}
                    </span>
                  )}

                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "size-9 rounded-lg flex items-center justify-center shrink-0",
                      isSelected ? "bg-teal-100" : "bg-background-subtle"
                    )}>
                      <Icon className={cn("size-4.5", isSelected ? "text-teal-600" : "text-text-secondary")} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-primary leading-snug">{trigger.title}</p>
                      <p className="text-xs text-text-tertiary mt-0.5 leading-relaxed">{trigger.description}</p>
                      <p className="text-xs text-text-tertiary mt-2">
                        Used by <span className="font-medium">{trigger.usedBy}</span> active automation{trigger.usedBy !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {filteredTriggers.length === 0 && (
            <div className="text-center py-12 text-text-tertiary text-sm">
              No triggers match your search.
            </div>
          )}

          {/* Pre-built templates */}
          <div className="mt-10 pt-8 border-t border-border">
            <div className="flex items-center gap-2 mb-2">
              <RiGitBranchLine className="size-4 text-text-tertiary" />
              <h3 className="text-sm font-semibold text-text-primary">Start from a template</h3>
            </div>
            <p className="text-sm text-text-secondary mb-5">
              Pre-built workflows you can customise. Selecting a template will also set the trigger.
            </p>
            <div className="grid grid-cols-3 gap-3">
              {AUTOMATION_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() =>
                    router.push(
                      `/marketing/automations/new/configure?trigger=${tpl.trigger_type}&name=${encodeURIComponent(tpl.name)}&template=${tpl.id}`
                    )
                  }
                  className="text-left p-4 rounded-xl border border-border bg-background hover:border-teal-300 hover:bg-teal-50/30 transition-all"
                >
                  <div className="text-2xl mb-2">{tpl.icon}</div>
                  <p className="text-sm font-semibold text-text-primary">{tpl.name}</p>
                  <p className="text-xs text-text-tertiary mt-1">{tpl.description}</p>
                  <p className="text-xs text-text-tertiary mt-2">
                    {tpl.steps.length} steps &middot; {tpl.trigger_type.replace(/_/g, " ")}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
