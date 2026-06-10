/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { apiRateLimiter } from '@/lib/rate-limit';
import { resolveInquiryTableName } from '@/lib/services/inquiry.service';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { withEmailSignature } from '@/lib/mailer';

const AWS_SES_REGION = process.env.ADMISSION_AWS_SES_REGION || 'us-east-1';
const AWS_SES_FROM_EMAIL = process.env.ADMISSION_AWS_SES_FROM_EMAIL;
const AWS_SES_REPLY_TO = process.env.ADMISSION_AWS_SES_REPLY_TO;

function createSesClient() {
  const accessKeyId = process.env.ADMISSION_AWS_SES_ACCESS_KEY;
  const secretAccessKey = process.env.ADMISSION_AWS_SES_SECRET_KEY;
  return accessKeyId && secretAccessKey
    ? new SESClient({ region: AWS_SES_REGION, credentials: { accessKeyId, secretAccessKey } })
    : new SESClient({ region: AWS_SES_REGION });
}

export async function GET(req: NextRequest) {
  try {
    const rateLimited = await apiRateLimiter(req);
    if (rateLimited) return rateLimited;
    const auth = await requirePermission(req, 'inquiry.view');
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const source = searchParams.get('source') || 'inquiry';
    const courseId = searchParams.get('courseId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    if (source !== 'inquiry') {
      return NextResponse.json({ success: true, recipients: [], total: 0 });
    }

    const pool = getPool();
    const inquiryTable = await resolveInquiryTableName(pool);

    const conditions = [
      '(si.IsDelete = 0 OR si.IsDelete IS NULL)',
      "si.Email IS NOT NULL AND TRIM(si.Email) != ''",
    ];
    const params: (string | number)[] = [];

    if (courseId) {
      conditions.push('si.Course_Id = ?');
      params.push(courseId);
    }

    const dateParse = `COALESCE(
      STR_TO_DATE(SUBSTRING(si.Inquiry_Dt, 1, 10), '%Y-%m-%d'),
      STR_TO_DATE(SUBSTRING(si.Inquiry_Dt, 1, 10), '%d-%m-%Y'),
      STR_TO_DATE(SUBSTRING(si.Inquiry_Dt, 1, 10), '%d/%m/%Y'),
      STR_TO_DATE(SUBSTRING(si.Inquiry_Dt, 1, 10), '%d.%m.%Y')
    )`;

    if (dateFrom) {
      conditions.push(`${dateParse} >= ?`);
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push(`${dateParse} <= ?`);
      params.push(dateTo);
    }

    const [rows] = await pool.query(
      `SELECT si.Student_Name AS name, si.Email AS email
       FROM \`${inquiryTable}\` si
       WHERE ${conditions.join(' AND ')}
       ORDER BY si.Inquiry_Id DESC
       LIMIT 1000`,
      params,
    ) as [any[], any];

    const seen = new Set<string>();
    const recipients = (rows as any[])
      .filter((r) => {
        const email = (r.email || '').trim().toLowerCase();
        if (!email || seen.has(email)) return false;
        seen.add(email);
        return true;
      })
      .map((r) => ({ name: (r.name || '').trim(), email: (r.email || '').trim() }));

    return NextResponse.json({ success: true, recipients, total: recipients.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const rateLimited = await apiRateLimiter(req);
    if (rateLimited) return rateLimited;
    const auth = await requirePermission(req, 'inquiry.view');
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const { subject, htmlBody, recipients } = body as {
      subject: string;
      htmlBody: string;
      recipients: { name: string; email: string }[];
    };

    if (!subject?.trim() || !htmlBody?.trim()) {
      return NextResponse.json({ success: false, error: 'Subject and body are required.' }, { status: 400 });
    }
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ success: false, error: 'No recipients provided.' }, { status: 400 });
    }
    if (recipients.length > 500) {
      return NextResponse.json({ success: false, error: 'Maximum 500 recipients per send.' }, { status: 400 });
    }
    if (!AWS_SES_FROM_EMAIL) {
      return NextResponse.json({ success: false, error: 'Email service is not configured.' }, { status: 500 });
    }

    const sesClient = createSesClient();
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const recipient of recipients) {
      const safeName = recipient.name || 'Student';
      const personalizedHtml = withEmailSignature(
        htmlBody.replace(/\{name\}/gi, safeName),
      );

      try {
        await sesClient.send(new SendEmailCommand({
          Source: AWS_SES_FROM_EMAIL,
          Destination: { ToAddresses: [recipient.email] },
          ReplyToAddresses: AWS_SES_REPLY_TO ? [AWS_SES_REPLY_TO] : undefined,
          Message: {
            Subject: { Data: subject.trim(), Charset: 'UTF-8' },
            Body: {
              Html: { Data: personalizedHtml, Charset: 'UTF-8' },
            },
          },
        }));
        sent++;
      } catch (err) {
        failed++;
        if (errors.length < 10) {
          errors.push(`${recipient.email}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // ~10 emails/sec to stay within default SES send rate
      await new Promise((r) => setTimeout(r, 100));
    }

    return NextResponse.json({ success: true, sent, failed, errors, total: recipients.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
