import mysql from 'mysql2/promise';
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => /^[A-Z_0-9]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }));
const c = await mysql.createConnection({ host: env.DB_HOST, port: +env.DB_PORT, user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME, dateStrings: true });
const [r] = await c.query(process.argv[2]);
console.log(JSON.stringify(r));
await c.end();
