#!/usr/bin/env node
/**
 * Replace the 2147483647 placeholder in student_inquiry.Present_Mobile with the
 * person's real number from the legacy (old software) Student_Inquiry table.
 *
 * 2147483647 is INT_MAX: the website feed wrote it whenever a 10-digit phone
 * overflowed an INT column. The old software has the same people under its own
 * ids — and old/new Inquiry_Id ranges overlap — so rows are matched by contact,
 * never by id (scripts/db/backfill-phones-from-legacy.mjs matches by id; don't use
 * it for this):
 *   A  same email + same name           -> exactly one distinct phone among them
 *   B  same email (≤2 names use it)     -> exactly one distinct phone
 *   C  same full name + same inquiry date -> exactly one distinct phone
 * Anything with two candidate numbers, or no legacy record, is left untouched
 * and written to a CSV for staff to review.
 *
 * Usage:
 *   node scripts/db/fix-overflow-inquiry-phones-from-legacy.mjs                 # dry run
 *   node scripts/db/fix-overflow-inquiry-phones-from-legacy.mjs --apply
 *   ... --unresolved-csv <path>   # where to write the rows that couldn't be fixed
 *
 * Old values are kept in inquiry_phone_fix_backup (Inquiry_Id, Old_Mobile, New_Mobile, ...).
 */

import mysql from 'mysql2/promise';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const PLACEHOLDER = '2147483647';
const BACKUP = 'inquiry_phone_fix_backup';

function loadEnv(p) {
  const env = {};
  for (const l of readFileSync(p, 'utf8').split('\n')) {
    const t = l.trim(); if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('='); if (i < 0) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[t.slice(0, i).trim()] = v;
  }
  return env;
}

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const csvIdx = args.indexOf('--unresolved-csv');
const csvPath = csvIdx !== -1 ? args[csvIdx + 1] : null;

const nameKey = (v) => String(v ?? '').toLowerCase().replace(/[^a-z]/g, '');
const emailKey = (v) => { const e = String(v ?? '').trim().toLowerCase(); return e.includes('@') ? e : null; };
/** Last 10 digits of a usable phone, else null (placeholder, too short, 9999999999-style). */
const phoneKey = (v) => {
  const d = String(v ?? '').replace(/\D/g, '');
  if (d.length < 10 || d.length > 15 || d === PLACEHOLDER) return null;
  const last10 = d.slice(-10);
  return /^(\d)\1+$/.test(last10) ? null : last10;
};
const sameName = (a, b) => {
  a = nameKey(a); b = nameKey(b);
  return a.length >= 3 && b.length >= 3 && (a === b || a.includes(b) || b.includes(a));
};
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

const env = loadEnv(resolve(__dir, '../../.env.local'));
const conn = await mysql.createConnection({
  host: env.DB_HOST, port: parseInt(env.DB_PORT || '3306', 10),
  database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASSWORD,
  dateStrings: true, connectTimeout: 30_000,
});
const old = await mysql.createConnection({
  host: env.OLD_DB_HOST, port: parseInt(env.OLD_DB_PORT || '3306', 10),
  database: env.OLD_DB_NAME, user: env.OLD_DB_USER, password: env.OLD_DB_PASSWORD,
  dateStrings: true, connectTimeout: 30_000,
});

try {
  const [bad] = await conn.query(
    `SELECT Inquiry_Id, Student_Name, Email, LEFT(Inquiry_Dt, 10) AS dt
     FROM student_inquiry WHERE TRIM(Present_Mobile) = ?`,
    [PLACEHOLDER]
  );
  const [legacy] = await old.query(
    `SELECT Inquiry_Id, Student_Name, Email, LEFT(Inquiry_Dt, 10) AS dt, TRIM(Present_Mobile) AS mobile
     FROM Student_Inquiry WHERE (IsDelete = 0 OR IsDelete IS NULL)`
  );

  const byEmail = new Map();
  const byNameDate = new Map();
  for (const o of legacy) {
    if (!phoneKey(o.mobile)) continue;
    const e = emailKey(o.Email);
    if (e) (byEmail.get(e) ?? byEmail.set(e, []).get(e)).push(o);
    const k = `${nameKey(o.Student_Name)}|${o.dt}`;
    (byNameDate.get(k) ?? byNameDate.set(k, []).get(k)).push(o);
  }
  const namesPerEmail = new Map([...byEmail].map(([e, l]) => [e, new Set(l.map((o) => nameKey(o.Student_Name))).size]));

  /** The single legacy row to take the phone from, if all candidates agree on one number. */
  const pick = (cands) => {
    if (!cands.length) return null;
    return new Set(cands.map((o) => phoneKey(o.mobile))).size === 1 ? cands[cands.length - 1] : null;
  };

  const fixes = [];
  const unresolved = [];
  for (const b of bad) {
    const e = emailKey(b.Email);
    const emailCands = e ? byEmail.get(e) ?? [] : [];
    const nameDateCands = nameKey(b.Student_Name).length >= 6 ? byNameDate.get(`${nameKey(b.Student_Name)}|${b.dt}`) ?? [] : [];

    let match = pick(emailCands.filter((o) => sameName(o.Student_Name, b.Student_Name)));
    let tier = 'A';
    if (!match && namesPerEmail.get(e) <= 2) { match = pick(emailCands); tier = 'B'; }
    if (!match) { match = pick(nameDateCands); tier = 'C'; }

    if (match) {
      fixes.push({ id: b.Inquiry_Id, name: b.Student_Name, phone: match.mobile, tier, legacyId: match.Inquiry_Id });
    } else {
      const cands = [...new Map([...emailCands, ...nameDateCands].map((o) => [o.Inquiry_Id, o])).values()];
      unresolved.push({
        ...b,
        reason: cands.length ? 'several legacy numbers' : 'not in legacy',
        candidates: cands.map((o) => `${o.Student_Name}: ${o.mobile}`).join(' | '),
      });
    }
  }

  const tiers = fixes.reduce((m, f) => ({ ...m, [f.tier]: (m[f.tier] ?? 0) + 1 }), {});
  console.log(`Inquiries showing ${PLACEHOLDER}: ${bad.length}`);
  console.log(`  fixable from legacy: ${fixes.length}  (email+name ${tiers.A ?? 0}, email ${tiers.B ?? 0}, name+date ${tiers.C ?? 0})`);
  console.log(`  several legacy numbers: ${unresolved.filter((u) => u.reason !== 'not in legacy').length}`);
  console.log(`  not in legacy: ${unresolved.filter((u) => u.reason === 'not in legacy').length}`);
  console.table(fixes.slice(0, 10));

  if (csvPath) {
    writeFileSync(csvPath, [
      'Inquiry_Id,Student_Name,Email,Inquiry_Date,Reason,Legacy_Candidates',
      ...unresolved.map((u) => [u.Inquiry_Id, u.Student_Name, u.Email, u.dt, u.reason, u.candidates].map(csvCell).join(',')),
    ].join('\n'));
    console.log(`Unresolved rows written to ${csvPath}`);
  }

  if (!apply) {
    console.log('Dry run — pass --apply to update.');
  } else if (fixes.length) {
    await conn.query(
      `CREATE TABLE IF NOT EXISTS ${BACKUP} (
         Id INT AUTO_INCREMENT PRIMARY KEY,
         Inquiry_Id INT NOT NULL,
         Old_Mobile VARCHAR(100) NULL,
         New_Mobile VARCHAR(100) NULL,
         Match_Type VARCHAR(20) NULL,
         Legacy_Inquiry_Id INT NULL,
         Fixed_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         INDEX idx_phone_fix_inquiry (Inquiry_Id)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    );
    await conn.beginTransaction();
    let updated = 0;
    for (const f of fixes) {
      const [res] = await conn.query(
        `UPDATE student_inquiry SET Present_Mobile = ? WHERE Inquiry_Id = ? AND TRIM(Present_Mobile) = ?`,
        [f.phone, f.id, PLACEHOLDER]
      );
      if (!res.affectedRows) continue;
      await conn.query(
        `INSERT INTO ${BACKUP} (Inquiry_Id, Old_Mobile, New_Mobile, Match_Type, Legacy_Inquiry_Id) VALUES (?, ?, ?, ?, ?)`,
        [f.id, PLACEHOLDER, f.phone, `legacy_${f.tier}`, f.legacyId]
      );
      updated++;
    }
    await conn.commit();
    console.log(`Updated ${updated} inquiries (old values in ${BACKUP})`);
  }
} catch (err) {
  await conn.rollback().catch(() => {});
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await conn.end();
  await old.end();
}
