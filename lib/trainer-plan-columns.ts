/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Columns the Trainer Portal writes onto Lecture Plan rows
 * (batch_slecture_master) when a trainer starts / ends their day, plus the
 * plan columns it reads (session, covered_subtopics) — added on first use.
 */
let ready: Promise<void> | null = null;

export function ensureTrainerPlanColumns(pool: any): Promise<void> {
  if (!ready) ready = addMissing(pool).catch((err) => { ready = null; throw err; });
  return ready;
}

async function addMissing(pool: any) {
  const [cRows] = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'batch_slecture_master'
       AND COLUMN_NAME IN ('trainer_in_time', 'trainer_out_time', 'first_half_status', 'break_minutes', 'second_half_status',
                           'session', 'covered_subtopics')`
  );
  const existingCols = new Set((cRows as any[]).map((r) => r.COLUMN_NAME));

  if (!existingCols.has('session')) {
    await pool.query(`ALTER TABLE batch_slecture_master ADD COLUMN session VARCHAR(20) NULL`);
  }
  if (!existingCols.has('covered_subtopics')) {
    await pool.query(`ALTER TABLE batch_slecture_master ADD COLUMN covered_subtopics TEXT NULL`);
  }
  if (!existingCols.has('trainer_in_time')) {
    await pool.query(
      `ALTER TABLE batch_slecture_master ADD COLUMN trainer_in_time VARCHAR(20) NULL`
    );
  }
  if (!existingCols.has('trainer_out_time')) {
    await pool.query(
      `ALTER TABLE batch_slecture_master ADD COLUMN trainer_out_time VARCHAR(20) NULL`
    );
  }
  if (!existingCols.has('first_half_status')) {
    await pool.query(
      `ALTER TABLE batch_slecture_master ADD COLUMN first_half_status VARCHAR(30) NULL`
    );
  }
  if (!existingCols.has('break_minutes')) {
    await pool.query(
      `ALTER TABLE batch_slecture_master ADD COLUMN break_minutes INT NULL`
    );
  }
  if (!existingCols.has('second_half_status')) {
    await pool.query(
      `ALTER TABLE batch_slecture_master ADD COLUMN second_half_status VARCHAR(30) NULL`
    );
  }
}
