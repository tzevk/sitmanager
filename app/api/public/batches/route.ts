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
      const [rows] = await pool.query<(RowDataPacket & { totalFees: number | null; feesFullPayment: number | null; feesInstallment: number | null })[]>(
        `SELECT INR_Total AS totalFees, Fees_Full_Payment AS feesFullPayment, Fees_Installment_Payment AS feesInstallment
         FROM batch_mst WHERE Batch_code = ? AND IsActive = 1 AND (IsDelete = 0 OR IsDelete IS NULL) LIMIT 1`,
        [batchCode]
      );
      return NextResponse.json({
        success: true,
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
         WHERE Course_Id = ? AND IsActive = 1 AND (IsDelete = 0 OR IsDelete IS NULL)
           AND Category IS NOT NULL AND Category != ''
           AND LOWER(Category) NOT LIKE '%corporate%'
           AND (Cancel IS NULL OR Cancel = 0)
           AND (
             (Admission_Date IS NOT NULL AND Admission_Date >= CURDATE())
             OR (Admission_Date IS NULL AND SDate IS NOT NULL AND SDate >= CURDATE())
           )
         ORDER BY Category ASC`,
        [courseId]
      );
      return NextResponse.json({ success: true, categories: cats.map((r) => r.category), batches: [] });
    }

    // Return batch codes for this course + category (including total fees)
    // Only show batches where admission is still open or start date is upcoming
    const [batches] = await pool.query<(RowDataPacket & { batchCode: string; timings: string | null; totalFees: number | null; feesFullPayment: number | null; feesInstallment: number | null })[]>(
      `SELECT Batch_code AS batchCode, Timings AS timings, INR_Total AS totalFees,
              Fees_Full_Payment AS feesFullPayment, Fees_Installment_Payment AS feesInstallment
       FROM batch_mst
       WHERE Course_Id = ? AND Category = ? AND IsActive = 1 AND (IsDelete = 0 OR IsDelete IS NULL)
         AND (Cancel IS NULL OR Cancel = 0)
         AND (
           (Admission_Date IS NOT NULL AND Admission_Date >= CURDATE())
           OR (Admission_Date IS NULL AND SDate IS NOT NULL AND SDate >= CURDATE())
         )
       ORDER BY Batch_Id DESC`,
      [courseId, category]
    );
    return NextResponse.json({ success: true, categories: [], batches });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
