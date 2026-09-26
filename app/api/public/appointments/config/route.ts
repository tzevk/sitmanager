/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { ensureAppointmentTables } from '@/lib/appointments/schema';
import { loadCounsellors, loadSettings } from '@/lib/appointments/engine';
import { nowLocal, addDays } from '@/lib/appointments/time';

/**
 * Public — booking page bootstrap: training programs (Course Master), which
 * modes currently have counsellors, booking window and contact details.
 * Never exposes counsellor identities.
 */
export async function GET() {
  try {
    await ensureAppointmentTables();
    const pool = getPool();
    const [settings, counsellors, [courses]] = await Promise.all([
      loadSettings(pool),
      loadCounsellors(pool),
      pool.query(
        `SELECT Course_Id, Course_Name FROM course_mst
         WHERE IsActive = 1 AND (IsDelete IS NULL OR IsDelete = 0) AND Course_Name IS NOT NULL AND Course_Name <> ''
         ORDER BY Course_Name ASC`
      ),
    ]);

    const modes = {
      online: counsellors.some((c) => c.modes === 'both' || c.modes === 'online'),
      offline: counsellors.some((c) => c.modes === 'both' || c.modes === 'offline'),
    };
    const today = nowLocal().date;

    return NextResponse.json({
      success: true,
      programs: (courses as any[]).map((c) => ({ id: c.Course_Id, name: c.Course_Name })),
      modes,
      slotMinutes: settings.slot_minutes,
      window: { from: today, to: addDays(today, settings.booking_window_days) },
      officeAddress: settings.office_address,
      contact: { phone: settings.contact_phone, email: settings.contact_email },
    });
  } catch (err) {
    console.error('[appointments] public config:', err);
    return NextResponse.json({ success: false, error: 'Unable to load booking options' }, { status: 500 });
  }
}
