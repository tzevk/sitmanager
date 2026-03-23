import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const baseUrl = process.env.CRON_BASE_URL || 'http://localhost:3000';
const url = `${baseUrl}/api/cron/sync-inquiry`;

const headers = {};
if (process.env.CRON_SECRET) {
  headers['x-cron-secret'] = process.env.CRON_SECRET;
}

const res = await fetch(url, { headers });
const text = await res.text();

if (!res.ok) {
  console.error(`Request failed: ${res.status} ${res.statusText}`);
  console.error(text);
  process.exit(1);
}

console.log(text);
