import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

function loadEnv() {
  const candidates = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '.env'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) dotenv.config({ path: p });
  }
}

function getRequiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

async function main() {
  loadEnv();

  const pool = mysql.createPool({
    host: getRequiredEnv('DB_HOST'),
    port: Number(process.env.DB_PORT || '3306'),
    database: getRequiredEnv('DB_NAME'),
    user: getRequiredEnv('DB_USER'),
    password: getRequiredEnv('DB_PASSWORD'),
    dateStrings: true,
    ...(process.env.DB_SSL === 'true' && { ssl: { rejectUnauthorized: true } }),
  });

  try {
    const [before] = await pool.query(
      `SELECT
         SUM(CASE WHEN CtTrainingEnquiryId IS NOT NULL THEN 1 ELSE 0 END) AS ct_total,
         SUM(CASE
           WHEN CtTrainingEnquiryId IS NOT NULL
            AND TRIM(COALESCE(CompanyAuthority,'')) <> ''
            AND TRIM(COALESCE(CompanyAuthority,'')) = TRIM(COALESCE(FullName,''))
           THEN 1 ELSE 0 END) AS ct_authority_equals_inquirer
       FROM corporate_inquiry
       WHERE (IsDelete = 0 OR IsDelete IS NULL)`
    );

    console.log('Before:', before?.[0]);

    const [res] = await pool.query(
      `UPDATE corporate_inquiry
       SET CompanyAuthority = NULL
       WHERE CtTrainingEnquiryId IS NOT NULL
         AND TRIM(COALESCE(CompanyAuthority,'')) <> ''
         AND TRIM(COALESCE(CompanyAuthority,'')) = TRIM(COALESCE(FullName,''))`
    );

    console.log('Rows updated:', res?.affectedRows ?? res);

    const [after] = await pool.query(
      `SELECT
         SUM(CASE WHEN CtTrainingEnquiryId IS NOT NULL THEN 1 ELSE 0 END) AS ct_total,
         SUM(CASE
           WHEN CtTrainingEnquiryId IS NOT NULL
            AND TRIM(COALESCE(CompanyAuthority,'')) <> ''
            AND TRIM(COALESCE(CompanyAuthority,'')) = TRIM(COALESCE(FullName,''))
           THEN 1 ELSE 0 END) AS ct_authority_equals_inquirer
       FROM corporate_inquiry
       WHERE (IsDelete = 0 OR IsDelete IS NULL)`
    );

    console.log('After:', after?.[0]);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
