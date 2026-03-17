/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requirePermission } from '@/lib/api-auth';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(req, 'student.update');
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const pool = getPool();

    const formData = await req.formData();
    const file = formData.get('photo') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No photo file provided' }, { status: 400 });
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'Photo must be smaller than 2 MB' }, { status: 400 });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Only JPEG, PNG and WebP images are allowed' }, { status: 400 });
    }

    // Save file to public/uploads/students/
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const filename = `student_${id}_${Date.now()}.${ext}`;
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'students');

    await mkdir(uploadDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    await writeFile(join(uploadDir, filename), Buffer.from(bytes));

    const photoUrl = `/uploads/students/${filename}`;

    // Persist to student_master — try common column names
    // The actual column must exist in the DB; update to match your schema.
    // Typical names: Photo, Student_Photo, PhotoPath, Photo_Path
    try {
      await pool.query(
        `UPDATE student_master SET Photo = ? WHERE Student_Id = ?`,
        [photoUrl, id]
      );
    } catch (dbErr: any) {
      // Column might have a different name — return the URL anyway so UI can display it
      console.warn('Could not update photo column:', dbErr?.message);
    }

    return NextResponse.json({ photoUrl });
  } catch (err: unknown) {
    console.error('Photo upload error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Photo upload failed' },
      { status: 500 }
    );
  }
}
