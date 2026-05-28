'use client';

import React, { useState } from 'react';
import {
  FaSearch, FaChevronDown, FaChevronUp,
  FaCheckSquare, FaSquare, FaMinusSquare,
  FaCog, FaDatabase, FaGraduationCap, FaCalendarAlt, FaChartBar,
  FaBook, FaUsers, FaWallet, FaWrench, FaBriefcase, FaShieldAlt,
  FaCheck,
} from 'react-icons/fa';

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
}

export interface PermissionGroup {
  id: string;
  name: string;
  description: string;
  icon: string;
  permissions: Permission[];
}

export interface Stats {
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

interface Props {
  selectedPermissions: Set<string>;
  permissionGroups: PermissionGroup[];
  stats: Stats | null;
  loading: boolean;
  disabled?: boolean;
  initialExpandedGroups?: Set<string>;
  onTogglePermission: (id: string) => void;
  onToggleGroupAll: (group: PermissionGroup) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onSelectByAction: (action: string) => void;
  dashboardDepartment: string;
  onDashboardChange: (val: string) => void;
}

// ── Action badge colours ──────────────────────────────────────
const ACTION_STYLE: Record<string, { bg: string; text: string }> = {
  view:    { bg: 'bg-sky-100',     text: 'text-sky-700'     },
  create:  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  update:  { bg: 'bg-amber-100',   text: 'text-amber-700'   },
  delete:  { bg: 'bg-red-100',     text: 'text-red-700'     },
  export:  { bg: 'bg-violet-100',  text: 'text-violet-700'  },
  manage:  { bg: 'bg-indigo-100',  text: 'text-indigo-700'  },
};

// ── Group icon backgrounds cycling palette ────────────────────
const GROUP_PALETTE = [
  { iconBg: 'bg-violet-100', iconText: 'text-violet-600' },
  { iconBg: 'bg-blue-100',   iconText: 'text-blue-600'   },
  { iconBg: 'bg-emerald-100',iconText: 'text-emerald-600'},
  { iconBg: 'bg-amber-100',  iconText: 'text-amber-600'  },
  { iconBg: 'bg-rose-100',   iconText: 'text-rose-600'   },
  { iconBg: 'bg-cyan-100',   iconText: 'text-cyan-600'   },
  { iconBg: 'bg-fuchsia-100',iconText: 'text-fuchsia-600'},
];

function GroupIcon({ icon, className }: { icon: string; className?: string }) {
  const cls = className ?? 'w-4 h-4';
  switch (icon) {
    case 'settings':   return <FaCog className={cls} />;
    case 'database':   return <FaDatabase className={cls} />;
    case 'graduation': return <FaGraduationCap className={cls} />;
    case 'calendar':   return <FaCalendarAlt className={cls} />;
    case 'chart':      return <FaChartBar className={cls} />;
    case 'book':       return <FaBook className={cls} />;
    case 'shield':     return <FaShieldAlt className={cls} />;
    case 'users':      return <FaUsers className={cls} />;
    case 'wallet':     return <FaWallet className={cls} />;
    case 'wrench':     return <FaWrench className={cls} />;
    case 'briefcase':  return <FaBriefcase className={cls} />;
    default:           return <FaCog className={cls} />;
  }
}

const QUICK_ACTIONS = [
  { action: 'view',   label: 'View',   cls: 'bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200' },
  { action: 'create', label: 'Create', cls: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200' },
  { action: 'update', label: 'Update', cls: 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200' },
  { action: 'delete', label: 'Delete', cls: 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200' },
  { action: 'export', label: 'Export', cls: 'bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200' },
  { action: 'manage', label: 'Manage', cls: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200' },
];

export function PermissionsSidebar({
  selectedPermissions, stats, disabled,
  onSelectAll, onDeselectAll, onSelectByAction,
}: Pick<Props, 'selectedPermissions' | 'stats' | 'disabled' | 'onSelectAll' | 'onDeselectAll' | 'onSelectByAction'>) {
  const total = stats?.totalPermissions ?? 0;
  const selected = selectedPermissions.size;
  const pct = total > 0 ? Math.round((selected / total) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
      {/* Progress */}
      <div>
        <div className="flex items-end justify-between mb-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Selected</span>
          <span className="text-lg font-bold text-[#2E3093] leading-none">
            {selected}<span className="text-sm font-normal text-gray-400"> / {total}</span>
          </span>
        </div>
        <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-[#2E3093] to-indigo-400"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-[11px] text-gray-400 mt-1">{pct}% of all permissions</div>
      </div>

      {/* Bulk actions */}
      {!disabled && (
        <>
          <div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Bulk Select</div>
            <div className="flex gap-2">
              <button onClick={onSelectAll}
                className="flex-1 py-1.5 rounded-lg bg-[#2E3093]/8 hover:bg-[#2E3093]/15 text-[#2E3093] text-xs font-semibold transition-colors">
                All
              </button>
              <button onClick={onDeselectAll}
                className="flex-1 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold transition-colors">
                None
              </button>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Add by Action</div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_ACTIONS.map(({ action, label, cls }) => (
                <button key={action} onClick={() => onSelectByAction(action)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${cls}`}>
                  +{label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Breakdown by action */}
      {stats && (
        <div>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Permission Types</div>
          <div className="space-y-1.5">
            {QUICK_ACTIONS.map(({ action, label }) => {
              const count = stats.byAction?.[action as keyof typeof stats.byAction] ?? 0;
              if (!count) return null;
              const s = ACTION_STYLE[action] ?? ACTION_STYLE.manage;
              return (
                <div key={action} className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${s.bg} ${s.text} w-14 text-center`}>{label}</span>
                  <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${s.bg.replace('100', '400')}`}
                      style={{ width: `${Math.round((count / total) * 100)}%` }} />
                  </div>
                  <span className="text-[10px] text-gray-400 w-5 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function PermissionsTree({
  selectedPermissions, permissionGroups, loading, disabled,
  initialExpandedGroups,
  onTogglePermission, onToggleGroupAll,
  dashboardDepartment, onDashboardChange,
}: Omit<Props, 'stats' | 'onSelectAll' | 'onDeselectAll' | 'onSelectByAction'>) {
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [activeTab, setActiveTab] = useState<'permissions' | 'dashboard'>('permissions');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    initialExpandedGroups ?? new Set()
  );

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const getState = (group: PermissionGroup) => {
    const ids = group.permissions.map(p => p.id);
    const n = ids.filter(id => selectedPermissions.has(id)).length;
    if (n === 0) return 'none';
    if (n === ids.length) return 'all';
    return 'partial';
  };

  const filtered = (!search && !filterAction)
    ? permissionGroups
    : permissionGroups
        .map(g => ({
          ...g,
          permissions: g.permissions.filter(p => {
            const matchSearch = !search ||
              p.name.toLowerCase().includes(search.toLowerCase()) ||
              p.description.toLowerCase().includes(search.toLowerCase()) ||
              p.resource.toLowerCase().includes(search.toLowerCase());
            const matchAction = !filterAction || p.action === filterAction;
            return matchSearch && matchAction;
          }),
        }))
        .filter(g => g.permissions.length > 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      {/* Tab bar */}
      <div className="px-5 pt-4 pb-3 border-b border-gray-100 flex items-center gap-3">
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {(['permissions', 'dashboard'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                activeTab === t ? 'bg-white text-[#2E3093] shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t === 'permissions' ? 'Permissions' : 'Dashboard'}
            </button>
          ))}
        </div>
        {activeTab === 'permissions' && (
          <div className="flex items-center gap-2 ml-auto">
            <div className="relative">
              <FaSearch className="w-3 h-3 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-40 border border-gray-200 rounded-xl pl-7 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] bg-white"
              />
            </div>
            <select
              value={filterAction}
              onChange={e => setFilterAction(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] bg-white text-gray-600"
            >
              <option value="">All actions</option>
              {QUICK_ACTIONS.map(({ action, label }) => (
                <option key={action} value={action}>{label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {activeTab === 'permissions' ? (
        <div className="overflow-y-auto" style={{ maxHeight: 560 }}>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
              <div className="w-7 h-7 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
              Loading permissions…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
              <FaSearch className="w-6 h-6 text-gray-200" />
              No permissions match your search
            </div>
          ) : (
            filtered.map((group, gIdx) => {
              const gp = GROUP_PALETTE[gIdx % GROUP_PALETTE.length];
              const state = getState(group);
              const selectedCount = group.permissions.filter(p => selectedPermissions.has(p.id)).length;
              const expanded = expandedGroups.has(group.id);
              return (
                <div key={group.id} className="border-b border-gray-50 last:border-0">
                  {/* Group row */}
                  <div
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/80 cursor-pointer select-none transition-colors"
                    onClick={() => toggleGroup(group.id)}
                  >
                    {/* Checkbox */}
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); if (!disabled) onToggleGroupAll(group); }}
                      disabled={disabled}
                      className={`text-lg shrink-0 transition-colors ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                    >
                      {state === 'all'
                        ? <FaCheckSquare className="text-[#2E3093]" />
                        : state === 'partial'
                        ? <FaMinusSquare className="text-[#2E3093]" />
                        : <FaSquare className="text-gray-300" />}
                    </button>

                    {/* Icon */}
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${gp.iconBg}`}>
                      <GroupIcon icon={group.icon} className={`w-3.5 h-3.5 ${gp.iconText}`} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-800 text-sm">{group.name}</div>
                      <div className="text-xs text-gray-400 truncate">{group.description}</div>
                    </div>

                    {/* Count */}
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                      state === 'all'
                        ? 'bg-[#2E3093]/10 text-[#2E3093]'
                        : state === 'partial'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-100 text-gray-400'
                    }`}>
                      {selectedCount}/{group.permissions.length}
                    </span>

                    {expanded
                      ? <FaChevronUp className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                      : <FaChevronDown className="w-3.5 h-3.5 text-gray-300 shrink-0" />}
                  </div>

                  {/* Permission chips */}
                  {expanded && (
                    <div className="px-5 pb-4 pt-1">
                      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 pl-11">
                        {group.permissions.map(perm => {
                          const checked = selectedPermissions.has(perm.id);
                          const aStyle = ACTION_STYLE[perm.action] ?? ACTION_STYLE.manage;
                          return (
                            <button
                              key={perm.id}
                              type="button"
                              disabled={disabled}
                              onClick={e => { e.stopPropagation(); onTogglePermission(perm.id); }}
                              className={`flex items-start gap-2.5 p-2.5 rounded-xl text-left w-full transition-all border ${
                                disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                              } ${checked
                                ? 'bg-[#2E3093]/10 border-[#2E3093]/20 ring-1 ring-[#2E3093]/20'
                                : 'bg-gray-50 border-transparent hover:border-gray-200 hover:bg-white'
                              }`}
                            >
                              {/* Custom checkbox */}
                              <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                                checked ? 'bg-[#2E3093]' : 'bg-white border-2 border-gray-300'
                              }`}>
                                {checked && <FaCheck className="w-2.5 h-2.5 text-white" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium text-gray-700 truncate leading-snug">{perm.name}</div>
                                <span className={`inline-block text-[9px] font-bold uppercase tracking-wider mt-0.5 px-1.5 py-0.5 rounded-md ${aStyle.bg} ${aStyle.text}`}>
                                  {perm.action}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="p-6">
          <div className="max-w-sm space-y-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Dashboard Department</label>
              <p className="text-xs text-gray-400 mb-3">
                Only this department's dashboard will be shown to users with this role.
              </p>
            </div>
            <select
              value={dashboardDepartment}
              onChange={e => onDashboardChange(e.target.value)}
              disabled={disabled}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093] bg-white disabled:bg-gray-50 disabled:cursor-not-allowed"
            >
              <option value="">— No specific dashboard —</option>
              <option value="cbd">Career Building Department</option>
              <option value="corporate_training">Corporate Training</option>
              <option value="placement">Placement</option>
              <option value="training_and_development">Training &amp; Development</option>
              <option value="accounts">Accounts</option>
              <option value="finance">Finance</option>
              <option value="administration">Administration</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
