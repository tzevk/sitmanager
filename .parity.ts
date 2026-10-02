// Read-only. Aggregates only — no names or marks printed.
import mysql from 'mysql2/promise';
import fs from 'fs';
import { getStudentPortalContext } from './lib/student-portal/context';
import { getStudentAcademicRecords } from './lib/student-portal/academic-records';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>/^DB_[A-Z]+=/.test(l)).map(l=>{const i=l.indexOf('=');return [l.slice(0,i), l.slice(i+1).replace(/^["']|["']$/g,'')]}));
const pool = mysql.createPool({ host: env.DB_HOST, port: Number(env.DB_PORT||3306), user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME, connectionLimit: 3 });
(async () => {
  for (const code of ['01164', '01167', '00964']) {
    const [[b]]: any = await pool.query(`SELECT Batch_Id FROM batch_mst WHERE Batch_code=? ORDER BY Batch_Id DESC LIMIT 1`, [code]);
    if (!b) { console.log(code, 'not found'); continue; }
    const [studs]: any = await pool.query(`SELECT DISTINCT Student_Id FROM admission_master a WHERE a.Batch_Id=? AND (a.IsDelete=0 OR a.IsDelete IS NULL) AND UPPER(TRIM(COALESCE(a.Cancel,''))) NOT IN ('YES','1')`, [b.Batch_Id]);
    let students = 0, oldMarks = 0, kept = 0, mismatched = 0, newRows = 0, sheetless = 0, legacy = 0;
    for (const { Student_Id } of studs) {
      const ctx = await getStudentPortalContext(pool, Number(Student_Id));
      if (!ctx || ctx.batchId !== b.Batch_Id) continue;
      students++;
      const recs = await getStudentAcademicRecords(pool, ctx, ['ASSIGNMENT', 'UNIT_TEST']);
      newRows += recs.length;
      sheetless += recs.filter(r => r.sheetId === null).length;
      legacy += recs.filter(r => r.parentId < 0).length;
      const ids = [ctx.studentId, ...ctx.batchAdmissionIds];
      // Old source: every sheet holding this student's row (newest row wins)
      for (const [mod, sheetT, childT, sid] of [['ASSIGNMENT','assignment_taken','assignment_given_child','Given_Id'], ['UNIT_TEST','test_taken_master','test_taken_child','Take_Id']] as const) {
        const [rows]: any = await pool.query(
          `SELECT c.${sid} AS sid, c.Marks_Given FROM ${childT} c JOIN ${sheetT} s ON s.${sid}=c.${sid}
           WHERE s.Batch_Id=? AND (s.IsDelete=0 OR s.IsDelete IS NULL) AND c.Student_Id IN (?) AND (c.IsDelete=0 OR c.IsDelete IS NULL) ORDER BY c.ID`, [b.Batch_Id, ids]);
        const latest = new Map<number, any>(); for (const r of rows) latest.set(Number(r.sid), r.Marks_Given);
        for (const [sheet, mk] of latest) {
          oldMarks++;
          const rec = recs.find(r => r.sourceModule === mod && r.sheetId === sheet);
          if (!rec) continue;
          const m = mk === null || String(mk).trim() === '' ? null : Number(mk);
          if (rec.marksObtained === m || (m === null)) kept++; else mismatched++;
        }
      }
    }
    console.log(`batch ${code}: students=${students} oldSheetRows=${oldMarks} foundWithSameMark=${kept} mismatched=${mismatched} | newRecords=${newRows} testsWithNoSheetYet=${sheetless} legacyUnlinkedSheets=${legacy}`);
  }
  await pool.end();
})();
