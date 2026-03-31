import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

const ensureTable = async (pool: any) => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public_student_intake (
      Id INT AUTO_INCREMENT PRIMARY KEY,
      student_name VARCHAR(255) NOT NULL,
      phone_number VARCHAR(32) NOT NULL,
      company_name VARCHAR(255) NULL,
      roll_number VARCHAR(64) NULL,
      token VARCHAR(64) NULL,
      inquiry_id INT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_token (token),
      INDEX idx_inquiry (inquiry_id),
      INDEX idx_roll (roll_number)
    ) ENGINE=InnoDB;
  `);
  await pool.query('ALTER TABLE public_student_intake ADD COLUMN IF NOT EXISTS roll_number VARCHAR(64) NULL');
};

// List student intakes for a corporate inquiry
export async function GET(req: NextRequest) {
  try {
    const inquiryId = Number(req.nextUrl.searchParams.get('inquiryId'));
    if (!inquiryId || Number.isNaN(inquiryId)) {
      return NextResponse.json({ success: false, error: 'Invalid inquiry id' }, { status: 400 });
    }

    const pool = getPool();
    await ensureTable(pool);

    const [rows] = await pool.query<any[]>(
      `SELECT Id, student_name AS studentName, phone_number AS phoneNumber, roll_number AS rollNumber, created_at AS createdAt
       FROM public_student_intake
       WHERE inquiry_id = ?
       ORDER BY created_at DESC`,
      [inquiryId]
    );

    return NextResponse.json({ success: true, intakes: rows });
  } catch (err: unknown) {
    console.error('student-intakes GET error', err);
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// Bulk allot roll numbers to intakes without one
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const inquiryId = Number(body?.inquiryId);
    const sitCode = String(body?.sitCode || '000').trim() || '000';
    const startSeq = body?.startSeq ? Number(body.startSeq) : null;

    if (!inquiryId || Number.isNaN(inquiryId)) {
      return NextResponse.json({ success: false, error: 'Invalid inquiry id' }, { status: 400 });
    }

    const pool = getPool();
    await ensureTable(pool);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.query<any[]>(
        `SELECT Id, roll_number AS rollNumber FROM public_student_intake WHERE inquiry_id = ? FOR UPDATE`,
        [inquiryId]
      );

      const year = new Date().getFullYear().toString().slice(-2);
      const prefix = `${year}${sitCode}CT`;

      const extractSeq = (roll: string | null) => {
        if (!roll) return null;
        const m = roll.match(/(\d+)$/);
        return m ? Number(m[1]) : null;
      };

      let nextSeq = startSeq && !Number.isNaN(startSeq) ? startSeq : 179;
      for (const r of rows) {
        const seq = extractSeq(r.rollNumber);
        if (seq && seq >= nextSeq) nextSeq = seq + 1;
      }

      const toAssign = rows.filter(r => !r.rollNumber);
      const updates: Array<{ id: number; roll: string }> = [];
      for (const r of toAssign) {
        const roll = `${prefix}${nextSeq}`;
        updates.push({ id: r.Id, roll });
        nextSeq += 1;
      }

      if (updates.length > 0) {
        for (const u of updates) {
          await conn.query(`UPDATE public_student_intake SET roll_number = ? WHERE Id = ?`, [u.roll, u.id]);
        }
      }

      await conn.commit();

      return NextResponse.json({ success: true, assigned: updates.length });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err: unknown) {
    console.error('student-intakes POST error', err);
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// Delete a student intake record by Id
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const intakeId = Number(body?.intakeId);
    if (!intakeId || Number.isNaN(intakeId)) {
      return NextResponse.json({ success: false, error: 'Invalid intake id' }, { status: 400 });
    }

    const pool = getPool();
    await ensureTable(pool);

    const [result]: any = await pool.query('DELETE FROM public_student_intake WHERE Id = ?', [intakeId]);
    const affected = result?.affectedRows ?? 0;

    return NextResponse.json({ success: true, deleted: affected });
  } catch (err: unknown) {
    console.error('student-intakes DELETE error', err);
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
