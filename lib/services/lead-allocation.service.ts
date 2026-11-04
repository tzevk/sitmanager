/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPool, cached } from '@/lib/db';
import { ensureAssignmentsTable } from '@/lib/services/my-tasks.service';
import { isSuperAdminRole } from '@/lib/super-admin';
import { ensureAppointmentTables } from '@/lib/appointments/schema';

/**
 * Automatic lead allocation.
 *
 * The sales manager links batches to each counsellor (Lead Allocation page). Every new
 * inquiry is then given exactly one owner, chosen by the first rule that has an eligible
 * counsellor:
 *
 *   1. returning  - the same person (Person_Id) already has an owner on another inquiry
 *   2. batch      - the inquiry's Batch_Code is a batch linked to one or more counsellors
 *   3. course     - the inquiry's course has a live (not cancelled/closed) batch linked to counsellors
 *   4. fallback   - every counsellor in the fallback pool
 *
 * Eligible = enrolled + active in appt_counsellors, "accepts leads" on, not on leave right now.
 * Among several eligible counsellors the one with the fewest leads assigned today wins; ties go
 * to whoever was assigned least recently, then the lowest user id. That makes it round-robin
 * inside each rule and keeps the result deterministic.
 *
 * Why it is safe:
 *   - One run at a time (named MySQL lock). A second run returns immediately.
 *   - INSERT IGNORE on inquiry_assignments (PK Inquiry_Id): an existing owner, manual or
 *     automatic, is never overwritten, and running twice cannot double-assign.
 *   - Only inquiries with Inquiry_Id > start_after_id are touched, so switching it on never
 *     hands out the historic backlog.
 *   - A lead nobody can take stays unassigned and the managers are alerted (once per lead).
 *   - The cron re-sweeps every minute, so a lead missed by an inline call is picked up.
 */

export type AllocationRule = 'returning' | 'batch' | 'course' | 'fallback';

export interface AllocationSettings {
  enabled: boolean;
  startAfterId: number;
  firstResponseMinutes: number;
  updatedAt: string | null;
}

const LOCK_NAME = 'lead_auto_assign';
const CLOSED_STATUS_REGEXP = 'admission (taken|confirmed)|not interested|irrelevant|junk|lost lead|clos|duplicate|not eligible';

let tablesReady: Promise<void> | null = null;
export function ensureAllocationTables(): Promise<void> {
  if (!tablesReady) {
    tablesReady = (async () => {
      const pool = getPool();
      await ensureAssignmentsTable();
      await ensureAppointmentTables();
      await pool.query(
        `CREATE TABLE IF NOT EXISTS counsellor_batch (
           user_id INT NOT NULL,
           batch_id INT NOT NULL,
           created_by INT NULL,
           created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
           PRIMARY KEY (user_id, batch_id),
           KEY idx_cb_batch (batch_id)
         ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
      );
      await pool.query(
        `CREATE TABLE IF NOT EXISTS lead_counsellor_settings (
           user_id INT NOT NULL PRIMARY KEY,
           accepts_leads TINYINT(1) NOT NULL DEFAULT 1,
           in_fallback_pool TINYINT(1) NOT NULL DEFAULT 1,
           updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
         ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
      );
      await pool.query(
        `CREATE TABLE IF NOT EXISTS lead_allocation_settings (
           id TINYINT NOT NULL PRIMARY KEY,
           enabled TINYINT(1) NOT NULL DEFAULT 0,
           start_after_id INT NOT NULL DEFAULT 0,
           first_response_minutes INT NOT NULL DEFAULT 30,
           updated_by INT NULL,
           updated_at DATETIME NULL
         ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
      );
      await pool.query(`INSERT IGNORE INTO lead_allocation_settings (id) VALUES (1)`);
      await pool.query(
        `CREATE TABLE IF NOT EXISTS inquiry_assignment_log (
           id BIGINT AUTO_INCREMENT PRIMARY KEY,
           Inquiry_Id INT NOT NULL,
           Assigned_User_Id INT NULL,
           rule VARCHAR(20) NOT NULL,
           detail VARCHAR(255) NULL,
           created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
           KEY idx_ial_inquiry (Inquiry_Id),
           KEY idx_ial_created (created_at)
         ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
      );
    })().catch((err) => { tablesReady = null; throw err; });
  }
  return tablesReady;
}

export async function getAllocationSettings(): Promise<AllocationSettings> {
  await ensureAllocationTables();
  const [rows] = await getPool().query(
    `SELECT enabled, start_after_id, first_response_minutes, DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i') AS updated_at
       FROM lead_allocation_settings WHERE id = 1`
  );
  const r = (rows as any[])[0] || {};
  return {
    enabled: Number(r.enabled) === 1,
    startAfterId: Number(r.start_after_id) || 0,
    firstResponseMinutes: Number(r.first_response_minutes) || 30,
    updatedAt: r.updated_at ?? null,
  };
}

/** Turning allocation on stamps the current max Inquiry_Id, so only leads arriving after this
 * moment are auto-assigned (the backlog stays with the manager). */
export async function updateAllocationSettings(
  input: { enabled?: boolean; firstResponseMinutes?: number },
  by: number,
): Promise<AllocationSettings> {
  await ensureAllocationTables();
  const pool = getPool();
  const current = await getAllocationSettings();
  const sets: string[] = ['updated_by = ?', 'updated_at = NOW()'];
  const vals: any[] = [by];
  if (typeof input.enabled === 'boolean' && input.enabled !== current.enabled) {
    sets.push('enabled = ?');
    vals.push(input.enabled ? 1 : 0);
    if (input.enabled) {
      const [mx] = await pool.query(`SELECT COALESCE(MAX(Inquiry_Id), 0) AS m FROM student_inquiry`);
      sets.push('start_after_id = ?');
      vals.push(Number((mx as any[])[0]?.m) || 0);
    }
  }
  if (input.firstResponseMinutes != null) {
    const m = Math.round(Number(input.firstResponseMinutes));
    if (!Number.isFinite(m) || m < 5 || m > 24 * 60) {
      throw Object.assign(new Error('First-response time must be between 5 minutes and 24 hours'), { status: 400 });
    }
    sets.push('first_response_minutes = ?');
    vals.push(m);
  }
  await pool.query(`UPDATE lead_allocation_settings SET ${sets.join(', ')} WHERE id = 1`, vals);
  return getAllocationSettings();
}

// ── Counsellor ⇄ batch links ──────────────────────────────────────────────────

export interface AllocationCounsellor {
  userId: number;
  name: string;
  active: boolean;
  acceptsLeads: boolean;
  inFallbackPool: boolean;
  onLeaveNow: boolean;
  leadsToday: number;
  openLeads: number;
  batches: { batchId: number; batchCode: string; courseName: string | null; startDate: string | null }[];
}

export async function listAllocationCounsellors(): Promise<AllocationCounsellor[]> {
  await ensureAllocationTables();
  const pool = getPool();
  const [counsellors] = await pool.query(
    `SELECT c.user_id, COALESCE(NULLIF(TRIM(c.display_name), ''), u.username) AS name, c.is_active,
            COALESCE(s.accepts_leads, 1) AS accepts_leads, COALESCE(s.in_fallback_pool, 1) AS in_fallback_pool,
            EXISTS (SELECT 1 FROM appt_counsellor_blocks k WHERE k.counsellor_user_id = c.user_id
                     AND k.block_type = 'leave' AND k.start_at <= NOW() AND k.end_at > NOW()) AS on_leave
       FROM appt_counsellors c
       JOIN awt_adminuser u ON u.id = c.user_id AND (u.deleted = 0 OR u.deleted IS NULL)
       LEFT JOIN lead_counsellor_settings s ON s.user_id = c.user_id
      ORDER BY name`
  );
  const [links] = await pool.query(
    `SELECT cb.user_id, b.Batch_Id, b.Batch_code, cm.Course_Name, DATE_FORMAT(b.SDate, '%Y-%m-%d') AS SDate
       FROM counsellor_batch cb
       JOIN batch_mst b ON b.Batch_Id = cb.batch_id
       LEFT JOIN course_mst cm ON cm.Course_Id = b.Course_Id
      ORDER BY b.SDate DESC`
  );
  const [loads] = await pool.query(
    `SELECT Assigned_User_Id AS uid,
            SUM(Assigned_At >= CURDATE()) AS today,
            COUNT(*) AS total
       FROM inquiry_assignments
      WHERE Assigned_At >= CURDATE() - INTERVAL 60 DAY
      GROUP BY Assigned_User_Id`
  );
  const loadBy = new Map((loads as any[]).map((r) => [Number(r.uid), r]));
  const batchesBy = new Map<number, AllocationCounsellor['batches']>();
  for (const l of links as any[]) {
    const list = batchesBy.get(Number(l.user_id)) ?? [];
    list.push({ batchId: Number(l.Batch_Id), batchCode: String(l.Batch_code ?? ''), courseName: l.Course_Name ?? null, startDate: l.SDate ?? null });
    batchesBy.set(Number(l.user_id), list);
  }
  return (counsellors as any[]).map((c) => ({
    userId: Number(c.user_id),
    name: String(c.name),
    active: Number(c.is_active) === 1,
    acceptsLeads: Number(c.accepts_leads) === 1,
    inFallbackPool: Number(c.in_fallback_pool) === 1,
    onLeaveNow: Number(c.on_leave) === 1,
    leadsToday: Number(loadBy.get(Number(c.user_id))?.today || 0),
    openLeads: Number(loadBy.get(Number(c.user_id))?.total || 0),
    batches: batchesBy.get(Number(c.user_id)) ?? [],
  }));
}

/** Replaces the batch list of one counsellor and their two switches. */
export async function saveCounsellorAllocation(
  userId: number,
  input: { batchIds: number[]; acceptsLeads: boolean; inFallbackPool: boolean },
  by: number,
): Promise<void> {
  await ensureAllocationTables();
  if (!Number.isInteger(userId) || userId <= 0) throw Object.assign(new Error('Invalid counsellor'), { status: 400 });
  const pool = getPool();
  const [exists] = await pool.query(`SELECT 1 FROM appt_counsellors WHERE user_id = ? LIMIT 1`, [userId]);
  if (!(exists as any[]).length) throw Object.assign(new Error('That user is not a counsellor'), { status: 400 });
  const ids = [...new Set((input.batchIds || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 500);
  if (ids.length) {
    const [found] = await pool.query(`SELECT Batch_Id FROM batch_mst WHERE Batch_Id IN (?)`, [ids]);
    if ((found as any[]).length !== ids.length) throw Object.assign(new Error('One or more batches no longer exist'), { status: 400 });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`DELETE FROM counsellor_batch WHERE user_id = ?`, [userId]);
    if (ids.length) {
      await conn.query(
        `INSERT INTO counsellor_batch (user_id, batch_id, created_by) VALUES ${ids.map(() => '(?, ?, ?)').join(',')}`,
        ids.flatMap((id) => [userId, id, by])
      );
    }
    await conn.query(
      `INSERT INTO lead_counsellor_settings (user_id, accepts_leads, in_fallback_pool) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE accepts_leads = VALUES(accepts_leads), in_fallback_pool = VALUES(in_fallback_pool)`,
      [userId, input.acceptsLeads ? 1 : 0, input.inFallbackPool ? 1 : 0]
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ── The allocator ─────────────────────────────────────────────────────────────

interface Candidate { userId: number; today: number; last: number }

/** Pure choice among eligible counsellors: fewest today, then least recently assigned, then id. */
export function pickCounsellor(pool: Candidate[]): Candidate | null {
  if (!pool.length) return null;
  return [...pool].sort((a, b) => a.today - b.today || a.last - b.last || a.userId - b.userId)[0];
}

export interface AutoAssignResult {
  ran: boolean;
  assigned: number;
  unassignable: number;
  byRule: Record<AllocationRule, number>;
}

/** Managers = Super Admin roles + the sales manager account. They get the "nobody could take this
 * lead" and "lead not contacted" alerts. */
export async function getLeadManagerIds(): Promise<number[]> {
  return cached('lead-allocation:managers', 10 * 60 * 1000, async () => {
    const pool = getPool();
    const [users] = await pool.query(
      `SELECT id, role, username, firstname, lastname FROM awt_adminuser WHERE (deleted = 0 OR deleted IS NULL)`
    );
    const out: number[] = [];
    for (const u of users as any[]) {
      const words = `${u.firstname ?? ''} ${u.lastname ?? ''}`.toLowerCase().split(/[^a-z]+/).filter(Boolean);
      const isMayur = String(u.username || '').trim().toLowerCase() === 'mayur' || (words.includes('mayur') && words.includes('jagtap'));
      if (isMayur || (await isSuperAdminRole(Number(u.role), pool))) out.push(Number(u.id));
    }
    return out;
  });
}

export async function notify(
  userIds: number[],
  n: { kind: string; title: string; body: Record<string, unknown>; link: string; inquiryId: number; dedupe: string },
): Promise<void> {
  const ids = [...new Set(userIds)].filter((x) => Number.isInteger(x) && x > 0);
  if (!ids.length) return;
  await getPool().query(
    `INSERT IGNORE INTO staff_notifications (user_id, channel, kind, title, body, link, source_type, source_id, dedupe_key)
     VALUES ${ids.map(() => `(?, 'in_app', ?, ?, ?, ?, 'inquiry', ?, ?)`).join(',')}`,
    ids.flatMap((uid) => [uid, n.kind, n.title, JSON.stringify(n.body), n.link, n.inquiryId, `${n.dedupe}:u${uid}`])
  );
}

/**
 * Assigns every unassigned inquiry newer than the switch-on point. Safe to call from anywhere
 * (create inquiry, Meta convert, cron): concurrent calls just skip.
 */
export async function autoAssignPending(opts: { limit?: number } = {}): Promise<AutoAssignResult> {
  const empty: AutoAssignResult = { ran: false, assigned: 0, unassignable: 0, byRule: { returning: 0, batch: 0, course: 0, fallback: 0 } };
  await ensureAllocationTables();
  const settings = await getAllocationSettings();
  if (!settings.enabled) return empty;

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [lockRows] = await conn.query(`SELECT GET_LOCK(?, 0) AS got`, [LOCK_NAME]);
    if (Number((lockRows as any[])[0]?.got) !== 1) return empty;
    try {
      return await runAllocation(conn, settings, Math.max(1, Math.min(500, opts.limit ?? 200)));
    } finally {
      await conn.query(`SELECT RELEASE_LOCK(?)`, [LOCK_NAME]).catch(() => undefined);
    }
  } finally {
    conn.release();
  }
}

async function runAllocation(conn: any, settings: AllocationSettings, limit: number): Promise<AutoAssignResult> {
  const result: AutoAssignResult = { ran: true, assigned: 0, unassignable: 0, byRule: { returning: 0, batch: 0, course: 0, fallback: 0 } };

  // 1. Pending leads — PK range scan only.
  const [pendingRows] = await conn.query(
    `SELECT si.Inquiry_Id, si.Student_Name, si.Person_Id, si.Course_Id, TRIM(COALESCE(si.Batch_Code, '')) AS Batch_Code,
            si.Inquiry_From, c.Course_Name
       FROM student_inquiry si
       LEFT JOIN inquiry_assignments ia ON ia.Inquiry_Id = si.Inquiry_Id
       LEFT JOIN status_master s ON s.Id = CAST(NULLIF(si.OnlineState, '') AS UNSIGNED)
       LEFT JOIN course_mst c ON c.Course_Id = si.Course_Id
      WHERE si.Inquiry_Id > ?
        AND ia.Inquiry_Id IS NULL
        AND (si.IsDelete = 0 OR si.IsDelete IS NULL)
        AND LOWER(COALESCE(s.Status, '')) NOT REGEXP ?
      ORDER BY si.Inquiry_Id
      LIMIT ?`,
    [settings.startAfterId, CLOSED_STATUS_REGEXP, limit]
  );
  const pending = pendingRows as any[];
  if (!pending.length) return result;

  // 2. Eligible counsellors with their load.
  const [eligibleRows] = await conn.query(
    `SELECT c.user_id, COALESCE(s.in_fallback_pool, 1) AS in_fallback_pool,
            (SELECT COUNT(*) FROM inquiry_assignments a WHERE a.Assigned_User_Id = c.user_id AND a.Assigned_At >= CURDATE()) AS today,
            (SELECT UNIX_TIMESTAMP(MAX(a.Assigned_At)) FROM inquiry_assignments a WHERE a.Assigned_User_Id = c.user_id) AS last_at
       FROM appt_counsellors c
       JOIN awt_adminuser u ON u.id = c.user_id AND (u.deleted = 0 OR u.deleted IS NULL)
       LEFT JOIN lead_counsellor_settings s ON s.user_id = c.user_id
      WHERE c.is_active = 1
        AND COALESCE(s.accepts_leads, 1) = 1
        AND NOT EXISTS (SELECT 1 FROM appt_counsellor_blocks k WHERE k.counsellor_user_id = c.user_id
                         AND k.block_type = 'leave' AND k.start_at <= NOW() AND k.end_at > NOW())`
  );
  const state = new Map<number, Candidate & { fallback: boolean }>();
  for (const r of eligibleRows as any[]) {
    state.set(Number(r.user_id), {
      userId: Number(r.user_id), today: Number(r.today) || 0, last: Number(r.last_at) || 0,
      fallback: Number(r.in_fallback_pool) === 1,
    });
  }

  // 3. Batch links: code → users, course → users (live batches only for the course rule).
  const [linkRows] = await conn.query(
    `SELECT cb.user_id, TRIM(b.Batch_code) AS Batch_code, b.Course_Id,
            ((b.Cancel IS NULL OR b.Cancel = 0) AND (b.IsDelete IS NULL OR b.IsDelete = 0)
              AND (b.SDate IS NULL OR b.SDate >= CURDATE() - INTERVAL 30 DAY)) AS live
       FROM counsellor_batch cb JOIN batch_mst b ON b.Batch_Id = cb.batch_id`
  );
  const byBatch = new Map<string, Set<number>>();
  const byCourse = new Map<number, Set<number>>();
  for (const l of linkRows as any[]) {
    const uid = Number(l.user_id);
    const code = String(l.Batch_code || '').toUpperCase();
    if (code) (byBatch.get(code) ?? byBatch.set(code, new Set()).get(code)!).add(uid);
    if (Number(l.live) === 1 && l.Course_Id != null) {
      const cid = Number(l.Course_Id);
      (byCourse.get(cid) ?? byCourse.set(cid, new Set()).get(cid)!).add(uid);
    }
  }

  // 4. Returning people: current owner of any other inquiry by the same person.
  const personIds = [...new Set(pending.map((p) => Number(p.Person_Id)).filter((n) => Number.isInteger(n) && n > 0))];
  const ownerByPerson = new Map<number, number>();
  if (personIds.length) {
    const [ownRows] = await conn.query(
      `SELECT si.Person_Id, ia.Assigned_User_Id
         FROM student_inquiry si JOIN inquiry_assignments ia ON ia.Inquiry_Id = si.Inquiry_Id
        WHERE si.Person_Id IN (?)
        ORDER BY ia.Assigned_At DESC`,
      [personIds]
    );
    for (const r of ownRows as any[]) {
      const pid = Number(r.Person_Id);
      if (!ownerByPerson.has(pid)) ownerByPerson.set(pid, Number(r.Assigned_User_Id));
    }
  }

  const eligible = (ids: Iterable<number> | undefined) => [...(ids ?? [])].map((id) => state.get(id)).filter(Boolean) as Candidate[];
  const managers = await getLeadManagerIds();

  for (const lead of pending) {
    const iid = Number(lead.Inquiry_Id);
    let rule: AllocationRule | null = null;
    let chosen: Candidate | null = null;
    let detail = '';

    const prevOwner = ownerByPerson.get(Number(lead.Person_Id));
    if (prevOwner && state.has(prevOwner)) { rule = 'returning'; chosen = state.get(prevOwner)!; detail = 'same person as an earlier lead'; }
    if (!chosen && lead.Batch_Code) {
      chosen = pickCounsellor(eligible(byBatch.get(String(lead.Batch_Code).toUpperCase())));
      if (chosen) { rule = 'batch'; detail = `batch ${lead.Batch_Code}`; }
    }
    if (!chosen && lead.Course_Id != null) {
      chosen = pickCounsellor(eligible(byCourse.get(Number(lead.Course_Id))));
      if (chosen) { rule = 'course'; detail = `course ${lead.Course_Name ?? lead.Course_Id}`; }
    }
    if (!chosen) {
      chosen = pickCounsellor([...state.values()].filter((c) => c.fallback));
      if (chosen) { rule = 'fallback'; detail = 'no matching batch'; }
    }

    if (!chosen || !rule) {
      result.unassignable += 1;
      await notify(managers, {
        kind: 'lead_unassigned',
        title: 'New lead could not be auto-assigned',
        body: { name: lead.Student_Name, course: lead.Course_Name, source: lead.Inquiry_From, reason: 'No eligible counsellor (all on leave or none linked)' },
        link: `/dashboard/inquiry/add?editId=${iid}`,
        inquiryId: iid,
        dedupe: `lead_unassigned:${iid}`,
      });
      continue;
    }

    const [ins] = await conn.query(
      `INSERT IGNORE INTO inquiry_assignments (Inquiry_Id, Assigned_User_Id, Assigned_By) VALUES (?, ?, NULL)`,
      [iid, chosen.userId]
    );
    if (Number((ins as any).affectedRows) !== 1) continue; // someone assigned it meanwhile — leave theirs
    await conn.query(
      `INSERT INTO inquiry_assignment_log (Inquiry_Id, Assigned_User_Id, rule, detail) VALUES (?, ?, ?, ?)`,
      [iid, chosen.userId, rule, detail.slice(0, 255)]
    );
    const st = state.get(chosen.userId)!;
    st.today += 1;
    st.last = Math.floor(Date.now() / 1000);
    if (lead.Person_Id) ownerByPerson.set(Number(lead.Person_Id), chosen.userId);
    result.assigned += 1;
    result.byRule[rule] += 1;

    await notify([chosen.userId], {
      kind: 'lead_assigned',
      title: 'New lead assigned to you',
      body: { name: lead.Student_Name, course: lead.Course_Name, source: lead.Inquiry_From, rule, detail, minutes: settings.firstResponseMinutes },
      link: `/dashboard/inquiry/add?editId=${iid}`,
      inquiryId: iid,
      dedupe: `lead_assigned:${iid}:${chosen.userId}`,
    });
  }
  return result;
}

/**
 * Called right after a staff member creates an inquiry by hand. If that person is a counsellor
 * the lead is theirs (they are already talking to the student); otherwise the normal rules run.
 * Never throws — allocation must not break saving an inquiry; the cron catches anything missed.
 */
export async function allocateNewInquiry(inquiryId: number, createdBy: number): Promise<void> {
  try {
    await ensureAllocationTables();
    const settings = await getAllocationSettings();
    if (!settings.enabled || inquiryId <= settings.startAfterId) return;
    const pool = getPool();
    const [isCounsellor] = await pool.query(
      `SELECT 1 FROM appt_counsellors WHERE user_id = ? AND is_active = 1 LIMIT 1`,
      [createdBy]
    );
    if ((isCounsellor as any[]).length) {
      const [ins] = await pool.query(
        `INSERT IGNORE INTO inquiry_assignments (Inquiry_Id, Assigned_User_Id, Assigned_By) VALUES (?, ?, ?)`,
        [inquiryId, createdBy, createdBy]
      );
      if (Number((ins as any).affectedRows) === 1) {
        await pool.query(
          `INSERT INTO inquiry_assignment_log (Inquiry_Id, Assigned_User_Id, rule, detail) VALUES (?, ?, 'creator', 'entered by this counsellor')`,
          [inquiryId, createdBy]
        );
      }
      return;
    }
    await autoAssignPending({ limit: 20 });
  } catch (err) {
    console.error('allocateNewInquiry failed (cron will retry):', err);
  }
}

/** Owner notification for a manual assignment from My Tasks. */
export async function notifyManualAssignment(inquiryIds: number[], userId: number): Promise<void> {
  if (!inquiryIds.length) return;
  await ensureAllocationTables();
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT si.Inquiry_Id, si.Student_Name, si.Inquiry_From, c.Course_Name
       FROM student_inquiry si LEFT JOIN course_mst c ON c.Course_Id = si.Course_Id
      WHERE si.Inquiry_Id IN (?)`,
    [inquiryIds.slice(0, 500)]
  );
  for (const r of rows as any[]) {
    await pool.query(
      `INSERT INTO inquiry_assignment_log (Inquiry_Id, Assigned_User_Id, rule, detail) VALUES (?, ?, 'manual', NULL)`,
      [r.Inquiry_Id, userId]
    );
    await notify([userId], {
      kind: 'lead_assigned',
      title: 'Lead assigned to you',
      body: { name: r.Student_Name, course: r.Course_Name, source: r.Inquiry_From, rule: 'manual' },
      link: `/dashboard/inquiry/add?editId=${r.Inquiry_Id}`,
      inquiryId: Number(r.Inquiry_Id),
      dedupe: `lead_assigned:${r.Inquiry_Id}:${userId}:${Date.now()}`,
    });
  }
}

/**
 * First-response watchdog: an assigned lead with no staff discussion after
 * `firstResponseMinutes` gets one reminder to its owner and one alert to the managers.
 * Only looks at leads assigned in the last 2 days.
 */
export async function escalateUncontactedLeads(): Promise<{ escalated: number }> {
  await ensureAllocationTables();
  const settings = await getAllocationSettings();
  const rows = await timedQuery(
    `SELECT ia.Inquiry_Id, ia.Assigned_User_Id, si.Student_Name, c.Course_Name,
            TIMESTAMPDIFF(MINUTE, ia.Assigned_At, NOW()) AS mins
       FROM inquiry_assignments ia
       JOIN student_inquiry si ON si.Inquiry_Id = ia.Inquiry_Id AND (si.IsDelete = 0 OR si.IsDelete IS NULL)
       LEFT JOIN course_mst c ON c.Course_Id = si.Course_Id
       LEFT JOIN status_master s ON s.Id = CAST(NULLIF(si.OnlineState, '') AS UNSIGNED)
      WHERE ia.Assigned_At >= NOW() - INTERVAL 2 DAY
        AND ia.Assigned_At <= NOW() - INTERVAL ? MINUTE
        AND LOWER(COALESCE(s.Status, '')) NOT REGEXP ?
        AND NOT EXISTS (SELECT 1 FROM awt_inquirydiscussion d
                         WHERE d.Inquiry_id = ia.Inquiry_Id AND d.deleted = 0
                           AND d.created_by IS NOT NULL AND d.created_by > 0
                           AND d.created_date >= COALESCE(si.Date_Added, ia.Assigned_At))
      LIMIT 300`,
    [settings.firstResponseMinutes, CLOSED_STATUS_REGEXP]
  );
  const managers = await getLeadManagerIds();
  let escalated = 0;
  for (const r of rows as any[]) {
    const iid = Number(r.Inquiry_Id);
    const owner = Number(r.Assigned_User_Id);
    const body = { name: r.Student_Name, course: r.Course_Name, minutes: Number(r.mins), ownerId: owner };
    await notify([owner], {
      kind: 'lead_uncontacted', title: 'Lead waiting for your first call', body,
      link: `/dashboard/inquiry/add?editId=${iid}`, inquiryId: iid, dedupe: `lead_uncontacted:${iid}:${owner}`,
    });
    await notify(managers.filter((m) => m !== owner), {
      kind: 'lead_uncontacted', title: 'Lead not contacted in time', body,
      link: `/dashboard/inquiry/add?editId=${iid}`, inquiryId: iid, dedupe: `lead_uncontacted:${iid}:${owner}`,
    });
    escalated += 1;
  }
  return { escalated };
}

// ── Alerts for the signed-in user ─────────────────────────────────────────────

export interface LeadAlert {
  id: number;
  kind: string;
  title: string;
  link: string | null;
  inquiryId: number | null;
  createdAt: string;
  name?: string;
  course?: string | null;
  source?: string | null;
  minutes?: number;
  reason?: string;
}

export async function getUnreadLeadAlerts(userId: number): Promise<LeadAlert[]> {
  await ensureAllocationTables();
  const [rows] = await getPool().query(
    `SELECT id, kind, title, body, link, source_id, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS created_at
       FROM staff_notifications
      WHERE user_id = ? AND channel = 'in_app' AND kind IN ('lead_assigned', 'lead_unassigned', 'lead_uncontacted')
        AND read_at IS NULL AND created_at >= NOW() - INTERVAL 3 DAY
      ORDER BY id DESC
      LIMIT 30`,
    [userId]
  );
  return (rows as any[]).map((r) => {
    let body: any = {};
    try { body = JSON.parse(r.body || '{}'); } catch { /* ignore */ }
    return {
      id: Number(r.id), kind: r.kind, title: r.title, link: r.link, inquiryId: r.source_id == null ? null : Number(r.source_id),
      createdAt: r.created_at, name: body.name, course: body.course ?? null, source: body.source ?? null,
      minutes: body.minutes, reason: body.reason,
    };
  });
}

export async function markLeadAlertsRead(userId: number, ids: number[] | 'all'): Promise<void> {
  const pool = getPool();
  if (ids === 'all') {
    await pool.query(
      `UPDATE staff_notifications SET read_at = NOW()
        WHERE user_id = ? AND read_at IS NULL AND kind IN ('lead_assigned', 'lead_unassigned', 'lead_uncontacted')`,
      [userId]
    );
    return;
  }
  const clean = ids.map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 200);
  if (!clean.length) return;
  await pool.query(`UPDATE staff_notifications SET read_at = NOW() WHERE user_id = ? AND id IN (?)`, [userId, clean]);
}

/**
 * Runs a read with a MariaDB statement time limit so it can never turn into a runaway query.
 * Falls back to the plain query on servers without SET STATEMENT (MySQL in local testing).
 */
export async function timedQuery(sql: string, params: unknown[], seconds = 20): Promise<any[]> {
  const pool = getPool();
  try {
    const [rows] = await pool.query(`SET STATEMENT max_statement_time=${Math.max(1, Math.min(60, Math.trunc(seconds)))} FOR ${sql}`, params);
    return rows as any[];
  } catch (err: any) {
    if (!/max_statement_time|syntax/i.test(String(err?.message))) throw err;
    const [rows] = await pool.query(sql, params);
    return rows as any[];
  }
}
