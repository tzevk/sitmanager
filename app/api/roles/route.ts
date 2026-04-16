/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { cached, getPool } from '@/lib/db';
import { ALL_PERMISSIONS, PERMISSION_GROUPS } from '@/lib/rbac';
import { getSession } from '@/lib/session';
import { isSuperAdminRole } from '@/lib/super-admin';
import { apiRateLimiter } from '@/lib/rate-limit';
import { logTableActivity } from '@/lib/activity-log';

// Ensure role_permissions table exists
async function ensureTable(pool: any) {
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
    await ensureTable(pool);
    return true;
  });
}

// GET: List all roles with their permissions
export async function GET(request: NextRequest) {
  try {
    const rateLimited = apiRateLimiter(request);
    if (rateLimited) return rateLimited;

    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pool = getPool();
    await ensureRolePermissionsTableOnce(pool);

    const { searchParams } = new URL(request.url);
    const includeDeleted = searchParams.get('includeDeleted') === 'true';
    const withPermissions = searchParams.get('withPermissions') !== 'false';

    let query = `
      SELECT r.id, r.title, r.description, r.created_by, r.created_date, 
             r.updated_by, r.updated_date, r.\`delete\` as deleted
      FROM role r
    `;
    
    if (!includeDeleted) {
      query += ' WHERE r.`delete` = 0';
    }
    
    query += ' ORDER BY r.id ASC';

    const [roles] = await pool.execute(query);

    if (withPermissions) {
      // Get permissions for all roles
      const [permissions] = await pool.execute(`
        SELECT role_id, permission_id FROM role_permissions
      `);
      
      const permissionMap = new Map<number, string[]>();
      for (const p of permissions as any[]) {
        if (!permissionMap.has(p.role_id)) {
          permissionMap.set(p.role_id, []);
        }
        permissionMap.get(p.role_id)!.push(p.permission_id);
      }

      // Attach permissions to roles
      for (const role of roles as any[]) {
        role.permissions = permissionMap.get(role.id) || [];
        // Special case: Super Admin has all permissions
        if (await isSuperAdminRole(role.id, pool)) {
          role.permissions = ALL_PERMISSIONS.map(p => p.id);
          role.isSystemRole = true;
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: roles,
      meta: {
        totalPermissions: ALL_PERMISSIONS.length,
        permissionGroups: PERMISSION_GROUPS.length,
      },
    });
  } catch (error) {
    console.error('Error fetching roles:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch roles' },
      { status: 500 }
    );
  }
}

// POST: Create a new role
export async function POST(request: NextRequest) {
  try {
    const rateLimited = apiRateLimiter(request);
    if (rateLimited) return rateLimited;

    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pool = getPool();
    await ensureRolePermissionsTableOnce(pool);

    const body = await request.json();
    const { title, description, permissions } = body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Role title is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(permissions)) {
      return NextResponse.json(
        { success: false, error: 'Permissions must be an array' },
        { status: 400 }
      );
    }

    // Validate permissions exist
    const validPermissionIds = new Set(ALL_PERMISSIONS.map(p => p.id));
    const invalidPermissions = permissions.filter(p => !validPermissionIds.has(p));
    if (invalidPermissions.length > 0) {
      return NextResponse.json(
        { success: false, error: `Invalid permissions: ${invalidPermissions.join(', ')}` },
        { status: 400 }
      );
    }

    // Start transaction
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Insert role
      const [result] = await connection.execute(
        `INSERT INTO role (title, description, created_by, created_date, \`delete\`)
         VALUES (?, ?, ?, NOW(), 0)`,
        [title.trim(), description || '', session.userId]
      );

      const roleId = (result as any).insertId;

      // Insert permissions
      if (permissions.length > 0) {
        const permissionValues = permissions.map(p => [roleId, p]);
        await connection.query(
          `INSERT INTO role_permissions (role_id, permission_id) VALUES ?`,
          [permissionValues]
        );
      }

      await connection.commit();

      await logTableActivity(request, {
        tableName: 'role',
        action: 'CREATE',
        recordId: roleId,
        details: { title: title.trim(), permissionsCount: permissions.length },
      });

      await logTableActivity(request, {
        tableName: 'role_permissions',
        action: 'CREATE',
        recordId: roleId,
        details: { roleId, permissions },
      });

      return NextResponse.json({
        success: true,
        data: {
          id: roleId,
          title: title.trim(),
          description: description || '',
          permissions,
        },
        message: 'Role created successfully',
      });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error creating role:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create role' },
      { status: 500 }
    );
  }
}
