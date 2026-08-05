'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePermissions } from '@/lib/permissions-context';
import MonitoringWeeklyTable, { type MonitoringDayRow } from './MonitoringWeeklyTable';

interface AdminUserOption {
  id: number;
  firstname: string | null;
  lastname: string | null;
  email: string | null;
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

function shiftWeek(weekStart: string, weeks: number): string {
  const d = new Date(`${weekStart}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

function employeeName(e: AdminUserOption): string {
  return `${e.firstname ?? ''} ${e.lastname ?? ''}`.trim() || e.email || `Employee #${e.id}`;
}

/**
 * Dashboard-home monitoring widget.
 * - Administration (super admin): can pick any employee from a dropdown and view their
 *   weekly progress, via the admin /api/monitoring/weekly endpoint.
 * - Everyone else: always sees just their own report, no dropdown, via the self-service
 *   /api/monitoring/weekly/me endpoint keyed off the session.
 */
export default function MonitoringWidget() {
  const { session, isSuperAdmin, loading: sessionLoading } = usePermissions();
  const [employees, setEmployees] = useState<AdminUserOption[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [weekStart, setWeekStart] = useState<string>(() => getMonday(new Date()));
  const [days, setDays] = useState<MonitoringDayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin || !session) return;
    fetch('/api/monitoring/employees')
      .then((res) => res.json())
      .then((data) => {
        const list: AdminUserOption[] = data.employees || [];
        setEmployees(list);
        setSelectedEmployeeId((prev) => prev ?? session.userId ?? list[0]?.id ?? null);
      })
      .catch(() => {});
  }, [isSuperAdmin, session]);

  const fetchWeek = useCallback(async () => {
    if (!session) return;
    if (isSuperAdmin && !selectedEmployeeId) return;
    setLoading(true);
    try {
      const url = isSuperAdmin
        ? `/api/monitoring/weekly?adminUserId=${selectedEmployeeId}&weekStart=${weekStart}`
        : `/api/monitoring/weekly/me?weekStart=${weekStart}`;
      const res = await fetch(url);
      const data = await res.json();
      setDays(data.days || []);
    } catch {
      setDays([]);
    }
    setLoading(false);
  }, [session, isSuperAdmin, selectedEmployeeId, weekStart]);

  useEffect(() => { fetchWeek(); }, [fetchWeek]);

  const handleSaveDay = async (row: MonitoringDayRow) => {
    setDays((prev) => prev.map((d) => (d.date === row.date ? row : d)));
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

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId) || null;
  const employeeLabel = isSuperAdmin
    ? (selectedEmployee ? employeeName(selectedEmployee) : '—')
    : `${session.firstName ?? ''} ${session.lastName ?? ''}`.trim() || session.email || 'Me';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
          <svg className="w-4 h-4 text-[#2A6BB5]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          {isSuperAdmin ? 'Employee Monitoring' : 'My Weekly Report'}
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
            {isSuperAdmin && (
              <div className="relative">
                <select
                  value={selectedEmployeeId ?? ''}
                  onChange={(e) => setSelectedEmployeeId(e.target.value ? Number(e.target.value) : null)}
                  className="appearance-none pl-2.5 pr-7 py-1 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 bg-slate-50 h-7 min-w-[160px] hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093]"
                >
                  <option value="">Select Employee</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{employeeName(e)}</option>
                  ))}
                </select>
                <svg className="w-2.5 h-2.5 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            )}

            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5 w-fit">
              <button
                onClick={() => setWeekStart((w) => shiftWeek(w, -1))}
                className="w-6 h-6 flex items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-[#2E3093] hover:shadow-sm transition-all"
                title="Previous week"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-[11px] font-bold text-slate-700 px-2 min-w-[110px] text-center">
                {days.length ? `${formatDate(days[0].date)} – ${formatDate(days[6].date)}` : ''}
              </span>
              <button
                onClick={() => setWeekStart((w) => shiftWeek(w, 1))}
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

          {loading ? (
            <div className="text-[11px] text-slate-400 py-6 text-center">Loading...</div>
          ) : (
            <MonitoringWeeklyTable
              employeeLabel={employeeLabel}
              days={days}
              canEdit
              onSaveDay={handleSaveDay}
              refreshKey={isSuperAdmin ? `${selectedEmployeeId ?? 'none'}:${weekStart}` : 'me'}
            />
          )}
        </div>
      )}
    </div>
  );
}
