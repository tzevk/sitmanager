import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'finance.view');
  if (auth instanceof NextResponse) return auth;

  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT id, title FROM sit_account_head WHERE deleted = 0 ORDER BY title ASC`
    );
    return NextResponse.json({ accountHeads: rows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
