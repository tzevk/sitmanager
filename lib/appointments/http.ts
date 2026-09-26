import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import type { SessionData } from '@/lib/session';
import { AppointmentError, isCounsellor, type Actor, type Scope } from '@/lib/appointments/service';

/**
 * Access rules for internal appointment APIs:
 *  - `appointment.<action>` grants the action.
 *  - Enrolled counsellors can always view / update THEIR OWN appointments,
 *    even without the permission (so the widget + reminders just work).
 *  - `appointment.manage` widens the scope from "own" to "all counsellors".
 */
export interface ApptAccess {
  session: SessionData;
  permissions: string[];
  scope: Scope;
  actor: Actor;
  canManage: boolean;
  isCounsellor: boolean;
}

export async function requireAppointmentAccess(
  req: NextRequest,
  action: 'view' | 'create' | 'update' | 'delete'
): Promise<ApptAccess | NextResponse> {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { session, permissions } = auth;

  const canManage = permissions.includes('appointment.manage');
  const counsellor = await isCounsellor(session.userId).catch(() => false);
  const hasPerm = permissions.includes(`appointment.${action}`) || canManage;
  const ownAllowed = counsellor && (action === 'view' || action === 'update');

  if (!hasPerm && !ownAllowed) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'You do not have permission to perform this action' },
      { status: 403 }
    );
  }

  return {
    session,
    permissions,
    canManage,
    isCounsellor: counsellor,
    scope: { all: canManage, userId: session.userId },
    actor: { userId: session.userId, name: `${session.firstName ?? ''} ${session.lastName ?? ''}`.trim() || session.email },
  };
}

export async function requireSettingsAccess(req: NextRequest, write: boolean) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const allowed = auth.permissions.includes('appointment_settings.manage')
    || (!write && (auth.permissions.includes('appointment.view') || auth.permissions.includes('appointment.manage')));
  if (!allowed) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'You do not have permission to manage appointment settings' },
      { status: 403 }
    );
  }
  return auth;
}

export function apptErrorResponse(err: unknown, context: string) {
  if (err instanceof AppointmentError) {
    return NextResponse.json({ success: false, error: err.message, code: err.code }, { status: err.status });
  }
  console.error(`[appointments] ${context}:`, err);
  return NextResponse.json({ success: false, error: 'Something went wrong. Please try again.' }, { status: 500 });
}

export function clientIp(req: NextRequest): string | null {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim().slice(0, 64);
  return req.headers.get('x-real-ip')?.slice(0, 64) ?? null;
}
