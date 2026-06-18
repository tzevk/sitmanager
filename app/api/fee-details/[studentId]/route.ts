/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MEMBERSHIP_FEE_AMOUNT = 899;
const MEMBERSHIP_FEE_LABEL = 'One Time Membership Fees - Sitians Alumni Association';

function parseNotes(notes: string | null): { particular: string; taxType: string } {
  if (!notes) return { particular: '', taxType: '' };
  const m = notes.match(/^(.*?)(?:\s*\|\s*Tax:\s*(CGST|SGST|IGST))?$/i);
  return { particular: (m?.[1] ?? notes).trim(), taxType: (m?.[2] ?? '').toUpperCase() };
}

async function generateReceiptNo(): Promise<string> {
  const [rows] = await getPool().query<any[]>(
    `SELECT AUTO_INCREMENT AS nextId FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 's_fees_mst'`
  );
  const nextId = Number(rows[0]?.nextId ?? 1);
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `R-${month}/${nextId}`;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ studentId: string }> }) {
  const auth = await requirePermission(req, ['report_fees.view', 'finance.view']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { studentId } = await ctx.params;
    const sid = Number(studentId);
    if (!sid) return NextResponse.json({ error: 'Invalid student id' }, { status: 400 });

    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const feesId = searchParams.get('feesId');

    const [studentRows] = await pool.query<any[]>(
      `SELECT sm.Student_Id, sm.Student_Name, sm.Present_Mobile, sm.Email,
              sm.Course_Id, cm.Course_Name, sm.Batch_Code, bm.Batch_Id,
              bm.Actual_Fees_Payment, bm.Fees_Full_Payment,
              DATE_FORMAT(bm.SDate, '%Y-%m-%d') AS Batch_SDate,
              COALESCE(NULLIF(TRIM(sm.Transfered), ''), '') AS Transfered,
              COALESCE(sm.Moved_To_Batch_Code, '') AS Moved_To_Batch_Code,
              COALESCE(mtc.Course_Name, '') AS Moved_To_Course_Name
       FROM student_master sm
       LEFT JOIN course_mst cm ON cm.Course_Id = sm.Course_Id
       LEFT JOIN batch_mst bm  ON bm.Batch_code = sm.Batch_Code AND (bm.IsDelete = 0 OR bm.IsDelete IS NULL)
       LEFT JOIN course_mst mtc ON mtc.Course_Id = sm.Moved_To_Course_Id
       WHERE sm.Student_Id = ?
       LIMIT 1`,
      [sid]
    );
    if (!studentRows.length) return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    const student = studentRows[0];

    // Fetch admission separately to get the latest record with reliable Fees + Cancel + Date
    const [admissionRows] = await pool.query<any[]>(
      `SELECT Admission_Id, Fees, Cancel,
              DATE_FORMAT(Admission_Date, '%Y-%m-%d') AS Admission_Date
       FROM admission_master
       WHERE Student_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)
       ORDER BY Admission_Id DESC
       LIMIT 1`,
      [sid]
    );
    const admission = admissionRows[0] ?? null;

    // Query fees_structure and batch fees via Batch_code to avoid Batch_Id being NULL from the JOIN
    const [feeRows] = await pool.query<any[]>(
      `SELECT fs.duedate, fs.actualfees, fs.fullfees, fs.total_inr,
              bm.Actual_Fees_Payment, bm.Fees_Full_Payment,
              DATE_FORMAT(bm.SDate, '%Y-%m-%d') AS Batch_SDate_Direct
       FROM batch_mst bm
       LEFT JOIN fees_structure fs ON fs.batch_id = bm.Batch_Id AND (fs.deleted = 0 OR fs.deleted IS NULL)
       WHERE bm.Batch_code = ? AND (bm.IsDelete = 0 OR bm.IsDelete IS NULL)
       ORDER BY bm.Batch_Id DESC, fs.id DESC
       LIMIT 1`,
      [student.Batch_Code]
    );
    const feeRow = feeRows[0] ?? null;
    const dueDate = feeRow?.duedate ?? admission?.Admission_Date ?? feeRow?.Batch_SDate_Direct ?? student.Batch_SDate ?? null;

    const [banks] = await pool.query<any[]>(
      `SELECT Id, Bank_Name FROM bank WHERE (IsDelete = 0 OR IsDelete IS NULL) ORDER BY Bank_Name`
    );

    const [ledgerRows] = await pool.query<any[]>(
      `SELECT Fees_Id, Fees_Code, Date_Added, RDate, Payment_Type, Cheque_No, Cheque_Bank, Cheque_Branch,
              Cheque_Date, Amount, Total_Amt, TypeR, Notes
       FROM s_fees_mst
       WHERE Student_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)
       ORDER BY COALESCE(RDate, Date_Added) ASC, Fees_Id ASC`,
      [sid]
    );

    const ledger = ledgerRows
      .map((r) => {
        const { particular } = parseNotes(r.Notes);
        const amt = Number(r.Total_Amt ?? r.Amount ?? 0);
        return {
          Fees_Id: r.Fees_Id,
          Date: r.RDate || r.Date_Added,
          Particular: particular,
          Payment_Type: r.Payment_Type,
          Fees_Code: r.Fees_Code,
          Debit: r.TypeR === 'D' ? amt : 0,
          Credit: r.TypeR === 'C' ? amt : 0,
        };
      })
      .filter((r) => r.Debit > 0 || r.Credit > 0);

    const totalDebit = Number(
      admission?.Fees ??
      feeRow?.actualfees ??
      feeRow?.fullfees ??
      feeRow?.total_inr ??
      feeRow?.Actual_Fees_Payment ??
      feeRow?.Fees_Full_Payment ??
      0
    );
    const totalCredit = ledger.reduce((s, r) => s + r.Credit, 0);
    const balance = totalDebit - totalCredit;

    if (student.Course_Name) {
      ledger.unshift({
        Fees_Id: 0,
        Date: dueDate,
        Particular: `Tuition Fees - ${student.Course_Name}${student.Batch_Code ? `, ${student.Batch_Code}` : ''}`,
        Payment_Type: null,
        Fees_Code: null,
        Debit: totalDebit,
        Credit: 0,
      });
    }

    const particulars = [
      {
        label: `Tuition Fees - ${student.Course_Name ?? ''}${student.Batch_Code ? `, ${student.Batch_Code}` : ''}`,
        amount: null as number | null,
        fixed: false,
      },
      { label: MEMBERSHIP_FEE_LABEL, amount: MEMBERSHIP_FEE_AMOUNT, fixed: true },
    ];

    let record: any = null;
    if (feesId) {
      const [recRows] = await pool.query<any[]>(
        `SELECT * FROM s_fees_mst WHERE Fees_Id = ? AND Student_Id = ? LIMIT 1`,
        [Number(feesId), sid]
      );
      if (recRows.length) {
        const r = recRows[0];
        const { particular, taxType } = parseNotes(r.Notes);
        record = {
          Fees_Id: r.Fees_Id,
          Type: r.TypeR === 'D' ? 'Debit' : 'Credit',
          Fees_Code: r.Fees_Code,
          Payment_Type: r.Payment_Type,
          Cheque_Bank: r.Cheque_Bank,
          Cheque_No: r.Cheque_No,
          Cheque_Date: r.Cheque_Date,
          Cheque_Branch: r.Cheque_Branch,
          Amount: r.Amount,
          Particular: particular,
          TaxType: taxType,
          RDate: r.RDate,
        };
      }
    }

    return NextResponse.json({
      student: {
        Student_Id: student.Student_Id,
        Student_Name: student.Student_Name,
        Course_Id: student.Course_Id,
        Course_Name: student.Course_Name,
        Batch_Code: student.Batch_Code,
        Batch_Id: student.Batch_Id,
        Present_Mobile: student.Present_Mobile,
        Email: student.Email,
        Admission_Id: admission?.Admission_Id ?? null,
        Transfered: student.Transfered || '',
        Moved_To_Batch_Code: student.Moved_To_Batch_Code || '',
        Moved_To_Course_Name: student.Moved_To_Course_Name || '',
        Cancel: Number(admission?.Cancel ?? 0) === 1,
      },
      dueDate,
      banks,
      particulars,
      ledger,
      totals: { debit: totalDebit, credit: totalCredit, balance },
      nextReceiptNo: record?.Fees_Code ?? (await generateReceiptNo()),
      record,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ studentId: string }> }) {
  const auth = await requirePermission(req, ['report_fees.update', 'finance.update']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { studentId } = await ctx.params;
    const sid = Number(studentId);
    if (!sid) return NextResponse.json({ error: 'Invalid student id' }, { status: 400 });

    const body = await req.json();
    const {
      Type, Payment_Type, Cheque_Bank, Cheque_No, Cheque_Date, Cheque_Branch,
      Amount, Particular, RDate, TaxType, Fees_Code: customFeesCode,
    } = body;

    if (!Amount || !RDate) {
      return NextResponse.json({ error: 'Amount and Receipt Date are required' }, { status: 400 });
    }

    const pool = getPool();
    const [studentRows] = await pool.query<any[]>(
      `SELECT sm.Student_Id, sm.Course_Id, bm.Batch_Id, am.Admission_Id
       FROM student_master sm
       LEFT JOIN batch_mst bm ON bm.Batch_code = sm.Batch_Code
       LEFT JOIN admission_master am ON am.Student_Id = sm.Student_Id AND (am.IsDelete = 0 OR am.IsDelete IS NULL)
       WHERE sm.Student_Id = ? LIMIT 1`,
      [sid]
    );
    if (!studentRows.length) return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    const student = studentRows[0];

    const typeR = Type === 'Debit' ? 'D' : 'C';
    const now = new Date();
    const amount = Number(Amount);

    const mkNotes = (particular: string, txTaxType?: string | null) =>
      txTaxType ? `${particular} | Tax: ${txTaxType}` : particular;

    const insertFeeRow = async (rowAmount: number, rowParticular: string, txTaxType?: string | null, forcedFeesCode?: string | null) => {
      const [result] = await pool.query<any>(
        `INSERT INTO s_fees_mst
          (Student_Id, Course_Id, Batch_Id, Admission_Id, Payment_Type, Cheque_Bank, Cheque_No,
           Cheque_Date, Cheque_Branch, Amount, Total_Amt, TypeR, Notes, RDate, Date_Added,
           FeesMonth, FeesYear, IsDelete)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)`,
        [
          sid, student.Course_Id, student.Batch_Id, student.Admission_Id,
          Payment_Type ?? null, Cheque_Bank ?? null, Cheque_No ?? null,
          Cheque_Date || null, Cheque_Branch ?? null, rowAmount, rowAmount, typeR, mkNotes(rowParticular, txTaxType),
          RDate, now, now.getMonth() + 1, now.getFullYear(),
        ]
      );

      const insertedId = Number(result.insertId);
      const feesCode = (typeof forcedFeesCode === 'string' && forcedFeesCode.trim())
        ? forcedFeesCode.trim()
        : `R-${String(now.getMonth() + 1).padStart(2, '0')}/${String(insertedId).padStart(3, '0')}`;
      await pool.query(`UPDATE s_fees_mst SET Fees_Code = ? WHERE Fees_Id = ?`, [feesCode, insertedId]);
      return { Fees_Id: insertedId, Fees_Code: feesCode };
    };

    const baseParticular = String(Particular ?? '').trim();
    const isTuitionCredit =
      typeR === 'C'
      && /^tuition\s+fees\s*-/i.test(baseParticular)
      && !/one\s*time\s+membership\s+fees/i.test(baseParticular)
      && amount >= MEMBERSHIP_FEE_AMOUNT;

    if (isTuitionCredit) {
      const alumniAmount = Math.min(MEMBERSHIP_FEE_AMOUNT, amount);
      const tuitionAmount = amount - alumniAmount;
      const createdRows: Array<{ Fees_Id: number; Fees_Code: string; particular: string; amount: number }> = [];

      if (tuitionAmount > 0) {
        const tuitionRow = await insertFeeRow(
          tuitionAmount,
          baseParticular,
          TaxType || null,
          typeof customFeesCode === 'string' ? customFeesCode : null,
        );
        createdRows.push({ ...tuitionRow, particular: baseParticular, amount: tuitionAmount });
      }

      if (alumniAmount > 0) {
        const alumniRow = await insertFeeRow(
          alumniAmount,
          MEMBERSHIP_FEE_LABEL,
          null,
          null,
        );
        createdRows.push({ ...alumniRow, particular: MEMBERSHIP_FEE_LABEL, amount: alumniAmount });
      }

      const primary = createdRows[0];
      return NextResponse.json({ success: true, Fees_Id: primary?.Fees_Id ?? null, Fees_Code: primary?.Fees_Code ?? null, splitTransactions: createdRows });
    }

    const created = await insertFeeRow(
      amount,
      baseParticular,
      TaxType || null,
      typeof customFeesCode === 'string' ? customFeesCode : null,
    );

    return NextResponse.json({ success: true, Fees_Id: created.Fees_Id, Fees_Code: created.Fees_Code });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Server error' }, { status: 500 });
  }
}
