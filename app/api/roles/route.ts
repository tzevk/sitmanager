import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { apiRateLimiter } from '@/lib/rate-limit';
import { logTableActivity } from '@/lib/activity-log';
import { listRoles, createRole } from '@/lib/services/roles.service';

export async function GET(request: NextRequest) {
  try {
    const rateLimited = await apiRateLimiter(request);
    if (rateLimited) return rateLimited;

    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const { roles, meta } = await listRoles({
      includeDeleted: searchParams.get('includeDeleted') === 'true',
      withPermissions: searchParams.get('withPermissions') !== 'false',
    });

    return NextResponse.json({ success: true, data: roles, meta });
  } catch (error) {
    console.error('Error fetching roles:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch roles' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimited = await apiRateLimiter(request);
    if (rateLimited) return rateLimited;

    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();

    const role = await createRole({
      title: body.title,
      description: body.description,
      permissions: body.permissions,
      dashboard_department: body.dashboard_department,
      createdBy: session.userId,
    });

    await Promise.all([
      logTableActivity(request, {
        tableName: 'role',
        action: 'CREATE',
        recordId: role.id,
        details: { title: role.title, permissionsCount: role.permissions.length },
      }),
      logTableActivity(request, {
        tableName: 'role_permissions',
        action: 'CREATE',
        recordId: role.id,
        details: { roleId: role.id, permissions: role.permissions },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: role,
      message: 'Role created successfully',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.startsWith('Invalid permissions') || message.includes('required')) {
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }
    console.error('Error creating role:', error);
    return NextResponse.json({ success: false, error: 'Failed to create role' }, { status: 500 });
  }
}
