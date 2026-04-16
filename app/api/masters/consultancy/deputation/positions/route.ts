import { NextRequest, NextResponse } from 'next/server';
import type { ResultSetHeader } from 'mysql2';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { getSession } from '@/lib/session';
import { logTableActivity } from '@/lib/activity-log';

// POST - add position to a deputation entry
export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, ['consultancy.create', 'consultancy.update']);
    if (auth instanceof NextResponse) return auth;
    const session = await getSession(req);
    const pool = getPool();

    const body = await req.json();
    const deputationId = Number(body.deputationId || body.Deputation_Id || 0);
    if (!deputationId) return NextResponse.json({ error: 'deputationId is required' }, { status: 400 });

    const positionTitle = body.Position_Title ? String(body.Position_Title).trim() : null;
    const totalRequirement = body.Total_Requirement != null && body.Total_Requirement !== ''
      ? Number(body.Total_Requirement)
      : null;
    const shortDescription = body.Short_Description ? String(body.Short_Description).trim() : null;
    const workingLocation = body.Working_Location ? String(body.Working_Location).trim() : null;

    if (!positionTitle) return NextResponse.json({ error: 'Position title is required' }, { status: 400 });

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO deputation_positions
       (Deputation_Id, Position_Title, Total_Requirement, Short_Description, Working_Location, Status, IsDelete, CreatedBy)
       VALUES (?, ?, ?, ?, ?, 'Open', 0, ?)`,
      [
        deputationId,
        positionTitle,
        totalRequirement,
        shortDescription,
        workingLocation,
        session?.userId != null ? String(session.userId) : null,
      ]
    );

    await logTableActivity(req, {
      tableName: 'deputation_positions',
      action: 'CREATE',
      recordId: result.insertId,
      details: { deputationId, positionTitle },
    });

    return NextResponse.json({ success: true, insertId: result.insertId });
  } catch (err: unknown) {
    console.error('Deputation positions POST error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT - update a position (including conversion/closing details)
export async function PUT(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'consultancy.update');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const body = await req.json();
    const id = Number(body.id || body.Position_Id || 0);
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const status = body.Status ? String(body.Status).trim() : 'Open';
    const wentAhead = body.Went_Ahead ? 1 : 0;

    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE deputation_positions
       SET Position_Title = COALESCE(?, Position_Title),
           Total_Requirement = ?,
           Short_Description = ?,
           Working_Location = ?,
           Status = ?,
           Interview_Arrangement = ?,
           Went_Ahead = ?,
           Joining_Date = ?,
           Closed_By = ?,
           Closing_Notes = ?
       WHERE ID = ?
         AND (IsDelete = 0 OR IsDelete IS NULL)`,
      [
        body.Position_Title ? String(body.Position_Title).trim() : null,
        body.Total_Requirement != null && body.Total_Requirement !== '' ? Number(body.Total_Requirement) : null,
        body.Short_Description ? String(body.Short_Description).trim() : null,
        body.Working_Location ? String(body.Working_Location).trim() : null,
        status,
        body.Interview_Arrangement ? String(body.Interview_Arrangement).trim() : null,
        wentAhead,
        body.Joining_Date || null,
        body.Closed_By ? String(body.Closed_By).trim() : null,
        body.Closing_Notes ? String(body.Closing_Notes).trim() : null,
        id,
      ]
    );

    if (!result.affectedRows) {
      return NextResponse.json({ error: 'Position not found' }, { status: 404 });
    }

    await logTableActivity(req, {
      tableName: 'deputation_positions',
      action: 'UPDATE',
      recordId: id,
      details: { status, wentAhead: !!wentAhead },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Deputation positions PUT error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - soft delete a position
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'consultancy.delete');
    if (auth instanceof NextResponse) return auth;
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get('id') || 0);
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    await pool.query(`UPDATE deputation_positions SET IsDelete = 1 WHERE ID = ?`, [id]);

    await logTableActivity(req, {
      tableName: 'deputation_positions',
      action: 'DELETE',
      recordId: id,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Deputation positions DELETE error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
