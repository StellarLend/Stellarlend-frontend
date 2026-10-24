import React from "react";
import { cn } from "./utils";

export type StatTone = "neutral" | "positive" | "warning" | "danger";

export interface StatProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: React.ReactNode;
  value?: React.ReactNode;
  k?: React.ReactNode;
  v?: React.ReactNode;
  tone?: StatTone | string;
}

const toneClasses: Record<StatTone, string> = {
  neutral: "",
  positive: "text-emerald-400",
  warning: "text-amber-400",
  danger: "text-red-400",
};

const toneLabels: Record<StatTone, string> = {
  neutral: "",
  positive: "positive",
  warning: "warning",
  danger: "danger",
};

export const Stat = React.forwardRef<HTMLDivElement, StatProps>(
  ({ className, label, value, k, v, tone = "neutral", ...props }, ref) => {
    const finalLabel = label ?? k;
    const finalValue = value ?? v;

    const isNamedTone = tone in toneClasses;
    const toneClass = isNamedTone
      ? toneClasses[tone as StatTone]
      : (tone as string);

    const srTone = isNamedTone
      ? toneLabels[tone as StatTone]
      : tone.includes("red")
      ? "danger"
      : tone.includes("emerald") || tone.includes("green")
      ? "positive"
      : tone.includes("amber") || tone.includes("yellow")
      ? "warning"
      : "";

    return (
      <div ref={ref} className={cn("space-y-0.5", className)} {...props}>
        <div className="mut text-sm">{finalLabel}</div>
        <div className={cn("text-lg font-semibold", toneClass)}>
          {finalValue}
          {srTone && (
            <span className="sr-only"> ({srTone})</span>
          )}
        </div>
      </div>
    );
  }
);

Stat.displayName = "Stat";
