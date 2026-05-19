'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from 'recharts';
import type { CashflowTxn } from '../shared/types';
import { fmt } from '../shared/format';

interface Row { category: string; payment: number; receipt: number }

const LOAN_CATS = ['OD Interest / Loan EMI'];

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

export default function CashflowCategoryBars({ rows }: { rows: CashflowTxn[] }) {
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

  if (catData.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-xs text-gray-400">
        Add cashflow transactions to see the category breakdown.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-6">
      {/* Summary bar chart: Profit = Income - (Expense + Loan Repayment) */}
      <div>
        <p className="text-[11px] font-semibold text-[#2E3093] uppercase tracking-wider mb-3">
          Profit = Income − (Expense + Loan Repayment)
        </p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={summaryData} barSize={56}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey="name" tick={<CustomTick />} height={42} />
            <YAxis fontSize={10} tickFormatter={(v: number) => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : String(v)} />
            <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={{ fontSize: 11 }} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {summaryData.map((entry) => (
                <Cell key={entry.name} fill={SUMMARY_COLORS[entry.name] ?? '#6b7280'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
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

