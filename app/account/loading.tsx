/**
 * app/account/loading.tsx
 *
 * Next.js App Router loading boundary for the /account/* routes.
 *
 * Mirrors the real layout:
 *   bg-gray-50 full-page wrapper
 *   └── Sidebar skeleton (left column)
 *   └── Content panel skeleton (right column)
 *       ├── PageHeader skeleton
 *       └── ProfileForm skeleton (avatar + fields)
 */

export default function AccountLoading() {
  return (
    <div
      className="bg-gray-50 min-h-screen p-4 md:p-6 lg:p-8"
      aria-busy="true"
      aria-label="Loading account page…"
    >
      <div className="flex flex-col md:flex-row gap-6 max-w-6xl mx-auto">
        {/* ── Sidebar skeleton ─────────────────────────────────────────── */}
        <aside className="w-full md:w-56 shrink-0 bg-white rounded-lg shadow-sm p-4 space-y-3">
          {/* Avatar + name */}
          <div className="flex flex-col items-center gap-2 pb-4 border-b border-gray-100">
            <div className="skeleton-light h-16 w-16 rounded-full" />
            <div className="skeleton-light h-4 w-28" />
            <div className="skeleton-light h-3 w-20" />
          </div>
          {/* Nav links */}
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton-light h-9 w-full rounded-md" />
          ))}
        </aside>

        {/* ── Main content panel skeleton ──────────────────────────────── */}
        <div className="flex-1 bg-white rounded-lg shadow-sm p-4 md:p-6 space-y-6">
          {/* PageHeader */}
          <div className="space-y-2 pb-4 border-b border-gray-100">
            <div className="skeleton-light h-6 w-32" />
            <div className="skeleton-light h-4 w-72" />
          </div>

          {/* ProfileForm — avatar upload row */}
          <div className="flex items-center gap-4">
            <div className="skeleton-light h-20 w-20 rounded-full shrink-0" />
            <div className="space-y-2">
              <div className="skeleton-light h-9 w-28 rounded-lg" />
              <div className="skeleton-light h-3 w-40" />
            </div>
          </div>

          {/* Form fields — two-column grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="skeleton-light h-4 w-24" />
                <div className="skeleton-light h-10 w-full rounded-lg" />
              </div>
            ))}
          </div>

          {/* Full-width field (e.g. bio / wallet address) */}
          <div className="space-y-1">
            <div className="skeleton-light h-4 w-32" />
            <div className="skeleton-light h-20 w-full rounded-lg" />
          </div>

          {/* Save button */}
          <div className="flex justify-end">
            <div className="skeleton-light h-10 w-28 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
