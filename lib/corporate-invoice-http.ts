import { NextResponse } from 'next/server';

/** Maps corporate-invoice service errors to JSON responses (status 400 for validation errors). */
export function invoiceErr(err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : fallback;
  const status = (err as { status?: number }).status ?? 500;
  if (status >= 500) console.error(`[corporate-invoices] ${fallback}:`, err);
  return NextResponse.json({ error: status >= 500 ? fallback : message }, { status });
}
