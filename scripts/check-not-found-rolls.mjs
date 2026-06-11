import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
function loadEnv(p) {
  const env = {};
  for (const l of readFileSync(p, 'utf8').split('\n')) {
    const t = l.trim(); if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('='); if (i < 0) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[t.slice(0, i).trim()] = v;
  }
  return env;
}
const env = loadEnv(resolve(__dir, '../.env.local'));

const oldConn = await mysql.createConnection({
  host: env.OLD_DB_HOST, port: parseInt(env.OLD_DB_PORT || '3306', 10),
  database: env.OLD_DB_NAME, user: env.OLD_DB_USER, password: env.OLD_DB_PASSWORD,
  dateStrings: true, connectTimeout: 30_000,
});
const newConn = await mysql.createConnection({
  host: env.DB_HOST, port: parseInt(env.DB_PORT || '3306', 10),
  database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASSWORD,
  dateStrings: true, connectTimeout: 30_000,
});

const rolls = [
  '26120370028','26011670010','26011670009','26100270008','26100270009',
  '26100270011','26100270012','26100270010','26090700003','26090700005',
  '26011690001','26070840003','26070840001','26100270006','26100280003',
];

const [oldRows] = await oldConn.query(
  `SELECT am.Admission_Id, am.Student_Id, am.Batch_Id, am.Student_Code, am.IsDelete, am.Cancel,
          s.Student_Name, b.Batch_code
   FROM Admission_master am
   LEFT JOIN Student_Master s ON s.Student_Id = am.Student_Id
   LEFT JOIN Batch_Mst b ON b.Batch_Id = am.Batch_Id
   WHERE am.Student_Code IN (${rolls.map(() => '?').join(',')})`,
  rolls
);

console.log('OLD DB rows:');
for (const r of oldRows) {
  console.log(JSON.stringify(r));
}

console.log('\nNEW DB lookups by Admission_Id:');
for (const r of oldRows) {
  const [nr] = await newConn.query(
    `SELECT am.Admission_Id, am.Student_Id, am.Batch_Id, am.Roll_No, am.IsDelete, am.Cancel,
            s.Student_Name, b.Batch_code
     FROM admission_master am
     LEFT JOIN student_master s ON s.Student_Id = am.Student_Id
     LEFT JOIN batch_mst b ON b.Batch_Id = am.Batch_Id
     WHERE am.Admission_Id = ?`,
    [r.Admission_Id]
  );
  console.log(`old AdmID=${r.Admission_Id} (${r.Student_Code}, ${r.Student_Name}) => `, nr.length ? JSON.stringify(nr[0]) : 'NOT FOUND');
}

await oldConn.end();
await newConn.end();
