/* eslint-disable @typescript-eslint/no-explicit-any */
// Shared student_attendance schema bootstrap — used by both the Attendance
// page API and the biometric sync cron, so the table definition lives once.

let tableReady = false;

export async function ensureAttendanceTable(pool: any) {
  if (tableReady) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS student_attendance (
        Attendance_Id INT AUTO_INCREMENT PRIMARY KEY,
        Batch_Id      INT      NOT NULL,
        Student_Id    INT      NOT NULL,
        Admission_Id  INT      NOT NULL,
        Attendance_Date DATE   NOT NULL,
        Session       ENUM('first_half','second_half') NOT NULL DEFAULT 'first_half',
        In_Time       TIME     NULL,
        Out_Time      TIME     NULL,
        Status        CHAR(1)  NOT NULL DEFAULT 'P' COMMENT 'P=Present, A=Absent, L=Late',
        Remarks       VARCHAR(255) NULL,
        Created_At    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        Updated_At    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        IsDelete      TINYINT(1) DEFAULT 0,
        UNIQUE KEY uq_attendance (Batch_Id, Student_Id, Attendance_Date, Session)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    const [sessionCol] = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'student_attendance'
         AND COLUMN_NAME = 'Session'`
    );
    if (!sessionCol?.[0]?.cnt) {
      await pool.query(
        `ALTER TABLE student_attendance
         ADD COLUMN Session ENUM('first_half','second_half') NOT NULL DEFAULT 'first_half' AFTER Attendance_Date`
      );
    }

    // ensure In_Time and Out_Time columns exist
    const [inTimeCol] = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'student_attendance'
         AND COLUMN_NAME = 'In_Time'`
    );
    if (!inTimeCol?.[0]?.cnt) {
      await pool.query(`ALTER TABLE student_attendance ADD COLUMN In_Time TIME NULL AFTER Session`);
    }
    const [outTimeCol] = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'student_attendance'
         AND COLUMN_NAME = 'Out_Time'`
    );
    if (!outTimeCol?.[0]?.cnt) {
      await pool.query(`ALTER TABLE student_attendance ADD COLUMN Out_Time TIME NULL AFTER In_Time`);
    }

    const [uniqIdx] = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'student_attendance'
         AND INDEX_NAME = 'uq_attendance'`
    );
    if (uniqIdx?.[0]?.cnt) {
      await pool.query(`ALTER TABLE student_attendance DROP INDEX uq_attendance`);
    }
    await pool.query(
      `ALTER TABLE student_attendance
       ADD UNIQUE KEY uq_attendance (Batch_Id, Student_Id, Attendance_Date, Session)`
    );

    tableReady = true;
  } catch {
    tableReady = true;
  }
}
