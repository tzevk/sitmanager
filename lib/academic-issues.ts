/* eslint-disable @typescript-eslint/no-explicit-any */
import { cached } from '@/lib/db';
import { getStudentPortalContext, type StudentPortalContext } from '@/lib/student-portal/context';
import { getStudentAcademicRecords, toStudentView, type SourceModule } from '@/lib/student-portal/academic-records';
import { getAcademicAttendance } from '@/lib/student-portal/academic-attendance';
import { statusLabel } from '@/lib/student-portal/academic-status';

/**
 * Academic issues ("Raise an Issue"): a student challenges ONE specific CRM
 * record — an assignment test, unit test, final exam attempt, viva/MOC entry or
 * a lecture's attendance. The issue only REFERENCES that record (module +
 * sheet/sitting + the student's own row); it never copies or edits marks.
 * Corrections are made in the existing CRM screens, which stay authoritative.
 *
 * Duplicate prevention is enforced by the database: open_key is set to
 * "student:module:parent" while an issue is open and cleared (NULL) when it is
 * resolved or rejected, and it carries a UNIQUE key — so a record can only ever
 * have one open issue, even with simultaneous submissions.
 */

export type IssueModule = SourceModule | 'ATTENDANCE';
export type IssueStatus = 'OPEN' | 'UNDER_REVIEW' | 'INFO_REQUIRED' | 'RESOLVED' | 'REJECTED';

export const ISSUE_MODULES: IssueModule[] = ['ASSIGNMENT', 'UNIT_TEST', 'FINAL_EXAM', 'VIVA_MOC', 'ATTENDANCE'];
export const OPEN_STATUSES: IssueStatus[] = ['OPEN', 'UNDER_REVIEW', 'INFO_REQUIRED'];
export const CLOSED_STATUSES: IssueStatus[] = ['RESOLVED', 'REJECTED'];

export const ISSUE_TYPES = [
  'Incorrect Marks',
  'Marks Missing',
  'Marks Not Updated',
  'Incorrect Total',
  'Incorrectly Marked Absent',
  'Submission Not Recorded',
  'Wrong Attempt',
  'Attendance Discrepancy',
  'Evaluation Clarification',
  'Other',
] as const;

export const MODULE_LABEL: Record<IssueModule, string> = {
  ASSIGNMENT: 'Assignment Test',
  UNIT_TEST: 'Unit Test',
  FINAL_EXAM: 'Final Exam',
  VIVA_MOC: 'Viva / MOC',
  ATTENDANCE: 'Attendance',
};

export class IssueError extends Error {
  constructor(message: string, public status = 400, public extra: Record<string, unknown> = {}) {
    super(message);
  }
}

/** New tables, created once (same runtime pattern as the other CRM modules). */
export async function ensureIssueTables(pool: any): Promise<void> {
  await cached('schema:academic_issue:v1', 60 * 60 * 1000, async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS academic_issue (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id INT NOT NULL,
        batch_id INT NULL,
        source_module VARCHAR(20) NOT NULL,
        parent_id INT NOT NULL,
        record_id INT NULL,
        attempt TINYINT NULL,
        assessment_name VARCHAR(255) NOT NULL,
        record_date VARCHAR(10) NULL,
        max_marks DECIMAL(8,2) NULL,
        shown_to_student VARCHAR(100) NULL,
        issue_type VARCHAR(60) NOT NULL,
        description TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
        open_key VARCHAR(64) NULL,
        resolution_note TEXT NULL,
        assigned_to INT NULL,
        assigned_to_name VARCHAR(255) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        resolved_at DATETIME NULL,
        resolved_by INT NULL,
        resolved_by_name VARCHAR(255) NULL,
        UNIQUE KEY uq_academic_issue_open (open_key),
        INDEX idx_academic_issue_student (student_id, created_at),
        INDEX idx_academic_issue_status (status, created_at),
        INDEX idx_academic_issue_batch (batch_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS academic_issue_event (
        id INT AUTO_INCREMENT PRIMARY KEY,
        issue_id INT NOT NULL,
        event_type VARCHAR(30) NOT NULL,
        from_status VARCHAR(20) NULL,
        to_status VARCHAR(20) NULL,
        message TEXT NULL,
        is_internal TINYINT(1) NOT NULL DEFAULT 0,
        actor_type VARCHAR(10) NOT NULL,
        actor_id INT NULL,
        actor_name VARCHAR(255) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_academic_issue_event_issue (issue_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    return true;
  });
}

const openKey = (studentId: number, module: IssueModule, parentId: number) => `${studentId}:${module}:${parentId}`;

/** What the student currently sees for the record, resolved on the server from
 * CRM data — never trusted from the browser. Null when the record isn't theirs. */
async function resolveStudentRecord(pool: any, ctx: StudentPortalContext, module: IssueModule, parentId: number) {
  if (module === 'ATTENDANCE') {
    const att = await getAcademicAttendance(pool, ctx);
    const lecture = att.lectures.find((l) => l.Take_Id === parentId);
    if (!lecture) return null;
    return {
      recordId: null,
      attempt: null,
      name: lecture.Topic || 'Lecture',
      date: lecture.Take_Dt,
      maxMarks: null,
      shown: lecture.present ? (lecture.Late ? 'Present (late)' : 'Present') : 'Absent',
    };
  }
  const records = await getStudentAcademicRecords(pool, ctx, [module]);
  const rec = records.find((r) => r.parentId === parentId);
  if (!rec) return null;
  const view = toStudentView(rec);
  const shown = view.status === 'EVALUATED' && view.marksObtained !== null
    ? `${view.marksObtained}${view.maxMarks !== null ? ` / ${view.maxMarks}` : ''}`
    : statusLabel(view.status);
  return { recordId: rec.recordId, attempt: rec.attempt, name: rec.assessmentName, date: rec.date, maxMarks: rec.maxMarks, shown };
}

export async function raiseIssue(
  pool: any,
  studentId: number,
  input: { sourceModule: unknown; parentId: unknown; issueType: unknown; description: unknown }
) {
  const module = String(input.sourceModule ?? '') as IssueModule;
  const parentId = Number(input.parentId);
  const issueType = String(input.issueType ?? '').trim();
  const description = String(input.description ?? '').trim();

  if (!ISSUE_MODULES.includes(module)) throw new IssueError('Unknown record type.');
  if (!Number.isInteger(parentId) || parentId <= 0) throw new IssueError('Unknown record.');
  if (!(ISSUE_TYPES as readonly string[]).includes(issueType)) throw new IssueError('Please choose an issue type.');
  if (description.length < 10) throw new IssueError('Please describe the issue (at least 10 characters).');
  if (description.length > 2000) throw new IssueError('Description is too long (2000 characters max).');

  await ensureIssueTables(pool);
  const ctx = await getStudentPortalContext(pool, studentId);
  if (!ctx) throw new IssueError('Student not found.', 404);
  const record = await resolveStudentRecord(pool, ctx, module, parentId);
  if (!record) throw new IssueError('This record could not be found on your account.', 404);

  const key = openKey(studentId, module, parentId);
  try {
    const [ins] = await pool.query(
      `INSERT INTO academic_issue
         (student_id, batch_id, source_module, parent_id, record_id, attempt, assessment_name, record_date,
          max_marks, shown_to_student, issue_type, description, status, open_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?)`,
      [studentId, ctx.batchId, module, parentId, record.recordId, record.attempt, record.name.slice(0, 255), record.date,
        record.maxMarks, record.shown, issueType, description, key]
    );
    const issueId = Number((ins as any).insertId);
    await pool.query(
      `INSERT INTO academic_issue_event (issue_id, event_type, to_status, message, actor_type, actor_id, actor_name)
       VALUES (?, 'RAISED', 'OPEN', ?, 'STUDENT', ?, ?)`,
      [issueId, `${issueType}: ${description}`, studentId, ctx.studentName]
    );
    return { id: issueId };
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') {
      const [[existing]] = await pool.query(`SELECT id FROM academic_issue WHERE open_key = ? LIMIT 1`, [key]);
      throw new IssueError('This academic record already has an active issue.', 409, { issueId: existing?.id ?? null });
    }
    throw err;
  }
}

const ISSUE_COLUMNS = `i.id, i.student_id, i.batch_id, i.source_module, i.parent_id, i.record_id, i.attempt,
  i.assessment_name, i.record_date, i.max_marks, i.shown_to_student, i.issue_type, i.description, i.status,
  i.resolution_note, i.assigned_to_name, i.created_at, i.updated_at, i.resolved_at, i.resolved_by_name`;

/** A student's own issues, with the timeline (staff-internal notes excluded). */
export async function listStudentIssues(pool: any, studentId: number) {
  await ensureIssueTables(pool);
  const [issues] = await pool.query(
    `SELECT ${ISSUE_COLUMNS} FROM academic_issue i WHERE i.student_id = ? ORDER BY i.created_at DESC, i.id DESC LIMIT 200`,
    [studentId]
  );
  const ids = (issues as any[]).map((i) => i.id);
  const events = ids.length
    ? (await pool.query(
        `SELECT id, issue_id, event_type, from_status, to_status, message, actor_type, created_at
         FROM academic_issue_event WHERE issue_id IN (?) AND is_internal = 0 ORDER BY created_at, id`,
        [ids]
      ))[0]
    : [];
  const byIssue = new Map<number, any[]>();
  for (const e of events as any[]) byIssue.set(e.issue_id, [...(byIssue.get(e.issue_id) ?? []), e]);
  return (issues as any[]).map((i) => ({ ...i, events: byIssue.get(i.id) ?? [] }));
}

/** Student answers a "Request information": adds the reply and moves the issue back to review. */
export async function studentReply(pool: any, studentId: number, issueId: number, message: unknown) {
  const text = String(message ?? '').trim();
  if (text.length < 2) throw new IssueError('Please write a reply.');
  if (text.length > 2000) throw new IssueError('Reply is too long (2000 characters max).');
  await ensureIssueTables(pool);
  const [[issue]] = await pool.query(`SELECT id, status FROM academic_issue WHERE id = ? AND student_id = ?`, [issueId, studentId]);
  if (!issue) throw new IssueError('Issue not found.', 404);
  if (issue.status !== 'INFO_REQUIRED') throw new IssueError('This issue is not waiting for information from you.', 409);
  await pool.query(`UPDATE academic_issue SET status = 'UNDER_REVIEW' WHERE id = ?`, [issueId]);
  await pool.query(
    `INSERT INTO academic_issue_event (issue_id, event_type, from_status, to_status, message, actor_type, actor_id)
     VALUES (?, 'STUDENT_REPLY', 'INFO_REQUIRED', 'UNDER_REVIEW', ?, 'STUDENT', ?)`,
    [issueId, text, studentId]
  );
}

/* ── Staff side ───────────────────────────────────────────────────────────── */

export async function listIssuesForStaff(pool: any, f: { status?: string; batchId?: number; module?: string; type?: string; search?: string }) {
  await ensureIssueTables(pool);
  const where: string[] = ['1=1'];
  const params: any[] = [];
  if (f.status === 'ACTIVE') where.push(`i.status IN ('OPEN','UNDER_REVIEW','INFO_REQUIRED')`);
  else if (f.status && f.status !== 'ALL') { where.push('i.status = ?'); params.push(f.status); }
  if (f.batchId) { where.push('i.batch_id = ?'); params.push(f.batchId); }
  if (f.module && ISSUE_MODULES.includes(f.module as IssueModule)) { where.push('i.source_module = ?'); params.push(f.module); }
  if (f.type) { where.push('i.issue_type = ?'); params.push(f.type); }
  if (f.search) {
    where.push(`(s.Student_Name LIKE ? OR a.Roll_No LIKE ? OR i.assessment_name LIKE ? OR CAST(i.id AS CHAR) = ?)`);
    const like = `%${f.search}%`;
    params.push(like, like, like, f.search.replace(/^#/, ''));
  }
  const [rows] = await pool.query(
    `SELECT ${ISSUE_COLUMNS}, s.Student_Name, a.Roll_No, b.Batch_code, c.Course_Name
     FROM academic_issue i
     LEFT JOIN student_master s ON s.Student_Id = i.student_id
     LEFT JOIN batch_mst b ON b.Batch_Id = i.batch_id
     LEFT JOIN course_mst c ON c.Course_Id = b.Course_Id
     LEFT JOIN admission_master a ON a.Admission_Id = (
       SELECT MAX(a2.Admission_Id) FROM admission_master a2
       WHERE a2.Student_Id = i.student_id AND a2.Batch_Id = i.batch_id AND (a2.IsDelete = 0 OR a2.IsDelete IS NULL)
     )
     WHERE ${where.join(' AND ')}
     ORDER BY FIELD(i.status, 'OPEN', 'INFO_REQUIRED', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED'), i.created_at DESC
     LIMIT 300`,
    params
  );
  const [counts] = await pool.query(`SELECT status, COUNT(*) n FROM academic_issue GROUP BY status`);
  const [batches] = await pool.query(
    `SELECT DISTINCT i.batch_id AS id, b.Batch_code AS code FROM academic_issue i
     LEFT JOIN batch_mst b ON b.Batch_Id = i.batch_id WHERE i.batch_id IS NOT NULL ORDER BY b.Batch_code`
  );
  return {
    issues: rows,
    counts: Object.fromEntries((counts as any[]).map((r) => [r.status, Number(r.n)])),
    batches,
  };
}

/** Where staff correct the original record — the existing CRM marks screens. */
export function correctionLink(module: IssueModule, parentId: number): string | null {
  switch (module) {
    case 'ASSIGNMENT': return `/dashboard/daily-activities/assignments-taken/add?id=${parentId}`;
    case 'UNIT_TEST': return `/dashboard/daily-activities/unit-test-taken/add?id=${parentId}`;
    case 'FINAL_EXAM': return `/dashboard/daily-activities/final-exam-taken/add?id=${parentId}`;
    case 'VIVA_MOC': return `/dashboard/daily-activities/viva-moc-taken/add?id=${parentId}`;
    case 'ATTENDANCE': return `/dashboard/daily-activities/lecture-taken/add?id=${parentId}`;
  }
}

export async function getIssueForStaff(pool: any, issueId: number) {
  await ensureIssueTables(pool);
  const [[issue]] = await pool.query(
    `SELECT ${ISSUE_COLUMNS}, s.Student_Name, s.Email, s.Present_Mobile, b.Batch_code, c.Course_Name
     FROM academic_issue i
     LEFT JOIN student_master s ON s.Student_Id = i.student_id
     LEFT JOIN batch_mst b ON b.Batch_Id = i.batch_id
     LEFT JOIN course_mst c ON c.Course_Id = b.Course_Id
     WHERE i.id = ?`,
    [issueId]
  );
  if (!issue) return null;
  const [events] = await pool.query(
    `SELECT id, event_type, from_status, to_status, message, is_internal, actor_type, actor_name, created_at
     FROM academic_issue_event WHERE issue_id = ? ORDER BY created_at, id`,
    [issueId]
  );

  // Current CRM evidence: the record as it stands now (unpublished marks visible
  // to staff), plus attendance on that date — read live, never copied.
  let current: any = null;
  const ctx = await getStudentPortalContext(pool, Number(issue.student_id));
  if (ctx && ctx.batchId === Number(issue.batch_id)) {
    if (issue.source_module === 'ATTENDANCE') {
      const att = await getAcademicAttendance(pool, ctx);
      const l = att.lectures.find((x) => x.Take_Id === Number(issue.parent_id));
      if (l) current = { kind: 'ATTENDANCE', topic: l.Topic, date: l.Take_Dt, present: Boolean(l.present), late: Boolean(l.Late), faculty: l.Faculty_Name };
    } else {
      const recs = await getStudentAcademicRecords(pool, ctx, [issue.source_module as SourceModule]);
      const r = recs.find((x) => x.parentId === Number(issue.parent_id));
      if (r) current = { kind: 'MARKS', ...r, statusLabel: statusLabel(r.status) };
    }
  }
  return { issue, events, current, roll_no: ctx?.rollNo ?? null, correctionLink: correctionLink(issue.source_module, Number(issue.parent_id)) };
}

const TRANSITIONS: Record<string, { to: IssueStatus; from: IssueStatus[]; needsMessage: boolean; event: string }> = {
  review: { to: 'UNDER_REVIEW', from: ['OPEN', 'INFO_REQUIRED'], needsMessage: false, event: 'STATUS' },
  request_info: { to: 'INFO_REQUIRED', from: ['OPEN', 'UNDER_REVIEW'], needsMessage: true, event: 'INFO_REQUESTED' },
  resolve: { to: 'RESOLVED', from: ['OPEN', 'UNDER_REVIEW', 'INFO_REQUIRED'], needsMessage: true, event: 'RESOLVED' },
  reject: { to: 'REJECTED', from: ['OPEN', 'UNDER_REVIEW', 'INFO_REQUIRED'], needsMessage: true, event: 'REJECTED' },
  reopen: { to: 'UNDER_REVIEW', from: ['RESOLVED', 'REJECTED'], needsMessage: true, event: 'REOPENED' },
};

export interface StaffActor { userId: number; name: string }

/**
 * Staff actions. Status changes go through TRANSITIONS; "note" adds an internal
 * note without changing status. Resolve may also publish a notice on the
 * existing Notice Board (awt_noticeboard) — the caller checks that permission.
 */
export async function staffAction(
  pool: any,
  issueId: number,
  actor: StaffActor,
  input: { action: unknown; message: unknown; notice?: { title?: unknown; text?: unknown } | null }
) {
  await ensureIssueTables(pool);
  const action = String(input.action ?? '');
  const message = String(input.message ?? '').trim();
  if (message.length > 4000) throw new IssueError('Message is too long.');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[issue]] = await conn.query(`SELECT * FROM academic_issue WHERE id = ? FOR UPDATE`, [issueId]);
    if (!issue) throw new IssueError('Issue not found.', 404);

    if (action === 'note') {
      if (message.length < 2) throw new IssueError('Write a note first.');
      await conn.query(
        `INSERT INTO academic_issue_event (issue_id, event_type, message, is_internal, actor_type, actor_id, actor_name)
         VALUES (?, 'NOTE', ?, 1, 'STAFF', ?, ?)`,
        [issueId, message, actor.userId, actor.name]
      );
      await conn.commit();
      return { status: issue.status };
    }

    const t = TRANSITIONS[action];
    if (!t) throw new IssueError('Unknown action.');
    if (!t.from.includes(issue.status)) throw new IssueError(`This issue is ${issue.status.replace('_', ' ').toLowerCase()} — that action isn't available.`, 409);
    if (t.needsMessage && message.length < 2) throw new IssueError('Please add a message for the student.');

    const closing = CLOSED_STATUSES.includes(t.to);
    if (action === 'reopen') {
      // Re-arm duplicate protection; fails if the student already raised a new one.
      try {
        await conn.query(`UPDATE academic_issue SET open_key = ? WHERE id = ?`, [openKey(issue.student_id, issue.source_module, issue.parent_id), issueId]);
      } catch (err: any) {
        if (err?.code === 'ER_DUP_ENTRY') throw new IssueError('The student already has another open issue on this record.', 409);
        throw err;
      }
    }
    await conn.query(
      `UPDATE academic_issue SET status = ?,
         assigned_to = COALESCE(assigned_to, ?), assigned_to_name = COALESCE(assigned_to_name, ?),
         ${closing ? 'open_key = NULL, resolution_note = ?, resolved_at = NOW(), resolved_by = ?, resolved_by_name = ?' : 'resolution_note = resolution_note'}
       WHERE id = ?`,
      closing ? [t.to, actor.userId, actor.name, message, actor.userId, actor.name, issueId] : [t.to, actor.userId, actor.name, issueId]
    );
    await conn.query(
      `INSERT INTO academic_issue_event (issue_id, event_type, from_status, to_status, message, actor_type, actor_id, actor_name)
       VALUES (?, ?, ?, ?, ?, 'STAFF', ?, ?)`,
      [issueId, t.event, issue.status, t.to, message || null, actor.userId, actor.name]
    );

    let noticeId: number | null = null;
    if (action === 'resolve' && input.notice) {
      const title = String(input.notice.title ?? '').trim();
      const text = String(input.notice.text ?? '').trim();
      if (!title || !text) throw new IssueError('A notice needs a title and text.');
      // awt_noticeboard's title column is added lazily by the Notice Board CRUD.
      const [[col]] = await conn.query(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'awt_noticeboard' AND COLUMN_NAME = 'title'`
      );
      if (Number(col?.cnt ?? 0) === 0) throw new IssueError('Open the Notice Board once to finish its setup, then try again.', 409);
      const [n] = await conn.query(
        `INSERT INTO awt_noticeboard (title, specification, startdate, enddate, created_by, deleted)
         VALUES (?, ?, DATE_FORMAT(CURDATE(), '%Y-%m-%d'), NULL, ?, 0)`,
        [title.slice(0, 255), text, actor.userId]
      );
      noticeId = Number((n as any).insertId);
      await conn.query(
        `INSERT INTO academic_issue_event (issue_id, event_type, message, actor_type, actor_id, actor_name)
         VALUES (?, 'NOTICE_POSTED', ?, 'STAFF', ?, ?)`,
        [issueId, `Notice posted: ${title}`, actor.userId, actor.name]
      );
    }

    await conn.commit();
    return { status: t.to, noticeId };
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}
