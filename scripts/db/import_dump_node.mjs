#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { createConnection } from 'mysql2/promise';
import dotenv from 'dotenv';

// Node-based SQL dump importer.
// - No mysql CLI required
// - Streams the file and splits statements safely (tracks quotes/comments)
// - Ignores DELIMITER / LOCK TABLES / UNLOCK TABLES

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const inputPath = process.argv[2] || 'public/database.sql';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required (set it in .env.local or env).`);
  }
  return value;
}

const DB_HOST = requireEnv('DB_HOST');
const DB_PORT = Number(requireEnv('DB_PORT'));
const DB_USER = requireEnv('DB_USER');
const DB_PASSWORD = requireEnv('DB_PASSWORD');
const DB_NAME = requireEnv('DB_NAME');

const ALLOW_NONEMPTY_DB = process.env.ALLOW_NONEMPTY_DB === '1';
const RESET_DB = process.env.RESET_DB === '1';
const RESET_DB_CONFIRM = process.env.RESET_DB_CONFIRM || '';
const DROP_TABLES_IN_DUMP = process.env.DROP_TABLES_IN_DUMP === '1';
// If set, the importer will only execute statements for tables that already exist
// in the target DB. Tables that exist only in the dump are ignored.
const ONLY_EXISTING_TABLES = process.env.ONLY_EXISTING_TABLES === '1';
// If set, continue importing even if some statements/rows fail (will log them).
const CONTINUE_ON_ERROR = process.env.CONTINUE_ON_ERROR === '1';

if (!fs.existsSync(inputPath)) {
  console.error(`Dump file not found: ${inputPath}`);
  process.exit(2);
}

function isIgnorableStatement(statement) {
  const s = statement.trim();
  if (!s) return true;
  const upper = s.toUpperCase();
  if (upper.startsWith('DELIMITER ')) return true;
  if (upper.startsWith('LOCK TABLES')) return true;
  if (upper.startsWith('UNLOCK TABLES')) return true;
  return false;
}

function isLikelySqlStatementStart(statement) {
  const s = statement.trim();
  if (!s) return false;

  // Valid statements typically start with a keyword (A-Z) or a comment marker.
  // When a dump has malformed quoting, the stream splitter can produce fragments
  // like: "gvgitc360@gmail.com', ..." or "(HVAC)..." which are not executable SQL.
  if (s.startsWith('/*!')) return true;
  if (s.startsWith('/*') || s.startsWith('--') || s.startsWith('#')) return true;

  // Only allow known SQL keywords; this avoids treating fragments like
  // "someone@gmail.com', ..." as real statements.
  const u = s.toUpperCase();
  const keywords = [
    'CREATE',
    'INSERT',
    'ALTER',
    'DROP',
    'SET',
    'USE',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'REPLACE',
    'START',
    'COMMIT',
    'ROLLBACK',
    'BEGIN',
  ];

  return keywords.some((k) => u === k || u.startsWith(`${k} `));
}

function formatMysqlError(err) {
  const code = err?.code || err?.errno || 'UNKNOWN';
  const state = err?.sqlState ? ` ${err.sqlState}` : '';
  const msg = err?.message || String(err);
  return `${code}${state}: ${msg}`;
}

async function preflight(connection) {
  const [[dbRow]] = await connection.query('SELECT DATABASE() AS db');
  if (!dbRow?.db) {
    throw new Error('No database selected; connection did not select DB_NAME.');
  }

  const [[countRow]] = await connection.query(
    `SELECT COUNT(*) AS tableCount FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'`
  );

  const tableCount = Number(countRow?.tableCount || 0);
  if (tableCount > 0 && RESET_DB) {
    if (RESET_DB_CONFIRM !== 'YES') {
      throw new Error(
        `RESET_DB=1 requires RESET_DB_CONFIRM=YES (destructive). ` +
          `This will DROP all tables/views/routines in '${DB_NAME}' before importing.`
      );
    }
    return;
  }

  if (tableCount > 0 && !ALLOW_NONEMPTY_DB) {
    throw new Error(
      `Target database '${DB_NAME}' is not empty (has ${tableCount} tables). ` +
        `Set ALLOW_NONEMPTY_DB=1 to proceed anyway, or import into an empty database.`
    );
  }
}

async function scanDumpTableNames(filePath) {
  const tableNames = new Set();

  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  // Handle lines like: CREATE TABLE `awt_adminuser` (
  const createTableRegex = /^\s*CREATE\s+TABLE\s+`([^`]+)`\s*\(/i;

  for await (const line of rl) {
    const match = createTableRegex.exec(line);
    if (match?.[1]) tableNames.add(match[1]);
  }

  return [...tableNames];
}

async function getExistingTableNames(connection) {
  const [rows] = await connection.query(
    `SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'`
  );
  return new Set(rows.map((r) => r.name));
}

function extractSingleTableName(statement) {
  const s = statement.trim();
  let match = /^CREATE\s+TABLE\s+`([^`]+)`/i.exec(s);
  if (match?.[1]) return match[1];

  match = /^INSERT\s+INTO\s+`([^`]+)`/i.exec(s);
  if (match?.[1]) return match[1];

  match = /^ALTER\s+TABLE\s+`([^`]+)`/i.exec(s);
  if (match?.[1]) return match[1];

  match = /^DROP\s+TABLE\s+IF\s+EXISTS\s+`([^`]+)`/i.exec(s);
  if (match?.[1]) return match[1];

  return null;
}

function splitMultiRowInsert(statement) {
  const s = statement.trim();
  const m = /^INSERT\s+INTO\s+`([^`]+)`[\s\S]*?\bVALUES\b/i.exec(s);
  if (!m) return null;

  const valuesIndex = s.toUpperCase().indexOf('VALUES');
  if (valuesIndex < 0) return null;

  const prefix = s.slice(0, valuesIndex + 'VALUES'.length);
  let valuesPart = s.slice(valuesIndex + 'VALUES'.length);
  // Remove trailing semicolon if present
  valuesPart = valuesPart.replace(/;\s*$/, '');

  const tuples = [];
  let i = 0;

  let inSingle = false;
  let inDouble = false;
  let backslashStreak = 0;
  let depth = 0;
  let tupleStart = -1;

  while (i < valuesPart.length) {
    const ch = valuesPart[i];
    const next = i + 1 < valuesPart.length ? valuesPart[i + 1] : '';
    const isEscaped = backslashStreak % 2 === 1;

    if (inSingle) {
      if (ch === "'") {
        if (next === "'") {
          i += 2;
          backslashStreak = 0;
          continue;
        }
        if (!isEscaped) inSingle = false;
      }
    } else if (inDouble) {
      if (ch === '"') {
        if (next === '"') {
          i += 2;
          backslashStreak = 0;
          continue;
        }
        if (!isEscaped) inDouble = false;
      }
    } else {
      if (ch === "'" && !isEscaped) inSingle = true;
      else if (ch === '"' && !isEscaped) inDouble = true;
      else if (ch === '(') {
        if (depth === 0) tupleStart = i;
        depth++;
      } else if (ch === ')') {
        if (depth > 0) depth--;
        if (depth === 0 && tupleStart >= 0) {
          tuples.push(valuesPart.slice(tupleStart, i + 1).trim());
          tupleStart = -1;
        }
      }
    }

    backslashStreak = ch === '\\' ? backslashStreak + 1 : 0;
    i++;
  }

  if (tuples.length < 2) return null;

  const normalizedPrefix = prefix.trim();
  const columnCount = (() => {
    // Prefix ends with "VALUES". Try to count column identifiers in the column list.
    // Example: INSERT INTO `t` (`a`,`b`) VALUES
    const mm = /^INSERT\s+INTO\s+`[^`]+`\s*\(([^)]*)\)\s*VALUES\s*$/i.exec(normalizedPrefix);
    if (!mm?.[1]) return null;
    const cols = mm[1].match(/`[^`]+`/g);
    return cols ? cols.length : null;
  })();

  const countTupleValues = (tuple) => {
    // Count top-level comma-separated values inside ( ... )
    let t = tuple.trim();
    if (!t.startsWith('(') || !t.endsWith(')')) return null;
    t = t.slice(1, -1);

    let inSingle = false;
    let inDouble = false;
    let backslashStreak2 = 0;
    let parenDepth = 0;
    let count = 1;

    for (let j = 0; j < t.length; j++) {
      const ch2 = t[j];
      const next2 = j + 1 < t.length ? t[j + 1] : '';
      const isEscaped2 = backslashStreak2 % 2 === 1;

      if (inSingle) {
        if (ch2 === "'") {
          if (next2 === "'") {
            j++;
            backslashStreak2 = 0;
            continue;
          }
          if (!isEscaped2) inSingle = false;
        }
      } else if (inDouble) {
        if (ch2 === '"') {
          if (next2 === '"') {
            j++;
            backslashStreak2 = 0;
            continue;
          }
          if (!isEscaped2) inDouble = false;
        }
      } else {
        if (ch2 === "'" && !isEscaped2) inSingle = true;
        else if (ch2 === '"' && !isEscaped2) inDouble = true;
        else if (ch2 === '(') parenDepth++;
        else if (ch2 === ')' && parenDepth > 0) parenDepth--;
        else if (ch2 === ',' && parenDepth === 0) count++;
      }

      backslashStreak2 = ch2 === '\\' ? backslashStreak2 + 1 : 0;
    }

    return count;
  };

  let filteredTuples = tuples;
  if (columnCount && columnCount > 1) {
    filteredTuples = tuples.filter((t) => countTupleValues(t) === columnCount);
  }

  return { prefix: normalizedPrefix, tuples: filteredTuples, columnCount, originalTupleCount: tuples.length };
}

async function dropTables(connection, tableNames) {
  if (!tableNames.length) return;
  console.error(`Dropping ${tableNames.length} tables present in dump (preserving other tables)...`);

  for (const name of tableNames) {
    // Quote defensively; names come from backtick-captured dump.
    await connection.query(`DROP TABLE IF EXISTS \`${name}\``);
  }
}

async function resetDatabase(connection) {
  // Drop views first, then tables, then routines.
  // Keep it best-effort: if some objects cannot be dropped due to permissions,
  // fail fast so we don't do a partial import.
  const [views] = await connection.query(
    `SELECT table_name AS name FROM information_schema.views WHERE table_schema = DATABASE()`
  );
  for (const row of views) {
    await connection.query(`DROP VIEW IF EXISTS \`${row.name}\``);
  }

  const [tables] = await connection.query(
    `SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'`
  );
  for (const row of tables) {
    await connection.query(`DROP TABLE IF EXISTS \`${row.name}\``);
  }

  const [procs] = await connection.query(
    `SELECT routine_name AS name, routine_type AS type FROM information_schema.routines WHERE routine_schema = DATABASE()`
  );
  for (const row of procs) {
    if (row.type === 'PROCEDURE') {
      await connection.query(`DROP PROCEDURE IF EXISTS \`${row.name}\``);
    } else if (row.type === 'FUNCTION') {
      await connection.query(`DROP FUNCTION IF EXISTS \`${row.name}\``);
    }
  }
}

async function createSqlStatementStreamByLines(filePath, onStatement) {
  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let buffer = '';
  for await (const line of rl) {
    const trimmedLine = line.trim();

    // Skip standalone comment lines when not currently building a statement.
    if (!buffer) {
      if (!trimmedLine) continue;
      if (trimmedLine.startsWith('--') || trimmedLine.startsWith('#')) continue;
    }

    buffer += line;
    buffer += '\n';

    // Heuristic: mysqldump terminates statements at end-of-line with ';'.
    // This is intentionally resilient even if some strings in the dump have
    // malformed quoting that would desync a quote-aware parser.
    if (trimmedLine.endsWith(';')) {
      const statement = buffer.trim();
      buffer = '';
      if (!statement) continue;
      await onStatement(statement);
    }
  }

  const tail = buffer.trim();
  if (tail) await onStatement(tail);
}

async function main() {
  const connection = await createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    // dump imports are large; keep defaults conservative
    supportBigNumbers: true,
    multipleStatements: true,
  });

  try {
    await connection.query('SET FOREIGN_KEY_CHECKS=0');
    await preflight(connection);

    const existingTables = ONLY_EXISTING_TABLES ? await getExistingTableNames(connection) : null;
    if (ONLY_EXISTING_TABLES) {
      console.error(`ONLY_EXISTING_TABLES=1: will only apply statements for ${existingTables.size} existing tables.`);
    }

    if (RESET_DB) {
      console.error(`RESET_DB=1: dropping existing objects in '${DB_NAME}'...`);
      await resetDatabase(connection);
      console.error('Reset complete. Starting import...');
    }

    if (!RESET_DB && DROP_TABLES_IN_DUMP) {
      const dumpTables = await scanDumpTableNames(inputPath);
      const toDrop = existingTables ? dumpTables.filter((t) => existingTables.has(t)) : dumpTables;
      await dropTables(connection, toDrop);
    }

    let statementCount = 0;
    let executedCount = 0;
    let skippedGarbageCount = 0;

    await createSqlStatementStreamByLines(inputPath, async (statement) => {
      statementCount++;

      if (isIgnorableStatement(statement)) return;

      if (!isLikelySqlStatementStart(statement)) {
        skippedGarbageCount++;
        if (skippedGarbageCount <= 10) {
          const frag = statement.trim().slice(0, 140).replace(/\s+/g, ' ');
          console.error(`Skipping non-SQL fragment #${statementCount}: ${frag}…`);
        }
        return;
      }

      const trimmed = statement.trim();
      // The sanitizer should already remove USE/CREATE DATABASE, but ignore defensively.
      if (/^\s*USE\s+`?\w+`?\s*;?\s*$/i.test(trimmed)) return;
      if (/^\s*CREATE\s+DATABASE\b/i.test(trimmed)) return;
      if (/^\s*DROP\s+DATABASE\b/i.test(trimmed)) return;

      if (existingTables) {
        const tableName = extractSingleTableName(trimmed);
        if (tableName && !existingTables.has(tableName)) {
          return;
        }
      }

      try {
        await connection.query(trimmed);
      } catch (err) {
        const preview = trimmed.slice(0, 250).replace(/\s+/g, ' ');
        console.error(`Error executing statement #${statementCount}: ${preview}…`);
        console.error(`  ${formatMysqlError(err)}`);

        // Handle duplicate CREATE TABLE blocks in some dumps.
        if (/^\s*CREATE\s+TABLE\b/i.test(trimmed) && err?.code === 'ER_TABLE_EXISTS_ERROR') {
          if (CONTINUE_ON_ERROR) return;
        }

        // MariaDB/InnoDB can reject very wide rows (lots of VARCHARs) with ER_TOO_BIG_ROWSIZE.
        // In such cases, retry by switching the table engine to MyISAM so the schema can be created.
        if (/^\s*CREATE\s+TABLE\b/i.test(trimmed) && err?.code === 'ER_TOO_BIG_ROWSIZE') {
          const retry = trimmed.replace(/\bENGINE=InnoDB\b/i, 'ENGINE=MyISAM');
          if (retry !== trimmed) {
            console.error('  Retrying CREATE TABLE with ENGINE=MyISAM due to ER_TOO_BIG_ROWSIZE...');
            try {
              await connection.query(retry);
              return;
            } catch (retryErr) {
              console.error(`  Retry failed: ${formatMysqlError(retryErr)}`);
              if (!CONTINUE_ON_ERROR) throw retryErr;
              return;
            }
          }
        }

        // If this is a multi-row INSERT, try row-by-row to isolate bad rows.
        const split = splitMultiRowInsert(trimmed);
        if (split) {
          const dropped =
            typeof split.originalTupleCount === 'number' ? split.originalTupleCount - split.tuples.length : 0;
          if (dropped > 0) {
            console.error(
              `Falling back to row-by-row INSERT (${split.tuples.length} rows; dropped ${dropped} malformed tuple(s))...`
            );
          } else {
            console.error(`Falling back to row-by-row INSERT (${split.tuples.length} rows)...`);
          }
          let ok = 0;
          let failed = 0;
          for (let idx = 0; idx < split.tuples.length; idx++) {
            const rowSql = `${split.prefix} ${split.tuples[idx]};`;
            try {
              await connection.query(rowSql);
              ok++;
            } catch (rowErr) {
              failed++;
              const rowPreview = split.tuples[idx].slice(0, 160).replace(/\s+/g, ' ');
              console.error(`Row ${idx + 1}/${split.tuples.length} failed: ${rowPreview}…`);
              console.error(`  ${formatMysqlError(rowErr)}`);
              if (!CONTINUE_ON_ERROR) throw rowErr;
            }
          }
          console.error(`Row-by-row result: ok=${ok} failed=${failed}`);
          if (failed > 0 && !CONTINUE_ON_ERROR) throw err;
          return;
        }

        if (CONTINUE_ON_ERROR) return;
        throw err;
      }

      executedCount++;
      if (executedCount % 200 === 0) {
        console.error(`Executed ${executedCount} statements…`);
      }
    });

    await connection.query('SET FOREIGN_KEY_CHECKS=1');
    console.error(
      `Import complete. Executed ${executedCount} statements. Skipped ${skippedGarbageCount} non-SQL fragments.`
    );
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
