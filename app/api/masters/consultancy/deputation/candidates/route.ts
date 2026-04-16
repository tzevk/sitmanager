import { NextRequest, NextResponse } from 'next/server';
import type { ResultSetHeader } from 'mysql2';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { getSession } from '@/lib/session';
import { logTableActivity } from '@/lib/activity-log';

// POST - add a candidate to a position
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, ['consultancy.create', 'consultancy.update']);
    if (auth instanceof NextResponse) return auth;
    const session = await getSession(req);
    const pool = getPool();
    const body = await req.json();

    const positionId = Number(body.positionId || body.Position_Id || 0);
    const deputationId = Number(body.deputationId || body.Deputation_Id || 0) || null;
    const name = body.Candidate_Name ? String(body.Candidate_Name).trim() : '';
    const mobile = body.Mobile ? String(body.Mobile).trim() : null;
    const email = body.Email ? String(body.Email).trim() : null;
    const status = body.Status ? String(body.Status).trim() : 'Shortlisted';

    if (!positionId) return NextResponse.json({ error: 'positionId is required' }, { status: 400 });
    if (!name) return NextResponse.json({ error: 'Candidate name is required' }, { status: 400 });

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO deputation_candidates
       (Position_Id, Deputation_Id, Candidate_Name, Mobile, Email, Status, IsDelete, CreatedBy)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        positionId,
        deputationId,
        name,
        mobile,
        email,
        status,
        session?.userId != null ? String(session.userId) : null,
      ]
    );

    await logTableActivity(req, {
      tableName: 'deputation_candidates',
      action: 'CREATE',
      recordId: result.insertId,
      details: { positionId, name },
    });

    return NextResponse.json({ success: true, insertId: result.insertId });
  } catch (err: unknown) {
    console.error('Deputation candidates POST error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT - update a candidate (status transitions, offer letter, joining)
export async function PUT(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'consultancy.update');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();
    const id = Number(body.id || body.Candidate_Id || 0);
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const updatable: Record<string, unknown> = {
      Candidate_Name: body.Candidate_Name,
      Mobile: body.Mobile,
      Email: body.Email,
      Status: body.Status,
      Offer_Letter_Shared: body.Offer_Letter_Shared === true ? 1 : body.Offer_Letter_Shared === false ? 0 : undefined,
      Offer_Letter_Date: body.Offer_Letter_Date,
      Joining_Date: body.Joining_Date,
      Notes: body.Notes,
    };

    const setParts: string[] = [];
    const values: unknown[] = [];
    for (const [col, val] of Object.entries(updatable)) {
      if (val === undefined) continue;
      setParts.push(`${col} = ?`);
      values.push(typeof val === 'string' ? val.trim() || null : val);
    }
    if (!setParts.length) return NextResponse.json({ success: true, updated: 0 });

    values.push(id);
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE deputation_candidates
       SET ${setParts.join(', ')}
       WHERE ID = ?
         AND (IsDelete = 0 OR IsDelete IS NULL)`,
      values
    );

    if (!result.affectedRows) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    await logTableActivity(req, {
      tableName: 'deputation_candidates',
      action: 'UPDATE',
      recordId: id,
      details: { fields: Object.keys(updatable).filter(k => updatable[k] !== undefined) },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Deputation candidates PUT error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - soft delete a candidate
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'consultancy.delete');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get('id') || 0);
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    await pool.query(`UPDATE deputation_candidates SET IsDelete = 1 WHERE ID = ?`, [id]);

    await logTableActivity(req, {
      tableName: 'deputation_candidates',
      action: 'DELETE',
      recordId: id,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Deputation candidates DELETE error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
