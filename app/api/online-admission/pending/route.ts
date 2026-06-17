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

function parseTs(value: string): number {
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : 0;
}

export async function GET(req: NextRequest) {
  try {
    const rateLimited = await apiRateLimiter(req);
    if (rateLimited) return rateLimited;

    const auth = await requirePermission(req, 'online_admission.view');
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const search = normalizeText(searchParams.get('search')).toLowerCase();
    const sinceDaysRaw = Number(searchParams.get('sinceDays') ?? 45);
    const sinceDays = Number.isFinite(sinceDaysRaw) ? Math.min(365, Math.max(1, sinceDaysRaw)) : 45;
    const minTs = Date.now() - sinceDays * 24 * 60 * 60 * 1000;

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
         si.OnlineState,
         si.Student_Id
       FROM ${ONLINE_ADMISSION_PAYLOAD_TABLE} p
       INNER JOIN \`${inquiryTable}\` si
         ON si.Inquiry_Id = p.Inquiry_Id
       WHERE (si.IsDelete = 0 OR si.IsDelete IS NULL)
         AND (si.Student_Id IS NULL)
         AND si.OnlineState IN (23, 24)
         AND p.Payload LIKE '%__draftProgress%'
         AND NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p.Payload, '$.__draftProgress.autosavedAt')), '') IS NOT NULL
         AND STR_TO_DATE(
               REPLACE(
                 SUBSTRING(JSON_UNQUOTE(JSON_EXTRACT(p.Payload, '$.__draftProgress.autosavedAt')), 1, 19),
                 'T',
                 ' '
               ),
               '%Y-%m-%d %H:%i:%s'
             ) >= DATE_SUB(NOW(), INTERVAL ? DAY)
       ORDER BY p.Updated_At DESC
       LIMIT 1000`
    , [sinceDays]) as [any[], any];

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

        const autosavedAt = normalizeText(draftMeta.autosavedAt);
        const currentStep = Number(draftMeta.currentStep ?? 0);

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
          currentStep: Number.isFinite(currentStep) ? currentStep : 0,
          autosavedAt,
          autosavedTs: parseTs(autosavedAt),
          draftUrl: `/admission/${Number(row.Inquiry_Id)}`,
          details,
          onlineState: Number(row.OnlineState ?? 0) || null,
        };
      })
      .filter((item) => item.currentStep > 0 && item.autosavedTs >= minTs)
      .filter((item) => {
        if (!search) return true;
        return (
          item.studentName.toLowerCase().includes(search) ||
          item.email.toLowerCase().includes(search) ||
          item.mobile.toLowerCase().includes(search) ||
          String(item.inquiryId).includes(search)
        );
      })
      .sort((a, b) => b.autosavedTs - a.autosavedTs)
      .map(({ autosavedTs, ...item }) => item);

    return NextResponse.json({ success: true, rows: result });
  } catch (err: unknown) {
    console.error('Online Admission pending drafts GET error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
