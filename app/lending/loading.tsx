/**
 * app/lending/loading.tsx
 *
 * Next.js App Router loading boundary for the /lending route.
 *
 * Mirrors the real layout:
 *   Light page canvas with a branded gradient accent
 *   - Hero card skeleton
 *   - TabSelector skeleton
 *   - Two-column grid
 *     - Left (2/3): Form skeleton
 *     - Right (1/3): InterestCalculator + TransactionSummary skeletons
 */

export default function LendingLoading() {
  return (
    <div
      className="relative min-h-screen overflow-hidden bg-slate-50 px-4 py-6 sm:px-6 lg:px-8"
      aria-busy="true"
      aria-label="Loading lending page..."
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[linear-gradient(180deg,rgba(21,163,80,0.24)_0%,rgba(21,163,80,0.1)_38%,rgba(248,250,252,0)_100%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 top-8 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl"
      />

      <div className="relative mx-auto max-w-7xl space-y-6">
        <div className="overflow-hidden rounded-[32px] border border-emerald-100 bg-white/95 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="h-2 bg-gradient-to-r from-green-600 via-emerald-500 to-black" />
          <div className="space-y-2 p-6 sm:p-8">
            <div className="skeleton-light h-7 w-56" />
            <div className="skeleton-light h-4 w-80" />
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur">
          <div className="flex gap-2">
            <div className="skeleton-light h-10 w-24 rounded-lg" />
            <div className="skeleton-light h-10 w-24 rounded-lg" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-5 rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm">
            <div className="space-y-1">
              <div className="skeleton-light h-4 w-20" />
              <div className="skeleton-light h-11 w-full rounded-lg" />
            </div>
            <div className="space-y-1">
              <div className="skeleton-light h-4 w-24" />
              <div className="skeleton-light h-11 w-full rounded-lg" />
            </div>
            <div className="space-y-1">
              <div className="skeleton-light h-4 w-28" />
              <div className="skeleton-light h-11 w-full rounded-lg" />
            </div>
            <div className="space-y-1">
              <div className="skeleton-light h-4 w-20" />
              <div className="skeleton-light h-11 w-full rounded-lg" />
            </div>
            <div className="skeleton-light mt-2 h-12 w-full rounded-lg" />
          </div>

          <div className="space-y-6">
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm">
              <div className="skeleton-light h-5 w-40" />
              <div className="skeleton-light h-4 w-full" />
              <div className="skeleton-light h-4 w-3/4" />
              <div className="skeleton-light h-10 w-full rounded-lg" />
            </div>
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm">
              <div className="skeleton-light h-5 w-36" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <div className="skeleton-light h-4 w-28" />
                  <div className="skeleton-light h-4 w-16" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
