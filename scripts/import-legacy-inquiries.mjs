// One-off backfill: pull every inquiry that exists in the old software but is
// missing from the new CRM (insert-only — nothing existing is changed).
//   npx tsx scripts/import-legacy-inquiries.mjs --dry-run   # count only, writes nothing
//   npx tsx scripts/import-legacy-inquiries.mjs             # import
// The scheduled /api/cron/legacy-inquiry-import keeps it up to date afterwards.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const l of readFileSync(path.join(root, '.env.local'), 'utf8').split('\n')) {
  const t = l.trim(); if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('='); if (i < 0) continue;
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  process.env[t.slice(0, i).trim()] = v;
}

const { importMissingLegacyInquiries } = await import('../lib/services/legacy-inquiry-import.service.ts');
const { destroyAllPools } = await import('../lib/db.ts');

const dryRun = process.argv.includes('--dry-run');
console.log(`[legacy-inquiry-import] ${dryRun ? 'DRY RUN — nothing will be written' : 'importing'} (full scan)`);
const summary = await importMissingLegacyInquiries({ dryRun, full: true });
console.log(JSON.stringify(summary, null, 2));
await destroyAllPools();
process.exit(summary.errors.length ? 1 : 0);
