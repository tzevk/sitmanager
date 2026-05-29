import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';
import { requirePermission } from '@/lib/api-auth';

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'meta-ads', 'creatives');

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, ['inquiry.update']);
    if (auth instanceof NextResponse) return auth;

    const formData = await req.formData();
    const image = formData.get('image');

    if (!(image instanceof File)) {
      return NextResponse.json({ error: 'Image file is required.' }, { status: 400 });
    }

    if (image.type && !image.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image uploads are allowed.' }, { status: 400 });
    }

    const arrayBuffer = await image.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      return NextResponse.json({ error: 'Image file is empty.' }, { status: 400 });
    }

    if (buffer.length > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Image exceeds 8MB limit.' }, { status: 413 });
    }

    await fs.mkdir(uploadDir, { recursive: true });

    const safeName = image.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const fileName = `${Date.now()}-${safeName || 'meta-creative'}`;
    const filePath = path.join(uploadDir, fileName);

    await fs.writeFile(filePath, buffer);

    const relativeUrl = `/uploads/meta-ads/creatives/${fileName}`;
    const origin = new URL(req.url).origin;
    const imageUrl = `${origin}${relativeUrl}`;

    return NextResponse.json({ imageUrl, relativeUrl, fileName }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to upload Meta creative image';
    console.error('Meta creative image upload error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}