import { NextRequest, NextResponse } from 'next/server';
import { createSession, REMEMBER_ME_DURATION, setSessionCookie } from '@/lib/session';
import { loginRateLimiter } from '@/lib/rate-limit';
import { sanitizeString, isNonEmpty } from '@/lib/validation';
import { validateLogin } from '@/lib/services/auth.service';
import { logTableActivity } from '@/lib/activity-log';

export async function POST(request: NextRequest) {
  let attemptedUsername = '';
  try {
    const rateLimited = await loginRateLimiter(request);
    if (rateLimited) return rateLimited;

    const body = await request.json();
    const username = sanitizeString(body.username);
    attemptedUsername = username;
    const password = typeof body.password === 'string' ? body.password : '';
    const department = sanitizeString(body.department);
    const rememberMe = body?.rememberMe === true;

    if (!isNonEmpty(username) || !password) {
      return NextResponse.json(
        { success: false, message: 'Username and password are required.' },
        { status: 400 }
      );
    }
    if (username.length > 100 || password.length > 128 || department.length > 100) {
      return NextResponse.json({ success: false, message: 'Invalid input.' }, { status: 400 });
    }

    const { user, finalDepartment } = await validateLogin({ username, password, department: department || undefined });

    const sessionMaxAge = rememberMe ? REMEMBER_ME_DURATION : undefined;
    const sessionToken = await createSession(
      {
        userId: user.id,
        email: user.email,
        firstName: user.firstname,
        lastName: user.lastname,
        department: finalDepartment,
        role: user.role,
        dashboardDepartment: user.dashboard_department,
      },
      { maxAgeSeconds: sessionMaxAge }
    );

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

    await logTableActivity(request, {
      tableName: 'auth',
      action: 'LOGIN',
      actor: { userId: user.id, userName: [user.firstname, user.lastname].filter(Boolean).join(' ').trim() || username },
      details: { department: finalDepartment },
    });
    setSessionCookie(response, sessionToken, { maxAgeSeconds: sessionMaxAge });
    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error.';
    const status = (error as { status?: number }).status ?? 500;
    if (status < 500) {
      await logTableActivity(request, {
        tableName: 'auth',
        action: 'LOGIN_FAILED',
        actor: { userId: null, userName: attemptedUsername.slice(0, 100) || null },
        details: { reason: message },
      });
      return NextResponse.json({ success: false, message }, { status });
    }
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error. Please try again later.' },
      { status: 500 }
    );
  }
}
