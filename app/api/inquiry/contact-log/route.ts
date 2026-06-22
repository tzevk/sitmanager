/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { apiRateLimiter } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const CONTACT_LOG_TABLE = 'inquiry_contact_log';
// Keys match the tag buttons in the inquiry listing.
const ALLOWED_CHANNELS = new Set(['call', 'mail', 'whatsapp', 'personal-inquiry']);
// Cap how many inquiry ids a single batch read may resolve, to keep the IN() bounded.
const MAX_IDS = 200;

let tableReady = false;
async function ensureContactLogTable(pool: ReturnType<typeof getPool>): Promise<void> {
  if (tableReady) return;
  await pool.query(
    `CREATE TABLE IF NOT EXISTS ${CONTACT_LOG_TABLE} (
       Id INT AUTO_INCREMENT PRIMARY KEY,
       Inquiry_Id INT NOT NULL,
       Channel VARCHAR(40) NOT NULL,
       Created_By INT NULL,
       Created_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
       KEY idx_inquiry_channel (Inquiry_Id, Channel)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );
  tableReady = true;
}

function parseIds(raw: string | null): number[] {
  if (!raw) return [];
  const seen = new Set<number>();
  for (const part of raw.split(',')) {
    const n = Number(part.trim());
    if (Number.isInteger(n) && n > 0) seen.add(n);
    if (seen.size >= MAX_IDS) break;
  }
  return [...seen];
}

// GET — batched contact summary for the inquiry ids on the current page.
// Returns { contacts: { [inquiryId]: { [channel]: { count, lastAt } } } }.
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'inquiry.view');
    if (auth instanceof NextResponse) return auth;

    const ids = parseIds(req.nextUrl.searchParams.get('inquiryIds'));
    if (ids.length === 0) return NextResponse.json({ contacts: {} });

    const pool = getPool();
    await ensureContactLogTable(pool);

    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await pool.query(
      `SELECT Inquiry_Id, Channel, COUNT(*) AS cnt, MAX(Created_At) AS lastAt
       FROM ${CONTACT_LOG_TABLE}
       WHERE Inquiry_Id IN (${placeholders})
       GROUP BY Inquiry_Id, Channel`,
      ids
    ) as [any[], any];

    const contacts: Record<number, Record<string, { count: number; lastAt: string | null }>> = {};
    for (const r of rows as any[]) {
      const id = Number(r.Inquiry_Id);
      const channel = String(r.Channel);
      if (!ALLOWED_CHANNELS.has(channel)) continue;
      (contacts[id] ??= {})[channel] = {
        count: Number(r.cnt) || 0,
        lastAt: r.lastAt ? new Date(r.lastAt).toISOString() : null,
      };
    }

    return NextResponse.json({ contacts });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Contact log GET error:', err);
    return NextResponse.json({ error: 'Failed to load contact log', details: message }, { status: 500 });
  }
}

// POST — record a single contact attempt: { inquiryId, channel }.
export async function POST(req: NextRequest) {
  try {
    const rateLimited = await apiRateLimiter(req);
    if (rateLimited) return rateLimited;

    const auth = await requirePermission(req, ['inquiry.update', 'inquiry.edit']);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json().catch(() => ({}));
    const inquiryId = Number(body?.inquiryId ?? body?.Student_Id);
    const channel = String(body?.channel ?? '').trim();

    if (!Number.isInteger(inquiryId) || inquiryId <= 0) {
      return NextResponse.json({ error: 'Valid inquiryId is required' }, { status: 400 });
    }
    if (!ALLOWED_CHANNELS.has(channel)) {
      return NextResponse.json({ error: 'Invalid channel' }, { status: 400 });
    }

    const pool = getPool();
    await ensureContactLogTable(pool);

    const [result] = await pool.query(
      `INSERT INTO ${CONTACT_LOG_TABLE} (Inquiry_Id, Channel, Created_By) VALUES (?, ?, ?)`,
      [inquiryId, channel, auth.session.userId ?? null]
    ) as [any, any];

    return NextResponse.json({
      success: true,
      id: (result as any).insertId,
      channel,
      lastAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Contact log POST error:', err);
    return NextResponse.json({ error: 'Failed to record contact', details: message }, { status: 500 });
  }
}
