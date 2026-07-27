/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { apiRateLimiter } from '@/lib/rate-limit';
import { getAdmissionInquiryDocumentBlob } from '@/lib/student-documents.server';

// Public, unauthenticated route: serves a single previously-uploaded Online
// Admission document (photo or academic marksheet) for an inquiry that has
// not yet been converted into a student record. Only accessible for the
// specific Inquiry_Id + Doc_Key combination that was actually saved — no
// cross-inquiry access is possible since the lookup is scoped by both.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ inquiryId: string; docKey: string }> }
) {
  try {
    const rateLimited = await apiRateLimiter(req);
    if (rateLimited) return rateLimited;

    const { inquiryId: inquiryIdParam, docKey: docKeyParam } = await params;

    const inquiryId = Number(inquiryIdParam);
    if (!Number.isInteger(inquiryId) || inquiryId <= 0) {
      return NextResponse.json({ error: 'Invalid inquiry id' }, { status: 400 });
    }

    const docKey = String(docKeyParam || '').trim();
    if (!docKey || !/^[a-zA-Z0-9_-]+$/.test(docKey)) {
      return NextResponse.json({ error: 'Invalid document key' }, { status: 400 });
    }

    const doc = await getAdmissionInquiryDocumentBlob(inquiryId, docKey);
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    return new Response(new Uint8Array(doc.data), {
      headers: {
        'Content-Type': doc.contentType || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${doc.filename.replace(/"/g, '')}"`,
        'Content-Length': String(doc.data.length),
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Public online-admission document GET error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
