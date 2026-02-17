'use client';

import { useEffect } from 'react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 max-w-md w-full text-center">
        <div className="mb-6">
          <div className="w-14 h-14 mx-auto bg-red-100 rounded-full flex items-center justify-center">
            <svg
              className="w-7 h-7 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>
        <h2 className="text-lg font-semibold text-gray-800 mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          {error.message || 'An error occurred while loading this page.'}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg font-medium text-sm hover:bg-gray-50 transition"
          >
            Refresh page
          </button>
          <button
            onClick={reset}
            className="px-4 py-2 bg-[#2A6BB5] hover:bg-[#2360A0] text-white rounded-lg font-medium text-sm shadow-sm transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
