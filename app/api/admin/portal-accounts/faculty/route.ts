/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

async function ensureBreakTimeColumn(pool: any) {
  const [cRows] = await pool.query(
    `SELECT COUNT(*) as cnt
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'faculty_master'
       AND COLUMN_NAME = 'BreakTimeMinutes'`
  );
  const cnt = Number((cRows as any)?.[0]?.cnt ?? 0);
  if (cnt > 0) return;

  await pool.query(
    `ALTER TABLE faculty_master
     ADD COLUMN BreakTimeMinutes INT NULL DEFAULT 60`
  );
}

async function ensureTimeColumn(pool: any, columnName: 'InTime' | 'OutTime', defaultValue: string) {
  const [cRows] = await pool.query(
    `SELECT COUNT(*) as cnt
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'faculty_master'
       AND COLUMN_NAME = ?`,
    [columnName]
  );
  const cnt = Number((cRows as any)?.[0]?.cnt ?? 0);
  if (cnt > 0) return;

  await pool.query(
    `ALTER TABLE faculty_master
     ADD COLUMN ${columnName} TIME NOT NULL DEFAULT '${defaultValue}'`
  );
}

async function ensureScheduleOverrideTable(pool: any) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS trainer_schedule_override (
      Id INT NOT NULL AUTO_INCREMENT,
      Faculty_Id INT NOT NULL,
      Work_Date DATE NOT NULL,
      InTime TIME NOT NULL,
      OutTime TIME NOT NULL,
      Created_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      Updated_At DATETIME DEFAULT NULL,
      PRIMARY KEY (Id),
      UNIQUE KEY uniq_faculty_date (Faculty_Id, Work_Date),
      INDEX idx_work_date (Work_Date),
      INDEX idx_faculty_id (Faculty_Id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

function parseIsoDate(value: string | null): string | null {
  if (!value) return null;
  const v = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return v;
}

function normalizeTime(raw: unknown, fallback: string): string {
  if (raw === null || raw === undefined || raw === '') return fallback;
  const s = String(raw).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) throw new Error('Time must be in HH:MM format');
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  const ss = m[3] === undefined ? 0 : Number(m[3]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || !Number.isFinite(ss)) throw new Error('Invalid time');
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59 || ss < 0 || ss > 59) throw new Error('Invalid time');
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'user.create');
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const date = parseIsoDate(searchParams.get('date'));

    const pool = getPool();

    await ensureBreakTimeColumn(pool);
    await ensureTimeColumn(pool, 'InTime', '08:00:00');
    await ensureTimeColumn(pool, 'OutTime', '17:30:00');
    if (date) await ensureScheduleOverrideTable(pool);

    const [rows] = await pool.query(
      date
        ? `SELECT fm.Faculty_Id, fm.Faculty_Name, fm.IsActive, fm.BreakTimeMinutes,
                  fm.InTime, fm.OutTime,
                  tso.InTime as OverrideInTime, tso.OutTime as OverrideOutTime
           FROM faculty_master fm
           LEFT JOIN trainer_schedule_override tso
             ON tso.Faculty_Id = fm.Faculty_Id
            AND tso.Work_Date = ?
           WHERE (IsDelete = 0 OR IsDelete IS NULL)
           ORDER BY fm.Faculty_Id DESC`
        : `SELECT fm.Faculty_Id, fm.Faculty_Name, fm.IsActive, fm.BreakTimeMinutes,
                  fm.InTime, fm.OutTime
           FROM faculty_master fm
           WHERE (IsDelete = 0 OR IsDelete IS NULL)
           ORDER BY fm.Faculty_Id DESC`,
      date ? [date] : []
    );

    return NextResponse.json({ rows: rows as any[] });
  } catch (err: unknown) {
    console.error('Admin portal-accounts faculty list error:', err);
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requirePermission(req, 'user.create');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json().catch(() => ({}));
    const facultyId = Number(body?.Faculty_Id);
    const breakTimeMinutesRaw = body?.BreakTimeMinutes;
    const inTimeRaw = body?.InTime;
    const outTimeRaw = body?.OutTime;
    const workDateRaw = body?.Work_Date ?? body?.WorkDate ?? null;
    const workDate = parseIsoDate(workDateRaw);
    if (workDateRaw !== null && workDateRaw !== undefined && workDateRaw !== '' && !workDate) {
      return NextResponse.json({ success: false, message: 'Work_Date must be in YYYY-MM-DD format' }, { status: 400 });
    }

    if (!Number.isFinite(facultyId) || facultyId <= 0) {
      return NextResponse.json({ success: false, message: 'Invalid Faculty_Id' }, { status: 400 });
    }

    const breakTimeMinutes = breakTimeMinutesRaw === null || breakTimeMinutesRaw === undefined || breakTimeMinutesRaw === ''
      ? null
      : Number(breakTimeMinutesRaw);

    if (breakTimeMinutes !== null) {
      if (!Number.isFinite(breakTimeMinutes) || breakTimeMinutes < 0 || breakTimeMinutes > 600) {
        return NextResponse.json({ success: false, message: 'BreakTimeMinutes must be between 0 and 600' }, { status: 400 });
      }
    }

    const pool = getPool();
    await ensureBreakTimeColumn(pool);
    await ensureTimeColumn(pool, 'InTime', '08:00:00');
    await ensureTimeColumn(pool, 'OutTime', '17:30:00');

    // If Work_Date is provided, update per-day override schedule (not the default schedule).
    if (workDate) {
      await ensureScheduleOverrideTable(pool);

      const [defaultsRows] = await pool.query<any[]>(
        `SELECT InTime, OutTime
         FROM faculty_master
         WHERE Faculty_Id = ?
         LIMIT 1`,
        [facultyId]
      );
      const defaults = defaultsRows?.[0] || {};
      const defaultIn = defaults?.InTime ? String(defaults.InTime).slice(0, 8) : '08:00:00';
      const defaultOut = defaults?.OutTime ? String(defaults.OutTime).slice(0, 8) : '17:30:00';

      const nextIn = normalizeTime(inTimeRaw, defaultIn);
      const nextOut = normalizeTime(outTimeRaw, defaultOut);

      // If override equals defaults, remove override row to keep table clean.
      if (nextIn === normalizeTime(defaultIn, '08:00:00') && nextOut === normalizeTime(defaultOut, '17:30:00')) {
        await pool.query(
          `DELETE FROM trainer_schedule_override
           WHERE Faculty_Id = ? AND Work_Date = ?`,
          [facultyId, workDate]
        );
        return NextResponse.json({ success: true, mode: 'override', action: 'deleted' });
      }

      await pool.query(
        `INSERT INTO trainer_schedule_override (Faculty_Id, Work_Date, InTime, OutTime)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           InTime = VALUES(InTime),
           OutTime = VALUES(OutTime),
           Updated_At = NOW()`,
        [facultyId, workDate, nextIn, nextOut]
      );

      return NextResponse.json({ success: true, mode: 'override', action: 'upserted' });
    }

    // Otherwise update default schedule / break time on faculty_master.
    const updates: string[] = [];
    const params: any[] = [];

    if (breakTimeMinutesRaw !== undefined) {
      updates.push('BreakTimeMinutes = ?');
      params.push(breakTimeMinutes);
    }
    if (inTimeRaw !== undefined) {
      updates.push('InTime = ?');
      params.push(normalizeTime(inTimeRaw, '08:00:00'));
    }
    if (outTimeRaw !== undefined) {
      updates.push('OutTime = ?');
      params.push(normalizeTime(outTimeRaw, '17:30:00'));
    }

    if (updates.length === 0) {
      return NextResponse.json({ success: false, message: 'No fields to update' }, { status: 400 });
    }

    await pool.query(
      `UPDATE faculty_master
       SET ${updates.join(', ')}
       WHERE Faculty_Id = ?`,
      [...params, facultyId]
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Admin portal-accounts faculty break-time update error:', err);
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
