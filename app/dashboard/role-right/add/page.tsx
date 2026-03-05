'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useResourcePermissions } from '@/lib/permissions-context';
import { AccessDenied, PermissionLoading } from '@/components/ui/PermissionGate';
import { 
  FaShieldAlt, FaSave, FaTimes, FaChevronDown, FaChevronUp, 
  FaCheckSquare, FaSquare, FaMinusSquare, FaSearch, FaInfoCircle,
  FaCog, FaDatabase, FaGraduationCap, FaCalendarAlt, FaChartBar,
  FaBook, FaUsers, FaWallet, FaWrench, FaBriefcase
} from 'react-icons/fa';

// Icon mapping for permission groups
const GroupIcon = ({ icon }: { icon: string }) => {
  const iconClass = "w-5 h-5";
  switch (icon) {
    case 'settings': return <FaCog className={iconClass} />;
    case 'database': return <FaDatabase className={iconClass} />;
    case 'graduation': return <FaGraduationCap className={iconClass} />;
    case 'calendar': return <FaCalendarAlt className={iconClass} />;
    case 'chart': return <FaChartBar className={iconClass} />;
    case 'book': return <FaBook className={iconClass} />;
    case 'shield': return <FaShieldAlt className={iconClass} />;
    case 'users': return <FaUsers className={iconClass} />;
    case 'wallet': return <FaWallet className={iconClass} />;
    case 'wrench': return <FaWrench className={iconClass} />;
    case 'briefcase': return <FaBriefcase className={iconClass} />;
    default: return <FaCog className={iconClass} />;
  }
};

interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
}

interface PermissionGroup {
  id: string;
  name: string;
  description: string;
  icon: string;
  permissions: Permission[];
}

interface Stats {
  totalPermissions: number;
  byAction: {
    view: number;
    create: number;
    update: number;
    delete: number;
    export: number;
    manage: number;
  };
}

export default function AddRolePage() {
  const router = useRouter();
  const { canCreate, loading: permLoading } = useResourcePermissions('role');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState<string>('');

  useEffect(() => {
    fetch('/api/roles/permissions')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setPermissionGroups(data.data);
          setStats(data.stats);
          // Expand first group by default
          if (data.data.length > 0) {
            setExpandedGroups(new Set([data.data[0].id]));
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const togglePermission = (permissionId: string) => {
    const newSelected = new Set(selectedPermissions);
    if (newSelected.has(permissionId)) {
      newSelected.delete(permissionId);
    } else {
      newSelected.add(permissionId);
    }
    setSelectedPermissions(newSelected);
  };

  const toggleGroupAll = (group: PermissionGroup) => {
    const groupPermissionIds = group.permissions.map(p => p.id);
    const allSelected = groupPermissionIds.every(id => selectedPermissions.has(id));
    
    const newSelected = new Set(selectedPermissions);
    if (allSelected) {
      groupPermissionIds.forEach(id => newSelected.delete(id));
    } else {
      groupPermissionIds.forEach(id => newSelected.add(id));
    }
    setSelectedPermissions(newSelected);
  };

  const selectAll = () => {
    const allIds = permissionGroups.flatMap(g => g.permissions.map(p => p.id));
    setSelectedPermissions(new Set(allIds));
  };

  const deselectAll = () => {
    setSelectedPermissions(new Set());
  };

  const selectByAction = (action: string) => {
    const actionPermissions = permissionGroups
      .flatMap(g => g.permissions)
      .filter(p => p.action === action)
      .map(p => p.id);
    const newSelected = new Set(selectedPermissions);
    actionPermissions.forEach(id => newSelected.add(id));
    setSelectedPermissions(newSelected);
  };

  const getGroupSelectionState = (group: PermissionGroup) => {
    const groupPermissionIds = group.permissions.map(p => p.id);
    const selectedCount = groupPermissionIds.filter(id => selectedPermissions.has(id)).length;
    
    if (selectedCount === 0) return 'none';
    if (selectedCount === groupPermissionIds.length) return 'all';
    return 'partial';
  };

  const getFilteredGroups = () => {
    if (!search && !filterAction) return permissionGroups;
    
    return permissionGroups.map(group => ({
      ...group,
      permissions: group.permissions.filter(p => {
        const matchesSearch = !search || 
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.description.toLowerCase().includes(search.toLowerCase()) ||
          p.resource.toLowerCase().includes(search.toLowerCase());
        const matchesAction = !filterAction || p.action === filterAction;
        return matchesSearch && matchesAction;
      }),
    })).filter(group => group.permissions.length > 0);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Please enter a role name');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          permissions: Array.from(selectedPermissions),
        }),
      });

      const data = await res.json();
      if (data.success) {
        router.push('/dashboard/role-right');
      } else {
        alert(data.error || 'Failed to create role');
      }
    } catch (e) {
      alert('Failed to create role');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const filteredGroups = getFilteredGroups();

  if (permLoading) return <PermissionLoading />;
  if (!canCreate) return <AccessDenied message="You do not have permission to create roles." />;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div>
            <nav className="flex items-center gap-2 text-sm text-gray-500 mb-2">
              <Link href="/dashboard" className="hover:text-[#2E3093]">Dashboard</Link>
              <span>/</span>
              <Link href="/dashboard/role-right" className="hover:text-[#2E3093]">Role Right</Link>
              <span>/</span>
              <span className="text-gray-800">Add Role</span>
            </nav>
            <div className="flex items-center gap-2">
              <FaShieldAlt className="w-5 h-5 text-[#2E3093]" />
              <h2 className="text-lg font-bold text-gray-800">Create New Role</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium"
            >
              <FaTimes className="w-4 h-4" /> Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2E3093] hover:bg-[#252780] text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <FaSave className="w-4 h-4" />
              )}
              Save Role
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Role Details */}
        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Role Details</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Role Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Department Manager"
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this role's purpose..."
                  rows={3}
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] resize-none"
                />
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Selection Summary</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Selected Permissions</span>
                <span className="font-semibold text-[#2E3093]">
                  {selectedPermissions.size} / {stats?.totalPermissions || 0}
                </span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#2E3093] rounded-full transition-all"
                  style={{ 
                    width: stats?.totalPermissions 
                      ? `${(selectedPermissions.size / stats.totalPermissions) * 100}%` 
                      : '0%' 
                  }}
                />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Quick Actions</h4>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={selectAll}
                  className="px-2.5 py-1 text-xs bg-[#2E3093]/10 text-[#2E3093] rounded-lg hover:bg-[#2E3093]/20"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAll}
                  className="px-2.5 py-1 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                >
                  Clear All
                </button>
              </div>
              <h4 className="text-xs font-medium text-gray-500 uppercase mt-3 mb-2">Add by Type</h4>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => selectByAction('view')}
                  className="px-2.5 py-1 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                >
                  + All View
                </button>
                <button
                  onClick={() => selectByAction('create')}
                  className="px-2.5 py-1 text-xs bg-green-50 text-green-600 rounded-lg hover:bg-green-100"
                >
                  + All Create
                </button>
                <button
                  onClick={() => selectByAction('update')}
                  className="px-2.5 py-1 text-xs bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100"
                >
                  + All Update
                </button>
                <button
                  onClick={() => selectByAction('delete')}
                  className="px-2.5 py-1 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                >
                  + All Delete
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Permissions Tree */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Permissions Header */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Permissions</h3>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <FaSearch className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search permissions..."
                      className="w-48 border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
                    />
                  </div>
                  <select
                    value={filterAction}
                    onChange={(e) => setFilterAction(e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
                  >
                    <option value="">All Actions</option>
                    <option value="view">View</option>
                    <option value="create">Create</option>
                    <option value="update">Update</option>
                    <option value="delete">Delete</option>
                    <option value="export">Export</option>
                    <option value="manage">Manage</option>
                  </select>
                </div>
              </div>

              {/* Info Box */}
              <div className="flex items-start gap-2 p-2.5 bg-blue-50 rounded-lg text-xs text-blue-700">
                <FaInfoCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>
                  Permissions are grouped by department/module. Click on a group header to expand it, 
                  or use the checkbox to select all permissions in that group. Individual permissions 
                  can be toggled within each group.
                </p>
              </div>
            </div>

            {/* Permissions List */}
            <div className="max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-gray-400">
                  <div className="w-6 h-6 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  Loading permissions...
                </div>
              ) : filteredGroups.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  No permissions match your search
                </div>
              ) : (
                filteredGroups.map(group => (
                  <div key={group.id} className="border-b border-gray-100 last:border-0">
                    {/* Group Header */}
                    <div
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer select-none"
                      onClick={() => toggleGroup(group.id)}
                    >
                      {/* Group Checkbox */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleGroupAll(group);
                        }}
                        className="text-lg"
                      >
                        {getGroupSelectionState(group) === 'all' ? (
                          <FaCheckSquare className="text-[#2E3093]" />
                        ) : getGroupSelectionState(group) === 'partial' ? (
                          <FaMinusSquare className="text-[#2E3093]" />
                        ) : (
                          <FaSquare className="text-gray-300" />
                        )}
                      </button>

                      {/* Group Icon */}
                      <span className="text-gray-500"><GroupIcon icon={group.icon} /></span>

                      {/* Group Info */}
                      <div className="flex-1">
                        <div className="font-medium text-gray-800">{group.name}</div>
                        <div className="text-xs text-gray-400">{group.description}</div>
                      </div>

                      {/* Count Badge */}
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {group.permissions.filter(p => selectedPermissions.has(p.id)).length}/{group.permissions.length}
                      </span>

                      {/* Expand Icon */}
                      {expandedGroups.has(group.id) ? (
                        <FaChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <FaChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </div>

                    {/* Permissions Grid */}
                    {expandedGroups.has(group.id) && (
                      <div className="px-4 pb-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pl-8">
                          {group.permissions.map(permission => (
                            <label
                              key={permission.id}
                              className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                                selectedPermissions.has(permission.id)
                                  ? 'bg-[#2E3093]/10 border border-[#2E3093]/30'
                                  : 'bg-gray-50 border border-transparent hover:border-gray-200'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedPermissions.has(permission.id)}
                                onChange={() => togglePermission(permission.id)}
                                className="sr-only"
                              />
                              <span className={`w-4 h-4 flex items-center justify-center rounded text-white text-xs ${
                                selectedPermissions.has(permission.id) ? 'bg-[#2E3093]' : 'bg-gray-300'
                              }`}>
                                {selectedPermissions.has(permission.id) && '✓'}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium text-gray-700 truncate">
                                  {permission.name}
                                </div>
                                <div className={`text-[10px] uppercase font-medium ${
                                  permission.action === 'view' ? 'text-blue-500' :
                                  permission.action === 'create' ? 'text-green-500' :
                                  permission.action === 'update' ? 'text-amber-500' :
                                  permission.action === 'delete' ? 'text-red-500' :
                                  permission.action === 'export' ? 'text-purple-500' :
                                  'text-gray-500'
                                }`}>
                                  {permission.action}
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
