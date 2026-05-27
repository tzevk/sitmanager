/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getPool } from '@/lib/db';
import { requireAuth, requirePermission } from '@/lib/api-auth';
import { cache, cacheTTL } from '@/lib/cache';

type StudentInterviewStatus = 'Placed' | 'Interview Call' | '';

function formatDisplayDate(value: unknown): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

function sanitizeFilePart(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'all';
}

async function buildWorkbook(params: {
  courseName: string;
  batchName: string;
  yearLabel: string;
  rows: any[];
}) {
  const { courseName, batchName, yearLabel, rows } = params;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SIT Manager';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Student Interview Report', {
    views: [{ state: 'frozen', ySplit: 3 }],
  });

  const headers = ['Code', 'Student Name', 'Mobile', 'Email', 'Qualification', 'Discipline', 'Course', 'Batch', 'Batch Start', 'Final Grade', 'Status', 'Interview Date', 'Company', 'CV Sent', 'Interviewed', 'Placed', 'Remark'];
  const thin: ExcelJS.Border = { style: 'thin', color: { argb: 'FFB0B0B0' } };
  const allBorders: Partial<ExcelJS.Borders> = { top: thin, bottom: thin, left: thin, right: thin };

  worksheet.mergeCells(1, 1, 1, headers.length);
  const title = worksheet.getCell('A1');
  title.value = 'Student Search For Interview Report';
  title.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  title.alignment = { vertical: 'middle', horizontal: 'center' };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E3093' } };
  worksheet.getRow(1).height = 28;

  worksheet.mergeCells(2, 1, 2, headers.length);
  const subTitle = worksheet.getCell('A2');
  subTitle.value = `Course: ${courseName}   |   Batch: ${batchName}   |   Year: ${yearLabel}   |   Total Records: ${rows.length}`;
  subTitle.font = { italic: true, size: 11, color: { argb: 'FF2E3093' } };
  subTitle.alignment = { vertical: 'middle', horizontal: 'center' };
  subTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
  worksheet.getRow(2).height = 20;

  const headerRow = worksheet.getRow(3);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2A6BB5' } };
    cell.border = allBorders;
  });
  headerRow.height = 24;

  rows.forEach((row, index) => {
    const excelRow = worksheet.getRow(index + 4);
    const previousRow = index > 0 ? rows[index - 1] : null;
    const repeatedStudent = previousRow && previousRow.Student_Id === row.Student_Id;
    const values = [
      repeatedStudent ? '' : (row.Student_Code || ''),
      repeatedStudent ? '' : (row.Student_Name || ''),
      repeatedStudent ? '' : (row.Present_Mobile || ''),
      repeatedStudent ? '' : (row.Email || ''),
      repeatedStudent ? '' : (row.Qualification || ''),
      repeatedStudent ? '' : (row.Discipline_Name || ''),
      repeatedStudent ? '' : (row.Course_Name || ''),
      repeatedStudent ? '' : (row.Batch_code || ''),
      repeatedStudent ? '' : formatDisplayDate(row.Batch_Start),
      repeatedStudent ? '' : (row.Final_Grade || ''),
      row.Shortlist_Status || '',
      formatDisplayDate(row.Shortlist_Date),
      row.Company || '',
      row.CV_Sent || '',
      row.Interviewed || '',
      row.Placed || '',
      row.Shortlist_Remark || '',
    ];

    values.forEach((value, valueIndex) => {
      const cell = excelRow.getCell(valueIndex + 1);
      cell.value = value;
      cell.alignment = { vertical: 'middle', wrapText: true };
      cell.border = allBorders;
    });

    const status = String(row.Shortlist_Status || '').trim();
    const fill = status === 'Placed'
      ? { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFEDD5' } }
      : status === 'Interview Call'
        ? { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFDE7F3' } }
        : index % 2 === 1
          ? { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF7F9FC' } }
          : null;

    if (fill) {
      excelRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = fill;
      });
    }
  });

  [16, 28, 16, 28, 24, 24, 24, 14, 14, 12, 16, 14, 28, 12, 12, 12, 34].forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width;
  });

  return workbook.xlsx.writeBuffer();
}

async function buildExportResponse(params: {
  pool: ReturnType<typeof getPool>;
  courseId: string;
  batchId: string;
  year: string;
  includeAllCourses: boolean;
  rows: any[];
}) {
  const { pool, courseId, batchId, year, includeAllCourses, rows } = params;
  const [[courseRows], [batchRows]] = await Promise.all([
    includeAllCourses
      ? Promise.resolve([[]] as unknown as any)
      : pool.query<any[]>(`SELECT Course_Name FROM course_mst WHERE Course_Id = ? LIMIT 1`, [parseInt(courseId, 10)]),
    pool.query<any[]>(`SELECT Batch_code FROM batch_mst WHERE Batch_Id = ? LIMIT 1`, [parseInt(batchId, 10)]),
  ]);
  const courseName = includeAllCourses
    ? 'All Courses'
    : String(courseRows?.[0]?.Course_Name || '').trim() || `Course ${courseId}`;
  const batchName = String(batchRows?.[0]?.Batch_code || '').trim() || `Batch ${batchId}`;
  const yearLabel = year || 'All Years';
  const buffer = await buildWorkbook({ courseName, batchName, yearLabel, rows });
  const fileName = `Student_Search_For_Interview_${sanitizeFilePart(courseName)}_${sanitizeFilePart(batchName)}_${sanitizeFilePart(yearLabel)}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}

let educationTableNameCache: string | null | undefined;
let disciplineTableNameCache: string | null | undefined;

async function resolveOptionalTableName(
  pool: ReturnType<typeof getPool>,
  lowerTableName: string,
  preferredTableName: string
): Promise<string | null> {
  try {
    const [rows] = await pool.query(
      `SELECT TABLE_NAME
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND LOWER(TABLE_NAME) = ?
       ORDER BY CASE WHEN TABLE_NAME = ? THEN 0 ELSE 1 END
       LIMIT 1`,
      [lowerTableName, preferredTableName]
    );
    return String((rows as any[])[0]?.TABLE_NAME || '').trim() || null;
  } catch {
    return null;
  }
}

async function resolveEducationTableName(pool: ReturnType<typeof getPool>): Promise<string | null> {
  if (educationTableNameCache !== undefined) return educationTableNameCache;
  educationTableNameCache = await resolveOptionalTableName(pool, 'mst_education', 'MST_Education');
  return educationTableNameCache;
}

async function resolveDisciplineTableName(pool: ReturnType<typeof getPool>): Promise<string | null> {
  if (disciplineTableNameCache !== undefined) return disciplineTableNameCache;
  disciplineTableNameCache = await resolveOptionalTableName(pool, 'mst_deciplin', 'MST_Deciplin');
  return disciplineTableNameCache;
}

export async function GET(req: NextRequest) {
  try {
    const pool = getPool();
    const url = req.nextUrl;
    const options = url.searchParams.get('options');
    const exportMode = (url.searchParams.get('export') || '').trim().toLowerCase() === 'excel';

    if (options) {
      const auth = await requireAuth(req);
      if (auth instanceof NextResponse) return auth;

      if (options === 'courses') {
        const cacheKey = 'report:student-interview:options:courses';
        const cachedData = await cache.get<{ courses: unknown }>(cacheKey);
        if (cachedData) return NextResponse.json(cachedData, { headers: { 'X-Cache': 'HIT' } });

        const [rows] = await pool.query(
          `SELECT DISTINCT c.Course_Id AS id, c.Course_Name AS name
           FROM admission_master am
           INNER JOIN student_master s
             ON s.Student_Id = am.Student_Id
            AND (s.IsDelete = 0 OR s.IsDelete IS NULL)
           INNER JOIN course_mst c
             ON c.Course_Id = s.Course_Id
            AND (c.IsDelete = 0 OR c.IsDelete IS NULL)
           WHERE (am.IsDelete = 0 OR am.IsDelete IS NULL)
           ORDER BY c.Course_Name`
        );
        const responseData = { courses: rows };
        await cache.set(cacheKey, responseData, cacheTTL.medium);
        return NextResponse.json(responseData, { headers: { 'X-Cache': 'MISS' } });
      }

      if (options === 'batches') {
        const courseId = url.searchParams.get('courseId');
        const normalizedCourseId = (courseId || '').trim().toLowerCase();
        const cacheKey = `report:student-interview:options:batches:${normalizedCourseId || 'all'}`;
        const cachedData = await cache.get<{ batches: unknown }>(cacheKey);
        if (cachedData) return NextResponse.json(cachedData, { headers: { 'X-Cache': 'HIT' } });

        const [rows] = normalizedCourseId && normalizedCourseId !== 'all'
          ? await pool.query(
              `SELECT DISTINCT b.Batch_Id AS id, b.Batch_code AS name
               FROM admission_master am
               INNER JOIN student_master s
                 ON s.Student_Id = am.Student_Id
                AND (s.IsDelete = 0 OR s.IsDelete IS NULL)
               INNER JOIN batch_mst b
                 ON b.Batch_Id = am.Batch_Id
                AND (b.IsDelete = 0 OR b.IsDelete IS NULL)
               WHERE (am.IsDelete = 0 OR am.IsDelete IS NULL)
                 AND s.Course_Id = ?
               ORDER BY b.Batch_Id DESC`,
              [parseInt(normalizedCourseId, 10)]
            )
          : await pool.query(
              `SELECT DISTINCT b.Batch_Id AS id, b.Batch_code AS name
               FROM admission_master am
               INNER JOIN batch_mst b
                 ON b.Batch_Id = am.Batch_Id
                AND (b.IsDelete = 0 OR b.IsDelete IS NULL)
               WHERE (am.IsDelete = 0 OR am.IsDelete IS NULL)
               ORDER BY b.Batch_Id DESC`
            );
        const responseData = { batches: rows };
        await cache.set(cacheKey, responseData, cacheTTL.medium);
        return NextResponse.json(responseData, { headers: { 'X-Cache': 'MISS' } });
      }

      if (options === 'years') {
        const cacheKey = 'report:student-interview:options:years';
        const cachedData = await cache.get<{ years: unknown }>(cacheKey);
        if (cachedData) return NextResponse.json(cachedData, { headers: { 'X-Cache': 'HIT' } });

        const [rows] = await pool.query(
          `SELECT DISTINCT YEAR(SDate) AS yr
           FROM admission_master am
           INNER JOIN batch_mst b
             ON b.Batch_Id = am.Batch_Id
            AND (b.IsDelete = 0 OR b.IsDelete IS NULL)
           WHERE (am.IsDelete = 0 OR am.IsDelete IS NULL)
             AND b.SDate IS NOT NULL
           ORDER BY yr DESC`
        );
        const responseData = { years: (rows as any[]).map((r) => r.yr).filter(Boolean) };
        await cache.set(cacheKey, responseData, cacheTTL.medium);
        return NextResponse.json(responseData, { headers: { 'X-Cache': 'MISS' } });
      }

      if (options === 'disciplines') {
        const cacheKey = 'report:student-interview:options:disciplines';
        const cachedData = await cache.get<{ disciplines: unknown }>(cacheKey);
        if (cachedData) return NextResponse.json(cachedData, { headers: { 'X-Cache': 'HIT' } });

        const [rows] = await pool.query(
          `SELECT Id AS id, Deciplin AS name
           FROM MST_Deciplin
           WHERE IsDelete = 0 OR IsDelete IS NULL
           ORDER BY Deciplin`
        );
        const responseData = { disciplines: rows };
        await cache.set(cacheKey, responseData, cacheTTL.medium);
        return NextResponse.json(responseData, { headers: { 'X-Cache': 'MISS' } });
      }

      if (options === 'qualifications') {
        const cacheKey = 'report:student-interview:options:qualifications';
        const cachedData = await cache.get<{ qualifications: unknown }>(cacheKey);
        if (cachedData) return NextResponse.json(cachedData, { headers: { 'X-Cache': 'HIT' } });

        const [rows] = await pool.query(
          `SELECT DISTINCT TRIM(Qualification) AS q
           FROM student_master
           WHERE Qualification IS NOT NULL AND TRIM(Qualification) != '' AND TRIM(Qualification) != 'NULL'
           ORDER BY q`
        );
        const responseData = { qualifications: (rows as any[]).map((r) => r.q) };
        await cache.set(cacheKey, responseData, cacheTTL.medium);
        return NextResponse.json(responseData, { headers: { 'X-Cache': 'MISS' } });
      }

      return NextResponse.json({ error: 'Unknown options parameter' }, { status: 400 });
    }

    const auth = await requirePermission(req, exportMode ? 'report_student_interview.export' : 'report_student_interview.view');
    if (auth instanceof NextResponse) return auth;

    const courseId = (url.searchParams.get('courseId') || '').trim();
    const batchId = url.searchParams.get('batchId');
    const year = (url.searchParams.get('year') || '').trim();

    if (!batchId) {
      return NextResponse.json({ error: 'Batch is required.' }, { status: 400 });
    }

    const conditions: string[] = ['(s.IsDelete = 0 OR s.IsDelete IS NULL)', '(am.IsDelete = 0 OR am.IsDelete IS NULL)'];
    const params: any[] = [];
    const includeAllCourses = !courseId || courseId.toLowerCase() === 'all' || courseId === '0';

    conditions.push('am.Batch_Id = ?');
    params.push(parseInt(batchId, 10));

    if (!includeAllCourses) {
      conditions.push('s.Course_Id = ?');
      params.push(parseInt(courseId, 10));
    }

    if (year) {
      conditions.push('YEAR(b.SDate) = ?');
      params.push(parseInt(year, 10));
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const cacheKey = `report:student-interview:data:${includeAllCourses ? 'all' : courseId}:${batchId}:${year || 'all'}`;
    const cachedData = await cache.get<{ rows: unknown }>(cacheKey);
    if (cachedData) {
      if (exportMode) {
        return buildExportResponse({
          pool,
          courseId,
          batchId,
          year,
          includeAllCourses,
          rows: (cachedData.rows as any[]) || [],
        });
      }
      return NextResponse.json(cachedData, { headers: { 'X-Cache': 'HIT' } });
    }

    const [educationTableName, disciplineTableName] = await Promise.all([
      resolveEducationTableName(pool),
      resolveDisciplineTableName(pool),
    ]);
    const qualificationExpr = educationTableName
      ? 'COALESCE(me.Education, s.Qualification)'
      : 's.Qualification';
    const disciplineExpr = disciplineTableName
      ? 'COALESCE(md.Deciplin, s.Discipline)'
      : 's.Discipline';
    const educationJoin = educationTableName
      ? `LEFT JOIN \`${educationTableName}\` me ON me.Id = aq.Qualification`
      : '';
    const disciplineJoin = disciplineTableName
      ? `LEFT JOIN \`${disciplineTableName}\` md ON md.Id = COALESCE(aq.Discipline, CAST(NULLIF(TRIM(s.Discipline), '') AS UNSIGNED))`
      : '';
    const [rows] = await pool.query(
      `SELECT
         CONCAT(s.Student_Id, '-', COALESCE(shortlist.CV_Child_Id, 0), '-', COALESCE(shortlist.CV_Id, 0)) AS Row_Key,
         s.Student_Id,
         am.Student_Code,
         s.Student_Name,
         s.Present_Mobile,
         s.Email,
         ${qualificationExpr} AS Qualification,
         ${disciplineExpr} AS Discipline_Name,
         c.Course_Name,
         b.Batch_code,
         b.SDate AS Batch_Start,
         b.EDate AS Batch_End,
         final_result.Final_Result_Percent,
         final_result.Grade AS Final_Grade,
         s.PlacementRemark AS Placement_Remark,
         shortlist.Shortlist_Date,
         shortlist.CV_Sent,
         shortlist.Interviewed,
         shortlist.Placed,
         shortlist.Shortlist_Remark,
         CASE
           WHEN COALESCE(shortlist.StatusRank, 0) >= 2 THEN 'Placed'
           WHEN COALESCE(shortlist.StatusRank, 0) = 1 THEN 'Interview Call'
           ELSE ''
         END AS Shortlist_Status,
         shortlist.Company,
         '' AS Designation
       FROM student_master s
       INNER JOIN admission_master am ON am.Student_Id = s.Student_Id
       LEFT JOIN batch_mst b ON b.Batch_Id = am.Batch_Id
       LEFT JOIN course_mst c ON c.Course_Id = s.Course_Id
       LEFT JOIN (
         SELECT aq2.Student_id, aq2.Qualification, aq2.Discipline
         FROM awt_academicqualification aq2
         INNER JOIN (
           SELECT MAX(id) AS id FROM awt_academicqualification GROUP BY Student_id
         ) aqlatest ON aqlatest.id = aq2.id
       ) aq ON aq.Student_id = s.Student_Id
       LEFT JOIN (
         SELECT
           cc.Id AS CV_Child_Id,
           cc.CV_Id,
           cc.Student_Id,
           cv.TDate AS Shortlist_Date,
           COALESCE(NULLIF(TRIM(cv.CompanyName), ''), cm.Comp_Name, '') AS Company,
           TRIM(COALESCE(cc.Sended, '')) AS CV_Sent,
           TRIM(COALESCE(cc.Result, '')) AS Interviewed,
           TRIM(COALESCE(cc.Placement, '')) AS Placed,
           COALESCE(cc.Remark, '') AS Shortlist_Remark,
           CASE
             WHEN LOWER(TRIM(COALESCE(cc.Placement, ''))) = 'yes' THEN 2
             WHEN LOWER(TRIM(COALESCE(cc.Result, ''))) = 'yes'
               OR LOWER(TRIM(COALESCE(cc.Sended, ''))) = 'yes' THEN 1
             ELSE 0
           END AS StatusRank
         FROM cvchild cc
         INNER JOIN cv_shortlisted cv
           ON cv.id = cc.CV_Id
          AND (cv.IsDelete = 0 OR cv.IsDelete IS NULL)
         LEFT JOIN consultant_mst cm
           ON cm.Const_Id = cv.Company_Id
         WHERE (cc.IsDelete = 0 OR cc.IsDelete IS NULL)
           AND (
             LOWER(TRIM(COALESCE(cc.Sended, ''))) = 'yes'
             OR LOWER(TRIM(COALESCE(cc.Result, ''))) = 'yes'
             OR LOWER(TRIM(COALESCE(cc.Placement, ''))) = 'yes'
           )
       ) shortlist ON shortlist.Student_Id = s.Student_Id
       LEFT JOIN (
         SELECT latest.Batch_Id, latest.Student_Code, latest.Final_Result_Percent, latest.Grade
         FROM (
           SELECT
             gr.Batch_Id,
             gc.Student_Code,
             gc.Final_Result_Percent,
             gc.Grade,
             ROW_NUMBER() OVER (
               PARTITION BY gr.Batch_Id, gc.Student_Code
               ORDER BY gc.Gen_id DESC, gc.Id DESC
             ) AS rn
           FROM generate_final_result gr
           INNER JOIN generate_final_child gc ON gc.Gen_id = gr.Id
           WHERE COALESCE(gr.IsDelete, 0) = 0
             AND COALESCE(gc.deleted, 0) = 0
         ) latest
         WHERE latest.rn = 1
       ) final_result
         ON final_result.Batch_Id = am.Batch_Id
        AND final_result.Student_Code = am.Student_Code
       ${educationJoin}
       ${disciplineJoin}
       ${where}
       ORDER BY
         CASE
           WHEN TRIM(COALESCE(final_result.Final_Result_Percent, '')) REGEXP '^-?[0-9]+(\\.[0-9]+)?$'
           THEN CAST(TRIM(final_result.Final_Result_Percent) AS DECIMAL(10,2))
           ELSE NULL
         END DESC,
         s.Student_Name,
         shortlist.Shortlist_Date DESC,
         shortlist.Company,
         b.Batch_code,
         s.Student_Id`,
      params
    );

    const responseData = { rows };
    await cache.set(cacheKey, responseData, cacheTTL.short);

    if (exportMode) {
      return buildExportResponse({
        pool,
        courseId,
        batchId,
        year,
        includeAllCourses,
        rows: rows as any[],
      });
    }

    return NextResponse.json(responseData, { headers: { 'X-Cache': 'MISS' } });
  } catch (err: unknown) {
    console.error('[Student Interview Report] GET error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}