/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

let inquiryTableNameCache: string | null = null;
async function resolveInquiryTableName(pool: ReturnType<typeof getPool>): Promise<string> {
  if (inquiryTableNameCache) return inquiryTableNameCache;
  const [rows] = await pool.query(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND LOWER(TABLE_NAME) = 'student_inquiry'
     ORDER BY CASE WHEN TABLE_NAME = 'Student_Inquiry' THEN 0 ELSE 1 END
     LIMIT 1`
  );
  inquiryTableNameCache = String((rows as any[])[0]?.TABLE_NAME || '').trim() || 'Student_Inquiry';
  return inquiryTableNameCache;
}
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
    const inquiryTable = await resolveInquiryTableName(pool);
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
        `SELECT
           b.Batch_Id,
           b.Batch_code,
           b.Category,
           b.Timings,
           (
             (
               SELECT COUNT(DISTINCT a.Student_Id)
               FROM admission_master a
               WHERE a.Batch_Id = b.Batch_Id
                 AND (a.IsDelete = 0 OR a.IsDelete IS NULL)
                 AND (a.Cancel = 0 OR a.Cancel IS NULL)
             )
             +
             (
               SELECT COUNT(DISTINCT sm.Student_Id)
               FROM student_master sm
               WHERE TRIM(sm.Batch_Code) = TRIM(b.Batch_code)
                 AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
                 AND NOT EXISTS (
                   SELECT 1
                   FROM admission_master a2
                   WHERE a2.Student_Id = sm.Student_Id
                     AND a2.Batch_Id = b.Batch_Id
                     AND (a2.IsDelete = 0 OR a2.IsDelete IS NULL)
                     AND (a2.Cancel = 0 OR a2.Cancel IS NULL)
                 )
             )
           ) AS StudentCount
         FROM batch_mst b
         WHERE b.Course_Id = ?
           AND (b.IsDelete = 0 OR b.IsDelete IS NULL)
         ORDER BY b.Batch_Id DESC`,
        [Number(courseId)]
      );
      batches = batchRows;
    }

    // ── Allocated batches (batches that have at least one Roll_No set) ──
    const [allocatedRows] = await pool.query<any[]>(`
      SELECT DISTINCT b.Batch_Id, b.Batch_code, b.Course_Id, c.Course_Name
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
      // Auto-create admission_master records for students linked via student_master.Batch_Code
      // who were admitted through the CRM/inquiry flow without a formal enrollment record.
      const [batchCodeRows] = await pool.query<any[]>(
        `SELECT Batch_code FROM batch_mst WHERE Batch_Id = ? LIMIT 1`,
        [Number(batchId)]
      );
      const thisBatchCode = batchCodeRows[0]?.Batch_code;

      if (thisBatchCode) {
        const [unrolledStudents] = await pool.query<any[]>(
          `SELECT s.Student_Id
           FROM student_master s
           WHERE TRIM(s.Batch_Code) = TRIM(?)
             AND (s.IsDelete = 0 OR s.IsDelete IS NULL)
             AND NOT EXISTS (
               SELECT 1 FROM admission_master a2
               WHERE a2.Student_Id = s.Student_Id
                 AND a2.Batch_Id = ?
                 AND (a2.IsDelete = 0 OR a2.IsDelete IS NULL)
                 AND (a2.Cancel = 0 OR a2.Cancel IS NULL)
             )`,
          [thisBatchCode, Number(batchId)]
        );
        for (const student of unrolledStudents as any[]) {
          await pool.query(
            `INSERT INTO admission_master (Student_Id, Batch_Id, Admission_Date, IsActive, Cancel, IsDelete)
             VALUES (?, ?, CURDATE(), 1, 0, 0)`,
            [student.Student_Id, Number(batchId)]
          );
        }
      }

      const conditions: string[] = [
        'a.Batch_Id = ?',
        '(a.IsDelete = 0 OR a.IsDelete IS NULL)',
        '(a.Cancel = 0 OR a.Cancel IS NULL)',
      ];
      const params: (string | number)[] = [Number(batchId)];

      if (search) {
        conditions.push(
          `(COALESCE(NULLIF(TRIM(s.Student_Name),''), NULLIF(TRIM(si.Student_Name),'')) LIKE ?
            OR CAST(COALESCE(s.Student_Id, a.Student_Id, a.Student_Code) AS CHAR) LIKE ?
            OR COALESCE(s.Email, si.Email, '') LIKE ?)`
        );
        const like = `%${search}%`;
        params.push(like, like, like);
      }

      const where = conditions.join(' AND ');

      // Count — use deduped subquery for Student_Inquiry to avoid inflated count
      // when a student has multiple inquiry records.
      const [countRows] = await pool.query<any[]>(
        `SELECT COUNT(*) AS total
         FROM admission_master a
         LEFT JOIN student_master s ON a.Student_Id = s.Student_Id
         LEFT JOIN (
           SELECT Student_Id,
                  MAX(Student_Name) AS Student_Name,
                  MAX(Email)        AS Email
           FROM \`${inquiryTable}\`
           WHERE (IsDelete = 0 OR IsDelete IS NULL)
           GROUP BY Student_Id
         ) si ON si.Student_Id = a.Student_Id
         WHERE ${where}`,
        params
      );
      total = countRows[0]?.total ?? 0;

      // Data — same deduped subquery for Student_Inquiry
      const [dataRows] = await pool.query<any[]>(
        `SELECT
          a.Admission_Id AS id,
          COALESCE(s.Student_Id, a.Student_Id, a.Student_Code) AS studentCode,
          COALESCE(
            NULLIF(TRIM(s.Student_Name),''),
            NULLIF(TRIM(si.Student_Name),''),
            CONCAT('Student ', CAST(COALESCE(a.Student_Id, a.Student_Code, a.Admission_Id) AS CHAR))
          ) AS studentName,
          COALESCE(a.Admission_Date, s.Admission_Dt, s.Inquiry_Dt) AS admissionDate,
          COALESCE(NULLIF(TRIM(a.Phase), ''), NULLIF(TRIM(b.Category), ''), 'Not Set') AS phase,
          COALESCE(a.Roll_No, '') AS rollNo
        FROM admission_master a
        LEFT JOIN student_master s ON a.Student_Id = s.Student_Id
        LEFT JOIN (
          SELECT Student_Id,
                 MAX(Student_Name) AS Student_Name,
                 MAX(Email)        AS Email
          FROM \`${inquiryTable}\`
          WHERE (IsDelete = 0 OR IsDelete IS NULL)
          GROUP BY Student_Id
        ) si ON si.Student_Id = a.Student_Id
        JOIN batch_mst b ON a.Batch_Id = b.Batch_Id
        WHERE ${where}
        ORDER BY COALESCE(
          NULLIF(TRIM(s.Student_Name),''),
          NULLIF(TRIM(si.Student_Name),''),
          CONCAT('Student ', CAST(COALESCE(a.Student_Id, a.Student_Code, a.Admission_Id) AS CHAR))
        ) ASC
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

    // Basic format validation: YY + batchNo + seq (digits only, ends with a sequence)
    // Backward compatible: accepts legacy 3-digit seq (001) and new 4-digit seq (0001).
    const invalid = rollValues.filter((v) => !/^\d{2}\d+\d{3,4}$/.test(v));
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Invalid roll number format: ${invalid.slice(0, 10).join(', ')}. Expected YY + batchNo + 0001 (digits only, ending in 3 or 4 digits).` },
        { status: 400 }
      );
    }

    const duplicates = rollValues.filter(
      (v, i) => rollValues.indexOf(v) !== i
    );
    if (duplicates.length > 0) {
      return NextResponse.json(
        { error: `Duplicate roll numbers found: ${[...new Set(duplicates)].join(', ')}` },
        { status: 400 }
      );
    }

    // Detect duplicates already present in DB for the same batch (important when saving page-by-page)
    if (rollValues.length > 0) {
      const admissionIds = rollNumbers.map((r) => Number(r.admissionId)).filter((n) => Number.isFinite(n));
      const inPlaceholders = rollValues.map(() => '?').join(',');
      const idPlaceholders = admissionIds.map(() => '?').join(',');

      const [existing] = await pool.query<any[]>(
        `SELECT Admission_Id, Roll_No
         FROM admission_master
         WHERE Batch_Id = ?
           AND Roll_No IN (${inPlaceholders})
           AND (Admission_Id NOT IN (${idPlaceholders || '0'}))`,
        [batchId, ...rollValues, ...(admissionIds.length ? admissionIds : [0])]
      );

      if (existing.length > 0) {
        const existingRolls = [...new Set(existing.map((r) => String(r.Roll_No)).filter(Boolean))];
        return NextResponse.json(
          { error: `Roll number(s) already allocated in this batch: ${existingRolls.join(', ')}` },
          { status: 400 }
        );
      }
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
