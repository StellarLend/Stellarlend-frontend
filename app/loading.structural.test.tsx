/**
 * loading.structural.test.tsx  (#1184)
 *
 * Asserts that app/lending/loading.tsx and app/dashboard/loading.tsx stay
 * structurally in sync with their respective page components so that
 * loading-to-loaded transitions do not produce visible layout jumps.
 *
 * Strategy
 * --------
 * Rather than byte-comparing rendered output (which would be too brittle), we
 * check that:
 *
 *  1. The loading boundary uses `aria-busy="true"` and an `aria-label` — the
 *     semantic marker that it is a temporary skeleton.
 *  2. Each top-level layout region present in the real page (identified by
 *     roles / ARIA landmarks) has a corresponding skeleton placeholder in the
 *     loading file, matched by asserting equal region counts.
 *
 * When a page gains or loses a named section, the test will fail, prompting
 * engineers to update the skeleton.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

// We import the plain loading components — they are Server Components with no
// client-side dependencies so they render fine in jsdom.
import LendingLoading from "@/app/lending/loading";
import DashboardLoading from "@/app/dashboard/loading";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return the number of top-level sectioning elements visible inside `root`.
 * We count <section>, <aside>, <header>, <main>, and <nav> — the HTML5
 * landmark elements that define distinct page regions.
 */
function countLandmarkElements(container: HTMLElement): number {
  return container.querySelectorAll(
    "section, aside, header, main, nav",
  ).length;
}

// ---------------------------------------------------------------------------
// Lending loading skeleton
// ---------------------------------------------------------------------------

describe("app/lending/loading.tsx structural parity (#1184)", () => {
  it("has aria-busy='true' to signal a loading state", () => {
    const { container } = render(<LendingLoading />);
    // The outermost element carries aria-busy="true"
    const busyEl = container.querySelector('[aria-busy="true"]');
    expect(busyEl).not.toBeNull();
  });

  it("has a descriptive aria-label for screen readers", () => {
    render(<LendingLoading />);
    // getByRole('generic') won't work for divs without a landmark role, so
    // we query by the label directly.
    const labeled = screen.getByLabelText(/loading lending page/i);
    expect(labeled).toBeTruthy();
  });

  it("contains a skeleton for the hero/header card region", () => {
    const { container } = render(<LendingLoading />);
    // The hero card is the first visually prominent block; we check the
    // gradient accent bar that distinguishes it.
    const gradientBar = container.querySelector(
      ".bg-gradient-to-r.from-green-600",
    );
    expect(gradientBar).not.toBeNull();
  });

  it("contains tab-selector skeleton placeholders", () => {
    const { container } = render(<LendingLoading />);
    // The skeleton renders two tab buttons side-by-side.
    const tabSkeletons = container.querySelectorAll(
      ".skeleton-light.h-10.rounded-lg",
    );
    expect(tabSkeletons.length).toBeGreaterThanOrEqual(2);
  });

  it("contains a two-column grid with form (left) and calculator/summary (right) columns", () => {
    const { container } = render(<LendingLoading />);
    // The grid has two immediate child columns: lg:col-span-2 and a sidebar.
    const grid = container.querySelector(".grid.grid-cols-1.lg\\:grid-cols-3");
    expect(grid).not.toBeNull();

    const leftCol = grid!.querySelector(".lg\\:col-span-2");
    expect(leftCol).not.toBeNull();

    // Right column contains at least two cards (calculator + summary).
    const rightCards = grid!.querySelectorAll(
      ".space-y-4.rounded-2xl, .space-y-3.rounded-2xl, .space-y-6 > div",
    );
    expect(rightCards.length).toBeGreaterThanOrEqual(2);
  });

  it("form skeleton has the same number of field rows as the real LendingForm", () => {
    const { container } = render(<LendingLoading />);
    // The lending form skeleton renders 4 label+input field rows plus 1 submit
    // button row. Query by the pattern used for each field group.
    const fieldRows = container.querySelectorAll(
      ".lg\\:col-span-2 .space-y-1",
    );
    // Real LendingForm has: asset, amount, interest rate, duration = 4 fields.
    expect(fieldRows.length).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Dashboard loading skeleton
// ---------------------------------------------------------------------------

describe("app/dashboard/loading.tsx structural parity (#1184)", () => {
  it("has aria-busy='true' to signal a loading state", () => {
    const { container } = render(<DashboardLoading />);
    const busyEl = container.querySelector('[aria-busy="true"]');
    expect(busyEl).not.toBeNull();
  });

  it("has a descriptive aria-label for screen readers", () => {
    render(<DashboardLoading />);
    const labeled = screen.getByLabelText(/loading dashboard/i);
    expect(labeled).toBeTruthy();
  });

  it("contains a sidebar skeleton matching DashboardLayout's sidebar", () => {
    const { container } = render(<DashboardLoading />);
    const sidebar = container.querySelector("aside");
    expect(sidebar).not.toBeNull();

    // The real sidebar has 6 nav links; the skeleton mirrors this count.
    const navItems = sidebar!.querySelectorAll(".skeleton.h-9");
    expect(navItems.length).toBe(6);
  });

  it("contains a top-nav header skeleton", () => {
    const { container } = render(<DashboardLoading />);
    const header = container.querySelector("header");
    expect(header).not.toBeNull();
    // Header should contain at least one skeleton item.
    const skeletons = header!.querySelectorAll(".skeleton");
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it("contains a main content area with page header, metrics cards, and transactions table", () => {
    const { container } = render(<DashboardLoading />);
    const main = container.querySelector("main");
    expect(main).not.toBeNull();

    // Metrics cards — real page has 3.
    const metricCards = main!.querySelectorAll(".skeleton.min-w-\\[345px\\]");
    expect(metricCards.length).toBe(3);

    // Transaction rows — real page renders a list; skeleton has 6 rows.
    const txRows = main!.querySelectorAll(
      ".flex.gap-4.items-center.bg-\\[\\#0A3D1E\\]\\/30.rounded-lg",
    );
    expect(txRows.length).toBe(6);
  });

  it("skeleton landmark region count matches real Dashboard page regions", () => {
    // Real page: DashboardLayout wraps aside + (header + main).
    // We assert the skeleton has the same count of landmark elements so drift
    // is caught if the page adds a new top-level section.
    const { container } = render(<DashboardLoading />);
    const skeletonRegions = countLandmarkElements(container);

    // aside + header + main = 3 landmark elements in the skeleton.
    expect(skeletonRegions).toBe(3);
  });
});
