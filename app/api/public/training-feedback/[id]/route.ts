/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

async function ensureSubmissionsTable(pool: any) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS training_feedback_submissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      form_id INT NOT NULL,
      student_id INT NOT NULL,
      student_code VARCHAR(50) NULL,
      student_name VARCHAR(150) NULL,
      batch_id INT NULL,
      answers_json LONGTEXT NOT NULL,
      submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_form_student (form_id, student_id),
      INDEX idx_form (form_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

function parseId(idStr: string) {
  const id = Number(idStr);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/* GET /api/public/training-feedback/[id]
   - No query params: return published form schema + meta
   - ?last3=123 : look up students in the form's batch by last 3 digits of Student_Code
*/
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await params;
    const id = parseId(idStr);
    if (!id) return NextResponse.json({ error: 'Invalid form id' }, { status: 400 });

    const pool = getPool();

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, stage_percent, training_program, batch_id, batch_no, feedback_date, schema_json, published
       FROM training_feedback_forms
       WHERE id = ? AND deleted = 0
       LIMIT 1`,
      [id]
    );

    if (!rows.length) return NextResponse.json({ error: 'Feedback form not found' }, { status: 404 });
    const form = rows[0];
    if (!form.published) return NextResponse.json({ error: 'This feedback form is not available' }, { status: 403 });

    const last3 = req.nextUrl.searchParams.get('last3')?.trim() ?? '';
    if (last3) {
      if (!/^\d{3}$/.test(last3)) {
        return NextResponse.json({ error: 'Enter the last 3 digits of your student code' }, { status: 400 });
      }
      if (!form.batch_id) {
        return NextResponse.json({ error: 'This feedback form is not linked to a batch' }, { status: 400 });
      }

      const [students] = await pool.query<RowDataPacket[]>(
        `SELECT a.Student_Id AS studentId, a.Student_Code AS studentCode, s.Student_Name AS studentName
         FROM (
           SELECT MIN(Student_Id) AS Student_Id, Student_Id AS Sid, MAX(Student_Code) AS Student_Code
           FROM admission_master
           WHERE Batch_Id = ?
             AND (IsDelete = 0 OR IsDelete IS NULL)
             AND (Cancel = 0 OR Cancel IS NULL)
             AND RIGHT(Student_Code, 3) = ?
           GROUP BY Student_Id
         ) a
         JOIN student_master s ON s.Student_Id = a.Sid`,
        [form.batch_id, last3]
      );

      if (!students.length) {
        return NextResponse.json({ error: 'No student found with that code for this batch' }, { status: 404 });
      }

      return NextResponse.json({ students });
    }

    return NextResponse.json({
      id: form.id,
      stagePercent: form.stage_percent,
      trainingProgram: form.training_program,
      batchNo: form.batch_no,
      date: form.feedback_date ? String(form.feedback_date).slice(0, 10) : null,
      schema: JSON.parse(form.schema_json),
    });
  } catch (err: any) {
    console.error('Public training feedback GET error:', err);
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 });
  }
}

/* POST /api/public/training-feedback/[id] — submit feedback */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await params;
    const id = parseId(idStr);
    if (!id) return NextResponse.json({ error: 'Invalid form id' }, { status: 400 });

    const pool = getPool();
    await ensureSubmissionsTable(pool);

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, batch_id, published FROM training_feedback_forms WHERE id = ? AND deleted = 0 LIMIT 1`,
      [id]
    );
    if (!rows.length) return NextResponse.json({ error: 'Feedback form not found' }, { status: 404 });
    const form = rows[0];
    if (!form.published) return NextResponse.json({ error: 'This feedback form is not available' }, { status: 403 });

    const body = await req.json();
    const { studentId, studentCode, studentName, answers } = body as {
      studentId?: number;
      studentCode?: string;
      studentName?: string;
      answers?: unknown;
    };

    const sid = Number(studentId);
    if (!Number.isFinite(sid) || sid <= 0) {
      return NextResponse.json({ error: 'Student is required' }, { status: 400 });
    }
    if (typeof answers !== 'object' || answers === null) {
      return NextResponse.json({ error: 'Answers are required' }, { status: 400 });
    }

    // Confirm the student belongs to this form's batch
    const [students] = await pool.query<RowDataPacket[]>(
      `SELECT Student_Id FROM admission_master
       WHERE Student_Id = ? AND Batch_Id = ?
         AND (IsDelete = 0 OR IsDelete IS NULL)
         AND (Cancel = 0 OR Cancel IS NULL)
       LIMIT 1`,
      [sid, form.batch_id]
    );
    if (!students.length) {
      return NextResponse.json({ error: 'Student does not belong to this batch' }, { status: 403 });
    }

    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM training_feedback_submissions WHERE form_id = ? AND student_id = ? LIMIT 1`,
      [id, sid]
    );
    if (existing.length) {
      return NextResponse.json({ error: 'You have already submitted feedback for this form' }, { status: 409 });
    }

    await pool.query<ResultSetHeader>(
      `INSERT INTO training_feedback_submissions (form_id, student_id, student_code, student_name, batch_id, answers_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, sid, studentCode?.trim() || null, studentName?.trim() || null, form.batch_id, JSON.stringify(answers)]
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Public training feedback POST error:', err);
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 });
  }
}
