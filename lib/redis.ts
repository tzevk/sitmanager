import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL;

declare global {
  // eslint-disable-next-line no-var
  var __redis: Redis | null | undefined;
}

function createClient(): Redis | null {
  if (!REDIS_URL) return null;

  const isTLS = REDIS_URL.startsWith('rediss://');

  const client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
    ...(isTLS && { tls: { rejectUnauthorized: false } }),
  });

  client.on('error', (err) => {
    console.error('[Redis] connection error:', err.message);
  });

  client.on('ready', () => {
    console.log('[Redis] connected');
  });

  return client;
}

// Reuse across hot reloads in dev; create once in prod
function getRedis(): Redis | null {
  if (process.env.NODE_ENV === 'development') {
    if (!global.__redis) {
      global.__redis = createClient();
    }
    return global.__redis ?? null;
  }
  return createClient();
}

export const redis = getRedis();
