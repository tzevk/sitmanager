/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { logTableActivity } from '@/lib/activity-log';

/* ---------- POST — Create new inquiry ---------- */
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'inquiry.create');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    const {
      Student_Name,
      Sex,
      DOB,
      Present_Mobile,
      Present_Mobile2,
      Email,
      Nationality,
      Present_Country,
      Discussion,
      Status_id,
      Inquiry_Dt,
      Inquiry_From,
      Inquiry_Type,
      Course_Id,
      Batch_Category_id,
      Batch_Code,
      Qualification,
      Discipline,
      Percentage,
    } = body;

    if (!Student_Name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const sql = `
      INSERT INTO Student_Inquiry (
        Student_Name, Sex, DOB, Present_Mobile, Present_Mobile2,
        Email, Nationality, Present_Country, Discussion,
        OnlineState, Inquiry_Dt, Inquiry_From, Inquiry_Type,
        Course_Id, Batch_Category_id, Batch_Code,
        Qualification, Discipline, Percentage,
        IsDelete, Inquiry, Date_Added
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'Inquiry', NOW())
    `;

    const params = [
      Student_Name?.trim() || null,
      Sex || null,
      DOB || null,
      Present_Mobile || null,
      Present_Mobile2 || null,
      Email?.trim() || null,
      Nationality || null,
      Present_Country || null,
      Discussion?.trim() || null,
      Status_id ?? 1,
      Inquiry_Dt || new Date().toISOString().slice(0, 10),
      Inquiry_From || null,
      Inquiry_Type || null,
      Course_Id || null,
      Batch_Category_id || null,
      Batch_Code || null,
      Qualification || null,
      Discipline || null,
      Percentage || null,
    ];

    const [result] = await pool.query(sql, params);
    const insertId = (result as any).insertId;

    // Also insert into awt_inquirydiscussion so it shows in the list's Discussion column
    if (Discussion?.trim()) {
      await pool.query(
        `INSERT INTO awt_inquirydiscussion (Inquiry_id, date, discussion, deleted, created_by, created_date)
         VALUES (?, CURDATE(), ?, 0, 1, NOW())`,
        [insertId, Discussion.trim()]
      );
    }

    await logTableActivity(req, {
      tableName: 'Student_Inquiry',
      action: 'CREATE',
      recordId: insertId,
      details: { studentName: Student_Name?.trim() || null, courseId: Course_Id || null },
    });

    return NextResponse.json({ success: true, Student_Id: insertId });
  } catch (error: any) {
    console.error('Create inquiry error:', error);
    return NextResponse.json(
      { error: 'Failed to create inquiry', details: error.message },
      { status: 500 }
    );
  }
}

/* ---------- GET — List OR single inquiry ---------- */
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'inquiry.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const url = req.nextUrl;

    /* --- Single inquiry by id --- */
    const singleId = url.searchParams.get('id');
    if (singleId) {
      const sql = `
        SELECT
          si.Inquiry_Id as Student_Id, si.Student_Name, si.Sex, si.DOB,
          si.Present_Mobile, si.Present_Mobile2, si.Email,
          si.Nationality, si.Present_Country, si.Discussion,
          CAST(NULLIF(si.OnlineState, '') AS UNSIGNED) as Status_id,
          si.Inquiry_Dt, si.Inquiry_From, si.Inquiry_Type,
          si.Course_Id, si.Batch_Category_id, si.Batch_Code,
          si.Qualification, si.Discipline, si.Percentage,
          c.Course_Name as CourseName
        FROM Student_Inquiry si
        LEFT JOIN course_mst c ON si.Course_Id = c.Course_Id
        WHERE si.Inquiry_Id = ? AND (si.IsDelete = 0 OR si.IsDelete IS NULL)
      `;
      const [rows] = await pool.query(sql, [parseInt(singleId)]);
      const row = (rows as any[])[0];
      if (!row) {
        return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 });
      }
      return NextResponse.json({ inquiry: row });
    }

    // Pagination
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(10, parseInt(url.searchParams.get('limit') || '25')));
    const offset = (page - 1) * limit;

    // Filters
    const search = url.searchParams.get('search')?.trim() || '';
    const discipline = url.searchParams.get('discipline') || '';
    const inquiryType = url.searchParams.get('inquiryType') || '';
    const location = (url.searchParams.get('location') || '').trim();
    const statusId = url.searchParams.get('status') || '';
    const dateFrom = url.searchParams.get('dateFrom') || '';
    const dateTo = url.searchParams.get('dateTo') || '';

    // Optional: detect which column stores branch/location.
    // Prefer Branch (business location) over student city.
    const allowedLocations = new Set(['pune', 'mumbai']);
    const normalizedLocation = location ? location.toLowerCase() : '';
    if (normalizedLocation && !allowedLocations.has(normalizedLocation)) {
      return NextResponse.json({ error: 'Invalid location filter' }, { status: 400 });
    }

    let locationColumn: string | null = null;
    try {
      const [colRows] = await pool.query(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'Student_Inquiry'`
      );
      const columnSet = new Set((colRows as any[]).map((r: any) => String(r.COLUMN_NAME)));
      for (const candidate of ['Branch', 'Location', 'Present_City', 'City']) {
        if (columnSet.has(candidate)) {
          locationColumn = candidate;
          break;
        }
      }
    } catch {
      // Best-effort only; leave locationColumn as null.
    }

    // Inquiry_Dt is stored as VARCHAR in some DBs. Parse it to a real DATE for
    // correct sorting/filtering across common legacy formats.
    const inquiryDtAsDate =
      `COALESCE(`
      + `STR_TO_DATE(SUBSTRING(si.Inquiry_Dt, 1, 19), '%Y-%m-%d %H:%i:%s'),`
      + `STR_TO_DATE(SUBSTRING(si.Inquiry_Dt, 1, 10), '%Y-%m-%d'),`
      + `STR_TO_DATE(SUBSTRING(si.Inquiry_Dt, 1, 10), '%d-%m-%Y'),`
      + `STR_TO_DATE(SUBSTRING(si.Inquiry_Dt, 1, 10), '%d/%m/%Y'),`
      + `STR_TO_DATE(SUBSTRING(si.Inquiry_Dt, 1, 10), '%d.%m.%Y'),`
      + `STR_TO_DATE(SUBSTRING(si.Inquiry_Dt, 1, 10), '%Y/%m/%d'),`
      + `DATE('1970-01-01')`
      + `)`;

    // Resolve Discipline display name. In some DBs `Student_Inquiry.Discipline` stores
    // a numeric FK to `MST_Deciplin.Id`; in others it may already store the text.
    const disciplineNameExpr =
      `COALESCE(NULLIF(TRIM(md.Deciplin), ''), NULLIF(TRIM(si.Discipline), ''))`;

    // Build WHERE clauses for Student_Inquiry filters
    const conditions: string[] = [
      '(si.IsDelete = 0 OR si.IsDelete IS NULL)',
    ];
    const params: any[] = [];

    const resolvedBatchCodeExpr = `NULLIF(TRIM(CAST(si.Batch_Code AS CHAR)), '')`;

    if (search) {
      conditions.push(
        `(si.Student_Name LIKE ? OR si.Email LIKE ? OR si.Present_Mobile LIKE ? OR c.Course_Name LIKE ? OR ${resolvedBatchCodeExpr} LIKE ?)`
      );
      const s = `%${search}%`;
      params.push(s, s, s, s, s);
    }

    if (discipline) {
      // Filter by resolved discipline name to keep UI values human-readable.
      conditions.push(`${disciplineNameExpr} = ?`);
      params.push(discipline);
    }

    if (inquiryType) {
      conditions.push('si.Inquiry_Type = ?');
      params.push(inquiryType);
    }

    if (normalizedLocation && locationColumn) {
      // Use substring match so 'pune' matches values like 'Pune Branch'.
      conditions.push(`LOWER(TRIM(si.${locationColumn})) LIKE ?`);
      params.push(`%${normalizedLocation}%`);
    }

    if (statusId) {
      conditions.push('si.OnlineState = ?');
      params.push(parseInt(statusId));
    }

    if (dateFrom) {
      conditions.push(`${inquiryDtAsDate} >= ?`);
      params.push(dateFrom);
    }

    if (dateTo) {
      conditions.push(`${inquiryDtAsDate} <= ?`);
      params.push(dateTo);
    }

    const whereClause = conditions.length > 0 ? `WHERE (${conditions.join(') AND (')})` : '';

    // ── Sorting: newest Inquiry_Dt first (Student_Inquiry) ──
    // We keep a temp table to make COUNT + pagination cheap.
    await pool.query(`DROP TEMPORARY TABLE IF EXISTS tmp_sort_keys`);
    await pool.query(
      `CREATE TEMPORARY TABLE tmp_sort_keys (
         Inquiry_Id INT PRIMARY KEY,
         sort_date DATE,
         INDEX(sort_date),
         INDEX(Inquiry_Id)
       ) ENGINE=MEMORY
       SELECT
         si.Inquiry_Id,
         ${inquiryDtAsDate} as sort_date
       FROM Student_Inquiry si
       LEFT JOIN course_mst c ON si.Course_Id = c.Course_Id
       LEFT JOIN MST_Deciplin md ON md.Id = CAST(NULLIF(TRIM(si.Discipline), '') AS UNSIGNED)
       ${whereClause}`
    , params);

    // 2. Count (fast — just count the temp table)
    const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM tmp_sort_keys`);
    const total = (countResult as any[])[0]?.total || 0;

    // 3. Get sorted paginated Student_Ids (fast — indexed sort on MEMORY table)
    const [sortedIds] = await pool.query(
      `SELECT Inquiry_Id, sort_date
       FROM tmp_sort_keys
       ORDER BY sort_date DESC, Inquiry_Id DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    const pageIds = (sortedIds as any[]).map((r: any) => r.Inquiry_Id);
    const sortOrder = new Map((sortedIds as any[]).map((r: any, i: number) => [r.Inquiry_Id, i]));

    // Clean up temp table
    await pool.query(`DROP TEMPORARY TABLE IF EXISTS tmp_sort_keys`);

    // 4. Fetch full data + discussions for just these IDs (fast — only 25 IDs)
    let dataRows: any[] = [];
    if (pageIds.length > 0) {
      const placeholders = pageIds.map(() => '?').join(',');
      const locationSelect = locationColumn
        ? `si.${locationColumn} as Location,`
        : `NULL as Location,`;
      const [rows] = await pool.query(
        `SELECT 
          si.Inquiry_Id as Student_Id,
          si.Student_Id as SourceStudentId,
          si.Student_Name,
          c.Course_Name as CourseName,
          ${resolvedBatchCodeExpr} as Batch_Code,
          si.Inquiry_Dt,
          si.Present_Mobile,
          si.Email,
          ${locationSelect}
          si.Discipline,
          ${disciplineNameExpr} as DisciplineName,
          si.Inquiry_From,
          si.Inquiry_Type,
          si.OnlineState as OnlineStateRaw,
          CAST(NULLIF(si.OnlineState, '') AS UNSIGNED) as Status_id,
          si.Discussion as InlineDiscussion,
          ld.discussion as LatestDiscussion,
          ld.date as LatestDiscDate,
          ld.nextdate as NextFollowUpDate,
          ld.created_by as LatestDiscussionById,
          COALESCE(
            NULLIF(TRIM(CONCAT(COALESCE(au.firstname, ''), ' ', COALESCE(au.lastname, ''))), ''),
            NULLIF(TRIM(au.username), ''),
            NULLIF(TRIM(au.email), ''),
            NULLIF(TRIM(oe.Employee_Name), '')
          ) as LatestDiscussionByName
        FROM Student_Inquiry si
        LEFT JOIN course_mst c ON si.Course_Id = c.Course_Id
        LEFT JOIN MST_Deciplin md ON md.Id = CAST(NULLIF(TRIM(si.Discipline), '') AS UNSIGNED)
        LEFT JOIN (
          SELECT si_map.Inquiry_Id as InquiryId, MAX(d.id) as max_id
          FROM Student_Inquiry si_map
          INNER JOIN awt_inquirydiscussion d
            ON d.deleted = 0
           AND (
             d.Inquiry_id = si_map.Inquiry_Id
             OR d.Inquiry_id = si_map.Student_Id
           )
          WHERE si_map.Inquiry_Id IN (${placeholders})
          GROUP BY si_map.Inquiry_Id
        ) tld ON tld.InquiryId = si.Inquiry_Id
        LEFT JOIN awt_inquirydiscussion ld ON ld.id = tld.max_id
        LEFT JOIN awt_adminuser au ON au.id = ld.created_by
        LEFT JOIN office_employee_mst oe ON oe.Emp_Id = ld.created_by
        WHERE si.Inquiry_Id IN (${placeholders})`,
        [...pageIds, ...pageIds]
      );
      // Re-sort by the original sort order
      dataRows = (rows as any[]).sort((a: any, b: any) => 
        (sortOrder.get(a.Student_Id) ?? 0) - (sortOrder.get(b.Student_Id) ?? 0)
      );
    }

    // 5. Filter options (lightweight queries)
    const [disciplinesResult] = await pool.query(
      `SELECT DISTINCT ${disciplineNameExpr} as Discipline
       FROM Student_Inquiry si
       LEFT JOIN MST_Deciplin md ON md.Id = CAST(NULLIF(TRIM(si.Discipline), '') AS UNSIGNED)
       WHERE ${disciplineNameExpr} IS NOT NULL
         AND ${disciplineNameExpr} != 'NULL'
         AND ${disciplineNameExpr} != 'Select'
         AND (si.IsDelete = 0 OR si.IsDelete IS NULL)
       ORDER BY Discipline`
    );
    const [typesResult] = await pool.query(
      "SELECT DISTINCT Inquiry_Type FROM Student_Inquiry WHERE Inquiry_Type IS NOT NULL AND Inquiry_Type != '' AND (IsDelete = 0 OR IsDelete IS NULL) ORDER BY Inquiry_Type"
    );

    // Build enriched rows
    const rows = (dataRows as any[]).map((r: any) => {
      const inlineDisc = r.InlineDiscussion && r.InlineDiscussion !== 'NULL' ? r.InlineDiscussion : null;
      const sourceStudentId = r.SourceStudentId == null ? '' : String(r.SourceStudentId).trim();
      const inquiryType = r.Inquiry_Type && String(r.Inquiry_Type).trim()
        ? String(r.Inquiry_Type).trim()
        : sourceStudentId === ''
          ? 'Online Inquiry'
          : null;

      const disciplineValue =
        (r.DisciplineName && String(r.DisciplineName).trim() ? String(r.DisciplineName).trim() : null)
        || (r.Discipline && String(r.Discipline).trim() ? String(r.Discipline).trim() : null);
      const batchCodeValue = r.Batch_Code && String(r.Batch_Code).trim()
        ? String(r.Batch_Code).trim()
        : null;

      return {
        Student_Id: r.Student_Id,
        Student_Name: r.Student_Name,
        CourseName: r.CourseName,
        Batch_Code: batchCodeValue,
        Inquiry_Dt: r.Inquiry_Dt,
        Present_Mobile: r.Present_Mobile,
        Email: r.Email,
        Location: r.Location && String(r.Location).trim() ? String(r.Location).trim() : null,
        Discipline: disciplineValue && disciplineValue !== 'NULL' && disciplineValue !== 'Select' ? disciplineValue : null,
        Inquiry_From: r.Inquiry_From,
        Inquiry_Type: inquiryType,
        Status_id: r.Status_id,
        Discussion: r.LatestDiscussion || inlineDisc || null,
        DiscussionDate: r.LatestDiscDate || null,
        NextFollowUpDate: r.NextFollowUpDate || null,
        FollowUpBy: r.LatestDiscussionByName || (r.LatestDiscussionById != null ? `User ${r.LatestDiscussionById}` : null),
      };
    });

    const disciplines = (disciplinesResult as any[]).map((d: any) => d.Discipline);
    const inquiryTypes = (typesResult as any[]).map((t: any) => t.Inquiry_Type);

    // Status mapping (prefer DB; fallback to common labels)
    const fallbackStatusMap: Record<number, string> = {
      1: 'New',
      2: 'Contacted',
      3: 'Inquiry',
      4: 'Follow Up',
      5: 'Interested',
      6: 'Not Interested',
      7: 'Admitted',
      8: 'Closed',
      9: 'DNC',
      10: 'Converted',
      12: 'Pending',
      15: 'Callback',
      16: 'Visited',
      18: 'On Hold',
      19: 'Lost',
      24: 'Hot Lead',
      25: 'Warm Lead',
      26: 'Cold Lead',
      27: 'Enrolled',
      29: 'Dropped',
      33: 'Archived',
    };

    type StatusOption = { id: number; label: string };
    let statusOptions: StatusOption[] = [];

    // Try to load statuses from DB.
    try {
      const [statusRows] = await pool.query(
        `SELECT Status_id as id, Status as label
         FROM awt_status
         WHERE (IsDelete = 0 OR IsDelete IS NULL)
         ORDER BY Status_id`
      );
      statusOptions = (statusRows as any[])
        .map((r: any) => ({ id: Number(r.id), label: String(r.label ?? '').trim() }))
        .filter((s) => Number.isFinite(s.id) && s.id > 0 && s.label.length > 0);
    } catch {
      // Column/table mismatch; ignore and fallback.
    }

    // Fallback for older DBs or empty tables.
    if (statusOptions.length === 0) {
      statusOptions = Object.entries(fallbackStatusMap).map(([id, label]) => ({
        id: parseInt(id, 10),
        label,
      }));
    }

    const statusMap: Record<number, string> = Object.fromEntries(
      statusOptions.map((s) => [s.id, s.label])
    );

    const enrichedRows = rows.map((r: any) => ({
      ...r,
      StatusLabel:
        (typeof r.OnlineStateRaw === 'string' && r.OnlineStateRaw.trim() ? r.OnlineStateRaw.trim() : null)
        || statusMap[r.Status_id]
        || (r.Status_id != null ? `Status ${r.Status_id}` : 'Open'),
    }));

    return NextResponse.json({
      rows: enrichedRows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters: {
        disciplines,
        inquiryTypes,
        statusOptions,
      },
    });
  } catch (error: any) {
    console.error('Inquiry API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inquiry data', details: error.message },
      { status: 500 }
    );
  }
}

/* ---------- PUT — Update existing inquiry ---------- */
export async function PUT(req: NextRequest) {
  try {
    // Back-compat: older code/DBs may have used `inquiry.edit`.
    // Current RBAC uses the standard CRUD permission id `inquiry.update`.
    const auth = await requirePermission(req, ['inquiry.update', 'inquiry.edit']);
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();

    const { Student_Id } = body;
    if (!Student_Id) {
      return NextResponse.json({ error: 'Student_Id is required' }, { status: 400 });
    }
    if (!body.Student_Name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const sql = `
      UPDATE Student_Inquiry SET
        Student_Name = ?, Sex = ?, DOB = ?,
        Present_Mobile = ?, Present_Mobile2 = ?,
        Email = ?, Nationality = ?, Present_Country = ?,
        Discussion = ?, OnlineState = ?, Inquiry_Dt = ?,
        Inquiry_From = ?, Inquiry_Type = ?,
        Course_Id = ?, Batch_Category_id = ?, Batch_Code = ?,
        Qualification = ?, Discipline = ?, Percentage = ?
      WHERE Inquiry_Id = ?
    `;

    const params = [
      body.Student_Name?.trim() || null,
      body.Sex || null,
      body.DOB || null,
      body.Present_Mobile || null,
      body.Present_Mobile2 || null,
      body.Email?.trim() || null,
      body.Nationality || null,
      body.Present_Country || null,
      body.Discussion?.trim() || null,
      body.Status_id ?? 1,
      body.Inquiry_Dt || null,
      body.Inquiry_From || null,
      body.Inquiry_Type || null,
      body.Course_Id || null,
      body.Batch_Category_id || null,
      body.Batch_Code || null,
      body.Qualification || null,
      body.Discipline || null,
      body.Percentage || null,
      Student_Id,
    ];

    await pool.query(sql, params);

    // Also insert into awt_inquirydiscussion if Discussion was provided/changed
    if (body.Discussion?.trim()) {
      await pool.query(
        `INSERT INTO awt_inquirydiscussion (Inquiry_id, date, discussion, deleted, created_by, created_date)
         VALUES (?, CURDATE(), ?, 0, 1, NOW())`,
        [Student_Id, body.Discussion.trim()]
      );
    }

    await logTableActivity(req, {
      tableName: 'Student_Inquiry',
      action: 'UPDATE',
      recordId: Student_Id,
      details: { studentName: body.Student_Name?.trim() || null, statusId: body.Status_id ?? null },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Update inquiry error:', error);
    return NextResponse.json(
      { error: 'Failed to update inquiry', details: message },
      { status: 500 }
    );
  }
}
