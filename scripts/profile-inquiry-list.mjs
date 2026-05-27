import 'dotenv/config';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 1,
  maxIdle: 0,
  namedPlaceholders: true,
  dateStrings: true,
});

const timed = async (label, fn) => {
  const start = Date.now();
  const result = await fn();
  const elapsed = Date.now() - start;
  console.log(`${label}: ${elapsed}ms`);
  return result;
};

try {
  const [tableRows] = await timed(
    'resolve inquiry table',
    () => pool.query(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = 'student_inquiry' ORDER BY CASE WHEN TABLE_NAME = 'Student_Inquiry' THEN 0 ELSE 1 END LIMIT 1`)
  );
  const inquiryTable = String(tableRows[0]?.TABLE_NAME || 'Student_Inquiry');
  console.log(`table=${inquiryTable}`);

  const whereClause = `WHERE ((si.IsDelete = 0 OR si.IsDelete IS NULL))`;

  await timed('count default list', () =>
    pool.query(`SELECT COUNT(*) as total FROM \`${inquiryTable}\` si ${whereClause}`)
  );

  const [sortedRows] = await timed('sorted ids default list', () =>
    pool.query(
      `SELECT si.Inquiry_Id FROM \`${inquiryTable}\` si ${whereClause} ORDER BY si._inquiry_date DESC, si.Inquiry_Id DESC LIMIT 25 OFFSET 0`
    )
  );
  const pageIds = sortedRows.map((r) => r.Inquiry_Id).filter(Boolean);
  console.log(`pageIds=${pageIds.length}`);

  if (pageIds.length) {
    const ph = pageIds.map(() => '?').join(',');
    await timed('page rows with latest discussion', () =>
      pool.query(
        `SELECT si.Inquiry_Id as Student_Id, si.Student_Id as SourceStudentId,
                si.Student_Name, c.Course_Name as CourseName, si.Inquiry_Dt,
                si.Present_Mobile, si.Email,
                si.Discipline,
                si.Inquiry_From, si.Inquiry_Type,
                si.OnlineState as OnlineStateRaw,
                CAST(NULLIF(si.OnlineState,'') AS UNSIGNED) as Status_id,
                si.Discussion as InlineDiscussion,
                ld.discussion as LatestDiscussion, ld.date as LatestDiscDate,
                ld.nextdate as NextFollowUpDate, ld.created_by as LatestDiscussionById
         FROM \`${inquiryTable}\` si
         LEFT JOIN course_mst c ON si.Course_Id = c.Course_Id
         LEFT JOIN (
           SELECT si_map.Inquiry_Id as InquiryId, MAX(d.id) as max_id
           FROM \`${inquiryTable}\` si_map
           INNER JOIN awt_inquirydiscussion d ON d.deleted = 0 AND (
             d.Inquiry_id = si_map.Inquiry_Id OR d.Inquiry_id = si_map.Student_Id
           )
           WHERE si_map.Inquiry_Id IN (${ph})
           GROUP BY si_map.Inquiry_Id
         ) tld ON tld.InquiryId = si.Inquiry_Id
         LEFT JOIN awt_inquirydiscussion ld ON ld.id = tld.max_id
         WHERE si.Inquiry_Id IN (${ph})`,
        [...pageIds, ...pageIds]
      )
    );
  }

  await timed('filter options', () =>
    Promise.all([
      pool.query(`SELECT DISTINCT Inquiry_Type FROM \`${inquiryTable}\` WHERE Inquiry_Type IS NOT NULL AND Inquiry_Type != '' AND (IsDelete = 0 OR IsDelete IS NULL) ORDER BY Inquiry_Type`),
      pool.query(`SELECT DISTINCT c.Course_Name FROM \`${inquiryTable}\` si LEFT JOIN course_mst c ON si.Course_Id = c.Course_Id WHERE c.Course_Name IS NOT NULL AND c.Course_Name != '' AND (si.IsDelete = 0 OR si.IsDelete IS NULL) ORDER BY c.Course_Name`),
    ])
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
