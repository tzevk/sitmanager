const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Read .env.local
const envFile = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const idx = line.indexOf('=');
  if (idx > 0) {
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (key) env[key] = val;
  }
});

const DB_HOST = env.DB_HOST;
const DB_PORT = parseInt(env.DB_PORT || '3306');
const DB_USER = env.DB_USER;
const DB_PASSWORD = env.DB_PASSWORD;
const TARGET_DB = 'sit';

console.log(`DB: ${DB_USER}@${DB_HOST}:${DB_PORT} -> ${TARGET_DB}`);

(async () => {
  console.log('Reading SQL file...');
  let sql = fs.readFileSync('abhishek_sit.sql', 'utf-8');

  // Replace database name
  sql = sql.replace(/`abhishek_sit`/g, '`sit`');
  console.log('Replaced `abhishek_sit` -> `sit`');

  // Remove DEFINER clauses
  sql = sql.replace(/DEFINER=`[^`]*`@`[^`]*`\s*/g, '');
  console.log('Removed DEFINER clauses');

  // Force ROW_FORMAT=DYNAMIC to avoid row-size-too-large errors
  sql = sql.replace(/ROW_FORMAT\s*=\s*(COMPACT|REDUNDANT|FIXED)/gi, 'ROW_FORMAT=DYNAMIC');
  console.log('Forced ROW_FORMAT=DYNAMIC');

  // Connect (no database specified so we can DROP/CREATE it)
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    multipleStatements: true,
    connectTimeout: 30000,
    dateStrings: true,
  });
  console.log('Connected to server');

  // Set session vars to avoid row-size and strict-mode errors
  await conn.query("SET SESSION innodb_strict_mode = OFF");
  await conn.query("SET SESSION foreign_key_checks = 0");
  await conn.query("SET SESSION sql_mode = ''");
  console.log('Session vars set (innodb_strict_mode=OFF, fk_checks=0)');

  // Drop and recreate database
  console.log('Dropping existing `sit` database...');
  await conn.query('DROP DATABASE IF EXISTS `sit`');
  console.log('Creating fresh `sit` database...');
  await conn.query('CREATE DATABASE `sit` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci');
  await conn.query('USE `sit`');
  console.log('Database `sit` ready');

  // Strip the CREATE DATABASE / USE lines from the dump (we already did that)
  sql = sql.replace(/CREATE DATABASE IF NOT EXISTS `sit`[^;]*;/g, '');
  sql = sql.replace(/USE `sit`;/g, '');

  // Handle DELIMITER $$ ... DELIMITER ; blocks separately
  const delimiterRegex = /DELIMITER\s+\$\$([\s\S]*?)DELIMITER\s*;/g;
  const procBlocks = [];
  sql = sql.replace(delimiterRegex, (_, body) => {
    const procs = body.split('$$').filter(s => s.trim());
    procBlocks.push(...procs);
    return '';
  });

  // Split into individual statements properly
  // We need to handle multi-line INSERT/CREATE statements
  const statements = [];
  let current = '';
  const lines = sql.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('--') || (trimmed.startsWith('/*') && trimmed.endsWith('*/'))) {
      // But keep SET and other inline comments that are MySQL directives
      if (trimmed.startsWith('/*!') && trimmed.endsWith('*/;')) {
        statements.push(trimmed);
      }
      continue;
    }
    current += line + '\n';
    // Statement ends with ; (but not inside a string — simple heuristic: line ends with ;)
    if (trimmed.endsWith(';')) {
      statements.push(current.trim());
      current = '';
    }
  }
  if (current.trim()) {
    statements.push(current.trim());
  }

  console.log(`Total statements: ${statements.length}, Procedures: ${procBlocks.length}`);

  // Execute statements in batches for speed
  const BATCH_SIZE = 50;
  let executed = 0;
  let errors = 0;

  for (let i = 0; i < statements.length; i += BATCH_SIZE) {
    const batch = statements.slice(i, i + BATCH_SIZE).join('\n');
    if (!batch.trim()) continue;

    try {
      await conn.query(batch);
    } catch (err) {
      // If batch fails, try individual statements
      for (let j = i; j < Math.min(i + BATCH_SIZE, statements.length); j++) {
        const stmt = statements[j];
        if (!stmt.trim()) continue;
        try {
          await conn.query(stmt);
        } catch (err2) {
          errors++;
          if (errors <= 10) {
            console.error(`\nError at stmt ${j + 1}: ${err2.message?.slice(0, 150)}`);
          }
        }
      }
    }

    executed = Math.min(i + BATCH_SIZE, statements.length);
    process.stdout.write(`\rProgress: ${executed}/${statements.length} statements (${errors} errors)    `);
  }

  console.log(`\n\nSQL import done: ${executed} statements, ${errors} errors`);

  // Execute stored procedures
  for (let i = 0; i < procBlocks.length; i++) {
    const proc = procBlocks[i].trim();
    if (!proc) continue;
    try {
      await conn.query(proc);
      console.log(`Procedure ${i + 1}/${procBlocks.length} created`);
    } catch (err) {
      console.error(`Procedure ${i + 1} error: ${err.message?.slice(0, 200)}`);
    }
  }

  // Verify
  const [tables] = await conn.query("SELECT COUNT(*) as cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'sit'");
  console.log(`\nVerification: ${tables[0].cnt} tables in \`sit\` database`);

  await conn.end();
  console.log('Done! Database `sit` imported successfully.');
})().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
