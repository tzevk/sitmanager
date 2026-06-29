import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { requirePermission } from '@/lib/api-auth';

type BatchTextField = {
  column: string;
  label: string;
  max: number;
};

const BATCH_TEXT_FIELDS: BatchTextField[] = [
  { column: 'Batch_code', label: 'Batch Code', max: 80 },
  { column: 'Category', label: 'Category', max: 120 },
  { column: 'Timings', label: 'Timings', max: 255 },
  { column: 'Duration', label: 'Duration', max: 100 },
  { column: 'Training_Coordinator', label: 'Training Coordinator', max: 150 },
  { column: 'CourseName', label: 'Training Name', max: 255 },
];

function textValue(value: unknown, field: BatchTextField): string | null {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;
  if (trimmed.length > field.max) {
    throw new Error(`${field.label} must be ${field.max} characters or less.`);
  }
  return trimmed;
}

function textByColumn(values: Record<string, unknown>) {
  return Object.fromEntries(BATCH_TEXT_FIELDS.map((field) => [field.column, textValue(values[field.column], field)]));
}

function locationValue(value: unknown): string | null {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'mumbai') return 'Mumbai';
  if (normalized === 'pune') return 'Pune';
  throw new Error('Location must be Mumbai or Pune.');
}

async function ensureBatchTextColumns(pool: ReturnType<typeof getPool>) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COLUMN_NAME, CHARACTER_MAXIMUM_LENGTH
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'batch_mst'
       AND COLUMN_NAME IN (${BATCH_TEXT_FIELDS.map(() => '?').join(',')})`,
    BATCH_TEXT_FIELDS.map((field) => field.column)
  );

  const currentLengths = new Map(rows.map((row) => [String(row.COLUMN_NAME), Number(row.CHARACTER_MAXIMUM_LENGTH || 0)]));
  for (const field of BATCH_TEXT_FIELDS) {
    const currentLength = currentLengths.get(field.column) || 0;
    if (currentLength > 0 && currentLength < field.max) {
      await pool.query(`ALTER TABLE batch_mst MODIFY COLUMN \`${field.column}\` VARCHAR(${field.max}) NULL`);
    }
  }

  const [locationRows] = await pool.query<RowDataPacket[]>(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'batch_mst'
       AND COLUMN_NAME = 'Location'`
  );
  if (!locationRows.length) {
    await pool.query(`ALTER TABLE batch_mst ADD COLUMN Location VARCHAR(20) NULL`);
  }
}

/* ---------- GET: list batches with optional filters ---------- */
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'annual_batch.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    await ensureBatchTextColumns(pool);
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const courseId = searchParams.get('courseId') || '';
    const fromDate = searchParams.get('fromDate') || '';
    const toDate = searchParams.get('toDate') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = (page - 1) * limit;

    let where = `WHERE (b.IsDelete IS NULL OR b.IsDelete = 0) AND (b.Cancel IS NULL OR b.Cancel = 0)`;
    const params: (string | number)[] = [];

    if (courseId) {
      where += ` AND b.Course_Id = ?`;
      params.push(courseId);
    }
    if (fromDate) {
      where += ` AND b.SDate >= ?`;
      params.push(fromDate);
    }
    if (toDate) {
      where += ` AND b.SDate <= ?`;
      params.push(toDate);
    }
    if (search) {
      where += ` AND (b.Batch_code LIKE ? OR c.Course_Name LIKE ? OR b.Category LIKE ? OR b.Training_Coordinator LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    // Count
    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM batch_mst b
       LEFT JOIN course_mst c ON b.Course_Id = c.Course_Id
       ${where}`,
      params
    );
    const total = countRows[0]?.total || 0;

    // Data
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        b.Batch_Id,
        b.Course_Id,
        c.Course_Name,
        b.Batch_code,
        b.Category,
        b.Timings,
        b.SDate,
        b.ActualDate,
        b.Admission_Date,
        b.EDate,
        b.Duration,
        b.Training_Coordinator,
        b.Location,
        b.IsActive
       FROM batch_mst b
       LEFT JOIN course_mst c ON b.Course_Id = c.Course_Id
       ${where}
       ORDER BY b.Batch_Id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return NextResponse.json({ data: rows, total, page, limit });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch batches';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/* ---------- POST: create new batch ---------- */
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'annual_batch.create');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();
    const {
      Course_Id,
      Batch_code,
      Category,
      Batch_Category_id,
      Timings,
      SDate,
      ActualDate,
      Admission_Date,
      EDate,
      Duration,
      Training_Coordinator,
      INR_Basic,
      INR_ServiceTax,
      INR_Total,
      Dollar_Basic,
      Dollar_ServiceTax,
      Dollar_Total,
      CourseName,
      Course_description,
      Location,
      IsActive,
    } = body;

    if (!Course_Id) {
      return NextResponse.json({ error: 'Course is required' }, { status: 400 });
    }

    await ensureBatchTextColumns(pool);
    const text = textByColumn({ Batch_code, Category, Timings, Duration, Training_Coordinator, CourseName });
    const location = locationValue(Location);

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO batch_mst 
        (Course_Id, Batch_code, Category, Batch_Category_id, Timings, SDate, ActualDate, Admission_Date, EDate, Duration, Training_Coordinator, Location, INR_Basic, INR_ServiceTax, INR_Total, Dollar_Basic, Dollar_ServiceTax, Dollar_Total, CourseName, Course_description, IsActive, IsDelete, Date_Added)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())`,
      [
        Course_Id,
        text.Batch_code,
        text.Category,
        Batch_Category_id || null,
        text.Timings,
        SDate || null,
        ActualDate || null,
        Admission_Date || null,
        EDate || null,
        text.Duration,
        text.Training_Coordinator,
        location,
        INR_Basic || null,
        INR_ServiceTax || null,
        INR_Total || null,
        Dollar_Basic || null,
        Dollar_ServiceTax || null,
        Dollar_Total || null,
        text.CourseName,
        Course_description || null,
        IsActive ?? 1,
      ]
    );

    return NextResponse.json({ success: true, id: result.insertId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create batch';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/* ---------- PUT: update batch ---------- */
export async function PUT(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'annual_batch.update');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();
    const {
      Batch_Id,
      Course_Id,
      Batch_code,
      Category,
      Batch_Category_id,
      Timings,
      SDate,
      ActualDate,
      Admission_Date,
      EDate,
      Duration,
      Training_Coordinator,
      INR_Basic,
      INR_ServiceTax,
      INR_Total,
      Dollar_Basic,
      Dollar_ServiceTax,
      Dollar_Total,
      CourseName,
      Course_description,
      Location,
      IsActive,
    } = body;

    if (!Batch_Id) {
      return NextResponse.json({ error: 'Batch ID is required' }, { status: 400 });
    }
    if (!Course_Id) {
      return NextResponse.json({ error: 'Course is required' }, { status: 400 });
    }

    await ensureBatchTextColumns(pool);
    const text = textByColumn({ Batch_code, Category, Timings, Duration, Training_Coordinator, CourseName });
    const location = locationValue(Location);

    await pool.query(
      `UPDATE batch_mst SET
        Course_Id = ?,
        Batch_code = ?,
        Category = ?,
        Batch_Category_id = ?,
        Timings = ?,
        SDate = ?,
        ActualDate = ?,
        Admission_Date = ?,
        EDate = ?,
        Duration = ?,
        Training_Coordinator = ?,
        Location = ?,
        INR_Basic = ?,
        INR_ServiceTax = ?,
        INR_Total = ?,
        Dollar_Basic = ?,
        Dollar_ServiceTax = ?,
        Dollar_Total = ?,
        CourseName = ?,
        Course_description = ?,
        IsActive = ?
       WHERE Batch_Id = ?`,
      [
        Course_Id,
        text.Batch_code,
        text.Category,
        Batch_Category_id || null,
        text.Timings,
        SDate || null,
        ActualDate || null,
        Admission_Date || null,
        EDate || null,
        text.Duration,
        text.Training_Coordinator,
        location,
        INR_Basic || null,
        INR_ServiceTax || null,
        INR_Total || null,
        Dollar_Basic || null,
        Dollar_ServiceTax || null,
        Dollar_Total || null,
        text.CourseName,
        Course_description || null,
        IsActive ?? 1,
        Batch_Id,
      ]
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update batch';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/* ---------- DELETE: soft delete batch ---------- */
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'annual_batch.delete');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Batch ID is required' }, { status: 400 });
    }

    await pool.query(`UPDATE batch_mst SET IsDelete = 1 WHERE Batch_Id = ?`, [id]);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete batch';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
