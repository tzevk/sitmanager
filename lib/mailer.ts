import nodemailer from 'nodemailer';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const MAIL_PROVIDER = (process.env.ADMISSION_MAIL_PROVIDER || 'smtp').trim().toLowerCase();

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

  const html = `
    <p>Dear ${safeName},</p>
    <p>Thank you for your interest in our training programs at Suvidya Institute of Technology.</p>
    <p>To proceed with the admission process, please complete the admission form using the link below:</p>
    <p><a href="${params.admissionFormUrl}">${params.admissionFormUrl}</a></p>
    <p>Once submitted, our team will review your application and guide you through the next steps.</p>
    <p>We look forward to being a part of your professional journey.</p>
  `;

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

  const html = `
    <p>Dear ${safeName},</p>
    <p>Thank you for submitting your online admission form to Suvidya Institute of Technology.</p>
    ${appId ? `<p><strong>Application ID:</strong> ${appId}</p>` : ''}
    <p>Our admissions team will review your application and contact you with the next steps.</p>
    <p>If you have any questions, please reply to this email.</p>
  `;

  return { safeName, subject, text, html };
}

function assertMailerConfig() {
  if (MAIL_PROVIDER === 'ses') {
    if (!AWS_SES_ACCESS_KEY || !AWS_SES_SECRET_KEY || !AWS_SES_FROM_EMAIL) {
      throw new Error(
        'AWS SES configuration is missing. Set ADMISSION_AWS_SES_ACCESS_KEY, ADMISSION_AWS_SES_SECRET_KEY, and ADMISSION_AWS_SES_FROM_EMAIL.'
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

  if (MAIL_PROVIDER === 'ses') {
    const sesClient = new SESClient({
      region: AWS_SES_REGION,
      credentials: {
        accessKeyId: AWS_SES_ACCESS_KEY!,
        secretAccessKey: AWS_SES_SECRET_KEY!,
      },
    });

    const replyToAddresses = AWS_SES_REPLY_TO ? [AWS_SES_REPLY_TO] : undefined;

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

    await sesClient.send(command);
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
  await transporter.sendMail({
    from: fromEmail,
    to: params.toEmail,
    ...(SMTP_REPLY_TO ? { replyTo: SMTP_REPLY_TO } : {}),
    subject,
    text,
    html,
  });
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