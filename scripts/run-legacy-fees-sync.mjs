import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
function loadEnv(p) {
  for (const l of readFileSync(p, 'utf8').split('\n')) {
    const t = l.trim(); if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('='); if (i < 0) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[t.slice(0, i).trim()] = v;
  }
}
loadEnv(resolve(__dir, '../.env.local'));

const { syncLegacyFeesData } = await import('../lib/services/legacy-fees-sync.service.ts');
const { destroyAllPools } = await import('../lib/db.ts');

const apply = process.argv.includes('--apply');
const summary = await syncLegacyFeesData({ dryRun: !apply });
console.log(JSON.stringify(summary, null, 2));
await destroyAllPools();
