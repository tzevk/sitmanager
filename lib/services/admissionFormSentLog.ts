import { getPool } from '@/lib/db';

const TABLE = 'admission_form_sent_log';

/** Records each time an admission form link is dispatched to an inquiry (emailed,
 * or regenerated for manual sharing) — there was previously no way to distinguish
 * "form sent" from "form submitted" (online_admission_payload only captures the latter). */
export async function ensureAdmissionFormSentLogTable(pool: ReturnType<typeof getPool>) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      Id INT AUTO_INCREMENT PRIMARY KEY,
      Inquiry_Id INT NOT NULL,
      Channel VARCHAR(20) NOT NULL DEFAULT 'email',
      Sent_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_afs_inquiry (Inquiry_Id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

export async function logAdmissionFormSent(
  pool: ReturnType<typeof getPool>,
  inquiryId: number,
  channel: 'email' | 'manual' = 'email',
) {
  await ensureAdmissionFormSentLogTable(pool);
  await pool.query(
    `INSERT INTO ${TABLE} (Inquiry_Id, Channel) VALUES (?, ?)`,
    [inquiryId, channel],
  );
}
