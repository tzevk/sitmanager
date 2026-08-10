require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

const BATCH_SDATE_EXPR = `COALESCE(
    STR_TO_DATE(CAST(b.SDate AS CHAR), '%Y-%m-%d'),
    STR_TO_DATE(CAST(b.SDate AS CHAR), '%d-%m-%Y'),
    STR_TO_DATE(CAST(b.SDate AS CHAR), '%d/%m/%Y'),
    STR_TO_DATE(CAST(b.SDate AS CHAR), '%m/%d/%Y')
  )`;

const imCTE = `
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
`;

const sql = `
  SELECT b.Batch_Id, b.Batch_code, COUNT(DISTINCT si.Inquiry_Id) AS Enquiries_Received,
    COUNT(DISTINCT CASE WHEN d_inq.id IS NOT NULL THEN si.Inquiry_Id END) AS Enquiries_Contacted
  FROM batch_mst b
  LEFT JOIN (${imCTE}) im ON im.Batch_Id = b.Batch_Id
  LEFT JOIN student_inquiry si
    ON si.Inquiry_Id = im.Inquiry_Id AND (si.IsDelete = 0 OR si.IsDelete IS NULL)
  LEFT JOIN awt_inquirydiscussion d_inq FORCE INDEX (idx_disc_lookup)
    ON d_inq.deleted = 0 AND d_inq.Inquiry_id = si.Inquiry_Id
  WHERE ${BATCH_SDATE_EXPR} >= CURDATE()
    AND ${BATCH_SDATE_EXPR} <= DATE_ADD(CURDATE(), INTERVAL 3 MONTH)
    AND (b.IsDelete IS NULL OR b.IsDelete = 0)
  GROUP BY b.Batch_Id, b.Batch_code
`;

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, port: process.env.DB_PORT,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  });
  const [ex] = await conn.query('EXPLAIN ' + sql);
  console.log(JSON.stringify(ex.filter(r=>r.table==='d_inq').map(r => ({table: r.table, type: r.type, key: r.key, rows: r.rows, Extra: r.Extra})), null, 2));

  const t0 = Date.now();
  try {
    const [rows] = await conn.query({ sql: `SET STATEMENT max_statement_time=15 FOR ${sql}`, timeout: 17000 });
    console.log('rows:', rows.length, 'time ms:', Date.now() - t0);
  } catch (e) {
    console.log('FAILED after ms:', Date.now() - t0, e.message);
  }
  await conn.end();
}
main().catch(e => { console.error('ERROR', e.message); process.exit(1); });
