/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPool, cached } from '@/lib/db';
import { FOLLOW_UP_DUE_WINDOW_DAYS } from '@/lib/services/inquiry.service';
import { nowLocal } from '@/lib/appointments/time';
import { isSuperAdminRole } from '@/lib/super-admin';

/**
 * My Tasks — the day's leads (follow-ups due, overdue, new) and counselling appointments.
 *
 * student_inquiry has no owner column and cannot take new ones, so ownership lives in
 * inquiry_assignments. A lead's owner is only ever the counsellor it was explicitly assigned to.
 */

const CLOSED_STATUS_REGEXP = 'admission (taken|confirmed)|not interested|irrelevant|junk|lost lead|clos|duplicate|not eligible';

/**
 * Who may look beyond their own leads on My Tasks (other counsellors, unassigned leads, all leads)
 * and allocate leads: Super Admin, and the Mayur Jagtap account. Everyone else only ever sees the
 * leads allocated to them, or that they initiated.
 */
export async function canSeeAllTasks(session: { role: number; firstName?: string | null; lastName?: string | null }): Promise<boolean> {
  if (await isSuperAdminRole(Number(session.role), getPool())) return true;
  const words = `${session.firstName ?? ''} ${session.lastName ?? ''}`.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  return words.includes('mayur') && words.includes('jagtap');
}

export async function ensureAssignmentsTable() {
  await cached('schema:inquiry_assignments', 60 * 60 * 1000, async () => {
    await getPool().query(
      `CREATE TABLE IF NOT EXISTS inquiry_assignments (
         Inquiry_Id INT NOT NULL PRIMARY KEY,
         Assigned_User_Id INT NOT NULL,
         Assigned_By INT NULL,
         Assigned_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         INDEX idx_assign_user (Assigned_User_Id)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    );
    return true;
  });
}

/**
 * allocated: leads the sales manager assigned to the owner (inquiry_assignments).
 * initiated: leads whose first discussion was written by the owner (the first counsellor).
 */
export type TaskScope = 'allocated' | 'initiated';

/** Who wrote each lead's first discussion (earliest by date, then id). Leads with none are absent. */
async function firstDiscussionAuthors(ids: number[]): Promise<Map<number, number>> {
  const pool = getPool();
  const first = new Map<number, number>();
  for (let i = 0; i < ids.length; i += 1000) {
    const part = ids.slice(i, i + 1000);
    const [rows] = await pool.query(
      `SELECT Inquiry_id AS iid, created_by AS uid FROM awt_inquirydiscussion
        WHERE deleted = 0 AND Inquiry_id IN (${part.map(() => '?').join(',')})
        ORDER BY Inquiry_id, (created_date IS NULL), created_date, id`,
      part
    );
    for (const r of rows as any[]) {
      const iid = Number(r.iid);
      if (!first.has(iid) && r.uid != null) first.set(iid, Number(r.uid));
    }
  }
  return first;
}

export interface MyTasksFilters {
  date: string;
  /** Which tasks: leads allocated to the owner, or leads the owner initiated. Default allocated. */
  scope?: TaskScope;
  /** user id, 'all' or 'unowned' */
  owner: string;
  /** All leads view: the last 90 days of leads and every follow-up, not just this day's list. */
  all?: boolean;
  statuses?: string[];
  courseIds?: number[];
  modes?: string[];
  temps?: string[];
  batches?: string[];
  q?: string;
}

export interface TaskLead {
  Inquiry_Id: number;
  Student_Name: string | null;
  Present_Mobile: string | null;
  Email: string | null;
  CourseName: string | null;
  Course_Id: number | null;
  Batch_Code: string | null;
  Inquiry_From: string | null;
  StatusLabel: string | null;
  Temperature: string | null;
  NextFollowUpDate: string | null;
  InquiryDate: string | null;
  OwnerId: number | null;
  OwnerName: string | null;
  /** The counsellor who wrote the first discussion; set only for the initiated scope. */
  InitiatedByName?: string | null;
  Reason: 'Follow-up due' | 'Overdue' | 'Upcoming' | 'New lead' | 'Lead';
}

export async function getMyTaskLeads(f: MyTasksFilters): Promise<TaskLead[]> {
  await ensureAssignmentsTable();
  const pool = getPool();
  // "Today" in India time: the UTC date is a day behind from midnight to 5:30am, which dropped overdue leads.
  const isToday = f.date === nowLocal().date;
  const guarded = async (sql: string, params: any[]): Promise<any[]> => {
    try {
      const [rows] = await pool.query(`SET STATEMENT max_statement_time=15 FOR ${sql}`, params);
      return rows as any[];
    } catch (err: any) {
      if (!/max_statement_time|syntax/i.test(String(err?.message))) throw err;
      const [rows] = await pool.query(sql, params);
      return rows as any[];
    }
  };

  // 1. Candidates — kept as small, separate queries: a single big join over the whole inquiry
  //    and discussion tables is far too slow.
  const [due, fresh] = await Promise.all([
    guarded(
      `SELECT d.Inquiry_id AS iid, DATE_FORMAT(d.nextdate, '%Y-%m-%d') AS nextdate, d.created_by
         FROM awt_inquirydiscussion d
        WHERE d.deleted = 0 AND ${f.all ? 'd.nextdate >= DATE_SUB(?, INTERVAL 90 DAY)' : isToday ? `d.nextdate BETWEEN DATE_SUB(?, INTERVAL ${FOLLOW_UP_DUE_WINDOW_DAYS} DAY) AND ?` : 'd.nextdate = ?'}
          AND NOT EXISTS (SELECT 1 FROM awt_inquirydiscussion d2 WHERE d2.Inquiry_id = d.Inquiry_id AND d2.deleted = 0 AND d2.id > d.id)`,
      isToday && !f.all ? [f.date, f.date] : [f.date]
    ),
    guarded(
      `SELECT Inquiry_Id FROM student_inquiry WHERE ${f.all ? '_inquiry_date >= DATE_SUB(?, INTERVAL 90 DAY)' : '_inquiry_date = ?'} AND (IsDelete = 0 OR IsDelete IS NULL)`,
      [f.date]
    ),
  ]);
  const dueBy = new Map<number, { next: string; by: number | null }>();
  due.forEach((r) => dueBy.set(Number(r.iid), { next: r.nextdate, by: r.created_by == null ? null : Number(r.created_by) }));
  const ids = [...new Set([...dueBy.keys(), ...fresh.map((r) => Number(r.Inquiry_Id))])].filter((n) => Number.isInteger(n) && n > 0);
  if (!ids.length) return [];
  const marks = ids.map(() => '?').join(',');

  // 2. Ownership first (cheap), so the heavier detail query only covers the chosen owner's leads.
  const assigned = await guarded(`SELECT Inquiry_Id, Assigned_User_Id FROM inquiry_assignments WHERE Inquiry_Id IN (${marks})`, ids);
  const assignedTo = new Map<number, number>(assigned.map((r) => [Number(r.Inquiry_Id), Number(r.Assigned_User_Id)]));
  const ownerOf = (id: number): number | null => assignedTo.get(id) ?? null;

  const initiated = f.scope === 'initiated';
  const firstBy = initiated ? await firstDiscussionAuthors(ids) : new Map<number, number>();
  const mine = ids.filter((id) => {
    if (initiated) {
      const by = firstBy.get(id) ?? null;
      return f.owner === 'all' ? by != null : f.owner === 'unowned' ? by == null : by === Number(f.owner);
    }
    const o = ownerOf(id);
    return f.owner === 'all' ? true : f.owner === 'unowned' ? o == null : o === Number(f.owner);
  });
  if (!mine.length) return [];
  const marks2 = mine.map(() => '?').join(',');
  const rows = await guarded(
    `SELECT si.Inquiry_Id, si.Student_Name, si.Present_Mobile, si.Email, si.Course_Id, c.Course_Name AS CourseName,
            si.Batch_Code, si.Inquiry_From, s.Status AS StatusLabel, lt.Temperature,
            DATE_FORMAT(si._inquiry_date, '%Y-%m-%d') AS InquiryDate
       FROM student_inquiry si
       LEFT JOIN course_mst c ON c.Course_Id = si.Course_Id
       LEFT JOIN status_master s ON s.Id = CAST(NULLIF(si.OnlineState,'') AS UNSIGNED)
       LEFT JOIN inquiry_lead_temperature lt ON lt.Inquiry_Id = si.Inquiry_Id
      WHERE si.Inquiry_Id IN (${marks2}) AND (si.IsDelete = 0 OR si.IsDelete IS NULL)`,
    mine
  );

  const [users] = await pool.query(
    `SELECT id, COALESCE(NULLIF(TRIM(CONCAT(COALESCE(firstname, ''), ' ', COALESCE(lastname, ''))), ''), username) AS name FROM awt_adminuser`
  );
  const userName = new Map<number, string>((users as any[]).map((u) => [Number(u.id), String(u.name)]));

  const needle = f.q?.trim().toLowerCase();
  const out: TaskLead[] = [];
  for (const r of rows) {
    const id = Number(r.Inquiry_Id);
    const closed = new RegExp(CLOSED_STATUS_REGEXP).test(String(r.StatusLabel || '').toLowerCase());
    const d = dueBy.get(id);
    const isDue = Boolean(d) && !closed;
    const isNew = r.InquiryDate === f.date;
    if (!f.all && !isDue && !isNew) continue;
    const ownerId = ownerOf(id);
    if (f.statuses?.length && !f.statuses.includes(r.StatusLabel)) continue;
    if (f.courseIds?.length && !f.courseIds.includes(Number(r.Course_Id))) continue;
    if (f.modes?.length && !f.modes.includes(r.Inquiry_From)) continue;
    if (f.temps?.length && !f.temps.includes(r.Temperature)) continue;
    if (f.batches?.length && !f.batches.includes(r.Batch_Code)) continue;
    if (needle && !`${r.Student_Name} ${r.Present_Mobile} ${r.Email}`.toLowerCase().includes(needle)) continue;

    out.push({
      Inquiry_Id: id, Student_Name: r.Student_Name, Present_Mobile: r.Present_Mobile, Email: r.Email,
      CourseName: r.CourseName, Course_Id: r.Course_Id, Batch_Code: r.Batch_Code, Inquiry_From: r.Inquiry_From,
      StatusLabel: r.StatusLabel, Temperature: r.Temperature,
      NextFollowUpDate: d?.next ?? null, InquiryDate: r.InquiryDate,
      OwnerId: ownerId, OwnerName: ownerId != null ? userName.get(ownerId) ?? null : null,
      ...(initiated ? { InitiatedByName: firstBy.has(id) ? userName.get(firstBy.get(id)!) ?? null : null } : {}),
      Reason: isDue
        ? (d!.next < f.date ? 'Overdue' : d!.next === f.date ? 'Follow-up due' : 'Upcoming')
        : isNew ? 'New lead' : 'Lead',
    });
  }
  const rank = { 'Overdue': 0, 'Follow-up due': 1, 'Upcoming': 2, 'New lead': 3, 'Lead': 4 } as const;
  out.sort((a, b) => rank[a.Reason] - rank[b.Reason] || b.Inquiry_Id - a.Inquiry_Id);
  return out.slice(0, f.all ? 1500 : 500);
}

export interface TaskAppointment {
  id: number;
  appointment_code: string;
  name: string;
  mobile: string;
  program_name: string | null;
  start_time: string;
  end_time: string;
  mode: string;
  status: string;
  counsellor_user_id: number | null;
  counsellor_name: string | null;
}

export async function getMyTaskAppointments(date: string, owner: string, scope: TaskScope = 'allocated'): Promise<TaskAppointment[]> {
  // Appointments are booked with a counsellor; there is no "initiated" notion for them.
  if (scope === 'initiated') return [];
  const params: any[] = [date];
  let ownerClause = '';
  if (owner === 'unowned') ownerClause = 'AND a.counsellor_user_id IS NULL';
  else if (owner !== 'all') { ownerClause = 'AND a.counsellor_user_id = ?'; params.push(Number(owner)); }
  const [rows] = await getPool().query(
    `SELECT a.id, a.appointment_code, CONCAT(a.first_name, ' ', a.last_name) AS name, a.mobile, a.program_name,
            TIME_FORMAT(a.start_time, '%H:%i') AS start_time, TIME_FORMAT(a.end_time, '%H:%i') AS end_time,
            a.mode, a.status, a.counsellor_user_id, c.display_name AS counsellor_name
       FROM appointments a
       LEFT JOIN appt_counsellors c ON c.user_id = a.counsellor_user_id
      WHERE a.appt_date = ? ${ownerClause}
      ORDER BY a.start_time
      LIMIT 300`,
    params
  );
  return rows as TaskAppointment[];
}

export async function assignLeads(inquiryIds: number[], userId: number, by: number) {
  await ensureAssignmentsTable();
  const ids = [...new Set(inquiryIds.filter((n) => Number.isInteger(n) && n > 0))].slice(0, 500);
  if (!ids.length) return 0;
  await getPool().query(
    `INSERT INTO inquiry_assignments (Inquiry_Id, Assigned_User_Id, Assigned_By) VALUES ${ids.map(() => '(?, ?, ?)').join(',')}
     ON DUPLICATE KEY UPDATE Assigned_User_Id = VALUES(Assigned_User_Id), Assigned_By = VALUES(Assigned_By), Assigned_At = NOW()`,
    ids.flatMap((id) => [id, userId, by])
  );
  return ids.length;
}

export interface MonthDay { followUps: number; newLeads: number; appointments: number }

/** Per-day counts for a calendar month, scoped to an owner (explicit assignment). */
export async function getMyTasksMonth(month: string, owner: string, scope: TaskScope = 'allocated'): Promise<Record<string, MonthDay>> {
  await ensureAssignmentsTable();
  const pool = getPool();
  const start = `${month}-01`;
  const days: Record<string, MonthDay> = {};
  const day = (d: string) => (days[d] ??= { followUps: 0, newLeads: 0, appointments: 0 });
  const guarded = async (sql: string, params: any[]): Promise<any[]> => {
    try {
      const [rows] = await pool.query(`SET STATEMENT max_statement_time=15 FOR ${sql}`, params);
      return rows as any[];
    } catch (err: any) {
      if (!/max_statement_time|syntax/i.test(String(err?.message))) throw err;
      const [rows] = await pool.query(sql, params);
      return rows as any[];
    }
  };

  const [due, fresh, appts] = await Promise.all([
    guarded(
      `SELECT d.Inquiry_id AS iid, DATE_FORMAT(d.nextdate, '%Y-%m-%d') AS day FROM awt_inquirydiscussion d
        WHERE d.deleted = 0 AND d.nextdate >= ? AND d.nextdate < DATE_ADD(?, INTERVAL 1 MONTH)
          AND NOT EXISTS (SELECT 1 FROM awt_inquirydiscussion d2 WHERE d2.Inquiry_id = d.Inquiry_id AND d2.deleted = 0 AND d2.id > d.id)`,
      [start, start]
    ),
    guarded(
      `SELECT Inquiry_Id AS iid, DATE_FORMAT(_inquiry_date, '%Y-%m-%d') AS day FROM student_inquiry
        WHERE _inquiry_date >= ? AND _inquiry_date < DATE_ADD(?, INTERVAL 1 MONTH) AND (IsDelete = 0 OR IsDelete IS NULL)`,
      [start, start]
    ),
    guarded(
      `SELECT DATE_FORMAT(appt_date, '%Y-%m-%d') AS day, counsellor_user_id AS uid FROM appointments
        WHERE appt_date >= ? AND appt_date < DATE_ADD(?, INTERVAL 1 MONTH) AND status <> 'Cancelled'`,
      [start, start]
    ),
  ]);

  const ids = [...new Set([...due, ...fresh].map((r) => Number(r.iid)))].filter((n) => n > 0);
  const assignedTo = new Map<number, number>();
  const initiated = scope === 'initiated';
  const firstBy = initiated && ids.length ? await firstDiscussionAuthors(ids) : new Map<number, number>();
  if (!initiated && ids.length && owner !== 'all') {
    const rows = await guarded(`SELECT Inquiry_Id, Assigned_User_Id FROM inquiry_assignments WHERE Inquiry_Id IN (${ids.map(() => '?').join(',')})`, ids);
    rows.forEach((r) => assignedTo.set(Number(r.Inquiry_Id), Number(r.Assigned_User_Id)));
  }
  const keep = (id: number) => initiated
    ? (owner === 'all' ? firstBy.has(id) : owner === 'unowned' ? !firstBy.has(id) : firstBy.get(id) === Number(owner))
    : owner === 'all' || (owner === 'unowned' ? !assignedTo.has(id) : assignedTo.get(id) === Number(owner));
  due.forEach((r) => { if (keep(Number(r.iid))) day(r.day).followUps++; });
  fresh.forEach((r) => { if (keep(Number(r.iid))) day(r.day).newLeads++; });
  appts.forEach((r) => {
    if (initiated) return;
    const ok = owner === 'all' || (owner === 'unowned' ? r.uid == null : Number(r.uid) === Number(owner));
    if (ok) day(r.day).appointments++;
  });
  return days;
}

export async function unassignLeads(inquiryIds: number[]) {
  await ensureAssignmentsTable();
  const ids = [...new Set(inquiryIds.filter((n) => Number.isInteger(n) && n > 0))].slice(0, 500);
  if (!ids.length) return 0;
  await getPool().query(`DELETE FROM inquiry_assignments WHERE Inquiry_Id IN (${ids.map(() => '?').join(',')})`, ids);
  return ids.length;
}

export interface ActivityRow { day: string; batch: string; userId: number | null; contacted: number; followedUp: number; admitted: number }
export interface ActivityResult {
  rows: ActivityRow[];
  batches: { code: string; course: string | null; contacted: number; followedUp: number; admitted: number }[];
  staff: { id: number; name: string }[];
}

/**
 * Daily activity board (contacted / followed up / admitted) for a month, per batch and counsellor.
 *  - contacted:   distinct leads a user logged a contact action on that day (inquiry_contact_log)
 *  - followed up: distinct leads a user wrote a follow-up discussion on that day
 *  - admitted:    non-cancelled admissions that day, credited to the lead's assigned counsellor
 * Batch is the lead's batch code (for admissions, the admitted batch).
 */
export async function getDailyActivity(month: string, owner: string): Promise<ActivityResult> {
  return getActivityBetween(`${month}-01`, `${month}-01`, 'month', owner);
}

/** `end` is the last day when unit is 'day', or any day of the end month when unit is 'month'. */
async function getActivityBetween(start: string, end: string, unit: 'day' | 'month', owner: string): Promise<ActivityResult> {
  await ensureAssignmentsTable();
  const pool = getPool();
  const endExpr = unit === 'month' ? 'DATE_ADD(?, INTERVAL 1 MONTH)' : 'DATE_ADD(?, INTERVAL 1 DAY)';
  const guarded = async (sql: string, params: any[] = []): Promise<any[]> => {
    try {
      const [rows] = await pool.query(`SET STATEMENT max_statement_time=15 FOR ${sql}`, params);
      return rows as any[];
    } catch (err: any) {
      if (!/max_statement_time|syntax/i.test(String(err?.message))) throw err;
      const [rows] = await pool.query(sql, params);
      return rows as any[];
    }
  };

  const [contacts, follows, admissions, users] = await Promise.all([
    guarded(
      `SELECT Inquiry_Id AS iid, Created_By AS uid, DATE_FORMAT(Created_At, '%Y-%m-%d') AS day FROM inquiry_contact_log
        WHERE Created_At >= ? AND Created_At < ${endExpr}`, [start, end]
    ),
    guarded(
      `SELECT Inquiry_id AS iid, created_by AS uid, DATE_FORMAT(created_date, '%Y-%m-%d') AS day FROM awt_inquirydiscussion
        WHERE deleted = 0 AND created_date >= ? AND created_date < ${endExpr}`, [start, end]
    ),
    guarded(
      `SELECT am.Student_Id AS sid, DATE_FORMAT(am.Admission_Date, '%Y-%m-%d') AS day, b.Batch_code AS batch, c.Course_Name AS course
         FROM admission_master am
         JOIN batch_mst b ON b.Batch_Id = am.Batch_Id
         LEFT JOIN course_mst c ON c.Course_Id = b.Course_Id
        WHERE am.Admission_Date >= ? AND am.Admission_Date < ${endExpr}
          AND (am.IsDelete = 0 OR am.IsDelete IS NULL)
          AND LOWER(TRIM(CAST(COALESCE(am.Cancel, '') AS CHAR))) NOT IN ('yes', 'y', '1', 'true', 'cancelled', 'canceled')`, [start, end]
    ),
    pool.query(`SELECT id, COALESCE(NULLIF(TRIM(CONCAT(COALESCE(firstname, ''), ' ', COALESCE(lastname, ''))), ''), username) AS name FROM awt_adminuser WHERE (deleted = 0 OR deleted IS NULL) ORDER BY name`).then(([r]) => r as any[]),
  ]);

  // Batch + course for contacted / followed-up leads; assignee + inquiry for admitted students.
  const iids = [...new Set([...contacts, ...follows].map((r) => Number(r.iid)))].filter((n) => n > 0);
  const batchOf = new Map<number, { batch: string; course: string | null }>();
  for (let i = 0; i < iids.length; i += 2000) {
    const part = iids.slice(i, i + 2000);
    const rows = await guarded(
      `SELECT si.Inquiry_Id, si.Batch_Code, c.Course_Name FROM student_inquiry si LEFT JOIN course_mst c ON c.Course_Id = si.Course_Id
        WHERE si.Inquiry_Id IN (${part.map(() => '?').join(',')})`, part
    );
    rows.forEach((r) => batchOf.set(Number(r.Inquiry_Id), { batch: String(r.Batch_Code || '').trim(), course: r.Course_Name ?? null }));
  }
  const sids = [...new Set(admissions.map((r) => String(r.sid)))];
  const sidToInquiry = new Map<string, number>();
  if (sids.length) {
    const rows = await guarded(
      `SELECT Student_Id, MAX(Inquiry_Id) AS iid FROM student_inquiry WHERE Student_Id IN (${sids.map(() => '?').join(',')}) GROUP BY Student_Id`, sids
    );
    rows.forEach((r) => sidToInquiry.set(String(r.Student_Id), Number(r.iid)));
  }
  const assignIds = [...new Set(sidToInquiry.values())];
  const assignee = new Map<number, number>();
  if (assignIds.length) {
    const rows = await guarded(`SELECT Inquiry_Id, Assigned_User_Id FROM inquiry_assignments WHERE Inquiry_Id IN (${assignIds.map(() => '?').join(',')})`, assignIds);
    rows.forEach((r) => assignee.set(Number(r.Inquiry_Id), Number(r.Assigned_User_Id)));
  }

  const cells = new Map<string, ActivityRow>();
  const courseOf = new Map<string, string | null>();
  const cell = (day: string, batch: string, userId: number | null) => {
    const key = `${day}|${batch}|${userId ?? ''}`;
    let c = cells.get(key);
    if (!c) { c = { day, batch, userId, contacted: 0, followedUp: 0, admitted: 0 }; cells.set(key, c); }
    return c;
  };
  const seen = new Set<string>();
  const addLead = (r: any, field: 'contacted' | 'followedUp') => {
    const iid = Number(r.iid);
    const info = batchOf.get(iid);
    if (!info) return; // deleted / unknown lead
    const batch = info.batch || '—';
    const uid = r.uid == null ? null : Number(r.uid);
    const k = `${field}|${r.day}|${iid}|${uid}`;
    if (seen.has(k)) return; // one lead counts once per user per day
    seen.add(k);
    cell(r.day, batch, uid)[field]++;
    courseOf.set(batch, info.course);
  };
  contacts.forEach((r) => addLead(r, 'contacted'));
  follows.forEach((r) => addLead(r, 'followedUp'));
  admissions.forEach((r) => {
    const batch = String(r.batch || '—');
    const uid = assignee.get(sidToInquiry.get(String(r.sid)) ?? -1) ?? null;
    cell(r.day, batch, uid).admitted++;
    courseOf.set(batch, r.course ?? courseOf.get(batch) ?? null);
  });

  const inScope = (uid: number | null) => owner === 'all' ? true : owner === 'unowned' ? uid == null : uid === Number(owner);
  const rows = [...cells.values()].filter((r) => inScope(r.userId));
  const totals = new Map<string, { code: string; course: string | null; contacted: number; followedUp: number; admitted: number }>();
  rows.forEach((r) => {
    const t = totals.get(r.batch) ?? { code: r.batch, course: courseOf.get(r.batch) ?? null, contacted: 0, followedUp: 0, admitted: 0 };
    t.contacted += r.contacted; t.followedUp += r.followedUp; t.admitted += r.admitted;
    totals.set(r.batch, t);
  });
  return {
    rows,
    batches: [...totals.values()].sort((a, b) => b.admitted - a.admitted || b.contacted + b.followedUp - (a.contacted + a.followedUp)),
    staff: users.map((u) => ({ id: Number(u.id), name: String(u.name) })),
  };
}

export interface DaywiseRow { day: string; userId: number | null; counsellor: string; contacted: number; followedUp: number; admitted: number }
export interface DaywiseResult {
  rows: DaywiseRow[];
  /** inquiries received per day, across all counsellors */
  newInquiries: Record<string, number>;
  counsellors: { id: number | null; name: string }[];
}

/** Day-wise contacted / followed up / admitted per counsellor (batches merged), plus new inquiries per day. */
export async function getDaywiseSummary(from: string, to: string, owner = 'all'): Promise<DaywiseResult> {
  const pool = getPool();
  const [activity, [fresh]] = await Promise.all([
    getActivityBetween(from, to, 'day', owner),
    pool.query(
      `SELECT DATE_FORMAT(_inquiry_date, '%Y-%m-%d') AS day, COUNT(*) AS n FROM student_inquiry
        WHERE _inquiry_date >= ? AND _inquiry_date <= ? AND (IsDelete = 0 OR IsDelete IS NULL) GROUP BY _inquiry_date`,
      [from, to]
    ) as Promise<[any[], unknown]>,
  ]);
  const name = (id: number | null) => (id == null ? 'Unassigned' : activity.staff.find((u) => u.id === id)?.name ?? `User ${id}`);
  const merged = new Map<string, DaywiseRow>();
  activity.rows.forEach((r) => {
    const key = `${r.day}|${r.userId ?? ''}`;
    const m = merged.get(key) ?? { day: r.day, userId: r.userId, counsellor: name(r.userId), contacted: 0, followedUp: 0, admitted: 0 };
    m.contacted += r.contacted; m.followedUp += r.followedUp; m.admitted += r.admitted;
    merged.set(key, m);
  });
  const rows = [...merged.values()].sort((a, b) => b.day.localeCompare(a.day) || a.counsellor.localeCompare(b.counsellor));
  const seen = new Map<string, { id: number | null; name: string }>();
  rows.forEach((r) => seen.set(String(r.userId), { id: r.userId, name: r.counsellor }));
  return {
    rows,
    newInquiries: Object.fromEntries(fresh.map((r) => [r.day, Number(r.n)])),
    counsellors: [...seen.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}
