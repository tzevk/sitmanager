import { readFileSync } from 'fs';

function loadEnv(p) {
  for (const l of readFileSync(p, 'utf8').split('\n')) {
    const t = l.trim(); if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('='); if (i < 0) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[t.slice(0, i).trim()] = v;
  }
}

loadEnv('/Users/tanvikadam/Desktop/SIT/sitmanager/.env.local');

const { syncLegacyInquiries } = await import('../lib/services/legacy-inquiry-sync.service.ts');
const { destroyAllPools } = await import('../lib/db.ts');

// Manual legacy inquiry sync. Pull rows created/updated within the given window.
//   --since-hours=N   only sync the last N hours (0 = sync everything). Default 48.
//   --batch-size=N    upsert chunk size (optional).
const sinceArg = process.argv.find((a) => a.startsWith('--since-hours='));
const batchArg = process.argv.find((a) => a.startsWith('--batch-size='));
const sinceHours = sinceArg ? Number(sinceArg.split('=')[1]) : 48;
const batchSize = batchArg ? Number(batchArg.split('=')[1]) : undefined;

console.log(`[legacy-inquiry-sync] running as script — sinceHours=${sinceHours} (0 = all)${batchSize ? `, batchSize=${batchSize}` : ''}`);
const summary = await syncLegacyInquiries({ sinceHours, ...(batchSize ? { batchSize } : {}) });
console.log(JSON.stringify(summary, null, 2));
await destroyAllPools();
