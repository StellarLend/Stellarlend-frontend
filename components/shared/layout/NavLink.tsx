import * as React from "react";
import Link, { type LinkProps } from "next/link";
import { usePathname } from "next/navigation";

/**
 * Invariants:
 * - `href` must be a non-empty string beginning with "/", "#", "?" or a scheme-less absolute URL.
 *   Invalid values are rejected by rendering a non-interactive <span> instead of an unsafe or broken link.
 * - Dangerous schemes (javascript:, data:, vbscript:) are never rendered as navigable links.
 * - `active` is derived deterministically from the current pathname: exact match, or prefix match on a
 *   segment boundary when `matchPrefix` is true. Explicit `active` prop overrides derivation.
 * - Rendering is pure: no state is stored, so retries and concurrent renders cannot diverge.
 * - Diagnostic warnings are emitted only in development and never include user-provided sensitive data.
 */

export interface NavLinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: LinkProps["href"] | string | null | undefined;
  /** Explicit active override. When undefined, activity is derived from the current pathname. */
  active?: boolean;
  /** When true, a link is also active for nested routes (e.g. /docs active for /docs/intro). */
  matchPrefix?: boolean;
  children?: React.ReactNode;
}

const UNSAFE_SCHEME = /^\s*(javascript|data|vbscript):/i;
const SCHEME_LIKE = /^[a-z][a-z0-9+.-]*:/i;

/** Returns true if the href is safe and well-formed for navigation. */
export function isValidNavHref(href: unknown): href is string {
  if (typeof href !== "string") return false;
  const trimmed = href.trim();
  if (trimmed.length === 0) return false;
  if (/\s/.test(trimmed)) return false;
  if (UNSAFE_SCHEME.test(trimmed)) return false;
  if (trimmed.startsWith("/") || trimmed.startsWith("#") || trimmed.startsWith("?")) return true;
  if (trimmed.startsWith("./") || trimmed.startsWith("../")) return true;
  if (SCHEME_LIKE.test(trimmed)) {
    return /^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed) || /^tel:/i.test(trimmed);
  }
  return false;
}

/** Normalizes a pathname for comparison: strips query/hash and trailing slashes (except root). */
function normalizePath(path: string): string {
  const [pathOnly] = path.split(/[?#]/);
  if (pathOnly.length > 1 && pathOnly.endsWith("/")) return pathOnly.replace(/\/+$/, "");
  return pathOnly || "/";
}

/** Pure activity derivation. Exact match, or segment-bounded prefix match when requested. */
export function isPathActive(href: string, pathname: string | null | undefined, matchPrefix = false): boolean {
  if (!pathname || !href.startsWith("/")) return false;
  const target = normalizePath(href);
  const current = normalizePath(pathname);
  if (current === target) return true;
  if (!matchPrefix) return false;
  if (target === "/") return false;
  return current.startsWith(target + "/");
}

const warnedHrefs = new Set<string>();

function warnInvalidHref(href: unknown) {
  if (process.env.NODE_ENV === "production") return;
  // Only log the type, never the raw value, to avoid leaking sensitive input.
  const key = typeof href;
  if (warnedHrefs.has(key)) return;
  warnedHrefs.add(key);
  console.warn(`[NavLink] Rejected invalid href (type: ${key}). Rendering non-interactive fallback.`);
}

export const NavLink = React.forwardRef<HTMLAnchorElement, NavLinkProps>(function NavLink(
  { href, active, matchPrefix = false, className, children, ...rest },
  ref,
) {
  const pathname = usePathname();

  if (!isValidNavHref(href)) {
    warnInvalidHref(href);
    return (
      <span
        className={className}
        aria-disabled="true"
        data-nav-invalid="true"
      >
        {children}
      </span>
    );
  }

  const isActive = active ?? isPathActive(href, pathname, matchPrefix);

  return (
    <Link
      ref={ref}
      href={href}
      className={className}
      aria-current={isActive ? "page" : undefined}
      data-active={isActive ? "true" : undefined}
      {...(rest as Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">)}
    >
      {children}
    </Link>
  );
});

export default NavLink;
