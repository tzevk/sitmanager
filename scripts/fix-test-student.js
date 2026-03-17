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
    // Check existing portal auth entries
    const [rows] = await pool.query('SELECT * FROM student_portal_auth WHERE Username = ?', ['testuser']);
    console.log('Existing testuser entries:', JSON.stringify(rows, null, 2));

    // Delete existing testuser entry
    await pool.query('DELETE FROM student_portal_auth WHERE Username = ?', ['testuser']);
    console.log('Deleted old testuser entry');

    // Re-insert linked to student 176416
    const hash = crypto.createHash('md5').update('test123').digest('hex');
    await pool.query(
      'INSERT INTO student_portal_auth (Student_Id, Username, Password_Hash, IsActive) VALUES (?, ?, ?, 1)',
      [176416, 'testuser', hash]
    );

    console.log('\nTest student portal user ready:');
    console.log('  Student_Id  : 176416');
    console.log('  Student_Name: Test Student');
    console.log('  Email       : testuser@sit.com');
    console.log('  Username    : testuser');
    console.log('  Password    : test123');
  } catch (e) {
    console.error('Error:', e.message);
  }

  await pool.end();
})();
