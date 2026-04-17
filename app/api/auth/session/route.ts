import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getRolePermissions } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);

    if (!session) {
      return NextResponse.json({
        success: false,
        authenticated: false,
        session: null,
        user: null,
      });
    }

    let permissions: string[] = [];
    try {
      permissions = await getRolePermissions(session.role);
    } catch (error) {
      console.error('Failed to load session permissions:', error);
      permissions = [];
    }

    return NextResponse.json(
      {
        success: true,
        authenticated: true,
        session: {
          userId: session.userId,
          email: session.email,
          firstName: session.firstName,
          lastName: session.lastName,
          department: session.department,
          role: session.role,
          permissions,
          dashboardDepartment: session.dashboardDepartment || null,
        },
        user: {
          id: session.userId,
          firstName: session.firstName,
          lastName: session.lastName,
          email: session.email,
          department: session.department,
          role: session.role,
          permissions,
        },
      },
      {
        headers: {
          'Cache-Control': 'private, no-store, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (error) {
    console.error('Session endpoint failed:', error);
    return NextResponse.json(
      {
        success: false,
        authenticated: false,
        session: null,
        user: null,
        error: 'Failed to load session',
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}
