import mysql from 'mysql2/promise';

async function run() {
  const conn = await mysql.createConnection({
    host: '115.124.106.101',
    port: 3306,
    database: 'sit',
    user: 'sitadmin',
    password: 'sJ%3g14n9'
  });
  const [rows] = await conn.query('SELECT * FROM student_master WHERE Student_Id = 12711');
  console.error(JSON.stringify(rows[0], null, 2));
  await conn.end();
}
run().catch(console.error);
