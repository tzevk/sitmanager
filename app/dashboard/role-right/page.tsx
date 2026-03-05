'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FaPlus, FaEdit, FaTrashAlt, FaSearch, FaShieldAlt, FaChevronRight, FaCheck, FaTimes, FaUserPlus, FaUsers, FaKey, FaEye, FaEyeSlash, FaCopy } from 'react-icons/fa';
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

export default function RoleRightPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canView, canCreate, canUpdate, canDelete, loading: permLoading } = useResourcePermissions('role');
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<number | null>(null);
  const [stats, setStats] = useState<PermissionStats | null>(null);
  
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'roles' | 'create-user'>(
    tabParam === 'create-user' ? 'create-user' : 'roles'
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

  if (permLoading) return <PermissionLoading />;
  if (!canView) return <AccessDenied message="You do not have permission to view roles." />;

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
            {canCreate && (
            <button
              onClick={() => router.push('/dashboard/role-right/add')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2E3093] hover:bg-[#252780] text-white font-semibold text-sm shadow-sm transition-colors"
            >
              <FaPlus className="w-4 h-4" /> Add Role
            </button>
            )}
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
              onClick={() => setActiveTab('create-user')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'create-user'
                  ? 'border-[#2E3093] text-[#2E3093]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <FaUserPlus className="w-4 h-4" /> Create User
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
                    {!role.isSystemRole && (canUpdate || canDelete) && (
                      <div className="flex items-center gap-1">
                        {canUpdate && (
                        <button
                          onClick={() => router.push(`/dashboard/role-right/edit/${role.id}`)}
                          className="p-2 text-gray-400 hover:text-[#2E3093] hover:bg-gray-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <FaEdit className="w-4 h-4" />
                        </button>
                        )}
                        {canDelete && (
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
                        )}
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
        /* Create User Tab */
        <CreateUser />
      )}
    </div>
  );
}

// Generate a random password
function generatePassword(length = 12): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%&*';
  const all = upper + lower + digits + special;
  // Ensure at least one of each type
  let password = '';
  password += upper[Math.floor(Math.random() * upper.length)];
  password += lower[Math.floor(Math.random() * lower.length)];
  password += digits[Math.floor(Math.random() * digits.length)];
  password += special[Math.floor(Math.random() * special.length)];
  for (let i = 4; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }
  // Shuffle
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// Create User Component
function CreateUser() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('without_account');
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    firstname: '',
    lastname: '',
    mobile: '',
    roleId: 0,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ username: string; password: string; email: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // Fetch roles for dropdown
    fetch('/api/roles')
      .then(res => res.json())
      .then(data => {
        if (data.success) setRoles(data.data || []);
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(pagination.page),
      limit: String(pagination.limit),
      search,
      filter,
    });
    fetch(`/api/roles/users/create?${params}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setEmployees(data.data || []);
          setPagination(prev => ({ ...prev, ...data.pagination }));
        }
      })
      .finally(() => setLoading(false));
  }, [pagination.page, pagination.limit, search, filter]);

  const openCreateModal = (employee: any) => {
    const nameParts = (employee.Employee_Name || '').trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    const generatedPassword = generatePassword();

    setSelectedEmployee(employee);
    setFormData({
      username: employee.UserId || employee.EMail?.split('@')[0] || '',
      password: generatedPassword,
      email: employee.EMail || '',
      firstname: firstName,
      lastname: lastName,
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
        setSuccessInfo({
          username: formData.username.trim(),
          password: formData.password,
          email: formData.email.trim(),
        });
        // Refresh employee list
        const params = new URLSearchParams({
          page: String(pagination.page),
          limit: String(pagination.limit),
          search,
          filter,
        });
        fetch(`/api/roles/users/create?${params}`)
          .then(r => r.json())
          .then(d => {
            if (d.success) {
              setEmployees(d.data || []);
              setPagination(prev => ({ ...prev, ...d.pagination }));
            }
          });
      } else {
        setError(data.error || 'Failed to create user account');
      }
    } catch {
      setError('Failed to create user account');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <>
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
              placeholder="Search employees..."
              className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] placeholder:text-gray-300 bg-white"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            className="border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] bg-white"
          >
            <option value="all">All Employees</option>
            <option value="without_account">Without User Account</option>
            <option value="with_account">With User Account</option>
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="dashboard-table w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-100">
                <th className="text-left py-3 px-4 font-semibold">Employee</th>
                <th className="text-left py-3 px-4 font-semibold">Email</th>
                <th className="text-left py-3 px-4 font-semibold">Designation</th>
                <th className="text-left py-3 px-4 font-semibold">Account Status</th>
                <th className="text-center py-3 px-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin"></div>
                      Loading employees...
                    </div>
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400">
                    <FaUsers className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                    No employees found
                  </td>
                </tr>
              ) : (
                employees.map(emp => (
                  <tr key={emp.Emp_Id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#2E3093]/10 flex items-center justify-center text-[#2E3093] text-xs font-bold">
                          {(emp.Employee_Name || '').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-gray-800">{emp.Employee_Name}</div>
                          <div className="text-xs text-gray-400">
                            {emp.Emp_Code ? `Code: ${emp.Emp_Code}` : `ID: ${emp.Emp_Id}`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-600 text-sm">{emp.EMail || '—'}</td>
                    <td className="py-3 px-4 text-gray-600 text-sm">{emp.Designation || '—'}</td>
                    <td className="py-3 px-4">
                      {emp.user_id ? (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <FaCheck className="w-3 h-3" /> Has Account
                          </span>
                          <div className="text-xs text-gray-400 mt-1">
                            @{emp.user_username} · {emp.user_role_name || 'No Role'}
                          </div>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          <FaTimes className="w-3 h-3" /> No Account
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center">
                        {emp.user_id ? (
                          <span className="text-xs text-gray-300">Already created</span>
                        ) : (
                          <button
                            onClick={() => openCreateModal(emp)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2E3093] hover:bg-[#252780] text-white text-xs font-medium transition-colors shadow-sm"
                          >
                            <FaUserPlus className="w-3 h-3" /> Create Account
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

      {/* Create User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => !saving && setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#2E3093]/10 flex items-center justify-center">
                    <FaUserPlus className="w-5 h-5 text-[#2E3093]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">Create User Account</h3>
                    <p className="text-sm text-gray-400">for {selectedEmployee?.Employee_Name}</p>
                  </div>
                </div>
                <button
                  onClick={() => !saving && setShowModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <FaTimes className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5">
              {successInfo ? (
                /* Success View */
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                      <FaCheck className="w-6 h-6 text-emerald-600" />
                    </div>
                    <h4 className="font-semibold text-emerald-800 mb-1">Account Created Successfully!</h4>
                    <p className="text-sm text-emerald-600">Save these credentials — the password cannot be retrieved later.</p>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-gray-400 uppercase tracking-wider">Username</div>
                        <div className="font-mono font-medium text-gray-800">{successInfo.username}</div>
                      </div>
                      <button
                        onClick={() => copyToClipboard(successInfo.username)}
                        className="p-2 text-gray-400 hover:text-[#2E3093] hover:bg-white rounded-lg transition-colors"
                        title="Copy username"
                      >
                        <FaCopy className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="border-t border-gray-200"></div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-gray-400 uppercase tracking-wider">Password</div>
                        <div className="font-mono font-medium text-gray-800">{successInfo.password}</div>
                      </div>
                      <button
                        onClick={() => copyToClipboard(successInfo.password)}
                        className="p-2 text-gray-400 hover:text-[#2E3093] hover:bg-white rounded-lg transition-colors"
                        title="Copy password"
                      >
                        <FaCopy className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="border-t border-gray-200"></div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-gray-400 uppercase tracking-wider">Email</div>
                        <div className="font-mono font-medium text-gray-800 text-sm">{successInfo.email}</div>
                      </div>
                      <button
                        onClick={() => copyToClipboard(successInfo.email)}
                        className="p-2 text-gray-400 hover:text-[#2E3093] hover:bg-white rounded-lg transition-colors"
                        title="Copy email"
                      >
                        <FaCopy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => copyToClipboard(`Username: ${successInfo.username}\nPassword: ${successInfo.password}\nEmail: ${successInfo.email}`)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#2E3093]/10 hover:bg-[#2E3093]/20 text-[#2E3093] text-sm font-medium transition-colors"
                  >
                    <FaCopy className="w-4 h-4" /> Copy All Credentials
                  </button>

                  <button
                    onClick={() => setShowModal(false)}
                    className="w-full px-4 py-2.5 rounded-lg bg-[#2E3093] hover:bg-[#252780] text-white text-sm font-semibold transition-colors"
                  >
                    Done
                  </button>
                </div>
              ) : (
                /* Form View */
                <div className="space-y-4">
                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">First Name</label>
                      <input
                        type="text"
                        value={formData.firstname}
                        onChange={(e) => setFormData({ ...formData, firstname: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Last Name</label>
                      <input
                        type="text"
                        value={formData.lastname}
                        onChange={(e) => setFormData({ ...formData, lastname: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Email <span className="text-red-500">*</span></label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
                      placeholder="employee@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Username <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
                      placeholder="Choose a username"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Password <span className="text-red-500">*</span></label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
                          placeholder="Min 6 characters"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? <FaEyeSlash className="w-4 h-4" /> : <FaEye className="w-4 h-4" />}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, password: generatePassword() })}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs text-gray-600 font-medium transition-colors whitespace-nowrap"
                      >
                        <FaKey className="w-3 h-3" /> Generate
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Mobile</label>
                    <input
                      type="text"
                      value={formData.mobile}
                      onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
                      placeholder="Phone number"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Assign Role <span className="text-red-500">*</span></label>
                    <select
                      value={formData.roleId}
                      onChange={(e) => setFormData({ ...formData, roleId: parseInt(e.target.value) })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] bg-white"
                    >
                      <option value={0}>Select a role...</option>
                      {roles.map(role => (
                        <option key={role.id} value={role.id}>{role.title}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowModal(false)}
                      disabled={saving}
                      className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-600 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateUser}
                      disabled={saving}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#2E3093] hover:bg-[#252780] text-white text-sm font-semibold transition-colors disabled:opacity-60"
                    >
                      {saving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Creating...
                        </>
                      ) : (
                        <>
                          <FaUserPlus className="w-4 h-4" /> Create Account
                        </>
                      )}
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
