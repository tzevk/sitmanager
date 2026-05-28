'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  FaPlus, FaEdit, FaTrashAlt, FaSearch, FaShieldAlt, FaChevronRight,
  FaCheck, FaTimes, FaUserPlus, FaUsers, FaKey, FaEye, FaEyeSlash, FaCopy,
  FaLock,
} from 'react-icons/fa';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';

interface Role {
  id: number;
  title: string;
  description: string;
  permissions: string[];
  isSystemRole?: boolean;
  deleted: number;
  created_date: string;
  updated_date: string;
}

interface PermissionStats {
  totalPermissions: number;
  permissionGroups: number;
}

// Consistent color palette cycled per role index
const CARD_PALETTE = [
  { ring: 'ring-violet-200', iconBg: 'bg-violet-100', iconText: 'text-violet-600', bar: 'bg-violet-500', tag: 'bg-violet-100 text-violet-700', avatarBg: 'bg-violet-100', avatarText: 'text-violet-700' },
  { ring: 'ring-blue-200', iconBg: 'bg-blue-100', iconText: 'text-blue-600', bar: 'bg-blue-500', tag: 'bg-blue-100 text-blue-700', avatarBg: 'bg-blue-100', avatarText: 'text-blue-700' },
  { ring: 'ring-emerald-200', iconBg: 'bg-emerald-100', iconText: 'text-emerald-600', bar: 'bg-emerald-500', tag: 'bg-emerald-100 text-emerald-700', avatarBg: 'bg-emerald-100', avatarText: 'text-emerald-700' },
  { ring: 'ring-amber-200', iconBg: 'bg-amber-100', iconText: 'text-amber-600', bar: 'bg-amber-500', tag: 'bg-amber-100 text-amber-700', avatarBg: 'bg-amber-100', avatarText: 'text-amber-700' },
  { ring: 'ring-rose-200', iconBg: 'bg-rose-100', iconText: 'text-rose-600', bar: 'bg-rose-500', tag: 'bg-rose-100 text-rose-700', avatarBg: 'bg-rose-100', avatarText: 'text-rose-700' },
  { ring: 'ring-cyan-200', iconBg: 'bg-cyan-100', iconText: 'text-cyan-600', bar: 'bg-cyan-500', tag: 'bg-cyan-100 text-cyan-700', avatarBg: 'bg-cyan-100', avatarText: 'text-cyan-700' },
  { ring: 'ring-fuchsia-200', iconBg: 'bg-fuchsia-100', iconText: 'text-fuchsia-600', bar: 'bg-fuchsia-500', tag: 'bg-fuchsia-100 text-fuchsia-700', avatarBg: 'bg-fuchsia-100', avatarText: 'text-fuchsia-700' },
];

function palette(index: number) {
  return CARD_PALETTE[index % CARD_PALETTE.length];
}

// useSearchParams must be inside a Suspense boundary — this inner component holds it
function RoleRightContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canView, canCreate, canUpdate, canDelete, loading: permLoading } = useResourcePermissions('role');
  const { canCreate: canCreateEmployee, loading: employeePermLoading } = useResourcePermissions('employee');
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<number | null>(null);
  const [stats, setStats] = useState<PermissionStats | null>(null);

  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'roles' | 'create-user' | 'manage-accounts'>(
    tabParam === 'create-user' ? 'create-user' : tabParam === 'manage-accounts' ? 'manage-accounts' : 'roles'
  );

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/roles');
      const data = await res.json();
      if (data.success) {
        setRoles(data.data || []);
        setStats(data.meta || null);
      }
    } catch (e) {
      console.error('Fetch error:', e);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const filteredRoles = roles.filter((role) =>
    role.title.toLowerCase().includes(search.toLowerCase()) ||
    (role.description || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`Are you sure you want to delete the "${title}" role?`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/roles/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) fetchRoles();
      else alert(data.error || 'Delete failed');
    } catch (e) {
      alert('Delete failed');
      console.error(e);
    } finally {
      setDeleting(null);
    }
  };

  const getPermissionCount = (role: Role) => role.permissions?.length || 0;
  const getPermissionPct = (role: Role) =>
    stats?.totalPermissions ? Math.round((getPermissionCount(role) / stats.totalPermissions) * 100) : 0;

  if (permLoading || employeePermLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view roles." />;

  const TABS = [
    { id: 'roles', label: 'Roles', icon: <FaShieldAlt className="w-3.5 h-3.5" /> },
    { id: 'create-user', label: 'Create User', icon: <FaUserPlus className="w-3.5 h-3.5" /> },
    { id: 'manage-accounts', label: 'Manage Accounts', icon: <FaKey className="w-3.5 h-3.5" /> },
  ] as const;

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        {/* Top row */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-9 h-9 rounded-xl bg-[#2E3093] flex items-center justify-center shadow-sm">
                <FaShieldAlt className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Role &amp; Access Management</h2>
            </div>
            <p className="text-sm text-gray-400 pl-0.5">Manage roles, permissions and user accounts</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canCreateEmployee && (
              <button
                onClick={() => router.push('/dashboard/masters/employee/add')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 font-medium text-sm transition-all"
              >
                <FaUsers className="w-3.5 h-3.5" /> Add Employee
              </button>
            )}
            {canCreate && (
              <button
                onClick={() => router.push('/dashboard/role-right/add')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2E3093] hover:bg-[#252780] text-white font-medium text-sm shadow-sm transition-all"
              >
                <FaPlus className="w-3.5 h-3.5" /> New Role
              </button>
            )}
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="flex items-center gap-3 rounded-xl bg-[#2E3093]/5 border border-[#2E3093]/15 px-4 py-3">
            <div className="w-9 h-9 rounded-lg bg-[#2E3093]/15 flex items-center justify-center">
              <FaShieldAlt className="w-4 h-4 text-[#2E3093]" />
            </div>
            <div>
              <div className="text-xl font-bold text-[#2E3093] leading-none">{roles.length}</div>
              <div className="text-xs text-gray-500 mt-0.5">Active Roles</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200/60 px-4 py-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
              <FaCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <div className="text-xl font-bold text-emerald-700 leading-none">{stats?.totalPermissions || 0}</div>
              <div className="text-xs text-gray-500 mt-0.5">Permissions</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200/60 px-4 py-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
              <FaKey className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <div className="text-xl font-bold text-amber-700 leading-none">{stats?.permissionGroups || 0}</div>
              <div className="text-xs text-gray-500 mt-0.5">Groups</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-[#2E3093] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      {activeTab === 'roles' ? (
        <>
          {/* Search bar */}
          <div className="relative max-w-sm">
            <FaSearch className="w-3.5 h-3.5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search roles…"
              className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-gray-300 shadow-sm"
            />
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gray-200" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 bg-gray-200 rounded w-2/3" />
                      <div className="h-3 bg-gray-100 rounded w-1/2" />
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full w-full" />
                </div>
              ))}
            </div>
          ) : filteredRoles.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <FaShieldAlt className="w-6 h-6 text-gray-300" />
              </div>
              <h3 className="text-base font-semibold text-gray-600 mb-1">No roles found</h3>
              <p className="text-sm text-gray-400">
                {search ? 'Try adjusting your search' : 'Create your first role to get started'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRoles.map((role, idx) => {
                const p = role.isSystemRole
                  ? { ring: 'ring-[#2E3093]/30', iconBg: 'bg-[#2E3093]', iconText: 'text-white', bar: 'bg-[#2E3093]', tag: 'bg-[#2E3093]/10 text-[#2E3093]', avatarBg: '', avatarText: '' }
                  : palette(idx);
                const pct = getPermissionPct(role);
                return (
                  <div
                    key={role.id}
                    className={`bg-white rounded-2xl border border-gray-100 ring-1 ${p.ring} shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden`}
                  >
                    {/* Card body */}
                    <div className="p-5 flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${p.iconBg}`}>
                            {role.isSystemRole
                              ? <FaLock className={`w-5 h-5 ${p.iconText}`} />
                              : <FaShieldAlt className={`w-5 h-5 ${p.iconText}`} />}
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 leading-snug">{role.title}</h3>
                            {role.isSystemRole && (
                              <span className={`inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${p.tag} mt-0.5`}>
                                System Role
                              </span>
                            )}
                          </div>
                        </div>
                        {!role.isSystemRole && (canUpdate || canDelete) && (
                          <div className="flex items-center gap-0.5 -mr-1">
                            {canUpdate && (
                              <button
                                onClick={() => router.push(`/dashboard/role-right/edit/${role.id}`)}
                                className="p-2 text-gray-300 hover:text-[#2E3093] hover:bg-gray-50 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <FaEdit className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => handleDelete(role.id, role.title)}
                                disabled={deleting === role.id}
                                className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                                title="Delete"
                              >
                                {deleting === role.id
                                  ? <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                  : <FaTrashAlt className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <p className="text-sm text-gray-400 line-clamp-2 mb-4 min-h-[2.5rem]">
                        {role.description || 'No description provided'}
                      </p>

                      {/* Progress */}
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-gray-400">Permissions</span>
                          <span className="font-semibold text-gray-600">
                            {getPermissionCount(role)}<span className="font-normal text-gray-400"> / {stats?.totalPermissions || 0}</span>
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${p.bar}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-gray-400 mt-1">{pct}% access</div>
                      </div>
                    </div>

                    {/* Card footer */}
                    <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
                      <button
                        onClick={() => router.push(`/dashboard/role-right/edit/${role.id}`)}
                        className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-[#2E3093] font-medium transition-colors"
                      >
                        View Permissions <FaChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : activeTab === 'create-user' ? (
        <CreateUser />
      ) : (
        <ManageAccounts />
      )}
    </div>
  );
}

export default function RoleRightPage() {
  return (
    <Suspense fallback={<PermissionLoading />}>
      <RoleRightContent />
    </Suspense>
  );
}

// ─────────────────────────────────────────
// Manage Accounts
// ─────────────────────────────────────────
function ManageAccounts() {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });

  const [editUser, setEditUser] = useState<any | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'role' | 'credentials'>('role');
  const [newRoleId, setNewRoleId] = useState<number>(0);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchUsers = useCallback((page = 1, q = '') => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '25', search: q });
    fetch(`/api/roles/users?${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setUsers(d.data || []);
          setPagination(p => ({ ...p, page, total: d.pagination?.total ?? 0, totalPages: d.pagination?.totalPages ?? 0 }));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch('/api/roles').then(r => r.json()).then(d => { if (d.success) setRoles(d.data || []); });
    fetchUsers();
  }, [fetchUsers]);

  const openEdit = (user: any) => {
    setEditUser(user);
    setNewRoleId(user.role_id || 0);
    setNewUsername(user.username || '');
    setNewPassword('');
    setShowPassword(false);
    setActiveModalTab('role');
    setError('');
    setSuccess('');
  };

  const handleUpdateRole = async () => {
    if (!newRoleId) { setError('Please select a role'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/roles/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: editUser.id, roleId: newRoleId }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('Role updated successfully');
        fetchUsers(pagination.page, search);
        setTimeout(() => setEditUser(null), 1200);
      } else setError(data.error || 'Failed to update role');
    } catch { setError('Failed to update role'); }
    finally { setSaving(false); }
  };

  const handleUpdateCredentials = async () => {
    if (!newUsername.trim() && !newPassword) { setError('Enter a new username or password'); return; }
    setSaving(true); setError('');
    try {
      const body: Record<string, string | number> = { userId: editUser.id };
      if (newUsername.trim()) body.username = newUsername.trim();
      if (newPassword) body.password = newPassword;
      const res = await fetch('/api/roles/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('Credentials updated');
        fetchUsers(pagination.page, search);
        setTimeout(() => setEditUser(null), 1200);
      } else setError(data.error || 'Failed to update credentials');
    } catch { setError('Failed to update credentials'); }
    finally { setSaving(false); }
  };

  const initials = (u: any) =>
    `${(u.firstname || '')[0] || ''}${(u.lastname || '')[0] || ''}`.toUpperCase() || 'U';

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <FaSearch className="w-3.5 h-3.5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); fetchUsers(1, e.target.value); }}
              placeholder="Search accounts…"
              className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-gray-300"
            />
          </div>
          <span className="text-xs text-gray-400 ml-auto">{pagination.total} account{pagination.total !== 1 ? 's' : ''}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-widest text-gray-400 bg-gray-50/70 border-b border-gray-100">
                <th className="text-left py-3 px-5 font-semibold">User</th>
                <th className="text-left py-3 px-5 font-semibold">Contact</th>
                <th className="text-left py-3 px-5 font-semibold">Role</th>
                <th className="text-right py-3 px-5 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                      Loading accounts…
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-gray-400">
                    <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                      <FaUsers className="w-5 h-5 text-gray-300" />
                    </div>
                    No accounts found
                  </td>
                </tr>
              ) : users.map((u, idx) => {
                const p = palette(idx);
                return (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold ${p.avatarBg} ${p.avatarText}`}>
                          {initials(u)}
                        </div>
                        <div>
                          <div className="font-medium text-gray-800">
                            {[u.firstname, u.lastname].filter(Boolean).join(' ') || u.username}
                          </div>
                          <div className="text-xs text-gray-400">ID #{u.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="text-sm text-gray-700">{u.email || '—'}</div>
                      <div className="text-xs text-gray-400">@{u.username}</div>
                    </td>
                    <td className="py-3.5 px-5">
                      {u.role_name ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#2E3093]/8 text-[#2E3093] border border-[#2E3093]/15">
                          <FaShieldAlt className="w-2.5 h-2.5" /> {u.role_name}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">No role assigned</span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <button
                        onClick={() => openEdit(u)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-[#2E3093]/30 hover:text-[#2E3093] hover:bg-[#2E3093]/5 text-xs font-medium transition-all"
                      >
                        <FaEdit className="w-3 h-3" /> Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="px-5 py-3.5 border-t border-gray-100 flex items-center justify-between">
            <div className="text-xs text-gray-400">
              {(pagination.page - 1) * 25 + 1}–{Math.min(pagination.page * 25, pagination.total)} of {pagination.total}
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => fetchUsers(pagination.page - 1, search)}
                disabled={pagination.page === 1}
                className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => fetchUsers(pagination.page + 1, search)}
                disabled={pagination.page === pagination.totalPages}
                className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Edit Modal ── */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && setEditUser(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#2E3093]/10 flex items-center justify-center">
                  <FaKey className="w-4 h-4 text-[#2E3093]" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Edit Account</h3>
                  <p className="text-xs text-gray-400">{[editUser.firstname, editUser.lastname].filter(Boolean).join(' ') || editUser.username}</p>
                </div>
              </div>
              <button onClick={() => !saving && setEditUser(null)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                <FaTimes className="w-4 h-4" />
              </button>
            </div>

            {/* Modal tabs */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 mx-6 mt-4">
              {(['role', 'credentials'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => { setActiveModalTab(t); setError(''); setSuccess(''); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                    activeModalTab === t ? 'bg-white text-[#2E3093] shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t === 'role' ? <><FaShieldAlt className="w-3 h-3" /> Change Role</> : <><FaKey className="w-3 h-3" /> Credentials</>}
                </button>
              ))}
            </div>

            <div className="px-6 py-5 space-y-4">
              {success && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700">
                  <FaCheck className="w-4 h-4 shrink-0" /> {success}
                </div>
              )}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
              )}

              {activeModalTab === 'role' ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Current Role</label>
                    <div className="text-sm text-gray-700 bg-gray-50 rounded-xl px-3.5 py-2.5 border border-gray-200">
                      {editUser.role_name || <span className="text-gray-400 italic">None assigned</span>}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      Assign New Role <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={newRoleId}
                      onChange={e => setNewRoleId(parseInt(e.target.value))}
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] bg-white"
                    >
                      <option value={0}>Select a role…</option>
                      {roles.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setEditUser(null)} disabled={saving}
                      className="flex-1 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-600">
                      Cancel
                    </button>
                    <button onClick={handleUpdateRole} disabled={saving || newRoleId === 0}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#2E3093] hover:bg-[#252780] text-white text-sm font-semibold disabled:opacity-50">
                      {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FaShieldAlt className="w-3.5 h-3.5" />}
                      Update Role
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Password Hash</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 text-xs font-mono text-gray-500 bg-gray-50 rounded-xl px-3.5 py-2.5 border border-gray-200 truncate">
                        {editUser.password || '—'}
                      </div>
                      <button onClick={() => navigator.clipboard.writeText(editUser.password || '')}
                        className="p-2.5 text-gray-400 hover:text-[#2E3093] hover:bg-gray-100 rounded-xl transition-colors" title="Copy">
                        <FaCopy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">Stored as MD5 — not reversible.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">New Username</label>
                    <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)}
                      placeholder="Enter new username"
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">New Password</label>
                    <div className="relative">
                      <input type={showPassword ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]" />
                      <button type="button" onClick={() => setShowPassword(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPassword ? <FaEyeSlash className="w-4 h-4" /> : <FaEye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">Leave blank to keep existing password.</p>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setEditUser(null)} disabled={saving}
                      className="flex-1 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-600">
                      Cancel
                    </button>
                    <button onClick={handleUpdateCredentials} disabled={saving || (!newUsername.trim() && !newPassword)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#2E3093] hover:bg-[#252780] text-white text-sm font-semibold disabled:opacity-50">
                      {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FaKey className="w-3.5 h-3.5" />}
                      Update
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────
// Generate password helper
// ─────────────────────────────────────────
function generatePassword(length = 12): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%&*';
  const all = upper + lower + digits + special;
  let password = upper[Math.floor(Math.random() * upper.length)]
    + lower[Math.floor(Math.random() * lower.length)]
    + digits[Math.floor(Math.random() * digits.length)]
    + special[Math.floor(Math.random() * special.length)];
  for (let i = 4; i < length; i++) password += all[Math.floor(Math.random() * all.length)];
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// ─────────────────────────────────────────
// Create User
// ─────────────────────────────────────────
function CreateUser() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('without_account');
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });

  const [showModal, setShowModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [formData, setFormData] = useState({ username: '', password: '', email: '', firstname: '', lastname: '', mobile: '', roleId: 0 });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ username: string; password: string; email: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/roles').then(r => r.json()).then(d => { if (d.success) setRoles(d.data || []); });
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(pagination.page), limit: String(pagination.limit), search, filter });
    fetch(`/api/roles/users/create?${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setEmployees(d.data || []);
          setPagination(prev => ({ ...prev, ...d.pagination }));
        }
      })
      .finally(() => setLoading(false));
  }, [pagination.page, pagination.limit, search, filter]);

  const openCreateModal = (employee: any) => {
    const parts = (employee.Employee_Name || '').trim().split(/\s+/);
    setSelectedEmployee(employee);
    setFormData({
      username: employee.UserId || employee.EMail?.split('@')[0] || '',
      password: generatePassword(),
      email: employee.EMail || '',
      firstname: parts[0] || '',
      lastname: parts.slice(1).join(' ') || '',
      mobile: employee.Present_Mobile || '',
      roleId: roles.length > 0 ? roles[0].id : 0,
    });
    setShowPassword(false);
    setError('');
    setSuccessInfo(null);
    setShowModal(true);
  };

  const handleCreateUser = async () => {
    setError('');
    if (!formData.username.trim()) { setError('Username is required'); return; }
    if (!formData.password) { setError('Password is required'); return; }
    if (formData.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (!formData.email.trim()) { setError('Email is required'); return; }
    if (!formData.roleId) { setError('Please select a role'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/roles/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: selectedEmployee.Emp_Id,
          username: formData.username.trim(),
          password: formData.password,
          email: formData.email.trim(),
          roleId: formData.roleId,
          firstname: formData.firstname.trim(),
          lastname: formData.lastname.trim(),
          mobile: formData.mobile.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessInfo({ username: formData.username.trim(), password: formData.password, email: formData.email.trim() });
        const params = new URLSearchParams({ page: String(pagination.page), limit: String(pagination.limit), search, filter });
        fetch(`/api/roles/users/create?${params}`).then(r => r.json()).then(d => {
          if (d.success) { setEmployees(d.data || []); setPagination(prev => ({ ...prev, ...d.pagination })); }
        });
      } else setError(data.error || 'Failed to create user account');
    } catch { setError('Failed to create user account'); }
    finally { setSaving(false); }
  };

  const copy = (text: string) => navigator.clipboard.writeText(text);

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <FaSearch className="w-3.5 h-3.5 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
              placeholder="Search employees…"
              className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-gray-300"
            />
          </div>
          <select
            value={filter}
            onChange={e => { setFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            className="border border-gray-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] bg-white text-gray-600"
          >
            <option value="all">All Employees</option>
            <option value="without_account">No Account</option>
            <option value="with_account">Has Account</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-widest text-gray-400 bg-gray-50/70 border-b border-gray-100">
                <th className="text-left py-3 px-5 font-semibold">Employee</th>
                <th className="text-left py-3 px-5 font-semibold">Email</th>
                <th className="text-left py-3 px-5 font-semibold">Designation</th>
                <th className="text-left py-3 px-5 font-semibold">Status</th>
                <th className="text-right py-3 px-5 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
                      Loading employees…
                    </div>
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400">
                    <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                      <FaUsers className="w-5 h-5 text-gray-300" />
                    </div>
                    No employees found
                  </td>
                </tr>
              ) : employees.map((emp, idx) => {
                const p = palette(idx);
                const initials = (emp.Employee_Name || '').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();
                return (
                  <tr key={emp.Emp_Id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold ${p.avatarBg} ${p.avatarText}`}>
                          {initials}
                        </div>
                        <div>
                          <div className="font-medium text-gray-800">{emp.Employee_Name}</div>
                          <div className="text-xs text-gray-400">{emp.Emp_Code ? `${emp.Emp_Code}` : `#${emp.Emp_Id}`}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-5 text-gray-500 text-sm">{emp.EMail || '—'}</td>
                    <td className="py-3.5 px-5 text-gray-500 text-sm">{emp.Designation || '—'}</td>
                    <td className="py-3.5 px-5">
                      {emp.user_id ? (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <FaCheck className="w-2.5 h-2.5" /> Has Account
                          </span>
                          <div className="text-xs text-gray-400 mt-1">@{emp.user_username} · {emp.user_role_name || 'No Role'}</div>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          <FaTimes className="w-2.5 h-2.5" /> No Account
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      {emp.user_id ? (
                        <span className="text-xs text-gray-300">Already created</span>
                      ) : (
                        <button
                          onClick={() => openCreateModal(emp)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2E3093] hover:bg-[#252780] text-white text-xs font-medium transition-all shadow-sm"
                        >
                          <FaUserPlus className="w-3 h-3" /> Create
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="px-5 py-3.5 border-t border-gray-100 flex items-center justify-between">
            <div className="text-xs text-gray-400">
              Showing {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page === 1}
                className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page === pagination.totalPages}
                className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create User Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#2E3093]/10 flex items-center justify-center">
                    <FaUserPlus className="w-4 h-4 text-[#2E3093]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">Create User Account</h3>
                    <p className="text-xs text-gray-400">for {selectedEmployee?.Employee_Name}</p>
                  </div>
                </div>
                <button onClick={() => !saving && setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                  <FaTimes className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="px-6 py-5">
              {successInfo ? (
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                      <FaCheck className="w-5 h-5 text-emerald-600" />
                    </div>
                    <h4 className="font-semibold text-emerald-800 mb-1">Account Created!</h4>
                    <p className="text-sm text-emerald-600">Save these credentials — the password cannot be retrieved later.</p>
                  </div>

                  <div className="rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                    {[
                      { label: 'Username', value: successInfo.username },
                      { label: 'Password', value: successInfo.password },
                      { label: 'Email', value: successInfo.email },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50">
                        <div>
                          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">{label}</div>
                          <div className="font-mono text-sm font-medium text-gray-800">{value}</div>
                        </div>
                        <button onClick={() => copy(value)} className="p-2 text-gray-400 hover:text-[#2E3093] rounded-lg" title="Copy">
                          <FaCopy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => copy(`Username: ${successInfo.username}\nPassword: ${successInfo.password}\nEmail: ${successInfo.email}`)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#2E3093]/8 hover:bg-[#2E3093]/15 text-[#2E3093] text-sm font-medium"
                  >
                    <FaCopy className="w-4 h-4" /> Copy All
                  </button>
                  <button
                    onClick={() => setShowModal(false)}
                    className="w-full py-2.5 rounded-xl bg-[#2E3093] hover:bg-[#252780] text-white text-sm font-semibold"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">First Name</label>
                      <input type="text" value={formData.firstname} onChange={e => setFormData({ ...formData, firstname: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">Last Name</label>
                      <input type="text" value={formData.lastname} onChange={e => setFormData({ ...formData, lastname: e.target.value })}
                        className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Email <span className="text-red-400">*</span></label>
                    <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                      placeholder="employee@example.com"
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Username <span className="text-red-400">*</span></label>
                    <input type="text" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })}
                      placeholder="Choose a username"
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Password <span className="text-red-400">*</span></label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password}
                          onChange={e => setFormData({ ...formData, password: e.target.value })}
                          placeholder="Min 6 characters"
                          className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
                        />
                        <button type="button" onClick={() => setShowPassword(p => !p)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showPassword ? <FaEyeSlash className="w-4 h-4" /> : <FaEye className="w-4 h-4" />}
                        </button>
                      </div>
                      <button type="button" onClick={() => setFormData({ ...formData, password: generatePassword() })}
                        className="px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs text-gray-600 font-medium whitespace-nowrap">
                        Generate
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Mobile</label>
                    <input type="text" value={formData.mobile} onChange={e => setFormData({ ...formData, mobile: e.target.value })}
                      placeholder="Phone number"
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Assign Role <span className="text-red-400">*</span></label>
                    <select value={formData.roleId} onChange={e => setFormData({ ...formData, roleId: parseInt(e.target.value) })}
                      className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] bg-white">
                      <option value={0}>Select a role…</option>
                      {roles.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
                    </select>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setShowModal(false)} disabled={saving}
                      className="flex-1 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-600">
                      Cancel
                    </button>
                    <button onClick={handleCreateUser} disabled={saving}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#2E3093] hover:bg-[#252780] text-white text-sm font-semibold disabled:opacity-50">
                      {saving
                        ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <FaUserPlus className="w-3.5 h-3.5" />}
                      Create Account
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
