/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSession } from '@/lib/session';
import crypto from 'crypto';

// GET: List employees with their user account status
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pool = getPool();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '25', 10);
    const search = searchParams.get('search') || '';
    const filter = searchParams.get('filter') || 'all'; // all | without_account | with_account
    const offset = (page - 1) * limit;

    let whereClause = '(e.IsDelete = 0 OR e.IsDelete IS NULL)';
    const params: any[] = [];

    if (search) {
      whereClause += ` AND (e.Employee_Name LIKE ? OR e.EMail LIKE ? OR e.UserId LIKE ? OR e.Designation LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (filter === 'without_account') {
      whereClause += ` AND u.id IS NULL`;
    } else if (filter === 'with_account') {
      whereClause += ` AND u.id IS NOT NULL`;
    }

    // Count
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total 
       FROM office_employee_mst e
       LEFT JOIN awt_adminuser u ON (u.email = e.EMail AND u.deleted = 0)
       WHERE ${whereClause}`,
      params
    );
    const total = (countResult as any[])[0].total;

    // Get employees with user account info
    const [employees] = await pool.execute(
      `SELECT e.Emp_Id, e.Emp_Code, e.Employee_Name, e.EMail, e.UserId, 
              e.Present_Mobile, e.Designation, e.Emp_Type, e.IsActive,
              u.id as user_id, u.username as user_username, u.role as user_role_id,
              r.title as user_role_name
       FROM office_employee_mst e
       LEFT JOIN awt_adminuser u ON (u.email = e.EMail AND u.deleted = 0)
       LEFT JOIN role r ON u.role = r.id
       WHERE ${whereClause}
       ORDER BY 
         CASE WHEN e.Employee_Name IS NULL OR TRIM(e.Employee_Name) = '' THEN 1
              WHEN LOWER(e.Employee_Name) LIKE '%test%' THEN 1
              ELSE 0 END ASC,
         e.Employee_Name ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return NextResponse.json({
      success: true,
      data: employees,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch employees' },
      { status: 500 }
    );
  }
}

// POST: Create a user account for an employee
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pool = getPool();
    const body = await request.json();
    const { employeeId, username, password, email, roleId, firstname, lastname, mobile } = body;

    // Validate required fields
    if (!employeeId || !username?.trim() || !password || !email?.trim() || !roleId) {
      return NextResponse.json(
        { success: false, error: 'Employee ID, username, password, email, and role are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Check username uniqueness
    const [existingUsername] = await pool.execute(
      `SELECT id FROM awt_adminuser WHERE username = ? AND deleted = 0`,
      [username.trim()]
    );
    if ((existingUsername as any[]).length > 0) {
      return NextResponse.json(
        { success: false, error: 'Username already exists. Please choose a different username.' },
        { status: 409 }
      );
    }

    // Check email uniqueness
    const [existingEmail] = await pool.execute(
      `SELECT id FROM awt_adminuser WHERE email = ? AND deleted = 0`,
      [email.trim()]
    );
    if ((existingEmail as any[]).length > 0) {
      return NextResponse.json(
        { success: false, error: 'An account with this email already exists.' },
        { status: 409 }
      );
    }

    // Validate role exists
    const [roles] = await pool.execute(
      `SELECT id FROM role WHERE id = ? AND \`delete\` = 0`,
      [roleId]
    );
    if ((roles as any[]).length === 0) {
      return NextResponse.json(
        { success: false, error: 'Selected role not found' },
        { status: 404 }
      );
    }

    // Hash password using MD5 (matches existing DB format)
    const hashedPassword = crypto.createHash('md5').update(password).digest('hex');

    // Create user account
    const [result] = await pool.execute(
      `INSERT INTO awt_adminuser (firstname, lastname, email, username, password, mobile, role, deleted, created_by, created_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, NOW())`,
      [
        firstname?.trim() || '',
        lastname?.trim() || '',
        email.trim(),
        username.trim(),
        hashedPassword,
        mobile?.trim() || '',
        roleId,
        session.userId,
      ]
    );

    const userId = (result as any).insertId;

    return NextResponse.json({
      success: true,
      data: { id: userId, username: username.trim(), email: email.trim() },
      message: 'User account created successfully',
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create user account' },
      { status: 500 }
    );
  }
}
