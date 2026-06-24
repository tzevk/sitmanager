import fs from 'fs';
import mysql from 'mysql2/promise';
function loadEnv(f:string){ try{ for(const line of fs.readFileSync(f,'utf8').split('\n')){ const m=line.match(/^([A-Z0-9_]+)=(.*)$/); if(m && !process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,''); } }catch{} }
loadEnv('.env.local'); loadEnv('.env');

const { syncSuvidyaInquiries } = await import('@/lib/services/suvidya-inquiry.service');

const raw = await mysql.createPool({ host:process.env.DB_HOST, port:Number(process.env.DB_PORT)||3306, database:process.env.DB_NAME, user:process.env.DB_USER, password:process.env.DB_PASSWORD, dateStrings:true });

// Pick a valid-format phone that does NOT already exist, to avoid merging onto a real inquiry.
let TEST_PHONE = '';
for (let i=0;i<20;i++){
  const cand = '9' + String(Math.floor(100000000 + Math.random()*899999999));
  const [[r]] = await raw.query<any[]>(`SELECT COUNT(*) c FROM student_inquiry WHERE Present_Mobile=?`,[cand]);
  if (Number(r.c)===0){ TEST_PHONE = cand; break; }
}
const SRC_ID = 990000000 + Math.floor(Math.random()*9000000); // won't collide with real enquiry_form ids
const EMAIL = `crontest.${Date.now()}@example.invalid`;
const now = new Date().toISOString().slice(0,19).replace('T',' ');
console.log('TEST_PHONE:', TEST_PHONE, '| SRC_ID:', SRC_ID, '| EMAIL:', EMAIL);

const record = { table_name:'enquiry_form', id:SRC_ID, first_name:'CRONTEST DELETE ME', email_id:EMAIL, phone:TEST_PHONE, select_qualification:'BE', your_location:'Mumbai', select_course:'MEP Engineering (Mechanical, Electrical and Plumbing)', page_source:'https://suvidya.ac.in/__crontest', created_date: now };
const fakeFetch = (async () => ({ ok:true, status:200, json: async () => ({ status:true, total_records:1, data:[record] }) })) as unknown as typeof fetch;

let inquiryId:number|undefined;
try {
  const summary = await syncSuvidyaInquiries({ fetchImpl: fakeFetch, maxRecords: 5 });
  console.log('SUMMARY:', JSON.stringify(summary));

  const [[link]] = await raw.query<any[]>(`SELECT inquiry_id, mobile FROM suvidya_inquiry_sync WHERE source_table_name='enquiry_form' AND source_inquiry_id=?`,[SRC_ID]);
  inquiryId = link?.inquiry_id;
  console.log('suvidya_inquiry_sync stored mobile:', link?.mobile, '| inquiry_id:', inquiryId);
  if (inquiryId){
    const [[row]] = await raw.query<any[]>(`SELECT Inquiry_Id, Student_Name, Present_Mobile, Email FROM student_inquiry WHERE Inquiry_Id=?`,[inquiryId]);
    console.log('student_inquiry row:', JSON.stringify(row));
    console.log(row?.Present_Mobile === TEST_PHONE ? '✅ PASS: stored number matches exactly' : `❌ MISMATCH: stored "${row?.Present_Mobile}" expected "${TEST_PHONE}"`);
  } else {
    console.log('⚠️ No inquiry created (created='+summary.created+'). May have merged; not asserting.');
  }
} finally {
  // CLEANUP
  if (inquiryId){
    await raw.query(`DELETE FROM awt_inquirydiscussion WHERE Inquiry_id=?`,[inquiryId]);
    await raw.query(`DELETE FROM student_inquiry WHERE Inquiry_Id=?`,[inquiryId]);
  }
  const [del]:any = await raw.query(`DELETE FROM suvidya_inquiry_sync WHERE source_table_name='enquiry_form' AND source_inquiry_id=?`,[SRC_ID]);
  console.log('cleanup done. removed sync rows:', del.affectedRows, '| removed inquiry:', inquiryId ?? 'none');
  await raw.end();
  const { destroyAllPools } = await import('@/lib/db');
  await destroyAllPools().catch(()=>{});
}
