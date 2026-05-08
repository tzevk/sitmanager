import { redis } from './redis';

// ── In-memory fallback (used when REDIS_URL is not set) ──────────────────────

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

class MemoryCache {
  private store: Map<string, CacheEntry<unknown>> = new Map();

  get<T>(key: string): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiry) { this.store.delete(key); return null; }
    return entry.data;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, { data, expiry: Date.now() + ttlMs });
  }

  delete(key: string): void { this.store.delete(key); }

  deleteByPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  clear(): void { this.store.clear(); }
  size(): number { return this.store.size; }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiry) this.store.delete(key);
    }
  }
}

const mem = new MemoryCache();

if (typeof setInterval !== 'undefined') {
  setInterval(() => mem.cleanup(), 5 * 60 * 1000);
}

// ── Unified async cache (Redis when available, memory otherwise) ──────────────

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    if (redis) {
      const raw = await redis.get(key);
      if (raw == null) return null;
      try { return JSON.parse(raw) as T; } catch { return null; }
    }
    return mem.get<T>(key);
  },

  async set<T>(key: string, data: T, ttlMs: number = 60_000): Promise<void> {
    if (redis) {
      await redis.set(key, JSON.stringify(data), 'PX', ttlMs);
      return;
    }
    mem.set(key, data, ttlMs);
  },

  async delete(key: string): Promise<void> {
    if (redis) { await redis.del(key); return; }
    mem.delete(key);
  },

  async deleteByPrefix(prefix: string): Promise<void> {
    if (redis) {
      // SCAN instead of KEYS to avoid blocking the server
      let cursor = '0';
      do {
        const [next, keys] = await redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
        cursor = next;
        if (keys.length) await redis.del(...keys);
      } while (cursor !== '0');
      return;
    }
    mem.deleteByPrefix(prefix);
  },

  async clear(): Promise<void> {
    if (redis) { await redis.flushdb(); return; }
    mem.clear();
  },
};

// ── Cache key generators ──────────────────────────────────────────────────────

export const cacheKeys = {
  corporateInquiry: {
    list: (params: { page: number; limit: number; search: string; status?: string }) =>
      `corporate_inquiry:list:${params.page}:${params.limit}:${params.search}:${params.status ?? ''}`,
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
};

// ── TTLs (milliseconds) ───────────────────────────────────────────────────────

export const cacheTTL = {
  short: 30_000,
  medium: 2 * 60_000,
  long: 10 * 60_000,
  veryLong: 60 * 60_000,
};
