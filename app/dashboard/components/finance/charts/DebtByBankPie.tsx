'use client';

import { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { Loan } from '../shared/types';
import { fmt } from '../shared/format';

const PALETTE = ['#2E3093', '#2A6BB5', '#3FA9F5', '#FAE452', '#F09819', '#E84118', '#10B981', '#A855F7', '#EC4899'];

export default function DebtByBankPie({ loans }: { loans: Loan[] }) {
  const data = useMemo(
    () =>
      loans
        .map(l => ({ name: l.bank_name, value: Math.max(0, Number(l.outstanding) - Number(l.paid)) }))
        .filter(d => d.value > 0)
        .sort((a, b) => b.value - a.value),
    [loans],
  );
  const total = useMemo(() => data.reduce((s, d) => s + d.value, 0), [data]);

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-xs text-gray-400">
        No outstanding debt to chart.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-[11px] font-semibold text-[#2E3093] uppercase tracking-wider mb-2">
        Debt Remaining by Bank — Total {fmt(total)}
      </p>
      <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={95} paddingAngle={2}>
              {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
            </Pie>
            <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={{ fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
