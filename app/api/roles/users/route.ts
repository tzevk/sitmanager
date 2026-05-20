/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSession } from '@/lib/session';
import { logTableActivity } from '@/lib/activity-log';

// GET: List all users with their roles
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
    const roleId = searchParams.get('role') || '';
    const offset = (page - 1) * limit;

    let whereClause = 'u.deleted = 0';
    const params: any[] = [];

    if (search) {
      whereClause += ` AND (u.firstname LIKE ? OR u.lastname LIKE ? OR u.email LIKE ? OR u.username LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (roleId) {
      whereClause += ` AND u.role = ?`;
      params.push(parseInt(roleId, 10));
    }

    // Get total count
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM awt_adminuser u WHERE ${whereClause}`,
      params
    );
    const total = (countResult as any[])[0].total;

    // Get users with role info
    const [users] = await pool.execute(
      `SELECT u.id, u.firstname, u.lastname, u.email, u.username, u.mobile,
              u.password,
              u.role as role_id, r.title as role_name, u.created_date, u.updated_date
       FROM awt_adminuser u
       LEFT JOIN role r ON u.role = r.id
       WHERE ${whereClause}
       ORDER BY u.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return NextResponse.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// PATCH: Update user's username and/or password
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pool = getPool();
    const body = await request.json();
    const { userId, username, password } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (username !== undefined) {
      const trimmed = String(username).trim();
      if (!trimmed) {
        return NextResponse.json({ success: false, error: 'Username cannot be empty' }, { status: 400 });
      }
      // Check uniqueness (exclude self)
      const [existing] = await pool.execute(
        `SELECT id FROM awt_adminuser WHERE username = ? AND id != ? AND deleted = 0`,
        [trimmed, userId]
      );
      if ((existing as any[]).length > 0) {
        return NextResponse.json({ success: false, error: 'Username is already taken' }, { status: 409 });
      }
      updates.push('username = ?');
      params.push(trimmed);
    }

    if (password !== undefined) {
      if (String(password).length < 3) {
        return NextResponse.json({ success: false, error: 'Password must be at least 3 characters' }, { status: 400 });
      }
      const { createHash } = await import('crypto');
      const hashed = createHash('md5').update(String(password)).digest('hex');
      updates.push('password = ?');
      params.push(hashed);
    }

    if (updates.length === 0) {
      return NextResponse.json({ success: false, error: 'Nothing to update' }, { status: 400 });
    }

    updates.push('updated_date = NOW()');
    params.push(userId);

    await pool.execute(
      `UPDATE awt_adminuser SET ${updates.join(', ')} WHERE id = ? AND deleted = 0`,
      params
    );

    await logTableActivity(request, {
      tableName: 'awt_adminuser',
      action: 'UPDATE',
      recordId: userId,
      details: { fields: updates.filter(u => !u.startsWith('updated')) },
    });

    return NextResponse.json({ success: true, message: 'Credentials updated successfully' });
  } catch (error) {
    console.error('Error updating credentials:', error);
    return NextResponse.json({ success: false, error: 'Failed to update credentials' }, { status: 500 });
  }
}

// PUT: Update user's role
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pool = getPool();
    const body = await request.json();
    const { userId, roleId } = body;

    if (!userId || !roleId) {
      return NextResponse.json(
        { success: false, error: 'User ID and Role ID are required' },
        { status: 400 }
      );
    }

    // Validate role exists
    const [roles] = await pool.execute(
      `SELECT id FROM role WHERE id = ? AND \`delete\` = 0`,
      [roleId]
    );

    if ((roles as any[]).length === 0) {
      return NextResponse.json(
        { success: false, error: 'Role not found' },
        { status: 404 }
      );
    }

    // Update user's role
    await pool.execute(
      `UPDATE awt_adminuser SET role = ?, updated_by = ?, updated_date = NOW() WHERE id = ?`,
      [roleId, session.userId, userId]
    );

    await logTableActivity(request, {
      tableName: 'awt_adminuser',
      action: 'UPDATE',
      recordId: userId,
      details: { roleId },
    });

    return NextResponse.json({
      success: true,
      message: 'User role updated successfully',
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update user role' },
      { status: 500 }
    );
  }
}
