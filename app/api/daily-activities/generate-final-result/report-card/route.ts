/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

/**
 * Report-card data for one generated final result (Gen_id), matching the
 * legacy join used by the old Express `/getgendetails` endpoint: it resolves
 * Faculty1 / Faculty2 / Approve against faculty_master.Faculty_Id (not
 * office_employee_mst — the "Approved By" dropdown on the Generate Final
 * Result form saves an Emp_Id, but historical report-card rows were approved
 * by a faculty member, so this route stays faithful to the original lookup).
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'final_result.view');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const genId = searchParams.get('genId');
    if (!genId) {
      return NextResponse.json({ error: 'genId is required' }, { status: 400 });
    }

    const [rows] = await pool.query(
      `SELECT gfc.*,
              gfr.Result_date, gfr.Print_date, gfr.Start_date, gfr.End_date,
              gfr.Label1, gfr.Label2,
              fm1.Faculty_Name AS faculty1,
              fm2.Faculty_Name AS faculty2,
              ap.Faculty_Name  AS approve_by,
              cm.Course_Name, bm.Course_Description, bm.Batch_code,
              sm.Present_Address, sm.Present_City, sm.Present_Pin,
              sm.Present_State, sm.Present_Country,
              am.Roll_No
       FROM generate_final_child gfc
       LEFT JOIN generate_final_result gfr ON gfc.Gen_id = gfr.Id
       LEFT JOIN course_mst cm  ON cm.Course_Id = gfr.Course_Id
       LEFT JOIN batch_mst bm   ON bm.Batch_Id = gfr.Batch_Id
       LEFT JOIN faculty_master fm1 ON fm1.Faculty_Id = gfr.Faculty1
       LEFT JOIN faculty_master fm2 ON fm2.Faculty_Id = gfr.Faculty2
       LEFT JOIN faculty_master ap  ON ap.Faculty_Id = gfr.Approve
       LEFT JOIN student_master sm ON sm.Student_Id = gfc.Student_Id
       LEFT JOIN admission_master am ON am.Student_Id = gfc.Student_Id AND am.Batch_Id = gfc.Batch_Id
         AND (am.IsDelete = 0 OR am.IsDelete IS NULL)
       WHERE gfc.Gen_id = ?
         AND (gfc.deleted = 0 OR gfc.deleted IS NULL)
       ORDER BY gfc.Student_Name`,
      [parseInt(genId)]
    );

    const students = rows as any[];
    if (students.length === 0) {
      return NextResponse.json({ error: 'No report card data found for this result' }, { status: 404 });
    }

    return NextResponse.json({ students });
  } catch (error: any) {
    console.error('Report card GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch report card data', details: error.message },
      { status: 500 }
    );
  }
}
