/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { ensureStudentTransferColumns } from '@/lib/student-transfer';

// A transferred student belongs to their destination batch (Moved_To_Batch_Code).
// Fall back to their own/admission batch code when not transferred. Used for both
// display and search so a transferred student shows under the NEW batch code.
const EFFECTIVE_BATCH_CODE = `COALESCE(
  CASE WHEN LOWER(TRIM(COALESCE(sm.Transfered, ''))) = 'yes'
            AND TRIM(COALESCE(sm.Moved_To_Batch_Code, '')) <> ''
       THEN TRIM(sm.Moved_To_Batch_Code) END,
  NULLIF(TRIM(sm.Batch_Code), ''),
  bm.Batch_code
)`;

// Columns the "Select Search" dropdown can target → safe column mapping
const SEARCH_FIELDS: Record<string, string> = {
  studentId: 'sm.Student_Id',
  batchCode: EFFECTIVE_BATCH_CODE,
  name:      'sm.Student_Name',
  email:     'sm.Email',
  mobile:    'sm.Present_Mobile',
};

// Granted admissions only: any student with an active, non-deleted admission_master
// row. Not filtered on Status_id=8 — that column has a known drift bug (see
// project_admission_status_columns memory) where a genuinely admitted student's
// Status_id can lag behind their real admission, hiding them here otherwise.
// Cancelled admissions are included too (tagged via the Cancelled column) rather
// than hidden, so cancelled students still show with their status visible.
const BASE_WHERE = `am.IsDelete = 0 AND am.IsActive = 1 AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)`;

// One row per student: keep only the latest active admission.
// A student can accumulate more than one active admission_master row (e.g. a batch
// transfer leaves the old admission active while roll-number allotment inserts a new
// one for the new batch). Without this, the student appears once per admission and the
// displayed Batch_Code can come from a stale admission. Done as a derived MAX() join
// rather than a correlated subquery to keep the list query index-friendly.
const LATEST_ADMISSION_JOIN = `JOIN (
  SELECT Student_Id, MAX(Admission_Id) AS Admission_Id
  FROM admission_master
  WHERE IsDelete = 0 AND IsActive = 1
  GROUP BY Student_Id
) la ON la.Admission_Id = am.Admission_Id`;

// Same Total Fees / Paid formula as /api/fee-details, the Fee Report, and
// lib/fee-balance.ts's computeStudentFeeBalance: admission fee (or
// fees_structure/batch fallback) + posted debits + the one-time membership
// fee, minus the paid ledger. This list previously only used the batch's flat
// Fees_Full_Payment (no membership fee, no posted debits), which made its
// Total Fees / Balance figures disagree with the student's own Fee Details
// page by exactly the ₹899 membership fee whenever that had been billed.
const FEES_JOIN = `LEFT JOIN (
  SELECT Student_Id,
    SUM(CASE WHEN TypeR = 'C' THEN COALESCE(Total_Amt, Amount, 0) ELSE 0 END) AS Paid,
    SUM(CASE WHEN TypeR = 'D' THEN COALESCE(Total_Amt, Amount, 0) ELSE 0 END) AS PostedDebit,
    MAX(CASE WHEN TypeR = 'D' AND LOWER(IFNULL(Notes, '')) LIKE '%one time membership fees%' THEN 1 ELSE 0 END) AS HasMembershipDebit
  FROM s_fees_mst
  WHERE IsDelete = 0
  GROUP BY Student_Id
) fp ON fp.Student_Id = sm.Student_Id`;

const FEES_STRUCTURE_JOIN = `LEFT JOIN (
  SELECT batch_id, MAX(id) AS id FROM fees_structure
  WHERE deleted = 0 OR deleted IS NULL GROUP BY batch_id
) latest_fs ON latest_fs.batch_id = COALESCE(bm.Batch_Id, bm2.Batch_Id)
LEFT JOIN fees_structure fs ON fs.id = latest_fs.id`;

function buildSearch(field: string, value: string) {
  if (!value) return { clause: '', params: [] as (string | number)[] };
  const like = `%${value}%`;
  const col = SEARCH_FIELDS[field];
  if (col) {
    // Exact match for id — a LIKE '%6%' substring match would also return
    // students 176, 1176, 176776, etc. (any id merely containing "6").
    if (field === 'studentId') return { clause: `AND sm.Student_Id = ?`, params: [Number(value) || 0] };
    return { clause: `AND ${col} LIKE ?`, params: [like] };
  }
  // No field selected → search across all of them
  return {
    clause: `AND (
      sm.Student_Id = ?
      OR ${EFFECTIVE_BATCH_CODE} LIKE ?
      OR sm.Student_Name LIKE ?
      OR sm.Email LIKE ?
      OR sm.Present_Mobile LIKE ?
    )`,
    params: [Number(value) || 0, like, like, like, like],
  };
}

// GET - Student Master: students with an active admission (mirrors legacy getAllStudent)
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'student.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    await ensureStudentTransferColumns(pool);
    const { searchParams } = new URL(req.url);

    const page   = Math.max(1, Number(searchParams.get('page'))  || 1);
    const limit  = Math.min(100, Math.max(10, Number(searchParams.get('limit')) || 25));
    const offset = (page - 1) * limit;
    const field  = searchParams.get('field')?.trim()  || '';
    const search = searchParams.get('search')?.trim() || '';

    const { clause, params } = buildSearch(field, search);

    const [rows, [countRows]] = await Promise.all([
      pool.query<any[]>(
        `SELECT
            am.Admission_Id,
           sm.Student_Id,
           ${EFFECTIVE_BATCH_CODE} AS Batch_Code,
           sm.Student_Name,
           sm.Present_Address,
           sm.Email,
           sm.Present_Mobile,
           sm.Transfered,
           sm.Moved_To_Batch_Code,
           sm.Moved_From_Batch_Code,
           COALESCE(mtc.Course_Name, '') AS Moved_To_Course_Name,
           CASE WHEN LOWER(TRIM(COALESCE(am.Cancel, ''))) IN ('yes','1','true') THEN 1 ELSE 0 END AS Cancelled,
           sm.IsActive,
           am.Payment_Type,
           am.Fees AS Admission_Fees,
           COALESCE(
             NULLIF(CAST(REPLACE(IFNULL(fs.actualfees, ''), ',', '') AS DECIMAL(15,2)), 0),
             NULLIF(CAST(REPLACE(IFNULL(fs.fullfees, ''), ',', '') AS DECIMAL(15,2)), 0),
             NULLIF(CAST(REPLACE(IFNULL(fs.total_inr, ''), ',', '') AS DECIMAL(15,2)), 0),
             NULLIF(CAST(REPLACE(IFNULL(bm.Actual_Fees_Payment, ''), ',', '') AS DECIMAL(15,2)), 0),
             NULLIF(CAST(REPLACE(IFNULL(bm.Fees_Full_Payment, ''), ',', '') AS DECIMAL(15,2)), 0),
             NULLIF(CAST(REPLACE(IFNULL(bm2.Fees_Full_Payment, ''), ',', '') AS DECIMAL(15,2)), 0),
             0
           ) AS Resolved_Batch_Fee,
           COALESCE(fp.Paid, 0) AS Paid_Fees,
           COALESCE(fp.PostedDebit, 0) AS Posted_Debit,
           COALESCE(fp.HasMembershipDebit, 0) AS Has_Membership_Debit
         FROM admission_master am
         ${LATEST_ADMISSION_JOIN}
         JOIN student_master sm ON sm.Student_Id = am.Student_Id
         LEFT JOIN batch_mst bm ON bm.Batch_Id = am.Batch_Id
         LEFT JOIN batch_mst bm2 ON bm2.Batch_code = sm.Batch_Code AND (bm2.IsDelete = 0 OR bm2.IsDelete IS NULL)
         LEFT JOIN course_mst mtc ON mtc.Course_Id = sm.Moved_To_Course_Id
         ${FEES_STRUCTURE_JOIN}
         ${FEES_JOIN}
         WHERE ${BASE_WHERE} ${clause}
         ORDER BY sm.Student_Id DESC, am.Admission_Id DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      ).then(([r]) => r),
      pool.query<any[]>(
        `SELECT COUNT(*) AS total
         FROM admission_master am
         ${LATEST_ADMISSION_JOIN}
         JOIN student_master sm ON sm.Student_Id = am.Student_Id
         LEFT JOIN batch_mst bm ON bm.Batch_Id = am.Batch_Id
         WHERE ${BASE_WHERE} ${clause}`,
        params
      ),
    ]);

    const searchedTotal = (countRows as any[])[0]?.total || 0;

    // Same Total Fees / Balance formula as /api/fee-details and the Fee Report
    // (see lib/fee-balance.ts): admission fee (or fees_structure/batch
    // fallback) + posted debits + the one-time ₹899 membership fee, minus paid.
    const parseFee = (v: unknown) => Number(String(v ?? '').replace(/,/g, '')) || 0;
    const MEMBERSHIP_FEE = 899;
    const rowsWithExactFees = (rows as any[]).map((row) => {
      const tuition = parseFee(row.Admission_Fees) || Number(row.Resolved_Batch_Fee) || 0;
      const postedDebit = Number(row.Posted_Debit ?? 0);
      const paid = Number(row.Paid_Fees ?? 0);
      const membership = tuition > 0 && !Number(row.Has_Membership_Debit ?? 0) ? MEMBERSHIP_FEE : 0;
      const totalFees = tuition + postedDebit + membership;
      return {
        ...row,
        Total_Fees: totalFees,
        Balance_Fees: totalFees - paid,
      };
    });

    // "Total Student" figure: reproduces the legacy app's own count exactly (appp.js
    // /nodeapp/getAllStudent countQuery — COUNT(*) of admission_master rows with
    // IsDelete=0 AND IsActive=1, no Status_id filter, no per-student dedup). Always a
    // global, unfiltered count regardless of search.
    const [[{ legacyTotal }]] = await pool.query<any[]>(
      `SELECT COUNT(*) AS legacyTotal
       FROM admission_master am
       LEFT JOIN student_master sm ON sm.Student_Id = am.Student_Id
       WHERE am.IsDelete = 0 AND am.IsActive = 1`
    );

    // With no active search, show the same legacy-matching figure everywhere on the
    // page (header + pagination) rather than the smaller deduped-list count. Once a
    // search narrows the list, pagination must track the actual matching rows instead
    // — the legacy total wouldn't make sense next to a handful of search results.
    const isFiltered = Boolean(clause);
    const total = isFiltered ? searchedTotal : (legacyTotal || 0);

    return NextResponse.json({
      rows: rowsWithExactFees,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      legacyTotalStudentCount: legacyTotal || 0,
    });
  } catch (err: unknown) {
    console.error('Student API error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH - toggle a student's Active status
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'student.update');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json().catch(() => ({}));
    const id = Number(body?.id);
    const isActive = body?.isActive ? 1 : 0;
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    await pool.query('UPDATE student_master SET IsActive = ? WHERE Student_Id = ?', [isActive, id]);
    return NextResponse.json({ success: true, isActive });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - soft delete student
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'student.delete');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    await pool.query('UPDATE student_master SET IsDelete = 1 WHERE Student_Id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
