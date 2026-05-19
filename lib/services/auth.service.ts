/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from 'crypto';
import { getPool } from '@/lib/db';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LoginInput {
  username: string;
  password: string;
  department?: string;
}

export interface AuthUser {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  username: string;
  role: number;
  role_title: string;
  dashboard_department: string | null;
}

export interface LoginResult {
  user: AuthUser;
  finalDepartment: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEPARTMENT_ROLE_MAP: Record<string, number[]> = {
  'Career Building Department': [11, 14],
  'Corporate Training': [19],
  'Training and Development': [12],
  'Accounts': [13],
};

const SUPERADMIN_ROLE = 1;

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeRoleTitle(title: unknown): string {
  return String(title ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function inferDepartmentFromRole(roleId: number, roleTitle: unknown): string {
  const t = normalizeRoleTitle(roleTitle);
  if (['super admin', 'superadmin', 'admin', 'administration'].includes(t)) return 'Administration';
  if (t.includes('account')) return 'Accounts';
  if (t.includes('placement') || t.includes('admission') || t.includes('business development'))
    return 'Career Building Department';
  if (t.includes('training') || t.includes('faculty')) return 'Training and Development';
  if (t.includes('corporate training')) return 'Corporate Training';
  return Object.entries(DEPARTMENT_ROLE_MAP).find(([, roles]) => roles.includes(roleId))?.[0] ?? 'unknown';
}

// ── Public service functions ──────────────────────────────────────────────────

/**
 * Validates credentials and resolves the final department.
 * Throws with a `status` property on auth failures so the route can map to HTTP codes.
 */
export async function validateLogin(input: LoginInput): Promise<LoginResult> {
  const { username, password, department } = input;
  const pool = getPool();

  // Backward-compat auth: some records are stored as plain text in legacy data,
  // while others are MD5-hashed.
  const hashedPassword = crypto.createHash('md5').update(password).digest('hex');

  const [rows] = await pool.execute(
    `SELECT u.id, u.firstname, u.lastname, u.email, u.username, u.role,
            r.title AS role_title, r.dashboard_department
     FROM awt_adminuser u
     LEFT JOIN role r ON r.id = u.role
     WHERE u.username = ? AND (u.password = ? OR u.password = ?) AND u.deleted = 0`,
    [username, hashedPassword, password]
  );

  const users = rows as AuthUser[];
  if (users.length === 0) {
    throw Object.assign(new Error('Invalid username or password.'), { status: 401 });
  }

  const user = users[0];

  let finalDepartment = department ?? '';

  if (department) {
    if (!DEPARTMENT_ROLE_MAP[department]) {
      throw Object.assign(new Error('Invalid department selected.'), { status: 400 });
    }
    const allowedRoles = DEPARTMENT_ROLE_MAP[department];
    if (user.role !== SUPERADMIN_ROLE && !allowedRoles.includes(user.role)) {
      const [roleRows] = await pool.execute('SELECT title FROM role WHERE id = ?', [user.role]);
      const roleTitle = (roleRows as any[])[0]?.title ?? 'Unknown';
      throw Object.assign(
        new Error(`You are not assigned to the "${department}" department. Your current role is "${roleTitle}".`),
        { status: 403 }
      );
    }
  } else {
    finalDepartment = inferDepartmentFromRole(user.role, user.role_title);
  }

  return { user, finalDepartment };
}
