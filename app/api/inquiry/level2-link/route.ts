/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getPool } from '@/lib/db';
import { buildLevel2Link } from '@/lib/appointments/calendly';

const digits = (v: unknown) => String(v ?? '').replace(/\D/g, '').slice(-10);
const words = (v: unknown) => String(v ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1);

/**
 * Level 2 meeting for an inquiry: the person's appointment (details + booking-form answers) when
 * one can be matched with certainty, otherwise a prefilled Calendly link to create the booking.
 *
 * An appointment belongs to the inquiry only if it is the same person:
 *   - the mobile number matches (last 10 digits), or
 *   - the email matches AND the first name matches.
 * An email on its own is not enough (people share emails), and nothing is matched loosely.
 * If several appointments qualify, the one closest to the planned Level 2 date wins.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const inquiryId = Number(req.nextUrl.searchParams.get('inquiryId'));
  const plannedDate = req.nextUrl.searchParams.get('date') || '';
  if (!Number.isInteger(inquiryId) || inquiryId <= 0) return NextResponse.json({ error: 'Invalid inquiryId' }, { status: 400 });
  try {
    const pool = getPool();
    const [inqRows] = await pool.query(
      `SELECT Student_Name, FName, LName, Email, Present_Mobile, Present_Mobile2 FROM student_inquiry
        WHERE Inquiry_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL) LIMIT 1`, [inquiryId]
    );
    const inq = (inqRows as any[])[0];
    if (!inq) return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 });

    const email = String(inq.Email || '').trim().toLowerCase();
    const mobiles = [digits(inq.Present_Mobile), digits(inq.Present_Mobile2)].filter((m) => m.length === 10);
    const firstName = words(inq.FName || inq.Student_Name)[0] || '';

    if (email || mobiles.length) {
      const [cands] = await pool.query(
        `SELECT id, appointment_code, first_name, email, mobile, appt_date, created_at
           FROM appointments
          WHERE source = 'calendly' AND status IN ('Scheduled', 'Completed', 'No Show')
            AND (${email ? 'LOWER(TRIM(email)) = ?' : '0'} ${mobiles.length ? `OR RIGHT(REGEXP_REPLACE(mobile, '[^0-9]', ''), 10) IN (${mobiles.map(() => '?').join(',')})` : ''})`,
        [...(email ? [email] : []), ...mobiles]
      );
      const matches = (cands as any[]).filter((a) => {
        const mobileMatch = mobiles.includes(digits(a.mobile));
        const emailMatch = Boolean(email) && String(a.email || '').trim().toLowerCase() === email;
        const nameMatch = Boolean(firstName) && words(a.first_name).includes(firstName);
        return mobileMatch || (emailMatch && nameMatch);
      });
      const target = Date.parse(plannedDate);
      const dist = (a: any) => (Number.isFinite(target) ? Math.abs(Date.parse(String(a.appt_date).slice(0, 10)) - target) : 0);
      matches.sort((a, b) => dist(a) - dist(b) || Date.parse(b.created_at) - Date.parse(a.created_at));
      if (matches[0]) {
        return NextResponse.json({ kind: 'appointment', appointmentId: matches[0].id, appointmentCode: matches[0].appointment_code });
      }
    }

    const url = await buildLevel2Link(inquiryId, plannedDate || undefined);
    return NextResponse.json({ url, kind: 'create' });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not build the Calendly link' }, { status: 400 });
  }
}
