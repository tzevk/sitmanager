/* eslint-disable @typescript-eslint/no-explicit-any */
import { cached, getPool } from '@/lib/db';
import { ALL_PERMISSIONS, PERMISSION_GROUPS } from '@/lib/rbac';
import { isSuperAdminRole } from '@/lib/super-admin';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RoleRow {
  id: number;
  title: string;
  description: string;
  created_by: number | null;
  created_date: string | null;
  updated_by: number | null;
  updated_date: string | null;
  deleted: number;
  dashboard_department: string | null;
  permissions: string[];
  isSystemRole?: boolean;
}

export interface CreateRoleInput {
  title: string;
  description?: string;
  permissions: string[];
  dashboard_department?: string | null;
  createdBy: number;
}

export interface UpdateRoleInput {
  title: string;
  description?: string;
  permissions: string[];
  dashboard_department?: string | null;
  updatedBy: number;
}

export interface RolesMeta {
  totalPermissions: number;
  permissionGroups: number;
}

// ── Schema helpers ────────────────────────────────────────────────────────────

async function ensurePermissionsTable(pool: ReturnType<typeof getPool>): Promise<void> {
  await cached('schema:role_permissions', 60 * 60 * 1000, async () => {
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
    return true;
  });
}

async function ensureDashboardDeptColumn(pool: ReturnType<typeof getPool>): Promise<void> {
  await cached('schema:role_dashboard_dept', 60 * 60 * 1000, async () => {
    const [cols] = await pool.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'role'
         AND COLUMN_NAME = 'dashboard_department'`
    );
    if ((cols as any[]).length === 0) {
      await pool.execute(`ALTER TABLE role ADD COLUMN dashboard_department VARCHAR(50) DEFAULT NULL`);
    }
    return true;
  });
}

async function ensureSchema(pool: ReturnType<typeof getPool>): Promise<void> {
  await Promise.all([ensurePermissionsTable(pool), ensureDashboardDeptColumn(pool)]);
}

function validatePermissions(permissions: string[]): string[] {
  const valid = new Set(ALL_PERMISSIONS.map((p) => p.id));
  const invalid = permissions.filter((p) => !valid.has(p));
  if (invalid.length > 0) throw new Error(`Invalid permissions: ${invalid.join(', ')}`);
  return permissions;
}

// ── Public service functions ──────────────────────────────────────────────────

export async function listRoles(options: {
  includeDeleted?: boolean;
  withPermissions?: boolean;
}): Promise<{ roles: RoleRow[]; meta: RolesMeta }> {
  const pool = getPool();
  await ensureSchema(pool);

  const { includeDeleted = false, withPermissions = true } = options;

  let query = `
    SELECT r.id, r.title, r.description, r.created_by, r.created_date,
           r.updated_by, r.updated_date, r.\`delete\` as deleted,
           r.dashboard_department
    FROM role r
  `;
  if (!includeDeleted) query += ' WHERE r.`delete` = 0';
  query += ' ORDER BY r.id ASC';

  const [roles] = await pool.execute(query);
  const roleList = roles as RoleRow[];

  if (withPermissions) {
    const [permissions] = await pool.execute(
      'SELECT role_id, permission_id FROM role_permissions'
    );
    const permMap = new Map<number, string[]>();
    for (const p of permissions as any[]) {
      if (!permMap.has(p.role_id)) permMap.set(p.role_id, []);
      permMap.get(p.role_id)!.push(p.permission_id);
    }
    for (const role of roleList) {
      if (await isSuperAdminRole(role.id, pool)) {
        role.permissions = ALL_PERMISSIONS.map((p) => p.id);
        role.isSystemRole = true;
      } else {
        role.permissions = permMap.get(role.id) ?? [];
      }
    }
  }

  return {
    roles: roleList,
    meta: { totalPermissions: ALL_PERMISSIONS.length, permissionGroups: PERMISSION_GROUPS.length },
  };
}

export async function getRoleById(id: number): Promise<RoleRow | null> {
  const pool = getPool();
  await ensurePermissionsTable(pool);

  const [roles] = await pool.execute(
    `SELECT id, title, description, created_by, created_date,
            updated_by, updated_date, \`delete\` as deleted, dashboard_department
     FROM role WHERE id = ?`,
    [id]
  );
  const role = (roles as RoleRow[])[0];
  if (!role) return null;

  if (await isSuperAdminRole(id, pool)) {
    role.permissions = ALL_PERMISSIONS.map((p) => p.id);
    role.isSystemRole = true;
  } else {
    const [perms] = await pool.execute(
      'SELECT permission_id FROM role_permissions WHERE role_id = ?',
      [id]
    );
    role.permissions = (perms as any[]).map((p) => p.permission_id);
  }

  return role;
}

export async function createRole(input: CreateRoleInput): Promise<RoleRow> {
  const { title, description = '', permissions, dashboard_department, createdBy } = input;
  if (!title?.trim()) throw new Error('Role title is required');
  if (!Array.isArray(permissions)) throw new Error('Permissions must be an array');
  validatePermissions(permissions);

  const pool = getPool();
  await ensureSchema(pool);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.execute(
      `INSERT INTO role (title, description, created_by, created_date, \`delete\`, dashboard_department)
       VALUES (?, ?, ?, NOW(), 0, ?)`,
      [title.trim(), description, createdBy, dashboard_department ?? null]
    );
    const roleId = (result as any).insertId as number;

    if (permissions.length > 0) {
      await conn.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ?', [
        permissions.map((p) => [roleId, p]),
      ]);
    }

    await conn.commit();
    return {
      id: roleId, title: title.trim(), description, permissions,
      dashboard_department: dashboard_department ?? null,
      created_by: createdBy, created_date: null,
      updated_by: null, updated_date: null, deleted: 0,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function updateRole(id: number, input: UpdateRoleInput): Promise<void> {
  const { title, description = '', permissions, dashboard_department, updatedBy } = input;
  if (!title?.trim()) throw new Error('Role title is required');
  if (!Array.isArray(permissions)) throw new Error('Permissions must be an array');
  validatePermissions(permissions);

  const pool = getPool();
  await ensurePermissionsTable(pool);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute(
      `UPDATE role SET title=?, description=?, updated_by=?, updated_date=NOW(), dashboard_department=?
       WHERE id=?`,
      [title.trim(), description, updatedBy, dashboard_department ?? null, id]
    );

    await conn.execute('DELETE FROM role_permissions WHERE role_id = ?', [id]);
    if (permissions.length > 0) {
      await conn.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ?', [
        permissions.map((p) => [id, p]),
      ]);
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function updateRolePartial(
  id: number,
  input: Partial<UpdateRoleInput>
): Promise<void> {
  const { title, description, permissions, dashboard_department, updatedBy } = input;

  if (permissions !== undefined) {
    if (!Array.isArray(permissions)) throw new Error('Permissions must be an array');
    validatePermissions(permissions);
  }

  const pool = getPool();
  await ensurePermissionsTable(pool);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const setClauses: string[] = [];
    const values: any[] = [];

    if (title) { setClauses.push('title = ?'); values.push(title.trim()); }
    if (description !== undefined) { setClauses.push('description = ?'); values.push(description); }
    if (dashboard_department !== undefined) { setClauses.push('dashboard_department = ?'); values.push(dashboard_department ?? null); }
    if (updatedBy) { setClauses.push('updated_by = ?', 'updated_date = NOW()'); values.push(updatedBy); }

    if (setClauses.length > 0) {
      await conn.execute(`UPDATE role SET ${setClauses.join(', ')} WHERE id = ?`, [...values, id]);
    }

    if (permissions !== undefined) {
      await conn.execute('DELETE FROM role_permissions WHERE role_id = ?', [id]);
      if (permissions.length > 0) {
        await conn.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ?', [
          permissions.map((p) => [id, p]),
        ]);
      }
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function countUsersWithRole(id: number): Promise<number> {
  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT COUNT(*) as count FROM awt_adminuser WHERE role = ? AND deleted = 0',
    [id]
  );
  return Number((rows as any[])[0]?.count ?? 0);
}

export async function deleteRole(id: number, deletedBy: number): Promise<void> {
  const pool = getPool();
  await pool.execute(
    'UPDATE role SET `delete`=1, updated_by=?, updated_date=NOW() WHERE id=?',
    [deletedBy, id]
  );
}
