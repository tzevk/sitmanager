import mysql from 'mysql2/promise';
import fs from 'node:fs/promises';
import path from 'node:path';

function toCsvValue(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

async function resolveInquiryTableName(pool) {
  const [rows] = await pool.query(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND LOWER(TABLE_NAME) = 'student_inquiry'
     ORDER BY CASE WHEN TABLE_NAME = 'Student_Inquiry' THEN 0 ELSE 1 END
     LIMIT 1`
  );

  return String(rows[0]?.TABLE_NAME || 'Student_Inquiry');
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 1,
});

try {
  const inquiryTable = await resolveInquiryTableName(pool);
  const [rows] = await pool.query(
    `SELECT
       si.Student_Id,
       si.Student_Name,
       si.Present_Mobile,
       si.Email,
       si.Inquiry_Dt,
       si.Inquiry_From,
       si.Inquiry_Type,
       si.Qualification,
       sis.page_source,
       sis.source_table_name,
       sis.source_inquiry_id,
       sis.created_date AS source_created_date
     FROM \`${inquiryTable}\` si
     INNER JOIN suvidya_inquiry_sync sis
       ON sis.inquiry_id = si.Student_Id
     WHERE LOWER(COALESCE(sis.page_source, '')) LIKE '%pune%'
        OR LOWER(COALESCE(si.Inquiry_From, '')) LIKE '%pune%'
        OR LOWER(COALESCE(si.Discussion, '')) LIKE '%pune%'
     ORDER BY sis.source_inquiry_id DESC`
  );

  const records = rows;
  const headers = [
    'Student_Id',
    'Student_Name',
    'Present_Mobile',
    'Email',
    'Inquiry_Dt',
    'Inquiry_From',
    'Inquiry_Type',
    'Qualification',
    'page_source',
    'source_table_name',
    'source_inquiry_id',
    'source_created_date',
  ];

  const csvLines = [
    headers.join(','),
    ...records.map((row) => headers.map((header) => toCsvValue(row[header])).join(',')),
  ];

  const outputPath = path.join(process.cwd(), 'public', 'reports', 'suvidya-pune-inquiries.csv');
  await fs.writeFile(outputPath, `${csvLines.join('\n')}\n`, 'utf8');

  console.log(JSON.stringify({ inquiryTable, count: records.length, outputPath }, null, 2));
} finally {
  await pool.end();
}