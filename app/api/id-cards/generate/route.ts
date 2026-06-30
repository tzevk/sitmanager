import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { buildIdCardsDocx, type IdCardInput } from '@/lib/id-card-docx';

export const runtime = 'nodejs';
export const maxDuration = 60;

function sanitize(card: unknown): IdCardInput {
  const c = (card ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  return {
    name: str(c.name),
    course: str(c.course),
    batchNo: str(c.batchNo),
    contactNo: str(c.contactNo),
    validUpto: str(c.validUpto),
    photo: typeof c.photo === 'string' && c.photo.startsWith('data:image/') ? c.photo : null,
  };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'student.view');
    if (auth instanceof NextResponse) return auth;

    const body = await req.json().catch(() => ({}));
    const rawCards = Array.isArray(body?.cards) ? body.cards : [];
    if (rawCards.length === 0) {
      return NextResponse.json({ error: 'Add at least one ID card.' }, { status: 400 });
    }
    if (rawCards.length > 200) {
      return NextResponse.json({ error: 'Too many cards in one batch (max 200).' }, { status: 400 });
    }

    const cards = rawCards.map(sanitize);
    const buffer = await buildIdCardsDocx(cards);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': 'attachment; filename="id-cards.docx"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate ID cards';
    console.error('ID card generation error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
