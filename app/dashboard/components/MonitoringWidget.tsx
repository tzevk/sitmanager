'use client';

import { useEffect, useState, useId } from 'react';
import Link from 'next/link';
import { usePermissions } from '@/lib/permissions-context';
import MonitoringWeeklyTable, { type MonitoringDayRow } from './MonitoringWeeklyTable';

interface AdminUserOption {
  id: number;
  firstname: string | null;
  lastname: string | null;
  email?: string | null;
}

function formatDate(d: string): string {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y.slice(2)}`;
}

function getMonday(base: Date): string {
  const d = new Date(Date.UTC(base.getFullYear(), base.getMonth(), base.getDate()));
  const dow = d.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function shiftDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function employeeName(e: AdminUserOption): string {
  return `${e.firstname ?? ''} ${e.lastname ?? ''}`.trim() || e.email || `Employee #${e.id}`;
}

/**
 * Dashboard-home monitoring widget.
 * - Administration (super admin): can pick any employee from a dropdown and view their
 *   weekly progress, via the admin /api/monitoring/weekly endpoint.
 * - Everyone else: defaults to their own editable report and can switch to an authorized
 *   teammate's read-only report when the team endpoint offers one.
 */
export default function MonitoringWidget() {
  const employeeSelectId = useId();
  const { session, isSuperAdmin, loading: sessionLoading } = usePermissions();
  const selfId = session?.userId ?? null;
  const [optionsState, setOptionsState] = useState<{
    key: string;
    employees: AdminUserOption[];
    error: string | null;
    loading: boolean;
  }>({ key: '', employees: [], error: null, loading: false });
  const [adminEmployeeId, setAdminEmployeeId] = useState<number | null>(null);
  const [teammateEmployeeId, setTeammateEmployeeId] = useState<number | null>(null);
  const [weekStart, setWeekStart] = useState<string>(() => getMonday(new Date()));
  const [weekState, setWeekState] = useState<{
    key: string;
    loading: boolean;
    days: MonitoringDayRow[];
    error: string | null;
  }>({ key: '', loading: true, days: [], error: null });
  const [collapsed, setCollapsed] = useState(false);

  const optionsKey = `${isSuperAdmin ? 'admin' : 'team'}:${selfId ?? 'none'}`;
  const currentOptions = optionsState.key === optionsKey ? optionsState : null;
  const employees = currentOptions?.employees ?? [];
  const optionsError = currentOptions?.error ?? null;
  const hasTeammateOptions = selfId !== null && employees.some((e) => e.id !== selfId);
  const isTeamScoped = !isSuperAdmin && hasTeammateOptions;
  const selectedTeammateId = !isSuperAdmin
    && hasTeammateOptions
    && teammateEmployeeId !== null
    && teammateEmployeeId !== selfId
    && employees.some((e) => e.id === teammateEmployeeId)
    ? teammateEmployeeId
    : null;
  const selectedEmployeeId = isSuperAdmin ? adminEmployeeId : selectedTeammateId ?? selfId;
  const reportMode = isSuperAdmin ? 'admin' : selectedTeammateId === null ? 'self' : 'team';
  const reportKey = `${reportMode}:${selfId ?? 'none'}:${selectedEmployeeId ?? 'none'}:${weekStart}`;

  useEffect(() => {
    if (sessionLoading || selfId === null) return;

    const controller = new AbortController();
    let active = true;
    const url = isSuperAdmin ? '/api/monitoring/employees' : '/api/monitoring/weekly/team';

    setOptionsState({ key: optionsKey, employees: [], error: null, loading: true });
    if (!isSuperAdmin) setTeammateEmployeeId(null);

    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error('Unable to load employee options');
        return data;
      })
      .then((data: { employees?: AdminUserOption[] }) => {
        if (!active) return;
        const list = Array.isArray(data.employees) ? data.employees : [];
        setOptionsState({ key: optionsKey, employees: list, error: null, loading: false });
        if (isSuperAdmin) setAdminEmployeeId((prev) => prev ?? selfId ?? list[0]?.id ?? null);
      })
      .catch(() => {
        if (!active) return;
        setOptionsState({ key: optionsKey, employees: [], error: 'Unable to load employee options.', loading: false });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [isSuperAdmin, optionsKey, selfId, sessionLoading]);

  useEffect(() => {
    if (sessionLoading || selfId === null) return;
    if (isSuperAdmin && selectedEmployeeId === null) return;

    const controller = new AbortController();
    let active = true;
    const url = isSuperAdmin
      ? `/api/monitoring/weekly?adminUserId=${selectedEmployeeId}&weekStart=${weekStart}`
      : selectedEmployeeId === selfId
        ? `/api/monitoring/weekly/me?weekStart=${weekStart}`
        : `/api/monitoring/weekly/team?employeeId=${selectedEmployeeId}&weekStart=${weekStart}`;

    setWeekState({ key: reportKey, loading: true, days: [], error: null });

    const loadWeek = async () => {
      try {
        const res = await fetch(url, { signal: controller.signal });
        const data = await res.json();
        if (!res.ok) throw new Error('Unable to load weekly report');
        if (!active) return;
        setWeekState({
          key: reportKey,
          loading: false,
          days: Array.isArray(data.days) ? data.days : [],
          error: null,
        });
      } catch {
        if (!active) return;
        setWeekState({ key: reportKey, loading: false, days: [], error: 'Unable to load weekly report.' });
      }
    };

    void loadWeek();

    return () => {
      active = false;
      controller.abort();
    };
  }, [isSuperAdmin, reportKey, selectedEmployeeId, selfId, sessionLoading, weekStart]);

  const handleSaveDay = async (row: MonitoringDayRow) => {
    if (reportMode === 'team' || selectedEmployeeId === null) return;
    setWeekState((prev) => prev.key === reportKey
      ? { ...prev, days: prev.days.map((d) => (d.date === row.date ? row : d)) }
      : prev);
    const payload = {
      date: row.date,
      firstHalfSummary: row.firstHalfSummary,
      secondHalfSummary: row.secondHalfSummary,
      whatsapp: row.whatsapp,
      emailsReplied: row.emailsReplied,
      socialMediaInquiries: row.socialMediaInquiries,
    };
    try {
      if (isSuperAdmin) {
        await fetch('/api/monitoring/weekly', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, adminUserId: selectedEmployeeId }),
        });
      } else {
        await fetch('/api/monitoring/weekly/me', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
    } catch { /* ignore */ }
  };

  if (sessionLoading || !session) return null;

  const employeeOptions: AdminUserOption[] = isSuperAdmin || employees.some((e) => e.id === session.userId)
    ? employees
    : [
      { id: session.userId, firstname: session.firstName ?? null, lastname: session.lastName ?? null, email: session.email ?? null },
      ...employees,
    ];
  const selectedEmployee = employeeOptions.find((e) => e.id === selectedEmployeeId) || null;
  const selfLabel = `${session.firstName ?? ''} ${session.lastName ?? ''}`.trim() || session.email || 'Me';
  const employeeLabel = selectedEmployee
    ? employeeName(selectedEmployee)
    : isSuperAdmin ? '—' : selfLabel;
  const currentWeek = weekState.key === reportKey ? weekState : null;
  const reportLoading = !currentWeek || currentWeek.loading;
  const canEdit = reportMode !== 'team';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
          <svg className="w-4 h-4 text-[#2A6BB5]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          {isSuperAdmin ? 'Employee Monitoring' : isTeamScoped ? 'Weekly Report' : 'My Weekly Report'}
        </h3>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/monitoring" className="text-xs font-semibold text-[#2E3093] hover:underline">
            Full Monitoring
          </Link>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <svg className={`w-3.5 h-3.5 transition-transform ${collapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {(isSuperAdmin || hasTeammateOptions) && (
              <div className="relative">
                <label htmlFor={employeeSelectId} className="sr-only">Employee</label>
                <select
                  id={employeeSelectId}
                  value={selectedEmployeeId ?? ''}
                  onChange={(e) => {
                    const id = e.target.value ? Number(e.target.value) : null;
                    if (isSuperAdmin) setAdminEmployeeId(id);
                    else setTeammateEmployeeId(id === selfId ? null : id);
                  }}
                  className="appearance-none pl-2.5 pr-7 py-1 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 bg-slate-50 h-7 min-w-[160px] hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093]"
                >
                  {isSuperAdmin && <option value="">Select Employee</option>}
                  {employeeOptions.map((e) => (
                    <option key={e.id} value={e.id}>{employeeName(e)}</option>
                  ))}
                </select>
                <svg className="w-2.5 h-2.5 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            )}

            {!canEdit && (
              <span className="text-[11px] font-semibold text-slate-500">Read-only</span>
            )}

            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5 w-fit">
              <button
                onClick={() => setWeekStart((w) => shiftDays(w, -7))}
                className="w-6 h-6 flex items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-[#2E3093] hover:shadow-sm transition-all"
                title="Previous week"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-[11px] font-bold text-slate-700 px-2 min-w-[110px] text-center">
                {formatDate(weekStart)} – {formatDate(shiftDays(weekStart, 6))}
              </span>
              <button
                onClick={() => setWeekStart((w) => shiftDays(w, 7))}
                className="w-6 h-6 flex items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-[#2E3093] hover:shadow-sm transition-all"
                title="Next week"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button
                onClick={() => setWeekStart(getMonday(new Date()))}
                className="px-2 h-6 text-[10px] font-bold text-[#2E3093] hover:bg-white rounded-md transition-all"
              >
                Today
              </button>
            </div>
          </div>

          {optionsError && (
            <div className="text-[11px] text-red-600 py-2 text-center">{optionsError}</div>
          )}

          {isSuperAdmin && selectedEmployeeId === null && optionsError ? null : isSuperAdmin && selectedEmployeeId === null && currentOptions?.loading === false ? (
            <div className="text-[11px] text-slate-500 py-6 text-center">Select an employee to view a report.</div>
          ) : currentWeek?.error ? (
            <div className="text-[11px] text-red-600 py-6 text-center">{currentWeek.error}</div>
          ) : reportLoading ? (
            <div className="text-[11px] text-slate-400 py-6 text-center">Loading...</div>
          ) : (
            <MonitoringWeeklyTable
              employeeLabel={employeeLabel}
              days={currentWeek?.days ?? []}
              canEdit={canEdit}
              onSaveDay={handleSaveDay}
              refreshKey={reportKey}
            />
          )}
        </div>
      )}
    </div>
  );
}
