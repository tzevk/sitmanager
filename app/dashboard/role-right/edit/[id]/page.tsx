'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { FaShieldAlt, FaSave, FaTimes, FaLock } from 'react-icons/fa';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';
import {
  PermissionsSidebar,
  PermissionsTree,
  type PermissionGroup,
  type Stats,
} from '../../_components/PermissionsPanel';

interface Role {
  id: number;
  title: string;
  description: string;
  permissions: string[];
  isSystemRole?: boolean;
  dashboard_department?: string | null;
}

export default function EditRolePage() {
  const params = useParams<{ id: string }>();
  const roleId = parseInt(params?.id ?? '0', 10);
  const router = useRouter();
  const { canUpdate, loading: permLoading } = useResourcePermissions('role');

  // Lock in the initial permission check so background session refreshes
  // cannot unmount this page after the user has already been granted access.
  const [permGranted, setPermGranted] = useState<boolean | null>(null);
  useEffect(() => {
    if (!permLoading && permGranted === null) setPermGranted(canUpdate);
  }, [permLoading, canUpdate, permGranted]);

  const [role, setRole] = useState<Role | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dashboardDepartment, setDashboardDepartment] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[]>([]);
  const [initialExpanded, setInitialExpanded] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/roles/permissions').then(r => r.json()),
      fetch(`/api/roles/${roleId}`).then(r => r.json()),
    ]).then(([permData, roleData]) => {
      if (permData.success) {
        setPermissionGroups(permData.data);
        setStats(permData.stats);
      }
      if (roleData.success) {
        const r: Role = roleData.data;
        setRole(r);
        setTitle(r.title ?? '');
        setDescription(r.description ?? '');
        setDashboardDepartment(r.dashboard_department ?? '');
        const perms = new Set<string>(r.permissions ?? []);
        setSelectedPermissions(perms);
        // Expand groups that have at least one selected permission
        const withSelection = new Set<string>();
        permData.data.forEach((g: PermissionGroup) => {
          if (g.permissions.some(p => perms.has(p.id))) withSelection.add(g.id);
        });
        setInitialExpanded(withSelection);
      }
    }).finally(() => setLoading(false));
  }, [roleId]);

  const disabled = !!role?.isSystemRole;

  const togglePermission = (id: string) => {
    if (disabled) return;
    setSelectedPermissions(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleGroupAll = (group: PermissionGroup) => {
    if (disabled) return;
    const ids = group.permissions.map(p => p.id);
    const allSelected = ids.every(id => selectedPermissions.has(id));
    setSelectedPermissions(prev => {
      const next = new Set(prev);
      allSelected ? ids.forEach(id => next.delete(id)) : ids.forEach(id => next.add(id));
      return next;
    });
  };

  const selectAll = () => {
    if (disabled) return;
    setSelectedPermissions(new Set(permissionGroups.flatMap(g => g.permissions.map(p => p.id))));
  };

  const deselectAll = () => { if (!disabled) setSelectedPermissions(new Set()); };

  const selectByAction = (action: string) => {
    if (disabled) return;
    setSelectedPermissions(prev => {
      const next = new Set(prev);
      permissionGroups.flatMap(g => g.permissions).filter(p => p.action === action).forEach(p => next.add(p.id));
      return next;
    });
  };

  const handleSave = async () => {
    if (!title.trim()) { setSaveError('Role name is required'); return; }
    setSaveError('');
    setSaving(true);
    try {
      const res = await fetch(`/api/roles/${roleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          permissions: Array.from(selectedPermissions),
          dashboard_department: dashboardDepartment || null,
        }),
      });
      const data = await res.json();
      if (data.success) router.push('/dashboard/role-right');
      else setSaveError(data.error || 'Failed to update role');
    } catch {
      setSaveError('Failed to update role');
    } finally {
      setSaving(false);
    }
  };

  if (permGranted === null) return <PermissionLoading />;
  if (!permGranted) return <AccessDenied message="You do not have permission to edit roles." />;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <div className="w-9 h-9 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-400">Loading role…</p>
        </div>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <FaShieldAlt className="w-6 h-6 text-gray-300" />
        </div>
        <h3 className="text-base font-semibold text-gray-600 mb-1">Role not found</h3>
        <p className="text-sm text-gray-400 mb-5">This role doesn&apos;t exist or has been deleted.</p>
        <Link
          href="/dashboard/role-right"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#2E3093] text-white rounded-xl text-sm font-medium hover:bg-[#252780]"
        >
          Back to Roles
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
              <Link href="/dashboard" className="hover:text-[#2E3093] transition-colors">Dashboard</Link>
              <span>/</span>
              <Link href="/dashboard/role-right" className="hover:text-[#2E3093] transition-colors">Roles</Link>
              <span>/</span>
              <span className="text-gray-700 font-medium">{role.title}</span>
            </nav>
            <div className="flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm ${disabled ? 'bg-amber-500' : 'bg-[#2E3093]'}`}>
                {disabled
                  ? <FaLock className="w-4 h-4 text-white" />
                  : <FaShieldAlt className="w-4 h-4 text-white" />}
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{role.title}</h2>
                {disabled && (
                  <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-medium">System Role — Read Only</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium transition-all"
            >
              <FaTimes className="w-3.5 h-3.5" /> Cancel
            </button>
            {!disabled && (
              <button
                onClick={handleSave}
                disabled={saving || !title.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2E3093] hover:bg-[#252780] text-white text-sm font-semibold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <FaSave className="w-3.5 h-3.5" />}
                Save Changes
              </button>
            )}
          </div>
        </div>
      </div>

      {/* System role notice */}
      {disabled && (
        <div className="flex items-start gap-3 px-5 py-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <FaLock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold text-amber-800 text-sm">System Role — Read Only</div>
            <p className="text-xs text-amber-700 mt-0.5">
              This role has full administrative access. Its permissions cannot be modified.
            </p>
          </div>
        </div>
      )}

      {saveError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 text-sm text-red-700">{saveError}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* ── Left column ── */}
        <div className="space-y-4">
          {/* Role details */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h3 className="text-sm font-bold text-gray-700">Role Details</h3>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Role Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                disabled={disabled}
                placeholder="e.g., Department Manager"
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] disabled:bg-gray-50 disabled:cursor-not-allowed placeholder:text-gray-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                disabled={disabled}
                placeholder="Brief description of this role's purpose…"
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] resize-none disabled:bg-gray-50 disabled:cursor-not-allowed placeholder:text-gray-300"
              />
            </div>
          </div>

          {/* Sidebar stats + quick actions */}
          <PermissionsSidebar
            selectedPermissions={selectedPermissions}
            stats={stats}
            disabled={disabled}
            onSelectAll={selectAll}
            onDeselectAll={deselectAll}
            onSelectByAction={selectByAction}
          />
        </div>

        {/* ── Permissions panel ── */}
        <PermissionsTree
          selectedPermissions={selectedPermissions}
          permissionGroups={permissionGroups}
          loading={loading}
          disabled={disabled}
          initialExpandedGroups={initialExpanded}
          onTogglePermission={togglePermission}
          onToggleGroupAll={toggleGroupAll}
          dashboardDepartment={dashboardDepartment}
          onDashboardChange={setDashboardDepartment}
        />
      </div>
    </div>
  );
}
