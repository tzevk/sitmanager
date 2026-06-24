import fs from 'fs';
function loadEnv(f:string){ try{ for(const line of fs.readFileSync(f,'utf8').split('\n')){ const m=line.match(/^([A-Z0-9_]+)=(.*)$/); if(m && !process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,''); } }catch{} }
loadEnv('.env.local'); loadEnv('.env');

const { syncSuvidyaInquiries } = await import('@/lib/services/suvidya-inquiry.service');
const { recordSuvidyaSyncRun } = await import('@/lib/services/suvidya-sync-run.service');
const { destroyAllPools } = await import('@/lib/db');

// Mirror the cron route's option computation for the MAIN scope.
const sinceHoursRaw = Number(process.env.SUVIDYA_INQUIRY_SYNC_SINCE_HOURS || '0');
const maxRecordsRaw = Number(process.env.SUVIDYA_INQUIRY_SYNC_MAX_RECORDS || '2000');
const sinceHours = Number.isFinite(sinceHoursRaw) && sinceHoursRaw > 0 ? sinceHoursRaw : undefined;
const maxRecords = Number.isFinite(maxRecordsRaw) && maxRecordsRaw > 0 ? Math.trunc(maxRecordsRaw) : undefined;
console.log('Running main suvidya-inquiry-sync now. sinceHours=', sinceHours, 'maxRecords=', maxRecords);

try {
  const summary = await syncSuvidyaInquiries({ sinceHours, maxRecords, puneOnly: false });
  await recordSuvidyaSyncRun({ scope: 'main', status: 'success', summary });
  console.log('RESULT:', JSON.stringify(summary, null, 2));
} catch (e:any) {
  await recordSuvidyaSyncRun({ scope: 'main', status: 'failed', errorMessage: e?.message });
  console.log('FAILED:', e?.message);
} finally {
  await destroyAllPools().catch(()=>{});
}
