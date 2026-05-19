'use client';

import { useCallback, useState, useEffect } from 'react';

interface PlanRow {
  Plan_Id: number;
  Training_Program_Name: string;
  Target_Frequency: number;
  Min_Students_Per_Batch: number;
  Students_Admitted: number;
  Yearly_Students_Target: number;
  Frequency_Conducted: number;
  Percentage: number;
}

function Bar({ value }: { value: number }) {
  const clamped = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
  const color = clamped >= 80 ? 'bg-emerald-500' : clamped >= 50 ? 'bg-amber-400' : 'bg-rose-500';
  const text  = clamped >= 80 ? 'text-emerald-600' : clamped >= 50 ? 'text-amber-600' : 'text-rose-600';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${clamped}%` }} />
      </div>
      <span className={`text-[11px] font-bold tabular-nums w-10 text-right ${text}`}>
        {Number.isFinite(value) ? `${value.toFixed(1)}%` : '0.0%'}
      </span>
    </div>
  );
}

export default function AnnualTargetsWidget() {
  const currentYear = new Date().getFullYear();
  const [year, setYear]     = useState(currentYear);
  const [rows, setRows]     = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (y: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/masters/annual-batch/plan?year=${y}`, { cache: 'no-store' });
      if (res.ok) {
        const all: PlanRow[] = (await res.json()).rows ?? [];
        setRows(all.filter(r =>
          Number(r.Yearly_Students_Target) > 0 ||
          (Number(r.Target_Frequency) > 0 && Number(r.Min_Students_Per_Batch) > 0)
        ));
      } else {
        setRows([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(year); }, [load, year]);

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100" style={{ borderLeft: '3px solid #2E3093' }}>
        <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, #2E3093 10%, transparent)' }}>
          <span style={{ color: '#2E3093' }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
            </svg>
          </span>
        </span>
        <span className="font-bold text-gray-800 text-sm flex-1">Annual Targets</span>
        {!loading && rows.length > 0 && (
          <span className="text-[11px] font-semibold text-gray-400 tabular-nums">{rows.length} programmes</span>
        )}
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          className="text-xs font-semibold rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm [&_th]:border-r [&_th]:border-gray-300 [&_th:last-child]:border-r-0 [&_td]:border-r [&_td]:border-gray-200 [&_td:last-child]:border-r-0">
          <thead className="bg-gray-50 border-b border-gray-300">
            <tr>
              <th className="py-2.5 px-5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 text-left">Training Programme Name</th>
              <th className="py-2.5 px-4 text-[11px] font-semibold uppercase tracking-wide text-gray-500 text-center">Target Students</th>
              <th className="py-2.5 px-4 text-[11px] font-semibold uppercase tracking-wide text-gray-500 text-center">Students Admitted</th>
              <th className="py-2.5 px-4 text-[11px] font-semibold uppercase tracking-wide text-gray-500 text-center">Avg per Batch</th>
              <th className="py-2.5 px-4 text-[11px] font-semibold uppercase tracking-wide text-gray-500 text-left w-44">% Achieved</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-t border-gray-200">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: j === 0 ? '70%' : '40%' }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400">
                  No annual batch plan found for {year}
                </td>
              </tr>
            ) : (
              rows.map((r, i) => {
                const tgt    = Number(r.Yearly_Students_Target) ||
                               (Number(r.Target_Frequency) * Number(r.Min_Students_Per_Batch));
                const adm    = Number(r.Students_Admitted) || 0;
                const freq   = Number(r.Frequency_Conducted) || Number(r.Target_Frequency) || 1;
                const avg    = freq > 0 ? adm / freq : 0;
                const pct    = Number(r.Percentage) || (tgt > 0 ? (adm / tgt) * 100 : 0);
                return (
                  <tr key={r.Plan_Id} className={`border-t border-gray-200 hover:bg-gray-50/50 transition-colors ${i % 2 === 1 ? 'bg-gray-50/30' : ''}`}>
                    <td className="px-5 py-3.5 font-semibold text-gray-800">{r.Training_Program_Name}</td>
                    <td className="px-4 py-3.5 text-center tabular-nums text-gray-600">{tgt.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3.5 text-center tabular-nums font-semibold text-gray-800">{adm.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3.5 text-center tabular-nums text-gray-500">{avg.toFixed(1)}</td>
                    <td className="px-4 py-3.5 w-44"><Bar value={pct} /></td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
