/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

async function ensureCollegeFollowUpColumns(pool: ReturnType<typeof getPool>) {
  const [rows] = await pool.query<any[]>(
    `SELECT COLUMN_NAME, DATA_TYPE
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'awt_college'
       AND COLUMN_NAME IN ('descipline', 'followup_status', 'followup_date')`
  );
  const columns = new Set(rows.map((row) => String(row.COLUMN_NAME)));
  const descipline = rows.find((row) => String(row.COLUMN_NAME) === 'descipline');
  if (descipline && !/^text$/i.test(String(descipline.DATA_TYPE || ''))) {
    await pool.query(`ALTER TABLE awt_college MODIFY COLUMN descipline TEXT NULL`);
  }
  if (!columns.has('followup_status')) {
    await pool.query(`ALTER TABLE awt_college ADD COLUMN followup_status VARCHAR(100) NULL AFTER descipline`);
  }
  if (!columns.has('followup_date')) {
    await pool.query(`ALTER TABLE awt_college ADD COLUMN followup_date DATE NULL AFTER followup_status`);
  }
}

async function ensureCollegeFollowUpTable(pool: ReturnType<typeof getPool>) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS college_follow_new (
      Follow_id INT AUTO_INCREMENT PRIMARY KEY,
      College_id INT,
      CName VARCHAR(255),
      Phone VARCHAR(100),
      Email VARCHAR(150),
      Designation VARCHAR(150),
      Purpose VARCHAR(255),
      Remark TEXT,
      Tdate VARCHAR(20),
      DirectLine VARCHAR(100),
      Course VARCHAR(100),
      nextdate VARCHAR(20),
      Note TEXT,
      Discipline VARCHAR(255),
      IsActive INT DEFAULT 1,
      IsDelete INT DEFAULT 0,
      StatusId INT
    )
  `);

  const [columns] = await pool.query<any[]>(
    `SELECT COLUMN_NAME, CHARACTER_MAXIMUM_LENGTH
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'college_follow_new'
       AND COLUMN_NAME IN ('CName', 'Phone', 'Email', 'Designation', 'Purpose', 'Tdate', 'DirectLine', 'nextdate', 'Discipline')`
  );
  const lengths = new Map(columns.map((row) => [String(row.COLUMN_NAME), Number(row.CHARACTER_MAXIMUM_LENGTH || 0)]));
  const widen: Array<[string, string, number]> = [
    ['CName', 'VARCHAR(255)', 255],
    ['Phone', 'VARCHAR(100)', 100],
    ['Email', 'VARCHAR(150)', 150],
    ['Designation', 'VARCHAR(150)', 150],
    ['Purpose', 'VARCHAR(255)', 255],
    ['Tdate', 'VARCHAR(20)', 20],
    ['DirectLine', 'VARCHAR(100)', 100],
    ['nextdate', 'VARCHAR(20)', 20],
    ['Discipline', 'VARCHAR(255)', 255],
  ];
  for (const [column, type, minLength] of widen) {
    if ((lengths.get(column) || 0) < minLength) {
      await pool.query(`ALTER TABLE college_follow_new MODIFY COLUMN ${column} ${type} NULL`);
    }
  }
}

function asDateText(value: unknown) {
  const text = String(value || '').trim();
  return text ? text.slice(0, 20) : null;
}

// GET - fetch single college by ID
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(req, 'college.view');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    const { id } = await params;
    await ensureCollegeFollowUpColumns(pool);
    await ensureCollegeFollowUpTable(pool);

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const [rows] = await pool.query<any[]>(
      `SELECT 
        id, college_name, university, contact_person, designation, address, city,
        pin, state, country, telephone, mobile, email, website,
        remark, purpose, course, batch, refstudentname, refmobile, refemail, descipline,
        followup_status, followup_date
       FROM awt_college 
       WHERE id = ? AND (deleted = 0 OR deleted IS NULL)`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'College not found' }, { status: 404 });
    }

    const [students] = await pool.query<any[]>(
      `SELECT
         s.Student_Id,
         COALESCE(NULLIF(TRIM(s.Student_Name), ''), TRIM(CONCAT_WS(' ', s.FName, s.LName)), CONCAT('Student #', s.Student_Id)) AS Student_Name,
         COALESCE(cm.Course_Name, '') AS Course_Name,
         COALESCE(bm.Batch_code, s.Batch_Code, '') AS Batch_Code,
         COALESCE(s.Year, '') AS Year_Of_Passing,
         COALESCE(NULLIF(TRIM(s.Present_Mobile), ''), NULLIF(TRIM(s.Present_Mobile2), ''), '') AS Mobile,
         COALESCE(s.Email, '') AS Email,
         COALESCE(s.Discipline, '') AS Discipline
       FROM student_master s
       LEFT JOIN admission_master am ON CAST(am.Student_Id AS UNSIGNED) = s.Student_Id
         AND (am.IsDelete = 0 OR am.IsDelete IS NULL)
         AND (am.Cancel = 0 OR am.Cancel IS NULL)
       LEFT JOIN batch_mst bm ON bm.Batch_Id = CAST(am.Batch_Id AS UNSIGNED)
       LEFT JOIN course_mst cm ON cm.Course_Id = COALESCE(CAST(am.Course_Id AS UNSIGNED), s.Course_Id)
       WHERE s.college_id = ?
         AND (s.IsDelete = 0 OR s.IsDelete IS NULL)
       ORDER BY Student_Name ASC, am.Admission_Id DESC, s.Student_Id ASC`,
      [id]
    );

    const [followups] = await pool.query<any[]>(
      `SELECT
         Follow_id,
         Tdate AS Followup_Date,
         CName AS ContactPerson,
         Designation,
         Phone AS Mobile,
         Email,
         Remark AS Remarks,
         Purpose,
         DirectLine,
         nextdate AS Next_Date
       FROM college_follow_new
       WHERE College_id = ?
         AND (IsDelete = 0 OR IsDelete IS NULL)
       ORDER BY Follow_id DESC`,
      [id]
    );

    return NextResponse.json({ ...rows[0], students, followups });
  } catch (err: unknown) {
    console.error('College GET by ID error:', err);
    const message = err instanceof Error ? err.message : "Unknown error"; return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(req, 'college.update');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    const { id } = await params;
    const collegeId = Number(id || 0);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');

    if (!collegeId) {
      return NextResponse.json({ error: 'College ID is required' }, { status: 400 });
    }

    await ensureCollegeFollowUpTable(pool);

    if (action === 'update-student-discipline') {
      const studentId = Number(body.studentId || 0);
      if (!studentId) {
        return NextResponse.json({ error: 'Student is required' }, { status: 400 });
      }
      await pool.query(
        `UPDATE student_master
         SET Discipline = ?, updated_date = NOW()
         WHERE Student_Id = ?
           AND college_id = ?
           AND (IsDelete = 0 OR IsDelete IS NULL)`,
        [String(body.discipline || '').trim() || null, studentId, collegeId]
      );
      return NextResponse.json({ success: true });
    }

    if (action === 'save-followup') {
      const followId = Number(body.followId || 0);
      const values = {
        date: asDateText(body.date),
        contactPerson: String(body.contactPerson || '').trim() || null,
        designation: String(body.designation || '').trim() || null,
        mobile: String(body.mobile || '').trim() || null,
        email: String(body.email || '').trim() || null,
        remarks: String(body.remarks || '').trim() || null,
        purpose: String(body.purpose || '').trim() || null,
        directLine: String(body.directLine || '').trim() || null,
        nextDate: asDateText(body.nextDate),
      };

      if (followId) {
        await pool.query(
          `UPDATE college_follow_new
           SET Tdate = ?, CName = ?, Designation = ?, Phone = ?, Email = ?, Remark = ?, Purpose = ?, DirectLine = ?, nextdate = ?
           WHERE Follow_id = ?
             AND College_id = ?
             AND (IsDelete = 0 OR IsDelete IS NULL)`,
          [values.date, values.contactPerson, values.designation, values.mobile, values.email, values.remarks, values.purpose, values.directLine, values.nextDate, followId, collegeId]
        );
        return NextResponse.json({ success: true, followId });
      }

      const [result] = await pool.query<any>(
        `INSERT INTO college_follow_new
          (College_id, Tdate, CName, Designation, Phone, Email, Remark, Purpose, DirectLine, nextdate, IsActive, IsDelete)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`,
        [collegeId, values.date, values.contactPerson, values.designation, values.mobile, values.email, values.remarks, values.purpose, values.directLine, values.nextDate]
      );
      return NextResponse.json({ success: true, followId: result.insertId });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: unknown) {
    console.error('College PATCH by ID error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
