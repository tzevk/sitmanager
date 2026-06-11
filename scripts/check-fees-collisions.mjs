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

const [oldRows] = await oldConn.query(
  `SELECT Fees_Id, Student_Id, Admission_Id, Fees_Code, Amount, Total_Amt, RDate FROM S_Fees_Mst`
);
const [newRows] = await newConn.query(
  `SELECT Fees_Id FROM s_fees_mst`
);

const newIds = new Set(newRows.map(r => r.Fees_Id));
const onlyOld = oldRows.filter(r => !newIds.has(r.Fees_Id));

console.log(`onlyOld count: ${onlyOld.length}`);
console.log('Range:', Math.min(...onlyOld.map(r=>r.Fees_Id)), '-', Math.max(...onlyOld.map(r=>r.Fees_Id)));
for (const r of onlyOld) console.log(JSON.stringify(r));

await oldConn.end();
await newConn.end();
