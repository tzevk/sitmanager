/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';

async function ensureCorporateProposalTable(pool: ReturnType<typeof getPool>) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS corporate_proposal (
      Id INT AUTO_INCREMENT PRIMARY KEY,
      Inquiry_Id INT NOT NULL,
      ProposalRefNo VARCHAR(100) NULL,
      ProposalDate VARCHAR(50) NULL,
      ProposalTitle VARCHAR(500) NULL,
      ClientName VARCHAR(255) NULL,
      Venue VARCHAR(255) NULL,
      AboutOrganisation LONGTEXT NULL,
      TrainingContents LONGTEXT NULL,
      QuotationRows LONGTEXT NULL,
      TrainingAttachments LONGTEXT NULL,
      QuotationAttachments LONGTEXT NULL,
      TrainerCvAttachments LONGTEXT NULL,
      CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_corporate_proposal_inquiry (Inquiry_Id)
    )
  `);

  const [cols] = await pool.query<any[]>(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'corporate_proposal'
       AND COLUMN_NAME = 'TrainerCvAttachments'`
  );
  if (!cols || cols.length === 0) {
    await pool.query(`ALTER TABLE corporate_proposal ADD COLUMN TrainerCvAttachments LONGTEXT NULL`);
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(req, [
      'corporate_inquiry.view',
      'corporate_inquiry.update',
      'corporate_inquiry.create',
    ]);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const pool = getPool();
    await ensureCorporateProposalTable(pool);

    const [rows] = await pool.query<any[]>(
      `SELECT * FROM corporate_proposal WHERE Inquiry_Id = ? LIMIT 1`,
      [id]
    );

    if (!rows || rows.length === 0) return NextResponse.json({ proposal: null });

    const row = rows[0];
    const parse = (s: any) => {
      if (!s) return null;
      try {
        return JSON.parse(String(s));
      } catch {
        return null;
      }
    };
    return NextResponse.json({
      proposal: {
        ...row,
        QuotationRows: parse(row.QuotationRows) || [],
        TrainingAttachments: parse(row.TrainingAttachments) || [],
        QuotationAttachments: parse(row.QuotationAttachments) || [],
        TrainerCvAttachments: parse(row.TrainerCvAttachments) || [],
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(req, 'corporate_inquiry.update');
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const inquiryId = Number(id);
    if (!Number.isFinite(inquiryId) || inquiryId <= 0) {
      return NextResponse.json({ error: 'Invalid inquiry id' }, { status: 400 });
    }

    const body = await req.json();
    const proposalRefNo = String(body?.proposalRefNo || '').trim();
    const proposalDate = String(body?.proposalDate || '').trim();
    const proposalTitle = String(body?.proposalTitle || '').trim();
    const clientName = String(body?.clientName || '').trim();
    const venue = String(body?.venue || '').trim();
    const aboutOrganisation = String(body?.aboutOrganisation || '');
    const trainingContents = String(body?.trainingContents || '');
    const quotationRows = JSON.stringify(Array.isArray(body?.quotationRows) ? body.quotationRows : []);
    const trainingAttachments = JSON.stringify(
      Array.isArray(body?.trainingAttachments) ? body.trainingAttachments : []
    );
    const quotationAttachments = JSON.stringify(
      Array.isArray(body?.quotationAttachments) ? body.quotationAttachments : []
    );
    const trainerCvAttachments = JSON.stringify(
      Array.isArray(body?.trainerCvAttachments) ? body.trainerCvAttachments : []
    );

    const pool = getPool();
    await ensureCorporateProposalTable(pool);

    await pool.query(
      `INSERT INTO corporate_proposal
         (Inquiry_Id, ProposalRefNo, ProposalDate, ProposalTitle, ClientName, Venue,
          AboutOrganisation, TrainingContents, QuotationRows, TrainingAttachments, QuotationAttachments, TrainerCvAttachments)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         ProposalRefNo = VALUES(ProposalRefNo),
         ProposalDate = VALUES(ProposalDate),
         ProposalTitle = VALUES(ProposalTitle),
         ClientName = VALUES(ClientName),
         Venue = VALUES(Venue),
         AboutOrganisation = VALUES(AboutOrganisation),
         TrainingContents = VALUES(TrainingContents),
         QuotationRows = VALUES(QuotationRows),
         TrainingAttachments = VALUES(TrainingAttachments),
         QuotationAttachments = VALUES(QuotationAttachments),
         TrainerCvAttachments = VALUES(TrainerCvAttachments)`,
      [
        inquiryId,
        proposalRefNo,
        proposalDate,
        proposalTitle,
        clientName,
        venue,
        aboutOrganisation,
        trainingContents,
        quotationRows,
        trainingAttachments,
        quotationAttachments,
        trainerCvAttachments,
      ]
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save proposal';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
