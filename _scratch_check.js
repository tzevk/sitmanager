require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const [totalRows] = await conn.query(`SELECT COUNT(*) AS total FROM batch_mst WHERE (IsDelete IS NULL OR IsDelete = 0)`);
  console.log('total active batches:', totalRows);

  const t0 = Date.now();
  const [rows] = await conn.query(`
    SELECT b.Batch_Id, b.Batch_code, b.SDate, b.EDate, b.IsDelete, b.Cancel
    FROM batch_mst b
    WHERE COALESCE(
      STR_TO_DATE(CAST(b.SDate AS CHAR), '%Y-%m-%d'),
      STR_TO_DATE(CAST(b.SDate AS CHAR), '%d-%m-%Y'),
      STR_TO_DATE(CAST(b.SDate AS CHAR), '%d/%m/%Y'),
      STR_TO_DATE(CAST(b.SDate AS CHAR), '%m/%d/%Y')
    ) >= CURDATE()
    AND COALESCE(
      STR_TO_DATE(CAST(b.SDate AS CHAR), '%Y-%m-%d'),
      STR_TO_DATE(CAST(b.SDate AS CHAR), '%d-%m-%Y'),
      STR_TO_DATE(CAST(b.SDate AS CHAR), '%d/%m/%Y'),
      STR_TO_DATE(CAST(b.SDate AS CHAR), '%m/%d/%Y')
    ) <= DATE_ADD(CURDATE(), INTERVAL 3 MONTH)
    LIMIT 20
  `);
  console.log('matching upcoming batches (raw filter):', rows.length, 'time ms:', Date.now() - t0);
  console.log(rows);

  // sample some SDate raw values to see format
  const [sample] = await conn.query(`SELECT Batch_Id, Batch_code, SDate, IsDelete, Cancel FROM batch_mst ORDER BY Batch_Id DESC LIMIT 15`);
  console.log('recent batch SDate samples:', sample);

  await conn.end();
}
main().catch(e => { console.error('ERROR', e); process.exit(1); });
