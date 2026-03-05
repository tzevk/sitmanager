/**
 * Simple in-memory cache with TTL support
 */
interface CacheEntry<T> {
  data: T;
  expiry: number;
}

class MemoryCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private defaultTTL: number = 60 * 1000; // 1 minute default

  /**
   * Get item from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    
    if (!entry) return null;
    
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  /**
   * Set item in cache
   * @param key Cache key
   * @param data Data to cache
   * @param ttl Time to live in milliseconds (default: 1 minute)
   */
  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl,
    });
  }

  /**
   * Delete item from cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Delete all items matching a prefix
   */
  deleteByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

// Singleton instance
export const cache = new MemoryCache();

// Cache key generators
export const cacheKeys = {
  corporateInquiry: {
    list: (params: { page: number; limit: number; search: string }) =>
      `corporate_inquiry:list:${params.page}:${params.limit}:${params.search}`,
    single: (id: number) => `corporate_inquiry:single:${id}`,
    prefix: 'corporate_inquiry:',
  },
  courses: {
    list: () => 'courses:list',
    prefix: 'courses:',
  },
  cvShortlisted: {
    list: (params: { page: number; limit: number; search: string }) =>
      `cv_shortlisted:list:${params.page}:${params.limit}:${params.search}`,
    single: (id: number) => `cv_shortlisted:single:${id}`,
    prefix: 'cv_shortlisted:',
  },
  shortlistedBySit: {
    list: (params: { page: number; limit: number; search: string }) =>
      `shortlisted_sit:list:${params.page}:${params.limit}:${params.search}`,
    single: (id: number) => `shortlisted_sit:single:${id}`,
    prefix: 'shortlisted_sit:',
  },
  consultancyReport: {
    list: (params: string) => `consultancy_report:list:${params}`,
    prefix: 'consultancy_report:',
  },
  // Add more cache keys as needed
};

// Cache TTLs (in milliseconds)
export const cacheTTL = {
  short: 30 * 1000,      // 30 seconds
  medium: 2 * 60 * 1000, // 2 minutes
  long: 10 * 60 * 1000,  // 10 minutes
  veryLong: 60 * 60 * 1000, // 1 hour
};

// Run cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    cache.cleanup();
  }, 5 * 60 * 1000);
}
