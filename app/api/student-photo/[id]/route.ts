/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { ensureStudentPhotoBlobColumns } from '@/lib/student-documents.server';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const studentId = Number(id);
    if (!Number.isInteger(studentId) || studentId <= 0) {
      return NextResponse.json({ error: 'Invalid student id' }, { status: 400 });
    }

    const pool = getPool();
    await ensureStudentPhotoBlobColumns(pool);
    const [rows] = await pool.query(
      `SELECT Photo_Data, Photo_Content_Type
       FROM student_master
       WHERE Student_Id = ? AND Photo_Data IS NOT NULL
       LIMIT 1`,
      [studentId]
    ) as [any[], any];

    const row = rows[0];
    if (!row?.Photo_Data) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    const bytes = Buffer.from(row.Photo_Data);
    const contentType = String(row.Photo_Content_Type || 'image/jpeg');
    return new NextResponse(bytes, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load student photo';
    console.error('Student photo fetch error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
