/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getStudentSession } from '@/app/api/student-portal/auth/session/route';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

// GET — list student's CVs
export async function GET(req: NextRequest) {
  try {
    const session = await getStudentSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();
    const [rows] = await pool.query<any[]>(
      `SELECT CV_Id, CV_Name, CV_Path, Is_Default, Created_Date as Upload_Date
       FROM student_cvs
       WHERE Student_Id = ? AND IsDelete = 0
       ORDER BY Created_Date DESC`,
      [session.studentId]
    );

    return NextResponse.json({ cvs: rows });
  } catch (err: unknown) {
    console.error('Student CV GET error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}

// POST — upload CV
export async function POST(req: NextRequest) {
  try {
    const session = await getStudentSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pool = getPool();
    const formData = await req.formData();
    const file = formData.get('cv') as File | null;
    const isDefault = formData.get('is_default') === '1';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File must be smaller than 5 MB' }, { status: 400 });
    }

    const allowedTypes = ['application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Only PDF and Word documents are allowed' }, { status: 400 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
    const filename = `cv_${session.studentId}_${Date.now()}.${ext}`;
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'cvs');
    await mkdir(uploadDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    await writeFile(join(uploadDir, filename), Buffer.from(bytes));
    const cvPath = `/uploads/cvs/${filename}`;

    // If setting as default, unset existing defaults
    if (isDefault) {
      await pool.query(
        `UPDATE student_cvs SET Is_Default = 0 WHERE Student_Id = ? AND IsDelete = 0`,
        [session.studentId]
      );
    }

    await pool.query(
      `INSERT INTO student_cvs (Student_Id, CV_Name, CV_Path, Is_Default, Created_Date)
       VALUES (?, ?, ?, ?, NOW())`,
      [session.studentId, file.name, cvPath, isDefault ? 1 : 0]
    );

    return NextResponse.json({ success: true, cvPath });
  } catch (err: unknown) {
    console.error('Student CV POST error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}

// DELETE — soft-delete a CV
export async function DELETE(req: NextRequest) {
  try {
    const session = await getStudentSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { cv_id } = await req.json();
    if (!cv_id) return NextResponse.json({ error: 'CV ID required' }, { status: 400 });

    const pool = getPool();
    const [result] = await pool.query<any>(
      `UPDATE student_cvs SET IsDelete = 1 WHERE CV_Id = ? AND Student_Id = ?`,
      [cv_id, session.studentId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'CV not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Student CV DELETE error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}

// PUT — set a CV as default
export async function PUT(req: NextRequest) {
  try {
    const session = await getStudentSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { cv_id } = await req.json();
    if (!cv_id) return NextResponse.json({ error: 'CV ID required' }, { status: 400 });

    const pool = getPool();

    // Unset all defaults
    await pool.query(
      `UPDATE student_cvs SET Is_Default = 0 WHERE Student_Id = ? AND IsDelete = 0`,
      [session.studentId]
    );

    // Set the specified CV as default
    const [result] = await pool.query<any>(
      `UPDATE student_cvs SET Is_Default = 1 WHERE CV_Id = ? AND Student_Id = ? AND IsDelete = 0`,
      [cv_id, session.studentId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'CV not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Student CV PUT error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
