'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AppointmentDetailModal, ModeBadge, StatusBadge, fmt12, fmtDate, programOf, type Appointment,
} from '../appointments/_components/shared';

interface Summary {
  date: string;
  counts: { total: number; upcoming: number; pending: number; completed: number; no_show: number; cancelled: number };
  next: Appointment | null;
  today: Appointment[];
  canManage: boolean;
  isCounsellor: boolean;
}

const REFRESH_MS = 2 * 60 * 1000;

/**
 * Today's Appointments — sits above Pending Fees on the CBD dashboard.
 * Counsellors see their own appointments; appointment.manage sees everyone's.
 * Renders nothing for users with no appointment access (API returns 401/403).
 */
export default function AppointmentsWidget() {
  const [data, setData] = useState<Summary | null>(null);
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/appointments/summary', { cache: 'no-store' });
      if (r.status === 401 || r.status === 403) { setHidden(true); return; }
      const d = await r.json();
      if (d.success) setData(d);
    } catch {
      /* keep last data */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  if (hidden) return null;

  const c = data?.counts;
  const stats: { label: string; value: number | undefined; cls: string }[] = [
    { label: 'Total today', value: c?.total, cls: 'text-gray-900' },
    { label: 'Upcoming', value: c?.upcoming, cls: 'text-blue-700' },
    { label: 'Completed', value: c?.completed, cls: 'text-emerald-700' },
    { label: 'Pending', value: c?.pending, cls: 'text-amber-700' },
    { label: 'No show', value: c?.no_show, cls: 'text-orange-700' },
  ];
  const next = data?.next;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-indigo-100 bg-gradient-to-r from-indigo-50/80 via-white to-white">
        <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-indigo-100 text-[#2E3093]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-gray-800 text-sm tracking-tight">Today&apos;s Appointments</p>
          <p className="text-[11px] text-gray-500">{data?.canManage ? 'All counsellors' : 'Your counselling appointments'}{data ? ` · ${fmtDate(data.date, { weekday: 'short', day: 'numeric', month: 'short' })}` : ''}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/appointments/calendar" className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">View Calendar</Link>
          <Link href="/dashboard/appointments" className="rounded-lg bg-[#2E3093] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#252780]">Manage Appointments</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-0">
        <div className="p-4">
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {stats.map((s) => (
              <div key={s.label} className="rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{s.label}</p>
                <p className={`text-lg font-black tabular-nums ${s.cls}`}>{loading ? '–' : s.value ?? 0}</p>
              </div>
            ))}
          </div>

          {!loading && data && data.today.length > 0 && (
            <ul className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-100">
              {data.today.map((a) => (
                <li key={a.id}>
                  <button onClick={() => setOpenId(a.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-gray-50">
                    <span className="w-16 shrink-0 text-xs font-bold tabular-nums text-gray-700">{fmt12(a.start_time)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-gray-800">{a.first_name} {a.last_name}</span>
                      <span className="block truncate text-[11px] text-gray-500">{programOf(a)}{data.canManage && a.counsellor_name ? ` · ${a.counsellor_name}` : ''}</span>
                    </span>
                    <ModeBadge mode={a.mode} />
                    <StatusBadge appt={a} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!loading && data && data.today.length === 0 && (
            <p className="mt-3 text-center text-xs text-gray-400">No appointments today.</p>
          )}
        </div>

        <div className="border-t lg:border-t-0 lg:border-l border-gray-100 bg-indigo-50/30 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Next appointment</p>
          {loading ? (
            <p className="mt-2 text-sm text-gray-400">Loading…</p>
          ) : next ? (
            <button onClick={() => setOpenId(next.id)} className="mt-2 block w-full rounded-lg border border-indigo-100 bg-white p-3 text-left shadow-sm hover:border-indigo-200">
              <p className="text-xl font-black tabular-nums text-[#2E3093]">{fmt12(next.start_time)}</p>
              {next.appt_date !== data?.date && <p className="text-[11px] font-semibold text-gray-500">{fmtDate(next.appt_date, { weekday: 'short', day: 'numeric', month: 'short' })}</p>}
              <p className="mt-1 font-bold text-gray-900">{next.first_name} {next.last_name}</p>
              <p className="text-xs text-gray-600">{programOf(next)}</p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <ModeBadge mode={next.mode} />
                {data?.canManage && next.counsellor_name && <span className="truncate text-[11px] text-gray-500">{next.counsellor_name}</span>}
              </div>
            </button>
          ) : (
            <p className="mt-2 text-sm text-gray-400">Nothing scheduled.</p>
          )}
        </div>
      </div>

      {openId && <AppointmentDetailModal id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}
