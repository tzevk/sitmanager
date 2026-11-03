import { readFileSync } from 'fs';
for (const l of readFileSync('.env.local','utf8').split('\n')){const t=l.trim(); if(!t||t[0]=='#')continue; const i=t.indexOf('='); if(i<0)continue; process.env[t.slice(0,i).trim()]=t.slice(i+1).trim().replace(/^["']|["']$/g,'');}
(async()=>{
const { computeStudentFeeBalance } = await import('../lib/fee-balance');
const { getPool, destroyAllPools } = await import('../lib/db');
for (const id of [176555,176693,176695,169354]) console.log(id, await computeStudentFeeBalance(getPool() as any, id));
await destroyAllPools();
})();
