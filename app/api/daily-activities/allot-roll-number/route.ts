/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

export const runtime = 'nodejs';

// Canonical roll number format used across this institute:
// {2-digit batch start year}{5-digit batch code}{4-digit sequential serial}
// e.g. batch "09071" starting in 2026, student #3 → "26090710003".
// Derived from the batch's own start year (not "today"), so the prefix a
// batch gets doesn't shift depending on when within its life a roll number
// happens to be allotted.
function rollNumberPrefix(batchCode: string, sdate: unknown): string {
  const code = String(batchCode || '').trim();
  const date = sdate ? new Date(String(sdate)) : null;
  const yy = date && !Number.isNaN(date.getTime())
    ? String(date.getFullYear()).slice(-2)
    : String(new Date().getFullYear()).slice(-2);
  return `${yy}${code}`;
}

function buildRollNumber(prefix: string, serial: number): string {
  return `${prefix}${String(serial).padStart(4, '0')}`;
}

async function getBatchInfo(pool: any, batchId: number) {
  const [rows] = await pool.query(
    `SELECT Batch_code, SDate FROM batch_mst WHERE Batch_Id = ? LIMIT 1`,
    [batchId]
  );
  return (rows as any[])[0] || null;
}

async function getBatchStudents(pool: ReturnType<typeof getPool>, batchId: number, includeHidden = false) {
  const admissionDeleteCondition = includeHidden ? '(am.IsDelete = 0 OR am.IsDelete IS NULL OR am.IsDelete = 1)' : '(am.IsDelete = 0 OR am.IsDelete IS NULL)';
  const [rows] = await pool.query<any[]>(
    `SELECT
       am.Admission_Id,
       s.Student_Id,
       COALESCE(am.Roll_No, '') AS Roll_No,
       CASE WHEN am.IsDelete = 1 THEN 1 ELSE 0 END AS Is_Hidden,
       COALESCE(NULLIF(TRIM(s.Student_Name), ''), TRIM(CONCAT_WS(' ', s.FName, s.LName)), CONCAT('Student #', s.Student_Id)) AS Student_Name,
       COALESCE(NULLIF(TRIM(s.Present_Mobile), ''), NULLIF(TRIM(s.Present_Mobile2), '')) AS Mobile,
       COALESCE(NULLIF(TRIM(s.Email), ''), '') AS Email,
       COALESCE(roll_dup.Duplicate_Count, 1) AS Roll_No_Duplicate_Count,
       COALESCE(mobile_dup.Duplicate_Count, 1) AS Mobile_Duplicate_Count,
       COALESCE(email_dup.Duplicate_Count, 1) AS Email_Duplicate_Count
     FROM admission_master am
     JOIN student_master s ON s.Student_Id = am.Student_Id
     LEFT JOIN (
       SELECT Roll_No_Key, COUNT(*) AS Duplicate_Count
       FROM (
         SELECT NULLIF(TRIM(CAST(Roll_No AS CHAR)), '') AS Roll_No_Key
         FROM admission_master
         WHERE Batch_Id = ?
           AND (IsDelete = 0 OR IsDelete IS NULL)
           AND (Cancel = 0 OR Cancel IS NULL)
       ) rolls
       WHERE Roll_No_Key IS NOT NULL AND Roll_No_Key <> ''
       GROUP BY Roll_No_Key
     ) roll_dup ON roll_dup.Roll_No_Key = NULLIF(TRIM(CAST(am.Roll_No AS CHAR)), '')
     LEFT JOIN (
       SELECT Mobile_Key, COUNT(*) AS Duplicate_Count
       FROM (
         SELECT COALESCE(NULLIF(TRIM(s2.Present_Mobile), ''), NULLIF(TRIM(s2.Present_Mobile2), '')) AS Mobile_Key
         FROM admission_master am2
         JOIN student_master s2 ON s2.Student_Id = am2.Student_Id
         WHERE am2.Batch_Id = ?
           AND (am2.IsDelete = 0 OR am2.IsDelete IS NULL)
           AND (am2.Cancel = 0 OR am2.Cancel IS NULL)
           AND (s2.IsDelete = 0 OR s2.IsDelete IS NULL)
       ) mobiles
       WHERE Mobile_Key IS NOT NULL AND Mobile_Key <> ''
       GROUP BY Mobile_Key
     ) mobile_dup ON mobile_dup.Mobile_Key = COALESCE(NULLIF(TRIM(s.Present_Mobile), ''), NULLIF(TRIM(s.Present_Mobile2), ''))
     LEFT JOIN (
       SELECT Email_Key, COUNT(*) AS Duplicate_Count
       FROM (
         SELECT LOWER(NULLIF(TRIM(s3.Email), '')) AS Email_Key
         FROM admission_master am3
         JOIN student_master s3 ON s3.Student_Id = am3.Student_Id
         WHERE am3.Batch_Id = ?
           AND (am3.IsDelete = 0 OR am3.IsDelete IS NULL)
           AND (am3.Cancel = 0 OR am3.Cancel IS NULL)
           AND (s3.IsDelete = 0 OR s3.IsDelete IS NULL)
       ) emails
       WHERE Email_Key IS NOT NULL AND Email_Key <> ''
       GROUP BY Email_Key
     ) email_dup ON email_dup.Email_Key = LOWER(NULLIF(TRIM(s.Email), ''))
     WHERE am.Batch_Id = ?
       AND ${admissionDeleteCondition}
       AND (am.Cancel = 0 OR am.Cancel IS NULL)
       AND (s.IsDelete = 0 OR s.IsDelete IS NULL)
     ORDER BY
       CASE WHEN COALESCE(roll_dup.Duplicate_Count, 1) > 1 OR COALESCE(mobile_dup.Duplicate_Count, 1) > 1 OR COALESCE(email_dup.Duplicate_Count, 1) > 1 THEN 0 ELSE 1 END,
       Student_Name ASC,
       am.Admission_Id ASC`,
     [batchId, batchId, batchId, batchId]
  );
  return rows;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'roll_number.view');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode') || 'courses';

    if (mode === 'courses') {
      const [courses] = await pool.query<any[]>(`
        SELECT Course_Id, Course_Name
        FROM course_mst
        WHERE (IsDelete = 0 OR IsDelete IS NULL)
        ORDER BY Course_Name
      `);
      return NextResponse.json({ success: true, courses }, {
        headers: { 'Cache-Control': 'private, max-age=60' },
      });
    }

    if (mode === 'batches') {
      const courseId = Number(searchParams.get('courseId') || 0);
      if (!courseId) return NextResponse.json({ success: true, batches: [] });

      const [batches] = await pool.query<any[]>(
        `SELECT Batch_Id, Batch_code, Category, Timings, IsDelete, Cancel
         FROM batch_mst
         WHERE Course_Id = ?
           AND Batch_code IS NOT NULL
           AND TRIM(Batch_code) <> ''
         ORDER BY Batch_Id DESC`,
        [courseId]
      );
      return NextResponse.json({ success: true, batches }, {
        headers: { 'Cache-Control': 'private, max-age=60' },
      });
    }

    if (mode === 'students') {
      const batchId = Number(searchParams.get('batchId') || 0);
      const includeHidden = searchParams.get('includeHidden') === '1';
      if (!batchId) {
        return NextResponse.json({ success: false, error: 'Batch is required.' }, { status: 400 });
      }

      const rows = await getBatchStudents(pool, batchId, includeHidden);
      return NextResponse.json({ success: true, rows });
    }

    return NextResponse.json({ success: false, error: 'Invalid mode.' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// Hard-delete specific admission entries. Removes ONLY the given admission_master
// row(s) by Admission_Id — the particular entry linked to the student in this
// batch — not other duplicates or the student's rows in other batches. Physical
// delete (no soft-delete flag). Accepts a single `admissionId` or a
// comma-separated `admissionIds` list for bulk deletes.
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'roll_number.delete');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const batchId = Number(searchParams.get('batchId') || 0);

    const raw = searchParams.get('admissionIds') || searchParams.get('admissionId') || '';
    const admissionIds = [...new Set(
      raw.split(',').map((v) => Number(v.trim())).filter((n) => Number.isFinite(n) && n > 0)
    )];

    if (admissionIds.length === 0) {
      return NextResponse.json({ success: false, error: 'admissionId or admissionIds is required.' }, { status: 400 });
    }

    const placeholders = admissionIds.map(() => '?').join(',');
    const [result] = await pool.query<any>(
      `DELETE FROM admission_master WHERE Admission_Id IN (${placeholders})`,
      admissionIds
    );
    const deleted = Number(result?.affectedRows ?? 0);

    const rows = batchId ? await getBatchStudents(pool, batchId, false) : [];
    return NextResponse.json({ success: true, deleted, rows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'roll_number.update');
    if (auth instanceof NextResponse) return auth;

    const { action, batchId, admissionId, studentId, rollNo, includeHidden } = await req.json().catch(() => ({}));
    const bid = Number(batchId || 0);
    const aid = Number(admissionId || 0);
    const sid = Number(studentId || 0);

    if (!bid) {
      return NextResponse.json({ success: false, error: 'Batch is required.' }, { status: 400 });
    }

    const pool = getPool();

    if (action === 'reorder-roll-numbers') {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        const [admissions] = await conn.query<any[]>(
          `SELECT
             am.Admission_Id,
             COALESCE(TRIM(CAST(am.Roll_No AS CHAR)), '') AS Roll_No,
             COALESCE(NULLIF(TRIM(s.Student_Name), ''), TRIM(CONCAT_WS(' ', s.FName, s.LName)), CONCAT('Student #', s.Student_Id)) AS Student_Name
           FROM admission_master am
           JOIN student_master s ON s.Student_Id = am.Student_Id
           WHERE am.Batch_Id = ?
             AND (am.IsDelete = 0 OR am.IsDelete IS NULL)
             AND (am.Cancel = 0 OR am.Cancel IS NULL)
             AND (s.IsDelete = 0 OR s.IsDelete IS NULL)
           ORDER BY Student_Name ASC, am.Admission_Id ASC
           FOR UPDATE`,
          [bid]
        );

        if (admissions.length === 0) {
          await conn.rollback();
          return NextResponse.json({ success: false, error: 'No students found in this batch.' }, { status: 400 });
        }

        const batch = await getBatchInfo(conn, bid);
        if (!batch) {
          await conn.rollback();
          return NextResponse.json({ success: false, error: 'Batch not found.' }, { status: 400 });
        }
        const prefix = rollNumberPrefix(batch.Batch_code, batch.SDate);

        for (let i = 0; i < admissions.length; i++) {
          const newRollNo = buildRollNumber(prefix, i + 1);
          await conn.query(
            `UPDATE admission_master SET Roll_No = ? WHERE Admission_Id = ? AND Batch_Id = ?`,
            [newRollNo, admissions[i].Admission_Id, bid]
          );
        }

        await conn.commit();
        const rows = await getBatchStudents(pool, bid, Boolean(includeHidden));
        return NextResponse.json({ success: true, rows, updated: admissions.length });
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    }

    if (action === 'auto-generate-roll-numbers') {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        const [admissions] = await conn.query<any[]>(
          `SELECT
             am.Admission_Id,
             COALESCE(TRIM(CAST(am.Roll_No AS CHAR)), '') AS Roll_No,
             COALESCE(NULLIF(TRIM(s.Student_Name), ''), TRIM(CONCAT_WS(' ', s.FName, s.LName)), CONCAT('Student #', s.Student_Id)) AS Student_Name
           FROM admission_master am
           JOIN student_master s ON s.Student_Id = am.Student_Id
           WHERE am.Batch_Id = ?
             AND (am.IsDelete = 0 OR am.IsDelete IS NULL)
             AND (am.Cancel = 0 OR am.Cancel IS NULL)
             AND (s.IsDelete = 0 OR s.IsDelete IS NULL)
           ORDER BY Student_Name ASC, am.Admission_Id ASC
           FOR UPDATE`,
          [bid]
        );

        const batch = await getBatchInfo(conn, bid);
        if (!batch) {
          await conn.rollback();
          return NextResponse.json({ success: false, error: 'Batch not found.' }, { status: 400 });
        }
        const prefix = rollNumberPrefix(batch.Batch_code, batch.SDate);

        // Derive the next serial from existing roll numbers under this
        // batch's own prefix, rather than requiring a manually-allotted seed
        // — any correctly-formatted roll number already present anchors it.
        const usedSerials = new Set<number>();
        let maxSerial = 0;

        for (const admission of admissions) {
          const currentRoll = String(admission.Roll_No || '').trim();
          if (!currentRoll) continue;
          if (currentRoll.startsWith(prefix) && /^\d{4}$/.test(currentRoll.slice(prefix.length))) {
            const serial = Number(currentRoll.slice(prefix.length));
            usedSerials.add(serial);
            if (serial > maxSerial) maxSerial = serial;
          }
        }

        let nextSerial = maxSerial + 1;
        let updated = 0;
        for (const admission of admissions) {
          if (String(admission.Roll_No || '').trim()) continue;

          while (usedSerials.has(nextSerial)) nextSerial += 1;
          const nextRollNo = buildRollNumber(prefix, nextSerial);

          await conn.query(
            `UPDATE admission_master
             SET Roll_No = ?
             WHERE Admission_Id = ?
               AND Batch_Id = ?
               AND (Roll_No IS NULL OR TRIM(CAST(Roll_No AS CHAR)) = '')`,
            [nextRollNo, admission.Admission_Id, bid]
          );
          usedSerials.add(nextSerial);
          nextSerial += 1;
          updated += 1;
        }

        await conn.commit();
        const rows = await getBatchStudents(pool, bid, Boolean(includeHidden));
        return NextResponse.json({ success: true, rows, updated });
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    }

    if (!aid || !sid) {
      return NextResponse.json({ success: false, error: 'Admission and student are required.' }, { status: 400 });
    }

    if (action === 'save-roll-number') {
      const nextRollNo = String(rollNo ?? '').trim();
      if (nextRollNo) {
        const batch = await getBatchInfo(pool, bid);
        if (!batch) {
          return NextResponse.json({ success: false, error: 'Batch not found.' }, { status: 400 });
        }
        const prefix = rollNumberPrefix(batch.Batch_code, batch.SDate);
        if (!new RegExp(`^${prefix}\\d{4}$`).test(nextRollNo)) {
          return NextResponse.json({
            success: false,
            error: `Roll number must be in the format ${prefix}#### (e.g. ${buildRollNumber(prefix, 1)}).`,
          }, { status: 400 });
        }
      }

      if (nextRollNo) {
        const [existing] = await pool.query<any[]>(
          `SELECT Admission_Id
           FROM admission_master
           WHERE Batch_Id = ?
             AND Admission_Id <> ?
             AND TRIM(CAST(Roll_No AS CHAR)) = ?
             AND (IsDelete = 0 OR IsDelete IS NULL)
             AND (Cancel = 0 OR Cancel IS NULL)
           LIMIT 1`,
          [bid, aid, nextRollNo]
        );

        if (existing.length > 0) {
          return NextResponse.json({ success: false, error: `Roll number ${nextRollNo} is already used in this batch.` }, { status: 400 });
        }
      }

      const [result] = await pool.query<any>(
        `UPDATE admission_master
         SET Roll_No = ?
         WHERE Admission_Id = ?
           AND Student_Id = ?
           AND Batch_Id = ?
           AND (IsDelete = 0 OR IsDelete IS NULL)
           AND (Cancel = 0 OR Cancel IS NULL)`,
        [nextRollNo || null, aid, sid, bid]
      );

      if (result.affectedRows === 0) {
        return NextResponse.json({ success: false, error: 'Student was not found in this batch.' }, { status: 404 });
      }

      const rows = await getBatchStudents(pool, bid, Boolean(includeHidden));
      return NextResponse.json({ success: true, rows });
    }

    if (action === 'unhide-student') {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        const [selectedAdmission] = await conn.query<any[]>(
          `SELECT Admission_Id
           FROM admission_master
           WHERE Admission_Id = ?
             AND Student_Id = ?
             AND Batch_Id = ?
             AND IsDelete = 1
             AND (Cancel = 0 OR Cancel IS NULL)
           LIMIT 1
           FOR UPDATE`,
          [aid, sid, bid]
        );

        if (selectedAdmission.length === 0) {
          await conn.rollback();
          return NextResponse.json({ success: false, error: 'Hidden student was not found in this batch.' }, { status: 404 });
        }

        await conn.query(
          `UPDATE admission_master
           SET IsDelete = 0
           WHERE Student_Id = ?
             AND Batch_Id = ?
             AND IsDelete = 1
             AND (Cancel = 0 OR Cancel IS NULL)`,
          [sid, bid]
        );

        await conn.query(
          `UPDATE student_attendance
           SET IsDelete = 0
           WHERE Batch_Id = ?
             AND Student_Id = ?
             AND IsDelete = 1`,
          [bid, sid]
        );

        await conn.commit();
        const rows = await getBatchStudents(pool, bid, Boolean(includeHidden));
        return NextResponse.json({ success: true, rows });
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [selectedAdmission] = await conn.query<any[]>(
        `SELECT Admission_Id
         FROM admission_master
         WHERE Admission_Id = ?
           AND Student_Id = ?
           AND Batch_Id = ?
           AND (IsDelete = 0 OR IsDelete IS NULL)
           AND (Cancel = 0 OR Cancel IS NULL)
         LIMIT 1
         FOR UPDATE`,
        [aid, sid, bid]
      );

      if (selectedAdmission.length === 0) {
        await conn.rollback();
        return NextResponse.json({ success: false, error: 'Student was not found in this batch.' }, { status: 404 });
      }

      const [result] = await conn.query<any>(
        `UPDATE admission_master
         SET IsDelete = 1
         WHERE Student_Id = ?
           AND Batch_Id = ?
           AND (IsDelete = 0 OR IsDelete IS NULL)`,
        [sid, bid]
      );

      if (result.affectedRows === 0) {
        await conn.rollback();
        return NextResponse.json({ success: false, error: 'Student was not found in this batch.' }, { status: 404 });
      }

      await conn.query(
        `UPDATE student_attendance
         SET IsDelete = 1
         WHERE Batch_Id = ?
           AND Student_Id = ?
           AND (IsDelete = 0 OR IsDelete IS NULL)`,
        [bid, sid]
      );

      await conn.commit();
      const rows = await getBatchStudents(pool, bid, Boolean(includeHidden));
      return NextResponse.json({ success: true, rows });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
