import dotenv from 'dotenv';
import { SendMailClient } from 'zeptomail';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const url = process.env.ZEPTOMAIL_URL || 'https://api.zeptomail.in/v1.1/email';
const token = process.env.ZEPTOMAIL_SEND_MAIL_TOKEN;
const fromAddress = process.env.ZEPTOMAIL_FROM_ADDRESS;
const fromName = process.env.ZEPTOMAIL_FROM_NAME || 'noreply';
const toAddress = process.env.ZEPTOMAIL_TEST_TO;
const toName = process.env.ZEPTOMAIL_TEST_TO_NAME || 'Test Recipient';

const missing = [
  ['ZEPTOMAIL_SEND_MAIL_TOKEN', token],
  ['ZEPTOMAIL_FROM_ADDRESS', fromAddress],
  ['ZEPTOMAIL_TEST_TO', toAddress],
].filter(([, value]) => !value);

if (missing.length) {
  console.error('Missing required env vars:');
  for (const [name] of missing) console.error(`- ${name}`);
  process.exit(1);
}

const client = new SendMailClient({ url, token });

try {
  const resp = await client.sendMail({
    from: {
      address: fromAddress,
      name: fromName,
    },
    to: [
      {
        email_address: {
          address: toAddress,
          name: toName,
        },
      },
    ],
    subject: 'ZeptoMail Test Email',
    htmlbody: '<div><b>Test email sent successfully.</b></div>',
  });

  console.log('ZeptoMail send success');
  console.log(JSON.stringify(resp, null, 2));
} catch (error) {
  console.error('ZeptoMail send failed');
  console.error(error);
  process.exit(1);
}
