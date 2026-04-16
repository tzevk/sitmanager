/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { cached, getPool } from '@/lib/db';
import { ALL_PERMISSIONS } from '@/lib/rbac';
import { getSession } from '@/lib/session';
import { isSuperAdminRole } from '@/lib/super-admin';
import { apiRateLimiter } from '@/lib/rate-limit';
import { logTableActivity } from '@/lib/activity-log';

// Ensure role_permissions table exists (shared schema with /api/roles)
async function ensureRolePermissionsTable(pool: any) {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      role_id INT NOT NULL,
      permission_id VARCHAR(100) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_role_permission (role_id, permission_id),
      INDEX idx_role_id (role_id),
      FOREIGN KEY (role_id) REFERENCES role(id) ON DELETE CASCADE
    )
  `);
}

async function ensureRolePermissionsTableOnce(pool: any) {
  await cached('schema:role_permissions', 60 * 60 * 1000, async () => {
    await ensureRolePermissionsTable(pool);
    return true;
  });
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET: Get single role with permissions
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const rateLimited = apiRateLimiter(request);
    if (rateLimited) return rateLimited;

    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const roleId = parseInt(id, 10);

    if (isNaN(roleId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid role ID' },
        { status: 400 }
      );
    }

    const pool = getPool();
    await ensureRolePermissionsTableOnce(pool);

    const [roles] = await pool.execute(
      `SELECT id, title, description, created_by, created_date, 
              updated_by, updated_date, \`delete\` as deleted
       FROM role WHERE id = ?`,
      [roleId]
    );

    const role = (roles as any[])[0];
    if (!role) {
      return NextResponse.json(
        { success: false, error: 'Role not found' },
        { status: 404 }
      );
    }

    // Get permissions
    const [permissions] = await pool.execute(
      `SELECT permission_id FROM role_permissions WHERE role_id = ?`,
      [roleId]
    );

    // Special case: Super Admin has all permissions (avoid assuming a fixed role id)
    if (await isSuperAdminRole(roleId, pool)) {
      role.permissions = ALL_PERMISSIONS.map(p => p.id);
      role.isSystemRole = true;
    } else {
      role.permissions = (permissions as any[]).map(p => p.permission_id);
    }

    return NextResponse.json({
      success: true,
      data: role,
    });
  } catch (error) {
    console.error('Error fetching role:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch role' },
      { status: 500 }
    );
  }
}

// PUT: Update role
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const rateLimited = apiRateLimiter(request);
    if (rateLimited) return rateLimited;

    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const roleId = parseInt(id, 10);

    if (isNaN(roleId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid role ID' },
        { status: 400 }
      );
    }

    // Prevent modifying Administration role permissions
    if (roleId === 1) {
      return NextResponse.json(
        { success: false, error: 'Cannot modify the Administration role' },
        { status: 403 }
      );
    }

    const pool = getPool();
    await ensureRolePermissionsTableOnce(pool);
    const body = await request.json();
    const { title, description, permissions } = body;

    // Validate role exists
    const [existing] = await pool.execute(
      `SELECT id FROM role WHERE id = ? AND \`delete\` = 0`,
      [roleId]
    );

    if ((existing as any[]).length === 0) {
      return NextResponse.json(
        { success: false, error: 'Role not found' },
        { status: 404 }
      );
    }

    // Validate permissions
    if (permissions && !Array.isArray(permissions)) {
      return NextResponse.json(
        { success: false, error: 'Permissions must be an array' },
        { status: 400 }
      );
    }

    if (permissions) {
      const validPermissionIds = new Set(ALL_PERMISSIONS.map(p => p.id));
      const invalidPermissions = permissions.filter((p: string) => !validPermissionIds.has(p));
      if (invalidPermissions.length > 0) {
        return NextResponse.json(
          { success: false, error: `Invalid permissions: ${invalidPermissions.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Start transaction
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Update role if title or description provided
      if (title || description !== undefined) {
        const updates: string[] = [];
        const values: any[] = [];

        if (title) {
          updates.push('title = ?');
          values.push(title.trim());
        }
        if (description !== undefined) {
          updates.push('description = ?');
          values.push(description);
        }

        updates.push('updated_by = ?', 'updated_date = NOW()');
        values.push(session.userId, roleId);

        await connection.execute(
          `UPDATE role SET ${updates.join(', ')} WHERE id = ?`,
          values
        );
      }

      // Update permissions if provided
      if (permissions) {
        // Delete existing permissions
        await connection.execute(
          `DELETE FROM role_permissions WHERE role_id = ?`,
          [roleId]
        );

        // Insert new permissions
        if (permissions.length > 0) {
          const permissionValues = permissions.map((p: string) => [roleId, p]);
          await connection.query(
            `INSERT INTO role_permissions (role_id, permission_id) VALUES ?`,
            [permissionValues]
          );
        }
      }

      await connection.commit();

      await logTableActivity(request, {
        tableName: 'role',
        action: 'UPDATE',
        recordId: roleId,
        details: { title: title || null, permissionsUpdated: Array.isArray(permissions) },
      });

      if (permissions) {
        await logTableActivity(request, {
          tableName: 'role_permissions',
          action: 'UPDATE',
          recordId: roleId,
          details: { roleId, permissionsCount: permissions.length },
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Role updated successfully',
      });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error updating role:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update role' },
      { status: 500 }
    );
  }
}

// DELETE: Soft delete role
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const roleId = parseInt(id, 10);

    if (isNaN(roleId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid role ID' },
        { status: 400 }
      );
    }

    // Prevent deleting Administration role
    if (roleId === 1) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete the Administration role' },
        { status: 403 }
      );
    }

    const pool = getPool();

    // Check if any users are assigned to this role
    const [users] = await pool.execute(
      `SELECT COUNT(*) as count FROM awt_adminuser WHERE role = ? AND deleted = 0`,
      [roleId]
    );

    const userCount = (users as any[])[0].count;
    if (userCount > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Cannot delete role. ${userCount} user(s) are assigned to this role. Please reassign them first.` 
        },
        { status: 400 }
      );
    }

    // Soft delete the role
    await pool.execute(
      `UPDATE role SET \`delete\` = 1, updated_by = ?, updated_date = NOW() WHERE id = ?`,
      [session.userId, roleId]
    );

    await logTableActivity(request, {
      tableName: 'role',
      action: 'DELETE',
      recordId: roleId,
    });

    return NextResponse.json({
      success: true,
      message: 'Role deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting role:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete role' },
      { status: 500 }
    );
  }
}
