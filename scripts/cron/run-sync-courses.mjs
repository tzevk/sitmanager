import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const secret = process.env.CRON_SECRET;

const res = await fetch(`${baseUrl}/api/cron/sync-courses`, {
  method: 'GET',
  headers: {
    ...(secret ? { 'x-cron-secret': secret } : {}),
  },
});

const text = await res.text();
if (!res.ok) {
  console.error(`Sync failed (${res.status}):`, text);
  process.exit(1);
}

console.log(text);
