/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { createSession, setSessionCookie } from '@/lib/session';
import crypto from 'crypto';

// Department name to role ID mapping
const DEPARTMENT_ROLE_MAP: Record<string, number[]> = {
  'Career Building Department': [11, 14], // Business Development + Placement
  'Corporate Training': [19],
  'Training and Development': [12],
  'Accounts': [13],
};

// Role 1 = Administration (superadmin) — can access any department
const SUPERADMIN_ROLE = 1;

export async function POST(request: NextRequest) {
  try {
    const { email, password, department } = await request.json();

    // Validate required fields
    if (!email || !password || !department) {
      return NextResponse.json(
        { success: false, message: 'Email, password, and department are required.' },
        { status: 400 }
      );
    }

    // Validate department
    if (!DEPARTMENT_ROLE_MAP[department]) {
      return NextResponse.json(
        { success: false, message: 'Invalid department selected.' },
        { status: 400 }
      );
    }

    const pool = getPool();

    // Hash password with MD5 (matching existing DB format)
    const hashedPassword = crypto.createHash('md5').update(password).digest('hex');

    // Look up user by username/email and password
    const [rows] = await pool.execute(
      'SELECT id, firstname, lastname, email, username, role FROM awt_adminuser WHERE (username = ? OR email = ?) AND password = ? AND deleted = 0',
      [email, email, hashedPassword]
    );

    const users = rows as any[];

    if (users.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    const user = users[0];

    // Superadmin (role 1) can access any department
    const allowedRoles = DEPARTMENT_ROLE_MAP[department];
    if (user.role !== SUPERADMIN_ROLE && !allowedRoles.includes(user.role)) {
      // Get the role title for a better error message
      const [roleRows] = await pool.execute(
        'SELECT title FROM role WHERE id = ?',
        [user.role]
      );
      const roleTitle = (roleRows as any[])[0]?.title || 'Unknown';

      return NextResponse.json(
        {
          success: false,
          message: `You are not assigned to the "${department}" department. Your current role is "${roleTitle}".`,
        },
        { status: 403 }
      );
    }

    // Create session token
    const sessionToken = await createSession({
      userId: user.id,
      email: user.email,
      firstName: user.firstname,
      lastName: user.lastname,
      department,
      role: user.role,
    });

    // Success response with session cookie
    const response = NextResponse.json({
      success: true,
      message: 'Login successful.',
      user: {
        id: user.id,
        firstName: user.firstname,
        lastName: user.lastname,
        email: user.email,
        department,
        role: user.role,
      },
    });

    // Set httpOnly session cookie
    setSessionCookie(response, sessionToken);

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error. Please try again later.' },
      { status: 500 }
    );
  }
}
