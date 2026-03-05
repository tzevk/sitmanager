/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { cache, cacheTTL } from '@/lib/cache';
import { requirePermission } from '@/lib/api-auth';
import { apiRateLimiter } from '@/lib/rate-limit';

// GET - consultancy report with filters
export async function GET(req: NextRequest) {
  try {
    const rateLimited = apiRateLimiter(req);
    if (rateLimited) return rateLimited;

    const auth = await requirePermission(req, 'consultancy_report.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(200, Math.max(10, Number(searchParams.get('limit')) || 25));
    const offset = (page - 1) * limit;
    const search = searchParams.get('search')?.trim() || '';
    const courseId = searchParams.get('courseId')?.trim() || '';
    const city = searchParams.get('city')?.trim() || '';
    const purpose = searchParams.get('purpose')?.trim() || '';
    const fromDate = searchParams.get('fromDate')?.trim() || '';
    const toDate = searchParams.get('toDate')?.trim() || '';
    const country = searchParams.get('country')?.trim() || '';
    const companyStatus = searchParams.get('companyStatus')?.trim() || '';
    const industry = searchParams.get('industry')?.trim() || '';

    // Cache key
    const cacheKey = `consultancy_report:list:${page}:${limit}:${search}:${courseId}:${city}:${purpose}:${fromDate}:${toDate}:${country}:${companyStatus}:${industry}`;
    const cachedData = cache.get<any>(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData, { headers: { 'X-Cache': 'HIT' } });
    }

    // Build WHERE
    const conditions: string[] = ['(c.IsDelete = 0 OR c.IsDelete IS NULL)'];
    const params: (string | number)[] = [];

    if (search) {
      conditions.push(
        `(c.Comp_Name LIKE ? OR c.Contact_Person LIKE ? OR c.Address LIKE ? OR c.EMail LIKE ? OR c.City LIKE ?)`
      );
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (courseId) {
      conditions.push(
        `(c.Course_Id1 = ? OR c.Course_Id2 = ? OR c.Course_Id3 = ? OR c.Course_Id4 = ? OR c.Course_Id5 = ? OR c.Course_Id6 = ?)`
      );
      const cid = Number(courseId);
      params.push(cid, cid, cid, cid, cid, cid);
    }

    if (city) {
      conditions.push(`c.City LIKE ?`);
      params.push(`%${city}%`);
    }

    if (purpose) {
      conditions.push(`c.Purpose = ?`);
      params.push(purpose);
    }

    if (fromDate) {
      conditions.push(`c.Date_Added >= ?`);
      params.push(fromDate);
    }

    if (toDate) {
      conditions.push(`c.Date_Added <= ?`);
      params.push(toDate);
    }

    if (country) {
      conditions.push(`c.Country LIKE ?`);
      params.push(`%${country}%`);
    }

    if (companyStatus) {
      conditions.push(`c.Company_Status = ?`);
      params.push(companyStatus);
    }

    if (industry) {
      conditions.push(`c.Industry LIKE ?`);
      params.push(`%${industry}%`);
    }

    const where = conditions.join(' AND ');

    // Count
    const [countRows] = await pool.query<any[]>(
      `SELECT COUNT(*) AS total FROM consultant_mst c WHERE ${where}`,
      params
    );
    const total = countRows[0]?.total ?? 0;

    // Data
    const [rows] = await pool.query<any[]>(
      `SELECT c.Const_Id, c.Date_Added, c.Comp_Name, c.Contact_Person, c.Address,
              c.Country, c.Tel, c.EMail, c.City, c.Purpose,
              CONCAT_WS(', ',
                NULLIF(c.CourseName1, ''), NULLIF(c.CourseName2, ''),
                NULLIF(c.CourseName3, ''), NULLIF(c.CourseName4, ''),
                NULLIF(c.CourseName5, ''), NULLIF(c.CourseName6, '')
              ) AS Courses
       FROM consultant_mst c
       WHERE ${where}
       ORDER BY c.Const_Id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Dropdown options
    const [courses] = await pool.query<any[]>(
      `SELECT Course_Id, Course_Name FROM course_mst WHERE (IsDelete = 0 OR IsDelete IS NULL) ORDER BY Course_Name`
    );

    const [purposes] = await pool.query<any[]>(
      `SELECT DISTINCT Purpose FROM consultant_mst WHERE Purpose IS NOT NULL AND Purpose != '' ORDER BY Purpose`
    );

    const [cities] = await pool.query<any[]>(
      `SELECT DISTINCT City FROM consultant_mst WHERE City IS NOT NULL AND City != '' AND (IsDelete = 0 OR IsDelete IS NULL) ORDER BY City LIMIT 500`
    );

    const [countries] = await pool.query<any[]>(
      `SELECT DISTINCT Country FROM consultant_mst WHERE Country IS NOT NULL AND Country != '' AND (IsDelete = 0 OR IsDelete IS NULL) ORDER BY Country LIMIT 200`
    );

    const [statuses] = await pool.query<any[]>(
      `SELECT DISTINCT Company_Status FROM consultant_mst WHERE Company_Status IS NOT NULL AND Company_Status != '' ORDER BY Company_Status`
    );

    const [industries] = await pool.query<any[]>(
      `SELECT DISTINCT Industry FROM consultant_mst WHERE Industry IS NOT NULL AND Industry != '' AND (IsDelete = 0 OR IsDelete IS NULL) ORDER BY Industry LIMIT 300`
    );

    const responseData = {
      rows,
      courses,
      purposes: purposes.map((p: any) => p.Purpose),
      cities: cities.map((c: any) => c.City),
      countries: countries.map((c: any) => c.Country),
      statuses: statuses.map((s: any) => s.Company_Status),
      industries: industries.map((i: any) => i.Industry),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };

    cache.set(cacheKey, responseData, cacheTTL.medium);
    return NextResponse.json(responseData, { headers: { 'X-Cache': 'MISS' } });
  } catch (err: unknown) {
    console.error('Consultancy Report GET error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
