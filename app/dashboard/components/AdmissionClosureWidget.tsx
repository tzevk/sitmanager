'use client';

import { useEffect, useState } from 'react';

type Row = {
  userId: number | null;
  name: string;
  total: number;
  thisMonth: number;
  lastMonth: number;
  thisYear: number;
};

/**
 * Admission closure by employee — closed admissions credited to the lead's Assigned Counsellor,
 * or (older leads) to the account that handled most of its discussions. CBD + Administration.
 */
export default function AdmissionClosureWidget() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/dashboard/admission-closure')
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error || 'Could not load admission closures');
        if (!cancelled) setRows(d.rows ?? []);
      })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load admission closures'); });
    return () => { cancelled = true; };
  }, []);

  const sum = (k: keyof Omit<Row, 'userId' | 'name'>) => (rows ?? []).reduce((a, r) => a + r[k], 0);
  const max = Math.max(1, ...(rows ?? []).map((r) => r.thisYear));

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <header className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 sm:px-5 border-b border-gray-100">
        <div>
          <h2 className="text-sm font-bold text-[#2E3093]">Admission Closure by Employee</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Credited to the assigned counsellor; older leads go to the account with the most discussions.
          </p>
        </div>
        {rows && (
          <p className="text-xs text-slate-500">
            This month <span className="font-semibold text-[#1a1f3c]">{sum('thisMonth')}</span>
            {' · '}This year <span className="font-semibold text-[#1a1f3c]">{sum('thisYear')}</span>
          </p>
        )}
      </header>

      {error ? (
        <p className="px-5 py-6 text-sm text-red-600">{error}</p>
      ) : !rows ? (
        <div className="p-4 space-y-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-7 rounded bg-slate-100 animate-pulse" />)}
        </div>
      ) : rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-500">No admissions closed yet.</p>
      ) : (
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 text-xs text-slate-500">
              <tr>
                <th className="text-left font-semibold px-4 py-2">Employee</th>
                <th className="text-right font-semibold px-3 py-2 whitespace-nowrap">This Month</th>
                <th className="text-right font-semibold px-3 py-2 whitespace-nowrap">Last Month</th>
                <th className="text-right font-semibold px-3 py-2 whitespace-nowrap">This Year</th>
                <th className="text-right font-semibold px-4 py-2">All Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.userId ?? 'none'} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <span className={r.userId == null ? 'text-slate-400 italic' : 'text-[#1a1f3c] font-medium'}>{r.name}</span>
                    <div className="mt-1 h-1 rounded-full bg-slate-100 max-w-[160px]">
                      <div className="h-1 rounded-full bg-[#2A6BB5]" style={{ width: `${(r.thisYear / max) * 100}%` }} />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-[#2E3093]">{r.thisMonth}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600">{r.lastMonth}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600">{r.thisYear}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-600">{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
