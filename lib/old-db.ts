import mysql from 'mysql2/promise';
import { getOldDbEnv } from '@/lib/env';

let oldPool: mysql.Pool | null = null;

const isServerless = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME;

export function getOldPool(): mysql.Pool {
  if (!oldPool) {
    const env = getOldDbEnv();
    const configuredLimit = parseInt(process.env.OLD_DB_CONNECTION_LIMIT || '', 10);
    const connectionLimit = Number.isFinite(configuredLimit) && configuredLimit > 0
      ? configuredLimit
      : (isServerless ? 5 : 20);
    oldPool = mysql.createPool({
      host: env.OLD_DB_HOST,
      port: env.OLD_DB_PORT,
      database: env.OLD_DB_NAME,
      user: env.OLD_DB_USER,
      password: env.OLD_DB_PASSWORD,
      waitForConnections: true,
      connectionLimit,
      maxIdle: isServerless ? 2 : 10,
      idleTimeout: isServerless ? 10000 : 60000,
      queueLimit: 0,
      enableKeepAlive: !isServerless,
      keepAliveInitialDelay: 30000,
      connectTimeout: isServerless ? 10000 : 30000,
      namedPlaceholders: true,
      dateStrings: true,
      ...(process.env.OLD_DB_SSL === 'true' && {
        ssl: {
          rejectUnauthorized: true,
        },
      }),
    });

    oldPool.on('connection', (connection) => {
      connection.on('error', (err) => {
        console.error('OLD DB connection error:', err.code);
      });
    });
  }
  return oldPool;
}

export async function destroyOldPool(): Promise<void> {
  if (oldPool) {
    await oldPool.end();
    oldPool = null;
  }
}
