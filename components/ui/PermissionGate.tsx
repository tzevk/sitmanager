'use client';

import { ReactNode } from 'react';
import { useResourcePermissions } from '@/lib/permissions-context';
import { PermissionAction } from '@/lib/rbac';

/* ── Access Denied Display ─────────────────────────────────────── */
export function AccessDenied({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
      <p className="text-sm font-semibold">Access Denied</p>
      <p className="text-xs">{message || 'You do not have permission to access this page.'}</p>
    </div>
  );
}

/* ── Loading Spinner ───────────────────────────────────────────── */
export function PermissionLoading() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

/* ── Permission Gate — wraps a page, shows loading/denied/content ─ */
interface PermissionGateProps {
  resource: string;
  action?: PermissionAction;
  deniedMessage?: string;
  children: (perms: {
    canView: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canExport: boolean;
  }) => ReactNode;
}

export function PermissionGate({
  resource,
  action = 'view',
  deniedMessage,
  children,
}: PermissionGateProps) {
  const perms = useResourcePermissions(resource);

  if (perms.loading) return <PermissionLoading />;

  const allowed = action === 'view' ? perms.canView
    : action === 'create' ? perms.canCreate
    : action === 'update' ? perms.canUpdate
    : action === 'delete' ? perms.canDelete
    : action === 'export' ? perms.canExport
    : false;

  if (!allowed) {
    return <AccessDenied message={deniedMessage} />;
  }

  return <>{children(perms)}</>;
}
