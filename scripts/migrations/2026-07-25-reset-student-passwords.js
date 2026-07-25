/*
 * One-off migration: resets every student_portal_auth account's password to
 * Name@DDMMYYYY (encrypted with AES-256-GCM) and flags Must_Change_Password=1
 * so every student is forced through the new-password modal on next login.
 *
 * Dry-run by default (prints planned changes, no writes). Pass --commit to apply.
 *
 * Usage:
 *   node scripts/migrations/2026-07-25-reset-student-passwords.js         # dry run
 *   node scripts/migrations/2026-07-25-reset-student-passwords.js --commit
 */
require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');
const crypto = require('crypto');

const COMMIT = process.argv.includes('--commit');
const FALLBACK_DOB = '01011990';

function encryptPassword(plain) {
  const key = Buffer.from(process.env.STUDENT_PASSWORD_ENC_KEY, 'hex');
  if (key.length !== 32) throw new Error('STUDENT_PASSWORD_ENC_KEY must be a 32-byte (64 hex char) key');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]);
}

function ddmmyyyyFromDob(dobRaw) {
  const s = String(dobRaw || '').trim();
  if (!s) return { value: FALLBACK_DOB, fallback: true };

  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); // YYYY-MM-DD
  if (m) {
    const [, y, mo, d] = m;
    if (Number(y) >= 1930 && Number(y) <= 2015) return { value: `${d}${mo}${y}`, fallback: false };
  }

  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/); // DD-MM-YYYY or DD/MM/YYYY
  if (m) {
    const [, d, mo, y] = m;
    if (Number(y) >= 1930 && Number(y) <= 2015) {
      return { value: `${d.padStart(2, '0')}${mo.padStart(2, '0')}${y}`, fallback: false };
    }
  }

  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    if (y >= 1930 && y <= 2015) {
      const d = String(parsed.getDate()).padStart(2, '0');
      const mo = String(parsed.getMonth() + 1).padStart(2, '0');
      return { value: `${d}${mo}${y}`, fallback: false };
    }
  }

  return { value: FALLBACK_DOB, fallback: true };
}

function firstNameFrom(studentName) {
  const first = String(studentName || '').trim().split(/\s+/)[0] || 'Student';
  const cleaned = first.replace(/[^a-zA-Z]/g, '');
  if (!cleaned) return 'Student';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
}

async function main() {
  const pool = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const [rows] = await pool.query(`
    SELECT spa.Id, spa.Student_Id, spa.Username, s.Student_Name, s.DOB
    FROM student_portal_auth spa
    JOIN student_master s ON s.Student_Id = spa.Student_Id
  `);

  console.log(`${COMMIT ? 'COMMIT' : 'DRY RUN'}: ${rows.length} student_portal_auth accounts found.\n`);

  const fallbackRows = [];
  let updated = 0;

  for (const r of rows) {
    const name = firstNameFrom(r.Student_Name);
    const { value: dobPart, fallback } = ddmmyyyyFromDob(r.DOB);
    const password = `${name}@${dobPart}`;

    if (fallback) fallbackRows.push({ Id: r.Id, Student_Id: r.Student_Id, Student_Name: r.Student_Name, DOB: r.DOB });

    if (COMMIT) {
      const enc = encryptPassword(password);
      await pool.query(
        `UPDATE student_portal_auth SET Password_Enc = ?, Must_Change_Password = 1 WHERE Id = ?`,
        [enc, r.Id]
      );
    } else {
      console.log(`  [${r.Username}] ${r.Student_Name} -> ${password}${fallback ? '  (DOB FALLBACK)' : ''}`);
    }
    updated += 1;
  }

  console.log(`\n${COMMIT ? 'Updated' : 'Would update'} ${updated} accounts.`);
  if (fallbackRows.length) {
    console.log(`\n${fallbackRows.length} account(s) used the DOB fallback (${FALLBACK_DOB}) — follow up with these students:`);
    for (const f of fallbackRows) console.log(`  Id=${f.Id} Student_Id=${f.Student_Id} Name="${f.Student_Name}" DOB="${f.DOB}"`);
  } else {
    console.log('No accounts needed the DOB fallback.');
  }

  if (!COMMIT) {
    console.log('\nDry run only — no changes written. Re-run with --commit to apply.');
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
