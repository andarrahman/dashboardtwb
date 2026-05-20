"use client";

import * as React from "react";
import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiMailLine,
  RiWhatsappLine,
  RiLinkedinLine,
  RiInstagramLine,
  RiAlertLine,
  RiExternalLinkLine,
  RiTimeLine,
  RiCalendarLine,
} from "@remixicon/react";
import type { DiscoveryCallRow } from "@/lib/supabase/types";
import { STAGE_MAP } from "./constants";

// ─── Types ────────────────────────────────────────────────────────────────────

type ScheduleRange = "week" | "quarter" | "year";

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getMondayOfWeek(base: Date): Date {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function getWeekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function todayIsoFn(): string {
  return toIso(new Date());
}

function currentTimeHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function getQuarterNum(date: Date): 1 | 2 | 3 | 4 {
  return (Math.floor(date.getMonth() / 3) + 1) as 1 | 2 | 3 | 4;
}

function getQuarterMonthIndices(quarter: 1 | 2 | 3 | 4): number[] {
  const start = (quarter - 1) * 3;
  return [start, start + 1, start + 2];
}

function shiftQuarter(q: 1 | 2 | 3 | 4, year: number, delta: 1 | -1) {
  let nq = q + delta;
  let ny = year;
  if (nq < 1) { nq = 4; ny -= 1; }
  if (nq > 4) { nq = 1; ny += 1; }
  return { quarter: nq as 1 | 2 | 3 | 4, year: ny };
}

// ─── Shared constants ─────────────────────────────────────────────────────────

const LEAD_ICONS: Record<string, React.ReactNode> = {
  email:     <RiMailLine size={11} />,
  whatsapp:  <RiWhatsappLine size={11} />,
  linkedin:  <RiLinkedinLine size={11} />,
  instagram: <RiInstagramLine size={11} />,
};

const STAGE_BAR: Record<string, string> = {
  replied:            "bg-foreground-muted/40",
  waiting_reschedule: "bg-amber-400",
  scheduled:          "bg-primary",
  waiting_result:     "bg-sky-400",
  finished:           "bg-red-400",
  skipped:            "bg-foreground-muted/30",
};

const STAGE_BADGE: Record<string, string> = {
  replied:            "bg-background-muted text-foreground-muted",
  waiting_reschedule: "bg-amber-50 text-amber-700",
  scheduled:          "bg-primary/10 text-primary",
  waiting_result:     "bg-sky-50 text-sky-700",
  finished:           "bg-red-50 text-red-600",
  skipped:            "bg-background-muted text-foreground-muted",
};

const OWNER_TONES = ["bg-violet-400", "bg-sky-400", "bg-amber-400", "bg-emerald-400", "bg-rose-400"];

// ─── Owner avatar ─────────────────────────────────────────────────────────────

function OwnerAvatar({ owner }: { owner: { display_name: string | null; email: string | null } }) {
  const name = owner.display_name ?? owner.email?.split("@")[0] ?? "?";
  const ini  = name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
  const tone = OWNER_TONES[name.charCodeAt(0) % OWNER_TONES.length];
  return (
    <div className="flex items-center gap-1 min-w-0">
      <div className={`size-4 rounded-full ${tone} flex items-center justify-center text-[8px] font-bold text-white shrink-0`}>
        {ini}
      </div>
      <span className="text-[10px] text-foreground-muted font-medium truncate max-w-[80px]">{name}</span>
    </div>
  );
}

// ─── Call card (shared by week & quarter views) ───────────────────────────────

function ScheduleCard({
  call,
  isOverdue,
  isTeamView,
  onEdit,
  onOpenContact,
}: {
  call: DiscoveryCallRow;
  isOverdue: boolean;
  isTeamView: boolean;
  onEdit: (c: DiscoveryCallRow) => void;
  onOpenContact: (c: DiscoveryCallRow) => void;
}) {
  const contact = call.contact as unknown as {
    name: string; email: string | null; company: string | null;
    segment: string | null; type: string;
  } | undefined;
  const owner   = call.owner as { display_name: string | null; email: string | null } | undefined;
  const bar     = isOverdue ? "bg-red-400" : (STAGE_BAR[call.stage] ?? "bg-border");
  const badge   = STAGE_BADGE[call.stage] ?? "bg-background-muted text-foreground-muted";
  const leadIcon = LEAD_ICONS[call.lead_source] ?? <RiMailLine size={11} />;
  const stageInfo = STAGE_MAP[call.stage];
  const subLine = contact?.type === "twibbonize" ? contact?.segment : contact?.company;

  return (
    <div
      onClick={() => onEdit(call)}
      className="group relative rounded-xl border border-border bg-background p-3 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 overflow-hidden"
    >
      <div className={`absolute left-0 inset-y-0 w-[3px] rounded-l-xl ${bar}`} />
      <div className="pl-2.5">
        <p className={`text-[10px] font-bold tabular-nums mb-1.5 flex items-center gap-1 ${isOverdue ? "text-red-500" : "text-foreground-muted"}`}>
          {call.interview_time ? call.interview_time.slice(0, 5) : <span className="italic font-normal">TBD</span>}
          {isOverdue && <><RiAlertLine size={10} /> Past</>}
        </p>
        <p className="text-sm font-semibold leading-snug line-clamp-2 pr-1">{contact?.name ?? "Unknown"}</p>
        {subLine && <p className="text-[11px] text-foreground-muted mt-0.5 truncate">{subLine}</p>}
        {isTeamView && owner && <div className="mt-1.5"><OwnerAvatar owner={owner} /></div>}
        <div className="flex items-center justify-between mt-2.5 gap-1">
          <div className="flex items-center gap-1">
            <span className="flex size-5 items-center justify-center rounded-full bg-primary/8 text-primary shrink-0">{leadIcon}</span>
            {call.interview_meeting_url && (
              <a
                href={call.interview_meeting_url}
                target="_blank" rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-0.5 text-[10px] font-semibold text-primary hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <RiExternalLinkLine size={10} /> Join
              </a>
            )}
          </div>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${badge}`}>
            {stageInfo?.label ?? call.stage}
          </span>
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onOpenContact(call); }}
        className="absolute top-2 right-2 size-5 flex items-center justify-center rounded-full bg-background-subtle hover:bg-background-muted text-foreground-muted transition-colors opacity-0 group-hover:opacity-100"
        title="Open contact"
      >
        <RiTimeLine size={10} />
      </button>
    </div>
  );
}

// ─── Week view ────────────────────────────────────────────────────────────────

function DayColumn({
  day, dayCalls, isToday, isPast, todayIso, nowHHMM, isTeamView, onEdit, onOpenContact,
}: {
  day: Date; dayCalls: DiscoveryCallRow[]; isToday: boolean; isPast: boolean;
  todayIso: string; nowHHMM: string; isTeamView: boolean;
  onEdit: (c: DiscoveryCallRow) => void; onOpenContact: (c: DiscoveryCallRow) => void;
}) {
  return (
    <div className="flex flex-col min-w-[170px] flex-1">
      {/* Column header */}
      <div className={`shrink-0 rounded-xl px-3 py-3 mb-3 text-center transition-colors ${
        isToday ? "bg-primary text-white shadow-sm"
        : isPast ? "bg-background-subtle/60 border border-border/60"
        : "bg-background border border-border"
      }`}>
        <p className={`text-[10px] font-bold uppercase tracking-widest ${isToday ? "text-white/70" : "text-foreground-muted"}`}>
          {day.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase()}
        </p>
        <p className={`text-2xl font-black leading-none mt-0.5 ${isToday ? "text-white" : isPast ? "text-foreground-muted" : "text-foreground"}`}>
          {day.getDate()}
        </p>
        <p className={`text-[10px] mt-0.5 ${isToday ? "text-white/70" : "text-foreground-muted"}`}>
          {day.toLocaleDateString("en-GB", { month: "short" })}
        </p>
        {dayCalls.length > 0 ? (
          <div className={`mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block ${
            isToday ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
          }`}>
            {dayCalls.length} interview{dayCalls.length !== 1 ? "s" : ""}
          </div>
        ) : (
          <div className={`mt-2 text-[10px] ${isToday ? "text-white/40" : "text-foreground-muted/40"}`}>—</div>
        )}
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5">
        {dayCalls.length === 0 ? (
          <div className={`h-24 rounded-xl border-2 border-dashed flex items-center justify-center ${
            isToday ? "border-primary/20" : "border-border/40"
          }`}>
            <p className="text-[11px] text-foreground-muted/30 italic">No interviews</p>
          </div>
        ) : dayCalls.map((call) => {
          const key = toIso(day);
          const isOverdue = (key < todayIso) ||
            (key === todayIso && !!call.interview_time && call.interview_time.slice(0, 5) < nowHHMM && call.stage === "scheduled");
          return (
            <ScheduleCard key={call.id} call={call} isOverdue={isOverdue} isTeamView={isTeamView}
              onEdit={onEdit} onOpenContact={onOpenContact} />
          );
        })}
      </div>
    </div>
  );
}

function WeekView({
  calls, isTeamView, onEdit, onOpenContact,
}: {
  calls: DiscoveryCallRow[]; isTeamView: boolean;
  onEdit: (c: DiscoveryCallRow) => void; onOpenContact: (c: DiscoveryCallRow) => void;
}) {
  const [monday, setMonday] = React.useState<Date>(() => getMondayOfWeek(new Date()));
  const days    = getWeekDays(monday);
  const todayIso = todayIsoFn();
  const nowHHMM  = currentTimeHHMM();

  const byDate = React.useMemo(() => {
    const map: Record<string, DiscoveryCallRow[]> = {};
    for (const call of calls) {
      if (!call.interview_date) continue;
      if (!map[call.interview_date]) map[call.interview_date] = [];
      map[call.interview_date].push(call);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => (a.interview_time ?? "").localeCompare(b.interview_time ?? ""));
    }
    return map;
  }, [calls]);

  const total = days.reduce((n, d) => n + (byDate[toIso(d)]?.length ?? 0), 0);
  const isCurrentWeek = toIso(monday) === toIso(getMondayOfWeek(new Date()));
  const weekLabel = `${days[0].toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${days[6].toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <>
      <NavBar
        label={weekLabel}
        sub={total === 0 ? "No interviews" : `${total} interview${total !== 1 ? "s" : ""}`}
        isCurrent={isCurrentWeek}
        onPrev={() => setMonday((m) => { const d = new Date(m); d.setDate(d.getDate() - 7); return d; })}
        onNext={() => setMonday((m) => { const d = new Date(m); d.setDate(d.getDate() + 7); return d; })}
        onToday={() => setMonday(getMondayOfWeek(new Date()))}
      />
      <div className="flex-1 flex gap-3 overflow-x-auto pb-2">
        {days.map((day) => {
          const key = toIso(day);
          return (
            <DayColumn key={key} day={day} dayCalls={byDate[key] ?? []}
              isToday={key === todayIso} isPast={key < todayIso}
              todayIso={todayIso} nowHHMM={nowHHMM} isTeamView={isTeamView}
              onEdit={onEdit} onOpenContact={onOpenContact} />
          );
        })}
      </div>
    </>
  );
}

// ─── Quarter view ─────────────────────────────────────────────────────────────

function QuarterMonthColumn({
  monthIndex, year, calls, isTeamView, todayIso, onEdit, onOpenContact,
}: {
  monthIndex: number; year: number; calls: DiscoveryCallRow[]; isTeamView: boolean;
  todayIso: string;
  onEdit: (c: DiscoveryCallRow) => void; onOpenContact: (c: DiscoveryCallRow) => void;
}) {
  const monthKey  = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  const monthName = new Date(year, monthIndex, 1).toLocaleDateString("en-GB", { month: "long" });
  const isPastMonth = monthKey < todayIso.slice(0, 7);
  const isCurrentMonth = monthKey === todayIso.slice(0, 7);
  const nowHHMM = currentTimeHHMM();

  const monthCalls = calls.filter((c) => c.interview_date?.startsWith(monthKey));

  // Group by date
  const byDate = React.useMemo(() => {
    const map: Record<string, DiscoveryCallRow[]> = {};
    for (const call of monthCalls) {
      const key = call.interview_date!;
      if (!map[key]) map[key] = [];
      map[key].push(call);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => (a.interview_time ?? "").localeCompare(b.interview_time ?? ""));
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calls, monthKey]);

  const sortedDates = Object.keys(byDate).sort();

  return (
    <div className="flex flex-col min-w-[220px] flex-1">
      {/* Month header */}
      <div className={`shrink-0 rounded-xl px-4 py-3.5 mb-3 border ${
        isCurrentMonth ? "bg-primary/6 border-primary/30" : isPastMonth ? "bg-background-subtle/60 border-border/60" : "bg-background border-border"
      }`}>
        <div className="flex items-start justify-between">
          <div>
            <p className={`text-base font-bold ${isCurrentMonth ? "text-primary" : isPastMonth ? "text-foreground-muted" : "text-foreground"}`}>
              {monthName}
            </p>
            <p className="text-xs text-foreground-muted mt-0.5">{year}</p>
          </div>
          <div className="text-right">
            <p className={`text-2xl font-black leading-none ${monthCalls.length > 0 ? (isCurrentMonth ? "text-primary" : "text-foreground") : "text-foreground-muted/25"}`}>
              {monthCalls.length}
            </p>
            <p className="text-[10px] text-foreground-muted">interview{monthCalls.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        {/* Result mini breakdown */}
        {monthCalls.length > 0 && (() => {
          const q = monthCalls.filter((c) => c.result === "qualified").length;
          const n = monthCalls.filter((c) => c.result === "nurture").length;
          const nq = monthCalls.filter((c) => c.result === "not_qualified").length;
          return (
            <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
              {q  > 0 && <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full">✓ {q} Qualified</span>}
              {n  > 0 && <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full">~ {n} Nurture</span>}
              {nq > 0 && <span className="text-[10px] font-semibold bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full">✕ {nq} Not qualified</span>}
            </div>
          );
        })()}
      </div>

      {/* Date groups */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-0.5">
        {sortedDates.length === 0 ? (
          <div className="h-28 rounded-xl border-2 border-dashed border-border/40 flex flex-col items-center justify-center gap-1.5">
            <RiCalendarLine size={16} className="text-foreground-muted/30" />
            <p className="text-[11px] text-foreground-muted/30 italic">No interviews</p>
          </div>
        ) : sortedDates.map((dateKey) => {
          const dayDate = new Date(dateKey + "T00:00:00");
          const isToday = dateKey === todayIso;
          const isPast  = dateKey < todayIso;
          const dayLabel = dayDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });

          return (
            <div key={dateKey}>
              {/* Date divider */}
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  isToday ? "bg-primary text-white" : isPast ? "text-foreground-muted/60 bg-background-subtle" : "text-foreground-muted bg-background-subtle"
                }`}>
                  {dayLabel}{isToday ? " · Today" : ""}
                </span>
                <div className="flex-1 h-px bg-border/60" />
              </div>
              {/* Cards */}
              <div className="space-y-2">
                {byDate[dateKey].map((call) => {
                  const isOverdue = (dateKey < todayIso) ||
                    (isToday && !!call.interview_time && call.interview_time.slice(0, 5) < nowHHMM && call.stage === "scheduled");
                  return (
                    <ScheduleCard key={call.id} call={call} isOverdue={isOverdue} isTeamView={isTeamView}
                      onEdit={onEdit} onOpenContact={onOpenContact} />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuarterView({
  calls, isTeamView, onEdit, onOpenContact,
}: {
  calls: DiscoveryCallRow[]; isTeamView: boolean;
  onEdit: (c: DiscoveryCallRow) => void; onOpenContact: (c: DiscoveryCallRow) => void;
}) {
  const now = new Date();
  const [quarter, setQuarter] = React.useState<1 | 2 | 3 | 4>(() => getQuarterNum(now));
  const [year, setYear]       = React.useState(() => now.getFullYear());

  const todayIso       = todayIsoFn();
  const monthIndices   = getQuarterMonthIndices(quarter);
  const isCurrentQ     = quarter === getQuarterNum(now) && year === now.getFullYear();

  const quarterCalls = calls.filter((c) => {
    if (!c.interview_date) return false;
    const m = parseInt(c.interview_date.slice(5, 7), 10) - 1;
    const y = parseInt(c.interview_date.slice(0, 4), 10);
    return y === year && monthIndices.includes(m);
  });

  const label = `Q${quarter} ${year}`;
  const sub   = quarterCalls.length === 0 ? "No interviews" : `${quarterCalls.length} interview${quarterCalls.length !== 1 ? "s" : ""}`;

  return (
    <>
      <NavBar
        label={label}
        sub={sub}
        isCurrent={isCurrentQ}
        onPrev={() => { const r = shiftQuarter(quarter, year, -1); setQuarter(r.quarter); setYear(r.year); }}
        onNext={() => { const r = shiftQuarter(quarter, year,  1); setQuarter(r.quarter); setYear(r.year); }}
        onToday={() => { setQuarter(getQuarterNum(new Date())); setYear(new Date().getFullYear()); }}
      />
      <div className="flex-1 flex gap-3 overflow-x-auto pb-2">
        {monthIndices.map((mi) => (
          <QuarterMonthColumn key={mi} monthIndex={mi} year={year}
            calls={calls} isTeamView={isTeamView} todayIso={todayIso}
            onEdit={onEdit} onOpenContact={onOpenContact} />
        ))}
      </div>
    </>
  );
}

// ─── Year view ────────────────────────────────────────────────────────────────

function ResultMiniBar({ count, total, color }: { count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="h-1 rounded-full bg-background-muted overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function YearView({
  calls, onSwitchToQuarter,
}: {
  calls: DiscoveryCallRow[];
  onSwitchToQuarter: (q: 1 | 2 | 3 | 4, year: number) => void;
}) {
  const now = new Date();
  const [year, setYear] = React.useState(() => now.getFullYear());

  const todayIso       = todayIsoFn();
  const currentMonthKey = todayIso.slice(0, 7);
  const isCurrentYear  = year === now.getFullYear();

  const months = Array.from({ length: 12 }, (_, i) => i);

  // Compute per-month stats
  const monthStats = React.useMemo(() => {
    return months.map((mi) => {
      const key = `${year}-${String(mi + 1).padStart(2, "0")}`;
      const mc  = calls.filter((c) => c.interview_date?.startsWith(key));
      return {
        key,
        total:        mc.length,
        qualified:    mc.filter((c) => c.result === "qualified").length,
        nurture:      mc.filter((c) => c.result === "nurture").length,
        notQualified: mc.filter((c) => c.result === "not_qualified").length,
        pending:      mc.filter((c) => c.result === "pending").length,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calls, year]);

  const yearTotal = monthStats.reduce((n, m) => n + m.total, 0);
  const yearLabel = `${year}`;
  const yearSub   = yearTotal === 0 ? "No interviews" : `${yearTotal} interview${yearTotal !== 1 ? "s" : ""} this year`;

  return (
    <>
      <NavBar
        label={yearLabel}
        sub={yearSub}
        isCurrent={isCurrentYear}
        onPrev={() => setYear((y) => y - 1)}
        onNext={() => setYear((y) => y + 1)}
        onToday={() => setYear(new Date().getFullYear())}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pb-4">
          {months.map((mi) => {
            const stats        = monthStats[mi];
            const monthName    = new Date(year, mi, 1).toLocaleDateString("en-GB", { month: "long" });
            const isCurrent    = stats.key === currentMonthKey;
            const isPast       = stats.key < currentMonthKey;
            const quarter      = (Math.floor(mi / 3) + 1) as 1 | 2 | 3 | 4;

            return (
              <div
                key={mi}
                onClick={() => onSwitchToQuarter(quarter, year)}
                className={`rounded-xl border p-4 cursor-pointer group transition-all hover:shadow-md hover:-translate-y-0.5 ${
                  isCurrent
                    ? "border-primary/40 bg-primary/4 shadow-sm"
                    : isPast
                    ? "border-border bg-background-subtle/40 opacity-75 hover:opacity-100"
                    : "border-border bg-background"
                }`}
              >
                {/* Month name + Q label */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className={`text-sm font-bold ${isCurrent ? "text-primary" : "text-foreground"}`}>{monthName}</p>
                    <p className="text-[10px] text-foreground-muted mt-0.5">Q{quarter} · click to view</p>
                  </div>
                  <p className={`text-3xl font-black leading-none ${
                    stats.total > 0 ? (isCurrent ? "text-primary" : "text-foreground") : "text-foreground-muted/20"
                  }`}>
                    {stats.total}
                  </p>
                </div>

                {/* Result bars */}
                {stats.total > 0 ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-foreground-muted w-16 shrink-0">Qualified</span>
                      <div className="flex-1"><ResultMiniBar count={stats.qualified} total={stats.total} color="bg-emerald-400" /></div>
                      <span className="text-[10px] font-semibold text-emerald-700 w-4 text-right">{stats.qualified}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-foreground-muted w-16 shrink-0">Nurture</span>
                      <div className="flex-1"><ResultMiniBar count={stats.nurture} total={stats.total} color="bg-amber-400" /></div>
                      <span className="text-[10px] font-semibold text-amber-700 w-4 text-right">{stats.nurture}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-foreground-muted w-16 shrink-0">Not qual.</span>
                      <div className="flex-1"><ResultMiniBar count={stats.notQualified} total={stats.total} color="bg-red-400" /></div>
                      <span className="text-[10px] font-semibold text-red-600 w-4 text-right">{stats.notQualified}</span>
                    </div>
                    {stats.pending > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-foreground-muted w-16 shrink-0">Pending</span>
                        <div className="flex-1"><ResultMiniBar count={stats.pending} total={stats.total} color="bg-foreground-muted/30" /></div>
                        <span className="text-[10px] font-semibold text-foreground-muted w-4 text-right">{stats.pending}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-foreground-muted/40 italic">No interviews</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── Shared nav bar ───────────────────────────────────────────────────────────

function NavBar({
  label, sub, isCurrent, onPrev, onNext, onToday,
}: {
  label: string; sub: string; isCurrent: boolean;
  onPrev: () => void; onNext: () => void; onToday: () => void;
}) {
  return (
    <div className="flex items-center gap-2 mb-4 shrink-0">
      <button onClick={onPrev} className="size-8 flex items-center justify-center rounded-full border border-border hover:bg-background-subtle transition-colors">
        <RiArrowLeftSLine size={16} />
      </button>
      <button
        onClick={onToday}
        className={`px-3 h-8 rounded-full border text-xs font-semibold transition-colors ${
          isCurrent ? "border-primary bg-primary/8 text-primary" : "border-border hover:bg-background-subtle text-foreground"
        }`}
      >
        Today
      </button>
      <button onClick={onNext} className="size-8 flex items-center justify-center rounded-full border border-border hover:bg-background-subtle transition-colors">
        <RiArrowRightSLine size={16} />
      </button>
      <span className="text-sm font-semibold ml-1">{label}</span>
      <span className="text-xs text-foreground-muted">· {sub}</span>
    </div>
  );
}

// ─── Root schedule view ───────────────────────────────────────────────────────

interface ScheduleViewProps {
  calls: DiscoveryCallRow[];
  isTeamView?: boolean;
  onEdit: (call: DiscoveryCallRow) => void;
  onOpenContact: (call: DiscoveryCallRow) => void;
}

export function ScheduleView({ calls, isTeamView = false, onEdit, onOpenContact }: ScheduleViewProps) {
  const [range, setRange] = React.useState<ScheduleRange>("week");
  const [filterOwnerId, setFilterOwnerId] = React.useState<string | null>(null);

  // For year → quarter drill-down
  const [drillQuarter, setDrillQuarter] = React.useState<{ q: 1 | 2 | 3 | 4; year: number } | null>(null);

  // Extract unique owners from all calls
  const owners = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const call of calls) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ownerId = (call as any).owner_id as string | undefined;
      const owner   = call.owner as { display_name: string | null; email: string | null } | undefined;
      if (ownerId && !map.has(ownerId)) {
        const name = owner?.display_name ?? owner?.email?.split("@")[0] ?? "?";
        map.set(ownerId, { id: ownerId, name });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [calls]);

  // Apply owner filter — auto-ignores stale IDs without needing a side-effect reset
  const filteredCalls = React.useMemo(() => {
    if (!filterOwnerId) return calls;
    const ownerStillExists = owners.some((o) => o.id === filterOwnerId);
    if (!ownerStillExists) return calls;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return calls.filter((c) => (c as any).owner_id === filterOwnerId);
  }, [calls, filterOwnerId, owners]);

  function handleSwitchToQuarter(q: 1 | 2 | 3 | 4, year: number) {
    setDrillQuarter({ q, year });
    setRange("quarter");
  }

  const showOwnerFilter = isTeamView;

  return (
    <div className="flex flex-col h-full">
      {/* ── Toolbar: range toggle + owner filter ── */}
      <div className="flex items-center gap-3 mb-4 shrink-0 flex-wrap">
        {/* Range toggle */}
        <div className="flex items-center rounded-full border border-border bg-background-subtle p-1">
          {(["week", "quarter", "year"] as ScheduleRange[]).map((r) => (
            <button
              key={r}
              onClick={() => { setRange(r); setDrillQuarter(null); }}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${
                range === r ? "bg-background shadow-sm text-foreground" : "text-foreground-muted hover:text-foreground"
              }`}
            >
              {r === "quarter" ? "Quarter" : r === "year" ? "Year" : "Week"}
            </button>
          ))}
        </div>

        {/* Owner filter — only shown when there are multiple owners */}
        {showOwnerFilter && (
          <>
            <div className="h-5 w-px bg-border" />
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* All chip */}
              <button
                onClick={() => setFilterOwnerId(null)}
                className={`h-8 px-3 rounded-full text-xs font-semibold border transition-colors ${
                  filterOwnerId === null
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-foreground-muted hover:border-foreground-muted hover:text-foreground"
                }`}
              >
                All
              </button>

              {/* Per-owner chips */}
              {owners.map((owner) => {
                const ini  = owner.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
                const tone = OWNER_TONES[owner.name.charCodeAt(0) % OWNER_TONES.length];
                const isActive = filterOwnerId === owner.id;
                return (
                  <button
                    key={owner.id}
                    onClick={() => setFilterOwnerId(isActive ? null : owner.id)}
                    className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold border transition-colors ${
                      isActive
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-foreground-muted hover:border-foreground-muted hover:text-foreground"
                    }`}
                  >
                    <div className={`size-4 rounded-full ${tone} flex items-center justify-center text-[8px] font-bold text-white shrink-0`}>
                      {ini}
                    </div>
                    {owner.name}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── View content ── */}
      {range === "week" && (
        <WeekView calls={filteredCalls} isTeamView={isTeamView} onEdit={onEdit} onOpenContact={onOpenContact} />
      )}
      {range === "quarter" && (
        <QuarterView
          key={drillQuarter ? `${drillQuarter.q}-${drillQuarter.year}` : "default"}
          calls={filteredCalls} isTeamView={isTeamView} onEdit={onEdit} onOpenContact={onOpenContact}
        />
      )}
      {range === "year" && (
        <YearView calls={filteredCalls} onSwitchToQuarter={handleSwitchToQuarter} />
      )}
    </div>
  );
}
