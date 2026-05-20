import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Card — neutral surface used across dashboard widgets and tables.
 * Defaults: rounded-xl (14px), 1px border, no shadow at rest.
 * (DESIGN.md §6: light mode separates via borders, not shadows.)
 */
export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-background",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-start justify-between p-6 pb-0", className)}
      {...props}
    />
  );
}

export function CardBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6", className)} {...props} />;
}
