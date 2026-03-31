import mysql from 'mysql2/promise';

async function run() {
  const conn = await mysql.createConnection({
    host: '115.124.106.101',
    user: 'sitadmin',
    password: 'sJ%3g14n9',
    database: 'sit'
  });
  const [rows] = await conn.query('SHOW TABLES LIKE "%edu%"');
  console.log(rows);
  const [r2] = await conn.query('SHOW TABLES LIKE "%detail%"');
  console.log(r2);
  const [r3] = await conn.query('SHOW TABLES LIKE "%stud%"');
  console.log(r3.map(x=>Object.values(x)[0]).join(', '));
  await conn.end();
}
run().catch(console.error);
