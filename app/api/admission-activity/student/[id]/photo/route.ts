import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { saveStudentPhotoBlob } from '@/lib/student-documents.server';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(req, 'student.update');
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const studentId = Number(id);
    if (!Number.isInteger(studentId) || studentId <= 0) {
      return NextResponse.json({ error: 'Invalid student id' }, { status: 400 });
    }

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

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const filename = `student_${id}_${Date.now()}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    const photoUrl = await saveStudentPhotoBlob(studentId, bytes, file.type || 'image/jpeg', filename);

    return NextResponse.json({ photoUrl });
  } catch (err: unknown) {
    console.error('Photo upload error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Photo upload failed' },
      { status: 500 }
    );
  }
}
