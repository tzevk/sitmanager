/**
 * API fetch wrapper with error handling, caching, and retry logic
 */

interface FetchOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
}

// Simple in-memory cache for GET requests
const requestCache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL = 30 * 1000; // 30 seconds

/**
 * Fetch with timeout support
 */
async function fetchWithTimeout(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { timeout = 10000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * API fetch with retry logic
 */
export async function apiFetch<T>(
  url: string,
  options: FetchOptions = {}
): Promise<ApiResponse<T>> {
  const { retries = 2, retryDelay = 1000, ...fetchOptions } = options;
  const method = fetchOptions.method || 'GET';

  // Check cache for GET requests
  if (method === 'GET') {
    const cached = requestCache.get(url);
    if (cached && cached.expiry > Date.now()) {
      return { data: cached.data as T, error: null, status: 200 };
    }
  }

  let lastError: Error | null = null;
  let attempt = 0;

  while (attempt <= retries) {
    try {
      const response = await fetchWithTimeout(url, {
        ...fetchOptions,
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions.headers,
        },
      });

      // Parse response
      const data = await response.json();

      if (!response.ok) {
        return {
          data: null,
          error: data.error || data.message || `HTTP ${response.status}`,
          status: response.status,
        };
      }

      // Cache successful GET requests
      if (method === 'GET') {
        requestCache.set(url, { data, expiry: Date.now() + CACHE_TTL });
      }

      return { data, error: null, status: response.status };
    } catch (error) {
      lastError = error as Error;
      attempt++;

      // Don't retry on certain errors
      if (
        lastError.name === 'AbortError' ||
        (error instanceof TypeError && error.message.includes('fetch'))
      ) {
        break;
      }

      // Wait before retrying
      if (attempt <= retries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay * attempt));
      }
    }
  }

  return {
    data: null,
    error: lastError?.message || 'Request failed',
    status: 0,
  };
}

/**
 * Clear API cache
 */
export function clearApiCache(urlPrefix?: string) {
  if (!urlPrefix) {
    requestCache.clear();
    return;
  }
  for (const key of requestCache.keys()) {
    if (key.startsWith(urlPrefix)) {
      requestCache.delete(key);
    }
  }
}

/**
 * Format error message for display
 */
export function formatApiError(error: string | null): string {
  if (!error) return 'An unexpected error occurred';
  
  // Handle common errors
  if (error.includes('fetch') || error.includes('network')) {
    return 'Unable to connect. Please check your internet connection.';
  }
  if (error.includes('timeout') || error.includes('AbortError')) {
    return 'Request timed out. Please try again.';
  }
  if (error.includes('401') || error.includes('Unauthorized')) {
    return 'Session expired. Please login again.';
  }
  if (error.includes('403')) {
    return 'You do not have permission to perform this action.';
  }
  if (error.includes('404')) {
    return 'Resource not found.';
  }
  if (error.includes('500')) {
    return 'Server error. Please try again later.';
  }
  
  return error;
}
