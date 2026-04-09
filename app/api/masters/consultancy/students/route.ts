/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

async function getRelatedConsultancyIds(pool: ReturnType<typeof getPool>, constId: number): Promise<number[]> {
  const ids = new Set<number>([constId]);

  const [currentRows] = await pool.query<any[]>(
    `SELECT Comp_Name
     FROM consultant_mst
     WHERE Const_Id = ?
     LIMIT 1`,
    [constId]
  );

  const companyName = String(currentRows?.[0]?.Comp_Name || '').trim();
  if (!companyName) return Array.from(ids);

  const tokens = companyName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4)
    .slice(0, 3);

  if (tokens.length === 0) return Array.from(ids);

  const tokenWhere = tokens.map(() => 'LOWER(Comp_Name) LIKE ?').join(' OR ');
  const [rows] = await pool.query<any[]>(
    `SELECT Const_Id
     FROM consultant_mst
     WHERE (IsDelete = 0 OR IsDelete IS NULL)
       AND (${tokenWhere})
     LIMIT 100`,
    tokens.map((t) => `%${t}%`)
  );

  for (const r of rows ?? []) {
    const id = Number(r?.Const_Id);
    if (Number.isFinite(id) && id > 0) ids.add(id);
  }

  return Array.from(ids);
}

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

    const relatedConstIds = await getRelatedConsultancyIds(pool, constId);

    // `cv_shortlisted.Company_Id` links to `consultant_mst.Const_Id`.
    // `cvchild` stores students (shortlisted/placement status) for that CV.
    const [rows] = await pool.query<any[]>(
      `SELECT
         cc.Id AS CvChildId,
         COALESCE(NULLIF(TRIM(s.Student_Name), ''), NULLIF(TRIM(cc.Student_Name), '')) AS StudentName,
         COALESCE(NULLIF(TRIM(cs.Course_Name), ''), NULLIF(TRIM(cvCourse.Course_Name), '')) AS CourseName,
         b.Batch_code AS BatchCode,
         YEAR(NULLIF(b.EDate, '')) AS YearOfPassing,
         s.Present_Mobile AS Mobile,
         s.Email AS Email,
         COALESCE(NULLIF(TRIM(md.Deciplin), ''), NULLIF(TRIM(s.Discipline), '')) AS Discipline,
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
       LEFT JOIN MST_Deciplin md
         ON md.Id = CAST(NULLIF(TRIM(s.Discipline), '') AS UNSIGNED)
       WHERE cv.Company_Id IN (${relatedConstIds.map(() => '?').join(',')})
         AND (cv.IsDelete = 0 OR cv.IsDelete IS NULL)
       ORDER BY cv.id DESC, cc.Id DESC`,
      relatedConstIds
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
