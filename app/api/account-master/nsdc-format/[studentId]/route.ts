/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { ensureNsdcColumns, NSDC_SOCIAL_CATEGORIES } from '@/lib/student-nsdc';

// Fields this focused NSDC-format edit page owns. Student_Name/Course/Batch/
// Admission_Dt are shown for context but edited elsewhere (student admission
// edit page) to avoid two screens fighting over the same source of truth.
const EDITABLE_FIELDS = [
  'Father_Name', 'Mother_Name', 'Sex', 'DOB', 'Aadhar_Number', 'Social_Category',
  'Present_Mobile', 'Email', 'Present_Address', 'Present_City', 'Present_State', 'Present_Pin',
  'Qualification',
] as const;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const auth = await requirePermission(req, 'nsdc_format.view');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    await ensureNsdcColumns(pool);
    const { studentId } = await params;

    const [rows] = await pool.query<any[]>(
      `SELECT
         sm.Student_Id, sm.Student_Name, sm.Father_Name, sm.Mother_Name, sm.Sex, sm.DOB,
         sm.Aadhar_Number, sm.Social_Category, sm.Present_Mobile, sm.Email,
         sm.Present_Address, sm.Present_City, sm.Present_State, sm.Present_Pin,
         sm.Qualification, sm.Batch_Code, sm.Admission_Dt, c.Course_Name
       FROM student_master sm
       LEFT JOIN course_mst c ON c.Course_Id = sm.Course_Id
       WHERE sm.Student_Id = ? AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
       LIMIT 1`,
      [Number(studentId)]
    );

    const student = (rows as any[])[0];
    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

    return NextResponse.json({ student, socialCategories: NSDC_SOCIAL_CATEGORIES });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch student';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const auth = await requirePermission(req, 'nsdc_format.update');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    await ensureNsdcColumns(pool);
    const { studentId } = await params;
    const body = await req.json().catch(() => ({}));

    const setClauses: string[] = [];
    const values: (string | null)[] = [];
    for (const field of EDITABLE_FIELDS) {
      if (!(field in body)) continue;
      const value = body[field];
      setClauses.push(`\`${field}\` = ?`);
      values.push(value === '' || value == null ? null : String(value));
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 });
    }

    if ('Social_Category' in body && body.Social_Category && !NSDC_SOCIAL_CATEGORIES.includes(body.Social_Category)) {
      return NextResponse.json({ error: `Invalid Social Category. Must be one of: ${NSDC_SOCIAL_CATEGORIES.join(', ')}` }, { status: 400 });
    }

    values.push(studentId);
    await pool.query(
      `UPDATE student_master SET ${setClauses.join(', ')} WHERE Student_Id = ?`,
      values
    );

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update student';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
