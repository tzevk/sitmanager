/* eslint-disable @typescript-eslint/no-require-imports */
const mysql = require('mysql2/promise');

async function addDefaultColumn() {
  const connection = await mysql.createConnection({
    host: '115.124.106.101',
    port: 3306,
    user: 'sitadmin',
    password: 'sJ%3g14n9',
    database: 'sit'
  });

  try {
    console.log('Connected to database');

    // Check if Is_Default column exists
    const [columns] = await connection.query(
      `SHOW COLUMNS FROM student_cvs LIKE 'Is_Default'`
    );

    if (columns.length === 0) {
      console.log('Adding Is_Default column to student_cvs table...');
      await connection.query(`
        ALTER TABLE student_cvs 
        ADD COLUMN Is_Default TINYINT(1) DEFAULT 0 AFTER CV_Path
      `);
      console.log('✓ Is_Default column added successfully');
    } else {
      console.log('✓ Is_Default column already exists');
    }

    // Show current structure
    const [structure] = await connection.query('DESCRIBE student_cvs');
    console.log('\nCurrent student_cvs table structure:');
    console.table(structure);

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

addDefaultColumn().catch(console.error);
