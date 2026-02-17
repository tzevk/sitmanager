/**
 * Environment variable validation.
 * Imported at build time / server startup to fail fast on missing config.
 */

const DB_REQUIRED_ENV = [
  'DB_HOST',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
] as const;

const AUTH_REQUIRED_ENV = [
  'JWT_SECRET',
] as const;

const REQUIRED_ENV = [...DB_REQUIRED_ENV, ...AUTH_REQUIRED_ENV] as const;

const OPTIONAL_ENV = [
  'DB_PORT',       // defaults to 3306
  'NODE_ENV',      // defaults to development
  'VERCEL',        // set automatically by Vercel
  'VERCEL_URL',    // set automatically by Vercel
] as const;

interface DbEnvConfig {
  DB_HOST: string;
  DB_PORT: number;
  DB_NAME: string;
  DB_USER: string;
  DB_PASSWORD: string;
}

interface EnvConfig extends DbEnvConfig {
  JWT_SECRET: string;
  NODE_ENV: string;
  IS_VERCEL: boolean;
  BASE_URL: string;
}

let _dbValidated: DbEnvConfig | null = null;
let _validated: EnvConfig | null = null;

/**
 * Validate and return only DB-related environment config.
 * Use this from getPool() to avoid requiring JWT_SECRET for DB connections.
 */
export function getDbEnv(): DbEnvConfig {
  if (_dbValidated) return _dbValidated;

  const missing = DB_REQUIRED_ENV.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required database environment variables:\n  ${missing.join('\n  ')}\n\n` +
      `Copy .env.example to .env.local and fill in the values,\n` +
      `or set them in Vercel Dashboard → Settings → Environment Variables.`
    );
  }

  _dbValidated = {
    DB_HOST: process.env.DB_HOST!,
    DB_PORT: parseInt(process.env.DB_PORT || '3306', 10),
    DB_NAME: process.env.DB_NAME!,
    DB_USER: process.env.DB_USER!,
    DB_PASSWORD: process.env.DB_PASSWORD!,
  };

  return _dbValidated;
}

/**
 * Validate and return full environment config (DB + auth).
 * Throws on missing required variables — call early to fail fast.
 */
export function getEnv(): EnvConfig {
  if (_validated) return _validated;

  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n  ${missing.join('\n  ')}\n\n` +
      `Copy .env.example to .env.local and fill in the values,\n` +
      `or set them in Vercel Dashboard → Settings → Environment Variables.`
    );
  }

  // JWT secret must be at least 32 chars
  const jwtSecret = process.env.JWT_SECRET!;
  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long.');
  }

  const isVercel = process.env.VERCEL === '1';
  const db = getDbEnv();

  _validated = {
    ...db,
    JWT_SECRET: jwtSecret,
    NODE_ENV: process.env.NODE_ENV || 'development',
    IS_VERCEL: isVercel,
    BASE_URL: isVercel
      ? `https://${process.env.VERCEL_URL}`
      : `http://localhost:${process.env.PORT || 3000}`,
  };

  return _validated;
}

/** Quick check — returns list of missing vars without throwing */
export function checkEnv(): { ok: boolean; missing: string[] } {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  return { ok: missing.length === 0, missing };
}
