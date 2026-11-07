/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPool } from '@/lib/db';
import type { TrackerRow } from '@/lib/sales-scoreboard-parser';

/**
 * Weekly Sales Tracker built from live CRM data (last MONTHS months), per week × course:
 *   leads        new inquiries received (inquiry date)
 *   qualified    leads worked that week that are tagged Hot or Warm
 *   meetings     leads with a counselling meeting (Level 1/2/3) logged that week
 *   proposals    leads sent the admission form that week (course recommended)
 *   negotiation  leads worked that week whose status is "Interested (follow up)" / "Will let you know"
 *   closures     admissions closed (Admission Taken / confirmed), dated by admission date (else inquiry date)
 * Weeks are numbered within the month: days 1–7 = W1, 8–14 = W2, …
 */
const MONTHS = 6;

export async function getLiveTracker(): Promise<{ rows: TrackerRow[]; dataThrough: string }> {
  const pool = getPool();
  const since = `CURDATE() - INTERVAL ${MONTHS} MONTH`;
  const q = (sql: string) => pool.query(`SET STATEMENT max_statement_time=30 FOR ${sql}`).then(([r]) => r as any[]);
  const [leads, qualified, meetings, proposals, negotiation, closures] = await Promise.all([
    q(`SELECT DATE(Inquiry_Dt) d, Course_Id c, COUNT(*) n FROM student_inquiry
        WHERE IFNULL(IsDelete,0)=0 AND Inquiry_Dt >= ${since} AND Inquiry_Dt <= CURDATE() GROUP BY 1,2`),
    q(`SELECT DATE(d.created_date) d, s.Course_Id c, COUNT(DISTINCT s.Inquiry_Id) n
         FROM awt_inquirydiscussion d
         JOIN student_inquiry s ON s.Inquiry_Id = d.Inquiry_Id_Int AND IFNULL(s.IsDelete,0)=0
         JOIN inquiry_lead_temperature t ON t.Inquiry_Id = s.Inquiry_Id AND t.Temperature IN ('hot','warm')
        WHERE IFNULL(d.deleted,0)=0 AND d.created_date >= ${since} GROUP BY 1,2`),
    q(`SELECT DATE(d.created_date) d, s.Course_Id c, COUNT(DISTINCT s.Inquiry_Id) n
         FROM awt_inquirydiscussion d
         JOIN student_inquiry s ON s.Inquiry_Id = d.Inquiry_Id_Int AND IFNULL(s.IsDelete,0)=0
        WHERE IFNULL(d.deleted,0)=0 AND d.meeting_level IS NOT NULL AND d.created_date >= ${since} GROUP BY 1,2`),
    q(`SELECT DATE(l.Sent_At) d, s.Course_Id c, COUNT(DISTINCT s.Inquiry_Id) n
         FROM admission_form_sent_log l
         JOIN student_inquiry s ON s.Inquiry_Id = l.Inquiry_Id AND IFNULL(s.IsDelete,0)=0
        WHERE l.Sent_At >= ${since} GROUP BY 1,2`).catch(() => []),
    q(`SELECT DATE(d.created_date) d, s.Course_Id c, COUNT(DISTINCT s.Inquiry_Id) n
         FROM awt_inquirydiscussion d
         JOIN student_inquiry s ON s.Inquiry_Id = d.Inquiry_Id_Int AND IFNULL(s.IsDelete,0)=0 AND s.OnlineState IN ('16','24')
        WHERE IFNULL(d.deleted,0)=0 AND d.created_date >= ${since} GROUP BY 1,2`),
    // Same closure date as the Admission Closure widget: admission date, else inquiry date.
    q(`SELECT DATE(COALESCE(Admission_Dt, Inquiry_Dt)) d, Course_Id c, COUNT(*) n FROM student_inquiry
        WHERE IFNULL(IsDelete,0)=0 AND OnlineState IN ('8','52') AND COALESCE(Admission_Dt, Inquiry_Dt) >= ${since} GROUP BY 1,2`),
  ]);
  const courses = new Map<string, string>();
  for (const r of await q(`SELECT Course_Id, Course_Name FROM course_mst`)) courses.set(String(r.Course_Id), String(r.Course_Name));

  const pad = (n: number) => String(n).padStart(2, '0');
  const rows = new Map<string, TrackerRow>();
  let dataThrough = '';
  const add = (list: any[], key: 'leads' | 'qualified' | 'meetings' | 'proposals' | 'negotiation' | 'closures') => {
    for (const r of list) {
      if (!r.d) continue;
      const day = r.d instanceof Date ? `${r.d.getFullYear()}-${pad(r.d.getMonth() + 1)}-${pad(r.d.getDate())}` : String(r.d).slice(0, 10);
      if (day > dataThrough) dataThrough = day;
      const month = day.slice(0, 7);
      const week = Math.min(5, Math.ceil(Number(day.slice(8, 10)) / 7));
      const course = courses.get(String(r.c ?? '')) ?? 'Not set';
      const k = `${month}|${week}|${course}`;
      const row = rows.get(k) ?? {
        month, week, week_key: `${month}-W${week}`, week_label: `${month}-${pad((week - 1) * 7 + 1)}`,
        week_start: `${month}-${pad((week - 1) * 7 + 1)}`, course, course_as_entered: course,
        leads: 0, qualified: 0, meetings: 0, proposals: 0, negotiation: 0, closures: 0,
      };
      (row as any)[key] = Number((row as any)[key] || 0) + Number(r.n || 0);
      rows.set(k, row);
    }
  };
  add(leads, 'leads'); add(qualified, 'qualified'); add(meetings, 'meetings');
  add(proposals, 'proposals'); add(negotiation, 'negotiation'); add(closures, 'closures');
  return { rows: [...rows.values()].sort((a, b) => a.week_key.localeCompare(b.week_key) || a.course.localeCompare(b.course)), dataThrough };
}
