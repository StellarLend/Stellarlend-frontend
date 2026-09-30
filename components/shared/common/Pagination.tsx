"use client";

/**
 * Pagination renders a bounded window of page controls for a list.
 *
 * Invariants (enforced defensively below so callers cannot break the control
 * with drifted or malformed props):
 * - `totalPages` is always a finite, non-negative integer. A non-finite, zero,
 *   or negative `itemsPerPage` is treated as "no pages" instead of producing
 *   `Infinity`/`NaN` page labels.
 * - The active page is always clamped to `[1, totalPages]` (or `1` when there
 *   is nothing to page through). This means a `currentPage` that drifts out of
 *   range (e.g. after the underlying data set shrinks) can never disable the
 *   wrong control or trigger navigation outside the valid range.
 * - At most 7 page controls (page numbers + ellipses) are rendered for any
 *   `totalPages`, keeping the control width bounded.
 */
export const Pagination = ({
  totalItems,
  itemsPerPage,
  currentPage,
  setCurrentPage,
}: {
  totalItems: number;
  itemsPerPage: number;
  currentPage: number;
  setCurrentPage: (page: number) => void;
}) => {
  const safeTotalItems =
    Number.isFinite(totalItems) && totalItems > 0 ? Math.floor(totalItems) : 0;
  const safeItemsPerPage =
    Number.isFinite(itemsPerPage) && itemsPerPage > 0
      ? Math.floor(itemsPerPage)
      : 0;

  const totalPages =
    safeItemsPerPage > 0 ? Math.ceil(safeTotalItems / safeItemsPerPage) : 0;

  const safeCurrentPage =
    totalPages > 0
      ? Math.min(
          Math.max(
            Number.isFinite(currentPage) ? Math.floor(currentPage) : 1,
            1,
          ),
          totalPages,
        )
      : 1;

  const hasPageableItems = safeTotalItems > 0 && safeItemsPerPage > 0;
  const start = hasPageableItems
    ? Math.min((safeCurrentPage - 1) * safeItemsPerPage + 1, safeTotalItems)
    : 0;
  const end = hasPageableItems
    ? Math.min(start + safeItemsPerPage - 1, safeTotalItems)
    : 0;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-4 border p-4 text-xs md:text-sm">
      <div className="text-gray-600 order-2 sm:order-1">
        Showing <span className="font-semibold text-gray-900">{start}</span> to{" "}
        <span className="font-semibold text-gray-900">{end}</span> of{" "}
        <span className="font-semibold text-gray-900">{safeTotalItems}</span>
      </div>

      <div className="flex items-center gap-1 order-1 sm:order-2">
        {/* Previous Button */}
        <button
          onClick={() => setCurrentPage(safeCurrentPage - 1)}
          disabled={safeCurrentPage === 1}
          className="p-2 text-black w-8 h-8 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          aria-label="Previous page"
        >
          &lt;
        </button>

        {/* Page Buttons */}
        <div className="flex items-center gap-1">
          {(() => {
            const getPageNumbers = () => {
              if (totalPages <= 7) {
                return Array.from({ length: totalPages }, (_, i) => i + 1);
              }

              if (safeCurrentPage <= 4) {
                return [1, 2, 3, 4, 5, "...", totalPages];
              }

              if (safeCurrentPage >= totalPages - 3) {
                return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
              }

              return [1, "...", safeCurrentPage - 1, safeCurrentPage, safeCurrentPage + 1, "...", totalPages];
            };

            return getPageNumbers().map((page, index) => {
              if (page === "...") {
                return (
                  <span key={`ellipsis-${index}`} className="w-8 text-center text-gray-500">
                    ...
                  </span>
                );
              }

              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page as number)}
                  aria-current={safeCurrentPage === page ? "page" : undefined}
                  aria-label={`Page ${page}`}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                    safeCurrentPage === page
                      ? "bg-green-600 text-white shadow-sm"
                      : "hover:bg-gray-100 text-gray-700 border border-gray-200"
                  }`}
                >
                  {page}
                </button>
              );
            });
          })()}
        </div>

        {/* Next Button */}
        <button
          onClick={() => setCurrentPage(safeCurrentPage + 1)}
          disabled={safeCurrentPage === totalPages || totalPages === 0}
          className="p-2 text-black w-8 h-8 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          aria-label="Next page"
        >
          &gt;
        </button>
      </div>
    </div>
  );
};
