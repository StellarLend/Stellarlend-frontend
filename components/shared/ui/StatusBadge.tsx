import React, { ReactNode } from "react";
import { CheckCircle2, Clock3, XCircle, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type StatusVariant = "success" | "pending" | "failed" | "neutral";
export type StatusBadgeSize = "sm" | "md";

export interface StatusBadgeProps {
  variant: StatusVariant;
  label?: string;
  size?: StatusBadgeSize;
  icon?: ReactNode;
  className?: string;
}

interface VariantConfig {
  classes: string;
  defaultLabel: string;
  ariaPrefix: string;
  Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}

const VARIANT_CONFIG: Record<StatusVariant, VariantConfig> = {
  success: {
    classes:
      "bg-green-100 text-green-800 ring-green-600/30 dark:bg-green-900/40 dark:text-green-100",
    defaultLabel: "Completed",
    ariaPrefix: "Status: success",
    Icon: CheckCircle2,
  },
  pending: {
    classes:
      "bg-amber-100 text-amber-900 ring-amber-700/30 dark:bg-amber-900/40 dark:text-amber-50",
    defaultLabel: "Processing",
    ariaPrefix: "Status: pending",
    Icon: Clock3,
  },
  failed: {
    classes:
      "bg-red-100 text-red-800 ring-red-600/30 dark:bg-red-900/40 dark:text-red-100",
    defaultLabel: "Failed",
    ariaPrefix: "Status: failed",
    Icon: XCircle,
  },
  neutral: {
    classes:
      "bg-slate-100 text-slate-800 ring-slate-500/30 dark:bg-slate-800 dark:text-slate-100",
    defaultLabel: "Unknown",
    ariaPrefix: "Status",
    Icon: CircleDot,
  },
};

const SIZE_STYLES: Record<StatusBadgeSize, { wrapper: string; icon: string }> = {
  sm: { wrapper: "text-xs px-2 py-0.5 gap-1", icon: "h-3.5 w-3.5" },
  md: { wrapper: "text-sm px-2.5 py-1 gap-1.5", icon: "h-4 w-4" },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  variant,
  label,
  size = "sm",
  icon,
  className,
}) => {
  const config = VARIANT_CONFIG[variant];
  const sizeStyles = SIZE_STYLES[size];
  const text = label ?? config.defaultLabel;
  const ariaLabel = `${config.ariaPrefix}: ${text}`;
  const IconComponent = config.Icon;

  return (
    <span
      role="status"
      aria-label={ariaLabel}
      data-variant={variant}
      className={cn(
        "inline-flex items-center rounded-full font-semibold ring-1 ring-inset",
        sizeStyles.wrapper,
        config.classes,
        className
      )}
    >
      <span aria-hidden="true" className={cn("inline-flex shrink-0", sizeStyles.icon)}>
        {icon ?? <IconComponent className={sizeStyles.icon} aria-hidden />}
      </span>
      <span>{text}</span>
    </span>
  );
};

const TRANSACTION_STATUS_TO_VARIANT: Record<string, StatusVariant> = {
  Completed: "success",
  completed: "success",
  Success: "success",
  success: "success",
  Processing: "pending",
  processing: "pending",
  Pending: "pending",
  pending: "pending",
  Failed: "failed",
  failed: "failed",
  Error: "failed",
  error: "failed",
};

export function transactionStatusToVariant(status: string): StatusVariant {
  return TRANSACTION_STATUS_TO_VARIANT[status] ?? "neutral";
}

export default StatusBadge;
