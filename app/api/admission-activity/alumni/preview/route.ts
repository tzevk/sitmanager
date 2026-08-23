import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { parseAlumniCsv, matchAlumniRows } from '@/lib/services/alumni-import.service';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'alumni.view');
    if (auth instanceof NextResponse) return auth;

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = parseAlumniCsv(buffer);
    if (rows.length === 0) {
      return NextResponse.json({ error: 'No data rows found in the file' }, { status: 422 });
    }

    const result = await matchAlumniRows(rows);
    return NextResponse.json({ ...result, fileName: file.name });
  } catch (error: unknown) {
    const status = (error as { status?: number }).status ?? 500;
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Alumni preview error:', error);
    return NextResponse.json({ error: message }, { status });
  }
}
