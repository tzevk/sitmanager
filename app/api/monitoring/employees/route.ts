import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import { listAdminUsers } from '@/lib/services/monitoring.service';

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'monitoring.view');
  if (auth instanceof NextResponse) return auth;

  try {
    const employees = await listAdminUsers();
    return NextResponse.json({ employees });
  } catch (error) {
    console.error('Error fetching monitoring employees:', error);
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
  }
}
