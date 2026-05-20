"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { RiArrowDownSLine, RiArrowUpSLine, RiCheckLine } from "@remixicon/react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface SelectProps {
  value: string;
  onChange: (val: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Select({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled = false,
  className = "",
}: SelectProps) {
  const [open, setOpen] = React.useState(false);

  const selected = options.find((o) => o.value === value) ?? null;

  const triggerClass = [
    "h-10 w-full inline-flex items-center justify-between gap-3 rounded-full border px-[18px] text-sm outline-none transition-colors",
    open
      ? "border-primary ring-[3px] ring-primary/10 bg-white"
      : "border-border bg-white hover:border-foreground-muted/50",
    disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
    className,
  ].join(" ");

  return (
    <Popover.Root open={open} onOpenChange={disabled ? undefined : setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={triggerClass}
        >
          <span className="flex items-center gap-2.5 min-w-0">
            {selected && (
              <span
                className="shrink-0"
                style={{ width: 4, height: 16, borderRadius: 9999, backgroundColor: "#16DAC1" }}
              />
            )}
            <span
              className="truncate"
              style={{
                fontWeight: selected ? 600 : 500,
                color: selected ? "#1B1B1B" : "#8D8D8D",
              }}
            >
              {selected ? selected.label : placeholder}
            </span>
          </span>
          {open
            ? <RiArrowUpSLine size={14} className="text-foreground-muted shrink-0" />
            : <RiArrowDownSLine size={14} className="text-foreground-muted shrink-0" />
          }
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          sideOffset={4}
          align="start"
          avoidCollisions
          style={{
            width: "var(--radix-popover-trigger-width)",
            borderRadius: 10,
            boxShadow: "0px 8px 24px rgba(93,100,99,0.14)",
            border: "1px solid #DEE8E8",
            backgroundColor: "#FFFFFF",
            zIndex: 99999,
            outline: "none",
          }}
        >
          <div
            style={{
              padding: 6,
              maxHeight: 280,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className="w-full flex items-center justify-between gap-2.5 text-left transition-colors"
                  style={{
                    borderRadius: 8,
                    padding: "10px 12px",
                    backgroundColor: isSelected ? "#EDF8F8" : undefined,
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected)
                      (e.currentTarget as HTMLElement).style.backgroundColor = "#F5FAFA";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected)
                      (e.currentTarget as HTMLElement).style.backgroundColor = "";
                  }}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="shrink-0"
                      style={{
                        width: 4,
                        height: 16,
                        borderRadius: 9999,
                        backgroundColor: isSelected ? "#16DAC1" : "#DEE8E8",
                      }}
                    />
                    <span className="flex flex-col gap-px min-w-0 text-left">
                      <span
                        className="truncate"
                        style={{
                          fontSize: 13,
                          fontWeight: isSelected ? 600 : 500,
                          color: "#1B1B1B",
                          lineHeight: "16px",
                        }}
                      >
                        {opt.label}
                      </span>
                      {opt.sublabel && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 500,
                            color: "#8D8D8D",
                            lineHeight: "14px",
                          }}
                        >
                          {opt.sublabel}
                        </span>
                      )}
                    </span>
                  </span>
                  {isSelected && (
                    <RiCheckLine size={14} className="shrink-0" style={{ color: "#16DAC1" }} />
                  )}
                </button>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
