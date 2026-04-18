import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { buildAdmissionFormMailContent, sendAdmissionFormEmail } from '@/lib/mailer';
import { getPool } from '@/lib/db';

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function resolveRecipientEmail(inquiryId: number, requestedToEmail: string): Promise<string> {
  const direct = String(requestedToEmail || '').trim();
  if (direct && isValidEmail(direct)) return direct;

  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT Email FROM Student_Inquiry WHERE Inquiry_Id = ? AND (IsDelete = 0 OR IsDelete IS NULL) LIMIT 1`,
    [inquiryId],
  );

  const savedEmail = String((rows as Array<{ Email?: string | null }>)[0]?.Email || '').trim();
  if (savedEmail && isValidEmail(savedEmail)) return savedEmail;

  throw new Error('No valid recipient email found for this inquiry. Please update Email in Edit Inquiry.');
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, ['inquiry.create', 'inquiry.update']);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const inquiryId = Number(body?.inquiryId);
    const requestedToEmail = String(body?.toEmail || '').trim();
    const studentName = String(body?.studentName || '').trim();
    const customSubject = String(body?.subject || '').trim();
    const customText = String(body?.body || '').trim();
    const previewOnly = Boolean(body?.previewOnly);

    if (!Number.isFinite(inquiryId) || inquiryId <= 0) {
      return NextResponse.json({ error: 'Valid inquiryId is required' }, { status: 400 });
    }

    const toEmail = await resolveRecipientEmail(inquiryId, requestedToEmail);

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