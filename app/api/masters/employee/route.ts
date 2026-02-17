/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

// GET - fetch all employees with pagination, search, and filters
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'employee.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit')) || 25));
    const offset = (page - 1) * limit;
    const search = searchParams.get('search')?.trim() || '';
    const username = searchParams.get('username')?.trim() || '';
    const category = searchParams.get('category')?.trim() || '';

    // Build WHERE clause
    const conditions: string[] = ['(IsDelete = 0 OR IsDelete IS NULL)'];
    const params: (string | number)[] = [];

    if (search) {
      conditions.push(`(Employee_Name LIKE ? OR UserId LIKE ? OR EMail LIKE ? OR Designation LIKE ?)`);
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (username) {
      conditions.push(`UserId LIKE ?`);
      params.push(`%${username}%`);
    }

    if (category && category !== 'All') {
      conditions.push(`Emp_Type = ?`);
      params.push(category);
    }

    const where = conditions.join(' AND ');

    // Count
    const countSql = `SELECT COUNT(*) AS total FROM office_employee_mst WHERE ${where}`;
    const [countRows] = await pool.query<any[]>(countSql, params);
    const total = countRows[0]?.total ?? 0;

    // Data
    const dataSql = `
      SELECT Emp_Id, Emp_Code, UserId, Employee_Name, Dept_Id, Designation, EMail, Present_Mobile, IsActive, Emp_Type
      FROM office_employee_mst 
      WHERE ${where}
      ORDER BY Emp_Id DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await pool.query<any[]>(dataSql, [...params, limit, offset]);

    // Get categories for filter dropdown
    const [categories] = await pool.query<any[]>(`
      SELECT DISTINCT Emp_Type FROM office_employee_mst 
      WHERE Emp_Type IS NOT NULL AND Emp_Type != '' 
      ORDER BY Emp_Type
    `);

    return NextResponse.json({
      rows,
      categories: categories.map((c: any) => c.Emp_Type),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: unknown) {
    console.error('Employee API error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - add new employee
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'employee.create');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    const {
      Emp_Code, UserId, UserPswd, FName, MName, LName, Employee_Name,
      Designation, Emp_Type, Dept_Id, DOB, Gender, Married, Nationality,
      Joining_Date, Present_Status, EMail, OfficialEmail, Present_Mobile,
      Present_Address, Present_City, Present_Pin, Present_State, Present_Country, Present_Tel,
      Permanent_Address, Permanent_City, Permanent_Pin, Permanent_State, Permanent_Country, Permanent_Tel,
      PAN, PFNo, Basic_Salary, IsActive
    } = body;

    if (!Employee_Name?.trim()) {
      return NextResponse.json({ error: 'Employee Name is required' }, { status: 400 });
    }

    const [result] = await pool.query(
      `INSERT INTO office_employee_mst (
        Emp_Code, UserId, UserPswd, FName, MName, LName, Employee_Name,
        Designation, Emp_Type, Dept_Id, DOB, Gender, Married, Nationality,
        Joining_Date, Present_Status, EMail, OfficialEmail, Present_Mobile,
        Present_Address, Present_City, Present_Pin, Present_State, Present_Country, Present_Tel,
        Permanent_Address, Permanent_City, Permanent_Pin, Permanent_State, Permanent_Country, Permanent_Tel,
        PAN, PFNo, Basic_Salary, IsActive, IsDelete, Date_Added
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, CURDATE())`,
      [
        Emp_Code || null, UserId?.trim() || null, UserPswd?.trim() || null,
        FName?.trim() || null, MName?.trim() || null, LName?.trim() || null, Employee_Name.trim(),
        Designation?.trim() || null, Emp_Type?.trim() || null, Dept_Id || null,
        DOB?.trim() || null, Gender?.trim() || null, Married?.trim() || null, Nationality?.trim() || null,
        Joining_Date?.trim() || null, Present_Status?.trim() || null,
        EMail?.trim() || null, OfficialEmail?.trim() || null, Present_Mobile?.trim() || null,
        Present_Address?.trim() || null, Present_City?.trim() || null, Present_Pin?.trim() || null,
        Present_State?.trim() || null, Present_Country?.trim() || null, Present_Tel?.trim() || null,
        Permanent_Address?.trim() || null, Permanent_City?.trim() || null, Permanent_Pin?.trim() || null,
        Permanent_State?.trim() || null, Permanent_Country?.trim() || null, Permanent_Tel?.trim() || null,
        PAN?.trim() || null, PFNo?.trim() || null, Basic_Salary || null, IsActive ?? 1
      ]
    );

    return NextResponse.json({ 
      success: true, 
      insertId: (result as any).insertId 
    });
  } catch (err: unknown) {
    console.error('Employee POST error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT - update employee
export async function PUT(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'employee.update');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    const {
      Emp_Id, Emp_Code, UserId, UserPswd, FName, MName, LName, Employee_Name,
      Designation, Emp_Type, Dept_Id, DOB, Gender, Married, Nationality,
      Joining_Date, Present_Status, EMail, OfficialEmail, Present_Mobile,
      Present_Address, Present_City, Present_Pin, Present_State, Present_Country, Present_Tel,
      Permanent_Address, Permanent_City, Permanent_Pin, Permanent_State, Permanent_Country, Permanent_Tel,
      PAN, PFNo, Basic_Salary, IsActive
    } = body;

    if (!Emp_Id) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
    }
    if (!Employee_Name?.trim()) {
      return NextResponse.json({ error: 'Employee Name is required' }, { status: 400 });
    }

    await pool.query(
      `UPDATE office_employee_mst SET 
        Emp_Code = ?, UserId = ?, UserPswd = ?, FName = ?, MName = ?, LName = ?, Employee_Name = ?,
        Designation = ?, Emp_Type = ?, Dept_Id = ?, DOB = ?, Gender = ?, Married = ?, Nationality = ?,
        Joining_Date = ?, Present_Status = ?, EMail = ?, OfficialEmail = ?, Present_Mobile = ?,
        Present_Address = ?, Present_City = ?, Present_Pin = ?, Present_State = ?, Present_Country = ?, Present_Tel = ?,
        Permanent_Address = ?, Permanent_City = ?, Permanent_Pin = ?, Permanent_State = ?, Permanent_Country = ?, Permanent_Tel = ?,
        PAN = ?, PFNo = ?, Basic_Salary = ?, IsActive = ?
       WHERE Emp_Id = ?`,
      [
        Emp_Code || null, UserId?.trim() || null, UserPswd?.trim() || null,
        FName?.trim() || null, MName?.trim() || null, LName?.trim() || null, Employee_Name.trim(),
        Designation?.trim() || null, Emp_Type?.trim() || null, Dept_Id || null,
        DOB?.trim() || null, Gender?.trim() || null, Married?.trim() || null, Nationality?.trim() || null,
        Joining_Date?.trim() || null, Present_Status?.trim() || null,
        EMail?.trim() || null, OfficialEmail?.trim() || null, Present_Mobile?.trim() || null,
        Present_Address?.trim() || null, Present_City?.trim() || null, Present_Pin?.trim() || null,
        Present_State?.trim() || null, Present_Country?.trim() || null, Present_Tel?.trim() || null,
        Permanent_Address?.trim() || null, Permanent_City?.trim() || null, Permanent_Pin?.trim() || null,
        Permanent_State?.trim() || null, Permanent_Country?.trim() || null, Permanent_Tel?.trim() || null,
        PAN?.trim() || null, PFNo?.trim() || null, Basic_Salary || null, IsActive ?? 1,
        Emp_Id
      ]
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Employee PUT error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - soft delete employee
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'employee.delete');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await pool.query(`UPDATE office_employee_mst SET IsDelete = 1 WHERE Emp_Id = ?`, [id]);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Employee DELETE error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}
