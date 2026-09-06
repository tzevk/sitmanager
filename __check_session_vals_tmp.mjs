import mysql from 'mysql2/promise';
import fs from 'fs';
const envText = fs.readFileSync('.env.local', 'utf8') + '\n' + fs.readFileSync('.env', 'utf8');
const env = {};
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, '');
}
const conn = await mysql.createConnection({
  host: env.DB_HOST, port: Number(env.DB_PORT) || 3306, database: env.DB_NAME,
  user: env.DB_USER, password: env.DB_PASSWORD,
});
const [vals] = await conn.execute(`SELECT session, COUNT(*) c FROM batch_slecture_master GROUP BY session ORDER BY c DESC LIMIT 10`);
console.log('session value distribution:', JSON.stringify(vals));

// how many published/taken (visible-on-portal) rows have no session set
const [noSession] = await conn.execute(`
  SELECT COUNT(*) c FROM batch_slecture_master s
  LEFT JOIN lecture_taken_master lt ON lt.Lecture_Id = s.id AND lt.Batch_Id = s.batch_id AND (lt.IsDelete=0 OR lt.IsDelete IS NULL)
  WHERE (s.deleted='0' OR s.deleted IS NULL) AND (s.publish='Yes' OR lt.Take_Id IS NOT NULL) AND (s.session IS NULL OR s.session='')
`);
console.log('visible rows with no session set:', JSON.stringify(noSession[0]));
await conn.end();
