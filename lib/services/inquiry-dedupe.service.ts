/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPool } from '@/lib/db';

/**
 * One person = one lead per training programme.
 * Same person = same phone (last 10 digits; placeholders like 2147483647 / 9999999999 ignored)
 * OR same e-mail. Enforced three ways:
 *   1. findSameLead()   — every insert path checks first,
 *   2. recordReEnquiry() — a repeat enquiry updates the existing lead instead of adding one,
 *   3. UNIQUE indexes on student_inquiry.dedupe_phone / dedupe_email (generated columns,
 *      scripts/add-inquiry-dedupe-constraint.mjs) — the database itself refuses a second row.
 * The SQL in the generated columns must stay in step with phoneKey/emailKey below.
 */
export function phoneKey(v: unknown): string | null {
  const d = String(v ?? '').replace(/\D/g, '').slice(-10);
  return d.length === 10 && d !== '2147483647' && !/^(\d)\1{9}$/.test(d) && !d.startsWith('0') ? d : null;
}
export function emailKey(v: unknown): string | null {
  const s = String(v ?? '').trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) ? s : null;
}
const courseKey = (v: unknown): string | null => {
  const s = String(v ?? '').trim();
  return s && s !== '0' ? s : null;
};

export type SameLead = { inquiryId: number; studentName: string | null; counsellorId: number | null; counsellor: string | null; courseName: string | null };

/** The live lead of this person (phone or e-mail) for this programme, if any. */
export async function findSameLead(input: { mobile?: unknown; email?: unknown; courseId?: unknown }, conn: any = getPool()): Promise<SameLead | null> {
  const course = courseKey(input.courseId);
  const p = phoneKey(input.mobile);
  const e = emailKey(input.email);
  if (!course || (!p && !e)) return null;
  const conds: string[] = [];
  const params: unknown[] = [];
  if (p) { conds.push(`RIGHT(REGEXP_REPLACE(IFNULL(si.Present_Mobile,''),'[^0-9]',''),10) = ?`); params.push(p); }
  if (e) { conds.push(`LOWER(TRIM(si.Email)) = ?`); params.push(e); }
  const [rows] = await conn.query(
    `SELECT si.Inquiry_Id, si.Student_Name, ia.Assigned_User_Id, c.Course_Name,
            COALESCE(NULLIF(TRIM(CONCAT(IFNULL(u.firstname,''),' ',IFNULL(u.lastname,''))),''), u.username) AS counsellor
       FROM student_inquiry si
       LEFT JOIN inquiry_assignments ia ON ia.Inquiry_Id = si.Inquiry_Id
       LEFT JOIN awt_adminuser u ON u.id = ia.Assigned_User_Id
       LEFT JOIN course_mst c ON c.Course_Id = si.Course_Id
      WHERE IFNULL(si.IsDelete,0) = 0 AND si.Course_Id = ? AND (${conds.join(' OR ')})
      ORDER BY si.Inquiry_Id LIMIT 1`,
    [course, ...params]
  );
  const r = (rows as any[])[0];
  if (!r) return null;
  return {
    inquiryId: Number(r.Inquiry_Id),
    studentName: r.Student_Name ?? null,
    counsellorId: r.Assigned_User_Id == null ? null : Number(r.Assigned_User_Id),
    counsellor: r.counsellor ?? null,
    courseName: r.Course_Name ?? null,
  };
}

/** A repeat enquiry for the same programme: note it on the existing lead and alert its counsellor. */
export async function recordReEnquiry(
  lead: SameLead,
  opts: { source?: string | null; note?: string | null; by?: number | null },
  conn: any = getPool()
): Promise<void> {
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const text = [`Re-enquired on ${today}${opts.source ? ` via ${opts.source}` : ''}.`, opts.note?.trim()].filter(Boolean).join('\n');
  await conn.query(
    `INSERT INTO awt_inquirydiscussion (Inquiry_id, date, discussion, deleted, created_by, created_date)
     VALUES (?, CURDATE(), ?, 0, ?, NOW())`,
    [String(lead.inquiryId), text, opts.by ?? null]
  );
  await conn.query(`UPDATE student_inquiry SET Is_Re_Enquiry = 1 WHERE Inquiry_Id = ?`, [lead.inquiryId]);
  if (lead.counsellorId) {
    try {
      const { notify } = await import('@/lib/services/lead-allocation.service');
      await notify([lead.counsellorId], {
        kind: 'lead_reenquiry',
        title: 'Your lead enquired again',
        body: { name: lead.studentName, course: lead.courseName, source: opts.source ?? null },
        link: `/dashboard/inquiry/add?editId=${lead.inquiryId}`,
        inquiryId: lead.inquiryId,
        dedupe: `lead_reenquiry:${lead.inquiryId}:${Date.now()}`,
      });
    } catch (err) {
      console.error('Re-enquiry alert failed:', err);
    }
  }
}

export const isDuplicateKeyError = (err: unknown) =>
  (err as { code?: string })?.code === 'ER_DUP_ENTRY' && /dedupe_(phone|email)/.test(String((err as Error)?.message ?? ''));
