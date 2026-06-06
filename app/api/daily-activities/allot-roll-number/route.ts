/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

// Track Roll_No column state — checked once per cold start
let rollNoColumnReady = false;
let rollNoColumnExists = false;

async function ensureRollNoColumn(pool: ReturnType<typeof getPool>) {
  if (rollNoColumnReady) return;
  try {
    const [cols] = await pool.query(
      "SHOW COLUMNS FROM admission_master LIKE 'Roll_No'"
    );
    if ((cols as any[]).length > 0) {
      rollNoColumnExists = true;
    } else {
      try {
        await pool.query(
          `ALTER TABLE admission_master ADD COLUMN Roll_No VARCHAR(50) NULL`
        );
        rollNoColumnExists = true;
      } catch {
        // No ALTER TABLE permission — column will be omitted from queries
        rollNoColumnExists = false;
      }
    }
  } catch {
    rollNoColumnExists = false;
  }
  rollNoColumnReady = true;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'roll_number.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    await ensureRollNoColumn(pool);
    const { searchParams } = new URL(req.url);

    const courseId = searchParams.get('courseId')?.trim() || '';
    const batchId  = searchParams.get('batchId')?.trim()  || '';
    const search   = searchParams.get('search')?.trim()   || '';
    const page     = Math.max(1, Number(searchParams.get('page'))  || 1);
    const limit    = Math.min(100, Math.max(10, Number(searchParams.get('limit')) || 25));
    const offset   = (page - 1) * limit;

    // ── Courses dropdown ───────────────────────────────────────────────────
    const [courses] = await pool.query<any[]>(
      `SELECT Course_Id, Course_Name
       FROM course_mst
       WHERE (IsDelete = 0 OR IsDelete IS NULL)
       ORDER BY Course_Name`
    );

    // ── Batches for selected course (simple COUNT from admission_master) ───
    let batches: any[] = [];
    if (courseId) {
      const [batchRows] = await pool.query<any[]>(
        `SELECT
           b.Batch_Id,
           b.Batch_code,
           b.Category,
           b.Timings,
           COUNT(DISTINCT a.Student_Id) AS StudentCount
         FROM batch_mst b
         LEFT JOIN admission_master a
           ON a.Batch_Id = b.Batch_Id
           AND (a.IsDelete = 0 OR a.IsDelete IS NULL)
           AND (a.Cancel   = 0 OR a.Cancel   IS NULL)
         WHERE b.Course_Id = ?
           AND (b.IsDelete = 0 OR b.IsDelete IS NULL)
         GROUP BY b.Batch_Id, b.Batch_code, b.Category, b.Timings
         ORDER BY b.Batch_Id DESC`,
        [Number(courseId)]
      );
      batches = batchRows;
    }

    // ── Allocated batches (already have at least one Roll_No) ─────────────
    const allocatedRows: any[] = rollNoColumnExists ? await (async () => {
      const [r] = await pool.query<any[]>(
        `SELECT DISTINCT b.Batch_Id, b.Batch_code, b.Course_Id, c.Course_Name
         FROM admission_master a
         JOIN batch_mst b  ON b.Batch_Id  = a.Batch_Id
         JOIN course_mst c ON c.Course_Id = b.Course_Id
         WHERE a.Roll_No IS NOT NULL AND a.Roll_No != ''
           AND (a.IsDelete = 0 OR a.IsDelete IS NULL)
           AND (a.Cancel   = 0 OR a.Cancel   IS NULL)
         ORDER BY b.Batch_Id DESC
         LIMIT 20`
      );
      return r;
    })() : [];

    // ── Students list (only when course + batch both selected) ────────────
    let rows: any[] = [];
    let total = 0;

    if (courseId && batchId) {
      const batchIdNum = Number(batchId);

      // Auto-enrol students linked via student_master.Batch_Code but missing
      // from admission_master — do it in one transaction to save connections.
      const [batchCodeRows] = await pool.query<any[]>(
        `SELECT Batch_code FROM batch_mst WHERE Batch_Id = ? LIMIT 1`,
        [batchIdNum]
      );
      const thisBatchCode = batchCodeRows[0]?.Batch_code;

      if (thisBatchCode) {
        // Single atomic INSERT … SELECT — no race condition, no duplicates.
        // If two requests hit simultaneously, the NOT EXISTS prevents double-inserts.
        try {
          await pool.query(
            `INSERT INTO admission_master (Student_Id, Batch_Id, Admission_Date, IsActive, Cancel, IsDelete)
             SELECT s.Student_Id, ?, CURDATE(), 1, 0, 0
             FROM student_master s
             WHERE TRIM(s.Batch_Code) = TRIM(?)
               AND (s.IsDelete = 0 OR s.IsDelete IS NULL)
               AND NOT EXISTS (
                 SELECT 1 FROM admission_master a2
                 WHERE a2.Student_Id = s.Student_Id
                   AND a2.Batch_Id   = ?
                   AND (a2.IsDelete = 0 OR a2.IsDelete IS NULL)
                   AND (a2.Cancel   = 0 OR a2.Cancel   IS NULL)
               )`,
            [batchIdNum, thisBatchCode, batchIdNum]
          );
        } catch (e) {
          console.warn('[allot-roll-number] auto-enrol skipped:', (e as Error)?.message);
        }
      }

      // Build WHERE — no inquiry table join; student_master is the source of truth
      const conditions: string[] = [
        'a.Batch_Id = ?',
        '(a.IsDelete = 0 OR a.IsDelete IS NULL)',
        '(a.Cancel   = 0 OR a.Cancel   IS NULL)',
      ];
      const params: (string | number)[] = [batchIdNum];

      if (search) {
        const like = `%${search}%`;
        conditions.push(`(
          s.Student_Name LIKE ?
          OR s.FName LIKE ?
          OR s.Email LIKE ?
          OR CAST(s.Student_Id AS CHAR) LIKE ?
          OR CAST(a.Student_Code AS CHAR) LIKE ?
        )`);
        params.push(like, like, like, like, like);
      }

      const where = conditions.join(' AND ');

      // COUNT(DISTINCT Student_Id) matches the GROUP BY in the data query
      const [countRows] = await pool.query<any[]>(
        `SELECT COUNT(DISTINCT a.Student_Id) AS total
         FROM admission_master a
         LEFT JOIN student_master s ON s.Student_Id = a.Student_Id
         WHERE ${where}`,
        params
      );
      total = Number(countRows[0]?.total ?? 0);

      // Rows — deduplicated on Student_Id to prevent showing duplicates caused
      // by multiple admission_master rows for the same student+batch.
      const rollNoSelect = rollNoColumnExists
        ? `COALESCE(a.Roll_No, '')`
        : `''`;
      const [dataRows] = await pool.query<any[]>(
        `SELECT
           a.Admission_Id AS id,
           a.Student_Code AS studentCode,
           COALESCE(
             NULLIF(TRIM(s.Student_Name), ''),
             TRIM(CONCAT_WS(' ', s.FName, s.LName)),
             CONCAT('Student #', CAST(a.Student_Id AS CHAR))
           )                                                           AS studentName,
           COALESCE(a.Admission_Date, s.Admission_Dt)                 AS admissionDate,
           COALESCE(NULLIF(TRIM(a.Phase),''), NULLIF(TRIM(b.Category),''), 'Not Set') AS phase,
           ${rollNoSelect}                                             AS rollNo
         FROM admission_master a
         LEFT JOIN student_master s ON s.Student_Id = a.Student_Id
         JOIN  batch_mst b          ON b.Batch_Id   = a.Batch_Id
         WHERE ${where}
         GROUP BY a.Student_Id
         ORDER BY studentName ASC
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
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err: unknown) {
    console.error('Allot Roll Number GET error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

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

    const rollValues = rollNumbers.map((r) => r.rollNo?.trim()).filter(Boolean);

    // Validate format: digits only, min 5 chars (relaxed from the prior strict regex)
    const invalid = rollValues.filter((v) => !/^\d{5,}$/.test(v));
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Invalid roll number format: ${invalid.slice(0, 10).join(', ')}. Must be numeric, at least 5 digits.` },
        { status: 400 }
      );
    }

    // Check for duplicates within this save
    const duplicates = rollValues.filter((v, i) => rollValues.indexOf(v) !== i);
    if (duplicates.length > 0) {
      return NextResponse.json(
        { error: `Duplicate roll numbers: ${[...new Set(duplicates)].join(', ')}` },
        { status: 400 }
      );
    }

    if (!rollNoColumnExists) {
      return NextResponse.json(
        { error: 'Roll_No column is not available in this database. Contact your administrator.' },
        { status: 503 }
      );
    }

    // Check for roll numbers already used by OTHER admission records in this batch
    if (rollValues.length > 0) {
      const admissionIds = rollNumbers.map((r) => Number(r.admissionId)).filter(Number.isFinite);
      const [existing] = await pool.query<any[]>(
        `SELECT Admission_Id, Roll_No
         FROM admission_master
         WHERE Batch_Id = ?
           AND Roll_No IN (${rollValues.map(() => '?').join(',')})
           AND Admission_Id NOT IN (${(admissionIds.length ? admissionIds : [0]).map(() => '?').join(',')})`,
        [batchId, ...rollValues, ...(admissionIds.length ? admissionIds : [0])]
      );
      if ((existing as any[]).length > 0) {
        const taken = [...new Set((existing as any[]).map((r) => String(r.Roll_No)))];
        return NextResponse.json(
          { error: `Roll number(s) already used in this batch: ${taken.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Save all roll numbers in one transaction
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
    console.error('Allot Roll Number PUT error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
