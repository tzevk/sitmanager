/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { cache, cacheTTL } from '@/lib/cache';
import { logReportCacheTiming } from '@/lib/report-timing';

async function resolveInquiryTableName(pool: any): Promise<string> {
  const [rows] = await pool.query(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND LOWER(TABLE_NAME) = 'student_inquiry'
     ORDER BY CASE WHEN TABLE_NAME = 'Student_Inquiry' THEN 0 ELSE 1 END
     LIMIT 1`
  );
  return String((rows as any[])[0]?.TABLE_NAME || '').trim() || 'Student_Inquiry';
}

export async function GET() {
  try {
    const startedAt = Date.now();
    const cacheKey = 'report:inquiry:options';
    const cachedData = await cache.get<any>(cacheKey);
    if (cachedData) {
      logReportCacheTiming('inquiry.options', startedAt, 'HIT');
      return NextResponse.json(cachedData, {
        headers: { 'Cache-Control': 'public, max-age=120, stale-while-revalidate=300', 'X-Cache': 'HIT' },
      });
    }

    const pool = getPool();
    const inquiryTable = await resolveInquiryTableName(pool);

    const [coursesRes, typesRes, fromRes, categoriesRes] = await Promise.all([
      pool.query(
        `SELECT DISTINCT c.Course_Id as id, c.Course_Name as name
         FROM ${inquiryTable} si
         JOIN course_mst c ON si.Course_Id = c.Course_Id
         WHERE (si.IsDelete = 0 OR si.IsDelete IS NULL)
           AND c.Course_Name IS NOT NULL AND c.Course_Name != ''
         ORDER BY c.Course_Name`
      ),
      pool.query(
        `SELECT DISTINCT Inquiry_Type
         FROM ${inquiryTable}
         WHERE (IsDelete = 0 OR IsDelete IS NULL)
           AND Inquiry_Type IS NOT NULL AND TRIM(Inquiry_Type) != ''
         ORDER BY Inquiry_Type`
      ),
      pool.query(
        `SELECT DISTINCT Inquiry_From
         FROM ${inquiryTable}
         WHERE (IsDelete = 0 OR IsDelete IS NULL)
           AND Inquiry_From IS NOT NULL AND TRIM(Inquiry_From) != ''
         ORDER BY Inquiry_From`
      ),
      pool.query(
        `SELECT DISTINCT b.Category
         FROM ${inquiryTable} si
         JOIN batch_mst b ON si.Batch_Code = b.Batch_Id
         WHERE (si.IsDelete = 0 OR si.IsDelete IS NULL)
           AND b.Category IS NOT NULL AND b.Category != ''
         ORDER BY b.Category`
      ),
    ]);

    const responseData = {
      courses:      (coursesRes[0]    as any[]).map((r) => ({ id: r.id, name: r.name })),
      inquiryTypes: (typesRes[0]      as any[]).map((r) => r.Inquiry_Type),
      inquiryModes: (fromRes[0]       as any[]).map((r) => r.Inquiry_From),
      categories:   (categoriesRes[0] as any[]).map((r) => r.Category),
    };

    await cache.set(cacheKey, responseData, cacheTTL.medium);
    logReportCacheTiming('inquiry.options', startedAt, 'MISS', {
      courses: responseData.courses.length,
      inquiryTypes: responseData.inquiryTypes.length,
      inquiryModes: responseData.inquiryModes.length,
      categories: responseData.categories.length,
    });
    return NextResponse.json(responseData, {
      headers: { 'Cache-Control': 'public, max-age=120, stale-while-revalidate=300', 'X-Cache': 'MISS' },
    });
  } catch (error: any) {
    console.error('Report inquiry options error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch options', details: error.message },
      { status: 500 }
    );
  }
}
