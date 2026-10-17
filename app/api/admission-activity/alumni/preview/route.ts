import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { parseAlumniCsv, matchAlumniRows, countStaffMembershipRows } from '@/lib/services/alumni-import.service';
import { getLatestAlumniUpload, recordAlumniUpload } from '@/lib/services/alumni-batch-summary.service';

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

    // Remember this report so the batch-wise widget (and this page) can use it
    // without re-uploading. Only for users who can update alumni records, so a
    // view-only test upload doesn't replace what everyone sees.
    let uploadId: number | null = null;
    if (auth.permissions.includes('alumni.update')) {
      uploadId = await recordAlumniUpload({
        fileName: file.name,
        rows,
        matchedStudentIds: result.students.filter((s) => s.hasAccount).map((s) => s.studentId),
        uploadedBy: auth.session.userId,
      });
    }
    return NextResponse.json({ ...result, fileName: file.name, uploadId, staffMembershipSkipped: countStaffMembershipRows(buffer) });
  } catch (error: unknown) {
    const status = (error as { status?: number }).status ?? 500;
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Alumni preview error:', error);
    return NextResponse.json({ error: message }, { status });
  }
}

/** The last uploaded report, re-matched against current students (manual links kept). */
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'alumni.view');
    if (auth instanceof NextResponse) return auth;

    const latest = await getLatestAlumniUpload(true);
    if (!latest || latest.rows.length === 0) return NextResponse.json({ error: 'No report has been uploaded yet' }, { status: 404 });

    const result = await matchAlumniRows(latest.rows);
    const kept = new Set(latest.matchedStudentIds);
    const students = result.students.map((s) =>
      !s.hasAccount && kept.has(s.studentId) ? { ...s, hasAccount: true, matchType: 'manual' as const } : s
    );
    return NextResponse.json({
      ...result,
      students,
      matchedCount: students.filter((s) => s.hasAccount).length,
      noAccountCount: students.filter((s) => !s.hasAccount).length,
      fileName: latest.fileName,
      uploadId: latest.id,
      uploadedAt: latest.uploadedAt,
    });
  } catch (error: unknown) {
    console.error('Alumni latest preview error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
