/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { createSession, setSessionCookie } from '@/lib/session';
import { loginRateLimiter } from '@/lib/rate-limit';
import { sanitizeString, isNonEmpty } from '@/lib/validation';
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

function normalizeRoleTitle(title: unknown): string {
  return String(title ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function inferDepartmentFromRole(roleId: number, roleTitle: unknown): string {
  const normalizedTitle = normalizeRoleTitle(roleTitle);

  if (
    normalizedTitle === 'super admin' ||
    normalizedTitle === 'superadmin' ||
    normalizedTitle === 'admin' ||
    normalizedTitle === 'administration'
  ) {
    return 'Administration';
  }

  if (normalizedTitle.includes('account')) {
    return 'Accounts';
  }

  if (
    normalizedTitle.includes('placement') ||
    normalizedTitle.includes('admission') ||
    normalizedTitle.includes('business development')
  ) {
    return 'Career Building Department';
  }

  if (normalizedTitle.includes('training') || normalizedTitle.includes('faculty')) {
    return 'Training and Development';
  }

  if (normalizedTitle.includes('corporate training')) {
    return 'Corporate Training';
  }

  const inferred = Object.entries(DEPARTMENT_ROLE_MAP).find(([, roles]) => roles.includes(roleId));
  return inferred?.[0] || 'unknown';
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 login attempts per 60 seconds per IP
    const rateLimited = loginRateLimiter(request);
    if (rateLimited) return rateLimited;

    const body = await request.json();

    // Sanitize inputs
    const email = sanitizeString(body.email);
    const password = typeof body.password === 'string' ? body.password : '';
    const department = sanitizeString(body.department);

    // Validate required fields
    if (!isNonEmpty(email) || !password) {
      return NextResponse.json(
        { success: false, message: 'Email and password are required.' },
        { status: 400 }
      );
    }

    // Enforce reasonable length limits
    if (email.length > 254 || password.length > 128 || department.length > 100) {
      return NextResponse.json(
        { success: false, message: 'Invalid input.' },
        { status: 400 }
      );
    }

    const pool = getPool();

    // TODO: SECURITY — MD5 is cryptographically broken for password hashing.
    // Migrate to bcrypt/argon2 when possible. This matches the existing DB format.
    const hashedPassword = crypto.createHash('md5').update(password).digest('hex');

    // Look up user by username/email and password
    const [rows] = await pool.execute(
      `SELECT u.id, u.firstname, u.lastname, u.email, u.username, u.role, r.title AS role_title
       FROM awt_adminuser u
       LEFT JOIN role r ON r.id = u.role
       WHERE (u.username = ? OR u.email = ?) AND u.password = ? AND u.deleted = 0`,
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

    let finalDepartment = department;
    if (isNonEmpty(department)) {
      if (!DEPARTMENT_ROLE_MAP[department]) {
        return NextResponse.json(
          { success: false, message: 'Invalid department selected.' },
          { status: 400 }
        );
      }

      // Superadmin (role 1) can access any department.
      const allowedRoles = DEPARTMENT_ROLE_MAP[department];
      if (user.role !== SUPERADMIN_ROLE && !allowedRoles.includes(user.role)) {
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
    } else {
      // When the form omits a department, infer it from the role title first.
      // Fall back to the legacy role-id mapping, but do not auto-promote unknown roles to Administration.
      finalDepartment = inferDepartmentFromRole(user.role, user.role_title);
    }

    // Create session token
    const sessionToken = await createSession({
      userId: user.id,
      email: user.email,
      firstName: user.firstname,
      lastName: user.lastname,
      department: finalDepartment,
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
        department: finalDepartment,
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
