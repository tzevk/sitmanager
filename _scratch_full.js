require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

const BATCH_SDATE_EXPR = `COALESCE(
    STR_TO_DATE(CAST(b.SDate AS CHAR), '%Y-%m-%d'),
    STR_TO_DATE(CAST(b.SDate AS CHAR), '%d-%m-%Y'),
    STR_TO_DATE(CAST(b.SDate AS CHAR), '%d/%m/%Y'),
    STR_TO_DATE(CAST(b.SDate AS CHAR), '%m/%d/%Y')
  )`;

function fullSql(dInqIndexHint) {
  return `
  SELECT
    b.Batch_Id, b.Batch_code, b.Course_Id AS CourseId,
    DATE_FORMAT(${BATCH_SDATE_EXPR}, '%Y-%m-%d') AS SDate,
    DATE_FORMAT(b.EDate, '%Y-%m-%d') AS EDate,
    b.Category, b.Duration, b.Timings, b.Training_Coordinator, b.INR_Basic,
    DATE_FORMAT(b.Admission_Date, '%Y-%m-%d') AS Admission_Date,
    CAST(REPLACE(IFNULL(NULLIF(TRIM(CAST(b.Max_Students AS CHAR)), ''), '0'), ',', '') AS UNSIGNED) AS Max_Students,
    CAST(REPLACE(IFNULL(NULLIF(TRIM(CAST(b.NoStudent AS CHAR)), ''), '0'), ',', '') AS UNSIGNED) AS NoStudent,
    COALESCE(c.Course_Name, b.CourseName, '') AS CourseName,
    COUNT(DISTINCT si.Inquiry_Id) AS Enquiries_Received,
    COUNT(DISTINCT CASE WHEN (
      d_inq.id IS NOT NULL
      OR (si.Student_Id IS NOT NULL AND d_stu.id IS NOT NULL)
    ) THEN si.Inquiry_Id END) AS Enquiries_Contacted,
    COUNT(DISTINCT CASE WHEN oap.Inquiry_Id IS NOT NULL THEN si.Inquiry_Id END) AS Interested_Students,
    COALESCE((
      SELECT COUNT(DISTINCT sm2.Student_Id)
      FROM student_master sm2
      WHERE sm2.Batch_Code = b.Batch_code
        AND sm2.Status_id = 8
        AND (sm2.IsDelete = 0 OR sm2.IsDelete IS NULL)
    ), 0) AS Confirmed_Admissions
  FROM batch_mst b
  LEFT JOIN course_mst c ON b.Course_Id = c.Course_Id
  LEFT JOIN (
    SELECT si1.Inquiry_Id, b1.Batch_Id
    FROM student_inquiry si1
    JOIN batch_mst b1
      ON si1.Batch_Code_Norm = b1.Batch_code_Norm
     AND ${BATCH_SDATE_EXPR.replace(/\bb\./g, 'b1.')} >= CURDATE()
     AND ${BATCH_SDATE_EXPR.replace(/\bb\./g, 'b1.')} <= DATE_ADD(CURDATE(), INTERVAL 3 MONTH)
     AND (b1.IsDelete IS NULL OR b1.IsDelete = 0)
    WHERE (si1.IsDelete = 0 OR si1.IsDelete IS NULL)
    UNION
    SELECT si2.Inquiry_Id, am2.Batch_Id
    FROM admission_master am2
    JOIN batch_mst b2
      ON b2.Batch_Id = am2.Batch_Id
     AND ${BATCH_SDATE_EXPR.replace(/\bb\./g, 'b2.')} >= CURDATE()
     AND ${BATCH_SDATE_EXPR.replace(/\bb\./g, 'b2.')} <= DATE_ADD(CURDATE(), INTERVAL 3 MONTH)
     AND (b2.IsDelete IS NULL OR b2.IsDelete = 0)
    JOIN student_inquiry si2 ON si2.Student_Id = am2.Student_Id
    WHERE (si2.IsDelete = 0 OR si2.IsDelete IS NULL)
      AND (am2.IsDelete = 0 OR am2.IsDelete IS NULL)
      AND LOWER(TRIM(CAST(COALESCE(am2.Cancel, '') AS CHAR))) NOT IN ('yes', 'y', '1', 'true', 'cancelled', 'canceled')
  ) im ON im.Batch_Id = b.Batch_Id
  LEFT JOIN student_inquiry si
    ON si.Inquiry_Id = im.Inquiry_Id AND (si.IsDelete = 0 OR si.IsDelete IS NULL)
  LEFT JOIN awt_inquirydiscussion d_inq ${dInqIndexHint || ''}
    ON d_inq.deleted = 0 AND d_inq.Inquiry_id = si.Inquiry_Id
  LEFT JOIN awt_inquirydiscussion d_stu
    ON si.Student_Id IS NOT NULL AND d_stu.deleted = 0 AND d_stu.student_id = si.Student_Id
  LEFT JOIN online_admission_payload oap ON oap.Inquiry_Id = si.Inquiry_Id
  WHERE ${BATCH_SDATE_EXPR} >= CURDATE()
    AND ${BATCH_SDATE_EXPR} <= DATE_ADD(CURDATE(), INTERVAL 3 MONTH)
    AND (b.IsDelete IS NULL OR b.IsDelete = 0)
    AND LOWER(TRIM(CAST(COALESCE(b.Cancel, '') AS CHAR))) NOT IN ('yes', 'y', '1', 'true', 'cancelled', 'canceled')
  GROUP BY
    b.Batch_Id, b.Batch_code, b.Course_Id, ${BATCH_SDATE_EXPR}, b.EDate, b.Category, b.Duration,
    b.Timings, b.Training_Coordinator, b.INR_Basic, b.Admission_Date,
    CAST(REPLACE(IFNULL(NULLIF(TRIM(CAST(b.Max_Students AS CHAR)), ''), '0'), ',', '') AS UNSIGNED),
    CAST(REPLACE(IFNULL(NULLIF(TRIM(CAST(b.NoStudent AS CHAR)), ''), '0'), ',', '') AS UNSIGNED),
    COALESCE(c.Course_Name, b.CourseName, '')
  ORDER BY ${BATCH_SDATE_EXPR} ASC, Enquiries_Received DESC
  LIMIT 50
  `;
}

async function timeIt(conn, label, sql) {
  const t0 = Date.now();
  try {
    const [rows] = await conn.query({ sql: `SET STATEMENT max_statement_time=15 FOR ${sql}`, timeout: 17000 });
    console.log(label, '-> rows:', rows.length, 'time ms:', Date.now() - t0);
  } catch (e) {
    console.log(label, '-> FAILED after ms:', Date.now() - t0, e.message);
  }
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, port: process.env.DB_PORT,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  });

  await timeIt(conn, 'no hint (baseline post-ANALYZE)', fullSql(''));
  await timeIt(conn, 'FORCE INDEX idx_disc_lookup on d_inq', fullSql('FORCE INDEX (idx_disc_lookup)'));

  await conn.end();
}
main().catch(e => { console.error('ERROR', e.message); process.exit(1); });
