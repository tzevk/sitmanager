/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { apiRateLimiter } from '@/lib/rate-limit';
import { resolveInquiryTableName } from '@/lib/services/inquiry.service';

const ONLINE_ADMISSION_PAYLOAD_TABLE = 'online_admission_payload';

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function buildName(payload: Record<string, unknown>, fallbackName: string): string {
  const first = normalizeText(payload.firstName);
  const middle = normalizeText(payload.middleName);
  const last = normalizeText(payload.lastName);
  const composed = [first, middle, last].filter(Boolean).join(' ').trim();
  if (composed) return composed;

  const payloadName = normalizeText(payload.Student_Name);
  if (payloadName) return payloadName;

  return normalizeText(fallbackName);
}

export async function GET(req: NextRequest) {
  try {
    const rateLimited = await apiRateLimiter(req);
    if (rateLimited) return rateLimited;

    const auth = await requirePermission(req, 'online_admission.view');
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const search = normalizeText(searchParams.get('search')).toLowerCase();

    const pool = getPool();
    const inquiryTable = await resolveInquiryTableName(pool);

    await pool.query(
      `CREATE TABLE IF NOT EXISTS ${ONLINE_ADMISSION_PAYLOAD_TABLE} (
        Inquiry_Id INT NOT NULL PRIMARY KEY,
        Payload LONGTEXT NULL,
        Created_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        Updated_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    );

    const [rows] = await pool.query(
      `SELECT
         p.Inquiry_Id,
         p.Payload,
         p.Updated_At,
         si.Student_Name,
         si.Email,
         si.Present_Mobile,
         si.OnlineState
       FROM ${ONLINE_ADMISSION_PAYLOAD_TABLE} p
       LEFT JOIN \`${inquiryTable}\` si
         ON si.Inquiry_Id = p.Inquiry_Id
       WHERE (si.IsDelete = 0 OR si.IsDelete IS NULL OR si.Inquiry_Id IS NULL)
         AND (si.OnlineState IS NULL OR si.OnlineState NOT IN (7, 8))
       ORDER BY p.Updated_At DESC
       LIMIT 1000`
    ) as [any[], any];

    const result = (rows as any[])
      .map((row) => {
        let payload: Record<string, unknown> = {};
        try {
          payload = row.Payload ? JSON.parse(String(row.Payload)) : {};
        } catch {
          payload = {};
        }

        const studentName = buildName(payload, normalizeText(row.Student_Name));
        const email = normalizeText(payload.email) || normalizeText(row.Email);
        const mobile = normalizeText(payload.mobile) || normalizeText(row.Present_Mobile);

        const draftMeta = (payload.__draftProgress && typeof payload.__draftProgress === 'object')
          ? payload.__draftProgress as Record<string, unknown>
          : {};

        const autosavedAt = normalizeText(draftMeta.autosavedAt) || (row.Updated_At ? new Date(row.Updated_At).toISOString() : '');
        const currentStep = Number(draftMeta.currentStep || 1);

        // Full submitted form details (everything the student filled), minus internal/file keys.
        const details: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(payload)) {
          if (k === '__draftProgress' || k === 'payAtOfficeAudit') continue;
          if (/file$/i.test(k)) continue;
          if (v === null || v === undefined || v === '') continue;
          details[k] = v;
        }

        return {
          inquiryId: Number(row.Inquiry_Id),
          studentName,
          email,
          mobile,
          currentStep: Number.isFinite(currentStep) ? currentStep : 1,
          autosavedAt,
          draftUrl: `/admission/${Number(row.Inquiry_Id)}`,
          details,
        };
      })
      .filter((item) => item.studentName)
      .filter((item) => item.currentStep > 1)
      .filter((item) => {
        if (!search) return true;
        return (
          item.studentName.toLowerCase().includes(search) ||
          item.email.toLowerCase().includes(search) ||
          item.mobile.toLowerCase().includes(search) ||
          String(item.inquiryId).includes(search)
        );
      });

    return NextResponse.json({ success: true, rows: result });
  } catch (err: unknown) {
    console.error('Online Admission pending drafts GET error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
