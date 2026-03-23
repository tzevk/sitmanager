import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const shouldResetInquiryData = process.env.RESET_INQUIRY_DATA === 'YES';

const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

if (shouldResetInquiryData) {
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  await conn.query('TRUNCATE TABLE awt_inquirydiscussion');
  await conn.query('TRUNCATE TABLE Student_Inquiry');
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');
}

const leads = [
  {
    name: 'SK SAMIMUDDIN',
    course: 'Civil/Structural Design & Drafting',
    date: '2026-03-23',
    mobile: '8972611892',
    email: 'sktamimuddin1999@gmail.com',
    discipline: null,
  },
  {
    name: 'PRAKASH PATIL',
    course: 'Electrical System Design',
    date: '2026-03-23',
    mobile: '8108303536',
    email: 'prakashpatil_@yahoo.com',
    discipline: 'Mechanical',
  },
  {
    name: 'kanhaiyalal',
    course: 'Piping Engineering',
    date: '2026-03-23',
    mobile: '9820828021',
    email: 'k.jaiswal@tecnimont.in',
    discipline: null,
  },
  {
    name: 'Sanjay Dhumal',
    course: 'MEP Engineering (Mechanical, Electrical & Plumbing)',
    date: '2026-03-22',
    mobile: '9321044304',
    email: 'sanjaygeetanjali@gmail.com',
    discipline: null,
  },
];

const [courses] = await conn.query('SELECT Course_Id, Course_Name FROM Course_Mst');
const byName = new Map(courses.map((r) => [String(r.Course_Name).toLowerCase().trim(), String(r.Course_Id)]));

let inserted = 0;
let skipped = 0;
const details = [];

for (const lead of leads) {
  const courseId = byName.get(lead.course.toLowerCase().trim());
  if (!courseId) {
    skipped += 1;
    details.push({ email: lead.email, status: 'course-not-found', course: lead.course });
    continue;
  }

  const [dups] = await conn.query(
    'SELECT Inquiry_Id FROM Student_Inquiry WHERE Email = ? AND Course_Id = ? AND COALESCE(IsDelete,0) = 0 LIMIT 1',
    [lead.email, courseId],
  );

  if (dups.length > 0) {
    skipped += 1;
    details.push({ email: lead.email, status: 'exists', inquiryId: dups[0].Inquiry_Id });
    continue;
  }

  const [result] = await conn.query(
    `INSERT INTO Student_Inquiry
      (Course_Id, Student_Name, Qualification, Discipline, Present_Mobile, Email, Inquiry_Dt, StateChangeDt, Inquiry_From, Inquiry_Type, IsDelete, IsUnread, OnlineState)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [courseId, lead.name, null, lead.discipline, lead.mobile, lead.email, lead.date, lead.date, 'Website', 'Website', 0, 1, '1'],
  );

  inserted += 1;
  details.push({ email: lead.email, status: 'inserted', inquiryId: result.insertId });
}

console.log(JSON.stringify({
  resetApplied: shouldResetInquiryData,
  inserted,
  skipped,
  details,
}, null, 2));
await conn.end();
