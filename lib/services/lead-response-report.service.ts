/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPool } from '@/lib/db';
import { ensureAllocationTables, getAllocationSettings, timedQuery } from '@/lib/services/lead-allocation.service';

/**
 * First-response & conversion report.
 *
 * For every inquiry received in the date range:
 *   first response = the earliest discussion written by a staff member at or after the lead
 *                    arrived (Date_Added, falling back to the inquiry date). Minutes from arrival.
 *   converted      = status is "Admission confirmed" (kept in step with real admissions by
 *                    lead-status-sync.service.ts).
 * Grouped by owner (inquiry_assignments; "Unassigned" when none) and by source (Inquiry_From).
 */

export interface ResponseGroupRow {
  key: string;
  leads: number;
  contacted: number;
  withinTarget: number;
  within24h: number;
  neverContacted: number;
  medianMinutes: number | null;
  avgMinutes: number | null;
  converted: number;
  conversionPct: number;
  withinTargetPct: number;
}

export interface LeadResponseReport {
  from: string;
  to: string;
  targetMinutes: number;
  totals: ResponseGroupRow;
  byOwner: ResponseGroupRow[];
  bySource: ResponseGroupRow[];
  slowest: { Inquiry_Id: number; Student_Name: string; owner: string; source: string; arrived: string; minutes: number | null }[];
}

const MAX_RANGE_DAYS = 186;

function summarise(key: string, rows: any[], target: number, admittedId: number | null): ResponseGroupRow {
  const mins = rows.map((r) => r.mins).filter((m): m is number => m != null).sort((a, b) => a - b);
  const leads = rows.length;
  const converted = admittedId == null ? 0 : rows.filter((r) => r.status === admittedId).length;
  const withinTarget = mins.filter((m) => m <= target).length;
  const median = mins.length ? (mins.length % 2 ? mins[(mins.length - 1) / 2] : Math.round((mins[mins.length / 2 - 1] + mins[mins.length / 2]) / 2)) : null;
  return {
    key,
    leads,
    contacted: mins.length,
    withinTarget,
    within24h: mins.filter((m) => m <= 24 * 60).length,
    neverContacted: leads - mins.length,
    medianMinutes: median,
    avgMinutes: mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) : null,
    converted,
    conversionPct: leads ? Math.round((converted / leads) * 1000) / 10 : 0,
    withinTargetPct: leads ? Math.round((withinTarget / leads) * 1000) / 10 : 0,
  };
}

export async function getLeadResponseReport(from: string, to: string): Promise<LeadResponseReport> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
    throw Object.assign(new Error('Pick a valid date range'), { status: 400 });
  }
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
  if (days > MAX_RANGE_DAYS) throw Object.assign(new Error(`Pick at most ${MAX_RANGE_DAYS} days`), { status: 400 });

  await ensureAllocationTables();
  const pool = getPool();
  const { firstResponseMinutes } = await getAllocationSettings();
  const [admRows] = await pool.query(
    `SELECT Id FROM status_master WHERE LOWER(TRIM(Status)) = 'admission confirmed' AND (IsDelete = 0 OR IsDelete IS NULL) ORDER BY Id LIMIT 1`
  );
  const admittedId = (admRows as any[])[0]?.Id != null ? Number((admRows as any[])[0].Id) : null;

  const rows = await timedQuery(
    `SELECT si.Inquiry_Id, si.Student_Name, COALESCE(NULLIF(TRIM(si.Inquiry_From), ''), 'Unknown') AS source,
            CAST(NULLIF(si.OnlineState, '') AS UNSIGNED) AS status,
            DATE_FORMAT(COALESCE(si.Date_Added, si._inquiry_date), '%Y-%m-%d %H:%i') AS arrived,
            ia.Assigned_User_Id AS owner_id,
            TIMESTAMPDIFF(MINUTE, COALESCE(si.Date_Added, si._inquiry_date), fr.first_at) AS mins
       FROM student_inquiry si
       LEFT JOIN inquiry_assignments ia ON ia.Inquiry_Id = si.Inquiry_Id
       LEFT JOIN (
         SELECT d.Inquiry_id, MIN(d.created_date) AS first_at
           FROM awt_inquirydiscussion d
           JOIN student_inquiry s2 ON s2.Inquiry_Id = d.Inquiry_id
          WHERE d.deleted = 0 AND d.created_by IS NOT NULL AND d.created_by > 0
            AND (s2.IsDelete = 0 OR s2.IsDelete IS NULL)
            AND s2._inquiry_date BETWEEN ? AND ?
            AND d.created_date >= COALESCE(s2.Date_Added, s2._inquiry_date)
          GROUP BY d.Inquiry_id
       ) fr ON fr.Inquiry_id = si.Inquiry_Id
      WHERE (si.IsDelete = 0 OR si.IsDelete IS NULL)
        AND si._inquiry_date BETWEEN ? AND ?`,
    [from, to, from, to]
  );
  const list = (rows as any[]).map((r) => ({ ...r, mins: r.mins == null ? null : Math.max(0, Number(r.mins)), status: r.status == null ? null : Number(r.status) }));

  const [users] = await pool.query(
    `SELECT u.id, COALESCE(NULLIF(TRIM(c.display_name), ''), NULLIF(TRIM(CONCAT(COALESCE(u.firstname, ''), ' ', COALESCE(u.lastname, ''))), ''), u.username) AS name
       FROM awt_adminuser u LEFT JOIN appt_counsellors c ON c.user_id = u.id`
  );
  const nameOf = new Map((users as any[]).map((u) => [Number(u.id), String(u.name)]));
  const ownerName = (r: any) => (r.owner_id == null ? 'Unassigned' : nameOf.get(Number(r.owner_id)) ?? `User ${r.owner_id}`);

  const group = (keyOf: (r: any) => string) => {
    const m = new Map<string, any[]>();
    for (const r of list) { const k = keyOf(r); (m.get(k) ?? m.set(k, []).get(k)!).push(r); }
    return [...m.entries()].map(([k, rs]) => summarise(k, rs, firstResponseMinutes, admittedId)).sort((a, b) => b.leads - a.leads);
  };

  const slowest = list
    .filter((r) => r.status !== admittedId)
    .sort((a, b) => (b.mins ?? Number.MAX_SAFE_INTEGER) - (a.mins ?? Number.MAX_SAFE_INTEGER))
    .slice(0, 50)
    .map((r) => ({ Inquiry_Id: Number(r.Inquiry_Id), Student_Name: r.Student_Name, owner: ownerName(r), source: r.source, arrived: r.arrived, minutes: r.mins }));

  return {
    from, to, targetMinutes: firstResponseMinutes,
    totals: summarise('All leads', list, firstResponseMinutes, admittedId),
    byOwner: group(ownerName),
    bySource: group((r) => r.source),
    slowest,
  };
}
