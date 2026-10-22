'use client';

import { useEffect, useMemo, useState } from 'react';

interface Row { day: string; batch: string; userId: number | null; contacted: number; followedUp: number; admitted: number }
interface BatchTotal { code: string; course: string | null; contacted: number; followedUp: number; admitted: number }
interface Staff { id: number; name: string }

/** Initials like the whiteboard columns (M.J., V.P., …). */
const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((p) => p[0].toUpperCase()).slice(0, 3).join('.');

/**
 * Daily activity board — the whiteboard in widget form. For the month of `date` it shows, per batch,
 * what each counsellor did each day: Contacted · Followed up · Admitted.
 */
export default function DailyActivityWidget({ date, owner }: { date: string; owner: string }) {
  const month = date.slice(0, 7);
  const [rows, setRows] = useState<Row[]>([]);
  const [batches, setBatches] = useState<BatchTotal[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [batch, setBatch] = useState('');
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    fetch(`/api/inquiry/my-tasks?date=${month}-01&owner=${encodeURIComponent(owner)}&view=activity`, { cache: 'no-store' })
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Failed to load'); return d; })
      .then((d) => { if (!active) return; setRows(d.rows || []); setBatches(d.batches || []); setStaff(d.staff || []); })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Failed to load'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [month, owner]);

  useEffect(() => { if (!batches.find((b) => b.code === batch)) setBatch(batches[0]?.code ?? ''); }, [batches, batch]);

  const nameOf = (id: number | null) => (id == null ? 'Unassigned' : staff.find((s) => s.id === id)?.name ?? `User ${id}`);

  const grid = useMemo(() => {
    const mine = rows.filter((r) => r.batch === batch);
    const users = [...new Set(mine.map((r) => r.userId))].sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
    const days = [...new Set(mine.map((r) => r.day))].sort();
    const at = (day: string, u: number | null) => mine.find((r) => r.day === day && r.userId === u);
    return { users, days, at };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, batch, staff]);

  const totals = batches.reduce((t, b) => ({ c: t.c + b.contacted, f: t.f + b.followedUp, a: t.a + b.admitted }), { c: 0, f: 0, a: 0 });
  const monthLabel = new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const num = (n: number, cls: string) => <span className={n ? `font-bold ${cls}` : 'text-slate-300'}>{n}</span>;

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 text-left">
          <span className="text-xs font-black uppercase tracking-wider text-slate-700">Daily activity · {monthLabel}</span>
          <span className="text-[10px] text-slate-400">{open ? '▲' : '▼'}</span>
        </button>
        <div className="flex gap-3 text-[10px] font-semibold text-slate-500">
          <span className="text-sky-700">● Contacted {totals.c}</span>
          <span className="text-violet-700">● Followed up {totals.f}</span>
          <span className="text-emerald-700">● Admitted {totals.a}</span>
        </div>
      </header>
      {open && (
        <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          {error && <p className="col-span-full rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}

          {/* Summary — the board's "Training program / Batch no / Admissions" table */}
          <div className="max-h-80 overflow-auto rounded-lg border border-slate-100">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-2 py-1.5 text-left">Training program</th>
                  <th className="px-2 py-1.5 text-left">Batch</th>
                  <th className="px-2 py-1.5 text-right" title="Contacted">Cont.</th>
                  <th className="px-2 py-1.5 text-right" title="Followed up">Foll.</th>
                  <th className="px-2 py-1.5 text-right" title="Admitted">Adm.</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={5} className="py-6 text-center text-slate-400">Loading…</td></tr>}
                {!loading && batches.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-slate-400">No activity this month.</td></tr>}
                {batches.map((b) => (
                  <tr key={b.code} onClick={() => setBatch(b.code)} className={`cursor-pointer border-t border-slate-100 ${b.code === batch ? 'bg-[#2E3093]/10' : 'hover:bg-slate-50'}`}>
                    <td className="max-w-[160px] truncate px-2 py-1.5 text-slate-700">{b.course || '—'}</td>
                    <td className="px-2 py-1.5 font-mono text-slate-600">{b.code}</td>
                    <td className="px-2 py-1.5 text-right">{num(b.contacted, 'text-sky-700')}</td>
                    <td className="px-2 py-1.5 text-right">{num(b.followedUp, 'text-violet-700')}</td>
                    <td className="px-2 py-1.5 text-right">{num(b.admitted, 'text-emerald-700')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Per-batch day × counsellor board */}
          <div className="max-h-80 overflow-auto rounded-lg border border-slate-100">
            {batch ? (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-2 py-1.5 text-left">{batch}</th>
                    {grid.users.map((u) => <th key={String(u)} className="px-2 py-1.5 text-center" title={nameOf(u)}>{u == null ? '—' : initials(nameOf(u))}</th>)}
                    <th className="px-2 py-1.5 text-center">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {grid.days.map((day) => {
                    const dayRows = grid.users.map((u) => grid.at(day, u));
                    const sum = (k: 'contacted' | 'followedUp' | 'admitted') => dayRows.reduce((n, r) => n + (r?.[k] ?? 0), 0);
                    return (
                      <tr key={day} className="border-t border-slate-100">
                        <td className="whitespace-nowrap px-2 py-1 font-semibold text-slate-600">{day.slice(8)}/{day.slice(5, 7)}</td>
                        {dayRows.map((r, i) => (
                          <td key={i} className="whitespace-nowrap px-2 py-1 text-center">
                            {r ? <>{num(r.contacted, 'text-sky-700')}<span className="text-slate-300">/</span>{num(r.followedUp, 'text-violet-700')}<span className="text-slate-300">/</span>{num(r.admitted, 'text-emerald-700')}</> : <span className="text-slate-300">—</span>}
                          </td>
                        ))}
                        <td className="whitespace-nowrap px-2 py-1 text-center font-semibold">{sum('contacted')}/{sum('followedUp')}/{sum('admitted')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : !loading && <p className="py-6 text-center text-xs text-slate-400">Pick a batch.</p>}
            <p className="border-t border-slate-100 px-2 py-1 text-[10px] text-slate-400">Each cell: Contacted / Followed up / Admitted</p>
          </div>
        </div>
      )}
    </section>
  );
}
