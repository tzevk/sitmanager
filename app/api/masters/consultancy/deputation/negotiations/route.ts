import { NextRequest, NextResponse } from 'next/server';
import type { ResultSetHeader } from 'mysql2';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { getSession } from '@/lib/session';
import { logTableActivity } from '@/lib/activity-log';

// POST - add a negotiation pointer
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, ['consultancy.create', 'consultancy.update']);
    if (auth instanceof NextResponse) return auth;
    const session = await getSession(req);
    const pool = getPool();
    const body = await req.json();

    const deputationId = Number(body.deputationId || body.Deputation_Id || 0);
    const discussion = body.Discussion ? String(body.Discussion).trim() : '';
    const negotiationDate = body.Negotiation_Date || null;
    const rawPhase = body.Phase ? String(body.Phase).trim().toLowerCase() : 'negotiation';
    const phase = rawPhase === 'deputation' ? 'deputation' : 'negotiation';

    if (!deputationId) return NextResponse.json({ error: 'deputationId is required' }, { status: 400 });
    if (!discussion) return NextResponse.json({ error: 'Discussion is required' }, { status: 400 });

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO deputation_negotiations
       (Deputation_Id, Negotiation_Date, Discussion, Phase, CreatedBy)
       VALUES (?, ?, ?, ?, ?)`,
      [
        deputationId,
        negotiationDate,
        discussion,
        phase,
        session?.userId != null ? String(session.userId) : null,
      ]
    );

    await logTableActivity(req, {
      tableName: 'deputation_negotiations',
      action: 'CREATE',
      recordId: result.insertId,
      details: { deputationId, negotiationDate },
    });

    return NextResponse.json({ success: true, insertId: result.insertId });
  } catch (err: unknown) {
    console.error('Deputation negotiations POST error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT - edit a discussion
export async function PUT(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'consultancy.update');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();
    const id = Number(body.id || body.ID || 0);
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const discussion = body.Discussion ? String(body.Discussion).trim() : '';
    if (!discussion) return NextResponse.json({ error: 'Discussion is required' }, { status: 400 });

    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE deputation_negotiations
       SET Negotiation_Date = ?,
           Discussion = ?
       WHERE ID = ?`,
      [body.Negotiation_Date || null, discussion, id]
    );

    if (!result.affectedRows) {
      return NextResponse.json({ error: 'Discussion not found' }, { status: 404 });
    }

    await logTableActivity(req, {
      tableName: 'deputation_negotiations',
      action: 'UPDATE',
      recordId: id,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Deputation negotiations PUT error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - remove a negotiation pointer
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'consultancy.delete');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get('id') || 0);
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    await pool.query(`DELETE FROM deputation_negotiations WHERE ID = ?`, [id]);

    await logTableActivity(req, {
      tableName: 'deputation_negotiations',
      action: 'DELETE',
      recordId: id,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Deputation negotiations DELETE error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
