import React from "react";
import { cn } from "./utils";

export type BadgeVariant = "neutral" | "positive" | "warning" | "danger";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const badgeVariants: Record<BadgeVariant, string> = {
  neutral: "border border-[var(--line)] text-[var(--mut)] bg-transparent",
  positive: "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  warning: "border border-amber-500/20 bg-amber-500/10 text-amber-400",
  danger: "border border-red-500/20 bg-red-500/10 text-red-400",
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "neutral", children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
          badgeVariants[variant],
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = "Badge";
