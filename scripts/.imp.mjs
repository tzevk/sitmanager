import { readFileSync, writeFileSync } from 'fs'; import mysql from 'mysql2/promise';
const env={}; for (const l of readFileSync('.env.local','utf8').split('\n')){const t=l.trim(); if(!t||t[0]=='#')continue; const i=t.indexOf('='); if(i<0)continue; env[t.slice(0,i).trim()]=t.slice(i+1).trim().replace(/^["']|["']$/g,'');}
const o=await mysql.createConnection({host:env.OLD_DB_HOST,port:+env.OLD_DB_PORT||3306,database:env.OLD_DB_NAME,user:env.OLD_DB_USER,password:env.OLD_DB_PASSWORD,dateStrings:true});
const n=await mysql.createConnection({host:env.DB_HOST,port:+env.DB_PORT||3306,database:env.DB_NAME,user:env.DB_USER,password:env.DB_PASSWORD,dateStrings:true});
const SAME=[1100,1106,1107,1118,1120,1125,1127,1128,1131,1132,1133], CLASH=[1129,1135,1136,1137,1138], MISS=[1141,1142];
const all=[...SAME,...CLASH,...MISS];
const [bh]=await n.query('SELECT * FROM generate_final_result WHERE Id IN (?)',[SAME]); const [bc]=await n.query('SELECT * FROM generate_final_child WHERE Gen_id IN (?) AND (deleted=0 OR deleted IS NULL)',[SAME]);
writeFileSync('/private/tmp/claude-501/-Users-tanvikadam-Desktop-SIT-sitmanager/32738866-c7be-4bcb-9e37-624097d86521/scratchpad/final-result-backup.json', JSON.stringify({headers:bh,children:bc}));
const hcols=(await n.query("SELECT COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='generate_final_result'"))[0].map(r=>r.c);
const ccols=(await n.query("SELECT COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='generate_final_child'"))[0].map(r=>r.c);
const [lh]=await o.query('SELECT * FROM generate_final_result WHERE Id IN (?)',[all]); const lhm=new Map(lh.map(r=>[r.Id,r]));
const [lc]=await o.query("SELECT * FROM generate_final_child WHERE Gen_id IN (?) AND Student_Code<>'' AND (deleted=0 OR deleted IS NULL)",[all]);
const hc=hcols.filter(c=>c!=='Id'&&c in lh[0]); const cc=ccols.filter(c=>c in lc[0]);
await n.beginTransaction();
try{
 const gmap=new Map(); let stats={updatedHeaders:0,softDeleted:0,newHeaders:0,children:0};
 for(const g of SAME){ const h=lhm.get(g); await n.query('UPDATE generate_final_result SET '+hc.map(c=>'`'+c+'`=?').join(',')+' WHERE Id=?',[...hc.map(c=>h[c]),g]); stats.updatedHeaders++; gmap.set(g,g);}
 const [sd]=await n.query('UPDATE generate_final_child SET deleted=1 WHERE Gen_id IN (?) AND (deleted=0 OR deleted IS NULL)',[SAME]); stats.softDeleted=sd.affectedRows;
 for(const g of CLASH){ const h=lhm.get(g); const [r]=await n.query('INSERT INTO generate_final_result ('+hc.map(c=>'`'+c+'`').join(',')+') VALUES (?)',[hc.map(c=>h[c])]); gmap.set(g,r.insertId); stats.newHeaders++;}
 for(const g of MISS){ const h=lhm.get(g); await n.query('INSERT INTO generate_final_result (Id,'+hc.map(c=>'`'+c+'`').join(',')+') VALUES (?)',[[g,...hc.map(c=>h[c])]]); gmap.set(g,g); stats.newHeaders++;}
 const vals=lc.map(r=>cc.map(c=>c==='Gen_id'?gmap.get(r.Gen_id):r[c]));
 const [ci]=await n.query('INSERT INTO generate_final_child ('+cc.map(c=>'`'+c+'`').join(',')+') VALUES ?',[vals]); stats.children=ci.affectedRows;
 await n.commit(); console.log(stats, Object.fromEntries(gmap));
}catch(e){ await n.rollback(); console.error('ROLLED BACK',e.message); }
const [v]=await n.query("SELECT r.Id,b.Batch_code,r.Result_date,COUNT(c.id) k,GROUP_CONCAT(DISTINCT c.Grade) g FROM generate_final_result r JOIN batch_mst b USING(Batch_Id) LEFT JOIN generate_final_child c ON c.Gen_id=r.Id AND (c.deleted=0 OR c.deleted IS NULL) WHERE r.Id IN (?) OR r.Id>1142 GROUP BY r.Id ORDER BY r.Id",[all]); console.table(v);
await o.end(); await n.end();
