import { readFile } from 'fs/promises';
import path from 'path';
import nodemailer from 'nodemailer';
import MailComposer from 'nodemailer/lib/mail-composer/index.js';
import { SESClient, SendEmailCommand, SendRawEmailCommand } from '@aws-sdk/client-ses';
import dotenv from 'dotenv';

dotenv.config({ path: '.env', quiet: true });
dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ path: '.env.example', quiet: true });

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
const BASE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : `http://localhost:${process.env.PORT || 3000}`;


const TO_EMAIL = process.argv[2] || 'tanviskadam80@gmail.com';

console.log('SIT Mailer — Meta Lead Thank You Test Email');
console.log('==================================');
console.log(`Provider : ${MAIL_PROVIDER}`);
console.log(`From     : ${MAIL_PROVIDER === 'ses' ? SES_FROM : SMTP_FROM}`);
console.log(`To       : ${TO_EMAIL}`);
console.log(`Region   : ${SES_REGION}`);
console.log('');

const subject = 'Test Email from SIT Manager — Meta Lead Thank You Preview';
const trackingUrl = `${BASE_URL}/api/public/meta-ads/lead-email-click/test-preview-token`;
const logoCid = 'sit-logo@suvidya';
let logoAttachment = null;
try {
  logoAttachment = {
    filename: 'sit.png',
    content: await readFile(path.join(process.cwd(), 'public', 'sit.png')),
    cid: logoCid,
    contentType: 'image/png',
    contentDisposition: 'inline',
  };
} catch {}
const text = [
  'Dear Student,',
  '',
  'Thank you for contacting Suvidya Institute of Technology.',
  '',
  'Your enquiry has been received successfully.',
  '',
  'You may review our programs and admissions details here:',
  trackingUrl,
  '',
  'If you would like immediate assistance, please contact us:',
  '+91 9821569885',
  'enquiry@suvidya.ac.in',
  '',
  'Regards,',
  'Suvidya Institute of Technology',
].join('\n');
const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#edf4fb;margin:0;padding:24px 0;color:#1e293b;width:100%;">
    <table role="presentation" style="width:100%;border-collapse:collapse;">
      <tr>
        <td align="center" style="padding:0 16px;">
          <table role="presentation" style="width:100%;max-width:720px;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #dbe7f3;border-radius:24px;overflow:hidden;box-shadow:0 20px 44px rgba(15,23,42,0.08);">
            <tr>
              <td style="background:linear-gradient(135deg,#0d2d5c 0%,#1d5fa8 100%);padding:28px 32px;">
                <div style="display:flex;align-items:center;column-gap:24px;row-gap:16px;flex-wrap:wrap;">
                  ${logoAttachment ? `<div style="display:flex;align-items:center;justify-content:flex-start;padding:10px 14px;border-radius:18px;background:rgba(255,255,255,0.98);box-shadow:0 8px 20px rgba(2,6,23,0.12);"><img src="cid:${logoCid}" alt="SIT Logo" width="220" style="display:block;width:220px;max-width:100%;height:auto;" /></div>` : ''}
                  <div>
                    <p style="margin:0;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.74);font-weight:700;">Suvidya Institute of Technology</p>
                    <h1 style="margin:10px 0 0;font-size:32px;line-height:1.15;color:#ffffff;font-weight:800;">Thank you for reaching out</h1>
                  </div>
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:32px 32px 18px;">
                <p style="margin:0 0 14px;font-size:16px;line-height:1.8;color:#334155;">Dear <strong>Student</strong>,</p>
                <p style="margin:0 0 14px;font-size:16px;line-height:1.85;color:#475569;">Thank you for contacting Suvidya Institute of Technology. Your enquiry has been received and noted by our admissions team.</p>
                <p style="margin:0;font-size:16px;line-height:1.85;color:#475569;">We will review your requirements and connect with you shortly to discuss relevant program options and the admission process.</p>
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
                          <td style="width:28px;vertical-align:top;padding:0 0 12px;"><div style="width:20px;height:20px;border-radius:50%;background:#1d5fa8;color:#ffffff;font-size:12px;font-weight:700;line-height:20px;text-align:center;">1</div></td>
                          <td style="padding:0 0 12px;font-size:15px;line-height:1.75;color:#475569;">Browse our academic programs, institute information, and admissions details on the official website.</td>
                        </tr>
                        <tr>
                          <td style="width:28px;vertical-align:top;padding:0 0 12px;"><div style="width:20px;height:20px;border-radius:50%;background:#1d5fa8;color:#ffffff;font-size:12px;font-weight:700;line-height:20px;text-align:center;">2</div></td>
                          <td style="padding:0 0 12px;font-size:15px;line-height:1.75;color:#475569;">Keep your preferred course or specialization details ready for the discussion with our team.</td>
                        </tr>
                        <tr>
                          <td style="width:28px;vertical-align:top;"><div style="width:20px;height:20px;border-radius:50%;background:#1d5fa8;color:#ffffff;font-size:12px;font-weight:700;line-height:20px;text-align:center;">3</div></td>
                          <td style="font-size:15px;line-height:1.75;color:#475569;">Use the contact details below if you would prefer immediate assistance from the admissions desk.</td>
                        </tr>
                      </table>
                      <div style="margin-top:20px;">
                        <a href="${trackingUrl}" style="display:inline-block;background:linear-gradient(135deg,#0d2d5c 0%,#1d5fa8 100%);color:#ffffff;text-decoration:none;font-size:15px;font-weight:800;padding:14px 28px;border-radius:999px;">Visit Official Website</a>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="background:#0f274b;border-radius:18px;padding:22px 24px;color:#ffffff;">
                      <p style="margin:0 0 12px;font-size:13px;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.7);font-weight:800;">Enquiry Summary</p>
                      <p style="margin:0 0 10px;font-size:15px;line-height:1.7;color:rgba(255,255,255,0.92);"><strong>Interested Course:</strong> Data Science / Full Stack / Career Programs</p>
                      <p style="margin:0;font-size:15px;line-height:1.7;color:rgba(255,255,255,0.92);">Your enquiry has been recorded successfully and is ready for admissions follow-up.</p>
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
                  <p style="margin:0 0 8px;font-size:15px;line-height:1.75;"><a href="https://suvidya.ac.in/#" style="color:#1d5fa8;text-decoration:none;font-weight:700;">+91 9821569885</a></p>
                  <p style="margin:0;font-size:15px;line-height:1.75;"><a href="mailto:enquiry@suvidya.ac.in" style="color:#1d5fa8;text-decoration:none;font-weight:700;">enquiry@suvidya.ac.in</a></p>
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:0 32px 32px;">
                <table style="width:100%;max-width:600px;border-collapse:collapse;margin-top:4px;border-top:2px solid #2E3093;">
                  <tr>
                    <td style="padding:16px 0 12px;">
                      <p style="margin:0 0 2px;font-size:13px;color:#374151;">Regards,</p>
                      <p style="margin:0;font-size:15px;font-weight:700;color:#2E3093;">Suvidya Institute of Technology</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
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

    let result;
    if (logoAttachment) {
      const composer = new MailComposer({
        from: SES_FROM,
        to: TO_EMAIL,
        subject,
        text,
        html,
        attachments: [logoAttachment],
      });
      const rawMessage = await composer.compile().build();
      result = await sesClient.send(new SendRawEmailCommand({
        Source: SES_FROM,
        RawMessage: { Data: rawMessage },
      }));
    } else {
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
      result = await sesClient.send(command);
    }
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
    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to: TO_EMAIL,
      subject,
      text,
      html,
      ...(logoAttachment ? { attachments: [logoAttachment] } : {}),
    });
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

