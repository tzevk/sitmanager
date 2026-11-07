'use client';

import { useEffect, useMemo, useState } from 'react';

type Row = {
  userId: number | null;
  name: string;
  leadsHandled: number;
  closures: number;
  conversionPct: number;
};

type Preset = 'today' | 'week' | 'month' | 'last_month' | 'quarter' | 'year' | 'custom';

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'quarter', label: 'Last 3 Months' },
  { key: 'year', label: 'This Year' },
  { key: 'custom', label: 'Custom' },
];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function rangeFor(p: Exclude<Preset, 'custom'>): [string, string] {
  const t = new Date();
  const y = t.getFullYear();
  const m = t.getMonth();
  switch (p) {
    case 'today': return [iso(t), iso(t)];
    case 'week': { const s = new Date(t); s.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return [iso(s), iso(t)]; }
    case 'month': return [iso(new Date(y, m, 1)), iso(t)];
    case 'last_month': return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))];
    case 'quarter': return [iso(new Date(y, m - 2, 1)), iso(t)];
    case 'year': return [iso(new Date(y, 0, 1)), iso(t)];
  }
}

const pctTone = (p: number) => (p >= 10 ? 'text-emerald-700' : p >= 3 ? 'text-[#2E3093]' : 'text-slate-500');

/**
 * Admission closure by employee — for a date range: leads handled (discussed or assigned),
 * admissions closed, and conversion ratio. Closures go to the lead's Assigned Counsellor,
 * or for older leads to the account with the most discussions. CBD + Administration.
 */
export default function AdmissionClosureWidget() {
  const [preset, setPreset] = useState<Preset>('month');
  const [custom, setCustom] = useState<[string, string]>(() => rangeFor('month'));
  const [result, setResult] = useState<{ key: string; rows?: Row[]; error?: string } | null>(null);

  const [from, to] = preset === 'custom' ? custom : rangeFor(preset);
  const key = `${from}|${to}`;
  // Rows/error only count when they belong to the range on screen; otherwise it is loading.
  const current = result?.key === key ? result : null;
  const rows = current?.rows ?? null;
  const error = current?.error ?? '';

  useEffect(() => {
    if (!from || !to || from > to) return;
    let cancelled = false;
    fetch(`/api/dashboard/admission-closure?from=${from}&to=${to}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error || 'Could not load admission closures');
        if (!cancelled) setResult({ key: `${from}|${to}`, rows: d.rows ?? [] });
      })
      .catch((e: unknown) => {
        if (!cancelled) setResult({ key: `${from}|${to}`, error: e instanceof Error ? e.message : 'Could not load admission closures' });
      });
    return () => { cancelled = true; };
  }, [from, to]);

  const totals = useMemo(() => {
    const handled = (rows ?? []).reduce((a, r) => a + r.leadsHandled, 0);
    const closed = (rows ?? []).reduce((a, r) => a + r.closures, 0);
    return { handled, closed, pct: handled ? Math.round((closed / handled) * 1000) / 10 : 0 };
  }, [rows]);
  const maxClosed = Math.max(1, ...(rows ?? []).map((r) => r.closures));

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <header className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-gray-100">
        <h2 className="text-sm font-bold text-[#2E3093] mr-auto">Admission Closure by Employee</h2>
        <select
          value={preset}
          onChange={(e) => setPreset(e.target.value as Preset)}
          aria-label="Date range"
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/25"
        >
          {PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        {preset === 'custom' && (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <input type="date" value={custom[0]} max={custom[1]} onChange={(e) => setCustom([e.target.value, custom[1]])} aria-label="From date"
              className="border border-gray-200 rounded-lg px-1.5 py-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/25" />
            –
            <input type="date" value={custom[1]} min={custom[0]} onChange={(e) => setCustom([custom[0], e.target.value])} aria-label="To date"
              className="border border-gray-200 rounded-lg px-1.5 py-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2A6BB5]/25" />
          </span>
        )}
      </header>

      <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100 text-center">
        {[
          { label: 'Leads Handled', value: rows ? totals.handled : '–' },
          { label: 'Admissions Closed', value: rows ? totals.closed : '–' },
          { label: 'Conversion', value: rows ? `${totals.pct}%` : '–' },
        ].map((k) => (
          <div key={k.label} className="py-2">
            <p className="text-lg font-bold tabular-nums text-[#1a1f3c] leading-tight">{k.value}</p>
            <p className="text-[11px] text-slate-500">{k.label}</p>
          </div>
        ))}
      </div>

      {error ? (
        <p className="px-4 py-4 text-sm text-red-600">{error}</p>
      ) : !rows ? (
        <div className="p-3 space-y-1.5" aria-busy="true">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-6 rounded bg-slate-100 animate-pulse" />)}
        </div>
      ) : rows.length === 0 ? (
        <p className="px-4 py-4 text-sm text-slate-500">No leads handled or admissions closed in this period.</p>
      ) : (
        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50 text-slate-500">
              <tr>
                <th className="text-left font-semibold px-4 py-1.5">Employee</th>
                <th className="text-right font-semibold px-3 py-1.5 whitespace-nowrap">Leads Handled</th>
                <th className="text-right font-semibold px-3 py-1.5">Closed</th>
                <th className="text-right font-semibold px-4 py-1.5">Conversion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.userId ?? 'none'} className="hover:bg-slate-50">
                  <td className="px-4 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`truncate ${r.userId == null ? 'text-slate-400 italic' : 'text-[#1a1f3c] font-medium'}`}>{r.name}</span>
                      <span className="hidden sm:block h-1 flex-1 max-w-[90px] rounded-full bg-slate-100">
                        <span className="block h-1 rounded-full bg-[#2A6BB5]" style={{ width: `${(r.closures / maxClosed) * 100}%` }} />
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{r.leadsHandled}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-[#2E3093]">{r.closures}</td>
                  <td className={`px-4 py-1.5 text-right tabular-nums font-semibold ${pctTone(r.conversionPct)}`}>
                    {r.leadsHandled ? `${r.conversionPct}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="px-4 py-1.5 text-[10px] text-slate-400 border-t border-gray-100">
        Closures go to the assigned counsellor; older leads to the account with the most discussions.
      </p>
    </section>
  );
}
