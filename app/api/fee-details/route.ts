/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

let supportsStatementTimeout: boolean | null = null;

function withStatementTimeout(sql: string, seconds: number): string {
  const safeSeconds = Math.max(1, Math.min(30, Math.trunc(seconds)));
  return `SET STATEMENT max_statement_time=${safeSeconds} FOR ${sql}`;
}

async function runGuardedQuery(pool: ReturnType<typeof getPool>, sql: string, params: any[] = [], seconds = 8): Promise<any[]> {
  const timeoutSql = supportsStatementTimeout !== false ? withStatementTimeout(sql, seconds) : sql;

  try {
    const [rows] = await pool.query(timeoutSql, params);
    if (timeoutSql !== sql) supportsStatementTimeout = true;
    return rows as any[];
  } catch (error: any) {
    if (timeoutSql !== sql && supportsStatementTimeout !== false) {
      const message = String(error?.message || '').toLowerCase();
      if (message.includes('max_statement_time') || message.includes('syntax')) {
        supportsStatementTimeout = false;
        const [rows] = await pool.query(sql, params);
        return rows as any[];
      }
    }
    throw error;
  }
}

function personKey(row: any): string {
  const name = String(row.Student_Name ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  const mobile = String(row.Present_Mobile ?? row.Mobile ?? '').replace(/\D/g, '').slice(-10);
  if (mobile.length === 10) return `m:${mobile}|n:${name}`;

  const email = String(row.Email ?? '').trim().toLowerCase();
  if (email.includes('@')) return `e:${email}`;

  const batch = String(row.Batch_code ?? row.Batch_Code ?? '').trim().toLowerCase();
  return name ? `n:${name}|b:${batch}` : `id:${Number(row.Student_Id) || 0}`;
}

function dedupeByPerson<T extends Record<string, any>>(rows: T[], scoreRow: (row: T) => number): T[] {
  const bestByKey = new Map<string, { row: T; score: number }>();
  for (const row of rows) {
    const key = personKey(row);
    const score = scoreRow(row);
    const existing = bestByKey.get(key);
    if (!existing || score > existing.score) bestByKey.set(key, { row, score });
  }
  return Array.from(bestByKey.values()).map((entry) => entry.row);
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, ['report_fees.view', 'finance.view']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const mode = (searchParams.get('mode') ?? '').trim();
    const q = (searchParams.get('q') ?? '').trim();
    const courseId = searchParams.get('courseId') ?? '';
    const batchId = searchParams.get('batchId') ?? '';

    if (mode === 'recent') {
      const pool = getPool();
      const feeRows = await runGuardedQuery(pool,
        `SELECT Fees_Id, Student_Id, Fees_Code, RDate, Date_Added, Payment_Type, PaymentId, Amount
         FROM s_fees_mst
         WHERE TypeR = 'C'
           AND Fees_Code IS NOT NULL
           AND Fees_Code <> ''
           AND (IsDelete = 0 OR IsDelete IS NULL)
         ORDER BY Fees_Id DESC
         LIMIT 200`,
        [],
        5
      );

      const recentFees = feeRows.filter((row) => String(row.Fees_Code ?? '').trim() !== '');

      if (!recentFees.length) {
        return NextResponse.json({ rows: [] }, { headers: { 'Cache-Control': 'no-store' } });
      }

      const studentIds = [...new Set(recentFees.map((row) => Number(row.Student_Id)).filter(Boolean))];
      const studentRows = studentIds.length
        ? await runGuardedQuery(pool,
            // Resolve the batch via a single deterministic row (latest non-deleted
            // batch for the code) so duplicate batch_mst rows can't fan out. Don't
            // filter on sm.IsDelete here — a receipt's student may have since been
            // deleted/transferred, but the name must still render on the receipt.
            `SELECT sm.Student_Id, sm.Student_Name, cm.Course_Name, bm.Batch_code,
                    COALESCE(NULLIF(TRIM(sm.Transfered), ''), '') AS Transfered,
                    COALESCE(sm.Moved_To_Batch_Code, '') AS Moved_To_Batch_Code
             FROM student_master sm
             LEFT JOIN course_mst cm ON cm.Course_Id = sm.Course_Id
             LEFT JOIN batch_mst bm ON bm.Batch_Id = (
               SELECT b2.Batch_Id FROM batch_mst b2
               WHERE b2.Batch_code = sm.Batch_Code AND (b2.IsDelete = 0 OR b2.IsDelete IS NULL)
               ORDER BY b2.Batch_Id DESC LIMIT 1
             )
             WHERE sm.Student_Id IN (?)`,
            [studentIds],
            5
          )
        : [];

      const studentById = new Map(studentRows.map((row: any) => [Number(row.Student_Id), row]));
      const recentRows = recentFees.map((row) => {
        const student = studentById.get(Number(row.Student_Id));
        return {
          Fees_Id: row.Fees_Id,
          Student_Id: row.Student_Id,
          Student_Name: student?.Student_Name ?? '',
          Course_Name: student?.Course_Name ?? null,
          Batch_code: student?.Batch_code ?? null,
          Fees_Code: row.Fees_Code,
          Receipt_Date: row.RDate ?? row.Date_Added,
          Payment_Type: row.Payment_Type,
          PaymentId: row.PaymentId,
          Amount: row.Amount,
          Transfered: student?.Transfered ?? '',
          Moved_To_Batch_Code: student?.Moved_To_Batch_Code ?? '',
          Cancelled: 0,
        };
      });

      return NextResponse.json({ rows: recentRows }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (mode === 'students') {
      const studentParams: any[] = [];
      const studentConditions = [
        '(IsDelete = 0 OR IsDelete IS NULL)',
        "COALESCE(NULLIF(TRIM(Student_Name), ''), '') <> ''",
      ];
      if (q) {
        studentConditions.push('(Student_Name LIKE ? OR Student_Id = ? OR Batch_Code LIKE ?)');
        studentParams.push(`%${q}%`, Number(q) || 0, `%${q}%`);
      }
      const requestedLimit = Number(searchParams.get('limit')) || 0;
      const limit = q ? Math.max(1, Math.min(requestedLimit || 50, 100)) : 0;
      const studentRows = await runGuardedQuery(getPool(),
        `SELECT Student_Id, Student_Name, Batch_Code AS Batch_code
         FROM student_master
         WHERE ${studentConditions.join(' AND ')}
         ORDER BY ${q ? 'Student_Id DESC' : 'Student_Name ASC'}
         ${limit ? `LIMIT ${limit}` : ''}`,
        studentParams,
        10
      );
      return NextResponse.json({
        rows: dedupeByPerson(studentRows, (row) => Number(row.Student_Id) || 0),
      });
    }

    const conditions = ['(sm.IsDelete = 0 OR sm.IsDelete IS NULL)'];
    const params: any[] = [];

    if (q) {
      // Match the batch on the student's own stored code so search works even when
      // the (deduped) batch_mst join is null (e.g. inquiry-only / deleted batches).
      conditions.push('(sm.Student_Name LIKE ? OR sm.Student_Id = ? OR sm.Batch_Code LIKE ?)');
      params.push(`%${q}%`, Number(q) || 0, `%${q}%`);
    }
    if (courseId) {
      conditions.push('sm.Course_Id = ?');
      params.push(Number(courseId));
    }
    if (batchId) {
      conditions.push('bm.Batch_Id = ?');
      params.push(Number(batchId));
    }
    if (!q && !batchId) {
      conditions.push('1 = 0');
    }
    // Fee-details search is about students with actual fee activity. student_master
    // holds ~169k rows, many of them phantom/import duplicates (same name, no admission
    // or receipt) that fan a single search into dozens of rows. Restrict results to
    // students who have an admission or a fee ledger entry so each real person shows
    // once and the search stays relevant.
    conditions.push(`(
      EXISTS (SELECT 1 FROM admission_master am2
              WHERE am2.Student_Id = sm.Student_Id AND (am2.IsDelete = 0 OR am2.IsDelete IS NULL))
      OR EXISTS (SELECT 1 FROM s_fees_mst f2
              WHERE f2.Student_Id = sm.Student_Id AND (f2.IsDelete = 0 OR f2.IsDelete IS NULL))
    )`);

    const pool = getPool();
    const studentRows = await runGuardedQuery(pool,
      // Batch resolved via a single deterministic row (latest non-deleted batch for
      // the code) so duplicate batch_mst rows can't fan students into duplicate rows
      // or attach a stale/deleted batch. Fee resolved through the same fallback chain
      // the per-student detail page uses (fees_structure → batch fees) instead of only
      // Fees_Full_Payment, so batches that store the fee elsewhere don't show 0.
      `SELECT
         sm.Student_Id, sm.Student_Name, sm.Present_Mobile, sm.Email,
         cm.Course_Name, COALESCE(bm.Batch_code, sm.Batch_Code) AS Batch_code, bm.Batch_Id,
         COALESCE(
           NULLIF(CAST(REPLACE(IFNULL(fs.actualfees, ''), ',', '') AS DECIMAL(15,2)), 0),
           NULLIF(CAST(REPLACE(IFNULL(fs.fullfees, ''), ',', '') AS DECIMAL(15,2)), 0),
           NULLIF(CAST(REPLACE(IFNULL(fs.total_inr, ''), ',', '') AS DECIMAL(15,2)), 0),
           NULLIF(CAST(REPLACE(IFNULL(bm.Actual_Fees_Payment, ''), ',', '') AS DECIMAL(15,2)), 0),
           NULLIF(CAST(REPLACE(IFNULL(bm.Fees_Full_Payment, ''), ',', '') AS DECIMAL(15,2)), 0),
           0
         ) AS Total_Fees,
         0 AS Total_Paid,
         COALESCE(NULLIF(TRIM(sm.Transfered), ''), '') AS Transfered,
         COALESCE(sm.Moved_To_Batch_Code, '') AS Moved_To_Batch_Code,
         0 AS Cancelled
       FROM student_master sm
       LEFT JOIN course_mst cm ON cm.Course_Id = sm.Course_Id
       LEFT JOIN batch_mst bm ON bm.Batch_Id = (
         SELECT b2.Batch_Id FROM batch_mst b2
         WHERE b2.Batch_code = sm.Batch_Code AND (b2.IsDelete = 0 OR b2.IsDelete IS NULL)
         ORDER BY b2.Batch_Id DESC LIMIT 1
       )
       LEFT JOIN (
         SELECT batch_id, MAX(id) AS id FROM fees_structure
         WHERE deleted = 0 OR deleted IS NULL GROUP BY batch_id
       ) latest_fs ON latest_fs.batch_id = bm.Batch_Id
       LEFT JOIN fees_structure fs ON fs.id = latest_fs.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY sm.Student_Id DESC
       LIMIT 300`,
      params,
      8
    );

    if (!studentRows.length) return NextResponse.json({ rows: [] });

    const studentIds = studentRows.map((row) => Number(row.Student_Id)).filter(Boolean);
    const [admissionRows, ledgerRows] = await Promise.all([
      runGuardedQuery(pool,
        `SELECT Student_Id,
           MAX(CASE WHEN LOWER(TRIM(CAST(COALESCE(Cancel,'') AS CHAR))) IN ('yes','1','true') THEN 1 ELSE 0 END) AS Cancelled,
           MAX(Fees) AS Fees
         FROM admission_master
         WHERE Student_Id IN (?) AND (IsDelete = 0 OR IsDelete IS NULL)
         GROUP BY Student_Id`,
        [studentIds],
        5
      ),
      // One pass over the fees ledger: paid (credits), posted debits and whether the
      // ₹899 membership was already billed — mirrors the per-student detail page so
      // the list's Total Fees / Paid / Balance match the student's own page exactly.
      // COALESCE(Total_Amt, Amount) so rows that only set Amount aren't undercounted.
      runGuardedQuery(pool,
        `SELECT Student_Id,
           SUM(CASE WHEN TypeR = 'C' THEN COALESCE(Total_Amt, Amount, 0) ELSE 0 END) AS paid,
           SUM(CASE WHEN TypeR = 'D' THEN COALESCE(Total_Amt, Amount, 0) ELSE 0 END) AS posted_debit,
           MAX(CASE WHEN TypeR = 'D' AND LOWER(IFNULL(Notes, '')) LIKE '%one time membership fees%' THEN 1 ELSE 0 END) AS has_membership_debit,
           SUBSTRING_INDEX(GROUP_CONCAT(CASE WHEN TypeR = 'C' AND Fees_Code IS NOT NULL AND Fees_Code <> '' THEN Fees_Id END ORDER BY Fees_Id DESC), ',', 1) AS Latest_Fees_Id,
           SUBSTRING_INDEX(GROUP_CONCAT(CASE WHEN TypeR = 'C' AND Fees_Code IS NOT NULL AND Fees_Code <> '' THEN Fees_Code END ORDER BY Fees_Id DESC), ',', 1) AS Latest_Fees_Code
         FROM s_fees_mst
         WHERE Student_Id IN (?) AND (IsDelete = 0 OR IsDelete IS NULL)
         GROUP BY Student_Id`,
        [studentIds],
        5
      ),
    ]);

    const parseFee = (v: any) => Number(String(v ?? '').replace(/,/g, '')) || 0;
    const MEMBERSHIP_FEE = 899;
    const admissionByStudent = new Map(admissionRows.map((row: any) => [Number(row.Student_Id), row]));
    const ledgerByStudent = new Map(ledgerRows.map((row: any) => [Number(row.Student_Id), row]));
    const rows = studentRows.map((row) => {
      const id = Number(row.Student_Id);
      const admission = admissionByStudent.get(id);
      const ledger = ledgerByStudent.get(id);
      // Tuition: admission.Fees first (as the detail page does), else the resolved
      // batch / fees_structure amount from the query above.
      const tuition = parseFee(admission?.Fees) || Number(row.Total_Fees) || 0;
      const postedDebit = Number(ledger?.posted_debit ?? 0);
      const paid = Number(ledger?.paid ?? 0);
      const membership = tuition > 0 && !Number(ledger?.has_membership_debit ?? 0) ? MEMBERSHIP_FEE : 0;
      return {
        ...row,
        Total_Fees: tuition + postedDebit + membership,
        Total_Paid: paid,
        Cancelled: Number(admission?.Cancelled ?? 0),
        Latest_Fees_Id: ledger?.Latest_Fees_Id ? Number(ledger.Latest_Fees_Id) : null,
        Latest_Fees_Code: ledger?.Latest_Fees_Code ?? null,
      };
    });

    const dedupedRows = dedupeByPerson(rows, (row) => {
      const hasReceipt = row.Latest_Fees_Id ? 1_000_000_000_000 : 0;
      const paidWeight = Number(row.Total_Paid ?? 0);
      return hasReceipt + (Number(row.Latest_Fees_Id) || 0) + paidWeight + (Number(row.Student_Id) || 0) / 1_000_000;
    });

    return NextResponse.json({ rows: dedupedRows });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 });
  }
}
