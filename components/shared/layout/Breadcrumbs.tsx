"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Human-readable labels for known path segments. Dynamic IDs fall back to "Details". */
const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  transactions: "Transactions",
  loan: "Loan",
  lending: "Lending",
  settings: "Settings",
  account: "Account",
  profile: "Profile",
  notifications: "Notifications",
  markets: "Markets",
};

/** Returns a readable label for a URL segment. */
function labelFor(segment: string): string {
  return SEGMENT_LABELS[segment.toLowerCase()] ?? toTitleCase(segment);
}

function toTitleCase(s: string): string {
  // If it looks like a UUID / numeric ID, return "Details"
  if (/^[0-9a-f-]{8,}$/i.test(s) || /^\d+$/.test(s)) return "Details";
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ");
}

export interface BreadcrumbItem {
  label: string;
  href: string;
}

export interface BreadcrumbsProps {
  /** Override auto-derived crumbs (useful in stories / tests). */
  items?: BreadcrumbItem[];
  className?: string;
}

/**
 * Breadcrumbs — derives a trail from the current pathname via `usePathname`.
 * Renders an accessible `<nav aria-label="Breadcrumb">` with structured data.
 *
 * Example: /dashboard/transactions/abc123
 *   → Home / Dashboard / Transactions / Details
 */
export const Breadcrumbs = ({ items, className = "" }: BreadcrumbsProps) => {
  const pathname = usePathname();

  const crumbs: BreadcrumbItem[] = items ?? buildCrumbs(pathname ?? "/");

  if (crumbs.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-1 text-sm text-[#AAABAB]">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li key={crumb.href} className="flex items-center gap-1">
              {index > 0 && (
                <span aria-hidden="true" className="select-none">
                  /
                </span>
              )}
              {isLast ? (
                <span aria-current="page" className="font-semibold text-white">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#15A350] focus-visible:ring-offset-1 rounded"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

/** Builds breadcrumb items from a pathname string. */
export function buildCrumbs(pathname: string): BreadcrumbItem[] {
  // Normalise: strip trailing slash, ensure leading slash
  const normalised = pathname.replace(/\/+$/, "") || "/";
  const segments = normalised.split("/").filter(Boolean);

  const crumbs: BreadcrumbItem[] = [{ label: "Home", href: "/" }];

  let accumulated = "";
  for (const segment of segments) {
    accumulated += `/${segment}`;
    crumbs.push({ label: labelFor(segment), href: accumulated });
  }

  return crumbs;
}
