import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

// Public endpoint — no auth required (used by online admission form)
export async function GET(req: NextRequest) {
  try {
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get('courseId');
    const category = searchParams.get('category');
    const batchCode = searchParams.get('batchCode');

    // Lookup fees for a specific batch code
    if (batchCode) {
      const [rows] = await pool.query<(RowDataPacket & { category: string | null; courseId: number | null; totalFees: number | null; feesFullPayment: number | null; feesInstallment: number | null })[]>(
        `SELECT
           Category AS category,
           Course_Id AS courseId,
           COALESCE(Actual_Fees_Payment, INR_Total, INR_Basic + COALESCE(INR_ServiceTax, 0)) AS totalFees,
           COALESCE(Fees_Full_Payment, Actual_Fees_Payment, INR_Total, INR_Basic + COALESCE(INR_ServiceTax, 0)) AS feesFullPayment,
           COALESCE(Fees_Installment_Payment, Actual_Fees_Payment, INR_Total, INR_Basic + COALESCE(INR_ServiceTax, 0)) AS feesInstallment
         FROM batch_mst
         WHERE Batch_code = ? AND (IsDelete = 0 OR IsDelete IS NULL)
         ORDER BY COALESCE(IsActive, 0) DESC, COALESCE(Admission_Date, SDate, Date_Added) DESC, Batch_Id DESC
         LIMIT 1`,
        [batchCode]
      );
      return NextResponse.json({
        success: true,
        category: rows[0]?.category ?? null,
        courseId: rows[0]?.courseId ?? null,
        totalFees: rows[0]?.totalFees ?? null,
        feesFullPayment: rows[0]?.feesFullPayment ?? null,
        feesInstallment: rows[0]?.feesInstallment ?? null,
      });
    }

    if (!courseId) {
      return NextResponse.json({ success: true, categories: [], batches: [] });
    }

    // If no category yet, return distinct categories for this course
    if (!category) {
      const [cats] = await pool.query<(RowDataPacket & { category: string })[]>(
        `SELECT DISTINCT Category AS category
         FROM batch_mst
         WHERE Course_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)
           AND Category IS NOT NULL AND Category != ''
           AND LOWER(Category) NOT LIKE '%corporate%'
           AND (Cancel IS NULL OR Cancel = 0)
         ORDER BY Category ASC`,
        [courseId]
      );
      return NextResponse.json({ success: true, categories: cats.map((r) => r.category), batches: [] });
    }

    // Return batch codes for this course + category (including total fees)
    // Only show batches where admission is still open or start date is upcoming
    const [batches] = await pool.query<(RowDataPacket & { batchCode: string; timings: string | null; totalFees: number | null; feesFullPayment: number | null; feesInstallment: number | null })[]>(
      `SELECT Batch_code AS batchCode, Timings AS timings,
              COALESCE(Actual_Fees_Payment, INR_Total, INR_Basic + COALESCE(INR_ServiceTax, 0)) AS totalFees,
              COALESCE(Fees_Full_Payment, Actual_Fees_Payment, INR_Total, INR_Basic + COALESCE(INR_ServiceTax, 0)) AS feesFullPayment,
              COALESCE(Fees_Installment_Payment, Actual_Fees_Payment, INR_Total, INR_Basic + COALESCE(INR_ServiceTax, 0)) AS feesInstallment
       FROM batch_mst
       WHERE Course_Id = ? AND Category = ? AND (IsDelete = 0 OR IsDelete IS NULL)
         AND (Cancel IS NULL OR Cancel = 0)
       ORDER BY COALESCE(IsActive, 0) DESC, COALESCE(Admission_Date, SDate, Date_Added) DESC, Batch_Id DESC`,
      [courseId, category]
    );
    return NextResponse.json({ success: true, categories: [], batches });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
