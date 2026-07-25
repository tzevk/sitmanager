/*
 * One-off migration: adds standard_seq/actual_seq/lecture_status to batch_slecture_master
 * and an index on standard_lecture_plan_template.course_name, then backfills existing rows.
 * Run once: node scripts/migrations/2026-07-25-lecture-plan-status-columns.js
 */
require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

function normalizeDate(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function computeLectureStatuses(rows) {
  const withSeq = rows.map((r) => ({
    ...r,
    _seq: r.standard_seq == null ? Infinity : r.standard_seq,
    _date: normalizeDate(r.date),
  }));

  const conducted = withSeq
    .filter((r) => r._date)
    .sort((a, b) => {
      if (a._date !== b._date) return a._date < b._date ? -1 : 1;
      if (a._seq !== b._seq) return a._seq - b._seq;
      return a.id - b.id;
    });

  conducted.forEach((r, i) => {
    r.actual_seq = i + 1;
  });

  for (const r of withSeq) {
    if (r._date) {
      const isReplacement = withSeq.some(
        (r2) => r2.id !== r.id && r2._seq < r._seq && (!r2._date || r2._date > r._date)
      );
      r.lecture_status = isReplacement ? 'replacement' : 'normal';
    } else {
      r.actual_seq = null;
      const isCancelled = conducted.some((r2) => r2._seq > r._seq);
      r.lecture_status = isCancelled ? 'cancelled' : 'pending';
    }
  }

  return withSeq;
}

async function columnExists(pool, table, column) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return Number(rows[0].cnt) > 0;
}

async function indexExists(pool, table, indexName) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName]
  );
  return Number(rows[0].cnt) > 0;
}

async function main() {
  const pool = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  console.log('Adding columns to batch_slecture_master...');
  if (!(await columnExists(pool, 'batch_slecture_master', 'standard_seq'))) {
    await pool.query(`ALTER TABLE batch_slecture_master ADD COLUMN standard_seq INT NULL AFTER lecture_no`);
    console.log('  added standard_seq');
  }
  if (!(await columnExists(pool, 'batch_slecture_master', 'actual_seq'))) {
    await pool.query(`ALTER TABLE batch_slecture_master ADD COLUMN actual_seq INT NULL AFTER standard_seq`);
    console.log('  added actual_seq');
  }
  if (!(await columnExists(pool, 'batch_slecture_master', 'lecture_status'))) {
    await pool.query(
      `ALTER TABLE batch_slecture_master ADD COLUMN lecture_status VARCHAR(20) NULL DEFAULT 'normal' AFTER status`
    );
    console.log('  added lecture_status');
  }
  if (!(await indexExists(pool, 'batch_slecture_master', 'idx_bslm_batch_status'))) {
    await pool.query(`ALTER TABLE batch_slecture_master ADD INDEX idx_bslm_batch_status (batch_id, lecture_status)`);
    console.log('  added idx_bslm_batch_status');
  }
  if (!(await indexExists(pool, 'batch_slecture_master', 'idx_bslm_batch_actualseq'))) {
    await pool.query(`ALTER TABLE batch_slecture_master ADD INDEX idx_bslm_batch_actualseq (batch_id, actual_seq)`);
    console.log('  added idx_bslm_batch_actualseq');
  }

  console.log('Adding index to standard_lecture_plan_template...');
  if (!(await indexExists(pool, 'standard_lecture_plan_template', 'idx_slpt_course_name'))) {
    await pool.query(`ALTER TABLE standard_lecture_plan_template ADD INDEX idx_slpt_course_name (course_name)`);
    console.log('  added idx_slpt_course_name');
  }

  console.log('Data-quality check: template course_name values not matching course_mst...');
  const [orphans] = await pool.query(`
    SELECT DISTINCT t.course_name
    FROM standard_lecture_plan_template t
    LEFT JOIN course_mst c ON c.Course_Name = t.course_name
    WHERE c.Course_Id IS NULL
  `);
  if (orphans.length) {
    console.log('  WARNING: orphaned course_name values with no matching course_mst row:', orphans.map((o) => o.course_name));
  } else {
    console.log('  none found');
  }

  console.log('Backfilling standard_seq / actual_seq / lecture_status for existing batches...');
  const [batchIds] = await pool.query(`SELECT DISTINCT batch_id FROM batch_slecture_master WHERE deleted IS NULL OR deleted = '0'`);

  let totalBatches = 0;
  let totalRows = 0;

  for (const { batch_id: batchId } of batchIds) {
    const [batchRows] = await pool.query(
      `SELECT b.Course_Id, c.Course_Name FROM batch_mst b LEFT JOIN course_mst c ON c.Course_Id = b.Course_Id WHERE b.Batch_Id = ?`,
      [batchId]
    );
    const courseName = batchRows[0]?.Course_Name || null;

    let templateByLectureNo = new Map();
    if (courseName) {
      const [templateRows] = await pool.query(
        `SELECT lecture_no FROM standard_lecture_plan_template WHERE course_name = ?`,
        [courseName]
      );
      for (const t of templateRows) {
        if (t.lecture_no != null) templateByLectureNo.set(t.lecture_no, t.lecture_no);
      }
    }

    const [lectureRows] = await pool.query(
      `SELECT id, lecture_no, date FROM batch_slecture_master WHERE batch_id = ? AND (deleted IS NULL OR deleted = '0')`,
      [batchId]
    );

    const rowsForStatus = lectureRows.map((r) => ({
      id: r.id,
      standard_seq: r.lecture_no != null && templateByLectureNo.has(r.lecture_no) ? r.lecture_no : null,
      date: r.date,
    }));

    const computed = computeLectureStatuses(rowsForStatus);

    for (const row of computed) {
      await pool.query(
        `UPDATE batch_slecture_master SET standard_seq = ?, actual_seq = ?, lecture_status = ? WHERE id = ?`,
        [row.standard_seq, row.actual_seq, row.lecture_status, row.id]
      );
      totalRows += 1;
    }
    totalBatches += 1;
  }

  console.log(`Backfilled ${totalRows} rows across ${totalBatches} batches.`);
  await pool.end();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
