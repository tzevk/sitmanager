/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPool } from '@/lib/db';
import { resolveInquiryTableName } from '@/lib/services/inquiry.service';
import {
  ensureInquiryPersonColumns,
  resolvePersonForEnquiry,
  detectReEnquiry,
  recordIdentityConflict,
} from '@/lib/services/person.service';

export interface BackfillSummary {
  scanned: number;
  linkedToNewPerson: number;
  linkedToExistingPerson: number;
  conflicts: number;
  skippedAlreadyLinked: number;
  dryRun: boolean;
}

const BATCH_SIZE = 500;

/**
 * One-off, idempotent backfill: assigns Person_Id to every existing student_inquiry
 * row that doesn't have one yet, using the exact same resolvePersonForEnquiry() logic
 * as live inserts, so historical data and new data are resolved identically.
 *
 * Not run automatically. Intended to be called once with dryRun:true to review the
 * counts, then once for real via the admin-only /api/admin/person-backfill route.
 *
 * Note: dryRun still resolves (and, where needed, creates/fills-in) person_master rows
 * — that data is safe to converge on either way and the real run would need it anyway.
 * Only the actual student_inquiry.Person_Id / Is_Re_Enquiry linkage is skipped in dry-run.
 */
export async function backfillPersonMaster(opts: { dryRun: boolean }): Promise<BackfillSummary> {
  const pool = getPool();
  const inquiryTable = await resolveInquiryTableName(pool);
  await ensureInquiryPersonColumns(pool, inquiryTable);

  const summary: BackfillSummary = {
    scanned: 0,
    linkedToNewPerson: 0,
    linkedToExistingPerson: 0,
    conflicts: 0,
    skippedAlreadyLinked: 0,
    dryRun: opts.dryRun,
  };

  let lastId = 0;
  for (;;) {
    const [rows] = await pool.query(
      `SELECT Inquiry_Id, Student_Name, Present_Mobile, Email, Course_Id
       FROM \`${inquiryTable}\`
       WHERE Inquiry_Id > ? AND Person_Id IS NULL AND (IsDelete = 0 OR IsDelete IS NULL)
       ORDER BY Inquiry_Id ASC
       LIMIT ?`,
      [lastId, BATCH_SIZE]
    );
    const batch = rows as any[];
    if (batch.length === 0) break;

    for (const row of batch) {
      lastId = row.Inquiry_Id;
      summary.scanned += 1;

      const resolved = await resolvePersonForEnquiry({
        name: row.Student_Name,
        mobile: row.Present_Mobile,
        email: row.Email,
      });

      if (resolved.conflict) {
        summary.conflicts += 1;
        if (!opts.dryRun) {
          await recordIdentityConflict({
            inquiryId: row.Inquiry_Id,
            mobilePersonId: resolved.mobilePersonId ?? null,
            emailPersonId: resolved.emailPersonId ?? null,
            mobile: row.Present_Mobile,
            email: row.Email,
          });
        }
        continue;
      }

      if (resolved.isNew) summary.linkedToNewPerson += 1;
      else summary.linkedToExistingPerson += 1;

      if (!opts.dryRun && resolved.personId) {
        const isReEnquiry = await detectReEnquiry(resolved.personId, row.Course_Id, row.Inquiry_Id);
        await pool.query(
          `UPDATE \`${inquiryTable}\` SET Person_Id = ?, Is_Re_Enquiry = ? WHERE Inquiry_Id = ?`,
          [resolved.personId, isReEnquiry ? 1 : 0, row.Inquiry_Id]
        );
      }
    }

    if (batch.length < BATCH_SIZE) break;
  }

  return summary;
}
