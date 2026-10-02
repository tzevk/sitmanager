/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from 'crypto';
import { encryptPassword } from '@/lib/student-password-crypto';

/**
 * Staff-side create / update of a student portal account (student_portal_auth).
 *
 * Ownership rules — a portal account belongs to exactly one CRM student:
 *  - A username already attached to ANOTHER student is refused. The account is
 *    never moved to a different student and its password is never reset. (The
 *    previous "upsert by username" did both, and usernames are roll numbers, so
 *    a renumbered batch could hand one student's login to another.)
 *  - A student who already has an account under a different username is
 *    refused too, rather than getting a second account.
 *  - The password only changes on an explicit reset (resetPassword = true);
 *    saving the Active toggle leaves it untouched.
 */

export class PortalAccountError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export interface SaveStudentAccountInput {
  studentId: number;
  username: string;
  /** Required when creating, or with resetPassword. Never stored in plain text. */
  password?: string;
  resetPassword?: boolean;
  isActive: boolean;
}

export interface SaveStudentAccountResult {
  action: 'created' | 'updated';
  username: string;
  passwordReset: boolean;
}

export const USERNAME_TAKEN_MESSAGE = 'This username is already assigned to another student account.';

const md5Hex = (value: string) => crypto.createHash('md5').update(value).digest('hex');

export async function saveStudentPortalAccount(pool: any, input: SaveStudentAccountInput): Promise<SaveStudentAccountResult> {
  const studentId = Number(input.studentId);
  const username = String(input.username ?? '').trim();
  const password = String(input.password ?? '');
  const isActive = input.isActive ? 1 : 0;

  if (!Number.isInteger(studentId) || studentId <= 0) throw new PortalAccountError('studentId is required');
  if (!username) throw new PortalAccountError('username is required');

  const [studentRows] = await pool.query(
    `SELECT Student_Id FROM student_master WHERE Student_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL) LIMIT 1`,
    [studentId]
  );
  if ((studentRows as any[]).length === 0) {
    throw new PortalAccountError('Student not found or deleted. Create/select a valid student record first.');
  }

  // Username comparison follows the column collation (case-insensitive), the
  // same rule the UNIQUE key on Username enforces.
  const [byUsername] = await pool.query(
    `SELECT Id, Student_Id FROM student_portal_auth WHERE Username = ? LIMIT 1`,
    [username]
  );
  const existing = (byUsername as any[])[0];

  if (existing && Number(existing.Student_Id) !== studentId) {
    throw new PortalAccountError(USERNAME_TAKEN_MESSAGE, 409);
  }

  if (existing) {
    // Same student's own account: update status, and the password only on an explicit reset.
    if (input.resetPassword) {
      if (!password) throw new PortalAccountError('password is required to reset');
      await pool.query(
        `UPDATE student_portal_auth
         SET Password_Hash = ?, Password_Enc = ?, Must_Change_Password = 1, IsActive = ?
         WHERE Id = ? AND Student_Id = ?`,
        [md5Hex(password), encryptPassword(password), isActive, existing.Id, studentId]
      );
    } else {
      await pool.query(
        `UPDATE student_portal_auth SET IsActive = ? WHERE Id = ? AND Student_Id = ?`,
        [isActive, existing.Id, studentId]
      );
    }
    return { action: 'updated', username, passwordReset: Boolean(input.resetPassword) };
  }

  // New account. One account per student.
  const [byStudent] = await pool.query(
    `SELECT Username FROM student_portal_auth WHERE Student_Id = ? LIMIT 1`,
    [studentId]
  );
  const other = (byStudent as any[])[0];
  if (other) {
    throw new PortalAccountError(
      `This student already has a portal account (username "${other.Username}"). Update that account instead.`,
      409
    );
  }
  if (!password) throw new PortalAccountError('password is required');

  try {
    // Plain INSERT: if another request created this username meanwhile, the
    // UNIQUE key rejects it here instead of an upsert taking the account over.
    await pool.query(
      `INSERT INTO student_portal_auth (Student_Id, Username, Password_Hash, Password_Enc, Must_Change_Password, IsActive)
       VALUES (?, ?, ?, ?, 1, ?)`,
      [studentId, username, md5Hex(password), encryptPassword(password), isActive]
    );
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') throw new PortalAccountError(USERNAME_TAKEN_MESSAGE, 409);
    throw err;
  }
  return { action: 'created', username, passwordReset: false };
}
