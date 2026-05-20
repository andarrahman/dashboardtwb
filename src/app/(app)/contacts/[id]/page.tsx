"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  RiArrowLeftLine,
  RiMailLine,
  RiMailSendLine,
  RiWhatsappLine,
  RiLinkedinBoxLine,
  RiInstagramLine,
  RiChat3Line,
  RiCalendarLine,
  RiQuillPenLine,
  RiEdit2Line,
  RiDeleteBin2Line,
  RiCheckboxCircleFill,
  RiSortDesc,
  RiGlobalLine,
  RiErrorWarningLine,
  RiTimeLine,
  RiArrowDownSLine,
  RiSearchEyeLine,
  RiFileTextLine,
  RiSkipForwardLine,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { getContact, softDeleteContact } from "@/lib/queries/contacts";
import { DeleteContactDialog } from "@/components/contacts/delete-contact-dialog";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { createClient } from "@/lib/supabase/browser";
import type { ContactRow, AccountTier } from "@/lib/supabase/types";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

const tones = [
  "bg-turquoise-100 text-turquoise-700",
  "bg-amber-100 text-amber-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
];

function tone(name: string) {
  return tones[name.charCodeAt(0) % 5];
}

const countryNames: Record<string, string> = {
  ID: "Indonesia 🇮🇩", MY: "Malaysia 🇲🇾", SG: "Singapore 🇸🇬",
  PH: "Philippines 🇵🇭", VN: "Vietnam 🇻🇳", TH: "Thailand 🇹🇭",
  US: "United States 🇺🇸", GB: "United Kingdom 🇬🇧",
};

function fmt(iso: string | null, opts?: Intl.DateTimeFormatOptions) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", opts ?? {
    day: "numeric", month: "short", year: "numeric",
  });
}

function relativeDate(iso: string | null) {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function timeAgoLocal(iso: string | null): string {
  if (!iso) return "—";
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 86400 * 7) return `${Math.floor(secs / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function fmtEmailDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function TierBadge({ tier }: { tier: AccountTier | null }) {
  if (!tier) return null;
  const map: Record<AccountTier, { label: string; variant: "accent" | "neutral" }> = {
    premium_creator:   { label: "★ Premium Creator",   variant: "accent" },
    premium_supporter: { label: "Premium Supporter", variant: "neutral" },
    free:              { label: "Free",               variant: "neutral" },
  };
  const { label, variant } = map[tier];
  return <Badge variant={variant} size="md">{label}</Badge>;
}

// ─── Activity types ────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  outreach:       "Outreach",
  contacted:      "Contacted",
  scheduled:      "Scheduled",
  waiting_result: "Waiting Result",
  qualified:      "Qualified",
  nurture:        "Nurture",
  not_qualified:  "Not Qualified",
  skipped:        "Skipped",
};

const RESULT_LABELS_MAP: Record<string, string> = {
  qualified:     "Qualified",
  nurture:       "Nurture",
  not_qualified: "Not Qualified",
  pending:       "Pending",
};

interface EmailDetail {
  fromName: string;
  fromEmail: string;
  toEmail: string;
  direction: "inbound" | "outbound";
  bodyPreview: string | null;
  fullDate: string;
}

interface ActivityItem {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ElementType<any>;
  iconBg: string;
  iconColor: string;
  title: string;
  sub: string;
  time: string;
  sortKey: string;
  itemType: "email" | "call" | "automation";
  detail?: EmailDetail;
}

interface AutomationLogItem {
  id: string;
  event_type: string;
  event_label: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  automation_id: string;
}

interface EmailLog {
  id: string;
  from_email: string;
  from_name: string | null;
  to_email: string | null;
  subject: string | null;
  received_at: string;
  direction: string | null;
  body_preview: string | null;
}

interface OutreachCall {
  id: string;
  stage: string;
  lead_source: string;
  result: string;
  next_action: string;
  replied_at: string;
  interview_date: string | null;
  interview_time: string | null;
  interview_timezone: string | null;
  reschedule_count: number;
  reschedule_reason: string | null;
  survey_status: string;
  skip_reason: string | null;
  skip_note: string | null;
  notes: string | null;
  last_activity_at: string;
  created_at: string;
}

// ── Outreach helpers ──────────────────────────────────────────────────────────

const LEAD_SOURCE_ICONS: Record<string, React.ReactNode> = {
  email:     <RiMailLine size={13} />,
  whatsapp:  <RiWhatsappLine size={13} />,
  linkedin:  <RiLinkedinBoxLine size={13} />,
  instagram: <RiInstagramLine size={13} />,
};

const LEAD_SOURCE_LABELS: Record<string, string> = {
  email: "Email", whatsapp: "WhatsApp", linkedin: "LinkedIn", instagram: "Instagram",
};

const SURVEY_STATUS_LABELS: Record<string, string> = {
  not_sent: "Not sent", sent_pending: "Sent · pending", completed: "Completed", skipped: "Skipped",
};

const SKIP_REASON_LABELS: Record<string, string> = {
  ghosted: "Ghosted", declined: "Declined", out_of_scope: "Out of scope",
  duplicate: "Duplicate", other: "Other",
};

const STAGE_STYLES: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  replied:           { label: "Replied",           dot: "bg-foreground-muted", text: "text-foreground-muted",  bg: "bg-foreground-muted/10" },
  waiting_reschedule:{ label: "Waiting Reschedule",dot: "bg-amber-400",        text: "text-amber-700",         bg: "bg-amber-50" },
  scheduled:         { label: "Scheduled",         dot: "bg-primary",          text: "text-primary",           bg: "bg-primary/8" },
  waiting_result:    { label: "Waiting Result",    dot: "bg-primary",          text: "text-primary",           bg: "bg-primary/8" },
  finished:          { label: "Finished",          dot: "bg-red-400",          text: "text-red-600",           bg: "bg-red-50" },
  skipped:           { label: "Skipped",           dot: "bg-foreground-muted", text: "text-foreground-muted",  bg: "bg-foreground-muted/10" },
};

const RESULT_STYLES: Record<string, { label: string; text: string; bg: string; border: string }> = {
  pending:       { label: "Pending",       text: "text-foreground-muted", bg: "bg-background-subtle", border: "border-border" },
  qualified:     { label: "Qualified",     text: "text-emerald-700",      bg: "bg-emerald-50",        border: "border-emerald-200" },
  nurture:       { label: "Nurture",       text: "text-amber-700",        bg: "bg-amber-50",          border: "border-amber-200" },
  not_qualified: { label: "Not Qualified", text: "text-red-700",          bg: "bg-red-50",            border: "border-red-200" },
};

const TABS = ["Activity", "Outreach", "Notes", "Files", "Partnerships", "Email"];
const FILTERS = ["All", "Outreach", "Automation", "System", "Edits"];

// ─── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <main className="px-12 py-8 max-w-[1760px] mx-auto animate-pulse">
      <div className="h-9 w-40 rounded-full bg-border" />
      <Card className="mt-6 p-8">
        <div className="flex gap-6">
          <div className="size-20 rounded-full bg-border shrink-0" />
          <div className="flex-1 space-y-3">
            <div className="h-8 w-64 rounded bg-border" />
            <div className="h-4 w-96 rounded bg-border" />
            <div className="h-4 w-72 rounded bg-border" />
          </div>
        </div>
      </Card>
    </main>
  );
}

// ─── Activity timeline row ─────────────────────────────────────────────────────

function ActivityRow({
  item,
  isOpen,
  onToggle,
  isLast,
}: {
  item: ActivityItem;
  isOpen: boolean;
  onToggle: () => void;
  isLast: boolean;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Icon = item.icon as React.ElementType<any>;
  const isEmail = item.itemType === "email";

  return (
    <div className="relative flex gap-4">
      {/* Timeline line + icon */}
      <div className="flex flex-col items-center">
        <span
          className={`flex size-9 items-center justify-center rounded-full shrink-0 z-10 ${item.iconBg} ${item.iconColor}`}
        >
          <Icon size={16} />
        </span>
        {!isLast && <span className="w-px flex-1 bg-border mt-1" />}
      </div>

      {/* Content */}
      <div className={`flex-1 min-w-0 pb-5 ${isLast ? "" : ""}`}>
        <div
          className={`rounded-xl border border-border bg-background p-4 transition-colors ${isEmail ? "cursor-pointer hover:bg-background-subtle/60" : ""}`}
          onClick={isEmail ? onToggle : undefined}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">{item.title}</p>
              </div>
              <p className="mt-0.5 text-xs text-foreground-muted truncate">{item.sub}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-foreground-muted whitespace-nowrap">
                {timeAgoLocal(item.time)}
              </span>
              {isEmail && (
                <RiArrowDownSLine
                  size={16}
                  className={`text-foreground-muted transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                />
              )}
            </div>
          </div>

          {/* Expandable email detail */}
          {isEmail && item.detail && (
            <div
              style={{
                display: "grid",
                gridTemplateRows: isOpen ? "1fr" : "0fr",
                transition: "grid-template-rows 0.3s cubic-bezier(0.4,0,0.2,1)",
              }}
            >
              <div className="overflow-hidden">
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="grid grid-cols-[52px_1fr] gap-x-3 gap-y-1 text-xs mb-3">
                    <span className="font-semibold text-foreground-muted pt-0.5">From</span>
                    <span className="text-foreground">
                      {item.detail.fromName
                        ? `${item.detail.fromName} <${item.detail.fromEmail}>`
                        : item.detail.fromEmail}
                    </span>
                    {item.detail.toEmail && (
                      <>
                        <span className="font-semibold text-foreground-muted pt-0.5">To</span>
                        <span className="text-foreground">{item.detail.toEmail}</span>
                      </>
                    )}
                    <span className="font-semibold text-foreground-muted pt-0.5">Date</span>
                    <span className="text-foreground-muted">{item.detail.fullDate}</span>
                  </div>
                  {item.detail.bodyPreview ? (
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap border-t border-border pt-3">
                      {item.detail.bodyPreview}
                    </p>
                  ) : (
                    <p className="text-sm text-foreground-muted italic border-t border-border pt-3">
                      No preview available
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Email tab row ─────────────────────────────────────────────────────────────

function EmailRow({
  email,
  isOpen,
  onToggle,
}: {
  email: EmailLog;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const isInbound = email.direction !== "outbound";

  return (
    <div
      className="rounded-xl border border-border bg-background p-4 cursor-pointer hover:bg-background-subtle/60 transition-colors"
      onClick={onToggle}
    >
      <div className="flex items-start gap-3">
        {/* Direction icon */}
        <span
          className={`flex size-9 items-center justify-center rounded-full shrink-0 ${
            isInbound ? "bg-sky-50 text-sky-600" : "bg-violet-50 text-violet-600"
          }`}
        >
          {isInbound ? <RiMailLine size={16} /> : <RiMailSendLine size={16} />}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{email.subject ?? "(no subject)"}</p>
              <p className="mt-0.5 text-xs text-foreground-muted truncate">
                {isInbound
                  ? `From: ${email.from_name ? `${email.from_name} · ` : ""}${email.from_email}`
                  : `To: ${email.to_email ?? "—"}`}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                  isInbound
                    ? "bg-sky-50 text-sky-600 border border-sky-200"
                    : "bg-violet-50 text-violet-600 border border-violet-200"
                }`}
              >
                {isInbound ? "RECEIVED" : "SENT"}
              </span>
              <span className="text-xs text-foreground-muted whitespace-nowrap">
                {timeAgoLocal(email.received_at)}
              </span>
              <RiArrowDownSLine
                size={16}
                className={`text-foreground-muted transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
              />
            </div>
          </div>

          {/* Expandable detail */}
          <div
            style={{
              display: "grid",
              gridTemplateRows: isOpen ? "1fr" : "0fr",
              transition: "grid-template-rows 0.3s cubic-bezier(0.4,0,0.2,1)",
            }}
          >
            <div className="overflow-hidden">
              <div className="mt-3 pt-3 border-t border-border">
                <div className="grid grid-cols-[52px_1fr] gap-x-3 gap-y-1 text-xs mb-3">
                  <span className="font-semibold text-foreground-muted pt-0.5">From</span>
                  <span className="text-foreground">
                    {email.from_name
                      ? `${email.from_name} <${email.from_email}>`
                      : email.from_email}
                  </span>
                  {email.to_email && (
                    <>
                      <span className="font-semibold text-foreground-muted pt-0.5">To</span>
                      <span className="text-foreground">{email.to_email}</span>
                    </>
                  )}
                  <span className="font-semibold text-foreground-muted pt-0.5">Date</span>
                  <span className="text-foreground-muted">{fmtEmailDate(email.received_at)}</span>
                </div>
                {email.body_preview ? (
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap border-t border-border pt-3">
                    {email.body_preview}
                  </p>
                ) : (
                  <p className="text-sm text-foreground-muted italic border-t border-border pt-3">
                    No preview available
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { workspaceId, loading: wsLoading } = useWorkspace();

  const [contact, setContact] = React.useState<ContactRow | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState("Activity");
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  // Activity + email + outreach state
  const [activityItems, setActivityItems] = React.useState<ActivityItem[]>([]);
  const [emailLogs, setEmailLogs] = React.useState<EmailLog[]>([]);
  const [discoveryCalls, setDiscoveryCalls] = React.useState<OutreachCall[]>([]);
  const [activityLoading, setActivityLoading] = React.useState(false);
  const [openDetailId, setOpenDetailId] = React.useState<string | null>(null);
  const [activityFilter, setActivityFilter] = React.useState("All");
  const [sortDesc, setSortDesc] = React.useState(true);

  async function handleDelete(c: ContactRow) {
    if (!workspaceId) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await softDeleteContact(workspaceId, c.id, user.id);
    setDeleteOpen(false);
    router.push(`/contacts?deleted=true&id=${c.id}&name=${encodeURIComponent(c.name)}&dtype=${c.type}`);
  }

  // Filtered + sorted activity items (must be before early returns — hooks rule)
  const filteredActivity = React.useMemo(() => {
    let items = activityItems;
    if (activityFilter === "Outreach") {
      items = items.filter((i) => i.itemType === "email" || i.itemType === "call");
    } else if (activityFilter === "Automation") {
      items = items.filter((i) => i.itemType === "automation");
    } else if (activityFilter === "System" || activityFilter === "Edits") {
      items = [];
    }
    return sortDesc ? items : [...items].reverse();
  }, [activityItems, activityFilter, sortDesc]);

  // Load contact
  React.useEffect(() => {
    if (!workspaceId || !id) return;
    setLoading(true);
    getContact(workspaceId, id).then(({ data, error }) => {
      if (error) setError(error);
      else setContact(data);
      setLoading(false);
    });
  }, [workspaceId, id]);

  // Load activity + emails
  React.useEffect(() => {
    if (!workspaceId || !id) return;
    setActivityLoading(true);
    const supabase = createClient();

    Promise.all([
      supabase
        .from("discovery_calls")
        .select("id, stage, lead_source, result, next_action, replied_at, interview_date, interview_time, interview_timezone, reschedule_count, reschedule_reason, survey_status, skip_reason, skip_note, notes, last_activity_at, created_at")
        .eq("contact_id", id)
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("contact_email_logs")
        .select("id, from_email, from_name, to_email, subject, received_at, direction, body_preview")
        .eq("contact_id", id)
        .eq("workspace_id", workspaceId)
        .order("received_at", { ascending: false })
        .limit(100),
      (supabase as any)
        .from("automation_logs")
        .select("id, event_type, event_label, description, metadata, created_at, automation_id")
        .eq("contact_id", id)
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]).then(([callsRes, emailsRes, autoLogsRes]: [
      { data: OutreachCall[] | null; error: unknown },
      { data: EmailLog[] | null; error: unknown },
      { data: AutomationLogItem[] | null; error: unknown }
    ]) => {
      const items: ActivityItem[] = [];

      // Discovery calls
      const calls = (callsRes.data ?? []) as OutreachCall[];
      setDiscoveryCalls(calls);
      for (const call of calls) {
        const stageLabel = STAGE_STYLES[call.stage]?.label ?? call.stage;
        const resultLabel = call.result !== "pending"
          ? `Result: ${RESULT_STYLES[call.result]?.label ?? call.result}`
          : "Awaiting result";
        const timeKey = call.interview_date ?? call.last_activity_at ?? call.created_at;
        items.push({
          id: `call-${call.id}`,
          icon: RiSearchEyeLine,
          iconBg: "bg-emerald-50",
          iconColor: "text-emerald-600",
          title: `Discovery call · ${stageLabel}`,
          sub: resultLabel,
          time: timeKey,
          sortKey: timeKey,
          itemType: "call",
        });
      }

      // Emails
      const emails = (emailsRes.data ?? []) as EmailLog[];
      const rawEmails: EmailLog[] = [];
      for (const email of emails) {
        rawEmails.push(email);
        const isInbound = email.direction !== "outbound";
        items.push({
          id: `email-${email.id}`,
          icon: isInbound ? RiMailLine : RiMailSendLine,
          iconBg: isInbound ? "bg-sky-50" : "bg-violet-50",
          iconColor: isInbound ? "text-sky-600" : "text-violet-600",
          title: isInbound ? "Email received" : "Email sent",
          sub: email.subject ?? "(no subject)",
          time: email.received_at,
          sortKey: email.received_at,
          itemType: "email",
          detail: {
            fromName: email.from_name ?? "",
            fromEmail: email.from_email,
            toEmail: email.to_email ?? "",
            direction: email.direction === "outbound" ? "outbound" : "inbound",
            bodyPreview: email.body_preview,
            fullDate: fmtEmailDate(email.received_at),
          },
        });
      }
      setEmailLogs(rawEmails);

      // Automation logs
      const autoLogs = (autoLogsRes.data ?? []) as AutomationLogItem[];
      for (const log of autoLogs) {
        const iconMap: Record<string, { iconBg: string; iconColor: string }> = {
          email_sent: { iconBg: "bg-purple-50", iconColor: "text-purple-600" },
          opened: { iconBg: "bg-sky-50", iconColor: "text-sky-600" },
          clicked: { iconBg: "bg-emerald-50", iconColor: "text-emerald-600" },
          enrolled: { iconBg: "bg-amber-50", iconColor: "text-amber-600" },
          exited: { iconBg: "bg-red-50", iconColor: "text-red-600" },
          completed: { iconBg: "bg-green-50", iconColor: "text-green-600" },
        };
        const style = iconMap[log.event_type] ?? { iconBg: "bg-gray-50", iconColor: "text-gray-500" };
        items.push({
          id: `auto-${log.id}`,
          icon: RiMailSendLine,
          iconBg: style.iconBg,
          iconColor: style.iconColor,
          title: log.event_label,
          sub: log.description ?? "",
          time: log.created_at,
          sortKey: log.created_at,
          itemType: "automation",
        });
      }

      // Sort newest first
      items.sort((a, b) => new Date(b.sortKey).getTime() - new Date(a.sortKey).getTime());
      setActivityItems(items.slice(0, 60));
      setActivityLoading(false);
    });
  }, [workspaceId, id]);

  if (wsLoading || loading) return <Skeleton />;

  if (error || !contact) {
    return (
      <main className="px-12 py-8 max-w-[1760px] mx-auto">
        <Link href="/contacts">
          <Button variant="secondary" size="sm">
            <RiArrowLeftLine size={14} /> Back to Contacts
          </Button>
        </Link>
        <div className="mt-10 flex items-center gap-3 text-destructive">
          <RiErrorWarningLine size={20} />
          <p>{error ?? "Contact not found."}</p>
        </div>
      </main>
    );
  }

  const isTwibbonize = contact.type === "twibbonize";
  const ini = initials(contact.name);
  const t = tone(contact.name);
  const emailCount = emailLogs.length;

  return (
    <main className="px-12 py-8 max-w-[1760px] mx-auto">
      {/* Back + breadcrumb */}
      <div className="flex items-center gap-4">
        <Link href="/contacts">
          <Button variant="secondary" size="sm">
            <RiArrowLeftLine size={14} /> Back to Contacts
          </Button>
        </Link>
        <p className="text-sm text-foreground-muted">
          Contacts · All contacts ·{" "}
          <span className="text-foreground font-medium">{contact.name}</span>
        </p>
      </div>

      {/* Header card */}
      <Card className="mt-6 p-8">
        <div className="flex items-start gap-6">
          <Avatar initials={ini} size="3xl" tone={t} />

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-title-h2 font-bold tracking-tight">{contact.name}</h1>
              <TierBadge tier={contact.account_tier} />
              <Badge
                variant={isTwibbonize ? "twibbonize" : "external"}
                size="md"
                dot
                dotColor={isTwibbonize ? "var(--primary)" : "var(--destructive)"}
              >
                {isTwibbonize ? "Twibbonize User" : "External"}
              </Badge>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-foreground-subtle">
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
                  <RiMailLine size={14} />{contact.email}
                </a>
              )}
              {contact.whatsapp_number && (
                <a
                  href={`https://wa.me/${contact.whatsapp_number.replace(/\D/g, "")}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-foreground"
                >
                  <RiChat3Line size={14} />{contact.whatsapp_number}
                </a>
              )}
              {contact.instagram_handle && (
                <a
                  href={`https://instagram.com/${contact.instagram_handle}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-foreground"
                >
                  <RiInstagramLine size={14} />@{contact.instagram_handle}
                </a>
              )}
              {contact.website_url && (
                <a
                  href={contact.website_url}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-foreground underline underline-offset-4"
                >
                  <RiGlobalLine size={14} />{new URL(contact.website_url).hostname}
                </a>
              )}
              {contact.profile_url && (
                <a
                  href={contact.profile_url}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-foreground underline underline-offset-4"
                >
                  Twibbonize profile ↗
                </a>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
              {contact.segment && (
                <div className="inline-flex items-center gap-2 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Segment</span>
                  <Badge variant="primary" size="sm">{contact.segment}</Badge>
                </div>
              )}
              {contact.use_case_category && (
                <div className="inline-flex items-center gap-2 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Use case</span>
                  <Badge variant="accent" size="sm">{contact.use_case_category}</Badge>
                </div>
              )}
              {contact.company && (
                <div className="inline-flex items-center gap-2 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Company</span>
                  <span className="font-medium">{contact.company}</span>
                </div>
              )}
              {contact.country && (
                <div className="inline-flex items-center gap-2 text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Country</span>
                  <span className="font-medium">{countryNames[contact.country] ?? contact.country}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-2 shrink-0">
            {contact.email && (
              <Button variant="primary" size="md" asChild>
                <a href={`mailto:${contact.email}`}>
                  <RiMailLine size={16} /> Compose Email
                </a>
              </Button>
            )}
            {contact.whatsapp_number && (
              <Button variant="secondary" size="md" asChild>
                <a href={`https://wa.me/${contact.whatsapp_number.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                  <RiChat3Line size={16} /> Send WA
                </a>
              </Button>
            )}
            <Button variant="secondary" size="md">
              <RiCalendarLine size={16} /> Schedule call
            </Button>
            <Button variant="secondary" size="md">
              <RiQuillPenLine size={16} /> Log note
            </Button>
            <Button variant="secondary" size="md" asChild>
              <Link href={`/contacts/${id}/edit`}>
                <RiEdit2Line size={16} /> Edit contact
              </Link>
            </Button>
            <Button variant="destructive" size="md" onClick={() => setDeleteOpen(true)}>
              <RiDeleteBin2Line size={16} /> Delete
            </Button>
          </div>
        </div>

        {/* Stats strip — Twibbonize only */}
        {isTwibbonize && (
          <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-6 sm:grid-cols-3 lg:grid-cols-5">
            <StatCell label="TOTAL CAMPAIGNS" value={contact.total_campaigns?.toLocaleString() ?? "—"} />
            <StatCell label="TOTAL SUPPORTERS" value={contact.total_supporters?.toLocaleString() ?? "—"} />
            <StatCell
              label="LATEST CAMPAIGN"
              value={relativeDate(contact.latest_campaign_at) ?? "—"}
              badge={contact.latest_campaign_at ? { label: "Active", variant: "primary" as const } : undefined}
            />
            <StatCell
              label="TOP SUPPORTERS"
              value={contact.top_supporter_countries?.join(" · ") ?? "—"}
            />
            <StatCell
              label="ON PLATFORM SINCE"
              value={fmt(contact.account_created_at, { month: "short", year: "numeric" })}
            />
          </div>
        )}
      </Card>

      {/* Two-column layout */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        {/* Left: Timeline */}
        <div>
          {/* Tab bar */}
          <div className="flex items-center gap-6 border-b border-border">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={[
                  "relative inline-flex items-center gap-2 pb-3 pt-2 text-sm font-medium transition-colors",
                  activeTab === tab ? "text-foreground" : "text-foreground-subtle hover:text-foreground",
                ].join(" ")}
              >
                {tab}
                {tab === "Email" && emailCount > 0 && (
                  <span className="flex items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold px-1.5 min-w-[18px] h-[18px]">
                    {emailCount}
                  </span>
                )}
                {activeTab === tab && (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" />
                )}
              </button>
            ))}
          </div>

          {/* ── Activity tab ── */}
          {activeTab === "Activity" && (
            <>
              <div className="mt-5 flex items-center justify-between">
                <div className="flex flex-wrap gap-2">
                  {FILTERS.map((f) => (
                    <button
                      key={f}
                      onClick={() => setActivityFilter(f)}
                      className={[
                        "rounded-full px-3 h-8 text-xs font-medium transition-colors",
                        activityFilter === f
                          ? "bg-foreground text-white"
                          : "bg-background-subtle text-foreground-subtle hover:bg-background-muted",
                      ].join(" ")}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSortDesc((v) => !v)}
                >
                  <RiSortDesc size={14} /> {sortDesc ? "Newest first" : "Oldest first"}
                </Button>
              </div>

              <div className="mt-6">
                {activityLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-16 rounded-xl bg-background-subtle animate-pulse" />
                    ))}
                  </div>
                ) : filteredActivity.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background-subtle/40 py-16 text-center">
                    <span className="flex size-12 items-center justify-center rounded-full bg-background-muted mb-4">
                      <RiTimeLine size={22} className="text-foreground-muted" />
                    </span>
                    <p className="text-sm font-semibold text-foreground">No activity yet</p>
                    <p className="mt-1 text-sm text-foreground-muted max-w-xs">
                      {activityFilter === "All"
                        ? "Emails, calls, notes and system events will appear here."
                        : `No "${activityFilter}" activity found.`}
                    </p>
                    {activityFilter === "All" && (
                      <div className="mt-6 flex gap-2">
                        <Button variant="secondary" size="sm">
                          <RiCalendarLine size={14} /> Schedule call
                        </Button>
                        <Button variant="secondary" size="sm">
                          <RiQuillPenLine size={14} /> Log note
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    {filteredActivity.map((item, idx) => (
                      <ActivityRow
                        key={item.id}
                        item={item}
                        isOpen={openDetailId === item.id}
                        onToggle={() => setOpenDetailId((prev) => prev === item.id ? null : item.id)}
                        isLast={idx === filteredActivity.length - 1}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Email tab ── */}
          {activeTab === "Email" && (
            <>
              <div className="mt-5 flex items-center justify-between">
                <p className="text-sm text-foreground-muted">
                  {emailCount > 0
                    ? `${emailCount} email${emailCount !== 1 ? "s" : ""} · inbound & outbound`
                    : "No emails recorded"}
                </p>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-xs text-foreground-muted">
                    <span className="flex size-4 items-center justify-center rounded-full bg-sky-50 text-sky-600">
                      <RiMailLine size={10} />
                    </span>
                    Received
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-foreground-muted">
                    <span className="flex size-4 items-center justify-center rounded-full bg-violet-50 text-violet-600">
                      <RiMailSendLine size={10} />
                    </span>
                    Sent
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {activityLoading ? (
                  [...Array(4)].map((_, i) => (
                    <div key={i} className="h-20 rounded-xl bg-background-subtle animate-pulse" />
                  ))
                ) : emailLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background-subtle/40 py-16 text-center">
                    <span className="flex size-12 items-center justify-center rounded-full bg-background-muted mb-4">
                      <RiMailLine size={22} className="text-foreground-muted" />
                    </span>
                    <p className="text-sm font-semibold text-foreground">No emails yet</p>
                    <p className="mt-1 text-sm text-foreground-muted max-w-xs">
                      Email interactions will appear here once the daily sync runs.
                    </p>
                  </div>
                ) : (
                  emailLogs.map((email) => (
                    <EmailRow
                      key={email.id}
                      email={email}
                      isOpen={openDetailId === `email-detail-${email.id}`}
                      onToggle={() =>
                        setOpenDetailId((prev) =>
                          prev === `email-detail-${email.id}` ? null : `email-detail-${email.id}`
                        )
                      }
                    />
                  ))
                )}
              </div>
            </>
          )}

          {/* ── Outreach tab ── */}
          {activeTab === "Outreach" && (
            <>
              <div className="mt-5 flex items-center justify-between">
                <p className="text-sm text-foreground-muted">
                  {discoveryCalls.length > 0
                    ? `${discoveryCalls.length} discovery call${discoveryCalls.length !== 1 ? "s" : ""}`
                    : "No discovery calls yet"}
                </p>
                <Link href="/discovery-call">
                  <Button variant="secondary" size="sm">
                    <RiSearchEyeLine size={14} /> View in pipeline
                  </Button>
                </Link>
              </div>

              <div className="mt-4 space-y-4">
                {activityLoading ? (
                  [...Array(2)].map((_, i) => (
                    <div key={i} className="h-32 rounded-xl bg-background-subtle animate-pulse" />
                  ))
                ) : discoveryCalls.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background-subtle/40 py-16 text-center">
                    <span className="flex size-12 items-center justify-center rounded-full bg-background-muted mb-4">
                      <RiSearchEyeLine size={22} className="text-foreground-muted" />
                    </span>
                    <p className="text-sm font-semibold text-foreground">No discovery calls yet</p>
                    <p className="mt-1 text-sm text-foreground-muted max-w-xs">
                      Discovery calls for this contact will appear here once added to the pipeline.
                    </p>
                  </div>
                ) : (
                  discoveryCalls.map((call) => (
                    <OutreachCard key={call.id} call={call} />
                  ))
                )}
              </div>
            </>
          )}

          {/* ── Other tabs (placeholder) ── */}
          {activeTab === "Notes" && (
            <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background-subtle/40 py-16 text-center">
              <p className="text-sm font-semibold text-foreground">No notes yet</p>
              <p className="mt-1 text-sm text-foreground-muted">Add notes to keep track of context and next steps.</p>
              <Button variant="secondary" size="sm" className="mt-4">
                <RiQuillPenLine size={14} /> Add note
              </Button>
            </div>
          )}
          {activeTab === "Files" && (
            <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background-subtle/40 py-16 text-center">
              <p className="text-sm font-semibold text-foreground">No files yet</p>
              <p className="mt-1 text-sm text-foreground-muted">Proposals, decks and contracts will appear here.</p>
            </div>
          )}
          {activeTab === "Partnerships" && (
            <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background-subtle/40 py-16 text-center">
              <p className="text-sm font-semibold text-foreground">No partnerships yet</p>
              <p className="mt-1 text-sm text-foreground-muted">Deals and partnership details will appear here.</p>
            </div>
          )}
        </div>

        {/* Right: About panel */}
        <aside>
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-subheading-20 font-semibold">About</h2>
              {contact.last_synced_at
                ? <span className="text-xs text-foreground-muted">Synced {relativeDate(contact.last_synced_at)}</span>
                : <span className="text-xs text-foreground-muted">Not synced</span>
              }
            </div>

            {/* CRM-managed */}
            <div className="mt-6">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                CRM-MANAGED <RiEdit2Line size={12} />
              </div>

              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Summary profile</p>
                {contact.summary_profile
                  ? <p className="mt-1 text-sm leading-relaxed">{contact.summary_profile}</p>
                  : <Empty>No summary yet — add one to help your team.</Empty>
                }
              </div>

              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Segment</p>
                {contact.segment
                  ? <Badge variant="primary" size="sm" className="mt-2">{contact.segment}</Badge>
                  : <Empty>Not assigned</Empty>
                }
              </div>

              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Use case category</p>
                {contact.use_case_category
                  ? <Badge variant="accent" size="sm" className="mt-2">{contact.use_case_category}</Badge>
                  : <Empty>Not assigned</Empty>
                }
              </div>

              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Email</p>
                {contact.email
                  ? <p className="mt-1 text-sm font-medium">{contact.email}</p>
                  : <Empty>No email on file</Empty>
                }
              </div>

              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">WhatsApp</p>
                {contact.whatsapp_number
                  ? <p className="mt-1 text-sm font-medium">{contact.whatsapp_number}</p>
                  : <Empty>No WhatsApp number</Empty>
                }
              </div>

              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Instagram</p>
                {contact.instagram_handle
                  ? (
                    <a
                      href={`https://instagram.com/${contact.instagram_handle}`}
                      target="_blank" rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      <RiInstagramLine size={14} />@{contact.instagram_handle}
                    </a>
                  )
                  : <Empty>No Instagram handle</Empty>
                }
              </div>

              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Website</p>
                {contact.website_url
                  ? (
                    <a
                      href={contact.website_url}
                      target="_blank" rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      <RiGlobalLine size={14} />{new URL(contact.website_url).hostname}
                    </a>
                  )
                  : <Empty>No website</Empty>
                }
              </div>

              {!isTwibbonize && (
                <>
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Company</p>
                    {contact.company
                      ? <p className="mt-1 text-sm font-medium">{contact.company}</p>
                      : <Empty>No company</Empty>
                    }
                  </div>
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Business category</p>
                    {contact.business_category
                      ? <p className="mt-1 text-sm font-medium">{contact.business_category}</p>
                      : <Empty>No category</Empty>
                    }
                  </div>
                </>
              )}
            </div>

            {/* Synced from Twibbonize */}
            {isTwibbonize && (
              <div className="mt-6 border-t border-border pt-6">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                  SYNCED FROM TWIBBONIZE
                  <RiCheckboxCircleFill size={14} className="text-primary" />
                </div>

                <dl className="mt-3 flex flex-col gap-4">
                  <Field label="Profile">
                    {contact.profile_url
                      ? <a href={contact.profile_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium underline underline-offset-4 text-primary">{contact.profile_url.replace("https://", "")}</a>
                      : <Empty>Not synced yet</Empty>
                    }
                  </Field>

                  <Field label="Account tier">
                    {contact.account_tier
                      ? <TierBadge tier={contact.account_tier} />
                      : <Empty>Not synced yet</Empty>
                    }
                  </Field>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Country">
                      {contact.country
                        ? <p className="text-sm font-medium">{countryNames[contact.country] ?? contact.country}</p>
                        : <Empty>—</Empty>
                      }
                    </Field>
                    <Field label="Account created">
                      {contact.account_created_at
                        ? <p className="text-sm font-medium">{fmt(contact.account_created_at)}</p>
                        : <Empty>—</Empty>
                      }
                    </Field>
                    <Field label="First campaign">
                      {contact.first_campaign_at
                        ? <p className="text-sm font-medium">{fmt(contact.first_campaign_at)}</p>
                        : <Empty>—</Empty>
                      }
                    </Field>
                    <Field label="Latest campaign">
                      {contact.latest_campaign_at
                        ? <p className="text-sm font-medium">{fmt(contact.latest_campaign_at)}</p>
                        : <Empty>—</Empty>
                      }
                    </Field>
                    <Field label="Total campaigns">
                      {contact.total_campaigns != null
                        ? <p className="text-sm font-medium">{contact.total_campaigns.toLocaleString()}</p>
                        : <Empty>—</Empty>
                      }
                    </Field>
                    <Field label="Total supporters">
                      {contact.total_supporters != null
                        ? <p className="text-sm font-medium">{contact.total_supporters.toLocaleString()}</p>
                        : <Empty>—</Empty>
                      }
                    </Field>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Top supporter countries</p>
                    {contact.top_supporter_countries && contact.top_supporter_countries.length > 0
                      ? (
                        <ul className="mt-2 flex flex-col gap-2">
                          {contact.top_supporter_countries.map((code, i) => {
                            const pct = i === 0 ? 70 : i === 1 ? 20 : 10;
                            return (
                              <li key={code} className="grid grid-cols-[120px_1fr_30px] items-center gap-2 text-sm">
                                <span>{countryNames[code] ?? code}</span>
                                <span className="h-2 rounded-full bg-background-muted overflow-hidden">
                                  <span className="block h-full bg-primary" style={{ width: `${pct}%` }} />
                                </span>
                                <span className="text-right font-semibold">{pct}%</span>
                              </li>
                            );
                          })}
                        </ul>
                      )
                      : <Empty>No supporter data yet</Empty>
                    }
                  </div>
                </dl>
              </div>
            )}
          </Card>
        </aside>
      </div>

      <DeleteContactDialog
        contact={contact}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
      />
    </main>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatCell({
  label, value, badge, sub,
}: {
  label: string;
  value: string;
  badge?: { label: string; variant: "primary" };
  sub?: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-title-h4 font-bold">{value}</p>
        {badge && (
          <Badge variant={badge.variant} size="sm" dot dotColor="var(--primary)">{badge.label}</Badge>
        )}
      </div>
      {sub && <p className="mt-1 text-xs text-foreground-muted">{sub}</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

/** Subtle placeholder shown when a field has no data in Supabase. */
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1 text-sm text-foreground-muted italic">{children}</p>
  );
}

// ─── Outreach card ─────────────────────────────────────────────────────────────

function OutreachCard({ call }: { call: OutreachCall }) {
  const stage = STAGE_STYLES[call.stage] ?? { label: call.stage, dot: "bg-foreground-muted", text: "text-foreground-muted", bg: "bg-background-subtle" };
  const result = RESULT_STYLES[call.result] ?? RESULT_STYLES.pending;
  const survey = SURVEY_STATUS_LABELS[call.survey_status] ?? call.survey_status;
  const leadLabel = LEAD_SOURCE_LABELS[call.lead_source] ?? call.lead_source;
  const leadIcon = LEAD_SOURCE_ICONS[call.lead_source] ?? <RiMailLine size={13} />;

  const interviewStr = call.interview_date
    ? new Date(call.interview_date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) +
      (call.interview_time ? ` · ${call.interview_time.slice(0, 5)}` : "") +
      (call.interview_timezone ? ` (${call.interview_timezone.split("/").pop()?.replace("_", " ")})` : "")
    : null;

  return (
    <div className="rounded-xl border border-border bg-background p-5">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Stage badge */}
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full ${stage.bg} ${stage.text}`}>
            <span className={`size-1.5 rounded-full ${stage.dot}`} />
            {stage.label}
          </span>
          {/* Result badge */}
          <span className={`inline-flex items-center text-xs font-semibold px-2 py-1 rounded-full border ${result.bg} ${result.text} ${result.border}`}>
            {result.label}
          </span>
          {/* Lead source */}
          <span className="inline-flex items-center gap-1 text-xs text-foreground-muted bg-background-subtle border border-border px-2 py-1 rounded-full">
            {leadIcon} {leadLabel}
          </span>
          {call.reschedule_count > 0 && (
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full font-medium">
              Rescheduled ×{call.reschedule_count}
            </span>
          )}
        </div>
        <span className="text-xs text-foreground-muted shrink-0 mt-0.5">
          {timeAgoLocal(call.replied_at)}
        </span>
      </div>

      {/* Grid of detail fields */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
        <OutreachField label="Replied at">
          {new Date(call.replied_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
        </OutreachField>

        <OutreachField label="Interview">
          {interviewStr ?? <span className="text-foreground-muted italic">Not scheduled</span>}
        </OutreachField>

        <OutreachField label="Survey">
          <SurveyPill status={call.survey_status} label={survey} />
        </OutreachField>

        {call.stage === "skipped" && call.skip_reason && (
          <OutreachField label="Skip reason">
            <span className="text-foreground-muted">
              {SKIP_REASON_LABELS[call.skip_reason] ?? call.skip_reason}
              {call.skip_note && <span className="ml-1 text-foreground-muted/70">· {call.skip_note}</span>}
            </span>
          </OutreachField>
        )}
      </div>

      {/* Notes */}
      {call.notes && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted mb-1.5 flex items-center gap-1">
            <RiFileTextLine size={11} /> Notes
          </p>
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{call.notes}</p>
        </div>
      )}

      {/* Skipped note alone */}
      {call.stage === "skipped" && !call.notes && call.skip_note && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-sm text-foreground-muted italic">{call.skip_note}</p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-border flex items-center gap-4 text-xs text-foreground-muted">
        <span className="flex items-center gap-1">
          <RiTimeLine size={12} /> Last activity {timeAgoLocal(call.last_activity_at)}
        </span>
        <span className="flex items-center gap-1">
          <RiCalendarLine size={12} /> Created {new Date(call.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
        </span>
        {call.next_action !== "none" && (
          <span className="flex items-center gap-1 text-primary font-medium">
            <RiSkipForwardLine size={12} />
            {call.next_action === "to_partnership" ? "→ Partnership"
              : call.next_action === "nurture_90d" ? "Nurture 90d"
              : "Archive"}
          </span>
        )}
      </div>
    </div>
  );
}

function OutreachField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-muted mb-1">{label}</p>
      <div className="text-sm font-medium text-foreground">{children}</div>
    </div>
  );
}

function SurveyPill({ status, label }: { status: string; label: string }) {
  const styles: Record<string, string> = {
    not_sent:     "text-foreground-muted",
    sent_pending: "text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded",
    completed:    "text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded",
    skipped:      "text-foreground-muted line-through",
  };
  return <span className={`text-xs font-medium ${styles[status] ?? ""}`}>{label}</span>;
}
