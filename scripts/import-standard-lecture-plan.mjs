/**
 * Import a Standard Lecture Plan from a batch-style lecture plan export (.xlsx)
 * into standard_lecture_plan_template, the same table Piping Engineering lives in.
 *
 * Usage:
 *   node scripts/import-standard-lecture-plan.mjs edd            # dry run (prints what would be inserted)
 *   node scripts/import-standard-lecture-plan.mjs pdd --apply    # insert
 *   node scripts/import-standard-lecture-plan.mjs edd --apply --replace   # wipe that course's template first
 *
 * Column mapping (sheet header -> template column):
 *   EDD: Department -> department, Lecture_content -> module, Sub_topic -> sub_topics
 *   PDD: Module     -> department, Subject         -> module, Sub_topic -> sub_topics
 *   Faculty_name -> faculty; Assignment + Unit_test labels -> project_assignment
 *   Start_time AM/PM -> session (First/Second Half) when the course runs two sessions a day;
 *   single-session courses (EDD) leave session NULL so batches use their own timings.
 *
 * Calendar-only rows (holidays / vacations) and blank trailing rows are skipped and
 * lecture_no is renumbered 1..N, since a standard plan has no calendar.
 */

import mysql from 'mysql2/promise';
import XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

const COURSES = {
  edd: {
    file: 'edd-standard-lecture.xlsx',
    courseName: 'Engineering Design & Drafting',
    departmentCol: 'Department',
    moduleCol: 'Lecture_content',
    twoSessionsPerDay: false,
  },
  pdd: {
    file: 'pdd-standard-lecture.xlsx',
    courseName: 'Piping Design & Drafting',
    departmentCol: 'Module',
    moduleCol: 'Subject',
    twoSessionsPerDay: true,
  },
};

const HOLIDAY_RE = /holiday|vaction|vacation/i;

const DEPARTMENT_ALIASES = { 'auto cad': 'AutoCAD', autocad: 'AutoCAD' };

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

/** Single-line value: trim + collapse internal whitespace. */
const oneLine = (v) => String(v ?? '').replace(/\s+/g, ' ').trim() || null;

/** Multi-line value: Excel cells use either real newlines or long space runs as line breaks. */
const multiLine = (v) => {
  const lines = String(v ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/ {3,}/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return lines.length ? lines.join('\n') : null;
};

const normalizeDepartment = (v) => {
  const d = oneLine(v);
  if (!d) return null;
  return DEPARTMENT_ALIASES[d.toLowerCase()] ?? d;
};

const normalizeFaculty = (v) => oneLine(v)?.replace(/^(Mr|Ms|Mrs|Dr)\.\s*/i, (m, t) => `${t}. `) ?? null;

/** "Assigment Test -05" / "AssignmentTest-12" / "Assessment Test-014" -> "Assignment Test-05" etc. */
const normalizeTestLabel = (v) => {
  const s = oneLine(v);
  if (!s || HOLIDAY_RE.test(s)) return null;
  const m = s.match(/^(assig?n?e?m?e?n?t|assessment)\s*test\s*-?\s*0*(\d+)$/i);
  if (!m) return s;
  const kind = /^assess/i.test(m[1]) ? 'Assessment' : 'Assignment';
  return `${kind} Test-${m[2].padStart(2, '0')}`;
};

function buildRows(cfg) {
  const wb = XLSX.readFile(resolve(__dir, '..', cfg.file));
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' }).map((r) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim(), v]))
  );

  const skipped = [];
  const out = [];
  let day = 0;
  // Tests scheduled on a skipped holiday row move to the next real lecture.
  let carriedTests = [];

  for (const r of raw) {
    const module = oneLine(r[cfg.moduleCol]);
    const subTopics = multiLine(r.Sub_topic);
    const department = normalizeDepartment(r[cfg.departmentCol]);
    const sourceNo = r.Lecture_no;
    const rowTests = [normalizeTestLabel(r.Assignment), normalizeTestLabel(r.Unit_test)].filter(Boolean);

    if (!module && !subTopics) { skipped.push({ sourceNo, reason: 'blank row' }); continue; }
    if (HOLIDAY_RE.test(`${module ?? ''} ${department ?? ''}`)) {
      skipped.push({ sourceNo, reason: module, ...(rowTests.length && { movedToNextLecture: rowTests }) });
      carriedTests.push(...rowTests);
      continue;
    }

    let session = null;
    if (cfg.twoSessionsPerDay) {
      session = /PM/i.test(String(r.Start_time)) && !/^12/.test(String(r.Start_time)) ? 'Second Half' : 'First Half';
      if (session === 'First Half' || day === 0) day += 1;
    } else {
      day += 1;
    }

    const tests = [...carriedTests, ...rowTests];
    carriedTests = [];

    out.push({
      lecture_no: out.length + 1,
      day_no: day,
      session,
      department,
      module,
      sub_topics: subTopics,
      faculty: normalizeFaculty(r.Faculty_name),
      project_assignment: tests.length ? tests.join(' / ') : null,
    });
  }
  return { rows: out, skipped };
}

const [key, ...flags] = process.argv.slice(2);
const cfg = COURSES[key?.toLowerCase()];
if (!cfg) {
  console.error(`Usage: node scripts/import-standard-lecture-plan.mjs <${Object.keys(COURSES).join('|')}> [--apply] [--replace]`);
  process.exit(1);
}
const apply = flags.includes('--apply');
const replace = flags.includes('--replace');

const { rows, skipped } = buildRows(cfg);
for (const r of rows) {
  if (r.module && r.module.length > 255) throw new Error(`Lecture ${r.lecture_no}: module longer than 255 chars`);
  if (r.department && r.department.length > 150) throw new Error(`Lecture ${r.lecture_no}: department longer than 150 chars`);
}

console.log(`${cfg.courseName}: ${rows.length} lectures, ${rows.at(-1)?.day_no ?? 0} days, skipped ${skipped.length} rows`);
for (const s of skipped) console.log('  skipped', JSON.stringify(s));
if (!apply) {
  console.table(rows.map((r) => ({ ...r, sub_topics: r.sub_topics?.slice(0, 50) })));
  console.log('Dry run — pass --apply to insert.');
  process.exit(0);
}

const env = loadEnv(resolve(__dir, '../.env.local'));
const conn = await mysql.createConnection({
  host: env.DB_HOST, port: parseInt(env.DB_PORT || '3306', 10),
  database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASSWORD,
  connectTimeout: 30_000,
});

try {
  const [[course]] = await conn.query(
    `SELECT Course_Id FROM course_mst WHERE Course_Name = ? AND (IsDelete IS NULL OR IsDelete = 0) LIMIT 1`,
    [cfg.courseName]
  );
  if (!course) throw new Error(`Course "${cfg.courseName}" not found in course_mst`);

  await conn.beginTransaction();
  const [[{ cnt }]] = await conn.query(
    `SELECT COUNT(*) AS cnt FROM standard_lecture_plan_template WHERE course_name = ? FOR UPDATE`,
    [cfg.courseName]
  );
  if (Number(cnt) > 0) {
    if (!replace) throw new Error(`"${cfg.courseName}" already has ${cnt} template rows — rerun with --replace to overwrite`);
    await conn.query(`DELETE FROM standard_lecture_plan_template WHERE course_name = ?`, [cfg.courseName]);
    console.log(`Deleted ${cnt} existing rows`);
  }

  await conn.query(
    `INSERT INTO standard_lecture_plan_template
     (course_name, lecture_no, day_no, session, department, module, sub_topics, faculty, project_assignment, created_date)
     VALUES ?`,
    [rows.map((r) => [
      cfg.courseName, r.lecture_no, r.day_no, r.session, r.department, r.module,
      r.sub_topics, r.faculty, r.project_assignment, new Date(),
    ])]
  );
  await conn.commit();
  console.log(`Inserted ${rows.length} rows for "${cfg.courseName}"`);
} catch (err) {
  await conn.rollback().catch(() => {});
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await conn.end();
}
