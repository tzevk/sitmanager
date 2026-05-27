/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireAuth, requirePermission } from '@/lib/api-auth';
import { cache, cacheTTL } from '@/lib/cache';

export async function GET(req: NextRequest) {
  try {
    const pool = getPool();
    const url = req.nextUrl;
    const options = url.searchParams.get('options');

    if (options) {
      const auth = await requireAuth(req);
      if (auth instanceof NextResponse) return auth;

      if (options === 'courses') {
        const cacheKey = 'report:student-interview:options:courses';
        const cachedData = await cache.get<{ courses: unknown }>(cacheKey);
        if (cachedData) return NextResponse.json(cachedData, { headers: { 'X-Cache': 'HIT' } });

        const [rows] = await pool.query(
          `SELECT Course_Id AS id, Course_Name AS name
           FROM course_mst
           WHERE (IsDelete = 0 OR IsDelete IS NULL)
           ORDER BY Course_Name`
        );
        const responseData = { courses: rows };
        await cache.set(cacheKey, responseData, cacheTTL.medium);
        return NextResponse.json(responseData, { headers: { 'X-Cache': 'MISS' } });
      }

      if (options === 'batches') {
        const courseId = url.searchParams.get('courseId');
        if (!courseId) return NextResponse.json({ batches: [] });
        const cacheKey = `report:student-interview:options:batches:${courseId}`;
        const cachedData = await cache.get<{ batches: unknown }>(cacheKey);
        if (cachedData) return NextResponse.json(cachedData, { headers: { 'X-Cache': 'HIT' } });

        const [rows] = await pool.query(
          `SELECT Batch_Id AS id, Batch_code AS name
           FROM batch_mst
           WHERE Course_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)
           ORDER BY Batch_Id DESC`,
          [parseInt(courseId, 10)]
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
           FROM batch_mst
           WHERE SDate IS NOT NULL AND (IsDelete = 0 OR IsDelete IS NULL)
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

    const auth = await requirePermission(req, 'report_student_interview.view');
    if (auth instanceof NextResponse) return auth;

    const courseId = url.searchParams.get('courseId');
    const batchId = url.searchParams.get('batchId');
    const year = url.searchParams.get('year');
    const qualification = url.searchParams.get('qualification');
    const discipline = url.searchParams.get('discipline');

    if (!courseId || !batchId || !year || !qualification || !discipline) {
      return NextResponse.json({ error: 'Course, Batch, Year, Qualification, and Discipline are required.' }, { status: 400 });
    }

    const conditions: string[] = ['(s.IsDelete = 0 OR s.IsDelete IS NULL)', '(am.IsDelete = 0 OR am.IsDelete IS NULL)'];
    const params: any[] = [];

    conditions.push('s.Course_Id = ?');
    params.push(parseInt(courseId, 10));
    conditions.push('am.Batch_Id = ?');
    params.push(parseInt(batchId, 10));
    conditions.push('YEAR(b.SDate) = ?');
    params.push(parseInt(year, 10));
    conditions.push('TRIM(s.Qualification) = ?');
    params.push(qualification);
    conditions.push('s.Discipline = ?');
    params.push(parseInt(discipline, 10));

    const where = `WHERE ${conditions.join(' AND ')}`;
    const cacheKey = `report:student-interview:data:${courseId}:${batchId}:${year}:${qualification}:${discipline}`;
    const cachedData = await cache.get<{ rows: unknown }>(cacheKey);
    if (cachedData) return NextResponse.json(cachedData, { headers: { 'X-Cache': 'HIT' } });

    const [rows] = await pool.query(
      `SELECT
         s.Student_Id,
         am.Student_Code,
         s.Student_Name,
         s.Present_Mobile,
         s.Email,
         COALESCE(me.Education, s.Qualification) AS Qualification,
         COALESCE(md.Deciplin, s.Discipline) AS Discipline_Name,
         c.Course_Name,
         b.Batch_code,
         b.SDate AS Batch_Start,
         b.EDate AS Batch_End,
         s.SitPerformance AS SIT_Performance,
         s.PlacementRemark AS Placement_Remark,
         ci.Company,
         ci.Designation,
         ci.BussinessNature,
         ci.Duration
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
       LEFT JOIN MST_Education me ON me.Id = aq.Qualification
       LEFT JOIN MST_Deciplin md ON md.Id = COALESCE(aq.Discipline, CAST(NULLIF(TRIM(s.Discipline), '') AS UNSIGNED))
       LEFT JOIN (
         SELECT ci2.student_id, ci2.Company, ci2.Designation, ci2.BussinessNature, ci2.Duration
         FROM Company_info ci2
         INNER JOIN (
           SELECT MAX(id) AS id FROM Company_info GROUP BY student_id
         ) latest ON latest.id = ci2.id
       ) ci ON ci.student_id = s.Student_Id
       ${where}
       ORDER BY b.Batch_code, s.Student_Name`,
      params
    );

    const responseData = { rows };
    await cache.set(cacheKey, responseData, cacheTTL.short);
    return NextResponse.json(responseData, { headers: { 'X-Cache': 'MISS' } });
  } catch (err: unknown) {
    console.error('[Student Interview Report] GET error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}