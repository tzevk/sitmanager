'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Lead { Inquiry_Id: number; Student_Name: string | null; Reason: 'Follow-up due' | 'Overdue' | 'New lead'; CourseName: string | null }
interface Appt { id: number; start_time: string; name: string }

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Today's tasks for the logged-in account — sits beside the Follow-ups Due banner. */
export default function MyTasksWidget({ returnTo }: { returnTo: string }) {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/inquiry/my-tasks?date=${localToday()}&owner=me`, { cache: 'no-store' })
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(); if (active) { setLeads(d.leads || []); setAppts(d.appointments || []); } })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);

  const count = (r: Lead['Reason']) => (leads || []).filter((l) => l.Reason === r).length;
  const stats: [string, number, string][] = [
    ['Follow-ups due', count('Follow-up due'), 'text-sky-700'],
    ['Overdue', count('Overdue'), 'text-rose-600'],
    ['New leads', count('New lead'), 'text-emerald-600'],
    ['Appointments', appts.length, 'text-[#2E3093]'],
  ];
  const next = (leads || []).filter((l) => l.Reason !== 'New lead').slice(0, 4);

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-indigo-100">
        <span className="text-[11px] font-black uppercase tracking-wider text-indigo-900">My Tasks · Today</span>
        <Link href="/dashboard/my-tasks" className="text-[10px] font-bold text-[#2E3093] hover:underline">Open →</Link>
      </div>
      {failed ? (
        <p className="px-3 py-3 text-xs text-slate-500">Could not load your tasks.</p>
      ) : leads === null ? (
        <p className="px-3 py-3 text-xs text-slate-400">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-1 px-2 py-2">
            {stats.map(([label, n, c]) => (
              <div key={label} className="rounded-lg bg-white/70 px-1 py-1 text-center">
                <div className={`text-base font-black leading-tight ${c}`}>{n}</div>
                <div className="text-[9px] font-semibold leading-tight text-slate-500">{label}</div>
              </div>
            ))}
          </div>
          {next.length > 0 && (
            <ul className="divide-y divide-indigo-100 border-t border-indigo-100">
              {next.map((l) => (
                <li key={l.Inquiry_Id} className="flex items-center gap-2 px-3 py-1 text-[11px]">
                  <span className="truncate font-semibold text-slate-800">{l.Student_Name || '—'}</span>
                  <span className={`ml-auto shrink-0 text-[9px] font-bold ${l.Reason === 'Overdue' ? 'text-rose-600' : 'text-sky-700'}`}>{l.Reason}</span>
                  <Link href={`/dashboard/inquiry/add?editId=${l.Inquiry_Id}&returnTo=${encodeURIComponent(returnTo)}`} className="shrink-0 font-bold text-[#2E3093] hover:underline">Open</Link>
                </li>
              ))}
            </ul>
          )}
          {next.length === 0 && appts.length === 0 && <p className="px-3 pb-2 text-[11px] text-slate-400">Nothing due for you today.</p>}
        </>
      )}
    </div>
  );
}
