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

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT p.*,
        COALESCE(
          (SELECT b.INR_Basic FROM batch_mst b
           WHERE b.Course_Id = p.Course_Id AND b.INR_Basic > 0
           ORDER BY b.Batch_Id DESC LIMIT 1),
        0) AS Fees,
        (SELECT COUNT(*)
         FROM student_master sm
         WHERE sm.Course_Id = p.Course_Id
           AND sm.Admission_Dt IS NOT NULL
           AND sm.Admission_Dt >= CONCAT(p.Plan_Year, '-04-01')
           AND sm.Admission_Dt <  CONCAT(p.Plan_Year + 1, '-04-01')
           AND (sm.IsDelete IS NULL OR sm.IsDelete = 0)
        ) AS Students_Admitted_Live,
        (SELECT COUNT(DISTINCT b2.Batch_Id)
         FROM batch_mst b2
         WHERE b2.Course_Id = p.Course_Id
           AND b2.SDate IS NOT NULL
           AND b2.SDate >= CONCAT(p.Plan_Year, '-04-01')
           AND b2.SDate <  CONCAT(p.Plan_Year + 1, '-04-01')
           AND (b2.IsDelete IS NULL OR b2.IsDelete = 0)
           AND (b2.Cancel IS NULL OR b2.Cancel = 0)
        ) AS Frequency_Conducted_Live
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
