#!/usr/bin/env node
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: '.env.local' });

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  return {
    dryRun: args.has('--dry-run') || args.has('-n'),
    includeLegacy: args.has('--include-legacy'),
  };
}

async function main() {
  const { dryRun, includeLegacy } = parseArgs(process.argv);

  const pool = await mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 2,
    dateStrings: true,
  });

  try {
    const sourceScope = includeLegacy
      ? '1=1'
      : 'Source_Inquiry_Id IS NOT NULL';

    const [dupGroups] = await pool.query(
      `SELECT
         MAX(Followup_Id) AS keep_id,
         GROUP_CONCAT(Followup_Id ORDER BY Followup_Id DESC) AS ids,
         COUNT(*) AS cnt
       FROM consultant_followup
       WHERE (${sourceScope})
         AND (IsDelete = 0 OR IsDelete IS NULL)
       GROUP BY
         Const_Id,
         COALESCE(Source_Inquiry_Id, -1),
         COALESCE(Followup_Date, '1900-01-01'),
         LOWER(TRIM(COALESCE(Contact_Person, ''))),
         LOWER(TRIM(COALESCE(Designation, ''))),
         LOWER(TRIM(COALESCE(Mobile, ''))),
         LOWER(TRIM(COALESCE(email, ''))),
         LOWER(TRIM(COALESCE(Purpose, ''))),
         LOWER(TRIM(COALESCE(Course, ''))),
         LOWER(TRIM(COALESCE(Direct_Line, ''))),
         LOWER(TRIM(COALESCE(Remarks, '')))
       HAVING COUNT(*) > 1`
    );

    if (!dupGroups.length) {
      console.log('No duplicate consultant_followup rows found for selected scope.');
      return;
    }

    const toDelete = [];
    for (const row of dupGroups) {
      const keepId = Number(row.keep_id || 0);
      const ids = String(row.ids || '')
        .split(',')
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n) && n > 0);
      for (const id of ids) {
        if (id !== keepId) toDelete.push(id);
      }
    }

    if (toDelete.length === 0) {
      console.log('Duplicate groups found but no duplicate IDs to delete.');
      return;
    }

    if (dryRun) {
      console.log(JSON.stringify({
        dryRun: true,
        includeLegacy,
        duplicateGroups: dupGroups.length,
        duplicateRows: toDelete.length,
        sampleDeleteIds: toDelete.slice(0, 25),
      }, null, 2));
      return;
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        `UPDATE consultant_followup
         SET IsDelete = 1
         WHERE Followup_Id IN (${toDelete.map(() => '?').join(',')})`,
        toDelete
      );
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    console.log(JSON.stringify({
      dryRun: false,
      includeLegacy,
      duplicateGroups: dupGroups.length,
      softDeletedRows: toDelete.length,
    }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Failed:', err.message || err);
  process.exit(1);
});
