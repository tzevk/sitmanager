import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { generateVoucherNo } from '@/lib/cash-voucher';

// GET — preview what the Sr. No. would be right now, without reserving it.
// The actual number is (re)computed fresh at save time, so this is just a display
// convenience for the Add form. Matches the legacy scheme exactly: scoped by the
// current server month/year (created_date), not any date the form has selected.
export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'finance.view');
  if (auth instanceof NextResponse) return auth;

  try {
    const pool = getPool();
    const voucherno = await generateVoucherNo(pool);
    return NextResponse.json({ voucherno });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
