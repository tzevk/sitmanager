/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { getPool } from '@/lib/db';
import { ensureSuvidyaPuneInquiryView, SUVIDYA_PUNE_VIEW_NAME } from '@/lib/services/suvidya-pune-report.service';

type SourceMatch = 'all' | 'location' | 'page_source';

interface PuneDetailRow {
  Student_Id: number;
  Student_Name: string | null;
  Present_Mobile: string | null;
  Email: string | null;
  Inquiry_Dt: string | null;
  Inquiry_From: string | null;
  Inquiry_Type: string | null;
  Qualification: string | null;
  source_course: string | null;
  source_location: string | null;
  source_page_source: string | null;
  source_table_name: string;
  source_inquiry_id: number;
  source_created_date: string | null;
  source_created_day: string | null;
  has_pune_location: number;
  has_pune_page_source: number;
  has_pune_listing_text: number;
}

function isSourceMatch(value: string): value is SourceMatch {
  return value === 'all' || value === 'location' || value === 'page_source';
}

function groupRows<T extends string>(
  rows: PuneDetailRow[],
  valueGetter: (row: PuneDetailRow) => string | null | undefined,
  keyName: T,
  comparator: (a: Record<T, string> & { inquiry_count: number }, b: Record<T, string> & { inquiry_count: number }) => number,
) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = valueGetter(row)?.trim() || 'Unknown';
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([value, inquiry_count]) => ({ [keyName]: value, inquiry_count }))
    .sort((a, b) => comparator(
      a as Record<T, string> & { inquiry_count: number },
      b as Record<T, string> & { inquiry_count: number },
    ));
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'report_suvidya_pune.view');
    if (auth instanceof NextResponse) return auth;

    const pool = getPool();
    await ensureSuvidyaPuneInquiryView(pool);

    const url = req.nextUrl;
    const sourceMatchRaw = (url.searchParams.get('sourceMatch') || 'all').trim().toLowerCase();
    if (!isSourceMatch(sourceMatchRaw)) {
      return NextResponse.json({ error: 'Invalid sourceMatch filter' }, { status: 400 });
    }

    const dateFrom = (url.searchParams.get('dateFrom') || '').trim();
    const dateTo = (url.searchParams.get('dateTo') || '').trim();

    const conditions: string[] = ['1 = 1'];
    const params: any[] = [];

    if (sourceMatchRaw === 'location') {
      conditions.push('has_pune_location = 1');
    } else if (sourceMatchRaw === 'page_source') {
      conditions.push('has_pune_page_source = 1');
    } else {
      conditions.push('(has_pune_location = 1 OR has_pune_page_source = 1 OR has_pune_listing_text = 1)');
    }

    if (dateFrom) {
      conditions.push('source_created_day >= ?');
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push('source_created_day <= ?');
      params.push(dateTo);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const [detailRows] = await pool.query(
      `SELECT
         Student_Id,
         Student_Name,
         Present_Mobile,
         Email,
         Inquiry_Dt,
         Inquiry_From,
         Inquiry_Type,
         Qualification,
         source_course,
         source_location,
         source_page_source,
         source_table_name,
         source_inquiry_id,
         source_created_date,
         source_created_day,
         has_pune_location,
         has_pune_page_source,
         has_pune_listing_text
       FROM ${SUVIDYA_PUNE_VIEW_NAME}
       ${whereClause}
       ORDER BY source_created_day DESC, source_inquiry_id DESC`,
      params,
    );

    const rows = detailRows as PuneDetailRow[];
    const byCourse = groupRows(
      rows,
      (row) => row.source_course,
      'source_course',
      (a, b) => b.inquiry_count - a.inquiry_count || a.source_course.localeCompare(b.source_course),
    );
    const byDate = groupRows(
      rows,
      (row) => row.source_created_day,
      'source_created_day',
      (a, b) => b.source_created_day.localeCompare(a.source_created_day),
    );
    const byLocation = groupRows(
      rows,
      (row) => row.source_location,
      'source_location',
      (a, b) => b.inquiry_count - a.inquiry_count || a.source_location.localeCompare(b.source_location),
    );

    return NextResponse.json({
      rows,
      total: rows.length,
      byCourse,
      byDate,
      byLocation,
      filters: { sourceMatch: sourceMatchRaw, dateFrom, dateTo },
    });
  } catch (error: any) {
    console.error('Suvidya Pune report API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate Suvidya Pune report', details: error.message },
      { status: 500 },
    );
  }
}