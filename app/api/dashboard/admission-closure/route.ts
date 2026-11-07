import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { cached } from '@/lib/db';
import { getAdmissionClosureByEmployee } from '@/lib/services/admission-closure.service';

export const runtime = 'nodejs';

/** Admission closure by employee — CBD and Administration dashboards. */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const isDate = (v: string | null) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const sp = req.nextUrl.searchParams;
    const from = isDate(sp.get('from')) ? sp.get('from')! : `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
    const to = isDate(sp.get('to')) ? sp.get('to')! : `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    if (from > to) return NextResponse.json({ error: 'From date must be before To date' }, { status: 400 });
    const rows = await cached(`dashboard-admission-closure-v2:${from}:${to}`, 300, () => getAdmissionClosureByEmployee(from, to));
    return NextResponse.json({ from, to, rows });
  } catch (error) {
    console.error('Admission closure GET error:', error);
    return NextResponse.json({ error: 'Could not load admission closures' }, { status: 500 });
  }
}
