/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPool } from '@/lib/db';

/**
 * Individual Sales Tracker built from the Inquiry master (not the uploaded sheet).
 * One entry = one discussion an employee logged on a lead in the last DAYS days.
 *   prospect     = the lead (inquiry no.)        course      = the lead's training programme
 *   temperature  = the lead's Hot/Warm/Cold tag  follow-up   = "No" when the note says the call didn't connect
 *   outcome      = the lead's current status, shown on the employee's latest entry for that lead
 */
const DAYS = 90;
const ADMITTED = new Set([8, 52]);
const LOST = new Set([20, 27, 36, 53, 54, 55]);
const NOT_CONNECTED = /not\s*connect|not\s*reachable|unreachable|no\s*answer|not\s*answer|switch(ed)?\s*off|\brnr\b|\bnr\b|busy|ringing/i;

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function weekStart(day: string): string {
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  return iso(d);
}

export type InquiryIndividual = { employee: string; userId: number; rows: any[] };

export async function getInquiryIndividuals(onlyUserId?: number): Promise<InquiryIndividual[]> {
  const [rows] = await getPool().query(
    `SET STATEMENT max_statement_time=30 FOR
     SELECT d.id, d.created_by, DATE_FORMAT(d.created_date,'%Y-%m-%d') AS day, LEFT(d.discussion, 300) AS note,
            si.Inquiry_Id, CAST(NULLIF(si.OnlineState,'') AS UNSIGNED) AS status, st.Status AS status_name,
            c.Course_Name, ilt.Temperature,
            COALESCE(NULLIF(TRIM(CONCAT(IFNULL(u.firstname,''),' ',IFNULL(u.lastname,''))),''), u.username) AS employee
       FROM awt_inquirydiscussion d
       JOIN student_inquiry si ON si.Inquiry_Id = d.Inquiry_Id_Int AND IFNULL(si.IsDelete,0) = 0
       JOIN awt_adminuser u ON u.id = d.created_by
       LEFT JOIN course_mst c ON c.Course_Id = si.Course_Id
       LEFT JOIN inquiry_lead_temperature ilt ON ilt.Inquiry_Id = si.Inquiry_Id
       LEFT JOIN status_master st ON st.Id = CAST(NULLIF(si.OnlineState,'') AS UNSIGNED)
      WHERE IFNULL(d.deleted,0) = 0 AND d.created_date >= CURDATE() - INTERVAL ${DAYS} DAY
        ${onlyUserId ? 'AND d.created_by = ?' : ''}
      ORDER BY d.created_date, d.id`,
    onlyUserId ? [onlyUserId] : []
  );
  // Latest entry per employee + lead carries the outcome.
  const last = new Map<string, number>();
  for (const r of rows as any[]) last.set(`${r.created_by}|${r.Inquiry_Id}`, r.id);

  const people = new Map<number, InquiryIndividual>();
  for (const r of rows as any[]) {
    const p = people.get(r.created_by) ?? { employee: String(r.employee), userId: Number(r.created_by), rows: [] };
    const t = String(r.Temperature ?? '').toLowerCase();
    const isLast = last.get(`${r.created_by}|${r.Inquiry_Id}`) === r.id;
    const status = Number(r.status);
    p.rows.push({
      date: r.day,
      week_start: weekStart(r.day),
      prospect_ref: `Inq ${r.Inquiry_Id}`,
      course: r.Course_Name || 'Not set',
      temperature: t === 'hot' ? 'Hot' : t === 'warm' ? 'Warm' : t === 'cold' ? 'Cold' : 'Not tagged',
      follow_up_connected: NOT_CONNECTED.test(String(r.note ?? '')) ? 'No' : 'Yes',
      outcome: !isLast ? 'Open' : ADMITTED.has(status) ? 'Admitted' : LOST.has(status) ? 'Not interested' : 'Open',
      outcome_note: isLast && (ADMITTED.has(status) || LOST.has(status)) ? String(r.status_name ?? '') : '',
    });
    people.set(r.created_by, p);
  }
  return [...people.values()].sort((a, b) => a.employee.localeCompare(b.employee));
}
