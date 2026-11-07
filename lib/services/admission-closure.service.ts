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
  total: number;
  thisMonth: number;
  lastMonth: number;
  thisYear: number;
};

const CLOSED = `('8','52')`;

export async function getAdmissionClosureByEmployee(): Promise<ClosureRow[]> {
  await ensureAllocationTables();
  const [rows] = await getPool().query(
    `SET STATEMENT max_statement_time=30 FOR
     SELECT x.owner_id,
            COALESCE(NULLIF(TRIM(CONCAT(IFNULL(u.firstname,''),' ',IFNULL(u.lastname,''))),''), u.username, 'Not assigned') AS name,
            COUNT(*) AS total,
            SUM(x.cd >= DATE_FORMAT(CURDATE(),'%Y-%m-01')) AS this_month,
            SUM(x.cd >= DATE_FORMAT(CURDATE() - INTERVAL 1 MONTH,'%Y-%m-01') AND x.cd < DATE_FORMAT(CURDATE(),'%Y-%m-01')) AS last_month,
            SUM(YEAR(x.cd) = YEAR(CURDATE())) AS this_year
       FROM (
         SELECT c.Inquiry_Id,
                COALESCE(ia.Assigned_User_Id, top.created_by) AS owner_id,
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
       LEFT JOIN awt_adminuser u ON u.id = x.owner_id
      GROUP BY x.owner_id
      ORDER BY this_month DESC, total DESC`
  );
  return (rows as any[]).map((r) => ({
    userId: r.owner_id == null ? null : Number(r.owner_id),
    name: String(r.name),
    total: Number(r.total) || 0,
    thisMonth: Number(r.this_month) || 0,
    lastMonth: Number(r.last_month) || 0,
    thisYear: Number(r.this_year) || 0,
  }));
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
