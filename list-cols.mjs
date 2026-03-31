import mysql from 'mysql2/promise';

async function run() {
  const conn = await mysql.createConnection({
    host: '115.124.106.101',
    user: 'sitadmin',
    password: 'sJ%3g14n9',
    database: 'sit'
  });
  const [rows] = await conn.query('DESCRIBE student_details');
  console.log("student_details:", rows.map(x=>x.Field).join(', '));
  const [r2] = await conn.query('DESCRIBE student_master_aca_rec');
  console.log("student_master_aca_rec:", r2.map(x=>x.Field).join(', '));
  await conn.end();
}
run().catch(console.error);
