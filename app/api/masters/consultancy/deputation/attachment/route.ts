import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';
import { requirePermission } from '@/lib/api-auth';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'deputation-agreements');

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, ['consultancy.create', 'consultancy.update']);
    if (auth instanceof NextResponse) return auth;

    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length === 0) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 });
    }
    if (buffer.length > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File exceeds 10MB limit' }, { status: 413 });
    }

    await fs.mkdir(uploadDir, { recursive: true });
    const safeName = (file.name || 'agreement').replace(/[^a-zA-Z0-9_.-]/g, '_');
    const fileName = `${Date.now()}-${safeName}`;
    await fs.writeFile(path.join(uploadDir, fileName), buffer);

    const url = `/uploads/deputation-agreements/${fileName}`;
    return NextResponse.json({ success: true, url, name: file.name });
  } catch (err: unknown) {
    console.error('Deputation attachment POST error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
