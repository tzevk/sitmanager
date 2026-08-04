'use client';

import { useState, useEffect, useCallback } from 'react';
import { useResourcePermissions } from '@/lib/permissions-context';

interface AdminUserOption {
  id: number;
  firstname: string | null;
  lastname: string | null;
  email: string | null;
}

interface MonitoringDayRow {
  date: string;
  day: string;
  admissions: number;
  incomingCalls: number;
  freshCallsMeta: number;
  freshCallsOthers: number;
  whatsapp: number;
  followupCalls: number;
  walkIns: number;
  emailsReplied: number;
  firstHalfSummary: string | null;
  secondHalfSummary: string | null;
  socialMediaInquiries: number | null;
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

const AUTO_ROWS: { key: keyof MonitoringDayRow; label: string }[] = [
  { key: 'incomingCalls', label: 'Incoming Calls' },
  { key: 'freshCallsMeta', label: 'Fresh Calls (Meta)' },
  { key: 'freshCallsOthers', label: 'Fresh Calls (Others)' },
  { key: 'whatsapp', label: 'WhatsApp Enquiries' },
  { key: 'followupCalls', label: 'Followup Calls' },
  { key: 'walkIns', label: 'No. of Walk-in Enquiries' },
  { key: 'emailsReplied', label: 'No. of Emails Replied to' },
];

export default function MonitoringWeeklyReportPage() {
  const { canView, canUpdate, loading: permLoading } = useResourcePermissions('monitoring');

  const [employees, setEmployees] = useState<AdminUserOption[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [weekStart, setWeekStart] = useState<string>(() => getMonday(new Date()));
  const [days, setDays] = useState<MonitoringDayRow[]>([]);
  const [loadingDays, setLoadingDays] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

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

  const updateDayLocal = (date: string, patch: Partial<MonitoringDayRow>) => {
    setDays((prev) => prev.map((d) => (d.date === date ? { ...d, ...patch } : d)));
  };

  const saveManualFields = async (row: MonitoringDayRow) => {
    if (!selectedEmployeeId || !canUpdate) return;
    setSavingKey(row.date);
    try {
      await fetch('/api/monitoring/weekly', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminUserId: selectedEmployeeId,
          date: row.date,
          firstHalfSummary: row.firstHalfSummary,
          secondHalfSummary: row.secondHalfSummary,
          socialMediaInquiries: row.socialMediaInquiries,
        }),
      });
    } catch { /* ignore */ }
    setSavingKey(null);
  };

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId) || null;
  const employeeLabel = selectedEmployee
    ? `${selectedEmployee.firstname ?? ''} ${selectedEmployee.lastname ?? ''}`.trim() || selectedEmployee.email || `Employee #${selectedEmployee.id}`
    : '—';

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

  const cellCls = 'border border-black px-2 py-1.5 text-xs text-center align-middle';
  const labelCellCls = 'border border-black px-2 py-1.5 text-xs font-medium align-middle';
  const manualCellCls = `${cellCls} bg-yellow-200`;

  return (
    <div className="space-y-3">
      <div className="bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] rounded-xl px-4 py-2.5 shadow-sm">
        <h2 className="text-base font-black text-white tracking-tight">Employee Monitoring — Weekly Report</h2>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={selectedEmployeeId ?? ''}
          onChange={(e) => setSelectedEmployeeId(e.target.value ? Number(e.target.value) : null)}
          className="px-2 py-1.5 border border-gray-300 rounded text-xs h-8 min-w-[220px]"
        >
          <option value="">Select Employee</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {`${e.firstname ?? ''} ${e.lastname ?? ''}`.trim() || e.email || `Employee #${e.id}`}
            </option>
          ))}
        </select>

        <button
          onClick={() => setWeekStart((w) => shiftWeek(w, -1))}
          className="px-2 py-1.5 border border-gray-300 rounded text-xs h-8 hover:bg-gray-50"
        >
          &larr; Prev Week
        </button>
        <span className="text-xs font-semibold text-slate-700 px-1">
          {days.length ? `${formatDate(days[0].date)} – ${formatDate(days[6].date)}` : ''}
        </span>
        <button
          onClick={() => setWeekStart((w) => shiftWeek(w, 1))}
          className="px-2 py-1.5 border border-gray-300 rounded text-xs h-8 hover:bg-gray-50"
        >
          Next Week &rarr;
        </button>
        <button
          onClick={() => setWeekStart(getMonday(new Date()))}
          className="px-2 py-1.5 border border-gray-300 rounded text-xs h-8 hover:bg-gray-50"
        >
          This Week
        </button>
      </div>

      {loadingDays || days.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-xs">
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
        <div className="border border-gray-200 rounded overflow-auto">
          <table className="border-collapse text-xs" style={{ minWidth: '900px' }}>
            <tbody>
              <tr>
                <td className={`${labelCellCls} bg-slate-50`} colSpan={8}>
                  Employee Name : {employeeLabel}
                </td>
              </tr>
              <tr>
                <td className={`${labelCellCls} bg-slate-50`}>Date</td>
                {days.map((d) => (
                  <td key={d.date} className={`${cellCls} bg-slate-50 font-semibold`}>{formatDate(d.date)}</td>
                ))}
              </tr>
              <tr>
                <td className={`${labelCellCls} bg-slate-50`}>Day</td>
                {days.map((d) => (
                  <td key={d.date} className={cellCls}>{d.day}</td>
                ))}
              </tr>
              <tr>
                <td className={labelCellCls}>First Half<br />Summary</td>
                {days.map((d) => (
                  <td key={d.date} className={manualCellCls}>
                    <textarea
                      defaultValue={d.firstHalfSummary ?? ''}
                      disabled={!canUpdate}
                      onBlur={(e) => {
                        const value = e.target.value;
                        updateDayLocal(d.date, { firstHalfSummary: value });
                        saveManualFields({ ...d, firstHalfSummary: value });
                      }}
                      className="w-full min-w-[110px] h-14 bg-transparent text-xs resize-none focus:outline-none disabled:cursor-not-allowed"
                    />
                  </td>
                ))}
              </tr>
              <tr>
                <td className={labelCellCls}>Second Half<br />Summary</td>
                {days.map((d) => (
                  <td key={d.date} className={manualCellCls}>
                    <textarea
                      defaultValue={d.secondHalfSummary ?? ''}
                      disabled={!canUpdate}
                      onBlur={(e) => {
                        const value = e.target.value;
                        updateDayLocal(d.date, { secondHalfSummary: value });
                        saveManualFields({ ...d, secondHalfSummary: value });
                      }}
                      className="w-full min-w-[110px] h-14 bg-transparent text-xs resize-none focus:outline-none disabled:cursor-not-allowed"
                    />
                  </td>
                ))}
              </tr>
              <tr>
                <td className={`${labelCellCls}`} colSpan={1}>No. of Admissions</td>
                {days.map((d) => (
                  <td key={d.date} className={cellCls}>{d.admissions}</td>
                ))}
              </tr>
              {AUTO_ROWS.map((row, idx) => (
                <tr key={row.key}>
                  {idx === 0 && (
                    <td className={`${labelCellCls} bg-slate-50 text-center`} rowSpan={AUTO_ROWS.length + 1}>
                      Inquiries
                    </td>
                  )}
                  <td className={labelCellCls}>{row.label}</td>
                  {days.map((d) => (
                    <td key={d.date} className={cellCls}>{d[row.key] as number}</td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className={labelCellCls}>Social Media Inquiries</td>
                {days.map((d) => (
                  <td key={d.date} className={manualCellCls}>
                    <input
                      type="number"
                      defaultValue={d.socialMediaInquiries ?? ''}
                      disabled={!canUpdate}
                      onBlur={(e) => {
                        const value = e.target.value === '' ? null : Number(e.target.value);
                        updateDayLocal(d.date, { socialMediaInquiries: value });
                        saveManualFields({ ...d, socialMediaInquiries: value });
                      }}
                      className="w-full min-w-[60px] bg-transparent text-xs text-center focus:outline-none disabled:cursor-not-allowed"
                    />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {savingKey && (
        <div className="text-[10px] text-slate-400">Saving...</div>
      )}

      <div className="flex items-center gap-2 text-[10px] text-slate-500">
        <span className="w-3 h-3 rounded-sm bg-yellow-200 border border-black inline-block" />
        This cell means that this is to be filled by employee, other cells are auto-generated from system data.
      </div>
    </div>
  );
}
