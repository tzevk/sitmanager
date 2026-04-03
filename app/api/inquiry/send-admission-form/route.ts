import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { buildAdmissionFormMailContent, sendAdmissionFormEmail } from '@/lib/mailer';

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, ['inquiry.create', 'inquiry.update']);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const inquiryId = Number(body?.inquiryId);
    const toEmail = String(body?.toEmail || '').trim();
    const studentName = String(body?.studentName || '').trim();
    const customSubject = String(body?.subject || '').trim();
    const customText = String(body?.body || '').trim();
    const previewOnly = Boolean(body?.previewOnly);

    if (!Number.isFinite(inquiryId) || inquiryId <= 0) {
      return NextResponse.json({ error: 'Valid inquiryId is required' }, { status: 400 });
    }

    if (!toEmail) {
      return NextResponse.json({ error: 'Recipient email is required' }, { status: 400 });
    }

    if (!isValidEmail(toEmail)) {
      return NextResponse.json({ error: 'Invalid recipient email address' }, { status: 400 });
    }

    const admissionFormUrl = `${req.nextUrl.origin}/admission/${inquiryId}`;
    const preview = buildAdmissionFormMailContent({
      studentName,
      admissionFormUrl,
    });

    if (previewOnly) {
      return NextResponse.json({
        success: true,
        previewOnly: true,
        toEmail,
        admissionFormUrl,
        preview,
      });
    }

    await sendAdmissionFormEmail({
      toEmail,
      studentName,
      admissionFormUrl,
      ...(customSubject ? { subject: customSubject } : {}),
      ...(customText ? { text: customText } : {}),
    });

    return NextResponse.json({
      success: true,
      message: 'Admission form email sent successfully',
      toEmail,
      admissionFormUrl,
      preview,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to send admission form email';
    console.error('Send admission form email error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}