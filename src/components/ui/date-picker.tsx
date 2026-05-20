"use client";

import * as React from "react";
import * as ReactDOM from "react-dom";
import { RiCalendarLine, RiArrowDownSLine, RiArrowUpSLine, RiArrowLeftSLine, RiArrowRightSLine } from "@remixicon/react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseYMD(val: string): Date | null {
  if (!val) return null;
  const [y, m, d] = val.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function toYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplay(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay(); // 0 = Sunday
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ─── Component ────────────────────────────────────────────────────────────────

interface DatePickerProps {
  value: string;           // YYYY-MM-DD
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Direction the calendar popover opens. Default: "down" */
  position?: "up" | "down";
  /** Horizontal alignment of the calendar. Default: "start" (left-0) */
  align?: "start" | "end";
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Select date",
  disabled = false,
  className = "",
  position = "down",
  align = "start",
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState<Date | null>(null); // date selected but not yet applied
  const [popoverStyle, setPopoverStyle] = React.useState<React.CSSProperties>({});
  const containerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  const selected = parseYMD(value);
  const today = new Date();

  // Calendar view state
  const [viewYear, setViewYear] = React.useState(() => selected?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = React.useState(() => selected?.getMonth() ?? today.getMonth());

  // Sync view when value changes externally
  React.useEffect(() => {
    if (selected) {
      setViewYear(selected.getFullYear());
      setViewMonth(selected.getMonth());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // When opening, init pending from current value and compute popover position
  function handleOpen() {
    if (disabled) return;
    setPending(selected);
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const calendarHeight = 380; // approximate calendar height
      const calendarWidth = 320;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = position === "up" || spaceBelow < calendarHeight + 8;
      const top = openUp ? rect.top - calendarHeight - 8 : rect.bottom + 8;
      const left = align === "end"
        ? rect.right - calendarWidth
        : rect.left;
      setPopoverStyle({
        position: "fixed",
        top,
        left,
        zIndex: 99999,
        width: calendarWidth,
      });
    }
    setOpen(true);
  }

  // Close on outside click
  const portalRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      const target = e.target as Node;
      const inTrigger = containerRef.current?.contains(target);
      const inPortal = portalRef.current?.contains(target);
      if (!inTrigger && !inPortal) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  function handleDayClick(date: Date) {
    setPending(date);
  }

  function handleApply() {
    if (pending) onChange(toYMD(pending));
    else onChange("");
    setOpen(false);
  }

  function handleClear() {
    setPending(null);
    onChange("");
    setOpen(false);
  }

  function handleToday() {
    const t = new Date();
    setPending(t);
    setViewYear(t.getFullYear());
    setViewMonth(t.getMonth());
  }

  // Build calendar grid
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const prevMonthDays = getDaysInMonth(viewYear, viewMonth === 0 ? 11 : viewMonth - 1);

  // Build 6 weeks × 7 days grid
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < firstDay; i++) {
    const d = prevMonthDays - firstDay + 1 + i;
    const m = viewMonth === 0 ? 11 : viewMonth - 1;
    const y = viewMonth === 0 ? viewYear - 1 : viewYear;
    cells.push({ date: new Date(y, m, d), inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(viewYear, viewMonth, d), inMonth: true });
  }
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const m = viewMonth === 11 ? 0 : viewMonth + 1;
    const y = viewMonth === 11 ? viewYear + 1 : viewYear;
    cells.push({ date: new Date(y, m, d), inMonth: false });
  }

  const weeks: { date: Date; inMonth: boolean }[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  // Trigger style
  const triggerClass = [
    "h-10 w-full inline-flex items-center gap-2.5 rounded-full border px-[18px] text-sm font-medium outline-none transition-colors",
    open
      ? "border-primary ring-[3px] ring-primary/10 bg-white"
      : "border-border bg-white hover:border-foreground-muted/50",
    disabled ? "opacity-50 bg-[#F0F7F7] cursor-not-allowed" : "cursor-pointer",
    className,
  ].join(" ");

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        className={triggerClass}
      >
        <RiCalendarLine size={16} className={selected ? "text-foreground" : "text-foreground-muted"} />
        <span className={selected ? "text-foreground font-semibold flex-1 text-left" : "text-foreground-muted font-medium flex-1 text-left"}>
          {selected ? formatDisplay(selected) : placeholder}
        </span>
        {open
          ? <RiArrowUpSLine size={14} className="text-foreground-muted shrink-0" />
          : <RiArrowDownSLine size={14} className="text-foreground-muted shrink-0" />
        }
      </button>

      {/* Calendar popover — rendered via portal to escape modal overflow */}
      {open && typeof document !== "undefined" && ReactDOM.createPortal(
        <div
          ref={portalRef}
          style={{
            ...popoverStyle,
            borderRadius: 14,
            boxShadow: "0px 14px 24px rgba(93,100,99,0.12)",
            border: "1px solid #DEE8E8",
            backgroundColor: "#FFFFFF",
            overflow: "hidden",
          }}
        >
          {/* Month nav header */}
          <div
            className="flex items-center justify-between"
            style={{ padding: "14px 16px", borderBottom: "1px solid #F0F7F7" }}
          >
            <button
              type="button"
              onClick={prevMonth}
              className="flex size-7 items-center justify-center rounded-full hover:bg-[#F0F7F7] transition-colors text-foreground-muted"
            >
              <RiArrowLeftSLine size={16} />
            </button>
            <div className="flex items-center gap-1.5">
              <span style={{ fontSize: 14, fontWeight: 600, color: "#1B1B1B" }}>
                {MONTHS[viewMonth]} {viewYear}
              </span>
            </div>
            <button
              type="button"
              onClick={nextMonth}
              className="flex size-7 items-center justify-center rounded-full hover:bg-[#F0F7F7] transition-colors text-foreground-muted"
            >
              <RiArrowRightSLine size={16} />
            </button>
          </div>

          {/* Weekday labels */}
          <div
            className="flex"
            style={{ padding: "8px 12px 4px 12px" }}
          >
            {WEEKDAYS.map((d, i) => (
              <span
                key={i}
                className="flex-1 text-center"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#8D8D8D",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  lineHeight: "14px",
                }}
              >
                {d}
              </span>
            ))}
          </div>

          {/* Day grid */}
          <div style={{ padding: "4px 12px 12px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
            {weeks.map((week, wi) => (
              <div key={wi} className="flex">
                {week.map(({ date, inMonth }, di) => {
                  const isSelected = pending ? isSameDay(date, pending) : false;
                  const isToday = isSameDay(date, today);
                  return (
                    <button
                      key={di}
                      type="button"
                      onClick={() => handleDayClick(date)}
                      className="flex-1 flex items-center justify-center transition-colors"
                      style={{
                        aspectRatio: "1 / 1",
                        borderRadius: "50%",
                        fontSize: 13,
                        fontWeight: isSelected ? 700 : 500,
                        color: isSelected
                          ? "#FFFFFF"
                          : !inMonth
                          ? "#DEE8E8"
                          : "#1B1B1B",
                        backgroundColor: isSelected ? "#16DAC1" : undefined,
                        border: !isSelected && isToday ? "1.5px solid #16DAC1" : undefined,
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = "#F0F7F7";
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = "";
                      }}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-between"
            style={{
              padding: "10px 14px",
              backgroundColor: "#F8FCFC",
              borderTop: "1px solid #F0F7F7",
            }}
          >
            <button
              type="button"
              onClick={handleToday}
              className="text-sm font-medium text-foreground hover:text-primary transition-colors"
              style={{ borderRadius: 9999, padding: "6px 12px" }}
            >
              Today
            </button>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleClear}
                className="text-sm font-medium text-foreground-muted hover:text-foreground transition-colors"
                style={{ borderRadius: 9999, padding: "6px 12px" }}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ borderRadius: 9999, padding: "6px 14px", backgroundColor: "#16DAC1" }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
