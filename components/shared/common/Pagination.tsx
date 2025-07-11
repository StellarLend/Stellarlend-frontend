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
    <div className="flex items-center justify-center w-full gap-6 border p-4 text-xs md:text-sm">
      <div className="text-gray-600">
        Showing {start} to {end} of {totalItems}
      </div>

      <div className="flex items-center gap-1">
        {/* Previous Button */}
        <button
          onClick={() => setCurrentPage(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 text-black w-8 h-8 rounded hover:bg-gray-300"
        >
          &lt;
        </button>

        {/* Page Buttons - Always shows 1, 2, 3 */}
        {[1, 2, 3].map((page) => (
          <button
            key={page}
            onClick={() => setCurrentPage(page)}
            disabled={page > totalPages}
            className={`w-8 h-8 rounded-xl text-black ${
              currentPage === page
                ? "bg-green-600 text-white"
                : " hover:bg-gray-300"
            } ${page > totalPages ? "opacity-20 " : ""}`}
          >
            {page}
          </button>
        ))}

        {/* Next Button */}
        <button
          onClick={() => setCurrentPage(currentPage + 1)}
          disabled={currentPage === totalPages || totalPages === 0}
          className="p-2 text-black w-8 h-8 rounded hover:bg-gray-300"
        >
          &gt;
        </button>
      </div>
    </div>
  );
};
