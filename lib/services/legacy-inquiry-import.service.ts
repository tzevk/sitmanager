/* eslint-disable @typescript-eslint/no-explicit-any */
import { getLegacyPool, getPool } from '@/lib/db';

/**
 * Import inquiries that exist in the old software but are missing from the new
 * CRM — insert-only, never overwrites or deletes anything.
 *
 * The two systems allocate Inquiry_Id independently and the ranges now overlap:
 * the new CRM's website sync has already used IDs the old software hands out
 * today (e.g. 65132–65139 are May website inquiries in the new CRM but October
 * inquiries in the old one). So matching by ID alone is wrong. An old inquiry
 * counts as present when the new row with the same ID is the same person, or
 * when its phone/email already exists anywhere in the new CRM. Otherwise it is
 * inserted with a NEW Inquiry_Id and its old discussions are copied across.
 *
 * Every old ID handled is recorded in legacy_inquiry_import_map, so nothing is
 * imported twice and the scheduled run only looks at old inquiries newer than
 * the last one handled.
 *
 * (The older legacy-inquiry-sync upserted by ID and soft-deleted website rows;
 * with overlapping IDs that overwrites unrelated inquiries — don't use it.)
 */

export interface LegacyInquiryImportOptions {
  /** Count what would happen without writing anything. */
  dryRun?: boolean;
  /** Re-scan every old inquiry instead of only those after the last one handled. */
  full?: boolean;
}

export interface LegacyInquiryImportSummary {
  configured: boolean;
  skippedBusy: boolean;
  dryRun: boolean;
  scanned: number;
  alreadyHandled: number;
  sameInquiry: number;
  personAlreadyInCrm: number;
  emptyRows: number;
  imported: number;
  discussionsCopied: number;
  /** Old discussions copied onto inquiries that already existed in the new CRM. */
  discussionsBackfilled: number;
  /** Old discussions skipped because the same text on the same date is already there. */
  discussionsAlreadyPresent: number;
  /** True when the backfill stopped at its time budget; the next run continues. */
  discussionsPending: boolean;
  importedIds: Array<{ oldId: number; newId: number | null }>;
  errors: string[];
}

const OLD_INQ = 'Student_Inquiry';
const NEW_INQ = 'student_inquiry';
const DISC = 'awt_inquirydiscussion';
const MAP = 'legacy_inquiry_import_map';
const DMAP = 'legacy_discussion_import_map';
/** Stop backfilling discussions after this long so the scheduled run finishes in time. */
const DISCUSSION_BUDGET_MS = 150_000;
const DISCUSSION_PAGE = 2000;
const LOCK = 'sit:legacy-inquiry-import';
/** Re-check this many old IDs below the last handled one, in case old rows arrive out of order. */
const OVERLAP = 500;

const phoneKey = (v: unknown) => {
  const d = String(v ?? '').replace(/\D/g, '');
  // 2147483647 is the website feed's INT-overflow placeholder, not a number.
  return d.length >= 10 && d !== '2147483647' ? d.slice(-10) : null;
};
const emailKey = (v: unknown) => {
  const t = String(v ?? '').trim().toLowerCase();
  return t.includes('@') ? t : null;
};
const nameKey = (v: unknown) => String(v ?? '').toLowerCase().replace(/[^a-z]/g, '');

async function ensureMapTable(pool: any) {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS ${MAP} (
       Old_Inquiry_Id INT NOT NULL PRIMARY KEY,
       New_Inquiry_Id INT NULL,
       Match_Type VARCHAR(20) NOT NULL,
       Handled_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
       INDEX idx_legacy_inq_map_new (New_Inquiry_Id)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );
}

async function ensureDiscussionMapTable(pool: any) {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS ${DMAP} (
       Old_Discussion_Id INT NOT NULL PRIMARY KEY,
       New_Inquiry_Id INT NULL,
       New_Discussion_Id INT NULL,
       Match_Type VARCHAR(20) NOT NULL,
       Handled_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );
}

const discussionKey = (inquiryId: number, date: unknown, text: unknown) =>
  `${inquiryId}|${String(date ?? '').slice(0, 10)}|${String(text ?? '').toLowerCase().replace(/\s+/g, ' ').trim()}`;

/**
 * Copy old-software discussions onto the matching new-CRM inquiry for every old
 * inquiry already handled (same ID, same person by phone/email, or imported).
 * Skips a discussion whose text and date are already on that inquiry, records each
 * old discussion handled in legacy_discussion_import_map, and resumes from the
 * highest one handled — so follow-ups added later in the old software come across too.
 */
async function backfillLegacyDiscussions(conn: any, oldPool: any, discCols: string[], s: LegacyInquiryImportSummary) {
  if (!discCols.length) return;
  const deadline = Date.now() + DISCUSSION_BUDGET_MS;

  const [mapRows] = await conn.query(`SELECT Old_Inquiry_Id o, New_Inquiry_Id n FROM ${MAP} WHERE New_Inquiry_Id IS NOT NULL`);
  const newIdFor = new Map<number, number>();
  for (const r of mapRows as any[]) newIdFor.set(Number(r.o), Number(r.n));
  if (!newIdFor.size) return;

  let lastId = 0;
  if (!s.dryRun) {
    await ensureDiscussionMapTable(conn);
    const [[w]] = await conn.query(`SELECT COALESCE(MAX(Old_Discussion_Id), 0) mx FROM ${DMAP}`);
    lastId = Number(w.mx);
  }
  const colList = discCols.map((c) => `\`${c}\``).join(', ');
  const inquiryCol = discCols.find((c) => c.toLowerCase() === 'inquiry_id');
  const textCol = discCols.find((c) => c.toLowerCase() === 'discussion');
  if (!inquiryCol || !textCol) return;

  for (;;) {
    if (Date.now() > deadline) { s.discussionsPending = true; return; }
    const [page] = await oldPool.query(
      `SELECT id AS __old_id, DATE_FORMAT(\`date\`, '%Y-%m-%d') AS __day, ${colList} FROM ${DISC}
       WHERE id > ? AND (deleted = 0 OR deleted IS NULL)
       ORDER BY id LIMIT ?`,
      [lastId, DISCUSSION_PAGE]
    );
    const rows = page as any[];
    if (!rows.length) return;
    lastId = Number(rows[rows.length - 1].__old_id);

    const targets = [...new Set(rows.map((r) => newIdFor.get(Number(r[inquiryCol]))).filter((v): v is number => v != null))];
    const present = new Set<string>();
    if (targets.length) {
      const [existing] = await conn.query(
        `SELECT Inquiry_id i, DATE_FORMAT(\`date\`, '%Y-%m-%d') d, discussion t FROM ${DISC}
         WHERE Inquiry_id IN (?) AND (deleted = 0 OR deleted IS NULL)`,
        [targets]
      );
      for (const e of existing as any[]) present.add(discussionKey(Number(e.i), e.d, e.t));
    }

    const inserts: Array<{ oldDiscId: number; newInquiryId: number; values: any[] }> = [];
    const handled: any[][] = [];
    for (const r of rows) {
      const oldDiscId = Number(r.__old_id);
      const newInquiryId = newIdFor.get(Number(r[inquiryCol]));
      if (newInquiryId == null) { handled.push([oldDiscId, null, null, 'no_inquiry']); continue; }
      const key = discussionKey(newInquiryId, r.__day, r[textCol]);
      if (present.has(key)) {
        s.discussionsAlreadyPresent++;
        handled.push([oldDiscId, newInquiryId, null, 'present']);
        continue;
      }
      present.add(key);
      inserts.push({ oldDiscId, newInquiryId, values: discCols.map((c) => (c === inquiryCol ? newInquiryId : r[c] ?? null)) });
    }

    if (s.dryRun) { s.discussionsBackfilled += inserts.length; continue; }
    try {
      await conn.beginTransaction();
      for (const ins of inserts) {
        const [res] = await conn.query(`INSERT INTO ${DISC} (${colList}) VALUES (?)`, [ins.values]);
        handled.push([ins.oldDiscId, ins.newInquiryId, Number(res.insertId), 'copied']);
      }
      await conn.query(
        `INSERT IGNORE INTO ${DMAP} (Old_Discussion_Id, New_Inquiry_Id, New_Discussion_Id, Match_Type) VALUES ?`,
        [handled]
      );
      await conn.commit();
      s.discussionsBackfilled += inserts.length;
    } catch (err) {
      await conn.rollback().catch(() => {});
      s.errors.push(`discussion backfill after old discussion ${lastId}: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
  }
}

async function columnNames(pool: any, table: string): Promise<string[]> {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME c, EXTRA x FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`,
    [table]
  );
  return (rows as any[]).filter((r) => !String(r.x ?? '').toLowerCase().includes('generated')).map((r) => String(r.c));
}

/** Columns present in both tables, minus the given (auto-increment) key. */
async function sharedColumns(oldPool: any, newPool: any, oldTable: string, newTable: string, exclude: string) {
  const [o, n] = await Promise.all([columnNames(oldPool, oldTable), columnNames(newPool, newTable)]);
  const nl = new Set(n.map((c) => c.toLowerCase()));
  return o.filter((c) => nl.has(c.toLowerCase()) && c.toLowerCase() !== exclude.toLowerCase());
}

export async function importMissingLegacyInquiries(
  options: LegacyInquiryImportOptions = {}
): Promise<LegacyInquiryImportSummary> {
  const s: LegacyInquiryImportSummary = {
    configured: false, skippedBusy: false, dryRun: Boolean(options.dryRun),
    scanned: 0, alreadyHandled: 0, sameInquiry: 0, personAlreadyInCrm: 0, emptyRows: 0,
    imported: 0, discussionsCopied: 0, discussionsBackfilled: 0, discussionsAlreadyPresent: 0,
    discussionsPending: false, importedIds: [], errors: [],
  };

  const oldPool = getLegacyPool() as any;
  if (!oldPool) return s;
  s.configured = true;
  const pool = getPool() as any;

  const conn = await pool.getConnection();
  try {
    const [[lock]] = await conn.query('SELECT GET_LOCK(?, 0) AS ok', [LOCK]);
    if (Number(lock?.ok) !== 1) { s.skippedBusy = true; return s; }

    try {
      if (!s.dryRun) { await ensureMapTable(conn); await ensureDiscussionMapTable(conn); }
      const [[mapExists]] = await conn.query(
        `SELECT COUNT(*) n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`, [MAP]
      );
      const handled = new Set<number>();
      let watermark = 0;
      if (Number(mapExists.n) > 0) {
        const [[w]] = await conn.query(`SELECT COALESCE(MAX(Old_Inquiry_Id), 0) mx FROM ${MAP}`);
        watermark = Number(w.mx);
        const from = options.full ? 0 : Math.max(0, watermark - OVERLAP);
        const [rows] = await conn.query(`SELECT Old_Inquiry_Id id FROM ${MAP} WHERE Old_Inquiry_Id > ?`, [from]);
        for (const r of rows as any[]) handled.add(Number(r.id));
      }
      const fromId = options.full ? 0 : Math.max(0, watermark - OVERLAP);

      const inqCols = await sharedColumns(oldPool, conn, OLD_INQ, NEW_INQ, 'Inquiry_Id');
      const discCols = await sharedColumns(oldPool, conn, DISC, DISC, 'id');
      if (!inqCols.length) { s.errors.push('No shared inquiry columns between the old and new software.'); return s; }

      const [oldRows] = await oldPool.query(
        `SELECT Inquiry_Id, ${inqCols.map((c) => `\`${c}\``).join(', ')} FROM ${OLD_INQ}
         WHERE (IsDelete = 0 OR IsDelete IS NULL) AND Inquiry_Id > ?
         ORDER BY Inquiry_Id`,
        [fromId]
      );
      const candidates = (oldRows as any[]).filter((r) => {
        if (handled.has(Number(r.Inquiry_Id))) { s.alreadyHandled++; return false; }
        return true;
      });
      s.scanned = (oldRows as any[]).length;
      if (!candidates.length) { await backfillLegacyDiscussions(conn, oldPool, discCols, s); return s; }

      // Who is already in the new CRM (live rows), by phone / email, plus the
      // rows that share a candidate's ID.
      const [contacts] = await conn.query(
        `SELECT Inquiry_Id, Present_Mobile, Email FROM ${NEW_INQ} WHERE IsDelete = 0 OR IsDelete IS NULL`
      );
      const byPhone = new Map<string, number>();
      const byEmail = new Map<string, number>();
      for (const r of contacts as any[]) {
        const p = phoneKey(r.Present_Mobile); if (p && !byPhone.has(p)) byPhone.set(p, Number(r.Inquiry_Id));
        const e = emailKey(r.Email); if (e && !byEmail.has(e)) byEmail.set(e, Number(r.Inquiry_Id));
      }
      const sameIdRows = new Map<number, any>();
      const ids = candidates.map((r) => Number(r.Inquiry_Id));
      for (let i = 0; i < ids.length; i += 1000) {
        const [rows] = await conn.query(
          `SELECT Inquiry_Id, Student_Name, Present_Mobile, Email FROM ${NEW_INQ} WHERE Inquiry_Id IN (?)`, [ids.slice(i, i + 1000)]
        );
        for (const r of rows as any[]) sameIdRows.set(Number(r.Inquiry_Id), r);
      }

      const decisions: Array<{ oldId: number; newId: number | null; type: string; row?: any }> = [];
      for (const o of candidates) {
        const oldId = Number(o.Inquiry_Id);
        const p = phoneKey(o.Present_Mobile), e = emailKey(o.Email), nm = nameKey(o.Student_Name);
        if (!p && !e && nm.length < 3) { s.emptyRows++; decisions.push({ oldId, newId: null, type: 'empty' }); continue; }
        const same = sameIdRows.get(oldId);
        if (same && ((p && p === phoneKey(same.Present_Mobile)) || (e && e === emailKey(same.Email)) || (nm && nm === nameKey(same.Student_Name)))) {
          s.sameInquiry++; decisions.push({ oldId, newId: oldId, type: 'same_id' }); continue;
        }
        const existing = (p && byPhone.get(p)) || (e && byEmail.get(e)) || null;
        // Negative = another old row being imported in this same run (same person twice).
        if (existing) { s.personAlreadyInCrm++; decisions.push({ oldId, newId: existing > 0 ? existing : null, type: 'contact' }); continue; }
        decisions.push({ oldId, newId: null, type: 'import', row: o });
        // Two old rows for the same new person in one run: import only the first.
        if (p) byPhone.set(p, -oldId);
        if (e) byEmail.set(e, -oldId);
      }

      const toImport = decisions.filter((d) => d.type === 'import');
      if (s.dryRun) {
        s.imported = toImport.length;
        s.importedIds = toImport.slice(0, 50).map((d) => ({ oldId: d.oldId, newId: null }));
        if (discCols.length && toImport.length) {
          const [[dc]] = await oldPool.query(
            `SELECT COUNT(*) n FROM ${DISC} WHERE Inquiry_id IN (?) AND (deleted = 0 OR deleted IS NULL)`,
            [toImport.map((d) => d.oldId)]
          );
          s.discussionsCopied = Number(dc.n);
        }
        await backfillLegacyDiscussions(conn, oldPool, discCols, s);
        return s;
      }

      // Record the non-import decisions in bulk.
      const others = decisions.filter((d) => d.type !== 'import');
      for (let i = 0; i < others.length; i += 1000) {
        const chunk = others.slice(i, i + 1000);
        await conn.query(
          `INSERT IGNORE INTO ${MAP} (Old_Inquiry_Id, New_Inquiry_Id, Match_Type) VALUES ?`,
          [chunk.map((d) => [d.oldId, d.newId, d.type])]
        );
      }

      // Import one at a time: inquiry + its discussions + map row in one transaction.
      const insertSql = `INSERT INTO ${NEW_INQ} (${inqCols.map((c) => `\`${c}\``).join(', ')}) VALUES (${inqCols.map(() => '?').join(', ')})`;
      for (const d of toImport) {
        try {
          await conn.beginTransaction();
          const values = inqCols.map((c) => {
            const k = c.toLowerCase();
            if (k === 'isdelete') return 0;
            // Recent old rows have no Date_Added; the CRM lists and filters by it.
            if (k === 'date_added') return d.row[c] || d.row.Inquiry_Dt || new Date();
            return d.row[c] ?? null;
          });
          const [ins] = await conn.query(insertSql, values);
          const newId = Number(ins.insertId);

          let copied = 0;
          if (discCols.length) {
            const [discs] = await oldPool.query(
              `SELECT id AS __old_id, ${discCols.map((c) => `\`${c}\``).join(', ')} FROM ${DISC}
               WHERE Inquiry_id = ? AND (deleted = 0 OR deleted IS NULL) ORDER BY id`,
              [d.oldId]
            );
            for (const row of discs as any[]) {
              const vals = discCols.map((c) => (c.toLowerCase() === 'inquiry_id' ? newId : row[c] ?? null));
              const [ins2] = await conn.query(
                `INSERT INTO ${DISC} (${discCols.map((c) => `\`${c}\``).join(', ')}) VALUES (${discCols.map(() => '?').join(', ')})`,
                vals
              );
              await conn.query(
                `INSERT IGNORE INTO ${DMAP} (Old_Discussion_Id, New_Inquiry_Id, New_Discussion_Id, Match_Type) VALUES (?, ?, ?, 'imported')`,
                [Number(row.__old_id), newId, Number((ins2 as any).insertId)]
              );
              copied++;
            }
          }
          await conn.query(`INSERT INTO ${MAP} (Old_Inquiry_Id, New_Inquiry_Id, Match_Type) VALUES (?, ?, 'imported')`, [d.oldId, newId]);
          await conn.commit();
          s.imported++;
          s.discussionsCopied += copied;
          if (s.importedIds.length < 50) s.importedIds.push({ oldId: d.oldId, newId });
        } catch (err) {
          await conn.rollback().catch(() => {});
          s.errors.push(`old inquiry ${d.oldId}: ${err instanceof Error ? err.message : String(err)}`);
          if (s.errors.length > 20) { s.errors.push('Stopping after 20 errors.'); break; }
        }
      }
      await backfillLegacyDiscussions(conn, oldPool, discCols, s);
      return s;
    } finally {
      await conn.query('SELECT RELEASE_LOCK(?)', [LOCK]).catch(() => {});
    }
  } catch (err) {
    s.errors.push(err instanceof Error ? err.message : String(err));
    return s;
  } finally {
    conn.release();
  }
}
