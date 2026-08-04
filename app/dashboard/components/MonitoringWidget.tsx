'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useResourcePermissions } from '@/lib/permissions-context';

interface AdminUserOption {
  id: number;
  firstname: string | null;
  lastname: string | null;
  email: string | null;
}

interface MonitoringDayRow {
  date: string;
  admissions: number;
  incomingCalls: number;
  freshCallsMeta: number;
  freshCallsOthers: number;
  whatsapp: number;
  followupCalls: number;
  walkIns: number;
  emailsReplied: number;
}

function getMonday(base: Date): string {
  const d = new Date(Date.UTC(base.getFullYear(), base.getMonth(), base.getDate()));
  const dow = d.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

const STAT_LABELS: { key: keyof MonitoringDayRow; label: string }[] = [
  { key: 'incomingCalls', label: 'Calls' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'emailsReplied', label: 'Emails' },
  { key: 'walkIns', label: 'Walk-ins' },
  { key: 'admissions', label: 'Admissions' },
];

export default function MonitoringWidget() {
  const { canView, loading: permLoading } = useResourcePermissions('monitoring');
  const [employees, setEmployees] = useState<AdminUserOption[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [today, setToday] = useState<MonitoringDayRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canView) return;
    fetch('/api/monitoring/employees')
      .then((res) => res.json())
      .then((data) => {
        const list: AdminUserOption[] = data.employees || [];
        setEmployees(list);
        setSelectedEmployeeId((prev) => prev ?? list[0]?.id ?? null);
      })
      .catch(() => {});
  }, [canView]);

  const fetchToday = useCallback(async () => {
    if (!selectedEmployeeId) return;
    setLoading(true);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const weekStart = getMonday(new Date());
      const res = await fetch(`/api/monitoring/weekly?adminUserId=${selectedEmployeeId}&weekStart=${weekStart}`);
      const data = await res.json();
      const days: MonitoringDayRow[] = data.days || [];
      setToday(days.find((d) => d.date === todayStr) || days[days.length - 1] || null);
    } catch {
      setToday(null);
    }
    setLoading(false);
  }, [selectedEmployeeId]);

  useEffect(() => { fetchToday(); }, [fetchToday]);

  if (permLoading || !canView) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-xs font-black text-[#2E3093] uppercase tracking-wide">Monitoring — Today</h3>
        <Link href="/dashboard/monitoring" className="text-[11px] font-semibold text-[#2E3093] hover:underline">
          View full report &rarr;
        </Link>
      </div>

      <select
        value={selectedEmployeeId ?? ''}
        onChange={(e) => setSelectedEmployeeId(e.target.value ? Number(e.target.value) : null)}
        className="w-full mb-2 px-2 py-1 border border-slate-200 rounded text-xs"
      >
        <option value="">Select Employee</option>
        {employees.map((e) => (
          <option key={e.id} value={e.id}>
            {`${e.firstname ?? ''} ${e.lastname ?? ''}`.trim() || e.email || `Employee #${e.id}`}
          </option>
        ))}
      </select>

      {loading ? (
        <div className="text-[11px] text-slate-400 py-3 text-center">Loading...</div>
      ) : !today ? (
        <div className="text-[11px] text-slate-400 py-3 text-center">No employee selected.</div>
      ) : (
        <div className="grid grid-cols-5 gap-1.5">
          {STAT_LABELS.map((s) => (
            <div key={s.key} className="text-center bg-slate-50 rounded-lg py-1.5">
              <div className="text-sm font-black text-[#2E3093]">{today[s.key]}</div>
              <div className="text-[9px] text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
