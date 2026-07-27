/**
 * app/dashboard/loading.tsx
 *
 * Next.js App Router loading boundary for the /dashboard route.
 * Rendered automatically while the page segment is streaming in.
 *
 * Mirrors the real layout:
 *   DashboardLayout (SideNav + TopNav)
 *   └── PageHeader skeleton
 *   └── MetricsCards skeleton  (3 cards in a horizontal row)
 *   └── RecentTransactions skeleton (table rows)
 *
 * Animations respect `prefers-reduced-motion` via the `.skeleton` CSS class
 * defined in globals.css.
 */

// This file intentionally has no "use client" directive — it is a pure
// Server Component so Next.js can stream it immediately.

export default function DashboardLoading() {
  return (
    <div className="flex" aria-busy="true" aria-label="Loading dashboard…">
      {/* ── Sidebar skeleton ─────────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-[240px] min-h-screen bg-[#0A3D1E] p-4 gap-4 shrink-0">
        {/* Logo */}
        <div className="skeleton h-8 w-32 mb-6" />
        {/* Nav items */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-9 w-full" />
        ))}
      </aside>

      {/* ── Main content area ────────────────────────────────────────────── */}
      <div className="w-full min-h-screen bg-[#15A350] flex flex-col">
        {/* TopNav skeleton */}
        <header className="h-16 bg-[#0A3D1E] flex items-center justify-between px-6 shrink-0">
          <div className="skeleton h-5 w-40" />
          <div className="flex items-center gap-3">
            <div className="skeleton h-8 w-8 rounded-full" />
            <div className="skeleton h-5 w-24" />
          </div>
        </header>

        <main className="flex-1 px-6 md:px-12 pt-10">
          {/* PageHeader skeleton */}
          <div className="border-t border-white/20 pb-6 pt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-2">
              <div className="skeleton h-7 w-48" />
              <div className="skeleton h-4 w-72" />
            </div>
            <div className="flex gap-3">
              <div className="skeleton h-11 w-32 rounded-lg" />
              <div className="skeleton h-11 w-32 rounded-lg" />
            </div>
          </div>

          {/* MetricsCards skeleton — 3 cards */}
          <div className="flex gap-3 overflow-x-auto pb-2 my-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="skeleton min-w-[345px] w-full rounded-xl h-[148px]"
              />
            ))}
          </div>

          {/* RecentTransactions skeleton */}
          <div className="pt-8 space-y-3">
            {/* Section heading */}
            <div className="skeleton h-5 w-44 mb-4" />
            {/* Table header */}
            <div className="flex gap-4 px-2">
              {[120, 80, 100, 80, 60].map((w, i) => (
                <div key={i} className="skeleton h-4" style={{ width: w }} />
              ))}
            </div>
            {/* Table rows */}
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex gap-4 items-center bg-[#0A3D1E]/30 rounded-lg px-4 py-3"
              >
                <div className="skeleton h-8 w-8 rounded-full shrink-0" />
                <div className="skeleton h-4 w-28" />
                <div className="skeleton h-4 w-20 ml-auto" />
                <div className="skeleton h-4 w-16" />
                <div className="skeleton h-6 w-20 rounded-full" />
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
