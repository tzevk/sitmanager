import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/session';
import { logTableActivity } from '@/lib/activity-log';

export async function POST(request: NextRequest) {
  await logTableActivity(request, { tableName: 'auth', action: 'LOGOUT' });
  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
  clearSessionCookie(response);
  return response;
}
