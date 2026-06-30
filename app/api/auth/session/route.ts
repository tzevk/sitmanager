import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getRolePermissions } from '@/lib/api-auth';
import { getPool } from '@/lib/db';
import type { RowDataPacket } from 'mysql2/promise';

interface RoleDashboardRow extends RowDataPacket {
  dashboard_department: string | null;
}

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
    let dashboardDepartment = session.dashboardDepartment || null;
    try {
      const pool = getPool();
      const [roleResult, rolePermissions] = await Promise.all([
        pool.execute<RoleDashboardRow[]>(
          'SELECT dashboard_department FROM role WHERE id = ? LIMIT 1',
          [session.role]
        ),
        getRolePermissions(session.role),
      ]);
      const [roleRows] = roleResult;
      permissions = rolePermissions;
      dashboardDepartment = roleRows[0]?.dashboard_department || dashboardDepartment;
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
          dashboardDepartment,
        },
        user: {
          id: session.userId,
          firstName: session.firstName,
          lastName: session.lastName,
          email: session.email,
          department: session.department,
          role: session.role,
          permissions,
          dashboardDepartment,
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
