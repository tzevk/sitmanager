#!/usr/bin/env node
/**
 * Undo person merges caused by non-email text in person_master.Normalized_Email.
 * "-" was accepted as an email, so inquiries 68588 and 68597 were linked to
 * person 978 (Nadeem M.). This gives them their own persons and clears every
 * Normalized_Email that isn't a real address. Old values are kept in
 * person_email_fix_backup.
 *
 *   node scripts/db/fix-placeholder-person-emails.mjs            # dry run
 *   node scripts/db/fix-placeholder-person-emails.mjs --apply
 */
import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';

const env = {};
for (const line of fs.readFileSync(path.resolve('.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
}

const APPLY = process.argv.includes('--apply');
const WRONG_PERSON = 978;
const SPLIT_INQUIRIES = [68588, 68597];
const NOT_EMAIL = `Normalized_Email IS NOT NULL AND Normalized_Email NOT REGEXP '^[^[:space:]@]+@[^[:space:]@]+\\\\.[^[:space:]@]+$'`;
const CHANGELOG = [
  ['Fixed unrelated inquiries being merged by placeholder emails', 'Text that is not a real email address, such as "-", is no longer used to match people on an inquiry. These inquiries are now matched by phone number, so different people entered with "-" as their email stay separate and the duplicate check no longer shows someone else\'s inquiries.', 'Fix'],
  ['Separated inquiries wrongly linked to Nadeem M.', 'Sahil Kaulya (68588) and Faiyaz Aalam (68597) now have their own person records instead of being linked to Nadeem M. (68556). Invalid email values were also cleared from the matching data of 8 person records. The emails shown on inquiries are unchanged.', 'Fix'],
];

const c = await mysql.createConnection({
  host: env.DB_HOST, port: Number(env.DB_PORT || 3306), user: env.DB_USER,
  password: env.DB_PASSWORD, database: env.DB_NAME, dateStrings: true,
});
try {
  const [bad] = await c.query(`SELECT * FROM person_master WHERE ${NOT_EMAIL}`);
  const [inquiries] = await c.query(
    `SELECT Inquiry_Id, Student_Name, Present_Mobile, Person_Id, Is_Re_Enquiry FROM student_inquiry WHERE Inquiry_Id IN (?)`,
    [SPLIT_INQUIRIES]
  );
  const split = inquiries.filter((r) => r.Person_Id === WRONG_PERSON);
  const plans = [];
  for (const r of split) {
    const mobile = String(r.Present_Mobile).replace(/\D/g, '').slice(-10);
    const [[existing]] = await c.query(`SELECT Person_Id FROM person_master WHERE Normalized_Mobile = ?`, [mobile]);
    plans.push({ ...r, mobile, existingPerson: existing?.Person_Id ?? null });
  }
  console.log('Emails to clear:', bad.map((p) => `${p.Person_Id}=${p.Normalized_Email}`).join(', ') || 'none');
  console.table(plans);
  if (!APPLY) { console.log('Dry run: nothing written.'); process.exit(0); }
  if (!bad.length && !plans.length) { console.log('Nothing to do.'); process.exit(0); }

  await c.query(`CREATE TABLE IF NOT EXISTS person_email_fix_backup (
    Person_Id INT NOT NULL PRIMARY KEY, Normalized_Email VARCHAR(191) NULL,
    Backed_Up_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await c.query(`INSERT IGNORE INTO person_email_fix_backup (Person_Id, Normalized_Email)
    SELECT Person_Id, Normalized_Email FROM person_master WHERE ${NOT_EMAIL}`);

  await c.beginTransaction();
  try {
    for (const p of plans) {
      let personId = p.existingPerson;
      if (!personId) {
        const [res] = await c.query(
          `INSERT INTO person_master (Name, Mobile, Email, Normalized_Mobile, Normalized_Email) VALUES (?, ?, NULL, ?, NULL)`,
          [p.Student_Name, p.Present_Mobile, p.mobile]
        );
        personId = res.insertId;
      }
      await c.query(`UPDATE student_inquiry SET Person_Id = ?, Is_Re_Enquiry = 0 WHERE Inquiry_Id = ? AND Person_Id = ?`,
        [personId, p.Inquiry_Id, WRONG_PERSON]);
      console.log(`Inquiry ${p.Inquiry_Id} -> person ${personId}`);
    }
    const [cleared] = await c.query(`UPDATE person_master SET Normalized_Email = NULL WHERE ${NOT_EMAIL}`);
    console.log('Emails cleared:', cleared.affectedRows);
    for (const [title, description, category] of CHANGELOG) {
      await c.query(`INSERT INTO software_changelog (Title, Description, Category, Author) VALUES (?, ?, ?, 'Tanvi')`,
        [title, description, category]);
    }
    await c.commit();
  } catch (err) {
    await c.rollback();
    throw err;
  }
} finally {
  await c.end();
}
