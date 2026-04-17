#!/usr/bin/env node
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: '.env.local' });

async function main() {
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
    // Duplicates are defined exactly as in the API list dedupe signature.
    const [dupRows] = await pool.query(
      `SELECT
         MAX(Id) AS keep_id,
         GROUP_CONCAT(Id ORDER BY Id DESC) AS ids,
         COUNT(*) AS cnt,
         LOWER(TRIM(COALESCE(CompanyName, ''))) AS k_company,
         LOWER(TRIM(COALESCE(Email, ''))) AS k_email,
         LOWER(TRIM(COALESCE(Mobile, ''))) AS k_mobile,
         LOWER(TRIM(COALESCE(Course_Id, ''))) AS k_course,
         COALESCE(DATE(Idate), '1900-01-01') AS k_idate
       FROM corporate_inquiry
       WHERE (IsDelete = 0 OR IsDelete IS NULL)
       GROUP BY
         LOWER(TRIM(COALESCE(CompanyName, ''))),
         LOWER(TRIM(COALESCE(Email, ''))),
         LOWER(TRIM(COALESCE(Mobile, ''))),
         LOWER(TRIM(COALESCE(Course_Id, ''))),
         COALESCE(DATE(Idate), '1900-01-01')
       HAVING COUNT(*) > 1`
    );

    if (!dupRows.length) {
      console.log('No active duplicate corporate inquiries found.');
      return;
    }

    const toDelete = [];
    for (const row of dupRows) {
      const ids = String(row.ids || '')
        .split(',')
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n) && n > 0);
      const keepId = Number(row.keep_id || 0);
      for (const id of ids) {
        if (id !== keepId) toDelete.push(id);
      }
    }

    if (toDelete.length === 0) {
      console.log('No duplicate IDs selected for soft delete.');
      return;
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        `UPDATE corporate_inquiry
         SET IsDelete = 1
         WHERE Id IN (${toDelete.map(() => '?').join(',')})`,
        toDelete
      );
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    console.log(`Duplicate groups found: ${dupRows.length}`);
    console.log(`Soft-deleted duplicate rows: ${toDelete.length}`);
    console.log('Sample groups (keeping latest Id):');
    dupRows.slice(0, 8).forEach((r, idx) => {
      console.log(
        `${idx + 1}. keep=${r.keep_id}, count=${r.cnt}, company='${r.k_company}', email='${r.k_email}', mobile='${r.k_mobile}', course='${r.k_course}', idate='${r.k_idate}'`
      );
    });
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Failed:', err.message || err);
  process.exit(1);
});
