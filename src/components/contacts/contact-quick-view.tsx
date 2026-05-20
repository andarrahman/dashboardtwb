"use client";

import * as React from "react";
import Link from "next/link";
import {
  RiMailLine,
  RiMailSendLine,
  RiChat3Line,
  RiGlobalLine,
  RiArrowRightLine,
  RiPriceTag3Line,
  RiLightbulbLine,
  RiSearchEyeLine,
  RiCheckboxCircleLine,
  RiTimeLine,
  RiArrowDownSLine,
} from "@remixicon/react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { ContactRow, AccountTier } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/browser";

/**
 * ContactQuickView — UC-C16. Centered popup over the list with a summary
 * of the contact. From here the user can either jump to the full detail
 * page or fire a quick action inline.
 */

export interface ContactQuickViewProps {
  contact: ContactRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Activity hook ─────────────────────────────────────────────────────────────

interface ActivityItem {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ElementType<any>;
  iconTone: string;
  title: string;
  sub: string;
  time: string;
  // Email-specific detail
  isEmail?: boolean;
  detail?: {
    fromName: string;
    fromEmail: string;
    toEmail: string;
    direction: "inbound" | "outbound";
    bodyPreview: string | null;
    fullDate: string;
  };
}

const STAGE_LABELS: Record<string, string> = {
  replied:            "Replied",
  waiting_reschedule: "Waiting reschedule",
  scheduled:          "Scheduled",
  waiting_result:     "Waiting result",
  finished:           "Finished",
  skipped:            "Skipped",
};

const RESULT_LABELS: Record<string, string> = {
  qualified:     "Qualified",
  nurture:       "Nurture",
  not_qualified: "Not qualified",
  pending:       "Pending",
};

const SOURCE_LABELS: Record<string, string> = {
  email:     "Email",
  whatsapp:  "WhatsApp",
  linkedin:  "LinkedIn",
  instagram: "Instagram",
};

function useContactActivity(contactId: string | undefined): { items: ActivityItem[]; loading: boolean } {
  const [items, setItems] = React.useState<ActivityItem[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!contactId) { setItems([]); return; }
    setLoading(true);
    const supabase = createClient();

    // Fetch both discovery calls and email logs in parallel
    Promise.all([
      // Discovery calls
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("discovery_calls")
        .select("id, stage, result, lead_source, interview_date, last_activity_at, created_at")
        .eq("contact_id", contactId)
        .is("deleted_at", null)
        .order("last_activity_at", { ascending: false })
        .limit(10),

      // Email logs saved by checkdailyemail.py
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("contact_email_logs")
        .select("id, from_email, from_name, to_email, subject, received_at, direction, body_preview")
        .eq("contact_id", contactId)
        .order("received_at", { ascending: false })
        .limit(20),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ]).then(([dcRes, emailRes]: [any, any]) => {
      const calls: ActivityItem[] = (dcRes.data ?? []).map((dc: any) => {
        const hasResult = dc.result && dc.result !== "pending";
        const icon = hasResult ? RiCheckboxCircleLine : RiSearchEyeLine;
        const iconTone = hasResult
          ? dc.result === "qualified"
            ? "bg-emerald-50 text-emerald-600"
            : dc.result === "nurture"
            ? "bg-amber-50 text-amber-600"
            : "bg-red-50 text-red-600"
          : "bg-primary/10 text-primary";

        const stageLabel = STAGE_LABELS[dc.stage] ?? dc.stage;
        const resultLabel = hasResult ? RESULT_LABELS[dc.result] : null;
        const sourceLabel = SOURCE_LABELS[dc.lead_source] ?? dc.lead_source;

        const title = hasResult
          ? `Discovery call · ${resultLabel}`
          : `Discovery call · ${stageLabel}`;

        const parts: string[] = [sourceLabel];
        if (dc.interview_date) {
          parts.push(
            new Date(dc.interview_date).toLocaleDateString("en-US", {
              month: "short", day: "numeric", year: "numeric",
            })
          );
        }

        return {
          icon,
          iconTone,
          title,
          sub: parts.join(" · "),
          time: relativeDate(dc.last_activity_at) ?? relativeDate(dc.created_at) ?? "",
          sortKey: new Date(dc.last_activity_at ?? dc.created_at).getTime(),
        };
      });

      const emails: ActivityItem[] = (emailRes.data ?? []).map((em: any) => {
        const isOutbound = em.direction === "outbound";
        const fullDate = em.received_at
          ? new Date(em.received_at).toLocaleString("en-US", {
              weekday: "short", month: "short", day: "numeric",
              year: "numeric", hour: "2-digit", minute: "2-digit",
            })
          : "";
        return {
          icon: isOutbound ? RiMailSendLine : RiMailLine,
          iconTone: isOutbound ? "bg-violet-50 text-violet-600" : "bg-sky-50 text-sky-600",
          title: isOutbound ? "Email sent" : "Email received",
          sub: em.subject ?? "(no subject)",
          time: relativeDate(em.received_at) ?? "",
          sortKey: new Date(em.received_at).getTime(),
          isEmail: true,
          detail: {
            fromName:    em.from_name ?? em.from_email,
            fromEmail:   em.from_email,
            toEmail:     em.to_email ?? "",
            direction:   em.direction,
            bodyPreview: em.body_preview ?? null,
            fullDate,
          },
        };
      });

      // Merge and sort by most recent first
      const merged = [...calls, ...emails]
        .sort((a, b) => ((b as any).sortKey ?? 0) - ((a as any).sortKey ?? 0))
        .slice(0, 20);

      setItems(merged);
      setLoading(false);
    });
  }, [contactId]);

  return { items, loading };
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function tierLabel(tier: AccountTier | null) {
  if (!tier) return null;
  return {
    premium_creator:   "★ Premium Creator",
    premium_supporter: "Premium Supporter",
    free:              "Free",
  }[tier];
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

export function ContactQuickView({
  contact,
  open,
  onOpenChange,
}: ContactQuickViewProps) {
  // The contact prop may be a partial join (e.g. from email queries that only
  // select a subset of columns). Always re-fetch the full row when the dialog
  // opens so stats / segment / use_case etc. are always present.
  const [fullContact, setFullContact] = React.useState<ContactRow | null>(contact);

  React.useEffect(() => {
    // Reset to the prop value immediately so stale data from a previous
    // contact doesn't flash while the new fetch is in flight.
    setFullContact(contact);
    if (!open || !contact?.id) return;
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("contacts")
      .select("*")
      .eq("id", contact.id)
      .single()
      .then(({ data }: { data: ContactRow | null }) => {
        if (data) setFullContact(data);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contact?.id]);

  const { items: activityItems, loading: activityLoading } = useContactActivity(contact?.id);
  const [listExpanded, setListExpanded] = React.useState(false);
  const [openDetailIdx, setOpenDetailIdx] = React.useState<number | null>(null);

  // Reset UI state when contact changes
  React.useEffect(() => {
    setListExpanded(false);
    setOpenDetailIdx(null);
  }, [contact?.id]);

  // Use the fully-fetched contact for rendering; fall back to prop while loading
  const c = fullContact ?? contact;
  if (!c) return null;

  const ini = initials(c.name);
  const toneIdx = c.name.charCodeAt(0) % 5;
  const tones = [
    "bg-turquoise-100 text-turquoise-700",
    "bg-amber-100 text-amber-700",
    "bg-violet-100 text-violet-700",
    "bg-rose-100 text-rose-700",
    "bg-sky-100 text-sky-700",
  ];
  const tone = tones[toneIdx];

  const tier = c.account_tier;
  const tl = tierLabel(tier);
  const isTwibbonize = c.type === "twibbonize";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="xl"
        className="!max-w-[560px] flex flex-col"
        style={{ maxHeight: "calc(100vh - 96px)" }}
      >
        {/* Scrollable body — header & footer stay fixed */}
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">

        {/* Header */}
        <div className="flex items-start gap-4 p-6 pb-4">
          <Avatar initials={ini} size="2xl" tone={tone} />
          <div className="flex-1 min-w-0 pr-10">
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle className="text-title-h4 font-bold tracking-tight">
                {c.name}
              </DialogTitle>
              {tl && (
                <Badge variant={tier === "premium_creator" ? "accent" : "neutral"} size="sm">
                  {tl}
                </Badge>
              )}
            </div>
            <DialogDescription className="mt-2 inline-flex flex-wrap items-center gap-2 text-sm text-foreground-subtle">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-primary" />
                {isTwibbonize ? "Twibbonize User" : "External"}
              </span>
              {c.country && (
                <>
                  <span className="text-foreground-muted">·</span>
                  <span>{c.country}</span>
                </>
              )}
              {c.company && (
                <>
                  <span className="text-foreground-muted">·</span>
                  <span>{c.company}</span>
                </>
              )}
            </DialogDescription>
          </div>
        </div>

        {/* Stats strip — Twibbonize only */}
        {isTwibbonize && (c.total_campaigns != null || c.total_supporters != null) && (
          <div className="grid grid-cols-3 gap-4 border-t border-border bg-background-subtle/50 px-6 py-4">
            <Stat label="CAMPAIGNS" value={c.total_campaigns?.toLocaleString() ?? "—"} />
            <Stat label="SUPPORTERS" value={c.total_supporters?.toLocaleString() ?? "—"} />
            <Stat
              label="LATEST"
              value={relativeDate(c.latest_campaign_at) ?? "—"}
              accent={
                c.latest_campaign_at ? (
                  <Badge variant="primary" size="xs" dot dotColor="var(--primary)">
                    Active
                  </Badge>
                ) : undefined
              }
            />
          </div>
        )}

        {/* Detail rows */}
        <dl className="flex flex-col divide-y divide-border border-t border-border">
          {c.email && (
            <Row icon={RiMailLine} label="Email">
              {c.email}
            </Row>
          )}
          {c.whatsapp_number && (
            <Row icon={RiChat3Line} label="WhatsApp">
              {c.whatsapp_number}
            </Row>
          )}
          {c.segment && (
            <Row icon={RiPriceTag3Line} label="Segment">
              <span className="font-medium">{c.segment}</span>
            </Row>
          )}
          {c.use_case_category && (
            <Row icon={RiLightbulbLine} label="Use case">
              <span className="font-medium">{c.use_case_category}</span>
            </Row>
          )}
          {isTwibbonize && c.top_supporter_countries && c.top_supporter_countries.length > 0 && (
            <Row icon={RiGlobalLine} label="Top supporters">
              <span className="font-medium">
                {c.top_supporter_countries.join(" · ")}
              </span>
            </Row>
          )}
        </dl>

        {/* Activity history */}
        <div className="border-t border-border bg-background-subtle/40 px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
              Activity history
            </p>
            {activityItems.length > 0 && (
              <span className="text-xs text-foreground-muted">
                {activityItems.length} item{activityItems.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {activityLoading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded-lg bg-background-subtle animate-pulse" />
              ))}
            </div>
          ) : activityItems.length === 0 ? (
            <div className="flex items-center gap-2.5 rounded-lg border border-dashed border-border px-3 py-3 text-foreground-muted">
              <RiTimeLine size={14} className="shrink-0" />
              <p className="text-xs">No activity yet for this contact.</p>
            </div>
          ) : (
            <>
              {/* First 3 always visible */}
              <ul className="flex flex-col gap-2">
                {activityItems.slice(0, ACTIVITY_PREVIEW).map((a, i) => (
                  <ActivityRow
                    key={i}
                    item={a}
                    openDetail={openDetailIdx === i}
                    onToggleDetail={() => setOpenDetailIdx(openDetailIdx === i ? null : i)}
                  />
                ))}
              </ul>

              {/* Remaining items — animated expand */}
              {activityItems.length > ACTIVITY_PREVIEW && (
                <>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateRows: listExpanded ? "1fr" : "0fr",
                      transition: "grid-template-rows 0.35s cubic-bezier(0.4,0,0.2,1)",
                    }}
                  >
                    <div style={{ overflow: "hidden" }}>
                      <ul className="flex flex-col gap-2 pt-2">
                        {activityItems.slice(ACTIVITY_PREVIEW).map((a, i) => {
                          const idx = i + ACTIVITY_PREVIEW;
                          return (
                            <ActivityRow
                              key={idx}
                              item={a}
                              openDetail={openDetailIdx === idx}
                              onToggleDetail={() => setOpenDetailIdx(openDetailIdx === idx ? null : idx)}
                            />
                          );
                        })}
                      </ul>
                    </div>
                  </div>

                  {/* Show more / less button */}
                  <button
                    onClick={() => {
                      setListExpanded((v) => !v);
                      if (listExpanded) setOpenDetailIdx(null);
                    }}
                    className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-foreground-muted hover:text-foreground hover:bg-background-subtle border border-dashed border-border transition-colors"
                  >
                    <RiArrowDownSLine
                      size={13}
                      className="transition-transform duration-300"
                      style={{ transform: listExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
                    />
                    {listExpanded
                      ? "Show less"
                      : `Show ${activityItems.length - ACTIVITY_PREVIEW} more`}
                  </button>
                </>
              )}
            </>
          )}
        </div>

        </div>{/* end scrollable body */}

        {/* Footer actions — always visible at bottom */}
        <div className="flex items-center gap-2 border-t border-border p-4 shrink-0">
          <Button asChild variant="primary" size="md" className="flex-1">
            <Link href={`/contacts/${c.id}`}>
              View full detail
              <RiArrowRightLine size={16} />
            </Link>
          </Button>
          {c.email && (
            <DialogClose asChild>
              <Button variant="secondary" size="md" asChild>
                <a href={`mailto:${c.email}`}>
                  <RiMailLine size={16} />
                  Email
                </a>
              </Button>
            </DialogClose>
          )}
          {c.whatsapp_number && (
            <DialogClose asChild>
              <Button variant="secondary" size="md" asChild>
                <a
                  href={`https://wa.me/${c.whatsapp_number.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <RiChat3Line size={16} />
                  WA
                </a>
              </Button>
            </DialogClose>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const ACTIVITY_PREVIEW = 3;

function ActivityRow({
  item: a,
  openDetail,
  onToggleDetail,
}: {
  item: ActivityItem;
  openDetail: boolean;
  onToggleDetail: () => void;
}) {
  return (
    <li className="rounded-lg border border-border overflow-hidden bg-background">
      {/* Main row */}
      <button
        type="button"
        onClick={a.isEmail ? onToggleDetail : undefined}
        className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${
          a.isEmail ? "hover:bg-background-subtle cursor-pointer" : "cursor-default"
        } ${openDetail ? "bg-background-subtle" : ""}`}
      >
        <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${a.iconTone}`}>
          <a.icon size={14} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{a.title}</p>
          <p className="text-xs text-foreground-muted truncate">{a.sub}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-foreground-muted">{a.time}</span>
          {a.isEmail && (
            <RiArrowDownSLine
              size={14}
              className="text-foreground-muted transition-transform duration-300"
              style={{ transform: openDetail ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          )}
        </div>
      </button>

      {/* Inline detail — grid animation */}
      {a.isEmail && (
        <div
          style={{
            display: "grid",
            gridTemplateRows: openDetail ? "1fr" : "0fr",
            transition: "grid-template-rows 0.3s cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          <div style={{ overflow: "hidden" }}>
            {a.detail && (
              <div className="px-4 pb-4 pt-1 border-t border-border/60 bg-background-subtle/60">
                {/* Meta */}
                <div className="flex flex-col gap-1 mb-3">
                  <div className="flex items-start gap-2 text-xs">
                    <span className="text-foreground-muted w-8 shrink-0 pt-0.5">From</span>
                    <span className="font-medium text-foreground break-all">{a.detail.fromName}</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs">
                    <span className="text-foreground-muted w-8 shrink-0 pt-0.5">To</span>
                    <span className="text-foreground-muted break-all">{a.detail.toEmail}</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs">
                    <span className="text-foreground-muted w-8 shrink-0 pt-0.5">Date</span>
                    <span className="text-foreground-muted">{a.detail.fullDate}</span>
                  </div>
                </div>

                {/* Body preview */}
                {a.detail.bodyPreview ? (
                  <div className="rounded-lg bg-background border border-border px-3 py-2.5">
                    <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                      {a.detail.bodyPreview}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border px-3 py-2 text-center">
                    <p className="text-xs text-foreground-muted">No body preview available</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
        {label}
      </p>
      <div className="mt-1 flex items-baseline gap-2">
        <p className="text-subheading-20 font-bold tracking-tight">{value}</p>
        {accent}
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ElementType<any>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-center gap-4 px-6 py-3">
      <dt className="inline-flex items-center gap-2 text-sm text-foreground-muted">
        <Icon size={14} />
        {label}
      </dt>
      <dd className="text-sm text-foreground text-right">{children}</dd>
    </div>
  );
}
