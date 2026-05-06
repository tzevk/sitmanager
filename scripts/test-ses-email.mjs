import nodemailer from 'nodemailer';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.example' });

const MAIL_PROVIDER = (process.env.ADMISSION_MAIL_PROVIDER || 'smtp').trim().toLowerCase();

// SMTP
const SMTP_HOST   = process.env.ADMISSION_SMTP_HOST || 'email-smtp.us-east-1.amazonaws.com';
const SMTP_PORT   = parseInt(process.env.ADMISSION_SMTP_PORT || '587', 10);
const SMTP_SECURE = process.env.ADMISSION_SMTP_SECURE === '1';
const SMTP_USER   = process.env.ADMISSION_SMTP_USER;
const SMTP_PASS   = process.env.ADMISSION_SMTP_PASS;
const SMTP_FROM   = process.env.ADMISSION_SMTP_FROM || 'noreply@sitsuvidya.in';

// SES API
const SES_REGION     = process.env.ADMISSION_AWS_SES_REGION || 'us-east-1';
const SES_ACCESS_KEY = process.env.ADMISSION_AWS_SES_ACCESS_KEY;
const SES_SECRET_KEY = process.env.ADMISSION_AWS_SES_SECRET_KEY;
const SES_FROM       = process.env.ADMISSION_AWS_SES_FROM_EMAIL;


const TO_EMAIL = process.argv[2] || 'tanviskadam80@gmail.com';

console.log('SIT Mailer — Signature Test Email');
console.log('==================================');
console.log(`Provider : ${MAIL_PROVIDER}`);
console.log(`From     : ${MAIL_PROVIDER === 'ses' ? SES_FROM : SMTP_FROM}`);
console.log(`To       : ${TO_EMAIL}`);
console.log(`Region   : ${SES_REGION}`);
console.log('');

const subject = 'Test Email from SIT Manager — Branded Signature Preview';
const text = [
  'Dear Team,',
  '',
  'This is a test email to preview the branded SIT email signature.',
  '',
  'If you received this, the email service is working correctly!',
  '',
  'Regards,',
  'Suvidya Institute of Technology',
].join('\n');
const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#374151;font-size:14px;line-height:1.6;max-width:600px;margin:0 auto;padding:24px 20px;">
    <p>Dear Team,</p>
    <p>This is a test email to preview the <strong>branded SIT email signature</strong>.</p>
    <p><strong>If you received this, the email service is working correctly!</strong></p>
    <p style="font-size:12px;color:#9ca3af;">
      Provider: ${MAIL_PROVIDER.toUpperCase()} &mdash; Region: ${SES_REGION} &mdash; ${new Date().toISOString()}
    </p>
    <table style="width:100%;max-width:600px;border-collapse:collapse;margin-top:28px;border-top:2px solid #2E3093;">
      <tr>
        <td style="padding:16px 0 12px;">
          <p style="margin:0 0 2px;font-size:13px;color:#374151;">Regards,</p>
          <p style="margin:0;font-size:15px;font-weight:700;color:#2E3093;">Suvidya Institute of Technology</p>
        </td>
      </tr>
    </table>
  </div>
`;

console.log('Sending test email...');

try {
  if (MAIL_PROVIDER === 'ses') {
    if (!SES_FROM) {
      console.error('❌ ADMISSION_AWS_SES_FROM_EMAIL is not set in .env.local');
      process.exit(1);
    }
    const hasStaticCreds = Boolean(SES_ACCESS_KEY && SES_SECRET_KEY);
    const sesClient = hasStaticCreds
      ? new SESClient({ region: SES_REGION, credentials: { accessKeyId: SES_ACCESS_KEY, secretAccessKey: SES_SECRET_KEY } })
      : new SESClient({ region: SES_REGION });

    const command = new SendEmailCommand({
      Source: SES_FROM,
      Destination: { ToAddresses: [TO_EMAIL] },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Text: { Data: text, Charset: 'UTF-8' },
          Html:  { Data: html,  Charset: 'UTF-8' },
        },
      },
    });
    const result = await sesClient.send(command);
    console.log('✅ Email sent via SES API!');
    console.log(`Message ID: ${result.MessageId}`);
  } else {
    if (!SMTP_USER || !SMTP_PASS) {
      console.error('❌ ADMISSION_SMTP_USER / ADMISSION_SMTP_PASS not set in .env.local');
      process.exit(1);
    }
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_SECURE,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    const info = await transporter.sendMail({ from: SMTP_FROM, to: TO_EMAIL, subject, text, html });
    console.log('✅ Email sent via SMTP!');
    console.log(`Message ID: ${info.messageId}`);
    console.log(`Response  : ${info.response}`);
  }
} catch (error) {
  console.error('❌ Error sending email:');
  console.error(error.message);
  if (error.code) console.error(`Code: ${error.code}`);
  process.exit(1);
}

