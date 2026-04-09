import mysql from 'mysql2/promise';

function normalizeDateOnly(value) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const isoDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) return `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`;

  const dmy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;

  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

function extractCandidates(row) {
  const out = [];
  const fallbackDate = normalizeDateOnly(row.NextFollowUpDate)
    || normalizeDateOnly(row.InitialFollowUpDate)
    || normalizeDateOnly(row.Idate)
    || null;

  const push = (entry) => {
    const remarks = String(entry.remarks || '').trim();
    const purpose = String(entry.purpose || '').trim();
    const followupDate = normalizeDateOnly(entry.followupDate);
    if (!remarks && !purpose && !followupDate) return;
    out.push({
      followupDate,
      purpose: purpose || null,
      remarks: remarks || null,
    });
  };

  if (String(row.Discussion || '').trim()) {
    push({
      followupDate: fallbackDate,
      purpose: 'Corporate Inquiry Discussion',
      remarks: row.Discussion,
    });
  }

  const raw = String(row.FollowUp || '').trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const meetings = Array.isArray(parsed?.meetings)
        ? parsed.meetings
        : Array.isArray(parsed?.followUps)
          ? parsed.followUps
          : [];

      for (const m of meetings) {
        if (!m || typeof m !== 'object') continue;
        push({
          followupDate: m.nextDate || m.nextFollowUpDate || m.next_follow_up_date || m.date || fallbackDate,
          purpose: 'Corporate Inquiry Follow-up',
          remarks: m.remark || parsed?.meetingAgenda || null,
        });
      }

      if (meetings.length === 0 && parsed?.meetingAgenda) {
        push({
          followupDate: parsed.meetingDate || parsed.initialDate || fallbackDate,
          purpose: 'Corporate Inquiry Follow-up',
          remarks: parsed.meetingAgenda,
        });
      }
    } catch {
      push({
        followupDate: fallbackDate,
        purpose: 'Corporate Inquiry Follow-up',
        remarks: raw,
      });
    }
  }

  const uniq = new Map();
  for (const item of out) {
    const key = `${item.followupDate || ''}|${String(item.purpose || '').toLowerCase()}|${String(item.remarks || '').toLowerCase()}`;
    if (!uniq.has(key)) uniq.set(key, item);
  }

  return Array.from(uniq.values());
}

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '115.124.106.101',
    user: process.env.DB_USER || 'sitadmin',
    password: process.env.DB_PASSWORD || 'sJ%3g14n9',
    database: process.env.DB_NAME || 'sit',
  });

  await conn.beginTransaction();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS consultant_followup (
        Followup_Id INT AUTO_INCREMENT PRIMARY KEY,
        Const_Id INT NOT NULL,
        Followup_Date DATE,
        Contact_Person VARCHAR(255),
        Designation VARCHAR(255),
        Mobile VARCHAR(50),
        email VARCHAR(255),
        Purpose VARCHAR(255),
        Course VARCHAR(255),
        Direct_Line VARCHAR(100),
        Remarks TEXT,
        Added_By INT,
        IsDelete TINYINT DEFAULT 0,
        Date_Added DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_const_id (Const_Id)
      )
    `);

    const [rows] = await conn.query(`
      SELECT Id, Consultancy_Id, FullName, CompanyAuthority, Designation, Mobile, Email,
             Idate, InitialFollowUpDate, NextFollowUpDate, Discussion, FollowUp
      FROM corporate_inquiry
      WHERE (IsDelete = 0 OR IsDelete IS NULL)
        AND Consultancy_Id IS NOT NULL
        AND Consultancy_Id > 0
        AND (
          (Discussion IS NOT NULL AND TRIM(Discussion) <> '')
          OR (FollowUp IS NOT NULL AND TRIM(FollowUp) <> '')
          OR InitialFollowUpDate IS NOT NULL
          OR NextFollowUpDate IS NOT NULL
        )
      ORDER BY Id ASC
    `);

    let inserted = 0;
    let skippedExisting = 0;

    for (const row of rows) {
      const candidates = extractCandidates(row);
      const contactPerson = String(row.CompanyAuthority || '').trim() || String(row.FullName || '').trim() || null;

      for (const c of candidates) {
        const [exists] = await conn.query(`
          SELECT Followup_Id
          FROM consultant_followup
          WHERE Const_Id = ?
            AND COALESCE(Followup_Date, '1900-01-01') = COALESCE(?, '1900-01-01')
            AND LOWER(TRIM(COALESCE(Purpose, ''))) = LOWER(TRIM(COALESCE(?, '')))
            AND LOWER(TRIM(COALESCE(Remarks, ''))) = LOWER(TRIM(COALESCE(?, '')))
            AND (IsDelete = 0 OR IsDelete IS NULL)
          LIMIT 1
        `, [row.Consultancy_Id, c.followupDate, c.purpose, c.remarks]);

        if (Array.isArray(exists) && exists.length > 0) {
          skippedExisting += 1;
          continue;
        }

        await conn.query(`
          INSERT INTO consultant_followup
          (Const_Id, Followup_Date, Contact_Person, Designation, Mobile, email, Purpose, Remarks, Added_By)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
        `, [
          row.Consultancy_Id,
          c.followupDate,
          contactPerson,
          String(row.Designation || '').trim() || null,
          String(row.Mobile || '').trim() || null,
          String(row.Email || '').trim() || null,
          c.purpose,
          c.remarks,
        ]);

        inserted += 1;
      }
    }

    await conn.commit();

    const [countRows] = await conn.query(
      `SELECT COUNT(*) AS total FROM consultant_followup WHERE (IsDelete = 0 OR IsDelete IS NULL)`
    );

    console.log(JSON.stringify({
      sourceCorporateRows: rows.length,
      insertedFollowups: inserted,
      skippedExisting,
      activeConsultancyFollowups: countRows[0]?.total ?? null,
    }, null, 2));
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
