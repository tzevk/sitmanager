/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { requirePermission, requireAuth } from '@/lib/api-auth';

async function ensureTable(pool: ReturnType<typeof getPool>) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS annual_batch_plan (
      Plan_Id INT AUTO_INCREMENT PRIMARY KEY,
      Plan_Year INT NOT NULL,
      Course_Id INT NULL,
      Training_Program_Name VARCHAR(255) NOT NULL,
      Duration VARCHAR(50),
      Frequency_Conducted INT DEFAULT 0,
      Target_Frequency INT DEFAULT 0,
      Min_Students_Per_Batch INT DEFAULT 0,
      Students_Admitted INT DEFAULT 0,
      Yearly_Students_Target INT DEFAULT 0,
      Percentage DECIMAL(5,2) DEFAULT 0,
      IsDelete TINYINT DEFAULT 0,
      Date_Added DATETIME DEFAULT CURRENT_TIMESTAMP,
      Date_Updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_year (Plan_Year),
      INDEX idx_course (Course_Id)
    )
  `);
}

/* GET - list annual batch plan rows */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    await ensureTable(pool);

    const { searchParams } = new URL(req.url);
    const year = searchParams.get('year') || new Date().getFullYear().toString();
    const search = searchParams.get('search') || '';

    let where = `WHERE Plan_Year = ? AND (IsDelete = 0 OR IsDelete IS NULL)`;
    const params: any[] = [year];

    if (search) {
      where += ` AND Training_Program_Name LIKE ?`;
      params.push(`%${search}%`);
    }

    // A course can have several plan rows (e.g. "<Course> - Fulltime" / "- Weekend" /
    // "- Online") sharing one Course_Id. This condition scopes each row's live figures
    // to the matching batch Category when the row's name encodes one — otherwise a
    // Course_Id-only match makes every variant of the same course report the exact
    // same (summed multiple times by the frontend's total) admitted/frequency count.
    const CATEGORY_MATCH = (batchAlias: string) => `(
      (LOWER(p.Training_Program_Name) NOT LIKE '%fulltime%' AND LOWER(p.Training_Program_Name) NOT LIKE '%full time%'
       AND LOWER(p.Training_Program_Name) NOT LIKE '%weekend%' AND LOWER(p.Training_Program_Name) NOT LIKE '%online%')
      OR ((LOWER(p.Training_Program_Name) LIKE '%fulltime%' OR LOWER(p.Training_Program_Name) LIKE '%full time%') AND LOWER(COALESCE(${batchAlias}.Category, '')) LIKE '%full%time%')
      OR (LOWER(p.Training_Program_Name) LIKE '%weekend%' AND LOWER(COALESCE(${batchAlias}.Category, '')) LIKE '%weekend%')
      OR (LOWER(p.Training_Program_Name) LIKE '%online%' AND LOWER(COALESCE(${batchAlias}.Category, '')) LIKE '%online%')
    )`;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT p.*,
        COALESCE(
          (SELECT b.INR_Basic FROM batch_mst b
           WHERE b.Course_Id = p.Course_Id AND b.INR_Basic > 0
           ORDER BY b.Batch_Id DESC LIMIT 1),
        0) AS Fees,
        -- Real, category-scoped admitted-student count for completed/ongoing batches
        -- this FY, via admission_master — NOT a raw student_master.Admission_Dt count
        -- (which double/triple-counted the same admissions across every Fulltime/
        -- Weekend/Online variant row of a course, and included future-dated batches).
        COALESCE((
          SELECT COUNT(DISTINCT am.Student_Id)
          FROM admission_master am
          JOIN batch_mst ab ON ab.Batch_Id = am.Batch_Id
          WHERE ab.Course_Id = p.Course_Id
            AND (am.IsDelete = 0 OR am.IsDelete IS NULL)
            AND LOWER(TRIM(CAST(COALESCE(am.Cancel, '') AS CHAR))) NOT IN ('yes', 'y', '1', 'true', 'cancelled', 'canceled')
            AND (ab.IsDelete IS NULL OR ab.IsDelete = 0)
            AND (ab.Cancel IS NULL OR ab.Cancel = 0)
            AND ab.SDate >= CONCAT(p.Plan_Year, '-04-01')
            AND ab.SDate <  CONCAT(p.Plan_Year + 1, '-04-01')
            AND ab.SDate <= CURDATE()
            AND ${CATEGORY_MATCH('ab')}
        ), 0) AS Students_Admitted_Live,
        COALESCE((
          SELECT COUNT(DISTINCT ab2.Batch_Id)
          FROM batch_mst ab2
          WHERE ab2.Course_Id = p.Course_Id
            AND ab2.SDate IS NOT NULL
            AND ab2.SDate >= CONCAT(p.Plan_Year, '-04-01')
            AND ab2.SDate <  CONCAT(p.Plan_Year + 1, '-04-01')
            AND (ab2.IsDelete IS NULL OR ab2.IsDelete = 0)
            AND (ab2.Cancel IS NULL OR ab2.Cancel = 0)
            AND ${CATEGORY_MATCH('ab2')}
        ), 0) AS Frequency_Conducted_Live
       FROM annual_batch_plan p ${where} ORDER BY Training_Program_Name ASC`,
      params
    );

    const enriched = (rows as any[]).map((r) => {
      const admitted = Number(r.Students_Admitted_Live ?? 0);
      const freqConducted = Number(r.Frequency_Conducted_Live ?? r.Frequency_Conducted ?? 0);
      const target =
        Number(r.Yearly_Students_Target) ||
        Number(r.Target_Frequency) * Number(r.Min_Students_Per_Batch);
      const pct = target > 0 ? (admitted / target) * 100 : 0;
      return {
        ...r,
        Students_Admitted: admitted,
        Frequency_Conducted: freqConducted,
        Percentage: Number(pct.toFixed(2)),
      };
    });

    return NextResponse.json({ rows: enriched });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch annual batch plan';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/* POST - create or bulk-insert annual batch plan rows */
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, ['annual_batch.create', 'annual_batch.update']);
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    await ensureTable(pool);

    const body = await req.json();
    const rows: any[] = Array.isArray(body) ? body : body.rows ? body.rows : [body];

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No data provided' }, { status: 400 });
    }

    let inserted = 0;
    for (const row of rows) {
      const year = row.Plan_Year || row.year || new Date().getFullYear();
      const name = String(row.Training_Program_Name || row.name || '').trim();
      if (!name) continue;

      // Try to match course
      let courseId = row.Course_Id || null;
      if (!courseId) {
        const [match] = await pool.query<RowDataPacket[]>(
          `SELECT Course_Id FROM course_mst WHERE LOWER(TRIM(Course_Name)) = LOWER(TRIM(?)) AND (IsDelete IS NULL OR IsDelete = 0) LIMIT 1`,
          [name]
        );
        if ((match as any[]).length > 0) courseId = (match as any[])[0].Course_Id;
      }

      // Check if already exists for this year + program name
      const [existing] = await pool.query<RowDataPacket[]>(
        `SELECT Plan_Id FROM annual_batch_plan WHERE Plan_Year = ? AND LOWER(TRIM(Training_Program_Name)) = LOWER(TRIM(?)) AND (IsDelete = 0 OR IsDelete IS NULL) LIMIT 1`,
        [year, name]
      );

      if ((existing as any[]).length > 0) {
        // Update existing
        await pool.query(
          `UPDATE annual_batch_plan SET
            Course_Id = COALESCE(?, Course_Id),
            Duration = ?,
            Frequency_Conducted = ?,
            Target_Frequency = ?,
            Min_Students_Per_Batch = ?,
            Students_Admitted = ?,
            Yearly_Students_Target = ?,
            Percentage = ?
          WHERE Plan_Id = ?`,
          [
            courseId,
            row.Duration || null,
            row.Frequency_Conducted ?? 0,
            row.Target_Frequency ?? 0,
            row.Min_Students_Per_Batch ?? 0,
            row.Students_Admitted ?? 0,
            row.Yearly_Students_Target ?? 0,
            row.Percentage ?? 0,
            (existing as any[])[0].Plan_Id,
          ]
        );
        inserted++;
      } else {
        // Insert new
        await pool.query<ResultSetHeader>(
          `INSERT INTO annual_batch_plan
            (Plan_Year, Course_Id, Training_Program_Name, Duration, Frequency_Conducted, Target_Frequency, Min_Students_Per_Batch, Students_Admitted, Yearly_Students_Target, Percentage)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            year,
            courseId,
            name,
            row.Duration || null,
            row.Frequency_Conducted ?? 0,
            row.Target_Frequency ?? 0,
            row.Min_Students_Per_Batch ?? 0,
            row.Students_Admitted ?? 0,
            row.Yearly_Students_Target ?? 0,
            row.Percentage ?? 0,
          ]
        );
        inserted++;
      }
    }

    return NextResponse.json({ success: true, inserted });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save annual batch plan';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/* DELETE - soft delete */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'annual_batch.delete');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    await pool.query(`UPDATE annual_batch_plan SET IsDelete = 1 WHERE Plan_Id = ?`, [id]);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
