/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { apiRateLimiter } from '@/lib/rate-limit';
import { sendOnlineAdmissionSubmissionEmail } from '@/lib/mailer';

const ONLINE_ADMISSION_PAYLOAD_TABLE = 'online_admission_payload';

// Cache the schema-check across requests so we don't run INFORMATION_SCHEMA
// queries on every page load. Reset on hot-reload (module re-evaluates).
let payloadTableReady = false;

// MySQL "zero" datetime values surface as '0000-00-00 00:00:00' or epoch — both
// produce Invalid Date in JS. Normalize to null so the UI shows '—'.
function safeDate(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value);
  if (!s || s.startsWith('0000-')) return null;
  const t = new Date(s).getTime();
  if (!Number.isFinite(t) || t <= 0) return null;
  return s;
}

const fallbackStatusMap: Record<number, string> = {
  0: 'New Inquiry', 1: 'Follow Up', 2: 'Interested', 3: 'Confirmed',
  4: 'Not Interested', 5: 'Batch Started', 6: 'Batch Completed',
  7: 'Cancelled', 8: 'Admitted', 9: 'Left', 10: 'On Hold',
  12: 'Prospective', 13: 'Walk In', 15: 'Re-inquiry',
  16: 'Demo Attended', 17: 'Demo Scheduled', 19: 'Online Inquiry',
  23: 'Document Pending', 24: 'Fees Pending', 25: 'Transfer',
  26: 'Need Based Training', 27: 'Duplicate', 29: 'Corporate',
  34: 'Assessment Done', 35: 'Refund', 40: 'Counselling Done',
};

async function ensurePayloadTable(pool: any) {
  if (payloadTableReady) return;

  try {
    const [pkRows] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY'
       LIMIT 1`,
      [ONLINE_ADMISSION_PAYLOAD_TABLE]
    ) as [any[], any];

    const pkCol: string = String((pkRows as any[])[0]?.COLUMN_NAME ?? '');

    if (pkCol && pkCol !== 'Inquiry_Id') {
      console.log(`[online_admission_payload] dropping old schema (PK was ${pkCol})`);
      await pool.query(`DROP TABLE ${ONLINE_ADMISSION_PAYLOAD_TABLE}`);
    }
  } catch {
    // Table doesn't exist yet — CREATE below handles it
  }

  await pool.query(
    `CREATE TABLE IF NOT EXISTS ${ONLINE_ADMISSION_PAYLOAD_TABLE} (
      Inquiry_Id INT NOT NULL PRIMARY KEY,
      Payload    LONGTEXT NULL,
      Created_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      Updated_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );

  payloadTableReady = true;
}

async function savePayload(pool: any, inquiryId: number, body: any) {
  await ensurePayloadTable(pool);
  await pool.query(
    `INSERT INTO ${ONLINE_ADMISSION_PAYLOAD_TABLE} (Inquiry_Id, Payload)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE Payload = VALUES(Payload), Updated_At = NOW()`,
    [inquiryId, JSON.stringify(body)]
  );
}

/* ─── GET — listing ─────────────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  try {
    const rateLimited = apiRateLimiter(req);
    if (rateLimited) return rateLimited;

    const auth = await requirePermission(req, 'online_admission.view');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);

    const page   = Math.max(1, Number(searchParams.get('page'))  || 1);
    const limit  = Math.min(100, Math.max(10, Number(searchParams.get('limit')) || 25));
    const offset = (page - 1) * limit;
    // Cap rows pulled from each source so we don't ship the whole table for
    // an admin listing. Sort/paginate happens in JS after the merge.
    const fetchCap = Math.min(2000, offset + limit * 4);

    const search         = searchParams.get('search')?.trim()  || '';
    const statusCategory = (searchParams.get('statusCategory') || '').trim().toLowerCase();
    const dateFrom       = searchParams.get('dateFrom') || '';
    const dateTo         = searchParams.get('dateTo')   || '';

    await ensurePayloadTable(pool);

    /* ---- New entries: have a payload record ---- */
    const newConditions: string[] = [
      `(si.IsDelete = 0 OR si.IsDelete IS NULL)`,
    ];
    const newParams: (string | number)[] = [];

    if (search) {
      newConditions.push(
        `(si.Student_Name LIKE ? OR si.Email LIKE ? OR si.Present_Mobile LIKE ? OR CAST(si.Inquiry_Id AS CHAR) LIKE ?)`
      );
      const like = `%${search}%`;
      newParams.push(like, like, like, like);
    }
    if (dateFrom) { newConditions.push('oap.Created_At >= ?'); newParams.push(dateFrom); }
    if (dateTo)   { newConditions.push('oap.Created_At <= ?'); newParams.push(dateTo); }

    const [newRows] = await pool.query<any[]>(
      `SELECT
         si.Inquiry_Id                                        AS Inquiry_Id,
         COALESCE(si.Student_Name, sm.Student_Name, '')       AS Student_Name,
         COALESCE(si.Email, sm.Email, '')                     AS Email,
         COALESCE(si.Present_Mobile, sm.Present_Mobile, '')   AS Present_Mobile,
         COALESCE(sm.Batch_Code, si.Batch_Code, '')           AS Batch_code,
         COALESCE(sm.Admission_Dt, oap.Created_At)            AS Admission_Date,
         COALESCE(sm.Status_id, si.OnlineState)               AS Status_id,
         COALESCE(stm_sm.Status, stm_si.Status, '')           AS StatusText
       FROM ${ONLINE_ADMISSION_PAYLOAD_TABLE} oap
       JOIN Student_Inquiry si ON si.Inquiry_Id = oap.Inquiry_Id
       LEFT JOIN student_master sm
         ON sm.Student_Id = si.Student_Id AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
       LEFT JOIN Status_Master stm_sm ON stm_sm.Id = sm.Status_id
       LEFT JOIN Status_Master stm_si ON stm_si.Id = si.OnlineState
       WHERE ${newConditions.join(' AND ')}
       ORDER BY oap.Created_At DESC
       LIMIT ?`,
      [...newParams, fetchCap]
    );

    /* ---- Link-sent entries: Student_Inquiry with admission_done=2 (admission link sent) ----
       Status comes from student_master.Status_id which tracks the actual admission state:
       8=Admission Taken / 9=Accepted → green, 5=Closed → red, else → open/black. */
    let oldRows: any[] = [];
    try {
      const oldConditions: string[] = [
        `si.admission_done = 2`,
        `si.Student_Id IS NOT NULL`,
        `(si.IsDelete = 0 OR si.IsDelete IS NULL)`,
        `NOT EXISTS (
           SELECT 1 FROM ${ONLINE_ADMISSION_PAYLOAD_TABLE} oap2
           WHERE oap2.Inquiry_Id = si.Inquiry_Id
         )`,
      ];
      const oldParams: (string | number)[] = [];

      if (search) {
        oldConditions.push(
          `(si.Student_Name LIKE ? OR sm.Student_Name LIKE ? OR si.Email LIKE ? OR sm.Email LIKE ? OR si.Present_Mobile LIKE ? OR sm.Present_Mobile LIKE ? OR CAST(si.Inquiry_Id AS CHAR) LIKE ?)`
        );
        const like = `%${search}%`;
        oldParams.push(like, like, like, like, like, like, like);
      }
      if (dateFrom) { oldConditions.push('sm.Admission_Dt >= ?'); oldParams.push(dateFrom); }
      if (dateTo)   { oldConditions.push('sm.Admission_Dt <= ?'); oldParams.push(dateTo); }

      const [result] = await pool.query<any[]>(
        `SELECT
           si.Inquiry_Id                                       AS Admission_Id,
           si.Inquiry_Id                                       AS Inquiry_Id,
           COALESCE(sm.Student_Name, si.Student_Name, '')      AS Student_Name,
           COALESCE(sm.Email, si.Email, '')                    AS Email,
           COALESCE(sm.Present_Mobile, si.Present_Mobile, '')  AS Present_Mobile,
           COALESCE(sm.Batch_Code, si.Batch_Code, '')          AS Batch_code,
           sm.Admission_Dt                                     AS Admission_Date,
           sm.Status_id                                        AS Status_id,
           COALESCE(stm.Status, '')                            AS StatusText,
           1                                                   AS IsLegacy
         FROM Student_Inquiry si
         JOIN student_master sm
           ON sm.Student_Id = si.Student_Id AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
         LEFT JOIN Status_Master stm ON stm.Id = sm.Status_id
         WHERE ${oldConditions.join(' AND ')}
         ORDER BY si.Inquiry_Id DESC
         LIMIT ?`,
        [...oldParams, fetchCap]
      );
      oldRows = result as any[];
    } catch (oldErr: any) {
      console.warn('Online Admission link-sent entries query skipped:', oldErr?.message);
    }

    /* ---- Combine — new entries first, then old. No dedupe by id. ---- */
    let allRows: any[] = [
      ...(newRows as any[]).map((r: any) => ({
        ...r,
        Admission_Id: r.Inquiry_Id,
        IsLegacy: 0,
      })),
      ...oldRows,
    ];

    /* ---- Status options (built before filtering so the dropdown is complete) ---- */
    const statusOptions: { id: number; label: string }[] = [];
    const seen = new Set<number>();
    const pushStatus = (id: number, label: string) => {
      if (!Number.isFinite(id) || seen.has(id)) return;
      statusOptions.push({ id, label });
      seen.add(id);
    };

    try {
      const [dbStatuses] = await pool.query<any[]>(
        `SELECT DISTINCT sm.Status_id as id, COALESCE(MAX(stm.Status), '') as label
         FROM Student_Inquiry si
         JOIN student_master sm
           ON sm.Student_Id = si.Student_Id AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
         LEFT JOIN Status_Master stm ON stm.Id = sm.Status_id
         WHERE si.admission_done = 2 AND (si.IsDelete = 0 OR si.IsDelete IS NULL)
         GROUP BY sm.Status_id ORDER BY sm.Status_id`
      );
      for (const r of dbStatuses as any[]) pushStatus(Number(r.id), r.label);
    } catch { /* ignore */ }

    for (const [id, label] of Object.entries(fallbackStatusMap)) {
      pushStatus(Number(id), label);
    }
    statusOptions.sort((a, b) => a.id - b.id);

    const statusLabelMap: Record<number, string> = Object.fromEntries(
      statusOptions.map(s => [s.id, s.label])
    );

    const categoryLabel = (statusId: number, statusText: string): 'open' | 'accepted' | 'closed' => {
      // Status_id from student_master: 8=Admission Taken, 9=Accepted, 10=Accepted Closed → green
      // Status_id 5=Closed, 11=Denied, 13=Close, 27=Not interested (closed) → red
      if ([8, 9, 10].includes(statusId)) return 'accepted';
      if ([5, 11, 13, 27].includes(statusId)) return 'closed';
      const base = (statusText || '').toLowerCase();
      if (/accepted|admitted|confirm|taken/.test(base)) return 'accepted';
      if (/cancel|reject|closed|not interested|drop|left|denied/.test(base)) return 'closed';
      return 'open';
    };

    // Enrich with labels and normalize date fields so the UI never shows "Invalid Date"
    allRows = allRows.map((r: any) => {
      const label = String(r.StatusText || statusLabelMap[r.Status_id] || '').trim() || 'Open';
      return {
        ...r,
        Admission_Date: safeDate(r.Admission_Date),
        DOB: safeDate(r.DOB),
        StatusLabel: label,
        StatusCategory: categoryLabel(Number(r.Status_id), label),
      };
    });

    if (statusCategory) {
      allRows = allRows.filter((r: any) => (r.StatusCategory as string).toLowerCase() === statusCategory);
    }

    allRows.sort((a: any, b: any) => {
      const da = a.Admission_Date ? new Date(a.Admission_Date).getTime() : 0;
      const db = b.Admission_Date ? new Date(b.Admission_Date).getTime() : 0;
      return db - da;
    });

    const total = allRows.length;
    const pageRows = allRows.slice(offset, offset + limit);

    return NextResponse.json({
      rows: pageRows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      statusOptions,
    });
  } catch (err: unknown) {
    console.error('Online Admission GET error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/* ─── POST — form submission ────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  try {
    const rateLimited = apiRateLimiter(req);
    if (rateLimited) return rateLimited;

    const pool = getPool();
    const body = await req.json();

    if (!body.inquiryId) {
      return NextResponse.json({ error: 'Inquiry ID is required' }, { status: 400 });
    }

    const inquiryId = Number(body.inquiryId);
    if (!Number.isFinite(inquiryId) || inquiryId <= 0) {
      return NextResponse.json({ error: 'Invalid Inquiry ID' }, { status: 400 });
    }

    // Validate inquiry exists
    const [siRows] = await pool.query<any[]>(
      `SELECT Inquiry_Id, Student_Name, Email
       FROM Student_Inquiry
       WHERE Inquiry_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL)`,
      [inquiryId]
    );
    if (!(siRows as any[]).length) {
      return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 });
    }

    const inquiry = (siRows as any[])[0];

    // Strip non-serializable File objects before saving payload
    const stripFiles = (arr: any[]) =>
      Array.isArray(arr) ? arr.map(({ marksheetFile: _f, ...rest }: any) => rest) : arr;

    const cleanBody = {
      ...body,
      ssc_ktDetails:      stripFiles(body.ssc_ktDetails),
      hsc_ktDetails:      stripFiles(body.hsc_ktDetails),
      diploma_ktDetails:  stripFiles(body.diploma_ktDetails),
      grad_ktDetails:     stripFiles(body.grad_ktDetails),
      postgrad_ktDetails: stripFiles(body.postgrad_ktDetails),
    };

    // Save full form payload keyed by Inquiry_Id
    await savePayload(pool, inquiryId, cleanBody);

    // Update inquiry: mark as "Document Pending" (shows as Open until admin accepts)
    // Also update basic contact info from the form so it's visible in the listing
    const fullName = [body.firstName, body.middleName, body.lastName].filter(Boolean).join(' ');
    try {
      await pool.query(
        `UPDATE Student_Inquiry
         SET OnlineState = 23,
             Student_Name = COALESCE(NULLIF(?, ''), Student_Name),
             Email        = COALESCE(NULLIF(?, ''), Email),
             Present_Mobile = COALESCE(NULLIF(?, ''), Present_Mobile),
             Batch_Code   = COALESCE(NULLIF(?, ''), Batch_Code)
         WHERE Inquiry_Id = ?`,
        [fullName || null, body.email || null, body.mobile || null, body.batchCode || null, inquiryId]
      );
    } catch (siErr: any) {
      console.warn('Student_Inquiry update skipped:', siErr?.message);
    }

    // Send confirmation email
    const recipientEmail = String(body?.email || inquiry?.Email || '').trim();
    const studentName    = fullName || String(inquiry?.Student_Name || '').trim();
    if (recipientEmail) {
      try {
        await sendOnlineAdmissionSubmissionEmail({
          toEmail: recipientEmail,
          studentName,
          applicationId: inquiryId,
        });
      } catch (mailErr) {
        console.error('Online Admission confirmation email error:', mailErr);
      }
    }

    console.log(`[online-admission POST] saved payload for inquiryId=${inquiryId}`);

    return NextResponse.json({
      success: true,
      inquiryId,
      message: 'Application submitted successfully',
    });
  } catch (err: unknown) {
    console.error('Online Admission POST error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
