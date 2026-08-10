import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { RowDataPacket } from 'mysql2';

async function ensureTable(pool: ReturnType<typeof getPool>) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS batch_assignment_list (
      id INT AUTO_INCREMENT PRIMARY KEY,
      batch_id INT NOT NULL,
      assignment_no INT NULL,
      assignment_name VARCHAR(255) NULL,
      description TEXT NULL,
      input_documents VARCHAR(255) NULL,
      deliverable_produced VARCHAR(255) NULL,
      trainer VARCHAR(150) NULL,
      department VARCHAR(150) NULL,
      assignment_date DATE NULL,
      deleted VARCHAR(1) DEFAULT '0',
      created_date DATETIME NULL,
      INDEX idx_batch (batch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const [cols] = await pool.query<RowDataPacket[]>(
    `SELECT COLUMN_NAME AS name FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'batch_assignment_list' AND COLUMN_NAME = 'assignment_date'`
  );
  if (!cols.length) {
    await pool.query(`ALTER TABLE batch_assignment_list ADD COLUMN assignment_date DATE NULL AFTER department`);
  }
}

/** Standard Assignment No. is the fixed reference number imported from the Standard Assignment
 * List. Actual Assignment No. is this batch's own ordering — assignments with a date get ranked
 * 1..N by assignment_date ascending; assignments with no date yet have no actual number. */
function withActualNo<T extends { id: number; assignment_date: string | null }>(rows: T[]): (T & { actual_no: number | null })[] {
  const dated = rows
    .filter((r) => r.assignment_date != null)
    .sort((a, b) => {
      if (a.assignment_date! !== b.assignment_date!) return a.assignment_date! < b.assignment_date! ? -1 : 1;
      return a.id - b.id;
    });
  const actualNoById = new Map<number, number>();
  dated.forEach((r, i) => actualNoById.set(r.id, i + 1));
  return rows.map((r) => ({ ...r, actual_no: actualNoById.get(r.id) ?? null }));
}

// GET - the batch's own imported Assignments list, plus whether a Standard Assignment List exists for its course
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await params;
    const pool = getPool();
    await ensureTable(pool);

    const [batchRows] = await pool.query<RowDataPacket[]>(`
      SELECT c.Course_Name
      FROM batch_mst b
      LEFT JOIN course_mst c ON c.Course_Id = b.Course_Id
      WHERE b.Batch_Id = ?
    `, [batchId]);
    const courseName: string | null = batchRows[0]?.Course_Name || null;

    let hasStandardAssignments = false;
    if (courseName) {
      const [cntRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt FROM standard_assignment_list WHERE course_name = ?`,
        [courseName]
      );
      hasStandardAssignments = Number(cntRows[0]?.cnt ?? 0) > 0;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, assignment_no, assignment_name, description, input_documents, deliverable_produced, trainer, department, assignment_date
       FROM batch_assignment_list
       WHERE batch_id = ? AND (deleted IS NULL OR deleted = '0')
       ORDER BY assignment_no ASC, id ASC`,
      [batchId]
    );

    return NextResponse.json({ assignments: withActualNo(rows as any[]), courseName, hasStandardAssignments });
  } catch (error) {
    console.error('Error fetching batch assignment list:', error);
    return NextResponse.json({ error: 'Failed to fetch assignment list' }, { status: 500 });
  }
}

// POST - add an assignment into the batch's own list (from the Standard Assignment List, or manually).
// Idempotent when assignment_no is given: reuses an existing row instead of creating a duplicate,
// so repeatedly picking the same Standard Assignment (e.g. from the Lecture Taken dropdown) is safe.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: batchId } = await params;
    const body = await request.json();
    const pool = getPool();
    await ensureTable(pool);

    if (body.assignment_no != null && body.assignment_no !== '') {
      const [existing] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM batch_assignment_list
         WHERE batch_id = ? AND assignment_no = ? AND (deleted IS NULL OR deleted = '0')
         LIMIT 1`,
        [batchId, Number(body.assignment_no)]
      );
      if (existing.length) {
        return NextResponse.json({ success: true, insertId: existing[0].id, existed: true });
      }
    }

    const [result] = await pool.query(`
      INSERT INTO batch_assignment_list
      (batch_id, assignment_no, assignment_name, description, input_documents, deliverable_produced, trainer, department, assignment_date, deleted, created_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '0', NOW())
    `, [
      batchId,
      body.assignment_no ? Number(body.assignment_no) : null,
      body.assignment_name?.trim() || null,
      body.description?.trim() || null,
      body.input_documents?.trim() || null,
      body.deliverable_produced?.trim() || null,
      body.trainer?.trim() || null,
      body.department?.trim() || null,
      body.assignment_date || null,
    ]);

    return NextResponse.json({ success: true, insertId: (result as { insertId: number }).insertId });
  } catch (error) {
    console.error('Error adding batch assignment:', error);
    return NextResponse.json({ error: 'Failed to add assignment' }, { status: 500 });
  }
}

// PUT - update one assignment in the batch's own list (e.g. setting/clearing its date, which
// drives the recomputed Actual Assignment No.)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const pool = getPool();
    await ensureTable(pool);

    await pool.query(
      `UPDATE batch_assignment_list SET
         assignment_no = ?, assignment_name = ?, description = ?, input_documents = ?,
         deliverable_produced = ?, trainer = ?, department = ?, assignment_date = ?
       WHERE id = ?`,
      [
        data.assignment_no != null && data.assignment_no !== '' ? Number(data.assignment_no) : null,
        data.assignment_name?.trim() || null,
        data.description?.trim() || null,
        data.input_documents?.trim() || null,
        data.deliverable_produced?.trim() || null,
        data.trainer?.trim() || null,
        data.department?.trim() || null,
        data.assignment_date || null,
        id,
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating batch assignment:', error);
    return NextResponse.json({ error: 'Failed to update assignment' }, { status: 500 });
  }
}

// DELETE - remove one assignment from the batch's own list
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const assignmentId = searchParams.get('assignmentId');
    if (!assignmentId) {
      return NextResponse.json({ error: 'assignmentId required' }, { status: 400 });
    }

    const pool = getPool();
    await ensureTable(pool);
    await pool.query(`UPDATE batch_assignment_list SET deleted = '1' WHERE id = ?`, [assignmentId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting batch assignment:', error);
    return NextResponse.json({ error: 'Failed to delete assignment' }, { status: 500 });
  }
}
