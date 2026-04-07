import nodemailer from 'nodemailer';
import { SendMailClient } from 'zeptomail';

const MAIL_PROVIDER = (process.env.ADMISSION_MAIL_PROVIDER || 'smtp').trim().toLowerCase();
const SMTP_HOST = process.env.ADMISSION_SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.ADMISSION_SMTP_PORT || '587', 10);
const SMTP_SECURE = process.env.ADMISSION_SMTP_SECURE === '1';
const SMTP_USER = process.env.ADMISSION_SMTP_USER;
const SMTP_PASS = process.env.ADMISSION_SMTP_PASS;
const SMTP_FROM = process.env.ADMISSION_SMTP_FROM;
const SMTP_REPLY_TO = process.env.ADMISSION_SMTP_REPLY_TO;

const ZEPTOMAIL_URL_RAW = process.env.ADMISSION_ZEPTOMAIL_URL || 'https://api.zeptomail.in/v1.1/email';
const ZEPTOMAIL_URL =
  ZEPTOMAIL_URL_RAW.startsWith('http://') || ZEPTOMAIL_URL_RAW.startsWith('https://')
    ? ZEPTOMAIL_URL_RAW
    : `https://${ZEPTOMAIL_URL_RAW}`;
const ZEPTOMAIL_TOKEN = process.env.ADMISSION_ZEPTOMAIL_TOKEN;
const ZEPTOMAIL_FROM_ADDRESS = process.env.ADMISSION_ZEPTOMAIL_FROM_ADDRESS;
const ZEPTOMAIL_FROM_NAME = process.env.ADMISSION_ZEPTOMAIL_FROM_NAME || 'noreply';

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

function assertMailerConfig() {
  if (MAIL_PROVIDER === 'zeptomail') {
    if (!ZEPTOMAIL_TOKEN || !ZEPTOMAIL_FROM_ADDRESS) {
      throw new Error(
        'ZeptoMail configuration is missing. Set ADMISSION_ZEPTOMAIL_TOKEN and ADMISSION_ZEPTOMAIL_FROM_ADDRESS.'
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

  if (MAIL_PROVIDER === 'zeptomail') {
    const client = new SendMailClient({
      url: ZEPTOMAIL_URL,
      token: ZEPTOMAIL_TOKEN!,
    });

    await client.sendMail({
      from: {
        address: ZEPTOMAIL_FROM_ADDRESS!,
        name: ZEPTOMAIL_FROM_NAME,
      },
      to: [
        {
          email_address: {
            address: params.toEmail,
            name: (params.studentName || '').trim() || 'Student',
          },
        },
      ],
      subject,
      htmlbody: html,
    });
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