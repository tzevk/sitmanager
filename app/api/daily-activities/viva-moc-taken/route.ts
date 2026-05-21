/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { dashboardRateLimiter } from '@/lib/rate-limit';

/*
  Actual table: awt_vivamoctaken
  Columns: id (PK), coursename (varchar), batchcode (varchar — stores Batch_Id),
           vivamocname (varchar), marks (varchar), date (varchar),
           created_by, updated_by, created_date, updated_date, deleted (int)
*/

/* ── Schema discovery for viva/moc child marks table ───────────────────────── */
async function getVivaChildSchema(pool: any): Promise<{
  table: string | null;
  vivaIdCol: string;
  studentCol: string;
  marksCol: string;
  deleteClause: string;
}> {
  const candidates = ['viva_moc_child', 'viva_taken_child', 'awt_vivamoctaken_child', 'viva_moc_marks'];
  for (const table of candidates) {
    try {
      const [rows] = await pool.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [table]
      );
      const cols = new Set((rows as any[]).map((r: any) => String(r.COLUMN_NAME)));
      if (cols.size === 0) continue;

      let vivaIdCol = 'viva_id';
      let studentCol = 'Student_Id';
      let marksCol = 'Marks';
      for (const col of cols) {
        const lc = col.toLowerCase();
        if (['viva_id', 'vivamoc_id', 'id_viva', 'take_id', 'given_id'].some(c => lc.includes(c))) vivaIdCol = col;
        if (studentCol === 'Student_Id' && ['student_id', 'admission_id', 'studentid'].some(c => lc.includes(c))) studentCol = col;
        if (marksCol === 'Marks' && ['mark', 'score', 'obtain'].some(c => lc.includes(c))) marksCol = col;
      }
      const hasDelete = cols.has('IsDelete') || cols.has('isdelete') || cols.has('deleted');
      const deleteCol = cols.has('IsDelete') ? 'IsDelete' : cols.has('isdelete') ? 'IsDelete' : 'deleted';
      return {
        table,
        vivaIdCol,
        studentCol,
        marksCol,
        deleteClause: hasDelete ? `AND (vc.\`${deleteCol}\` = 0 OR vc.\`${deleteCol}\` IS NULL)` : '',
      };
    } catch { continue; }
  }
  return { table: null, vivaIdCol: 'viva_id', studentCol: 'Student_Id', marksCol: 'Marks', deleteClause: '' };
}

/* ---------- GET — List viva/moc taken OR single OR dropdown options ---------- */
export async function GET(req: NextRequest) {
  try {
    const rateLimited = await dashboardRateLimiter(req);
    if (rateLimited) return rateLimited;

    const auth = await requirePermission(req, 'viva_moc.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);

    /* --- Single record by id --- */
    const singleId = searchParams.get('id');
    if (singleId) {
      const [rows] = await pool.query(
        `SELECT vm.id, vm.coursename, vm.batchcode, vm.vivamocname, vm.marks, vm.date,
                b.Batch_Id, b.Batch_code AS Batch_code_display, b.Course_Id,
                c.Course_Name
         FROM awt_vivamoctaken vm
         LEFT JOIN batch_mst b ON CAST(vm.batchcode AS UNSIGNED) = b.Batch_Id
         LEFT JOIN course_mst c ON b.Course_Id = c.Course_Id
         WHERE vm.id = ? AND (vm.deleted = 0 OR vm.deleted IS NULL)`,
        [parseInt(singleId)]
      );
      const row = (rows as any[])[0];
      if (!row) {
        return NextResponse.json({ error: 'Viva/MOC record not found' }, { status: 404 });
      }
      return NextResponse.json({ vivaMoc: row });
    }

    /* --- Dropdown options --- */
    const fetchOptions = searchParams.get('options');
    if (fetchOptions === 'courses') {
      const [courses] = await pool.query(
        `SELECT Course_Id, Course_Name FROM course_mst
         WHERE (IsDelete = 0 OR IsDelete IS NULL) AND IsActive = 1
         ORDER BY Course_Name`
      );
      return NextResponse.json({ courses });
    }

    if (fetchOptions === 'batches') {
      const courseId = searchParams.get('courseId');
      if (!courseId) return NextResponse.json({ batches: [] });
      const [batches] = await pool.query(
        `SELECT Batch_Id, Batch_code, Category, Timings
         FROM batch_mst
         WHERE Course_Id = ? AND IsActive = 1
           AND (IsDelete = 0 OR IsDelete IS NULL)
           AND (Cancel = 0 OR Cancel IS NULL)
         ORDER BY Batch_Id DESC`,
        [parseInt(courseId)]
      );
      return NextResponse.json({ batches });
    }

    if (fetchOptions === 'mocs') {
      const batchId = searchParams.get('batchId');
      if (!batchId) return NextResponse.json({ mocs: [] });
      const [mocs] = await pool.query(
        `SELECT id, subject, marks, date
         FROM batch_moc_master
         WHERE batch_id = ? AND (deleted = 0 OR deleted IS NULL)
         ORDER BY id DESC`,
        [batchId]
      );
      return NextResponse.json({ mocs });
    }

    /* --- Students for a batch with their marks for a given viva/moc --- */
    if (fetchOptions === 'students') {
      const batchId = searchParams.get('batchId');
      const vivaId = searchParams.get('vivaId');
      if (!batchId) return NextResponse.json({ students: [] });

      const [students] = await pool.query(
        `SELECT a.Admission_Id, a.Student_Id, a.Student_Code, s.Student_Name, a.Roll_No
         FROM admission_master a
         JOIN student_master s ON a.Student_Id = s.Student_Id
         WHERE a.Batch_Id = ?
           AND (a.IsDelete = 0 OR a.IsDelete IS NULL)
           AND (a.Cancel = 0 OR a.Cancel IS NULL)
         ORDER BY CAST(COALESCE(a.Roll_No, '0') AS UNSIGNED), s.Student_Name`,
        [parseInt(batchId)]
      );

      /* Build marks lookup.
         In edit mode (vivaId provided): query directly by viva_id first — no
         batchcode matching, no JOIN, guaranteed to find whatever was saved under
         that exact record.  If that returns nothing, fall back to the batch-wide
         JOIN so we still catch marks saved under a sibling record.
         In new-form mode (no vivaId): use only the batch-wide JOIN. */
      const childMap: Record<string, { marks: number | null; discipline_marks: number | null; status: string }> = {};

      const fillChildMap = (rows: any[], withDiscipline: boolean) => {
        for (const row of rows as any[]) {
          const key = String(row.Student_Id);
          if (!childMap[key]) {
            childMap[key] = {
              marks: row.Marks ?? null,
              discipline_marks: withDiscipline ? (row.Discipline_Marks ?? null) : null,
              status: row.Status ?? 'Present',
            };
          }
        }
      };

      const queryDirect = async (id: number) => {
        try {
          const [rows] = await pool.query(
            `SELECT Student_Id, Marks, Discipline_Marks, Status
             FROM viva_moc_child
             WHERE viva_id = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
            [id]
          );
          fillChildMap(rows as any[], true);
        } catch {
          try {
            const [rows] = await pool.query(
              `SELECT Student_Id, Marks, Status FROM viva_moc_child
               WHERE viva_id = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
              [id]
            );
            fillChildMap(rows as any[], false);
          } catch { /* table not yet created */ }
        }
      };

      const queryByBatch = async () => {
        try {
          const [rows] = await pool.query(
            `SELECT vmc.Student_Id, vmc.Marks, vmc.Discipline_Marks, vmc.Status
             FROM viva_moc_child vmc
             JOIN awt_vivamoctaken vt ON vmc.viva_id = vt.id
             WHERE CAST(vt.batchcode AS UNSIGNED) = ?
               AND (vt.deleted = 0 OR vt.deleted IS NULL)
               AND (vmc.IsDelete = 0 OR vmc.IsDelete IS NULL)
             ORDER BY vt.id DESC`,
            [parseInt(batchId)]
          );
          fillChildMap(rows as any[], true);
        } catch {
          try {
            const [rows] = await pool.query(
              `SELECT vmc.Student_Id, vmc.Marks, vmc.Status
               FROM viva_moc_child vmc
               JOIN awt_vivamoctaken vt ON vmc.viva_id = vt.id
               WHERE CAST(vt.batchcode AS UNSIGNED) = ?
                 AND (vt.deleted = 0 OR vt.deleted IS NULL)
                 AND (vmc.IsDelete = 0 OR vmc.IsDelete IS NULL)
               ORDER BY vt.id DESC`,
              [parseInt(batchId)]
            );
            fillChildMap(rows as any[], false);
          } catch { /* table not yet created */ }
        }
      };

      if (vivaId && parseInt(vivaId) > 0) {
        await queryDirect(parseInt(vivaId));
        if (Object.keys(childMap).length === 0) await queryByBatch();
      } else {
        await queryByBatch();
      }

      const result = (students as any[]).map((s: any, idx: number) => {
        const child = childMap[String(s.Student_Id)] ?? null;
        return {
          row_num: idx + 1,
          Admission_Id: s.Admission_Id,
          Student_Id: s.Student_Id,
          Student_Code: s.Student_Code,
          Student_Name: s.Student_Name,
          Roll_No: s.Roll_No,
          marks_obtained: child?.marks ?? null,
          discipline_marks: child?.discipline_marks ?? null,
          status: child?.status ?? null,
        };
      });

      return NextResponse.json({ students: result });
    }

    /* --- List with pagination --- */
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') || '25')));
    const offset = (page - 1) * limit;

    const search = searchParams.get('search')?.trim() || '';
    const courseId = searchParams.get('courseId') || '';
    const batchId = searchParams.get('batchId') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';

    const conditions: string[] = ['(vm.deleted = 0 OR vm.deleted IS NULL)'];
    const params: any[] = [];

    if (search) {
      conditions.push(
        '(vm.vivamocname LIKE ? OR b.Batch_code LIKE ? OR c.Course_Name LIKE ?)'
      );
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (courseId) { conditions.push('b.Course_Id = ?'); params.push(parseInt(courseId)); }
    if (batchId) { conditions.push('vm.batchcode = ?'); params.push(batchId); }
    if (dateFrom) { conditions.push('vm.date >= ?'); params.push(dateFrom); }
    if (dateTo) { conditions.push('vm.date <= ?'); params.push(dateTo); }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Count
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total
       FROM awt_vivamoctaken vm
       LEFT JOIN batch_mst b ON CAST(vm.batchcode AS UNSIGNED) = b.Batch_Id
       LEFT JOIN course_mst c ON b.Course_Id = c.Course_Id
       ${whereClause}`,
      params
    );
    const total = (countResult as any[])[0]?.total || 0;

    // Rows
    const [rows] = await pool.query(
      `SELECT vm.id, vm.batchcode, vm.vivamocname, vm.marks, vm.date,
              b.Batch_code AS Batch_code_display, c.Course_Name
       FROM awt_vivamoctaken vm
       LEFT JOIN batch_mst b ON CAST(vm.batchcode AS UNSIGNED) = b.Batch_Id
       LEFT JOIN course_mst c ON b.Course_Id = c.Course_Id
       ${whereClause}
       ORDER BY vm.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Filter options
    const [coursesResult] = await pool.query(
      `SELECT DISTINCT c.Course_Id, c.Course_Name
       FROM awt_vivamoctaken vm
       JOIN batch_mst b ON CAST(vm.batchcode AS UNSIGNED) = b.Batch_Id
       JOIN course_mst c ON b.Course_Id = c.Course_Id
       WHERE (vm.deleted = 0 OR vm.deleted IS NULL)
       ORDER BY c.Course_Name`
    );
    const [batchesResult] = await pool.query(
      `SELECT DISTINCT b.Batch_Id, b.Batch_code
       FROM awt_vivamoctaken vm
       JOIN batch_mst b ON CAST(vm.batchcode AS UNSIGNED) = b.Batch_Id
       WHERE (vm.deleted = 0 OR vm.deleted IS NULL)
       ORDER BY b.Batch_Id DESC
       LIMIT 50`
    );

    return NextResponse.json({
      rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      filters: {
        courses: coursesResult,
        batches: batchesResult,
      },
    });
  } catch (error: any) {
    console.error('Viva/MOC taken GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch viva/moc data', details: error.message },
      { status: 500 }
    );
  }
}

/* ── viva_moc_child helpers ─────────────────────────────────────────────────── */

async function ensureVivaChildTable(pool: any) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS viva_moc_child (
      id               INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      viva_id          INT NOT NULL,
      Student_Id       INT NOT NULL,
      Admission_Id     INT,
      Marks            DECIMAL(6,2),
      Discipline_Marks DECIMAL(6,2),
      Status           VARCHAR(20) NOT NULL DEFAULT 'Present',
      IsDelete         TINYINT(1) NOT NULL DEFAULT 0,
      created_date     DATETIME,
      updated_date     DATETIME,
      UNIQUE KEY uq_viva_student (viva_id, Student_Id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  /* Add Discipline_Marks to tables created before this column existed.
     Catches ER_DUP_FIELDNAME (1060) when already present; re-throws anything else. */
  try {
    await pool.query(`ALTER TABLE viva_moc_child ADD COLUMN Discipline_Marks DECIMAL(6,2) AFTER Marks`);
  } catch (e: any) {
    if (e.errno !== 1060 && e.code !== 'ER_DUP_FIELDNAME') throw e;
  }
}

async function upsertStudentMarks(
  pool: any,
  vivaId: number,
  students: { Student_Id: number; Admission_Id?: number; marks?: string | null; discipline_marks?: string | null; status?: string }[]
) {
  if (!students?.length) return;
  await ensureVivaChildTable(pool);
  for (const s of students) {
    const marksVal = s.marks != null && s.marks !== '' ? parseFloat(s.marks) : null;
    const disciplineVal = s.discipline_marks != null && s.discipline_marks !== '' ? parseFloat(s.discipline_marks) : null;
    try {
      await pool.query(
        `INSERT INTO viva_moc_child (viva_id, Student_Id, Admission_Id, Marks, Discipline_Marks, Status, IsDelete, created_date, updated_date)
         VALUES (?, ?, ?, ?, ?, ?, 0, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           Marks            = VALUES(Marks),
           Discipline_Marks = VALUES(Discipline_Marks),
           Status           = VALUES(Status),
           updated_date     = NOW()`,
        [vivaId, s.Student_Id, s.Admission_Id ?? null, marksVal, disciplineVal, s.status || 'Present']
      );
    } catch {
      /* Discipline_Marks column may not exist yet — save without it */
      await pool.query(
        `INSERT INTO viva_moc_child (viva_id, Student_Id, Admission_Id, Marks, Status, IsDelete, created_date, updated_date)
         VALUES (?, ?, ?, ?, ?, 0, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           Marks        = VALUES(Marks),
           Status       = VALUES(Status),
           updated_date = NOW()`,
        [vivaId, s.Student_Id, s.Admission_Id ?? null, marksVal, s.status || 'Present']
      );
    }
  }
}

/* ---------- POST — Create new viva/moc taken ---------- */
export async function POST(req: NextRequest) {
  try {
    const rateLimited = await dashboardRateLimiter(req);
    if (rateLimited) return rateLimited;

    const auth = await requirePermission(req, 'viva_moc.create');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    const { batchcode } = body;

    if (!batchcode) {
      return NextResponse.json({ error: 'Batch is required' }, { status: 400 });
    }

    /* Upsert: one record per batch */
    const [existing] = await pool.query(
      `SELECT id FROM awt_vivamoctaken WHERE batchcode = ? AND (deleted = 0 OR deleted IS NULL) LIMIT 1`,
      [batchcode]
    );
    const existingRow = (existing as any[])[0];

    let recordId: number;
    if (existingRow) {
      recordId = existingRow.id;
      await pool.query(
        `UPDATE awt_vivamoctaken SET updated_date = NOW() WHERE id = ?`,
        [recordId]
      );
    } else {
      const [result] = await pool.query(
        `INSERT INTO awt_vivamoctaken (batchcode, vivamocname, marks, date, deleted, created_date)
         VALUES (?, NULL, NULL, NULL, 0, NOW())`,
        [batchcode]
      );
      recordId = (result as any).insertId;
    }

    await upsertStudentMarks(pool, recordId, body.students ?? []);

    return NextResponse.json({ success: true, id: recordId });
  } catch (error: any) {
    console.error('Viva/MOC taken POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create viva/moc record', details: error.message },
      { status: 500 }
    );
  }
}

/* ---------- PUT — Update viva/moc taken ---------- */
export async function PUT(req: NextRequest) {
  try {
    const rateLimited = await dashboardRateLimiter(req);
    if (rateLimited) return rateLimited;

    const auth = await requirePermission(req, 'viva_moc.update');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await pool.query(
      `UPDATE awt_vivamoctaken SET batchcode = ?, updated_date = NOW() WHERE id = ?`,
      [body.batchcode || null, id]
    );

    /* Always save marks under the canonical record for this batch so
       the GET students handler can reliably find them */
    const batchcodeForPut = body.batchcode || null;
    let saveVivaId = parseInt(id);
    if (batchcodeForPut) {
      const [canonRow] = await pool.query(
        `SELECT id FROM awt_vivamoctaken WHERE batchcode = ? AND (deleted = 0 OR deleted IS NULL) LIMIT 1`,
        [batchcodeForPut]
      );
      const canon = (canonRow as any[])[0];
      if (canon?.id) saveVivaId = canon.id;
    }

    await upsertStudentMarks(pool, saveVivaId, body.students ?? []);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Viva/MOC taken PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update viva/moc record', details: error.message },
      { status: 500 }
    );
  }
}

/* ---------- DELETE — Soft delete ---------- */
export async function DELETE(req: NextRequest) {
  try {
    const rateLimited = await dashboardRateLimiter(req);
    if (rateLimited) return rateLimited;

    const auth = await requirePermission(req, 'viva_moc.delete');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await pool.query(
      'UPDATE awt_vivamoctaken SET deleted = 1 WHERE id = ?',
      [parseInt(id)]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Viva/MOC taken DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete viva/moc record', details: error.message },
      { status: 500 }
    );
  }
}
