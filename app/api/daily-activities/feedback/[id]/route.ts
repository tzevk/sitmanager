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

function parseNumericRating(value: unknown, ratingOptions: string[]): number | null {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    if (Number.isFinite(n)) return n;
    const idx = ratingOptions.findIndex((opt) => opt.trim().toLowerCase() === trimmed.toLowerCase());
    if (idx >= 0) return idx + 1;
    return null;
  }
  return null;
}

function formatAvg(sum: number, count: number): string {
  if (!count) return '-';
  return (sum / count).toFixed(2);
}

function writeFeedbackReportSheet(params: {
  ws: ExcelJS.Worksheet;
  row: TrainingFeedbackRow;
  submissions: FeedbackSubmissionRow[];
  schema: FeedbackSchemaForExport;
}) {
  const { ws, row, submissions, schema } = params;
  const totalCols = 6;
  ws.columns = [
    { width: 38 },
    { width: 16 },
    { width: 14 },
    { width: 28 },
    { width: 18 },
    { width: 40 },
  ];

  const executiveTotals: Record<string, { sum: number; count: number }> = {};
  const trainerTotals: Record<string, { sum: number; count: number }> = {};
  const comments: Array<{ studentName: string; studentCode: string; section: string; commentType: string; comment: string }> = [];
  const ratingOptions = (schema.ratingOptions || []).map((opt) => String(opt || ''));

  for (const s of submissions) {
    const parsed = parseAnswersJson(s.answers_json);

    const executiveRatings = parsed?.trainingExecutive?.ratings && typeof parsed.trainingExecutive.ratings === 'object'
      ? parsed.trainingExecutive.ratings
      : {};
    for (const q of schema.trainingExecutive?.questions || []) {
      const qid = String(q?.id || '').trim();
      if (!qid) continue;
      const rating = parseNumericRating(executiveRatings[qid], ratingOptions);
      if (rating == null) continue;
      if (!executiveTotals[qid]) executiveTotals[qid] = { sum: 0, count: 0 };
      executiveTotals[qid].sum += rating;
      executiveTotals[qid].count += 1;
    }

    const trainerEntries = Array.isArray(parsed?.trainers?.entries) ? parsed.trainers.entries : [];
    for (const entry of trainerEntries) {
      const ratings = entry?.ratings && typeof entry.ratings === 'object' ? entry.ratings : {};
      for (const q of schema.trainers?.questions || []) {
        const qid = String(q?.id || '').trim();
        if (!qid) continue;
        const rating = parseNumericRating(ratings[qid], ratingOptions);
        if (rating == null) continue;
        if (!trainerTotals[qid]) trainerTotals[qid] = { sum: 0, count: 0 };
        trainerTotals[qid].sum += rating;
        trainerTotals[qid].count += 1;
      }
    }

    const studentName = s.student_name || '';
    const studentCode = s.student_code || '';
    const executiveComment = String(parsed?.trainingExecutive?.otherSuggestions ?? '').trim();
    if (executiveComment) {
      comments.push({
        studentName,
        studentCode,
        section: schema.trainingExecutive?.title || 'Training Executive',
        commentType: schema.trainingExecutive?.otherSuggestionsLabel || 'Other Suggestions',
        comment: executiveComment,
      });
    }
    const trainerView = String(parsed?.trainers?.viewsOnTrainer ?? '').trim();
    if (trainerView) {
      comments.push({
        studentName,
        studentCode,
        section: schema.trainers?.title || 'Trainers',
        commentType: schema.trainers?.viewsOnTrainerLabel || 'Views on Trainer',
        comment: trainerView,
      });
    }
    const siteVisitView = String(parsed?.trainers?.viewsOnSiteVisit ?? '').trim();
    if (siteVisitView) {
      comments.push({
        studentName,
        studentCode,
        section: schema.trainers?.title || 'Trainers',
        commentType: schema.trainers?.viewsOnSiteVisitLabel || 'Views on Site Visit',
        comment: siteVisitView,
      });
    }
  }

  let rowNo = 1;
  ws.mergeCells(rowNo, 1, rowNo, totalCols);
  const titleCell = ws.getCell(rowNo, 1);
  titleCell.value = `${row.training_program || 'Training Feedback'} Report${row.batch_no ? ` - Batch ${row.batch_no}` : ''}`;
  titleCell.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E3093' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(rowNo).height = 24;
  rowNo += 1;

  ws.getCell(rowNo, 1).value = 'Stage %';
  ws.getCell(rowNo, 2).value = row.stage_percent;
  ws.getCell(rowNo, 3).value = 'Feedback Date';
  ws.getCell(rowNo, 4).value = row.feedback_date || '';
  ws.getCell(rowNo, 5).value = 'Total Responses';
  ws.getCell(rowNo, 6).value = submissions.length;
  rowNo += 2;

  rowNo = writeSectionTitle(ws, rowNo, schema.trainingExecutive?.title || 'Training Executive', totalCols);
  ws.getCell(rowNo, 1).value = 'Question';
  ws.getCell(rowNo, 2).value = 'Average Rating';
  ws.getCell(rowNo, 3).value = 'Responses Count';
  ws.getRow(rowNo).font = { bold: true };
  rowNo += 1;
  for (const q of schema.trainingExecutive?.questions || []) {
    const qid = String(q?.id || '').trim();
    if (!qid) continue;
    const metric = executiveTotals[qid] || { sum: 0, count: 0 };
    ws.getCell(rowNo, 1).value = String(q?.label || qid);
    ws.getCell(rowNo, 2).value = formatAvg(metric.sum, metric.count);
    ws.getCell(rowNo, 3).value = metric.count;
    rowNo += 1;
  }
  rowNo += 1;

  rowNo = writeSectionTitle(ws, rowNo, schema.trainers?.title || 'Trainers', totalCols);
  ws.getCell(rowNo, 1).value = 'Question';
  ws.getCell(rowNo, 2).value = 'Average Rating';
  ws.getCell(rowNo, 3).value = 'Ratings Count';
  ws.getRow(rowNo).font = { bold: true };
  rowNo += 1;
  for (const q of schema.trainers?.questions || []) {
    const qid = String(q?.id || '').trim();
    if (!qid) continue;
    const metric = trainerTotals[qid] || { sum: 0, count: 0 };
    ws.getCell(rowNo, 1).value = String(q?.label || qid);
    ws.getCell(rowNo, 2).value = formatAvg(metric.sum, metric.count);
    ws.getCell(rowNo, 3).value = metric.count;
    rowNo += 1;
  }
  rowNo += 1;

  rowNo = writeSectionTitle(ws, rowNo, 'Comments', totalCols);
  ws.getCell(rowNo, 1).value = 'Student Name';
  ws.getCell(rowNo, 2).value = 'Roll Number';
  ws.getCell(rowNo, 3).value = 'Section';
  ws.getCell(rowNo, 4).value = 'Comment Type';
  ws.getCell(rowNo, 5).value = 'Comment';
  ws.getRow(rowNo).font = { bold: true };
  rowNo += 1;

  if (!comments.length) {
    ws.mergeCells(rowNo, 1, rowNo, 5);
    ws.getCell(rowNo, 1).value = 'No comments submitted.';
    rowNo += 1;
  } else {
    for (const c of comments) {
      ws.getCell(rowNo, 1).value = c.studentName;
      ws.getCell(rowNo, 2).value = c.studentCode;
      ws.getCell(rowNo, 3).value = c.section;
      ws.getCell(rowNo, 4).value = c.commentType;
      ws.getCell(rowNo, 5).value = c.comment;
      rowNo += 1;
    }
  }

  ws.eachRow((r) => {
    r.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      const leftAlignedCols = new Set([1, 3, 4, 5]);
      cell.alignment = { vertical: 'top', wrapText: true, horizontal: leftAlignedCols.has(colNumber) ? 'left' : 'center' };
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
  writeFeedbackReportSheet({ ws, row, submissions, schema });

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
