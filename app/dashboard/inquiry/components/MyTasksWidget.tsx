'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Scope = 'allocated' | 'initiated';
interface Lead { Inquiry_Id: number; Student_Name: string | null; Reason: 'Follow-up due' | 'Overdue' | 'Upcoming' | 'New lead' | 'Lead'; CourseName: string | null }
interface Appt { id: number; start_time: string; name: string }
interface ScopeData { leads: Lead[]; appts: Appt[] }

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const TABS: { value: Scope; label: string }[] = [
  { value: 'allocated', label: 'My allocated tasks' },
  { value: 'initiated', label: 'My initiated leads' },
];

/** Today's tasks for the logged-in account — sits beside the Follow-ups Due banner. */
export default function MyTasksWidget({ returnTo }: { returnTo: string }) {
  const [data, setData] = useState<Record<Scope, ScopeData> | null>(null);
  const [scope, setScope] = useState<Scope>('allocated');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const date = localToday();
    const load = async (s: Scope): Promise<ScopeData> => {
      const r = await fetch(`/api/inquiry/my-tasks?date=${date}&owner=me&scope=${s}`, { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error();
      return { leads: d.leads || [], appts: d.appointments || [] };
    };
    Promise.all([load('allocated'), load('initiated')])
      .then(([allocated, initiated]) => { if (active) setData({ allocated, initiated }); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);

  const current = data?.[scope];
  const count = (r: Lead['Reason']) => (current?.leads || []).filter((l) => l.Reason === r).length;
  const stats: [string, number, string][] = [
    ['Follow-ups due', count('Follow-up due'), 'text-sky-700'],
    ['Overdue', count('Overdue'), 'text-rose-600'],
    ['New leads', count('New lead'), 'text-emerald-600'],
    ['Appointments', current?.appts.length ?? 0, 'text-[#2E3093]'],
  ];
  const actionable = (d: ScopeData | undefined) => (d?.leads || []).filter((l) => l.Reason !== 'New lead' && l.Reason !== 'Lead');
  const next = actionable(current).slice(0, 4);
  const href = `/dashboard/my-tasks${scope === 'initiated' ? '?scope=initiated' : ''}`;

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-indigo-100">
        <span className="text-[11px] font-black uppercase tracking-wider text-indigo-900">My Tasks · Today</span>
        <Link href={href} className="text-[10px] font-bold text-[#2E3093] hover:underline">Open →</Link>
      </div>
      {failed ? (
        <p className="px-3 py-3 text-xs text-slate-500">Could not load your tasks.</p>
      ) : data === null ? (
        <p className="px-3 py-3 text-xs text-slate-400">Loading…</p>
      ) : (
        <>
          <div className="flex gap-1 px-2 pt-2" role="tablist" aria-label="Which tasks">
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={scope === t.value}
                onClick={() => setScope(t.value)}
                className={`flex-1 rounded-md px-1.5 py-1 text-[10px] font-bold leading-tight transition-colors ${scope === t.value ? 'bg-[#2E3093] text-white' : 'bg-white/70 text-slate-600 hover:bg-white'}`}
              >
                {t.label}
                <span className={`ml-1 rounded-full px-1.5 ${scope === t.value ? 'bg-white/20' : 'bg-indigo-100 text-indigo-800'}`}>{actionable(data[t.value]).length}</span>
              </button>
            ))}
          </div>
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
          {next.length === 0 && (current?.appts.length ?? 0) === 0 && (
            <p className="px-3 pb-2 text-[11px] text-slate-400">
              {scope === 'allocated' ? 'Nothing due for you today.' : 'None of the leads you started are due today.'}
            </p>
          )}
        </>
      )}
    </div>
  );
}
