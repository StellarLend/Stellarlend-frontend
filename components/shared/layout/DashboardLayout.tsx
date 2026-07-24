import React from "react";
import TopNav from "@/components/shared/layout/TopNav";
import { SideNav } from "./SideNav";

/**
 * DashboardLayout
 *
 * Orchestrates the three primary layout regions:
 *
 * 1. **SideNav** — persistent navigation sidebar (collapsible via SidebarContext).
 * 2. **TopNav** — wrapped in a `<header>` landmark for accessibility.
 * 3. **main** — full-height content slot; receives `id="main-content"` so the
 *    skip-to-content link can target it directly.
 *
 * ## Accessibility
 *
 * - A visually-hidden skip link is the **first focusable element** in the DOM.
 *   Keyboard users can press Tab once to reach it and skip directly to the
 *   main content region, bypassing the navigation and top bar.
 * - The `<header>`, `<nav>` (inside SideNav), and `<main>` landmarks are all
 *   present so screen-reader users can jump between regions via landmark
 *   navigation.
 *
 * ## Read-budget note
 *
 * DashboardLayout is a pure slot-composition component — it performs no data
 * fetching and holds no local state. All interactive behaviour is delegated to
 * child components (SideNav uses SidebarContext; TopNav uses WalletContext).
 */
const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex">
      {/*
       * Skip-to-content link
       *
       * Rendered as the very first DOM node so it is the first Tab stop.
       * Visually hidden at rest; becomes visible on focus via the
       * `sr-only focus:not-sr-only` Tailwind pattern.
       */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:rounded focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[#15A350] focus:shadow-lg"
      >
        Skip to main content
      </a>

      {/* SideNav contains the <nav> / <aside> landmark */}
      <SideNav />

      <div className="w-full min-h-screen bg-[#15A350] flex flex-col">
        {/* TopNav wrapped in <header> landmark */}
        <header>
          <TopNav />
        </header>

        {/*
         * Main content slot.
         *
         * `id="main-content"` is the skip-link target.
         * `flex-1` ensures the slot expands to fill the remaining viewport
         * height below the header.
         */}
        <main id="main-content" className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
