"use client";

import * as React from "react";
import { RiArrowDownSLine, RiCheckLine, RiCloseLine } from "@remixicon/react";

export interface FilterOption {
  label: string;
  value: string;
}

interface FilterDropdownProps {
  label: string;
  options: FilterOption[];
  values: string[];
  onChange: (values: string[]) => void;
}

export function FilterDropdown({ label, options, values, onChange }: FilterDropdownProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  // Close on outside click
  React.useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function toggle(val: string) {
    if (values.includes(val)) {
      onChange(values.filter((v) => v !== val));
    } else {
      onChange([...values, val]);
    }
  }

  const isActive = values.length > 0;

  // Label shown inside button
  function activeSummary() {
    if (values.length === 1) {
      return options.find((o) => o.value === values[0])?.label ?? values[0];
    }
    return `${values.length} selected`;
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={[
          "inline-flex items-center gap-2 rounded-full border h-10 px-[18px] text-sm font-medium transition-colors",
          isActive
            ? "border-primary bg-primary/8 text-primary"
            : "border-border bg-background text-foreground hover:bg-background-subtle",
        ].join(" ")}
      >
        {label}
        {isActive ? (
          <>
            <span className="font-semibold">· {activeSummary()}</span>
            <span
              role="button"
              aria-label="Clear filter"
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
              }}
              className="flex items-center justify-center size-4 rounded-full bg-primary/15 hover:bg-primary/25 transition-colors"
            >
              <RiCloseLine size={10} className="text-primary" />
            </span>
          </>
        ) : (
          <RiArrowDownSLine size={16} className="text-foreground-muted" />
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-max min-w-[220px] max-w-xs rounded-lg border border-border bg-background shadow-md overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
              {label}
            </span>
            {values.length > 0 && (
              <button
                onClick={() => onChange([])}
                className="text-xs text-foreground-muted hover:text-foreground transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {options.length === 0 ? (
            <p className="px-4 py-3 text-sm text-foreground-muted italic">No options available</p>
          ) : (
            <ul className="py-1 max-h-60 overflow-y-auto">
              {options.map((opt) => {
                const checked = values.includes(opt.value);
                return (
                  <li key={opt.value}>
                    <button
                      onClick={() => toggle(opt.value)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-background-subtle transition-colors"
                    >
                      {/* Checkbox */}
                      <span className={[
                        "flex size-4 shrink-0 items-center justify-center rounded transition-colors",
                        checked
                          ? "border border-primary bg-primary"
                          : "border-2 border-neutral-300 bg-background",
                      ].join(" ")}>
                        {checked && <RiCheckLine size={10} className="text-white" />}
                      </span>
                      <span className="whitespace-nowrap text-foreground">
                        {opt.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Footer count */}
          {values.length > 0 && (
            <div className="border-t border-border px-4 py-2.5">
              <p className="text-xs text-foreground-muted">
                {values.length} of {options.length} selected
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
