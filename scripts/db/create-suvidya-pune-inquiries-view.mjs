import mysql from 'mysql2/promise';

const SUVIDYA_PUNE_VIEW_NAME = 'vw_suvidya_pune_inquiries';

async function resolveInquiryTableName(pool) {
  const [rows] = await pool.query(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND LOWER(TABLE_NAME) = 'student_inquiry'
     ORDER BY CASE WHEN TABLE_NAME = 'Student_Inquiry' THEN 0 ELSE 1 END
     LIMIT 1`
  );

  return String(rows[0]?.TABLE_NAME || 'Student_Inquiry');
}

function buildSuvidyaPuneViewSql(inquiryTable) {
  return `
    CREATE OR REPLACE VIEW ${SUVIDYA_PUNE_VIEW_NAME} AS
    SELECT
      si.Inquiry_Id AS inquiry_id,
      si.Student_Id AS legacy_student_id,
      si.Inquiry_Id AS Student_Id,
      si.Student_Name,
      si.Present_Mobile,
      si.Email,
      si.Inquiry_Dt,
      si.Inquiry_From,
      si.Inquiry_Type,
      si.Qualification,
      si.Discussion,
      sis.source_table_name,
      sis.source_inquiry_id,
      sis.created_date AS source_created_date,
      DATE(STR_TO_DATE(sis.created_date, '%Y-%m-%d %H:%i:%s')) AS source_created_day,
      COALESCE(
        NULLIF(sis.course_name, ''),
        NULLIF(JSON_UNQUOTE(JSON_EXTRACT(sis.payload_json, '$.select_course')), '')
      ) AS source_course,
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(sis.payload_json, '$.your_location')), '') AS source_location,
      COALESCE(
        NULLIF(sis.page_source, ''),
        NULLIF(JSON_UNQUOTE(JSON_EXTRACT(sis.payload_json, '$.page_source')), '')
      ) AS source_page_source,
      CASE
        WHEN LOWER(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(sis.payload_json, '$.your_location')), ''), '')) LIKE '%pune%'
        THEN 1 ELSE 0
      END AS has_pune_location,
      CASE
        WHEN LOWER(COALESCE(
          COALESCE(
            NULLIF(sis.page_source, ''),
            NULLIF(JSON_UNQUOTE(JSON_EXTRACT(sis.payload_json, '$.page_source')), '')
          ),
          ''
        )) LIKE '%pune%'
        THEN 1 ELSE 0
      END AS has_pune_page_source,
      CASE
        WHEN LOWER(COALESCE(si.Inquiry_From, '')) LIKE '%pune%'
          OR LOWER(COALESCE(si.Discussion, '')) LIKE '%pune%'
        THEN 1 ELSE 0
      END AS has_pune_listing_text
    FROM \`${inquiryTable}\` si
    INNER JOIN suvidya_inquiry_sync sis
      ON sis.inquiry_id IN (si.Inquiry_Id, si.Student_Id)
    WHERE
      LOWER(COALESCE(
        COALESCE(
          NULLIF(sis.page_source, ''),
          NULLIF(JSON_UNQUOTE(JSON_EXTRACT(sis.payload_json, '$.page_source')), '')
        ),
        ''
      )) LIKE '%pune%'
      OR LOWER(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(sis.payload_json, '$.your_location')), ''), '')) LIKE '%pune%'
      OR LOWER(COALESCE(si.Inquiry_From, '')) LIKE '%pune%'
      OR LOWER(COALESCE(si.Discussion, '')) LIKE '%pune%'
  `;
}

async function ensureSuvidyaPuneInquiryView(pool) {
  const inquiryTable = await resolveInquiryTableName(pool);
  await pool.query(buildSuvidyaPuneViewSql(inquiryTable));
  return { inquiryTable, viewName: SUVIDYA_PUNE_VIEW_NAME };
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 1,
});

try {
  const { inquiryTable, viewName } = await ensureSuvidyaPuneInquiryView(pool);
  const [rows] = await pool.query(`SELECT COUNT(*) AS count FROM ${SUVIDYA_PUNE_VIEW_NAME}`);
  console.log(JSON.stringify({ inquiryTable, viewName, count: rows[0]?.count ?? 0 }, null, 2));
} finally {
  await pool.end();
}