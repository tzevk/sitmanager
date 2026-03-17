const mysql = require('mysql2/promise');
const crypto = require('crypto');

(async () => {
  const pool = mysql.createPool({
    host: '115.124.106.101',
    port: 3306,
    database: 'sit',
    user: 'sitadmin',
    password: 'sJ%3g14n9',
    connectionLimit: 2,
  });

  try {
    // 1. Insert a test student into student_master
    const [ins] = await pool.query(
      `INSERT INTO student_master (Student_Name, FName, LName, Email, Present_Mobile, IsActive, IsDelete, created_date)
       VALUES ('Test Student', 'Test', 'Student', 'testuser@sit.com', '9000000001', 1, 0, NOW())`
    );
    const studentId = ins.insertId;
    console.log('Test student created, Student_Id:', studentId);

    // 2. Create student_portal_auth table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS student_portal_auth (
        Id            INT AUTO_INCREMENT PRIMARY KEY,
        Student_Id    INT NOT NULL UNIQUE,
        Username      VARCHAR(255) NOT NULL UNIQUE,
        Password_Hash VARCHAR(255) NOT NULL,
        Last_Login    DATETIME,
        IsActive      TINYINT DEFAULT 1,
        Created_Date  DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('student_portal_auth table ready');

    // 3. Create portal login: username=testuser, password=test123
    const hash = crypto.createHash('md5').update('test123').digest('hex');
    await pool.query(
      'INSERT INTO student_portal_auth (Student_Id, Username, Password_Hash, IsActive) VALUES (?, ?, ?, 1)',
      [studentId, 'testuser', hash]
    );

    console.log('\nTest student portal user created:');
    console.log('  Student_Id :', studentId);
    console.log('  Student_Name: Test Student');
    console.log('  Email      : testuser@sit.com');
    console.log('  Username   : testuser');
    console.log('  Password   : test123');
  } catch (e) {
    console.error('Error:', e.message);
  }

  await pool.end();
})();
