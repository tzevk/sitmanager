const mysql = require('mysql2/promise');
const crypto = require('crypto');

(async () => {
  const pool = mysql.createPool({
    host: '115.124.106.101', port: 3306, database: 'sit',
    user: 'sitadmin', password: 'sJ%3g14n9', connectionLimit: 2,
  });

  try {
    // Create trainer_portal_auth table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trainer_portal_auth (
        Id            INT AUTO_INCREMENT PRIMARY KEY,
        Faculty_Id    INT NOT NULL UNIQUE,
        Username      VARCHAR(255) NOT NULL UNIQUE,
        Password_Hash VARCHAR(255) NOT NULL,
        Last_Login    DATETIME,
        IsActive      TINYINT DEFAULT 1,
        Created_Date  DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('trainer_portal_auth table created');

    // Create trainer_attendance table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trainer_attendance (
        Id          INT AUTO_INCREMENT PRIMARY KEY,
        Faculty_Id  INT NOT NULL,
        Batch_Id    INT,
        Attend_Date DATE NOT NULL,
        Check_In    TIME,
        Check_Out   TIME,
        Status      VARCHAR(20) DEFAULT 'Present',
        Remarks     TEXT,
        Created_Date DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_faculty_date (Faculty_Id, Attend_Date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('trainer_attendance table created');

    // Insert a test trainer (Faculty_Id = 9, Niti Gaekwad)
    const hash = crypto.createHash('md5').update('trainer123').digest('hex');
    await pool.query(
      `INSERT IGNORE INTO trainer_portal_auth (Faculty_Id, Username, Password_Hash, IsActive)
       VALUES (9, 'trainer', ?, 1)`,
      [hash]
    );
    console.log('\nTest trainer created:');
    console.log('  Username  : trainer');
    console.log('  Password  : trainer123');
    console.log('  Faculty_Id: 9 (Niti Gaekwad)');
  } catch (e) {
    console.error('Error:', e.message);
  }
  await pool.end();
})();
