/* eslint-disable @typescript-eslint/no-require-imports */
const mysql = require('mysql2/promise');
(async () => {
  const pool = mysql.createPool({ host: '115.124.106.101', port: 3306, database: 'sit', user: 'sitadmin', password: 'sJ%3g14n9', connectionLimit: 2 });
  const tables = ['faculty_master','trainer_attendance','batch_lecture_master','lecture_taken_master','lecture_taken_child'];
  for (const t of tables) {
    try {
      const [cols] = await pool.query('DESCRIBE ' + t);
      console.log(t + ':\n  ' + cols.map(c=>c.Field+' '+c.Type+(c.Key==='PRI'?' PK':'')).join('\n  '));
    } catch { console.log(t + ': NOT FOUND'); }
  }
  const [f] = await pool.query('SELECT Faculty_Id, Faculty_Name, Email, Mobile FROM faculty_master WHERE (IsDelete=0 OR IsDelete IS NULL) LIMIT 3');
  console.log('\nSample faculty:', JSON.stringify(f,null,2));
  const [bl] = await pool.query('SELECT * FROM batch_lecture_master LIMIT 1');
  console.log('\nSample batch_lecture:', JSON.stringify(bl,null,2));
  await pool.end();
})();
