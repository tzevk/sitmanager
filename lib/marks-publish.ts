/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * One publish mechanism for every marks sheet (Assignment / Unit Test / Final
 * Exam / Viva-MOC). Students see a sheet's marks in the Student Portal only once
 * staff switch "Publish to students" on for that sheet. Kept in its own table so
 * the legacy marks tables stay untouched.
 *
 * sheet_id per module (the sheet staff fill in):
 *   ASSIGNMENT  assignment_taken.Given_Id
 *   UNIT_TEST   test_taken_master.Take_Id
 *   FINAL_EXAM  final_exam_master.Take_Id
 *   VIVA_MOC    awt_vivamoctaken.id
 */

export const MARKS_MODULES = ['ASSIGNMENT', 'UNIT_TEST', 'FINAL_EXAM', 'VIVA_MOC'] as const;
export type MarksModule = typeof MARKS_MODULES[number];

/** Permission resource that owns each module's marks sheets. */
export const MARKS_MODULE_RESOURCE: Record<MarksModule, string> = {
  ASSIGNMENT: 'assignment',
  UNIT_TEST: 'unit_test',
  FINAL_EXAM: 'final_exam',
  VIVA_MOC: 'viva_moc',
};

export function isMarksModule(v: unknown): v is MarksModule {
  return typeof v === 'string' && (MARKS_MODULES as readonly string[]).includes(v);
}

let tableReady: Promise<void> | null = null;

export function ensureMarksPublishTable(pool: any): Promise<void> {
  if (!tableReady) {
    tableReady = pool.query(
      `CREATE TABLE IF NOT EXISTS marks_publish (
         source_module VARCHAR(20) NOT NULL,
         sheet_id INT NOT NULL,
         published TINYINT(1) NOT NULL DEFAULT 0,
         updated_by VARCHAR(150) NULL,
         updated_at DATETIME NULL,
         PRIMARY KEY (source_module, sheet_id)
       )`
    ).then(() => undefined).catch((err: unknown) => { tableReady = null; throw err; });
  }
  return tableReady!;
}

/** The published sheet ids of one module, out of the given ones. */
export async function getPublishedSheetIds(pool: any, module: MarksModule, sheetIds: number[]): Promise<Set<number>> {
  if (sheetIds.length === 0) return new Set();
  await ensureMarksPublishTable(pool);
  const [rows] = await pool.query(
    `SELECT sheet_id FROM marks_publish WHERE source_module = ? AND sheet_id IN (?) AND published = 1`,
    [module, sheetIds]
  );
  return new Set((rows as any[]).map((r) => Number(r.sheet_id)));
}

export async function setSheetPublished(pool: any, module: MarksModule, sheetId: number, published: boolean, updatedBy: string | null) {
  await ensureMarksPublishTable(pool);
  await pool.query(
    `INSERT INTO marks_publish (source_module, sheet_id, published, updated_by, updated_at)
     VALUES (?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE published = VALUES(published), updated_by = VALUES(updated_by), updated_at = NOW()`,
    [module, sheetId, published ? 1 : 0, updatedBy]
  );
}
