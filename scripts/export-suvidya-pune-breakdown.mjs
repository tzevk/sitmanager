import mysql from 'mysql2/promise';
import fs from 'node:fs/promises';
import path from 'node:path';

function toCsvValue(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

async function writeCsv(filePath, rows, headers) {
  const csvLines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => toCsvValue(row[header])).join(',')),
  ];
  await fs.writeFile(filePath, `${csvLines.join('\n')}\n`, 'utf8');
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
  const outputDir = path.join(process.cwd(), 'public', 'reports');

  const [detailRows] = await pool.query(
    `SELECT
       Student_Id,
       Student_Name,
       Present_Mobile,
       Email,
       Inquiry_Dt,
       Inquiry_From,
       Inquiry_Type,
       Qualification,
       source_course,
       source_location,
       source_created_date,
       source_created_day,
       source_page_source,
       source_table_name,
       source_inquiry_id
     FROM vw_suvidya_pune_inquiries
     ORDER BY source_created_day DESC, source_inquiry_id DESC`
  );

  const groupedQueries = {
    byCourse: `
      SELECT
        COALESCE(NULLIF(TRIM(source_course), ''), 'Unknown') AS source_course,
        COUNT(*) AS inquiry_count
      FROM vw_suvidya_pune_inquiries
      GROUP BY COALESCE(NULLIF(TRIM(source_course), ''), 'Unknown')
      ORDER BY inquiry_count DESC, source_course ASC
    `,
    byDate: `
      SELECT
        COALESCE(CAST(source_created_day AS CHAR), 'Unknown') AS source_created_day,
        COUNT(*) AS inquiry_count
      FROM vw_suvidya_pune_inquiries
      GROUP BY COALESCE(CAST(source_created_day AS CHAR), 'Unknown')
      ORDER BY source_created_day DESC
    `,
    byLocation: `
      SELECT
        COALESCE(NULLIF(TRIM(source_location), ''), 'Unknown') AS source_location,
        COUNT(*) AS inquiry_count
      FROM vw_suvidya_pune_inquiries
      GROUP BY COALESCE(NULLIF(TRIM(source_location), ''), 'Unknown')
      ORDER BY inquiry_count DESC, source_location ASC
    `,
  };

  const [courseRows] = await pool.query(groupedQueries.byCourse);
  const [dateRows] = await pool.query(groupedQueries.byDate);
  const [locationRows] = await pool.query(groupedQueries.byLocation);

  await writeCsv(
    path.join(outputDir, 'suvidya-pune-by-course.csv'),
    courseRows,
    ['source_course', 'inquiry_count']
  );
  await writeCsv(
    path.join(outputDir, 'suvidya-pune-by-date.csv'),
    dateRows,
    ['source_created_day', 'inquiry_count']
  );
  await writeCsv(
    path.join(outputDir, 'suvidya-pune-by-location.csv'),
    locationRows,
    ['source_location', 'inquiry_count']
  );
  await writeCsv(
    path.join(outputDir, 'suvidya-pune-inquiries-detailed.csv'),
    detailRows,
    [
      'Student_Id',
      'Student_Name',
      'Present_Mobile',
      'Email',
      'Inquiry_Dt',
      'Inquiry_From',
      'Inquiry_Type',
      'Qualification',
      'source_course',
      'source_location',
      'source_created_date',
      'source_created_day',
      'source_page_source',
      'source_table_name',
      'source_inquiry_id',
    ]
  );

  console.log(
    JSON.stringify(
      {
        detailCount: detailRows.length,
        outputDir,
        files: [
          'suvidya-pune-inquiries-detailed.csv',
          'suvidya-pune-by-course.csv',
          'suvidya-pune-by-date.csv',
          'suvidya-pune-by-location.csv',
        ],
        byCourse: courseRows,
        byDate: dateRows,
        byLocation: locationRows,
      },
      null,
      2
    )
  );
} finally {
  await pool.end();
}