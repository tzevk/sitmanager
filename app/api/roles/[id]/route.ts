import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { apiRateLimiter } from '@/lib/rate-limit';
import { logTableActivity } from '@/lib/activity-log';
import {
  getRoleById,
  updateRolePartial,
  countUsersWithRole,
  deleteRole,
} from '@/lib/services/roles.service';

const PROTECTED_ROLE_ID = 1; // Administration — immutable

interface RouteParams {
  params: Promise<{ id: string }>;
}

function parseId(raw: string): number | null {
  const n = parseInt(raw, 10);
  return isNaN(n) ? null : n;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const rateLimited = await apiRateLimiter(request);
    if (rateLimited) return rateLimited;

    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const roleId = parseId((await params).id);
    if (!roleId) return NextResponse.json({ success: false, error: 'Invalid role ID' }, { status: 400 });

    const role = await getRoleById(roleId);
    if (!role) return NextResponse.json({ success: false, error: 'Role not found' }, { status: 404 });

    return NextResponse.json({ success: true, data: role });
  } catch (error) {
    console.error('Error fetching role:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch role' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const rateLimited = await apiRateLimiter(request);
    if (rateLimited) return rateLimited;

    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const roleId = parseId((await params).id);
    if (!roleId) return NextResponse.json({ success: false, error: 'Invalid role ID' }, { status: 400 });
    if (roleId === PROTECTED_ROLE_ID) {
      return NextResponse.json({ success: false, error: 'Cannot modify the Administration role' }, { status: 403 });
    }

    const existing = await getRoleById(roleId);
    if (!existing || existing.deleted) {
      return NextResponse.json({ success: false, error: 'Role not found' }, { status: 404 });
    }

    const body = await request.json();
    await updateRolePartial(roleId, {
      title: body.title,
      description: body.description,
      permissions: body.permissions,
      dashboard_department: body.dashboard_department,
      updatedBy: session.userId,
    });

    await Promise.all([
      logTableActivity(request, {
        tableName: 'role',
        action: 'UPDATE',
        recordId: roleId,
        details: { title: body.title ?? null, permissionsUpdated: Array.isArray(body.permissions) },
      }),
      body.permissions
        ? logTableActivity(request, {
            tableName: 'role_permissions',
            action: 'UPDATE',
            recordId: roleId,
            details: { roleId, permissionsCount: body.permissions.length },
          })
        : Promise.resolve(),
    ]);

    return NextResponse.json({ success: true, message: 'Role updated successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.startsWith('Invalid permissions') || message.includes('must be an array')) {
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }
    console.error('Error updating role:', error);
    return NextResponse.json({ success: false, error: 'Failed to update role' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const roleId = parseId((await params).id);
    if (!roleId) return NextResponse.json({ success: false, error: 'Invalid role ID' }, { status: 400 });
    if (roleId === PROTECTED_ROLE_ID) {
      return NextResponse.json({ success: false, error: 'Cannot delete the Administration role' }, { status: 403 });
    }

    const userCount = await countUsersWithRole(roleId);
    if (userCount > 0) {
      return NextResponse.json(
        { success: false, error: `Cannot delete role. ${userCount} user(s) are assigned to this role. Please reassign them first.` },
        { status: 400 }
      );
    }

    await deleteRole(roleId, session.userId);

    await logTableActivity(request, { tableName: 'role', action: 'DELETE', recordId: roleId });

    return NextResponse.json({ success: true, message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Error deleting role:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete role' }, { status: 500 });
  }
}
