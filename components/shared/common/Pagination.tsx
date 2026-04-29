"use client";

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
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const start = Math.min((currentPage - 1) * itemsPerPage + 1, totalItems);
  const end = Math.min(start + itemsPerPage - 1, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-4 border p-4 text-xs md:text-sm">
      <div className="text-gray-600 order-2 sm:order-1">
        Showing <span className="font-semibold text-gray-900">{start}</span> to{" "}
        <span className="font-semibold text-gray-900">{end}</span> of{" "}
        <span className="font-semibold text-gray-900">{totalItems}</span>
      </div>

      <div className="flex items-center gap-1 order-1 sm:order-2">
        {/* Previous Button */}
        <button
          onClick={() => setCurrentPage(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 text-black w-8 h-8 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors border border-gray-200"
          aria-label="Previous page"
        >
          &lt;
        </button>

        {/* Page Buttons */}
        <div className="flex items-center gap-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                currentPage === page
                  ? "bg-green-600 text-white shadow-sm"
                  : "hover:bg-gray-100 text-gray-700 border border-gray-200"
              }`}
            >
              {page}
            </button>
          ))}
        </div>

        {/* Next Button */}
        <button
          onClick={() => setCurrentPage(currentPage + 1)}
          disabled={currentPage === totalPages || totalPages === 0}
          className="p-2 text-black w-8 h-8 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors border border-gray-200"
          aria-label="Next page"
        >
          &gt;
        </button>
      </div>
    </div>
  );
};
