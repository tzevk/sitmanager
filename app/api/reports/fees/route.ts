/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { getPool } from '@/lib/db';
import { ensureStudentTransferColumns } from '@/lib/student-transfer';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, ['report_fees.view', 'finance.view']);
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    await ensureStudentTransferColumns(pool);
    const { searchParams } = new URL(req.url);

    const tab          = searchParams.get('tab') || 'cheque-pdc';
    const fromDate     = searchParams.get('fromDate') || '';
    const toDate       = searchParams.get('toDate') || '';
    const printDetails = searchParams.get('printDetails') === '1';
    const courseId     = searchParams.get('courseId') || '';
    const batchId      = searchParams.get('batchId') || '';
    const amountType   = searchParams.get('amountType') || '';

    // ── Lookup endpoints ──────────────────────────────────────────
    if (searchParams.get('action') === 'courses') {
      const [rows] = await pool.query(
        `SELECT Course_Id, Course_Name FROM course_mst
         WHERE (IsDelete = 0 OR IsDelete IS NULL)
         ORDER BY Course_Name`
      );
      return NextResponse.json({ courses: rows });
    }

    if (searchParams.get('action') === 'batches') {
      const cId = searchParams.get('courseId') || '';
      const conditions = ['(IsDelete = 0 OR IsDelete IS NULL)'];
      const params: any[] = [];
      if (cId) { conditions.push('Course_Id = ?'); params.push(Number(cId)); }
      const [rows] = await pool.query(
        `SELECT Batch_Id, Batch_code FROM batch_mst WHERE ${conditions.join(' AND ')} ORDER BY Batch_code DESC`,
        params
      );
      return NextResponse.json({ batches: rows });
    }

    if (tab === 'cheque-pdc') {
      const conditions = [`sfm.IsDelete = 0`, `sfm.TypeR = 'C'`,
        `LOWER(TRIM(sfm.Payment_Type)) IN ('cheque','pdc')`];
      const params: any[] = [];
      if (fromDate) { conditions.push(`sfm.Date_Added >= ?`); params.push(fromDate); }
      if (toDate)   { conditions.push(`sfm.Date_Added <= ?`); params.push(toDate); }
      if (printDetails) { conditions.push(`sfm.Print = 1`); }

      const [rows] = await pool.query(
        `SELECT
           sfm.Fees_Id, sfm.Fees_Code, sfm.Date_Added, sfm.RDate,
           sfm.Payment_Type, sfm.Cheque_No, sfm.Cheque_Bank, sfm.Cheque_Branch,
           sfm.Cheque_Date, sfm.Amount, sfm.Service_Tax, sfm.Total_Amt,
           sfm.Notes, sfm.Amt_Word, sfm.FeesMonth, sfm.FeesYear, sfm.Print,
           COALESCE(sm.Student_Name,'') AS Student_Name,
           COALESCE(sm.Present_Mobile,'') AS Present_Mobile,
           COALESCE(cm.Course_Name,'') AS Course_Name,
           COALESCE(bm.Batch_code,'') AS Batch_Code,
           COALESCE(NULLIF(TRIM(sm.Transfered), ''), '') AS Transfered,
           COALESCE(sm.Moved_To_Batch_Code, '') AS Moved_To_Batch_Code,
           COALESCE(sm.Moved_From_Batch_Code, '') AS Moved_From_Batch_Code,
           COALESCE(mtc.Course_Name, '') AS Moved_To_Course_Name
         FROM s_fees_mst sfm
         LEFT JOIN student_master sm ON sm.Student_Id = sfm.Student_Id AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
         LEFT JOIN course_mst cm ON cm.Course_Id = sfm.Course_Id
         LEFT JOIN batch_mst bm ON bm.Batch_Id = sfm.Batch_Id
         LEFT JOIN course_mst mtc ON mtc.Course_Id = sm.Moved_To_Course_Id
         WHERE ${conditions.join(' AND ')}
         ORDER BY sfm.Date_Added DESC, sfm.Fees_Id DESC
         LIMIT 1000`,
        params
      );
      return NextResponse.json({ rows });
    }

    if (tab === 'fees-details') {
      const subTab = searchParams.get('subTab') || 'fees-record';

      // ── Batch Wise Fees Details ──────────────────────────────────
      if (subTab === 'batch-wise-fees') {
        // Use student_master as the base table so ALL enrolled students appear,
        // even those whose admission_master.Batch_Id wasn't synced.
        // The student's batch is the authoritative sm.Batch_Code column
        // (same pattern used by fee-details/route.ts).
        const smConditions: string[] = [
          '(sm.IsDelete = 0 OR sm.IsDelete IS NULL)',
          '(sm.IsActive = 1 OR sm.IsActive IS NULL)', // exclude hidden (deactivated) students
          // No roll number allotted yet — don't show them. Falls back to any
          // admission record (am_any) when this specific bm.Batch_Id has none —
          // a transferred student's admission_master row still sits under their
          // OLD Batch_Id, so requiring an exact-batch match here would otherwise
          // hide them entirely from their new (Moved_To) batch's report.
          `NULLIF(TRIM(COALESCE(am.Roll_No, am_any.Roll_No)), '') IS NOT NULL`,
        ];
        const smParams: any[] = [];
        if (courseId) { smConditions.push('bm.Course_Id = ?');  smParams.push(Number(courseId)); }
        if (batchId)  { smConditions.push('bm.Batch_Id = ?');   smParams.push(Number(batchId)); }

        const [rows] = await pool.query<any[]>(
          `SELECT
             COALESCE(bm.Batch_code,'') AS Batch_Code,
             COALESCE(cm.Course_Name,'') AS Course_Name,
             bm.SDate AS Batch_Start, bm.EDate AS Batch_End, bm.Fees_Full_Payment,
             sm.Student_Id AS Student_Id,
             COALESCE(am.Roll_No, am_any.Roll_No) AS Roll_No,
             COALESCE(am.Cancel, am_any.Cancel) AS Cancel,
             COALESCE(am.Fees, am_any.Fees) AS Admission_Fees,
             COALESCE(NULLIF(TRIM(sm.Transfered), ''), am.Transfered, am_any.Transfered) AS Transfered,
             COALESCE(sm.Moved_To_Batch_Code, '') AS Moved_To_Batch_Code,
             COALESCE(sm.Moved_From_Batch_Code, '') AS Moved_From_Batch_Code,
             COALESCE(mtc.Course_Name, '') AS Moved_To_Course_Name,
             COALESCE(sm.Student_Name, CONCAT_WS(' ', sm.FName, sm.MName, sm.LName), '') AS Student_Name,
             COALESCE(sm.Present_Mobile,'') AS Present_Mobile,
             sfm.Fees_Id, sfm.Fees_Code, sfm.Date_Added, sfm.RDate,
             sfm.Payment_Type, sfm.Cheque_No, sfm.Cheque_Bank, sfm.Cheque_Branch,
             sfm.Cheque_Date, sfm.Amount, sfm.Service_Tax, sfm.Total_Amt,
             sfm.UnPaid_Amt, sfm.Amt_Word, sfm.Notes,
             sfm.FeesMonth, sfm.FeesYear, sfm.Print,
             -- Same resolution chain as /api/fee-details, so "Total Fees" here
             -- matches the per-student Fee Details page exactly instead of
             -- only ever reading the batch's flat Fees_Full_Payment.
             COALESCE(
               NULLIF(CAST(REPLACE(IFNULL(fs.actualfees, ''), ',', '') AS DECIMAL(15,2)), 0),
               NULLIF(CAST(REPLACE(IFNULL(fs.fullfees, ''), ',', '') AS DECIMAL(15,2)), 0),
               NULLIF(CAST(REPLACE(IFNULL(fs.total_inr, ''), ',', '') AS DECIMAL(15,2)), 0),
               NULLIF(CAST(REPLACE(IFNULL(bm.Actual_Fees_Payment, ''), ',', '') AS DECIMAL(15,2)), 0),
               NULLIF(CAST(REPLACE(IFNULL(bm.Fees_Full_Payment, ''), ',', '') AS DECIMAL(15,2)), 0),
               0
             ) AS Resolved_Batch_Fee,
             ledger.paid AS Ledger_Paid,
             ledger.posted_debit AS Ledger_Posted_Debit,
             ledger.has_membership_debit AS Ledger_Has_Membership_Debit
           FROM student_master sm
           LEFT JOIN batch_mst bm
             ON (
               bm.Batch_code = sm.Batch_Code
               OR (NULLIF(TRIM(sm.Moved_From_Batch_Code), '') IS NOT NULL AND bm.Batch_code = sm.Moved_From_Batch_Code)
               -- Some transfers never synced sm.Batch_Code to the new batch (a known
               -- data gap), which would otherwise make the student invisible in their
               -- own current batch's report. Moved_To_Batch_Code is the authoritative
               -- "current batch" for a transferred student — same fallback the student
               -- list (EFFECTIVE_BATCH_CODE) already uses.
               OR (LOWER(TRIM(COALESCE(sm.Transfered, ''))) = 'yes' AND NULLIF(TRIM(sm.Moved_To_Batch_Code), '') IS NOT NULL AND bm.Batch_code = sm.Moved_To_Batch_Code)
             )
             AND (bm.IsDelete = 0 OR bm.IsDelete IS NULL)
           LEFT JOIN course_mst cm ON cm.Course_Id = bm.Course_Id
           LEFT JOIN course_mst mtc ON mtc.Course_Id = sm.Moved_To_Course_Id
           LEFT JOIN (
             SELECT Student_Id, Batch_Id, MAX(Admission_Id) AS Admission_Id
             FROM admission_master
             WHERE (IsDelete = 0 OR IsDelete IS NULL)
             GROUP BY Student_Id, Batch_Id
           ) am_pick ON am_pick.Student_Id = sm.Student_Id AND am_pick.Batch_Id = bm.Batch_Id
           LEFT JOIN admission_master am ON am.Admission_Id = am_pick.Admission_Id
           LEFT JOIN (
             SELECT Student_Id, MAX(Admission_Id) AS Admission_Id
             FROM admission_master
             WHERE (IsDelete = 0 OR IsDelete IS NULL)
             GROUP BY Student_Id
           ) am_pick_any ON am_pick_any.Student_Id = sm.Student_Id
           LEFT JOIN admission_master am_any ON am_any.Admission_Id = am_pick_any.Admission_Id
           LEFT JOIN (
             SELECT batch_id, MAX(id) AS id FROM fees_structure
             WHERE deleted = 0 OR deleted IS NULL GROUP BY batch_id
           ) latest_fs ON latest_fs.batch_id = bm.Batch_Id
           LEFT JOIN fees_structure fs ON fs.id = latest_fs.id
           LEFT JOIN (
             SELECT Student_Id,
               SUM(CASE WHEN TypeR = 'C' THEN COALESCE(Total_Amt, Amount, 0) ELSE 0 END) AS paid,
               SUM(CASE WHEN TypeR = 'D' THEN COALESCE(Total_Amt, Amount, 0) ELSE 0 END) AS posted_debit,
               MAX(CASE WHEN TypeR = 'D' AND LOWER(IFNULL(Notes, '')) LIKE '%one time membership fees%' THEN 1 ELSE 0 END) AS has_membership_debit
             FROM s_fees_mst
             WHERE (IsDelete = 0 OR IsDelete IS NULL)
             GROUP BY Student_Id
           ) ledger ON ledger.Student_Id = sm.Student_Id
           -- Match on Student_Id alone (not + sfm.Batch_Id = bm.Batch_Id): many real
           -- fee-ledger rows carry a NULL or stale Batch_Id (e.g. cancellation
           -- waivers, legacy course-fee rows recorded under a different batch_mst
           -- row than the student's currently-resolved one), so requiring an exact
           -- Batch_Id match silently dropped transactions that DO show on the
           -- student's own Fee Details page. Fee activity belongs to the student,
           -- not to a specific batch_mst row — same principle already used by the
           -- ledger aggregation below and by /api/fee-details.
           LEFT JOIN s_fees_mst sfm
             ON sfm.Student_Id = sm.Student_Id
             AND sfm.IsDelete  = 0
             AND sfm.TypeR     = 'C'
             ${amountType ? 'AND sfm.Payment_Type = ?' : ''}
             ${fromDate   ? 'AND sfm.Date_Added >= ?' : ''}
             ${toDate     ? 'AND sfm.Date_Added <= ?' : ''}
             ${printDetails ? 'AND sfm.Print = 1' : ''}
           WHERE ${smConditions.join(' AND ')}
           ORDER BY bm.Batch_code DESC, sm.Student_Name ASC, sfm.Date_Added DESC
           LIMIT 1000`,
          [
            ...smParams,
            ...(amountType ? [amountType] : []),
            ...(fromDate   ? [fromDate]   : []),
            ...(toDate     ? [toDate]     : []),
          ]
        );

        // Mirror /api/fee-details' exact Total Fees / Total Paid formula so this
        // report's numbers match the per-student Fee Details page precisely.
        const parseFee = (v: any) => Number(String(v ?? '').replace(/,/g, '')) || 0;
        const MEMBERSHIP_FEE = 899;
        const rowsWithExact = rows.map((r) => {
          const tuition = parseFee(r.Admission_Fees) || Number(r.Resolved_Batch_Fee) || 0;
          const postedDebit = Number(r.Ledger_Posted_Debit ?? 0);
          const paid = Number(r.Ledger_Paid ?? 0);
          const membership = tuition > 0 && !Number(r.Ledger_Has_Membership_Debit ?? 0) ? MEMBERSHIP_FEE : 0;
          return {
            ...r,
            Total_Fees_Exact: tuition + postedDebit + membership,
            Total_Paid_Exact: paid,
          };
        });
        return NextResponse.json({ rows: rowsWithExact });
      }

      // ── Fees Record (individual) ─────────────────────────────────
      if (subTab === 'fees-record') {
        const conditions = [`sfm.IsDelete = 0`, `sfm.TypeR = 'C'`];
        const params: any[] = [];
        if (fromDate)   { conditions.push(`sfm.Date_Added >= ?`);    params.push(fromDate); }
        if (toDate)     { conditions.push(`sfm.Date_Added <= ?`);    params.push(toDate); }
        if (printDetails) { conditions.push(`sfm.Print = 1`); }
        if (courseId)   { conditions.push(`sfm.Course_Id = ?`);      params.push(Number(courseId)); }
        if (batchId)    { conditions.push(`sfm.Batch_Id = ?`);       params.push(Number(batchId)); }
        if (amountType) { conditions.push(`sfm.Payment_Type = ?`);   params.push(amountType); }

        const [rows] = await pool.query(
          `SELECT
             sfm.Fees_Id, sfm.Fees_Code, sfm.Date_Added, sfm.RDate, sfm.Student_Id,
             sfm.Payment_Type, sfm.Cheque_No, sfm.Cheque_Bank, sfm.Cheque_Branch,
             sfm.Cheque_Date, sfm.Amount, sfm.Service_Tax, sfm.Total_Amt,
             sfm.UnPaid_Amt, sfm.Amt_Word, sfm.Notes,
             sfm.FeesMonth, sfm.FeesYear, sfm.Print,
             sfm.InvoiceCode, sfm.InvoiceDate,
             COALESCE(sm.Student_Name,'') AS Student_Name,
             COALESCE(sm.Present_Mobile,'') AS Present_Mobile,
             COALESCE(sm.Email,'') AS Email,
             COALESCE(cm.Course_Name,'') AS Course_Name,
             COALESCE(bm.Batch_code,'') AS Batch_Code,
             COALESCE(NULLIF(TRIM(sm.Transfered), ''), '') AS Transfered,
             COALESCE(sm.Moved_To_Batch_Code, '') AS Moved_To_Batch_Code,
             COALESCE(sm.Moved_From_Batch_Code, '') AS Moved_From_Batch_Code,
             COALESCE(mtc.Course_Name, '') AS Moved_To_Course_Name
           FROM s_fees_mst sfm
           LEFT JOIN student_master sm ON sm.Student_Id = sfm.Student_Id AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
           LEFT JOIN course_mst cm ON cm.Course_Id = sfm.Course_Id
           LEFT JOIN batch_mst bm ON bm.Batch_Id = sfm.Batch_Id
           LEFT JOIN course_mst mtc ON mtc.Course_Id = sm.Moved_To_Course_Id
           WHERE ${conditions.join(' AND ')}
           ORDER BY sfm.Date_Added DESC, sfm.Fees_Id DESC
           LIMIT 1000`,
          params
        );
        return NextResponse.json({ rows });
      }

      // ── Batch Wise Faculty Payment ───────────────────────────────
      if (subTab === 'batch-wise-faculty') {
        const conditions = [`fs.IsDelete = 0`];
        const params: any[] = [];
        if (fromDate)  { conditions.push(`fs.Date_Added >= ?`);               params.push(fromDate); }
        if (toDate)    { conditions.push(`fs.Date_Added <= ?`);               params.push(toDate); }
        if (courseId)  { conditions.push(`bm.Course_Id = ?`);                 params.push(Number(courseId)); }
        if (batchId)   { conditions.push(`CAST(fw.batch AS UNSIGNED) = ?`);   params.push(Number(batchId)); }

        const [rows] = await pool.query(
          `SELECT
             COALESCE(bm.Batch_code,'') AS Batch_Code,
             COALESCE(cm.Course_Name,'') AS Course_Name,
             bm.SDate AS Batch_Start, bm.EDate AS Batch_End,
             COALESCE(fm.Faculty_Name,'') AS Faculty_Name,
             fs.Faculty_Type, fs.Salary_struct,
             fs.Sal_Month, fs.Sal_Year,
             fs.Total_Hours, fs.Rate,
             fs.Salary, fs.Tot_Inc, fs.TDS, fs.Total_Ded, fs.Net_Payment,
             fs.Payment_Type, fs.Cheque_No, fs.NEFT_No,
             fs.Payment_Dt, fs.Date_Added
           FROM faculty_salary fs
           LEFT JOIN faculty_master fm ON fm.Faculty_Id = fs.Faculty_Id
           LEFT JOIN awt_facultyworking fw
             ON CAST(fw.faculty AS UNSIGNED) = fs.Faculty_Id
             AND fw.deleted = 0
           LEFT JOIN batch_mst bm ON bm.Batch_Id = CAST(fw.batch AS UNSIGNED)
           LEFT JOIN course_mst cm ON cm.Course_Id = bm.Course_Id
           WHERE ${conditions.join(' AND ')}
           ORDER BY bm.Batch_code, fm.Faculty_Name, fs.Date_Added DESC
           LIMIT 1000`,
          params
        );
        return NextResponse.json({ rows });
      }

      return NextResponse.json({ error: 'Invalid subTab' }, { status: 400 });
    }

    if (tab === 'faculty-payment') {
      // Return faculty list for dropdown
      if (searchParams.get('action') === 'faculties') {
        const [faculties] = await pool.query(
          `SELECT Faculty_Id, Faculty_Name
           FROM faculty_master
           WHERE (IsDelete = 0 OR IsDelete IS NULL)
           ORDER BY Faculty_Name`
        );
        return NextResponse.json({ faculties });
      }

      const facultyId = searchParams.get('facultyId') || '';
      const conditions = [`fs.IsDelete = 0`];
      const params: any[] = [];
      if (fromDate)  { conditions.push(`fs.Date_Added >= ?`); params.push(fromDate); }
      if (toDate)    { conditions.push(`fs.Date_Added <= ?`); params.push(toDate); }
      if (facultyId) { conditions.push(`fs.Faculty_Id = ?`); params.push(Number(facultyId)); }

      const [rows] = await pool.query(
        `SELECT
           fs.Salary_Id, fs.Faculty_Id,
           COALESCE(fm.Faculty_Name,'') AS Faculty_Name,
           fs.Sal_Month, fs.Sal_Year,
           fs.Faculty_Type, fs.Salary_struct,
           fs.Rate, fs.Total_Hours, fs.Salary,
           fs.Bonus, fs.Award, fs.Other_Inc, fs.Tot_Inc,
           fs.TDS_Per, fs.TDS,
           fs.Advance, fs.Other_Ded, fs.Total_Ded, fs.Net_Payment,
           fs.Payment_Type, fs.Cheque_No, fs.NEFT_No,
           fs.Payment_Dt, fs.Date_Added, fs.Remark
         FROM faculty_salary fs
         LEFT JOIN faculty_master fm ON fm.Faculty_Id = fs.Faculty_Id
         WHERE ${conditions.join(' AND ')}
         ORDER BY fs.Date_Added DESC, fs.Salary_Id DESC
         LIMIT 1000`,
        params
      );
      return NextResponse.json({ rows });
    }

    return NextResponse.json({ error: 'Invalid tab' }, { status: 400 });
  } catch (err: unknown) {
    console.error('[Fees Report] error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
