"use client";

import { useEffect } from "react";
import { PageHeader } from "@/components/shared/common";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="bg-gray-50 min-h-screen p-4 md:p-6 lg:p-8">
      <div className="flex flex-col gap-6 max-w-6xl mx-auto items-center justify-center min-h-[50vh]">
        <div className="bg-white rounded-lg shadow-sm p-8 text-center max-w-md">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Something went wrong!</h2>
          <p className="text-gray-600 mb-6">
            We encountered an unexpected error while loading your profile. Please try again.
          </p>
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
