/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, ['report_fees.view', 'finance.view']);
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
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
           COALESCE(bm.Batch_code,'') AS Batch_Code
         FROM s_fees_mst sfm
         LEFT JOIN student_master sm ON sm.Student_Id = sfm.Student_Id AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
         LEFT JOIN course_mst cm ON cm.Course_Id = sfm.Course_Id
         LEFT JOIN batch_mst bm ON bm.Batch_Id = sfm.Batch_Id
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
        const conditions = [`sfm.IsDelete = 0`, `sfm.TypeR = 'C'`];
        const params: any[] = [];
        if (fromDate)   { conditions.push(`sfm.Date_Added >= ?`);    params.push(fromDate); }
        if (toDate)     { conditions.push(`sfm.Date_Added <= ?`);    params.push(toDate); }
        if (printDetails) { conditions.push(`sfm.Print = 1`); }
        if (courseId)   { conditions.push(`sfm.Course_Id = ?`);      params.push(Number(courseId)); }
        if (batchId)    { conditions.push(`sfm.Batch_Id = ?`);       params.push(Number(batchId)); }
        if (amountType) { conditions.push(`sfm.Payment_Type = ?`);   params.push(amountType); }

        // Start from admission_master so all enrolled students appear,
        // even those who have not yet made a payment.
        const amConditions: string[] = [
          '(am.IsDelete = 0 OR am.IsDelete IS NULL)',
          '(am.Cancel = 0 OR am.Cancel IS NULL)',
        ];
        const amParams: any[] = [];
        if (courseId) { amConditions.push('bm.Course_Id = ?');  amParams.push(Number(courseId)); }
        if (batchId)  { amConditions.push('am.Batch_Id = ?');   amParams.push(Number(batchId)); }

        const [rows] = await pool.query(
          `SELECT
             COALESCE(bm.Batch_code,'') AS Batch_Code,
             COALESCE(cm.Course_Name,'') AS Course_Name,
             bm.SDate AS Batch_Start, bm.EDate AS Batch_End,
             COALESCE(sm.Student_Name, CONCAT_WS(' ', sm.FName, sm.MName, sm.LName), '') AS Student_Name,
             COALESCE(sm.Present_Mobile,'') AS Present_Mobile,
             sfm.Fees_Id, sfm.Fees_Code, sfm.Date_Added, sfm.RDate,
             sfm.Payment_Type, sfm.Cheque_No, sfm.Cheque_Bank, sfm.Cheque_Branch,
             sfm.Cheque_Date, sfm.Amount, sfm.Service_Tax, sfm.Total_Amt,
             sfm.UnPaid_Amt, sfm.Amt_Word, sfm.Notes,
             sfm.FeesMonth, sfm.FeesYear, sfm.Print
           FROM admission_master am
           LEFT JOIN student_master sm
             ON sm.Student_Id = am.Student_Id
             AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
           LEFT JOIN batch_mst bm ON bm.Batch_Id = am.Batch_Id
           LEFT JOIN course_mst cm ON cm.Course_Id = bm.Course_Id
           LEFT JOIN s_fees_mst sfm
             ON sfm.Student_Id = am.Student_Id
             AND sfm.Batch_Id  = am.Batch_Id
             AND sfm.IsDelete  = 0
             AND sfm.TypeR     = 'C'
             ${amountType ? 'AND sfm.Payment_Type = ?' : ''}
             ${fromDate   ? 'AND sfm.Date_Added >= ?' : ''}
             ${toDate     ? 'AND sfm.Date_Added <= ?' : ''}
             ${printDetails ? 'AND sfm.Print = 1' : ''}
           WHERE ${amConditions.join(' AND ')}
           ORDER BY bm.Batch_code DESC, sm.Student_Name ASC, sfm.Date_Added DESC
           LIMIT 1000`,
          [
            ...amParams,
            ...(amountType ? [amountType] : []),
            ...(fromDate   ? [fromDate]   : []),
            ...(toDate     ? [toDate]     : []),
          ]
        );
        return NextResponse.json({ rows });
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
             sfm.Fees_Id, sfm.Fees_Code, sfm.Date_Added, sfm.RDate,
             sfm.Payment_Type, sfm.Cheque_No, sfm.Cheque_Bank, sfm.Cheque_Branch,
             sfm.Cheque_Date, sfm.Amount, sfm.Service_Tax, sfm.Total_Amt,
             sfm.UnPaid_Amt, sfm.Amt_Word, sfm.Notes,
             sfm.FeesMonth, sfm.FeesYear, sfm.Print,
             sfm.InvoiceCode, sfm.InvoiceDate,
             COALESCE(sm.Student_Name,'') AS Student_Name,
             COALESCE(sm.Present_Mobile,'') AS Present_Mobile,
             COALESCE(sm.Email,'') AS Email,
             COALESCE(cm.Course_Name,'') AS Course_Name,
             COALESCE(bm.Batch_code,'') AS Batch_Code
           FROM s_fees_mst sfm
           LEFT JOIN student_master sm ON sm.Student_Id = sfm.Student_Id AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
           LEFT JOIN course_mst cm ON cm.Course_Id = sfm.Course_Id
           LEFT JOIN batch_mst bm ON bm.Batch_Id = sfm.Batch_Id
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
