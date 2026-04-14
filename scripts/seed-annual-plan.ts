/**
 * Seed the annual_batch_plan table with the 2026 annual report data.
 *
 * Usage (from project root):
 *   npx tsx --env-file=.env scripts/seed-annual-plan.ts
 */
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST!,
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME!,
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  connectionLimit: 2,
});

const YEAR = 2026;

const rows = [
  { name: 'Advance Pipe Stress Analysis - Weekend',                   duration: '2 months',  fc: 3, tf: 3, minS: 20, admitted: 6,   target: 60,  pct: 10 },
  { name: 'Air Conditioning System Design (HVAC) - Fulltime',         duration: '1 month',   fc: 1, tf: 2, minS: 20, admitted: 4,   target: 40,  pct: 10 },
  { name: 'Air Conditioning System Design (HVAC) - Weekend',          duration: '3 months',  fc: 4, tf: 2, minS: 20, admitted: 22,  target: 40,  pct: 55 },
  { name: 'Basics AutoCAD - 2D',                                      duration: '1 month',   fc: 2, tf: 4, minS: 20, admitted: 5,   target: 80,  pct: 6 },
  { name: 'Electrical System Design - Fulltime',                      duration: '1 month',   fc: 2, tf: 3, minS: 20, admitted: 15,  target: 60,  pct: 25 },
  { name: 'Electrical System Design - Weekend',                       duration: '3 months',  fc: 2, tf: 2, minS: 20, admitted: 11,  target: 40,  pct: 28 },
  { name: 'Engineering Design & Drafting',                             duration: '1 year',    fc: 2, tf: 2, minS: 40, admitted: 80,  target: 80,  pct: 100 },
  { name: 'Mechanical Design Of Process Equipments - Fulltime',       duration: '1 month',   fc: 1, tf: 3, minS: 20, admitted: 0,   target: 60,  pct: 0 },
  { name: 'Mechanical Design Of Process Equipments - Weekend',        duration: '3 months',  fc: 1, tf: 2, minS: 20, admitted: 5,   target: 40,  pct: 13 },
  { name: 'MEP (Mechanical, Electrical & Plumbing) - Fulltime',       duration: '1 month',   fc: 2, tf: 3, minS: 20, admitted: 7,   target: 60,  pct: 12 },
  { name: 'MEP (Mechanical, Electrical & Plumbing) - Weekend',        duration: '3 months',  fc: 3, tf: 2, minS: 20, admitted: 15,  target: 40,  pct: 38 },
  { name: 'NDT (Non-Destructive Testing)',                             duration: '3 months',  fc: 0, tf: 2, minS: 10, admitted: 0,   target: 20,  pct: 0 },
  { name: 'Piping Design & Drafting',                                  duration: '1 year',    fc: 1, tf: 1, minS: 40, admitted: 26,  target: 40,  pct: 65 },
  { name: 'Piping Engineering - Fulltime',                             duration: '4 months',  fc: 4, tf: 3, minS: 70, admitted: 124, target: 210, pct: 59 },
  { name: 'Piping Engineering - Weekend',                              duration: '1 year',    fc: 1, tf: 1, minS: 40, admitted: 27,  target: 40,  pct: 68 },
  { name: 'Piping Engineeing - Online',                                duration: '8 months',  fc: 1, tf: 1, minS: 25, admitted: 7,   target: 25,  pct: 28 },
  { name: 'Process Engineering - Fulltime',                            duration: '1 month',   fc: 2, tf: 3, minS: 20, admitted: 6,   target: 60,  pct: 10 },
  { name: 'Process Engineering - Weekend',                             duration: '3 months',  fc: 2, tf: 2, minS: 20, admitted: 12,  target: 40,  pct: 30 },
  { name: 'Process Instrumentation & Control - Fulltime',              duration: '1 month',   fc: 2, tf: 3, minS: 20, admitted: 6,   target: 60,  pct: 10 },
  { name: 'Rotating Equipments - Weekend',                             duration: '4 months',  fc: 3, tf: 1, minS: 20, admitted: 15,  target: 20,  pct: 75 },
  { name: 'Structural Engineering - Fulltime',                         duration: '1 month',   fc: 1, tf: 2, minS: 20, admitted: 5,   target: 40,  pct: 13 },
  { name: 'Structural Engineering - Weekend',                          duration: '3 months',  fc: 2, tf: 3, minS: 20, admitted: 2,   target: 60,  pct: 3 },
];

async function main() {
  console.log(`Creating annual_batch_plan table if needed...`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS annual_batch_plan (
      Plan_Id INT AUTO_INCREMENT PRIMARY KEY,
      Plan_Year INT NOT NULL,
      Course_Id INT NULL,
      Training_Program_Name VARCHAR(255) NOT NULL,
      Duration VARCHAR(50),
      Frequency_Conducted INT DEFAULT 0,
      Target_Frequency INT DEFAULT 0,
      Min_Students_Per_Batch INT DEFAULT 0,
      Students_Admitted INT DEFAULT 0,
      Yearly_Students_Target INT DEFAULT 0,
      Percentage DECIMAL(5,2) DEFAULT 0,
      IsDelete TINYINT DEFAULT 0,
      Date_Added DATETIME DEFAULT CURRENT_TIMESTAMP,
      Date_Updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_year (Plan_Year),
      INDEX idx_course (Course_Id)
    )
  `);

  let inserted = 0;
  let updated = 0;

  for (const r of rows) {
    // Try to match Course_Id from course_mst
    const [match] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT Course_Id FROM course_mst WHERE LOWER(TRIM(Course_Name)) = LOWER(TRIM(?)) AND (IsDelete IS NULL OR IsDelete = 0) LIMIT 1`,
      [r.name]
    );
    const courseId = (match as mysql.RowDataPacket[])[0]?.Course_Id || null;

    // Check existing
    const [existing] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT Plan_Id FROM annual_batch_plan WHERE Plan_Year = ? AND LOWER(TRIM(Training_Program_Name)) = LOWER(TRIM(?)) AND (IsDelete = 0 OR IsDelete IS NULL) LIMIT 1`,
      [YEAR, r.name]
    );

    if ((existing as mysql.RowDataPacket[]).length > 0) {
      await pool.query(
        `UPDATE annual_batch_plan SET
          Course_Id = COALESCE(?, Course_Id), Duration = ?, Frequency_Conducted = ?,
          Target_Frequency = ?, Min_Students_Per_Batch = ?, Students_Admitted = ?,
          Yearly_Students_Target = ?, Percentage = ?
        WHERE Plan_Id = ?`,
        [courseId, r.duration, r.fc, r.tf, r.minS, r.admitted, r.target, r.pct, (existing as mysql.RowDataPacket[])[0].Plan_Id]
      );
      updated++;
      console.log(`  Updated: ${r.name}`);
    } else {
      await pool.query(
        `INSERT INTO annual_batch_plan
          (Plan_Year, Course_Id, Training_Program_Name, Duration, Frequency_Conducted, Target_Frequency, Min_Students_Per_Batch, Students_Admitted, Yearly_Students_Target, Percentage)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [YEAR, courseId, r.name, r.duration, r.fc, r.tf, r.minS, r.admitted, r.target, r.pct]
      );
      inserted++;
      console.log(`  Inserted: ${r.name}`);
    }
  }

  console.log(`\nDone! Inserted: ${inserted}, Updated: ${updated}, Total: ${rows.length}`);
  await pool.end();
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
