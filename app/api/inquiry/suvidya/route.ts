import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

interface SuvidyaSyncRow {
  source_table_name: string | null;
  source_inquiry_id: number | null;
  inquiry_id: number | null;
  student_name: string | null;
  email: string | null;
  mobile: string | null;
  course_name: string | null;
  page_source: string | null;
  created_date: string | null;
  payload_json: string | null;
  synced_at: string | null;
}

// Raw payload keys that are already shown as dedicated structured fields, or are
// internal plumbing — hidden from the generic "additional fields" list.
const SKIP_PAYLOAD_KEYS = new Set([
  'id', 'table_name', 'first_name', 'email_id', 'select_course',
  'select_qualification', 'your_location', 'page_source', 'created_date',
]);

function prettyLabel(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * GET /api/inquiry/suvidya?inquiryId=123
 * Returns the Suvidya-website sync record linked to a local inquiry, including
 * every field the website sent (parsed from payload_json). Returns
 * { found: false } when the inquiry did not originate from Suvidya.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'inquiry.view');
    if (auth instanceof NextResponse) return auth;

    const inquiryId = parseInt(new URL(req.url).searchParams.get('inquiryId') || '', 10);
    if (!Number.isInteger(inquiryId) || inquiryId <= 0) {
      return NextResponse.json({ error: 'Invalid inquiryId' }, { status: 400 });
    }

    let rows: SuvidyaSyncRow[] = [];
    try {
      rows = await query<SuvidyaSyncRow>(
        `SELECT source_table_name, source_inquiry_id, inquiry_id, student_name,
                email, mobile, course_name, page_source, created_date, payload_json, synced_at
         FROM suvidya_inquiry_sync
         WHERE inquiry_id = ?
         ORDER BY synced_at DESC
         LIMIT 1`,
        [inquiryId]
      );
    } catch {
      // Table may not exist yet if a Suvidya sync has never run.
      return NextResponse.json({ found: false });
    }

    const row = rows[0];
    if (!row) return NextResponse.json({ found: false });

    // Parse the raw website payload and expose any extra fields.
    let extraFields: { key: string; label: string; value: string }[] = [];
    let rawPayload: Record<string, unknown> = {};
    if (row.payload_json) {
      try {
        const parsed = JSON.parse(row.payload_json);
        if (parsed && typeof parsed === 'object') {
          rawPayload = parsed as Record<string, unknown>;
          extraFields = Object.entries(rawPayload)
            .filter(([key]) => !SKIP_PAYLOAD_KEYS.has(key))
            .map(([key, value]) => ({ key, label: prettyLabel(key), value: String(value ?? '').trim() }))
            .filter((f) => f.value !== '');
        }
      } catch { /* ignore malformed payload */ }
    }

    return NextResponse.json({
      found: true,
      data: {
        sourceTable: row.source_table_name,
        sourceInquiryId: row.source_inquiry_id,
        studentName: row.student_name,
        email: row.email,
        mobile: row.mobile,
        courseName: row.course_name || (rawPayload.select_course ? String(rawPayload.select_course) : null),
        qualification: rawPayload.select_qualification ? String(rawPayload.select_qualification) : null,
        location: rawPayload.your_location ? String(rawPayload.your_location) : null,
        pageSource: row.page_source,
        createdDate: row.created_date,
        syncedAt: row.synced_at,
        extraFields,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load Suvidya details', details: message }, { status: 500 });
  }
}
