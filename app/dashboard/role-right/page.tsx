'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FaPlus, FaEdit, FaTrashAlt, FaSearch, FaUsers, FaShieldAlt, FaChevronRight, FaCheck, FaTimes } from 'react-icons/fa';

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

export default function RoleRightPage() {
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<number | null>(null);
  const [stats, setStats] = useState<PermissionStats | null>(null);
  const [activeTab, setActiveTab] = useState<'roles' | 'users'>('roles');

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

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

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
      if (data.success) {
        fetchRoles();
      } else {
        alert(data.error || 'Delete failed');
      }
    } catch (e) {
      alert('Delete failed');
      console.error(e);
    } finally {
      setDeleting(null);
    }
  };

  const getPermissionCount = (role: Role) => {
    return role.permissions?.length || 0;
  };

  const getPermissionPercentage = (role: Role) => {
    if (!stats?.totalPermissions) return 0;
    return Math.round((getPermissionCount(role) / stats.totalPermissions) * 100);
  };

  return (
    <div className="space-y-3">
      {/* Header Container */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex flex-col gap-4">
          {/* Title Row */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <FaShieldAlt className="w-5 h-5 text-[#2E3093]" />
                <h2 className="text-lg font-bold text-gray-800">Role & Access Management</h2>
              </div>
              <p className="text-sm text-gray-400 mt-1">
                Manage roles and permissions for users
              </p>
            </div>
            {/* Add Button */}
            <button
              onClick={() => router.push('/dashboard/role-right/add')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2E3093] hover:bg-[#252780] text-white font-semibold text-sm shadow-sm transition-colors"
            >
              <FaPlus className="w-4 h-4" /> Add Role
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-[#2E3093]/10 to-[#2E3093]/5 rounded-lg p-3 border border-[#2E3093]/20">
              <div className="text-2xl font-bold text-[#2E3093]">{roles.length}</div>
              <div className="text-xs text-gray-600">Active Roles</div>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-lg p-3 border border-emerald-200">
              <div className="text-2xl font-bold text-emerald-600">{stats?.totalPermissions || 0}</div>
              <div className="text-xs text-gray-600">Total Permissions</div>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-lg p-3 border border-amber-200">
              <div className="text-2xl font-bold text-amber-600">{stats?.permissionGroups || 0}</div>
              <div className="text-xs text-gray-600">Permission Groups</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('roles')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'roles'
                  ? 'border-[#2E3093] text-[#2E3093]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <FaShieldAlt className="w-4 h-4" /> Roles
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'users'
                  ? 'border-[#2E3093] text-[#2E3093]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <FaUsers className="w-4 h-4" /> User Assignments
            </button>
          </div>

          {/* Search */}
          {activeTab === 'roles' && (
            <div className="relative max-w-md">
              <FaSearch className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search roles..."
                className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-gray-300 bg-white shadow-sm"
              />
            </div>
          )}
        </div>
      </div>

      {/* Content Area */}
      {activeTab === 'roles' ? (
        /* Roles Grid */
        loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
                <div className="h-3 bg-gray-100 rounded w-3/4 mb-4"></div>
                <div className="h-2 bg-gray-100 rounded w-full"></div>
              </div>
            ))}
          </div>
        ) : filteredRoles.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <FaShieldAlt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-600 mb-1">No roles found</h3>
            <p className="text-sm text-gray-400">
              {search ? 'Try adjusting your search' : 'Create your first role to get started'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRoles.map((role) => (
              <div
                key={role.id}
                className={`bg-white rounded-xl border shadow-sm overflow-hidden hover:shadow-md transition-shadow ${
                  role.isSystemRole ? 'border-[#2E3093]/30' : 'border-gray-200'
                }`}
              >
                {/* Card Header */}
                <div className={`p-4 ${role.isSystemRole ? 'bg-gradient-to-r from-[#2E3093]/5 to-transparent' : ''}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        role.isSystemRole 
                          ? 'bg-[#2E3093] text-white' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        <FaShieldAlt className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800">{role.title}</h3>
                        {role.isSystemRole && (
                          <span className="text-xs text-[#2E3093] bg-[#2E3093]/10 px-1.5 py-0.5 rounded-full">
                            System Role
                          </span>
                        )}
                      </div>
                    </div>
                    {!role.isSystemRole && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => router.push(`/dashboard/role-right/edit/${role.id}`)}
                          className="p-2 text-gray-400 hover:text-[#2E3093] hover:bg-gray-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <FaEdit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(role.id, role.title)}
                          disabled={deleting === role.id}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          {deleting === role.id ? (
                            <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <FaTrashAlt className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 line-clamp-2">
                    {role.description || 'No description provided'}
                  </p>
                </div>

                {/* Permission Progress */}
                <div className="px-4 pb-4">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-gray-500">Permissions</span>
                    <span className="font-medium text-gray-700">
                      {getPermissionCount(role)} / {stats?.totalPermissions || 0}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        getPermissionPercentage(role) === 100
                          ? 'bg-[#2E3093]'
                          : getPermissionPercentage(role) > 50
                          ? 'bg-emerald-500'
                          : 'bg-amber-500'
                      }`}
                      style={{ width: `${getPermissionPercentage(role)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                  <button
                    onClick={() => router.push(`/dashboard/role-right/edit/${role.id}`)}
                    className="w-full flex items-center justify-center gap-2 text-sm text-[#2E3093] hover:text-[#252780] font-medium"
                  >
                    View Permissions <FaChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Users Tab */
        <UserAssignments />
      )}
    </div>
  );
}

// User Assignments Component
function UserAssignments() {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [editingUser, setEditingUser] = useState<number | null>(null);
  const [newRoleId, setNewRoleId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });

  useEffect(() => {
    // Fetch roles for dropdown
    fetch('/api/roles')
      .then(res => res.json())
      .then(data => {
        if (data.success) setRoles(data.data);
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(pagination.page),
      limit: String(pagination.limit),
      search,
      ...(selectedRole && { role: selectedRole }),
    });
    fetch(`/api/roles/users?${params}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setUsers(data.data);
          setPagination(prev => ({ ...prev, ...data.pagination }));
        }
      })
      .finally(() => setLoading(false));
  }, [pagination.page, pagination.limit, search, selectedRole]);

  const handleSaveRole = async (userId: number) => {
    if (!newRoleId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/roles/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, roleId: newRoleId }),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh users
        setUsers(users.map(u => 
          u.id === userId ? { ...u, role_id: newRoleId, role_name: roles.find(r => r.id === newRoleId)?.title } : u
        ));
        setEditingUser(null);
        setNewRoleId(null);
      } else {
        alert(data.error || 'Failed to update role');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Filters */}
      <div className="p-4 border-b border-gray-100 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <FaSearch className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            placeholder="Search users..."
            className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-gray-300 bg-white"
          />
        </div>
        <select
          value={selectedRole}
          onChange={(e) => {
            setSelectedRole(e.target.value);
            setPagination(prev => ({ ...prev, page: 1 }));
          }}
          className="border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] bg-white"
        >
          <option value="">All Roles</option>
          {roles.map(role => (
            <option key={role.id} value={role.id}>{role.title}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="dashboard-table w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-100">
              <th className="text-left py-3 px-4 font-semibold">User</th>
              <th className="text-left py-3 px-4 font-semibold">Email</th>
              <th className="text-left py-3 px-4 font-semibold">Current Role</th>
              <th className="text-center py-3 px-4 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-gray-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin"></div>
                    Loading users...
                  </div>
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-gray-400">
                  No users found
                </td>
              </tr>
            ) : (
              users.map(user => (
                <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#2E3093]/10 flex items-center justify-center text-[#2E3093] text-xs font-bold">
                        {(user.firstname?.[0] || '') + (user.lastname?.[0] || '')}
                      </div>
                      <div>
                        <div className="font-medium text-gray-800">
                          {user.firstname} {user.lastname}
                        </div>
                        <div className="text-xs text-gray-400">@{user.username}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-600">{user.email}</td>
                  <td className="py-3 px-4">
                    {editingUser === user.id ? (
                      <select
                        value={newRoleId || user.role_id}
                        onChange={(e) => setNewRoleId(parseInt(e.target.value))}
                        className="border border-[#2E3093] rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 bg-white"
                        autoFocus
                      >
                        {roles.map(role => (
                          <option key={role.id} value={role.id}>{role.title}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        user.role_id === 1 
                          ? 'bg-[#2E3093]/10 text-[#2E3093]' 
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {user.role_name || 'No Role'}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-1">
                      {editingUser === user.id ? (
                        <>
                          <button
                            onClick={() => handleSaveRole(user.id)}
                            disabled={saving || !newRoleId || newRoleId === user.role_id}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Save"
                          >
                            {saving ? (
                              <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <FaCheck className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setEditingUser(null);
                              setNewRoleId(null);
                            }}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Cancel"
                          >
                            <FaTimes className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingUser(user.id);
                            setNewRoleId(user.role_id);
                          }}
                          className="p-2 text-gray-400 hover:text-[#2E3093] hover:bg-gray-100 rounded-lg transition-colors"
                          title="Change Role"
                        >
                          <FaEdit className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="p-4 border-t border-gray-100 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              disabled={pagination.page === 1}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              disabled={pagination.page === pagination.totalPages}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
