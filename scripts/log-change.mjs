/**
 * Log a software changelog entry directly to the database.
 *
 * Usage:
 *   node scripts/log-change.mjs --title "Added X" --category Feature --description "..."
 *
 *   --title        Required. Short summary shown in the list/widget.
 *   --category     Optional. One of Feature | Fix | Improvement | Update (default: Update).
 *   --description  Optional. Longer description.
 *   --author       Optional. Defaults to "Tanvi".
 */

import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '../.env.local');

function loadEnv(path) {
  const lines = readFileSync(path, 'utf8').split('\n');
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : '';
    out[key] = value;
  }
  return out;
}

const env = loadEnv(envPath);
const args = parseArgs(process.argv.slice(2));

const title = (args.title || '').trim();
const description = (args.description || '').trim() || null;
const category = (args.category || 'Update').trim() || 'Update';
const author = (args.author || 'Tanvi').trim() || 'Tanvi';

if (!title) {
  console.error('Error: --title is required');
  process.exit(1);
}

const VALID_CATEGORIES = ['Feature', 'Fix', 'Improvement', 'Update'];
if (!VALID_CATEGORIES.includes(category)) {
  console.error(`Error: --category must be one of ${VALID_CATEGORIES.join(', ')}`);
  process.exit(1);
}

async function main() {
  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: parseInt(env.DB_PORT || '3306', 10),
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
  });

  try {
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

    await conn.query(
      `INSERT INTO software_changelog (Title, Description, Category, Author) VALUES (?, ?, ?, ?)`,
      [title, description, category, author]
    );

    console.log(`Logged: [${category}] ${title}`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Failed to log change:', err.message);
  process.exit(1);
});
