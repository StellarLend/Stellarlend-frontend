import React, { ReactNode } from "react";

export type PageHeaderTone = "light" | "dark";

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  tone?: PageHeaderTone;
  as?: "h1" | "h2";
  id?: string;
  className?: string;
}

const toneStyles: Record<PageHeaderTone, { title: string; description: string }> = {
  light: {
    title: "text-slate-900",
    description: "text-slate-500",
  },
  dark: {
    title: "text-white",
    description: "text-white/80",
  },
};

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  actions,
  tone = "dark",
  as: HeadingTag = "h1",
  id,
  className = "",
}) => {
  const headingId = id ?? `page-header-${title.toLowerCase().replace(/\s+/g, "-")}`;
  const descriptionId = description ? `${headingId}-description` : undefined;
  const styles = toneStyles[tone];

  return (
    <header
      role="banner"
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
      className={`mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between ${className}`}
    >
      <div className="min-w-0">
        <HeadingTag
          id={headingId}
          className={`text-2xl font-bold leading-tight md:text-3xl ${styles.title}`}
        >
          {title}
        </HeadingTag>
        {description ? (
          <p
            id={descriptionId}
            className={`mt-2 max-w-2xl text-sm md:text-base ${styles.description}`}
          >
            {description}
          </p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center md:w-auto md:flex-shrink-0">
          {actions}
        </div>
      ) : null}
    </header>
  );
};

export default PageHeader;
