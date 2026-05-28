'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FaShieldAlt, FaSave, FaTimes } from 'react-icons/fa';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';
import {
  PermissionsSidebar,
  PermissionsTree,
  type PermissionGroup,
  type Stats,
} from '../_components/PermissionsPanel';

export default function AddRolePage() {
  const router = useRouter();
  const { canCreate, loading: permLoading } = useResourcePermissions('role');

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
    fetch('/api/roles/permissions')
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setPermissionGroups(data.data);
          setStats(data.stats);
          if (data.data.length > 0) setInitialExpanded(new Set([data.data[0].id]));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const togglePermission = (id: string) => {
    setSelectedPermissions(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleGroupAll = (group: PermissionGroup) => {
    const ids = group.permissions.map(p => p.id);
    const allSelected = ids.every(id => selectedPermissions.has(id));
    setSelectedPermissions(prev => {
      const next = new Set(prev);
      allSelected ? ids.forEach(id => next.delete(id)) : ids.forEach(id => next.add(id));
      return next;
    });
  };

  const selectAll = () => {
    setSelectedPermissions(new Set(permissionGroups.flatMap(g => g.permissions.map(p => p.id))));
  };

  const deselectAll = () => setSelectedPermissions(new Set());

  const selectByAction = (action: string) => {
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
      const res = await fetch('/api/roles', {
        method: 'POST',
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
      else setSaveError(data.error || 'Failed to create role');
    } catch {
      setSaveError('Failed to create role');
    } finally {
      setSaving(false);
    }
  };

  if (permLoading) return <PermissionLoading />;
  if (!canCreate) return <AccessDenied message="You do not have permission to create roles." />;

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
              <span className="text-gray-700 font-medium">New Role</span>
            </nav>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#2E3093] flex items-center justify-center shadow-sm">
                <FaShieldAlt className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Create New Role</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium transition-all"
            >
              <FaTimes className="w-3.5 h-3.5" /> Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2E3093] hover:bg-[#252780] text-white text-sm font-semibold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <FaSave className="w-3.5 h-3.5" />}
              Save Role
            </button>
          </div>
        </div>
      </div>

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
                placeholder="e.g., Department Manager"
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-gray-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Brief description of this role's purpose…"
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] resize-none placeholder:text-gray-300"
              />
            </div>
          </div>

          {/* Sidebar stats + quick actions */}
          <PermissionsSidebar
            selectedPermissions={selectedPermissions}
            stats={stats}
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
