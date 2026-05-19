'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { apiFetch } from '../shared/api';
import { fmt, monthLabel } from '../shared/format';
import type { DeptPerf } from '../shared/types';

interface MonthlyRow { month_year: string; achieved: number; target: number }

const DEFAULT_DEPTS = ['CBD / Inhouse', 'Corporate Training', 'Accent Deputation', 'Accent Projects'];

export default function RevenueByDeptChart({ year }: { year: number }) {
  const [dept, setDept] = useState<string>('All');
  const [mode, setMode] = useState<'bar' | 'line'>('bar');
  const [rows, setRows] = useState<DeptPerf[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    // Fetch all year's dept-performance entries; backend ignores unknown query keys gracefully.
    apiFetch<{ rows: DeptPerf[] }>(`/api/finance/dept-performance?year=${year}`)
      .then(d => { if (alive) { setRows(d.rows ?? []); setLoading(false); } })
      .catch(() => { if (alive) { setRows([]); setLoading(false); } });
    return () => { alive = false; };
  }, [year]);

  const departments = useMemo(() => {
    const seen = new Set<string>(DEFAULT_DEPTS);
    rows.forEach(r => seen.add(r.department));
    return ['All', ...Array.from(seen)];
  }, [rows]);

  const chartData: MonthlyRow[] = useMemo(() => {
    const filtered = dept === 'All' ? rows : rows.filter(r => r.department === dept);
    const byMonth = new Map<string, MonthlyRow>();
    for (const r of filtered) {
      // accept either month_year (ISO YYYY-MM) or already-truncated string
      const key = String(r.month_year ?? '').slice(0, 7);
      if (!key.startsWith(`${year}-`)) continue;
      const cur = byMonth.get(key) ?? { month_year: key, achieved: 0, target: 0 };
      cur.achieved += Number(r.amount_achieved || 0);
      cur.target   += Number(r.target_amount   || 0);
      byMonth.set(key, cur);
    }
    // Always emit 12 months for visual consistency
    const out: MonthlyRow[] = [];
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, '0')}`;
      out.push(byMonth.get(key) ?? { month_year: key, achieved: 0, target: 0 });
    }
    return out;
  }, [rows, dept, year]);

  const total = useMemo(() => chartData.reduce((s, r) => s + r.achieved, 0), [chartData]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div>
          <p className="text-[11px] font-semibold text-[#2E3093] uppercase tracking-wider">
            Revenue by Department — {year}
          </p>
          <p className="text-[10px] text-gray-500">Total achieved: {fmt(total)}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dept}
            onChange={e => setDept(e.target.value)}
            className="text-xs rounded-lg border border-gray-200 bg-white px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-[#2E3093]/20 focus:border-[#2E3093]"
          >
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs">
            <button
              onClick={() => setMode('bar')}
              className={`px-2.5 py-1 ${mode === 'bar' ? 'bg-[#2E3093] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >Bar</button>
            <button
              onClick={() => setMode('line')}
              className={`px-2.5 py-1 ${mode === 'line' ? 'bg-[#2E3093] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >Line</button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-72 flex items-center justify-center text-xs text-gray-400">Loading…</div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
            {mode === 'bar' ? (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month_year" tickFormatter={(v: string) => monthLabel(v)} fontSize={10} />
                <YAxis fontSize={10} tickFormatter={(v: number) => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : String(v)} />
                <Tooltip formatter={(v) => fmt(Number(v))} labelFormatter={(label) => monthLabel(String(label))} contentStyle={{ fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="achieved" fill="#2E3093" name="Achieved" radius={[4, 4, 0, 0]} />
                <Bar dataKey="target"   fill="#FAE452" name="Target"   radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month_year" tickFormatter={(v: string) => monthLabel(v)} fontSize={10} />
                <YAxis fontSize={10} tickFormatter={(v: number) => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : String(v)} />
                <Tooltip formatter={(v) => fmt(Number(v))} labelFormatter={(label) => monthLabel(String(label))} contentStyle={{ fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="achieved" stroke="#2E3093" strokeWidth={2} dot={{ r: 3 }} name="Achieved" />
                <Line type="monotone" dataKey="target"   stroke="#F09819" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3 }} name="Target" />
              </LineChart>
            )}
          </ResponsiveContainer>
      )}
    </div>
  );
}
