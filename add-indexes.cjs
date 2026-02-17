const fs = require('fs');
const mysql = require('mysql2/promise');

const envFile = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envFile.split('\n').forEach(l => {
  const idx = l.indexOf('=');
  if (idx > 0) { env[l.slice(0, idx).trim()] = l.slice(idx + 1).trim(); }
});

const indexes = [
  // student_master — most queried table (169k rows)
  'CREATE INDEX idx_sm_isdelete ON student_master(IsDelete)',
  'CREATE INDEX idx_sm_course ON student_master(Course_Id)',
  'CREATE INDEX idx_sm_inquiry_dt ON student_master(Inquiry_Dt)',
  'CREATE INDEX idx_sm_status ON student_master(Status_id)',
  'CREATE INDEX idx_sm_batch ON student_master(Batch_Code(50))',
  'CREATE INDEX idx_sm_discipline ON student_master(Discipline(50))',
  'CREATE INDEX idx_sm_inquiry_type ON student_master(Inquiry_Type(50))',
  'CREATE INDEX idx_sm_name ON student_master(Student_Name(80))',

  // batch_mst — frequently joined
  'CREATE INDEX idx_bm_course ON batch_mst(Course_Id)',
  'CREATE INDEX idx_bm_isdelete ON batch_mst(IsDelete)',
  'CREATE INDEX idx_bm_cancel ON batch_mst(Cancel)',
  'CREATE INDEX idx_bm_sdate ON batch_mst(SDate)',
  'CREATE INDEX idx_bm_edate ON batch_mst(EDate)',
  'CREATE INDEX idx_bm_category ON batch_mst(Category(50))',

  // course_mst
  'CREATE INDEX idx_cm_active ON course_mst(IsActive, IsDelete)',

  // student_inquiry
  'CREATE INDEX idx_si_isdelete ON student_inquiry(IsDelete)',
  'CREATE INDEX idx_si_date ON student_inquiry(Inquiry_Dt)',

  // corporate_inquiry
  'CREATE INDEX idx_ci_isdelete ON corporate_inquiry(IsDelete)',

  // cv_shortlisted
  'CREATE INDEX idx_cv_batch ON cv_shortlisted(Batch_Id)',
  'CREATE INDEX idx_cv_isdelete ON cv_shortlisted(IsDelete)',

  // s_fees_mst
  'CREATE INDEX idx_sf_course ON s_fees_mst(Course_Id)',
  'CREATE INDEX idx_sf_isdelete ON s_fees_mst(IsDelete)',
  'CREATE INDEX idx_sf_date ON s_fees_mst(Date_Added)',

  // awt tables
  'CREATE INDEX idx_awt_annual_del ON awt_annual(deleted)',
  'CREATE INDEX idx_awt_notice_del ON awt_noticeboard(deleted)',

  // company_requirements_apk
  'CREATE INDEX idx_cr_active ON company_requirements_apk(IsActive, IsDelete)',

  // faculty_master
  'CREATE INDEX idx_fm_isdelete ON faculty_master(IsDelete)',

  // awt_inquirydiscussion
  'CREATE INDEX idx_aid_inquiry ON awt_inquirydiscussion(Inquiry_id, deleted)',
];

(async () => {
  const c = await mysql.createConnection({
    host: env.DB_HOST,
    port: parseInt(env.DB_PORT || '3306'),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: 'sit',
  });

  let ok = 0, fail = 0;
  for (const sql of indexes) {
    try {
      await c.query(sql);
      ok++;
      console.log('OK:', sql.split(' ON ')[1]);
    } catch (e) {
      fail++;
      console.error('SKIP:', sql.split(' ON ')[1], '-', e.message.slice(0, 80));
    }
  }

  console.log('\nDone:', ok, 'created,', fail, 'skipped');
  await c.end();
})();
