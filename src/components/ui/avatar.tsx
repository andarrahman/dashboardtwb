import * as React from "react";
import { cn } from "@/lib/utils";

const sizeMap = {
  sm: "size-7 text-xs",
  md: "size-9 text-sm",
  lg: "size-10 text-sm",
  xl: "size-14 text-base",
  "2xl": "size-20 text-xl",
  "3xl": "size-28 text-3xl font-semibold",
} as const;

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  initials: string;
  size?: keyof typeof sizeMap;
  /** Background color token utility, e.g. "bg-primary-subtle" or any tw color. */
  tone?: string;
}

/**
 * Avatar — circle with initials. No image support yet (V1 keeps it simple).
 * Default tone is primary subtle so it reads as a "person" tag without
 * looking like an action surface.
 */
export function Avatar({
  initials,
  size = "md",
  tone = "bg-primary-subtle text-foreground",
  className,
  ...props
}: AvatarProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold shrink-0",
        sizeMap[size],
        tone,
        className
      )}
      {...props}
    >
      {initials}
    </div>
  );
}
