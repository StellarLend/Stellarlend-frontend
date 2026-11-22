export default function MarketsLoading() {
  return (
    <div className="space-y-8 animate-pulse" aria-busy="true" aria-label="Loading markets">
      <div>
        <div className="h-9 w-48 rounded bg-neutral-800" />
        <div className="mt-2 h-4 w-96 max-w-full rounded bg-neutral-800/60" />
      </div>

      {/* Wallet / Stats overview card */}
      <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="space-y-2">
          <div className="h-3.5 w-16 rounded bg-neutral-800" />
          <div className="h-5 w-44 rounded bg-neutral-800/70" />
        </div>
        <div className="grid grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-16 rounded bg-neutral-800" />
              <div className="h-5 w-20 rounded bg-neutral-800/80" />
            </div>
          ))}
        </div>
      </div>

      {/* Table skeleton matching table layout */}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="mut">
            <tr className="border-b border-[var(--line)]">
              <th className="p-4"><div className="h-4 w-16 rounded bg-neutral-800" /></th>
              <th className="p-4"><div className="h-4 w-12 rounded bg-neutral-800" /></th>
              <th className="p-4"><div className="h-4 w-20 rounded bg-neutral-800" /></th>
              <th className="p-4"><div className="h-4 w-20 rounded bg-neutral-800" /></th>
              <th className="p-4"><div className="h-4 w-24 rounded bg-neutral-800" /></th>
              <th className="p-4"><div className="h-4 w-24 rounded bg-neutral-800" /></th>
              <th className="p-4"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4].map((row) => (
              <tr key={row} className="border-b border-[var(--line)] last:border-0">
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-12 rounded bg-neutral-800 font-bold" />
                    <div className="h-3.5 w-24 rounded bg-neutral-800/50" />
                  </div>
                </td>
                <td className="p-4">
                  <div className="h-4 w-16 rounded bg-neutral-800/70" />
                </td>
                <td className="p-4">
                  <div className="h-4 w-14 rounded bg-neutral-800/70" />
                </td>
                <td className="p-4">
                  <div className="h-4 w-14 rounded bg-neutral-800/70" />
                </td>
                <td className="p-4">
                  <div className="h-4 w-20 rounded bg-neutral-800/70" />
                </td>
                <td className="p-4">
                  <div className="h-4 w-28 rounded bg-neutral-800/50" />
                </td>
                <td className="p-4 text-right">
                  <div className="inline-block h-8 w-16 rounded bg-neutral-800" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
