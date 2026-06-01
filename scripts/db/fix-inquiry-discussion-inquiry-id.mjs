#!/usr/bin/env node
import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const limitIdx = args.indexOf('--limit');
const limitArg = limitIdx !== -1 ? args[limitIdx + 1] : null;
const LIMIT = Math.min(50000, Math.max(1, Number(limitArg || 5000)));

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

async function main() {
  const pool = await mysql.createPool({
    host: requireEnv('DB_HOST'),
    port: Number(process.env.DB_PORT ?? 3306),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    database: requireEnv('DB_NAME'),
    waitForConnections: true,
    connectionLimit: 5,
    dateStrings: true,
  });

  try {
    console.log('=== Fix inquiry discussion Inquiry_id ===');
    console.log(`Dry run : ${DRY_RUN}`);
    console.log(`Limit   : ${LIMIT}`);

    const latestInquiryMapSql = `
      SELECT Student_Id, MAX(Inquiry_Id) AS Inquiry_Id
      FROM student_inquiry
      WHERE Student_Id IS NOT NULL
        AND (IsDelete = 0 OR IsDelete IS NULL)
      GROUP BY Student_Id
    `;

    const candidateScopeSql = `
      SELECT d.id, mapped.Inquiry_Id AS targetInquiryId
      FROM awt_inquirydiscussion d
      LEFT JOIN (${latestInquiryMapSql}) mapped ON mapped.Student_Id = d.student_id
      WHERE d.Inquiry_id IS NULL
        AND d.student_id IS NOT NULL
        AND (d.deleted = 0 OR d.deleted IS NULL)
      ORDER BY d.id DESC
      LIMIT ${LIMIT}
    `;

    const [summaryRows] = await pool.query(
      `SELECT
         COUNT(*) AS candidatesScanned,
         SUM(CASE WHEN scoped.targetInquiryId IS NOT NULL THEN 1 ELSE 0 END) AS repairable,
         SUM(CASE WHEN scoped.targetInquiryId IS NULL THEN 1 ELSE 0 END) AS skipped
       FROM (${candidateScopeSql}) scoped`
    );

    const candidatesScanned = Number(summaryRows[0]?.candidatesScanned || 0);
    const repairable = Number(summaryRows[0]?.repairable || 0);
    const skipped = Number(summaryRows[0]?.skipped || 0);

    let updated = 0;

    if (!DRY_RUN && repairable > 0) {
      await pool.query('START TRANSACTION');
      const [result] = await pool.query(
        `UPDATE awt_inquirydiscussion d
         INNER JOIN (${candidateScopeSql}) scoped ON scoped.id = d.id
         SET d.Inquiry_id = scoped.targetInquiryId
         WHERE scoped.targetInquiryId IS NOT NULL
           AND d.Inquiry_id IS NULL`
      );
      updated = Number(result.affectedRows || 0);
    } else if (DRY_RUN) {
      updated = repairable;
    }

    if (!DRY_RUN) {
      await pool.query('COMMIT');
    }

    console.log(`Candidates scanned : ${candidatesScanned}`);
    console.log(`${DRY_RUN ? 'Would repair' : 'Repaired'}       : ${updated}`);
    console.log(`Skipped           : ${skipped}`);
  } catch (error) {
    if (!DRY_RUN) {
      try {
        await pool.query('ROLLBACK');
      } catch {}
    }
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('FATAL:', error?.message || error);
  process.exit(1);
});