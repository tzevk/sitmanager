'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePermissions } from '@/lib/permissions-context';
import MonitoringWeeklyTable, { type MonitoringDayRow } from './MonitoringWeeklyTable';

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

/**
 * "My Weekly Report" — the logged-in user's own monitoring table, shown right on
 * their dashboard home. No employee dropdown (always their own data, via the
 * self-service /api/monitoring/weekly/me endpoint keyed off the session).
 */
export default function MonitoringWidget() {
  const { session, loading: sessionLoading } = usePermissions();
  const [weekStart, setWeekStart] = useState<string>(() => getMonday(new Date()));
  const [days, setDays] = useState<MonitoringDayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  const fetchWeek = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/monitoring/weekly/me?weekStart=${weekStart}`);
      const data = await res.json();
      setDays(data.days || []);
    } catch {
      setDays([]);
    }
    setLoading(false);
  }, [session, weekStart]);

  useEffect(() => { fetchWeek(); }, [fetchWeek]);

  const handleSaveDay = async (row: MonitoringDayRow) => {
    setDays((prev) => prev.map((d) => (d.date === row.date ? row : d)));
    try {
      await fetch('/api/monitoring/weekly/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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

  if (sessionLoading || !session) return null;

  const employeeLabel = `${session.firstName ?? ''} ${session.lastName ?? ''}`.trim() || session.email || 'Me';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-xs font-black text-[#2E3093] uppercase tracking-wide">My Weekly Report</h3>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/monitoring" className="text-[11px] font-semibold text-[#2E3093] hover:underline">
            Full Monitoring &rarr;
          </Link>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="text-[11px] font-semibold text-slate-400 hover:text-slate-600"
          >
            {collapsed ? 'Expand' : 'Collapse'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <button
              onClick={() => setWeekStart((w) => shiftWeek(w, -1))}
              className="px-2 py-1 border border-gray-300 rounded text-[11px] hover:bg-gray-50"
            >
              &larr; Prev
            </button>
            <span className="text-[11px] font-semibold text-slate-700">
              {days.length ? `${formatDate(days[0].date)} – ${formatDate(days[6].date)}` : ''}
            </span>
            <button
              onClick={() => setWeekStart((w) => shiftWeek(w, 1))}
              className="px-2 py-1 border border-gray-300 rounded text-[11px] hover:bg-gray-50"
            >
              Next &rarr;
            </button>
            <button
              onClick={() => setWeekStart(getMonday(new Date()))}
              className="px-2 py-1 border border-gray-300 rounded text-[11px] hover:bg-gray-50"
            >
              This Week
            </button>
          </div>

          {loading ? (
            <div className="text-[11px] text-slate-400 py-3 text-center">Loading...</div>
          ) : (
            <MonitoringWeeklyTable
              employeeLabel={employeeLabel}
              days={days}
              canEdit
              onSaveDay={handleSaveDay}
            />
          )}
        </>
      )}
    </div>
  );
}
