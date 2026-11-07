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
    const rows = await cached('dashboard-admission-closure-v1', 300, getAdmissionClosureByEmployee);
    return NextResponse.json({ rows });
  } catch (error) {
    console.error('Admission closure GET error:', error);
    return NextResponse.json({ error: 'Could not load admission closures' }, { status: 500 });
  }
}
