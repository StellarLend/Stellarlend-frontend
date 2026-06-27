import React, { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { colors } from "@/constants/design-tokens";

export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  className = "",
}) => {
  return (
    <section
      className={`flex w-full flex-col items-center justify-center gap-5 rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center ${className}`}
    >
      <div
        className="grid h-16 w-16 place-items-center rounded-full"
        style={{ backgroundColor: colors.primary[50] }}
      >
        {icon ?? <Sparkles className="h-8 w-8 text-[#15A350]" aria-hidden="true" />}
      </div>

      <div className="max-w-xl">
        <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      </div>

      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-95"
          style={{ backgroundColor: colors.primary[500] }}
        >
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
};
