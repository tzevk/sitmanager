/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { generateFeesReceiptNo } from '@/lib/fees-receipt';

export const runtime = 'nodejs';

const REFUND_NOTE = 'Refund - Admission Cancelled';

/* POST /api/fee-details/[studentId]/[feesId]/refund — { action: 'confirm' | 'reject' }
   Confirms or discards a pending refund draft created when a student is marked Cancel
   (see app/api/admission-activity/student/[id]/route.ts, createRefundDraftIfNeeded). */
export async function POST(req: NextRequest, ctx: { params: Promise<{ studentId: string; feesId: string }> }) {
  const auth = await requirePermission(req, ['report_fees.update', 'finance.update']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { studentId, feesId } = await ctx.params;
    const sid = Number(studentId);
    const fid = Number(feesId);
    if (!sid || !fid) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    if (action !== 'confirm' && action !== 'reject') {
      return NextResponse.json({ error: 'action must be "confirm" or "reject"' }, { status: 400 });
    }

    const pool = getPool();
    const [rows] = await pool.query<any[]>(
      `SELECT Fees_Id FROM s_fees_mst
       WHERE Fees_Id = ? AND Student_Id = ? AND IsDelete = 1 AND Fees_Code IS NULL AND Notes = ?
       LIMIT 1`,
      [fid, sid, REFUND_NOTE]
    );
    if (!rows.length) {
      return NextResponse.json({ error: 'Pending refund not found' }, { status: 404 });
    }

    if (action === 'reject') {
      await pool.query(`DELETE FROM s_fees_mst WHERE Fees_Id = ?`, [fid]);
      return NextResponse.json({ success: true, action: 'reject' });
    }

    const feesCode = await generateFeesReceiptNo(pool);
    const today = new Date().toISOString().slice(0, 10);
    await pool.query(
      `UPDATE s_fees_mst SET Fees_Code = ?, IsDelete = 0, RDate = ? WHERE Fees_Id = ?`,
      [feesCode, today, fid]
    );

    return NextResponse.json({ success: true, action: 'confirm', Fees_Code: feesCode });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 });
  }
}
