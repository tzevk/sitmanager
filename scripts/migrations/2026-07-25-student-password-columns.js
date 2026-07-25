/*
 * One-off migration: adds Password_Enc / Must_Change_Password columns to student_portal_auth.
 * Idempotent — safe to re-run. Does NOT backfill/encrypt existing rows; that is handled by a
 * separate migration script.
 * Run once: node scripts/migrations/2026-07-25-student-password-columns.js
 */
require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function columnExists(pool, table, column) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return Number(rows[0].cnt) > 0;
}

async function main() {
  const pool = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  console.log('Adding columns to student_portal_auth...');

  if (!(await columnExists(pool, 'student_portal_auth', 'Password_Enc'))) {
    await pool.query(
      `ALTER TABLE student_portal_auth ADD COLUMN Password_Enc VARBINARY(512) NULL AFTER Password_Hash`
    );
    console.log('  added Password_Enc');
  } else {
    console.log('  Password_Enc already exists, skipping');
  }

  if (!(await columnExists(pool, 'student_portal_auth', 'Must_Change_Password'))) {
    await pool.query(
      `ALTER TABLE student_portal_auth ADD COLUMN Must_Change_Password TINYINT(1) NOT NULL DEFAULT 0 AFTER Password_Enc`
    );
    console.log('  added Must_Change_Password');
  } else {
    console.log('  Must_Change_Password already exists, skipping');
  }

  await pool.end();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
