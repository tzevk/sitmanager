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
  importedIds: Array<{ oldId: number; newId: number | null }>;
  errors: string[];
}

const OLD_INQ = 'Student_Inquiry';
const NEW_INQ = 'student_inquiry';
const DISC = 'awt_inquirydiscussion';
const MAP = 'legacy_inquiry_import_map';
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
    imported: 0, discussionsCopied: 0, importedIds: [], errors: [],
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
      if (!s.dryRun) await ensureMapTable(conn);
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
      if (!candidates.length) return s;

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
              `SELECT ${discCols.map((c) => `\`${c}\``).join(', ')} FROM ${DISC}
               WHERE Inquiry_id = ? AND (deleted = 0 OR deleted IS NULL) ORDER BY id`,
              [d.oldId]
            );
            for (const row of discs as any[]) {
              const vals = discCols.map((c) => (c.toLowerCase() === 'inquiry_id' ? newId : row[c] ?? null));
              await conn.query(
                `INSERT INTO ${DISC} (${discCols.map((c) => `\`${c}\``).join(', ')}) VALUES (${discCols.map(() => '?').join(', ')})`,
                vals
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
