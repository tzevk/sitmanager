/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  try {
    // Keep permissions aligned with other consultancy sub-resources (branches/followups)
    // so edit/create-only roles can still view the tab.
    let auth = await requirePermission(req, 'consultancy.view');
    if (auth instanceof NextResponse) {
      auth = await requirePermission(req, 'consultancy.update');
      if (auth instanceof NextResponse) {
        auth = await requirePermission(req, 'consultancy.create');
        if (auth instanceof NextResponse) return auth;
      }
    }

    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const constIdRaw = searchParams.get('constId');
    const constId = constIdRaw ? Number(constIdRaw) : NaN;

    if (!constIdRaw || Number.isNaN(constId) || constId <= 0) {
      return NextResponse.json({ error: 'constId is required' }, { status: 400 });
    }

    // `cv_shortlisted.Company_Id` links to `consultant_mst.Const_Id`.
    // `cvchild` stores students (shortlisted/placement status) for that CV.
    // For consultancy student details, only show students actually placed
    // in the selected consultancy/company.
    const [rows] = await pool.query<any[]>(
      `SELECT
         cc.Id AS CvChildId,
         COALESCE(NULLIF(TRIM(s.Student_Name), ''), NULLIF(TRIM(cc.Student_Name), '')) AS StudentName,
         COALESCE(NULLIF(TRIM(cs.Course_Name), ''), NULLIF(TRIM(cvCourse.Course_Name), '')) AS CourseName,
         b.Batch_code AS BatchCode,
         YEAR(NULLIF(b.EDate, '')) AS YearOfPassing,
         s.Present_Mobile AS Mobile,
         s.Email AS Email,
         NULLIF(TRIM(s.Discipline), '') AS Discipline,
         CASE WHEN TRIM(cc.Placement) = 'Yes' THEN cv.TDate ELSE NULL END AS PlacedDate,
         COALESCE(NULLIF(TRIM(cc.Placement), ''), NULLIF(TRIM(cc.Result), '')) AS Status
       FROM cv_shortlisted cv
       INNER JOIN cvchild cc
         ON cc.CV_Id = cv.id
        AND (cc.IsDelete = 0 OR cc.IsDelete IS NULL)
       LEFT JOIN student_master s
         ON cc.Student_Id = s.Student_Id
        AND (s.IsDelete = 0 OR s.IsDelete IS NULL)
       LEFT JOIN course_mst cs
         ON s.Course_Id = cs.Course_Id
       LEFT JOIN course_mst cvCourse
         ON cv.Course_id = cvCourse.Course_Id
       LEFT JOIN batch_mst b
         ON cc.Batch_id = b.Batch_Id
        WHERE cv.Company_Id = ?
          AND TRIM(COALESCE(cc.Placement, '')) = 'Yes'
          AND (cv.IsDelete = 0 OR cv.IsDelete IS NULL)
        ORDER BY cv.id DESC, cc.Id DESC`,
      [constId]
    );

    const mapped = (rows ?? []).map((r: any) => ({
      id: r.CvChildId,
      studentName: r.StudentName || '',
      courseName: r.CourseName || '',
      batchCode: r.BatchCode || '',
      yearOfPassing: r.YearOfPassing != null ? String(r.YearOfPassing) : '',
      mobile: r.Mobile || '',
      email: r.Email || '',
      discipline: r.Discipline || '',
      placedDate: r.PlacedDate || null,
      status: r.Status || '',
    }));

    return NextResponse.json({ rows: mapped });
  } catch (err: unknown) {
    console.error('Consultancy students GET error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
