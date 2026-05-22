/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireAuth } from '@/lib/api-auth';

const TABLE = 'cbd_content_plan';

const DDL = `
  CREATE TABLE IF NOT EXISTS ${TABLE} (
    id                 INT AUTO_INCREMENT PRIMARY KEY,
    content_type       VARCHAR(200) NOT NULL,
    description        TEXT NULL,
    frequency          VARCHAR(100) NOT NULL DEFAULT '',
    target_per_month   INT NOT NULL DEFAULT 0,
    responsible_person VARCHAR(255) NOT NULL DEFAULT '',
    sort_order         INT NOT NULL DEFAULT 0,
    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sort (sort_order)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

const SEED = [
  { content_type: 'Training Program Reel : Long Term', description: 'Short engaging reel showcasing training program, syllabus, job opportunities, eligibility, job roles', frequency: 'One Time', target_per_month: 0, responsible_person: 'Rutuj', sort_order: 1 },
  { content_type: 'Training Program Video : Long Term', description: 'Detailed video showcasing training program, syllabus, job opportunities, eligibility, job roles', frequency: 'One Time', target_per_month: 0, responsible_person: 'Rutuj', sort_order: 2 },
  { content_type: 'Career Path Awareness Video', description: 'Video guiding students about career opportunities, industry scope, and career growth paths', frequency: 'One Time', target_per_month: 0, responsible_person: 'Mayur', sort_order: 3 },
  { content_type: 'Placement Flyers', description: 'Flyers announcing student placements, company name and success stories', frequency: '6/Month', target_per_month: 6, responsible_person: 'Vaidehi', sort_order: 4 },
  { content_type: 'Testimonial Flyer', description: 'Flyer featuring student testimonials, feedback, and success stories', frequency: '4/Month', target_per_month: 4, responsible_person: 'Vedika', sort_order: 5 },
  { content_type: 'Testimonial / Student Journey Reel', description: "Reel documenting a student's journey, experience, learning, and placement success", frequency: '3/Month', target_per_month: 3, responsible_person: 'Vedika', sort_order: 6 },
  { content_type: 'Educational Reel', description: 'Short educational reel explaining technical concepts, tips, or industry knowledge', frequency: '2/Month', target_per_month: 2, responsible_person: 'Rutuj', sort_order: 7 },
  { content_type: 'LinkedIn / Website Technical Blogs', description: 'Professional technical articles focused on industry trends, engineering concepts, and career guidance', frequency: '2/Month', target_per_month: 2, responsible_person: 'Mayur', sort_order: 8 },
  { content_type: 'Short Technical Concept Lecture Video (YouTube)', description: 'Educational technical lecture video explaining industry concepts and engineering topics', frequency: '1/Month', target_per_month: 1, responsible_person: 'Mayur', sort_order: 9 },
  { content_type: 'Google Maps Photos', description: 'Photos uploaded to Google Business Profile showcasing infrastructure, classrooms, labs, and activities', frequency: '1/Month', target_per_month: 1, responsible_person: 'Vedika', sort_order: 10 },
  { content_type: 'Festival Flyer', description: 'Festival greeting or celebration flyer for branding and audience engagement', frequency: 'As Per Festival', target_per_month: 0, responsible_person: 'Vaidehi', sort_order: 11 },
  { content_type: 'Awareness Seminar Photos', description: 'Photos from awareness seminars including audience interaction, presentations, and activities', frequency: 'After Every Seminar', target_per_month: 0, responsible_person: '', sort_order: 12 },
  { content_type: 'Awareness Seminar Reel', description: 'Short reel covering key moments and highlights from awareness seminars', frequency: 'After Every Seminar', target_per_month: 0, responsible_person: '', sort_order: 13 },
  { content_type: 'Training Program Flyer', description: 'Promotional flyer highlighting course details, duration, syllabus, eligibility, and admission information', frequency: '3 Months Before Start', target_per_month: 0, responsible_person: 'Vaidehi', sort_order: 14 },
  { content_type: 'Convocation Photos', description: 'Professional photos from convocation ceremonies including medal distribution and group photos', frequency: 'After Every Convocation', target_per_month: 0, responsible_person: 'Mayur', sort_order: 15 },
  { content_type: 'Convocation Reel', description: 'Highlight speeches of students and guests', frequency: 'After Every Convocation', target_per_month: 0, responsible_person: 'Mayur', sort_order: 16 },
  { content_type: 'Convocation Video', description: 'Student and Guest Speeches', frequency: 'After Every Convocation', target_per_month: 0, responsible_person: 'Mayur', sort_order: 17 },
  { content_type: 'Event Photos', description: 'Photos from institute events, celebrations, workshops, and activities', frequency: 'After Every Event', target_per_month: 0, responsible_person: 'Mayur', sort_order: 18 },
  { content_type: 'Alumni Event Videos', description: 'Uploading entire video on Alumni Platform', frequency: 'After Every Alumni Event', target_per_month: 0, responsible_person: 'Rutuj', sort_order: 19 },
  { content_type: 'Alumni Event Photos', description: 'Photos from alumni events', frequency: 'After Every Alumni Event', target_per_month: 0, responsible_person: 'Rutuj', sort_order: 20 },
  { content_type: 'Corporate Training Photos', description: 'Photos from corporate training sessions, workshops, and company collaborations', frequency: 'After Every Corporate Training', target_per_month: 0, responsible_person: 'Mayur', sort_order: 21 },
  { content_type: 'Meta Ads', description: 'Post Meta Ads on Facebook and Instagram', frequency: '1 Month Before Batch', target_per_month: 0, responsible_person: 'Vedika', sort_order: 22 },
];

let ensured = false;
async function ensureTable() {
  if (ensured) return;
  const pool = getPool();
  await pool.query(DDL);
  const [rows] = await pool.query<any[]>(`SELECT COUNT(*) AS cnt FROM ${TABLE}`);
  if ((rows[0]?.cnt ?? 0) === 0) {
    for (const row of SEED) {
      await pool.query(
        `INSERT INTO ${TABLE} (content_type, description, frequency, target_per_month, responsible_person, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
        [row.content_type, row.description, row.frequency, row.target_per_month, row.responsible_person, row.sort_order],
      );
    }
  }
  ensured = true;
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    await ensureTable();
    const [rows] = await getPool().query<any[]>(
      `SELECT id, content_type, description, frequency, target_per_month, responsible_person, sort_order FROM ${TABLE} ORDER BY sort_order ASC, id ASC`,
    );
    return NextResponse.json({ rows }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Failed to fetch' }, { status: 500 });
  }
}
