/**
 * Database-level guarantee: one live lead per person per training programme.
 * Adds generated columns dedupe_phone / dedupe_email on student_inquiry (NULL for deleted
 * leads, leads with no programme, and placeholder/fake numbers) with UNIQUE indexes.
 * Keep the SQL in step with phoneKey/emailKey in lib/services/inquiry-dedupe.service.ts.
 * Run scripts/dedupe-inquiries-contact-course.mjs --apply first.
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env.local'), quiet: true });

const c = await mysql.createConnection({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
});
const P = "RIGHT(REGEXP_REPLACE(IFNULL(Present_Mobile,''),'[^0-9]',''),10)";
const LIVE = "IFNULL(IsDelete,0)=0 AND IFNULL(Course_Id,'') NOT IN ('','0')";
try {
  const [[has]] = await c.query(`SELECT COUNT(*) n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='student_inquiry' AND COLUMN_NAME='dedupe_phone'`);
  if (Number(has.n)) { console.log('Already in place.'); process.exit(0); }
  await c.query(`ALTER TABLE student_inquiry
    ADD COLUMN dedupe_phone VARCHAR(40) AS (IF(${LIVE} AND LENGTH(${P})=10 AND ${P}<>'2147483647' AND ${P} NOT REGEXP '^([0-9])\\\\1{9}$' AND LEFT(${P},1)<>'0', CONCAT(${P},'|',Course_Id), NULL)) VIRTUAL,
    ADD COLUMN dedupe_email VARCHAR(200) AS (IF(${LIVE} AND LOWER(TRIM(Email)) REGEXP '^[^@[:space:]]+@[^@[:space:]]+\\\\.[^@[:space:]]+$', CONCAT(LOWER(TRIM(Email)),'|',Course_Id), NULL)) VIRTUAL,
    ADD UNIQUE KEY uq_inquiry_person_course_phone (dedupe_phone),
    ADD UNIQUE KEY uq_inquiry_person_course_email (dedupe_email)`);
  const [[n]] = await c.query(`SELECT SUM(dedupe_phone IS NOT NULL) p, SUM(dedupe_email IS NOT NULL) e FROM student_inquiry`);
  console.log('Constraint added. Leads covered by phone:', n.p, 'by e-mail:', n.e);
} catch (e) {
  console.error('ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
