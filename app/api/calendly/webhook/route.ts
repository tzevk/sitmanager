/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';

async function ensureTable(pool: any) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS calendly_bookings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      invitee_name VARCHAR(255) NOT NULL DEFAULT '',
      invitee_email VARCHAR(255) NOT NULL DEFAULT '',
      invitee_mobile VARCHAR(50) DEFAULT NULL,
      event_start_time DATETIME DEFAULT NULL,
      event_type VARCHAR(255) DEFAULT NULL,
      calendly_uri VARCHAR(500) DEFAULT NULL,
      questions_json TEXT DEFAULT NULL,
      received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      called_at DATETIME DEFAULT NULL,
      inquiry_id INT DEFAULT NULL,
      IsDelete TINYINT(1) NOT NULL DEFAULT 0,
      INDEX idx_received_at (received_at),
      INDEX idx_called_at (called_at),
      INDEX idx_is_delete (IsDelete)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  // Add questions_json if the table already existed without it
  await pool.query(`
    ALTER TABLE calendly_bookings
    ADD COLUMN IF NOT EXISTS questions_json TEXT DEFAULT NULL
  `).catch(() => {});
}

function extractMobile(qna: any[]): string | null {
  if (!Array.isArray(qna)) return null;
  const hit = qna.find((q: any) => /phone|mobile|contact\s*no|number/i.test(String(q.question || '')));
  return hit?.answer ? String(hit.answer).trim() : null;
}

export async function POST(req: NextRequest) {
  try {
    const pool = getPool();
    await ensureTable(pool);

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    let invitee_name = '';
    let invitee_email = '';
    let invitee_mobile: string | null = null;
    let event_start_time: string | null = null;
    let event_type: string | null = null;
    let calendly_uri: string | null = null;
    let questions_json: string | null = null;

    // Calendly webhook v2 format: { event: 'invitee.created', payload: { ... } }
    if (body.event === 'invitee.created' && body.payload) {
      const p = body.payload;
      invitee_name = p.name || '';
      invitee_email = p.email || '';

      const qna: any[] = Array.isArray(p.questions_and_answers) ? p.questions_and_answers : [];
      invitee_mobile = extractMobile(qna);

      // Store all non-empty Q&A pairs (sorted by position)
      const allQA = qna
        .filter((q: any) => q.answer && String(q.answer).trim())
        .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
        .map((q: any) => ({ question: String(q.question || '').trim(), answer: String(q.answer || '').trim() }));
      if (allQA.length > 0) questions_json = JSON.stringify(allQA);

      event_start_time = p.scheduled_event?.start_time || p.event?.start_time || null;
      event_type = p.scheduled_event?.name || p.event_type?.name || null;
      calendly_uri = p.uri || p.scheduled_event?.uri || null;
    } else {
      // Manual entry format
      invitee_name = body.name || body.invitee_name || '';
      invitee_email = body.email || body.invitee_email || '';
      invitee_mobile = body.mobile || body.phone || body.invitee_mobile || null;
      event_start_time = body.event_start_time || body.start_time || null;
      event_type = body.event_type || null;
      calendly_uri = body.calendly_uri || body.uri || null;
      if (body.questions && typeof body.questions === 'object') {
        questions_json = JSON.stringify(body.questions);
      }
    }

    if (!invitee_name && !invitee_email) {
      return NextResponse.json({ error: 'Name or email is required' }, { status: 400 });
    }

    const [result] = await pool.query(
      `INSERT INTO calendly_bookings
        (invitee_name, invitee_email, invitee_mobile, event_start_time, event_type, calendly_uri, questions_json, received_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [invitee_name, invitee_email, invitee_mobile, event_start_time, event_type, calendly_uri, questions_json]
    ) as any;

    return NextResponse.json({ ok: true, id: (result as any).insertId }, { status: 201 });
  } catch (error: any) {
    console.error('Calendly webhook error:', error);
    return NextResponse.json({ error: 'Failed to store booking', details: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const pool = getPool();
    await ensureTable(pool);

    const body = await req.json().catch(() => null);
    if (!body?.id) {
      return NextResponse.json({ error: 'Booking id is required' }, { status: 400 });
    }

    if (body.called) {
      await pool.query(`UPDATE calendly_bookings SET called_at = NOW() WHERE id = ?`, [body.id]);
    }
    if (body.inquiry_id) {
      await pool.query(`UPDATE calendly_bookings SET inquiry_id = ? WHERE id = ?`, [body.inquiry_id, body.id]);
    }
    if (body.delete) {
      await pool.query(`UPDATE calendly_bookings SET IsDelete = 1 WHERE id = ?`, [body.id]);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Calendly booking update error:', error);
    return NextResponse.json({ error: 'Failed to update booking', details: error.message }, { status: 500 });
  }
}
