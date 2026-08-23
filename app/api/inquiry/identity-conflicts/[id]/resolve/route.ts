/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { getPool, invalidateCache } from '@/lib/db';
import { resolveInquiryTableName } from '@/lib/services/inquiry.service';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(req, ['inquiry.update', 'inquiry.edit']);
    if (auth instanceof NextResponse) return auth;

    const { id: idParam } = await context.params;
    const id = parseInt(idParam, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: 'Invalid conflict id' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const personId = Number(body?.personId);
    if (!Number.isInteger(personId) || personId <= 0) {
      return NextResponse.json({ error: 'A valid personId is required' }, { status: 400 });
    }

    const pool = getPool();
    const inquiryTable = await resolveInquiryTableName(pool);

    const [conflictRows] = await pool.query(
      `SELECT Inquiry_Id, Mobile_Person_Id, Email_Person_Id FROM person_identity_conflicts
       WHERE Id = ? AND Status = 'pending' LIMIT 1`,
      [id]
    );
    const conflict = (conflictRows as any[])[0];
    if (!conflict) {
      return NextResponse.json({ error: 'Conflict not found or already resolved' }, { status: 404 });
    }
    if (personId !== conflict.Mobile_Person_Id && personId !== conflict.Email_Person_Id) {
      return NextResponse.json({ error: 'personId must be one of the two flagged candidates' }, { status: 400 });
    }

    await pool.query(
      `UPDATE \`${inquiryTable}\` SET Person_Id = ? WHERE Inquiry_Id = ?`,
      [personId, conflict.Inquiry_Id]
    );
    await pool.query(
      `UPDATE person_identity_conflicts SET Status = 'resolved', Resolved_At = NOW() WHERE Id = ?`,
      [id]
    );

    invalidateCache('api:inquiry');

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Identity conflict resolve error:', error);
    return NextResponse.json({ error: 'Failed to resolve conflict', details: message }, { status: 500 });
  }
}
