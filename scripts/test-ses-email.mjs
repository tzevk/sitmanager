import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.example' });

const SMTP_HOST = process.env.ADMISSION_SMTP_HOST || 'email-smtp.eu-north-1.amazonaws.com';
const SMTP_PORT = parseInt(process.env.ADMISSION_SMTP_PORT || '587', 10);
const SMTP_SECURE = process.env.ADMISSION_SMTP_SECURE === '1';
const SMTP_USER = process.env.ADMISSION_SMTP_USER;
const SMTP_PASS = process.env.ADMISSION_SMTP_PASS;
const SMTP_FROM = process.env.ADMISSION_SMTP_FROM || 'noreply@sitsuvidya.in';

const TO_EMAIL = process.argv[2] || 'tanviskadam80@gmail.com';

console.log('AWS SES SMTP Test Email');
console.log('=======================');
console.log(`Host: ${SMTP_HOST}`);
console.log(`Port: ${SMTP_PORT}`);
console.log(`From: ${SMTP_FROM}`);
console.log(`To: ${TO_EMAIL}`);
console.log(`User: ${SMTP_USER ? SMTP_USER.substring(0, 5) + '...' : 'NOT SET'}`);
console.log('');

if (!SMTP_USER || !SMTP_PASS) {
  console.error('❌ Error: SMTP credentials not configured');
  console.error('Set ADMISSION_SMTP_USER and ADMISSION_SMTP_PASS in .env.local');
  process.exit(1);
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

const mailOptions = {
  from: SMTP_FROM,
  to: TO_EMAIL,
  subject: 'Test Email from SIT Manager - AWS SES SMTP',
  text: 'This is a test email to verify AWS SES SMTP configuration.\n\nIf you received this, the email service is working correctly!',
  html: `
    <h2>Test Email from SIT Manager</h2>
    <p>This is a test email to verify AWS SES SMTP configuration.</p>
    <p><strong>If you received this, the email service is working correctly!</strong></p>
    <hr>
    <p style="font-size: 12px; color: #666;">
      Sent via AWS SES SMTP (eu-north-1 region)<br>
      Timestamp: ${new Date().toISOString()}
    </p>
  `,
};

console.log('Sending test email...');

try {
  const info = await transporter.sendMail(mailOptions);
  console.log('✅ Email sent successfully!');
  console.log(`Message ID: ${info.messageId}`);
  console.log(`Response: ${info.response}`);
} catch (error) {
  console.error('❌ Error sending email:');
  console.error(error.message);
  if (error.code) console.error(`Code: ${error.code}`);
  if (error.syscall) console.error(`Syscall: ${error.syscall}`);
  process.exit(1);
}
