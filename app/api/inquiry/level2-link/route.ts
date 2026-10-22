/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getPool } from '@/lib/db';
import { buildLevel2Link } from '@/lib/appointments/calendly';

// Level 2 meeting for an inquiry: the person's appointment (details + booking-form answers) when
// one exists, otherwise a prefilled Calendly link to create the booking.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const inquiryId = Number(req.nextUrl.searchParams.get('inquiryId'));
  if (!Number.isInteger(inquiryId) || inquiryId <= 0) return NextResponse.json({ error: 'Invalid inquiryId' }, { status: 400 });
  try {
    const [rows] = await getPool().query(
      `SELECT a.id, a.appointment_code
         FROM appointments a
         JOIN student_inquiry i ON LOWER(TRIM(i.Email)) = LOWER(TRIM(a.email))
        WHERE i.Inquiry_Id = ? AND a.source = 'calendly' AND a.status IN ('Scheduled', 'Completed')
                  ORDER BY (a.appt_date >= CURDATE()) DESC, ABS(DATEDIFF(a.appt_date, CURDATE())), a.start_time LIMIT 1`,
      [inquiryId]
    );
    const booking = (rows as any[])[0];
    if (booking) {
      return NextResponse.json({ kind: 'appointment', appointmentId: booking.id, appointmentCode: booking.appointment_code });
    }
    const url = await buildLevel2Link(inquiryId, req.nextUrl.searchParams.get('date') || undefined);
    return NextResponse.json({ url, kind: 'create' });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not build the Calendly link' }, { status: 400 });
  }
}
