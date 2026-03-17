/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getTrainerSession } from '@/app/api/trainer-portal/auth/session/route';

/* GET — Trainer's own attendance history */
/* POST — Mark today's attendance (check-in or check-out) */
export async function GET(req: NextRequest) {
  try {
    const session = await getTrainerSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month'); // YYYY-MM format
    const facultyId = session.facultyId;

    let dateFilter = '';
    const params: any[] = [facultyId];

    if (month) {
      dateFilter = `AND DATE_FORMAT(ta.Attend_Date, '%Y-%m') = ?`;
      params.push(month);
    }

    const [records] = await pool.query<any[]>(
      `SELECT ta.*, b.Batch_code
       FROM trainer_attendance ta
       LEFT JOIN batch_mst b ON ta.Batch_Id = b.Batch_Id
       WHERE ta.Faculty_Id = ? ${dateFilter}
       ORDER BY ta.Attend_Date DESC
       LIMIT 60`,
      params
    );

    // Today's record
    const [today] = await pool.query<any[]>(
      `SELECT * FROM trainer_attendance WHERE Faculty_Id = ? AND Attend_Date = CURDATE()`,
      [facultyId]
    );

    // Stats for current month
    const [stats] = await pool.query<any[]>(
      `SELECT
        COUNT(*) as total_days,
        SUM(CASE WHEN Status = 'Present' THEN 1 ELSE 0 END) as present_days,
        SUM(CASE WHEN Status = 'Absent' THEN 1 ELSE 0 END) as absent_days,
        SUM(CASE WHEN Status = 'Half Day' THEN 1 ELSE 0 END) as half_days
       FROM trainer_attendance
       WHERE Faculty_Id = ? AND DATE_FORMAT(Attend_Date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')`,
      [facultyId]
    );

    return NextResponse.json({
      records,
      today: today.length ? today[0] : null,
      stats: stats[0] || { total_days: 0, present_days: 0, absent_days: 0, half_days: 0 }
    });
  } catch (err: unknown) {
    console.error('Attendance GET error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getTrainerSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();
    const body = await req.json();
    const { action, remarks } = body; // action: 'check_in' | 'check_out'
    const facultyId = session.facultyId;

    if (!action || !['check_in', 'check_out'].includes(action)) {
      return NextResponse.json({ error: 'action must be check_in or check_out' }, { status: 400 });
    }

    // Check if today's record exists
    const [existing] = await pool.query<any[]>(
      `SELECT * FROM trainer_attendance WHERE Faculty_Id = ? AND Attend_Date = CURDATE()`,
      [facultyId]
    );

    if (action === 'check_in') {
      if (existing.length) {
        return NextResponse.json({ error: 'Already checked in today' }, { status: 400 });
      }
      await pool.query(
        `INSERT INTO trainer_attendance (Faculty_Id, Attend_Date, Check_In, Status, Remarks)
         VALUES (?, CURDATE(), CURTIME(), 'Present', ?)`,
        [facultyId, remarks || null]
      );
      return NextResponse.json({ success: true, action: 'check_in' });
    }

    if (action === 'check_out') {
      if (!existing.length) {
        return NextResponse.json({ error: 'No check-in found for today' }, { status: 400 });
      }
      if (existing[0].Check_Out) {
        return NextResponse.json({ error: 'Already checked out today' }, { status: 400 });
      }
      await pool.query(
        `UPDATE trainer_attendance SET Check_Out = CURTIME(), Remarks = COALESCE(?, Remarks)
         WHERE Faculty_Id = ? AND Attend_Date = CURDATE()`,
        [remarks || null, facultyId]
      );
      return NextResponse.json({ success: true, action: 'check_out' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: unknown) {
    console.error('Attendance POST error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
