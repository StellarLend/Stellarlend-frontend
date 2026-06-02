/**
 * app/lending/loading.tsx
 *
 * Next.js App Router loading boundary for the /lending route.
 *
 * Mirrors the real layout:
 *   Full-page gradient background (green-700 → black)
 *   └── PageHeader skeleton
 *   └── TabSelector skeleton
 *   └── Two-column grid
 *       ├── Left (2/3): Form skeleton
 *       └── Right (1/3): InterestCalculator + TransactionSummary skeletons
 */

export default function LendingLoading() {
  return (
    <div
      className="min-h-screen p-6 bg-gradient-to-b from-green-700 to-black"
      aria-busy="true"
      aria-label="Loading lending page…"
    >
      <div className="max-w-7xl mx-auto space-y-8">
        {/* PageHeader skeleton */}
        <div className="space-y-2 pt-2">
          <div className="skeleton h-7 w-56" />
          <div className="skeleton h-4 w-80" />
        </div>

        {/* TabSelector skeleton */}
        <div className="flex gap-2">
          <div className="skeleton h-10 w-24 rounded-lg" />
          <div className="skeleton h-10 w-24 rounded-lg" />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ── Left: Form skeleton (2 cols) ─────────────────────────────── */}
          <div className="lg:col-span-2 bg-white/5 rounded-2xl p-6 space-y-5">
            {/* Asset selector row */}
            <div className="space-y-1">
              <div className="skeleton h-4 w-20" />
              <div className="skeleton h-11 w-full rounded-lg" />
            </div>
            {/* Amount input */}
            <div className="space-y-1">
              <div className="skeleton h-4 w-24" />
              <div className="skeleton h-11 w-full rounded-lg" />
            </div>
            {/* Interest rate */}
            <div className="space-y-1">
              <div className="skeleton h-4 w-28" />
              <div className="skeleton h-11 w-full rounded-lg" />
            </div>
            {/* Duration (borrow only) */}
            <div className="space-y-1">
              <div className="skeleton h-4 w-20" />
              <div className="skeleton h-11 w-full rounded-lg" />
            </div>
            {/* Submit button */}
            <div className="skeleton h-12 w-full rounded-lg mt-2" />
          </div>

          {/* ── Right: Calculator + Summary skeletons ────────────────────── */}
          <div className="space-y-6">
            {/* InterestCalculator card */}
            <div className="bg-white/5 rounded-2xl p-5 space-y-4">
              <div className="skeleton h-5 w-40" />
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4 w-3/4" />
              <div className="skeleton h-10 w-full rounded-lg" />
            </div>
            {/* TransactionSummary card */}
            <div className="bg-white/5 rounded-2xl p-5 space-y-3">
              <div className="skeleton h-5 w-36" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <div className="skeleton h-4 w-28" />
                  <div className="skeleton h-4 w-16" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
