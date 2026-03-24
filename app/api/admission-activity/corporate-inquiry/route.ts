/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { cache, cacheKeys, cacheTTL } from '@/lib/cache';
import { requirePermission } from '@/lib/api-auth';

async function ensureCorporateInquiryColumns(pool: ReturnType<typeof getPool>) {
  const wanted = [
    'Consultancy_Id',
    'CompanyAuthority',
    'TrainingMode',
    'Participants_Fresher',
    'Participants_Experienced',
    'TrainingLocation',
    'Discussion',
    'FollowUp',
    'InitialFollowUpDate',
    'NextFollowUpDate',

    'InquiryStatus',
    'TrainingNumber',
    'TrainingDate',
    'TrainerName',
    'NumberOfDays',
    'TotalStudents',
    'TrainingCoordinator',

    'ConfirmDate',
    'PerformanceEvaluation',
    'TrainingFeedback',
    'SitCertification',
  ] as const;

  const [rows] = await pool.query<any[]>(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'corporate_inquiry'
       AND COLUMN_NAME IN (${wanted.map(() => '?').join(',')})`,
    [...wanted]
  );

  const existing = new Set((rows || []).map((r: any) => String(r?.COLUMN_NAME || '')));

  const alters: string[] = [];
  if (!existing.has('Consultancy_Id')) alters.push(`ADD COLUMN Consultancy_Id INT NULL`);
  if (!existing.has('CompanyAuthority')) alters.push(`ADD COLUMN CompanyAuthority VARCHAR(255) NULL`);
  if (!existing.has('TrainingMode')) alters.push(`ADD COLUMN TrainingMode VARCHAR(20) NULL`);
  if (!existing.has('Participants_Fresher')) alters.push(`ADD COLUMN Participants_Fresher INT NULL`);
  if (!existing.has('Participants_Experienced')) alters.push(`ADD COLUMN Participants_Experienced INT NULL`);
  if (!existing.has('TrainingLocation')) alters.push(`ADD COLUMN TrainingLocation VARCHAR(255) NULL`);
  if (!existing.has('Discussion')) alters.push(`ADD COLUMN Discussion TEXT NULL`);
  if (!existing.has('FollowUp')) alters.push(`ADD COLUMN FollowUp TEXT NULL`);
  if (!existing.has('InitialFollowUpDate')) alters.push(`ADD COLUMN InitialFollowUpDate DATE NULL`);
  if (!existing.has('NextFollowUpDate')) alters.push(`ADD COLUMN NextFollowUpDate DATE NULL`);

  if (!existing.has('InquiryStatus')) alters.push(`ADD COLUMN InquiryStatus VARCHAR(20) NULL`);
  if (!existing.has('TrainingNumber')) alters.push(`ADD COLUMN TrainingNumber VARCHAR(50) NULL`);
  if (!existing.has('TrainingDate')) alters.push(`ADD COLUMN TrainingDate DATE NULL`);
  if (!existing.has('TrainerName')) alters.push(`ADD COLUMN TrainerName VARCHAR(255) NULL`);
  if (!existing.has('NumberOfDays')) alters.push(`ADD COLUMN NumberOfDays INT NULL`);
  if (!existing.has('TotalStudents')) alters.push(`ADD COLUMN TotalStudents INT NULL`);
  if (!existing.has('TrainingCoordinator')) alters.push(`ADD COLUMN TrainingCoordinator VARCHAR(255) NULL`);

  if (!existing.has('ConfirmDate')) alters.push(`ADD COLUMN ConfirmDate DATE NULL`);
  if (!existing.has('PerformanceEvaluation')) alters.push(`ADD COLUMN PerformanceEvaluation TEXT NULL`);
  if (!existing.has('TrainingFeedback')) alters.push(`ADD COLUMN TrainingFeedback TEXT NULL`);
  if (!existing.has('SitCertification')) alters.push(`ADD COLUMN SitCertification VARCHAR(3) NULL`);

  for (const alter of alters) {
    // Run each ALTER separately to keep failure surface small.
    await pool.query(`ALTER TABLE corporate_inquiry ${alter}`);
  }
}

function toNullableInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return i >= 0 ? i : null;
}

// GET - fetch all corporate inquiries with pagination and search
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'corporate_inquiry.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    await ensureCorporateInquiryColumns(pool);
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit')) || 25));
    const offset = (page - 1) * limit;
    const search = searchParams.get('search')?.trim() || '';
    const status = searchParams.get('status')?.trim() || '';

    // Check cache first
    const cacheKey = cacheKeys.corporateInquiry.list({ page, limit, search });
    const cached = cache.get<any>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'X-Cache': 'HIT' }
      });
    }

    // Build WHERE clause
    const conditions: string[] = ['(IsDelete = 0 OR IsDelete IS NULL)'];
    const params: (string | number)[] = [];

    if (search) {
      conditions.push(`(FullName LIKE ? OR Fname LIKE ? OR Lname LIKE ? OR Email LIKE ? OR CompanyName LIKE ?)`);
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status) {
      conditions.push(`InquiryStatus = ?`);
      params.push(status);
    }

    const where = conditions.join(' AND ');

    // Count
    const countSql = `SELECT COUNT(*) AS total FROM corporate_inquiry WHERE ${where}`;
    const [countRows] = await pool.query<any[]>(countSql, params);
    const total = countRows[0]?.total ?? 0;

    // Data
    const dataSql = `
      SELECT Id, Fname, Lname, MName, FullName, CompanyName, Designation,
             Address, City, State, Country, Pin, Phone, Mobile, Email,
             Course_Id, Place, business, Remark, Idate, IsActive
            , InquiryStatus
            , TrainingNumber, TrainingDate, TrainerName, NumberOfDays, TotalStudents, TrainingCoordinator
      FROM corporate_inquiry 
      WHERE ${where}
      ORDER BY Id DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await pool.query<any[]>(dataSql, [...params, limit, offset]);

    // Get courses for reference
    const [courses] = await pool.query<any[]>(`
      SELECT Course_Id, Course_Name FROM course_mst 
      WHERE (IsDelete = 0 OR IsDelete IS NULL)
      ORDER BY Course_Name
    `);

    const responseData = {
      rows,
      courses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    // Store in cache for future requests
    cache.set(cacheKey, responseData, cacheTTL.medium);

    return NextResponse.json(responseData, {
      headers: { 'X-Cache': 'MISS' }
    });
  } catch (err: unknown) {
    console.error('Corporate Inquiry API error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH - partial update (status/training fields)
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'corporate_inquiry.update');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    await ensureCorporateInquiryColumns(pool);

    const Id = body?.Id;
    if (!Id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const allowed = {
      InquiryStatus: body?.InquiryStatus,
      TrainingNumber: body?.TrainingNumber,
      TrainingDate: body?.TrainingDate,
      TrainerName: body?.TrainerName,
      NumberOfDays: toNullableInt(body?.NumberOfDays),
      TotalStudents: toNullableInt(body?.TotalStudents),
      TrainingCoordinator: body?.TrainingCoordinator,

      ConfirmDate: body?.ConfirmDate,
      PerformanceEvaluation: body?.PerformanceEvaluation,
      TrainingFeedback: body?.TrainingFeedback,
      SitCertification: body?.SitCertification,
    } as const;

    const setParts: string[] = [];
    const values: any[] = [];
    for (const [key, value] of Object.entries(allowed)) {
      if (value === undefined) continue;
      setParts.push(`${key} = ?`);
      if (value === '') values.push(null);
      else values.push(typeof value === 'string' ? value.trim() : value);
    }

    if (setParts.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    await pool.query(
      `UPDATE corporate_inquiry SET ${setParts.join(', ')} WHERE Id = ?`,
      [...values, Id]
    );

    cache.deleteByPrefix(cacheKeys.corporateInquiry.prefix);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Corporate Inquiry PATCH error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - add new corporate inquiry
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'corporate_inquiry.create');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    await ensureCorporateInquiryColumns(pool);

    // Backwards-compatible input support
    const Fname = body?.Fname;
    const MName = body?.MName;
    const Lname = body?.Lname;
    const FullNameRaw = body?.FullName;
    const FullName = String(
      (FullNameRaw && String(FullNameRaw).trim()) || [Fname, MName, Lname].filter(Boolean).join(' ') || ''
    ).trim();

    const CompanyName = body?.CompanyName;
    const Designation = body?.Designation;
    const Phone = body?.Phone;
    const Mobile = body?.Mobile;
    const Email = body?.Email;
    const Course_Id = body?.Course_Id;

    const Consultancy_Id = toNullableInt(body?.Consultancy_Id);
    const CompanyAuthority = body?.CompanyAuthority;
    const TrainingMode = body?.TrainingMode;
    const Participants_Fresher = toNullableInt(body?.Participants_Fresher);
    const Participants_Experienced = toNullableInt(body?.Participants_Experienced);
    const TrainingLocation = body?.TrainingLocation;
    const Discussion = body?.Discussion;
    const FollowUp = body?.FollowUp;
    const InitialFollowUpDate = body?.InitialFollowUpDate;
    const NextFollowUpDate = body?.NextFollowUpDate;

    // Keep legacy columns populated where it makes sense.
    const Place = TrainingLocation ?? body?.Place;
    const Remark = Discussion ?? body?.Remark;

    const Idate = body?.Idate;

    const [result] = await pool.query(
      `INSERT INTO corporate_inquiry (
        Fname, Lname, MName, FullName, CompanyName, Designation, Address, City, State,
        Country, Pin, Phone, Mobile, Email, Course_Id, Place, business, Remark, Idate,
        Consultancy_Id, CompanyAuthority, TrainingMode, Participants_Fresher, Participants_Experienced,
        TrainingLocation, Discussion, FollowUp,
        InitialFollowUpDate, NextFollowUpDate,
        IsActive, IsDelete
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        COALESCE(?, CURDATE()),
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?,
        1, 0
      )`,
      [
        // Prefer storing the contact name into both Fname and FullName for legacy searches.
        (Fname ?? FullName) || null,
        Lname || null,
        MName || null,
        FullName || null,
        CompanyName || null,
        Designation || null,
        body?.Address || null,
        body?.City || null,
        body?.State || null,
        body?.Country || null,
        body?.Pin || null,
        Phone || null,
        Mobile || null,
        Email || null,
        Course_Id || null,
        Place || null,
        body?.business || null,
        Remark || null,
        Idate || null,
        Consultancy_Id,
        CompanyAuthority || null,
        TrainingMode || null,
        Participants_Fresher,
        Participants_Experienced,
        TrainingLocation || null,
        Discussion || null,
        FollowUp || null,
        InitialFollowUpDate || null,
        NextFollowUpDate || null,
      ]
    );

    // Invalidate cache on data modification
    cache.deleteByPrefix(cacheKeys.corporateInquiry.prefix);

    return NextResponse.json({ success: true, insertId: (result as any).insertId });
  } catch (err: unknown) {
    console.error('Corporate Inquiry POST error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT - update corporate inquiry
export async function PUT(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'corporate_inquiry.update');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    await ensureCorporateInquiryColumns(pool);

    const Id = body?.Id;
    const Fname = body?.Fname;
    const MName = body?.MName;
    const Lname = body?.Lname;
    const FullNameRaw = body?.FullName;
    const FullName = String(
      (FullNameRaw && String(FullNameRaw).trim()) || [Fname, MName, Lname].filter(Boolean).join(' ') || ''
    ).trim();

    const CompanyName = body?.CompanyName;
    const Designation = body?.Designation;
    const Phone = body?.Phone;
    const Mobile = body?.Mobile;
    const Email = body?.Email;
    const Course_Id = body?.Course_Id;

    const Consultancy_Id = toNullableInt(body?.Consultancy_Id);
    const CompanyAuthority = body?.CompanyAuthority;
    const TrainingMode = body?.TrainingMode;
    const Participants_Fresher = toNullableInt(body?.Participants_Fresher);
    const Participants_Experienced = toNullableInt(body?.Participants_Experienced);
    const TrainingLocation = body?.TrainingLocation;
    const Discussion = body?.Discussion;
    const FollowUp = body?.FollowUp;
    const InitialFollowUpDate = body?.InitialFollowUpDate;
    const NextFollowUpDate = body?.NextFollowUpDate;

    const Place = TrainingLocation ?? body?.Place;
    const Remark = Discussion ?? body?.Remark;
    const Idate = body?.Idate;

    if (!Id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await pool.query(
      `UPDATE corporate_inquiry SET 
        Fname = ?, Lname = ?, MName = ?, FullName = ?, CompanyName = ?, Designation = ?,
        Address = ?, City = ?, State = ?, Country = ?, Pin = ?, Phone = ?, Mobile = ?,
        Email = ?, Course_Id = ?, Place = ?, business = ?, Remark = ?, Idate = ?,
        Consultancy_Id = ?, CompanyAuthority = ?, TrainingMode = ?, Participants_Fresher = ?, Participants_Experienced = ?,
        TrainingLocation = ?, Discussion = ?, FollowUp = ?
        , InitialFollowUpDate = ?, NextFollowUpDate = ?
      WHERE Id = ?`,
      [
        (Fname ?? FullName) || null,
        Lname || null,
        MName || null,
        FullName || null,
        CompanyName || null,
        Designation || null,
        body?.Address || null,
        body?.City || null,
        body?.State || null,
        body?.Country || null,
        body?.Pin || null,
        Phone || null,
        Mobile || null,
        Email || null,
        Course_Id || null,
        Place || null,
        body?.business || null,
        Remark || null,
        Idate || null,
        Consultancy_Id,
        CompanyAuthority || null,
        TrainingMode || null,
        Participants_Fresher,
        Participants_Experienced,
        TrainingLocation || null,
        Discussion || null,
        FollowUp || null,
        InitialFollowUpDate || null,
        NextFollowUpDate || null,
        Id
      ]
    );

    // Invalidate cache on data modification
    cache.deleteByPrefix(cacheKeys.corporateInquiry.prefix);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Corporate Inquiry PUT error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - soft delete corporate inquiry
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'corporate_inquiry.delete');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await pool.query(`UPDATE corporate_inquiry SET IsDelete = 1 WHERE Id = ?`, [id]);

    // Invalidate cache on data modification
    cache.deleteByPrefix(cacheKeys.corporateInquiry.prefix);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Corporate Inquiry DELETE error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}
