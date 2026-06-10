import { readFile } from 'fs/promises';
import path from 'path';
import nodemailer from 'nodemailer';
import MailComposer from 'nodemailer/lib/mail-composer';
import { SESClient, SendEmailCommand, SendRawEmailCommand } from '@aws-sdk/client-ses';

const MAIL_PROVIDER = (process.env.ADMISSION_MAIL_PROVIDER || 'smtp').trim().toLowerCase();

/** Branded email signature appended to every outgoing mail. */
export function buildEmailSignature(): { html: string; text: string } {
  const html = `
    <table style="width:100%;max-width:600px;border-collapse:collapse;margin-top:28px;border-top:2px solid #2E3093;padding-top:0;">
      <tr>
        <td style="padding:16px 0 12px;">
          <p style="margin:0 0 2px;font-size:13px;color:#374151;">Regards,</p>
          <p style="margin:0;font-size:15px;font-weight:700;color:#2E3093;letter-spacing:0.2px;">Suvidya Institute of Technology</p>
        </td>
      </tr>
    </table>`;
  const text = '\n\nRegards,\nSuvidya Institute of Technology';
  return { html, text };
}

/** Wraps body HTML in a consistent email shell with the SIT signature footer. */
export function withEmailSignature(bodyHtml: string): string {
  const sig = buildEmailSignature();
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#374151;font-size:14px;line-height:1.6;max-width:600px;margin:0 auto;padding:24px 20px;">
      ${bodyHtml}
      ${sig.html}
    </div>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// SMTP Configuration
const SMTP_HOST = process.env.ADMISSION_SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.ADMISSION_SMTP_PORT || '587', 10);
const SMTP_SECURE = process.env.ADMISSION_SMTP_SECURE === '1';
const SMTP_USER = process.env.ADMISSION_SMTP_USER;
const SMTP_PASS = process.env.ADMISSION_SMTP_PASS;
const SMTP_FROM = process.env.ADMISSION_SMTP_FROM;
const SMTP_REPLY_TO = process.env.ADMISSION_SMTP_REPLY_TO;

// AWS SES Configuration
const AWS_SES_REGION = process.env.ADMISSION_AWS_SES_REGION || 'us-east-1';
const AWS_SES_ACCESS_KEY = process.env.ADMISSION_AWS_SES_ACCESS_KEY;
const AWS_SES_SECRET_KEY = process.env.ADMISSION_AWS_SES_SECRET_KEY;
const AWS_SES_FROM_EMAIL = process.env.ADMISSION_AWS_SES_FROM_EMAIL;
const AWS_SES_REPLY_TO = process.env.ADMISSION_AWS_SES_REPLY_TO;

interface MailAttachment {
  filename: string;
  content: Buffer;
  cid?: string;
  contentType?: string;
  contentDisposition?: 'inline' | 'attachment';
}

function createSesClient() {
  const hasStaticSesCreds = Boolean(AWS_SES_ACCESS_KEY && AWS_SES_SECRET_KEY);
  return hasStaticSesCreds
    ? new SESClient({
        region: AWS_SES_REGION,
        credentials: {
          accessKeyId: AWS_SES_ACCESS_KEY!,
          secretAccessKey: AWS_SES_SECRET_KEY!,
        },
      })
    : new SESClient({ region: AWS_SES_REGION });
}

async function buildInlineSitLogoAttachment(): Promise<MailAttachment | null> {
  try {
    const logoPath = path.join(process.cwd(), 'public', 'sit.png');
    const content = await readFile(logoPath);
    return {
      filename: 'sit.png',
      content,
      cid: 'sit-logo@suvidya',
      contentType: 'image/png',
      contentDisposition: 'inline',
    };
  } catch {
    return null;
  }
}

function normalizeMailerError(error: unknown, provider: 'ses' | 'smtp', region: string) {
  const message = error instanceof Error ? error.message : String(error || 'Unknown mail error');
  const lower = message.toLowerCase();
  const errorObj = error as {
    code?: string;
    responseCode?: number;
    response?: string;
  } | null;

  const errCode = String(errorObj?.code || '').toUpperCase();
  const responseCode = Number(errorObj?.responseCode || 0);
  const responseText = String(errorObj?.response || '').toLowerCase();

  const isIdentityRejected =
    lower.includes('email address is not verified') ||
    lower.includes('message rejected') ||
    lower.includes('identity failed') ||
    lower.includes('mail from address not verified');

  if (isIdentityRejected) {
    const providerLabel = provider === 'ses' ? 'AWS SES API mode' : 'AWS SES SMTP mode';
    return new Error(
      `Email rejected by ${providerLabel}. Verify sender/recipient identities in SES region ${region}. ` +
      'If your account is in SES Sandbox, recipient addresses must also be verified. ' +
      'Move SES out of Sandbox for sending to unverified recipients.',
    );
  }

  const isSmtpAuthFailure =
    provider === 'smtp' &&
    (
      errCode === 'EAUTH' ||
      responseCode === 535 ||
      lower.includes('authentication credentials invalid') ||
      responseText.includes('authentication credentials invalid')
    );

  if (isSmtpAuthFailure) {
    return new Error(
      `SMTP authentication failed for SES endpoint in region ${region}. ` +
      'Check ADMISSION_SMTP_USER and ADMISSION_SMTP_PASS. ' +
      'For AWS SES SMTP, credentials must be SMTP credentials (not plain IAM access keys) and should match the target SES region.',
    );
  }

  return error instanceof Error ? error : new Error(message);
}

export function buildAdmissionFormMailContent(params: {
  studentName?: string;
  admissionFormUrl: string;
}) {
  const safeName = (params.studentName || '').trim() || 'Student';
  const subject = 'Your SIT Admission Form Link';
  const text = [
    `Dear ${safeName},`,
    '',
    'Thank you for your interest in our training programs at Suvidya Institute of Technology.',
    '',
    'To proceed with the admission process, please complete the admission form using the link below:',
    params.admissionFormUrl,
    'Once submitted, our team will review your application and guide you through the next steps.',
    '',
    'We look forward to being a part of your professional journey.',
  ].join('\n');

  const html = withEmailSignature(`
    <p>Dear <strong>${safeName}</strong>,</p>
    <p>Thank you for your interest in our training programs at Suvidya Institute of Technology.</p>
    <p>To proceed with the admission process, please complete the admission form using the link below:</p>
    <p><a href="${params.admissionFormUrl}" style="color:#2E3093;font-weight:bold;">${params.admissionFormUrl}</a></p>
    <p>Once submitted, our team will review your application and guide you through the next steps.</p>
    <p>We look forward to being a part of your professional journey.</p>
  `);

  return { safeName, subject, text, html };
}

export function buildOnlineAdmissionSubmissionMailContent(params: {
  studentName?: string;
  applicationId: string | number;
}) {
  const safeName = (params.studentName || '').trim() || 'Student';
  const appId = String(params.applicationId || '').trim();
  const subject = 'SIT Online Admission Submission Received';
  const text = [
    `Dear ${safeName},`,
    '',
    'Thank you for submitting your online admission form to Suvidya Institute of Technology.',
    appId ? `Application ID: ${appId}` : '',
    'Our admissions team will review your application and contact you with the next steps.',
    '',
    'If you have any questions, please reply to this email.',
  ]
    .filter(Boolean)
    .join('\n');

  const html = withEmailSignature(`
    <p>Dear <strong>${safeName}</strong>,</p>
    <p>Thank you for submitting your online admission form to Suvidya Institute of Technology.</p>
    ${appId ? `<p><strong>Application ID:</strong> ${appId}</p>` : ''}
    <p>Our admissions team will review your application and contact you with the next steps.</p>
    <p>If you have any questions, please reply to this email.</p>
  `);

  return { safeName, subject, text, html };
}

export function buildPublicInquirySubmissionMailContent(params: {
  studentName?: string;
  inquiryId: string | number;
}) {
  const safeName = (params.studentName || '').trim() || 'Student';
  const inquiryId = String(params.inquiryId || '').trim();
  const subject = 'Thank You for Contacting SIT';
  const text = [
    `Dear ${safeName},`,
    '',
    'Thank you for your enquiry at Suvidya Institute of Technology.',
    inquiryId ? `Inquiry ID: ${inquiryId}` : '',
    'Our team has received your details and will get in touch with you shortly.',
    '',
    'Regards,',
    'Suvidya Institute of Technology',
  ]
    .filter(Boolean)
    .join('\n');

  const html = withEmailSignature(`
    <p>Dear <strong>${safeName}</strong>,</p>
    <p>Thank you for your enquiry at Suvidya Institute of Technology.</p>
    ${inquiryId ? `<p><strong>Inquiry ID:</strong> ${inquiryId}</p>` : ''}
    <p>Our team has received your details and will get in touch with you shortly.</p>
  `);

  return { safeName, subject, text, html };
}

export function buildMetaLeadThankYouMailContent(params: {
  studentName?: string;
  trackingUrl: string;
  websiteUrl?: string;
  logoUrl?: string;
  logoCid?: string;
  courseName?: string | null;
  campaignName?: string | null;
}) {
  const safeName = (params.studentName || '').trim() || 'Student';
  const trackingUrl = params.trackingUrl.trim();
  const logoUrl = (params.logoUrl || '').trim();
  const courseName = (params.courseName || '').trim();
  const campaignName = (params.campaignName || '').trim();
  const subject = 'Thank You for Your Interest in SIT';
  const text = [
    `Dear ${safeName},`,
    '',
    'Thank you for contacting Suvidya Institute of Technology.',
    courseName ? `Your enquiry regarding ${courseName} has been received successfully.` : 'Your enquiry has been received successfully.',
    campaignName ? `Reference: ${campaignName}` : '',
    '',
    'You may review our programs, admissions process, and institute information here:',
    trackingUrl,
    '',
    'If you would like immediate assistance, please contact us:',
    '+91 9821569885',
    'enquiry@suvidya.ac.in',
    '',
    'A member of our team will contact you shortly.',
    '',
    'Regards,',
    'Suvidya Institute of Technology',
  ]
    .filter(Boolean)
    .join('\n');

  const sig = buildEmailSignature();
  const safeTrackingUrl = escapeHtml(trackingUrl);
  const safeCourseName = courseName ? escapeHtml(courseName) : '';
  const safeCampaignName = campaignName ? escapeHtml(campaignName) : '';
  const safeNameHtml = escapeHtml(safeName);
  const safeLogoUrl = logoUrl ? escapeHtml(logoUrl) : '';
  const safeLogoCid = params.logoCid ? escapeHtml(params.logoCid) : '';
  const logoSrc = safeLogoCid ? `cid:${safeLogoCid}` : safeLogoUrl;
  const phoneHref = 'https://suvidya.ac.in/#';
  const emailHref = 'mailto:enquiry@suvidya.ac.in';

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#edf4fb;margin:0;padding:24px 0;color:#1e293b;width:100%;">
      <table role="presentation" style="width:100%;border-collapse:collapse;">
        <tr>
          <td align="center" style="padding:0 16px;">
            <table role="presentation" style="width:100%;max-width:720px;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #dbe7f3;border-radius:24px;overflow:hidden;box-shadow:0 20px 44px rgba(15,23,42,0.08);">
              <tr>
                <td style="background:linear-gradient(135deg,#0d2d5c 0%,#1d5fa8 100%);padding:28px 32px;">
                  <table role="presentation" style="width:100%;border-collapse:collapse;">
                    <tr>
                      <td style="vertical-align:middle;">
                        <div style="display:flex;align-items:center;column-gap:24px;row-gap:16px;flex-wrap:wrap;">
                          ${logoSrc ? `<div style="display:flex;align-items:center;justify-content:flex-start;padding:10px 14px;border-radius:18px;background:rgba(255,255,255,0.98);box-shadow:0 8px 20px rgba(2,6,23,0.12);"><img src="${logoSrc}" alt="SIT Logo" width="220" style="display:block;width:220px;max-width:100%;height:auto;" /></div>` : ''}
                </td>
              </tr>

              <tr>
                <td style="padding:32px 32px 18px;">
                  <p style="margin:0 0 14px;font-size:16px;line-height:1.8;color:#334155;">Dear <strong>${safeNameHtml}</strong>,</p>
                  <p style="margin:0 0 14px;font-size:16px;line-height:1.85;color:#475569;">Thank you for contacting Suvidya Institute of Technology. Your enquiry has been received and noted by our admissions team.</p>
                  <p style="margin:0;font-size:16px;line-height:1.85;color:#475569;">We will review your requirements and connect with you shortly to discuss the most relevant program options and the admission process.</p>
                </td>
              </tr>

              <tr>
                <td style="padding:0 32px 20px;">
                  <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:0 14px;">
                    <tr>
                      <td style="background:#f8fbff;border:1px solid #d6e7f8;border-radius:18px;padding:22px 24px;">
                        <p style="margin:0 0 12px;font-size:13px;letter-spacing:0.16em;text-transform:uppercase;color:#1d5fa8;font-weight:800;">Next Steps</p>
                        <table role="presentation" style="width:100%;border-collapse:collapse;">
                          <tr>
                            <td style="width:28px;vertical-align:top;padding:0 0 12px;">
                              <div style="width:20px;height:20px;border-radius:50%;background:#1d5fa8;color:#ffffff;font-size:12px;font-weight:700;line-height:20px;text-align:center;">1</div>
                            </td>
                            <td style="padding:0 0 12px;font-size:15px;line-height:1.75;color:#475569;">Browse our academic programs, institute information, and admissions details on the official website.</td>
                          </tr>
                          <tr>
                            <td style="width:28px;vertical-align:top;padding:0 0 12px;">
                              <div style="width:20px;height:20px;border-radius:50%;background:#1d5fa8;color:#ffffff;font-size:12px;font-weight:700;line-height:20px;text-align:center;">2</div>
                            </td>
                            <td style="padding:0 0 12px;font-size:15px;line-height:1.75;color:#475569;">Keep your preferred course or specialization details ready for the discussion with our team.</td>
                          </tr>
                          <tr>
                            <td style="width:28px;vertical-align:top;">
                              <div style="width:20px;height:20px;border-radius:50%;background:#1d5fa8;color:#ffffff;font-size:12px;font-weight:700;line-height:20px;text-align:center;">3</div>
                            </td>
                            <td style="font-size:15px;line-height:1.75;color:#475569;">Use the contact details below if you would prefer immediate assistance from the admissions desk.</td>
                          </tr>
                        </table>
                        <div style="margin-top:20px;">
                          <a href="${safeTrackingUrl}" style="display:inline-block;background:linear-gradient(135deg,#0d2d5c 0%,#1d5fa8 100%);color:#ffffff;text-decoration:none;font-size:15px;font-weight:800;padding:14px 28px;border-radius:999px;">Visit Official Website</a>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td style="background:#0f274b;border-radius:18px;padding:22px 24px;color:#ffffff;">
                        <p style="margin:0 0 12px;font-size:13px;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.7);font-weight:800;">Enquiry Summary</p>
                        ${safeCourseName ? `<p style="margin:0 0 10px;font-size:15px;line-height:1.7;color:rgba(255,255,255,0.92);"><strong>Interested Course:</strong> ${safeCourseName}</p>` : ''}
                        ${safeCampaignName ? `<p style="margin:0;font-size:15px;line-height:1.7;color:rgba(255,255,255,0.92);"><strong>Reference:</strong> ${safeCampaignName}</p>` : ''}
                        ${!safeCourseName && !safeCampaignName ? `<p style="margin:0;font-size:15px;line-height:1.7;color:rgba(255,255,255,0.92);">Your enquiry has been recorded successfully and is ready for admissions follow-up.</p>` : ''}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding:0 32px 28px;">
                  <div style="background:#f8fafc;border:1px solid #dbe7f3;border-radius:18px;padding:22px 24px;">
                    <p style="margin:0 0 14px;font-size:13px;letter-spacing:0.16em;text-transform:uppercase;color:#64748b;font-weight:800;">Contact Admissions</p>
                    <p style="margin:0 0 10px;font-size:15px;line-height:1.75;color:#475569;">For immediate support, please use the details below:</p>
                    <p style="margin:0 0 8px;font-size:15px;line-height:1.75;"><a href="${phoneHref}" style="color:#1d5fa8;text-decoration:none;font-weight:700;">+91 9821569885</a></p>
                    <p style="margin:0;font-size:15px;line-height:1.75;"><a href="${emailHref}" style="color:#1d5fa8;text-decoration:none;font-weight:700;">enquiry@suvidya.ac.in</a></p>
                  </div>
                </td>
              </tr>

              <tr>
                <td style="padding:0 32px 32px;">
                  ${sig.html}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
          </div>
        </div>
      </div>
    </div>
  `;

  return { safeName, subject, text, html };
}

function assertMailerConfig() {
  if (MAIL_PROVIDER === 'ses') {
    if (!AWS_SES_FROM_EMAIL) {
      throw new Error(
        'AWS SES configuration is missing. Set ADMISSION_AWS_SES_FROM_EMAIL. ' +
        'Provide ADMISSION_AWS_SES_ACCESS_KEY and ADMISSION_AWS_SES_SECRET_KEY, or configure AWS default credentials for this runtime.'
      );
    }
    return;
  }

  if (!SMTP_USER || !SMTP_PASS) {
    throw new Error(
      'SMTP credentials are missing. Set ADMISSION_SMTP_USER and ADMISSION_SMTP_PASS in environment variables.'
    );
  }
}

export async function sendAdmissionFormEmail(params: {
  toEmail: string;
  studentName?: string;
  admissionFormUrl: string;
  subject?: string;
  text?: string;
  html?: string;
  attachments?: MailAttachment[];
}) {
  assertMailerConfig();

  const built = buildAdmissionFormMailContent({
    studentName: params.studentName,
    admissionFormUrl: params.admissionFormUrl,
  });
  const subject = (params.subject || built.subject).trim() || built.subject;
  const text = (params.text || built.text).trim() || built.text;
  const html =
    params.html ||
    text
      .split('\n')
      .map((line) => `<p>${line || '&nbsp;'}</p>`)
      .join('');
  const attachments = params.attachments || [];

  if (MAIL_PROVIDER === 'ses') {
    const sesClient = createSesClient();

    const replyToAddresses = AWS_SES_REPLY_TO ? [AWS_SES_REPLY_TO] : undefined;

    if (attachments.length > 0) {
      const composer = new MailComposer({
        from: AWS_SES_FROM_EMAIL,
        to: params.toEmail,
        ...(replyToAddresses ? { replyTo: replyToAddresses.join(', ') } : {}),
        subject,
        text,
        html,
        attachments,
      });

      try {
        const rawMessage = await composer.compile().build();
        await sesClient.send(new SendRawEmailCommand({
          Source: AWS_SES_FROM_EMAIL,
          RawMessage: {
            Data: rawMessage,
          },
        }));
      } catch (error: unknown) {
        throw normalizeMailerError(error, 'ses', AWS_SES_REGION);
      }
      return;
    }

    const command = new SendEmailCommand({
      Source: AWS_SES_FROM_EMAIL,
      Destination: {
        ToAddresses: [params.toEmail],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8',
        },
        Body: {
          Text: {
            Data: text,
            Charset: 'UTF-8',
          },
          Html: {
            Data: html,
            Charset: 'UTF-8',
          },
        },
      },
      ReplyToAddresses: replyToAddresses,
    });

    try {
      await sesClient.send(command);
    } catch (error: unknown) {
      throw normalizeMailerError(error, 'ses', AWS_SES_REGION);
    }
    return;
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  const fromEmail = SMTP_FROM || SMTP_USER!;
  try {
    await transporter.sendMail({
      from: fromEmail,
      to: params.toEmail,
      ...(SMTP_REPLY_TO ? { replyTo: SMTP_REPLY_TO } : {}),
      subject,
      text,
      html,
      ...(attachments.length ? { attachments } : {}),
    });
  } catch (error: unknown) {
    throw normalizeMailerError(error, 'smtp', AWS_SES_REGION);
  }
}

export async function sendOnlineAdmissionSubmissionEmail(params: {
  toEmail: string;
  studentName?: string;
  applicationId: string | number;
}) {
  const built = buildOnlineAdmissionSubmissionMailContent({
    studentName: params.studentName,
    applicationId: params.applicationId,
  });

  await sendAdmissionFormEmail({
    toEmail: params.toEmail,
    studentName: params.studentName,
    admissionFormUrl: '#',
    subject: built.subject,
    text: built.text,
    html: built.html,
  });
}

export function buildStudentPortalCredentialsMailContent(params: {
  studentName?: string;
  username: string;
  password: string;
  loginUrl?: string;
}) {
  const safeName = (params.studentName || '').trim() || 'Student';
  const loginUrl = params.loginUrl || 'https://sit.suvidya.ac.in/student-portal';
  const subject = 'Your SIT Student Portal Login Credentials';

  const text = [
    `Dear ${safeName},`,
    '',
    'Your Student Portal account has been created at Suvidya Institute of Technology.',
    '',
    `Username : ${params.username}`,
    `Password : ${params.password}`,
    '',
    `Login here: ${loginUrl}`,
    '',
    'Please keep your credentials safe and do not share them with anyone.',
    'If you face any issues logging in, please contact the administration.',
    '',
    'Regards,',
    'Suvidya Institute of Technology',
  ].join('\n');

  const sig = buildEmailSignature();
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#2E3093,#2A6BB5);padding:24px 28px;">
        <h2 style="color:#fff;margin:0;font-size:18px;">Student Portal Credentials</h2>
        <p style="color:rgba(255,255,255,0.75);margin:4px 0 0;font-size:13px;">Suvidya Institute of Technology</p>
      </div>
      <div style="padding:24px 28px;">
        <p style="color:#374151;margin-top:0;">Dear <strong>${safeName}</strong>,</p>
        <p style="color:#374151;">Your Student Portal account has been created. Use the details below to log in:</p>
        <table style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:16px 20px;width:100%;margin:16px 0;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 12px;color:#6b7280;font-size:13px;width:100px;">Username</td>
            <td style="padding:8px 12px;font-weight:bold;font-size:14px;font-family:monospace;color:#1f2937;letter-spacing:0.5px;">${params.username}</td>
          </tr>
          <tr style="border-top:1px solid #e5e7eb;">
            <td style="padding:8px 12px;color:#6b7280;font-size:13px;">Password</td>
            <td style="padding:8px 12px;font-weight:bold;font-size:14px;font-family:monospace;color:#1f2937;letter-spacing:0.5px;">${params.password}</td>
          </tr>
        </table>
        <p style="text-align:center;margin:20px 0;">
          <a href="${loginUrl}" style="background:#2E3093;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:bold;display:inline-block;">Login to Student Portal</a>
        </p>
        <p style="color:#6b7280;font-size:12px;margin-bottom:0;">Please keep your credentials safe. If you face any issues logging in, contact the administration.</p>
        ${sig.html}
      </div>
    </div>
  `;

  return { safeName, subject, text, html };
}

export async function sendStudentPortalCredentialsEmail(params: {
  toEmail: string;
  studentName?: string;
  username: string;
  password: string;
  loginUrl?: string;
}) {
  const built = buildStudentPortalCredentialsMailContent(params);
  await sendAdmissionFormEmail({
    toEmail: params.toEmail,
    studentName: params.studentName,
    admissionFormUrl: '#',
    subject: built.subject,
    text: built.text,
    html: built.html,
  });
}

export async function sendPublicInquirySubmissionEmail(params: {
  toEmail: string;
  studentName?: string;
  inquiryId: string | number;
}) {
  const built = buildPublicInquirySubmissionMailContent({
    studentName: params.studentName,
    inquiryId: params.inquiryId,
  });

  await sendAdmissionFormEmail({
    toEmail: params.toEmail,
    studentName: params.studentName,
    admissionFormUrl: '#',
    subject: built.subject,
    text: built.text,
    html: built.html,
  });
}

export function buildFeeReceiptMailContent(params: {
  studentName?: string;
  studentId: string | number;
  courseName?: string | null;
  batchCode?: string | null;
  receiptNo: string;
  receiptDate: string;
  particular: string;
  paymentType: string;
  amount: number;
  taxType?: string | null;
}) {
  const safeName = (params.studentName || '').trim() || 'Student';
  const subject = `Fee Receipt ${params.receiptNo} - Suvidya Institute of Technology`;
  const fmtAmount = (n: number) =>
    `₹ ${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const text = [
    `Dear ${safeName},`,
    '',
    'Thank you for your payment. Please find your fee receipt details below:',
    '',
    `Receipt No   : ${params.receiptNo}`,
    `Receipt Date : ${params.receiptDate}`,
    `Student ID   : ${params.studentId}`,
    params.courseName ? `Course       : ${params.courseName}` : '',
    params.batchCode ? `Batch Code   : ${params.batchCode}` : '',
    `Particular   : ${params.particular}`,
    `Payment Type : ${params.paymentType}`,
    params.taxType ? `Tax Type     : ${params.taxType}` : '',
    `Amount       : ${fmtAmount(params.amount)}`,
    '',
    'This is a system-generated receipt for your records.',
  ]
    .filter(Boolean)
    .join('\n');

  const safeNameHtml = escapeHtml(safeName);
  const html = withEmailSignature(`
    <p>Dear <strong>${safeNameHtml}</strong>,</p>
    <p>Thank you for your payment. Please find your fee receipt details below:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:6px 10px;border:1px solid #e5e7eb;color:#6b7280;width:160px;">Receipt No</td><td style="padding:6px 10px;border:1px solid #e5e7eb;font-weight:bold;font-family:monospace;">${escapeHtml(params.receiptNo)}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #e5e7eb;color:#6b7280;">Receipt Date</td><td style="padding:6px 10px;border:1px solid #e5e7eb;">${escapeHtml(params.receiptDate)}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #e5e7eb;color:#6b7280;">Student ID</td><td style="padding:6px 10px;border:1px solid #e5e7eb;">${escapeHtml(String(params.studentId))}</td></tr>
      ${params.courseName ? `<tr><td style="padding:6px 10px;border:1px solid #e5e7eb;color:#6b7280;">Course</td><td style="padding:6px 10px;border:1px solid #e5e7eb;">${escapeHtml(params.courseName)}</td></tr>` : ''}
      ${params.batchCode ? `<tr><td style="padding:6px 10px;border:1px solid #e5e7eb;color:#6b7280;">Batch Code</td><td style="padding:6px 10px;border:1px solid #e5e7eb;">${escapeHtml(params.batchCode)}</td></tr>` : ''}
      <tr><td style="padding:6px 10px;border:1px solid #e5e7eb;color:#6b7280;">Particular</td><td style="padding:6px 10px;border:1px solid #e5e7eb;">${escapeHtml(params.particular)}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #e5e7eb;color:#6b7280;">Payment Type</td><td style="padding:6px 10px;border:1px solid #e5e7eb;">${escapeHtml(params.paymentType)}</td></tr>
      ${params.taxType ? `<tr><td style="padding:6px 10px;border:1px solid #e5e7eb;color:#6b7280;">Tax Type</td><td style="padding:6px 10px;border:1px solid #e5e7eb;">${escapeHtml(params.taxType)}</td></tr>` : ''}
      <tr><td style="padding:6px 10px;border:1px solid #e5e7eb;color:#6b7280;">Amount</td><td style="padding:6px 10px;border:1px solid #e5e7eb;font-weight:bold;">${fmtAmount(params.amount)}</td></tr>
    </table>
    <p>This is a system-generated receipt for your records.</p>
  `);

  return { safeName, subject, text, html };
}

export async function sendFeeReceiptEmail(params: {
  toEmail: string;
  studentName?: string;
  studentId: string | number;
  courseName?: string | null;
  batchCode?: string | null;
  receiptNo: string;
  receiptDate: string;
  particular: string;
  paymentType: string;
  amount: number;
  taxType?: string | null;
}) {
  const built = buildFeeReceiptMailContent(params);
  await sendAdmissionFormEmail({
    toEmail: params.toEmail,
    studentName: params.studentName,
    admissionFormUrl: '#',
    subject: built.subject,
    text: built.text,
    html: built.html,
  });
}

export async function sendMetaLeadThankYouEmail(params: {
  toEmail: string;
  studentName?: string;
  trackingUrl: string;
  websiteUrl?: string;
  logoUrl?: string;
  courseName?: string | null;
  campaignName?: string | null;
}) {
  const logoAttachment = await buildInlineSitLogoAttachment();
  const built = buildMetaLeadThankYouMailContent({
    studentName: params.studentName,
    trackingUrl: params.trackingUrl,
    websiteUrl: params.websiteUrl,
    logoUrl: logoAttachment ? undefined : params.logoUrl,
    logoCid: logoAttachment?.cid,
    courseName: params.courseName,
    campaignName: params.campaignName,
  });

  await sendAdmissionFormEmail({
    toEmail: params.toEmail,
    studentName: params.studentName,
    admissionFormUrl: params.websiteUrl || 'https://suvidya.ac.in/',
    subject: built.subject,
    text: built.text,
    html: built.html,
    attachments: logoAttachment ? [logoAttachment] : undefined,
  });
}