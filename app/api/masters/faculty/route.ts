/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

// GET - fetch all faculty with pagination and search
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'faculty.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit')) || 25));
    const offset = (page - 1) * limit;
    const search = searchParams.get('search')?.trim() || '';

    // Build WHERE clause
    const conditions: string[] = ['(IsDelete = 0 OR IsDelete IS NULL)'];
    const params: (string | number)[] = [];

    if (search) {
      conditions.push(`(Faculty_Name LIKE ?)`);
      params.push(`%${search}%`);
    }

    const where = conditions.join(' AND ');

    // Count
    const countSql = `SELECT COUNT(*) AS total FROM faculty_master WHERE ${where}`;
    const [countRows] = await pool.query<any[]>(countSql, params);
    const total = countRows[0]?.total ?? 0;

    // Data
    const dataSql = `
      SELECT Faculty_Id, Faculty_Name, IsActive
      FROM faculty_master 
      WHERE ${where}
      ORDER BY Faculty_Id DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await pool.query<any[]>(dataSql, [...params, limit, offset]);

    return NextResponse.json({
      rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: unknown) {
    console.error('Faculty API error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - add new faculty
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'faculty.create');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    const {
      Faculty_Name, Faculty_Code, Married, DOB, Nationality, Faculty_Type,
      Office_Tel, Res_Tel, Mobile, EMail,
      Present_Address, Present_City, Present_State, Present_Country, Present_Pin, Present_Tel,
      Permanent_Address, Permanent_City, Permanent_State, Permanent_Country, Permanent_Pin, Permanent_Tel,
      Service_Offered, Specialization, Experience, Company_Name, Company_Address, Company_Phone,
      Interview_Date, Working_At, Qualified, Joining_Date, Comments, Interviewer,
      Sal_Struct, Salary, TDS, PAN, Resigned, InvoiceName, CourseId, DesignExp, KnowSw,
      Working_Status, TrainingCategory, Interview_Status, Reference_by
    } = body;

    if (!Faculty_Name?.trim()) {
      return NextResponse.json({ error: 'Faculty Name is required' }, { status: 400 });
    }

    const [result] = await pool.query(
      `INSERT INTO faculty_master (
        Faculty_Name, Faculty_Code, Married, DOB, Nationality, Faculty_Type,
        Office_Tel, Res_Tel, Mobile, EMail,
        Present_Address, Present_City, Present_State, Present_Country, Present_Pin, Present_Tel,
        Permanent_Address, Permanent_City, Permanent_State, Permanent_Country, Permanent_Pin, Permanent_Tel,
        Service_Offered, Specialization, Experience, Company_Name, Company_Address, Company_Phone,
        Interview_Date, Working_At, Qualified, Joining_Date, Comments, Interviewer,
        Sal_Struct, Salary, TDS, PAN, Resigned, InvoiceName, CourseId, DesignExp, KnowSw,
        Working_Status, TrainingCategory, Interview_Status, Reference_by, IsActive, IsDelete
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`,
      [
        Faculty_Name.trim(), Faculty_Code || null, Married || null, DOB || null, Nationality || null, Faculty_Type || null,
        Office_Tel || null, Res_Tel || null, Mobile || null, EMail || null,
        Present_Address || null, Present_City || null, Present_State || null, Present_Country || null, Present_Pin || null, Present_Tel || null,
        Permanent_Address || null, Permanent_City || null, Permanent_State || null, Permanent_Country || null, Permanent_Pin || null, Permanent_Tel || null,
        Service_Offered || null, Specialization || null, Experience || null, Company_Name || null, Company_Address || null, Company_Phone || null,
        Interview_Date || null, Working_At || null, Qualified || null, Joining_Date || null, Comments || null, Interviewer || null,
        Sal_Struct || null, Salary || null, TDS || null, PAN || null, Resigned || null, InvoiceName || null, CourseId || null, DesignExp || null, KnowSw || null,
        Working_Status || null, TrainingCategory || null, Interview_Status || null, Reference_by || null
      ]
    );

    return NextResponse.json({ success: true, insertId: (result as any).insertId });
  } catch (err: unknown) {
    console.error('Faculty POST error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT - update faculty
export async function PUT(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'faculty.update');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    const {
      Faculty_Id, Faculty_Name, Faculty_Code, Married, DOB, Nationality, Faculty_Type,
      Office_Tel, Res_Tel, Mobile, EMail,
      Present_Address, Present_City, Present_State, Present_Country, Present_Pin, Present_Tel,
      Permanent_Address, Permanent_City, Permanent_State, Permanent_Country, Permanent_Pin, Permanent_Tel,
      Service_Offered, Specialization, Experience, Company_Name, Company_Address, Company_Phone,
      Interview_Date, Working_At, Qualified, Joining_Date, Comments, Interviewer,
      Sal_Struct, Salary, TDS, PAN, Resigned, InvoiceName, CourseId, DesignExp, KnowSw,
      Working_Status, TrainingCategory, Interview_Status, Reference_by
    } = body;

    if (!Faculty_Id) {
      return NextResponse.json({ error: 'Faculty ID is required' }, { status: 400 });
    }
    if (!Faculty_Name?.trim()) {
      return NextResponse.json({ error: 'Faculty Name is required' }, { status: 400 });
    }

    await pool.query(
      `UPDATE faculty_master SET 
        Faculty_Name = ?, Faculty_Code = ?, Married = ?, DOB = ?, Nationality = ?, Faculty_Type = ?,
        Office_Tel = ?, Res_Tel = ?, Mobile = ?, EMail = ?,
        Present_Address = ?, Present_City = ?, Present_State = ?, Present_Country = ?, Present_Pin = ?, Present_Tel = ?,
        Permanent_Address = ?, Permanent_City = ?, Permanent_State = ?, Permanent_Country = ?, Permanent_Pin = ?, Permanent_Tel = ?,
        Service_Offered = ?, Specialization = ?, Experience = ?, Company_Name = ?, Company_Address = ?, Company_Phone = ?,
        Interview_Date = ?, Working_At = ?, Qualified = ?, Joining_Date = ?, Comments = ?, Interviewer = ?,
        Sal_Struct = ?, Salary = ?, TDS = ?, PAN = ?, Resigned = ?, InvoiceName = ?, CourseId = ?, DesignExp = ?, KnowSw = ?,
        Working_Status = ?, TrainingCategory = ?, Interview_Status = ?, Reference_by = ?
      WHERE Faculty_Id = ?`,
      [
        Faculty_Name.trim(), Faculty_Code || null, Married || null, DOB || null, Nationality || null, Faculty_Type || null,
        Office_Tel || null, Res_Tel || null, Mobile || null, EMail || null,
        Present_Address || null, Present_City || null, Present_State || null, Present_Country || null, Present_Pin || null, Present_Tel || null,
        Permanent_Address || null, Permanent_City || null, Permanent_State || null, Permanent_Country || null, Permanent_Pin || null, Permanent_Tel || null,
        Service_Offered || null, Specialization || null, Experience || null, Company_Name || null, Company_Address || null, Company_Phone || null,
        Interview_Date || null, Working_At || null, Qualified || null, Joining_Date || null, Comments || null, Interviewer || null,
        Sal_Struct || null, Salary || null, TDS || null, PAN || null, Resigned || null, InvoiceName || null, CourseId || null, DesignExp || null, KnowSw || null,
        Working_Status || null, TrainingCategory || null, Interview_Status || null, Reference_by || null,
        Faculty_Id
      ]
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Faculty PUT error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - soft delete faculty
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'faculty.delete');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await pool.query(`UPDATE faculty_master SET IsDelete = 1 WHERE Faculty_Id = ?`, [id]);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Faculty DELETE error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}
