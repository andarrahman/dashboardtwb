import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Badge — small status / category pill.
 * Variants align with semantic tokens; never use brand color as text color.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap font-medium",
  {
    variants: {
      variant: {
        primary: "bg-primary-subtle text-foreground",
        success: "bg-primary-subtle text-foreground",
        accent: "bg-accent-subtle text-foreground",
        warning: "bg-[#FFEFD2] text-foreground",
        destructive: "bg-destructive-subtle text-destructive",
        neutral: "bg-background-subtle text-foreground-subtle",
        outline: "border border-border text-foreground bg-transparent",
        external: "bg-destructive-subtle text-destructive",
        twibbonize: "bg-primary-subtle text-foreground",
      },
      size: {
        xs: "h-5 px-2 text-xs rounded-sm",
        sm: "h-6 px-2.5 text-xs rounded-md",
        md: "h-7 px-3 text-sm rounded-full",
      },
    },
    defaultVariants: { variant: "neutral", size: "sm" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
  dotColor?: string;
}

export function Badge({
  className,
  variant,
  size,
  dot,
  dotColor,
  children,
  ...props
}: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span
          className="size-1.5 rounded-full"
          style={{ backgroundColor: dotColor ?? "currentColor" }}
        />
      )}
      {children}
    </span>
  );
}
