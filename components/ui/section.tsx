import React from "react";
import { cn } from "./utils";

export interface SectionProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  contentClassName?: string;
}

export const Section = React.forwardRef<HTMLElement, SectionProps>(
  (
    {
      className,
      title,
      description,
      actions,
      contentClassName,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <section ref={ref} className={cn("space-y-3", className)} {...props}>
        {(title || actions) && (
          <div className="flex flex-wrap items-center justify-between gap-4">
            {title && (
              typeof title === "string" ? (
                <h2 className="text-2xl font-semibold">{title}</h2>
              ) : (
                title
              )
            )}
            {actions && <div>{actions}</div>}
          </div>
        )}
        {description && (
          <p className="mut text-sm leading-relaxed">{description}</p>
        )}
        {contentClassName ? (
          <div className={contentClassName}>{children}</div>
        ) : (
          children
        )}
      </section>
    );
  }
);

Section.displayName = "Section";
