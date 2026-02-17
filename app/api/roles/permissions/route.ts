/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { ALL_PERMISSIONS, PERMISSION_GROUPS, getPermissionStats } from '@/lib/rbac';
import { getSession } from '@/lib/session';

// GET: Get all available permissions grouped by department
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const flat = searchParams.get('flat') === 'true';

    if (flat) {
      // Return flat list of all permissions
      return NextResponse.json({
        success: true,
        data: ALL_PERMISSIONS,
        stats: getPermissionStats(),
      });
    }

    // Return permissions grouped by department
    return NextResponse.json({
      success: true,
      data: PERMISSION_GROUPS,
      stats: getPermissionStats(),
    });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch permissions' },
      { status: 500 }
    );
  }
}
