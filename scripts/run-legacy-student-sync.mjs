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

const { syncLegacyStudentData } = await import('../lib/services/legacy-student-sync.service.ts');
const { destroyAllPools } = await import('../lib/db.ts');

const dryRun = process.argv.includes('--apply') ? false : true;
const summary = await syncLegacyStudentData({ dryRun });
console.log(JSON.stringify(summary, null, 2));
await destroyAllPools();
