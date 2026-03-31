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
    if (!batchRows.length) throw new Error(`Batch not found: ${BATCH_CODE}`);
    const batch = batchRows[0];

    const [students] = await pool.query(
      `SELECT Student_Id, Student_Name, Course_Id
       FROM student_master
       WHERE TRIM(CAST(Batch_Code AS CHAR)) = ?
         AND LOWER(TRIM(Student_Name)) IN (${TEST_NAMES.map(() => '?').join(',')})
       ORDER BY Student_Name`,
      [BATCH_CODE, ...TEST_NAMES]
    );

    if (!students.length) {
      throw new Error('No test students found in student_master for this batch code');
    }

    const studentIds = students.map((s) => Number(s.Student_Id)).filter(Number.isFinite);
    const [existingAdmissions] = await pool.query(
      `SELECT Admission_Id, Student_Id
       FROM admission_master
       WHERE Batch_Id = ?
         AND Student_Id IN (${studentIds.map(() => '?').join(',')})`,
      [batch.Batch_Id, ...studentIds]
    );

    const existingSet = new Set(existingAdmissions.map((a) => Number(a.Student_Id)));
    const toInsert = students.filter((s) => !existingSet.has(Number(s.Student_Id)));

    console.log(`Batch: ${batch.Batch_code} (Batch_Id=${batch.Batch_Id}, Course_Id=${batch.Course_Id})`);
    console.log(`Test students found: ${students.length}`);
    console.log(`Admissions already present: ${existingAdmissions.length}`);
    console.log(`Admissions to insert: ${toInsert.length}`);

    if (toInsert.length > 0) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        const insertSql = `
          INSERT INTO admission_master
            (Student_Id, Course_Id, Batch_Id, Admission_Date, IsDelete, Cancel)
          VALUES (?, ?, ?, CURDATE(), 0, 0)
        `;

        for (const s of toInsert) {
          await conn.query(insertSql, [
            Number(s.Student_Id),
            Number(batch.Course_Id ?? s.Course_Id ?? 0) || null,
            Number(batch.Batch_Id),
          ]);
        }

        await conn.commit();
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    }

    const [verify] = await pool.query(
      `SELECT a.Admission_Id, a.Student_Id, a.Batch_Id, a.Course_Id, a.Admission_Date, s.Student_Name
       FROM admission_master a
       JOIN student_master s ON s.Student_Id = a.Student_Id
       WHERE a.Batch_Id = ?
         AND a.Student_Id IN (${studentIds.map(() => '?').join(',')})
       ORDER BY s.Student_Name`,
      [batch.Batch_Id, ...studentIds]
    );

    console.log('Final admissions for test students:');
    for (const r of verify) {
      console.log(`- ${r.Student_Name}: Admission_Id=${r.Admission_Id}, Batch_Id=${r.Batch_Id}, Course_Id=${r.Course_Id}, Admission_Date=${r.Admission_Date}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Failed:', err.message || err);
  process.exit(1);
});
