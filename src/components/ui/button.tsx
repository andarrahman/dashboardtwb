"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Button — Twibbonize DS §4
 * - Default shape is pill (signature of the system).
 * - All buttons are font-semibold; size scales the text size.
 * - Hover darkens via *-hover token (no opacity tricks).
 * - Focus: 3px ring at 10% primary + 1px primary border.
 * - Disabled uses opacity, not gray tint.
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold",
    "transition-colors outline-none",
    "focus-visible:ring-3 focus-visible:ring-primary/10 focus-visible:border-primary",
    "disabled:opacity-50 disabled:pointer-events-none",
    "[&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-white border border-transparent hover:bg-primary-hover",
        accent:
          "bg-accent text-foreground border border-transparent hover:bg-accent-hover",
        inverse:
          "bg-foreground text-background border border-transparent hover:opacity-90",
        secondary:
          "bg-background-subtle text-foreground border border-border hover:bg-background-muted",
        ghost:
          "bg-transparent text-foreground border border-transparent hover:bg-background-subtle",
        destructive:
          "bg-destructive text-white border border-transparent hover:bg-destructive-hover",
        "destructive-outline":
          "bg-transparent text-destructive border border-destructive hover:bg-destructive-subtle",
        link:
          "bg-transparent text-foreground underline underline-offset-4 hover:text-primary-hover border-transparent",
      },
      size: {
        xs: "h-7  px-3 text-xs",
        sm: "h-9  px-3.5 text-sm",
        md: "h-11 px-5 text-sm",
        lg: "h-12 px-6 text-base",
        xl: "h-14 px-7 text-lg",
        "icon-xs": "size-7",
        "icon-sm": "size-9",
        "icon-md": "size-11",
        "icon-lg": "size-12",
        "icon-xl": "size-14",
      },
      radius: {
        pill: "rounded-full",
        rounded: "rounded-lg",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      radius: "pill",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, radius, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, radius }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };
