/**
 * One-time audit export for the Student Master duplicate-cleanup work: produces an
 * .xlsx with three sheets —
 *   1. Unique Values   — the entire Student Master exactly as the app shows it today
 *      (one row per genuinely admitted student; same query as
 *      app/api/admission-activity/student/route.ts, unfiltered/unpaginated).
 *   2. Duplicate Values — every student_master record that shares a Name + Mobile
 *      with at least one other record, grouped together, so it's visible which
 *      groups were already cleaned (IsDelete=1 on their admission) vs the ones still
 *      needing manual review (multiple genuinely-admitted Status_id=8 records).
 *   3. Deleted Values   — every admission_master row currently soft-deleted
 *      (IsDelete=1), with student context, newest first.
 *
 * Usage: node scripts/db/export-student-master-audit.mjs [outputPath]
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import ExcelJS from 'exceljs';

const outputPath = process.argv[2] || 'student-master-audit.xlsx';

const EFFECTIVE_BATCH_CODE = `COALESCE(
  CASE WHEN LOWER(TRIM(COALESCE(sm.Transfered, ''))) = 'yes'
            AND TRIM(COALESCE(sm.Moved_To_Batch_Code, '')) <> ''
       THEN TRIM(sm.Moved_To_Batch_Code) END,
  NULLIF(TRIM(sm.Batch_Code), ''),
  bm.Batch_code
)`;

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  });

  const workbook = new ExcelJS.Workbook();

  // ── Sheet 1: Unique Values — the live Student Master list ─────────────────
  const [uniqueRows] = await pool.query(`
    SELECT
       sm.Student_Id,
       ${EFFECTIVE_BATCH_CODE} AS Batch_Code,
       sm.Student_Name,
       sm.Present_Address,
       sm.Email,
       sm.Present_Mobile,
       am.Payment_Type,
       sm.IsActive,
       CASE WHEN LOWER(TRIM(COALESCE(am.Cancel, ''))) IN ('yes','1','true') THEN 'Yes' ELSE 'No' END AS Cancelled,
       COALESCE(sm.Transfered, '') AS Transfered,
       COALESCE(sm.Moved_From_Batch_Code, '') AS Moved_From_Batch_Code,
       COALESCE(sm.Moved_To_Batch_Code, '') AS Moved_To_Batch_Code
     FROM admission_master am
     JOIN (
       SELECT Student_Id, MAX(Admission_Id) AS Admission_Id
       FROM admission_master
       WHERE IsDelete = 0 AND IsActive = 1
       GROUP BY Student_Id
     ) la ON la.Admission_Id = am.Admission_Id
     JOIN student_master sm ON sm.Student_Id = am.Student_Id
     LEFT JOIN batch_mst bm ON bm.Batch_Id = am.Batch_Id
     WHERE am.IsDelete = 0 AND am.IsActive = 1 AND (sm.IsDelete = 0 OR sm.IsDelete IS NULL)
     ORDER BY sm.Student_Id DESC
  `);

  const uniqueSheet = workbook.addWorksheet('Unique Values');
  uniqueSheet.columns = [
    { header: 'Student_Id', key: 'Student_Id', width: 12 },
    { header: 'Batch_Code', key: 'Batch_Code', width: 12 },
    { header: 'Student_Name', key: 'Student_Name', width: 30 },
    { header: 'Address', key: 'Present_Address', width: 30 },
    { header: 'Email', key: 'Email', width: 26 },
    { header: 'Mobile', key: 'Present_Mobile', width: 16 },
    { header: 'Payment_Type', key: 'Payment_Type', width: 16 },
    { header: 'Active', key: 'IsActive', width: 10 },
    { header: 'Cancelled', key: 'Cancelled', width: 10 },
    { header: 'Transferred', key: 'Transfered', width: 12 },
    { header: 'Moved_From_Batch', key: 'Moved_From_Batch_Code', width: 16 },
    { header: 'Moved_To_Batch', key: 'Moved_To_Batch_Code', width: 16 },
  ];
  uniqueSheet.addRows(uniqueRows);
  uniqueSheet.getRow(1).font = { bold: true };

  // ── Sheet 2: Duplicate Values — student_master rows sharing Name+Mobile ───
  const [dupGroups] = await pool.query(`
    SELECT Student_Name, Present_Mobile
    FROM student_master
    WHERE (IsDelete = 0 OR IsDelete IS NULL) AND Student_Name IS NOT NULL AND Student_Name <> ''
      AND Present_Mobile IS NOT NULL AND Present_Mobile <> ''
    GROUP BY Student_Name, Present_Mobile
    HAVING COUNT(*) > 1
  `);

  const dupSheet = workbook.addWorksheet('Duplicate Values');
  dupSheet.columns = [
    { header: 'Group', key: 'Group', width: 30 },
    { header: 'Student_Id', key: 'Student_Id', width: 12 },
    { header: 'Student_Name', key: 'Student_Name', width: 30 },
    { header: 'Mobile', key: 'Present_Mobile', width: 16 },
    { header: 'Status_id', key: 'Status_id', width: 10 },
    { header: 'Admission_Id', key: 'Admission_Id', width: 14 },
    { header: 'Batch_Code', key: 'Batch_Code', width: 12 },
    { header: 'Admission_Active', key: 'Admission_Active', width: 14 },
    { header: 'Admission_Deleted', key: 'Admission_Deleted', width: 16 },
  ];
  dupSheet.getRow(1).font = { bold: true };

  let dupRowCount = 0;
  for (const g of dupGroups) {
    const [members] = await pool.query(
      `SELECT sm.Student_Id, sm.Student_Name, sm.Present_Mobile, sm.Status_id,
              am.Admission_Id, am.IsActive AS Admission_Active, am.IsDelete AS Admission_Deleted,
              bm.Batch_code AS Batch_Code
       FROM student_master sm
       LEFT JOIN admission_master am ON am.Student_Id = sm.Student_Id
         AND am.Admission_Id = (SELECT MAX(Admission_Id) FROM admission_master WHERE Student_Id = sm.Student_Id)
       LEFT JOIN batch_mst bm ON bm.Batch_Id = am.Batch_Id
       WHERE sm.Student_Name = ? AND sm.Present_Mobile = ?
       ORDER BY sm.Student_Id`,
      [g.Student_Name, g.Present_Mobile]
    );
    const groupLabel = `${g.Student_Name} (${g.Present_Mobile})`;
    for (const m of members) {
      dupSheet.addRow({
        Group: groupLabel,
        Student_Id: m.Student_Id,
        Student_Name: m.Student_Name,
        Present_Mobile: m.Present_Mobile,
        Status_id: m.Status_id,
        Admission_Id: m.Admission_Id,
        Batch_Code: m.Batch_Code,
        Admission_Active: m.Admission_Active === 1 ? 'Yes' : 'No',
        Admission_Deleted: m.Admission_Deleted === 1 ? 'Yes (cleaned)' : 'No',
      });
      dupRowCount++;
    }
  }

  // ── Sheet 3: Deleted Values — soft-deleted admission_master rows ──────────
  const [deletedRows] = await pool.query(`
    SELECT am.Admission_Id, am.Student_Id, sm.Student_Name, sm.Present_Mobile, sm.Status_id,
           bm.Batch_code AS Batch_Code, am.Admission_Date
    FROM admission_master am
    LEFT JOIN student_master sm ON sm.Student_Id = am.Student_Id
    LEFT JOIN batch_mst bm ON bm.Batch_Id = am.Batch_Id
    WHERE am.IsDelete = 1
    ORDER BY am.Admission_Id DESC
  `);

  const deletedSheet = workbook.addWorksheet('Deleted Values');
  deletedSheet.columns = [
    { header: 'Admission_Id', key: 'Admission_Id', width: 14 },
    { header: 'Student_Id', key: 'Student_Id', width: 12 },
    { header: 'Student_Name', key: 'Student_Name', width: 30 },
    { header: 'Mobile', key: 'Present_Mobile', width: 16 },
    { header: 'Status_id', key: 'Status_id', width: 10 },
    { header: 'Batch_Code', key: 'Batch_Code', width: 12 },
    { header: 'Admission_Date', key: 'Admission_Date', width: 16 },
  ];
  deletedSheet.getRow(1).font = { bold: true };
  deletedSheet.addRows(deletedRows);

  await workbook.xlsx.writeFile(outputPath);

  console.log(`Unique Values: ${uniqueRows.length} rows`);
  console.log(`Duplicate Values: ${dupGroups.length} groups, ${dupRowCount} rows`);
  console.log(`Deleted Values: ${deletedRows.length} rows`);
  console.log(`Written to: ${outputPath}`);

  await pool.end();
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
