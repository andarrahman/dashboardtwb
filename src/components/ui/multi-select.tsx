"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { RiArrowDownSLine, RiArrowUpSLine, RiCheckLine } from "@remixicon/react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MultiSelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface MultiSelectProps {
  values: string[];
  onChange: (vals: string[]) => void;
  options: MultiSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Direction the dropdown opens. Default: "down" */
  position?: "up" | "down";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MultiSelect({
  values,
  onChange,
  options,
  placeholder = "Select…",
  disabled = false,
  className = "",
  position = "down",
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  function toggle(val: string) {
    if (values.includes(val)) {
      onChange(values.filter((v) => v !== val));
    } else {
      onChange([...values, val]);
    }
  }

  // Trigger label: show selected items joined, or placeholder
  const triggerLabel =
    values.length === 0
      ? null
      : values.length === 1
      ? options.find((o) => o.value === values[0])?.label ?? values[0]
      : `${values.length} selected`;

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
            {values.length > 0 && (
              <span
                className="shrink-0"
                style={{ width: 4, height: 16, borderRadius: 9999, backgroundColor: "#16DAC1" }}
              />
            )}
            <span
              className="truncate"
              style={{
                fontWeight: triggerLabel ? 600 : 500,
                color: triggerLabel ? "#1B1B1B" : "#8D8D8D",
              }}
            >
              {triggerLabel ?? placeholder}
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
          side={position === "up" ? "top" : "bottom"}
          sideOffset={4}
          align="start"
          avoidCollisions
          // Keep open when clicking inside — only close on outside click
          onInteractOutside={() => setOpen(false)}
          onOpenAutoFocus={(e) => e.preventDefault()}
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
              const isSelected = values.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggle(opt.value)}
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
                  {/* Checkmark on the RIGHT */}
                  <RiCheckLine
                    size={14}
                    style={{
                      color: "#16DAC1",
                      flexShrink: 0,
                      opacity: isSelected ? 1 : 0,
                      transition: "opacity 0.12s",
                    }}
                  />
                </button>
              );
            })}
          </div>

          {/* Footer: count + clear */}
          {values.length > 0 && (
            <div
              style={{
                padding: "8px 12px",
                borderTop: "1px solid #F0F7F7",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: 12, color: "#8D8D8D" }}>
                {values.length} selected
              </span>
              <button
                type="button"
                onClick={() => onChange([])}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#8D8D8D",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "2px 6px",
                  borderRadius: 6,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#EF4444")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#8D8D8D")}
              >
                Clear all
              </button>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
