/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';

/* ─── Input coercion ──────────────────────────────────────────────── */

/** Coerce to a finite number; returns 0 if NaN/null/undefined/Infinity. */
export function numOrZero(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Coerce to a non-negative finite number; returns 0 on failure. */
export function nonNegNum(v: unknown): number {
  const n = numOrZero(v);
  return n < 0 ? 0 : n;
}

/** Trim string, cap length, return null if empty. */
export function nullableString(v: unknown, maxLen = 255): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s.slice(0, maxLen) : null;
}

/** Trim string, cap length, return '' if empty. */
export function safeString(v: unknown, maxLen = 255): string {
  if (v === null || v === undefined) return '';
  return String(v).trim().slice(0, maxLen);
}

/** Validate ISO YYYY-MM (month input) or return null. */
export function nullableMonth(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(s)) return s;
  // Tolerate YYYY-MM-DD by truncating
  if (/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(s)) return s.slice(0, 7);
  return null;
}

/** Validate ISO YYYY-MM-DD or return null. */
export function nullableDate(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

/** Constrain to one of the allowed string values, with a fallback. */
export function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  const s = String(v ?? '').trim();
  return (allowed as readonly string[]).includes(s) ? (s as T) : fallback;
}

/* ─── Standard response helpers ───────────────────────────────────── */

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' } as const;

export function jsonOk<T>(body: T, init?: ResponseInit) {
  return NextResponse.json(body, { ...init, headers: { ...NO_STORE_HEADERS, ...(init?.headers || {}) } });
}

export function jsonErr(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status, headers: NO_STORE_HEADERS });
}

export function badRequest(message: string) {
  return jsonErr(message, 400);
}

/* ─── Idempotent table-ensure cache ───────────────────────────────── */

const ensured = new Set<string>();

/**
 * Run a CREATE TABLE IF NOT EXISTS once per process, then an optional ALTER
 * migration (for adding new columns to existing tables). Subsequent calls are
 * no-ops within the same process.
 * Pass a stable `key` (the table name) plus the actual SQL.
 */
export async function ensureOnce(pool: any, key: string, ddl: string, migration?: string): Promise<void> {
  if (ensured.has(key)) return;
  await pool.query(ddl);
  if (migration) {
    try { await pool.query(migration); } catch { /* column already exists — safe to ignore */ }
  }
  ensured.add(key);
}

/* ─── Numeric ID parser ───────────────────────────────────────────── */

export function parseId(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}
