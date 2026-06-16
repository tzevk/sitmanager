import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import ExcelJS from 'exceljs';

type FeedbackSubmissionRow = RowDataPacket & {
  id: number;
  student_id: number;
  student_code: string | null;
  student_name: string | null;
  answers_json: string;
  submitted_at: string | null;
};

type FeedbackSchemaForExport = {
  ratingOptions?: string[];
  trainingProgram?: { questions?: Array<{ id?: string; label?: string }> };
  trainingExecutive?: {
    title?: string;
    questions?: Array<{ id?: string; label?: string }>;
    otherSuggestionsLabel?: string;
  };
  trainers?: {
    title?: string;
    questions?: Array<{ id?: string; label?: string }>;
    viewsOnTrainerLabel?: string;
    viewsOnSiteVisitLabel?: string;
  };
};

type ParsedTrainerEntry = {
  trainerName?: string;
  ratings?: Record<string, string | number | boolean | null | undefined>;
};

type ParsedFeedbackAnswers = {
  trainingProgram?: Record<string, string | number | boolean | null | undefined>;
  trainingExecutive?: {
    ratings?: Record<string, string | number | boolean | null | undefined>;
    otherSuggestions?: string | number | boolean | null;
  };
  trainers?: {
    entries?: ParsedTrainerEntry[];
    viewsOnTrainer?: string | number | boolean | null;
    viewsOnSiteVisit?: string | number | boolean | null;
  };
};


function sanitizeFilePart(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'feedback';
}

function parseFeedbackSchema(schemaJson: string): FeedbackSchemaForExport {
  try {
    return JSON.parse(schemaJson || '{}') as FeedbackSchemaForExport;
  } catch {
    return {};
  }
}

function parseAnswersJson(answersJson: string): ParsedFeedbackAnswers {
  try {
    return JSON.parse(answersJson || '{}') as ParsedFeedbackAnswers;
  } catch {
    return {};
  }
}

function writeSectionTitle(ws: ExcelJS.Worksheet, rowNo: number, title: string, totalCols: number): number {
  ws.mergeCells(rowNo, 1, rowNo, totalCols);
  const cell = ws.getCell(rowNo, 1);
  cell.value = title;
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2A6BB5' } };
  cell.alignment = { vertical: 'middle', horizontal: 'left' };
  return rowNo + 1;
}

function writeFormViewSheet(params: {
  ws: ExcelJS.Worksheet;
  row: TrainingFeedbackRow;
  submissions: FeedbackSubmissionRow[];
  schema: FeedbackSchemaForExport;
}) {
  const { ws, row, submissions, schema } = params;
  const maxTrainerColumns = submissions.reduce((max, s) => {
    const parsed = parseAnswersJson(s.answers_json);
    const count = Array.isArray(parsed?.trainers?.entries) ? parsed.trainers.entries.length : 0;
    return Math.max(max, count);
  }, 1);
  const totalCols = Math.max(2, 1 + maxTrainerColumns);

  ws.columns = Array.from({ length: totalCols }, (_, idx) => ({
    width: idx === 0 ? 42 : 20,
  }));

  let rowNo = 1;
  ws.mergeCells(rowNo, 1, rowNo, totalCols);
  const titleCell = ws.getCell(rowNo, 1);
  titleCell.value = `${row.training_program || 'Training Feedback'}${row.batch_no ? ` - Batch ${row.batch_no}` : ''}`;
  titleCell.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E3093' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(rowNo).height = 24;
  rowNo += 2;

  submissions.forEach((submission, submissionIndex) => {
    const parsed = parseAnswersJson(submission.answers_json);
    const trainingProgram = parsed?.trainingProgram && typeof parsed.trainingProgram === 'object' ? parsed.trainingProgram : {};
    const executiveRatings = parsed?.trainingExecutive?.ratings && typeof parsed.trainingExecutive.ratings === 'object'
      ? parsed.trainingExecutive.ratings
      : {};
    const trainerEntries = Array.isArray(parsed?.trainers?.entries) ? parsed.trainers.entries : [];

    ws.mergeCells(rowNo, 1, rowNo, totalCols);
    const blockTitle = ws.getCell(rowNo, 1);
    blockTitle.value = `Response ${submissionIndex + 1}`;
    blockTitle.font = { bold: true, color: { argb: 'FF1F2937' } };
    blockTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
    rowNo += 1;

    const submittedDate = submission.submitted_at ? new Date(submission.submitted_at).toLocaleString('en-IN') : '';
    ws.getCell(rowNo, 1).value = 'Student Name';
    ws.getCell(rowNo, 2).value = submission.student_name || '';
    rowNo += 1;
    ws.getCell(rowNo, 1).value = 'Student Code';
    ws.getCell(rowNo, 2).value = submission.student_code || '';
    rowNo += 1;
    ws.getCell(rowNo, 1).value = 'Student ID';
    ws.getCell(rowNo, 2).value = submission.student_id;
    rowNo += 1;
    ws.getCell(rowNo, 1).value = 'Submitted At';
    ws.getCell(rowNo, 2).value = submittedDate;
    rowNo += 1;

    rowNo = writeSectionTitle(ws, rowNo, 'Training Program', totalCols);
    ws.getCell(rowNo, 1).value = 'Question';
    ws.getCell(rowNo, 2).value = 'Response';
    ws.getRow(rowNo).font = { bold: true };
    rowNo += 1;
    for (const q of schema.trainingProgram?.questions || []) {
      const qid = String(q?.id || '').trim();
      if (!qid) continue;
      ws.getCell(rowNo, 1).value = String(q?.label || qid);
      ws.getCell(rowNo, 2).value = String(trainingProgram?.[qid] ?? '');
      rowNo += 1;
    }

    rowNo = writeSectionTitle(
      ws,
      rowNo,
      schema.trainingExecutive?.title || 'Training Executive',
      totalCols,
    );
    ws.getCell(rowNo, 1).value = 'Question';
    ws.getCell(rowNo, 2).value = 'Rating';
    ws.getRow(rowNo).font = { bold: true };
    rowNo += 1;
    for (const q of schema.trainingExecutive?.questions || []) {
      const qid = String(q?.id || '').trim();
      if (!qid) continue;
      ws.getCell(rowNo, 1).value = String(q?.label || qid);
      ws.getCell(rowNo, 2).value = String(executiveRatings?.[qid] ?? '');
      rowNo += 1;
    }
    ws.getCell(rowNo, 1).value = schema.trainingExecutive?.otherSuggestionsLabel || 'Other Suggestions';
    ws.getCell(rowNo, 2).value = String(parsed?.trainingExecutive?.otherSuggestions ?? '');
    rowNo += 1;

    rowNo = writeSectionTitle(
      ws,
      rowNo,
      schema.trainers?.title || 'Trainers',
      totalCols,
    );
    ws.getCell(rowNo, 1).value = 'Question';
    for (let i = 0; i < maxTrainerColumns; i += 1) {
      ws.getCell(rowNo, 2 + i).value = String(trainerEntries?.[i]?.trainerName || `Trainer ${i + 1}`);
    }
    ws.getRow(rowNo).font = { bold: true };
    rowNo += 1;
    for (const q of schema.trainers?.questions || []) {
      const qid = String(q?.id || '').trim();
      if (!qid) continue;
      ws.getCell(rowNo, 1).value = String(q?.label || qid);
      for (let i = 0; i < maxTrainerColumns; i += 1) {
        const rating = trainerEntries?.[i]?.ratings?.[qid];
        ws.getCell(rowNo, 2 + i).value = String(rating ?? '');
      }
      rowNo += 1;
    }
    ws.getCell(rowNo, 1).value = schema.trainers?.viewsOnTrainerLabel || 'Views on Trainer';
    ws.getCell(rowNo, 2).value = String(parsed?.trainers?.viewsOnTrainer ?? '');
    rowNo += 1;
    ws.getCell(rowNo, 1).value = schema.trainers?.viewsOnSiteVisitLabel || 'Views on Site Visit';
    ws.getCell(rowNo, 2).value = String(parsed?.trainers?.viewsOnSiteVisit ?? '');
    rowNo += 2;
  });

  ws.eachRow((r) => {
    r.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      cell.alignment = { vertical: 'top', wrapText: true, horizontal: colNumber === 1 ? 'left' : 'center' };
    });
  });
}

async function buildFeedbackWorkbook(params: {
  row: TrainingFeedbackRow;
  submissions: FeedbackSubmissionRow[];
}) {
  const { row, submissions } = params;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SIT Manager';
  workbook.created = new Date();

  const schema = parseFeedbackSchema(row.schema_json);

  const ws = workbook.addWorksheet('Feedback Responses');
  writeFormViewSheet({ ws, row, submissions, schema });

  return workbook.xlsx.writeBuffer();
}

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
    const exportExcel = req.nextUrl.searchParams.get('export') === 'excel';
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

    if (!includeSubmissions && !exportExcel) {
      return NextResponse.json({ row: rows[0] });
    }

    await ensureSubmissionsTable();
    const [submissions] = await pool.query<FeedbackSubmissionRow[]>(
      `SELECT id, student_id, student_code, student_name, answers_json, submitted_at
       FROM training_feedback_submissions
       WHERE form_id = ?
       ORDER BY submitted_at DESC, id DESC`,
      [id]
    );

    if (exportExcel) {
      const buffer = await buildFeedbackWorkbook({ row: rows[0], submissions });
      const fileName = `Feedback_${sanitizeFilePart(String(rows[0].training_program || 'Program'))}_${sanitizeFilePart(String(rows[0].batch_no || 'Batch'))}_${id}.xlsx`;
      return new NextResponse(buffer as unknown as BodyInit, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

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
