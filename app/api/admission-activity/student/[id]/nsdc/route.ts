import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { ensureNsdcColumns, NSDC_SOCIAL_CATEGORIES } from '@/lib/student-nsdc';

// Focused PATCH for the two NSDC-only fields — keeps the main student PATCH
// (Active toggle) untouched and avoids overloading it with unrelated columns.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(req, 'student.update');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    await ensureNsdcColumns(pool);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const setClauses: string[] = [];
    const values: (string | null)[] = [];

    if ('Aadhar_Number' in body) {
      const v = body.Aadhar_Number;
      setClauses.push('Aadhar_Number = ?');
      values.push(v === '' || v == null ? null : String(v));
    }
    if ('Social_Category' in body) {
      const v = body.Social_Category;
      if (v && !NSDC_SOCIAL_CATEGORIES.includes(v)) {
        return NextResponse.json({ error: `Invalid Social Category. Must be one of: ${NSDC_SOCIAL_CATEGORIES.join(', ')}` }, { status: 400 });
      }
      setClauses.push('Social_Category = ?');
      values.push(v === '' || v == null ? null : String(v));
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 });
    }

    values.push(id);
    await pool.query(`UPDATE student_master SET ${setClauses.join(', ')} WHERE Student_Id = ?`, values);

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update student';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
