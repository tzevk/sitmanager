'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell, LabelList } from 'recharts';
import type { CashflowTxn } from '../shared/types';
import { fmt } from '../shared/format';

interface Row { category: string; payment: number; receipt: number }

const LOAN_CATS = ['OD Interest / Loan EMI'];

// Trainers and T&D are pure cost centres supporting CBD — no receipts of
// their own — so their expenses roll into CBD's profit % here, with the
// split still called out underneath. This is a display-only merge: the raw
// Cashflow tab / transaction table keeps each department separate.
const CBD_COMBINED_DEPTS = ['CBD', 'TRAINERS', 'T&D'];

// Same 5-bucket grouping as the Overview tab's Department-wise Breakdown
// (CBD / Deputation / Corporate Training / Accent Projects / Other) — with
// 9+ real departments in the raw data, showing every one individually left
// no room for readable bold labels at half chart width.
const NAMED_DEPTS: Record<string, string> = {
  'DEPUTATION ACCENT': 'Deputation Accent',
  'CORPORATE TRAINING': 'Corporate Training',
  'PROJECT ACCENT': 'Project Accent',
};

/** "45 L" / "1.2 Cr" — Indian-unit compact format for bar value labels. Empty for zero/negative. */
function fmtCompact(v: number): string {
  if (!v || v <= 0) return '';
  if (v >= 1_00_00_000) return `${(v / 1_00_00_000).toFixed(1)} Cr`;
  if (v >= 1_00_000) return `${(v / 1_00_000).toFixed(1)} L`;
  return v.toLocaleString('en-IN');
}

/** Same compact formatting as fmtCompact, but signed — for labels (e.g. Profit) that can be negative. */
function fmtCompactSigned(v: number): string {
  if (!v) return '';
  const sign = v < 0 ? '-' : '';
  return sign + fmtCompact(Math.abs(v));
}

interface DeptRow extends Row { profitPct: number | null }

function DeptTick(props: {
  x?: number | string; y?: number | string; payload?: { value: string };
  deptData: DeptRow[]; cbdBifurcation: Record<string, number>;
}) {
  const { x = 0, y = 0, payload, deptData, cbdBifurcation } = props;
  const label = payload?.value ?? '';
  const row = deptData.find(d => d.category === label);
  const pctText = row?.profitPct != null ? `${row.profitPct.toFixed(1)}% profit` : null;
  const pctColor = (row?.profitPct ?? 0) < 0 ? '#DC2626' : '#059669';
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={14} textAnchor="middle" fontSize={11} fontWeight={700} fill="#1f2937">{label}</text>
      {pctText && (
        <text x={0} y={28} textAnchor="middle" fontSize={9} fontWeight={600} fill={pctColor}>{pctText}</text>
      )}
      {label === 'CBD' && (
        <text x={0} y={40} textAnchor="middle" fontSize={8} fill="#9ca3af">
          {`CBD ${fmtCompact(cbdBifurcation.CBD) || '0'} · Trainers ${fmtCompact(cbdBifurcation.TRAINERS) || '0'} · T&D ${fmtCompact(cbdBifurcation['T&D']) || '0'}`}
        </text>
      )}
    </g>
  );
}

const SUMMARY_COLORS: Record<string, string> = {
  Income: '#3B82F6',
  Expense: '#E84118',
  'Loan Repayment': '#A855F7',
  Profit: '#10B981',
};

function CustomTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  const label = payload?.value ?? '';
  const color = SUMMARY_COLORS[label] ?? '#6b7280';
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={-36} y={6} width={72} height={22} rx={5} fill="white" stroke="#e5e7eb" />
      <rect x={-36} y={6} width={72} height={3} rx={2} fill={color} />
      <text x={0} y={22} textAnchor="middle" fontSize={10} fontWeight={600} fill={color}>{label}</text>
    </g>
  );
}

export default function CashflowCategoryBars({ rows, view = 'all' }: { rows: CashflowTxn[]; view?: 'all' | 'dept' | 'summary-and-category' }) {
  const catData: Row[] = useMemo(() => {
    const map = new Map<string, Row>();
    for (const r of rows) {
      const key = r.category || 'Uncategorised';
      const cur = map.get(key) ?? { category: key, payment: 0, receipt: 0 };
      cur.payment += Number(r.payment || 0);
      cur.receipt += Number(r.receipt || 0);
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => (b.payment + b.receipt) - (a.payment + a.receipt));
  }, [rows]);

  /** CBD's own payment vs what rolled in from Trainers/T&D — the bifurcation shown under its name. */
  const cbdBifurcation = useMemo(() => {
    const split = { CBD: 0, TRAINERS: 0, 'T&D': 0 };
    for (const r of rows) {
      const dept = (r.department || '').toUpperCase();
      if (dept === 'CBD') split.CBD += Number(r.payment || 0);
      else if (dept === 'TRAINERS') split.TRAINERS += Number(r.payment || 0);
      else if (dept === 'T&D') split['T&D'] += Number(r.payment || 0);
    }
    return split;
  }, [rows]);

  const deptData: (Row & { profitPct: number | null })[] = useMemo(() => {
    const map = new Map<string, Row>();
    for (const r of rows) {
      const rawDept = (r.department || 'Unassigned').toUpperCase();
      const key = CBD_COMBINED_DEPTS.includes(rawDept) ? 'CBD' : (NAMED_DEPTS[rawDept] ?? 'Other Departments');
      const cur = map.get(key) ?? { category: key, payment: 0, receipt: 0 };
      cur.payment += Number(r.payment || 0);
      cur.receipt += Number(r.receipt || 0);
      map.set(key, cur);
    }
    return Array.from(map.values())
      .map(d => ({ ...d, profitPct: d.receipt > 0 ? ((d.receipt - d.payment) / d.receipt) * 100 : null }))
      .sort((a, b) => (b.payment + b.receipt) - (a.payment + a.receipt));
  }, [rows]);

  const summaryData = useMemo(() => {
    const income    = rows.reduce((s, r) => s + Number(r.receipt || 0), 0);
    const loanRepay = rows.filter(r => LOAN_CATS.includes(r.category)).reduce((s, r) => s + Number(r.payment || 0), 0);
    const expense   = rows.reduce((s, r) => s + Number(r.payment || 0), 0) - loanRepay;
    const profit    = income - (expense + loanRepay);
    return [
      { name: 'Income',         value: income },
      { name: 'Expense',        value: expense },
      { name: 'Loan Repayment', value: loanRepay },
      { name: 'Profit',         value: profit },
    ];
  }, [rows]);

  const profitTotal = summaryData.find(d => d.name === 'Profit')?.value ?? 0;

  if (view !== 'dept' && catData.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-xs text-gray-400">
        Add cashflow transactions to see the category breakdown.
      </div>
    );
  }

  if (view === 'dept') {
    return (
      <div className="w-full rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-[11px] font-semibold text-[#2E3093] uppercase tracking-wider mb-3">
          Payment vs Receipt by Department
        </p>
        <div className="flex gap-3 mb-3">
          <span className="inline-flex flex-col items-center rounded-md border border-gray-200 bg-[#fef2f2] px-3 py-1 text-[11px] font-semibold text-gray-700">
            <span className="mb-1 h-1 w-full rounded bg-[#E84118]" />
            Payment
          </span>
          <span className="inline-flex flex-col items-center rounded-md border border-gray-200 bg-[#f0fdf4] px-3 py-1 text-[11px] font-semibold text-gray-700">
            <span className="mb-1 h-1 w-full rounded bg-[#10B981]" />
            Receipt
          </span>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={deptData} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="category"
              interval={0}
              height={56}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              tick={(props: any) => (
                <DeptTick {...props} deptData={deptData} cbdBifurcation={cbdBifurcation} />
              )}
            />
            <YAxis fontSize={10} tickFormatter={(v: number) => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : String(v)} />
            <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={{ fontSize: 11 }} />
            <Bar dataKey="payment" name="Payment" fill="#E84118" radius={[4, 4, 0, 0]}>
              <LabelList dataKey="payment" position="top" formatter={(v: unknown) => fmtCompact(Number(v) || 0)} fontSize={9} fontWeight={600} fill="#E84118" />
            </Bar>
            <Bar dataKey="receipt" name="Receipt" fill="#10B981" radius={[4, 4, 0, 0]}>
              <LabelList dataKey="receipt" position="top" formatter={(v: unknown) => fmtCompact(Number(v) || 0)} fontSize={9} fontWeight={600} fill="#10B981" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-6">
      {/* Summary bar chart: Profit = Income - (Expense + Loan Repayment) — half width */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-[11px] font-semibold text-[#2E3093] uppercase tracking-wider mb-3 flex items-center gap-2">
            Profit = Income − (Expense + Loan Repayment)
            <span className={`text-sm font-bold normal-case tracking-normal ${profitTotal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {fmt(profitTotal)}
            </span>
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={summaryData} barSize={56} barCategoryGap="10%">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="name" tick={<CustomTick />} height={42} />
              <YAxis fontSize={10} tickFormatter={(v: number) => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : String(v)} />
              <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={{ fontSize: 11 }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {summaryData.map((entry) => (
                  <Cell key={entry.name} fill={SUMMARY_COLORS[entry.name] ?? '#6b7280'} />
                ))}
                <LabelList dataKey="value" position="top" formatter={(v: unknown) => fmtCompactSigned(Number(v) || 0)} fontSize={10} fontWeight={700} fill="#374151" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* Empty right half */}
        <div />
      </div>

      {/* Category breakdown */}
      <div>
        <p className="text-[11px] font-semibold text-[#2E3093] uppercase tracking-wider mb-3">
          Payment vs Receipt by Category
        </p>
        <div className="flex gap-3 mb-3">
          <span className="inline-flex flex-col items-center rounded-md border border-gray-200 bg-[#fef2f2] px-3 py-1 text-[11px] font-semibold text-gray-700">
            <span className="mb-1 h-1 w-full rounded bg-[#E84118]" />
            Payment
          </span>
          <span className="inline-flex flex-col items-center rounded-md border border-gray-200 bg-[#f0fdf4] px-3 py-1 text-[11px] font-semibold text-gray-700">
            <span className="mb-1 h-1 w-full rounded bg-[#10B981]" />
            Receipt
          </span>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={catData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="category" fontSize={10} angle={-12} textAnchor="end" height={50} />
            <YAxis fontSize={10} tickFormatter={(v: number) => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : String(v)} />
            <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={{ fontSize: 11 }} />
            <Bar dataKey="payment" fill="#E84118" radius={[4, 4, 0, 0]} />
            <Bar dataKey="receipt" fill="#10B981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

