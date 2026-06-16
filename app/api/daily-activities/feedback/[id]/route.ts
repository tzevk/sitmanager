import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

async function ensureFeedbackTable() {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS training_feedback_forms (
      id INT NOT NULL AUTO_INCREMENT,
      stage_percent INT NOT NULL,
      training_program VARCHAR(255) NULL,
      batch_id INT NULL,
      batch_no VARCHAR(100) NULL,
      feedback_date DATE NULL,

      schema_json LONGTEXT NOT NULL,

      published TINYINT NOT NULL DEFAULT 0,
      deleted TINYINT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NULL,

      PRIMARY KEY (id),
      INDEX idx_stage_percent (stage_percent),
      INDEX idx_published (published),
      INDEX idx_deleted (deleted),
      INDEX idx_feedback_date (feedback_date),
      INDEX idx_batch_id (batch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  const [cols] = await pool.query<RowDataPacket[]>(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'training_feedback_forms'`
  );
  const colNames = new Set(cols.map((c) => String(c.COLUMN_NAME)));
  if (!colNames.has('batch_id')) {
    await pool.query(`ALTER TABLE training_feedback_forms ADD COLUMN batch_id INT NULL AFTER training_program`);
    await pool.query(`ALTER TABLE training_feedback_forms ADD INDEX idx_batch_id (batch_id)`);
  }
}

async function ensureSubmissionsTable() {
  const pool = getPool();
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

type TrainingFeedbackRow = RowDataPacket & {
  id: number;
  stage_percent: number;
  training_program: string | null;
  batch_id: number | null;
  batch_no: string | null;
  feedback_date: string | null;
  published: 0 | 1;
  schema_json: string;
  created_at: string;
  updated_at: string | null;
};

function parseId(params: { id: string }) {
  const id = Number(params.id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'feedback1.view');
  if (auth instanceof NextResponse) return auth;

  try {
    await ensureFeedbackTable();
    const { id: idStr } = await params;
    const id = parseId({ id: idStr });
    if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const includeSubmissions = req.nextUrl.searchParams.get('include') === 'submissions';
    const pool = getPool();
    const [rows] = await pool.query<TrainingFeedbackRow[]>(
      `SELECT id, stage_percent, training_program, batch_id, batch_no, feedback_date,
              schema_json,
              published, created_at, updated_at
       FROM training_feedback_forms
       WHERE id = ? AND deleted = 0
       LIMIT 1`,
      [id]
    );

    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (!includeSubmissions) {
      return NextResponse.json({ row: rows[0] });
    }

    await ensureSubmissionsTable();
    const [submissions] = await pool.query<RowDataPacket[]>(
      `SELECT id, student_id, student_code, student_name, answers_json, submitted_at
       FROM training_feedback_submissions
       WHERE form_id = ?
       ORDER BY submitted_at DESC, id DESC`,
      [id]
    );

    return NextResponse.json({ row: rows[0], submissions });
  } catch (err) {
    console.error('Feedback get error:', err);
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'feedback1.update');
  if (auth instanceof NextResponse) return auth;

  try {
    await ensureFeedbackTable();
    const { id: idStr } = await params;
    const id = parseId({ id: idStr });
    if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const body = await req.json();

    const stagePercent = Number(body.stagePercent);
    if (![30, 60, 90].includes(stagePercent)) {
      return NextResponse.json({ error: 'stagePercent must be 30, 60, or 90' }, { status: 400 });
    }

    const trainingProgram = typeof body.trainingProgram === 'string' ? body.trainingProgram.trim() : '';
    const batchId = Number(body.batchId);
    const batchNo = typeof body.batchNo === 'string' ? body.batchNo.trim() : '';
    const feedbackDate = body.date || null;

    const schemaJson = typeof body.schema === 'object' ? JSON.stringify(body.schema) : null;
    if (!schemaJson) {
      return NextResponse.json({ error: 'schema is required' }, { status: 400 });
    }

    const pool = getPool();
    await pool.query<ResultSetHeader>(
      `UPDATE training_feedback_forms
       SET stage_percent = ?, training_program = ?, batch_id = ?, batch_no = ?, feedback_date = ?,
           schema_json = ?,
           updated_at = NOW()
       WHERE id = ? AND deleted = 0`,
      [
        stagePercent,
        trainingProgram || null,
        Number.isFinite(batchId) && batchId > 0 ? batchId : null,
        batchNo || null,
        feedbackDate,
        schemaJson,
        id,
      ]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Feedback update error:', err);
    return NextResponse.json({ error: 'Failed to update feedback' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'feedback1.update');
  if (auth instanceof NextResponse) return auth;

  try {
    await ensureFeedbackTable();
    const { id: idStr } = await params;
    const id = parseId({ id: idStr });
    if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const body = await req.json();
    if (typeof body.published !== 'boolean') {
      return NextResponse.json({ error: 'published must be boolean' }, { status: 400 });
    }

    const pool = getPool();
    await pool.query<ResultSetHeader>(
      `UPDATE training_feedback_forms
       SET published = ?, updated_at = NOW()
       WHERE id = ? AND deleted = 0`,
      [body.published ? 1 : 0, id]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Feedback publish error:', err);
    return NextResponse.json({ error: 'Failed to update publish state' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'feedback1.delete');
  if (auth instanceof NextResponse) return auth;

  try {
    await ensureFeedbackTable();
    const { id: idStr } = await params;
    const id = parseId({ id: idStr });
    if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const pool = getPool();
    await pool.query<ResultSetHeader>(
      `UPDATE training_feedback_forms SET deleted = 1, updated_at = NOW() WHERE id = ?`,
      [id]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Feedback delete error:', err);
    return NextResponse.json({ error: 'Failed to delete feedback' }, { status: 500 });
  }
}
