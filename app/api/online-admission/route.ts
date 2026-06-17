import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { apiRateLimiter } from '@/lib/rate-limit';
import { listOnlineAdmissions, submitOnlineAdmission } from '@/lib/services/online-admission.service';
import type { AdmissionUploadBundle } from '@/lib/student-documents.server';

const STATIC_DOCUMENT_FIELDS = [
  ['ssc_marksheetFile', 'ssc_marksheet'],
  ['hsc_marksheetFile', 'hsc_marksheet'],
  ['diploma_marksheetFile', 'diploma_marksheet'],
  ['grad_marksheetFile', 'graduation_marksheet'],
  ['postgrad_marksheetFile', 'postgraduation_marksheet'],
] as const;

function getUploadedFile(formData: FormData, key: string): File | null {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : null;
}

function buildUploads(formData: FormData, body: Record<string, any>): AdmissionUploadBundle {
  const documents: AdmissionUploadBundle['documents'] = [];

  for (const [field, key] of STATIC_DOCUMENT_FIELDS) {
    const file = getUploadedFile(formData, field);
    if (file) documents.push({ key, file });
  }

  const levels = ['ssc', 'hsc', 'diploma', 'grad', 'postgrad'] as const;
  for (const level of levels) {
    const details = Array.isArray(body[`${level}_ktDetails`]) ? body[`${level}_ktDetails`] : [];
    details.forEach((_: unknown, index: number) => {
      const file = getUploadedFile(formData, `${level}_ktDetails.${index}.marksheetFile`);
      if (file) documents.push({ key: `${level}_kt_${index + 1}_marksheet`, file });
    });
  }

  return {
    photoFile: getUploadedFile(formData, 'photoFile'),
    documents,
  };
}

export async function GET(req: NextRequest) {
  try {
    const rateLimited = await apiRateLimiter(req);
    if (rateLimited) return rateLimited;

    const auth = await requirePermission(req, 'online_admission.view');
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);

    const rawTab = searchParams.get('tab') || '';
    const validTabs = ['in_progress', 'pending', 'completed', 'rejected'] as const;
    const result = await listOnlineAdmissions({
      page: Math.max(1, Number(searchParams.get('page')) || 1),
      limit: Math.min(100, Math.max(10, Number(searchParams.get('limit')) || 25)),
      search: searchParams.get('search')?.trim() || '',
      tab: (validTabs as readonly string[]).includes(rawTab) ? rawTab as typeof validTabs[number] : '',
      dateFrom: searchParams.get('dateFrom') || '',
      dateTo: searchParams.get('dateTo') || '',
      submittedOnly: ['1', 'true', 'yes'].includes((searchParams.get('submittedOnly') || '').toLowerCase()),
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('Online Admission GET error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const rateLimited = await apiRateLimiter(req);
    if (rateLimited) return rateLimited;

    const contentType = req.headers.get('content-type') || '';
    let body: Record<string, any>;
    let uploads: AdmissionUploadBundle | undefined;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const payload = String(formData.get('payload') || '{}');
      body = JSON.parse(payload);
      uploads = buildUploads(formData, body);
    } else {
      body = await req.json();
    }

    if (!body.inquiryId) {
      return NextResponse.json({ error: 'Inquiry ID is required' }, { status: 400 });
    }

    const result = await submitOnlineAdmission({ ...body, inquiryId: Number(body.inquiryId) }, uploads);

    return NextResponse.json({
      success: true,
      inquiryId: result.inquiryId,
      studentId: result.studentId,
      message: 'Application submitted successfully',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const status = (err as { status?: number }).status ?? 500;
    if (status === 404 || status === 400) return NextResponse.json({ error: message }, { status });
    console.error('Online Admission POST error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
