'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { apiFetch } from '../shared/api';
import { fmt, monthLabel, isCountableCashflow, monthsInFinancialYear } from '../shared/format';
import type { DeptPerf, CashflowTxn } from '../shared/types';
import { DEPT_TURNOVER_TARGETS } from '../shared/targets';

interface MonthlyRow { month_year: string; achieved: number; target: number }

// Same monthly turnover targets used by the Overview tab's Department-wise
// Breakdown table, so both views always agree.
const HARDCODED_MONTHLY_TARGET: Record<string, number> = {
  'CBD / Inhouse': DEPT_TURNOVER_TARGETS.cbd.monthly,
  'Corporate Training': DEPT_TURNOVER_TARGETS.corporate.monthly,
  'Accent Deputation': DEPT_TURNOVER_TARGETS.deputation.monthly,
  'Accent Projects': DEPT_TURNOVER_TARGETS.accentProjects.monthly,
};

// Maps a real finance_cashflow.department value to this chart's display label.
function mapCashflowDept(dept: string | null): string | null {
  const d = (dept || '').toUpperCase();
  if (d === 'CBD') return 'CBD / Inhouse';
  if (d === 'CORPORATE TRAINING') return 'Corporate Training';
  if (d === 'DEPUTATION ACCENT') return 'Accent Deputation';
  if (d === 'PROJECT ACCENT') return 'Accent Projects';
  return null;
}

const DEFAULT_DEPTS = ['CBD / Inhouse', 'Corporate Training', 'Accent Deputation', 'Accent Projects'];

// Raw dept-performance department values that should never appear in the
// filter dropdown as their own entries — they're duplicates of DEFAULT_DEPTS
// under different spellings (e.g. "CBD" vs "CBD / Inhouse").
const EXCLUDED_RAW_DEPTS = new Set(['CBD', 'Deputation - Accent', 'Projects - Accent']);

export default function RevenueByDeptChart({ year }: { year: number }) {
  const [dept, setDept] = useState<string>('All');
  const [mode, setMode] = useState<'bar' | 'line'>('bar');
  const [deptPerfRows, setDeptPerfRows] = useState<DeptPerf[]>([]);
  const [cashflowRows, setCashflowRows] = useState<CashflowTxn[]>([]);
  const [loading, setLoading] = useState(true);

  // Financial year: April `year` – March `year + 1`.
  const fyMonths = useMemo(() => monthsInFinancialYear(year), [year]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      apiFetch<{ rows: DeptPerf[] }>(`/api/finance/dept-performance`).catch(() => ({ rows: [] })),
      apiFetch<{ rows: CashflowTxn[] }>(`/api/finance/cashflow`).catch(() => ({ rows: [] })),
    ]).then(([deptPerf, cashflow]) => {
      if (!alive) return;
      setDeptPerfRows(deptPerf.rows ?? []);
      setCashflowRows(cashflow.rows ?? []);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [year]);

  const departments = useMemo(() => {
    const seen = new Set<string>(DEFAULT_DEPTS);
    deptPerfRows.forEach(r => { if (!EXCLUDED_RAW_DEPTS.has(r.department)) seen.add(r.department); });
    return ['All', ...Array.from(seen)];
  }, [deptPerfRows]);

  /** Real cashflow receipts, mapped to display department + month (YYYY-MM). */
  const cashflowAchievedByDeptMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const txn of cashflowRows) {
      if (txn.type !== 'Receipt' || !txn.date) continue;
      if (!isCountableCashflow(txn)) continue;
      const label = mapCashflowDept(txn.department);
      if (!label) continue;
      const key = `${label}::${txn.date.slice(0, 7)}`;
      map.set(key, (map.get(key) || 0) + Number(txn.receipt || 0));
    }
    return map;
  }, [cashflowRows]);

  const chartData: MonthlyRow[] = useMemo(() => {
    const deptFilter = dept === 'All' ? null : dept;
    const targetByMonth = new Map<string, number>();
    for (const r of deptPerfRows) {
      if (deptFilter && r.department !== deptFilter) continue;
      const key = String(r.month_year ?? '').slice(0, 7);
      if (!fyMonths.includes(key)) continue;
      targetByMonth.set(key, (targetByMonth.get(key) || 0) + Number(r.target_amount || 0));
    }

    const activeDepts = deptFilter ? [deptFilter] : DEFAULT_DEPTS;

    return fyMonths.map(key => {
      const achieved = activeDepts.reduce((s, d) => s + (cashflowAchievedByDeptMonth.get(`${d}::${key}`) || 0), 0);
      const manualTarget = targetByMonth.get(key) || 0;
      const hardcodedTarget = deptFilter
        ? (HARDCODED_MONTHLY_TARGET[deptFilter] || 0)
        : activeDepts.reduce((s, d) => s + (HARDCODED_MONTHLY_TARGET[d] || 0), 0);
      return { month_year: key, achieved, target: manualTarget || hardcodedTarget };
    });
  }, [deptPerfRows, cashflowAchievedByDeptMonth, dept, fyMonths]);

  const total = useMemo(() => chartData.reduce((s, r) => s + r.achieved, 0), [chartData]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div>
          <p className="text-[11px] font-semibold text-[#2E3093] uppercase tracking-wider">
            Revenue by Department — FY {year}-{String(year + 1).slice(-2)}
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
