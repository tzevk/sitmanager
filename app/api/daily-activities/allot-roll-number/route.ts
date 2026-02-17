/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
/**
 * GET – Fetch students for roll number allotment
 *
 * Query params:
 *   courseId  – required (filter batches + students)
 *   batchId  – required (filter students in this batch)
 *   search   – optional text search
 *   page     – pagination (default 1)
 *   limit    – pagination (default 25)
 *
 * Also returns:
 *   courses – all active courses (for the dropdown)
 *   batches – batches for the selected course (for the dropdown)
 *   allocatedBatches – batches that already have roll numbers allotted
 */
// Ensure Roll_No column exists – runs once per cold start
let rollNoColumnReady = false;
async function ensureRollNoColumn(pool: any) {
  if (rollNoColumnReady) return;
  try {
    const [cols] = await pool.query(
      "SHOW COLUMNS FROM admission_master LIKE 'Roll_No'"
    );
    if (cols.length === 0) {
      await pool.query(
        `ALTER TABLE admission_master ADD COLUMN Roll_No VARCHAR(50) NULL`
      );
    }
    rollNoColumnReady = true;
  } catch {
    // If ALTER fails (permissions), mark as ready so we don't retry every request
    rollNoColumnReady = true;
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'roll_number.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    await ensureRollNoColumn(pool);
    const { searchParams } = new URL(req.url);

    const courseId = searchParams.get('courseId')?.trim() || '';
    const batchId = searchParams.get('batchId')?.trim() || '';
    const search = searchParams.get('search')?.trim() || '';
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(10, Number(searchParams.get('limit')) || 25));
    const offset = (page - 1) * limit;

    // ── Always return courses for dropdown ──
    const [courses] = await pool.query<any[]>(`
      SELECT Course_Id, Course_Name
      FROM course_mst
      WHERE (IsDelete = 0 OR IsDelete IS NULL)
        AND IsActive = 1
      ORDER BY Course_Name
    `);

    // ── Batches for selected course ──
    let batches: any[] = [];
    if (courseId) {
      const [batchRows] = await pool.query<any[]>(
        `SELECT Batch_Id, Batch_code, Category, Timings
         FROM batch_mst
         WHERE Course_Id = ?
           AND IsActive = 1
           AND (IsDelete = 0 OR IsDelete IS NULL)
           AND (Cancel = 0 OR Cancel IS NULL)
         ORDER BY Batch_Id DESC`,
        [Number(courseId)]
      );
      batches = batchRows;
    }

    // ── Allocated batches (batches that have at least one Roll_No set) ──
    const [allocatedRows] = await pool.query<any[]>(`
      SELECT DISTINCT b.Batch_Id, b.Batch_code, c.Course_Name
      FROM admission_master a
      JOIN batch_mst b ON a.Batch_Id = b.Batch_Id
      JOIN course_mst c ON b.Course_Id = c.Course_Id
      WHERE a.Roll_No IS NOT NULL AND a.Roll_No != ''
        AND (a.IsDelete = 0 OR a.IsDelete IS NULL)
        AND (a.Cancel = 0 OR a.Cancel IS NULL)
      ORDER BY b.Batch_Id DESC
      LIMIT 20
    `);

    // ── Students list (only when both course & batch selected) ──
    let rows: any[] = [];
    let total = 0;

    if (courseId && batchId) {
      const conditions: string[] = [
        'a.Batch_Id = ?',
        '(a.IsDelete = 0 OR a.IsDelete IS NULL)',
        '(a.Cancel = 0 OR a.Cancel IS NULL)',
      ];
      const params: (string | number)[] = [Number(batchId)];

      if (search) {
        conditions.push(
          `(s.Student_Name LIKE ? OR CAST(s.Student_Id AS CHAR) LIKE ? OR s.Email LIKE ?)`
        );
        const like = `%${search}%`;
        params.push(like, like, like);
      }

      const where = conditions.join(' AND ');

      // Count
      const [countRows] = await pool.query<any[]>(
        `SELECT COUNT(*) AS total
         FROM admission_master a
         JOIN student_master s ON a.Student_Id = s.Student_Id
         WHERE ${where}`,
        params
      );
      total = countRows[0]?.total ?? 0;

      // Data
      const [dataRows] = await pool.query<any[]>(
        `SELECT
          a.Admission_Id AS id,
          s.Student_Id AS studentCode,
          s.Student_Name AS studentName,
          a.Admission_Date AS admissionDate,
          b.Category AS phase,
          COALESCE(a.Roll_No, '') AS rollNo
        FROM admission_master a
        JOIN student_master s ON a.Student_Id = s.Student_Id
        JOIN batch_mst b ON a.Batch_Id = b.Batch_Id
        WHERE ${where}
        ORDER BY s.Student_Name ASC
        LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );
      rows = dataRows;
    }

    return NextResponse.json({
      courses,
      batches,
      allocatedBatches: allocatedRows,
      rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Allot Roll Number GET error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PUT – Allot roll numbers to students in a batch
 *
 * Body: { batchId: number, rollNumbers: { admissionId: number, rollNo: string }[] }
 */
export async function PUT(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'roll_number.update');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    await ensureRollNoColumn(pool);
    const body = await req.json();

    const { batchId, rollNumbers } = body as {
      batchId: number;
      rollNumbers: { admissionId: number; rollNo: string }[];
    };

    if (!batchId || !rollNumbers?.length) {
      return NextResponse.json(
        { error: 'batchId and rollNumbers are required' },
        { status: 400 }
      );
    }

    // Check for duplicate roll numbers within the batch
    const rollValues = rollNumbers
      .map((r) => r.rollNo?.trim())
      .filter(Boolean);
    const duplicates = rollValues.filter(
      (v, i) => rollValues.indexOf(v) !== i
    );
    if (duplicates.length > 0) {
      return NextResponse.json(
        { error: `Duplicate roll numbers found: ${[...new Set(duplicates)].join(', ')}` },
        { status: 400 }
      );
    }

    // Update each admission record with its roll number
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      for (const { admissionId, rollNo } of rollNumbers) {
        await conn.query(
          `UPDATE admission_master SET Roll_No = ? WHERE Admission_Id = ? AND Batch_Id = ?`,
          [rollNo?.trim() || null, admissionId, batchId]
        );
      }

      await conn.commit();
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    } finally {
      conn.release();
    }

    return NextResponse.json({ success: true, updated: rollNumbers.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Allot Roll Number PUT error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
