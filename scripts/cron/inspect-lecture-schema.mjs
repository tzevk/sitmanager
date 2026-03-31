import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: '.env.local' });

async function cols(pool, table) {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ?
     ORDER BY ORDINAL_POSITION`,
    [table]
  );
  return rows.map((r) => r.COLUMN_NAME);
}

const oldPool = await mysql.createPool({
  host: process.env.OLD_DB_HOST,
  port: parseInt(process.env.OLD_DB_PORT || '3306', 10),
  user: process.env.OLD_DB_USER,
  password: process.env.OLD_DB_PASSWORD,
  database: process.env.OLD_DB_NAME,
});

const newPool = await mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

for (const t of ['Batch_SLecture_Master', 's_batch_lec']) {
  const oldCols = await cols(oldPool, t);
  console.log(`\nOLD ${t} (${oldCols.length})`);
  console.log(oldCols.join(', '));
}

for (const t of ['batch_slecture_master']) {
  const newCols = await cols(newPool, t);
  console.log(`\nNEW ${t} (${newCols.length})`);
  console.log(newCols.join(', '));
}

await oldPool.end();
await newPool.end();
