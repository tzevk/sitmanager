/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { withEmailSignature } from '@/lib/mailer';
import nodemailer from 'nodemailer';

const SMTP_HOST     = process.env.ADMISSION_SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT     = parseInt(process.env.ADMISSION_SMTP_PORT || '587', 10);
const SMTP_SECURE   = process.env.ADMISSION_SMTP_SECURE === '1';
const SMTP_USER     = process.env.ADMISSION_SMTP_USER;
const SMTP_PASS     = process.env.ADMISSION_SMTP_PASS;
const SMTP_FROM     = process.env.ADMISSION_SMTP_FROM;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Ensure WhatsApp_Group_Link column exists — created lazily on first request
let waColReady = false;
let waColExists = false;
async function ensureWaColumn(pool: ReturnType<typeof getPool>) {
  if (waColReady) return;
  waColReady = true;
  try {
    const [cols] = await pool.query<any[]>(
      "SHOW COLUMNS FROM batch_mst LIKE 'WhatsApp_Group_Link'"
    );
    if (cols.length > 0) {
      waColExists = true;
    } else {
      await pool.query('ALTER TABLE batch_mst ADD COLUMN WhatsApp_Group_Link VARCHAR(500) NULL');
      waColExists = true;
    }
  } catch {
    waColExists = false;
  }
}

/*
 * GET /api/daily-activities/batch-communication
 * Returns courses list, batches for a course, and students + batch metadata
 * for a selected course + batch (including email addresses).
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'annual_batch.view');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    await ensureWaColumn(pool);
    const waCol = waColExists ? 'b.WhatsApp_Group_Link' : 'NULL';

    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get('courseId')?.trim() || '';
    const batchId  = searchParams.get('batchId')?.trim()  || '';
    const page     = Math.max(1, Number(searchParams.get('page'))  || 1);
    const limit    = Math.min(200, Math.max(10, Number(searchParams.get('limit')) || 50));
    const offset   = (page - 1) * limit;

    // Courses
    const [courses] = await pool.query<any[]>(
      `SELECT Course_Id, Course_Name
       FROM course_mst
       WHERE (IsDelete = 0 OR IsDelete IS NULL)
       ORDER BY Course_Name`
    );

    // Batches for selected course
    let batches: any[] = [];
    if (courseId) {
      const [batchRows] = await pool.query<any[]>(
        `SELECT
           b.Batch_Id,
           b.Batch_code,
           b.Category,
           b.Timings,
           ${waCol} AS WhatsApp_Group_Link,
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

    // Students + batch info when both course and batch are selected
    let students: any[] = [];
    let total = 0;
    let batchInfo: any = null;

    if (courseId && batchId) {
      const batchIdNum = Number(batchId);

      // Batch metadata (including WhatsApp link)
      const [batchRows] = await pool.query<any[]>(
        `SELECT b.Batch_Id, b.Batch_code, b.Category, b.Timings,
                ${waCol} AS WhatsApp_Group_Link, c.Course_Name
         FROM batch_mst b
         LEFT JOIN course_mst c ON c.Course_Id = b.Course_Id
         WHERE b.Batch_Id = ? LIMIT 1`,
        [batchIdNum]
      );
      batchInfo = batchRows[0] || null;

      const conditions = [
        'a.Batch_Id = ?',
        '(a.IsDelete = 0 OR a.IsDelete IS NULL)',
        '(a.Cancel   = 0 OR a.Cancel   IS NULL)',
      ];
      const params: (string | number)[] = [batchIdNum];

      const where = conditions.join(' AND ');

      const [countRows] = await pool.query<any[]>(
        `SELECT COUNT(DISTINCT a.Student_Id) AS total
         FROM admission_master a
         WHERE ${where}`,
        params
      );
      total = Number(countRows[0]?.total ?? 0);

      const [dataRows] = await pool.query<any[]>(
        `SELECT
           a.Admission_Id                                                AS admissionId,
           a.Student_Id                                                  AS studentId,
           a.Student_Code                                                AS studentCode,
           COALESCE(
             NULLIF(TRIM(s.Student_Name), ''),
             TRIM(CONCAT_WS(' ', s.FName, s.LName)),
             CONCAT('Student #', CAST(a.Student_Id AS CHAR))
           )                                                             AS studentName,
           TRIM(COALESCE(s.Email, ''))                                   AS email,
           COALESCE(a.Admission_Date, s.Admission_Dt)                   AS admissionDate
         FROM admission_master a
         LEFT JOIN student_master s ON s.Student_Id = a.Student_Id
         WHERE ${where}
         GROUP BY a.Student_Id
         ORDER BY studentName ASC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );
      students = dataRows;
    }

    return NextResponse.json({
      courses,
      batches,
      batchInfo,
      students,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err: unknown) {
    console.error('Batch Communication GET error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/*
 * POST /api/daily-activities/batch-communication
 * Body: { batchId, subject, body, studentIds? }
 * Sends a composed email to all (or selected) students in the batch.
 * Returns per-student results { email, studentName, success, error }.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'annual_batch.view');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    const body = await req.json().catch(() => ({} as any));
    const { batchId, subject, body: messageBody, studentIds } = body as {
      batchId: number;
      subject: string;
      body: string;
      studentIds?: number[];
    };

    if (!batchId) {
      return NextResponse.json({ success: false, message: 'batchId is required' }, { status: 400 });
    }
    if (!subject?.trim()) {
      return NextResponse.json({ success: false, message: 'Subject is required' }, { status: 400 });
    }
    if (!messageBody?.trim()) {
      return NextResponse.json({ success: false, message: 'Message body is required' }, { status: 400 });
    }

    // Fetch students with email addresses
    let conditions = [
      'a.Batch_Id = ?',
      '(a.IsDelete = 0 OR a.IsDelete IS NULL)',
      '(a.Cancel   = 0 OR a.Cancel   IS NULL)',
      "TRIM(COALESCE(s.Email,'')) != ''",
    ];
    const params: (string | number)[] = [Number(batchId)];

    if (Array.isArray(studentIds) && studentIds.length > 0) {
      conditions.push(`a.Student_Id IN (${studentIds.map(() => '?').join(',')})`);
      params.push(...studentIds.map(Number));
    }

    const where = conditions.join(' AND ');
    const [rows] = await pool.query<any[]>(
      `SELECT DISTINCT
         s.Student_Id   AS studentId,
         COALESCE(
           NULLIF(TRIM(s.Student_Name), ''),
           TRIM(CONCAT_WS(' ', s.FName, s.LName)),
           'Student'
         )               AS studentName,
         TRIM(s.Email)   AS email
       FROM admission_master a
       LEFT JOIN student_master s ON s.Student_Id = a.Student_Id
       WHERE ${where}
       ORDER BY studentName ASC`,
      params
    );

    if (!rows.length) {
      return NextResponse.json({ success: false, message: 'No students with email addresses found in this batch' }, { status: 400 });
    }

    // Build HTML body — convert plain newlines to <br> for a readable email
    const safeSubject = escapeHtml(subject.trim());
    const bodyHtml = escapeHtml(messageBody.trim()).replace(/\n/g, '<br>');
    const htmlContent = withEmailSignature(`
      <p style="font-size:15px;font-weight:600;color:#2E3093;margin-bottom:16px;">${safeSubject}</p>
      <p style="white-space:pre-line;">${bodyHtml}</p>
    `);

    // Create transporter
    if (!SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
      return NextResponse.json({ success: false, message: 'Email is not configured on this server' }, { status: 503 });
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    type Result = { email: string; studentName: string; success: boolean; error?: string };
    const results: Result[] = [];

    for (const student of rows) {
      const email      = String(student.email || '').trim();
      const studentName = String(student.studentName || '').trim();

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        results.push({ email, studentName, success: false, error: 'Invalid email address' });
        continue;
      }

      try {
        await transporter.sendMail({
          from: SMTP_FROM,
          to: email,
          subject: subject.trim(),
          html: htmlContent,
          text: messageBody.trim(),
        });
        results.push({ email, studentName, success: true });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Send failed';
        results.push({ email, studentName, success: false, error: message });
      }
    }

    const sent   = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return NextResponse.json({ success: true, sent, failed, results });
  } catch (err: unknown) {
    console.error('Batch Communication POST error:', err);
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
