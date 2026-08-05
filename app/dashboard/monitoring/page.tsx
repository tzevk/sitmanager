'use client';

import { useState, useEffect, useCallback } from 'react';
import { useResourcePermissions } from '@/lib/permissions-context';
import MonitoringWeeklyTable, { type MonitoringDayRow } from '../components/MonitoringWeeklyTable';

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
  const dow = d.getUTCDay(); // 0 = Sunday
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

export default function MonitoringWeeklyReportPage() {
  const { canView, canUpdate, loading: permLoading } = useResourcePermissions('monitoring');

  const [employees, setEmployees] = useState<AdminUserOption[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [weekStart, setWeekStart] = useState<string>(() => getMonday(new Date()));
  const [days, setDays] = useState<MonitoringDayRow[]>([]);
  const [loadingDays, setLoadingDays] = useState(false);

  useEffect(() => {
    fetch('/api/monitoring/employees')
      .then((res) => res.json())
      .then((data) => {
        const list: AdminUserOption[] = data.employees || [];
        setEmployees(list);
        setSelectedEmployeeId((prev) => prev ?? list[0]?.id ?? null);
      })
      .catch(() => {});
  }, []);

  const fetchWeek = useCallback(async () => {
    if (!selectedEmployeeId) return;
    setLoadingDays(true);
    try {
      const res = await fetch(`/api/monitoring/weekly?adminUserId=${selectedEmployeeId}&weekStart=${weekStart}`);
      const data = await res.json();
      setDays(data.days || []);
    } catch {
      setDays([]);
    }
    setLoadingDays(false);
  }, [selectedEmployeeId, weekStart]);

  useEffect(() => { fetchWeek(); }, [fetchWeek]);

  const handleSaveDay = async (row: MonitoringDayRow) => {
    if (!selectedEmployeeId || !canUpdate) return;
    setDays((prev) => prev.map((d) => (d.date === row.date ? row : d)));
    try {
      await fetch('/api/monitoring/weekly', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminUserId: selectedEmployeeId,
          date: row.date,
          firstHalfSummary: row.firstHalfSummary,
          secondHalfSummary: row.secondHalfSummary,
          whatsapp: row.whatsapp,
          emailsReplied: row.emailsReplied,
          socialMediaInquiries: row.socialMediaInquiries,
        }),
      });
    } catch { /* ignore */ }
  };

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId) || null;
  const employeeLabel = selectedEmployee ? employeeName(selectedEmployee) : '—';

  if (permLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <p className="text-sm font-semibold">Access Denied</p>
        <p className="text-xs">You do not have permission to view employee monitoring.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-4 py-3 shadow-sm flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-white tracking-tight">Employee Monitoring</h2>
          <p className="text-[11px] text-white/70 font-medium">Weekly activity report, sourced live from system data</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 bg-white rounded-lg border border-slate-200 shadow-sm px-3 py-2">
        <div className="relative">
          <select
            value={selectedEmployeeId ?? ''}
            onChange={(e) => setSelectedEmployeeId(e.target.value ? Number(e.target.value) : null)}
            className="appearance-none pl-3 pr-8 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 bg-slate-50 h-8 min-w-[220px] hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/15 focus:border-[#2E3093]"
          >
            <option value="">Select Employee</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{employeeName(e)}</option>
            ))}
          </select>
          <svg className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        <div className="h-5 w-px bg-slate-200 mx-1" />

        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
          <button
            onClick={() => setWeekStart((w) => shiftWeek(w, -1))}
            className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-[#2E3093] hover:shadow-sm transition-all"
            title="Previous week"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-xs font-bold text-slate-700 px-2 min-w-[130px] text-center">
            {days.length ? `${formatDate(days[0].date)} – ${formatDate(days[6].date)}` : '—'}
          </span>
          <button
            onClick={() => setWeekStart((w) => shiftWeek(w, 1))}
            className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-[#2E3093] hover:shadow-sm transition-all"
            title="Next week"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <button
          onClick={() => setWeekStart(getMonday(new Date()))}
          className="px-2.5 py-1.5 text-xs font-semibold text-[#2E3093] bg-[#2E3093]/5 border border-[#2E3093]/20 rounded-lg h-8 hover:bg-[#2E3093]/10 transition-colors"
        >
          This Week
        </button>
      </div>

      {loadingDays || days.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-xs bg-white rounded-xl border border-slate-200">
          {loadingDays ? (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-[#2E3093] border-t-transparent rounded-full animate-spin" />
              Loading...
            </div>
          ) : (
            'Select an employee to view their weekly report.'
          )}
        </div>
      ) : (
        <MonitoringWeeklyTable
          employeeLabel={employeeLabel}
          days={days}
          canEdit={canUpdate}
          onSaveDay={handleSaveDay}
          refreshKey={`${selectedEmployeeId ?? 'none'}:${weekStart}`}
        />
      )}
    </div>
  );
}
