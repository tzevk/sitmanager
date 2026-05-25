import path from 'path';
import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const app = express();
const PORT = Number(process.env.LEGACY_BACKEND_PORT || 30001);
const configuredConnectionLimit = Number.parseInt(process.env.LEGACY_BACKEND_DB_CONNECTION_LIMIT || '', 10);
const connectionLimit = Number.isFinite(configuredConnectionLimit) && configuredConnectionLimit > 0
  ? configuredConnectionLimit
  : 1;

const requiredEnv = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit,
  maxIdle: 0,
  idleTimeout: 10000,
  queueLimit: 0,
});

async function cleanupPool() {
  try {
    await pool.end();
  } catch {
    // ignore shutdown cleanup failures
  }
}

process.once('SIGINT', cleanupPool);
process.once('SIGTERM', cleanupPool);
process.once('beforeExit', cleanupPool);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));

function buildPhpFetchTarget(queryObj) {
  const baseUrl = process.env.PHP_INQUIRY_API_URL;
  if (!baseUrl) {
    const err = new Error('PHP_INQUIRY_API_URL is not configured');
    err.status = 400;
    throw err;
  }

  const target = new URL(baseUrl);
  for (const [key, value] of Object.entries(queryObj || {})) {
    if (value == null) continue;
    target.searchParams.set(key, String(value));
  }
  return target;
}

async function fetchPhpInquiries(queryObj) {
  const target = buildPhpFetchTarget(queryObj);
  const headers = {};
  if (process.env.PHP_INQUIRY_API_TOKEN) {
    headers.Authorization = `Bearer ${process.env.PHP_INQUIRY_API_TOKEN}`;
  }

  const response = await fetch(target.toString(), { headers });
  const text = await response.text();

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    const trimmed = text.trim().toLowerCase();
    const isSubmitEndpoint = /enquiry-form-ajax\.php/i.test(target.pathname);
    if (isSubmitEndpoint && (trimmed === '' || trimmed === 'required' || trimmed === 'success')) {
      const err = new Error('Configured PHP URL is a submit endpoint, not an inquiry list JSON API');
      err.status = 400;
      err.meta = {
        url: target.toString(),
        responsePreview: text.slice(0, 200),
        hint: 'Use a PHP endpoint that returns JSON list data, or read Student_Inquiry directly via /nodeapp/getinquiriesall.',
      };
      throw err;
    }

    const err = new Error('External PHP endpoint did not return JSON');
    err.status = 502;
    err.meta = { status: response.status, bodyPreview: text.slice(0, 500) };
    throw err;
  }

  if (!response.ok) {
    const err = new Error(`External PHP endpoint returned HTTP ${response.status}`);
    err.status = 502;
    err.meta = { status: response.status, payload };
    throw err;
  }

  const records = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.inquiries)
        ? payload.inquiries
        : [];

  return { payload, records, target: target.toString() };
}

function normalizePhpInquiry(raw) {
  const sourceId = raw?.Inquiry_Id
    ?? raw?.inquiry_id
    ?? raw?.id
    ?? raw?.lead_id
    ?? raw?.form_id
    ?? null;

  const studentName = raw?.Student_Name
    ?? raw?.student_name
    ?? raw?.name
    ?? raw?.full_name
    ?? raw?.txtFname
    ?? null;

  const email = raw?.Email ?? raw?.email ?? raw?.txtEmail ?? null;
  const mobile = raw?.Present_Mobile ?? raw?.present_mobile ?? raw?.mobile ?? raw?.phone ?? raw?.txtMobile ?? null;
  const qualification = raw?.Qualification ?? raw?.qualification ?? raw?.ddlQualification ?? null;
  const discipline = raw?.Discipline ?? raw?.discipline ?? raw?.ddlDiscipline ?? null;
  const percentage = raw?.Percentage ?? raw?.percentage ?? raw?.txtPercentage ?? null;
  const gender = raw?.Sex ?? raw?.sex ?? raw?.gender ?? null;
  const dob = raw?.DOB ?? raw?.dob ?? raw?.ddlBirthDate ?? null;

  const courseId = raw?.Course_Id ?? raw?.course_id ?? raw?.ddlCourse ?? null;
  const courseType = raw?.Batch_Category_id ?? raw?.batch_category_id ?? raw?.course_type ?? raw?.ddlCourseType ?? null;

  const address = raw?.Present_Address ?? raw?.present_address ?? raw?.address ?? raw?.txtAddress ?? null;
  const city = raw?.Present_City ?? raw?.present_city ?? raw?.city ?? raw?.txtCity ?? null;
  const state = raw?.Present_State ?? raw?.present_state ?? raw?.state ?? raw?.txtState ?? null;
  const country = raw?.Present_Country ?? raw?.present_country ?? raw?.country ?? raw?.ddlCountry ?? null;
  const nationality = raw?.Nationality ?? raw?.nationality ?? raw?.ddlNationality ?? null;
  const phone = raw?.Present_Tel ?? raw?.present_tel ?? raw?.telephone ?? raw?.txtPhone ?? null;

  const inquiryDate = raw?.Inquiry_Dt ?? raw?.inquiry_date ?? raw?.created_at ?? raw?.date ?? null;
  const discussion = raw?.Discussion ?? raw?.discussion ?? raw?.message ?? raw?.notes ?? raw?.txtNotes ?? raw?.Remark ?? null;
  const remark = raw?.Remark ?? raw?.remark ?? raw?.notes ?? raw?.txtNotes ?? null;
  const referBy = raw?.Refered_By ?? raw?.refered_by ?? raw?.refer_by ?? null;
  const inquiryType = raw?.Inquiry_type ?? raw?.inquiry_type ?? 'Website-PHP';

  const normalizedEmail = email == null ? null : String(email).trim();
  const normalizedCourseId = courseId == null || String(courseId).trim() === '' ? null : String(courseId).trim();
  const normalizedMobile = mobile == null ? null : String(mobile).trim();
  const normalizedDate = inquiryDate ? String(inquiryDate).slice(0, 10) : new Date().toISOString().slice(0, 10);
  const derivedSourceId = normalizedEmail && normalizedCourseId && normalizedMobile
    ? `${normalizedEmail}|${normalizedCourseId}|${normalizedMobile}|${normalizedDate}`
    : null;

  return {
    sourceId: sourceId == null ? derivedSourceId : String(sourceId),
    studentName: studentName == null ? null : String(studentName).trim(),
    email: normalizedEmail,
    mobile: normalizedMobile,
    qualification: qualification == null ? null : String(qualification).trim(),
    discipline: discipline == null ? null : String(discipline).trim(),
    percentage: percentage == null ? null : String(percentage).trim(),
    gender: gender == null ? null : String(gender).trim(),
    dob: dob == null ? null : String(dob).slice(0, 10),
    courseId: normalizedCourseId,
    courseType: courseType == null || String(courseType).trim() === '' ? null : String(courseType).trim(),
    address: address == null ? null : String(address).trim(),
    city: city == null ? null : String(city).trim(),
    state: state == null ? null : String(state).trim(),
    country: country == null ? null : String(country).trim(),
    nationality: nationality == null ? null : String(nationality).trim(),
    phone: phone == null ? null : String(phone).trim(),
    inquiryDate: normalizedDate,
    discussion: discussion == null ? null : String(discussion),
    remark: remark == null ? null : String(remark),
    referBy: referBy == null ? null : String(referBy).trim(),
    inquiryType: String(inquiryType),
  };
}

async function ensureSyncMapTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS website_inquiry_sync_map (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      source_name VARCHAR(64) NOT NULL,
      source_inquiry_id VARCHAR(191) NOT NULL,
      local_inquiry_id BIGINT UNSIGNED NOT NULL,
      last_synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_source_record (source_name, source_inquiry_id),
      KEY idx_local_inquiry_id (local_inquiry_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `;
  await pool.query(sql);
}

app.get('/nodeapp/health', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    res.json({ ok: true, db: rows[0]?.ok === 1, port: PORT });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Matches the old appp.js behavior for inquiry listing with pagination.
app.post('/nodeapp/getadmissionactivity', async (req, res) => {
  const page = Math.max(0, Number(req.body?.page ?? 0));
  const pageSize = Math.min(100, Math.max(1, Number(req.body?.pageSize ?? 10)));
  const offset = page * pageSize;

  const sql = `
    SELECT
      i.Inquiry_Id AS id,
      COALESCE(i.Student_Id, sm.Student_Id) AS Student_Id,
      COALESCE(i.Student_Name, sm.Student_Name) AS Student_Name,
      COALESCE(i.Course_Id, sm.Course_Id) AS Course_Id,
      COALESCE(i.Qualification, sm.Qualification) AS Qualification,
      COALESCE(i.Present_Mobile, sm.Present_Mobile) AS Present_Mobile,
      COALESCE(i.Email, sm.Email) AS Email,
      COALESCE(i.Inquiry_type, sm.Inquiry_type) AS Inquiry_type,
      COALESCE(i.Inquiry_Dt, sm.Inquiry_Dt) AS Inquiry_Dt,
      c.Course_Name,
      COALESCE(i.Percentage, sm.Percentage) AS Percentage,
      COALESCE(i.Discussion, sm.Discussion) AS Discussion,
      sm_status.Status,
      COALESCE(i.IsUnread, sm.IsUnread) AS IsUnread
    FROM Student_Inquiry AS i
    LEFT JOIN Student_Master AS sm ON i.Student_Id = sm.Student_Id
    LEFT JOIN Course_Mst AS c ON COALESCE(i.Course_Id, sm.Course_Id) = c.Course_Id
    LEFT JOIN Status_Master AS sm_status ON sm_status.Id = COALESCE(i.OnlineState, sm.OnlineState)
    WHERE COALESCE(i.isDelete, sm.IsDelete) = 0
      AND COALESCE(i.Admission, sm.Admission) != 1
    ORDER BY COALESCE(i.Inquiry_Dt, sm.Inquiry_Dt) DESC
    LIMIT ? OFFSET ?
  `;

  const countSql = 'SELECT COUNT(*) AS totalCount FROM Student_Inquiry i WHERE i.isDelete = 0 AND i.Admission != 1';

  try {
    const [data] = await pool.query(sql, [pageSize, offset]);
    const [countRows] = await pool.query(countSql);
    res.json({
      data,
      totalCount: Number(countRows[0]?.totalCount || 0),
      page,
      pageSize,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fetch all inquiries written by website/PHP form into Student_Inquiry.
app.get('/nodeapp/getinquiriesall', async (req, res) => {
  const fromDate = req.query.fromDate ? String(req.query.fromDate) : null;
  const toDate = req.query.toDate ? String(req.query.toDate) : null;
  const includeAdmission = String(req.query.includeAdmission || 'false') === 'true';
  const limit = Math.min(50000, Math.max(1, Number(req.query.limit || 10000)));

  let where = 'WHERE i.isDelete = 0';
  const params = [];

  if (!includeAdmission) {
    where += ' AND COALESCE(i.Admission, 0) != 1';
  }
  if (fromDate) {
    where += ' AND i.Inquiry_Dt >= ?';
    params.push(fromDate);
  }
  if (toDate) {
    where += ' AND i.Inquiry_Dt <= ?';
    params.push(toDate);
  }

  const sql = `
    SELECT
      i.Inquiry_Id,
      i.Student_Id,
      i.Student_Name,
      i.Email,
      i.Present_Mobile,
      i.Course_Id,
      c.Course_Name,
      i.Qualification,
      i.Inquiry_type,
      i.Discussion,
      i.Inquiry_Dt,
      i.IsUnread,
      i.Admission
    FROM Student_Inquiry i
    LEFT JOIN Course_Mst c ON c.Course_Id = i.Course_Id
    ${where}
    ORDER BY i.Inquiry_Id DESC
    LIMIT ?
  `;

  try {
    const [rows] = await pool.query(sql, [...params, limit]);
    res.json({ count: rows.length, data: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Optional: fetch from external PHP API (if another website stores inquiries in a different DB).
app.get('/nodeapp/fetch-php-inquiries', async (req, res) => {
  try {
    const { payload } = await fetchPhpInquiries(req.query || {});
    return res.json(payload);
  } catch (error) {
    const status = error?.status || 500;
    return res.status(status).json({
      error: error.message,
      ...(error?.meta ? { meta: error.meta } : {}),
      ...(status === 400 ? { hint: 'Set PHP_INQUIRY_API_URL in .env.local' } : {}),
    });
  }
});

// Fetch from external PHP endpoint and upsert into local Student_Inquiry.
app.post('/nodeapp/sync-php-inquiries', async (req, res) => {
  const sourceName = String(req.body?.sourceName || 'php-website');
  const dryRun = Boolean(req.body?.dryRun);
  const passthroughQuery = req.body?.query && typeof req.body.query === 'object' ? req.body.query : {};
  const syncLimit = Math.min(5000, Math.max(1, Number(req.body?.limit || 500)));

  try {
    let records;
    let target;

    try {
      const fetched = await fetchPhpInquiries(passthroughQuery);
      records = fetched.records;
      target = fetched.target;
    } catch (fetchError) {
      const submitEndpointDetected =
        fetchError?.message === 'Configured PHP URL is a submit endpoint, not an inquiry list JSON API';

      if (!submitEndpointDetected) {
        throw fetchError;
      }

      // Fallback: when only submit endpoint is available, use local Student_Inquiry as source.
      const [localRows] = await pool.query(
        `
          SELECT
            Inquiry_Id,
            Student_Name,
            Email,
            Present_Mobile,
            Qualification,
            Discipline,
            Percentage,
            Sex,
            DOB,
            Course_Id,
            Batch_Category_id,
            Present_Address,
            Present_City,
            Present_State,
            Present_Country,
            Nationality,
            Present_Tel,
            Inquiry_Dt,
            Discussion,
            Remark,
            Refered_By,
            Inquiry_type
          FROM Student_Inquiry
          WHERE COALESCE(IsDelete, 0) = 0
          ORDER BY Inquiry_Id DESC
          LIMIT 20000
        `,
      );

      records = localRows;
      target = 'local-db://Student_Inquiry (fallback from submit-only PHP endpoint)';
    }

    records = Array.isArray(records) ? records.slice(0, syncLimit) : [];

    await ensureSyncMapTable();

    const summary = {
      source: sourceName,
      fetchedFrom: target,
      limit: syncLimit,
      fetchedCount: records.length,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    for (let idx = 0; idx < records.length; idx += 1) {
      const raw = records[idx];
      const normalized = normalizePhpInquiry(raw);

      if (!normalized.sourceId) {
        summary.skipped += 1;
        summary.errors.push({ index: idx, reason: 'Missing source inquiry id', record: raw });
        continue;
      }
      if (!normalized.studentName || !normalized.mobile) {
        summary.skipped += 1;
        summary.errors.push({ index: idx, reason: 'Missing required studentName/mobile', sourceId: normalized.sourceId });
        continue;
      }

      try {
        const [mapRows] = await pool.query(
          'SELECT local_inquiry_id FROM website_inquiry_sync_map WHERE source_name = ? AND source_inquiry_id = ? LIMIT 1',
          [sourceName, normalized.sourceId],
        );

        if (dryRun) {
          if (mapRows.length > 0) summary.updated += 1;
          else summary.inserted += 1;
          continue;
        }

        if (mapRows.length > 0) {
          const localInquiryId = Number(mapRows[0].local_inquiry_id);
          await pool.query(
            `
              UPDATE Student_Inquiry
              SET Student_Name = ?, Email = ?, Present_Mobile = ?, Qualification = ?,
                  Discipline = ?, Percentage = ?, Sex = ?, DOB = ?,
                  Course_Id = ?, Batch_Category_id = ?,
                  Present_Address = ?, Present_City = ?, Present_State = ?, Present_Country = ?,
                  Nationality = ?, Present_Tel = ?,
                  Inquiry_Dt = ?, StateChangeDt = ?,
                  Discussion = ?, Remark = ?, Refered_By = ?, Inquiry_type = ?, IsUnread = 1
              WHERE Inquiry_Id = ?
            `,
            [
              normalized.studentName,
              normalized.email,
              normalized.mobile,
              normalized.qualification,
              normalized.discipline,
              normalized.percentage,
              normalized.gender,
              normalized.dob,
              normalized.courseId,
              normalized.courseType,
              normalized.address,
              normalized.city,
              normalized.state,
              normalized.country,
              normalized.nationality,
              normalized.phone,
              normalized.inquiryDate,
              normalized.inquiryDate,
              normalized.discussion,
              normalized.remark,
              normalized.referBy,
              normalized.inquiryType,
              localInquiryId,
            ],
          );

          await pool.query(
            'UPDATE website_inquiry_sync_map SET last_synced_at = CURRENT_TIMESTAMP WHERE source_name = ? AND source_inquiry_id = ?',
            [sourceName, normalized.sourceId],
          );
          summary.updated += 1;
        } else {
          const [duplicateRows] = await pool.query(
            `
              SELECT Inquiry_Id
              FROM Student_Inquiry
              WHERE Email = ? AND Course_Id = ? AND COALESCE(IsDelete, 0) = 0
              LIMIT 1
            `,
            [normalized.email, normalized.courseId],
          );

          if (duplicateRows.length > 0) {
            summary.skipped += 1;
            summary.errors.push({
              index: idx,
              sourceId: normalized.sourceId,
              reason: 'Email already exists for this course (active record)',
            });
            continue;
          }

          if (!dryRun && normalized.email) {
            await pool.query(
              'UPDATE Student_Inquiry SET IsDelete = 1 WHERE Email = ? AND COALESCE(IsDelete, 0) = 0',
              [normalized.email],
            );
          }

          const [insertResult] = await pool.query(
            `
              INSERT INTO Student_Inquiry
                (
                  Course_Id, Batch_Category_id, Student_Name, Qualification, Discipline, Percentage,
                  Sex, DOB,
                  Present_Address, Present_City, Present_State, Present_Country,
                  Nationality, Present_Mobile, Present_Tel,
                  Email, Remark, Refered_By,
                  Inquiry_Dt, StateChangeDt,
                  Discussion, Inquiry_type, IsUnread
                )
              VALUES
                (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            `,
            [
              normalized.courseId,
              normalized.courseType,
              normalized.studentName,
              normalized.qualification,
              normalized.discipline,
              normalized.percentage,
              normalized.gender,
              normalized.dob,
              normalized.address,
              normalized.city,
              normalized.state,
              normalized.country,
              normalized.nationality,
              normalized.mobile,
              normalized.phone,
              normalized.email,
              normalized.remark,
              normalized.referBy,
              normalized.inquiryDate,
              normalized.inquiryDate,
              normalized.discussion,
              normalized.inquiryType,
            ],
          );

          const localInquiryId = Number(insertResult.insertId);
          await pool.query(
            `
              INSERT INTO website_inquiry_sync_map (source_name, source_inquiry_id, local_inquiry_id, last_synced_at)
              VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            `,
            [sourceName, normalized.sourceId, localInquiryId],
          );
          summary.inserted += 1;
        }
      } catch (itemError) {
        summary.errors.push({
          index: idx,
          sourceId: normalized.sourceId,
          reason: itemError.message,
        });
      }
    }

    return res.json(summary);
  } catch (error) {
    const status = error?.status || 500;
    return res.status(status).json({
      error: error.message,
      ...(error?.meta ? { meta: error.meta } : {}),
    });
  }
});

// Maintenance: mirrors legacy PHP loop for awt_inquirydiscussion backfill.
app.post('/nodeapp/fix-inquiry-discussion-inquiry-id', async (req, res) => {
  const dryRun = req.body?.dryRun !== false;
  const limit = Math.min(5000, Math.max(1, Number(req.body?.limit || 500)));

  const selectSql = `
    SELECT id, Inquiry_id, student_id
    FROM awt_inquirydiscussion
    WHERE Inquiry_id IS NULL
      AND student_id IS NOT NULL
    ORDER BY id DESC
    LIMIT ?
  `;

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(selectSql, [limit]);
    let updated = 0;
    let skipped = 0;
    const errors = [];

    if (!dryRun) {
      await conn.beginTransaction();
    }

    for (const row of rows) {
      const id = Number(row.id);
      const studentId = row.student_id == null ? null : String(row.student_id).trim();

      if (!studentId) {
        skipped += 1;
        continue;
      }

      const [inquiryRows] = await conn.query(
        `
          SELECT Inquiry_Id
          FROM Student_Inquiry
          WHERE Student_Id = ?
          ORDER BY Inquiry_Id DESC
          LIMIT 1
        `,
        [studentId],
      );

      const targetInquiryId = inquiryRows[0]?.Inquiry_Id ?? null;
      if (!targetInquiryId) {
        skipped += 1;
        continue;
      }

      if (dryRun) {
        updated += 1;
        continue;
      }

      try {
        const [result] = await conn.query(
          'UPDATE awt_inquirydiscussion SET Inquiry_id = ? WHERE id = ?',
          [targetInquiryId, id],
        );

        if (Number(result.affectedRows) > 0) {
          updated += 1;
        } else {
          skipped += 1;
        }
      } catch (rowError) {
        errors.push({ id, studentId, reason: rowError.message });
      }
    }

    if (!dryRun) {
      if (errors.length > 0) {
        await conn.rollback();
      } else {
        await conn.commit();
      }
    }

    return res.json({
      dryRun,
      limit,
      totalCandidates: rows.length,
      updated,
      skipped,
      errorCount: errors.length,
      errors,
      note: dryRun
        ? 'Dry run only. Re-run with {"dryRun": false} to apply updates.'
        : errors.length > 0
          ? 'Transaction rolled back due to row errors.'
          : 'Updates committed successfully.',
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  } finally {
    conn.release();
  }
});

// API-only endpoint for Shopify/custom website forms.
app.post('/nodeapp/website-inquiry', async (req, res) => {
  const {
    studentName,
    email,
    mobile,
    qualification,
    courseId,
    city,
    inquiryDate,
    discussion,
    inquiryType,
  } = req.body || {};

  if (!studentName || !mobile) {
    return res.status(400).json({ error: 'studentName and mobile are required' });
  }

  const insertSql = `
    INSERT INTO Student_Inquiry
      (Email, Student_Name, Present_Mobile, Qualification, Course_Id, Present_City, Inquiry_Dt, Discussion, Inquiry_type, IsUnread)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `;

  try {
    const [result] = await pool.query(insertSql, [
      email || null,
      studentName,
      mobile,
      qualification || null,
      courseId || null,
      city || null,
      inquiryDate || new Date().toISOString().slice(0, 10),
      discussion || null,
      inquiryType || 'Website',
    ]);

    res.status(201).json({
      message: 'Inquiry created',
      inquiryId: result.insertId,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`appp-lite listening on port ${PORT}`);
});
