#!/usr/bin/env node
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: '.env.local' });

const BATCH_CODE = '08066';
const TEST_NAMES = ['test1', 'test2', 'test3', 'test4', 'test5', 'test6'];

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
    const [batchRows] = await pool.query(
      `SELECT Batch_Id, Batch_code, Course_Id
       FROM batch_mst
       WHERE CAST(Batch_code AS CHAR)=? OR LPAD(CAST(Batch_code AS CHAR),5,'0')=?
       ORDER BY Batch_Id DESC
       LIMIT 1`,
      [BATCH_CODE, BATCH_CODE]
    );

    if (!batchRows.length) {
      throw new Error(`Batch not found for code ${BATCH_CODE}`);
    }

    const batch = batchRows[0];
    const courseId = batch.Course_Id ?? null;

    const [existingRows] = await pool.query(
      `SELECT Student_Id, Student_Name
       FROM student_master
       WHERE TRIM(CAST(Batch_Code AS CHAR)) = ?
         AND LOWER(TRIM(Student_Name)) IN (${TEST_NAMES.map(() => '?').join(',')})`,
      [BATCH_CODE, ...TEST_NAMES]
    );

    const existingSet = new Set(existingRows.map((r) => String(r.Student_Name || '').trim().toLowerCase()));
    const toInsert = TEST_NAMES.filter((n) => !existingSet.has(n));

    console.log(`Batch resolved: Batch_Id=${batch.Batch_Id}, Batch_code=${batch.Batch_code}, Course_Id=${courseId}`);
    console.log(`Already present: ${TEST_NAMES.length - toInsert.length}`);
    console.log(`To insert: ${toInsert.length}`);

    if (toInsert.length > 0) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        const sql = `
          INSERT INTO student_master
          (FName, LName, Student_Name, Course_Id, Batch_Code, Inquiry, Student, IsActive, IsDelete, created_date)
          VALUES (?, ?, ?, ?, ?, 'Student', 'Yes', 1, 0, NOW())
        `;

        for (const name of toInsert) {
          await conn.query(sql, [name, '', name, courseId, BATCH_CODE]);
        }

        await conn.commit();
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    }

    const [verifyRows] = await pool.query(
      `SELECT Student_Id, Student_Name, Batch_Code, Course_Id, created_date
       FROM student_master
       WHERE TRIM(CAST(Batch_Code AS CHAR)) = ?
         AND LOWER(TRIM(Student_Name)) IN (${TEST_NAMES.map(() => '?').join(',')})
       ORDER BY Student_Name`,
      [BATCH_CODE, ...TEST_NAMES]
    );

    console.log('Final test students in batch:');
    for (const r of verifyRows) {
      console.log(`- ${r.Student_Name} (Student_Id=${r.Student_Id}, Course_Id=${r.Course_Id}, Batch_Code=${r.Batch_Code})`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Failed:', err.message || err);
  process.exit(1);
});
