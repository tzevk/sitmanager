/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPool } from '@/lib/db';
import { ensureAllocationTables } from '@/lib/services/lead-allocation.service';

/**
 * "Admission closure by employee" — closed leads (status Admission Taken / Admission confirmed)
 * credited to an employee:
 *   1. the lead's Assigned Counsellor (inquiry_assignments), else
 *   2. for older leads with no counsellor, the account that logged the most discussions on it
 *      (ties → the most recent discussion).
 * Closure date = Admission_Dt, falling back to the inquiry date.
 */
export type ClosureRow = {
  userId: number | null;
  name: string;
  leadsHandled: number;
  closures: number;
  conversionPct: number;
};

const CLOSED = `('8','52')`;

/**
 * For a date range (inclusive, YYYY-MM-DD):
 *   closures      = closed leads whose closure date falls in the range, credited as above
 *   leads handled = distinct leads the employee logged a discussion on, or was assigned, in the range
 *   conversion    = closures / leads handled
 */
export async function getAdmissionClosureByEmployee(from: string, to: string): Promise<ClosureRow[]> {
  await ensureAllocationTables();
  const pool = getPool();
  const [closedRows] = await pool.query(
    `SET STATEMENT max_statement_time=30 FOR
     SELECT x.owner_id, COUNT(*) AS closures
       FROM (
         SELECT COALESCE(ia.Assigned_User_Id, top.created_by) AS owner_id,
                COALESCE(c.Admission_Dt, STR_TO_DATE(NULLIF(c.Inquiry_Dt,''),'%Y-%m-%d')) AS cd
           FROM (SELECT Inquiry_Id, Admission_Dt, Inquiry_Dt FROM student_inquiry
                  WHERE OnlineState IN ${CLOSED} AND IFNULL(IsDelete,0) = 0) c
           LEFT JOIN inquiry_assignments ia ON ia.Inquiry_Id = c.Inquiry_Id
           LEFT JOIN (
             SELECT inq, created_by FROM (
               SELECT d.Inquiry_Id_Int AS inq, d.created_by,
                      ROW_NUMBER() OVER (PARTITION BY d.Inquiry_Id_Int ORDER BY COUNT(*) DESC, MAX(d.id) DESC) AS rn
                 FROM awt_inquirydiscussion d
                 JOIN student_inquiry s ON s.Inquiry_Id = d.Inquiry_Id_Int
                  AND s.OnlineState IN ${CLOSED} AND IFNULL(s.IsDelete,0) = 0
                WHERE IFNULL(d.deleted,0) = 0 AND d.created_by > 0
                GROUP BY d.Inquiry_Id_Int, d.created_by
             ) r WHERE rn = 1
           ) top ON top.inq = c.Inquiry_Id
       ) x
      WHERE DATE(x.cd) BETWEEN ? AND ?
      GROUP BY x.owner_id`,
    [from, to]
  );
  const [handledRows] = await pool.query(
    `SET STATEMENT max_statement_time=30 FOR
     SELECT h.user_id, COUNT(DISTINCT h.inq) AS handled FROM (
       SELECT d.created_by AS user_id, d.Inquiry_Id_Int AS inq
         FROM awt_inquirydiscussion d
         JOIN student_inquiry s ON s.Inquiry_Id = d.Inquiry_Id_Int AND IFNULL(s.IsDelete,0) = 0
        WHERE IFNULL(d.deleted,0) = 0 AND d.created_by > 0
          AND d.created_date >= ? AND d.created_date < ? + INTERVAL 1 DAY
       UNION ALL
       SELECT ia.Assigned_User_Id, ia.Inquiry_Id
         FROM inquiry_assignments ia
         JOIN student_inquiry s ON s.Inquiry_Id = ia.Inquiry_Id AND IFNULL(s.IsDelete,0) = 0
        WHERE ia.Assigned_At >= ? AND ia.Assigned_At < ? + INTERVAL 1 DAY
     ) h GROUP BY h.user_id`,
    [from, to, from, to]
  );
  const byUser = new Map<string, { userId: number | null; leadsHandled: number; closures: number }>();
  const get = (id: unknown) => {
    const userId = id == null ? null : Number(id);
    const k = String(userId);
    if (!byUser.has(k)) byUser.set(k, { userId, leadsHandled: 0, closures: 0 });
    return byUser.get(k)!;
  };
  for (const r of closedRows as any[]) get(r.owner_id).closures = Number(r.closures) || 0;
  for (const r of handledRows as any[]) get(r.user_id).leadsHandled = Number(r.handled) || 0;

  const ids = [...byUser.values()].map((r) => r.userId).filter((x): x is number => x != null);
  const names = new Map<number, string>();
  if (ids.length) {
    const [u] = await pool.query(
      `SELECT id, COALESCE(NULLIF(TRIM(CONCAT(IFNULL(firstname,''),' ',IFNULL(lastname,''))),''), username) AS name
         FROM awt_adminuser WHERE id IN (?)`,
      [ids]
    );
    for (const r of u as any[]) names.set(Number(r.id), String(r.name));
  }
  return [...byUser.values()]
    .map((r) => ({
      ...r,
      name: r.userId == null ? 'Not assigned' : names.get(r.userId) ?? `User #${r.userId}`,
      conversionPct: r.leadsHandled ? Math.round((r.closures / r.leadsHandled) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.closures - a.closures || b.leadsHandled - a.leadsHandled);
}

/** Set (or clear, with null) the Assigned Counsellor of a lead from the inquiry form. */
export async function setAssignedCounsellor(inquiryId: number, userId: number | null, by: number): Promise<boolean> {
  await ensureAllocationTables();
  const pool = getPool();
  const [[cur]] = (await pool.query(`SELECT Assigned_User_Id FROM inquiry_assignments WHERE Inquiry_Id = ?`, [inquiryId])) as any;
  const current = cur ? Number(cur.Assigned_User_Id) : null;
  if (current === userId) return false;
  if (userId == null) {
    await pool.query(`DELETE FROM inquiry_assignments WHERE Inquiry_Id = ?`, [inquiryId]);
    return true;
  }
  await pool.query(
    `INSERT INTO inquiry_assignments (Inquiry_Id, Assigned_User_Id, Assigned_By) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE Assigned_User_Id = VALUES(Assigned_User_Id), Assigned_By = VALUES(Assigned_By), Assigned_At = CURRENT_TIMESTAMP`,
    [inquiryId, userId, by]
  );
  return true;
}
