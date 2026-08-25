'use client';

import { useEffect, useState } from 'react';

/** True for the "Failed to load chunk ... from module ..." class of error —
 * happens when a browser tab stays open across a new deployment and tries to
 * fetch a JS chunk file that no longer exists at the old hash. React's `reset()`
 * re-renders with the same already-broken bundle, so it never actually helps;
 * only a real page reload (fetching the current HTML/JS) fixes this. */
function isChunkLoadError(error: Error): boolean {
  return (
    error.name === 'ChunkLoadError' ||
    /Failed to load chunk|Loading chunk [\w-]+ failed/i.test(error.message || '')
  );
}

const RELOAD_GUARD_KEY = 'sit-chunk-reload-attempted';

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const chunkError = isChunkLoadError(error);
  const [autoReloading, setAutoReloading] = useState(false);

  useEffect(() => {
    if (!chunkError) return;
    // Only auto-reload once per browser session — if a hard reload doesn't
    // clear it, something else is wrong and we shouldn't loop forever.
    if (sessionStorage.getItem(RELOAD_GUARD_KEY)) return;
    sessionStorage.setItem(RELOAD_GUARD_KEY, '1');
    setAutoReloading(true);
    window.location.reload();
  }, [chunkError]);

  return (
    <html>
      <body className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <div className="mb-6">
            <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${chunkError ? 'bg-blue-100' : 'bg-red-100'}`}>
              {chunkError ? (
                <svg className="w-8 h-8 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              )}
            </div>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            {chunkError ? 'Updating to the latest version…' : 'Something went wrong'}
          </h2>
          <p className="text-gray-500 mb-6 max-w-md">
            {chunkError
              ? (autoReloading ? 'This page is reloading automatically.' : 'A new version of the app is available.')
              : (error.message || 'An unexpected error occurred. Please try again.')}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 bg-[#2A6BB5] hover:bg-[#2360A0] text-white rounded-lg font-semibold shadow-sm transition-colors disabled:opacity-60"
            disabled={autoReloading}
          >
            {autoReloading ? 'Reloading…' : chunkError ? 'Reload now' : 'Try again'}
          </button>
        </div>
      </body>
    </html>
  );
}
