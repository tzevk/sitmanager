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
      INDEX idx_feedback_date (feedback_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

export type TrainingFeedbackRow = RowDataPacket & {
  id: number;
  stage_percent: number;
  training_program: string | null;
  batch_no: string | null;
  feedback_date: string | null;
  published: 0 | 1;
  schema_json: string;
  created_at: string;
  updated_at: string | null;
};

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'feedback1.view');
  if (auth instanceof NextResponse) return auth;

  try {
    await ensureFeedbackTable();
    const pool = getPool();

    const [rows] = await pool.query<TrainingFeedbackRow[]>(
      `SELECT id, stage_percent, training_program, batch_no, feedback_date,
              schema_json,
              published, created_at, updated_at
       FROM training_feedback_forms
       WHERE deleted = 0
       ORDER BY stage_percent ASC, id DESC`
    );

    return NextResponse.json({ rows });
  } catch (err) {
    console.error('Feedback list error:', err);
    return NextResponse.json({ error: 'Failed to fetch feedback list' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'feedback1.create');
  if (auth instanceof NextResponse) return auth;

  try {
    await ensureFeedbackTable();
    const pool = getPool();
    const body = await req.json();

    const stagePercent = Number(body.stagePercent);
    if (![30, 60, 90].includes(stagePercent)) {
      return NextResponse.json({ error: 'stagePercent must be 30, 60, or 90' }, { status: 400 });
    }

    const trainingProgram = typeof body.trainingProgram === 'string' ? body.trainingProgram.trim() : '';
    const batchNo = typeof body.batchNo === 'string' ? body.batchNo.trim() : '';
    const feedbackDate = body.date || null;

    const schemaJson = typeof body.schema === 'object' ? JSON.stringify(body.schema) : null;
    if (!schemaJson) {
      return NextResponse.json({ error: 'schema is required' }, { status: 400 });
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO training_feedback_forms (
        stage_percent, training_program, batch_no, feedback_date,
        schema_json,
        published, deleted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 0, 0, NOW(), NULL)`,
      [
        stagePercent,
        trainingProgram || null,
        batchNo || null,
        feedbackDate,
        schemaJson,
      ]
    );

    return NextResponse.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('Feedback create error:', err);
    return NextResponse.json({ error: 'Failed to create feedback' }, { status: 500 });
  }
}
