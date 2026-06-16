import Redis from 'ioredis';
import type { RedisOptions } from 'ioredis';

const REDIS_URL = process.env.REDIS_URL;

declare global {
  // eslint-disable-next-line no-var
  var __redis: Redis | null | undefined;
}

function createClient(): Redis | null {
  if (!REDIS_URL) return null;

  const baseOptions: RedisOptions = {
    // Don't block module init — connect on first command
    lazyConnect: true,
    // Allow null replies so eval doesn't throw on reconnect races
    enableReadyCheck: false,
    // Retry failed commands up to 2 times with a short backoff
    maxRetriesPerRequest: 2,
    // Auto-reconnect with exponential backoff, capped at 3s
    retryStrategy(times: number) {
      if (times > 5) return null; // give up after 5 attempts, let fallback handle it
      return Math.min(times * 200, 3000);
    },
  };

  let client: Redis;

  try {
    const parsed = new URL(REDIS_URL);
    const parsedOptions: RedisOptions = {
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 6379,
      username: parsed.username || undefined,
      password: parsed.password || undefined,
      db: parsed.pathname && parsed.pathname !== '/' ? Number(parsed.pathname.replace('/', '')) || 0 : 0,
      ...(parsed.protocol === 'rediss:' ? { tls: { rejectUnauthorized: false } } : {}),
    };
    client = new Redis({
      ...baseOptions,
      ...parsedOptions,
    });
  } catch {
    // Fallback for non-standard Redis URLs.
    client = new Redis(REDIS_URL, baseOptions);
  }

  let lastRedisLog = 0;
  client.on('error', () => {
    const now = Date.now();
    if (now - lastRedisLog > 30_000) {
      lastRedisLog = now;
      console.warn('[Redis] unavailable — falling back to in-memory cache');
    }
  });

  return client;
}

// Singleton — one connection per process/Lambda instance, reused across requests
function getRedis(): Redis | null {
  if (global.__redis !== undefined) return global.__redis ?? null;
  global.__redis = createClient();
  return global.__redis ?? null;
}

export const redis = getRedis();
