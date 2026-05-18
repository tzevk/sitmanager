import type { ResultSetHeader } from 'mysql2';
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { getPool } from '@/lib/db';
import { buildAdmissionFormMailContent, sendAdmissionFormEmail } from '@/lib/mailer';
import { isValidEmail, sanitizeStringMax } from '@/lib/validation';

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'inquiry.create');
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const studentName = sanitizeStringMax(body?.studentName ?? body?.Student_Name, 120) || 'Test Inquiry Student';
    const email = sanitizeStringMax(body?.email ?? body?.Email, 254);
    const mobile = sanitizeStringMax(body?.mobile ?? body?.Present_Mobile, 20) || null;
    const sendMail = body?.sendMail !== false;

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Valid email is required from form input' }, { status: 400 });
    }

    const pool = getPool();
    const today = new Date().toISOString().slice(0, 10);

    const insertSql = `
      INSERT INTO Student_Inquiry (
        Student_Name,
        Present_Mobile,
        Email,
        Discussion,
        OnlineState,
        Inquiry_Dt,
        Inquiry_From,
        Inquiry_Type,
        IsDelete,
        Inquiry,
        Date_Added
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'Inquiry', NOW())
    `;

    const [result] = await pool.query<ResultSetHeader>(insertSql, [
      studentName,
      mobile,
      email,
      'Test inquiry created from admission form email test endpoint',
      1,
      today,
      'Online Form',
      'Test Admission Form',
    ]);

    const inquiryId = Number(result.insertId);
    const admissionFormUrl = `${req.nextUrl.origin}/admission/${inquiryId}`;
    const preview = buildAdmissionFormMailContent({
      studentName,
      admissionFormUrl,
    });

    if (sendMail) {
      await sendAdmissionFormEmail({
        toEmail: email,
        studentName,
        admissionFormUrl,
      });
    }

    return NextResponse.json({
      success: true,
      message: sendMail
        ? 'Test inquiry created and admission form email sent'
        : 'Test inquiry created; email not sent (preview mode)',
      inquiryId,
      admissionFormUrl,
      sent: sendMail,
      emailPreview: {
        to: email,
        subject: preview.subject,
        text: preview.text,
        html: preview.html,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to process test admission form request';
    console.error('Test admission form endpoint error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}