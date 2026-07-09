/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { ensureInstallmentPlanTable, defaultInstallmentCount } from '@/lib/student-installments';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'student.view');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await ctx.params;
    const studentId = Number(id);
    if (!studentId) return NextResponse.json({ error: 'Invalid student id' }, { status: 400 });

    const pool = getPool();
    await ensureInstallmentPlanTable(pool);

    const [rows] = await pool.query(
      `SELECT Installment_Id, Student_Id, Admission_Id, Installment_No, Due_Date, Amount,
              Status, Paid_Date, Paid_Fees_Id, Notes
       FROM student_installment_plan
       WHERE Student_Id = ? AND IsDelete = 0
       ORDER BY Installment_No ASC`,
      [studentId]
    ) as [any[], any];

    return NextResponse.json({ installments: rows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST — either { action: 'generate' } to auto-build the schedule from the
// student's admission (Payment_Type decides the installment count, batch fee
// decides the total split evenly), or { dueDate, amount, notes } to append one
// manual installment onto an existing plan.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'student.update');
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await ctx.params;
    const studentId = Number(id);
    if (!studentId) return NextResponse.json({ error: 'Invalid student id' }, { status: 400 });

    const pool = getPool();
    await ensureInstallmentPlanTable(pool);
    const body = await req.json().catch(() => ({}));

    const [existing] = await pool.query(
      `SELECT Installment_Id FROM student_installment_plan WHERE Student_Id = ? AND IsDelete = 0`,
      [studentId]
    ) as [any[], any];

    if (body?.action === 'generate') {
      if (existing.length > 0) {
        return NextResponse.json({ error: 'An installment schedule already exists for this student' }, { status: 400 });
      }

      const [admRows] = await pool.query(
        `SELECT a.Admission_Id, a.Payment_Type, a.Admission_Date,
                COALESCE(NULLIF(a.Fees, 0), b.Fees_Full_Payment, b2.Fees_Full_Payment, 0) AS TotalFees
         FROM student_master s
         LEFT JOIN admission_master a
           ON a.Student_Id = s.Student_Id AND (a.IsDelete = 0 OR a.IsDelete IS NULL)
           AND a.Admission_Id = (
             SELECT MAX(a2.Admission_Id) FROM admission_master a2
             WHERE a2.Student_Id = s.Student_Id AND (a2.IsDelete = 0 OR a2.IsDelete IS NULL)
           )
         LEFT JOIN batch_mst b ON b.Batch_Id = a.Batch_Id
         LEFT JOIN batch_mst b2 ON b2.Batch_code = s.Batch_Code AND (b2.IsDelete = 0 OR b2.IsDelete IS NULL)
         WHERE s.Student_Id = ? AND (s.IsDelete = 0 OR s.IsDelete IS NULL)
         LIMIT 1`,
        [studentId]
      ) as [any[], any];

      const adm = admRows[0];
      if (!adm) return NextResponse.json({ error: 'Student or admission not found' }, { status: 404 });

      const totalFees = Number(adm.TotalFees || 0);
      if (totalFees <= 0) {
        return NextResponse.json({ error: 'No fee amount on file for this batch — enter installments manually' }, { status: 400 });
      }

      const count = defaultInstallmentCount(adm.Payment_Type);
      const baseAmount = Math.floor((totalFees / count) * 100) / 100;
      const lastAmount = Math.round((totalFees - baseAmount * (count - 1)) * 100) / 100;
      const startDate = adm.Admission_Date ? new Date(adm.Admission_Date) : new Date();

      const values: any[] = [];
      for (let i = 0; i < count; i++) {
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + i);
        const amount = i === count - 1 ? lastAmount : baseAmount;
        values.push([studentId, adm.Admission_Id ?? null, i + 1, dueDate.toISOString().slice(0, 10), amount, 'Pending']);
      }

      await pool.query(
        `INSERT INTO student_installment_plan
           (Student_Id, Admission_Id, Installment_No, Due_Date, Amount, Status)
         VALUES ?`,
        [values]
      );

      const [rows] = await pool.query(
        `SELECT Installment_Id, Student_Id, Admission_Id, Installment_No, Due_Date, Amount,
                Status, Paid_Date, Paid_Fees_Id, Notes
         FROM student_installment_plan
         WHERE Student_Id = ? AND IsDelete = 0
         ORDER BY Installment_No ASC`,
        [studentId]
      );
      return NextResponse.json({ installments: rows });
    }

    // Manual single-installment add.
    const dueDate = String(body?.dueDate ?? '').trim() || null;
    const amount = Number(body?.amount ?? 0);
    if (!(amount > 0)) return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });

    const [admRows] = await pool.query(
      `SELECT Admission_Id FROM admission_master
       WHERE Student_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)
       ORDER BY Admission_Id DESC LIMIT 1`,
      [studentId]
    ) as [any[], any];
    const admissionId = admRows[0]?.Admission_Id ?? null;

    const [maxNoRows] = await pool.query(
      `SELECT COALESCE(MAX(Installment_No), 0) AS maxNo FROM student_installment_plan WHERE Student_Id = ? AND IsDelete = 0`,
      [studentId]
    ) as [any[], any];
    const nextNo = Number(maxNoRows[0]?.maxNo ?? 0) + 1;

    await pool.query(
      `INSERT INTO student_installment_plan
         (Student_Id, Admission_Id, Installment_No, Due_Date, Amount, Status, Notes)
       VALUES (?, ?, ?, ?, ?, 'Pending', ?)`,
      [studentId, admissionId, nextNo, dueDate, amount, String(body?.notes ?? '').trim() || null]
    );

    const [rows] = await pool.query(
      `SELECT Installment_Id, Student_Id, Admission_Id, Installment_No, Due_Date, Amount,
              Status, Paid_Date, Paid_Fees_Id, Notes
       FROM student_installment_plan
       WHERE Student_Id = ? AND IsDelete = 0
       ORDER BY Installment_No ASC`,
      [studentId]
    );
    return NextResponse.json({ installments: rows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
