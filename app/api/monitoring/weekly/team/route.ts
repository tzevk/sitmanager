import { RowDataPacket } from 'mysql2';
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSession } from '@/lib/session';
import { getEmployeeWeeklyMonitoring } from '@/lib/services/monitoring.service';

interface TeamEmployee {
  id: number;
  firstname: string | null;
  lastname: string | null;
}

// Weekly Report team grants; the viewer is listed separately and self reports stay on /me.
const TEAMMATES_BY_VIEWER: Readonly<Partial<Record<number, readonly number[]>>> = {
  16: [24, 80, 76, 14],
};

function parseEmployeeId(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function isValidDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

async function getActiveEmployees(ids: readonly number[]): Promise<TeamEmployee[]> {
  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT id, firstname, lastname
     FROM awt_adminuser
     WHERE id IN (${placeholders}) AND deleted_date IS NULL`,
    [...ids],
  );

  return rows.map((row) => ({
    id: Number(row.id),
    firstname: row.firstname ?? null,
    lastname: row.lastname ?? null,
  }));
}

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const teammateIds = TEAMMATES_BY_VIEWER[session.userId] ?? [];
  const { searchParams } = new URL(req.url);
  const employeeIdParam = searchParams.get('employeeId');
  const weekStart = searchParams.get('weekStart');

  try {
    if (employeeIdParam === null) {
      if (!teammateIds.length) return NextResponse.json({ employees: [] });

      const employeeIds = [session.userId, ...teammateIds];
      const activeEmployees = await getActiveEmployees(employeeIds);
      const activeById = new Map(activeEmployees.map((employee) => [employee.id, employee]));
      if (!activeById.has(session.userId)) return NextResponse.json({ employees: [] });

      const employees: TeamEmployee[] = [];
      for (const id of employeeIds) {
        const employee = activeById.get(id);
        if (employee) employees.push(employee);
      }
      return NextResponse.json({ employees });
    }

    if (!teammateIds.length) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const employeeId = parseEmployeeId(employeeIdParam);
    if (employeeId === null) {
      return NextResponse.json({ error: 'Valid employeeId is required' }, { status: 400 });
    }
    if (!isValidDate(weekStart)) {
      return NextResponse.json({ error: 'Valid weekStart (YYYY-MM-DD) is required' }, { status: 400 });
    }
    if (employeeId === session.userId || !teammateIds.includes(employeeId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const scopedEmployees = await getActiveEmployees([session.userId, employeeId]);
    const activeIds = new Set(scopedEmployees.map((employee) => employee.id));
    if (!activeIds.has(session.userId) || !activeIds.has(employeeId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const days = await getEmployeeWeeklyMonitoring(employeeId, weekStart);
    return NextResponse.json({ days });
  } catch (error) {
    console.error('Error fetching team weekly monitoring:', error);
    return NextResponse.json({ error: 'Failed to fetch weekly monitoring' }, { status: 500 });
  }
}
