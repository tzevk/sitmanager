/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

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
      INSERT INTO student_master (
        Student_Name, Sex, DOB, Present_Mobile, Present_Mobile2,
        Email, Nationality, Present_Country, Discussion,
        Status_id, Inquiry_Dt, Inquiry_From, Inquiry_Type,
        Course_Id, Batch_Category_id, Batch_Code,
        Qualification, Discipline, Percentage,
        IsDelete, Inquiry, created_date
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
          sm.Student_Id, sm.Student_Name, sm.Sex, sm.DOB,
          sm.Present_Mobile, sm.Present_Mobile2, sm.Email,
          sm.Nationality, sm.Present_Country, sm.Discussion,
          sm.Status_id, sm.Inquiry_Dt, sm.Inquiry_From, sm.Inquiry_Type,
          sm.Course_Id, sm.Batch_Category_id, sm.Batch_Code,
          sm.Qualification, sm.Discipline, sm.Percentage,
          c.Course_Name as CourseName
        FROM student_master sm
        LEFT JOIN course_mst c ON sm.Course_Id = c.Course_Id
        WHERE sm.Student_Id = ? AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
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
    const statusId = url.searchParams.get('status') || '';
    const dateFrom = url.searchParams.get('dateFrom') || '';
    const dateTo = url.searchParams.get('dateTo') || '';

    // Build WHERE clauses for student_master filters
    const conditions: string[] = [
      '(sm.IsDelete = 0 OR sm.IsDelete IS NULL)',
      "sm.Inquiry = 'Inquiry'",
    ];
    const params: any[] = [];

    if (search) {
      conditions.push(
        '(sm.Student_Name LIKE ? OR sm.Email LIKE ? OR sm.Present_Mobile LIKE ? OR c.Course_Name LIKE ?)'
      );
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    if (discipline) {
      conditions.push('sm.Discipline = ?');
      params.push(discipline);
    }

    if (inquiryType) {
      conditions.push('sm.Inquiry_Type = ?');
      params.push(inquiryType);
    }

    if (statusId) {
      conditions.push('sm.Status_id = ?');
      params.push(parseInt(statusId));
    }

    if (dateFrom) {
      conditions.push('sm.Inquiry_Dt >= ?');
      params.push(dateFrom);
    }

    if (dateTo) {
      conditions.push('sm.Inquiry_Dt <= ?');
      params.push(dateTo);
    }

    const whereClause = conditions.length > 0 ? `WHERE (${conditions.join(') AND (')})` : '';

    // ── Two-step temp table approach for fast activity-based sorting ──

    // Step 1: Pre-aggregate latest discussion id per inquiry (single GROUP BY, ~300ms)
    await pool.query(`DROP TEMPORARY TABLE IF EXISTS tmp_latest_disc`);
    await pool.query(
      `CREATE TEMPORARY TABLE tmp_latest_disc (
         Inquiry_id INT PRIMARY KEY,
         max_id INT,
         INDEX(max_id)
       ) ENGINE=MEMORY
       SELECT CAST(Inquiry_id AS UNSIGNED) as Inquiry_id, MAX(id) as max_id
       FROM awt_inquirydiscussion
       WHERE deleted = 0 AND Inquiry_id IS NOT NULL AND Inquiry_id != ''
       GROUP BY Inquiry_id`
    );

    // Step 2: Build sort-key table via LEFT JOIN (much faster than correlated subquery)
    await pool.query(`DROP TEMPORARY TABLE IF EXISTS tmp_sort_keys`);
    await pool.query(
      `CREATE TEMPORARY TABLE tmp_sort_keys (
         Student_Id INT PRIMARY KEY,
         sort_key INT DEFAULT 0,
         INDEX(sort_key)
       ) ENGINE=MEMORY
       SELECT sm.Student_Id, COALESCE(tld.max_id, 0) as sort_key
       FROM student_master sm
       LEFT JOIN tmp_latest_disc tld ON tld.Inquiry_id = sm.Student_Id
       LEFT JOIN course_mst c ON sm.Course_Id = c.Course_Id
       ${whereClause}`
    , params);
    await pool.query(`DROP TEMPORARY TABLE IF EXISTS tmp_latest_disc`);

    // 2. Count (fast — just count the temp table)
    const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM tmp_sort_keys`);
    const total = (countResult as any[])[0]?.total || 0;

    // 3. Get sorted paginated Student_Ids (fast — indexed sort on MEMORY table)
    const [sortedIds] = await pool.query(
      `SELECT Student_Id, sort_key FROM tmp_sort_keys ORDER BY sort_key DESC, Student_Id DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    const pageIds = (sortedIds as any[]).map((r: any) => r.Student_Id);
    const sortOrder = new Map((sortedIds as any[]).map((r: any, i: number) => [r.Student_Id, i]));

    // Clean up temp table
    await pool.query(`DROP TEMPORARY TABLE IF EXISTS tmp_sort_keys`);

    // 4. Fetch full data + discussions for just these IDs (fast — only 25 IDs)
    let dataRows: any[] = [];
    if (pageIds.length > 0) {
      const placeholders = pageIds.map(() => '?').join(',');
      const [rows] = await pool.query(
        `SELECT 
          sm.Student_Id,
          sm.Student_Name,
          c.Course_Name as CourseName,
          sm.Inquiry_Dt,
          sm.Present_Mobile,
          sm.Email,
          sm.Discipline,
          sm.Inquiry_Type,
          sm.Status_id,
          sm.Discussion as InlineDiscussion,
          ld.discussion as LatestDiscussion,
          ld.date as LatestDiscDate
        FROM student_master sm
        LEFT JOIN course_mst c ON sm.Course_Id = c.Course_Id
        LEFT JOIN (
          SELECT Inquiry_id, MAX(id) as max_id
          FROM awt_inquirydiscussion
          WHERE deleted = 0 AND Inquiry_id IN (${placeholders})
          GROUP BY Inquiry_id
        ) tld ON tld.Inquiry_id = sm.Student_Id
        LEFT JOIN awt_inquirydiscussion ld ON ld.id = tld.max_id
        WHERE sm.Student_Id IN (${placeholders})`,
        [...pageIds, ...pageIds]
      );
      // Re-sort by the original sort order
      dataRows = (rows as any[]).sort((a: any, b: any) => 
        (sortOrder.get(a.Student_Id) ?? 0) - (sortOrder.get(b.Student_Id) ?? 0)
      );
    }

    // 5. Filter options (lightweight queries)
    const [disciplinesResult] = await pool.query(
      "SELECT DISTINCT Discipline FROM student_master WHERE Discipline IS NOT NULL AND Discipline != '' AND Discipline != 'NULL' AND Discipline != 'Select' AND (IsDelete = 0 OR IsDelete IS NULL) AND Inquiry = 'Inquiry' ORDER BY Discipline"
    );
    const [typesResult] = await pool.query(
      "SELECT DISTINCT Inquiry_Type FROM student_master WHERE Inquiry_Type IS NOT NULL AND Inquiry_Type != '' AND (IsDelete = 0 OR IsDelete IS NULL) AND Inquiry = 'Inquiry' ORDER BY Inquiry_Type"
    );

    // Build enriched rows
    const rows = (dataRows as any[]).map((r: any) => {
      const inlineDisc = r.InlineDiscussion && r.InlineDiscussion !== 'NULL' ? r.InlineDiscussion : null;
      return {
        Student_Id: r.Student_Id,
        Student_Name: r.Student_Name,
        CourseName: r.CourseName,
        Inquiry_Dt: r.Inquiry_Dt,
        Present_Mobile: r.Present_Mobile,
        Email: r.Email,
        Discipline: r.Discipline && r.Discipline !== 'NULL' && r.Discipline !== 'Select' ? r.Discipline : null,
        Inquiry_Type: r.Inquiry_Type,
        Status_id: r.Status_id,
        Discussion: r.LatestDiscussion || inlineDisc || null,
        DiscussionDate: r.LatestDiscDate || null,
      };
    });

    const disciplines = (disciplinesResult as any[]).map((d: any) => d.Discipline);
    const inquiryTypes = (typesResult as any[]).map((t: any) => t.Inquiry_Type);

    // Status mapping (since awt_status is empty, use common status labels)
    const statusMap: Record<number, string> = {
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

    const enrichedRows = rows.map((r: any) => ({
      ...r,
      StatusLabel: statusMap[r.Status_id] || `Status ${r.Status_id}`,
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
        statusOptions: Object.entries(statusMap).map(([id, label]) => ({
          id: parseInt(id),
          label,
        })),
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
    const auth = await requirePermission(req, 'inquiry.edit');
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
      UPDATE student_master SET
        Student_Name = ?, Sex = ?, DOB = ?,
        Present_Mobile = ?, Present_Mobile2 = ?,
        Email = ?, Nationality = ?, Present_Country = ?,
        Discussion = ?, Status_id = ?, Inquiry_Dt = ?,
        Inquiry_From = ?, Inquiry_Type = ?,
        Course_Id = ?, Batch_Category_id = ?, Batch_Code = ?,
        Qualification = ?, Discipline = ?, Percentage = ?
      WHERE Student_Id = ?
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
