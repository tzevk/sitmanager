import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { generateVoucherNo } from '@/lib/cash-voucher';

// GET — preview what the Sr. No. would be for a given date, without reserving it.
// The actual number is (re)computed fresh at save time, so this is just a display
// convenience for the Add form.
export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'finance.view');
  if (auth instanceof NextResponse) return auth;

  try {
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date')?.trim() || new Date().toISOString().slice(0, 10);

    const voucherno = await generateVoucherNo(pool, date);
    return NextResponse.json({ voucherno });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
