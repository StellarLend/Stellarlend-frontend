/**
 * NavigationMenu — route existence test
 *
 * For every entry in the NavigationMenu `links` array that has a `path`
 * property, this test asserts that a corresponding Next.js App Router
 * `page.tsx` file exists on disk.
 *
 * The test is deliberately kept as a pure filesystem check (no rendering,
 * no mocks) so it never false-positives when mocked routes are present and
 * never false-negatives when a page exists but its component has a bug.
 *
 * Run with: npm test (included in the `accessibility` vitest project via
 * the `components/shared/layout/**\/*.test.tsx` glob)
 */

import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs";

// ── Inline the routed links ────────────────────────────────────────────────
// Keep in sync with the `links` array in NavigationMenu.tsx.
// Log Out is an action (POST /api/auth/logout), not a page route.
const ROUTED_NAV_LINKS = [
  { link: "Dashboard", path: "/dashboard" },
  { link: "Fundwallet", path: "/dashboard/wallet" },
  { link: "Loan", path: "/dashboard/loan" },
  { link: "Lending", path: "/lending" },
  { link: "Cash and receipt", path: "/dashboard/cash" },
  { link: "Transactions", path: "/dashboard/transactions" },
  { link: "Notification", path: "/dashboard/notifications" },
  { link: "Settings", path: "/dashboard/settings" },
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────

/** Convert a URL path like "/dashboard/loan" to the absolute filesystem path
 *  for the Next.js App Router page file: <repo-root>/app/dashboard/loan/page.tsx */
function navPathToPageFile(navPath: string): string {
  // Strip leading slash, join with repo root app/ directory
  const relative = navPath.startsWith("/") ? navPath.slice(1) : navPath;
  return path.resolve(
    __dirname,           // components/shared/layout  →
    "..",                // components/shared
    "..",                // components
    "..",                // repo root
    "app",
    relative,
    "page.tsx"
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("NavigationMenu — all routed nav paths resolve to a real page", () => {
  it.each(ROUTED_NAV_LINKS)(
    'nav item "$link" → $path  resolves to app$path/page.tsx',
    ({ link: _link, path: navPath }) => {
      const absolutePath = navPathToPageFile(navPath);
      const exists = fs.existsSync(absolutePath);
      expect(
        exists,
        `Missing page file for nav path "${navPath}".\n` +
          `Expected: ${absolutePath}\n` +
          `Create the file or update the NavigationMenu path to point at an existing route.`
      ).toBe(true);
    }
  );
});
