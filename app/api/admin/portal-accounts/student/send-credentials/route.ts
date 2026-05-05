/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { sendStudentPortalCredentialsEmail } from '@/lib/mailer';

export const runtime = 'nodejs';

type StudentPayload = {
  email: string;
  studentName?: string;
  username: string;
  password: string;
};

/*
 * POST /api/admin/portal-accounts/student/send-credentials
 * Body: { students: StudentPayload[], loginUrl?: string }
 * Sends portal credential emails to each student via SES / SMTP.
 * Returns per-student results so the UI can show exactly what succeeded/failed.
 */
export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'user.create');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json().catch(() => ({} as any));
    const students: StudentPayload[] = Array.isArray(body?.students) ? body.students : [];
    const loginUrl: string | undefined = body?.loginUrl || undefined;

    if (!students.length) {
      return NextResponse.json({ success: false, message: 'No students provided' }, { status: 400 });
    }

    type Result = { email: string; studentName: string; username: string; success: boolean; error?: string };
    const results: Result[] = [];

    for (const s of students) {
      const email = String(s.email || '').trim();
      const username = String(s.username || '').trim();
      const password = String(s.password || '').trim();
      const studentName = String(s.studentName || '').trim();

      if (!email || !username || !password) {
        results.push({ email, studentName, username, success: false, error: 'Missing email, username, or password' });
        continue;
      }

      // Basic email format check
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        results.push({ email, studentName, username, success: false, error: 'Invalid email address' });
        continue;
      }

      try {
        await sendStudentPortalCredentialsEmail({ toEmail: email, studentName, username, password, loginUrl });
        results.push({ email, studentName, username, success: true });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Send failed';
        results.push({ email, studentName, username, success: false, error: message });
      }
    }

    const sent   = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return NextResponse.json({ success: true, sent, failed, results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    console.error('Send credentials error:', err);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
