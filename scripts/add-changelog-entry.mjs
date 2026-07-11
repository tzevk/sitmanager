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

const conn = await mysql.createConnection({
  host: env.DB_HOST, port: parseInt(env.DB_PORT || '3306', 10),
  database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASSWORD,
  dateStrings: true, connectTimeout: 30_000,
});

await conn.query(`
  CREATE TABLE IF NOT EXISTS software_changelog (
    Id INT NOT NULL AUTO_INCREMENT,
    Title VARCHAR(255) NOT NULL,
    Description TEXT NULL,
    Category VARCHAR(30) NOT NULL DEFAULT 'Update',
    Commit_Hash VARCHAR(64) NULL,
    Author VARCHAR(100) NULL,
    Created_Date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (Id),
    UNIQUE KEY uq_changelog_commit (Commit_Hash),
    INDEX idx_changelog_created (Created_Date)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`);

const title = process.argv[2];
const description = process.argv[3] ?? null;
const category = process.argv[4] ?? 'Update';
const author = process.argv[5] ?? null;

if (!title) {
  console.error('Usage: node scripts/add-changelog-entry.mjs "<title>" "<description>" "<category>" "<author>"');
  process.exit(1);
}

const [result] = await conn.query(
  `INSERT INTO software_changelog (Title, Description, Category, Author) VALUES (?, ?, ?, ?)`,
  [title, description, category, author]
);
console.log('Inserted changelog entry, Id =', result.insertId);

await conn.end();
