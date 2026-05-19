'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ResponsiveContainer } from 'recharts';
import type { CashflowTxn } from '../shared/types';
import { fmt } from '../shared/format';

interface Row { category: string; payment: number; receipt: number }

export default function CashflowCategoryBars({ rows }: { rows: CashflowTxn[] }) {
  const data: Row[] = useMemo(() => {
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

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-xs text-gray-400">
        Add cashflow transactions to see the category breakdown.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-[11px] font-semibold text-[#2E3093] uppercase tracking-wider mb-2">
        Payment vs Receipt by Category
      </p>
      <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="category" fontSize={10} angle={-12} textAnchor="end" height={50} />
            <YAxis fontSize={10} tickFormatter={(v: number) => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : String(v)} />
            <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={{ fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="payment" fill="#E84118" name="Payment" radius={[4, 4, 0, 0]} />
            <Bar dataKey="receipt" fill="#10B981" name="Receipt" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
    </div>
  );
}
